import { X, AlertTriangle } from "lucide-react";
import { DialogClose,  Dialog, DialogContent  } from "@/components/ui/dialog";
import { OrgNodeData } from "./org-data";

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  node: OrgNodeData | null;
}

export function DeleteConfirmModal({ isOpen, onClose, onConfirm, node }: DeleteConfirmModalProps) {
  if (!isOpen || !node) return null;

  const hasChildren = node.children && node.children.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className="flex items-center justify-between px-6 py-5 border-b border-border/50 bg-red-50/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 text-red-600 rounded-xl">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-black text-foreground">Remove Employee</h2>
                <p className="text-sm text-muted-foreground mt-1">Confirm deletion of {node.name}</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 md:p-8 space-y-6 overflow-y-auto max-h-[70vh]">
            {hasChildren ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm font-medium">
                <span className="font-bold block mb-1">Warning: Direct Reports Found</span>
                {node.name} has {node.children!.length} direct report(s). Deleting them will also remove their entire team from the organization chart.
              </div>
            ) : (
              <p className="text-foreground/80 text-sm">
                Are you sure you want to remove <strong>{node.name}</strong> from the organization chart? This action cannot be undone.
              </p>
            )}

            <div className="px-6 md:px-8 py-4 md:py-6 bg-muted/30 border-t border-border/50 flex justify-end gap-3 mt-auto shrink-0">
              <button 
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl font-bold text-muted-foreground hover:bg-muted transition-colors"
              >Cancel</button>
              <button 
                type="button"
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className="px-6 py-2.5 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-xl transition-all shadow-sm shadow-red-500/20 active:scale-95"
              >
                {hasChildren ? "Delete Entire Branch" : "Remove Employee"}
              </button>
            </div>
          </div>
      </DialogContent>
    </Dialog>
  );
}
