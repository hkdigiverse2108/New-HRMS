import { useState, useEffect } from "react";
import { Sparkles, Trophy, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { CollapsibleSection } from "./CollapsibleSection";
import { SpotlightEditor, SpotlightEmployee } from "./SpotlightEditor";
import { BADGE_PRESETS } from "./spotlight-constants";
import { useDashboardOverview } from "@/hooks/useDashboardOverview";
import { useAuth } from "@/components/auth/AuthContext";
import { isUserAdmin } from "@/lib/permissions";
import { api } from "@/lib/api";

export function EmployeePerformance() {
  const { user } = useAuth();
  const canManageSpotlight = isUserAdmin(user);
  const [currentSpotlight, setCurrentSpotlight] = useState(0);
  const [spotlights, setSpotlightsState] = useState<SpotlightEmployee[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<any>("/dashboard/spotlights", { showErrorToast: false });
        if (!cancelled && res?.spotlights && Array.isArray(res.spotlights)) {
          setSpotlightsState(res.spotlights);
          return;
        }
      } catch {
        // No hardcoded fallback: spotlight is driven by the previous month's Employee of the Month
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const setSpotlights = async (data: SpotlightEmployee[]) => {
    setSpotlightsState(data);
    setCurrentSpotlight(0);
    try {
      await api.put("/dashboard/spotlights", { spotlights: data }, { showErrorToast: false });
      const res = await api.get<any>("/dashboard/spotlights", { showErrorToast: false });
      if (res?.spotlights && Array.isArray(res.spotlights)) setSpotlightsState(res.spotlights);
    } catch (err) {
      console.warn("Failed to persist spotlights to DB:", err);
    }
  };

  useEffect(() => {
    if (spotlights.length === 0) return;
    const timer = setInterval(() => {
      setCurrentSpotlight((prev) => (prev + 1) % spotlights.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [spotlights.length]);

  const spotlight = spotlights[currentSpotlight] || spotlights[0];

  const { data } = useDashboardOverview();
  // Both lists come from the previous month's Employee-of-the-Month result (backend decides the month)
  const topWinners: any[] = data?.top_performers || [];
  const needsAttentionList: any[] = data?.needs_attention || [];
  const eomLabel: string = data?.performance_period?.label || "";

  return (
    <div className="mb-12">
      <CollapsibleSection section="Section 03" title="Employee Performance">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
        {/* Top 5 Performers — live EOM */}
        <div className="bg-white border border-border/60 rounded-3xl p-6 shadow-sm min-w-0">
          <div className="mb-4">
            <h3 className="font-bold text-foreground">Top 5 Performers</h3>
            <p className="text-[11px] text-muted-foreground">
              {eomLabel ? `Employee of the Month • ${eomLabel}` : "Employee of the Month wise"}
            </p>
          </div>
          {topWinners.length === 0 ? (
            <p className="text-xs font-semibold text-muted-foreground/60 border border-dashed border-border/40 rounded-2xl px-3 py-6 text-center">
              {eomLabel ? `No Employee of the Month result for ${eomLabel} yet.` : "No Employee of the Month result yet."}
            </p>
          ) : (
          <div className="space-y-3">
            {topWinners.map((emp: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-muted/50 border border-border/50">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white font-bold text-[11px] text-muted-foreground shadow-sm shrink-0">
                    {i === 0 ? <Trophy className="h-3 w-3 text-amber-500" /> : emp.rank || i + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-foreground leading-tight truncate">{emp.name || emp.employee_name || "Employee"}</p>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Star className="h-3 w-3 text-amber-500" /> {emp.score ?? emp.score_pct ?? 0}%
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          )}
        </div>

        {/* Spotlight Carousel */}
        <div 
          className={cn(
            "rounded-3xl p-6 shadow-sm relative overflow-hidden flex flex-col justify-between transition-all duration-500 group", 
            !(spotlight && 'image' in spotlight && spotlight.image) && "bg-primary"
          )}
          style={(spotlight && 'image' in spotlight && spotlight.image) ? {
            backgroundImage: `url(${spotlight.image})`,
            backgroundSize: "cover",
            backgroundPosition: "center"
          } : undefined}
        >
          {canManageSpotlight && (
            <SpotlightEditor spotlights={spotlights} setSpotlights={setSpotlights} />
          )}
          
          {(spotlight && 'image' in spotlight && spotlight.image) && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10 z-0" />
          )}
          <div className="absolute top-0 right-0 p-4 opacity-10 z-0">
            <Sparkles className={cn("h-32 w-32", (spotlight && 'image' in spotlight && spotlight.image) ? "text-white" : "")} />
          </div>
          <div className="relative z-10 h-full flex flex-col justify-between">
            <h3 className={cn("text-xs font-bold uppercase tracking-wider mb-6 flex items-center justify-between", (spotlight && 'image' in spotlight && spotlight.image) ? "text-white/80" : "text-white/70")}>
              Spotlight
              <div className="flex gap-1">
                {spotlights.map((_, i) => (
                  <div key={i} className={cn("h-1 rounded-full transition-all duration-300", 
                    i === currentSpotlight 
                      ? ((spotlight && 'image' in spotlight && spotlight.image) ? "w-3 bg-white" : "w-3 bg-primary-foreground") 
                      : ((spotlight && 'image' in spotlight && spotlight.image) ? "w-1 bg-white/30" : "w-1 bg-primary-foreground/30")
                  )} />
                ))}
              </div>
            </h3>
            <div className="min-h-[80px] relative">
              {spotlight && 'image' in spotlight && spotlight.image && (
                <div 
                  key={`avatar-${spotlight.name}`}
                  className="w-12 h-12 mb-4 rounded-full relative animate-in fade-in zoom-in duration-500 shadow-xl"
                >
                  {spotlight.ringStyle && spotlight.ringStyle !== "none" && (
                    <div className={cn("absolute -inset-[5px] rounded-full shadow-sm -z-10", BADGE_PRESETS[spotlight.ringStyle]?.class)}></div>
                  )}
                  <div className="w-full h-full rounded-full bg-primary flex items-center justify-center relative z-10 overflow-hidden border-2 border-white/20">
                    <img src={spotlight.image} alt={spotlight.name} className="w-full h-full object-cover" />
                  </div>
                </div>
              )}
              <p className={cn("text-2xl sm:text-3xl font-black mb-1 break-words leading-tight animate-in fade-in slide-in-from-right-4 duration-500", (spotlight && 'image' in spotlight && spotlight.image) ? "text-white" : "text-white")} key={`name-${spotlight?.name}`}>
                {spotlight?.name || "No spotlight yet"}
              </p>
              <p className={cn("text-sm animate-in fade-in slide-in-from-right-4 duration-500 delay-75", (spotlight && 'image' in spotlight && spotlight.image) ? "text-white/80" : "text-white/80")} key={`role-${spotlight?.role}`}>
                {spotlight?.role}
              </p>
            </div>
          </div>
        </div>

        {/* Third Column: Needs Attention (same — Audio PDF) */}
        <div className="flex flex-col gap-6">
          {/* Needs Attention */}
          <div className="bg-white border border-border/60 rounded-3xl p-6 shadow-sm">
            <h3 className="font-bold text-foreground">Needs Attention</h3>
            <p className="text-[11px] text-muted-foreground mb-6">
              {eomLabel ? `Lowest 3 • Employee of the Month • ${eomLabel}` : "Lowest 3 • Employee of the Month"}
            </p>
            {needsAttentionList.length === 0 && (
              <p className="text-xs font-semibold text-muted-foreground/60 border border-dashed border-border/40 rounded-2xl px-3 py-6 text-center">
                No data for {eomLabel || "last month"} yet.
              </p>
            )}
            <div className="space-y-6">
              {needsAttentionList.map((emp, i) => (
                <div key={i}>
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-[14px] text-foreground font-bold">{emp.name}</p>
                    <p className="text-[12px] text-rose-500 font-bold">{emp.score}%</p>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mb-1">
                    <div 
                      className="h-full bg-rose-500 rounded-full" 
                      style={{ width: `${emp.score}%` }}
                    ></div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{emp.dept}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}
