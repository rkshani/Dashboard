import { describe, expect, it } from "vitest";
import { convert, FALLBACK_RATES, sumInto, toCurrency, yearlyFromPosting, yearlyFromRate, type Rates } from "@/lib/fx-math";
import { scorePosting } from "@/lib/opportunities/match";
import type { Posting } from "@/lib/opportunities/types";
import type { Profile } from "@/lib/profile";

const fx: Rates = { base: "USD", rates: { USD: 1, PKR: 280, EUR: 0.9 }, updatedAt: null, live: true };

describe("currency conversion", () => {
  it("converts through USD and refuses unknown currencies", () => {
    expect(convert(100, "USD", "PKR", fx)).toBe(28000);
    expect(convert(28000, "PKR", "EUR", fx)).toBeCloseTo(90);
    expect(convert(5, "JPY", "USD", fx)).toBeNull();
    expect(convert(5, "JPY", "JPY", fx)).toBe(5);
  });
  it("sums mixed currencies and reports what it couldn't convert", () => {
    const r = sumInto([{ amount: 10, currency: "USD" }, { amount: 2800, currency: "PKR" }, { amount: 1, currency: "XYZ" }], "USD", fx);
    expect(r).toEqual({ total: 20, converted: true, unconverted: ["XYZ"] });
    expect(toCurrency([{ total: 10, currency: "USD" }], "total", "PKR", fx)).toEqual([{ total: 2800, currency: "PKR" }]);
  });
  it("fallback rates cover the profile currencies", () => {
    for (const c of ["USD", "PKR", "EUR", "GBP", "AED", "INR"]) expect(FALLBACK_RATES.rates[c]).toBeGreaterThan(0);
  });
});

describe("pay vs rate", () => {
  it("reads posted pay as hourly, monthly or yearly by size", () => {
    expect(yearlyFromPosting(20, 30, "USD", "USD", fx)).toEqual({ min: 41600, max: 62400, currency: "USD" });
    expect(yearlyFromPosting(300000, 400000, "PKR", "PKR", fx)).toEqual({ min: 3600000, max: 4800000, currency: "PKR" });
    expect(yearlyFromPosting(90000, null, "USD", "PKR", fx)).toEqual({ min: 25200000, max: 25200000, currency: "PKR" });
    expect(yearlyFromPosting(null, null, null, "USD", fx)).toBeNull();
    expect(yearlyFromRate(25, "hour")).toBe(52000);
    expect(yearlyFromRate(50000, "month")).toBe(600000);
    expect(yearlyFromRate(500, "project")).toBeNull();
  });

  const posting = (salaryMax: number | null): Posting => ({
    id: "x:1", source: "remotive", externalId: "1", fingerprint: "f", kind: "job", title: "Kotlin engineer", company: "A", url: "https://a.example", location: "Remote", remote: true,
    tags: ["Kotlin", "Android"], description: "", salaryMin: salaryMax, salaryMax, salaryCurrency: salaryMax ? "USD" : null, postedAt: "2026-10-19T00:00:00Z", attribution: { name: "A", url: "https://a.example" },
  });
  const profile = { displayName: "RK", templateId: "software-engineer", skills: ["Kotlin"], workTypes: ["full-time"], rateMin: 8400, rateMax: null, currency: "PKR", remotePref: "remote", regions: [], timezone: "Asia/Karachi", theme: "midnight" } as unknown as Profile;
  const now = Date.parse("2026-10-20T00:00:00Z");

  it("flags pay below the user's rate and rewards pay that meets it", () => {
    const low = scorePosting(posting(40000), profile, now, { fx, rateUnit: "hour" }); // $40k < PKR 8,400/h (≈ $30) × 2080
    const high = scorePosting(posting(90000), profile, now, { fx, rateUnit: "hour" });
    const none = scorePosting(posting(null), profile, now, { fx, rateUnit: "hour" });
    expect(low.payFit).toBe("below");
    expect(low.cautions).toContain("Pays below your rate");
    expect(high.payFit).toBe("meets");
    expect(none.payFit).toBe("unknown");
    expect(high.score).toBeGreaterThan(none.score);
    expect(none.score).toBeGreaterThan(low.score);
    expect(high.pay?.currency).toBe("PKR");
  });
});
