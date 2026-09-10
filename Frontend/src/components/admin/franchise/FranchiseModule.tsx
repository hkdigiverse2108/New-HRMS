import { useState } from "react";
import { X,  
  Building2, MapPin, Store, Plus, MoreVertical, Activity, Users
 } from "lucide-react";
import { cn } from "@/lib/utils";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { toast } from "sonner";
import { DialogClose,  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter  } from "@/components/ui/dialog";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableHeader } from "@/components/ui/sortable-header";

export function FranchiseModule() {
  const [isAddAllocationOpen, setIsAddAllocationOpen] = useState(false);
  const metrics = [
    { label: "Total Leads", value: "89", change: "+5", trend: "up" },
    { label: "Qualified Leads", value: "34", change: "in pipeline", trend: "neutral" },
    { label: "Meetings", value: "12", change: "this week", trend: "neutral" },
    { label: "Negotiations", value: "8", change: "active", trend: "neutral" },
    { label: "Converted", value: "15", change: "this year", trend: "neutral" },
    { label: "Conversion Rate", value: "16.8%", change: "+1.2%", trend: "up" },
    { label: "Available Territories", value: "45", change: "open for booking", trend: "neutral" },
    { label: "Active Franchisees", value: "14", change: "operating", trend: "neutral" }
  ];

  const territories = [
    { name: "Ahmedabad North", status: "Reserved", partner: "ABC Business Group", expires: "Tomorrow" },
    { name: "Rajkot West", status: "Allocated", partner: "Patel Enterprises", expires: "-" },
    { name: "Surat Central", status: "Available", partner: "-", expires: "-" },
    { name: "Vadodara South", status: "Allocated", partner: "Global Traders", expires: "-" },
  ];

  const funnelData = [
    { stage: 'Total Leads', count: 89 },
    { stage: 'Qualified', count: 34 },
    { stage: 'Negotiating', count: 8 },
    { stage: 'Converted', count: 15 }
  ];

  const leadsData = [
    { month: 'Jan', leads: 12, converted: 2 },
    { month: 'Feb', leads: 18, converted: 3 },
    { month: 'Mar', leads: 24, converted: 4 },
    { month: 'Apr', leads: 15, converted: 2 },
    { month: 'May', leads: 20, converted: 4 },
  ];

  const territoryData = [
    { name: 'Allocated', value: 14 },
    { name: 'Reserved', value: 8 },
    { name: 'Available', value: 45 },
  ];
  const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

  const { items: sortedTerritories, requestSort, sortConfig } = useSortableData(territories);

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground mb-1">
            <span>Dashboard</span>
            <span>/</span>
            <span className="text-foreground">Franchise</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground">Franchise Overview</h1>
          <p className="text-muted-foreground mt-2 font-medium">Franchise pipeline, territory coverage and conversion.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map((metric, i) => (
          <div key={i} className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">{metric.label}</p>
            <h3 className="text-2xl font-black text-foreground">{metric.value}</h3>
            <p className={cn("text-[10px] font-bold mt-1 uppercase", metric.trend === 'up' ? 'text-emerald-500' : 'text-muted-foreground')}>
              {metric.change}
            </p>
          </div>
        ))}
      </div>
      
      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm min-h-[300px] flex flex-col">
          <h3 className="text-lg font-black mb-6">Franchise Funnel</h3>
          <div className="flex-1 w-full h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData} layout="vertical" margin={{ top: 0, right: 20, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                <XAxis type="number" hide />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} type="category" />
                <Tooltip 
                  contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "12px", color: "var(--foreground)", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)", padding: "12px" }}
                  labelStyle={{ color: "var(--muted-foreground)", marginBottom: "4px", fontWeight: "bold" }}
                  itemStyle={{ fontWeight: "bold" }}
                  cursor={{ fill: "var(--muted)", opacity: 0.2 }}
                />
                <Bar dataKey="count" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm min-h-[300px] flex flex-col">
          <h3 className="text-lg font-black mb-6">Leads by Month</h3>
          <div className="flex-1 w-full h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={leadsData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "12px", color: "var(--foreground)", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)", padding: "12px" }}
                  labelStyle={{ color: "var(--muted-foreground)", marginBottom: "4px", fontWeight: "bold" }}
                  itemStyle={{ fontWeight: "bold" }}
                  cursor={{ fill: "var(--muted)", opacity: 0.2 }}
                />
                <Line type="monotone" dataKey="leads" name="Total Leads" stroke="var(--chart-1)" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="converted" name="Converted" stroke="var(--chart-2)" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm min-h-[300px] flex flex-col">
          <h3 className="text-lg font-black mb-6">Territory Status</h3>
          <div className="flex-1 w-full h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={territoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {territoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "12px", color: "var(--foreground)", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)", padding: "12px" }}
                  labelStyle={{ color: "var(--muted-foreground)", marginBottom: "4px", fontWeight: "bold" }}
                  itemStyle={{ fontWeight: "bold" }}
                  cursor={{ fill: "var(--muted)", opacity: 0.2 }}
                />
                <Legend verticalAlign="bottom" height={40} wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-black">Territory Allocations</h3>
          <button onClick={() => setIsAddAllocationOpen(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" /> New Allocation
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/50">
                <SortableHeader label="Territory Name" sortKey="name" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider" />
                <SortableHeader label="Status" sortKey="status" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider" />
                <SortableHeader label="Partner" sortKey="partner" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider" />
                <SortableHeader label="Reservation Expires" sortKey="expires" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider" />
                <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {sortedTerritories.map((territory, i) => (
                <tr key={i} className="hover:bg-muted/30 transition-colors">
                  <td className="p-4 font-bold text-foreground">{territory.name}</td>
                  <td className="p-4">
                    <span className={cn(
                      "px-2 py-1 text-xs font-bold uppercase rounded-md", 
                      territory.status === 'Available' ? 'bg-emerald-500/10 text-emerald-600' : 
                      territory.status === 'Reserved' ? 'bg-amber-500/10 text-amber-600' : 'bg-blue-500/10 text-blue-600'
                    )}>
                      {territory.status}
                    </span>
                  </td>
                  <td className="p-4 text-sm font-medium">{territory.partner}</td>
                  <td className={cn("p-4 font-bold", territory.expires === 'Tomorrow' ? 'text-rose-500' : 'text-muted-foreground')}>{territory.expires}</td>
                  <td className="p-4 text-right">
                    <button onClick={() => toast.info(`Options for ${territory.name}`)} className="p-2 hover:bg-muted rounded-lg transition-colors"><MoreVertical className="w-4 h-4 text-muted-foreground" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Allocation Modal */}
      <Dialog open={isAddAllocationOpen} onOpenChange={setIsAddAllocationOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className="flex items-center justify-between px-6 md:px-8 py-6 border-b border-border/50 bg-muted/30">
          <div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight">Add Partner</h2>
            <p className="text-sm text-muted-foreground mt-1">This prototype stores records in memory only.</p>
          </div>
          <DialogClose asChild>
            <button className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </DialogClose>
        </div>

          <div className="p-6 md:p-8 space-y-6 overflow-y-auto max-h-[70vh]">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Name <span className="text-rose-500">*</span></label>
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="e.g. ABC Packaging Pvt Ltd" 
                  className="w-full bg-background border border-border/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all pr-10" 
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-muted-foreground">
                  <Users className="w-4 h-4" />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Contact person <span className="text-rose-500">*</span></label>
              <input 
                type="text" 
                placeholder="e.g. Nirav Shah" 
                className="w-full bg-background border border-border/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" 
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Phone</label>
              <input 
                type="text" 
                placeholder="+91 98250 41200" 
                className="w-full bg-background border border-border/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" 
              />
              <p className="text-xs text-muted-foreground mt-1 font-medium">Used for follow-up calls.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">City</label>
              <input 
                type="text" 
                placeholder="e.g. Surat, Gujarat" 
                className="w-full bg-background border border-border/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" 
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Notes</label>
              <textarea 
                placeholder="Add context for this record..." 
                className="w-full bg-background border border-border/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none h-24"
              ></textarea>
            </div>
          </div>

          <div className="px-6 md:px-8 py-4 md:py-6 bg-muted/30 border-t border-border/50 flex justify-end gap-3 mt-auto shrink-0">
            <button 
              onClick={() => setIsAddAllocationOpen(false)}
              className="px-6 py-2.5 rounded-xl font-bold text-sm bg-background border border-border hover:bg-muted transition-colors shadow-sm"
            >
              Cancel
            </button>
            <button 
              onClick={() => {
                toast.success("Partner added successfully!");
                setIsAddAllocationOpen(false);
              }}
              className="px-6 py-2.5 rounded-xl font-bold text-sm bg-[#0070AA] text-white hover:bg-[#0070AA]/90 transition-colors shadow-sm"
            >
              Save
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
