import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Download, Send, Printer, User, FileText, Sparkles, Settings2, Loader2 } from "lucide-react";
import { SearchableSelect } from "@/components/ui/select";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";

interface EmployeeItem {
  id: string;
  name: string;
  role: string;
  department: string;
  joiningDate: string;
  salary?: string;
  email?: string;
  empCode?: string;
  phone?: string;
  address?: string;
  workLocation?: string;
}

interface TemplateItem {
  id: string;
  name: string;
  category: string;
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

// ─── A4 PAGINATION CONSTANTS & HELPERS ─────────────────────────────────────
const A4_PAGE1_CONTENT_PX = 870;
const A4_PAGE_N_CONTENT_PX = 1010;
const LINE_HEIGHT_PX = 19.2;

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

export function DocumentGenerator({ onBack, activeTabPath }: { onBack?: () => void; activeTabPath?: string }) {
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedEmpId, setSelectedEmpId] = useState("manual");
  const [selectedTempId, setSelectedTempId] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const [customVars, setCustomVars] = useState<Record<string, string>>({});
  const [userCustomKeys, setUserCustomKeys] = useState<string[]>([]);
  const [newCustomKey, setNewCustomKey] = useState("");
  const [newCustomValue, setNewCustomValue] = useState("");
  const [showAddCustomField, setShowAddCustomField] = useState(false);

  // Letterhead State
  const [letterhead, setLetterhead] = useState<LetterheadConfig>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("document_letterhead_config");
      if (stored) {
        try { return JSON.parse(stored); } catch (e) { }
      }
    }
    return DEFAULT_LETTERHEAD;
  });

  useEffect(() => {
    const handleSync = () => {
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem("document_letterhead_config");
        if (stored) {
          try {
            setLetterhead(JSON.parse(stored));
          } catch (e) { }
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

  // Fetch templates and employees from backend API
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [tempRes, empRes] = await Promise.all([
          api.get("/document-templates", { showLoader: false, showErrorToast: false }).catch(() => []),
          api.get("/employees?limit=1000", { showLoader: false, showErrorToast: false }).catch(() => [])
        ]);

        // Process templates
        const rawTemplates = Array.isArray(tempRes) ? tempRes : tempRes?.items || tempRes?.data || [];
        const mappedTemplates: TemplateItem[] = rawTemplates.map((t: any) => ({
          id: String(t._id || t.id),
          name: t.template_name || t.name || "Untitled Template",
          category: t.category || "General",
          content: t.content || "",
        }));
        setTemplates(mappedTemplates);

        // Process employees
        const rawEmps = Array.isArray(empRes) ? empRes : empRes?.items || empRes?.data || [];
        const mappedEmps: EmployeeItem[] = rawEmps.map((e: any) => {
          const p = e.personal_info || {};
          const w = e.work_details || {};
          const c = e.compensation || {};
          const empCode = e.employee_id || e.emp_code || w.employee_id || "";
          const fullName = [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(" ")
            || [e.first_name, e.last_name].filter(Boolean).join(" ")
            || e.name
            || p.email_address
            || e.email
            || "Unnamed Employee";

          const roleName = w.designation || e.designation || w.system_role || e.role || "Employee";

          return {
            id: String(e._id || e.id || e.employee_id),
            empCode: empCode,
            name: fullName,
            role: roleName,
            department: w.department || e.department || "General",
            joiningDate: w.joining_date || e.joining_date || new Date().toISOString().split("T")[0],
            salary: c.ctc || c.monthly_salary || e.salary || "",
            email: p.email_address || e.email || "",
            phone: p.phone_number || e.phone || "",
            address: p.current_address || p.permanent_address || e.address || "",
            workLocation: w.work_location || e.work_location || "Head Office",
          };
        });
        setEmployees(mappedEmps);

        // Auto select first template if available
        if (mappedTemplates.length > 0 && !selectedTempId && mappedTemplates[0]) {
          setSelectedTempId(mappedTemplates[0].id);
        }
      } catch (err: any) {
        console.error("Failed to load Document Generator data:", err);
        toast.error("Failed to load templates or employee list");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Auto select template & employee from URL parameters (e.g. when coming from Letter Requests)
  useEffect(() => {
    let searchStr = "";
    if (activeTabPath && activeTabPath.includes("?")) {
      searchStr = activeTabPath.slice(activeTabPath.indexOf("?"));
    } else if (typeof window !== "undefined" && window.location.search) {
      searchStr = window.location.search;
    }

    if (!searchStr) return;

    const searchParams = new URLSearchParams(searchStr);
    const paramEmpId = searchParams.get("empId");
    const paramTempId = searchParams.get("tempId");
    const paramLetterType = searchParams.get("letterType");

    if (paramEmpId && employees.length > 0) {
      const qEmp = paramEmpId.toLowerCase().trim();
      const matchedEmp = employees.find((e) => {
        const eId = (e.id || "").toLowerCase().trim();
        const eCode = (e.empCode || "").toLowerCase().trim();
        const eName = (e.name || "").toLowerCase().trim();
        return eId === qEmp || eCode === qEmp || (qEmp.length > 2 && eName.includes(qEmp));
      });
      if (matchedEmp) {
        setSelectedEmpId(matchedEmp.id);
      }
    }

    if (paramTempId && templates.some((t) => t.id === paramTempId)) {
      setSelectedTempId(paramTempId);
    } else if (paramLetterType && templates.length > 0) {
      const q = paramLetterType.toLowerCase().trim();
      const matchedTemp = templates.find((t) => {
        const tName = (t.name || "").toLowerCase().trim();
        return tName === q || tName.includes(q) || q.includes(tName);
      });
      if (matchedTemp) {
        setSelectedTempId(matchedTemp.id);
      }
    }
  }, [employees, templates, activeTabPath]);

  const selectedEmp = useMemo(() => employees.find((e) => e.id === selectedEmpId), [employees, selectedEmpId]);
  const selectedTemp = useMemo(() => templates.find((t) => t.id === selectedTempId), [templates, selectedTempId]);

  // Helper to fetch or resolve variable value (with smart normalization)
  const getVarValue = (varKey: string) => {
    if (customVars[varKey] !== undefined) return customVars[varKey];

    if (selectedEmpId !== "manual" && selectedEmp) {
      const norm = varKey.toLowerCase().replace(/[\s_-]+/g, "");
      if (["employeename", "candidatename", "name", "empname", "emp_name", "employee", "candidate", "fullname", "full_name"].includes(norm)) return selectedEmp.name;
      if (["employeecode", "empcode", "code", "employeeid", "empid"].includes(norm)) return selectedEmp.empCode || selectedEmp.id;
      if (["designation", "role", "position"].includes(norm)) return selectedEmp.role;
      if (["department", "dept"].includes(norm)) return selectedEmp.department;
      if (["joiningdate", "dateofjoining", "doj"].includes(norm)) return selectedEmp.joiningDate;
      if (["salary", "monthlysalary", "ctc"].includes(norm)) return selectedEmp.salary;
      if (["email", "emailaddress"].includes(norm)) return selectedEmp.email || "";
      if (["phone", "phonenumber", "mobile"].includes(norm)) return selectedEmp.phone || "";
      if (["address", "currentaddress", "permanentaddress"].includes(norm)) return selectedEmp.address || "";
      if (["worklocation", "location", "office"].includes(norm)) return selectedEmp.workLocation || "Head Office";
      if (["signature", "employeesignature", "emp_signature", "signatorysignature", "signatory_signature"].includes(norm)) {
        const sig = (selectedEmp as any).signature || (selectedEmp as any).signature_url || (typeof window !== "undefined" ? localStorage.getItem(`user_signature_${selectedEmp.id}`) : "") || "";
        if (sig) {
          return `<img src="${sig}" alt="Signature" style="max-height: 48px; width: auto; object-fit: contain; display: inline-block; vertical-align: middle; margin-top: 4px;" />`;
        }
      }
    }

    const normKey = varKey.toLowerCase().replace(/[\s_-]+/g, "");
    if (["companyname", "company"].includes(normKey)) return letterhead.companyName || "HariKrushn DigiVerse LLP";
    if (["date", "today", "issuedate", "letterdate"].includes(normKey)) return new Date().toISOString().split("T")[0];

    return "";
  };

  // Populate customVars automatically when employee or template is selected
  useEffect(() => {
    if (!selectedTemp?.content) return;
    const matches = selectedTemp.content.match(/{{([a-zA-Z0-9_]+)}}/g);
    if (!matches) return;
    const extracted = Array.from(new Set(matches.map((m) => m.replace(/[{}]/g, "").trim())));

    const nextVars: Record<string, string> = {};
    const today = new Date().toISOString().split("T")[0];

    extracted.forEach((key) => {
      const norm = key.toLowerCase().replace(/[\s_-]+/g, "");
      if (selectedEmpId !== "manual" && selectedEmp) {
        if (["employeename", "candidatename", "name", "empname", "emp_name", "employee", "candidate", "fullname", "full_name"].includes(norm)) {
          nextVars[key] = selectedEmp.name;
        } else if (["employeecode", "empcode", "code", "employeeid", "empid"].includes(norm)) {
          nextVars[key] = selectedEmp.empCode || selectedEmp.id;
        } else if (["designation", "role", "position"].includes(norm)) {
          nextVars[key] = selectedEmp.role;
        } else if (["department", "dept"].includes(norm)) {
          nextVars[key] = selectedEmp.department;
        } else if (["joiningdate", "dateofjoining", "doj"].includes(norm)) {
          nextVars[key] = selectedEmp.joiningDate;
        } else if (["salary", "monthlysalary", "ctc"].includes(norm)) {
          nextVars[key] = selectedEmp.salary || "";
        } else if (["email", "emailaddress"].includes(norm)) {
          nextVars[key] = selectedEmp.email || "";
        } else if (["phone", "phonenumber", "mobile"].includes(norm)) {
          nextVars[key] = selectedEmp.phone || "";
        } else if (["address", "currentaddress", "permanentaddress"].includes(norm)) {
          nextVars[key] = selectedEmp.address || "";
        } else if (["worklocation", "location", "office"].includes(norm)) {
          nextVars[key] = selectedEmp.workLocation || "Head Office";
        }
      }

      if (["companyname", "company"].includes(norm)) {
        nextVars[key] = letterhead.companyName || "HariKrushn DigiVerse LLP";
      }
      if (["date", "today", "issuedate", "letterdate"].includes(norm)) {
        nextVars[key] = today || "";
      }
    });

    setCustomVars((prev) => {
      const isSame = Object.keys(nextVars).every((k) => prev[k] === nextVars[k]);
      if (isSame && Object.keys(prev).length === Object.keys(nextVars).length) {
        return prev;
      }
      return { ...nextVars, ...prev };
    });
  }, [selectedEmpId, selectedEmp, selectedTempId, letterhead.companyName]);

  // Extract variables dynamically ONLY from selected template content
  const templatePlaceholders = useMemo(() => {
    if (!selectedTemp?.content) return userCustomKeys;
    const matches = selectedTemp.content.match(/{{([a-zA-Z0-9_]+)}}/g);
    const extracted = matches
      ? Array.from(new Set(matches.map((m) => m.replace(/[{}]/g, "").trim())))
      : [];

    return Array.from(new Set([...extracted, ...userCustomKeys]));
  }, [selectedTemp, userCustomKeys]);

  const isDateField = (key: string): boolean => {
    const norm = key.toLowerCase().replace(/[\s_-]+/g, "");
    return norm.includes("date") || norm === "doj" || norm === "today" || norm === "effectivefrom" || norm === "validtill";
  };

  const formatDateDDMMYYYY = (val: string): string => {
    if (!val) return "";
    const trimmed = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [y, m, d] = trimmed.split("-");
      return `${d}-${m}-${y}`;
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      const [y, m, d] = trimmed.slice(0, 10).split("-");
      return `${d}-${m}-${y}`;
    }
    return trimmed;
  };

  const formatValueForDateInput = (val: string): string => {
    if (!val) return "";
    const trimmed = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) {
      const [d, m, y] = trimmed.split("-");
      return `${y}-${m}-${d}`;
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return trimmed.slice(0, 10);
    }
    return "";
  };

  const previewContent = useMemo(() => {
    if (!selectedTemp?.content) return "";
    let content = selectedTemp.content;

    // Replace placeholders cleanly without extra badges so line wrapping matches template exactly
    content = content.replace(/{{([^}]+)}}/g, (match, rawKey) => {
      const key = rawKey.trim();
      const val = getVarValue(key);
      if (val !== undefined && val !== "") {
        if (isDateField(key)) {
          return formatDateDDMMYYYY(val);
        }
        return val;
      }

      return `[${key}]`;
    });

    // Format page breaks cleanly for preview
    content = content.replace(
      /(<hr\s*class="[^"]*page-break[^"]*"[^>]*>|<div\s*class="[^"]*page-break[^"]*"[^>]*><\/div>|<!--\s*pagebreak\s*-->|{{page_break}})/gi,
      `<div class="page-break my-8 py-4 border-t-2 border-dashed border-slate-300 relative flex items-center justify-center text-center select-none"><span class="bg-slate-100 text-slate-500 font-mono text-[10px] uppercase font-bold px-3 py-1 rounded-full border border-slate-300 shadow-xs flex items-center gap-1.5"><svg class="w-3 h-3 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> A4 Page Break (Next Page)</span></div>`
    );

    return content;
  }, [selectedTemp, customVars, selectedEmpId, selectedEmp]);

  const handleVarChange = (key: string, val: string) => {
    setCustomVars((prev) => ({ ...prev, [key]: val }));
  };

  const handleAddCustomField = () => {
    if (!newCustomKey.trim()) return;
    const cleanKey = newCustomKey.trim().replace(/\s+/g, "_");
    setUserCustomKeys((prev) => Array.from(new Set([...prev, cleanKey])));
    setCustomVars((prev) => ({ ...prev, [cleanKey]: newCustomValue.trim() }));
    setNewCustomKey("");
    setNewCustomValue("");
    setShowAddCustomField(false);
    toast.success(`Field "{{${cleanKey}}}" added!`);
  };

  const pageSections = useMemo(() => {
    if (!previewContent) return [""];

    // 1. Check for explicit page break markers first
    if (/(?:<hr\s*class="[^"]*page-break[^"]*"[^>]*>|<div\s*class="[^"]*page-break[^"]*"[^>]*><\/div>|<!--\s*pagebreak\s*-->|{{page_break}}|<p[^>]*style="[^"]*page-break-before:\s*always[^"]*"[^>]*>)/gi.test(previewContent)) {
      const explicitPages = previewContent
        .split(/(?:<hr\s*class="[^"]*page-break[^"]*"[^>]*>|<div\s*class="[^"]*page-break[^"]*"[^>]*><\/div>|<!--\s*pagebreak\s*-->|{{page_break}}|<p[^>]*style="[^"]*page-break-before:\s*always[^"]*"[^>]*>)/gi)
        .map((p) => p.trim())
        .filter(Boolean);
      if (explicitPages.length > 1) {
        return explicitPages;
      }
    }

    // 2. Auto-paginate based on pixel height estimation matching DocumentTemplates
    const blocks = parseHtmlToBlocks(previewContent);
    return distributeBlocksToPages(blocks);
  }, [previewContent]);

  const handlePrint = () => {
    if (!selectedTemp) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    let letterheadHTML = "";
    if (letterhead.enabled) {
      if (letterhead.headerImageUrl) {
        letterheadHTML = `
          <div style="width: 100%; text-align: center; margin-bottom: 24px; padding-bottom: 8px;">
            <img src="${letterhead.headerImageUrl}" style="width: 100%; max-height: 140px; object-fit: contain;" />
          </div>
        `;
      } else {
        letterheadHTML = `
          <div style="position: relative; width: 100%; margin-bottom: 24px; padding-bottom: 12px; display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 14px;">
              ${letterhead.logoUrl
            ? `<img src="${letterhead.logoUrl}" style="height: 50px; width: auto;" />`
            : `<div style="width: 48px; height: 48px; border-radius: 12px; background: #0f2552; color: white; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 20px;">${letterhead.companyName ? letterhead.companyName.charAt(0) : "HK"}</div>`
          }
              <div>
                <div style="font-size: 22px; font-weight: 900; color: #0f2552; line-height: 1.1;">${letterhead.companyName || "HariKrushn DigiVerse LLP"}</div>
                <div style="font-size: 13px; font-weight: 700; color: #16a34a; margin-top: 3px;"><span style="color: #0f2552;">|</span> ${letterhead.tagline || "Innovate • Transform • Grow"}</div>
              </div>
            </div>
          </div>
        `;
      }
    }

    const printablePagesHTML = pageSections.map((sectionHtml, idx) => {
      const cleanSection = sectionHtml
        .replace(/class="bg-primary\/15[^"]*"/g, 'style="font-weight: bold; color: #0284c7;"')
        .replace(/class="bg-rose-500\/15[^"]*"/g, 'style="font-weight: bold; color: #e11d48;"');

      return `
        <div class="print-page" style="${idx > 0 ? 'page-break-before: always; break-before: page; margin-top: 20px;' : ''}">
          ${letterheadHTML}
          <div class="print-content">
            ${cleanSection}
          </div>
        </div>
      `;
    }).join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${selectedTemp.name} - ${customVars["employee_name"] || "Document"}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 15mm 15mm 20mm 15mm;
            }
            body {
              font-family: 'Segoe UI', Arial, sans-serif;
              margin: 0;
              padding: 0;
              color: #0f172a;
              line-height: 1.4;
              font-size: 10pt;
              background: #ffffff;
            }
            p {
              margin-top: 0.2rem !important;
              margin-bottom: 0.35rem !important;
              line-height: 1.4 !important;
              font-size: 10pt !important;
            }
            h1, h2, h3, h4, h5, h6 {
              color: #0f172a;
              margin-top: 0.85rem !important;
              margin-bottom: 0.45rem !important;
              page-break-after: avoid;
              break-after: avoid;
            }
            ul, ol {
              margin-top: 0.4rem !important;
              margin-bottom: 0.6rem !important;
              padding-left: 1.5rem !important;
            }
            p, ul, ol, table, blockquote {
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .content {
              width: 100%;
              max-width: 100%;
              margin: 0 auto;
            }
            .print-page {
              width: 100%;
              box-sizing: border-box;
            }
            .page-break {
              page-break-before: always !important;
              break-before: page !important;
              clear: both;
              height: 0;
              margin: 0;
              padding: 0;
              border: none;
            }
            .page-break span {
              display: none !important;
            }
            @media print {
              body { margin: 0; }
              .print-page {
                page-break-after: always;
                break-after: page;
              }
              .print-page:last-child {
                page-break-after: auto;
                break-after: auto;
              }
            }
          </style>
        </head>
        <body>
          <div class="content">
            ${printablePagesHTML}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const handleExportPDF = async () => {
    if (!selectedTemp || isExporting) return;
    setIsExporting(true);

    const docName = selectedTemp.name.replace(/[^a-zA-Z0-9_-]/g, "_");
    const empNameStr = selectedEmp ? selectedEmp.name.replace(/[^a-zA-Z0-9_-]/g, "_") : "Document";
    const fileName = `${docName}_${empNameStr}.pdf`;

    let letterheadHTML = "";
    if (letterhead.enabled) {
      if (letterhead.headerImageUrl) {
        letterheadHTML = `
          <div style="position: relative; width: 100%; overflow: hidden; background: #ffffff; box-sizing: border-box; margin-bottom: 14px;">
            <img src="${letterhead.headerImageUrl}" style="width: 100%; max-height: 140px; object-fit: cover;" />
          </div>
        `;
      } else {
        letterheadHTML = `
          <div style="position: relative; width: 100%; overflow: hidden; background: #ffffff; border-bottom: 2px solid #0f2552; box-sizing: border-box; margin-bottom: 14px;">
            <div style="display: flex; align-items: center; justify-content: space-between; min-height: 80px; padding: 8px 24px;">
              <div style="display: flex; align-items: center; gap: 14px; z-index: 10;">
                ${letterhead.logoUrl
                  ? `<img src="${letterhead.logoUrl}" style="height: 48px; width: auto; object-fit: contain;" />`
                  : `<div style="width: 44px; height: 44px; border-radius: 10px; background: #0f2552; color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 18px;">${letterhead.companyName ? letterhead.companyName.charAt(0) : "HK"}</div>`
                }
                <div>
                  <div style="font-size: 20px; font-weight: 900; color: #0f2552; line-height: 1.1;">${letterhead.companyName || "HariKrushn DigiVerse LLP"}</div>
                  <div style="font-size: 12px; font-weight: 700; color: #16a34a; margin-top: 3px;"><span style="color: #0f2552;">|</span> ${letterhead.tagline || "Innovate • Transform • Grow"}</div>
                </div>
              </div>
              <div style="position: absolute; right: 0; top: 0; height: 100%; width: 45%; pointer-events: none; overflow: hidden;">
                <svg viewBox="0 0 350 100" preserveAspectRatio="none" style="height: 100%; width: 100%;">
                  <path d="M 100,0 C 180,30 250,70 350,100 L 350,0 Z" fill="#0f2552" />
                  <path d="M 210,100 C 260,75 300,40 350,0 L 350,100 Z" fill="#6bb82d" />
                </svg>
              </div>
            </div>
          </div>
        `;
      }
    }

    const pagesContent = pageSections.map((sec, idx) => {
      const cleanSec = sec
        .replace(/class="bg-primary\/15[^"]*"/g, 'style="font-weight: bold; color: #0284c7;"')
        .replace(/class="bg-rose-500\/15[^"]*"/g, 'style="font-weight: bold; color: #e11d48;"');

      return `
        <div class="pdf-page ${idx > 0 ? 'pdf-page-break' : ''}">
          <div>
            ${letterheadHTML}
            <div style="padding: 10px 32px 16px 32px; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 10pt; line-height: 1.4; color: #1e293b; word-wrap: break-word;">
              ${cleanSec}
            </div>
          </div>
        </div>
      `;
    }).join("");

    const originalBodyStyle = document.body.style.cssText;
    const originalHtmlStyle = document.documentElement.style.cssText;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    let container: HTMLDivElement | null = null;

    try {
      container = document.createElement("div");
      container.id = "pdf-export-container";
      container.style.cssText = `
        width: 210mm;
        background: #ffffff;
        color: #0f172a;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 10pt;
        line-height: 1.4;
        margin: 0 auto;
      `;
      container.innerHTML = pagesContent;
      document.body.appendChild(container);

      // Preload all images in container before html2canvas capture
      const images = Array.from(container.querySelectorAll("img"));
      if (images.length > 0) {
        await Promise.all(
          images.map(
            (img) =>
              new Promise((resolve) => {
                if (img.complete && img.naturalHeight !== 0) {
                  resolve(true);
                } else {
                  img.onload = () => resolve(true);
                  img.onerror = () => resolve(true);
                  setTimeout(() => resolve(true), 1500);
                }
              })
          )
        );
      }

      const html2pdfModule: any = await import("html2pdf.js");
      const html2pdf = html2pdfModule.default || html2pdfModule;

      const opt = {
        margin: 0,
        filename: fileName,
        image: { type: "jpeg" as const, quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          allowTaint: true,
          scrollX: 0,
          scrollY: 0,
          onclone: (clonedDoc: Document) => {
            // Strip style and stylesheet links to eliminate Tailwind v4 oklch rules
            clonedDoc.querySelectorAll("style, link").forEach((el) => el.remove());
            clonedDoc.documentElement.removeAttribute("style");
            clonedDoc.body.removeAttribute("style");

            // Inject clean standalone base styles for PDF document elements
            const baseStyle = clonedDoc.createElement("style");
            baseStyle.textContent = `
              * { box-sizing: border-box !important; }
              html, body { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important; color: #1e293b !important; background: #ffffff !important; margin: 0 !important; padding: 0 !important; }
              .pdf-page { width: 210mm !important; min-height: 295mm !important; background: #ffffff !important; box-sizing: border-box !important; display: flex !important; flex-direction: column !important; justify-content: space-between !important; position: relative !important; overflow: hidden !important; }
              .pdf-page-break { page-break-before: always !important; break-before: page !important; }
              p { margin-top: 3px !important; margin-bottom: 6px !important; line-height: 1.4 !important; font-size: 10pt !important; color: #1e293b !important; }
              p:empty { margin-bottom: 3px !important; min-height: 1.4em !important; }
              h1 { font-size: 1.3rem !important; font-weight: 800 !important; margin: 12px 0 6px !important; color: #0f172a !important; line-height: 1.3 !important; }
              h2 { font-size: 1.1rem !important; font-weight: 800 !important; margin: 10px 0 5px !important; color: #0f172a !important; line-height: 1.35 !important; }
              h3 { font-size: 0.95rem !important; font-weight: 700 !important; margin: 8px 0 4px !important; color: #0f172a !important; line-height: 1.4 !important; }
              ul, ol { margin: 4px 0 6px !important; padding-left: 20px !important; }
              li { margin-bottom: 3px !important; font-size: 10pt !important; line-height: 1.4 !important; }
              table { width: 100% !important; border-collapse: collapse !important; margin: 8px 0 !important; font-size: 9pt !important; }
              td, th { padding: 4px 8px !important; border: 1px solid #cbd5e1 !important; text-align: left !important; }
              th { background: #f1f5f9 !important; font-weight: 700 !important; }
              img { max-width: 100% !important; height: auto !important; }
            `;
            clonedDoc.head.appendChild(baseStyle);
          },
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" as const },
        pagebreak: { mode: ["css", "legacy"], before: ".pdf-page-break" },
      };

      await html2pdf().set(opt).from(container).save();
      toast.success(`PDF "${fileName}" downloaded successfully!`);
    } catch (err: any) {
      console.error("PDF export error:", err);
      toast.error(`PDF export error: ${err?.message || "Failed to generate PDF download"}`);
    } finally {
      if (container && container.parentNode) {
        container.parentNode.removeChild(container);
      }
      document.querySelectorAll(".html2pdf__container").forEach((el) => el.remove());
      document.body.style.cssText = originalBodyStyle;
      document.documentElement.style.cssText = originalHtmlStyle;
      window.scrollTo(scrollX, scrollY);
      setIsExporting(false);
    }
  };

  const handleSendForSignature = async () => {
    if (!selectedTemp) {
      toast.error("Please select a document template first");
      return;
    }

    if (selectedEmpId === "manual" || !selectedEmp) {
      toast.error("Please select a target Employee before sending for signature");
      return;
    }

    setIsSending(true);
    try {
      let genDocId = null;
      let pdfUrl = null;

      try {
        const genRes = await api.post(
          "/generated-documents/generate",
          {
            template_id: selectedTemp.id,
            employee_id: selectedEmp.id,
            variables: customVars,
          },
          { showLoader: false, showErrorToast: false }
        );

        if (genRes && (genRes.id || genRes._id)) {
          genDocId = String(genRes.id || genRes._id);
          pdfUrl = genRes.pdf_url || `/generated-documents/${genDocId}/pdf`;
        }
      } catch (e) {
        console.warn("Generating doc record before signature failed:", e);
      }

      await api.post("/letter-requests", {
        employee_id: selectedEmp.id,
        template_id: selectedTemp.id,
        letter_type: selectedTemp.name,
        reason: `Official ${selectedTemp.name} sent for signature`,
        needed_by_date: new Date().toISOString().split("T")[0],
        status: "Sent",
        generated_document_id: genDocId,
        pdf_url: pdfUrl,
        content: previewContent,
      });

      toast.success(`Document "${selectedTemp.name}" sent for signature to ${selectedEmp.name}!`);
    } catch (err: any) {
      console.error("Failed to send document for signature:", err);
      toast.error(err?.message || "Failed to send document for signature");
    } finally {
      setIsSending(false);
    }
  };

  const renderLetterheadHeader = () => {
    if (!letterhead.enabled) return null;
    if (letterhead.headerImageUrl) {
      return (
        <div className="relative w-full overflow-hidden bg-white select-none shrink-0 mb-6">
          <img src={letterhead.headerImageUrl} alt="Letterhead Header" className="w-full max-h-36 object-cover" />
        </div>
      );
    }
    return (
      <div className="relative w-full overflow-hidden bg-white select-none shrink-0 mb-8">
        <div className="flex items-center justify-between min-h-[90px] px-6 sm:px-8 py-3">
          <div className="flex items-center gap-4 z-10">
            {letterhead.logoUrl ? (
              <img src={letterhead.logoUrl} alt="Logo" className="h-12 sm:h-14 w-auto object-contain" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-[#0f2552] text-white flex items-center justify-center font-black text-xl shadow-md">
                {(letterhead.companyName || "H").charAt(0)}
              </div>
            )}
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-[#0f2552] tracking-tight leading-tight">
                {letterhead.companyName || "HariKrushn DigiVerse LLP"}
              </h2>
              <p className="text-xs sm:text-sm font-bold text-emerald-600 flex items-center gap-1.5 mt-0.5">
                <span className="text-[#0f2552]">|</span> {letterhead.tagline || "Innovate • Transform • Grow"}
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

  const employeeOptions = useMemo(() => {
    return [
      { label: "👤 Manual Entry / New Candidate", value: "manual" },
      ...employees.map((emp) => ({
        label: `${emp.name} (${emp.empCode || emp.role || "EMP"})`,
        value: emp.id,
      })),
    ];
  }, [employees]);

  return (
    <div className="flex flex-col h-full min-h-[85vh] animate-in fade-in duration-500">
      <style>{`
        .document-preview-body {
          font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
          font-size: 10pt !important;
          line-height: 1.4 !important;
          color: #1e293b !important;
          padding: 0.75rem 1rem !important;
        }
        .document-preview-body p {
          margin-top: 0.2rem !important;
          margin-bottom: 0.35rem !important;
          line-height: 1.4 !important;
          font-size: 10pt !important;
          color: #1e293b !important;
        }
        .document-preview-body p:empty {
          margin-bottom: 0.15rem !important;
          min-height: 1.4em !important;
        }
        .document-preview-body h1 {
          font-size: 1.3rem !important; font-weight: 800 !important;
          margin: 0.75rem 0 0.35rem !important; color: #0f172a !important; line-height: 1.3 !important;
        }
        .document-preview-body h2 {
          font-size: 1.1rem !important; font-weight: 800 !important;
          margin: 0.65rem 0 0.3rem !important; color: #0f172a !important; line-height: 1.35 !important;
        }
        .document-preview-body h3 {
          font-size: 0.95rem !important; font-weight: 700 !important;
          margin: 0.55rem 0 0.25rem !important; color: #0f172a !important; line-height: 1.4 !important;
        }
        .document-preview-body ul, .document-preview-body ol {
          margin: 0.2rem 0 0.35rem !important; padding-left: 1.25rem !important;
        }
        .document-preview-body li {
          margin-bottom: 0.15rem !important; font-size: 10pt !important; line-height: 1.4 !important;
        }
        .document-preview-body a {
          color: #0284c7 !important; text-decoration: underline !important;
        }
        .document-preview-body strong, .document-preview-body b {
          font-weight: 700 !important; color: #0f172a !important;
        }
        .document-preview-body table {
          width: 100% !important; border-collapse: collapse !important; margin: 0.5rem 0 !important; font-size: 9pt !important;
        }
        .document-preview-body td, .document-preview-body th {
          border: 1px solid #cbd5e1 !important; padding: 0.25rem 0.5rem !important; text-align: left !important;
        }
        .document-preview-body th {
          background: #f1f5f9 !important; font-weight: 700 !important;
        }

        .var-pill-sample {
          display: inline; background-color: rgba(209, 250, 229, 0.9); color: #065f46;
          font-weight: 600; padding: 0.1rem 0.35rem; border-radius: 0.25rem;
          border: 1px solid rgba(110, 231, 183, 0.6); font-size: 0.85em;
        }
        .dark .var-pill-sample { background-color: rgba(6,78,59,0.6); color: #6ee7b7; border-color: rgba(16,185,129,0.4); }

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
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between pb-6 mb-6 border-b border-border/50">
        <div className="flex items-center gap-4">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2.5 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 inline-flex items-center justify-center bg-card border border-border/50 rounded-xl hover:bg-muted/50 transition-colors shadow-sm shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-primary" />
              Document Generator
            </h1>
            <p className="text-muted-foreground text-sm font-medium">Create and preview dynamic document templates</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={handlePrint}
            disabled={!selectedTemp}
            className="px-4 py-2.5 min-h-[44px] sm:min-h-0 flex-1 sm:flex-none justify-center bg-card border border-border/50 text-foreground font-bold rounded-xl hover:bg-muted/50 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
          <button
            onClick={handleExportPDF}
            disabled={!selectedTemp || isExporting}
            className="px-4 py-2.5 min-h-[44px] sm:min-h-0 flex-1 sm:flex-none justify-center bg-card border border-border/50 text-foreground font-bold rounded-xl hover:bg-muted/50 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {isExporting ? "Exporting..." : "Export PDF"}
          </button>
          <button
            onClick={handleSendForSignature}
            disabled={!selectedTemp || isSending}
            className="px-5 py-2.5 min-h-[44px] sm:min-h-0 flex-1 sm:flex-none justify-center bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
          >
            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {isSending ? "Sending..." : "Send for Signature"}
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex flex-col lg:flex-row gap-8 h-full flex-grow">
        {/* Left Panel: Configuration */}
        <div className="w-full lg:w-[420px] flex flex-col gap-6 shrink-0">
          {/* Target Selection */}
          <div className="bg-card border border-border/50 p-5 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold flex items-center gap-2 text-foreground">
                <User className="w-4 h-4 text-primary" />
                Target Employee / Candidate
              </h3>
              {selectedEmpId === "manual" ? (
                <span className="text-[10px] uppercase tracking-wider font-bold bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  Manual Entry
                </span>
              ) : (
                <span className="text-[10px] uppercase tracking-wider font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                  Auto Filled
                </span>
              )}
            </div>
            {isLoading ? (
              <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                Loading employees...
              </div>
            ) : (
              <SearchableSelect
                value={selectedEmpId}
                onChange={(val) => setSelectedEmpId(val)}
                options={employeeOptions}
                placeholder="Select Employee or Manual Entry..."
                className="w-full h-[40px] px-4 bg-background border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
              />
            )}

            <h3 className="font-bold flex items-center gap-2 text-foreground pt-2">
              <FileText className="w-4 h-4 text-primary" />
              Document Template
            </h3>
            {isLoading ? (
              <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                Loading templates...
              </div>
            ) : (
              <SearchableSelect
                value={selectedTempId}
                onChange={(val) => setSelectedTempId(val)}
                options={templates.map((tmp) => ({ label: `${tmp.name} (${tmp.category})`, value: tmp.id }))}
                placeholder="Select Template..."
                className="w-full h-[40px] px-4 bg-background border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
              />
            )}
          </div>

          {/* Dynamic Variables Form */}
          {selectedTemp && (
            <div className="bg-card border border-border/50 p-5 rounded-2xl shadow-sm flex-grow space-y-4">
              <div className="flex items-center justify-between border-b border-border/50 pb-3">
                <div>
                  <h3 className="font-bold flex items-center gap-2 text-foreground">
                    <Settings2 className="w-4 h-4 text-primary" />
                    Template Fields & Data
                  </h3>
                  <p className="text-[11px] text-muted-foreground">Values auto-fill from employee or enter manually.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddCustomField(!showAddCustomField)}
                  className="px-2.5 py-1 text-xs font-bold bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition-colors flex items-center gap-1"
                >
                  + Add Field
                </button>
              </div>

              {/* Add Custom Field Form */}
              {showAddCustomField && (
                <div className="p-3 bg-muted/40 border border-border/50 rounded-xl space-y-2 animate-in fade-in duration-200">
                  <div className="text-xs font-bold text-foreground">Add Custom Variable</div>
                  <input
                    type="text"
                    placeholder="Field Name e.g. probation_period"
                    value={newCustomKey}
                    onChange={(e) => setNewCustomKey(e.target.value)}
                    className="w-full px-3 py-1.5 bg-background border border-border/50 rounded-lg text-xs outline-none font-medium"
                  />
                  <input
                    type="text"
                    placeholder="Field Value e.g. 6 Months"
                    value={newCustomValue}
                    onChange={(e) => setNewCustomValue(e.target.value)}
                    className="w-full px-3 py-1.5 bg-background border border-border/50 rounded-lg text-xs outline-none font-medium"
                  />
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddCustomField(false)}
                      className="px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted rounded-md"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAddCustomField}
                      className="px-3 py-1 text-xs font-bold bg-primary text-primary-foreground rounded-md shadow-xs"
                    >
                      Add Variable
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-3.5 overflow-y-auto max-h-[480px] pr-2 custom-scrollbar">
                {templatePlaceholders.map((varKey) => {
                  const currentVal = getVarValue(varKey);
                  const isAutoFilled = selectedEmpId !== "manual" && Boolean(selectedEmp) && Boolean(currentVal);
                  const isDateType = isDateField(varKey);

                  const fieldLabel = varKey
                    .replace(/([A-Z])/g, " $1")
                    .replace(/_/g, " ")
                    .replace(/^./, (str) => str.toUpperCase());

                  return (
                    <div key={varKey} className="space-y-1">
                      <label className="text-xs font-bold text-muted-foreground tracking-wider flex items-center justify-between">
                        <span className="capitalize">{fieldLabel}</span>
                        {isAutoFilled ? (
                          <span className="text-[10px] lowercase font-medium bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            auto-filled
                          </span>
                        ) : (
                          <span className="text-[10px] lowercase font-medium bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                            {isDateType ? "date picker (dd-mm-yyyy)" : "editable"}
                          </span>
                        )}
                      </label>
                      <input
                        type={isDateType ? "date" : "text"}
                        value={isDateType ? formatValueForDateInput(currentVal || "") : (currentVal || "")}
                        onChange={(e) => handleVarChange(varKey, e.target.value)}
                        placeholder={`Enter ${fieldLabel}...`}
                        className="w-full px-3.5 py-2 bg-background border border-border/50 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none font-medium transition-all cursor-pointer"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Panel: Live Preview (A4 Paper Sheet View) */}
        <div className="flex-grow bg-slate-100 dark:bg-slate-900/60 border border-border/50 rounded-3xl p-3 sm:p-6 flex flex-col min-h-[500px] sm:min-h-[700px] min-w-0">
          <div className="flex justify-between items-center mb-3 px-2">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-muted-foreground uppercase tracking-wider text-xs">Live Preview (A4 Page Sheet)</h3>
              <span className="text-[10px] font-mono font-bold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded border border-slate-300/50">
                A4 • ~{pageSections.length} {pageSections.length === 1 ? "Page" : "Pages"}
              </span>
            </div>
            <span className="flex items-center gap-2 text-xs font-bold text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-md">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Real-time A4 View
            </span>
          </div>

          {!selectedTemp ? (
            <div className="flex-grow flex flex-col items-center justify-center text-center p-8 bg-card border border-dashed border-border/50 rounded-2xl">
              <FileText className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <h4 className="text-lg font-bold text-foreground mb-1">No Template Selected</h4>
              <p className="text-sm text-muted-foreground max-w-sm">
                Select an employee or Manual Entry and a document template to view the live preview.
              </p>
            </div>
          ) : (
            <div className="flex-grow p-2 sm:p-4 flex flex-col items-center space-y-6">
              {pageSections.map((pageHtml, pageIndex) => (
                <div key={pageIndex} className="a4-page-card">
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
          )}
        </div>
      </div>
    </div>
  );
}

