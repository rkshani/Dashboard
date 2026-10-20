import type { NextRequest } from "next/server";
import { getCurrentUser, getProfile } from "@/lib/auth";
import { getRepo } from "@/lib/data";
import { getRates } from "@/lib/fx";
import { buildPnl, PERIODS, periodRange, pnlCsv, transactionsCsv, type Period } from "@/lib/reports/pnl";

/** Money page → Export: a P&L report or every transaction, as CSV for a spreadsheet or an accountant. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new Response("Not signed in", { status: 401 });
  const params = req.nextUrl.searchParams;
  const period = (PERIODS.some((p) => p.id === params.get("period")) ? params.get("period") : "this-year") as Period;
  const type = params.get("type") === "transactions" ? "transactions" : "pnl";

  const { repo, today, currency } = await getRepo();
  const [txns, clients, fx, business, profile] = await Promise.all([repo.listTransactions(), type === "transactions" ? repo.listClients() : [], getRates(), repo.getBusinessProfile(), getProfile()]);
  const earliest = txns.reduce<string | null>((min, t) => (min === null || t.date < min ? t.date : min), null);
  const range = periodRange(period, today, earliest);

  const names = new Map(clients.map((c) => [c.id, c.name]));
  const csv =
    type === "pnl"
      ? pnlCsv(buildPnl(txns, { ...range, currency, fx }), { label: range.label, currency, liveRates: fx.live, name: business.businessName || profile?.displayName || "" })
      : transactionsCsv(txns, { ...range, currency, fx, clientName: (id) => names.get(id) });
  const slug = range.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  // The BOM makes Excel open the file as UTF-8, so names with accents or ₨ survive.
  return new Response(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${type === "pnl" ? "profit-and-loss" : "transactions"}-${slug}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
