import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { readFileSync } from "node:fs";
import { parseCaptions } from "../src/parse";
import { extract, boundaryF1, segment } from "../src/extract";
import { handleApi } from "../src/api";
import { VideoToData, VideoToDataError } from "../sdk/index";
const demo = readFileSync("fixtures/demo.vtt", "utf8");

describe("parser", () => {
  it("parses WebVTT with voice tags", () => { const c = parseCaptions(demo); expect(c).toHaveLength(13); expect(c[0]).toMatchObject({ start: 0, end: 6, speaker: "Maya Chen" }); });
  it("parses SRT with comma millis and Name: speakers", () => {
    const c = parseCaptions("1\n00:00:01,500 --> 00:00:03,250\nBob: Hello there\n\n2\n00:01:00,000 --> 00:01:02,000\nsecond line");
    expect(c).toEqual([{ start: 1.5, end: 3.25, text: "Hello there", speaker: "Bob" }, { start: 60, end: 62, text: "second line" }]);
  });
  it("rejects malformed timestamps", () => expect(() => parseCaptions("00:xx --> 00:01\nhi")).toThrow());
  it("never throws on valid generated captions and keeps order", () => fc.assert(fc.property(fc.array(fc.tuple(fc.integer({ min: 0, max: 7200 }), fc.integer({ min: 1, max: 30 }), fc.stringMatching(/^[a-z ]{1,40}$/)), { maxLength: 40 }), cs => {
    const f = (t: number) => `${String(Math.floor(t / 3600)).padStart(2, "0")}:${String(Math.floor(t / 60) % 60).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}.000`;
    const vtt = "WEBVTT\n\n" + cs.map(([s, d, t]) => `${f(s)} --> ${f(s + d)}\nx${t}`).join("\n\n");
    const out = parseCaptions(vtt); expect(out).toHaveLength(cs.length); for (let i = 1; i < out.length; i++) expect(out[i].start).toBeGreaterThanOrEqual(out[i - 1].start);
  }), { numRuns: 200 }));
});

describe("extraction", () => {
  const x = extract(parseCaptions(demo));
  it("finds money, percent, dates, email, url", () => {
    const v = x.entities.map(e => `${e.type}:${e.value}`);
    for (const e of ["money:$48,000", "percent:12%", "percent:91 percent", "date:October 30", "date:Q3 2026", "email:ops@northwind.dev", "person_or_org:Northwind Labs"]) expect(v).toContain(e);
  });
  it("finds action items with owners", () => {
    expect(x.actionItems.find(a => a.text.includes("revised pricing"))?.owner).toBe("Raj");
    expect(x.actionItems.find(a => a.text.includes("hiring recap"))?.owner).toBe("Lena");
  });
  it("talk time per speaker sums to cue time", () => expect(Object.values(x.speakers).reduce((a, b) => a + b, 0)).toBe(90));
  it("chapters tile the timeline in order", () => { for (let i = 1; i < x.chapters.length; i++) expect(x.chapters[i].start).toBeGreaterThanOrEqual(x.chapters[i - 1].end); expect(x.chapters[0].start).toBe(0); });
  it("first chapter is about pricing", () => expect(x.chapters[0].keywords).toContain("pricing"));
  it("segmenter finds a clean two-topic split", () => {
    const cues = [...Array(12)].map((_, i) => ({ start: i * 5, end: i * 5 + 5, text: "gpu cluster nodes cooling rack scheduler" })).concat([...Array(12)].map((_, i) => ({ start: 60 + i * 5, end: 65 + i * 5, text: "hiring candidate interview salary offer recruiter" })));
    expect(segment(cues)).toEqual([12]);
  });
  it("boundary F1 is 1 on exact match and 0 on miss", () => { expect(boundaryF1([100], [110]).f1).toBe(1); expect(boundaryF1([10], [200]).f1).toBe(0); expect(boundaryF1([], []).f1).toBe(1); });
});

describe("api + sdk", () => {
  const call = (body: unknown, method = "POST") => handleApi(new Request("https://x/v1/extract", { method, body: method === "POST" ? JSON.stringify(body) : undefined, headers: { "content-type": "application/json" } }));
  it("200 on captions", async () => { const r = await call({ captions: demo }); expect(r.status).toBe(200); expect((await r.json()).cues).toBe(13); });
  it("400/405/422 errors", async () => {
    expect((await call({})).status).toBe(400);
    expect((await call({ captions: "no cues here" })).status).toBe(422);
    expect((await call(null, "GET")).status).toBe(405);
    expect((await handleApi(new Request("https://x/v1/extract", { method: "POST", body: "{bad" }))).status).toBe(400);
  });
  it("SDK returns typed result and raises typed errors", async () => {
    const sdk = new VideoToData({ baseUrl: "https://x", fetch: (u: any, i: any) => handleApi(new Request(u, i)) as any });
    expect((await sdk.extract(demo)).chapters.length).toBeGreaterThan(0);
    await expect(sdk.extract("nothing")).rejects.toBeInstanceOf(VideoToDataError);
  });
  it("SDK retries 5xx then succeeds", async () => {
    let n = 0; const sdk = new VideoToData({ baseUrl: "https://x", fetch: (async (u: any, i: any) => (++n < 2 ? new Response("{}", { status: 503 }) : handleApi(new Request(u, i)))) as any });
    await sdk.extract(demo); expect(n).toBe(2);
  });
});

describe("eval regression gate", () => {
  it("holdout chapter F1 stays >= 0.6 and beats the fixed-interval baseline", async () => {
    const { execSync } = await import("node:child_process"); const r = JSON.parse(execSync("npx tsx scripts/eval.ts").toString());
    expect(r.holdout.meanF1).toBeGreaterThanOrEqual(0.6); expect(r.holdout.meanF1).toBeGreaterThan(r.holdout.naiveEvery90sF1);
  }, 30000);
});
