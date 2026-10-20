import type { NextRequest } from "next/server";
import { getCurrentUser, getProfile } from "@/lib/auth";
import { getRepo } from "@/lib/data";
import { idSchema } from "@/lib/data/types";
import { invoicePdfName, renderInvoicePdf } from "@/lib/invoices/pdf";
import { fmtMoney } from "@/lib/money";

/** "Download PDF" on the invoice page. The repo is owner-scoped, so only the owner's invoices are found. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/app/invoice/[id]/pdf">) {
  const { id } = await ctx.params;
  if (!idSchema.safeParse(id).success) return new Response("Not found", { status: 404 });
  const user = await getCurrentUser();
  if (!user) return new Response("Not signed in", { status: 401 });

  const { repo } = await getRepo();
  const [invoices, clients, business, profile] = await Promise.all([repo.listInvoices(), repo.listClients(), repo.getBusinessProfile(), getProfile()]);
  const inv = invoices.find((i) => i.id === id);
  if (!inv) return new Response("Not found", { status: 404 });
  const client = inv.clientId ? (clients.find((c) => c.id === inv.clientId) ?? null) : null;

  const pdf = await renderInvoicePdf({ invoice: inv, client, business, senderName: profile?.displayName ?? "", senderEmail: user.demo ? null : user.email, money: fmtMoney });
  return new Response(new Blob([pdf as BlobPart], { type: "application/pdf" }), {
    headers: {
      "Content-Disposition": `attachment; filename="${invoicePdfName(inv)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
