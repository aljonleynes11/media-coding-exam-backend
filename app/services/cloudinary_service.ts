import ImageMetadatum from '#models/image_metadatum'
import StorageUrlService from '#services/storage_url_service'
import FormatResponseService, { AnalyzeImageResult } from '#services/format_response_service'

function getCloudinaryAuthHeader(): string {
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET
  if (!apiKey || !apiSecret) {
    throw new Error('CLOUDINARY_API_KEY or CLOUDINARY_API_SECRET is not set')
  }
  const token = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')
  return `Basic ${token}`
}

export default class CloudinaryService {
  static async orchestrate(image: { id: number; userId: string; originalPath: string }) {
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

    const signedUrl = await StorageUrlService.generateSignedUrl(image.originalPath, 600)
    if (!signedUrl) {
      await placeholder.merge({ aiProcessingStatus: 'failed' }).save()
      return
    }

    try {
      const result = await CloudinaryService.analyzeImage(signedUrl)
      await placeholder
        .merge({
          description: result.description,
          tags: result.tags,
          colors: result.colors,
          aiProcessingStatus: 'completed',
        })
        .save()
    } catch (error) {
      await placeholder.merge({ aiProcessingStatus: 'failed' }).save()
    }
  }

  static async analyzeImage(imageUrl: string): Promise<AnalyzeImageResult> {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME
    if (!cloudName) {
      throw new Error('CLOUDINARY_CLOUD_NAME is not set')
    }

    const baseUrl = (process.env.CLOUDINARY_API_BASE_URL || 'https://api.cloudinary.com').replace(/\/$/, '')
    const auth = getCloudinaryAuthHeader()

    // Tagging
    const taggingRes = await fetch(
      `${baseUrl}/v2/analysis/${encodeURIComponent(cloudName)}/analyze/ai_vision_tagging`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: auth,
        },
        body: JSON.stringify({ source: { uri: imageUrl } }),
      }
    )

    let tags: string[] = []
    if (taggingRes.ok) {
      const taggingData: any = await taggingRes.json().catch(() => ({}))
      const possible = taggingData?.tags || taggingData?.result?.tags || taggingData?.data?.tags
      if (Array.isArray(possible)) {
        tags = possible
          .map((t: any) => (typeof t === 'string' ? t : t?.name || t?.tag || t?.label))
          .filter((t: any) => typeof t === 'string')
      } else if (Array.isArray(taggingData)) {
        tags = taggingData
          .map((t: any) => (typeof t === 'string' ? t : t?.name || t?.tag || t?.label))
          .filter((t: any) => typeof t === 'string')
      }
    }

    // Captioning
    const captionRes = await fetch(
      `${baseUrl}/v2/analysis/${encodeURIComponent(cloudName)}/analyze/captioning`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: auth,
        },
        body: JSON.stringify({ source: { uri: imageUrl } }),
      }
    )

    let description = ''
    if (captionRes.ok) {
      const captionData: any = await captionRes.json().catch(() => ({}))
      description =
        captionData?.caption ||
        captionData?.result?.caption ||
        captionData?.data?.caption ||
        captionData?.description ||
        ''
      if (typeof description !== 'string') description = ''
    }

    const formatted = FormatResponseService.formatImageAnalysis({ tags, description, colors: [] })
    return formatted
  }
}


