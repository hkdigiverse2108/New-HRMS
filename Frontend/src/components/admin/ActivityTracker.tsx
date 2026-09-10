import { useState } from "react";
import { Activity, MousePointerClick, Keyboard, TrendingUp, Monitor, Globe, Search, Download, ArrowUpDown, Filter } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { SearchableSelect } from "@/components/ui/select";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableHeader } from "@/components/ui/sortable-header";

const trendData = [
  { date: 'Mon', clicks: 12500, keystrokes: 45000 },
  { date: 'Tue', clicks: 14200, keystrokes: 52000 },
  { date: 'Wed', clicks: 13800, keystrokes: 48500 },
  { date: 'Thu', clicks: 15100, keystrokes: 55200 },
  { date: 'Fri', clicks: 11200, keystrokes: 38000 },
  { date: 'Sat', clicks: 2400, keystrokes: 8500 },
  { date: 'Sun', clicks: 1800, keystrokes: 6200 },
];

const topApps = [
  { name: 'VS Code', duration: 18400 },
  { name: 'Google Chrome', duration: 14200 },
  { name: 'Slack', duration: 4800 },
  { name: 'Figma', duration: 3200 },
  { name: 'Postman', duration: 1500 },
];

const topDomains = [
  { name: 'github.com', duration: 8400 },
  { name: 'stackoverflow.com', duration: 5200 },
  { name: 'linear.app', duration: 3800 },
  { name: 'google.com', duration: 2500 },
  { name: 'chatgpt.com', duration: 1800 },
];

const mockLogs = [
  { id: 1, date: 'Today, 10:45 AM', employee: 'Sarah Jenkins', empId: 'EMP-001', clicks: 1450, keystrokes: 8200 },
  { id: 2, date: 'Today, 10:40 AM', employee: 'Michael Chen', empId: 'EMP-002', clicks: 890, keystrokes: 4100 },
  { id: 3, date: 'Today, 10:15 AM', employee: 'Priya Patel', empId: 'EMP-003', clicks: 2100, keystrokes: 12500 },
  { id: 4, date: 'Yesterday, 04:30 PM', employee: 'David Kumar', empId: 'EMP-004', clicks: 3400, keystrokes: 15800 },
  { id: 5, date: 'Yesterday, 02:15 PM', employee: 'Sarah Jenkins', empId: 'EMP-001', clicks: 1850, keystrokes: 9100 },
];

export function ActivityTracker() {
  const [searchQuery, setSearchQuery] = useState("");

  const formatDuration = (secs: number) => {
    if (secs < 60) return `${secs}s`;
    if (secs < 3600) return `${Math.round(secs / 60)}m`;
    return `${(secs / 3600).toFixed(1)}h`;
  };

  const filteredLogs = mockLogs.filter(log => 
    log.employee.toLowerCase().includes(searchQuery.toLowerCase()) || 
    log.empId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const { items: sortedLogs, requestSort, sortConfig } = useSortableData(filteredLogs);

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Activity className="w-8 h-8 text-primary" />
            Activity Tracker
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            Monitor user input statistics such as keyboard keypresses and mouse clicks.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search employee..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-card border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
            />
          </div>
          <SearchableSelect 
            value="Today"
            onChange={() => {}}
            options={[
              { label: "Today", value: "Today" },
              { label: "This Week", value: "This Week" },
              { label: "This Month", value: "This Month" }
            ]}
            className="w-[120px] h-[42px] px-4 bg-card border border-border/50 text-foreground font-bold rounded-xl hover:bg-muted/50 transition-colors shadow-sm outline-none cursor-pointer"
          />
          <button className="px-4 py-2.5 bg-primary/10 text-primary font-bold rounded-xl hover:bg-primary/20 transition-colors shadow-sm flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <MousePointerClick className="w-5 h-5" />
            </div>
          </div>
          <div className="text-muted-foreground font-bold text-xs uppercase tracking-wider mb-1">Total Mouse Clicks</div>
          <div className="text-4xl font-black text-foreground">61,000</div>
        </div>

        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-pink-500/10 text-pink-500 flex items-center justify-center">
              <Keyboard className="w-5 h-5" />
            </div>
          </div>
          <div className="text-muted-foreground font-bold text-xs uppercase tracking-wider mb-1">Total Keystrokes</div>
          <div className="text-4xl font-black text-foreground">255,400</div>
        </div>
      </div>

      {/* Main Charts & Leaderboard */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Trend Chart */}
        <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm lg:col-span-2">
          <h3 className="font-bold flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-primary" />
            Input Activity Trend
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorKeys" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ec4899" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#ec4899" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} dy={10} />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                  tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "12px", color: "var(--foreground)", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)", padding: "12px" }}
                  labelStyle={{ color: "var(--muted-foreground)", marginBottom: "4px", fontWeight: "bold" }}
                  itemStyle={{ fontWeight: "bold" }}
                  cursor={{ fill: "var(--muted)", opacity: 0.2 }}
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Area type="monotone" dataKey="clicks" name="Mouse Clicks" stroke="var(--chart-1)" strokeWidth={3} fillOpacity={1} fill="url(#colorClicks)" />
                <Area type="monotone" dataKey="keystrokes" name="Keystrokes" stroke="var(--chart-2)" strokeWidth={3} fillOpacity={1} fill="url(#colorKeys)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Leaderboard */}
        <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm">
          <h3 className="font-bold flex items-center gap-2 mb-6">
            <Activity className="w-5 h-5 text-indigo-500" />
            Most Active Employees
          </h3>
          <div className="space-y-4">
            {mockLogs.slice(0,5).map((log, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-black text-muted-foreground w-4">#{idx + 1}</span>
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                    {log.employee.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-foreground">{log.employee}</div>
                    <div className="text-xs text-muted-foreground">{log.empId}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black text-foreground">
                    {(log.clicks + log.keystrokes).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Total Activity</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Applications and Websites */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Apps */}
        <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm">
          <h3 className="font-bold flex items-center gap-2 mb-6">
            <Monitor className="w-5 h-5 text-indigo-500" />
            Most Used Applications
          </h3>
          <div className="space-y-5">
            {topApps.map((app, idx) => (
              <div key={idx} className="flex flex-col gap-2">
                <div className="flex justify-between text-sm font-bold text-foreground">
                  <span>{app.name}</span>
                  <span className="text-muted-foreground">{formatDuration(app.duration)}</span>
                </div>
                <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full"
                    style={{ width: `${(app.duration / (topApps[0]?.duration || 1)) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Domains */}
        <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm">
          <h3 className="font-bold flex items-center gap-2 mb-6">
            <Globe className="w-5 h-5 text-teal-500" />
            Most Visited Websites
          </h3>
          <div className="space-y-5">
            {topDomains.map((domain, idx) => (
              <div key={idx} className="flex flex-col gap-2">
                <div className="flex justify-between text-sm font-bold text-foreground">
                  <span>{domain.name}</span>
                  <span className="text-muted-foreground">{formatDuration(domain.duration)}</span>
                </div>
                <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-teal-500 rounded-full"
                    style={{ width: `${(domain.duration / (topDomains[0]?.duration || 1)) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detail Log Table */}
      <div className="bg-card border border-border/50 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-border/50 flex flex-col md:flex-row items-center justify-between gap-4">
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <Filter className="w-5 h-5 text-primary" />
            Detailed Activity Logs
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/30 border-b border-border/50 text-muted-foreground font-bold text-xs uppercase tracking-wider">
                <SortableHeader label="Date" sortKey="date" currentSort={sortConfig} onSort={requestSort} className="p-4 pl-6" />
                <SortableHeader label="Employee" sortKey="employee" currentSort={sortConfig} onSort={requestSort} className="p-4" />
                <SortableHeader label="Clicks" sortKey="clicks" currentSort={sortConfig} onSort={requestSort} className="p-4 text-right" />
                <SortableHeader label="Keystrokes" sortKey="keystrokes" currentSort={sortConfig} onSort={requestSort} className="p-4 pr-6 text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {sortedLogs.map((log) => (
                <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                  <td className="p-4 pl-6 font-medium text-foreground text-sm">{log.date}</td>
                  <td className="p-4">
                    <div className="font-bold text-foreground text-sm">{log.employee}</div>
                    <div className="text-xs text-muted-foreground">{log.empId}</div>
                  </td>
                  <td className="p-4 text-right font-black text-indigo-500">{log.clicks.toLocaleString()}</td>
                  <td className="p-4 pr-6 text-right font-black text-pink-500">{log.keystrokes.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-border/50 text-center text-sm font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
          Load More
        </div>
      </div>

    </div>
  );
}
