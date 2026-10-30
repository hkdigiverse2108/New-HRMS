import { useState, useEffect, useCallback } from "react";
import {
  IndianRupee,
  Users,
  Clock,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  History,
  Loader2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { cn, formatDate } from "@/lib/utils";
import { api } from "@/lib/api";
import { formatCurrency } from "./payroll-data";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type Stage = "not_generated" | "generated" | "approved" | "locked";

interface SalaryPoint {
  amount: number;
  name: string;
  department: string;
}

interface DashboardData {
  month: string;
  is_current_month: boolean;
  status: Stage;
  calendar: { working_days?: number; counted_until?: string };
  metrics: {
    net_payable: number;
    earned: number;
    monthly_gross: number;
    total_bonus: number;
    total_deduction: number;
    not_due: number;
    employees_on_payroll: number;
    headcount: number;
    without_salary: number;
    payslips_sent: number;
    review: { verified: number; pending: number; on_hold: number };
  };
  salary: {
    average: number;
    highest: SalaryPoint | null;
    lowest: SalaryPoint | null;
    revisions_this_year: number;
  };
  pending: { salary_revisions: number; bonus_deductions: number; employee_reviews: number };
  next_salary_date: string | null;
  trend: { month: string; label: string; net: number; earned: number; status: Stage }[];
  departments: { department: string; gross: number; net: number; employees: number }[];
  audit_log: { action: string; by: string; at: string }[];
}

const SERIES = "#10b981";

const compactRupees = (n: number) =>
  n >= 100000 ? `₹${+(n / 100000).toFixed(1)}L` : n >= 1000 ? `₹${+(n / 1000).toFixed(1)}k` : `₹${Math.round(n)}`;
const DEPT_COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8", "#FF6B9A"];

const dayMonth = (d: string) =>
  new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const monthLabel = (m: string) =>
  new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" });

export function PayrollDashboard() {
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    setIsLoading(true);
    try {
      setData(await api.get<DashboardData>(`/payroll/dashboard?month=${month}`, { showLoader: false }));
    } catch {
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [month]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const [allLogsOpen, setAllLogsOpen] = useState(false);
  const [allLogs, setAllLogs] = useState<DashboardData["audit_log"] | null>(null);

  const openAllLogs = async () => {
    setAllLogsOpen(true);
    setAllLogs(null);
    try {
      setAllLogs(await api.get<DashboardData["audit_log"]>("/payroll/audit-log", { showLoader: false }));
    } catch {
      setAllLogs([]);
    }
  };

  const m = data?.metrics;
  const pendingTotal = data ? data.pending.salary_revisions + data.pending.bonus_deductions + data.pending.employee_reviews : 0;
  const shortMonth = monthLabel(month);
  const trend = data?.trend ?? [];
  const trendCost = trend.map(t => ({ month: t.label.slice(0, 3), full: t.label, cost: Math.round(t.earned), status: t.status }));
  const deptThousands = (data?.departments ?? []).map((d, i) => ({
    name: d.department,
    value: Math.round(d.gross / 100) / 10,
    color: DEPT_COLORS[i % DEPT_COLORS.length],
  }));
  const lastCost = trend[trend.length - 1]?.earned ?? 0;
  const prevCost = trend[trend.length - 2]?.earned ?? 0;
  const salaryGrowth = prevCost > 0 ? ((lastCost - prevCost) / prevCost) * 100 : null;

  return (
    <div className="w-full min-w-0 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Payroll Dashboard</h1>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">{shortMonth}</span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">Track salary expense, pending approvals and payroll analytics.</p>
        </div>
        <input
          type="month"
          value={month}
          onChange={e => e.target.value && setMonth(e.target.value)}
          className="h-[38px] w-full sm:w-auto shrink-0 px-3 py-2 rounded-lg border border-border/80 bg-white text-[13px] font-semibold text-foreground/80 shadow-sm outline-none focus:border-emerald-500"
        />
      </div>

      {isLoading || !data || !m ? (
        <div className="py-24 text-center text-muted-foreground">
          {isLoading ? <Loader2 className="h-6 w-6 animate-spin inline-block" /> : "Could not load payroll dashboard."}
        </div>
      ) : (
        <>
          {/* Main Metrics */}
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
            <div className="min-w-0 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-emerald-900">Current Month Payroll</h3>
                <div className="rounded-lg bg-emerald-200/50 p-2 text-emerald-700"><IndianRupee className="h-4 w-4" /></div>
              </div>
              <p className="mt-3 sm:mt-4 text-xl sm:text-2xl xl:text-3xl font-black text-emerald-950 break-words">{formatCurrency(m.net_payable)}</p>
              <p className="mt-1 text-xs font-medium text-emerald-700">Net payable · {shortMonth}</p>
            </div>

            <MetricCard
              title="Total Salary Expense"
              icon={TrendingUp}
              value={formatCurrency(m.monthly_gross)}
              sub="Gross of all employees"
            />

            <MetricCard
              title="Employees Paid"
              icon={Users}
              value={<>{m.employees_on_payroll} <span className="text-lg text-muted-foreground font-medium">/ {m.headcount}</span></>}
              sub={m.without_salary ? `${m.without_salary} without salary` : "Everyone has a salary set"}
              subClass={m.without_salary ? "text-amber-600" : undefined}
            />

            <MetricCard
              title="Pending Payroll"
              icon={Clock}
              iconClass="bg-amber-100 text-amber-600"
              value={String(pendingTotal)}
              sub={pendingTotal ? "Awaiting approval" : "Nothing waiting for approval"}
            />
          </div>

          {/* Secondary Metrics */}
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Average Salary", value: formatCurrency(data.salary.average), sub: "Company average", icon: IndianRupee },
              {
                label: "Highest Salary",
                value: data.salary.highest ? formatCurrency(data.salary.highest.amount) : "—",
                sub: data.salary.highest ? [data.salary.highest.name, data.salary.highest.department].filter(Boolean).join(" · ") : "No salaries set",
                icon: ArrowUpRight,
                color: "text-emerald-600",
              },
              {
                label: "Lowest Salary",
                value: data.salary.lowest ? formatCurrency(data.salary.lowest.amount) : "—",
                sub: data.salary.lowest ? [data.salary.lowest.name, data.salary.lowest.department].filter(Boolean).join(" · ") : "No salaries set",
                icon: ArrowDownRight,
                color: "text-rose-600",
              },
              {
                label: "Upcoming Salary Date",
                value: data.next_salary_date ? dayMonth(data.next_salary_date) : "Not set",
                sub: data.next_salary_date ? "From Payroll Settings" : "Set it in Payroll Settings",
                icon: Clock,
              },
            ].map(stat => (
              <div key={stat.label} className="flex items-center gap-3 sm:gap-4 rounded-xl border border-border bg-white p-3 sm:p-4 min-w-0">
                <div className="rounded-full bg-muted p-2 shrink-0">
                  <stat.icon className={cn("h-4 w-4", stat.color || "text-muted-foreground")} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase text-muted-foreground">{stat.label}</p>
                  <p className="text-base sm:text-lg font-black leading-tight mt-1 break-words">{stat.value}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground truncate">{stat.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Charts & Audit Log */}
          <div className="grid gap-4 sm:gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2 space-y-4 sm:space-y-6 min-w-0">
              {/* Trend Chart */}
              <div className="rounded-2xl border border-border bg-white p-4 sm:p-6 shadow-sm min-w-0 overflow-hidden">
                <div className="mb-4 sm:mb-6">
                  <h3 className="font-bold">Payroll Cost Trend</h3>
                  <p className="text-xs text-muted-foreground">Monthly payroll expense · last 6 months</p>
                </div>
                <div className="h-[220px] sm:h-[260px] w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendCost} margin={{ top: 5, right: 10, left: 0, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} width={50} allowDecimals={false} tickFormatter={compactRupees} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                      <Tooltip
                        contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                        labelFormatter={(l: string) => trendCost.find(t => t.month === l)?.full ?? l}
                        formatter={(value: number, _n, item) => {
                          const status = (item?.payload as { status: Stage }).status;
                          return [`${formatCurrency(value)}${status === "not_generated" ? " (preview)" : ""}`, "Cost"];
                        }}
                      />
                      <Line type="monotone" dataKey="cost" stroke={SERIES} strokeWidth={3} dot={{ fill: SERIES, strokeWidth: 2, r: 4 }} activeDot={{ r: 6, strokeWidth: 0 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Department Chart */}
              <div className="rounded-2xl border border-border bg-white p-4 sm:p-6 shadow-sm min-w-0 overflow-hidden">
                <div className="mb-4 sm:mb-6">
                  <h3 className="font-bold">Department Salary Cost</h3>
                  <p className="text-xs text-muted-foreground">Gross monthly cost in ₹ thousands</p>
                </div>
                {data.departments.length === 0 ? (
                  <p className="py-16 text-center text-sm text-muted-foreground">No employees with a salary this month.</p>
                ) : (
                  <div className="h-[220px] sm:h-[260px] w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={deptThousands} margin={{ top: 5, right: 10, left: 0, bottom: 0 }} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#6b7280" }} />
                        <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={84} tickFormatter={(v: string) => (v.length > 11 ? `${v.slice(0, 10)}…` : v)} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                        <Tooltip
                          cursor={{ fill: "#f3f4f6" }}
                          contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                          formatter={(value: number) => [`₹${value}k`, "Cost"]}
                        />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                          {deptThousands.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Stats & Audit Log */}
            <div className="space-y-4 sm:space-y-6 min-w-0">
              <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-2 gap-3 sm:gap-4">
                <QuickStat label="Bonus Given" value={formatCurrency(m.total_bonus)} valueClass="text-emerald-600" sub={shortMonth} />
                <QuickStat
                  label="Total Deduction"
                  value={formatCurrency(m.total_deduction)}
                  valueClass="text-rose-600"
                  sub="LOP, PF, PT, penalties, etc."
                />
                <QuickStat label="Headcount" value={String(m.headcount)} sub="Active employees" />
                <QuickStat
                  label="Salary Growth"
                  value={salaryGrowth === null ? "—" : `${salaryGrowth >= 0 ? "+" : ""}${salaryGrowth.toFixed(1)}%`}
                  valueClass={salaryGrowth !== null && salaryGrowth < 0 ? "text-rose-600" : "text-emerald-600"}
                  sub="Payroll cost vs last month"
                />
              </div>

              <div className="rounded-2xl border border-border bg-white p-4 sm:p-6 shadow-sm min-w-0">
                <div className="mb-4 sm:mb-6 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <History className="h-5 w-5 text-emerald-600" />
                    <h3 className="font-bold">Audit Log</h3>
                  </div>
                  {data.audit_log.length > 0 && (
                    <button
                      type="button"
                      onClick={openAllLogs}
                      className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
                    >
                      View all
                    </button>
                  )}
                </div>
                {data.audit_log.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No payroll activity yet.</p>
                ) : (
                  <AuditTimeline logs={data.audit_log} />
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <Dialog open={allLogsOpen} onOpenChange={setAllLogsOpen}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <History className="h-5 w-5 text-emerald-600" />
              Audit Log
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              All payroll activity, newest first{allLogs ? ` · ${allLogs.length} entries` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto pr-1 py-1">
            {allLogs === null ? (
              <div className="py-12 text-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin inline-block" />
              </div>
            ) : allLogs.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No payroll activity yet.</p>
            ) : (
              <AuditTimeline logs={allLogs} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AuditTimeline({ logs }: { logs: DashboardData["audit_log"] }) {
  return (
    <div className="relative space-y-6 before:absolute before:inset-y-0 before:left-2.5 before:w-px before:bg-border">
      {logs.map((log, i) => (
        <div key={`${log.at}-${i}`} className="relative pl-8">
          <div className="absolute left-0 top-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-emerald-100">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
          </div>
          <p className="text-sm font-medium leading-tight break-words">{log.action}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {[log.by, formatDate(log.at)].filter(Boolean).join(" · ")}
          </p>
        </div>
      ))}
    </div>
  );
}

function MetricCard({ title, icon: Icon, iconClass, value, sub, subClass }: {
  title: string;
  icon: typeof Users;
  iconClass?: string | undefined;
  value: React.ReactNode;
  sub: string;
  subClass?: string | undefined;
}) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4 sm:p-5 shadow-sm min-w-0">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-muted-foreground">{title}</h3>
        <div className={cn("rounded-lg p-2", iconClass || "bg-muted text-muted-foreground")}><Icon className="h-4 w-4" /></div>
      </div>
      <p className="mt-3 sm:mt-4 text-xl sm:text-2xl xl:text-3xl font-black break-words">{value}</p>
      <p className={cn("mt-1 text-xs font-medium text-muted-foreground", subClass)}>{sub}</p>
    </div>
  );
}

function QuickStat({ label, value, sub, valueClass }: { label: string; value: string; sub: string; valueClass?: string | undefined }) {
  return (
    <div className="rounded-xl border border-border bg-white p-4 min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-lg sm:text-xl font-bold break-words", valueClass)}>{value}</p>
      <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>
    </div>
  );
}
