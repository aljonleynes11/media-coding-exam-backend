import type { HttpContext } from '@adonisjs/core/http'
import Image from '#models/image'
import StorageUrlService from '#services/storage_url_service'
import ImageMetadatum from '#models/image_metadatum'
import OpenAIService from '#services/openai_service'

export default class ImagesController {
  // Env access for proxy streaming has been replaced by signed-URL approach

  private splitStoragePath(fullPath: string) {
    const [bucket, ...rest] = fullPath.split('/')
    return { bucket, objectPath: rest.join('/') }
  }

  // Data URL generation moved to StorageUrlService

  public async show({ params, request, response }: HttpContext) {
    const id = Number(params.id)
    const variant = request.qs().variant as 'original' | 'thumbnail' | undefined
    const expiresIn = Number(request.qs().expiresIn || 600)

    if (!id || Number.isNaN(id)) {
      return response.status(400).send({ error: 'Invalid id' })
    }

    const supabaseUser: any = (request as any).supabaseUser
    if (!supabaseUser?.id) {
      return response.status(401).send({ error: 'Unauthorized' })
    }

    const image = await Image.find(id)
    if (!image || image.userId !== supabaseUser.id) {
      return response.status(404).send({ error: 'Not found' })
    }

    const metadata = await ImageMetadatum.query().where('image_id', image.id).first()
    const userToken = (request as any).supabaseAccessToken as string

    // If a variant is specified, mirror the signed-url endpoint behavior
    if (variant) {
      const fullPath = variant === 'thumbnail' ? image.thumbnailPath : image.originalPath
      const { bucket, objectPath } = this.splitStoragePath(fullPath)
      const missingKey = !process.env.SUPABASE_SERVICE_ROLE_KEY
      const expose = String(process.env.API_EXPOSE_SIGNED_URLS || '').toLowerCase() === 'true'
      const signedUrl = expose
        ? await StorageUrlService.generateSignedUrl(`${bucket}/${objectPath}`, expiresIn)
        : null
      if (expose && !signedUrl) {
        return response.status(500).send({
          error: 'Failed to create signed URL',
          hint: missingKey ? 'SUPABASE_SERVICE_ROLE_KEY is missing' : undefined,
        })
      }
      let dataUrl: string | null = null
      const embed = String(request.qs().embed || '').toLowerCase()
      if (embed === 'base64') {
        // For show, base64 should always be the main/original image
        dataUrl = await StorageUrlService.fetchDataUrl(image.originalPath, userToken)
      }
      return response.send({
        image,
        metadata,
        variant,
        ...(expose ? { url: signedUrl, expiresIn } : {}),
        data_url: dataUrl,
      })
    }

    // No variant: return both signed URLs
    const expose = String(process.env.API_EXPOSE_SIGNED_URLS || '').toLowerCase() === 'true'
    const missingKey = !process.env.SUPABASE_SERVICE_ROLE_KEY
    const [origBucket, ...origRest] = image.originalPath.split('/')
    const [thumbBucket, ...thumbRest] = image.thumbnailPath.split('/')
    const origSigned = expose
      ? await StorageUrlService.generateSignedUrl(`${origBucket}/${origRest.join('/')}`, expiresIn)
      : null
    const thumbSigned = expose
      ? await StorageUrlService.generateSignedUrl(`${thumbBucket}/${thumbRest.join('/')}`, expiresIn)
      : null
    if (expose && (!origSigned || !thumbSigned)) {
      return response.status(500).send({
        error: 'Failed to create signed URLs',
        hint: missingKey ? 'SUPABASE_SERVICE_ROLE_KEY is missing' : undefined,
      })
    }

    const embed = String(request.qs().embed || '').toLowerCase()
    let dataUrl: string | null = null
    if (embed === 'base64') {
      // For show, base64 should be the main/original image
      dataUrl = await StorageUrlService.fetchDataUrl(image.originalPath, userToken)
    }

    return response.send({
      image,
      metadata,
      ...(expose
        ? {
            expiresIn,
            urls: { original: origSigned, thumbnail: thumbSigned },
          }
        : {}),
      data_url: dataUrl,
    })
  }

  public async signedUrl({ params, request, response }: HttpContext) {
    const id = Number(params.id)
    const variant = (request.qs().variant as 'original' | 'thumbnail' | undefined) || 'original'
    const expiresIn = Number(request.qs().expiresIn || 600)

    if (!id || Number.isNaN(id) || expiresIn <= 0) {
      return response.status(400).send({ error: 'Invalid parameters' })
    }

    const supabaseUser: any = (request as any).supabaseUser
    if (!supabaseUser?.id) {
      return response.status(401).send({ error: 'Unauthorized' })
    }

    const image = await Image.find(id)
    if (!image || image.userId !== supabaseUser.id) {
      return response.status(404).send({ error: 'Not found' })
    }

    const fullPath = variant === 'thumbnail' ? image.thumbnailPath : image.originalPath
    const { bucket, objectPath } = this.splitStoragePath(fullPath)

    const missingKey = !process.env.SUPABASE_SERVICE_ROLE_KEY
    const signedUrl = await StorageUrlService.generateSignedUrl(`${bucket}/${objectPath}`, expiresIn)
    if (!signedUrl) {
      return response.status(500).send({
        error: 'Failed to create signed URL',
        hint: missingKey ? 'SUPABASE_SERVICE_ROLE_KEY is missing' : undefined,
      })
    }

    const metadata = await ImageMetadatum.query().where('image_id', image.id).first()

    return response.send({
      image,
      metadata,
      variant,
      url: signedUrl,
      expiresIn,
    })
  }

  public async index({ request, response }: HttpContext) {
    const supabaseUser: any = (request as any).supabaseUser
    if (!supabaseUser?.id) {
      return response.status(401).send({ error: 'Unauthorized' })
    }

    const limit = Math.max(1, Math.min(50, Number(request.qs().limit || 20)))
    const page = Math.max(1, Number(request.qs().page || 1))
    const offset = (page - 1) * limit
    const expiresIn = Number(request.qs().expiresIn || 600)

    const images = await Image.query()
      .where('user_id', supabaseUser.id)
      .orderBy('uploaded_at', 'desc')
      .limit(limit)
      .offset(offset)

    const imageIds = images.map((i) => i.id)
    const metadatas = await ImageMetadatum.query().whereIn('image_id', imageIds)
    const metadataByImageId = new Map(metadatas.map((m) => [m.imageId, m]))

    const embed = String(request.qs().embed || '').toLowerCase()
    const expose = String(process.env.API_EXPOSE_SIGNED_URLS || '').toLowerCase() === 'true'
    const items = await Promise.all(
      images.map(async (img) => {
        const [ob, ...or] = img.originalPath.split('/')
        const [tb, ...tr] = img.thumbnailPath.split('/')
        const original = expose
          ? await StorageUrlService.generateSignedUrl(`${ob}/${or.join('/')}`, expiresIn)
          : null
        const thumbnail = expose
          ? await StorageUrlService.generateSignedUrl(`${tb}/${tr.join('/')}`, expiresIn)
          : null
        let dataUrl: string | null = null
        if (embed === 'base64') {
          const token = (request as any).supabaseAccessToken as string
          // For index, base64 should be the thumbnail
          dataUrl = await StorageUrlService.fetchDataUrl(img.thumbnailPath, token)
        }
        return {
          image: img,
          metadata: metadataByImageId.get(img.id) || null,
          ...(expose ? { urls: { original, thumbnail }, expiresIn } : {}),
          data_url: dataUrl,
        }
      })
    )

    return response.send({ page, limit, count: items.length, items })
  }

  public async analyzeNow({ params, request, response }: HttpContext) {
    const id = Number(params.id)
    if (!id || Number.isNaN(id)) {
      return response.status(400).send({ error: 'Invalid id' })
    }

    const supabaseUser: any = (request as any).supabaseUser
    if (!supabaseUser?.id) {
      return response.status(401).send({ error: 'Unauthorized' })
    }

    const image = await Image.find(id)
    if (!image || image.userId !== supabaseUser.id) {
      return response.status(404).send({ error: 'Not found' })
    }

    const signedUrl = await StorageUrlService.generateSignedUrl(image.originalPath, 600)
    if (!signedUrl) {
      return response.status(500).send({ error: 'Failed to create signed URL' })
    }

    try {
      const result = await OpenAIService.analyzeImage(signedUrl)
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
      await placeholder
        .merge({
          description: result.description,
          tags: result.tags,
          colors: result.colors,
          aiProcessingStatus: 'completed',
        })
        .save()
      return response.send({ ok: true, metadata: result })
    } catch (err) {
      return response.status(500).send({ error: 'OpenAI analysis failed' })
    }
  }
}
