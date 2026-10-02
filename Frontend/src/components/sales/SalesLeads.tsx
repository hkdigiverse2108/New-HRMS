import React, { useMemo, useState, useEffect } from "react";
import { TrendingUp, Target, Plus, Search, MoreHorizontal, Phone, Mail, Clock, Flame, X, Upload, Download, Users, ChevronDown, ChevronRight, Trash2, RefreshCw, MessageSquare } from "lucide-react";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { formatCurrency, type Lead } from "./sales-data";
import { useSales } from "./SalesContext";
import { useEmployeesContext } from "@/components/employees/EmployeeContext";
import { useAuth } from "@/components/auth/AuthContext";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";

import { FollowUpDialog } from "./FollowUpDialog";
import { ConvertToClientModal } from "./ConvertToClientModal";
import { StatusChangeModal } from "./StatusChangeModal";
import { BulkAssignModal } from "./BulkAssignModal";
import { BulkImportModal } from "./BulkImportModal";

const DEFAULT_CATEGORIES = [
  "Jewellery",
  "Restaurants",
  "Real Estate",
  "Doctors",
  "Education",
  "Hospital",
  "Manufacturing",
  "Textile",
  "Finance",
  "Automobile",
  "Travel",
  "IT Company",
  "Salon",
  "Gym",
  "Construction",
  "Others",
];

const STAGE_COLORS: Record<string, string> = {
  Lead: "bg-blue-100 text-blue-700 border-blue-200",
  "New Lead": "bg-blue-100 text-blue-700 border-blue-200",
  Contacted: "bg-purple-100 text-purple-700 border-purple-200",
  Meeting: "bg-cyan-100 text-cyan-700 border-cyan-200",
  Demo: "bg-sky-100 text-sky-700 border-sky-200",
  "Proposal Sent": "bg-amber-100 text-amber-700 border-amber-200",
  Proposal: "bg-amber-100 text-amber-700 border-amber-200",
  Negotiation: "bg-orange-100 text-orange-700 border-orange-200",
  "On Hold": "bg-slate-100 text-slate-700 border-slate-300",
  "Client Won": "bg-emerald-100 text-emerald-700 border-emerald-300",
  Won: "bg-emerald-100 text-emerald-700 border-emerald-300",
  "Client Lost": "bg-rose-100 text-rose-700 border-rose-300",
  Lost: "bg-rose-100 text-rose-700 border-rose-300",
};

export function SalesLeads({
  onAction,
  isNew,
}: {
  onAction?: (action: string) => void;
  isNew?: boolean;
}) {
  const { user } = useAuth();
  const {
    leads,
    targets,
    fetchLeads,
    fetchTargets,
    addLead,
    updateLead,
    deleteLead,
    bulkDeleteLeads,
  } = useSales();
  const { employees } = useEmployeesContext();

  const currentUserName =
    user?.name ||
    `${user?.firstName || user?.first_name || ""} ${user?.lastName || user?.last_name || ""}`.trim() ||
    "Sales Rep";

  // Tab & Filters
  const [activeTab, setActiveTab] = useState<string>("active");
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [employeeFilter, setEmployeeFilter] = useState("all");

  // Selection for bulk actions
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [isBulkAssignOpen, setIsBulkAssignOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);

  // Modals for conversion & status change
  const [convertingLead, setConvertingLead] = useState<Lead | null>(null);
  const [statusChangeLeadId, setStatusChangeLeadId] = useState<string | null>(null);
  const [statusChangeNewStatus, setStatusChangeNewStatus] = useState<string>("");

  // Drawer for lead details
  const [selectedLeadDrawer, setSelectedLeadDrawer] = useState<Lead | null>(null);

  // Quick Add Form
  const [quickAddName, setQuickAddName] = useState("");
  const [quickAddPhone, setQuickAddPhone] = useState("");
  const [quickAddCategory, setQuickAddCategory] = useState("none_selected");
  const [isQuickAdding, setIsQuickAdding] = useState(false);

  // Inline editing state
  const [inlineEditing, setInlineEditing] = useState<{ id: string; field: string } | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  // Target Form
  const [targetForm, setTargetForm] = useState({
    employeeId: "",
    type: "Monthly",
    month: "October",
    year: new Date().getFullYear(),
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
    targetAmount: 100000,
    category: "Overall",
  });
  const [isTargetSubmitting, setIsTargetSubmitting] = useState(false);

  useEffect(() => {
    if (isNew) {
      onAction?.("Add Lead");
    }
  }, [isNew, onAction]);

  // Lead helper filters
  const isOverdueOrDue = (l: Lead) => {
    const today = new Date().toISOString().split("T")[0] || "";
    if (l.status === "On Hold" || l.stage === "On Hold") {
      if (l.holdResumeDate && l.holdResumeDate <= today) return true;
    }
    const nextDate = l.nextFollowUpDate || l.nextFollowUp;
    if (nextDate) {
      const dStr = nextDate.split("T")[0] || "";
      return dStr <= today;
    }
    return false;
  };

  const overdueLeads = useMemo(() => {
    return leads.filter((l) => {
      const status = l.status || l.stage;
      if (status === "Client Won" || status === "Won" || status === "Client Lost" || status === "Lost") return false;
      return isOverdueOrDue(l);
    });
  }, [leads]);

  const activeLeads = useMemo(() => {
    return leads.filter((l) => {
      const status = l.status || l.stage;
      return status !== "Client Won" && status !== "Won" && status !== "Client Lost" && status !== "Lost";
    });
  }, [leads]);

  const hotLeads = useMemo(() => {
    return leads.filter((l) => {
      const status = l.status || l.stage;
      return !!l.isHot && status !== "Client Won" && status !== "Won" && status !== "Client Lost" && status !== "Lost";
    });
  }, [leads]);

  const convertedLeads = useMemo(() => {
    return leads.filter((l) => {
      const status = l.status || l.stage;
      return status === "Client Won" || status === "Won";
    });
  }, [leads]);

  // Overall Stats
  const stats = useMemo(() => {
    const activeValue = activeLeads.reduce(
      (sum, l) => sum + (Number(l.budget) || parseFloat(l.expectedIncome?.replace(/[^0-9.]/g, "") || "0") || 0),
      0
    );
    const convertedValue = convertedLeads.reduce(
      (sum, l) => sum + (Number(l.budget) || parseFloat(l.expectedIncome?.replace(/[^0-9.]/g, "") || "0") || 0),
      0
    );
    const hotValue = hotLeads.reduce(
      (sum, l) => sum + (Number(l.budget) || parseFloat(l.expectedIncome?.replace(/[^0-9.]/g, "") || "0") || 0),
      0
    );

    return [
      {
        title: "Active Pipeline",
        value: `₹${(activeValue / 100000).toFixed(1)}L`,
        sub: `${activeLeads.length} Deals`,
        icon: <TrendingUp className="w-5 h-5 text-blue-600" />,
        bg: "bg-blue-50",
      },
      {
        title: "Follow-ups Due",
        value: String(overdueLeads.length),
        sub: "Overdue & Today",
        icon: <Clock className="w-5 h-5 text-rose-600" />,
        bg: "bg-rose-50",
      },
      {
        title: "Hot Leads 🔥",
        value: `₹${(hotValue / 100000).toFixed(1)}L`,
        sub: `${hotLeads.length} Hot Deals`,
        icon: <Flame className="w-5 h-5 text-orange-600 fill-orange-500" />,
        bg: "bg-orange-50",
      },
      {
        title: "Converted Won",
        value: `₹${(convertedValue / 100000).toFixed(1)}L`,
        sub: `${convertedLeads.length} Clients Won`,
        icon: <Target className="w-5 h-5 text-emerald-600" />,
        bg: "bg-emerald-50",
      },
    ];
  }, [activeLeads, convertedLeads, hotLeads, overdueLeads]);

  // Filter function for table data
  const filterLeads = (data: Lead[]) => {
    let result = data;
    const q = searchTerm.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (l) =>
          (l.company || "").toLowerCase().includes(q) ||
          (l.contact || "").toLowerCase().includes(q) ||
          (l.phone || "").toLowerCase().includes(q) ||
          (l.email || "").toLowerCase().includes(q) ||
          (l.remarks || "").toLowerCase().includes(q)
      );
    }
    if (categoryFilter !== "all") {
      result = result.filter((l) => (l.category || "Others") === categoryFilter);
    }
    if (employeeFilter !== "all") {
      result = result.filter((l) => {
        const assigned = Array.isArray(l.assignedTo)
          ? l.assignedTo.join(", ")
          : String(l.assignedTo || l.owner || "");
        return assigned.toLowerCase().includes(employeeFilter.toLowerCase());
      });
    }
    return result;
  };

  // Quick Add Lead Handler
  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddPhone.trim()) {
      toast.error("Phone number is required for Quick Add");
      return;
    }

    setIsQuickAdding(true);
    try {
      const companyVal = quickAddName.trim() || `Lead ${quickAddPhone.slice(-4)}`;
      const catVal = quickAddCategory === "none_selected" ? "Others" : quickAddCategory;

      await addLead({
        company: companyVal,
        contact: quickAddName.trim() || companyVal,
        phone: quickAddPhone.trim(),
        category: catVal,
        source: "Direct Call",
        stage: "Lead",
        status: "Lead",
        priority: "Medium",
        assignedTo: [currentUserName],
        owner: currentUserName,
        createdByUserName: currentUserName,
        date: new Date().toISOString().split("T")[0] || "",
      });

      toast.success("Lead quickly added!");
      setQuickAddName("");
      setQuickAddPhone("");
      setQuickAddCategory("none_selected");
    } catch {
      toast.error("Failed to quick add lead");
    } finally {
      setIsQuickAdding(false);
    }
  };

  // Inline update helper
  const handleInlineUpdate = async (id: string, field: string, value: any) => {
    setInlineEditing(null);
    try {
      await updateLead(id, { [field]: value });
      toast.success("Updated");
    } catch {
      toast.error("Failed to update field");
    }
  };

  // Status change handler
  const onStatusSelect = (lead: Lead, val: string) => {
    const leadId = lead.id || lead._id || "";
    if (val === "Client Won") {
      setConvertingLead(lead);
    } else if (val === "Client Lost" || val === "On Hold") {
      setStatusChangeLeadId(leadId);
      setStatusChangeNewStatus(val);
    } else {
      handleInlineUpdate(leadId, "status", val);
      handleInlineUpdate(leadId, "stage", val);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    const dataToExport = filterLeads(
      activeTab === "overdue"
        ? overdueLeads
        : activeTab === "hot"
          ? hotLeads
          : activeTab === "converted"
            ? convertedLeads
            : activeLeads
    );

    if (dataToExport.length === 0) {
      toast.error("No leads to export");
      return;
    }

    const headers = [
      "Company",
      "Contact",
      "Phone",
      "Email",
      "Category",
      "Source",
      "Status",
      "Priority",
      "Assigned To",
      "Expected Income",
      "Next Follow-up",
      "Created Date",
    ];

    const rows = dataToExport.map((l) => [
      `"${l.company || ""}"`,
      `"${l.contact || ""}"`,
      `"${l.phone || ""}"`,
      `"${l.email || ""}"`,
      `"${l.category || ""}"`,
      `"${l.source || ""}"`,
      `"${l.status || l.stage || ""}"`,
      `"${l.priority || ""}"`,
      `"${Array.isArray(l.assignedTo) ? l.assignedTo.join(", ") : l.assignedTo || l.owner || ""}"`,
      `"${l.expectedIncome || l.budget || ""}"`,
      `"${l.nextFollowUpDate || l.nextFollowUp || ""}"`,
      `"${l.date || l.createdAt || ""}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `sales_leads_${activeTab}_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${dataToExport.length} leads to CSV`);
  };

  // Target creation handler
  const handleSetTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetForm.employeeId) {
      toast.error("Please select an employee");
      return;
    }

    setIsTargetSubmitting(true);
    try {
      const emp = employees.find((em) => em.id === targetForm.employeeId);
      const empName = emp ? emp.name || `${emp.firstName} ${emp.lastName}`.trim() : "Sales Executive";

      await api.post("/sales-targets", {
        employeeId: targetForm.employeeId,
        employeeName: empName,
        type: targetForm.type,
        month: targetForm.month,
        year: Number(targetForm.year),
        startDate: targetForm.type === "Custom" ? targetForm.startDate : undefined,
        endDate: targetForm.type === "Custom" ? targetForm.endDate : undefined,
        targetAmount: Number(targetForm.targetAmount),
        category: targetForm.category,
        currentAchievement: 0,
        status: "Active",
      });

      toast.success("Sales target set successfully");
      await fetchTargets();
    } catch (err: any) {
      toast.error(err?.message || "Failed to set target");
    } finally {
      setIsTargetSubmitting(false);
    }
  };

  const handleDeleteTarget = async (id?: string) => {
    if (!id) return;
    try {
      await api.delete(`/sales-targets/${id}`);
      toast.success("Target deleted");
      await fetchTargets();
    } catch {
      toast.error("Failed to delete target");
    }
  };

  // Render Table Component
  const renderLeadTable = (data: Lead[], type: "overdue" | "active" | "hot" | "converted") => {
    const filtered = filterLeads(data);

    // Grouping by category
    const categoriesInUse = Array.from(
      new Set(filtered.map((l) => (l.category as string) || "Others"))
    );
    categoriesInUse.sort((a, b) => (a === "Others" ? 1 : b === "Others" ? -1 : a.localeCompare(b)));

    const allFilteredIds = filtered.map((l) => l.id || l._id || "");
    const isAllSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedLeads.includes(id));

    const toggleSelectAll = () => {
      if (isAllSelected) {
        setSelectedLeads((prev) => prev.filter((id) => !allFilteredIds.includes(id)));
      } else {
        setSelectedLeads((prev) => Array.from(new Set([...prev, ...allFilteredIds])));
      }
    };

    const toggleSelectRow = (id: string) => {
      setSelectedLeads((prev) =>
        prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
      );
    };

    const toggleCategory = (cat: string) => {
      setCollapsedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
    };

    if (filtered.length === 0) {
      return (
        <div className="py-16 text-center text-muted-foreground bg-card rounded-2xl border border-border">
          <p className="text-sm font-semibold">No leads found in this view.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Try adjusting your search filters or quick-add a new lead above.
          </p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-xs">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-muted/50 border-b border-border text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              <th className="w-10 px-3 py-3.5 text-center">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={toggleSelectAll}
                  className="rounded border-border text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                />
              </th>
              <th className="w-10 px-2 py-3.5 text-center">Hot</th>
              <th className="px-4 py-3.5">Created Date</th>
              <th className="px-4 py-3.5">Contact & Company</th>
              <th className="px-4 py-3.5">Source</th>
              <th className="px-4 py-3.5">Category</th>
              <th className="px-4 py-3.5">Status</th>
              <th className="px-4 py-3.5">Assigned To</th>
              <th className="px-4 py-3.5">Expected Income</th>
              <th className="px-4 py-3.5">Remarks</th>
              <th className="px-4 py-3.5">Follow-ups</th>
              <th className="px-4 py-3.5 text-right sticky right-0 bg-muted/60 shadow-[-1px_0_0_0_rgba(0,0,0,0.05)]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {categoriesInUse.map((catName) => {
              const catLeads = filtered.filter((l) => ((l.category as string) || "Others") === catName);
              if (catLeads.length === 0) return null;
              const isCollapsed = !!collapsedCategories[catName];

              return (
                <React.Fragment key={catName}>
                  {/* Category Header Row */}
                  <tr
                    onClick={() => toggleCategory(catName)}
                    className="bg-muted/30 hover:bg-muted/50 cursor-pointer font-bold select-none transition-colors border-y border-border/70"
                  >
                    <td colSpan={12} className="px-4 py-2 text-foreground/80">
                      <div className="flex items-center gap-2">
                        {isCollapsed ? (
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                        <span className="text-xs uppercase tracking-wider">{catName}</span>
                        <Badge variant="secondary" className="text-[10px] h-5 px-2 bg-background font-bold border border-border">
                          {catLeads.length}
                        </Badge>
                      </div>
                    </td>
                  </tr>

                  {/* Lead Rows */}
                  {!isCollapsed &&
                    catLeads.map((lead) => {
                      const leadId = lead.id || lead._id || "";
                      const isSelected = selectedLeads.includes(leadId);
                      const isHot = !!lead.isHot;
                      const status = lead.status || lead.stage || "Lead";

                      // Follow-up status check
                      const today = new Date().toISOString().split("T")[0] || "";
                      const nextDate = lead.nextFollowUpDate || lead.nextFollowUp;
                      const nextDateStr = nextDate ? nextDate.split("T")[0] || "" : "";
                      const isMissed = !!nextDateStr && nextDateStr < today;
                      const isDueToday = !!nextDateStr && nextDateStr === today;

                      return (
                        <tr
                          key={leadId}
                          className={cn(
                            "hover:bg-muted/40 transition-colors group relative",
                            isHot ? "bg-orange-500/5" : ""
                          )}
                        >
                          {/* Checkbox */}
                          <td className="px-3 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectRow(leadId)}
                              className="rounded border-border text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                            />
                          </td>

                          {/* Hot toggle */}
                          <td className="px-2 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleInlineUpdate(leadId, "isHot", !isHot)}
                              title={isHot ? "Hot Lead! Click to unmark" : "Mark as Hot Lead"}
                              className="p-1 hover:scale-110 transition-transform"
                            >
                              <Flame
                                className={cn(
                                  "w-4 h-4",
                                  isHot
                                    ? "text-orange-500 fill-orange-500 drop-shadow-sm"
                                    : "text-muted-foreground/40 hover:text-orange-400"
                                )}
                              />
                            </button>
                          </td>

                          {/* Created Date */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            {inlineEditing?.id === leadId && inlineEditing?.field === "date" ? (
                              <Input
                                type="date"
                                autoFocus
                                defaultValue={lead.date || lead.createdAt?.split("T")[0] || today}
                                onBlur={(e) => handleInlineUpdate(leadId, "date", e.target.value)}
                                className="h-7 text-xs w-32"
                              />
                            ) : (
                              <div
                                onClick={() => setInlineEditing({ id: leadId, field: "date" })}
                                className="cursor-pointer hover:bg-muted/80 rounded px-1.5 py-1 text-muted-foreground flex flex-col"
                              >
                                <span className="font-semibold text-foreground">
                                  {lead.date || lead.createdAt?.split("T")[0] || "—"}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {lead.createdByUserName || "Admin"}
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Contact & Company */}
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-0.5">
                              {inlineEditing?.id === leadId && inlineEditing?.field === "company" ? (
                                <Input
                                  autoFocus
                                  defaultValue={lead.company}
                                  onBlur={(e) => handleInlineUpdate(leadId, "company", e.target.value)}
                                  className="h-7 text-xs font-bold"
                                />
                              ) : (
                                <span
                                  onClick={() => setSelectedLeadDrawer(lead)}
                                  className="font-bold text-foreground hover:text-emerald-600 cursor-pointer text-[13px] flex items-center gap-1.5"
                                >
                                  {lead.company || lead.contact}
                                  {lead.city && (
                                    <span className="text-[10px] text-muted-foreground font-normal">
                                      · {lead.city}
                                    </span>
                                  )}
                                </span>
                              )}

                              <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                                {lead.contact && lead.contact !== lead.company && (
                                  <span className="font-medium text-foreground/80">{lead.contact}</span>
                                )}
                                {lead.phone && (
                                  <a
                                    href={`tel:${lead.phone}`}
                                    className="flex items-center gap-1 hover:text-emerald-600 text-foreground/70"
                                  >
                                    <Phone className="w-3 h-3 text-emerald-600" />
                                    {lead.phone}
                                  </a>
                                )}
                                {lead.email && (
                                  <a
                                    href={`mailto:${lead.email}`}
                                    className="flex items-center gap-1 hover:text-emerald-600 text-foreground/70"
                                  >
                                    <Mail className="w-3 h-3 text-muted-foreground" />
                                    {lead.email}
                                  </a>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Source */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            {inlineEditing?.id === leadId && inlineEditing?.field === "source" ? (
                              <Input
                                autoFocus
                                defaultValue={lead.source}
                                onBlur={(e) => handleInlineUpdate(leadId, "source", e.target.value)}
                                className="h-7 text-xs"
                              />
                            ) : (
                              <span
                                onClick={() => setInlineEditing({ id: leadId, field: "source" })}
                                className="cursor-pointer hover:bg-muted/80 rounded px-1.5 py-1 text-muted-foreground font-medium"
                              >
                                {lead.source || "Add source"}
                              </span>
                            )}
                          </td>

                          {/* Category */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <Select
                              value={(lead.category as string) || "Others"}
                              onValueChange={(val) => handleInlineUpdate(leadId, "category", val)}
                            >
                              <SelectTrigger className="h-7 text-xs font-semibold border-border bg-background/50 px-2 min-w-[110px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {DEFAULT_CATEGORIES.map((c) => (
                                  <SelectItem key={c} value={c} className="text-xs">
                                    {c}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <Select
                              value={status}
                              onValueChange={(val) => onStatusSelect(lead, val)}
                            >
                              <SelectTrigger
                                className={cn(
                                  "h-7 text-[11px] font-bold border px-2 min-w-[115px] rounded-lg",
                                  STAGE_COLORS[status] || "bg-muted text-foreground"
                                )}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Lead">Lead</SelectItem>
                                <SelectItem value="Contacted">Contacted</SelectItem>
                                <SelectItem value="Proposal Sent">Proposal Sent</SelectItem>
                                <SelectItem value="On Hold">On Hold</SelectItem>
                                <SelectItem value="Client Won">Client Won 🏆</SelectItem>
                                <SelectItem value="Client Lost">Client Lost</SelectItem>
                              </SelectContent>
                            </Select>
                            {status === "On Hold" && lead.holdResumeDate && (
                              <div className="text-[10px] text-amber-600 font-bold mt-1">
                                Resume: {lead.holdResumeDate}
                              </div>
                            )}
                          </td>

                          {/* Assigned To */}
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1 max-w-[160px]">
                              {Array.isArray(lead.assignedTo) && lead.assignedTo.length > 0 ? (
                                lead.assignedTo.map((name: string) => (
                                  <Badge
                                    key={name}
                                    variant="secondary"
                                    className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold py-0.5 px-1.5 flex items-center gap-1"
                                  >
                                    {name}
                                  </Badge>
                                ))
                              ) : lead.owner ? (
                                <Badge
                                  variant="secondary"
                                  className="bg-muted text-muted-foreground text-[10px] font-medium"
                                >
                                  {lead.owner}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground/60 italic text-[11px]">
                                  Unassigned
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Expected Income */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            {inlineEditing?.id === leadId && inlineEditing?.field === "expectedIncome" ? (
                              <Input
                                autoFocus
                                defaultValue={lead.expectedIncome || String(lead.budget || "")}
                                onBlur={(e) => handleInlineUpdate(leadId, "expectedIncome", e.target.value)}
                                className="h-7 text-xs font-bold w-24"
                              />
                            ) : (
                              <span
                                onClick={() => setInlineEditing({ id: leadId, field: "expectedIncome" })}
                                className="cursor-pointer font-bold text-foreground hover:bg-muted/80 rounded px-1.5 py-1"
                              >
                                {lead.expectedIncome
                                  ? lead.expectedIncome.startsWith("₹")
                                    ? lead.expectedIncome
                                    : `₹${lead.expectedIncome}`
                                  : lead.budget
                                    ? formatCurrency(lead.budget)
                                    : "—"}
                              </span>
                            )}
                          </td>

                          {/* Remarks */}
                          <td className="px-4 py-3">
                            {inlineEditing?.id === leadId && inlineEditing?.field === "remarks" ? (
                              <Input
                                autoFocus
                                defaultValue={lead.remarks}
                                onBlur={(e) => handleInlineUpdate(leadId, "remarks", e.target.value)}
                                className="h-7 text-xs w-36"
                              />
                            ) : (
                              <p
                                onClick={() => setInlineEditing({ id: leadId, field: "remarks" })}
                                title={lead.remarks}
                                className="cursor-pointer max-w-[140px] truncate text-muted-foreground italic hover:bg-muted/80 rounded px-1.5 py-1"
                              >
                                {lead.remarks ? `"${lead.remarks}"` : "Add remark"}
                              </p>
                            )}
                          </td>

                          {/* Follow-ups */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <FollowUpDialog
                                lead={lead}
                                userName={currentUserName}
                              />
                              {nextDateStr && (
                                <div className="flex flex-col">
                                  {isMissed ? (
                                    <span className="text-[9px] font-bold text-rose-600 animate-pulse uppercase">
                                      Missed ({nextDateStr})
                                    </span>
                                  ) : isDueToday ? (
                                    <span className="text-[9px] font-bold text-amber-600 animate-pulse uppercase">
                                      Due Today
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-muted-foreground">
                                      Next: {nextDateStr}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Row Actions */}
                          <td className="px-4 py-3 text-right sticky right-0 bg-card group-hover:bg-muted/40 transition-colors shadow-[-1px_0_0_0_rgba(0,0,0,0.05)]">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                >
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44 text-xs font-semibold">
                                <DropdownMenuItem onClick={() => setSelectedLeadDrawer(lead)}>
                                  View Details
                                </DropdownMenuItem>
                                {status !== "Client Won" && (
                                  <DropdownMenuItem
                                    onClick={() => setConvertingLead(lead)}
                                    className="text-emerald-600 font-bold"
                                  >
                                    Convert to Client 🏆
                                  </DropdownMenuItem>
                                )}
                                <div className="h-px bg-border my-1" />
                                <DropdownMenuItem
                                  onClick={() => deleteLead(leadId)}
                                  className="text-rose-600 focus:text-rose-600"
                                >
                                  Delete Lead
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl text-foreground">
            Sales Board
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Complete pipeline management, client conversions, follow-up reminders, and target tracking.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsBulkImportOpen(true)}
            className="gap-1.5 text-xs font-bold h-9"
          >
            <Upload className="w-3.5 h-3.5" /> Import CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="gap-1.5 text-xs font-bold h-9"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </Button>
          <Button
            size="sm"
            onClick={() => onAction?.("Add Lead")}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs font-bold h-9 shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add Lead
          </Button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((st, i) => (
          <Card key={i} className="border-border bg-card shadow-xs overflow-hidden">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  {st.title}
                </p>
                <p className="text-2xl font-black text-foreground">{st.value}</p>
                <p className="text-[11px] font-semibold text-muted-foreground">{st.sub}</p>
              </div>
              <div className={cn("p-3 rounded-2xl", st.bg)}>{st.icon}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Add Bar */}
      {activeTab !== "targets" && (
        <form
          onSubmit={handleQuickAdd}
          className="bg-card p-3 rounded-2xl border border-border shadow-xs flex flex-wrap items-center gap-3"
        >
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Company / Contact Name (Optional)..."
              value={quickAddName}
              onChange={(e) => setQuickAddName(e.target.value)}
              className="w-full text-xs font-semibold bg-muted/40 border border-border rounded-xl px-3 py-2 outline-none focus:border-emerald-500 focus:bg-background transition-all placeholder:text-muted-foreground text-foreground"
            />
          </div>
          <div className="w-full sm:w-[200px]">
            <input
              type="text"
              placeholder="Phone (Compulsory)..."
              value={quickAddPhone}
              onChange={(e) => setQuickAddPhone(e.target.value)}
              className="w-full text-xs font-semibold bg-muted/40 border border-border rounded-xl px-3 py-2 outline-none focus:border-emerald-500 focus:bg-background transition-all placeholder:text-muted-foreground text-foreground"
            />
          </div>
          <div className="w-full sm:w-[170px]">
            <Select value={quickAddCategory} onValueChange={setQuickAddCategory}>
              <SelectTrigger className="h-9 text-xs font-semibold bg-muted/40 border-border">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none_selected">None (Others)</SelectItem>
                {DEFAULT_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="submit"
            disabled={isQuickAdding || !quickAddPhone.trim()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 h-9 rounded-xl gap-1.5 transition-all shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            {isQuickAdding ? "Adding..." : "Quick Add"}
          </Button>
        </form>
      )}

      {/* Bulk Actions Banner */}
      {selectedLeads.length > 0 && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
              {selectedLeads.length} Selected
            </span>
            <span className="text-muted-foreground">Select an operation to apply in bulk:</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setIsBulkAssignOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold h-8"
            >
              <Users className="w-3.5 h-3.5 mr-1" /> Bulk Assign
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => bulkDeleteLeads(selectedLeads)}
              className="border-rose-300 text-rose-600 hover:bg-rose-50 text-xs font-bold h-8"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete Selected
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedLeads([])}
              className="text-xs text-muted-foreground h-8"
            >
              Deselect All
            </Button>
          </div>
        </div>
      )}

      {/* 5 Tabs & Filters */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 bg-card p-2.5 rounded-2xl border border-border shadow-xs">
          {/* Tab buttons */}
          <TabsList className="bg-muted/60 p-1 rounded-xl h-auto flex flex-wrap shrink-0">
            <TabsTrigger
              value="overdue"
              className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs px-3.5 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5"
            >
              <Clock className="w-3.5 h-3.5 text-rose-500" />
              Follow-up Due ({overdueLeads.length})
            </TabsTrigger>
            <TabsTrigger
              value="active"
              className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs px-3.5 py-1.5 text-xs font-bold rounded-lg"
            >
              Active Pipeline ({activeLeads.length})
            </TabsTrigger>
            <TabsTrigger
              value="hot"
              className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs px-3.5 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5"
            >
              <Flame className="w-3.5 h-3.5 text-orange-500 fill-orange-500" />
              Hot Leads ({hotLeads.length})
            </TabsTrigger>
            <TabsTrigger
              value="converted"
              className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs px-3.5 py-1.5 text-xs font-bold rounded-lg"
            >
              Converted Leads ({convertedLeads.length})
            </TabsTrigger>
            <TabsTrigger
              value="targets"
              className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs px-3.5 py-1.5 text-xs font-bold rounded-lg"
            >
              Targets & Performance
            </TabsTrigger>
          </TabsList>

          {/* Search & Category Filter */}
          {activeTab !== "targets" && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-muted-foreground" />
                <Input
                  placeholder="Search leads..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9 text-xs bg-muted/30 border-border"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[140px] h-9 text-xs font-semibold border-border">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {DEFAULT_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Tab 1: Overdue */}
        <TabsContent value="overdue" className="mt-0">
          {renderLeadTable(overdueLeads, "overdue")}
        </TabsContent>

        {/* Tab 2: Active Pipeline */}
        <TabsContent value="active" className="mt-0">
          {renderLeadTable(activeLeads, "active")}
        </TabsContent>

        {/* Tab 3: Hot Leads */}
        <TabsContent value="hot" className="mt-0">
          {renderLeadTable(hotLeads, "hot")}
        </TabsContent>

        {/* Tab 4: Converted Leads */}
        <TabsContent value="converted" className="mt-0">
          {renderLeadTable(convertedLeads, "converted")}
        </TabsContent>

        {/* Tab 5: Targets & Performance */}
        <TabsContent value="targets" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Set Target Form */}
            <Card className="border-border bg-card shadow-xs">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="text-sm font-bold text-foreground">
                  Set Sales Target
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <form onSubmit={handleSetTarget} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Target Type
                    </Label>
                    <Select
                      value={targetForm.type}
                      onValueChange={(val) => setTargetForm({ ...targetForm, type: val })}
                    >
                      <SelectTrigger className="text-xs h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Monthly">Monthly</SelectItem>
                        <SelectItem value="Weekly">Weekly</SelectItem>
                        <SelectItem value="Custom">Custom Date Range</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Select Salesperson
                    </Label>
                    <Select
                      value={targetForm.employeeId}
                      onValueChange={(val) => setTargetForm({ ...targetForm, employeeId: val })}
                    >
                      <SelectTrigger className="text-xs h-9">
                        <SelectValue placeholder="Choose salesperson..." />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.name || `${emp.firstName} ${emp.lastName}`.trim()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {targetForm.type === "Custom" ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          Start Date
                        </Label>
                        <Input
                          type="date"
                          value={targetForm.startDate}
                          onChange={(e) => setTargetForm({ ...targetForm, startDate: e.target.value })}
                          className="text-xs h-9"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          End Date
                        </Label>
                        <Input
                          type="date"
                          value={targetForm.endDate}
                          onChange={(e) => setTargetForm({ ...targetForm, endDate: e.target.value })}
                          className="text-xs h-9"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          Month
                        </Label>
                        <Select
                          value={targetForm.month}
                          onValueChange={(val) => setTargetForm({ ...targetForm, month: val })}
                        >
                          <SelectTrigger className="text-xs h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[
                              "January", "February", "March", "April", "May", "June",
                              "July", "August", "September", "October", "November", "December",
                            ].map((m) => (
                              <SelectItem key={m} value={m}>
                                {m}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          Year
                        </Label>
                        <Input
                          type="number"
                          value={targetForm.year}
                          onChange={(e) => setTargetForm({ ...targetForm, year: Number(e.target.value) })}
                          className="text-xs h-9 font-bold"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Target Amount (₹)
                    </Label>
                    <Input
                      type="number"
                      placeholder="e.g. 500000"
                      value={targetForm.targetAmount}
                      onChange={(e) => setTargetForm({ ...targetForm, targetAmount: Number(e.target.value) })}
                      className="text-xs h-9 font-bold"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Category
                    </Label>
                    <Select
                      value={targetForm.category}
                      onValueChange={(val) => setTargetForm({ ...targetForm, category: val })}
                    >
                      <SelectTrigger className="text-xs h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Overall">Overall</SelectItem>
                        {DEFAULT_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    type="submit"
                    disabled={isTargetSubmitting}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-9 text-xs"
                  >
                    {isTargetSubmitting ? "Saving..." : "Set Target"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Targets Performance Table */}
            <Card className="lg:col-span-2 border-border bg-card shadow-xs overflow-hidden">
              <CardHeader className="border-b border-border flex flex-row items-center justify-between pb-4">
                <CardTitle className="text-sm font-bold text-foreground">
                  Performance & Leaderboard
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchTargets}
                  className="h-8 gap-1 text-xs"
                >
                  <RefreshCw className="w-3 h-3" /> Refresh
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                        <th className="px-5 py-3.5">Salesperson</th>
                        <th className="px-4 py-3.5 text-center">Type</th>
                        <th className="px-4 py-3.5 text-center">Period</th>
                        <th className="px-4 py-3.5 text-right">Target</th>
                        <th className="px-4 py-3.5 text-right">Achieved</th>
                        <th className="px-4 py-3.5 text-right text-emerald-600">Progress</th>
                        <th className="px-4 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {targets.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-muted-foreground italic">
                            No sales targets recorded yet. Use the form to set a target.
                          </td>
                        </tr>
                      ) : (
                        targets.map((t, idx) => {
                          const achieved = t.currentAchievement || 0;
                          const pct = t.targetAmount > 0 ? (achieved / t.targetAmount) * 100 : 0;
                          return (
                            <tr key={idx} className="hover:bg-muted/40 transition-colors">
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                                    {(t.employeeName || "SR").substring(0, 2).toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="font-bold text-foreground">{t.employeeName || "Sales Rep"}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase">{t.category || "Overall"}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3.5 text-center">
                                <Badge variant="secondary" className="text-[10px] font-bold">
                                  {t.type}
                                </Badge>
                              </td>
                              <td className="px-4 py-3.5 text-center text-muted-foreground">
                                {t.type === "Custom"
                                  ? `${t.startDate} - ${t.endDate}`
                                  : `${t.month} ${t.year}`}
                              </td>
                              <td className="px-4 py-3.5 text-right font-bold text-foreground">
                                ₹{Number(t.targetAmount || 0).toLocaleString()}
                              </td>
                              <td className="px-4 py-3.5 text-right font-bold text-emerald-600">
                                ₹{achieved.toLocaleString()}
                              </td>
                              <td className="px-4 py-3.5 text-right">
                                <div className="flex flex-col items-end gap-1">
                                  <span className="font-extrabold text-foreground">{pct.toFixed(0)}%</span>
                                  <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div
                                      className={cn(
                                        "h-full rounded-full transition-all",
                                        pct >= 100 ? "bg-emerald-500" : "bg-blue-500"
                                      )}
                                      style={{ width: `${Math.min(pct, 100)}%` }}
                                    />
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3.5 text-right">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteTarget(t.id || t._id)}
                                  className="h-7 w-7 text-muted-foreground hover:text-rose-600"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Convert to Client Modal */}
      <ConvertToClientModal
        lead={convertingLead}
        isOpen={convertingLead !== null}
        onClose={() => setConvertingLead(null)}
        onSuccess={fetchLeads}
      />

      {/* Status Change Reason Modal */}
      <StatusChangeModal
        leadId={statusChangeLeadId}
        newStatus={statusChangeNewStatus}
        isOpen={statusChangeLeadId !== null}
        onClose={() => setStatusChangeLeadId(null)}
        onSuccess={fetchLeads}
      />

      {/* Bulk Assign Modal */}
      <BulkAssignModal
        leadIds={selectedLeads}
        isOpen={isBulkAssignOpen}
        onClose={() => setIsBulkAssignOpen(false)}
        onSuccess={() => {
          setSelectedLeads([]);
          fetchLeads();
        }}
      />

      {/* Bulk Import Modal */}
      <BulkImportModal
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        onSuccess={fetchLeads}
      />

      {/* Side Details Drawer */}
      <Sheet
        open={selectedLeadDrawer !== null}
        onOpenChange={(open) => !open && setSelectedLeadDrawer(null)}
      >
        <SheetContent className="w-full max-w-full sm:max-w-md p-6 overflow-y-auto bg-card border-l border-border [&>button]:hidden shadow-2xl">
          <button
            onClick={() => setSelectedLeadDrawer(null)}
            className="absolute right-4 top-4 rounded-lg p-1.5 hover:bg-muted text-muted-foreground"
          >
            <X className="w-5 h-5" />
          </button>
          {selectedLeadDrawer && (
            <div className="space-y-6 pt-2">
              <div>
                <span className="text-[10px] font-bold tracking-widest text-emerald-600 uppercase bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  {selectedLeadDrawer.status || selectedLeadDrawer.stage}
                </span>
                <h2 className="mt-2 text-xl font-black text-foreground">
                  {selectedLeadDrawer.company || selectedLeadDrawer.contact}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {selectedLeadDrawer.contact} {selectedLeadDrawer.city ? `· ${selectedLeadDrawer.city}` : ""}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl border border-border bg-muted/20">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Phone</p>
                  <p className="text-xs font-bold text-foreground mt-0.5">
                    {selectedLeadDrawer.phone || "—"}
                  </p>
                </div>
                <div className="p-3 rounded-xl border border-border bg-muted/20">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Email</p>
                  <p className="text-xs font-bold text-foreground mt-0.5 truncate">
                    {selectedLeadDrawer.email || "—"}
                  </p>
                </div>
                <div className="p-3 rounded-xl border border-border bg-muted/20">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Category</p>
                  <p className="text-xs font-bold text-foreground mt-0.5">
                    {selectedLeadDrawer.category || "Others"}
                  </p>
                </div>
                <div className="p-3 rounded-xl border border-border bg-muted/20">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Expected Revenue</p>
                  <p className="text-xs font-bold text-emerald-600 mt-0.5">
                    {selectedLeadDrawer.expectedIncome || formatCurrency(selectedLeadDrawer.budget || 0)}
                  </p>
                </div>
              </div>

              {selectedLeadDrawer.remarks && (
                <div className="p-3 rounded-xl border border-border bg-muted/20">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Remarks</p>
                  <p className="text-xs text-foreground mt-1 whitespace-pre-wrap">
                    "{selectedLeadDrawer.remarks}"
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <FollowUpDialog
                  lead={selectedLeadDrawer}
                  userName={currentUserName}
                  trigger={
                    <Button variant="outline" className="w-full text-xs font-bold h-9">
                      <MessageSquare className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                      View Follow-up History ({selectedLeadDrawer.followUps?.length || 0})
                    </Button>
                  }
                />
                {selectedLeadDrawer.status !== "Client Won" && (
                  <Button
                    onClick={() => {
                      setConvertingLead(selectedLeadDrawer);
                      setSelectedLeadDrawer(null);
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold h-9"
                  >
                    Convert to Official Client 🏆
                  </Button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
