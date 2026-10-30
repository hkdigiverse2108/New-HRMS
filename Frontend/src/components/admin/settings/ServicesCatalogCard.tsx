import { useEffect, useState } from "react";
import { Briefcase, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { toast } from "@/lib/toast";
import {
  InvoiceService,
  ServiceFormState,
  EMPTY_SERVICE_FORM,
  formFromService,
  payloadFromForm,
  fetchInvoiceServices,
  createInvoiceService,
  updateInvoiceService,
  deleteInvoiceService,
} from "@/lib/invoice-services";
import { ServiceFormFields } from "@/components/invoice/ServiceFormFields";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ConfirmModal } from "@/components/ui/confirm-modal";

const inr = (n: number) => `₹ ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function ServicesCatalogCard({ className }: { className?: string }) {
  const [services, setServices] = useState<InvoiceService[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  // `null` = closed, "new" = adding, otherwise the service being edited
  const [editing, setEditing] = useState<InvoiceService | "new" | null>(null);
  const [form, setForm] = useState<ServiceFormState>(EMPTY_SERVICE_FORM);
  const [toDelete, setToDelete] = useState<InvoiceService | null>(null);

  const load = async () => {
    try {
      setServices((await fetchInvoiceServices()) || []);
    } catch {
      // list stays empty
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setForm(EMPTY_SERVICE_FORM);
    setEditing("new");
  };

  const openEdit = (s: InvoiceService) => {
    setForm(formFromService(s));
    setEditing(s);
  };

  const handleSave = async () => {
    if (!form.description.trim()) {
      toast.error("Item description is required");
      return;
    }
    const payload = payloadFromForm(form);
    if (payload.discount > 100 || payload.discount_amount > payload.rate) {
      toast.error("Discount cannot be more than the rate");
      return;
    }
    try {
      setIsSaving(true);
      if (editing && editing !== "new") {
        await updateInvoiceService(editing._id, payload);
        toast.success("Service updated");
      } else {
        await createInvoiceService(payload);
        toast.success("Service added");
      }
      setEditing(null);
      await load();
    } catch {
      // api layer shows the backend message (e.g. duplicate description)
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteInvoiceService(toDelete._id);
      toast.success("Service deleted. You can restore it from the Recycle Bin.");
      await load();
    } catch {
      // api layer shows the backend message
    } finally {
      setToDelete(null);
    }
  };

  return (
    <div className={cn("bg-card border border-border/50 rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-sm flex flex-col min-w-0 max-w-full space-y-6", className)}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <Briefcase className="w-5 h-5 text-primary" />
            <h3 className="text-xl font-black text-foreground">Services Catalog</h3>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground font-medium">
            Services listed here appear in the Item Description dropdown when creating an invoice. Changing a service here does not change invoices already created.
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="self-start sm:self-auto inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Service
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="text-sm font-semibold">Loading services...</span>
        </div>
      ) : services.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 py-10 text-center">
          <p className="text-sm font-bold text-foreground">No services yet</p>
          <p className="text-xs text-muted-foreground mt-1">Add your first service to pick it while creating invoices.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border/60">
          <table className="w-full min-w-[860px] text-left border-collapse">
            <thead className="bg-muted/30 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border/50">
              <tr>
                <th className="px-5 py-3.5">Item Description</th>
                <th className="px-5 py-3.5 w-28">SAC</th>
                <th className="px-5 py-3.5 w-36 text-right">Rate</th>
                <th className="px-5 py-3.5 w-36 text-right">Discount Amount</th>
                <th className="px-5 py-3.5 w-32 text-right">Discount %</th>
                <th className="px-5 py-3.5 w-36 text-right">Amount</th>
                <th className="px-5 py-3.5 w-24 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {services.map((s) => (
                <tr key={s._id} className="hover:bg-muted/10 transition-colors">
                  <td className="px-5 py-3.5 text-sm font-bold text-foreground">
                    {s.description}
                    {s.updated_at && (
                      <span className="block text-[11px] font-medium text-muted-foreground">Updated {formatDate(s.updated_at)}</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-sm font-medium text-foreground">{s.sac || "-"}</td>
                  <td className="px-5 py-3.5 text-sm font-semibold text-foreground text-right tabular-nums">{inr(s.rate)}</td>
                  <td className="px-5 py-3.5 text-sm font-semibold text-foreground text-right tabular-nums">{s.discount_amount ? inr(s.discount_amount) : "-"}</td>
                  <td className="px-5 py-3.5 text-sm font-semibold text-foreground text-right tabular-nums">{s.discount ? `${s.discount}%` : "-"}</td>
                  <td className="px-5 py-3.5 text-sm font-black text-foreground text-right tabular-nums">{inr(s.amount)}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(s)}
                        className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setToDelete(s)}
                        className="p-2 text-muted-foreground hover:text-rose-600 hover:bg-rose-600/10 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && !isSaving && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Add Service" : "Edit Service"}</DialogTitle>
            <DialogDescription>Rate and discount are for one unit; the amount is calculated for you.</DialogDescription>
          </DialogHeader>

          <ServiceFormFields form={form} onChange={setForm} />

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditing(null)}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl border border-border bg-background text-sm font-bold hover:bg-muted transition-colors disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editing === "new" ? "Add Service" : "Save Changes"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        isOpen={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={handleDelete}
        title="Delete Service"
        description="This removes the service from the invoice dropdown. Existing invoices are not affected, and you can restore it from the Recycle Bin."
        itemName={toDelete?.description}
      />
    </div>
  );
}
