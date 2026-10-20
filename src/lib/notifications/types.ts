export const NOTIFICATION_KINDS = ["match", "deadline", "invoice", "money", "task", "system"] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  /** In-app path only (starts with /app). */
  href: string | null;
  createdAt: string;
  readAt: string | null;
};
export type NewNotification = Pick<AppNotification, "kind" | "title" | "body" | "href">;

export type PushSubscriptionRecord = { endpoint: string; p256dh: string; auth: string };
