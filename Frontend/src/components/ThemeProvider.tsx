import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { FAVICON_STORAGE_KEY, syncFaviconToServiceWorker } from "@/lib/favicon";
import { api } from "@/lib/api";
import { ensureGoogleFonts } from "@/lib/fonts";
import { DATE_FORMAT_KEY, NAME_FORMAT_KEY, type DateFormatSetting, type NameFormatSetting } from "@/lib/utils";

/** Branding saved company-wide via /settings/branding (shape matches the backend). */
export interface Branding {
  color: string;
  is_gradient: boolean;
  gradient_type: "linear" | "radial";
  gradient_direction: string;
  gradient_colors: string[];
  radius: number;
  font_family: string;
  company_name: string;
  logo_url: string;
  favicon_url: string;
  date_format: DateFormatSetting;
  name_format: NameFormatSetting;
}

interface ThemeContextType {
  color: string;
  setColor: (color: string) => void;
  isGradient: boolean;
  setIsGradient: (isGradient: boolean) => void;
  gradientType: "linear" | "radial";
  setGradientType: (type: "linear" | "radial") => void;
  gradientDirection: string;
  setGradientDirection: (direction: string) => void;
  gradientColors: string[];
  setGradientColors: (colors: string[]) => void;
  radius: number;
  setRadius: (radius: number) => void;
  fontFamily: string;
  setFontFamily: (font: string) => void;
  logoUrl: string;
  setLogoUrl: (url: string) => void;
  faviconUrl: string;
  setFaviconUrl: (url: string) => void;
  companyName: string;
  setCompanyName: (name: string) => void;
  /** Last saved branding (what everyone sees) */
  branding: Branding;
  /** Shows unsaved branding across the app without saving it */
  previewBranding: (branding: Branding) => void;
  /** Drops any preview and goes back to the saved branding */
  resetPreview: () => void;
  /** False until branding has been saved company-wide at least once */
  brandingSaved: boolean;
  /** Saves branding for everyone, then applies it here */
  saveBranding: (branding: Branding) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Helper to convert HEX to HSL
function hexToHSL(H: string) {
  let r = 0, g = 0, b = 0;
  const hex = H.replace("#", "");
  
  if (hex.length === 3) {
    r = parseInt(hex.charAt(0) + hex.charAt(0), 16) || 0;
    g = parseInt(hex.charAt(1) + hex.charAt(1), 16) || 0;
    b = parseInt(hex.charAt(2) + hex.charAt(2), 16) || 0;
  } else if (hex.length === 6) {
    r = parseInt(hex.substring(0, 2), 16) || 0;
    g = parseInt(hex.substring(2, 4), 16) || 0;
    b = parseInt(hex.substring(4, 6), 16) || 0;
  }
  
  r /= 255; g /= 255; b /= 255;
  
  const cmin = Math.min(r,g,b), cmax = Math.max(r,g,b), delta = cmax - cmin;
  let h = 0, s = 0, l = 0;
  
  if (delta == 0) h = 0;
  else if (cmax == r) h = ((g - b) / delta) % 6;
  else if (cmax == g) h = (b - r) / delta + 2;
  else h = (r - g) / delta + 4;
  
  // Calculate relative luminance for contrast (YIQ formula)
  const luminance = (r * 255 * 299 + g * 255 * 587 + b * 255 * 114) / 1000;
  
  h = Math.round(h * 60);
  if (h < 0) h += 360;
  
  l = (cmax + cmin) / 2;
  s = delta == 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  s = +(s * 100).toFixed(1);
  l = +(l * 100).toFixed(1);

  return { h, s, l, luminance };
}

const DEFAULT_BRANDING: Branding = {
  color: "#10b981",
  is_gradient: false,
  gradient_type: "linear",
  gradient_direction: "to right",
  gradient_colors: ["#0284c7"],
  radius: 0.75,
  font_family: "Inter",
  company_name: "HR Suite",
  logo_url: "",
  favicon_url: "",
  date_format: "MMM DD, YYYY",
  name_format: "First Last",
};

// Only saved branding is cached for the next page load, never an unsaved preview
function cacheBranding(b: Branding) {
  try {
    localStorage.setItem("app-theme-color", b.color);
    localStorage.setItem("app-theme-is-gradient", String(b.is_gradient));
    localStorage.setItem("app-theme-gradient-type", b.gradient_type);
    localStorage.setItem("app-theme-gradient-direction", b.gradient_direction);
    localStorage.setItem("app-theme-gradient-colors", JSON.stringify(b.gradient_colors));
    localStorage.setItem("app-theme-radius", String(b.radius));
    localStorage.setItem("app-theme-font", b.font_family);
    localStorage.setItem("app-theme-name", b.company_name);
    localStorage.setItem(DATE_FORMAT_KEY, b.date_format || "MMM DD, YYYY");
    localStorage.setItem(NAME_FORMAT_KEY, b.name_format || "First Last");
    localStorage.setItem(FAVICON_STORAGE_KEY, b.favicon_url || "");
    // A large logo may not fit in localStorage, which is fine
    localStorage.setItem("app-theme-logo", b.logo_url || "");
  } catch {}
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [color, setColor] = useState<string>("#10b981");
  const [isGradient, setIsGradient] = useState<boolean>(false);
  const [gradientType, setGradientType] = useState<"linear" | "radial">("linear");
  const [gradientDirection, setGradientDirection] = useState<string>("to right");
  const [gradientColors, setGradientColors] = useState<string[]>(["#0284c7"]);

  const [radius, setRadius] = useState<number>(0.75);
  const [fontFamily, setFontFamily] = useState<string>("Inter");
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [faviconUrl, setFaviconUrl] = useState<string>("");
  const [companyName, setCompanyName] = useState<string>("HR Suite");

  // Saved branding, kept apart from what is on screen so previews can be undone
  const [savedBranding, setSavedBranding] = useState<Branding>(DEFAULT_BRANDING);
  const savedBrandingRef = useRef<Branding>(DEFAULT_BRANDING);
  const setSaved = (b: Branding) => {
    savedBrandingRef.current = b;
    setSavedBranding(b);
  };

  useEffect(() => {
    const savedColor = localStorage.getItem("app-theme-color");
    const savedIsGradient = localStorage.getItem("app-theme-is-gradient");
    const savedGradientType = localStorage.getItem("app-theme-gradient-type");
    const savedGradientDirection = localStorage.getItem("app-theme-gradient-direction");
    const savedGradientColors = localStorage.getItem("app-theme-gradient-colors");

    const savedRadius = localStorage.getItem("app-theme-radius");
    const savedFont = localStorage.getItem("app-theme-font");
    const savedLogo = localStorage.getItem("app-theme-logo");
    const savedFavicon = localStorage.getItem(FAVICON_STORAGE_KEY);
    const savedName = localStorage.getItem("app-theme-name");

    let parsedGradientColors: string[] | null = null;
    if (savedGradientColors) {
      try {
        const parsed = JSON.parse(savedGradientColors);
        if (Array.isArray(parsed) && parsed.length > 0) parsedGradientColors = parsed;
      } catch (e) {}
    }
    const cached = savedBrandingRef.current;
    const loaded: Branding = {
      color: savedColor || cached.color,
      is_gradient: savedIsGradient ? savedIsGradient === "true" : cached.is_gradient,
      gradient_type: (savedGradientType as "linear" | "radial") || cached.gradient_type,
      gradient_direction: savedGradientDirection || cached.gradient_direction,
      gradient_colors: parsedGradientColors || cached.gradient_colors,
      radius: savedRadius ? parseFloat(savedRadius) : cached.radius,
      font_family: savedFont || cached.font_family,
      company_name: savedName || cached.company_name,
      logo_url: savedLogo || "",
      favicon_url: savedFavicon || "",
      date_format: (localStorage.getItem(DATE_FORMAT_KEY) as DateFormatSetting) || cached.date_format,
      name_format: (localStorage.getItem(NAME_FORMAT_KEY) as NameFormatSetting) || cached.name_format,
    };
    applyBranding(loaded);
    setSaved(loaded);
  }, []);

  const applyBranding = (b: Branding) => {
    setColor(b.color);
    setIsGradient(b.is_gradient);
    setGradientType(b.gradient_type);
    setGradientDirection(b.gradient_direction);
    setGradientColors(b.gradient_colors?.length ? b.gradient_colors : ["#0284c7"]);
    setRadius(b.radius);
    setFontFamily(b.font_family);
    setCompanyName(b.company_name);
    setLogoUrl(b.logo_url || "");
    setFaviconUrl(b.favicon_url || "");
  };

  // localStorage above only paints the last-known theme quickly; the saved branding wins
  const [brandingSaved, setBrandingSaved] = useState(false);
  useEffect(() => {
    api.get<Branding | null>("/settings/branding", { showLoader: false, showErrorToast: false, skipAuth: true })
      .then(b => {
        if (!b) return;
        // Date/name formats are read straight from localStorage while rendering, so a format that
        // someone else changed needs one reload to show up everywhere.
        const formatsChanged =
          (localStorage.getItem(DATE_FORMAT_KEY) || "MMM DD, YYYY") !== b.date_format ||
          (localStorage.getItem(NAME_FORMAT_KEY) || "First Last") !== b.name_format;
        applyBranding(b);
        setSaved(b);
        cacheBranding(b);
        setBrandingSaved(true);
        if (formatsChanged) window.location.reload();
      })
      .catch(() => {});
  }, []);

  const saveBranding = async (b: Branding) => {
    const res = await api.put<Branding>("/settings/branding", b, { showLoader: false });
    const next = res || b;
    applyBranding(next);
    setSaved(next);
    cacheBranding(next);
    setBrandingSaved(true);
  };

  const previewBranding = (b: Branding) => applyBranding(b);
  const resetPreview = () => applyBranding(savedBrandingRef.current);

  useEffect(() => {
    const root = window.document.documentElement;
    const hsl = hexToHSL(color);
    
    const primary = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
    root.style.setProperty("--primary", primary);
    root.style.setProperty("--ring", primary);
    root.style.setProperty("--sidebar-primary", primary);
    
    const isDark = root.classList.contains("dark");
    const bgTint = isDark
      ? `hsl(${hsl.h}, ${Math.min(hsl.s, 40)}%, 14%)`
      : `hsl(${hsl.h}, ${Math.min(hsl.s, 40)}%, 98%)`;
    root.style.setProperty("--background", bgTint);

    const sidebarTint = isDark
      ? `hsl(${hsl.h}, ${Math.min(hsl.s, 30)}%, 17%)`
      : `hsl(${hsl.h}, ${Math.min(hsl.s, 30)}%, 95%)`;
    root.style.setProperty("--sidebar", sidebarTint);

    // Set vibrant semantic chart colors (constant regardless of theme)
    root.style.setProperty("--chart-1", "hsl(152, 69%, 31%)"); // Emerald-600
    root.style.setProperty("--chart-2", "hsl(221, 83%, 53%)"); // Blue-500
    root.style.setProperty("--chart-3", "hsl(38, 92%, 50%)");  // Amber-500
    root.style.setProperty("--chart-4", "hsl(346, 87%, 53%)"); // Rose-500
    root.style.setProperty("--chart-5", "hsl(262, 83%, 58%)"); // Violet-500
    
    // YIQ formula threshold is typically 128
    const primaryFg = hsl.luminance > 140 ? "#000000" : "#ffffff";
    root.style.setProperty("--primary-foreground", primaryFg);
    root.style.setProperty("--sidebar-primary-foreground", primaryFg);
    
    // Apply new white-label settings
    root.style.setProperty("--radius", `${radius}rem`);
    ensureGoogleFonts([fontFamily]);
    const fontStack = fontFamily === "System" 
      ? "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" 
      : `'${fontFamily}', sans-serif`;
    window.document.body.style.fontFamily = fontStack;
    // Tailwind's font-sans utilities read this, so they follow the chosen font too
    root.style.setProperty("--font-sans", fontStack);


    // Apply gradient override
    let styleEl = document.getElementById("theme-gradient-override");
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "theme-gradient-override";
      document.head.appendChild(styleEl);
    }

    if (isGradient) {
      const parsedColors = gradientColors.map(c => {
        const hsl = hexToHSL(c);
        return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
      });
      const bgImage = gradientType === "linear" 
        ? `linear-gradient(${gradientDirection}, var(--primary), ${parsedColors.join(", ")})`
        : `radial-gradient(circle, var(--primary), ${parsedColors.join(", ")})`;
      
      // Solid brand fills, including ones that only appear on hover/focus/active or a state
      styleEl.innerHTML = `
        .bg-primary, .bg-sidebar-primary,
        .hover\\:bg-primary:hover, .hover\\:bg-sidebar-primary:hover,
        .focus\\:bg-primary:focus, .active\\:bg-primary:active,
        .group:hover .group-hover\\:bg-primary,
        [data-state="active"].data-\\[state\\=active\\]\\:bg-primary,
        [data-state="checked"].data-\\[state\\=checked\\]\\:bg-primary,
        [aria-selected="true"].aria-selected\\:bg-primary {
          background-image: ${bgImage} !important;
        }
      `;
    } else {
      styleEl.innerHTML = "";
    }
  }, [color, isGradient, gradientType, gradientDirection, gradientColors, radius, fontFamily, logoUrl, companyName]);

  // Browser tab icon: the favicon uploaded in Admin Settings
  useEffect(() => {
    // Runs after the load effect above has already read the saved value
    syncFaviconToServiceWorker(faviconUrl);
    // No upload means no icon at all (never the bundled default)
    const href = faviconUrl || "data:,";
    const links = document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"], link[rel="apple-touch-icon"]');
    if (links.length === 0) {
      const link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
      link.href = href;
      return;
    }
    links.forEach(link => {
      link.href = href;
      link.removeAttribute("type");
    });
  }, [faviconUrl]);

  return (
    <ThemeContext.Provider value={{ 
      color, setColor, 
      isGradient, setIsGradient,
      gradientType, setGradientType,
      gradientDirection, setGradientDirection,
      gradientColors, setGradientColors,
      radius, setRadius, 
      fontFamily, setFontFamily, 
      logoUrl, setLogoUrl, 
      faviconUrl, setFaviconUrl,
      companyName, setCompanyName,
      branding: savedBranding, brandingSaved, saveBranding, previewBranding, resetPreview
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
