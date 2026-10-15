import { useState, useEffect, useCallback } from "react";
import { Download, Printer, FileText, Loader2, Pencil, Check, X, Mail, MessageCircle } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { SearchableSelect } from "@/components/ui/select";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";

interface PayslipLine {
  name: string;
  amount: number;
}

interface Payslip {
  _id: string;
  month: string;
  employee_id: string;
  period_start: string;
  period_end: string;
  employee: {
    name: string;
    emp_code: string;
    department: string;
    designation: string;
    joining_date?: string | null;
    work_mode?: string;
    bank_name?: string;
    account?: string;
    pan?: string;
    uan?: string;
    ifsc?: string;
  };
  attendance: {
    working_days: number;
    present: number;
    paid_leave: number;
    unpaid_leave: number;
    absent: number;
    payable_days: number;
    lop_days: number;
  };
  earnings: PayslipLine[];
  deductions: PayslipLine[];
  total_earnings: number;
  total_deductions: number;
  net_salary: number;
  published_at?: string;
  edited_at?: string;
  contact?: { email: string; phone: string };
}

interface PayslipResponse {
  months: string[];
  month: string | null;
  can_view_all: boolean;
  can_edit?: boolean;
  payslips: Payslip[];
}

interface Company {
  company_name?: string;
  company_address?: string;
  company_gstin?: string;
}

type EmployeeDraft = {
  designation: string;
  joining_date: string;
  pan: string;
  bank_name: string;
  account: string;
  ifsc: string;
};

interface Draft {
  employee: EmployeeDraft;
  present: string;
  earnings: { name: string; amount: string }[];
  deductions: { name: string; amount: string }[];
}

const toDraft = (slip: Payslip): Draft => ({
  employee: {
    designation: slip.employee.designation ?? "",
    joining_date: (slip.employee.joining_date ?? "").slice(0, 10),
    pan: slip.employee.pan ?? "",
    bank_name: slip.employee.bank_name ?? "",
    account: slip.employee.account ?? "",
    ifsc: slip.employee.ifsc ?? "",
  },
  present: String(slip.attendance.present ?? 0),
  earnings: slip.earnings.map(l => ({ name: l.name, amount: String(l.amount) })),
  deductions: slip.deductions.map(l => ({ name: l.name, amount: String(l.amount) })),
});

const monthLabel = (m: string) =>
  new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" });

export function Payslips() {
  const [data, setData] = useState<PayslipResponse | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [company, setCompany] = useState<Company>({});
  const [isLoading, setIsLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null); // set while the payslip is being edited
  const [isSaving, setIsSaving] = useState(false);
  const [isEmailing, setIsEmailing] = useState(false);

  const fetchPayslips = useCallback(async (m: string | null) => {
    setDraft(null);
    setIsLoading(true);
    try {
      const res = await api.get<PayslipResponse>(`/payroll/payslips${m ? `?month=${m}` : ""}`, { showLoader: false });
      setData(res);
      setMonth(res.month);
      setSelectedEmpId(prev => (res.payslips.some(p => p.employee_id === prev) ? prev : res.payslips[0]?.employee_id ?? ""));
    } catch {
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Payslip font (also copied into the print frame with the other stylesheets)
  useEffect(() => {
    if (document.getElementById("payslip-font")) return;
    const link = document.createElement("link");
    link.id = "payslip-font";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap";
    document.head.appendChild(link);
  }, []);

  useEffect(() => {
    fetchPayslips(null);
    api.get<Company>("/settings", { showLoader: false }).then(setCompany).catch(() => {});
  }, [fetchPayslips]);

  const payslips = data?.payslips ?? [];
  const slip = payslips.find(p => p.employee_id === selectedEmpId) ?? payslips[0];
  const fileTitle = slip ? `Payslip-${slip.employee.name.replace(/\s+/g, "_")}-${slip.month}` : "Payslip";

  const handleSave = async () => {
    if (!slip || !draft) return;
    const lines = [...draft.earnings, ...draft.deductions];
    if (lines.some(l => l.amount === "" || Number.isNaN(Number(l.amount)) || Number(l.amount) < 0)) {
      toast.error("Every amount must be 0 or more");
      return;
    }
    if (draft.present === "" || Number.isNaN(Number(draft.present)) || Number(draft.present) < 0) {
      toast.error("Present days must be 0 or more");
      return;
    }
    setIsSaving(true);
    try {
      await api.put(`/payroll/payslips/${slip._id}`, {
        employee: { ...draft.employee, joining_date: draft.employee.joining_date || null },
        present_days: Number(draft.present),
        earnings: draft.earnings.map(l => ({ name: l.name, amount: Number(l.amount) })),
        deductions: draft.deductions.map(l => ({ name: l.name, amount: Number(l.amount) })),
      }, { showLoader: false });
      toast.success("Payslip updated");
      await fetchPayslips(slip.month);
    } catch {
      // error toast shown by api
    } finally {
      setIsSaving(false);
    }
  };

  // Email the payslip PDF to the employee's registered email
  const handleEmail = async () => {
    if (!slip) return;
    setIsEmailing(true);
    try {
      const res = await api.post<{ sent_to: string }>(`/payroll/payslips/${slip._id}/email`, {}, { showLoader: false });
      toast.success(`Payslip emailed to ${res.sent_to}`);
    } catch {
      // error toast shown by api
    } finally {
      setIsEmailing(false);
    }
  };

  // Open WhatsApp chat with the employee and a ready payslip summary
  const handleWhatsApp = () => {
    if (!slip) return;
    let phone = (slip.contact?.phone ?? "").replace(/\D/g, "");
    if (phone.length === 10) phone = `91${phone}`;
    if (!phone) {
      toast.error("This employee has no phone number in the Employee List");
      return;
    }
    const text = [
      `*Salary Slip – ${monthLabel(slip.month)}*`,
      `${company.company_name || ""}`.trim(),
      "",
      `Employee: ${slip.employee.name} (${slip.employee.emp_code || "-"})`,
      `Total Earnings: ₹${fmtMoney(slip.total_earnings)}`,
      `Total Deduction: ₹${fmtMoney(slip.total_deductions)}`,
      `*Net Amount: ₹${fmtMoney(slip.net_salary)}*`,
      "",
      `View / download your payslip: ${appUrl()}/payroll/payslips`,
    ].join("\n");
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  };

  // Print / save as PDF only the payslip, on one A4 page with no browser header or footer
  const handlePrint = () => {
    const doc = document.getElementById("payslip-doc");
    if (!doc) return;
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    document.body.appendChild(frame);
    const win = frame.contentWindow;
    const fdoc = frame.contentDocument;
    if (!win || !fdoc) {
      frame.remove();
      return;
    }
    // Same styles as the app (Tailwind) so the table looks identical
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(el => el.outerHTML)
      .join("");
    fdoc.open();
    fdoc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${fileTitle}</title>${styles}
      <style>
        @page { size: A4; margin: 0; }
        html, body { margin: 0; padding: 0; background: #fff; }
        body { padding: 10mm; }
        #payslip-doc { padding: 0 !important; max-width: none !important; box-shadow: none !important; overflow: visible !important; }
        #payslip-doc table { min-width: 0 !important; }
        #payslip-doc td, #payslip-doc th { padding-top: 4px !important; padding-bottom: 4px !important; font-size: 11px !important; }
        #payslip-doc * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      </style></head><body>${doc.outerHTML}</body></html>`);
    fdoc.close();

    const print = () => {
      // Shrink to fit if it is still taller than one A4 page (297mm minus the 10mm margins ≈ 1046px)
      const content = fdoc.getElementById("payslip-doc");
      const height = content?.scrollHeight ?? 0;
      if (content && height > 1046) content.style.zoom = String(1046 / height);
      const previous = document.title;
      document.title = fileTitle; // Chrome names the PDF after the page title
      win.focus();
      win.print();
      document.title = previous;
      setTimeout(() => frame.remove(), 1000);
    };
    // Wait for stylesheets inside the frame before printing
    if (fdoc.readyState === "complete") setTimeout(print, 300);
    else frame.onload = () => setTimeout(print, 300);
  };

  const btn =
    "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border/80 bg-white px-3.5 text-[13px] font-semibold text-foreground/80 shadow-sm transition-colors hover:bg-muted/50 disabled:opacity-50";
  const primaryBtn =
    "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#0c7851] px-4 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-[#00925e] disabled:opacity-50";
  const selectClass =
    "h-9 bg-white border border-border/80 text-[13px] font-semibold text-foreground/80 rounded-lg shadow-sm focus:ring-emerald-500";

  // Employees (no send / edit actions) get the download button next to the month, on one line
  const compactHeader = !data?.can_view_all && !data?.can_edit;

  const header = (
    <div className="mb-6 border-b border-border pb-5 print:hidden">
      {/* Row 1: title + month / employee */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Payslip</h1>
          <p className="mt-0.5 text-xs sm:text-[13px] text-muted-foreground">
            {slip
              ? `Pay period: ${formatDate(slip.period_start)} – ${formatDate(slip.period_end)}`
              : data?.can_view_all ? "Payslips of all employees" : "Your monthly payslips"}
          </p>
        </div>
        {(data?.months.length ?? 0) > 0 && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <SearchableSelect
              value={month ?? ""}
              onChange={(val) => val && fetchPayslips(val)}
              options={(data?.months ?? []).map(m => ({ label: monthLabel(m), value: m }))}
              placeholder="Select month"
              className={`w-full sm:w-[170px] ${selectClass}`}
            />
            {data?.can_view_all && (
              <SearchableSelect
                value={slip?.employee_id ?? ""}
                onChange={(val) => { if (val) { setDraft(null); setSelectedEmpId(val); } }}
                options={payslips.map(p => ({ label: p.employee.name, value: p.employee_id }))}
                placeholder="Select employee"
                className={`w-full sm:w-[220px] ${selectClass}`}
              />
            )}
            {compactHeader && slip && (
              <button onClick={handlePrint} title="Choose “Save as PDF” in the print dialog" className={primaryBtn}>
                <Download className="h-4 w-4" /> Download PDF
              </button>
            )}
          </div>
        )}
      </div>

      {/* Row 2: actions */}
      {slip && !compactHeader && (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          {draft ? (
            <>
              <button onClick={() => setDraft(null)} disabled={isSaving} className={btn}>
                <X className="h-4 w-4" /> Cancel
              </button>
              <button onClick={handleSave} disabled={isSaving} className={primaryBtn}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save Changes
              </button>
            </>
          ) : (
            <>
              {data?.can_edit && (
                <button onClick={() => setDraft(toDraft(slip))} className={btn}>
                  <Pencil className="h-4 w-4" /> Edit
                </button>
              )}
              {/* Sending and printing are for Admin / HR; employees only download their own payslip */}
              {data?.can_view_all && (
              <>
              <button
                onClick={handleEmail}
                disabled={isEmailing}
                title={slip.contact?.email ? `Send PDF to ${slip.contact.email}` : "Send PDF to the employee's email"}
                className={btn}
              >
                {isEmailing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Email
              </button>
              <button
                onClick={handleWhatsApp}
                title={slip.contact?.phone ? `Send on WhatsApp to ${slip.contact.phone}` : "Send on WhatsApp"}
                className={btn}
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </button>
              <span className="mx-1 hidden h-6 w-px bg-border sm:block" />
              <button onClick={handlePrint} className={btn}>
                <Printer className="h-4 w-4" /> Print
              </button>
              </>
              )}
              <button onClick={handlePrint} title="Choose “Save as PDF” in the print dialog" className={primaryBtn}>
                <Download className="h-4 w-4" /> Download PDF
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div className="pb-12 min-w-0">
        {header}
        <div className="py-20 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin inline-block" /></div>
      </div>
    );
  }

  if (!slip) {
    return (
      <div className="pb-12 min-w-0">
        {header}
        <div className="bg-white border border-border/60 rounded-2xl py-16 px-6 text-center shadow-sm">
          <FileText className="h-10 w-10 mx-auto text-muted-foreground/60" />
          <p className="mt-3 text-[15px] font-bold text-foreground">No payslips yet</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {data?.can_view_all
              ? "Lock the month's payroll in Payroll Processing and click Send Payslips to generate them."
              : "Your payslip will appear here once the month's payroll is processed."}
          </p>
        </div>
      </div>
    );
  }

  const companyName = company.company_name || "Company";
  const slipMonth = new Date(Number(slip.month.slice(0, 4)), Number(slip.month.slice(5, 7)) - 1, 1)
    .toLocaleString("en-IN", { month: "long" }).toUpperCase() + `-${slip.month.slice(0, 4)}`;
  const editing = draft !== null;
  const earnings = draft ? draft.earnings.map(l => ({ name: l.name, amount: Number(l.amount) || 0 })) : slip.earnings;
  const deductions = draft ? draft.deductions.map(l => ({ name: l.name, amount: Number(l.amount) || 0 })) : slip.deductions;
  const totalEarnings = draft ? earnings.reduce((t, l) => t + l.amount, 0) : slip.total_earnings;
  const totalDeductions = draft ? deductions.reduce((t, l) => t + l.amount, 0) : slip.total_deductions;
  const netSalary = draft ? Math.max(0, totalEarnings - totalDeductions) : slip.net_salary;
  const account = draft ? draft.employee.account : slip.employee.account;

  type DetailField = keyof EmployeeDraft | null;
  const details: [string, string | undefined | null, DetailField, string, string | undefined | null, DetailField][] = [
    ["Employee ID", slip.employee.emp_code, null, "Location", companyCity(company.company_address), null],
    ["Income Tax Number (PAN)", slip.employee.pan, "pan", "Bank Details", slip.employee.bank_name, "bank_name"],
    ["Designation", slip.employee.designation, "designation", "A/C.NO:", slip.employee.account, "account"],
    ["Date of Joining", joiningDate(slip.employee.joining_date), "joining_date", "IFSC", slip.employee.ifsc, "ifsc"],
  ];
  // Earnings and deductions side by side, one line per row
  const rows = Math.max(earnings.length, deductions.length);
  const hasBank = Boolean(account);

  const cell = "border border-black px-3 py-1.5";
  const inputClass = "w-full bg-amber-50 border border-amber-300 rounded px-1.5 py-0.5 text-[13px] outline-none focus:border-emerald-500";

  const setEmployee = (key: keyof EmployeeDraft, value: string) =>
    setDraft(d => (d ? { ...d, employee: { ...d.employee, [key]: value } } : d));
  const setLine = (kind: "earnings" | "deductions", i: number, value: string) =>
    setDraft(d => (d ? { ...d, [kind]: d[kind].map((l, j) => (j === i ? { ...l, amount: value } : l)) } : d));

  const detailValue = (value: string | undefined | null, field: DetailField) =>
    draft && field ? (
      <input
        type={field === "joining_date" ? "date" : "text"}
        value={draft.employee[field]}
        onChange={e => setEmployee(field, e.target.value)}
        className={inputClass}
      />
    ) : (
      value || "—"
    );
  const amountValue = (kind: "earnings" | "deductions", i: number, amount: number) =>
    draft ? (
      <input
        type="number"
        min="0"
        step="0.01"
        value={draft[kind][i]?.amount ?? ""}
        onChange={e => setLine(kind, i, e.target.value)}
        className={`${inputClass} text-right`}
      />
    ) : (
      fmtAmount(amount)
    );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12 min-w-0">
      {header}

      {editing && (
        <p className="mb-3 text-[13px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Editing — change the highlighted fields, totals update automatically. Click Save Changes when done.
        </p>
      )}

      {/* Payslip Document */}
      <div
        id="payslip-doc"
        className="mx-auto w-full max-w-[900px] bg-white px-3 py-4 sm:px-6 sm:py-6 shadow-sm min-w-0 overflow-x-auto"
        style={{ fontFamily: "'Poppins', ui-sans-serif, system-ui, sans-serif" }}
      >
        <table className="w-full min-w-[600px] border-collapse border-2 border-black text-[13px] text-black">
          <colgroup>
            <col className="w-[30%]" />
            <col className="w-[22%]" />
            <col className="w-[30%]" />
            <col className="w-[18%]" />
          </colgroup>
          <tbody>
            {/* Company header */}
            <tr><td colSpan={4} className={`${cell} text-center text-[15px] font-bold uppercase bg-slate-50`}>{companyName}</td></tr>
            {company.company_address && (
              <tr><td colSpan={4} className={`${cell} text-center text-[12px] font-semibold uppercase bg-slate-50`}>{shortAddress(company.company_address)}</td></tr>
            )}
            {company.company_gstin && (
              <tr><td colSpan={4} className={`${cell} text-center text-[12px] font-semibold bg-slate-50`}>GSTIN: {company.company_gstin}</td></tr>
            )}
            <tr><td colSpan={4} className={`${cell} text-center text-[14px] font-semibold`}>Salary Slip</td></tr>
            <tr><td colSpan={4} className={`${cell} text-center text-[12px] font-semibold`}>For {slipMonth}</td></tr>
            <tr><td colSpan={4} className={`${cell} text-center text-[15px] font-bold bg-slate-50`}>{slip.employee.name}</td></tr>

            {/* Employee details */}
            {details.map(([l1, v1, f1, l2, v2, f2]) => (
              <tr key={l1}>
                <td className={`${cell} font-semibold`}>{l1}</td>
                <td className={cell}>{detailValue(v1, f1)}</td>
                <td className={`${cell} font-semibold`}>{l2}</td>
                <td className={`${cell} ${l2 === "Location" ? "" : "font-semibold"}`}>{detailValue(v2, f2)}</td>
              </tr>
            ))}

            {/* Attendance */}
            <tr>
              <td colSpan={3} className={`${cell} font-semibold`}>Attendance Details</td>
              <td className={cell}></td>
            </tr>
            <tr>
              <td colSpan={3} className={cell}>Present Days</td>
              <td className={`${cell} text-center font-bold`}>
                {draft ? (
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={draft.present}
                    onChange={e => setDraft(d => (d ? { ...d, present: e.target.value } : d))}
                    className={`${inputClass} text-center`}
                  />
                ) : (
                  fmtAmount(slip.attendance.present)
                )}
              </td>
            </tr>

            {/* Earnings & deductions */}
            <tr className="bg-slate-100">
              <th className={`${cell} border-b-2 text-center font-bold`}>EARNINGS</th>
              <th className={`${cell} border-b-2 text-center font-bold`}>AMOUNT</th>
              <th className={`${cell} border-b-2 text-center font-bold`}>DEDUCTION</th>
              <th className={`${cell} border-b-2 text-center font-bold`}>AMOUNT</th>
            </tr>
            {Array.from({ length: rows }, (_, i) => {
              const e = earnings[i];
              const d = deductions[i];
              return (
                <tr key={i}>
                  <td className={cell}>{e?.name ?? ""}</td>
                  <td className={`${cell} text-right`}>{e ? amountValue("earnings", i, e.amount) : ""}</td>
                  <td className={`${cell} text-rose-600`}>{d?.name ?? ""}</td>
                  <td className={`${cell} text-right text-rose-600`}>{d ? amountValue("deductions", i, d.amount) : ""}</td>
                </tr>
              );
            })}
            <tr>
              <td className={`${cell} border-b-2 font-bold`}>Total Earnings</td>
              <td className={`${cell} border-b-2 text-right font-bold`}>{fmtAmount(totalEarnings)}</td>
              <td className={`${cell} border-b-2 font-bold`}>Total Deduction</td>
              <td className={`${cell} border-b-2 text-right font-bold`}>{fmtAmount(totalDeductions)}</td>
            </tr>
            <tr>
              <td colSpan={2} className={cell}></td>
              <td className={`${cell} bg-slate-100 font-bold text-emerald-600`}>NET AMOUNT</td>
              <td className={`${cell} bg-slate-100 text-right font-bold text-emerald-600`}>{fmtAmount(netSalary)}</td>
            </tr>

            {/* Amount in words, payment mode & signatory */}
            <tr>
              <td colSpan={2} className={`${cell} align-top py-4`}>
                <p className="font-bold">Amount (in words)</p>
                <p className="italic text-[12px] mt-0.5">Rupees {amountInWords(netSalary)} Only</p>
                <table className="mt-5 w-full border-collapse text-[12px]">
                  <thead>
                    <tr>
                      <th className="border border-black px-3 py-1.5 text-left font-bold">Mode</th>
                      <th className="border border-black px-3 py-1.5 text-center font-bold">A/C / Chq.No.</th>
                      <th className="border border-black px-3 py-1.5 text-right font-bold">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-black px-3 py-1.5 font-bold">Bank Transfer</td>
                      <td className="border border-black px-3 py-1.5 text-center">{account || "-"}</td>
                      <td className="border border-black px-3 py-1.5 text-right font-bold">{fmtMoney(hasBank ? netSalary : 0)}</td>
                    </tr>
                    <tr>
                      <td className="border border-black px-3 py-1.5 font-bold">Cash</td>
                      <td className="border border-black px-3 py-1.5 text-center">-</td>
                      <td className="border border-black px-3 py-1.5 text-right font-bold">{fmtMoney(hasBank ? 0 : netSalary)}</td>
                    </tr>
                    <tr>
                      <td colSpan={2} className="border border-black px-3 py-1.5 text-right font-bold">TOTAL</td>
                      <td className="border border-black px-3 py-1.5 text-right font-bold">{fmtMoney(netSalary)}</td>
                    </tr>
                  </tbody>
                </table>
              </td>
              <td colSpan={2} className={`${cell} align-top py-6 px-6`}>
                <p className="font-bold uppercase tracking-wide">For {companyName}</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>
  );
}

/**
 * Public HRMS address for links sent to employees: the site the payslip is sent from
 * (e.g. https://new-hrms.hkdigiverse.com on live). From localhost, VITE_APP_URL is used when set.
 */
const appUrl = () => {
  const host = window.location.hostname;
  const isLocal = host === "localhost" || host === "127.0.0.1";
  const configured = String(import.meta.env["VITE_APP_URL"] || "").trim();
  return (isLocal && configured ? configured : window.location.origin).replace(/\/+$/, "");
};

/** City from the company address, e.g. "..., KATARGAM, SURAT- 395004, Gujarat" -> "SURAT" */
const companyCity = (address?: string) => {
  const match = (address ?? "").match(/([A-Za-z][A-Za-z .]*?)\s*-?\s*\d{6}/);
  return match?.[1]?.split(",").pop()?.trim().toUpperCase() ?? "";
};

/** City, state and country from the company address, e.g. "..., SURAT- 395004, Gujarat, INDIA" -> "SURAT, GUJARAT, INDIA" */
const shortAddress = (address?: string) => {
  const text = (address ?? "").trim();
  const match = text.match(/\d{6}\s*,?\s*(.*)$/);
  const city = companyCity(text);
  if (!match || !city) return text;
  const rest = (match[1] ?? "").split(",").map(p => p.replace(/\.+$/, "").trim()).filter(Boolean);
  return [city, ...rest].join(", ").toUpperCase();
};

/** DD/MM/YYYY */
const joiningDate = (d?: string | null) => {
  if (!d) return "";
  const [y, m, day] = d.slice(0, 10).split("-");
  return y && m && day ? `${day}/${m}/${y}` : d;
};

const fmtAmount = (n?: number | null) => Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const fmtMoney = (n?: number | null) =>
  Number(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
  "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function belowHundred(n: number): string {
  return n < 20 ? ONES[n] ?? "" : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`;
}

function belowThousand(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? `${ONES[h]} Hundred` : "", r ? belowHundred(r) : ""].filter(Boolean).join(" ");
}

/** Indian numbering (Lakh / Crore), e.g. 93596.5 -> "Ninety Three Thousand Five Hundred Ninety Six and Fifty Paise" */
function amountInWords(amount: number): string {
  const rupees = Math.floor(Math.max(0, amount));
  const paise = Math.round((Math.max(0, amount) - rupees) * 100);
  const parts: string[] = [];
  let n = rupees;
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  if (crore) parts.push(`${belowThousand(crore)} Crore`);
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`);
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`);
  if (n) parts.push(belowThousand(n));
  const words = parts.join(" ") || "Zero";
  return paise ? `${words} and ${belowHundred(paise)} Paise` : words;
}
