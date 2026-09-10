import { useState, useEffect } from "react";
import { Download, Plus, Edit3, Trash2, ArrowUpRight, ArrowDownRight, Search, FileText, ChevronRight, Briefcase, Calendar, Info, X, Users, Filter, ChevronDown, Landmark } from "lucide-react";
import { DialogClose,  Dialog, DialogContent  } from "@/components/ui/dialog";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { moveToRecycleBin } from "@/lib/recycle-bin";
import { SearchableSelect } from "@/components/ui/select";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableHeader } from "@/components/ui/sortable-header";

const mockClientData = [
  {
    clientName: "Acme Corp",
    totalInflow: 150000,
    totalOutflow: 10000,
    netBalance: 140000,
    transactions: [
      { id: 'TX-001', date: '2023-10-15', type: 'inflow', amount: 150000, desc: 'Project Advance', method: 'Wire Transfer', remarks: 'Q4 Contract', bankId: 'b1' },
      { id: 'TX-002', date: '2023-10-20', type: 'outflow', amount: 10000, desc: 'Hardware Refund', method: 'Bank Transfer', remarks: 'Defective units', bankId: 'b1' },
    ]
  },
  {
    clientName: "Global Tech Services",
    totalInflow: 0,
    totalOutflow: 45000,
    netBalance: -45000,
    transactions: [
      { id: 'TX-003', date: '2023-10-22', type: 'outflow', amount: 45000, desc: 'Consulting Fees', method: 'ACH', remarks: 'Sept invoice', bankId: 'b1' },
    ]
  }
];

export function OtherTransactions() {
  const [clientData, setClientData] = useState(() => {
    const saved = (typeof window !== 'undefined' ? localStorage.getItem('hrms_other_transactions') : null);
    return saved ? JSON.parse(saved) : mockClientData;
  });
  
  useEffect(() => { localStorage.setItem('hrms_other_transactions', JSON.stringify(clientData)); }, [clientData]);

  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, clientId: string, txId: string, desc: string}>({isOpen: false, clientId: "", txId: "", desc: ""});
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedClients, setExpandedClients] = useState<string[]>(["Acme Corp"]);

  // Sorting for clients
  const { items: sortedClients, requestSort, sortConfig } = useSortableData(clientData);

  // Modal States
  const [isAddTxOpen, setIsAddTxOpen] = useState(false);
  const [isManageClientOpen, setIsManageClientOpen] = useState(false);
  const [isManageBanksOpen, setIsManageBanksOpen] = useState(false);

  const [banksData, setBanksData] = useState(() => {
    const saved = (typeof window !== 'undefined' ? localStorage.getItem('hrms_banks') : null);
    return saved ? JSON.parse(saved) : [{ id: 'b1', name: 'HDFC Bank', openingBalance: 500000 }];
  });
  
  useEffect(() => { localStorage.setItem('hrms_banks', JSON.stringify(banksData)); }, [banksData]);

  const [newBankName, setNewBankName] = useState("");
  const [newBankBalance, setNewBankBalance] = useState("");

  const [addTxType, setAddTxType] = useState("Inflow (Received)");
  const [addTxMethod, setAddTxMethod] = useState("Wire Transfer");
  const [addTxBank, setAddTxBank] = useState("b1");
  
  const [manageTxType, setManageTxType] = useState("Inflow (Received)");
  const [manageTxMethod, setManageTxMethod] = useState("Wire Transfer");
  const [manageTxBank, setManageTxBank] = useState("b1");

  const toggleExpand = (clientName: string) => {
    setExpandedClients(prev => 
      prev.includes(clientName) 
        ? prev.filter(c => c !== clientName)
        : [...prev, clientName]
    );
  };

  const confirmDelete = () => {
    if (deleteConfirm.txId) {
      setClientData((prev: any[]) => prev.map((client: any) => {
        if (client.clientName === deleteConfirm.clientId) {
          const txToDelete = client.transactions.find((t: any) => t.id === deleteConfirm.txId);
          if (txToDelete) {
            moveToRecycleBin('Other Transaction', `TX ${txToDelete.id}`, txToDelete, 'hrms_other_transactions', {
              parentId: client.clientName,
              parentKey: 'clientName',
              nestedArrayKey: 'transactions'
            });
          }
          return {
            ...client,
            transactions: client.transactions.filter((t: any) => t.id !== deleteConfirm.txId)
          };
        }
        return client;
      }));
    }
    setDeleteConfirm({ isOpen: false, clientId: "", txId: "", desc: "" });
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500 pb-12 relative">
      
      {/* Header */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Client & External Transactions
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            Manage ledgers, track total inflows/outflows, and net balances per client or external entity.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button 
            onClick={() => setIsManageBanksOpen(true)}
            className="px-4 py-2 bg-background border border-border/50 text-foreground font-bold rounded-lg hover:bg-muted/50 transition-colors shadow-sm flex items-center gap-2 text-sm"
          >
            <Landmark className="w-4 h-4 text-emerald-500" /> Manage Banks
          </button>
          <button className="px-4 py-2 bg-background border border-border/50 text-foreground font-bold rounded-lg hover:bg-muted/50 transition-colors shadow-sm flex items-center gap-2 text-sm">
            <Download className="w-4 h-4 text-indigo-500" /> Export Ledgers
          </button>
          <button 
            onClick={() => setIsAddTxOpen(true)}
            className="px-4 py-2 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90 transition-opacity shadow-sm flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" /> Add Transaction
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-background border border-border/50 rounded-2xl p-3 flex flex-wrap items-center gap-4 shadow-sm justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground pl-2">
            <Filter className="w-4 h-4" /> Filters:
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground font-medium">From:</span>
            <div className="relative">
              <input type="text" placeholder="dd/mm/yyyy" className="pl-3 pr-8 py-1.5 bg-background border border-border/50 rounded-lg text-sm w-32 focus:outline-none focus:ring-2 focus:ring-primary/20" />
              <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground font-medium">To:</span>
            <div className="relative">
              <input type="text" placeholder="dd/mm/yyyy" className="pl-3 pr-8 py-1.5 bg-background border border-border/50 rounded-lg text-sm w-32 focus:outline-none focus:ring-2 focus:ring-primary/20" />
              <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            </div>
          </div>
        </div>
        
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search clients or entities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-background border border-border/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
          />
        </div>
      </div>

      {/* Expandable Data Table */}
      <div className="bg-card border border-border/50 rounded-2xl shadow-sm flex flex-col overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead className="bg-muted/30 text-muted-foreground font-extrabold uppercase tracking-wider text-xs border-b border-border/50">
              <tr>
                <th className="p-4 w-12 text-center"></th>
                <SortableHeader 
                  label="Category"
                  sortKey="clientName"
                  currentSort={sortConfig}
                  onSort={requestSort}
                  className="p-4"
                />
                <SortableHeader 
                  label="Total Inflow"
                  sortKey="totalInflow"
                  currentSort={sortConfig}
                  onSort={requestSort}
                  className="p-4 text-emerald-600 dark:text-emerald-500"
                />
                <SortableHeader 
                  label="Total Outflow"
                  sortKey="totalOutflow"
                  currentSort={sortConfig}
                  onSort={requestSort}
                  className="p-4 text-rose-600 dark:text-rose-500"
                />
                <SortableHeader 
                  label="Net Balance"
                  sortKey="netBalance"
                  currentSort={sortConfig}
                  onSort={requestSort}
                  className="p-4 text-indigo-600 dark:text-indigo-400"
                />
                <th className="p-4 pr-6 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {sortedClients.filter((c: any) => c.clientName.toLowerCase().includes(searchQuery.toLowerCase())).map((client: any, idx: number) => {
                const isExpanded = expandedClients.includes(client.clientName);
                
                return (
                  <div key={client.clientName} className="contents">
                    {/* Summary Row */}
                    <tr 
                      onClick={() => toggleExpand(client.clientName)}
                      className="hover:bg-muted/30 cursor-pointer transition-colors group"
                    >
                      <td className="p-4 text-center">
                        <div className="flex justify-center">
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                          )}
                        </div>
                      </td>
                      <td className="p-4 font-black text-foreground">
                        {client.clientName}
                      </td>
                      <td className="p-4 font-bold text-emerald-600 dark:text-emerald-500">
                        ₹{client.totalInflow.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 font-bold text-rose-600 dark:text-rose-500">
                        ₹{client.totalOutflow.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 font-black text-indigo-600 dark:text-indigo-400">
                        ₹{client.netBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 pr-6 text-center" onClick={(e) => e.stopPropagation()}>
                        <button 
                          onClick={() => setIsManageClientOpen(true)}
                          className="px-3 py-1.5 text-xs font-bold bg-background border border-border/50 hover:bg-muted transition-colors rounded-md shadow-sm"
                        >
                          Manage
                        </button>
                      </td>
                    </tr>

                    {/* Nested Transactions Row */}
                    {isExpanded && (
                      <tr className="bg-muted/10">
                        <td colSpan={6} className="p-4 pl-12 pr-6">
                          <div className="border border-border/50 rounded-xl overflow-hidden shadow-inner bg-card">
                            <table className="w-full text-left">
                              <thead className="bg-muted/30 border-b border-border/50 text-muted-foreground text-[10px] font-black uppercase tracking-widest">
                                <tr>
                                  <th className="p-3 pl-4">Date</th>
                                  <th className="p-3">Type</th>
                                  <th className="p-3 text-right">Amount</th>
                                  <th className="p-3">Description</th>
                                  <th className="p-3">Method</th>
                                  <th className="p-3">Bank</th>
                                  <th className="p-3">Remarks</th>
                                  <th className="p-3 pr-4 text-center">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/50 text-xs">
                                {client.transactions.map((tx: any) => (
                                  <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                                    <td className="p-3 pl-4 font-medium flex items-center gap-1.5 text-muted-foreground">
                                      <Calendar className="w-3.5 h-3.5" />
                                      {tx.date}
                                    </td>
                                    <td className="p-3">
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                        tx.type === "inflow" 
                                          ? "bg-emerald-500/10 text-emerald-600" 
                                          : "bg-rose-500/10 text-rose-600"
                                      }`}>
                                        {tx.type}
                                      </span>
                                    </td>
                                    <td className={`p-3 text-right font-black ${
                                      tx.type === "inflow" ? "text-emerald-600" : "text-rose-600"
                                    }`}>
                                      ₹{tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-3 font-bold text-foreground">{tx.desc}</td>
                                    <td className="p-3 font-medium text-muted-foreground">{tx.method}</td>
                                    <td className="p-3 font-medium text-muted-foreground">
                                      {banksData.find((b: any) => b.id === tx.bankId)?.name || 'N/A'}
                                    </td>
                                    <td className="p-3 font-medium text-muted-foreground">{tx.remarks}</td>
                                    <td className="p-3 pr-4 text-center">
                                      <div className="flex items-center justify-center gap-2">
                                        <button 
                                          onClick={() => {
                                            setAddTxType(tx.type === "inflow" ? "Inflow (Received)" : "Outflow (Paid)");
                                            setAddTxMethod(tx.method);
                                            setAddTxBank(tx.bankId || banksData[0]?.id || "");
                                            setIsAddTxOpen(true);
                                            // Pre-fill inputs after modal dialog updates
                                            setTimeout(() => {
                                              const categoryInput = document.querySelector('input[placeholder="e.g. Software Sales"]') as HTMLInputElement;
                                              const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
                                              const amountInput = document.querySelector('input[placeholder="0.00"]') as HTMLInputElement;
                                              const descInput = document.querySelector('input[placeholder="Short description"]') as HTMLInputElement;
                                              const remarksInput = document.querySelector('textarea[placeholder="Any additional notes"]') as HTMLInputElement;
                                              if (categoryInput) categoryInput.value = client.clientName;
                                              if (dateInput) dateInput.value = tx.date;
                                              if (amountInput) amountInput.value = tx.amount.toString();
                                              if (descInput) descInput.value = tx.desc;
                                              if (remarksInput) remarksInput.value = tx.remarks;
                                            }, 50);
                                          }} 
                                          className="text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                          <Edit3 className="w-3.5 h-3.5" />
                                        </button>
                                        <button 
                                          onClick={() => setDeleteConfirm({ isOpen: true, clientId: client.clientName, txId: tx.id, desc: tx.desc })}
                                          className="text-rose-500 hover:text-rose-600 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </div>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- ADD / EDIT TRANSACTION MODAL --- */}
      <Dialog open={isAddTxOpen} onOpenChange={setIsAddTxOpen}>
        <DialogContent className="max-w-lg p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className="p-4 border-b border-border/50 flex justify-between items-center bg-primary/5">
              <div>
                <h3 className="font-black text-lg text-foreground">Add/Edit Client Transaction</h3>
                <p className="text-xs font-medium text-muted-foreground">Record a new inflow or outflow.</p>
              </div>
              <button onClick={() => setIsAddTxOpen(false)} className="p-2 hover:bg-muted rounded-full transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="p-6 md:p-8 space-y-6 overflow-y-auto max-h-[70vh]">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Category *</label>
                <input type="text" placeholder="e.g. Software Sales" className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Date *</label>
                  <input type="date" className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Transaction Type *</label>
                  <SearchableSelect
                    value={addTxType}
                    onChange={setAddTxType}
                    options={[
                      { label: "Inflow (Received)", value: "Inflow (Received)" },
                      { label: "Outflow (Paid)", value: "Outflow (Paid)" }
                    ]}
                    className="w-full h-[40px] px-3 bg-background border border-border/50 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Amount (₹) *</label>
                  <input type="number" placeholder="0.00" className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Payment Method</label>
                  <SearchableSelect
                    value={addTxMethod}
                    onChange={setAddTxMethod}
                    options={[
                      { label: "Wire Transfer", value: "Wire Transfer" },
                      { label: "Bank Transfer", value: "Bank Transfer" },
                      { label: "ACH", value: "ACH" },
                      { label: "Cash", value: "Cash" }
                    ]}
                    className="w-full h-[40px] px-3 bg-background border border-border/50 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Bank Account *</label>
                  <SearchableSelect
                    value={addTxBank}
                    onChange={setAddTxBank}
                    options={banksData.map((b: any) => ({ label: b.name, value: b.id }))}
                    className="w-full h-[40px] px-3 bg-background border border-border/50 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Description</label>
                  <input type="text" placeholder="Short description" className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Remarks / Notes</label>
                <textarea rows={2} placeholder="Any additional notes" className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
            </div>
            <div className="px-6 md:px-8 py-4 md:py-6 bg-muted/30 border-t border-border/50 flex justify-end gap-3 mt-auto shrink-0">
              <button onClick={() => setIsAddTxOpen(false)} className="px-4 py-2 font-bold text-sm bg-background border border-border/50 rounded-lg hover:bg-muted transition-colors text-muted-foreground">Cancel</button>
              <button onClick={() => setIsAddTxOpen(false)} className="px-4 py-2 font-bold text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-sm">Save Transaction</button>
            </div>
        </DialogContent>
      </Dialog>

      {/* --- MANAGE CLIENT MODAL --- */}
      <Dialog open={isManageClientOpen} onOpenChange={setIsManageClientOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className="p-4 border-b border-border/50 flex justify-between items-center bg-indigo-500/5 shrink-0">
              <div>
                <h3 className="font-black text-lg text-foreground">Manage Category: Software Sales</h3>
                <p className="text-xs font-medium text-muted-foreground">View summaries and add new transactions quickly.</p>
              </div>
              <button onClick={() => setIsManageClientOpen(false)} className="p-2 hover:bg-muted rounded-full transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            
            <div className="p-6 md:p-8 space-y-6 overflow-y-auto max-h-[70vh]">
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-500 mb-1">Total Inflow</div>
                  <div className="text-xl font-black text-emerald-700 dark:text-emerald-400">₹150,000</div>
                </div>
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-500 mb-1">Total Outflow</div>
                  <div className="text-xl font-black text-rose-700 dark:text-rose-400">₹10,000</div>
                </div>
                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-1">Net Balance</div>
                  <div className="text-xl font-black text-indigo-700 dark:text-indigo-300">₹140,000</div>
                </div>
              </div>

              <div className="h-px bg-border/50 w-full" />

              {/* Quick Add Form */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-foreground">Add New Transaction</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Date *</label>
                    <input type="date" className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Transaction Type *</label>
                    <SearchableSelect
                      value={manageTxType}
                      onChange={setManageTxType}
                      options={[
                        { label: "Inflow (Received)", value: "Inflow (Received)" },
                        { label: "Outflow (Paid)", value: "Outflow (Paid)" }
                      ]}
                      className="w-full h-[40px] px-3 bg-background border border-border/50 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Amount (₹) *</label>
                    <input type="number" placeholder="0.00" className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Payment Method</label>
                    <SearchableSelect
                      value={manageTxMethod}
                      onChange={setManageTxMethod}
                      options={[
                        { label: "Wire Transfer", value: "Wire Transfer" },
                        { label: "Bank Transfer", value: "Bank Transfer" },
                        { label: "ACH", value: "ACH" },
                        { label: "Cash", value: "Cash" }
                      ]}
                      className="w-full h-[40px] px-3 bg-background border border-border/50 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Bank Account *</label>
                    <SearchableSelect
                      value={manageTxBank}
                      onChange={setManageTxBank}
                      options={banksData.map((b: any) => ({ label: b.name, value: b.id }))}
                      className="w-full h-[40px] px-3 bg-background border border-border/50 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Description & Remarks</label>
                    <input type="text" placeholder="Short description or narrative" className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 md:px-8 py-4 md:py-6 bg-muted/30 border-t border-border/50 flex justify-end gap-3 mt-auto shrink-0">
              <button onClick={() => setIsManageClientOpen(false)} className="px-4 py-2 font-bold text-sm bg-background border border-border/50 rounded-lg hover:bg-muted transition-colors text-muted-foreground">Close</button>
              <button onClick={() => setIsManageClientOpen(false)} className="px-4 py-2 font-bold text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">Save Transaction</button>
            </div>
        </DialogContent>
      </Dialog>

      {/* --- MANAGE BANKS MODAL --- */}
      <Dialog open={isManageBanksOpen} onOpenChange={setIsManageBanksOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className="p-4 border-b border-border/50 flex justify-between items-center bg-emerald-500/5 shrink-0">
            <div>
              <h3 className="font-black text-lg text-foreground">Manage Bank Accounts</h3>
              <p className="text-xs font-medium text-muted-foreground">Add new banks and view current balances.</p>
            </div>
            <button onClick={() => setIsManageBanksOpen(false)} className="p-2 hover:bg-muted rounded-full transition-colors">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          
          <div className="p-6 md:p-8 space-y-6 overflow-y-auto max-h-[70vh]">
            {/* Add Bank Form */}
            <div className="bg-muted/30 border border-border/50 rounded-xl p-4 space-y-4">
              <h4 className="text-sm font-bold text-foreground">Add New Bank</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Bank Name *</label>
                  <input 
                    type="text" 
                    value={newBankName}
                    onChange={(e) => setNewBankName(e.target.value)}
                    placeholder="e.g. HDFC Current Account" 
                    className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20" 
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Opening Balance (₹) *</label>
                  <input 
                    type="number" 
                    value={newBankBalance}
                    onChange={(e) => setNewBankBalance(e.target.value)}
                    placeholder="0.00" 
                    className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20" 
                  />
                </div>
              </div>
              <button 
                onClick={() => {
                  if (newBankName && newBankBalance) {
                    const newBank = {
                      id: `b${Date.now()}`,
                      name: newBankName,
                      openingBalance: parseFloat(newBankBalance)
                    };
                    setBanksData([...banksData, newBank]);
                    setNewBankName("");
                    setNewBankBalance("");
                  }
                }}
                className="w-full md:w-auto px-4 py-2 bg-emerald-600 text-white font-bold text-sm rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
              >
                Add Bank Account
              </button>
            </div>

            {/* Banks List */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-foreground">Current Accounts</h4>
              <div className="border border-border/50 rounded-xl overflow-hidden shadow-inner bg-card">
                <table className="w-full text-left">
                  <thead className="bg-muted/30 border-b border-border/50 text-muted-foreground text-[10px] font-black uppercase tracking-widest">
                    <tr>
                      <th className="p-3 pl-4">Bank Name</th>
                      <th className="p-3 text-right">Opening Balance</th>
                      <th className="p-3 text-right">Current Balance</th>
                      <th className="p-3 pr-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50 text-sm">
                    {banksData.map((bank: any) => {
                      let currentBalance = bank.openingBalance;
                      let hasTransactions = false;
                      clientData.forEach((client: any) => {
                        client.transactions.forEach((tx: any) => {
                          if (tx.bankId === bank.id) {
                            hasTransactions = true;
                            if (tx.type === 'inflow') currentBalance += tx.amount;
                            else if (tx.type === 'outflow') currentBalance -= tx.amount;
                          }
                        });
                      });

                      return (
                        <tr key={bank.id} className="hover:bg-muted/30 transition-colors">
                          <td className="p-3 pl-4 font-bold text-foreground flex items-center gap-2">
                            <Landmark className="w-4 h-4 text-emerald-500" />
                            {bank.name}
                          </td>
                          <td className="p-3 text-right font-medium text-muted-foreground">
                            ₹{bank.openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-3 text-right font-black text-emerald-600 dark:text-emerald-500">
                            ₹{currentBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-3 pr-4 text-center">
                            <button 
                              disabled={hasTransactions}
                              onClick={() => {
                                if (!hasTransactions) {
                                  setBanksData(banksData.filter((b: any) => b.id !== bank.id));
                                }
                              }}
                              className={`text-rose-500 transition-colors ${hasTransactions ? 'opacity-30 cursor-not-allowed' : 'hover:text-rose-600'}`}
                              title={hasTransactions ? "Cannot delete bank with associated transactions" : "Delete Bank"}
                            >
                              <Trash2 className="w-4 h-4 mx-auto" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmModal 
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, clientId: "", txId: "", desc: "" })}
        onConfirm={confirmDelete}
        title="Delete Transaction"
        description={`Are you sure you want to completely delete transaction "${deleteConfirm.desc}"?`}
        itemName={deleteConfirm.desc}
      />
    </div>
  );
}
