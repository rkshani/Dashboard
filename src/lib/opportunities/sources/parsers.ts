/**
 * Pure parsers: raw source JSON → Posting[]. No network here, so they are unit-tested
 * with recorded samples (see tests/). Every field from a source is treated as untrusted.
 */
import { extractSkills } from "../skills";
import { clean, fingerprint, looksRemote, safeUrl, stripHtml, toIso } from "../text";
import type { Posting, SourceId } from "../types";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);

function make(
  source: SourceId,
  attribution: Posting["attribution"]["name"],
  f: { externalId: string; title: string; company: string; url: string | null; location: string; remote: boolean; tags: string[]; descriptionHtml: string; postedAt: unknown; salaryMin?: number | null; salaryMax?: number | null; salaryCurrency?: string | null },
): Posting | null {
  const externalId = f.externalId.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
  const title = clean(f.title, 160);
  const company = clean(f.company, 120) || "Unknown company";
  if (!title || !f.url || !externalId) return null;
  const description = stripHtml(f.descriptionHtml, 4000);
  const tags = Array.from(new Set([...extractSkills(`${title} ${f.tags.join(" ")}`), ...extractSkills(description, { prose: true })])).slice(0, 20);
  const leadish = /\b(freelance|contract|contractor|project[- ]based|gig)\b/i.test(`${title} ${f.tags.join(" ")}`);
  return {
    id: `${source}:${externalId}`,
    source,
    externalId,
    fingerprint: fingerprint(company, title),
    kind: leadish ? "lead" : "job",
    title,
    company,
    url: f.url,
    location: clean(f.location, 120),
    remote: f.remote,
    tags,
    description,
    salaryMin: f.salaryMin ?? null,
    salaryMax: f.salaryMax ?? null,
    salaryCurrency: f.salaryCurrency ?? null,
    postedAt: toIso(f.postedAt),
    attribution: { name: attribution, url: f.url },
  };
}

/** https://remotive.com/api/remote-jobs — attribution + link back required. */
export function parseRemotive(json: unknown): Posting[] {
  const jobs = isObj(json) && Array.isArray(json.jobs) ? json.jobs : [];
  return jobs.filter(isObj).flatMap((j) => {
    const p = make("remotive", "Remotive", {
      externalId: str(j.id),
      title: str(j.title),
      company: str(j.company_name),
      url: safeUrl(j.url),
      location: str(j.candidate_required_location) || "Remote",
      remote: true,
      tags: [str(j.category), str(j.job_type), ...(Array.isArray(j.tags) ? j.tags.map(str) : [])],
      descriptionHtml: str(j.description),
      postedAt: j.publication_date,
    });
    if (p && /freelance|contract/i.test(str(j.job_type))) p.kind = "lead";
    return p ? [p] : [];
  });
}

/** https://remoteok.com/api — element 0 is a legal notice; attribution + followed link required. */
export function parseRemoteOk(json: unknown): Posting[] {
  const arr = Array.isArray(json) ? json.slice(1) : [];
  return arr.filter(isObj).flatMap((j) => {
    const p = make("remoteok", "Remote OK", {
      externalId: str(j.id),
      title: str(j.position),
      company: str(j.company),
      url: safeUrl(j.url),
      location: str(j.location) || "Remote",
      remote: true,
      tags: Array.isArray(j.tags) ? j.tags.map(str) : [],
      descriptionHtml: str(j.description),
      postedAt: j.epoch ?? j.date,
      salaryMin: num(j.salary_min),
      salaryMax: num(j.salary_max),
      salaryCurrency: num(j.salary_min) || num(j.salary_max) ? "USD" : null,
    });
    return p ? [p] : [];
  });
}

/** https://www.arbeitnow.com/api/job-board-api */
export function parseArbeitnow(json: unknown): Posting[] {
  const data = isObj(json) && Array.isArray(json.data) ? json.data : [];
  return data.filter(isObj).flatMap((j) => {
    const location = str(j.location);
    const p = make("arbeitnow", "Arbeitnow", {
      externalId: str(j.slug),
      title: str(j.title),
      company: str(j.company_name),
      url: safeUrl(j.url),
      location,
      remote: j.remote === true || looksRemote(location),
      tags: [...(Array.isArray(j.tags) ? j.tags.map(str) : []), ...(Array.isArray(j.job_types) ? j.job_types.map(str) : [])],
      descriptionHtml: str(j.description),
      postedAt: j.created_at,
    });
    return p ? [p] : [];
  });
}

/** https://boards-api.greenhouse.io/v1/boards/{board}/jobs?content=true — a company's own career page. */
export function parseGreenhouse(json: unknown, companyName: string): Posting[] {
  const jobs = isObj(json) && Array.isArray(json.jobs) ? json.jobs : [];
  return jobs.filter(isObj).flatMap((j) => {
    const location = isObj(j.location) ? str(j.location.name) : "";
    const content = str(j.content);
    // Greenhouse returns HTML-escaped HTML in `content`.
    const html = content.includes("&lt;") ? stripHtml(content, 20000) : content;
    const p = make("greenhouse", `${companyName} careers`, {
      externalId: `${companyName}-${str(j.id)}`,
      title: str(j.title),
      company: companyName,
      url: safeUrl(j.absolute_url),
      location,
      remote: looksRemote(location),
      tags: Array.isArray(j.departments) ? j.departments.filter(isObj).map((d) => str(d.name)) : [],
      descriptionHtml: html,
      postedAt: j.updated_at,
    });
    return p ? [p] : [];
  });
}

/** https://api.lever.co/v0/postings/{site}?mode=json — a company's own career page. */
export function parseLever(json: unknown, companyName: string): Posting[] {
  const arr = Array.isArray(json) ? json : [];
  return arr.filter(isObj).flatMap((j) => {
    const cats = isObj(j.categories) ? j.categories : {};
    const location = str(cats.location);
    const p = make("lever", `${companyName} careers`, {
      externalId: `${companyName}-${str(j.id)}`,
      title: str(j.text),
      company: companyName,
      url: safeUrl(j.hostedUrl),
      location,
      remote: str(j.workplaceType) === "remote" || looksRemote(location),
      tags: [str(cats.team), str(cats.department), str(cats.commitment)],
      descriptionHtml: str(j.descriptionPlain) || str(j.description),
      postedAt: j.createdAt,
    });
    return p ? [p] : [];
  });
}
