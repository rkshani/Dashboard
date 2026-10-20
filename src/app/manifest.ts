import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

/**
 * Lets people install the app to their Home Screen. On iPhone this is also what makes web push
 * work: Safari only delivers push to sites added to the Home Screen.
 * Colours match the default Midnight theme in globals.css.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/app",
    name: site.name,
    short_name: site.name,
    description: site.tagline,
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#0b0f17",
    theme_color: "#0b0f17",
    icons: [
      { src: "/icon.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
