import { useState, useRef, useEffect } from "react";
import { X, Search, Check, ChevronDown } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "@/lib/toast";

interface AddOrgNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** together: several people share one box below the parent */
  onSubmit: (employeeIds: string[], together: boolean) => void;
  /** Employees not yet placed in the chart */
  options: { label: string; value: string }[];
  parentName?: string;
}

export function AddOrgNodeModal({ isOpen, onClose, onSubmit, options, parentName }: AddOrgNodeModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [together, setTogether] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!listOpen) return;
    const close = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setListOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [listOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) {
      toast.error("Please select at least one employee");
      return;
    }
    onSubmit(selectedIds, selectedIds.length > 1 && together);
    setSelectedIds([]);
    setSearch("");
    setTogether(false);
    setListOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100vw-24px)] sm:max-w-md max-h-[90dvh] flex flex-col p-0 overflow-hidden rounded-2xl sm:rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border/50 bg-muted/50/50">
          <div>
            <h2 className="text-xl font-black text-foreground">Add Team Member</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {parentName ? `Add members under ${parentName}` : "Add members to the organization"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center shrink-0 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
          <div className="p-6 md:p-8 space-y-2 overflow-y-auto flex-1 min-h-0">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Employees</label>
            <div ref={pickerRef} className="relative">
              <button
                type="button"
                onClick={() => setListOpen((v) => !v)}
                className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-muted/50 border border-border/50 rounded-xl text-sm font-medium text-left cursor-pointer"
              >
                <span className={`truncate ${selectedIds.length ? "text-foreground" : "text-muted-foreground"}`}>
                  {selectedIds.length ? options.filter((o) => selectedIds.includes(o.value)).map((o) => o.label.replace(/ \(.*\)$/, "")).join(", ") : options.length ? "Select Employees" : "No unassigned employees"}
                </span>
                <ChevronDown className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform ${listOpen ? "rotate-180" : ""}`} />
              </button>
              {listOpen && (
                <div className="mt-2 rounded-xl border border-border bg-card shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50">
                    <Search className="w-4 h-4 text-muted-foreground" />
                    <input
                      autoFocus
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search employees..."
                      className="flex-1 bg-transparent text-sm focus:outline-none"
                    />
                  </div>
                  <div className="max-h-52 overflow-y-auto p-1.5 space-y-0.5">
                    {options
                      .filter((o) => o.label.toLowerCase().includes(search.trim().toLowerCase()))
                      .map((o) => {
                        const checked = selectedIds.includes(o.value);
                        return (
                          <button
                            key={o.value}
                            type="button"
                            onClick={() =>
                              setSelectedIds((prev) => (checked ? prev.filter((id) => id !== o.value) : [...prev, o.value]))
                            }
                            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-sm transition-colors cursor-pointer ${checked ? "bg-primary/10 text-foreground" : "hover:bg-muted text-foreground/80"}`}
                          >
                            <span className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center ${checked ? "bg-primary border-primary text-primary-foreground" : "border-border bg-card"}`}>
                              {checked && <Check className="w-3 h-3" />}
                            </span>
                            <span className="truncate font-medium">{o.label}</span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
            {selectedIds.length > 1 && (
              <label className="flex items-center gap-2.5 pt-2 cursor-pointer select-none text-sm font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={together}
                  onChange={(e) => setTogether(e.target.checked)}
                  className="w-4 h-4 accent-[var(--primary)]"
                />
                Keep them together in one box
              </label>
            )}
          </div>
          <div className="px-6 md:px-8 py-4 md:py-6 bg-muted/30 border-t border-border/50 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 min-h-[44px] w-full sm:w-auto rounded-xl font-bold text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 min-h-[44px] w-full sm:w-auto bg-primary text-primary-foreground font-bold rounded-xl shadow-md hover:bg-primary/90 transition-all"
            >
              {selectedIds.length > 1 ? `Add ${selectedIds.length} Members` : "Add Member"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
