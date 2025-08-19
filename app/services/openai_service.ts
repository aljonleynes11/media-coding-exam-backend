import ImageMetadatum from '#models/image_metadatum'
import StorageUrlService from '#services/storage_url_service'
import FormatResponseService, { AnalyzeImageResult } from '#services/format_response_service'

export default class OpenAIService {
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

    const imageUrl = signedUrl

    try {
      const result = await OpenAIService.analyzeImage(imageUrl)
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

  static async analyzeImage(
    imageUrl: string,
    opts?: { model?: string; temperature?: number }
  ): Promise<AnalyzeImageResult> {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set')
    }

    const model = opts?.model || process.env.OPENAI_MODEL || 'gpt-4o-mini'
    const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com').replace(/\/$/, '')
    const envTemp = Number(process.env.OPENAI_TEMPERATURE)
    const temperature = Number.isFinite(envTemp)
      ? envTemp
      : opts?.temperature ?? (process.env.OPENAI_MODEL === 'gpt-5' ? 1 : 0.5)

    const payload = {
      model,
      response_format: { type: 'json_object' },
      temperature,
      messages: [
        {
          role: 'system',
          content:
            'You analyze images and return strictly JSON with fields: tags (5-10 concise lowercase nouns), description (one sentence), colors (top 3 hex like #RRGGBB). No extra text.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analyze this image and return JSON with keys: tags, description, colors.' },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
    } as any

    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      throw new Error(`OpenAI error: ${res.status} ${txt}`)
    }

    const data: any = await res.json()
    const content: string | undefined = data?.choices?.[0]?.message?.content
    let parsed: any
    try {
      parsed = content ? JSON.parse(content) : {}
    } catch {
      parsed = { description: content || '' }
    }

    return FormatResponseService.formatImageAnalysis(parsed)
  }
}



