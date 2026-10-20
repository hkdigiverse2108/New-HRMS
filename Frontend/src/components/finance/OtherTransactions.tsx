import { useState, useEffect, useMemo } from "react";
import { Download, Plus, Edit3, Trash2, ChevronRight, X, Users, Filter, ChevronDown, Landmark, Calendar, Wallet, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { SearchableSelect } from "@/components/ui/select";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableHeader } from "@/components/ui/sortable-header";
import { DateRangeFilter } from "@/components/common/DateRangeFilter";
import { SearchInput } from "@/components/common/SearchInput";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { formatDate } from "@/lib/utils";

const todayISO = () => new Date().toISOString().slice(0, 10);
const toISODate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const formatINR = (n: number) => (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const DEFAULT_METHODS = ["Bank Transfer", "Cash", "UPI / GPay / Paytm", "Cheque", "Other"];
const TYPE_OPTIONS = [
  { label: "Inflow (Received)", value: "inflow" },
  { label: "Outflow (Paid)", value: "outflow" },
];

const bankIdOf = (b: any) => String(b.id || b._id);
const bankLabel = (b: any) => `${b.nickname || b.bank_name}${b.account_number ? ` (••${String(b.account_number).slice(-4)})` : ""}`;

const mapTx = (t: any) => ({
  id: String(t._id || t.id),
  party: t.party || "",
  date: t.date || "",
  type: t.type as "inflow" | "outflow",
  amount: Number(t.amount) || 0,
  method: t.method || "",
  bankAccountId: t.bank_account_id || "",
  description: t.description || "",
  remarks: t.remarks || "",
});
type Tx = ReturnType<typeof mapTx>;
type PartyRow = { party: string; totalInflow: number; totalOutflow: number; netBalance: number; transactions: Tx[] };

const emptyTxForm = () => ({ party: "", date: todayISO(), type: "inflow", amount: "", method: "Bank Transfer", bankAccountId: "", description: "", remarks: "" });
const emptyBankForm = () => ({ nickname: "", bank_name: "", account_name: "", account_number: "", ifsc_code: "", branch: "", upi_id: "", opening: "0" });

const INPUT = "w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20";
const SELECT = "w-full h-[40px] px-3 bg-background border border-border/50 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20";
const QUICK_AMOUNTS = [1000, 5000, 10000, 20000, 50000];
const LABEL ="text-[11px] font-bold text-muted-foreground uppercase tracking-wide";

export function OtherTransactions() {
  const [transactions, setTransactions] = useState<Tx[]>([]);
  // Bank accounts of this page only (separate from the ledger / invoice bank accounts)
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTransactions = async () => {
    try {
      const res = await api.get<any[]>("/other-transactions", { showLoader: false });
      setTransactions((Array.isArray(res) ? res : []).map(mapTx));
    } catch { setTransactions([]); }
  };

  const fetchBanks = async () => {
    try {
      const res = await api.get<any[]>("/other-transactions/bank-accounts", { showLoader: false, showErrorToast: false });
      setBankAccounts(Array.isArray(res) ? res : []);
    } catch { setBankAccounts([]); }
  };

  // Until the first load finishes, show skeletons instead of ₹0.00 / empty tables
  useEffect(() => {
    Promise.all([fetchTransactions(), fetchBanks()]).finally(() => setLoading(false));
  }, []);

  const bankById = useMemo(() => new Map(bankAccounts.map((b) => [bankIdOf(b), b])), [bankAccounts]);
  const bankOptions = useMemo(() => bankAccounts.map((b) => ({ label: bankLabel(b), value: bankIdOf(b) })), [bankAccounts]);
  const accountLabelOf = (t: { method: string; bankAccountId: string }) =>
    t.method === "Cash" ? "Cash" : bankById.get(t.bankAccountId) ? bankLabel(bankById.get(t.bankAccountId)) : "-";

  // ---------- Filters ----------
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [expandedParties, setExpandedParties] = useState<string[]>([]);
  // Account filter: "all" (every entry, cash included) or a bank account id
  const [selectedAccount, setSelectedAccount] = useState("all");

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const from = dateRange?.from ? toISODate(dateRange.from) : "";
    const to = (dateRange?.to ? toISODate(dateRange.to) : "") || from;
    return transactions.filter((t) => {
      if (selectedAccount !== "all" && t.bankAccountId !== selectedAccount) return false;
      if (from && t.date < from) return false;
      if (to && t.date > to) return false;
      if (q) {
        const hay = [t.party, t.description, t.remarks, t.method, accountLabelOf(t), String(t.amount)].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [transactions, searchQuery, dateRange, bankById, selectedAccount]);

  // One summary row per client / entity
  const partyRows = useMemo(() => {
    const groups = new Map<string, PartyRow>();
    filteredTransactions.forEach((t) => {
      const g: PartyRow = groups.get(t.party) || { party: t.party, totalInflow: 0, totalOutflow: 0, netBalance: 0, transactions: [] };
      if (t.type === "inflow") g.totalInflow += t.amount;
      else g.totalOutflow += t.amount;
      g.netBalance = g.totalInflow - g.totalOutflow;
      g.transactions.push(t);
      groups.set(t.party, g);
    });
    return Array.from(groups.values());
  }, [filteredTransactions]);

  const { items: sortedParties, requestSort, sortConfig } = useSortableData(partyRows);

  const totalInflow = filteredTransactions.filter((t) => t.type === "inflow").reduce((s, t) => s + t.amount, 0);
  const totalOutflow = filteredTransactions.filter((t) => t.type === "outflow").reduce((s, t) => s + t.amount, 0);

  const toggleExpand = (party: string) =>
    setExpandedParties((prev) => (prev.includes(party) ? prev.filter((p) => p !== party) : [...prev, party]));

  // ---------- Add / edit transaction ----------
  const [isTxOpen, setIsTxOpen] = useState(false);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [txForm, setTxForm] = useState(emptyTxForm);

  // Default methods first, then any custom methods already used in transactions
  const methodOptions = useMemo(() => {
    const custom = Array.from(new Set([...transactions.map((t) => t.method), txForm.method].filter((m) => m && !DEFAULT_METHODS.includes(m)))).sort();
    return [...DEFAULT_METHODS, ...custom].map((m) => ({ label: m, value: m }));
  }, [transactions, txForm.method]);

  const defaultBankId = () => (bankAccounts[0] ? bankIdOf(bankAccounts[0]) : "");

  const openAddTx = (party = "") => {
    setEditingTxId(null);
    const viewingBank = selectedAccount !== "all" ? selectedAccount : "";
    setTxForm({ ...emptyTxForm(), party, bankAccountId: viewingBank || (bankAccounts.length ? defaultBankId() : "") });
    setIsTxOpen(true);
  };

  const openEditTx = (t: Tx) => {
    setEditingTxId(t.id);
    setTxForm({
      party: t.party, date: t.date, type: t.type, amount: String(t.amount), method: t.method || "Bank Transfer",
      bankAccountId: t.bankAccountId, description: t.description, remarks: t.remarks,
    });
    setIsTxOpen(true);
  };

  const isCash = txForm.method === "Cash";

  const saveTx = async () => {
    const amount = parseFloat(txForm.amount);
    const error = !txForm.party.trim() ? "Please select or add a client / category"
      : !(amount > 0) ? "Please enter a valid amount"
      : !isCash && !txForm.bankAccountId ? "Please select a bank account" : "";
    if (error) {
      toast.error(error);
      return;
    }
    const payload = {
      party: txForm.party.trim(), date: txForm.date || todayISO(), type: txForm.type || "inflow", amount, method: txForm.method,
      bank_account_id: isCash ? null : txForm.bankAccountId, description: txForm.description, remarks: txForm.remarks,
    };
    try {
      if (editingTxId) await api.put(`/other-transactions/${editingTxId}`, payload);
      else await api.post("/other-transactions", payload);
      toast.success(editingTxId ? "Transaction updated" : "Transaction added");
      setIsTxOpen(false);
      setExpandedParties((prev) => (prev.includes(payload.party) ? prev : [...prev, payload.party]));
      fetchTransactions();
    } catch { /* api shows error toast */ }
  };

  const [deleteTx, setDeleteTx] = useState<Tx | null>(null);
  const confirmDeleteTx = async () => {
    const t = deleteTx;
    setDeleteTx(null);
    if (!t) return;
    try {
      await api.delete(`/other-transactions/${t.id}`);
      toast.success("Transaction deleted");
      fetchTransactions();
    } catch { /* api shows error toast */ }
  };

  // ---------- Bank accounts ----------
  const [isBanksOpen, setIsBanksOpen] = useState(false);
  const [bankForm, setBankForm] = useState(emptyBankForm);
  const [editingBankId, setEditingBankId] = useState<string | null>(null);
  const [deleteBank, setDeleteBank] = useState<any | null>(null);

  const bankFlow = (id: string) =>
    transactions.filter((t) => t.bankAccountId === id).reduce((s, t) => s + (t.type === "inflow" ? t.amount : -t.amount), 0);

  const startEditBank = (b: any) => {
    setEditingBankId(bankIdOf(b));
    setBankForm({
      nickname: b.nickname || "", bank_name: b.bank_name || "", account_name: b.account_name || "",
      account_number: b.account_number || "", ifsc_code: b.ifsc_code || "", branch: b.branch || "",
      upi_id: b.upi_id || "", opening: String(Number(b.opening_balance) || 0),
    });
  };

  const resetBankForm = () => { setEditingBankId(null); setBankForm(emptyBankForm()); };

  const saveBank = async () => {
    const { opening, ...fields } = bankForm;
    if (!fields.nickname.trim() || !fields.bank_name.trim() || !fields.account_number.trim() || !fields.ifsc_code.trim()) {
      toast.error("Nickname, bank name, account number and IFSC are required");
      return;
    }
    const payload = { ...fields, ifsc_code: fields.ifsc_code.toUpperCase(), opening_balance: parseFloat(opening) || 0 };
    try {
      if (editingBankId) await api.put(`/other-transactions/bank-accounts/${editingBankId}`, payload);
      else await api.post("/other-transactions/bank-accounts", payload);
      toast.success(editingBankId ? "Bank account updated" : "Bank account added");
      resetBankForm();
      fetchBanks();
    } catch { /* api shows error toast */ }
  };

  const requestDeleteBank = (b: any) => {
    if (transactions.some((t) => t.bankAccountId === bankIdOf(b))) {
      toast.error("This account has transactions. Move or delete them first.");
      return;
    }
    setDeleteBank(b);
  };

  const confirmDeleteBank = async () => {
    const b = deleteBank;
    setDeleteBank(null);
    if (!b) return;
    try {
      await api.delete(`/other-transactions/bank-accounts/${bankIdOf(b)}`);
      toast.success("Bank account deleted");
      if (editingBankId === bankIdOf(b)) resetBankForm();
      if (selectedAccount === bankIdOf(b)) setSelectedAccount("all");
      fetchBanks();
    } catch { /* api shows error toast */ }
  };

  const selectedAccountLabel = selectedAccount === "all" ? "All Transactions"
    : bankById.get(selectedAccount) ? bankLabel(bankById.get(selectedAccount)) : "Bank";
  // Opening balance of what is being viewed (all = every bank account's opening balance)
  const viewOpening = selectedAccount === "all"
    ? bankAccounts.reduce((sum, b) => sum + (Number(b.opening_balance) || 0), 0)
    : Number(bankById.get(selectedAccount)?.opening_balance) || 0;

  // ---------- Export ----------
  const exportLedgers = () => {
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const fromISO = dateRange?.from ? toISODate(dateRange.from) : "";
    const toISO = dateRange?.to ? toISODate(dateRange.to) : fromISO;
    const meta = [
      ["Client & External Transactions"],
      ["Account", selectedAccountLabel],
      ["Date Range", fromISO ? `${formatDate(fromISO)} - ${formatDate(toISO)}` : "All Dates"],
      ...(searchQuery.trim() ? [["Search", searchQuery.trim()]] : []),
      ["Exported On", formatDate(todayISO())],
      [],
    ];
    const header = ["Client / Category", "Date", "Type", "Amount", "Method", "Bank Account", "Description", "Remarks"];
    const rows = [...filteredTransactions]
      .sort((a, b) => a.party.localeCompare(b.party) || a.date.localeCompare(b.date))
      .map((t) => [t.party, formatDate(t.date), t.type === "inflow" ? "Inflow" : "Outflow", t.amount.toFixed(2), t.method, accountLabelOf(t), t.description, t.remarks]);
    const summary = [[], ["Total Inflow", totalInflow.toFixed(2)], ["Total Outflow", totalOutflow.toFixed(2)], ["Net Balance", (totalInflow - totalOutflow).toFixed(2)]];
    const csv = [...meta, header, ...rows, ...summary].map((r) => r.map(esc).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    const accountSlug = selectedAccount === "all" ? "" : `${selectedAccountLabel.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase()}_`;
    a.download = `client_transactions_${accountSlug}${fromISO ? `${fromISO}_to_${toISO}` : todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500 pb-12 relative min-w-0">

      {/* Header */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Users className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            Client & External Transactions
          </h1>
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm font-medium">
            Manage ledgers, track total inflows/outflows, and net balances per client or external entity.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-2.5 w-full xl:w-auto">
          <button
            onClick={() => { resetBankForm(); setIsBanksOpen(true); }}
            className="px-3 sm:px-4 py-2 bg-background border border-border/50 text-foreground font-bold rounded-lg hover:bg-muted/50 transition-colors shadow-sm flex items-center gap-2 text-xs sm:text-sm"
          >
            <Landmark className="w-4 h-4 text-primary" /> Manage Banks
          </button>
          <button onClick={exportLedgers} className="px-3 sm:px-4 py-2 bg-background border border-border/50 text-foreground font-bold rounded-lg hover:bg-muted/50 transition-colors shadow-sm flex items-center gap-2 text-xs sm:text-sm">
            <Download className="w-4 h-4 text-primary" /> Export Ledgers
          </button>
          <button
            onClick={() => openAddTx()}
            className="px-3 sm:px-4 py-2 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90 transition-opacity shadow-sm flex items-center gap-2 text-xs sm:text-sm"
          >
            <Plus className="w-4 h-4" /> Add Transaction
          </button>
        </div>
      </div>

      {/* Accounts */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { id: "all", label: "All Transactions", Icon: Users, count: transactions.length },
          ...bankAccounts.map((b) => ({ id: bankIdOf(b), label: bankLabel(b), Icon: Landmark, count: transactions.filter((t) => t.bankAccountId === bankIdOf(b)).length })),
        ].map(({ id, label, Icon, count }) => (
          <button
            key={id}
            onClick={() => setSelectedAccount(id)}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold border transition-colors flex items-center gap-2 shadow-sm ${selectedAccount === id ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border/50 text-muted-foreground hover:text-foreground"}`}
          >
            <Icon className="w-4 h-4" /> {label}
            <span className={`text-xs px-2 py-0.5 rounded-full ${selectedAccount === id ? "bg-primary-foreground/20" : "bg-muted"}`}>{count}</span>
          </button>
        ))}
      </div>

      {/* Filters & Search */}
      <div className="bg-background border border-border/50 rounded-2xl p-3 flex flex-wrap items-center gap-3 sm:gap-4 shadow-sm justify-between">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 w-full md:w-auto">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-muted-foreground pl-1 sm:pl-2">
            <Filter className="w-4 h-4" /> Filters:
          </div>
          <DateRangeFilter dateRange={dateRange} onChange={setDateRange} placeholder="Filter by date range" className="w-full sm:w-auto" />
        </div>
        <SearchInput placeholder="Search clients, descriptions, banks..." value={searchQuery} onChange={setSearchQuery} containerClassName="w-full md:w-96" />
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          {
            label: "Total Inflow", value: totalInflow, Icon: ArrowUpRight,
            card: "bg-emerald-500/5 border-emerald-500/20", text: "text-emerald-700 dark:text-emerald-400", iconBox: "bg-emerald-500/15 text-emerald-600",
          },
          {
            label: "Total Outflow", value: totalOutflow, Icon: ArrowDownLeft,
            card: "bg-rose-500/5 border-rose-500/20", text: "text-rose-700 dark:text-rose-400", iconBox: "bg-rose-500/15 text-rose-600",
          },
          {
            label: "Closing Balance", value: viewOpening + totalInflow - totalOutflow, Icon: Wallet,
            card: "bg-indigo-500/5 border-indigo-500/20", text: "text-indigo-700 dark:text-indigo-400", iconBox: "bg-indigo-500/15 text-indigo-600",
          },
        ].map(({ label, value, Icon, card, text, iconBox }) => (
          <div key={label} className={`border rounded-2xl p-5 shadow-sm flex items-center justify-between gap-4 ${card}`}>
            <div className="min-w-0">
              <div className={`text-xs font-bold mb-1.5 ${text}`}>{label}</div>
              {loading
                ? <Skeleton className="h-8 w-40" />
                : <div className={`text-2xl sm:text-3xl font-black truncate ${text}`}>{value < 0 ? "-" : ""}₹{formatINR(Math.abs(value))}</div>}
            </div>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${iconBox}`}>
              <Icon className="w-5 h-5" />
            </div>
          </div>
        ))}
      </div>

      {/* Expandable Data Table */}
      <div className="bg-card border border-border/50 rounded-2xl shadow-sm flex flex-col overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead className="bg-muted/30 text-muted-foreground font-extrabold uppercase tracking-wider text-xs border-b border-border/50">
              <tr>
                <th className="p-4 w-12 text-center"></th>
                <SortableHeader label="Client / Category" sortKey="party" currentSort={sortConfig} onSort={requestSort} className="p-4" />
                <SortableHeader label="Total Inflow" sortKey="totalInflow" currentSort={sortConfig} onSort={requestSort} className="p-4 text-emerald-600 dark:text-emerald-500" />
                <SortableHeader label="Total Outflow" sortKey="totalOutflow" currentSort={sortConfig} onSort={requestSort} className="p-4 text-rose-600 dark:text-rose-500" />
                <SortableHeader label="Net Balance" sortKey="netBalance" currentSort={sortConfig} onSort={requestSort} className="p-4 text-primary" />
                <th className="p-4 pr-6 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {loading && Array.from({ length: 4 }, (_, i) => (
                <tr key={`skeleton-${i}`}><td colSpan={6} className="p-4"><Skeleton className="h-6 w-full" /></td></tr>
              ))}
              {!loading && sortedParties.length === 0 && (
                <tr><td colSpan={6} className="p-10 text-center text-sm font-medium text-muted-foreground">No transactions found. Click "Add Transaction" to record one.</td></tr>
              )}
              {!loading && sortedParties.map((row: any) => {
                const isExpanded = expandedParties.includes(row.party);
                return (
                  <PartyRows
                    key={row.party}
                    row={row}
                    isExpanded={isExpanded}
                    onToggle={() => toggleExpand(row.party)}
                    onAdd={() => openAddTx(row.party)}
                    onEdit={openEditTx}
                    onDelete={setDeleteTx}
                    accountLabelOf={accountLabelOf}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- ADD / EDIT TRANSACTION MODAL --- */}
      <Dialog open={isTxOpen} onOpenChange={setIsTxOpen}>
        <DialogContent className="w-[calc(100vw-16px)] sm:w-full sm:max-w-lg max-h-[90dvh] flex flex-col p-0 overflow-hidden rounded-2xl sm:rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className="p-4 border-b border-border/50 flex justify-between items-center bg-primary/5">
            <div>
              <h3 className="font-black text-lg text-foreground">{editingTxId ? "Edit Client Transaction" : "Add Client Transaction"}</h3>
              <p className="text-xs font-medium text-muted-foreground">{editingTxId ? "Update this inflow or outflow." : "Record a new inflow or outflow."}</p>
            </div>
            <button onClick={() => setIsTxOpen(false)} className="p-2 hover:bg-muted rounded-full transition-colors">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          <div className="p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-5 overflow-y-auto max-h-[70vh]">
            <div className="space-y-1.5">
              <label className={LABEL}>Client / Category *</label>
              <input type="text" placeholder="Enter client / category name" value={txForm.party} onChange={(e) => setTxForm((p) => ({ ...p, party: e.target.value }))} className={INPUT} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className={LABEL}>Date</label>
                <input type="date" value={txForm.date} onChange={(e) => setTxForm((p) => ({ ...p, date: e.target.value }))} className={INPUT} />
              </div>
              <div className="space-y-1.5">
                <label className={LABEL}>Transaction Type</label>
                <SearchableSelect value={txForm.type} onChange={(v) => setTxForm((p) => ({ ...p, type: v }))} options={TYPE_OPTIONS} className={SELECT} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className={LABEL}>Amount (₹) *</label>
                <input type="number" placeholder="0.00" value={txForm.amount} onChange={(e) => setTxForm((p) => ({ ...p, amount: e.target.value }))} className={INPUT} />
                <div className="flex flex-wrap gap-1 pt-1">
                  {QUICK_AMOUNTS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setTxForm((p) => ({ ...p, amount: String((parseFloat(p.amount) || 0) + n) }))}
                      className="px-1.5 py-px rounded border border-primary/20 bg-primary/5 text-primary text-[9px] font-semibold leading-4 hover:bg-primary/10 transition-colors"
                    >
                      +{n.toLocaleString("en-IN")}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className={LABEL}>Payment Method</label>
                <SearchableSelect
                  value={txForm.method}
                  onChange={(v) => setTxForm((p) => ({ ...p, method: v, bankAccountId: v !== "Cash" && !p.bankAccountId ? defaultBankId() : p.bankAccountId }))}
                  options={methodOptions}
                  searchPlaceholder="Search or add method..."
                  emptyMessage="Type a method above to add it."
                  onCreate={(name) => name.trim()}
                  className={SELECT}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className={LABEL}>Bank Account {isCash ? "" : "*"}</label>
              {isCash ? (
                <div className="w-full px-3 py-2 bg-muted/40 border border-border/50 rounded-lg text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <Wallet className="w-4 h-4" /> Not needed for cash payments
                </div>
              ) : bankOptions.length ? (
                <SearchableSelect
                  value={txForm.bankAccountId}
                  onChange={(v) => setTxForm((p) => ({ ...p, bankAccountId: v }))}
                  options={bankOptions}
                  placeholder="Select bank account"
                  searchPlaceholder="Search bank..."
                  className={SELECT}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => { resetBankForm(); setIsBanksOpen(true); }}
                  className="w-full px-3 py-2 border border-dashed border-primary/50 text-primary rounded-lg text-sm font-bold hover:bg-primary/5 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Add a bank account first
                </button>
              )}
            </div>
            <div className="space-y-1.5">
              <label className={LABEL}>Description</label>
              <input type="text" placeholder="Short description" value={txForm.description} onChange={(e) => setTxForm((p) => ({ ...p, description: e.target.value }))} className={INPUT} />
            </div>
            <div className="space-y-1.5">
              <label className={LABEL}>Remarks / Notes</label>
              <textarea rows={2} placeholder="Any additional notes" value={txForm.remarks} onChange={(e) => setTxForm((p) => ({ ...p, remarks: e.target.value }))} className={INPUT} />
            </div>
          </div>
          <div className="px-4 sm:px-6 md:px-8 py-4 md:py-6 bg-muted/30 border-t border-border/50 flex justify-end gap-3 mt-auto shrink-0">
            <button onClick={() => setIsTxOpen(false)} className="px-4 py-2 font-bold text-sm bg-background border border-border/50 rounded-lg hover:bg-muted transition-colors text-muted-foreground">Cancel</button>
            <button onClick={saveTx} className="px-4 py-2 font-bold text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-sm">{editingTxId ? "Save Changes" : "Save Transaction"}</button>
          </div>
        </DialogContent>
      </Dialog>

      {/* --- MANAGE BANKS MODAL --- */}
      <Dialog open={isBanksOpen} onOpenChange={(open) => { setIsBanksOpen(open); if (!open) resetBankForm(); }}>
        <DialogContent className="w-[calc(100vw-16px)] sm:w-full sm:max-w-3xl max-h-[90dvh] flex flex-col p-0 overflow-hidden rounded-2xl sm:rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className="p-4 border-b border-border/50 flex justify-between items-center bg-primary/5 shrink-0">
            <div>
              <h3 className="font-black text-lg text-foreground">Manage Bank Accounts</h3>
              <p className="text-xs font-medium text-muted-foreground">Bank accounts used only on this page.</p>
            </div>
            <button onClick={() => setIsBanksOpen(false)} className="p-2 hover:bg-muted rounded-full transition-colors">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          <div className="p-4 sm:p-6 md:p-8 space-y-6 overflow-y-auto max-h-[70vh]">
            {/* Add / Edit Bank Form */}
            <div className="bg-muted/30 border border-border/50 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-foreground">{editingBankId ? "Edit Bank Account" : "Add New Bank"}</h4>
                {editingBankId && <button onClick={resetBankForm} className="text-xs font-bold text-muted-foreground hover:text-foreground">Cancel edit</button>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {([
                  ["nickname", "Nickname *", "e.g. HDFC Primary"],
                  ["bank_name", "Bank Name *", "e.g. HDFC Bank"],
                  ["account_number", "Account Number *", "e.g. 50100123456789"],
                  ["ifsc_code", "IFSC Code *", "e.g. HDFC0001234"],
                  ["account_name", "Account Holder Name", "e.g. HK Digiverse"],
                  ["branch", "Branch", "e.g. Surat Main"],
                  ["upi_id", "UPI ID", "e.g. company@hdfcbank"],
                ] as const).map(([key, label, placeholder]) => (
                  <div key={key} className="space-y-1.5">
                    <label className={LABEL}>{label}</label>
                    <input type="text" placeholder={placeholder} value={bankForm[key]} onChange={(e) => setBankForm((p) => ({ ...p, [key]: e.target.value }))} className={INPUT} />
                  </div>
                ))}
                <div className="space-y-1.5">
                  <label className={LABEL}>Opening Balance (₹)</label>
                  <input type="number" placeholder="0.00" value={bankForm.opening} onChange={(e) => setBankForm((p) => ({ ...p, opening: e.target.value }))} className={INPUT} />
                </div>
              </div>
              <button onClick={saveBank} className="w-full sm:w-auto px-4 py-2 bg-primary text-primary-foreground font-bold text-sm rounded-lg hover:bg-primary/90 transition-colors shadow-sm">
                {editingBankId ? "Save Changes" : "Add Bank Account"}
              </button>
            </div>

            {/* Banks List */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-foreground">Current Accounts</h4>
              <div className="border border-border/50 rounded-xl overflow-x-auto shadow-inner bg-card">
                <table className="w-full text-left whitespace-nowrap">
                  <thead className="bg-muted/30 border-b border-border/50 text-muted-foreground text-[10px] font-black uppercase tracking-widest">
                    <tr>
                      <th className="p-3 pl-4">Account</th>
                      <th className="p-3">Bank / IFSC</th>
                      <th className="p-3 text-right">Opening</th>
                      <th className="p-3 text-right">Client Net</th>
                      <th className="p-3 pr-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50 text-sm">
                    {bankAccounts.length === 0 && (
                      <tr><td colSpan={5} className="p-6 text-center text-xs font-medium text-muted-foreground">No bank accounts yet.</td></tr>
                    )}
                    {bankAccounts.map((b) => {
                      const id = bankIdOf(b);
                      const flow = bankFlow(id);
                      return (
                        <tr key={id} className={`hover:bg-muted/30 transition-colors ${editingBankId === id ? "bg-primary/5" : ""}`}>
                          <td className="p-3 pl-4">
                            <div className="font-bold text-foreground flex items-center gap-2"><Landmark className="w-4 h-4 text-primary" /> {bankLabel(b)}</div>
                            {(b.account_name || b.upi_id) && <div className="text-[11px] text-muted-foreground mt-0.5 pl-6">{[b.account_name, b.upi_id].filter(Boolean).join(" · ")}</div>}
                          </td>
                          <td className="p-3 text-xs text-muted-foreground">
                            <div className="font-semibold text-foreground">{b.bank_name}{b.branch ? `, ${b.branch}` : ""}</div>
                            <div>{b.ifsc_code}</div>
                          </td>
                          <td className="p-3 text-right font-medium text-muted-foreground">₹{formatINR(Number(b.opening_balance) || 0)}</td>
                          <td className={`p-3 text-right font-black ${flow >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{flow >= 0 ? "+" : "-"}₹{formatINR(Math.abs(flow))}</td>
                          <td className="p-3 pr-4">
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={() => startEditBank(b)} className="text-muted-foreground hover:text-foreground p-1" title="Edit bank account"><Edit3 className="w-4 h-4" /></button>
                              <button onClick={() => requestDeleteBank(b)} className="text-rose-500 hover:text-rose-600 p-1" title="Delete bank account"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        isOpen={!!deleteTx}
        onClose={() => setDeleteTx(null)}
        onConfirm={confirmDeleteTx}
        title="Delete Transaction"
        description={`Are you sure you want to delete this ${deleteTx?.type || ""} of ₹${formatINR(deleteTx?.amount || 0)} for "${deleteTx?.party || ""}"?`}
      />
      <ConfirmModal
        isOpen={!!deleteBank}
        onClose={() => setDeleteBank(null)}
        onConfirm={confirmDeleteBank}
        title="Delete Bank Account"
        description={`Delete "${deleteBank ? bankLabel(deleteBank) : ""}"? This cannot be undone.`}
        confirmText="Delete"
      />
    </div>
  );
}

type PartyRowsProps = {
  row: PartyRow;
  isExpanded: boolean;
  onToggle: () => void;
  onAdd: () => void;
  onEdit: (t: Tx) => void;
  onDelete: (t: Tx) => void;
  accountLabelOf: (t: Tx) => string;
};

function PartyRows({ row, isExpanded, onToggle, onAdd, onEdit, onDelete, accountLabelOf }: PartyRowsProps) {
  const txs = [...row.transactions].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <tr onClick={onToggle} className="hover:bg-muted/30 cursor-pointer transition-colors group">
        <td className="p-4 text-center">
          <div className="flex justify-center">
            {isExpanded
              ? <ChevronDown className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
              : <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />}
          </div>
        </td>
        <td className="p-4 font-black text-foreground">
          {row.party} <span className="ml-1 text-[11px] font-bold text-muted-foreground">({row.transactions.length})</span>
        </td>
        <td className="p-4 font-bold text-emerald-600 dark:text-emerald-500">₹{formatINR(row.totalInflow)}</td>
        <td className="p-4 font-bold text-rose-600 dark:text-rose-500">₹{formatINR(row.totalOutflow)}</td>
        <td className={`p-4 font-black ${row.netBalance >= 0 ? "text-primary" : "text-rose-600"}`}>{row.netBalance < 0 ? "-" : ""}₹{formatINR(Math.abs(row.netBalance))}</td>
        <td className="p-4 pr-6 text-center" onClick={(e) => e.stopPropagation()}>
          <button onClick={onAdd} className="px-3 py-1.5 text-xs font-bold bg-background border border-border/50 hover:bg-muted transition-colors rounded-md shadow-sm inline-flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </td>
      </tr>
      {isExpanded && (
        <tr className="bg-muted/10">
          <td colSpan={6} className="p-2 sm:p-4 sm:pl-12 sm:pr-6">
            <div className="border border-border/50 rounded-xl overflow-x-auto shadow-inner bg-card">
              <table className="w-full min-w-[760px] whitespace-nowrap text-left">
                <thead className="bg-muted/30 border-b border-border/50 text-muted-foreground text-[10px] font-black uppercase tracking-widest">
                  <tr>
                    <th className="p-3 pl-4">Date</th>
                    <th className="p-3">Type</th>
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3">Description</th>
                    <th className="p-3">Method</th>
                    <th className="p-3">Bank</th>
                    <th className="p-3">Remarks</th>
                    <th className="p-3 pr-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50 text-xs">
                  {txs.map((tx) => (
                    <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 pl-4 font-medium text-muted-foreground">
                        <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {formatDate(tx.date)}</span>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${tx.type === "inflow" ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"}`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className={`p-3 text-right font-black ${tx.type === "inflow" ? "text-emerald-600" : "text-rose-600"}`}>₹{formatINR(tx.amount)}</td>
                      <td className="p-3 font-bold text-foreground">{tx.description || "-"}</td>
                      <td className="p-3 font-medium text-muted-foreground">{tx.method || "-"}</td>
                      <td className="p-3 font-medium text-muted-foreground">{accountLabelOf(tx)}</td>
                      <td className="p-3 font-medium text-muted-foreground truncate max-w-[180px]" title={tx.remarks}>{tx.remarks || "-"}</td>
                      <td className="p-3 pr-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => onEdit(tx)} className="text-muted-foreground hover:text-foreground transition-colors p-2 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 inline-flex items-center justify-center" title="Edit">
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => onDelete(tx)} className="text-rose-500 hover:text-rose-600 transition-colors p-2 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 inline-flex items-center justify-center" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
