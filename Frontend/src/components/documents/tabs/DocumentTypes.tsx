import { useState, useEffect } from "react";
import { Plus, Trash2, Settings2 } from "lucide-react";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { moveToRecycleBin } from "@/lib/recycle-bin";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableHeader } from "@/components/ui/sortable-header";

interface DocType {
  id: string;
  name: string;
  description: string;
  isRequired: boolean;
}

const DEFAULT_TYPES: DocType[] = [
  { id: "t1", name: "Aadhaar Card", description: "Government ID Proof", isRequired: true },
  { id: "t2", name: "PAN Card", description: "Tax ID Proof", isRequired: true },
  { id: "t3", name: "Degree Certificate", description: "Highest Education Proof", isRequired: false },
  { id: "t4", name: "Relieving Letter", description: "From previous employer", isRequired: false },
];

export function DocumentTypes() {
  const [types, setTypes] = useState<DocType[]>(() => {
    if (typeof window !== "undefined") {
      const stored = (typeof window !== 'undefined' ? localStorage.getItem("documentTypes") : null);
      return stored ? JSON.parse(stored) : DEFAULT_TYPES;
    }
    return DEFAULT_TYPES;
  });

  useEffect(() => {
    localStorage.setItem("documentTypes", JSON.stringify(types));
  }, [types]);

  const [isAddMode, setIsAddMode] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newRequired, setNewRequired] = useState(false);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    idToDelete?: string;
    nameToDelete?: string;
  }>({ isOpen: false });

  const handleAddType = () => {
    if (!newName.trim()) return;
    const newType: DocType = {
      id: `t${Date.now()}`,
      name: newName.trim(),
      description: newDesc.trim(),
      isRequired: newRequired
    };
    setTypes([...types, newType]);
    setNewName("");
    setNewDesc("");
    setNewRequired(false);
    setIsAddMode(false);
  };

  const confirmDelete = (id: string, name: string) => {
    setConfirmModal({ isOpen: true, idToDelete: id, nameToDelete: name });
  };

  const executeDelete = () => {
    if (confirmModal.idToDelete) {
      const type = types.find(t => t.id === confirmModal.idToDelete);
      if (type) {
        moveToRecycleBin('Document Type', type.name, type, 'documentTypes');
      }
      setTypes(types.filter(t => t.id !== confirmModal.idToDelete));
    }
    setConfirmModal({ isOpen: false });
  };

  const { items: sortedTypes, requestSort, sortConfig } = useSortableData(types);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Document Types Configuration</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage the types of documents employees can upload.</p>
        </div>
        {!isAddMode && (
          <button 
            onClick={() => setIsAddMode(true)}
            className="px-4 py-2.5 bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Type
          </button>
        )}
      </div>

      {isAddMode && (
        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm animate-in slide-in-from-top-4">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-primary" />
            New Document Type
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Type Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Passport"
                className="w-full px-4 py-2.5 bg-background border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Description</label>
              <input
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Brief description"
                className="w-full px-4 py-2.5 bg-background border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <input 
              type="checkbox" 
              id="req"
              checked={newRequired}
              onChange={(e) => setNewRequired(e.target.checked)}
              className="w-4 h-4 rounded border-border/50 text-primary focus:ring-primary/20"
            />
            <label htmlFor="req" className="text-sm font-medium cursor-pointer">Mark as mandatory for all employees</label>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button 
              onClick={() => setIsAddMode(false)}
              className="px-4 py-2 text-sm font-bold text-muted-foreground hover:bg-muted/50 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleAddType}
              disabled={!newName.trim()}
              className="px-6 py-2 text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50"
            >
              Save Type
            </button>
          </div>
        </div>
      )}

      <div className="bg-card border border-border/50 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <SortableHeader label="Document Type" sortKey="name" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap" />
                <SortableHeader label="Description" sortKey="description" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap" />
                <SortableHeader label="Requirement" sortKey="isRequired" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap" />
                <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {sortedTypes.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-muted-foreground">
                    No document types configured.
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
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase bg-rose-500/10 text-rose-600 border border-rose-500/20">
                          Mandatory
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase bg-slate-500/10 text-slate-600 border border-slate-500/20">
                          Optional
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => confirmDelete(type.id, type.name)}
                          className="p-2 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
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
