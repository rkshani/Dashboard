"use client";

import { useEffect } from "react";

/** Last-resort screen if the root layout itself fails. Plain styles: the app's CSS may not have loaded. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: error.message.slice(0, 300), digest: error.digest, path: window.location.pathname }),
      keepalive: true,
    }).catch(() => undefined);
  }, [error]);
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#0b0f17", color: "#e8ecf4", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 24 }}>Something went wrong</h1>
          <p style={{ color: "#9aa5ba" }}>Please try again in a moment.</p>
          <button type="button" onClick={() => reset()} style={{ marginTop: 16, height: 44, padding: "0 20px", borderRadius: 12, border: 0, background: "#7aa2ff", color: "#0b0f17", fontWeight: 600, cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
