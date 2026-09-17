import React, { useState, useEffect, useMemo } from "react";
import { Layers, Plus, Search, Edit2, Trash2, X, Check, Building2, Filter } from "lucide-react";
import { api } from "@/lib/api";
import { useDepartments } from "./DepartmentContext";
import { SearchableSelect } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useModulePermissions } from "@/hooks/useModulePermissions";

export interface SubDepartmentRecord {
  id: string;
  _id?: string;
  name: string;
  department_id: string;
  department_name?: string;
}

interface SubDepartmentsManagerProps {
  onSubDepartmentsCountChange?: (countMap: Record<string, number>) => void;
}

export function SubDepartmentsManager({ onSubDepartmentsCountChange }: SubDepartmentsManagerProps) {
  const { departments, departmentItems } = useDepartments();
  const { canCreate, canUpdate, canDelete } = useModulePermissions("/employees/departments-setup");

  const [subDepartments, setSubDepartments] = useState<SubDepartmentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>("all");

  // Add Modal State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newSubName, setNewSubName] = useState("");
  const [newSubDept, setNewSubDept] = useState("");

  // Edit Modal State
  const [editingSub, setEditingSub] = useState<SubDepartmentRecord | null>(null);
  const [editSubName, setEditSubName] = useState("");
  const [editSubDept, setEditSubDept] = useState("");

  // Delete State
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; sub: SubDepartmentRecord | null }>({
    isOpen: false,
    sub: null,
  });

  const fetchSubDepartments = async () => {
    setIsLoading(true);
    try {
      const res = await api.get<any>("/sub-departments", { showErrorToast: false });
      const raw = res?.data || res?.items || (Array.isArray(res) ? res : []);
      const formatted: SubDepartmentRecord[] = raw.map((item: any) => {
        const id = String(item._id || item.id || "");
        let deptName = item.department_name;
        if (!deptName && item.department_id) {
          const match = departmentItems.find((d) => d.id === item.department_id || d.name === item.department_id);
          deptName = match?.name || item.department_id;
        }
        return {
          id,
          _id: id,
          name: item.name,
          department_id: item.department_id,
          department_name: deptName || "Unassigned",
        };
      });
      setSubDepartments(formatted);

      // Compute counts by department
      const countMap: Record<string, number> = {};
      formatted.forEach((s) => {
        const d = s.department_name || "Unassigned";
        countMap[d] = (countMap[d] || 0) + 1;
      });
      onSubDepartmentsCountChange?.(countMap);
    } catch (err) {
      console.error("Failed to load sub-departments", err);
      toast.error("Failed to load sub-departments");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSubDepartments();
  }, [departmentItems]);

  const filteredList = useMemo(() => {
    return subDepartments.filter((s) => {
      const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase().trim());
      const matchesDept =
        selectedDeptFilter === "all" ||
        s.department_name?.toLowerCase() === selectedDeptFilter.toLowerCase() ||
        s.department_id === selectedDeptFilter;
      return matchesSearch && matchesDept;
    });
  }, [subDepartments, search, selectedDeptFilter]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newSubName.trim();
    if (!cleanName) {
      toast.error("Please enter a sub-department name");
      return;
    }
    if (!newSubDept) {
      toast.error("Please select a parent department");
      return;
    }

    try {
      const deptObj = departmentItems.find((d) => d.name === newSubDept || d.id === newSubDept);
      await api.post("/sub-departments", {
        name: cleanName,
        department_id: deptObj ? deptObj.id : newSubDept,
        department_name: deptObj ? deptObj.name : newSubDept,
      });
      toast.success(`Sub-department "${cleanName}" created successfully!`);
      setIsAddOpen(false);
      setNewSubName("");
      setNewSubDept("");
      await fetchSubDepartments();
    } catch (err: any) {
      toast.error(err.message || "Failed to create sub-department");
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSub) return;
    const cleanName = editSubName.trim();
    if (!cleanName) {
      toast.error("Sub-department name cannot be empty");
      return;
    }

    try {
      const deptObj = departmentItems.find((d) => d.name === editSubDept || d.id === editSubDept);
      await api.put(`/sub-departments/${editingSub.id}`, {
        name: cleanName,
        department_id: deptObj ? deptObj.id : editSubDept,
        department_name: deptObj ? deptObj.name : editSubDept,
      });
      toast.success(`Sub-department updated to "${cleanName}"!`);
      setEditingSub(null);
      await fetchSubDepartments();
    } catch (err: any) {
      toast.error(err.message || "Failed to update sub-department");
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm.sub) return;
    try {
      await api.delete(`/sub-departments/${deleteConfirm.sub.id}`);
      toast.success(`Sub-department "${deleteConfirm.sub.name}" deleted!`);
      setDeleteConfirm({ isOpen: false, sub: null });
      await fetchSubDepartments();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete sub-department");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-card border border-border/60 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div>
          <h2 className="text-lg font-black text-foreground flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            <span>Manage Sub-Departments</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              {subDepartments.length} Total
            </span>
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Dynamic sub-department units linked to departments. When selected during employee creation, they populate automatically.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Department Filter */}
          <div className="w-48">
            <SearchableSelect
              value={selectedDeptFilter}
              onChange={(val) => setSelectedDeptFilter(val as string)}
              options={[
                { label: "All Departments", value: "all" },
                ...departments.map((d) => ({ label: d, value: d })),
              ]}
              className="w-full h-10 px-3 rounded-xl border border-border bg-background text-xs font-medium"
            />
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-56">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sub-departments..."
              className="w-full h-10 pl-9 pr-4 rounded-xl border border-border bg-background text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
            />
          </div>

          {canCreate && (
            <button
              onClick={() => {
                setNewSubDept(departments[0] || "");
                setIsAddOpen(true);
              }}
              className="px-4 h-10 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs flex items-center gap-2 shadow-sm transition-all shrink-0 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Add Sub-Department</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid / Table of Sub-Departments */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full py-16 text-center text-muted-foreground text-sm">
            Loading dynamic sub-departments...
          </div>
        ) : filteredList.length === 0 ? (
          <div className="col-span-full py-12 text-center text-muted-foreground text-sm bg-card border border-dashed border-border/80 rounded-2xl">
            No sub-departments found matching your filter or search.
          </div>
        ) : (
          filteredList.map((sub) => (
            <div
              key={sub.id}
              className="bg-card border border-border/70 hover:border-primary/50 rounded-2xl p-4 transition-all shadow-sm hover:shadow-md flex items-center justify-between group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-black shrink-0">
                  <Layers className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm text-foreground truncate">{sub.name}</h3>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                    <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate font-semibold text-foreground/80">{sub.department_name}</span>
                  </div>
                </div>
              </div>

              {(canUpdate || canDelete) && (
                <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
                  {canUpdate && (
                    <button
                      onClick={() => {
                        setEditingSub(sub);
                        setEditSubName(sub.name);
                        setEditSubDept(sub.department_name || "");
                      }}
                      className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors"
                      title="Edit Sub-Department"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => setDeleteConfirm({ isOpen: true, sub })}
                      className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
                      title="Delete Sub-Department"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add Sub-Department Modal */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden rounded-3xl gap-0 border-border bg-card shadow-2xl [&>button]:hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-border/50 bg-muted/40">
            <div>
              <h3 className="text-base font-black text-foreground">Add Sub-Department</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Link a new dynamic sub-unit to a department</p>
            </div>
            <button
              onClick={() => setIsAddOpen(false)}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleAdd} className="p-6 space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground/80 uppercase tracking-wider">
                Parent Department <span className="text-destructive">*</span>
              </label>
              <SearchableSelect
                value={newSubDept}
                onChange={(val) => setNewSubDept(val as string)}
                options={departments.map((d) => ({ label: d, value: d }))}
                placeholder="Select Department"
                className="w-full h-11 px-4 rounded-xl border border-border bg-muted/30 focus:bg-background text-sm font-medium"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground/80 uppercase tracking-wider">
                Sub-Department Name <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={newSubName}
                onChange={(e) => setNewSubName(e.target.value)}
                placeholder="e.g. Talent Acquisition, Frontend, DevOps..."
                autoFocus
                className="w-full h-11 px-4 rounded-xl border border-border bg-muted/30 focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm font-medium transition-all"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-border text-xs font-bold hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newSubName.trim() || !newSubDept}
                className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-black transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Create Sub-Department</span>
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Sub-Department Modal */}
      <Dialog open={Boolean(editingSub)} onOpenChange={(open) => !open && setEditingSub(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden rounded-3xl gap-0 border-border bg-card shadow-2xl [&>button]:hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-border/50 bg-muted/40">
            <div>
              <h3 className="text-base font-black text-foreground">Edit Sub-Department</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Modify sub-department details</p>
            </div>
            <button
              onClick={() => setEditingSub(null)}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleEdit} className="p-6 space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground/80 uppercase tracking-wider">
                Parent Department <span className="text-destructive">*</span>
              </label>
              <SearchableSelect
                value={editSubDept}
                onChange={(val) => setEditSubDept(val as string)}
                options={departments.map((d) => ({ label: d, value: d }))}
                placeholder="Select Department"
                className="w-full h-11 px-4 rounded-xl border border-border bg-muted/30 focus:bg-background text-sm font-medium"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground/80 uppercase tracking-wider">
                Sub-Department Name <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={editSubName}
                onChange={(e) => setEditSubName(e.target.value)}
                autoFocus
                className="w-full h-11 px-4 rounded-xl border border-border bg-muted/30 focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm font-medium transition-all"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingSub(null)}
                className="px-4 py-2.5 rounded-xl border border-border text-xs font-bold hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!editSubName.trim() || !editSubDept}
                className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-black transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
              >
                <Check className="w-4 h-4" />
                <span>Save Changes</span>
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, sub: null })}
        onConfirm={handleDelete}
        title="Delete Sub-Department"
        description={`Are you sure you want to delete the sub-department "${deleteConfirm.sub?.name}"?`}
        confirmText="Delete"
      />
    </div>
  );
}
