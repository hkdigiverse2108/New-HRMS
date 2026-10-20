import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { KeyRound, Loader2, Lock, RotateCcw, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { getFinanceUnlockedUntil, unlockFinance } from "./financeUnlock";

// Unlock is kept in ./financeUnlock: it survives moving between Finance pages and is
// cleared when the user leaves Finance (routes/index.tsx) or refreshes the page.
const RESEND_SECONDS = 30;

type LockStatus = { enabled: boolean; email: string | null; unlock_minutes: number };

export function FinanceOtpGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LockStatus | null>(null);
  const [unlockedUntil, setUnlockedUntil] = useState(getFinanceUnlockedUntil);
  const [now, setNow] = useState(Date.now());
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const autoSent = useRef(false);

  useEffect(() => {
    api
      .get<LockStatus>("/finance-lock/status")
      .then(setStatus)
      .catch(() => setStatus({ enabled: true, email: null, unlock_minutes: 30 }));
  }, []);

  // Re-lock when the unlock window runs out, and count down the resend timer
  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now());
      setResendIn((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const sendOtp = async () => {
    setSending(true);
    try {
      const res = await api.post<{ email: string }>("/finance-lock/request-otp");
      setSentTo(res.email);
      setOtp("");
      setResendIn(RESEND_SECONDS);
      toast.success(`OTP sent to ${res.email}`);
    } catch {
      /* api shows error toast */
    } finally {
      setSending(false);
    }
  };

  const verifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    if (otp.length < 6) return;
    setVerifying(true);
    try {
      const res = await api.post<{ unlock_minutes: number }>("/finance-lock/verify-otp", { otp });
      const until = Date.now() + (res.unlock_minutes || 30) * 60_000;
      unlockFinance(until);
      setUnlockedUntil(until);
      setNow(Date.now());
      setSentTo(null);
      setOtp("");
      toast.success("Finance unlocked");
    } catch {
      setOtp("");
    } finally {
      setVerifying(false);
    }
  };

  const locked = !!status?.enabled && unlockedUntil <= now;

  // Send the OTP as soon as the lock shows
  useEffect(() => {
    if (!locked || autoSent.current) return;
    autoSent.current = true;
    sendOtp();
  }, [locked]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lock again after the unlock window: next time a fresh OTP is sent
  useEffect(() => {
    if (!locked) autoSent.current = false;
  }, [locked]);

  if (!status) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!locked) return <>{children}</>;

  return (
    <div className="flex items-center justify-center py-16 px-4">
      <div className="w-full max-w-md bg-card border border-border/50 rounded-3xl shadow-sm p-6 sm:p-8">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-black text-foreground">Finance is Locked</h2>
        </div>

        {!sentTo ? (
          <button
            onClick={sendOtp}
            disabled={sending}
            className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-50"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
            {sending ? "Sending OTP..." : "Try Again"}
          </button>
        ) : (
          <form onSubmit={verifyOtp} className="space-y-4">
            <div className="relative flex items-center">
              <KeyRound className="w-4 h-4 text-muted-foreground absolute left-3.5" />
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                maxLength={6}
                autoFocus
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                className="w-full pl-10 pr-4 py-2.5 tracking-widest text-center text-lg font-bold bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <button
              type="submit"
              disabled={verifying || otp.length < 6}
              className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-50"
            >
              {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Verify & Open
            </button>
            <button
              type="button"
              onClick={sendOtp}
              disabled={sending || resendIn > 0}
              className="w-full text-xs font-bold text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:hover:text-muted-foreground"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {resendIn > 0 ? `Resend OTP in ${resendIn}s` : "Resend OTP"}
            </button>
          </form>
        )}

        <p className="text-[11px] text-muted-foreground text-center mt-5">
          OTP is valid for 5 minutes. Finance stays open for {status.unlock_minutes} minutes while you stay in Finance.
        </p>
      </div>
    </div>
  );
}
