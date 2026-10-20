import "server-only";
import type { Repo } from "@/lib/data/repo";
import { eventTime, getCalendar, localRange } from "@/lib/calendar";
import type { CalEvent } from "@/lib/calendar/types";
import { getFeed, type FeedContext } from "@/lib/opportunities/feed";
import { fmtMoney } from "@/lib/money";
import type { Profile } from "@/lib/profile";
import { site } from "@/lib/site";
import type { Template } from "@/templates";
import { buildDigest, renderDigestHtml, renderDigestText } from "./digest";

/** Gathers everything for one user's digest (used by the preview, "send test" and the scheduled job). */
export async function composeDigest(ctx: { repo: Repo; profile: Profile; template: Template; today: string; ownerId: string; feed?: FeedContext }) {
  const { repo, profile, template, today, ownerId } = ctx;
  const tz = profile.timezone;
  const cal = await getCalendar(repo, ownerId, tz);
  let events: CalEvent[] = [];
  if (cal.state.mode === "google" || cal.state.mode === "demo") {
    const { from, to } = localRange(today, 1, tz);
    events = await cal.list(from, to).catch(() => []);
  }
  const [tasks, projects, invoices, feed, log] = await Promise.all([repo.listTasks(), repo.listProjects(), repo.listInvoices(), getFeed(repo, profile, ctx.feed), repo.listAutomationLog(20)]);
  const since = Date.now() - 24 * 3_600_000;
  let dateLabel = today;
  try {
    dateLabel = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: tz }).format(new Date());
  } catch {
    /* keep ISO */
  }
  const digest = buildDigest({
    name: profile.displayName,
    appName: site.name,
    today,
    dateLabel,
    timeOf: (e) => eventTime(e, tz),
    events,
    tasks,
    projects,
    invoices,
    feed,
    automations: log.filter((l) => Date.parse(l.createdAt) >= since).map((l) => l.message),
    money: (a, c) => fmtMoney(a, c),
    vocabulary: { project: template.vocabulary.project, opportunities: template.vocabulary.opportunities },
  });
  return { digest, html: renderDigestHtml(digest, site.url, site.name), text: renderDigestText(digest, site.url) };
}
