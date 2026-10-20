import { useEffect, useState } from "react";
import { KeyRound, Loader2, Lock, Pencil, Save, ShieldCheck, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useAuth } from "@/components/auth/AuthContext";
import { isUserAdmin } from "@/lib/permissions";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";

type LockSettings = { configured: boolean; email: string | null };
// view: current email + Change | edit: new email + Save | otp: OTP from the current email
type Step = "view" | "edit" | "otp";

const INPUT = "w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50";
const LABEL = "block text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-wide";
const PRIMARY_BTN = "px-4 py-2 font-bold text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-50";
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// Hidden on purpose: only opens for admins with Ctrl + Shift + F
export function FinanceOtpDialog() {
  const { user } = useAuth();
  const isAdmin = isUserAdmin(user);
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<LockSettings | null>(null);
  const [step, setStep] = useState<Step>("view");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.code === "KeyF") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isAdmin]);

  useEffect(() => {
    if (!open) return;
    setCurrent(null);
    setEmail("");
    setOtp("");
    api
      .get<LockSettings>("/finance-lock/settings")
      .then((res) => {
        setCurrent(res);
        setStep(res.configured ? "view" : "edit");
      })
      .catch(() => setOpen(false));
  }, [open]);

  const saveEmail = async (code?: string) => {
    setBusy(true);
    try {
      const res = await api.put<LockSettings>("/finance-lock/settings", { otp_email: email.trim(), otp: code ?? null });
      setCurrent(res);
      setOtp("");
      toast.success(`Finance email updated to ${res.email}`);
      setOpen(false);
    } catch {
      setOtp("");
    } finally {
      setBusy(false);
    }
  };

  const sendChangeOtp = async () => {
    setBusy(true);
    try {
      await api.post("/finance-lock/change-otp");
      setOtp("");
      setStep("otp");
      toast.success(`OTP sent to ${current?.email}`);
    } catch {
      /* api shows error toast */
    } finally {
      setBusy(false);
    }
  };

  // Save: first-time setup saves directly; changing an existing email needs an OTP from it
  const onSave = () => {
    const value = email.trim();
    if (!isEmail(value)) {
      toast.error("Please enter a valid email");
      return;
    }
    if (value.toLowerCase() === current?.email) {
      toast.error("This is already the finance email");
      return;
    }
    if (current?.configured) sendChangeOtp();
    else saveEmail();
  };

  if (!isAdmin) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-[calc(100vw-16px)] sm:w-full sm:max-w-md max-h-[90dvh] flex flex-col p-0 overflow-hidden rounded-2xl sm:rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
        <div className="p-4 border-b border-border/50 flex justify-between items-center bg-primary/5">
          <h3 className="font-black text-lg text-foreground flex items-center gap-2"><Lock className="w-4 h-4 text-primary" /> Finance Email</h3>
          <button onClick={() => setOpen(false)} className="p-2 hover:bg-muted rounded-full transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          {!current ? (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : step === "view" ? (
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border/50 bg-muted/30">
              <span className="font-bold text-sm text-foreground break-all">{current.email}</span>
              <button onClick={() => { setEmail(""); setStep("edit"); }} className="shrink-0 px-3 py-1.5 text-xs font-bold border border-border/50 rounded-lg bg-background hover:bg-muted transition-colors flex items-center gap-1.5">
                <Pencil className="w-3.5 h-3.5" /> Change
              </button>
            </div>
          ) : step === "edit" ? (
            <div>
              <label className={LABEL}>{current.configured ? "New Email" : "Email"}</label>
              <input type="email" autoFocus placeholder="e.g. owner@company.com" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onSave()} className={INPUT} />
            </div>
          ) : (
            <div>
              <label className={LABEL}>OTP</label>
              <div className="relative flex items-center">
                <KeyRound className="w-4 h-4 text-muted-foreground absolute left-3.5" />
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  autoFocus
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => e.key === "Enter" && otp.length === 6 && saveEmail(otp)}
                  placeholder="123456"
                  className="w-full pl-10 pr-4 py-2.5 tracking-widest text-center text-lg font-bold bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Sent to {current.email}.{" "}
                <button type="button" onClick={sendChangeOtp} disabled={busy} className="font-bold text-primary hover:underline disabled:opacity-50">Resend</button>
              </p>
            </div>
          )}
        </div>

        {current && step !== "view" && (
          <div className="px-4 sm:px-6 py-4 border-t border-border/50 flex justify-end gap-3">
            {current.configured && (
              <button onClick={() => { setStep("view"); setOtp(""); }} className="px-4 py-2 font-bold text-sm bg-background border border-border/50 rounded-lg hover:bg-muted transition-colors">Cancel</button>
            )}
            {step === "edit" ? (
              <button onClick={onSave} disabled={busy || !email.trim()} className={PRIMARY_BTN}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
              </button>
            ) : (
              <button onClick={() => saveEmail(otp)} disabled={busy || otp.length < 6} className={PRIMARY_BTN}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} Verify & Change
              </button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
