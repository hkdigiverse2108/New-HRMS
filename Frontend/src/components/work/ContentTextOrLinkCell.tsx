import React, { useState, useMemo } from "react";
import {
  Copy,
  Check,
  ExternalLink,
  Pencil,
  Eye,
  FileText,
  Sparkles,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

function safeFormat(dateStr: string | undefined | null, fmt: string, fallback = "-") {
  if (!dateStr) return fallback;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return fallback;
    return format(d, fmt);
  } catch {
    return fallback;
  }
}

/**
 * Checks whether the text is a single web link or URL.
 * Multi-line strings are treated as text/copy, not a simple URL.
 */
export function isLikelyUrl(text?: string | null): boolean {
  if (!text) return false;
  const str = text.trim();
  if (str.includes("\n")) return false; // Multi-line content is always treated as text/script!
  if (/^https?:\/\//i.test(str)) return true;
  if (
    /^(www\.|docs\.google\.com|drive\.google\.com|notion\.so|figma\.com|instagram\.com)[^\s]+$/i.test(
      str
    )
  ) {
    return true;
  }
  return false;
}

export function formatUrlForHref(url: string): string {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function getUrlDisplayMeta(
  url: string,
  defaultLabel: string
): { label: string; icon: string; badgeClass: string } {
  const lower = url.toLowerCase();
  if (lower.includes("docs.google.com")) {
    return {
      label: "Google Docs",
      icon: "📄",
      badgeClass:
        "bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 border-blue-500/25",
    };
  }
  if (lower.includes("drive.google.com")) {
    return {
      label: "Google Drive",
      icon: "📁",
      badgeClass:
        "bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 border-amber-500/25",
    };
  }
  if (lower.includes("notion.so") || lower.includes("notion.site")) {
    return {
      label: "Notion",
      icon: "📝",
      badgeClass:
        "bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 border-purple-500/25",
    };
  }
  if (lower.includes("figma.com")) {
    return {
      label: "Figma",
      icon: "🎨",
      badgeClass:
        "bg-pink-500/10 hover:bg-pink-500/20 text-pink-600 border-pink-500/25",
    };
  }
  if (lower.includes("instagram.com")) {
    return {
      label: "Instagram",
      icon: "📸",
      badgeClass:
        "bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 border-rose-500/25",
    };
  }
  return {
    label: defaultLabel || "Docs Link",
    icon: "🔗",
    badgeClass:
      "bg-primary/10 hover:bg-primary/20 text-primary border-primary/25",
  };
}

/**
 * Trims outer-most leading and trailing whitespace/newlines only.
 * Preserves 100% of internal newlines, blank lines, bullets, emojis, indentation, dots (. \n . \n .)
 */
export function cleanCopyText(rawText?: string | null): string {
  if (!rawText) return "";
  return rawText.trim();
}

export interface ContentTextOrLinkCellProps {
  field: "caption" | "scriptLink";
  value?: string | null | undefined;
  label: string; // e.g. "Caption" or "Script"
  item: any; // the calendar item
  onSave: (field: string, newValue: string) => Promise<void> | void;
  isExpanded?: boolean | undefined;
}

export function ContentTextOrLinkCell({
  field,
  value,
  label,
  item,
  onSave,
  isExpanded = false,
}: ContentTextOrLinkCellProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [draftText, setDraftText] = useState(value || "");
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const isUrl = useMemo(() => isLikelyUrl(value), [value]);
  const isNotRequired = useMemo(
    () => String(value || "").trim().toLowerCase() === "not required",
    [value]
  );

  const urlMeta = useMemo(() => {
    if (!isUrl || !value) {
      return {
        label: field === "scriptLink" ? "Script Doc" : "Caption Link",
        icon: "🔗",
        badgeClass: "bg-primary/10 text-primary border-primary/20",
      };
    }
    return getUrlDisplayMeta(
      value,
      field === "scriptLink" ? "Script Doc" : "Caption Doc"
    );
  }, [isUrl, value, field]);

  // Text statistics
  const { wordCount, charCount, lineCount, snippet } = useMemo(() => {
    const raw = (value || "").trim();
    if (!raw) {
      return { wordCount: 0, charCount: 0, lineCount: 0, snippet: "" };
    }
    const words = raw.split(/\s+/).filter(Boolean).length;
    const lines = raw.split("\n").filter((l) => l.trim().length > 0).length;
    const firstLine = raw.split("\n")[0] || "";
    const cleanFirstLine =
      firstLine.length > 28 ? `${firstLine.slice(0, 28)}...` : firstLine;
    return {
      wordCount: words,
      charCount: raw.length,
      lineCount: lines || 1,
      snippet: cleanFirstLine,
    };
  }, [value]);

  const handleCopy = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const text = cleanCopyText(value);
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success(`${label} copied! (Clean spacing preserved)`);
  };

  const handleSave = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsSaving(true);
    try {
      const cleanVal = cleanCopyText(draftText);
      await onSave(field, cleanVal);
      setIsModalOpen(false);
      toast.success(`${label} updated successfully!`);
    } catch (err: any) {
      toast.error(err?.message || `Failed to update ${label}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Render Table Cell Contents
  return (
    <>
      <div className="w-full flex justify-center items-center">
        {/* CASE 1: Empty / Null */}
        {!value || !value.trim() ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setDraftText("");
              setMode("edit");
              setIsModalOpen(true);
            }}
            className="text-[10px] text-muted-foreground/40 hover:text-primary font-medium italic transition-colors py-0.5 px-2 rounded-md hover:bg-primary/5 flex items-center gap-1 group/btn"
            title={`Click to add ${label.toLowerCase()} or link`}
          >
            <span>+ {label.toLowerCase()}</span>
            <span className="opacity-0 group-hover/btn:opacity-60 text-[9px]">
              ✏️
            </span>
          </button>
        ) : isNotRequired ? (
          /* CASE 2: "Not Required" Badge */
          <div
            className="inline-flex items-center gap-1 group/nr"
            onClick={(e) => e.stopPropagation()}
          >
            <span
              onClick={(e) => {
                e.stopPropagation();
                setDraftText("Not Required");
                setMode("edit");
                setIsModalOpen(true);
              }}
              className="px-2 py-0.5 font-bold rounded-md text-[10px] bg-muted/60 text-muted-foreground border border-border/50 cursor-pointer hover:bg-muted select-none"
              title="Click to edit if required"
            >
              Not Required
            </span>
            <button
              type="button"
              title="Edit"
              onClick={(e) => {
                e.stopPropagation();
                setDraftText("Not Required");
                setMode("edit");
                setIsModalOpen(true);
              }}
              className="opacity-0 group-hover/nr:opacity-70 p-0.5 text-muted-foreground hover:text-foreground text-[9px] transition-opacity"
            >
              ✏️
            </button>
          </div>
        ) : isUrl ? (
          /* CASE 3: Clean Link Badge (Prevents the ugly table-stretching bug) */
          <div
            className="inline-flex items-center justify-center gap-1 group/url-pill max-w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <a
              href={formatUrlForHref(value)}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "px-2.5 py-0.5 font-bold rounded-md text-[10px] flex items-center gap-1 border shadow-2xs transition-all hover:scale-102 truncate max-w-[135px]",
                urlMeta.badgeClass
              )}
              title={value}
            >
              <span className="shrink-0 text-xs">{urlMeta.icon}</span>
              <span className="truncate">{urlMeta.label}</span>
              <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-70" />
            </a>
            <button
              type="button"
              title="Copy Link"
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(value.trim());
                toast.success("Link copied!");
              }}
              className="opacity-0 group-hover/url-pill:opacity-80 hover:opacity-100 p-0.5 text-muted-foreground hover:text-primary transition-opacity"
            >
              <Copy className="w-2.5 h-2.5" />
            </button>
            <button
              type="button"
              title="Edit Link / Text"
              onClick={(e) => {
                e.stopPropagation();
                setDraftText(value);
                setMode("edit");
                setIsModalOpen(true);
              }}
              className="opacity-0 group-hover/url-pill:opacity-70 hover:opacity-100 p-0.5 text-muted-foreground hover:text-foreground text-[9px] transition-opacity"
            >
              ✏️
            </button>
          </div>
        ) : (
          /* CASE 4: Formatted Copy / Text / Script Card */
          <div
            onClick={(e) => {
              e.stopPropagation();
              setDraftText(value);
              setMode("view");
              setIsModalOpen(true);
            }}
            className="group/text-pill cursor-pointer inline-flex flex-col items-center max-w-[170px] w-full"
            title="Click to view & copy full content"
          >
            <div className="w-full px-2 py-1 rounded-lg border border-border/60 bg-card hover:bg-primary/5 hover:border-primary/40 shadow-2xs transition-all flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-xs shrink-0">
                  {field === "caption" ? "💬" : "📜"}
                </span>
                <span className="text-[11px] font-semibold text-foreground truncate block text-left">
                  {snippet || label}
                </span>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  title="Quick Copy (Clean Spacing)"
                  onClick={handleCopy}
                  className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                >
                  {copied ? (
                    <Check className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
                <button
                  type="button"
                  title="Edit"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDraftText(value);
                    setMode("edit");
                    setIsModalOpen(true);
                  }}
                  className="opacity-0 group-hover/text-pill:opacity-70 hover:opacity-100 p-0.5 text-[9px] text-muted-foreground hover:text-foreground transition-opacity"
                >
                  ✏️
                </button>
              </div>
            </div>
            {/* Subtle word count under pill */}
            <span className="text-[9px] text-muted-foreground/60 font-medium tracking-tight mt-0.5">
              {wordCount} words • {lineCount} {lineCount === 1 ? "line" : "lines"}
            </span>
          </div>
        )}
      </div>

      {/* Modern Deliverable Content Viewer & Editor Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl w-[calc(100vw-2rem)] sm:w-full rounded-2xl bg-card border border-border shadow-2xl p-0 overflow-hidden z-[400] flex flex-col gap-0 max-h-[90vh]">
          {/* Header */}
          <div className="px-4 sm:px-6 py-4 bg-muted/20 border-b border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-12 sm:pr-14 min-w-0">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-base sm:text-lg shrink-0">
                {isUrl ? "🔗" : field === "caption" ? "💬" : "📜"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
                  <h3 className="text-xs sm:text-sm font-extrabold text-foreground tracking-tight truncate max-w-[200px] sm:max-w-[280px]">
                    {item.topic || "Deliverable"}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-muted border border-border/60 text-muted-foreground uppercase shrink-0">
                    {item.type || "Post"}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-primary/10 text-primary uppercase shrink-0">
                    {label}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground font-medium mt-0.5 truncate">
                  📅 Schedule:{" "}
                  {item.postingDate
                    ? safeFormat(item.postingDate, "dd/MM/yyyy")
                    : "No Date"}
                  {item.postingDay ? ` (${item.postingDay})` : ""}
                </p>
              </div>
            </div>

            {/* View / Edit Mode Switcher */}
            <div className="flex items-center bg-muted/60 p-0.5 rounded-xl border border-border/50 shrink-0 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setMode("view")}
                className={cn(
                  "px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                  mode === "view"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View & Copy</span>
              </button>
              <button
                type="button"
                onClick={() => setMode("edit")}
                className={cn(
                  "px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                  mode === "edit"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="p-4 sm:p-6 min-w-0 overflow-y-auto max-h-[calc(90vh-80px)]">
            {mode === "view" ? (
              <div className="space-y-4 min-w-0">
                {/* Action Banner */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-primary/5 border border-primary/20 rounded-xl min-w-0">
                  <div className="flex items-center gap-2 text-xs font-semibold text-primary min-w-0 flex-1">
                    <Sparkles className="w-4 h-4 shrink-0" />
                    <span className="truncate">
                      {isUrl
                        ? "Web link detected for this deliverable"
                        : "Full formatted text with clean spacing & emojis"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto flex-wrap">
                    {isUrl && value && (
                      <a
                        href={formatUrlForHref(value)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-background hover:bg-muted text-foreground font-bold rounded-lg text-xs flex items-center gap-1.5 border border-border shadow-xs transition-colors shrink-0"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open Link</span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="px-3.5 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-sm transition-all hover:scale-102 shrink-0"
                    >
                      {copied ? (
                        <Check className="w-3.5 h-3.5 text-white" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {copied
                          ? "Copied!"
                          : isUrl
                          ? "Copy Link"
                          : `Copy Clean ${label}`}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Formatted Text Box */}
                <div className="relative group min-w-0">
                  <div className="p-4 sm:p-5 bg-muted/20 border border-border/60 rounded-xl max-h-[46vh] overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words break-all [overflow-wrap:anywhere] font-sans text-xs sm:text-sm leading-relaxed text-foreground select-text selection:bg-primary/20 min-w-0">
                    {value ? (
                      cleanCopyText(value)
                    ) : (
                      <span className="text-muted-foreground/60 italic">
                        No {label.toLowerCase()} added yet. Click &apos;Edit&apos; above to write or paste.
                      </span>
                    )}
                  </div>
                </div>

                {/* Word & Character Count Footer */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-muted-foreground font-medium pt-1 gap-2 min-w-0">
                  <span className="shrink-0">
                    {charCount} characters • {wordCount} words • {lineCount}{" "}
                    {lineCount === 1 ? "line" : "lines"}
                  </span>
                  <span className="text-[10px] text-muted-foreground/70 truncate">
                    ✨ Clean Trim: No blank spaces before first word or after last word
                  </span>
                </div>
              </div>
            ) : (
              /* Edit Mode */
              <div className="space-y-4 min-w-0">
                <div className="min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5 min-w-0">
                    <label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5 min-w-0">
                      <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="truncate">{label} Content (Multi-line Text or URL)</span>
                    </label>
                    <span className="text-[10px] font-semibold text-muted-foreground shrink-0">
                      {draftText.length} chars •{" "}
                      {draftText.trim().split(/\s+/).filter(Boolean).length} words
                    </span>
                  </div>
                  <textarea
                    autoFocus
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                    rows={12}
                    placeholder={`Write or paste full ${label.toLowerCase()} here with line breaks, bullet points, emojis, hashtags, or paste a Google Docs URL...`}
                    className="w-full px-4 py-3 bg-muted/20 border border-border/60 rounded-xl text-xs sm:text-sm leading-relaxed text-foreground font-sans focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary resize-y whitespace-pre-wrap break-words break-all [overflow-wrap:anywhere] min-w-0"
                  />
                </div>

                {/* Edit Mode Footer Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border/40 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setDraftText("Not Required")}
                      className="px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted border border-border/40 rounded-lg transition-colors"
                    >
                      Set &quot;Not Required&quot;
                    </button>
                    <button
                      type="button"
                      onClick={() => setDraftText(cleanCopyText(draftText))}
                      className="px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted border border-border/40 rounded-lg transition-colors"
                      title="Trims outer blanks while preserving internal spacing"
                    >
                      ✂️ Trim Outer Spaces
                    </button>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setDraftText(value || "");
                        setMode("view");
                      }}
                      className="px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={isSaving}
                      className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                    >
                      {isSaving && (
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      )}
                      <span>{isSaving ? "Saving..." : "Save Changes"}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
