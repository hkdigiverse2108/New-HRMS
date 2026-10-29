import { useState, useMemo, useEffect, useCallback } from "react";
import { usePersistentState } from "@/hooks/usePersistentState";
import { Clock, FileText, ScrollText, ChevronDown, ChevronUp, Calendar, Users, Activity, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { cn, formatDate } from "@/lib/utils";
import { api } from "@/lib/api";
import { getAvatarUrl, handleAvatarError } from "@/lib/config";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableHeader } from "@/components/ui/sortable-header";
import { DateRangeFilter } from "@/components/common/DateRangeFilter";
import { SearchInput } from "@/components/common/SearchInput";
import { useIsMobile } from "@/hooks/use-mobile";

/** One task segment: from punch-in / Change Active Task until the next task, punch-out or now. */
type WorkLog = {
  id: string;
  employee_id: string;
  employee: string;
  avatar: string;
  department: string;
  date: string;
  project: string;
  task: string;
  type: string;
  start: string;
  end: string;
  seconds: number;
  hours: number;
  in_progress: boolean;
};

interface TimelineResponse {
  can_view_all: boolean;
  start: string;
  end: string;
  logs: WorkLog[];
  summary: { total_seconds: number; entries: number; employees: number; active_now: number };
}

const TYPE_STYLE: Record<string, string> = {
  "Today's Work": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Upcoming Work": "bg-sky-50 text-sky-700 border-sky-200",
  Research: "bg-violet-50 text-violet-700 border-violet-200",
  Activity: "bg-amber-50 text-amber-700 border-amber-200",
  Meeting: "bg-rose-50 text-rose-700 border-rose-200",
};

const fmtDuration = (seconds: number) => {
  const m = Math.round(seconds / 60);
  const h = Math.floor(m / 60);
  return h ? `${h}h ${m % 60}m` : `${m}m`;
};

const REFRESH_MS = 60_000; // keeps the running task's time live

export function WorkLogs() {
  const isMobile = useIsMobile();
  const [data, setData] = useState<TimelineResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = usePersistentState<"all" | "employee">("workLogs.view", "all");
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);

  const start = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : "";
  const end = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : start;

  const load = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const q = new URLSearchParams();
      if (start) q.set("start_date", start);
      if (end) q.set("end_date", end);
      setData(await api.get<TimelineResponse>(`/work-logs/timeline?${q}`, { showLoader: false }));
    } catch {
      if (!silent) setData(null);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [start, end]);

  useEffect(() => {
    load();
    const timer = setInterval(() => load(true), REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const isAdminOrHR = Boolean(data?.can_view_all);

  const filteredLogs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return (data?.logs ?? []).filter(log =>
      !q ||
      log.employee.toLowerCase().includes(q) ||
      log.project.toLowerCase().includes(q) ||
      log.task.toLowerCase().includes(q) ||
      log.type.toLowerCase().includes(q)
    );
  }, [data, searchQuery]);

  const { items: sortedLogs, requestSort, sortConfig } = useSortableData(filteredLogs);

  const employeeWiseGroups = useMemo(() => {
    const groups: Record<string, { name: string; avatar: string; logs: WorkLog[]; totalSeconds: number }> = {};
    filteredLogs.forEach(log => {
      const g = (groups[log.employee_id] ??= { name: log.employee, avatar: log.avatar, logs: [], totalSeconds: 0 });
      g.logs.push(log);
      g.totalSeconds += log.seconds;
    });
    return groups;
  }, [filteredLogs]);

  const totalSeconds = filteredLogs.reduce((sum, log) => sum + log.seconds, 0);
  const activeNow = new Set(filteredLogs.filter(l => l.in_progress).map(l => l.employee_id)).size;
  const employeeCount = new Set(filteredLogs.map(l => l.employee_id)).size;
  const rangeLabel = data ? `${formatDate(data.start)} – ${formatDate(data.end)}` : "";

  const typeBadge = (type: string) => (
    <span className={cn("px-2 py-0.5 rounded-lg border text-[10px] font-bold", TYPE_STYLE[type] ?? "bg-muted text-muted-foreground border-border")}>
      {type}
    </span>
  );

  const timeLine = (log: WorkLog) => (
    <div className="text-[10px] font-bold text-muted-foreground flex items-center gap-1 mt-0.5">
      <span>🕒 {log.start} to {log.end}</span>
      <span className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">({fmtDuration(log.seconds)})</span>
      {log.in_progress && (
        <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-emerald-700">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
        </span>
      )}
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
            {isAdminOrHR ? "All Employees Work Logs" : "My Work Logs"}
          </h1>
          <p className="text-xs text-muted-foreground mt-1 font-semibold">
            {isAdminOrHR
              ? "What everyone worked on — from punch-in and Change Active Task, with time"
              : "Your tasks and time — from punch-in and Change Active Task"}
            {rangeLabel && ` · ${rangeLabel}`}
          </p>
        </div>

        <div className="flex flex-row items-center gap-2 sm:gap-3 w-full xl:w-auto xl:shrink-0">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={isMobile ? "Search..." : isAdminOrHR ? "Search employee, project or task..." : "Search project or task..."}
            className="h-10 py-0 bg-white border-border/70"
            containerClassName="flex-1 min-w-0 sm:max-w-md xl:flex-none xl:w-72"
          />
          <DateRangeFilter value={dateRange} onChange={setDateRange} placeholder={isMobile ? "Date range" : "Pick a date range"} className="h-10 py-0 shrink-0 max-w-[55%] sm:max-w-none sm:w-auto" />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card p-5 rounded-3xl border border-border/50 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-muted-foreground mb-1 uppercase tracking-wide">Total Hours Logged</p>
            <p className="text-3xl font-black text-foreground">{fmtDuration(totalSeconds)}</p>
          </div>
          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20">
            <Clock className="w-6 h-6 text-primary" />
          </div>
        </div>
        <div className="bg-card p-5 rounded-3xl border border-border/50 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-muted-foreground mb-1 uppercase tracking-wide">Working Right Now</p>
            <p className="text-3xl font-black text-amber-600">{activeNow}</p>
          </div>
          <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20">
            <Activity className="w-6 h-6 text-amber-600" />
          </div>
        </div>
        <div className="bg-card p-5 rounded-3xl border border-border/50 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-muted-foreground mb-1 uppercase tracking-wide">
              {isAdminOrHR ? "Employees" : "Task Entries"}
            </p>
            <p className="text-3xl font-black text-emerald-600">{isAdminOrHR ? employeeCount : filteredLogs.length}</p>
          </div>
          <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20">
            <Users className="w-6 h-6 text-emerald-600" />
          </div>
        </div>
      </div>

      {isAdminOrHR && (
        <div className="flex gap-1 bg-muted/40 p-1 rounded-2xl border border-border/30 w-fit">
          {(["all", "employee"] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={cn(
                "px-4 py-2 text-xs font-bold rounded-xl transition-all",
                viewMode === mode ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {mode === "all" ? "📋 All Employees Timeline" : "👥 Employee-wise Summary"}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="py-20 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin inline-block" /></div>
      ) : viewMode === "all" || !isAdminOrHR ? (
        <div className="bg-card rounded-[2.5rem] border border-border/50 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] whitespace-nowrap text-left border-collapse">
              <thead className="bg-muted/30 border-b border-border/50">
                <tr>
                  {isAdminOrHR && (
                    <SortableHeader label="Employee" sortKey="employee" currentSort={sortConfig} onSort={requestSort} className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider" />
                  )}
                  <SortableHeader label="Date & Timeline" sortKey="date" currentSort={sortConfig} onSort={requestSort} className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider" />
                  <SortableHeader label="Project / Task" sortKey="task" currentSort={sortConfig} onSort={requestSort} className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider" />
                  <SortableHeader label="Type" sortKey="type" currentSort={sortConfig} onSort={requestSort} className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider" />
                  <SortableHeader label="Time Spent" sortKey="seconds" currentSort={sortConfig} onSort={requestSort} className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedLogs.map(log => (
                  <tr key={log.id} className={cn("hover:bg-muted/20 transition-colors", log.in_progress && "bg-emerald-50/40")}>
                    {isAdminOrHR && (
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={getAvatarUrl(log.avatar, log.employee)}
                            onError={handleAvatarError}
                            alt={log.employee}
                            className="w-9 h-9 rounded-full object-cover border-2 border-background shadow-sm"
                          />
                          <div>
                            <div className="font-bold text-foreground text-xs">{log.employee}</div>
                            {log.department && <div className="text-[10px] text-muted-foreground">{log.department}</div>}
                          </div>
                        </div>
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <div className="text-xs font-bold text-foreground">{formatDate(log.date)}</div>
                      {timeLine(log)}
                    </td>
                    <td className="px-6 py-4 max-w-[340px]">
                      <div className="text-xs font-black text-primary truncate">{log.project || "Independent task"}</div>
                      <div className="text-[10px] font-bold text-muted-foreground flex items-center gap-1 mt-0.5 min-w-0">
                        <FileText className="w-3 h-3 shrink-0 text-muted-foreground/60" />
                        <span className="truncate whitespace-normal line-clamp-1" title={log.task}>{log.task}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">{typeBadge(log.type)}</td>
                    <td className="px-6 py-4 text-xs font-bold text-foreground">{fmtDuration(log.seconds)}</td>
                  </tr>
                ))}

                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
                        <ScrollText className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <h3 className="text-sm font-bold text-foreground">No work logged</h3>
                      <p className="text-xs text-muted-foreground mt-1">Tasks picked at punch-in or in Change Active Task appear here with their time.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {Object.entries(employeeWiseGroups).map(([id, group]) => {
            const isExpanded = expandedEmployee === id;
            return (
              <div key={id} className="bg-card border border-border/50 rounded-[2rem] overflow-hidden transition-all shadow-sm">
                <div
                  onClick={() => setExpandedEmployee(isExpanded ? null : id)}
                  className="p-5 flex items-center justify-between cursor-pointer hover:bg-muted/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={getAvatarUrl(group.avatar, group.name)}
                      onError={handleAvatarError}
                      alt={group.name}
                      className="w-10 h-10 rounded-full object-cover border-2 border-background shadow-md"
                    />
                    <div>
                      <h3 className="text-sm font-bold text-foreground">{group.name}</h3>
                      <p className="text-xs text-muted-foreground font-semibold mt-0.5">{group.logs.length} task entries</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {group.logs.some(l => l.in_progress) && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Working now
                      </span>
                    )}
                    <span className="px-3 py-1 bg-primary/10 border border-primary/20 text-primary rounded-xl font-bold text-xs">
                      ⏱️ {fmtDuration(group.totalSeconds)}
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-border/40 bg-muted/5 p-6 space-y-3">
                    {group.logs.map(log => (
                      <div key={log.id} className="bg-card p-4 rounded-2xl border border-border/40 shadow-sm flex flex-col md:flex-row justify-between gap-4">
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-black bg-primary/10 text-primary px-2 py-0.5 rounded-lg">{log.project || "Independent task"}</span>
                            {typeBadge(log.type)}
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
                              <Calendar className="w-3 h-3" /> {formatDate(log.date)}
                            </span>
                          </div>
                          <p className="text-xs text-foreground font-semibold leading-relaxed">{log.task}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs font-extrabold text-foreground">🕒 {log.start} to {log.end}</div>
                          <div className="text-[10px] text-muted-foreground font-bold font-mono mt-0.5">
                            {fmtDuration(log.seconds)}{log.in_progress ? " · live" : ""}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {Object.keys(employeeWiseGroups).length === 0 && (
            <div className="p-12 text-center bg-card border border-border/50 rounded-[2rem]">
              <ScrollText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-sm font-bold text-foreground">No work logged</h3>
              <p className="text-xs text-muted-foreground mt-1">Pick a different date range.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
