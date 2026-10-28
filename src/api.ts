import { parseCaptions } from "./parse";
import { extract } from "./extract";
export const MAX_BYTES = 2_000_000;
const j = (b: unknown, status = 200) => new Response(JSON.stringify(b, null, 2), { status, headers: { "content-type": "application/json", "access-control-allow-origin": "*" } });
export async function handleApi(req: Request): Promise<Response> {
  const u = new URL(req.url);
  if (req.method === "OPTIONS") return new Response(null, { headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "POST,GET", "access-control-allow-headers": "content-type" } });
  if (u.pathname === "/v1/health") return j({ ok: true, version: "1.0.0" });
  if (u.pathname !== "/v1/extract") return j({ error: "not_found" }, 404);
  if (req.method !== "POST") return j({ error: "method_not_allowed" }, 405);
  const len = +(req.headers.get("content-length") ?? 0); if (len > MAX_BYTES) return j({ error: "too_large", limit: MAX_BYTES }, 413);
  let body: any; try { body = await req.json(); } catch { return j({ error: "invalid_json" }, 400); }
  if (typeof body?.captions !== "string" || !body.captions.trim()) return j({ error: "captions_required", hint: "POST {\"captions\": \"<WebVTT or SRT text>\"}" }, 400);
  if (body.captions.length > MAX_BYTES) return j({ error: "too_large", limit: MAX_BYTES }, 413);
  let cues; try { cues = parseCaptions(body.captions); } catch (e) { return j({ error: "parse_error", detail: String((e as Error).message) }, 422); }
  if (!cues.length) return j({ error: "no_cues" }, 422);
  const t0 = Date.now(); const out = extract(cues, { keywords: Math.min(50, Math.max(1, +body.keywords || 10)) });
  return j({ ...out, meta: { ms: Date.now() - t0, source: "captions" } });
}
