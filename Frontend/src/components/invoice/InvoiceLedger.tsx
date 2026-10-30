import { useEffect, useMemo, useState } from "react";
import { Landmark, Download, FileText, IndianRupee, Receipt, Users, List } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { SearchableSelect } from "@/components/ui/select";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableHeader } from "@/components/ui/sortable-header";
import { DateRangeFilter } from "@/components/common/DateRangeFilter";
import { SearchInput } from "@/components/common/SearchInput";
import { EmptyState } from "@/components/common/EmptyState";
import { api } from "@/lib/api";
import { API_URL } from "@/lib/config";

interface LedgerEntry {
  id: string;
  date: string | null;
  invoice_number: string;
  invoice_type: string;
  client_name: string;
  client_gstin?: string;
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  gst_amount: number; // CGST + SGST + IGST, computed on the client
  total: number;
  mode_of_payment?: string;
  bank?: string;
  running_total: number;
}

interface LedgerSummary {
  total_received: number;
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  gst_total: number;
  invoices_count: number;
  tax_count: number;
  proforma_count: number;
  tax_received: number;
  proforma_received: number;
}

interface ClientLedgerRow {
  brand: string;
  invoices_count: number;
  tax_invoice_count: number;
  proforma_count: number;
  taxable_amount: number;
  gst_amount: number;
  total_amount: number;
  last_invoice_date?: string;
}

type DateRangeValue = { from?: Date; to?: Date };

const EMPTY_SUMMARY: LedgerSummary = {
  total_received: 0,
  taxable_amount: 0,
  cgst_amount: 0,
  sgst_amount: 0,
  igst_amount: 0,
  gst_total: 0,
  invoices_count: 0,
  tax_count: 0,
  proforma_count: 0,
  tax_received: 0,
  proforma_received: 0,
};

const PAYMENT_MODES = ["Current Account", "Cash with GST", "Cash", "Other Account"];

// Current Indian financial year: 1 Apr – 31 Mar
const currentFinancialYear = (): DateRangeValue => {
  const now = new Date();
  const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return { from: new Date(startYear, 3, 1), to: new Date(startYear + 1, 2, 31) };
};

// Local YYYY-MM-DD (toISOString would shift the day in IST)
const toApiDate = (d?: Date) => {
  if (!d) return undefined;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};


const inr = (n: number) => `₹ ${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const invoiceCount = (n: number) => `${n} invoice${n === 1 ? "" : "s"}`;
const inrOrDash = (n: number) => (n ? inr(n) : "-");

const buildQuery = (params: Record<string, string | undefined>) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v && v !== "All") qs.set(k, v);
  });
  const s = qs.toString();
  return s ? `?${s}` : "";
};

export function InvoiceLedger() {
  const [tab, setTab] = useState<"entries" | "clients">("clients");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("All");
  const [modeFilter, setModeFilter] = useState("All");
  // Set by clicking the Tax / Proforma cards; cards always show the full split
  const [typeFilter, setTypeFilter] = useState<"All" | "Tax Invoice" | "Proforma Invoice">("All");
  // Which card is highlighted (Total and Taxable both show all invoices)
  const [activeCard, setActiveCard] = useState<"total" | "taxable" | "tax" | "proforma">("total");
  const [dateRange, setDateRange] = useState<DateRangeValue>(currentFinancialYear);

  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [summary, setSummary] = useState<LedgerSummary>(EMPTY_SUMMARY);
  const [clientRows, setClientRows] = useState<ClientLedgerRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fromDate = toApiDate(dateRange.from);
  const toDate = toApiDate(dateRange.to);

  // Entries: all filters
  useEffect(() => {
    let active = true;
    const fetchEntries = async () => {
      setLoading(true);
      try {
        const res = await api.get<any>(
          `/invoices/ledger/entries${buildQuery({
            mode_of_payment: modeFilter,
            client_name: clientFilter,
            from_date: fromDate,
            to_date: toDate,
            search: debouncedSearch,
          })}`,
          { showLoader: false, showErrorToast: false }
        );
        if (!active) return;
        const rows: LedgerEntry[] = Array.isArray(res?.data) ? res.data : [];
        setEntries(
          rows.map((e) => ({
            ...e,
            gst_amount: Math.round(((e.cgst_amount || 0) + (e.sgst_amount || 0) + (e.igst_amount || 0)) * 100) / 100,
          }))
        );
        setSummary(res?.summary || EMPTY_SUMMARY);
      } catch (err) {
        console.warn("Could not load ledger entries", err);
        if (active) {
          setEntries([]);
          setSummary(EMPTY_SUMMARY);
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchEntries();
    return () => {
      active = false;
    };
  }, [modeFilter, clientFilter, fromDate, toDate, debouncedSearch]);

  // Client-wise: no client filter, so it also feeds the client dropdown
  useEffect(() => {
    let active = true;
    const fetchClients = async () => {
      try {
        const res = await api.get<any>(
          `/invoices/ledger/brands${buildQuery({
            invoice_type: typeFilter,
            from_date: fromDate,
            to_date: toDate,
            search: debouncedSearch,
          })}`,
          { showLoader: false, showErrorToast: false }
        );
        if (active) setClientRows(Array.isArray(res?.data) ? res.data : []);
      } catch (err) {
        console.warn("Could not load client-wise ledger", err);
        if (active) setClientRows([]);
      }
    };
    fetchClients();
    return () => {
      active = false;
    };
  }, [typeFilter, fromDate, toDate, debouncedSearch]);

  const { visibleEntries, tableTotals } = useMemo(() => {
    let running = 0;
    const totals = { count: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, gst: 0, total: 0 };
    const rows = entries
      .filter((e) => typeFilter === "All" || e.invoice_type === typeFilter)
      .map((e) => {
        running += e.total;
        totals.count += 1;
        totals.taxable += e.taxable_amount;
        totals.cgst += e.cgst_amount;
        totals.sgst += e.sgst_amount;
        totals.igst += e.igst_amount;
        totals.gst += e.gst_amount;
        totals.total += e.total;
        return { ...e, running_total: Math.round(running * 100) / 100 };
      });
    return { visibleEntries: rows, tableTotals: totals };
  }, [entries, typeFilter]);

  const { items: sortedEntries, requestSort, sortConfig } = useSortableData(visibleEntries, {
    key: "running_total",
    direction: "ascending",
  });
  const {
    items: sortedClients,
    requestSort: requestClientSort,
    sortConfig: clientSortConfig,
  } = useSortableData(clientRows, { key: "total_amount", direction: "descending" });

  const resetFilters = () => {
    setSearch("");
    setClientFilter("All");
    setModeFilter("All");
    setTypeFilter("All");
    setActiveCard("total");
    setDateRange(currentFinancialYear());
  };

  const openClientStatement = (client: string) => {
    setClientFilter(client);
    setTab("entries");
  };

  const exportCsv = () => {
    const header = [
      "Date", "Invoice No", "Type", "Client", "GSTIN", "Taxable", "CGST", "SGST", "IGST",
      "Total", "Mode of Payment", "Bank", "Running Total",
    ];
    const rows = sortedEntries.map((e) => [
      formatDate(e.date), e.invoice_number, e.invoice_type, e.client_name, e.client_gstin || "",
      e.taxable_amount, e.cgst_amount, e.sgst_amount, e.igst_amount, e.total,
      e.mode_of_payment || "", e.bank || "", e.running_total,
    ]);
    rows.push([
      "", "", "", "TOTAL", "", tableTotals.taxable, tableTotals.cgst, tableTotals.sgst,
      tableTotals.igst, tableTotals.total, "", "", "",
    ]);
    const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [header, ...rows].map((r) => r.map(escape).join(",")).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ledger_${fromDate || "all"}_${toDate || "all"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const thCls = "p-3 sm:p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider";
  const numTh = `${thCls} text-right`;
  const tdCls = "p-3 sm:p-4 text-xs sm:text-sm";
  const numTd = `${tdCls} text-right font-semibold text-foreground tabular-nums`;

  return (
    <div className="@container w-full space-y-6 sm:space-y-8 animate-in fade-in duration-500 min-w-0">

      {/* Header */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3 sm:gap-4">
          <h1 className="text-xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-2 min-w-0">
            <Landmark className="w-5 h-5 sm:w-8 sm:h-8 text-primary shrink-0" />
            <span className="truncate">Invoice Ledger</span>
          </h1>
          <button
            onClick={exportCsv}
            disabled={visibleEntries.length === 0}
            className="shrink-0 px-3 sm:px-4 py-2 sm:py-2.5 whitespace-nowrap bg-card border border-border/50 text-foreground font-bold rounded-xl hover:bg-muted/50 transition-colors flex items-center justify-center gap-2 shadow-sm text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
        <p className="text-muted-foreground text-xs sm:text-sm font-medium">
          Sales &amp; receipt register: Tax and Proforma invoices.
        </p>
      </div>

      {/* Stats Bar: click a card to filter Entries / Client-wise by invoice type */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 @5xl:grid-cols-4">
        {([
          {
            key: "total", type: "All", label: "Total Received", icon: IndianRupee,
            amount: summary.total_received, count: summary.invoices_count,
            card: "bg-emerald-500/5 border-emerald-500/20", active: "bg-emerald-500/15 border-emerald-500/50 ring-emerald-500/30",
            title: "text-emerald-600", value: "text-emerald-700",
          },
          {
            key: "taxable", type: "All", label: "Taxable Value", icon: FileText,
            amount: summary.taxable_amount, count: summary.invoices_count,
            card: "bg-blue-500/5 border-blue-500/20", active: "bg-blue-500/15 border-blue-500/50 ring-blue-500/30",
            title: "text-blue-600", value: "text-blue-700",
          },
          {
            key: "tax", type: "Tax Invoice", label: "Tax Invoice Payments", icon: Receipt,
            amount: summary.tax_received, count: summary.tax_count,
            card: "bg-amber-500/5 border-amber-500/20", active: "bg-amber-500/15 border-amber-500/50 ring-amber-500/30",
            title: "text-amber-600", value: "text-amber-700",
          },
          {
            key: "proforma", type: "Proforma Invoice", label: "Proforma Invoice Payments", icon: FileText,
            amount: summary.proforma_received, count: summary.proforma_count,
            card: "bg-violet-500/5 border-violet-500/20", active: "bg-violet-500/15 border-violet-500/50 ring-violet-500/30",
            title: "text-violet-600", value: "text-violet-700",
          },
        ] as const).map((c) => {
          const isActive = activeCard === c.key;
          const Icon = c.icon;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => {
                // Clicking the active Tax / Proforma card again goes back to all invoices
                const next = isActive && c.type !== "All" ? "total" : c.key;
                setActiveCard(next);
                setTypeFilter(next === "tax" ? "Tax Invoice" : next === "proforma" ? "Proforma Invoice" : "All");
              }}
              className={cn(
                "min-w-0 text-left border rounded-2xl p-3.5 sm:p-5 @5xl:p-6 shadow-sm transition-all hover:scale-[1.01] cursor-pointer select-none",
                isActive ? cn(c.active, "ring-2 shadow-md") : cn(c.card, "opacity-80 hover:opacity-100 hover:shadow-md")
              )}
            >
              <div className={cn(c.title, "font-bold text-xs uppercase tracking-wider mb-1 flex items-center justify-between gap-2")}>
                <span className="flex items-center gap-2 min-w-0">
                  <Icon className="w-4 h-4 shrink-0" /> <span className="min-w-0">{c.label}</span>
                </span>
                {isActive && <span className="w-2 h-2 rounded-full bg-current animate-pulse shrink-0" />}
              </div>
              <div className={cn(c.value, "text-xl sm:text-2xl @6xl:text-3xl font-black whitespace-nowrap")}>{inr(c.amount)}</div>
              <div className={cn(c.value, "text-[11px] font-semibold opacity-80 mt-1")}>{invoiceCount(c.count)}</div>
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col @5xl:flex-row @5xl:justify-between @5xl:items-center gap-3 sm:gap-4 bg-card border border-border/50 p-3 sm:p-4 rounded-2xl shadow-sm">
        <SearchInput
          placeholder="Search invoice no, client or GSTIN..."
          value={search}
          onChange={setSearch}
          className="w-full" containerClassName="w-full sm:w-full md:w-full @5xl:w-72 @5xl:flex-none @5xl:min-w-[180px]"
        />
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-3 w-full @5xl:w-auto">
          <DateRangeFilter
            dateRange={dateRange}
            onChange={(r) => setDateRange(r ? { ...(r.from && { from: r.from }), ...(r.to && { to: r.to }) } : {})}
            placeholder="Filter by invoice date"
            className="col-span-2 sm:col-span-1 sm:flex-1 sm:min-w-[150px] @5xl:flex-none @5xl:w-auto"
          />
          <SearchableSelect
            value={clientFilter}
            onChange={setClientFilter}
            options={[
              { label: "All Clients", value: "All" },
              ...clientRows.map((c) => ({ label: c.brand, value: c.brand })),
            ]}
            className="w-full sm:w-auto sm:flex-1 sm:min-w-[150px] @5xl:flex-none @5xl:w-[180px] h-[40px] px-3 bg-background border border-border/50 rounded-xl text-sm font-bold cursor-pointer"
          />
          <SearchableSelect
            value={modeFilter}
            onChange={setModeFilter}
            options={[
              { label: "All Modes", value: "All" },
              ...PAYMENT_MODES.map((m) => ({ label: m, value: m })),
            ]}
            className="w-full sm:w-auto sm:flex-1 sm:min-w-[150px] @5xl:flex-none @5xl:w-[160px] h-[40px] px-3 bg-background border border-border/50 rounded-xl text-sm font-bold cursor-pointer"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {([
          { key: "clients", label: "Client-wise", icon: Users },
          { key: "entries", label: "Entries", icon: List },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => {
              setTab(key);
              // Back to the client list: show overall totals again
              if (key === "clients") setClientFilter("All");
            }}
            className={cn(
              "px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 border transition-colors",
              tab === key
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-card text-muted-foreground border-border/50 hover:bg-muted/50"
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
        {clientFilter !== "All" && tab === "entries" && (
          <button
            onClick={() => setClientFilter("All")}
            className="sm:ml-auto text-xs font-bold text-primary hover:underline text-left"
          >
            Statement: {clientFilter} ✕
          </button>
        )}
      </div>

      {/* Entries Table */}
      {tab === "entries" && (
        <div className="bg-card border border-border/50 rounded-2xl sm:rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <SortableHeader label="Date" sortKey="date" currentSort={sortConfig} onSort={requestSort} className={thCls} />
                  <SortableHeader label="Invoice No" sortKey="invoice_number" currentSort={sortConfig} onSort={requestSort} className={thCls} />
                  <SortableHeader label="Type" sortKey="invoice_type" currentSort={sortConfig} onSort={requestSort} className={thCls} />
                  <SortableHeader label="Client" sortKey="client_name" currentSort={sortConfig} onSort={requestSort} className={thCls} />
                  <SortableHeader align="right" label="Taxable" sortKey="taxable_amount" currentSort={sortConfig} onSort={requestSort} className={numTh} />
                  <SortableHeader align="right" label="GST" sortKey="gst_amount" currentSort={sortConfig} onSort={requestSort} className={numTh} />
                  <SortableHeader align="right" label="Total" sortKey="total" currentSort={sortConfig} onSort={requestSort} className={numTh} />
                  <SortableHeader label="Payment Mode" sortKey="mode_of_payment" currentSort={sortConfig} onSort={requestSort} className={thCls} />
                  <SortableHeader align="right" label="Running Total" sortKey="running_total" currentSort={sortConfig} onSort={requestSort} className={numTh} />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {sortedEntries.map((e) => (
                  <tr key={e.id} className="hover:bg-muted/20 transition-colors">
                    <td className={cn(tdCls, "font-medium text-muted-foreground")}>{formatDate(e.date)}</td>
                    <td className={tdCls}>
                      <button
                        onClick={() => window.open(`${API_URL}/invoices/${e.id}/pdf`, "_blank")}
                        className="font-bold text-primary hover:underline"
                      >
                        {e.invoice_number}
                      </button>
                    </td>
                    <td className={tdCls}>
                      <span
                        className={cn(
                          "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border",
                          e.invoice_type === "Proforma Invoice"
                            ? "bg-violet-500/10 text-violet-600 border-violet-500/20"
                            : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                        )}
                      >
                        {e.invoice_type === "Proforma Invoice" ? "Proforma" : "Tax"}
                      </span>
                    </td>
                    <td className={cn(tdCls, "font-bold text-foreground")}>{e.client_name}</td>
                    <td className={numTd}>{inr(e.taxable_amount)}</td>
                    <td className={numTd}>{inrOrDash(e.gst_amount)}</td>
                    <td className={cn(numTd, "font-black text-emerald-600")}>{inr(e.total)}</td>
                    <td className={cn(tdCls, "font-medium text-muted-foreground")}>{e.mode_of_payment || "-"}</td>
                    <td className={cn(numTd, "font-black")}>{inr(e.running_total)}</td>
                  </tr>
                ))}
                {!loading && visibleEntries.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-8 sm:p-12">
                      <EmptyState
                        icon={Landmark}
                        title="No ledger entries found"
                        description="Try adjusting your search query, filters, or date range."
                        actionLabel="Reset Filters"
                        onAction={resetFilters}
                      />
                    </td>
                  </tr>
                )}
                {loading && entries.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-sm text-muted-foreground">Loading ledger...</td>
                  </tr>
                )}
              </tbody>
              {visibleEntries.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/40">
                    <td colSpan={4} className={cn(tdCls, "font-black text-foreground uppercase tracking-wider")}>
                      Total ({tableTotals.count})
                    </td>
                    <td className={cn(numTd, "font-black")}>{inr(tableTotals.taxable)}</td>
                    <td className={cn(numTd, "font-black")}>{inr(tableTotals.gst)}</td>
                    <td className={cn(numTd, "font-black text-emerald-600")}>{inr(tableTotals.total)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* Client-wise Table */}
      {tab === "clients" && (
        <div className="bg-card border border-border/50 rounded-2xl sm:rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <SortableHeader label="Client" sortKey="brand" currentSort={clientSortConfig} onSort={requestClientSort} className={thCls} />
                  <SortableHeader align="right" label="Invoices (Tax / PI)" sortKey="invoices_count" currentSort={clientSortConfig} onSort={requestClientSort} className={numTh} />
                  <SortableHeader align="right" label="Taxable" sortKey="taxable_amount" currentSort={clientSortConfig} onSort={requestClientSort} className={numTh} />
                  <SortableHeader align="right" label="GST" sortKey="gst_amount" currentSort={clientSortConfig} onSort={requestClientSort} className={numTh} />
                  <SortableHeader align="right" label="Total Received" sortKey="total_amount" currentSort={clientSortConfig} onSort={requestClientSort} className={numTh} />
                  <SortableHeader label="Last Invoice" sortKey="last_invoice_date" currentSort={clientSortConfig} onSort={requestClientSort} className={thCls} />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {sortedClients.map((c) => (
                  <tr
                    key={c.brand}
                    onClick={() => openClientStatement(c.brand)}
                    className="hover:bg-muted/20 transition-colors cursor-pointer"
                    title="View statement"
                  >
                    <td className={cn(tdCls, "font-bold text-primary")}>{c.brand}</td>
                    <td className={numTd}>
                      {c.invoices_count}{" "}
                      <span className="text-muted-foreground font-medium">
                        ({c.tax_invoice_count} / {c.proforma_count})
                      </span>
                    </td>
                    <td className={numTd}>{inr(c.taxable_amount)}</td>
                    <td className={numTd}>{inrOrDash(c.gst_amount)}</td>
                    <td className={cn(numTd, "font-black text-emerald-600")}>{inr(c.total_amount)}</td>
                    <td className={cn(tdCls, "font-medium text-muted-foreground")}>{formatDate(c.last_invoice_date)}</td>
                  </tr>
                ))}
                {clientRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 sm:p-12">
                      <EmptyState
                        icon={Users}
                        title="No clients found"
                        description="No invoices match the selected filters."
                        actionLabel="Reset Filters"
                        onAction={resetFilters}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
