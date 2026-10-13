import React, { useState, useEffect } from "react";
import { ReceiptText, Save, Loader2, Upload, X, Building2, CreditCard, ShieldCheck, FileCheck, FileText, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { getApiUrl } from "@/lib/config";

export interface InvoiceSettingsData {
  company_name?: string;
  company_address?: string;
  company_phone?: string;
  company_email?: string;
  company_gstin: string;
  company_pan: string;
  company_llpin: string;
  company_state_code: string;
  signature_name: string;
  signature_url?: string | null;
  default_terms: string;
  quotation_terms?: string;
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  account_name: string;
}

const DEFAULT_INVOICE_SETTINGS: InvoiceSettingsData = {
  company_name: "Harikrushn DigiVerse LLP",
  company_address:
    "FLAT-204, 2nd FLOOR, RS NO-67/1, WING-A, HARIKRUSHANA COMPLEX, OPP. BHAGAT NAGAR, VED, GURUKULROAD, KATARGAM, SURAT- 395004, Gujarat, INDIA",
  company_phone: "+919537150942",
  company_email: "hkdigiverse@gmail.com",
  company_gstin: "24AAXFN3372M1ZK",
  company_pan: "AAXFN3372M",
  company_llpin: "ACK-1143",
  company_state_code: "24",
  signature_name: "Authorized Signatory",
  signature_url: null,
  default_terms:
    "1. Payment is due within 3 days of the invoice date.\n2. Late payments may incur additional charges.\n3. All disputes are subject to Gujarat Jurisdiction.",
  quotation_terms:
    "1. This quotation is valid for 30 days from the date of issue.\n2. Payment terms: 50% advance, remaining on completion.\n3. Applicable taxes will be charged as per government regulations.",
  bank_name: "Axis Bankk",
  account_number: "9240200573774150",
  ifsc_code: "UTIB00028912",
  account_name: "Harikrushn DigiVerse LLP",
};

export function InvoiceSettingsCard({
  className,
  onSaved,
}: {
  className?: string;
  onSaved?: () => void;
}) {
  const [formData, setFormData] = useState<InvoiceSettingsData>(DEFAULT_INVOICE_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingSig, setIsUploadingSig] = useState(false);

  // Fetch settings from GET /settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setIsLoading(true);
        const res = await api.get<any>("/settings", {
          showLoader: false,
          showErrorToast: false,
        });
        if (res) {
          setFormData({
            company_name: res.company_name || DEFAULT_INVOICE_SETTINGS.company_name,
            company_address: res.company_address || DEFAULT_INVOICE_SETTINGS.company_address,
            company_phone: res.company_phone || DEFAULT_INVOICE_SETTINGS.company_phone,
            company_email: res.company_email || DEFAULT_INVOICE_SETTINGS.company_email,
            company_gstin: res.company_gstin || DEFAULT_INVOICE_SETTINGS.company_gstin,
            company_pan: res.company_pan || DEFAULT_INVOICE_SETTINGS.company_pan,
            company_llpin: res.company_llpin || DEFAULT_INVOICE_SETTINGS.company_llpin,
            company_state_code: res.company_state_code || DEFAULT_INVOICE_SETTINGS.company_state_code,
            signature_name: res.signature_name || DEFAULT_INVOICE_SETTINGS.signature_name,
            signature_url: res.signature_url || null,
            default_terms: res.default_terms || DEFAULT_INVOICE_SETTINGS.default_terms,
            quotation_terms: res.quotation_terms || DEFAULT_INVOICE_SETTINGS.quotation_terms,
            bank_name: res.bank_name || DEFAULT_INVOICE_SETTINGS.bank_name,
            account_number: res.account_number || DEFAULT_INVOICE_SETTINGS.account_number,
            ifsc_code: res.ifsc_code || DEFAULT_INVOICE_SETTINGS.ifsc_code,
            account_name: res.account_name || DEFAULT_INVOICE_SETTINGS.account_name,
          });
        }
      } catch (err) {
        console.warn("Could not fetch /settings, using defaults", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleChange = (field: keyof InvoiceSettingsData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Stored paths are relative to the backend (/uploads/...)
  const getFullImageUrl = (url: string | null | undefined) => {
    if (!url) return "";
    if (/^(https?:|data:)/.test(url)) return url;
    const base = getApiUrl().replace(/\/+$/, "");
    return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
  };

  // Upload signature to /settings/signature
  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a valid image file (PNG/JPG)");
      return;
    }

    try {
      setIsUploadingSig(true);
      const fd = new FormData();
      fd.append("file", file);

      // Same API client as the letterhead upload (backend URL + auth)
      const data = await api.post<any>("/settings/signature", fd);
      if (data?.signature_url) {
        setFormData((prev) => ({ ...prev, signature_url: data.signature_url }));
        toast.success("Signature uploaded successfully!");
      }
    } catch (err: any) {
      console.error("Signature upload error:", err);
      toast.error(err?.message || "Failed to upload signature");
    } finally {
      setIsUploadingSig(false);
    }
  };

  // Save changes via PUT /settings
  const handleSave = async () => {
    try {
      setIsSaving(true);
      const payload = {
        company_gstin: formData.company_gstin.trim(),
        company_pan: formData.company_pan.trim(),
        company_llpin: formData.company_llpin.trim(),
        company_state_code: formData.company_state_code.trim(),
        signature_name: formData.signature_name.trim(),
        // Sent so removing the signature (✕) is actually saved
        signature_url: formData.signature_url || null,
        default_terms: formData.default_terms,
        quotation_terms: formData.quotation_terms,
        bank_name: formData.bank_name.trim(),
        account_number: formData.account_number.trim(),
        ifsc_code: formData.ifsc_code.trim(),
        account_name: formData.account_name.trim(),
        company_name: formData.company_name?.trim(),
        company_address: formData.company_address?.trim(),
        company_phone: formData.company_phone?.trim(),
        company_email: formData.company_email?.trim(),
      };

      await api.put("/settings", payload);
      toast.success("Settings updated successfully!");
      if (onSaved) onSaved();
    } catch (err: any) {
      console.error("Failed to save settings:", err);
      toast.error(err?.message || "Failed to update settings");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className={cn(
        "bg-card border border-border/50 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col space-y-7",
        className
      )}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <ReceiptText className="w-5 h-5 text-primary" />
            <h3 className="text-xl font-black text-foreground">
              Invoice & Quotation Configuration
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground font-medium">
            Manage company GSTIN, bank details, authorized signature, and default terms & conditions for Invoices and Quotations.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || isLoading}
          className="self-start sm:self-auto inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {isSaving ? "Saving..." : "Save Settings"}
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="text-sm font-semibold">Loading settings...</span>
        </div>
      ) : (
        <div className="space-y-7">
          {/* Section 1: GST & Legal Credentials */}
          <div className="bg-muted/20 border border-border/60 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2 text-foreground font-bold text-sm">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span>Tax & Business Credentials</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Company GSTIN
                </label>
                <input
                  type="text"
                  value={formData.company_gstin}
                  onChange={(e) => handleChange("company_gstin", e.target.value)}
                  placeholder="e.g. 24AAXFN3372M1ZK"
                  className="w-full h-11 px-3.5 bg-background border border-border/70 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Company PAN
                </label>
                <input
                  type="text"
                  value={formData.company_pan}
                  onChange={(e) => handleChange("company_pan", e.target.value)}
                  placeholder="e.g. AAXFN3372M"
                  className="w-full h-11 px-3.5 bg-background border border-border/70 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                  LLPIN / CIN
                </label>
                <input
                  type="text"
                  value={formData.company_llpin}
                  onChange={(e) => handleChange("company_llpin", e.target.value)}
                  placeholder="e.g. ACK-1143"
                  className="w-full h-11 px-3.5 bg-background border border-border/70 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Company State Code
                </label>
                <input
                  type="text"
                  value={formData.company_state_code}
                  onChange={(e) => handleChange("company_state_code", e.target.value)}
                  placeholder="e.g. 24"
                  className="w-full h-11 px-3.5 bg-background border border-border/70 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Default Bank Account */}
          <div className="bg-muted/20 border border-border/60 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2 text-foreground font-bold text-sm">
              <CreditCard className="w-4 h-4 text-primary" />
              <span>Default Bank Account (For Invoices & Quotations)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Account Name / Beneficiary
                </label>
                <input
                  type="text"
                  value={formData.account_name}
                  onChange={(e) => handleChange("account_name", e.target.value)}
                  placeholder="e.g. Harikrushn DigiVerse LLP"
                  className="w-full h-11 px-3.5 bg-background border border-border/70 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Bank Name
                </label>
                <input
                  type="text"
                  value={formData.bank_name}
                  onChange={(e) => handleChange("bank_name", e.target.value)}
                  placeholder="e.g. Axis Bankk"
                  className="w-full h-11 px-3.5 bg-background border border-border/70 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Account Number
                </label>
                <input
                  type="text"
                  value={formData.account_number}
                  onChange={(e) => handleChange("account_number", e.target.value)}
                  placeholder="e.g. 9240200573774150"
                  className="w-full h-11 px-3.5 bg-background border border-border/70 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                  IFSC Code
                </label>
                <input
                  type="text"
                  value={formData.ifsc_code}
                  onChange={(e) => handleChange("ifsc_code", e.target.value)}
                  placeholder="e.g. UTIB00028912"
                  className="w-full h-11 px-3.5 bg-background border border-border/70 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Authorized Signatory */}
          <div className="bg-muted/20 border border-border/60 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2 text-foreground font-bold text-sm">
              <FileCheck className="w-4 h-4 text-primary" />
              <span>Authorized Signatory</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              <div>
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Signatory Name / Designation
                </label>
                <input
                  type="text"
                  value={formData.signature_name}
                  onChange={(e) => handleChange("signature_name", e.target.value)}
                  placeholder="e.g. Authorized Signatory"
                  className="w-full h-11 px-3.5 bg-background border border-border/70 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Upload Authorized Signature
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-background border border-dashed border-border/80 hover:border-primary/50 rounded-xl cursor-pointer text-xs font-bold text-muted-foreground hover:text-foreground transition-all">
                    {isUploadingSig ? (
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    ) : (
                      <Upload className="w-4 h-4 text-primary" />
                    )}
                    <span>{isUploadingSig ? "Uploading..." : "Upload Signature Image"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleSignatureUpload}
                      className="hidden"
                      disabled={isUploadingSig}
                    />
                  </label>

                  {formData.signature_url && (
                    <div className="relative w-16 h-11 bg-background border border-border/70 rounded-xl p-1 flex items-center justify-center overflow-hidden shrink-0 group">
                      <img
                        src={getFullImageUrl(formData.signature_url)}
                        alt="Signature"
                        className="max-h-full max-w-full object-contain"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, signature_url: null }))}
                        className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove signature"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Terms & Conditions for Invoice and Quotation */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Default Invoice Terms */}
            <div className="bg-muted/20 border border-border/60 rounded-2xl p-5 sm:p-6 space-y-2.5 flex flex-col">
              <div className="flex items-center gap-2 text-foreground font-bold text-sm mb-1">
                <FileCheck className="w-4 h-4 text-primary" />
                <span>Default Invoice Terms & Conditions</span>
              </div>
              <p className="text-[11px] text-muted-foreground font-medium mb-1">
                Shown by default on standard tax invoices and proforma invoices.
              </p>
              <textarea
                value={formData.default_terms}
                onChange={(e) => handleChange("default_terms", e.target.value)}
                placeholder="1. Payment is due within 3 days of the invoice date..."
                rows={6}
                className="w-full flex-1 p-3.5 bg-background border border-border/70 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none leading-relaxed"
              />
            </div>

            {/* Right: Default Quotation Terms */}
            <div className="bg-muted/20 border border-border/60 rounded-2xl p-5 sm:p-6 space-y-2.5 flex flex-col">
              <div className="flex items-center gap-2 text-foreground font-bold text-sm mb-1">
                <FileText className="w-4 h-4 text-primary" />
                <span>Default Quotation Terms & Conditions</span>
              </div>
              <p className="text-[11px] text-muted-foreground font-medium mb-1">
                Shown by default on client quotations and project estimates.
              </p>
              <textarea
                value={formData.quotation_terms || ""}
                onChange={(e) => handleChange("quotation_terms", e.target.value)}
                placeholder="1. This quotation is valid for 30 days from the date of issue..."
                rows={6}
                className="w-full flex-1 p-3.5 bg-background border border-border/70 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none leading-relaxed"
              />
            </div>
          </div>

          {/* Section 5: Registered Company Address & Contact */}
          <div className="bg-muted/20 border border-border/60 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2 text-foreground font-bold text-sm">
              <Building2 className="w-4 h-4 text-primary" />
              <span>Registered Billing Address & Contact</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-3">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Company Full Registered Address
                </label>
                <input
                  type="text"
                  value={formData.company_address || ""}
                  onChange={(e) => handleChange("company_address", e.target.value)}
                  placeholder="Full office address..."
                  className="w-full h-11 px-3.5 bg-background border border-border/70 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Company Phone
                </label>
                <input
                  type="text"
                  value={formData.company_phone || ""}
                  onChange={(e) => handleChange("company_phone", e.target.value)}
                  placeholder="+91..."
                  className="w-full h-11 px-3.5 bg-background border border-border/70 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Company Email
                </label>
                <input
                  type="email"
                  value={formData.company_email || ""}
                  onChange={(e) => handleChange("company_email", e.target.value)}
                  placeholder="info@..."
                  className="w-full h-11 px-3.5 bg-background border border-border/70 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Company Name
                </label>
                <input
                  type="text"
                  value={formData.company_name || ""}
                  onChange={(e) => handleChange("company_name", e.target.value)}
                  placeholder="e.g. Harikrushn DigiVerse LLP"
                  className="w-full h-11 px-3.5 bg-background border border-border/70 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
