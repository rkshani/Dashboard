"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { removePushSubscription, savePushSubscription, sendTestNotification } from "@/app/app/notification-actions";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlB64ToUint8Array(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const supported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const subscribeNoop = () => () => {};

/** Turn browser push on or off for this device, and send a test. */
export function PushToggle({ configured }: { configured: boolean }) {
  const canPush = useSyncExternalStore(subscribeNoop, supported, () => false);
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!canPush || !configured) return;
    let live = true;
    navigator.serviceWorker
      .getRegistration("/")
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => live && setOn(Boolean(sub)))
      .catch(() => live && setOn(false));
    return () => {
      live = false;
    };
  }, [canPush, configured]);

  const enable = async () => {
    setBusy(true);
    setMsg("");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setMsg("Notifications are blocked for this site. Allow them in your browser's site settings, then try again.");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(VAPID) }));
      const r = await savePushSubscription(sub.toJSON());
      setMsg(r.message);
      setOn(r.ok);
    } catch {
      setMsg("This browser couldn't turn on push. On iPhone, add the app to your Home Screen first.");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setOn(false);
      setMsg("Push is off for this device.");
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    const r = await sendTestNotification();
    setMsg(r.message);
    setBusy(false);
  };

  const btn = "h-10 cursor-pointer rounded-xl border border-line px-4 text-sm font-medium hover:border-accent disabled:opacity-60";
  return (
    <div>
      {!configured ? (
        <p className="text-sm text-muted">Push isn&apos;t set up on this server yet. In-app notifications still work.</p>
      ) : !canPush ? (
        <p className="text-sm text-muted">This browser doesn&apos;t support push. On iPhone, add the app to your Home Screen first.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {on ? (
            <button type="button" onClick={disable} disabled={busy} className={btn}>
              Turn off on this device
            </button>
          ) : (
            <button type="button" onClick={enable} disabled={busy} className={`${btn} border-transparent bg-accent text-accent-ink`}>
              Turn on push for this device
            </button>
          )}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" onClick={test} disabled={busy} className={btn}>
          Send a test
        </button>
        <p aria-live="polite" className="text-sm text-muted">
          {msg}
        </p>
      </div>
    </div>
  );
}
