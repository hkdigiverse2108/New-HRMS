import React, { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Settings, Image as ImageIcon, Layout, Type, Palette, Shield, CreditCard, ChevronDown, CheckCircle2, Search, X, Plus, GripVertical, Settings2, Save, Paintbrush, Square, Briefcase, MessageSquare, FileText, Upload, Eye } from "lucide-react";
import { toast } from "@/lib/toast";
import { useTheme } from "../ThemeProvider";
import { SearchableSelect } from "@/components/ui/select";
import { NotificationSettingsCard } from "@/components/notifications/NotificationSettingsCard";
import { InvoiceSettingsCard } from "./settings/InvoiceSettingsCard";
import { LetterheadCard } from "./settings/LetterheadCard";

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

export function AdminSettings() {
  const { 
    color, setColor, 
    isGradient, setIsGradient,
    gradientType, setGradientType,
    gradientDirection, setGradientDirection,
    gradientColors, setGradientColors,
    radius, setRadius, 
    fontFamily, setFontFamily, 
    logoUrl, setLogoUrl, 
    faviconUrl, setFaviconUrl,
    companyName, setCompanyName 
  } = useTheme();

  const [draggedColorIndex, setDraggedColorIndex] = useState<number | null>(null);
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

  const [dateFormat, setDateFormat] = useState(() => {
    if (typeof window === "undefined") return "MMM DD, YYYY";
    return localStorage.getItem('hrms_date_format') || 'MMM DD, YYYY';
  });

  const handleDateFormatChange = (newFormat: string) => {
    setDateFormat(newFormat);
    localStorage.setItem('hrms_date_format', newFormat);
    // Force a tiny delay so state sets, then reload to apply date format globally instantly
    setTimeout(() => window.location.reload(), 100);
  };

  const [nameFormat, setNameFormat] = useState(() => {
    if (typeof window === "undefined") return "First Last";
    return localStorage.getItem('hrms_name_format') || 'First Last';
  });

  const handleNameFormatChange = (newFormat: string) => {
    setNameFormat(newFormat);
    localStorage.setItem('hrms_name_format', newFormat);
    setTimeout(() => window.location.reload(), 100);
  };
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
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
    // Stored in the browser, so keep it small like a real favicon
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
        <button onClick={() => toast.success("Settings saved successfully!")} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-primary/90 transition-colors">
          <Save className="w-4 h-4" /> Save Changes
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
        
        {/* Notification Preferences Card */}
        <NotificationSettingsCard className="md:col-span-2 lg:col-span-2 xl:col-span-3" />

        {/* Invoice & Billing Details Card */}
        <InvoiceSettingsCard className="md:col-span-2 lg:col-span-2 xl:col-span-3" />

        {/* Company Letterhead Card (Upload only via /settings/letterhead) */}
        <LetterheadCard className="md:col-span-2 lg:col-span-2 xl:col-span-3" />

        {/* Theme Color Card */}
        <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Palette className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-black">Brand Color</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            Select the primary brand color. The platform will automatically generate matching backgrounds, sidebars, and chart palettes.
          </p>
          
          <div className="flex flex-col gap-4 mt-auto">
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
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="absolute inset-[-10px] w-20 h-20 cursor-pointer"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold">Brand Color</div>
                    <div className="text-xs text-muted-foreground uppercase">{color}</div>
                  </div>
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
                          draggable
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
                          onDragEnd={() => setDraggedColorIndex(null)}
                        >
                          <div className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground transition-colors p-1">
                            <GripVertical className="w-4 h-4" />
                          </div>
                          <div className="relative w-12 h-12 rounded-xl overflow-hidden border-2 border-background shadow-sm shrink-0">
                            <input
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
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold">{idx === 0 ? "Start Color" : `Color ${idx + 1}`}</div>
                            <div className="text-xs text-muted-foreground uppercase">{colorItem}</div>
                          </div>
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

            {/* Generated Palette Preview */}
            <div className="mt-2">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Generated Palette</div>
              <div className="flex gap-2 w-full">
                <div className="flex-1 h-8 rounded-md shadow-sm border border-border/50 transition-colors bg-primary" title="Primary" />
                <div className="flex-1 h-8 rounded-md shadow-sm border border-border/50 transition-colors bg-sidebar-primary" title="Sidebar" />
                <div className="flex-1 h-8 rounded-md shadow-sm border border-border/50 transition-colors" style={{ backgroundColor: 'var(--chart-1)' }} title="Chart 1" />
                <div className="flex-1 h-8 rounded-md shadow-sm border border-border/50 transition-colors" style={{ backgroundColor: 'var(--chart-2)' }} title="Chart 2" />
                <div className="flex-1 h-8 rounded-md shadow-sm border border-border/50 transition-colors" style={{ backgroundColor: 'var(--chart-3)' }} title="Chart 3" />
                <div className="flex-1 h-8 rounded-md shadow-sm border border-border/50 transition-colors" style={{ backgroundColor: 'var(--chart-4)' }} title="Chart 4" />
                <div className="flex-1 h-8 rounded-md shadow-sm border border-border/50 transition-colors" style={{ backgroundColor: 'var(--chart-5)' }} title="Chart 5" />
              </div>
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
          
          <div className="flex flex-col gap-4 mt-auto">
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
              <p className="text-[10px] text-muted-foreground mt-2">Changing this will reload the application to apply the format globally.</p>
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
              <p className="text-[10px] text-muted-foreground mt-2">Preferred way to display employee names.</p>
            </div>
          </div>
        </div>

        {/* Brand Identity Card */}
        <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Briefcase className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-black">Company Identity</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            Update the company name, upload a custom logo for the sidebar and a favicon for the browser tab.
          </p>
          
          <div className="flex flex-col gap-4 mt-auto">
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

        {/* UI Elements Card */}
        <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm flex flex-col md:col-span-2 xl:col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <Square className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-black">UI & Typography</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            Adjust the shape of UI elements and select a global font family.
          </p>
          
          <div className="flex flex-col gap-6 mt-auto">
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
