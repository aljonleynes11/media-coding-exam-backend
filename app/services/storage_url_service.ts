import { createClient } from '@supabase/supabase-js'

export default class StorageUrlService {
  static async generateSignedUrl(fullPath: string, expiresIn = 600): Promise<string | null> {
    const supabaseUrl = process.env.SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) return null

    const [bucket, ...rest] = fullPath.split('/')
    const objectPath = rest.join('/')
    if (!bucket || !objectPath) return null

    const supabase = createClient(supabaseUrl, serviceKey)
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(objectPath, expiresIn)
    if (error || !data?.signedUrl) return null
    return data.signedUrl
  }

  static async fetchDataUrl(fullPath: string, userToken: string): Promise<string | null> {
    const supabaseUrl = process.env.SUPABASE_URL
    const anonKey = process.env.SUPABASE_ANON_KEY
    if (!supabaseUrl || !anonKey || !userToken) return null

    const url = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/authenticated/${fullPath}`
    const res = await fetch(url, {
      method: 'GET',
      headers: { apikey: anonKey, Authorization: `Bearer ${userToken}` },
    })
    if (!res.ok) return null
    const contentType = res.headers.get('content-type') || 'application/octet-stream'
    const buffer = Buffer.from(await res.arrayBuffer())
    const base64 = buffer.toString('base64')
    return `data:${contentType};base64,${base64}`
  }
}


