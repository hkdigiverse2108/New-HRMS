import { Award, TrendingDown, Phone, Clock, CheckCircle2, XCircle, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { teamMembers, formatCurrency } from "./sales-data";

function MemberCard({ member }: { member: (typeof teamMembers)[0] }) {
  const pct = Math.round((member.achieved / member.target) * 100);
  const isTop = pct >= 100;
  const isLow = pct < 60;

  const metrics = [
    { label: "Assigned", value: member.assigned },
    { label: "Contacted", value: member.contacted },
    { label: "Meetings", value: member.meetings },
    { label: "Demos", value: member.demos },
    { label: "Proposals", value: member.proposals },
    { label: "Won / Lost", value: `${member.won} / ${member.lost}` },
    { label: "Collection", value: formatCurrency(member.collection) },
    { label: "Conversion", value: `${member.conversionRate}%` },
    { label: "Follow-up done", value: `${member.followUpDone}%` },
    { label: "Avg response", value: `${member.avgResponse} min` },
  ];

  return (
    <div className={cn(
      "rounded-2xl border bg-card p-5 transition-shadow hover:shadow-lg",
      isTop ? "border-emerald-200" : isLow ? "border-rose-200" : "border-border",
    )}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className={cn(
          "grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-black",
          isTop ? "bg-emerald-100 text-emerald-700" : isLow ? "bg-rose-100 text-rose-700" : "bg-blue-100 text-blue-700",
        )}>
          {member.avatar}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{member.name}</p>
          <p className="text-[11px] text-muted-foreground">{member.role} · {member.region}</p>
        </div>
        {isTop && <Award className="h-5 w-5 text-amber-500" />}
      </div>

      {/* Progress */}
      <div className="mt-4">
        <div className="flex items-end justify-between">
          <span className="text-xs text-muted-foreground">Target achievement</span>
          <span className={cn("text-lg font-black", isTop ? "text-emerald-600" : isLow ? "text-rose-600" : "text-foreground")}>
            {pct}%
          </span>
        </div>
        <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted/50">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-700",
              isTop ? "bg-emerald-500" : isLow ? "bg-rose-500" : "bg-blue-500",
            )}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          <span>{formatCurrency(member.achieved)}</span>
          <span>of {formatCurrency(member.target)}</span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5">
        {metrics.map((m) => (
          <div key={m.label} className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">{m.label}</span>
            <span className="text-xs font-semibold">{m.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SalesTeamPerformance({ onAction }: { onAction?: (action: string) => void }) {
  const sorted = [...teamMembers].sort((a, b) => (b.achieved / b.target) - (a.achieved / a.target));
  const top = sorted[0];
  const bottom = sorted[sorted.length - 1];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Employee Performance</h1>
          <p className="text-sm text-muted-foreground">Leaderboard, scorecards and follow-up discipline across the sales org</p>
        </div>
        <button onClick={() => onAction?.("Export Excel")} className="flex items-center gap-1.5 self-start rounded-xl border border-border bg-white px-4 py-2 text-sm font-semibold transition-colors hover:bg-accent hover:text-emerald-700">
          <Download className="h-4 w-4" /> Export Report
        </button>
      </div>

      {/* Top & Bottom Highlights */}
      <div className="grid gap-4 sm:grid-cols-2">
        {top && (
          <div className="flex items-center gap-4 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white p-5">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-emerald-100">
              <Award className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">Top Performer</p>
              <p className="text-lg font-black">{top.name}</p>
              <p className="text-xs text-muted-foreground">{Math.round((top.achieved / top.target) * 100)}% of target · {formatCurrency(top.achieved)}</p>
            </div>
          </div>
        )}

        {bottom && (
          <div className="flex items-center gap-4 rounded-2xl border border-rose-200 bg-gradient-to-r from-rose-50 to-white p-5">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-rose-100">
              <TrendingDown className="h-6 w-6 text-rose-600" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-rose-600">Needs Support</p>
              <p className="text-lg font-black">{bottom.name}</p>
              <p className="text-xs text-muted-foreground">{Math.round((bottom.achieved / bottom.target) * 100)}% of target · {formatCurrency(bottom.achieved)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Leaderboard */}
      <div>
        <h2 className="mb-4 text-lg font-bold">Leaderboard</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sorted.map((member) => (
            <MemberCard key={member.name} member={member} />
          ))}
        </div>
      </div>
    </div>
  );
}
