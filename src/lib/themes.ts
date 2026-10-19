export const THEMES = [
  { id: "midnight", label: "Midnight", swatch: "#7aa2ff" },
  { id: "daylight", label: "Daylight", swatch: "#2f5bea" },
  { id: "forest", label: "Forest", swatch: "#3ddc97" },
  { id: "dusk", label: "Dusk", swatch: "#c29bff" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

/** Runs before paint (inlined in <head>) so the saved theme never flashes. */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('pd-theme');if(['midnight','daylight','forest','dusk'].indexOf(t)>-1){document.documentElement.dataset.theme=t;}}catch(e){}})();`;
