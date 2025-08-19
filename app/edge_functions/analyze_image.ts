// // Supabase Edge Function: analyze-image (Deno)
// // Paste into: supabase/functions/analyze-image/index.ts
// import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// type AnalysisResult = {
//   tags: string[]
//   description: string
//   colors: string[]
// }

// type Payload = {
//   imageId: number
//   userId: string
//   originalPath: string
//   expiresIn?: number
//   imageUrl?: string
// }

// // ---- Formatting utils (mirrors app FormatResponseService) ----
// function sanitizeHex(hex: string): string | null {
//   const m = hex.trim().toUpperCase().match(/^#?([0-9A-F]{6})$/)
//   return m ? `#${m[1]}` : null
// }

// function toStringArray(input: unknown): string[] {
//   if (!Array.isArray(input)) return []
//   return input
//     .map((v) => (typeof v === "string" ? v : typeof (v as any)?.name === "string" ? (v as any).name : typeof (v as any)?.tag === "string" ? (v as any).tag : typeof (v as any)?.label === "string" ? (v as any).label : null))
//   .filter((v): v is string => typeof v === "string")
// }

// function formatImageAnalysis(input: any): AnalysisResult {
//   const tags = toStringArray(input?.tags).slice(0, 10)
//   const description =
//     typeof input?.description === "string" && input.description.trim()
//     ? input.description.trim()
//       : ""
//   const colorsRaw = toStringArray(input?.colors)
//   let colors = colorsRaw.map(sanitizeHex).filter((c): c is string => !!c).slice(0, 3)

//   if (tags.length < 5 && description) {
//     const extras = description
//       .toLowerCase()
//       .replace(/[^a-z0-9#\s]/g, "")
//       .split(/\s+/)
//       .filter(Boolean)
//     const merged = Array.from(new Set([...tags, ...extras]))
//     merged.splice(10)
//     return {
//       tags: merged,
//       description,
//       colors: colors.length >= 3 ? colors : Array.from(new Set([...colors, "#000000", "#FFFFFF", "#808080"])).slice(0, 3),
//     }
//   }

//   if (colors.length < 3) {
//     colors = Array.from(new Set([...colors, "#000000", "#FFFFFF", "#808080"])).slice(0, 3)
//   }

//   return { tags, description, colors }
// }

// // ---- Services (OpenAI primary, Cloudinary fallback) ----
// async function analyzeWithOpenAI(imageUrl: string): Promise<AnalysisResult> {
//   const apiKey = Deno.env.get("OPENAI_API_KEY")
//   if (!apiKey) throw new Error("OPENAI_API_KEY is not set")

//   const baseUrl = (Deno.env.get("OPENAI_BASE_URL") || "https://api.openai.com").replace(/\/$/, "")
//   const model = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini"
//   const temperature = Number(Deno.env.get("OPENAI_TEMPERATURE") || "0.5")

//       const payload = {
//         model,
//         response_format: { type: "json_object" },
//         temperature,
//         messages: [
//       {
//         role: "system",
//         content:
//           "You analyze images and return strictly JSON with fields: tags (5-10 concise lowercase nouns), description (one sentence), colors (top 3 hex like #RRGGBB). No extra text.",
//       },
//           {
//             role: "user",
//             content: [
//               { type: "text", text: "Analyze this image and return JSON with keys: tags, description, colors." },
//               { type: "image_url", image_url: { url: imageUrl } },
//             ],
//           },
//         ],
//   }

//   const res = await fetch(`${baseUrl}/v1/chat/completions`, {
//         method: "POST",
//     headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
//         body: JSON.stringify(payload),
//   })
//   if (!res.ok) {
//     throw new Error(`OpenAI error: ${res.status} ${await res.text().catch(() => "")}`)
//   }

//   const data: any = await res.json()
//   const content: string | undefined = data?.choices?.[0]?.message?.content
//   let parsed: any
//   try {
//     parsed = content ? JSON.parse(content) : {}
//     } catch {
//     parsed = { description: content || "" }
//   }
//   return formatImageAnalysis(parsed)
// }

// async function analyzeWithCloudinary(imageUrl: string): Promise<AnalysisResult> {
//   const cloudName = Deno.env.get("CLOUDINARY_CLOUD_NAME")
//   const apiKey = Deno.env.get("CLOUDINARY_API_KEY")
//   const apiSecret = Deno.env.get("CLOUDINARY_API_SECRET")
//   if (!cloudName || !apiKey || !apiSecret) throw new Error("Cloudinary env vars missing")

//   const baseUrl = (Deno.env.get("CLOUDINARY_API_BASE_URL") || "https://api.cloudinary.com").replace(/\/$/, "")
//   const auth = "Basic " + btoa(`${apiKey}:${apiSecret}`)

//       // Tagging
//       const tagRes = await fetch(`${baseUrl}/v2/analysis/${encodeURIComponent(cloudName)}/analyze/ai_vision_tagging`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: auth },
//         body: JSON.stringify({ source: { uri: imageUrl } }),
//   })

//   let tags: string[] = []
//       if (tagRes.ok) {
//     const tagData: any = await tagRes.json().catch(() => ({}))
//     const possible = tagData?.tags || tagData?.result?.tags || tagData?.data?.tags
//     const arr = Array.isArray(possible) ? possible : Array.isArray(tagData) ? tagData : []
//     tags = toStringArray(arr)
//   }

//   // Captioning
//       const capRes = await fetch(`${baseUrl}/v2/analysis/${encodeURIComponent(cloudName)}/analyze/captioning`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: auth },
//         body: JSON.stringify({ source: { uri: imageUrl } }),
//   })

//   let description = ""
//       if (capRes.ok) {
//     const capData: any = await capRes.json().catch(() => ({}))
//     description =
//       typeof capData?.caption === "string"
//         ? capData.caption
//         : typeof capData?.result?.caption === "string"
//         ? capData.result.caption
//         : typeof capData?.data?.caption === "string"
//         ? capData.data.caption
//         : typeof capData?.description === "string"
//         ? capData.description
//         : ""
//   }

//   return formatImageAnalysis({ tags, description, colors: [] })
// }

// // ---- Handler ----
// Deno.serve(async (req: Request) => {
//   try {
//     const { imageId, userId, originalPath, expiresIn = 600, imageUrl: providedUrl } = (await req.json()) as Payload

//     const supabaseUrl = Deno.env.get("SUPABASE_URL")!
//     const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
//     const supabase = createClient(supabaseUrl, serviceRoleKey)

//     // Ensure/mark processing row (create if missing)
//     {
//       const { data: updated, error: updErr } = await supabase
//         .from("image_metadata")
//         .update({ ai_processing_status: "processing", user_id: userId })
//         .eq("image_id", imageId)
//         .select('id')
//       if (updErr) return new Response(`db-error: ${updErr.message}`, { status: 500 })
//       if (!updated || updated.length === 0) {
//         const { error: insErr } = await supabase
//           .from("image_metadata")
//           .insert({
//             image_id: imageId,
//             user_id: userId,
//             description: null,
//             tags: null,
//             colors: null,
//             ai_processing_status: "processing",
//           })
//         if (insErr) return new Response(`db-error: ${insErr.message}`, { status: 500 })
//       }
//     }

//     // Resolve image URL (prefer provided signed URL; else generate one from Storage)
//     let imageUrl = providedUrl
//     if (!imageUrl) {
//       const [bucket, ...rest] = originalPath.split("/")
//       const objectPath = rest.join("/")
//       const { data: signed, error: signedErr } = await supabase.storage.from(bucket).createSignedUrl(objectPath, expiresIn)
//       if (signedErr || !signed?.signedUrl) {
//         const { data: updated, error: updErr } = await supabase
//           .from("image_metadata")
//           .update({ ai_processing_status: "failed" })
//           .eq("image_id", imageId)
//           .select('id')
//         if ((!updated || updated.length === 0)) {
//           await supabase.from("image_metadata").insert({ image_id: imageId, user_id: userId, ai_processing_status: "failed" })
//         }
//         return new Response("no-signed-url", { status: 500 })
//       }
//       imageUrl = signed.signedUrl
//     }
//     const finalUrl = imageUrl as string

//     // Try OpenAI → fallback Cloudinary
//     let result: AnalysisResult
//     try {
//       result = await analyzeWithOpenAI(finalUrl)
//     } catch {
//       result = await analyzeWithCloudinary(finalUrl)
//     }

//     // Persist (update if exists, else insert)
//     {
//       const { data: updated, error: updErr } = await supabase
//         .from("image_metadata")
//         .update({
//           description: result.description,
//           tags: result.tags,
//           colors: result.colors,
//           ai_processing_status: "completed",
//         })
//         .eq("image_id", imageId)
//         .select('id')
//       if (updErr) return new Response(`db-error: ${updErr.message}`, { status: 500 })
//       if (!updated || updated.length === 0) {
//         const { error: insErr } = await supabase
//       .from("image_metadata")
//           .insert({
//         image_id: imageId,
//         user_id: userId,
//             description: result.description,
//             tags: result.tags,
//             colors: result.colors,
//         ai_processing_status: "completed",
//           })
//         if (insErr) return new Response(`db-error: ${insErr.message}`, { status: 500 })
//       }
//     }

//     return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } })
//   } catch (e) {
//     return new Response(`error: ${(e as Error).message}`, { status: 500 })
//   }
// })
