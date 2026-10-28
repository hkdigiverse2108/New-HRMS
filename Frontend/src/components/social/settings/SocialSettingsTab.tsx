import React, { useState, useEffect } from "react";
import {
  Settings2,
  Copy,
  Check,
  ShieldCheck,
  Activity,
  Sparkles,
  Zap,
  Trash2,
  Loader2,
  AlertTriangle,
  Info,
  CheckCircle2,
} from "lucide-react";
import type { SocialSettingsData } from "../types";

interface SocialSettingsTabProps {
  settings: SocialSettingsData | null;
  isLoading: boolean;
  onRefresh: () => Promise<void>;
  onUpdateSettings: (data: Record<string, unknown>) => Promise<void>;
  onTestProvider: (provider: string) => Promise<{ ok: boolean; message: string; latency_ms?: number }>;
  onClearLogs: () => Promise<void>;
}

export const SocialSettingsTab: React.FC<SocialSettingsTabProps> = ({
  settings,
  isLoading,
  onRefresh,
  onUpdateSettings,
  onTestProvider,
  onClearLogs,
}) => {
  const [retentionDays, setRetentionDays] = useState(2);
  const [allowSelfComments, setAllowSelfComments] = useState(false);
  const [pendingTtlMinutes, setPendingTtlMinutes] = useState(10);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Provider test feedback
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<
    Record<string, { ok: boolean; message: string; latency?: number | undefined }>
  >({});

  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  useEffect(() => {
    if (settings) {
      setRetentionDays(settings.retention_days ?? 2);
      setAllowSelfComments(Boolean(settings.allow_self_comments));
      setPendingTtlMinutes(settings.pending_ttl_minutes ?? 10);
    }
  }, [settings]);

  const webhookUrl = typeof window !== "undefined"
    ? `${window.location.origin}/webhooks/meta/instagram`
    : "https://your-domain.com/webhooks/meta/instagram";

  const verifyToken = settings?.config?.META_VERIFY_TOKEN || "hrms_instagram_secret_token_2026";

  const handleCopy = (text: string, type: "webhook" | "token") => {
    navigator.clipboard.writeText(text);
    if (type === "webhook") {
      setCopiedWebhook(true);
      setTimeout(() => setCopiedWebhook(false), 2000);
    } else {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      await onUpdateSettings({
        SOCIAL_LOG_RETENTION_DAYS: retentionDays,
        SOCIAL_ALLOW_SELF_COMMENTS: allowSelfComments,
        pending_ttl_minutes: pendingTtlMinutes,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      await onRefresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestProvider = async (provider: string) => {
    try {
      setTestingProvider(provider);
      const res = await onTestProvider(provider);
      const entry: { ok: boolean; message: string; latency?: number | undefined } = {
        ok: res.ok,
        message: res.message,
        latency: res.latency_ms,
      };
      setTestResults((prev) => ({
        ...prev,
        [provider]: entry,
      }));
    } catch (err: unknown) {
      const errEntry: { ok: boolean; message: string; latency?: number | undefined } = {
        ok: false,
        message: err instanceof Error ? err.message : "Test failed",
      };
      setTestResults((prev) => ({
        ...prev,
        [provider]: errEntry,
      }));
    } finally {
      setTestingProvider(null);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* 1. Meta Webhook Configuration Card */}
      <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-4">
        <div className="flex items-center gap-2.5 pb-2 border-b border-border">
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Meta Webhook Live Endpoint</h3>
            <p className="text-xs text-muted-foreground">
              Configure this exact Callback URL and Verification Token in Meta for Developers
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 pt-2">
          {/* Callback URL */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-muted-foreground">
                Callback URL (GET / POST)
              </label>
              <button
                type="button"
                onClick={() => handleCopy(webhookUrl, "webhook")}
                className="flex items-center gap-1 text-xs text-primary font-semibold hover:underline"
              >
                {copiedWebhook ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedWebhook ? "Copied" : "Copy URL"}
              </button>
            </div>
            <div className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-border bg-muted/40 font-mono text-foreground flex items-center justify-between">
              <span className="truncate">{webhookUrl}</span>
            </div>
          </div>

          {/* Verify Token */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-muted-foreground">
                Verify Token (hub.verify_token)
              </label>
              <button
                type="button"
                onClick={() => handleCopy(verifyToken, "token")}
                className="flex items-center gap-1 text-xs text-primary font-semibold hover:underline"
              >
                {copiedToken ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedToken ? "Copied" : "Copy Token"}
              </button>
            </div>
            <div className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-border bg-muted/40 font-mono text-foreground">
              {verifyToken}
            </div>
          </div>
        </div>

        {/* Security Checklist Notice */}
        <div className="mt-2 p-3.5 rounded-xl bg-muted/30 border border-border/60 text-xs space-y-1.5">
          <div className="font-bold text-foreground flex items-center gap-2">
            <Info className="w-4 h-4 text-primary" />
            Meta Setup Instructions
          </div>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-[11px] leading-relaxed">
            <li>Go to <strong>developers.facebook.com</strong> &gt; Your App &gt; <strong>Instagram &gt; Webhooks</strong>.</li>
            <li>Paste the Callback URL and Verify Token above, then click <strong>Verify and Save</strong>.</li>
            <li>Subscribe to the fields: <code>comments</code> and <code>messaging_postbacks</code>.</li>
            <li>Ensure <strong>META_APP_SECRET</strong> is set in your backend <code>.env</code> to enforce HMAC-SHA256 signature verification.</li>
          </ol>
        </div>
      </div>

      {/* 2. Provider Live Connectivity Tests */}
      <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-4">
        <div className="flex items-center gap-2.5 pb-2 border-b border-border">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">AI & External Providers</h3>
            <p className="text-xs text-muted-foreground">
              Verify live API latency and operational health for LLM models and Instagram Graph API
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          {/* Gemini */}
          <div className="p-4 rounded-xl border border-border bg-muted/20 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-foreground">Google Gemini</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    settings?.config?.GEMINI_API_KEY_SET
                      ? "bg-emerald-500/10 text-emerald-500"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {settings?.config?.GEMINI_API_KEY_SET ? "Configured" : "Missing Key"}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground font-mono">
                Model: {settings?.config?.DEFAULT_GEMINI_MODEL || "gemini-3.1-flash-lite"}
              </p>
              {testResults["gemini"] && (
                <div
                  className={`mt-2 p-2 rounded text-[11px] ${
                    testResults["gemini"].ok
                      ? "bg-emerald-500/10 text-emerald-500"
                      : "bg-rose-500/10 text-rose-500"
                  }`}
                >
                  {testResults["gemini"].message}
                  {testResults["gemini"].latency && ` (${testResults["gemini"].latency}ms)`}
                </div>
              )}
            </div>

            <button
              onClick={() => handleTestProvider("gemini")}
              disabled={testingProvider === "gemini"}
              className="mt-4 w-full py-1.5 text-xs font-semibold rounded-lg border border-border hover:bg-card transition-colors flex items-center justify-center gap-1.5"
            >
              {testingProvider === "gemini" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Test Gemini
            </button>
          </div>

          {/* Groq */}
          <div className="p-4 rounded-xl border border-border bg-muted/20 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-foreground">Groq Fallback</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    settings?.config?.GROQ_API_KEY_1_SET
                      ? "bg-emerald-500/10 text-emerald-500"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {settings?.config?.GROQ_API_KEY_1_SET ? "Configured" : "Missing Key"}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground font-mono">
                Model: {settings?.config?.DEFAULT_GROQ_MODEL || "llama-3.3-70b"}
              </p>
              {testResults["groq"] && (
                <div
                  className={`mt-2 p-2 rounded text-[11px] ${
                    testResults["groq"].ok
                      ? "bg-emerald-500/10 text-emerald-500"
                      : "bg-rose-500/10 text-rose-500"
                  }`}
                >
                  {testResults["groq"].message}
                  {testResults["groq"].latency && ` (${testResults["groq"].latency}ms)`}
                </div>
              )}
            </div>

            <button
              onClick={() => handleTestProvider("groq")}
              disabled={testingProvider === "groq"}
              className="mt-4 w-full py-1.5 text-xs font-semibold rounded-lg border border-border hover:bg-card transition-colors flex items-center justify-center gap-1.5"
            >
              {testingProvider === "groq" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Test Groq
            </button>
          </div>

          {/* Instagram Graph API */}
          <div className="p-4 rounded-xl border border-border bg-muted/20 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-foreground">Instagram Graph</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-500">
                  {settings?.config?.IG_GRAPH_VERSION || "v22.0"}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Live identity and token validation check
              </p>
              {testResults["instagram"] && (
                <div
                  className={`mt-2 p-2 rounded text-[11px] ${
                    testResults["instagram"].ok
                      ? "bg-emerald-500/10 text-emerald-500"
                      : "bg-rose-500/10 text-rose-500"
                  }`}
                >
                  {testResults["instagram"].message}
                  {testResults["instagram"].latency && ` (${testResults["instagram"].latency}ms)`}
                </div>
              )}
            </div>

            <button
              onClick={() => handleTestProvider("instagram")}
              disabled={testingProvider === "instagram"}
              className="mt-4 w-full py-1.5 text-xs font-semibold rounded-lg border border-border hover:bg-card transition-colors flex items-center justify-center gap-1.5"
            >
              {testingProvider === "instagram" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Test Graph API
            </button>
          </div>
        </div>
      </div>

      {/* 3. Automation Parameters Form */}
      <form onSubmit={handleSaveSettings} className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-5">
        <div className="flex items-center gap-2.5 pb-2 border-b border-border">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <Settings2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Automation Rules & Log Retention</h3>
            <p className="text-xs text-muted-foreground">
              Fine-tune operational TTLs, loop prevention, and automatic database cleanup
            </p>
          </div>
        </div>

        {saveSuccess && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-500 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Settings successfully saved and log TTL indexes updated!</span>
          </div>
        )}

        {/* Log Retention Slider */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-foreground">
              Event Log Retention Period: <span className="text-primary font-bold">{retentionDays} Days</span>
            </label>
            <span className="text-[11px] text-muted-foreground">
              Total stored logs: {settings?.log_stats?.total_logs ?? 0}
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="30"
            value={retentionDays}
            onChange={(e) => setRetentionDays(Number(e.target.value))}
            className="w-full accent-primary cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>1 day (Strict lean)</span>
            <span>2 days (Default recommended)</span>
            <span>7 days</span>
            <span>30 days (Audit max)</span>
          </div>
        </div>

        {/* Self-comments toggle */}
        <div className="p-4 rounded-xl border border-border bg-muted/20 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-foreground">Allow Self Comments (Testing Mode)</div>
            <div className="text-[11px] text-muted-foreground">
              When enabled, the bot will trigger even when your own Instagram account comments on its own posts.
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={allowSelfComments}
              onChange={(e) => setAllowSelfComments(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>

        {/* Pending DM TTL */}
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
            Pending Follow-Gate DM Timeout (Minutes)
          </label>
          <input
            type="number"
            min="1"
            max="60"
            value={pendingTtlMinutes}
            onChange={(e) => setPendingTtlMinutes(Number(e.target.value))}
            className="w-full px-3.5 py-2 text-xs rounded-xl border border-border bg-background outline-none font-mono"
          />
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            Save Settings
          </button>
        </div>
      </form>
    </div>
  );
};
