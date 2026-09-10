import { useState } from "react";
import { Search, ShieldAlert, Activity, Users, IndianRupee, Settings, TerminalSquare, AlertTriangle, Key } from "lucide-react";
import { cn } from "@/lib/utils";

type LogCategory = "All" | "Auth" | "People" | "Payroll" | "System";
type LogSeverity = "Info" | "Warning" | "Critical";

interface ActivityLog {
  id: string;
  timestamp: string;
  user: {
    name: string;
    avatar: string;
    role: string;
  };
  action: string;
  category: LogCategory;
  severity: LogSeverity;
  metadata?: string;
  ip: string;
}

const MOCK_LOGS: ActivityLog[] = [
  {
    id: "LOG-1001",
    timestamp: "10:45 AM, Today",
    user: { name: "System Admin", avatar: "https://i.pravatar.cc/150?u=admin", role: "Superadmin" },
    action: "Updated Global Payroll Settings",
    category: "System",
    severity: "Warning",
    metadata: "Changed default tax rate from 15% to 15.5%",
    ip: "192.168.1.45"
  },
  {
    id: "LOG-1002",
    timestamp: "09:30 AM, Today",
    user: { name: "Jessica Davis", avatar: "https://i.pravatar.cc/150?u=jess", role: "HR Manager" },
    action: "Onboarded New Employee",
    category: "People",
    severity: "Info",
    metadata: "Employee ID: EMP-0042 (Sarah Jenkins)",
    ip: "10.0.0.12"
  },
  {
    id: "LOG-1003",
    timestamp: "08:15 AM, Today",
    user: { name: "Unknown User", avatar: "https://ui-avatars.com/api/?name=Unknown&background=EF4444&color=fff", role: "Guest" },
    action: "Failed Login Attempt (5x)",
    category: "Auth",
    severity: "Critical",
    metadata: "Account locked for j.smith@company.com",
    ip: "203.0.113.42"
  },
  {
    id: "LOG-1004",
    timestamp: "Yesterday, 04:20 PM",
    user: { name: "Robert Chen", avatar: "https://i.pravatar.cc/150?u=robert", role: "Finance Lead" },
    action: "Approved Monthly Payroll Run",
    category: "Payroll",
    severity: "Info",
    metadata: "Total dispersed: ₹142,500.00",
    ip: "192.168.1.88"
  },
  {
    id: "LOG-1005",
    timestamp: "Yesterday, 11:10 AM",
    user: { name: "Sarah Connor", avatar: "https://i.pravatar.cc/150?u=sarah", role: "Frontend Developer" },
    action: "Logged In",
    category: "Auth",
    severity: "Info",
    ip: "192.168.1.104"
  },
  {
    id: "LOG-1006",
    timestamp: "Aug 10, 09:00 AM",
    user: { name: "System Admin", avatar: "https://i.pravatar.cc/150?u=admin", role: "Superadmin" },
    action: "Deleted Employee Record",
    category: "People",
    severity: "Critical",
    metadata: "Record ID: EMP-0012 removed permanently.",
    ip: "192.168.1.45"
  }
];

const getCategoryIcon = (category: LogCategory) => {
  switch (category) {
    case "Auth": return <Key className="w-4 h-4" />;
    case "People": return <Users className="w-4 h-4" />;
    case "Payroll": return <IndianRupee className="w-4 h-4" />;
    case "System": return <Settings className="w-4 h-4" />;
    default: return <Activity className="w-4 h-4" />;
  }
};

export function ActivityLogs() {
  const [activeTab, setActiveTab] = useState<LogCategory>("All");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredLogs = MOCK_LOGS.filter(log => {
    const matchesTab = activeTab === "All" || log.category === activeTab;
    const matchesSearch = log.action.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          log.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (log.metadata && log.metadata.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesTab && matchesSearch;
  });

  return (
    <div className="space-y-5 h-[calc(100vh-4rem)] flex flex-col overflow-hidden pb-0">
      {/* Header & Stats */}
      <div className="shrink-0 bg-card border border-border rounded-3xl p-6 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
          <TerminalSquare className="w-64 h-64 text-foreground" />
        </div>
        
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <h1 className="text-2xl font-black text-foreground tracking-tight mb-2">Activity Logs</h1>
            <p className="text-sm text-muted-foreground max-w-xl">
              System-wide audit trail. Monitor logins, configuration changes, and critical administrative actions.
            </p>
          </div>
          
          <div className="flex gap-4">
            <div className="bg-muted/50 border border-border rounded-2xl p-4 flex items-center gap-4 min-w-[160px]">
              <div className="w-10 h-10 bg-background rounded-xl shadow-sm flex items-center justify-center text-muted-foreground shrink-0">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Events Today</p>
                <p className="text-2xl font-black text-foreground leading-none">1,248</p>
              </div>
            </div>
            
            <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4 flex items-center gap-4 min-w-[160px]">
              <div className="w-10 h-10 bg-background rounded-xl shadow-sm flex items-center justify-center text-destructive shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-rose-600/70 uppercase tracking-wider mb-0.5">Critical Alerts</p>
                <p className="text-2xl font-black text-rose-700 leading-none">3</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0 bg-card border border-border rounded-3xl shadow-sm overflow-hidden">
        
        {/* Toolbar */}
        <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-muted/30 shrink-0">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-hide">
            {(["All", "Auth", "People", "Payroll", "System"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all duration-200 border flex items-center gap-2",
                  activeTab === tab 
                    ? "bg-primary text-primary-foreground border-primary shadow-md" 
                    : "bg-background text-muted-foreground border-border hover:border-border/80 hover:bg-muted/50"
                )}
              >
                {tab !== "All" && getCategoryIcon(tab)}
                {tab}
              </button>
            ))}
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search logs..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full sm:w-64 pl-9 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Timeline List */}
        <div className="flex-1 overflow-y-auto p-6 bg-muted/10">
          <div className="max-w-4xl mx-auto">
            {filteredLogs.length > 0 ? (
              <div className="relative border-l border-border ml-4 space-y-8 pb-8">
                {filteredLogs.map(log => (
                  <div key={log.id} className="relative pl-8 sm:pl-12 group">
                    {/* Timeline Node */}
                    <div className={cn(
                      "absolute -left-[1.1rem] top-1 w-8 h-8 rounded-full border-4 border-card flex items-center justify-center shadow-sm",
                      log.severity === "Critical" ? "bg-destructive text-destructive-foreground" :
                      log.severity === "Warning" ? "bg-amber-400 text-amber-950" :
                      "bg-primary text-primary-foreground"
                    )}>
                      {log.severity === "Critical" ? <ShieldAlert className="w-3.5 h-3.5" /> :
                       log.severity === "Warning" ? <AlertTriangle className="w-3.5 h-3.5" /> :
                       <Activity className="w-3.5 h-3.5" />}
                    </div>

                    {/* Content Card */}
                    <div className={cn(
                      "bg-card rounded-2xl p-5 shadow-sm border transition-all duration-200 group-hover:shadow-md",
                      log.severity === "Critical" ? "border-destructive/30 bg-destructive/5" : 
                      log.severity === "Warning" ? "border-amber-200 bg-amber-50/30" : 
                      "border-border hover:border-border/80"
                    )}>
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-3">
                        <div className="flex items-center gap-3">
                          <img 
                            src={log.user.avatar} 
                            alt={log.user.name}
                            className="w-10 h-10 rounded-full border border-border object-cover"
                          />
                          <div>
                            <p className="font-bold text-foreground leading-tight">
                              {log.user.name}
                              <span className="text-muted-foreground font-medium ml-2">({log.user.role})</span>
                            </p>
                            <p className="text-sm font-bold text-foreground/80 mt-0.5">{log.action}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end shrink-0">
                          <span className="text-xs font-bold text-muted-foreground">{log.timestamp}</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded-md mt-1">
                            IP: {log.ip}
                          </span>
                        </div>
                      </div>

                      {log.metadata && (
                        <div className={cn(
                          "mt-3 text-sm p-3 rounded-xl border font-mono",
                          log.severity === "Critical" ? "bg-destructive/10 border-destructive/20 text-destructive" :
                          log.severity === "Warning" ? "bg-amber-100/50 border-amber-200 text-amber-800" :
                          "bg-muted border-border/50 text-muted-foreground"
                        )}>
                          {log.metadata}
                        </div>
                      )}
                      
                      <div className="mt-4 flex items-center gap-2">
                        <span className={cn(
                          "text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider flex items-center gap-1",
                          "bg-muted text-muted-foreground border border-border"
                        )}>
                          {getCategoryIcon(log.category)}
                          {log.category}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 bg-background rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-border text-muted-foreground">
                  <TerminalSquare className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-1">No logs found</h3>
                <p className="text-muted-foreground text-sm max-w-sm">No activity logs match your current filters.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
