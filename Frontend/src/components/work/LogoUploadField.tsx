import React, { useRef, useState } from "react";
import { Upload, X, Image as ImageIcon, Link as LinkIcon, RotateCcw, Check } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

export interface LogoUploadFieldProps {
  label?: string;
  value?: string | null | undefined;
  fallbackSeed?: string | undefined;
  onChange: (newUrl: string) => void;
  folder?: "projects" | "clients" | "common";
  helperText?: string | undefined;
  className?: string | undefined;
}

export function LogoUploadField({
  label = "Brand / Project Logo",
  value,
  fallbackSeed = "Brand",
  onChange,
  folder = "projects",
  helperText = "Upload high-res PNG, JPG, SVG or WEBP (Max 5MB), or paste an image link.",
  className = "",
}: LogoUploadFieldProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlDraft, setUrlDraft] = useState(value || "");

  const seed = encodeURIComponent(String(fallbackSeed || "brand").slice(0, 24) || "brand");
  const fallbackUrl = `https://api.dicebear.com/7.x/identicon/svg?seed=${seed}`;
  const hasCustomLogo = Boolean(value && typeof value === "string" && value.trim() !== "");
  const displaySrc = hasCustomLogo ? (value as string) : fallbackUrl;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File is too large. Maximum allowed size is 5MB.");
      return;
    }

    setIsUploading(true);
    try {
      const res = await api.uploadImage(file, folder);
      if (res && res.url) {
        onChange(res.url);
        setUrlDraft(res.url);
        toast.success("Logo uploaded successfully!");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to upload logo image");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleApplyUrl = () => {
    const trimmed = urlDraft.trim();
    onChange(trimmed);
    setShowUrlInput(false);
    if (trimmed) {
      toast.success("Logo URL applied!");
    } else {
      toast.info("Logo reset to default");
    }
  };

  const handleReset = () => {
    onChange("");
    setUrlDraft("");
    setShowUrlInput(false);
    toast.info("Logo reset to default icon");
  };

  return (
    <div className={cn("space-y-2 p-3 sm:p-4 rounded-2xl bg-muted/20 border border-border/60", className)}>
      <div className="flex items-center justify-between">
        <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider flex items-center gap-1.5">
          <ImageIcon className="w-3.5 h-3.5 text-primary" />
          <span>{label}</span>
        </label>
        {hasCustomLogo ? (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
            Custom Logo Active
          </span>
        ) : (
          <span className="text-[10px] font-semibold text-muted-foreground">
            Using Default Icon
          </span>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        {/* Logo Preview */}
        <div className="relative group shrink-0">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-2 border-primary/30 overflow-hidden shadow-md shadow-primary/10 bg-white p-1 ring-2 ring-primary/10 flex items-center justify-center">
            <img
              src={displaySrc}
              alt="Logo Preview"
              className="w-full h-full object-cover rounded-xl"
              onError={(e) => {
                const el = e.currentTarget;
                if (!el.src.includes("dicebear")) el.src = fallbackUrl;
              }}
            />
          </div>
          {isUploading && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-xs rounded-2xl flex items-center justify-center">
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Actions & Controls */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
              className="hidden"
              onChange={handleFileSelect}
            />

            <button
              type="button"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 shrink-0"
            >
              {isUploading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>{hasCustomLogo ? "Change Logo" : "Upload Logo"}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setShowUrlInput(!showUrlInput);
                setUrlDraft(value || "");
              }}
              className="px-3 py-1.5 bg-background hover:bg-muted text-foreground/80 hover:text-foreground font-semibold text-xs rounded-xl border border-border shadow-2xs transition-colors flex items-center gap-1.5 shrink-0"
            >
              <LinkIcon className="w-3.5 h-3.5 text-muted-foreground" />
              <span>{showUrlInput ? "Hide Link" : "Paste Link"}</span>
            </button>

            {hasCustomLogo && (
              <button
                type="button"
                onClick={handleReset}
                className="px-2.5 py-1.5 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-xl transition-colors flex items-center gap-1 shrink-0 font-medium"
                title="Remove custom logo and revert to default"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset to Default</span>
              </button>
            )}
          </div>

          {showUrlInput && (
            <div className="flex items-center gap-1.5 pt-1">
              <input
                type="url"
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
                placeholder="https://example.com/logo.png"
                className="flex-1 px-3 py-1.5 bg-background border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                type="button"
                onClick={handleApplyUrl}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1 shrink-0"
              >
                <Check className="w-3 h-3" />
                <span>Apply</span>
              </button>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground leading-tight">
            {helperText}
          </p>
        </div>
      </div>
    </div>
  );
}

