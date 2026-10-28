import { VideoToData } from "../sdk/index";
// @ts-ignore injected by build
const DEMO: string = (globalThis as any).__DEMO__;
const $ = (id: string) => document.getElementById(id)!;
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" } as any)[c]);
const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
const sdk = new VideoToData({ baseUrl: location.origin });
(($("in") as HTMLTextAreaElement).value = DEMO);
async function run() {
  $("status").textContent = "Extracting…";
  try {
    const x = await sdk.extract(($("in") as HTMLTextAreaElement).value);
    $("status").textContent = `${x.cues} cues, ${mmss(x.duration)} long, ${x.meta.ms} ms`;
    $("out").innerHTML = `<h3>Chapters</h3><ol>${x.chapters.map(c => `<li><b>${mmss(c.start)}</b> ${esc(c.title)} <span class=muted>(${c.keywords.map(esc).join(", ")})</span></li>`).join("")}</ol>
<h3>Summary</h3><ul>${x.summary.map(s => `<li>${esc(s)}</li>`).join("")}</ul>
<h3>Action items</h3><ul>${x.actionItems.map(a => `<li><b>${mmss(a.at)}</b> ${a.owner ? `[${esc(a.owner)}] ` : ""}${esc(a.text)}</li>`).join("") || "<li class=muted>none</li>"}</ul>
<h3>Entities</h3><table>${x.entities.map(e => `<tr><td>${e.type}</td><td>${esc(e.value)}</td><td>${mmss(e.at)}</td></tr>`).join("")}</table>
<h3>Talk time</h3><table>${Object.entries(x.speakers).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v}s</td></tr>`).join("")}</table>
<details><summary>Raw JSON</summary><pre>${esc(JSON.stringify(x, null, 2))}</pre></details>`;
  } catch (e: any) { $("status").textContent = `Error: ${e.code ?? e.message}`; }
}
$("go").addEventListener("click", run); run();
