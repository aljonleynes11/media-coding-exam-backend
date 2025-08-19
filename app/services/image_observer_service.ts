import ImageMetadatum from '#models/image_metadatum'
import StorageUrlService from '#services/storage_url_service'


type ImageLike = {
  id: number
  userId: string
  originalPath: string
}

export default class ImageObserverService {
  static async onImageCreated(image: ImageLike): Promise<void> {
    const useEdgeFunctions = true

    const placeholder = await ImageMetadatum.firstOrCreate(
      { imageId: image.id },
      {
        imageId: image.id,
        userId: image.userId,
        description: null,
        tags: null,
        colors: null,
        aiProcessingStatus: 'processing',
      }
    )

    if (useEdgeFunctions) {
      try {
        const explicitUrl = process.env.SUPABASE_ANALYZE_IMAGE_URL
        const urlBase = process.env.SUPABASE_FUNCTIONS_URL || ''
        const fnUrl = explicitUrl || `${urlBase}/analyze-image`

        let signedUrlEdge: string | null = null
        try {
          signedUrlEdge = await StorageUrlService.generateSignedUrl(image.originalPath, 600)
        } catch {}

        const resp = await fetch(fnUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            imageId: image.id,
            userId: image.userId,
            originalPath: image.originalPath,
            expiresIn: 600,
            imageUrl: signedUrlEdge || undefined,
          }),
        })
        if (!resp.ok) {
          await placeholder.merge({ aiProcessingStatus: 'failed' }).save()
          return
        }
        // Edge function owns DB update; nothing to merge locally
        return
      } catch (error) {
        await placeholder.merge({ aiProcessingStatus: 'failed' }).save()
        return
      }
    }
  }
}
