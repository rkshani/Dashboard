import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { decrypt, encrypt } from "@/lib/crypto";
import { buildDigest, renderDigestHtml, renderDigestText } from "@/lib/automations/digest";
import { runAutomations } from "@/lib/automations/engine";
import { DemoRepo } from "@/lib/data/demo-repo";
import type { Profile } from "@/lib/profile";
import { getTemplate } from "@/templates";

beforeAll(() => {
  process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
});

describe("token encryption", () => {
  const owner = randomUUID();
  it("round-trips", () => {
    expect(decrypt(encrypt("refresh-token-123", owner), owner)).toBe("refresh-token-123");
  });
  it("is bound to the owner", () => {
    expect(() => decrypt(encrypt("x", owner), randomUUID())).toThrow();
  });
  it("detects tampering", () => {
    const parts = encrypt("secret", owner).split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decrypt(parts.join("."), owner)).toThrow();
  });
  it("never produces the same ciphertext twice", () => {
    expect(encrypt("same", owner)).not.toBe(encrypt("same", owner));
  });
});

const base = {
  name: "RK <script>",
  appName: "Dashboard",
  today: "2026-10-20",
  dateLabel: "Tuesday 20 October",
  timeOf: () => "09:30",
  money: (a: number, c: string) => `${c} ${a}`,
  vocabulary: { project: "Project", opportunities: "Opportunities" },
};

describe("digest", () => {
  it("escapes everything and blocks unsafe links", () => {
    const d = buildDigest({
      ...base,
      events: [{ id: "e1", title: "<img src=x onerror=alert(1)>", start: "2026-10-20T04:30:00Z", end: "2026-10-20T05:00:00Z", allDay: false, location: null, url: null }],
      tasks: [],
      projects: [],
      invoices: [],
      automations: [],
      feed: [
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { id: "a:1", title: "Evil job", company: "X", url: "javascript:alert(1)", score: 90, status: "new", attribution: { name: "Src", url: "" } } as any,
      ],
    });
    const html = renderDigestHtml(d, "https://app.example.com", "Dashboard");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x");
    expect(html).not.toContain("javascript:");
    expect(html).toContain("RK &lt;script&gt;");
  });
  it("summarises the day in the subject and orders sections", () => {
    const d = buildDigest({
      ...base,
      events: [],
      tasks: [
        { id: "t1", projectId: null, title: "Late one", dueDate: "2026-10-18", priority: "normal", done: false, doneAt: null, createdAt: "" },
        { id: "t2", projectId: null, title: "Today one", dueDate: "2026-10-20", priority: "high", done: false, doneAt: null, createdAt: "" },
        { id: "t3", projectId: null, title: "Future", dueDate: "2026-10-25", priority: "normal", done: false, doneAt: null, createdAt: "" },
      ],
      projects: [{ id: "p", clientId: null, title: "App", status: "active", deadline: "2026-10-21", budget: null, description: null, createdAt: "" }],
      invoices: [],
      feed: [],
      automations: ["Did a thing"],
    });
    expect(d.subject).toBe("Dashboard: 2 tasks");
    expect(d.tasks.map((t) => t.title)).toEqual(["Late one", "Today one"]);
    expect(d.tasks[0].note).toBe("overdue 2 days");
    expect(d.deadlines).toEqual([{ title: "App", when: "tomorrow" }]);
    expect(renderDigestText(d, "https://x.dev")).toContain("DONE FOR YOU");
  });
  it("handles an empty day", () => {
    const d = buildDigest({ ...base, events: [], tasks: [], projects: [], invoices: [], feed: [], automations: [] });
    expect(d.empty).toBe(true);
    expect(d.subject).toBe("Dashboard: a clear day");
  });
});

describe("automation rules (demo store)", () => {
  const profile: Profile = {
    displayName: "RK",
    templateId: "software-engineer",
    skills: ["Kotlin", "Jetpack Compose", "Flutter"],
    workTypes: ["freelance", "contract"],
    rateMin: null,
    rateMax: null,
    currency: "USD",
    remotePref: "remote",
    regions: [],
    timezone: "Asia/Karachi",
    theme: "midnight",
  };
  const today = "2026-10-20";

  it("acts once, then never repeats", async () => {
    const repo = new DemoRepo(randomUUID(), today, "USD");
    const template = getTemplate("software-engineer");
    const first = await runAutomations({ repo, profile, template, today });
    const rules = new Set(first.map((r) => r.ruleId));
    expect(rules.has("invoice-overdue")).toBe(true); // seeded INV-0002 is 3 days overdue
    expect(rules.has("high-match-task")).toBe(true); // demo feed has strong Kotlin matches
    const tasks = await repo.listTasks();
    expect(tasks.some((t) => t.title.startsWith("Chase payment: INV-0002"))).toBe(true);

    const second = await runAutomations({ repo, profile, template, today });
    expect(second).toEqual([]);
    expect((await repo.listTasks()).length).toBe(tasks.length);
  });

  it("respects a rule being switched off", async () => {
    const repo = new DemoRepo(randomUUID(), today, "USD");
    await repo.saveAutomationSettings({ rules: { "invoice-overdue": false, "high-match-task": false } });
    const done = await runAutomations({ repo, profile, template: getTemplate("software-engineer"), today });
    expect(done.find((d) => d.ruleId === "invoice-overdue")).toBeUndefined();
    expect(done.find((d) => d.ruleId === "high-match-task")).toBeUndefined();
  });
});
