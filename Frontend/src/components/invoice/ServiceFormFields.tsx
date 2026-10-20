import {
  ServiceFormState,
  setServiceRate,
  setServicePercent,
  setServiceDiscountAmount,
} from "@/lib/invoice-services";

const inputClass =
  "w-full h-11 px-3.5 bg-background border border-border/70 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20";
const labelClass = "block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5";

/** The service form shared by the invoice "Manage Services" popup and Admin Settings. */
export function ServiceFormFields({
  form,
  onChange,
}: {
  form: ServiceFormState;
  onChange: (next: ServiceFormState) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="sm:col-span-2">
        <label className={labelClass}>Item Description</label>
        <input
          type="text"
          value={form.description}
          onChange={(e) => onChange({ ...form, description: e.target.value })}
          placeholder="e.g. Social Media Marketing"
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>SAC</label>
        <input
          type="text"
          value={form.sac}
          onChange={(e) => onChange({ ...form, sac: e.target.value })}
          placeholder="e.g. 998361"
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>Rate (₹)</label>
        <input
          type="number"
          min="0"
          step="any"
          value={form.rate}
          onChange={(e) => onChange(setServiceRate(form, e.target.value))}
          placeholder="0.00"
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>Discount Amount (₹)</label>
        <input
          type="number"
          min="0"
          step="any"
          value={form.discountAmount}
          onChange={(e) => onChange(setServiceDiscountAmount(form, e.target.value))}
          placeholder="0.00"
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>Discount (%)</label>
        <input
          type="number"
          min="0"
          max="100"
          step="any"
          value={form.discountPercent}
          onChange={(e) => onChange(setServicePercent(form, e.target.value))}
          placeholder="0"
          className={inputClass}
        />
      </div>
    </div>
  );
}
