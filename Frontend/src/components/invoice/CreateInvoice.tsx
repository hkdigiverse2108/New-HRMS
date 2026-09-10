import { useState, useMemo } from "react";
import { Plus, Trash2, FileText, Send, Save, ArrowLeft, Building2, Calendar, IndianRupee } from "lucide-react";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { cn } from "@/lib/utils";
import { SearchableSelect } from "@/components/ui/select";

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
}

export function CreateInvoice({ onBack, isProforma = false }: { onBack?: (() => void) | undefined, isProforma?: boolean | undefined }) {
  const [clientName, setClientName] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [gstin, setGstin] = useState("");
  const [taxRate, setTaxRate] = useState(0.18);
  const [invoiceDate, setInvoiceDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  
  const [invoiceNumber, setInvoiceNumber] = useState(() => `INV-${Date.now().toString().slice(-6)}`);
  const [paymentAccount, setPaymentAccount] = useState<"bank" | "cash">("bank");
  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");
  const [discountValue, setDiscountValue] = useState(0);
  const [shippingCharges, setShippingCharges] = useState(0);
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  
  const [clients, setClients] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      const saved = (typeof window !== 'undefined' ? localStorage.getItem('hrms_clients') : null);
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  const [projects, setProjects] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      const saved = (typeof window !== 'undefined' ? localStorage.getItem('hrms_projects') : null);
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  const clientProjects = useMemo(() => {
    if (!selectedClientId) return [];
    return projects.filter(p => p.clientId === selectedClientId);
  }, [projects, selectedClientId]);

  const [items, setItems] = useState<LineItem[]>([
    { id: "item1", description: "", quantity: 1, rate: 0 }
  ]);
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, id: string | null}>({isOpen: false, id: null});

  const handleAddItem = () => {
    setItems([...items, { id: `item_${Date.now()}`, description: "", quantity: 1, rate: 0 }]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length === 1) return; // keep at least one
    setDeleteConfirm({ isOpen: true, id });
  };

  const confirmRemoveItem = () => {
    if (deleteConfirm.id) {
      setItems(items.filter(i => i.id !== deleteConfirm.id));
    }
    setDeleteConfirm({ isOpen: false, id: null });
  };

  const updateItem = (id: string, field: keyof LineItem, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const subtotal = useMemo(() => {
    return items.reduce((acc, curr) => acc + (curr.quantity * curr.rate), 0);
  }, [items]);

  const discountAmount = discountType === "percent" 
    ? subtotal * (discountValue / 100) 
    : discountValue;
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxAmount = taxableAmount * taxRate;
  const totalAmount = taxableAmount + taxAmount + shippingCharges;

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          {onBack && (
            <button 
              onClick={onBack}
              className="p-2.5 bg-card border border-border/50 rounded-xl hover:bg-muted/50 transition-colors shadow-sm"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
              <FileText className="w-8 h-8 text-primary" />
              {isProforma ? "Create Proforma Invoice" : "Create Invoice"}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">
              {isProforma 
                ? "Generate a preliminary bill of sale in advance of a delivery." 
                : "Generate a new standard invoice for a client."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2.5 bg-card border border-border/50 text-foreground font-bold rounded-xl hover:bg-muted/50 transition-colors flex items-center gap-2 shadow-sm">
            <Save className="w-4 h-4" />
            Save Draft
          </button>
          <button className="px-5 py-2.5 bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl transition-colors flex items-center gap-2 shadow-sm">
            <Send className="w-4 h-4" />
            {isProforma ? "Generate Proforma" : "Generate Invoice"}
          </button>
        </div>
      </div>

      <div className="bg-card border border-border/50 rounded-3xl p-6 md:p-8 shadow-sm space-y-8 relative overflow-hidden">
        
        {/* Badging for Proforma */}
        {isProforma && (
          <div className="absolute top-8 right-[-40px] rotate-45 bg-amber-500 text-amber-950 font-black tracking-widest text-xs py-1.5 px-12 shadow-sm border border-amber-400">
            PROFORMA
          </div>
        )}

        {/* Invoice Details section */}
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="font-bold flex items-center gap-2 text-foreground mb-2">
              <Building2 className="w-4 h-4 text-primary" />
              Bill To
            </h3>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Client Name / Company</label>
              <SearchableSelect
                value={selectedClientId}
                onChange={(val) => {
                  setSelectedClientId(val);
                  const matched = clients.find(c => c.id === val);
                  if (matched) {
                    setClientName(matched.name);
                    setClientAddress(matched.address || "");
                    setGstin(matched.gstin || "");
                  }
                }}
                options={clients.map(c => ({ label: c.name, value: c.id }))}
                placeholder="Select Client..."
                className="w-full h-[42px] bg-background border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-bold text-left"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">GSTIN / Tax ID</label>
              <input 
                type="text"
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
                placeholder="e.g. 27AAAAA1111A1Z1"
                className="w-full px-4 py-2.5 bg-background border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Client Address (Optional)</label>
              <textarea 
                placeholder="Billing address..."
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
                className="w-full px-4 py-2.5 bg-background border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium resize-none h-20"
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-bold flex items-center gap-2 text-foreground mb-2">
              <Calendar className="w-4 h-4 text-primary" />
              Dates & Reference
            </h3>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Invoice Number</label>
              <input 
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="e.g. INV-2024-001"
                className="w-full px-4 py-2.5 bg-background border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-bold"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Invoice Date</label>
                <input 
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-background border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Due Date</label>
                <input 
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-background border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">PO Number / Reference</label>
                <input 
                  type="text"
                  placeholder="e.g. PO-98765"
                  className="w-full px-4 py-2.5 bg-background border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Tax Rate (GST)</label>
                <SearchableSelect
                  value={taxRate.toString()}
                  onChange={(val) => setTaxRate(parseFloat(val))}
                  options={[
                    { label: "GST 18%", value: "0.18" },
                    { label: "GST 12%", value: "0.12" },
                    { label: "GST 5%", value: "0.05" },
                    { label: "None (0%)", value: "0.0" }
                  ]}
                  placeholder="Select Tax Rate..."
                  className="w-full h-[42px] bg-background border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-bold text-left"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Payment Account / Destination</label>
              <SearchableSelect
                value={paymentAccount}
                onChange={(val) => setPaymentAccount(val as "bank" | "cash")}
                options={[
                  { label: "Bank Account (Deposit to Bank Acc)", value: "bank" },
                  { label: "Cash (Deposit to Cash ledger)", value: "cash" }
                ]}
                placeholder="Select Destination Account..."
                className="w-full h-[42px] bg-background border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-bold text-left"
              />
            </div>
          </div>
        </div>

        <hr className="border-border/50" />

        {/* Line Items Section */}
        <div>
          <h3 className="font-bold flex items-center gap-2 text-foreground mb-4">
            <IndianRupee className="w-4 h-4 text-primary" />
            Line Items
          </h3>
          
          <div className="space-y-3">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-muted/30 rounded-xl border border-border/50">
              <div className="col-span-6 text-xs font-bold text-muted-foreground uppercase tracking-wider">Description</div>
              <div className="col-span-2 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">Qty</div>
              <div className="col-span-2 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">Rate (₹)</div>
              <div className="col-span-2 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">Amount (₹)</div>
            </div>

            {/* Line Item Rows */}
            {items.map((item, index) => (
              <div key={item.id} className="grid grid-cols-12 gap-4 items-center px-4 group">
                <div className="col-span-6 relative">
                  <input 
                    type="text"
                    value={item.description}
                    onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                    placeholder="Item description..."
                    className="w-full px-4 py-2.5 bg-background border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
                  />
                  {items.length > 1 && (
                    <button 
                      onClick={() => handleRemoveItem(item.id)}
                      className="absolute -left-8 top-1/2 -translate-y-1/2 p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      title="Remove Item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="col-span-2">
                  <input 
                    type="number"
                    min="1"
                    value={item.quantity || ""}
                    onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2.5 bg-background border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium text-right"
                  />
                </div>
                <div className="col-span-2">
                  <input 
                    type="number"
                    min="0"
                    value={item.rate || ""}
                    onChange={(e) => updateItem(item.id, 'rate', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2.5 bg-background border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium text-right"
                  />
                </div>
                <div className="col-span-2 text-right font-bold text-sm text-foreground">
                  {(item.quantity * item.rate).toLocaleString()}
                </div>
              </div>
            ))}
          </div>

          <button 
            onClick={handleAddItem}
            className="mt-4 px-4 py-2 bg-muted/50 hover:bg-muted text-foreground text-sm font-bold rounded-xl transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Line Item
          </button>
        </div>

        {paymentAccount === "bank" && (
          <div className="grid md:grid-cols-3 gap-6 bg-muted/20 p-6 rounded-2xl border border-border/50 animate-in slide-in-from-top-2 duration-300">
            <div className="col-span-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-foreground">Bank Details (Optional)</h4>
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Bank Name</label>
              <input 
                type="text" 
                placeholder="e.g. HDFC Bank"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border/50 rounded-xl focus:outline-none text-xs font-semibold"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Account Number</label>
              <input 
                type="text" 
                placeholder="e.g. 50100234567890"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border/50 rounded-xl focus:outline-none text-xs font-semibold"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 block">IFSC Code</label>
              <input 
                type="text" 
                placeholder="e.g. HDFC0001234"
                value={ifscCode}
                onChange={(e) => setIfscCode(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border/50 rounded-xl focus:outline-none text-xs font-semibold"
              />
            </div>
          </div>
        )}

        <hr className="border-border/50" />

        {/* Totals Section */}
        <div className="grid md:grid-cols-2 gap-8 items-start">
          <div className="space-y-4 bg-muted/20 p-6 rounded-2xl border border-border/50">
            <h4 className="text-xs font-black uppercase tracking-wider text-foreground mb-2">Discount & Shipping</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Discount</label>
                  <div className="flex items-center bg-background rounded-lg border border-border/50 p-0.5 text-[9px] font-bold">
                    <button
                      type="button"
                      onClick={() => {
                        setDiscountType("percent");
                        setDiscountValue(0);
                      }}
                      className={cn(
                        "px-1.5 py-0.5 rounded-md transition-all",
                        discountType === "percent" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDiscountType("amount");
                        setDiscountValue(0);
                      }}
                      className={cn(
                        "px-1.5 py-0.5 rounded-md transition-all",
                        discountType === "amount" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Flat (₹)
                    </button>
                  </div>
                </div>
                <input 
                  type="number"
                  min="0"
                  max={discountType === "percent" ? 100 : undefined}
                  value={discountValue || ""}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setDiscountValue(discountType === "percent" ? Math.min(100, Math.max(0, val)) : Math.max(0, val));
                  }}
                  placeholder={discountType === "percent" ? "e.g. 10" : "e.g. 2000"}
                  className="w-full px-4 py-2 bg-background border border-border/50 rounded-xl focus:outline-none text-xs font-semibold"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Shipping / Extra (₹)</label>
                <input 
                  type="number"
                  min="0"
                  value={shippingCharges || ""}
                  onChange={(e) => setShippingCharges(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder="e.g. 500"
                  className="w-full px-4 py-2 bg-background border border-border/50 rounded-xl focus:outline-none text-xs font-semibold"
                />
              </div>
            </div>
          </div>

          <div className="w-full space-y-3 bg-muted/10 p-6 rounded-2xl border border-border/50">
            <div className="flex justify-between items-center text-sm font-bold text-muted-foreground">
              <span>Subtotal</span>
              <span>₹ {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            {discountValue > 0 && (
              <div className="flex justify-between items-center text-sm font-bold text-rose-600">
                <span>Discount {discountType === "percent" ? `(${discountValue}%)` : ""}</span>
                <span>- ₹ {discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-sm font-bold text-muted-foreground">
              <span>Tax ({Math.round(taxRate * 100)}%)</span>
              <span>₹ {taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            {shippingCharges > 0 && (
              <div className="flex justify-between items-center text-sm font-bold text-muted-foreground">
                <span>Shipping / Extra</span>
                <span>₹ {shippingCharges.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            )}
            <div className="pt-3 border-t border-border/50 flex justify-between items-center">
              <span className="text-lg font-black text-foreground">Total</span>
              <span className="text-xl font-black text-primary">
                ₹ {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Notes / Terms</label>
          <textarea 
            defaultValue={isProforma ? "This is a proforma invoice. It does not demand payment." : "Please process payment within the due date to avoid late fees."}
            className="w-full px-4 py-3 bg-background border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium resize-none h-20"
          />
        </div>
      </div>

      <ConfirmModal 
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, id: null })}
        onConfirm={confirmRemoveItem}
        title="Remove Line Item"
        description="Are you sure you want to remove this line item from the invoice?"
      />
    </div>
  );
}
