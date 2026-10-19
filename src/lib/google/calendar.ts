import "server-only";
import { createHash } from "node:crypto";
import type { CalEvent, NewEvent } from "@/lib/calendar/types";

/**
 * Minimal Google OAuth + Calendar v3 client (no SDK).
 * Scope: calendar.events (read and write events) plus openid/email to show which account is linked.
 * calendar.events is a "sensitive" scope: Google requires app verification before public launch.
 */
export const GOOGLE_SCOPES = ["openid", "email", "https://www.googleapis.com/auth/calendar.events"];

export function googleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function authUrl(state: string, redirectUri: string) {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline", // we need a refresh token for the daily digest
    prompt: "consent", // makes Google return a refresh token every time
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

type TokenResponse = { access_token: string; expires_in: number; refresh_token?: string; scope?: string; id_token?: string; token_type: string };

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, ...body }),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as Partial<TokenResponse> & { error?: string };
  if (!res.ok || !json.access_token) throw new GoogleError(json.error ?? `token ${res.status}`, json.error === "invalid_grant");
  return json as TokenResponse;
}

export class GoogleError extends Error {
  constructor(
    message: string,
    /** The refresh token was revoked or expired: the user must reconnect. */
    public revoked = false,
  ) {
    super(message);
  }
}

export async function exchangeCode(code: string, redirectUri: string) {
  const t = await tokenRequest({ code, redirect_uri: redirectUri, grant_type: "authorization_code" });
  // id_token comes straight from Google's token endpoint over TLS, so reading its email claim is fine here.
  let email: string | null = null;
  if (t.id_token) {
    try {
      const payload = JSON.parse(Buffer.from(t.id_token.split(".")[1], "base64url").toString("utf8")) as { email?: string };
      email = typeof payload.email === "string" ? payload.email.slice(0, 254) : null;
    } catch {
      /* ignore */
    }
  }
  return { refreshToken: t.refresh_token ?? null, accessToken: t.access_token, scope: t.scope ?? "", email };
}

// Short-lived access tokens cached in memory per refresh token (keyed by hash, never the token itself).
const g = globalThis as unknown as { __gAccess?: Map<string, { token: string; exp: number }> };
const cache = (g.__gAccess ??= new Map());

export async function accessTokenFor(refreshToken: string): Promise<string> {
  const k = createHash("sha256").update(refreshToken).digest("hex");
  const hit = cache.get(k);
  if (hit && hit.exp > Date.now() + 60_000) return hit.token;
  const t = await tokenRequest({ refresh_token: refreshToken, grant_type: "refresh_token" });
  cache.set(k, { token: t.access_token, exp: Date.now() + t.expires_in * 1000 });
  if (cache.size > 5000) cache.clear();
  return t.access_token;
}

export async function revoke(refreshToken: string) {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`, { method: "POST", cache: "no-store" }).catch(() => undefined);
}

type GEvent = {
  id: string;
  summary?: string;
  status?: string;
  htmlLink?: string;
  location?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
};

export async function listEvents(accessToken: string, timeMin: Date, timeMax: Date): Promise<CalEvent[]> {
  const p = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${p}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) throw new GoogleError(`events ${res.status}`, res.status === 401);
  const json = (await res.json()) as { items?: GEvent[] };
  return (json.items ?? [])
    .filter((e) => e.status !== "cancelled" && (e.start?.date || e.start?.dateTime))
    .map((e) => ({
      id: e.id,
      title: (e.summary ?? "(No title)").slice(0, 200),
      start: (e.start?.dateTime ?? e.start?.date)!,
      end: (e.end?.dateTime ?? e.end?.date ?? e.start?.dateTime ?? e.start?.date)!,
      allDay: Boolean(e.start?.date && !e.start?.dateTime),
      location: e.location?.slice(0, 200) ?? null,
      url: e.htmlLink && e.htmlLink.startsWith("https://") ? e.htmlLink : null,
    }));
}

export async function createEvent(accessToken: string, e: NewEvent, timezone: string): Promise<CalEvent> {
  const body = e.startTime
    ? (() => {
        const start = `${e.date}T${e.startTime}:00`;
        const [h, m] = e.startTime.split(":").map(Number);
        const endMin = h * 60 + m + e.durationMin;
        // Let Google resolve the wall-clock time in the user's zone; handle day overflow.
        const endDate = new Date(`${e.date}T00:00:00Z`);
        endDate.setUTCMinutes(endMin);
        const end = `${endDate.toISOString().slice(0, 10)}T${endDate.toISOString().slice(11, 16)}:00`;
        return { summary: e.title, description: e.description ?? undefined, start: { dateTime: start, timeZone: timezone }, end: { dateTime: end, timeZone: timezone } };
      })()
    : (() => {
        const next = new Date(`${e.date}T00:00:00Z`);
        next.setUTCDate(next.getUTCDate() + 1);
        return { summary: e.title, description: e.description ?? undefined, start: { date: e.date }, end: { date: next.toISOString().slice(0, 10) } };
      })();

  const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new GoogleError(`create ${res.status}`, res.status === 401);
  const g = (await res.json()) as GEvent;
  return {
    id: g.id,
    title: g.summary ?? e.title,
    start: (g.start?.dateTime ?? g.start?.date)!,
    end: (g.end?.dateTime ?? g.end?.date)!,
    allDay: !e.startTime,
    location: null,
    url: g.htmlLink ?? null,
  };
}
