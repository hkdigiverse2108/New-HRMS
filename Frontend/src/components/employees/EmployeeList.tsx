import { useState, useMemo, useEffect } from "react";
import { Search, X, Filter, LayoutGrid, List, MoreVertical, Phone, Mail, Plus, MapPin, Edit2, Trash2, Key, UserMinus, UserCheck, Shield, FileText, LogOut, Clock, Columns, Eye, EyeOff, Users, Zap, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { EMPLOYEES, Employee } from "./employee-data";
import { useDepartments } from "./DepartmentContext";
import { EmployeeProfileModal } from "./EmployeeProfileModal";
import { EmployeeFormModal } from "./EmployeeFormModal";
import { EmployeePermissionsModal } from "./EmployeePermissionsModal";
import { toast } from "@/lib/toast";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { cn, formatDate } from "@/lib/utils";
import { useEmployeesContext } from "./EmployeeContext";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableHeader } from "@/components/ui/sortable-header";
import { getAvatarUrl } from "@/lib/config";
import { handleAvatarError } from "@/lib/config";
import { useModulePermissions } from "@/hooks/useModulePermissions";
import { useAuth } from "@/components/auth/AuthContext";

const COLUMN_OPTIONS = [
  { key: "employee", label: "Employee", default: true },
  { key: "department", label: "Department", default: true },
  { key: "status", label: "Status", default: true },
  { key: "contact", label: "Contact", default: true },
  { key: "joined", label: "Joined", default: true },
  { key: "firstName", label: "First Name", default: false },
  { key: "middleName", label: "Middle Name", default: false },
  { key: "lastName", label: "Last Name", default: false },
  { key: "email", label: "Email Address", default: false },
  { key: "phone", label: "Phone Number", default: false },
  { key: "password", label: "Password", default: false },
  { key: "dob", label: "Date of Birth", default: false },
  { key: "salary", label: "Salary", default: false },
  { key: "gender", label: "Gender", default: false },
  { key: "role", label: "Role", default: false },
  { key: "upiId", label: "UPI ID", default: false },
  { key: "accountNumber", label: "Account Number", default: false },
  { key: "ifscCode", label: "IFSC Code", default: false },
  { key: "bankName", label: "Bank Name", default: false },
  { key: "accountHolderName", label: "Account Holder Name", default: false },
  { key: "parentName", label: "Parent/Guardian Name", default: false },
  { key: "parentNumber", label: "Parent/Guardian Number", default: false },
  { key: "relation", label: "Relation", default: false },
  { key: "employeeId", label: "Employee ID", default: true },
  { key: "aadharCard", label: "Aadhar Card", default: false },
  { key: "panCard", label: "PAN Card", default: false },
  { key: "designation", label: "Designation", default: false },
  { key: "workMode", label: "Work Mode", default: false },
  { key: "startTime", label: "Start Time", default: false },
  { key: "endTime", label: "End Time", default: false },
  { key: "position", label: "Position", default: false },
  { key: "hasBond", label: "Has Bond", default: false },
  { key: "bondStartDate", label: "Bond Start Date", default: false },
  { key: "bondEndDate", label: "Bond End Date", default: false },
  { key: "hasNoticePeriod", label: "Has Notice Period", default: false },
  { key: "noticePeriodDays", label: "Notice Period Days", default: false },
  { key: "noticePeriodStartDate", label: "Notice Period Start Date", default: false },
  { key: "hasResignation", label: "Has Resignation", default: false },
  { key: "resignationDate", label: "Resignation Date", default: false },
  { key: "hasEmployment", label: "Has Employment Agreement", default: false },
  { key: "employmentStartDate", label: "Employment Start Date", default: false },
  { key: "actions", label: "Actions", default: true }
];

export function EmployeeList({ isNew }: { isNew?: boolean }) {
  const { employees, addEmployee, updateEmployee, deleteEmployee, fetchEmployeeById } = useEmployeesContext();
const { user } = useAuth();

// Self row mate password merge (non-privileged viewer potanu j joi shake).
const [selfPassword, setSelfPassword] = useState("");
// Card-level hide/show toggle (default masked).
const [revealedPwIds, setRevealedPwIds] = useState<string[]>([]);
const togglePw = (id: string) => {
  setRevealedPwIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
};
const selfId = useMemo(() => {
  if (!user) return "";
  const byId = employees.find(e => e.id === user.id);
  if (byId) return byId.id;
  const byEmail = employees.find(e => e.email?.toLowerCase() === user.email?.toLowerCase());
  return byEmail ? byEmail.id : "";
}, [employees, user]);

useEffect(() => {
  let alive = true;
  (async () => {
    if (!selfId) { setSelfPassword(""); return; }
    const full = await fetchEmployeeById(selfId);
    if (alive) setSelfPassword(full?.password || "");
  })();
  return () => { alive = false; };
}, [selfId, fetchEmployeeById]);
  const { departments } = useDepartments();
  const { canCreate, canUpdate, canDelete, isAdmin } = useModulePermissions("/employees/list");
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(isNew || false);
  const [selectedDept, setSelectedDept] = useState<string>("All");
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [permissionEmployee, setPermissionEmployee] = useState<Employee | null>(null);

  const userRole = String((user as any)?.role || (user as any)?.work_details?.system_role || "").toLowerCase();
  const canSummon = isAdmin || ["admin", "superadmin", "hr", "manager", "team lead", "lead"].some(r => userRole.includes(r));
  const [summonTarget, setSummonTarget] = useState<Employee | null>(null);
  const [summonLocation, setSummonLocation] = useState("Conference Room A");
  const [summonReason, setSummonReason] = useState("Urgent meeting required immediately");
  const [isSummoning, setIsSummoning] = useState(false);

  const handleSendSummon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!summonTarget) return;
    try {
      setIsSummoning(true);
      await api.post(`/employees/${summonTarget.id}/summon`, {
        room_location: summonLocation,
        reason: summonReason,
      });
      toast.success(`⚡ Urgent summon alert sent to ${summonTarget.name}!`);
      setSummonTarget(null);
    } catch (err: any) {
      toast.error(err?.message || "Failed to send summon alert");
    } finally {
      setIsSummoning(false);
    }
  };
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    COLUMN_OPTIONS.forEach(col => {
      initial[col.key] = col.default;
    });
    return initial;
  });

  // Dynamically compute all unique departments from DB/context and existing employees
  const allDepartments = useMemo(() => {
    const list: string[] = [];
    const set = new Set<string>();

    departments.forEach(dept => {
      const trimmed = dept?.trim();
      if (trimmed && !set.has(trimmed.toLowerCase())) {
        set.add(trimmed.toLowerCase());
        list.push(trimmed);
      }
    });

    // Also include any department from employee data not yet in the list
    employees.forEach(emp => {
      const dept = emp.department?.trim();
      if (dept && !set.has(dept.toLowerCase())) {
        set.add(dept.toLowerCase());
        list.push(dept);
      }
    });

    return list;
  }, [departments, employees]);

  // Default selection is "All", validate if department disappears
  useEffect(() => {
    setSelectedDept((prev: string): string => {
      if (!prev || prev === "All") return "All";
      const exists = allDepartments.some(d => d.toLowerCase() === prev.toLowerCase());
      return exists ? prev : "All";
    });
  }, [allDepartments]);

  const renderCell = (emp: Employee, colKey: string) => {
    switch (colKey) {
      case "employee":
        return (
          <div className="flex items-center gap-3">
            <img src={getAvatarUrl(emp.avatar || emp.profile_photo, emp.name)} alt={emp.name} className="w-10 h-10 rounded-full object-cover" onError={handleAvatarError} />
            <div>
              <p className="text-[14px] font-bold text-foreground">{emp.name}</p>
              <p className="text-[12px] text-muted-foreground">{emp.role}</p>
            </div>
          </div>
        );
      case "department":
        return (
          <span className="px-3 py-1 bg-muted text-foreground/80 text-[10px] font-bold rounded-lg">
            {emp.department}
          </span>
        );
      case "status":
        return (
          <div className="flex items-center gap-2">
            <span className={cn("w-2 h-2 rounded-full", getStatusColor(emp.status))} />
            <span className="text-[13px] font-medium text-foreground/80">{emp.status}</span>
          </div>
        );
      case "contact":
        return (
          <div className="flex flex-col gap-1 text-[12px] text-muted-foreground">
            <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {emp.email}</span>
            <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {emp.phone}</span>
          </div>
        );
      case "joined":
        return <span className="text-[13px] font-medium text-foreground/80">{formatDate(emp.joinDate)}</span>;
      case "actions":
        return (
          <div className="relative flex justify-end items-center h-8 w-full min-w-[140px]">
            <div className="absolute right-0 flex items-center justify-center w-8 h-8 text-muted-foreground/40 group-hover:opacity-0 transition-opacity duration-300">
              <MoreVertical className="w-4 h-4" />
            </div>
            <div className="flex gap-1 opacity-0 translate-x-4 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300 bg-white shadow-sm border border-border/50 rounded-lg p-1 relative z-10">
              <button 
                onClick={() => setSelectedEmployee(emp)}
                className="p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary rounded-md transition-all active:scale-95"
                title="View Profile"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
              {canUpdate && (
                <button 
                  onClick={() => openEditForm(emp)}
                  className="p-1.5 text-muted-foreground hover:bg-blue-50 hover:text-blue-600 rounded-md transition-all active:scale-95"
                  title="Edit Employee"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}
              {canSummon && (
                <button 
                  onClick={() => {
                    setSummonTarget(emp);
                    setSummonLocation("Conference Room A");
                    setSummonReason("Urgent meeting required immediately");
                  }}
                  className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-md transition-all active:scale-95"
                  title="⚡ Urgent Meeting Summon"
                >
                  <Zap className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                </button>
              )}
              {isAdmin && (
                <button 
                  onClick={() => setPermissionEmployee(emp)}
                  className="p-1.5 text-muted-foreground hover:bg-indigo-50 hover:text-indigo-600 rounded-md transition-all active:scale-95"
                  title="Manage Permissions"
                >
                  <Shield className="w-3.5 h-3.5" />
                </button>
              )}
              {canUpdate && (
                <button 
                  onClick={() => {
                    const newStatus = emp.status === 'Inactive' ? 'Active' : 'Inactive';
                    updateEmployee(emp.id, { status: newStatus as any });
                    toast.success(`${emp.name} is now ${newStatus}`);
                  }}
                  className={cn(
                    "p-1.5 rounded-md transition-all active:scale-95",
                    emp.status === 'Inactive' ? "text-amber-500 hover:bg-amber-50" : "text-muted-foreground hover:text-amber-600 hover:bg-amber-50"
                  )}
                  title={emp.status === 'Inactive' ? "Reactivate Employee" : "Deactivate Employee"}
                >
                  {emp.status === 'Inactive' ? <UserCheck className="w-3.5 h-3.5" /> : <UserMinus className="w-3.5 h-3.5" />}
                </button>
              )}
              {canDelete && (
                <button 
                  onClick={() => handleDeleteEmployee(emp.id, emp.name)}
                  className="p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600 rounded-md transition-all active:scale-95"
                  title="Delete Employee"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        );
      case "password": {
        const pw = emp.password || (emp.id === selfId ? selfPassword : "");
        const revealed = revealedPwIds.includes(emp.id);
        if (!pw) return <span className="text-[13px] text-foreground/80">••••••</span>;
        return (
          <span className="flex items-center gap-1.5 text-[13px] text-foreground/80">
            <span>{revealed ? pw : "••••••"}</span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); togglePw(emp.id); }}
              className="p-0.5 rounded text-muted-foreground hover:text-primary transition-colors"
              title={revealed ? "Hide password" : "Show password"}
            >
              {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </span>
        );
      }
      case "employeeId": {
        const empCode = emp.employeeId || (emp.id && emp.id.startsWith("EMP-") ? emp.id : "");
        return empCode ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold font-mono bg-blue-50 text-blue-700 border border-blue-200">
            {empCode}
          </span>
        ) : <span className="text-[13px] text-foreground/80">-</span>;
      }
      case "hasBond":
      case "hasNoticePeriod":
      case "hasResignation":
      case "hasEmployment":
        return <span className="text-[13px] text-foreground/80">{emp[colKey as keyof Employee] ? "Yes" : "No"}</span>;
      default:
        return <span className="text-[13px] text-foreground/80">{emp[colKey as keyof Employee] || "-"}</span>;
    }
  };

  // Form modal state
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, id: string | null, name: string}>({isOpen: false, id: null, name: ""});

  const filteredEmployees = employees.filter(emp => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query || 
      emp.name.toLowerCase().includes(query) || 
      emp.role.toLowerCase().includes(query) ||
      (emp.email && emp.email.toLowerCase().includes(query)) ||
      (emp.employeeId && emp.employeeId.toLowerCase().includes(query)) ||
      emp.id.toLowerCase().includes(query);

    const matchesDept = selectedDept && selectedDept !== "All"
      ? (emp.department || "").trim().toLowerCase() === selectedDept.trim().toLowerCase()
      : true;

    return matchesSearch && matchesDept;
  });

  const { items: sortedEmployees, requestSort, sortConfig } = useSortableData(filteredEmployees, { key: "joined", direction: "descending" });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-emerald-500';
      case 'On Leave': return 'bg-amber-500';
      case 'Remote': return 'bg-blue-500';
      default: return 'bg-muted/500';
    }
  };

  const handleFormSubmit = async (formData: Partial<Employee>): Promise<boolean> => {
    try {
      if (editingEmployee) {
        await updateEmployee(editingEmployee.id, formData);
      } else {
        await addEmployee(formData);
      }
      setIsFormOpen(false);
      setEditingEmployee(null);
      return true;
    } catch (err: any) {
      // Backend error is automatically toasted by api client
      return false;
    }
  };

  const handleDeleteEmployee = (id: string, name: string) => {
    if (!canDelete) {
      toast.error("You do not have permission to delete employees.");
      return;
    }
    setDeleteConfirm({ isOpen: true, id, name });
  };

  const confirmDelete = async () => {
    if (deleteConfirm.id) {
      try {
        await deleteEmployee(deleteConfirm.id);
      } catch {
        // api client already toasted the error; keep the row (no local removal).
      }
    }
    setDeleteConfirm({ isOpen: false, id: null, name: "" });
  };

  const openAddForm = () => {
    if (!canCreate) {
      toast.error("You do not have permission to add employees.");
      return;
    }
    setEditingEmployee(null);
    setIsFormOpen(true);
  };

  const openEditForm = async (emp: Employee) => {
    if (!canUpdate) {
      toast.error("You do not have permission to edit employees.");
      return;
    }
    // Self-edit: fetch single record so own password prefills (backend returns
    // password ONLY for self — others, even Admin, get none).
    let data = emp;
    try {
      if (selfId && emp.id === selfId) {
        const full = await fetchEmployeeById(emp.id);
        if (full?.password) data = { ...emp, password: full.password };
      }
    } catch {
      /* fall back to list version */
    }
    setEditingEmployee(data);
    setIsFormOpen(true);
  };

  return (
    <div className="w-full animate-in fade-in zoom-in-95 duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-[28px] font-black text-foreground tracking-tight mb-2">Employee Directory</h1>
          <p className="text-[14px] text-muted-foreground">Manage your team members and their account permissions here.</p>
        </div>
        {canCreate && (
          <button 
            onClick={openAddForm}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm shadow-primary/20 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Add Employee
          </button>
        )}
      </div>

      {/* Filters Bar */}
      <div className="bg-white border border-border/60 rounded-2xl p-4 shadow-sm flex flex-col lg:flex-row gap-4 justify-between items-stretch lg:items-center mb-8">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center flex-1 gap-3 sm:gap-4 min-w-0">
          <div className="relative w-full lg:w-72 min-w-[220px] flex-shrink-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input 
              type="text" 
              placeholder="Search by name or role..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full min-w-0 pl-10 pr-9 py-2.5 bg-muted/50 border border-border/50 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all font-medium text-foreground placeholder:text-muted-foreground"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          
          {/* Dynamic Department Tabs with 'All' First */}
          <div className="flex items-center gap-2 overflow-x-auto min-w-0 flex-1 max-w-full pb-1 lg:pb-0 scrollbar-none">
            {/* All Filter Option - FIRST */}
            <button 
              type="button"
              onClick={() => setSelectedDept("All")}
              className={cn(
                "px-3.5 py-2 rounded-xl text-[12px] font-bold transition-all border whitespace-nowrap flex items-center gap-1.5 flex-shrink-0 active:scale-95 shadow-sm",
                selectedDept === "All"
                  ? "bg-primary text-primary-foreground border-primary shadow-primary/20" 
                  : "bg-white text-foreground/80 border-border/80 hover:bg-muted/50"
              )}
            >
              <span>All</span>
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                selectedDept === "All" ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
              )}>
                {employees.length}
              </span>
            </button>

            {/* Department Options */}
            {allDepartments.map(dept => {
              const isSelected = selectedDept?.toLowerCase() === dept.toLowerCase();
              const count = employees.filter(e => (e.department || "").trim().toLowerCase() === dept.toLowerCase()).length;
              return (
                <button 
                  type="button"
                  key={dept}
                  onClick={() => setSelectedDept(dept)}
                  className={cn(
                    "px-3.5 py-2 rounded-xl text-[12px] font-bold transition-all border whitespace-nowrap flex items-center gap-1.5 flex-shrink-0 active:scale-95 shadow-sm",
                    isSelected 
                      ? "bg-primary text-primary-foreground border-primary shadow-primary/20" 
                      : "bg-white text-foreground/80 border-border/80 hover:bg-muted/50"
                  )}
                >
                  <span>{dept}</span>
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                    isSelected ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 self-end lg:self-auto">
          {viewMode === 'list' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 bg-white border border-border/80 px-3 py-2 rounded-xl text-foreground/80 text-[13px] font-semibold hover:bg-muted/50 transition-colors shadow-sm">
                  <Columns className="w-4 h-4" />
                  Columns
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[200px] max-h-[300px] overflow-y-auto rounded-xl p-2">
                <DropdownMenuLabel className="text-xs">Toggle Columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {COLUMN_OPTIONS.map((col) => (
                  <DropdownMenuCheckboxItem 
                    key={col.key}
                    checked={!!visibleColumns[col.key]} 
                    onCheckedChange={(c) => setVisibleColumns(prev => ({...prev, [col.key]: !!c}))}
                  >
                    {col.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <div className="flex items-center gap-1 bg-muted p-1 rounded-xl">
            <button 
              onClick={() => setViewMode('grid')}
              className={cn(
                "p-2 rounded-lg transition-all",
                viewMode === 'grid' ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={cn(
                "p-2 rounded-lg transition-all",
                viewMode === 'list' ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Grid View */}
      {viewMode === 'grid' && (
        sortedEmployees.length === 0 ? (
          <div className="bg-white border border-border/60 rounded-3xl p-12 text-center flex flex-col items-center justify-center my-6 shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center text-muted-foreground mb-4">
              <Users className="w-8 h-8 opacity-60" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-1">No employees found</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-4">
              {selectedDept && selectedDept !== "All"
                ? `There are currently no team members in the "${selectedDept}" department.`
                : "No employees match your search criteria."}
            </p>
            {selectedDept && selectedDept !== "All" && (
              <button 
                onClick={() => setSelectedDept("All")}
                className="text-xs font-bold text-primary hover:underline"
              >
                View all employees ({employees.length})
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {sortedEmployees.map((emp) => (
            <div key={emp.id} className="group bg-white border border-border/50 rounded-3xl p-5 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 relative flex flex-col justify-between">
              {/* Card Top Header: Action buttons cleanly right-aligned, no left-corner badge */}
              <div className="flex items-center justify-end w-full min-h-[28px] mb-2">
                <div className="flex items-center gap-0.5 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                  {canUpdate && (
                    <button 
                      onClick={() => openEditForm(emp)}
                      className="p-1.5 text-muted-foreground hover:bg-slate-100 hover:text-foreground rounded-full transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {canUpdate && (
                    <button
                      onClick={() => {
                        const newStatus = emp.status === 'Inactive' ? 'Active' : 'Inactive';
                        updateEmployee(emp.id, { status: newStatus });
                        toast.success(`${emp.name} is now ${newStatus}`);
                      }}
                      className={cn(
                        "p-1.5 rounded-full transition-colors",
                        emp.status === 'Inactive' ? "text-amber-500 hover:bg-amber-50" : "text-muted-foreground hover:bg-amber-50 hover:text-amber-600"
                      )}
                      title={emp.status === 'Inactive' ? "Mark as Active" : "Mark as Inactive"}
                    >
                      {emp.status === 'Inactive' ? <UserCheck className="w-3.5 h-3.5" /> : <UserMinus className="w-3.5 h-3.5" />}
                    </button>
                  )}
                  {canSummon && (
                    <button
                      onClick={() => {
                        setSummonTarget(emp);
                        setSummonLocation("Conference Room A");
                        setSummonReason("Urgent meeting required immediately");
                      }}
                      className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-full transition-colors"
                      title="⚡ Urgent Meeting Summon"
                    >
                      <Zap className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => setPermissionEmployee(emp)}
                      className="p-1.5 text-muted-foreground hover:bg-blue-50 hover:text-blue-600 rounded-full transition-colors"
                      title="Manage Permissions"
                    >
                      <Shield className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {canDelete && (
                    <button 
                      onClick={() => handleDeleteEmployee(emp.id, emp.name)}
                      className="p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600 rounded-full transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col items-center text-center">
                <div className="relative mb-4">
                  <img src={getAvatarUrl(emp.avatar || emp.profile_photo, emp.name)} alt={emp.name} className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-md" onError={handleAvatarError} />
                  <span className={cn(
                    "absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-white",
                    getStatusColor(emp.status)
                  )}>
                    {emp.status === 'Active' && <span className="absolute inset-0 rounded-full animate-ping bg-emerald-400 opacity-75"></span>}
                  </span>
                </div>
                
                <h3 className="text-[16px] font-black text-foreground mb-1">{emp.name}</h3>
                <p className="text-[12px] font-medium text-muted-foreground mb-4">{emp.role}</p>
                
                <div className="flex items-center gap-1.5 flex-wrap justify-center mb-4">
                  {emp.role !== 'Admin' && (emp.employeeId || (emp.id && emp.id.startsWith("EMP-") ? emp.id : "")) && (
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold font-mono rounded-lg">
                      {emp.employeeId || emp.id}
                    </span>
                  )}
                  <span className="px-3 py-0.5 bg-muted/50 text-foreground/80 text-[10px] font-bold uppercase tracking-wider rounded-lg">
                    {emp.department}
                  </span>
                </div>

                {(emp.hasBond || emp.hasResignation || emp.hasNoticePeriod) && (
                  <div className="w-full flex flex-col gap-1.5 mb-4 px-2">
                    {emp.hasBond && (
                      <div className="flex items-center gap-2 text-[11px] font-medium text-amber-600 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-100">
                        <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">Bond: {emp.bondEndDate ? `Until ${formatDate(emp.bondEndDate)}` : 'Active'}</span>
                      </div>
                    )}
                    {emp.hasResignation && (
                      <div className="flex items-center gap-2 text-[11px] font-medium text-rose-600 bg-rose-50 px-2.5 py-1.5 rounded-lg border border-rose-100">
                        <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">Exiting: {emp.resignationDate ? formatDate(emp.resignationDate) : 'Pending'}</span>
                      </div>
                    )}
                    {emp.hasNoticePeriod && !emp.hasResignation && (
                      <div className="flex items-center gap-2 text-[11px] font-medium text-blue-600 bg-blue-50 px-2.5 py-1.5 rounded-lg border border-blue-100">
                        <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">Notice Period: {emp.noticePeriodDays || '30'} Days</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="w-full flex flex-col gap-2 mb-6 text-[12px] text-muted-foreground bg-muted/20 p-3 rounded-2xl border border-border/50">
                  <div className="flex items-center justify-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-primary/70" />
                    <span className="truncate">{emp.email || "No email"}</span>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-primary/70" />
                    <span>{emp.phone || "No phone"}</span>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <Key className="w-3.5 h-3.5 text-primary/70" />
                    {(() => {
                      const pw = emp.password || (emp.id === selfId ? selfPassword : "");
                      const revealed = revealedPwIds.includes(emp.id);
                      if (!pw) return <span className="truncate">••••••</span>;
                      return (
                        <span className="flex items-center gap-1.5 min-w-0">
                          <span className="truncate">{revealed ? pw : "••••••"}</span>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); togglePw(emp.id); }}
                            className="p-0.5 rounded text-muted-foreground hover:text-primary transition-colors shrink-0"
                            title={revealed ? "Hide password" : "Show password"}
                          >
                            {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </span>
                      );
                    })()}
                  </div>
                </div>

                <button 
                  onClick={() => setSelectedEmployee(emp)}
                  className="w-full bg-primary/10 text-primary hover:bg-primary/20 py-2.5 rounded-xl text-[12px] font-bold transition-colors"
                >
                  View Profile
                </button>
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="bg-white border border-border/60 rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/50/50 border-b border-border/50">
                  {COLUMN_OPTIONS.map(col => visibleColumns[col.key] && (
                    col.key === 'actions' ? (
                      <th key={col.key} className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right w-[1%] whitespace-nowrap">
                        {col.label}
                      </th>
                    ) : (
                      <SortableHeader
                        key={col.key}
                        label={col.label}
                        sortKey={
                          col.key === 'employee' ? 'name' : 
                          col.key === 'contact' ? 'email' : 
                          col.key === 'joined' ? 'joinDate' : 
                          col.key
                        }
                        currentSort={sortConfig}
                        onSort={requestSort}
                        className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider"
                      />
                    )
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMN_OPTIONS.filter(c => visibleColumns[c.key]).length} className="px-6 py-12 text-center text-muted-foreground text-sm">
                      {selectedDept && selectedDept !== "All"
                        ? `No employees found in the "${selectedDept}" department.`
                        : "No employees match your search criteria."}
                    </td>
                  </tr>
                ) : (
                  sortedEmployees.map((emp) => (
                    <tr key={emp.id} className="border-b border-slate-50 hover:bg-muted/50/50 transition-colors group">
                      {COLUMN_OPTIONS.map(col => visibleColumns[col.key] && (
                        <td key={col.key} className={cn("px-6 py-4", col.key === 'actions' ? 'text-right w-[1%] whitespace-nowrap' : '')}>
                          {renderCell(emp, col.key)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {selectedEmployee && (
        <EmployeeProfileModal 
          employee={selectedEmployee} 
          onClose={() => setSelectedEmployee(null)} 
        />
      )}

      {/* Add / Edit Form Modal */}
      <EmployeeFormModal 
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleFormSubmit}
        initialData={editingEmployee}
      />

      <ConfirmModal 
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, id: null, name: "" })}
        onConfirm={confirmDelete}
        title="Remove Employee"
        description={`Are you sure you want to completely delete ${deleteConfirm.name} from the company records? This action cannot be undone.`}
        itemName={deleteConfirm.name}
      />

      {/* Permissions Management Modal */}
      {permissionEmployee && (
        <EmployeePermissionsModal 
          employee={permissionEmployee}
          isOpen={Boolean(permissionEmployee)}
          onClose={() => setPermissionEmployee(null)}
        />
      )}

      {/* Urgent Meeting Summon Modal */}
      {summonTarget && (
        <Dialog open={Boolean(summonTarget)} onOpenChange={(v) => { if (!v) setSummonTarget(null); }}>
          <DialogContent className="sm:max-w-[460px] p-0 overflow-hidden rounded-[2rem] gap-0 border-amber-500/30 shadow-2xl [&>button]:hidden bg-card">
            <div className="flex items-center justify-between px-6 py-5 border-b border-border/50 bg-amber-500/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 flex items-center justify-center font-bold">
                  <Zap className="w-5 h-5 fill-amber-500 text-amber-500" />
                </div>
                <div>
                  <h2 className="text-base font-black tracking-tight text-foreground">Urgent Meeting Summon</h2>
                  <p className="text-xs text-muted-foreground">Send high-priority audio alert to employee screen</p>
                </div>
              </div>
              <DialogClose asChild>
                <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </DialogClose>
            </div>

            <form onSubmit={handleSendSummon} className="p-6 space-y-4">
              <div className="p-3.5 bg-muted/40 rounded-2xl border border-border/40 flex items-center gap-3">
                <img
                  src={getAvatarUrl(summonTarget.avatar || summonTarget.profile_photo, summonTarget.name)}
                  alt={summonTarget.name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-white shadow"
                  onError={handleAvatarError}
                />
                <div>
                  <p className="text-sm font-black text-foreground">{summonTarget.name}</p>
                  <p className="text-xs text-muted-foreground font-medium">{summonTarget.role} • {summonTarget.department}</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Location / Room <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={summonLocation}
                  onChange={(e) => setSummonLocation(e.target.value)}
                  placeholder="e.g. Conference Room A / Cabin 2 / Online Meet"
                  className="w-full px-3.5 py-2.5 bg-muted/50 border border-border/60 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Reason / Notes <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={summonReason}
                  onChange={(e) => setSummonReason(e.target.value)}
                  placeholder="e.g. Critical client escalations review. Come immediately."
                  className="w-full px-3.5 py-2.5 bg-muted/50 border border-border/60 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/30 resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setSummonTarget(null)}
                  className="px-4 py-2 text-sm font-bold text-muted-foreground hover:bg-muted rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSummoning}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-black rounded-xl transition-all shadow-md shadow-amber-500/20 flex items-center gap-2 disabled:opacity-50"
                >
                  <Zap className="w-4 h-4 fill-white" />
                  {isSummoning ? "Broadcasting Alert..." : "Send Urgent Summon"}
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
