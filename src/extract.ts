import { Cue } from "./parse";
const STOP = new Set("a an the and or but if then so of to in on at for from by with as is are was were be been being it its this that these those i you he she we they me him her us them my your our their do does did have has had not no yes just very really can could will would should may might about into over than also more most some any all each what which who when where how why there here up down out okay ok um uh like well right going get got go know think want need let lets thing things one two make made way yeah".split(" "));
export const tokens = (s: string) => s.toLowerCase().match(/[a-z][a-z0-9'-]+/g)?.filter(w => !STOP.has(w) && w.length > 2) ?? [];

export interface Chapter { start: number; end: number; title: string; keywords: string[] }
export interface Entity { type: "money" | "percent" | "date" | "url" | "email" | "person_or_org"; value: string; at: number }
export interface ActionItem { text: string; owner?: string; at: number }
export interface Extraction { duration: number; cues: number; speakers: Record<string, number>; chapters: Chapter[]; keywords: string[]; entities: Entity[]; actionItems: ActionItem[]; summary: string[] }

/** TextTiling-style segmentation: cosine similarity between adjacent windows of cues; boundaries at deep valleys. */
export function segment(cues: Cue[], window = 6, minGap = 8, k = 1.0): number[] {
  minGap = Math.min(minGap, Math.max(3, Math.floor(cues.length / 4)));
  window = Math.min(window, Math.max(2, Math.floor(cues.length / 4)));
  if (cues.length < 2 * minGap) return [];
  const bag = (from: number, to: number) => { const m = new Map<string, number>(); for (let i = Math.max(0, from); i < Math.min(cues.length, to); i++) for (const t of tokens(cues[i].text)) m.set(t, (m.get(t) ?? 0) + 1); return m; };
  const cos = (a: Map<string, number>, b: Map<string, number>) => { let d = 0, na = 0, nb = 0; for (const [k, v] of a) { na += v * v; d += v * (b.get(k) ?? 0); } for (const v of b.values()) nb += v * v; return na && nb ? d / Math.sqrt(na * nb) : 0; };
  const sim: number[] = [];
  const raw: number[] = [];
  for (let g = 1; g < cues.length; g++) raw.push(cos(bag(g - window, g), bag(g, g + window)));
  for (let i = 0; i < raw.length; i++) sim.push((raw[Math.max(0, i - 1)] + raw[i] + raw[Math.min(raw.length - 1, i + 1)]) / 3);
  const depth = sim.map((s, i) => { let l = s, r = s; for (let j = i; j >= 0 && sim[j] >= l; j--) l = sim[j]; for (let j = i; j < sim.length && sim[j] >= r; j++) r = sim[j]; return l - s + (r - s); });
  const mean = depth.reduce((a, b) => a + b, 0) / depth.length;
  const sd = Math.sqrt(depth.reduce((a, b) => a + (b - mean) ** 2, 0) / depth.length);
  const cand = depth.map((d, i) => ({ d, gap: i + 1 })).filter(x => x.d > mean + k * sd).sort((a, b) => b.d - a.d);
  const picked: number[] = [];
  for (const c of cand) if (picked.every(p => Math.abs(p - c.gap) >= minGap) && c.gap >= minGap / 2 && cues.length - c.gap >= minGap / 2) picked.push(c.gap);
  return picked.sort((a, b) => a - b); // cue indices where a new chapter starts
}

function tfidf(docs: string[][], k: number): string[][] {
  const df = new Map<string, number>(); for (const d of docs) for (const w of new Set(d)) df.set(w, (df.get(w) ?? 0) + 1);
  return docs.map(d => { const tf = new Map<string, number>(); for (const w of d) tf.set(w, (tf.get(w) ?? 0) + 1);
    return [...tf].map(([w, c]) => [w, c * Math.log(1 + docs.length / (df.get(w) ?? 1))] as const).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, k).map(x => x[0]); });
}
const title = (kw: string[]) => kw.slice(0, 3).map(w => w[0].toUpperCase() + w.slice(1)).join(", ");

const MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December";
const ENT: [Entity["type"], RegExp][] = [
  ["money", /\$\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:k|m|million|billion|thousand))?/gi],
  ["percent", /\b\d+(?:\.\d+)?\s?(?:%|percent)/gi],
  ["date", new RegExp(`\\b(?:(?:${MONTHS})\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s+\\d{4})?|Q[1-4]\\s?\\d{4}|\\d{4}-\\d{2}-\\d{2}|(?:next|this)\\s+(?:Monday|Tuesday|Wednesday|Thursday|Friday|week|month|quarter))\\b`, "g")],
  ["email", /\b[\w.+-]+@[\w-]+\.[\w.]*\w\b/g],
  ["url", /\bhttps?:\/\/[^\s)]+|\b[a-z0-9-]+\.(?:com|io|ai|dev|org)\b/gi],
  
  ["person_or_org", /\b(?:[A-Z][a-z]+(?:\s+(?:[A-Z][a-z]+|[A-Z]{2,}))+|[A-Z]{2,}[a-z]*(?:\s+[A-Z][a-z]+)?)\b/g],
];
const ACTION = /\b(?:action item|todo|let's|please|will|'ll|need to|needs to|should|must|going to)\b/i;
const OWNER = /\b(I|[A-Z][a-z]+)\s+(?:will|'ll|needs? to|should|must|is going to)\b/;

export function extract(cues: Cue[], opts: { keywords?: number } = {}): Extraction {
  const bounds = segment(cues);
  const starts = [0, ...bounds], chapters: Chapter[] = [];
  const docs = starts.map((s, i) => cues.slice(s, starts[i + 1] ?? cues.length).flatMap(c => tokens(c.text)));
  const kws = tfidf(docs, 5);
  starts.forEach((s, i) => { const endIdx = (starts[i + 1] ?? cues.length) - 1; chapters.push({ start: cues[s]?.start ?? 0, end: cues[endIdx]?.end ?? 0, title: title(kws[i]), keywords: kws[i] }); });
  const all = tfidf([cues.flatMap(c => tokens(c.text)), ...docs], opts.keywords ?? 10)[0];
  const entities: Entity[] = []; const seen = new Set<string>();
  for (const c of cues) for (const [type, re] of ENT) for (const m of c.text.matchAll(re)) {
    let v = m[0].trim(); if (type === "person_or_org" && (STOP.has(v.split(" ")[0].toLowerCase()) || new RegExp(`^(?:${MONTHS})`).test(v))) continue;
    if (entities.some(e => e.at === c.start && e.value !== v && e.value.includes(v))) continue;
    const key = type + v.toLowerCase(); if (seen.has(key)) continue; seen.add(key); entities.push({ type, value: v, at: c.start });
  }
  const actionItems: ActionItem[] = [];
  for (const c of cues) { if (ACTION.test(c.text)) { const o = c.text.match(OWNER)?.[1]; const who = o === "I" ? c.speaker : o; actionItems.push({ text: c.text.trim(), ...(who ? { owner: who } : {}), at: c.start }); } }
  const speakers: Record<string, number> = {};
  for (const c of cues) if (c.speaker) speakers[c.speaker] = +((speakers[c.speaker] ?? 0) + c.end - c.start).toFixed(3);
  const summary = chapters.map((ch, i) => { const seg = cues.slice(starts[i], starts[i + 1] ?? cues.length); const kw = new Set(ch.keywords);
    return seg.map(c => ({ c, s: tokens(c.text).filter(t => kw.has(t)).length })).sort((a, b) => b.s - a.s || a.c.start - b.c.start)[0]?.c.text ?? ""; });
  return { duration: cues.length ? cues[cues.length - 1].end : 0, cues: cues.length, speakers, chapters, keywords: all, entities, actionItems, summary };
}

/** Boundary F1 with a time tolerance (seconds). */
export function boundaryF1(pred: number[], gold: number[], tol = 20) {
  const used = new Set<number>(); let tp = 0;
  for (const p of pred) { const j = gold.findIndex((g, i) => !used.has(i) && Math.abs(g - p) <= tol); if (j >= 0) { used.add(j); tp++; } }
  const P = pred.length ? tp / pred.length : (gold.length ? 0 : 1), R = gold.length ? tp / gold.length : 1;
  return { precision: P, recall: R, f1: P + R ? 2 * P * R / (P + R) : 0 };
}
