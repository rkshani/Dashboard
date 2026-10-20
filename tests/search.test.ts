import { describe, expect, it } from "vitest";
import { search, type SearchDoc } from "@/lib/search";

const docs: SearchDoc[] = [
  { kind: "client", id: "1", title: "Bilal Ahmed", subtitle: "Acme Ltd", extra: "bilal@acme.pk", href: "/a" },
  { kind: "project", id: "2", title: "Acme storefront", subtitle: "Bilal Ahmed", href: "/b" },
  { kind: "task", id: "3", title: "Fix checkout bug", subtitle: "Acme storefront", href: "/c" },
  { kind: "task", id: "4", title: "Old checkout task", href: "/d", done: true },
  { kind: "invoice", id: "5", title: "INV-0002 · USD 500", subtitle: "Bilal Ahmed · sent", extra: "Café redesign", href: "/e" },
];

describe("search", () => {
  it("ranks title prefix matches first", () => {
    expect(search(docs, "acme")[0].id).toBe("2");
    expect(search(docs, "acme").map((h) => h.id)).toContain("1");
  });
  it("requires every word to match", () => {
    expect(search(docs, "checkout bug").map((h) => h.id)).toEqual(["3"]);
  });
  it("ranks finished items below open ones", () => {
    const ids = search(docs, "checkout").map((h) => h.id);
    expect(ids.indexOf("3")).toBeLessThan(ids.indexOf("4"));
  });
  it("is case and accent insensitive and searches extra text", () => {
    expect(search(docs, "CAFE").map((h) => h.id)).toEqual(["5"]);
    expect(search(docs, "inv-0002")[0].id).toBe("5");
  });
  it("returns nothing for empty queries and respects the limit", () => {
    expect(search(docs, "   ")).toEqual([]);
    expect(search(docs, "a", 2)).toHaveLength(2);
  });
});
