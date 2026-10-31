import { useState, useEffect, useMemo } from "react";
import { usePersistentState } from "@/hooks/usePersistentState";
import { Download, Plus, Wallet, Building2, Filter, ArrowDownLeft, ArrowUpRight, ArrowRight, Edit3, Trash2, X, Sparkles, Upload, CheckCircle2, Paperclip, LayoutGrid, Landmark } from "lucide-react";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/select";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableHeader } from "@/components/ui/sortable-header";
import { DateRangeFilter } from "@/components/common/DateRangeFilter";
import { SearchInput } from "@/components/common/SearchInput";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { API_URL } from "@/lib/config";
import { formatDate } from "@/lib/utils";

type AccountTab = "overview" | "bank" | "cash";

const todayISO = () => new Date().toISOString().slice(0, 10);
const toISODate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
  bankAccountId: t.bank_account_id || "",
});

// Account picker values: "cash" or "bank:<accountId>"
const accountKeyOf = (t: { account: string; bankAccountId?: string }) => (t.account === "cash" ? "cash" : `bank:${t.bankAccountId || ""}`);
const isValidAccountKey = (key: string) => key === "cash" || (key.startsWith("bank:") && key.length > 5);
const parseAccountKey = (key: string) =>
  key === "cash" ? { account: "cash", bank_account_id: null } : { account: "bank", bank_account_id: key.slice(5) || null };

const bankIdOf = (b: any) => String(b.id || b._id);
const bankLabel = (b: any) => `${b.nickname || b.bank_name}${b.account_number ? ` (••${String(b.account_number).slice(-4)})` : ""}`;
const emptyBankForm = () => ({ nickname: "", bank_name: "", account_name: "", account_number: "", ifsc_code: "", branch: "", upi_id: "", is_default: false, opening: "0" });

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

  const fetchBankAccounts = async () => {
    try {
      const res = await api.get<any>("/bank-accounts", { showLoader: false, showErrorToast: false });
      setBankAccounts(Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []);
    } catch { setBankAccounts([]); }
    try {
      const res = await api.get<Record<string, number>>("/transactions/opening-balances/bank-accounts", { showLoader: false, showErrorToast: false });
      setBankOpening(res || {});
    } catch { /* keep defaults */ }
  };

  // Until the first load finishes, show skeletons instead of ₹0.00 / empty tables
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchTransactions(), fetchOpeningBalances(), fetchBankAccounts()]).finally(() => setLoading(false));
  }, []);

  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean, id: string | null, type: 'credit' | 'debit' }>({ isOpen: false, id: null, type: 'credit' });

  // Id of the entry being edited; the Add Credit / Add Debt popups are reused for editing
  const [editingId, setEditingId] = useState<string | null>(null);

  const [isAddCreditOpen, setIsAddCreditOpen] = useState(false);
  const [isAddDebtOpen, setIsAddDebtOpen] = useState(false);
  const [creditForm, setCreditForm] = useState(emptyCreditForm);
  const [debtForm, setDebtForm] = useState(emptyDebtForm);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeAccountTab, setActiveAccountTab] = usePersistentState<AccountTab>("transactions.tab", "overview");
  // Bank tab account filter: "all" or a bank account id
  const [selectedBankId, setSelectedBankId] = useState("all");
  const [creditAccount, setCreditAccount] = useState("cash");
  const [debtAccount, setDebtAccount] = useState("cash");

  // Bank accounts (shared with invoices) and their opening balances
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [bankOpening, setBankOpening] = useState<Record<string, number>>({});
  const [bankForm, setBankForm] = useState(emptyBankForm);
  const [editingBankId, setEditingBankId] = useState<string | null>(null);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [isManageBanksOpen, setIsManageBanksOpen] = useState(false);
  const [bankToDelete, setBankToDelete] = useState<any | null>(null);

  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [filterCategory, setFilterCategory] = useState("All Categories");
  const [filterBrand, setFilterBrand] = useState("All Brands");
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
    () => buildOptions("credit-category", transactions.filter((t) => t.type === "credit").map((t) => t.category), [addCreditCategory]),
    [optionLists, transactions, addCreditCategory],
  );
  const debitCategoryOptions = useMemo(
    () => buildOptions("debit-category", transactions.filter((t) => t.type === "debit").map((t) => t.category), [addDebtCategory]),
    [optionLists, transactions, addDebtCategory],
  );
  const brandOptions = useMemo(
    () => buildOptions("brand", [...brands, ...transactions.map((t) => t.brand)], [addCreditBrand, addDebtBrand]),
    [optionLists, brands, transactions, addCreditBrand, addDebtBrand],
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
    if (inv.bank_account_id) setCreditAccount(`bank:${inv.bank_account_id}`);
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
    setEditingId(null);
  };

  const resetDebtModal = () => {
    setDebtForm(emptyDebtForm());
    setAddDebtCategory("");
    setAddDebtBrand("");
    setEditingId(null);
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
    if (!isValidAccountKey(type === "credit" ? creditAccount : debtAccount)) {
      toast.error("Please select an account");
      return;
    }
    const payload = {
      ...form,
      ...parseAccountKey(type === "credit" ? creditAccount : debtAccount),
      amount,
      category: type === "credit" ? addCreditCategory : (addDebtCategory.trim() || "General"),
      brand: (type === "credit" ? addCreditBrand : addDebtBrand) || null,
    };
    try {
      if (editingId) {
        await api.put(`/transactions/${editingId}`, payload);
        toast.success("Transaction updated");
      } else {
        await api.post("/transactions", { ...payload, type });
        toast.success(type === "credit" ? "Credit added" : "Expense added");
      }
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

  // Each opening balance (cash, every bank account) locks once that account has an entry
  const cashLocked = transactions.some((t) => t.account === "cash");
  const isBankLocked = (id: string) => transactions.some((t) => t.bankAccountId === id);
  // The opening balance modal only shows the account being viewed (overview / "All Accounts" show every account)
  const singleBank = activeAccountTab === "bank" && selectedBankId !== "all" ? selectedBankId : null;
  const showCashOpening = activeAccountTab === "overview" || activeAccountTab === "cash";
  const visibleOpeningBanks = activeAccountTab === "cash" ? []
    : singleBank ? bankAccounts.filter((b) => bankIdOf(b) === singleBank) : bankAccounts;
  const openingLocked = (!showCashOpening || cashLocked) && visibleOpeningBanks.every((b) => isBankLocked(bankIdOf(b)));
  const singleBankAccount = singleBank ? bankAccounts.find((b) => bankIdOf(b) === singleBank) : null;
  const openingTitle = activeAccountTab === "cash" ? "Cash Opening Balance"
    : singleBank ? `Opening Balance: ${singleBankAccount ? bankLabel(singleBankAccount) : "Bank"}`
    : "Opening Balances";

  const [bankOpeningForm, setBankOpeningForm] = useState<Record<string, string>>({});

  const openOpeningBalances = () => {
    setOpeningForm({ bank: String(openingBalances.bank), cash: String(openingBalances.cash) });
    setBankOpeningForm(Object.fromEntries(bankAccounts.map((b) => [bankIdOf(b), String(bankOpening[bankIdOf(b)] || 0)])));
    setIsOpeningOpen(true);
  };

  const saveOpeningBalances = async () => {
    const payload = { bank: parseFloat(openingForm.bank) || 0, cash: parseFloat(openingForm.cash) || 0 };
    try {
      if (payload.bank !== openingBalances.bank || payload.cash !== openingBalances.cash) {
        await api.put("/transactions/opening-balances", payload);
        setOpeningBalances(payload);
      }
      for (const b of bankAccounts) {
        const id = bankIdOf(b);
        const amount = parseFloat(bankOpeningForm[id] ?? "0") || 0;
        if (amount !== (bankOpening[id] || 0)) {
          await api.put(`/transactions/opening-balances/bank-accounts/${id}`, { amount });
          setBankOpening((p) => ({ ...p, [id]: amount }));
        }
      }
      setIsOpeningOpen(false);
      toast.success("Opening balances saved");
    } catch { /* api shows error toast */ }
  };

  // ---------- Bank accounts ----------
  const bankById = useMemo(() => new Map(bankAccounts.map((b) => [bankIdOf(b), b])), [bankAccounts]);
  const accountLabelOf = (t: any) => (t.account === "cash" ? "Cash" : bankById.get(t.bankAccountId)?.nickname || "Bank");

  const accountOptions = useMemo(() => [
    { label: "Cash", value: "cash" },
    ...bankAccounts.map((b) => ({ label: bankLabel(b), value: `bank:${bankIdOf(b)}` })),
  ], [bankAccounts]);

  // New entries go to the account being viewed; otherwise the default bank account
  const defaultAccountKey = () => {
    if (activeAccountTab === "cash") return "cash";
    if (activeAccountTab === "bank" && selectedBankId !== "all") return `bank:${selectedBankId}`;
    const fallback = bankAccounts.find((b) => b.is_default) || bankAccounts[0];
    return fallback ? `bank:${bankIdOf(fallback)}` : "cash";
  };
  const openAddCredit = () => { setEditingId(null); setCreditAccount(defaultAccountKey()); setIsAddCreditOpen(true); };
  const openAddDebt = () => { setEditingId(null); setDebtAccount(defaultAccountKey()); setIsAddDebtOpen(true); };

  const openEditCredit = (trx: any) => {
    setEditingId(trx.id);
    setCreditForm({
      ref_no: trx.refNo, date: trx.date, amount: String(trx.amount), description: trx.description, service: trx.service,
      remarks: trx.remarks, attachment: trx.attachment, invoice_id: trx.invoiceId,
    });
    setAddCreditCategory(trx.category);
    setAddCreditBrand(trx.brand);
    setCreditAccount(accountKeyOf(trx));
    setSelectedInvoiceId(trx.invoiceId || "");
    setIsAddCreditOpen(true);
  };

  const openEditDebit = (trx: any) => {
    setEditingId(trx.id);
    setDebtForm({ ref_no: trx.refNo, date: trx.date, amount: String(trx.amount), things: trx.things, narrative: trx.narrative, attachment: trx.attachment });
    setAddDebtCategory(trx.category);
    setAddDebtBrand(trx.brand);
    setDebtAccount(accountKeyOf(trx));
    setIsAddDebtOpen(true);
  };

  const openBankModal = (bank?: any) => {
    if (bank) {
      const id = bankIdOf(bank);
      setEditingBankId(id);
      setBankForm({
        nickname: bank.nickname || "", bank_name: bank.bank_name || "", account_name: bank.account_name || "",
        account_number: bank.account_number || "", ifsc_code: bank.ifsc_code || "", branch: bank.branch || "",
        upi_id: bank.upi_id || "", is_default: !!bank.is_default, opening: String(bankOpening[id] || 0),
      });
    } else {
      setEditingBankId(null);
      setBankForm(emptyBankForm());
    }
    setIsBankModalOpen(true);
  };

  const saveBankAccount = async () => {
    const { opening, ...fields } = bankForm;
    if (!fields.nickname.trim() || !fields.bank_name.trim() || !fields.account_number.trim() || !fields.ifsc_code.trim()) {
      toast.error("Nickname, bank name, account number and IFSC are required");
      return;
    }
    const payload = { ...fields, ifsc_code: fields.ifsc_code.toUpperCase() };
    try {
      const saved = editingBankId
        ? await api.put<any>(`/bank-accounts/${editingBankId}`, payload)
        : await api.post<any>("/bank-accounts", payload);
      const id = editingBankId || bankIdOf(saved || {});
      const amount = parseFloat(opening) || 0;
      if (id && amount !== (bankOpening[id] || 0) && !isBankLocked(id)) {
        await api.put(`/transactions/opening-balances/bank-accounts/${id}`, { amount });
      }
      toast.success(editingBankId ? "Bank account updated" : "Bank account added");
      setIsBankModalOpen(false);
      if (!editingBankId && id) { setActiveAccountTab("bank"); setSelectedBankId(id); }
      fetchBankAccounts();
    } catch { /* api shows error toast */ }
  };

  const requestDeleteBank = (bank: any) => {
    if (isBankLocked(bankIdOf(bank))) {
      toast.error("This account has entries. Move or delete them before deleting the account.");
      return;
    }
    setBankToDelete(bank);
  };

  const confirmDeleteBank = async () => {
    const bank = bankToDelete;
    setBankToDelete(null);
    if (!bank) return;
    try {
      await api.delete(`/bank-accounts/${bankIdOf(bank)}`);
      toast.success("Bank account deleted");
      if (selectedBankId === bankIdOf(bank)) setSelectedBankId("all");
      fetchBankAccounts();
    } catch { /* api shows error toast */ }
  };

  // Transactions of the active view (overview = everything, bank = optionally one account, cash), used for totals and category options
  const accountTransactions = useMemo(() => {
    if (activeAccountTab === "overview") return transactions;
    if (activeAccountTab === "cash") return transactions.filter((t) => t.account === "cash");
    return transactions.filter((t) => t.account === "bank" && (
      selectedBankId === "all" || t.bankAccountId === selectedBankId
    ));
  }, [transactions, activeAccountTab, selectedBankId]);

  const categoryOptions = useMemo(() => {
    const cats = Array.from(new Set([
      ...accountTransactions.map((t) => t.category),
      ...creditCategoryOptions.map((o) => o.value),
      ...debitCategoryOptions.map((o) => o.value),
    ].filter(Boolean))).sort();
    return [{ label: "All Categories", value: "All Categories" }, ...cats.map((c) => ({ label: c, value: c }))];
  }, [accountTransactions, creditCategoryOptions, debitCategoryOptions]);

  const brandFilterOptions = useMemo(() => {
    const names = Array.from(new Set([...accountTransactions.map((t) => t.brand), ...brandOptions.map((o) => o.value)].filter(Boolean))).sort();
    return [{ label: "All Brands", value: "All Brands" }, ...names.map((b) => ({ label: b, value: b }))];
  }, [accountTransactions, brandOptions]);

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const from = dateRange?.from ? toISODate(dateRange.from) : "";
    const to = (dateRange?.to ? toISODate(dateRange.to) : "") || from;
    return accountTransactions.filter((t) => {
      if (filterCategory !== "All Categories" && t.category !== filterCategory) return false;
      if (filterBrand !== "All Brands" && t.brand !== filterBrand) return false;
      if (from && t.date < from) return false;
      if (to && t.date > to) return false;
      if (q) {
        const hay = [t.refNo, t.category, t.brand, t.description, t.service, t.remarks, t.things, t.narrative, String(t.amount), accountLabelOf(t)].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [accountTransactions, searchQuery, dateRange, filterCategory, filterBrand, bankById]);

  const creditTransactions = useMemo(() => filteredTransactions.filter((t) => t.type === "credit"), [filteredTransactions]);
  const debitTransactions = useMemo(() => filteredTransactions.filter((t) => t.type === "debit"), [filteredTransactions]);

  const totalCredit = creditTransactions.reduce((sum, t) => sum + t.amount, 0);
  const totalDebt = debitTransactions.reduce((sum, t) => sum + t.amount, 0);
  const allBankOpening = bankAccounts.reduce((sum, b) => sum + (bankOpening[bankIdOf(b)] || 0), 0);
  const openingBalance =
    activeAccountTab === "overview" ? openingBalances.cash + allBankOpening
    : activeAccountTab === "cash" ? openingBalances.cash
    : selectedBankId === "all" ? allBankOpening
    : bankOpening[selectedBankId] || 0;
  // Overview and "All Accounts" mix accounts, so the tables show which account each entry belongs to
  const showAccountColumn = activeAccountTab === "overview" || (activeAccountTab === "bank" && selectedBankId === "all");
  const showInvoiceColumn = activeAccountTab !== "cash";
  const closingBalance = openingBalance + totalCredit - totalDebt;
  const syncedCount = creditTransactions.filter((t) => t.source === "invoice").length;

  const exportLedger = () => {
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = ["Type", "Account", "Ref No.", "Date", "Amount", "Category", "Brand", "Description / Things", "Services", "Remarks / Narrative"];
    const rows = filteredTransactions.map((t) => [
      t.type === "credit" ? "Credit" : "Debt", accountLabelOf(t), t.refNo, formatDate(t.date), t.amount.toFixed(2), t.category, t.brand,
      t.type === "credit" ? t.description : t.things, t.service, t.type === "credit" ? t.remarks : t.narrative,
    ]);
    const summary = [[], ["Opening Balance", openingBalance.toFixed(2)], ["Total Credit", totalCredit.toFixed(2)], ["Total Debt", totalDebt.toFixed(2)], ["Closing Balance", closingBalance.toFixed(2)]];

    // Describe the current view + filters at the top of the file and in its name
    const viewLabel = activeAccountTab === "overview" ? "Overview (Bank + Cash)" : activeAccountTab === "cash" ? "Cash"
      : selectedBankId === "all" ? "All Bank Accounts" : bankLabel(bankById.get(selectedBankId) || {});
    const fromISO = dateRange?.from ? toISODate(dateRange.from) : "";
    const toISO = dateRange?.to ? toISODate(dateRange.to) : fromISO;
    const filters = [
      ["Ledger", viewLabel],
      ["Category", filterCategory],
      ["Brand", filterBrand],
      ["Date Range", fromISO ? `${formatDate(fromISO)} - ${formatDate(toISO)}` : "All Dates"],
      ...(searchQuery.trim() ? [["Search", searchQuery.trim()]] : []),
      ["Exported On", formatDate(todayISO())],
      [],
    ];
    const csv = [...filters, header, ...rows, ...summary].map((r) => r.map(esc).join(",")).join("\n");
    // BOM so Excel reads ₹ and other UTF-8 text correctly
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
    const slug = (v: string) => v.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
    const nameParts = [
      "ledger",
      activeAccountTab === "bank" && selectedBankId !== "all" ? slug(bankById.get(selectedBankId)?.nickname || "bank") : activeAccountTab,
      filterCategory !== "All Categories" ? slug(filterCategory) : "",
      filterBrand !== "All Brands" ? slug(filterBrand) : "",
      fromISO ? `${fromISO}_to_${toISO}` : todayISO(),
    ].filter(Boolean);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${nameParts.join("_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tableSkeletonRows = Array.from({ length: 4 }, (_, i) => (
    <tr key={`skeleton-${i}`}>
      <td colSpan={12} className="p-3"><Skeleton className="h-6 w-full" /></td>
    </tr>
  ));

  const accountBadge = (t: any) => (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${t.account === "cash" ? "bg-amber-500/10 text-amber-700" : "bg-emerald-500/10 text-emerald-700"}`}>
      {t.account === "cash" ? <Wallet className="w-3 h-3" /> : <Landmark className="w-3 h-3" />} {accountLabelOf(t)}
    </span>
  );

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
    <div className="w-full space-y-4 animate-in fade-in duration-500 pb-12 relative min-w-0">

      {/* Header */}
      <div className="flex flex-col 2xl:flex-row 2xl:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground leading-tight">
            Financial Ledger Management
          </h1>
          <p className="text-muted-foreground mt-0.5 text-xs sm:text-sm font-medium">
            Track Credit (Invoices) and Debt (Expenses) with dynamic balance calculations
          </p>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:items-center gap-2 w-full 2xl:w-auto">
          {/* Setup & export */}
          <button onClick={openOpeningBalances} title="Opening Balances" className="col-span-2 sm:col-auto h-9 px-3 bg-background border border-border/50 text-foreground font-bold rounded-lg hover:bg-muted/50 transition-colors shadow-sm flex items-center justify-center gap-2 text-sm whitespace-nowrap">
            <Wallet className="w-4 h-4 text-amber-500 shrink-0" /><span>Opening Balances</span>
          </button>
          <button onClick={() => setIsManageBanksOpen(true)} title="Manage Banks" className="h-9 px-3 bg-background border border-border/50 text-foreground font-bold rounded-lg hover:bg-muted/50 transition-colors shadow-sm flex items-center justify-center gap-2 text-sm whitespace-nowrap">
            <Landmark className="w-4 h-4 text-primary shrink-0" /><span>Manage Banks</span>
          </button>
          <button onClick={exportLedger} title="Export Ledger" className="h-9 px-3 bg-background border border-border/50 text-foreground font-bold rounded-lg hover:bg-muted/50 transition-colors shadow-sm flex items-center justify-center gap-2 text-sm whitespace-nowrap">
            <Download className="w-4 h-4 text-indigo-500 shrink-0" /><span>Export Ledger</span>
          </button>
          <span className="hidden sm:block w-px h-6 bg-border/60 mx-0.5 order-3" />
          <button
            onClick={openAddCredit}
            className="order-first sm:order-4 h-10 sm:h-9 px-3 sm:px-4 bg-primary text-primary-foreground font-bold rounded-lg hover:bg-primary/90 transition-colors shadow-sm flex items-center justify-center gap-1.5 text-xs sm:text-sm whitespace-nowrap"
          >
            <Plus className="w-4 h-4 shrink-0" /> Add Credit
          </button>
          <button
            onClick={openAddDebt}
            className="order-first sm:order-5 h-10 sm:h-9 px-3 sm:px-4 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700 transition-colors shadow-sm flex items-center justify-center gap-1.5 text-xs sm:text-sm whitespace-nowrap"
          >
            <Plus className="w-4 h-4 shrink-0" /> Add Debt
          </button>
        </div>
      </div>

      {/* Account Tabs & Search */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 sm:gap-4 bg-muted/30 p-2 rounded-2xl border border-border/50">
        <div className="flex flex-wrap gap-2 min-w-0">
          <button
            className={`flex-1 sm:flex-initial h-10 px-3 sm:px-5 xl:px-6 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeAccountTab === "overview"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            onClick={() => setActiveAccountTab("overview")}
          >
            <LayoutGrid className={`w-4 h-4 ${activeAccountTab === "overview" ? "text-primary" : ""}`} /> Overview
          </button>
          <button
            className={`flex-1 sm:flex-initial h-10 px-3 sm:px-5 xl:px-6 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeAccountTab === "bank"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            onClick={() => setActiveAccountTab("bank")}
          >
            <Building2 className={`w-4 h-4 ${activeAccountTab === "bank" ? "text-primary" : ""}`} /> Bank Acc Management
          </button>
          <button
            className={`flex-1 sm:flex-initial h-10 px-3 sm:px-5 xl:px-6 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeAccountTab === "cash"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            onClick={() => setActiveAccountTab("cash")}
          >
            <Wallet className={`w-4 h-4 ${activeAccountTab === "cash" ? "text-primary" : ""}`} /> Cash Transaction
          </button>
        </div>
        <SearchInput
          placeholder="Search invoices, expenses, narratives..."
          value={searchQuery}
          onChange={setSearchQuery}
          containerClassName="w-full xl:w-80 2xl:w-96 shrink-0"
        />
      </div>

      {/* Bank Accounts */}
      {activeAccountTab === "bank" && (
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setSelectedBankId("all")}
            className={`h-10 px-4 rounded-xl text-sm font-bold border transition-colors flex items-center gap-2 ${selectedBankId === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border/50 text-muted-foreground hover:text-foreground"}`}
          >
            <Building2 className="w-4 h-4" /> All Accounts
          </button>
          {bankAccounts.map((b) => {
            const id = bankIdOf(b);
            const active = selectedBankId === id;
            return (
              <button key={id} onClick={() => setSelectedBankId(id)} title={b.bank_name}
                className={`h-10 px-4 rounded-xl text-sm font-bold border transition-colors flex items-center gap-2 ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border/50 text-muted-foreground hover:text-foreground"}`}>
                <Landmark className="w-4 h-4" /> {bankLabel(b)}
                {b.is_default && <span className={`text-[9px] uppercase tracking-wider ${active ? "text-primary-foreground/80" : "text-primary"}`}>Default</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div className="bg-background border border-border/50 rounded-2xl p-3 shadow-sm flex flex-wrap items-center gap-2.5 sm:gap-4">
        <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-muted-foreground pl-1 sm:pl-2">
          <Filter className="w-4 h-4" /> Filters:
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="sm:hidden text-xs font-medium text-muted-foreground w-16 shrink-0">Date:</span>
          <DateRangeFilter
            dateRange={dateRange}
            onChange={setDateRange}
            placeholder="Filter by transaction date"
            className="flex-1 min-w-0 sm:flex-none sm:w-[250px] h-[34px]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs sm:text-sm font-medium text-muted-foreground w-16 sm:w-auto shrink-0">Category:</span>
          <SearchableSelect
            value={filterCategory}
            onChange={setFilterCategory}
            options={categoryOptions}
            className="flex-1 min-w-0 sm:flex-none sm:w-[180px] h-[34px] px-3 bg-background border border-border/70 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs sm:text-sm font-medium text-muted-foreground w-16 sm:w-auto shrink-0">Brand:</span>
          <SearchableSelect
            value={filterBrand}
            onChange={setFilterBrand}
            options={brandFilterOptions}
            className="flex-1 min-w-0 sm:flex-none sm:w-[160px] h-[34px] px-3 bg-background border border-border/70 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
          />
        </div>

        {(dateRange.from || dateRange.to || filterCategory !== "All Categories" || filterBrand !== "All Brands") && (
          <button
            onClick={() => { setDateRange({ from: undefined, to: undefined }); setFilterCategory("All Categories"); setFilterBrand("All Brands"); }}
            className="h-[34px] px-3 rounded-lg text-xs font-bold text-rose-600 border border-rose-200 bg-rose-50 hover:bg-rose-100 transition-colors flex items-center justify-center gap-1"
          >
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 min-[560px]:grid-cols-2 xl:grid-cols-4">

        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl" />
          <div className="text-muted-foreground font-extrabold text-[10px] uppercase tracking-widest mb-4">
            {activeAccountTab === "overview" ? "Total Opening Balance" : activeAccountTab === "bank" ? "Opening Balance" : "Opening Cash Balance"}
          </div>
          {loading ? <Skeleton className="h-9 w-36 mb-4" /> : <div className="text-2xl sm:text-3xl font-black text-foreground mb-4 break-words">₹{formatINR(openingBalance)}</div>}
          <button onClick={openOpeningBalances} className="text-amber-600 font-bold text-xs flex items-center gap-1 hover:text-amber-700 transition-colors">
            {openingLocked ? "View Opening Balance" : "Configure Opening Balance"} <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl" />
          <div className="text-muted-foreground font-extrabold text-[10px] uppercase tracking-widest mb-4 max-w-[140px] leading-tight">Transaction Total Credit</div>
          {loading ? <Skeleton className="h-9 w-36 mb-4" /> : <div className="text-2xl sm:text-3xl font-black text-emerald-600 mb-4 break-words">+₹{formatINR(totalCredit)}</div>}
          {loading ? <Skeleton className="h-4 w-40" /> : <div className="text-muted-foreground font-medium text-xs">{creditTransactions.length} credit entries ({syncedCount} synced)</div>}
        </div>

        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl" />
          <div className="text-muted-foreground font-extrabold text-[10px] uppercase tracking-widest mb-4 max-w-[140px] leading-tight">Transaction Total Debt</div>
          {loading ? <Skeleton className="h-9 w-36 mb-4" /> : <div className="text-2xl sm:text-3xl font-black text-rose-600 mb-4 break-words">-₹{formatINR(totalDebt)}</div>}
          {loading ? <Skeleton className="h-4 w-40" /> : <div className="text-muted-foreground font-medium text-xs">{debitTransactions.length} expense entries recorded</div>}
        </div>

        <div className="bg-primary text-primary-foreground rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="absolute -right-12 -top-12 w-40 h-40 bg-primary-foreground/20 rounded-full blur-xl" />
          <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-primary-foreground/10 rounded-full blur-xl" />
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-3">
              <div className="font-extrabold text-[10px] uppercase tracking-widest text-primary-foreground/80 flex items-center gap-1.5">
                <span className="text-amber-300">✨</span> {activeAccountTab === "overview" ? "Combined Closing Balance" : activeAccountTab === "bank" ? "Closing Balance In Bank" : "Cash In Hand"}
              </div>
              <div className="w-8 h-8 rounded-full bg-primary-foreground/20 flex items-center justify-center border border-primary-foreground/30">
                <span className="text-sm font-bold text-primary-foreground">₹</span>
              </div>
            </div>
            {loading ? <Skeleton className="h-10 w-44 mb-3 bg-primary-foreground/20" /> : <div className="text-3xl sm:text-4xl font-black mb-3 text-primary-foreground break-words">₹{formatINR(closingBalance)}</div>}
            <div className="text-primary-foreground/70 font-medium text-[10px] leading-tight opacity-90 max-w-[180px]">
              {activeAccountTab === "overview" ? "Bank + Cash: Opening + Credit - Debt" : "Opening Balance + Total Credit - Total Debt"}
            </div>
          </div>
        </div>

      </div>

      {/* Side-by-Side Tables */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">

        {/* Credit Table */}
        <div className="bg-card border border-border/50 rounded-2xl shadow-sm flex flex-col h-full min-w-0">
          <div className="p-3 sm:p-4 border-b border-border/50 flex flex-wrap justify-between items-center gap-3 bg-emerald-500/5 rounded-t-2xl">
            <div className="flex gap-3 items-center min-w-0 flex-1 basis-56">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <ArrowDownLeft className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-foreground text-lg leading-none">Credit <span className="text-muted-foreground font-bold text-sm">(Income / Invoices)</span></h3>
                <p className="text-xs text-muted-foreground font-medium mt-1">Auto-synced invoices and income</p>
              </div>
            </div>
            <button
              onClick={openAddCredit}
              className="px-4 py-2 bg-primary text-primary-foreground font-bold rounded-lg hover:bg-primary/90 transition-colors shadow-sm flex items-center justify-center gap-2 text-sm shrink-0 w-full sm:w-auto"
            >
              <Plus className="w-4 h-4" /> Add Credit
            </button>
          </div>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead className="bg-background text-muted-foreground text-[10px] font-black uppercase tracking-widest border-b border-border/50">
                <tr>
                  {showInvoiceColumn && <SortableHeader label="Invoice" sortKey="refNo" currentSort={creditSortConfig} onSort={requestCreditSort} className="p-3 pl-4" />}
                  {showAccountColumn && <th className="p-3">Account</th>}
                  <SortableHeader label="Date" sortKey="date" currentSort={creditSortConfig} onSort={requestCreditSort} className={showInvoiceColumn ? "p-3" : "p-3 pl-4"} />
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
                {loading && tableSkeletonRows}
                {!loading && sortedCredit.length === 0 && (
                  <tr><td colSpan={12} className="p-8 text-center text-xs font-medium text-muted-foreground">No credit entries found.</td></tr>
                )}
                {!loading && sortedCredit.map((trx: any) => (
                  <tr key={trx.id} className="hover:bg-muted/30 transition-colors">
                    {showInvoiceColumn && (
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
                    {showAccountColumn && <td className="p-3">{accountBadge(trx)}</td>}
                    <td className={`p-3 ${showInvoiceColumn ? "" : "pl-4 "}text-xs font-bold text-muted-foreground`}>{formatDate(trx.date)}</td>
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
            {loading ? <Skeleton className="h-5 w-28" /> : <span className="text-base font-black text-emerald-600">₹{formatINR(totalCredit)}</span>}
          </div>
        </div>

        {/* Debt Table */}
        <div className="bg-card border border-border/50 rounded-2xl shadow-sm flex flex-col h-full min-w-0">
          <div className="p-3 sm:p-4 border-b border-border/50 flex flex-wrap justify-between items-center gap-3 bg-rose-500/5 rounded-t-2xl">
            <div className="flex gap-3 items-center min-w-0 flex-1 basis-56">
              <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <ArrowUpRight className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-foreground text-lg leading-none">Debt <span className="text-muted-foreground font-bold text-sm">(Expenses / Bills)</span></h3>
                <p className="text-xs text-muted-foreground font-medium mt-1">Automatic numbering (DDMM + running sequence)</p>
              </div>
            </div>
            <button
              onClick={openAddDebt}
              className="px-4 py-2 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700 transition-colors shadow-sm flex items-center justify-center gap-2 text-sm shrink-0 w-full sm:w-auto"
            >
              <Plus className="w-4 h-4" /> Add Debt
            </button>
          </div>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead className="bg-background text-muted-foreground text-[10px] font-black uppercase tracking-widest border-b border-border/50">
                <tr>
                  <SortableHeader label="Expense No." sortKey="refNo" currentSort={debtSortConfig} onSort={requestDebtSort} className="p-3 pl-4" />
                  {showAccountColumn && <th className="p-3">Account</th>}
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
                {loading && tableSkeletonRows}
                {!loading && sortedDebt.length === 0 && (
                  <tr><td colSpan={12} className="p-8 text-center text-xs font-medium text-muted-foreground">No debt entries found.</td></tr>
                )}
                {!loading && sortedDebt.map((trx: any) => (
                  <tr key={trx.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3 pl-4">
                      <span className="text-xs font-black text-foreground bg-muted/50 px-2 py-0.5 rounded-md border border-border/50">{trx.refNo || "-"}</span>
                    </td>
                    {showAccountColumn && <td className="p-3">{accountBadge(trx)}</td>}
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
            {loading ? <Skeleton className="h-5 w-28" /> : <span className="text-base font-black text-rose-600">₹{formatINR(totalDebt)}</span>}
          </div>
        </div>

      </div>

      {/* --- ADD CREDIT MODAL --- */}
      <Dialog open={isAddCreditOpen} onOpenChange={(open) => { setIsAddCreditOpen(open); if (!open) resetCreditModal(); }}>
        <DialogContent className="w-[calc(100vw-16px)] sm:w-full sm:max-w-lg max-h-[90dvh] flex flex-col p-0 overflow-hidden rounded-2xl sm:rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className="p-4 border-b border-border/50 flex justify-between items-center bg-emerald-500/5">
            <div>
              <h3 className="font-black text-lg text-foreground flex items-center gap-2"><ArrowDownLeft className="w-4 h-4 text-emerald-600" /> {editingId ? "Edit Credit (Income / Invoice)" : "Add Credit (Income / Invoice)"}</h3>
              <p className="text-xs font-medium text-muted-foreground">{editingId ? "Update this credit entry." : "Record incoming funds. You can link an existing invoice or enter details manually."}</p>
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
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">Account *</label>
              <SearchableSelect
                value={creditAccount}
                onChange={setCreditAccount}
                options={accountOptions}
                placeholder="Select account"
                searchPlaceholder="Search account..."
                className="w-full h-[40px] px-3 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
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
            <button onClick={() => saveNew("credit")} disabled={uploadingAttachment} className="px-4 py-2 font-bold text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">{editingId ? "Save Changes" : "Save Credit Transaction"}</button>
          </div>
        </DialogContent>
      </Dialog>

      {/* --- ADD DEBT MODAL --- */}
      <Dialog open={isAddDebtOpen} onOpenChange={(open) => { setIsAddDebtOpen(open); if (!open) resetDebtModal(); }}>
        <DialogContent className="w-[calc(100vw-24px)] sm:w-full sm:max-w-lg max-h-[90dvh] flex flex-col p-0 overflow-hidden rounded-2xl sm:rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className="p-4 border-b border-border/50 flex justify-between items-center bg-rose-500/5">
            <div>
              <h3 className="font-black text-lg text-foreground flex items-center gap-2"><ArrowUpRight className="w-4 h-4 text-rose-600" /> {editingId ? "Edit Debt (Expense / Bill)" : "Add Debt (Expense / Bill)"}</h3>
              <p className="text-xs font-medium text-muted-foreground">Record company expenditure. Expense No. is generated automatically: date + month of the entry, then a running sequence (e.g. 1910001).</p>
            </div>
            <button onClick={() => { setIsAddDebtOpen(false); resetDebtModal(); }} className="p-2 hover:bg-muted rounded-full transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-5 overflow-y-auto max-h-[70vh]">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">Account *</label>
              <SearchableSelect
                value={debtAccount}
                onChange={setDebtAccount}
                options={accountOptions}
                placeholder="Select account"
                searchPlaceholder="Search account..."
                className="w-full h-[40px] px-3 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">Expense No.</label>
                <input type="text" disabled value={editingId ? debtForm.ref_no : ""} placeholder={`Auto-generated (e.g. ${(debtForm.date || todayISO()).slice(8, 10)}${(debtForm.date || todayISO()).slice(5, 7)}001)`} className="w-full px-3 py-2 bg-muted/40 border border-border/50 rounded-lg text-sm cursor-not-allowed" />
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
            <button onClick={() => saveNew("debit")} disabled={uploadingAttachment} className="px-4 py-2 font-bold text-sm bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors">{editingId ? "Save Changes" : "Save Debt Transaction"}</button>
          </div>
        </DialogContent>
      </Dialog>

      {/* OPENING BALANCES MODAL */}
      <Dialog open={isOpeningOpen} onOpenChange={setIsOpeningOpen}>
        <DialogContent className="w-[calc(100vw-16px)] sm:w-full sm:max-w-lg max-h-[90dvh] flex flex-col p-0 overflow-hidden rounded-2xl sm:rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className="p-4 border-b border-border/50 flex justify-between items-center bg-amber-500/5">
            <div>
              <h3 className="font-black text-lg text-foreground">{openingTitle}</h3>
              <p className="text-xs font-medium text-muted-foreground">Starting balance before the first entry of this account.</p>
            </div>
            <button onClick={() => setIsOpeningOpen(false)} className="p-2 hover:bg-muted rounded-full transition-colors"><X className="w-4 h-4" /></button>
          </div>
          <div className="p-4 sm:p-6 md:p-8 space-y-4 overflow-y-auto max-h-[70vh]">
            <p className="p-3 text-xs font-medium text-amber-700 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              An opening balance is locked once that account has a credit or debit entry.
            </p>
            <div className={`grid grid-cols-1 gap-4 ${showCashOpening || visibleOpeningBanks.length > 1 ? "sm:grid-cols-2" : ""}`}>
              {showCashOpening && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5 text-amber-600" /> Cash (₹)</label>
                  <input type="number" disabled={cashLocked} value={openingForm.cash} onChange={(e) => setOpeningForm((p) => ({ ...p, cash: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60 disabled:cursor-not-allowed" />
                </div>
              )}
              {visibleOpeningBanks.map((b) => {
                const id = bankIdOf(b);
                return (
                  <div key={id} className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5"><Landmark className="w-3.5 h-3.5 text-emerald-600" /> {bankLabel(b)} (₹)</label>
                    <input type="number" disabled={isBankLocked(id)} value={bankOpeningForm[id] ?? "0"} onChange={(e) => setBankOpeningForm((p) => ({ ...p, [id]: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60 disabled:cursor-not-allowed" />
                  </div>
                );
              })}
            </div>
            {bankAccounts.length === 0 && activeAccountTab !== "cash" && (
              <button onClick={() => { setIsOpeningOpen(false); openBankModal(); }} className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Add a bank account to set its own opening balance
              </button>
            )}
          </div>
          <div className="px-4 sm:px-6 md:px-8 py-4 border-t border-border/50 flex justify-end gap-3">
            <button onClick={() => setIsOpeningOpen(false)} className="px-4 py-2 font-bold text-sm bg-background border border-border/50 rounded-lg hover:bg-muted transition-colors">{openingLocked ? "Close" : "Cancel"}</button>
            {!openingLocked && (
              <button onClick={saveOpeningBalances} className="px-4 py-2 font-bold text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">Save Balances</button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* MANAGE BANK ACCOUNTS MODAL */}
      <Dialog open={isManageBanksOpen} onOpenChange={setIsManageBanksOpen}>
        <DialogContent className="w-[calc(100vw-16px)] sm:w-full sm:max-w-3xl max-h-[90dvh] flex flex-col p-0 overflow-hidden rounded-2xl sm:rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className="p-4 border-b border-border/50 flex justify-between items-center bg-emerald-500/5">
            <div>
              <h3 className="font-black text-lg text-foreground flex items-center gap-2"><Landmark className="w-4 h-4 text-emerald-600" /> Manage Bank Accounts</h3>
              <p className="text-xs font-medium text-muted-foreground">Bank accounts are shared with invoices.</p>
            </div>
            <button onClick={() => setIsManageBanksOpen(false)} className="p-2 hover:bg-muted rounded-full transition-colors"><X className="w-4 h-4" /></button>
          </div>
          <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
            <div className="flex justify-end">
              <button onClick={() => openBankModal()} className="px-4 py-2 bg-emerald-600 text-white font-bold text-sm rounded-lg hover:bg-emerald-700 transition-colors shadow-sm flex items-center gap-2">
                <Plus className="w-4 h-4" /> Add Bank Account
              </button>
            </div>
            <div className="border border-border/50 rounded-xl overflow-x-auto bg-card">
              <table className="w-full text-left whitespace-nowrap">
                <thead className="bg-muted/30 border-b border-border/50 text-muted-foreground text-[10px] font-black uppercase tracking-widest">
                  <tr>
                    <th className="p-3 pl-4">Account</th>
                    <th className="p-3">Bank / IFSC</th>
                    <th className="p-3 text-right">Opening</th>
                    <th className="p-3 pr-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50 text-sm">
                  {bankAccounts.length === 0 && (
                    <tr><td colSpan={4} className="p-6 text-center text-xs font-medium text-muted-foreground">No bank accounts yet.</td></tr>
                  )}
                  {bankAccounts.map((b) => {
                    const id = bankIdOf(b);
                    return (
                      <tr key={id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3 pl-4">
                          <div className="font-bold text-foreground flex items-center gap-2">
                            <Landmark className="w-4 h-4 text-emerald-600" /> {bankLabel(b)}
                            {b.is_default && <span className="text-[9px] uppercase tracking-wider text-emerald-600">Default</span>}
                          </div>
                          {(b.account_name || b.upi_id) && <div className="text-[11px] text-muted-foreground mt-0.5 pl-6">{[b.account_name, b.upi_id].filter(Boolean).join(" · ")}</div>}
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          <div className="font-semibold text-foreground">{b.bank_name}{b.branch ? `, ${b.branch}` : ""}</div>
                          <div>{b.ifsc_code}</div>
                        </td>
                        <td className="p-3 text-right font-medium text-muted-foreground">₹{formatINR(bankOpening[id] || 0)}</td>
                        <td className="p-3 pr-4">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => openBankModal(b)} className="text-muted-foreground hover:text-foreground p-1" title="Edit bank account"><Edit3 className="w-4 h-4" /></button>
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
        </DialogContent>
      </Dialog>

      {/* ADD / EDIT BANK ACCOUNT MODAL */}
      <Dialog open={isBankModalOpen} onOpenChange={setIsBankModalOpen}>
        <DialogContent className="w-[calc(100vw-16px)] sm:w-full sm:max-w-lg max-h-[90dvh] flex flex-col p-0 overflow-hidden rounded-2xl sm:rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className="p-4 border-b border-border/50 flex justify-between items-center bg-emerald-500/5">
            <div>
              <h3 className="font-black text-lg text-foreground flex items-center gap-2"><Landmark className="w-4 h-4 text-emerald-600" /> {editingBankId ? "Edit Bank Account" : "Add Bank Account"}</h3>
              <p className="text-xs font-medium text-muted-foreground">Bank accounts are shared with invoices.</p>
            </div>
            <button onClick={() => setIsBankModalOpen(false)} className="p-2 hover:bg-muted rounded-full transition-colors"><X className="w-4 h-4" /></button>
          </div>
          <div className="p-4 sm:p-6 md:p-8 space-y-4 overflow-y-auto max-h-[70vh]">
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
                  <label className="text-xs font-bold text-muted-foreground">{label}</label>
                  <input type="text" placeholder={placeholder} value={bankForm[key]} onChange={(e) => setBankForm((p) => ({ ...p, [key]: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
              ))}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">Opening Balance (₹)</label>
                <input type="number" disabled={!!editingBankId && isBankLocked(editingBankId)} value={bankForm.opening} onChange={(e) => setBankForm((p) => ({ ...p, opening: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60 disabled:cursor-not-allowed" />
              </div>
            </div>
          </div>
          <div className="px-4 sm:px-6 md:px-8 py-4 border-t border-border/50 flex justify-end gap-3">
            <button onClick={() => setIsBankModalOpen(false)} className="px-4 py-2 font-bold text-sm bg-background border border-border/50 rounded-lg hover:bg-muted transition-colors">Cancel</button>
            <button onClick={saveBankAccount} className="px-4 py-2 font-bold text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">{editingBankId ? "Save Changes" : "Add Account"}</button>
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
        isOpen={!!bankToDelete}
        onClose={() => setBankToDelete(null)}
        onConfirm={confirmDeleteBank}
        title="Delete Bank Account"
        description={`Delete "${bankToDelete ? bankLabel(bankToDelete) : ""}"? It will also be removed from the invoice bank account list.`}
        confirmText="Delete"
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
