import { useEffect, useState } from "react";
import { Briefcase, Plus, Pencil, Trash2, X, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
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
import { ServiceFormFields } from "./ServiceFormFields";
import { ConfirmModal } from "@/components/ui/confirm-modal";

const inr = (n: number) => `₹ ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Manage the services offered in the invoice "Item Description" dropdown. Same layout as "Manage Other Accounts". */
export function ServicesManagerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [services, setServices] = useState<InvoiceService[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ServiceFormState>(EMPTY_SERVICE_FORM);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string | null; name: string }>({
    isOpen: false,
    id: null,
    name: "",
  });

  const load = async () => {
    try {
      setLoading(true);
      setServices((await fetchInvoiceServices()) || []);
    } catch {
      // list stays as it was
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_SERVICE_FORM);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const startEdit = (s: InvoiceService) => {
    setEditingId(s._id);
    setForm(formFromService(s));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
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
      setSubmitting(true);
      if (editingId) {
        await updateInvoiceService(editingId, payload);
        toast.success("Service updated successfully!");
      } else {
        await createInvoiceService(payload);
        toast.success("Service added successfully!");
      }
      resetForm();
      await load();
    } catch {
      // api layer shows the backend message (duplicate description, not an admin, ...)
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    const id = deleteConfirm.id;
    setDeleteConfirm({ isOpen: false, id: null, name: "" });
    if (!id) return;
    try {
      await deleteInvoiceService(id);
      toast.success("Service deleted. You can restore it from the Recycle Bin.");
      if (editingId === id) resetForm();
      await load();
    } catch {
      // api layer shows the backend message
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-card border border-border/80 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-6">
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-border/60 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-foreground">Manage Services</h3>
                <p className="text-xs text-muted-foreground font-medium">
                  Add services to pick from the Item Description dropdown while creating an invoice.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Section: Add / Edit Service */}
          <form onSubmit={handleSave} className="space-y-4 bg-muted/20 p-5 rounded-2xl border border-border/60">
            <div className="flex items-center justify-between font-bold text-sm text-foreground">
              <div className="flex items-center gap-2">
                {editingId ? (
                  <>
                    <Pencil className="w-4 h-4 text-primary" />
                    Edit Service
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 text-primary" />
                    Add New Service
                  </>
                )}
              </div>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs text-muted-foreground hover:text-foreground font-semibold px-2 py-1 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <ServiceFormFields form={form} onChange={setForm} />

            <div className="flex items-center justify-end gap-2 pt-2">
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2.5 bg-card border border-border/70 text-foreground font-bold text-xs sm:text-sm rounded-xl hover:bg-muted/60 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 bg-primary text-primary-foreground font-bold text-xs sm:text-sm rounded-xl hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : editingId ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                {editingId ? "Update Service" : "Save Service"}
              </button>
            </div>
          </form>

          {/* List of Saved Services */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                Saved Services ({services.length})
              </h4>
              {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            </div>

            {services.length === 0 && !loading && (
              <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-2xl border border-dashed border-border/60">
                <Briefcase className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-bold">No services added yet</p>
                <p className="text-xs mt-0.5">Use the form above to add your first service.</p>
              </div>
            )}

            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {services.map((s) => {
                const isCurrentEditing = editingId === s._id;
                return (
                  <div
                    key={s._id}
                    className={cn(
                      "flex items-center justify-between p-3.5 bg-background border rounded-2xl transition-colors group shadow-xs",
                      isCurrentEditing ? "border-primary ring-1 ring-primary/30 bg-primary/5" : "border-border/70 hover:border-border"
                    )}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                        <Briefcase className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-foreground truncate">{s.description}</span>
                          {s.sac && (
                            <span className="text-[11px] font-semibold px-2 py-0.5 bg-muted rounded-md text-muted-foreground">
                              SAC {s.sac}
                            </span>
                          )}
                          {isCurrentEditing && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-primary text-primary-foreground rounded-sm">
                              Editing
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3 flex-wrap">
                          <span>
                            Rate: <strong className="text-foreground">{inr(s.rate)}</strong>
                          </span>
                          <span>
                            Discount:{" "}
                            <strong className="text-foreground">
                              {s.discount_amount ? `${inr(s.discount_amount)} (${s.discount}%)` : "-"}
                            </strong>
                          </span>
                          <span>
                            Amount: <strong className="text-foreground">{inr(s.amount)}</strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <button
                        type="button"
                        onClick={() => startEdit(s)}
                        className={cn(
                          "p-2 rounded-xl transition-colors cursor-pointer",
                          isCurrentEditing
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                        )}
                        title="Edit service"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm({ isOpen: true, id: s._id, name: s.description })}
                        className="p-2 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 rounded-xl transition-colors shrink-0 cursor-pointer"
                        title="Delete service"
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
              onClick={handleClose}
              className="px-5 py-2 bg-muted hover:bg-muted/80 text-foreground font-bold text-xs sm:text-sm rounded-xl transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, id: null, name: "" })}
        onConfirm={confirmDelete}
        title="Delete Service"
        description={`Are you sure you want to delete the service "${deleteConfirm.name}"? Existing invoices are not affected, and you can restore it from the Recycle Bin.`}
        itemName={deleteConfirm.name}
      />
    </>
  );
}
