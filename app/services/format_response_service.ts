export type AnalyzeImageResult = {
  tags: string[]
  description: string
  colors: string[]
  raw?: unknown
}

function sanitizeHex(hex: string): string | null {
  const m = hex.trim().toUpperCase().match(/^#?([0-9A-F]{6})$/)
  return m ? `#${m[1]}` : null
}

function coerceToAnalyzeResult(input: any): AnalyzeImageResult {
  const tags: string[] = Array.isArray(input?.tags)
    ? input.tags.filter((t: any) => typeof t === 'string').slice(0, 10)
    : []

  const description: string = typeof input?.description === 'string' && input.description.trim().length > 0
    ? input.description.trim()
    : ''

  const colorsRaw: string[] = Array.isArray(input?.colors)
    ? input.colors.filter((c: any) => typeof c === 'string')
    : []
  const colorsSanitized = colorsRaw
    .map(sanitizeHex)
    .filter((c): c is string => !!c)
    .slice(0, 3)

  return {
    tags,
    description,
    colors: colorsSanitized,
    raw: input,
  }
}

function ensureMinimums(result: AnalyzeImageResult): AnalyzeImageResult {
  const next: AnalyzeImageResult = { ...result }

  if (next.tags.length < 5 && typeof next.description === 'string') {
    const extras = next.description
      .toLowerCase()
      .replace(/[^a-z0-9#\s]/g, '')
      .split(/\s+/)
      .filter(Boolean)
    next.tags = Array.from(new Set([...next.tags, ...extras])).slice(0, 5)
  }

  if (next.colors.length < 3) {
    const pad = ['#000000', '#FFFFFF', '#808080']
    next.colors = Array.from(new Set([...next.colors, ...pad])).slice(0, 3)
  }

  return next
}

export default class FormatResponseService {
  static formatImageAnalysis(input: any): AnalyzeImageResult {
    const base = coerceToAnalyzeResult(input)
    return ensureMinimums(base)
  }
}


