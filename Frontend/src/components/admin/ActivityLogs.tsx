import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { 
  ShieldAlert, 
  Activity, 
  Users, 
  IndianRupee, 
  Settings, 
  TerminalSquare, 
  AlertTriangle, 
  Key, 
  RefreshCw, 
  Briefcase, 
  Target, 
  CheckCircle2,
  Calendar,
  Search,
  Filter,
  Download,
  X,
  ArrowUpDown,
  UserCheck,
  Tag,
  ChevronDown,
  Check,
  ListFilter,
  Building2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getAvatarUrl, handleAvatarError } from "@/lib/config";
import { useAuth } from "@/components/auth/AuthContext";

interface ActivityLogItem {
  id?: string;
  _id?: string;
  timestamp?: string;
  created_at?: string;
  action: string;
  category: string;
  severity: string;
  description?: string;
  metadata?: string;
  ip?: string;
  performed_by_id?: string;
  performed_by_name?: string;
  performed_by_role?: string;
  performed_by_department?: string;
  performed_by_avatar?: string;
  user_name?: string;
}

interface UserFilterItem {
  id: string;
  name: string;
  department?: string;
  role?: string;
  avatar?: string;
}

interface FilterOptions {
  categories: string[];
  departments: string[];
  severities: string[];
  users: UserFilterItem[];
}

interface ActivityLogsResponse {
  data: ActivityLogItem[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  is_admin?: boolean;
  filter_options?: FilterOptions;
  stats?: {
    events_today: number;
    critical_alerts: number;
    warning_alerts: number;
    total_records: number;
  };
}

const DEFAULT_CATEGORIES = ["All", "Auth", "People", "Work", "Sales", "Payroll", "System"];

const getCategoryIcon = (category: string) => {
  const cat = (category || "").toLowerCase();
  if (cat.includes("auth") || cat.includes("login")) return <Key className="w-3.5 h-3.5" />;
  if (cat.includes("people") || cat.includes("employee")) return <Users className="w-3.5 h-3.5" />;
  if (cat.includes("work") || cat.includes("task") || cat.includes("project")) return <Briefcase className="w-3.5 h-3.5" />;
  if (cat.includes("sales") || cat.includes("lead")) return <Target className="w-3.5 h-3.5" />;
  if (cat.includes("payroll") || cat.includes("finance")) return <IndianRupee className="w-3.5 h-3.5" />;
  if (cat.includes("system")) return <Settings className="w-3.5 h-3.5" />;
  return <Activity className="w-3.5 h-3.5" />;
};

// Reusable sleek modern dropdown component
interface DropdownOption {
  value: string;
  label: string;
  subLabel?: string;
  icon?: React.ReactNode;
}

interface FilterDropdownProps {
  label: string;
  icon: React.ReactNode;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  defaultValue?: string;
  align?: "left" | "right";
  className?: string;
}

function FilterDropdown({
  label,
  icon,
  value,
  options,
  onChange,
  defaultValue = "All",
  align = "left",
  className,
}: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const selectedOption = options.find((opt) => opt.value === value);
  const isFiltered = value !== defaultValue && value !== "";
  const displayLabel = selectedOption ? selectedOption.label : label;

  return (
    <div className={cn("relative inline-block text-left", className)} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "h-9 px-3 rounded-xl text-xs font-bold border transition-all duration-150 flex items-center gap-2 shadow-xs cursor-pointer select-none",
          isFiltered
            ? "bg-primary/10 text-primary border-primary/30 shadow-xs"
            : "bg-card text-foreground/80 border-border hover:border-border hover:bg-muted/50 hover:text-foreground",
          isOpen && "ring-2 ring-primary/20 border-primary"
        )}
      >
        <span className={cn("shrink-0", isFiltered ? "text-primary" : "text-muted-foreground")}>
          {icon}
        </span>
        <span className="truncate max-w-[130px]">{displayLabel}</span>
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 shrink-0",
            isOpen && "transform rotate-180 text-foreground"
          )}
        />
      </button>

      {isOpen && (
        <div
          className={cn(
            "absolute mt-1.5 py-1.5 min-w-[185px] max-w-[280px] max-h-72 overflow-y-auto rounded-2xl bg-popover/95 backdrop-blur-md border border-border shadow-xl z-50 animate-in fade-in-0 zoom-in-95 duration-100 scrollbar-thin",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full text-left px-3 py-2 text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer select-none",
                  isSelected
                    ? "bg-primary/10 text-primary font-bold"
                    : "text-foreground hover:bg-muted/60"
                )}
              >
                <div className="flex flex-col truncate pr-2">
                  <div className="flex items-center gap-2 truncate">
                    {opt.icon && <span className="shrink-0 text-muted-foreground">{opt.icon}</span>}
                    <span className="truncate">{opt.label}</span>
                  </div>
                  {opt.subLabel && (
                    <span className="text-[10px] text-muted-foreground font-normal truncate mt-0.5">
                      {opt.subLabel}
                    </span>
                  )}
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0 ml-2" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ActivityLogs() {
  const { user: authUser } = useAuth();
  const userRole = (authUser?.role || (authUser as any)?.system_role || "").toLowerCase();
  const isAdmin = ["admin", "superadmin", "hr"].includes(userRole);

  // Filters State
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [severityFilter, setSeverityFilter] = useState<string>("All");
  const [userFilter, setUserFilter] = useState<string>("All");
  const [departmentFilter, setDepartmentFilter] = useState<string>("All");
  const [actionFilter, setActionFilter] = useState<string>("All");
  const [dateRangePreset, setDateRangePreset] = useState<string>("all");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Pagination & Layout State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  
  // Data State
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [backendFilterOptions, setBackendFilterOptions] = useState<FilterOptions>({
    categories: [],
    departments: [],
    severities: [],
    users: [],
  });
  const [stats, setStats] = useState({
    events_today: 0,
    critical_alerts: 0,
    warning_alerts: 0,
    total_records: 0
  });

  // Calculate actual Date Range values based on preset
  const calculatedDateRange = useMemo(() => {
    const today = new Date();
    const formatYMD = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    if (dateRangePreset === "today") {
      const ymd = formatYMD(today);
      return { start_date: ymd, end_date: ymd, label: "Today" };
    }
    if (dateRangePreset === "yesterday") {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      const ymd = formatYMD(y);
      return { start_date: ymd, end_date: ymd, label: "Yesterday" };
    }
    if (dateRangePreset === "7days") {
      const d = new Date(today);
      d.setDate(d.getDate() - 7);
      return { start_date: formatYMD(d), end_date: formatYMD(today), label: "Last 7 Days" };
    }
    if (dateRangePreset === "30days") {
      const d = new Date(today);
      d.setDate(d.getDate() - 30);
      return { start_date: formatYMD(d), end_date: formatYMD(today), label: "Last 30 Days" };
    }
    if (dateRangePreset === "month") {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start_date: formatYMD(firstDay), end_date: formatYMD(today), label: "This Month" };
    }
    if (dateRangePreset === "custom") {
      return {
        start_date: customStartDate || undefined,
        end_date: customEndDate || undefined,
        label: customStartDate && customEndDate ? `${customStartDate} to ${customEndDate}` : "Custom Range"
      };
    }
    return { start_date: undefined, end_date: undefined, label: "All Time" };
  }, [dateRangePreset, customStartDate, customEndDate]);

  // Combined Category list merging defaults and distinct ones from database
  const allCategories = useMemo(() => {
    const set = new Set<string>(DEFAULT_CATEGORIES);
    (backendFilterOptions.categories || []).forEach(c => {
      if (c && typeof c === "string") set.add(c);
    });
    return Array.from(set);
  }, [backendFilterOptions.categories]);

  // Filter Dropdown Options
  const severityOptions: DropdownOption[] = [
    { value: "All", label: "All Severities" },
    { value: "Info", label: "Info" },
    { value: "Warning", label: "Warning" },
    { value: "Critical", label: "Critical" },
  ];

  // All company employees dropdown options
  const userOptions: DropdownOption[] = useMemo(() => {
    const base: DropdownOption[] = [{ value: "All", label: "All Users" }];
    (backendFilterOptions.users || []).forEach((u) => {
      if (u && u.name) {
        base.push({
          value: u.name,
          label: u.name,
          subLabel: u.department ? `${u.department} • ${u.role || 'Member'}` : (u.role || '')
        });
      }
    });
    return base;
  }, [backendFilterOptions.users]);

  // Department dropdown options
  const departmentOptions: DropdownOption[] = useMemo(() => {
    const base: DropdownOption[] = [{ value: "All", label: "All Departments" }];
    const depts = backendFilterOptions.departments && backendFilterOptions.departments.length > 0
      ? backendFilterOptions.departments
      : ["Development", "Creative", "HR", "Sales", "Management", "Digital Marketing"];
    depts.forEach((d) => {
      base.push({ value: d, label: d });
    });
    return base;
  }, [backendFilterOptions.departments]);

  const actionOptions: DropdownOption[] = [
    { value: "All", label: "All Actions" },
    { value: "Login", label: "Login / Auth" },
    { value: "Profile", label: "Profile / Employee" },
    { value: "Task", label: "Task / Project" },
    { value: "Content", label: "Content Calendar" },
    { value: "Sales", label: "Sales / Lead" },
    { value: "Update", label: "Update / Edit" },
    { value: "Delete", label: "Delete / Archive" },
    { value: "Issue", label: "Issue / Ticket" },
    { value: "Security", label: "Security / Core" },
  ];

  const dateOptions: DropdownOption[] = [
    { value: "all", label: "All Time" },
    { value: "today", label: "Today" },
    { value: "yesterday", label: "Yesterday" },
    { value: "7days", label: "Last 7 Days" },
    { value: "30days", label: "Last 30 Days" },
    { value: "month", label: "This Month" },
    { value: "custom", label: "Custom Date Range" },
  ];

  const sortOptions: DropdownOption[] = [
    { value: "desc", label: "Newest First" },
    { value: "asc", label: "Oldest First" },
  ];

  const limitOptions: DropdownOption[] = [
    { value: "15", label: "15 rows" },
    { value: "25", label: "25 rows" },
    { value: "50", label: "50 rows" },
    { value: "100", label: "100 rows" },
  ];

  // Fetch Logs with all active filters
  const fetchLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (activeCategory !== "All") params.set("category", activeCategory);
      if (severityFilter !== "All") params.set("severity", severityFilter);
      if (isAdmin && userFilter !== "All") params.set("user_name", userFilter);
      if (isAdmin && departmentFilter !== "All") params.set("department", departmentFilter);
      if (actionFilter !== "All") params.set("action_type", actionFilter);
      if (sortOrder) params.set("sort_order", sortOrder);
      if (calculatedDateRange.start_date) params.set("start_date", calculatedDateRange.start_date);
      if (calculatedDateRange.end_date) params.set("end_date", calculatedDateRange.end_date);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());

      const res = await api.get<ActivityLogsResponse>(`/activity-logs?${params.toString()}`, { showErrorToast: false });
      if (res && Array.isArray(res.data)) {
        setLogs(res.data);
        setTotal(res.total || 0);
        setTotalPages(res.total_pages || 1);
        if (res.stats) {
          setStats(res.stats);
        }
        if (res.filter_options) {
          setBackendFilterOptions(res.filter_options);
        }
      }
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  }, [
    page, 
    limit, 
    activeCategory, 
    severityFilter, 
    userFilter, 
    departmentFilter, 
    actionFilter, 
    sortOrder, 
    calculatedDateRange, 
    searchQuery,
    isAdmin
  ]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Reset page to 1 whenever any filter changes
  useEffect(() => {
    setPage(1);
  }, [
    activeCategory, 
    severityFilter, 
    userFilter, 
    departmentFilter, 
    actionFilter, 
    dateRangePreset, 
    customStartDate, 
    customEndDate, 
    sortOrder, 
    searchQuery,
    limit
  ]);

  // Clear all filters handler
  const handleClearAllFilters = () => {
    setActiveCategory("All");
    setSeverityFilter("All");
    setUserFilter("All");
    setDepartmentFilter("All");
    setActionFilter("All");
    setDateRangePreset("all");
    setCustomStartDate("");
    setCustomEndDate("");
    setSortOrder("desc");
    setSearchQuery("");
    setPage(1);
  };

  // Check if any filter is active
  const isAnyFilterActive = useMemo(() => {
    return (
      activeCategory !== "All" ||
      severityFilter !== "All" ||
      (isAdmin && userFilter !== "All") ||
      (isAdmin && departmentFilter !== "All") ||
      actionFilter !== "All" ||
      dateRangePreset !== "all" ||
      Boolean(searchQuery.trim())
    );
  }, [activeCategory, severityFilter, userFilter, departmentFilter, actionFilter, dateRangePreset, searchQuery, isAdmin]);

  // Export current filtered logs to CSV
  const handleExportCsv = () => {
    if (logs.length === 0) return;
    const headers = ["Timestamp", "User", "Department", "Role", "Action", "Category", "Severity", "Description", "IP Address", "Metadata"];
    const rows = logs.map(l => [
      `"${(l.timestamp || l.created_at || '').replace(/"/g, '""')}"`,
      `"${(l.performed_by_name || l.user_name || '').replace(/"/g, '""')}"`,
      `"${(l.performed_by_department || '').replace(/"/g, '""')}"`,
      `"${(l.performed_by_role || '').replace(/"/g, '""')}"`,
      `"${(l.action || '').replace(/"/g, '""')}"`,
      `"${(l.category || '').replace(/"/g, '""')}"`,
      `"${(l.severity || '').replace(/"/g, '""')}"`,
      `"${(l.description || '').replace(/"/g, '""')}"`,
      `"${(l.ip || '').replace(/"/g, '""')}"`,
      `"${(l.metadata || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `activity_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatTimestamp = (ts?: string) => {
    if (!ts) return "Just now";
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return ts;
      return d.toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      });
    } catch {
      return ts;
    }
  };

  return (
    <div className="space-y-6 min-h-[calc(100vh-4rem)] flex flex-col pb-6">
      {/* Header & Metric Cards */}
      <div className="shrink-0 bg-card border border-border/80 rounded-3xl p-5 sm:p-7 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <TerminalSquare className="w-56 h-56 text-foreground" />
        </div>
        
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="p-2 rounded-xl bg-primary/10 text-primary">
                <Activity className="w-5 h-5" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                {isAdmin ? "Activity Logs & System Audit" : "My Activity History"}
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-xl">
              {isAdmin 
                ? "Live tamper-evident company audit trail. Filter across all departments, team members, categories, and actions."
                : "Your personal activity trail and event history recorded across the platform."}
            </p>
          </div>
          
          <div className="flex flex-wrap sm:flex-nowrap gap-3 sm:gap-4">
            <div className="bg-muted/40 border border-border rounded-2xl p-3.5 sm:p-4 flex items-center gap-3.5 min-w-[140px] flex-1 shadow-xs">
              <div className="w-10 h-10 bg-background rounded-xl shadow-xs flex items-center justify-center text-primary shrink-0 border border-border/60">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Events Today</p>
                <p className="text-xl sm:text-2xl font-black text-foreground leading-none">{stats.events_today}</p>
              </div>
            </div>
            
            <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-3.5 sm:p-4 flex items-center gap-3.5 min-w-[140px] flex-1 shadow-xs">
              <div className="w-10 h-10 bg-background rounded-xl shadow-xs flex items-center justify-center text-rose-600 shrink-0 border border-destructive/20">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] sm:text-xs font-bold text-rose-600/80 uppercase tracking-wider mb-0.5">Critical Alerts</p>
                <p className="text-xl sm:text-2xl font-black text-rose-700 leading-none">{stats.critical_alerts}</p>
              </div>
            </div>

            <div className="bg-muted/40 border border-border rounded-2xl p-3.5 sm:p-4 flex items-center gap-3.5 min-w-[140px] flex-1 shadow-xs">
              <div className="w-10 h-10 bg-background rounded-xl shadow-xs flex items-center justify-center text-muted-foreground shrink-0 border border-border/60">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Total Records</p>
                <p className="text-xl sm:text-2xl font-black text-foreground leading-none">{stats.total_records || total}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0 bg-card border border-border rounded-3xl shadow-xs">
        
        {/* Row 1: Module / Category Tabs */}
        <div className="p-3 sm:p-4 border-b border-border bg-muted/20 shrink-0">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {allCategories.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveCategory(tab)}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-150 border flex items-center gap-1.5 cursor-pointer",
                  activeCategory === tab 
                    ? "bg-primary text-primary-foreground border-primary shadow-xs" 
                    : "bg-background text-muted-foreground border-border hover:border-border hover:text-foreground hover:bg-muted/50"
                )}
              >
                {tab !== "All" && getCategoryIcon(tab)}
                <span>{tab}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Comprehensive Multi-Filter Bar with Custom Sleek Dropdowns */}
        <div className="p-3 sm:p-4 border-b border-border bg-background/50 flex flex-col gap-3 shrink-0 relative z-30">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* Filter Dropdowns Grid */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Severity Dropdown */}
              <FilterDropdown
                label="All Severities"
                icon={<AlertTriangle className="w-3.5 h-3.5" />}
                value={severityFilter}
                options={severityOptions}
                onChange={setSeverityFilter}
                defaultValue="All"
              />

              {/* Department Dropdown (Admin / HR only) */}
              {isAdmin && (
                <FilterDropdown
                  label="All Departments"
                  icon={<Building2 className="w-3.5 h-3.5" />}
                  value={departmentFilter}
                  options={departmentOptions}
                  onChange={setDepartmentFilter}
                  defaultValue="All"
                />
              )}

              {/* User Dropdown (Admin / HR only - Lists ALL Employees) */}
              {isAdmin && (
                <FilterDropdown
                  label="All Users"
                  icon={<UserCheck className="w-3.5 h-3.5" />}
                  value={userFilter}
                  options={userOptions}
                  onChange={setUserFilter}
                  defaultValue="All"
                />
              )}

              {/* Action Dropdown */}
              <FilterDropdown
                label="All Actions"
                icon={<Tag className="w-3.5 h-3.5" />}
                value={actionFilter}
                options={actionOptions}
                onChange={setActionFilter}
                defaultValue="All"
              />

              {/* Date Preset Dropdown */}
              <FilterDropdown
                label="All Time"
                icon={<Calendar className="w-3.5 h-3.5" />}
                value={dateRangePreset}
                options={dateOptions}
                onChange={setDateRangePreset}
                defaultValue="all"
              />

              {/* Sort Order Dropdown */}
              <FilterDropdown
                label="Sort Order"
                icon={<ArrowUpDown className="w-3.5 h-3.5" />}
                value={sortOrder}
                options={sortOptions}
                onChange={(val) => setSortOrder(val as "desc" | "asc")}
                defaultValue="desc"
              />

              {/* Per Page Limit Dropdown */}
              <FilterDropdown
                label="Rows"
                icon={<ListFilter className="w-3.5 h-3.5" />}
                value={String(limit)}
                options={limitOptions}
                onChange={(val) => setLimit(Number(val))}
                defaultValue="25"
              />
            </div>

            {/* Actions: Search, Export, Refresh */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-60">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search action, user, IP, metadata..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 h-9 text-xs bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery("")} 
                    className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                disabled={logs.length === 0}
                className="h-9 px-3 text-xs font-bold rounded-xl gap-1.5 shadow-xs cursor-pointer"
                title="Export filtered logs as CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Export</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={fetchLogs}
                disabled={isLoading}
                className="h-9 px-3 text-xs font-bold rounded-xl gap-1.5 shadow-xs cursor-pointer"
                title="Refresh logs"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin text-primary")} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
            </div>
          </div>

          {/* Custom Date Pickers (Shown only when dateRangePreset === "custom") */}
          {dateRangePreset === "custom" && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50 animate-in fade-in slide-in-from-top-1 duration-150">
              <span className="text-xs font-bold text-muted-foreground">Custom Date:</span>
              <div className="flex items-center gap-1.5 bg-muted/40 border border-border rounded-xl px-2.5 py-1">
                <span className="text-[11px] font-bold text-muted-foreground">From:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="text-xs font-bold bg-transparent text-foreground outline-none cursor-pointer"
                />
              </div>
              <div className="flex items-center gap-1.5 bg-muted/40 border border-border rounded-xl px-2.5 py-1">
                <span className="text-[11px] font-bold text-muted-foreground">To:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="text-xs font-bold bg-transparent text-foreground outline-none cursor-pointer"
                />
              </div>
              {(customStartDate || customEndDate) && (
                <button
                  onClick={() => {
                    setCustomStartDate("");
                    setCustomEndDate("");
                  }}
                  className="text-xs text-rose-500 hover:text-rose-600 font-bold ml-1 cursor-pointer"
                >
                  Clear Date
                </button>
              )}
            </div>
          )}

          {/* Active Filter Chips Strip */}
          {isAnyFilterActive && (
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/60">
              <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1 mr-1">
                <Filter className="w-3 h-3 text-primary" /> Active Filters:
              </span>

              {activeCategory !== "All" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-primary/10 text-primary border border-primary/20">
                  Category: {activeCategory}
                  <button onClick={() => setActiveCategory("All")} className="hover:opacity-75 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {severityFilter !== "All" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                  Severity: {severityFilter}
                  <button onClick={() => setSeverityFilter("All")} className="hover:opacity-75 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {isAdmin && departmentFilter !== "All" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-primary/10 text-primary border border-primary/20">
                  Dept: {departmentFilter}
                  <button onClick={() => setDepartmentFilter("All")} className="hover:opacity-75 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {isAdmin && userFilter !== "All" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-muted text-foreground border border-border">
                  User: {userFilter}
                  <button onClick={() => setUserFilter("All")} className="hover:opacity-75 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {actionFilter !== "All" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-muted text-foreground border border-border">
                  Action: {actionFilter}
                  <button onClick={() => setActionFilter("All")} className="hover:opacity-75 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {dateRangePreset !== "all" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-muted text-foreground border border-border">
                  Date: {calculatedDateRange.label}
                  <button onClick={() => setDateRangePreset("all")} className="hover:opacity-75 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {searchQuery.trim() && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-muted text-foreground border border-border">
                  Search: "{searchQuery.trim()}"
                  <button onClick={() => setSearchQuery("")} className="hover:opacity-75 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              <button
                onClick={handleClearAllFilters}
                className="text-[11px] font-bold text-rose-500 hover:text-rose-600 underline ml-2 cursor-pointer"
              >
                Clear All
              </button>

              <span className="text-[11px] font-semibold text-muted-foreground ml-auto">
                Showing {total} {total === 1 ? "record" : "records"}
              </span>
            </div>
          )}
        </div>

        {/* Timeline Logs List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-muted/5 relative z-10">
          <div className="max-w-4xl mx-auto">
            {isLoading && logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <RefreshCw className="w-8 h-8 animate-spin text-primary mb-3" />
                <p className="text-sm font-semibold text-muted-foreground">Loading activity audit logs...</p>
              </div>
            ) : logs.length > 0 ? (
              <div className="relative border-l border-border/80 ml-4 space-y-6 pb-6">
                {logs.map((log) => {
                  const logId = log.id || log._id || Math.random().toString();
                  const sev = (log.severity || "Info").toLowerCase();
                  const isCrit = sev === "critical";
                  const isWarn = sev === "warning";
                  const userName = log.performed_by_name || log.user_name || "Team Member";
                  const userRole = log.performed_by_role || "Member";
                  const userDept = log.performed_by_department;
                  const userAvatar = getAvatarUrl(log.performed_by_avatar || "", userName);

                  return (
                    <div key={logId} className="relative pl-7 sm:pl-10 group">
                      {/* Timeline Node Icon */}
                      <div className={cn(
                        "absolute -left-[1.05rem] top-1.5 w-7 h-7 rounded-full border-2 border-card flex items-center justify-center shadow-xs transition-transform group-hover:scale-110",
                        isCrit ? "bg-rose-600 text-white" :
                        isWarn ? "bg-amber-500 text-white" :
                        "bg-primary text-primary-foreground"
                      )}>
                        {isCrit ? <ShieldAlert className="w-3.5 h-3.5" /> :
                         isWarn ? <AlertTriangle className="w-3.5 h-3.5" /> :
                         getCategoryIcon(log.category || "Work")}
                      </div>

                      {/* Content Card */}
                      <div className={cn(
                        "bg-card rounded-2xl p-4 sm:p-5 shadow-xs border transition-all duration-200 group-hover:shadow-sm",
                        isCrit ? "border-rose-300 dark:border-rose-900/60 bg-rose-50/20 dark:bg-rose-950/20" : 
                        isWarn ? "border-amber-300 dark:border-amber-900/60 bg-amber-50/20 dark:bg-amber-950/20" : 
                        "border-border/80 hover:border-border"
                      )}>
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-2.5">
                          <div className="flex items-center gap-3">
                            <img 
                              src={userAvatar} 
                              alt={userName}
                              onError={handleAvatarError}
                              className="w-10 h-10 rounded-full border border-border object-cover bg-muted shrink-0"
                            />
                            <div>
                              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                <span className="font-bold text-foreground text-xs sm:text-sm leading-tight">
                                  {userName}
                                </span>
                                {userDept && (
                                  <Badge variant="outline" className="text-[10px] font-bold px-1.5 py-0 bg-primary/5 text-primary border-primary/20">
                                    {userDept}
                                  </Badge>
                                )}
                                <Badge variant="secondary" className="text-[10px] font-semibold px-1.5 py-0 bg-muted/60 text-muted-foreground border-border">
                                  {userRole}
                                </Badge>
                              </div>
                              <p className="text-xs sm:text-[13px] font-bold text-foreground/90">
                                {log.action}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-1 shrink-0">
                            <span className="text-[11px] font-semibold text-muted-foreground">
                              {formatTimestamp(log.timestamp || log.created_at)}
                            </span>
                            {log.ip && (
                              <span className="text-[9.5px] font-mono font-bold text-muted-foreground/70 bg-muted/40 px-2 py-0.5 rounded-md border border-border/40">
                                IP: {log.ip}
                              </span>
                            )}
                          </div>
                        </div>

                        {log.description && log.description !== log.action && (
                          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                            {log.description}
                          </p>
                        )}

                        {log.metadata && (
                          <div className={cn(
                            "mt-3 text-xs p-2.5 rounded-xl border font-mono break-all",
                            isCrit ? "bg-rose-100/40 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300" :
                            isWarn ? "bg-amber-100/40 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-300" :
                            "bg-muted/40 border-border/60 text-muted-foreground"
                          )}>
                            {log.metadata}
                          </div>
                        )}
                        
                        <div className="mt-3.5 flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1.5 bg-muted text-foreground border border-border">
                            {getCategoryIcon(log.category || "Work")}
                            <span>{log.category || "Work"}</span>
                          </span>

                          <span className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider",
                            isCrit ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300" :
                            isWarn ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300" :
                            "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200"
                          )}>
                            {log.severity || "Info"}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 bg-muted/40 rounded-3xl flex items-center justify-center mb-3 border border-border text-muted-foreground">
                  <TerminalSquare className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-foreground mb-1">No Activity Logs Found</h3>
                <p className="text-muted-foreground text-xs max-w-sm mb-4">
                  {isAnyFilterActive
                    ? "No activity logs match your current filter selection. Try resetting some filters or search query."
                    : "Activity logs will automatically appear here as team members log in, complete tasks, or modify records."}
                </p>
                {isAnyFilterActive && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearAllFilters}
                    className="text-xs font-bold rounded-xl gap-1.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    Reset All Filters
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Pagination & Records Summary */}
        {total > 0 && (
          <div className="p-3 sm:p-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 bg-muted/10 shrink-0">
            <p className="text-xs text-muted-foreground font-medium">
              Showing <strong className="text-foreground">{(page - 1) * limit + 1}</strong> to{" "}
              <strong className="text-foreground">{Math.min(page * limit, total)}</strong> of{" "}
              <strong className="text-foreground">{total}</strong> total activities
            </p>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="h-8 px-2.5 text-xs font-bold rounded-lg cursor-pointer"
                >
                  Previous
                </Button>
                <span className="text-xs font-bold text-muted-foreground px-2">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="h-8 px-2.5 text-xs font-bold rounded-lg cursor-pointer"
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
