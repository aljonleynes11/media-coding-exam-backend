import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.raw(`
      -- Enable RLS on public.users and create minimal self-access policies
      ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS "Users can select own user" ON public.users;
      CREATE POLICY "Users can select own user" ON public.users
        FOR SELECT
        USING (auth.uid()::uuid = supabase_user_id);

      -- (Optional) Allow users to update their own row if needed. Commented out by default.
      -- DROP POLICY IF EXISTS "Users can update own user" ON public.users;
      -- CREATE POLICY "Users can update own user" ON public.users
      --   FOR UPDATE
      --   USING (auth.uid()::uuid = supabase_user_id)
      --   WITH CHECK (auth.uid()::uuid = supabase_user_id);
    `)
  }

  async down() {
    this.schema.raw(`
      DROP POLICY IF EXISTS "Users can select own user" ON public.users;
      -- DROP POLICY IF EXISTS "Users can update own user" ON public.users;
      ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
    `)
  }
}
