import React, { useState } from "react";
import { useAuth } from "./AuthContext";
import {
  Lock,
  Mail,
  Loader2,
  ArrowRight,
  ShieldCheck,
  KeyRound,
  ArrowLeft,
  RefreshCw,
  Users,
  CalendarDays,
  Receipt,
  TrendingUp,
  HelpCircle,
  X,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { PasswordInput } from "@/components/ui/password-input";

export const LoginPage: React.FC = () => {
  const { login, verifyOtp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Step 1: Submit email & password to /login
  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setErrorMessage("Please enter both your email address and password.");
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);
    const result = await login(cleanEmail, password);
    setIsSubmitting(false);

    if (result.success) {
      setErrorMessage(null);
      setStep("otp");
    } else {
      setErrorMessage(result.message || "Invalid email or password. Please try again.");
    }
  };

  // Step 2: Submit OTP to /verify-otp
  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    const cleanOtp = otp.trim();
    if (!cleanEmail || !cleanOtp) {
      setErrorMessage("Please enter the 6-digit verification code.");
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);
    const result = await verifyOtp(cleanEmail, cleanOtp);
    setIsSubmitting(false);

    if (result.success) {
      if (typeof window !== "undefined") {
        window.location.href = "/";
      }
    } else {
      setErrorMessage(result.message || "Invalid verification code. Please check and try again.");
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) return;
    setErrorMessage(null);
    setIsResending(true);
    const res = await login(cleanEmail, password);
    setIsResending(false);
    if (!res.success) {
      setErrorMessage(res.message || "Failed to resend OTP");
    }
  };

  return (
    <div className="w-full min-h-screen flex flex-col md:flex-row bg-white dark:bg-slate-900 relative selection:bg-emerald-500 selection:text-white overflow-x-hidden">
      
      {/* ========================================================================= */}
      {/* LEFT SIDE: Full-Screen Edge-to-Edge Visual Showcase Panel                 */}
      {/* Visible on Tablet, Laptop, Laptop L, 4K | Hidden on Mobile                 */}
      {/* ========================================================================= */}
      <div className="hidden md:flex md:w-[45%] lg:w-[48%] xl:w-[50%] min-h-screen bg-gradient-to-br from-emerald-950 via-teal-900 to-emerald-800 text-white p-8 sm:p-10 lg:p-12 xl:p-16 2xl:p-20 relative overflow-hidden flex-col justify-between">
        
        {/* 3D Decorative Floating Elements & Diagonal Pills */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Diagonal Capsule 1 */}
          <div className="absolute -top-16 right-16 w-28 lg:w-36 h-80 lg:h-96 rounded-full bg-gradient-to-b from-white/20 via-emerald-300/15 to-transparent rotate-[38deg] backdrop-blur-[1px] border border-white/10" />
          {/* Diagonal Capsule 2 */}
          <div className="absolute top-44 -right-12 w-32 lg:w-40 h-96 lg:h-[450px] rounded-full bg-gradient-to-b from-emerald-400/25 via-teal-400/15 to-transparent rotate-[38deg] backdrop-blur-[1px] border border-white/10" />
          
          {/* 3D Orb 1 (Top Right) */}
          <div className="absolute top-16 lg:top-20 right-16 lg:right-24 w-20 lg:w-28 h-20 lg:h-28 rounded-full bg-[radial-gradient(circle_at_30%_30%,#a7f3d0,#10b981_45%,#064e3b_90%)] shadow-2xl shadow-black/50 border border-white/20" />
          
          {/* 3D Orb 2 (Bottom Center) */}
          <div className="absolute -bottom-10 left-1/4 lg:left-1/3 w-36 lg:w-44 h-36 lg:h-44 rounded-full bg-[radial-gradient(circle_at_35%_35%,#6ee7b7,#059669_48%,#022c22_92%)] shadow-2xl shadow-black/60 border border-white/20" />
          
          {/* Ambient inner sheen */}
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-t from-black/40 via-transparent to-white/5 pointer-events-none" />
        </div>

        {/* Top Brand Header */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex items-center gap-3">
            {/* Stylized HK Monogram Logo */}
            <div className="w-11 lg:w-13 h-11 lg:h-13 rounded-2xl bg-white flex items-center justify-center shadow-lg shadow-black/25 shrink-0 p-1">
              <svg viewBox="0 0 40 40" className="w-8 lg:w-9 h-8 lg:h-9" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Left H vertical */}
                <rect x="6" y="8" width="5.5" height="24" rx="2.5" fill="#047857" />
                {/* Right H vertical */}
                <rect x="17.5" y="8" width="5.5" height="24" rx="2.5" fill="#047857" />
                {/* H bridge */}
                <rect x="10" y="17.5" width="9" height="5" rx="1.5" fill="#047857" />
                {/* K upper diagonal with energetic amber accent */}
                <path d="M22 20L29.5 10.5C30.2 9.6 31.6 9.8 32.1 10.8L32.2 11C32.7 11.9 32.4 13.1 31.5 13.8L25.5 20.5" stroke="#f59e0b" strokeWidth="4.5" strokeLinecap="round" />
                {/* K lower diagonal */}
                <path d="M23 19.5L31.5 30C32.3 31 31.6 32 30.5 32H29C28.2 32 27.5 31.5 27 30.8L21 21.5" stroke="#059669" strokeWidth="4.5" strokeLinecap="round" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-xl lg:text-3xl font-black tracking-tight text-white leading-none">
                HK DigiVerse
              </span>
              <span className="text-[10px] lg:text-xs font-bold tracking-[0.25em] text-emerald-300 uppercase mt-1">
                H R M S
              </span>
            </div>
          </div>
        </div>

        {/* Middle Typography & Pillars */}
        <div className="relative z-10 my-auto py-8">
          {/* Bold 3-line Hero Words */}
          <div className="space-y-1">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-black tracking-tight text-white leading-[1.05] drop-shadow-sm">
              People
            </h1>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-black tracking-tight text-white leading-[1.05] drop-shadow-sm">
              Power
            </h1>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-black tracking-tight text-emerald-300 leading-[1.05] drop-shadow-sm">
              Progress
            </h1>
          </div>

          <p className="text-sm lg:text-base font-medium text-emerald-100/90 mt-4 tracking-wide">
            Manage <span className="text-emerald-400 font-bold">•</span> Track <span className="text-emerald-400 font-bold">•</span> Grow Together
          </p>

          {/* Accent Divider Bar */}
          <div className="w-14 h-1.5 bg-emerald-400 rounded-full my-5" />

          <p className="text-[10px] lg:text-xs font-semibold tracking-[0.2em] text-emerald-200/80 uppercase">
            A Smart HRMS for a Stronger Tomorrow
          </p>

          {/* 4 Feature Pills / Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 lg:gap-3 mt-7 max-w-lg">
            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-3 flex flex-col items-center justify-center text-center gap-1.5 transition-all hover:bg-white/15 hover:scale-105 duration-200">
              <Users className="w-5 h-5 text-emerald-300" />
              <span className="text-xs font-semibold text-white">People</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-3 flex flex-col items-center justify-center text-center gap-1.5 transition-all hover:bg-white/15 hover:scale-105 duration-200">
              <CalendarDays className="w-5 h-5 text-emerald-300" />
              <span className="text-xs font-semibold text-white">Attendance</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-3 flex flex-col items-center justify-center text-center gap-1.5 transition-all hover:bg-white/15 hover:scale-105 duration-200">
              <Receipt className="w-5 h-5 text-emerald-300" />
              <span className="text-xs font-semibold text-white">Payroll</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-3 flex flex-col items-center justify-center text-center gap-1.5 transition-all hover:bg-white/15 hover:scale-105 duration-200">
              <TrendingUp className="w-5 h-5 text-emerald-300" />
              <span className="text-xs font-semibold text-white">Growth</span>
            </div>
          </div>
        </div>

        {/* Bottom Signature / Tagline */}
        <div className="relative z-10 pt-2">
          <p className="font-serif italic text-white/90 text-base lg:text-xl tracking-wide flex items-center gap-2">
            <span>Together We Build Better</span>
            <Sparkles className="w-4 h-4 text-amber-400 inline shrink-0" />
          </p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* RIGHT SIDE: Full-Screen Interactive Login Panel (Clean White / Dark Surface)*/}
      {/* ========================================================================= */}
      <div className="w-full md:w-[55%] lg:w-[52%] xl:w-[50%] min-h-screen flex flex-col justify-between p-6 sm:p-10 lg:p-12 xl:p-16 2xl:p-24 bg-white dark:bg-slate-900 relative">
        
        {/* Inner Centered Form Container */}
        <div className="w-full max-w-md lg:max-w-lg mx-auto my-auto flex-1 flex flex-col justify-center py-6 sm:py-8">
          
          {/* MOBILE ONLY BRAND HEADER (Only shown on mobile < md: 320px, 375px, 425px) */}
          <div className="md:hidden flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center shadow-md shadow-emerald-700/20 shrink-0 p-1">
              <svg viewBox="0 0 40 40" className="w-7 h-7" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="6" y="8" width="5.5" height="24" rx="2.5" fill="#ffffff" />
                <rect x="17.5" y="8" width="5.5" height="24" rx="2.5" fill="#ffffff" />
                <rect x="10" y="17.5" width="9" height="5" rx="1.5" fill="#ffffff" />
                <path d="M22 20L29.5 10.5C30.2 9.6 31.6 9.8 32.1 10.8L32.2 11C32.7 11.9 32.4 13.1 31.5 13.8L25.5 20.5" stroke="#f59e0b" strokeWidth="4.5" strokeLinecap="round" />
                <path d="M23 19.5L31.5 30C32.3 31 31.6 32 30.5 32H29C28.2 32 27.5 31.5 27 30.8L21 21.5" stroke="#ffffff" strokeWidth="4.5" strokeLinecap="round" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-black tracking-tight text-slate-900 dark:text-white leading-none">
                HK DigiVerse
              </span>
              <span className="text-[10px] font-bold tracking-[0.22em] text-emerald-600 dark:text-emerald-400 uppercase mt-0.5">
                HRMS WORKSPACE
              </span>
            </div>
          </div>

          {/* Top Sub-Header Tagline */}
          <div className="flex items-center justify-between text-[10px] sm:text-xs font-semibold tracking-wider sm:tracking-widest text-slate-400 dark:text-slate-500 uppercase mb-5 sm:mb-7 lg:mb-9">
            <span className="truncate pr-2">Employees &nbsp;|&nbsp; Team &nbsp;|&nbsp; A Better Tomorrow</span>
            <div className="w-8 h-1 bg-emerald-600 rounded-full shrink-0" />
          </div>

          {/* Welcome Heading */}
          <div className="mb-6 sm:mb-8">
            <span className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Welcome to
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-slate-900 dark:text-white mt-1 leading-tight">
              HK DigiVerse{" "}
              <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
                HRMS
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2 font-medium leading-relaxed">
              {step === "credentials"
                ? "Login to manage your work, attendance, and more."
                : `We sent a 6-digit verification code to ${email}`}
            </p>
          </div>

          {/* STEP 1: EMAIL & PASSWORD FORM */}
          {step === "credentials" ? (
            <form onSubmit={handleCredentialsSubmit} className="space-y-4 sm:space-y-5">
              {/* Email Input */}
              <div className="space-y-1.5">
                <div className="relative flex items-center">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-4 pointer-events-none" />
                  <input
                    type="email"
                    name="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="Enter your email"
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <PasswordInput
                  name="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="Enter your password"
                  leftIcon={<Lock className="w-4 h-4 text-slate-400" />}
                  className="py-3 bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 rounded-2xl focus:ring-emerald-500/20 focus:border-emerald-500 font-medium text-sm text-slate-900 dark:text-white placeholder:text-slate-400"
                />
              </div>

              {/* Direct Inline Error Alert */}
              {errorMessage && (
                <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs font-semibold animate-in fade-in slide-in-from-top-1 duration-200">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                  <span className="flex-1 leading-snug">{errorMessage}</span>
                  <button
                    type="button"
                    onClick={() => setErrorMessage(null)}
                    className="text-red-400 hover:text-red-600 transition-colors p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Main Login Button */}
              <div className="pt-1">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:opacity-95 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-75 text-sm sm:text-base"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <span>Login</span>
                      <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                    </>
                  )}
                </button>
              </div>

              {/* Forgot Password Link */}
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-xs sm:text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
                >
                  Forgot Password?
                </button>
              </div>
            </form>
          ) : (
            /* STEP 2: 6-DIGIT OTP VERIFICATION FORM */
            <form onSubmit={handleOtpSubmit} className="space-y-4 sm:space-y-5 animate-in fade-in duration-200">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  6-Digit Verification OTP
                </label>
                <div className="relative flex items-center">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-4 pointer-events-none" />
                  <input
                    type="text"
                    required
                    maxLength={6}
                    autoFocus
                    value={otp}
                    onChange={(e) => {
                      setOtp(e.target.value.replace(/\D/g, ""));
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="• • • • • •"
                    className="w-full pl-11 pr-4 py-3 tracking-[0.35em] text-center text-lg font-bold bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Direct Inline Error Alert for OTP */}
              {errorMessage && (
                <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs font-semibold animate-in fade-in slide-in-from-top-1 duration-200">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                  <span className="flex-1 leading-snug">{errorMessage}</span>
                  <button
                    type="button"
                    onClick={() => setErrorMessage(null)}
                    className="text-red-400 hover:text-red-600 transition-colors p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="pt-1 space-y-3">
                <button
                  type="submit"
                  disabled={isSubmitting || otp.length < 6}
                  className="w-full py-3.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:opacity-95 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 text-sm sm:text-base"
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

                <div className="flex items-center justify-between pt-1 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage(null);
                      setStep("credentials");
                    }}
                    className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-medium transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Login</span>
                  </button>

                  <button
                    type="button"
                    disabled={isResending}
                    onClick={handleResendOtp}
                    className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 hover:underline font-semibold transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isResending ? "animate-spin" : ""}`} />
                    <span>Resend OTP</span>
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Bottom Contact HR Information & 2FA Badge */}
        <div className="w-full max-w-md lg:max-w-lg mx-auto pt-6 border-t border-slate-100 dark:border-slate-800 text-center space-y-2">
          <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
            If you want account access so contact
          </p>
          <div>
            <a
              href="mailto:hr@hkdigiverse.com"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
            >
              <Mail className="w-3.5 h-3.5 shrink-0" />
              <span className="break-all">hr@hkdigiverse.com</span>
            </a>
          </div>

          <div className="pt-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Secure 2FA OTP Authentication</span>
            </div>
          </div>
        </div>

      </div>

      {/* Forgot Password Information Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 relative">
            <button
              onClick={() => setShowForgotModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center mb-4 text-emerald-600">
              <HelpCircle className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Password Reset Assistance
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              For security reasons, password resets and account credentials are managed directly by your organization's HR administrator.
            </p>

            <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/80 text-xs">
              <span className="text-slate-500 font-medium">Contact HR Desk:</span>
              <a
                href="mailto:hr@hkdigiverse.com"
                className="block font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 hover:underline break-all"
              >
                hr@hkdigiverse.com
              </a>
            </div>

            <button
              onClick={() => setShowForgotModal(false)}
              className="w-full mt-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors"
            >
              Got it, close
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
