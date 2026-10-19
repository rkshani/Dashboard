"use client";

import { useEffect } from "react";

/** Applies the theme saved in the profile on a device that has no local choice yet (e.g. a new laptop). */
export function ProfileTheme({ theme }: { theme: string }) {
  useEffect(() => {
    try {
      if (!localStorage.getItem("pd-theme")) {
        document.documentElement.dataset.theme = theme;
        localStorage.setItem("pd-theme", theme);
      }
    } catch {
      document.documentElement.dataset.theme = theme;
    }
  }, [theme]);
  return null;
}
