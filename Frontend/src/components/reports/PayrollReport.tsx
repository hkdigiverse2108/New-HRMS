import { IndianRupee, TrendingUp, TrendingDown, Landmark, Building2, Wallet } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, Cell, ComposedChart, Line } from 'recharts';
import { useState } from 'react';
import { SearchableSelect } from '@/components/ui/select';

const payrollTrend = [
  { name: 'Jan', Base: 950000, Bonuses: 120000, Deductions: -45000 },
  { name: 'Feb', Base: 950000, Bonuses: 90000, Deductions: -42000 },
  { name: 'Mar', Base: 980000, Bonuses: 250000, Deductions: -50000 }, // Q1 Bonus
  { name: 'Apr', Base: 1050000, Bonuses: 85000, Deductions: -55000 },
  { name: 'May', Base: 1050000, Bonuses: 95000, Deductions: -52000 },
  { name: 'Jun', Base: 1080000, Bonuses: 320000, Deductions: -58000 }, // Q2 Bonus
];

const departmentCost = [
  { name: 'Engineering', value: 850000 },
  { name: 'Sales', value: 350000 },
  { name: 'Marketing', value: 200000 },
  { name: 'HR', value: 120000 },
  { name: 'Operations', value: 250000 },
];
const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

export function PayrollReport() {
  const [timeRange, setTimeRange] = useState("Last 6 Months");

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
            <IndianRupee className="w-8 h-8 text-primary" />
            Payroll Cost Analytics
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            Analyze HR expenses, salary distributions, and department-wise payroll costs.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SearchableSelect
            value={timeRange}
            onChange={setTimeRange}
            options={[
              { label: "Last 6 Months", value: "Last 6 Months" },
              { label: "This Year", value: "This Year" },
              { label: "Last Year", value: "Last Year" }
            ]}
            className="w-[180px] h-[44px] bg-card border border-border/50 text-foreground font-bold rounded-xl shadow-sm outline-none"
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <Landmark className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded-md flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> YTD
            </span>
          </div>
          <div className="text-emerald-600 font-bold text-xs uppercase tracking-wider mb-1">Total Gross Pay</div>
          <div className="text-3xl font-black text-emerald-700">₹ 8.24M</div>
        </div>

        <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded-md flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> YTD
            </span>
          </div>
          <div className="text-blue-600 font-bold text-xs uppercase tracking-wider mb-1">Total Net Pay</div>
          <div className="text-3xl font-black text-blue-700">₹ 7.82M</div>
        </div>

        <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <div className="text-rose-600 font-bold text-xs uppercase tracking-wider mb-1">Total Deductions</div>
          <div className="text-3xl font-black text-rose-700">₹ 420K</div>
        </div>

        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="text-amber-600 font-bold text-xs uppercase tracking-wider mb-1">Total Bonuses</div>
          <div className="text-3xl font-black text-amber-700">₹ 960K</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        
        {/* Payroll Trend */}
        <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm lg:col-span-2">
          <h3 className="font-bold flex items-center gap-2 mb-6">
            <IndianRupee className="w-5 h-5 text-primary" />
            Payroll Cost Breakdown (Monthly)
          </h3>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={payrollTrend} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} dy={10} />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} 
                  tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "12px", color: "var(--foreground)", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)", padding: "12px" }}
                  labelStyle={{ color: "var(--muted-foreground)", marginBottom: "4px", fontWeight: "bold" }}
                  itemStyle={{ fontWeight: "bold" }}
                  cursor={{ fill: "var(--muted)", opacity: 0.2 }}
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey="Base" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Bonuses" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="Deductions" stroke="var(--destructive)" strokeWidth={3} dot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Dept Breakdown */}
        <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm">
          <h3 className="font-bold flex items-center gap-2 mb-6">
            <Building2 className="w-5 h-5 text-blue-500" />
            Cost by Department
          </h3>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={departmentCost} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} type="category" width={100} />
                <Tooltip 
                  cursor={{ fill: 'var(--muted)', opacity: 0.5 }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0]?.payload;
                      const color = payload[0]?.color || payload[0]?.fill;
                      if (!data) return null;
                      return (
                        <div className="bg-card border border-border p-3 rounded-xl shadow-sm" style={{ color }}>
                          <p className="font-bold text-sm mb-1">{data.name}</p>
                          <p className="font-medium text-sm">Cost: ₹ {data.value.toLocaleString()}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={24}>
                  {departmentCost.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

    </div>
  );
}
