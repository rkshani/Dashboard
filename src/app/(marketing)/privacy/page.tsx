import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: `What ${site.name} stores, who processes it, and how to export or delete your data.`,
  alternates: { canonical: "/privacy" },
};

const mail = (
  <a href={`mailto:${site.contactEmail}`} className="text-accent">
    {site.contactEmail}
  </a>
);

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Privacy</h1>
      <p className="mt-2 text-sm text-muted">Last updated 20 October 2026. Beta draft: have it reviewed before a paid launch.</p>
      <div className="mt-8 space-y-6 leading-relaxed text-muted [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-ink [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        <section>
          <h2>In short</h2>
          <p className="mt-2">
            We store what you put into {site.name} so we can show it back to you. We don&apos;t sell it, we don&apos;t use it for advertising, and you can export or
            delete it at any time from Settings.
          </p>
        </section>

        <section>
          <h2>What we store</h2>
          <ul>
            <li>
              <strong className="text-ink">Your account:</strong> your email address. If you sign in with Google, Google also shares your name and profile
              picture, which are kept with your login.
            </li>
            <li>
              <strong className="text-ink">Your profile:</strong> display name, field, skills, work types, rate range, currency, work location preference, regions,
              time zone and theme.
            </li>
            <li>
              <strong className="text-ink">Your workspace:</strong> clients (including the contact details you enter for them), projects, tasks, income and expenses,
              invoices (including repeating ones) and business details, students, attendance, timetable, content posts, saved opportunities, proposal drafts, automation settings and
              notifications.
            </li>
            <li>
              <strong className="text-ink">Connected Google account:</strong> the account&apos;s email address and an access token, which is encrypted before it is
              stored. We don&apos;t store your calendar events (see below).
            </li>
            <li>
              <strong className="text-ink">Push notifications:</strong> if you turn them on, the delivery address your browser gives us for this device.
            </li>
            <li>
              <strong className="text-ink">Waitlist:</strong> if you joined the waitlist, your email, the field you picked and the page you signed up from.
            </li>
          </ul>
          <p className="mt-2">
            On your device we use the cookies needed to keep you signed in, and we remember your theme in your browser&apos;s storage. We don&apos;t use advertising
            or tracking cookies.
          </p>
        </section>

        <section>
          <h2>How we use it</h2>
          <p className="mt-2">
            Only to run {site.name} for you: showing your workspace, matching opportunities to your profile, sending the emails and notifications you turn on,
            and keeping the service secure (for example, limiting repeated sign-in attempts). Every account&apos;s data is isolated in the database, so other users
            can&apos;t see it.
          </p>
        </section>

        <section>
          <h2>Google Calendar and Google user data</h2>
          <p className="mt-2">
            If you connect Google Calendar, we ask only for permission to see and create calendar events. We fetch your events when you open the calendar or
            when your daily digest is put together, and we create events only when you ask us to. Events are not saved in our database. If you turn on the
            daily digest, that day&apos;s events are included in the email we send to you.
          </p>
          <p className="mt-2">
            {site.name}&apos;s use and transfer of information received from Google APIs adheres to the{" "}
            <a href="https://developers.google.com/terms/api-services-user-data-policy" className="text-accent underline" rel="noopener noreferrer" target="_blank">
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements. We don&apos;t use Google user data for advertising, we don&apos;t sell it, we don&apos;t use it to train AI
            models, and no person reads it unless you ask us to for support, or the law or security requires it. Your access token is encrypted at rest. You
            can disconnect at any time from the Calendar page, which revokes our access.
          </p>
        </section>

        <section>
          <h2>Who processes your data for us</h2>
          <p className="mt-2">We use these services to run {site.name}. Each one handles data only to provide its part of the service.</p>
          <ul>
            <li>
              <strong className="text-ink">Supabase:</strong> database and sign-in, including the emails with your sign-in link. All the data above is stored
              here.
            </li>
            <li>
              <strong className="text-ink">Vercel:</strong> hosting. It handles every request to the site and keeps short-lived server logs.
            </li>
            <li>
              <strong className="text-ink">Google:</strong> sign-in with Google, and Google Calendar if you connect it.
            </li>
            <li>
              <strong className="text-ink">Resend:</strong> sends your daily digest, payment reminders if you turn them on, and the invoices you choose to email to your clients.
            </li>
            <li>
              <strong className="text-ink">Anthropic:</strong> only when you click &quot;Draft it&quot;. We send the job posting plus your name, skills, rate and business
              name so Claude can write a draft for you to edit. Nothing else from your workspace is sent.
            </li>
            <li>
              <strong className="text-ink">Browser push services</strong> (Google, Apple, Mozilla, depending on your browser): deliver the push notifications you
              turn on.
            </li>
            <li>
              <strong className="text-ink">Upstash:</strong> rate-limit counters, keyed by your user id or IP address. They delete themselves automatically after a
              few minutes to a day.
            </li>
            <li>
              <strong className="text-ink">ExchangeRate-API:</strong> currency conversion rates. No personal data is sent.
            </li>
          </ul>
        </section>

        <section>
          <h2>Public job data</h2>
          <p className="mt-2">
            Opportunities in your feed come from public job boards and company career pages (Remotive, RemoteOK, Arbeitnow, Greenhouse and Lever). Each posting
            is credited to its source. We read these public feeds; we don&apos;t send them anything about you.
          </p>
        </section>

        <section>
          <h2>Keeping and deleting your data</h2>
          <ul>
            <li>
              <strong className="text-ink">Export:</strong> Settings → Export my data downloads your profile and workspace as a JSON file.
            </li>
            <li>
              <strong className="text-ink">Delete:</strong> Settings → Delete my account permanently removes your account and everything linked to it, and revokes
              our Google Calendar access.
            </li>
            <li>
              <strong className="text-ink">Notifications</strong> are deleted automatically after 90 days.
            </li>
            <li>
              <strong className="text-ink">Waitlist:</strong> email {mail} and we will remove your details.
            </li>
          </ul>
        </section>

        <section>
          <h2>Contact</h2>
          <p className="mt-2">
            Questions or requests about your data: {mail}. If this policy changes in a way that matters, we&apos;ll tell you by email or in the app first. See also
            our{" "}
            <Link href="/terms" className="text-accent underline">
              Terms of service
            </Link>
            .
          </p>
        </section>
      </div>
    </article>
  );
}
