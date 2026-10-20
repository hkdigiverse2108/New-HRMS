import React, { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Settings, Image as ImageIcon, Layout, Type, Palette, Shield, CreditCard, ChevronDown, CheckCircle2, Search, X, Plus, GripVertical, Settings2, Save, Paintbrush, Square, Briefcase, MessageSquare, FileText, Upload, Eye, Loader2, Check } from "lucide-react";
import { toast } from "@/lib/toast";
import { useTheme, type Branding } from "../ThemeProvider";
import { ensureGoogleFonts } from "@/lib/fonts";
import { SearchableSelect } from "@/components/ui/select";
import { NotificationSettingsCard } from "@/components/notifications/NotificationSettingsCard";
import { InvoiceSettingsCard } from "./settings/InvoiceSettingsCard";
import { LetterheadCard } from "./settings/LetterheadCard";
import { ServicesCatalogCard } from "./settings/ServicesCatalogCard";

const FONTS = [
  { value: "System", label: "System Default" },
  { value: "Inter", label: "Inter (Clean & Modern)" },
  { value: "Roboto", label: "Roboto (Google Standard)" },
  { value: "Poppins", label: "Poppins (Geometric Sans)" },
  { value: "Outfit", label: "Outfit (Bold & Techy)" },
  { value: "Playfair Display", label: "Playfair (Elegant Serif)" },
  { value: "Merriweather", label: "Merriweather (Classic Serif)" },
  { value: "Georgia", label: "Georgia (Traditional)" },
  { value: "Trebuchet MS", label: "Trebuchet MS (Clean Humanist)" },
  { value: "Arial", label: "Arial (Standard)" },
  { value: "Helvetica", label: "Helvetica (Standard)" },
  { value: "Times New Roman", label: "Times New Roman (Standard Serif)" },
  { value: "Verdana", label: "Verdana (Wide Sans)" },
  { value: "Tahoma", label: "Tahoma (Standard Sans)" },
  { value: "Palatino", label: "Palatino (Elegant Serif)" },
  { value: "Garamond", label: "Garamond (Classic Serif)" },
  { value: "Impact", label: "Impact (Bold Headline)" },
  { value: "Arial Black", label: "Arial Black (Bold)" },
  { value: "Lucida Console", label: "Lucida Console (Code)" },
  { value: "Monaco", label: "Monaco (Code)" },
  { value: "monospace", label: "Monospace (Code/Tech)" },
  { value: "Courier New", label: "Courier New (Typewriter)" },
  { value: "Comic Sans MS", label: "Comic Sans (Fun)" },
];

function FontSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Load every font in the list so each option previews in its own typeface
  useEffect(() => {
    if (open) ensureGoogleFonts(FONTS.map(f => f.value));
  }, [open]);

  const filtered = FONTS.filter(f => f.label.toLowerCase().includes(search.toLowerCase()));
  const selected = FONTS.find(f => f.value === value) || FONTS[0];

  return (
    <div className="relative" ref={ref}>
      <button 
        onClick={() => { setOpen(!open); setSearch(""); }}
        className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-border bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50"
        style={{ fontFamily: selected?.value === "System" ? "inherit" : selected?.value }}
      >
        <span className="flex items-center gap-2">
          <Type className="w-4 h-4 text-muted-foreground" />
          {selected?.label}
        </span>
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border rounded-xl shadow-xl z-50 max-h-60 flex flex-col overflow-hidden">
          <div className="p-2 border-b border-border">
            <input 
              autoFocus
              type="text"
              placeholder="Search fonts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="overflow-y-auto p-1 custom-scrollbar">
            {filtered.length === 0 ? (
              <div className="p-3 text-sm text-center text-muted-foreground">No fonts found</div>
            ) : (
              filtered.map(font => (
                <button
                  key={font.value}
                  onClick={() => {
                    onChange(font.value);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors ${font.value === value ? "bg-primary/10 text-primary font-bold" : ""}`}
                  style={{ fontFamily: font.value === "System" ? "inherit" : font.value }}
                >
                  {font.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Quick-pick brand colors under "Generated Palette"
const PALETTE_COLORS = [
  { label: "Emerald", hex: "#10b981" },
  { label: "Green", hex: "#059669" },
  { label: "Blue", hex: "#3b82f6" },
  { label: "Amber", hex: "#f59e0b" },
  { label: "Rose", hex: "#f43f5e" },
  { label: "Violet", hex: "#8b5cf6" },
];

// Cheap equality for branding drafts (logo/favicon are long strings, compared directly)
function sameBranding(a: Branding, b: Branding) {
  return (Object.keys(a) as (keyof Branding)[]).every(k =>
    k === "gradient_colors" ? a[k].join("|") === b[k].join("|") : a[k] === b[k]
  );
}

function brandingKey(b: Branding) {
  // Length stands in for the image contents so the key stays small
  return [b.color, b.is_gradient, b.gradient_type, b.gradient_direction, b.gradient_colors.join("|"), b.radius,
    b.font_family, b.company_name, b.logo_url.length, b.logo_url.slice(-32), b.favicon_url.length, b.favicon_url.slice(-32)].join("~");
}

export function AdminSettings() {
  const { branding, saveBranding, previewBranding, resetPreview } = useTheme();

  // Branding edits stay in this draft; the app only changes after "Save Changes"
  const [draft, setDraft] = useState<Branding>(branding);
  const [isSavingBranding, setIsSavingBranding] = useState(false);
  const lastSaved = useRef<Branding>(branding);
  useEffect(() => {
    // Saved branding loaded or changed: take it over unless the admin has unsaved edits
    setDraft(d => (sameBranding(d, lastSaved.current) ? branding : d));
    lastSaved.current = branding;
  }, [brandingKey(branding)]);
  const isBrandingDirty = !sameBranding(draft, branding);

  // Unsaved edits show across the whole app right away (preview only)
  useEffect(() => {
    previewBranding(draft);
  }, [brandingKey(draft)]);
  // Leaving the page without saving brings the saved branding back
  useEffect(() => () => resetPreview(), []);

  const setField = <K extends keyof Branding>(key: K) => (value: Branding[K]) =>
    setDraft(d => ({ ...d, [key]: value }));
  const color = draft.color, setColor = setField("color");
  const isGradient = draft.is_gradient, setIsGradient = setField("is_gradient");
  const gradientType = draft.gradient_type, setGradientType = setField("gradient_type");
  const gradientDirection = draft.gradient_direction, setGradientDirection = setField("gradient_direction");
  const gradientColors = draft.gradient_colors, setGradientColors = setField("gradient_colors");
  const radius = draft.radius, setRadius = setField("radius");
  const fontFamily = draft.font_family, setFontFamily = setField("font_family");
  const logoUrl = draft.logo_url, setLogoUrl = setField("logo_url");
  const faviconUrl = draft.favicon_url, setFaviconUrl = setField("favicon_url");
  const companyName = draft.company_name, setCompanyName = setField("company_name");

  // Preview of the draft brand fill (the app's own --primary still shows the saved one)
  const paletteColorSelected = PALETTE_COLORS.some(c => c.hex === color.toLowerCase());
  const draftBrandFill = isGradient
    ? gradientType === "linear"
      ? `linear-gradient(${gradientDirection}, ${[color, ...gradientColors].join(", ")})`
      : `radial-gradient(circle, ${[color, ...gradientColors].join(", ")})`
    : color;

  const handleSaveBranding = async () => {
    if (!companyName.trim()) {
      toast.error("Company name is required");
      return;
    }
    setIsSavingBranding(true);
    try {
      await saveBranding({ ...draft, company_name: companyName.trim() });
      toast.success("Settings saved successfully!");
    } catch {
      // api layer shows the backend message
    } finally {
      setIsSavingBranding(false);
    }
  };

  const [draggedColorIndex, setDraggedColorIndex] = useState<number | null>(null);
  // Only the grip handle starts a drag, so the color pickers in each row stay clickable
  const [dragHandleIndex, setDragHandleIndex] = useState<number | null>(null);
  const [canCreateChannels, setCanCreateChannels] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("hrms_chat_can_create_channels") !== "false";
  });
  const [canDeleteMessages, setCanDeleteMessages] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("hrms_chat_can_delete_messages") !== "false";
  });

  const handleToggleCreateChannels = () => {
    const newVal = !canCreateChannels;
    setCanCreateChannels(newVal);
    localStorage.setItem("hrms_chat_can_create_channels", String(newVal));
    window.dispatchEvent(new Event("storage"));
  };

  const handleToggleDeleteMessages = () => {
    const newVal = !canDeleteMessages;
    setCanDeleteMessages(newVal);
    localStorage.setItem("hrms_chat_can_delete_messages", String(newVal));
    window.dispatchEvent(new Event("storage"));
  };

  // Saved straight away (company-wide, independent of the branding draft); the reload makes every screen pick it up
  const savePreference = async (patch: Partial<Pick<Branding, "date_format" | "name_format">>) => {
    try {
      await saveBranding({ ...branding, ...patch });
      toast.success("Preference saved for everyone");
      setTimeout(() => window.location.reload(), 600);
    } catch {
      // api layer shows the backend message
    }
  };
  const dateFormat = branding.date_format;
  const nameFormat = branding.name_format;
  const handleDateFormatChange = (v: string) => savePreference({ date_format: v as Branding["date_format"] });
  const handleNameFormatChange = (v: string) => savePreference({ name_format: v as Branding["name_format"] });
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Saved with the settings, so keep it to a reasonable size
    if (file && file.size > 2 * 1024 * 1024) {
      toast.error("Logo must be smaller than 2 MB");
      e.target.value = "";
      return;
    }
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFaviconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Saved with the settings, so keep it small like a real favicon
    if (file.size > 512 * 1024) {
      toast.error("Favicon must be smaller than 512 KB");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setFaviconUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="p-6 md:p-8 space-y-8 pb-24">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground mb-1">
            <span>Dashboard</span>
            <span>/</span>
            <span className="text-foreground">Admin Settings</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground">Global Configuration</h1>
          <p className="text-muted-foreground mt-2 font-medium">Manage platform-wide settings and white-label branding.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isBrandingDirty && (
            <>
              <span className="text-xs font-bold text-amber-700 bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-lg">Unsaved changes</span>
              <button
                onClick={() => setDraft(branding)}
                disabled={isSavingBranding}
                className="px-4 py-2 rounded-xl border border-border bg-background text-sm font-bold hover:bg-muted transition-colors disabled:opacity-60"
              >
                Discard
              </button>
            </>
          )}
          <button
            onClick={handleSaveBranding}
            disabled={isSavingBranding}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSavingBranding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Changes
          </button>
        </div>
      </div>

      {/* Appearance & identity: two balanced columns, right under the page header (its Save button applies to these) */}
      <div className="grid gap-6 md:grid-cols-2 items-start">
        <div className="flex flex-col gap-6">
        {/* Theme Color Card */}
        <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Palette className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-black">Brand Color</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            Select the primary brand color. The platform will automatically generate matching backgrounds, sidebars, and chart palettes.
          </p>
          
          <div className="flex flex-col gap-4">
            {/* Gradient Toggle */}
            <div className="flex items-center justify-between p-3 border border-border rounded-xl bg-muted/20">
              <span className="text-sm font-bold text-foreground">Enable Gradient</span>
              <div className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${isGradient ? 'bg-primary' : 'bg-muted border border-border/50'}`} onClick={() => setIsGradient(!isGradient)}>
                <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${isGradient ? 'translate-x-4' : ''}`} />
              </div>
            </div>

            <div className="flex flex-col gap-4 p-4 border border-border rounded-2xl bg-muted/30">
              {!isGradient ? (
                /* Primary Color (No Gradient) */
                <div className="flex items-center gap-4">
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden border-2 border-background shadow-sm shrink-0">
                    <input
                      id="brand-color-0"
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="absolute inset-[-10px] w-20 h-20 cursor-pointer"
                    />
                  </div>
                  <label htmlFor="brand-color-0" className="flex-1 min-w-0 cursor-pointer">
                    <div className="text-sm font-bold">Brand Color</div>
                    <div className="text-xs text-muted-foreground uppercase">{color}</div>
                  </label>
                </div>
              ) : (
                /* Gradient Settings */
                <>
                  <div className="space-y-3">
                    {[color, ...gradientColors].map((colorItem, idx) => {
                      const allColors = [color, ...gradientColors];
                      return (
                        <div 
                          key={idx} 
                          className={cn(
                            "flex items-center gap-4 p-2 rounded-xl border border-transparent transition-colors",
                            draggedColorIndex === idx ? "opacity-50 border-dashed border-primary" : "hover:border-border"
                          )}
                          draggable={dragHandleIndex === idx}
                          onDragStart={(e) => {
                            setDraggedColorIndex(idx);
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = "move";
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (draggedColorIndex === null || draggedColorIndex === idx) {
                              setDraggedColorIndex(null);
                              return;
                            }
                            const newColors = [...allColors];
                            const draggedColor = newColors[draggedColorIndex];
                            if (!draggedColor) return;
                            newColors.splice(draggedColorIndex, 1);
                            newColors.splice(idx, 0, draggedColor);
                            setColor(newColors[0] || color);
                            setGradientColors(newColors.slice(1));
                            setDraggedColorIndex(null);
                          }}
                          onDragEnd={() => { setDraggedColorIndex(null); setDragHandleIndex(null); }}
                        >
                          <div
                            onMouseDown={() => setDragHandleIndex(idx)}
                            onMouseUp={() => setDragHandleIndex(null)}
                            onTouchStart={() => setDragHandleIndex(idx)}
                            title="Drag to reorder"
                            className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground transition-colors p-1"
                          >
                            <GripVertical className="w-4 h-4" />
                          </div>
                          <div className="relative w-12 h-12 rounded-xl overflow-hidden border-2 border-background shadow-sm shrink-0">
                            <input
                              id={`gradient-color-${idx}`}
                              type="color"
                              value={colorItem}
                              onChange={(e) => {
                                const newColors = [...allColors];
                                newColors[idx] = e.target.value;
                                setColor(newColors[0] || color);
                                setGradientColors(newColors.slice(1));
                              }}
                              className="absolute inset-[-10px] w-20 h-20 cursor-pointer"
                            />
                          </div>
                          <label htmlFor={`gradient-color-${idx}`} className="flex-1 min-w-0 cursor-pointer">
                            <div className="text-sm font-bold">{idx === 0 ? "Start Color" : `Color ${idx + 1}`}</div>
                            <div className="text-xs text-muted-foreground uppercase">{colorItem}</div>
                          </label>
                          {allColors.length > 2 && (
                            <button
                              type="button"
                              onClick={() => {
                                const newColors = allColors.filter((_, i) => i !== idx);
                                setColor(newColors[0] || color);
                                setGradientColors(newColors.slice(1));
                              }}
                              className="p-2 text-muted-foreground hover:text-red-500 rounded-lg transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                    {gradientColors.length < 5 && (
                      <button
                        type="button"
                        onClick={() => {
                          setGradientColors([...gradientColors, "#0284c7"]);
                        }}
                        className="w-full py-2 flex items-center justify-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground border border-dashed border-border rounded-xl hover:bg-muted/50 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Add Gradient Color
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div>
                      <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Type</label>
                      <SearchableSelect 
                        value={gradientType}
                        onChange={(val) => setGradientType(val as "linear" | "radial")}
                        options={[
                          { label: "Linear", value: "linear" },
                          { label: "Radial", value: "radial" }
                        ]}
                        className="w-full h-[32px] text-xs px-2 border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>
                    {gradientType === "linear" && (
                      <div>
                        <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Direction</label>
                        <SearchableSelect 
                          value={gradientDirection}
                          onChange={setGradientDirection}
                          options={[
                            { label: "Right", value: "to right" },
                            { label: "Left", value: "to left" },
                            { label: "Bottom", value: "to bottom" },
                            { label: "Top", value: "to top" },
                            { label: "Bottom Right", value: "to bottom right" },
                            { label: "Top Left", value: "to top left" }
                          ]}
                          className="w-full h-[32px] text-xs px-2 border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Generated Palette: pick a color to preview it everywhere; Save keeps it */}
            <div className="mt-2">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Generated Palette</div>
                {isBrandingDirty && (
                  <span className="text-[10px] font-bold text-amber-700">Preview — click Save to keep it</span>
                )}
              </div>
              <div className="flex gap-2 w-full">
                {/* Current brand (solid or gradient) */}
                <div
                  className={cn(
                    "relative flex-1 h-8 rounded-md shadow-sm border border-border/50",
                    !paletteColorSelected && "ring-2 ring-offset-2 ring-offset-card ring-foreground/70"
                  )}
                  style={{ background: draftBrandFill }}
                  title="Current brand color"
                >
                  {!paletteColorSelected && <Check className="absolute inset-0 m-auto w-4 h-4 text-white drop-shadow" />}
                </div>
                {PALETTE_COLORS.map(c => {
                  const selected = color.toLowerCase() === c.hex;
                  return (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setColor(c.hex)}
                      title={`${c.label} (${c.hex.toUpperCase()})`}
                      className={cn(
                        "relative flex-1 h-8 rounded-md shadow-sm border border-border/50 transition-transform hover:scale-105",
                        selected && "ring-2 ring-offset-2 ring-offset-card ring-foreground/70"
                      )}
                      style={{ backgroundColor: c.hex }}
                    >
                      {selected && <Check className="absolute inset-0 m-auto w-4 h-4 text-white drop-shadow" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        {/* UI Elements Card */}
        <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Square className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-black">UI & Typography</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            Adjust the shape of UI elements and select a global font family.
          </p>
          
          <div className="flex flex-col gap-6">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide">Border Radius</label>
                <span className="text-xs font-bold bg-muted px-2 py-0.5 rounded-md">{radius}rem</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="2" 
                step="0.1" 
                value={radius}
                onChange={(e) => setRadius(parseFloat(e.target.value))}
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between mt-1 text-[10px] text-muted-foreground font-medium">
                <span>Sharp</span>
                <span>Rounded</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-wide">Global Font Family</label>
              <FontSelector value={fontFamily} onChange={setFontFamily} />
            </div>
          </div>
        </div>
        </div>
        <div className="flex flex-col gap-6">
        {/* Brand Identity Card */}
        <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Briefcase className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-black">Company Identity</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            Update the company name, upload a custom logo for the sidebar and a favicon for the browser tab.
          </p>
          
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-wide">Company Name</label>
              <input 
                type="text" 
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-wide">Company Logo</label>
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="w-full text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-colors border border-border rounded-xl bg-background cursor-pointer pr-10 overflow-hidden"
                  />
                  {logoUrl && (
                    <button 
                      onClick={() => setLogoUrl("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 bg-destructive/10 text-destructive rounded-full hover:bg-destructive hover:text-white transition-colors"
                      title="Remove Logo"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                {logoUrl && (
                  <div className="w-10 h-10 shrink-0 rounded-lg border border-border bg-white flex items-center justify-center overflow-hidden p-1 shadow-sm">
                    <img src={logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-wide">Favicon</label>
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <input
                    type="file"
                    accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/svg+xml,image/jpeg,image/webp"
                    onChange={handleFaviconUpload}
                    className="w-full text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-colors border border-border rounded-xl bg-background cursor-pointer pr-10 overflow-hidden"
                  />
                  {faviconUrl && (
                    <button
                      onClick={() => setFaviconUrl("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 bg-destructive/10 text-destructive rounded-full hover:bg-destructive hover:text-white transition-colors"
                      title="Remove Favicon"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                {faviconUrl && (
                  <div className="w-10 h-10 shrink-0 rounded-lg border border-border bg-white flex items-center justify-center overflow-hidden p-2 shadow-sm">
                    <img src={faviconUrl} alt="Favicon" className="max-w-full max-h-full object-contain" />
                  </div>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">Shown in the browser tab. A square image (e.g. 64×64 PNG) works best.</p>
            </div>
          </div>
        </div>
        {/* System Preferences Card */}
        <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Settings2 className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-black">System Preferences</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            Configure global platform behavior such as date formats and timezone defaults.
          </p>
          
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-wide">Date Format</label>
              <SearchableSelect 
                value={dateFormat}
                onChange={(val) => handleDateFormatChange(val as string)}
                options={[
                  { label: "DD/MM/YYYY (31/12/2026)", value: "DD/MM/YYYY" },
                  { label: "MM/DD/YYYY (12/31/2026)", value: "MM/DD/YYYY" },
                  { label: "DD MMM YYYY (31 Dec 2026)", value: "DD MMM YYYY" },
                  { label: "MMM DD, YYYY (Dec 31, 2026)", value: "MMM DD, YYYY" },
                  { label: "YYYY-MM-DD (2026-12-31)", value: "YYYY-MM-DD" },
                ]}
                className="w-full h-11 px-4 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm font-medium"
              />
              <p className="text-[10px] text-muted-foreground mt-2">Applies to every date across the app, for all users. The app reloads after saving.</p>
            </div>
            
            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-wide">Name Format</label>
              <SearchableSelect 
                value={nameFormat}
                onChange={(val) => handleNameFormatChange(val as string)}
                options={[
                  { label: "First Last (John Doe)", value: "First Last" },
                  { label: "Last, First (Doe, John)", value: "Last, First" },
                  { label: "First M. Last (John M. Doe)", value: "First M. Last" },
                  { label: "Last, First M. (Doe, John M.)", value: "Last, First M." },
                ]}
                className="w-full h-11 px-4 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm font-medium"
              />
              <p className="text-[10px] text-muted-foreground mt-2">Applies to employee names across the app, for all users.</p>
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* Notifications, billing and letterhead */}
      <div className="grid gap-6">
        {/* Notification Preferences Card */}
        <NotificationSettingsCard />

        {/* Invoice & Billing Details Card */}
        <InvoiceSettingsCard />

        {/* Services Catalog: feeds the Item Description dropdown on invoices */}
        <ServicesCatalogCard />

        {/* Company Letterhead Card (Upload only via /settings/letterhead) */}
        <LetterheadCard />
      </div>

      {/* Chat Permissions Card */}
      <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-black">Chat &amp; Permissions</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Configure chat permissions. Restrict channel creation or message deletion for standard users.
        </p>

        <div className="flex flex-col gap-4">
          {/* Toggle Channel Creation */}
          <div className="flex items-center justify-between p-3 border border-border rounded-xl bg-muted/20">
            <div className="flex flex-col text-left">
              <span className="text-sm font-bold text-foreground">Allow Channel Creation</span>
              <span className="text-[11px] text-muted-foreground mt-0.5">Users can create new channels in Chat</span>
            </div>
            <div
              className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${canCreateChannels ? "bg-primary" : "bg-muted border border-border/50"}`}
              onClick={handleToggleCreateChannels}
            >
              <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${canCreateChannels ? "translate-x-4" : ""}`} />
            </div>
          </div>

          {/* Toggle Message Deletion */}
          <div className="flex items-center justify-between p-3 border border-border rounded-xl bg-muted/20">
            <div className="flex flex-col text-left">
              <span className="text-sm font-bold text-foreground">Allow Message Deletion</span>
              <span className="text-[11px] text-muted-foreground mt-0.5">Users can delete their own messages</span>
            </div>
            <div
              className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${canDeleteMessages ? "bg-primary" : "bg-muted border border-border/50"}`}
              onClick={handleToggleDeleteMessages}
            >
              <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${canDeleteMessages ? "translate-x-4" : ""}`} />
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
