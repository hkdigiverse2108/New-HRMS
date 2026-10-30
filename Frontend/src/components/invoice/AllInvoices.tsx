import { useState, useEffect } from "react";
import {
  FileText,
  Download,
  Trash2,
  ReceiptText,
  ArrowUpRight,
  Building2,
  Plus,
  X,
  CreditCard,
  CheckCircle2,
  Loader2,
  Pencil,
  QrCode,
  RefreshCw,
  Ban,
  AlertTriangle,
  History,
  Briefcase,
  Copy,
} from "lucide-react";
import QRCode from "qrcode";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ServicesManagerModal } from "./ServicesManagerModal";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableHeader } from "@/components/ui/sortable-header";
import { SearchableSelect } from "@/components/ui/select";
import { DateRangeFilter } from "@/components/common/DateRangeFilter";
import { SearchInput } from "@/components/common/SearchInput";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { api } from "@/lib/api";
import { API_URL } from "@/lib/config";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type InvoiceStatus = "Draft" | "Pending" | "Paid" | "Overdue" | "Cancelled";

interface Invoice {
  id: string;
  invoiceNumber: string;
  clientName: string;
  amount: string;
  date: string;
  dueDate: string;
  status: InvoiceStatus;
  invoiceType?: string;
  raw?: any;
}

interface BankAccount {
  id?: string;
  _id?: string;
  nickname: string;
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  upi_id?: string;
  is_default?: boolean;
}

export function AllInvoices({ setActive }: { setActive?: (path: string) => void } = {}) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "All">("All");
  const [typeFilter, setTypeFilter] = useState<"All" | "Tax Invoice" | "Proforma Invoice">("All");
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    id: string | null;
    name: string;
    status?: InvoiceStatus;
  }>({
    isOpen: false,
    id: null,
    name: "",
  });
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Invoice Activity Logs Modal State
  const [logsModal, setLogsModal] = useState<{
    isOpen: boolean;
    invoiceId: string | null;
    invoiceNumber: string;
    clientName: string;
    loading: boolean;
    logs: any[];
  }>({
    isOpen: false,
    invoiceId: null,
    invoiceNumber: "",
    clientName: "",
    loading: false,
    logs: [],
  });

  // Other Accounts State
  const [showAccountsModal, setShowAccountsModal] = useState(false);
  const [showServicesModal, setShowServicesModal] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [submittingAccount, setSubmittingAccount] = useState(false);
  const [deleteAccountConfirm, setDeleteAccountConfirm] = useState<{
    isOpen: boolean;
    id: string | null;
    name: string;
  }>({ isOpen: false, id: null, name: "" });

  // Add / Edit Account Form State (First field is Nick Name as requested by user)
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [upiId, setUpiId] = useState("");

  // Automatic QR Code Generation State
  const [upiQrDataUrl, setUpiQrDataUrl] = useState<string>("");
  const [viewingQrAccount, setViewingQrAccount] = useState<BankAccount | null>(null);
  const [viewingQrDataUrl, setViewingQrDataUrl] = useState<string>("");

  // Automatically generate QR code when upiId changes
  useEffect(() => {
    if (!upiId.trim()) {
      setUpiQrDataUrl("");
      return;
    }
    const payeeName = nickname.trim() || bankName.trim() || "Payee";
    const upiUri = `upi://pay?pa=${encodeURIComponent(upiId.trim())}&pn=${encodeURIComponent(payeeName)}&cu=INR`;
    QRCode.toDataURL(upiUri, { width: 180, margin: 1 })
      .then((url) => setUpiQrDataUrl(url))
      .catch((err) => console.error("QR Code generation error:", err));
  }, [upiId, nickname, bankName]);

  const handleOpenQrModal = async (acc: BankAccount) => {
    if (!acc.upi_id) return;
    setViewingQrAccount(acc);
    const payeeName = acc.nickname || acc.bank_name || "Payee";
    const upiUri = `upi://pay?pa=${encodeURIComponent(acc.upi_id)}&pn=${encodeURIComponent(payeeName)}&cu=INR`;
    try {
      const url = await QRCode.toDataURL(upiUri, { width: 260, margin: 1 });
      setViewingQrDataUrl(url);
    } catch (err) {
      console.error("Failed to generate QR for modal:", err);
    }
  };

  const handleStartEdit = (acc: BankAccount) => {
    const id = String(acc.id || acc._id);
    setEditingAccountId(id);
    setNickname(acc.nickname || "");
    setBankName(acc.bank_name || "");
    setAccountNumber(acc.account_number || "");
    setIfscCode(acc.ifsc_code || "");
    setUpiId(acc.upi_id || "");
  };

  const handleCancelEdit = () => {
    setEditingAccountId(null);
    setNickname("");
    setBankName("");
    setAccountNumber("");
    setIfscCode("");
    setUpiId("");
    setUpiQrDataUrl("");
  };

  // Fetch Invoices from Backend
  const fetchInvoices = async () => {
    try {
      setLoadingInvoices(true);
      const res = await api.get<any>("/invoices", { showLoader: false, showErrorToast: false });
      const list = Array.isArray(res)
        ? res
        : Array.isArray(res?.items)
        ? res.items
        : Array.isArray(res?.data)
        ? res.data
        : [];
      const mapped: Invoice[] = list.map((item: any) => {
        const rawStatus = String(item.status || "draft").toLowerCase();
        let status: InvoiceStatus = "Draft";
        if (rawStatus === "paid") status = "Paid";
        else if (rawStatus === "overdue") status = "Overdue";
        else if (rawStatus === "cancelled" || rawStatus === "canceled") status = "Cancelled";
        else if (
          rawStatus === "pending" ||
          rawStatus === "pending_approval" ||
          rawStatus === "unpaid" ||
          rawStatus === "partially_paid"
        )
          status = "Pending";
        else status = "Draft";

        return {
          id: String(item.id || item._id),
          invoiceNumber: item.invoice_number || `INV-${item._id?.slice(-4)}`,
          clientName: item.client_name || "Unknown Client",
          amount: `₹ ${(item.total_due || 0).toLocaleString("en-IN")}`,
          date: item.issue_date || (item.created_at ? item.created_at.split("T")[0] : ""),
          dueDate: item.due_date || item.issue_date || "",
          status,
          invoiceType: item.invoice_type || "Tax Invoice",
          raw: item,
        };
      });
      setInvoices(mapped);
    } catch (err) {
      console.warn("Could not load invoices from API", err);
      setInvoices([]);
    } finally {
      setLoadingInvoices(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  // Fetch Saved Other Accounts
  const fetchAccounts = async () => {
    try {
      setLoadingAccounts(true);
      const res = await api.get<any>("/bank-accounts", { showLoader: false, showErrorToast: false });
      const list = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.items)
        ? res.items
        : [];
      setBankAccounts(list);
    } catch (err) {
      console.warn("Failed to fetch bank accounts", err);
    } finally {
      setLoadingAccounts(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  // Handle Add / Edit Bank Account
  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) {
      toast.error("Please enter a Nick Name for this account");
      return;
    }
    if (!bankName.trim()) {
      toast.error("Please enter Bank Name");
      return;
    }
    if (!accountNumber.trim()) {
      toast.error("Please enter Account Number");
      return;
    }
    if (!ifscCode.trim()) {
      toast.error("Please enter IFSC Code");
      return;
    }

    try {
      setSubmittingAccount(true);
      const payload = {
        nickname: nickname.trim(),
        bank_name: bankName.trim(),
        account_number: accountNumber.trim(),
        ifsc_code: ifscCode.trim().toUpperCase(),
        upi_id: upiId.trim() || undefined,
        is_default: false,
      };

      if (editingAccountId) {
        await api.put(`/bank-accounts/${editingAccountId}`, payload);
        toast.success("Other Account updated successfully!");
      } else {
        await api.post("/bank-accounts", payload);
        toast.success("Other Account added successfully!");
      }

      handleCancelEdit();
      fetchAccounts();
    } catch (err: any) {
      console.error("Failed to save bank account", err);
      toast.error(err?.message || "Failed to save bank account");
    } finally {
      setSubmittingAccount(false);
    }
  };

  // Handle Delete Bank Account
  const confirmDeleteAccount = async () => {
    if (!deleteAccountConfirm.id) return;
    try {
      await api.delete(`/bank-accounts/${deleteAccountConfirm.id}`);
      toast.success("Account deleted successfully");
      setBankAccounts((prev) =>
        prev.filter((a) => String(a.id || a._id) !== deleteAccountConfirm.id)
      );
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete account");
    } finally {
      setDeleteAccountConfirm({ isOpen: false, id: null, name: "" });
    }
  };

  const isInvoiceInDateRange = (inv: Invoice, range?: { from?: Date | undefined; to?: Date | undefined } | null) => {
    if (!range || !range.from) return true;
    if (!inv.date) return false;

    // Parse inv.date safely (supports YYYY-MM-DD or ISO string)
    const dateStr = inv.date.includes("T") ? (inv.date.split("T")[0] || "") : inv.date;
    const parts = dateStr.split("-");
    let invTime: number;
    if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      invTime = new Date(year, month, day).setHours(0, 0, 0, 0);
    } else {
      const d = new Date(inv.date);
      if (isNaN(d.getTime())) return false;
      invTime = new Date(d.getFullYear(), d.getMonth(), d.getDate()).setHours(0, 0, 0, 0);
    }

    const fromTime = new Date(range.from.getFullYear(), range.from.getMonth(), range.from.getDate()).setHours(0, 0, 0, 0);
    if (invTime < fromTime) return false;

    if (range.to) {
      const toTime = new Date(range.to.getFullYear(), range.to.getMonth(), range.to.getDate()).setHours(23, 59, 59, 999);
      if (invTime > toTime) return false;
    }

    return true;
  };

  const isTaxInvoice = (inv: Invoice) => {
    const type = (inv.invoiceType || "Tax Invoice").toLowerCase();
    return !type.includes("proforma");
  };

  const isProformaInvoice = (inv: Invoice) => {
    const type = (inv.invoiceType || "").toLowerCase();
    return type.includes("proforma");
  };

  // Invoices filtered by date range for KPI stats cards and entire page
  const dateFilteredInvoices = invoices.filter((inv) => isInvoiceInDateRange(inv, dateRange));

  const filteredInvoices = dateFilteredInvoices.filter((inv) => {
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      inv.clientName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "All" || inv.status === statusFilter;
    const matchesType =
      typeFilter === "All" ||
      (typeFilter === "Proforma Invoice" ? isProformaInvoice(inv) : isTaxInvoice(inv));

    return matchesSearch && matchesStatus && matchesType;
  });

  const { items: sortedInvoices, requestSort, sortConfig } = useSortableData(filteredInvoices);

  // Export the currently visible (filtered + sorted) invoices as CSV
  const handleExportList = () => {
    if (sortedInvoices.length === 0) {
      toast.error("No invoices to export");
      return;
    }
    const header = [
      "Invoice No", "Type", "Client", "Client GSTIN", "Issue Date", "Due Date", "Status",
      "Mode of Payment", "Taxable", "CGST", "SGST", "IGST", "Total",
    ];
    const rows = sortedInvoices.map((inv) => {
      const r = inv.raw || {};
      const taxable = Math.max(0, Number(r.total_before_tax || 0) - Number(r.additional_discount || 0));
      return [
        inv.invoiceNumber, inv.invoiceType || "Tax Invoice", inv.clientName, r.client_gstin || "",
        inv.date, inv.dueDate, inv.status, r.mode_of_payment || "",
        taxable, Number(r.cgst_amount || 0), Number(r.sgst_amount || 0), Number(r.igst_amount || 0),
        Number(r.total_due || 0),
      ];
    });
    const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [header, ...rows].map((row) => row.map(escape).join(",")).join("\r\n");
    // BOM so Excel reads non-ASCII text correctly
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoices_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} invoice${rows.length === 1 ? "" : "s"}`);
  };

  const handleCancelInvoice = async (invoiceId?: string) => {
    const targetId = invoiceId || deleteConfirm.id;
    if (!targetId) return;
    try {
      setIsProcessingAction(true);
      await api.patch(`/invoices/${targetId}/status`, { status: "cancelled" });
      toast.success("Invoice cancelled successfully");
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === targetId ? { ...inv, status: "Cancelled" } : inv
        )
      );
      setDeleteConfirm({ isOpen: false, id: null, name: "" });
      fetchInvoices();
    } catch (err: any) {
      console.error("Failed to cancel invoice", err);
      toast.error(err?.message || "Failed to cancel invoice");
    } finally {
      setIsProcessingAction(false);
    }
  };

  const confirmDelete = async () => {
    if (deleteConfirm.id) {
      try {
        setIsProcessingAction(true);
        await api.delete(`/invoices/${deleteConfirm.id}`);
        toast.success("Invoice deleted successfully");
        setInvoices((prev) => prev.filter((inv) => inv.id !== deleteConfirm.id));
      } catch (err: any) {
        console.error("Failed to delete invoice", err);
        toast.error(err?.message || "Failed to delete invoice");
      } finally {
        setIsProcessingAction(false);
      }
    }
    setDeleteConfirm({ isOpen: false, id: null, name: "" });
  };

  // Activity Logs Time Formatting Helpers (Converts UTC to local Indian Standard Time accurately)
  const parseUtcDate = (ts: any): Date | null => {
    if (!ts) return null;
    if (ts instanceof Date) return ts;
    if (typeof ts === "number") {
      return new Date(ts < 1e11 ? ts * 1000 : ts);
    }
    let str = String(ts).trim();
    if (!str) return null;
    // If naive datetime string (e.g. "2026-10-13T06:21:00" or "2026-10-13 06:21:00.123"),
    // MongoDB stores in UTC, so append 'Z' so browser correctly parses it as UTC and converts to exact local time
    if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(str)) {
      str = str.replace(" ", "T");
      if (!str.endsWith("Z") && !/[+-]\d{2}:?\d{2}$/.test(str)) {
        str = str + "Z";
      }
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  };

  const formatLogTimestamp = (ts: any): string => {
    const date = parseUtcDate(ts);
    if (!date) return ts ? String(ts) : "Recent";
    return date.toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatLogFullTimestamp = (ts: any): string => {
    const date = parseUtcDate(ts);
    if (!date) return "";
    return date.toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  // Activity Logs Handler
  const handleOpenLogsModal = async (inv: Invoice) => {
    setLogsModal({
      isOpen: true,
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      clientName: inv.clientName,
      loading: true,
      logs: inv.raw?.activity_logs || [],
    });

    try {
      const res = await api.get<any>(`/invoices/${inv.id}`, { showLoader: false, showErrorToast: false });
      if (res) {
        setLogsModal((prev) => ({
          ...prev,
          loading: false,
          logs: Array.isArray(res.activity_logs) ? res.activity_logs : prev.logs,
        }));
      } else {
        setLogsModal((prev) => ({ ...prev, loading: false }));
      }
    } catch (err) {
      console.warn("Failed to fetch fresh invoice logs:", err);
      setLogsModal((prev) => ({ ...prev, loading: false }));
    }
  };



  const totalAmount = dateFilteredInvoices
    .filter((inv) => inv.status !== "Cancelled")
    .reduce((acc, curr) => {
      const val = parseInt(curr.amount.replace(/[^0-9]/g, "")) || 0;
      return acc + val;
    }, 0);

  const taxInvoiceAmount = dateFilteredInvoices
    .filter((inv) => isTaxInvoice(inv) && inv.status !== "Cancelled")
    .reduce((acc, curr) => {
      const val = parseInt(curr.amount.replace(/[^0-9]/g, "")) || 0;
      return acc + val;
    }, 0);

  const taxInvoiceCount = dateFilteredInvoices.filter((inv) => isTaxInvoice(inv)).length;

  const proformaInvoiceAmount = dateFilteredInvoices
    .filter((inv) => isProformaInvoice(inv) && inv.status !== "Cancelled")
    .reduce((acc, curr) => {
      const val = parseInt(curr.amount.replace(/[^0-9]/g, "")) || 0;
      return acc + val;
    }, 0);

  const proformaInvoiceCount = dateFilteredInvoices.filter((inv) => isProformaInvoice(inv)).length;

  const cancelledCount = dateFilteredInvoices.filter((inv) => inv.status === "Cancelled").length;
  const cancelledAmount = dateFilteredInvoices
    .filter((inv) => inv.status === "Cancelled")
    .reduce((acc, curr) => {
      const val = parseInt(curr.amount.replace(/[^0-9]/g, "")) || 0;
      return acc + val;
    }, 0);

  // Active KPI Box Indicators (mutually exclusive)
  const isAllActive = statusFilter === "All" && typeFilter === "All";
  const isBilledActive = statusFilter === "Paid" && typeFilter === "All";
  const isTaxActive = typeFilter === "Tax Invoice" && statusFilter === "All";
  const isProformaActive = typeFilter === "Proforma Invoice" && statusFilter === "All";
  const isCancelledActive = statusFilter === "Cancelled" && typeFilter === "All";

  // Quick filter on clicking any KPI Box
  const handleKpiBoxClick = (boxType: "all" | "billed" | "tax" | "proforma" | "cancelled") => {
    if (boxType === "all") {
      setStatusFilter("All");
      setTypeFilter("All");
    } else if (boxType === "billed") {
      if (statusFilter === "Paid" && typeFilter === "All") {
        setStatusFilter("All");
      } else {
        setStatusFilter("Paid");
        setTypeFilter("All");
      }
    } else if (boxType === "tax") {
      if (typeFilter === "Tax Invoice" && statusFilter === "All") {
        setTypeFilter("All");
      } else {
        setTypeFilter("Tax Invoice");
        setStatusFilter("All");
      }
    } else if (boxType === "proforma") {
      if (typeFilter === "Proforma Invoice" && statusFilter === "All") {
        setTypeFilter("All");
      } else {
        setTypeFilter("Proforma Invoice");
        setStatusFilter("All");
      }
    } else if (boxType === "cancelled") {
      if (statusFilter === "Cancelled" && typeFilter === "All") {
        setStatusFilter("All");
      } else {
        setStatusFilter("Cancelled");
        setTypeFilter("All");
      }
    }
  };

  // Safe fallback definitions to guarantee no runtime reference errors
  const pendingAmount = 0;
  const overdueAmount = 0;

  return (
    <div className="@container w-full space-y-6 sm:space-y-8 animate-in fade-in duration-500 min-w-0">
      {/* Header */}
      <div className="flex flex-col @4xl:flex-row justify-between items-start @4xl:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
            <ReceiptText className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
            All Invoices
          </h1>
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm font-medium">
            Manage your billing, track payments, and generate new invoices.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 @4xl:shrink-0">
          {/* Manage Other Accounts Button */}
          <button
            type="button"
            onClick={() => setShowAccountsModal(true)}
            className="w-auto px-4 py-2.5 whitespace-nowrap sm:py-2.5 bg-card border border-border/70 hover:border-primary/50 text-foreground font-bold rounded-xl hover:bg-muted/50 transition-colors flex items-center justify-center gap-2 shadow-sm text-xs sm:text-sm group"
          >
            <Building2 className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
            Other Accounts
            {bankAccounts.length > 0 && (
              <span className="px-2 py-0.5 text-[11px] font-black bg-primary/15 text-primary rounded-full">
                {bankAccounts.length}
              </span>
            )}
          </button>

          {/* Services catalog: add / edit / delete the services offered in the invoice Item Description dropdown */}
          <button
            type="button"
            onClick={() => setShowServicesModal(true)}
            className="w-auto px-4 py-2.5 whitespace-nowrap sm:py-2.5 bg-card border border-border/70 hover:border-primary/50 text-foreground font-bold rounded-xl hover:bg-muted/50 transition-colors flex items-center justify-center gap-2 shadow-sm text-xs sm:text-sm group"
          >
            <Briefcase className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
            Services
          </button>

          {setActive && (
            <button
              type="button"
              onClick={() => setActive("/invoice/create")}
              className="w-auto px-4 py-2.5 whitespace-nowrap sm:py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm text-xs sm:text-sm"
            >
              <Plus className="w-4 h-4" />
              Create Invoice
            </button>
          )}

          <button
            type="button"
            onClick={handleExportList}
            disabled={loadingInvoices}
            className="w-auto px-4 py-2.5 whitespace-nowrap sm:py-2.5 bg-card border border-border/50 text-foreground font-bold rounded-xl hover:bg-muted/50 transition-colors flex items-center justify-center gap-2 shadow-sm text-xs sm:text-sm disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Export List
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-6 @5xl:grid-cols-5">
        {/* 1. Total Invoices */}
        <div
          onClick={() => handleKpiBoxClick("all")}
          className={cn(
            "min-w-0 col-span-2 md:col-span-2 @5xl:col-span-1 bg-card border rounded-2xl p-4 sm:p-5 shadow-xs cursor-pointer transition-all hover:scale-[1.01] select-none",
            isAllActive
              ? "border-primary/60 ring-2 ring-primary/25 bg-primary/5 shadow-md"
              : "border-border/50 hover:border-border opacity-80 hover:opacity-100"
          )}
        >
          <div className="text-muted-foreground font-bold text-xs uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Total Invoices</span>
            {isAllActive && (
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            )}
          </div>
          <div className="text-xl sm:text-2xl @6xl:text-3xl font-black whitespace-nowrap">{dateFilteredInvoices.length}</div>
        </div>

        {/* 2. Total Billed */}
        <div
          onClick={() => handleKpiBoxClick("billed")}
          className={cn(
            "min-w-0 col-span-1 md:col-span-2 @5xl:col-span-1 border rounded-2xl p-4 sm:p-5 shadow-xs cursor-pointer transition-all hover:scale-[1.01] select-none",
            isBilledActive
              ? "bg-emerald-500/15 border-emerald-500/50 ring-2 ring-emerald-500/30 shadow-md"
              : "bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10 opacity-80 hover:opacity-100"
          )}
        >
          <div className="text-emerald-600 font-bold text-xs uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Total Billed</span>
            {isBilledActive && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </div>
          <div className="text-xl sm:text-2xl @6xl:text-3xl font-black whitespace-nowrap text-emerald-700 dark:text-emerald-400">
            ₹ {totalAmount.toLocaleString("en-IN")}
          </div>
        </div>

        {/* 3. Tax Invoice Amount */}
        <div
          onClick={() => handleKpiBoxClick("tax")}
          className={cn(
            "min-w-0 col-span-1 md:col-span-2 @5xl:col-span-1 border rounded-2xl p-4 sm:p-5 shadow-xs cursor-pointer transition-all hover:scale-[1.01] select-none",
            isTaxActive
              ? "bg-amber-500/15 border-amber-500/50 ring-2 ring-amber-500/30 shadow-md"
              : "bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10 opacity-80 hover:opacity-100"
          )}
        >
          <div className="text-amber-600 dark:text-amber-400 font-bold text-xs uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Tax Invoice Amount</span>
            <div className="flex items-center gap-1.5">
              {isTaxActive && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              )}
              <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-amber-500/15 font-black text-amber-700 dark:text-amber-300">
                {taxInvoiceCount}
              </span>
            </div>
          </div>
          <div className="text-xl sm:text-2xl @6xl:text-3xl font-black whitespace-nowrap text-amber-700 dark:text-amber-400">
            ₹ {taxInvoiceAmount.toLocaleString("en-IN")}
          </div>
        </div>

        {/* 4. Proforma Invoice Amount */}
        <div
          onClick={() => handleKpiBoxClick("proforma")}
          className={cn(
            "min-w-0 col-span-1 md:col-span-3 @5xl:col-span-1 border rounded-2xl p-4 sm:p-5 shadow-xs cursor-pointer transition-all hover:scale-[1.01] select-none",
            isProformaActive
              ? "bg-rose-500/15 border-rose-500/50 ring-2 ring-rose-500/30 shadow-md"
              : "bg-rose-500/5 border-rose-500/20 hover:bg-rose-500/10 opacity-80 hover:opacity-100"
          )}
        >
          <div className="text-rose-600 dark:text-rose-400 font-bold text-xs uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Proforma Invoice Amount</span>
            <div className="flex items-center gap-1.5">
              {isProformaActive && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              )}
              <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-rose-500/15 font-black text-rose-700 dark:text-rose-300">
                {proformaInvoiceCount}
              </span>
            </div>
          </div>
          <div className="text-xl sm:text-2xl @6xl:text-3xl font-black whitespace-nowrap text-rose-700 dark:text-rose-400">
            ₹ {proformaInvoiceAmount.toLocaleString("en-IN")}
          </div>
        </div>

        {/* 5. Cancelled */}
        <div
          onClick={() => handleKpiBoxClick("cancelled")}
          className={cn(
            "min-w-0 col-span-1 md:col-span-3 @5xl:col-span-1 border rounded-2xl p-4 sm:p-5 shadow-xs cursor-pointer transition-all hover:scale-[1.01] select-none",
            isCancelledActive
              ? "bg-slate-500/15 border-slate-500/50 ring-2 ring-slate-500/30 shadow-md"
              : "bg-slate-500/5 border-slate-500/20 hover:bg-slate-500/10 opacity-80 hover:opacity-100"
          )}
        >
          <div className="text-slate-600 dark:text-slate-400 font-bold text-xs uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Cancelled</span>
            <div className="flex items-center gap-1.5">
              {isCancelledActive && (
                <span className="w-2 h-2 rounded-full bg-slate-500 animate-pulse" />
              )}
              <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-slate-500/15 font-black text-slate-700 dark:text-slate-300">
                {cancelledCount}
              </span>
            </div>
          </div>
          <div className="text-xl sm:text-2xl @6xl:text-3xl font-black whitespace-nowrap text-slate-700 dark:text-slate-300">
            ₹ {cancelledAmount.toLocaleString("en-IN")}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col @5xl:flex-row @5xl:justify-between @5xl:items-center gap-3 sm:gap-4 bg-card border border-border/50 p-3 sm:p-4 rounded-2xl shadow-sm">
        <SearchInput
          placeholder="Search by client or invoice number..."
          value={search}
          onChange={setSearch}
          className="w-full" containerClassName="w-full sm:w-full md:w-full @5xl:w-72 @5xl:flex-none @5xl:min-w-[180px]"
        />
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full @5xl:w-auto">
          <DateRangeFilter
            dateRange={dateRange}
            onChange={(val) => setDateRange(val || { from: undefined, to: undefined })}
            placeholder="Filter by invoice date"
            className="flex-1 min-w-[150px] @5xl:flex-none @5xl:w-auto"
          />
          <div className="relative flex-1 min-w-[150px] @5xl:flex-none @5xl:w-auto flex items-center gap-2">
            <SearchableSelect
              value={statusFilter}
              onChange={(val) => {
                setStatusFilter(val as any);
                setTypeFilter("All");
              }}
              options={[
                { label: "All Statuses", value: "All" },
                { label: "Paid", value: "Paid" },
                { label: "Cancelled", value: "Cancelled" },
              ]}
              className="w-full @5xl:w-[180px] h-[40px] px-3 bg-background border border-border/50 rounded-xl text-sm font-bold cursor-pointer"
            />
            {!isAllActive && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("All");
                  setTypeFilter("All");
                }}
                className="px-3 py-2 text-xs font-bold text-muted-foreground hover:text-foreground bg-muted/60 hover:bg-muted rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 border border-border/40"
                title="Reset all filters"
              >
                <X className="w-3.5 h-3.5" />
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Invoice List */}
      <div className="bg-card border border-border/50 rounded-2xl sm:rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <SortableHeader
                  label="Invoice Info"
                  sortKey="invoiceNumber"
                  currentSort={sortConfig}
                  onSort={requestSort}
                  className="p-3 sm:p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider"
                />
                <SortableHeader
                  label="Client"
                  sortKey="clientName"
                  currentSort={sortConfig}
                  onSort={requestSort}
                  className="p-3 sm:p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider"
                />
                <SortableHeader
                  label="Amount"
                  sortKey="amount"
                  currentSort={sortConfig}
                  onSort={requestSort}
                  className="p-3 sm:p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider"
                />
                <SortableHeader
                  label="Dates"
                  sortKey="date"
                  currentSort={sortConfig}
                  onSort={requestSort}
                  className="p-3 sm:p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider"
                />
                <SortableHeader
                  label="Status"
                  sortKey="status"
                  currentSort={sortConfig}
                  onSort={requestSort}
                  className="p-3 sm:p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider"
                />
                <th className="p-3 sm:p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {loadingInvoices ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                    <span className="text-sm font-semibold">Loading invoices...</span>
                  </td>
                </tr>
              ) : (
                <>
                  {sortedInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-muted/20 transition-colors group">
                      <td className="p-3 sm:p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
                          </div>
                          <div>
                            <button
                              type="button"
                              onClick={() => window.open(`${API_URL}/invoices/${inv.id}/pdf`, "_blank")}
                              className="font-bold text-sm text-foreground hover:text-primary hover:underline transition-colors text-left cursor-pointer inline-flex items-center gap-1 group/num"
                              title="Open Invoice PDF"
                            >
                              <span>{inv.invoiceNumber}</span>
                              <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover/num:opacity-100 transition-opacity text-primary" />
                            </button>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span
                                className={cn(
                                  "px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase",
                                  inv.invoiceType === "Proforma Invoice"
                                    ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                                    : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                                )}
                              >
                                {inv.invoiceType || "Tax Invoice"}
                              </span>                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 sm:p-4 font-bold text-sm text-foreground">{inv.clientName}</td>
                      <td className="p-3 sm:p-4 font-black text-sm text-foreground">{inv.amount}</td>
                      <td className="p-3 sm:p-4">
                        <div className="text-xs sm:text-sm font-medium text-foreground">
                          Billed: {inv.date}
                        </div>
                        <div className="text-xs text-muted-foreground">Due: {inv.dueDate}</div>
                      </td>
                      <td className="p-3 sm:p-4">
                        <StatusBadge status={inv.status} />
                      </td>
                      <td className="p-3 sm:p-4">
                        <div className="flex justify-end gap-1.5 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => window.open(`${API_URL}/invoices/${inv.id}/pdf`, "_blank")}
                            className="p-1.5 sm:p-2 min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 inline-flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer"
                            title="View PDF"
                          >
                            <ArrowUpRight className="w-4 h-4" />
                          </button>
                          <a
                            href={`${API_URL}/invoices/${inv.id}/download`}
                            download={`${inv.invoiceNumber}.pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 sm:p-2 min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 inline-flex items-center justify-center text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10 rounded-lg transition-colors cursor-pointer"
                            title="Download PDF"
                          >
                            <Download className="w-4 h-4" />
                          </a>

                          <button
                            type="button"
                            onClick={() => {
                              if (setActive) {
                                setActive(`/invoice/create?id=${inv.id}`);
                              } else {
                                window.dispatchEvent(new CustomEvent("navigate_tab", { detail: `/invoice/create?id=${inv.id}` }));
                              }
                            }}
                            className="p-1.5 sm:p-2 min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 inline-flex items-center justify-center text-muted-foreground hover:text-amber-600 hover:bg-amber-500/10 rounded-lg transition-colors cursor-pointer"
                            title="Update Invoice"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const path = `/invoice/create?copyFrom=${inv.id}`;
                              if (setActive) {
                                setActive(path);
                              } else {
                                window.dispatchEvent(new CustomEvent("navigate_tab", { detail: path }));
                              }
                            }}
                            className="p-1.5 sm:p-2 min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 inline-flex items-center justify-center text-muted-foreground hover:text-indigo-600 hover:bg-indigo-500/10 rounded-lg transition-colors cursor-pointer"
                            title="Copy Invoice"
                          >
                            <Copy className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenLogsModal(inv)}
                            className="p-1.5 sm:p-2 min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 inline-flex items-center justify-center text-muted-foreground hover:text-blue-600 hover:bg-blue-500/10 rounded-lg transition-colors cursor-pointer"
                            title="Invoice Activity Logs"
                          >
                            <History className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setDeleteConfirm({
                                isOpen: true,
                                id: inv.id,
                                name: inv.invoiceNumber,
                                status: inv.status,
                              })
                            }
                            className="p-1.5 sm:p-2 min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 inline-flex items-center justify-center text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                            title="Delete / Cancel Invoice"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredInvoices.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 sm:p-12">
                        <EmptyState
                          icon={FileText}
                          title="No invoices found"
                          description="Try adjusting your search query, status, or date range filter."
                          actionLabel="Reset Filters"
                          onAction={() => {
                            setSearch("");
                            setStatusFilter("All");
                            setTypeFilter("All");
                            setDateRange({ from: undefined, to: undefined });
                          }}
                        />
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete / Cancel Invoice Dialog */}
      <Dialog
        open={deleteConfirm.isOpen}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirm({ isOpen: false, id: null, name: "" });
        }}
      >
        <DialogContent className="w-[calc(100vw-24px)] sm:w-full max-w-lg p-0 overflow-hidden rounded-2xl border-border/60 shadow-xl [&>button]:hidden bg-card">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/50 bg-muted/30">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-foreground">
                  Invoice Actions
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Invoice: <span className="font-semibold text-foreground">{deleteConfirm.name}</span>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDeleteConfirm({ isOpen: false, id: null, name: "" })}
              className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            <p className="text-xs sm:text-sm text-foreground/80 leading-relaxed">
              What action would you like to perform for invoice <strong className="text-foreground">{deleteConfirm.name}</strong>?
            </p>

            <div className="pt-3 border-t border-border/50 flex items-center justify-end gap-2 flex-wrap sm:flex-nowrap">
              <button
                type="button"
                onClick={() => setDeleteConfirm({ isOpen: false, id: null, name: "" })}
                className="h-8.5 px-3 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted border border-border/60 transition-colors cursor-pointer whitespace-nowrap"
              >
                Cancel
              </button>

              {deleteConfirm.status !== "Cancelled" && (
                <button
                  type="button"
                  disabled={isProcessingAction}
                  onClick={() => handleCancelInvoice()}
                  className="h-8.5 px-3 rounded-lg text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer whitespace-nowrap disabled:opacity-50"
                >
                  {isProcessingAction ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                  Cancel Invoice
                </button>
              )}

              <button
                type="button"
                disabled={isProcessingAction}
                onClick={() => confirmDelete()}
                className="h-8.5 px-3 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                {isProcessingAction ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Delete Permanently
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>



      {/* Invoice Activity Logs Dialog */}
      <Dialog
        open={logsModal.isOpen}
        onOpenChange={(open) => {
          if (!open) setLogsModal({ isOpen: false, invoiceId: null, invoiceNumber: "", clientName: "", loading: false, logs: [] });
        }}
      >
        <DialogContent className="w-[calc(100vw-24px)] sm:w-full max-w-xl max-h-[85vh] p-0 overflow-hidden rounded-2xl border-border/60 shadow-2xl [&>button]:hidden bg-card flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-border/50 bg-muted/30 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-foreground">Invoice Activity Logs</h3>
                <p className="text-xs text-muted-foreground">
                  {logsModal.invoiceNumber} {logsModal.clientName && `• ${logsModal.clientName}`}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setLogsModal({ isOpen: false, invoiceId: null, invoiceNumber: "", clientName: "", loading: false, logs: [] })}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6">
            {logsModal.loading ? (
              <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="text-sm font-semibold">Loading activity logs...</span>
              </div>
            ) : logsModal.logs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <History className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-semibold">No activity logs recorded yet</p>
                <p className="text-xs text-muted-foreground/80 mt-1">
                  Actions like creation, updates, and status changes will be logged here.
                </p>
              </div>
            ) : (
              <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/60">
                {[...logsModal.logs].reverse().map((log: any, idx: number) => {
                  const act = String(log.action || "").toLowerCase();
                  let badgeClass = "bg-blue-500/10 text-blue-600 border-blue-500/20";
                  let dotColor = "bg-blue-500";
                  if (act.includes("create")) {
                    badgeClass = "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
                    dotColor = "bg-emerald-500";
                  } else if (act.includes("cancel") || act.includes("reject") || act.includes("delete")) {
                    badgeClass = "bg-rose-500/10 text-rose-600 border-rose-500/20";
                    dotColor = "bg-rose-500";
                  } else if (act.includes("status")) {
                    badgeClass = "bg-amber-500/10 text-amber-600 border-amber-500/20";
                    dotColor = "bg-amber-500";
                  } else if (act.includes("approve")) {
                    badgeClass = "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
                    dotColor = "bg-emerald-500";
                  }

                  const formattedDate = formatLogTimestamp(log.timestamp);
                  const fullDateTitle = formatLogFullTimestamp(log.timestamp);

                  return (
                    <div key={idx} className="relative">
                      {/* Timeline Dot */}
                      <div
                        className={cn(
                          "absolute -left-6 top-1.5 w-3 h-3 rounded-full border-2 border-card ring-2 ring-border/40",
                          dotColor
                        )}
                      />
                      <div className="bg-card border border-border/60 rounded-xl p-3.5 shadow-xs space-y-1.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span
                            className={cn(
                              "px-2 py-0.5 text-[10px] font-bold rounded-md border uppercase tracking-wider",
                              badgeClass
                            )}
                          >
                            {log.action?.replace("_", " ") || "Activity"}
                          </span>
                          <span
                            className="text-[11px] text-muted-foreground font-medium"
                            title={fullDateTitle || undefined}
                          >
                            {formattedDate}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-foreground font-medium">
                          {log.description}
                        </p>
                        {log.performed_by && (
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1 pt-0.5">
                            <span>By:</span>
                            <strong className="text-foreground font-semibold">
                              {log.performed_by.name || log.performed_by.email || "System"}
                            </strong>
                            {log.performed_by.role && (
                              <span className="text-[10px] px-1.5 py-0.2 bg-muted rounded font-semibold text-foreground/80">
                                {log.performed_by.role}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end px-5 sm:px-6 py-3 border-t border-border/50 bg-muted/20 shrink-0">
            <button
              type="button"
              onClick={() => setLogsModal({ isOpen: false, invoiceId: null, invoiceNumber: "", clientName: "", loading: false, logs: [] })}
              className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-muted hover:bg-muted/80 text-foreground transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Bank Account Modal */}
      <ConfirmModal
        isOpen={deleteAccountConfirm.isOpen}
        onClose={() => setDeleteAccountConfirm({ isOpen: false, id: null, name: "" })}
        onConfirm={confirmDeleteAccount}
        title="Delete Account"
        description={`Are you sure you want to delete the account "${deleteAccountConfirm.name}"?`}
        itemName={deleteAccountConfirm.name}
      />

      {/* Manage Services Modal */}
      <ServicesManagerModal open={showServicesModal} onClose={() => setShowServicesModal(false)} />

      {/* Manage Other Accounts Modal */}
      {showAccountsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border/80 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-6">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border/60 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-foreground">
                    Manage Other Accounts
                  </h3>
                  <p className="text-xs text-muted-foreground font-medium">
                    Add multiple accounts with nickname for quick selection during invoice creation.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAccountsModal(false);
                  handleCancelEdit();
                }}
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Section: Add / Edit Other Account */}
            <form onSubmit={handleSaveAccount} className="space-y-4 bg-muted/20 p-5 rounded-2xl border border-border/60">
              <div className="flex items-center justify-between font-bold text-sm text-foreground">
                <div className="flex items-center gap-2">
                  {editingAccountId ? (
                    <>
                      <Pencil className="w-4 h-4 text-primary" />
                      Edit Other Account
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 text-primary" />
                      Add New Other Account
                    </>
                  )}
                </div>
                {editingAccountId && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="text-xs text-muted-foreground hover:text-foreground font-semibold px-2 py-1 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>

              {/* Form Fields matching User Screenshot + Nick Name first */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Nick Name (First Field as explicitly requested) */}
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-foreground mb-1.5 block">
                    Nick Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="e.g. Personal HDFC, Secondary Axis, Operations Account"
                    className="w-full h-11 px-3.5 bg-background border border-border/70 rounded-xl text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {/* 2. Bank Name */}
                <div>
                  <label className="text-xs font-bold text-foreground mb-1.5 block">
                    Bank Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g. HDFC Bank"
                    className="w-full h-11 px-3.5 bg-background border border-border/70 rounded-xl text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {/* 3. Account Number */}
                <div>
                  <label className="text-xs font-bold text-foreground mb-1.5 block">
                    Account Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="Enter Account Number"
                    className="w-full h-11 px-3.5 bg-background border border-border/70 rounded-xl text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {/* 4. IFSC Code */}
                <div>
                  <label className="text-xs font-bold text-foreground mb-1.5 block">
                    IFSC Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={ifscCode}
                    onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                    placeholder="Enter IFSC Code"
                    className="w-full h-11 px-3.5 bg-background border border-border/70 rounded-xl text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 uppercase"
                  />
                </div>

                {/* 5. UPI ID (Optional) + Live Automatic QR Code Preview */}
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-foreground block">
                      UPI ID (Optional)
                    </label>
                    {upiQrDataUrl && (
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Automatic QR Code Generated
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="e.g. user@upi or 9825136884@okaxis"
                    className="w-full h-11 px-3.5 bg-background border border-border/70 rounded-xl text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />

                  {/* Automatic QR Code Live Preview Card */}
                  {upiQrDataUrl && (
                    <div className="mt-3.5 p-3.5 bg-background border border-primary/25 rounded-2xl flex flex-col sm:flex-row items-center gap-4 shadow-xs animate-in fade-in duration-300">
                      <div className="bg-white p-2 rounded-xl border border-border shadow-xs shrink-0">
                        <img
                          src={upiQrDataUrl}
                          alt="Automatic UPI QR Code"
                          className="w-24 h-24 object-contain rounded-lg"
                        />
                      </div>
                      <div className="space-y-1 text-center sm:text-left min-w-0">
                        <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs font-bold text-foreground">
                          <QrCode className="w-4 h-4 text-primary" />
                          Automatic Payment QR Code Ready
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          UPI ID: <strong className="text-foreground">{upiId}</strong>
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Clients can scan this QR code using GPay, PhonePe, Paytm, or BHIM to pay instantly.
                        </p>
                        <div className="pt-1">
                          <a
                            href={upiQrDataUrl}
                            download={`upi_qr_${nickname || "account"}.png`}
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold rounded-lg transition-colors cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Download QR Code
                          </a>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                {editingAccountId && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="px-4 py-2.5 bg-card border border-border/70 text-foreground font-bold text-xs sm:text-sm rounded-xl hover:bg-muted/60 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  disabled={submittingAccount}
                  className="px-5 py-2.5 bg-primary text-primary-foreground font-bold text-xs sm:text-sm rounded-xl hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {submittingAccount ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : editingAccountId ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  {editingAccountId ? "Update Account" : "Save Other Account"}
                </button>
              </div>
            </form>

            {/* List of Saved Other Accounts */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                  Saved Other Accounts ({bankAccounts.length})
                </h4>
                {loadingAccounts && (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                )}
              </div>

              {bankAccounts.length === 0 && !loadingAccounts && (
                <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-2xl border border-dashed border-border/60">
                  <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-bold">No other accounts added yet</p>
                  <p className="text-xs mt-0.5">Use the form above to add your first account.</p>
                </div>
              )}

              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {bankAccounts.map((acc) => {
                  const id = String(acc.id || acc._id);
                  const isCurrentEditing = editingAccountId === id;
                  return (
                    <div
                      key={id}
                      className={cn(
                        "flex items-center justify-between p-3.5 bg-background border rounded-2xl transition-colors group shadow-xs",
                        isCurrentEditing
                          ? "border-primary ring-1 ring-primary/30 bg-primary/5"
                          : "border-border/70 hover:border-border"
                      )}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-foreground truncate">
                              {acc.nickname || acc.bank_name}
                            </span>
                            <span className="text-[11px] font-semibold px-2 py-0.5 bg-muted rounded-md text-muted-foreground">
                              {acc.bank_name}
                            </span>
                            {isCurrentEditing && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 bg-primary text-primary-foreground rounded-sm">
                                Editing
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3 flex-wrap">
                            <span>A/C: <strong className="text-foreground">{acc.account_number}</strong></span>
                            <span>IFSC: <strong className="text-foreground">{acc.ifsc_code}</strong></span>
                            {acc.upi_id && (
                              <div className="flex items-center gap-1.5">
                                <span>UPI: <strong className="text-foreground">{acc.upi_id}</strong></span>
                                <button
                                  type="button"
                                  onClick={() => handleOpenQrModal(acc)}
                                  className="px-2 py-0.5 bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-bold rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                                  title="View and download QR code"
                                >
                                  <QrCode className="w-3 h-3" />
                                  QR Code
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(acc)}
                          className={cn(
                            "p-2 rounded-xl transition-colors cursor-pointer",
                            isCurrentEditing
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                          )}
                          title="Edit account"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteAccountConfirm({
                              isOpen: true,
                              id: id,
                              name: acc.nickname || acc.bank_name,
                            })
                          }
                          className="p-2 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 rounded-xl transition-colors shrink-0 cursor-pointer"
                          title="Delete account"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end pt-3 border-t border-border/60">
              <button
                type="button"
                onClick={() => {
                  setShowAccountsModal(false);
                  handleCancelEdit();
                }}
                className="px-5 py-2 bg-muted hover:bg-muted/80 text-foreground font-bold text-xs sm:text-sm rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View QR Code Popup Modal */}
      {viewingQrAccount && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border/80 rounded-3xl w-full max-w-sm shadow-2xl p-6 text-center space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2 text-left">
                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-foreground">
                    {viewingQrAccount.nickname || viewingQrAccount.bank_name}
                  </h4>
                  <p className="text-[11px] text-muted-foreground">UPI Payment QR Code</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingQrAccount(null)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-border/80 inline-block shadow-sm">
              {viewingQrDataUrl ? (
                <img
                  src={viewingQrDataUrl}
                  alt="UPI QR Code"
                  className="w-48 h-48 mx-auto object-contain"
                />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>

            <div className="space-y-1 text-xs">
              <div className="font-bold text-foreground">
                {viewingQrAccount.bank_name}
              </div>
              <div className="text-muted-foreground">
                A/C: <span className="font-semibold text-foreground">{viewingQrAccount.account_number}</span> &nbsp;|&nbsp; IFSC: <span className="font-semibold text-foreground">{viewingQrAccount.ifsc_code}</span>
              </div>
              <div className="text-xs font-mono font-bold text-primary pt-1">
                {viewingQrAccount.upi_id}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <a
                href={viewingQrDataUrl}
                download={`upi_qr_${viewingQrAccount.nickname || "account"}.png`}
                className="flex-1 py-2.5 bg-primary text-primary-foreground font-bold text-xs rounded-xl hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Download QR Code
              </a>
              <button
                type="button"
                onClick={() => setViewingQrAccount(null)}
                className="px-4 py-2.5 bg-muted hover:bg-muted/80 text-foreground font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
