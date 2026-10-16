import { useCallback, useEffect, useMemo, useState } from "react";
import { X, Clock, Bookmark, Plus, Search, Pencil, Trash2, Link2, Users, History, FolderKanban, Loader2 } from "lucide-react";
import { SearchInput } from "@/components/common/SearchInput";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { SearchableSelect } from "@/components/ui/select";
import { api } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthContext";
import { formatISTDate, formatISTDateTime } from "@/lib/timeUtils";

interface Concept {
  concept_name: string;
  link?: string | null;
}

interface PersonRef {
  _id: string;
  employee_name: string;
  email?: string | null;
  avatar?: string | null;
}

interface HistoryEntry {
  action: string;
  employee_details?: PersonRef | null;
  timestamp: string;
  changes_summary?: string | null;
}

interface ResearchItem {
  id: string;
  title: string;
  description?: string | null;
  project_id?: string | null;
  project_details?: { _id: string; project_name?: string } | null;
  concepts: Concept[];
  shared_with: string[];
  shared_with_details?: PersonRef[] | null;
  employee_id: string;
  employee_details?: PersonRef | null;
  department?: string | null;
  can_edit?: boolean;
  can_delete?: boolean;
  history: HistoryEntry[];
  created_at: string;
  updated_at: string;
}

interface Option { label: string; value: string }

type Scope = "All" | "Mine" | "Shared" | "Bookmarked";
const SCOPES: { key: Scope; label: string }[] = [
  { key: "All", label: "All" },
  { key: "Mine", label: "My Research" },
  { key: "Shared", label: "Shared with me" },
  { key: "Bookmarked", label: "Bookmarked" },
];

const avatarFor = (p?: PersonRef | null) =>
  p?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(p?.employee_name || "U")}`;

const readTime = (text?: string | null) => {
  const words = (text || "").trim().split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.round(words / 200))} min read`;
};

const toList = (res: any): any[] => (Array.isArray(res) ? res : res?.data || []);

const emptyForm = { title: "", description: "", project_id: "", concepts: [] as Concept[], shared_with: [] as string[] };

export function Research() {
  const { user } = useAuth();
  const anyUser = user as any;
  const currentUserId = String(anyUser?._id || anyUser?.id || "");
  const bookmarkKey = `hrms_research_bookmarks_${currentUserId}`;

  const [items, setItems] = useState<ResearchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<Scope>("All");
  const [projectFilter, setProjectFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selected, setSelected] = useState<ResearchItem | null>(null);

  const [projects, setProjects] = useState<Option[]>([]);
  const [employees, setEmployees] = useState<Option[]>([]);

  const [bookmarks, setBookmarks] = useState<string[]>([]);

  // Create / edit form
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [conceptName, setConceptName] = useState("");
  const [conceptLink, setConceptLink] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(bookmarkKey);
      setBookmarks(saved ? JSON.parse(saved) : []);
    } catch {
      setBookmarks([]);
    }
  }, [bookmarkKey]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const fetchResearch = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (projectFilter !== "all") params.set("project_id", projectFilter);
      const qs = params.toString();
      const res = await api.get<any>(`/research${qs ? `?${qs}` : ""}`, { showLoader: false });
      setItems(toList(res).map((r: any) => ({ ...r, id: String(r.id || r._id) })));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, projectFilter]);

  useEffect(() => {
    fetchResearch();
  }, [fetchResearch]);

  useEffect(() => {
    (async () => {
      const [projRes, empRes] = await Promise.allSettled([
        api.get<any>("/projects", { showLoader: false, showErrorToast: false }),
        api.get<any>("/employees?limit=1000", { showLoader: false, showErrorToast: false }),
      ]);
      if (projRes.status === "fulfilled") {
        setProjects(
          toList(projRes.value).map((p: any) => ({
            value: String(p._id || p.id),
            label: p.general?.project_name || p.project_name || p.name || "Untitled Project",
          }))
        );
      }
      if (empRes.status === "fulfilled") {
        setEmployees(
          toList(empRes.value)
            .map((e: any) => {
              const personal = e.personal_info || {};
              const name = personal.first_name ? `${personal.first_name} ${personal.last_name || ""}`.trim() : e.name || "Employee";
              return { value: String(e._id || e.id), label: name };
            })
            .filter((o: Option) => o.value !== currentUserId)
        );
      }
    })();
  }, [currentUserId]);

  const visibleItems = useMemo(() => {
    return items
      .filter(item => {
        if (scope === "Mine") return item.employee_id === currentUserId;
        if (scope === "Shared") return item.employee_id !== currentUserId && item.shared_with.includes(currentUserId);
        if (scope === "Bookmarked") return bookmarks.includes(item.id);
        return true;
      })
      .sort((a, b) => Number(bookmarks.includes(b.id)) - Number(bookmarks.includes(a.id)));
  }, [items, scope, bookmarks, currentUserId]);

  const toggleBookmark = (e: React.MouseEvent, item: ResearchItem) => {
    e.stopPropagation();
    const isNow = !bookmarks.includes(item.id);
    const next = isNow ? [...bookmarks, item.id] : bookmarks.filter(id => id !== item.id);
    setBookmarks(next);
    try {
      localStorage.setItem(bookmarkKey, JSON.stringify(next));
    } catch {}
    toast.success(isNow ? `Bookmarked "${item.title}"` : `Removed "${item.title}" from bookmarks`);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setConceptName("");
    setConceptLink("");
    setFormOpen(true);
  };

  const openEdit = (item: ResearchItem) => {
    setEditingId(item.id);
    setForm({
      title: item.title,
      description: item.description || "",
      project_id: item.project_id || "",
      concepts: (item.concepts || []).map(c => ({ concept_name: c.concept_name, link: c.link || "" })),
      shared_with: item.shared_with || [],
    });
    setConceptName("");
    setConceptLink("");
    setSelected(null);
    setFormOpen(true);
  };

  const addConcept = () => {
    if (!conceptName.trim()) {
      toast.error("Concept name is required.");
      return;
    }
    setForm(f => ({ ...f, concepts: [...f.concepts, { concept_name: conceptName.trim(), link: conceptLink.trim() }] }));
    setConceptName("");
    setConceptLink("");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("Title is required.");
      return;
    }
    const pendingConcept = conceptName.trim() ? [{ concept_name: conceptName.trim(), link: conceptLink.trim() }] : [];
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      project_id: form.project_id || (editingId ? "" : null),
      concepts: [...form.concepts, ...pendingConcept].map(c => ({ concept_name: c.concept_name, link: c.link || null })),
      shared_with: form.shared_with,
    };
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/research/${editingId}`, payload);
        toast.success("Research updated successfully!");
      } else {
        await api.post("/research", payload);
        toast.success("Research published successfully!");
      }
      setFormOpen(false);
      fetchResearch();
    } catch {
      // api layer already shows the error toast
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: ResearchItem) => {
    if (!window.confirm(`Delete "${item.title}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/research/${item.id}`);
      toast.success("Research deleted.");
      setSelected(null);
      setItems(prev => prev.filter(i => i.id !== item.id));
    } catch {}
  };

  const inputCls = "w-full min-w-0 px-3 py-2 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20";
  const labelCls = "text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block";
  const employeeName = (id: string) => employees.find(o => o.value === id)?.label || "Employee";

  return (
    <div className="space-y-5 min-h-[calc(100vh-4rem)] h-auto lg:h-[calc(100vh-4rem)] flex flex-col overflow-hidden pb-0 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">Knowledge & Research Hub</h1>
          <p className="text-xs text-muted-foreground mt-1 font-semibold">Capture research, key concepts and references, and share them with your team</p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <SearchInput
            placeholder="Search title, notes, concepts..."
            value={searchQuery}
            onChange={setSearchQuery}
            containerClassName="flex-1 sm:flex-none sm:w-64 md:w-72 min-w-0"
          />
          <button
            onClick={openCreate}
            className="px-3 sm:px-4 py-2 bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>New Research</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        {/* Filters */}
        <div className="flex items-center gap-2 overflow-x-auto p-1 pb-4 -mx-1 scrollbar-hide shrink-0">
          {SCOPES.map(s => (
            <button
              key={s.key}
              onClick={() => setScope(s.key)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all duration-200 border",
                scope === s.key
                  ? "bg-primary text-primary-foreground border-primary shadow-md"
                  : "bg-white text-foreground/80 border-border hover:bg-muted/50"
              )}
            >
              {s.label}
            </button>
          ))}
          <div className="flex-1" />
          <div className="w-48 shrink-0">
            <SearchableSelect
              value={projectFilter}
              onChange={setProjectFilter}
              options={[{ label: "All Projects", value: "all" }, ...projects]}
              className="h-[38px] bg-white border border-border rounded-xl text-sm font-bold shadow-none focus:ring-0 focus-visible:ring-2 focus-visible:ring-primary/20"
            />
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto pr-2 pb-10">
          {loading ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : visibleItems.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {visibleItems.map(item => {
                const bookmarked = bookmarks.includes(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelected(item)}
                    className="group bg-white border border-border rounded-2xl p-5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/20 transition-all duration-300 flex flex-col cursor-pointer"
                  >
                    <div className="flex justify-between items-start mb-3 gap-2">
                      <div className="flex flex-wrap gap-1.5 min-w-0">
                        {item.project_details?.project_name && (
                          <span className="px-2.5 py-1 bg-primary/10 text-primary text-xs font-bold rounded-lg truncate max-w-[180px]">
                            {item.project_details.project_name}
                          </span>
                        )}
                        {item.department && (
                          <span className="px-2.5 py-1 bg-muted text-foreground/80 text-xs font-bold rounded-lg truncate max-w-[140px]">
                            {item.department}
                          </span>
                        )}
                      </div>
                      <button onClick={e => toggleBookmark(e, item)} className="text-border hover:text-amber-500 transition-colors shrink-0">
                        <Bookmark className={cn("w-5 h-5", bookmarked && "fill-amber-500 text-amber-500")} />
                      </button>
                    </div>

                    <h3 className="text-lg font-bold text-foreground mb-2 leading-tight group-hover:text-primary transition-colors line-clamp-2">
                      {item.title}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-1">
                      {item.description || "No notes added."}
                    </p>

                    {(item.concepts?.length > 0 || item.shared_with?.length > 0) && (
                      <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium mb-4">
                        {item.concepts?.length > 0 && (
                          <span className="flex items-center gap-1"><Link2 className="w-3.5 h-3.5" />{item.concepts.length} concept{item.concepts.length > 1 ? "s" : ""}</span>
                        )}
                        {item.shared_with?.length > 0 && (
                          <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />Shared with {item.shared_with.length}</span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-4 border-t border-border/50 mt-auto">
                      <div className="flex items-center gap-2 min-w-0">
                        <img src={avatarFor(item.employee_details)} alt="" className="w-6 h-6 rounded-full ring-2 ring-white shrink-0" />
                        <span className="text-xs font-medium text-foreground/80 truncate">
                          {item.employee_id === currentUserId ? "You" : item.employee_details?.employee_name || "Employee"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium shrink-0">
                        <Clock className="w-3.5 h-3.5" />
                        {formatISTDate(item.created_at)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mb-4 text-muted-foreground">
                <Search className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-foreground/80 mb-1">No research found</h3>
              <p className="text-muted-foreground text-sm max-w-sm">
                {debouncedSearch || projectFilter !== "all" || scope !== "All"
                  ? "Nothing matches your current filters. Try different keywords or filters."
                  : "Start by adding your first research document."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={formOpen} onOpenChange={o => !saving && setFormOpen(o)}>
        <DialogContent className="w-[calc(100vw-16px)] sm:w-full sm:max-w-[600px] p-0 overflow-hidden rounded-2xl sm:rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card flex flex-col">
          <div className="flex items-center justify-between px-4 sm:px-8 py-4 sm:py-6 border-b border-border/50 bg-muted/30">
            <h2 className="text-lg sm:text-2xl font-black tracking-tight">{editingId ? "Edit Research" : "New Research"}</h2>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="p-1.5 sm:p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSave} className="flex flex-col min-h-0 min-w-0 w-full max-h-[85dvh]">
            <div className="p-4 sm:p-6 md:p-8 space-y-5 overflow-y-auto flex-1 min-h-0">
              <div>
                <label className={labelCls}>Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Competitor pricing analysis"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Project (optional)</label>
                <SearchableSelect
                  value={form.project_id || "none"}
                  onChange={val => setForm(f => ({ ...f, project_id: val === "none" ? "" : val }))}
                  options={[{ label: "No project", value: "none" }, ...projects]}
                  className="w-full h-[38px] px-3 bg-white border border-border rounded-xl text-sm"
                />
              </div>

              <div>
                <label className={labelCls}>Notes / Findings</label>
                <textarea
                  rows={6}
                  placeholder="Write your research notes, findings and conclusions..."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className={cn(inputCls, "resize-y")}
                />
              </div>

              <div>
                <label className={labelCls}>Concepts & References</label>
                {form.concepts.length > 0 && (
                  <div className="space-y-2 mb-2">
                    {form.concepts.map((c, idx) => (
                      <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-muted/40 border border-border rounded-xl text-sm">
                        <span className="font-bold truncate min-w-0 max-w-[45%] shrink-0">{c.concept_name}</span>
                        {c.link && <span className="text-xs text-muted-foreground truncate flex-1 min-w-0">{c.link}</span>}
                        {!c.link && <span className="flex-1" />}
                        <button
                          type="button"
                          onClick={() => setForm(f => ({ ...f, concepts: f.concepts.filter((_, i) => i !== idx) }))}
                          className="text-muted-foreground hover:text-red-500 shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="Concept name"
                    value={conceptName}
                    onChange={e => setConceptName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addConcept(); } }}
                    className={cn(inputCls, "sm:w-2/5")}
                  />
                  <input
                    type="text"
                    placeholder="Reference link (optional)"
                    value={conceptLink}
                    onChange={e => setConceptLink(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addConcept(); } }}
                    className={cn(inputCls, "flex-1")}
                  />
                  <button
                    type="button"
                    onClick={addConcept}
                    className="px-4 py-2 bg-white border border-border rounded-xl text-sm font-bold hover:bg-muted/50 shrink-0"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div>
                <label className={labelCls}>Share with</label>
                {form.shared_with.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {form.shared_with.map(id => (
                      <span key={id} className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-primary/10 text-primary text-xs font-bold rounded-lg">
                        {employeeName(id)}
                        <button
                          type="button"
                          onClick={() => setForm(f => ({ ...f, shared_with: f.shared_with.filter(s => s !== id) }))}
                          className="hover:text-red-500"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <SearchableSelect
                  value=""
                  placeholder="Add a colleague..."
                  onChange={val => val && setForm(f => (f.shared_with.includes(val) ? f : { ...f, shared_with: [...f.shared_with, val] }))}
                  options={employees.filter(o => !form.shared_with.includes(o.value))}
                  className="w-full h-[38px] px-3 bg-white border border-border rounded-xl text-sm"
                />
                <p className="text-[11px] text-muted-foreground mt-1.5">Shared colleagues can view and edit this research.</p>
              </div>
            </div>
            <div className="px-4 sm:px-8 py-3.5 sm:py-6 bg-muted/30 border-t border-border/50 flex items-center justify-end gap-2 sm:gap-3 mt-auto shrink-0">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                disabled={saving}
                className="px-3.5 sm:px-4 py-2 bg-white border border-border text-foreground/80 hover:bg-muted/50 font-bold text-xs sm:text-sm rounded-xl transition-colors shrink-0"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-xs sm:text-sm rounded-xl transition-colors shrink-0 flex items-center gap-1.5 disabled:opacity-60"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingId ? "Save Changes" : "Publish"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reader dialog */}
      <Dialog open={!!selected} onOpenChange={open => !open && setSelected(null)}>
        <DialogContent className="w-[calc(100vw-16px)] sm:max-w-[720px] p-0 overflow-hidden rounded-2xl sm:rounded-[2.5rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card flex flex-col max-h-[90dvh] min-h-[400px]">
          {selected && (
            <>
              <div className="px-6 sm:px-8 py-6 border-b border-border/50 bg-muted/30 flex items-start justify-between gap-4 shrink-0">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {selected.project_details?.project_name && (
                      <span className="px-2.5 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-lg uppercase tracking-wider flex items-center gap-1">
                        <FolderKanban className="w-3 h-3" />{selected.project_details.project_name}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {readTime(selected.description)}
                    </span>
                  </div>
                  <h2 className="text-xl md:text-2xl font-black tracking-tight text-foreground leading-tight break-words">{selected.title}</h2>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {selected.can_edit && (
                    <button onClick={() => openEdit(selected)} title="Edit" className="p-2 text-muted-foreground hover:text-primary hover:bg-muted rounded-full transition-colors">
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                  {selected.can_delete && (
                    <button onClick={() => handleDelete(selected)} title="Delete" className="p-2 text-muted-foreground hover:text-red-500 hover:bg-muted rounded-full transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => setSelected(null)} className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="px-6 sm:px-8 py-4 bg-muted/10 border-b border-border/40 flex items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <img src={avatarFor(selected.employee_details)} alt="" className="w-8 h-8 rounded-full border border-border/50" />
                  <div className="min-w-0">
                    <p className="text-xs font-black text-foreground truncate">{selected.employee_details?.employee_name || "Employee"}</p>
                    <p className="text-[10px] text-muted-foreground font-semibold">
                      Published {formatISTDate(selected.created_at)}
                      {selected.department ? ` · ${selected.department}` : ""}
                    </p>
                  </div>
                </div>
                {(selected.shared_with_details?.length ?? 0) > 0 && (
                  <div className="flex -space-x-2" title={selected.shared_with_details!.map(s => s.employee_name).join(", ")}>
                    {selected.shared_with_details!.slice(0, 5).map(s => (
                      <img key={s._id} src={avatarFor(s)} alt={s.employee_name} className="w-7 h-7 rounded-full ring-2 ring-white" />
                    ))}
                  </div>
                )}
              </div>

              <div className="p-6 sm:p-8 overflow-y-auto flex-1 space-y-6 text-left">
                <div className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap font-medium break-words">
                  {selected.description || "No notes added for this research."}
                </div>

                {selected.concepts?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Concepts & References</h4>
                    <div className="space-y-2">
                      {selected.concepts.map((c, idx) => (
                        <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-muted/40 border border-border rounded-xl text-sm">
                          <span className="font-bold shrink-0 max-w-[45%] truncate">{c.concept_name}</span>
                          {c.link && (
                            <a
                              href={/^https?:\/\//i.test(c.link) ? c.link : `https://${c.link}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline truncate flex items-center gap-1 min-w-0"
                            >
                              <Link2 className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{c.link}</span>
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selected.history?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5" /> Activity
                    </h4>
                    <div className="space-y-1.5">
                      {[...selected.history].reverse().map((h, idx) => (
                        <div key={idx} className="flex items-start justify-between gap-3 text-xs">
                          <span className="text-foreground/80">
                            <span className="font-bold">{h.employee_details?.employee_name || "Someone"}</span>{" "}
                            {h.changes_summary || h.action}
                          </span>
                          <span className="text-muted-foreground shrink-0">{formatISTDateTime(h.timestamp)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
