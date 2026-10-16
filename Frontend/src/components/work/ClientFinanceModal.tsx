import React, { useState } from "react";
import {
  IndianRupee,
  Calendar,
  Trash2,
  Plus,
  Users,
  CheckCircle2,
  X,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

interface ClientFinanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientName: string;
  companyName?: string | undefined;
  payments?: Array<{
    id: string;
    date: string;
    amount: number;
    work_from?: string | undefined;
    work_to?: string | undefined;
    next_reminder?: string | undefined;
    note?: string | undefined;
  }> | undefined;
  onSavePayment: (payment: {
    date: string;
    amount: number;
    work_from?: string | undefined;
    work_to?: string | undefined;
    next_reminder?: string | undefined;
    note?: string | undefined;
  }) => Promise<void>;
  onDeletePayment?: ((paymentId: string) => Promise<void>) | undefined;
  employees?: Array<{ id: string; name: string }> | undefined;
}

export const ClientFinanceModal: React.FC<ClientFinanceModalProps> = ({
  isOpen,
  onClose,
  clientName,
  companyName,
  payments = [],
  onSavePayment,
  onDeletePayment,
  employees = [],
}) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<{
    date: string | undefined;
    amount: string;
    work_from: string | undefined;
    work_to: string | undefined;
    next_reminder: string | undefined;
    note: string;
  }>({
    date: new Date().toISOString().split("T")[0],
    amount: "",
    work_from: "",
    work_to: "",
    next_reminder: "",
    note: "",
  });

  const totalReceived = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || Number(formData.amount) <= 0) {
      toast.error("Please enter a valid payment amount");
      return;
    }

    try {
      setIsSubmitting(true);
      await onSavePayment({
        date: formData.date || new Date().toISOString().slice(0, 10),
        amount: Number(formData.amount),
        work_from: formData.work_from || undefined,
        work_to: formData.work_to || undefined,
        next_reminder: formData.next_reminder || undefined,
        note: formData.note.trim() || undefined,
      });
      toast.success("Payment saved successfully!");
      setFormData({
        date: new Date().toISOString().slice(0, 10),
        amount: "",
        work_from: "",
        work_to: "",
        next_reminder: "",
        note: "",
      });
      setIsFormOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save payment");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-card border-border/60 rounded-3xl p-0 overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border/50 bg-muted/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
              <IndianRupee className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-black text-foreground">
                Client Finance & Payment Ledger
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                {clientName} {companyName ? `(${companyName})` : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsFormOpen(v => !v)}
            className="px-3.5 py-1.5 bg-primary text-primary-foreground font-bold text-xs rounded-xl hover:bg-primary/90 transition shadow-sm flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isFormOpen ? "Cancel" : "Add Payment"}</span>
          </button>
        </div>

        <div className="p-6 space-y-5 text-xs">
          {/* Top Total Banner */}
          <div className="p-4 rounded-2xl bg-muted/20 border border-border/50 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Total Collections Received
              </span>
              <h3 className="text-2xl font-black text-emerald-600 font-mono mt-0.5">
                ₹{totalReceived.toLocaleString("en-IN")}
              </h3>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              {payments.length} {payments.length === 1 ? "Payment" : "Payments"} Logged
            </span>
          </div>

          {/* Add Payment Form (Conditional) */}
          {isFormOpen && (
            <form onSubmit={handleSubmit} className="p-4 rounded-2xl bg-muted/30 border border-border/60 space-y-3">
              <h4 className="font-bold text-foreground text-xs flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-primary" /> Log New Payment
              </h4>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Date *</label>
                  <DatePicker
                    value={formData.date}
                    onChange={val => setFormData({ ...formData, date: val })}
                    placeholder="Payment Date"
                    className="w-full h-9 rounded-xl text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.amount}
                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="e.g. 50000"
                    required
                    className="w-full px-3 h-9 rounded-xl border border-border/60 bg-background text-foreground text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Next Reminder</label>
                  <DatePicker
                    value={formData.next_reminder}
                    onChange={val => setFormData({ ...formData, next_reminder: val })}
                    placeholder="Next Reminder"
                    className="w-full h-9 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Work From</label>
                  <DatePicker
                    value={formData.work_from}
                    onChange={val => setFormData({ ...formData, work_from: val })}
                    placeholder="From Date"
                    className="w-full h-9 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Work To</label>
                  <DatePicker
                    value={formData.work_to}
                    minDate={formData.work_from}
                    onChange={val => setFormData({ ...formData, work_to: val })}
                    placeholder="To Date"
                    className="w-full h-9 rounded-xl text-xs"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    <span>Save Payment</span>
                  </button>
                </div>
              </div>

              <div>
                <input
                  type="text"
                  value={formData.note}
                  onChange={e => setFormData({ ...formData, note: e.target.value })}
                  placeholder="Optional payment remarks / invoice number..."
                  className="w-full px-3 h-8 rounded-xl border border-border/60 bg-background text-foreground text-xs"
                />
              </div>
            </form>
          )}

          {/* Payment List */}
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {payments.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground font-semibold">
                No payment entries recorded yet for this client.
              </p>
            ) : (
              payments.map(p => (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl border border-border/40 bg-muted/20 hover:bg-muted/30 transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-foreground">{p.date}</span>
                    <span className="font-mono font-black text-emerald-600 text-sm">
                      ₹{Number(p.amount).toLocaleString("en-IN")}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {(p.work_from || p.work_to) && (
                      <span className="font-semibold">
                        Work: {p.work_from || ""}{p.work_from && p.work_to ? " → " : ""}{p.work_to || ""}
                      </span>
                    )}
                    {p.next_reminder && (
                      <span className="font-bold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                        Next: {p.next_reminder}
                      </span>
                    )}
                    {p.note && <span className="italic truncate max-w-[200px]" title={p.note}>"{p.note}"</span>}

                    {onDeletePayment && (
                      <button
                        type="button"
                        onClick={() => onDeletePayment(p.id)}
                        className="p-1 text-muted-foreground hover:text-rose-600 rounded-lg transition"
                        title="Delete Entry"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
