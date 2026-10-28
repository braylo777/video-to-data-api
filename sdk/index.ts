import type { Extraction } from "../src/extract";
export type { Extraction, Chapter, Entity, ActionItem } from "../src/extract";
export class VideoToDataError extends Error { constructor(public status: number, public code: string, public detail?: unknown) { super(`${status} ${code}`); } }
export interface ClientOptions { baseUrl?: string; fetch?: typeof fetch; retries?: number }
/** Typed client for the Video-to-Data API. */
export class VideoToData {
  private base: string; private f: typeof fetch; private retries: number;
  constructor(o: ClientOptions = {}) { this.base = (o.baseUrl ?? "https://video-to-data-api.braylo777.workers.dev").replace(/\/$/, ""); this.f = o.fetch ?? ((...a: Parameters<typeof fetch>) => globalThis.fetch(...a)); this.retries = o.retries ?? 2; }
  async extract(captions: string, opts: { keywords?: number } = {}): Promise<Extraction & { meta: { ms: number } }> {
    for (let attempt = 0; ; attempt++) {
      const r = await this.f(`${this.base}/v1/extract`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ captions, ...opts }) });
      if (r.ok) return r.json() as any;
      if (r.status >= 500 && attempt < this.retries) { await new Promise(s => setTimeout(s, 200 * 2 ** attempt)); continue; }
      const b: any = await r.json().catch(() => ({})); throw new VideoToDataError(r.status, b.error ?? "error", b);
    }
  }
}
