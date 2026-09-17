import React, { useState, useEffect, useMemo } from "react";
import { 
  Shield, 
  UserCheck, 
  Users, 
  Check, 
  X, 
  Search, 
  Save, 
  ChevronDown,
  ChevronRight,
  Sparkles,
  Layers, 
  Building2, 
  Briefcase,
  SlidersHorizontal,
  RefreshCw,
  Info,
  CheckCheck,
  Ban,
  RotateCcw
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthContext";
import { useEmployeesContext } from "@/components/employees/EmployeeContext";
import { SearchableSelect } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface SystemModule {
  id: string;
  name: string;
  section: string;
  is_parent?: boolean;
  parent_id?: string;
}

interface PermissionFlags {
  read: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
  all: boolean;
}

interface EmployeeItem {
  id: string;
  _id?: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  role: string;
}

export function AccessControl() {
  const { user, refreshProfile } = useAuth();
  const { employees: ctxEmployees } = useEmployeesContext();
  const [activeTab, setActiveTab] = useState<"departments" | "employees">("departments");
  const [modules, setModules] = useState<SystemModule[]>([]);
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [designations, setDesignations] = useState<{ id: string; name: string }[]>([]);

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([
    "HR", "Development", "Sales", "Finance", "Management", "Python", "Digital Marketing", "Creative", "Product"
  ]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("HR");
  const [availableRoles, setAvailableRoles] = useState<string[]>(["Admin", "Employee"]);
  const [empInheritanceInfo, setEmpInheritanceInfo] = useState<{ isCustom: boolean; inheritedFrom?: string }>({
    isCustom: false,
  });

  const [permissions, setPermissions] = useState<Record<string, PermissionFlags>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSection, setFilterSection] = useState<string>("All");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Track open/collapsed parent accordion groups
  const [collapsedParents, setCollapsedParents] = useState<Record<string, boolean>>({});

  const toggleParentCollapse = (parentId: string) => {
    setCollapsedParents(prev => ({
      ...prev,
      [parentId]: !prev[parentId]
    }));
  };

  // Sync employees from EmployeeContext when available
  useEffect(() => {
    if (ctxEmployees && ctxEmployees.length > 0) {
      const empList: EmployeeItem[] = ctxEmployees.map((e: any) => ({
        id: String(e.id || e._id),
        name: e.name || `${e.personal_info?.first_name || e.firstName || ""} ${e.personal_info?.last_name || e.lastName || ""}`.trim() || "Employee",
        email: e.personal_info?.email_address || e.email || "",
        department: e.work_details?.department || e.department || "",
        designation: e.work_details?.designation || e.designation || "",
        role: e.work_details?.system_role || e.role || "Employee",
      }));
      setEmployees(empList);
      if (!selectedEmployeeId && empList[0]) {
        setSelectedEmployeeId(empList[0].id);
      }
    }
  }, [ctxEmployees]);

  // Load modules, employees, roles
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch system modules
      const mods = await api.get<SystemModule[]>("/permissions/modules", { showErrorToast: false });
      if (mods && mods.length > 0) {
        setModules(mods);
      }

      // 2. Fetch all employees only if not already loaded in context
      if (!ctxEmployees || ctxEmployees.length === 0) {
        const empRes = await api.get<any>("/employees", { showErrorToast: false });
        const rawEmps = empRes?.data || empRes?.items || empRes || [];
        const empList: EmployeeItem[] = rawEmps.map((e: any) => ({
          id: String(e._id || e.id),
          name: `${e.personal_info?.first_name || ""} ${e.personal_info?.last_name || ""}`.trim() || e.name || "Employee",
          email: e.personal_info?.email_address || e.email || "",
          department: e.work_details?.department || "",
          designation: e.work_details?.designation || "",
          role: e.work_details?.system_role || "Employee",
        }));
        setEmployees(empList);
        if (empList.length > 0 && !selectedEmployeeId && empList[0]) {
          setSelectedEmployeeId(empList[0].id);
        }
      }

      // 3. Fetch available departments
      try {
        const deptsRes = await api.get<string[]>("/permissions/departments", { showErrorToast: false });
        if (deptsRes && Array.isArray(deptsRes) && deptsRes.length > 0) {
          setAvailableDepartments(deptsRes);
        }
      } catch (err) {
        console.warn("Error fetching departments", err);
      }

      // 4. Fetch available system roles
      try {
        const rolesRes = await api.get<string[]>("/permissions/roles", { showErrorToast: false });
        if (rolesRes && Array.isArray(rolesRes) && rolesRes.length > 0) {
          setAvailableRoles(rolesRes);
        }
      } catch (err) {
        console.warn("Error fetching roles", err);
      }
    } catch (err) {
      console.error("Failed to load access control data", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Load permissions when selected employee changes
  useEffect(() => {
    if (activeTab === "employees" && selectedEmployeeId) {
      loadEmployeePermissions(selectedEmployeeId);
    }
  }, [selectedEmployeeId, activeTab]);

  // Load preset permissions when selected department changes
  useEffect(() => {
    if (activeTab === "departments" && selectedDepartment) {
      loadDepartmentPresetPermissions(selectedDepartment);
    }
  }, [selectedDepartment, activeTab]);

  const loadEmployeePermissions = async (empId: string) => {
    setIsLoading(true);
    try {
      const res = await api.get<any>(`/permissions/${empId}`, { showErrorToast: false });
      setEmpInheritanceInfo({
        isCustom: Boolean(res?.is_custom),
        inheritedFrom: res?.inherited_from || undefined,
      });

      const rawPerms = res?.module_permissions || {};
      const formatted: Record<string, PermissionFlags> = {};
      
      modules.forEach(m => {
        const p = rawPerms[m.id] || {};
        formatted[m.id] = {
          read: Boolean(p.read || p.all),
          create: Boolean(p.create || p.all),
          update: Boolean(p.update || p.all),
          delete: Boolean(p.delete || p.all),
          all: Boolean(p.all),
        };
      });
      setPermissions(formatted);
    } catch (err) {
      console.error("Failed to load user permissions", err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadDepartmentPresetPermissions = async (deptName: string) => {
    setIsLoading(true);
    try {
      const res = await api.get<any>(`/permissions/presets/department/${encodeURIComponent(deptName)}`, { showErrorToast: false });
      const rawPerms = res?.module_permissions || {};
      const formatted: Record<string, PermissionFlags> = {};
      
      modules.forEach(m => {
        const p = rawPerms[m.id] || {};
        formatted[m.id] = {
          read: Boolean(p.read || p.all),
          create: Boolean(p.create || p.all),
          update: Boolean(p.update || p.all),
          delete: Boolean(p.delete || p.all),
          all: Boolean(p.all),
        };
      });
      setPermissions(formatted);
    } catch (err) {
      console.error("Failed to load department preset permissions", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = (moduleId: string, action: keyof PermissionFlags) => {
    setPermissions(prev => {
      const current = prev[moduleId] || { read: false, create: false, update: false, delete: false, all: false };
      let updated: PermissionFlags;

      if (action === "all") {
        const nextVal = !current.all;
        updated = {
          read: nextVal,
          create: nextVal,
          update: nextVal,
          delete: nextVal,
          all: nextVal,
        };
      } else {
        const nextVal = !current[action];
        updated = {
          ...current,
          [action]: nextVal,
        };
        if (updated.read && updated.create && updated.update && updated.delete) {
          updated.all = true;
        } else {
          updated.all = false;
        }
      }

      // If this is a parent module and toggled 'all', also toggle all its children!
      const mod = modules.find(m => m.id === moduleId);
      const childUpdates: Record<string, PermissionFlags> = {};
      if (mod?.is_parent && action === "all") {
        const children = modules.filter(m => m.parent_id === moduleId);
        children.forEach(c => {
          childUpdates[c.id] = { ...updated };
        });
      }

      return {
        ...prev,
        [moduleId]: updated,
        ...childUpdates
      };
    });
  };

  // Master Full Access (Grants Read, Create, Update, Delete, and All to EVERY module and sub-module)
  const handleGrantFullAccessAll = () => {
    const updated: Record<string, PermissionFlags> = {};
    modules.forEach(m => {
      updated[m.id] = { read: true, create: true, update: true, delete: true, all: true };
    });
    setPermissions(updated);
    toast.success("Full Access granted to ALL modules and sub-items!");
  };

  // Master Revoke All Access
  const handleRevokeAll = () => {
    const updated: Record<string, PermissionFlags> = {};
    modules.forEach(m => {
      updated[m.id] = { read: false, create: false, update: false, delete: false, all: false };
    });
    setPermissions(updated);
    toast.info("Revoked access from all modules");
  };

  // Toggle full access for an entire section
  const handleToggleSectionAll = (sec: string) => {
    const sectionMods = modules.filter(m => m.section === sec);
    const allCurrentlyActive = sectionMods.every(m => permissions[m.id]?.all);
    const nextVal = !allCurrentlyActive;

    setPermissions(prev => {
      const next = { ...prev };
      sectionMods.forEach(m => {
        next[m.id] = {
          read: nextVal,
          create: nextVal,
          update: nextVal,
          delete: nextVal,
          all: nextVal,
        };
      });
      return next;
    });

    toast.success(`${nextVal ? 'Granted' : 'Revoked'} full access for ${sec}`);
  };

  const handleResetEmployeeToPreset = async () => {
    if (!selectedEmployeeId) return;
    setIsSaving(true);
    try {
      await api.delete(`/permissions/${selectedEmployeeId}`);
      toast.success("Employee permissions reset to inherit Preset defaults!");
      await loadEmployeePermissions(selectedEmployeeId);
      refreshProfile();
    } catch (err: any) {
      toast.error(err?.message || "Failed to reset employee permissions");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (activeTab === "employees") {
        if (!selectedEmployeeId) {
          toast.error("Please select an employee first");
          return;
        }
        await api.post("/permissions", {
          employee_id: selectedEmployeeId,
          module_permissions: permissions,
        });
        toast.success("Employee custom permissions saved successfully!");
        setEmpInheritanceInfo({ isCustom: true });
        refreshProfile();
      } else {
        if (!selectedDepartment) {
          toast.error("Please select a Department");
          return;
        }
        await api.post("/permissions/presets", {
          department: selectedDepartment,
          role: "Employee",
          module_permissions: permissions,
        });
        toast.success(`'${selectedDepartment}' Department Preset saved! All employees in '${selectedDepartment}' will automatically inherit these permissions.`);
        refreshProfile();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save permissions");
    } finally {
      setIsSaving(false);
    }
  };

  const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);

  // Sections
  const sections = useMemo(() => {
    const set = new Set<string>();
    modules.forEach(m => set.add(m.section));
    return ["All", ...Array.from(set)];
  }, [modules]);

  // Group modules hierarchically
  const hierarchicalModules = useMemo(() => {
    // Top-level modules (either standalone or parent)
    const parents = modules.filter(m => !m.parent_id);
    return parents;
  }, [modules]);

  // Filter modules based on search and section tab
  const filteredParents = useMemo(() => {
    return hierarchicalModules.filter(p => {
      const matchesSection = filterSection === "All" || p.section === filterSection;
      if (!matchesSection) return false;

      if (!searchQuery) return true;

      const q = searchQuery.toLowerCase();
      // Check if parent matches
      if (p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)) return true;
      // Or if any of its children match
      const children = modules.filter(m => m.parent_id === p.id);
      return children.some(c => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q));
    });
  }, [hierarchicalModules, modules, searchQuery, filterSection]);

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6 pb-28 max-w-full overflow-x-hidden">
      
      {/* Header Banner - Fully Responsive */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-card border border-border/60 rounded-3xl p-5 md:p-6 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
            <span>Admin</span>
            <span>/</span>
            <span className="text-foreground">Access Control</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-foreground flex items-center gap-3">
            <Shield className="w-8 h-8 sm:w-9 sm:h-9 text-primary shrink-0" />
            <span>Dynamic Access Control</span>
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm font-medium">
            Configure granular parent &amp; sub-item dropdown permissions for employees and department presets.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 pt-2 lg:pt-0">
          <button
            onClick={handleGrantFullAccessAll}
            className="flex-1 sm:flex-none px-4 py-2.5 text-xs font-black rounded-xl bg-primary text-primary-foreground shadow-md hover:bg-primary/90 transition-all flex items-center justify-center gap-2 active:scale-95"
            title="Grant full CRUD access across all parent & sub-modules"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Full Access (All)</span>
          </button>
          <button
            onClick={handleRevokeAll}
            className="px-3.5 py-2.5 text-xs font-bold rounded-xl border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 transition-all flex items-center justify-center gap-1.5 active:scale-95"
            title="Revoke all permissions"
          >
            <Ban className="w-4 h-4" />
            <span>Revoke All</span>
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black shadow-md hover:bg-emerald-700 transition-all disabled:opacity-50 active:scale-95"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? "Saving..." : "Save Changes"}</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border gap-4 sm:gap-6 overflow-x-auto scrollbar-hide">
        <button
          onClick={() => setActiveTab("departments")}
          className={cn(
            "pb-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap",
            activeTab === "departments"
              ? "border-primary text-primary font-black"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Layers className="w-4 h-4" />
          Department-Wise Presets
        </button>
        <button
          onClick={() => setActiveTab("employees")}
          className={cn(
            "pb-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap",
            activeTab === "employees"
              ? "border-primary text-primary font-black"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Users className="w-4 h-4" />
          Employee-Wise Access
        </button>
      </div>

      {/* Target Selector Banner */}
      <div className="bg-card border border-border/50 rounded-2xl p-4 sm:p-5 shadow-sm">
        {activeTab === "employees" ? (
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex-1 max-w-full lg:max-w-md">
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                Select Employee to Configure Access
              </label>
              <SearchableSelect
                value={selectedEmployeeId}
                onChange={(val) => setSelectedEmployeeId(val as string)}
                options={employees.map(e => ({
                  label: `${e.name} (${e.email}) — [${e.role}]`,
                  value: e.id
                }))}
                className="w-full h-11 px-4 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-xs sm:text-sm font-medium"
              />
            </div>
            {selectedEmployee && (
              <div className="flex flex-wrap items-center gap-3 bg-muted/40 p-3 rounded-xl border border-border/50 text-xs w-full lg:w-auto">
                <div>
                  <span className="text-muted-foreground font-semibold">Department:</span>{" "}
                  <span className="font-bold text-foreground">{selectedEmployee.department || "N/A"}</span>
                </div>
                <div className="h-4 w-px bg-border hidden sm:block" />
                <div>
                  <span className="text-muted-foreground font-semibold">Designation:</span>{" "}
                  <span className="font-bold text-foreground">{selectedEmployee.designation || "N/A"}</span>
                </div>
                <div className="h-4 w-px bg-border hidden sm:block" />
                <div>
                  <span className="text-muted-foreground font-semibold">Role:</span>{" "}
                  <span className={cn(
                    "px-2 py-0.5 rounded-md font-black uppercase text-[10px]",
                    selectedEmployee.role === "Admin" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground border border-border"
                  )}>
                    {selectedEmployee.role}
                  </span>
                </div>
                <div className="h-4 w-px bg-border hidden sm:block" />
                <div className="flex items-center gap-2">
                  {empInheritanceInfo.isCustom ? (
                    <>
                      <span className="px-2.5 py-1 rounded-md font-bold text-[11px] bg-amber-500/10 text-amber-500 border border-amber-500/25 flex items-center gap-1.5 shadow-sm">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" /> Custom Overrides Active
                      </span>
                      <button
                        onClick={handleResetEmployeeToPreset}
                        disabled={isSaving}
                        className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-background hover:bg-destructive/10 text-muted-foreground hover:text-destructive border border-border transition-colors flex items-center gap-1.5 shadow-sm"
                        title="Revert custom permissions so this employee inherits from Department Preset again"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Reset to Department Preset
                      </button>
                    </>
                  ) : (
                    <span className="px-2.5 py-1 rounded-md font-bold text-[11px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 flex items-center gap-1.5 shadow-sm">
                      <Layers className="w-3.5 h-3.5" /> Inheriting: {empInheritanceInfo.inheritedFrom || `Department Preset (${selectedEmployee.department})`}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
              <Info className="w-4 h-4 text-primary shrink-0" />
              <span>
                Select a Department below to configure its permissions preset. All employees in that department will automatically inherit these permissions in real-time.
              </span>
            </div>
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                Select Department for Preset
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {availableDepartments.map(dept => {
                  const descMap: Record<string, string> = {
                    "HR": "Human Resources, Recruitment & Approvals",
                    "Development": "Frontend, Backend & Engineering",
                    "Python": "AI/ML, Data & Python Services",
                    "Sales": "Leads, Pipeline & Invoicing",
                    "Finance": "Payroll, Transactions & Accounts",
                    "Management": "Approvals, Strategy & Reports",
                    "Digital Marketing": "SEO, Ads & Marketing",
                    "Creative": "UI/UX, Visual Design & Media",
                    "Product": "Roadmaps, Analytics & Strategy",
                  };
                  return (
                    <button
                      key={dept}
                      type="button"
                      onClick={() => setSelectedDepartment(dept)}
                      className={cn(
                        "p-3 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between",
                        selectedDepartment === dept
                          ? "bg-primary text-primary-foreground border-primary shadow-md ring-2 ring-primary/30"
                          : "bg-background hover:bg-muted text-foreground border-border/80"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-black text-sm tracking-wide">{dept}</span>
                        {selectedDepartment === dept && <Check className="w-4 h-4 text-primary-foreground" />}
                      </div>
                      <span className={cn(
                        "text-[10px] font-medium leading-tight line-clamp-2",
                        selectedDepartment === dept ? "text-primary-foreground/80" : "text-muted-foreground"
                      )}>
                        {descMap[dept] || "Department Access Preset"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search parent module or sub-item..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-card border border-border/50 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 scrollbar-hide">
          {sections.map(sec => (
            <button
              key={sec}
              onClick={() => setFilterSection(sec)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors shrink-0",
                filterSection === sec
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-card border border-border/50 text-muted-foreground hover:text-foreground"
              )}
            >
              {sec}
            </button>
          ))}
        </div>
      </div>

      {/* Hierarchical Permissions Matrix Table */}
      <div className="bg-card border border-border/50 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[760px]">
            <thead>
              <tr className="bg-muted/40 border-b border-border/60 text-muted-foreground font-bold text-xs uppercase tracking-wider">
                <th className="p-4 pl-6 w-[340px]">Module / Sub-Item (Dropdown)</th>
                <th className="p-4 w-[140px]">Section</th>
                <th className="p-4 text-center w-[90px]">View (Read)</th>
                <th className="p-4 text-center w-[90px]">Add (Create)</th>
                <th className="p-4 text-center w-[90px]">Edit (Update)</th>
                <th className="p-4 text-center w-[90px]">Delete</th>
                <th className="p-4 pr-6 text-center w-[120px]">Full Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50 text-sm font-medium">
              {filteredParents.map(parent => {
                const isParentCollapsed = Boolean(collapsedParents[parent.id]);
                const children = modules.filter(m => m.parent_id === parent.id);
                const hasChildren = children.length > 0;
                const parentPerm = permissions[parent.id] || { read: false, create: false, update: false, delete: false, all: false };

                return (
                  <React.Fragment key={parent.id}>
                    {/* Parent Row */}
                    <tr className={cn("transition-colors", hasChildren ? "bg-muted/15 font-bold" : "hover:bg-muted/20")}>
                      <td className="p-3.5 pl-6">
                        <div className="flex items-center gap-2">
                          {hasChildren ? (
                            <button
                              onClick={() => toggleParentCollapse(parent.id)}
                              className="p-1 hover:bg-muted rounded-md text-muted-foreground transition-transform shrink-0"
                              title={isParentCollapsed ? "Expand sub-items" : "Collapse sub-items"}
                            >
                              {isParentCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          ) : (
                            <span className="w-6 shrink-0" />
                          )}
                          <div>
                            <div className="flex items-center gap-2 text-foreground font-bold">
                              <span>{parent.name}</span>
                              {hasChildren && (
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                                  {children.length} sub-items
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-mono text-muted-foreground font-normal">{parent.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-muted text-muted-foreground border border-border/40">
                          {parent.section}
                        </span>
                      </td>
                      {/* Read */}
                      <td className="p-3.5 text-center">
                        <button
                          onClick={() => handleToggle(parent.id, "read")}
                          className={cn(
                            "w-7 h-7 rounded-lg inline-flex items-center justify-center transition-all border shadow-xs active:scale-90",
                            parentPerm.read
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-black"
                              : "bg-muted/40 border-border/50 text-muted-foreground/30 hover:bg-muted"
                          )}
                        >
                          <Check className={cn("w-4 h-4", !parentPerm.read && "opacity-20")} />
                        </button>
                      </td>
                      {/* Create */}
                      <td className="p-3.5 text-center">
                        <button
                          onClick={() => handleToggle(parent.id, "create")}
                          className={cn(
                            "w-7 h-7 rounded-lg inline-flex items-center justify-center transition-all border shadow-xs active:scale-90",
                            parentPerm.create
                              ? "bg-primary/10 border-primary/30 text-primary font-black"
                              : "bg-muted/40 border-border/50 text-muted-foreground/30 hover:bg-muted"
                          )}
                        >
                          <Check className={cn("w-4 h-4", !parentPerm.create && "opacity-20")} />
                        </button>
                      </td>
                      {/* Update */}
                      <td className="p-3.5 text-center">
                        <button
                          onClick={() => handleToggle(parent.id, "update")}
                          className={cn(
                            "w-7 h-7 rounded-lg inline-flex items-center justify-center transition-all border shadow-xs active:scale-90",
                            parentPerm.update
                              ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 font-black"
                              : "bg-muted/40 border-border/50 text-muted-foreground/30 hover:bg-muted"
                          )}
                        >
                          <Check className={cn("w-4 h-4", !parentPerm.update && "opacity-20")} />
                        </button>
                      </td>
                      {/* Delete */}
                      <td className="p-3.5 text-center">
                        <button
                          onClick={() => handleToggle(parent.id, "delete")}
                          className={cn(
                            "w-7 h-7 rounded-lg inline-flex items-center justify-center transition-all border shadow-xs active:scale-90",
                            parentPerm.delete
                              ? "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400 font-black"
                              : "bg-muted/40 border-border/50 text-muted-foreground/30 hover:bg-muted"
                          )}
                        >
                          <Check className={cn("w-4 h-4", !parentPerm.delete && "opacity-20")} />
                        </button>
                      </td>
                      {/* All */}
                      <td className="p-3.5 pr-6 text-center">
                        <button
                          onClick={() => handleToggle(parent.id, "all")}
                          className={cn(
                            "px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider transition-all border inline-flex items-center gap-1.5 active:scale-95 shadow-xs",
                            parentPerm.all
                              ? "bg-primary text-primary-foreground border-primary shadow-sm"
                              : "bg-muted/40 border-border/50 text-muted-foreground hover:bg-muted"
                          )}
                        >
                          {parentPerm.all ? "Full Access" : "Custom"}
                        </button>
                      </td>
                    </tr>

                    {/* Sub-Items (Dropdown Children Rows) */}
                    {hasChildren && !isParentCollapsed && (
                      children.map(child => {
                        const childPerm = permissions[child.id] || { read: false, create: false, update: false, delete: false, all: false };
                        return (
                          <tr key={child.id} className="bg-background/60 hover:bg-muted/20 transition-colors">
                            <td className="p-3 pl-12">
                              <div className="flex items-center gap-2 border-l-2 border-primary/30 pl-3">
                                <div>
                                  <div className="font-semibold text-foreground text-xs sm:text-sm">{child.name}</div>
                                  <div className="text-[10px] font-mono text-muted-foreground">{child.id}</div>
                                </div>
                              </div>
                            </td>
                            <td className="p-3">
                              <span className="text-[10px] font-semibold text-muted-foreground italic">
                                Sub-item
                              </span>
                            </td>
                            {/* Child Read */}
                            <td className="p-3 text-center">
                              <button
                                onClick={() => handleToggle(child.id, "read")}
                                className={cn(
                                  "w-6 h-6 rounded-md inline-flex items-center justify-center transition-all border active:scale-90",
                                  childPerm.read
                                    ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold"
                                    : "bg-muted/40 border-border/50 text-muted-foreground/30 hover:bg-muted"
                                )}
                              >
                                <Check className={cn("w-3.5 h-3.5", !childPerm.read && "opacity-20")} />
                              </button>
                            </td>
                            {/* Child Create */}
                            <td className="p-3 text-center">
                              <button
                                onClick={() => handleToggle(child.id, "create")}
                                className={cn(
                                  "w-6 h-6 rounded-md inline-flex items-center justify-center transition-all border active:scale-90",
                                  childPerm.create
                                    ? "bg-primary/15 border-primary/30 text-primary font-bold"
                                    : "bg-muted/40 border-border/50 text-muted-foreground/30 hover:bg-muted"
                                )}
                              >
                                <Check className={cn("w-3.5 h-3.5", !childPerm.create && "opacity-20")} />
                              </button>
                            </td>
                            {/* Child Update */}
                            <td className="p-3 text-center">
                              <button
                                onClick={() => handleToggle(child.id, "update")}
                                className={cn(
                                  "w-6 h-6 rounded-md inline-flex items-center justify-center transition-all border active:scale-90",
                                  childPerm.update
                                    ? "bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400 font-bold"
                                    : "bg-muted/40 border-border/50 text-muted-foreground/30 hover:bg-muted"
                                )}
                              >
                                <Check className={cn("w-3.5 h-3.5", !childPerm.update && "opacity-20")} />
                              </button>
                            </td>
                            {/* Child Delete */}
                            <td className="p-3 text-center">
                              <button
                                onClick={() => handleToggle(child.id, "delete")}
                                className={cn(
                                  "w-6 h-6 rounded-md inline-flex items-center justify-center transition-all border active:scale-90",
                                  childPerm.delete
                                    ? "bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-400 font-bold"
                                    : "bg-muted/40 border-border/50 text-muted-foreground/30 hover:bg-muted"
                                )}
                              >
                                <Check className={cn("w-3.5 h-3.5", !childPerm.delete && "opacity-20")} />
                              </button>
                            </td>
                            {/* Child All */}
                            <td className="p-3 pr-6 text-center">
                              <button
                                onClick={() => handleToggle(child.id, "all")}
                                className={cn(
                                  "px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase transition-all border active:scale-95",
                                  childPerm.all
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-muted/40 border-border/50 text-muted-foreground hover:bg-muted"
                                )}
                              >
                                {childPerm.all ? "Full Access" : "Custom"}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
