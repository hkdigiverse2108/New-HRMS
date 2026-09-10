import { useState, useEffect } from "react";
import { Trash2, RotateCcw, AlertTriangle, Info, Search } from "lucide-react";
import { getRecycleBinItems, restoreItem, permanentlyDeleteItem, cleanupOldItems, RecycleBinItem, RECYCLE_BIN_DAYS_LIMIT } from "@/lib/recycle-bin";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableHeader } from "@/components/ui/sortable-header";

export function RecycleBin() {
  const [items, setItems] = useState<RecycleBinItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmModalState, setConfirmModalState] = useState<{isOpen: boolean, action: 'restore' | 'delete', id: string, title: string, desc: string, itemName: string}>({
    isOpen: false, action: 'restore', id: "", title: "", desc: "", itemName: ""
  });

  useEffect(() => {
    cleanupOldItems();
    setItems(getRecycleBinItems());
  }, []);

  const handleRestore = () => {
    const success = restoreItem(confirmModalState.id);
    if (success) {
      toast.success("Item restored successfully");
      setItems(getRecycleBinItems());
    } else {
      toast.error("Failed to restore item. Target storage may have changed.");
    }
    setConfirmModalState(prev => ({ ...prev, isOpen: false }));
  };

  const handleDelete = () => {
    permanentlyDeleteItem(confirmModalState.id);
    toast.success("Item permanently deleted");
    setItems(getRecycleBinItems());
    setConfirmModalState(prev => ({ ...prev, isOpen: false }));
  };

  const filteredItems = items.filter(i => 
    i.itemName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    i.module.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const { items: sortedItems, requestSort, sortConfig } = useSortableData(filteredItems);

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500 pb-12 relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-foreground flex items-center gap-3">
            <Trash2 className="w-8 h-8 text-rose-500" />
            Recycle Bin
          </h1>
          <p className="text-muted-foreground mt-2 font-medium">
            Restore deleted items within {RECYCLE_BIN_DAYS_LIMIT} days. Items older than this will be permanently removed.
          </p>
        </div>
      </div>

      <div className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[500px]">
        <div className="p-4 md:p-6 border-b border-border/50 flex flex-col sm:flex-row justify-between gap-4 items-center bg-muted/10">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text"
              placeholder="Search deleted items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-background border border-border/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-lg border border-border/50">
            <Info className="w-4 h-4" />
            <span>{items.length} items in bin</span>
          </div>
        </div>

        <div className="flex-1 overflow-x-auto">
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-12 text-center">
              <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mb-4">
                <Trash2 className="w-8 h-8 text-muted-foreground/50" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Recycle Bin is empty</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                No items have been deleted recently, or they didn't match your search criteria.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse whitespace-nowrap min-w-[800px]">
              <thead className="bg-muted/30 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border/50">
                <tr>
                  <SortableHeader label="Module" sortKey="module" currentSort={sortConfig} onSort={requestSort} className="p-4 w-[20%]" />
                  <SortableHeader label="Item Name" sortKey="itemName" currentSort={sortConfig} onSort={requestSort} className="p-4 w-[35%]" />
                  <SortableHeader label="Deleted On" sortKey="deletedAt" currentSort={sortConfig} onSort={requestSort} className="p-4 w-[20%]" />
                  <th className="p-4 w-[15%]">Days Left</th>
                  <th className="p-4 w-[10%] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {sortedItems.map(item => {
                  const deletedDate = new Date(item.deletedAt);
                  const expiryDate = new Date(item.deletedAt + (RECYCLE_BIN_DAYS_LIMIT * 24 * 60 * 60 * 1000));
                  const daysLeft = Math.ceil((expiryDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
                  
                  return (
                    <tr key={item.id} className="hover:bg-muted/10 transition-colors group">
                      <td className="p-4">
                        <span className="inline-flex px-2 py-1 bg-primary/10 text-primary text-xs font-bold rounded-md">
                          {item.module}
                        </span>
                      </td>
                      <td className="p-4">
                        <p className="text-sm font-bold text-foreground truncate max-w-[300px]" title={item.itemName}>
                          {item.itemName}
                        </p>
                      </td>
                      <td className="p-4">
                        <p className="text-sm font-medium text-foreground">{format(deletedDate, 'dd/MM/yyyy')}</p>
                        <p className="text-xs text-muted-foreground">{formatDistanceToNow(deletedDate, { addSuffix: true })}</p>
                      </td>
                      <td className="p-4">
                        <span className={cn(
                          "text-sm font-black flex items-center gap-1.5",
                          daysLeft <= 3 ? "text-rose-500" : daysLeft <= 10 ? "text-amber-500" : "text-emerald-500"
                        )}>
                          {daysLeft <= 3 && <AlertTriangle className="w-3.5 h-3.5" />}
                          {daysLeft} {daysLeft === 1 ? 'day' : 'days'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => setConfirmModalState({
                              isOpen: true, action: 'restore', id: item.id, 
                              title: "Restore Item", desc: `Are you sure you want to restore "${item.itemName}" back to its original location?`, itemName: item.itemName
                            })}
                            className="p-2 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-600/10 rounded-lg transition-colors tooltip-trigger"
                            title="Restore"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setConfirmModalState({
                              isOpen: true, action: 'delete', id: item.id, 
                              title: "Permanently Delete", desc: `Are you sure you want to permanently delete "${item.itemName}"? This action cannot be undone.`, itemName: item.itemName
                            })}
                            className="p-2 text-muted-foreground hover:text-rose-600 hover:bg-rose-600/10 rounded-lg transition-colors tooltip-trigger"
                            title="Delete Permanently"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <ConfirmModal 
        isOpen={confirmModalState.isOpen}
        onClose={() => setConfirmModalState(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModalState.action === 'restore' ? handleRestore : handleDelete}
        title={confirmModalState.title}
        description={confirmModalState.desc}
        itemName={confirmModalState.itemName}
        variant={confirmModalState.action === 'restore' ? "restore" : "destructive"}
      />
    </div>
  );
}
