import { createPortal } from "react-dom";
import { useState, useMemo, useEffect, useRef } from "react";
import { Plus, Trash2, FileText, Send, Save, ArrowLeft, Building2, Calendar, IndianRupee, QrCode, Loader2, CheckCircle2 } from "lucide-react";
import QRCode from "qrcode";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { DatePicker } from "@/components/ui/date-picker";
import { SearchableSelect } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useDepartments } from "@/components/employees/DepartmentContext";
import { api } from "@/lib/api";
import { API_URL } from "@/lib/config";
import { toast } from "@/lib/toast";
import { InvoiceService, fetchInvoiceServices } from "@/lib/invoice-services";
import { ServiceDescriptionInput } from "@/components/invoice/ServiceDescriptionInput";

interface LineItem {
  id: string;
  description: string;
  sac: string;
  quantity: number;
  rate: number;
  discount: number;
  discountType?: "percent" | "amount";
  /** Both forms of the discount of the service this line was picked from (% and ₹ per unit) */
  serviceDiscount?: { percent: number; amount: number };
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

const PAYMENT_MODES_TAX = [
  "Current Account",
  "Cash with GST",
];

const PAYMENT_MODES_PROFORMA = [
  "Cash",
  "Other Account",
];

export function CreateInvoice({
  onBack,
  isProforma = false,
  activeTabPath,
  invoiceId,
}: {
  onBack?: (() => void) | undefined;
  isProforma?: boolean | undefined;
  activeTabPath?: string | undefined;
  invoiceId?: string | undefined;
}) {
  const searchParams = new URLSearchParams(
    activeTabPath && activeTabPath.includes("?")
      ? activeTabPath.split("?")[1]
      : typeof window !== "undefined"
      ? window.location.search
      : ""
  );
  const editInvoiceId = invoiceId || searchParams.get("id") || searchParams.get("editId") || "";
  const isEditMode = Boolean(editInvoiceId);
  // "Convert to Official Invoice" from a quotation opens this page prefilled with that quotation
  const fromQuotationId = isEditMode ? "" : searchParams.get("fromQuotation") || "";
  // "Copy" from the invoice list opens this page prefilled with that invoice as a brand new invoice
  const copyFromInvoiceId = isEditMode || fromQuotationId ? "" : searchParams.get("copyFrom") || "";
  const [sourceQuotationNumber, setSourceQuotationNumber] = useState<string>("");
  const [pendingQuotationClient, setPendingQuotationClient] = useState<string>("");
  // Quotation client that isn't a saved client yet: asks the user whether to create it
  const [clientCreatePrompt, setClientCreatePrompt] = useState<{
    name: string; company: string; email: string; phone: string; address: string;
    gstin: string; stateUt: string; departments: string[]; notes: string;
  } | null>(null);
  const [isCreatingClient, setIsCreatingClient] = useState<boolean>(false);
  const quotationDraftRef = useRef<any>(null);
  const quotationBankRef = useRef<boolean>(false);

  const [isLoadingInvoice, setIsLoadingInvoice] = useState<boolean>(isEditMode || Boolean(fromQuotationId) || Boolean(copyFromInvoiceId));
  const [invoiceStatus, setInvoiceStatus] = useState<string>("paid");

  // Top Form State (Screenshot 1)
  const [invoiceType, setInvoiceType] = useState<string>(
    isProforma ? "Proforma Invoice" : "Tax Invoice"
  );
  // Departments come from the employee module (/departments)
  const { departments } = useDepartments();
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [clientAddress, setClientAddress] = useState<string>("");
  const [stateUt, setStateUt] = useState<string>("24 - Gujarat");
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>(["Development"]);
  const brand = selectedDepartments.join(", ");
  const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState<boolean>(false);
  const deptDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        deptDropdownRef.current &&
        !deptDropdownRef.current.contains(event.target as Node)
      ) {
        setIsDeptDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const [clientPhone, setClientPhone] = useState<string>("");
  const [clientGstin, setClientGstin] = useState<string>("");
  const [modeOfPayment, setModeOfPayment] = useState<string>(
    isProforma ? "Cash" : "Current Account"
  );
  const [invoiceNumber, setInvoiceNumber] = useState<string>("");
  const [issueDate, setIssueDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });

  // Fetch existing invoice if in Edit Mode
  useEffect(() => {
    const loadId = editInvoiceId || copyFromInvoiceId;
    if (!loadId) return;
    const isCopy = !editInvoiceId;

    let isMounted = true;
    const fetchInvoiceData = async () => {
      try {
        setIsLoadingInvoice(true);
        const res = await api.get<any>(`/invoices/${loadId}`, {
          showLoader: false,
          showErrorToast: true,
        });

        if (!isMounted || !res) return;

        if (res.invoice_type) setInvoiceType(res.invoice_type);
        if (res.invoice_number && !isCopy) setInvoiceNumber(res.invoice_number);
        if (res.client_id) setSelectedClientId(String(res.client_id));
        if (res.client_address) setClientAddress(res.client_address);
        if (res.client_phone) setClientPhone(res.client_phone);
        if (res.client_gstin) setClientGstin(res.client_gstin);
        if (res.state_ut) setStateUt(res.state_ut);

        const rawDepts = res.departments || res.client_departments || (res.brand ? [res.brand] : []);
        if (Array.isArray(rawDepts) && rawDepts.length > 0) {
          setSelectedDepartments(rawDepts);
        }

        if (res.mode_of_payment) setModeOfPayment(res.mode_of_payment);
        if (res.issue_date && !isCopy) setIssueDate(res.issue_date);
        if (res.tax_option) setTaxOption(res.tax_option);
        if (res.cgst_rate !== undefined) setCgstRate(Number(res.cgst_rate) || 0);
        if (res.sgst_rate !== undefined) setSgstRate(Number(res.sgst_rate) || 0);
        if (res.igst_rate !== undefined) setIgstRate(Number(res.igst_rate) || 0);
        if (res.additional_discount !== undefined) setAdditionalDiscount(Number(res.additional_discount) || 0);
        if (res.notes) setNotes(res.notes);
        if (res.status && !isCopy) setInvoiceStatus(res.status);

        if (res.bank_name) setBankName(res.bank_name);
        if (res.account_number) setAccountNumber(res.account_number);
        if (res.ifsc_code) setIfscCode(res.ifsc_code);
        if (res.upi_id) setUpiId(res.upi_id);
        if (res.bank_account_id) setSelectedBankAccountId(res.bank_account_id);

        if (Array.isArray(res.line_items) && res.line_items.length > 0) {
          setItems(
            res.line_items.map((it: any, idx: number) => ({
              id: `item_${idx + 1}_${Date.now()}`,
              description: it.description || "",
              sac: it.sac || "",
              quantity: Number(it.quantity) || 1,
              rate: Number(it.rate) || 0,
              discount: Number(it.discount) || 0,
              discountType: "amount",
            }))
          );
        }
      } catch (err: any) {
        console.error("Failed to load invoice for editing:", err);
        toast.error("Failed to load invoice details for editing");
      } finally {
        if (isMounted) setIsLoadingInvoice(false);
      }
    };

    fetchInvoiceData();
    return () => {
      isMounted = false;
    };
  }, [editInvoiceId, copyFromInvoiceId]);

  // Prefill from quotation (Convert to Official Invoice). Terms stay the invoice terms from settings.
  useEffect(() => {
    if (!fromQuotationId) return;

    let isMounted = true;
    const fetchQuotationData = async () => {
      try {
        setIsLoadingInvoice(true);
        const q = await api.get<any>(`/quotations/${fromQuotationId}`, {
          showLoader: false,
          showErrorToast: true,
        });
        if (!isMounted || !q) return;

        if (q.quotation_number) setSourceQuotationNumber(q.quotation_number);

        // Cash / Other Account or No Tax means it will be billed as Proforma; user can still change it
        const proformaModes = ["Cash", "Other Account"];
        const asProforma = proformaModes.includes(q.mode_of_payment) || q.tax_option === "No Tax";
        setInvoiceType(asProforma ? "Proforma Invoice" : "Tax Invoice");
        if (q.mode_of_payment) setModeOfPayment(q.mode_of_payment);
        else setModeOfPayment(asProforma ? "Cash" : "Current Account");

        if (q.client_id) setSelectedClientId(String(q.client_id));
        else if (q.client_name) {
          setPendingQuotationClient(String(q.client_name));
          quotationDraftRef.current = q;
        }
        if (q.client_address) setClientAddress(q.client_address);
        if (q.client_phone) setClientPhone(q.client_phone);
        if (q.client_gstin) setClientGstin(q.client_gstin);
        if (q.state_ut) setStateUt(q.state_ut);

        const rawDepts = Array.isArray(q.departments) && q.departments.length > 0
          ? q.departments
          : q.client_department
          ? String(q.client_department).split(",").map((d: string) => d.trim()).filter(Boolean)
          : [];
        if (rawDepts.length > 0) setSelectedDepartments(rawDepts);

        if (q.tax_option) setTaxOption(q.tax_option);
        if (q.cgst_rate !== undefined && q.cgst_rate !== null) setCgstRate(Number(q.cgst_rate) || 0);
        if (q.sgst_rate !== undefined && q.sgst_rate !== null) setSgstRate(Number(q.sgst_rate) || 0);
        if (q.igst_rate !== undefined && q.igst_rate !== null) setIgstRate(Number(q.igst_rate) || 0);
        if (q.additional_discount !== undefined) setAdditionalDiscount(Number(q.additional_discount) || 0);

        if (q.bank_name || q.account_number || q.ifsc_code) {
          quotationBankRef.current = true;
          setBankName(q.bank_name || "");
          setAccountNumber(q.account_number || "");
          setIfscCode(q.ifsc_code || "");
          setUpiId(q.upi_id || "");
        }

        if (Array.isArray(q.line_items) && q.line_items.length > 0) {
          setItems(
            q.line_items.map((it: any, idx: number) => ({
              id: `item_${idx + 1}_${Date.now()}`,
              description: it.description || "",
              sac: it.sac || "",
              quantity: Number(it.quantity) || 1,
              rate: Number(it.rate) || 0,
              discount: Number(it.discount) || 0,
              discountType: "amount",
            }))
          );
        }
      } catch (err: any) {
        console.error("Failed to load quotation for conversion:", err);
        toast.error("Failed to load quotation details");
      } finally {
        if (isMounted) setIsLoadingInvoice(false);
      }
    };

    fetchQuotationData();
    return () => {
      isMounted = false;
    };
  }, [fromQuotationId]);

  // Bank Details State (Auto-populated from Settings or Saved Other Accounts)
  const [bankName, setBankName] = useState<string>("");
  const [accountNumber, setAccountNumber] = useState<string>("");
  const [ifscCode, setIfscCode] = useState<string>("");
  const [upiId, setUpiId] = useState<string>("");
  const [upiQrDataUrl, setUpiQrDataUrl] = useState<string>("");
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>("");
  const [settingsBank, setSettingsBank] = useState<{
    bankName: string;
    accountNumber: string;
    ifscCode: string;
  }>({ bankName: "", accountNumber: "", ifscCode: "" });

  // Automatically generate QR code when upiId changes
  useEffect(() => {
    if (!upiId.trim()) {
      setUpiQrDataUrl("");
      return;
    }
    const payee = bankName.trim() || "Payee";
    const upiUri = `upi://pay?pa=${encodeURIComponent(upiId.trim())}&pn=${encodeURIComponent(payee)}&cu=INR`;
    QRCode.toDataURL(upiUri, { width: 140, margin: 1 })
      .then((url) => setUpiQrDataUrl(url))
      .catch((err) => console.error("QR Code generation error:", err));
  }, [upiId, bankName]);

  const [defaultTermsState, setDefaultTermsState] = useState<{
    invoiceTerms?: string;
    quotationTerms?: string;
  }>({});

  // Notes
  const [notes, setNotes] = useState<string>(
    isProforma
      ? "This is a proforma invoice. It does not demand payment."
      : "Please process payment within the due date to avoid late fees."
  );

  // Auto-fetch Bank Details and Terms from /settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get<any>("/settings", {
          showLoader: false,
          showErrorToast: false,
        });
        if (res) {
          const sBank = {
            bankName: res.bank_name || "",
            accountNumber: res.account_number || "",
            ifscCode: res.ifsc_code || "",
          };
          setSettingsBank(sBank);
          // Bank details entered on the source quotation win over settings
          if (!isProforma && !isEditMode && !quotationBankRef.current) {
            if (res.bank_name) setBankName(res.bank_name);
            if (res.account_number) setAccountNumber(res.account_number);
            if (res.ifsc_code) setIfscCode(res.ifsc_code);
          }
          setDefaultTermsState({
            invoiceTerms: res.default_terms,
            quotationTerms: res.quotation_terms,
          });
          if (!isEditMode) {
            if (isProforma && res.quotation_terms) {
              setNotes(res.quotation_terms);
            } else if (!isProforma && res.default_terms) {
              setNotes(res.default_terms);
            }
          }
        }
      } catch (err) {
        console.warn("Failed to load settings bank details", err);
      }
    };
    fetchSettings();
  }, [isProforma, isEditMode]);

  // Helper to select an account and auto-populate all bank fields
  const handleSelectBankAccount = (accId: string, currentAccounts = bankAccounts) => {
    setSelectedBankAccountId(accId);
    if (accId) {
      const acc = currentAccounts.find((a) => String(a.id || a._id) === accId);
      if (acc) {
        setBankName(acc.bank_name || "");
        setAccountNumber(acc.account_number || "");
        setIfscCode(acc.ifsc_code || "");
        setUpiId(acc.upi_id || "");
      }
    } else if (settingsBank.bankName) {
      setBankName(settingsBank.bankName);
      setAccountNumber(settingsBank.accountNumber);
      setIfscCode(settingsBank.ifscCode);
      setUpiId("");
    } else {
      setBankName("");
      setAccountNumber("");
      setIfscCode("");
      setUpiId("");
    }
  };

  // Fetch Saved Other Accounts from /bank-accounts
  useEffect(() => {
    const fetchBankAccounts = async () => {
      try {
        const res = await api.get<any>("/bank-accounts", {
          showLoader: false,
          showErrorToast: false,
        });
        const list = Array.isArray(res)
          ? res
          : Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res?.items)
          ? res.items
          : [];
        setBankAccounts(list);
        if (modeOfPayment === "Other Account" && list.length > 0 && !selectedBankAccountId) {
          const first = list[0];
          const firstId = String(first.id || first._id);
          handleSelectBankAccount(firstId, list);
        }
      } catch (err) {
        console.warn("Failed to load bank accounts", err);
      }
    };
    fetchBankAccounts();
  }, []);

  // Summary & Tax Fields (Proforma defaults to "No Tax")
  const [taxOption, setTaxOption] = useState<string>(
    isProforma ? "No Tax" : "CGST + SGST"
  );
  const [cgstRate, setCgstRate] = useState<number>(9);
  const [sgstRate, setSgstRate] = useState<number>(9);
  const [igstRate, setIgstRate] = useState<number>(18);
  const [additionalDiscount, setAdditionalDiscount] = useState<number>(0);
  const [isEditingDiscount, setIsEditingDiscount] = useState<boolean>(false);

  // Sync taxOption with State/UT (only if not Proforma)
  useEffect(() => {
    if (isEditMode) return;
    if (invoiceType === "Proforma Invoice") {
      setTaxOption("No Tax");
      return;
    }
    if (stateUt) {
      const lower = stateUt.toLowerCase();
      if (lower.includes("gujarat") || lower.includes("24")) {
        setTaxOption("CGST + SGST");
      } else {
        setTaxOption("IGST");
      }
    }
  }, [stateUt, invoiceType, isEditMode]);

  const [clients, setClients] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Line items (Screenshot 2)
  const [items, setItems] = useState<LineItem[]>([
    {
      id: "item_1",
      description: "",
      sac: "",
      quantity: 1,
      rate: 0,
      discount: 0,
      discountType: "amount",
    },
  ]);

  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    id: string | null;
  }>({ isOpen: false, id: null });

  // Fetch Clients
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const res = await api.get<any>("/clients?limit=100", {
          showLoader: false,
          showErrorToast: false,
        });
        const clientList = Array.isArray(res)
          ? res
          : Array.isArray(res?.data)
          ? res.data
          : [];
        setClients(clientList);
      } catch (err) {
        console.warn("Failed to fetch clients from API, using fallback", err);
        if (typeof window !== "undefined") {
          const saved = localStorage.getItem("hrms_clients");
          if (saved) {
            try {
              setClients(JSON.parse(saved));
            } catch {
              // ignore
            }
          }
        }
      }
    };
    fetchClients();
  }, []);

  // Quotations store the client by name only: match it to a saved client once both are loaded
  useEffect(() => {
    if (!pendingQuotationClient || clients.length === 0) return;
    const wanted = pendingQuotationClient.trim().toLowerCase();
    const match = clients.find((c) =>
      [c.company_name, c.contact_person_name, c.name, c.brand_name]
        .some((n) => typeof n === "string" && n.trim().toLowerCase() === wanted)
    );
    if (match) {
      setSelectedClientId(String(match._id || match.id));
      // Tax Invoice needs a GSTIN: use the client's if the quotation didn't have one
      if (match.gstin) setClientGstin((prev) => prev || match.gstin);
    } else {
      const q = quotationDraftRef.current || {};
      const depts: string[] = Array.isArray(q.departments) && q.departments.length > 0
        ? q.departments
        : q.client_department
        ? String(q.client_department).split(",").map((d: string) => d.trim()).filter(Boolean)
        : [];
      setClientCreatePrompt({
        name: pendingQuotationClient,
        company: q.client_company || pendingQuotationClient,
        email: q.client_email || "",
        phone: q.client_phone || clientPhone || "",
        address: q.client_address || clientAddress || "",
        gstin: q.client_gstin || clientGstin || "",
        stateUt: q.state_ut || stateUt || "",
        departments: depts.length > 0 ? depts : selectedDepartments,
        notes: [q.subject ? `Subject: ${q.subject}` : "", q.quotation_number ? `Created from quotation ${q.quotation_number}` : ""]
          .filter(Boolean).join(" | "),
      });
    }
    setPendingQuotationClient("");
  }, [clients, pendingQuotationClient]);

  // Create the client from the quotation details and select it on this invoice
  const handleCreateClientFromQuotation = async () => {
    if (!clientCreatePrompt) return;
    const c = clientCreatePrompt;
    try {
      setIsCreatingClient(true);
      const created: any = await api.post("/clients", {
        contact_person_name: c.name,
        company_name: c.company || c.name,
        phone_number: c.phone || "-",
        email_address: c.email || undefined,
        address: c.address || undefined,
        state_ut: c.stateUt || undefined,
        gstin: c.gstin || undefined,
        service_details: { departments: c.departments },
        additional_notes: c.notes || undefined,
      });
      const newId = String(created?._id || created?.id || "");
      if (newId) {
        setClients((prev) => [...prev, created]);
        setSelectedClientId(newId);
      }
      toast.success("Client created and selected");
      setClientCreatePrompt(null);
    } catch (err: any) {
      toast.error(err?.message || "Failed to create client");
    } finally {
      setIsCreatingClient(false);
    }
  };

  // Fetch Next Number on Mount or Invoice Type change
  useEffect(() => {
    if (isEditMode) return;
    const fetchNextNumber = async () => {
      try {
        const res = await api.get<any>(
          `/invoices/next-number?invoice_type=${encodeURIComponent(invoiceType)}`,
          { showLoader: false, showErrorToast: false }
        );
        if (res?.next_invoice_number) {
          setInvoiceNumber(res.next_invoice_number);
        } else {
          setInvoiceNumber(
            `${invoiceType === "Proforma Invoice" ? "PINV" : "INV"}-${Date.now().toString().slice(-4)}`
          );
        }
      } catch {
        setInvoiceNumber(
          `${invoiceType === "Proforma Invoice" ? "PINV" : "INV"}-${Date.now().toString().slice(-4)}`
        );
      }
    };
    fetchNextNumber();
  }, [invoiceType, isEditMode]);

  // When Client is selected
  const handleClientChange = (clientId: string) => {
    setSelectedClientId(clientId);
    const client = clients.find((c) => String(c._id || c.id) === clientId);
    if (client) {
      if (client.address) setClientAddress(client.address);
      if (client.phone_number || client.phone) {
        setClientPhone(client.phone_number || client.phone);
      }
      if (client.gstin) setClientGstin(client.gstin);

      // State matching
      const foundState = INDIAN_STATES.find(
        (s) =>
          client.state_ut &&
          s.toLowerCase().includes(client.state_ut.toLowerCase())
      );
      if (foundState) {
        setStateUt(foundState);
      } else if (client.state_ut) {
        setStateUt(client.state_ut);
      }

      // Multiple Departments / Brand matching
      const rawDepts = client.service_details?.departments;
      let clientDepts: string[] = [];
      if (Array.isArray(rawDepts) && rawDepts.length > 0) {
        clientDepts = rawDepts;
      } else if (Array.isArray(client.departments) && client.departments.length > 0) {
        clientDepts = client.departments;
      } else if (typeof client.department === "string" && client.department.trim()) {
        clientDepts = client.department.split(",").map((d: string) => d.trim()).filter(Boolean);
      } else if (client.brand) {
        clientDepts = typeof client.brand === "string"
          ? client.brand.split(",").map((d: string) => d.trim()).filter(Boolean)
          : [client.brand];
      }

      if (clientDepts.length > 0) {
        const mappedDepts = clientDepts.map((d) => {
          const found = departments.find((b) => b.toLowerCase() === d.toLowerCase());
          return found || d;
        });
        setSelectedDepartments(mappedDepts);
      }
    }
  };

  // Line Items Helpers
  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `item_${Date.now()}`,
        description: "",
        sac: "",
        quantity: 1,
        rate: 0,
        discount: 0,
        discountType: "amount",
      },
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length === 1) return;
    setDeleteConfirm({ isOpen: true, id });
  };

  const confirmRemoveItem = () => {
    if (deleteConfirm.id) {
      setItems((prev) => prev.filter((i) => i.id !== deleteConfirm.id));
    }
    setDeleteConfirm({ isOpen: false, id: null });
  };

  // Services catalog for the Item Description dropdown (Admin Settings → Services Catalog)
  const [services, setServices] = useState<InvoiceService[]>([]);
  useEffect(() => {
    fetchInvoiceServices()
      .then((list) => setServices(list || []))
      .catch(() => {});
  }, []);

  // Picking a service copies its values into this line. From then on the line is the invoice's own copy:
  // editing it here never changes the catalog, and later catalog edits never change this invoice.
  const applyService = (id: string, service: InvoiceService) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              description: service.description,
              sac: service.sac || "",
              rate: Number(service.rate) || 0,
              // The discount the service was set up with: a percentage stays a %, an amount stays in ₹
              ...(service.discount_type === "percent"
                ? { discount: Number(service.discount) || 0, discountType: "percent" as const }
                : { discount: Number(service.discount_amount) || 0, discountType: "amount" as const }),
              serviceDiscount: { percent: Number(service.discount) || 0, amount: Number(service.discount_amount) || 0 },
            }
          : item
      )
    );
  };

  // Switching % / ₹ converts the discount instead of just relabelling it. A line still showing its service's
  // own discount switches to the service's value for the other kind; otherwise it is converted using the rate.
  const switchDiscountType = (id: string, next: "percent" | "amount") => {
    setItems((prev) =>
      prev.map((item) => {
        const current = item.discountType === "percent" ? "percent" : "amount";
        if (item.id !== id || current === next) return item;
        const value = Number(item.discount) || 0;
        const rate = Number(item.rate) || 0;
        const svc = item.serviceDiscount;
        let converted: number;
        if (svc && value === svc[current]) {
          converted = svc[next];
        } else if (next === "percent") {
          converted = rate ? Math.round((value / rate) * 10000) / 100 : 0;
        } else {
          converted = Math.round(((rate * value) / 100) * 100) / 100;
        }
        return { ...item, discount: converted, discountType: next };
      })
    );
  };

  const updateItem = (id: string, field: keyof LineItem, value: any) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return { ...item, [field]: value };
        }
        return item;
      })
    );
  };

  // Calculate discount amount in ₹ for a single line item (applies per quantity)
  const getItemDiscountAmount = (item: LineItem) => {
    const qty = Number(item.quantity) || 0;
    const rate = Number(item.rate) || 0;
    const disc = Number(item.discount) || 0;
    if (item.discountType === "percent") {
      return (qty * rate * disc) / 100;
    }
    // Amount/Price discount applies per unit qty:
    return qty * disc;
  };

  // Line Items Totals calculations
  const totalQty = useMemo(() => {
    return items.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);
  }, [items]);

  const totalGrossRate = useMemo(() => {
    return items.reduce(
      (acc, curr) =>
        acc + (Number(curr.quantity) || 0) * (Number(curr.rate) || 0),
      0
    );
  }, [items]);

  const totalLineDiscount = useMemo(() => {
    return items.reduce((acc, curr) => acc + getItemDiscountAmount(curr), 0);
  }, [items]);

  const lineItemsTotalAmount = useMemo(() => {
    return Math.max(0, totalGrossRate - totalLineDiscount);
  }, [totalGrossRate, totalLineDiscount]);

  // Calculations matching backend invoice service & screenshot
  const totalBeforeTax = lineItemsTotalAmount;
  const totalWithoutGst = Math.max(0, totalBeforeTax - (additionalDiscount || 0));
  const taxableAmount = totalWithoutGst;

  const cgstAmount = useMemo(() => {
    if (taxOption !== "CGST + SGST") return 0;
    return Number((taxableAmount * (cgstRate / 100)).toFixed(2));
  }, [taxableAmount, taxOption, cgstRate]);

  const sgstAmount = useMemo(() => {
    if (taxOption !== "CGST + SGST") return 0;
    return Number((taxableAmount * (sgstRate / 100)).toFixed(2));
  }, [taxableAmount, taxOption, sgstRate]);

  const igstAmount = useMemo(() => {
    if (taxOption !== "IGST") return 0;
    return Number((taxableAmount * (igstRate / 100)).toFixed(2));
  }, [taxableAmount, taxOption, igstRate]);

  const totalTaxAmount = useMemo(() => {
    if (taxOption === "No Tax") return 0;
    return Number((cgstAmount + sgstAmount + igstAmount).toFixed(2));
  }, [cgstAmount, sgstAmount, igstAmount, taxOption]);

  const rawTotal = useMemo(() => {
    return taxableAmount + totalTaxAmount;
  }, [taxableAmount, totalTaxAmount]);

  const roundedTotal = useMemo(() => {
    return Math.round(rawTotal);
  }, [rawTotal]);

  const roundOff = useMemo(() => {
    return Number((roundedTotal - rawTotal).toFixed(2));
  }, [roundedTotal, rawTotal]);

  const totalDue = roundedTotal;



  const formatNumber = (num: number) => {
    return num.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Submit Handler
  const handleSave = async (isDraft: boolean = false) => {
    if (!selectedClientId && !isDraft) {
      toast.error("Please select a client");
      return;
    }
    if (!invoiceNumber.trim()) {
      toast.error("Invoice number is required");
      return;
    }

    const client = clients.find((c) => String(c._id || c.id) === selectedClientId);
    const clientName = client
      ? client.company_name || client.contact_person_name || client.name
      : "";

    // Tax & Proforma invoices are created only after payment, so a final save is always "paid"
    // (a draft finalized from edit mode becomes paid too; other statuses like cancelled are kept)
    const finalStatus = isDraft
      ? "draft"
      : isEditMode && invoiceStatus && invoiceStatus !== "draft"
      ? invoiceStatus
      : "paid";

    const payload = {
      invoice_type: invoiceType,
      invoice_number: invoiceNumber.trim(),
      client_id: selectedClientId || undefined,
      client_name: clientName || undefined,
      client_address: clientAddress.trim() || undefined,
      client_phone: clientPhone.trim() || undefined,
      client_gstin: clientGstin.trim() || undefined,
      client_department: brand || undefined,
      brand: brand || undefined,
      departments: selectedDepartments,
      client_departments: selectedDepartments,
      state_ut: stateUt || undefined,
      mode_of_payment: modeOfPayment || undefined,
      bank_name: bankName || undefined,
      account_number: accountNumber || undefined,
      ifsc_code: ifscCode || undefined,
      upi_id: upiId || undefined,
      issue_date: issueDate || undefined,
      tax_option: taxOption,
      cgst_rate: taxOption === "CGST + SGST" ? cgstRate : 0,
      sgst_rate: taxOption === "CGST + SGST" ? sgstRate : 0,
      igst_rate: taxOption === "IGST" ? igstRate : 0,
      additional_discount: additionalDiscount || 0,
      notes: notes || undefined,
      status: finalStatus,
      // Backend marks this quotation as converted once the invoice is generated
      source_quotation_id: fromQuotationId || undefined,
      line_items: items.map((it) => {
        const qty = Number(it.quantity) || 0;
        const rate = Number(it.rate) || 0;
        const discAmt = getItemDiscountAmount(it);
        return {
          description: it.description,
          sac: it.sac || undefined,
          quantity: qty,
          rate: rate,
          discount: discAmt,
          amount: Math.max(0, qty * rate - discAmt),
        };
      }),
    };

    try {
      setIsSubmitting(true);

      // Keep the saved client in sync with the details edited on this invoice
      if (client && selectedClientId) {
        const updates: any = {};
        if (clientAddress.trim() && clientAddress.trim() !== (client.address || "")) updates.address = clientAddress.trim();
        if (clientPhone.trim() && clientPhone.trim() !== (client.phone_number || client.phone || "")) updates.phone_number = clientPhone.trim();
        if (clientGstin.trim() && clientGstin.trim() !== (client.gstin || "")) updates.gstin = clientGstin.trim();
        if (stateUt && stateUt !== (client.state_ut || "")) updates.state_ut = stateUt;
        const oldDepts: string[] = client.service_details?.departments || [];
        if (selectedDepartments.length > 0 && [...selectedDepartments].sort().join("|") !== [...oldDepts].sort().join("|")) {
          updates.service_details = { departments: selectedDepartments };
        }
        if (Object.keys(updates).length > 0) {
          try {
            const updated: any = await api.put(`/clients/${selectedClientId}`, updates, { showErrorToast: false, showLoader: false });
            setClients((prev) => prev.map((c) => (String(c._id || c.id) === selectedClientId ? { ...c, ...(updated || updates) } : c)));
          } catch (e) {
            console.warn("Failed to sync client details", e);
          }
        }
      }

      if (isEditMode) {
        await api.put(`/invoices/${editInvoiceId}`, payload);
        toast.success(
          isDraft ? "Invoice draft updated successfully!" : "Invoice updated successfully!"
        );
        if (!isDraft) {
          window.open(`${API_URL}/invoices/${editInvoiceId}/pdf`, "_blank");
        }
      } else {
        const res: any = await api.post("/invoices", payload);
        toast.success(
          isDraft ? "Invoice draft saved successfully!" : "Invoice created successfully!"
        );
        if (!isDraft && (res?.id || res?._id)) {
          const invId = res.id || res._id;
          window.open(`${API_URL}/invoices/${invId}/pdf`, "_blank");
        }
      }
      if (onBack) onBack();
    } catch (err: any) {
      console.error(isEditMode ? "Failed to update invoice:" : "Failed to create invoice:", err);
      toast.error(err?.message || (isEditMode ? "Failed to update invoice." : "Failed to create invoice. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const paymentModes =
    invoiceType === "Proforma Invoice"
      ? PAYMENT_MODES_PROFORMA
      : PAYMENT_MODES_TAX;

  return (
    <div className="w-full space-y-6 sm:space-y-8 animate-in fade-in duration-500 min-w-0">
      {clientCreatePrompt && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-card border border-border p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-foreground">Create new client?</h3>
            <p className="text-sm text-muted-foreground">
              "{clientCreatePrompt.name}" is not a saved client. Create it from the quotation details and select it on this invoice?
            </p>
            <div className="text-xs rounded-xl bg-muted/50 p-3 space-y-1 text-foreground">
              {clientCreatePrompt.company && <div><b>Company:</b> {clientCreatePrompt.company}</div>}
              {clientCreatePrompt.phone && <div><b>Phone:</b> {clientCreatePrompt.phone}</div>}
              {clientCreatePrompt.email && <div><b>Email:</b> {clientCreatePrompt.email}</div>}
              {clientCreatePrompt.address && <div><b>Address:</b> {clientCreatePrompt.address}</div>}
              {clientCreatePrompt.gstin && <div><b>GSTIN:</b> {clientCreatePrompt.gstin}</div>}
              {clientCreatePrompt.stateUt && <div><b>State:</b> {clientCreatePrompt.stateUt}</div>}
              {clientCreatePrompt.departments.length > 0 && <div><b>Departments:</b> {clientCreatePrompt.departments.join(", ")}</div>}
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setClientCreatePrompt(null)}
                disabled={isCreatingClient}
                className="px-4 py-2 rounded-xl text-sm font-semibold border border-border hover:bg-muted cursor-pointer"
              >
                No
              </button>
              <button
                type="button"
                onClick={handleCreateClientFromQuotation}
                disabled={isCreatingClient}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 cursor-pointer disabled:opacity-60"
              >
                {isCreatingClient ? "Creating..." : "Yes, create client"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          {onBack && (
            <button
              onClick={onBack}
              type="button"
              className="p-2 sm:p-2.5 bg-card border border-border/60 rounded-xl hover:bg-muted/50 transition-colors shadow-sm shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
              <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
              {isEditMode
                ? (invoiceType === "Proforma Invoice" ? "Update Proforma Invoice" : "Update Invoice")
                : (invoiceType === "Proforma Invoice" ? "Create Proforma Invoice" : "Create Invoice")}
            </h1>
            <p className="text-muted-foreground mt-1 text-xs sm:text-sm font-medium">
              {isEditMode
                ? "Update the client details and line items below to save the invoice."
                : copyFromInvoiceId
                ? "Copy of an existing invoice: details are prefilled, make your changes and generate a new invoice."
                : fromQuotationId
                ? `Converting quotation ${sourceQuotationNumber || ""}: details are prefilled, review and generate the invoice.`
                : "Fill in the client details and line items below to generate the invoice."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full md:w-auto">
          {/* Proforma invoices are created only after payment, so they are never drafts */}
          {invoiceType !== "Proforma Invoice" && (
            <button
              type="button"
              disabled={isSubmitting || isLoadingInvoice}
              onClick={() => handleSave(true)}
              className="flex-1 sm:flex-initial px-4 py-2 sm:py-2.5 bg-card border border-border/60 text-foreground font-bold rounded-xl hover:bg-muted/50 transition-colors flex items-center justify-center gap-2 shadow-sm text-xs sm:text-sm disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              Save Draft
            </button>
          )}
          <button
            type="button"
            disabled={isSubmitting || isLoadingInvoice}
            onClick={() => handleSave(false)}
            className="flex-1 sm:flex-initial px-4 sm:px-5 py-2 sm:py-2.5 bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm text-xs sm:text-sm disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isEditMode ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {isSubmitting
              ? (isEditMode ? "Updating..." : "Generating...")
              : (isEditMode ? "Update Invoice" : "Generate Invoice")}
          </button>
        </div>
      </div>

      {isLoadingInvoice ? (
        <div className="bg-card border border-border/60 rounded-2xl sm:rounded-3xl p-16 text-center flex flex-col items-center justify-center gap-3 shadow-sm">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm font-semibold text-muted-foreground">Loading invoice details...</p>
        </div>
      ) : (
        <>
          {/* Card 1: Invoice Details (Exact User Image 1) */}
          <div className="bg-card border border-border/60 rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-sm">
            <h2 className="text-base sm:text-lg font-bold text-foreground mb-6">
              Invoice Details
            </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
          {/* Row 1: Billed To (Client) | Client Address */}
          <div>
            <label className="text-xs sm:text-sm font-semibold text-foreground mb-2 block">
              Billed To (Client)
            </label>
            <div className="relative">
              <select
                value={selectedClientId}
                onChange={(e) => handleClientChange(e.target.value)}
                className="w-full h-11 px-3.5 bg-background border border-border/70 rounded-xl text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none pr-10 cursor-pointer"
              >
                <option value="">Select client...</option>
                {clients.map((c) => {
                  const id = String(c._id || c.id);
                  const company = c.company_name || c.name || "";
                  const person = c.contact_person_name || "";
                  const label =
                    company && person
                      ? `${company} (${person})`
                      : company || person || `Client #${id.slice(-4)}`;
                  return (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  );
                })}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs sm:text-sm font-semibold text-foreground mb-2 block">
              Client Address
            </label>
            <input
              type="text"
              value={clientAddress}
              onChange={(e) => setClientAddress(e.target.value)}
              placeholder="Enter client address"
              className="w-full h-11 px-3.5 bg-background border border-border/70 rounded-xl text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Row 2: State / UT (Optional) | Brand */}
          <div>
            <label className="text-xs sm:text-sm font-semibold text-foreground mb-2 block">
              State / UT (Optional)
            </label>
            <div className="relative">
              <select
                value={stateUt}
                onChange={(e) => setStateUt(e.target.value)}
                className="w-full h-11 px-3.5 bg-background border border-border/70 rounded-xl text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none pr-10 cursor-pointer"
              >
                {INDIAN_STATES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs sm:text-sm font-semibold text-foreground block">
                Department / Brand
              </label>
              {selectedDepartments.length > 1 && (
                <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  {selectedDepartments.length} Selected
                </span>
              )}
            </div>
            <div className="relative" ref={deptDropdownRef}>
              <div
                onClick={() => setIsDeptDropdownOpen((prev) => !prev)}
                className="w-full min-h-11 px-3 py-1.5 bg-background border border-border/70 rounded-xl text-sm font-medium text-foreground focus-within:ring-2 focus-within:ring-primary/20 flex items-center justify-between gap-2 cursor-pointer hover:border-border transition-colors shadow-2xs"
              >
                <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
                  {selectedDepartments.length === 0 ? (
                    <span className="text-muted-foreground text-sm">Select department(s)...</span>
                  ) : (
                    selectedDepartments.map((d) => (
                      <span
                        key={d}
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-md text-xs font-semibold"
                      >
                        {d}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDepartments((prev) => prev.filter((item) => item !== d));
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
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M19 9l-7 7-7-7"
                    />
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
                        setSelectedDepartments([]);
                      }}
                      className="hover:text-red-500 transition-colors cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>
                  {Array.from(new Set([...departments, ...selectedDepartments])).map((deptOption) => {
                    const isChecked = selectedDepartments.includes(deptOption);
                    return (
                      <div
                        key={deptOption}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDepartments((prev) =>
                            isChecked
                              ? prev.filter((item) => item !== deptOption)
                              : [...prev, deptOption]
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

          {/* Row 3: Client Phone | Client GSTIN * */}
          <div>
            <label className="text-xs sm:text-sm font-semibold text-foreground mb-2 block">
              Client Phone
            </label>
            <input
              type="text"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              placeholder="e.g. 9825136884"
              className="w-full h-11 px-3.5 bg-background border border-border/70 rounded-xl text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label className="text-xs sm:text-sm font-semibold text-foreground mb-2 block">
              Client GSTIN <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={clientGstin}
              onChange={(e) => setClientGstin(e.target.value)}
              placeholder="Enter client GSTIN"
              className="w-full h-11 px-3.5 bg-background border border-border/70 rounded-xl text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Row 4: Invoice Type | Mode of Payment */}
          <div>
            <label className="text-xs sm:text-sm font-semibold text-foreground mb-2 block">
              Invoice Type
            </label>
            <div className="relative">
              <select
                value={invoiceType}
                onChange={(e) => {
                  const newType = e.target.value;
                  setInvoiceType(newType);
                  if (newType === "Proforma Invoice") {
                    setModeOfPayment("Cash");
                    setTaxOption("No Tax");
                    if (defaultTermsState.quotationTerms) {
                      setNotes(defaultTermsState.quotationTerms);
                    }
                  } else {
                    setModeOfPayment("Current Account");
                    const lower = stateUt.toLowerCase();
                    if (lower.includes("gujarat") || lower.includes("24")) {
                      setTaxOption("CGST + SGST");
                    } else {
                      setTaxOption("IGST");
                    }
                    if (defaultTermsState.invoiceTerms) {
                      setNotes(defaultTermsState.invoiceTerms);
                    }
                    // Reset to settings bank
                    if (settingsBank.bankName) {
                      setBankName(settingsBank.bankName);
                      setAccountNumber(settingsBank.accountNumber);
                      setIfscCode(settingsBank.ifscCode);
                      setSelectedBankAccountId("");
                    }
                  }
                }}
                className="w-full h-11 px-3.5 bg-background border border-border/70 rounded-xl text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none pr-10 cursor-pointer"
              >
                <option value="Tax Invoice">Tax Invoice</option>
                <option value="Proforma Invoice">Proforma Invoice</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs sm:text-sm font-semibold text-foreground mb-2 block">
              Mode of Payment
            </label>
            <div className="relative">
              <select
                value={modeOfPayment}
                onChange={(e) => {
                  const newMode = e.target.value;
                  setModeOfPayment(newMode);
                  if (newMode === "Other Account") {
                    if (bankAccounts.length > 0) {
                      const first = bankAccounts[0];
                      const firstId = String(first.id || first._id);
                      handleSelectBankAccount(firstId);
                    }
                  } else if (newMode === "Current Account") {
                    if (settingsBank.bankName) {
                      setBankName(settingsBank.bankName);
                      setAccountNumber(settingsBank.accountNumber);
                      setIfscCode(settingsBank.ifscCode);
                      setSelectedBankAccountId("");
                      setUpiId("");
                    }
                  } else if (newMode === "Cash") {
                    setSelectedBankAccountId("");
                    setBankName("");
                    setAccountNumber("");
                    setIfscCode("");
                    setUpiId("");
                  }
                }}
                className="w-full h-11 px-3.5 bg-background border border-border/70 rounded-xl text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none pr-10 cursor-pointer"
              >
                {paymentModes.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Other Account Field (when Mode of Payment is Other Account) */}
          {modeOfPayment === "Other Account" && (
            <div>
              <label className="text-xs sm:text-sm font-semibold text-foreground mb-2 block">
                Account (Nick Name) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={selectedBankAccountId}
                  onChange={(e) => handleSelectBankAccount(e.target.value)}
                  className="w-full h-11 px-3.5 bg-background border border-border/70 rounded-xl text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none pr-10 cursor-pointer"
                >
                  <option value="" disabled>Select Account</option>
                  {bankAccounts.map((acc) => {
                    const id = String(acc.id || acc._id);
                    const nick = acc.nickname ? acc.nickname : "Account";
                    const details = [acc.bank_name, acc.account_number ? `A/C: ${acc.account_number}` : ""].filter(Boolean).join(" • ");
                    return (
                      <option key={id} value={id}>
                        {nick} {details ? `(${details})` : ""}
                      </option>
                    );
                  })}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </div>
            </div>
          )}

          {/* Row 5: Invoice Number | Date of Issue */}
          <div>
            <label className="text-xs sm:text-sm font-semibold text-foreground mb-2 block">
              Invoice Number
            </label>
            <input
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="e.g. INVXYZ-022"
              className="w-full h-11 px-3.5 bg-background border border-border/70 rounded-xl text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label className="text-xs sm:text-sm font-semibold text-foreground mb-2 block">
              Date of Issue
            </label>
            <DatePicker
              value={issueDate}
              onChange={(val) => setIssueDate(val)}
              placeholder="DD-MM-YYYY"
              className="w-full h-11 bg-background border-border/70 rounded-xl"
            />
          </div>
        </div>
      </div>

      {/* Card 2: Line Items (Exact User Image 2) */}
      <div className="bg-card border border-border/60 rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-sm space-y-6">
        <h2 className="text-base sm:text-lg font-bold text-foreground">
          Line Items
        </h2>

        <div className="overflow-x-auto min-w-0">
          <div className="min-w-[760px] space-y-3">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-3 pb-2 text-[11px] font-black uppercase tracking-wider text-muted-foreground">
              <div className="col-span-4 pl-1">ITEM DESCRIPTION</div>
              <div className="col-span-1 text-center">SAC</div>
              <div className="col-span-1 text-center">QTY</div>
              <div className="col-span-2 text-center">RATE (₹)</div>
              <div className="col-span-2 text-center">DISCOUNT</div>
              <div className="col-span-2 text-right pr-6">AMOUNT</div>
            </div>

            {/* Line Item Rows */}
            {items.map((item) => {
              const itemGross = (Number(item.quantity) || 0) * (Number(item.rate) || 0);
              const itemDiscAmt = getItemDiscountAmount(item);
              const itemAmt = Math.max(0, itemGross - itemDiscAmt);

              return (
                <div
                  key={item.id}
                  className="grid grid-cols-12 gap-3 items-center group py-1"
                >
                  {/* ITEM DESCRIPTION */}
                  <div className="col-span-4">
                    <ServiceDescriptionInput
                      value={item.description}
                      services={services}
                      onChange={(text) => updateItem(item.id, "description", text)}
                      onPick={(service) => applyService(item.id, service)}
                      placeholder="Select or enter product/service name"
                    />
                  </div>

                  {/* SAC */}
                  <div className="col-span-1">
                    <input
                      type="text"
                      value={item.sac}
                      onChange={(e) => updateItem(item.id, "sac", e.target.value)}
                      placeholder="SAC"
                      className="w-full h-11 px-2 text-center bg-background border border-border/70 rounded-xl text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  {/* QTY */}
                  <div className="col-span-1">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={item.quantity === 0 ? "" : item.quantity}
                      onChange={(e) =>
                        updateItem(
                          item.id,
                          "quantity",
                          e.target.value === "" ? 0 : parseFloat(e.target.value) || 0
                        )
                      }
                      className="w-full h-11 px-2 text-center bg-background border border-border/70 rounded-xl text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  {/* RATE (₹) */}
                  <div className="col-span-2">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={item.rate === 0 ? "" : item.rate}
                      onChange={(e) =>
                        updateItem(
                          item.id,
                          "rate",
                          e.target.value === "" ? 0 : parseFloat(e.target.value) || 0
                        )
                      }
                      placeholder="0.00"
                      className="w-full h-11 px-3 text-center bg-background border border-border/70 rounded-xl text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  {/* DISCOUNT with % / ₹ toggle (Per QTY) */}
                  <div className="col-span-2">
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        min="0"
                        max={item.discountType === "percent" ? 100 : undefined}
                        step="any"
                        value={item.discount === 0 ? "" : item.discount}
                        onChange={(e) =>
                          updateItem(
                            item.id,
                            "discount",
                            e.target.value === "" ? 0 : parseFloat(e.target.value) || 0
                          )
                        }
                        placeholder="0"
                        className="w-full h-11 pr-14 pl-2 text-center bg-background border border-border/70 rounded-xl text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                      <div className="absolute right-1 flex items-center bg-muted/80 p-0.5 rounded-lg border border-border/60 text-[10px] font-bold select-none">
                        <button
                          type="button"
                          onClick={() => switchDiscountType(item.id, "percent")}
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
                          onClick={() => switchDiscountType(item.id, "amount")}
                          className={cn(
                            "px-1.5 py-0.5 rounded transition-all cursor-pointer",
                            (!item.discountType || item.discountType === "amount")
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

                  {/* AMOUNT + Trash */}
                  <div className="col-span-2 flex items-center justify-end gap-2.5">
                    <span className="text-sm sm:text-base font-bold text-foreground tabular-nums">
                      ₹ {formatNumber(itemAmt)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      disabled={items.length <= 1}
                      className="p-1.5 text-muted-foreground/60 hover:text-rose-500 rounded-lg hover:bg-rose-500/10 transition-colors disabled:opacity-20 disabled:hover:text-muted-foreground/60 disabled:hover:bg-transparent cursor-pointer"
                      title="Delete item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Total Footer Row (Screenshot 2) */}
            <div className="pt-4 border-t border-border/60">
              <div className="grid grid-cols-12 gap-3 items-center text-sm font-bold text-foreground">
                <div className="col-span-4 pl-1 text-base">Total</div>
                <div className="col-span-1"></div>
                <div className="col-span-1 text-center tabular-nums">
                  {totalQty}
                </div>
                <div className="col-span-2 text-center tabular-nums">
                  ₹ {formatNumber(totalGrossRate)}
                </div>
                <div className="col-span-2 text-center tabular-nums">
                  ₹ {formatNumber(totalLineDiscount)}
                </div>
                <div className="col-span-2 text-right pr-6 tabular-nums text-base">
                  ₹ {formatNumber(lineItemsTotalAmount)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Add Line Item Button */}
        <div>
          <button
            type="button"
            onClick={handleAddItem}
            className="px-4 py-2 bg-muted/60 hover:bg-muted text-foreground text-xs sm:text-sm font-bold rounded-xl transition-colors inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Line Item
          </button>
        </div>
      </div>

      {/* Card 3: Bank Details (Optional) */}
      <div className="bg-card border border-border/60 rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-sm space-y-4">
        <div>
          <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-foreground">
            Bank Details (Optional)
          </h4>
        </div>
        <div
          className={cn(
            "grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6",
            upiId?.trim() ? "md:grid-cols-4" : "md:grid-cols-3"
          )}
        >
          <div>
            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
              Bank Name
            </label>
            <input
              type="text"
              placeholder="e.g. HDFC Bank"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="w-full h-11 px-3.5 bg-background border border-border/70 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-semibold"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
              Account Number
            </label>
            <input
              type="text"
              placeholder="e.g. 50100234567890"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              className="w-full h-11 px-3.5 bg-background border border-border/70 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-semibold"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
              IFSC Code
            </label>
            <input
              type="text"
              placeholder="e.g. HDFC0001234"
              value={ifscCode}
              onChange={(e) => setIfscCode(e.target.value)}
              className="w-full h-11 px-3.5 bg-background border border-border/70 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-semibold"
            />
          </div>
          {upiId?.trim() && (
            <div>
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                UPI ID (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. user@upi"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                className="w-full h-11 px-3.5 bg-background border border-border/70 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-semibold"
              />
            </div>
          )}
        </div>

        {/* Automatic UPI QR Code Live Preview if UPI ID is present */}
        {upiQrDataUrl && (
          <div className="mt-2 p-3 bg-background border border-primary/20 rounded-2xl flex items-center gap-4 animate-in fade-in duration-300 shadow-xs">
            <div className="bg-white p-1.5 rounded-xl border border-border shrink-0 shadow-xs">
              <img
                src={upiQrDataUrl}
                alt="Automatic UPI QR Code"
                className="w-16 h-16 object-contain rounded-lg"
              />
            </div>
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <QrCode className="w-3.5 h-3.5 text-primary" />
                Automatic QR Code Generated for this Invoice
              </div>
              <p className="text-xs text-muted-foreground truncate">
                UPI ID: <strong className="text-foreground">{upiId}</strong>
              </p>
              <p className="text-[11px] text-muted-foreground">
                This QR code will be automatically embedded in the generated Invoice PDF for direct scan &amp; pay!
              </p>
            </div>
          </div>
        )}
      </div>



      {/* Bottom Section: Notes / Terms & Tax/Total Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
        {/* Left: Notes / Terms */}
        <div className="lg:col-span-6 bg-card border border-border/60 rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-sm space-y-3">
          <label className="text-xs sm:text-sm font-semibold text-foreground block">
            Notes / Terms
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Enter invoice terms or notes here..."
            className="w-full px-4 py-3 bg-background border border-border/70 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-medium resize-none h-56"
          />
        </div>

        {/* Right: Invoice Summary Card (Matching User Screenshot Exactly) */}
        <div className="lg:col-span-6 bg-card border border-border/60 rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-sm space-y-3.5">
          {/* Total Before Tax */}
          <div className="flex justify-between items-center text-sm font-medium text-muted-foreground">
            <span>Total Before Tax</span>
            <span className="text-foreground font-bold tabular-nums">
              ₹ {formatNumber(totalBeforeTax)}
            </span>
          </div>

          {/* Additional Discount (₹) (Normal display, click to edit) */}
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
                  value={additionalDiscount === 0 ? "" : additionalDiscount}
                  onChange={(e) =>
                    setAdditionalDiscount(Math.max(0, parseFloat(e.target.value) || 0))
                  }
                  onBlur={() => setIsEditingDiscount(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "Escape") {
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
                ₹ {formatNumber(additionalDiscount)}
              </button>
            )}
          </div>

          {/* Tax Options */}
          <div className="flex justify-between items-center text-sm font-medium text-muted-foreground">
            <span>Tax Options</span>
            <select
              value={taxOption}
              onChange={(e) => setTaxOption(e.target.value)}
              className="h-8.5 px-3 py-1 bg-background border border-border/80 rounded-lg text-xs sm:text-sm font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="No Tax">No Tax</option>
              <option value="CGST + SGST">CGST + SGST</option>
              <option value="IGST">IGST</option>
            </select>
          </div>

          {/* CGST (%) & SGST (%) or IGST (%) - Non-editable display */}
          {taxOption === "CGST + SGST" ? (
            <>
              <div className="flex justify-between items-center text-sm font-medium text-muted-foreground">
                <span>CGST (%)</span>
                <span className="text-foreground font-bold tabular-nums">
                  {cgstRate}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm font-medium text-muted-foreground">
                <span>SGST (%)</span>
                <span className="text-foreground font-bold tabular-nums">
                  {sgstRate}
                </span>
              </div>
            </>
          ) : taxOption === "IGST" ? (
            <div className="flex justify-between items-center text-sm font-medium text-muted-foreground">
              <span>IGST (%)</span>
              <span className="text-foreground font-bold tabular-nums">
                {igstRate}
              </span>
            </div>
          ) : null}

          {/* Dashed Separator */}
          <div className="border-t border-dashed border-border/70 my-2" />

          {/* If Discount is given, show Total Without GST above Total Tax Amount */}
          {additionalDiscount > 0 && (
            <div className="flex justify-between items-center text-sm font-medium text-muted-foreground">
              <span>Total Without GST</span>
              <span className="text-foreground font-bold tabular-nums">
                ₹ {formatNumber(Math.max(0, totalBeforeTax - additionalDiscount))}
              </span>
            </div>
          )}

          {/* Total Tax Amount */}
          <div className="flex justify-between items-center text-sm font-medium text-muted-foreground">
            <span>Total Tax Amount</span>
            <span className="text-foreground font-bold tabular-nums">
              ₹ {formatNumber(totalTaxAmount)}
            </span>
          </div>

          {/* Rounded Total (₹) */}
          <div className="flex justify-between items-center text-sm font-medium text-muted-foreground">
            <span>Rounded Total (₹)</span>
            <span className="text-foreground font-bold tabular-nums">
              ₹ {formatNumber(roundedTotal)}
            </span>
          </div>

          {/* Calculated Round Off */}
          <div className="flex justify-between items-center text-sm font-medium text-muted-foreground">
            <span>Calculated Round Off</span>
            <span className="text-foreground font-bold tabular-nums">
              {roundOff >= 0 ? `+₹ ${roundOff.toFixed(2)}` : `-₹ ${Math.abs(roundOff).toFixed(2)}`}
            </span>
          </div>

          {/* Solid Separator */}
          <div className="border-t border-border/80 my-2" />

          {/* TOTAL DUE */}
          <div className="flex justify-between items-center pt-1">
            <span className="text-sm font-black uppercase tracking-wider text-foreground">
              TOTAL DUE
            </span>
            <span className="text-xl sm:text-2xl font-black text-teal-600 dark:text-teal-400 tabular-nums">
              ₹ {formatNumber(totalDue)}
            </span>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, id: null })}
        onConfirm={confirmRemoveItem}
        title="Remove Line Item"
        description="Are you sure you want to remove this line item from the invoice?"
      />
        </>
      )}
    </div>
  );
}
