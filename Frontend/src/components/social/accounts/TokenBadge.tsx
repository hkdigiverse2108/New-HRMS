import React from "react";
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw } from "lucide-react";

interface TokenBadgeProps {
  hasToken: boolean;
  daysSinceRefresh?: number | null | undefined;
  lastRefreshStatus?: string | null | undefined;
}

export const TokenBadge: React.FC<TokenBadgeProps> = ({
  hasToken,
  daysSinceRefresh,
  lastRefreshStatus,
}) => {
  if (!hasToken) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20">
        <XCircle className="w-3.5 h-3.5" />
        No Token
      </span>
    );
  }

  const days = daysSinceRefresh ?? 0;

  if (lastRefreshStatus && lastRefreshStatus !== "ok") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20">
        <AlertTriangle className="w-3.5 h-3.5" />
        Refresh Failed ({days}d)
      </span>
    );
  }

  if (days >= 60) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20">
        <XCircle className="w-3.5 h-3.5" />
        Expired ({days}d)
      </span>
    );
  }

  if (days >= 50) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
        <AlertTriangle className="w-3.5 h-3.5" />
        Expiring Soon ({days}d)
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
      <CheckCircle2 className="w-3.5 h-3.5" />
      Healthy ({days}d)
    </span>
  );
};
