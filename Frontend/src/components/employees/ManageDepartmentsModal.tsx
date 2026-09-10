import { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { DialogClose,  Dialog, DialogContent  } from "@/components/ui/dialog";
import { useDepartments } from "./DepartmentContext";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/ui/confirm-modal";

interface ManageDepartmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ManageDepartmentsModal({ isOpen, onClose }: ManageDepartmentsModalProps) {
  const { departments, addDepartment, removeDepartment } = useDepartments();
  const [newDept, setNewDept] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, dept: string | null}>({isOpen: false, dept: null});

  if (!isOpen) return null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDept.trim()) return;
    if (departments.includes(newDept.trim())) {
      toast.error("Department already exists");
      return;
    }
    addDepartment(newDept.trim());
    setNewDept("");
    toast.success("Department added");
  };

  const handleRemove = () => {
    if (deleteConfirm.dept) {
      removeDepartment(deleteConfirm.dept);
      toast.success("Department removed");
    }
    setDeleteConfirm({ isOpen: false, dept: null });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className="flex items-center justify-between px-6 py-5 border-b border-border/50 bg-muted/50/50">
            <div>
              <h2 className="text-xl font-black text-foreground">Manage Departments</h2>
              <p className="text-sm text-muted-foreground mt-1">Add or remove organization departments.</p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6">
            <form onSubmit={handleAdd} className="flex gap-2 mb-6">
              <input 
                type="text" 
                value={newDept}
                onChange={(e) => setNewDept(e.target.value)}
                placeholder="New department name..."
                className="flex-1 px-4 py-2 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
              />
              <button 
                type="submit"
                disabled={!newDept.trim()}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </form>

            <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2">
              {departments.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-4">No departments found.</p>
              ) : (
                departments.map(dept => (
                  <div key={dept} className="flex items-center justify-between p-3 bg-white border border-border rounded-xl">
                    <span className="text-sm font-bold text-foreground/80">{dept}</span>
                    <button 
                      onClick={() => setDeleteConfirm({ isOpen: true, dept })}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remove department"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
      </DialogContent>
      <ConfirmModal 
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, dept: null })}
        onConfirm={handleRemove}
        title="Delete Department"
        description={`Are you sure you want to delete the department "${deleteConfirm.dept}"? This action cannot be undone.`}
        itemName={deleteConfirm.dept || undefined}
      />
    </Dialog>
  );
}
