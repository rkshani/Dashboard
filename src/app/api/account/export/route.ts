import { getCurrentUser, getProfile } from "@/lib/auth";
import { getRepo } from "@/lib/data";

/** "Export my data": everything we hold for the signed-in user, as one JSON file. Never includes tokens. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  const profile = await getProfile();
  if (!profile) return Response.json({ error: "Finish onboarding first" }, { status: 400 });

  const { repo, today } = await getRepo();
  const [clients, projects, tasks, transactions, invoices, opportunityStatuses, automationSettings, automationLog, google, recurring, business] = await Promise.all([
    repo.listClients(),
    repo.listProjects(),
    repo.listTasks(),
    repo.listTransactions(),
    repo.listInvoices(),
    repo.listOpportunityStatuses(),
    repo.getAutomationSettings(),
    repo.listAutomationLog(1000),
    repo.getIntegration("google"),
    repo.listRecurring(),
    repo.getBusinessProfile(),
  ]);

  const body = {
    exportedAt: new Date().toISOString(),
    account: { email: user.email, demo: user.demo },
    profile,
    clients,
    projects,
    tasks,
    transactions,
    recurringTransactions: recurring,
    invoices,
    businessDetails: business,
    opportunityStatuses,
    automationSettings,
    automationLog,
    connectedAccounts: google ? [{ provider: "google", email: google.accountEmail, connectedAt: google.connectedAt }] : [],
  };
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="my-data-${today}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
