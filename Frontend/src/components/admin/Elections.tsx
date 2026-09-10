import React, { useState } from "react";
import { Vote, Plus, Filter, Users, Trash2, Award, Lock, BarChart3, Sparkles } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const MOCK_ELECTIONS = [
  {
    id: "1",
    title: "Employee of the Month - August 2025",
    description: "Vote for the most outstanding employee this month.",
    maxPreferences: 3,
    electionMonth: "August",
    electionYear: 2025,
    status: "active",
    candidates: [{ id: "c1" }, { id: "c2" }, { id: "c3" }, { id: "c4" }],
    totalValidVotes: 120,
    totalEligibleVoters: 150,
  },
  {
    id: "2",
    title: "Team Lead - Engineering",
    description: "Elect the new team lead for the core engineering group.",
    maxPreferences: 1,
    electionMonth: "July",
    electionYear: 2025,
    status: "completed",
    candidates: [{ id: "c1" }, { id: "c2" }],
    totalValidVotes: 45,
    totalEligibleVoters: 50,
    winner_name: "Sarah Chen",
  }
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export function Elections() {
  const [elections, setElections] = useState(MOCK_ELECTIONS);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>("all");

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const filteredElections = elections.filter(e => {
    if (selectedMonth !== "all" && e.electionMonth !== selectedMonth) return false;
    if (selectedYear !== "all" && e.electionYear !== parseInt(selectedYear)) return false;
    return true;
  });

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 bg-primary/10 text-primary rounded-xl border border-primary/20">
              <Vote className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                Elections & Voting
              </h1>
              <p className="text-sm font-medium text-muted-foreground mt-1">
                Single Transferable Vote (STV) ranked choice voting system
              </p>
            </div>
          </div>
        </div>

        <button
          className="shrink-0 inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl shadow-sm hover:bg-primary/90 transition-all duration-200"
        >
          <Plus className="w-5 h-5" />
          <span>Create Election</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-card rounded-2xl p-4 sm:p-5 border border-border/60 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-foreground font-bold text-sm">
          <Filter className="w-4 h-4 text-primary" />
          <span>Filter Elections:</span>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[140px] rounded-xl">
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Months</SelectItem>
              {MONTHS.map(m => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[120px] rounded-xl">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {yearOptions.map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(selectedMonth !== "all" || selectedYear !== "all") && (
            <button
              onClick={() => {
                setSelectedMonth("all");
                setSelectedYear("all");
              }}
              className="text-xs text-primary hover:underline font-bold px-2 py-1 transition-all"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Elections Grid */}
      {filteredElections.length === 0 ? (
        <div className="bg-card rounded-3xl p-12 text-center border border-border/60 shadow-sm">
          <Vote className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-black text-foreground mb-1">
            No Elections Found
          </h3>
          <p className="text-sm font-medium text-muted-foreground max-w-md mx-auto mb-6">
            No elections match the selected filters.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredElections.map((election) => {
            const isCompleted = election.status === "completed";
            const turnoutPercent = election.totalEligibleVoters > 0
              ? Math.round((election.totalValidVotes / election.totalEligibleVoters) * 100)
              : 0;

            return (
              <div
                key={election.id}
                className="bg-card rounded-3xl border border-border/60 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col justify-between group"
              >
                <div className="p-6">
                  {/* Top Bar with Tag */}
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2">
                      <Badge variant={isCompleted ? "secondary" : "default"} className="rounded-full px-3 py-0.5 text-xs font-bold uppercase tracking-wide">
                        {isCompleted ? "Completed" : "Active Voting"}
                      </Badge>
                      {election.electionMonth && (
                        <Badge variant="outline" className="rounded-full px-3 py-0.5 text-xs font-bold uppercase tracking-wide bg-muted/50 border-transparent">
                          {election.electionMonth} {election.electionYear}
                        </Badge>
                      )}
                    </div>
                    <button
                      className="text-muted-foreground hover:text-destructive p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
                      title="Delete Election"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-xl font-black text-foreground mb-1.5 line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                    {election.title}
                  </h3>
                  {election.description && (
                    <p className="text-sm font-medium text-muted-foreground line-clamp-2 mb-5">
                      {election.description}
                    </p>
                  )}

                  {/* Winner Banner if Completed */}
                  {isCompleted && election.winner_name && (
                    <div className="mt-3 mb-5 p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-3">
                      <div className="p-2 bg-amber-500/20 text-amber-600 rounded-xl shrink-0">
                        <Award className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-widest font-bold text-amber-600/80">
                          Declared Winner
                        </div>
                        <div className="text-base font-black text-amber-700 dark:text-amber-400">
                          {election.winner_name}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Turnout Progress Bar */}
                  <div className="mt-2 pt-5 border-t border-border/40">
                    <div className="flex items-center justify-between text-xs font-bold text-muted-foreground mb-2">
                      <span className="flex items-center gap-1.5 uppercase tracking-wide">
                        <Users className="w-3.5 h-3.5 text-primary" />
                        Votes Cast
                      </span>
                      <span className="text-foreground">
                        {election.totalValidVotes} / {election.totalEligibleVoters} ({turnoutPercent}%)
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-primary h-2.5 rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${Math.min(turnoutPercent, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Candidate Count */}
                  <div className="flex items-center gap-2 mt-4 text-xs font-bold text-muted-foreground">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>{election.candidates?.length || 0} Candidates</span>
                    <span className="text-border">•</span>
                    <span>Max {election.maxPreferences} choices</span>
                  </div>
                </div>

                {/* Footer Action Buttons */}
                <div className="p-4 bg-muted/30 border-t border-border/40 flex items-center justify-between gap-3">
                  {!isCompleted ? (
                    <button
                      className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-primary text-primary-foreground rounded-xl text-xs font-bold hover:bg-primary/90 transition-all shadow-sm"
                    >
                      <Vote className="w-4 h-4" />
                      Cast / View My Vote
                    </button>
                  ) : (
                    <div className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 px-2 uppercase tracking-wide">
                      <Lock className="w-3.5 h-3.5" /> Voting Closed
                    </div>
                  )}

                  <button
                    className="inline-flex items-center gap-1.5 py-2.5 px-4 bg-card text-foreground border border-border/60 shadow-sm rounded-xl text-xs font-bold hover:bg-muted transition-all"
                  >
                    <BarChart3 className="w-4 h-4" />
                    Results
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
