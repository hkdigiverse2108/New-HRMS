import { useState, useRef, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { DialogClose, Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Building2, Users, MapPin, DollarSign, Calendar, Target,
  Briefcase, TrendingUp, CheckCircle2, ShieldAlert, BadgeCent,
  Pencil, Trash2, Settings, Plus, Shuffle, Bell, Shield, History,
  Check, X, Gem, UtensilsCrossed, Stethoscope, GraduationCap, MessageSquare,
  HeartPulse, Factory, Shirt, Landmark, Car, Plane, Cpu,
  Scissors, Dumbbell, HardHat, Shapes, ChevronUp, ChevronDown, ChevronRight,
  RefreshCw, Search, Lock
} from "lucide-react";
import { toast } from "@/lib/toast";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { useSales } from "./SalesContext";
import { useEmployeesContext } from "@/components/employees/EmployeeContext";
import { moveToRecycleBin } from "@/lib/recycle-bin";
import { api } from "@/lib/api";

const TABS = ["Pipeline Stages", "Lead Categories", "Lead Sources", "Assignment", "Follow-ups", "Notifications", "Permissions", "Audit Log"] as const;
type Tab = typeof TABS[number];

const INITIAL_LEAD_CATEGORIES = [
  { name: "Jewellery", icon: Gem, color: "bg-amber-500", iconName: "Gem" },
  { name: "Restaurants", icon: UtensilsCrossed, color: "bg-orange-500", iconName: "UtensilsCrossed" },
  { name: "Real Estate", icon: Building2, color: "bg-emerald-600", iconName: "Building2" },
  { name: "Doctors", icon: Stethoscope, color: "bg-blue-500", iconName: "Stethoscope" },
  { name: "Education", icon: GraduationCap, color: "bg-primary", iconName: "GraduationCap" },
  { name: "Hospital", icon: HeartPulse, color: "bg-rose-500", iconName: "HeartPulse" },
  { name: "Manufacturing", icon: Factory, color: "bg-muted/500", iconName: "Factory" },
  { name: "Textile", icon: Shirt, color: "bg-orange-600", iconName: "Shirt" },
  { name: "Finance", icon: Landmark, color: "bg-teal-600", iconName: "Landmark" },
  { name: "Automobile", icon: Car, color: "bg-card", iconName: "Car" },
  { name: "Travel", icon: Plane, color: "bg-sky-500", iconName: "Plane" },
  { name: "IT Company", icon: Cpu, color: "bg-primary", iconName: "Cpu" },
  { name: "Salon", icon: Scissors, color: "bg-pink-500", iconName: "Scissors" },
  { name: "Gym", icon: Dumbbell, color: "bg-green-600", iconName: "Dumbbell" },
  { name: "Construction", icon: HardHat, color: "bg-yellow-700", iconName: "HardHat" },
  { name: "Others", icon: Shapes, color: "bg-slate-400", iconName: "Shapes" },
];

const INITIAL_LEAD_SOURCES = [
  "Meta Ads", "Google Ads", "Instagram", "Facebook", "WhatsApp",
  "Website", "Reference", "Cold Calling", "LinkedIn", "Walk-in",
  "Exhibition", "BNI", "PBN", "Organic", "Others"
];

const AVAILABLE_ICONS = [
  { name: "Gem", icon: Gem }, { name: "Utensils", icon: UtensilsCrossed },
  { name: "Building", icon: Building2 }, { name: "Stethoscope", icon: Stethoscope },
  { name: "Education", icon: GraduationCap }, { name: "Heart", icon: HeartPulse },
  { name: "Factory", icon: Factory }, { name: "Shirt", icon: Shirt },
  { name: "Landmark", icon: Landmark }, { name: "Car", icon: Car },
  { name: "Plane", icon: Plane }, { name: "Cpu", icon: Cpu },
  { name: "Scissors", icon: Scissors }, { name: "Dumbbell", icon: Dumbbell },
  { name: "HardHat", icon: HardHat }, { name: "Shapes", icon: Shapes },
];

const getIconComponent = (iconName: string) => {
  const match = AVAILABLE_ICONS.find(i => i.name === iconName);
  return match ? match.icon : Shapes;
};

const COLORS = [
  "bg-amber-500", "bg-orange-500", "bg-emerald-600", "bg-blue-500",
  "bg-primary", "bg-rose-500", "bg-muted/500", "bg-teal-600",
  "bg-sky-500", "bg-pink-500", "bg-green-600", "bg-yellow-700"
];

const ASSIGNMENT_RULES = [
  { name: "Auto Assignment", active: true },
  { name: "Round Robin", active: true },
  { name: "Manual Assignment", active: false },
  { name: "Department Wise", active: false },
  { name: "Region Wise", active: false },
  { name: "Business Category Wise", active: false },
];

const ELIGIBLE_OWNERS = [
  "Het Kansara · CEO", "Riya Mehta · Sales Head", "Aarav Shah · Sales Executive",
  "Neha Verma · Sales Executive", "Karan Patel · Sales Executive",
  "Simran Kaur · Sales Executive", "Devansh Rao · Admin"
];

const NOTIFICATIONS = [
  { title: "New Lead Assigned", subtitle: "Skyline Realtors assigned to Riya Mehta", active: true },
  { title: "Follow-up Reminder", subtitle: "42 follow-ups are due today", active: true },
  { title: "Meeting Reminder", subtitle: "Demo with CloudNova Labs at 3:30 PM", active: true },
  { title: "Target Achieved", subtitle: "Aarav Shah crossed 115% of monthly target", active: true },
  { title: "Lead Converted", subtitle: "Zenith Diamonds moved to Won — ₹6,20,000", active: true },
  { title: "Payment Received", subtitle: "₹2,40,000 received from Precision Industries", active: true },
  { title: "Proposal Approved", subtitle: "Urban Tandoor approved quotation QT-4398", active: true },
];

const INITIAL_PERMISSIONS = [
  { role: "CEO", perms: ["View all leads", "Edit all", "Delete leads", "Manage targets", "Manage users", "View audit log"] },
  { role: "Admin", perms: ["View all leads", "Edit all", "Delete leads", "Manage settings", "View audit log"] },
  { role: "Sales Head", perms: ["View team leads", "Assign leads", "Approve proposals", "Bulk edit"] },
  { role: "Sales Executive", perms: ["View own leads", "Add lead", "Log follow-up", "Create quotation"] },
];

const AVAILABLE_PERMISSIONS = [
  "View all leads", "View team leads", "View own leads",
  "Add lead", "Edit all", "Bulk edit", "Delete leads",
  "Assign leads", "Manage targets", "Manage users",
  "Manage settings", "View audit log", "Approve proposals",
  "Log follow-up", "Create quotation"
];

const AUDIT_LOG = [
  { action: "Moved Skyline Realtors to Negotiation", by: "by Riya Mehta", time: "Today 11:42" },
  { action: "Deleted duplicate lead LD-1043", by: "by Het Kansara", time: "Today 10:07" },
  { action: "Created quotation QT-4412 (₹4,50,000)", by: "by Aarav Shah", time: "Yesterday 18:20" },
  { action: "Round-robin assigned 12 new Meta Ads leads", by: "by System", time: "Yesterday 09:00" },
  { action: "Updated budget for BrightMind Academy", by: "by Neha Verma", time: "28 Jul 16:11" },
];

function ToggleSwitch({ active, onChange }: { active: boolean; onChange?: (newVal: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange?.(!active)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
        active ? "bg-emerald-500" : "bg-muted"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
          active ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );
}

export function SalesSettings() {
  const { stages, setStages, leads, todayFollowUps, salesSettings, updateSalesSettings, fetchLeads, fetchSummary } = useSales();
  const { employees } = useEmployeesContext();
  const [activeTab, setActiveTab] = useState<Tab>("Lead Categories");

  // Assignment Rules & Eligible Owners State (Audio 7 & 8)
  const [assignmentRules, setAssignmentRules] = useState<any[]>(() => {
    return salesSettings?.assignment_rules || ASSIGNMENT_RULES;
  });

  const [selectedEligibleOwners, setSelectedEligibleOwners] = useState<string[]>(() => {
    return salesSettings?.eligible_owners || [];
  });

  // Keep synced with salesSettings
  useEffect(() => {
    if (salesSettings?.assignment_rules && salesSettings.assignment_rules.length > 0) {
      setAssignmentRules(salesSettings.assignment_rules);
    }
    if (salesSettings?.eligible_owners) {
      setSelectedEligibleOwners(salesSettings.eligible_owners);
    }
  }, [salesSettings]);

  // Live Audit Logs State (Audio 8 [04:32])
  const [liveAuditLogs, setLiveAuditLogs] = useState<any[]>([]);
  const [auditSearchTerm, setAuditSearchTerm] = useState("");
  const [isLoadingAuditLogs, setIsLoadingAuditLogs] = useState(false);

  const fetchLiveAuditLogs = async (searchQuery = "") => {
    setIsLoadingAuditLogs(true);
    try {
      const q = searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : "";
      const res = await api.get<any[]>(`/sales/audit-logs${q}`, { showErrorToast: false });
      if (Array.isArray(res)) {
        setLiveAuditLogs(res);
      }
    } catch {
      // Fallback
    } finally {
      setIsLoadingAuditLogs(false);
    }
  };

  useEffect(() => {
    if (activeTab === "Audit Log") {
      fetchLiveAuditLogs(auditSearchTerm);
    }
  }, [activeTab]);

  const handleToggleAssignmentRule = async (idx: number) => {
    const updated = assignmentRules.map((r, i) => (i === idx ? { ...r, active: !r.active } : r));
    setAssignmentRules(updated);
    await updateSalesSettings({ assignment_rules: updated });
    toast.success("Assignment rule updated");
  };

  const handleToggleEligibleOwner = async (ownerName: string) => {
    const cleanName = ownerName.includes("·") ? (ownerName.split("·")[0] || ownerName).trim() : ownerName.trim();
    const exists = selectedEligibleOwners.some(
      (o) => (o.includes("·") ? (o.split("·")[0] || o).trim() : o.trim()) === cleanName
    );
    const updated = exists
      ? selectedEligibleOwners.filter(
        (o) => (o.includes("·") ? (o.split("·")[0] || o).trim() : o.trim()) !== cleanName
      )
      : [...selectedEligibleOwners, ownerName];
    setSelectedEligibleOwners(updated);
    await updateSalesSettings({ eligible_owners: updated });
    toast.success(`${cleanName} ${exists ? "removed from" : "added to"} Auto-Assignment queue`);
  };

  const eligibleOwners = useMemo(() => {
    if (employees && employees.length > 0) {
      return employees.map((e) => `${e.name} · ${e.role || e.designation || e.department || "Team Member"}`);
    }
    return ELIGIBLE_OWNERS;
  }, [employees]);

  const dynamicNotifications = useMemo(() => {
    return [
      { title: "New Lead Assigned", subtitle: "Instant alerts when leads are assigned to you", active: true },
      { title: "Follow-up Reminder", subtitle: `${todayFollowUps} follow-ups are due today`, active: true },
      { title: "Meeting Reminder", subtitle: "Reminders for scheduled demos & client visits", active: true },
      { title: "Target Achieved", subtitle: "Alerts when members cross monthly revenue milestones", active: true },
      { title: "Lead Converted", subtitle: "Live notifications when a deal moves to Won", active: true },
      { title: "Payment Received", subtitle: "Alerts when collection amounts are confirmed", active: true },
      { title: "Proposal Approved", subtitle: "Notifications when quotations are accepted", active: true },
    ];
  }, [todayFollowUps]);

  const dynamicAuditLogs = useMemo(() => {
    const logs: { action: string; by: string; time: string }[] = [];
    leads.slice(0, 10).forEach((l) => {
      if (l.followUps && l.followUps.length > 0) {
        l.followUps.slice(0, 2).forEach((f) => {
          logs.push({
            action: `Follow-up on ${l.company || l.contact}: "${f.note}"`,
            by: `by ${f.performedBy || l.owner || "Sales User"}`,
            time: f.date || "Recent",
          });
        });
      } else {
        logs.push({
          action: `Lead "${l.company || l.contact}" in stage ${l.stage || l.status || "Pipeline"}`,
          by: `by ${l.createdByUserName || l.owner || "Sales User"}`,
          time: l.date || l.createdAt || "Recent",
        });
      }
    });
    return logs.length > 0 ? logs.slice(0, 8) : AUDIT_LOG;
  }, [leads]);

  const persistStages = async (stageNames: string[]) => {
    const payload = stageNames.map((name, idx) => ({
      name,
      index: idx,
      is_default: idx === 0,
      color: salesSettings?.stages?.[idx]?.color || "bg-primary",
    }));
    setStages(stageNames);
    await updateSalesSettings({ stages: payload } as any);
  };

  const moveStage = async (index: number, direction: 'up' | 'down') => {
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= stages.length) return;
    const updated = [...stages];
    const temp = updated[index];
    const nextVal = updated[nextIndex];
    if (temp !== undefined && nextVal !== undefined) {
      updated[index] = nextVal;
      updated[nextIndex] = temp;
      await persistStages(updated);
      toast.success("Pipeline stages reordered!");
    }
  };

  // Categories / Sources / Follow-up types — fully backend-driven, synced from salesSettings
  const [categories, setCategories] = useState<any[]>(() => salesSettings?.categories?.map((c: any) => ({ ...c, icon: getIconComponent(c.iconName) })) || INITIAL_LEAD_CATEGORIES);
  const [sources, setSources] = useState<string[]>(() => salesSettings?.sources || INITIAL_LEAD_SOURCES);
  const [followUpTypes, setFollowUpTypes] = useState<any[]>(() => salesSettings?.follow_up_types || []);
  const [notificationsState, setNotificationsState] = useState<any[]>(() => salesSettings?.notifications || []);
  const [permissions, setPermissions] = useState<any[]>(() => salesSettings?.role_permissions || INITIAL_PERMISSIONS);
  useEffect(() => {
    if (salesSettings?.role_permissions && salesSettings.role_permissions.length > 0) {
      setPermissions(salesSettings.role_permissions);
    }
  }, [salesSettings?.role_permissions]);
  const [paymentVisibility, setPaymentVisibility] = useState<{ allowed_roles: string[]; allowed_employee_names: string[] }>(() => ({
    allowed_roles: salesSettings?.payment_visibility?.allowed_roles || ["Admin", "SuperAdmin", "CEO", "Sales Head"],
    allowed_employee_names: salesSettings?.payment_visibility?.allowed_employee_names || [],
  }));

  useEffect(() => {
    if (salesSettings?.categories && salesSettings.categories.length > 0) {
      setCategories(salesSettings.categories.map((c: any) => ({ ...c, icon: getIconComponent(c.iconName || c.icon_name) })));
    }
  }, [salesSettings?.categories]);
  useEffect(() => {
    if (salesSettings?.sources && salesSettings.sources.length > 0) {
      setSources(salesSettings.sources);
    }
  }, [salesSettings?.sources]);
  useEffect(() => {
    if (salesSettings?.follow_up_types) {
      setFollowUpTypes(salesSettings.follow_up_types);
    }
  }, [salesSettings?.follow_up_types]);
  useEffect(() => {
    if (salesSettings?.notifications && salesSettings.notifications.length > 0) {
      setNotificationsState(salesSettings.notifications);
    }
  }, [salesSettings?.notifications]);
  useEffect(() => {
    if (salesSettings?.payment_visibility) {
      setPaymentVisibility({
        allowed_roles: salesSettings.payment_visibility.allowed_roles || [],
        allowed_employee_names: salesSettings.payment_visibility.allowed_employee_names || [],
      });
    }
  }, [salesSettings?.payment_visibility]);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newSourceName, setNewSourceName] = useState("");
  const [newStageName, setNewStageName] = useState("");
  const [newCategoryIconIdx, setNewCategoryIconIdx] = useState(0);
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    type: "category" | "source" | "stage" | null;
    index: number;
    name: string;
  }>({ isOpen: false, type: null, index: -1, name: "" });

  const [editRoleIdx, setEditRoleIdx] = useState<number | null>(null);
  const [tempPerms, setTempPerms] = useState<string[]>([]);

  // Edit States
  const [editingCategoryIdx, setEditingCategoryIdx] = useState<number | null>(null);
  const [editCategoryName, setEditCategoryName] = useState("");
  const [editCategoryIconIdx, setEditCategoryIconIdx] = useState(0);
  const [isEditIconPickerOpen, setIsEditIconPickerOpen] = useState(false);

  const [editingSourceIdx, setEditingSourceIdx] = useState<number | null>(null);
  const [editSourceName, setEditSourceName] = useState("");

  const [editingStageIdx, setEditingStageIdx] = useState<number | null>(null);
  const [editStageName, setEditStageName] = useState("");

  const handleEditPermissions = (idx: number) => {
    const rolePerms = permissions[idx]?.perms;
    if (rolePerms) {
      setTempPerms([...rolePerms]);
      setEditRoleIdx(idx);
    }
  };

  const handleSavePermissions = async () => {
    if (editRoleIdx !== null && permissions[editRoleIdx]) {
      const updated = [...permissions];
      const role = updated[editRoleIdx];
      if (role) {
        role.perms = [...tempPerms];
        setPermissions(updated);
        await updateSalesSettings({ role_permissions: updated } as any);
        toast.success(`${role.role} permissions updated`);
      }
    }
    setEditRoleIdx(null);
  };

  const handleTogglePerm = (p: string) => {
    setTempPerms(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    );
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error("Please enter a category name first");
      return;
    }
    const selectedIcon = AVAILABLE_ICONS[newCategoryIconIdx];
    if (!selectedIcon) return;
    const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)] || "bg-muted/500";
    const updated = [{
      name: newCategoryName.trim(),
      icon: selectedIcon.icon,
      color: randomColor,
      iconName: selectedIcon.name
    }, ...categories];
    setCategories(updated);
    await updateSalesSettings({ categories: updated.map(({ icon, ...rest }: any) => rest) } as any);
    setNewCategoryName("");
    setNewCategoryIconIdx(0);
    toast.success("Category added successfully");
  };

  const confirmDeleteCategory = (idx: number, name: string) => {
    setDeleteConfirm({ isOpen: true, type: "category", index: idx, name });
  };

  const handleAddSource = async () => {
    if (!newSourceName.trim()) {
      toast.error("Please enter a lead source name first");
      return;
    }
    const updated = [newSourceName.trim(), ...sources];
    setSources(updated);
    await updateSalesSettings({ sources: updated } as any);
    setNewSourceName("");
    toast.success("Lead source added");
  };

  const confirmDeleteSource = (idx: number, name: string) => {
    setDeleteConfirm({ isOpen: true, type: "source", index: idx, name });
  };

  const handleAddStage = async () => {
    if (!newStageName.trim()) {
      toast.error("Please enter a stage name first");
      return;
    }
    await persistStages([...stages, newStageName.trim()]);
    setNewStageName("");
    toast.success("Pipeline stage added");
  };

  const confirmDeleteStage = (idx: number, name: string) => {
    setDeleteConfirm({ isOpen: true, type: "stage", index: idx, name });
  };

  const executeDelete = async () => {
    if (deleteConfirm.type === "category") {
      const item = categories[deleteConfirm.index];
      if (item) {
        moveToRecycleBin('Lead Category', item.name, item, 'hrms_sales_categories');
      }
      const updated = categories.filter((_: any, i: number) => i !== deleteConfirm.index);
      setCategories(updated);
      await updateSalesSettings({ categories: updated.map(({ icon, ...rest }: any) => rest) } as any);
      try {
        await api.post("/sales/settings/reassign-category", { deleted_name: deleteConfirm.name, default_name: "Others" }, { showErrorToast: false });
        await fetchLeads();
        await fetchSummary();
      } catch { /* ignore */ }
      toast.success(`${deleteConfirm.name} deleted successfully`);
    } else if (deleteConfirm.type === "source") {
      const item = sources[deleteConfirm.index];
      if (item) {
        moveToRecycleBin('Lead Source', item, item, 'hrms_sales_sources');
      }
      const updated = sources.filter((_: any, i: number) => i !== deleteConfirm.index);
      setSources(updated);
      await updateSalesSettings({ sources: updated } as any);
      try {
        await api.post("/sales/settings/rename-source", { old_name: deleteConfirm.name, new_name: "Others" }, { showErrorToast: false });
        await fetchLeads();
        await fetchSummary();
      } catch { /* ignore */ }
      toast.success(`Lead source deleted`);
    } else if (deleteConfirm.type === "stage") {
      const item = stages[deleteConfirm.index];
      if (item) {
        moveToRecycleBin('Pipeline Stage', item, item, 'hrms_sales_stages');
      }
      const remaining = stages.filter((_: any, i: number) => i !== deleteConfirm.index);
      await persistStages(remaining);
      try {
        await api.post("/sales/settings/rename-stage", { old_name: deleteConfirm.name, new_name: remaining[0] || "New Lead" }, { showErrorToast: false });
        await fetchLeads();
        await fetchSummary();
      } catch { /* ignore */ }
      toast.success(`Pipeline stage deleted`);
    }
    setDeleteConfirm({ isOpen: false, type: null, index: -1, name: "" });
  };

  // Edit Handlers
  const startEditCategory = (idx: number) => {
    const cat = categories[idx];
    if (!cat) return;
    setEditingCategoryIdx(idx);
    setEditCategoryName(cat.name);
    const iconIdx = AVAILABLE_ICONS.findIndex(i => i.name === cat.iconName);
    setEditCategoryIconIdx(iconIdx !== -1 ? iconIdx : 0);
  };
  const saveEditCategory = async () => {
    if (editingCategoryIdx === null) return;
    if (!editCategoryName.trim()) {
      toast.error("Name cannot be empty");
      return;
    }
    const oldName = categories[editingCategoryIdx]?.name;
    const newName = editCategoryName.trim();
    const updated = [...categories];
    const iconObj = AVAILABLE_ICONS[editCategoryIconIdx];
    if (!iconObj || !updated[editingCategoryIdx]) return;
    updated[editingCategoryIdx] = {
      ...updated[editingCategoryIdx],
      name: newName,
      iconName: iconObj.name,
      icon: iconObj.icon
    };
    setCategories(updated);
    await updateSalesSettings({ categories: updated.map(({ icon, ...rest }: any) => rest) } as any);
    // Migrate existing leads so they don't get orphaned (Jewellery -> Jewellery1 issue)
    if (oldName && oldName !== newName) {
      try {
        const res = await api.post<{ migrated: number }>("/sales/settings/rename-category", { old_name: oldName, new_name: newName }, { showErrorToast: false });
        await fetchLeads();
        await fetchSummary();
        toast.success(`Category updated (${res.migrated} leads migrated)`);
      } catch {
        toast.success("Category updated");
      }
    } else {
      toast.success("Category updated");
    }
    setEditingCategoryIdx(null);
  };

  const startEditSource = (idx: number) => {
    const src = sources[idx];
    if (!src) return;
    setEditingSourceIdx(idx);
    setEditSourceName(src);
  };
  const saveEditSource = async () => {
    if (editingSourceIdx === null) return;
    if (!editSourceName.trim()) {
      toast.error("Name cannot be empty");
      return;
    }
    const oldName = sources[editingSourceIdx];
    const newName = editSourceName.trim();
    const updated = [...sources];
    updated[editingSourceIdx] = newName;
    setSources(updated);
    await updateSalesSettings({ sources: updated } as any);
    if (oldName && oldName !== newName) {
      try {
        const res = await api.post<{ migrated: number }>("/sales/settings/rename-source", { old_name: oldName, new_name: newName }, { showErrorToast: false });
        await fetchLeads();
        await fetchSummary();
        toast.success(`Lead source updated (${res.migrated} leads migrated)`);
      } catch {
        toast.success("Lead source updated");
      }
    } else {
      toast.success("Lead source updated");
    }
    setEditingSourceIdx(null);
  };

  const startEditStage = (idx: number) => {
    const stage = stages[idx];
    if (!stage) return;
    setEditingStageIdx(idx);
    setEditStageName(stage);
  };
  const saveEditStage = async () => {
    if (editingStageIdx === null) return;
    if (!editStageName.trim()) {
      toast.error("Name cannot be empty");
      return;
    }
    const oldName = stages[editingStageIdx];
    const newName = editStageName.trim();
    const updated = [...stages];
    updated[editingStageIdx] = newName;
    await persistStages(updated);
    if (oldName && oldName !== newName) {
      try {
        await api.post("/sales/settings/rename-stage", { old_name: oldName, new_name: newName }, { showErrorToast: false });
        await fetchLeads();
        await fetchSummary();
      } catch { /* history already tracked per-lead on next move */ }
    }
    setEditingStageIdx(null);
    toast.success("Pipeline stage updated");
  };

  const handleToggleNotification = async (idx: number) => {
    const updated = notificationsState.map((n, i) => (i === idx ? { ...n, active: !n.active } : n));
    setNotificationsState(updated);
    await updateSalesSettings({ notifications: updated } as any);
  };

  const [newFollowUpLabel, setNewFollowUpLabel] = useState("");
  const handleAddFollowUpType = async () => {
    if (!newFollowUpLabel.trim()) {
      toast.error("Enter follow-up button name");
      return;
    }
    const updated = [...followUpTypes, { label: newFollowUpLabel.trim(), note: newFollowUpLabel.trim(), action: newFollowUpLabel.trim(), offset_hours: 24, active: true }];
    setFollowUpTypes(updated);
    await updateSalesSettings({ follow_up_types: updated } as any);
    setNewFollowUpLabel("");
    toast.success("Follow-up button added");
  };
  const handleToggleFollowUpType = async (idx: number) => {
    const updated = followUpTypes.map((f, i) => (i === idx ? { ...f, active: !f.active } : f));
    setFollowUpTypes(updated);
    await updateSalesSettings({ follow_up_types: updated } as any);
  };
  const handleDeleteFollowUpType = async (idx: number) => {
    const updated = followUpTypes.filter((_, i) => i !== idx);
    setFollowUpTypes(updated);
    await updateSalesSettings({ follow_up_types: updated } as any);
    toast.success("Follow-up button removed");
  };

  const handleTogglePaymentRole = async (role: string) => {
    const exists = paymentVisibility.allowed_roles.includes(role);
    const updatedRoles = exists ? paymentVisibility.allowed_roles.filter((r) => r !== role) : [...paymentVisibility.allowed_roles, role];
    const updated = { ...paymentVisibility, allowed_roles: updatedRoles };
    setPaymentVisibility(updated);
    await updateSalesSettings({ payment_visibility: { allowed_roles: updatedRoles, allowed_employee_ids: [], allowed_employee_names: paymentVisibility.allowed_employee_names } } as any);
  };
  const handleTogglePaymentPerson = async (personName: string) => {
    const clean = (n: string) => (n.includes("·") ? (n.split("·")[0] || n).trim() : n.trim());
    const exists = paymentVisibility.allowed_employee_names.some((n) => clean(n) === clean(personName));
    const updatedNames = exists ? paymentVisibility.allowed_employee_names.filter((n) => clean(n) !== clean(personName)) : [...paymentVisibility.allowed_employee_names, personName];
    const updated = { ...paymentVisibility, allowed_employee_names: updatedNames };
    setPaymentVisibility(updated);
    await updateSalesSettings({ payment_visibility: { allowed_roles: paymentVisibility.allowed_roles, allowed_employee_ids: [], allowed_employee_names: updatedNames } } as any);
    toast.success(`${personName} ${exists ? "removed from" : "granted"} payment visibility`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-black tracking-tight">CRM Settings</h1>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">Live</span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Categories, sources, assignment rules, permissions and audit trail</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-nowrap items-center gap-1.5 rounded-full bg-muted/40 p-1 w-full sm:w-fit overflow-x-auto max-w-full">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 min-h-[44px] sm:min-h-0",
              activeTab === tab
                ? "bg-white text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="rounded-3xl border border-emerald-100/50 bg-emerald-50/10 p-4 sm:p-6 md:p-8">

        {/* Pipeline Stages Tab */}
        {activeTab === "Pipeline Stages" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6 text-left">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <input
                type="text"
                placeholder="e.g. Contract Signed"
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddStage()}
                className="w-full sm:w-80 rounded-xl border border-border bg-white px-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-emerald-500/20 font-semibold text-foreground"
              />
              <button
                onClick={handleAddStage}
                className="flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-5 py-2.5 text-xs font-bold text-white transition-all hover:bg-emerald-800 shadow-sm"
              >
                <Plus className="h-4 w-4" /> Add Stage
              </button>
            </div>

            {/* Visual Pathway Preview */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-3">Pathway Preview</p>
              <div className="overflow-x-auto pb-3 pt-1 scrollbar-none">
                <div className="flex items-center gap-2 min-w-max p-1.5 bg-muted/40 rounded-2xl border border-border/50">
                  {stages.map((stage: string, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 px-3 py-1.5 bg-white border border-border/60 rounded-xl shadow-sm text-xs font-bold text-foreground"
                    >
                      <span className="grid h-4.5 w-4.5 place-items-center rounded bg-emerald-100 text-emerald-700 border border-emerald-200 text-[9px] font-black">
                        {idx + 1}
                      </span>
                      <span>{stage}</span>
                      {idx < stages.length - 1 && (
                        <ChevronRight className="w-3 h-3 text-muted-foreground/40 ml-1" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* List and Actions */}
            <div className="space-y-3 max-w-2xl">
              <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Manage Pipeline Sequence</p>
              {stages.map((stage: string, i: number) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-2xl border border-border bg-white p-4 shadow-sm hover:shadow-md hover:border-emerald-600/20 transition-all group"
                >
                  {editingStageIdx === i ? (
                    <div className="flex items-center gap-2.5 w-full">
                      <input
                        value={editStageName}
                        onChange={(e) => setEditStageName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveEditStage()}
                        className="flex-1 rounded-xl border border-border px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-semibold text-foreground bg-muted/20"
                        autoFocus
                      />
                      <button onClick={saveEditStage} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors" title="Save"><Check className="h-4 w-4" /></button>
                      <button onClick={() => setEditingStageIdx(null)} className="p-2 text-muted-foreground hover:bg-muted rounded-xl transition-colors" title="Cancel"><X className="h-4 w-4" /></button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-inner">
                          {i + 1}
                        </span>
                        <span className="text-sm font-black text-foreground tracking-tight truncate">{stage}</span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={i === 0}
                          onClick={() => moveStage(i, 'up')}
                          className="p-1.5 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg disabled:opacity-30 disabled:pointer-events-none transition-all"
                          title="Move Up"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          disabled={i === stages.length - 1}
                          onClick={() => moveStage(i, 'down')}
                          className="p-1.5 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg disabled:opacity-30 disabled:pointer-events-none transition-all"
                          title="Move Down"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>

                        <div className="w-[1px] h-4 bg-border/60 mx-1"></div>

                        <button
                          type="button"
                          onClick={() => startEditStage(i)}
                          className="p-1.5 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 inline-flex items-center justify-center text-muted-foreground hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Edit Stage"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => confirmDeleteStage(i, stage)}
                          className="p-1.5 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 inline-flex items-center justify-center text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete Stage"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lead Categories Tab */}
        {activeTab === "Lead Categories" && (
          <div className="animate-in fade-in slide-in-from-bottom-2">
            <div className="mb-8 flex flex-col sm:flex-row items-center gap-4 relative">
              <div className="relative flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => setIsIconPickerOpen(!isIconPickerOpen)}
                  className="flex shrink-0 items-center justify-center h-11 w-11 rounded-full border border-border bg-white hover:bg-muted transition-colors shadow-sm"
                  title="Choose Icon"
                >
                  {(() => {
                    const IconComp = AVAILABLE_ICONS[newCategoryIconIdx]?.icon;
                    return IconComp ? <IconComp className="h-5 w-5 text-emerald-600" /> : null;
                  })()}
                </button>

                {isIconPickerOpen && (
                  <div className="absolute top-14 left-0 z-20 w-64 rounded-2xl border border-border bg-white p-3 shadow-xl grid grid-cols-4 gap-2 animate-in fade-in zoom-in-95">
                    {AVAILABLE_ICONS.map((iconObj, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setNewCategoryIconIdx(idx);
                          setIsIconPickerOpen(false);
                        }}
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
                          idx === newCategoryIconIdx
                            ? "bg-emerald-100 text-emerald-700"
                            : "text-muted-foreground hover:bg-emerald-50 hover:text-emerald-600"
                        )}
                        title={iconObj.name}
                      >
                        <iconObj.icon className="h-5 w-5" />
                      </button>
                    ))}
                  </div>
                )}

                <input
                  type="text"
                  placeholder="New category name"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                  className="w-full sm:w-80 rounded-full border border-border bg-white px-5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>
              <button
                onClick={handleAddCategory}
                className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-emerald-700 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-800"
              >
                <Plus className="h-4 w-4" /> Add Category
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((cat: any, i: number) => (
                <div key={i} className="flex items-center justify-between rounded-2xl border border-border bg-white p-4 transition-shadow hover:shadow-sm">
                  {editingCategoryIdx === i ? (
                    <div className="flex flex-col gap-2 w-full relative">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setIsEditIconPickerOpen(!isEditIconPickerOpen)}
                          className={cn("flex shrink-0 items-center justify-center h-10 w-10 rounded-full text-white", cat.color)}
                          title="Choose Icon"
                        >
                          {(() => {
                            const IconComp = AVAILABLE_ICONS[editCategoryIconIdx]?.icon;
                            return IconComp ? <IconComp className="h-5 w-5" /> : null;
                          })()}
                        </button>
                        <input
                          value={editCategoryName}
                          onChange={(e) => setEditCategoryName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && saveEditCategory()}
                          className="flex-1 rounded-md border border-border px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
                          autoFocus
                        />
                      </div>

                      {isEditIconPickerOpen && (
                        <div className="absolute top-12 left-0 z-20 w-64 rounded-2xl border border-border bg-white p-3 shadow-xl grid grid-cols-4 gap-2 animate-in fade-in zoom-in-95">
                          {AVAILABLE_ICONS.map((iconObj, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                setEditCategoryIconIdx(idx);
                                setIsEditIconPickerOpen(false);
                              }}
                              className={cn(
                                "flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
                                idx === editCategoryIconIdx
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "text-muted-foreground hover:bg-emerald-50 hover:text-emerald-600"
                              )}
                              title={iconObj.name}
                            >
                              <iconObj.icon className="h-5 w-5" />
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="px-6 md:px-8 py-4 md:py-6 bg-muted/30 border-t border-border/50 flex justify-end gap-3 mt-auto shrink-0">
                        <button onClick={saveEditCategory} className="text-emerald-600 hover:text-emerald-700 font-medium text-sm">Save</button>
                        <button onClick={() => { setEditingCategoryIdx(null); setIsEditIconPickerOpen(false); }} className="text-muted-foreground hover:text-foreground font-medium text-sm">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-4">
                        <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full text-white", cat.color)}>
                          {(() => {
                            const IconComponent = getIconComponent(cat.iconName);
                            return <IconComponent className="h-5 w-5" />;
                          })()}
                        </div>
                        <div>
                          <p className="font-bold text-sm">{cat.name}</p>
                          <p className="text-[11px] text-muted-foreground">Icon: {cat.iconName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <button onClick={() => startEditCategory(i)} className="hover:text-foreground"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => confirmDeleteCategory(i, cat.name)} className="hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lead Sources Tab */}
        {activeTab === "Lead Sources" && (
          <div className="animate-in fade-in slide-in-from-bottom-2">
            <div className="mb-8 flex flex-col sm:flex-row items-center gap-4">
              <input
                type="text"
                placeholder="New lead source"
                value={newSourceName}
                onChange={(e) => setNewSourceName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddSource()}
                className="w-full sm:w-80 rounded-full border border-border bg-white px-5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
              <button
                onClick={handleAddSource}
                className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-emerald-700 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-800"
              >
                <Plus className="h-4 w-4" /> Add Source
              </button>
            </div>

            <div className="flex flex-wrap gap-3">
              {sources.map((source: any, i: number) => (
                <div key={i} className="flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/50">
                  {editingSourceIdx === i ? (
                    <div className="flex items-center gap-2">
                      <input
                        value={editSourceName}
                        onChange={(e) => setEditSourceName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveEditSource()}
                        className="w-24 rounded-md border border-border px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-emerald-500/30 bg-transparent"
                        autoFocus
                      />
                      <button onClick={saveEditSource} className="text-emerald-600 hover:text-emerald-700"><Check className="h-3.5 w-3.5" /></button>
                      <button onClick={() => setEditingSourceIdx(null)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  ) : (
                    <>
                      {source}
                      <button onClick={() => startEditSource(i)} className="ml-1 text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => confirmDeleteSource(i, source)} className="text-rose-400 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Assignment Tab */}
        {activeTab === "Assignment" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-bold">
                  <Shuffle className="h-5 w-5 text-emerald-600" /> Lead Auto-Assignment Rules
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Configure intelligent sequential round-robin routing across your sales force
                </p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
                {selectedEligibleOwners.length} Active in Rotation
              </span>
            </div>

            <div className="space-y-3">
              {assignmentRules.map((rule, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl border border-border bg-white p-4 shadow-sm hover:border-emerald-200 transition-colors">
                  <div>
                    <span className="font-semibold text-sm text-foreground">{rule.name}</span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {rule.name.includes("Round Robin")
                        ? "Cycles newly created leads sequentially through the eligible sales agents below"
                        : "Ensures newly created leads are distributed fairly without manual owner selection"}
                    </p>
                  </div>
                  <ToggleSwitch active={rule.active} onChange={() => handleToggleAssignmentRule(i)} />
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-border bg-white p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Eligible Owners Queue (Round-Robin Pool)</h3>
                  <p className="text-xs text-muted-foreground">
                    Click to toggle agents in or out of the automated assignment queue
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {eligibleOwners.map((owner, i) => {
                  const cleanName = owner.includes("·") ? (owner.split("·")[0] || owner).trim() : owner.trim();
                  const roleName = owner.includes("·") ? (owner.split("·")[1] || "").trim() : "";
                  const isSelected = selectedEligibleOwners.some(
                    (o) => (o.includes("·") ? (o.split("·")[0] || o).trim() : o.trim()) === cleanName
                  );
                  const queuePosition = selectedEligibleOwners.findIndex(
                    (o) => (o.includes("·") ? (o.split("·")[0] || o).trim() : o.trim()) === cleanName
                  );

                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleToggleEligibleOwner(owner)}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-xl border text-left transition-all",
                        isSelected
                          ? "border-emerald-300 bg-emerald-50/60 shadow-sm"
                          : "border-border bg-muted/20 opacity-60 hover:opacity-100 hover:border-border"
                      )}
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className={cn("text-xs font-bold truncate", isSelected ? "text-emerald-950" : "text-foreground")}>
                            {cleanName}
                          </span>
                          {isSelected && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-200 text-emerald-800">
                              #{queuePosition + 1}
                            </span>
                          )}
                        </div>
                        {roleName && (
                          <p className="text-[11px] text-muted-foreground truncate">{roleName}</p>
                        )}
                      </div>
                      <div className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center shrink-0 border",
                        isSelected ? "bg-emerald-600 border-emerald-600 text-white" : "border-muted-foreground/30 bg-white"
                      )}>
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Follow-ups Tab - 1-click quick buttons dynamic */}
        {activeTab === "Follow-ups" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <MessageSquare className="h-5 w-5 text-emerald-600" /> Follow-up Quick Buttons
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">CNR / Call Later jeva 1-click buttons ahiya thi manage thashe. Leads + Tasks ma live dekhashe.</p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <input
                type="text"
                placeholder="e.g. CNR, Call Later, WhatsApp Sent"
                value={newFollowUpLabel}
                onChange={(e) => setNewFollowUpLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddFollowUpType()}
                className="w-full sm:w-80 rounded-xl border border-border bg-white px-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-emerald-500/20 font-semibold"
              />
              <button onClick={handleAddFollowUpType} className="flex items-center gap-1.5 rounded-xl bg-emerald-700 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-800">
                <Plus className="h-4 w-4" /> Add Button
              </button>
            </div>
            <div className="space-y-2.5">
              {followUpTypes.length === 0 && <p className="text-xs text-muted-foreground">No follow-up buttons yet. Add one above.</p>}
              {followUpTypes.map((f: any, i: number) => (
                <div key={i} className="flex items-center justify-between rounded-xl border border-border bg-white p-4">
                  <div>
                    <p className="font-semibold text-sm">{f.label}</p>
                    <p className="text-xs text-muted-foreground">{f.note || f.action} · +{f.offset_hours || 24}h auto reminder</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ToggleSwitch active={!!f.active} onChange={() => handleToggleFollowUpType(i)} />
                    <button onClick={() => handleDeleteFollowUpType(i)} className="p-1.5 text-rose-400 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === "Notifications" && (
          <div className="animate-in fade-in slide-in-from-bottom-2">
            <h2 className="mb-6 flex items-center gap-2 text-lg font-bold">
              <Bell className="h-5 w-5 text-emerald-600" /> Notification Triggers
            </h2>
            <div className="space-y-3">
              {(notificationsState.length > 0 ? notificationsState : dynamicNotifications).map((notif: any, i: number) => (
                <div key={i} className="flex items-center justify-between rounded-xl border border-border bg-white p-4">
                  <div>
                    <p className="font-medium text-sm">{notif.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{notif.subtitle}</p>
                  </div>
                  <ToggleSwitch active={!!notif.active} onChange={() => handleToggleNotification(i)} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Permissions Tab */}
        {activeTab === "Permissions" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <Shield className="h-5 w-5 text-emerald-600" /> Role Permissions
              </h2>
              <p className="mt-1 mb-6 text-sm text-muted-foreground">
                Only CEO and Admin can delete leads. Every action is written to the audit log.
              </p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2"><Lock className="w-4 h-4 text-amber-700" /> Payment Details Visibility (Name-wise)</h3>
                <p className="text-xs text-muted-foreground mt-1">Jene lead nakhi tene potani j dekhay. Admin ne badhi dekhay. Niche tick karela loko ne bijani payment details dekhase (View Details ma).</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Roles with full access</p>
                <div className="flex flex-wrap gap-2">
                  {["Admin", "SuperAdmin", "CEO", "CTO", "Sales Head", "HR"].map((role) => {
                    const active = paymentVisibility.allowed_roles.includes(role);
                    return (
                      <button key={role} onClick={() => handleTogglePaymentRole(role)} className={cn("px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors", active ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-muted-foreground border-border hover:border-emerald-300")}>{role}</button>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">People with payment access (name-wise)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {eligibleOwners.map((owner: string, i: number) => {
                    const cleanName = owner.includes("·") ? (owner.split("·")[0] || owner).trim() : owner.trim();
                    const active = paymentVisibility.allowed_employee_names.includes(cleanName) || paymentVisibility.allowed_employee_names.includes(owner);
                    return (
                      <button key={i} onClick={() => handleTogglePaymentPerson(cleanName)} className={cn("flex items-center justify-between p-2.5 rounded-xl border text-left text-xs font-semibold transition-all", active ? "border-emerald-300 bg-emerald-50" : "border-border bg-white opacity-70 hover:opacity-100")}>
                        <span className="truncate">{cleanName}</span>
                        {active && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {permissions.map((perm: any, i: number) => (
                <div key={i} className="rounded-2xl border border-border bg-white p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold">{perm.role}</h3>
                    <button
                      onClick={() => handleEditPermissions(i)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {perm.perms.map((p: any, j: number) => (
                      <span key={j} className="rounded-full bg-muted/70 px-3 py-1.5 text-xs font-medium">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Audit Log Tab */}
        {activeTab === "Audit Log" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
                  <History className="h-5 w-5 text-emerald-600" /> Sales Audit Trail
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Comprehensive compliance tracking of lead status changes, auto-assignments, and conversions
                </p>
              </div>
              <span className="flex items-center gap-1.5 self-start sm:self-auto rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 border border-amber-200">
                <Lock className="w-3.5 h-3.5" /> Immutable & Non-Deletable
              </span>
            </div>

            {/* Search Bar & Refresh */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search logs by action, employee, lead name..."
                  value={auditSearchTerm}
                  onChange={(e) => {
                    setAuditSearchTerm(e.target.value);
                    fetchLiveAuditLogs(e.target.value);
                  }}
                  className="w-full pl-9 pr-4 py-2 border border-border rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              <button
                type="button"
                onClick={() => fetchLiveAuditLogs(auditSearchTerm)}
                disabled={isLoadingAuditLogs}
                className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-xl text-xs font-semibold bg-white hover:bg-muted text-foreground transition-colors disabled:opacity-50"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", isLoadingAuditLogs && "animate-spin text-emerald-600")} />
                Refresh
              </button>
            </div>

            <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
              {isLoadingAuditLogs ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-600 mb-2" />
                  Loading immutable audit records from server...
                </div>
              ) : liveAuditLogs.length > 0 ? (
                liveAuditLogs.map((log: any, i: number) => {
                  const isAssignment = log.action?.includes("ASSIGN");
                  const isWon = log.action?.includes("WON") || log.action?.includes("CONVERT");
                  const isDelete = log.action?.includes("DELETE");

                  return (
                    <div
                      key={log._id || i}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border bg-white p-3.5 shadow-sm hover:border-emerald-200 transition-colors"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                              isWon
                                ? "bg-purple-100 text-purple-800"
                                : isAssignment
                                  ? "bg-blue-100 text-blue-800"
                                  : isDelete
                                    ? "bg-rose-100 text-rose-800"
                                    : "bg-emerald-100 text-emerald-800"
                            )}
                          >
                            {log.action?.replace(/_/g, " ") || "ACTIVITY"}
                          </span>
                          <span className="font-semibold text-xs text-foreground truncate">
                            {log.details?.lead_name || log.details?.company || log.entity_id || "Lead Activity"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {log.details?.assigned_to ? (
                            <span>Auto-assigned to <strong className="text-foreground">{log.details.assigned_to}</strong> via Round Robin</span>
                          ) : log.details?.deal_value ? (
                            <span>Converted deal value: <strong className="text-foreground">₹{Number(log.details.net_amount || log.details.deal_value).toLocaleString()}</strong></span>
                          ) : log.details?.reason ? (
                            <span>Reason: {log.details.reason}</span>
                          ) : (
                            <span>Performed by <strong className="text-foreground">{log.user_name || "System"}</strong></span>
                          )}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[11px] font-mono text-muted-foreground block">
                          {log.created_at ? new Date(log.created_at).toLocaleString() : "Just now"}
                        </span>
                        <span className="text-[10px] text-muted-foreground/80">
                          by {log.user_name || "System"}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : dynamicAuditLogs.length > 0 ? (
                dynamicAuditLogs.map((log, i) => (
                  <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border bg-white p-3.5 shadow-sm">
                    <div>
                      <p className="font-medium text-xs text-foreground">{log.action}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{log.by}</p>
                    </div>
                    <span className="text-[11px] font-mono text-muted-foreground sm:text-right">{log.time}</span>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  No audit trail records found.
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, type: null, index: -1, name: "" })}
        onConfirm={executeDelete}
        title={`Delete ${deleteConfirm.type === 'category' ? 'Category' : deleteConfirm.type === 'source' ? 'Source' : 'Stage'}`}
        description={`Are you sure you want to delete "${deleteConfirm.name}"? This action cannot be undone.`}
        itemName={deleteConfirm.name}
      />

      {/* Edit Permissions Modal */}
      <Dialog open={editRoleIdx !== null} onOpenChange={(open) => !open && setEditRoleIdx(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg max-h-[90dvh] flex flex-col p-4 sm:p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <h3 className="text-xl font-black tracking-tight mb-2">Edit {editRoleIdx !== null ? permissions[editRoleIdx]?.role : "Role"} Permissions</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Select the capabilities this role should have access to.
          </p>

          <div className="overflow-y-auto pr-2 mb-6 space-y-2 flex-1 min-h-0 max-h-[50dvh]">
            {AVAILABLE_PERMISSIONS.map(p => (
              <label key={p} className="flex items-center gap-3 rounded-xl border border-border p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                <input
                  type="checkbox"
                  checked={tempPerms.includes(p)}
                  onChange={() => handleTogglePerm(p)}
                  className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-600"
                />
                <span className="text-sm font-medium">{p}</span>
              </label>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2 mt-auto">
            <button
              onClick={() => setEditRoleIdx(null)}
              className="flex-1 rounded-xl border border-border py-2.5 min-h-[44px] text-sm font-semibold hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSavePermissions}
              className="flex-1 rounded-xl bg-emerald-600 py-2.5 min-h-[44px] text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
            >
              Save Changes
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
