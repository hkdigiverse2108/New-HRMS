import React, { useState } from "react";
import { useAuth } from "./AuthContext";
import { Lock, Mail, Loader2, ArrowRight, ShieldCheck, KeyRound, ArrowLeft, RefreshCw, X } from "lucide-react";
import { PasswordInput } from "@/components/ui/password-input";

export const LoginModal: React.FC<{ isOpen: boolean; onClose?: () => void }> = ({ isOpen, onClose }) => {
  const { login, verifyOtp } = useAuth();
  const [email, setEmail] = useState("admin@hrms.com");
  const [password, setPassword] = useState("Password@123");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  if (!isOpen) return null;

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsSubmitting(true);
    const result = await login(email, password);
    setIsSubmitting(false);

    if (result.success) {
      setStep("otp");
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !otp) return;

    setIsSubmitting(true);
    const success = await verifyOtp(email, otp.trim());
    setIsSubmitting(false);

    if (success && onClose) {
      onClose();
    }
  };

  const handleResendOtp = async () => {
    setIsResending(true);
    await login(email, password);
    setIsResending(false);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md bg-card border border-border/80 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 shadow-inner">
            {step === "credentials" ? (
              <ShieldCheck className="w-6 h-6 text-primary" />
            ) : (
              <KeyRound className="w-6 h-6 text-primary" />
            )}
          </div>
          <h2 className="text-2xl font-black text-foreground">
            {step === "credentials" ? "Sign In to HRMS" : "Enter Verification OTP"}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {step === "credentials"
              ? "Enter your credentials to manage organization records"
              : `We sent a 6-digit OTP code to ${email}`}
          </p>
        </div>

        {step === "credentials" ? (
          <form onSubmit={handleCredentialsSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground/80 uppercase tracking-wider">Work Email</label>
              <div className="relative flex items-center">
                <Mail className="w-4 h-4 text-muted-foreground absolute left-3.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-muted/40 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground/80 uppercase tracking-wider">Password</label>
              <PasswordInput
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                leftIcon={<Lock className="w-4 h-4 text-muted-foreground" />}
                className="bg-muted/40 border-border rounded-xl focus:ring-primary/30 font-medium"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-primary/20 transition-all active:scale-95 mt-6 cursor-pointer"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Send Verification OTP</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleOtpSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground/80 uppercase tracking-wider">6-Digit OTP</label>
              <div className="relative flex items-center">
                <KeyRound className="w-4 h-4 text-muted-foreground absolute left-3.5" />
                <input
                  type="text"
                  required
                  maxLength={6}
                  autoFocus
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  className="w-full pl-10 pr-4 py-2.5 tracking-widest text-center text-lg font-bold bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || otp.length < 6}
              className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-primary/20 transition-all active:scale-95 mt-6 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Verify & Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="flex items-center justify-between pt-2 text-xs">
              <button
                type="button"
                onClick={() => setStep("credentials")}
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground font-medium"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              <button
                type="button"
                disabled={isResending}
                onClick={handleResendOtp}
                className="flex items-center gap-1 text-primary hover:underline font-semibold disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isResending ? "animate-spin" : ""}`} />
                <span>Resend OTP</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
