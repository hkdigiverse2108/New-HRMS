import { api } from "@/lib/api";

/** A catalog service picked from the invoice "Item Description" dropdown. Rate and discounts are per unit. */
export interface InvoiceService {
  _id: string;
  description: string;
  sac: string;
  rate: number;
  /** Discount in percent */
  discount: number;
  /** Discount in rupees per unit */
  discount_amount: number;
  /** Which of the two the user typed; the other is derived from the rate */
  discount_type: "percent" | "amount";
  /** Rate after discount */
  amount: number;
  updated_at?: string;
}

export type InvoiceServiceInput = Pick<
  InvoiceService,
  "description" | "sac" | "rate" | "discount" | "discount_amount" | "discount_type"
>;

export const fetchInvoiceServices = () =>
  api.get<InvoiceService[]>("/invoice-services", { showLoader: false, showErrorToast: false });

export const createInvoiceService = (data: InvoiceServiceInput) => api.post<InvoiceService>("/invoice-services", data);

export const updateInvoiceService = (id: string, data: InvoiceServiceInput) =>
  api.put<InvoiceService>(`/invoice-services/${id}`, data);

export const deleteInvoiceService = (id: string) => api.delete(`/invoice-services/${id}`);

const round = (n: number, dp: number) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

/** Text-input state for the add/edit form. Numbers stay strings so the boxes can be empty. */
export interface ServiceFormState {
  description: string;
  sac: string;
  rate: string;
  discountPercent: string;
  discountAmount: string;
  /** Which discount box was typed in last; the other one is calculated from it */
  discountType: "percent" | "amount";
}

export const EMPTY_SERVICE_FORM: ServiceFormState = {
  description: "",
  sac: "",
  rate: "",
  discountPercent: "",
  discountAmount: "",
  discountType: "amount",
};

const show = (n: number) => (n ? String(n) : "");

export const formFromService = (s: InvoiceService): ServiceFormState => ({
  description: s.description,
  sac: s.sac || "",
  rate: String(s.rate),
  discountPercent: show(s.discount),
  discountAmount: show(s.discount_amount),
  discountType: s.discount_type || "amount",
});

/** Re-derives the discount that was not typed. `type` says which one is the source of truth. */
function withDerived(form: ServiceFormState, type: "percent" | "amount"): ServiceFormState {
  const rate = parseFloat(form.rate) || 0;
  if (type === "percent") {
    const pct = Math.min(100, parseFloat(form.discountPercent) || 0);
    return { ...form, discountType: type, discountAmount: show(round((rate * pct) / 100, 2)) };
  }
  const amt = Math.min(rate, parseFloat(form.discountAmount) || 0);
  return { ...form, discountType: type, discountPercent: show(rate ? round((amt / rate) * 100, 2) : 0) };
}

export const setServiceRate = (form: ServiceFormState, rate: string) => withDerived({ ...form, rate }, form.discountType);

export const setServicePercent = (form: ServiceFormState, discountPercent: string) =>
  withDerived({ ...form, discountPercent }, "percent");

export const setServiceDiscountAmount = (form: ServiceFormState, discountAmount: string) =>
  withDerived({ ...form, discountAmount }, "amount");

export const payloadFromForm = (form: ServiceFormState): InvoiceServiceInput => ({
  description: form.description.trim(),
  sac: form.sac.trim(),
  rate: parseFloat(form.rate) || 0,
  discount: parseFloat(form.discountPercent) || 0,
  discount_amount: parseFloat(form.discountAmount) || 0,
  discount_type: form.discountType,
});
