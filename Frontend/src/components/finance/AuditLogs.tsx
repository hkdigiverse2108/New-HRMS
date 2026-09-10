import { useState } from "react";
import { Shield, Search, Filter, History, Download, ArrowUpDown } from "lucide-react";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableHeader } from "@/components/ui/sortable-header";

const mockAuditLogs = [
  { id: 'AUD-001', date: 'Oct 24, 2023 10:45 AM', user: 'Admin System', action: 'Approved Payroll Run', ip: '192.168.1.1' },
  { id: 'AUD-002', date: 'Oct 23, 2023 04:30 PM', user: 'Sarah Jenkins', action: 'Modified Budget (Engineering)', ip: '192.168.1.105' },
  { id: 'AUD-003', date: 'Oct 23, 2023 02:15 PM', user: 'Michael Chen', action: 'Exported Q3 Financial Summary', ip: '192.168.1.106' },
  { id: 'AUD-004', date: 'Oct 22, 2023 09:20 AM', user: 'Admin System', action: 'Auto-reconciled Stripe transactions', ip: '192.168.1.1' },
  { id: 'AUD-005', date: 'Oct 21, 2023 11:10 AM', user: 'Priya Patel', action: 'Created Invoice (Acme Corp)', ip: '192.168.1.112' },
  { id: 'AUD-006', date: 'Oct 20, 2023 03:45 PM', user: 'System', action: 'Failed login attempt detected', ip: 'Unknown' },
];

export function AuditLogs() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredLogs = mockAuditLogs.filter(log => 
    log.user.toLowerCase().includes(searchQuery.toLowerCase()) || 
    log.action.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const { items: sortedLogs, requestSort, sortConfig } = useSortableData(filteredLogs);

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Shield className="w-8 h-8 text-primary" />
            Financial Audit Logs
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            Immutable history log of all financial modifications and access events.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2.5 bg-primary/10 text-primary font-bold rounded-xl hover:bg-primary/20 transition-colors shadow-sm flex items-center gap-2">
            <Download className="w-4 h-4" /> Export Logs
          </button>
        </div>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/20 rounded-3xl p-4 flex gap-4 text-amber-700/90 dark:text-amber-500">
        <Shield className="w-6 h-6 shrink-0 mt-0.5" />
        <div className="text-sm">
          <strong className="font-black">Compliance Notice:</strong> These records are immutable and cannot be deleted or modified. They are maintained for SOX and internal compliance auditing purposes.
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-card border border-border/50 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-border/50 flex flex-col md:flex-row justify-between items-center gap-4">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-500" />
            System Events
          </h3>
          <div className="flex gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search logs by action or user..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-background border border-border/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
              />
            </div>
            <button className="p-2 border border-border/50 rounded-lg hover:bg-muted/50 text-muted-foreground transition-colors">
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-muted/30 text-muted-foreground text-xs font-bold uppercase tracking-wider">
              <tr>
                <SortableHeader label="Timestamp" sortKey="date" currentSort={sortConfig} onSort={requestSort} className="p-4 pl-6" />
                <SortableHeader label="User / Actor" sortKey="user" currentSort={sortConfig} onSort={requestSort} className="p-4" />
                <SortableHeader label="Action Event" sortKey="action" currentSort={sortConfig} onSort={requestSort} className="p-4" />
                <SortableHeader label="IP Address" sortKey="ip" currentSort={sortConfig} onSort={requestSort} className="p-4 pr-6" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {sortedLogs.map((log, idx) => (
                <tr key={idx} className="hover:bg-muted/20 transition-colors">
                  <td className="p-4 pl-6">
                    <div className="font-bold text-sm text-foreground">{log.date.split(' ')[0]} {log.date.split(' ')[1]}</div>
                    <div className="text-xs text-muted-foreground">{log.date.split(' ')[2]} {log.date.split(' ')[3]}</div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        log.user.includes('System') ? 'bg-indigo-500/10 text-indigo-500' : 'bg-primary/10 text-primary'
                      }`}>
                        {log.user.charAt(0)}
                      </div>
                      <span className="font-bold text-sm text-foreground">{log.user}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="font-medium text-sm text-foreground">{log.action}</span>
                  </td>
                  <td className="p-4 pr-6 font-mono text-xs text-muted-foreground">
                    {log.ip}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-border/50 text-center text-sm font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
          Load More Audit Logs
        </div>
      </div>

    </div>
  );
}
