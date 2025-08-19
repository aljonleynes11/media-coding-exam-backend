import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.raw(`
      -- Enable RLS on application tables
      ALTER TABLE public.images ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.image_metadata ENABLE ROW LEVEL SECURITY;

      -- Images: users can only access their own rows
      DROP POLICY IF EXISTS "Users can only see own images" ON public.images;
      CREATE POLICY "Users can only see own images" ON public.images
        FOR ALL
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);

      -- Image metadata: users can only access their own rows
      DROP POLICY IF EXISTS "Users can only see own metadata" ON public.image_metadata;
      CREATE POLICY "Users can only see own metadata" ON public.image_metadata
        FOR ALL
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    `)
  }

  async down() {
    this.schema.raw(`
      -- Disable RLS (optional rollback) and drop policies
      DROP POLICY IF EXISTS "Users can only see own metadata" ON public.image_metadata;
      DROP POLICY IF EXISTS "Users can only see own images" ON public.images;
      ALTER TABLE public.image_metadata DISABLE ROW LEVEL SECURITY;
      ALTER TABLE public.images DISABLE ROW LEVEL SECURITY;
    `)
  }
}
