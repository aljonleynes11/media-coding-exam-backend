### AI Image Gallery (Backend)

AdonisJS backend that supports Supabase Auth, private image uploads to Supabase Storage, AI image analysis (OpenAI), signed-URL delivery, and secure image listing/serving.

### Tech stack
- AdonisJS 6 (HTTP, middleware, Lucid ORM, migrations)
- Supabase (Auth, Postgres, Storage, RLS)
- OpenAI (image analysis)
- Cloudinary Analyze API (fallback image analysis)
- Supabase Edge Function (`analyze-image`) for image analysis orchestration
- Sharp (thumbnail generation)

### Architecture
- **Models**
  - `User`, `Image`, `ImageMetadatum`
  - `Image` has an `@afterCreate` hook that triggers background AI analysis
- **Controllers**
  - `auth_controller.ts`, `uploads_controller.ts`, `images_controller.ts`, `users_controller.ts`
- **API**
  - Routes defined in `start/routes.ts`; JWT-auth via Supabase middleware; JSON responses
- **Observers**
  - `ImageObserverService`: runs after image creation and invokes the Supabase Edge Function `analyze-image` (when enabled) to perform AI analysis and persist results
- **Services**
  - `OpenAIService`: primary image analysis
  - `CloudinaryService`: fallback analysis via Cloudinary Analyze API
  - `FormatResponseService`: normalizes AI outputs to `{ tags, description, colors }`
  - `StorageUrlService`: issues short‑lived signed URLs for private images

### Prerequisites
- Node 18+ (Node 20 recommended)
- A Supabase project with Auth + Storage enabled

### Getting started
1) Install
```
npm install
```

2) Environment
Create a `.env` file with:
```
PORT=3333
HOST=0.0.0.0
APP_KEY=any-secret-string
NODE_ENV=development
LOG_LEVEL=info

# Supabase
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# Edge Functions (optional)
USE_EDGE_FUNCTIONS=false
SUPABASE_ANALYZE_IMAGE_URL=https://<project>.supabase.co/functions/v1/analyze-image
# Or provide a base and the app will call /analyze-image on it
SUPABASE_FUNCTIONS_URL=https://<project-ref>.functions.supabase.co

# OpenAI
OPENAI_API_KEY=<openai-api-key>
# Optional overrides
OPENAI_MODEL=gpt-4o-mini
OPENAI_BASE_URL=https://api.openai.com
OPENAI_TEMPERATURE=0.5

# Cloudinary (optional fallback)
CLOUDINARY_CLOUD_NAME=<cloud-name>
CLOUDINARY_API_KEY=<api-key>
CLOUDINARY_API_SECRET=<api-secret>
# Optional override
CLOUDINARY_API_BASE_URL=https://api.cloudinary.com

# API output options
API_EXPOSE_SIGNED_URLS=true
```

3) Database (migrations)
```
node ace migration:run
```

4) Supabase Storage setup
- Create a bucket named `images` (keep it Private)
- Apply Storage policies (SQL) to allow users to manage only their own files. The policies assume the folder structure `images/<user_id>/...`.
```sql
-- Read own files
create policy "read own images" on storage.objects
for select using (
  bucket_id = 'images' and split_part(name, '/', 1) = auth.uid()::text
);

-- Upload to own folder
create policy "upload own images" on storage.objects
for insert with check (
  bucket_id = 'images' and split_part(name, '/', 1) = auth.uid()::text
);

-- (Optional) Update/Delete own files
create policy "update own images" on storage.objects
for update using (
  bucket_id = 'images' and split_part(name, '/', 1) = auth.uid()::text
);
create policy "delete own images" on storage.objects
for delete using (
  bucket_id = 'images' and split_part(name, '/', 1) = auth.uid()::text
);
```

5) Run the server
```
npm run dev
```

### Auth
- Registration uses Supabase Admin API (no email verification):
  - POST `/api/auth/register` with JSON `{ email, password, confirm_password }`
- Login:
  - POST `/api/auth/login` with JSON `{ email, password }`
- Use the returned `access_token` in `Authorization: Bearer <token>` for protected endpoints.

### Uploads
- POST `/api/uploads` (protected)
  - Content-Type: `multipart/form-data`
  - Keys: single `image` or `file`; multiple `images` or `files`
  - Accepts: JPEG, PNG
  - Creates an `images` row with `original_path` and `thumbnail_path`
  - Generates a 300x300 thumbnail with Sharp
  - Triggers AI analysis in background via model hook
  - Response includes paths and, if `API_EXPOSE_SIGNED_URLS=true`, signed URLs

Example curl:
```
curl -X POST http://localhost:3333/api/uploads \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "image=@/path/to/photo.jpg"
```

### Images API (protected)
- GET `/api/images?limit=20&page=1&expiresIn=600[&embed=base64]`
  - Paginates current user images, newest first
  - Returns `image`, `metadata`, and (if `API_EXPOSE_SIGNED_URLS=true`) `urls: { original, thumbnail }` with short‑lived signed URLs
  - If `embed=base64`, includes `data_url` containing a base64 data URL of the thumbnail

- GET `/api/images/:id?expiresIn=600[&variant=original|thumbnail][&embed=base64]`
  - Returns the image record, metadata, and either:
    - If `variant` provided: a signed URL for that variant (when flag enabled)
    - Else: signed URLs for both original and thumbnail (when flag enabled)
  - If `embed=base64`, includes `data_url` of the original image

- GET `/api/images/:id/signed-url?variant=original|thumbnail&expiresIn=600`
  - Returns `{ url, expiresIn }` for the requested variant (ownership-checked)

- POST `/api/images/:id/analyze-now`
  - Manually triggers analysis for an image using the in-app `OpenAIService`
  - Upserts and updates `image_metadata` with `{ tags, description, colors }`
  - Useful for re-running analysis or when Edge Functions are disabled

All images remain private in Supabase; signed URLs are short‑lived and only issued to authenticated owners.

### AI analysis
- Primary: OpenAI (vision-capable chat.completions)
- Fallback: Cloudinary Analyze API (`ai_vision_tagging` + `captioning`)
- Orchestration: Supabase Edge Function (`analyze-image`) handles analysis and writes directly to `image_metadata`. The app's `ImageObserverService` triggers the function on `Image.@afterCreate`.
- Manual re-run: POST `/api/images/:id/analyze-now` to invoke `OpenAIService` directly and persist results.
- Outputs stored in `image_metadata`: `tags` (5–10), `description` (one sentence), `colors` (top 3 hex)
- Robustness:
  - Falls back/pads tags/colors to meet minimums
  - Console logs added for debugging request/response

### Why OpenAI?
- Pros: high accuracy, stable API, flexible JSON outputs, strong vision capabilities
- Trade‑offs: cost vs. cheaper vision models; requires careful prompting and JSON parsing

### Why Cloudinary?
- Pros: strong image detection via Analyze API and add-ons (e.g., tagging, captioning)
- Doubles as cloud storage and delivery: built-in transformations (thumbnails, resizing/shrinking, format conversion, cropping)
- Extraction: supports metadata/color information extraction and content analysis
- Operational: async analysis with webhooks; can analyze external URLs (works with our signed URLs)

### Why AdonisJS over Express.js / FastAPI?
- Maintainability & architecture: opinionated MVC, IoC container, and first-class modules (controllers, middleware, validators, Lucid ORM, migrations) promote a clean, scalable structure without glue code.
- Expansion-ready: conventions and a service/observer pattern make it straightforward to add features (auth, storage, jobs, AI services) while keeping boundaries clear.
- TypeScript-first: strong typing across the stack improves reliability and developer productivity.
- Compared to Express.js: avoids bespoke project scaffolding and fragmented patterns; less boilerplate and easier onboarding for teams.
- Compared to FastAPI: excellent framework, but adopting Python alongside a Node/Supabase codebase adds runtime split and deployment complexity. AdonisJS keeps a single runtime and cohesive toolchain.

### Troubleshooting
- “No valid image files to upload”: ensure your multipart key is `image`/`images`/`file`/`files` and the part has `image/png` or `image/jpeg` content-type
- “duplex option is required”: Node fetch needs `duplex: 'half'` (already added) for stream bodies
- Storage 403 on upload: verify Storage bucket policies and that the upload path begins with `<auth.uid()>` folder
- Sharp on Windows: try `npm rebuild sharp --force` and ensure Node 18+
- Signed URLs missing: set `SUPABASE_SERVICE_ROLE_KEY` and `API_EXPOSE_SIGNED_URLS=true`

### Scripts
```
npm run dev      # start with HMR
npm run build    # build to ./build
npm run start    # run built server
npm run test     # run tests
```

### Notes
- This repo is backend-only. A simple frontend can authenticate with Supabase, call the above APIs, and use returned signed URLs or base64 data URLs to render images.



### Decision
I decided to use OpenAI because it is currently more accurate for this use case, especially with GPT-5. In informal tests, uploading anime character images, OpenAI correctly identified specific characters, while Cloudinary did not.
