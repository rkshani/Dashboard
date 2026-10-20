import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { saveAttendance } from "@/app/app/teaching-actions";
import { ActionForm } from "@/components/app/forms";
import { inputCls, labelCls } from "@/components/app/styles";
import { requireProfile } from "@/lib/auth";
import { getRepo } from "@/lib/data";
import { ATTENDANCE, idSchema } from "@/lib/data/types";
import { addDaysISO } from "@/lib/recurrence";
import { attendanceRate } from "@/lib/teaching/fees";
import { getTemplate } from "@/templates";

export const metadata: Metadata = { title: "Attendance" };

const label = { present: "Present", late: "Late", absent: "Absent" } as const;
const tone = { present: "has-[:checked]:border-good has-[:checked]:bg-good/15 has-[:checked]:text-good", late: "has-[:checked]:border-accent has-[:checked]:bg-accent/15 has-[:checked]:text-accent", absent: "has-[:checked]:border-warn has-[:checked]:bg-warn/15 has-[:checked]:text-warn" } as const;

export default function AttendancePage({ searchParams }: PageProps<"/app/attendance">) {
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-3xl animate-pulse rounded-2xl bg-surface" />}>
      <Body searchParams={searchParams} />
    </Suspense>
  );
}

async function Body({ searchParams }: { searchParams: PageProps<"/app/attendance">["searchParams"] }) {
  const { profile } = await requireProfile();
  const template = getTemplate(profile.templateId);
  if (!template.modules.some((m) => m.id === "students")) notFound();
  const v = template.vocabulary;
  const { repo, today } = await getRepo();
  const sp = await searchParams;
  const classId = typeof sp.class === "string" && idSchema.safeParse(sp.class).success ? sp.class : "";
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) && sp.date <= today ? sp.date : today;
  const [clients, classes, recent] = await Promise.all([repo.listClients(), repo.listProjects(), repo.listAttendance(addDaysISO(today, -30), today)]);
  const students = clients.filter((c) => c.status === "active" && (!classId || c.classId === classId)).sort((a, b) => a.name.localeCompare(b.name));
  const onDate = new Map(recent.filter((a) => a.date === date).map((a) => [a.clientId, a.status]));
  const rates = attendanceRate(recent);
  const cls = classes.find((c) => c.id === classId);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/app/timetable" className="text-sm text-accent hover:underline">
        ← Timetable
      </Link>
      <header className="anim-rise mt-4">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Attendance</h1>
        <p className="text-sm text-muted">{cls ? cls.title : `All ${v.clients.toLowerCase()}`} · {date === today ? "today" : date}</p>
      </header>

      <form className="anim-rise mt-6 flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-surface p-4" action="/app/attendance">
        <label className="flex min-w-0 flex-[1_1_200px] flex-col gap-1.5">
          <span className={labelCls}>{v.project}</span>
          <select name="class" defaultValue={classId} className={inputCls}>
            <option value="">All {v.clients.toLowerCase()}</option>
            {classes
              .filter((c) => c.status !== "done")
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Date</span>
          <input name="date" type="date" max={today} defaultValue={date} className={inputCls} />
        </label>
        <button type="submit" className="h-11 cursor-pointer rounded-xl border border-line px-4 text-sm font-medium hover:border-accent">
          Show
        </button>
      </form>

      <section aria-label="Mark attendance" className="anim-rise mt-6 rounded-2xl border border-line bg-surface p-5">
        {students.length === 0 ? (
          <p className="text-sm text-muted">
            No active {v.clients.toLowerCase()} {cls ? "in this class" : "yet"}. Set each student&apos;s class on the{" "}
            <Link href="/app/students" className="text-accent underline">
              {v.clients}
            </Link>{" "}
            page.
          </p>
        ) : (
          <ActionForm key={`${classId}:${date}`} action={saveAttendance} submitLabel="Save attendance">
            <input type="hidden" name="date" value={date} />
            <input type="hidden" name="classId" value={classId} />
            <p className="mb-2 text-xs text-muted">{onDate.size ? "Already marked for this day. Changes replace the old marks." : "Everyone starts as present. Tap who is late or absent."}</p>
            <ul className="divide-y divide-line">
              {students.map((s) => {
                const current = onDate.get(s.id) ?? "present";
                const r = rates.get(s.id);
                return (
                  <li key={s.id} className="flex flex-wrap items-center gap-3 py-2.5">
                    <span className="min-w-0 flex-[1_1_160px]">
                      <Link href={`/app/client/${s.id}`} className="block truncate text-sm font-medium hover:text-accent hover:underline">
                        {s.name}
                      </Link>
                      <span className="text-xs text-muted">{r ? `${Math.round((r.present / r.total) * 100)}% over 30 days` : "No marks yet"}</span>
                    </span>
                    <fieldset className="flex gap-1.5">
                      <legend className="sr-only">{s.name}</legend>
                      {ATTENDANCE.map((st) => (
                        <label key={st} className={`flex h-10 cursor-pointer items-center rounded-lg border border-line px-3 text-xs font-medium text-muted ${tone[st]}`}>
                          <input type="radio" name={`s:${s.id}`} value={st} defaultChecked={current === st} className="sr-only" />
                          {label[st]}
                        </label>
                      ))}
                    </fieldset>
                  </li>
                );
              })}
            </ul>
          </ActionForm>
        )}
      </section>
    </div>
  );
}
