import { 
  IndianRupee, 
  Users, 
  Clock, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight,
  ShieldCheck,
  History
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
  ResponsiveContainer 
} from "recharts";
import { cn } from "@/lib/utils";
import { MOCK_PAYROLL_TRENDS, MOCK_DEPARTMENT_COSTS, MOCK_AUDIT_LOGS } from "./payroll-data";

export function PayrollDashboard() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-black tracking-tight">Payroll Dashboard</h1>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">July 2026</span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Track salary expense, pending approvals and payroll analytics.</p>
      </div>

      {/* Main Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Metric 1 */}
        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-emerald-900">Current Month Payroll</h3>
            <div className="rounded-lg bg-emerald-200/50 p-2 text-emerald-700">
              <IndianRupee className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-3xl font-black text-emerald-950">₹4,16,981</p>
            <p className="mt-1 text-xs font-medium text-emerald-700">Net payable · July 2026</p>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-muted-foreground">Total Salary Expense</h3>
            <div className="rounded-lg bg-muted p-2 text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-3xl font-black">₹4,22,000</p>
            <p className="mt-1 text-xs font-medium text-muted-foreground">Gross of all employees</p>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-muted-foreground">Employees Paid</h3>
            <div className="rounded-lg bg-muted p-2 text-muted-foreground">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-3xl font-black">6 <span className="text-lg text-muted-foreground font-medium">/ 8</span></p>
            <p className="mt-1 text-xs font-medium text-amber-600">2 pending approval</p>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-muted-foreground">Pending Payroll</h3>
            <div className="rounded-lg bg-amber-100 p-2 text-amber-600">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-3xl font-black">2</p>
            <p className="mt-1 text-xs font-medium text-muted-foreground">Awaiting CEO approval</p>
          </div>
        </div>
      </div>

      {/* Secondary Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Average Salary", value: "₹52,750", sub: "Company average", icon: IndianRupee },
          { label: "Highest Salary", value: "₹92,000", sub: "HKD-001 · Engineering", icon: ArrowUpRight, color: "text-emerald-600" },
          { label: "Lowest Salary", value: "₹22,000", sub: "HKD-008 · Operations", icon: ArrowDownRight, color: "text-rose-600" },
          { label: "Upcoming Salary Date", value: "01 Aug", sub: "Auto-credit via bank file", icon: Clock },
        ].map((stat, i) => (
          <div key={i} className="flex items-center gap-4 rounded-xl border border-border bg-white p-4">
            <div className="rounded-full bg-muted p-2">
              <stat.icon className={cn("h-4 w-4", stat.color || "text-muted-foreground")} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-muted-foreground">{stat.label}</p>
              <p className="text-lg font-black leading-none mt-1">{stat.value}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">{stat.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts & Audit Log */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Charts Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Trend Chart */}
          <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="font-bold">Payroll Cost Trend</h3>
                <p className="text-xs text-muted-foreground">Monthly payroll expense in ₹ lakhs</p>
              </div>
            </div>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={MOCK_PAYROLL_TRENDS} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value) => [`₹${value}L`, "Cost"]}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="cost" 
                    stroke="#10b981" 
                    strokeWidth={3}
                    dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Department Chart */}
          <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="font-bold">Department Salary Cost</h3>
                <p className="text-xs text-muted-foreground">Gross monthly cost in ₹ thousands</p>
              </div>
            </div>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={MOCK_DEPARTMENT_COSTS} margin={{ top: 5, right: 10, left: 0, bottom: 0 }} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} type="category" />
                  <Tooltip 
                    cursor={{ fill: '#f3f4f6' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value) => [`₹${value}k`, "Cost"]}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {MOCK_DEPARTMENT_COSTS.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Quick Stats & Audit Log */}
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-border bg-white p-4">
              <p className="text-xs text-muted-foreground">Bonus Given</p>
              <p className="mt-1 text-xl font-bold text-emerald-600">₹31,000</p>
              <p className="text-[10px] text-muted-foreground mt-1">July 2026</p>
            </div>
            <div className="rounded-xl border border-border bg-white p-4">
              <p className="text-xs text-muted-foreground">Total Deduction</p>
              <p className="mt-1 text-xl font-bold text-rose-600">₹52,349</p>
              <p className="text-[10px] text-muted-foreground mt-1">PF, TDS, PT, etc.</p>
            </div>
            <div className="rounded-xl border border-border bg-white p-4">
              <p className="text-xs text-muted-foreground">Headcount</p>
              <p className="mt-1 text-xl font-bold">8</p>
              <p className="text-[10px] text-muted-foreground mt-1">Active + notice</p>
            </div>
            <div className="rounded-xl border border-border bg-white p-4">
              <p className="text-xs text-muted-foreground">Salary Growth</p>
              <p className="mt-1 text-xl font-bold text-emerald-600">+9.4%</p>
              <p className="text-[10px] text-muted-foreground mt-1">FY26 Avg</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-emerald-600" />
                <h3 className="font-bold">Audit Log</h3>
              </div>
            </div>
            <div className="relative space-y-6 before:absolute before:inset-y-0 before:left-2.5 before:w-px before:bg-border">
              {MOCK_AUDIT_LOGS.map((log, i) => (
                <div key={log.id} className="relative pl-8">
                  <div className="absolute left-0 top-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-emerald-100">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                  </div>
                  <p className="text-sm font-medium leading-tight">{log.action}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {log.by} · {log.date}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
