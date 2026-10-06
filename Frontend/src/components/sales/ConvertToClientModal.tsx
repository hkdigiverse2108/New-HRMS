import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Trophy,
  FileText,
  Users,
  Percent,
  Calculator,
  Calendar,
  Building,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { api } from "@/lib/api";
import { useSales } from "./SalesContext";
import { useEmployeesContext } from "@/components/employees/EmployeeContext";
import type { Lead } from "./sales-data";

interface ConvertToClientModalProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const AVAILABLE_DEPARTMENTS = [
  "SEO",
  "Web Development",
  "Social Media",
  "Performance Marketing",
  "Graphic Design",
  "Video Editing",
  "Sales",
  "IT Services",
];

const CONTRIBUTION_ROLES = [
  "Closer / Sales Exec",
  "Lead Generator / Telecaller",
  "Technical Demo / Consultant",
  "Sales Manager",
  "Account Executive",
  "Other Contributor",
];

interface IncentiveSplitMember {
  name: string;
  role: string;
  percentage: number;
  amount: number;
}

export function ConvertToClientModal({
  lead,
  isOpen,
  onClose,
  onSuccess,
}: ConvertToClientModalProps) {
  const { updateLead, stages } = useSales();
  const { employees } = useEmployeesContext();

  // Active tab state
  const [activeTab, setActiveTab] = useState("deal");

  // Client Details
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [stateUt, setStateUt] = useState("");
  const [gstin, setGstin] = useState("");
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);

  // Deal & Financials (Audio 7 & 8)
  const [dealValue, setDealValue] = useState<number>(0);
  const [isGstInclusive, setIsGstInclusive] = useState(true);
  const [gstRate, setGstRate] = useState<number>(18);
  const [quotationsList, setQuotationsList] = useState<any[]>([]);
  const [selectedQuotationId, setSelectedQuotationId] = useState<string>("none");
  const [quotationNumber, setQuotationNumber] = useState<string>("");
  const [quotationAmount, setQuotationAmount] = useState<number>(0);
  const [isLoadingQuotations, setIsLoadingQuotations] = useState(false);

  // Incentive Split (Audio 8 [14:00])
  const [incentivePoolRate, setIncentivePoolRate] = useState<number>(5); // 5% of Net Revenue
  const [splits, setSplits] = useState<IncentiveSplitMember[]>([]);

  // Project Handoff & Operations (Audio 7 [25:00])
  const [deliveryDate, setDeliveryDate] = useState("");
  const [handoffNotes, setHandoffNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch quotations for linking
  useEffect(() => {
    if (!isOpen) return;
    const fetchQuotations = async () => {
      setIsLoadingQuotations(true);
      try {
        const res = await api.get<any>("/quotations?status=all&limit=100", { showErrorToast: false });
        const items = res?.items || (Array.isArray(res) ? res : []);
        setQuotationsList(items);
      } catch {
        setQuotationsList([]);
      } finally {
        setIsLoadingQuotations(false);
      }
    };
    fetchQuotations();
  }, [isOpen]);

  // Initialize from lead
  useEffect(() => {
    if (lead) {
      setCompanyName(lead.company || lead.contact || "");
      setContactName(lead.contact || "");
      setPhone(lead.phone || "");
      setEmail(lead.email || "");
      setStateUt(lead.state || "");
      setHandoffNotes(lead.remarks || lead.projectHandoffNotes || "");
      setSelectedDepts([]);

      // Initial budget or existing deal value
      const rawBudget = Number(lead.dealValue || lead.deal_value || lead.budget) ||
        parseFloat(String(lead.expectedIncome || "").replace(/[^0-9.]/g, "")) || 0;
      setDealValue(rawBudget);

      // Link quotation if previously stored
      const qId = lead.quotationId || lead.quotation_id || "none";
      setSelectedQuotationId(qId);
      setQuotationNumber(lead.quotationTitle || lead.quotation_title || "");
      setQuotationAmount(Number(lead.quotationValue || lead.quotation_value || 0));

      // Initial incentive split: default to lead owner / assigned user 100%
      const existingSplits = lead.incentiveSplit || lead.incentive_split;
      if (Array.isArray(existingSplits) && existingSplits.length > 0) {
        setSplits(
          existingSplits.map((s) => ({
            name: s.name || "",
            role: s.role || "Closer / Sales Exec",
            percentage: Number(s.percentage ?? 0),
            amount: Number(s.amount ?? 0),
          }))
        );
      } else {
        const defaultOwner =
          (Array.isArray(lead.assignedTo) && lead.assignedTo[0]) ||
          (typeof lead.assignedTo === "string" && lead.assignedTo) ||
          lead.owner ||
          "Sales Executive";
        setSplits([
          {
            name: defaultOwner,
            role: "Closer / Sales Exec",
            percentage: 100,
            amount: 0,
          },
        ]);
      }
    }
  }, [lead]);

  // Handle quotation selection
  const handleQuotationChange = (quoId: string) => {
    setSelectedQuotationId(quoId);
    if (quoId === "none") {
      setQuotationNumber("");
      setQuotationAmount(0);
      return;
    }
    const found = quotationsList.find((q) => (q._id || q.id) === quoId);
    if (found) {
      const qNum = found.quotation_number || `QUO-${quoId.slice(-4)}`;
      const qTotal = Number(found.total_amount || found.grand_total || 0);
      setQuotationNumber(qNum);
      setQuotationAmount(qTotal);
      if (qTotal > 0) {
        setDealValue(qTotal);
      }
    }
  };

  // Financial Calculations (Audio 8 Rule: Incentive & Target are strictly on Net Amount)
  const { netAmount, gstAmount, grossAmount } = useMemo(() => {
    const val = Number(dealValue) || 0;
    if (val <= 0) return { netAmount: 0, gstAmount: 0, grossAmount: 0 };

    if (isGstInclusive) {
      // Deal Value includes GST
      const net = Math.round((val / (1 + gstRate / 100)) * 100) / 100;
      const gst = Math.round((val - net) * 100) / 100;
      return { netAmount: net, gstAmount: gst, grossAmount: val };
    } else {
      // GST is added on top of Deal Value
      const gst = Math.round((val * (gstRate / 100)) * 100) / 100;
      const gross = Math.round((val + gst) * 100) / 100;
      return { netAmount: val, gstAmount: gst, grossAmount: gross };
    }
  }, [dealValue, isGstInclusive, gstRate]);

  // Total incentive pool
  const totalIncentivePool = useMemo(() => {
    return Math.round(((netAmount * incentivePoolRate) / 100) * 100) / 100;
  }, [netAmount, incentivePoolRate]);

  // Update split amounts whenever net pool or split percentages change
  useEffect(() => {
    setSplits((prev) =>
      prev.map((s) => ({
        ...s,
        amount: Math.round(((s.percentage / 100) * totalIncentivePool) * 100) / 100,
      }))
    );
  }, [totalIncentivePool]);

  // Splits summary
  const totalSplitPercentage = useMemo(() => {
    return splits.reduce((sum, s) => sum + (Number(s.percentage) || 0), 0);
  }, [splits]);

  const addSplitMember = () => {
    const remainingPct = Math.max(0, 100 - totalSplitPercentage);
    const availableEmployee =
      employees.find((e) => !splits.some((s) => s.name === e.name))?.name ||
      "Team Member";
    setSplits((prev) => [
      ...prev,
      {
        name: availableEmployee,
        role: "Lead Generator / Telecaller",
        percentage: remainingPct,
        amount: Math.round(((remainingPct / 100) * totalIncentivePool) * 100) / 100,
      },
    ]);
  };

  const removeSplitMember = (idx: number) => {
    setSplits((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateSplit = (idx: number, field: keyof IncentiveSplitMember, val: any) => {
    setSplits((prev) =>
      prev.map((s, i) => {
        if (i !== idx) return s;
        const updated = { ...s, [field]: val };
        if (field === "percentage") {
          const pct = Number(val) || 0;
          updated.amount = Math.round(((pct / 100) * totalIncentivePool) * 100) / 100;
        }
        return updated;
      })
    );
  };

  const toggleDept = (dept: string) => {
    setSelectedDepts((prev) =>
      prev.includes(dept) ? prev.filter((d) => d !== dept) : [...prev, dept]
    );
  };

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      toast.error("Company name is required");
      setActiveTab("client");
      return;
    }
    if (!contactName.trim()) {
      toast.error("Contact person name is required");
      setActiveTab("client");
      return;
    }
    if (!phone.trim()) {
      toast.error("Phone number is required");
      setActiveTab("client");
      return;
    }
    if (dealValue <= 0) {
      toast.error("Please enter a valid deal value");
      setActiveTab("deal");
      return;
    }

    if (totalSplitPercentage !== 100 && splits.length > 0) {
      toast.error(`Incentive split must total 100% (currently ${totalSplitPercentage}%)`);
      setActiveTab("incentive");
      return;
    }

    if (!lead) return;

    setIsSubmitting(true);
    try {
      // 1. Create client entry in DB
      const clientPayload: any = {
        company_name: companyName.trim(),
        contact_person_name: contactName.trim(),
        phone_number: phone.trim(),
        email_address: email.trim() || undefined,
        address: address.trim() || undefined,
        state_ut: stateUt.trim() || undefined,
        gstin: gstin.trim() || undefined,
        additional_notes: `Won Deal: ₹${netAmount.toLocaleString()} Net Revenue. ${handoffNotes.trim()}`.trim(),
      };

      if (selectedDepts.length > 0) {
        clientPayload.service_details = { departments: selectedDepts };
      }

      await api.post("/clients", clientPayload);

      // 2. Identify the won stage name from dynamic settings
      const wonStage = stages.find((s) => s.toLowerCase().includes("won")) || "Client Won";
      const leadId = lead.id || lead._id || "";
      const closedDateStr = new Date().toISOString().split("T")[0] || null;

      // 3. Update Lead to Won with all financial and handoff metadata
      await updateLead(leadId, {
        status: wonStage,
        stage: wonStage,
        closedDate: closedDateStr,
        dealValue: grossAmount,
        dealNote: `Closed deal worth ₹${grossAmount.toLocaleString()} (Net: ₹${netAmount.toLocaleString()})`,
        quotationId: selectedQuotationId !== "none" ? selectedQuotationId : undefined,
        quotationTitle: quotationNumber || undefined,
        quotationValue: quotationAmount || undefined,
        netAmount: netAmount,
        gstAmount: gstAmount,
        incentiveSplit: splits,
        projectHandoffNotes: handoffNotes.trim()
          ? `Delivery: ${deliveryDate || "TBD"}\nNotes: ${handoffNotes.trim()}`
          : deliveryDate
          ? `Delivery: ${deliveryDate}`
          : undefined,
      });

      toast.success("🏆 Deal Won! Client created and net revenue credited to targets.");
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to convert lead to client");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl bg-card border border-border p-6 shadow-2xl">
        <DialogHeader className="border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black text-foreground">
                Convert Lead to Won Client
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Finalize negotiated deal value, quotation linking, GST breakdown, and team incentive split.
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleConvert} className="space-y-4 pt-2">
          {/* 4 Tabs: Deal & Quotation, Client Info, Incentive Split, Project Handoff */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-4 bg-muted/60 p-1 rounded-2xl h-auto mb-4">
              <TabsTrigger
                value="deal"
                className="text-xs font-bold py-2 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-xs flex items-center gap-1.5"
              >
                <Calculator className="w-3.5 h-3.5 text-emerald-600" />
                Deal & Tax
              </TabsTrigger>
              <TabsTrigger
                value="client"
                className="text-xs font-bold py-2 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-xs flex items-center gap-1.5"
              >
                <Building className="w-3.5 h-3.5 text-blue-600" />
                Client Profile
              </TabsTrigger>
              <TabsTrigger
                value="incentive"
                className="text-xs font-bold py-2 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-xs flex items-center gap-1.5"
              >
                <Users className="w-3.5 h-3.5 text-amber-600" />
                Incentive Split
              </TabsTrigger>
              <TabsTrigger
                value="handoff"
                className="text-xs font-bold py-2 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-xs flex items-center gap-1.5"
              >
                <Calendar className="w-3.5 h-3.5 text-purple-600" />
                Handoff
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: DEAL & TAX */}
            <TabsContent value="deal" className="space-y-4 mt-0">
              {/* Quotation Linking */}
              <div className="space-y-1.5 bg-muted/30 p-3.5 rounded-2xl border border-border">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-emerald-600" />
                    Link with Official Quotation
                  </Label>
                  {isLoadingQuotations && (
                    <span className="text-[10px] text-muted-foreground animate-pulse">
                      Loading quotations...
                    </span>
                  )}
                </div>
                <Select value={selectedQuotationId} onValueChange={handleQuotationChange}>
                  <SelectTrigger className="text-xs bg-background">
                    <SelectValue placeholder="Select Quotation to link..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Quotation (Manual Deal Entry)</SelectItem>
                    {quotationsList.map((q) => (
                      <SelectItem key={q._id || q.id} value={q._id || q.id}>
                        {q.quotation_number} — {q.client_name || "Client"} (₹{(q.total_amount || 0).toLocaleString()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedQuotationId !== "none" && (
                  <p className="text-[10px] text-emerald-600 font-semibold">
                    ✓ Linked: {quotationNumber} (Quotation Total: ₹{quotationAmount.toLocaleString()})
                  </p>
                )}
              </div>

              {/* Deal Value Input */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">
                    Deal Value Negotiated (₹) <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="100"
                    value={dealValue || ""}
                    onChange={(e) => setDealValue(parseFloat(e.target.value) || 0)}
                    placeholder="e.g. 150000"
                    required
                    className="text-xs font-mono font-bold"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">GST Rate (%)</Label>
                  <Select value={String(gstRate)} onValueChange={(v) => setGstRate(Number(v))}>
                    <SelectTrigger className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="18">18% (Standard GST)</SelectItem>
                      <SelectItem value="12">12% (Reduced GST)</SelectItem>
                      <SelectItem value="5">5% (Concessional)</SelectItem>
                      <SelectItem value="0">0% (Exempt / SEZ / Export)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* GST Inclusive/Exclusive Toggle */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/40 border border-border">
                <div>
                  <p className="text-xs font-bold text-foreground">Amount Includes GST?</p>
                  <p className="text-[11px] text-muted-foreground">
                    {isGstInclusive
                      ? "Deal value has 18% GST built-in. Net recognized revenue will be separated."
                      : "GST will be charged in addition on top of the deal value."}
                  </p>
                </div>
                <Button
                  type="button"
                  variant={isGstInclusive ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsGstInclusive(!isGstInclusive)}
                  className={`text-xs font-bold h-8 px-3 rounded-xl transition-all ${
                    isGstInclusive ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""
                  }`}
                >
                  {isGstInclusive ? "GST Included (18%)" : "GST Extra (+18%)"}
                </Button>
              </div>

              {/* Live Financial Breakdown Cards (Audio 8 Core Rule) */}
              <div className="grid grid-cols-3 gap-3 p-3.5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">
                    Gross Deal Value
                  </span>
                  <p className="text-sm sm:text-base font-black font-mono text-foreground">
                    ₹{grossAmount.toLocaleString()}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-400">
                    GST ({gstRate}%)
                  </span>
                  <p className="text-sm sm:text-base font-black font-mono text-amber-600">
                    ₹{gstAmount.toLocaleString()}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                    Net Revenue ★
                  </span>
                  <p className="text-sm sm:text-base font-black font-mono text-emerald-600">
                    ₹{netAmount.toLocaleString()}
                  </p>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground italic text-center">
                ★ Audio 8 Rule: Sales rep targets and incentive calculations are strictly determined from Net Revenue (excluding GST).
              </p>
            </TabsContent>

            {/* TAB 2: CLIENT PROFILE */}
            <TabsContent value="client" className="space-y-4 mt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">
                    Company Name <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Company Pvt Ltd"
                    required
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">
                    Contact Person <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Full name"
                    required
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">
                    Phone Number <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    value={phone}
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, "").slice(0, 12))}
                    onKeyDown={(e) => { if (!/[0-9]/.test(e.key) && !["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", "Enter"].includes(e.key)) e.preventDefault(); }}
                    placeholder="10-digit mobile (digits only)"
                    required
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Email Address</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="client@company.com"
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">State / UT</Label>
                  <Input
                    value={stateUt}
                    onChange={(e) => setStateUt(e.target.value)}
                    placeholder="Gujarat"
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">GSTIN (Optional)</Label>
                  <Input
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value)}
                    placeholder="24AAAAA0000A1Z5"
                    className="text-xs font-mono uppercase"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Office Address</Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Building, Street, City"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Departments / Services</Label>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {AVAILABLE_DEPARTMENTS.map((dept) => {
                    const isSelected = selectedDepts.includes(dept);
                    return (
                      <button
                        key={dept}
                        type="button"
                        onClick={() => toggleDept(dept)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all border ${
                          isSelected
                            ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                            : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                        }`}
                      >
                        {dept}
                      </button>
                    );
                  })}
                </div>
              </div>
            </TabsContent>

            {/* TAB 3: INCENTIVE SPLIT (Audio 8 Multi-person split) */}
            <TabsContent value="incentive" className="space-y-4 mt-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-muted/40 border border-border">
                <div>
                  <p className="text-xs font-bold text-foreground">Incentive Commission Pool</p>
                  <p className="text-[11px] text-muted-foreground">
                    Calculated on Net Revenue (₹{netAmount.toLocaleString()})
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-background border border-border rounded-xl px-2.5 py-1">
                    <Percent className="w-3.5 h-3.5 text-muted-foreground" />
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={incentivePoolRate}
                      onChange={(e) => setIncentivePoolRate(parseFloat(e.target.value) || 0)}
                      className="w-12 text-xs font-bold bg-transparent outline-none"
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                  <Badge variant="secondary" className="font-mono font-bold text-xs bg-emerald-100 text-emerald-800">
                    Total Pool: ₹{totalIncentivePool.toLocaleString()}
                  </Badge>
                </div>
              </div>

              {/* Members Split Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-emerald-600" />
                    Contributing Team Members & Split Percentage
                  </Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={addSplitMember}
                    className="h-7 text-xs font-bold gap-1 border-dashed border-emerald-500/50 text-emerald-700 hover:bg-emerald-50"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Member
                  </Button>
                </div>

                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {splits.map((s, idx) => (
                    <div
                      key={idx}
                      className="flex flex-wrap items-center gap-2 p-2.5 rounded-2xl bg-background border border-border shadow-2xs"
                    >
                      {/* Member Name */}
                      <div className="flex-1 min-w-[140px]">
                        <Select
                          value={s.name}
                          onValueChange={(val) => updateSplit(idx, "name", val)}
                        >
                          <SelectTrigger className="h-8 text-xs font-semibold">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {employees.map((emp) => (
                              <SelectItem key={emp.id} value={emp.name}>
                                {emp.name} ({emp.designation || emp.role || "Sales"})
                              </SelectItem>
                            ))}
                            <SelectItem value={s.name}>{s.name} (Custom)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Contribution Role */}
                      <div className="w-[150px]">
                        <Select
                          value={s.role}
                          onValueChange={(val) => updateSplit(idx, "role", val)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CONTRIBUTION_ROLES.map((r) => (
                              <SelectItem key={r} value={r}>
                                {r}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Split Percentage */}
                      <div className="flex items-center gap-1 w-[90px]">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={s.percentage}
                          onChange={(e) => updateSplit(idx, "percentage", parseFloat(e.target.value) || 0)}
                          className="h-8 text-xs font-mono font-bold text-center"
                        />
                        <span className="text-xs text-muted-foreground font-bold">%</span>
                      </div>

                      {/* Calculated Amount */}
                      <div className="w-[100px] text-right">
                        <span className="text-xs font-mono font-black text-emerald-700 dark:text-emerald-400">
                          ₹{s.amount.toLocaleString()}
                        </span>
                      </div>

                      {/* Delete */}
                      {splits.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSplitMember(idx)}
                          className="text-rose-500 hover:text-rose-700 p-1"
                          title="Remove member"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Validation Status */}
                <div className="flex items-center justify-between text-xs pt-1 px-1">
                  <span className="text-muted-foreground">
                    Total Split:{" "}
                    <strong className={totalSplitPercentage === 100 ? "text-emerald-600" : "text-amber-600"}>
                      {totalSplitPercentage}%
                    </strong>{" "}
                    of 100%
                  </span>
                  {totalSplitPercentage === 100 ? (
                    <span className="text-emerald-600 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> 100% Split Balanced
                    </span>
                  ) : (
                    <span className="text-amber-600 font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Must equal 100%
                    </span>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* TAB 4: PROJECT HANDOFF & OPERATIONS (Audio 7 [25:00]) */}
            <TabsContent value="handoff" className="space-y-4 mt-0">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Target Delivery / Go-Live Date</Label>
                <Input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">
                  Project Handoff Notes & Client Expectations
                </Label>
                <Textarea
                  value={handoffNotes}
                  onChange={(e) => setHandoffNotes(e.target.value)}
                  placeholder="Details for the production / ops team: agreed deliverables, design preferences, deadlines, tech stack, milestones, etc."
                  className="text-xs min-h-[120px]"
                />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="pt-3 gap-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs font-bold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs gap-1.5 shadow-sm"
              disabled={isSubmitting}
            >
              <Trophy className="w-4 h-4" />
              {isSubmitting ? "Converting Deal..." : "Finalize Deal & Create Client 🏆"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
