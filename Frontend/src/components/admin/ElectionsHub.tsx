import { useEffect } from "react";
import { usePersistentState } from "@/hooks/usePersistentState";
import { Vote, Trophy, Award } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthContext";
import { isUserAdmin, hasModulePermission } from "@/lib/permissions";
import { Elections } from "./Elections";
import { Recognitions } from "./Recognitions";
import { TeamLeaderOfWeek } from "./TeamLeaderOfWeek";

interface ElectionsHubProps {
  initialTab?: "elections" | "recognitions" | "leader";
}

const ELECTION_TABS = [
  { id: "elections", label: "Elections", icon: Vote, urls: ["/elections/list"] },
  { id: "recognitions", label: "Employee of the Month", icon: Trophy, urls: ["/recognitions"] },
  { id: "leader", label: "Team Leader of the Week", icon: Award, urls: ["/team-leader-of-the-week"] },
] as const;

type ElectionTabId = typeof ELECTION_TABS[number]["id"];

export function ElectionsHub({ initialTab = "elections" }: ElectionsHubProps) {
  const { user } = useAuth();
  const isAdmin = isUserAdmin(user);

  // Filter tabs dynamically based on user's permissions
  let visibleTabs = ELECTION_TABS.filter((tab) => {
    if (isAdmin) return true;
    return tab.urls.some((u) => hasModulePermission(user, u, "read"));
  });

  // Fallback: If no sub-tab is explicitly configured but user has top-level /elections access, default to Elections
  if (visibleTabs.length === 0 && (isAdmin || hasModulePermission(user, "/elections", "read"))) {
    const firstTab = ELECTION_TABS[0];
    if (firstTab) {
      visibleTabs = [firstTab];
    }
  }

  // Calculate default tab: if initialTab is accessible use it, else pick the first visible tab
  const defaultTab = visibleTabs.some((t) => t.id === initialTab)
    ? initialTab
    : (visibleTabs[0]?.id || "elections");

  const [activeTab, setActiveTab] = usePersistentState<ElectionTabId>(
    `electionsHub.${initialTab}`,
    defaultTab
  );

  // If current activeTab is not in visibleTabs, reset to first valid tab
  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.some((t) => t.id === activeTab)) {
      const firstTab = visibleTabs[0];
      if (firstTab) {
        setActiveTab(firstTab.id);
      }
    }
  }, [visibleTabs, activeTab, setActiveTab]);

  return (
    <div className="w-full min-w-0 space-y-4 sm:space-y-6">
      {/* Top Header & Sub-Navigation Tabs */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 sm:gap-4 border-b border-border/80 pb-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <span>🗳️</span> Elections & Recognition
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage company elections, monthly recognitions, and weekly team leadership honors.
          </p>
        </div>

        {/* Tab Pills: ONLY show if user has access to MORE THAN 1 tab */}
        {visibleTabs.length > 1 && (
          <div className="flex items-center gap-1 overflow-x-auto max-w-full w-full xl:w-auto scrollbar-none bg-muted/60 p-1 rounded-xl border border-border/60">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-all",
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
        )}
      </div>

      {/* Tab Contents: Render only if the tab is permitted */}
      <div className="min-w-0">
        {activeTab === "elections" && visibleTabs.some((t) => t.id === "elections") && <Elections />}
        {activeTab === "recognitions" && visibleTabs.some((t) => t.id === "recognitions") && <Recognitions />}
        {activeTab === "leader" && visibleTabs.some((t) => t.id === "leader") && <TeamLeaderOfWeek />}
      </div>
    </div>
  );
}
