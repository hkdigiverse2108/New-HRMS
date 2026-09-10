import { UserPlus, Target, CheckCircle2, TrendingDown, Users } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, LineChart, Line } from 'recharts';
import { useState } from 'react';
import { SearchableSelect } from '@/components/ui/select';

const funnelData = [
  { name: 'Sourced', count: 1250 },
  { name: 'Screened', count: 450 },
  { name: 'Interviewed', count: 180 },
  { name: 'Offered', count: 45 },
  { name: 'Hired', count: 32 },
];

const timeToHireData = [
  { name: 'Jan', days: 45 },
  { name: 'Feb', days: 42 },
  { name: 'Mar', days: 38 },
  { name: 'Apr', days: 35 },
  { name: 'May', days: 30 },
  { name: 'Jun', days: 28 },
];

const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

export function HiringFunnel() {
  const [timeRange, setTimeRange] = useState("Last 6 Months");

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
            <UserPlus className="w-8 h-8 text-primary" />
            Hiring Funnel Analytics
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            Track recruitment efficiency, conversion rates, and time-to-hire metrics.
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
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded-md flex items-center gap-1">
              <TrendingDown className="w-3 h-3 rotate-180" /> +15%
            </span>
          </div>
          <div className="text-emerald-600 font-bold text-xs uppercase tracking-wider mb-1">Total Hires</div>
          <div className="text-3xl font-black text-emerald-700">32</div>
        </div>

        <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <Target className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded-md flex items-center gap-1">
              <TrendingDown className="w-3 h-3" /> -5 days
            </span>
          </div>
          <div className="text-blue-600 font-bold text-xs uppercase tracking-wider mb-1">Avg Time to Hire</div>
          <div className="text-3xl font-black text-blue-700">28 Days</div>
        </div>

        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="text-amber-600 font-bold text-xs uppercase tracking-wider mb-1">Total Candidates</div>
          <div className="text-3xl font-black text-amber-700">1,250</div>
        </div>

        <div className="bg-purple-500/5 border border-purple-500/20 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="text-purple-600 font-bold text-xs uppercase tracking-wider mb-1">Offer Acceptance Rate</div>
          <div className="text-3xl font-black text-purple-700">71.1%</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        
        {/* Funnel Chart */}
        <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm">
          <h3 className="font-bold flex items-center gap-2 mb-6">
            <Target className="w-5 h-5 text-primary" />
            Recruitment Funnel
          </h3>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} type="category" />
                <Tooltip 
                  cursor={{ fill: 'var(--muted)', opacity: 0.2 }}
                  contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '12px', color: 'var(--foreground)' }}
                  formatter={(value: number) => [value, 'Candidates']}
                />
                <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={32}>
                  {funnelData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Time to Hire Trend */}
        <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm">
          <h3 className="font-bold flex items-center gap-2 mb-6">
            <TrendingDown className="w-5 h-5 text-blue-500" />
            Time to Hire Trend (Days)
          </h3>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeToHireData} margin={{ top: 20, right: 30, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '12px', color: 'var(--foreground)' }}
                  formatter={(value: number) => [`${value} days`, 'Time to Hire']}
                />
                <Line type="monotone" dataKey="days" stroke="var(--chart-1)" strokeWidth={4} dot={{ r: 6, fill: 'var(--chart-1)', strokeWidth: 2, stroke: 'var(--chart-1)' }} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

    </div>
  );
}
