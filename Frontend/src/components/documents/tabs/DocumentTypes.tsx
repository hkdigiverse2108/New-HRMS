import { useState, useEffect } from "react";
import { Plus, Trash2, Settings2, Pencil, Loader2 } from "lucide-react";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableHeader } from "@/components/ui/sortable-header";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";

export interface DocType {
  id: string;
  name: string;
  description: string;
  isRequired: boolean;
}

export function DocumentTypes() {
  const [types, setTypes] = useState<DocType[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Form States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingType, setEditingType] = useState<DocType | null>(null);
  const [typeName, setTypeName] = useState("");
  const [typeDesc, setTypeDesc] = useState("");
  const [typeRequired, setTypeRequired] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Confirm Delete Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    idToDelete?: string;
    nameToDelete?: string;
  }>({ isOpen: false });

  // Fetch document types from backend
  const fetchDocumentTypes = async () => {
    setIsLoading(true);
    try {
      const res = await api.get("/document-types", { showLoader: false, showErrorToast: false });
      const rawTypes = Array.isArray(res) ? res : res?.items || res?.data || [];
      
      const mapped: DocType[] = rawTypes.map((item: any) => ({
        id: String(item._id || item.id),
        name: item.name || "Document Type",
        description: item.description || "",
        isRequired: Boolean(item.is_mandatory || item.isRequired)
      }));

      setTypes(mapped);
    } catch (err: any) {
      console.error("Failed to load document types:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDocumentTypes();
  }, []);

  const openAddForm = () => {
    setEditingType(null);
    setTypeName("");
    setTypeDesc("");
    setTypeRequired(false);
    setIsFormOpen(true);
  };

  const openEditForm = (type: DocType) => {
    setEditingType(type);
    setTypeName(type.name);
    setTypeDesc(type.description || "");
    setTypeRequired(type.isRequired);
    setIsFormOpen(true);
  };

  const handleSaveType = async () => {
    if (!typeName.trim()) {
      toast.error("Document type name is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: typeName.trim(),
        description: typeDesc.trim() || undefined,
        is_mandatory: typeRequired
      };

      if (editingType) {
        await api.put(`/document-types/${editingType.id}`, payload);
        toast.success(`Document type "${typeName}" updated successfully!`);
      } else {
        await api.post("/document-types", payload);
        toast.success(`New document type "${typeName}" created successfully!`);
      }

      setIsFormOpen(false);
      setEditingType(null);
      setTypeName("");
      setTypeDesc("");
      setTypeRequired(false);
      await fetchDocumentTypes();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save document type");
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = (id: string, name: string) => {
    setConfirmModal({ isOpen: true, idToDelete: id, nameToDelete: name });
  };

  const executeDelete = async () => {
    if (!confirmModal.idToDelete) return;
    try {
      await api.delete(`/document-types/${confirmModal.idToDelete}`);
      toast.success(`Document type "${confirmModal.nameToDelete}" deleted successfully`);
      await fetchDocumentTypes();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete document type");
    } finally {
      setConfirmModal({ isOpen: false });
    }
  };

  const { items: sortedTypes, requestSort, sortConfig } = useSortableData(types);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-foreground">Document Types Configuration</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage the types of documents employees can upload.</p>
        </div>
        <div className="flex items-center gap-2">
          {!isFormOpen && (
            <button
              onClick={openAddForm}
              className="px-4 py-2.5 min-h-[44px] sm:min-h-0 w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add Type
            </button>
          )}
        </div>
      </div>

      {isFormOpen && (
        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm animate-in slide-in-from-top-4">
          <h3 className="font-bold mb-4 flex items-center gap-2 text-foreground">
            <Settings2 className="w-5 h-5 text-primary" />
            {editingType ? "Edit Document Type" : "New Document Type"}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Type Name *</label>
              <input
                type="text"
                value={typeName}
                onChange={(e) => setTypeName(e.target.value)}
                placeholder="e.g. Passport / Aadhaar Card"
                className="w-full px-4 py-2.5 bg-background border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Description</label>
              <input
                type="text"
                value={typeDesc}
                onChange={(e) => setTypeDesc(e.target.value)}
                placeholder="Brief description"
                className="w-full px-4 py-2.5 bg-background border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <input 
              type="checkbox" 
              id="req"
              checked={typeRequired}
              onChange={(e) => setTypeRequired(e.target.checked)}
              className="w-4 h-4 rounded border-border/50 text-primary focus:ring-primary/20 cursor-pointer"
            />
            <label htmlFor="req" className="text-sm font-semibold text-foreground cursor-pointer select-none">
              Mark as mandatory for all employees
            </label>
          </div>
          <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <button
              onClick={() => {
                setIsFormOpen(false);
                setEditingType(null);
              }}
              className="px-4 py-2 min-h-[44px] w-full sm:w-auto text-sm font-bold text-muted-foreground hover:bg-muted/50 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveType}
              disabled={!typeName.trim() || isSubmitting}
              className="px-6 py-2 min-h-[44px] w-full sm:w-auto text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? "Saving..." : editingType ? "Update Type" : "Save Type"}
            </button>
          </div>
        </div>
      )}

      <div className="bg-card border border-border/50 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left border-collapse">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <SortableHeader label="Document Type" sortKey="name" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap" />
                <SortableHeader label="Description" sortKey="description" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap" />
                <SortableHeader label="Requirement" sortKey="isRequired" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap" />
                <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 mx-auto animate-spin mb-2 text-primary" />
                    <p className="font-bold text-sm">Loading document types...</p>
                  </td>
                </tr>
              ) : sortedTypes.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-muted-foreground">
                    No document types configured yet.
                  </td>
                </tr>
              ) : (
                sortedTypes.map((type) => (
                  <tr key={type.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="p-4">
                      <div className="font-bold text-foreground">{type.name}</div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm text-muted-foreground">
                        {type.description || "-"}
                      </div>
                    </td>
                    <td className="p-4">
                      {type.isRequired ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-600 border border-rose-500/20">
                          Mandatory
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-slate-500/10 text-slate-600 border border-slate-500/20">
                          Optional
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => openEditForm(type)}
                          className="p-2 text-muted-foreground hover:text-primary hover:bg-muted rounded-xl transition-colors"
                          title="Edit Document Type"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => confirmDelete(type.id, type.name)}
                          className="p-2 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors"
                          title="Delete Document Type"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal 
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false })}
        onConfirm={executeDelete}
        title="Delete Document Type"
        description="Are you sure you want to delete this document type? This might affect existing employee records."
        itemName={confirmModal.nameToDelete}
      />
    </div>
  );
}
