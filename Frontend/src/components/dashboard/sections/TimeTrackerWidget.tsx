import { useState, useEffect, useCallback, useRef } from "react";
import { Clock, Coffee, LogIn, LogOut, CheckCircle2, ShieldCheck, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthContext";
import { toast } from "sonner";
import {
  formatISTTime,
  formatDurationHours,
  formatDurationSeconds,
  formatStopwatchTime,
  getTodayDateIST
} from "@/lib/timeUtils";
import { PendingPunchOutModal, PendingRecordInfo } from "@/components/attendance/PendingPunchOutModal";

type PunchStatus = "Punched Out" | "Punched In" | "On Break";

export function TimeTrackerWidget() {
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin";
  const employeeId = user?.id || "EMP-CURRENT";

  const [status, setStatus] = useState<PunchStatus>("Punched Out");
  const [workSeconds, setWorkSeconds] = useState(0);
  const [breakSeconds, setBreakSeconds] = useState(0);
  const [punchInTime, setPunchInTime] = useState<string | null>(null);
  const [punchOutTime, setPunchOutTime] = useState<string | null>(null);
  const [breakStartTime, setBreakStartTime] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pending Punch-Out Modal state
  const [pendingRecord, setPendingRecord] = useState<PendingRecordInfo | null>(null);
  const [isPendingModalOpen, setIsPendingModalOpen] = useState(false);

  // Check pending punch-out from previous day
  const checkPendingSession = useCallback(async (): Promise<boolean> => {
    if (isAdmin) return false;
    try {
      const res = await api.get<{ has_pending: boolean; pending_record?: any }>(
        `/attendance/last/${employeeId}`,
        { showLoader: false, showErrorToast: false }
      );
      if (res?.has_pending && res?.pending_record) {
        setPendingRecord(res.pending_record);
        setIsPendingModalOpen(true);
        return true;
      }
    } catch {
      // Offline fallback check from localStorage
      if (typeof window !== "undefined") {
        const localPending = localStorage.getItem(`hrms_pending_punchout_${employeeId}`);
        if (localPending) {
          try {
            const parsed = JSON.parse(localPending);
            setPendingRecord(parsed);
            setIsPendingModalOpen(true);
            return true;
          } catch {}
        }
      }
    }
    return false;
  }, [employeeId, isAdmin]);

  // Sync today's attendance state from backend on load
  const syncTodayStatus = useCallback(async () => {
    if (isAdmin) return;
    try {
      const todayStr = getTodayDateIST();
      const records = await api.get<any[]>(
        `/attendance?employee_id=${employeeId}&start_date=${todayStr}&end_date=${todayStr}`,
        { showLoader: false, showErrorToast: false }
      );

      if (records && records.length > 0) {
        const todayDoc = records[0];
        setPunchInTime(todayDoc.check_in && todayDoc.check_in !== "--" ? todayDoc.check_in : null);
        setPunchOutTime(todayDoc.check_out && todayDoc.check_out !== "--" ? todayDoc.check_out : null);
        setBreakSeconds(todayDoc.break_seconds || 0);

        if (todayDoc.status === "On Break") {
          setStatus("On Break");
          setWorkSeconds(todayDoc.net_work_seconds || 0);
          const openBreak = todayDoc.breaks?.find((b: any) => !b.end_time);
          if (openBreak) {
            setBreakStartTime(openBreak.start_time);
          }
        } else if (todayDoc.status === "Logged" || (todayDoc.check_out && todayDoc.check_out !== "--")) {
          setStatus("Punched Out");
          setWorkSeconds(todayDoc.net_work_seconds || 0);
        } else if (todayDoc.status === "Active" || todayDoc.status === "Late" || todayDoc.status === "Present") {
          setStatus("Punched In");
          setWorkSeconds(todayDoc.net_work_seconds || 0);
        }
      }
    } catch {}
  }, [employeeId, isAdmin]);

  // Initial load check
  useEffect(() => {
    if (!isAdmin) {
      checkPendingSession().then((hasPending) => {
        if (!hasPending) {
          syncTodayStatus();
        }
      });
    }
  }, [checkPendingSession, syncTodayStatus, isAdmin]);

  // Active session stopwatch timer
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (status === "Punched In") {
      interval = setInterval(() => {
        setWorkSeconds((prev) => prev + 1);
      }, 1000);
    } else if (status === "On Break") {
      interval = setInterval(() => {
        setBreakSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [status]);

  // Handle Punch In
  const handlePunchIn = async () => {
    // Double safety check: Verify no pending punch-out before punching in!
    const hasPending = await checkPendingSession();
    if (hasPending) {
      toast.error("Please resolve your pending punch-out from previous session first.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.post<any>(`/attendance/punch-in/${employeeId}`, {});
      setStatus("Punched In");
      setPunchInTime(res?.check_in || formatISTTime(new Date()));
      setPunchOutTime(null);
      setBreakStartTime(null);
      setBreakSeconds(res?.break_seconds || 0);
      setWorkSeconds(res?.net_work_seconds || 0);
      toast.success(res?.is_late ? "Punched In (Late Arrival recorded)" : "Punched In successfully!");
      window.dispatchEvent(new Event("attendance_updated"));
    } catch (err: any) {
      const msg = err?.data?.detail || err?.message || "Failed to Punch In";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Punch Out
  const handlePunchOut = async () => {
    try {
      setIsSubmitting(true);
      const res = await api.post<any>(`/attendance/punch-out/${employeeId}`, {});
      setStatus("Punched Out");
      setPunchOutTime(res?.check_out || formatISTTime(new Date()));
      if (res?.net_work_seconds !== undefined) {
        setWorkSeconds(res.net_work_seconds);
      }
      toast.success(`Punched Out! Total work time: ${res?.work_hours || formatDurationSeconds(workSeconds)}`);
      window.dispatchEvent(new Event("attendance_updated"));
    } catch (err: any) {
      const msg = err?.data?.detail || err?.message || "Failed to Punch Out";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Break In
  const handleBreakIn = async () => {
    try {
      setIsSubmitting(true);
      const res = await api.post<any>(`/attendance/break-in/${employeeId}`, {});
      setStatus("On Break");
      const nowTime = formatISTTime(new Date());
      setBreakStartTime(nowTime);
      toast.info(`Break started at ${nowTime}`);
      window.dispatchEvent(new Event("attendance_updated"));
    } catch (err: any) {
      toast.error(err?.data?.detail || "Failed to start break");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Break Out
  const handleBreakOut = async () => {
    try {
      setIsSubmitting(true);
      const res = await api.post<any>(`/attendance/break-out/${employeeId}`, {});
      setStatus("Punched In");
      setBreakStartTime(null);
      if (res?.break_seconds !== undefined) {
        setBreakSeconds(res.break_seconds);
      }
      toast.success(`Break ended. Total break time: ${formatDurationSeconds(res?.break_seconds ?? breakSeconds)}`);
      window.dispatchEvent(new Event("attendance_updated"));
    } catch (err: any) {
      toast.error(err?.data?.detail || "Failed to end break");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Called when PendingPunchOutModal finishes successfully
  const handlePendingResolved = () => {
    setIsPendingModalOpen(false);
    setPendingRecord(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem(`hrms_pending_punchout_${employeeId}`);
    }
    syncTodayStatus();
  };

  // ADMIN VIEW: Admin does not mark attendance for self
  if (isAdmin) {
    return (
      <div className="bg-card border border-border/60 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 text-primary">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <span className="text-[11px] font-black tracking-widest text-primary uppercase">Administrator Account</span>
            <h2 className="text-xl font-black text-foreground tracking-tight">Attendance Management System</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Personal punch tracking is disabled for Administrators. You have full access to review all employee logs and leave approvals.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-card border border-border/60 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-6 transition-all">
        {/* Status Indicator */}
        <div className="flex items-center gap-5 shrink-0">
          <div className={cn(
            "w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-sm border transition-all",
            status === "Punched In" && "bg-primary/10 border-primary/30 text-primary",
            status === "On Break" && "bg-amber-500/10 border-amber-500/30 text-amber-500",
            status === "Punched Out" && "bg-muted/40 border-border text-muted-foreground"
          )}>
            {status === "Punched Out" && <LogOut className="w-8 h-8" />}
            {status === "Punched In" && <Clock className="w-8 h-8" />}
            {status === "On Break" && <Coffee className="w-8 h-8" />}
          </div>

          <div>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
              Current Status (IST)
            </p>
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                {status === "Punched In" && (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                  </>
                )}
                {status === "On Break" && (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                  </>
                )}
                {status === "Punched Out" && (
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-muted-foreground/60"></span>
                )}
              </span>
              <h2 className={cn("text-2xl font-black tracking-tight",
                status === "Punched In" && "text-primary",
                status === "On Break" && "text-amber-500",
                status === "Punched Out" && "text-muted-foreground"
              )}>
                {status}
              </h2>
            </div>
            {status === "On Break" && breakStartTime && (
              <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 mt-0.5">
                On Break since {breakStartTime}
              </p>
            )}
          </div>
        </div>

        {/* Timers & Times in IST */}
        <div className="flex flex-1 items-center justify-around px-4 sm:px-8 border-y md:border-y-0 md:border-x border-border/50 py-4 md:py-0 gap-4">
          <div className="flex flex-col items-center sm:items-start">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">
              Net Work Time
            </p>
            <p className="text-xl sm:text-2xl font-mono font-black text-foreground mt-1">
              {formatStopwatchTime(workSeconds)}
            </p>
            <span className="text-[10px] text-muted-foreground font-semibold">
              Gross Time − Break Time
            </span>
          </div>

          <div className="flex flex-col items-center sm:items-start">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">
              Total Break
            </p>
            <p className="text-xl sm:text-2xl font-mono font-black text-amber-500 mt-1">
              {formatDurationSeconds(breakSeconds)}
            </p>
            <span className="text-[10px] text-muted-foreground font-semibold">
              Excluded from work
            </span>
          </div>

          <div className="hidden lg:flex flex-col gap-1.5 pl-6 border-l border-border/50">
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Punch In</span>
              <span className="text-xs font-bold text-foreground">{punchInTime || "--:--"}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Punch Out</span>
              <span className="text-xs font-bold text-foreground">{punchOutTime || "--:--"}</span>
            </div>
          </div>
        </div>

        {/* Actions (Break In, Break Out & Punch Actions) */}
        <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
          {/* Status: Punched In -> Show Break In & Punch Out */}
          {status === "Punched In" && (
            <>
              <button
                type="button"
                onClick={handleBreakIn}
                disabled={isSubmitting}
                className="flex-1 md:flex-none px-5 py-3 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-60 bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25 border border-amber-500/30"
              >
                <Coffee className="w-4 h-4" /> Break In
              </button>
              <button
                type="button"
                onClick={handlePunchOut}
                disabled={isSubmitting}
                className="flex-1 md:flex-none px-6 py-3 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-md active:scale-95 disabled:opacity-60 bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-destructive/20"
              >
                <LogOut className="w-4 h-4" /> Punch Out
              </button>
            </>
          )}

          {/* Status: On Break -> Show ONLY Break Out */}
          {status === "On Break" && (
            <button
              type="button"
              onClick={handleBreakOut}
              disabled={isSubmitting}
              className="flex-1 md:flex-none px-6 py-3 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-60 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20"
            >
              <CheckCircle2 className="w-4 h-4" /> Break Out
            </button>
          )}

          {/* Status: Punched Out -> Show ONLY Punch In */}
          {status === "Punched Out" && (
            <button
              type="button"
              onClick={handlePunchIn}
              disabled={isSubmitting}
              className="flex-1 md:flex-none px-6 py-3 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-md active:scale-95 disabled:opacity-60 bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20"
            >
              <LogIn className="w-4 h-4" /> Punch In
            </button>
          )}
        </div>
      </div>

      {/* Mandatory Blocking Pending Punch-Out Modal */}
      <PendingPunchOutModal
        isOpen={isPendingModalOpen}
        employeeId={employeeId}
        pendingRecord={pendingRecord}
        onResolved={handlePendingResolved}
      />
    </>
  );
}
