import { useState, useEffect, useMemo, useRef } from "react";
import {
  FileText,
  Download,
  Copy,
  Trash2,
  ReceiptText,
  ArrowUpRight,
  Plus,
  X,
  Loader2,
  Pencil,
  FileCheck,
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { DatePicker } from "@/components/ui/date-picker";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableHeader } from "@/components/ui/sortable-header";
import { SearchableSelect } from "@/components/ui/select";
import { DateRangeFilter } from "@/components/common/DateRangeFilter";
import { SearchInput } from "@/components/common/SearchInput";
import { api } from "@/lib/api";
import { API_URL } from "@/lib/config";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { useDepartments } from "@/components/employees/DepartmentContext";

interface LineItem {
  id: string;
  description: string;
  sac?: string;
  quantity: number;
  rate: number;
  discount: number;
  discountType?: "percent" | "amount";
}

const INDIAN_STATES = [
  "24 - Gujarat",
  "27 - Maharashtra",
  "07 - Delhi",
  "29 - Karnataka",
  "33 - Tamil Nadu",
  "06 - Haryana",
  "09 - Uttar Pradesh",
  "19 - West Bengal",
  "36 - Telangana",
  "32 - Kerala",
  "08 - Rajasthan",
  "23 - Madhya Pradesh",
  "03 - Punjab",
  "10 - Bihar",
  "21 - Odisha",
  "37 - Andhra Pradesh",
  "30 - Goa",
  "02 - Himachal Pradesh",
  "05 - Uttarakhand",
  "01 - Jammu and Kashmir",
  "04 - Chandigarh",
  "26 - Dadra and Nagar Haveli and Daman and Diu",
  "31 - Lakshadweep",
  "34 - Puducherry",
  "35 - Andaman and Nicobar Islands",
  "38 - Ladakh",
];

// Statuses a quotation can be saved with (form options + "converted" set on conversion)
const QUOTATION_STATUSES = ["sent", "draft", "accepted", "expired", "cancelled", "converted"];

const PAYMENT_MODES = ["Current Account", "Cash with GST", "Cash", "Other Account"];

const emptyLineItem = (): LineItem => ({
  id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  description: "",
  sac: "",
  quantity: 1,
  rate: 0,
  discount: 0,
  discountType: "amount",
});

// Discount in ₹ for a line item (₹ discount applies per qty, same as invoice)
const getItemDiscountAmount = (item: LineItem) => {
  const qty = Number(item.quantity) || 0;
  const rate = Number(item.rate) || 0;
  const disc = Number(item.discount) || 0;
  if (item.discountType === "percent") return (qty * rate * disc) / 100;
  return qty * disc;
};

const formatNumber = (num: number) =>
  num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export interface Quotation {
  id: string;
  quotationNumber: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientCompany?: string;
  clientAddress?: string;
  subject?: string;
  amount: string;
  rawAmount: number;
  date: string;
  validUntil: string;
  status: string;
  convertedInvoiceId?: string;
  convertedInvoiceNumber?: string;
  raw: any;
}

export function AllQuotations({
  setActive,
  activeTabPath,
}: {
  setActive?: (path: string) => void;
  activeTabPath?: string;
}) {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [quotationStatusFilter, setQuotationStatusFilter] = useState<string>("All");
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });

  // View mode: 'list' or 'create' or 'edit'
  const isInitialCreate = Boolean(activeTabPath && activeTabPath.includes("create=1"));
  const [viewMode, setViewMode] = useState<"list" | "create" | "edit">(
    isInitialCreate ? "create" : "list"
  );
  const [editingQuotationId, setEditingQuotationId] = useState<string | null>(null);

  // Delete / Cancel Confirm Modal State
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    id: string | null;
    name: string;
    status: string;
  }>({
    isOpen: false,
    id: null,
    name: "",
    status: "",
  });
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Form State for Create / Edit Quotation (all fields are entered manually, only number is auto)
  const [formClientName, setFormClientName] = useState("");
  const [formClientPhone, setFormClientPhone] = useState("");
  const [formClientGstin, setFormClientGstin] = useState("");
  const [formClientAddress, setFormClientAddress] = useState("");
  const [formStateUt, setFormStateUt] = useState("");
  // Departments come from the employee module (/departments)
  const { departments } = useDepartments();
  const [formDepartments, setFormDepartments] = useState<string[]>([]);
  const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState(false);
  const deptDropdownRef = useRef<HTMLDivElement>(null);
  const [formModeOfPayment, setFormModeOfPayment] = useState("");
  const [formQuotationNumber, setFormQuotationNumber] = useState("");
  const [formQuotationDate, setFormQuotationDate] = useState(() =>
    new Date().toISOString().split("T")[0]
  );
  const [formValidUntil, setFormValidUntil] = useState("");
  const [formStatus, setFormStatus] = useState("sent");
  const [formItems, setFormItems] = useState<LineItem[]>([emptyLineItem()]);
  const [formBankName, setFormBankName] = useState("");
  const [formAccountNumber, setFormAccountNumber] = useState("");
  const [formIfscCode, setFormIfscCode] = useState("");
  const [formUpiId, setFormUpiId] = useState("");
  const [formTaxOption, setFormTaxOption] = useState<string>("CGST + SGST");
  const [formAdditionalDiscount, setFormAdditionalDiscount] = useState<number>(0);
  const [isEditingDiscount, setIsEditingDiscount] = useState(false);
  const [formNotes, setFormNotes] = useState<string>("");
  const [removeItemId, setRemoveItemId] = useState<string | null>(null);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (deptDropdownRef.current && !deptDropdownRef.current.contains(event.target as Node)) {
        setIsDeptDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch Quotations from API
  const fetchQuotations = async () => {
    try {
      setLoading(true);
      const res = await api.get<any>("/quotations?limit=200", {
        showLoader: false,
        showErrorToast: false,
      });

      const rawItems = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.items)
        ? res.items
        : Array.isArray(res)
        ? res
        : [];

      const mapped: Quotation[] = rawItems.map((item: any) => {
        const rawAmt = Number(item.total_amount || 0);
        return {
          id: String(item.id || item._id),
          quotationNumber: item.quotation_number || `QUO-${item._id?.slice(-4)}`,
          clientName: item.client_name || "Unknown Client",
          clientEmail: item.client_email,
          clientPhone: item.client_phone,
          clientCompany: item.client_company,
          clientAddress: item.client_address,
          subject: item.subject,
          amount: `₹ ${rawAmt.toLocaleString("en-IN")}`,
          rawAmount: rawAmt,
          date: item.quotation_date || (item.created_at ? String(item.created_at).split("T")[0] : ""),
          validUntil: item.valid_until || "",
          status: String(item.status || "sent").toLowerCase(),
          convertedInvoiceId: item.converted_invoice_id,
          convertedInvoiceNumber: item.converted_invoice_number,
          raw: item,
        };
      });

      setQuotations(mapped);
    } catch (err) {
      console.warn("Could not load quotations from API", err);
      setQuotations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotations();
  }, []);

  // Reset form to blank; quotation number, bank details and terms are fetched automatically
  const openCreateForm = async () => {
    setEditingQuotationId(null);
    setFormClientName("");
    setFormClientPhone("");
    setFormClientGstin("");
    setFormClientAddress("");
    setFormStateUt("");
    setFormDepartments([]);
    setFormModeOfPayment("");
    setFormQuotationDate(new Date().toISOString().split("T")[0]);
    setFormValidUntil("");
    setFormStatus("sent");
    setFormItems([emptyLineItem()]);
    setFormBankName("");
    setFormAccountNumber("");
    setFormIfscCode("");
    setFormUpiId("");
    setFormTaxOption("CGST + SGST");
    setFormAdditionalDiscount(0);
    setFormNotes("");

    // Prefill bank details & quotation terms from /settings (same as invoice)
    try {
      const settings = await api.get<any>("/settings", {
        showLoader: false,
        showErrorToast: false,
      });
      if (settings) {
        setFormBankName(settings.bank_name || "");
        setFormAccountNumber(settings.account_number || "");
        setFormIfscCode(settings.ifsc_code || "");
        setFormNotes(settings.quotation_terms || "");
      }
    } catch (err) {
      console.warn("Failed to load settings bank details", err);
    }

    try {
      const res = await api.get<any>("/quotations/next-number", {
        showLoader: false,
        showErrorToast: false,
      });
      if (res?.next_quotation_number) {
        setFormQuotationNumber(res.next_quotation_number);
      } else {
        setFormQuotationNumber(`QUO-${String(quotations.length + 1).padStart(3, "0")}`);
      }
    } catch {
      setFormQuotationNumber(`QUO-${String(quotations.length + 1).padStart(3, "0")}`);
    }

    setViewMode("create");
  };

  // Navigation & View Mode Helpers
  const handleBackToList = () => {
    setViewMode("list");
    setEditingQuotationId(null);
    if (setActive) setActive("/invoice/proforma");
  };

  const handleOpenCreate = () => {
    if (setActive) setActive("/invoice/proforma?create=1");
    openCreateForm();
  };

  // Sync with activeTabPath (e.g. from sidebar clicks)
  useEffect(() => {
    if (activeTabPath && activeTabPath.includes("create=1")) {
      openCreateForm();
    } else if (activeTabPath && !activeTabPath.includes("create=1") && viewMode === "create") {
      setViewMode("list");
      setEditingQuotationId(null);
    }
  }, [activeTabPath]);

  // Open Edit Form preloaded with quotation data
  const openEditForm = (q: Quotation) => {
    const raw = q.raw || {};
    setEditingQuotationId(q.id);
    setFormQuotationNumber(q.quotationNumber);
    setFormClientName(raw.client_name || q.clientName);
    setFormClientPhone(raw.client_phone || q.clientPhone || "");
    setFormClientGstin(raw.client_gstin || "");
    setFormClientAddress(raw.client_address || q.clientAddress || "");
    setFormStateUt(raw.state_ut || "");
    setFormDepartments(
      Array.isArray(raw.departments) && raw.departments.length > 0
        ? raw.departments
        : raw.client_department
        ? String(raw.client_department).split(",").map((d: string) => d.trim()).filter(Boolean)
        : []
    );
    setFormModeOfPayment(raw.mode_of_payment || "");
    setFormQuotationDate(raw.quotation_date || q.date || new Date().toISOString().split("T")[0]);
    setFormValidUntil(raw.valid_until || q.validUntil || "");
    setFormStatus(raw.status || q.status || "sent");
    setFormBankName(raw.bank_name || "");
    setFormAccountNumber(raw.account_number || "");
    setFormIfscCode(raw.ifsc_code || "");
    setFormUpiId(raw.upi_id || "");
    setFormTaxOption(raw.tax_option || "CGST + SGST");
    setFormAdditionalDiscount(Number(raw.additional_discount) || 0);
    setFormNotes(raw.notes || "");

    if (Array.isArray(raw.line_items) && raw.line_items.length > 0) {
      setFormItems(
        raw.line_items.map((it: any, idx: number) => {
          const qty = Number(it.quantity) || 0;
          const totalDisc = Number(it.discount) || 0;
          return {
            id: `item_${idx + 1}_${Date.now()}`,
            description: it.description || "",
            sac: it.sac || "",
            quantity: qty,
            rate: Number(it.rate) || 0,
            // Stored discount is the line total; the form edits it per qty
            discount: qty > 0 ? totalDisc / qty : totalDisc,
            discountType: "amount" as const,
          };
        })
      );
    } else {
      setFormItems([emptyLineItem()]);
    }

    setViewMode("edit");
  };

  // Copy: open the create form prefilled with this quotation's details under a new quotation number
  const openCopyForm = async (q: Quotation) => {
    openEditForm(q);
    setEditingQuotationId(null);
    setFormStatus("sent");
    setFormQuotationDate(new Date().toISOString().split("T")[0]);
    setFormValidUntil("");
    try {
      const res = await api.get<any>("/quotations/next-number", { showLoader: false, showErrorToast: false });
      setFormQuotationNumber(res?.next_quotation_number || `QUO-${String(quotations.length + 1).padStart(3, "0")}`);
    } catch {
      setFormQuotationNumber(`QUO-${String(quotations.length + 1).padStart(3, "0")}`);
    }
    setViewMode("create");
  };

  const updateItem = (id: string, field: keyof LineItem, value: any) => {
    setFormItems((prev) => prev.map((it) => (it.id === id ? { ...it, [field]: value } : it)));
  };

  // Form Calculations (same as invoice)
  const totalQty = useMemo(
    () => formItems.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0),
    [formItems]
  );

  const totalGrossRate = useMemo(
    () => formItems.reduce((acc, it) => acc + (Number(it.quantity) || 0) * (Number(it.rate) || 0), 0),
    [formItems]
  );

  const totalLineDiscount = useMemo(
    () => formItems.reduce((acc, it) => acc + getItemDiscountAmount(it), 0),
    [formItems]
  );

  const totalBeforeTax = Math.max(0, totalGrossRate - totalLineDiscount);
  const taxableAmount = Math.max(0, totalBeforeTax - (Number(formAdditionalDiscount) || 0));
  const cgstRate = formTaxOption === "CGST + SGST" ? 9 : 0;
  const sgstRate = formTaxOption === "CGST + SGST" ? 9 : 0;
  const igstRate = formTaxOption === "IGST" ? 18 : 0;
  const totalTaxAmount = Number(
    (
      Number((taxableAmount * (cgstRate / 100)).toFixed(2)) +
      Number((taxableAmount * (sgstRate / 100)).toFixed(2)) +
      Number((taxableAmount * (igstRate / 100)).toFixed(2))
    ).toFixed(2)
  );
  const rawTotal = taxableAmount + totalTaxAmount;
  const roundedTotal = Math.round(rawTotal);
  const roundOff = Number((roundedTotal - rawTotal).toFixed(2));

  // Handle Form Save (Create or Update)
  const handleSaveQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formClientName.trim()) {
      toast.error("Please enter Client Name");
      return;
    }
    if (formItems.length === 0 || !formItems.some((it) => it.description.trim())) {
      toast.error("Please enter at least one line item description");
      return;
    }

    try {
      setIsSubmittingForm(true);
      const payload: any = {
        quotation_number: formQuotationNumber.trim() || undefined,
        client_name: formClientName.trim(),
        client_phone: formClientPhone.trim() || undefined,
        client_gstin: formClientGstin.trim().toUpperCase() || undefined,
        client_address: formClientAddress.trim() || undefined,
        state_ut: formStateUt || undefined,
        departments: formDepartments,
        client_department: formDepartments.join(", ") || undefined,
        mode_of_payment: formModeOfPayment || undefined,
        bank_name: formBankName.trim() || undefined,
        account_number: formAccountNumber.trim() || undefined,
        ifsc_code: formIfscCode.trim() || undefined,
        upi_id: formUpiId.trim() || undefined,
        quotation_date: formQuotationDate || undefined,
        valid_until: formValidUntil || undefined,
        status: formStatus,
        tax_option: formTaxOption,
        cgst_rate: cgstRate,
        sgst_rate: sgstRate,
        igst_rate: igstRate,
        additional_discount: Number(formAdditionalDiscount) || 0,
        notes: formNotes || undefined,
        line_items: formItems
          .filter((it) => it.description.trim())
          .map((it) => {
            const qty = Number(it.quantity) || 0;
            const rate = Number(it.rate) || 0;
            const discAmt = getItemDiscountAmount(it);
            return {
              description: it.description.trim(),
              sac: it.sac?.trim() || undefined,
              quantity: qty,
              rate,
              discount: discAmt,
              amount: Math.max(0, qty * rate - discAmt),
            };
          }),
      };

      if (editingQuotationId) {
        await api.put(`/quotations/${editingQuotationId}`, payload);
        toast.success("Quotation updated successfully!");
      } else {
        await api.post("/quotations", payload);
        toast.success("Quotation created successfully!");
      }

      handleBackToList();
      fetchQuotations();
    } catch (err: any) {
      console.error("Failed to save quotation", err);
      toast.error(err?.message || "Failed to save quotation");
    } finally {
      setIsSubmittingForm(false);
    }
  };

  // Cancel / Delete Quotation
  const handleCancelQuotation = async (id?: string) => {
    const targetId = id || deleteConfirm.id;
    if (!targetId) return;
    try {
      setIsProcessingAction(true);
      await api.patch(`/quotations/${targetId}/status`, { status: "cancelled" });
      toast.success("Quotation marked as cancelled");
      setQuotations((prev) =>
        prev.map((q) => (q.id === targetId ? { ...q, status: "cancelled" } : q))
      );
      setDeleteConfirm({ isOpen: false, id: null, name: "", status: "" });
      fetchQuotations();
    } catch (err: any) {
      toast.error(err?.message || "Failed to cancel quotation");
    } finally {
      setIsProcessingAction(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      setIsProcessingAction(true);
      await api.delete(`/quotations/${deleteConfirm.id}`);
      toast.success("Quotation deleted successfully");
      setQuotations((prev) => prev.filter((q) => q.id !== deleteConfirm.id));
      setDeleteConfirm({ isOpen: false, id: null, name: "", status: "" });
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete quotation");
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Date Filtering Helper
  const isQuotationInDateRange = (q: Quotation, range?: { from?: Date | undefined; to?: Date | undefined } | null) => {
    if (!range || !range.from) return true;
    if (!q.date) return false;

    const dateStr = q.date.includes("T") ? (q.date.split("T")[0] || "") : q.date;
    const parts = dateStr.split("-");
    let qTime: number;
    if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      qTime = new Date(year, month, day).setHours(0, 0, 0, 0);
    } else {
      const d = new Date(q.date);
      if (isNaN(d.getTime())) return false;
      qTime = new Date(d.getFullYear(), d.getMonth(), d.getDate()).setHours(0, 0, 0, 0);
    }

    const fromTime = new Date(range.from.getFullYear(), range.from.getMonth(), range.from.getDate()).setHours(0, 0, 0, 0);
    if (qTime < fromTime) return false;

    if (range.to) {
      const toTime = new Date(range.to.getFullYear(), range.to.getMonth(), range.to.getDate()).setHours(23, 59, 59, 999);
      if (qTime > toTime) return false;
    }

    return true;
  };

  // Effective status: open quotations past "Valid Until" are Overdue, the rest are Upcoming
  const todayStr = new Date().toLocaleDateString("en-CA"); // local YYYY-MM-DD
  const OPEN_STATUSES = ["sent", "draft", "upcoming", "expired", "overdue"];
  const getEffectiveStatus = (q: Quotation) => {
    const st = q.status.toLowerCase();
    if (st === "declined") return "cancelled";
    if (!OPEN_STATUSES.includes(st)) return st; // accepted, converted, cancelled
    const validUntil = (q.validUntil || "").split("T")[0];
    if (st === "expired" || st === "overdue" || (validUntil && validUntil < todayStr)) return "overdue";
    return st === "draft" ? "draft" : "upcoming";
  };
  const STATUS_GROUPS: Record<string, string[]> = {
    upcoming: ["upcoming", "draft"],
    accepted: ["accepted", "converted"],
    overdue: ["overdue"],
    cancelled: ["cancelled"],
  };
  const inGroup = (q: Quotation, group: string) => (STATUS_GROUPS[group] || []).includes(getEffectiveStatus(q));

  // Date Filtered Quotations
  const dateFilteredQuotations = quotations.filter((q) => isQuotationInDateRange(q, dateRange));

  // Filtered Quotations based on Search and Selected Box/Status
  const filteredQuotations = dateFilteredQuotations.filter((q) => {
    const matchesSearch =
      q.quotationNumber.toLowerCase().includes(search.toLowerCase()) ||
      q.clientName.toLowerCase().includes(search.toLowerCase()) ||
      (q.clientCompany || "").toLowerCase().includes(search.toLowerCase()) ||
      (q.subject || "").toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      (statusFilter === "All" || inGroup(q, statusFilter)) &&
      (quotationStatusFilter === "All" || q.status.toLowerCase() === quotationStatusFilter);

    return matchesSearch && matchesStatus;
  });

  const { items: sortedQuotations, requestSort, sortConfig } = useSortableData(filteredQuotations);

  // KPI Calculations
  const totalAmount = dateFilteredQuotations.reduce((acc, q) => acc + q.rawAmount, 0);

  const upcomingQuotations = dateFilteredQuotations.filter((q) => inGroup(q, "upcoming"));
  const upcomingAmount = upcomingQuotations.reduce((acc, q) => acc + q.rawAmount, 0);
  const upcomingCount = upcomingQuotations.length;

  const acceptedQuotations = dateFilteredQuotations.filter((q) => inGroup(q, "accepted"));
  const acceptedAmount = acceptedQuotations.reduce((acc, q) => acc + q.rawAmount, 0);
  const acceptedCount = acceptedQuotations.length;

  const overdueQuotations = dateFilteredQuotations.filter((q) => inGroup(q, "overdue"));
  const overdueAmount = overdueQuotations.reduce((acc, q) => acc + q.rawAmount, 0);
  const overdueCount = overdueQuotations.length;

  const cancelledQuotations = dateFilteredQuotations.filter((q) => inGroup(q, "cancelled"));
  const cancelledAmount = cancelledQuotations.reduce((acc, q) => acc + q.rawAmount, 0);
  const cancelledCount = cancelledQuotations.length;

  // Active KPI Box Indicators (mutually exclusive)
  const isAllActive = statusFilter === "All";
  const isUpcomingBoxSelected = statusFilter === "upcoming";
  const isAcceptedBoxSelected = statusFilter === "accepted";
  const isOverdueBoxSelected = statusFilter === "overdue";
  const isCancelledBoxSelected = statusFilter === "cancelled";

  // Quick filter on clicking any KPI Box
  const handleKpiBoxClick = (boxType: "all" | "upcoming" | "accepted" | "overdue" | "cancelled") => {
    if (boxType === "all") {
      setStatusFilter("All");
    } else {
      setStatusFilter((prev) => (prev === boxType ? "All" : boxType));
    }
  };

  // Helper for Status Badges
  const renderStatusBadge = (status: string) => {
    const st = status.toLowerCase();
    if (st === "converted") {
      return (
        <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20 inline-flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-purple-500" />
          Converted
        </span>
      );
    }
    if (st === "accepted") {
      return (
        <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
          Accepted
        </span>
      );
    }
    if (st === "cancelled" || st === "declined") {
      return (
        <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 inline-flex items-center gap-1">
          <AlertTriangle className="w-3 h-3 text-rose-500" />
          Cancelled
        </span>
      );
    }
    if (st === "expired") {
      return (
        <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 inline-flex items-center gap-1">
          <AlertTriangle className="w-3 h-3 text-amber-500" />
          Expired
        </span>
      );
    }
    if (st === "draft") {
      return (
        <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-muted text-muted-foreground border border-border/40 inline-flex items-center gap-1">
          Draft
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 inline-flex items-center gap-1">
        Sent
      </span>
    );
  };

  // RENDER: CREATE / EDIT QUOTATION FORM
  if (viewMode === "create" || viewMode === "edit") {
    const inputCls =
      "w-full h-11 px-3.5 bg-background border border-border/70 rounded-xl text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20";
    const selectCls =
      "w-full h-11 px-3.5 bg-background border border-border/70 rounded-xl text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none pr-10 cursor-pointer";
    const labelCls = "text-xs sm:text-sm font-semibold text-foreground mb-2 block";
    const bankLabelCls = "text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block";
    const chevron = (
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    );

    return (
      <div className="@container w-full space-y-6 sm:space-y-8 animate-in fade-in duration-300 min-w-0">
        {/* Header */}
        <div className="flex flex-col @2xl:flex-row justify-between items-start @2xl:items-center gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <button
              type="button"
              onClick={handleBackToList}
              className="p-2 sm:p-2.5 bg-card border border-border/60 rounded-xl hover:bg-muted/50 transition-colors shadow-sm shrink-0 cursor-pointer"
              title="Back to Quotations List"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
                <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
                {viewMode === "edit" ? `Update Quotation (${formQuotationNumber})` : "Create Quotation"}
              </h1>
              <p className="text-muted-foreground mt-1 text-xs sm:text-sm font-medium">
                {viewMode === "edit"
                  ? "Update the client details and line items below to save the quotation."
                  : "Fill in the client details and line items below to generate the quotation."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full @2xl:w-auto @2xl:shrink-0">
            <button
              type="button"
              onClick={handleBackToList}
              className="flex-1 @2xl:flex-initial px-4 py-2.5 whitespace-nowrap bg-card border border-border/60 text-foreground font-bold rounded-xl hover:bg-muted/50 transition-colors flex items-center justify-center gap-2 shadow-sm text-xs sm:text-sm cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveQuotation}
              disabled={isSubmittingForm}
              className="flex-1 @2xl:flex-initial px-4 @2xl:px-5 py-2.5 whitespace-nowrap bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm text-xs sm:text-sm disabled:opacity-50 cursor-pointer"
            >
              {isSubmittingForm ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              {isSubmittingForm
                ? "Saving..."
                : viewMode === "edit"
                ? "Update Quotation"
                : "Generate Quotation"}
            </button>
          </div>
        </div>

        <form onSubmit={handleSaveQuotation} className="space-y-6 sm:space-y-8">
          {/* Card 1: Quotation Details */}
          <div className="bg-card border border-border/60 rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-sm">
            <h2 className="text-base sm:text-lg font-bold text-foreground mb-6">Quotation Details</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
              {/* Row 1: Client Name | Client Address */}
              <div>
                <label className={labelCls}>
                  Billed To (Client) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formClientName}
                  onChange={(e) => setFormClientName(e.target.value)}
                  placeholder="Enter client / company name"
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Client Address</label>
                <input
                  type="text"
                  value={formClientAddress}
                  onChange={(e) => setFormClientAddress(e.target.value)}
                  placeholder="Enter client address"
                  className={inputCls}
                />
              </div>

              {/* Row 2: State / UT | Department / Brand */}
              <div>
                <label className={labelCls}>State / UT (Optional)</label>
                <div className="relative">
                  <select
                    value={formStateUt}
                    onChange={(e) => {
                      const st = e.target.value;
                      setFormStateUt(st);
                      // Same rule as invoices: Gujarat (24) → CGST + SGST, other states → IGST; keep "No Tax" if chosen
                      if (st && formTaxOption !== "No Tax") {
                        const lower = st.toLowerCase();
                        setFormTaxOption(lower.includes("gujarat") || lower.includes("24") ? "CGST + SGST" : "IGST");
                      }
                    }}
                    className={selectCls}
                  >
                    <option value="">Select state...</option>
                    {INDIAN_STATES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                  {chevron}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs sm:text-sm font-semibold text-foreground block">
                    Department / Brand
                  </label>
                  {formDepartments.length > 1 && (
                    <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      {formDepartments.length} Selected
                    </span>
                  )}
                </div>
                <div className="relative" ref={deptDropdownRef}>
                  <div
                    onClick={() => setIsDeptDropdownOpen((prev) => !prev)}
                    className="w-full min-h-11 px-3 py-1.5 bg-background border border-border/70 rounded-xl text-sm font-medium text-foreground flex items-center justify-between gap-2 cursor-pointer hover:border-border transition-colors shadow-2xs"
                  >
                    <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
                      {formDepartments.length === 0 ? (
                        <span className="text-muted-foreground text-sm">Select department(s)...</span>
                      ) : (
                        formDepartments.map((d) => (
                          <span
                            key={d}
                            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-md text-xs font-semibold"
                          >
                            {d}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setFormDepartments((prev) => prev.filter((item) => item !== d));
                              }}
                              className="hover:text-red-500 text-[10px] leading-none ml-0.5 cursor-pointer font-bold"
                              title="Remove"
                            >
                              ✕
                            </button>
                          </span>
                        ))
                      )}
                    </div>
                    <div className="pointer-events-none text-muted-foreground shrink-0 pr-1">
                      <svg
                        className={cn("w-4 h-4 transition-transform duration-200", isDeptDropdownOpen && "rotate-180")}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {isDeptDropdownOpen && (
                    <div className="absolute z-50 left-0 right-0 mt-1.5 bg-card border border-border rounded-xl shadow-xl p-2 space-y-1 max-h-60 overflow-y-auto animate-in fade-in duration-150">
                      <div className="flex items-center justify-between px-2 py-1 border-b border-border/50 text-[11px] font-semibold text-muted-foreground">
                        <span>Available Departments</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFormDepartments([]);
                          }}
                          className="hover:text-red-500 transition-colors cursor-pointer"
                        >
                          Clear All
                        </button>
                      </div>
                      {Array.from(new Set([...departments, ...formDepartments])).map((deptOption) => {
                        const isChecked = formDepartments.includes(deptOption);
                        return (
                          <div
                            key={deptOption}
                            onClick={(e) => {
                              e.stopPropagation();
                              setFormDepartments((prev) =>
                                isChecked ? prev.filter((item) => item !== deptOption) : [...prev, deptOption]
                              );
                            }}
                            className={cn(
                              "flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg cursor-pointer text-xs sm:text-sm font-medium transition-colors select-none",
                              isChecked ? "bg-primary/10 text-primary font-bold" : "hover:bg-muted text-foreground"
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20 pointer-events-none"
                            />
                            <span>{deptOption}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Row 3: Client Phone | Mode of Payment */}
              <div>
                <label className={labelCls}>Client Phone</label>
                <input
                  type="text"
                  value={formClientPhone}
                  onChange={(e) => setFormClientPhone(e.target.value)}
                  placeholder="e.g. 9825136884"
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Mode of Payment (Optional)</label>
                <div className="relative">
                  <select
                    value={formModeOfPayment}
                    onChange={(e) => setFormModeOfPayment(e.target.value)}
                    className={selectCls}
                  >
                    <option value="">Select mode...</option>
                    {PAYMENT_MODES.map((mode) => (
                      <option key={mode} value={mode}>
                        {mode}
                      </option>
                    ))}
                  </select>
                  {chevron}
                </div>
              </div>

              {/* Row 4: Client GSTIN | Quotation Status */}
              <div>
                <label className={labelCls}>Client GSTIN (Optional)</label>
                <input
                  type="text"
                  value={formClientGstin}
                  onChange={(e) => setFormClientGstin(e.target.value.toUpperCase())}
                  placeholder="e.g. 24AAXFN3372M1ZK"
                  maxLength={15}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Quotation Status</label>
                <div className="relative">
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    className={selectCls}
                  >
                    <option value="sent">Sent</option>
                    <option value="draft">Draft</option>
                    <option value="accepted">Accepted</option>
                    <option value="expired">Expired</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  {chevron}
                </div>
              </div>

              {/* Row 5: Quotation Number (auto) | Date of Issue */}
              <div>
                <label className={labelCls}>Quotation Number</label>
                <input
                  type="text"
                  value={formQuotationNumber}
                  onChange={(e) => setFormQuotationNumber(e.target.value)}
                  placeholder="e.g. QUO-001"
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Date of Issue</label>
                <DatePicker
                  value={formQuotationDate}
                  onChange={(val) => setFormQuotationDate(val)}
                  placeholder="DD-MM-YYYY"
                  className="w-full h-11 bg-background border-border/70 rounded-xl"
                />
              </div>

              {/* Row 6: Valid Until */}
              <div>
                <label className={labelCls}>Valid Until</label>
                <DatePicker
                  value={formValidUntil}
                  onChange={(val) => setFormValidUntil(val)}
                  placeholder="DD-MM-YYYY"
                  className="w-full h-11 bg-background border-border/70 rounded-xl"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Line Items */}
          <div className="bg-card border border-border/60 rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-sm space-y-6">
            <h2 className="text-base sm:text-lg font-bold text-foreground">Line Items</h2>

            <div className="overflow-x-auto min-w-0">
              <div className="@3xl:min-w-[760px] space-y-3">
                <div className="hidden @3xl:grid grid-cols-12 gap-3 pb-2 text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                  <div className="col-span-4 pl-1">ITEM DESCRIPTION</div>
                  <div className="col-span-1 text-center">SAC</div>
                  <div className="col-span-1 text-center">QTY</div>
                  <div className="col-span-2 text-center">RATE (₹)</div>
                  <div className="col-span-2 text-center">DISCOUNT</div>
                  <div className="col-span-2 text-right pr-6">AMOUNT</div>
                </div>

                {formItems.map((item) => {
                  const itemGross = (Number(item.quantity) || 0) * (Number(item.rate) || 0);
                  const itemAmt = Math.max(0, itemGross - getItemDiscountAmount(item));

                  return (
                    <div key={item.id} className="grid grid-cols-2 @3xl:grid-cols-12 gap-3 items-end @3xl:items-center group py-3 px-3 @3xl:py-1 @3xl:px-0 @max-3xl:rounded-xl @max-3xl:border @max-3xl:border-border/60 @max-3xl:bg-muted/20">
                      <div className="col-span-2 @3xl:col-span-4 min-w-0">
                        <span className="@3xl:hidden block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Item Description</span>
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateItem(item.id, "description", e.target.value)}
                          placeholder="Enter product/service name"
                          className={inputCls}
                        />
                      </div>

                      <div className="col-span-1 min-w-0">
                        <span className="@3xl:hidden block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">SAC</span>
                        <input
                          type="text"
                          value={item.sac || ""}
                          onChange={(e) => updateItem(item.id, "sac", e.target.value)}
                          placeholder="SAC"
                          className="w-full h-11 px-2 text-center bg-background border border-border/70 rounded-xl text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>

                      <div className="col-span-1 min-w-0">
                        <span className="@3xl:hidden block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Qty</span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.quantity === 0 ? "" : item.quantity}
                          onChange={(e) =>
                            updateItem(item.id, "quantity", e.target.value === "" ? 0 : parseFloat(e.target.value) || 0)
                          }
                          className="w-full h-11 px-2 text-center bg-background border border-border/70 rounded-xl text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>

                      <div className="col-span-1 @3xl:col-span-2 min-w-0">
                        <span className="@3xl:hidden block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Rate (₹)</span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.rate === 0 ? "" : item.rate}
                          onChange={(e) =>
                            updateItem(item.id, "rate", e.target.value === "" ? 0 : parseFloat(e.target.value) || 0)
                          }
                          placeholder="0.00"
                          className="w-full h-11 px-3 text-center bg-background border border-border/70 rounded-xl text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>

                      <div className="col-span-1 @3xl:col-span-2 min-w-0">
                        <span className="@3xl:hidden block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Discount</span>
                        <div className="relative flex items-center">
                          <input
                            type="number"
                            min="0"
                            max={item.discountType === "percent" ? 100 : undefined}
                            step="any"
                            value={item.discount === 0 ? "" : item.discount}
                            onChange={(e) =>
                              updateItem(item.id, "discount", e.target.value === "" ? 0 : parseFloat(e.target.value) || 0)
                            }
                            placeholder="0"
                            className="w-full h-11 pr-14 pl-2 text-center bg-background border border-border/70 rounded-xl text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                          />
                          <div className="absolute right-1 flex items-center bg-muted/80 p-0.5 rounded-lg border border-border/60 text-[10px] font-bold select-none">
                            <button
                              type="button"
                              onClick={() => updateItem(item.id, "discountType", "percent")}
                              className={cn(
                                "px-1.5 py-0.5 rounded transition-all cursor-pointer",
                                item.discountType === "percent"
                                  ? "bg-primary text-primary-foreground font-black shadow-xs"
                                  : "text-muted-foreground hover:text-foreground"
                              )}
                              title="Percentage discount (%)"
                            >
                              %
                            </button>
                            <button
                              type="button"
                              onClick={() => updateItem(item.id, "discountType", "amount")}
                              className={cn(
                                "px-1.5 py-0.5 rounded transition-all cursor-pointer",
                                !item.discountType || item.discountType === "amount"
                                  ? "bg-primary text-primary-foreground font-black shadow-xs"
                                  : "text-muted-foreground hover:text-foreground"
                              )}
                              title="Price discount (₹ per qty)"
                            >
                              ₹
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="col-span-2 flex items-center justify-between @3xl:justify-end gap-2.5 @max-3xl:pt-2 @max-3xl:border-t @max-3xl:border-border/50">
                        <span className="@3xl:hidden text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Amount</span>
                        <span className="text-sm sm:text-base font-bold text-foreground tabular-nums">
                          ₹ {formatNumber(itemAmt)}
                        </span>
                        <button
                          type="button"
                          onClick={() => formItems.length > 1 && setRemoveItemId(item.id)}
                          disabled={formItems.length <= 1}
                          className="p-1.5 text-muted-foreground/60 hover:text-rose-500 rounded-lg hover:bg-rose-500/10 transition-colors disabled:opacity-20 disabled:hover:text-muted-foreground/60 disabled:hover:bg-transparent cursor-pointer"
                          title="Delete item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                <div className="pt-4 border-t border-border/60">
                  <div className="hidden @3xl:grid grid-cols-12 gap-3 items-center text-sm font-bold text-foreground">
                    <div className="col-span-4 pl-1 text-base">Total</div>
                    <div className="col-span-1"></div>
                    <div className="col-span-1 text-center tabular-nums">{totalQty}</div>
                    <div className="col-span-2 text-center tabular-nums">₹ {formatNumber(totalGrossRate)}</div>
                    <div className="col-span-2 text-center tabular-nums">₹ {formatNumber(totalLineDiscount)}</div>
                    <div className="col-span-2 text-right pr-6 tabular-nums text-base">
                      ₹ {formatNumber(totalBeforeTax)}
                    </div>
                  </div>
                  <div className="@3xl:hidden flex items-center justify-between text-base font-bold text-foreground">
                    <span>Total ({totalQty} qty)</span>
                    <span className="tabular-nums">₹ {formatNumber(totalBeforeTax)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={() => setFormItems((prev) => [...prev, emptyLineItem()])}
                className="px-4 py-2 bg-muted/60 hover:bg-muted text-foreground text-xs sm:text-sm font-bold rounded-xl transition-colors inline-flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add Line Item
              </button>
            </div>
          </div>

          {/* Card 3: Bank Details (Optional, manual entry) */}
          <div className="bg-card border border-border/60 rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-sm space-y-4">
            <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-foreground">
              Bank Details (Optional)
            </h4>
            <div
              className={cn(
                "grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6",
                formUpiId.trim() ? "md:grid-cols-4" : "md:grid-cols-3"
              )}
            >
              <div>
                <label className={bankLabelCls}>Bank Name</label>
                <input
                  type="text"
                  placeholder="e.g. HDFC Bank"
                  value={formBankName}
                  onChange={(e) => setFormBankName(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={bankLabelCls}>Account Number</label>
                <input
                  type="text"
                  placeholder="e.g. 50100234567890"
                  value={formAccountNumber}
                  onChange={(e) => setFormAccountNumber(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={bankLabelCls}>IFSC Code</label>
                <input
                  type="text"
                  placeholder="e.g. HDFC0001234"
                  value={formIfscCode}
                  onChange={(e) => setFormIfscCode(e.target.value)}
                  className={inputCls}
                />
              </div>
              {/* Same as invoice: show UPI only when the quotation has one */}
              {formUpiId.trim() && (
                <div>
                  <label className={bankLabelCls}>UPI ID (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. user@upi"
                    value={formUpiId}
                    onChange={(e) => setFormUpiId(e.target.value)}
                    className={inputCls}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Bottom: Notes / Terms & Summary */}
          <div className="grid grid-cols-1 @4xl:grid-cols-12 gap-6 sm:gap-8 items-start">
            <div className="@4xl:col-span-6 bg-card border border-border/60 rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-sm space-y-3">
              <label className="text-xs sm:text-sm font-semibold text-foreground block">Notes / Terms</label>
              <textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Enter quotation terms or notes here..."
                className="w-full px-4 py-3 bg-background border border-border/70 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-medium resize-none h-56"
              />
            </div>

            <div className="@4xl:col-span-6 bg-card border border-border/60 rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-sm space-y-3.5">
              <div className="flex justify-between items-center text-sm font-medium text-muted-foreground">
                <span>Total Before Tax</span>
                <span className="text-foreground font-bold tabular-nums">₹ {formatNumber(totalBeforeTax)}</span>
              </div>

              <div className="flex justify-between items-center text-sm font-medium text-muted-foreground">
                <span>Additional Discount (₹)</span>
                {isEditingDiscount ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-muted-foreground">₹</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      autoFocus
                      value={formAdditionalDiscount === 0 ? "" : formAdditionalDiscount}
                      onChange={(e) => setFormAdditionalDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                      onBlur={() => setIsEditingDiscount(false)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === "Escape") {
                          e.preventDefault();
                          setIsEditingDiscount(false);
                        }
                      }}
                      placeholder="0.00"
                      className="w-24 h-8 text-right px-2 bg-background border border-primary ring-1 ring-primary/20 rounded-lg text-sm font-bold text-foreground focus:outline-none tabular-nums"
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditingDiscount(true)}
                    className="text-foreground font-bold tabular-nums px-2 py-0.5 -mr-2 rounded-lg hover:bg-muted/70 transition-all cursor-pointer text-sm"
                    title="Click to edit discount"
                  >
                    ₹ {formatNumber(formAdditionalDiscount)}
                  </button>
                )}
              </div>

              <div className="flex justify-between items-center text-sm font-medium text-muted-foreground">
                <span>Tax Options</span>
                <select
                  value={formTaxOption}
                  onChange={(e) => setFormTaxOption(e.target.value)}
                  className="h-8.5 px-3 py-1 bg-background border border-border/80 rounded-lg text-xs sm:text-sm font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  <option value="No Tax">No Tax</option>
                  <option value="CGST + SGST">CGST + SGST</option>
                  <option value="IGST">IGST</option>
                </select>
              </div>

              {formTaxOption === "CGST + SGST" ? (
                <>
                  <div className="flex justify-between items-center text-sm font-medium text-muted-foreground">
                    <span>CGST (%)</span>
                    <span className="text-foreground font-bold tabular-nums">{cgstRate}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-medium text-muted-foreground">
                    <span>SGST (%)</span>
                    <span className="text-foreground font-bold tabular-nums">{sgstRate}</span>
                  </div>
                </>
              ) : formTaxOption === "IGST" ? (
                <div className="flex justify-between items-center text-sm font-medium text-muted-foreground">
                  <span>IGST (%)</span>
                  <span className="text-foreground font-bold tabular-nums">{igstRate}</span>
                </div>
              ) : null}

              <div className="border-t border-dashed border-border/70 my-2" />

              {formAdditionalDiscount > 0 && (
                <div className="flex justify-between items-center text-sm font-medium text-muted-foreground">
                  <span>Total Without GST</span>
                  <span className="text-foreground font-bold tabular-nums">₹ {formatNumber(taxableAmount)}</span>
                </div>
              )}

              <div className="flex justify-between items-center text-sm font-medium text-muted-foreground">
                <span>Total Tax Amount</span>
                <span className="text-foreground font-bold tabular-nums">₹ {formatNumber(totalTaxAmount)}</span>
              </div>

              <div className="flex justify-between items-center text-sm font-medium text-muted-foreground">
                <span>Rounded Total (₹)</span>
                <span className="text-foreground font-bold tabular-nums">₹ {formatNumber(roundedTotal)}</span>
              </div>

              <div className="flex justify-between items-center text-sm font-medium text-muted-foreground">
                <span>Calculated Round Off</span>
                <span className="text-foreground font-bold tabular-nums">
                  {roundOff >= 0 ? `+₹ ${roundOff.toFixed(2)}` : `-₹ ${Math.abs(roundOff).toFixed(2)}`}
                </span>
              </div>

              <div className="border-t border-border/80 my-2" />

              <div className="flex justify-between items-center pt-1">
                <span className="text-sm font-black uppercase tracking-wider text-foreground">TOTAL QUOTATION VALUE</span>
                <span className="text-xl sm:text-2xl font-black text-teal-600 dark:text-teal-400 tabular-nums">
                  ₹ {formatNumber(roundedTotal)}
                </span>
              </div>
            </div>
          </div>
        </form>

        <ConfirmModal
          isOpen={Boolean(removeItemId)}
          onClose={() => setRemoveItemId(null)}
          onConfirm={() => {
            setFormItems((prev) => prev.filter((it) => it.id !== removeItemId));
            setRemoveItemId(null);
          }}
          title="Remove Line Item"
          description="Are you sure you want to remove this line item from the quotation?"
        />
      </div>
    );
  }

  // RENDER: ALL QUOTATIONS LIST VIEW WITH TOP KPIS
  return (
    <div className="@container w-full space-y-6 sm:space-y-8 animate-in fade-in duration-500 min-w-0">
      {/* Header */}
      <div className="flex flex-col @4xl:flex-row justify-between items-start @4xl:items-center gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
            <ReceiptText className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
            All Quotations
          </h1>
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm font-medium">
            Manage your client quotations, proposals, track statuses, and convert to invoice.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 @4xl:shrink-0">
          <button
            type="button"
            onClick={handleOpenCreate}
            className="w-auto px-4 py-2.5 whitespace-nowrap sm:py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm text-xs sm:text-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Create Quotation
          </button>

          <button
            type="button"
            onClick={() => {
              const rows = filteredQuotations.map((q) => ({
                Number: q.quotationNumber,
                Client: q.clientName,
                Company: q.clientCompany || "",
                Amount: q.rawAmount,
                Date: q.date,
                ValidUntil: q.validUntil,
                Status: q.status,
              }));
              const csvContent =
                "data:text/csv;charset=utf-8," +
                ["Number,Client,Company,Amount,Date,ValidUntil,Status"]
                  .concat(
                    rows.map(
                      (r) =>
                        `"${r.Number}","${r.Client}","${r.Company}","${r.Amount}","${r.Date}","${r.ValidUntil}","${r.Status}"`
                    )
                  )
                  .join("\n");
              const link = document.createElement("a");
              link.setAttribute("href", encodeURI(csvContent));
              link.setAttribute("download", `quotations_${new Date().toISOString().slice(0, 10)}.csv`);
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
            className="w-auto px-4 py-2.5 whitespace-nowrap sm:py-2.5 bg-card border border-border/50 text-foreground font-bold rounded-xl hover:bg-muted/50 transition-colors flex items-center justify-center gap-2 shadow-sm text-xs sm:text-sm cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Export List
          </button>
        </div>
      </div>

      {/* Stats Bar (5 Top KPI Cards with click-to-filter just like Invoices) */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-6 @5xl:grid-cols-5">
        {/* 1. Total Quotations */}
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
            <span>Total Quotations</span>
            {isAllActive && <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
          </div>
          <div className="text-xl sm:text-2xl @6xl:text-3xl font-black whitespace-nowrap">{dateFilteredQuotations.length}</div>
        </div>

        {/* 2. Upcoming (still valid) */}
        <div
          onClick={() => handleKpiBoxClick("upcoming")}
          className={cn(
            "min-w-0 col-span-1 md:col-span-2 @5xl:col-span-1 border rounded-2xl p-4 sm:p-5 shadow-xs cursor-pointer transition-all hover:scale-[1.01] select-none",
            isUpcomingBoxSelected
              ? "bg-blue-500/15 border-blue-500/50 ring-2 ring-blue-500/30 shadow-md"
              : "bg-blue-500/5 border-blue-500/20 hover:bg-blue-500/10 opacity-80 hover:opacity-100"
          )}
        >
          <div className="text-blue-600 dark:text-blue-400 font-bold text-xs uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Upcoming</span>
            <div className="flex items-center gap-1.5">
              {isUpcomingBoxSelected && <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />}
              <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-blue-500/15 font-black text-blue-700 dark:text-blue-300">
                {upcomingCount}
              </span>
            </div>
          </div>
          <div className="text-xl sm:text-2xl @6xl:text-3xl font-black whitespace-nowrap text-blue-700 dark:text-blue-400">
            ₹ {upcomingAmount.toLocaleString("en-IN")}
          </div>
        </div>

        {/* 3. Accepted / Converted */}
        <div
          onClick={() => handleKpiBoxClick("accepted")}
          className={cn(
            "min-w-0 col-span-1 md:col-span-2 @5xl:col-span-1 border rounded-2xl p-4 sm:p-5 shadow-xs cursor-pointer transition-all hover:scale-[1.01] select-none",
            isAcceptedBoxSelected
              ? "bg-emerald-500/15 border-emerald-500/50 ring-2 ring-emerald-500/30 shadow-md"
              : "bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10 opacity-80 hover:opacity-100"
          )}
        >
          <div className="text-emerald-600 dark:text-emerald-400 font-bold text-xs uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Accepted / Converted</span>
            <div className="flex items-center gap-1.5">
              {isAcceptedBoxSelected && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              )}
              <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-emerald-500/15 font-black text-emerald-700 dark:text-emerald-300">
                {acceptedCount}
              </span>
            </div>
          </div>
          <div className="text-xl sm:text-2xl @6xl:text-3xl font-black whitespace-nowrap text-emerald-700 dark:text-emerald-400">
            ₹ {acceptedAmount.toLocaleString("en-IN")}
          </div>
        </div>

        {/* 4. Overdue (past Valid Until) */}
        <div
          onClick={() => handleKpiBoxClick("overdue")}
          className={cn(
            "min-w-0 col-span-1 md:col-span-3 @5xl:col-span-1 border rounded-2xl p-4 sm:p-5 shadow-xs cursor-pointer transition-all hover:scale-[1.01] select-none",
            isOverdueBoxSelected
              ? "bg-amber-500/15 border-amber-500/50 ring-2 ring-amber-500/30 shadow-md"
              : "bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10 opacity-80 hover:opacity-100"
          )}
        >
          <div className="text-amber-600 dark:text-amber-400 font-bold text-xs uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Overdue</span>
            <div className="flex items-center gap-1.5">
              {isOverdueBoxSelected && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              )}
              <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-amber-500/15 font-black text-amber-700 dark:text-amber-300">
                {overdueCount}
              </span>
            </div>
          </div>
          <div className="text-xl sm:text-2xl @6xl:text-3xl font-black whitespace-nowrap text-amber-700 dark:text-amber-400">
            ₹ {overdueAmount.toLocaleString("en-IN")}
          </div>
        </div>

        {/* 5. Cancelled */}
        <div
          onClick={() => handleKpiBoxClick("cancelled")}
          className={cn(
            "min-w-0 col-span-1 md:col-span-3 @5xl:col-span-1 border rounded-2xl p-4 sm:p-5 shadow-xs cursor-pointer transition-all hover:scale-[1.01] select-none",
            isCancelledBoxSelected
              ? "bg-slate-500/15 border-slate-500/50 ring-2 ring-slate-500/30 shadow-md"
              : "bg-slate-500/5 border-slate-500/20 hover:bg-slate-500/10 opacity-80 hover:opacity-100"
          )}
        >
          <div className="text-slate-600 dark:text-slate-400 font-bold text-xs uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Cancelled</span>
            <div className="flex items-center gap-1.5">
              {isCancelledBoxSelected && (
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
          placeholder="Search by client, quotation number, or subject..."
          value={search}
          onChange={setSearch}
          className="w-full" containerClassName="w-full sm:w-full md:w-full @5xl:w-72 @5xl:flex-none @5xl:min-w-[180px]"
        />

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full @5xl:w-auto">
          <DateRangeFilter
            dateRange={dateRange}
            onChange={(val) => setDateRange(val || { from: undefined, to: undefined })}
            placeholder="Filter by quotation date"
            className="flex-1 min-w-[150px] @5xl:flex-none @5xl:w-auto"
          />

          <div className="relative flex-1 min-w-[150px] @5xl:flex-none @5xl:w-auto flex items-center gap-2">
            {/* Exact status saved on the quotation */}
            <SearchableSelect
              value={quotationStatusFilter}
              onChange={setQuotationStatusFilter}
              options={[
                { label: "All Quotation Status", value: "All" },
                ...QUOTATION_STATUSES.map((s) => ({ label: s.charAt(0).toUpperCase() + s.slice(1), value: s })),
              ]}
              className="w-full @5xl:w-[190px] h-[40px] px-3 bg-background border border-border/50 rounded-xl text-sm font-bold cursor-pointer"
            />
            {(!isAllActive || quotationStatusFilter !== "All") && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("All");
                  setQuotationStatusFilter("All");
                }}
                className="px-3 py-2 text-xs font-bold text-muted-foreground hover:text-foreground bg-muted/60 hover:bg-muted rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 border border-border/40"
                title="Reset filter"
              >
                <X className="w-3.5 h-3.5" />
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Quotations Table */}
      <div className="bg-card border border-border/50 rounded-2xl sm:rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <SortableHeader
                  label="Quotation Info"
                  sortKey="quotationNumber"
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
                  sortKey="rawAmount"
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
                <th className="p-3 sm:p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="p-3 sm:p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                    <span className="text-sm font-semibold">Loading quotations...</span>
                  </td>
                </tr>
              ) : sortedQuotations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-muted-foreground">
                    <ReceiptText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-base font-bold text-foreground">No quotations found</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {search || statusFilter !== "All" || quotationStatusFilter !== "All"
                        ? "Try clearing your filters or search criteria."
                        : "Create your first quotation proposal to get started."}
                    </p>
                    <button
                      type="button"
                      onClick={handleOpenCreate}
                      className="mt-4 px-4 py-2 bg-primary text-primary-foreground font-bold rounded-xl text-xs inline-flex items-center gap-1.5 shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Create Quotation
                    </button>
                  </td>
                </tr>
              ) : (
                sortedQuotations.map((q) => (
                  <tr key={q.id} className="hover:bg-muted/20 transition-colors group">
                    {/* Quotation Info */}
                    <td className="p-3 sm:p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <ReceiptText className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>
                        <div>
                          <button
                            type="button"
                            onClick={() => window.open(`${API_URL}/quotations/${q.id}/pdf`, "_blank")}
                            className="font-bold text-sm text-foreground hover:text-primary hover:underline transition-colors text-left cursor-pointer inline-flex items-center gap-1 group/num"
                            title="Open Quotation PDF"
                          >
                            <span>{q.quotationNumber}</span>
                            <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover/num:opacity-100 transition-opacity text-primary" />
                          </button>
                          {q.subject && (
                            <p className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">
                              {q.subject}
                            </p>
                          )}
                          {q.convertedInvoiceNumber && (
                            <div className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold flex items-center gap-1 mt-0.5">
                              <CheckCircle2 className="w-3 h-3" />
                              Invoice: {q.convertedInvoiceNumber}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Client */}
                    <td className="p-3 sm:p-4">
                      <div className="font-bold text-sm text-foreground">{q.clientName}</div>
                      {(q.clientCompany || q.clientPhone) && (
                        <div className="text-xs text-muted-foreground">
                          {q.clientCompany || q.clientPhone}
                        </div>
                      )}
                    </td>

                    {/* Amount */}
                    <td className="p-3 sm:p-4">
                      <div className="font-black text-sm text-foreground font-mono">{q.amount}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {q.raw.tax_option === "No Tax" ? "Without Tax" : "Incl. 18% GST"}
                      </div>
                    </td>

                    {/* Dates */}
                    <td className="p-3 sm:p-4">
                      <div className="flex items-center gap-1 text-xs text-foreground font-medium">
                        <Calendar className="w-3 h-3 text-muted-foreground" />
                        <span>{q.date || "—"}</span>
                      </div>
                      {q.validUntil && (
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Valid: {q.validUntil}
                        </div>
                      )}
                    </td>

                    {/* Status */}
                    <td className="p-3 sm:p-4">
                      {/* Status saved on the quotation; validity shown below when it has run out */}
                      <div className="flex flex-col items-start gap-1">
                        {renderStatusBadge(q.status)}
                        {getEffectiveStatus(q) === "overdue" && q.status.toLowerCase() !== "expired" && (
                          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                            Overdue
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="p-3 sm:p-4 text-right">
                      <div className="flex items-center justify-end gap-1 sm:gap-1.5">
                        {/* View PDF */}
                        <button
                          type="button"
                          onClick={() => window.open(`${API_URL}/quotations/${q.id}/pdf`, "_blank")}
                          className="p-1.5 sm:p-2 inline-flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer"
                          title="View Quotation PDF"
                        >
                          <ArrowUpRight className="w-4 h-4" />
                        </button>

                        {/* Download PDF */}
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const blob = await api.getBlob(`/quotations/${q.id}/download`);
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = `${q.quotationNumber || "quotation"}.pdf`;
                              document.body.appendChild(a);
                              a.click();
                              a.remove();
                              setTimeout(() => URL.revokeObjectURL(url), 1000);
                            } catch {
                              toast.error("Failed to download quotation PDF");
                            }
                          }}
                          className="p-1.5 sm:p-2 inline-flex items-center justify-center text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10 rounded-lg transition-colors cursor-pointer"
                          title="Download PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>

                        {/* Update / Edit */}
                        <button
                          type="button"
                          onClick={() => openEditForm(q)}
                          className="p-1.5 sm:p-2 inline-flex items-center justify-center text-muted-foreground hover:text-amber-600 hover:bg-amber-500/10 rounded-lg transition-colors cursor-pointer"
                          title="Edit Quotation"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>

                        {/* Copy */}
                        <button
                          type="button"
                          onClick={() => openCopyForm(q)}
                          className="p-1.5 sm:p-2 inline-flex items-center justify-center text-muted-foreground hover:text-indigo-600 hover:bg-indigo-500/10 rounded-lg transition-colors cursor-pointer"
                          title="Copy Quotation"
                        >
                          <Copy className="w-4 h-4" />
                        </button>

                        {/* Convert to Invoice */}
                        {q.status !== "converted" && (
                          <button
                            type="button"
                            onClick={() => {
                              // Open Create Invoice prefilled with this quotation
                              const path = `/invoice/create?fromQuotation=${q.id}`;
                              if (setActive) setActive(path);
                              else window.dispatchEvent(new CustomEvent("navigate_tab", { detail: path }));
                            }}
                            className="p-1.5 sm:p-2 inline-flex items-center justify-center text-muted-foreground hover:text-purple-600 hover:bg-purple-500/10 rounded-lg transition-colors cursor-pointer"
                            title="Convert to Official Invoice"
                          >
                            <FileCheck className="w-4 h-4" />
                          </button>
                        )}

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteConfirm({
                              isOpen: true,
                              id: q.id,
                              name: q.quotationNumber,
                              status: q.status,
                            })
                          }
                          className="p-1.5 sm:p-2 inline-flex items-center justify-center text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                          title="Delete or Cancel Quotation"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete / Cancel Popup: cancel keeps the record, delete removes it */}
      <Dialog
        open={deleteConfirm.isOpen}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirm({ isOpen: false, id: null, name: "", status: "" });
        }}
      >
        <DialogContent className="max-w-md p-6 rounded-2xl bg-card border border-border/60 shadow-xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Delete or Cancel Quotation</h3>
              <p className="text-xs text-muted-foreground">{deleteConfirm.name}</p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            <b>Cancel</b> keeps the quotation and shows it under Cancelled. <b>Delete</b> removes it from the list, and its number is reused for the next quotation.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-3 border-t border-border/40">
            <button
              type="button"
              onClick={() => setDeleteConfirm({ isOpen: false, id: null, name: "", status: "" })}
              className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground font-bold rounded-xl text-xs cursor-pointer"
            >
              Close
            </button>
            {!["cancelled", "declined", "converted"].includes(deleteConfirm.status.toLowerCase()) && (
              <button
                type="button"
                onClick={() => handleCancelQuotation()}
                disabled={isProcessingAction}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs cursor-pointer disabled:opacity-50"
              >
                Cancel Quotation
              </button>
            )}
            <button
              type="button"
              onClick={confirmDelete}
              disabled={isProcessingAction}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs cursor-pointer disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
