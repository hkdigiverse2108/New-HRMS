import React, { useState } from "react";
import { useAuth } from "./AuthContext";
import { Lock, Mail, Loader2, ArrowRight, ShieldCheck, Building2, KeyRound, ArrowLeft, RefreshCw } from "lucide-react";

export const LoginPage: React.FC = () => {
  const { login, verifyOtp } = useAuth();
  const [email, setEmail] = useState("admin@hrms.com");
  const [password, setPassword] = useState("Password@123");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  // Step 1: Submit email & password to /login
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

  // Step 2: Submit OTP to /verify-otp
  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !otp) return;

    setIsSubmitting(true);
    await verifyOtp(email, otp.trim());
    setIsSubmitting(false);
  };

  // Resend OTP
  const handleResendOtp = async () => {
    setIsResending(true);
    await login(email, password);
    setIsResending(false);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-4 relative overflow-hidden">
      {/* Decorative ambient glows */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/20 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-500/20 rounded-full blur-[128px] pointer-events-none" />

      <div className="w-full max-w-md bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl border border-white/20 dark:border-slate-800/80 rounded-[32px] p-8 sm:p-10 shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-300">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 shadow-inner">
            {step === "credentials" ? (
              <Building2 className="w-8 h-8 text-primary" />
            ) : (
              <KeyRound className="w-8 h-8 text-primary" />
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            {step === "credentials" ? "HK DigiVerse HRMS" : "Enter Verification OTP"}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 font-medium">
            {step === "credentials"
              ? "Sign in to access your organization workspace"
              : `We sent a 6-digit OTP code to ${email}`}
          </p>
        </div>

        {step === "credentials" ? (
          /* Step 1: Work Email & Password -> /login */
          <form onSubmit={handleCredentialsSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Work Email
              </label>
              <div className="relative flex items-center">
                <Mail className="w-4 h-4 text-slate-400 absolute left-4 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@hrms.com"
                  className="w-full pl-11 pr-4 py-3 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Password
                </label>
              </div>
              <div className="relative flex items-center">
                <Lock className="w-4 h-4 text-slate-400 absolute left-4 pointer-events-none" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-4 py-3 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-primary/25 transition-all active:scale-[0.98] cursor-pointer"
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>Send Verification OTP</span>
                    <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* Step 2: 6-Digit OTP -> /verify-otp */
          <form onSubmit={handleOtpSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                6-Digit OTP Code
              </label>
              <div className="relative flex items-center">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-4 pointer-events-none" />
                <input
                  type="text"
                  required
                  maxLength={6}
                  autoFocus
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  className="w-full pl-11 pr-4 py-3 tracking-widest text-center text-lg font-bold bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                />
              </div>
            </div>

            <div className="pt-2 space-y-2">
              <button
                type="submit"
                disabled={isSubmitting || otp.length < 6}
                className="w-full py-3.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-primary/25 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>Verify & Sign In</span>
                    <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                  </>
                )}
              </button>

              <div className="flex items-center justify-between pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => setStep("credentials")}
                  className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-medium transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Login</span>
                </button>

                <button
                  type="button"
                  disabled={isResending}
                  onClick={handleResendOtp}
                  className="flex items-center gap-1.5 text-primary hover:underline font-semibold transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isResending ? "animate-spin" : ""}`} />
                  <span>Resend OTP</span>
                </button>
              </div>
            </div>
          </form>
        )}

        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] text-slate-500 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Secure 2FA OTP Authentication</span>
          </div>
        </div>
      </div>
    </div>
  );
};
