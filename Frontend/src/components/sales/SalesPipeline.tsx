import { useMemo, useState } from "react";
import { Search, Plus, Filter, LayoutGrid, Table2, Clock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatCurrency, type Lead, type LeadStage } from "./sales-data";
import { useSales } from "./SalesContext";
import { SearchableSelect } from "@/components/ui/select";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableHeader } from "@/components/ui/sortable-header";

/* ─── Kanban Card ──────────────────────────────────────────────────────── */

function DealCard({ lead }: { lead: Lead }) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("leadId", lead.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className="cursor-grab active:cursor-grabbing rounded-xl border border-border bg-white p-3 shadow-sm transition-all hover:border-emerald-300 hover:shadow-md"
    >
      <p className="text-sm font-semibold leading-snug">{lead.company}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{lead.contact} · {lead.city}</p>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{lead.owner}</span>
        <span className="text-xs font-bold text-emerald-700">{formatCurrency(lead.budget)}</span>
      </div>
    </div>
  );
}

/* ─── Kanban Column ────────────────────────────────────────────────────── */

function KanbanColumn({ stage, color, items, onDropCard }: { stage: string; color: string; items: Lead[]; onDropCard: (id: string, stage: string) => void }) {
  const total = items.reduce((s, l) => s + l.budget, 0);
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
        {items.map((lead) => (
          <DealCard key={lead.id} lead={lead} />
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
    <div className="overflow-x-auto rounded-2xl border border-border">
      <table className="w-full text-sm">
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
              <td className="px-4 py-3 text-muted-foreground">{lead.contact} · {lead.city}</td>
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
              <td className="px-4 py-3 text-muted-foreground">{lead.owner}</td>
              <td className="px-4 py-3 text-right font-semibold">{formatCurrency(lead.budget)}</td>
              <td className="px-4 py-3 text-center">
                <span className={cn(
                  "inline-flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold",
                  lead.aiScore >= 80 ? "bg-emerald-100 text-emerald-700" : lead.aiScore >= 50 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700",
                )}>
                  {lead.aiScore}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Timeline View ────────────────────────────────────────────────────── */

function TimelineView({ data }: { data: Lead[] }) {
  const sorted = useMemo(() => [...data].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [data]);

  return (
    <div className="space-y-0">
      {sorted.slice(0, 20).map((lead, i) => (
        <div key={lead.id} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="h-3 w-3 rounded-full bg-emerald-500" />
            {i < sorted.length - 1 && <div className="w-px flex-1 bg-border" />}
          </div>
          <div className="pb-6">
            <p className="text-xs text-muted-foreground">{lead.createdAt}</p>
            <p className="mt-0.5 text-sm font-semibold">{lead.company}</p>
            <p className="text-xs text-muted-foreground">{lead.contact} · {lead.city} · {lead.stage} · {formatCurrency(lead.budget)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Main Pipeline Component ──────────────────────────────────────────── */

export function SalesPipeline({ onAction }: { onAction?: (action: string) => void }) {
  const { leads, setLeads, stages } = useSales();
  const [view, setView] = useState<"kanban" | "table" | "timeline">("kanban");
  const [search, setSearch] = useState("");

  const handleStageChange = (id: string, newStage: string) => {
    setLeads(leads.map(l => l.id === id ? { ...l, stage: newStage } : l));
    toast.success("Stage updated", { description: `Lead moved to ${newStage}` });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter(
      (l) =>
        l.company.toLowerCase().includes(q) ||
        l.contact.toLowerCase().includes(q) ||
        l.owner.toLowerCase().includes(q),
    );
  }, [search, leads]);

  // Calculate active stages (union of settings stages + any stage that currently has leads)
  const activeStages = useMemo(() => {
    const leadStages = Array.from(new Set(leads.map(l => l.stage)));
    const allStages = [...stages];
    for (const ls of leadStages) {
      if (!allStages.includes(ls)) allStages.push(ls);
    }
    return allStages;
  }, [stages, leads]);

  const grouped = useMemo(() => {
    const map: Record<string, Lead[]> = {};
    for (const s of activeStages) map[s] = [];
    for (const l of filtered) {
      if (!map[l.stage]) {
        map[l.stage] = [];
      }
      map[l.stage]!.push(l);
    }
    return map;
  }, [filtered, activeStages]);

  const totalValue = filtered.reduce((s, l) => s + l.budget, 0);

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
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search deals…"
            className="h-10 w-full max-w-sm rounded-xl border border-border bg-background pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
        </div>

        <div className="flex rounded-xl border border-border bg-muted/40 p-0.5">
          {([
            ["kanban", LayoutGrid, "Kanban"],
            ["table", Table2, "Table"],
            ["timeline", Clock, "Timeline"],
          ] as const).map(([v, Icon, label]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                view === v ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        <button onClick={() => onAction?.("Add Lead")} className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700">
          <Plus className="h-4 w-4" /> Add Deal
        </button>
      </div>

      {/* Content */}
      {view === "kanban" && (
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
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
