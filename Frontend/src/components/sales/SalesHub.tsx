import { useEffect } from "react";
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
import { useAuth } from "@/components/auth/AuthContext";
import { isUserAdmin, hasModulePermission } from "@/lib/permissions";
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
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, urls: ["/work/sales/dashboard"] },
  { id: "pipeline", label: "Pipeline", icon: Kanban, urls: ["/work/sales/pipeline"] },
  { id: "leads", label: "Leads", icon: Users, urls: ["/work/sales/leads"] },
  { id: "tasks", label: "Tasks & Follow-ups", icon: ClipboardList, urls: ["/work/sales/tasks"] },
  { id: "analytics", label: "Analytics", icon: BarChart3, urls: ["/work/sales/analytics"] },
  { id: "team", label: "Team Performance", icon: Trophy, urls: ["/work/sales/team"] },
  { id: "reports", label: "Reports", icon: FileText, urls: ["/work/sales/reports"] },
  { id: "settings", label: "Settings", icon: SlidersHorizontal, urls: ["/work/sales/settings"] },
] as const;

type SalesTabId = typeof SALES_TABS[number]["id"];

export function SalesHub({ initialTab = "dashboard", setActive, onAction, isNew }: SalesHubProps) {
  const { user } = useAuth();
  const isAdmin = isUserAdmin(user);
  const perms = user?.permissions;

  // Filter tabs dynamically based on user's permissions
  let visibleTabs = SALES_TABS.filter((tab) => {
    if (isAdmin) return true;
    return tab.urls.some((u) => hasModulePermission(user, u, "read"));
  });

  // Fallback: If no sub-tab is explicitly configured but user has top-level /work/sales access, default to Dashboard
  if (visibleTabs.length === 0 && (isAdmin || hasModulePermission(user, "/work/sales", "read"))) {
    const firstTab = SALES_TABS[0];
    if (firstTab) {
      visibleTabs = [firstTab];
    }
  }

  const defaultTab = visibleTabs.some((t) => t.id === initialTab)
    ? (initialTab as SalesTabId)
    : (visibleTabs[0]?.id || "dashboard");

  const [activeTab, setActiveTab] = usePersistentState<SalesTabId>(
    `salesHub.${initialTab}`,
    defaultTab
  );

  // If activeTab is ever not in visibleTabs, reset to first valid tab
  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.some((t) => t.id === activeTab)) {
      const firstTab = visibleTabs[0];
      if (firstTab) {
        setActiveTab(firstTab.id);
      }
    }
  }, [visibleTabs, activeTab, setActiveTab]);

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

        {/* Tab Pills: ONLY show if user has access to MORE THAN 1 tab */}
        {visibleTabs.length > 1 && (
          <div className="flex items-center gap-1 overflow-x-auto max-w-full scrollbar-none bg-muted/60 p-1 rounded-xl border border-border/60">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    if (setActive) {
                      const targetUrl = tab.id === "dashboard" ? "/work/sales" : `/work/sales/${tab.id}`;
                      setActive(targetUrl);
                    }
                  }}
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
        )}
      </div>

      {/* Tab Contents: Render only if the tab is permitted */}
      <div className="min-w-0">
        {activeTab === "dashboard" && visibleTabs.some(t => t.id === "dashboard") && (
          <SalesDashboard {...(setActive ? { setActive } : {})} {...(onAction ? { onAction } : {})} />
        )}
        {activeTab === "pipeline" && visibleTabs.some(t => t.id === "pipeline") && (
          <SalesPipeline {...(onAction ? { onAction } : {})} />
        )}
        {activeTab === "leads" && visibleTabs.some(t => t.id === "leads") && (
          <SalesLeads {...(onAction ? { onAction } : {})} {...(isNew !== undefined ? { isNew } : {})} />
        )}
        {activeTab === "tasks" && visibleTabs.some(t => t.id === "tasks") && (
          <SalesTasks {...(onAction ? { onAction } : {})} />
        )}
        {activeTab === "analytics" && visibleTabs.some(t => t.id === "analytics") && (
          <SalesAnalytics {...(onAction ? { onAction } : {})} />
        )}
        {activeTab === "team" && visibleTabs.some(t => t.id === "team") && (
          <SalesTeamPerformance {...(onAction ? { onAction } : {})} />
        )}
        {activeTab === "reports" && visibleTabs.some(t => t.id === "reports") && (
          <SalesReports {...(onAction ? { onAction } : {})} />
        )}
        {activeTab === "settings" && visibleTabs.some(t => t.id === "settings") && (
          <SalesSettings />
        )}
      </div>
    </div>
  );
}
