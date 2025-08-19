import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import logger from '@adonisjs/core/services/logger'

export default class AuthController {
  private getSupabaseEnv() {
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

    return { supabaseUrl, supabaseAnonKey }
  }

  private async callSupabaseAuth(path: string, init: RequestInit) {
    const { supabaseUrl, supabaseAnonKey } = this.getSupabaseEnv()
    if (!supabaseUrl || !supabaseAnonKey) {
      return {
        ok: false,
        status: 500,
        data: {
          error: 'Server misconfiguration',
          message: 'SUPABASE_URL or SUPABASE_ANON_KEY is not set',
        },
      }
    }

    const url = `${supabaseUrl.replace(/\/$/, '')}/auth/v1${path}`
    const response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        ...(init.headers || {}),
      },
    })

    let data: unknown
    try {
      data = await response.json()
    } catch {
      data = null
    }

    return { ok: response.ok, status: response.status, data }
  }

  public async register({ request, response }: HttpContext) {
    const email = request.input('email') as string | undefined
    const password = request.input('password') as string | undefined
    const confirmPassword = request.input('confirm_password') as string | undefined

    if (!email || !password || !confirmPassword) {
      return response.status(422).send({
        error: 'Validation failed',
        message: 'email, password and confirm_password are required',
      })
    }

    if (password !== confirmPassword) {
      return response.status(422).send({
        error: 'Validation failed',
        message: 'password and confirm_password do not match',
      })
    }

    const result = await this.callSupabaseAuth('/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })

    if (!result.ok) {
      return response.status(result.status).send(result.data)
    }

    const payload = result.data as any
    const supabaseUserId: string | undefined = payload?.user?.id || payload?.id
    const emailFromSupabase: string | undefined = payload?.user?.email || email

    if (supabaseUserId && emailFromSupabase) {
      try {
        await User.firstOrCreate(
          { supabaseUserId },
          { supabaseUserId, email: emailFromSupabase }
        )
      } catch {
        // ignore local creation error but still return success message
      }
    }

    return response.status(201).send({
      message: 'Registration successful. Please proceed to login.',
    })
  }

  public async login({ request, response }: HttpContext) {
    logger.info('login')
    const email = request.input('email') as string | undefined
    const password = request.input('password') as string | undefined

    if (!email || !password) {
      return response.status(422).send({
        error: 'Validation failed',
        message: 'email and password are required',
      })
    }

    const result = await this.callSupabaseAuth('/token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })

    if (!result.ok) {
      return response.status(result.status).send(result.data)
    }

    return response.status(200).send(result.data)
  }
}
