import { useState } from "react";
import { X,  
  Building2, Users, IndianRupee, Target, Briefcase, Handshake, 
  MapPin, AlertTriangle, ArrowRight, ArrowUpRight, CheckCircle2, 
  Clock, ArrowDownRight, Activity, Cpu, Plus, MoreVertical
 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { toast } from "sonner";
import { DialogClose,  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter  } from "@/components/ui/dialog";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableHeader } from "@/components/ui/sortable-header";

export function CollaborationModule() {
  const [isAddPartnerOpen, setIsAddPartnerOpen] = useState(false);
  const metrics = [
    { label: "Collaboration Partners", value: "18", change: "+2", trend: "up" },
    { label: "Active Projects", value: "24", change: "in progress", trend: "neutral" },
    { label: "Incoming Projects", value: "15", change: "insourced", trend: "neutral" },
    { label: "Outgoing Projects", value: "9", change: "outsourced", trend: "neutral" },
    { label: "Projects Completed", value: "142", change: "this year", trend: "neutral" },
    { label: "Total Project Value", value: "₹4.5M", change: "active", trend: "neutral" },
    { label: "Gross Margin", value: "32%", change: "+4%", trend: "up" },
    { label: "Avg Partner Rating", value: "4.8/5", change: "based on 40 reviews", trend: "neutral" }
  ];

  const partners = [
    { name: "CodeCraft Studios", capability: "React / Node.js", type: "Vendor", activeProjects: 3, rating: "4.9" },
    { name: "DesignMatrix", capability: "UI/UX Design", type: "Vendor", activeProjects: 1, rating: "4.7" },
    { name: "ServerPros", capability: "DevOps / AWS", type: "Vendor", activeProjects: 2, rating: "4.8" },
  ];

  const projectValueData = [
    { month: 'Jan', value: 200000 }, { month: 'Feb', value: 250000 }, { month: 'Mar', value: 300000 },
    { month: 'Apr', value: 280000 }, { month: 'May', value: 350000 }, { month: 'Jun', value: 400000 },
    { month: 'Jul', value: 450000 }, { month: 'Aug', value: 600000 }
  ];

  const projectDirectionData = [
    { name: 'Incoming (Insourced)', value: 15 },
    { name: 'Outgoing (Outsourced)', value: 9 },
  ];
  const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

  const { items: sortedPartners, requestSort, sortConfig } = useSortableData(partners);

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground mb-1">
            <span>Dashboard</span>
            <span>/</span>
            <span className="text-foreground">Tech Collaboration</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground">Tech Collaboration Overview</h1>
          <p className="text-muted-foreground mt-2 font-medium">Partner network capacity, project flow and margins.</p>
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
      
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm min-h-[300px] flex flex-col">
          <h3 className="text-lg font-black mb-6">Project Value</h3>
          <div className="flex-1 w-full h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={projectValueData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#059669" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} dy={10} />
                <YAxis stroke="#6B7280" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value/1000}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "12px", color: "var(--foreground)", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)", padding: "12px" }}
                  labelStyle={{ color: "var(--muted-foreground)", marginBottom: "4px", fontWeight: "bold" }}
                  itemStyle={{ fontWeight: "bold" }}
                  cursor={{ fill: "var(--muted)", opacity: 0.2 }}
                />
                <Area type="monotone" dataKey="value" stroke="var(--chart-1)" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm min-h-[300px] flex flex-col">
          <h3 className="text-lg font-black mb-6">Project Direction</h3>
          <div className="flex-1 w-full h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={projectDirectionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {projectDirectionData.map((entry, index) => (
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
          <h3 className="text-lg font-black">Collaboration Partners</h3>
          <button onClick={() => setIsAddPartnerOpen(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" /> Add Partner
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/50">
                <SortableHeader label="Partner Name" sortKey="name" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider" />
                <SortableHeader label="Capability" sortKey="capability" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider" />
                <SortableHeader label="Type" sortKey="type" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider" />
                <SortableHeader label="Active Projects" sortKey="activeProjects" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider" />
                <SortableHeader label="Rating" sortKey="rating" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider" />
                <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {sortedPartners.map((partner, i) => (
                <tr key={i} className="hover:bg-muted/30 transition-colors">
                  <td className="p-4 font-bold text-foreground">{partner.name}</td>
                  <td className="p-4 text-sm font-medium text-muted-foreground">{partner.capability}</td>
                  <td className="p-4 text-sm font-medium">{partner.type}</td>
                  <td className="p-4 font-bold">{partner.activeProjects}</td>
                  <td className="p-4 font-bold text-emerald-600">⭐ {partner.rating}</td>
                  <td className="p-4 text-right">
                    <button onClick={() => toast.info(`Managing partnership with ${partner.name}`)} className="p-2 hover:bg-muted rounded-lg transition-colors"><MoreVertical className="w-4 h-4 text-muted-foreground" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Partner Modal */}
      <Dialog open={isAddPartnerOpen} onOpenChange={setIsAddPartnerOpen}>
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
              onClick={() => setIsAddPartnerOpen(false)}
              className="px-6 py-2.5 rounded-xl font-bold text-sm bg-background border border-border hover:bg-muted transition-colors shadow-sm"
            >
              Cancel
            </button>
            <button 
              onClick={() => {
                toast.success("Partner added successfully!");
                setIsAddPartnerOpen(false);
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
