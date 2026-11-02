import React, { useState, useEffect, useMemo } from "react";
import {
  FileText,
  Plus,
  Trash2,
  Edit2,
  Copy,
  Check,
  Save,
  Download,
  Search,
  Sparkles,
  X,
  BookOpen,
  Calendar,
  User,
  Info,
  Loader2,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

export interface DocPage {
  id: string;
  title: string;
  content: string;
  updated_at?: string | null;
  updated_by?: string | null;
}

interface ProjectDocsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  clientName?: string | undefined;
}

export const ProjectDocsModal: React.FC<ProjectDocsModalProps> = ({
  isOpen,
  onClose,
  projectId,
  projectName,
  clientName,
}) => {
  const [pages, setPages] = useState<DocPage[]>([]);
  const [activePageId, setActivePageId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");

  // Load project docs from backend
  useEffect(() => {
    if (!isOpen || !projectId) return;
    let alive = true;
    (async () => {
      try {
        setIsLoading(true);
        const res = await api.get<{ status: string; data: DocPage[] }>(`/projects/${projectId}/docs`);
        if (alive && res?.data && Array.isArray(res.data)) {
          setPages(res.data);
          if (res.data.length > 0) {
            if (res.data[0]?.id) setActivePageId(res.data[0].id);
          }
        }
      } catch (err: any) {
        toast.error("Failed to load project documentation");
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [isOpen, projectId]);

  const activePage = useMemo(() => {
    return pages.find((p) => p.id === activePageId) || pages[0] || null;
  }, [pages, activePageId]);

  const filteredPages = useMemo(() => {
    if (!searchQuery.trim()) return pages;
    const q = searchQuery.toLowerCase();
    return pages.filter(
      (p) => p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q)
    );
  }, [pages, searchQuery]);

  const handleContentChange = (newContent: string) => {
    if (!activePage) return;
    setPages((prev) =>
      prev.map((p) => (p.id === activePage.id ? { ...p, content: newContent } : p))
    );
  };

  const handleSaveDocs = async () => {
    if (!projectId) return;
    try {
      setIsSaving(true);
      await api.put(`/projects/${projectId}/docs`, { pages });
      toast.success("Document saved successfully!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save document");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddPage = () => {
    const newId = `page_${Date.now()}`;
    const newPageTitle = `New Document ${pages.length + 1}`;
    const newPage: DocPage = {
      id: newId,
      title: newPageTitle,
      content: `## ${newPageTitle}\nPaste ChatGPT content, brand guidelines, or notes here...`,
      updated_at: new Date().toISOString(),
      updated_by: "You",
    };
    const updated = [...pages, newPage];
    setPages(updated);
    setActivePageId(newId);
    setEditingTitleId(newId);
    setTitleDraft(newPageTitle);
  };

  const handleDeletePage = (pageId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (pages.length <= 1) {
      toast.error("At least one document page is required");
      return;
    }
    if (!confirm("Are you sure you want to delete this document page?")) return;
    const updated = pages.filter((p) => p.id !== pageId);
    setPages(updated);
    if (activePageId === pageId) {
      setActivePageId(updated[0]?.id || "");
    }
    toast.success("Page deleted");
  };

  const handleRenameTitle = (pageId: string) => {
    if (!titleDraft.trim()) {
      setEditingTitleId(null);
      return;
    }
    setPages((prev) =>
      prev.map((p) => (p.id === pageId ? { ...p, title: titleDraft.trim() } : p))
    );
    setEditingTitleId(null);
  };

  const handleCopyContent = () => {
    if (!activePage) return;
    navigator.clipboard.writeText(activePage.content);
    setCopied(true);
    toast.success("Content copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadDoc = () => {
    if (!activePage) return;
    const blob = new Blob([activePage.content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activePage.title.replace(/[^a-zA-Z0-9_-]/g, "_")}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Document downloaded!");
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[280] flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-xs" />
      <div
        className="relative z-10 w-full max-w-5xl bg-card border border-border/80 rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden h-[92vh] max-h-[900px] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-border/60 bg-muted/20 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0 shadow-sm">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-foreground truncate">
                  Brand Knowledge & Project Docs
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                  Docs
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {projectName} {clientName ? `• ${clientName}` : ""} • USP, guidelines & strategy repository
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleSaveDocs}
              disabled={isSaving}
              className="px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>Save</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Sidebar + Main Content Area */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          {/* Left Sidebar (Doc Pages) */}
          <div className="w-full md:w-72 bg-muted/20 border-b md:border-b-0 md:border-r border-border/60 flex flex-col shrink-0">
            {/* Search + Add Page */}
            <div className="p-3 border-b border-border/50 space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search pages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-background border border-border/60 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <button
                type="button"
                onClick={handleAddPage}
                className="w-full py-1.5 px-3 rounded-xl border border-dashed border-primary/40 hover:border-primary bg-primary/5 hover:bg-primary/10 text-primary text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add New Page</span>
              </button>
            </div>

            {/* Pages List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {isLoading ? (
                <div className="py-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span>Loading documentation...</span>
                </div>
              ) : filteredPages.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No pages found
                </div>
              ) : (
                filteredPages.map((page) => {
                  const isActive = activePage?.id === page.id;
                  const isEditing = editingTitleId === page.id;
                  return (
                    <div
                      key={page.id}
                      onClick={() => {
                        setActivePageId(page.id);
                        setEditingTitleId(null);
                      }}
                      className={cn(
                        "group relative flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-foreground hover:bg-muted/60"
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <FileText className={cn("w-3.5 h-3.5 shrink-0", isActive ? "text-primary-foreground" : "text-primary")} />
                        {isEditing ? (
                          <input
                            type="text"
                            value={titleDraft}
                            onChange={(e) => setTitleDraft(e.target.value)}
                            onBlur={() => handleRenameTitle(page.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleRenameTitle(page.id);
                              if (e.key === "Escape") setEditingTitleId(null);
                            }}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                            className="w-full bg-background text-foreground text-xs px-1.5 py-0.5 rounded border border-primary focus:outline-none"
                          />
                        ) : (
                          <span className="truncate">{page.title}</span>
                        )}
                      </div>

                      {/* Hover Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingTitleId(page.id);
                            setTitleDraft(page.title);
                          }}
                          className={cn(
                            "p-1 rounded hover:bg-black/10 transition",
                            isActive ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                          )}
                          title="Rename Page"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeletePage(page.id, e)}
                          className={cn(
                            "p-1 rounded hover:bg-black/10 transition",
                            isActive ? "text-primary-foreground" : "text-rose-500 hover:text-rose-700"
                          )}
                          title="Delete Page"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Main Editor Area */}
          <div className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden">
            {activePage ? (
              <>
                {/* Editor Header Bar */}
                <div className="px-5 py-3 border-b border-border/50 bg-muted/10 flex flex-wrap items-center justify-between gap-3 shrink-0">
                  <div className="min-w-0">
                    <h3 className="text-sm font-black text-foreground truncate">
                      {activePage.title}
                    </h3>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                      <span>{activePage.content.length} characters</span>
                      <span>•</span>
                      <span>{activePage.content.trim().split(/\s+/).filter(Boolean).length} words</span>
                      {activePage.updated_at && (
                        <>
                          <span>•</span>
                          <span>Last edited {new Date(activePage.updated_at).toLocaleDateString()}</span>
                        </>
                      )}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyContent}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-border/60 hover:bg-muted text-foreground transition flex items-center gap-1.5 cursor-pointer"
                      title="Copy content for ChatGPT or client"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                      <span>{copied ? "Copied" : "Copy Text"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadDoc}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-border/60 hover:bg-muted text-foreground transition flex items-center gap-1.5 cursor-pointer"
                      title="Download as Markdown"
                    >
                      <Download className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>Download</span>
                    </button>
                  </div>
                </div>

                {/* Main Large Text Area (ChatGPT Ctrl+C / Ctrl+V Friendly) */}
                <div className="flex-1 p-4 sm:p-6 overflow-hidden flex flex-col">
                  <textarea
                    value={activePage.content}
                    onChange={(e) => handleContentChange(e.target.value)}
                    placeholder="Write or paste your ChatGPT output, USP, competitor research, target audience, brand hooks here (Ctrl+V)..."
                    className="w-full flex-1 resize-none bg-transparent font-sans text-xs sm:text-sm text-foreground leading-relaxed p-2 focus:outline-none border-0 rounded-xl selection:bg-primary/20 placeholder:text-muted-foreground/60"
                  />
                </div>

                {/* Quick Info Footer */}
                <div className="px-5 py-2.5 border-t border-border/50 bg-muted/20 flex items-center justify-between text-[11px] text-muted-foreground shrink-0">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    <span>Formatted for instant copy-pasting to ChatGPT or ad copies</span>
                  </div>
                  <div className="font-semibold text-foreground">
                    Project: <span className="text-primary">{projectName}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <BookOpen className="w-12 h-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-bold text-foreground">No Document Selected</p>
                <p className="text-xs text-muted-foreground max-w-sm mt-1">
                  Choose a page from the sidebar or click "Add New Page" to document brand USPs, demographics, and campaign strategies.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
