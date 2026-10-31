import React, { useState, useEffect } from "react";
import {
  Clock,
  Activity,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Search,
  Filter,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Code,
  X,
  Copy,
  Check,
} from "lucide-react";
import { SocialDropdown } from "../components/SocialDropdown";
import { DateRangeFilter } from "@/components/common/DateRangeFilter";
import type { SocialEventLog, SocialPendingDm } from "../types";

interface ActivityTabProps {
  logs: SocialEventLog[];
  totalLogs: number;
  currentPage: number;
  limit: number;
  pendingDms: SocialPendingDm[];
  isLoading: boolean;
  onRefresh: () => Promise<void>;
  onPageChange: (page: number) => void;
  onLevelChange: (level: string) => void;
  onTypeChange: (type: string) => void;
  onClearLogs: () => Promise<void>;
  onDismissPendingDm: (id: string) => Promise<void>;
  onSweepPending: () => Promise<void>;
}

export const ActivityTab: React.FC<ActivityTabProps> = ({
  logs,
  totalLogs,
  currentPage,
  limit,
  pendingDms,
  isLoading,
  onRefresh,
  onPageChange,
  onLevelChange,
  onTypeChange,
  onClearLogs,
  onDismissPendingDm,
  onSweepPending,
}) => {
  const [subTab, setSubTab] = useState<"logs" | "pending">("logs");
  const [selectedLogLevel, setSelectedLogLevel] = useState("");
  const [selectedLogType, setSelectedLogType] = useState("");
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date } | undefined>();
  const [inspectEvent, setInspectEvent] = useState<SocialEventLog | null>(null);
  const [copied, setCopied] = useState(false);

  const safeLogs = Array.isArray(logs) ? logs : [];
  const safePending = Array.isArray(pendingDms) ? pendingDms : [];

  const filteredLogs = safeLogs.filter((log) => {
    if (selectedLogLevel && log.level !== selectedLogLevel) return false;
    if (selectedLogType && log.type !== selectedLogType) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchMsg = (log.message || "").toLowerCase().includes(q);
      const matchActor = (log.actor || "").toLowerCase().includes(q);
      const matchUser = (log.username || "").toLowerCase().includes(q);
      const matchType = (log.type || "").toLowerCase().includes(q);
      if (!matchMsg && !matchActor && !matchUser && !matchType) return false;
    }
    if (dateRange?.from) {
      const logDate = new Date(log.ts);
      const f = new Date(dateRange.from);
      f.setHours(0, 0, 0, 0);
      if (logDate < f) return false;
    }
    if (dateRange?.to) {
      const logDate = new Date(log.ts);
      const t = new Date(dateRange.to);
      t.setHours(23, 59, 59, 999);
      if (logDate > t) return false;
    }
    return true;
  });

  // Live countdown calculation for pending DMs
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const totalPages = Math.max(1, Math.ceil(totalLogs / limit));

  const handleCopyJson = (obj: unknown) => {
    navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = async () => {
    if (confirm("Are you sure you want to clear historical event logs?")) {
      await onClearLogs();
      await onRefresh();
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-tab Switcher & Actions */}
      <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
        <div className="flex items-center p-1 rounded-xl bg-muted/60 border border-border w-fit max-w-full overflow-x-auto">
          <button
            onClick={() => setSubTab("logs")}
            className={`flex items-center gap-2 whitespace-nowrap px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              subTab === "logs"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Live Event Logs
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-muted font-bold">
              {totalLogs}
            </span>
          </button>
          <button
            onClick={() => setSubTab("pending")}
            className={`flex items-center gap-2 whitespace-nowrap px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              subTab === "pending"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Pending Follow-Gate DMs
            {pendingDms.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-purple-500/20 text-purple-500 font-bold">
                {pendingDms.length}
              </span>
            )}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 min-w-0">
          {subTab === "logs" && (
            <>
              {/* Level Dropdown */}
              <div className="min-w-0">
              <SocialDropdown
                value={selectedLogLevel}
                onChange={(val) => {
                  setSelectedLogLevel(val);
                  onLevelChange(val);
                }}
                label="Level"
                placeholder="All Levels"
                icon={<Filter className="w-3.5 h-3.5" />}
                options={[
                  { value: "", label: "All Levels" },
                  {
                    value: "info",
                    label: "Info",
                    badge: "INFO",
                    badgeColor: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
                  },
                  {
                    value: "warn",
                    label: "Warnings",
                    badge: "WARN",
                    badgeColor: "bg-amber-500/10 text-amber-500 border-amber-500/20",
                  },
                  {
                    value: "error",
                    label: "Errors",
                    badge: "ERROR",
                    badgeColor: "bg-rose-500/10 text-rose-500 border-rose-500/20",
                  },
                ]}
              />
              </div>

              {/* Event Type Dropdown */}
              <div className="min-w-0">
              <SocialDropdown
                value={selectedLogType}
                onChange={(val) => {
                  setSelectedLogType(val);
                  onTypeChange(val);
                }}
                label="Event Type"
                placeholder="All Event Types"
                icon={<Activity className="w-3.5 h-3.5" />}
                options={[
                  { value: "", label: "All Event Types" },
                  { value: "comment_received", label: "Comment Received" },
                  { value: "private_dm_sent", label: "Private DM Sent" },
                  { value: "comment_replied", label: "Public Reply Sent" },
                  { value: "follow_gate_sent", label: "Follow-Gate Sent" },
                  { value: "token_refreshed", label: "Token Refreshed" },
                  { value: "rate_limited", label: "Rate Limited" },
                ]}
              />
              </div>

              {/* Date Range Filter */}
              <div className="min-w-0">
              <DateRangeFilter
                value={dateRange}
                onChange={setDateRange}
                placeholder="Filter by Date"
                className="h-9"
              />
              </div>

              {/* Quick Search */}
              <div className="relative w-44 max-w-full">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search logs..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-border bg-background focus:ring-1 focus:ring-primary outline-none"
                />
              </div>

            </>
          )}

          <div className="flex items-center gap-2">
            {subTab === "logs" && (
              <button
                onClick={handleClear}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-border text-rose-500 hover:bg-rose-500/10 transition-colors"
                title="Clear all logs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear Logs
              </button>
            )}

            {subTab === "pending" && (
              <button
                onClick={async () => {
                  await onSweepPending();
                  await onRefresh();
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-border hover:bg-muted transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Sweep Expired
              </button>
            )}

            <button
              onClick={() => onRefresh()}
              className="flex items-center justify-center p-2 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* View 1: Event Logs */}
      {subTab === "logs" && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Level</th>
                  <th className="py-3 px-4">Event Type</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Message</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">
                      No logs matching selected filters
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => {
                    const isError = log.level === "error" || log.status === "error";
                    const isWarn = log.level === "warn";

                    return (
                      <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-4 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                          {new Date(log.ts).toLocaleString([], {
                            month: "short",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              isError
                                ? "bg-rose-500/10 text-rose-500"
                                : isWarn
                                ? "bg-amber-500/10 text-amber-500"
                                : "bg-emerald-500/10 text-emerald-500"
                            }`}
                          >
                            {log.level}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-foreground whitespace-nowrap">
                          {log.type}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {log.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-foreground font-medium max-w-md truncate">
                          {log.message}
                        </td>
                        <td className="py-2.5 px-4 text-muted-foreground whitespace-nowrap">
                          {log.actor || "system"}
                        </td>
                        <td className="py-2.5 px-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => setInspectEvent(log)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            title="Inspect JSON Payload"
                          >
                            <Code className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="p-3 border-t border-border flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <div>
              Showing {safeLogs.length} of {totalLogs} events
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage <= 1}
                className="p-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-muted"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-semibold text-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="p-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-muted"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View 2: Pending Follow-Gate DMs */}
      {subTab === "pending" && (
        <div className="space-y-4">
          {safePending.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-card/40">
              <Clock className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
              <h4 className="text-sm font-bold text-foreground">No Pending Follow-Gate Requests</h4>
              <p className="mt-1 text-xs text-muted-foreground">
                When non-followers comment on a gated post, their request is held here until they follow and confirm.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {safePending.map((dm) => {
                const expiresAt = new Date(dm.expire_at).getTime();
                const diffMs = Math.max(0, expiresAt - now);
                const secondsLeft = Math.floor(diffMs / 1000);
                const mins = Math.floor(secondsLeft / 60);
                const secs = secondsLeft % 60;
                const isUrgent = secondsLeft < 120;

                return (
                  <div
                    key={dm.id}
                    className="p-4 rounded-2xl border border-border bg-card hover:border-primary/40 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-1 rounded-xl bg-purple-500/10 text-purple-500 font-bold text-xs">
                          {dm.keyword}
                        </span>
                        <div
                          className={`flex items-center gap-1 font-mono text-xs font-bold ${
                            isUrgent ? "text-rose-500 animate-pulse" : "text-amber-500"
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          {mins}:{secs < 10 ? `0${secs}` : secs} left
                        </div>
                      </div>

                      <div className="mt-3 text-xs">
                        <div className="text-[11px] text-muted-foreground">User / IGSID:</div>
                        <div className="font-mono text-foreground font-semibold">
                          {dm.username ? `@${dm.username}` : dm.igsid_masked}
                        </div>
                      </div>

                      <div className="mt-2 text-xs">
                        <div className="text-[11px] text-muted-foreground">Held Message:</div>
                        <p className="text-foreground text-[11px] line-clamp-2 italic bg-muted/30 p-2 rounded-lg mt-0.5">
                          "{dm.message}"
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs">
                      <span className="text-[10px] text-muted-foreground">
                        TTL: {dm.ttl_minutes} mins
                      </span>
                      <button
                        onClick={() => onDismissPendingDm(dm.id)}
                        className="text-[11px] text-rose-500 hover:underline font-semibold"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Inspect Event Modal / Drawer */}
      {inspectEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-xl max-h-[85vh] flex flex-col bg-card border border-border rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Event Payload Inspector</h3>
              </div>
              <button
                onClick={() => setInspectEvent(null)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-mono">ID: {inspectEvent.id}</span>
              <button
                onClick={() => handleCopyJson(inspectEvent)}
                className="flex items-center gap-1 text-primary hover:underline font-semibold"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied" : "Copy JSON"}
              </button>
            </div>

            <pre className="mt-3 flex-1 overflow-y-auto p-4 rounded-xl bg-muted/60 border border-border font-mono text-xs text-foreground whitespace-pre-wrap">
              {JSON.stringify(inspectEvent, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
