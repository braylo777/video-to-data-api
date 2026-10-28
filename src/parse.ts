export interface Cue { start: number; end: number; text: string; speaker?: string }
const ts = (s: string): number => {
  const m = s.trim().replace(",", ".").match(/^(?:(\d+):)?(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?$/);
  if (!m) throw new Error(`bad timestamp: ${s}`);
  return (+(m[1] ?? 0)) * 3600 + +m[2] * 60 + +m[3] + (m[4] ? +m[4].padEnd(3, "0") / 1000 : 0);
};
/** Parses WebVTT or SRT caption text into cues. Speaker from "<v Name>" or "Name:" prefixes. */
export function parseCaptions(raw: string): Cue[] {
  const blocks = raw.replace(/\r/g, "").replace(/^\uFEFF/, "").split(/\n{2,}/);
  const cues: Cue[] = [];
  for (const b of blocks) {
    const lines = b.split("\n").filter(Boolean);
    const i = lines.findIndex(l => l.includes("-->"));
    if (i < 0) continue;
    const [a, z] = lines[i].split("-->");
    let text = lines.slice(i + 1).join(" ").trim();
    let speaker: string | undefined;
    const v = text.match(/^<v\s+([^>]+)>/);
    if (v) { speaker = v[1].trim(); text = text.replace(/<v[^>]*>|<\/v>/g, "").trim(); }
    else { const c = text.match(/^([A-Z][\w .'-]{0,30}):\s+/); if (c) { speaker = c[1]; text = text.slice(c[0].length); } }
    text = text.replace(/<[^>]+>/g, "");
    if (!text) continue;
    cues.push({ start: ts(a), end: ts(z.trim().split(/\s/)[0]), text, ...(speaker ? { speaker } : {}) });
  }
  return cues.sort((x, y) => x.start - y.start);
}
