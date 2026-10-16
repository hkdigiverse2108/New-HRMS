import { useEffect, useState } from "react";
import { Loader2, Timer } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";

interface WorkedHours {
  date: string;
  worked_hours: number;
  standard_hours: number;
  suggested_hours: number;
  max_hours: number;
  has_attendance: boolean;
  is_sunday: boolean;
  blocked_reason: string | null;
}

const todayIST = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

/** Employee's overtime request form — opened from the Dashboard and the Overtime page. */
export function RequestOvertimeModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated?: () => void }) {
  const [date, setDate] = useState(todayIST());
  const [hours, setHours] = useState("");
  const [reason, setReason] = useState("");
  const [worked, setWorked] = useState<WorkedHours | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDate(todayIST());
      setHours("");
      setReason("");
    }
  }, [open]);

  // Hours worked that day (from attendance) pre-fill the OT hours
  useEffect(() => {
    if (!open || !date) return;
    let cancelled = false;
    setWorked(null);
    api.get<WorkedHours>(`/overtime/worked-hours?date=${date}`, { showLoader: false })
      .then(res => {
        if (cancelled) return;
        setWorked(res);
        setHours(res.blocked_reason ? "" : String(res.suggested_hours));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [open, date]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const h = Number(hours);
    if (!date) { toast.error("Select the date"); return; }
    if (worked?.blocked_reason) { toast.error(worked.blocked_reason); return; }
    if (worked && h > worked.max_hours) { toast.error(`You can request at most ${worked.max_hours} hrs for this day`); return; }
    if (!h || h <= 0 || h > 16) { toast.error("Enter overtime hours between 0 and 16"); return; }
    if (reason.trim().length < 3) { toast.error("Write the reason for the overtime"); return; }
    setIsSaving(true);
    try {
      await api.post("/overtime", { date, hours: h, reason: reason.trim() }, { showLoader: false });
      toast.success("Overtime request sent to Admin / HR for approval");
      onCreated?.();
      onClose();
    } catch {
      // error toast shown by api
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass = "w-full rounded-[10px] border border-border/80 p-2.5 text-[13px] font-medium text-foreground/80 outline-none focus:border-emerald-500 bg-white shadow-sm";

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Timer className="h-5 w-5 text-emerald-600" /> Request Overtime
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Overtime is paid only after Admin / HR approve it.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[12px] font-semibold text-muted-foreground mb-1.5 block">Date</label>
            <DatePicker value={date} onChange={v => setDate(v)} maxDate={todayIST()} clearable={false} className="w-full" />
          </div>

          {worked && (
            <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted/40 p-3 text-[12px]">
              <div><p className="text-muted-foreground">Worked</p><p className="font-bold text-[14px]">{worked.worked_hours} hrs</p></div>
              <div><p className="text-muted-foreground">Standard day</p><p className="font-bold text-[14px]">{worked.standard_hours} hrs</p></div>
              <div><p className="text-muted-foreground">Extra</p><p className="font-bold text-[14px] text-emerald-600">{worked.suggested_hours} hrs</p></div>
              {worked.is_sunday && !worked.blocked_reason && (
                <p className="col-span-3 text-violet-700">Sunday — all worked hours count as overtime (holiday rate).</p>
              )}
              {worked.blocked_reason && <p className="col-span-3 font-semibold text-rose-600">{worked.blocked_reason}</p>}
            </div>
          )}

          <div>
            <label className="text-[12px] font-semibold text-muted-foreground mb-1.5 block">Overtime hours</label>
            <input
              type="number"
              min="0.25"
              max={worked ? worked.max_hours : 16}
              step="0.25"
              value={hours}
              onChange={e => setHours(e.target.value)}
              disabled={Boolean(worked?.blocked_reason)}
              placeholder="e.g. 2"
              className={`${inputClass} disabled:bg-muted/40`}
            />
            {worked && !worked.blocked_reason && (
              <p className="mt-1 text-[11px] text-muted-foreground">Up to {worked.max_hours} hrs for this day</p>
            )}
          </div>

          <div>
            <label className="text-[12px] font-semibold text-muted-foreground mb-1.5 block">Reason</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="What did you work on?" className={`${inputClass} resize-none`} />
          </div>

          <DialogFooter>
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-border/80 text-[13px] font-semibold hover:bg-muted/50">Cancel</button>
            <button type="submit" disabled={isSaving || !worked || Boolean(worked.blocked_reason)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0c7851] hover:bg-[#00925e] text-white text-[13px] font-semibold disabled:opacity-50">
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />} Send for Approval
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
