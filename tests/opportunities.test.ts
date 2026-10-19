import { describe, expect, it } from "vitest";
import { scorePosting } from "@/lib/opportunities/match";
import { canonicalize, expandSkills, extractSkills } from "@/lib/opportunities/skills";
import { parseArbeitnow, parseGreenhouse, parseLever, parseRemoteOk, parseRemotive } from "@/lib/opportunities/sources/parsers";
import { safeUrl, stripHtml } from "@/lib/opportunities/text";
import type { Profile } from "@/lib/profile";

// Payloads follow each source's documented response shape.
const remotive = {
  "0-legal-notice": "…",
  "job-count": 2,
  jobs: [
    { id: 101, url: "https://remotive.com/remote-jobs/software-dev/android-101", title: "Senior Android Engineer", company_name: "Acme", category: "Software Development", job_type: "full_time", publication_date: "2026-10-19T08:00:00", candidate_required_location: "Worldwide", salary: "", description: "<p>We use <b>Kotlin</b> and Jetpack Compose.</p><script>alert(1)</script>" },
    { id: 102, url: "javascript:alert(1)", title: "Bad link job", company_name: "Evil", category: "x", job_type: "contract", publication_date: "2026-10-19", candidate_required_location: "", description: "" },
  ],
};
const remoteok = [
  { legal: "API terms", last_updated: 1 },
  { id: "9001", slug: "x", epoch: 1792368000, position: "Flutter Developer (Contract)", company: "Beta", location: "", tags: ["flutter", "dart", "mobile"], description: "Build apps", url: "https://remoteok.com/remote-jobs/9001", salary_min: 0, salary_max: 0 },
];
const arbeitnow = { data: [{ slug: "react-dev-berlin-123", company_name: "Gamma", title: "React Developer", description: "<p>React &amp; TypeScript</p>", remote: false, url: "https://www.arbeitnow.com/jobs/react-dev-berlin-123", tags: ["Software Development"], job_types: ["full time"], location: "Berlin", created_at: 1792368000 }] };
const greenhouse = { jobs: [{ id: 555, title: "Backend Engineer, Python", absolute_url: "https://boards.greenhouse.io/delta/jobs/555", updated_at: "2026-10-18T10:00:00-04:00", location: { name: "Remote - US" }, departments: [{ name: "Engineering" }], content: "&lt;p&gt;Python, FastAPI and PostgreSQL&lt;/p&gt;" }] };
const lever = [{ id: "abc-1", text: "iOS Engineer", hostedUrl: "https://jobs.lever.co/epsilon/abc-1", categories: { team: "Mobile", location: "London", commitment: "Full-time" }, workplaceType: "onsite", createdAt: 1792368000000, descriptionPlain: "Swift and SwiftUI" }];

const profile: Profile = {
  displayName: "RK",
  templateId: "software-engineer",
  skills: ["Kotlin", "jetpack compose", "Flutter"],
  workTypes: ["freelance", "contract"],
  rateMin: null,
  rateMax: null,
  currency: "USD",
  remotePref: "remote",
  regions: [],
  timezone: "Asia/Karachi",
  theme: "midnight",
};

describe("text safety", () => {
  it("strips tags and scripts and decodes entities", () => {
    expect(stripHtml("<p>A &amp; B</p><script>x()</script><b>C</b>")).toBe("A & B\nC");
  });
  it("only allows http(s) URLs", () => {
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("data:text/html,hi")).toBeNull();
    expect(safeUrl("https://example.com/x")).toBe("https://example.com/x");
  });
});

describe("skills", () => {
  it("finds canonical skills and avoids java/javascript confusion", () => {
    expect(extractSkills("Senior Java engineer")).toEqual(["Java"]);
    expect(extractSkills("JavaScript and Next.js")).toEqual(expect.arrayContaining(["JavaScript", "Next.js"]));
    expect(extractSkills("JavaScript")).not.toContain("Java");
  });
  it("ignores short ambiguous aliases in prose", () => {
    expect(extractSkills("we go to the office", { prose: true })).not.toContain("Go");
  });
  it("expands implied skills", () => {
    expect(expandSkills(["Flutter"])).toEqual(["Flutter", "Dart"]);
  });
  it("canonicalizes what users type", () => {
    expect(canonicalize(["jetpack compose", "nextjs"])).toEqual(["Jetpack Compose", "Next.js"]);
  });
});

describe("parsers", () => {
  it("parses Remotive, drops unsafe links, strips HTML", () => {
    const out = parseRemotive(remotive);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("remotive:101");
    expect(out[0].description).not.toContain("<");
    expect(out[0].description).not.toContain("alert");
    expect(out[0].tags).toEqual(expect.arrayContaining(["Kotlin", "Jetpack Compose", "Android"]));
    expect(out[0].attribution.name).toBe("Remotive");
  });
  it("parses Remote OK and skips the legal notice", () => {
    const out = parseRemoteOk(remoteok);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("lead");
    expect(out[0].tags).toEqual(expect.arrayContaining(["Flutter", "Dart"]));
    expect(out[0].salaryMin).toBeNull();
  });
  it("parses Arbeitnow", () => {
    const [p] = parseArbeitnow(arbeitnow);
    expect(p.remote).toBe(false);
    expect(p.tags).toEqual(expect.arrayContaining(["React", "TypeScript"]));
  });
  it("parses Greenhouse escaped HTML", () => {
    const [p] = parseGreenhouse(greenhouse, "Delta Inc");
    expect(p.id).toBe("greenhouse:Delta-Inc-555");
    expect(p.remote).toBe(true);
    expect(p.description).toBe("Python, FastAPI and PostgreSQL");
  });
  it("parses Lever", () => {
    const [p] = parseLever(lever, "Epsilon");
    expect(p.remote).toBe(false);
    expect(p.tags).toEqual(expect.arrayContaining(["Swift"]));
  });
  it("ignores garbage input", () => {
    expect(parseRemotive(null)).toEqual([]);
    expect(parseRemoteOk({})).toEqual([]);
    expect(parseLever("x", "X")).toEqual([]);
  });
});

describe("matching", () => {
  const now = Date.parse("2026-10-20T00:00:00Z");
  it("ranks a matching remote contract above an unrelated on-site job", () => {
    const good = parseRemoteOk(remoteok)[0];
    const bad = parseLever(lever, "Epsilon")[0];
    const g = scorePosting(good, profile, now);
    const b = scorePosting(bad, profile, now);
    expect(g.score).toBeGreaterThan(70);
    expect(g.matchedSkills).toEqual(expect.arrayContaining(["Flutter"]));
    expect(b.score).toBeLessThanOrEqual(35);
  });
  it("caps postings with no shared skills", () => {
    const p = parseArbeitnow(arbeitnow)[0];
    expect(scorePosting(p, profile, now).score).toBeLessThanOrEqual(35);
  });
  it("explains its score", () => {
    const r = scorePosting(parseRemotive(remotive)[0], profile, now);
    expect(r.reasons.join(" ")).toMatch(/Kotlin|Jetpack Compose/);
  });
});
