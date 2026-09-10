import { Activity, Clock, CheckCircle2, AlertCircle, TrendingUp, CalendarDays } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell } from 'recharts';
import { useState } from 'react';
import { SearchableSelect } from '@/components/ui/select';

const dailyAttendance = [
  { name: '1', Present: 95, Absent: 3, Leave: 2 },
  { name: '2', Present: 92, Absent: 4, Leave: 4 },
  { name: '3', Present: 96, Absent: 1, Leave: 3 },
  { name: '4', Present: 88, Absent: 5, Leave: 7 },
  { name: '5', Present: 90, Absent: 6, Leave: 4 },
  { name: '6', Present: 97, Absent: 2, Leave: 1 },
  { name: '7', Present: 94, Absent: 3, Leave: 3 },
  { name: '8', Present: 95, Absent: 2, Leave: 3 },
  { name: '9', Present: 91, Absent: 5, Leave: 4 },
  { name: '10', Present: 89, Absent: 6, Leave: 5 },
];

const leaveTypes = [
  { name: 'Sick Leave', value: 45 },
  { name: 'Vacation', value: 30 },
  { name: 'Maternity', value: 15 },
  { name: 'Unpaid', value: 10 },
];
const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

export function AttendanceReport() {
  const [timeRange, setTimeRange] = useState("This Month");

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Activity className="w-8 h-8 text-primary" />
            Attendance Analytics
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            Deep dive into employee attendance patterns and leave distribution.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SearchableSelect
            value={timeRange}
            onChange={setTimeRange}
            options={[
              { label: "This Month", value: "This Month" },
              { label: "Last Month", value: "Last Month" },
              { label: "This Quarter", value: "This Quarter" }
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
              <TrendingUp className="w-3 h-3" /> +2.1%
            </span>
          </div>
          <div className="text-emerald-600 font-bold text-xs uppercase tracking-wider mb-1">Avg Attendance</div>
          <div className="text-3xl font-black text-emerald-700">93.8%</div>
        </div>

        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="text-amber-600 font-bold text-xs uppercase tracking-wider mb-1">Total Hours Logged</div>
          <div className="text-3xl font-black text-amber-700">184.5k</div>
        </div>

        <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <CalendarDays className="w-5 h-5" />
            </div>
          </div>
          <div className="text-blue-600 font-bold text-xs uppercase tracking-wider mb-1">Leaves Taken</div>
          <div className="text-3xl font-black text-blue-700">142 Days</div>
        </div>

        <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
              <AlertCircle className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded-md flex items-center gap-1">
              <TrendingUp className="w-3 h-3 rotate-180" /> -0.5%
            </span>
          </div>
          <div className="text-rose-600 font-bold text-xs uppercase tracking-wider mb-1">Absenteeism Rate</div>
          <div className="text-3xl font-black text-rose-700">4.2%</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        
        {/* Daily Breakdown */}
        <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm lg:col-span-2">
          <h3 className="font-bold flex items-center gap-2 mb-6">
            <Activity className="w-5 h-5 text-primary" />
            Daily Attendance Distribution (%)
          </h3>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyAttendance} margin={{ top: 20, right: 30, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "12px", color: "var(--foreground)", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)", padding: "12px" }}
                  labelStyle={{ color: "var(--muted-foreground)", marginBottom: "4px", fontWeight: "bold" }}
                  itemStyle={{ fontWeight: "bold" }}
                  cursor={{ fill: "var(--muted)", opacity: 0.2 }}
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey="Present" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Leave" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Absent" fill="var(--destructive)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Leave Types Pie */}
        <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm">
          <h3 className="font-bold flex items-center gap-2 mb-2">
            <CalendarDays className="w-5 h-5 text-blue-500" />
            Leave Distribution
          </h3>
          <div className="h-[350px] w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={leaveTypes}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {leaveTypes.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "12px", color: "var(--foreground)", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)", padding: "12px" }}
                  labelStyle={{ color: "var(--muted-foreground)", marginBottom: "4px", fontWeight: "bold" }}
                  itemStyle={{ fontWeight: "bold" }}
                  cursor={{ fill: "var(--muted)", opacity: 0.2 }}
                />
                <Legend verticalAlign="bottom" height={40} wrapperStyle={{ paddingTop: '20px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

    </div>
  );
}
