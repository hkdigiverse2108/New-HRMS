import { usePersistentState } from "@/hooks/usePersistentState";
import { 
  LayoutDashboard, 
  Kanban, 
  Users, 
  ClipboardList, 
  BarChart3, 
  Trophy, 
  FileText, 
  SlidersHorizontal 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SalesDashboard } from "./SalesDashboard";
import { SalesPipeline } from "./SalesPipeline";
import { SalesLeads } from "./SalesLeads";
import { SalesTasks } from "./SalesTasks";
import { SalesAnalytics } from "./SalesAnalytics";
import { SalesTeamPerformance } from "./SalesTeamPerformance";
import { SalesReports } from "./SalesReports";
import { SalesSettings } from "./SalesSettings";

interface SalesHubProps {
  initialTab?: string;
  setActive?: (url: string) => void;
  onAction?: (action: string) => void;
  isNew?: boolean;
}

const SALES_TABS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "pipeline", label: "Pipeline", icon: Kanban },
  { id: "leads", label: "Leads", icon: Users },
  { id: "tasks", label: "Tasks & Follow-ups", icon: ClipboardList },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "team", label: "Team Performance", icon: Trophy },
  { id: "reports", label: "Reports", icon: FileText },
  { id: "settings", label: "Settings", icon: SlidersHorizontal },
] as const;

type SalesTabId = typeof SALES_TABS[number]["id"];

export function SalesHub({ initialTab = "dashboard", setActive, onAction, isNew }: SalesHubProps) {
  // Each route remounts the hub, so keying by initialTab restores the last tab only on refresh of the same route
  const [activeTab, setActiveTab] = usePersistentState<SalesTabId>(
    `salesHub.${initialTab}`,
    SALES_TABS.some(t => t.id === initialTab) ? (initialTab as SalesTabId) : "dashboard"
  );

  return (
    <div className="space-y-6">
      {/* Top Header & Integrated Sub-Navigation Tabs */}
      <div className="flex flex-col 2xl:flex-row 2xl:items-center justify-between gap-3 sm:gap-4 border-b border-border/80 pb-3 min-w-0">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <span>🎯</span> Sales Hub
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage your sales pipeline, leads, team targets, reports, and analytics in one place.
          </p>
        </div>

        {/* Tab Pills */}
        <div className="flex items-center gap-1 overflow-x-auto max-w-full scrollbar-none bg-muted/60 p-1 rounded-xl border border-border/60">
          {SALES_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 px-3 py-1.5 min-h-[40px] sm:min-h-0 rounded-lg text-xs font-semibold whitespace-nowrap transition-all",
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
        {activeTab === "dashboard" && <SalesDashboard {...(setActive ? { setActive } : {})} {...(onAction ? { onAction } : {})} />}
        {activeTab === "pipeline" && <SalesPipeline {...(onAction ? { onAction } : {})} />}
        {activeTab === "leads" && <SalesLeads {...(onAction ? { onAction } : {})} {...(isNew !== undefined ? { isNew } : {})} />}
        {activeTab === "tasks" && <SalesTasks {...(onAction ? { onAction } : {})} />}
        {activeTab === "analytics" && <SalesAnalytics {...(onAction ? { onAction } : {})} />}
        {activeTab === "team" && <SalesTeamPerformance {...(onAction ? { onAction } : {})} />}
        {activeTab === "reports" && <SalesReports {...(onAction ? { onAction } : {})} />}
        {activeTab === "settings" && <SalesSettings />}
      </div>
    </div>
  );
}
