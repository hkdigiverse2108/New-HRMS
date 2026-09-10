import React, { useState } from "react";
import { 
  Award, Plus, Calendar, Settings, Sparkles, ArrowUpDown, UserPlus, Play, Edit3, Save, Trash2 
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const MOCK_MEETINGS = [
  { id: "1", date: "24-08-2025", participants: 8 },
  { id: "2", date: "17-08-2025", participants: 8 },
  { id: "3", date: "10-08-2025", participants: 7 },
];

const MOCK_TOPICS = [
  { id: "t1", name: "Update Round", maxMarks: 20 },
  { id: "t2", name: "Focus Tasking", maxMarks: 20 },
  { id: "t3", name: "Challenge Discussion", maxMarks: 20 },
  { id: "t4", name: "English Speak", maxMarks: 10 },
  { id: "t5", name: "Innovation", maxMarks: 30 },
];

const MOCK_PARTICIPANTS = [
  { id: "p1", name: "Alice Johnson", dept: "Engineering", role: "Team Leader", marks: { t1: 18, t2: 15, t3: 20, t4: 8, t5: 25 }, focus: "Refactor API", commit: "Complete by Friday" },
  { id: "p2", name: "Bob Smith", dept: "Sales", role: "Team Leader", marks: { t1: 19, t2: 18, t3: 15, t4: 7, t5: 20 }, focus: "Close Q3 deals", commit: "Meet quota" },
  { id: "p3", name: "Charlie Davis", dept: "Marketing", role: "Team Leader", marks: { t1: 20, t2: 19, t3: 18, t4: 9, t5: 28 }, focus: "Launch campaign", commit: "Finish assets" },
];

export function TeamLeaderOfWeek() {
  const [selectedMeetingId, setSelectedMeetingId] = useState("1");
  const [viewMode, setViewMode] = useState<"grouped" | "flat">("flat");
  const [sortBy, setSortBy] = useState<"total" | "name">("total");

  const totalMaxMarks = MOCK_TOPICS.reduce((sum, t) => sum + t.maxMarks, 0);

  const sortedParticipants = [...MOCK_PARTICIPANTS].sort((a, b) => {
    if (sortBy === "total") {
      const totalA = Object.values(a.marks).reduce((sum, val) => sum + val, 0);
      const totalB = Object.values(b.marks).reduce((sum, val) => sum + val, 0);
      return totalB - totalA; // descending
    } else {
      return a.name.localeCompare(b.name);
    }
  });

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-card p-6 rounded-2xl shadow-sm border border-border/60">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-tr from-blue-600 to-indigo-500 text-white rounded-xl shadow-md shadow-blue-500/20 shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">Team Leader of the Week</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">TL Meeting points evaluation & dynamic weekly performance tracker</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-amber-950 font-black text-sm rounded-xl shadow-lg shadow-amber-500/20 transition-all hover:shadow-amber-500/40 uppercase tracking-wide">
            <Sparkles className="w-4 h-4 fill-amber-950" />
            Declare Team Result
          </button>

          <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-slate-100 text-amber-400 dark:text-amber-600 text-sm font-bold rounded-xl border border-amber-500/40 hover:opacity-90 transition-all">
            <Play className="w-4 h-4" />
            Auditorium Reveal
          </button>

          <button className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted/80 text-foreground text-sm font-semibold rounded-xl transition-all border border-border">
            <Settings className="w-4 h-4 text-muted-foreground" />
            Master Topics Template
          </button>

          <button className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold rounded-xl shadow-md transition-all">
            <Plus className="w-4 h-4" />
            New Weekly Meeting
          </button>
        </div>
      </div>

      {/* Horizontal Date Blocks Bar */}
      <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {MOCK_MEETINGS.map((m) => (
          <button
            key={m.id}
            onClick={() => setSelectedMeetingId(m.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-sm transition-all whitespace-nowrap border shadow-sm",
              selectedMeetingId === m.id
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-foreground hover:bg-muted border-border/60"
            )}
          >
            <Calendar className="w-4 h-4 opacity-80" />
            <span>{m.date}</span>
            <Badge variant={selectedMeetingId === m.id ? "secondary" : "outline"} className="ml-1 text-[10px]">
              {m.participants} Participants
            </Badge>
          </button>
        ))}
      </div>

      {/* Transposed Evaluation Sheet Matrix */}
      <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              TL Meeting Evaluation (24-08-2025)
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Total Max Score: <span className="font-bold text-blue-600 dark:text-blue-400">{totalMaxMarks} pts</span> across {MOCK_TOPICS.length} evaluation topics. (3 Participants)
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode Segmented Control */}
            <div className="flex items-center p-1 bg-muted rounded-xl text-xs font-bold border border-border">
              <button
                onClick={() => setViewMode("grouped")}
                className={cn(
                  "px-3 py-1.5 rounded-lg transition-all",
                  viewMode === "grouped" ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                🏢 Grouped by Team
              </button>
              <button
                onClick={() => setViewMode("flat")}
                className={cn(
                  "px-3 py-1.5 rounded-lg transition-all",
                  viewMode === "flat" ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                📋 Flat List
              </button>
            </div>

            <button
              onClick={() => setSortBy(prev => prev === "total" ? "name" : "total")}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground border border-border text-xs font-bold rounded-xl transition-all"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              Sort: {sortBy === "total" ? "Highest Score" : "Name A-Z"}
            </button>

            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-xl transition-colors border border-indigo-500/20">
              <UserPlus className="w-3.5 h-3.5" />
              Edit Participants (3)
            </button>

            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold rounded-xl transition-colors border border-border">
              <Edit3 className="w-3.5 h-3.5" />
              Configure Topics
            </button>

            <button className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>

            <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all">
              <Save className="w-4 h-4" />
              Save Marks & Notes
            </button>
          </div>
        </div>

        {/* Sticky Table Container */}
        <div className="overflow-auto max-h-[60vh] rounded-xl border border-border relative">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="sticky top-0 z-30 bg-muted/80 backdrop-blur-sm border-b border-border text-muted-foreground font-bold uppercase tracking-wider text-[11px]">
                <th className="sticky top-0 left-0 z-40 bg-muted/90 px-3 py-4 w-[40px] text-center border-r border-border">#</th>
                <th className="sticky top-0 left-[40px] z-40 bg-muted/90 px-4 py-4 min-w-[200px] border-r border-border">Employee</th>
                
                {MOCK_TOPICS.map(t => (
                  <th key={t.id} className="py-4 px-3 text-center min-w-[140px] border-r border-border/50">
                    <div>{t.name}</div>
                    <span className="text-[10px] text-blue-500 lowercase">(max {t.maxMarks} pts)</span>
                  </th>
                ))}
                
                <th className="py-4 px-4 text-center min-w-[100px] bg-emerald-500/10 border-r border-border/50 text-emerald-600 font-black">
                  TOTAL SUM
                </th>
                <th className="py-4 px-4 min-w-[200px] border-r border-border/50">Focus Tasking Note</th>
                <th className="py-4 px-4 min-w-[200px] border-r border-border/50">Commitment Note</th>
                <th className="py-4 px-4 min-w-[100px] text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 font-medium text-foreground">
              {sortedParticipants.map((p, idx) => {
                const total = Object.values(p.marks).reduce((a, b) => a + b, 0);
                return (
                  <tr key={p.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="sticky left-0 bg-background group-hover:bg-muted/50 px-3 py-3 text-center text-muted-foreground border-r border-border">{idx + 1}</td>
                    <td className="sticky left-[40px] bg-background group-hover:bg-muted/50 px-4 py-3 border-r border-border">
                      <div className="font-bold text-sm">{p.name}</div>
                      <div className="flex gap-1 mt-1">
                        <Badge variant="outline" className="text-[9px] h-4 px-1 rounded bg-muted">{p.dept}</Badge>
                        <Badge variant="secondary" className="text-[9px] h-4 px-1 rounded bg-blue-500/10 text-blue-600 border-none">{p.role}</Badge>
                      </div>
                    </td>
                    
                    {MOCK_TOPICS.map(t => (
                      <td key={t.id} className="py-3 px-3 border-r border-border/50">
                        <input
                          type="number"
                          className="w-full text-center p-1.5 bg-muted/50 border border-transparent rounded focus:bg-background focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                          value={p.marks[t.id as keyof typeof p.marks]}
                          readOnly
                        />
                      </td>
                    ))}

                    <td className="py-3 px-4 text-center bg-emerald-500/5 font-black text-emerald-600 border-r border-border/50 text-lg">
                      {total}
                    </td>

                    <td className="py-3 px-4 border-r border-border/50">
                      <textarea
                        className="w-full text-xs p-2 bg-muted/50 border border-transparent rounded focus:bg-background focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none transition-all"
                        rows={2}
                        value={p.focus}
                        readOnly
                      />
                    </td>
                    <td className="py-3 px-4 border-r border-border/50">
                      <textarea
                        className="w-full text-xs p-2 bg-muted/50 border border-transparent rounded focus:bg-background focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none transition-all"
                        rows={2}
                        value={p.commit}
                        readOnly
                      />
                    </td>
                    
                    <td className="py-3 px-4 text-center">
                      <button className="flex items-center gap-1 mx-auto px-2 py-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground rounded text-xs font-bold transition-colors">
                        <Save className="w-3.5 h-3.5" />
                        Save
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
