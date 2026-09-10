import { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, FileType2, X } from "lucide-react";
import { DialogClose,  Dialog, DialogContent  } from "@/components/ui/dialog";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { moveToRecycleBin } from "@/lib/recycle-bin";

interface DocTemplate {
  id: string;
  name: string;
  category: string;
  lastUpdated: string;
  content?: string;
}

const DEFAULT_TEMPLATES: DocTemplate[] = [
  { id: "tpl1", name: "Standard Offer Letter", category: "Onboarding", lastUpdated: "2024-02-15" },
  { id: "tpl2", name: "Relieving Letter", category: "Offboarding", lastUpdated: "2024-01-10" },
  { id: "tpl3", name: "Salary Certificate", category: "Finance", lastUpdated: "2024-03-01" },
  { id: "tpl4", name: "Non-Disclosure Agreement (NDA)", category: "Legal", lastUpdated: "2023-11-20" },
];

export function DocumentTemplates() {
  const [templates, setTemplates] = useState<DocTemplate[]>(() => {
    if (typeof window !== "undefined") {
      const stored = (typeof window !== 'undefined' ? localStorage.getItem("documentTemplates") : null);
      return stored ? JSON.parse(stored) : DEFAULT_TEMPLATES;
    }
    return DEFAULT_TEMPLATES;
  });

  useEffect(() => {
    localStorage.setItem("documentTemplates", JSON.stringify(templates));
  }, [templates]);

  const [isAddMode, setIsAddMode] = useState(false);
  const [newTempName, setNewTempName] = useState("");
  const [newTempCategory, setNewTempCategory] = useState("");
  const [newTempContent, setNewTempContent] = useState("");

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    idToDelete?: string;
    nameToDelete?: string;
  }>({ isOpen: false });

  const confirmDelete = (id: string, name: string) => {
    setConfirmModal({ isOpen: true, idToDelete: id, nameToDelete: name });
  };

  const executeDelete = () => {
    if (confirmModal.idToDelete) {
      const template = templates.find(t => t.id === confirmModal.idToDelete);
      if (template) {
        moveToRecycleBin('Document Template', template.name, template, 'documentTemplates');
      }
      setTemplates(templates.filter(t => t.id !== confirmModal.idToDelete));
    }
    setConfirmModal({ isOpen: false });
  };

  const handleCreateTemplate = () => {
    if (!newTempName.trim() || !newTempContent.trim()) return;
    const newTemplate: DocTemplate = {
      id: `tpl_${Date.now()}`,
      name: newTempName.trim(),
      category: newTempCategory.trim() || "General",
      lastUpdated: new Date().toISOString().split('T')[0] || "",
      content: newTempContent
    };
    setTemplates([...templates, newTemplate]);
    setIsAddMode(false);
    setNewTempName("");
    setNewTempCategory("");
    setNewTempContent("");
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Document Templates</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage standard templates used across the organization.</p>
        </div>
        <button 
          onClick={() => setIsAddMode(true)}
          className="px-4 py-2.5 bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Create Template
        </button>
      </div>

      <Dialog open={isAddMode} onOpenChange={setIsAddMode}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className="flex items-center justify-between p-6 border-b border-border/50">
              <h2 className="text-xl font-bold">Create Document Template</h2>
              <button 
                onClick={() => setIsAddMode(false)}
                className="p-2 text-muted-foreground hover:bg-muted/50 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 md:p-8 space-y-6 overflow-y-auto max-h-[70vh]">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Template Name</label>
                  <input
                    type="text"
                    value={newTempName}
                    onChange={(e) => setNewTempName(e.target.value)}
                    placeholder="e.g. Probation Extension"
                    className="w-full px-4 py-2.5 bg-background border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Category</label>
                  <input
                    type="text"
                    value={newTempCategory}
                    onChange={(e) => setNewTempCategory(e.target.value)}
                    placeholder="e.g. HR, Legal"
                    className="w-full px-4 py-2.5 bg-background border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Template Content</label>
                <p className="text-xs text-muted-foreground mb-3">Use double curly braces for variables, e.g. <code className="bg-muted px-1 rounded">{"{{employee_name}}"}</code>.</p>
                <textarea
                  value={newTempContent}
                  onChange={(e) => setNewTempContent(e.target.value)}
                  placeholder="Dear {{employee_name}},&#10;&#10;Your probation has been extended by {{extension_months}} months..."
                  className="w-full h-64 px-4 py-3 bg-background border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium resize-none"
                />
              </div>
            </div>

            <div className="px-6 md:px-8 py-4 md:py-6 bg-muted/30 border-t border-border/50 flex justify-end gap-3 mt-auto shrink-0">
              <button 
                onClick={() => setIsAddMode(false)}
                className="px-4 py-2 font-bold text-muted-foreground hover:bg-muted/50 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateTemplate}
                disabled={!newTempName.trim() || !newTempContent.trim()}
                className="px-6 py-2 bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl transition-colors disabled:opacity-50 shadow-sm"
              >
                Save Template
              </button>
            </div>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((tpl) => (
          <div key={tpl.id} className="bg-card border border-border/50 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all group">
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                <FileType2 className="w-5 h-5" />
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => confirmDelete(tpl.id, tpl.name)}
                  className="p-1.5 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <h3 className="font-bold text-foreground line-clamp-1" title={tpl.name}>{tpl.name}</h3>
            
            <div className="mt-4 flex items-center justify-between text-xs font-medium">
              <span className="inline-flex px-2 py-1 rounded-md bg-muted/50 text-muted-foreground border border-border/50">
                {tpl.category}
              </span>
              <span className="text-muted-foreground">
                Updated {tpl.lastUpdated}
              </span>
            </div>
          </div>
        ))}

        {templates.length === 0 && (
          <div className="col-span-full p-8 text-center text-muted-foreground border border-dashed border-border/50 rounded-2xl">
            No templates configured yet. Click "Create Template" to get started.
          </div>
        )}
      </div>

      <ConfirmModal 
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false })}
        onConfirm={executeDelete}
        title="Delete Template"
        description="Are you sure you want to delete this template? Any pending generations using this template might be affected."
        itemName={confirmModal.nameToDelete || ""}
      />
    </div>
  );
}
