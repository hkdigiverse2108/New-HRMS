import { useState, useEffect } from "react";
import { Trash2, RotateCcw, Info } from "lucide-react";
import { SearchInput } from "@/components/common/SearchInput";
import { getRecycleBinItems, restoreItem, permanentlyDeleteItem, RecycleBinItem, ServerRecycleBinItem } from "@/lib/recycle-bin";
import { api } from "@/lib/api";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "@/lib/toast";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableHeader } from "@/components/ui/sortable-header";

// Local (browser) and server (database) deleted items share one list; `serverModule` marks the latter.
type BinRow = RecycleBinItem & { serverModule?: string; page: string };

// Page each browser-stored (local) item type belongs to; server items carry their own page.
const LOCAL_PAGES: Record<string, string> = {
  "Restricted App": "Restrictions",
  "Restricted URL": "Restrictions",
  "Spotlight Employee": "Dashboard",
  "Financial Plan Category": "Finance",
  "Lead Category": "Sales",
  "Lead Source": "Sales",
  "Pipeline Stage": "Sales",
  "Project Category": "Projects & Clients",
  "Project": "Projects & Clients",
  "Client": "Projects & Clients",
  "Resource Type": "Resource Management",
};

const toRow = (s: ServerRecycleBinItem): BinRow => ({
  id: s.id,
  module: s.module_label,
  itemName: s.item_name,
  deletedAt: s.deleted_at ? new Date(s.deleted_at).getTime() : Date.now(),
  restoreData: { storageKey: "", data: null },
  serverModule: s.module,
  page: s.page,
});

export function RecycleBin() {
  const [items, setItems] = useState<BinRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [pageFilter, setPageFilter] = useState("all");
  const [confirmModalState, setConfirmModalState] = useState<{isOpen: boolean, action: 'restore' | 'delete', id: string, title: string, desc: string, itemName: string}>({
    isOpen: false, action: 'restore', id: "", title: "", desc: "", itemName: ""
  });

  const reload = async () => {
    const local: BinRow[] = getRecycleBinItems().map(i => ({ ...i, page: LOCAL_PAGES[i.module] ?? "Other" }));
    let server: BinRow[] = [];
    try {
      const res = await api.get<ServerRecycleBinItem[]>("/recycle-bin", { showErrorToast: false });
      server = (res || []).map(toRow);
    } catch {
      // Not an admin or server unreachable: still show the local items.
    }
    setItems([...server, ...local]);
  };

  useEffect(() => {
    reload();
  }, []);

  const findRow = (id: string) => items.find(i => i.id === id);

  const handleRestore = async () => {
    const row = findRow(confirmModalState.id);
    if (row?.serverModule) {
      try {
        await api.post(`/recycle-bin/${row.serverModule}/${row.id}/restore`, undefined, { showErrorToast: true });
        toast.success("Item restored successfully");
      } catch {
        // apiRequest already surfaced the error toast
      }
    } else if (restoreItem(confirmModalState.id)) {
      toast.success("Item restored successfully");
    } else {
      toast.error("Failed to restore item. Target storage may have changed.");
    }
    await reload();
    setConfirmModalState(prev => ({ ...prev, isOpen: false }));
  };

  const handleDelete = async () => {
    const row = findRow(confirmModalState.id);
    if (row?.serverModule) {
      try {
        await api.delete(`/recycle-bin/${row.serverModule}/${row.id}`, { showErrorToast: true });
        toast.success("Item permanently deleted");
      } catch {
        // apiRequest already surfaced the error toast
      }
    } else {
      permanentlyDeleteItem(confirmModalState.id);
      toast.success("Item permanently deleted");
    }
    await reload();
    setConfirmModalState(prev => ({ ...prev, isOpen: false }));
  };

  const pageCounts = items.reduce<Record<string, number>>((acc, i) => {
    acc[i.page] = (acc[i.page] || 0) + 1;
    return acc;
  }, {});
  const pages = Object.keys(pageCounts).sort();

  // A page whose last item was restored/deleted would leave the filter on an empty tab.
  useEffect(() => {
    if (pageFilter !== "all" && !pageCounts[pageFilter]) setPageFilter("all");
  }, [items]);

  const filteredItems = items.filter(i =>
    (pageFilter === "all" || i.page === pageFilter) &&
    (i.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.module.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const { items: sortedItems, requestSort, sortConfig } = useSortableData(filteredItems);

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500 pb-12 relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Trash2 className="w-8 h-8 text-rose-500 shrink-0" />
            Recycle Bin
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            Deleted items stay here until you restore them or delete them permanently.
          </p>
        </div>
      </div>

      <div className="bg-card border border-border/50 rounded-3xl shadow-sm overflow-hidden flex flex-col min-h-[500px]">
        <div className="p-4 sm:p-6 border-b border-border/50 flex flex-col sm:flex-row justify-between gap-4 items-stretch sm:items-center">
          <div className="w-full sm:max-w-md">
            <SearchInput 
              placeholder="Search deleted items..."
              value={searchQuery}
              onChange={setSearchQuery}
              className="w-full"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
            <select
              value={pageFilter}
              onChange={e => setPageFilter(e.target.value)}
              className="h-9 rounded-lg border border-border/50 bg-background px-3 text-xs font-bold text-foreground outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="all">All Pages</option>
              {pages.map(pg => <option key={pg} value={pg}>{pg} ({pageCounts[pg]})</option>)}
            </select>
            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-lg border border-border/50 shrink-0">
              <Info className="w-4 h-4" />
              <span>{items.length} items in bin</span>
            </div>
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
                  <SortableHeader label="Module" sortKey="module" currentSort={sortConfig} onSort={requestSort} className="px-6 py-4 w-[20%]" />
                  <SortableHeader label="Item Name" sortKey="itemName" currentSort={sortConfig} onSort={requestSort} className="px-6 py-4 w-[45%]" />
                  <SortableHeader label="Deleted On" sortKey="deletedAt" currentSort={sortConfig} onSort={requestSort} className="px-6 py-4 w-[20%]" />
                  <th className="px-6 py-4 w-[10%] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {sortedItems.map(item => {
                  const deletedDate = new Date(item.deletedAt);
                  
                  return (
                    <tr key={`${item.serverModule ?? "local"}-${item.id}`} className="hover:bg-muted/10 transition-colors group">
                      <td className="px-6 py-4">
                        <span className="inline-flex px-2 py-1 bg-primary/10 text-primary text-xs font-bold rounded-md">
                          {item.module}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-foreground truncate max-w-[300px]" title={item.itemName}>
                          {item.itemName}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-foreground">{format(deletedDate, 'dd/MM/yyyy')}</p>
                        <p className="text-xs text-muted-foreground">{formatDistanceToNow(deletedDate, { addSuffix: true })}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
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
