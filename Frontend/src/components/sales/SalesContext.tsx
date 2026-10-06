import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo } from "react";
import { pipelineStages, type Lead, type SalesTask } from "./sales-data";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { useAuth } from "@/components/auth/AuthContext";
import { isUserAdmin } from "@/lib/permissions";

export type SalesTarget = {
  id?: string;
  _id?: string;
  employeeId: string;
  employeeName?: string;
  type: string; // "Monthly" | "Weekly" | "Custom"
  month?: string;
  year?: number;
  week?: number;
  startDate?: string;
  endDate?: string;
  targetAmount: number;
  currentAchievement?: number;
  incentiveBase?: number;
  incentiveAmount?: number;
  status?: string;
  category?: string;
  breakdown?: any[];
};

export type SalesSummary = {
  total_leads: number;
  active_leads: number;
  won_leads: number;
  lost_leads: number;
  hot_leads_count: number;
  hot_leads_overdue_count: number;
  hot_leads_needing_attention: any[];
  today_followups_count: number;
  total_target: number;
  achieved_target: number;
  remaining_target: number;
  conversion_rate: number;
  avg_deal_size: number;
  conversion_funnel: Record<string, number>;
  source_analysis: any[];
};

export type SalesSettings = {
  id?: string;
  stages: { name: string; index: number; is_default?: boolean; color?: string }[];
  categories: { name: string; iconName?: string; color?: string }[];
  sources: string[];
  assignment_rules: { name: string; active: boolean }[];
  eligible_owners: string[];
  notifications: { title: string; subtitle?: string; active: boolean }[];
  payment_visibility: { allowed_roles?: string[]; allowed_employee_ids?: string[]; allowed_employee_names?: string[] };
  follow_up_types?: { label: string; note?: string; action?: string; offset_hours?: number; active?: boolean }[];
  role_permissions?: { role: string; perms: string[] }[];
};

type SalesContextType = {
  leads: Lead[];
  setLeads: React.Dispatch<React.SetStateAction<Lead[]>>;
  stages: string[];
  setStages: React.Dispatch<React.SetStateAction<string[]>>;
  salesSettings: SalesSettings | null;
  fetchSettings: () => Promise<void>;
  updateSalesSettings: (updates: Partial<SalesSettings>) => Promise<boolean>;
  summary: SalesSummary | null;
  fetchSummary: () => Promise<void>;
  tasks: SalesTask[];
  setTasks: React.Dispatch<React.SetStateAction<SalesTask[]>>;
  targets: SalesTarget[];
  setTargets: React.Dispatch<React.SetStateAction<SalesTarget[]>>;
  isLoading: boolean;
  fetchLeads: (employeeFilter?: string) => Promise<void>;
  fetchTargets: () => Promise<void>;
  addLead: (leadData: Partial<Lead>) => Promise<Lead | null>;
  updateLead: (id: string, updates: Partial<Lead>) => Promise<Lead | null>;
  deleteLead: (id: string) => Promise<boolean>;
  bulkAssignLeads: (leadIds: string[], assignedTo: string[]) => Promise<boolean>;
  bulkDeleteLeads: (leadIds: string[]) => Promise<boolean>;
  addFollowUp: (
    leadId: string,
    note: string,
    nextFollowUpDate?: string | null,
    actionType?: string,
    nextFollowUpTime?: string
  ) => Promise<boolean>;
  // Calculated live metrics
  activeLeads: Lead[];
  wonLeads: Lead[];
  lostLeads: Lead[];
  pipelineValue: number;
  wonRevenue: number;
  winRate: number;
  todayFollowUps: Lead[];
  overdueFollowUps: Lead[];
  hotLeads: Lead[];
};

const SalesContext = createContext<SalesContextType | undefined>(undefined);

export function SalesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isAdmin = user ? isUserAdmin(user) : false;
  const currentUserName = user?.name || `${(user as any)?.firstName || ""} ${(user as any)?.lastName || ""}`.trim() || "User";
  const currentUserId = String(user?.id || (user as any)?._id || "");

  const [leads, setLeads] = useState<Lead[]>([]);
  const [stages, setStages] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("hrms_sales_stages");
      return saved ? JSON.parse(saved) : pipelineStages.map((s) => s.stage);
    }
    return pipelineStages.map((s) => s.stage);
  });

  const [salesSettings, setSalesSettings] = useState<SalesSettings | null>(null);
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [tasks, setTasks] = useState<SalesTask[]>([]);
  const [targets, setTargets] = useState<SalesTarget[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Sync stages to local storage as fallback
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("hrms_sales_stages", JSON.stringify(stages));
    }
  }, [stages]);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await api.get<SalesSettings>("/sales/settings", { showErrorToast: false });
      if (res && res.stages && Array.isArray(res.stages)) {
        setSalesSettings(res);
        const stageNames = res.stages
          .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
          .map((s) => s.name);
        if (stageNames.length > 0) {
          setStages(stageNames);
        }
      }
    } catch {
      // Fallback to local
    }
  }, []);

  const updateSalesSettings = async (updates: Partial<SalesSettings>): Promise<boolean> => {
    try {
      const updated = await api.put<SalesSettings>("/sales/settings", updates, { showErrorToast: true });
      if (updated) {
        setSalesSettings(updated);
        if (updated.stages) {
          const stageNames = updated.stages
            .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
            .map((s) => s.name);
          setStages(stageNames);
        }
        toast.success("Sales settings updated successfully");
        return true;
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to update sales settings");
    }
    return false;
  };

  const fetchSummary = useCallback(async () => {
    try {
      const res = await api.get<SalesSummary>("/sales/summary", { showErrorToast: false });
      if (res && typeof res.total_leads === "number") {
        setSummary(res);
      }
    } catch {
      // Backend error fallback
    }
  }, []);

  const fetchLeads = useCallback(async (employeeFilter?: string) => {
    try {
      setIsLoading(true);
      const url = employeeFilter && employeeFilter !== "all" 
        ? `/leads?employee=${encodeURIComponent(employeeFilter)}`
        : "/leads";
      const res = await api.get<Lead[]>(url, { showErrorToast: false });
      if (Array.isArray(res)) {
        setLeads(res);
      }
    } catch {
      // Backend error fallback
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchTargets = useCallback(async () => {
    try {
      const res = await api.get<SalesTarget[]>("/sales-targets", { showErrorToast: false });
      if (Array.isArray(res)) {
        setTargets(res);
      }
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchSummary();
    fetchLeads();
    fetchTargets();
  }, [fetchSettings, fetchSummary, fetchLeads, fetchTargets]);

  const addLead = async (leadData: Partial<Lead>): Promise<Lead | null> => {
    try {
      const payload: Partial<Lead> = {
        ...leadData,
        createdBy: leadData.createdBy || currentUserId,
        createdByUserName: leadData.createdByUserName || currentUserName,
        owner: leadData.owner || currentUserName,
        assignedTo: leadData.assignedTo && leadData.assignedTo.length > 0 
          ? leadData.assignedTo 
          : [currentUserName],
        stage: leadData.stage || leadData.status || stages[0] || "New Lead",
        status: leadData.status || leadData.stage || stages[0] || "New Lead",
        date: leadData.date || new Date().toISOString().split("T")[0] || "",
      };

      const created = await api.post<Lead>("/leads", payload, { showErrorToast: false });
      if (created) {
        setLeads((prev) => [created, ...prev.filter((l) => (l.id || l._id) !== (created.id || created._id))]);
        fetchSummary();
        return created;
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to create lead");
    }
    return null;
  };


  const updateLead = async (id: string, updates: Partial<Lead>): Promise<Lead | null> => {
    try {
      const updated = await api.put<Lead>(`/leads/${id}`, updates, { showErrorToast: false });
      setLeads((prev) =>
        prev.map((l) => ((l.id || l._id) === id ? { ...l, ...updates, ...(updated || {}) } : l))
      );
      return updated || null;
    } catch {
      // Offline fallback
      setLeads((prev) =>
        prev.map((l) => ((l.id || l._id) === id ? { ...l, ...updates } : l))
      );
      return null;
    }
  };

  const deleteLead = async (id: string): Promise<boolean> => {
    try {
      await api.delete(`/leads/${id}`, { showErrorToast: false });
      setLeads((prev) => prev.filter((l) => (l.id || l._id) !== id));
      return true;
    } catch {
      setLeads((prev) => prev.filter((l) => (l.id || l._id) !== id));
      return true;
    }
  };

  const bulkAssignLeads = async (leadIds: string[], assignedTo: string[]): Promise<boolean> => {
    try {
      await api.put("/leads/bulk-assign", { leadIds, assignedTo });
      setLeads((prev) =>
        prev.map((l) =>
          leadIds.includes(l.id || l._id || "") ? { ...l, assignedTo } : l
        )
      );
      toast.success("Leads assigned successfully");
      return true;
    } catch (err: any) {
      toast.error(err?.message || "Failed to bulk assign leads");
      return false;
    }
  };

  const bulkDeleteLeads = async (leadIds: string[]): Promise<boolean> => {
    try {
      await api.post("/leads/bulk-delete", { leadIds });
      setLeads((prev) =>
        prev.filter((l) => !leadIds.includes(l.id || l._id || ""))
      );
      toast.success("Leads deleted successfully");
      return true;
    } catch (err: any) {
      toast.error(err?.message || "Failed to bulk delete leads");
      return false;
    }
  };

  const addFollowUp = async (
    leadId: string,
    note: string,
    nextFollowUpDate?: string | null,
    actionType?: string,
    nextFollowUpTime?: string
  ): Promise<boolean> => {
    try {
      const payload: any = {
        note,
        nextFollowUpDate: nextFollowUpDate ?? null,
        action_type: actionType || "Call",
        date: new Date().toISOString(),
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      if (nextFollowUpTime) {
        payload.next_follow_up_time = nextFollowUpTime;
      }
      await api.post(`/leads/${leadId}/follow-ups`, payload);
      await fetchLeads();
      return true;
    } catch (err: any) {
      // Local fallback
      setLeads((prev) =>
        prev.map((l) => {
          if ((l.id || l._id) === leadId) {
            const followUps = l.followUps || [];
            const safeNextDate = nextFollowUpDate !== undefined ? nextFollowUpDate : (l.nextFollowUpDate ?? null);
            return {
              ...l,
              nextFollowUpDate: safeNextDate,
              followUps: [
                ...followUps,
                {
                  note,
                  action_type: actionType || "Call",
                  date: new Date().toISOString(),
                  time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                  nextFollowUpDate: nextFollowUpDate ?? null,
                  next_follow_up_time: nextFollowUpTime || null,
                } as any,
              ],
            };
          }
          return l;
        })
      );
      return true;
    }
  };

  const activeLeads = useMemo(() => {
    return leads.filter((l) => !["Client Won", "Won", "Client Lost", "Lost"].includes(l.status || l.stage || ""));
  }, [leads]);

  const wonLeads = useMemo(() => {
    return leads.filter((l) => ["Client Won", "Won"].includes(l.status || l.stage || ""));
  }, [leads]);

  const lostLeads = useMemo(() => {
    return leads.filter((l) => ["Client Lost", "Lost"].includes(l.status || l.stage || ""));
  }, [leads]);

  const pipelineValue = useMemo(() => {
    return activeLeads.reduce((acc, l) => acc + (Number(l.budget || l.expectedIncome) || 0), 0);
  }, [activeLeads]);

  const wonRevenue = useMemo(() => {
    return wonLeads.reduce((acc, l) => acc + (Number(l.budget || l.expectedIncome) || 0), 0);
  }, [wonLeads]);

  const winRate = useMemo(() => {
    const totalClosed = wonLeads.length + lostLeads.length;
    return totalClosed > 0 ? Math.round((wonLeads.length / totalClosed) * 100) : 0;
  }, [wonLeads, lostLeads]);

  const todayStr = new Date().toISOString().split("T")[0] || "";

  const todayFollowUps = useMemo(() => {
    return leads.filter((l) => {
      const dt = String(l.nextFollowUpDate || "").split("T")[0];
      return dt === todayStr;
    });
  }, [leads, todayStr]);

  const overdueFollowUps = useMemo(() => {
    return leads.filter((l) => {
      const dt = String(l.nextFollowUpDate || "").split("T")[0];
      return dt && dt < todayStr && !["Client Won", "Won", "Client Lost", "Lost"].includes(l.status || l.stage || "");
    });
  }, [leads, todayStr]);

  const hotLeads = useMemo(() => {
    return leads.filter((l) => l.isHot && !["Client Won", "Won", "Client Lost", "Lost"].includes(l.status || l.stage || ""));
  }, [leads]);

  return (
    <SalesContext.Provider
      value={{
        leads,
        setLeads,
        stages,
        setStages,
        salesSettings,
        fetchSettings,
        updateSalesSettings,
        summary,
        fetchSummary,
        tasks,
        setTasks,
        targets,
        setTargets,
        isLoading,
        fetchLeads,
        fetchTargets,
        addLead,
        updateLead,
        deleteLead,
        bulkAssignLeads,
        bulkDeleteLeads,
        addFollowUp,
        activeLeads,
        wonLeads,
        lostLeads,
        pipelineValue,
        wonRevenue,
        winRate,
        todayFollowUps,
        overdueFollowUps,
        hotLeads,
      }}
    >
      {children}
    </SalesContext.Provider>
  );
}

export function useSales() {
  const context = useContext(SalesContext);
  if (context === undefined) {
    throw new Error("useSales must be used within a SalesProvider");
  }
  return context;
}
