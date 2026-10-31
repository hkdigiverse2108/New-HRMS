import { useState, useEffect, useMemo, type ReactNode } from "react";
import { Download, Filter, Landmark, TrendingUp, PieChart as PieIcon, BarChart3, ArrowDownLeft, ArrowUpRight, Wallet, Percent, Scale } from "lucide-react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { SearchableSelect } from "@/components/ui/select";
import { DateRangeFilter } from "@/components/common/DateRangeFilter";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";

const todayISO = () => new Date().toISOString().slice(0, 10);
const toISODate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const formatINR = (n: number) => (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const signedINR = (n: number) => `${n < 0 ? "-" : "+"}₹${formatINR(Math.abs(n))}`;
// Short axis labels: ₹1.2Cr, ₹3.5L, ₹12K
const compactINR = (n: number) => {
  const a = Math.abs(n);
  const s = n < 0 ? "-" : "";
  if (a >= 1e7) return `${s}₹${+(a / 1e7).toFixed(1)}Cr`;
  if (a >= 1e5) return `${s}₹${+(a / 1e5).toFixed(1)}L`;
  if (a >= 1e3) return `${s}₹${+(a / 1e3).toFixed(1)}K`;
  return `${s}₹${a.toFixed(0)}`;
};
const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return y && m ? new Date(y, m - 1, 1).toLocaleString("en-IN", { month: "short", year: "2-digit" }) : "No date";
};

type Trx = {
  id: string; type: "credit" | "debit"; account: string; bankAccountId: string; date: string; amount: number;
  category: string; brand: string; refNo: string; detail: string;
};

const mapTrx = (t: any): Trx => ({
  id: String(t._id || t.id),
  type: t.type,
  account: t.account,
  bankAccountId: t.bank_account_id || "",
  date: t.date || "",
  amount: Number(t.amount) || 0,
  category: t.category || "",
  brand: t.brand || "",
  refNo: t.ref_no || "",
  detail: (t.type === "credit" ? t.description || t.service : t.things || t.narrative) || "",
});

const bankIdOf = (b: any) => String(b.id || b._id);
const bankLabel = (b: any) => `${b.nickname || b.bank_name}${b.account_number ? ` (••${String(b.account_number).slice(-4)})` : ""}`;

type Totals = { credit: number; debit: number; count: number };
type Slice = { name: string; value: number; count: number; color: string };
const groupBy = (rows: Trx[], keyOf: (t: Trx) => string, sortBy: "credit" | "debit" | "name") => {
  const map = new Map<string, Totals>();
  rows.forEach((t) => {
    const row = map.get(keyOf(t)) || { credit: 0, debit: 0, count: 0 };
    row[t.type === "credit" ? "credit" : "debit"] += t.amount;
    row.count += 1;
    map.set(keyOf(t), row);
  });
  const list = Array.from(map.entries());
  return sortBy === "name" ? list.sort((a, b) => a[0].localeCompare(b[0])) : list.sort((a, b) => b[1][sortBy] - a[1][sortBy]);
};

// Credit / debit keep the Transactions page tones; categories / brands use a fixed categorical order
const CREDIT_COLOR = "#059669";
const DEBIT_COLOR = "#e11d48";
const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6"];
const OTHER_COLOR = "#898781";

// Donuts: biggest rows get a colour each, the rest fold into one grey "Other" slice
const toSlices = (rows: [string, Totals][], type: "credit" | "debit"): Slice[] => {
  const limit = SERIES.length;
  const data = rows.slice(0, limit).map(([name, v], i) => ({ name, value: v[type], count: v.count, color: SERIES[i] ?? OTHER_COLOR }));
  const rest = rows.slice(limit);
  if (rest.length) data.push({ name: `Other (${rest.length})`, value: rest.reduce((s, [, v]) => s + v[type], 0), count: rest.reduce((s, [, v]) => s + v.count, 0), color: OTHER_COLOR });
  return data.filter((d) => d.value > 0);
};

const AXIS_TICK = { fontSize: 11, fill: "var(--muted-foreground)" };
const TOOLTIP_STYLE = { backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "12px", color: "var(--foreground)", fontSize: 12, boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" };
const FILTER_SELECT = "flex-1 min-w-0 sm:flex-none sm:w-[170px] h-[34px] pl-3 pr-3 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer";

// Width of a card on large screens (12-column grid); full width below that
const SPAN: Record<number, string> = { 4: "xl:col-span-4", 5: "xl:col-span-5", 6: "xl:col-span-6", 7: "xl:col-span-7", 8: "xl:col-span-8", 12: "xl:col-span-12" };

// ---------- Building blocks ----------
function ChartCard({ title, subtitle, icon, span = 12, children }: { title: string; subtitle?: string; icon: ReactNode; span?: number; children: ReactNode }) {
  return (
    <div className={`col-span-12 ${SPAN[span]} bg-card border border-border/50 rounded-2xl shadow-sm flex flex-col min-w-0`}>
      <div className="p-4 sm:p-5 flex gap-3 items-center">
        <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">{icon}</div>
        <div>
          <h3 className="font-black text-foreground leading-none">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground font-medium mt-1">{subtitle}</p>}
        </div>
      </div>
      <div className="px-2 sm:px-4 pb-4 flex-1 min-w-0 flex flex-col justify-center">{children}</div>
    </div>
  );
}

function EmptyChart({ loading, height = 260, text = "No transactions for the selected filters." }: { loading: boolean; height?: number; text?: string }) {
  return loading
    ? <Skeleton className="w-full rounded-xl" style={{ height }} />
    : <div className="flex items-center justify-center text-sm font-medium text-muted-foreground rounded-xl border border-dashed border-border/60" style={{ height }}>{text}</div>;
}

// Donut with the total in the middle and a legend list below it
function DonutChart({ data, centerLabel }: { data: Slice[]; centerLabel: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative w-[210px] h-[210px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={64} outerRadius={98} paddingAngle={data.length > 1 ? 2 : 0} stroke="var(--card)" strokeWidth={2} isAnimationActive={false}>
              {data.map((d) => <Cell key={d.name} fill={d.color} />)}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE}
              formatter={(v: number, n: string) => [`₹${formatINR(v)} (${total ? ((v / total) * 100).toFixed(1) : 0}%)`, n]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{centerLabel}</div>
          <div className="text-lg font-black text-foreground">{compactINR(total)}</div>
        </div>
      </div>
      <ul className="w-full space-y-2 min-w-0">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-3 text-sm">
            <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: d.color }} />
            <span className="font-semibold text-foreground truncate flex-1" title={d.name}>{d.name}</span>
            <span className="text-xs font-bold text-muted-foreground w-12 text-right">{total ? ((d.value / total) * 100).toFixed(1) : 0}%</span>
            <span className="font-bold text-foreground w-28 text-right tabular-nums">₹{formatINR(d.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CreditDebitBars({ data, xKey, height = 300 }: { data: any[]; xKey: string; height?: number }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} barGap={2} barCategoryGap="25%">
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey={xKey} axisLine={false} tickLine={false} tick={AXIS_TICK} interval={0} tickFormatter={(v: string) => (v.length > 16 ? `${v.slice(0, 15)}…` : v)} />
          <YAxis tickFormatter={compactINR} axisLine={false} tickLine={false} tick={AXIS_TICK} width={64} />
          <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.4 }} contentStyle={TOOLTIP_STYLE} formatter={(v: number) => `₹${formatINR(v)}`} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="credit" name="Credit" fill={CREDIT_COLOR} radius={[4, 4, 0, 0]} maxBarSize={32} />
          <Bar dataKey="debit" name="Debit" fill={DEBIT_COLOR} radius={[4, 4, 0, 0]} maxBarSize={32} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function TrendLines({ data, names, height = 300 }: { data: Record<string, any>[]; names: string[]; height?: number }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="month" axisLine={false} tickLine={false} tick={AXIS_TICK} />
          <YAxis tickFormatter={compactINR} axisLine={false} tickLine={false} tick={AXIS_TICK} width={64} />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => `₹${formatINR(v)}`} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          {names.map((n, i) => (
            <Line key={n} type="monotone" dataKey={n} stroke={SERIES[i]} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: "var(--card)", fill: SERIES[i] }} activeDot={{ r: 5 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FinanceReport() {
  const [transactions, setTransactions] = useState<Trx[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [openingBalances, setOpeningBalances] = useState({ cash: 0 });
  const [bankOpening, setBankOpening] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      await Promise.all([
        api.get<any[]>("/transactions", { showLoader: false })
          .then((res) => setTransactions((Array.isArray(res) ? res : []).map(mapTrx)))
          .catch(() => setTransactions([])),
        api.get<any>("/bank-accounts", { showLoader: false, showErrorToast: false })
          .then((res) => setBankAccounts(Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []))
          .catch(() => setBankAccounts([])),
        api.get<any>("/transactions/opening-balances", { showLoader: false, showErrorToast: false })
          .then((res) => setOpeningBalances({ cash: Number(res?.cash) || 0 }))
          .catch(() => { /* keep defaults */ }),
        api.get<Record<string, number>>("/transactions/opening-balances/bank-accounts", { showLoader: false, showErrorToast: false })
          .then((res) => setBankOpening(res || {}))
          .catch(() => { /* keep defaults */ }),
      ]);
      setLoading(false);
    };
    load();
  }, []);

  // ---------- Filters ----------
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  // "all", "cash" or a bank account id
  const [account, setAccount] = useState("all");
  const [category, setCategory] = useState("All Categories");
  const [brand, setBrand] = useState("All Brands");

  const bankById = useMemo(() => new Map(bankAccounts.map((b) => [bankIdOf(b), b])), [bankAccounts]);
  const accountLabelOf = (t: Trx) => (t.account === "cash" ? "Cash" : bankById.get(t.bankAccountId) ? bankLabel(bankById.get(t.bankAccountId)) : "Bank (unassigned)");

  const accountOptions = useMemo(() => [
    { label: "All Accounts", value: "all" },
    { label: "Cash", value: "cash" },
    ...bankAccounts.map((b) => ({ label: bankLabel(b), value: bankIdOf(b) })),
  ], [bankAccounts]);
  const categoryOptions = useMemo(() => [
    "All Categories", ...Array.from(new Set(transactions.map((t) => t.category).filter(Boolean))).sort(),
  ].map((c) => ({ label: c, value: c })), [transactions]);
  const brandOptions = useMemo(() => [
    "All Brands", ...Array.from(new Set(transactions.map((t) => t.brand).filter(Boolean))).sort(),
  ].map((b) => ({ label: b, value: b })), [transactions]);

  const fromISO = dateRange?.from ? toISODate(dateRange.from) : "";
  const toISO = (dateRange?.to ? toISODate(dateRange.to) : "") || fromISO;

  // Account / category / brand filters (everything except the date range)
  const matchesScope = (t: Trx) =>
    (account === "all" || (account === "cash" ? t.account === "cash" : t.account === "bank" && t.bankAccountId === account))
    && (category === "All Categories" || t.category === category)
    && (brand === "All Brands" || t.brand === brand);

  const filtered = useMemo(
    () => transactions.filter((t) => matchesScope(t) && (!fromISO || t.date >= fromISO) && (!toISO || t.date <= toISO)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, account, category, brand, fromISO, toISO],
  );

  // ---------- Summary ----------
  const credits = filtered.filter((t) => t.type === "credit");
  const debits = filtered.filter((t) => t.type === "debit");
  const totalCredit = credits.reduce((s, t) => s + t.amount, 0);
  const totalDebit = debits.reduce((s, t) => s + t.amount, 0);
  const net = totalCredit - totalDebit;
  const margin = totalCredit > 0 ? (net / totalCredit) * 100 : 0;

  // Opening/closing only make sense for a whole account, not a single category or brand
  const isBalanceView = category === "All Categories" && brand === "All Brands";
  // Opening balance at the start of the selected period = configured opening + net of entries before it
  const configuredOpening =
    account === "all" ? openingBalances.cash + bankAccounts.reduce((s, b) => s + (bankOpening[bankIdOf(b)] || 0), 0)
    : account === "cash" ? openingBalances.cash
    : bankOpening[account] || 0;
  const priorNet = fromISO
    ? transactions.filter((t) => matchesScope(t) && t.date < fromISO).reduce((s, t) => s + (t.type === "credit" ? t.amount : -t.amount), 0)
    : 0;
  const periodOpening = configuredOpening + priorNet;
  const periodClosing = periodOpening + net;

  // ---------- Breakdowns ----------
  const monthly = useMemo(() => groupBy(filtered, (t) => t.date.slice(0, 7), "name"), [filtered]);
  const monthlyChart = useMemo(
    () => monthly.map(([key, v]) => ({ month: monthLabel(key), credit: v.credit, debit: v.debit })),
    [monthly],
  );
  const monthCount = Math.max(monthly.length, 1);

  const creditCategories = useMemo(() => groupBy(credits, (t) => t.category || "Uncategorised", "credit"), [filtered]); // eslint-disable-line react-hooks/exhaustive-deps
  const debitCategories = useMemo(() => groupBy(debits, (t) => t.category || "Uncategorised", "debit"), [filtered]); // eslint-disable-line react-hooks/exhaustive-deps
  const brands = useMemo(() => groupBy(credits.filter((t) => t.brand), (t) => t.brand, "credit"), [filtered]); // eslint-disable-line react-hooks/exhaustive-deps
  const accounts = useMemo(() => groupBy(filtered, accountLabelOf, "name"), [filtered, bankById]); // eslint-disable-line react-hooks/exhaustive-deps

  // Monthly trend of the top 5 categories / brands (one line each)
  const trendOf = (rows: Trx[], keyOf: (t: Trx) => string, names: string[]) => {
    const months = Array.from(new Set(rows.map((t) => t.date.slice(0, 7)))).sort();
    return months.map((m) => {
      const point: Record<string, any> = { month: monthLabel(m) };
      names.forEach((n) => { point[n] = 0; });
      rows.forEach((t) => { if (t.date.slice(0, 7) === m && names.includes(keyOf(t))) point[keyOf(t)] += t.amount; });
      return point;
    });
  };
  const topCreditCats = creditCategories.slice(0, 5).map(([n]) => n);
  const topDebitCats = debitCategories.slice(0, 5).map(([n]) => n);
  const creditCatTrend = useMemo(() => trendOf(credits, (t) => t.category || "Uncategorised", topCreditCats), [filtered]); // eslint-disable-line react-hooks/exhaustive-deps
  const debitCatTrend = useMemo(() => trendOf(debits, (t) => t.category || "Uncategorised", topDebitCats), [filtered]); // eslint-disable-line react-hooks/exhaustive-deps

  const topCreditEntries = [...credits].sort((a, b) => b.amount - a.amount).slice(0, 10);
  const topDebitEntries = [...debits].sort((a, b) => b.amount - a.amount).slice(0, 10);

  // ---------- Export ----------
  const accountName = accountOptions.find((o) => o.value === account)?.label || "All Accounts";
  const exportReport = () => {
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const section = (title: string, header: string[], rows: any[][]) => [[title], header, ...rows, []];
    const totalsRows = (rows: [string, Totals][]) => rows.map(([k, v]) => [k, v.credit.toFixed(2), v.debit.toFixed(2), (v.credit - v.debit).toFixed(2), v.count]);
    const entryRows = (rows: Trx[]) => rows.map((t) => [formatDate(t.date), t.refNo, t.category, t.brand, t.detail, accountLabelOf(t), t.amount.toFixed(2)]);
    const summary = isBalanceView
      ? section("Summary", ["Opening Balance", "Total Credit", "Total Debit", "Net", "Closing Balance", "Margin %"],
        [[periodOpening.toFixed(2), totalCredit.toFixed(2), totalDebit.toFixed(2), net.toFixed(2), periodClosing.toFixed(2), margin.toFixed(1)]])
      : section("Summary", ["Total Credit", "Total Debit", "Net", "Margin %"], [[totalCredit.toFixed(2), totalDebit.toFixed(2), net.toFixed(2), margin.toFixed(1)]]);
    const csv = [
      ["Finance Report"],
      ["Account", accountName],
      ["Category", category],
      ["Brand", brand],
      ["Date Range", fromISO ? `${formatDate(fromISO)} - ${formatDate(toISO)}` : "All Dates"],
      ["Exported On", formatDate(todayISO())],
      [],
      ...summary,
      ...section("Month-wise", ["Month", "Credit", "Debit", "Net", "Entries"], totalsRows(monthly.map(([k, v]) => [monthLabel(k), v]))),
      ...section("Credit by Category", ["Category", "Amount", "Entries"], creditCategories.map(([k, v]) => [k, v.credit.toFixed(2), v.count])),
      ...section("Debit by Category", ["Category", "Amount", "Entries"], debitCategories.map(([k, v]) => [k, v.debit.toFixed(2), v.count])),
      ...section("Credit by Brand", ["Brand", "Amount", "Entries"], brands.map(([k, v]) => [k, v.credit.toFixed(2), v.count])),
      ...section("Account-wise", ["Account", "Credit", "Debit", "Net", "Entries"], totalsRows(accounts)),
      ...section("Top 10 Credit Entries", ["Date", "Ref No.", "Category", "Brand", "Details", "Account", "Amount"], entryRows(topCreditEntries)),
      ...section("Top 10 Debit Entries", ["Date", "Ref No.", "Category", "Brand", "Details", "Account", "Amount"], entryRows(topDebitEntries)),
    ].map((r) => r.map(esc).join(",")).join("\n");
    // BOM so Excel reads ₹ and other UTF-8 text correctly
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `finance_report_${fromISO ? `${fromISO}_to_${toISO}` : todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasData = !loading && filtered.length > 0;

  const cards = [
    ...(isBalanceView ? [{ label: fromISO ? "Opening (Period Start)" : "Opening Balance", value: `₹${formatINR(periodOpening)}`, tone: "text-foreground", icon: Wallet, note: "Starting balance" }] : []),
    { label: "Total Credit", value: `₹${formatINR(totalCredit)}`, tone: "text-emerald-600", icon: ArrowDownLeft, note: `${credits.length} entries · avg ${compactINR(totalCredit / monthCount)}/month` },
    { label: "Total Debit", value: `₹${formatINR(totalDebit)}`, tone: "text-rose-600", icon: ArrowUpRight, note: `${debits.length} entries · avg ${compactINR(totalDebit / monthCount)}/month` },
    { label: "Net (Credit - Debit)", value: signedINR(net), tone: net >= 0 ? "text-emerald-600" : "text-rose-600", icon: Scale, note: net >= 0 ? "Profit for the period" : "Loss for the period" },
    { label: "Profit Margin", value: `${margin.toFixed(1)}%`, tone: margin >= 0 ? "text-emerald-600" : "text-rose-600", icon: Percent, note: "Net as % of total credit" },
    ...(isBalanceView ? [{ label: "Closing Balance", value: `₹${formatINR(periodClosing)}`, tone: "text-primary", icon: Landmark, note: "Opening + Credit - Debit" }] : []),
  ];

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500 pb-12 relative min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">Finance Report</h1>
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm font-medium">Complete overview of company income, expenses, categories, brands and accounts</p>
        </div>
        <button onClick={exportReport} className="px-3 sm:px-4 py-2 bg-background border border-border/50 text-foreground font-bold rounded-lg hover:bg-muted/50 transition-colors shadow-sm flex items-center gap-2 text-xs sm:text-sm">
          <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-500" /> Export Report
        </button>
      </div>

      {/* Filters */}
      <div className="bg-background border border-border/50 rounded-2xl p-3 flex flex-wrap items-center gap-3 sm:gap-4 shadow-sm">
        <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-muted-foreground pl-1 sm:pl-2">
          <Filter className="w-4 h-4" /> Filters:
        </div>
        <div className="flex items-center gap-2 text-xs sm:text-sm w-full sm:w-auto">
          <span className="sm:hidden text-muted-foreground font-medium w-16 shrink-0">Date:</span>
          <DateRangeFilter dateRange={dateRange} onChange={setDateRange} placeholder="Filter by transaction date" className="flex-1 min-w-0 sm:flex-none h-[34px]" />
        </div>
        <div className="flex items-center gap-2 text-xs sm:text-sm w-full sm:w-auto">
          <span className="text-muted-foreground font-medium w-16 sm:w-auto shrink-0">Account:</span>
          <SearchableSelect value={account} onChange={setAccount} options={accountOptions} className={FILTER_SELECT} />
        </div>
        <div className="flex items-center gap-2 text-xs sm:text-sm w-full sm:w-auto">
          <span className="text-muted-foreground font-medium w-16 sm:w-auto shrink-0">Category:</span>
          <SearchableSelect value={category} onChange={setCategory} options={categoryOptions} className={FILTER_SELECT} />
        </div>
        <div className="flex items-center gap-2 text-xs sm:text-sm w-full sm:w-auto">
          <span className="text-muted-foreground font-medium w-16 sm:w-auto shrink-0">Brand:</span>
          <SearchableSelect value={brand} onChange={setBrand} options={brandOptions} className={FILTER_SELECT} />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className="bg-card border border-border/50 rounded-2xl p-4 shadow-sm flex flex-col min-w-0 [container-type:inline-size]">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="text-muted-foreground font-extrabold text-[10px] uppercase tracking-widest leading-tight">{c.label}</div>
              <c.icon className="w-4 h-4 text-muted-foreground shrink-0" />
            </div>
            {loading ? <Skeleton className="h-8 w-32 mb-2" /> : (
              // Always one line: the font shrinks to fit the card width, so big amounts never wrap
              <div title={c.value} className={`h-8 flex items-center font-black mb-2 tabular-nums whitespace-nowrap overflow-hidden ${c.tone}`}
                style={{ fontSize: `min(1.5rem, calc(100cqi / ${(c.value.length * 0.62).toFixed(2)}))` }}>
                {c.value}
              </div>
            )}
            {loading ? <Skeleton className="h-3 w-36" /> : <div className="text-muted-foreground font-medium text-[11px] leading-snug mt-auto">{c.note}</div>}
          </div>
        ))}
      </div>

      {/* Charts — card widths follow how much each chart has to show */}
      <div className="grid grid-cols-12 gap-4 sm:gap-6">
        {/* Money in vs out */}
        <ChartCard span={12} icon={<BarChart3 className="w-4 h-4" />} title="Monthly Credit vs Debit" subtitle="Income and expenses for each month">
          {hasData ? <CreditDebitBars data={monthlyChart} xKey="month" height={300} /> : <EmptyChart loading={loading} height={300} />}
        </ChartCard>
        {/* Category and brand shares */}
        <ChartCard span={4} icon={<PieIcon className="w-4 h-4" />} title="Credit Category Share" subtitle="Share of total income">
          {creditCategories.length ? <DonutChart data={toSlices(creditCategories, "credit")} centerLabel="Credit" /> : <EmptyChart loading={loading} height={210} text="No credit entries." />}
        </ChartCard>
        <ChartCard span={4} icon={<PieIcon className="w-4 h-4" />} title="Debit Category Share" subtitle="Share of total expenses">
          {debitCategories.length ? <DonutChart data={toSlices(debitCategories, "debit")} centerLabel="Debit" /> : <EmptyChart loading={loading} height={210} text="No debit entries." />}
        </ChartCard>
        <ChartCard span={4} icon={<PieIcon className="w-4 h-4" />} title="Brand Share" subtitle="Share of brand-wise income">
          {brands.length ? <DonutChart data={toSlices(brands, "credit")} centerLabel="Brand income" /> : <EmptyChart loading={loading} height={210} text="No brand-wise credit." />}
        </ChartCard>

        {/* Category trends */}
        <ChartCard span={6} icon={<TrendingUp className="w-4 h-4" />} title="Top Income Categories by Month" subtitle="Top 5 credit categories over time">
          {creditCatTrend.length ? <TrendLines data={creditCatTrend} names={topCreditCats} /> : <EmptyChart loading={loading} height={300} text="No credit entries." />}
        </ChartCard>
        <ChartCard span={6} icon={<TrendingUp className="w-4 h-4" />} title="Top Expense Categories by Month" subtitle="Top 5 debit categories over time">
          {debitCatTrend.length ? <TrendLines data={debitCatTrend} names={topDebitCats} /> : <EmptyChart loading={loading} height={300} text="No debit entries." />}
        </ChartCard>

        {/* Accounts */}
        <ChartCard span={12} icon={<Landmark className="w-4 h-4" />} title="Account-wise" subtitle="Credit and debit in cash and each bank">
          {hasData ? <CreditDebitBars data={accounts.map(([name, v]) => ({ name, credit: v.credit, debit: v.debit }))} xKey="name" height={300} /> : <EmptyChart loading={loading} height={300} />}
        </ChartCard>
      </div>
    </div>
  );
}
