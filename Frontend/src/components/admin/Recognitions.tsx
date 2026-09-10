import React, { useState } from "react";
import { 
  Trophy, Users, History, Settings, Edit, Play, CheckCircle2, Copy, Check, Plus 
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableHeader } from "@/components/ui/sortable-header";

const MOCK_CRITERIA = [
  { name: "Punctuality", maxScore: 10, isFixed: true, entryType: "direct", category: "+ve" },
  { name: "Team Collaboration", maxScore: 15, isFixed: false, entryType: "multi_admin", category: "+ve" },
  { name: "Client Feedback", maxScore: 20, isFixed: false, entryType: "direct", category: "+ve" },
];

const MOCK_LEADERBOARD = [
  { rank: 1, name: "Alice Johnson", score: 42, department: "Engineering" },
  { rank: 2, name: "Bob Smith", score: 38, department: "Sales" },
  { rank: 3, name: "Charlie Davis", score: 35, department: "Marketing" },
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export function Recognitions() {
  const [activeTab, setActiveTab] = useState<"criteria" | "leaderboard">("criteria");
  const [selectedMonth, setSelectedMonth] = useState<string>("August");
  const [selectedYear, setSelectedYear] = useState<string>("2025");

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const totalMaxScore = MOCK_CRITERIA.reduce((sum, item) => sum + item.maxScore, 0);

  const { items: sortedCriteria, requestSort, sortConfig } = useSortableData(MOCK_CRITERIA);

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-card p-6 rounded-2xl shadow-sm border border-border/60">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Employee of the Month (EOM)</h1>
            <p className="text-xs font-medium text-muted-foreground mt-1">Configure parameters, evaluate scores, and reveal monthly winners</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button className="flex items-center gap-2 px-3.5 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-500 text-xs font-bold rounded-xl transition-all border border-amber-500/20 shadow-sm">
            <Users className="w-4 h-4" />
            Employee Selection
          </button>
          
          <button className="flex items-center gap-2 px-3.5 py-2 bg-muted hover:bg-muted/80 text-foreground text-xs font-bold rounded-xl transition-all border border-border shadow-sm">
            <History className="w-4 h-4" />
            Month History
          </button>

          <button className="flex items-center gap-2 px-3.5 py-2 bg-muted hover:bg-muted/80 text-foreground text-xs font-bold rounded-xl transition-all border border-border shadow-sm">
            <Settings className="w-4 h-4" />
            Master Template
          </button>

          <div className="flex gap-2">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[120px] rounded-xl font-bold">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[100px] rounded-xl font-bold">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:bg-primary/90 transition-all shadow-sm">
            <Edit className="w-4 h-4" />
            Score Submissions
          </button>

          <button className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-amber-400 to-amber-500 text-amber-950 text-sm font-black rounded-xl hover:shadow-lg hover:shadow-amber-500/20 transition-all uppercase tracking-wide">
            <Play className="w-4 h-4 fill-amber-950" />
            Reveal
          </button>
        </div>
      </div>

      {/* Max Score Total Banner */}
      <div className="p-4 rounded-xl border bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-400 flex flex-col sm:flex-row items-center justify-between gap-4 transition-all">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <div>
            <span className="font-bold text-sm">
              Current Month ({selectedMonth} {selectedYear}) Total Parameters Max Score: {totalMaxScore} pts
            </span>
            <span className="text-xs ml-2 font-medium opacity-80 block sm:inline">
              (Edits here apply ONLY to this month without affecting Master Template)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-card hover:bg-muted text-foreground text-xs font-bold rounded-lg border border-border/60 shadow-sm transition-all">
            <Copy className="w-3.5 h-3.5" />
            Copy Last Month
          </button>
          <button className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all">
            <Check className="w-3.5 h-3.5" />
            Save Month
          </button>
        </div>
      </div>

      {/* Tabs View */}
      <div className="flex items-center border-b border-border/60 gap-8">
        <button
          onClick={() => setActiveTab("criteria")}
          className={cn("pb-3 text-sm font-bold border-b-2 transition-all", activeTab === "criteria" ? "border-amber-500 text-amber-600 dark:text-amber-500" : "border-transparent text-muted-foreground hover:text-foreground")}
        >
          Parameters Configuration
        </button>
        <button
          onClick={() => setActiveTab("leaderboard")}
          className={cn("pb-3 text-sm font-bold border-b-2 transition-all", activeTab === "leaderboard" ? "border-amber-500 text-amber-600 dark:text-amber-500" : "border-transparent text-muted-foreground hover:text-foreground")}
        >
          Month Standings
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "criteria" && (
        <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden space-y-4 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-foreground">Parameters Configuration</h2>
              <p className="text-xs text-muted-foreground font-medium mt-1">Configure criteria and max scores for this month.</p>
            </div>
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-500 hover:bg-amber-500/20 text-xs font-bold rounded-lg transition-all">
              <Plus className="w-3.5 h-3.5" />
              Add Dynamic Parameter
            </button>
          </div>

          <div className="overflow-x-auto mt-4">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-border text-muted-foreground font-bold text-xs uppercase tracking-wider">
                  <SortableHeader label="Criteria Name" sortKey="name" currentSort={sortConfig} onSort={requestSort} className="py-3 px-4" />
                  <SortableHeader label="Type" sortKey="isFixed" currentSort={sortConfig} onSort={requestSort} className="py-3 px-4" />
                  <SortableHeader label="Max Score" sortKey="maxScore" currentSort={sortConfig} onSort={requestSort} className="py-3 px-4" />
                  <SortableHeader label="Category" sortKey="category" currentSort={sortConfig} onSort={requestSort} className="py-3 px-4" />
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-foreground font-medium">
                {sortedCriteria.map((item, idx) => (
                  <tr key={idx} className="hover:bg-muted/50 transition-colors">
                    <td className="py-4 px-4 font-bold">{item.name}</td>
                    <td className="py-4 px-4">
                      {item.isFixed ? (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 uppercase text-[10px] tracking-wider">Fixed Core</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 uppercase text-[10px] tracking-wider">Dynamic</Badge>
                      )}
                    </td>
                    <td className="py-4 px-4">{item.maxScore} pts</td>
                    <td className="py-4 px-4">
                      {item.category === "+ve" ? (
                        <span className="text-emerald-500 font-bold text-xs uppercase tracking-wide">+ve Impact</span>
                      ) : (
                        <span className="text-rose-500 font-bold text-xs uppercase tracking-wide">-ve Impact</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <button className="text-xs font-bold text-primary hover:underline">Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "leaderboard" && (
        <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden p-6">
          <h2 className="text-lg font-black text-foreground mb-4">Current Month Standings</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {MOCK_LEADERBOARD.map((item) => (
              <div key={item.rank} className="p-5 rounded-2xl border border-border/60 bg-muted/30 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-white flex items-center justify-center font-black text-xl shadow-inner shrink-0">
                  #{item.rank}
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-lg">{item.name}</h3>
                  <p className="text-sm text-muted-foreground font-medium">{item.department}</p>
                  <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-background border border-border rounded-lg text-xs font-bold text-primary shadow-sm">
                    {item.score} pts
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
