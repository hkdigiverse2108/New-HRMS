import { useState, useEffect, useLayoutEffect, useMemo, useRef, lazy, Suspense, memo, useCallback } from "react";
import {
  Plus,
  Trash2,
  Edit2,
  FileText,
  Search,
  ChevronRight,
  Loader2,
  X,
  FileType2,
  Save,
  ArrowLeft,
  Eye,
  Sparkles,
  GripHorizontal,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Quote,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
} from "lucide-react";
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
  { label: "Internship Position", value: "{{internshipPosition}}" },
  { label: "College / Institute", value: "{{collegeInstitute}}" },
  { label: "Internship Type", value: "{{internshipType}}" },
  { label: "Monthly Stipend", value: "{{monthlyStipend}}" },
];

const SAMPLE_PREVIEW_VARS: Record<string, string> = {
  Date: "01/10/2026",
  date: "01/10/2026",
  today: "01/10/2026",
  employee_name: "Vruti Nileshbhai Balar",
  employeeName: "Vruti Nileshbhai Balar",
  emp_name: "Vruti Nileshbhai Balar",
  candidate_name: "Vruti Nileshbhai Balar",
  intern_name: "Vruti Nileshbhai Balar",
  internName: "Vruti Nileshbhai Balar",
  joining_date: "01/10/2026",
  joiningDate: "01/10/2026",
  startDate: "01/10/2026",
  internshipStartDate: "01/10/2026",
  internship_start_date: "01/10/2026",
  designation: "UI/UX Designer",
  department: "Creative & Design",
  internshipPosition: "UI/UX Design Intern",
  internship_position: "UI/UX Design Intern",
  internshipType: "Paid Internship",
  collegeInstitute: "SCET Engineering College, Surat",
  college_institute: "SCET Engineering College, Surat",
  college: "SCET Engineering College",
  institute: "SCET Engineering College",
  workLocation: "Head Office (Surat)",
  monthlySalary: "₹15,000",
  stipend: "₹12,000 / month",
  stipendAmount: "₹12,000 / month",
  monthlyStipend: "₹12,000",
  officeStartTime: "09:30 AM",
  officeEndTime: "06:30 PM",
  minWorkingHours: "8.5 Hours",
  lateCutoffTime: "09:45 AM",
  monthlyLeaveCount: "2 Days",
  noticePeriodDays: "30 Days",
  courtJurisdictionCity: "Surat",
  signatoryName: "Harikrushn Patel",
  signatoryTitle: "Managing Director",
  company_name: "HariKrushn DigiVerse LLP",
  companyName: "HariKrushn DigiVerse LLP",
};

const QUILL_MODULES = {
  toolbar: {
    container: "#quill-custom-toolbar",
  },
};

// ─── A4 CONSTANTS ──────────────────────────────────────────────────────────
// A4 at 96 DPI: 210mm × 297mm
// Header ~90px + footer ~40px + padding ~60px = ~190px overhead for page 1
// Page 2+ only footer + padding overhead
const A4_PAGE1_CONTENT_PX = 870; // pixels available on page 1 (with header)
const A4_PAGE_N_CONTENT_PX = 1010; // pixels available on page 2+ (no header)
const LINE_HEIGHT_PX = 19.2; // 10pt × 1.4 line-height × 1.333 px/pt

// Estimate rendered height of an HTML block string
function estimateBlockHeight(html: string): number {
  const text = html.replace(/<[^>]*>/g, "");
  const lines = Math.max(1, Math.ceil(text.length / 90));
  const isTable = html.includes("<table");
  const isHeading = /<h[1-3]/i.test(html);
  const isList = /<[uo]l/i.test(html);
  const listItems = (html.match(/<li/gi) || []).length;

  if (isTable) {
    const rows = (html.match(/<tr/gi) || []).length || 1;
    return rows * 28 + 20;
  }
  if (isList) return listItems * LINE_HEIGHT_PX + 12;
  if (isHeading) return LINE_HEIGHT_PX * lines * 1.6 + 8;
  return lines * LINE_HEIGHT_PX + 6;
}

// Parse HTML into block-level elements
function parseHtmlToBlocks(html: string): string[] {
  if (!html || !html.trim()) return [];
  const blocks: string[] = [];

  let normalizedHtml = html
    .replace(/(?:<br\s*\/?>[\s]*){2,}/gi, "</p><p>")
    .replace(/\r?\n\r?\n/g, "</p><p>");

  if (
    !normalizedHtml.trim().startsWith("<p") &&
    !normalizedHtml.trim().startsWith("<h") &&
    !normalizedHtml.trim().startsWith("<ul") &&
    !normalizedHtml.trim().startsWith("<ol") &&
    !normalizedHtml.trim().startsWith("<table") &&
    !normalizedHtml.trim().startsWith("<div")
  ) {
    normalizedHtml = `<p>${normalizedHtml}</p>`;
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${normalizedHtml}</div>`, "text/html");
    const container = doc.body.firstElementChild;
    if (container && container.childNodes.length > 0) {
      for (const node of Array.from(container.childNodes)) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          const outer = el.outerHTML.trim();
          if (outer) blocks.push(outer);
        } else {
          const txt = (node.textContent || "").trim();
          if (txt) blocks.push(`<p>${txt}</p>`);
        }
      }
    }
  } catch (e) {
    if (html.trim()) blocks.push(html.trim());
  }
  return blocks;
}

// Distribute blocks across A4 pages based on pixel height estimation
function distributeBlocksToPages(blocks: string[]): string[] {
  if (blocks.length === 0) return [""];
  const pages: string[] = [];
  let pageHtml = "";
  let usedPx = 0;
  let maxPx = A4_PAGE1_CONTENT_PX;

  for (const block of blocks) {
    const h = estimateBlockHeight(block);
    if (pageHtml && usedPx + h > maxPx) {
      pages.push(pageHtml);
      pageHtml = block;
      usedPx = h;
      maxPx = A4_PAGE_N_CONTENT_PX;
    } else {
      pageHtml += block;
      usedPx += h;
    }
  }
  if (pageHtml.trim()) pages.push(pageHtml);
  return pages.length > 0 ? pages : [""];
}

// ─── SINGLE-PAGE EDITOR ────────────────────────────────────────────────────
// A stable contenteditable page that does NOT re-render its innerHTML when focused
const EditablePageCard = memo(({
  pIdx,
  totalPages,
  pageHtml,
  onContentChange,
  onBackspaceAtStart,
  onArrowUpAtTop,
  onArrowDownAtBottom,
  insertSignal,
}: {
  pIdx: number;
  totalPages: number;
  pageHtml: string;
  onContentChange: (html: string) => void;
  onBackspaceAtStart: () => void;
  onArrowUpAtTop: () => void;
  onArrowDownAtBottom: () => void;
  insertSignal?: { html: string; ts: number } | null;
}) => {
  const divRef = useRef<HTMLDivElement>(null);
  const isFocusedRef = useRef(false);
  const lastHtmlRef = useRef(pageHtml);

  // Only update DOM when NOT focused and content actually changed externally
  useLayoutEffect(() => {
    if (!divRef.current) return;
    if (isFocusedRef.current) return; // never touch DOM while user is typing
    if (lastHtmlRef.current === pageHtml) return;
    lastHtmlRef.current = pageHtml;
    divRef.current.innerHTML = pageHtml;
  }, [pageHtml]);

  // Initial mount
  useEffect(() => {
    if (divRef.current && !divRef.current.innerHTML.trim()) {
      divRef.current.innerHTML = pageHtml;
      lastHtmlRef.current = pageHtml;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Insert variable at cursor position
  useEffect(() => {
    if (!insertSignal || !isFocusedRef.current || !divRef.current) return;
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (!divRef.current.contains(range.commonAncestorContainer)) return;
    range.deleteContents();
    const frag = document.createRange().createContextualFragment(insertSignal.html);
    const lastNode = frag.lastChild;
    range.insertNode(frag);
    if (lastNode) {
      const r2 = document.createRange();
      r2.setStartAfter(lastNode);
      r2.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r2);
    }
    onContentChange(divRef.current.innerHTML);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insertSignal]);

  return (
    <div
      id={`editable-page-card-${pIdx}`}
      ref={divRef}
      contentEditable={true}
      suppressContentEditableWarning={true}
      onFocus={() => {
        isFocusedRef.current = true;
      }}
      onBlur={(e) => {
        isFocusedRef.current = false;
        const html = e.currentTarget.innerHTML;
        lastHtmlRef.current = html;
        onContentChange(html);
      }}
      onInput={(e) => {
        const html = e.currentTarget.innerHTML;
        lastHtmlRef.current = html;
        onContentChange(html);
      }}
      onKeyDown={(e) => {
        if (e.key === "Backspace") {
          const sel = window.getSelection();
          if (sel && sel.isCollapsed) {
            const target = e.currentTarget;
            const range = sel.getRangeAt(0);
            const atStart =
              range.startOffset === 0 &&
              (range.startContainer === target ||
                range.startContainer === target.firstChild ||
                range.startContainer.parentNode === target ||
                (range.startContainer.parentNode as HTMLElement)?.parentNode === target);
            if (atStart && pIdx > 0) {
              e.preventDefault();
              onBackspaceAtStart();
              return;
            }
          }
        } else if (e.key === "ArrowUp") {
          const sel = window.getSelection();
          if (sel && sel.isCollapsed) {
            const target = e.currentTarget;
            const range = sel.getRangeAt(0);
            const atTop =
              range.startOffset === 0 &&
              (range.startContainer === target ||
                range.startContainer === target.firstChild ||
                range.startContainer.parentNode === target ||
                (range.startContainer.parentNode as HTMLElement)?.parentNode === target);
            if (atTop && pIdx > 0) {
              e.preventDefault();
              onArrowUpAtTop();
            }
          }
        } else if (e.key === "ArrowDown") {
          const sel = window.getSelection();
          if (sel && sel.isCollapsed && pIdx < totalPages - 1) {
            const target = e.currentTarget;
            const lastChild = target.lastChild || target;
            const range = sel.getRangeAt(0);
            const atBottom =
              range.startContainer === lastChild ||
              (range.startContainer.parentNode as Node | null) === (lastChild as Node) ||
              (range.startContainer.nodeType === Node.TEXT_NODE &&
                range.startOffset === (range.startContainer.textContent?.length || 0));
            if (atBottom) {
              e.preventDefault();
              onArrowDownAtBottom();
            }
          }
        }
      }}
      className="document-preview-body text-slate-800 font-normal text-[10pt] leading-[1.4] break-words focus:outline-none focus:ring-2 focus:ring-emerald-500/25 rounded-xl transition-all flex-1 overflow-hidden no-scrollbar scrollbar-none"
      style={{ minHeight: "40px" }}
    />
  );
});

// Focus helper: move caret to end of element
function focusAtEnd(el: HTMLElement) {
  el.focus();
  const s = window.getSelection();
  if (s) {
    const r = document.createRange();
    r.selectNodeContents(el);
    r.collapse(false);
    s.removeAllRanges();
    s.addRange(r);
  }
}

// Focus helper: move caret to start of element
function focusAtStart(el: HTMLElement) {
  el.focus();
  const s = window.getSelection();
  if (s) {
    const r = document.createRange();
    r.selectNodeContents(el);
    r.collapse(true);
    s.removeAllRanges();
    s.addRange(r);
  }
}

export function DocumentTemplates() {
  const [isMounted, setIsMounted] = useState(false);
  const [templates, setTemplates] = useState<DocTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Inline Editing State
  const [isInlineEditing, setIsInlineEditing] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [tempName, setTempName] = useState("");
  const [tempCategory, setTempCategory] = useState("");

  // ── Core document content stored as FLAT list of block strings ──
  // This is the single source of truth for the editor
  const [docBlocks, setDocBlocks] = useState<string[]>([]);

  // Insert-at-cursor signal for variables
  const [insertSignal, setInsertSignal] = useState<{ html: string; ts: number } | null>(null);
  const [focusedPageIdx, setFocusedPageIdx] = useState<number>(0);

  const [showSampleDataInPreview, setShowSampleDataInPreview] = useState(true);
  const [editViewMode, setEditViewMode] = useState<"single" | "split">("single");

  // Synchronized Scroll References
  const editorScrollRef = useRef<HTMLDivElement>(null);
  const previewScrollRef = useRef<HTMLDivElement>(null);
  const isSyncingScroll = useRef(false);

  const handleEditorScroll = () => {
    if (isSyncingScroll.current) return;
    if (!editorScrollRef.current || !previewScrollRef.current) return;
    isSyncingScroll.current = true;
    const { scrollTop, scrollHeight, clientHeight } = editorScrollRef.current;
    const maxScroll = scrollHeight - clientHeight;
    if (maxScroll > 0) {
      const ratio = scrollTop / maxScroll;
      const previewMax = previewScrollRef.current.scrollHeight - previewScrollRef.current.clientHeight;
      previewScrollRef.current.scrollTop = ratio * previewMax;
    }
    requestAnimationFrame(() => {
      isSyncingScroll.current = false;
    });
  };

  const handlePreviewScroll = () => {
    if (isSyncingScroll.current) return;
    if (!editorScrollRef.current || !previewScrollRef.current) return;
    isSyncingScroll.current = true;
    const { scrollTop, scrollHeight, clientHeight } = previewScrollRef.current;
    const maxScroll = scrollHeight - clientHeight;
    if (maxScroll > 0) {
      const ratio = scrollTop / maxScroll;
      const editorMax = editorScrollRef.current.scrollHeight - editorScrollRef.current.clientHeight;
      editorScrollRef.current.scrollTop = ratio * editorMax;
    }
    requestAnimationFrame(() => {
      isSyncingScroll.current = false;
    });
  };

  // Draggable Toolbar State
  const [toolbarPos, setToolbarPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDraggingToolbar, setIsDraggingToolbar] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; posX: number; posY: number }>({
    startX: 0,
    startY: 0,
    posX: 0,
    posY: 0,
  });

  const handleToolbarMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("select") || target.closest(".ql-picker")) return;
    setIsDraggingToolbar(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: toolbarPos.x,
      posY: toolbarPos.y,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingToolbar) return;
      const dx = e.clientX - dragStartRef.current.startX;
      const dy = e.clientY - dragStartRef.current.startY;
      setToolbarPos({
        x: dragStartRef.current.posX + dx,
        y: dragStartRef.current.posY + dy,
      });
    };
    const handleMouseUp = () => setIsDraggingToolbar(false);
    if (isDraggingToolbar) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingToolbar]);

  const [letterheadConfig, setLetterheadConfig] = useState<LetterheadConfig>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("document_letterhead_config");
      if (stored) {
        try { return { ...DEFAULT_LETTERHEAD, ...JSON.parse(stored) }; } catch (e) {}
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
          try { setLetterheadConfig({ ...DEFAULT_LETTERHEAD, ...JSON.parse(stored) }); } catch (e) {}
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

  useEffect(() => { fetchTemplates(); }, []);

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

  // ── HTML utility functions ─────────────────────────────────────────────
  const cleanHtmlContent = (html: string) => {
    if (!html) return "";
    let clean = html;
    clean = clean.replace(/<hr\s*class="[^"]*page-break[^"]*"[^>]*>/gi, "");
    clean = clean.replace(/<div[^>]*class="[^"]*page-break[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "");
    clean = clean.replace(/\[---\s*A4 Page Break[^\]]*---\]/gi, "");
    clean = clean.replace(/<!--\s*pagebreak\s*-->/gi, "");
    clean = clean.replace(/{{page_break}}/gi, "");
    return clean;
  };

  const convertTemplateToEditableHtml = (rawHtml: string) => {
    if (!rawHtml) return "";
    const cleaned = cleanHtmlContent(rawHtml);
    return cleaned.replace(/{{([a-zA-Z0-9_]+)}}/g, (match, rawKey) => {
      const key = rawKey.trim();
      const val = SAMPLE_PREVIEW_VARS[key] || `[${key}]`;
      return `<span class="var-pill-sample" data-var="${key}" title="Variable: {{${key}}}">${val}</span>`;
    });
  };

  const convertEditableHtmlToTemplate = (editableHtml: string) => {
    if (!editableHtml) return "";
    let processed = cleanHtmlContent(editableHtml);
    processed = processed.replace(/<span[^>]*data-var="([a-zA-Z0-9_]+)"[^>]*>.*?<\/span>/gi, "{{$1}}");
    return processed;
  };

  // ── Block-to-pages distribution (memoized) ────────────────────────────
  // Pages for the EDITOR (no variable substitution, raw editable HTML)
  const editorPages = useMemo(() => {
    return distributeBlocksToPages(docBlocks);
  }, [docBlocks]);

  // ── Quill content for split-view editor (string) ─────────────────────
  const quillContent = useMemo(() => docBlocks.join(""), [docBlocks]);

  // ── Preview pages for view-mode and split-view ────────────────────────
  const getPreviewPages = useCallback((rawContent: string, useSampleVars: boolean = true): string[] => {
    if (!rawContent) return [""];
    const cleaned = cleanHtmlContent(rawContent);
    let processed = cleaned;

    if (useSampleVars) {
      processed = processed.replace(/{{([a-zA-Z0-9_]+)}}/g, (match, rawKey) => {
        const key = rawKey.trim();
        if (SAMPLE_PREVIEW_VARS[key]) {
          return `<span class="var-pill-sample" title="Variable: {{${key}}}">${SAMPLE_PREVIEW_VARS[key]}</span>`;
        }
        return `<span class="var-pill-missing" title="Variable: {{${key}}}">[${key}]</span>`;
      });
    } else {
      processed = processed.replace(/{{([a-zA-Z0-9_]+)}}/g, (match, rawKey) => {
        const key = rawKey.trim();
        return `<span class="var-pill-raw">{{${key}}}</span>`;
      });
    }

    const blocks = parseHtmlToBlocks(processed);
    return distributeBlocksToPages(blocks);
  }, []);

  // ── Editing lifecycle ──────────────────────────────────────────────────
  const handleStartCreateInline = () => {
    setEditingTemplateId(null);
    setTempName("");
    setTempCategory("General");
    const defaultRaw = "<p>Dear <strong>{{employee_name}}</strong>,</p><p><br></p><p>We are pleased to issue this document to you regarding your role as <strong>{{designation}}</strong> in the <strong>{{department}}</strong> department.</p><p><br></p><p>Best regards,<br/><strong>{{company_name}}</strong></p>";
    const editableHtml = convertTemplateToEditableHtml(defaultRaw);
    setDocBlocks(parseHtmlToBlocks(editableHtml));
    setToolbarPos({ x: 0, y: 0 });
    setIsInlineEditing(true);
  };

  const handleStartEditInline = (tpl?: DocTemplate | null) => {
    const target = tpl || selectedTemplate;
    if (!target) return;
    setEditingTemplateId(target.id);
    setTempName(target.name);
    setTempCategory(target.category);
    const editableHtml = convertTemplateToEditableHtml(target.content || "");
    setDocBlocks(parseHtmlToBlocks(editableHtml));
    setToolbarPos({ x: 0, y: 0 });
    setIsInlineEditing(true);
  };

  const handleCancelInlineEdit = () => {
    setIsInlineEditing(false);
    setEditingTemplateId(null);
    setDocBlocks([]);
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
    const fullHtml = docBlocks.join("");
    if (!tempName.trim() || !fullHtml.replace(/<[^>]*>/g, "").trim()) return;

    setIsSubmitting(true);
    try {
      const cleanContent = convertEditableHtmlToTemplate(fullHtml);
      const payload = {
        template_name: tempName.trim(),
        category: tempCategory.trim() || "General",
        content: cleanContent,
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
      setDocBlocks([]);
      await fetchTemplates();
      if (savedId) setSelectedTemplateId(savedId);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save document template");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Insert variable at current cursor position (signals the focused page)
  const insertVariable = (varValue: string) => {
    const rawKey = varValue.replace(/[{}]/g, "").trim();
    const sampleVal = SAMPLE_PREVIEW_VARS[rawKey] || `[${rawKey}]`;
    const pillHtml = `<span class="var-pill-sample" data-var="${rawKey}" title="Variable: ${varValue}">${sampleVal}</span>&nbsp;`;
    setInsertSignal({ html: pillHtml, ts: Date.now() });
  };

  // ── Page content change handler ────────────────────────────────────────
  // When a page's content changes, update that page's blocks and redistribute
  const handlePageContentChange = useCallback((pIdx: number, updatedPageHtml: string) => {
    setDocBlocks((prevBlocks) => {
      // Re-distribute all blocks to know page boundaries
      const pages = distributeBlocksToPages(prevBlocks);
      // Replace the current page's blocks with updated HTML blocks
      const pageStartBlocks: number[] = [];
      let blockIdx = 0;
      for (let i = 0; i < pages.length; i++) {
        pageStartBlocks[i] = blockIdx;
        const pageBlocks = parseHtmlToBlocks(pages[i] ?? "");
        blockIdx += pageBlocks.length || 1;
      }

      const updatedBlocks = parseHtmlToBlocks(updatedPageHtml);
      const newAllBlocks = [...prevBlocks];

      // Find block range for this page
      const startIdx = pageStartBlocks[pIdx] ?? 0;
      const nextPageStart = pageStartBlocks[pIdx + 1];
      const endIdx = nextPageStart !== undefined ? nextPageStart : prevBlocks.length;
      newAllBlocks.splice(startIdx, endIdx - startIdx, ...updatedBlocks);
      return newAllBlocks;
    });
  }, []);

  // Backspace at start: move first block of current page to end of previous page
  const handleBackspaceAtStart = useCallback((pIdx: number) => {
    if (pIdx <= 0) return;
    setDocBlocks((prevBlocks) => {
      const pages = distributeBlocksToPages(prevBlocks);
      const pageBlockCounts: number[] = pages.map((p) => parseHtmlToBlocks(p).length || 1);
      let startIdx = 0;
      for (let i = 0; i < pIdx; i++) startIdx += (pageBlockCounts[i] ?? 0);

      if (startIdx >= prevBlocks.length) return prevBlocks;
      const newBlocks = [...prevBlocks];
      // Simply merge: no-op since blocks already flow. Just focus previous page.
      return newBlocks;
    });
    // Focus previous page at end
    requestAnimationFrame(() => {
      const prevEl = document.getElementById(`editable-page-card-${pIdx - 1}`);
      if (prevEl) focusAtEnd(prevEl);
    });
  }, []);

  // Extract variables from current doc
  const extractedFields = useMemo(() => {
    const textToParse = isInlineEditing ? docBlocks.join("") : selectedTemplate?.content || "";
    if (!textToParse) return [];
    const matches = textToParse.match(/{{([a-zA-Z0-9_]+)}}/g);
    if (!matches) return [];
    return Array.from(new Set(matches.map((m) => m.replace(/[{}]/g, "").trim())));
  }, [selectedTemplate, isInlineEditing, docBlocks]);

  const renderLetterheadHeader = () => {
    if (!letterheadConfig.enabled) return null;
    if (letterheadConfig.headerImageUrl) {
      return (
        <div className="relative w-full overflow-hidden bg-white select-none shrink-0 mb-4 border-b border-slate-100">
          <img src={letterheadConfig.headerImageUrl} alt="Letterhead Header" className="w-full max-h-36 object-cover" />
        </div>
      );
    }
    return (
      <div className="relative w-full overflow-hidden bg-white select-none shrink-0 mb-5 border-b border-slate-200/60">
        <div className="flex items-center justify-between min-h-[80px] px-6 sm:px-8 py-2">
          <div className="flex items-center gap-4 z-10">
            {letterheadConfig.logoUrl ? (
              <img src={letterheadConfig.logoUrl} alt="Logo" className="h-10 sm:h-12 w-auto object-contain" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-[#0f2552] text-white flex items-center justify-center font-black text-lg shadow-md">
                {(letterheadConfig.companyName || "H").charAt(0)}
              </div>
            )}
            <div>
              <h2 className="text-lg sm:text-xl font-black text-[#0f2552] tracking-tight leading-tight">
                {letterheadConfig.companyName || "HariKrushn DigiVerse LLP"}
              </h2>
              <p className="text-xs font-bold text-emerald-600 flex items-center gap-1.5 mt-0.5">
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
        /* A4 Paper Editor & Preview Typography */
        .a4-quill-editor .ql-container.ql-snow {
          border: none !important;
          font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
          font-size: 10pt !important;
          line-height: 1.4 !important;
        }
        .a4-quill-editor .ql-editor,
        .document-preview-body {
          font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
          font-size: 10pt !important;
          line-height: 1.4 !important;
          color: #1e293b !important;
          padding: 0.75rem 1rem !important;
        }
        .a4-quill-editor .ql-editor p,
        .document-preview-body p {
          margin-top: 0.2rem !important;
          margin-bottom: 0.35rem !important;
          line-height: 1.4 !important;
          font-size: 10pt !important;
          color: #1e293b !important;
        }
        .a4-quill-editor .ql-editor p:empty,
        .document-preview-body p:empty {
          margin-bottom: 0.15rem !important;
          min-height: 1.4em !important;
        }
        .a4-quill-editor .ql-editor h1, .document-preview-body h1 {
          font-size: 1.3rem !important; font-weight: 800 !important;
          margin: 0.75rem 0 0.35rem !important; color: #0f172a !important; line-height: 1.3 !important;
        }
        .a4-quill-editor .ql-editor h2, .document-preview-body h2 {
          font-size: 1.1rem !important; font-weight: 800 !important;
          margin: 0.65rem 0 0.3rem !important; color: #0f172a !important; line-height: 1.35 !important;
        }
        .a4-quill-editor .ql-editor h3, .document-preview-body h3 {
          font-size: 0.95rem !important; font-weight: 700 !important;
          margin: 0.55rem 0 0.25rem !important; color: #0f172a !important; line-height: 1.4 !important;
        }
        .a4-quill-editor .ql-editor ul, .document-preview-body ul,
        .a4-quill-editor .ql-editor ol, .document-preview-body ol {
          margin: 0.2rem 0 0.35rem !important; padding-left: 1.25rem !important;
        }
        .a4-quill-editor .ql-editor li, .document-preview-body li {
          margin-bottom: 0.15rem !important; font-size: 10pt !important; line-height: 1.4 !important;
        }
        .a4-quill-editor .ql-editor a, .document-preview-body a {
          color: #0284c7 !important; text-decoration: underline !important;
        }
        .a4-quill-editor .ql-editor strong, .document-preview-body strong,
        .a4-quill-editor .ql-editor b, .document-preview-body b {
          font-weight: 700 !important; color: #0f172a !important;
        }
        .a4-quill-editor .ql-editor table, .document-preview-body table {
          width: 100% !important; border-collapse: collapse !important; margin: 0.5rem 0 !important; font-size: 9pt !important;
        }
        .a4-quill-editor .ql-editor td, .a4-quill-editor .ql-editor th,
        .document-preview-body td, .document-preview-body th {
          border: 1px solid #cbd5e1 !important; padding: 0.25rem 0.5rem !important; text-align: left !important;
        }
        .a4-quill-editor .ql-editor th, .document-preview-body th {
          background: #f1f5f9 !important; font-weight: 700 !important;
        }
        .a4-quill-editor .ql-editor.ql-blank::before {
          left: 0 !important; font-style: normal !important; color: #94a3b8 !important;
        }

        /* Variable Pills */
        .var-pill-sample {
          display: inline; background-color: rgba(209, 250, 229, 0.9); color: #065f46;
          font-weight: 600; padding: 0.1rem 0.35rem; border-radius: 0.25rem;
          border: 1px solid rgba(110, 231, 183, 0.6); font-size: 0.85em;
        }
        .dark .var-pill-sample { background-color: rgba(6,78,59,0.6); color: #6ee7b7; border-color: rgba(16,185,129,0.4); }
        .var-pill-missing {
          display: inline; background-color: rgba(254, 243, 199, 0.9); color: #92400e;
          font-weight: 600; padding: 0.1rem 0.35rem; border-radius: 0.25rem;
          border: 1px solid rgba(252, 211, 77, 0.6); font-size: 0.85em;
        }
        .dark .var-pill-missing { background-color: rgba(120,53,15,0.6); color: #fde68a; border-color: rgba(245,158,11,0.4); }
        .var-pill-raw {
          display: inline; background-color: rgba(224, 242, 254, 0.9); color: #075985;
          font-weight: 600; padding: 0.1rem 0.35rem; border-radius: 0.25rem;
          border: 1px solid rgba(186, 230, 253, 0.6); font-size: 0.85em;
        }
        .dark .var-pill-raw { background-color: rgba(12,74,110,0.6); color: #7dd3fc; border-color: rgba(56,189,248,0.4); }

        /* Floating Formatting Toolbar */
        #quill-custom-toolbar {
          box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1) !important;
          border-radius: 1rem !important;
        }
        #quill-custom-toolbar button, #quill-custom-toolbar .ql-picker { border-radius: 0.375rem !important; }
        #quill-custom-toolbar button:hover, #quill-custom-toolbar .ql-picker-label:hover {
          background-color: rgba(16, 185, 129, 0.1) !important; color: #059669 !important;
        }
        #quill-custom-toolbar button.ql-active {
          background-color: rgba(16, 185, 129, 0.2) !important; color: #047857 !important;
        }

        /* A4 Paper Page */
        .a4-page-card {
          width: 210mm;
          max-width: 210mm;
          min-height: 297mm;
          height: 297mm;
          max-height: 297mm;
          background: white;
          border-radius: 1rem;
          border: 1px solid #e2e8f0;
          box-shadow: 0 20px 60px -10px rgba(0,0,0,0.18), 0 4px 16px -4px rgba(0,0,0,0.08);
          display: flex;
          flex-direction: column;
          overflow: hidden !important;
          position: relative;
          flex-shrink: 0;
          page-break-after: always;
        }
        .a4-page-card:hover { box-shadow: 0 24px 70px -10px rgba(16,185,129,0.15), 0 4px 16px -4px rgba(0,0,0,0.08); }
        .a4-page-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden !important;
          min-height: 0;
        }
        .a4-editable-area {
          flex: 1;
          padding: 0.75rem 2rem 1.5rem 2rem;
          overflow: hidden !important;
          display: flex;
          flex-direction: column;
        }
        .a4-editable-area *, .document-preview-body * {
          scrollbar-width: none !important;
          -ms-overflow-style: none !important;
        }
        .a4-editable-area *::-webkit-scrollbar, .document-preview-body *::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }
        .a4-page-footer {
          padding: 0.5rem 2rem;
          background: #f8fafc;
          border-top: 1px solid #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 0.65rem;
          color: #94a3b8;
          font-family: monospace;
          flex-shrink: 0;
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

          {/* Search */}
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

        {/* Right Column */}
        <div className="flex-1 w-full min-w-0 bg-card border border-border/50 rounded-2xl p-4 sm:p-6 shadow-sm space-y-6">
          {isInlineEditing ? (
            /* ── INLINE EDITING MODE ── */
            <div className="space-y-5 animate-in fade-in duration-300">
              {/* Top Header */}
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between border-b border-border/50 pb-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleCancelInlineEdit}
                    className="p-2 border border-border rounded-xl hover:bg-muted/50 transition-colors text-muted-foreground"
                    title="Back to View Mode"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
                      <Edit2 className="w-5 h-5 text-emerald-600" />
                      {editingTemplateId ? `Editing: ${tempName || "Untitled"}` : "Create New Document Template"}
                    </h2>
                    <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                      Type directly on the A4 letterhead paper. Content auto-flows to next pages.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
                  <button
                    onClick={handleCancelInlineEdit}
                    className="px-4 py-2 border border-border text-foreground font-bold text-sm rounded-xl hover:bg-muted/50 transition-colors flex items-center gap-1.5 shadow-xs"
                  >
                    <X className="w-4 h-4" /> Cancel
                  </button>
                  <button
                    onClick={handleSaveTemplate}
                    disabled={!tempName.trim() || !docBlocks.join("").replace(/<[^>]*>/g, "").trim() || isSubmitting}
                    className="px-6 py-2 bg-emerald-600 text-white hover:bg-emerald-700 font-bold text-sm rounded-xl transition-colors disabled:opacity-50 shadow-md flex items-center gap-2"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {isSubmitting ? "Saving..." : editingTemplateId ? "Update Template" : "Save Template"}
                  </button>
                </div>
              </div>

              {/* Template Metadata */}
              <div className="grid gap-4 sm:grid-cols-2 bg-muted/20 border border-border/40 p-4 rounded-xl">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Template Name *
                  </label>
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    placeholder="e.g. Internship Agreement"
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

              {/* Variable Shortcuts */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Insert Variable at Cursor Position
                  </label>
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    Total Pages: {editorPages.length}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 p-3 bg-muted/30 border border-border/40 rounded-xl max-h-32 overflow-y-auto custom-scrollbar">
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

              {/* FLOATING FORMATTING TOOLBAR */}
              <div
                id="quill-custom-toolbar"
                onMouseDown={handleToolbarMouseDown}
                style={{ transform: `translate(${toolbarPos.x}px, ${toolbarPos.y}px)` }}
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 shadow-xl rounded-2xl p-2.5 z-30 cursor-grab active:cursor-grabbing flex flex-wrap items-center gap-1.5 transition-shadow select-none mb-2"
              >
                <div className="w-full flex items-center justify-between px-2 pb-1.5 mb-1 border-b border-slate-100 dark:border-slate-700/60 text-[11px] font-extrabold text-slate-500">
                  <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <GripHorizontal className="w-4 h-4 text-slate-400" /> Formatting Toolbar (Drag to reposition)
                  </span>
                  {(toolbarPos.x !== 0 || toolbarPos.y !== 0) && (
                    <button
                      type="button"
                      onClick={() => setToolbarPos({ x: 0, y: 0 })}
                      className="text-[10px] font-bold text-slate-500 hover:text-emerald-600 underline"
                    >
                      Reset Position
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <select
                    onChange={(e) => { if (typeof document !== "undefined") document.execCommand("formatBlock", false, e.target.value); }}
                    defaultValue="p"
                    className="min-w-[125px] h-8 px-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 hover:border-emerald-500/50 cursor-pointer"
                    title="Text Format"
                  >
                    <option value="p">Normal (10pt)</option>
                    <option value="h1">Heading 1</option>
                    <option value="h2">Heading 2</option>
                    <option value="h3">Heading 3</option>
                  </select>
                  <select
                    onChange={(e) => { if (typeof document !== "undefined") document.execCommand("fontSize", false, e.target.value); }}
                    defaultValue="3"
                    className="min-w-[105px] h-8 px-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 hover:border-emerald-500/50 cursor-pointer"
                    title="Font Size"
                  >
                    <option value="1">8 pt</option>
                    <option value="2">9 pt</option>
                    <option value="3">10 pt (Default)</option>
                    <option value="4">12 pt</option>
                    <option value="5">14 pt</option>
                    <option value="6">18 pt</option>
                    <option value="7">24 pt</option>
                  </select>
                  <div className="h-4 w-px bg-border/60 mx-1" />
                  {[
                    { icon: <Bold className="w-4 h-4" />, cmd: "bold", title: "Bold" },
                    { icon: <Italic className="w-4 h-4" />, cmd: "italic", title: "Italic" },
                    { icon: <Underline className="w-4 h-4" />, cmd: "underline", title: "Underline" },
                    { icon: <Strikethrough className="w-4 h-4" />, cmd: "strikeThrough", title: "Strikethrough" },
                    { icon: <Quote className="w-4 h-4" />, cmd: "formatBlock", val: "blockquote", title: "Quote" },
                  ].map(({ icon, cmd, val, title }) => (
                    <button
                      key={title}
                      type="button"
                      onClick={() => typeof document !== "undefined" && document.execCommand(cmd, false, val)}
                      className="p-1.5 hover:bg-emerald-500/15 text-slate-700 dark:text-slate-200 hover:text-emerald-600 rounded-lg transition-colors"
                      title={title}
                    >{icon}</button>
                  ))}
                  <div className="h-4 w-px bg-border/60 mx-1" />
                  {[
                    { icon: <List className="w-4 h-4" />, cmd: "insertUnorderedList", title: "Bullet List" },
                    { icon: <ListOrdered className="w-4 h-4" />, cmd: "insertOrderedList", title: "Numbered List" },
                  ].map(({ icon, cmd, title }) => (
                    <button
                      key={title}
                      type="button"
                      onClick={() => typeof document !== "undefined" && document.execCommand(cmd, false)}
                      className="p-1.5 hover:bg-emerald-500/15 text-slate-700 dark:text-slate-200 hover:text-emerald-600 rounded-lg transition-colors"
                      title={title}
                    >{icon}</button>
                  ))}
                  <div className="h-4 w-px bg-border/60 mx-1" />
                  {[
                    { icon: <AlignLeft className="w-4 h-4" />, cmd: "justifyLeft", title: "Align Left" },
                    { icon: <AlignCenter className="w-4 h-4" />, cmd: "justifyCenter", title: "Align Center" },
                    { icon: <AlignRight className="w-4 h-4" />, cmd: "justifyRight", title: "Align Right" },
                    { icon: <AlignJustify className="w-4 h-4" />, cmd: "justifyFull", title: "Justify" },
                  ].map(({ icon, cmd, title }) => (
                    <button
                      key={title}
                      type="button"
                      onClick={() => typeof document !== "undefined" && document.execCommand(cmd, false)}
                      className="p-1.5 hover:bg-emerald-500/15 text-slate-700 dark:text-slate-200 hover:text-emerald-600 rounded-lg transition-colors"
                      title={title}
                    >{icon}</button>
                  ))}
                </div>
              </div>

              {/* ── EDITOR CANVAS ── */}
              {editViewMode === "single" ? (
                /* SINGLE A4 LIVE PAPER EDITOR */
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-emerald-600" />
                      A4 Live Letterhead Paper Editor
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditViewMode("split")}
                      className="text-[11px] font-bold text-emerald-600 hover:underline flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" /> Switch to Split View
                    </button>
                  </div>

                  <div className="bg-slate-100 dark:bg-slate-900/60 border border-border/50 rounded-2xl p-4 sm:p-8 flex flex-col items-center gap-6">
                    {editorPages.map((pageHtml, pIdx) => (
                      <div key={`editor-page-${pIdx}`} className="a4-page-card">
                        <div className="a4-page-content">
                          {renderLetterheadHeader()}
                          <div className="a4-editable-area">
                            <EditablePageCard
                              pIdx={pIdx}
                              totalPages={editorPages.length}
                              pageHtml={pageHtml}
                              insertSignal={focusedPageIdx === pIdx ? insertSignal : null}
                              onContentChange={(updatedHtml) => handlePageContentChange(pIdx, updatedHtml)}
                              onBackspaceAtStart={() => handleBackspaceAtStart(pIdx)}
                              onArrowUpAtTop={() => {
                                const prevEl = document.getElementById(`editable-page-card-${pIdx - 1}`);
                                if (prevEl) focusAtEnd(prevEl);
                              }}
                              onArrowDownAtBottom={() => {
                                const nextEl = document.getElementById(`editable-page-card-${pIdx + 1}`);
                                if (nextEl) focusAtStart(nextEl);
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* SPLIT VIEW */
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                  {/* Left: Quill Editor */}
                  <div className="bg-slate-100 dark:bg-slate-900/60 border border-border/50 rounded-2xl p-3 sm:p-4 flex flex-col">
                    <div className="w-full mb-3 flex items-center justify-between px-1">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Edit2 className="w-3.5 h-3.5 text-emerald-600" /> Template Editor
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditViewMode("single")}
                        className="text-[10px] font-bold text-emerald-600 hover:underline"
                      >
                        Switch to Paper View
                      </button>
                    </div>
                    <div
                      ref={editorScrollRef}
                      onScroll={handleEditorScroll}
                      className="w-full bg-white text-slate-900 shadow-md rounded-2xl border border-slate-200 overflow-hidden a4-quill-editor"
                    >
                      {renderLetterheadHeader()}
                      <div className="px-6 sm:px-10 pt-2 pb-10">
                        {isMounted ? (
                          <Suspense fallback={<div className="h-80 flex items-center justify-center text-sm text-muted-foreground">Loading Editor...</div>}>
                            <ReactQuillComponent
                              theme="snow"
                              value={quillContent}
                              onChange={(val: string) => setDocBlocks(parseHtmlToBlocks(val))}
                              modules={QUILL_MODULES}
                              placeholder="Write your document template content here..."
                            />
                          </Suspense>
                        ) : (
                          <textarea
                            value={quillContent}
                            onChange={(e) => setDocBlocks(parseHtmlToBlocks(e.target.value))}
                            placeholder="Write your document template content here..."
                            className="w-full h-[450px] p-4 bg-transparent border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm font-medium resize-none"
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Live Preview */}
                  <div className="bg-slate-100 dark:bg-slate-900/60 border border-border/50 rounded-2xl p-3 sm:p-4 flex flex-col">
                    <div className="w-full mb-3 flex items-center justify-between px-1">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5 text-emerald-600" /> Live Preview (Real-Time)
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowSampleDataInPreview(!showSampleDataInPreview)}
                        className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                      >
                        <Sparkles className="w-3 h-3" />
                        {showSampleDataInPreview ? "Showing Sample Data" : "Showing {{Variables}}"}
                      </button>
                    </div>
                    <div
                      ref={previewScrollRef}
                      onScroll={handlePreviewScroll}
                      className="w-full flex flex-col items-center gap-6"
                    >
                      {getPreviewPages(quillContent, showSampleDataInPreview).map((pageHtml, pIdx) => (
                        <div key={pIdx} className="a4-page-card">
                          <div className="a4-page-content">
                            {renderLetterheadHeader()}
                            <div className="a4-editable-area">
                              <div
                                className="document-preview-body text-slate-800 font-normal text-[10pt] leading-[1.4] break-words flex-1"
                                dangerouslySetInnerHTML={{ __html: pageHtml }}
                              />
                            </div>
                        </div>
                      </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : selectedTemplate ? (
            /* ── VIEW MODE ── */
            <>
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between border-b border-border/50 pb-4">
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
                    Template: {selectedTemplate.name}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5 font-medium">Click "Edit Content" to edit this template.</p>
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
                    <span className="text-xs text-muted-foreground italic">No {"{{variable}}"} fields found.</span>
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

              {/* Document Canvas */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">A4 Document (210 × 297 mm)</h4>
                  <button
                    type="button"
                    onClick={() => setShowSampleDataInPreview(!showSampleDataInPreview)}
                    className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {showSampleDataInPreview ? "Sample Data Filled" : "Raw {{Variable}} Tags"}
                  </button>
                </div>

                <div className="bg-slate-100 dark:bg-slate-900/60 border border-border/50 rounded-2xl p-4 sm:p-8 flex flex-col items-center gap-6">
                  {getPreviewPages(selectedTemplate.content, showSampleDataInPreview).map((pageHtml, pageIndex) => (
                    <div
                      key={pageIndex}
                      onClick={() => handleStartEditInline(selectedTemplate)}
                      className="a4-page-card hover:ring-2 hover:ring-emerald-500/50 cursor-pointer transition-all"
                      title="Click to edit"
                    >
                      <div className="a4-page-content">
                        {renderLetterheadHeader()}
                        <div className="a4-editable-area">
                          <div
                            className="document-preview-body text-slate-800 font-normal text-[10pt] leading-[1.4] break-words flex-1"
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
