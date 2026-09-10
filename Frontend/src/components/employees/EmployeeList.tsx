import { useState } from "react";
import { Search, Filter, LayoutGrid, List, MoreVertical, Phone, Mail, Plus, MapPin, Edit2, Trash2, Key, UserMinus, UserCheck, Shield, FileText, LogOut, Clock, Columns, Eye } from "lucide-react";
import { EMPLOYEES, Employee } from "./employee-data";
import { useDepartments } from "./DepartmentContext";
import { EmployeeProfileModal } from "./EmployeeProfileModal";
import { EmployeeFormModal } from "./EmployeeFormModal";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { cn, formatDate } from "@/lib/utils";
import { useEmployeesContext } from "./EmployeeContext";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableHeader } from "@/components/ui/sortable-header";

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
  { key: "employeeId", label: "Employee ID", default: false },
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
  const { employees, addEmployee, updateEmployee, deleteEmployee } = useEmployeesContext();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(isNew || false);
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    COLUMN_OPTIONS.forEach(col => {
      initial[col.key] = col.default;
    });
    return initial;
  });


  const renderCell = (emp: Employee, colKey: string) => {
    switch (colKey) {
      case "employee":
        return (
          <div className="flex items-center gap-3">
            <img src={emp.avatar} alt={emp.name} className="w-10 h-10 rounded-full object-cover" />
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
              <button 
                onClick={() => openEditForm(emp)}
                className="p-1.5 text-muted-foreground hover:bg-blue-50 hover:text-blue-600 rounded-md transition-all active:scale-95"
                title="Edit Employee"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => toast.success("Permissions management coming soon!")}
                className="p-1.5 text-muted-foreground hover:bg-indigo-50 hover:text-indigo-600 rounded-md transition-all active:scale-95"
                title="Manage Permissions"
              >
                <Shield className="w-3.5 h-3.5" />
              </button>
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
            </div>
          </div>
        );
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
  // The form state is now declared at the top as isFormOpen
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, id: string | null, name: string}>({isOpen: false, id: null, name: ""});

  const { departments } = useDepartments();

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          emp.role.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = selectedDept ? emp.department === selectedDept : true;
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

  const handleFormSubmit = (formData: Partial<Employee>) => {
    if (editingEmployee) {
      updateEmployee(editingEmployee.id, formData);
      toast.success("Employee updated successfully.");
    } else {
      const newEmployee: Employee = {
        ...(formData as Employee),
        id: `EMP-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
        avatar: `https://i.pravatar.cc/150?u=${formData.name?.split(' ')[0]?.toLowerCase() || 'new'}`,
        performanceScore: 85, // default
      };
      addEmployee(newEmployee);
      toast.success("New employee added.");
    }
    setIsFormOpen(false);
    setEditingEmployee(null);
  };

  const handleDeleteEmployee = (id: string, name: string) => {
    setDeleteConfirm({ isOpen: true, id, name });
  };

  const confirmDelete = () => {
    if (deleteConfirm.id) {
      deleteEmployee(deleteConfirm.id);
      toast.success(`${deleteConfirm.name} removed from company records.`);
    }
    setDeleteConfirm({ isOpen: false, id: null, name: "" });
  };

  const openAddForm = () => {
    setEditingEmployee(null);
    setIsFormOpen(true);
  };

  const openEditForm = (emp: Employee) => {
    setEditingEmployee(emp);
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
        <button 
          onClick={openAddForm}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm shadow-primary/20 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Add Employee
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border border-border/60 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center mb-8">
        <div className="flex w-full md:w-auto flex-1 gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search by name or role..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-muted/50 border-none rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
            />
          </div>
          
          <div className="flex gap-2">
            {departments.map(dept => (
              <button 
                key={dept}
                onClick={() => setSelectedDept(selectedDept === dept ? null : dept)}
                className={cn(
                  "px-4 py-2 rounded-xl text-[12px] font-bold transition-all border",
                  selectedDept === dept 
                    ? "bg-primary text-primary-foreground border-primary" 
                    : "bg-white text-foreground/80 border-border hover:bg-muted/50"
                )}
              >
                {dept}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {sortedEmployees.map((emp) => (
            <div key={emp.id} className="group bg-white border border-border/50 rounded-3xl p-6 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 relative">
              <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => openEditForm(emp)}
                  className="p-2 text-muted-foreground hover:bg-muted hover:text-foreground/80 rounded-full transition-colors"
                  title="Edit"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    const newStatus = emp.status === 'Inactive' ? 'Active' : 'Inactive';
                    updateEmployee(emp.id, { status: newStatus });
                    toast.success(`${emp.name} is now ${newStatus}`);
                  }}
                  className={cn(
                    "p-2 rounded-full transition-colors",
                    emp.status === 'Inactive' ? "text-amber-500 hover:bg-amber-50" : "text-muted-foreground hover:bg-amber-50 hover:text-amber-600"
                  )}
                  title={emp.status === 'Inactive' ? "Mark as Active" : "Mark as Inactive"}
                >
                  {emp.status === 'Inactive' ? <UserCheck className="w-4 h-4" /> : <UserMinus className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => toast.success("Permissions management coming soon!")}
                  className="p-2 text-muted-foreground hover:bg-blue-50 hover:text-blue-600 rounded-full transition-colors"
                  title="Permissions"
                >
                  <Shield className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => handleDeleteEmployee(emp.id, emp.name)}
                  className="p-2 text-muted-foreground hover:bg-red-50 hover:text-red-600 rounded-full transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              
              <div className="flex flex-col items-center text-center">
                <div className="relative mb-4">
                  <img src={emp.avatar} alt={emp.name} className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-md" />
                  <span className={cn(
                    "absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-white",
                    getStatusColor(emp.status)
                  )}>
                    {emp.status === 'Active' && <span className="absolute inset-0 rounded-full animate-ping bg-emerald-400 opacity-75"></span>}
                  </span>
                </div>
                
                <h3 className="text-[16px] font-black text-foreground mb-1">{emp.name}</h3>
                <p className="text-[12px] font-medium text-muted-foreground mb-4">{emp.role}</p>
                
                <span className="px-3 py-1 bg-muted/50 text-foreground/80 text-[10px] font-bold uppercase tracking-wider rounded-lg mb-4">
                  {emp.department}
                </span>

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
                    <span className="truncate">{emp.password || "No password set"}</span>
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
      )}

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
                {sortedEmployees.map((emp) => (
                  <tr key={emp.id} className="border-b border-slate-50 hover:bg-muted/50/50 transition-colors group">
                    {COLUMN_OPTIONS.map(col => visibleColumns[col.key] && (
                      <td key={col.key} className={cn("px-6 py-4", col.key === 'actions' ? 'text-right w-[1%] whitespace-nowrap' : '')}>
                        {renderCell(emp, col.key)}
                      </td>
                    ))}
                  </tr>
                ))}
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
    </div>
  );
}
