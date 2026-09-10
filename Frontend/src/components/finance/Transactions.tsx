import { useState, useEffect } from "react";
import { Search, Download, Plus, RefreshCw, Wallet, Building2, Calendar, Filter, ArrowDownLeft, ArrowUpRight, ArrowRight, Edit3, Trash2, X } from "lucide-react";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { DialogClose,  Dialog, DialogContent  } from "@/components/ui/dialog";
import { moveToRecycleBin } from "@/lib/recycle-bin";
import { SearchableSelect } from "@/components/ui/select";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableHeader } from "@/components/ui/sortable-header";

const MOCK_CREDIT_TRANSACTIONS = [
  { id: 'INV-001', date: '15/6/2026', amount: 1234.00, category: 'Sales', description: 'test', service: 'fgh', remarks: '1. Payment is due w...' },
];

const MOCK_DEBIT_TRANSACTIONS = [
  { id: '2607006', date: '14/7/2026', amount: 6543.00, category: 'General', things: 'Expense', narrative: '-' },
];

export function Transactions() {
  const [creditTransactions, setCreditTransactions] = useState(() => {
    const saved = (typeof window !== 'undefined' ? localStorage.getItem('hrms_credit_transactions') : null);
    return saved ? JSON.parse(saved) : MOCK_CREDIT_TRANSACTIONS;
  });
  
  const [debitTransactions, setDebitTransactions] = useState(() => {
    const saved = (typeof window !== 'undefined' ? localStorage.getItem('hrms_debit_transactions') : null);
    return saved ? JSON.parse(saved) : MOCK_DEBIT_TRANSACTIONS;
  });

  useEffect(() => { localStorage.setItem('hrms_credit_transactions', JSON.stringify(creditTransactions)); }, [creditTransactions]);
  useEffect(() => { localStorage.setItem('hrms_debit_transactions', JSON.stringify(debitTransactions)); }, [debitTransactions]);

  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, id: string | null, type: 'credit' | 'debit'}>({isOpen: false, id: null, type: 'credit'});

  const [editCredit, setEditCredit] = useState<any | null>(null);
  const [editDebit, setEditDebit] = useState<any | null>(null);

  const openEditCredit = (trx: any) => setEditCredit({ ...trx });
  const openEditDebit = (trx: any) => setEditDebit({ ...trx });

  const saveEditCredit = () => {
    if (!editCredit) return;
    setCreditTransactions((prev: any[]) => prev.map((t: any) => t.id === editCredit.id ? editCredit : t));
    setEditCredit(null);
  };

  const saveEditDebit = () => {
    if (!editDebit) return;
    setDebitTransactions((prev: any[]) => prev.map((t: any) => t.id === editDebit.id ? editDebit : t));
    setEditDebit(null);
  };

  const [isAddCreditOpen, setIsAddCreditOpen] = useState(false);
  const [isAddDebtOpen, setIsAddDebtOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeAccountTab, setActiveAccountTab] = useState<"bank" | "cash">("cash");

  const [filterCategory, setFilterCategory] = useState("All Categories");
  const [filterSyncStatus, setFilterSyncStatus] = useState("All Entries");
  const [addCreditCategory, setAddCreditCategory] = useState("Sales");
  const [addDebtCategory, setAddDebtCategory] = useState("General");

  const { items: sortedCredit, requestSort: requestCreditSort, sortConfig: creditSortConfig } = useSortableData(creditTransactions);
  const { items: sortedDebt, requestSort: requestDebtSort, sortConfig: debtSortConfig } = useSortableData(debitTransactions);

  const confirmDelete = () => {
    if (deleteConfirm.id) {
      if (deleteConfirm.type === 'credit') {
        const item = creditTransactions.find((t: any) => t.id === deleteConfirm.id);
        if (item) moveToRecycleBin('Credit Transaction', `Invoice ${item.id}`, item, 'hrms_credit_transactions');
        setCreditTransactions(creditTransactions.filter((t: any) => t.id !== deleteConfirm.id));
      } else {
        const item = debitTransactions.find((t: any) => t.id === deleteConfirm.id);
        if (item) moveToRecycleBin('Debit Transaction', `Expense ${item.id}`, item, 'hrms_debit_transactions');
        setDebitTransactions(debitTransactions.filter((t: any) => t.id !== deleteConfirm.id));
      }
    }
    setDeleteConfirm({ isOpen: false, id: null, type: 'credit' });
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500 pb-12 relative">
      
      {/* Header */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            Financial Ledger Management
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            Track Credit (Invoices) and Debt (Expenses) with dynamic balance calculations
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button className="px-4 py-2 bg-background border border-border/50 text-foreground font-bold rounded-lg hover:bg-muted/50 transition-colors shadow-sm flex items-center gap-2 text-sm">
            <RefreshCw className="w-4 h-4 text-emerald-500" /> Sync Invoices
          </button>
          <button className="px-4 py-2 bg-background border border-border/50 text-foreground font-bold rounded-lg hover:bg-muted/50 transition-colors shadow-sm flex items-center gap-2 text-sm">
            <Wallet className="w-4 h-4 text-amber-500" /> Opening Balances
          </button>
          <button className="px-4 py-2 bg-background border border-border/50 text-foreground font-bold rounded-lg hover:bg-muted/50 transition-colors shadow-sm flex items-center gap-2 text-sm">
            <Download className="w-4 h-4 text-indigo-500" /> Export Ledger
          </button>
          <button 
            onClick={() => setIsAddCreditOpen(true)}
            className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-colors shadow-sm flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" /> Add Credit (Invoice)
          </button>
          <button 
            onClick={() => setIsAddDebtOpen(true)}
            className="px-4 py-2 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700 transition-colors shadow-sm flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" /> Add Debt (Expense)
          </button>
        </div>
      </div>

      {/* Account Tabs & Search */}
      <div className="flex flex-col md:flex-row justify-between gap-4 bg-muted/30 p-2 rounded-2xl border border-border/50">
        <div className="flex gap-2">
          <button
            className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all flex items-center gap-2 ${
              activeAccountTab === "bank"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
            onClick={() => setActiveAccountTab("bank")}
          >
            <Building2 className="w-4 h-4 text-emerald-600" /> Bank Acc Management
          </button>
          <button
            className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all flex items-center gap-2 ${
              activeAccountTab === "cash"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
            onClick={() => setActiveAccountTab("cash")}
          >
            <Wallet className="w-4 h-4 text-amber-600" /> Cash Transaction
          </button>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search invoices, expenses, narratives..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-background border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium shadow-sm"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="bg-background border border-border/50 rounded-2xl p-3 flex flex-wrap items-center gap-4 shadow-sm">
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
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground font-medium">Category:</span>
          <SearchableSelect
            value={filterCategory}
            onChange={setFilterCategory}
            options={[{ label: "All Categories", value: "All Categories" }]}
            className="w-[140px] h-[34px] pl-3 pr-3 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
          />
        </div>
        {activeAccountTab === "bank" && (
          <div className="flex items-center gap-2 text-sm ml-2 border-l border-border/50 pl-4">
            <span className="text-muted-foreground font-medium">Sync Status:</span>
            <SearchableSelect
              value={filterSyncStatus}
              onChange={setFilterSyncStatus}
              options={[{ label: "All Entries", value: "All Entries" }]}
              className="w-[130px] h-[34px] pl-3 pr-3 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            />
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        
        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl" />
          <div className="text-muted-foreground font-extrabold text-[10px] uppercase tracking-widest mb-4">
            {activeAccountTab === "bank" ? "Opening Balance" : "Opening Cash Balance"}
          </div>
          <div className="text-3xl font-black text-foreground mb-4">₹0.000</div>
          <button className="text-amber-600 font-bold text-xs flex items-center gap-1 hover:text-amber-700 transition-colors">
            Configure Opening Balance <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl" />
          <div className="text-muted-foreground font-extrabold text-[10px] uppercase tracking-widest mb-4 max-w-[140px] leading-tight">Transaction Total Credit</div>
          <div className="text-3xl font-black text-emerald-600 mb-4">+₹1.234</div>
          <div className="text-muted-foreground font-medium text-xs">1 credit entries synced</div>
        </div>

        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl" />
          <div className="text-muted-foreground font-extrabold text-[10px] uppercase tracking-widest mb-4 max-w-[140px] leading-tight">Transaction Total Debt</div>
          <div className="text-3xl font-black text-rose-600 mb-4">-₹6.543</div>
          <div className="text-muted-foreground font-medium text-xs">1 expense entries recorded</div>
        </div>

        {activeAccountTab === "bank" ? (
          <div className="bg-primary text-primary-foreground rounded-2xl p-5 shadow-sm relative overflow-hidden">
            <div className="absolute -right-12 -top-12 w-40 h-40 bg-primary-foreground/20 rounded-full blur-xl" />
            <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-primary-foreground/10 rounded-full blur-xl" />
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-3">
                <div className="font-extrabold text-[10px] uppercase tracking-widest text-primary-foreground/80 flex items-center gap-1.5">
                  <span className="text-amber-300">✨</span> Closing Balance In Bank
                </div>
                <div className="w-8 h-8 rounded-full bg-primary-foreground/20 flex items-center justify-center border border-primary-foreground/30">
                  <span className="text-sm font-bold text-primary-foreground">₹</span>
                </div>
              </div>
              <div className="text-4xl font-black mb-3 text-primary-foreground">₹973.045</div>
              <div className="text-primary-foreground/70 font-medium text-[10px] leading-tight opacity-90 max-w-[180px]">
                Opening Balance + Total Credit - Total Debt
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-primary text-primary-foreground rounded-2xl p-5 shadow-sm relative overflow-hidden">
            <div className="absolute -right-12 -top-12 w-40 h-40 bg-primary-foreground/20 rounded-full blur-xl" />
            <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-primary-foreground/10 rounded-full blur-xl" />
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-3">
                <div className="font-extrabold text-[10px] uppercase tracking-widest text-primary-foreground/80 flex items-center gap-1.5">
                  <span className="text-amber-300">✨</span> Cash In Hand
                </div>
                <div className="w-8 h-8 rounded-full bg-primary-foreground/20 flex items-center justify-center border border-primary-foreground/30">
                  <span className="text-sm font-bold text-primary-foreground">₹</span>
                </div>
              </div>
              <div className="text-4xl font-black mb-3 text-primary-foreground">₹-5.309</div>
              <div className="text-primary-foreground/70 font-medium text-[10px] leading-tight opacity-90 max-w-[180px]">
                Opening Balance + Total Credit - Total Debt
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Side-by-Side Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Credit Table */}
        <div className="bg-card border border-border/50 rounded-2xl shadow-sm flex flex-col h-full">
          <div className="p-4 border-b border-border/50 flex justify-between items-center bg-emerald-500/5 rounded-t-2xl">
            <div className="flex gap-3 items-center">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <ArrowDownLeft className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-foreground text-lg leading-none">Credit <span className="text-muted-foreground font-bold text-sm">(Income / Invoices)</span></h3>
                <p className="text-xs text-muted-foreground font-medium mt-1">Auto-synced invoices and income</p>
              </div>
            </div>
            <button 
              onClick={() => setIsAddCreditOpen(true)}
              className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-colors shadow-sm flex items-center gap-2 text-sm shrink-0"
            >
              <Plus className="w-4 h-4" /> Add Credit
            </button>
          </div>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead className="bg-background text-muted-foreground text-[10px] font-black uppercase tracking-widest border-b border-border/50">
                <tr>
                  <SortableHeader label="Date" sortKey="date" currentSort={creditSortConfig} onSort={requestCreditSort} className="p-3 pl-4" />
                  <SortableHeader label="Amount" sortKey="amount" currentSort={creditSortConfig} onSort={requestCreditSort} className="p-3" />
                  <SortableHeader label="Category" sortKey="category" currentSort={creditSortConfig} onSort={requestCreditSort} className="p-3" />
                  <SortableHeader label="Descriptions" sortKey="desc" currentSort={creditSortConfig} onSort={requestCreditSort} className="p-3" />
                  <SortableHeader label="Services" sortKey="services" currentSort={creditSortConfig} onSort={requestCreditSort} className="p-3" />
                  <SortableHeader label="Remarks" sortKey="remarks" currentSort={creditSortConfig} onSort={requestCreditSort} className="p-3" />
                  <th className="p-3 pr-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {sortedCredit.map((trx: any, idx: number) => (
                  <tr key={idx} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3 pl-4 text-xs font-bold text-muted-foreground">{trx.date}</td>
                    <td className="p-3 text-sm font-black text-emerald-600">
                      ₹{trx.amount.toLocaleString('en-IN', { minimumFractionDigits: 3 })}
                    </td>
                    <td className="p-3 text-xs font-bold text-foreground">{trx.category}</td>
                    <td className="p-3 text-xs font-medium text-foreground">{trx.description}</td>
                    <td className="p-3 text-xs font-medium text-foreground">{trx.service}</td>
                    <td className="p-3 text-xs font-medium text-muted-foreground truncate max-w-[100px]" title={trx.remarks}>{trx.remarks}</td>
                    <td className="p-3 pr-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => openEditCredit(trx)} className="text-muted-foreground hover:text-foreground transition-colors"><Edit3 className="w-3.5 h-3.5" /></button>
                        <button 
                          onClick={() => setDeleteConfirm({ isOpen: true, id: trx.id, type: 'credit' })}
                          className="text-rose-500 hover:text-rose-600 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-border/50 flex justify-between items-center bg-muted/10 rounded-b-2xl">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Transaction Total Credit</span>
            <span className="text-base font-black text-emerald-600">₹1.234</span>
          </div>
        </div>

        {/* Debt Table */}
        <div className="bg-card border border-border/50 rounded-2xl shadow-sm flex flex-col h-full">
          <div className="p-4 border-b border-border/50 flex justify-between items-center bg-rose-500/5 rounded-t-2xl">
            <div className="flex gap-3 items-center">
              <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <ArrowUpRight className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-foreground text-lg leading-none">Debt <span className="text-muted-foreground font-bold text-sm">(Expenses / Bills)</span></h3>
                <p className="text-xs text-muted-foreground font-medium mt-1">Automatic numbering (YYMMXXX format)</p>
              </div>
            </div>
            <button 
              onClick={() => setIsAddDebtOpen(true)}
              className="px-4 py-2 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700 transition-colors shadow-sm flex items-center gap-2 text-sm shrink-0"
            >
              <Plus className="w-4 h-4" /> Add Debt
            </button>
          </div>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead className="bg-background text-muted-foreground text-[10px] font-black uppercase tracking-widest border-b border-border/50">
                <tr>
                  <SortableHeader label="Expense No." sortKey="id" currentSort={debtSortConfig} onSort={requestDebtSort} className="p-3 pl-4" />
                  <SortableHeader label="Date" sortKey="date" currentSort={debtSortConfig} onSort={requestDebtSort} className="p-3" />
                  <SortableHeader label="Amount" sortKey="amount" currentSort={debtSortConfig} onSort={requestDebtSort} className="p-3" />
                  <SortableHeader label="Category" sortKey="category" currentSort={debtSortConfig} onSort={requestDebtSort} className="p-3" />
                  <SortableHeader label="Things" sortKey="things" currentSort={debtSortConfig} onSort={requestDebtSort} className="p-3" />
                  <SortableHeader label="Narrative" sortKey="narrative" currentSort={debtSortConfig} onSort={requestDebtSort} className="p-3" />
                  <th className="p-3 pr-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {sortedDebt.map((trx: any, idx: number) => (
                  <tr key={idx} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3 pl-4">
                      <span className="text-xs font-black text-foreground bg-muted/50 px-2 py-0.5 rounded-md border border-border/50">{trx.id}</span>
                    </td>
                    <td className="p-3 text-xs font-bold text-muted-foreground">{trx.date}</td>
                    <td className="p-3 text-sm font-black text-rose-600">
                      ₹{trx.amount.toLocaleString('en-IN', { minimumFractionDigits: 3 })}
                    </td>
                    <td className="p-3 text-xs font-bold text-foreground">{trx.category}</td>
                    <td className="p-3 text-xs font-medium text-foreground">{trx.things}</td>
                    <td className="p-3 text-xs font-medium text-muted-foreground">{trx.narrative}</td>
                    <td className="p-3 pr-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => openEditDebit(trx)} className="text-muted-foreground hover:text-foreground transition-colors"><Edit3 className="w-3.5 h-3.5" /></button>
                        <button 
                          onClick={() => setDeleteConfirm({ isOpen: true, id: trx.id, type: 'debit' })}
                          className="text-rose-500 hover:text-rose-600 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-border/50 flex justify-between items-center bg-muted/10 rounded-b-2xl">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Transaction Total Debt</span>
            <span className="text-base font-black text-rose-600">₹6.543</span>
          </div>
        </div>

      </div>

      {/* --- ADD CREDIT MODAL --- */}
      <Dialog open={isAddCreditOpen} onOpenChange={setIsAddCreditOpen}>
        <DialogContent className="max-w-lg p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className="p-4 border-b border-border/50 flex justify-between items-center bg-emerald-500/5">
              <div>
                <h3 className="font-black text-lg text-foreground">Add Credit (Income / Invoice)</h3>
                <p className="text-xs font-medium text-muted-foreground">Record incoming funds.</p>
              </div>
              <button onClick={() => setIsAddCreditOpen(false)} className="p-2 hover:bg-muted rounded-full transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 md:p-8 space-y-6 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">Invoice Number / Ref</label>
                  <input type="text" placeholder="e.g. INV-001" className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">Date *</label>
                  <input type="date" className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">Amount (₹) *</label>
                  <input type="number" placeholder="0.00" className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">Category *</label>
                  <SearchableSelect
                    value={addCreditCategory}
                    onChange={setAddCreditCategory}
                    options={[
                      { label: "Sales", value: "Sales" },
                      { label: "Services", value: "Services" },
                      { label: "Other", value: "Other" }
                    ]}
                    className="w-full h-[40px] px-3 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">Descriptions</label>
                <input type="text" placeholder="Short description" className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">Services</label>
                <input type="text" placeholder="Service details" className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">Remarks</label>
                <textarea rows={2} placeholder="Any additional notes" className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
            </div>
            <div className="px-6 md:px-8 py-4 md:py-6 bg-muted/30 border-t border-border/50 flex justify-end gap-3 mt-auto shrink-0">
              <button onClick={() => setIsAddCreditOpen(false)} className="px-4 py-2 font-bold text-sm bg-background border border-border/50 rounded-lg hover:bg-muted transition-colors">Cancel</button>
              <button onClick={() => setIsAddCreditOpen(false)} className="px-4 py-2 font-bold text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">Save Credit</button>
            </div>
        </DialogContent>
      </Dialog>

      {/* --- ADD DEBT MODAL --- */}
      <Dialog open={isAddDebtOpen} onOpenChange={setIsAddDebtOpen}>
        <DialogContent className="max-w-lg p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className="p-4 border-b border-border/50 flex justify-between items-center bg-rose-500/5">
              <div>
                <h3 className="font-black text-lg text-foreground">Add Debt (Expense / Bill)</h3>
                <p className="text-xs font-medium text-muted-foreground">Record an outbound expense.</p>
              </div>
              <button onClick={() => setIsAddDebtOpen(false)} className="p-2 hover:bg-muted rounded-full transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 md:p-8 space-y-6 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">Expense No. / Ref</label>
                  <input type="text" placeholder="Auto-generated if empty" className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">Date *</label>
                  <input type="date" className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">Amount (₹) *</label>
                  <input type="number" placeholder="0.00" className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">Category *</label>
                  <SearchableSelect
                    value={addDebtCategory}
                    onChange={setAddDebtCategory}
                    options={[
                      { label: "General", value: "General" },
                      { label: "Office", value: "Office" },
                      { label: "Travel", value: "Travel" }
                    ]}
                    className="w-full h-[40px] px-3 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">Things</label>
                <input type="text" placeholder="What was purchased?" className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">Narrative</label>
                <textarea rows={2} placeholder="Expense description or narrative" className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
            </div>
            <div className="px-6 md:px-8 py-4 md:py-6 bg-muted/30 border-t border-border/50 flex justify-end gap-3 mt-auto shrink-0">
              <button onClick={() => setIsAddDebtOpen(false)} className="px-4 py-2 font-bold text-sm bg-background border border-border/50 rounded-lg hover:bg-muted transition-colors">Cancel</button>
              <button onClick={() => setIsAddDebtOpen(false)} className="px-4 py-2 font-bold text-sm bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors">Save Expense</button>
            </div>
          </DialogContent>
        </Dialog>

      {/* EDIT CREDIT MODAL */}
      <Dialog open={!!editCredit} onOpenChange={(o) => !o && setEditCredit(null)}>
        <DialogContent className="max-w-lg p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className="p-4 border-b border-border/50 flex justify-between items-center bg-emerald-500/5">
            <div>
              <h3 className="font-black text-lg text-foreground">Edit Credit Transaction</h3>
              <p className="text-xs font-medium text-muted-foreground">Update invoice details.</p>
            </div>
            <button onClick={() => setEditCredit(null)} className="p-2 hover:bg-muted rounded-full transition-colors"><X className="w-4 h-4" /></button>
          </div>
          {editCredit && (
            <div className="p-6 md:p-8 space-y-4 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">Invoice No.</label>
                  <input type="text" value={editCredit.id} onChange={(e) => setEditCredit((p: any) => ({ ...p, id: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">Date</label>
                  <input type="text" value={editCredit.date} onChange={(e) => setEditCredit((p: any) => ({ ...p, date: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">Amount (₹)</label>
                <input type="number" value={editCredit.amount} onChange={(e) => setEditCredit((p: any) => ({ ...p, amount: parseFloat(e.target.value) || 0 }))} className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">Category</label>
                <input type="text" value={editCredit.category} onChange={(e) => setEditCredit((p: any) => ({ ...p, category: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">Description</label>
                <input type="text" value={editCredit.description} onChange={(e) => setEditCredit((p: any) => ({ ...p, description: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">Services</label>
                <input type="text" value={editCredit.service} onChange={(e) => setEditCredit((p: any) => ({ ...p, service: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">Remarks</label>
                <textarea rows={2} value={editCredit.remarks} onChange={(e) => setEditCredit((p: any) => ({ ...p, remarks: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
            </div>
          )}
          <div className="px-6 md:px-8 py-4 border-t border-border/50 flex justify-end gap-3">
            <button onClick={() => setEditCredit(null)} className="px-4 py-2 font-bold text-sm bg-background border border-border/50 rounded-lg hover:bg-muted transition-colors">Cancel</button>
            <button onClick={saveEditCredit} className="px-4 py-2 font-bold text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">Save Changes</button>
          </div>
        </DialogContent>
      </Dialog>

      {/* EDIT DEBIT MODAL */}
      <Dialog open={!!editDebit} onOpenChange={(o) => !o && setEditDebit(null)}>
        <DialogContent className="max-w-lg p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className="p-4 border-b border-border/50 flex justify-between items-center bg-rose-500/5">
            <div>
              <h3 className="font-black text-lg text-foreground">Edit Debit Transaction</h3>
              <p className="text-xs font-medium text-muted-foreground">Update expense details.</p>
            </div>
            <button onClick={() => setEditDebit(null)} className="p-2 hover:bg-muted rounded-full transition-colors"><X className="w-4 h-4" /></button>
          </div>
          {editDebit && (
            <div className="p-6 md:p-8 space-y-4 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">Expense No.</label>
                  <input type="text" value={editDebit.id} onChange={(e) => setEditDebit((p: any) => ({ ...p, id: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">Date</label>
                  <input type="text" value={editDebit.date} onChange={(e) => setEditDebit((p: any) => ({ ...p, date: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">Amount (₹)</label>
                <input type="number" value={editDebit.amount} onChange={(e) => setEditDebit((p: any) => ({ ...p, amount: parseFloat(e.target.value) || 0 }))} className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">Category</label>
                <input type="text" value={editDebit.category} onChange={(e) => setEditDebit((p: any) => ({ ...p, category: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">Things</label>
                <input type="text" value={editDebit.things} onChange={(e) => setEditDebit((p: any) => ({ ...p, things: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">Narrative</label>
                <textarea rows={2} value={editDebit.narrative} onChange={(e) => setEditDebit((p: any) => ({ ...p, narrative: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
            </div>
          )}
          <div className="px-6 md:px-8 py-4 border-t border-border/50 flex justify-end gap-3">
            <button onClick={() => setEditDebit(null)} className="px-4 py-2 font-bold text-sm bg-background border border-border/50 rounded-lg hover:bg-muted transition-colors">Cancel</button>
            <button onClick={saveEditDebit} className="px-4 py-2 font-bold text-sm bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors">Save Changes</button>
          </div>
        </DialogContent>
      </Dialog>

        <ConfirmModal 
          isOpen={deleteConfirm.isOpen}
          onClose={() => setDeleteConfirm({ isOpen: false, id: null, type: 'credit' })}
          onConfirm={confirmDelete}
          title="Delete Transaction"
          description={`Are you sure you want to completely delete this ${deleteConfirm.type === 'credit' ? 'credit (invoice)' : 'debt (expense)'} transaction?`}
        />
    </div>
  );
}
