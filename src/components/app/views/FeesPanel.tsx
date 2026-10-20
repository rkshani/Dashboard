import Link from "next/link";
import { recordFee } from "@/app/app/teaching-actions";
import { MiniAction } from "@/components/app/forms";
import { fmtMoney, monthLabel } from "@/lib/money";
import type { FeeRow, FeeStatus } from "@/lib/teaching/fees";

const tone: Record<FeeStatus, string> = { paid: "bg-good/15 text-good", partial: "bg-accent/15 text-accent", upcoming: "bg-surface-2 text-muted", due: "bg-accent/15 text-accent", overdue: "bg-warn/15 text-warn" };
const label: Record<FeeStatus, string> = { paid: "Paid", partial: "Part paid", upcoming: "Not due yet", due: "Due", overdue: "Overdue" };

function waLink(phone: string | null, text: string) {
  const d = (phone ?? "").replace(/[^\d]/g, "");
  return d.length >= 8 && d.length <= 15 ? `https://wa.me/${d}?text=${encodeURIComponent(text)}` : null;
}

/** Teachers: this month's fee for every student, with one-tap "Paid" and a WhatsApp reminder. */
export function FeesPanel({ rows, month, currency, senderName, studentsHref }: { rows: FeeRow[]; month: string; currency: string; senderName: string; studentsHref: string }) {
  const expected = rows.reduce((s, r) => s + r.fee, 0);
  const received = rows.reduce((s, r) => s + Math.min(r.paid, r.fee), 0);
  const overdue = rows.filter((r) => r.status === "overdue");
  return (
    <section aria-label="Fees this month" className="anim-rise mt-4 rounded-2xl border border-line bg-surface p-5" style={{ animationDelay: "120ms" }}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Fees for {monthLabel(month)}</h2>
          <p className="text-sm text-muted">
            {fmtMoney(received, currency)} of {fmtMoney(expected, currency)} received
            {overdue.length > 0 && <span className="text-warn"> · {overdue.length} overdue</span>}
          </p>
        </div>
        <div className="h-2 w-40 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`${expected ? Math.round((received / expected) * 100) : 0}% of fees received`}>
          <div className="h-2 rounded-full bg-good" style={{ width: `${expected ? Math.round((received / expected) * 100) : 0}%` }} />
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="mt-4 rounded-xl bg-surface-2 p-4 text-sm text-muted">
          Add a monthly fee to your students on the{" "}
          <Link href={studentsHref} className="text-accent underline">
            Students
          </Link>{" "}
          page to track fees here.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {rows.map((r) => {
            const left = r.fee - r.paid;
            const wa = r.status === "overdue" || r.status === "due" || r.status === "partial" ? waLink(r.student.phone, `Assalam o Alaikum. This is a gentle reminder that ${r.student.name}'s fee of ${fmtMoney(left, currency)} for ${monthLabel(month)} was due on ${r.dueDate}. Thank you! – ${senderName}`) : null;
            return (
              <li key={r.student.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5 text-sm">
                <Link href={`/app/client/${r.student.id}`} className="min-w-0 flex-[1_1_160px] truncate font-medium hover:text-accent hover:underline">
                  {r.student.name}
                </Link>
                <span className="text-xs text-muted">Due {r.dueDate.slice(8)}{r.status === "overdue" ? ` · ${r.daysLate} days late` : ""}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone[r.status]}`}>{label[r.status]}</span>
                <span className="w-24 text-right tabular-nums">{r.status === "partial" ? `${fmtMoney(left, currency)} left` : fmtMoney(r.fee, currency)}</span>
                <span className="flex gap-1">
                  {wa && (
                    <a href={wa} target="_blank" rel="noopener noreferrer" className="flex h-9 items-center rounded-lg border border-line px-2.5 text-xs hover:border-accent">
                      Remind
                    </a>
                  )}
                  {r.status !== "paid" && (
                    <MiniAction action={recordFee} fields={{ id: r.student.id, month }} className="h-9 cursor-pointer rounded-lg border border-good/40 px-2.5 text-xs font-medium text-good hover:bg-surface-2">
                      Paid
                    </MiniAction>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
