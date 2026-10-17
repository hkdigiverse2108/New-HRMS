// Fonts in Admin Settings that come from Google Fonts; the rest are system fonts
export const GOOGLE_FONTS = ["Inter", "Roboto", "Poppins", "Outfit", "Playfair Display", "Merriweather"];

const WEIGHTS = "400;500;600;700;800;900";

/** Adds the Google Fonts stylesheet for these families once (no-op for system fonts). */
export function ensureGoogleFonts(families: string[]) {
  if (typeof document === "undefined") return;
  families
    .filter(f => GOOGLE_FONTS.includes(f))
    .forEach(family => {
      const id = `gf-${family.replace(/\s+/g, "-").toLowerCase()}`;
      if (document.getElementById(id)) return;
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}:wght@${WEIGHTS}&display=swap`;
      document.head.appendChild(link);
    });
}
