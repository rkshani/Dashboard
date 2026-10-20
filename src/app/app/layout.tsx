import type { Metadata } from "next";
import { Suspense } from "react";
import { Sidebar } from "@/components/app/Sidebar";
import { ProfileTheme } from "@/components/app/ProfileTheme";
import { requireProfile } from "@/lib/auth";
import { getRepo } from "@/lib/data";
import { site } from "@/lib/site";
import { getTemplate } from "@/templates";

export const metadata: Metadata = {
  title: { default: "Home", template: `%s | ${site.name}` },
  robots: { index: false, follow: false },
};

export default function AppLayout({ children }: LayoutProps<"/app">) {
  return (
    <div className="min-h-screen lg:flex">
      <Suspense fallback={<div className="hidden h-screen w-64 shrink-0 border-r border-line bg-surface lg:block" />}>
        <AppNav />
      </Suspense>
      <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        {children}
      </main>
    </div>
  );
}

async function AppNav() {
  const { user, profile } = await requireProfile();
  const template = getTemplate(profile.templateId);
  const { repo } = await getRepo();
  const unread = await repo.countUnreadNotifications().catch(() => 0);
  const items = [
    { href: "/app", label: "Home", icon: "home" },
    { href: "/app/notifications", label: "Notifications", icon: "bell", badge: unread },
    ...template.modules.map((m) => ({ href: `/app/${m.id}`, label: m.label, icon: m.icon })),
    { href: "/app/settings", label: "Settings", icon: "settings" },
  ];
  return (
    <>
      <ProfileTheme theme={profile.theme} />
      <Sidebar items={items} appName={site.name} templateName={template.name} demo={user.demo} />
    </>
  );
}
