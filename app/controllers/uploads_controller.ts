import type { HttpContext } from '@adonisjs/core/http'
type NodeFetchRequestInit = any
type NodeFetchBodyInit = any
import { createReadStream, promises as fs } from 'node:fs'
import { randomUUID } from 'node:crypto'
import Image from '#models/image'
import { DateTime } from 'luxon'
import StorageUrlService from '#services/storage_url_service'

export default class UploadsController {
  private getSupabaseEnv() {
    const supabaseUrl = process.env.SUPABASE_URL
    const anonKey = process.env.SUPABASE_ANON_KEY
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    return { supabaseUrl, anonKey, serviceKey }
  }

  // Removed public URL fallback to enforce private access with signed URLs

  private async uploadToSupabaseStorage(
    bucket: string,
    objectPath: string,
    body: NodeFetchBodyInit,
    contentType: string,
    preferUserToken: string
  ) {
    const { supabaseUrl, anonKey, serviceKey } = this.getSupabaseEnv()
    if (!supabaseUrl || !anonKey) {
      throw new Error('Supabase env not configured')
    }

    const storageUrl = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/${bucket}/${objectPath}`

    const authBearer = preferUserToken || serviceKey
    const res = await fetch(storageUrl, {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
        apikey: anonKey,
        Authorization: `Bearer ${authBearer}`,
      },
      body,
      // Required by Node's fetch (undici) when sending a stream body
      duplex: 'half',
    } as unknown as NodeFetchRequestInit)

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Storage upload failed: ${res.status} ${errText}`)
    }

    // public URL construction depends on bucket policy; return path for now
    return { path: `${bucket}/${objectPath}` }
  }

  private async generateThumbnailFromFile(tmpPath: string): Promise<Buffer> {
   try{

    // @ts-ignore - allow dynamic import without types
    const sharp = await import('sharp')
    const inputBuffer = await fs.readFile(tmpPath)
    const thumbBuffer = await sharp.default(inputBuffer)
      .resize(300, 300, { fit: 'cover' })
      .jpeg({ quality: 80 })
      .toBuffer()
    return thumbBuffer
   } catch (error) {
    throw 'Thumbnail generation failed'
   }
  }

  // Signed URL generation is now handled by the dedicated service where needed

  public async upload({ request, response }: HttpContext) {
    const supabaseUser: any = (request as any).supabaseUser
    if (!supabaseUser?.id) {
      return response.status(401).send({ error: 'Unauthorized' })
    }

    const userToken: string = (request as any).supabaseAccessToken as string



    const files =
      (request.files('images') as any[])?.length
        ? request.files('images')
        : request.files('files')?.length
          ? request.files('files')
          : [request.file('image') || request.file('file')].filter(Boolean)

    if (!files || files.length === 0) {
      return response.status(400).send({ error: 'No files uploaded' })
    }

    const allowed = new Set(['image/jpeg', 'image/png'])
    const bucket = 'images'
    const uploaded: any[] = []

    for (const file of files) {
      const subtype: string = (file?.subtype as string) || ''
      const mime: string = file?.type && file?.subtype ? `${file.type}/${file.subtype}` : ''

      if (!file || !file.tmpPath || !allowed.has(mime)) {
        continue
      }

      const originalExt = file.extname || (subtype === 'png' ? 'png' : 'jpg')
      const baseName = `${randomUUID()}`
      const originalObject = `${supabaseUser.id}/${baseName}.${originalExt}`
      const thumbObject = `${supabaseUser.id}/${baseName}_thumb.jpg`

      // Upload original
      const originalStream = createReadStream(file.tmpPath)
      const contentType: string = mime || (originalExt === 'png' ? 'image/png' : 'image/jpeg')
      await this.uploadToSupabaseStorage(
        bucket,
        originalObject,
        originalStream as unknown as NodeFetchBodyInit,
        contentType,
        userToken
      )

      // Create thumbnail
      let thumbBuffer: Buffer
      try {
        thumbBuffer = await this.generateThumbnailFromFile(file.tmpPath)
      } catch {
        return response.status(500).send({ error: 'Thumbnail generation failed' })
      }

      await this.uploadToSupabaseStorage(
        bucket,
        thumbObject,
        thumbBuffer as unknown as NodeFetchBodyInit,
        'image/jpeg',
        userToken
      )

      const originalPath = `${bucket}/${originalObject}`
      const thumbnailPath = `${bucket}/${thumbObject}`

      // Persist image record
      const imageRecord = await Image.create({
        userId: String(supabaseUser.id),
        filename: file.clientName,
        originalPath,
        thumbnailPath,
        uploadedAt: DateTime.now(),
      })

      // Model hook will orchestrate analysis; no controller trigger needed

      const expose = String(process.env.API_EXPOSE_SIGNED_URLS || '').toLowerCase() === 'true'
      const signedOriginal = expose ? await StorageUrlService.generateSignedUrl(originalPath, 600) : null
      const signedThumbnail = expose ? await StorageUrlService.generateSignedUrl(thumbnailPath, 600) : null

      uploaded.push({
        id: imageRecord.id,
        filename: file.clientName,
        original_path: originalPath,
        thumbnail_path: thumbnailPath,
        ...(expose
          ? {
              signed_url_original: signedOriginal,
              signed_url_thumbnail: signedThumbnail,
            }
          : {}),
      })
    }

    if (uploaded.length === 0) {
      return response.status(400).send({ error: 'No valid image files to upload' })
    }

    return response.status(201).send({ uploaded })
  }
}
