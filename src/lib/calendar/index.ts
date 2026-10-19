import "server-only";
import type { Repo } from "@/lib/data/repo";
import { DemoRepo } from "@/lib/data/demo-repo";
import { decrypt, encryptionConfigured } from "@/lib/crypto";
import { accessTokenFor, createEvent, GoogleError, googleConfigured, listEvents } from "@/lib/google/calendar";
import type { CalEvent, NewEvent } from "./types";

export type CalendarState =
  | { mode: "demo" }
  | { mode: "not-configured" }
  | { mode: "disconnected" }
  | { mode: "needs-reconnect"; email: string | null }
  | { mode: "google"; email: string | null };

export type Calendar = {
  state: CalendarState;
  list(from: Date, to: Date): Promise<CalEvent[]>;
  create(e: NewEvent): Promise<CalEvent>;
};

function tzOffsetMinutes(timezone: string, at = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, timeZoneName: "longOffset" }).formatToParts(at);
    const off = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
    const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(off);
    if (!m) return 0;
    return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
  } catch {
    return 0;
  }
}

/** The signed-in user's calendar: Google when connected, example events in demo mode. */
export async function getCalendar(repo: Repo, ownerId: string, timezone: string): Promise<Calendar> {
  if (repo instanceof DemoRepo) {
    return {
      state: { mode: "demo" },
      list: async (from, to) => repo.listDemoEvents().filter((e) => eventEnd(e) > from && eventStart(e) < to),
      create: async (e) => repo.createDemoEvent(e, tzOffsetMinutes(timezone)),
    };
  }
  const none = { list: async () => [], create: async (): Promise<CalEvent> => Promise.reject(new Error("Calendar not connected")) };
  if (!googleConfigured() || !encryptionConfigured()) return { state: { mode: "not-configured" }, ...none };

  const integration = await repo.getIntegration("google");
  if (!integration) return { state: { mode: "disconnected" }, ...none };

  let refreshToken: string;
  try {
    refreshToken = decrypt(integration.refreshTokenEnc, ownerId);
  } catch {
    return { state: { mode: "needs-reconnect", email: integration.accountEmail }, ...none };
  }

  const state: CalendarState = { mode: "google", email: integration.accountEmail };
  const withToken = async <T,>(fn: (token: string) => Promise<T>): Promise<T> => {
    try {
      return await fn(await accessTokenFor(refreshToken));
    } catch (e) {
      if (e instanceof GoogleError && e.revoked) {
        Object.assign(state, { mode: "needs-reconnect" });
      }
      throw e;
    }
  };
  return {
    state,
    list: (from, to) => withToken((t) => listEvents(t, from, to)),
    create: (e) => withToken((t) => createEvent(t, e, timezone)),
  };
}

export function eventStart(e: CalEvent) {
  return new Date(e.allDay ? `${e.start}T00:00:00Z` : e.start);
}
export function eventEnd(e: CalEvent) {
  return new Date(e.allDay ? `${e.end}T00:00:00Z` : e.end);
}

/** Local YYYY-MM-DD of an event in the user's time zone. */
export function eventDay(e: CalEvent, timezone: string) {
  if (e.allDay) return e.start.slice(0, 10);
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(e.start));
  } catch {
    return e.start.slice(0, 10);
  }
}

export function eventTime(e: CalEvent, timezone: string) {
  if (e.allDay) return "All day";
  try {
    return new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(e.start));
  } catch {
    return e.start.slice(11, 16);
  }
}

/** UTC instants covering local days [fromDay, fromDay + days). */
export function localRange(fromDay: string, days: number, timezone: string) {
  const off = tzOffsetMinutes(timezone);
  const from = new Date(Date.parse(`${fromDay}T00:00:00Z`) - off * 60_000);
  const to = new Date(from.getTime() + days * 86_400_000);
  return { from, to };
}
