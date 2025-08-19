import type { HttpContext } from '@adonisjs/core/http'

export default class SupabaseAuthMiddleware {
  public async handle(ctx: HttpContext, next: () => Promise<void>) {
    const { request, response } = ctx

    const authHeader = request.header('authorization') || request.header('Authorization')
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring('Bearer '.length).trim()
      : undefined

    if (!token) {
      return response.status(401).send({ error: 'Unauthorized', message: 'Missing bearer token' })
    }

    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseAnonKey) {
      return response.status(500).send({
        error: 'Server misconfiguration',
        message: 'SUPABASE_URL or SUPABASE_ANON_KEY is not set',
      })
    }

    const url = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`
    const verifyResponse = await fetch(url, {
      method: 'GET',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`,
      },
    })

    if (!verifyResponse.ok) {
      return response.status(401).send({ error: 'Unauthorized' })
    }

    let user: any
    try {
      user = await verifyResponse.json()
    } catch {
      user = null
    }

    ;(request as any).supabaseUser = user
    ;(request as any).supabaseAccessToken = token

    await next()
  }
}


