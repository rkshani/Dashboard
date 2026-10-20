import { afterEach, describe, expect, it, vi } from "vitest";
import { nextInvoiceNumber } from "@/lib/data/repo";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("shared rate limiter", () => {
  it("uses Upstash when configured and blocks over the limit", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.com");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "t");
    let n = 0;
    const f = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify([{ result: ++n }, { result: 1 }])));
    const { rateLimit } = await import("@/lib/rate-limit");
    expect(await rateLimit("k", 2)).toBe(true);
    expect(await rateLimit("k", 2)).toBe(true);
    expect(await rateLimit("k", 2)).toBe(false);
    const [url, init] = f.mock.calls[0];
    expect(String(url)).toBe("https://redis.example.com/pipeline");
    expect(String((init as RequestInit).body)).toMatch(/\["INCR","rl:k:\d+"\],\["PEXPIRE","rl:k:\d+","60000"\]/);
  });
  it("allows requests when Redis is down instead of locking users out", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.com");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "t");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("down"));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { rateLimit } = await import("@/lib/rate-limit");
    expect(await rateLimit("x", 1)).toBe(true);
  });
  it("falls back to memory without Upstash", async () => {
    const { rateLimit } = await import("@/lib/rate-limit");
    expect(await rateLimit("mem-key", 1)).toBe(true);
    expect(await rateLimit("mem-key", 1)).toBe(false);
  });
});

describe("invoice numbers", () => {
  it("continues after the highest number", () => {
    expect(nextInvoiceNumber([])).toBe("INV-0001");
    expect(nextInvoiceNumber(["INV-0002", "INV-0010", "Custom 7"])).toBe("INV-0011");
  });
});

describe("collectors", () => {
  it("times out a slow source without failing the others", async () => {
    vi.useFakeTimers();
    const { collectAll } = await import("@/lib/opportunities/sources");
    const fast = { id: "fast", label: "Fast", run: async () => [] };
    const slow = { id: "slow", label: "Slow", run: () => new Promise<never>(() => undefined) };
    const p = collectAll([fast, slow]);
    await vi.advanceTimersByTimeAsync(21_000);
    const { report } = await p;
    vi.useRealTimers();
    expect(report.find((r) => r.id === "fast")?.ok).toBe(true);
    expect(report.find((r) => r.id === "slow")).toMatchObject({ ok: false, error: expect.stringMatching(/timed out/) });
  });
});

describe("demo mode", () => {
  it("is off in production unless explicitly allowed", async () => {
    const { demoAllowed } = await import("@/lib/demo-mode");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(demoAllowed()).toBe(false);
    vi.stubEnv("ALLOW_PUBLIC_DEMO", "1");
    expect(demoAllowed()).toBe(true);
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ALLOW_PUBLIC_DEMO", "");
    expect(demoAllowed()).toBe(true);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "k");
    expect(demoAllowed()).toBe(false);
  });
});
