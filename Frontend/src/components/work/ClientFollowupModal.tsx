import React, { useState } from "react";
import {
  Clock,
  Calendar,
  Plus,
  User,
  CheckCircle2,
  X,
  Loader2,
  MessageSquare,
  History,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

export interface FollowupLogEntry {
  id: string;
  text: string;
  created_at: string;
  created_by?: string | undefined;
  created_by_name?: string | undefined;
  next_date?: string | undefined;
}

interface ClientFollowupModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientName: string;
  companyName?: string | undefined;
  followups?: FollowupLogEntry[] | undefined;
  onAddFollowup: (entry: { text: string; next_date?: string | undefined }) => Promise<void>;
}

export const ClientFollowupModal: React.FC<ClientFollowupModalProps> = ({
  isOpen,
  onClose,
  clientName,
  companyName,
  followups = [],
  onAddFollowup,
}) => {
  const [followupText, setFollowupText] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followupText.trim()) {
      toast.error("Please enter a follow-up discussion note");
      return;
    }

    try {
      setIsSubmitting(true);
      await onAddFollowup({
        text: followupText.trim(),
        next_date: nextDate || undefined,
      });
      toast.success("Follow-up note logged successfully!");
      setFollowupText("");
      setNextDate("");
    } catch (err: any) {
      toast.error(err?.message || "Failed to log follow-up note");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="w-[calc(100vw-1rem)] sm:w-full max-w-2xl gap-0 bg-card border-border/60 rounded-2xl sm:rounded-3xl p-0 overflow-hidden shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[85vh]">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 pr-12 sm:pr-14 border-b border-border/50 bg-muted/20 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-bold shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-sm sm:text-base font-black text-foreground leading-snug">
                Client Discussion & Follow-up Logs
              </DialogTitle>
              <p className="text-xs text-muted-foreground break-words">
                Audit history accessible to all team members • {clientName} {companyName ? `(${companyName})` : ""}
              </p>
            </div>
          </div>
        </div>

        {/* Add Follow-up Form */}
        <div className="p-4 sm:p-6 border-b border-border/40 bg-muted/10 shrink-0">
          <form onSubmit={handleSubmit} className="space-y-3">
            <label className="block text-xs font-bold text-foreground">
              Add Interaction Note / Client Update
            </label>
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
              <input
                type="text"
                value={followupText}
                onChange={e => setFollowupText(e.target.value)}
                placeholder="e.g. Spoke to client about budget approval…"
                className="w-full sm:w-auto basis-full sm:basis-0 sm:flex-1 min-w-0 px-3.5 h-10 bg-background border border-border/60 rounded-xl text-xs font-medium outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 text-foreground placeholder:text-muted-foreground/70"
                required
              />
              <DatePicker
                value={nextDate}
                onChange={val => setNextDate(val)}
                placeholder="Next Followup"
                className="h-10 flex-1 min-w-0 bg-background border-border/60 rounded-xl text-xs font-semibold sm:flex-none sm:w-[160px]"
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 h-10 flex-none bg-primary text-primary-foreground font-black text-xs rounded-xl hover:bg-primary/90 transition flex items-center justify-center gap-1.5 shadow-sm shrink-0 whitespace-nowrap"
              >
                {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>Add Note</span>
              </button>
            </div>
          </form>
        </div>

        {/* Followup History List */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-3">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
            Chronological History ({followups.length} entries)
          </h4>

          {followups.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="font-bold text-xs">No follow-up notes logged yet.</p>
              <p className="text-[11px] mt-0.5">Every team member can view and add updates here for transparency.</p>
            </div>
          ) : (
            followups.map((entry, idx) => {
              const rawDate = entry.created_at ? String(entry.created_at).split("T")[0] : "";
              const formattedDate = rawDate ? rawDate.split("-").reverse().join("/") : "";

              return (
                <div
                  key={entry.id || idx}
                  className="p-3.5 sm:p-4 rounded-2xl border border-border/50 bg-card hover:bg-muted/10 transition-all space-y-1.5 shadow-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
                    <span className="font-black text-foreground flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-primary" />
                      {entry.created_by_name || "Team Member"}
                    </span>
                    <div className="flex flex-wrap items-center gap-2 text-muted-foreground font-mono text-[10px]">
                      <span>{formattedDate}</span>
                      {entry.next_date && (
                        <span className="font-bold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          Next: {entry.next_date}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-foreground/90 font-medium leading-relaxed pl-5 break-words">
                    {entry.text}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
