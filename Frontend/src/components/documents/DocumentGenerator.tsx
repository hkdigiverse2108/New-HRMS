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
        try { return JSON.parse(stored); } catch (e) {}
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
        if (mappedTemplates.length > 0 && !selectedTempId) {
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
          nextVars[key] = selectedEmp.salary;
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
        nextVars[key] = today;
      }
    });

    setCustomVars(nextVars);
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
    
    const cleanContent = previewContent.replace(
      /(?:<hr\s*class="[^"]*page-break[^"]*"[^>]*>|<div\s*class="[^"]*page-break[^"]*"[^>]*><\/div>|<!--\s*pagebreak\s*-->|{{page_break}}|<p[^>]*style="[^"]*page-break-before:\s*always[^"]*"[^>]*>)/gi,
      ""
    );

    const blockRegex = /(<p[^>]*>.*?<\/p>|<ul[^>]*>.*?<\/ul>|<ol[^>]*>.*?<\/ol>|<h[1-6][^>]*>.*?<\/h[1-6]>|<table[^>]*>.*?<\/table>|<blockquote[^>]*>.*?<\/blockquote>|<div[^>]*>.*?<\/div>)/gis;
    const blocks = cleanContent.match(blockRegex);

    if (!blocks || blocks.length <= 5) {
      return [cleanContent];
    }

    const pages: string[] = [];
    let currentPageHtml = "";
    let currentLength = 0;
    const MAX_PAGE_CHARS = 2000;

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
          <title>${selectedTemp.name} - ${customVars.employee_name || "Document"}</title>
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
              line-height: 1.6;
              font-size: 14px;
              background: #ffffff;
            }
            p {
              margin-top: 0.35rem !important;
              margin-bottom: 0.6rem !important;
              line-height: 1.65 !important;
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
    if (!selectedTemp) return;
    setIsExporting(true);

    const docName = selectedTemp.name.replace(/[^a-zA-Z0-9_-]/g, "_");
    const empNameStr = selectedEmp ? selectedEmp.name.replace(/[^a-zA-Z0-9_-]/g, "_") : "Document";
    const fileName = `${docName}_${empNameStr}.pdf`;

    // 1. Try Backend ReportLab PDF Download
    try {
      const genRes = await api.post(
        "/generated-documents/generate",
        {
          template_id: selectedTemp.id,
          employee_id: selectedEmpId || "manual",
          variables: customVars,
        },
        { showLoader: false, showErrorToast: false }
      );

      if (genRes && (genRes.id || genRes._id)) {
        const docId = String(genRes.id || genRes._id);
        const pdfBlob = await api.getBlob(`/generated-documents/${docId}/pdf`);
        const blobUrl = window.URL.createObjectURL(pdfBlob);
        const downloadLink = document.createElement("a");
        downloadLink.href = blobUrl;
        downloadLink.download = fileName;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        downloadLink.remove();
        window.URL.revokeObjectURL(blobUrl);
        toast.success(`PDF "${fileName}" downloaded successfully!`);
        setIsExporting(false);
        return;
      }
    } catch (beErr) {
      console.warn("Backend PDF download fallback to client iframe pdf generator:", beErr);
    }

    // 2. Client-side html2pdf via isolated iframe (prevents Tailwind v4 oklch color parsing errors completely)
    let iframe: HTMLIFrameElement | null = null;
    try {
      iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.left = "-9999px";
      iframe.style.top = "-9999px";
      iframe.style.width = "210mm";
      iframe.style.height = "297mm";
      iframe.style.border = "none";
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) throw new Error("Could not access iframe document");

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
            <div style="position: relative; width: 100%; margin-bottom: 24px; padding-bottom: 12px; display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #0f2552;">
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

      const pagesContent = pageSections.map((sec, idx) => {
        const cleanSec = sec
          .replace(/class="bg-primary\/15[^"]*"/g, 'style="font-weight: bold; color: #0284c7;"')
          .replace(/class="bg-rose-500\/15[^"]*"/g, 'style="font-weight: bold; color: #e11d48;"');

        return `
          <div style="${idx > 0 ? 'page-break-before: always; break-before: page;' : ''} padding: 12mm 15mm 15mm 15mm;">
            ${letterheadHTML}
            <div style="color: #0f172a; line-height: 1.65; word-wrap: break-word;">
              ${cleanSec}
            </div>
          </div>
        `;
      }).join("");

      iframeDoc.open();
      iframeDoc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body {
                margin: 0;
                padding: 0;
                background: #ffffff;
                color: #0f172a;
                font-family: 'Segoe UI', Arial, sans-serif;
                font-size: 14px;
                line-height: 1.65;
              }
              p { margin-top: 6px; margin-bottom: 10px; line-height: 1.65; }
              h1, h2, h3, h4 { color: #0f172a; margin-top: 14px; margin-bottom: 8px; font-weight: 800; }
              ul, ol { margin-top: 6px; margin-bottom: 10px; padding-left: 20px; }
            </style>
          </head>
          <body>
            <div id="pdf-root" style="width: 210mm; background: #ffffff; color: #0f172a;">
              ${pagesContent}
            </div>
          </body>
        </html>
      `);
      iframeDoc.close();

      const pdfRoot = iframeDoc.getElementById("pdf-root");
      if (!pdfRoot) throw new Error("PDF root element missing inside iframe");

      const html2pdfModule = (await import("html2pdf.js")).default || (await import("html2pdf.js"));

      const opt = {
        margin: 0,
        filename: fileName,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] }
      };

      await html2pdfModule().set(opt).from(pdfRoot).save();
      toast.success(`PDF "${fileName}" downloaded successfully!`);
    } catch (err: any) {
      console.error("Direct PDF export error:", err);
      toast.error("Failed to download PDF directly.");
    } finally {
      if (iframe && iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
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
        .prose p {
          margin-top: 0.35rem !important;
          margin-bottom: 0.6rem !important;
          line-height: 1.65 !important;
        }
        .prose h1, .prose h2, .prose h3, .prose h4 {
          margin-top: 0.85rem !important;
          margin-bottom: 0.45rem !important;
          font-weight: 800 !important;
          color: #0f172a !important;
        }
        .prose ul, .prose ol {
          margin-top: 0.4rem !important;
          margin-bottom: 0.6rem !important;
          padding-left: 1.5rem !important;
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
                        value={isDateType ? formatValueForDateInput(currentVal) : currentVal}
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
        <div className="flex-grow bg-slate-100 dark:bg-slate-900/60 border border-border/50 rounded-3xl p-3 sm:p-6 flex flex-col h-full min-h-[500px] sm:min-h-[700px] min-w-0 overflow-hidden">
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
            <div className="flex-grow overflow-y-auto custom-scrollbar p-2 sm:p-4 flex flex-col items-center space-y-6">
              {pageSections.map((pageHtml, pageIndex) => (
                <div key={pageIndex} className="w-full flex flex-col items-center">
                  {/* Individual A4 Paper Sheet Card */}
                  <div className="w-full max-w-[210mm] min-h-[297mm] bg-white text-slate-900 shadow-md rounded-2xl border border-slate-200 overflow-hidden relative transition-all flex flex-col justify-between">
                    <div>
                      {/* Top Letterhead Header on EVERY page */}
                      {renderLetterheadHeader()}

                      {/* Page Content */}
                      <div
                        className="prose prose-sm max-w-none text-slate-800 font-normal leading-relaxed break-words px-8 sm:px-14 pt-2 pb-14"
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

