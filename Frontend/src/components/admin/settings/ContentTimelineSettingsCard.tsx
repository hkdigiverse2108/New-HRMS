import React, { useState, useEffect } from "react";
import {
  CalendarDays,
  Save,
  Loader2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  FileText,
  Video,
  Image,
  ArrowRight,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";

export interface TimelineSettingsData {
  script_days_before: number;
  shoot_days_before: number;
  editing_graphics_days_before: number;
  thumbnail_days_before: number;
  approval_days_before: number;
}

const DEFAULT_TIMELINE_SETTINGS: TimelineSettingsData = {
  script_days_before: 16,
  shoot_days_before: 14,
  editing_graphics_days_before: 7,
  thumbnail_days_before: 5,
  approval_days_before: 5,
};

export function ContentTimelineSettingsCard({ className }: { className?: string }) {
  const [formData, setFormData] = useState<TimelineSettingsData>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("hrms_calendar_offsets");
        if (saved) {
          const parsed = JSON.parse(saved);
          return {
            script_days_before: Number(parsed.script) || 16,
            shoot_days_before: Number(parsed.shoot) || 14,
            editing_graphics_days_before: Number(parsed.editing) || 7,
            thumbnail_days_before: Number(parsed.thumbnail) || 5,
            approval_days_before: Number(parsed.approval) || 5,
          };
        }
      } catch { }
    }
    return DEFAULT_TIMELINE_SETTINGS;
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch settings from GET /settings/content-timeline on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setIsLoading(true);
        const res = await api.get<any>("/settings/content-timeline", {
          showLoader: false,
          showErrorToast: false,
        });
        if (res) {
          setFormData({
            script_days_before: res.script_days_before ?? 16,
            shoot_days_before: res.shoot_days_before ?? 14,
            editing_graphics_days_before: res.editing_graphics_days_before ?? 7,
            thumbnail_days_before: res.thumbnail_days_before ?? 5,
            approval_days_before: res.approval_days_before ?? 5,
          });
        }
      } catch (err) {
        console.warn("Could not load global timeline settings, using fallback", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleChange = (field: keyof TimelineSettingsData, value: string) => {
    const num = Math.max(0, parseInt(value, 10) || 0);
    setFormData(prev => ({ ...prev, [field]: num }));
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    try {
      const payload = {
        script_days_before: Number(formData.script_days_before) || 0,
        shoot_days_before: Number(formData.shoot_days_before) || 0,
        editing_graphics_days_before: Number(formData.editing_graphics_days_before) || 0,
        thumbnail_days_before: Number(formData.thumbnail_days_before) || 0,
        approval_days_before: Number(formData.approval_days_before) || 0,
      };

      const res = await api.put<any>("/settings/content-timeline", payload);
      if (res) {
        setFormData({
          script_days_before: res.script_days_before ?? payload.script_days_before,
          shoot_days_before: res.shoot_days_before ?? payload.shoot_days_before,
          editing_graphics_days_before: res.editing_graphics_days_before ?? payload.editing_graphics_days_before,
          thumbnail_days_before: res.thumbnail_days_before ?? payload.thumbnail_days_before,
          approval_days_before: res.approval_days_before ?? payload.approval_days_before,
        });
      }

      // Sync local cache
      if (typeof window !== "undefined") {
        localStorage.setItem(
          "hrms_calendar_offsets",
          JSON.stringify({
            script: payload.script_days_before,
            shoot: payload.shoot_days_before,
            editing: payload.editing_graphics_days_before,
            thumbnail: payload.thumbnail_days_before,
            approval: payload.approval_days_before,
          })
        );
      }

      toast.success("Default Content Calendar timeline saved successfully!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save timeline settings");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={cn("bg-card border border-border/60 rounded-2xl sm:rounded-3xl p-4 sm:p-7 shadow-sm flex flex-col space-y-6 relative overflow-hidden min-w-0 max-w-full", className)}>
      {/* Background subtle decorative glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0 shadow-xs">
            <CalendarDays className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg md:text-xl font-black text-foreground">Content Calendar Default Timeline</h3>
              <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-[10px] font-extrabold uppercase tracking-wider">
                Global Template
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
              Configure default pipeline stages and schedule offsets (days before posting date). When a new Digital Marketing or SMM project is created, these defaults automatically initialize its content calendar timeline.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || isLoading}
          className="flex items-center justify-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-md hover:bg-primary/90 transition-all disabled:opacity-50 shrink-0 self-start sm:self-auto cursor-pointer"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>Save Timeline Defaults</span>
        </button>
      </div>

      {/* Form Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5 sm:gap-4">
        {/* 1. Scripting */}
        <div className="p-4 rounded-2xl border border-border/70 bg-muted/20 hover:border-primary/40 transition-all flex flex-col justify-between space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <FileText className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-foreground">Scripting</span>
            </div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase">T - {formData.script_days_before}d</span>
          </div>
          <div className="min-w-0">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
              Days Before Posting
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="90"
                value={formData.script_days_before}
                onChange={(e) => handleChange("script_days_before", e.target.value)}
                className="w-full h-10 px-3 bg-background border border-border/70 rounded-xl text-xs font-black text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-semibold">days</span>
            </div>
          </div>
        </div>

        {/* 2. Shoot / Assets */}
        <div className="p-4 rounded-2xl border border-border/70 bg-muted/20 hover:border-amber-500/40 transition-all flex flex-col justify-between space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Video className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-foreground">Shoot / Assets</span>
            </div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase">T - {formData.shoot_days_before}d</span>
          </div>
          <div className="min-w-0">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
              Days Before Posting
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="90"
                value={formData.shoot_days_before}
                onChange={(e) => handleChange("shoot_days_before", e.target.value)}
                className="w-full h-10 px-3 bg-background border border-border/70 rounded-xl text-xs font-black text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-semibold">days</span>
            </div>
          </div>
        </div>

        {/* 3. Editing / Graphics */}
        <div className="p-4 rounded-2xl border border-border/70 bg-muted/20 hover:border-violet-500/40 transition-all flex flex-col justify-between space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-foreground">Editing / Graphics</span>
            </div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase">T - {formData.editing_graphics_days_before}d</span>
          </div>
          <div className="min-w-0">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
              Days Before Posting
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="90"
                value={formData.editing_graphics_days_before}
                onChange={(e) => handleChange("editing_graphics_days_before", e.target.value)}
                className="w-full h-10 px-3 bg-background border border-border/70 rounded-xl text-xs font-black text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-semibold">days</span>
            </div>
          </div>
        </div>

        {/* 4. Thumbnail */}
        <div className="p-4 rounded-2xl border border-border/70 bg-muted/20 hover:border-blue-500/40 transition-all flex flex-col justify-between space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Image className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-foreground">Thumbnail</span>
            </div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase">T - {formData.thumbnail_days_before}d</span>
          </div>
          <div className="min-w-0">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
              Days Before Posting
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="90"
                value={formData.thumbnail_days_before}
                onChange={(e) => handleChange("thumbnail_days_before", e.target.value)}
                className="w-full h-10 px-3 bg-background border border-border/70 rounded-xl text-xs font-black text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-semibold">days</span>
            </div>
          </div>
        </div>

        {/* 5. Approval & QC */}
        <div className="p-4 rounded-2xl border border-border/70 bg-muted/20 hover:border-emerald-500/40 transition-all flex flex-col justify-between space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-foreground">Approval / QC</span>
            </div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase">T - {formData.approval_days_before}d</span>
          </div>
          <div className="min-w-0">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
              Days Before Posting
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="90"
                value={formData.approval_days_before}
                onChange={(e) => handleChange("approval_days_before", e.target.value)}
                className="w-full h-10 px-3 bg-background border border-border/70 rounded-xl text-xs font-black text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-semibold">days</span>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Pipeline Sequence Preview */}
      <div className="p-4 rounded-2xl border border-border/50 bg-muted/10 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Pipeline Schedule Sequence</span>
          <span className="text-[10px] font-semibold text-muted-foreground">Chronological Flow before Posting Date</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs font-bold">
          <span className="px-3 py-1.5 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            <span>Script: -{formData.script_days_before}d</span>
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/60 hidden sm:inline" />
          <span className="px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1.5">
            <Video className="w-3.5 h-3.5" />
            <span>Shoot: -{formData.shoot_days_before}d</span>
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/60 hidden sm:inline" />
          <span className="px-3 py-1.5 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Edit/Graphics: -{formData.editing_graphics_days_before}d</span>
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/60 hidden sm:inline" />
          <span className="px-3 py-1.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center gap-1.5">
            <Image className="w-3.5 h-3.5" />
            <span>Thumb: -{formData.thumbnail_days_before}d</span>
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/60 hidden sm:inline" />
          <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Approve: -{formData.approval_days_before}d</span>
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/60 hidden sm:inline" />
          <span className="px-3 py-1.5 rounded-xl bg-foreground text-background font-black shadow-xs">
            🚀 Live Post: 0d
          </span>
        </div>
      </div>
    </div>
  );
}

