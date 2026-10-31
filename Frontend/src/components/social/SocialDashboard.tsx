import React from "react";
import {
  Instagram,
  Sparkles,
  MessageSquare,
  Clock,
  Building2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Plus,
  Play,
  ArrowRight,
  TrendingUp,
  Activity,
  ShieldCheck,
} from "lucide-react";
import type { SocialOverviewData } from "./types";

interface SocialDashboardProps {
  overview: SocialOverviewData | null;
  onNavigateTab: (tab: string) => void;
}

export const SocialDashboard: React.FC<SocialDashboardProps> = ({
  overview,
  onNavigateTab,
}) => {
  const summary24 = overview?.summary_24h || {};
  const total24Hits = Object.values(summary24).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: Connected Profiles */}
        <div
          onClick={() => onNavigateTab("accounts")}
          className="p-5 rounded-2xl border border-border bg-card/60 backdrop-blur-sm shadow-sm hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Connected Profiles
            </span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500 group-hover:scale-110 transition-transform">
              <Instagram className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-foreground">
              {overview?.active_accounts ?? 0}
            </span>
            <span className="text-xs text-muted-foreground font-medium">
              / {overview?.total_accounts ?? 0} active
            </span>
          </div>
          <div className="mt-2 text-[11px] text-emerald-500 font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Responding in real-time</span>
          </div>
        </div>

        {/* Card 2: Comment-to-DM Rules */}
        <div
          onClick={() => onNavigateTab("keywords")}
          className="p-5 rounded-2xl border border-border bg-card/60 backdrop-blur-sm shadow-sm hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Automation Rules
            </span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500 group-hover:scale-110 transition-transform">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-foreground">
              {overview?.active_keywords ?? 0}
            </span>
            <span className="text-xs text-muted-foreground font-medium">
              / {overview?.total_keywords ?? 0} rules
            </span>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1">
            <span>Exact match with rotating replies</span>
          </div>
        </div>

        {/* Card 3: Pending Follow-Gate DMs */}
        <div
          onClick={() => onNavigateTab("activity")}
          className="p-5 rounded-2xl border border-border bg-card/60 backdrop-blur-sm shadow-sm hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Pending Follow-Gate
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 group-hover:scale-110 transition-transform">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-foreground">
              {overview?.pending_dms ?? 0}
            </span>
            <span className="text-xs text-muted-foreground font-medium">held DMs</span>
          </div>
          <div className="mt-2 text-[11px] text-amber-500 font-semibold flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Awaiting follow button tap</span>
          </div>
        </div>

        {/* Card 4: Brand Voice Profiles */}
        <div
          onClick={() => onNavigateTab("brands")}
          className="p-5 rounded-2xl border border-border bg-card/60 backdrop-blur-sm shadow-sm hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Brand Profiles
            </span>
            <div className="p-2 rounded-xl bg-pink-500/10 text-pink-500 group-hover:scale-110 transition-transform">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-foreground">
              {overview?.total_brands ?? 0}
            </span>
            <span className="text-xs text-muted-foreground font-medium">brands</span>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1">
            <span>Configured guidelines & forbidden words</span>
          </div>
        </div>
      </div>

      {/* Quick Launch Shortcuts */}
      <div className="p-4 sm:p-6 rounded-2xl border border-border bg-card shadow-sm space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Quick Launch Shortcuts
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <button
            onClick={() => onNavigateTab("accounts")}
            className="p-3.5 rounded-xl border border-border hover:border-primary/40 hover:bg-muted/30 transition-all text-left flex items-center gap-3 group"
          >
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-500 group-hover:scale-105 transition-transform">
              <Instagram className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">Connect Account</div>
              <div className="text-[11px] text-muted-foreground">Link Instagram token</div>
            </div>
          </button>

          <button
            onClick={() => onNavigateTab("keywords")}
            className="p-3.5 rounded-xl border border-border hover:border-primary/40 hover:bg-muted/30 transition-all text-left flex items-center gap-3 group"
          >
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-500 group-hover:scale-105 transition-transform">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">Add Keyword Rule</div>
              <div className="text-[11px] text-muted-foreground">Comment to DM trigger</div>
            </div>
          </button>

          <button
            onClick={() => onNavigateTab("scripts")}
            className="p-3.5 rounded-xl border border-border hover:border-primary/40 hover:bg-muted/30 transition-all text-left flex items-center gap-3 group"
          >
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 group-hover:scale-105 transition-transform">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">Viral Reel Script</div>
              <div className="text-[11px] text-muted-foreground">30s / 60s / 90s writer</div>
            </div>
          </button>

          <button
            onClick={() => onNavigateTab("captions")}
            className="p-3.5 rounded-xl border border-border hover:border-primary/40 hover:bg-muted/30 transition-all text-left flex items-center gap-3 group"
          >
            <div className="p-2.5 rounded-xl bg-pink-500/10 text-pink-500 group-hover:scale-105 transition-transform">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">Captions & SEO</div>
              <div className="text-[11px] text-muted-foreground">A/B/D + 30 hashtags</div>
            </div>
          </button>
        </div>
      </div>

      {/* Recent Activity Live Stream */}
      <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-border">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Recent Live Events & Automation Stream
            </h4>
          </div>
          <button
            onClick={() => onNavigateTab("activity")}
            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
          >
            View all logs <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {(!overview?.recent_events || overview.recent_events.length === 0) ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            No events recorded in this period yet. When users comment on connected posts, events will appear here in real-time.
          </div>
        ) : (
          <div className="space-y-2">
            {overview.recent_events.slice(0, 6).map((evt) => {
              const isErr = evt.level === "error" || evt.status === "error";
              const isWarn = evt.level === "warn";

              return (
                <div
                  key={evt.id}
                  className="p-3 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/40 transition-colors flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-2 h-2 shrink-0 rounded-full ${
                        isErr ? "bg-rose-500" : isWarn ? "bg-amber-500" : "bg-emerald-500"
                      }`}
                    />
                    <div className="min-w-0 break-words">
                      <span className="font-bold text-foreground mr-2">{evt.type}</span>
                      <span className="text-muted-foreground text-[11px]">{evt.message}</span>
                    </div>
                  </div>

                  <span className="font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                    {new Date(evt.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
