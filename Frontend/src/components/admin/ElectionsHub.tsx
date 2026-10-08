import { useState, useEffect } from "react";
import { Vote, Trophy, Award } from "lucide-react";
import { cn } from "@/lib/utils";
import { Elections } from "./Elections";
import { Recognitions } from "./Recognitions";
import { TeamLeaderOfWeek } from "./TeamLeaderOfWeek";

interface ElectionsHubProps {
  initialTab?: "elections" | "recognitions" | "leader";
}

const ELECTION_TABS = [
  { id: "elections", label: "Elections", icon: Vote },
  { id: "recognitions", label: "Employee of the Month", icon: Trophy },
  { id: "leader", label: "Team Leader of the Week", icon: Award },
] as const;

type ElectionTabId = typeof ELECTION_TABS[number]["id"];

export function ElectionsHub({ initialTab = "elections" }: ElectionsHubProps) {
  const [activeTab, setActiveTab] = useState<ElectionTabId>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  return (
    <div className="space-y-6">
      {/* Top Header & Integrated Sub-Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <span>🗳️</span> Elections & Recognition
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage company elections, monthly recognitions, and weekly team leadership honors.
          </p>
        </div>

        {/* Tab Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none bg-muted/60 p-1 rounded-xl border border-border/60">
          {ELECTION_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all",
                  isActive
                    ? "bg-card text-foreground shadow-xs border border-border/80 font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
                )}
              >
                <Icon className={cn("w-3.5 h-3.5 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Contents */}
      <div className="min-w-0">
        {activeTab === "elections" && <Elections />}
        {activeTab === "recognitions" && <Recognitions />}
        {activeTab === "leader" && <TeamLeaderOfWeek />}
      </div>
    </div>
  );
}
