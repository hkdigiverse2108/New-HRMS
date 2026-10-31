import React from "react";
import {
  History,
  X,
  ExternalLink,
  Clock,
  User,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ArrowRightLeft,
  RefreshCw,
  Plus,
  FileText,
  Video,
  Image,
  Camera,
  MessageSquare,
  Instagram,
  Tag,
  Loader2,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface ActivityHistoryEvent {
  id: string;
  timestamp: string;
  action: string;
  badgeLabel?: string | undefined;
  performedBy: string;
  lines: string[];
  type?: "create" | "status" | "transfer" | "approve" | "reject" | "update" | "link" | "remark" | undefined;
}

export interface ActivityHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modalTitle?: string | undefined;
  brandName?: string | undefined;
  category?: string | undefined;
  deliverableType?: string | undefined;
  title?: string | undefined;
  currentStatus?: string | undefined;
  assignedToName?: string | undefined;
  assignedByName?: string | undefined;
  dueDate?: string | undefined;
  isLoading?: boolean | undefined;
  events: ActivityHistoryEvent[];
}

function getInitials(name?: string): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  const p0 = parts[0] ?? "";
  if (parts.length === 1) return p0.slice(0, 2).toUpperCase() || "U";
  const pLast = parts[parts.length - 1] ?? "";
  const first = p0[0] ?? "";
  const last = pLast[0] ?? "";
  return (first + last).toUpperCase() || "U";
}

function formatEventTimestamp(timestampString: string): string {
  if (!timestampString) return "";
  try {
    const d = new Date(timestampString);
    if (isNaN(d.getTime())) return timestampString;
    return d.toLocaleString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return timestampString;
  }
}

interface ParsedLine {
  kind: "link" | "quote" | "status_flow" | "diff" | "text";
  label?: string | undefined;
  url?: string | undefined;
  text?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  icon?: any;
}

const KNOWN_FIELDS: Record<string, { label: string; icon: any; isLink?: boolean }> = {
  postingLinkOfIg: { label: "Instagram Post Link", icon: Instagram, isLink: true },
  finalReelLink: { label: "Final Reel / Video Link", icon: Video, isLink: true },
  scriptLink: { label: "Script Document Link", icon: FileText, isLink: true },
  shootLink: { label: "Shoot / Raw Footage Link", icon: Camera, isLink: true },
  thumbnailLink: { label: "Thumbnail Design Link", icon: Image, isLink: true },
  caption: { label: "Post Caption", icon: FileText },
  remark: { label: "Remark / Note", icon: MessageSquare },
  status: { label: "Status", icon: RefreshCw },
  topic: { label: "Topic / Concept", icon: Tag },
};

function parseLine(raw: string): ParsedLine {
  const line = raw.replace(/^[•\-\*]\s*/, "").trim();

  // Pattern 1: 'field' changed from 'A' to 'B'
  const m1 = line.match(/^'([^']+)' changed from '([^']*)' to '([^']*)'$/);
  if (m1 && m1[1]) {
    const fieldKey = m1[1];
    const fieldMeta = KNOWN_FIELDS[fieldKey] ?? { label: fieldKey, icon: RefreshCw };
    return {
      kind: fieldKey === "status" ? "status_flow" : "diff",
      label: fieldMeta.label,
      from: m1[2] ?? "(empty)",
      to: m1[3] ?? "(empty)",
      icon: fieldMeta.icon,
    };
  }

  // Pattern 2: 'field' changed to 'B'
  const m2 = line.match(/^'([^']+)' changed to '(.*)'$/);
  if (m2 && m2[1]) {
    const fieldKey = m2[1];
    const val = m2[2] ?? "";
    const fieldMeta = KNOWN_FIELDS[fieldKey] ?? { label: fieldKey, icon: Tag };
    if (fieldMeta.isLink || /^https?:\/\//i.test(val)) {
      return {
        kind: "link",
        label: fieldMeta.label,
        url: val,
        icon: fieldMeta.icon ?? ExternalLink,
      };
    }
    if (fieldKey === "remark" || fieldKey === "caption") {
      return {
        kind: "quote",
        label: fieldMeta.label,
        text: val,
        icon: fieldMeta.icon,
      };
    }
    return {
      kind: "text",
      label: fieldMeta.label,
      text: `${fieldMeta.label}: ${val || "(cleared)"}`,
      icon: fieldMeta.icon,
    };
  }

  // Pattern 3: Status changed from A to B (Tasks format)
  const m3 = line.match(/^[Ss]tatus changed from (\S+) to (\S+)$/);
  if (m3 && m3[1] && m3[2]) {
    return {
      kind: "status_flow",
      label: "Status Changed",
      from: m3[1],
      to: m3[2],
      icon: RefreshCw,
    };
  }

  // Pattern 4: Label: https://...
  const m4 = line.match(/^(.*?):\s*(https?:\/\/\S+)$/);
  if (m4 && m4[1] && m4[2]) {
    let icon = ExternalLink;
    const lower = (m4[1] ?? "").toLowerCase();
    if (lower.includes("instagram") || lower.includes("ig")) icon = Instagram;
    else if (lower.includes("reel") || lower.includes("video")) icon = Video;
    else if (lower.includes("script")) icon = FileText;
    else if (lower.includes("shoot")) icon = Camera;
    else if (lower.includes("thumb")) icon = Image;

    return {
      kind: "link",
      label: m4[1],
      url: m4[2],
      icon,
    };
  }

  // Pattern 5: Remark / Note: text
  const m5 = line.match(/^(Remark|Note|Comment):\s*(.*)$/i);
  if (m5 && m5[1]) {
    return {
      kind: "quote",
      label: m5[1],
      text: m5[2] ?? "",
      icon: MessageSquare,
    };
  }

  // Default raw text
  return {
    kind: "text",
    text: line,
  };
}

export const ActivityHistoryModal: React.FC<ActivityHistoryModalProps> = ({
  open,
  onOpenChange,
  modalTitle = "Activity Timeline",
  brandName,
  category,
  deliverableType,
  title,
  currentStatus,
  assignedToName,
  assignedByName,
  dueDate,
  isLoading = false,
  events,
}) => {
  // Event style helper
  const getEventMeta = (ev: ActivityHistoryEvent) => {
    const rawAction = (ev.action || "").toLowerCase();

    if (ev.type === "create" || rawAction === "created" || rawAction.includes("create")) {
      return {
        icon: Plus,
        iconBg: "bg-blue-500 text-white shadow-blue-500/25",
        badgeBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
        label: ev.badgeLabel || "CREATED",
      };
    }
    if (ev.type === "status" || rawAction.includes("status")) {
      return {
        icon: RefreshCw,
        iconBg: "bg-amber-500 text-white shadow-amber-500/25",
        badgeBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
        label: ev.badgeLabel || "STATUS CHANGED",
      };
    }
    if (ev.type === "transfer" || rawAction.includes("transfer")) {
      return {
        icon: ArrowRightLeft,
        iconBg: "bg-purple-600 text-white shadow-purple-500/25",
        badgeBg: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
        label: ev.badgeLabel || "TRANSFERRED",
      };
    }
    if (ev.type === "approve" || rawAction.includes("approve")) {
      return {
        icon: CheckCircle2,
        iconBg: "bg-teal-600 text-white shadow-teal-500/25",
        badgeBg: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
        label: ev.badgeLabel || "APPROVED",
      };
    }
    if (ev.type === "reject" || rawAction.includes("reject") || rawAction.includes("revision")) {
      return {
        icon: AlertCircle,
        iconBg: "bg-rose-500 text-white shadow-rose-500/25",
        badgeBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
        label: ev.badgeLabel || "REVISION REQUESTED",
      };
    }

    // Inspect lines for deliverable uploads
    const hasLink = ev.lines.some((l) => l.includes("http") || l.includes("Link"));
    if (hasLink) {
      return {
        icon: ExternalLink,
        iconBg: "bg-emerald-600 text-white shadow-emerald-500/25",
        badgeBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
        label: ev.badgeLabel || "DELIVERABLE ADDED",
      };
    }

    return {
      icon: History,
      iconBg: "bg-teal-600 text-white shadow-teal-500/25",
      badgeBg: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
      label: ev.badgeLabel || "UPDATED",
    };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-20px)] sm:max-w-[620px] p-0 overflow-hidden border border-border/60 shadow-2xl rounded-[28px] bg-card flex flex-col max-h-[88vh] [&>button.absolute]:hidden">
        <div className="flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 flex items-center justify-between border-b border-border/50 bg-muted/20">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-500/20 via-emerald-500/15 to-teal-500/5 border border-teal-500/25 flex items-center justify-center text-teal-600 dark:text-teal-400 shadow-sm shrink-0">
                <History className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-[17px] font-bold text-foreground tracking-tight leading-tight truncate">
                    {modalTitle}
                  </h2>
                  {events && events.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-muted text-muted-foreground border border-border/60 shrink-0">
                      {events.length} {events.length === 1 ? "entry" : "entries"}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  {brandName && (
                    <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-bold text-[10.5px] border border-primary/20 shrink-0">
                      {brandName}
                    </span>
                  )}
                  {category && (
                    <span className="px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-600 dark:text-teal-400 font-semibold text-[10.5px] border border-teal-500/20 shrink-0">
                      {category}
                    </span>
                  )}
                  {deliverableType && (
                    <span className="px-2 py-0.5 rounded-md bg-muted text-foreground/80 font-medium text-[10.5px] border border-border/50 shrink-0 uppercase tracking-wide">
                      {deliverableType}
                    </span>
                  )}
                  {title && (
                    <span className="text-[11.5px] text-muted-foreground font-medium truncate max-w-[200px] sm:max-w-[280px]">
                      {title}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Clean Single Close Button */}
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground bg-muted/60 hover:bg-muted border border-border/50 transition-all hover:scale-105 active:scale-95 shrink-0"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Context Quick Strip (Status, Assignee, Due Date) */}
          {(currentStatus || assignedToName || dueDate) && (
            <div className="px-6 py-2.5 bg-muted/30 border-b border-border/40 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2.5 flex-wrap">
                {currentStatus && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-card border border-border/60 font-semibold text-[11px] shadow-2xs">
                    <span
                      className={cn(
                        "w-2 h-2 rounded-full",
                        currentStatus.toLowerCase().includes("done") || currentStatus.toLowerCase().includes("completed")
                          ? "bg-emerald-500"
                          : currentStatus.toLowerCase().includes("progress")
                          ? "bg-blue-500"
                          : currentStatus.toLowerCase().includes("review")
                          ? "bg-purple-500"
                          : "bg-amber-500"
                      )}
                    />
                    <span className="text-muted-foreground capitalize">Status:</span>
                    <span className="text-foreground capitalize">{currentStatus}</span>
                  </div>
                )}
                {assignedToName && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-card border border-border/60 text-[11px] font-medium text-foreground shadow-2xs">
                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Assigned:</span>
                    <span className="font-semibold">{assignedToName}</span>
                  </div>
                )}
                {assignedByName && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-card border border-border/60 text-[11px] font-medium text-foreground shadow-2xs">
                    <span className="text-muted-foreground">By:</span>
                    <span className="font-semibold">{assignedByName}</span>
                  </div>
                )}
              </div>
              {dueDate && (
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{dueDate}</span>
                </div>
              )}
            </div>
          )}

          {/* Timeline Feed */}
          <div className="px-6 py-5 overflow-y-auto custom-scrollbar flex-1 relative max-h-[60vh]">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-teal-600 dark:text-teal-400" />
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  Loading activity timeline...
                </p>
              </div>
            ) : events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 bg-muted/40 rounded-2xl flex items-center justify-center mb-3 text-muted-foreground/40">
                  <History className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-foreground mb-1">No Activity Logged Yet</h3>
                <p className="text-xs text-muted-foreground max-w-[260px]">
                  Any edits, links added from the Content Calendar, or status transitions will appear here in real time.
                </p>
              </div>
            ) : (
              <div className="relative">
                {/* Continuous timeline vertical line */}
                <div className="absolute left-[13px] top-3 bottom-3 w-[2px] bg-gradient-to-b from-teal-500/50 via-border/80 to-transparent" />

                <div className="space-y-4">
                  {events.map((ev) => {
                    const meta = getEventMeta(ev);
                    const MetaIcon = meta.icon;

                    return (
                      <div key={ev.id} className="relative pl-8 group">
                        {/* Timeline Node Icon */}
                        <div
                          className={cn(
                            "absolute left-0 top-1.5 w-[28px] h-[28px] rounded-full flex items-center justify-center z-10 transition-transform group-hover:scale-110 shadow-sm ring-4 ring-card",
                            meta.iconBg
                          )}
                        >
                          <MetaIcon className="w-3.5 h-3.5" />
                        </div>

                        {/* Card */}
                        <div className="bg-card border border-border/70 hover:border-teal-500/40 dark:border-border/60 rounded-2xl p-3.5 shadow-2xs hover:shadow-md transition-all group-hover:bg-muted/10">
                          {/* Card Header: Performer + Action Badge + Timestamp */}
                          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-teal-500/20 to-emerald-500/20 text-teal-700 dark:text-teal-300 font-bold text-[10px] flex items-center justify-center shrink-0 border border-teal-500/20">
                                {getInitials(ev.performedBy)}
                              </div>
                              <span className="text-[13px] font-bold text-foreground truncate">
                                {ev.performedBy || "Management"}
                              </span>
                              <span
                                className={cn(
                                  "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border shrink-0",
                                  meta.badgeBg
                                )}
                              >
                                {meta.label}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground shrink-0 tabular-nums">
                              <Clock className="w-3 h-3" />
                              <span>{formatEventTimestamp(ev.timestamp)}</span>
                            </div>
                          </div>

                          {/* Card Body: Parsed Diff Content */}
                          {ev.lines && ev.lines.length > 0 ? (
                            <div className="space-y-2 mt-2">
                              {ev.lines.map((lineStr, lineIdx) => {
                                const parsed = parseLine(lineStr);

                                if (parsed.kind === "link" && parsed.url) {
                                  const IconComponent = parsed.icon || ExternalLink;
                                  return (
                                    <div
                                      key={lineIdx}
                                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2.5 rounded-xl bg-emerald-500/5 dark:bg-emerald-950/20 border border-emerald-500/20"
                                    >
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
                                          <IconComponent className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0">
                                          <p className="text-xs font-bold text-foreground truncate">
                                            {parsed.label || "External Deliverable"}
                                          </p>
                                          <p className="text-[11px] text-muted-foreground truncate max-w-[220px] sm:max-w-[320px]">
                                            {parsed.url}
                                          </p>
                                        </div>
                                      </div>
                                      <a
                                        href={parsed.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11.5px] font-semibold shrink-0 shadow-xs transition-all active:scale-95"
                                      >
                                        <span>Open Link</span>
                                        <ExternalLink className="w-3.5 h-3.5" />
                                      </a>
                                    </div>
                                  );
                                }

                                if (parsed.kind === "status_flow") {
                                  return (
                                    <div
                                      key={lineIdx}
                                      className="flex items-center gap-2 p-2 rounded-xl bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/20 text-xs font-semibold"
                                    >
                                      <span className="text-muted-foreground text-[11px] font-medium">
                                        Status changed:
                                      </span>
                                      <span className="px-2 py-0.5 rounded-md bg-muted text-foreground/80 border border-border/60 capitalize font-medium text-[11px]">
                                        {parsed.from}
                                      </span>
                                      <span className="text-muted-foreground font-bold">→</span>
                                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 capitalize font-bold text-[11px]">
                                        {parsed.to}
                                      </span>
                                    </div>
                                  );
                                }

                                if (parsed.kind === "quote") {
                                  return (
                                    <div
                                      key={lineIdx}
                                      className="p-2.5 rounded-xl bg-muted/40 border border-border/50 text-xs text-foreground/90 font-medium italic flex items-start gap-2"
                                    >
                                      <MessageSquare className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                                      <div>
                                        <span className="not-italic font-bold text-foreground text-[11px] block text-muted-foreground mb-0.5">
                                          {parsed.label}:
                                        </span>
                                        <span>{parsed.text ? `“${parsed.text}”` : "(Cleared)"}</span>
                                      </div>
                                    </div>
                                  );
                                }

                                if (parsed.kind === "diff") {
                                  return (
                                    <div
                                      key={lineIdx}
                                      className="flex items-center gap-2 p-2 rounded-xl bg-muted/30 border border-border/40 text-xs"
                                    >
                                      <span className="font-semibold text-foreground text-[11.5px]">
                                        {parsed.label}:
                                      </span>
                                      <span className="line-through text-muted-foreground text-[11px]">
                                        {parsed.from}
                                      </span>
                                      <span className="text-muted-foreground">→</span>
                                      <span className="font-semibold text-foreground text-[11px]">
                                        {parsed.to}
                                      </span>
                                    </div>
                                  );
                                }

                                return (
                                  <div
                                    key={lineIdx}
                                    className="text-xs text-foreground/80 font-medium leading-relaxed pl-2 border-l-2 border-border/60"
                                  >
                                    {parsed.text}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground italic mt-1">Action recorded</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3.5 border-t border-border/50 bg-muted/20 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Audit trail logged automatically</span>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-9 px-5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs shadow-sm transition-all active:scale-95"
            >
              Done
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
