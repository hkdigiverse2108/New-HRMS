import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Users,
  AlertTriangle,
  CheckCircle2,
  Flame,
  Calendar,
  Briefcase,
  Layers,
  Filter
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { getAvatarUrl, handleAvatarError } from "@/lib/config";

interface TeamWorkloadHeatmapProps {
  isOpen: boolean;
  onClose: () => void;
  projects: any[];
  employees: any[];
  selectedProjectId?: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  scripting: "Scripting",
  shoot_videography: "Shoot",
  reel_editing: "Reel Editing",
  post_graphics: "Graphics",
  thumbnail: "Thumbnail",
  caption: "Caption",
  posting_publisher: "Posting",
  approval_qc: "Approval / QC",
  cc_creator: "CC Creator"
};

const toDateStr = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const getMondayOfWeek = (base: Date): Date => {
  const d = new Date(base);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const TeamWorkloadHeatmap: React.FC<TeamWorkloadHeatmapProps> = ({
  isOpen,
  onClose,
  projects,
  employees,
  selectedProjectId
}) => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [scope, setScope] = useState<"all" | "project">("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [weekOffset, setWeekOffset] = useState(0);
  const [weeklyCapacityLimit, setWeeklyCapacityLimit] = useState(5);
  const [selectedCell, setSelectedCell] = useState<{ empId: string; empName: string; dateStr?: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let mounted = true;
    const fetchAllTasks = async () => {
      setLoading(true);
      try {
        const res = await api.get<any>("/tasks?limit=500", { showLoader: false });
        const list = Array.isArray(res) ? res : (res?.data || []);
        if (mounted) {
          setTasks(list.filter((t: any) => !t.is_deleted));
        }
      } catch (err) {
        console.error("Failed to fetch tasks for workload heatmap:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchAllTasks();
    return () => {
      mounted = false;
    };
  }, [isOpen]);

  const weekDays = useMemo(() => {
    const today = new Date();
    const monday = getMondayOfWeek(today);
    monday.setDate(monday.getDate() + weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return {
        dateStr: toDateStr(d),
        dayName: d.toLocaleDateString("en-US", { weekday: "short" }),
        dayNum: d.getDate(),
        monthShort: d.toLocaleDateString("en-US", { month: "short" }),
        isToday: toDateStr(d) === toDateStr(new Date()),
        isWeekend: d.getDay() === 0 || d.getDay() === 6
      };
    });
  }, [weekOffset]);

  const weekStartStr = weekDays[0]?.dateStr || "";
  const weekEndStr = weekDays[6]?.dateStr || "";
  const todayStr = toDateStr(new Date());

  // Map project IDs to names
  const projectMap = useMemo(() => {
    const map: Record<string, string> = {};
    projects.forEach(p => {
      map[String(p.id)] = p.name || "Project";
    });
    return map;
  }, [projects]);

  // Filter tasks based on scope & role
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      const st = String(t.status || "").toLowerCase();
      if (st === "completed" || st === "done" || st === "cancelled") return false;
      if (scope === "project" && selectedProjectId && String(t.project_id) !== String(selectedProjectId)) {
        return false;
      }
      if (roleFilter !== "all" && t.creative_role !== roleFilter) {
        return false;
      }
      return true;
    });
  }, [tasks, scope, selectedProjectId, roleFilter]);

  // Build per-employee workload summary
  const employeeWorkloads = useMemo(() => {
    // Collect all relevant employee IDs (from creative teams + tasks)
    const empMap: Record<string, any> = {};
    employees.forEach(e => {
      const eid = String(e.id || e._id);
      empMap[eid] = e;
    });

    const memberIds = new Set<string>();
    // Add creative team members from active projects
    projects.forEach(p => {
      if (p.is_archived) return;
      if (scope === "project" && selectedProjectId && String(p.id) !== String(selectedProjectId)) return;
      if (p.creativeTeam) {
        Object.values(p.creativeTeam).forEach((val: any) => {
          if (typeof val === "string" && val.trim() && empMap[val.trim()]) {
            memberIds.add(val.trim());
          } else if (Array.isArray(val)) {
            val.forEach(v => {
              if (typeof v === "string" && v.trim() && empMap[v.trim()]) {
                memberIds.add(v.trim());
              }
            });
          }
        });
      }
    });

    // Also include anyone with active assigned tasks
    filteredTasks.forEach(t => {
      const aid = String(t.assigned_to || "").trim();
      if (aid && empMap[aid]) {
        memberIds.add(aid);
      }
    });

    const rows = Array.from(memberIds).map(empId => {
      const emp = empMap[empId];
      const empName = emp?.name || emp?.full_name || "Team Member";
      const designation = emp?.designation || emp?.role || "Creative";
      const empTasks = filteredTasks.filter(t => String(t.assigned_to) === empId);

      const tasksInWeek = empTasks.filter(t => {
        const due = String(t.due_date || "").split("T")[0] || "";
        return due >= weekStartStr && due <= weekEndStr;
      });

      const overdueTasks = empTasks.filter(t => {
        const due = String(t.due_date || "").split("T")[0] || "";
        return due && due < todayStr;
      });

      const byDay: Record<string, any[]> = {};
      weekDays.forEach(wd => {
        byDay[wd.dateStr] = empTasks.filter(t => {
          const due = String(t.due_date || "").split("T")[0] || "";
          return due === wd.dateStr;
        });
      });

      const rolesSet = new Set<string>();
      empTasks.forEach(t => {
        const label = t.creative_role ? ROLE_LABELS[t.creative_role] : undefined;
        if (label) {
          rolesSet.add(label);
        }
      });

      const weekCount = tasksInWeek.length;
      const capacityPct = Math.min(100, Math.round((weekCount / Math.max(1, weeklyCapacityLimit)) * 100));

      return {
        empId,
        emp,
        empName,
        designation,
        roles: Array.from(rolesSet),
        totalPending: empTasks.length,
        weekCount,
        overdueCount: overdueTasks.length,
        capacityPct,
        byDay,
        allTasks: empTasks
      };
    });

    // Sort highest workload first
    return rows.sort((a, b) => b.weekCount - a.weekCount || b.totalPending - a.totalPending);
  }, [employees, projects, filteredTasks, weekDays, weekStartStr, weekEndStr, todayStr, weeklyCapacityLimit, scope, selectedProjectId]);

  const stats = useMemo(() => {
    const overloaded = employeeWorkloads.filter(r => r.capacityPct >= 80).length;
    const available = employeeWorkloads.filter(r => r.capacityPct <= 40).length;
    const totalWeekTasks = employeeWorkloads.reduce((acc, r) => acc + r.weekCount, 0);
    return {
      totalMembers: employeeWorkloads.length,
      overloaded,
      available,
      totalWeekTasks
    };
  }, [employeeWorkloads]);

  const selectedTasksList = useMemo(() => {
    if (!selectedCell) return [];
    const row = employeeWorkloads.find(r => r.empId === selectedCell.empId);
    if (!row) return [];
    if (selectedCell.dateStr) {
      return row.byDay[selectedCell.dateStr] || [];
    }
    return row.allTasks;
  }, [selectedCell, employeeWorkloads]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-xs" onClick={onClose} />
      <div className="relative w-full max-w-6xl max-h-[92vh] bg-card border border-border/80 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-foreground tracking-tight">
                Team Workload & Capacity Heatmap
              </h2>
              <p className="text-xs text-muted-foreground">
                Balance creative deliverables across editors, writers, designers & shooters
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Scope Toggle */}
            <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-xl border border-border/50 text-xs">
              <button
                type="button"
                onClick={() => setScope("all")}
                className={cn(
                  "px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer",
                  scope === "all" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                )}
              >
                All Agency Projects
              </button>
              {selectedProjectId && (
                <button
                  type="button"
                  onClick={() => setScope("project")}
                  className={cn(
                    "px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer",
                    scope === "project" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Current Project
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Summary KPI Strip & Controls */}
        <div className="px-6 py-3.5 border-b border-border/50 bg-muted/10 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="px-3 py-2 rounded-2xl bg-background border border-border/60">
              <span className="text-[10px] font-bold uppercase text-muted-foreground block">Active Members</span>
              <span className="text-base font-black text-foreground">{stats.totalMembers}</span>
            </div>
            <div className="px-3 py-2 rounded-2xl bg-background border border-border/60">
              <span className="text-[10px] font-bold uppercase text-muted-foreground block">Due This Week</span>
              <span className="text-base font-black text-indigo-600">{stats.totalWeekTasks} tasks</span>
            </div>
            <div className="px-3 py-2 rounded-2xl bg-rose-500/10 border border-rose-500/20">
              <span className="text-[10px] font-bold uppercase text-rose-600 flex items-center gap-1">
                <Flame className="w-3 h-3" /> Overloaded (&ge;80%)
              </span>
              <span className="text-base font-black text-rose-600">{stats.overloaded}</span>
            </div>
            <div className="px-3 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-[10px] font-bold uppercase text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Available (&le;40%)
              </span>
              <span className="text-base font-black text-emerald-600">{stats.available}</span>
            </div>
          </div>

          {/* Week Nav & Role Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-background border border-border/60 rounded-xl px-2.5 py-1.5 text-xs">
              <Filter className="w-3.5 h-3.5 text-muted-foreground" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="bg-transparent font-bold text-foreground focus:outline-none cursor-pointer"
              >
                <option value="all">All Roles</option>
                {Object.entries(ROLE_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-background border border-border/60 rounded-xl px-2.5 py-1.5 text-xs">
              <span className="text-muted-foreground font-semibold">Limit/Wk:</span>
              <input
                type="number"
                min={1}
                max={25}
                value={weeklyCapacityLimit}
                onChange={(e) => setWeeklyCapacityLimit(Math.max(1, Number(e.target.value) || 5))}
                className="w-10 text-center font-black bg-muted/50 rounded-md py-0.5 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setWeekOffset(w => w - 1)}
                className="p-1.5 rounded-xl bg-background border border-border/60 hover:bg-muted cursor-pointer"
                title="Previous Week"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setWeekOffset(0)}
                className="px-3 py-1.5 rounded-xl bg-background border border-border/60 hover:bg-muted text-xs font-bold cursor-pointer"
              >
                {weekOffset === 0 ? "This Week" : `${weekDays[0]?.dayNum} ${weekDays[0]?.monthShort} - ${weekDays[6]?.dayNum} ${weekDays[6]?.monthShort}`}
              </button>
              <button
                type="button"
                onClick={() => setWeekOffset(w => w + 1)}
                className="p-1.5 rounded-xl bg-background border border-border/60 hover:bg-muted cursor-pointer"
                title="Next Week"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Main Heatmap Body */}
        <div className="flex-1 overflow-auto p-6 space-y-4">
          {loading ? (
            <div className="py-16 text-center text-sm font-bold text-muted-foreground">
              Loading agency workload data...
            </div>
          ) : employeeWorkloads.length === 0 ? (
            <div className="py-16 text-center text-sm font-bold text-muted-foreground">
              No assigned creative team members or tasks found for this filter.
            </div>
          ) : (
            <div className="border border-border/60 rounded-2xl overflow-hidden bg-background">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted/40 border-b border-border/60 text-[11px] font-black uppercase text-muted-foreground tracking-wider">
                    <th className="py-3 px-4 min-w-[220px]">Team Member</th>
                    <th className="py-3 px-3 min-w-[140px]">Weekly Load</th>
                    {weekDays.map(wd => (
                      <th
                        key={wd.dateStr}
                        className={cn(
                          "py-2.5 px-2 text-center min-w-[74px]",
                          wd.isToday && "bg-primary/10 text-primary",
                          wd.isWeekend && !wd.isToday && "bg-amber-500/5 text-amber-600/80"
                        )}
                      >
                        <div>{wd.dayName}</div>
                        <div className="text-xs font-black text-foreground">{wd.dayNum} {wd.monthShort}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50 text-xs">
                  {employeeWorkloads.map(row => {
                    const barColor =
                      row.capacityPct >= 80
                        ? "bg-rose-500"
                        : row.capacityPct >= 50
                          ? "bg-amber-500"
                          : "bg-emerald-500";
                    return (
                      <tr key={row.empId} className="hover:bg-muted/20 transition-colors">
                        {/* Member Info */}
                        <td
                          className="py-3 px-4 cursor-pointer"
                          onClick={() => setSelectedCell({ empId: row.empId, empName: row.empName })}
                        >
                          <div className="flex items-center gap-2.5">
                            <img
                              src={getAvatarUrl(row.emp?.avatar, row.empName)}
                              onError={(e) => handleAvatarError(e)}
                              alt={row.empName}
                              className="w-8 h-8 rounded-full object-cover border border-border/60 shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="font-bold text-foreground truncate flex items-center gap-1.5">
                                <span>{row.empName}</span>
                                {row.overdueCount > 0 && (
                                  <span className="px-1.5 py-0.2 rounded-full bg-rose-500/15 text-rose-600 text-[9px] font-black">
                                    {row.overdueCount} overdue
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-muted-foreground truncate">
                                {row.roles.length > 0 ? row.roles.join(" • ") : row.designation}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Capacity Bar */}
                        <td
                          className="py-3 px-3 cursor-pointer"
                          onClick={() => setSelectedCell({ empId: row.empId, empName: row.empName })}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px] font-bold">
                              <span>{row.weekCount} / {weeklyCapacityLimit}</span>
                              <span className={cn(
                                row.capacityPct >= 80 ? "text-rose-600" : row.capacityPct >= 50 ? "text-amber-600" : "text-emerald-600"
                              )}>
                                {row.capacityPct}%
                              </span>
                            </div>
                            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className={cn("h-full rounded-full transition-all", barColor)}
                                style={{ width: `${row.capacityPct}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* 7-Day Heatmap Cells */}
                        {weekDays.map(wd => {
                          const dayTasks = row.byDay[wd.dateStr] || [];
                          const cnt = dayTasks.length;
                          const cellStyle =
                            cnt === 0
                              ? "bg-muted/30 text-muted-foreground/50 border-border/30"
                              : cnt === 1
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-black"
                                : cnt === 2
                                  ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40 font-black"
                                  : "bg-rose-500/25 text-rose-700 dark:text-rose-300 border-rose-500/50 font-black";
                          return (
                            <td key={wd.dateStr} className="py-2 px-1.5 text-center">
                              <button
                                type="button"
                                onClick={() => setSelectedCell({ empId: row.empId, empName: row.empName, dateStr: wd.dateStr })}
                                className={cn(
                                  "w-full h-10 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer hover:scale-105",
                                  cellStyle,
                                  selectedCell?.empId === row.empId && selectedCell?.dateStr === wd.dateStr && "ring-2 ring-primary"
                                )}
                                title={cnt > 0 ? `${cnt} task(s) on ${wd.dateStr}` : "Free / Available"}
                              >
                                <span className="text-xs">{cnt === 0 ? "—" : cnt}</span>
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground pt-1">
            <div className="flex items-center gap-3">
              <span className="font-bold">Heatmap Legend:</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-muted/50 border border-border" /> 0 (Free)</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500/25 border border-emerald-500/40" /> 1 (Light)</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500/25 border border-amber-500/40" /> 2 (Optimal)</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-rose-500/30 border border-rose-500/50" /> 3+ (Heavy / Overloaded)</span>
            </div>
            <span>Click any cell or member row to inspect assigned tasks</span>
          </div>

          {/* Drill-down Drawer for Selected Cell/Member */}
          {selectedCell && (
            <div className="p-4 rounded-2xl bg-muted/30 border border-border/60 space-y-2.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-foreground flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary" />
                  <span>
                    {selectedCell.empName} — {selectedCell.dateStr ? `Tasks on ${selectedCell.dateStr}` : "All Pending Tasks"} ({selectedTasksList.length})
                  </span>
                </h4>
                <button
                  type="button"
                  onClick={() => setSelectedCell(null)}
                  className="text-xs font-bold text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Close
                </button>
              </div>

              {selectedTasksList.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No tasks due on this date — team member is available!</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {selectedTasksList.map((t: any, idx: number) => (
                    <div key={t.id || t._id || idx} className="p-2.5 rounded-xl bg-background border border-border/60 text-xs space-y-1">
                      <div className="font-bold text-foreground line-clamp-1">{t.title}</div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1 truncate">
                          <Briefcase className="w-3 h-3 text-primary shrink-0" />
                          {projectMap[String(t.project_id)] || "Project"}
                        </span>
                        <span className="flex items-center gap-1 shrink-0 font-mono">
                          <Calendar className="w-3 h-3" />
                          {String(t.due_date || "").split("T")[0] || "No date"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
