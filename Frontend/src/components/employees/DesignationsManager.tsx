import React, { useState, useEffect, useMemo } from "react";
import { Briefcase, Plus, Search, Edit2, Trash2, X, Check, Award } from "lucide-react";
import { api } from "@/lib/api";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface DesignationRecord {
  id: string;
  _id?: string;
  name: string;
}

export function DesignationsManager() {
  const [designations, setDesignations] = useState<DesignationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");

  // Add Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  // Edit Modal
  const [editingDesig, setEditingDesig] = useState<DesignationRecord | null>(null);
  const [editTitle, setEditTitle] = useState("");

  // Delete State
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; desig: DesignationRecord | null }>({
    isOpen: false,
    desig: null,
  });

  const fetchDesignations = async () => {
    setIsLoading(true);
    try {
      const res = await api.get<any>("/designations", { showErrorToast: false });
      const raw = res?.data || res?.items || (Array.isArray(res) ? res : []);
      const formatted: DesignationRecord[] = raw.map((d: any) => ({
        id: String(d._id || d.id || ""),
        _id: String(d._id || d.id || ""),
        name: typeof d === "string" ? d : d.name,
      })).filter((d: DesignationRecord) => Boolean(d.name));
      setDesignations(formatted);
    } catch (err) {
      console.error("Failed to load designations", err);
      toast.error("Failed to load designations");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDesignations();
  }, []);

  const filteredList = useMemo(() => {
    return designations.filter((d) =>
      d.name.toLowerCase().includes(search.toLowerCase().trim())
    );
  }, [designations, search]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newTitle.trim();
    if (!clean) {
      toast.error("Please enter a designation title");
      return;
    }
    if (designations.some((d) => d.name.toLowerCase() === clean.toLowerCase())) {
      toast.error(`Designation "${clean}" already exists`);
      return;
    }

    try {
      await api.post("/designations", { name: clean });
      toast.success(`Designation "${clean}" added successfully!`);
      setIsAddOpen(false);
      setNewTitle("");
      await fetchDesignations();
    } catch (err: any) {
      toast.error(err.message || "Failed to add designation");
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDesig) return;
    const clean = editTitle.trim();
    if (!clean) {
      toast.error("Designation title cannot be empty");
      return;
    }
    if (
      clean.toLowerCase() !== editingDesig.name.toLowerCase() &&
      designations.some((d) => d.name.toLowerCase() === clean.toLowerCase())
    ) {
      toast.error(`Designation "${clean}" already exists`);
      return;
    }

    try {
      await api.put(`/designations/${editingDesig.id}`, { name: clean });
      toast.success(`Designation updated to "${clean}"!`);
      setEditingDesig(null);
      await fetchDesignations();
    } catch (err: any) {
      toast.error(err.message || "Failed to update designation");
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm.desig) return;
    try {
      await api.delete(`/designations/${deleteConfirm.desig.id}`);
      toast.success(`Designation "${deleteConfirm.desig.name}" removed!`);
      setDeleteConfirm({ isOpen: false, desig: null });
      await fetchDesignations();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete designation");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border/60 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div>
          <h2 className="text-lg font-black text-foreground flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-primary" />
            <span>Manage Designations</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              {designations.length} Total
            </span>
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Dynamic employee titles and designations across all departments.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search designations..."
              className="w-full h-10 pl-9 pr-4 rounded-xl border border-border bg-background text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
            />
          </div>
          <button
            onClick={() => setIsAddOpen(true)}
            className="px-4 h-10 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs flex items-center gap-2 shadow-sm transition-all shrink-0 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add Designation</span>
          </button>
        </div>
      </div>

      {/* Grid of Designations */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full py-16 text-center text-muted-foreground text-sm">
            Loading dynamic designations...
          </div>
        ) : filteredList.length === 0 ? (
          <div className="col-span-full py-12 text-center text-muted-foreground text-sm bg-card border border-dashed border-border/80 rounded-2xl">
            No designations found matching your search.
          </div>
        ) : (
          filteredList.map((desig) => (
            <div
              key={desig.id}
              className="bg-card border border-border/70 hover:border-primary/50 rounded-2xl p-4 transition-all shadow-sm hover:shadow-md flex items-center justify-between group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black shrink-0">
                  <Award className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm text-foreground truncate">{desig.name}</h3>
                  <span className="text-[11px] text-muted-foreground font-medium">Job Designation</span>
                </div>
              </div>

              <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => {
                    setEditingDesig(desig);
                    setEditTitle(desig.name);
                  }}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors"
                  title="Edit Designation Title"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDeleteConfirm({ isOpen: true, desig })}
                  className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
                  title="Delete Designation"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Designation Modal */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden rounded-3xl gap-0 border-border bg-card shadow-2xl [&>button]:hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-border/50 bg-muted/40">
            <div>
              <h3 className="text-base font-black text-foreground">Add New Designation</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Define a role title across the organization</p>
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
                Designation Title <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Lead Architect, Senior Associate..."
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
                disabled={!newTitle.trim()}
                className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-black transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Create Designation</span>
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Designation Modal */}
      <Dialog open={Boolean(editingDesig)} onOpenChange={(open) => !open && setEditingDesig(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden rounded-3xl gap-0 border-border bg-card shadow-2xl [&>button]:hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-border/50 bg-muted/40">
            <div>
              <h3 className="text-base font-black text-foreground">Edit Designation</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Rename designation</p>
            </div>
            <button
              onClick={() => setEditingDesig(null)}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleEdit} className="p-6 space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground/80 uppercase tracking-wider">
                Designation Title <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                autoFocus
                className="w-full h-11 px-4 rounded-xl border border-border bg-muted/30 focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm font-medium transition-all"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingDesig(null)}
                className="px-4 py-2.5 rounded-xl border border-border text-xs font-bold hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!editTitle.trim()}
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
        onClose={() => setDeleteConfirm({ isOpen: false, desig: null })}
        onConfirm={handleDelete}
        title="Delete Designation"
        description={`Are you sure you want to delete the designation "${deleteConfirm.desig?.name}"?`}
        confirmText="Delete"
      />
    </div>
  );
}
