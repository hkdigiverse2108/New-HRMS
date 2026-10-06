import { useMemo, useState } from "react";
import { Plus, LayoutGrid, Table2, Clock } from "lucide-react";
import { SearchInput } from "@/components/common/SearchInput";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { formatCurrency, type Lead } from "./sales-data";
import { useSales } from "./SalesContext";
import { SearchableSelect } from "@/components/ui/select";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableHeader } from "@/components/ui/sortable-header";

/* ─── Kanban Card ──────────────────────────────────────────────────────── */

function leadAmount(l: any): number {
  if (Number(l.budget)) return Number(l.budget);
  const ei = parseFloat(String(l.expectedIncome ?? l.expected_income ?? "").replace(/[^0-9.]/g, ""));
  if (ei) return ei;
  if (Number(l.dealValue ?? l.deal_value)) return Number(l.dealValue ?? l.deal_value);
  return 0;
}

function DealCard({ lead }: { lead: any }) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("leadId", lead.id || lead._id || "");
        e.dataTransfer.effectAllowed = "move";
      }}
      className="cursor-grab active:cursor-grabbing rounded-xl border border-border bg-white p-3 shadow-sm transition-all hover:border-emerald-300 hover:shadow-md"
    >
      <p className="text-sm font-semibold leading-snug">{lead.company}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{lead.contact} · {lead.city || ""}</p>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{lead.owner || ""}</span>
        <span className="text-xs font-bold text-emerald-700">{formatCurrency(leadAmount(lead))}</span>
      </div>
    </div>
  );
}

/* ─── Kanban Column ────────────────────────────────────────────────────── */

function KanbanColumn({ stage, color, items, onDropCard }: { stage: string; color: string; items: Lead[]; onDropCard: (id: string, stage: string) => void }) {
  const total = items.reduce((s, l) => s + leadAmount(l), 0);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDrop={(e) => {
        e.preventDefault();
        const leadId = e.dataTransfer.getData("leadId");
        if (leadId) {
          onDropCard(leadId, stage);
        }
      }}
      className="flex w-[260px] shrink-0 flex-col rounded-2xl border border-border bg-muted/30 transition-colors hover:bg-muted/50"
    >
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-sm font-bold">{stage}</span>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold">{items.length}</span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3" style={{ maxHeight: "calc(100vh - 320px)" }}>
        {items.map((lead: any) => (
          <DealCard key={lead.id || lead._id} lead={lead} />
        ))}
        {items.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">No deals</p>
        )}
      </div>
      <div className="border-t border-border px-4 py-2">
        <p className="text-[10px] font-bold uppercase text-muted-foreground">
          Total: {formatCurrency(total)}
        </p>
      </div>
    </div>
  );
}

/* ─── Table View ───────────────────────────────────────────────────────── */

function TableView({ data, onStageChange, activeStages }: { data: Lead[]; onStageChange: (id: string, stage: string) => void; activeStages: string[] }) {
  const { stages } = useSales();
  const stageColor: Record<string, string> = {
    "New Lead": "bg-primary/10 text-primary",
    Contacted: "bg-violet-100 text-violet-700",
    Meeting: "bg-blue-100 text-blue-700",
    Demo: "bg-cyan-100 text-cyan-700",
    Proposal: "bg-amber-100 text-amber-700",
    Negotiation: "bg-orange-100 text-orange-700",
    Won: "bg-emerald-100 text-emerald-700",
    Lost: "bg-rose-100 text-rose-700",
  };

  const { items: sortedData, requestSort, sortConfig } = useSortableData(data);

  return (
    <div className="overflow-x-auto min-w-0 rounded-2xl border border-border">
      <table className="w-full text-sm min-w-[700px]">
        <thead>
          <tr className="border-b border-border bg-muted/50 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <SortableHeader label="Company" sortKey="company" currentSort={sortConfig} onSort={requestSort} className="px-4 py-3" />
            <SortableHeader label="Contact" sortKey="contact" currentSort={sortConfig} onSort={requestSort} className="px-4 py-3" />
            <SortableHeader label="Stage" sortKey="stage" currentSort={sortConfig} onSort={requestSort} className="px-4 py-3" />
            <SortableHeader label="Owner" sortKey="owner" currentSort={sortConfig} onSort={requestSort} className="px-4 py-3" />
            <SortableHeader label="Budget" sortKey="budget" currentSort={sortConfig} onSort={requestSort} className="px-4 py-3 text-right" />
            <SortableHeader label="AI Score" sortKey="aiScore" currentSort={sortConfig} onSort={requestSort} className="px-4 py-3 text-center" />
          </tr>
        </thead>
        <tbody>
          {sortedData.map((lead) => (
            <tr key={lead.id} className="border-b border-border transition-colors hover:bg-accent/50">
              <td className="px-4 py-3 font-medium">{lead.company}</td>
              <td className="px-4 py-3 text-muted-foreground">{lead.contact} · {lead.city || ""}</td>
              <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                <SearchableSelect
                  value={lead.stage}
                  onChange={(val) => onStageChange(lead.id, val)}
                  options={Array.from(new Set([...stages, lead.stage])).map((s) => ({ label: s, value: s }))}
                  className={cn(
                    "w-[120px] h-[30px] px-2 text-[10px] font-semibold",
                    stageColor[lead.stage] || "bg-emerald-100 text-emerald-700"
                  )}
                />
              </td>
              <td className="px-4 py-3 text-muted-foreground">{lead.owner || ""}</td>
              <td className="px-4 py-3 text-right font-semibold">{formatCurrency(leadAmount(lead))}</td>
              <td className="px-4 py-3 text-center">
                <span className={cn(
                  "inline-flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold",
                  (lead.aiScore ?? 0) >= 80 ? "bg-emerald-100 text-emerald-700" : (lead.aiScore ?? 0) >= 50 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700",
                )}>
                  {lead.aiScore ?? "—"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Timeline View — per-lead stage-shift history + follow-ups ─────────── */

function TimelineView({ data }: { data: Lead[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const sorted = useMemo(
    () => [...data].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")),
    [data]
  );

  const getHistory = (lead: any) => lead.stage_history || lead.stageHistory || [];
  const getFollowUps = (lead: any) => lead.followUps || lead.follow_ups || [];

  return (
    <div className="space-y-2">
      {sorted.slice(0, 50).map((lead: any) => {
        const lid = lead.id || lead._id;
        const history = getHistory(lead);
        const fus = getFollowUps(lead);
        const isOpen = expandedId === lid;
        return (
          <div key={lid} className="rounded-xl border border-border bg-background overflow-hidden">
            <button onClick={() => setExpandedId(isOpen ? null : lid)} className="w-full flex items-center gap-3 p-3.5 text-left hover:bg-muted/40 transition-colors">
              <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-700 grid place-items-center text-xs font-black shrink-0">
                {(lead.company || lead.contact || "L").slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold truncate">{lead.company || lead.contact} <span className="text-[11px] font-semibold text-muted-foreground">· {lead.contact !== lead.company ? lead.contact : ""} {lead.phone ? `· ${lead.phone}` : ""}</span></p>
                <p className="text-[11px] text-muted-foreground">Current: <span className="font-bold text-foreground">{lead.stage || lead.status}</span> · {history.length} shifts · {fus.length} follow-ups · Owner: {lead.owner || "—"}</p>
              </div>
              <span className="text-[11px] font-bold text-emerald-700">{isOpen ? "Hide ▲" : "History ▼"}</span>
            </button>
            {isOpen && (
              <div className="border-t border-border bg-muted/20 p-4">
                <div className="space-y-0">
                  {history.length === 0 && (
                    <p className="text-xs text-muted-foreground italic pb-3">Created in {lead.stage || lead.status} on {lead.createdAt || lead.date || "—"}</p>
                  )}
                  {history.map((h: any, i: number) => (
                    <div key={i} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={cn("h-3 w-3 rounded-full mt-1", i === history.length - 1 ? "bg-emerald-500" : "bg-blue-400")} />
                        {i < history.length - 1 + fus.length && <div className="w-px flex-1 bg-border min-h-[14px]" />}
                      </div>
                      <div className="pb-4">
                        <p className="text-[11px] text-muted-foreground">{h.changed_at ? String(h.changed_at).slice(0, 16).replace("T", " ") : "—"} · by {h.changed_by || "System"}</p>
                        <p className="mt-0.5 text-[13px] font-semibold">
                          {h.from_stage ? <><span className="text-muted-foreground line-through">{h.from_stage}</span><span className="mx-1.5 text-emerald-600">→</span></> : <span className="text-[10px] font-bold uppercase text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded mr-1.5">Created</span>}
                          <span className="text-foreground">{h.to_stage}</span>
                        </p>
                        {h.reason && <p className="text-[11px] text-muted-foreground italic">Reason: {h.reason}</p>}
                      </div>
                    </div>
                  ))}
                  {fus.map((f: any, i: number) => (
                    <div key={`fu-${i}`} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="h-2.5 w-2.5 rounded-full bg-amber-400 mt-1" />
                        {i < fus.length - 1 && <div className="w-px flex-1 bg-border min-h-[12px]" />}
                      </div>
                      <div className="pb-3">
                        <p className="text-[11px] text-muted-foreground">{String(f.date || "").slice(0, 16).replace("T", " ")} · {f.action_type || f.actionType || "Follow-up"} · by {f.performedBy || lead.owner || "Rep"}</p>
                        <p className="text-xs">💬 {f.note}</p>
                        {(f.nextFollowUpDate || f.next_follow_up_date) && <p className="text-[11px] text-emerald-700 font-semibold">Next: {String(f.nextFollowUpDate || f.next_follow_up_date).slice(0, 16).replace("T", " ")}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
      {sorted.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">No leads for selected filters.</p>}
    </div>
  );
}

/* ─── Main Pipeline Component ──────────────────────────────────────────── */

export function SalesPipeline({ onAction }: { onAction?: (action: string) => void }) {
  const { leads, stages, updateLead, salesSettings } = useSales();
  const [view, setView] = useState<"kanban" | "table" | "timeline">("kanban");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "this_month" | "last_month">("all");

  const availableCategories = useMemo(() => {
    const fromSettings = (salesSettings?.categories || []).map((c: any) => c.name).filter(Boolean);
    return fromSettings.length > 0 ? fromSettings : Array.from(new Set(leads.map((l: any) => l.category || "Others")));
  }, [salesSettings, leads]);
  const availableSources = useMemo(() => {
    const fromSettings = salesSettings?.sources || [];
    return fromSettings.length > 0 ? fromSettings : Array.from(new Set(leads.map((l: any) => l.source || "Others")));
  }, [salesSettings, leads]);

  const handleStageChange = async (id: string, newStage: string) => {
    const updated = await updateLead(id, { stage: newStage, status: newStage } as any);
    if (updated) {
      toast.success("Stage updated", { description: `Lead moved to ${newStage}` });
    } else {
      toast.error("Failed to move stage");
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const todayStr = new Date().toISOString().split("T")[0] || "";
    const thisMonth = todayStr.slice(0, 7);
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    const prevMonth = (d.toISOString().split("T")[0] || "").slice(0, 7);
    return leads.filter((l: any) => {
      if (q && !((l.company || "").toLowerCase().includes(q) || (l.contact || "").toLowerCase().includes(q) || (l.owner || "").toLowerCase().includes(q) || (l.phone || "").includes(q))) return false;
      if (categoryFilter !== "all" && (l.category || "Others") !== categoryFilter) return false;
      if (sourceFilter !== "all" && String(l.source || "").toLowerCase() !== String(sourceFilter).toLowerCase()) return false;
      if (dateFilter !== "all") {
        const lDate = (l.date || (l.createdAt ? String(l.createdAt).split("T")[0] : "") || "") as string;
        if (dateFilter === "today" && lDate !== todayStr) return false;
        if (dateFilter === "this_month" && !lDate.startsWith(thisMonth)) return false;
        if (dateFilter === "last_month" && !lDate.startsWith(prevMonth)) return false;
      }
      return true;
    });
  }, [search, leads, categoryFilter, sourceFilter, dateFilter]);

  // Active stages = settings order; unknown/legacy lead stages fall back to first stage (no junk columns)
  const activeStages = useMemo(() => {
    return stages.filter(Boolean);
  }, [stages]);

  const grouped = useMemo(() => {
    const map: Record<string, Lead[]> = {};
    for (const s of activeStages) map[s] = [];
    const fallback = activeStages[0] || "New Lead";
    for (const l of filtered) {
      const key = (l.stage && activeStages.includes(l.stage)) ? l.stage : fallback;
      if (!map[key]) {
        map[key] = [];
      }
      map[key]!.push(l);
    }
    return map;
  }, [filtered, activeStages]);

  const totalValue = filtered.reduce((s, l) => s + leadAmount(l), 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Sales Pipeline</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {filtered.length} open opportunities · {formatCurrency(totalValue)} weighted pipeline value
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
        <div className="flex-1 max-w-sm">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search deals…"
            className="w-full"
          />
        </div>

        <div className="flex rounded-xl border border-border bg-muted/40 p-0.5 self-start sm:self-auto overflow-x-auto">
          {([
            ["kanban", LayoutGrid, "Kanban"],
            ["table", Table2, "Table"],
            ["timeline", Clock, "Timeline"],
          ] as const).map(([v, Icon, label]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap",
                view === v ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        <button onClick={() => onAction?.("Add Lead")} className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 shrink-0 self-start sm:self-auto">
          <Plus className="h-4 w-4" /> Add Deal
        </button>
      </div>

      {/* Filters — business category / source / date-wise */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="h-9 text-xs font-semibold border border-border rounded-xl px-2.5 bg-background">
          <option value="all">All Categories</option>
          {availableCategories.map((c: string) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="h-9 text-xs font-semibold border border-border rounded-xl px-2.5 bg-background">
          <option value="all">All Sources</option>
          {availableSources.map((s: string) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value as any)} className="h-9 text-xs font-semibold border border-border rounded-xl px-2.5 bg-background">
          <option value="all">All Dates</option>
          <option value="today">Today</option>
          <option value="this_month">This Month</option>
          <option value="last_month">Last Month</option>
        </select>
        {(categoryFilter !== "all" || sourceFilter !== "all" || dateFilter !== "all") && (
          <button onClick={() => { setCategoryFilter("all"); setSourceFilter("all"); setDateFilter("all"); }} className="h-9 px-3 text-xs font-bold rounded-xl border border-border bg-muted/50 hover:bg-muted">Clear</button>
        )}
      </div>

      {/* Content */}
      {view === "kanban" && (
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide touch-pan-x min-w-0">
          {activeStages.map((stage) => {
            // Pick color dynamically if not in original pipelineStages
            const predefinedColor = ["#6366f1", "#8b5cf6", "#3b82f6", "#06b6d4", "#f59e0b", "#f97316", "#10b981", "#f43f5e"];
            const color = predefinedColor[activeStages.indexOf(stage) % predefinedColor.length] || "#6366f1";
            return (
              <KanbanColumn
                key={stage}
                stage={stage}
                color={color}
                items={grouped[stage] || []}
                onDropCard={handleStageChange}
              />
            );
          })}
        </div>
      )}

      {view === "table" && <TableView data={filtered} onStageChange={handleStageChange} activeStages={activeStages} />}

      {view === "timeline" && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <TimelineView data={filtered} />
        </div>
      )}
    </div>
  );
}
