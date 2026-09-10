import { useState } from "react";
import { Search, Filter, History, CalendarDays, AlertCircle, Activity, CheckCircle2, XCircle, FileText } from "lucide-react";
import { SearchableSelect } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type ApprovalType = "Leave Request" | "Penalty" | "Daily Progress" | "Invoice";
type ActionType = "Approved" | "Rejected" | "Verified";

interface ApprovalLog {
  id: string;
  type: ApprovalType;
  entityName: string; // Employee or Client Name
  details: string; // Brief summary of what was approved/rejected
  action: ActionType;
  actionBy: string; // Manager who did it
  timestamp: string;
  notes?: string;
}

const MOCK_HISTORY: ApprovalLog[] = [
  {
    id: "log1",
    type: "Leave Request",
    entityName: "Sarah Jenkins",
    details: "Sick Leave (2 days)",
    action: "Approved",
    actionBy: "Alex Boss",
    timestamp: "Today, 10:45 AM",
    notes: "Get well soon!"
  },
  {
    id: "log2",
    type: "Daily Progress",
    entityName: "Michael Chen",
    details: "Verified 3 completed tasks",
    action: "Verified",
    actionBy: "Alex Boss",
    timestamp: "Today, 09:15 AM",
    notes: "Rated 4 stars."
  },
  {
    id: "log3",
    type: "Invoice",
    entityName: "Global Logistics",
    details: "INV-2024-103 (₹ 85,000)",
    action: "Rejected",
    actionBy: "Finance Dept",
    timestamp: "Yesterday, 04:30 PM",
    notes: "Incorrect tax rate applied."
  },
  {
    id: "log4",
    type: "Penalty",
    entityName: "David Kumar",
    details: "Late Arrival (₹ 500)",
    action: "Approved",
    actionBy: "HR Admin",
    timestamp: "Mar 10, 11:20 AM"
  },
  {
    id: "log5",
    type: "Leave Request",
    entityName: "Priya Patel",
    details: "Vacation (5 days)",
    action: "Rejected",
    actionBy: "Alex Boss",
    timestamp: "Mar 09, 02:15 PM",
    notes: "Critical launch period, please reschedule."
  },
];

export function ApprovalHistory() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ApprovalType | "All">("All");
  const [actionFilter, setActionFilter] = useState<ActionType | "All">("All");

  const filteredLogs = MOCK_HISTORY.filter(log => {
    const matchesSearch = log.entityName.toLowerCase().includes(search.toLowerCase()) || log.details.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "All" || log.type === typeFilter;
    const matchesAction = actionFilter === "All" || log.action === actionFilter;
    return matchesSearch && matchesType && matchesAction;
  });

  const getTypeIcon = (type: ApprovalType) => {
    switch (type) {
      case "Leave Request": return <CalendarDays className="w-4 h-4 text-blue-500" />;
      case "Penalty": return <AlertCircle className="w-4 h-4 text-rose-500" />;
      case "Daily Progress": return <Activity className="w-4 h-4 text-emerald-500" />;
      case "Invoice": return <FileText className="w-4 h-4 text-amber-500" />;
    }
  };

  const getActionColor = (action: ActionType) => {
    switch (action) {
      case "Approved": return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
      case "Verified": return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
      case "Rejected": return "bg-rose-500/10 text-rose-600 border-rose-500/20";
    }
  };

  const getActionIcon = (action: ActionType) => {
    switch (action) {
      case "Approved": return <CheckCircle2 className="w-3.5 h-3.5" />;
      case "Verified": return <CheckCircle2 className="w-3.5 h-3.5" />;
      case "Rejected": return <XCircle className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
            <History className="w-8 h-8 text-primary" />
            Approval History
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            A unified log of all past approvals, rejections, and verifications across the Hub.
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-card border border-border/50 p-4 rounded-2xl shadow-sm">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name or details..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-background border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
          />
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-auto">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
            <SearchableSelect
              value={typeFilter}
              onChange={(val) => setTypeFilter(val as any)}
              options={[
                { label: "All Categories", value: "All" },
                { label: "Leave Requests", value: "Leave Request" },
                { label: "Penalties", value: "Penalty" },
                { label: "Daily Progress", value: "Daily Progress" },
                { label: "Invoices", value: "Invoice" }
              ]}
              className="w-[200px] h-[42px] pl-9 bg-background border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-bold cursor-pointer"
            />
          </div>
          <div className="relative w-full sm:w-auto">
            <SearchableSelect
              value={actionFilter}
              onChange={(val) => setActionFilter(val as any)}
              options={[
                { label: "All Actions", value: "All" },
                { label: "Approved", value: "Approved" },
                { label: "Verified", value: "Verified" },
                { label: "Rejected", value: "Rejected" }
              ]}
              className="w-[180px] h-[42px] px-4 bg-background border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-bold cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* History Feed */}
      <div className="bg-card border border-border/50 rounded-3xl overflow-hidden shadow-sm">
        <div className="divide-y divide-border/50">
          {filteredLogs.map((log) => (
            <div key={log.id} className="p-5 hover:bg-muted/20 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
              
              <div className="flex items-start gap-4">
                <div className="mt-1 w-10 h-10 rounded-xl bg-background border border-border/50 flex items-center justify-center shrink-0 shadow-sm">
                  {getTypeIcon(log.type)}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-foreground">{log.entityName}</span>
                    <span className="text-muted-foreground text-sm">•</span>
                    <span className="text-sm font-medium text-muted-foreground">{log.type}</span>
                  </div>
                  <div className="text-sm text-foreground font-medium mb-2">{log.details}</div>
                  
                  {log.notes && (
                    <div className="text-sm text-muted-foreground bg-muted/30 p-2.5 rounded-lg border border-border/30 inline-block mb-1">
                      <span className="font-bold mr-1">Remarks:</span> {log.notes}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center shrink-0">
                <span className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-black uppercase tracking-wider border mb-2",
                  getActionColor(log.action)
                )}>
                  {getActionIcon(log.action)}
                  {log.action}
                </span>
                <div className="text-xs font-bold text-muted-foreground">
                  by {log.actionBy} on {log.timestamp}
                </div>
              </div>

            </div>
          ))}
          {filteredLogs.length === 0 && (
            <div className="p-12 text-center text-muted-foreground">
              <div className="flex flex-col items-center justify-center">
                <History className="w-12 h-12 mb-4 text-muted-foreground/30" />
                <p className="font-bold">No history found</p>
                <p className="text-sm">Try adjusting your search or filters.</p>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
