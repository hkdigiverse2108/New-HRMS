import React, { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Clock, RotateCcw, AlertTriangle, CheckCircle2, Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { getTodayDateIST, formatISTTime } from "@/lib/timeUtils";
import { cn } from "@/lib/utils";

interface BreakItem {
  start_time: string;
  end_time?: string | null;
  duration_seconds?: number;
}

interface RecoverTimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string;
  onRecovered: () => void;
}

// Helper to convert "14:30" (24h) to "02:30 PM" (12h)
function convert24to12(time24: string): string {
  if (!time24) return "";
  const parts = time24.split(":");
  let hours = parseInt(parts[0] ?? "0", 10);
  const minutes = parts[1] || "00";
  if (isNaN(hours)) return time24;
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 becomes 12
  const strHours = hours < 10 ? `0${hours}` : `${hours}`;
  return `${strHours}:${minutes} ${ampm}`;
}

// Helper to convert "02:30 PM" to "14:30"
function convert12to24(time12: string): string {
  if (!time12) return "";
  const match = time12.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return "";
  let hours = parseInt(match[1] ?? "0", 10);
  const minutes = match[2] ?? "00";
  const ampm = (match[3] || "AM").toUpperCase();
  if (ampm === "PM" && hours < 12) hours += 12;
  if (ampm === "AM" && hours === 12) hours = 0;
  return `${hours < 10 ? "0" + hours : hours}:${minutes}`;
}

export function RecoverTimeModal({
  isOpen,
  onClose,
  employeeId,
  onRecovered,
}: RecoverTimeModalProps) {
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateIST());
  const [breaks, setBreaks] = useState<BreakItem[]>([]);
  const [selectedBreakIndex, setSelectedBreakIndex] = useState<number>(0);
  const [actualOutTime, setActualOutTime] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Fetch attendance breaks for selected date
  const fetchBreaks = useCallback(async (date: string) => {
    setIsLoading(true);
    try {
      const res = await api.get<any[]>(
        `/attendance?employee_id=${employeeId}&start_date=${date}&end_date=${date}`,
        { showLoader: false, showErrorToast: false }
      );
      if (res && res.length > 0) {
        const docBreaks = res[0].breaks || [];
        setBreaks(docBreaks);
        // Default to first open break, or last break
        const openIdx = docBreaks.findIndex((b: BreakItem) => !b.end_time);
        if (openIdx !== -1) {
          setSelectedBreakIndex(openIdx);
        } else if (docBreaks.length > 0) {
          setSelectedBreakIndex(docBreaks.length - 1);
        } else {
          setSelectedBreakIndex(0);
        }
      } else {
        setBreaks([]);
      }
    } catch {
      setBreaks([]);
    } finally {
      setIsLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    if (isOpen) {
      const today = getTodayDateIST();
      setSelectedDate(today);
      fetchBreaks(today);
      setActualOutTime("");
    }
  }, [isOpen, fetchBreaks]);

  // Set quick suggestion based on selected break start time
  const handleQuickAddMinutes = (mins: number) => {
    const currentBreak = breaks[selectedBreakIndex];
    if (!currentBreak || !currentBreak.start_time) return;
    try {
      const parsed24 = convert12to24(currentBreak.start_time);
      if (!parsed24) return;
      const parts = parsed24.split(":");
      const h = parseInt(parts[0] ?? "0", 10);
      const m = parseInt(parts[1] ?? "0", 10);
      if (isNaN(h) || isNaN(m)) return;
      const totalMins = h * 60 + m + mins;
      const newH = Math.floor(totalMins / 60) % 24;
      const newM = totalMins % 60;
      const formatted24 = `${newH < 10 ? "0" + newH : newH}:${newM < 10 ? "0" + newM : newM}`;
      setActualOutTime(formatted24);
    } catch {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentBreak = breaks[selectedBreakIndex];
    if (!currentBreak) {
      toast.error("Please select a break to recover.");
      return;
    }

    if (!actualOutTime) {
      toast.error("Please provide the actual break-out time.");
      return;
    }

    const formatted12h = convert24to12(actualOutTime);

    try {
      setIsSubmitting(true);
      await api.post(`/attendance/recover-break/${employeeId}`, {
        date: selectedDate,
        break_start_time: currentBreak.start_time,
        actual_break_out_time: formatted12h,
      });

      toast.success(`Break recovered! End time set to ${formatted12h}`);
      window.dispatchEvent(new Event("attendance_updated"));
      onRecovered();
      onClose();
    } catch (err: any) {
      const msg = err?.data?.detail || err?.message || "Failed to recover break time.";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100vw-16px)] sm:max-w-md max-h-[90dvh] overflow-y-auto flex flex-col p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-border/80 shadow-2xl bg-card">
        <DialogHeader>
          <div className="flex items-center gap-2.5 text-primary mb-1">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
              <RotateCcw className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg font-black tracking-tight text-foreground">
                Recover Break Time
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Forgot to break out? Recover and correct your actual break end time.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Date Selector */}
          <div>
            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
              Select Date
            </label>
            <DatePicker
              value={selectedDate}
              onChange={(val) => {
                const nextDate = val || getTodayDateIST();
                setSelectedDate(nextDate);
                fetchBreaks(nextDate);
              }}
              placeholder="Select date"
              className="w-full h-10 px-3.5 py-2 rounded-xl bg-muted/40 border border-border/80 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* Breaks Selection */}
          <div>
            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
              Recorded Breaks for Date
            </label>
            {isLoading ? (
              <div className="flex items-center justify-center p-6 text-sm text-muted-foreground gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span>Checking attendance breaks...</span>
              </div>
            ) : breaks.length === 0 ? (
              <div className="p-4 rounded-2xl bg-muted/30 border border-border/60 text-center">
                <AlertTriangle className="w-5 h-5 text-amber-500 mx-auto mb-1" />
                <p className="text-xs font-semibold text-foreground">No breaks found for this date.</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  You did not record any break in on this selected date.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {breaks.map((b, idx) => {
                  const isSelected = selectedBreakIndex === idx;
                  const isOpenBreak = !b.end_time;
                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedBreakIndex(idx)}
                      className={cn(
                        "p-3 rounded-2xl border text-xs cursor-pointer transition-all flex items-center justify-between gap-3",
                        isSelected
                          ? "border-primary bg-primary/5 ring-1 ring-primary/40 shadow-sm"
                          : "border-border/60 bg-muted/20 hover:bg-muted/40",
                        isOpenBreak && "border-amber-500/40 bg-amber-500/5"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <Clock className={cn("w-4 h-4", isOpenBreak ? "text-amber-500" : "text-muted-foreground")} />
                        <div>
                          <div className="font-bold text-foreground">
                            Started: {b.start_time}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {isOpenBreak ? (
                              <span className="text-amber-600 dark:text-amber-400 font-bold">
                                ⚠️ Missed Break Out (Still Running)
                              </span>
                            ) : (
                              <span>Ended at: {b.end_time}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                          isOpenBreak ? "bg-amber-500/20 text-amber-600 dark:text-amber-400" : "bg-muted text-muted-foreground"
                        )}>
                          {isOpenBreak ? "Incomplete" : "Completed"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Actual Break Out Time Input */}
          {breaks.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border/50">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                Actual Break Out Time
              </label>
              <input
                type="time"
                value={actualOutTime}
                onChange={(e) => setActualOutTime(e.target.value)}
                required
                className="w-full h-11 px-3.5 py-2 rounded-xl bg-background border border-border/80 text-base font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />

              {/* Quick suggestion pills */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] font-bold text-muted-foreground">Quick Add:</span>
                {[15, 30, 45, 60].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => handleQuickAddMinutes(mins)}
                    className="px-2.5 py-1 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 inline-flex items-center justify-center rounded-lg bg-muted/60 hover:bg-muted text-[11px] font-semibold text-foreground transition-colors border border-border/50"
                  >
                    +{mins}m
                  </button>
                ))}
              </div>

              {actualOutTime && (
                <p className="text-xs font-semibold text-primary pt-1">
                  Will set break end to: {convert24to12(actualOutTime)}
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl font-bold text-xs text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || breaks.length === 0 || !actualOutTime}
              className="px-5 py-2.5 rounded-xl font-bold text-xs bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20 transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save Recovered Time</span>
                </>
              )}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
