import React, { useState } from "react";
import { Building2, Plus, Search, Edit2, Trash2, X, Check, Layers, AlertCircle } from "lucide-react";
import { useDepartments } from "./DepartmentContext";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useModulePermissions } from "@/hooks/useModulePermissions";

interface DepartmentsManagerProps {
  subDepartmentsCountMap?: Record<string, number>;
  onDepartmentChanged?: () => void;
}

export function DepartmentsManager({ subDepartmentsCountMap = {}, onDepartmentChanged }: DepartmentsManagerProps) {
  const { departments, addDepartment, updateDepartment, removeDepartment } = useDepartments();
  const { canCreate, canUpdate, canDelete } = useModulePermissions("/employees/departments-setup");

  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");
  const [editingDept, setEditingDept] = useState<string | null>(null);
  const [editDeptName, setEditDeptName] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; dept: string | null }>({
    isOpen: false,
    dept: null,
  });

  const filteredDepartments = departments.filter((d) =>
    d.toLowerCase().includes(search.toLowerCase().trim())
  );

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newDeptName.trim();
    if (!clean) return;
    if (departments.some((d) => d.toLowerCase() === clean.toLowerCase())) {
      toast.error(`Department "${clean}" already exists`);
      return;
    }
    await addDepartment(clean);
    setNewDeptName("");
    setIsAddOpen(false);
    toast.success(`Department "${clean}" added successfully!`);
    onDepartmentChanged?.();
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDept) return;
    const clean = editDeptName.trim();
    if (!clean) return;
    if (clean.toLowerCase() !== editingDept.toLowerCase() && departments.some((d) => d.toLowerCase() === clean.toLowerCase())) {
      toast.error(`Department "${clean}" already exists`);
      return;
    }
    await updateDepartment(editingDept, clean);
    setEditingDept(null);
    setEditDeptName("");
    toast.success(`Department updated to "${clean}"!`);
    onDepartmentChanged?.();
  };

  const handleDelete = async () => {
    if (deleteConfirm.dept) {
      await removeDepartment(deleteConfirm.dept);
      toast.success(`Department "${deleteConfirm.dept}" removed!`);
      onDepartmentChanged?.();
    }
    setDeleteConfirm({ isOpen: false, dept: null });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border/60 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div>
          <h2 className="text-lg font-black text-foreground flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            <span>Manage Departments</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              {departments.length} Total
            </span>
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Dynamic system departments. Adding or editing here updates employee forms and access presets in real-time.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search departments..."
              className="w-full h-10 pl-9 pr-4 rounded-xl border border-border bg-background text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
            />
          </div>
          {canCreate && (
            <button
              onClick={() => setIsAddOpen(true)}
              className="px-4 h-10 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs flex items-center gap-2 shadow-sm transition-all shrink-0 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Add Department</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid of Departments */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDepartments.length === 0 ? (
          <div className="col-span-full py-12 text-center text-muted-foreground text-sm bg-card border border-dashed border-border/80 rounded-2xl">
            No departments found matching your search.
          </div>
        ) : (
          filteredDepartments.map((dept) => {
            const subCount = subDepartmentsCountMap[dept] || 0;
            return (
              <div
                key={dept}
                className="bg-card border border-border/70 hover:border-primary/50 rounded-2xl p-4 transition-all shadow-sm hover:shadow-md flex items-center justify-between group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black shrink-0">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-foreground truncate">{dept}</h3>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                      <Layers className="w-3.5 h-3.5" />
                      <span>{subCount} sub-departments</span>
                    </div>
                  </div>
                </div>

                {(canUpdate || canDelete) && (
                  <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
                    {canUpdate && (
                      <button
                        onClick={() => {
                          setEditingDept(dept);
                          setEditDeptName(dept);
                        }}
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors"
                        title="Edit Department Name"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => setDeleteConfirm({ isOpen: true, dept })}
                        className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
                        title="Delete Department"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add Department Modal */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden rounded-3xl gap-0 border-border bg-card shadow-2xl [&>button]:hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-border/50 bg-muted/40">
            <div>
              <h3 className="text-base font-black text-foreground">Add New Department</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Create a dynamic department across HRMS</p>
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
                Department Name <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={newDeptName}
                onChange={(e) => setNewDeptName(e.target.value)}
                placeholder="e.g. Research & Innovation"
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
                disabled={!newDeptName.trim()}
                className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-black transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Create Department</span>
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Department Modal */}
      <Dialog open={Boolean(editingDept)} onOpenChange={(open) => !open && setEditingDept(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden rounded-3xl gap-0 border-border bg-card shadow-2xl [&>button]:hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-border/50 bg-muted/40">
            <div>
              <h3 className="text-base font-black text-foreground">Edit Department</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Rename "{editingDept}"</p>
            </div>
            <button
              onClick={() => setEditingDept(null)}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleEdit} className="p-6 space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground/80 uppercase tracking-wider">
                Department Name <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={editDeptName}
                onChange={(e) => setEditDeptName(e.target.value)}
                autoFocus
                className="w-full h-11 px-4 rounded-xl border border-border bg-muted/30 focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm font-medium transition-all"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingDept(null)}
                className="px-4 py-2.5 rounded-xl border border-border text-xs font-bold hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!editDeptName.trim()}
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
        onClose={() => setDeleteConfirm({ isOpen: false, dept: null })}
        onConfirm={handleDelete}
        title="Delete Department"
        description={`Are you sure you want to delete the department "${deleteConfirm.dept}"? This will affect linked employees and presets.`}
        confirmText="Delete"
      />
    </div>
  );
}
