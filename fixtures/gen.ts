// Generates SYNTHETIC labeled transcripts (seeded) for the chapter-boundary eval. Not real recordings.
import { writeFileSync } from "node:fs";
const TOPICS: Record<string, string[]> = {
  pricing: ["pricing", "discount", "invoice", "annual", "contract", "renewal", "tier", "budget"],
  hiring: ["hiring", "candidate", "interview", "recruiter", "onboarding", "salary", "role", "offer"],
  gpus: ["gpu", "cluster", "nodes", "h100", "utilization", "scheduler", "cooling", "rack"],
  marketing: ["campaign", "audience", "launch", "newsletter", "funnel", "brand", "content", "seo"],
  security: ["password", "audit", "encryption", "breach", "firewall", "compliance", "token", "access"],
  roadmap: ["roadmap", "milestone", "feature", "release", "backlog", "sprint", "deadline", "scope"],
};
const FRAMES = ["So on {a}, the {b} is what matters most.", "I looked at the {a} numbers and the {b} changed.", "Our {a} plan depends on the {b} this month.", "The {a} and {b} need another review.", "Can we compare {a} against last year's {b}?", "Honestly the {b} drives the whole {a} question."];
const SEED = +(process.argv[2] ?? 42), PREFIX = process.argv[3] ?? "synthetic";
let s = SEED; const rnd = () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = <T>(a: T[]) => a[Math.floor(rnd() * a.length)];
const fmt = (t: number) => `${String(Math.floor(t / 3600)).padStart(2, "0")}:${String(Math.floor(t / 60) % 60).padStart(2, "0")}:${String(Math.floor(t % 60)).padStart(2, "0")}.000`;
const names = Object.keys(TOPICS);
const plans = PREFIX === "synthetic" ? [["pricing", "hiring", "gpus"], ["marketing", "security", "roadmap", "pricing"], ["gpus", "roadmap", "hiring", "security", "marketing"]]
  : Array.from({ length: 8 }, () => { const n = 3 + Math.floor(rnd() * 3), p: string[] = []; while (p.length < n) { const t = pick(names); if (p[p.length - 1] !== t && !p.includes(t)) p.push(t); } return p; });
const speakers = ["Ana", "Ben", "Chloe"];
const index: any[] = [];
plans.forEach((plan, n) => {
  let t = 0, out = "WEBVTT\n\n"; const gold: number[] = [];
  plan.forEach((topic, k) => { if (k) gold.push(t); const len = 8 + Math.floor(rnd() * 24);
    for (let i = 0; i < len; i++) { const w = TOPICS[topic]; const d = 4 + Math.floor(rnd() * 5);
      const line = pick(FRAMES).replace("{a}", pick(w)).replace("{b}", pick(w)); out += `${fmt(t)} --> ${fmt(t + d)}\n<v ${pick(speakers)}>${line}\n\n`; t += d; } });
  const f = `${PREFIX}-${n + 1}.vtt`; writeFileSync(`fixtures/${f}`, out); index.push({ file: f, topics: plan, goldBoundaries: gold });
});
writeFileSync(PREFIX === "synthetic" ? "fixtures/index.json" : `fixtures/${PREFIX}.json`, JSON.stringify(index, null, 2)); console.log(index);
