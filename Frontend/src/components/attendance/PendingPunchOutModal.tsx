import React, { useState } from "react";
import { AlertCircle, Clock, CheckCircle2, ShieldAlert } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { formatISTDate, formatISTTime, isTimeStrictlyAfter } from "@/lib/timeUtils";

export interface PendingRecordInfo {
  record_id: string;
  date: string; // YYYY-MM-DD
  check_in: string; // e.g. "09:30 AM"
  employee_name?: string;
}

interface PendingPunchOutModalProps {
  isOpen: boolean;
  employeeId: string;
  pendingRecord: PendingRecordInfo | null;
  onResolved: () => void;
}

export function PendingPunchOutModal({
  isOpen,
  employeeId,
  pendingRecord,
  onResolved,
}: PendingPunchOutModalProps) {
  const [punchOutTime, setPunchOutTime] = useState("18:30");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!pendingRecord) return null;

  const formattedDate = formatISTDate(pendingRecord.date, "DD MMM YYYY");
  const formattedCheckIn = formatISTTime(pendingRecord.check_in);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!punchOutTime) {
      setErrorMessage("Please enter a punch-out time.");
      return;
    }

    // Validation: Selected punch-out time MUST be strictly after punch-in time!
    const isValid = isTimeStrictlyAfter(punchOutTime, pendingRecord.check_in);
    if (!isValid) {
      setErrorMessage(
        `Punch-out time must be strictly after the punch-in time (${formattedCheckIn}).`
      );
      return;
    }

    try {
      setIsSubmitting(true);
      await api.post(`/attendance/resolve-pending-punch-out/${employeeId}`, {
        record_id: pendingRecord.record_id,
        date: pendingRecord.date,
        punch_out_time: punchOutTime,
      });

      toast.success(`Pending punch-out for ${formattedDate} resolved successfully!`);
      onResolved();
    } catch (err: any) {
      const detail = err?.data?.detail || err?.message || "Failed to resolve pending punch-out.";
      setErrorMessage(detail);
      toast.error(detail);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      {/* Non-dismissible / blocking modal without close button */}
      <DialogContent
        className="max-w-md w-[calc(100vw-24px)] p-0 rounded-3xl overflow-hidden border border-amber-500/40 shadow-2xl bg-card [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Amber Alert Header */}
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-black text-foreground tracking-tight">
              Action Required: Pending Punch-Out
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              You have an unclosed attendance session from a previous day. You must record your punch-out time for that day before punching in today.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Fixed Pending Date (Pre-filled, not editable) */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Session Date (Fixed)
            </label>
            <div className="px-4 py-3 bg-muted/40 border border-border/70 rounded-xl text-sm font-bold text-foreground flex items-center justify-between">
              <span>{formattedDate}</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold">
                Unclosed Session
              </span>
            </div>
          </div>

          {/* Punch-In Time (Display only) */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Recorded Punch-In Time
            </label>
            <div className="px-4 py-3 bg-muted/40 border border-border/70 rounded-xl text-sm font-bold text-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary shrink-0" />
              <span>{formattedCheckIn}</span>
            </div>
          </div>

          {/* Punch-Out Time Picker (Time only) */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-foreground/80 flex items-center justify-between">
              <span>Punch-Out Time *</span>
              <span className="text-[10px] text-muted-foreground font-medium lowercase">
                (must be after {formattedCheckIn})
              </span>
            </label>
            <div className="relative">
              <input
                type="time"
                required
                value={punchOutTime}
                onChange={(e) => {
                  setPunchOutTime(e.target.value);
                  setErrorMessage(null);
                }}
                className="w-full px-4 py-3 bg-muted/50 border border-border rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all text-foreground"
              />
            </div>
          </div>

          {/* Inline Validation Error */}
          {errorMessage && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl flex items-start gap-2.5 text-xs text-destructive font-medium animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Submit Action */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? "Submitting..." : "Save Punch-Out & Continue"}</span>
            </button>
            <p className="text-[10px] text-center text-muted-foreground mt-2 font-medium">
              This session will be calculated and marked as Logged.
            </p>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
