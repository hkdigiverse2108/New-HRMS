import { X, AlertTriangle, RotateCcw, Info } from "lucide-react";
import { DialogClose,  Dialog, DialogContent  } from "@/components/ui/dialog";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string | undefined;
  itemName?: string | undefined;
  variant?: "destructive" | "restore" | "info";
}

export function ConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  description,
  confirmText,
  itemName,
  variant = "destructive"
}: ConfirmModalProps) {
  if (!isOpen) return null;

  // Determine styles and text based on variant
  const isRestore = variant === "restore";
  const isInfo = variant === "info";
  
  const headerBgClass = isRestore ? "bg-emerald-50/50" : isInfo ? "bg-blue-50/50" : "bg-red-50/50";
  const iconBgClass = isRestore ? "bg-emerald-100 text-emerald-600" : isInfo ? "bg-blue-100 text-blue-600" : "bg-red-100 text-red-600";
  const buttonClass = isRestore 
    ? "bg-emerald-500 hover:bg-emerald-600 shadow-primary/20" 
    : isInfo
    ? "bg-blue-500 hover:bg-blue-600 shadow-blue-500/20"
    : "bg-red-500 hover:bg-red-600 shadow-red-500/20";
    
  const defaultConfirmText = isRestore ? "Restore" : isInfo ? "Confirm" : "Delete";
  const finalConfirmText = confirmText || defaultConfirmText;
  
  const actionNoun = isRestore ? "restoration" : isInfo ? "action" : "deletion";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className={`flex items-center justify-between px-6 py-5 border-b border-border/50 ${headerBgClass}`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${iconBgClass}`}>
                {isRestore ? <RotateCcw className="w-5 h-5" /> : isInfo ? <Info className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
              </div>
              <div>
                <h2 className="text-xl font-black text-foreground">{title}</h2>
                {itemName && <p className="text-sm text-muted-foreground mt-1">Confirm {actionNoun} of {itemName}</p>}
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
            <p className="text-foreground/80 text-sm leading-relaxed">
              {description}
            </p>

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
                className={`px-6 py-2.5 text-sm font-bold text-white rounded-xl transition-all shadow-sm active:scale-95 ${buttonClass}`}
              >
                {finalConfirmText}
              </button>
            </div>
          </div>
      </DialogContent>
    </Dialog>
  );
}
