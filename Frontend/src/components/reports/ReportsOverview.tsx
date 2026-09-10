import { BarChart3, TrendingUp, Users, UserPlus, Briefcase, Activity } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, LineChart, Line } from 'recharts';
import { useState } from 'react';
import { SearchableSelect } from '@/components/ui/select';

const payrollData = [
  { name: 'Jan', value: 1200000 },
  { name: 'Feb', value: 1250000 },
  { name: 'Mar', value: 1300000 },
  { name: 'Apr', value: 1280000 },
  { name: 'May', value: 1400000 },
  { name: 'Jun', value: 1450000 },
];

const hiringData = [
  { name: 'Jan', value: 4 },
  { name: 'Feb', value: 7 },
  { name: 'Mar', value: 5 },
  { name: 'Apr', value: 12 },
  { name: 'May', value: 8 },
  { name: 'Jun', value: 15 },
];

const attendanceData = [
  { name: 'Mon', value: 95 },
  { name: 'Tue', value: 92 },
  { name: 'Wed', value: 88 },
  { name: 'Thu', value: 94 },
  { name: 'Fri', value: 96 },
];

export function ReportsOverview() {
  const [timeRange, setTimeRange] = useState("Last 6 Months");

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
            <BarChart3 className="w-8 h-8 text-primary" />
            Reports & Analytics Overview
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            High-level metrics across Payroll, Hiring, Attendance, and Operations.
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
        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded-md flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> +12%
            </span>
          </div>
          <div className="text-muted-foreground font-bold text-xs uppercase tracking-wider mb-1">Total Headcount</div>
          <div className="text-3xl font-black">1,248</div>
        </div>

        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-rose-600 bg-rose-500/10 px-2 py-1 rounded-md flex items-center gap-1">
              <TrendingUp className="w-3 h-3 rotate-180" /> -2%
            </span>
          </div>
          <div className="text-muted-foreground font-bold text-xs uppercase tracking-wider mb-1">Monthly Payroll</div>
          <div className="text-3xl font-black">₹ 14.5M</div>
        </div>

        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded-md flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> +5%
            </span>
          </div>
          <div className="text-muted-foreground font-bold text-xs uppercase tracking-wider mb-1">Active Openings</div>
          <div className="text-3xl font-black">42</div>
        </div>

        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded-md flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> +1%
            </span>
          </div>
          <div className="text-muted-foreground font-bold text-xs uppercase tracking-wider mb-1">Avg Attendance</div>
          <div className="text-3xl font-black">94.2%</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        
        {/* Payroll Trend */}
        <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm">
          <h3 className="font-bold flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-emerald-500" />
            Payroll Trend (6 Months)
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={payrollData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} dy={10} />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                  tickFormatter={(val) => `₹${(val / 1000000).toFixed(1)}M`}
                />
                <Tooltip 
                  formatter={(val: number) => `₹${(val / 1000).toLocaleString()}k`}
                  contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "12px", color: "var(--foreground)", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)", padding: "12px" }}
                  labelStyle={{ color: "var(--muted-foreground)", marginBottom: "4px", fontWeight: "bold" }}
                  itemStyle={{ fontWeight: "bold" }}
                  cursor={{ fill: "var(--muted)", opacity: 0.2 }}
                />
                <Area type="monotone" name="Payroll" dataKey="value" stroke="var(--chart-1)" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Hiring Trend */}
        <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm">
          <h3 className="font-bold flex items-center gap-2 mb-6">
            <UserPlus className="w-5 h-5 text-amber-500" />
            New Hires (6 Months)
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hiringData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "12px", color: "var(--foreground)", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)", padding: "12px" }}
                  labelStyle={{ color: "var(--muted-foreground)", marginBottom: "4px", fontWeight: "bold" }}
                  itemStyle={{ fontWeight: "bold" }}
                  cursor={{ fill: "var(--muted)", opacity: 0.2 }}
                />
                <Bar dataKey="value" name="New Hires" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Attendance Trend */}
        <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm lg:col-span-2">
          <h3 className="font-bold flex items-center gap-2 mb-6">
            <Activity className="w-5 h-5 text-emerald-500" />
            Weekly Attendance Rate (%)
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={attendanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} domain={[80, 100]} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "12px", color: "var(--foreground)", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)", padding: "12px" }}
                  labelStyle={{ color: "var(--muted-foreground)", marginBottom: "4px", fontWeight: "bold" }}
                  itemStyle={{ fontWeight: "bold" }}
                  cursor={{ fill: "var(--muted)", opacity: 0.2 }}
                />
                <Line type="monotone" name="Attendance" dataKey="value" stroke="var(--chart-1)" strokeWidth={4} dot={{ r: 6, fill: 'var(--chart-1)', strokeWidth: 2, stroke: 'var(--chart-1)' }} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

    </div>
  );
}
