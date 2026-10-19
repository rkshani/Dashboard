import { ImageResponse } from "next/og";
import { site } from "@/lib/site";

export const alt = `${site.name}: your whole work life on one dashboard`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#0b0f17", color: "#e8ecf4" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "#7aa2ff" }} />
          <div style={{ fontSize: 40, fontWeight: 700 }}>{site.name}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.08, maxWidth: 980 }}>Your whole work life on one dashboard.</div>
          <div style={{ fontSize: 30, color: "#9aa5ba", marginTop: 20 }}>Set up for your profession. Leads and jobs arrive on their own.</div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          {["#7aa2ff", "#2f5bea", "#3ddc97", "#c29bff"].map((c) => (
            <div key={c} style={{ width: 44, height: 12, borderRadius: 6, background: c }} />
          ))}
        </div>
      </div>
    ),
    size,
  );
}
