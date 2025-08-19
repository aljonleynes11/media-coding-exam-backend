import type { HttpContext } from '@adonisjs/core/http'

export default class CorsMiddleware {
  public async handle(ctx: HttpContext, next: () => Promise<void>) {
    const { request, response } = ctx

    const origin = request.header('origin') || request.header('Origin')
    const allowed = process.env.CORS_ORIGIN || 'http://localhost:3000'

    if (origin && (allowed === '*' || origin === allowed)) {
      response.header('Access-Control-Allow-Origin', origin)
      response.header('Vary', 'Origin')
    }
    response.header('Access-Control-Allow-Credentials', 'true')
    response.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS')
    const reqHeaders = request.header('access-control-request-headers')
    response.header('Access-Control-Allow-Headers', reqHeaders || 'Authorization, Content-Type')

    if (request.method() === 'OPTIONS') {
      response.status(204)
      return
    }

    await next()
  }
}


