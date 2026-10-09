import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { Plus, Trash2, Edit2, FileText, Search, ChevronRight, Loader2, X, FileType2, Save, ArrowLeft } from "lucide-react";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";

const ReactQuillComponent = lazy<React.ComponentType<any>>(async () => {
  if (typeof window === "undefined") {
    return { default: () => null };
  }
  try {
    await import("react-quill-new/dist/quill.snow.css");
    const mod = await import("react-quill-new");
    return { default: mod.default };
  } catch (e) {
    return { default: () => null };
  }
});

interface DocTemplate {
  id: string;
  name: string;
  category: string;
  lastUpdated: string;
  content: string;
}

interface LetterheadConfig {
  enabled: boolean;
  companyName: string;
  tagline: string;
  logoUrl: string;
  headerImageUrl: string;
}

const DEFAULT_LETTERHEAD: LetterheadConfig = {
  enabled: true,
  companyName: "HariKrushn DigiVerse LLP",
  tagline: "Innovate • Transform • Grow",
  logoUrl: "",
  headerImageUrl: "",
};

const AVAILABLE_VARIABLES = [
  { label: "Date", value: "{{Date}}" },
  { label: "Designation", value: "{{designation}}" },
  { label: "Department", value: "{{department}}" },
  { label: "Work Location", value: "{{workLocation}}" },
  { label: "Monthly Salary", value: "{{monthlySalary}}" },
  { label: "Office Start Time", value: "{{officeStartTime}}" },
  { label: "Office End Time", value: "{{officeEndTime}}" },
  { label: "Min Working Hours", value: "{{minWorkingHours}}" },
  { label: "Late Cutoff Time", value: "{{lateCutoffTime}}" },
  { label: "Monthly Leave Count", value: "{{monthlyLeaveCount}}" },
  { label: "Notice Period Days", value: "{{noticePeriodDays}}" },
  { label: "Court Jurisdiction", value: "{{courtJurisdictionCity}}" },
  { label: "Signatory Name", value: "{{signatoryName}}" },
  { label: "Signatory Title", value: "{{signatoryTitle}}" },
  { label: "Employee Name", value: "{{employee_name}}" },
  { label: "Joining Date", value: "{{joining_date}}" },
  { label: "Company Name", value: "{{company_name}}" },
];

const QUILL_MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, 4, false] }],
    ["bold", "italic", "underline", "strike", "blockquote"],
    [{ list: "ordered" }, { list: "bullet" }],
    [{ color: [] }, { background: [] }],
    [{ align: [] }],
    ["link", "clean"],
  ],
};

export function DocumentTemplates() {
  const [isMounted, setIsMounted] = useState(false);
  const [templates, setTemplates] = useState<DocTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Inline Editing State (NO POPUP MODAL)
  const [isInlineEditing, setIsInlineEditing] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [tempName, setTempName] = useState("");
  const [tempCategory, setTempCategory] = useState("");
  const [tempContent, setTempContent] = useState("");

  const [letterheadConfig, setLetterheadConfig] = useState<LetterheadConfig>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("document_letterhead_config");
      if (stored) {
        try {
          return { ...DEFAULT_LETTERHEAD, ...JSON.parse(stored) };
        } catch (e) {}
      }
    }
    return DEFAULT_LETTERHEAD;
  });

  useEffect(() => {
    setIsMounted(true);

    const handleSync = () => {
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem("document_letterhead_config");
        if (stored) {
          try {
            setLetterheadConfig({ ...DEFAULT_LETTERHEAD, ...JSON.parse(stored) });
          } catch (e) {}
        }
      }
    };
    handleSync();
    window.addEventListener("storage", handleSync);
    window.addEventListener("focus", handleSync);
    return () => {
      window.removeEventListener("storage", handleSync);
      window.removeEventListener("focus", handleSync);
    };
  }, []);

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const res = await api.get("/document-templates", { showLoader: false, showErrorToast: false });
      const rawTemplates = Array.isArray(res) ? res : res?.items || res?.data || [];
      const mapped: DocTemplate[] = rawTemplates.map((item: any) => ({
        id: String(item._id || item.id),
        name: item.template_name || item.name || "Untitled Template",
        category: item.category || "General",
        lastUpdated: item.updated_at 
          ? new Date(item.updated_at).toISOString().split("T")[0] 
          : item.created_at 
            ? new Date(item.created_at).toISOString().split("T")[0]
            : "-",
        content: item.content || "",
      }));
      setTemplates(mapped);

      // Auto-select first template if none selected
      if (mapped.length > 0 && !selectedTemplateId && mapped[0]) {
        setSelectedTemplateId(mapped[0].id);
      }
    } catch (err: any) {
      console.error("Failed to fetch document templates:", err);
      toast.error(err?.message || "Failed to load document templates");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return templates;
    const q = searchQuery.toLowerCase();
    return templates.filter((t) => t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q));
  }, [templates, searchQuery]);

  const selectedTemplate = useMemo(() => {
    return templates.find((t) => t.id === selectedTemplateId) || filteredTemplates[0] || templates[0] || null;
  }, [templates, filteredTemplates, selectedTemplateId]);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    idToDelete?: string;
    nameToDelete?: string;
  }>({ isOpen: false });

  const handleStartCreateInline = () => {
    setEditingTemplateId(null);
    setTempName("");
    setTempCategory("General");
    setTempContent("<p>Dear <strong>{{employee_name}}</strong>,</p><p><br></p><p>Best regards,<br/><strong>{{company_name}}</strong></p>");
    setIsInlineEditing(true);
  };

  const handleStartEditInline = (tpl?: DocTemplate | null) => {
    const target = tpl || selectedTemplate;
    if (!target) return;
    setEditingTemplateId(target.id);
    setTempName(target.name);
    setTempCategory(target.category);
    setTempContent(target.content || "");
    setIsInlineEditing(true);
  };

  const handleCancelInlineEdit = () => {
    setIsInlineEditing(false);
    setEditingTemplateId(null);
  };

  const confirmDelete = (id: string, name: string) => {
    setConfirmModal({ isOpen: true, idToDelete: id, nameToDelete: name });
  };

  const executeDelete = async () => {
    if (!confirmModal.idToDelete) return;
    try {
      await api.delete(`/document-templates/${confirmModal.idToDelete}`);
      toast.success(`Template "${confirmModal.nameToDelete}" deleted successfully`);
      const nextTemplates = templates.filter((t) => t.id !== confirmModal.idToDelete);
      setTemplates(nextTemplates);
      if (selectedTemplateId === confirmModal.idToDelete) {
        setSelectedTemplateId(nextTemplates[0]?.id || null);
      }
      setIsInlineEditing(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete document template");
    } finally {
      setConfirmModal({ isOpen: false });
    }
  };

  const handleSaveTemplate = async () => {
    if (!tempName.trim() || !tempContent.trim()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        template_name: tempName.trim(),
        category: tempCategory.trim() || "General",
        content: tempContent,
      };

      let savedId = editingTemplateId;
      if (editingTemplateId) {
        await api.put(`/document-templates/${editingTemplateId}`, payload);
        toast.success(`Template "${tempName}" updated successfully`);
      } else {
        const res = await api.post("/document-templates", payload);
        savedId = String(res._id || res.id || "");
        toast.success(`Template "${tempName}" created successfully`);
      }

      setIsInlineEditing(false);
      setEditingTemplateId(null);
      await fetchTemplates();
      if (savedId) {
        setSelectedTemplateId(savedId);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to save document template");
    } finally {
      setIsSubmitting(false);
    }
  };

  const insertVariable = (varValue: string) => {
    setTempContent((prev) => prev + ` ${varValue} `);
  };

  const insertPageBreak = () => {
    setTempContent((prev) => prev + `<div class="page-break"></div>`);
    toast.info("Page Break inserted! Content below this will start on next page.");
  };

  // Extract variables dynamically from selected template content
  const extractedFields = useMemo(() => {
    const textToParse = isInlineEditing ? tempContent : selectedTemplate?.content || "";
    if (!textToParse) return [];
    const matches = textToParse.match(/{{([a-zA-Z0-9_]+)}}/g);
    if (!matches) return [];
    return Array.from(new Set(matches.map((m) => m.replace(/[{}]/g, "").trim())));
  }, [selectedTemplate, isInlineEditing, tempContent]);

  // Parse multi-page sections automatically for A4 height with fluid text flow across pages
  const pageSections = useMemo(() => {
    const rawContent = isInlineEditing ? tempContent : selectedTemplate?.content || "";
    if (!rawContent) return [""];

    // Clean out hardcoded page breaks so text flows fluidly across pages
    const cleanContent = rawContent.replace(
      /(?:<hr\s*class="[^"]*page-break[^"]*"[^>]*>|<div\s*class="[^"]*page-break[^"]*"[^>]*><\/div>|<!--\s*pagebreak\s*-->|{{page_break}}|<p[^>]*style="[^"]*page-break-before:\s*always[^"]*"[^>]*>)/gi,
      ""
    );

    let blocks: string[] = [];
    if (typeof window !== "undefined") {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<div>${cleanContent}</div>`, "text/html");
        const container = doc.body.firstElementChild;
        if (container && container.childNodes.length > 0) {
          blocks = Array.from(container.childNodes)
            .map((node) => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                return (node as HTMLElement).outerHTML;
              }
              const txt = (node.textContent || "").trim();
              return txt ? `<p>${txt}</p>` : "";
            })
            .filter(Boolean);
        }
      } catch (e) {
        console.warn("DOMParser error fallback:", e);
      }
    }

    if (!blocks || blocks.length <= 5) {
      return [cleanContent];
    }

    const pages: string[] = [];
    let currentPageHtml = "";
    let currentLength = 0;
    const MAX_PAGE_CHARS = 3800; // Optimal A4 printable capacity below header (~600 words)

    for (const block of blocks) {
      const textLen = block.replace(/<[^>]*>/g, "").trim().length;
      if (currentPageHtml && (currentLength + textLen > MAX_PAGE_CHARS)) {
        pages.push(currentPageHtml);
        currentPageHtml = block;
        currentLength = textLen;
      } else {
        currentPageHtml += block;
        currentLength += textLen;
      }
    }

    if (currentPageHtml.trim()) {
      pages.push(currentPageHtml);
    }

    return pages.length > 0 ? pages : [cleanContent];
  }, [selectedTemplate, isInlineEditing, tempContent]);

  const handlePageEditorKeyDown = (e: React.KeyboardEvent, secIdx: number) => {
    if (e.key === "Backspace" && secIdx > 0) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const editorNode = e.currentTarget.querySelector(".ql-editor");
        const rawText = editorNode?.textContent || "";
        
        if (
          editorNode &&
          (range.startOffset === 0 || rawText.trim().length === 0 || range.startContainer === editorNode || range.startContainer === editorNode.firstChild)
        ) {
          e.preventDefault();
          const updated = [...pageSections];
          updated[secIdx - 1] = (updated[secIdx - 1] || "") + (updated[secIdx] || "");
          updated.splice(secIdx, 1);
          setTempContent(updated.join(""));
        }
      }
    }
  };

  const renderLetterheadHeader = () => {
    if (!letterheadConfig.enabled) return null;
    if (letterheadConfig.headerImageUrl) {
      return (
        <div className="relative w-full overflow-hidden bg-white select-none shrink-0 mb-6">
          <img src={letterheadConfig.headerImageUrl} alt="Letterhead Header" className="w-full max-h-36 object-cover" />
        </div>
      );
    }
    return (
      <div className="relative w-full overflow-hidden bg-white select-none shrink-0 mb-8">
        <div className="flex items-center justify-between min-h-[90px] px-6 sm:px-8 py-3">
          <div className="flex items-center gap-4 z-10">
            {letterheadConfig.logoUrl ? (
              <img src={letterheadConfig.logoUrl} alt="Logo" className="h-12 sm:h-14 w-auto object-contain" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-[#0f2552] text-white flex items-center justify-center font-black text-xl shadow-md">
                {(letterheadConfig.companyName || "H").charAt(0)}
              </div>
            )}
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-[#0f2552] tracking-tight leading-tight">
                {letterheadConfig.companyName || "HariKrushn DigiVerse LLP"}
              </h2>
              <p className="text-xs sm:text-sm font-bold text-emerald-600 flex items-center gap-1.5 mt-0.5">
                <span className="text-[#0f2552]">|</span> {letterheadConfig.tagline || "Innovate • Transform • Grow"}
              </p>
            </div>
          </div>
          <div className="absolute right-0 top-0 h-full w-[45%] pointer-events-none overflow-hidden hidden sm:block">
            <svg viewBox="0 0 350 100" preserveAspectRatio="none" className="h-full w-full">
              <path d="M 100,0 C 180,30 250,70 350,100 L 350,0 Z" fill="#0f2552" />
              <path d="M 210,100 C 260,75 300,40 350,0 L 350,100 Z" fill="#6bb82d" />
            </svg>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <style>{`
        /* Inline A4 Quill Paper Editor Styling */
        .a4-quill-editor .ql-toolbar.ql-snow {
          border: 1px solid rgba(226, 232, 240, 0.9) !important;
          border-radius: 9999px !important;
          background: #ffffff !important;
          box-shadow: 0 10px 30px -5px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.05) !important;
          margin-bottom: 1rem !important;
          padding: 0.4rem 1rem !important;
          position: sticky !important;
          top: 0.75rem !important;
          z-index: 40 !important;
          display: flex !important;
          flex-wrap: wrap !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 0.35rem !important;
          max-width: 680px !important;
          width: 100% !important;
        }
        .dark .a4-quill-editor .ql-toolbar.ql-snow {
          background: #1e293b !important;
          border-color: rgba(51, 65, 85, 0.8) !important;
          color: #f8fafc !important;
        }
        .a4-quill-editor .ql-container.ql-snow {
          border: none !important;
          font-family: inherit !important;
          font-size: 0.95rem !important;
        }
        .a4-quill-editor .ql-editor {
          min-height: 400px !important;
          padding: 0 !important;
          font-size: 0.95rem !important;
          line-height: 1.6 !important;
          color: #1e293b !important;
        }
        .a4-quill-editor .ql-editor p, .prose p {
          margin-top: 0.35rem !important;
          margin-bottom: 0.6rem !important;
          line-height: 1.65 !important;
        }
        .a4-quill-editor .ql-editor h1, .prose h1,
        .a4-quill-editor .ql-editor h2, .prose h2,
        .a4-quill-editor .ql-editor h3, .prose h3 {
          margin-top: 0.85rem !important;
          margin-bottom: 0.45rem !important;
          font-weight: 800 !important;
          color: #0f172a !important;
        }
        .a4-quill-editor .ql-editor ul, .prose ul,
        .a4-quill-editor .ql-editor ol, .prose ol {
          margin-top: 0.4rem !important;
          margin-bottom: 0.6rem !important;
          padding-left: 1.5rem !important;
        }
        .a4-quill-editor .ql-editor.ql-blank::before {
          left: 0 !important;
          font-style: normal !important;
          color: #94a3b8 !important;
        }
      `}</style>

      {/* Master-Detail Layout */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left Column: Templates List */}
        <div className="w-full lg:w-80 shrink-0 bg-card border border-border/50 rounded-2xl p-4 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-lg flex items-center gap-2 text-foreground">
              <FileText className="w-5 h-5 text-primary" />
              Templates
            </h3>
            <button
              onClick={handleStartCreateInline}
              className="p-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl transition-colors shadow-sm flex items-center justify-center"
              title="Create New Template"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates..."
              className="w-full pl-9 pr-3 py-2 bg-muted/30 border border-border/40 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium"
            />
          </div>

          {/* Template List */}
          <div className="space-y-2 max-h-[650px] overflow-y-auto pr-1 custom-scrollbar">
            {isLoading ? (
              <div className="py-8 text-center text-muted-foreground text-xs">
                <Loader2 className="w-5 h-5 mx-auto animate-spin mb-2 text-primary" />
                Loading templates...
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-xs border border-dashed border-border/40 rounded-xl">
                No templates found.
              </div>
            ) : (
              filteredTemplates.map((tpl) => {
                const isSelected = selectedTemplate?.id === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    onClick={() => {
                      setSelectedTemplateId(tpl.id);
                      setIsInlineEditing(false);
                    }}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between group ${
                      isSelected
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-md font-bold"
                        : "bg-background hover:bg-muted/50 border-border/50 text-foreground font-medium"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          isSelected ? "bg-white/20 text-white" : "bg-primary/10 text-primary"
                        }`}
                      >
                        <FileType2 className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold truncate">{tpl.name}</h4>
                        <span className={`text-[10px] uppercase font-mono tracking-wider ${isSelected ? "text-emerald-100" : "text-muted-foreground"}`}>
                          {tpl.category || "General"}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${isSelected ? "text-white translate-x-0.5" : "text-muted-foreground/50 group-hover:translate-x-0.5"}`} />
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Inline A4 Editor / View */}
        <div className="flex-1 w-full min-w-0 bg-card border border-border/50 rounded-2xl p-4 sm:p-6 shadow-sm space-y-6">
          {isInlineEditing ? (
            /* INLINE EDITING MODE - DIRECT A4 CONTENT EDITING */
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Top Header Bar */}
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between border-b border-border/50 pb-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleCancelInlineEdit}
                    className="p-2 border border-border rounded-xl hover:bg-muted/50 transition-colors text-muted-foreground"
                    title="Back to view mode"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
                      <Edit2 className="w-5 h-5 text-emerald-600" />
                      {editingTemplateId ? `Editing: ${tempName || "Untitled"}` : "Create New Document Template"}
                    </h2>
                    <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                      Click directly inside the paper sheet to edit content in place.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    onClick={handleCancelInlineEdit}
                    className="px-4 py-2 border border-border text-foreground font-bold text-sm rounded-xl hover:bg-muted/50 transition-colors flex items-center gap-2 shadow-xs"
                  >
                    <X className="w-4 h-4" /> Cancel
                  </button>
                  <button
                    onClick={handleSaveTemplate}
                    disabled={!tempName.trim() || !tempContent.replace(/<[^>]*>/g, "").trim() || isSubmitting}
                    className="px-6 py-2 bg-emerald-600 text-white hover:bg-emerald-700 font-bold text-sm rounded-xl transition-colors disabled:opacity-50 shadow-md flex items-center gap-2"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {isSubmitting ? "Saving..." : editingTemplateId ? "Update Template" : "Save Template"}
                  </button>
                </div>
              </div>

              {/* Template Metadata Controls */}
              <div className="grid gap-4 sm:grid-cols-2 bg-muted/20 border border-border/40 p-4 rounded-xl">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Template Name *
                  </label>
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    placeholder="e.g. Employee Agreement Letter"
                    className="w-full px-4 py-2 bg-background border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all text-sm font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Category
                  </label>
                  <input
                    type="text"
                    value={tempCategory}
                    onChange={(e) => setTempCategory(e.target.value)}
                    placeholder="e.g. HR, Legal, Onboarding"
                    className="w-full px-4 py-2 bg-background border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all text-sm font-medium"
                  />
                </div>
              </div>

              {/* Dynamic Variables Selector Toolbar */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Dynamic Variable Shortcuts
                </label>
                <div className="flex flex-wrap gap-1.5 p-3 bg-muted/30 border border-border/40 rounded-xl max-h-36 overflow-y-auto custom-scrollbar">
                  {AVAILABLE_VARIABLES.map((v) => (
                    <button
                      key={v.value}
                      type="button"
                      onClick={() => insertVariable(v.value)}
                      className="px-2.5 py-1 text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 rounded-lg border border-emerald-500/20 transition-colors flex items-center gap-1"
                    >
                      <span>+</span> {v.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* DIRECT INLINE MULTI-PAGE A4 EDITOR */}
              <div className="bg-slate-100 dark:bg-slate-900/60 border border-border/50 rounded-2xl p-3 sm:p-6 flex flex-col items-center space-y-6">
                {pageSections.map((secHtml, secIdx) => (
                  <div key={secIdx} className="w-full flex flex-col items-center">
                    {/* Individual A4 Paper Sheet Card for Edit Phase */}
                    <div className="w-full max-w-[210mm] min-h-[297mm] a4-quill-editor bg-white text-slate-900 shadow-md rounded-2xl border border-slate-200 overflow-hidden relative flex flex-col justify-between">
                      <div>
                        {/* Top Letterhead Header on EVERY page in Edit Phase */}
                        {renderLetterheadHeader()}

                        {/* Direct In-Place Text Editor for Page Section */}
                        <div className="px-8 sm:px-14 pt-2 pb-14" onKeyDown={(e) => handlePageEditorKeyDown(e, secIdx)}>
                          {isMounted ? (
                            <Suspense fallback={<div className="h-80 flex items-center justify-center text-sm text-muted-foreground">Loading Page {secIdx + 1} Editor...</div>}>
                              <ReactQuillComponent
                                theme="snow"
                                value={secHtml}
                                onChange={(val: string) => {
                                  const updated = [...pageSections];
                                  updated[secIdx] = val;
                                  setTempContent(updated.join(""));
                                }}
                                modules={QUILL_MODULES}
                                placeholder={`Write content for Page ${secIdx + 1}...`}
                              />
                            </Suspense>
                          ) : (
                            <textarea
                              value={secHtml}
                              onChange={(e) => {
                                const updated = [...pageSections];
                                updated[secIdx] = e.target.value;
                                setTempContent(updated.join(""));
                              }}
                              placeholder={`Write content for Page ${secIdx + 1}...`}
                              className="w-full h-[400px] p-4 bg-transparent border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm font-medium resize-none"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : selectedTemplate ? (
            /* VIEW MODE - FULL PAGE CANVAS */
            <>
              {/* Header Bar */}
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between border-b border-border/50 pb-4">
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
                    Template: {selectedTemplate.name}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5 font-medium">Click on document content below to edit directly.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => confirmDelete(selectedTemplate.id, selectedTemplate.name)}
                    className="px-4 py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors font-bold text-sm flex items-center gap-1.5 shadow-xs"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                  <button
                    onClick={() => handleStartEditInline(selectedTemplate)}
                    className="px-5 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl transition-colors font-bold text-sm flex items-center gap-1.5 shadow-md"
                  >
                    <Edit2 className="w-4 h-4" /> Edit Content
                  </button>
                </div>
              </div>

              {/* Template Fields */}
              <div className="space-y-2 bg-muted/20 border border-border/40 p-4 rounded-xl">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Template Dynamic Fields</h4>
                <div className="flex flex-wrap gap-2 pt-1">
                  {extractedFields.length === 0 ? (
                    <span className="text-xs text-muted-foreground italic">No {"{{variable}}"} fields found in template content.</span>
                  ) : (
                    extractedFields.map((field) => (
                      <span
                        key={field}
                        className="px-3 py-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold rounded-full text-xs border border-emerald-500/20"
                      >
                        {field}
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Document Content Preview Canvas */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">A4 Document Paper Preview</h4>
                  <span className="text-[10px] font-mono font-bold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded border border-slate-300/50">
                    {pageSections.length} {pageSections.length === 1 ? "A4 Page" : "A4 Pages"}
                  </span>
                </div>

                {/* Multi-Page Full-Width Sheet Canvas Container */}
                <div className="bg-slate-100 dark:bg-slate-900/60 border border-border/50 rounded-2xl p-3 sm:p-6 flex flex-col items-center space-y-6">
                  {pageSections.map((pageHtml, pageIndex) => (
                    <div key={pageIndex} className="w-full flex flex-col items-center">
                      {/* Individual A4 Paper Sheet Card */}
                      <div
                        onClick={() => handleStartEditInline(selectedTemplate)}
                        className="w-full max-w-[210mm] min-h-[297mm] bg-white text-slate-900 shadow-md rounded-2xl border border-slate-200 overflow-hidden relative transition-all flex flex-col justify-between hover:ring-2 hover:ring-emerald-500/40 cursor-pointer group"
                        title="Click anywhere to edit content"
                      >
                        <div>
                          {/* Top Letterhead Header (Page 1 & Repeating on Page 2, 3, etc.) */}
                          {renderLetterheadHeader()}

                          {/* Page HTML Content */}
                          <div
                            className="prose prose-sm max-w-none text-slate-800 font-normal leading-relaxed break-words px-8 sm:px-14 pt-2 pb-14"
                            dangerouslySetInnerHTML={{ __html: pageHtml }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="py-20 text-center text-muted-foreground border border-dashed border-border/50 rounded-xl">
              Select a template from the left sidebar or click "Create Template" to get started.
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false })}
        onConfirm={executeDelete}
        title="Delete Template"
        description="Are you sure you want to delete this template? Any pending generations using this template might be affected."
        itemName={confirmModal.nameToDelete || ""}
      />
    </div>
  );
}
