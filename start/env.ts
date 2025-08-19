/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| The `Env.create` method creates an instance of the Env service. The
| service validates the environment variables and also cast values
| to JavaScript data types.
|
*/

import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  APP_KEY: Env.schema.string(),
  APP_NAME: Env.schema.string.optional(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string(),

  SUPABASE_URL: Env.schema.string(),
  SUPABASE_ANON_KEY: Env.schema.string(),
  SUPABASE_SERVICE_ROLE_KEY: Env.schema.string.optional(),
  SUPABASE_FUNCTIONS_URL: Env.schema.string.optional(),
  SUPABASE_ANALYZE_IMAGE_URL: Env.schema.string.optional(),
  USE_EDGE_FUNCTIONS: Env.schema.boolean.optional(),
  API_EXPOSE_SIGNED_URLS: Env.schema.boolean.optional(),
  OPENAI_TEMPERATURE: Env.schema.number.optional(),
})
