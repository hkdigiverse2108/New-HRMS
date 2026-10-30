import { useState, useEffect } from "react";
import { Trash2, RotateCcw, Info, ChevronDown } from "lucide-react";
import { SearchInput } from "@/components/common/SearchInput";
import { getRecycleBinItems, restoreItem, permanentlyDeleteItem, RecycleBinItem, ServerRecycleBinItem } from "@/lib/recycle-bin";
import { api } from "@/lib/api";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { formatDistanceToNow } from "date-fns";
import { formatDate } from "@/lib/utils";
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

  const askRestore = (item: BinRow) => setConfirmModalState({
    isOpen: true, action: 'restore', id: item.id,
    title: "Restore Item", desc: `Are you sure you want to restore "${item.itemName}" back to its original location?`, itemName: item.itemName
  });
  const askDelete = (item: BinRow) => setConfirmModalState({
    isOpen: true, action: 'delete', id: item.id,
    title: "Permanently Delete", desc: `Are you sure you want to permanently delete "${item.itemName}"? This action cannot be undone.`, itemName: item.itemName
  });

  return (
    <div className="w-full space-y-5 sm:space-y-8 animate-in fade-in duration-500 pb-12 relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Trash2 className="w-6 h-6 sm:w-8 sm:h-8 text-rose-500 shrink-0" />
            Recycle Bin
          </h1>
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm font-medium">
            Deleted items stay here until you restore them or delete them permanently.
          </p>
        </div>
      </div>

      <div className="bg-card border border-border/50 rounded-2xl sm:rounded-3xl shadow-sm overflow-hidden flex flex-col min-h-[320px] sm:min-h-[500px]">
        <div className="p-3 sm:p-6 border-b border-border/50 flex flex-col lg:flex-row justify-between gap-3 sm:gap-4 items-stretch lg:items-center">
          <div className="w-full lg:flex-1 lg:min-w-0 lg:max-w-md">
            <SearchInput 
              placeholder="Search deleted items..."
              value={searchQuery}
              onChange={setSearchQuery}
              className="w-full"
              containerClassName="w-full sm:w-full md:w-full"
            />
          </div>
          <div className="flex flex-nowrap items-center gap-2 sm:gap-3 w-full lg:w-auto lg:shrink-0">
            <div className="relative flex-1 min-w-0 lg:flex-none lg:w-52">
              <select
                value={pageFilter}
                onChange={e => setPageFilter(e.target.value)}
                className="h-[38px] w-full appearance-none cursor-pointer rounded-xl border border-border/60 bg-muted/40 pl-3 pr-9 text-xs sm:text-sm font-semibold text-foreground shadow-sm outline-none transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
              >
                <option value="all">All Pages</option>
                {pages.map(pg => <option key={pg} value={pg}>{pg} ({pageCounts[pg]})</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
            <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-muted-foreground bg-muted/40 px-2.5 sm:px-3 h-[38px] rounded-xl border border-border/60 shadow-sm shrink-0 justify-center whitespace-nowrap">
              <Info className="w-4 h-4 shrink-0" />
              <span>{items.length} items in bin</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-x-auto">
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 sm:p-12 text-center">
              <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mb-4">
                <Trash2 className="w-8 h-8 text-muted-foreground/50" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Recycle Bin is empty</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                No items have been deleted recently, or they didn't match your search criteria.
              </p>
            </div>
          ) : (
            <>
            {/* Mobile: one card per deleted item */}
            <ul className="md:hidden divide-y divide-border/30">
              {sortedItems.map(item => {
                const deletedDate = new Date(item.deletedAt);
                return (
                  <li key={`${item.serverModule ?? "local"}-${item.id}`} className="p-3 sm:p-4 flex items-start gap-3">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <span className="inline-flex px-2 py-0.5 bg-primary/10 text-primary text-[11px] font-bold rounded-md max-w-full truncate">
                        {item.module}
                      </span>
                      <p className="text-sm font-bold text-foreground break-words">{item.itemName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(deletedDate)} · {formatDistanceToNow(deletedDate, { addSuffix: true })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => askRestore(item)}
                        className="p-2.5 min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-muted-foreground hover:text-emerald-600 hover:bg-emerald-600/10 rounded-lg transition-colors"
                        title="Restore"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => askDelete(item)}
                        className="p-2.5 min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-muted-foreground hover:text-rose-600 hover:bg-rose-600/10 rounded-lg transition-colors"
                        title="Delete Permanently"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <table className="hidden md:table w-full text-left border-collapse whitespace-nowrap md:min-w-[640px]">
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
                        <p className="text-sm font-medium text-foreground">{formatDate(deletedDate)}</p>
                        <p className="text-xs text-muted-foreground">{formatDistanceToNow(deletedDate, { addSuffix: true })}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button 
                            onClick={() => askRestore(item)}
                            className="p-2 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-600/10 rounded-lg transition-colors tooltip-trigger"
                            title="Restore"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => askDelete(item)}
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
            </>
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
