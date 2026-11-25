import React, { useState, useEffect, useCallback } from "react";
import { Users, X, Search, RefreshCw, Clock, Coffee } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { getAvatarUrl, handleAvatarError } from "@/lib/config";

interface PulseMember {
  id: string;
  name: string;
  avatar?: string;
  department?: string;
  designation?: string;
  punch_in?: string;
  punch_out?: string;
  break_in?: string;
  leave_type?: string;
  on_leave?: boolean;
}

interface TeamPulseData {
  date: string;
  counts: {
    active: number;
    on_break: number;
    half_day: number;
    punched_out: number;
    absent_or_leave: number;
    total: number;
  };
  active: PulseMember[];
  on_break: PulseMember[];
  half_day: PulseMember[];
  punched_out: PulseMember[];
  absent_or_leave: PulseMember[];
}

type PulseTab = "active" | "on_break" | "absent_or_leave" | "half_day" | "punched_out";

export const TeamPulseBar: React.FC = () => {
  const [pulse, setPulse] = useState<TeamPulseData | null>(null);
  const [loading, setLoading] = useState(false);
  const [modalTab, setModalTab] = useState<PulseTab | null>(null);
  const [search, setSearch] = useState("");

  const fetchPulse = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<TeamPulseData>("/dashboard/team-pulse", { showLoader: false });
      setPulse(res);
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPulse();
    const timer = setInterval(fetchPulse, 60000);
    return () => clearInterval(timer);
  }, [fetchPulse]);

  if (!pulse) return null;

  const pills: { key: PulseTab; label: string; count: number; dot: string; cls: string }[] = [
    {
      key: "active",
      label: "Active (Punched In)",
      count: pulse.counts.active,
      dot: "bg-emerald-500",
      cls: "bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25"
    },
    {
      key: "on_break",
      label: "On Break",
      count: pulse.counts.on_break,
      dot: "bg-amber-500",
      cls: "bg-amber-500/10 hover:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/25"
    },
    {
      key: "absent_or_leave",
      label: "Absent / Leave",
      count: pulse.counts.absent_or_leave,
      dot: "bg-rose-500",
      cls: "bg-rose-500/10 hover:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/25"
    },
    {
      key: "half_day",
      label: "Half Day",
      count: pulse.counts.half_day,
      dot: "bg-purple-500",
      cls: "bg-purple-500/10 hover:bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/25"
    },
    {
      key: "punched_out",
      label: "Punched Out",
      count: pulse.counts.punched_out,
      dot: "bg-slate-400",
      cls: "bg-slate-500/10 hover:bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/25"
    },
  ];

  const activeList = modalTab ? (pulse[modalTab] || []) : [];
  const filteredList = activeList.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    (m.department || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="mb-6 bg-card border border-border/60 rounded-2xl px-4 py-3 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-foreground">
              Live Team Pulse — Who's In Office
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Click any status pill to view live team members ({pulse.counts.total} total)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {pills.map(p => (
            <button
              key={p.key}
              type="button"
              onClick={() => {
                setSearch("");
                setModalTab(p.key);
              }}
              className={cn(
                "px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer",
                p.cls
              )}
            >
              <span className={cn("w-2 h-2 rounded-full", p.dot, p.key === "active" && "animate-pulse")} />
              <span className="font-black">{p.count}</span>
              <span className="hidden sm:inline">{p.label}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={fetchPulse}
            className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
            title="Refresh live pulse"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Team Pulse Detail Modal */}
      {modalTab && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setModalTab(null)} />
          <div className="relative w-full max-w-xl max-h-[85vh] bg-card border border-border/80 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-muted/20">
              <div>
                <h3 className="text-base font-black text-foreground">Live Team Status ({pulse.date})</h3>
                <p className="text-xs text-muted-foreground">Real-time attendance & break breakdown</p>
              </div>
              <button
                type="button"
                onClick={() => setModalTab(null)}
                className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 py-3 border-b border-border/50 space-y-2.5 bg-muted/10">
              <div className="flex flex-wrap gap-1.5">
                {pills.map(p => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setModalTab(p.key)}
                    className={cn(
                      "px-2.5 py-1 rounded-xl text-xs font-bold border flex items-center gap-1.5 cursor-pointer",
                      modalTab === p.key ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border/60 text-muted-foreground"
                    )}
                  >
                    <span className={cn("w-2 h-2 rounded-full", p.dot)} />
                    <span>{p.label.split(" ")[0]} ({p.count})</span>
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search member or department..."
                  className="w-full pl-8 pr-3 py-1.5 bg-background border border-border/60 rounded-xl text-xs focus:outline-none"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {filteredList.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground py-10">No team members in this status.</p>
              ) : (
                filteredList.map(m => (
                  <div key={m.id} className="p-3 rounded-2xl bg-background border border-border/50 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={getAvatarUrl(m.avatar, m.name)}
                        onError={(e) => handleAvatarError(e)}
                        alt={m.name}
                        className="w-9 h-9 rounded-full object-cover border border-border/60 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">{m.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {[m.department, m.designation].filter(Boolean).join(" • ") || "Team Member"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 text-[11px] font-mono">
                      {m.punch_in && (
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" /> In: {m.punch_in.slice(0, 5)}
                        </span>
                      )}
                      {m.break_in && (
                        <span className="ml-1 px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold inline-flex items-center gap-1">
                          <Coffee className="w-3 h-3" /> Break: {m.break_in.slice(0, 5)}
                        </span>
                      )}
                      {m.leave_type && (
                        <span className={cn(
                          "px-2 py-0.5 rounded-lg font-bold",
                          m.on_leave ? "bg-rose-500/10 text-rose-600" : "bg-muted text-muted-foreground"
                        )}>
                          {m.leave_type}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
