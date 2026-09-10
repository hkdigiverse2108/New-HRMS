import { useMemo, useState, useEffect } from "react";
import { Search, Plus, Filter, Download, MoreVertical, X, Calendar, Phone, Mail, MessageSquare } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatCurrency, type Lead, type LeadStage } from "./sales-data";
import { useSales } from "./SalesContext";
import { SearchableSelect } from "@/components/ui/select";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableHeader } from "@/components/ui/sortable-header";

const stageColors: Record<string, string> = {
  "New Lead": "bg-primary/10 text-primary",
  Contacted: "bg-violet-100 text-violet-700",
  Meeting: "bg-blue-100 text-blue-700",
  Demo: "bg-cyan-100 text-cyan-700",
  Proposal: "bg-amber-100 text-amber-700",
  Negotiation: "bg-orange-100 text-orange-700",
  Won: "bg-emerald-100 text-emerald-700",
  Lost: "bg-rose-100 text-rose-700",
};

const priorityColors: Record<string, string> = {
  High: "bg-rose-100 text-rose-700",
  Medium: "bg-amber-100 text-amber-700",
  Low: "bg-blue-100 text-blue-700",
};

export function SalesLeads({ onAction, isNew }: { onAction?: (action: string) => void, isNew?: boolean }) {
  const { leads, setLeads, stages } = useSales();
  const [tab, setTab] = useState<"all" | "my">("all");
  const [stageFilter, setStageFilter] = useState<LeadStage | "All">("All");
  const [search, setSearch] = useState("");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  useEffect(() => {
    if (isNew) {
      onAction?.("Add Lead");
    }
  }, [isNew, onAction]);

  const handleStageChange = (id: string, newStage: string) => {
    setLeads(leads.map(l => l.id === id ? { ...l, stage: newStage } : l));
    toast.success("Stage updated", { description: `Lead moved to ${newStage}` });
  };

  const filtered = useMemo(() => {
    let result = leads;
    if (tab === "my") result = result.filter((l) => l.owner === "Riya Mehta");
    if (stageFilter !== "All") result = result.filter((l) => l.stage === stageFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (l) =>
          l.company.toLowerCase().includes(q) ||
          l.contact.toLowerCase().includes(q) ||
          l.city.toLowerCase().includes(q) ||
          l.owner.toLowerCase().includes(q),
      );
    }
    return result;
  }, [tab, stageFilter, search, leads]);

  // Calculate active stages (union of settings stages + any stage that currently has leads)
  const activeStages = useMemo(() => {
    const leadStages = Array.from(new Set(leads.map(l => l.stage)));
    const all = [...stages];
    for (const ls of leadStages) {
      if (!all.includes(ls)) all.push(ls);
    }
    return all;
  }, [stages, leads]);

  const allStages = useMemo(() => ["All", ...activeStages], [activeStages]);

  const stageCounts = useMemo(() => {
    const base = tab === "my" ? leads.filter((l) => l.owner === "Riya Mehta") : leads;
    const counts: Record<string, number> = { All: base.length };
    for (const s of activeStages) counts[s] = 0;
    for (const l of base) counts[l.stage] = (counts[l.stage] || 0) + 1;
    return counts;
  }, [tab, leads, activeStages]);

  const { items: sortedLeads, requestSort, sortConfig } = useSortableData(filtered);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">All Leads</h1>
          <p className="text-sm text-muted-foreground">
            CEO, Admin and Sales Head can view the entire company database
          </p>
        </div>
        <div className="flex gap-2 self-start">
          <button onClick={() => onAction?.("Import CSV")} className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-semibold transition-colors hover:bg-accent">
            Import CSV
          </button>
          <button onClick={() => onAction?.("Add Lead")} className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700">
            <Plus className="h-4 w-4" /> Add Lead
          </button>
        </div>
      </div>

      {/* Tab Toggle */}
      <div className="flex rounded-xl border border-border bg-muted/40 p-0.5 w-fit">
        {(["all", "my"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors",
              tab === t ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t === "all" ? "All Leads" : "My Leads"}
          </button>
        ))}
      </div>

      {/* Stage Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {allStages.map((stage) => (
          <button
            key={stage}
            onClick={() => setStageFilter(stage)}
            className={cn(
              "flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-colors",
              stageFilter === stage
                ? "bg-emerald-600 text-white"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {stage}
            <span className={cn(
              "ml-0.5 rounded-full px-1.5 text-[10px]",
              stageFilter === stage ? "bg-white/20" : "bg-background",
            )}>
              {stageCounts[stage] || 0}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search leads…"
          className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <SortableHeader label="Company" sortKey="company" currentSort={sortConfig} onSort={requestSort} className="px-4 py-3" />
              <SortableHeader label="Category" sortKey="category" currentSort={sortConfig} onSort={requestSort} className="px-4 py-3" />
              <SortableHeader label="Source" sortKey="source" currentSort={sortConfig} onSort={requestSort} className="px-4 py-3" />
              <SortableHeader label="Stage" sortKey="stage" currentSort={sortConfig} onSort={requestSort} className="px-4 py-3" />
              <SortableHeader label="Owner" sortKey="owner" currentSort={sortConfig} onSort={requestSort} className="px-4 py-3" />
              <SortableHeader label="Priority" sortKey="priority" currentSort={sortConfig} onSort={requestSort} className="px-4 py-3" />
              <SortableHeader label="Budget" sortKey="budget" currentSort={sortConfig} onSort={requestSort} className="px-4 py-3 text-right" />
              <SortableHeader label="Next Follow-up" sortKey="nextFollowUp" currentSort={sortConfig} onSort={requestSort} className="px-4 py-3" />
              <SortableHeader label="AI" sortKey="aiScore" currentSort={sortConfig} onSort={requestSort} className="px-4 py-3 text-center" />
            </tr>
          </thead>
          <tbody>
            {sortedLeads.map((lead) => (
              <tr
                key={lead.id}
                onClick={() => setSelectedLead(lead)}
                className="cursor-pointer border-b border-border transition-colors hover:bg-accent/50"
              >
                <td className="px-4 py-3">
                  <p className="font-medium">{lead.company}</p>
                  <p className="text-[11px] text-muted-foreground">{lead.contact} · {lead.city}, {lead.state}</p>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{lead.category}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{lead.source}</td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <SearchableSelect
                    value={lead.stage}
                    onChange={(val) => handleStageChange(lead.id, val)}
                    options={Array.from(new Set([...stages, lead.stage])).map((s) => ({ label: s, value: s }))}
                    className={cn(
                      "w-[120px] h-[30px] px-2 text-[10px] font-semibold",
                      stageColors[lead.stage] || "bg-emerald-100 text-emerald-700"
                    )}
                  />
                </td>
                <td className="px-4 py-3 text-xs">{lead.owner}</td>
                <td className="px-4 py-3">
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", priorityColors[lead.priority])}>
                    {lead.priority}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-xs font-semibold">{formatCurrency(lead.budget)}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{lead.nextFollowUp || "—"}</td>
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
        {filtered.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">No leads found</p>
        )}
      </div>

      {/* Count */}
      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {leads.length} leads
      </p>

      {/* Side Drawer */}
      <Sheet open={selectedLead !== null} onOpenChange={(open) => !open && setSelectedLead(null)}>
        <SheetContent className="w-full max-w-md p-6 overflow-y-auto bg-background border-l border-border [&>button]:hidden shadow-2xl">
          <button onClick={() => setSelectedLead(null)} className="absolute right-4 top-4 rounded-lg p-1 hover:bg-accent z-10">
            <X className="h-5 w-5" />
          </button>
          {selectedLead && (
            <div className="space-y-5">
              <div>
                <p className="text-xs font-bold text-muted-foreground">{selectedLead.id}</p>
                <h2 className="mt-1 text-xl font-black">{selectedLead.company}</h2>
                <p className="text-sm text-muted-foreground">{selectedLead.contact} · {selectedLead.city}, {selectedLead.state}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <SearchableSelect
                  value={selectedLead.stage}
                  onChange={(val) => {
                    handleStageChange(selectedLead.id, val);
                    setSelectedLead({ ...selectedLead, stage: val });
                  }}
                  options={Array.from(new Set([...stages, selectedLead.stage])).map((s) => ({ label: s, value: s }))}
                  className={cn(
                    "w-[140px] h-[36px] px-3 text-xs font-semibold",
                    stageColors[selectedLead.stage] || "bg-emerald-100 text-emerald-700"
                  )}
                />
                <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", priorityColors[selectedLead.priority])}>{selectedLead.priority} Priority</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  ["Category", selectedLead.category],
                  ["Source", selectedLead.source],
                  ["Owner", selectedLead.owner],
                  ["Budget", formatCurrency(selectedLead.budget)],
                  ["AI Score", String(selectedLead.aiScore)],
                  ["Next Follow-up", selectedLead.nextFollowUp || "N/A"],
                  ["Created", selectedLead.createdAt],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-border p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
                    <p className="mt-1 text-sm font-semibold">{value}</p>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <button onClick={(e) => { e.stopPropagation(); toast("Calling lead..."); }} className="flex-1 rounded-xl bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Call</button>
                <button onClick={(e) => { e.stopPropagation(); toast("Opening WhatsApp..."); }} className="flex-1 rounded-xl border border-border py-2 text-sm font-semibold hover:bg-accent">WhatsApp</button>
                <button onClick={(e) => { e.stopPropagation(); toast("Drafting email..."); }} className="flex-1 rounded-xl border border-border py-2 text-sm font-semibold hover:bg-accent">Email</button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
