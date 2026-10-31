import React, { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard,
  Instagram,
  Sparkles,
  Activity,
  Film,
  MessageSquare,
  Building2,
  Settings2,
  Clock,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { useSocialApi } from "./useSocialApi";
import type {
  SocialOverviewData,
  SocialAccount,
  SocialKeyword,
  SocialPendingDm,
  SocialEventLog,
  SocialBrand,
  SocialScript,
  SocialSettingsData,
} from "./types";

import { SocialDashboard } from "./SocialDashboard";
import { AccountsTab } from "./accounts/AccountsTab";
import { KeywordsTab } from "./keywords/KeywordsTab";
import { ActivityTab } from "./activity/ActivityTab";
import { ReelScriptsTab } from "./scripts/ReelScriptsTab";
import { CaptionsTab } from "./captions/CaptionsTab";
import { BrandsTab } from "./brands/BrandsTab";
import { SocialSettingsTab } from "./settings/SocialSettingsTab";
import { useAuth } from "@/components/auth/AuthContext";
import { isUserAdmin, hasModulePermission } from "@/lib/permissions";

interface SocialHubProps {
  initialPath?: string | undefined;
  setActive?: ((path: string) => void) | undefined;
}

type TabKey =
  | "dashboard"
  | "accounts"
  | "keywords"
  | "activity"
  | "scripts"
  | "captions"
  | "brands"
  | "settings";

const TAB_CONFIG: { key: TabKey; label: string; icon: React.ElementType; url: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, url: "/social/dashboard" },
  { key: "accounts", label: "Accounts", icon: Instagram, url: "/social/accounts" },
  { key: "keywords", label: "Keywords", icon: Sparkles, url: "/social/keywords" },
  { key: "activity", label: "Activity", icon: Activity, url: "/social/activity" },
  { key: "scripts", label: "Reel Scripts", icon: Film, url: "/social/scripts" },
  { key: "captions", label: "Captions & SEO", icon: MessageSquare, url: "/social/captions" },
  { key: "brands", label: "Brand Profiles", icon: Building2, url: "/social/brands" },
  { key: "settings", label: "Settings", icon: Settings2, url: "/social/settings" },
];

export const SocialHub: React.FC<SocialHubProps> = ({ initialPath, setActive }) => {
  const { user } = useAuth();
  const isAdmin = isUserAdmin(user);

  // Filter tabs dynamically based on user's permissions
  let visibleTabs = TAB_CONFIG.filter((tab) => {
    if (isAdmin) return true;
    return hasModulePermission(user, tab.url, "read");
  });

  if (visibleTabs.length === 0 && (isAdmin || hasModulePermission(user, "/social", "read"))) {
    const firstTab = TAB_CONFIG[0];
    if (firstTab) {
      visibleTabs = [firstTab];
    }
  }

  const getTabFromPath = (path?: string): TabKey => {
    if (!path) return visibleTabs[0]?.key || "dashboard";
    const segment = path.replace("/social", "").replace(/^\//, "").split("/")[0]?.toLowerCase();
    const found = visibleTabs.find((t) => t.key === segment);
    return found ? found.key : (visibleTabs[0]?.key || "dashboard");
  };

  const [activeTab, setActiveTab] = useState<TabKey>(() => getTabFromPath(initialPath));

  useEffect(() => {
    if (initialPath) {
      setActiveTab(getTabFromPath(initialPath));
    }
  }, [initialPath]);

  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.some((t) => t.key === activeTab)) {
      const firstTab = visibleTabs[0];
      if (firstTab) {
        setActiveTab(firstTab.key);
      }
    }
  }, [visibleTabs, activeTab]);

  // Keep the selected tab centered in the horizontally scrollable tab bar
  const navRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = navRef.current?.querySelector<HTMLElement>(`[data-tab="${activeTab}"]`);
    if (el && navRef.current) {
      const nav = navRef.current;
      nav.scrollTo({
        left: el.offsetLeft - (nav.clientWidth - el.offsetWidth) / 2,
        behavior: "smooth",
      });
    }
  }, [activeTab, visibleTabs.length]);

  const handleTabChange = (key: string) => {
    const validKey = (visibleTabs.some((t) => t.key === key) ? key : (visibleTabs[0]?.key || "dashboard")) as TabKey;
    setActiveTab(validKey);
    const targetUrl = validKey === "dashboard" ? "/social" : `/social/${validKey}`;
    if (setActive) {
      setActive(targetUrl);
    } else if (typeof window !== "undefined") {
      window.history.pushState({}, "", targetUrl);
    }
  };

  // API Client
  const api = useSocialApi();

  // State caches
  const [overview, setOverview] = useState<SocialOverviewData | null>(null);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [keywords, setKeywords] = useState<SocialKeyword[]>([]);
  const [pendingDms, setPendingDms] = useState<SocialPendingDm[]>([]);
  const [logs, setLogs] = useState<SocialEventLog[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [logPage, setLogPage] = useState(1);
  const [logLevel, setLogLevel] = useState("");
  const [logType, setLogType] = useState("");
  const [brands, setBrands] = useState<SocialBrand[]>([]);
  const [scripts, setScripts] = useState<SocialScript[]>([]);
  const [settingsData, setSettingsData] = useState<SocialSettingsData | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  // Load baseline data on mount
  const refreshAllData = async () => {
    try {
      const [ov, accs, kws, pds, brs, scrs, sets, logRes] = await Promise.all([
        api.getOverview().catch(() => null),
        api.getAccounts().catch(() => []),
        api.getKeywords().catch(() => []),
        api.getPendingDms().catch(() => []),
        api.getBrands().catch(() => []),
        api.getScripts().catch(() => []),
        api.getSettings().catch(() => null),
        api
          .getLogs({
            page: logPage,
            level: logLevel || undefined,
            type: logType || undefined,
          })
          .catch(() => ({
            events: [] as SocialEventLog[],
            items: [] as SocialEventLog[],
            total: 0,
            page: 1,
            limit: 30,
          })),
      ]);

      if (ov) setOverview(ov);
      setAccounts(Array.isArray(accs) ? accs : []);
      const safeKws = Array.isArray(kws) ? kws : (kws && Array.isArray((kws as any).items) ? (kws as any).items : []);
      setKeywords(safeKws);
      setPendingDms(Array.isArray(pds) ? pds : []);
      setBrands(Array.isArray(brs) ? brs : []);
      setScripts(Array.isArray(scrs) ? scrs : []);
      if (sets) setSettingsData(sets);
      const logObj = logRes as any;
      const safeLogs: SocialEventLog[] = Array.isArray(logObj?.events)
        ? logObj.events
        : Array.isArray(logObj?.items)
        ? logObj.items
        : Array.isArray(logObj)
        ? logObj
        : [];
      setLogs(safeLogs);
      setTotalLogs(logObj?.total ?? safeLogs.length);
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    refreshAllData();
  }, []);

  // Fetch logs on pagination or filter change
  const refreshLogs = async (page = logPage, level = logLevel, type = logType) => {
    try {
      const res = await api.getLogs({
        page,
        level: level || undefined,
        type: type || undefined,
      });
      setLogs(res.events);
      setTotalLogs(res.total);
      setLogPage(page);
    } catch (e) {
      console.error("Failed to load logs:", e);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0 max-w-full">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 shrink-0 rounded-2xl bg-gradient-to-tr from-purple-600 via-pink-600 to-indigo-600 text-white shadow-md">
              <Instagram className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-foreground sm:text-2xl lg:text-3xl">
                Social Automation Hub
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Instagram comment-to-DM flows, follow-gate, viral reel scriptwriter & SEO engine
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={refreshAllData}
          className="self-start sm:self-auto flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl border border-border text-foreground hover:bg-muted transition-colors shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${api.loading || initialLoading ? "animate-spin" : ""}`} />
          Sync All
        </button>
      </div>

      {/* Modern Tabs Navigation Bar: ONLY show if user has access to MORE THAN 1 tab */}
      {visibleTabs.length > 1 && (
        <div className="border-b border-border -mx-1 px-1">
          <nav ref={navRef} className="relative flex space-x-1 sm:space-x-2 overflow-x-auto overscroll-x-contain pb-px [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Tabs">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  data-tab={tab.key}
                  onClick={() => handleTabChange(tab.key)}
                  className={`flex shrink-0 items-center gap-2 py-3 px-3 sm:px-3.5 border-b-2 font-bold text-xs whitespace-nowrap transition-all outline-none ${
                    isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                  {tab.label}
                  {tab.key === "activity" && pendingDms.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-purple-500/20 text-purple-500 font-extrabold">
                      {pendingDms.length}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      )}

      {/* Main Tab Panels */}
      {initialLoading ? (
        <div className="py-24 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-3" />
          <p className="text-xs font-semibold text-muted-foreground">
            Connecting to Social Automation services...
          </p>
        </div>
      ) : (
        <div className="animate-in fade-in duration-200">
          {activeTab === "dashboard" && visibleTabs.some((t) => t.key === "dashboard") && (
            <SocialDashboard
              overview={overview}
              onNavigateTab={handleTabChange}
            />
          )}

          {activeTab === "accounts" && visibleTabs.some((t) => t.key === "accounts") && (
            <AccountsTab
              accounts={accounts}
              brands={brands}
              isLoading={api.loading}
              onRefresh={async () => {
                const accs = await api.getAccounts();
                setAccounts(accs);
              }}
              onCreateAccount={async (data) => {
                await api.createAccount(data);
              }}
              onUpdateAccount={async (id, data) => {
                await api.updateAccount(id, data);
              }}
              onToggleAccount={async (id) => {
                await api.toggleAccount(id);
                const accs = await api.getAccounts();
                setAccounts(accs);
              }}
              onRefreshToken={api.refreshAccountToken}
              onTestToken={api.testAccountToken}
              onDeleteAccount={async (id) => {
                await api.deleteAccount(id);
              }}
            />
          )}

          {activeTab === "keywords" && visibleTabs.some((t) => t.key === "keywords") && (
            <KeywordsTab
              keywords={keywords}
              accounts={accounts}
              isLoading={api.loading}
              onRefresh={async () => {
                const kws = await api.getKeywords({ sync_n8n: true });
                setKeywords(kws);
              }}
              onSyncKeywords={async () => {
                const res = await api.syncKeywords();
                const kws = await api.getKeywords();
                setKeywords(kws);
                return res;
              }}
              onCreateKeyword={async (data) => {
                await api.createKeyword(data);
              }}
              onUpdateKeyword={async (id, data) => {
                await api.updateKeyword(id, data);
              }}
              onToggleKeyword={async (id) => {
                await api.toggleKeyword(id);
                const kws = await api.getKeywords();
                setKeywords(kws);
              }}
              onDeleteKeyword={async (id) => {
                await api.deleteKeyword(id);
              }}
              onTestMatch={api.testMatch}
            />
          )}

          {activeTab === "activity" && visibleTabs.some((t) => t.key === "activity") && (
            <ActivityTab
              logs={logs}
              totalLogs={totalLogs}
              currentPage={logPage}
              limit={30}
              pendingDms={pendingDms}
              isLoading={api.loading}
              onRefresh={async () => {
                await refreshLogs(logPage, logLevel, logType);
                const pds = await api.getPendingDms();
                setPendingDms(pds);
              }}
              onPageChange={(page) => refreshLogs(page, logLevel, logType)}
              onLevelChange={(level) => {
                setLogLevel(level);
                refreshLogs(1, level, logType);
              }}
              onTypeChange={(type) => {
                setLogType(type);
                refreshLogs(1, logLevel, type);
              }}
              onClearLogs={async () => {
                await api.clearLogs();
                await refreshLogs(1);
              }}
              onDismissPendingDm={async (id) => {
                await api.dismissPendingDm(id);
                const pds = await api.getPendingDms();
                setPendingDms(pds);
              }}
              onSweepPending={async () => {
                await api.sweepPendingDms();
                const pds = await api.getPendingDms();
                setPendingDms(pds);
              }}
            />
          )}

          {activeTab === "scripts" && visibleTabs.some((t) => t.key === "scripts") && (
            <ReelScriptsTab
              scripts={scripts}
              brands={brands}
              isLoading={api.loading}
              onRefresh={async () => {
                const scrs = await api.getScripts();
                setScripts(scrs);
              }}
              onGenerateScript={api.generateScript}
              onReviseScript={api.reviseScript}
              onToggleFavorite={async (id) => {
                await api.toggleFavoriteScript(id);
                const scrs = await api.getScripts();
                setScripts(scrs);
              }}
              onUpdateStatus={async (id, status) => {
                await api.updateScriptStatus(id, status);
                const scrs = await api.getScripts();
                setScripts(scrs);
              }}
              onDeleteScript={async (id) => {
                await api.deleteScript(id);
                const scrs = await api.getScripts();
                setScripts(scrs);
              }}
            />
          )}

          {activeTab === "captions" && visibleTabs.some((t) => t.key === "captions") && (
            <CaptionsTab
              brands={brands}
              isLoading={api.loading}
              onGenerateCaption={api.generateCaption}
            />
          )}

          {activeTab === "brands" && visibleTabs.some((t) => t.key === "brands") && (
            <BrandsTab
              brands={brands}
              isLoading={api.loading}
              onRefresh={async () => {
                const brs = await api.getBrands();
                setBrands(brs);
              }}
              onCreateBrand={async (data) => {
                await api.createBrand(data);
              }}
              onUpdateBrand={async (id, data) => {
                await api.updateBrand(id, data);
              }}
              onDeleteBrand={async (id) => {
                await api.deleteBrand(id);
              }}
            />
          )}

          {activeTab === "settings" && visibleTabs.some((t) => t.key === "settings") && (
            <SocialSettingsTab
              settings={settingsData}
              isLoading={api.loading}
              onRefresh={async () => {
                const sets = await api.getSettings();
                setSettingsData(sets);
              }}
              onUpdateSettings={async (data) => {
                await api.updateSettings(data);
              }}
              onTestProvider={api.testProvider}
              onClearLogs={async () => {
                await api.clearLogs();
                await refreshLogs(1);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
};
