import { useState, useEffect, useMemo } from "react";
import { Download, Plus, Wallet, Building2, Filter, ArrowDownLeft, ArrowUpRight, ArrowRight, Edit3, Trash2, X, Sparkles, Upload, CheckCircle2, Paperclip } from "lucide-react";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/select";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableHeader } from "@/components/ui/sortable-header";
import { DateRangeFilter } from "@/components/common/DateRangeFilter";
import { SearchInput } from "@/components/common/SearchInput";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { API_URL } from "@/lib/config";

type AccountTab = "bank" | "cash";

const todayISO = () => new Date().toISOString().slice(0, 10);
const formatDate = (iso: string) => {
  if (!iso) return "-";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return y && m && d ? `${Number(d)}/${Number(m)}/${y}` : iso;
};
const formatINR = (n: number) => (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const emptyCreditForm = () => ({ ref_no: "", date: todayISO(), amount: "", description: "", service: "", remarks: "", attachment: "", invoice_id: "" });
type OptionKind = "credit-category" | "debit-category" | "brand";
type OptionList = { custom: string[]; hidden: string[] };
const OPTION_KINDS: OptionKind[] = ["credit-category", "debit-category", "brand"];
const toOptionList = (res: any): OptionList => ({ custom: res?.custom || [], hidden: res?.hidden || [] });
const emptyDebtForm = () => ({ ref_no: "", date: todayISO(), amount: "", things: "", narrative: "", attachment: "" });

const mapTrx = (t: any) => ({
  id: String(t._id || t.id),
  refNo: t.ref_no || "",
  type: t.type,
  account: t.account,
  date: t.date || "",
  amount: Number(t.amount) || 0,
  category: t.category || "",
  brand: t.brand || "",
  description: t.description || "",
  service: t.service || "",
  remarks: t.remarks || "",
  things: t.things || "",
  narrative: t.narrative || "",
  source: t.source || "manual",
  invoiceId: t.invoice_id || "",
  attachment: t.attachment || "",
});

const toFileUrl = (path: string) => (/^https?:\/\//i.test(path) ? path : path.startsWith("/") ? `${API_URL}${path}` : "");

export function Transactions() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [openingBalances, setOpeningBalances] = useState<{ bank: number; cash: number }>({ bank: 0, cash: 0 });
  const [isOpeningOpen, setIsOpeningOpen] = useState(false);
  const [openingForm, setOpeningForm] = useState({ bank: "0", cash: "0" });

  const fetchTransactions = async () => {
    try {
      const res = await api.get<any[]>("/transactions", { showLoader: false });
      setTransactions((Array.isArray(res) ? res : []).map(mapTrx));
    } catch {
      setTransactions([]);
    }
  };

  const fetchOpeningBalances = async () => {
    try {
      const res = await api.get<any>("/transactions/opening-balances", { showLoader: false, showErrorToast: false });
      setOpeningBalances({ bank: Number(res?.bank) || 0, cash: Number(res?.cash) || 0 });
    } catch { /* keep defaults */ }
  };

  useEffect(() => {
    fetchTransactions();
    fetchOpeningBalances();
  }, []);

  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean, id: string | null, type: 'credit' | 'debit' }>({ isOpen: false, id: null, type: 'credit' });

  const [editCredit, setEditCredit] = useState<any | null>(null);
  const [editDebit, setEditDebit] = useState<any | null>(null);

  const openEditCredit = (trx: any) => setEditCredit({ ...trx });
  const openEditDebit = (trx: any) => setEditDebit({ ...trx });

  const saveEdit = async (trx: any, close: () => void) => {
    if (!trx.date || !(trx.amount > 0)) {
      toast.error("Date and a valid amount are required");
      return;
    }
    try {
      await api.put(`/transactions/${trx.id}`, {
        ref_no: trx.refNo,
        date: trx.date,
        amount: trx.amount,
        category: trx.category,
        brand: trx.brand,
        description: trx.description,
        service: trx.service,
        remarks: trx.remarks,
        things: trx.things,
        narrative: trx.narrative,
      });
      toast.success("Transaction updated");
      close();
      fetchTransactions();
    } catch { /* api shows error toast */ }
  };

  const saveEditCredit = () => editCredit && saveEdit(editCredit, () => setEditCredit(null));
  const saveEditDebit = () => editDebit && saveEdit(editDebit, () => setEditDebit(null));

  const [isAddCreditOpen, setIsAddCreditOpen] = useState(false);
  const [isAddDebtOpen, setIsAddDebtOpen] = useState(false);
  const [creditForm, setCreditForm] = useState(emptyCreditForm);
  const [debtForm, setDebtForm] = useState(emptyDebtForm);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeAccountTab, setActiveAccountTab] = useState<AccountTab>("bank");

  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [filterCategory, setFilterCategory] = useState("All Categories");
  const [filterSyncStatus, setFilterSyncStatus] = useState("All Entries");
  const [addCreditCategory, setAddCreditCategory] = useState("");
  const [addDebtCategory, setAddDebtCategory] = useState("");
  const [addCreditBrand, setAddCreditBrand] = useState("");
  const [addDebtBrand, setAddDebtBrand] = useState("");

  // Invoices for the credit modal's quick-select; brands + saved option lists for the dropdowns
  const [invoices, setInvoices] = useState<any[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [optionLists, setOptionLists] = useState<Record<OptionKind, OptionList>>({
    "credit-category": { custom: [], hidden: [] },
    "debit-category": { custom: [], hidden: [] },
    brand: { custom: [], hidden: [] },
  });
  const [optionToRemove, setOptionToRemove] = useState<{ kind: OptionKind; name: string } | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  useEffect(() => {
    api.get<any>("/invoices/ledger/brands?page=1&limit=1000", { showLoader: false, showErrorToast: false })
      .then((res) => setBrands((res?.data || []).map((b: any) => b.brand).filter(Boolean)))
      .catch(() => setBrands([]));
    OPTION_KINDS.forEach((kind) => {
      api.get<any>(`/transactions/options/${kind}`, { showLoader: false, showErrorToast: false })
        .then((res) => setOptionLists((p) => ({ ...p, [kind]: toOptionList(res) })))
        .catch(() => {});
    });
  }, []);

  useEffect(() => {
    if (!isAddCreditOpen) return;
    api.get<any>("/invoices?page=1&limit=1000", { showLoader: false, showErrorToast: false })
      .then((res) => setInvoices(Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []))
      .catch(() => setInvoices([]));
  }, [isAddCreditOpen]);

  // Resolve a credit entry to its invoice: linked invoice id first, else a matching invoice number
  const invoiceByNumber = useMemo(
    () => new Map(invoices.filter((i: any) => i.invoice_number).map((i: any) => [String(i.invoice_number).toLowerCase(), String(i.id || i._id)])),
    [invoices],
  );
  const findInvoiceId = (trx: any) => trx.invoiceId || (trx.refNo && invoiceByNumber.get(trx.refNo.toLowerCase())) || "";

  // All invoices, latest first
  const invoiceOptions = useMemo(() => [...invoices]
    .sort((a: any, b: any) => String(b.issue_date || "").localeCompare(String(a.issue_date || "")))
    .map((inv: any) => ({
      label: `${inv.invoice_number || "Invoice"} — ${inv.brand || inv.client_name || "Unknown"} — ${formatDate(inv.issue_date || "")} — ₹${formatINR(Number(inv.total_due) || 0)}`,
      value: String(inv.id || inv._id),
    })), [invoices]);

  // Dropdown options: known values + saved custom ones, minus removed ones (selected values always stay visible)
  const buildOptions = (kind: OptionKind, known: string[], selected: (string | undefined)[]) => {
    const hidden = new Set(optionLists[kind].hidden);
    const all = new Set<string>([...known, ...optionLists[kind].custom].filter((v) => v && !hidden.has(v)));
    selected.forEach((v) => { if (v) all.add(v); });
    return Array.from(all).sort().map((v) => ({ label: v, value: v }));
  };

  const creditCategoryOptions = useMemo(
    () => buildOptions("credit-category", transactions.filter((t) => t.type === "credit").map((t) => t.category), [addCreditCategory, editCredit?.category]),
    [optionLists, transactions, addCreditCategory, editCredit],
  );
  const debitCategoryOptions = useMemo(
    () => buildOptions("debit-category", transactions.filter((t) => t.type === "debit").map((t) => t.category), [addDebtCategory, editDebit?.category]),
    [optionLists, transactions, addDebtCategory, editDebit],
  );
  const brandOptions = useMemo(
    () => buildOptions("brand", [...brands, ...transactions.map((t) => t.brand)], [addCreditBrand, editCredit?.brand, addDebtBrand, editDebit?.brand]),
    [optionLists, brands, transactions, addCreditBrand, editCredit, addDebtBrand, editDebit],
  );

  const addOption = (kind: OptionKind) => (input: string) => {
    api.post<any>(`/transactions/options/${kind}`, { name: input }, { showLoader: false })
      .then((res) => setOptionLists((p) => ({ ...p, [kind]: toOptionList(res) })))
      .catch(() => {});
    return input;
  };

  const confirmRemoveOption = async () => {
    const target = optionToRemove;
    setOptionToRemove(null);
    if (!target) return;
    const { kind, name } = target;
    try {
      const res = await api.post<any>(`/transactions/options/${kind}/remove`, { name }, { showLoader: false });
      setOptionLists((p) => ({ ...p, [kind]: toOptionList(res) }));
      if (kind === "credit-category" && addCreditCategory === name) setAddCreditCategory("");
      if (kind === "debit-category" && addDebtCategory === name) setAddDebtCategory("");
      if (kind === "brand" && addCreditBrand === name) setAddCreditBrand("");
      if (kind === "brand" && addDebtBrand === name) setAddDebtBrand("");
      toast.success(`"${name}" removed from the list`);
    } catch { /* api shows error toast */ }
  };

  const applyInvoice = (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId);
    const inv = invoices.find((i: any) => String(i.id || i._id) === invoiceId);
    if (!inv) return;
    setCreditForm((p) => ({
      ...p,
      ref_no: inv.invoice_number || "",
      date: (inv.issue_date || p.date || todayISO()).slice(0, 10),
      amount: String(Number(inv.total_due) || ""),
      description: inv.client_name || "",
      service: (inv.line_items || []).map((li: any) => li.description).filter(Boolean).join(", "),
      remarks: inv.notes || "",
      attachment: inv.pdf_url || p.attachment,
      invoice_id: invoiceId,
    }));
    setAddCreditBrand("");
    setAddCreditCategory("");
  };

  const uploadAttachment = async (file: File | undefined, target: "credit" | "debit" = "credit") => {
    if (!file) return;
    setUploadingAttachment(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post<any>("/transactions/upload-attachment", formData);
      const attachment = res?.url || file.name;
      if (target === "credit") setCreditForm((p) => ({ ...p, attachment }));
      else setDebtForm((p) => ({ ...p, attachment }));
      toast.success("Attachment uploaded");
    } catch { /* api shows error toast */ }
    finally { setUploadingAttachment(false); }
  };

  const resetCreditModal = () => {
    setCreditForm(emptyCreditForm());
    setAddCreditCategory("");
    setAddCreditBrand("");
    setSelectedInvoiceId("");
  };

  const resetDebtModal = () => {
    setDebtForm(emptyDebtForm());
    setAddDebtCategory("");
    setAddDebtBrand("");
  };

  const saveNew = async (type: "credit" | "debit") => {
    const form: any = type === "credit" ? creditForm : debtForm;
    const amount = parseFloat(form.amount);
    if (!form.date || !(amount > 0)) {
      toast.error("Date and a valid amount are required");
      return;
    }
    if (type === "credit" && !addCreditCategory) {
      toast.error("Please select a category");
      return;
    }
    try {
      await api.post("/transactions", {
        ...form,
        type,
        account: activeAccountTab,
        amount,
        category: type === "credit" ? addCreditCategory : (addDebtCategory.trim() || "General"),
        brand: (type === "credit" ? addCreditBrand : addDebtBrand) || null,
      });
      toast.success(type === "credit" ? "Credit added" : "Expense added");
      if (type === "credit") {
        resetCreditModal();
        setIsAddCreditOpen(false);
      } else {
        resetDebtModal();
        setIsAddDebtOpen(false);
      }
      fetchTransactions();
    } catch { /* api shows error toast */ }
  };

  // Opening balances are locked once any credit or debit entry exists
  const openingLocked = transactions.length > 0;

  const openOpeningBalances = () => {
    setOpeningForm({ bank: String(openingBalances.bank), cash: String(openingBalances.cash) });
    setIsOpeningOpen(true);
  };

  const saveOpeningBalances = async () => {
    if (openingLocked) return;
    const payload = { bank: parseFloat(openingForm.bank) || 0, cash: parseFloat(openingForm.cash) || 0 };
    try {
      await api.put("/transactions/opening-balances", payload);
      setOpeningBalances(payload);
      setIsOpeningOpen(false);
      toast.success("Opening balances saved");
    } catch { /* api shows error toast */ }
  };

  // Transactions of the active account (bank / cash), used for totals and category options
  const accountTransactions = useMemo(
    () => transactions.filter((t) => t.account === activeAccountTab),
    [transactions, activeAccountTab]
  );

  const categoryOptions = useMemo(() => {
    const cats = Array.from(new Set([
      ...accountTransactions.map((t) => t.category),
      ...creditCategoryOptions.map((o) => o.value),
      ...debitCategoryOptions.map((o) => o.value),
    ].filter(Boolean))).sort();
    return [{ label: "All Categories", value: "All Categories" }, ...cats.map((c) => ({ label: c, value: c }))];
  }, [accountTransactions, creditCategoryOptions, debitCategoryOptions]);

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const toISO = (d?: Date) => d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : "";
    const from = toISO(dateRange?.from);
    const to = toISO(dateRange?.to) || from;
    return accountTransactions.filter((t) => {
      if (filterCategory !== "All Categories" && t.category !== filterCategory) return false;
      if (activeAccountTab === "bank" && filterSyncStatus === "Synced Invoices" && t.source !== "invoice") return false;
      if (activeAccountTab === "bank" && filterSyncStatus === "Manual Entries" && t.source === "invoice") return false;
      if (from && t.date < from) return false;
      if (to && t.date > to) return false;
      if (q) {
        const hay = [t.refNo, t.category, t.brand, t.description, t.service, t.remarks, t.things, t.narrative, String(t.amount)].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [accountTransactions, searchQuery, dateRange, filterCategory, filterSyncStatus, activeAccountTab]);

  const creditTransactions = useMemo(() => filteredTransactions.filter((t) => t.type === "credit"), [filteredTransactions]);
  const debitTransactions = useMemo(() => filteredTransactions.filter((t) => t.type === "debit"), [filteredTransactions]);

  const totalCredit = creditTransactions.reduce((sum, t) => sum + t.amount, 0);
  const totalDebt = debitTransactions.reduce((sum, t) => sum + t.amount, 0);
  const openingBalance = openingBalances[activeAccountTab] || 0;
  const closingBalance = openingBalance + totalCredit - totalDebt;
  const syncedCount = creditTransactions.filter((t) => t.source === "invoice").length;

  const exportLedger = () => {
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = ["Type", "Ref No.", "Date", "Amount", "Category", "Brand", "Description / Things", "Services", "Remarks / Narrative"];
    const rows = filteredTransactions.map((t) => [
      t.type === "credit" ? "Credit" : "Debt", t.refNo, formatDate(t.date), t.amount.toFixed(2), t.category, t.brand,
      t.type === "credit" ? t.description : t.things, t.service, t.type === "credit" ? t.remarks : t.narrative,
    ]);
    const summary = [[], ["Opening Balance", openingBalance.toFixed(2)], ["Total Credit", totalCredit.toFixed(2)], ["Total Debt", totalDebt.toFixed(2)], ["Closing Balance", closingBalance.toFixed(2)]];
    const csv = [header, ...rows, ...summary].map((r) => r.map(esc).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `ledger_${activeAccountTab}_${todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const { items: sortedCredit, requestSort: requestCreditSort, sortConfig: creditSortConfig } = useSortableData(creditTransactions);
  const { items: sortedDebt, requestSort: requestDebtSort, sortConfig: debtSortConfig } = useSortableData(debitTransactions);

  const confirmDelete = async () => {
    if (deleteConfirm.id) {
      try {
        await api.delete(`/transactions/${deleteConfirm.id}`);
        toast.success("Transaction deleted");
        fetchTransactions();
      } catch { /* api shows error toast */ }
    }
    setDeleteConfirm({ isOpen: false, id: null, type: 'credit' });
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500 pb-12 relative min-w-0">

      {/* Header */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
            Financial Ledger Management
          </h1>
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm font-medium">
            Track Credit (Invoices) and Debt (Expenses) with dynamic balance calculations
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-2.5 w-full xl:w-auto">
          <button onClick={openOpeningBalances} className="px-3 sm:px-4 py-2 bg-background border border-border/50 text-foreground font-bold rounded-lg hover:bg-muted/50 transition-colors shadow-sm flex items-center gap-2 text-xs sm:text-sm">
            <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500" /> Opening Balances
          </button>
          <button onClick={exportLedger} className="px-3 sm:px-4 py-2 bg-background border border-border/50 text-foreground font-bold rounded-lg hover:bg-muted/50 transition-colors shadow-sm flex items-center gap-2 text-xs sm:text-sm">
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-500" /> Export Ledger
          </button>
          <button
            onClick={() => setIsAddCreditOpen(true)}
            className="px-3 sm:px-4 py-2 bg-primary text-primary-foreground font-bold rounded-lg hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2 text-xs sm:text-sm"
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Add Credit (Invoice)
          </button>
          <button
            onClick={() => setIsAddDebtOpen(true)}
            className="px-3 sm:px-4 py-2 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700 transition-colors shadow-sm flex items-center gap-2 text-xs sm:text-sm"
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Add Debt (Expense)
          </button>
        </div>
      </div>

      {/* Account Tabs & Search */}
      <div className="flex flex-col md:flex-row justify-between gap-3 sm:gap-4 bg-muted/30 p-2 rounded-2xl border border-border/50">
        <div className="flex flex-wrap sm:flex-nowrap gap-2">
          <button
            className={`flex-1 sm:flex-initial px-4 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${activeAccountTab === "bank"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            onClick={() => setActiveAccountTab("bank")}
          >
            <Building2 className="w-4 h-4 text-emerald-600" /> Bank Acc Management
          </button>
          <button
            className={`flex-1 sm:flex-initial px-4 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${activeAccountTab === "cash"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            onClick={() => setActiveAccountTab("cash")}
          >
            <Wallet className="w-4 h-4 text-amber-600" /> Cash Transaction
          </button>
        </div>
        <SearchInput
          placeholder="Search invoices, expenses, narratives..."
          value={searchQuery}
          onChange={setSearchQuery}
          containerClassName="w-full md:w-96"
        />
      </div>

      {/* Filters */}
      <div className="bg-background border border-border/50 rounded-2xl p-3 flex flex-wrap items-center gap-3 sm:gap-4 shadow-sm">
        <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-muted-foreground pl-1 sm:pl-2">
          <Filter className="w-4 h-4" /> Filters:
        </div>

        <DateRangeFilter
          dateRange={dateRange}
          onChange={setDateRange}
          placeholder="Filter by transaction date"
          className="w-full sm:w-auto"
        />

        <div className="flex items-center gap-2 text-xs sm:text-sm">
          <span className="text-muted-foreground font-medium">Category:</span>
          <SearchableSelect
            value={filterCategory}
            onChange={setFilterCategory}
            options={categoryOptions}
            className="w-[140px] h-[34px] pl-3 pr-3 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
          />
        </div>
        {activeAccountTab === "bank" && (
          <div className="flex items-center gap-2 text-xs sm:text-sm border-t sm:border-t-0 sm:border-l border-border/50 pt-2 sm:pt-0 sm:pl-4">
            <span className="text-muted-foreground font-medium">Sync Status:</span>
            <SearchableSelect
              value={filterSyncStatus}
              onChange={setFilterSyncStatus}
              options={[{ label: "All Entries", value: "All Entries" }, { label: "Synced Invoices", value: "Synced Invoices" }, { label: "Manual Entries", value: "Manual Entries" }]}
              className="w-[130px] h-[34px] pl-3 pr-3 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            />
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl" />
          <div className="text-muted-foreground font-extrabold text-[10px] uppercase tracking-widest mb-4">
            {activeAccountTab === "bank" ? "Opening Balance" : "Opening Cash Balance"}
          </div>
          <div className="text-3xl font-black text-foreground mb-4">₹{formatINR(openingBalance)}</div>
          <button onClick={openOpeningBalances} className="text-amber-600 font-bold text-xs flex items-center gap-1 hover:text-amber-700 transition-colors">
            {openingLocked ? "View Opening Balance" : "Configure Opening Balance"} <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl" />
          <div className="text-muted-foreground font-extrabold text-[10px] uppercase tracking-widest mb-4 max-w-[140px] leading-tight">Transaction Total Credit</div>
          <div className="text-3xl font-black text-emerald-600 mb-4">+₹{formatINR(totalCredit)}</div>
          <div className="text-muted-foreground font-medium text-xs">{creditTransactions.length} credit entries ({syncedCount} synced)</div>
        </div>

        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl" />
          <div className="text-muted-foreground font-extrabold text-[10px] uppercase tracking-widest mb-4 max-w-[140px] leading-tight">Transaction Total Debt</div>
          <div className="text-3xl font-black text-rose-600 mb-4">-₹{formatINR(totalDebt)}</div>
          <div className="text-muted-foreground font-medium text-xs">{debitTransactions.length} expense entries recorded</div>
        </div>

        {activeAccountTab === "bank" ? (
          <div className="bg-primary text-primary-foreground rounded-2xl p-5 shadow-sm relative overflow-hidden">
            <div className="absolute -right-12 -top-12 w-40 h-40 bg-primary-foreground/20 rounded-full blur-xl" />
            <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-primary-foreground/10 rounded-full blur-xl" />
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-3">
                <div className="font-extrabold text-[10px] uppercase tracking-widest text-primary-foreground/80 flex items-center gap-1.5">
                  <span className="text-amber-300">✨</span> Closing Balance In Bank
                </div>
                <div className="w-8 h-8 rounded-full bg-primary-foreground/20 flex items-center justify-center border border-primary-foreground/30">
                  <span className="text-sm font-bold text-primary-foreground">₹</span>
                </div>
              </div>
              <div className="text-4xl font-black mb-3 text-primary-foreground">₹{formatINR(closingBalance)}</div>
              <div className="text-primary-foreground/70 font-medium text-[10px] leading-tight opacity-90 max-w-[180px]">
                Opening Balance + Total Credit - Total Debt
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-primary text-primary-foreground rounded-2xl p-5 shadow-sm relative overflow-hidden">
            <div className="absolute -right-12 -top-12 w-40 h-40 bg-primary-foreground/20 rounded-full blur-xl" />
            <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-primary-foreground/10 rounded-full blur-xl" />
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-3">
                <div className="font-extrabold text-[10px] uppercase tracking-widest text-primary-foreground/80 flex items-center gap-1.5">
                  <span className="text-amber-300">✨</span> Cash In Hand
                </div>
                <div className="w-8 h-8 rounded-full bg-primary-foreground/20 flex items-center justify-center border border-primary-foreground/30">
                  <span className="text-sm font-bold text-primary-foreground">₹</span>
                </div>
              </div>
              <div className="text-4xl font-black mb-3 text-primary-foreground">₹{formatINR(closingBalance)}</div>
              <div className="text-primary-foreground/70 font-medium text-[10px] leading-tight opacity-90 max-w-[180px]">
                Opening Balance + Total Credit - Total Debt
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Side-by-Side Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Credit Table */}
        <div className="bg-card border border-border/50 rounded-2xl shadow-sm flex flex-col h-full">
          <div className="p-4 border-b border-border/50 flex justify-between items-center bg-emerald-500/5 rounded-t-2xl">
            <div className="flex gap-3 items-center">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <ArrowDownLeft className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-foreground text-lg leading-none">Credit <span className="text-muted-foreground font-bold text-sm">(Income / Invoices)</span></h3>
                <p className="text-xs text-muted-foreground font-medium mt-1">Auto-synced invoices and income</p>
              </div>
            </div>
            <button
              onClick={() => setIsAddCreditOpen(true)}
              className="px-4 py-2 bg-primary text-primary-foreground font-bold rounded-lg hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2 text-sm shrink-0"
            >
              <Plus className="w-4 h-4" /> Add Credit
            </button>
          </div>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead className="bg-background text-muted-foreground text-[10px] font-black uppercase tracking-widest border-b border-border/50">
                <tr>
                  {activeAccountTab === "bank" && <SortableHeader label="Invoice" sortKey="refNo" currentSort={creditSortConfig} onSort={requestCreditSort} className="p-3 pl-4" />}
                  <SortableHeader label="Date" sortKey="date" currentSort={creditSortConfig} onSort={requestCreditSort} className={activeAccountTab === "bank" ? "p-3" : "p-3 pl-4"} />
                  <SortableHeader label="Amount" sortKey="amount" currentSort={creditSortConfig} onSort={requestCreditSort} className="p-3" />
                  <SortableHeader label="Category" sortKey="category" currentSort={creditSortConfig} onSort={requestCreditSort} className="p-3" />
                  <SortableHeader label="Brand" sortKey="brand" currentSort={creditSortConfig} onSort={requestCreditSort} className="p-3" />
                  <SortableHeader label="Descriptions" sortKey="description" currentSort={creditSortConfig} onSort={requestCreditSort} className="p-3" />
                  <SortableHeader label="Services" sortKey="service" currentSort={creditSortConfig} onSort={requestCreditSort} className="p-3" />
                  <SortableHeader label="Remarks" sortKey="remarks" currentSort={creditSortConfig} onSort={requestCreditSort} className="p-3" />
                  <th className="p-3 pr-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {sortedCredit.map((trx: any) => (
                  <tr key={trx.id} className="hover:bg-muted/30 transition-colors">
                    {activeAccountTab === "bank" && (
                      <td className="p-3 pl-4">
                        {(() => {
                          const invoiceId = findInvoiceId(trx);
                          if (invoiceId) {
                            return (
                              <button
                                type="button"
                                onClick={() => window.open(`${API_URL}/invoices/${invoiceId}/pdf`, "_blank")}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 text-xs font-black hover:bg-emerald-500/20 transition-colors"
                                title="Open Invoice"
                              >
                                {trx.refNo || "Invoice"} <CheckCircle2 className="w-3.5 h-3.5" />
                              </button>
                            );
                          }
                          const fileUrl = toFileUrl(trx.attachment);
                          if (!trx.refNo && !trx.attachment) return <span className="text-xs text-muted-foreground">-</span>;
                          return (
                            <button
                              type="button"
                              disabled={!fileUrl}
                              onClick={() => fileUrl && window.open(fileUrl, "_blank")}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-700 text-xs font-black enabled:hover:bg-blue-500/20 transition-colors disabled:cursor-default"
                              title={fileUrl ? "Open Attachment" : trx.attachment || undefined}
                            >
                              {trx.refNo || "DOC"} {trx.attachment && <Paperclip className="w-3.5 h-3.5" />}
                            </button>
                          );
                        })()}
                      </td>
                    )}
                    <td className={`p-3 ${activeAccountTab === "bank" ? "" : "pl-4 "}text-xs font-bold text-muted-foreground`}>{formatDate(trx.date)}</td>
                    <td className="p-3 text-sm font-black text-emerald-600">
                      ₹{formatINR(trx.amount)}
                    </td>
                    <td className="p-3 text-xs font-bold text-foreground">{trx.category}</td>
                    <td className="p-3 text-xs font-medium text-foreground">{trx.brand || "-"}</td>
                    <td className="p-3 text-xs font-medium text-foreground">{trx.description}</td>
                    <td className="p-3 text-xs font-medium text-foreground">{trx.service}</td>
                    <td className="p-3 text-xs font-medium text-muted-foreground truncate max-w-[100px]" title={trx.remarks}>{trx.remarks}</td>
                    <td className="p-3 pr-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => openEditCredit(trx)} className="text-muted-foreground hover:text-foreground transition-colors p-2 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 inline-flex items-center justify-center"><Edit3 className="w-3.5 h-3.5" /></button>
                        <button
                          onClick={() => setDeleteConfirm({ isOpen: true, id: trx.id, type: 'credit' })}
                          className="text-rose-500 hover:text-rose-600 transition-colors p-2 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 inline-flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-border/50 flex justify-between items-center bg-muted/10 rounded-b-2xl">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Transaction Total Credit</span>
            <span className="text-base font-black text-emerald-600">₹{formatINR(totalCredit)}</span>
          </div>
        </div>

        {/* Debt Table */}
        <div className="bg-card border border-border/50 rounded-2xl shadow-sm flex flex-col h-full">
          <div className="p-4 border-b border-border/50 flex justify-between items-center bg-rose-500/5 rounded-t-2xl">
            <div className="flex gap-3 items-center">
              <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <ArrowUpRight className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-foreground text-lg leading-none">Debt <span className="text-muted-foreground font-bold text-sm">(Expenses / Bills)</span></h3>
                <p className="text-xs text-muted-foreground font-medium mt-1">Automatic numbering (YYMMXXX format)</p>
              </div>
            </div>
            <button
              onClick={() => setIsAddDebtOpen(true)}
              className="px-4 py-2 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700 transition-colors shadow-sm flex items-center gap-2 text-sm shrink-0"
            >
              <Plus className="w-4 h-4" /> Add Debt
            </button>
          </div>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead className="bg-background text-muted-foreground text-[10px] font-black uppercase tracking-widest border-b border-border/50">
                <tr>
                  <SortableHeader label="Expense No." sortKey="refNo" currentSort={debtSortConfig} onSort={requestDebtSort} className="p-3 pl-4" />
                  <SortableHeader label="Date" sortKey="date" currentSort={debtSortConfig} onSort={requestDebtSort} className="p-3" />
                  <SortableHeader label="Amount" sortKey="amount" currentSort={debtSortConfig} onSort={requestDebtSort} className="p-3" />
                  <SortableHeader label="Category" sortKey="category" currentSort={debtSortConfig} onSort={requestDebtSort} className="p-3" />
                  <SortableHeader label="Brand" sortKey="brand" currentSort={debtSortConfig} onSort={requestDebtSort} className="p-3" />
                  <SortableHeader label="Things" sortKey="things" currentSort={debtSortConfig} onSort={requestDebtSort} className="p-3" />
                  <SortableHeader label="Narrative" sortKey="narrative" currentSort={debtSortConfig} onSort={requestDebtSort} className="p-3" />
                  <th className="p-3 pr-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {sortedDebt.map((trx: any) => (
                  <tr key={trx.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3 pl-4">
                      <span className="text-xs font-black text-foreground bg-muted/50 px-2 py-0.5 rounded-md border border-border/50">{trx.refNo || "-"}</span>
                    </td>
                    <td className="p-3 text-xs font-bold text-muted-foreground">{formatDate(trx.date)}</td>
                    <td className="p-3 text-sm font-black text-rose-600">
                      ₹{formatINR(trx.amount)}
                    </td>
                    <td className="p-3 text-xs font-bold text-foreground">{trx.category}</td>
                    <td className="p-3 text-xs font-medium text-foreground">{trx.brand || "-"}</td>
                    <td className="p-3 text-xs font-medium text-foreground">{trx.things}</td>
                    <td className="p-3 text-xs font-medium text-muted-foreground">{trx.narrative || "-"}</td>
                    <td className="p-3 pr-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => openEditDebit(trx)} className="text-muted-foreground hover:text-foreground transition-colors p-2 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 inline-flex items-center justify-center"><Edit3 className="w-3.5 h-3.5" /></button>
                        <button
                          onClick={() => setDeleteConfirm({ isOpen: true, id: trx.id, type: 'debit' })}
                          className="text-rose-500 hover:text-rose-600 transition-colors p-2 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 inline-flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-border/50 flex justify-between items-center bg-muted/10 rounded-b-2xl">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Transaction Total Debt</span>
            <span className="text-base font-black text-rose-600">₹{formatINR(totalDebt)}</span>
          </div>
        </div>

      </div>

      {/* --- ADD CREDIT MODAL --- */}
      <Dialog open={isAddCreditOpen} onOpenChange={(open) => { setIsAddCreditOpen(open); if (!open) resetCreditModal(); }}>
        <DialogContent className="w-[calc(100vw-16px)] sm:w-full sm:max-w-lg max-h-[90dvh] flex flex-col p-0 overflow-hidden rounded-2xl sm:rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className="p-4 border-b border-border/50 flex justify-between items-center bg-emerald-500/5">
            <div>
              <h3 className="font-black text-lg text-foreground flex items-center gap-2"><ArrowDownLeft className="w-4 h-4 text-emerald-600" /> Add Credit (Income / Invoice)</h3>
              <p className="text-xs font-medium text-muted-foreground">Record incoming funds. You can link an existing invoice or enter details manually.</p>
            </div>
            <button onClick={() => { setIsAddCreditOpen(false); resetCreditModal(); }} className="p-2 hover:bg-muted rounded-full transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-5 overflow-y-auto max-h-[70vh]">
            <div className="p-3 sm:p-4 bg-muted/30 border border-border/50 rounded-xl space-y-2">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-emerald-600" /> Quick Select from Existing Invoices</label>
              <SearchableSelect
                value={selectedInvoiceId}
                onChange={applyInvoice}
                options={invoiceOptions}
                placeholder="-- Select an invoice to auto-fill --"
                emptyMessage="No invoices found."
                className="w-full h-[40px] px-3 bg-background border-2 border-emerald-500/60 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">Invoice Number / Ref</label>
                <input type="text" placeholder="e.g. INV-001" value={creditForm.ref_no} onChange={(e) => setCreditForm((p) => ({ ...p, ref_no: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">Date *</label>
                <input type="date" value={creditForm.date} onChange={(e) => setCreditForm((p) => ({ ...p, date: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">Amount (₹) *</label>
                <input type="number" placeholder="e.g. 5000" value={creditForm.amount} onChange={(e) => setCreditForm((p) => ({ ...p, amount: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">Category *</label>
                <SearchableSelect
                  value={addCreditCategory}
                  onChange={setAddCreditCategory}
                  options={creditCategoryOptions}
                  placeholder="Select category"
                  searchPlaceholder="Search category..."
                  emptyMessage="Nothing here yet. Type a name above to add one."
                  onCreate={addOption("credit-category")}
                  onDelete={(name) => setOptionToRemove({ kind: "credit-category", name })}
                  className="w-full h-[40px] px-3 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">Brand Name</label>
              <SearchableSelect
                value={addCreditBrand}
                onChange={setAddCreditBrand}
                options={brandOptions}
                placeholder="Select brand"
                searchPlaceholder="Search brand..."
                emptyMessage="Nothing here yet. Type a name above to add one."
                onCreate={addOption("brand")}
                onDelete={(name) => setOptionToRemove({ kind: "brand", name })}
                className="w-full h-[40px] px-3 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">Descriptions (Items / Scope)</label>
              <input type="text" placeholder="e.g. Amrutam Tattva Pvt. Ltd." value={creditForm.description} onChange={(e) => setCreditForm((p) => ({ ...p, description: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">Services</label>
                <input type="text" placeholder="e.g. SMM, Web Dev" value={creditForm.service} onChange={(e) => setCreditForm((p) => ({ ...p, service: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">Remarks / Notes</label>
                <input type="text" placeholder="e.g. Advance received" value={creditForm.remarks} onChange={(e) => setCreditForm((p) => ({ ...p, remarks: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">Document Attachment (URL or Filename)</label>
              <div className="flex gap-2">
                <input type="text" placeholder="e.g. https://... or invoice_bill.pdf" value={creditForm.attachment} onChange={(e) => setCreditForm((p) => ({ ...p, attachment: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                <label className={`px-3 py-2 bg-background border border-border/50 rounded-lg text-sm font-bold hover:bg-muted transition-colors flex items-center gap-2 shrink-0 cursor-pointer ${uploadingAttachment ? "opacity-60 pointer-events-none" : ""}`}>
                  <Upload className="w-4 h-4" /> {uploadingAttachment ? "Uploading..." : "Attach"}
                  <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.csv" onChange={(e) => { uploadAttachment(e.target.files?.[0]); e.target.value = ""; }} />
                </label>
              </div>
            </div>
          </div>
          <div className="px-4 sm:px-6 md:px-8 py-4 md:py-6 bg-muted/30 border-t border-border/50 flex justify-end gap-3 mt-auto shrink-0">
            <button onClick={() => { setIsAddCreditOpen(false); resetCreditModal(); }} className="px-4 py-2 font-bold text-sm bg-background border border-border/50 rounded-lg hover:bg-muted transition-colors">Cancel</button>
            <button onClick={() => saveNew("credit")} disabled={uploadingAttachment} className="px-4 py-2 font-bold text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">Save Credit Transaction</button>
          </div>
        </DialogContent>
      </Dialog>

      {/* --- ADD DEBT MODAL --- */}
      <Dialog open={isAddDebtOpen} onOpenChange={(open) => { setIsAddDebtOpen(open); if (!open) resetDebtModal(); }}>
        <DialogContent className="w-[calc(100vw-24px)] sm:w-full sm:max-w-lg max-h-[90dvh] flex flex-col p-0 overflow-hidden rounded-2xl sm:rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className="p-4 border-b border-border/50 flex justify-between items-center bg-rose-500/5">
            <div>
              <h3 className="font-black text-lg text-foreground flex items-center gap-2"><ArrowUpRight className="w-4 h-4 text-rose-600" /> Add Debt (Expense / Bill)</h3>
              <p className="text-xs font-medium text-muted-foreground">Record company expenditure. Expense No. is automatically generated sequentially in YYMMXXX format.</p>
            </div>
            <button onClick={() => { setIsAddDebtOpen(false); resetDebtModal(); }} className="p-2 hover:bg-muted rounded-full transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-5 overflow-y-auto max-h-[70vh]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">Expense No.</label>
                <input type="text" disabled placeholder={`Auto-generated (e.g. ${todayISO().slice(2, 4)}${todayISO().slice(5, 7)}001)`} className="w-full px-3 py-2 bg-muted/40 border border-border/50 rounded-lg text-sm cursor-not-allowed" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">Date *</label>
                <input type="date" value={debtForm.date} onChange={(e) => setDebtForm((p) => ({ ...p, date: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">Amount (₹) *</label>
                <input type="number" placeholder="e.g. 1500" value={debtForm.amount} onChange={(e) => setDebtForm((p) => ({ ...p, amount: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">Category</label>
                <SearchableSelect
                  value={addDebtCategory}
                  onChange={setAddDebtCategory}
                  options={debitCategoryOptions}
                  placeholder="Select category"
                  searchPlaceholder="Search category..."
                  emptyMessage="Nothing here yet. Type a name above to add one."
                  onCreate={addOption("debit-category")}
                  onDelete={(name) => setOptionToRemove({ kind: "debit-category", name })}
                  className="w-full h-[40px] px-3 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">Brand Name</label>
              <SearchableSelect
                value={addDebtBrand}
                onChange={setAddDebtBrand}
                options={brandOptions}
                placeholder="Select brand"
                searchPlaceholder="Search brand..."
                emptyMessage="Nothing here yet. Type a name above to add one."
                onCreate={addOption("brand")}
                onDelete={(name) => setOptionToRemove({ kind: "brand", name })}
                className="w-full h-[40px] px-3 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">Things (Items Purchased)</label>
                <input type="text" placeholder="e.g. Deposit for Property, Server" value={debtForm.things} onChange={(e) => setDebtForm((p) => ({ ...p, things: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">Narrative / Reason</label>
                <input type="text" placeholder="e.g. Advance paid to vendor" value={debtForm.narrative} onChange={(e) => setDebtForm((p) => ({ ...p, narrative: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">Document Attachment (URL or Filename)</label>
              <div className="flex gap-2">
                <input type="text" placeholder="e.g. https://... or invoice_bill.pdf" value={debtForm.attachment} onChange={(e) => setDebtForm((p) => ({ ...p, attachment: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                <label className={`px-3 py-2 bg-background border border-border/50 rounded-lg text-sm font-bold hover:bg-muted transition-colors flex items-center gap-2 shrink-0 cursor-pointer ${uploadingAttachment ? "opacity-60 pointer-events-none" : ""}`}>
                  <Upload className="w-4 h-4" /> {uploadingAttachment ? "Uploading..." : "Attach"}
                  <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.csv" onChange={(e) => { uploadAttachment(e.target.files?.[0], "debit"); e.target.value = ""; }} />
                </label>
              </div>
            </div>
          </div>
          <div className="px-4 sm:px-6 md:px-8 py-4 md:py-6 bg-muted/30 border-t border-border/50 flex justify-end gap-3 mt-auto shrink-0">
            <button onClick={() => { setIsAddDebtOpen(false); resetDebtModal(); }} className="px-4 py-2 font-bold text-sm bg-background border border-border/50 rounded-lg hover:bg-muted transition-colors">Cancel</button>
            <button onClick={() => saveNew("debit")} disabled={uploadingAttachment} className="px-4 py-2 font-bold text-sm bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors">Save Debt Transaction</button>
          </div>
        </DialogContent>
      </Dialog>

      {/* EDIT CREDIT MODAL */}
      <Dialog open={!!editCredit} onOpenChange={(open) => !open && setEditCredit(null)}>
        <DialogContent className="w-[calc(100vw-16px)] sm:w-full sm:max-w-lg max-h-[90dvh] flex flex-col p-0 overflow-hidden rounded-2xl sm:rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className="p-4 border-b border-border/50 flex justify-between items-center bg-emerald-500/5">
            <div>
              <h3 className="font-black text-lg text-foreground">Edit Credit Transaction</h3>
              <p className="text-xs font-medium text-muted-foreground">Update invoice details.</p>
            </div>
            <button onClick={() => setEditCredit(null)} className="p-2 hover:bg-muted rounded-full transition-colors"><X className="w-4 h-4" /></button>
          </div>
          {editCredit && (
            <div className="p-4 sm:p-6 md:p-8 space-y-4 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">Invoice No.</label>
                  <input type="text" value={editCredit.refNo} onChange={(e) => setEditCredit((p: any) => ({ ...p, refNo: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">Date</label>
                  <input type="date" value={editCredit.date} onChange={(e) => setEditCredit((p: any) => ({ ...p, date: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">Amount (₹)</label>
                <input type="number" value={editCredit.amount} onChange={(e) => setEditCredit((p: any) => ({ ...p, amount: parseFloat(e.target.value) || 0 }))} className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">Category</label>
                <SearchableSelect
                  value={editCredit.category}
                  onChange={(v) => setEditCredit((p: any) => ({ ...p, category: v }))}
                  options={creditCategoryOptions}
                  placeholder="Select category"
                  searchPlaceholder="Search category..."
                  emptyMessage="Nothing here yet. Type a name above to add one."
                  onCreate={addOption("credit-category")}
                  onDelete={(name) => setOptionToRemove({ kind: "credit-category", name })}
                  className="w-full h-[40px] px-3 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">Brand Name</label>
                <SearchableSelect
                  value={editCredit.brand}
                  onChange={(v) => setEditCredit((p: any) => ({ ...p, brand: v }))}
                  options={brandOptions}
                  placeholder="Select brand"
                  searchPlaceholder="Search brand..."
                  emptyMessage="Nothing here yet. Type a name above to add one."
                  onCreate={addOption("brand")}
                  onDelete={(name) => setOptionToRemove({ kind: "brand", name })}
                  className="w-full h-[40px] px-3 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">Description</label>
                <input type="text" value={editCredit.description} onChange={(e) => setEditCredit((p: any) => ({ ...p, description: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">Services</label>
                <input type="text" value={editCredit.service} onChange={(e) => setEditCredit((p: any) => ({ ...p, service: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">Remarks</label>
                <textarea rows={2} value={editCredit.remarks} onChange={(e) => setEditCredit((p: any) => ({ ...p, remarks: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
            </div>
          )}
          <div className="px-4 sm:px-6 md:px-8 py-4 border-t border-border/50 flex justify-end gap-3">
            <button onClick={() => setEditCredit(null)} className="px-4 py-2 font-bold text-sm bg-background border border-border/50 rounded-lg hover:bg-muted transition-colors">Cancel</button>
            <button onClick={saveEditCredit} className="px-4 py-2 font-bold text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">Save Changes</button>
          </div>
        </DialogContent>
      </Dialog>

      {/* EDIT DEBIT MODAL */}
      <Dialog open={!!editDebit} onOpenChange={(open) => !open && setEditDebit(null)}>
        <DialogContent className="w-[calc(100vw-16px)] sm:w-full sm:max-w-lg max-h-[90dvh] flex flex-col p-0 overflow-hidden rounded-2xl sm:rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className="p-4 border-b border-border/50 flex justify-between items-center bg-rose-500/5">
            <div>
              <h3 className="font-black text-lg text-foreground">Edit Debit Transaction</h3>
              <p className="text-xs font-medium text-muted-foreground">Update expense details.</p>
            </div>
            <button onClick={() => setEditDebit(null)} className="p-2 hover:bg-muted rounded-full transition-colors"><X className="w-4 h-4" /></button>
          </div>
          {editDebit && (
            <div className="p-4 sm:p-6 md:p-8 space-y-4 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">Expense No.</label>
                  <input type="text" value={editDebit.refNo} onChange={(e) => setEditDebit((p: any) => ({ ...p, refNo: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">Date</label>
                  <input type="date" value={editDebit.date} onChange={(e) => setEditDebit((p: any) => ({ ...p, date: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">Amount (₹)</label>
                <input type="number" value={editDebit.amount} onChange={(e) => setEditDebit((p: any) => ({ ...p, amount: parseFloat(e.target.value) || 0 }))} className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">Category</label>
                <SearchableSelect
                  value={editDebit.category}
                  onChange={(v) => setEditDebit((p: any) => ({ ...p, category: v }))}
                  options={debitCategoryOptions}
                  placeholder="Select category"
                  searchPlaceholder="Search category..."
                  emptyMessage="Nothing here yet. Type a name above to add one."
                  onCreate={addOption("debit-category")}
                  onDelete={(name) => setOptionToRemove({ kind: "debit-category", name })}
                  className="w-full h-[40px] px-3 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">Brand Name</label>
                <SearchableSelect
                  value={editDebit.brand}
                  onChange={(v) => setEditDebit((p: any) => ({ ...p, brand: v }))}
                  options={brandOptions}
                  placeholder="Select brand"
                  searchPlaceholder="Search brand..."
                  emptyMessage="Nothing here yet. Type a name above to add one."
                  onCreate={addOption("brand")}
                  onDelete={(name) => setOptionToRemove({ kind: "brand", name })}
                  className="w-full h-[40px] px-3 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">Things</label>
                <input type="text" value={editDebit.things} onChange={(e) => setEditDebit((p: any) => ({ ...p, things: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">Narrative</label>
                <textarea rows={2} value={editDebit.narrative} onChange={(e) => setEditDebit((p: any) => ({ ...p, narrative: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
            </div>
          )}
          <div className="px-6 md:px-8 py-4 border-t border-border/50 flex justify-end gap-3">
            <button onClick={() => setEditDebit(null)} className="px-4 py-2 font-bold text-sm bg-background border border-border/50 rounded-lg hover:bg-muted transition-colors">Cancel</button>
            <button onClick={saveEditDebit} className="px-4 py-2 font-bold text-sm bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors">Save Changes</button>
          </div>
        </DialogContent>
      </Dialog>

      {/* OPENING BALANCES MODAL */}
      <Dialog open={isOpeningOpen} onOpenChange={setIsOpeningOpen}>
        <DialogContent className="w-[calc(100vw-16px)] sm:w-full sm:max-w-lg max-h-[90dvh] flex flex-col p-0 overflow-hidden rounded-2xl sm:rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className="p-4 border-b border-border/50 flex justify-between items-center bg-amber-500/5">
            <div>
              <h3 className="font-black text-lg text-foreground">Opening Balances</h3>
              <p className="text-xs font-medium text-muted-foreground">Starting balance for bank and cash accounts.</p>
            </div>
            <button onClick={() => setIsOpeningOpen(false)} className="p-2 hover:bg-muted rounded-full transition-colors"><X className="w-4 h-4" /></button>
          </div>
          <div className="p-4 sm:p-6 md:p-8 space-y-4 overflow-y-auto max-h-[70vh]">
            {openingLocked && (
              <p className="p-3 text-xs font-medium text-amber-700 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                Opening balances are locked because credit or debit entries have already been added.
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">Bank Opening Balance (₹)</label>
                <input type="number" disabled={openingLocked} value={openingForm.bank} onChange={(e) => setOpeningForm((p) => ({ ...p, bank: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60 disabled:cursor-not-allowed" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">Cash Opening Balance (₹)</label>
                <input type="number" disabled={openingLocked} value={openingForm.cash} onChange={(e) => setOpeningForm((p) => ({ ...p, cash: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60 disabled:cursor-not-allowed" />
              </div>
            </div>
          </div>
          <div className="px-4 sm:px-6 md:px-8 py-4 border-t border-border/50 flex justify-end gap-3">
            <button onClick={() => setIsOpeningOpen(false)} className="px-4 py-2 font-bold text-sm bg-background border border-border/50 rounded-lg hover:bg-muted transition-colors">{openingLocked ? "Close" : "Cancel"}</button>
            {!openingLocked && (
              <button onClick={saveOpeningBalances} className="px-4 py-2 font-bold text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">Save Balances</button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, id: null, type: 'credit' })}
        onConfirm={confirmDelete}
        title="Delete Transaction"
        description={`Are you sure you want to completely delete this ${deleteConfirm.type === 'credit' ? 'credit (invoice)' : 'debt (expense)'} transaction?`}
      />
      <ConfirmModal
        isOpen={!!optionToRemove}
        onClose={() => setOptionToRemove(null)}
        onConfirm={confirmRemoveOption}
        title={optionToRemove?.kind === "brand" ? "Remove Brand" : "Remove Category"}
        description={`Remove "${optionToRemove?.name}" from the ${optionToRemove?.kind === "brand" ? "brand" : "category"} list? Existing transactions will keep this value.`}
        confirmText="Remove"
      />
    </div>
  );
}
