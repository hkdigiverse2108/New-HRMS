import { useState } from "react";
import { X,   
  Building2, Users, IndianRupee, Target, Briefcase, Handshake, 
  MapPin, AlertTriangle, ArrowRight, ArrowUpRight, CheckCircle2, 
  Clock, ArrowDownRight, Activity, Search, Filter, Plus, FileText, 
  MoreVertical, Check
  } from "lucide-react";
import { cn } from "@/lib/utils";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { toast } from "sonner";
import { DialogClose,  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter  } from "@/components/ui/dialog";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableHeader } from "@/components/ui/sortable-header";

// --- Sub-components ---

function B2BOverview() {
  const metrics = [
    { label: "Total Partners", value: "42", change: "+3", trend: "up" },
    { label: "Active Partners", value: "38", change: "90% active", trend: "neutral" },
    { label: "Total Leads", value: "156", change: "+12", trend: "up" },
    { label: "Conversion Rate", value: "24%", change: "+2%", trend: "up" },
    { label: "Total Deal Value", value: "₹12.5M", change: "this year", trend: "neutral" },
    { label: "Commission Generated", value: "₹1.8M", change: "this year", trend: "neutral" },
    { label: "Pending Commission", value: "₹4.2L", change: "awaiting settlement", trend: "neutral" },
    { label: "Paid Commission", value: "₹1.38M", change: "this year", trend: "neutral" }
  ];

  const dealValueData = [
    { month: 'Jan', value: 400000 }, { month: 'Feb', value: 300000 }, { month: 'Mar', value: 500000 },
    { month: 'Apr', value: 450000 }, { month: 'May', value: 600000 }, { month: 'Jun', value: 700000 },
    { month: 'Jul', value: 900000 }, { month: 'Aug', value: 1200000 }
  ];

  const commissionData = [
    { month: 'Jan', generated: 40000, paid: 40000 },
    { month: 'Feb', generated: 30000, paid: 30000 },
    { month: 'Mar', generated: 50000, paid: 40000 },
    { month: 'Apr', generated: 45000, paid: 45000 },
    { month: 'May', generated: 60000, paid: 50000 },
    { month: 'Jun', generated: 70000, paid: 60000 },
    { month: 'Jul', generated: 90000, paid: 0 },
    { month: 'Aug', generated: 120000, paid: 0 }
  ];

  return (
    <div className="space-y-8">
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
          <h3 className="text-lg font-black mb-6">Deal Value (Last 12 Months)</h3>
          <div className="flex-1 w-full h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dealValueData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} dy={10} />
                <YAxis stroke="#6B7280" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value/1000}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "12px", color: "var(--foreground)", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)", padding: "12px" }}
                  labelStyle={{ color: "var(--muted-foreground)", marginBottom: "4px", fontWeight: "bold" }}
                  itemStyle={{ fontWeight: "bold" }}
                  cursor={{ fill: "var(--muted)", opacity: 0.2 }}
                />
                <Line type="monotone" dataKey="value" stroke="var(--chart-1)" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm min-h-[300px] flex flex-col">
          <h3 className="text-lg font-black mb-6">Commission Generated vs Paid</h3>
          <div className="flex-1 w-full h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={commissionData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} dy={10} />
                <YAxis stroke="#6B7280" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value/1000}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "12px", color: "var(--foreground)", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)", padding: "12px" }}
                  labelStyle={{ color: "var(--muted-foreground)", marginBottom: "4px", fontWeight: "bold" }}
                  itemStyle={{ fontWeight: "bold" }}
                  cursor={{ fill: "var(--muted)", opacity: 0.2 }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
                <Bar dataKey="generated" name="Generated" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="paid" name="Paid" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function B2BPartners() {
  const partners = [
    { name: "TechNova Solutions", type: "Technology", status: "Active", deals: 12, value: "₹2.5M" },
    { name: "ABC Business Group", type: "Consulting", status: "Active", deals: 8, value: "₹1.2M" },
    { name: "XYZ Packaging", type: "Manufacturing", status: "Inactive", deals: 3, value: "₹850K" },
  ];

  const { items: sortedPartners, requestSort, sortConfig } = useSortableData(partners);

  return (
    <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-black">Partner Directory</h3>
        <Dialog>
          <DialogTrigger asChild>
            <button className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-primary/90 transition-colors">
              <Plus className="w-4 h-4" /> Add Partner
            </button>
          </DialogTrigger>
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
                onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))}
                className="px-6 py-2.5 rounded-xl font-bold text-sm bg-background border border-border hover:bg-muted transition-colors shadow-sm"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  toast.success("Partner added successfully!");
                  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
                }}
                className="px-6 py-2.5 rounded-xl font-bold text-sm bg-[#0070AA] text-white hover:bg-[#0070AA]/90 transition-colors shadow-sm"
              >
                Save
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border/50">
              <SortableHeader label="Partner Name" sortKey="name" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider" />
              <SortableHeader label="Type" sortKey="type" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider" />
              <SortableHeader label="Status" sortKey="status" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider" />
              <SortableHeader label="Deals Closed" sortKey="deals" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider" />
              <SortableHeader label="Total Value" sortKey="value" currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider" />
              <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {sortedPartners.map((partner, i) => (
              <tr key={i} className="hover:bg-muted/30 transition-colors">
                <td className="p-4 font-bold text-foreground">{partner.name}</td>
                <td className="p-4 text-sm font-medium text-muted-foreground">{partner.type}</td>
                <td className="p-4">
                  <span className={cn("px-2 py-1 text-xs font-bold uppercase rounded-md", partner.status === 'Active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground')}>
                    {partner.status}
                  </span>
                </td>
                <td className="p-4 font-bold">{partner.deals}</td>
                <td className="p-4 font-bold text-emerald-600">{partner.value}</td>
                <td className="p-4 text-right">
                  <button onClick={() => toast.info(`Viewing details for ${partner.name}`)} className="p-2 hover:bg-muted rounded-lg transition-colors"><MoreVertical className="w-4 h-4 text-muted-foreground" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function B2BGenericTable({ title, columns, data }: { title: string, columns: string[], data: any[][] }) {
  const { items: sortedData, requestSort, sortConfig } = useSortableData(data);

  return (
    <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-black">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border/50">
              {columns.map((col, i) => (
                <SortableHeader key={i} label={col} sortKey={i.toString()} currentSort={sortConfig} onSort={requestSort} className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider" />
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {sortedData.map((row, i) => (
              <tr key={i} className="hover:bg-muted/30 transition-colors">
                {row.map((cell, j) => (
                  <td key={j} className="p-4 text-sm font-medium text-foreground">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Main Module Wrapper ---

export function B2BModule({ active }: { active: string }) {
  const currentTab = active.split("/").pop();

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground mb-1">
            <span>Dashboard</span>
            <span>/</span>
            <span>B2B Partnership</span>
            <span>/</span>
            <span className="text-foreground capitalize">{currentTab === 'b2b' ? 'Overview' : currentTab}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground capitalize">
            {currentTab === 'b2b' ? 'B2B Overview' : currentTab?.replace("-", " ")}
          </h1>
        </div>
      </div>

      {/* Content Rendering */}
      {currentTab === 'b2b' && <B2BOverview />}
      {currentTab === 'partners' && <B2BPartners />}
      {currentTab === 'leads' && <B2BGenericTable title="Partner Leads" columns={["Lead Name", "Partner", "Status", "Date", "Expected Value"]} data={[["Tech Corp", "TechNova Solutions", "New", "12 Aug 2026", "₹500K"], ["Design Co", "ABC Business Group", "Contacted", "10 Aug 2026", "₹200K"]]} />}
      {currentTab === 'opportunities' && <B2BGenericTable title="Opportunities" columns={["Opportunity", "Partner", "Stage", "Probability", "Value"]} data={[["ERP Implementation", "TechNova Solutions", "Proposal", "70%", "₹1.5M"], ["Marketing Retainer", "ABC Business Group", "Negotiation", "90%", "₹400K"]]} />}
      {currentTab === 'deals' && <B2BGenericTable title="Closed Deals" columns={["Deal Name", "Partner", "Close Date", "Value", "Commission Due"]} data={[["Web Portal", "TechNova Solutions", "12 Aug 2026", "₹850K", "₹85K"], ["Brand Refresh", "ABC Business Group", "05 Aug 2026", "₹300K", "₹30K"]]} />}
      {currentTab === 'invoices' && <B2BGenericTable title="Invoices" columns={["Invoice #", "Partner", "Date", "Amount", "Status"]} data={[["INV-2026-001", "TechNova Solutions", "12 Aug 2026", "₹850K", "Paid"], ["INV-2026-002", "ABC Business Group", "05 Aug 2026", "₹300K", "Pending"]]} />}
      {currentTab === 'commission' && <B2BGenericTable title="Commission Tracking" columns={["Partner", "Deal", "Commission %", "Amount", "Status"]} data={[["TechNova Solutions", "Web Portal", "10%", "₹85K", "Pending"], ["ABC Business Group", "Brand Refresh", "10%", "₹30K", "Paid"]]} />}
      {currentTab === 'settlement' && <B2BGenericTable title="Monthly Settlements" columns={["Month", "Partner", "Total Commission", "Status", "Settlement Date"]} data={[["August 2026", "TechNova Solutions", "₹120K", "Pending", "-"], ["July 2026", "ABC Business Group", "₹45K", "Settled", "01 Aug 2026"]]} />}
      {currentTab === 'performance' && (
        <div className="flex flex-col items-center justify-center h-[400px] text-center space-y-4 bg-card border border-border/50 rounded-3xl p-6 shadow-sm">
          <Activity className="w-16 h-16 text-muted-foreground/20" />
          <h2 className="text-2xl font-black">Performance Analytics</h2>
          <p className="text-muted-foreground max-w-md">Detailed partner performance graphs and matrices will be rendered here.</p>
        </div>
      )}
    </div>
  );
}
