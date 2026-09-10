import { useState, useEffect } from "react";
import { Shield, ShieldAlert, CheckCircle, Monitor, Send, ShieldCheck, AlertTriangle, Search, Plus, Trash2, RefreshCw } from "lucide-react";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { moveToRecycleBin } from "@/lib/recycle-bin";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableHeader } from "@/components/ui/sortable-header";

const mockPcs = [
  { id: 1, hostname: 'DESKTOP-DEV-01', user: 'Sarah Jenkins', ip: '192.168.1.105', os: 'Windows 11', restricted: true },
  { id: 2, hostname: 'MAC-MARKETING-02', user: 'Michael Chen', ip: '192.168.1.106', os: 'macOS Sonoma', restricted: false },
  { id: 3, hostname: 'DESKTOP-HR-03', user: 'Priya Patel', ip: '192.168.1.112', os: 'Windows 10', restricted: true },
  { id: 4, hostname: 'MAC-ENG-04', user: 'David Kumar', ip: '192.168.1.140', os: 'macOS Sequoia', restricted: false },
];

const mockAlerts = [
  { id: 1, type: 'revoked', hostname: 'MAC-MARKETING-02', details: 'Accessibility permissions revoked for HRMS Monitor', time: '10 mins ago', resolved: false },
  { id: 2, type: 'restored', hostname: 'DESKTOP-DEV-01', details: 'Background process termination detected and recovered', time: '2 hours ago', resolved: true },
];

export function Restrictions() {
  const [activeTab, setActiveTab] = useState<"pcs" | "broadcast" | "alerts">("pcs");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingPc, setEditingPc] = useState<any>(null);
  
  const [blockApps, setBlockApps] = useState<string[]>(() => {
    const saved = (typeof window !== 'undefined' ? localStorage.getItem('hrms_block_apps') : null);
    return saved ? JSON.parse(saved) : ["spotify.exe"];
  });
  
  const [blockUrls, setBlockUrls] = useState<string[]>(() => {
    const saved = (typeof window !== 'undefined' ? localStorage.getItem('hrms_block_urls') : null);
    return saved ? JSON.parse(saved) : ["facebook.com", "instagram.com"];
  });

  useEffect(() => { localStorage.setItem('hrms_block_apps', JSON.stringify(blockApps)); }, [blockApps]);
  useEffect(() => { localStorage.setItem('hrms_block_urls', JSON.stringify(blockUrls)); }, [blockUrls]);

  const [blockChrome, setBlockChrome] = useState(false);
  const [blockYoutube, setBlockYoutube] = useState(true);

  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, idx: number | null, type: 'app' | 'url' | null, name: string}>({isOpen: false, idx: null, type: null, name: ""});

  const confirmDelete = () => {
    if (deleteConfirm.idx !== null && deleteConfirm.type) {
      if (deleteConfirm.type === 'app') {
        const item = blockApps[deleteConfirm.idx];
        if (item) {
          moveToRecycleBin('Restricted App', item, item, 'hrms_block_apps');
          setBlockApps(blockApps.filter((_, i) => i !== deleteConfirm.idx));
        }
      } else {
        const item = blockUrls[deleteConfirm.idx];
        if (item) {
          moveToRecycleBin('Restricted URL', item, item, 'hrms_block_urls');
          setBlockUrls(blockUrls.filter((_, i) => i !== deleteConfirm.idx));
        }
      }
    }
    setDeleteConfirm({ isOpen: false, idx: null, type: null, name: "" });
  };

  const filteredPcs = mockPcs.filter(pc => 
    pc.hostname.toLowerCase().includes(searchQuery.toLowerCase()) || 
    pc.ip.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const { items: sortedPcs, requestSort, sortConfig } = useSortableData(filteredPcs);

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Shield className="w-8 h-8 text-primary" />
            Restrictions & Policies
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            Configure PC-level restrictions, software blockers, and send system-wide announcements.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/50 gap-6">
        <button
          className={`pb-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === "pcs"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("pcs")}
        >
          PC Restrictions (4)
        </button>
        <button
          className={`pb-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === "broadcast"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("broadcast")}
        >
          Live Broadcast
        </button>
        <button
          className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "alerts"
              ? "border-red-500 text-red-500"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("alerts")}
        >
          <AlertTriangle className="w-4 h-4" />
          Security Alerts
          <span className="bg-red-500 text-white text-[10px] font-black rounded-full px-2 py-0.5 ml-1">1</span>
        </button>
      </div>

      {/* PC Restrictions Tab */}
      {activeTab === "pcs" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          
          {/* PC List */}
          <div className="xl:col-span-2 bg-card border border-border/50 rounded-3xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4">
              <h3 className="font-bold flex items-center gap-2">
                <Monitor className="w-5 h-5 text-primary" />
                Registered PC Devices
              </h3>
              <div className="flex gap-2 w-full sm:w-auto">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search PC / IP..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-background border border-border/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
                  />
                </div>
                <button className="p-2 bg-muted/50 hover:bg-muted border border-border/50 rounded-lg transition-colors">
                  <RefreshCw className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted/30 border-b border-border/50 text-muted-foreground font-bold text-xs uppercase tracking-wider">
                    <SortableHeader label="Hostname" sortKey="hostname" currentSort={sortConfig} onSort={requestSort} className="p-4 pl-6" />
                    <SortableHeader label="Active User" sortKey="user" currentSort={sortConfig} onSort={requestSort} className="p-4" />
                    <SortableHeader label="IP Address" sortKey="ip" currentSort={sortConfig} onSort={requestSort} className="p-4" />
                    <SortableHeader label="OS" sortKey="os" currentSort={sortConfig} onSort={requestSort} className="p-4" />
                    <SortableHeader label="Status" sortKey="restricted" currentSort={sortConfig} onSort={requestSort} className="p-4" />
                    <th className="p-4 pr-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {sortedPcs.map(pc => (
                    <tr key={pc.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-4 pl-6 font-mono font-bold text-sm text-foreground">{pc.hostname}</td>
                      <td className="p-4 font-bold text-sm text-muted-foreground">{pc.user}</td>
                      <td className="p-4 font-mono text-sm text-muted-foreground">{pc.ip}</td>
                      <td className="p-4 text-sm text-muted-foreground font-medium">{pc.os}</td>
                      <td className="p-4">
                        {pc.restricted ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 border border-amber-500/20">
                            <ShieldAlert className="w-3.5 h-3.5" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                            <CheckCircle className="w-3.5 h-3.5" /> Free
                          </span>
                        )}
                      </td>
                      <td className="p-4 pr-6 text-right">
                        <button 
                          onClick={() => setEditingPc(pc)}
                          className="px-3 py-1.5 text-xs font-bold bg-muted hover:bg-primary/10 hover:text-primary transition-colors rounded-md border border-border/50"
                        >
                          Edit Policy
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Policy Editor */}
          <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm flex flex-col h-fit">
            <h3 className="font-bold flex items-center gap-2 mb-6">
              <Shield className="w-5 h-5 text-indigo-500" />
              {editingPc ? `Policy: ${editingPc.hostname}` : "Select a PC"}
            </h3>
            
            {editingPc ? (
              <div className="space-y-6">
                
                {/* Toggles */}
                <div className="space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className={`w-10 h-6 rounded-full transition-colors relative ${blockChrome ? 'bg-primary' : 'bg-muted border border-border/50'}`} onClick={() => setBlockChrome(!blockChrome)}>
                      <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${blockChrome ? 'translate-x-5' : 'translate-x-1'}`} />
                    </div>
                    <span className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">Block Google Chrome entirely</span>
                  </label>
                  <label className={`flex items-center gap-3 cursor-pointer group ${blockChrome ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div className={`w-10 h-6 rounded-full transition-colors relative ${blockYoutube ? 'bg-primary' : 'bg-muted border border-border/50'}`} onClick={() => setBlockYoutube(!blockYoutube)}>
                      <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${blockYoutube ? 'translate-x-5' : 'translate-x-1'}`} />
                    </div>
                    <span className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">Block YouTube (Auto-close tab)</span>
                  </label>
                </div>

                <div className="w-full h-px bg-border/50" />

                {/* Block Apps */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Block Additional Apps (.exe / .app)
                  </label>
                  {blockApps.map((app, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input 
                        type="text" 
                        value={app}
                        onChange={(e) => {
                          const newApps = [...blockApps];
                          newApps[idx] = e.target.value;
                          setBlockApps(newApps);
                        }}
                        className="flex-1 px-3 py-2 bg-background border border-border/50 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                      <button 
                        onClick={() => setDeleteConfirm({ isOpen: true, idx, type: 'app', name: app || 'Empty Rule' })}
                        className="p-2 border border-border/50 rounded-lg hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button 
                    onClick={() => setBlockApps([...blockApps, ""])}
                    className="w-full py-2 border border-dashed border-border/50 rounded-lg text-xs font-bold text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Add App
                  </button>
                </div>

                {/* Block URLs */}
                <div className={`space-y-3 ${blockChrome ? 'opacity-50 pointer-events-none' : ''}`}>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Block Additional Website Domains
                  </label>
                  {blockUrls.map((url, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input 
                        type="text" 
                        value={url}
                        onChange={(e) => {
                          const newUrls = [...blockUrls];
                          newUrls[idx] = e.target.value;
                          setBlockUrls(newUrls);
                        }}
                        className="flex-1 px-3 py-2 bg-background border border-border/50 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                      <button 
                        onClick={() => setDeleteConfirm({ isOpen: true, idx, type: 'url', name: url || 'Empty Rule' })}
                        className="p-2 border border-border/50 rounded-lg hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button 
                    onClick={() => setBlockUrls([...blockUrls, ""])}
                    className="w-full py-2 border border-dashed border-border/50 rounded-lg text-xs font-bold text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Add Domain
                  </button>
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setEditingPc(null)} className="flex-1 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl shadow-sm hover:opacity-90 transition-opacity text-sm">
                    Apply Rules
                  </button>
                  <button onClick={() => setEditingPc(null)} className="flex-1 py-2.5 bg-muted text-foreground font-bold rounded-xl hover:bg-muted/80 transition-colors text-sm">
                    Cancel
                  </button>
                </div>

              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-muted/20 border border-dashed border-border/50 rounded-2xl">
                <Shield className="w-10 h-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-bold text-muted-foreground">No PC Selected</p>
                <p className="text-xs text-muted-foreground mt-1">Select a PC from the table to edit its software and web restrictions.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Broadcast Tab */}
      {activeTab === "broadcast" && (
        <div className="max-w-2xl bg-card border border-border/50 rounded-3xl p-8 shadow-sm">
          <h3 className="font-bold flex items-center gap-2 mb-8 text-xl">
            <Send className="w-6 h-6 text-primary" />
            Live System Broadcast
          </h3>
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Announcement Title</label>
              <input 
                type="text" 
                placeholder="e.g. Urgent Scheduled Maintenance"
                className="w-full px-4 py-3 bg-background border border-border/50 rounded-xl font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Message Content</label>
              <textarea 
                rows={5}
                placeholder="Type the message that will pop up on all logged-in PCs immediately..."
                className="w-full px-4 py-3 bg-background border border-border/50 rounded-xl font-medium text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm resize-none"
              />
            </div>
            <button className="w-full py-4 bg-primary text-primary-foreground font-black rounded-xl shadow-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 text-base">
              <Send className="w-5 h-5" />
              Send Broadcast
            </button>
          </div>
        </div>
      )}

      {/* Security Alerts Tab */}
      {activeTab === "alerts" && (
        <div className="max-w-4xl space-y-6">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex gap-4 text-amber-700/90 dark:text-amber-500">
            <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" />
            <div className="text-sm">
              <strong className="font-black">macOS Bypass Detection:</strong> When an employee goes to System Settings → Privacy & Security → Accessibility and removes the HRMS Tracker, an alert is logged here automatically. The system will force the settings page back open until re-granted.
            </div>
          </div>

          <div className="space-y-4">
            {mockAlerts.map(alert => (
              <div key={alert.id} className={`p-6 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all ${alert.resolved ? 'bg-muted/30 border-border/50 opacity-60' : alert.type === 'revoked' ? 'bg-red-500/5 border-red-500/20' : 'bg-emerald-500/5 border-emerald-500/20'}`}>
                <div className="flex gap-4 items-start">
                  <div className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center shadow-sm ${alert.resolved ? 'bg-muted text-muted-foreground' : alert.type === 'revoked' ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                    {alert.type === 'revoked' ? <ShieldAlert className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-foreground text-lg">{alert.hostname}</span>
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${alert.resolved ? 'bg-muted border-border/50 text-muted-foreground' : alert.type === 'revoked' ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'}`}>
                        {alert.type === 'revoked' ? 'Permission Revoked' : 'Recovered'}
                      </span>
                    </div>
                    <p className="font-medium text-sm text-foreground">{alert.details}</p>
                    <p className="text-xs font-bold text-muted-foreground">{alert.time}</p>
                  </div>
                </div>
                {!alert.resolved && (
                  <button className="px-4 py-2 shrink-0 bg-background border border-border/50 hover:bg-muted font-bold text-sm rounded-xl shadow-sm transition-colors">
                    Mark Resolved
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmModal 
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, idx: null, type: null, name: "" })}
        onConfirm={confirmDelete}
        title={`Remove Blocked ${deleteConfirm.type === 'app' ? 'App' : 'Domain'}`}
        description={`Are you sure you want to remove "${deleteConfirm.name}" from the blocklist?`}
        itemName={deleteConfirm.name}
      />
    </div>
  );
}
