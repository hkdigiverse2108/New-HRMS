import React, { createContext, useContext, useEffect, useState } from "react";

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
  companyName: string;
  setCompanyName: (name: string) => void;
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

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [color, setColor] = useState<string>("#10b981");
  const [isGradient, setIsGradient] = useState<boolean>(false);
  const [gradientType, setGradientType] = useState<"linear" | "radial">("linear");
  const [gradientDirection, setGradientDirection] = useState<string>("to right");
  const [gradientColors, setGradientColors] = useState<string[]>(["#0284c7"]);

  const [radius, setRadius] = useState<number>(0.75);
  const [fontFamily, setFontFamily] = useState<string>("Inter");
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [companyName, setCompanyName] = useState<string>("HR Suite");

  useEffect(() => {
    const savedColor = localStorage.getItem("app-theme-color");
    const savedIsGradient = localStorage.getItem("app-theme-is-gradient");
    const savedGradientType = localStorage.getItem("app-theme-gradient-type");
    const savedGradientDirection = localStorage.getItem("app-theme-gradient-direction");
    const savedGradientColors = localStorage.getItem("app-theme-gradient-colors");

    const savedRadius = localStorage.getItem("app-theme-radius");
    const savedFont = localStorage.getItem("app-theme-font");
    const savedLogo = localStorage.getItem("app-theme-logo");
    const savedName = localStorage.getItem("app-theme-name");

    if (savedColor) setColor(savedColor);
    if (savedIsGradient) setIsGradient(savedIsGradient === "true");
    if (savedGradientType) setGradientType(savedGradientType as "linear" | "radial");
    if (savedGradientDirection) setGradientDirection(savedGradientDirection);
    if (savedGradientColors) {
      try {
        const parsed = JSON.parse(savedGradientColors);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setGradientColors(parsed);
        }
      } catch (e) {}
    } if (savedRadius) setRadius(parseFloat(savedRadius));
    if (savedFont) setFontFamily(savedFont);
    if (savedLogo) setLogoUrl(savedLogo);
    if (savedName) setCompanyName(savedName);
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    const hsl = hexToHSL(color);
    
    const primary = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
    root.style.setProperty("--primary", primary);
    root.style.setProperty("--ring", primary);
    root.style.setProperty("--sidebar-primary", primary);
    
    const bgTint = `hsl(${hsl.h}, ${Math.min(hsl.s, 40)}%, 98%)`;
    root.style.setProperty("--background", bgTint);
    
    const sidebarTint = `hsl(${hsl.h}, ${Math.min(hsl.s, 30)}%, 95%)`;
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
    window.document.body.style.fontFamily = fontFamily === "System" 
      ? "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" 
      : `'${fontFamily}', sans-serif`;

    localStorage.setItem("app-theme-color", color);
    localStorage.setItem("app-theme-is-gradient", isGradient.toString());
    localStorage.setItem("app-theme-gradient-type", gradientType);
    localStorage.setItem("app-theme-gradient-direction", gradientDirection);
    localStorage.setItem("app-theme-gradient-colors", JSON.stringify(gradientColors));

    localStorage.setItem("app-theme-radius", radius.toString());
    localStorage.setItem("app-theme-font", fontFamily);
    localStorage.setItem("app-theme-logo", logoUrl);
    localStorage.setItem("app-theme-name", companyName);

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
      
      styleEl.innerHTML = `
        .bg-primary, .bg-sidebar-primary {
          background-image: ${bgImage} !important;
        }
      `;
    } else {
      styleEl.innerHTML = "";
    }
  }, [color, isGradient, gradientType, gradientDirection, gradientColors, radius, fontFamily, logoUrl, companyName]);

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
      companyName, setCompanyName 
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
