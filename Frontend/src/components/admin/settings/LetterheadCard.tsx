import React, { useState, useEffect } from "react";
import { FileText, Upload, Trash2, Loader2, Image as ImageIcon, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { getApiUrl } from "@/lib/config";

export function LetterheadCard({ className }: { className?: string }) {
  const [letterheadUrl, setLetterheadUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch current letterhead URL on mount
  useEffect(() => {
    const fetchLetterhead = async () => {
      try {
        setIsLoading(true);
        const res = await api.get<any>("/settings", {
          showLoader: false,
          showErrorToast: false,
        });
        if (res?.letterhead_url) {
          setLetterheadUrl(res.letterhead_url);
        }
      } catch (err) {
        console.warn("Failed to fetch letterhead from /settings", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLetterhead();
  }, []);

  const getFullImageUrl = (url: string | null) => {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
      return url;
    }
    const base = getApiUrl().replace(/\/+$/, "");
    return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
  };

  // Upload letterhead using POST /settings/letterhead (key: 'file')
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file (PNG / JPG / WEBP)");
      return;
    }

    try {
      setIsUploading(true);
      const fd = new FormData();
      fd.append("file", file);

      const res = await api.post<any>("/settings/letterhead", fd);
      if (res?.letterhead_url) {
        setLetterheadUrl(res.letterhead_url);
        toast.success("Letterhead uploaded successfully!");
      } else {
        toast.success("Letterhead updated!");
      }
    } catch (err: any) {
      console.error("Letterhead upload error:", err);
      toast.error(err?.message || "Failed to upload letterhead");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  // Remove letterhead via PUT /settings
  const handleRemoveLetterhead = async () => {
    try {
      setIsDeleting(true);
      await api.put("/settings", { letterhead_url: null });
      setLetterheadUrl(null);
      toast.success("Letterhead removed successfully");
    } catch (err: any) {
      console.error("Failed to remove letterhead:", err);
      toast.error(err?.message || "Failed to remove letterhead");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className={cn(
        "bg-card border border-border/50 rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-sm flex flex-col min-w-0 max-w-full space-y-5",
        className
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <FileText className="w-5 h-5 text-primary" />
            <h3 className="text-xl font-black text-foreground">
              Company Letterhead
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground font-medium">
            Upload the official company letterhead header image (e.g. header.png) used when generating official documents and letters.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-primary/90 transition-colors cursor-pointer">
            {isUploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            <span>{isUploading ? "Uploading..." : "Upload Letterhead"}</span>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
              disabled={isUploading}
            />
          </label>

          {letterheadUrl && (
            <button
              type="button"
              onClick={handleRemoveLetterhead}
              disabled={isDeleting}
              className="p-2 border border-destructive/30 hover:bg-destructive/10 text-destructive rounded-xl transition-colors"
              title="Remove Letterhead"
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="text-sm font-semibold">Loading letterhead...</span>
        </div>
      ) : letterheadUrl ? (
        <div className="space-y-2">
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Active Letterhead Header Preview
          </div>
          <div className="w-full border border-border/70 rounded-2xl bg-muted/20 overflow-hidden p-2 flex items-center justify-center shadow-inner">
            <img
              src={getFullImageUrl(letterheadUrl)}
              alt="Company Letterhead"
              className="w-full max-h-48 object-contain rounded-xl bg-white shadow-sm"
            />
          </div>
        </div>
      ) : (
        <div className="border border-dashed border-border/80 rounded-2xl p-8 flex flex-col items-center justify-center text-center bg-muted/10 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
            <ImageIcon className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-foreground">No Letterhead Uploaded</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Upload a top header banner image (PNG/JPG) to use on official documents.
            </p>
          </div>
          <label className="mt-2 inline-flex items-center gap-2 border border-border bg-background hover:bg-muted/50 text-foreground px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-primary" />
            <span>Choose Image File</span>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
              disabled={isUploading}
            />
          </label>
        </div>
      )}
    </div>
  );
}
