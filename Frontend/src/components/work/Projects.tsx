import { useState, useEffect, useMemo, useCallback } from "react";
import { X, Search, Plus, Filter, Check, MoreHorizontal, LayoutGrid, List, Briefcase, Calendar, Clock, Star, Circle, Trash2, Edit2, Archive, ArchiveRestore, ArrowLeft, Users, IndianRupee, FolderGit2, CheckCircle2, Settings2, TrendingUp, MousePointerClick, Target, BarChart3, ChevronDown, User, Building2, CreditCard, FileText, ChevronRight, Video, Instagram, Layers, MessageSquare, Key, Copy, Eye, EyeOff, ExternalLink, Phone, ShieldCheck, Sparkles, Share2, AlertCircle, Sliders, Loader2, UserPlus, UserX } from "lucide-react";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DialogClose, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { format, subDays, startOfYear, differenceInDays } from "date-fns";
import { DateRange } from "react-day-picker";
import { moveToRecycleBin } from "@/lib/recycle-bin";
import { SearchableSelect, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { api } from "@/lib/api";
import { DatePicker } from "@/components/ui/date-picker";
import { useEmployeesContext } from "@/components/employees/EmployeeContext";
import { useAuth } from "@/components/auth/AuthContext";

type ProjectStatus = "In Progress" | "In Review" | "Completed" | "On Hold";
type ClientStatus = "Active" | "Archived";
type ClientTab = 'general' | 'company' | 'service' | 'remarks';

interface Client {
  id: string;
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  address?: string;
  state?: string;
  gstin?: string;
  department?: string;
  salesFocused?: string;
  remarks?: string;
  dailyFollowup?: string;
  assignedEmployeeId?: string;
  logo: string;
  totalBudget: string;
  outstandingPayment: string;
  onboardingDate: string;
  activeProjects: number;
  status: ClientStatus;
  contacts: { name: string; avatar: string }[];
}

export interface CreativeTeamRoles {
  scripting?: string;
  shoot_videography?: string;
  reel_editing?: string;
  post_graphics?: string;
  thumbnail?: string;
  approval_qc?: string;
  caption?: string;
  posting_publisher?: string;
}

interface Project {
  id: string;
  clientId: string;
  name: string;
  description?: string | undefined;
  category: string;
  status: ProjectStatus;
  priority?: "Low" | "Medium" | "High" | "Critical" | undefined;
  progress: number;
  startDate: string;
  endDate: string;
  // Renewal periods — latest = effective dates
  dateRanges?: { start_date: string; end_date: string; label?: string }[] | undefined;
  teamDeadline?: string | undefined;
  budget: string;
  services?: string | undefined;
  post?: number | undefined;
  reel?: number | undefined;
  festivalPost?: string | undefined;
  amountReceived?: string | undefined;
  nextPaymentDate?: string | undefined;
  // K10: payment followup entries (date, amount, work period, next reminder)
  payments?: {
    id: string;
    date: string;
    amount: number;
    work_from?: string | undefined;
    work_to?: string | undefined;
    next_reminder?: string | undefined;
    note?: string | undefined;
  }[] | undefined;
  reach?: string | undefined;
  leads?: string | undefined;
  cpl?: string | undefined;
  campaigns?: any[] | undefined;
  contentCalendar?: CalendarItem[] | undefined;
  team: { name: string; avatar: string }[];
  whatsapp_group_link?: string | undefined;
  // K14: next followup date (backend auto-calculates)
  nextFollowupDate?: string | undefined;
  creativeTeam?: CreativeTeamRoles | undefined;
  creativeTeamDetails?: Record<string, any> | undefined;
  credentials?: { id?: string; platform: string; username: string; password: string; notes?: string }[] | undefined;
  dailyStats?: {
    id: string;
    date: string;
    campaignName: string;
    reach: number;
    impressions: number;
    leads: number;
    followers: number;
    revenue: number;
    spend: number;
  }[] | undefined;
  activityLogs?: {
    id: string;
    action: string;
    performedBy: string;
    timestamp: string;
    details?: string | undefined;
  }[] | undefined;
  modules?: {
    id: string;
    name: string;
    assignedToName?: string | undefined;
    status?: "todo" | "in-progress" | "bugs" | "onhold" | "pending" | "completed" | undefined;
    priority?: "low" | "medium" | "high" | "urgent" | undefined;
    estimatedHours?: number | undefined;
    dueDate?: string | undefined;
    tasks: {
      id: string;
      title: string;
      status: "todo" | "in-progress" | "bugs" | "onhold" | "pending" | "completed";
      dueDate?: string | undefined;
      assignedToName?: string | undefined;
      assignedToAvatar?: string | undefined;
      reasonForPending?: string | undefined;
      phase?: string | undefined;
    }[];
  }[] | undefined;
}

interface CalendarItem {
  id: string;
  postingDate: string;
  scheduledDate?: string | undefined;
  postingDay?: string | undefined;
  type: string;
  topic: string;
  concept?: string | undefined;
  reference?: string | undefined;
  assignedTo?: string[] | undefined;
  brand_person?: string | undefined;
  brand_person_details?: { employee_name?: string } | undefined;
  scriptDate?: string | undefined;
  scriptLink?: string | undefined;
  shootDate?: string | undefined;
  shootLink?: string | undefined;
  editingStart?: string | undefined;
  finalReelLink?: string | undefined;
  finalPostLink?: string | undefined;
  approval?: string | undefined;
  approved_by?: string | undefined;
  approved_by_details?: { employee_name?: string } | undefined;
  status: string;
  thumbnailDate?: string | undefined;
  thumbnailLink?: string | undefined;
  captionDate?: string | undefined;
  caption?: string | undefined;
  postingLinkOfIg?: string | undefined;
  actualPostingDate?: string | undefined;
  remark?: string | undefined;
  issues?: {
    id: string;
    text: string;
    timestamp: string;
    role?: string | undefined;
    author?: string | undefined;
    isClientIssue?: boolean | undefined;
  }[] | undefined;
}

export const mapBackendContentToCalendarItem = (item: any): CalendarItem => {
  const isReel = item.content_type === "Reel";
  const brandName = item.brand_person_details?.employee_name || item.brand_person;
  const approverName = item.approved_by_details?.employee_name || item.approved_by;

  return {
    id: String(item._id || item.id),
    postingDate: item.schedule_date ? (String(item.schedule_date).split("T")[0] || "") : "",
    postingDay: item.schedule_date ? new Date(item.schedule_date).toLocaleDateString("en-US", { weekday: "long" }) : "",
    type: item.content_type || "Post",
    topic: item.topic_title || "",
    concept: item.topic_description || "",
    reference: item.reference_link || "",
    brand_person: item.brand_person || "",
    brand_person_details: item.brand_person_details,
    assignedTo: brandName ? [brandName] : [],
    scriptDate: item.script?.date ? String(item.script.date).split("T")[0] : "",
    scriptLink: item.script?.link || "",
    shootDate: item.shoot?.date ? String(item.shoot.date).split("T")[0] : "",
    shootLink: item.shoot?.link || "",
    editingStart: item.editing?.date ? String(item.editing.date).split("T")[0] : "",
    finalReelLink: isReel ? (item.editing?.link || "") : "",
    finalPostLink: !isReel ? (item.editing?.link || "") : "",
    approval: approverName || "",
    approved_by: item.approved_by || "",
    approved_by_details: item.approved_by_details,
    status: item.approval_status || "In Progress",
    thumbnailDate: item.thumbnail?.date ? String(item.thumbnail.date).split("T")[0] : "",
    thumbnailLink: item.thumbnail?.link || "",
    captionDate: item.caption_date ? String(item.caption_date).split("T")[0] : "",
    caption: item.caption_text || "",
    postingLinkOfIg: item.instagram_link || "",
    actualPostingDate: item.actual_posting_date ? String(item.actual_posting_date).split("T")[0] : "",
    remark: item.remark || "",
    issues: (item.issues || []).map((iss: any, idx: number) =>
      typeof iss === 'string'
        ? { id: `iss-${idx}`, text: iss, timestamp: "", role: "Shoot", author: "Team", isClientIssue: true }
        : {
            id: iss.id || `iss-${idx}`,
            text: iss.text || "",
            timestamp: iss.timestamp || "",
            role: iss.role || "Shoot",
            author: iss.author || "Team",
            isClientIssue: iss.isClientIssue !== false
          }
    ),
  };
};

export const mapCalendarItemToBackendPayload = (form: any, projectId: string) => {
  const isReel = form.type === "Reel";
  const editingLink = isReel
    ? (form.finalReelLink || form.finalPostLink || null)
    : (form.finalPostLink || form.finalReelLink || null);

  let approvalStatus = form.status || "In Progress";
  if (approvalStatus === "To Do") approvalStatus = "In Progress";
  if (approvalStatus === "Pending Approval") approvalStatus = "In Review";

  return {
    project_id: projectId,
    schedule_date: form.postingDate,
    content_type: form.type === "Carousel" ? "Post" : (form.type || "Post"),
    topic_title: form.topic || "Untitled Idea",
    topic_description: form.concept || null,
    reference_link: form.reference || null,
    brand_person: form.brand_person || (Array.isArray(form.assignedTo) && form.assignedTo[0] ? form.assignedTo[0] : null),
    script: {
      date: form.scriptDate || null,
      link: form.scriptLink || null,
    },
    shoot: {
      date: form.shootDate || null,
      link: form.shootLink || null,
    },
    editing: {
      date: form.editingStart || null,
      link: editingLink || null,
    },
    thumbnail: {
      date: form.thumbnailDate || null,
      link: form.thumbnailLink || null,
    },
    caption_date: form.captionDate || null,
    caption_text: form.caption || null,
    approval_status: approvalStatus,
    approved_by: form.approved_by || null,
    actual_posting_date: form.actualPostingDate || null,
    instagram_link: form.postingLinkOfIg || null,
    issues: Array.isArray(form.issues)
      ? form.issues.map((i: any) => typeof i === 'string' ? i : i.text).filter(Boolean)
      : [],
  };
};

export const FIXED_DEPARTMENTS = [
  "Development",
  "Creative",
  "Digital Marketing",
  "Sales",
] as const;

export const CREATIVE_ROLES = [
  { key: "scripting", label: "Scripting", icon: "📝", desc: "Topic & Script Creation" },
  { key: "shoot_videography", label: "Shoot / Videography", icon: "🎬", desc: "Shoot & Footage Assets" },
  { key: "reel_editing", label: "Reel / Video Editing", icon: "🎥", desc: "Video Cutting & Final Reel" },
  { key: "post_graphics", label: "Post / Graphic Design", icon: "🎨", desc: "Banners & Carousel Graphics" },
  { key: "thumbnail", label: "Thumbnail Artist", icon: "🖼️", desc: "Cover & Thumbnail Design" },
  { key: "approval_qc", label: "Approval & QC", icon: "✅", desc: "Het / Client Content Approval" },
  { key: "caption", label: "Caption & Copy", icon: "✍️", desc: "Copywriting & Hashtags" },
  { key: "posting_publisher", label: "Posting / Publisher", icon: "📢", desc: "Social Media Live Posting" },
] as const;

export type FixedDepartment = typeof FIXED_DEPARTMENTS[number];

export const parseDepartments = (deptString?: string): string[] => {
  if (!deptString) return [];
  return deptString.split(",").map(d => d.trim()).filter(Boolean);
};

// K8: date-driven progress — elapsed/total days + % from start to end (transcript L111-116).
// Dates na hoy to null (stored progress fallback).
export const getDateProgress = (
  startDate?: string | null,
  endDate?: string | null,
  now: Date = new Date()
): { elapsed: number; total: number; pct: number } | null => {
  if (!startDate || !endDate) return null;
  const s = new Date(startDate);
  const e = new Date(endDate);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return null;
  const total = Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1);
  const elapsed = Math.min(total, Math.max(0, Math.round((now.getTime() - s.getTime()) / 86400000) + 1));
  return { elapsed, total, pct: Math.round((elapsed / total) * 100) };
};

// K16: months list from project date-range + default month (running cycle).
// today range ma hoy to current month, pela hoy to start month, pachi hoy to end month.
export const getProjectMonths = (  startDate?: string | null,
  endDate?: string | null,
  now: Date = new Date()
): { months: { value: string; label: string }[]; def: string } => {
  const s = startDate ? new Date(startDate) : null;
  const e = endDate ? new Date(endDate) : null;
  if (!s || !e || isNaN(s.getTime()) || isNaN(e.getTime())) return { months: [], def: "Current" };
  const months: { value: string; label: string }[] = [];
  const cur = new Date(s.getFullYear(), s.getMonth(), 1);
  const last = new Date(e.getFullYear(), e.getMonth(), 1);
  let guard = 0;
  while (cur <= last && guard < 37) {
    const v = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`;
    months.push({
      value: v,
      label: cur.toLocaleString("en-US", { month: "short", year: "numeric" }),
    });
    cur.setMonth(cur.getMonth() + 1);
    guard++;
  }
  const clamped = now < s ? s : now > e ? e : now;
  const def = `${clamped.getFullYear()}-${String(clamped.getMonth() + 1).padStart(2, "0")}`;
  return { months, def };
};

// K18: month-overlap rule — filter range (e.g. 1-30) ma approval month (e.g. 15) ave to match thay.
// Exact-month ne badle overlap check, etle Sept-approved + new-month-pending banne dekhay.
export const isMonthOverlapping = (
  month: number,
  year: number,
  from?: string | Date | null,
  to?: string | Date | null
): boolean => {
  if (!from && !to) return true;
  const mStart = new Date(year, month - 1, 1);
  const mEnd = new Date(year, month, 0);
  const f = from ? new Date(from) : null;
  const t = to ? new Date(to) : null;
  if ((f && isNaN(f.getTime())) || (t && isNaN(t.getTime()))) return true;
  const fDay = f ? new Date(f.getFullYear(), f.getMonth(), f.getDate()) : null;
  const tDay = t ? new Date(t.getFullYear(), t.getMonth(), t.getDate()) : null;
  if (fDay && mEnd < fDay) return false;
  if (tDay && mStart > tDay) return false;
  return true;
};

export const isSocialMediaCategory = (cat?: string) => {
  if (!cat) return false;
  const c = cat.toLowerCase().replace(/[\s_\-\/]/g, "");
  return (
    c === "creative" ||
    c === "digitalmarketing" ||
    c === "marketing" ||
    c === "socialmedia" ||
    c === "socialmediamanagement" ||
    c === "smm" ||
    c.includes("social") ||
    c.includes("creative") ||
    c.includes("marketing")
  );
};

export const isDevCategory = (cat?: string) => {
  if (!cat) return false;
  const c = cat.toLowerCase().replace(/[\s_\-\/]/g, "");
  return c === "development" || c === "appdev" || c === "webdev" || c === "webdevelopment" || c === "mobileapp" || c.includes("dev");
};

export const isMarketingCategory = (cat?: string) => {
  if (!cat) return false;
  const c = cat.toLowerCase().replace(/[\s_\-\/]/g, "");
  return c === "digitalmarketing" || c === "marketing" || c.includes("marketing");
};

export const isCreativeCategory = (cat?: string) => {
  if (!cat) return false;
  const c = cat.toLowerCase().replace(/[\s_\-\/]/g, "");
  return c === "creative" || c.includes("creative") || c === "design" || c === "uiux";
};

const UserAvatar = ({ 
  name, 
  avatar, 
  size = "w-7 h-7",
  className = ""
}: { 
  name?: string | null | undefined; 
  avatar?: string | null | undefined; 
  size?: string | undefined;
  className?: string | undefined;
}) => {
  const [imgError, setImgError] = useState(false);
  const initials = (name || "U")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(p => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "U";

  const colors = [
    "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
    "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30",
    "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
    "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
    "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30",
  ];
  const charCode = (name || "U").charCodeAt(0) + (name || "U").length;
  const colorClass = colors[charCode % colors.length];

  const hasValidSrc = Boolean(avatar && typeof avatar === "string" && avatar.trim() !== "" && !imgError);

  return (
    <div className={cn("relative rounded-full overflow-hidden shrink-0 flex items-center justify-center font-bold text-[10px] border select-none", size, colorClass, className)}>
      {hasValidSrc ? (
        <img
          src={avatar || undefined}
          alt={name || "User Avatar"}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <span className="leading-none">{initials}</span>
      )}
    </div>
  );
};

// Renewals manager — + thi navi date, last = default (array). Edit modal (be branch) ma vapray.
const RenewalsManager = ({
  ranges,
  onChange,
}: {
  ranges: { start_date: string; end_date: string; label?: string }[];
  onChange: (ranges: { start_date: string; end_date: string; label?: string }[]) => void;
}) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Renewal Periods {ranges.length > 0 && <span className="text-primary">({ranges.length})</span>}
        </label>
        <button
          type="button"
          onClick={() => onChange([...ranges, { start_date: "", end_date: "", label: "" }])}
          className="px-3 py-1.5 bg-primary/10 text-primary font-bold text-xs rounded-xl hover:bg-primary/20 transition-colors"
        >
          + Add Period
        </button>
      </div>
      {ranges.map((r, idx) => (
        <div key={idx} className="flex items-center gap-2 p-2.5 rounded-2xl border border-border/50 bg-muted/20">
          <span className="text-[10px] font-black text-muted-foreground w-6 shrink-0">#{idx + 1}</span>
          <DatePicker
            value={r.start_date}
            onChange={(val) => onChange(ranges.map((x, i) => (i === idx ? { ...x, start_date: val } : x)))}
            placeholder="Start"
            className="flex-1 h-10 bg-background border-border rounded-xl text-xs"
          />
          <span className="text-muted-foreground text-xs">→</span>
          <DatePicker
            value={r.end_date}
            minDate={r.start_date}
            onChange={(val) => onChange(ranges.map((x, i) => (i === idx ? { ...x, end_date: val } : x)))}
            placeholder="End"
            className="flex-1 h-10 bg-background border-border rounded-xl text-xs"
          />
          {idx === ranges.length - 1 && (
            <span className="text-[9px] font-black text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded shrink-0">DEFAULT</span>
          )}
          <button
            type="button"
            onClick={() => onChange(ranges.filter((_, i) => i !== idx))}
            className="p-1.5 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition-colors shrink-0"
            title="Remove period"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      {ranges.length === 0 && (
        <p className="text-[11px] text-muted-foreground/70 italic">Single period (upar Start–End). Renewal hoy to + thi umero.</p>
      )}
    </div>
  );
};
const BrandLogo = ({
  src,
  alt,
  size = "w-16 h-16",
  rounded = "rounded-2xl",
  className = ""
}: {
  src?: string | null | undefined;
  alt?: string | null | undefined;
  size?: string | undefined;
  rounded?: string | undefined;
  className?: string | undefined;
}) => {
  const seed = encodeURIComponent(String(alt || "brand").slice(0, 24) || "brand");
  const fallback = `https://api.dicebear.com/7.x/identicon/svg?seed=${seed}`;
  return (
    <div className={cn(size, rounded, "border-2 border-primary/30 overflow-hidden shadow-md shadow-primary/10 bg-white p-1 ring-2 ring-primary/10 shrink-0", className)}>
      <img
        src={src && String(src).trim() !== "" ? src : fallback}
        alt={alt || "Brand logo"}
        className="w-full h-full object-cover rounded-xl"
        onError={(e) => {
          const el = e.currentTarget;
          if (!el.src.includes("dicebear")) el.src = fallback;
        }}
      />
    </div>
  );
};

export const CREDENTIAL_PLATFORMS = [
  { value: "Instagram", label: "Instagram", icon: "📸", color: "text-pink-600 bg-pink-500/10 border-pink-500/20" },
  { value: "Facebook", label: "Facebook", icon: "👥", color: "text-blue-600 bg-blue-500/10 border-blue-500/20" },
  { value: "Meta Business Suite", label: "Meta Business Suite", icon: "💼", color: "text-indigo-600 bg-indigo-500/10 border-indigo-500/20" },
  { value: "LinkedIn", label: "LinkedIn", icon: "👔", color: "text-sky-600 bg-sky-500/10 border-sky-500/20" },
  { value: "YouTube", label: "YouTube", icon: "▶️", color: "text-red-600 bg-red-500/10 border-red-500/20" },
  { value: "Twitter/X", label: "Twitter / X", icon: "𝕏", color: "text-neutral-700 dark:text-neutral-300 bg-neutral-500/10 border-neutral-500/20" },
  { value: "Canva", label: "Canva", icon: "🎨", color: "text-teal-600 bg-teal-500/10 border-teal-500/20" },
  { value: "Google Drive", label: "Google Drive", icon: "📁", color: "text-amber-600 bg-amber-500/10 border-amber-500/20" },
  { value: "Website Admin", label: "Website Admin (WP/Shopify)", icon: "🌐", color: "text-violet-600 bg-violet-500/10 border-violet-500/20" },
  { value: "Other", label: "Other", icon: "🔑", color: "text-muted-foreground bg-muted border-border/50" },
] as const;

const LOCKED_CATEGORIES: string[] = [...FIXED_DEPARTMENTS];


const INITIAL_CLIENTS: Client[] = [
  {
    id: "c1",
    name: "TechNova Solutions",
    logo: "https://i.pravatar.cc/150?u=technova",
    totalBudget: "₹345,000",
    outstandingPayment: "₹45,000",
    onboardingDate: "2025-01-15",
    activeProjects: 3,
    status: "Active",
    contacts: [
      { name: "Alice", avatar: "https://i.pravatar.cc/150?u=alice" },
      { name: "Tom", avatar: "https://i.pravatar.cc/150?u=tom" }
    ]
  },
  {
    id: "c2",
    name: "Acme Corp",
    logo: "https://i.pravatar.cc/150?u=acme",
    totalBudget: "₹120,000",
    outstandingPayment: "₹0",
    onboardingDate: "2025-03-20",
    activeProjects: 1,
    status: "Active",
    contacts: [{ name: "Bob", avatar: "https://i.pravatar.cc/150?u=bob" }]
  },
  {
    id: "c3",
    name: "Global Retail Inc.",
    logo: "https://i.pravatar.cc/150?u=global",
    totalBudget: "₹450,000",
    outstandingPayment: "₹150,000",
    onboardingDate: "2024-11-10",
    activeProjects: 4,
    status: "Active",
    contacts: [
      { name: "Charlie", avatar: "https://i.pravatar.cc/150?u=charlie" },
      { name: "Diana", avatar: "https://i.pravatar.cc/150?u=diana" }
    ]
  },
  {
    id: "c4",
    name: "Startup Hub",
    logo: "https://i.pravatar.cc/150?u=startup",
    totalBudget: "₹15,000",
    outstandingPayment: "₹0",
    onboardingDate: "2025-06-05",
    activeProjects: 0,
    status: "Archived",
    contacts: [{ name: "Eve", avatar: "https://i.pravatar.cc/150?u=eve" }]
  },
];

const SMM_DUMMY_PROJECT: Project = {
  id: "smm-dummy-project",
  clientId: "c1",
  name: "Acme Corp Social Media Management",
  category: "Social Media Management",
  status: "In Progress",
  progress: 60,
  startDate: "2026-08-01",
  endDate: "2026-12-31",
  budget: "₹25,000",
  amountReceived: "₹10,000",
  nextPaymentDate: "2026-09-05",
  team: [
    { name: "Alex", avatar: "https://i.pravatar.cc/150?u=alex" },
    { name: "Sarah", avatar: "https://i.pravatar.cc/150?u=sarah" }
  ],
  contentCalendar: [
    {
      id: "dummy-cal-1",
      postingDate: "2026-08-25",
      postingDay: "Tuesday",
      type: "Reel",
      topic: "Productivity Hacks for Remote Teams",
      concept: "Alex presents 3 quick software shortcuts using our app on a screen recording.",
      reference: "https://instagram.com/reel/example",
      assignedTo: ["Alex"],
      scriptDate: "2026-08-20",
      scriptLink: "https://docs.google.com/document/d/example",
      shootDate: "2026-08-22",
      shootLink: "https://drive.google.com/drive/folders/example",
      editingStart: "2026-08-23",
      finalReelLink: "https://drive.google.com/file/d/example",
      approval: "Approved by Het",
      status: "Approved",
      thumbnailDate: "2026-08-23",
      thumbnailLink: "https://canva.com/design/example",
      captionDate: "2026-08-24",
      caption: "Struggling to keep your remote team aligned? Try these 3 simple tech shortcuts! 💻🚀 #remotework #productivity #saas"
    },
    {
      id: "dummy-cal-2",
      postingDate: "2026-08-28",
      postingDay: "Friday",
      type: "Post",
      topic: "Meet the Team Spotlight: Sarah",
      concept: "Carousel post highlighting Sarah's journey, role, and favorite office memory.",
      assignedTo: ["Sarah"],
      status: "In Progress",
      scriptDate: "2026-08-24",
      thumbnailDate: "2026-08-25"
    }
  ]
};

const INITIAL_PROJECTS: Project[] = [
  SMM_DUMMY_PROJECT,
  {
    id: "1",
    clientId: "c1",
    name: "HRMS UI Redesign",
    category: "Design",
    status: "In Progress",
    progress: 75,
    startDate: "2026-06-01",
    endDate: "2026-09-01",
    budget: "₹45,000",
    team: [
      { name: "Alex", avatar: "https://i.pravatar.cc/150?u=alex" },
      { name: "Sarah", avatar: "https://i.pravatar.cc/150?u=sarah" },
      { name: "Mike", avatar: "https://i.pravatar.cc/150?u=mike" }
    ],
    modules: [
      {
        id: "mod-milestones",
        name: "Milestones",
        tasks: [
          { id: "ms-1", title: "Requirement Analysis", status: "completed", dueDate: "25/09/2026", assignedToName: "Alex" },
          { id: "ms-2", title: "Design Phase", status: "completed", dueDate: "02/10/2026", assignedToName: "Sarah" },
          { id: "ms-3", title: "Development Sprint 1", status: "todo", dueDate: "09/10/2026", assignedToName: "Mike" },
          { id: "ms-4", title: "QA & Testing", status: "todo", dueDate: "16/10/2026", assignedToName: "Alex" }
        ]
      }
    ]
  },
  {
    id: "2",
    clientId: "c2",
    name: "Q4 Marketing Campaign",
    category: "Digital Marketing",
    status: "In Review",
    progress: 90,
    startDate: "2026-05-15",
    endDate: "2026-08-20",
    budget: "₹120,000",
    team: [
      { name: "Emma", avatar: "https://i.pravatar.cc/150?u=emma" },
      { name: "James", avatar: "https://i.pravatar.cc/150?u=james" }
    ],
    dailyStats: [
      { id: "ds-1", date: "2026-08-24", campaignName: "Q4 Retargeting Ads", reach: 15000, impressions: 18000, leads: 45, followers: 12, revenue: 25000, spend: 8100 },
      { id: "ds-2", date: "2026-08-24", campaignName: "Holiday Social Push", reach: 28000, impressions: 32000, leads: 92, followers: 30, revenue: 40000, spend: 15600 },
      { id: "ds-3", date: "2026-08-23", campaignName: "Q4 Retargeting Ads", reach: 14200, impressions: 17000, leads: 38, followers: 9, revenue: 22000, spend: 7800 },
      { id: "ds-4", date: "2026-08-23", campaignName: "Holiday Social Push", reach: 25400, impressions: 29000, leads: 81, followers: 25, revenue: 35000, spend: 14500 },
      { id: "ds-5", date: "2026-08-22", campaignName: "B2B Email Drip", reach: 4100, impressions: 5000, leads: 12, followers: 3, revenue: 8000, spend: 3200 }
    ]
  },
  {
    id: "3",
    clientId: "c3",
    name: "Mobile App Development",
    category: "App Dev",
    status: "In Progress",
    progress: 35,
    startDate: "2026-08-01",
    endDate: "2026-11-15",
    budget: "₹85,000",
    team: [
      { name: "David", avatar: "https://i.pravatar.cc/150?u=david" },
      { name: "Sarah", avatar: "https://i.pravatar.cc/150?u=sarah" },
      { name: "Alex", avatar: "https://i.pravatar.cc/150?u=alex" },
      { name: "John", avatar: "https://i.pravatar.cc/150?u=john" }
    ],
    modules: [
      {
        id: "m1",
        name: "User Authentication",
        tasks: [
          { id: "t1", title: "Setup Apple & Google OAuth login flow", status: "in-progress" },
          { id: "t2", title: "Add biometric touch/face ID authentication", status: "todo" }
        ]
      },
      {
        id: "m2",
        name: "Push Notifications",
        tasks: [
          { id: "t3", title: "Setup APNs certificates & FCM service", status: "completed" },
          { id: "t4", title: "Implement foreground notification handler", status: "completed" },
          { id: "t5", title: "Create scheduled local alert reminders", status: "todo" }
        ]
      },
      {
        id: "m3",
        name: "Settings & Profiles",
        tasks: [
          { id: "t6", title: "Upload & compress user profile avatar photo", status: "todo" }
        ]
      }
    ]
  },
  {
    id: "4",
    clientId: "c4",
    name: "Brand Guidelines",
    category: "Design",
    status: "Completed",
    progress: 100,
    startDate: "2026-04-10",
    endDate: "2026-07-30",
    budget: "₹15,000",
    team: [
      { name: "Emma", avatar: "https://i.pravatar.cc/150?u=emma" }
    ]
  },
  {
    id: "5",
    clientId: "c1",
    name: "Legacy System Migration",
    category: "Web Dev",
    status: "On Hold",
    progress: 15,
    startDate: "2026-07-01",
    endDate: "2027-01-10",
    budget: "₹250,000",
    team: [
      { name: "Mike", avatar: "https://i.pravatar.cc/150?u=mike" },
      { name: "David", avatar: "https://i.pravatar.cc/150?u=david" }
    ],
    modules: [
      {
        id: "m1",
        name: "Database Schema",
        tasks: [
          { id: "t1", title: "Export raw legacy data from MS SQL Server", status: "completed" },
          { id: "t2", title: "Map schemas & define target database indexes", status: "in-progress" }
        ]
      },
      {
        id: "m2",
        name: "API Refactoring",
        tasks: [
          { id: "t3", title: "Rewrite core legacy endpoints in Go/Fiber", status: "todo" }
        ]
      }
    ]
  },
  {
    id: "6",
    clientId: "c3",
    name: "E-commerce Platform",
    category: "Web Dev",
    status: "In Progress",
    progress: 60,
    startDate: "2026-07-15",
    endDate: "2026-10-05",
    budget: "₹65,000",
    team: [
      { name: "Sarah", avatar: "https://i.pravatar.cc/150?u=sarah" },
      { name: "John", avatar: "https://i.pravatar.cc/150?u=john" },
      { name: "Alex", avatar: "https://i.pravatar.cc/150?u=alex" }
    ],
    modules: [
      {
        id: "m1",
        name: "Shopping Cart",
        tasks: [
          { id: "t1", title: "Implement cart persistence in local storage", status: "completed" },
          { id: "t2", title: "Create API sync handler for guest items transition", status: "in-progress" }
        ]
      },
      {
        id: "m2",
        name: "Payment Gateway Integration",
        tasks: [
          { id: "t3", title: "Stripe webhooks configuration & signature verify", status: "todo" },
          { id: "t4", title: "Apple Pay merchant verification certificates", status: "todo" }
        ]
      }
    ]
  }
];

  // K1: 4-tab landing — Active/Archived Projects + Active/Archived Clients.
  // "Brand Division" is kept as a separate toggle (not a tab) so the feature stays.
  const TABS = ["Active Projects", "Active Clients", "Archived Projects", "Archived Clients"];
  const PROJECT_TABS = ["Active Projects", "Archived Projects"];

const syncSocialMediaTasksForProject = (project: any, calendarItems: any[]) => {
  const modules = project.modules || [];
  let socialModule = modules.find((m: any) => m.id === "social-media-tasks");
  if (!socialModule) {
    socialModule = {
      id: "social-media-tasks",
      name: "Social Media Production Pipeline",
      tasks: []
    };
  }

  const otherTasks = socialModule.tasks.filter((t: any) => !t.id.startsWith("sm-cal-"));
  const newGeneratedTasks: any[] = [];
  
  calendarItems.forEach(item => {
    const topicText = item.topic || "Untitled Idea";
    const typeLabel = item.type || "Content";
    const assigned = item.assignedTo || undefined;
    
    if (item.scriptDate) {
      newGeneratedTasks.push({
        id: `sm-cal-script-${item.id}`,
        title: `📝 Script: ${typeLabel} - ${topicText}`,
        status: "todo",
        phase: "Scripting",
        dueDate: item.scriptDate,
        assignedToName: assigned
      });
    }
    if (item.shootDate) {
      newGeneratedTasks.push({
        id: `sm-cal-shoot-${item.id}`,
        title: `🎥 Shoot: ${typeLabel} - ${topicText}`,
        status: "todo",
        phase: "Filming",
        dueDate: item.shootDate,
        assignedToName: assigned
      });
    }
    if (item.editingStart) {
      newGeneratedTasks.push({
        id: `sm-cal-edit-${item.id}`,
        title: `🎬 Edit: ${typeLabel} - ${topicText}`,
        status: "todo",
        phase: "Editing",
        dueDate: item.editingStart,
        assignedToName: assigned
      });
    }
    if (item.captionDate) {
      newGeneratedTasks.push({
        id: `sm-cal-approve-${item.id}`,
        title: `✅ Approve: ${typeLabel} - ${topicText}`,
        status: "todo",
        phase: "Approval",
        dueDate: item.captionDate,
        assignedToName: assigned
      });
    }
    if (item.thumbnailDate) {
      newGeneratedTasks.push({
        id: `sm-cal-thumb-${item.id}`,
        title: `🖼️ Thumbnail: ${typeLabel} - ${topicText}`,
        status: "todo",
        phase: "Graphics",
        dueDate: item.thumbnailDate,
        assignedToName: assigned
      });
    }
  });

  const updatedSocialModule = {
    ...socialModule,
    tasks: [...otherTasks, ...newGeneratedTasks]
  };

  const otherModules = modules.filter((m: any) => m.id !== "social-media-tasks");
  return [...otherModules, updatedSocialModule];
};

const CalendarIssuesCell = ({ 
  item, 
  projectCalendar, 
  project, 
  projects, 
  setProjects,
  onLogActivity
}: { 
  item: CalendarItem; 
  projectCalendar: CalendarItem[]; 
  project: any; 
  projects: any[]; 
  setProjects: (projs: any[]) => void;
  onLogActivity: (action: string, details?: string) => void;
}) => {
  const { user } = useAuth();
  const currentUserName = useMemo(() => {
    const personal = (user as any)?.personal_info || {};
    const first = (personal.first_name || "").trim();
    const last = (personal.last_name || "").trim();
    const fullName = `${first} ${last}`.trim();
    return fullName || (user as any)?.name || (user as any)?.username || "Team Member";
  }, [user]);

  const [newIssueText, setNewIssueText] = useState("");
  const [selectedRole, setSelectedRole] = useState("Shoot");
  const [isClientIssue, setIsClientIssue] = useState(true);
  const issuesList = item.issues || [];

  const handleAddIssue = () => {
    if (!newIssueText.trim()) return;
    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    const newIssue = {
      id: `issue-${Date.now()}`,
      text: newIssueText.trim(),
      role: selectedRole,
      author: currentUserName,
      isClientIssue: isClientIssue,
      timestamp: dateStr
    };

    const updatedIssues = [...issuesList, newIssue];
    const updatedCalendar = projectCalendar.map((x: any) => 
      x.id === item.id ? { ...x, issues: updatedIssues } : x
    );
    setProjects(projects.map(p => p.id === project.id ? { ...p, contentCalendar: updatedCalendar } : p));
    onLogActivity("Logged Issue", `Added ${isClientIssue ? 'Client Issue' : 'Remark'} (${selectedRole}) "${newIssueText.trim()}" on content idea "${item.topic || 'Untitled'}" by ${currentUserName}`);
    setNewIssueText("");

    if (project.id && item.id) {
      api.put(`/projects/${project.id}/content/${item.id}`, {
        issues: updatedIssues
      }).catch(e => console.error("Failed to sync issue to backend:", e));
    }
  };

  const handleToggleClientIssue = (issueId: string) => {
    const updatedIssues = issuesList.map(iss => 
      iss.id === issueId ? { ...iss, isClientIssue: !iss.isClientIssue } : iss
    );
    const updatedCalendar = projectCalendar.map((x: any) => 
      x.id === item.id ? { ...x, issues: updatedIssues } : x
    );
    setProjects(projects.map(p => p.id === project.id ? { ...p, contentCalendar: updatedCalendar } : p));
    if (project.id && item.id) {
      api.put(`/projects/${project.id}/content/${item.id}`, {
        issues: updatedIssues
      }).catch(e => console.error("Failed to sync issue update to backend:", e));
    }
  };

  const handleRemoveIssue = (issueId: string) => {
    const issueObj = issuesList.find(i => i.id === issueId);
    const updatedIssues = issuesList.filter(i => i.id !== issueId);
    const updatedCalendar = projectCalendar.map((x: any) => 
      x.id === item.id ? { ...x, issues: updatedIssues } : x
    );
    setProjects(projects.map(p => p.id === project.id ? { ...p, contentCalendar: updatedCalendar } : p));
    if (issueObj) {
      onLogActivity("Resolved Issue", `Resolved issue "${issueObj.text}" on content idea "${item.topic || 'Untitled'}"`);
    }

    if (project.id && item.id) {
      api.put(`/projects/${project.id}/content/${item.id}`, {
        issues: updatedIssues
      }).catch(e => console.error("Failed to sync issue removal to backend:", e));
    }
  };

  const activeClientIssues = issuesList.filter(i => i.isClientIssue !== false);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className={cn(
          "mx-auto px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wider block text-center cursor-pointer transition-all border shadow-xs",
          activeClientIssues.length > 0 
            ? "bg-rose-500/10 text-rose-600 border-rose-500/30 hover:bg-rose-500/20" 
            : issuesList.length > 0
            ? "bg-amber-500/10 text-amber-600 border-amber-500/30 hover:bg-amber-500/20"
            : "bg-muted/60 text-muted-foreground hover:bg-muted border-border/40"
        )}>
          {activeClientIssues.length > 0 
            ? `⚠️ ${activeClientIssues.length} Client Issue${activeClientIssues.length > 1 ? 's' : ''}` 
            : issuesList.length > 0 
            ? `💬 ${issuesList.length} Remark${issuesList.length > 1 ? 's' : ''}` 
            : "+ Issue / Remark"}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-4 bg-card border border-border rounded-2xl shadow-xl z-50 text-left" align="center">
        <div className="space-y-3">
          <div className="flex justify-between items-center border-b border-border/40 pb-2">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Issues & Remarks ({issuesList.length})</h4>
              <p className="text-[10px] text-muted-foreground">Person-specific client issues & notes</p>
            </div>
          </div>
          
          <div className="space-y-2 max-h-[190px] overflow-y-auto pr-1">
            {issuesList.length === 0 ? (
              <p className="text-[10px] text-muted-foreground italic font-medium py-2 text-center">No active issues or remarks logged.</p>
            ) : (
              issuesList.map((issue) => (
                <div 
                  key={issue.id} 
                  className={cn(
                    "p-2.5 rounded-xl border flex flex-col gap-1.5 transition-all",
                    issue.isClientIssue !== false
                      ? "bg-rose-500/5 border-rose-500/20 text-rose-700 dark:text-rose-400"
                      : "bg-muted/40 border-border/50 text-foreground"
                  )}
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                        {issue.role || "Task"}
                      </span>
                      {issue.author && (
                        <span className="text-[10px] font-semibold text-foreground/80">
                          {issue.author}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] text-muted-foreground font-mono">{issue.timestamp}</span>
                      <button 
                        onClick={() => handleRemoveIssue(issue.id)}
                        className="p-1 text-muted-foreground hover:text-rose-600 transition-colors"
                        title="Delete issue"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] font-medium leading-relaxed">{issue.text}</p>

                  <div className="pt-1 border-t border-border/30 flex items-center justify-between text-[10px]">
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={issue.isClientIssue !== false}
                        onChange={() => handleToggleClientIssue(issue.id)}
                        className="rounded border-border text-rose-600 focus:ring-rose-500 w-3 h-3"
                      />
                      <span className={cn("font-semibold", issue.isClientIssue !== false ? "text-rose-600 font-bold" : "text-muted-foreground")}>
                        {issue.isClientIssue !== false ? "Client Issue (Pending)" : "Resolved / Normal"}
                      </span>
                    </label>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="pt-2 border-t border-border/40 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Target Phase/Role</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full px-2 py-1 bg-muted/40 border border-border/50 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {["Shoot", "Scripting", "Editing", "Thumbnail", "Posting"].map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col justify-end">
                <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer pb-1.5 select-none text-rose-600">
                  <input
                    type="checkbox"
                    checked={isClientIssue}
                    onChange={(e) => setIsClientIssue(e.target.checked)}
                    className="rounded border-border text-rose-600 focus:ring-rose-500 w-3.5 h-3.5"
                  />
                  <span>Client Issue</span>
                </label>
              </div>
            </div>

            <textarea
              placeholder="Type remark / issue reason..."
              value={newIssueText}
              onChange={(e) => setNewIssueText(e.target.value)}
              rows={2}
              className="w-full px-2.5 py-1.5 bg-muted/30 border border-border/50 rounded-xl text-xs focus:outline-none resize-none font-medium text-foreground"
            />
            <button
              onClick={handleAddIssue}
              className="w-full py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition-colors shadow-xs"
            >
              Add Issue / Remark
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

const subtractDays = (startDate: Date, days: number) => {
  const d = new Date(startDate);
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
};

const getPresetDates = (postingDateStr: string) => {
  if (!postingDateStr) return {};
  const d = new Date(postingDateStr);
  if (isNaN(d.getTime())) return {};
  
  let offsets = { script: 14, shoot: 12, editing: 6, approval: 5 };
  if (typeof window !== 'undefined') {
    try {
      const saved = (typeof window !== 'undefined' ? localStorage.getItem('hrms_calendar_offsets') : null);
      if (saved) offsets = JSON.parse(saved);
    } catch (e) {}
  }

  return {
    scriptDate: subtractDays(d, offsets.script),
    shootDate: subtractDays(d, offsets.shoot),
    editingStart: subtractDays(d, offsets.editing),
    captionDate: subtractDays(d, offsets.editing),
    thumbnailDate: subtractDays(d, offsets.editing),
    approval: subtractDays(d, offsets.approval)
  };
};

const mapBackendClient = (bc: any): Client => {
  const stats = bc.client_stats || {};
  const depts = bc.service_details?.departments || [];
  return {
    id: String(bc._id || bc.id),
    name: bc.contact_person_name || bc.company_name || "Client",
    companyName: bc.company_name || "",
    email: bc.email_address || "",
    phone: bc.phone_number || "",
    address: bc.address || "",
    state: bc.state_ut || "",
    gstin: bc.gstin || "",
    department: depts.join(", "),
    remarks: bc.additional_notes || "",
    logo: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(bc.company_name || bc.contact_person_name || "Client")}`,
    totalBudget: `₹${(stats.total_budget || 0).toLocaleString("en-IN")}`,
    outstandingPayment: `₹${(stats.outstanding_amount || 0).toLocaleString("en-IN")}`,
    onboardingDate: bc.created_at ? (bc.created_at.split("T")[0] ?? "") : "",
    activeProjects: stats.total_projects || (bc.projects?.length || 0),
    status: bc.is_archived ? "Archived" : "Active",
    contacts: [{ name: bc.contact_person_name || "Contact", avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(bc.contact_person_name || "User")}` }]
  };
};

const mapBackendProject = (bp: any): Project => {
  const gen = bp.general || {};
  const fin = bp.finance || {};
  const cStats = gen.creative_stats || {};
  const dmStats = gen.digital_marketing_stats || {};
  
  let statusMapped: ProjectStatus = "In Progress";
  const rawStatus = (gen.status || "").toLowerCase().replace(/[\s_]/g, "");
  if (rawStatus === "completed") statusMapped = "Completed";
  else if (rawStatus === "onhold" || rawStatus === "cancelled") statusMapped = "On Hold";
  else if (rawStatus === "inreview") statusMapped = "In Review";
  else statusMapped = "In Progress";

  let pri: "Low" | "Medium" | "High" | "Critical" = "Medium";
  const rawPri = (gen.priority || "").toLowerCase();
  if (rawPri === "urgent") pri = "Critical";
  else if (rawPri === "high") pri = "High";
  else if (rawPri === "low") pri = "Low";

  const teamMembers: { name: string; avatar: string }[] = [];
  if (bp.creative_team_details) {
    Object.entries(bp.creative_team_details).forEach(([role, detail]: [string, any]) => {
      if (detail && detail.employee_name) {
        teamMembers.push({
          name: `${detail.employee_name} (${role})`,
          avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(detail.employee_name)}`
        });
      }
    });
  }
  if (teamMembers.length === 0) {
    teamMembers.push({ name: "Team Member", avatar: "https://api.dicebear.com/7.x/adventurer/svg?seed=Team" });
  }

  // Renewal periods (backend date_ranges) — latest (last) = default effective dates
  const rawRanges = Array.isArray(bp.date_ranges) ? bp.date_ranges : [];
  const dateRanges = rawRanges
    .map((r: any) => ({
      start_date: r.start_date ? (String(r.start_date).split("T")[0] ?? "") : "",
      end_date: r.end_date ? (String(r.end_date).split("T")[0] ?? "") : "",
      label: r.label || "",
    }))
    .filter((r: any) => r.start_date && r.end_date);
  const effStart = dateRanges.length > 0 ? (dateRanges[dateRanges.length - 1] as any).start_date : (gen.start_date ? (String(gen.start_date).split("T")[0] ?? "") : "");
  const effEnd = dateRanges.length > 0 ? (dateRanges[dateRanges.length - 1] as any).end_date : (gen.end_date ? (String(gen.end_date).split("T")[0] ?? "") : "");

  return {
    id: String(bp._id || bp.id),
    clientId: String(bp.client_id || ""),
    name: gen.project_name || "Project",
    description: gen.description || "",
    category: (() => {
      const rawCat = (gen.category || "").trim();
      const c = rawCat.toLowerCase().replace(/[\s_\-\/]/g, "");
      if (c === "digitalmarketing" || c === "marketing" || c.includes("marketing")) return "Digital Marketing";
      if (c === "sales") return "Sales";
      if (c === "development" || c.includes("dev")) return "Development";
      if (c === "creative" || c.includes("creative") || c.includes("design") || c.includes("ui") || c.includes("social") || c === "smm") return "Creative";
      return "Creative";
    })(),
    status: statusMapped,
    priority: pri,
    progress: gen.progress || 0,
    startDate: effStart,
    endDate: effEnd,
    dateRanges,
    teamDeadline: gen.team_deadline ? (String(gen.team_deadline).split("T")[0] ?? "") : "",
    budget: fin.project_budget ? `₹${fin.project_budget.toLocaleString("en-IN")}` : "₹0",
    amountReceived: fin.amount_received ? `₹${fin.amount_received.toLocaleString("en-IN")}` : "₹0",
    nextPaymentDate: fin.next_payment_date ? (String(fin.next_payment_date).split("T")[0] ?? "") : "",
    // K10: normalize payment entries (ISO date strings)
    payments: Array.isArray(fin.payments) ? fin.payments.map((pay: any, idx: number) => ({
      id: String(pay.id || `pay-${idx}-${pay.date || ""}`),
      date: pay.date ? String(pay.date).split("T")[0] : "",
      amount: Number(pay.amount) || 0,
      work_from: pay.work_from ? String(pay.work_from).split("T")[0] : "",
      work_to: pay.work_to ? String(pay.work_to).split("T")[0] : "",
      next_reminder: pay.next_reminder ? String(pay.next_reminder).split("T")[0] : "",
      note: pay.note || "",
    })) : [],
    post: cStats.post_count_per_month || 0,
    reel: cStats.reel_count_per_month || 0,
    festivalPost: cStats.festival_posts_included ? "Yes" : "No",
    reach: dmStats.reach_target || "",
    leads: dmStats.leads_target ? String(dmStats.leads_target) : "",
    cpl: dmStats.cpl ? String(dmStats.cpl) : "",
    campaigns: bp.campaigns || [],
    team: teamMembers,
    modules: Array.isArray(bp.modules) && bp.modules.length > 0 ? bp.modules : [],
    contentCalendar: [],
    whatsapp_group_link: bp.whatsapp_group_link || "",
    nextFollowupDate: (bp as any).next_followup_date ? (String((bp as any).next_followup_date).split("T")[0] ?? "") : "",
    creativeTeam: bp.creative_team || {},
    creativeTeamDetails: bp.creative_team_details || {},
    credentials: bp.social_media_credentials || []
  };
};

export function Projects({ isNew }: { isNew?: boolean }) {
  const [projectSubTab, setProjectSubTab] = useState<"workspace" | "logs">("workspace");
  const [isBulkAdd, setIsBulkAdd] = useState(false);
  const [bulkStatsEntries, setBulkStatsEntries] = useState<{ [campaignName: string]: { reach: string, impressions: string, leads: string, followers: string, revenue: string, spend: string } }>({});

  const logProjectActivity = (projectId: string, action: string, details?: string) => {
    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const newLog: any = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      action,
      performedBy: "Alex (You)",
      timestamp: dateStr,
      details: details || undefined
    };
    
    setProjects(prevProjects => {
      const updated = prevProjects.map(p => {
        if (p.id === projectId) {
          return {
            ...p,
            activityLogs: [...(p.activityLogs || []), newLog]
          };
        }
        return p;
      });
      localStorage.setItem("hrms_projects", JSON.stringify(updated));
      return updated;
    });
  };
  const saveProjectModules = async (
    projectId: string, 
    updatedModules: NonNullable<Project['modules']>,
    logAction?: string,
    logDetails?: string
  ) => {
    setProjects(prevProjects => {
      const now = new Date();
      const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const newLog = logAction ? [{
        id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        action: logAction,
        performedBy: "Alex (You)",
        timestamp: dateStr,
        ...(logDetails ? { details: logDetails } : {})
      }] : [];

      const updated = prevProjects.map(p => {
        if (p.id === projectId) {
          const updatedP: Project = {
            ...p,
            modules: updatedModules,
          };
          if (logAction) {
            updatedP.activityLogs = [...(p.activityLogs || []), ...newLog];
          }
          return updatedP;
        }
        return p;
      });
      try {
        localStorage.setItem("hrms_projects", JSON.stringify(updated));
      } catch (e) {
        console.error("Failed to save to localStorage", e);
      }
      return updated;
    });

    try {
      await api.put(`/projects/${projectId}`, { modules: updatedModules });
    } catch (err) {
      console.warn("Could not persist modules to backend API:", err);
    }
  };

  // One-time migration: clear old localStorage if version mismatch
  const STORAGE_VERSION = 'v5';
  if ((typeof window !== 'undefined' ? localStorage.getItem('hrms_storage_version') : null) !== STORAGE_VERSION) {
    localStorage.removeItem('hrms_clients');
    localStorage.removeItem('hrms_projects');
    localStorage.removeItem('hrms_categories');
    localStorage.setItem('hrms_storage_version', STORAGE_VERSION);
  }

  const [clients, setClients] = useState<Client[]>(() => {
    const saved = (typeof window !== 'undefined' ? localStorage.getItem('hrms_clients') : null);
    if (saved) {
      try { 
        const parsed = JSON.parse(saved);
        if (JSON.stringify(parsed).includes('$')) return INITIAL_CLIENTS; // Force update to ₹
        // Normalize: ensure all clients have a contacts array and logo
        return (parsed as Client[]).map((c: Client) => ({
          ...c,
          contacts: c.contacts ?? [],
          logo: c.logo || `https://i.pravatar.cc/150?u=${encodeURIComponent(c.name)}`,
          totalBudget: c.totalBudget ?? '₹0',
          outstandingPayment: c.outstandingPayment ?? '₹0',
        }));
      } catch (e) {}
    }
    return INITIAL_CLIENTS;
  });

  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = (typeof window !== 'undefined' ? localStorage.getItem('hrms_projects') : null);
    let loadedProjects: Project[] = INITIAL_PROJECTS;
    if (saved) {
      try { 
        const parsed = JSON.parse(saved);
        if (JSON.stringify(parsed).includes('$')) loadedProjects = INITIAL_PROJECTS; // Force update to ₹
        else {
          if (!parsed.some((p: any) => p.id === "smm-dummy-project")) {
            parsed.unshift(SMM_DUMMY_PROJECT);
          }
          // Migration: Add default dailyStats if missing
          parsed.forEach((p: any) => {
            if (p.id === "2" && !p.dailyStats) {
              p.dailyStats = [
                { id: "ds-1", date: "2026-08-24", campaignName: "Q4 Retargeting Ads", reach: 15000, leads: 45, spend: 8100 },
                { id: "ds-2", date: "2026-08-24", campaignName: "Holiday Social Push", reach: 28000, leads: 92, spend: 15600 },
                { id: "ds-3", date: "2026-08-23", campaignName: "Q4 Retargeting Ads", reach: 14200, leads: 38, spend: 7800 },
                { id: "ds-4", date: "2026-08-23", campaignName: "Holiday Social Push", reach: 25400, leads: 81, spend: 14500 },
                { id: "ds-5", date: "2026-08-22", campaignName: "B2B Email Drip", reach: 4100, leads: 12, spend: 3200 }
              ];
            }
          });
          loadedProjects = parsed;
        }
      } catch (e) {}
    }

    // Normalize issues field on contentCalendar items
    loadedProjects = loadedProjects.map((p: any) => {
      if (p.contentCalendar) {
        const normalizedCal = p.contentCalendar.map((item: any) => {
          if (item.issues && typeof item.issues === 'string') {
            return {
              ...item,
              issues: [{ id: 'migrated-1', text: item.issues, timestamp: '25/08/2026 12:00' }]
            };
          }
          return item;
        });
        return { ...p, contentCalendar: normalizedCal };
      }
      return p;
    });

    // Auto-generate daily tasks for Digital Marketing projects
    let updated = false;
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const prevDate = format(d, "yyyy-MM-dd");

    const processedProjects = loadedProjects.map((project: Project) => {
      if (project.category === "Digital Marketing") {
        const modules = [...(project.modules || [])];
        let dailyModule = modules.find((m: any) => m.id === "daily-data-entry");
        if (!dailyModule) {
          dailyModule = {
            id: "daily-data-entry",
            name: "Daily Data Entry",
            status: "todo",
            priority: "medium",
            tasks: []
          };
          modules.push(dailyModule);
          updated = true;
        }

        const tasks = [...(dailyModule.tasks || [])];
        const campaignList = (project.campaigns && project.campaigns.length > 0) 
          ? project.campaigns.map(c => typeof c === 'string' ? c : (c.name || "")) 
          : ["Q4 Retargeting Ads", "Holiday Social Push", "B2B Email Drip"];
        
        let hasNewTasks = false;
        campaignList.forEach((campaignName) => {
          const taskId = `daily-task-${project.id}-${prevDate}-${campaignName.replace(/\s+/g, '-').toLowerCase()}`;
          const taskExists = tasks.some((t: any) => t.id === taskId);
          if (!taskExists) {
            const newTask = {
              id: taskId,
              title: `Add ${campaignName} data (${prevDate})`,
              status: "todo" as const,
              dueDate: prevDate,
              assignedToName: project.team[0]?.name || "Emma",
              assignedToAvatar: project.team[0]?.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${project.team[0]?.name || "Emma"}`
            };
            tasks.push(newTask);
            hasNewTasks = true;
          }
        });

        if (hasNewTasks) {
          const updatedModules = modules.map((m: any) => m.id === "daily-data-entry" ? { ...m, tasks: tasks } : m);
          updated = true;
          return { ...project, modules: updatedModules };
        }
      }
      return project;
    });

    if (updated && typeof window !== "undefined") {
      localStorage.setItem('hrms_projects', JSON.stringify(processedProjects));
    }
    return processedProjects;
  });

  const [categories, setCategories] = useState<string[]>([...FIXED_DEPARTMENTS]);

  const [activeTab, setActiveTab] = useState<string>(TABS[0] ?? "Active Projects");
  // K1: Brand Division lives outside the 4 tabs (toggle, so the feature stays).
  const [showBrandDivision, setShowBrandDivision] = useState(false);
  const selectTab = (tab: string) => {
    setActiveTab(tab);
    setShowBrandDivision(false);
  };
  const [searchQuery, setSearchQuery] = useState("");
  
  const [clientSort, setClientSort] = useState<"name" | "budgetDesc" | "projectsDesc">("name");
  const [clientFilterCategories, setClientFilterCategories] = useState<string[]>([]);
  const [projectFilterStatuses, setProjectFilterStatuses] = useState<ProjectStatus[]>([]);
  const [projectFilterCategories, setProjectFilterCategories] = useState<string[]>([]);
  
  const { employees } = useEmployeesContext();

  // Feature 1: Creative Team Assignment
  const [isAssignCreativeTeamModalOpen, setIsAssignCreativeTeamModalOpen] = useState(false);
  const [isSavingCreativeTeam, setIsSavingCreativeTeam] = useState(false);
  const [assigningProject, setAssigningProject] = useState<Project | null>(null);
  const [creativeTeamForm, setCreativeTeamForm] = useState<Record<string, string>>({
    scripting: "",
    shoot_videography: "",
    reel_editing: "",
    post_graphics: "",
    thumbnail: "",
    approval_qc: "",
    caption: "",
    posting_publisher: "",
  });
  const [openRoleId, setOpenRoleId] = useState<string | null>(null);
  const [roleSearchQuery, setRoleSearchQuery] = useState<string>("");

  // Feature 2: Brand Division Filters
  const [brandDivisionCategory, setBrandDivisionCategory] = useState<string>("All");
  const [brandDivisionRole, setBrandDivisionRole] = useState<string>("All");
  const [brandDivisionSearch, setBrandDivisionSearch] = useState<string>("");

  // Feature 3: Pending Brands Modal
  const [isPendingBrandsModalOpen, setIsPendingBrandsModalOpen] = useState(false);

  // Feature 4: Monthly Target vs Completed Content KPI
  const [calendarMonthFilter, setCalendarMonthFilter] = useState<string>("Current");
  const [isEditTargetsModalOpen, setIsEditTargetsModalOpen] = useState(false);
  const [targetsForm, setTargetsForm] = useState<{ post: number; reel: number }>({ post: 8, reel: 8 });
  // K18: CC status (month approval) — inline section, overlap rule sathe
  const [ccApprovals, setCcApprovals] = useState<Record<string, any>>({});
  const [ccStatusDraft, setCcStatusDraft] = useState<string>("Pending");
  const [ccReasonDraft, setCcReasonDraft] = useState<string>("");
  const fetchCcApproval = useCallback(async (projId: string, month: number, year: number) => {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    try {
      const res = await api.get<any>(`/projects/${projId}/content/approval?month=${month}&year=${year}`, { showLoader: false, showErrorToast: false });
      setCcApprovals(prev => ({ ...prev, [key]: res || null }));
    } catch {
      setCcApprovals(prev => ({ ...prev, [key]: null }));
    }
  }, []);
  const handleSaveCcStatus = async (projId: string, month: number, year: number) => {
    if (ccStatusDraft !== "Approved by Client" && !ccReasonDraft.trim()) {
      toast.error("Reason compulsory che (Approved sivay)");
      return;
    }
    try {
      const res = await api.put<any>(`/projects/${projId}/content/approval`, {
        month, year, status: ccStatusDraft,
        reason: ccReasonDraft.trim() || undefined,
      });
      const key = `${year}-${String(month).padStart(2, "0")}`;
      setCcApprovals(prev => ({ ...prev, [key]: res || null }));
      setCcReasonDraft("");
      toast.success("CC status updated");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update CC status");
    }
  };

  // Feature 5: WhatsApp Group & Client Credentials
  const [isWhatsappModalOpen, setIsWhatsappModalOpen] = useState(false);
  const [whatsappLinkInput, setWhatsappLinkInput] = useState("");
  const [isCredentialsModalOpen, setIsCredentialsModalOpen] = useState(false);
  const [newCredentialForm, setNewCredentialForm] = useState<{ platform: string; customPlatform?: string; username: string; password: string; notes: string }>({
    platform: "Instagram",
    customPlatform: "",
    username: "",
    password: "",
    notes: ""
  });
  const [showPasswordMap, setShowPasswordMap] = useState<Record<number, boolean>>({});

  // Handler: Save Creative Team
  const handleSaveCreativeTeam = async (projId: string, teamData: Record<string, string>) => {
    setIsSavingCreativeTeam(true);
    try {
      const res = await api.put<any>(`/projects/${projId}`, {
        creative_team: teamData
      });
      const details: Record<string, any> = {};
      const updatedTeamList: { name: string; avatar: string }[] = [];
      Object.entries(teamData).forEach(([role, empId]) => {
        const emp = employees.find(e => String(e.id) === String(empId) || String((e as any)._id) === String(empId));
        if (emp) {
          details[role] = { employee_name: emp.name };
          updatedTeamList.push({ name: `${emp.name} (${role})`, avatar: emp.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(emp.name)}` });
        }
      });

      const finalDetails = (res && res.creative_team_details) ? { ...res.creative_team_details, ...details } : details;

      setProjects(prev => prev.map(p => p.id === projId ? {
        ...p,
        creativeTeam: teamData,
        creativeTeamDetails: finalDetails,
        team: updatedTeamList.length > 0 ? updatedTeamList : p.team
      } : p));

      toast.success("Creative team assigned successfully!");
      setIsAssignCreativeTeamModalOpen(false);
      setAssigningProject(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to update creative team");
    } finally {
      setIsSavingCreativeTeam(false);
    }
  };

  // Handler: Save WhatsApp Link
  const handleSaveWhatsAppLink = async (projId: string, link: string) => {
    try {
      await api.put(`/projects/${projId}`, {
        whatsapp_group_link: link
      });
      setProjects(prev => prev.map(p => p.id === projId ? { ...p, whatsapp_group_link: link } : p));
      toast.success("WhatsApp Group link updated!");
      setIsWhatsappModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save WhatsApp link");
    }
  };

  // Handler: Save Delivery Targets
  const handleSaveTargets = async (projId: string, newPost: number, newReel: number) => {
    try {
      await api.put(`/projects/${projId}`, {
        general: {
          creative_stats: {
            post_count_per_month: newPost,
            reel_count_per_month: newReel,
            standard_posts: newPost > 0,
            reels_videos: newReel > 0
          }
        }
      });
      setProjects(prev => prev.map(p => p.id === projId ? { ...p, post: newPost, reel: newReel } : p));
      toast.success("Monthly delivery targets updated!");
      setIsEditTargetsModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update targets");
    }
  };

  // Handler: Save Credentials
  const handleSaveCredentials = async (projId: string, updatedCreds: any[]) => {
    try {
      await api.put(`/projects/${projId}`, {
        social_media_credentials: updatedCreds
      });
      setProjects(prev => prev.map(p => p.id === projId ? { ...p, credentials: updatedCreds } : p));
      toast.success("Client credentials saved!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save credentials");
    }
  };

  // Pending brands (active projects with 0 creative team members assigned)
  const pendingProjects = useMemo(() => {
    return projects.filter(p => {
      if (p.status === "Completed") return false;
      const assignedCount = Object.values(p.creativeTeam || {}).filter(Boolean).length;
      return assignedCount === 0;
    });
  }, [projects]);

  // Brand division member-wise data
  const brandDivisionData = useMemo(() => {
    return employees.map(emp => {
      const empId = String(emp.id || (emp as any)._id);
      const empName = emp.name.toLowerCase();

      const assignedProjects: { project: Project; client?: Client | undefined; roles: string[] }[] = [];

      projects.forEach(proj => {
        const client = clients.find(c => c.id === proj.clientId);
        const roles: string[] = [];

        if (proj.creativeTeam) {
          Object.entries(proj.creativeTeam).forEach(([roleKey, assignedId]) => {
            if (assignedId && String(assignedId) === empId) {
              const roleObj = CREATIVE_ROLES.find(r => r.key === roleKey);
              if (roleObj) roles.push(roleObj.label);
            }
          });
        }
        if (proj.creativeTeamDetails) {
          Object.entries(proj.creativeTeamDetails).forEach(([roleKey, detail]: [string, any]) => {
            if (detail && detail.employee_name && detail.employee_name.toLowerCase() === empName) {
              const roleObj = CREATIVE_ROLES.find(r => r.key === roleKey);
              if (roleObj && !roles.includes(roleObj.label)) roles.push(roleObj.label);
            }
          });
        }
        if (roles.length === 0 && proj.team) {
          const isMember = proj.team.some(m => m.name.toLowerCase().includes(empName) || empName.includes(m.name.toLowerCase()));
          if (isMember) {
            roles.push("Team Member");
          }
        }

        if (roles.length > 0) {
          if (brandDivisionCategory !== "All" && proj.category !== brandDivisionCategory) return;
          if (brandDivisionRole !== "All" && !roles.some(r => r.toLowerCase().includes(brandDivisionRole.toLowerCase()))) return;
          assignedProjects.push({ project: proj, client, roles });
        }
      });

      return {
        employee: emp,
        assignedProjects
      };
    }).filter(item => {
      if (brandDivisionSearch.trim()) {
        const q = brandDivisionSearch.toLowerCase();
        const matchesEmp = item.employee.name.toLowerCase().includes(q) || (item.employee.designation || "").toLowerCase().includes(q);
        const matchesBrand = item.assignedProjects.some(ap => ap.project.name.toLowerCase().includes(q) || (ap.client?.name || "").toLowerCase().includes(q));
        return matchesEmp || matchesBrand;
      }
      return item.assignedProjects.length > 0;
    }).sort((a, b) => b.assignedProjects.length - a.assignedProjects.length);
  }, [employees, projects, clients, brandDivisionCategory, brandDivisionRole, brandDivisionSearch]);

  
  const [selectedClientId, setSelectedClientId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const saved = (typeof window !== 'undefined' ? localStorage.getItem("hrms_selected_client_id") : null);
      if (saved) return saved;
    }
    return null;
  });

  useEffect(() => {
    if (selectedClientId) {
      localStorage.setItem("hrms_selected_client_id", selectedClientId);
    } else {
      localStorage.removeItem("hrms_selected_client_id");
    }
  }, [selectedClientId]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const saved = (typeof window !== 'undefined' ? localStorage.getItem("hrms_selected_project_id") : null);
      if (saved) return saved;
    }
    return null;
  });

  useEffect(() => {
    if (selectedProjectId) {
      localStorage.setItem("hrms_selected_project_id", selectedProjectId);
    } else {
      localStorage.removeItem("hrms_selected_project_id");
    }
    setProjectSubTab("workspace");
    setDmWorkspaceView("social");
  }, [selectedProjectId]);

  useEffect(() => {
    const handleNavigate = (e: any) => {
      if (e.detail === "/work/projects") {
        setSelectedClientId(null);
        setSelectedProjectId(null);
      }
    };
    window.addEventListener("navigate_tab", handleNavigate);
    return () => window.removeEventListener("navigate_tab", handleNavigate);
  }, []);

  useEffect(() => {
    if (selectedClientId && clients.length > 0 && !clients.some(c => c.id === selectedClientId)) {
      setSelectedClientId(null);
      setSelectedProjectId(null);
    }
  }, [selectedClientId, clients]);

  useEffect(() => {
    if (selectedProjectId && projects.length > 0 && !projects.some(p => p.id === selectedProjectId)) {
      setSelectedProjectId(null);
    }
  }, [selectedProjectId, projects]);

  const [isLoadingData, setIsLoadingData] = useState(false);

  const loadLiveData = useCallback(async () => {
    setIsLoadingData(true);
    try {
      const [clientsRes, archivedClientsRes, projectsRes] = await Promise.allSettled([
        api.get<{ data?: any[] } | any[]>("/clients", { showLoader: false }),
        api.get<{ data?: any[] } | any[]>("/clients?is_archived=true", { showLoader: false }),
        api.get<{ data?: any[] } | any[]>("/projects", { showLoader: false }),
      ]);

      let fetchedClients: Client[] = [];
      if (clientsRes.status === "fulfilled" && clientsRes.value) {
        const raw = Array.isArray(clientsRes.value) ? clientsRes.value : (clientsRes.value?.data || []);
        fetchedClients = [...fetchedClients, ...raw.map(mapBackendClient)];
      }
      if (archivedClientsRes.status === "fulfilled" && archivedClientsRes.value) {
        const raw = Array.isArray(archivedClientsRes.value) ? archivedClientsRes.value : (archivedClientsRes.value?.data || []);
        fetchedClients = [...fetchedClients, ...raw.map((c: any) => ({ ...mapBackendClient(c), status: "Archived" as ClientStatus }))];
      }
      if (fetchedClients.length > 0) {
        setClients(fetchedClients);
      }

      if (projectsRes.status === "fulfilled" && projectsRes.value) {
        const raw = Array.isArray(projectsRes.value) ? projectsRes.value : (projectsRes.value?.data || []);
        if (raw.length > 0) {
          const transformed = raw.map(mapBackendProject);
          setProjects(prevProjects => transformed.map(tp => {
            const existing = prevProjects.find(p => p.id === tp.id);
            return {
              ...tp,
              contentCalendar: (existing?.contentCalendar && existing.contentCalendar.length > 0)
                ? existing.contentCalendar
                : (tp.contentCalendar || [])
            };
          }));
        }
      }
    } catch (err) {
      console.warn("Failed to fetch clients/projects from API:", err);
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  useEffect(() => {
    loadLiveData();
  }, [loadLiveData]);

  const fetchProjectContentCalendar = useCallback(async (projId: string) => {
    if (!projId) return;
    try {
      // NOTE: Do not pass page and limit so that all content data is returned without truncation
      const res = await api.get<{ data?: any[] } | any[]>(`/projects/${projId}/content`, { showLoader: false });
      const raw = Array.isArray(res) ? res : (res?.data || []);
      const mapped = raw.map(mapBackendContentToCalendarItem);

      // Sync timeline presets / settings from backend
      try {
        const settings = await api.get<any>(`/projects/${projId}/content/settings`, { showLoader: false });
        if (settings) {
          setCalendarOffsets({
            script: settings.script_days_before ?? 14,
            shoot: settings.shoot_days_before ?? 12,
            editing: settings.editing_graphics_days_before ?? 6,
            approval: settings.approval_days_before ?? 5,
          });
        }
      } catch {}

      setProjects(prev => prev.map(p => p.id === projId ? {
        ...p,
        contentCalendar: mapped,
      } : p));
    } catch (err) {
      console.warn("Failed to fetch project content calendar:", err);
    }
  }, []);

  const fetchProjectFollowups = useCallback(async (projId: string) => {
    try {
      const res = await api.get<any[]>(`/projects/${projId}/followups`, { showLoader: false, showErrorToast: false });
      setProjectFollowups(Array.isArray(res) ? res : []);
    } catch {
      setProjectFollowups([]);
    }
  }, []);
  // K11: backend activity logs (content CRUD auto-logs) — logs tab ma by default
  const [backendActivityLogs, setBackendActivityLogs] = useState<any[]>([]);
  const fetchProjectActivities = useCallback(async (projId: string) => {
    try {
      const res = await api.get<any>(`/projects/${projId}/activities?limit=50`, { showLoader: false, showErrorToast: false });
      const raw = Array.isArray(res) ? res : (res?.data || []);
      setBackendActivityLogs(raw.map((a: any) => ({
        id: String(a.id || a._id || `${a.action}-${a.timestamp}`),
        action: a.action || "Activity",
        details: a.description || "",
        performedBy: a.performed_by_details?.employee_name || a.performed_by || "System",
        timestamp: a.timestamp ? String(a.timestamp).replace("T", " ").slice(0, 16) : "",
        _backend: true,
      })));
    } catch {
      setBackendActivityLogs([]);
    }
  }, []);
  // F4: backend campaign options (autosuggest source)
  const [dmCampaigns, setDmCampaigns] = useState<string[]>([]);
  const [campSuggestOpen, setCampSuggestOpen] = useState(false);
  // F7: edit existing stat (PUT) vs new (POST)
  const [editingStatId, setEditingStatId] = useState<string | null>(null);
  // F4: backend DM stats → project.dailyStats (replaces local mock)
  const fetchDmStats = useCallback(async (projId: string) => {
    if (!projId) return;
    try {
      const res = await api.get<any[]>(`/projects/${projId}/marketing-stats`, { showLoader: false, showErrorToast: false });
      const list = Array.isArray(res) ? res : [];
      const mapped = list.map((s: any) => ({
        id: String(s.id || s._id),
        date: (String(s.date || "").split("T")[0] ?? ""),
        campaignName: s.campaign_name || "",
        reach: Number(s.reach) || 0,
        impressions: Number(s.impressions) || 0,
        leads: Number(s.leads) || 0,
        followers: Number(s.followers) || 0,
        revenue: Number(s.revenue) || 0,
        spend: Number(s.spend) || 0,
      }));
      setProjects(prev => prev.map(p => (p.id === projId ? { ...p, dailyStats: mapped } : p)));
    } catch {
      // keep existing (offline safe)
    }
  }, []);
  const fetchDmCampaigns = useCallback(async (projId: string) => {
    if (!projId) return;
    try {
      const res = await api.get<string[]>(`/projects/${projId}/marketing-campaigns`, { showLoader: false, showErrorToast: false });
      if (Array.isArray(res) && res.length > 0) setDmCampaigns(res);
    } catch {
      // fallback to local list below
    }
  }, []);
  useEffect(() => {
    if (selectedProjectId) {
      fetchProjectContentCalendar(selectedProjectId);
      fetchProjectFollowups(selectedProjectId);
      fetchProjectActivities(selectedProjectId);
      fetchDmStats(selectedProjectId);
      fetchDmCampaigns(selectedProjectId);
    } else {
      setBackendActivityLogs([]);
    }
  }, [selectedProjectId, fetchProjectContentCalendar, fetchProjectFollowups, fetchProjectActivities, fetchDmStats, fetchDmCampaigns]);
  
  const [campaignDateRange, setCampaignDateRange] = useState("Last 30 Days");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [selectedCampaignForStats, setSelectedCampaignForStats] = useState("All Campaigns");
  // F6: top performing auto (backend summary.top_campaigns)
  // F1+F2: full summary (KPIs + growth, filter-wired) — live leads row
  const [topCampaigns, setTopCampaigns] = useState<any[]>([]);
  const [dmSummary, setDmSummary] = useState<any | null>(null);
  // F8: monthly auto-report (1 month select → full data auto)
  const [reportMonth, setReportMonth] = useState<string>("");
  const [reportData, setReportData] = useState<any | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const fetchMonthlyReport = useCallback(async (projId: string, ym: string) => {
    if (!projId || !/^\d{4}-\d{2}$/.test(ym)) return;
    setReportLoading(true);
    try {
      const [yy, mm] = ym.split("-").map(Number);
      const lastDay = new Date((yy as number), (mm as number), 0).getDate();
      const pad = (n: number) => String(n).padStart(2, "0");
      const qs = `start_date=${yy}-${pad(mm as number)}-01&end_date=${yy}-${pad(mm as number)}-${lastDay}`;
      const res = await api.get<any>(`/projects/${projId}/marketing-summary?${qs}`, { showLoader: false, showErrorToast: false });
      setReportData(res || null);
    } catch {
      setReportData(null);
    } finally {
      setReportLoading(false);
    }
  }, []);
  const fetchMarketingSummary = useCallback(async (projId: string) => {
    if (!projId) return;
    try {
      const params = new URLSearchParams();
      const f = customDateRange?.from ? new Date(customDateRange.from) : null;
      const t = customDateRange?.to ? new Date(customDateRange.to) : null;
      if (f && !isNaN(f.getTime())) params.set("start_date", format(f, "yyyy-MM-dd"));
      if (t && !isNaN(t.getTime())) params.set("end_date", format(t, "yyyy-MM-dd"));
      if (selectedCampaignForStats && selectedCampaignForStats !== "All Campaigns") {
        params.set("campaign_name", selectedCampaignForStats.replace(" (Inactive)", ""));
      }
      const qs = params.toString();
      const res = await api.get<any>(`/projects/${projId}/marketing-summary${qs ? `?${qs}` : ""}`, { showLoader: false, showErrorToast: false });
      setTopCampaigns(Array.isArray(res?.top_campaigns) ? res.top_campaigns : []);
      setDmSummary(res || null);
    } catch {
      setTopCampaigns([]);
      setDmSummary(null);
    }
  }, [customDateRange, selectedCampaignForStats]);
  // F3: revenue log (popup + total)
  const [revenues, setRevenues] = useState<any[]>([]);
  const [isRevenueOpen, setIsRevenueOpen] = useState(false);
  const [revenueForm, setRevenueForm] = useState({ date: "", revenue: "", editId: "" as string });
  const revenueTotal = revenues.reduce((s, r) => s + (Number(r.revenue) || 0), 0);
  const handleSaveRevenue = async () => {
    if (!selectedProjectId) return;
    if (!revenueForm.date || !(parseFloat(revenueForm.revenue) > 0)) {
      toast.error("Date ane revenue (>0) compulsory che");
      return;
    }
    try {
      if (revenueForm.editId) {
        await api.put(`/projects/${selectedProjectId}/daily-revenue/${revenueForm.editId}`, { revenue: parseFloat(revenueForm.revenue) });
        toast.success("Revenue updated!");
      } else {
        await api.post(`/projects/${selectedProjectId}/daily-revenue`, { date: revenueForm.date, revenue: parseFloat(revenueForm.revenue) });
        toast.success("Revenue saved!");
      }
      await fetchRevenues(selectedProjectId);
      setRevenueForm({ date: "", revenue: "", editId: "" });
    } catch (err: any) {
      toast.error(err?.message || "Failed to save revenue");
    }
  };
  const handleDeleteRevenue = async (id: string) => {
    if (!selectedProjectId || !window.confirm("Aa revenue entry delete karvi?")) return;
    try {
      await api.delete(`/projects/${selectedProjectId}/daily-revenue/${id}`, { showErrorToast: false });
      await fetchRevenues(selectedProjectId);
      toast.success("Revenue entry deleted");
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete revenue");
    }
  };
  const fetchRevenues = useCallback(async (projId: string) => {
    if (!projId) return;
    try {
      const res = await api.get<any[]>(`/projects/${projId}/daily-revenue`, { showLoader: false, showErrorToast: false });
      setRevenues(Array.isArray(res) ? res : []);
    } catch {
      setRevenues([]);
    }
  }, []);
  useEffect(() => {
    if (selectedProjectId) fetchMarketingSummary(selectedProjectId);
  }, [selectedProjectId, fetchMarketingSummary]);
  // F3: revenues on project open
  useEffect(() => {
    if (selectedProjectId) fetchRevenues(selectedProjectId);
    else setRevenues([]);
  }, [selectedProjectId, fetchRevenues]);
  // F5: campaign-group open/close (same-name combine → 1 dropdown)
  const [openCampGroups, setOpenCampGroups] = useState<Record<string, boolean>>({});
  const toggleCampGroup = (name: string) => {
    setOpenCampGroups(prev => ({ ...prev, [name]: !(prev[name] !== false) }));
  };
  // K8: project khule tyare timeline default = running range (start → today/end).
  // K16: CC month default = project running cycle month.
  useEffect(() => {
    if (!selectedProjectId) return;
    const p = projects.find(x => x.id === selectedProjectId);
    if (!p?.startDate || !p?.endDate) return;
    const s = new Date(p.startDate);
    const e = new Date(p.endDate);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return;
    const today = new Date();
    setCustomDateRange({ from: s > today ? today : s, to: e < today ? e : today });
    setCampaignDateRange("Custom");
    setCalendarMonthFilter(getProjectMonths(p.startDate, p.endDate, today).def);
    // F8: report month default = running month
    setReportMonth(getProjectMonths(p.startDate, p.endDate, today).def);
  }, [selectedProjectId]);
  // F8: report auto-fetch on month/project change
  useEffect(() => {
    if (selectedProjectId && reportMonth) fetchMonthlyReport(selectedProjectId, reportMonth);
    else setReportData(null);
  }, [selectedProjectId, reportMonth, fetchMonthlyReport]);
  // K18: selected month + range-overlap months na approvals fetch (overlap rule)
  useEffect(() => {
    if (!selectedProjectId) return;
    const wanted = new Map<string, { m: number; y: number }>();
    const pushMonth = (d: Date) => {
      if (isNaN(d.getTime())) return;
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!wanted.has(k)) wanted.set(k, { m: d.getMonth() + 1, y: d.getFullYear() });
    };
    if (/^\d{4}-\d{2}$/.test(calendarMonthFilter)) {
      const [yy, mm] = calendarMonthFilter.split("-").map(Number);
      pushMonth(new Date((yy as number), (mm as number) - 1, 1));
    } else {
      pushMonth(new Date());
    }
    // custom range overlap (max 13 months)
    const f = customDateRange?.from ? new Date(customDateRange.from) : null;
    const t = customDateRange?.to ? new Date(customDateRange.to) : null;
    if (f && t && !isNaN(f.getTime()) && !isNaN(t.getTime())) {
      const cur = new Date(f.getFullYear(), f.getMonth(), 1);
      const last = new Date(t.getFullYear(), t.getMonth(), 1);
      let guard = 0;
      while (cur <= last && guard < 13) {
        pushMonth(new Date(cur));
        cur.setMonth(cur.getMonth() + 1);
        guard++;
      }
    }
    wanted.forEach(({ m, y }) => fetchCcApproval(selectedProjectId, m, y));
  }, [selectedProjectId, calendarMonthFilter, customDateRange, fetchCcApproval]);
  const [isLogDailyStatsOpen, setIsLogDailyStatsOpen] = useState(false);
  const [dailyStatsForm, setDailyStatsForm] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    campaignName: "",
    reach: "",
    impressions: "",
    leads: "",
    followers: "",
    revenue: "",
    spend: ""
  });

  useEffect(() => {
    if (isLogDailyStatsOpen && selectedProjectId) {
      const project = projects.find(p => p.id === selectedProjectId);
      // F4: backend campaigns first, fallback local/mock
      const campaignList = dmCampaigns.length > 0
        ? dmCampaigns
        : (project?.campaigns && project.campaigns.length > 0)
          ? project.campaigns
              .map(c => typeof c === 'string' ? { name: c, status: 'Active' } : { name: c.name || "", status: c.status || 'Active' })
              .filter(c => c.status === 'Active')
              .map(c => c.name)
          : ["Q4 Retargeting Ads", "Holiday Social Push", "B2B Email Drip"];
      const emptyEntry = () => ({ reach: "", impressions: "", leads: "", followers: "", revenue: "", spend: "" });
      const dailyStats = project?.dailyStats || [];
      const initial: any = {};
      campaignList.forEach(name => {
        const match = dailyStats.find((s: any) => s.campaignName === name && s.date === dailyStatsForm.date);
        if (match) {
          const str = (v: any) => (v !== undefined && v !== null ? String(v) : "");
          initial[name] = {
            reach: str(match.reach), impressions: str(match.impressions), leads: str(match.leads),
            followers: str(match.followers), revenue: str(match.revenue), spend: str(match.spend),
          };
        } else {
          initial[name] = emptyEntry();
        }
      });
      setBulkStatsEntries(initial);
    }
  }, [isLogDailyStatsOpen, selectedProjectId, dailyStatsForm.date, dmCampaigns]);

  const numOrZero = (v: any) => {
    const n = parseFloat(v);
    return isNaN(n) || n < 0 ? 0 : n;
  };
  const numOrInt = (v: any) => {
    const n = parseInt(v);
    return isNaN(n) || n < 0 ? 0 : n;
  };

  // F7: edit from table → modal prefill + PUT
  const openEditStat = (stat: any) => {
    setDailyStatsForm({
      date: stat.date || "",
      campaignName: stat.campaignName || "",
      reach: stat.reach !== undefined && stat.reach !== null ? String(stat.reach) : "",
      impressions: stat.impressions !== undefined && stat.impressions !== null ? String(stat.impressions) : "",
      leads: stat.leads !== undefined && stat.leads !== null ? String(stat.leads) : "",
      followers: stat.followers !== undefined && stat.followers !== null ? String(stat.followers) : "",
      revenue: stat.revenue !== undefined && stat.revenue !== null ? String(stat.revenue) : "",
      spend: stat.spend !== undefined && stat.spend !== null ? String(stat.spend) : "",
    });
    setEditingStatId(String(stat.id));
    setIsBulkAdd(false);
    setIsLogDailyStatsOpen(true);
  };

  // F4: backend marketing-stats API (single + bulk) — campaign auto-create free
  const handleLogDailyStats = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) return;

    if (!dailyStatsForm.date) {
      toast.error("Please select a date");
      return;
    }

    try {
      if (isBulkAdd) {
        const entries = Object.entries(bulkStatsEntries)
          .filter(([name, entry]: [string, any]) => name.trim() && (entry.reach || entry.leads || entry.spend || entry.impressions || entry.followers || entry.revenue))
          .map(([campaign_name, entry]: [string, any]) => ({
            campaign_name: campaign_name.trim(),
            reach: numOrInt(entry.reach),
            impressions: numOrInt(entry.impressions),
            leads: numOrInt(entry.leads),
            followers: numOrInt(entry.followers),
            revenue: numOrZero(entry.revenue),
            spend: numOrZero(entry.spend),
          }));

        if (entries.length === 0) {
          toast.error("Please enter stats for at least one campaign.");
          return;
        }

        await api.post(`/projects/${selectedProjectId}/marketing-stats/bulk`, {
          date: dailyStatsForm.date,
          entries,
        });
        toast.success(`Bulk stats logged for ${entries.length} campaigns!`);
      } else {
        const camp = dailyStatsForm.campaignName.trim();
        if (!camp) {
          toast.error("Campaign name lakho (navu hoy to auto-bani jashe)");
          return;
        }
        const body = {
          date: dailyStatsForm.date,
          campaign_name: camp,
          reach: numOrInt(dailyStatsForm.reach),
          impressions: numOrInt(dailyStatsForm.impressions),
          leads: numOrInt(dailyStatsForm.leads),
          followers: numOrInt(dailyStatsForm.followers),
          revenue: numOrZero(dailyStatsForm.revenue),
          spend: numOrZero(dailyStatsForm.spend),
        };
        if (editingStatId) {
          // F7: bhulthi khoti entry → update
          await api.put(`/projects/${selectedProjectId}/marketing-stats/${editingStatId}`, body);
          toast.success("Stats updated successfully!");
        } else {
          await api.post(`/projects/${selectedProjectId}/marketing-stats`, body);
          toast.success("Daily stats logged successfully!");
        }
        setEditingStatId(null);
      }

      await fetchDmStats(selectedProjectId);
      await fetchDmCampaigns(selectedProjectId);
      setIsLogDailyStatsOpen(false);
      setDailyStatsForm({
        date: format(new Date(), "yyyy-MM-dd"),
        campaignName: "",
        reach: "",
        impressions: "",
        leads: "",
        followers: "",
        revenue: "",
        spend: ""
      });
    } catch (err: any) {
      toast.error(err?.message || "Failed to log stats");
    }
  };

  useEffect(() => { localStorage.setItem('hrms_clients', JSON.stringify(clients)); }, [clients]);
  useEffect(() => { localStorage.setItem('hrms_projects', JSON.stringify(projects)); }, [projects]);
  useEffect(() => { localStorage.setItem('hrms_categories', JSON.stringify(categories)); }, [categories]);
  const [isKanbanView, setIsKanbanView] = useState(false);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const saved = (typeof window !== 'undefined' ? localStorage.getItem("hrms_selected_module_id") : null);
      if (saved) return saved;
    }
    return null;
  });

  useEffect(() => {
    if (selectedModuleId) {
      localStorage.setItem("hrms_selected_module_id", selectedModuleId);
    } else {
      localStorage.removeItem("hrms_selected_module_id");
    }
  }, [selectedModuleId]);
  const [addModuleForm, setAddModuleForm] = useState({
    name: "",
    assignedToName: "",
    status: "todo" as "todo" | "in-progress" | "bugs" | "onhold" | "pending" | "completed",
    priority: "medium" as "low" | "medium" | "high" | "urgent",
    estimatedHours: 0,
    dueDate: ""
  });
  const [newModuleTaskTitle, setNewModuleTaskTitle] = useState("");
  const [isAddModuleModalOpen, setIsAddModuleModalOpen] = useState(false);
  const [isEditModuleModalOpen, setIsEditModuleModalOpen] = useState(false);
  const [editModuleForm, setEditModuleForm] = useState({
    id: "",
    name: "",
    assignedToName: "",
    status: "todo" as "todo" | "in-progress" | "bugs" | "onhold" | "pending" | "completed",
    priority: "medium" as "low" | "medium" | "high" | "urgent",
    estimatedHours: 0,
    dueDate: ""
  });
  const [editingModuleTask, setEditingModuleTask] = useState<any>(null);
  const [isModuleTaskModalOpen, setIsModuleTaskModalOpen] = useState(false);
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [isPresetsModalOpen, setIsPresetsModalOpen] = useState(false);
  const [isAddMilestoneModalOpen, setIsAddMilestoneModalOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<any>(null);
  const [milestoneForm, setMilestoneForm] = useState({
    title: "",
    dueDate: "",
    status: "todo" as "todo" | "in-progress" | "completed",
    assignedToName: ""
  });
  const [presets, setPresets] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      const local = (typeof window !== 'undefined' ? localStorage.getItem("hrms_module_presets") : null);
      if (local) return JSON.parse(local);
    }
    return [
      {
        name: "User Authentication Setup",
        description: "Ready-to-use template for user login, OAuth, and biometric verification components.",
        modules: [
          {
            name: "User Authentication",
            assignedToName: "",
            status: "todo",
            priority: "medium",
            estimatedHours: 8,
            dueDate: "",
            tasks: [
              { id: "t-p1", title: "Setup Apple & Google OAuth login flow", status: "todo" },
              { id: "t-p2", title: "Add biometric touch/face ID authentication", status: "todo" },
              { id: "t-p3", title: "Setup SMTP credentials & password reset email flow", status: "todo" }
            ]
          }
        ]
      },
      {
        name: "E-Commerce Core Modules",
        description: "Standard checkout, shopping cart, and Stripe payment gateway components.",
        modules: [
          {
            name: "Shopping Cart",
            assignedToName: "",
            status: "todo",
            priority: "medium",
            estimatedHours: 12,
            dueDate: "",
            tasks: [
              { id: "t-p4", title: "Implement cart persistence in local storage", status: "todo" },
              { id: "t-p5", title: "Create API sync handler for guest items transition", status: "todo" }
            ]
          },
          {
            name: "Payment Gateway Integration",
            assignedToName: "",
            status: "todo",
            priority: "high",
            estimatedHours: 16,
            dueDate: "",
            tasks: [
              { id: "t-p6", title: "Configure Stripe webhooks and signature verification", status: "todo" },
              { id: "t-p7", title: "Request Apple Pay merchant verification certificates", status: "todo" }
            ]
          }
        ]
      },
      {
        name: "Media Upload & Compression",
        description: "Assets uploading, CDN distribution, and video/image transcode processing.",
        modules: [
          {
            name: "Media Management",
            assignedToName: "",
            status: "todo",
            priority: "medium",
            estimatedHours: 10,
            dueDate: "",
            tasks: [
              { id: "t-p8", title: "Configure AWS S3 bucket for assets uploading", status: "todo" },
              { id: "t-p9", title: "Setup CloudFront CDN caching policy distribution", status: "todo" },
              { id: "t-p10", title: "Implement Sharp/FFmpeg media compression handler", status: "todo" }
            ]
          }
        ]
      }
    ];
  });
  
  const [isCreatePresetModalOpen, setIsCreatePresetModalOpen] = useState(false);
  const [newPresetForm, setNewPresetForm] = useState({
    name: "",
    description: "",
    modules: [
      {
        name: "",
        tasks: [""]
      }
    ]
  });

  useEffect(() => {
    localStorage.setItem("hrms_module_presets", JSON.stringify(presets));
  }, [presets]);
  const [addTaskForm, setAddTaskForm] = useState({
    title: "",
    phase: "",
    dueDate: "",
    assignedToName: "",
    status: "todo" as "todo" | "in-progress" | "bugs" | "onhold" | "pending" | "completed",
    reasonForPending: ""
  });
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);
  const [activeClientTab, setActiveClientTab] = useState<ClientTab>('general');
  const clientTabs = [
    { id: 'general', label: 'General Info', icon: User },
    { id: 'company', label: 'Company Details', icon: Building2 },
    { id: 'service', label: 'Service Details', icon: CreditCard },
    { id: 'remarks', label: 'Remarks', icon: FileText }
  ];
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(isNew || false);
  // K9: landing standalone New Project (client picker — client pela, pachhi project)
  const [isLandingProjectOpen, setIsLandingProjectOpen] = useState(false);
  const [landingProjectClientId, setLandingProjectClientId] = useState("");
  const [isEditClientModalOpen, setIsEditClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [showEditClientErrors, setShowEditClientErrors] = useState(false);
  const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState(false);
  
  const defaultClientForm = {
    name: "",
    companyName: "",
    phone: "",
    email: "",
    address: "",
    state: "",
    gstin: "",
    department: "",
    status: "Active" as ClientStatus,
    salesFocused: "",

    remarks: "",
    dailyFollowup: "No",
    assignedEmployeeId: "",
    totalBudget: "",
    outstandingPayment: "",
    onboardingDate: new Date().toISOString().split('T')[0] || "",
  };
  const [newClientFormData, setNewClientFormData] = useState(defaultClientForm);
  
  const handleClientFormChange = (field: string, value: any, isEdit: boolean = false) => {
    if (isEdit) {
      setEditingClient(prev => prev ? { ...prev, [field]: value } : prev);
    } else {
      setNewClientFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const toggleClientDepartment = (dept: string, isEdit: boolean = false) => {
    const currentStr = isEdit ? (editingClient?.department || "") : (newClientFormData.department || "");
    const currentList = parseDepartments(currentStr);
    const nextList = currentList.includes(dept)
      ? currentList.filter(d => d !== dept)
      : [...currentList, dept];
    handleClientFormChange('department', nextList.join(", "), isEdit);
  };
  
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectBudget, setNewProjectBudget] = useState("");
  const [newProjectCategory, setNewProjectCategory] = useState("");
  const [newProjectStartDate, setNewProjectStartDate] = useState(new Date().toISOString().split('T')[0] ?? "");
  const [newProjectEndDate, setNewProjectEndDate] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] ?? "");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [newProjectPriority, setNewProjectPriority] = useState<"Low" | "Medium" | "High" | "Critical">("Medium");
  const [newProjectTeamDeadline, setNewProjectTeamDeadline] = useState("");
  const [newProjectServices, setNewProjectServices] = useState("");
  const [newProjectPost, setNewProjectPost] = useState("");
  const [newProjectReel, setNewProjectReel] = useState("");
  const [newProjectFestivalPost, setNewProjectFestivalPost] = useState("No");
  const [newProjectAmountReceived, setNewProjectAmountReceived] = useState("");
  const [newProjectNextPaymentDate, setNewProjectNextPaymentDate] = useState("");
  const [newProjectReach, setNewProjectReach] = useState("");
  const [newProjectLeads, setNewProjectLeads] = useState("");
  const [newProjectCpl, setNewProjectCpl] = useState("");
  const [activeProjectTab, setActiveProjectTab] = useState<'general' | 'finance' | 'campaigns'>('general');
  const [isManageCategoriesModalOpen, setIsManageCategoriesModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showNewProjectErrors, setShowNewProjectErrors] = useState(false);
  const [showEditProjectErrors, setShowEditProjectErrors] = useState(false);
  const [showNewClientErrors, setShowNewClientErrors] = useState(false);
  const [showCategoryErrors, setShowCategoryErrors] = useState(false);
  const [categoryPendingDelete, setCategoryPendingDelete] = useState<string | null>(null);

  const [confirmModalState, setConfirmModalState] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    itemName?: string;
    action: () => void;
  }>({ isOpen: false, title: "", description: "", action: () => {} });

  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // SMM Content Calendar States
  const [isAddCalendarItemModalOpen, setIsAddCalendarItemModalOpen] = useState(false);
  const [editingCalendarItem, setEditingCalendarItem] = useState<CalendarItem | null>(null);
  const [calendarTypeFilter, setCalendarTypeFilter] = useState("All");
  const [calendarStatusFilter, setCalendarStatusFilter] = useState("All");
  const [activeCalendarTab, setActiveCalendarTab] = useState<'general' | 'production' | 'publishing'>('general');
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [inlineEdit, setInlineEdit] = useState<{ id: string; field: string; value: string } | null>(null);
  
  // Bulk Add States
  const [isBulkAddModalOpen, setIsBulkAddModalOpen] = useState(false);
  const [bulkAddTab, setBulkAddTab] = useState<'range' | 'visual'>('range');
  const [bulkStartDate, setBulkStartDate] = useState("");
  const [bulkEndDate, setBulkEndDate] = useState("");
  const [bulkSelectedDays, setBulkSelectedDays] = useState<number[]>([1, 3, 5]); // default Mon, Wed, Fri
  const [bulkFormatType, setBulkFormatType] = useState("Post");
  const [visualSelectedDates, setVisualSelectedDates] = useState<Date[] | undefined>([]);
  const [dmWorkspaceView, setDmWorkspaceView] = useState<"social" | "stats">("social");
  // K4: dept-wise dropdowns — smm/dm collapsible, project switch par reset (default open).
  const [openDept, setOpenDept] = useState<Record<string, boolean>>({ smm: true, dm: true });
  useEffect(() => {
    setOpenDept({ smm: true, dm: true });
    setExplainMode(false);
    setExplainedIds([]);
  }, [selectedProjectId]);
  // K17: explanation mode (Meet ma samjavva — click = highlight, clear)
  const [explainMode, setExplainMode] = useState(false);
  const [explainedIds, setExplainedIds] = useState<string[]>([]);
  const toggleExplain = (id: string) => {
    setExplainedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  // K6: dept arrow → section open + auto view + scroll
  const jumpToDept = (dept: "smm" | "dm") => {
    setOpenDept(prev => ({ ...prev, [dept]: true }));
    setDmWorkspaceView(dept === "smm" ? "social" : "stats");
    setTimeout(() => {
      document.getElementById(dept === "smm" ? "dept-section-smm" : "dept-section-dm")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };
  // K10: finance payments + followups
  const [projectFollowups, setProjectFollowups] = useState<any[]>([]);
  const [isPayFormOpen, setIsPayFormOpen] = useState(false);
  const [payForm, setPayForm] = useState({ date: "", amount: "", work_from: "", work_to: "", next_reminder: "", note: "", ownerId: "" });
  const [followupText, setFollowupText] = useState("");
  const [followupNextDate, setFollowupNextDate] = useState("");
  // K10 helpers: full-finance PUT (scalars + payments, else $set wipes)
  const parseMoney = (s?: string | number | null) => parseFloat(String(s ?? "").replace(/[^0-9.]/g, "")) || 0;
  const buildFinancePayload = (p: Project) => ({
    project_budget: parseMoney(p.budget),
    amount_received: parseMoney(p.amountReceived),
    next_payment_date: p.nextPaymentDate || undefined,
    payments: (p.payments || []).map(e => ({
      id: e.id,
      date: e.date || undefined,
      amount: e.amount,
      work_from: e.work_from || undefined,
      work_to: e.work_to || undefined,
      next_reminder: e.next_reminder || undefined,
      note: e.note || undefined,
    })),
  });
  const handleSavePayment = async (proj: Project, cliName: string) => {
    if (!payForm.date || !parseMoney(payForm.amount)) {
      toast.error("Date ane amount compulsory che");
      return;
    }
    const entry = {
      id: `pay-${Date.now()}`,
      date: payForm.date,
      amount: parseMoney(payForm.amount),
      work_from: payForm.work_from || "",
      work_to: payForm.work_to || "",
      next_reminder: payForm.next_reminder || "",
      note: payForm.note.trim(),
    };
    const next = [...(proj.payments || []), entry];
    try {
      await api.put(`/projects/${proj.id}`, { finance: { ...buildFinancePayload(proj), payments: next } });
      const period = entry.work_from || entry.work_to ? ` (${entry.work_from || ""}${entry.work_from && entry.work_to ? " → " : ""}${entry.work_to || ""})` : "";
      const rem = entry.next_reminder ? ` • Next: ${entry.next_reminder}` : "";
      await api.post(`/projects/${proj.id}/followups`, { text: `Payment ₹${entry.amount.toLocaleString("en-IN")} on ${entry.date}${period}${rem}` }, { showErrorToast: false }).catch(() => null);
      if (payForm.ownerId && entry.next_reminder) {
        const owner = (employees || []).find(e => String(e.id) === String(payForm.ownerId));
        await api.post("/tasks", {
          title: `Payment followup: ${cliName} — ${entry.next_reminder}`,
          description: `Client payment followup levano: ₹${entry.amount.toLocaleString("en-IN")} (${entry.date})`,
          assigned_to: payForm.ownerId,
          due_date: entry.next_reminder,
          project_id: proj.id,
          task_category: "Finance",
        }, { showErrorToast: false }).catch(() => null);
        if (owner) toast.success(`Follow-up task assigned to ${owner.name}`);
      }
      await loadLiveData();
      fetchProjectFollowups(proj.id);
      setPayForm({ date: "", amount: "", work_from: "", work_to: "", next_reminder: "", note: "", ownerId: "" });
      setIsPayFormOpen(false);
      toast.success("Payment entry saved");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save payment");
    }
  };
  const handleDeletePayment = async (proj: Project, payId: string) => {
    if (!window.confirm("Aa payment entry delete karvi?")) return;
    const next = (proj.payments || []).filter(e => String(e.id) !== String(payId));
    try {
      await api.put(`/projects/${proj.id}`, { finance: { ...buildFinancePayload(proj), payments: next } });
      await loadLiveData();
      toast.success("Payment entry deleted");
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete payment");
    }
  };
  const handleAddFollowup = async (proj: Project) => {
    if (!followupText.trim()) {
      toast.error("Followup text lakho");
      return;
    }
    try {
      const formattedNextDate = followupNextDate ? followupNextDate.split("-").reverse().join("/") : "";
      const text = formattedNextDate ? `${followupText.trim()} (Next: ${formattedNextDate})` : followupText.trim();
      await api.post(`/projects/${proj.id}/followups`, { text });
      setFollowupText("");
      setFollowupNextDate("");
      fetchProjectFollowups(proj.id);
      toast.success("Followup added");
    } catch (err: any) {
      toast.error(err?.message || "Failed to add followup");
    }
  };
  
  const [isCalendarSettingsOpen, setIsCalendarSettingsOpen] = useState(false);
  const [calendarOffsets, setCalendarOffsets] = useState(() => {
    let offsets = { script: 14, shoot: 12, editing: 6, approval: 5 };
    if (typeof window !== 'undefined') {
      try {
        const saved = (typeof window !== 'undefined' ? localStorage.getItem('hrms_calendar_offsets') : null);
        if (saved) offsets = JSON.parse(saved);
      } catch (e) {}
    }
    return offsets;
  });
  
  const defaultCalendarForm = {
    postingDate: new Date().toISOString().split('T')[0],
    postingDay: "",
    type: "Post",
    topic: "",
    concept: "",
    reference: "",
    assignedTo: [] as string[],
    scriptDate: "",
    scriptLink: "",
    shootDate: "",
    shootLink: "",
    editingStart: "",
    finalReelLink: "",
    finalPostLink: "",
    approval: "",
    status: "To Do",
    thumbnailDate: "",
    thumbnailLink: "",
    captionDate: "",
    caption: "",
    postingLinkOfIg: "",
    actualPostingDate: "",
    remark: ""
  };
  const [calendarForm, setCalendarForm] = useState<any>(defaultCalendarForm);

  const handleCreateClient = async () => {
    if (!newClientFormData.name.trim() || !newClientFormData.companyName?.trim() || !newClientFormData.phone?.trim()) {
      setShowNewClientErrors(true);
      toast.error("Please fill all required fields");
      return;
    }

    try {
      const depts = newClientFormData.department
        ? newClientFormData.department.split(",").map(d => d.trim()).filter(Boolean)
        : [];
      
      const payload: any = {
        company_name: newClientFormData.companyName.trim(),
        contact_person_name: newClientFormData.name.trim(),
        phone_number: newClientFormData.phone.trim(),
        email_address: newClientFormData.email?.trim() || undefined,
        address: newClientFormData.address?.trim() || undefined,
        state_ut: newClientFormData.state?.trim() || undefined,
        gstin: newClientFormData.gstin?.trim() || undefined,
        additional_notes: newClientFormData.remarks?.trim() || undefined,
      };
      if (depts.length > 0) {
        payload.service_details = { departments: depts };
      }

      await api.post("/clients", payload);
      await loadLiveData();
      setIsNewClientModalOpen(false);
      setNewClientFormData(defaultClientForm);
      setShowNewClientErrors(false);
      toast.success(depts.length > 0 ? `Client created successfully + ${depts.length} project${depts.length > 1 ? "s" : ""} auto-created` : "Client created successfully");
    } catch (err: any) {
      toast.error(err?.message || "Failed to create client");
    }
  };

  const handleUpdateClient = async () => {
    if (!editingClient || !editingClient.name.trim() || !editingClient.companyName?.trim() || !editingClient.phone?.trim()) {
      setShowEditClientErrors(true);
      toast.error("Please fill all required fields");
      return;
    }

    try {
      const depts = editingClient.department
        ? editingClient.department.split(",").map(d => d.trim()).filter(Boolean)
        : [];

      const payload: any = {
        company_name: editingClient.companyName.trim(),
        contact_person_name: editingClient.name.trim(),
        phone_number: editingClient.phone.trim(),
        email_address: editingClient.email?.trim() || undefined,
        address: editingClient.address?.trim() || undefined,
        state_ut: editingClient.state?.trim() || undefined,
        gstin: editingClient.gstin?.trim() || undefined,
        additional_notes: editingClient.remarks?.trim() || undefined,
      };
      if (depts.length > 0) {
        payload.service_details = { departments: depts };
      }

      await api.put(`/clients/${editingClient.id}`, payload);
      await loadLiveData();
      setIsEditClientModalOpen(false);
      setEditingClient(null);
      setShowEditClientErrors(false);
      toast.success(depts.length > 0 ? `Client updated successfully (${depts.length} dept project${depts.length > 1 ? "s" : ""} synced)` : "Client updated successfully");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update client");
    }
  };

  const handleCreateProject = async () => {
    setShowNewProjectErrors(true);
    // K9: landing context ma selectedClientId null hoy → landing picker vapro
    const effClientId = selectedClientId || landingProjectClientId;
    if (!newProjectName.trim() || !effClientId || !newProjectCategory || !newProjectStartDate || !newProjectEndDate) {
      toast.error("Please fill in all required fields");
      setTimeout(() => setShowNewProjectErrors(false), 3000);
      return;
    }

    try {
      const numBudget = parseFloat(String(newProjectBudget || "").replace(/[^0-9.]/g, "")) || 0;
      const numReceived = parseFloat(String(newProjectAmountReceived || "").replace(/[^0-9.]/g, "")) || 0;
      const numPost = parseInt(String(newProjectPost || "0"), 10) || 0;
      const numReel = parseInt(String(newProjectReel || "0"), 10) || 0;
      const numLeads = parseInt(String(newProjectLeads || "0"), 10) || undefined;
      const numCpl = parseFloat(String(newProjectCpl || "0")) || undefined;

      const payload: any = {
        client_id: effClientId,
        general: {
          project_name: newProjectName.trim(),
          description: newProjectDescription?.trim() || undefined,
          category: newProjectCategory,
          status: "In Progress",
          priority: newProjectPriority || "Medium",
          progress: 0,
          start_date: newProjectStartDate,
          end_date: newProjectEndDate,
          team_deadline: newProjectTeamDeadline || undefined,
          creative_stats: {
            standard_posts: numPost > 0,
            post_count_per_month: numPost,
            reels_videos: numReel > 0,
            reel_count_per_month: numReel,
            festival_posts_included: newProjectFestivalPost === "Yes",
            graphics_banners_required: false,
          },
          digital_marketing_stats: {
            reach_target: newProjectReach?.trim() || undefined,
            leads_target: numLeads,
            cpl: numCpl,
          },
        },
        finance: {
          project_budget: numBudget,
          amount_received: numReceived,
          next_payment_date: newProjectNextPaymentDate || undefined,
        },
        // First period = initial dates
        date_ranges: (newProjectStartDate && newProjectEndDate)
          ? [{ start_date: newProjectStartDate, end_date: newProjectEndDate }]
          : [],
      };

      await api.post("/projects", payload);
      await loadLiveData();

      setNewProjectName("");
      setNewProjectBudget("");
      setNewProjectCategory("");
      setNewProjectDescription("");
      setNewProjectPriority("Medium");
      setNewProjectTeamDeadline("");
      setNewProjectServices("");
      setNewProjectPost("");
      setNewProjectReel("");
      setNewProjectFestivalPost("No");
      setNewProjectAmountReceived("");
      setNewProjectNextPaymentDate("");
      setNewProjectReach("");
      setNewProjectLeads("");
      setNewProjectCpl("");
      setActiveProjectTab('general');
      setShowNewProjectErrors(false);
      setIsNewProjectModalOpen(false);
      setIsLandingProjectOpen(false);
      setLandingProjectClientId("");
      toast.success("Project created successfully!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to create project");
    }
  };

  const openEditModal = (project: Project) => {
    let cat = project.category;
    if (!FIXED_DEPARTMENTS.includes(cat as any)) {
      const c = (cat || "").toLowerCase().replace(/[\s_\-\/]/g, "");
      if (c.includes("marketing")) cat = "Digital Marketing";
      else if (c.includes("sales")) cat = "Sales";
      else if (c.includes("dev")) cat = "Development";
      else cat = "Creative";
    }
    setEditingProject({ ...project, category: cat });
    setActiveProjectTab('general');
    setIsEditProjectModalOpen(true);
  };

  const handleUpdateProject = async () => {
    setShowEditProjectErrors(true);
    if (!editingProject || !editingProject.name.trim() || !editingProject.category || !editingProject.startDate || !editingProject.endDate) {
      toast.error("Please fill in all required fields");
      setTimeout(() => setShowEditProjectErrors(false), 3000);
      return;
    }

    try {
      const numBudget = parseFloat(String(editingProject.budget || "").replace(/[^0-9.]/g, "")) || 0;
      const numReceived = parseFloat(String(editingProject.amountReceived || "").replace(/[^0-9.]/g, "")) || 0;

      const payload: any = {
        general: {
          project_name: editingProject.name.trim(),
          description: editingProject.description?.trim() || undefined,
          category: editingProject.category,
          status: editingProject.status,
          priority: editingProject.priority,
          progress: editingProject.progress,
          start_date: editingProject.startDate,
          end_date: editingProject.endDate,
          creative_stats: {
            post_count_per_month: Number(editingProject.post) || 0,
            reel_count_per_month: Number(editingProject.reel) || 0,
            festival_posts_included: editingProject.festivalPost === "Yes"
          },
          digital_marketing_stats: {
            reach_target: editingProject.reach || "",
            leads_target: editingProject.leads ? Number(String(editingProject.leads).replace(/,/g, "")) || 0 : undefined,
            cpl: editingProject.cpl ? Number(String(editingProject.cpl).replace(/,/g, "")) || 0 : undefined
          }
        },
        // Renewals array (last = default)
        date_ranges: (editingProject.dateRanges || []).filter(r => r.start_date && r.end_date).map(r => ({
          start_date: r.start_date,
          end_date: r.end_date,
          label: r.label || undefined,
        })),
        finance: {
          project_budget: numBudget,
          amount_received: numReceived,
          next_payment_date: editingProject.nextPaymentDate || undefined,
          // K10: keep payment entries (else $set would wipe them)
          payments: (editingProject.payments || []).map(p => ({
            id: p.id,
            date: p.date || undefined,
            amount: p.amount,
            work_from: p.work_from || undefined,
            work_to: p.work_to || undefined,
            next_reminder: p.next_reminder || undefined,
            note: p.note || undefined,
          })),
        },
      };

      const updatedProjectId = editingProject.id;
      const updatedClientId = editingProject.clientId;

      await api.put(`/projects/${updatedProjectId}`, payload);

      // 1. Immediately update project in local state so UI updates without flicker
      setProjects(prev => prev.map(p => {
        if (p.id === updatedProjectId) {
          return {
            ...p,
            name: editingProject.name.trim(),
            description: editingProject.description?.trim() || "",
            category: editingProject.category,
            status: editingProject.status,
            priority: (editingProject.priority || p.priority || "Medium") as "Low" | "Medium" | "High" | "Critical",
            progress: editingProject.progress,
            startDate: editingProject.startDate,
            endDate: editingProject.endDate,
            reach: editingProject.reach,
            leads: editingProject.leads,
            cpl: editingProject.cpl,
            post: Number(editingProject.post) || p.post || 0,
            reel: Number(editingProject.reel) || p.reel || 0,
            budget: editingProject.budget,
            amountReceived: editingProject.amountReceived,
            nextPaymentDate: editingProject.nextPaymentDate,
          };
        }
        return p;
      }));

      // 2. Ensure client is selected if applicable
      if (updatedClientId && !selectedClientId) {
        setSelectedClientId(updatedClientId);
      }

      // 3. Reload live data
      await loadLiveData();

      // 4. Refetch content calendar so Digital Marketing & SMM calendar and scorecard refresh completely
      if (updatedProjectId) {
        await fetchProjectContentCalendar(updatedProjectId);
      }

      setShowEditProjectErrors(false);
      setIsEditProjectModalOpen(false);
      setEditingProject(null);
      setActiveProjectTab('general');
      toast.success("Project updated successfully!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update project");
    }
  };

  const handleAddCategory = () => {
    setShowCategoryErrors(true);
    if (!newCategoryName.trim()) {
      toast.error("Category name cannot be empty");
      setTimeout(() => setShowCategoryErrors(false), 3000);
      return;
    }
    if (newCategoryName.trim() && !categories.includes(newCategoryName.trim())) {
      setCategories([...categories, newCategoryName.trim()]);
      setNewCategoryName("");
      setShowCategoryErrors(false);
    }
  };

  const confirmDeleteCategory = (categoryToDelete: string) => {
    if (LOCKED_CATEGORIES.includes(categoryToDelete)) {
      toast.error(`"${categoryToDelete}" is a system category and cannot be deleted.`);
      return;
    }
    if (categories.length <= 1) {
      toast.error("Cannot delete the last category.");
      return;
    }
    const isCategoryInUse = projects.some(p => p.category === categoryToDelete);
    if (isCategoryInUse) {
      toast.error("Cannot delete — this category is in use by a project.");
      return;
    }
    moveToRecycleBin('Project Category', categoryToDelete, categoryToDelete, 'hrms_categories');
    setCategories(prev => prev.filter(c => c !== categoryToDelete));
    setNewProjectCategory(prev => prev === categoryToDelete ? "" : prev);
    toast.success(`Category "${categoryToDelete}" deleted.`);
  };

  const confirmDeleteProject = (project: Project) => {
    setConfirmModalState({
      isOpen: true,
      title: "Delete Project",
      description: "Are you sure you want to delete this project? All associated data will be permanently removed.",
      itemName: project.name,
      action: async () => {
        try {
          await api.delete(`/projects/${project.id}`);
          moveToRecycleBin('Project', project.name, project, 'hrms_projects');
          await loadLiveData();
          if (selectedProjectId === project.id) {
            setSelectedProjectId(null);
          }
          toast.success(`Project "${project.name}" deleted.`);
        } catch (err: any) {
          toast.error(err?.message || "Failed to delete project");
        }
      }
    });
  };

  const confirmDeleteClient = (client: Client) => {
    setConfirmModalState({
      isOpen: true,
      title: "Delete Client",
      description: "Are you sure you want to delete this client? All associated projects will also be permanently deleted.",
      itemName: client.name,
      action: async () => {
        try {
          await api.delete(`/clients/${client.id}`);
          moveToRecycleBin('Client', client.name, client, 'hrms_clients');
          await loadLiveData();
          if (selectedClientId === client.id) {
            setSelectedClientId(null);
            setSelectedProjectId(null);
          }
          toast.success(`Client "${client.name}" deleted.`);
        } catch (err: any) {
          toast.error(err?.message || "Failed to delete client");
        }
      }
    });
  };


  const archiveClient = async (client: Client) => {
    try {
      await api.patch(`/clients/${client.id}/archive?status=true`);
      await loadLiveData();
      if (selectedClientId === client.id) setSelectedClientId(null);
      toast.success(`Client "${client.name}" archived successfully.`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to archive client");
    }
  };

  const unarchiveClient = async (client: Client) => {
    try {
      await api.patch(`/clients/${client.id}/archive?status=false`);
      await loadLiveData();
      toast.success(`Client "${client.name}" restored to Active.`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to restore client");
    }
  };

  const getStatusColor = (status: ProjectStatus) => {
    switch (status) {
      case "In Progress": return "text-primary bg-primary/10";
      case "In Review": return "text-amber-500 bg-amber-500/10";
      case "Completed": return "text-emerald-500 bg-emerald-500/10";
      case "On Hold": return "text-rose-500 bg-rose-500/10";
      default: return "text-muted-foreground bg-muted";
    }
  };

  const getProgressColor = (status: ProjectStatus) => {
    switch (status) {
      case "In Progress": return "bg-primary";
      case "In Review": return "bg-amber-500";
      case "Completed": return "bg-emerald-500";
      case "On Hold": return "bg-rose-500";
      default: return "bg-primary";
    }
  };

  const safeFormat = (dateStr: string | undefined, fmt: string, fallback = "-") => {
    if (!dateStr) return fallback;
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return fallback;
      return format(d, fmt);
    } catch {
      return fallback;
    }
  };

  const categoryStats = useMemo(() => {
    const stats: Record<string, Set<string>> = {};
    categories.forEach(cat => {
      stats[cat] = new Set();
    });
    projects.forEach(p => {
      if (stats[p.category]) {
        stats[p.category]?.add(p.clientId);
      }
    });
    return categories.map(cat => ({
      category: cat,
      clientCount: stats[cat]?.size || 0
    })).sort((a, b) => b.clientCount - a.clientCount);
  }, [projects, categories]);

  const filteredClients = clients.filter(client => {
    if (activeTab === "Active Clients" && client.status !== "Active") return false;
    if (activeTab === "Archived Clients" && client.status !== "Archived") return false;
    if (searchQuery && !client.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (clientFilterCategories.length > 0) {
      const hasProjectInCategory = projects.some(p => p.clientId === client.id && clientFilterCategories.includes(p.category));
      if (!hasProjectInCategory) return false;
    }
    return true;
  }).sort((a, b) => {
    if (clientSort === "budgetDesc") {
      const budgetA = parseInt(a.totalBudget.replace(/[^0-9]/g, '')) || 0;
      const budgetB = parseInt(b.totalBudget.replace(/[^0-9]/g, '')) || 0;
      return budgetB - budgetA;
    }
    if (clientSort === "projectsDesc") {
      return b.activeProjects - a.activeProjects;
    }
    return a.name.localeCompare(b.name);
  });

  // K1: Projects landing lists. Active = anything not Completed; Archived = Completed.
  // K14: On Hold default neeche (sort last).
  const filteredProjects = projects.filter(project => {
    if (activeTab === "Active Projects" && project.status === "Completed") return false;
    if (activeTab === "Archived Projects" && project.status !== "Completed") return false;
    if (searchQuery && !`${project.name} ${clients.find(c => c.id === project.clientId)?.name || ""}`.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (clientFilterCategories.length > 0 && !clientFilterCategories.includes(project.category)) return false;
    return true;
  }).sort((a, b) => {
    const aHold = a.status === "On Hold" ? 1 : 0;
    const bHold = b.status === "On Hold" ? 1 : 0;
    if (aHold !== bHold) return aHold - bHold;
    return a.name.localeCompare(b.name);
  });

  const currentProject = selectedProjectId ? (projects.find(p => p.id === selectedProjectId) || null) : null;
  const currentClient = (selectedClientId ? clients.find(c => c.id === selectedClientId) : null)
    || (currentProject ? clients.find(c => c.id === currentProject.clientId) : null)
    || (currentProject ? {
        id: currentProject.clientId || "c-default",
        name: "Client",
        logo: "https://api.dicebear.com/7.x/identicon/svg?seed=Client",
        totalBudget: currentProject.budget || "₹0",
        outstandingPayment: "₹0",
        onboardingDate: currentProject.startDate || "",
        activeProjects: 1,
        status: "Active" as ClientStatus,
        contacts: []
      } : null);

  const currentMonthStats = useMemo(() => {
    if (!currentProject) return { targetPosts: 8, targetReels: 8, completedPosts: 0, completedReels: 0, totalTarget: 16, totalCompleted: 0 };
    const targetPosts = currentProject.post || 8;
    const targetReels = currentProject.reel || 8;

    const calendar = currentProject.contentCalendar || [];
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    let filteredCal = calendar;
    if (calendarMonthFilter === "Current") {
      filteredCal = calendar.filter(item => {
        if (!item.postingDate) return false;
        return item.postingDate.startsWith(currentYearMonth);
      });
    } else if (calendarMonthFilter !== "All") {
      filteredCal = calendar.filter(item => {
        if (!item.postingDate) return false;
        return item.postingDate.startsWith(calendarMonthFilter);
      });
    }

    const completedPosts = filteredCal.filter(item =>
      (item.type === "Post" || item.type === "Carousel" || item.type === "Story") &&
      (item.status === "Approved" || item.status === "Published")
    ).length;

    const completedReels = filteredCal.filter(item =>
      item.type === "Reel" &&
      (item.status === "Approved" || item.status === "Published")
    ).length;

    return {
      targetPosts,
      targetReels,
      completedPosts,
      completedReels,
      totalTarget: targetPosts + targetReels,
      totalCompleted: completedPosts + completedReels
    };
  }, [currentProject, calendarMonthFilter]);

  const renderSmmModals = () => {
    const activeProj = assigningProject || currentProject;

    return (
      <>
        {/* 1. Assign Creative Team Modal */}
        {isAssignCreativeTeamModalOpen && (
          <div
            className="fixed inset-0 z-[250] flex items-center justify-center p-3 sm:p-4 md:p-6 animate-in fade-in duration-200"
            onClick={() => {
              setIsAssignCreativeTeamModalOpen(false);
              setAssigningProject(null);
              setOpenRoleId(null);
              setRoleSearchQuery("");
            }}
          >
            <div className="absolute inset-0 bg-black/80 backdrop-blur-xs" />
            <div
              className="relative z-10 w-full max-w-3xl bg-card border border-border/70 rounded-2xl sm:rounded-3xl md:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden max-h-[92vh] sm:max-h-[90vh] animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-5 sm:px-7 md:px-8 py-4 sm:py-5 border-b border-border/50 bg-muted/30 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0 shadow-2xs">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base sm:text-lg md:text-xl font-black tracking-tight text-foreground truncate">
                        Assign Creative Team
                      </h2>
                      <span className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-primary/10 text-primary border border-primary/20 shrink-0">
                        {Object.values(creativeTeamForm).filter(Boolean).length} / {CREATIVE_ROLES.length} Assigned
                      </span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-muted-foreground truncate mt-0.5">
                      {activeProj ? `${activeProj.name} • ` : ""}Pipeline workflow (Scripting → Shoot → Editing → Post → Thumbnail → Approval → Caption → Posting)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsAssignCreativeTeamModalOpen(false);
                    setAssigningProject(null);
                    setOpenRoleId(null);
                    setRoleSearchQuery("");
                  }}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors cursor-pointer shrink-0 ml-2"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Roles Grid Body */}
              <div className="p-4 sm:p-6 md:p-8 space-y-4 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  {CREATIVE_ROLES.map(role => {
                    const selectedEmpId = creativeTeamForm[role.key] || "";
                    const selectedEmp = employees.find(e => String(e.id) === String(selectedEmpId) || String((e as any)._id) === String(selectedEmpId));
                    const isAssigned = !!selectedEmp;

                    return (
                      <div 
                        key={role.key} 
                        className={cn(
                          "p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between gap-3 min-w-0",
                          isAssigned 
                            ? "bg-card border-primary/30 shadow-xs ring-1 ring-primary/10" 
                            : "bg-muted/20 border-border/60 hover:bg-muted/30"
                        )}
                      >
                        {/* Role Details */}
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-primary/10 text-base flex items-center justify-center shrink-0 shadow-2xs">
                            {role.icon}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs sm:text-sm font-bold text-foreground block truncate">{role.label}</span>
                              {isAssigned && (
                                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Role Assigned" />
                              )}
                            </div>
                            <span className="text-[10px] sm:text-[11px] text-muted-foreground block truncate">{role.desc}</span>
                          </div>
                        </div>

                        {/* Modern Styled Dropdown Selector */}
                        <div className="w-full min-w-0">
                          <Popover
                            open={openRoleId === role.key}
                            onOpenChange={(isOpen) => {
                              setOpenRoleId(isOpen ? role.key : null);
                              if (!isOpen) setRoleSearchQuery("");
                            }}
                          >
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className={cn(
                                  "w-full h-10 px-2.5 sm:px-3 rounded-xl border text-xs font-medium transition-all flex items-center justify-between gap-2 outline-none cursor-pointer min-w-0",
                                  isAssigned 
                                    ? "bg-background border-border hover:border-primary/50 text-foreground shadow-2xs" 
                                    : "bg-muted/40 border-dashed border-border/80 hover:border-border text-muted-foreground hover:bg-muted/60"
                                )}
                              >
                                {selectedEmp ? (
                                  <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                                    <UserAvatar name={selectedEmp.name} avatar={selectedEmp.avatar} size="w-6 h-6" />
                                    <span className="font-bold text-foreground text-xs truncate min-w-0 text-left">
                                      {selectedEmp.name}
                                    </span>
                                    {selectedEmp.department && (
                                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground shrink-0 hidden sm:inline-block max-w-[90px] truncate">
                                        {selectedEmp.department}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 min-w-0 flex-1 text-muted-foreground">
                                    <div className="w-6 h-6 rounded-full bg-muted border border-dashed border-border/80 flex items-center justify-center shrink-0">
                                      <User className="w-3 h-3 text-muted-foreground/60" />
                                    </div>
                                    <span className="text-xs truncate">-- Unassigned --</span>
                                  </div>
                                )}

                                <div className="flex items-center gap-1 shrink-0 ml-1">
                                  {isAssigned && (
                                    <span
                                      role="button"
                                      tabIndex={0}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setCreativeTeamForm(prev => ({ ...prev, [role.key]: "" }));
                                      }}
                                      className="p-1 rounded-md text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
                                      title="Unassign"
                                    >
                                      <X className="w-3 h-3" />
                                    </span>
                                  )}
                                  <ChevronDown className={cn(
                                    "w-3.5 h-3.5 text-muted-foreground transition-transform duration-200",
                                    openRoleId === role.key && "rotate-180 text-foreground"
                                  )} />
                                </div>
                              </button>
                            </PopoverTrigger>

                            <PopoverContent
                              align="start"
                              sideOffset={4}
                              collisionPadding={10}
                              className="w-[var(--radix-popover-trigger-width)] min-w-[280px] sm:min-w-[320px] max-w-[360px] p-0 z-[300] rounded-2xl border border-border/80 shadow-2xl bg-popover/98 backdrop-blur-xl overflow-hidden"
                            >
                              <div className="p-2 border-b border-border/50 bg-muted/20">
                                <div className="relative">
                                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                  <input
                                    type="text"
                                    placeholder="Search team member..."
                                    value={roleSearchQuery}
                                    onChange={(e) => setRoleSearchQuery(e.target.value)}
                                    className="w-full pl-8 pr-7 py-1.5 bg-background border border-border/60 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
                                    autoFocus
                                  />
                                  {roleSearchQuery && (
                                    <button
                                      type="button"
                                      onClick={() => setRoleSearchQuery("")}
                                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  )}
                        </div>
                      </div>

                              <div className="max-h-56 overflow-y-auto p-1.5 space-y-0.5">
                                {/* Option: Unassign */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCreativeTeamForm(prev => ({ ...prev, [role.key]: "" }));
                                    setOpenRoleId(null);
                                    setRoleSearchQuery("");
                                  }}
                                  className={cn(
                                    "w-full px-2.5 py-2 rounded-xl text-left text-xs font-semibold flex items-center justify-between gap-2 transition-all cursor-pointer",
                                    !selectedEmpId 
                                      ? "bg-primary/10 text-primary" 
                                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                  )}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-6 h-6 rounded-full bg-muted/60 border border-dashed border-border flex items-center justify-center shrink-0">
                                      <X className="w-3 h-3 text-muted-foreground" />
                                    </div>
                                    <span>-- Unassigned --</span>
                                  </div>
                                  {!selectedEmpId && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                                </button>

                                {/* Filtered Employees */}
                                {employees
                                  .filter(emp => {
                                    if (!roleSearchQuery.trim()) return true;
                                    const q = roleSearchQuery.toLowerCase();
                                    return (
                                      emp.name.toLowerCase().includes(q) ||
                                      (emp.department && emp.department.toLowerCase().includes(q)) ||
                                      (emp.role && emp.role.toLowerCase().includes(q))
                                    );
                                  })
                                  .map(emp => {
                                    const isSelected = String(emp.id) === String(selectedEmpId) || String((emp as any)._id) === String(selectedEmpId);
                                    return (
                                      <button
                                        key={emp.id}
                                        type="button"
                                        onClick={() => {
                                          setCreativeTeamForm(prev => ({ ...prev, [role.key]: emp.id }));
                                          setOpenRoleId(null);
                                          setRoleSearchQuery("");
                                        }}
                                        className={cn(
                                          "w-full px-2.5 py-2 rounded-xl text-left text-xs font-semibold flex items-center justify-between gap-2 transition-all cursor-pointer",
                                          isSelected 
                                            ? "bg-primary/10 text-primary font-bold" 
                                            : "text-foreground hover:bg-muted/80"
                                        )}
                                      >
                                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                          <UserAvatar name={emp.name} avatar={emp.avatar} size="w-6 h-6" />
                                          <div className="min-w-0 flex-1">
                                            <span className="block truncate font-bold text-xs">{emp.name}</span>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                              {emp.department && (
                                                <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-muted text-muted-foreground">
                                                  {emp.department}
                                                </span>
                                              )}
                                              {emp.role && (
                                                <span className="text-[9px] text-muted-foreground/70 truncate">
                                                  {emp.role}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                        {isSelected && (
                                          <div className="w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                                          </div>
                                        )}
                                      </button>
                                    );
                                  })}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-5 sm:px-7 md:px-8 py-3.5 sm:py-4 bg-muted/30 border-t border-border/50 flex flex-wrap items-center justify-between gap-3 mt-auto shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setCreativeTeamForm({
                      scripting: "",
                      shoot_videography: "",
                      reel_editing: "",
                      post_graphics: "",
                      thumbnail: "",
                      approval_qc: "",
                      caption: "",
                      posting_publisher: "",
                    });
                  }}
                  className="text-xs font-semibold text-muted-foreground hover:text-destructive transition-colors cursor-pointer flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-destructive/10"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Unassign All</span>
                </button>

                <div className="flex items-center gap-2.5 sm:gap-3 ml-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAssignCreativeTeamModalOpen(false);
                      setAssigningProject(null);
                      setOpenRoleId(null);
                      setRoleSearchQuery("");
                    }}
                    className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-xs text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSavingCreativeTeam}
                    onClick={() => {
                      const targetProjId = activeProj?.id;
                      if (targetProjId) {
                        handleSaveCreativeTeam(targetProjId, creativeTeamForm);
                      }
                    }}
                    className="px-5 sm:px-6 py-2 sm:py-2.5 bg-primary text-primary-foreground font-bold text-xs rounded-xl shadow-md hover:bg-primary/90 transition-all flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
                  >
                    {isSavingCreativeTeam && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{isSavingCreativeTeam ? "Saving..." : "Save Assignments"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. Pending Brands Modal */}
        {isPendingBrandsModalOpen && (
          <div
            className="fixed inset-0 z-[250] flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={() => setIsPendingBrandsModalOpen(false)}
          >
            <div className="absolute inset-0 bg-black/80 backdrop-blur-xs" />
            <div
              className="relative z-10 w-[calc(100%-2rem)] max-w-[750px] bg-card border border-border/60 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden max-h-[90vh] animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 md:px-8 py-5 border-b border-border/50 bg-amber-500/5 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg md:text-xl font-black tracking-tight">Pending Brands</h2>
                      <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-xs font-black">
                        {pendingProjects.length}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">Active client brands awaiting SMM creative team assignment</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPendingBrandsModalOpen(false)}
                  className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 md:p-8 space-y-3 overflow-y-auto">
                {pendingProjects.length === 0 ? (
                  <div className="text-center py-12 space-y-3">
                    <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-7 h-7" />
                    </div>
                    <h3 className="font-bold text-foreground text-base">All Brands Assigned!</h3>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">Every active project currently has team members assigned to its creative workflow.</p>
                  </div>
                ) : (
                  pendingProjects.map(proj => {
                    const projClient = clients.find(c => c.id === proj.clientId);
                    return (
                      <div key={proj.id} className="p-4 rounded-2xl border border-border/60 bg-card hover:border-amber-500/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                        <div className="flex items-center gap-3.5">
                          <div className="w-12 h-12 rounded-xl border border-border/50 overflow-hidden bg-white p-1 shrink-0">
                            <img src={projClient?.logo || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=80"} alt={proj.name} className="w-full h-full object-cover rounded-lg" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-sm text-foreground">{proj.name}</h4>
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-muted text-muted-foreground border border-border/40">{proj.category}</span>
                            </div>
                            <p className="text-xs text-muted-foreground font-medium mt-0.5">Client: {projClient?.name || "Client"}</p>
                            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold mt-1">⚠️ 0 Creative Roles Assigned</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => {
                              setIsPendingBrandsModalOpen(false);
                              setAssigningProject(proj);
                              setCreativeTeamForm({
                                scripting: proj.creativeTeam?.["scripting"] || "",
                                shoot_videography: proj.creativeTeam?.["shoot_videography"] || "",
                                reel_editing: proj.creativeTeam?.["reel_editing"] || "",
                                post_graphics: proj.creativeTeam?.["post_graphics"] || "",
                                thumbnail: proj.creativeTeam?.["thumbnail"] || "",
                                approval_qc: proj.creativeTeam?.["approval_qc"] || "",
                                caption: proj.creativeTeam?.["caption"] || "",
                                posting_publisher: proj.creativeTeam?.["posting_publisher"] || "",
                              });
                              setIsAssignCreativeTeamModalOpen(true);
                            }}
                            className="px-4 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-xl shadow-sm hover:bg-primary/90 transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <Users className="w-3.5 h-3.5" />
                            <span>Assign Team</span>
                          </button>
                          {projClient && (
                            <button
                              type="button"
                              onClick={() => {
                                setIsPendingBrandsModalOpen(false);
                                setSelectedClientId(projClient.id);
                                setSelectedProjectId(proj.id);
                              }}
                              className="px-3 py-2 bg-card hover:bg-muted border border-border/60 text-foreground font-bold text-xs rounded-xl transition-all cursor-pointer"
                            >
                              Open
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="px-6 md:px-8 py-4 bg-muted/30 border-t border-border/50 flex justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => setIsPendingBrandsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3. Edit Targets Modal */}
        {isEditTargetsModalOpen && (
          <div
            className="fixed inset-0 z-[250] flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={() => setIsEditTargetsModalOpen(false)}
          >
            <div className="absolute inset-0 bg-black/80 backdrop-blur-xs" />
            <div
              className="relative z-10 w-[calc(100%-2rem)] max-w-[450px] bg-card border border-border/60 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden max-h-[90vh] animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 md:px-8 py-5 border-b border-border/50 bg-muted/30 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                    <Sliders className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black tracking-tight">Monthly Delivery Targets</h2>
                    <p className="text-xs text-muted-foreground">Contractual monthly quota agreed with sales team</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditTargetsModalOpen(false)}
                  className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 md:p-8 space-y-5 overflow-y-auto">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-foreground flex items-center gap-2">
                    <span>🖼️</span> Target Posts / Month
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={targetsForm.post}
                    onChange={(e) => setTargetsForm(prev => ({ ...prev, post: parseInt(e.target.value) || 0 }))}
                    className="w-full px-4 py-2.5 bg-muted/40 border border-border/60 rounded-xl text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="e.g. 8"
                  />
                  <p className="text-[11px] text-muted-foreground">Includes Standard Posts, Carousels, and Stories</p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-foreground flex items-center gap-2">
                    <span>🎥</span> Target Reels / Month
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={targetsForm.reel}
                    onChange={(e) => setTargetsForm(prev => ({ ...prev, reel: parseInt(e.target.value) || 0 }))}
                    className="w-full px-4 py-2.5 bg-muted/40 border border-border/60 rounded-xl text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="e.g. 8"
                  />
                  <p className="text-[11px] text-muted-foreground">Short-form video content and produced reels</p>
                </div>
              </div>

              <div className="px-6 md:px-8 py-4 bg-muted/30 border-t border-border/50 flex justify-end gap-3 mt-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setIsEditTargetsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const targetProjId = activeProj?.id;
                    if (targetProjId) {
                      handleSaveTargets(targetProjId, targetsForm.post, targetsForm.reel);
                    }
                  }}
                  className="px-6 py-2.5 bg-primary text-primary-foreground font-bold text-xs rounded-xl shadow-md hover:bg-primary/90 transition-all cursor-pointer"
                >
                  Save Targets
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 4. WhatsApp Link Modal */}
        {isWhatsappModalOpen && (
          <div
            className="fixed inset-0 z-[250] flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={() => setIsWhatsappModalOpen(false)}
          >
            <div className="absolute inset-0 bg-black/80 backdrop-blur-xs" />
            <div
              className="relative z-10 w-[calc(100%-2rem)] max-w-[480px] bg-card border border-border/60 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden max-h-[90vh] animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 md:px-8 py-5 border-b border-border/50 bg-emerald-500/5 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black tracking-tight">WhatsApp Group Link</h2>
                    <p className="text-xs text-muted-foreground">Direct link to client WhatsApp group for fast communication</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsWhatsappModalOpen(false)}
                  className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 md:p-8 space-y-4 overflow-y-auto">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-foreground">WhatsApp Group Invite Link</label>
                  <input
                    type="url"
                    value={whatsappLinkInput}
                    onChange={(e) => setWhatsappLinkInput(e.target.value)}
                    placeholder="https://chat.whatsapp.com/..."
                    className="w-full px-4 py-2.5 bg-muted/40 border border-border/60 rounded-xl text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <p className="text-[11px] text-muted-foreground">Copy the invite link from WhatsApp: Group Info → Invite via link</p>
                </div>

                {whatsappLinkInput && (
                  <a
                    href={whatsappLinkInput}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:underline"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Test link (Open in new tab)</span>
                  </a>
                )}
              </div>

              <div className="px-6 md:px-8 py-4 bg-muted/30 border-t border-border/50 flex justify-end gap-3 mt-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setIsWhatsappModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const targetProjId = activeProj?.id;
                    if (targetProjId) {
                      handleSaveWhatsAppLink(targetProjId, whatsappLinkInput);
                    }
                  }}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                >
                  Save WhatsApp Link
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 5. Client Credentials Modal */}
        {isCredentialsModalOpen && (
          <div
            className="fixed inset-0 z-[250] flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={() => setIsCredentialsModalOpen(false)}
          >
            <div className="absolute inset-0 bg-black/80 backdrop-blur-xs" />
            <div
              className="relative z-10 w-[calc(100%-1.5rem)] sm:w-[calc(100%-2rem)] max-w-[650px] bg-card border border-border/70 rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh] animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 sm:px-8 py-4 sm:py-5 border-b border-border/50 bg-amber-500/5 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold shadow-2xs">
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-black tracking-tight text-foreground">Social Media & Client Credentials</h2>
                    <p className="text-xs text-muted-foreground">Secure credentials for posting, ads manager, and account access</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCredentialsModalOpen(false)}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

            <div className="p-4 sm:p-6 md:p-8 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Credentials List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Saved Accounts</h4>
                  {((activeProj?.credentials || []).length > 0) && (
                    <span className="text-[11px] font-bold text-muted-foreground">
                      {(activeProj?.credentials || []).length} accounts saved
                    </span>
                  )}
                </div>
                {((activeProj?.credentials || []).length === 0) ? (
                  <div className="p-6 rounded-2xl border border-dashed border-border/60 text-center text-xs text-muted-foreground bg-muted/10">
                    No credentials saved yet for this project. Add one below.
                  </div>
                ) : (
                  (activeProj?.credentials || []).map((cred: any, idx: number) => {
                    const isRevealed = !!showPasswordMap[idx];
                    const pMeta = CREDENTIAL_PLATFORMS.find(p => p.value === cred.platform || p.label === cred.platform);

                    return (
                      <div key={idx} className="p-3.5 sm:p-4 rounded-2xl border border-border/60 bg-muted/20 hover:bg-muted/40 transition-all space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border shadow-2xs", pMeta ? pMeta.color : "bg-primary/10 text-primary border-primary/20")}>
                            <span>{pMeta?.icon || "🔑"}</span>
                            <span>{pMeta?.label || cred.platform}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const targetProjId = activeProj?.id;
                              if (targetProjId) {
                                const updated = (activeProj?.credentials || []).filter((_: any, i: number) => i !== idx);
                                handleSaveCredentials(targetProjId, updated);
                              }
                            }}
                            className="p-1.5 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                            title="Delete Credential"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          <div className="flex items-center justify-between p-2.5 rounded-xl bg-card border border-border/50 shadow-2xs">
                            <span className="font-mono text-foreground truncate mr-2 font-medium">{cred.username}</span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(cred.username);
                                toast.success("Username copied!");
                              }}
                              className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                              title="Copy Username"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="flex items-center justify-between p-2.5 rounded-xl bg-card border border-border/50 shadow-2xs">
                            <span className="font-mono text-foreground truncate mr-2 font-medium">
                              {isRevealed ? cred.password : "••••••••••••"}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => setShowPasswordMap(prev => ({ ...prev, [idx]: !prev[idx] }))}
                                className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground cursor-pointer"
                                title={isRevealed ? "Hide Password" : "Show Password"}
                              >
                                {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(cred.password);
                                  toast.success("Password copied!");
                                }}
                                className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground cursor-pointer"
                                title="Copy Password"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {cred.notes && (
                          <p className="text-[11px] text-muted-foreground italic px-1">Note: {cred.notes}</p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Add New Credential Form */}
              <div className="p-4 sm:p-5 rounded-2xl border border-border/60 bg-muted/30 space-y-3.5">
                <h4 className="text-xs font-bold text-foreground">Add New Credential</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-muted-foreground">Platform <span className="text-destructive font-black">*</span></label>
                    <Select
                      value={newCredentialForm.platform}
                      onValueChange={(val) => setNewCredentialForm(prev => ({ ...prev, platform: val }))}
                    >
                      <SelectTrigger className="w-full h-10 px-3 bg-card border border-border/60 hover:border-primary/50 rounded-xl text-xs font-semibold text-foreground focus:ring-2 focus:ring-primary/20 transition-all shadow-xs cursor-pointer">
                        <SelectValue placeholder="Select Platform">
                          {(() => {
                            const selected = CREDENTIAL_PLATFORMS.find(p => p.value === newCredentialForm.platform);
                            if (!selected) return newCredentialForm.platform || "Select Platform";
                            return (
                              <div className="flex items-center gap-2">
                                <span className={cn("w-5 h-5 rounded-md flex items-center justify-center text-xs shrink-0", selected.color)}>
                                  {selected.icon}
                                </span>
                                <span className="font-bold text-foreground truncate">{selected.label}</span>
                              </div>
                            );
                          })()}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="z-[300] rounded-2xl border border-border/80 shadow-2xl bg-popover/98 backdrop-blur-xl p-1.5 min-w-[220px]">
                        {CREDENTIAL_PLATFORMS.map(p => (
                          <SelectItem
                            key={p.value}
                            value={p.value}
                            className="rounded-xl py-2 px-2.5 text-xs font-semibold hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <span className={cn("w-5 h-5 rounded-md flex items-center justify-center text-xs shrink-0", p.color)}>
                                {p.icon}
                              </span>
                              <span>{p.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {newCredentialForm.platform === "Other" && (
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-[11px] font-bold text-muted-foreground">
                        Platform / Service Name <span className="text-destructive font-black">*</span>
                      </label>
                      <input
                        type="text"
                        value={newCredentialForm.customPlatform || ""}
                        onChange={(e) => setNewCredentialForm(prev => ({ ...prev, customPlatform: e.target.value }))}
                        placeholder="e.g. Hostinger, Figma, AWS, Pinterest, Shopify"
                        className="w-full h-10 px-3 bg-card border border-border/60 rounded-xl text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-muted-foreground">Username / Handle / Email <span className="text-destructive font-black">*</span></label>
                    <input
                      type="text"
                      value={newCredentialForm.username}
                      onChange={(e) => setNewCredentialForm(prev => ({ ...prev, username: e.target.value }))}
                      placeholder="e.g. @brand_handle"
                      className="w-full h-10 px-3 bg-card border border-border/60 rounded-xl text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-muted-foreground">Password <span className="text-destructive font-black">*</span></label>
                    <input
                      type="text"
                      value={newCredentialForm.password}
                      onChange={(e) => setNewCredentialForm(prev => ({ ...prev, password: e.target.value }))}
                      placeholder="Enter password"
                      className="w-full h-10 px-3 bg-card border border-border/60 rounded-xl text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-muted-foreground">Notes / 2FA info</label>
                    <input
                      type="text"
                      value={newCredentialForm.notes}
                      onChange={(e) => setNewCredentialForm(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="e.g. 2FA with client phone"
                      className="w-full h-10 px-3 bg-card border border-border/60 rounded-xl text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (newCredentialForm.platform === "Other" && !newCredentialForm.customPlatform?.trim()) {
                        toast.error("Please enter platform / service name");
                        return;
                      }
                      if (!newCredentialForm.username.trim() || !newCredentialForm.password.trim()) {
                        toast.error("Please enter username and password");
                        return;
                      }
                      const targetProjId = activeProj?.id;
                      if (!targetProjId) return;

                      const finalPlatform = newCredentialForm.platform === "Other"
                        ? newCredentialForm.customPlatform?.trim() || "Other"
                        : newCredentialForm.platform;

                      const updated = [
                        ...(activeProj?.credentials || []),
                        {
                          ...newCredentialForm,
                          platform: finalPlatform
                        }
                      ];
                      handleSaveCredentials(targetProjId, updated);
                      setNewCredentialForm({ platform: "Instagram", customPlatform: "", username: "", password: "", notes: "" });
                    }}
                    className="px-4 py-2.5 bg-primary text-primary-foreground font-bold text-xs rounded-xl shadow-sm hover:bg-primary/90 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Credential</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="px-5 sm:px-8 py-3.5 sm:py-4 bg-muted/30 border-t border-border/50 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setIsCredentialsModalOpen(false)}
                className="px-5 py-2.5 rounded-xl font-bold text-xs text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      </>
    );
  };

  if (currentClient) {
    const client = currentClient;

    if (selectedProjectId && currentProject) {
      const project = currentProject;

      return (
        <>
          <div className="w-full space-y-8 animate-in fade-in duration-500">
          {/* Detail View Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setSelectedProjectId(null)}
                className="p-2.5 bg-card border border-border/60 rounded-xl hover:bg-muted/80 hover:text-primary transition-colors shadow-sm group"
              >
                <ArrowLeft className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
              {/* K5: highlighted client logo — project ni odakh logo uparthi */}
              <BrandLogo src={client.logo} alt={client.name} size="w-20 h-20" />
              <div>
                <h1 className="text-3xl font-black tracking-tight text-foreground leading-tight">{project.name}</h1>
                <div className="flex items-center gap-2 mt-2">
                  <span className={cn("px-2 py-0.5 inline-flex text-[10px] font-bold uppercase tracking-widest rounded-lg items-center gap-1.5", getStatusColor(project.status))}>
                    <Circle className="w-1.5 h-1.5 fill-current" />
                    {project.status}
                  </span>
                  <span className="px-2 py-0.5 inline-flex text-[10px] font-bold uppercase tracking-widest rounded-lg items-center gap-1.5 bg-muted text-muted-foreground border border-border/50">
                    <Briefcase className="w-3 h-3" />
                    {project.category || "General"}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              {/* WhatsApp Group Link */}
              <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-1 shadow-sm">
                <button
                  type="button"
                  onClick={() => {
                    if (project.whatsapp_group_link) {
                      window.open(project.whatsapp_group_link, '_blank');
                    } else {
                      setWhatsappLinkInput("");
                      setIsWhatsappModalOpen(true);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 transition-colors"
                  title={project.whatsapp_group_link ? "Open WhatsApp Group (Go to Group)" : "Set WhatsApp Group Link"}
                >
                  <MessageSquare className="w-4 h-4 text-emerald-600 fill-emerald-500/20" />
                  <span>{project.whatsapp_group_link ? "Go to Group" : "Set WhatsApp"}</span>
                  {project.whatsapp_group_link && <ExternalLink className="w-3 h-3 text-emerald-500 ml-0.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWhatsappLinkInput(project.whatsapp_group_link || "");
                    setIsWhatsappModalOpen(true);
                  }}
                  className="p-1.5 hover:bg-emerald-500/20 text-emerald-600 rounded-lg transition-colors"
                  title="Edit WhatsApp Group Link"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              </div>

              {/* Client Credentials */}
              <button
                type="button"
                onClick={() => setIsCredentialsModalOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2 bg-card hover:bg-muted border border-border/60 text-foreground font-bold text-xs rounded-xl transition-all shadow-sm"
                title="Client Social Media & System Credentials"
              >
                <Key className="w-3.5 h-3.5 text-amber-500" />
                <span>Credentials</span>
                {((project.credentials || []).length > 0) && (
                  <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-600 border border-amber-500/20 rounded-full text-[10px] font-mono font-black">
                    {(project.credentials || []).length}
                  </span>
                )}
              </button>

              {/* K6: dept arrows — click = auto dept view + scroll */}
              {isSocialMediaCategory(project.category) && (
                <button
                  type="button"
                  onClick={() => jumpToDept("smm")}
                  className="flex items-center gap-2 px-3.5 py-2 bg-card hover:bg-muted border border-border/60 text-foreground font-bold text-xs rounded-xl transition-all shadow-sm"
                  title="Go to Social Media (SMM) section"
                >
                  <span>📱</span>
                  <span>SMM</span>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              )}
              {isMarketingCategory(project.category) && (
                <button
                  type="button"
                  onClick={() => jumpToDept("dm")}
                  className="flex items-center gap-2 px-3.5 py-2 bg-card hover:bg-muted border border-border/60 text-foreground font-bold text-xs rounded-xl transition-all shadow-sm"
                  title="Go to Digital Marketing section"
                >
                  <span>📈</span>
                  <span>DM</span>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              )}

              {/* Assign Creative Team */}
              <button
                type="button"
                onClick={() => {
                  setAssigningProject(project);
                  setCreativeTeamForm({
                    scripting: project.creativeTeam?.["scripting"] || "",
                    shoot_videography: project.creativeTeam?.["shoot_videography"] || "",
                    reel_editing: project.creativeTeam?.["reel_editing"] || "",
                    post_graphics: project.creativeTeam?.["post_graphics"] || "",
                    thumbnail: project.creativeTeam?.["thumbnail"] || "",
                    approval_qc: project.creativeTeam?.["approval_qc"] || "",
                    caption: project.creativeTeam?.["caption"] || "",
                    posting_publisher: project.creativeTeam?.["posting_publisher"] || "",
                  });
                  setIsAssignCreativeTeamModalOpen(true);
                }}
                className="flex items-center gap-2 px-3.5 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 font-bold text-xs rounded-xl transition-all shadow-sm"
                title="Assign Creative Team Roles"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Creative Team</span>
              </button>

              <button 
                type="button"
                onClick={() => openEditModal(project)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-xl hover:bg-primary/90 transition-all shadow-sm"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Edit</span>
              </button>
            </div>
          </div>

          {/* K13: Quick Links — brand na badha shortcuts ek j jagyae (go-to) */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-black text-muted-foreground uppercase tracking-widest mr-1">Quick Links:</span>
            {project.whatsapp_group_link ? (
              <button
                type="button"
                onClick={() => window.open(project.whatsapp_group_link, "_blank")}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-700 font-bold text-xs rounded-full transition-colors"
                title="WhatsApp group kholo"
              >
                <MessageSquare className="w-3.5 h-3.5" /> WhatsApp Group <ExternalLink className="w-3 h-3" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => { setWhatsappLinkInput(""); setIsWhatsappModalOpen(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-muted/70 border border-border/50 text-muted-foreground font-bold text-xs rounded-full transition-colors"
                title="Set WhatsApp group link"
              >
                <MessageSquare className="w-3.5 h-3.5" /> Set WhatsApp
              </button>
            )}
            <button
              type="button"
              onClick={() => document.getElementById("finance-section")?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-card hover:bg-muted border border-border/60 text-foreground font-bold text-xs rounded-full transition-colors shadow-sm"
              title="Go to Finance & follow-ups"
            >
              ➦ Followups
            </button>
            <button
              type="button"
              onClick={() => { setProjectSubTab("logs"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-card hover:bg-muted border border-border/60 text-foreground font-bold text-xs rounded-full transition-colors shadow-sm"
              title="View activity logs"
            >
              📋 Logs
            </button>
            <button
              type="button"
              onClick={() => setIsCredentialsModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-card hover:bg-muted border border-border/60 text-foreground font-bold text-xs rounded-full transition-colors shadow-sm"
              title="Credentials kholo"
            >
              <Key className="w-3.5 h-3.5 text-amber-500" /> Credentials
              {((project.credentials || []).length > 0) && (
                <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-600 rounded-full text-[10px] font-black">{(project.credentials || []).length}</span>
              )}
            </button>
          </div>

          {/* Top Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-card border border-border/60 rounded-3xl p-6 shadow-sm">
               {(() => {
                 // K8: start–end dates lakheli + eni pramane % (date-driven progress)
                 const dp = getDateProgress(project.startDate, project.endDate);
                 const pct = dp ? dp.pct : (project.progress || 0);
                 return (
                   <>
                     <div className="flex justify-between items-end mb-2">
                       <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Progress</span>
                       <span className="text-3xl font-black text-foreground font-mono">{pct}%</span>
                     </div>
                     {dp && (
                       <p className="text-[11px] font-bold text-muted-foreground">
                         {safeFormat(project.startDate, "dd/MM/yyyy")} → {safeFormat(project.endDate, "dd/MM/yyyy")} • {dp.elapsed}/{dp.total} days
                       </p>
                     )}
                     <div className="h-2 w-full bg-muted/60 rounded-full overflow-hidden mt-4">
                       <div
                         className={cn("h-full rounded-full transition-all duration-1000 ease-out", getProgressColor(project.status))}
                         style={{ width: `${pct}%` }}
                       ></div>
                     </div>
                   </>
                 );
               })()}
             </div>
            
            {/* F3: Revenue total instead of Budget (transcript: budget is not needed) */}
            <div className="bg-card border border-border/60 rounded-3xl p-6 flex items-center gap-5 shadow-sm">
              <button
                type="button"
                onClick={() => { setRevenueForm({ date: "", revenue: "", editId: "" }); setIsRevenueOpen(true); }}
                className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 hover:bg-emerald-500/20 transition-colors"
                title="Revenue log kholo"
              >
                <IndianRupee className="w-6 h-6" />
              </button>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Total Revenue</p>
                <h3 className="text-3xl font-black text-emerald-600 font-mono">₹{revenueTotal.toLocaleString("en-IN")}</h3>
              </div>
            </div>
            
            <div className="bg-card border border-border/60 rounded-3xl p-6 flex items-center gap-5 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Timeline</p>
                <h3 className="text-sm font-black text-foreground">{safeFormat(project.startDate, "dd/MM/yyyy")} - {safeFormat(project.endDate, "dd/MM/yyyy")}</h3>
                {(() => {
                  const dp = getDateProgress(project.startDate, project.endDate);
                  return dp ? (
                    <p className="text-[11px] font-bold text-primary mt-1">{dp.total} days • {dp.elapsed} elapsed</p>
                  ) : null;
                })()}
                {/* Renewals: month-wise periods (reporting mate) */}
                {(project.dateRanges || []).length > 1 && (
                  <div className="mt-2 space-y-1 border-t border-border/40 pt-2">
                    {project.dateRanges!.map((r, i) => (
                      <p key={i} className="text-[10px] font-bold text-muted-foreground font-mono">
                        #{i + 1} {safeFormat(r.start_date, "dd/MM/yyyy")} → {safeFormat(r.end_date, "dd/MM/yyyy")}
                        {i === project.dateRanges!.length - 1 && <span className="text-emerald-600 ml-1">• current</span>}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* K10: Finance & Payments — date, amount, work period, next reminder + followups */}
          <div id="finance-section" className="bg-card border border-border/60 rounded-3xl p-6 shadow-sm scroll-mt-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                  <IndianRupee className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">Finance & Payments</h3>
                  <p className="text-[11px] text-muted-foreground font-medium">
                    Total received: ₹{((project.payments || []).reduce((s, e) => s + (Number(e.amount) || 0), 0)).toLocaleString("en-IN")} • {(project.payments || []).length} entries
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPayFormOpen(v => !v)}
                className="px-4 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-xl hover:bg-primary/90 transition-all shadow-sm"
              >
                {isPayFormOpen ? "Close" : "+ Add Payment"}
              </button>
            </div>

            {/* Payment entries */}
            <div className="space-y-2 mb-4">
              {(project.payments || []).length === 0 && (
                <p className="text-xs font-semibold text-muted-foreground/60 border border-dashed border-border/40 rounded-2xl px-4 py-3 text-center">No payment entries yet.</p>
              )}
              {(project.payments || []).map(e => (
                <div key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 rounded-2xl border border-border/40 bg-muted/20 text-xs">
                  <span className="font-mono font-bold text-foreground">{e.date || "—"}</span>
                  <span className="font-black text-emerald-600 font-mono">₹{(Number(e.amount) || 0).toLocaleString("en-IN")}</span>
                  {(e.work_from || e.work_to) && (
                    <span className="font-semibold text-muted-foreground">Work: {e.work_from || ""}{e.work_from && e.work_to ? " → " : ""}{e.work_to || ""}</span>
                  )}
                  {e.next_reminder && (
                    <span className="font-bold text-amber-600">Next: {e.next_reminder}</span>
                  )}
                  {e.note && <span className="text-muted-foreground truncate max-w-[220px]" title={e.note}>{e.note}</span>}
                  <button type="button" onClick={() => handleDeletePayment(project, e.id)} className="ml-auto p-1 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition-colors" title="Delete entry">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add payment form */}
            {isPayFormOpen && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 rounded-2xl bg-muted/30 border border-border/40 mb-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Date *</label>
                  <DatePicker value={payForm.date} onChange={(val) => setPayForm({ ...payForm, date: val })} placeholder="Select date" className="w-full h-10 bg-background border-border rounded-xl text-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Amount *</label>
                  <input type="number" min="0" value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })} placeholder="e.g. 50000" className="w-full px-3 h-10 bg-background border border-border rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Work From</label>
                  <DatePicker value={payForm.work_from} onChange={(val) => setPayForm({ ...payForm, work_from: val })} placeholder="Select date" className="w-full h-10 bg-background border-border rounded-xl text-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Work To</label>
                  <DatePicker value={payForm.work_to} onChange={(val) => setPayForm({ ...payForm, work_to: val })} placeholder="Select date" className="w-full h-10 bg-background border-border rounded-xl text-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Next Reminder</label>
                  <DatePicker value={payForm.next_reminder} onChange={(val) => setPayForm({ ...payForm, next_reminder: val })} placeholder="Select date" className="w-full h-10 bg-background border-border rounded-xl text-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Responsibility (auto-task)</label>
                  <select value={payForm.ownerId} onChange={e => setPayForm({ ...payForm, ownerId: e.target.value })} className="w-full px-3 h-10 bg-background border border-border rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20">
                    <option value="">Select...</option>
                    {(employees || []).map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1 col-span-2 md:col-span-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Note</label>
                  <input type="text" value={payForm.note} onChange={e => setPayForm({ ...payForm, note: e.target.value })} placeholder="Optional" className="w-full px-3 h-10 bg-background border border-border rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div className="flex items-end col-span-2 md:col-span-1">
                  <button type="button" onClick={() => handleSavePayment(project, client.name)} className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors shadow-sm">
                    Save Payment
                  </button>
                </div>
              </div>
            )}

            {/* Followups: recent + quick add (text + next date) */}
            <div className="border-t border-border/40 pt-4">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Followups {projectFollowups.length > 0 && `(${projectFollowups.length})`}</p>
              <div className="space-y-1.5 mb-3 max-h-32 overflow-y-auto pr-1">
                {projectFollowups.length === 0 && (
                  <p className="text-[11px] text-muted-foreground/60 font-medium">No follow-ups yet.</p>
                )}
                {projectFollowups.slice(0, 5).map((f: any, i: number) => {
                  const rawDate = f.created_at ? String(f.created_at).split("T")[0] : "";
                  const formattedDate = rawDate ? rawDate.split("-").reverse().join("/") : "";
                  return (
                    <p key={f.id || i} className="text-xs text-foreground bg-muted/30 border border-border/30 rounded-xl px-3 py-1.5 flex items-center justify-between">
                      <span className="font-bold">{f.text}</span>
                      {formattedDate && <span className="text-muted-foreground font-mono text-[10px] ml-2 shrink-0">{formattedDate}</span>}
                    </p>
                  );
                })}
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={followupText}
                  onChange={e => setFollowupText(e.target.value)}
                  placeholder="Followup text lakho..."
                  className="flex-1 px-3 h-10 bg-background border border-border rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <DatePicker
                  value={followupNextDate}
                  onChange={(val) => setFollowupNextDate(val)}
                  placeholder="Next date"
                  className="h-10 bg-background border-border rounded-xl text-xs font-medium sm:w-[160px]"
                />
                <button type="button" onClick={() => handleAddFollowup(project)} className="px-4 h-10 bg-primary text-primary-foreground font-bold text-xs rounded-xl hover:bg-primary/90 transition-colors shrink-0">
                  + Followup
                </button>
              </div>
            </div>
          </div>

          {/* Creative Team Allocation Strip */}
          <div className="bg-card/70 border border-border/50 rounded-2xl p-4 shadow-sm backdrop-blur-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 pb-2 border-b border-border/40">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-foreground uppercase tracking-wider">Creative Team Allocation</h3>
                  <p className="text-[10px] text-muted-foreground">Pipeline roles assigned to brand members</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAssigningProject(project);
                  setCreativeTeamForm({
                    scripting: project.creativeTeam?.["scripting"] || "",
                    shoot_videography: project.creativeTeam?.["shoot_videography"] || "",
                    reel_editing: project.creativeTeam?.["reel_editing"] || "",
                    post_graphics: project.creativeTeam?.["post_graphics"] || "",
                    thumbnail: project.creativeTeam?.["thumbnail"] || "",
                    approval_qc: project.creativeTeam?.["approval_qc"] || "",
                    caption: project.creativeTeam?.["caption"] || "",
                    posting_publisher: project.creativeTeam?.["posting_publisher"] || "",
                  });
                  setIsAssignCreativeTeamModalOpen(true);
                }}
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1.5 self-start sm:self-auto"
              >
                <Edit2 className="w-3 h-3" /> Reassign Roles
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
              {CREATIVE_ROLES.map(role => {
                const assignedId = project.creativeTeam?.[role.key];
                const detail = project.creativeTeamDetails?.[role.key];
                const emp = assignedId ? employees.find(e => String(e.id) === String(assignedId) || String((e as any)._id) === String(assignedId)) : null;
                const memberName = emp?.name || detail?.employee_name || (assignedId ? "Assigned" : "Unassigned");
                const isAssigned = !!assignedId || !!detail?.employee_name;

                return (
                  <div key={role.key} className={cn("p-2.5 rounded-xl border text-left transition-all", isAssigned ? "bg-muted/30 border-border/60" : "bg-muted/10 border-dashed border-border/40 opacity-70")}>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground mb-1 truncate">
                      <span>{role.icon}</span>
                      <span className="truncate">{role.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                      {isAssigned && (
                        <UserAvatar name={memberName} avatar={emp?.avatar} size="w-5 h-5" />
                      )}
                      <span className={cn("text-xs font-black truncate min-w-0", isAssigned ? "text-foreground" : "text-muted-foreground/60 italic text-[11px]")}>
                        {memberName}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sub-tab Bar */}
          <div className="flex gap-2 border-b border-border/40 pb-2 overflow-x-auto hide-scrollbar">
            <button
              onClick={() => setProjectSubTab("workspace")}
              className={cn(
                "px-5 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-all duration-300",
                projectSubTab === "workspace" 
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" 
                  : "bg-card text-foreground/70 hover:bg-muted/80 border border-border/40"
              )}
            >
              💼 Workspace
            </button>
            <button
              onClick={() => setProjectSubTab("logs")}
              className={cn(
                "px-5 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-all duration-300",
                projectSubTab === "logs" 
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" 
                  : "bg-card text-foreground/70 hover:bg-muted/80 border border-border/40"
              )}
            >
              📋 Activity Logs
            </button>
          </div>

          {projectSubTab === "logs" ? (
            <div className="bg-card border border-border/60 rounded-[2.5rem] p-6 md:p-8 shadow-sm space-y-6">
              <div className="flex justify-between items-center border-b border-border/40 pb-4">
                <div>
                  <h3 className="text-lg font-black tracking-tight text-foreground">Project Activity Logs</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Chronological record of all actions performed inside this project</p>
                </div>
              </div>
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                {(() => {
                  // K11: backend logs (by default) + local logs, dedupe by id
                  const seen = new Set<string>();
                  const combined = [...backendActivityLogs, ...(project.activityLogs || [])].filter(l => {
                    const k = String(l.id || `${l.action}-${l.timestamp}`);
                    if (seen.has(k)) return false;
                    seen.add(k);
                    return true;
                  });
                  if (combined.length === 0) {
                    return (
                      <div className="text-center py-16 text-sm text-muted-foreground/60 font-semibold italic">
                        No activity logs recorded yet.
                      </div>
                    );
                  }
                  return combined.map((log: any) => (
                    <div key={log.id} className="flex gap-4 p-4 bg-muted/20 hover:bg-muted/30 rounded-2xl border border-border/40 transition-colors">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold text-sm">
                        ⚙️
                      </div>
                      <div className="flex-1 space-y-1 text-left">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1">
                          <h4 className="text-sm font-black text-foreground">{log.action}</h4>
                          <span className="text-[10px] text-muted-foreground font-mono bg-background px-2.5 py-0.5 rounded-lg border border-border/40">{log.timestamp}</span>
                        </div>
                        {log.details && (
                          <p className="text-xs font-semibold text-muted-foreground leading-relaxed">{log.details}</p>
                        )}
                        <p className="text-[10px] font-bold text-primary/80">Performed by: {log.performedBy}</p>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {(isSocialMediaCategory(project.category) && (!isMarketingCategory(project.category) || dmWorkspaceView === "social")) ? (() => {
              const projectCalendar: CalendarItem[] = project.contentCalendar || [];
              const filteredCalendar = projectCalendar.filter(item => {
                if (calendarTypeFilter !== "All" && item.type !== calendarTypeFilter) return false;
                if (calendarStatusFilter !== "All" && item.status !== calendarStatusFilter) return false;
                return true;
              });

              const getCalTypeColor = (type: string) => {
                switch (type) {
                  case "Reel": return "bg-purple-500/10 text-purple-600 border-purple-500/20";
                  case "Post": return "bg-blue-500/10 text-blue-600 border-blue-500/20";
                  case "Story": return "bg-pink-500/10 text-pink-600 border-pink-500/20";
                  case "Carousel": return "bg-orange-500/10 text-orange-600 border-orange-500/20";
                  default: return "bg-muted text-muted-foreground border-border";
                }
              };

              const getCalStatusColor = (status: string) => {
                switch (status) {
                  case "To Do": return "bg-amber-500/10 text-amber-600 border-amber-500/20";
                  case "In Progress": return "bg-blue-500/10 text-blue-600 border-blue-500/20";
                  case "Pending Approval": return "bg-purple-500/10 text-purple-600 border-purple-500/20";
                  case "Approved": return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
                  case "Published": return "bg-green-500/10 text-green-600 border-green-500/20";
                  default: return "bg-muted text-muted-foreground border-border";
                }
              };

              return (
                <div className="lg:col-span-3 space-y-6">
                  {/* K4: SMM dept dropdown header — click = auto SMM content + collapse */}
                  <button
                    type="button"
                    id="dept-section-smm"
                    onClick={() => {
                      setOpenDept(prev => ({ ...prev, smm: !(prev["smm"] !== false) }));
                      setDmWorkspaceView("social");
                    }}
                    className="flex items-center justify-between w-full p-3.5 bg-card/90 border border-border/60 rounded-2xl shadow-sm hover:bg-muted/40 transition-colors"
                  >
                    <span className="flex items-center gap-2 text-sm font-black text-foreground">
                      <span>📱</span> Social Media (SMM)
                      <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-black">{filteredCalendar.length} items</span>
                    </span>
                    <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", openDept["smm"] !== false && "rotate-180")} />
                  </button>
                  {(openDept["smm"] !== false) && (
                  <>
                  {/* Digital Marketing View Switcher */}
                  {isMarketingCategory(project.category) && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 bg-card/90 border border-border/60 rounded-2xl shadow-sm backdrop-blur-md gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setDmWorkspaceView("social")}
                          className={cn(
                            "flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 whitespace-nowrap",
                            dmWorkspaceView === "social"
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted"
                          )}
                        >
                          <span>📱 Social Media & Content Calendar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDmWorkspaceView("stats")}
                          className={cn(
                            "flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 whitespace-nowrap",
                            dmWorkspaceView === "stats"
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted"
                          )}
                        >
                          <span>📈 Paid Campaigns & Daily Stats</span>
                        </button>
                      </div>
                      <span className="text-[11px] font-bold text-muted-foreground px-2 whitespace-nowrap">
                        Showing Content Calendar & Social Media
                      </span>
                    </div>
                  )}

                  {/* Feature 4: Monthly Target vs Completed Content Delivery Scorecard */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 p-4 sm:p-5 bg-card/80 border border-border/60 rounded-2xl sm:rounded-3xl shadow-sm backdrop-blur-md">
                    {/* Posts Progress */}
                    <div className="space-y-2.5 p-4 bg-blue-500/5 rounded-2xl border border-blue-500/15">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-extrabold text-blue-700 flex items-center gap-1.5">
                          🖼️ Posts Delivery
                        </span>
                        <span className="font-black text-blue-900 font-mono text-base">
                          {currentMonthStats.completedPosts} / {currentMonthStats.targetPosts}
                        </span>
                      </div>
                      <div className="h-2.5 w-full bg-blue-500/15 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-600 rounded-full transition-all duration-500" 
                          style={{ width: `${Math.min(100, Math.round((currentMonthStats.completedPosts / Math.max(1, currentMonthStats.targetPosts)) * 100))}%` }} 
                        />
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-muted-foreground font-bold">
                        <span>{Math.round((currentMonthStats.completedPosts / Math.max(1, currentMonthStats.targetPosts)) * 100)}% Completed</span>
                        <span className={cn("px-2 py-0.5 rounded-full text-[9px]", currentMonthStats.completedPosts >= currentMonthStats.targetPosts ? "bg-emerald-500/10 text-emerald-600 font-black" : "bg-blue-500/10 text-blue-600")}>
                          {currentMonthStats.completedPosts >= currentMonthStats.targetPosts ? "Goal Met ✅" : `${currentMonthStats.targetPosts - currentMonthStats.completedPosts} Posts Left`}
                        </span>
                      </div>
                    </div>

                    {/* Reels Progress */}
                    <div className="space-y-2.5 p-4 bg-purple-500/5 rounded-2xl border border-purple-500/15">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-extrabold text-purple-700 flex items-center gap-1.5">
                          🎥 Reels Delivery
                        </span>
                        <span className="font-black text-purple-900 font-mono text-base">
                          {currentMonthStats.completedReels} / {currentMonthStats.targetReels}
                        </span>
                      </div>
                      <div className="h-2.5 w-full bg-purple-500/15 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-purple-600 rounded-full transition-all duration-500" 
                          style={{ width: `${Math.min(100, Math.round((currentMonthStats.completedReels / Math.max(1, currentMonthStats.targetReels)) * 100))}%` }} 
                        />
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-muted-foreground font-bold">
                        <span>{Math.round((currentMonthStats.completedReels / Math.max(1, currentMonthStats.targetReels)) * 100)}% Completed</span>
                        <span className={cn("px-2 py-0.5 rounded-full text-[9px]", currentMonthStats.completedReels >= currentMonthStats.targetReels ? "bg-emerald-500/10 text-emerald-600 font-black" : "bg-purple-500/10 text-purple-600")}>
                          {currentMonthStats.completedReels >= currentMonthStats.targetReels ? "Goal Met ✅" : `${currentMonthStats.targetReels - currentMonthStats.completedReels} Reels Left`}
                        </span>
                      </div>
                    </div>

                    {/* Total Summary & Edit Target */}
                    <div className="flex flex-col justify-between p-4 bg-muted/30 rounded-2xl border border-border/50">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Monthly Delivery</span>
                        <button 
                          type="button"
                          onClick={() => {
                            setTargetsForm({ post: project.post || 8, reel: project.reel || 8 });
                            setIsEditTargetsModalOpen(true);
                          }}
                          className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1 bg-primary/10 px-2.5 py-1 rounded-lg transition-colors"
                        >
                          <Settings2 className="w-3 h-3" /> Edit Targets
                        </button>
                      </div>
                      <div className="flex items-baseline gap-2 my-1">
                        <span className="text-3xl font-black text-foreground font-mono">
                          {currentMonthStats.totalCompleted} / {currentMonthStats.totalTarget}
                        </span>
                        <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Deliverables</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/40">
                        <span className="text-muted-foreground font-medium">Tracking Period:</span>
                        <Select value={calendarMonthFilter} onValueChange={(val) => setCalendarMonthFilter(val)}>
                          <SelectTrigger className="h-7 px-2 text-[11px] font-bold bg-background border-border/60 rounded-lg min-w-[120px]">
                            <SelectValue placeholder="Period" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-border/60 shadow-xl bg-background/95 backdrop-blur-md z-[300]">
                            <SelectItem value="Current" className="text-xs font-semibold">Current Month</SelectItem>
                            <SelectItem value="All" className="text-xs font-semibold">All Items</SelectItem>
                            {/* K16: project range months (e.g. 15th-cycle) */}
                            {getProjectMonths(project.startDate, project.endDate).months.map(m => (
                              <SelectItem key={m.value} value={m.value} className="text-xs font-semibold">{m.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* K17: timeline completion — final-link rule (posting date sudhi final link = done) */}
                  {(() => {
                    const todayStr = new Date().toISOString().split("T")[0] ?? "";
                    const due = filteredCalendar.filter(i => i.postingDate && i.postingDate <= todayStr);
                    const done = due.filter(i => (i.finalPostLink || i.finalReelLink || i.postingLinkOfIg || "").trim() !== "");
                    const pct = due.length > 0 ? Math.round((done.length / due.length) * 100) : 0;
                    return (
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 py-3 bg-card/80 border border-border/60 rounded-2xl shadow-sm">
                        <div className="flex items-baseline gap-2 shrink-0">
                          <span className="text-2xl font-black text-foreground font-mono">{done.length}/{due.length}</span>
                          <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">done</span>
                        </div>
                        <div className="flex-1 h-2 bg-muted/60 rounded-full overflow-hidden min-w-[120px]">
                          <div className={cn("h-full rounded-full transition-all duration-500", pct === 100 ? "bg-emerald-500" : "bg-primary")} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[11px] font-bold text-muted-foreground shrink-0">{pct}% • Final link rule</span>
                      </div>
                    );
                  })()}
                  {/* K18: CC status inline (month approval + overlap months + update) */}
                  {(() => {
                    const now = new Date();
                    const ck = /^\d{4}-\d{2}$/.test(calendarMonthFilter)
                      ? calendarMonthFilter
                      : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
                    const [yy, mm] = ck.split("-").map(Number);
                    const ap = ccApprovals[ck];
                    const chipCls =
                      ap?.status === "Approved by Client"
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                        : ap?.status === "Rejected"
                        ? "bg-rose-500/10 text-rose-500 border-rose-500/30"
                        : ap?.status === "Changes Requested"
                        ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                        : "bg-muted text-muted-foreground border-border/50";
                    // overlap months (range ma avta months — Sept approved + new pending banne dekhay)
                    const f = customDateRange?.from ? new Date(customDateRange.from) : null;
                    const t = customDateRange?.to ? new Date(customDateRange.to) : null;
                    const overlapKeys: string[] = [];
                    if (f && t && !isNaN(f.getTime()) && !isNaN(t.getTime())) {
                      const cur = new Date(f.getFullYear(), f.getMonth(), 1);
                      const last = new Date(t.getFullYear(), t.getMonth(), 1);
                      let g = 0;
                      while (cur <= last && g < 13) {
                        const k = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`;
                        if (!overlapKeys.includes(k)) overlapKeys.push(k);
                        cur.setMonth(cur.getMonth() + 1);
                        g++;
                      }
                    }
                    return (
                      <div className="flex flex-col gap-2 px-4 py-3 bg-card/80 border border-border/60 rounded-2xl shadow-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">CC Status:</span>
                          <span className={cn("px-2.5 py-1 rounded-full text-[11px] font-black border", chipCls)}>
                            {ck} • {ap?.status || "Pending"}
                          </span>
                          {overlapKeys.filter(k => k !== ck).map(k => (
                            <span key={k} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground border border-border/40">
                              {k} • {ccApprovals[k]?.status || "—"}
                            </span>
                          ))}
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <select
                            value={ccStatusDraft}
                            onChange={e => setCcStatusDraft(e.target.value)}
                            className="h-9 px-3 bg-background border border-border/60 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            {["Pending", "Approved by Client", "Changes Requested", "Rejected"].map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                          {ccStatusDraft !== "Approved by Client" && (
                            <input
                              type="text"
                              value={ccReasonDraft}
                              onChange={e => setCcReasonDraft(e.target.value)}
                              placeholder="Reason compulsory..."
                              className="flex-1 px-3 h-9 bg-background border border-border/60 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => handleSaveCcStatus(project.id, (mm as number), (yy as number))}
                            className="h-9 px-4 bg-primary text-primary-foreground font-bold text-xs rounded-xl hover:bg-primary/90 transition-colors shrink-0"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
                    <div>
                      <h2 className="text-base sm:text-lg lg:text-xl font-bold tracking-tight">Content Calendar</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">Plan, schedule, and track content approval pipeline</p>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar w-full lg:w-auto py-0.5 shrink-0">
                      {/* K17: explanation mode (Meet presentation) */}
                      <button
                        type="button"
                        onClick={() => {
                          if (explainMode) setExplainedIds([]);
                          setExplainMode(v => !v);
                        }}
                        className={cn(
                          "h-8 px-3 rounded-xl text-xs font-bold shrink-0 shadow-sm transition-all border",
                          explainMode
                            ? "bg-violet-600 text-white border-violet-600"
                            : "bg-card hover:bg-card border-border/60 text-foreground"
                        )}
                        title="Google Meet ma samjavva: items par click = highlight"
                      >
                        {explainMode ? `✨ Explaining (${explainedIds.length})` : "✨ Explain"}
                      </button>
                      {explainMode && explainedIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setExplainedIds([])}
                          className="h-8 px-3 rounded-xl text-xs font-bold shrink-0 shadow-sm transition-all border bg-card hover:bg-muted border-border/60 text-muted-foreground"
                        >
                          Clear
                        </button>
                      )}
                      {/* Post / Reel Quick Filters (Audio Transcript) */}
                      <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-xl border border-border/50 shrink-0">
                        {[
                          { label: "All", value: "All" },
                          { label: "📸 Posts", value: "Post" },
                          { label: "🎥 Reels", value: "Reel" },
                        ].map((btn) => (
                          <button
                            key={btn.value}
                            type="button"
                            onClick={() => setCalendarTypeFilter(btn.value)}
                            className={cn(
                              "h-7 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                              calendarTypeFilter === btn.value
                                ? "bg-card text-foreground shadow-xs font-bold border border-border/40"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {btn.label}
                          </button>
                        ))}
                      </div>

                      <Select value={calendarTypeFilter} onValueChange={(val) => setCalendarTypeFilter(val)}>
                        <SelectTrigger className="h-8 w-auto min-w-[95px] max-w-[120px] px-2.5 bg-card/90 hover:bg-card border border-border/60 rounded-xl text-xs font-semibold text-foreground shrink-0 shadow-sm transition-all focus:ring-1 focus:ring-primary/30 gap-1.5">
                          <SelectValue placeholder="All Types" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-border/60 shadow-xl bg-background/95 backdrop-blur-md z-[300]">
                          <SelectItem value="All" className="text-xs font-semibold rounded-lg cursor-pointer">All Types</SelectItem>
                          <SelectItem value="Post" className="text-xs font-semibold rounded-lg cursor-pointer">Post</SelectItem>
                          <SelectItem value="Reel" className="text-xs font-semibold rounded-lg cursor-pointer">Reel</SelectItem>
                          <SelectItem value="Story" className="text-xs font-semibold rounded-lg cursor-pointer">Story</SelectItem>
                          <SelectItem value="Carousel" className="text-xs font-semibold rounded-lg cursor-pointer">Carousel</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={calendarStatusFilter} onValueChange={(val) => setCalendarStatusFilter(val)}>
                        <SelectTrigger className="h-8 w-auto min-w-[110px] max-w-[135px] px-2.5 bg-card/90 hover:bg-card border border-border/60 rounded-xl text-xs font-semibold text-foreground shrink-0 shadow-sm transition-all focus:ring-1 focus:ring-primary/30 gap-1.5">
                          <SelectValue placeholder="All Statuses" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-border/60 shadow-xl bg-background/95 backdrop-blur-md z-[300]">
                          <SelectItem value="All" className="text-xs font-semibold rounded-lg cursor-pointer">All Statuses</SelectItem>
                          <SelectItem value="To Do" className="text-xs font-semibold rounded-lg cursor-pointer">To Do</SelectItem>
                          <SelectItem value="In Progress" className="text-xs font-semibold rounded-lg cursor-pointer">In Progress</SelectItem>
                          <SelectItem value="Pending Approval" className="text-xs font-semibold rounded-lg cursor-pointer">Pending Approval</SelectItem>
                          <SelectItem value="Approved" className="text-xs font-semibold rounded-lg cursor-pointer">Approved</SelectItem>
                          <SelectItem value="Published" className="text-xs font-semibold rounded-lg cursor-pointer">Published</SelectItem>
                        </SelectContent>
                      </Select>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsCalendarSettingsOpen(true);
                        }}
                        className="h-8 px-2.5 bg-card/90 hover:bg-muted border border-border/60 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-all shrink-0 whitespace-nowrap shadow-sm"
                        title="Calendar Settings"
                      >
                        <Settings2 className="w-3.5 h-3.5 shrink-0" />
                        <span className="whitespace-nowrap">Settings</span>
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          const today = new Date().toISOString().split('T')[0] || "";
                          const future = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] || "";
                          setBulkStartDate(today);
                          setBulkEndDate(future);
                          setBulkSelectedDays([1, 3, 5]); // default Mon, Wed, Fri
                          setBulkFormatType("Post");
                          setBulkAddTab('range');
                          setVisualSelectedDates([]);
                          setIsBulkAddModalOpen(true);
                        }}
                        className="h-8 flex items-center gap-1.5 px-3 border border-border/60 bg-card/90 text-foreground hover:bg-muted/80 font-semibold text-xs rounded-xl transition-all shadow-sm shrink-0 whitespace-nowrap"
                      >
                        <Layers className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="whitespace-nowrap">Bulk Add Slots</span>
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingCalendarItem(null);
                          setCalendarForm({ ...defaultCalendarForm });
                          setIsAddCalendarItemModalOpen(true);
                        }}
                        className="h-8 flex items-center gap-1.5 px-3.5 bg-primary text-primary-foreground font-semibold text-xs rounded-xl hover:bg-primary/90 transition-all shadow-sm shrink-0 whitespace-nowrap active:scale-[0.98]"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
                        <span className="whitespace-nowrap">Add Idea</span>
                      </button>
                    </div>
                  </div>

                  <div className="bg-card/40 border border-border/40 rounded-[2rem] shadow-xl overflow-hidden backdrop-blur-md">
                    {filteredCalendar.length === 0 ? (
                      <div className="text-center py-16 text-sm text-muted-foreground font-medium">
                        No calendar items found matching the filters.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-center border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-border/40 text-muted-foreground font-extrabold uppercase tracking-widest bg-muted/30">
                              <th className="py-4 px-5 text-center whitespace-nowrap">Schedule</th>
                              <th className="py-4 px-5 text-center whitespace-nowrap">Type</th>
                              <th className="py-4 px-5 text-center whitespace-nowrap">Topic / Concept</th>
                              <th className="py-4 px-5 text-center whitespace-nowrap">Brand Person</th>
                              <th className="py-4 px-5 text-center whitespace-nowrap">Script</th>
                              <th className="py-4 px-5 text-center whitespace-nowrap">Shoot</th>
                              <th className="py-4 px-5 text-center whitespace-nowrap">Editing</th>
                              <th className="py-4 px-5 text-center whitespace-nowrap">Thumbnail</th>
                              <th className="py-4 px-5 text-center whitespace-nowrap">Caption</th>
                              <th className="py-4 px-5 text-center whitespace-nowrap">Instagram Status</th>
                              <th className="py-4 px-5 text-center whitespace-nowrap">Issues</th>
                              <th className="py-4 px-5 text-center whitespace-nowrap">Approval & Status</th>
                              <th className="py-4 px-5 text-center whitespace-nowrap">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/20">
                            {filteredCalendar.map((item) => {
                              const isExpanded = expandedRowId === item.id;

                              const saveInlineEdit = async (field: string, value: string) => {
                                const updated = projectCalendar.map((x: any) =>
                                  x.id === item.id ? { ...x, [field]: value, ...(field === 'postingDate' ? { postingDay: new Date(value).toLocaleDateString("en-US", { weekday: "long" }) } : {}) } : x
                                );
                                setProjects(projects.map(p => p.id === project.id ? { ...p, contentCalendar: updated, modules: syncSocialMediaTasksForProject(p, updated) } : p));
                                setInlineEdit(null);

                                try {
                                  const updatedItem = updated.find((x: any) => x.id === item.id);
                                  if (updatedItem && project.id) {
                                    const payload = mapCalendarItemToBackendPayload(updatedItem, project.id);
                                    await api.put(`/projects/${project.id}/content/${item.id}`, payload);
                                  }
                                } catch (e) {
                                  console.error("Failed to sync inline edit to backend:", e);
                                }
                              };

                              const startEdit = (e: React.MouseEvent, field: string, value: string) => {
                                e.stopPropagation();
                                setInlineEdit({ id: item.id, field, value: value || '' });
                              };

                              const isEd = (field: string) => inlineEdit?.id === item.id && inlineEdit?.field === field;

                              const InlineText = ({ field, value, placeholder, cls }: { field: string; value?: string | undefined; placeholder?: string | undefined; cls?: string | undefined }) =>
                                isEd(field) ? (
                                  <input
                                    autoFocus
                                    type="text"
                                    value={inlineEdit!.value}
                                    onChange={e => setInlineEdit({ ...inlineEdit!, value: e.target.value })}
                                    onBlur={() => saveInlineEdit(field, inlineEdit!.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') saveInlineEdit(field, inlineEdit!.value); if (e.key === 'Escape') setInlineEdit(null); }}
                                    onClick={e => e.stopPropagation()}
                                    className="w-full px-2 py-1 bg-primary/5 border border-primary/40 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-primary text-center"
                                  />
                                ) : (
                                  <span onClick={e => startEdit(e, field, value || '')} className={cn("cursor-text hover:bg-primary/5 rounded px-1 py-0.5 transition-colors block text-center group/cell", cls)} title="Click to edit">
                                    {value || <span className="text-muted-foreground/30 italic text-[10px]">{placeholder || 'Click to add'}</span>}
                                    <span className="ml-1 opacity-0 group-hover/cell:opacity-50 transition-opacity text-[9px]">✏️</span>
                                  </span>
                                );

                              const InlineDate = ({ field, value }: { field: string; value?: string | undefined }) =>
                                isEd(field) ? (
                                  <div onClick={e => e.stopPropagation()} className="inline-block">
                                    <DatePicker
                                      value={inlineEdit!.value}
                                      onChange={(val) => {
                                        setInlineEdit({ ...inlineEdit!, value: val });
                                        saveInlineEdit(field, val);
                                      }}
                                      className="w-[125px] h-7 text-xs font-bold bg-primary/5 border border-primary/40"
                                    />
                                  </div>
                                ) : (
                                  <span onClick={e => startEdit(e, field, value || '')} className="cursor-text hover:bg-primary/5 rounded px-1 py-0.5 transition-colors inline-flex items-center gap-1 group/dc" title="Click to edit date">
                                    {value ? (<><Calendar className="w-2.5 h-2.5 text-muted-foreground" /><span className="text-[11px] font-extrabold text-foreground">{safeFormat(value, "dd/MM/yyyy")}</span></>) : <span className="text-muted-foreground/30 text-[10px] italic">-</span>}
                                    <span className="opacity-0 group-hover/dc:opacity-50 transition-opacity text-[9px]">✏️</span>
                                  </span>
                                );

                              const InlineLink = ({ field, value, label, cc }: { field: string; value?: string | undefined; label: string; cc: string }) =>
                                isEd(field) ? (
                                  <input autoFocus type="text" value={inlineEdit!.value} onChange={e => setInlineEdit({ ...inlineEdit!, value: e.target.value })} onBlur={() => saveInlineEdit(field, inlineEdit!.value)} onKeyDown={e => { if (e.key === 'Enter') saveInlineEdit(field, inlineEdit!.value); if (e.key === 'Escape') setInlineEdit(null); }} onClick={e => e.stopPropagation()} placeholder="Paste URL..." className="w-full max-w-[120px] px-2 py-1 bg-primary/5 border border-primary/40 rounded-lg text-[10px] font-bold focus:outline-none focus:ring-1 focus:ring-primary" />
                                ) : value ? (
                                  <div className="flex items-center justify-center gap-0.5 group/lc">
                                    <a href={value} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className={cn("px-2 py-0.5 font-bold rounded-md text-[10px] flex items-center gap-1 border", cc)}>{label}</a>
                                    <button onClick={e => startEdit(e, field, value)} className="opacity-0 group-hover/lc:opacity-60 text-[9px] hover:opacity-100 transition-opacity ml-0.5">✏️</button>
                                  </div>
                                ) : (
                                  <button onClick={e => startEdit(e, field, '')} className="text-muted-foreground/30 text-[10px] italic hover:text-primary/50 transition-colors">+ {label}</button>
                                );

                              return (
                                <tr
                                  key={item.id}
                                  onClick={() => {
                                    // K17: explain mode ma click = highlight, normal ma expand
                                    if (explainMode) toggleExplain(item.id);
                                    else setExpandedRowId(isExpanded ? null : item.id);
                                  }}
                                  className={cn(
                                    "hover:bg-muted/20 transition-all group cursor-pointer",
                                    isExpanded ? "bg-muted/10 align-top" : "h-[80px]",
                                    explainMode && "hover:bg-violet-500/15 hover:ring-2 hover:ring-inset hover:ring-violet-500/70 hover:shadow-md",
                                    explainMode && explainedIds.includes(item.id) && "bg-violet-500/15 ring-2 ring-inset ring-violet-500/80"
                                  )}
                                >

                                  {/* Schedule */}
                                  <td className="py-2 px-5 text-center whitespace-nowrap">
                                    <div className="flex flex-col items-center gap-0.5">
                                      {isEd('postingDate') ? (
                                        <div onClick={e => e.stopPropagation()} className="inline-block">
                                          <DatePicker
                                            value={inlineEdit!.value}
                                            onChange={(val) => {
                                              if (!val || !val.trim()) {
                                                toast.error("Schedule date is compulsory and cannot be removed.");
                                                return;
                                              }
                                              setInlineEdit({ ...inlineEdit!, value: val });
                                              saveInlineEdit('postingDate', val);
                                            }}
                                            className="w-[130px] h-7 text-xs font-semibold bg-primary/5 border border-primary/40"
                                          />
                                        </div>
                                      ) : (
                                        <span onClick={e => startEdit(e, 'postingDate', item.postingDate)} className="font-semibold text-foreground block text-sm cursor-text hover:bg-primary/5 rounded px-1 py-0.5 transition-colors group/pd" title="Click to edit">
                                          {safeFormat(item.postingDate, "dd/MM/yyyy")}
                                          <span className="ml-1 opacity-0 group-hover/pd:opacity-50 transition-opacity text-[9px]">✏️</span>
                                        </span>
                                      )}
                                      <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block mt-0.5">
                                        {item.postingDay || (item.postingDate ? new Date(item.postingDate).toLocaleDateString("en-US", { weekday: "long" }) : "-")}
                                      </span>
                                    </div>
                                  </td>

                                  {/* Type */}
                                  <td className="py-2 px-5 text-center">
                                    {isEd('type') ? (
                                      <select autoFocus value={inlineEdit!.value} onChange={e => saveInlineEdit('type', e.target.value)} onBlur={() => saveInlineEdit('type', inlineEdit!.value)} onKeyDown={e => { if (e.key === 'Escape') setInlineEdit(null); }} onClick={e => e.stopPropagation()} className="px-2 py-1 bg-primary/5 border border-primary/40 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-primary mx-auto block">
                                        {["Post", "Reel", "Story", "Carousel"].map(o => <option key={o} value={o}>{o}</option>)}
                                      </select>
                                    ) : (
                                      <span onClick={e => startEdit(e, 'type', item.type)} className={cn("mx-auto px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest border rounded-full block text-center max-w-[90px] cursor-pointer hover:opacity-80", getCalTypeColor(item.type))} title="Click to change">{item.type}</span>
                                    )}
                                  </td>

                                  {/* Topic / Concept */}
                                  <td className={cn("py-2 px-5 text-center min-w-[200px]", isExpanded ? "max-w-none" : "max-w-[240px]")}>
                                    <InlineText field="topic" value={item.topic} placeholder="Enter topic..." cls={cn("font-medium text-foreground leading-normal", isExpanded ? "" : "line-clamp-1")} />
                                    <InlineText field="concept" value={item.concept} placeholder="+ concept" cls={cn("text-muted-foreground mt-0.5 leading-normal text-[11px]", isExpanded ? "" : "line-clamp-1")} />
                                    {isEd('reference') ? (
                                      <input
                                        autoFocus
                                        type="text"
                                        value={inlineEdit!.value}
                                        onChange={e => setInlineEdit({ ...inlineEdit!, value: e.target.value })}
                                        onBlur={() => saveInlineEdit('reference', inlineEdit!.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') saveInlineEdit('reference', inlineEdit!.value); if (e.key === 'Escape') setInlineEdit(null); }}
                                        onClick={e => e.stopPropagation()}
                                        placeholder="Paste reference link..."
                                        className="w-full max-w-[180px] px-2 py-1 bg-primary/5 border border-primary/40 rounded-lg text-[10px] font-bold focus:outline-none focus:ring-1 focus:ring-primary mx-auto block text-center"
                                      />
                                    ) : item.reference ? (
                                      <div className="flex items-center justify-center gap-1 group/ref">
                                        <a 
                                          href={item.reference} 
                                          target="_blank" 
                                          rel="noopener noreferrer" 
                                          onClick={e => e.stopPropagation()} 
                                          className={cn("text-primary/70 hover:underline block mt-0.5 text-[10px]", isExpanded ? "whitespace-pre-wrap break-all" : "truncate max-w-[150px]")}
                                          title={item.reference}
                                        >
                                          Ref: {item.reference}
                                        </a>
                                        <button 
                                          onClick={e => startEdit(e, 'reference', item.reference || '')} 
                                          className="opacity-0 group-hover/ref:opacity-60 text-[9px] hover:opacity-100 transition-opacity"
                                          title="Edit reference link"
                                        >
                                          ✏️
                                        </button>
                                      </div>
                                    ) : (
                                      <span 
                                        onClick={e => startEdit(e, 'reference', '')} 
                                        className="cursor-text hover:bg-primary/5 rounded px-1 py-0.5 transition-colors block text-center text-muted-foreground/30 text-[10px] italic"
                                        title="Click to add reference link"
                                      >
                                        + ref link
                                      </span>
                                    )}
                                  </td>

                                  {/* Brand Person */}
                                  <td className="py-2 px-5 text-center whitespace-nowrap">
                                    <InlineText field="_assignedTo" value={item.brand_person_details?.employee_name || (item.assignedTo || []).join(", ")} placeholder="Unassigned" cls="text-foreground font-medium text-[13px]" />
                                  </td>

                                  {/* Script */}
                                  <td className="py-2 px-5 text-center whitespace-nowrap">
                                    <div className="flex flex-col items-center gap-1">
                                      <InlineDate field="scriptDate" value={item.scriptDate} />
                                      <InlineLink field="scriptLink" value={item.scriptLink} label="📄 Script" cc="bg-primary/10 hover:bg-primary/20 text-primary border-primary/20" />
                                    </div>
                                  </td>

                                  {/* Shoot */}
                                  <td className="py-2 px-5 text-center whitespace-nowrap">
                                    <div className="flex flex-col items-center gap-1">
                                      <InlineDate field="shootDate" value={item.shootDate} />
                                      <InlineLink field="shootLink" value={item.shootLink} label="🎬 Assets" cc="bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 border-amber-500/20" />
                                    </div>
                                  </td>

                                  {/* Editing */}
                                  <td className="py-2 px-5 text-center whitespace-nowrap">
                                    <div className="flex flex-col items-center gap-1">
                                      <InlineDate field="editingStart" value={item.editingStart} />
                                      <div className="flex gap-1 justify-center">
                                        {item.type === "Reel" ? (
                                          <InlineLink field="finalReelLink" value={item.finalReelLink} label="🎥 Reel" cc="bg-violet-500/10 hover:bg-violet-500/20 text-violet-600 border-violet-500/20" />
                                        ) : item.type === "Post" || item.type === "Carousel" ? (
                                          <InlineLink field="finalPostLink" value={item.finalPostLink} label="📸 Post" cc="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 border-emerald-500/20" />
                                        ) : (
                                          <>
                                            <InlineLink field="finalReelLink" value={item.finalReelLink} label="🎥 Reel" cc="bg-violet-500/10 hover:bg-violet-500/20 text-violet-600 border-violet-500/20" />
                                            <InlineLink field="finalPostLink" value={item.finalPostLink} label="📸 Post" cc="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 border-emerald-500/20" />
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </td>

                                  {/* Thumbnail */}
                                  <td className="py-2 px-5 text-center whitespace-nowrap">
                                    {item.type === "Reel" ? (
                                      <div className="flex flex-col items-center gap-1">
                                        <InlineDate field="thumbnailDate" value={item.thumbnailDate} />
                                        <InlineLink field="thumbnailLink" value={item.thumbnailLink} label="🖼️ Design" cc="bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 border-blue-500/20" />
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground/30 text-[10px] italic">-</span>
                                    )}
                                  </td>

                                  {/* Caption */}
                                  <td className={cn("py-2 px-5 text-center", isExpanded ? "min-w-[200px]" : "min-w-[150px] max-w-[200px]")}>
                                    <div className="flex flex-col items-center gap-1">
                                      <InlineDate field="captionDate" value={item.captionDate} />
                                      <InlineText field="caption" value={item.caption} placeholder="+ caption" cls={cn("text-muted-foreground text-[11px] leading-normal", isExpanded ? "whitespace-pre-wrap" : "line-clamp-1")} />
                                    </div>
                                  </td>

                                  {/* Instagram Status */}
                                  <td className="py-2 px-5 text-center whitespace-nowrap">
                                    <div className="flex flex-col items-center gap-1">
                                      <InlineDate field="actualPostingDate" value={item.actualPostingDate} />
                                      <InlineLink field="postingLinkOfIg" value={item.postingLinkOfIg} label="🔗 IG Post" cc="bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 border-rose-500/20" />
                                    </div>
                                  </td>

                                  {/* Issues */}
                                  <td className="py-2 px-5 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                    <CalendarIssuesCell
                                      item={item}
                                      projectCalendar={projectCalendar}
                                      project={project}
                                      projects={projects}
                                      setProjects={setProjects}
                                      onLogActivity={(act, det) => logProjectActivity(project.id, act, det)}
                                    />
                                  </td>

                                  {/* Approval & Status */}
                                  <td className="py-2 px-5 text-center whitespace-nowrap">
                                    <InlineText field="approval" value={item.approved_by_details?.employee_name || item.approval} placeholder="+ feedback" cls="text-[11px] text-foreground font-semibold mb-1" />
                                    {isEd('status') ? (
                                      <select autoFocus value={inlineEdit!.value} onChange={e => saveInlineEdit('status', e.target.value)} onBlur={() => saveInlineEdit('status', inlineEdit!.value)} onKeyDown={e => { if (e.key === 'Escape') setInlineEdit(null); }} onClick={e => e.stopPropagation()} className="px-2 py-1 bg-primary/5 border border-primary/40 rounded-lg text-xs font-bold focus:outline-none mx-auto block">
                                        {["To Do", "In Progress", "Pending Approval", "Approved", "Published"].map(o => <option key={o} value={o}>{o}</option>)}
                                      </select>
                                    ) : (
                                      <span onClick={e => startEdit(e, 'status', item.status)} className={cn("mx-auto px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider block text-center max-w-[110px] cursor-pointer hover:opacity-80", getCalStatusColor(item.status))} title="Click to change status">{item.status}</span>
                                    )}
                                  </td>

                                  {/* Actions */}
                                  <td className="py-2 px-5 text-center whitespace-nowrap">
                                    <div className="flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button onClick={(e) => { e.stopPropagation(); setEditingCalendarItem(item); setCalendarForm({ ...item }); setIsAddCalendarItemModalOpen(true); }} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors border border-border/30 shadow-sm bg-card" title="Full edit">
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                      <button 
                                        onClick={(e) => { 
                                          e.stopPropagation(); 
                                          setConfirmModalState({
                                            isOpen: true,
                                            title: "Delete Content Idea",
                                            description: "Are you sure you want to delete this content idea? This action cannot be undone.",
                                            itemName: item.topic || "Untitled Idea",
                                            action: async () => {
                                              try {
                                                if (project.id && item.id) {
                                                  await api.delete(`/projects/${project.id}/content/${item.id}`);
                                                }
                                                const updated = projectCalendar.filter((x: any) => x.id !== item.id);
                                                setProjects(projects.map(p => p.id === project.id ? { ...p, contentCalendar: updated, modules: syncSocialMediaTasksForProject(p, updated) } : p));
                                                toast.success("Content idea deleted successfully");
                                              } catch (err: any) {
                                                toast.error(err.message || "Failed to delete content idea");
                                              } finally {
                                                setConfirmModalState(prev => ({ ...prev, isOpen: false }));
                                              }
                                            }
                                          });
                                        }} 
                                        className="p-1.5 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition-colors border border-border/30 shadow-sm bg-card"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                  </>
                  )}
                </div>
              );
            })() : isMarketingCategory(project.category) ? (() => {
              const dailyStatsList = project.dailyStats || [];
              
              // Filter by campaign
              const campaignFiltered = dailyStatsList.filter((s: any) => {
                if (selectedCampaignForStats === "All Campaigns") return true;
                const cleanSelected = selectedCampaignForStats.replace(" (Inactive)", "");
                return s.campaignName === cleanSelected;
              });

              // Filter by date range
              const dateFiltered = campaignFiltered.filter((s: any) => {
                if (!customDateRange?.from) return true;
                const statDate = new Date(s.date);
                const fromDate = new Date(customDateRange.from);
                const toDate = customDateRange.to ? new Date(customDateRange.to) : fromDate;
                
                statDate.setHours(0,0,0,0);
                fromDate.setHours(0,0,0,0);
                toDate.setHours(0,0,0,0);
                
                return statDate >= fromDate && statDate <= toDate;
              });

              const totalReach = dateFiltered.reduce((sum: number, s: any) => sum + Number(s.reach || 0), 0);
              const totalLeads = dateFiltered.reduce((sum: number, s: any) => sum + Number(s.leads || 0), 0);
              const totalSpent = dateFiltered.reduce((sum: number, s: any) => sum + Number(s.spend || 0), 0);
              const computedCPL = totalLeads > 0 ? Math.round(totalSpent / totalLeads) : 0;

              let reach = totalReach > 0 ? (totalReach >= 1000000 ? `${(totalReach / 1000000).toFixed(1)}M` : `${Math.round(totalReach / 1000)}K`) : "0";
              let leads = totalLeads.toLocaleString("en-IN");
              let cpl = computedCPL.toString();
              let amountSpent = totalSpent.toLocaleString("en-IN");

              let reachTrend = "+0.0%", leadsTrend = "+0.0%", cplTrend = "+0.0%", amountSpentTrend = "+0.0%";

              // F1+F2: backend summary hoy to real KPIs + growth (filter-wired, live)
              const fmtGrowth = (g: any) => {
                if (typeof g !== "number" || isNaN(g)) return "+0.0%";
                return `${g >= 0 ? "+" : ""}${g}%`;
              };
              const sk = dmSummary?.kpis;
              if (sk) {
                const rv = Number(sk.reach?.value);
                if (!isNaN(rv)) reach = rv >= 1000000 ? `${(rv / 1000000).toFixed(1)}M` : rv >= 1000 ? `${Math.round(rv / 1000)}K` : `${Math.round(rv)}`;
                const lv = Number(sk.leads?.value);
                if (!isNaN(lv)) leads = Math.round(lv).toLocaleString("en-IN");
                const cv = Number(sk.cost_per_lead?.value);
                if (!isNaN(cv)) cpl = `${Math.round(cv)}`;
                const sv = Number(sk.amount_spent?.value);
                if (!isNaN(sv)) amountSpent = Math.round(sv).toLocaleString("en-IN");
                reachTrend = fmtGrowth(sk.reach?.growth_pct);
                leadsTrend = fmtGrowth(sk.leads?.growth_pct);
                cplTrend = fmtGrowth(sk.cost_per_lead?.growth_pct);
                amountSpentTrend = fmtGrowth(sk.amount_spent?.growth_pct);
              }

              return (
                <div className="lg:col-span-3 space-y-6">
                  {/* K4: Digital Marketing dept dropdown header — click = auto DM stats + collapse */}
                  <button
                    type="button"
                    id="dept-section-dm"
                    onClick={() => {
                      setOpenDept(prev => ({ ...prev, dm: !(prev["dm"] !== false) }));
                      setDmWorkspaceView("stats");
                    }}
                    className="flex items-center justify-between w-full p-3.5 bg-card/90 border border-border/60 rounded-2xl shadow-sm hover:bg-muted/40 transition-colors"
                  >
                    <span className="flex items-center gap-2 text-sm font-black text-foreground">
                      <span>📈</span> Digital Marketing
                      <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-black">{dailyStatsList.length} logs</span>
                    </span>
                    <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", openDept["dm"] !== false && "rotate-180")} />
                  </button>
                  {(openDept["dm"] !== false) && (
                  <>
                  {/* Digital Marketing View Switcher */}
                  <div className="flex flex-wrap items-center justify-between p-2.5 bg-card/90 border border-border/60 rounded-2xl shadow-sm backdrop-blur-md gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setDmWorkspaceView("social")}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                          dmWorkspaceView === "social"
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                      >
                        <span>📱 Social Media & Content Calendar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDmWorkspaceView("stats")}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                          dmWorkspaceView === "stats"
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                      >
                        <span>📈 Paid Campaigns & Daily Stats</span>
                      </button>
                    </div>
                    <span className="text-[11px] font-bold text-muted-foreground px-2">
                      Showing Ad Performance & Leads
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
                        <Target className="w-5 h-5 text-primary" />
                        Campaign Performance
                      </h2>
                      <p className="text-xs text-muted-foreground mt-0.5 font-medium">Reach, leads, and conversion analytics</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsLogDailyStatsOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground font-bold text-xs rounded-lg hover:bg-primary/90 transition-all shadow-sm whitespace-nowrap"
                      >
                        <Plus className="w-3.5 h-3.5" /> Log Stats
                      </button>
                      {/* F3: revenue icon → popup (page nai) */}
                      <button
                        onClick={() => { setRevenueForm({ date: "", revenue: "", editId: "" }); setIsRevenueOpen(true); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white font-bold text-xs rounded-lg hover:bg-emerald-700 transition-all shadow-sm whitespace-nowrap"
                        title="Revenue log (popup)"
                      >
                        <IndianRupee className="w-3.5 h-3.5" /> Revenue
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border/60 text-foreground font-bold text-xs rounded-lg hover:bg-muted/80 transition-all shadow-sm">
                            <Filter className="w-3 h-3 text-muted-foreground" />
                            {selectedCampaignForStats}
                            <ChevronDown className="w-3 h-3 text-muted-foreground ml-1" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 rounded-xl p-1.5 border-border/60 shadow-xl bg-background/95 backdrop-blur-md z-50">
                          {(() => {
                            const campaignList = (project.campaigns && project.campaigns.length > 0)
                              ? project.campaigns.map(c => {
                                  const name = typeof c === 'string' ? c : (c.name || "");
                                  const status = typeof c === 'string' ? 'Active' : (c.status || 'Active');
                                  return status === 'Inactive' ? `${name} (Inactive)` : name;
                                })
                              : ["Q4 Retargeting Ads", "Holiday Social Push", "B2B Email Drip"];
                            return ["All Campaigns", ...campaignList];
                          })().map(opt => (
                            <DropdownMenuItem 
                              key={opt}
                              onSelect={() => setSelectedCampaignForStats(opt)}
                              className={cn(
                                "rounded-lg cursor-pointer py-2 focus:bg-primary/10 focus:text-primary font-medium text-xs transition-colors flex items-center justify-between",
                                selectedCampaignForStats === opt && "bg-primary/10 text-primary font-bold"
                              )}
                            >
                              {opt}
                              {selectedCampaignForStats === opt && <CheckCircle2 className="w-3 h-3" />}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border/60 text-foreground font-bold text-xs rounded-lg hover:bg-muted/80 transition-all shadow-sm whitespace-nowrap">
                            <Calendar className="w-3 h-3 text-muted-foreground" />
                            {campaignDateRange === "Custom" && customDateRange?.from ? (
                              customDateRange.to ? (
                                <>
                                  {format(customDateRange.from, "dd/MM/yyyy")} -{" "}
                                  {format(customDateRange.to, "dd/MM/yyyy")}
                                </>
                              ) : (
                                format(customDateRange.from, "dd/MM/yyyy")
                              )
                            ) : (
                              campaignDateRange
                            )}
                            <ChevronDown className="w-3 h-3 text-muted-foreground ml-1" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                          <div className="flex flex-col sm:flex-row">
                            <div className="flex flex-col gap-1 p-3 border-b sm:border-b-0 sm:border-r border-border/50 bg-muted/20 w-full sm:w-40">
                              {["Today", "Yesterday", "Last 7 Days", "Last 30 Days", "This Month", "Year to Date", "Custom"].map(opt => (
                                <button
                                  key={opt}
                                  onClick={() => {
                                     setCampaignDateRange(opt);
                                     if (opt === "Today") setCustomDateRange({ from: new Date(), to: new Date() });
                                     else if (opt === "Yesterday") setCustomDateRange({ from: subDays(new Date(), 1), to: subDays(new Date(), 1) });
                                     else if (opt === "Last 7 Days") setCustomDateRange({ from: subDays(new Date(), 7), to: new Date() });
                                     else if (opt === "Last 30 Days") setCustomDateRange({ from: subDays(new Date(), 30), to: new Date() });
                                     else if (opt === "This Month") {
                                       const today = new Date();
                                       setCustomDateRange({ from: new Date(today.getFullYear(), today.getMonth(), 1), to: today });
                                     }
                                     else if (opt === "Year to Date") setCustomDateRange({ from: startOfYear(new Date()), to: new Date() });
                                  }}
                                  className={cn(
                                    "text-left px-3 py-2 text-xs font-bold rounded-lg transition-colors",
                                    campaignDateRange === opt ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted/60 text-foreground"
                                  )}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                            <div className="p-3">
                              <CalendarUI
                                initialFocus
                                mode="range"
                                defaultMonth={customDateRange?.from || new Date()}
                                selected={customDateRange}
                                onSelect={(range) => {
                                   setCustomDateRange(range);
                                   setCampaignDateRange("Custom");
                                }}
                                numberOfMonths={2}
                                className="rounded-md p-0"
                              />
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in zoom-in-95 duration-300" key={`${selectedCampaignForStats}-${campaignDateRange}`}>
                    <div className="bg-card border border-border/60 rounded-3xl p-5 shadow-sm relative overflow-hidden group hover:border-primary/30 transition-colors">
                      <div className="absolute -right-4 -top-4 w-16 h-16 bg-blue-500/10 rounded-full blur-xl group-hover:bg-blue-500/20 transition-colors"></div>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                          <Users className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Reach</span>
                      </div>
                      <h4 className="text-2xl font-black text-foreground font-mono">{reach}</h4>
                      <p className="text-xs font-bold text-emerald-500 flex items-center gap-1 mt-1">
                        <TrendingUp className="w-3 h-3" /> {reachTrend}
                      </p>
                    </div>

                    <div className="bg-card border border-border/60 rounded-3xl p-5 shadow-sm relative overflow-hidden group hover:border-primary/30 transition-colors">
                      <div className="absolute -right-4 -top-4 w-16 h-16 bg-purple-500/10 rounded-full blur-xl group-hover:bg-purple-500/20 transition-colors"></div>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500">
                          <Target className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Leads</span>
                      </div>
                      <h4 className="text-2xl font-black text-foreground font-mono">{leads}</h4>
                      <p className="text-xs font-bold text-emerald-500 flex items-center gap-1 mt-1">
                        <TrendingUp className="w-3 h-3" /> {leadsTrend}
                      </p>
                    </div>

                    <div className="bg-card border border-border/60 rounded-3xl p-5 shadow-sm relative overflow-hidden group hover:border-primary/30 transition-colors">
                      <div className="absolute -right-4 -top-4 w-16 h-16 bg-emerald-500/10 rounded-full blur-xl group-hover:bg-emerald-500/20 transition-colors"></div>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                          <TrendingUp className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Cost Per Lead</span>
                      </div>
                      <h4 className="text-2xl font-black text-foreground font-mono">₹{cpl}</h4>
                      <p className="text-xs font-bold text-emerald-500 flex items-center gap-1 mt-1 font-mono">
                        {cplTrend}
                      </p>
                    </div>

                    <div className="bg-card border border-border/60 rounded-3xl p-5 shadow-sm relative overflow-hidden group hover:border-primary/30 transition-colors">
                      <div className="absolute -right-4 -top-4 w-16 h-16 bg-amber-500/10 rounded-full blur-xl group-hover:bg-amber-500/20 transition-colors"></div>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                          <IndianRupee className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Amount Spent</span>
                      </div>
                      <h4 className="text-2xl font-black text-foreground font-mono">₹{amountSpent}</h4>
                      <p className="text-xs font-bold text-emerald-500 flex items-center gap-1 mt-1">
                        <TrendingUp className="w-3 h-3" /> {amountSpentTrend}
                      </p>
                    </div>
                  </div>

                  {/* K7: Daily Data Entry Tasks card removed (no tasks in DM) */}
                  <div className="grid grid-cols-1 gap-6">
                    {/* Top Performing Campaigns (F6: backend auto) */}
                    <div className="bg-card border border-border/60 rounded-3xl p-6 shadow-sm">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-sm font-bold text-foreground">Top Performing Campaigns</h3>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">Auto • by leads</span>
                      </div>
                      <div className="space-y-4">
                        {topCampaigns.length === 0 && (
                          <p className="text-xs font-semibold text-muted-foreground/60 border border-dashed border-border/40 rounded-2xl px-4 py-3 text-center">No campaign data yet.</p>
                        )}
                        {(() => {
                          const maxLeads = Math.max(1, ...topCampaigns.map(c => Number(c.leads) || 0));
                          return topCampaigns.slice(0, 5).map((camp: any, i: number) => {
                            const leads = Number(camp.leads) || 0;
                            const spend = Number(camp.spend) || 0;
                            const pct = Math.round((leads / maxLeads) * 100);
                            return (
                              <div key={camp.campaign_name || i} className="flex items-center gap-4">
                                <div className="flex-1">
                                  <div className="flex justify-between items-center mb-1 gap-2">
                                    <span className="text-sm font-bold text-foreground truncate">{camp.campaign_name}</span>
                                    <span className="text-xs font-bold text-muted-foreground font-mono whitespace-nowrap">
                                      {leads.toLocaleString()} leads • ₹{spend.toLocaleString("en-IN")}
                                      {Number(camp.revenue) > 0 && (
                                        <span className="text-emerald-600"> • ₹{Number(camp.revenue).toLocaleString("en-IN")}</span>
                                      )}
                                    </span>
                                  </div>
                                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                    <div className={cn("h-full rounded-full transition-all duration-1000", i === 0 ? "bg-emerald-500" : "bg-primary")} style={{ width: `${pct}%` }}></div>
                                  </div>
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>

                    {/* F8: Monthly Report — 1 month select = full data auto (ochha button) */}
                    <div className="bg-card border border-border/60 rounded-3xl p-6 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                        <h3 className="text-sm font-bold text-foreground">Monthly Report <span className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Auto</span></h3>
                        <select
                          value={reportMonth}
                          onChange={(e) => setReportMonth(e.target.value)}
                          className="h-9 px-3 bg-muted/50 border border-border/60 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          <option value="">Select month...</option>
                          {getProjectMonths(project.startDate, project.endDate).months.map(m => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                          ))}
                        </select>
                      </div>
                      {reportLoading ? (
                        <p className="text-xs text-muted-foreground font-semibold text-center py-6">Loading report...</p>
                      ) : !reportData ? (
                        <p className="text-xs font-semibold text-muted-foreground/60 border border-dashed border-border/40 rounded-2xl px-4 py-3 text-center">Select a month — all data loads automatically.</p>
                      ) : (
                        <>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-4">
                            {[
                              { label: "Reach", v: reportData?.kpis?.reach },
                              { label: "Impressions", v: reportData?.kpis?.impressions },
                              { label: "Leads", v: reportData?.kpis?.leads },
                              { label: "Cost / Lead", v: reportData?.kpis?.cost_per_lead },
                              { label: "Spend", v: reportData?.kpis?.amount_spent },
                              { label: "Revenue", v: reportData?.kpis?.revenue },
                            ].map(k => (
                              <div key={k.label} className="rounded-2xl border border-border/40 bg-muted/20 px-3.5 py-3">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{k.label}</p>
                                <p className="text-lg font-black text-foreground font-mono mt-0.5">{k.v?.formatted ?? "—"}</p>
                                {typeof k.v?.growth_pct === "number" && (
                                  <p className={`text-[10px] font-bold font-mono ${k.v.growth_pct >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                                    {k.v.growth_pct >= 0 ? "▲" : "▼"} {Math.abs(k.v.growth_pct)}%
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                          {(reportData?.top_campaigns || []).length > 0 && (
                            <div className="text-[11px] text-muted-foreground font-semibold">
                              Top: {(reportData.top_campaigns || []).slice(0, 3).map((c: any) => c.campaign_name).join(" • ")}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                  <div className="bg-card border border-border/60 rounded-3xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-sm font-bold text-foreground">Recent Marketing Stats Logs</h3>
                        <p className="text-xs text-muted-foreground mt-0.5 font-medium">Daily log history for active campaigns</p>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          {/* F7: full columns — Sr, date, campaign, reach, impression, lead, followers, revenue, spend, cost + action */}
                          <tr className="border-b border-border/40 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                            <th className="pb-3 pl-4">Sr</th>
                            <th className="pb-3">Date</th>
                            <th className="pb-3">Campaign</th>
                            <th className="pb-3 text-right">Reach</th>
                            <th className="pb-3 text-right">Impr.</th>
                            <th className="pb-3 text-right">Leads</th>
                            <th className="pb-3 text-right">Followers</th>
                            <th className="pb-3 text-right">Revenue</th>
                            <th className="pb-3 text-right">Spend</th>
                            <th className="pb-3 text-right">CPL</th>
                            <th className="pb-3 text-right pr-4">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20 text-xs font-semibold text-foreground">
                          {/* F5: same-name combine → 1 dropdown per campaign (totals + collapse) */}
                          {(() => {
                            const dailyStats = dateFiltered || [];
                            if (dailyStats.length === 0) {
                              return (
                                <tr>
                                  <td colSpan={11} className="py-8 text-center text-xs font-semibold text-muted-foreground/40">
                                    No stats logged yet matching the filters.
                                  </td>
                                </tr>
                              );
                            }
                            const groups = new Map<string, any[]>();
                            dailyStats.forEach((s: any) => {
                              const k = s.campaignName || "Unknown";
                              if (!groups.has(k)) groups.set(k, []);
                              groups.get(k)!.push(s);
                            });
                            let sr = 0;
                            return Array.from(groups.entries()).flatMap(([name, items]) => {
                              const open = openCampGroups[name] !== false;
                              const tLeads = items.reduce((a, s) => a + (Number(s.leads) || 0), 0);
                              const tSpend = items.reduce((a, s) => a + (Number(s.spend) || 0), 0);
                              const tRev = items.reduce((a, s) => a + (Number(s.revenue) || 0), 0);
                              const rows: any[] = [(
                                <tr key={`g-${name}`} onClick={() => toggleCampGroup(name)} className="cursor-pointer bg-muted/30 hover:bg-muted/50 transition-colors">
                                  <td colSpan={11} className="py-2.5 pl-4 pr-4">
                                    <span className="flex items-center gap-2 flex-wrap">
                                      <span className="text-muted-foreground text-[10px]">{open ? "▼" : "▶"}</span>
                                      <span className="font-black text-foreground">{name}</span>
                                      <span className="px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-black">{items.length} logs</span>
                                      <span className="text-[11px] text-muted-foreground font-bold ml-auto">
                                        Leads: <span className="text-foreground font-mono">{tLeads.toLocaleString()}</span>
                                        {" • "}Spend: <span className="text-foreground font-mono">₹{tSpend.toLocaleString("en-IN")}</span>
                                        {" • "}Rev: <span className="text-emerald-600 font-mono">₹{tRev.toLocaleString("en-IN")}</span>
                                      </span>
                                    </span>
                                  </td>
                                </tr>
                              )];
                              if (open) {
                                items.slice(0, 30).forEach((stat: any) => {
                                  sr += 1;
                                  const cpl = stat.leads > 0 ? Math.round(stat.spend / stat.leads) : 0;
                                  rows.push((
                                    <tr key={stat.id} className="hover:bg-muted/10 transition-colors">
                                      <td className="py-3.5 pl-4 font-mono text-muted-foreground">{sr}</td>
                                      <td className="py-3.5 font-mono">{safeFormat(stat.date, "dd/MM/yyyy")}</td>
                                      <td className="py-3.5 text-muted-foreground">↳ {stat.campaignName}</td>
                                      <td className="py-3.5 text-right font-mono">{Number(stat.reach || 0).toLocaleString()}</td>
                                      <td className="py-3.5 text-right font-mono">{Number(stat.impressions || 0).toLocaleString()}</td>
                                      <td className="py-3.5 text-right font-mono">{Number(stat.leads || 0).toLocaleString()}</td>
                                      <td className="py-3.5 text-right font-mono">{Number(stat.followers || 0).toLocaleString()}</td>
                                      <td className="py-3.5 text-right font-mono text-emerald-600">₹{Number(stat.revenue || 0).toLocaleString("en-IN")}</td>
                                      <td className="py-3.5 text-right font-mono">₹{Number(stat.spend || 0).toLocaleString()}</td>
                                      <td className="py-3.5 text-right font-mono text-primary">₹{cpl}</td>
                                      <td className="py-3.5 text-right pr-4">
                                        <span className="inline-flex items-center gap-1">
                                          <button
                                            onClick={() => openEditStat(stat)}
                                            className="p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors border border-border/30 shadow-sm bg-card inline-flex items-center justify-center"
                                            title="Edit stats log"
                                          >
                                            <Edit2 className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            onClick={() => {
                                              setConfirmModalState({
                                                isOpen: true,
                                                title: "Delete Daily Stats Log",
                                                description: `Are you sure you want to delete this daily stat log for "${stat.campaignName}" on ${stat.date}? This action cannot be undone.`,
                                                itemName: `${stat.campaignName} (${stat.date})`,
                                                action: () => {
                                                  (async () => {
                                                    try {
                                                      await api.delete(`/projects/${project.id}/marketing-stats/${stat.id}`, { showErrorToast: false });
                                                      await fetchDmStats(project.id);
                                                      await fetchDmCampaigns(project.id);
                                                      toast.success("Daily stats log deleted successfully!");
                                                    } catch (err: any) {
                                                      toast.error(err?.message || "Failed to delete stats log");
                                                    } finally {
                                                      setConfirmModalState(prev => ({ ...prev, isOpen: false }));
                                                    }
                                                  })();
                                                }
                                              });
                                            }}
                                            className="p-1 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition-colors border border-border/30 shadow-sm bg-card inline-flex items-center justify-center"
                                            title="Delete stats log"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </span>
                                      </td>
                                    </tr>
                                  ));
                                });
                              }
                              return rows;
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  </div>
                  </>
                  )}
                </div>
              );
            })() : (
              <>
                {/* Left Col: Tasks / Kanban */}
                <div className="lg:col-span-2 space-y-6">
                  {isDevCategory(project.category) ? (() => {
                    const projectModules: NonNullable<Project['modules']> = project.modules || [];
                    const activeModule = projectModules.find(m => m.id === selectedModuleId) || projectModules[0];
                    
                    const handleAddModule = (e: React.FormEvent) => {
                      e.preventDefault();
                      if (!addModuleForm.name.trim()) return;
                      const newModule: any = {
                        id: `mod-${Date.now()}`,
                        name: addModuleForm.name.trim(),
                        assignedToName: addModuleForm.assignedToName || undefined,
                        status: addModuleForm.status,
                        priority: addModuleForm.priority,
                        estimatedHours: addModuleForm.estimatedHours || undefined,
                        dueDate: addModuleForm.dueDate || undefined,
                        tasks: []
                      };
                      const updatedModules: any = [...projectModules, newModule];
                      saveProjectModules(project.id, updatedModules, "Added Module", `Added new module "${newModule.name}"`);
                      setSelectedModuleId(newModule.id);
                      setAddModuleForm({
                        name: "",
                        assignedToName: "",
                        status: "todo",
                        priority: "medium",
                        estimatedHours: 0,
                        dueDate: ""
                      });
                      toast.success(`Module "${newModule.name}" created!`);
                    };

                    const handleAddModuleTask = (columnStatus: "todo" | "in-progress" | "bugs" | "onhold" | "pending" | "completed") => {
                      if (!newModuleTaskTitle.trim() || !activeModule) return;
                      const newTask = {
                        id: `task-${Date.now()}`,
                        title: newModuleTaskTitle.trim(),
                        status: columnStatus
                      };
                      const updatedTasks = [...activeModule.tasks, newTask];
                      const updatedModules: NonNullable<Project['modules']> = projectModules.map(m => m.id === activeModule.id ? { ...m, tasks: updatedTasks } : m);
                      saveProjectModules(project.id, updatedModules, "Added Task", `Added task "${newTask.title}" inside module "${activeModule.name}"`);
                      setNewModuleTaskTitle("");
                      setInlineEdit(null); // Close task input
                      toast.success("Task added successfully!");
                    };

                    const handleDeleteTask = (taskId: string) => {
                      if (!activeModule) return;
                      const taskToDelete = activeModule.tasks.find(t => t.id === taskId);
                      const updatedTasks = activeModule.tasks.filter(t => t.id !== taskId);
                      const updatedModules: NonNullable<Project['modules']> = projectModules.map(m => m.id === activeModule.id ? { ...m, tasks: updatedTasks } : m);
                      saveProjectModules(project.id, updatedModules, "Deleted Task", `Deleted task "${taskToDelete?.title || taskId}" from module "${activeModule.name}"`);
                      toast.success("Task deleted");
                    };

                    const handleMoveTask = (taskId: string, direction: 'left' | 'right') => {
                      if (!activeModule) return;
                      const task = activeModule.tasks.find(t => t.id === taskId);
                      if (!task) return;
                      
                      const statusFlow: ("todo" | "in-progress" | "bugs" | "onhold" | "pending" | "completed")[] = ["todo", "in-progress", "bugs", "onhold", "pending", "completed"];
                      const currIdx = statusFlow.indexOf(task.status);
                      let nextIdx = currIdx + (direction === 'right' ? 1 : -1);
                      if (nextIdx < 0 || nextIdx >= statusFlow.length) return;
                      
                      const updatedTasks = activeModule.tasks.map(t => t.id === taskId ? { ...t, status: statusFlow[nextIdx] as any } : t);
                      const updatedModules: NonNullable<Project['modules']> = projectModules.map(m => m.id === activeModule.id ? { ...m, tasks: updatedTasks } : m);
                      saveProjectModules(project.id, updatedModules, "Moved Task", `Moved task "${task.title}" to ${statusFlow[nextIdx]}`);
                    };

                    return (
                      <div className="space-y-6 animate-in fade-in duration-300">
                        {/* Modules Header */}
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                          <div>
                            <h2 className="text-xl font-bold tracking-tight">Module-wise Kanban</h2>
                            <p className="text-xs text-muted-foreground mt-1">Manage project components and developer boards</p>
                          </div>

                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsPresetsModalOpen(true);
                              }}
                              className="px-3 py-1.5 bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 text-xs font-bold rounded-xl flex items-center gap-1.5 border border-border/60 transition-colors shadow-sm"
                            >
                              ⚙️ Load from Presets
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setAddModuleForm({
                                  name: "",
                                  assignedToName: "",
                                  status: "todo",
                                  priority: "medium",
                                  estimatedHours: 0,
                                  dueDate: ""
                                });
                                setIsAddModuleModalOpen(true);
                              }}
                              className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-xl hover:bg-primary/90 flex items-center gap-1 shrink-0 shadow-sm"
                            >
                              <Plus className="w-3.5 h-3.5" /> Add Module
                            </button>
                          </div>
                        </div>

                        {/* Modules List Tabs */}
                        {projectModules.length === 0 ? (
                          <div className="bg-card border border-border/40 rounded-[2rem] p-12 text-center">
                            <Layers className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                            <h3 className="font-bold text-foreground text-sm">No modules added yet</h3>
                            <p className="text-xs text-muted-foreground mt-1">Create your first development module above to start tracking tasks.</p>
                          </div>
                        ) : (
                          <>
                             <div className="flex flex-wrap gap-2 pb-2 border-b border-border/20 items-center">
                               {projectModules.map(m => {
                                 const isActive = activeModule?.id === m.id;
                                 return (
                                   <div key={m.id} className="flex items-center gap-1 bg-muted/30 p-1.5 rounded-2xl border border-border/10">
                                     <button
                                       onClick={() => setSelectedModuleId(m.id)}
                                       className={cn(
                                         "px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5",
                                         isActive
                                           ? "bg-primary text-primary-foreground shadow-sm shadow-primary/10"
                                           : "text-muted-foreground hover:bg-muted"
                                       )}
                                     >
                                       📦 {m.name}
                                     </button>
                                     {isActive && (
                                       <div className="flex gap-0.5 ml-1">
                                         <button
                                            onClick={() => {
                                              setEditModuleForm({
                                                id: m.id,
                                                name: m.name,
                                                assignedToName: m.assignedToName || "",
                                                status: m.status || "todo",
                                                priority: m.priority || "medium",
                                                estimatedHours: m.estimatedHours || 0,
                                                dueDate: m.dueDate || ""
                                              });
                                              setIsEditModuleModalOpen(true);
                                            }}
                                           className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                                           title="Rename module"
                                         >
                                           <Edit2 className="w-3.5 h-3.5" />
                                         </button>
                                         <button
                                           onClick={() => {
                                             setConfirmModalState({
                                               isOpen: true,
                                               title: "Delete Module",
                                               description: "Are you sure you want to delete this module and all its tasks? This action cannot be undone.",
                                               itemName: m.name,
                                               action: () => {
                                                 const updatedModules = projectModules.filter(pm => pm.id !== m.id);
                                                 saveProjectModules(project.id, updatedModules, "Deleted Module", `Deleted module "${m.name}"`);
                                                 setSelectedModuleId(updatedModules[0]?.id || null);
                                                 toast.success(`Module "${m.name}" deleted successfully!`);
                                               }
                                             });
                                           }}
                                           className="p-1 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition-colors"
                                           title="Delete module"
                                         >
                                           <Trash2 className="w-3.5 h-3.5" />
                                         </button>
                                       </div>
                                     )}
                                   </div>
                                 );
                               })}
                             </div>

                            {/* Kanban Grid */}
                            {activeModule && (
                              <div className="flex gap-4 overflow-x-auto pb-4 w-full snap-x">
                                {([
                                  { status: "todo" as const, title: "To Do", color: "text-slate-500", bg: "bg-slate-500/5" },
                                  { status: "in-progress" as const, title: "In Progress", color: "text-blue-500", bg: "bg-blue-500/5" },
                                  { status: "bugs" as const, title: "Bugs", color: "text-rose-500", bg: "bg-rose-500/5" },
                                  { status: "onhold" as const, title: "On Hold", color: "text-amber-500", bg: "bg-amber-500/5" },
                                  { status: "pending" as const, title: "Pending", color: "text-purple-500", bg: "bg-purple-500/5" },
                                  { status: "completed" as any, title: "Completed", color: "text-emerald-500", bg: "bg-emerald-500/5" },
                                ]).map((col) => {
                                  const colTasks = activeModule.tasks.filter(t => t.status === col.status);
                                  const isAdding = inlineEdit?.id === activeModule!.id && inlineEdit?.field === col.status;
                                  
                                  return (
                                    <div key={col.status} className={cn("space-y-3 p-4 rounded-[2rem] border border-border/40 flex flex-col min-w-[280px] max-w-[300px] w-full shrink-0 snap-align-start", col.bg)}>
                                      <h4 className={cn("font-extrabold text-xs uppercase tracking-widest mb-4 flex items-center justify-between", col.color)}>
                                        {col.title} <span className="bg-background border border-border/20 px-2 py-0.5 rounded-md text-foreground font-mono text-[10px]">{colTasks.length}</span>
                                      </h4>

                                      <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[350px]">
                                        {colTasks.map((t) => (
                                          <div
                                            key={t.id}
                                            onClick={() => {
                                              setEditingModuleTask({ ...t });
                                              setIsModuleTaskModalOpen(true);
                                            }}
                                            className="bg-card border border-border/60 p-4 rounded-2xl shadow-sm hover:shadow-md hover:border-primary/20 transition-all group relative flex flex-col justify-between min-h-[110px] cursor-pointer"
                                          >
                                            <div>
                                              <div className="flex flex-wrap gap-1 mb-2">
                                                {t.phase && (
                                                  <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 uppercase tracking-wide">
                                                    {t.phase}
                                                  </span>
                                                )}
                                                {t.dueDate && (
                                                  <span className="text-[9px] font-black text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                                    📅 {t.dueDate}
                                                  </span>
                                                )}
                                              </div>
                                              
                                              <p className="font-bold text-sm text-foreground break-words pr-6 leading-snug">{t.title}</p>
                                              
                                              {/* Pending Reason Alert */}
                                              {(t.status === 'onhold' || t.status === 'pending') && t.reasonForPending && (
                                                <div className="mt-2 flex items-start gap-1 bg-amber-500/10 border border-amber-500/20 rounded-lg p-1.5">
                                                  <span className="text-[9px] font-medium text-amber-700 leading-normal break-words">
                                                    ⚠️ {t.reasonForPending}
                                                  </span>
                                                </div>
                                              )}
                                            </div>
                                            
                                            <div className="flex justify-between items-center mt-4 pt-3 border-t border-border/20">
                                              <div className="flex items-center gap-1.5 max-w-[120px] truncate">
                                                <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-black shrink-0 border border-primary/20">
                                                  {(t.assignedToName || "U").charAt(0).toUpperCase()}
                                                </div>
                                                <span className="text-[11px] font-bold text-muted-foreground truncate">{t.assignedToName || "Unassigned"}</span>
                                              </div>

                                              <div className="flex gap-1 items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <div className="flex gap-0.5 mr-1">
                                                  {col.status !== "todo" && (
                                                    <button onClick={(e) => { e.stopPropagation(); handleMoveTask(t.id, 'left'); }} className="p-1 rounded bg-muted hover:bg-muted/80 text-muted-foreground text-[9px] font-bold">←</button>
                                                  )}
                                                  {col.status !== "completed" && (
                                                    <button onClick={(e) => { e.stopPropagation(); handleMoveTask(t.id, 'right'); }} className="p-1 rounded bg-muted hover:bg-muted/80 text-muted-foreground text-[9px] font-bold">→</button>
                                                  )}
                                                </div>

                                                <button
                                                  onClick={(e) => { e.stopPropagation(); handleDeleteTask(t.id); }}
                                                  className="text-rose-500 hover:text-rose-600 transition-colors p-1 rounded hover:bg-rose-500/10"
                                                  title="Delete task"
                                                >
                                                  <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                              </div>
                                            </div>
                                          </div>
                                        ))}

                                        {colTasks.length === 0 && (
                                          <div className="py-8 text-center text-xs font-semibold text-muted-foreground/40 border-2 border-dashed border-border/20 rounded-2xl">
                                            No tasks
                                          </div>
                                        )}
                                      </div>

                                      {/* Add Task Control */}
                                      <button
                                        onClick={() => {
                                          setAddTaskForm({
                                            title: "",
                                            phase: "",
                                            dueDate: "",
                                            assignedToName: "",
                                            status: col.status,
                                            reasonForPending: ""
                                          });
                                          setIsAddTaskModalOpen(true);
                                        }}
                                        className="w-full py-2 border-2 border-dashed border-border/50 hover:border-primary/30 rounded-xl text-xs font-extrabold text-muted-foreground/60 hover:text-primary transition-all flex items-center justify-center gap-1 bg-card/40"
                                      >
                                        <Plus className="w-3 h-3" /> Add Task
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })() : (() => {
                    const projectModules = project.modules || [];
                    let milestonesModule = projectModules.find(m => m.id === "mod-milestones" || m.name === "Milestones");
                    if (!milestonesModule) {
                      milestonesModule = projectModules[0] || {
                        id: "mod-milestones",
                        name: "Milestones",
                        tasks: [
                          { id: "ms-1", title: "Requirement Analysis", status: "completed", dueDate: "25/09/2026", assignedToName: "Alex" },
                          { id: "ms-2", title: "Design Phase", status: "completed", dueDate: "02/10/2026", assignedToName: "Sarah" },
                          { id: "ms-3", title: "Development Sprint 1", status: "todo", dueDate: "09/10/2026", assignedToName: "Mike" },
                          { id: "ms-4", title: "QA & Testing", status: "todo", dueDate: "16/10/2026", assignedToName: "Alex" },
                        ]
                      };
                    }
                    const milestones = milestonesModule.tasks || [];

                    const handleToggleMilestone = (milestoneId: string) => {
                      const updatedTasks = milestones.map(m => {
                        if (m.id === milestoneId) {
                          const nextStatus = m.status === "completed" ? "todo" : "completed";
                          return { ...m, status: nextStatus as any };
                        }
                        return m;
                      });
                      const updatedModule = { ...milestonesModule, tasks: updatedTasks };
                      const updatedModules = projectModules.some(m => m.id === milestonesModule.id)
                        ? projectModules.map(m => m.id === milestonesModule.id ? updatedModule : m)
                        : [updatedModule, ...projectModules];
                      saveProjectModules(project.id, updatedModules, "Toggled Milestone", "Toggled milestone completion status");
                    };

                    const handleDeleteMilestone = (milestoneId: string, milestoneTitle: string) => {
                      setConfirmModalState({
                        isOpen: true,
                        title: "Delete Milestone",
                        description: `Are you sure you want to delete "${milestoneTitle}"? This action cannot be undone.`,
                        itemName: milestoneTitle,
                        action: () => {
                          const updatedTasks = milestones.filter(m => m.id !== milestoneId);
                          const updatedModule = { ...milestonesModule, tasks: updatedTasks };
                          const updatedModules = projectModules.some(m => m.id === milestonesModule.id)
                            ? projectModules.map(m => m.id === milestonesModule.id ? updatedModule : m)
                            : [updatedModule, ...projectModules];
                          saveProjectModules(project.id, updatedModules, "Deleted Milestone", `Deleted milestone "${milestoneTitle}"`);
                          toast.success("Milestone deleted successfully!");
                        }
                      });
                    };

                    const handleMoveMilestone = (milestoneId: string, direction: 'left' | 'right') => {
                      const mItem = milestones.find(m => m.id === milestoneId);
                      if (!mItem) return;
                      const flow: ("todo" | "in-progress" | "completed")[] = ["todo", "in-progress", "completed"];
                      const currentStatus = (mItem.status === "completed" ? "completed" : mItem.status === "in-progress" ? "in-progress" : "todo");
                      const currIdx = flow.indexOf(currentStatus);
                      let nextIdx = currIdx + (direction === 'right' ? 1 : -1);
                      if (nextIdx < 0 || nextIdx >= flow.length) return;
                      const updatedTasks = milestones.map(m => m.id === milestoneId ? { ...m, status: flow[nextIdx] as any } : m);
                      const updatedModule = { ...milestonesModule, tasks: updatedTasks };
                      const updatedModules = projectModules.some(m => m.id === milestonesModule.id)
                        ? projectModules.map(m => m.id === milestonesModule.id ? updatedModule : m)
                        : [updatedModule, ...projectModules];
                      saveProjectModules(project.id, updatedModules, "Moved Milestone", `Moved milestone "${mItem.title}" to ${flow[nextIdx]}`);
                    };

                    const openAddMilestone = (defaultStatus: "todo" | "in-progress" | "completed" = "todo") => {
                      setEditingMilestone(null);
                      setMilestoneForm({
                        title: "",
                        dueDate: "",
                        status: defaultStatus,
                        assignedToName: ""
                      });
                      setIsAddMilestoneModalOpen(true);
                    };

                    const openEditMilestone = (task: any) => {
                      setEditingMilestone(task);
                      setMilestoneForm({
                        title: task.title,
                        dueDate: task.dueDate || "",
                        status: task.status === "completed" ? "completed" : task.status === "in-progress" ? "in-progress" : "todo",
                        assignedToName: task.assignedToName || ""
                      });
                      setIsAddMilestoneModalOpen(true);
                    };

                    return (
                      <>
                        {/* Milestones & Tasks Header */}
                        <div className="flex items-center justify-between">
                          <h2 className="text-xl font-bold tracking-tight">Milestones &amp; Tasks</h2>
                          <div className="flex items-center gap-3">
                            <button 
                              onClick={() => openAddMilestone("todo")}
                              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-primary-foreground font-bold text-xs rounded-xl hover:bg-primary/90 transition-all shadow-sm"
                            >
                              <Plus className="w-3.5 h-3.5" /> Add Milestone
                            </button>
                            <button 
                              onClick={() => setIsKanbanView(!isKanbanView)}
                              className="text-xs font-bold text-primary hover:underline flex items-center gap-1 bg-primary/5 hover:bg-primary/10 px-3 py-1.5 rounded-xl transition-colors"
                            >
                              {isKanbanView ? "View List" : "View Kanban"}
                            </button>
                          </div>
                        </div>
                        
                        {isKanbanView ? (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                             {/* To Do Column */}
                             <div className="space-y-3 bg-muted/20 p-4 rounded-3xl border border-border/40">
                                <h4 className="font-bold text-xs text-muted-foreground uppercase tracking-widest mb-4 flex items-center justify-between">
                                  To Do <span className="bg-background px-2 py-0.5 rounded-md font-mono text-foreground">{milestones.filter(m => m.status === 'todo' || (m.status !== 'in-progress' && m.status !== 'completed')).length}</span>
                                </h4>
                                {milestones.filter(m => m.status === 'todo' || (m.status !== 'in-progress' && m.status !== 'completed')).map((task) => (
                                  <div key={task.id} className="bg-card border border-border/60 p-4 rounded-2xl shadow-sm hover:border-primary/30 hover:shadow-md transition-all group">
                                     <p className="font-bold text-sm text-foreground break-words">{task.title}</p>
                                     {task.dueDate && (
                                       <p className="text-xs font-medium text-muted-foreground mt-2 flex items-center gap-1.5">
                                         <Calendar className="w-3 h-3" /> Due {task.dueDate}
                                       </p>
                                     )}
                                     <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/20">
                                       <span className="text-[11px] font-bold text-muted-foreground">{task.assignedToName || "Unassigned"}</span>
                                       <div className="flex items-center gap-1">
                                         <button onClick={() => handleMoveMilestone(task.id, 'right')} className="p-1 rounded bg-muted hover:bg-muted/80 text-muted-foreground text-[10px] font-bold" title="Move to In Progress">→</button>
                                         <button onClick={() => openEditMilestone(task)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Edit"><Edit2 className="w-3 h-3" /></button>
                                         <button onClick={() => handleDeleteMilestone(task.id, task.title)} className="p-1 rounded hover:bg-rose-500/10 text-rose-500" title="Delete"><Trash2 className="w-3 h-3" /></button>
                                       </div>
                                     </div>
                                  </div>
                                ))}
                                <button 
                                  onClick={() => openAddMilestone("todo")} 
                                  className="w-full py-2 border-2 border-dashed border-border/60 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted/50 transition-colors flex items-center justify-center gap-1"
                                >
                                  <Plus className="w-3 h-3" /> Add Task
                                </button>
                             </div>
                             
                             {/* In Progress Column */}
                             <div className="space-y-3 bg-muted/20 p-4 rounded-3xl border border-border/40">
                                <h4 className="font-bold text-xs text-primary uppercase tracking-widest mb-4 flex items-center justify-between">
                                  In Progress <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-md font-mono">{milestones.filter(m => m.status === 'in-progress').length}</span>
                                </h4>
                                {milestones.filter(m => m.status === 'in-progress').map((task) => (
                                  <div key={task.id} className="bg-card border border-primary/20 p-4 rounded-2xl shadow-sm hover:shadow-md transition-all group">
                                     <p className="font-bold text-sm text-foreground break-words">{task.title}</p>
                                     {task.dueDate && (
                                       <p className="text-xs font-medium text-muted-foreground mt-2 flex items-center gap-1.5">
                                         <Calendar className="w-3 h-3" /> Due {task.dueDate}
                                       </p>
                                     )}
                                     <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/20">
                                       <span className="text-[11px] font-bold text-muted-foreground">{task.assignedToName || "Unassigned"}</span>
                                       <div className="flex items-center gap-1">
                                         <button onClick={() => handleMoveMilestone(task.id, 'left')} className="p-1 rounded bg-muted hover:bg-muted/80 text-muted-foreground text-[10px] font-bold" title="Move to To Do">←</button>
                                         <button onClick={() => handleMoveMilestone(task.id, 'right')} className="p-1 rounded bg-muted hover:bg-muted/80 text-muted-foreground text-[10px] font-bold" title="Move to Done">→</button>
                                         <button onClick={() => openEditMilestone(task)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Edit"><Edit2 className="w-3 h-3" /></button>
                                         <button onClick={() => handleDeleteMilestone(task.id, task.title)} className="p-1 rounded hover:bg-rose-500/10 text-rose-500" title="Delete"><Trash2 className="w-3 h-3" /></button>
                                       </div>
                                     </div>
                                  </div>
                                ))}
                                {milestones.filter(m => m.status === 'in-progress').length === 0 && (
                                  <div className="p-4 rounded-2xl border-2 border-border/40 border-dashed text-center py-8">
                                    <p className="text-xs font-bold text-muted-foreground">No tasks</p>
                                  </div>
                                )}
                                <button 
                                  onClick={() => openAddMilestone("in-progress")} 
                                  className="w-full py-2 border-2 border-dashed border-border/60 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted/50 transition-colors flex items-center justify-center gap-1"
                                >
                                  <Plus className="w-3 h-3" /> Add Task
                                </button>
                             </div>
                             
                             {/* Done Column */}
                             <div className="space-y-3 bg-muted/20 p-4 rounded-3xl border border-border/40">
                                <h4 className="font-bold text-xs text-emerald-500 uppercase tracking-widest mb-4 flex items-center justify-between">
                                  Done <span className="bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-md font-mono">{milestones.filter(m => m.status === 'completed').length}</span>
                                </h4>
                                {milestones.filter(m => m.status === 'completed').map((task) => (
                                  <div key={task.id} className="bg-muted/40 border border-border/40 p-4 rounded-2xl group">
                                     <p className="font-bold text-sm text-muted-foreground line-through decoration-muted-foreground/50 break-words">{task.title}</p>
                                     <p className="text-xs font-medium text-emerald-600 mt-2 flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3" /> Completed</p>
                                     <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/20">
                                       <span className="text-[11px] font-bold text-muted-foreground">{task.assignedToName || "Unassigned"}</span>
                                       <div className="flex items-center gap-1">
                                         <button onClick={() => handleMoveMilestone(task.id, 'left')} className="p-1 rounded bg-muted hover:bg-muted/80 text-muted-foreground text-[10px] font-bold" title="Move back to In Progress">←</button>
                                         <button onClick={() => openEditMilestone(task)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Edit"><Edit2 className="w-3 h-3" /></button>
                                         <button onClick={() => handleDeleteMilestone(task.id, task.title)} className="p-1 rounded hover:bg-rose-500/10 text-rose-500" title="Delete"><Trash2 className="w-3 h-3" /></button>
                                       </div>
                                     </div>
                                  </div>
                                ))}
                                <button 
                                  onClick={() => openAddMilestone("completed")} 
                                  className="w-full py-2 border-2 border-dashed border-border/60 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted/50 transition-colors flex items-center justify-center gap-1"
                                >
                                  <Plus className="w-3 h-3" /> Add Task
                                </button>
                             </div>
                          </div>
                        ) : (
                          <div className="bg-card border border-border/60 rounded-3xl p-6 shadow-sm space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {milestones.map((task) => {
                              const isDone = task.status === "completed";
                              return (
                                <div 
                                  key={task.id} 
                                  className="flex items-center justify-between p-4 rounded-2xl border border-border/40 hover:bg-muted/30 transition-all group"
                                >
                                  <div className="flex items-center gap-4 flex-1">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleMilestone(task.id)}
                                      className={cn(
                                        "w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer shrink-0",
                                        isDone 
                                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-500 shadow-sm" 
                                          : "border-muted-foreground/40 hover:border-primary text-transparent hover:bg-primary/5"
                                      )}
                                      title={isDone ? "Mark as Incomplete" : "Mark as Completed"}
                                    >
                                      <CheckCircle2 className={cn("w-4 h-4 transition-transform", isDone ? "scale-100" : "scale-0")} />
                                    </button>
                                    <div className="flex-1">
                                      <p className={cn("font-bold text-sm transition-colors", isDone ? "line-through text-muted-foreground" : "text-foreground")}>
                                        {task.title}
                                      </p>
                                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground font-medium">
                                        {task.dueDate && (
                                          <span className="flex items-center gap-1">
                                            Due {task.dueDate}
                                          </span>
                                        )}
                                        {task.assignedToName && (
                                          <span className="flex items-center gap-1 text-[11px] font-bold text-primary/80">
                                            👤 {task.assignedToName}
                                          </span>
                                        )}
                                        <span className={cn(
                                          "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                                          isDone ? "bg-emerald-500/10 text-emerald-600" : task.status === "in-progress" ? "bg-blue-500/10 text-blue-600" : "bg-muted text-muted-foreground"
                                        )}>
                                          {isDone ? "Completed" : task.status === "in-progress" ? "In Progress" : "To Do"}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      type="button"
                                      onClick={() => openEditMilestone(task)}
                                      className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors border border-border/40"
                                      title="Edit milestone"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteMilestone(task.id, task.title)}
                                      className="p-1.5 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition-colors border border-border/40"
                                      title="Delete milestone"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                            {milestones.length === 0 && (
                              <div className="text-center py-12 text-muted-foreground text-xs font-semibold">
                                No milestones added yet. Click "+ Add Milestone" to create your first milestone.
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
                <div className="space-y-6">
                  <h2 className="text-xl font-bold tracking-tight">Team Members</h2>
                  <div className="bg-card border border-border/60 rounded-3xl p-6 shadow-sm space-y-4">
                     {project.team.map((member, i) => (
                       <div key={i} className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-xl overflow-hidden bg-muted">
                           <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                         </div>
                         <div>
                           <p className="font-bold text-foreground text-sm">{member.name}</p>
                           <p className="text-xs text-muted-foreground">Team Member</p>
                         </div>
                       </div>
                     ))}
                  </div>
                </div>
              </>
            )}
          </div>
          )}

        </div>
        {/* SMM Content Calendar Settings Modal */}
        {isCalendarSettingsOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-card w-full max-w-sm rounded-[2rem] border border-border/60 shadow-2xl overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-6 py-5 border-b border-border/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 text-primary rounded-xl">
                    <Settings2 className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-black text-foreground">Calendar Settings</h3>
                </div>
                <button onClick={() => setIsCalendarSettingsOpen(false)} className="p-2 text-muted-foreground hover:bg-muted rounded-full transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Set the default number of days *prior* to the posting date for each pipeline stage.
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Script Date (Days Before)</label>
                    <input type="number" min="0" value={calendarOffsets.script} onChange={(e) => setCalendarOffsets({ ...calendarOffsets, script: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Shoot Date (Days Before)</label>
                    <input type="number" min="0" value={calendarOffsets.shoot} onChange={(e) => setCalendarOffsets({ ...calendarOffsets, shoot: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Editing/Graphics (Days Before)</label>
                    <input type="number" min="0" value={calendarOffsets.editing} onChange={(e) => setCalendarOffsets({ ...calendarOffsets, editing: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Approval (Days Before)</label>
                    <input type="number" min="0" value={calendarOffsets.approval} onChange={(e) => setCalendarOffsets({ ...calendarOffsets, approval: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none" />
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 bg-muted/30 border-t border-border/50 flex justify-end gap-3 shrink-0">
                <button onClick={() => setIsCalendarSettingsOpen(false)} className="px-4 py-2 rounded-xl font-bold text-sm text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
                <button
                  onClick={async () => {
                    localStorage.setItem('hrms_calendar_offsets', JSON.stringify(calendarOffsets));
                    if (selectedProjectId) {
                      try {
                        await api.put(`/projects/${selectedProjectId}/content/settings`, {
                          project_id: selectedProjectId,
                          script_days_before: Number(calendarOffsets.script) || 0,
                          shoot_days_before: Number(calendarOffsets.shoot) || 0,
                          editing_graphics_days_before: Number(calendarOffsets.editing) || 0,
                          approval_days_before: Number(calendarOffsets.approval) || 0,
                        });
                      } catch (err) {
                        console.error("Failed to save settings to backend:", err);
                      }
                    }
                    setIsCalendarSettingsOpen(false);
                    toast.success("Calendar offset presets saved!");
                  }}
                  className="px-5 py-2 bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-sm rounded-xl transition-all shadow-sm"
                >
                  Save Presets
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SMM Content Calendar Modal - plain overlay */}
        {isAddCalendarItemModalOpen && (() => {
          const currentSelectedProject = projects.find(p => p.id === selectedProjectId);
          return (
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center"
              onClick={() => { setIsAddCalendarItemModalOpen(false); setEditingCalendarItem(null); setActiveCalendarTab('general'); }}
            >
              {/* Backdrop */}
              <div className="absolute inset-0 bg-black/80" />
              {/* Modal Panel */}
              <div
                className="relative z-10 w-[calc(100%-2rem)] max-w-[700px] bg-card border border-border/60 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden"
                style={{ height: '550px' }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-8 py-6 border-b border-border/50 bg-muted/30 shrink-0">
                  <div>
                    <h2 className="text-xl md:text-2xl font-black tracking-tight">{editingCalendarItem ? "Edit Content Idea" : "New Content Idea"}</h2>
                    <p className="text-xs text-muted-foreground mt-1">Configure SMM posting slots, pipeline assets and approvals</p>
                  </div>
                  <button
                    onClick={() => { setIsAddCalendarItemModalOpen(false); setEditingCalendarItem(null); setActiveCalendarTab('general'); }}
                    className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {/* Body */}
                <div className="flex flex-row overflow-hidden flex-1">
                  {/* Sidebar Tabs */}
                  <div className="w-44 shrink-0 border-r border-border/50 bg-muted/20 p-3 flex flex-col gap-1 overflow-y-auto">
                    {([
                      { id: 'general', label: 'General Info', icon: <FileText className="w-4 h-4" /> },
                      { id: 'production', label: 'Production', icon: <Video className="w-4 h-4" /> },
                      { id: 'publishing', label: 'Publishing', icon: <Instagram className="w-4 h-4" /> },
                    ] as const).map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveCalendarTab(tab.id)}
                        className={cn(
                          "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-bold transition-all text-left w-full",
                          activeCalendarTab === tab.id
                            ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        {tab.icon}
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  {/* Tab Contents */}
                  <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-5">
                    {activeCalendarTab === 'general' && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Posting Date <span className="text-rose-500">*</span></label>
                            <DatePicker 
                              value={calendarForm.postingDate || ""} 
                              onChange={(newDate) => {
                                const dates = getPresetDates(newDate);
                                setCalendarForm({ 
                                  ...calendarForm, 
                                  postingDate: newDate,
                                  scriptDate: calendarForm.scriptDate || dates.scriptDate || "",
                                  shootDate: calendarForm.shootDate || dates.shootDate || "",
                                  editingStart: calendarForm.editingStart || dates.editingStart || "",
                                  captionDate: calendarForm.captionDate || dates.captionDate || "",
                                  thumbnailDate: calendarForm.thumbnailDate || dates.thumbnailDate || "",
                                  approval: calendarForm.approval || dates.approval || ""
                                });
                              }} 
                              className="w-full h-9 px-3 py-1.5 bg-muted/50 border border-border/50 rounded-xl text-xs font-semibold" 
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Format Type</label>
                            <Select value={calendarForm.type || "Post"} onValueChange={(val) => setCalendarForm({ ...calendarForm, type: val })}>
                              <SelectTrigger className="w-full h-9 bg-muted/50 border-border/50 rounded-xl text-xs font-semibold">
                                <SelectValue placeholder="Format Type" />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl border-border/60 shadow-xl bg-background/95 backdrop-blur-md z-[300]">
                                {["Post", "Reel", "Story", "Carousel"].map(t => (
                                  <SelectItem key={t} value={t} className="text-xs font-semibold rounded-lg cursor-pointer">
                                    {t}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Topic / Hook <span className="text-rose-500">*</span></label>
                          <input type="text" value={calendarForm.topic || ""} onChange={(e) => setCalendarForm({ ...calendarForm, topic: e.target.value })} placeholder="Hook title or main idea" className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Concept Details &amp; Notes</label>
                          <textarea value={calendarForm.concept || ""} onChange={(e) => setCalendarForm({ ...calendarForm, concept: e.target.value })} placeholder="Brief storyboard or visual concepts..." rows={2} className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none resize-none font-medium" />
                        </div>
                        {/* Issues List inside Full Edit Modal */}
                        {editingCalendarItem && currentSelectedProject && (
                          <div className="space-y-2 p-4 bg-rose-500/5 rounded-2xl border border-rose-500/20">
                            <h4 className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block mb-1">Active Issues ({(calendarForm.issues || []).length})</h4>
                            <div className="space-y-1.5 max-h-[100px] overflow-y-auto pr-1">
                              {((calendarForm.issues || [])).map((issue: any) => (
                                <div key={issue.id} className="flex justify-between items-start text-[11px] font-bold text-rose-700 bg-white/50 p-1.5 rounded-lg border border-rose-500/10">
                                  <span className="text-left">{issue.text} <span className="text-[9px] text-rose-400 font-mono">({issue.timestamp})</span></span>
                                  <button type="button" onClick={() => {
                                    const updated = (calendarForm.issues || []).filter((i: any) => i.id !== issue.id);
                                    setCalendarForm({ ...calendarForm, issues: updated });
                                    logProjectActivity(currentSelectedProject.id, "Resolved Issue", `Resolved issue "${issue.text}" on content idea "${calendarForm.topic}"`);
                                  }} className="text-[9px] text-rose-500 hover:text-rose-700 ml-1">✕</button>
                                </div>
                              ))}
                            </div>
                            <div className="flex gap-2 mt-2">
                              <input 
                                type="text"
                                placeholder="Log a new issue..."
                                id="modal_new_issue_input"
                                className="flex-1 px-3 py-1.5 bg-background border border-border/50 rounded-xl text-xs focus:outline-none font-semibold text-foreground"
                              />
                              <button 
                                type="button"
                                onClick={() => {
                                  const input = document.getElementById("modal_new_issue_input") as HTMLInputElement;
                                  if (input && input.value.trim()) {
                                    const now = new Date();
                                    const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                                    const newIssue = {
                                      id: `issue-${Date.now()}`,
                                      text: input.value.trim(),
                                      timestamp: dateStr
                                    };
                                    setCalendarForm({
                                      ...calendarForm,
                                      issues: [...(calendarForm.issues || []), newIssue]
                                    });
                                    logProjectActivity(currentSelectedProject.id, "Logged Issue", `Added issue "${input.value.trim()}" on content idea "${calendarForm.topic}"`);
                                    input.value = "";
                                  }
                                }}
                                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition-colors shadow-sm"
                              >
                                Log
                              </button>
                            </div>
                          </div>
                        )}
                        <div>
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Reference / Inspiration Link</label>
                          <input type="text" value={calendarForm.reference || ""} onChange={(e) => setCalendarForm({ ...calendarForm, reference: e.target.value })} placeholder="Inspiration URL or references" className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none" />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                              Assign Team / Brand Person
                            </label>
                            <span className="text-[10px] text-muted-foreground font-medium">
                              {((calendarForm.assignedTo || []).length > 0) ? `${calendarForm.assignedTo.length} selected` : "Select members"}
                            </span>
                          </div>
                          <div className="max-h-[160px] overflow-y-auto pr-1 space-y-1.5 custom-scrollbar border border-border/50 rounded-xl p-2 bg-muted/20">
                            {(() => {
                              const peopleList: { id: string; name: string; avatar: string; subtitle: string; isCreativeRole?: boolean }[] = [];
                              const seen = new Set<string>();

                              // 1. Creative team members assigned to this project
                              if (currentSelectedProject?.creativeTeam) {
                                Object.entries(currentSelectedProject.creativeTeam).forEach(([roleKey, empId]) => {
                                  if (!empId) return;
                                  const emp = employees.find(e => String(e.id) === String(empId) || String((e as any)._id) === String(empId));
                                  const roleObj = CREATIVE_ROLES.find(r => r.key === roleKey);
                                  const name = emp?.name || currentSelectedProject.creativeTeamDetails?.[roleKey]?.employee_name;
                                  if (name && !seen.has(name) && name !== "Team Member") {
                                    seen.add(name);
                                    peopleList.push({
                                      id: String(emp?.id || empId),
                                      name,
                                      avatar: emp?.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(name)}`,
                                      subtitle: roleObj?.label || "Creative Team",
                                      isCreativeRole: true
                                    });
                                  }
                                });
                              }

                              // 2. All company employees from HRMS
                              employees.forEach(emp => {
                                if (emp && emp.name && !seen.has(emp.name) && emp.name !== "Team Member") {
                                  seen.add(emp.name);
                                  peopleList.push({
                                    id: String(emp.id),
                                    name: emp.name,
                                    avatar: emp.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(emp.name)}`,
                                    subtitle: emp.department || emp.role || "Staff",
                                    isCreativeRole: false
                                  });
                                }
                              });

                              if (peopleList.length === 0) {
                                return (
                                  <div className="py-3 text-center text-xs text-muted-foreground">
                                    No team members found.
                                  </div>
                                );
                              }

                              return (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                  {peopleList.map(person => {
                                    const isAssigned = (calendarForm.assignedTo || []).includes(person.name);
                                    return (
                                      <button
                                        key={person.name}
                                        type="button"
                                        onClick={() => {
                                          const list = calendarForm.assignedTo || [];
                                          setCalendarForm({
                                            ...calendarForm,
                                            assignedTo: isAssigned 
                                              ? list.filter((n: string) => n !== person.name)
                                              : [...list, person.name]
                                          });
                                        }}
                                        className={cn(
                                          "flex items-center gap-2 p-2 rounded-xl text-left border text-xs font-semibold transition-all",
                                          isAssigned
                                            ? "border-primary/50 bg-primary/10 text-primary shadow-xs"
                                            : "border-border/50 bg-card hover:bg-muted text-muted-foreground hover:text-foreground"
                                        )}
                                      >
                                        <div className="relative shrink-0">
                                          <img src={person.avatar} className="w-6 h-6 rounded-full object-cover" />
                                          {isAssigned && (
                                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-[8px] font-bold">
                                              ✓
                                            </div>
                                          )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <span className="truncate block font-bold text-foreground text-xs leading-tight">
                                            {person.name}
                                          </span>
                                          <span className={cn(
                                            "truncate block text-[10px]",
                                            person.isCreativeRole ? "text-primary font-bold" : "text-muted-foreground"
                                          )}>
                                            {person.subtitle}
                                          </span>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </>
                    )}
                    {activeCalendarTab === 'production' && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Script Date</label>
                            <DatePicker 
                              value={calendarForm.scriptDate || ""} 
                              onChange={(val) => setCalendarForm({ ...calendarForm, scriptDate: val })} 
                              className="w-full h-9 px-3 py-1.5 bg-muted/50 border border-border/50 rounded-xl text-xs font-semibold" 
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Script Link</label>
                            <input type="text" value={calendarForm.scriptLink || ""} onChange={(e) => setCalendarForm({ ...calendarForm, scriptLink: e.target.value })} placeholder="Docs script Link" className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Shoot Date</label>
                            <DatePicker 
                              value={calendarForm.shootDate || ""} 
                              onChange={(val) => setCalendarForm({ ...calendarForm, shootDate: val })} 
                              className="w-full h-9 px-3 py-1.5 bg-muted/50 border border-border/50 rounded-xl text-xs font-semibold" 
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Shoot Assets Link</label>
                            <input type="text" value={calendarForm.shootLink || ""} onChange={(e) => setCalendarForm({ ...calendarForm, shootLink: e.target.value })} placeholder="Drive assets folder URL" className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Editing Start Date</label>
                            <DatePicker 
                              value={calendarForm.editingStart || ""} 
                              onChange={(val) => setCalendarForm({ ...calendarForm, editingStart: val })} 
                              className="w-full h-9 px-3 py-1.5 bg-muted/50 border border-border/50 rounded-xl text-xs font-semibold" 
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Final Reel Link (Video)</label>
                            <input type="text" value={calendarForm.finalReelLink || ""} onChange={(e) => setCalendarForm({ ...calendarForm, finalReelLink: e.target.value })} placeholder="Reel draft link (Drive/Vimeo)" className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Final Post Link (Graphic / Carousel)</label>
                            <input type="text" value={calendarForm.finalPostLink || ""} onChange={(e) => setCalendarForm({ ...calendarForm, finalPostLink: e.target.value })} placeholder="Post / Carousel design draft link" className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none" />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Thumbnail Date</label>
                            <DatePicker 
                              value={calendarForm.thumbnailDate || ""} 
                              onChange={(val) => setCalendarForm({ ...calendarForm, thumbnailDate: val })} 
                              className="w-full h-9 px-3 py-1.5 bg-muted/50 border border-border/50 rounded-xl text-xs font-semibold" 
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Thumbnail Link</label>
                            <input type="text" value={calendarForm.thumbnailLink || ""} onChange={(e) => setCalendarForm({ ...calendarForm, thumbnailLink: e.target.value })} placeholder="Cover / Thumbnail design link" className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none" />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Caption Date</label>
                            <DatePicker 
                              value={calendarForm.captionDate || ""} 
                              onChange={(val) => setCalendarForm({ ...calendarForm, captionDate: val })} 
                              className="w-full h-9 px-3 py-1.5 bg-muted/50 border border-border/50 rounded-xl text-xs font-semibold" 
                            />
                          </div>
                        </div>
                      </>
                    )}
                    {activeCalendarTab === 'publishing' && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Approval Feedback (Het / Client)</label>
                            <input type="text" value={calendarForm.approval || ""} onChange={(e) => setCalendarForm({ ...calendarForm, approval: e.target.value })} placeholder="e.g. Approved / Changes requested" className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none" />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Workflow Status</label>
                            <Select value={calendarForm.status || "To Do"} onValueChange={(val) => setCalendarForm({ ...calendarForm, status: val })}>
                              <SelectTrigger className="w-full h-9 bg-muted/50 border-border/50 rounded-xl text-xs font-semibold">
                                <SelectValue placeholder="Workflow Status" />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl border-border/60 shadow-xl bg-background/95 backdrop-blur-md z-[300]">
                                {["To Do", "In Progress", "Pending Approval", "Approved", "Published"].map(st => (
                                  <SelectItem key={st} value={st} className="text-xs font-semibold rounded-lg cursor-pointer">
                                    {st}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Caption Text &amp; Hashtags</label>
                          <textarea value={calendarForm.caption || ""} onChange={(e) => setCalendarForm({ ...calendarForm, caption: e.target.value })} placeholder="Write finalized copy and hashtags here..." rows={3} className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none resize-none font-medium" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Actual Posting Date</label>
                            <DatePicker 
                              value={calendarForm.actualPostingDate || ""} 
                              onChange={(val) => setCalendarForm({ ...calendarForm, actualPostingDate: val })} 
                              className="w-full h-9 px-3 py-1.5 bg-muted/50 border border-border/50 rounded-xl text-xs font-semibold" 
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Live Instagram Link</label>
                            <input type="text" value={calendarForm.postingLinkOfIg || ""} onChange={(e) => setCalendarForm({ ...calendarForm, postingLinkOfIg: e.target.value })} placeholder="https://www.instagram.com/p/..." className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none" />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Remarks &amp; Details</label>
                          <input type="text" value={calendarForm.remark || ""} onChange={(e) => setCalendarForm({ ...calendarForm, remark: e.target.value })} placeholder="e.g. Needs collab tag with client" className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none" />
                        </div>
                      </>
                    )}
                  </div>
                </div>
                {/* Footer */}
                <div className="px-8 py-4 bg-muted/30 border-t border-border/50 flex justify-end gap-3 shrink-0">
                  <button onClick={() => { setIsAddCalendarItemModalOpen(false); setEditingCalendarItem(null); }} className="px-4 py-2 rounded-xl font-bold text-sm text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
                  <button
                    onClick={async () => {
                      if (!calendarForm.postingDate || !calendarForm.topic || !calendarForm.topic.trim()) {
                        toast.error("Posting Date and Topic Hook are required");
                        return;
                      }
                      if (!currentSelectedProject) return;

                      const payload = mapCalendarItemToBackendPayload(calendarForm, currentSelectedProject.id);

                      try {
                        if (editingCalendarItem) {
                          const res = await api.put(`/projects/${currentSelectedProject.id}/content/${editingCalendarItem.id}`, payload);
                          const savedItem = res ? mapBackendContentToCalendarItem(res) : {
                            ...editingCalendarItem,
                            ...calendarForm,
                          };
                          const updated = (currentSelectedProject.contentCalendar || []).map((item: any) =>
                            item.id === editingCalendarItem.id ? savedItem : item
                          );
                          setProjects(projects.map(p => p.id === currentSelectedProject.id ? { ...p, contentCalendar: updated, modules: syncSocialMediaTasksForProject(p, updated) } : p));
                          toast.success("Content Idea updated successfully!");
                        } else {
                          const res = await api.post(`/projects/${currentSelectedProject.id}/content`, payload);
                          const completeItem = res ? mapBackendContentToCalendarItem(res) : {
                            id: `cal-${Date.now()}`,
                            ...calendarForm,
                          };
                          const updated = [...(currentSelectedProject.contentCalendar || []), completeItem];
                          setProjects(projects.map(p => p.id === currentSelectedProject.id ? { ...p, contentCalendar: updated, modules: syncSocialMediaTasksForProject(p, updated) } : p));
                          toast.success("Content Idea added to calendar!");
                        }
                        setIsAddCalendarItemModalOpen(false);
                        setEditingCalendarItem(null);
                      } catch (err: any) {
                        toast.error(err.message || "Failed to save content idea");
                      }
                    }}
                    className="px-5 py-2 bg-primary text-primary-foreground font-bold rounded-xl shadow-md hover:bg-primary/90 transition-all text-sm"
                  >
                    {editingCalendarItem ? "Save Changes" : "Create Idea"}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Bulk Add Calendar Slots Modal */}
        {isBulkAddModalOpen && (() => {
          const currentSelectedProject = projects.find(p => p.id === selectedProjectId);
          
          const getDatesForFormat = (formatType: string): Date[] => {
            if (!currentSelectedProject || !currentSelectedProject.contentCalendar) return [];
            const target = formatType.toLowerCase();
            return currentSelectedProject.contentCalendar
              .filter(item => {
                const it = (item.type || "").toLowerCase();
                if (target === "reel") return it === "reel";
                if (target === "post") return it === "post";
                if (target === "carousel") return it === "carousel";
                if (target === "story") return it === "story";
                return it === target;
              })
              .map(item => {
                const rawDate = item.scheduledDate || item.postingDate;
                if (!rawDate) return null;
                const datePart = String(rawDate).split("T")[0] || "";
                const parts = datePart.split("-");
                if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
                  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                }
                const d = new Date(rawDate);
                return isNaN(d.getTime()) ? null : d;
              })
              .filter((d): d is Date => d !== null);
          };

          const handleSelectFormatType = (newType: string) => {
            setBulkFormatType(newType);
            if (bulkAddTab === 'visual') {
              const dates = getDatesForFormat(newType);
              setVisualSelectedDates(dates);
            }
          };

          const handleGenerateBulkSlots = async () => {
            if (!bulkStartDate || !bulkEndDate) {
              toast.error("Please select start and end dates");
              return;
            }
            if (bulkSelectedDays.length === 0) {
              toast.error("Please select at least one day of the week");
              return;
            }
            if (!currentSelectedProject) return;

            const start = new Date(bulkStartDate);
            const end = new Date(bulkEndDate);
            
            if (end < start) {
              toast.error("End date cannot be before start date");
              return;
            }

            // Map JS getDay (0=Sun, 1=Mon, ..., 6=Sat) to Python weekday (0=Mon, ..., 6=Sun)
            const pythonWeekdays = bulkSelectedDays.map(d => (d === 0 ? 6 : d - 1));

            try {
              const res = await api.post<any[]>(`/projects/${currentSelectedProject.id}/content/bulk`, {
                default_format: bulkFormatType === "Carousel" ? "Post" : bulkFormatType,
                date_range: {
                  start_date: bulkStartDate,
                  end_date: bulkEndDate,
                  weekdays: pythonWeekdays
                }
              });

              if (Array.isArray(res) && res.length > 0) {
                await fetchProjectContentCalendar(currentSelectedProject.id);
                setIsBulkAddModalOpen(false);
                toast.success(`Generated ${res.length} calendar slots successfully!`);
              } else {
                toast.info("No new slots generated matching the criteria.");
              }
            } catch (err: any) {
              toast.error(err.message || "Failed to generate bulk slots");
            }
          };

          const handleSyncVisualDates = async () => {
            if (!currentSelectedProject) return;
            
            const selectedStrings = (visualSelectedDates || []).map(date => {
              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, '0');
              const day = String(date.getDate()).padStart(2, '0');
              return `${year}-${month}-${day}`;
            });

            const calendarItems = currentSelectedProject.contentCalendar || [];
            const targetType = bulkFormatType.toLowerCase();

            const existingForFormat = calendarItems.filter(item => {
              const it = (item.type || "").toLowerCase();
              if (targetType === "reel") return it === "reel";
              if (targetType === "post") return it === "post";
              if (targetType === "carousel") return it === "carousel";
              if (targetType === "story") return it === "story";
              return it === targetType;
            });

            const existingDateStrings = existingForFormat.map(item => {
              const raw = item.scheduledDate || item.postingDate || "";
              return String(raw).split("T")[0] || "";
            }).filter(Boolean);

            const datesToAdd = selectedStrings.filter(d => !existingDateStrings.includes(d));
            const itemsToDelete = existingForFormat.filter(item => {
              const d = String(item.scheduledDate || item.postingDate || "").split("T")[0] || "";
              return Boolean(d) && !selectedStrings.includes(d);
            });

            try {
              let addedCount = 0;
              let deletedCount = 0;

              if (datesToAdd.length > 0) {
                const res = await api.post<any[]>(`/projects/${currentSelectedProject.id}/content/bulk`, {
                  default_format: bulkFormatType === "Carousel" ? "Post" : bulkFormatType,
                  specific_dates: datesToAdd
                });
                if (Array.isArray(res)) addedCount = res.length;
              }

              for (const item of itemsToDelete) {
                try {
                  await api.delete(`/projects/${currentSelectedProject.id}/content/${item.id}`);
                  deletedCount++;
                } catch (delErr) {
                  console.warn("Failed to delete content slot:", item.id, delErr);
                }
              }

              await fetchProjectContentCalendar(currentSelectedProject.id);
              setIsBulkAddModalOpen(false);

              if (addedCount > 0 || deletedCount > 0) {
                toast.success(`Successfully synced ${bulkFormatType} slots (Added: ${addedCount}, Removed: ${deletedCount})`);
              } else {
                toast.info(`No changes to sync for ${bulkFormatType}`);
              }
            } catch (err: any) {
              toast.error(err.message || "Failed to sync content slots");
            }
          };

          const toggleDay = (dayIndex: number) => {
            if (bulkSelectedDays.includes(dayIndex)) {
              setBulkSelectedDays(bulkSelectedDays.filter(d => d !== dayIndex));
            } else {
              setBulkSelectedDays([...bulkSelectedDays, dayIndex]);
            }
          };

          const daysConfig = [
            { label: "M", index: 1, name: "Monday" },
            { label: "T", index: 2, name: "Tuesday" },
            { label: "W", index: 3, name: "Wednesday" },
            { label: "T", index: 4, name: "Thursday" },
            { label: "F", index: 5, name: "Friday" },
            { label: "S", index: 6, name: "Saturday" },
            { label: "S", index: 0, name: "Sunday" },
          ];

          const formatOptions = [
            { key: "Post", label: "🖼️ Post", count: getDatesForFormat("Post").length },
            { key: "Reel", label: "🎥 Reel", count: getDatesForFormat("Reel").length },
            { key: "Carousel", label: "🎠 Carousel", count: getDatesForFormat("Carousel").length },
            { key: "Story", label: "📖 Story", count: getDatesForFormat("Story").length },
          ];

          return (
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center animate-in fade-in duration-200"
              onClick={() => setIsBulkAddModalOpen(false)}
            >
              {/* Backdrop */}
              <div className="absolute inset-0 bg-black/80" />
              {/* Modal Panel */}
              <div
                className="relative z-10 w-[calc(100%-2rem)] max-w-[550px] bg-card border border-border/60 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-8 py-6 border-b border-border/50 bg-muted/30 shrink-0">
                  <div>
                    <h2 className="text-xl font-black tracking-tight">Bulk Add Options</h2>
                    <p className="text-xs text-muted-foreground mt-1">Select dates visually or generate using a range</p>
                  </div>
                  <button
                    onClick={() => setIsBulkAddModalOpen(false)}
                    className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Tab Switcher */}
                <div className="flex border-b border-border/30 bg-muted/10 p-2 gap-2 shrink-0">
                  <button
                    onClick={() => setBulkAddTab('range')}
                    className={cn(
                      "flex-1 py-2 text-xs font-bold rounded-xl transition-all",
                      bulkAddTab === 'range'
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    📅 Date Range &amp; Weekdays
                  </button>
                  <button
                    onClick={() => {
                      setBulkAddTab('visual');
                      const dates = getDatesForFormat(bulkFormatType);
                      setVisualSelectedDates(dates);
                    }}
                    className={cn(
                      "flex-1 py-2 text-xs font-bold rounded-xl transition-all",
                      bulkAddTab === 'visual'
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    ✨ Visual Calendar Sync
                  </button>
                </div>

                {/* Body */}
                <div className="p-6 md:p-8 space-y-5 overflow-y-auto max-h-[60vh] flex flex-col items-center">
                  {bulkAddTab === 'range' ? (
                    <div className="w-full space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Start Date</label>
                          <DatePicker 
                            value={bulkStartDate} 
                            onChange={(val) => setBulkStartDate(val)} 
                            className="w-full h-9 px-3 py-1.5 bg-muted/50 border border-border/50 rounded-xl text-xs font-bold text-center" 
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">End Date</label>
                          <DatePicker 
                            value={bulkEndDate} 
                            onChange={(val) => setBulkEndDate(val)} 
                            className="w-full h-9 px-3 py-1.5 bg-muted/50 border border-border/50 rounded-xl text-xs font-bold text-center" 
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">Days of the Week</label>
                        <div className="flex justify-between items-center gap-1.5 bg-muted/20 p-2 rounded-xl border border-border/30">
                          {daysConfig.map((day) => {
                            const isSelected = bulkSelectedDays.includes(day.index);
                            return (
                              <button
                                key={day.index}
                                type="button"
                                onClick={() => toggleDay(day.index)}
                                title={day.name}
                                className={cn(
                                  "w-9 h-9 rounded-lg text-xs font-black transition-all flex items-center justify-center border shadow-sm",
                                  isSelected 
                                    ? "bg-primary text-primary-foreground border-primary" 
                                    : "bg-card text-muted-foreground border-border/50 hover:bg-muted"
                                )}
                              >
                                {day.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center w-full space-y-4">
                      {/* Format Selector Pills for Instant Visual Toggle */}
                      <div className="flex flex-wrap items-center justify-center gap-2 p-1.5 bg-muted/30 border border-border/50 rounded-2xl w-full">
                        {formatOptions.map(f => {
                          const isSelected = bulkFormatType === f.key;
                          return (
                            <button
                              key={f.key}
                              type="button"
                              onClick={() => handleSelectFormatType(f.key)}
                              className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border",
                                isSelected
                                  ? "bg-primary text-primary-foreground border-primary shadow-sm ring-2 ring-primary/30"
                                  : "bg-card text-muted-foreground border-border/60 hover:text-foreground hover:bg-muted"
                              )}
                            >
                              <span>{f.label}</span>
                              <span className={cn(
                                "text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold",
                                isSelected ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                              )}>
                                {f.count}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Active Status Banner */}
                      <div className="flex items-center justify-between w-full px-3.5 py-2 bg-primary/5 border border-primary/20 rounded-xl text-xs">
                        <span className="font-bold text-foreground flex items-center gap-1.5">
                          Viewing slots for: <strong className="text-primary underline font-extrabold">{bulkFormatType}</strong>
                        </span>
                        <span className="text-[11px] font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-lg">
                          {(visualSelectedDates || []).length} dates active
                        </span>
                      </div>

                      <p className="text-[11px] text-muted-foreground text-center font-medium max-w-[420px]">
                        Click dates in the calendar below to toggle <strong>{bulkFormatType}</strong> slots. Selected dates are scheduled for this format.
                      </p>

                      <div className="border border-border/50 rounded-2xl p-4 bg-muted/10 shadow-inner flex justify-center w-full">
                        <CalendarUI
                          mode="multiple"
                          selected={visualSelectedDates}
                          onSelect={(newDates) => setVisualSelectedDates(newDates || [])}
                          className="rounded-md border-0 bg-transparent font-medium"
                          {...({ required: false } as any)}
                        />
                      </div>
                    </div>
                  )}

                  <div className="w-full">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Format Type</label>
                    <div className="relative">
                      <select 
                        value={bulkFormatType} 
                        onChange={(e) => handleSelectFormatType(e.target.value)}
                        className="w-full h-9 px-3 bg-muted/50 border border-border/50 rounded-xl text-xs font-bold appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        {["Post", "Reel", "Story", "Carousel"].map(t => (
                          <option key={t} value={t} className="bg-background text-foreground font-semibold py-1">
                            {t}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground">
                        <ChevronDown className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-8 py-4 bg-muted/30 border-t border-border/50 flex justify-end gap-3 shrink-0">
                  <button 
                    onClick={() => setIsBulkAddModalOpen(false)} 
                    className="px-4 py-2 rounded-xl font-bold text-sm text-muted-foreground hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={bulkAddTab === 'range' ? handleGenerateBulkSlots : handleSyncVisualDates}
                    className="px-5 py-2 bg-primary text-primary-foreground font-bold rounded-xl shadow-md hover:bg-primary/90 transition-all text-sm"
                  >
                    {bulkAddTab === 'range' ? "Generate Slots" : `Sync ${bulkFormatType} Dates`}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Add Module Modal - plain overlay */}
        {isAddModuleModalOpen && (() => {
          const currentSelectedProject = projects.find(p => p.id === selectedProjectId);
          if (!currentSelectedProject) return null;

          const handleSaveNewModule = (e: React.FormEvent) => {
            e.preventDefault();
            if (!addModuleForm.name.trim()) return;
            const projectModules = currentSelectedProject.modules || [];
            const newModule: any = {
              id: `mod-${Date.now()}`,
              name: addModuleForm.name.trim(),
              assignedToName: addModuleForm.assignedToName || undefined,
              status: addModuleForm.status,
              priority: addModuleForm.priority,
              estimatedHours: addModuleForm.estimatedHours || undefined,
              dueDate: addModuleForm.dueDate || undefined,
              tasks: []
            };
            const updatedModules: any = [...projectModules, newModule];
            saveProjectModules(currentSelectedProject.id, updatedModules, "Added Module", `Created module "${newModule.name}"`);
            setSelectedModuleId(newModule.id);
            setAddModuleForm({
              name: "",
              assignedToName: "",
              status: "todo",
              priority: "medium",
              estimatedHours: 0,
              dueDate: ""
            });
            setIsAddModuleModalOpen(false);
            toast.success(`Module "${newModule.name}" created successfully!`);
          };

          return (
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center animate-in fade-in duration-200"
              onClick={() => setIsAddModuleModalOpen(false)}
            >
              {/* Backdrop */}
              <div className="absolute inset-0 bg-black/80" />
              {/* Modal Panel */}
              <div
                className="relative z-10 w-[calc(100%-2rem)] max-w-[450px] bg-card border border-border/60 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-8 py-6 border-b border-border/50 bg-muted/30 shrink-0">
                  <div>
                    <h2 className="text-lg font-black tracking-tight">Add New Module</h2>
                    <p className="text-xs text-muted-foreground mt-1">Configure and assign a new development module component</p>
                  </div>
                  <button
                    onClick={() => setIsAddModuleModalOpen(false)}
                    className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {/* Body */}
                <form onSubmit={handleSaveNewModule}>
                  <div className="p-8 space-y-4 max-h-[60vh] overflow-y-auto">
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Module Name <span className="text-rose-500">*</span></label>
                      <input 
                        type="text" 
                        required
                        autoFocus
                        placeholder="e.g. User Authentication, Shopping Cart"
                        value={addModuleForm.name} 
                        onChange={(e) => setAddModuleForm({ ...addModuleForm, name: e.target.value })} 
                        className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary font-semibold" 
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Assign To</label>
                        <Select 
                          value={addModuleForm.assignedToName || "unassigned"} 
                          onValueChange={(val) => setAddModuleForm({ ...addModuleForm, assignedToName: val === "unassigned" ? "" : val })}
                        >
                          <SelectTrigger className="w-full h-9 bg-muted/50 border-border/50 rounded-xl text-xs font-semibold">
                            <SelectValue placeholder="Unassigned" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-border/60 shadow-xl bg-background/95 backdrop-blur-md z-[300]">
                            <SelectItem value="unassigned" className="text-xs font-semibold rounded-lg cursor-pointer">Unassigned</SelectItem>
                            {currentSelectedProject.team.map(m => (
                              <SelectItem key={m.name} value={m.name} className="text-xs font-semibold rounded-lg cursor-pointer">{m.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Stage Status</label>
                        <Select 
                          value={addModuleForm.status || "todo"} 
                          onValueChange={(val) => setAddModuleForm({ ...addModuleForm, status: val as any })}
                        >
                          <SelectTrigger className="w-full h-9 bg-muted/50 border-border/50 rounded-xl text-xs font-semibold">
                            <SelectValue placeholder="Stage Status" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-border/60 shadow-xl bg-background/95 backdrop-blur-md z-[300]">
                            {[
                              { label: "To Do", val: "todo" },
                              { label: "In Progress", val: "in-progress" },
                              { label: "Bugs", val: "bugs" },
                              { label: "On Hold", val: "onhold" },
                              { label: "Pending", val: "pending" },
                              { label: "Completed", val: "completed" },
                            ].map(st => (
                              <SelectItem key={st.val} value={st.val} className="text-xs font-semibold rounded-lg cursor-pointer">{st.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Priority</label>
                        <Select 
                          value={addModuleForm.priority || "medium"} 
                          onValueChange={(val) => setAddModuleForm({ ...addModuleForm, priority: val as any })}
                        >
                          <SelectTrigger className="w-full h-9 bg-muted/50 border-border/50 rounded-xl text-xs font-semibold">
                            <SelectValue placeholder="Priority" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-border/60 shadow-xl bg-background/95 backdrop-blur-md z-[300]">
                            {[
                              { label: "Low", val: "low" },
                              { label: "Medium", val: "medium" },
                              { label: "High", val: "high" },
                              { label: "Urgent", val: "urgent" },
                            ].map(pr => (
                              <SelectItem key={pr.val} value={pr.val} className="text-xs font-semibold rounded-lg cursor-pointer">{pr.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Estimated Hours</label>
                        <input 
                          type="number" 
                          min="0"
                          step="0.5"
                          placeholder="e.g. 12"
                          value={addModuleForm.estimatedHours || ""} 
                          onChange={(e) => setAddModuleForm({ ...addModuleForm, estimatedHours: parseFloat(e.target.value) || 0 })} 
                          className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary font-bold text-center" 
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Module Deadline</label>
                      <DatePicker 
                        value={addModuleForm.dueDate} 
                        onChange={(val) => setAddModuleForm({ ...addModuleForm, dueDate: val })} 
                        className="w-full h-9 px-3 py-1.5 bg-muted/50 border border-border/50 rounded-xl text-xs font-bold text-center" 
                      />
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="px-8 py-4 bg-muted/30 border-t border-border/50 flex justify-end gap-3 shrink-0">
                    <button 
                      type="button"
                      onClick={() => setIsAddModuleModalOpen(false)} 
                      className="px-4 py-2 rounded-xl font-bold text-sm text-muted-foreground hover:bg-muted transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-primary text-primary-foreground font-bold rounded-xl shadow-md hover:bg-primary/90 transition-all text-sm"
                    >
                      Create Module
                    </button>
                  </div>
                </form>
              </div>
            </div>
          );
        })()}

        {/* Edit Module Modal - plain overlay */}
        {isEditModuleModalOpen && editModuleForm.id && (() => {
          const currentSelectedProject = projects.find(p => p.id === selectedProjectId);
          if (!currentSelectedProject) return null;

          const handleEditModuleSubmit = (e: React.FormEvent) => {
            e.preventDefault();
            if (!editModuleForm.name.trim()) return;
            const projectModules = currentSelectedProject.modules || [];
            
            const updatedModules: any = projectModules.map(m => {
              if (m.id === editModuleForm.id) {
                return {
                  ...m,
                  name: editModuleForm.name.trim(),
                  assignedToName: editModuleForm.assignedToName || undefined,
                  status: editModuleForm.status,
                  priority: editModuleForm.priority,
                  estimatedHours: editModuleForm.estimatedHours || undefined,
                  dueDate: editModuleForm.dueDate || undefined
                };
              }
              return m;
            });

            saveProjectModules(currentSelectedProject.id, updatedModules, "Updated Module", `Updated module "${editModuleForm.name.trim()}"`);
            setIsEditModuleModalOpen(false);
            toast.success("Module updated successfully!");
          };

          return (
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center animate-in fade-in duration-200"
              onClick={() => setIsEditModuleModalOpen(false)}
            >
              {/* Backdrop */}
              <div className="absolute inset-0 bg-black/80" />
              {/* Modal Panel */}
              <div
                className="relative z-10 w-[calc(100%-2rem)] max-w-[450px] bg-card border border-border/60 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-8 py-6 border-b border-border/50 bg-muted/30 shrink-0">
                  <div>
                    <h2 className="text-lg font-black tracking-tight">Edit Module Details</h2>
                    <p className="text-xs text-muted-foreground mt-1">Modify metadata and developer assignment details</p>
                  </div>
                  <button
                    onClick={() => setIsEditModuleModalOpen(false)}
                    className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {/* Body */}
                <form onSubmit={handleEditModuleSubmit}>
                  <div className="p-8 space-y-4 max-h-[60vh] overflow-y-auto">
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Module Name <span className="text-rose-500">*</span></label>
                      <input 
                        type="text" 
                        required
                        autoFocus
                        value={editModuleForm.name} 
                        onChange={(e) => setEditModuleForm({ ...editModuleForm, name: e.target.value })} 
                        className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary font-semibold" 
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Assign To</label>
                        <Select 
                          value={editModuleForm.assignedToName || "unassigned"} 
                          onValueChange={(val) => setEditModuleForm({ ...editModuleForm, assignedToName: val === "unassigned" ? "" : val })}
                        >
                          <SelectTrigger className="w-full h-9 bg-muted/50 border-border/50 rounded-xl text-xs font-semibold">
                            <SelectValue placeholder="Unassigned" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-border/60 shadow-xl bg-background/95 backdrop-blur-md z-[300]">
                            <SelectItem value="unassigned" className="text-xs font-semibold rounded-lg cursor-pointer">Unassigned</SelectItem>
                            {currentSelectedProject.team.map(m => (
                              <SelectItem key={m.name} value={m.name} className="text-xs font-semibold rounded-lg cursor-pointer">{m.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Stage Status</label>
                        <Select 
                          value={editModuleForm.status || "todo"} 
                          onValueChange={(val) => setEditModuleForm({ ...editModuleForm, status: val as any })}
                        >
                          <SelectTrigger className="w-full h-9 bg-muted/50 border-border/50 rounded-xl text-xs font-semibold">
                            <SelectValue placeholder="Stage Status" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-border/60 shadow-xl bg-background/95 backdrop-blur-md z-[300]">
                            {[
                              { label: "To Do", val: "todo" },
                              { label: "In Progress", val: "in-progress" },
                              { label: "Bugs", val: "bugs" },
                              { label: "On Hold", val: "onhold" },
                              { label: "Pending", val: "pending" },
                              { label: "Completed", val: "completed" },
                            ].map(st => (
                              <SelectItem key={st.val} value={st.val} className="text-xs font-semibold rounded-lg cursor-pointer">{st.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Priority</label>
                        <Select 
                          value={editModuleForm.priority || "medium"} 
                          onValueChange={(val) => setEditModuleForm({ ...editModuleForm, priority: val as any })}
                        >
                          <SelectTrigger className="w-full h-9 bg-muted/50 border-border/50 rounded-xl text-xs font-semibold">
                            <SelectValue placeholder="Priority" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-border/60 shadow-xl bg-background/95 backdrop-blur-md z-[300]">
                            {[
                              { label: "Low", val: "low" },
                              { label: "Medium", val: "medium" },
                              { label: "High", val: "high" },
                              { label: "Urgent", val: "urgent" },
                            ].map(pr => (
                              <SelectItem key={pr.val} value={pr.val} className="text-xs font-semibold rounded-lg cursor-pointer">{pr.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Estimated Hours</label>
                        <input 
                          type="number" 
                          min="0"
                          step="0.5"
                          placeholder="e.g. 12"
                          value={editModuleForm.estimatedHours || ""} 
                          onChange={(e) => setEditModuleForm({ ...editModuleForm, estimatedHours: parseFloat(e.target.value) || 0 })} 
                          className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary font-bold text-center" 
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Module Deadline</label>
                      <DatePicker 
                        value={editModuleForm.dueDate} 
                        onChange={(val) => setEditModuleForm({ ...editModuleForm, dueDate: val })} 
                        className="w-full h-9 px-3 py-1.5 bg-muted/50 border border-border/50 rounded-xl text-xs font-bold text-center" 
                      />
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="px-8 py-4 bg-muted/30 border-t border-border/50 flex justify-end gap-3 shrink-0">
                    <button 
                      type="button"
                      onClick={() => setIsEditModuleModalOpen(false)} 
                      className="px-4 py-2 rounded-xl font-bold text-sm text-muted-foreground hover:bg-muted transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-primary text-primary-foreground font-bold rounded-xl shadow-md hover:bg-primary/90 transition-all text-sm"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              </div>
            </div>
          );
        })()}

        {/* Presets Selection Modal - plain overlay */}
        {isPresetsModalOpen && (() => {
          const currentSelectedProject = projects.find(p => p.id === selectedProjectId);
          if (!currentSelectedProject) return null;

          const handleApplyPreset = (preset: any) => {
            const projectModules = currentSelectedProject.modules || [];
            
            const newModulesMapped: any[] = preset.modules.map((m: any) => ({
              id: `mod-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              name: m.name,
              assignedToName: m.assignedToName || undefined,
              status: m.status || "todo",
              priority: m.priority || "medium",
              estimatedHours: m.estimatedHours,
              dueDate: m.dueDate || undefined,
              tasks: (m.tasks || []).map((t: any) => ({
                id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                title: t.title,
                status: t.status || "todo"
              }))
            }));

            const updatedModules: any = [...projectModules, ...newModulesMapped];
            saveProjectModules(currentSelectedProject.id, updatedModules, "Applied Preset", `Loaded preset "${preset.name}"`);
            if (newModulesMapped[0]) {
              setSelectedModuleId(newModulesMapped[0].id);
            }
            setIsPresetsModalOpen(false);
            toast.success(`Successfully loaded preset "${preset.name}"!`);
          };

          return (
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center animate-in fade-in duration-200"
              onClick={() => setIsPresetsModalOpen(false)}
            >
              {/* Backdrop */}
              <div className="absolute inset-0 bg-black/80" />
              {/* Modal Panel */}
              <div
                className="relative z-10 w-[calc(100%-2rem)] max-w-[500px] bg-card border border-border/60 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-8 py-6 border-b border-border/50 bg-muted/30 shrink-0">
                  <div>
                    <h2 className="text-lg font-black tracking-tight">Load Modules from Preset</h2>
                    <p className="text-xs text-muted-foreground mt-1">Select a development template checklist to append</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setNewPresetForm({
                          name: "",
                          description: "",
                          modules: [{ name: "", tasks: [""] }]
                        });
                        setIsCreatePresetModalOpen(true);
                      }}
                      className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-xl shadow-md hover:bg-primary/90 flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Create Template
                    </button>
                    <button
                      onClick={() => setIsPresetsModalOpen(false)}
                      className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                {/* Body */}
                <div className="p-8 space-y-4 max-h-[60vh] overflow-y-auto">
                  {presets.map((preset, index) => (
                    <div 
                      key={index}
                      className="p-5 border border-border/50 rounded-[2rem] hover:border-primary/30 bg-muted/20 hover:bg-muted/30 transition-all flex flex-col justify-between gap-4"
                    >
                      <div>
                        <h3 className="text-sm font-bold text-foreground">⚙️ {preset.name}</h3>
                        <p className="text-xs text-muted-foreground mt-1 leading-normal">{preset.description}</p>
                        
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {preset.modules.map((m: any, idx: number) => (
                            <span key={idx} className="text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-lg">
                              📦 {m.name} ({m.tasks.length} tasks)
                            </span>
                          ))}
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center mt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmModalState({
                              isOpen: true,
                              title: "Delete Preset Template",
                              description: `Are you sure you want to delete the preset template "${preset.name}"? This action cannot be undone.`,
                              itemName: preset.name,
                              action: () => {
                                setPresets(presets.filter((_, i) => i !== index));
                                toast.success(`Preset "${preset.name}" deleted successfully!`);
                              }
                            });
                          }}
                          className="text-xs font-bold text-rose-500 hover:text-rose-600 px-3 py-1.5 rounded-xl hover:bg-rose-500/10 transition-all"
                        >
                          Delete Template
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplyPreset(preset)}
                          className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl shadow-md hover:bg-primary/90 transition-all"
                        >
                          Apply Template
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div className="px-8 py-4 bg-muted/30 border-t border-border/50 flex justify-end shrink-0">
                  <button 
                    type="button"
                    onClick={() => setIsPresetsModalOpen(false)} 
                    className="px-4 py-2 rounded-xl font-bold text-sm text-muted-foreground hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Create Preset Template Modal - plain overlay */}
        {isCreatePresetModalOpen && (() => {
          const handleSavePresetTemplate = (e: React.FormEvent) => {
            e.preventDefault();
            if (!newPresetForm.name.trim()) return;

            // Validate modules and tasks are filled
            const validModules = newPresetForm.modules
              .filter(m => m.name.trim() !== "")
              .map(m => ({
                name: m.name.trim(),
                assignedToName: "",
                status: "todo",
                priority: "medium",
                estimatedHours: 4,
                dueDate: "",
                tasks: m.tasks
                  .filter(t => t.trim() !== "")
                  .map((t, idx) => ({
                    id: `t-preset-${Date.now()}-${idx}-${Math.random().toString(36).substr(2,3)}`,
                    title: t.trim(),
                    status: "todo"
                  }))
              }));

            if (validModules.length === 0) {
              toast.error("Template must contain at least one module with name!");
              return;
            }

            const newPreset = {
              name: newPresetForm.name.trim(),
              description: newPresetForm.description.trim() || "Custom project module template",
              modules: validModules
            };

            setPresets([newPreset, ...presets]);
            setIsCreatePresetModalOpen(false);
            toast.success(`Preset Template "${newPreset.name}" created successfully!`);
          };

          const addModule = () => {
            setNewPresetForm({
              ...newPresetForm,
              modules: [...newPresetForm.modules, { name: "", tasks: [""] }]
            });
          };

          const removeModule = (mIdx: number) => {
            setNewPresetForm({
              ...newPresetForm,
              modules: newPresetForm.modules.filter((_, idx) => idx !== mIdx)
            });
          };

          const updateModuleName = (mIdx: number, val: string) => {
            setNewPresetForm({
              ...newPresetForm,
              modules: newPresetForm.modules.map((m, idx) => idx === mIdx ? { ...m, name: val } : m)
            });
          };

          const addTask = (mIdx: number) => {
            setNewPresetForm({
              ...newPresetForm,
              modules: newPresetForm.modules.map((m, idx) => idx === mIdx ? { ...m, tasks: [...m.tasks, ""] } : m)
            });
          };

          const removeTask = (mIdx: number, tIdx: number) => {
            setNewPresetForm({
              ...newPresetForm,
              modules: newPresetForm.modules.map((m, idx) => {
                if (idx === mIdx) {
                  return { ...m, tasks: m.tasks.filter((_, idx2) => idx2 !== tIdx) };
                }
                return m;
              })
            });
          };

          const updateTaskVal = (mIdx: number, tIdx: number, val: string) => {
            setNewPresetForm({
              ...newPresetForm,
              modules: newPresetForm.modules.map((m, idx) => {
                if (idx === mIdx) {
                  return { ...m, tasks: m.tasks.map((t, idx2) => idx2 === tIdx ? val : t) };
                }
                return m;
              })
            });
          };

          return (
            <div
              className="fixed inset-0 z-[210] flex items-center justify-center animate-in fade-in duration-200"
              onClick={() => setIsCreatePresetModalOpen(false)}
            >
              {/* Backdrop */}
              <div className="absolute inset-0 bg-black/80" />
              {/* Modal Panel */}
              <div
                className="relative z-10 w-[calc(100%-2rem)] max-w-[500px] bg-card border border-border/60 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-8 py-6 border-b border-border/50 bg-muted/30 shrink-0">
                  <div>
                    <h2 className="text-lg font-black tracking-tight">Create Preset Template</h2>
                    <p className="text-xs text-muted-foreground mt-1">Define custom reusable project modules & tasks checklist</p>
                  </div>
                  <button
                    onClick={() => setIsCreatePresetModalOpen(false)}
                    className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {/* Body */}
                <form onSubmit={handleSavePresetTemplate}>
                  <div className="p-8 space-y-4 max-h-[60vh] overflow-y-auto">
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Template Name <span className="text-rose-500">*</span></label>
                      <input 
                        type="text" 
                        required
                        autoFocus
                        placeholder="e.g. Core App Modules, Landing Page Setup"
                        value={newPresetForm.name} 
                        onChange={(e) => setNewPresetForm({ ...newPresetForm, name: e.target.value })} 
                        className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary font-semibold" 
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Description</label>
                      <input 
                        type="text" 
                        placeholder="Provide details on what this template covers..."
                        value={newPresetForm.description} 
                        onChange={(e) => setNewPresetForm({ ...newPresetForm, description: e.target.value })} 
                        className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary font-semibold" 
                      />
                    </div>

                    <div className="border-t border-border/30 pt-4 space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-foreground">📦 Modules List</span>
                        <button
                          type="button"
                          onClick={addModule}
                          className="text-[10px] font-bold text-primary hover:underline flex items-center gap-0.5"
                        >
                          + Add Module
                        </button>
                      </div>

                      {newPresetForm.modules.map((m, mIdx) => (
                        <div key={mIdx} className="p-4 border border-border/50 rounded-2xl bg-muted/10 space-y-3">
                          <div className="flex justify-between items-center gap-2">
                            <input 
                              type="text" 
                              required
                              placeholder="Module Name (e.g. Profile Setup)"
                              value={m.name} 
                              onChange={(e) => updateModuleName(mIdx, e.target.value)} 
                              className="px-2.5 py-1.5 bg-card border border-border/50 rounded-xl text-xs focus:outline-none font-bold flex-1" 
                            />
                            {newPresetForm.modules.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeModule(mIdx)}
                                className="text-xs text-rose-500 hover:text-rose-600 font-bold px-1.5"
                              >
                                Remove
                              </button>
                            )}
                          </div>

                          <div className="space-y-2 pl-4 border-l-2 border-border/30">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-bold text-muted-foreground">Tasks</span>
                              <button
                                type="button"
                                onClick={() => addTask(mIdx)}
                                className="text-[9px] font-bold text-primary hover:underline"
                              >
                                + Add Task
                              </button>
                            </div>

                            {m.tasks.map((t, tIdx) => (
                              <div key={tIdx} className="flex items-center gap-1">
                                <input 
                                  type="text" 
                                  required
                                  placeholder={`Task #${tIdx + 1} title`}
                                  value={t} 
                                  onChange={(e) => updateTaskVal(mIdx, tIdx, e.target.value)} 
                                  className="px-2.5 py-1 bg-card border border-border/30 rounded-lg text-xs focus:outline-none font-semibold flex-1" 
                                />
                                {m.tasks.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeTask(mIdx, tIdx)}
                                    className="text-xs text-rose-500 hover:text-rose-600 font-bold px-1"
                                  >
                                    &times;
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="px-8 py-4 bg-muted/30 border-t border-border/50 flex justify-end gap-3 shrink-0">
                    <button 
                      type="button"
                      onClick={() => setIsCreatePresetModalOpen(false)} 
                      className="px-4 py-2 rounded-xl font-bold text-sm text-muted-foreground hover:bg-muted transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-primary text-primary-foreground font-bold rounded-xl shadow-md hover:bg-primary/90 transition-all text-sm"
                    >
                      Save Template
                    </button>
                  </div>
                </form>
              </div>
            </div>
          );
        })()}

        {/* Module Task Details Modal - plain overlay */}
        {isModuleTaskModalOpen && editingModuleTask && (() => {
          const currentSelectedProject = projects.find(p => p.id === selectedProjectId);
          if (!currentSelectedProject) return null;
          const projectModules: NonNullable<Project['modules']> = currentSelectedProject.modules || [];
          const activeModule = projectModules.find(m => m.id === selectedModuleId) || projectModules[0];
          if (!activeModule) return null;

          const handleSaveTaskDetails = (e: React.FormEvent) => {
            e.preventDefault();
            const updatedTasks = activeModule.tasks.map(t => t.id === editingModuleTask.id ? editingModuleTask : t);
            const updatedModules: NonNullable<Project['modules']> = projectModules.map(m => m.id === activeModule.id ? { ...m, tasks: updatedTasks } : m);
            saveProjectModules(currentSelectedProject.id, updatedModules, "Updated Task", `Updated task "${editingModuleTask.title}"`);
            setIsModuleTaskModalOpen(false);
            setEditingModuleTask(null);
            toast.success("Task details saved successfully!");
          };

          return (
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center animate-in fade-in duration-200"
              onClick={() => {
                setIsModuleTaskModalOpen(false);
                setEditingModuleTask(null);
              }}
            >
              {/* Backdrop */}
              <div className="absolute inset-0 bg-black/80" />
              {/* Modal Panel */}
              <div
                className="relative z-10 w-[calc(100%-2rem)] max-w-[450px] bg-card border border-border/60 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-8 py-6 border-b border-border/50 bg-muted/30 shrink-0">
                  <div>
                    <h2 className="text-lg font-black tracking-tight">Edit Task Details</h2>
                    <p className="text-xs text-muted-foreground mt-1">Modify task metadata, assignment and status</p>
                  </div>
                  <button
                    onClick={() => {
                      setIsModuleTaskModalOpen(false);
                      setEditingModuleTask(null);
                    }}
                    className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {/* Body */}
                <form onSubmit={handleSaveTaskDetails}>
                  <div className="p-8 space-y-4 max-h-[50vh] overflow-y-auto">
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Task Title</label>
                      <input 
                        type="text" 
                        required
                        value={editingModuleTask.title} 
                        onChange={(e) => setEditingModuleTask({ ...editingModuleTask, title: e.target.value })} 
                        className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary font-semibold" 
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Phase</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Phase 1, Sprint A"
                          value={editingModuleTask.phase || ""} 
                          onChange={(e) => setEditingModuleTask({ ...editingModuleTask, phase: e.target.value })} 
                          className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary font-semibold" 
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Due Date</label>
                        <DatePicker 
                          value={editingModuleTask.dueDate || ""} 
                          onChange={(val) => setEditingModuleTask({ ...editingModuleTask, dueDate: val })} 
                          className="w-full h-9 px-3 py-1.5 bg-muted/50 border border-border/50 rounded-xl text-xs font-bold text-center" 
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Assigned Developer</label>
                        <select 
                          value={editingModuleTask.assignedToName || ""} 
                          onChange={(e) => setEditingModuleTask({ ...editingModuleTask, assignedToName: e.target.value })}
                          className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none font-bold"
                        >
                          <option value="">Unassigned</option>
                          {currentSelectedProject.team.map(m => (
                            <option key={m.name} value={m.name}>{m.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Status</label>
                        <select 
                          value={editingModuleTask.status} 
                          onChange={(e) => setEditingModuleTask({ ...editingModuleTask, status: e.target.value as any })}
                          className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none font-bold"
                        >
                          {["todo", "in-progress", "bugs", "onhold", "pending", "completed"].map(st => (
                            <option key={st} value={st}>{st === "todo" ? "To Do" : st === "in-progress" ? "In Progress" : st.charAt(0).toUpperCase() + st.slice(1)}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {(editingModuleTask.status === "onhold" || editingModuleTask.status === "pending") && (
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Pending/Hold Reason</label>
                        <textarea 
                          placeholder="Provide details on why this task is pending or on hold..."
                          value={editingModuleTask.reasonForPending || ""} 
                          onChange={(e) => setEditingModuleTask({ ...editingModuleTask, reasonForPending: e.target.value })} 
                          rows={3}
                          className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary font-semibold" 
                        />
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="px-8 py-4 bg-muted/30 border-t border-border/50 flex justify-end gap-3 shrink-0">
                    <button 
                      type="button"
                      onClick={() => {
                        setIsModuleTaskModalOpen(false);
                        setEditingModuleTask(null);
                      }} 
                      className="px-4 py-2 rounded-xl font-bold text-sm text-muted-foreground hover:bg-muted transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-primary text-primary-foreground font-bold rounded-xl shadow-md hover:bg-primary/90 transition-all text-sm"
                    >
                      Save Details
                    </button>
                  </div>
                </form>
              </div>
            </div>
          );
        })()}

        {/* Add Module Task Modal - plain overlay */}
                {/* Add/Edit Milestone Modal for Design & UI/UX */}
        {isAddMilestoneModalOpen && (() => {
          const currentSelectedProject = projects.find(p => p.id === selectedProjectId);
          if (!currentSelectedProject) return null;

          const handleSaveMilestone = (e: React.FormEvent) => {
            e.preventDefault();
            if (!milestoneForm.title.trim()) return;

            const projectModules = currentSelectedProject.modules || [];
            let milestonesModule = projectModules.find(m => m.id === "mod-milestones" || m.name === "Milestones");
            if (!milestonesModule) {
              milestonesModule = projectModules[0] || { id: "mod-milestones", name: "Milestones", tasks: [] };
            }
            const currentTasks = milestonesModule.tasks || [];

            let updatedTasks: any[];
            if (editingMilestone) {
              updatedTasks = currentTasks.map(t => t.id === editingMilestone.id ? {
                ...t,
                title: milestoneForm.title.trim(),
                dueDate: milestoneForm.dueDate || undefined,
                status: milestoneForm.status,
                assignedToName: milestoneForm.assignedToName || undefined
              } : t);
            } else {
              const newTask = {
                id: `ms-${Date.now()}`,
                title: milestoneForm.title.trim(),
                dueDate: milestoneForm.dueDate || undefined,
                status: milestoneForm.status,
                assignedToName: milestoneForm.assignedToName || undefined
              };
              updatedTasks = [...currentTasks, newTask];
            }

            const updatedModule = { ...milestonesModule, tasks: updatedTasks };
            const updatedModules = projectModules.some(m => m.id === milestonesModule.id)
              ? projectModules.map(m => m.id === milestonesModule.id ? updatedModule : m)
              : [updatedModule, ...projectModules];

            saveProjectModules(
              currentSelectedProject.id, 
              updatedModules, 
              editingMilestone ? "Updated Milestone" : "Added Milestone",
              `${editingMilestone ? "Updated" : "Added"} milestone "${milestoneForm.title.trim()}"`
            );

            setIsAddMilestoneModalOpen(false);
            setEditingMilestone(null);
            toast.success(editingMilestone ? "Milestone updated successfully!" : "Milestone created successfully!");
          };

          return (
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center animate-in fade-in duration-200"
              onClick={() => {
                setIsAddMilestoneModalOpen(false);
                setEditingMilestone(null);
              }}
            >
              <div className="absolute inset-0 bg-black/80" />
              <div
                className="relative z-10 w-[calc(100%-2rem)] max-w-[450px] bg-card border border-border/60 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-8 py-6 border-b border-border/50 bg-muted/30 shrink-0">
                  <div>
                    <h2 className="text-lg font-black tracking-tight">{editingMilestone ? "Edit Milestone" : "Add Milestone"}</h2>
                    <p className="text-xs text-muted-foreground mt-1">Configure milestone deliverable and schedule</p>
                  </div>
                  <button
                    onClick={() => {
                      setIsAddMilestoneModalOpen(false);
                      setEditingMilestone(null);
                    }}
                    className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleSaveMilestone}>
                  <div className="p-8 space-y-4 max-h-[60vh] overflow-y-auto">
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                        Milestone Title <span className="text-rose-500">*</span>
                      </label>
                      <input 
                        type="text" 
                        required
                        autoFocus
                        placeholder="e.g. Requirement Analysis, Design Phase"
                        value={milestoneForm.title} 
                        onChange={(e) => setMilestoneForm({ ...milestoneForm, title: e.target.value })} 
                        className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary font-semibold" 
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Due Date</label>
                        <DatePicker 
                          value={milestoneForm.dueDate} 
                          onChange={(val) => setMilestoneForm({ ...milestoneForm, dueDate: val })} 
                          className="w-full h-9 px-3 py-1.5 bg-muted/50 border border-border/50 rounded-xl text-xs font-bold text-center" 
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Status</label>
                        <select 
                          value={milestoneForm.status} 
                          onChange={(e) => setMilestoneForm({ ...milestoneForm, status: e.target.value as any })}
                          className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none font-bold"
                        >
                          <option value="todo">To Do</option>
                          <option value="in-progress">In Progress</option>
                          <option value="completed">Completed</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Assign Team Member</label>
                      <select 
                        value={milestoneForm.assignedToName} 
                        onChange={(e) => setMilestoneForm({ ...milestoneForm, assignedToName: e.target.value })}
                        className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none font-bold"
                      >
                        <option value="">Unassigned</option>
                        {currentSelectedProject.team.map(m => (
                          <option key={m.name} value={m.name}>{m.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="px-8 py-4 bg-muted/30 border-t border-border/50 flex justify-end gap-3 shrink-0">
                    <button 
                      type="button"
                      onClick={() => {
                        setIsAddMilestoneModalOpen(false);
                        setEditingMilestone(null);
                      }} 
                      className="px-4 py-2 rounded-xl font-bold text-sm text-muted-foreground hover:bg-muted transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-primary text-primary-foreground font-bold rounded-xl shadow-md hover:bg-primary/90 transition-all text-sm"
                    >
                      {editingMilestone ? "Save Changes" : "Create Milestone"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          );
        })()}

{isAddTaskModalOpen && (() => {
          const currentSelectedProject = projects.find(p => p.id === selectedProjectId);
          if (!currentSelectedProject) return null;
          const projectModules: NonNullable<Project['modules']> = currentSelectedProject.modules || [];
          const activeModule = projectModules.find(m => m.id === selectedModuleId) || projectModules[0];
          if (!activeModule) return null;

          const handleCreateNewTask = (e: React.FormEvent) => {
            e.preventDefault();
            if (!addTaskForm.title.trim()) return;

            const newTask: any = {
              id: `task-${Date.now()}`,
              title: addTaskForm.title.trim(),
              status: addTaskForm.status,
              phase: addTaskForm.phase.trim() || undefined,
              dueDate: addTaskForm.dueDate || undefined,
              assignedToName: addTaskForm.assignedToName || undefined,
              reasonForPending: (addTaskForm.status === "onhold" || addTaskForm.status === "pending") ? addTaskForm.reasonForPending.trim() : undefined
            };

            const updatedTasks = [...activeModule.tasks, newTask];
            const updatedModules: NonNullable<Project['modules']> = projectModules.map(m => m.id === activeModule.id ? { ...m, tasks: updatedTasks } : m);
            saveProjectModules(currentSelectedProject.id, updatedModules, "Created Task", `Added new task "${addTaskForm.title.trim()}" inside module "${activeModule.name}"`);
            setIsAddTaskModalOpen(false);
            toast.success("New task created successfully!");
          };

          return (
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center animate-in fade-in duration-200"
              onClick={() => setIsAddTaskModalOpen(false)}
            >
              {/* Backdrop */}
              <div className="absolute inset-0 bg-black/80" />
              {/* Modal Panel */}
              <div
                className="relative z-10 w-[calc(100%-2rem)] max-w-[450px] bg-card border border-border/60 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-8 py-6 border-b border-border/50 bg-muted/30 shrink-0">
                  <div>
                    <h2 className="text-lg font-black tracking-tight">Add New Task</h2>
                    <p className="text-xs text-muted-foreground mt-1">Create a new task inside "{activeModule.name}"</p>
                  </div>
                  <button
                    onClick={() => setIsAddTaskModalOpen(false)}
                    className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {/* Body */}
                <form onSubmit={handleCreateNewTask}>
                  <div className="p-8 space-y-4 max-h-[50vh] overflow-y-auto">
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Task Title</label>
                      <input 
                        type="text" 
                        required
                        autoFocus
                        placeholder="Enter task title..."
                        value={addTaskForm.title} 
                        onChange={(e) => setAddTaskForm({ ...addTaskForm, title: e.target.value })} 
                        className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary font-semibold" 
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Phase</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Phase 1, Sprint A"
                          value={addTaskForm.phase} 
                          onChange={(e) => setAddTaskForm({ ...addTaskForm, phase: e.target.value })} 
                          className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary font-semibold" 
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Due Date</label>
                        <DatePicker 
                          value={addTaskForm.dueDate} 
                          onChange={(val) => setAddTaskForm({ ...addTaskForm, dueDate: val })} 
                          className="w-full h-9 px-3 py-1.5 bg-muted/50 border border-border/50 rounded-xl text-xs font-bold text-center" 
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Assigned Developer</label>
                        <select 
                          value={addTaskForm.assignedToName} 
                          onChange={(e) => setAddTaskForm({ ...addTaskForm, assignedToName: e.target.value })}
                          className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none font-bold"
                        >
                          <option value="">Unassigned</option>
                          {currentSelectedProject.team.map(m => (
                            <option key={m.name} value={m.name}>{m.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Status</label>
                        <select 
                          value={addTaskForm.status} 
                          onChange={(e) => setAddTaskForm({ ...addTaskForm, status: e.target.value as any })}
                          className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none font-bold"
                        >
                          {["todo", "in-progress", "bugs", "onhold", "pending", "completed"].map(st => (
                            <option key={st} value={st}>{st === "todo" ? "To Do" : st === "in-progress" ? "In Progress" : st.charAt(0).toUpperCase() + st.slice(1)}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {(addTaskForm.status === "onhold" || addTaskForm.status === "pending") && (
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Pending/Hold Reason</label>
                        <textarea 
                          placeholder="Provide details on why this task is pending or on hold..."
                          value={addTaskForm.reasonForPending} 
                          onChange={(e) => setAddTaskForm({ ...addTaskForm, reasonForPending: e.target.value })} 
                          rows={3}
                          className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary font-semibold" 
                        />
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="px-8 py-4 bg-muted/30 border-t border-border/50 flex justify-end gap-3 shrink-0">
                    <button 
                      type="button"
                      onClick={() => setIsAddTaskModalOpen(false)} 
                      className="px-4 py-2 rounded-xl font-bold text-sm text-muted-foreground hover:bg-muted transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-primary text-primary-foreground font-bold rounded-xl shadow-md hover:bg-primary/90 transition-all text-sm"
                    >
                      Create Task
                    </button>
                  </div>
                </form>
              </div>
            </div>
          );
        })()}

      <ConfirmModal 
        isOpen={confirmModalState.isOpen}
        onClose={() => setConfirmModalState(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModalState.action}
        title={confirmModalState.title}
        description={confirmModalState.description}
        itemName={confirmModalState.itemName}
      />

      <Dialog open={isLogDailyStatsOpen} onOpenChange={(open) => { setIsLogDailyStatsOpen(open); if (!open) setEditingStatId(null); }}>
        <DialogContent className={cn("p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl bg-card z-50 transition-all duration-300", isBulkAdd ? "sm:max-w-[700px]" : "sm:max-w-[450px]")}>
          <div className="p-6 md:p-8 border-b border-border/40">
            <h2 className="text-lg font-black tracking-tight text-foreground flex items-center gap-2">
              📈 {editingStatId ? "Edit Stats Entry" : "Log Daily Marketing Stats"}
            </h2>
            <p className="text-xs text-muted-foreground mt-1 font-medium">Enter performance metrics for the selected campaign and date.</p>
          </div>

          <form onSubmit={handleLogDailyStats} className="p-6 md:p-8 space-y-5">
            {/* Mode Switcher (F7: edit vakhte single j) */}
            {!editingStatId && (
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <span className="text-xs font-black uppercase tracking-wider text-foreground">Entry Mode</span>
              <div className="flex bg-muted/60 p-0.5 rounded-lg border border-border/50 text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setIsBulkAdd(false)}
                  className={cn("px-2.5 py-1 rounded-md transition-all", !isBulkAdd ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                >
                  Single
                </button>
                <button
                  type="button"
                  onClick={() => setIsBulkAdd(true)}
                  className={cn("px-2.5 py-1 rounded-md transition-all", isBulkAdd ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                >
                  Bulk Add
                </button>
              </div>
            </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Date</label>
              <DatePicker
                value={dailyStatsForm.date}
                onChange={(val) => setDailyStatsForm({ ...dailyStatsForm, date: val })}
                className="w-full h-[42px] px-4 bg-muted/50 border border-border rounded-xl text-sm font-semibold text-foreground"
              />
            </div>

            {!isBulkAdd ? (
              <>
                <div className="space-y-1.5 relative">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Campaign (type = auto-new, no confirm)</label>
                  <input
                    type="text"
                    value={dailyStatsForm.campaignName}
                    onChange={(e) => { setDailyStatsForm({ ...dailyStatsForm, campaignName: e.target.value }); setCampSuggestOpen(true); }}
                    onFocus={() => setCampSuggestOpen(true)}
                    onBlur={() => setTimeout(() => setCampSuggestOpen(false), 150)}
                    placeholder="e.g. HKL Leads (navu hoy to auto-banse)"
                    className="w-full px-4 h-[42px] bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-semibold text-foreground"
                  />
                  {campSuggestOpen && (() => {
                    const project = projects.find(p => p.id === selectedProjectId);
                    const base = dmCampaigns.length > 0
                      ? dmCampaigns
                      : (project?.campaigns && project.campaigns.length > 0)
                        ? project.campaigns.map(c => typeof c === 'string' ? c : (c.name || "")).filter(Boolean)
                        : ["Q4 Retargeting Ads", "Holiday Social Push", "B2B Email Drip"];
                    const q = dailyStatsForm.campaignName.trim().toLowerCase();
                    const opts = base.filter(n => !q || n.toLowerCase().includes(q)).slice(0, 6);
                    if (opts.length === 0) return null;
                    return (
                      <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-card border border-border/60 rounded-xl shadow-xl overflow-hidden">
                        {opts.map(opt => (
                          <button
                            key={opt}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setDailyStatsForm({ ...dailyStatsForm, campaignName: opt });
                              setCampSuggestOpen(false);
                            }}
                            className="w-full text-left px-4 py-2 text-xs font-bold hover:bg-primary/10 hover:text-primary transition-colors"
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Reach</label>
                    <input
                      type="number"
                      placeholder="e.g. 15000"
                      value={dailyStatsForm.reach}
                      onChange={(e) => setDailyStatsForm({ ...dailyStatsForm, reach: e.target.value })}
                      className="w-full px-4 h-[42px] bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-semibold"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Impressions</label>
                    <input
                      type="number"
                      placeholder="e.g. 18000"
                      value={dailyStatsForm.impressions}
                      onChange={(e) => setDailyStatsForm({ ...dailyStatsForm, impressions: e.target.value })}
                      className="w-full px-4 h-[42px] bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-semibold"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Leads</label>
                    <input
                      type="number"
                      placeholder="e.g. 42"
                      value={dailyStatsForm.leads}
                      onChange={(e) => setDailyStatsForm({ ...dailyStatsForm, leads: e.target.value })}
                      className="w-full px-4 h-[42px] bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-semibold"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Followers</label>
                    <input
                      type="number"
                      placeholder="e.g. 15"
                      value={dailyStatsForm.followers}
                      onChange={(e) => setDailyStatsForm({ ...dailyStatsForm, followers: e.target.value })}
                      className="w-full px-4 h-[42px] bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-semibold"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Revenue (₹)</label>
                    <input
                      type="number"
                      placeholder="e.g. 25000"
                      value={dailyStatsForm.revenue}
                      onChange={(e) => setDailyStatsForm({ ...dailyStatsForm, revenue: e.target.value })}
                      className="w-full px-4 h-[42px] bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-semibold"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Spend (₹)</label>
                  <input
                    type="number"
                    placeholder="e.g. 5000"
                    value={dailyStatsForm.spend}
                    onChange={(e) => setDailyStatsForm({ ...dailyStatsForm, spend: e.target.value })}
                    className="w-full px-4 h-[42px] bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-semibold"
                  />
                </div>
              </>
            ) : (
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                {Object.keys(bulkStatsEntries).map((campaignName) => {
                  const entry = bulkStatsEntries[campaignName] || { reach: "", impressions: "", leads: "", followers: "", revenue: "", spend: "" };
                  const setEntry = (patch: Partial<{ reach: string; impressions: string; leads: string; followers: string; revenue: string; spend: string }>) => setBulkStatsEntries({
                    ...bulkStatsEntries,
                    [campaignName]: { ...entry, ...patch }
                  });
                  const numCls = "w-full px-2.5 h-[34px] bg-background border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary font-semibold";
                  const lblCls = "text-[9px] font-bold text-muted-foreground uppercase mb-1 block";
                  return (
                    <div key={campaignName} className="p-4 bg-muted/20 border border-border/40 rounded-2xl space-y-3">
                      <p className="text-xs font-black text-foreground">{campaignName}</p>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className={lblCls}>Reach</label>
                          <input
                            type="number"
                            placeholder="e.g. 12000"
                            value={entry.reach}
                            onChange={(e) => setEntry({ reach: e.target.value })}
                            className={numCls}
                          />
                        </div>
                        <div>
                          <label className={lblCls}>Impressions</label>
                          <input
                            type="number"
                            placeholder="e.g. 15000"
                            value={entry.impressions}
                            onChange={(e) => setEntry({ impressions: e.target.value })}
                            className={numCls}
                          />
                        </div>
                        <div>
                          <label className={lblCls}>Leads</label>
                          <input
                            type="number"
                            placeholder="e.g. 35"
                            value={entry.leads}
                            onChange={(e) => setEntry({ leads: e.target.value })}
                            className={numCls}
                          />
                        </div>
                        <div>
                          <label className={lblCls}>Followers</label>
                          <input
                            type="number"
                            placeholder="e.g. 10"
                            value={entry.followers}
                            onChange={(e) => setEntry({ followers: e.target.value })}
                            className={numCls}
                          />
                        </div>
                        <div>
                          <label className={lblCls}>Revenue (₹)</label>
                          <input
                            type="number"
                            placeholder="e.g. 8000"
                            value={entry.revenue}
                            onChange={(e) => setEntry({ revenue: e.target.value })}
                            className={numCls}
                          />
                        </div>
                        <div>
                          <label className={lblCls}>Spend (₹)</label>
                          <input
                            type="number"
                            placeholder="e.g. 3000"
                            value={entry.spend}
                            onChange={(e) => setEntry({ spend: e.target.value })}
                            className={numCls}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <DialogClose asChild>
                <button type="button" className="px-4 py-2.5 rounded-xl font-bold text-sm text-muted-foreground hover:bg-muted transition-colors">
                  Cancel
                </button>
              </DialogClose>
              <button
                type="submit"
                className="px-6 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl shadow-md hover:bg-primary/90 transition-all text-xs"
              >
                Submit Stats
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      {/* F3: Revenue popup (page nai) — date + revenue, total, edit/delete */}
      <Dialog open={isRevenueOpen} onOpenChange={(open) => { setIsRevenueOpen(open); if (!open) setRevenueForm({ date: "", revenue: "", editId: "" }); }}>
        <DialogContent className="sm:max-w-[440px] p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className="px-6 py-5 border-b border-border/50 bg-muted/30 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
                <IndianRupee className="w-5 h-5 text-emerald-600" /> Revenue
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">Total: <span className="font-black text-emerald-600 font-mono">₹{revenueTotal.toLocaleString("en-IN")}</span></p>
            </div>
            <DialogClose asChild>
              <button className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </DialogClose>
          </div>
          <div className="p-6 space-y-3 max-h-[40vh] overflow-y-auto">
            {revenues.length === 0 && (
                <p className="text-xs font-semibold text-muted-foreground/60 border border-dashed border-border/40 rounded-2xl px-4 py-3 text-center">No revenue entries yet.</p>
            )}
            {[...revenues].sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))).map((r: any) => (
              <div key={String(r.id || r._id)} className="flex items-center gap-3 px-4 py-2.5 rounded-2xl border border-border/40 bg-muted/20 text-xs">
                <span className="font-mono font-bold">{String(r.date || "").split("T")[0]}</span>
                <span className="font-black text-emerald-600 font-mono ml-auto">₹{Number(r.revenue || 0).toLocaleString("en-IN")}</span>
                <button
                  type="button"
                  onClick={() => setRevenueForm({ date: (String(r.date || "").split("T")[0] ?? ""), revenue: String(r.revenue ?? ""), editId: String(r.id || r._id) })}
                  className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                  title="Edit"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteRevenue(String(r.id || r._id))}
                  className="p-1.5 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="px-6 py-4 bg-muted/30 border-t border-border/50">
            <div className="grid grid-cols-2 gap-2 mb-2">
              <DatePicker
                value={revenueForm.date}
                onChange={(val) => setRevenueForm({ ...revenueForm, date: val })}
                placeholder="Date"
                className="h-10 bg-background border-border rounded-xl text-xs"
              />
              <input
                type="number"
                min="0"
                value={revenueForm.revenue}
                onChange={(e) => setRevenueForm({ ...revenueForm, revenue: e.target.value })}
                placeholder="e.g. 50000"
                className="px-3 h-10 bg-background border border-border rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <button
              type="button"
              onClick={handleSaveRevenue}
              className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors shadow-sm"
            >
              {revenueForm.editId ? "Update Revenue" : "Save Revenue"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
        <Dialog open={isEditProjectModalOpen} onOpenChange={setIsEditProjectModalOpen}>
          <DialogContent className="max-w-[90vw] md:max-w-[700px] p-0 overflow-hidden rounded-[2.5rem] border-border/60 shadow-2xl [&>button]:hidden bg-card flex flex-col h-[90vh] md:h-[550px] gap-0">
            <div className="p-6 pb-4">
              <div className="flex items-center justify-between px-6 md:px-8 py-6 border-b border-border/50 bg-muted/30">
                <div>
                  <h2 className="text-xl md:text-2xl font-black tracking-tight">Edit Project</h2>
                  <p className="text-xs text-muted-foreground mt-1">Modify project details, stats targets, and budgets</p>
                </div>
                <DialogClose asChild>
                  <button className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </DialogClose>
              </div>
            </div>
            {editingProject && (
              <div className="flex flex-row overflow-hidden flex-1" style={{ maxHeight: 'calc(90vh - 130px)' }}>
                {/* Sidebar Tabs */}
                <div className="w-44 shrink-0 border-r border-border/50 bg-muted/20 p-3 flex flex-col gap-1 overflow-y-auto">
                  {([
                    { id: 'general', label: 'General', icon: <FolderGit2 className="w-4 h-4" /> },
                    { id: 'finance', label: 'Finance', icon: <IndianRupee className="w-4 h-4" /> },
                    ...(editingProject.category === "Digital Marketing" ? [{ id: 'campaigns' as const, label: 'Campaigns', icon: <TrendingUp className="w-4 h-4" /> }] : []),
                  ] as const).map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveProjectTab(tab.id)}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-bold transition-all text-left w-full",
                        activeProjectTab === tab.id
                          ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-5">
                  {activeProjectTab === 'general' && (
                    <>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Project Name <span className="text-red-500">*</span></label>
                        <input 
                          type="text" 
                          value={editingProject.name}
                          onChange={(e) => setEditingProject({...editingProject, name: e.target.value})}
                          className={"w-full px-4 py-3 bg-muted/50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium " + (showEditProjectErrors && !editingProject.name.trim() ? "border-red-500 ring-1 ring-red-500" : "border-border/50")}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Description</label>
                        <textarea 
                          value={editingProject.description || ""}
                          onChange={(e) => setEditingProject({...editingProject, description: e.target.value})}
                          placeholder="Brief project description..."
                          rows={2}
                          className="w-full px-4 py-3 bg-muted/50 border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium resize-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Start Date <span className="text-red-500">*</span></label>
                          <DatePicker
                            value={editingProject.startDate}
                            onChange={(newStart) => {
                              setEditingProject({
                                ...editingProject, 
                                startDate: newStart,
                                endDate: editingProject.endDate < newStart ? newStart : editingProject.endDate
                              });
                            }}
                            placeholder="Select start date"
                            className={"w-full h-[42px] bg-muted/50 border rounded-xl font-medium " + (showEditProjectErrors && !editingProject.startDate ? "border-red-500 ring-1 ring-red-500" : "border-border/50")}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">End Date <span className="text-red-500">*</span></label>
                          <DatePicker
                            value={editingProject.endDate}
                            minDate={editingProject.startDate}
                            onChange={(val) => setEditingProject({...editingProject, endDate: val})}
                            placeholder="Select end date"
                            className={"w-full h-[42px] bg-muted/50 border rounded-xl font-medium " + (showEditProjectErrors && !editingProject.endDate ? "border-red-500 ring-1 ring-red-500" : "border-border/50")}
                          />
                        </div>
                      </div>
                      <RenewalsManager
                        ranges={editingProject.dateRanges || []}
                        onChange={(dateRanges) => {
                          const last = dateRanges[dateRanges.length - 1];
                          setEditingProject({
                            ...editingProject,
                            dateRanges,
                            ...(last && last.start_date && last.end_date ? { startDate: last.start_date, endDate: last.end_date } : {}),
                          });
                        }}
                      />
                      <div>
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center justify-between">
                          <span>Departments / Categories <span className="text-red-500">*</span></span>
                          <span className="text-[10px] text-muted-foreground font-normal">Select one or more</span>
                        </label>
                        <div className="flex flex-wrap gap-2 pt-0.5">
                          {FIXED_DEPARTMENTS.map(cat => {
                            const selectedDepts = parseDepartments(editingProject.category);
                            const isSelected = selectedDepts.includes(cat);
                            return (
                              <button
                                key={cat}
                                type="button"
                                onClick={() => {
                                  let next: string[];
                                  if (isSelected) {
                                    next = selectedDepts.filter(d => d !== cat);
                                    if (next.length === 0) next = [cat];
                                  } else {
                                    next = [...selectedDepts, cat];
                                  }
                                  setEditingProject({...editingProject, category: next.join(", ")});
                                }}
                                className={cn(
                                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer",
                                  isSelected
                                    ? "bg-primary text-primary-foreground border-primary shadow-xs"
                                    : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                                )}
                              >
                                {cat} {isSelected ? "✓" : "+"}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Status <span className="text-red-500">*</span></label>
                          <Select 
                            value={editingProject.status || "In Progress"}
                            onValueChange={(val) => setEditingProject({...editingProject, status: val as ProjectStatus})}
                          >
                            <SelectTrigger className="w-full h-[46px] px-4 bg-muted/50 border border-border/50 rounded-xl text-sm font-medium">
                              <SelectValue placeholder="Select Status" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-border/60 shadow-xl bg-background/95 backdrop-blur-md z-[300]">
                              {["In Progress", "In Review", "Completed", "On Hold"].map(st => (
                                <SelectItem key={st} value={st} className="text-sm font-medium rounded-lg cursor-pointer">
                                  {st}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Priority</label>
                          <Select 
                            value={editingProject.priority || "Medium"} 
                            onValueChange={(val) => setEditingProject({...editingProject, priority: val as any})} 
                          >
                            <SelectTrigger className="w-full h-[46px] px-4 bg-muted/50 border border-border rounded-xl text-sm font-medium">
                              <SelectValue placeholder="Select Priority" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-border/60 shadow-xl bg-background/95 backdrop-blur-md z-[300]">
                              {["Low", "Medium", "High", "Critical"].map(p => (
                                <SelectItem key={p} value={p} className="text-sm font-medium rounded-lg cursor-pointer">
                                  {p}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 flex justify-between">
                            <span>Dynamic Progress</span>
                            <span className="text-primary font-black">{editingProject.progress}%</span>
                          </label>
                          <div className="w-full h-2 bg-muted rounded-full overflow-hidden mt-3 border border-border/40">
                            <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${editingProject.progress}%` }} />
                          </div>
                          <span className="text-[10px] text-muted-foreground/60 italic block mt-1">Calculated dynamically from timeline & tasks</span>
                        </div>
                      </div>
                      {(editingProject.category === "Creative" || editingProject.category === "Digital Marketing") && (
                        <div className="space-y-4 pt-4 border-t border-border/40 mt-4">
                          <h4 className="text-xs font-bold text-foreground uppercase tracking-widest">Monthly Social Media Delivery Targets</h4>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Posts Target / Month</label>
                              <input 
                                type="number" 
                                value={editingProject.post ?? 0} 
                                onChange={(e) => setEditingProject({...editingProject, post: parseInt(e.target.value) || 0})} 
                                placeholder="e.g. 8" 
                                className="w-full px-3 h-[38px] bg-muted/50 border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 font-semibold" 
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Reels Target / Month</label>
                              <input 
                                type="number" 
                                value={editingProject.reel ?? 0} 
                                onChange={(e) => setEditingProject({...editingProject, reel: parseInt(e.target.value) || 0})} 
                                placeholder="e.g. 8" 
                                className="w-full px-3 h-[38px] bg-muted/50 border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 font-semibold" 
                              />
                            </div>
                          </div>
                        </div>
                      )}
                      {editingProject.category === "Digital Marketing" && (
                        <div className="space-y-4 pt-4 border-t border-border/40 mt-4">
                          <h4 className="text-xs font-bold text-foreground uppercase tracking-widest">Digital Marketing Stats</h4>
                          <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Reach Target</label>
                              <input 
                                type="text" 
                                value={editingProject.reach || ""} 
                                onChange={(e) => setEditingProject({...editingProject, reach: e.target.value})} 
                                placeholder="e.g. 1.2M" 
                                className="w-full px-3 h-[38px] bg-muted/50 border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20" 
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Leads Target</label>
                              <input 
                                type="text" 
                                value={editingProject.leads || ""} 
                                onChange={(e) => setEditingProject({...editingProject, leads: e.target.value})} 
                                placeholder="e.g. 3,240" 
                                className="w-full px-3 h-[38px] bg-muted/50 border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20" 
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">CPL (₹)</label>
                              <input 
                                type="text" 
                                value={editingProject.cpl || ""} 
                                onChange={(e) => setEditingProject({...editingProject, cpl: e.target.value})} 
                                placeholder="e.g. 250" 
                                className="w-full px-3 h-[38px] bg-muted/50 border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20" 
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  {activeProjectTab === 'finance' && (
                    <>
                      <div className="space-y-2">
                        <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider">Project Budget</label>
                        <input type="text" value={editingProject.budget || ""} onChange={(e) => setEditingProject({...editingProject, budget: e.target.value.replace(/[^0-9]/g, "")})} placeholder="e.g. 10000" className="w-full px-4 h-[42px] bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider">Amount Received</label>
                        <input type="text" value={editingProject.amountReceived || ""} onChange={(e) => setEditingProject({...editingProject, amountReceived: e.target.value.replace(/[^0-9]/g, "")})} placeholder="e.g. 5000" className="w-full px-4 h-[42px] bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider">Next Payment Date</label>
                        <DatePicker
                          value={editingProject.nextPaymentDate || ""}
                          onChange={(val) => setEditingProject({...editingProject, nextPaymentDate: val})}
                          placeholder="Select payment date"
                          className="w-full h-[42px] bg-muted/50 border border-border rounded-xl text-sm font-medium"
                        />
                      </div>
                    </>
                  )}
                  {activeProjectTab === 'campaigns' && (
                    <div className="space-y-4 text-left">
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-foreground mb-1">Marketing Campaigns</h4>
                        <p className="text-[10px] text-muted-foreground font-semibold">Manage active ad campaigns and performance targets</p>
                      </div>

                      <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                        {(editingProject.campaigns || []).map((c: any, index: number) => {
                          const campaignObj = typeof c === 'string' ? { name: c, status: 'Active' } : { name: c.name || "", status: c.status || 'Active' };
                          return (
                            <div key={index} className="flex justify-between items-center p-3 bg-muted/20 border border-border/40 rounded-2xl group/campaign">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-foreground">{campaignObj.name}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextStatus = campaignObj.status === 'Active' ? 'Inactive' : 'Active';
                                    const updated = [...(editingProject.campaigns || [])];
                                    updated[index] = { name: campaignObj.name, status: nextStatus };
                                    setEditingProject({ ...editingProject, campaigns: updated });
                                    toast.success(`Campaign marked ${nextStatus}`);
                                  }}
                                  className={cn("px-2 py-0.5 text-[9px] font-black rounded-lg uppercase tracking-wider transition-colors", 
                                    campaignObj.status === 'Active' ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-muted text-muted-foreground hover:bg-muted-foreground/20")}
                                >
                                  {campaignObj.status}
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmModalState({
                                    isOpen: true,
                                    title: "Remove Campaign",
                                    description: "Are you sure you want to remove this campaign?",
                                    itemName: campaignObj.name,
                                    action: () => {
                                      const updated = (editingProject.campaigns || []).filter((_: any, i: number) => i !== index);
                                      setEditingProject({ ...editingProject, campaigns: updated });
                                      setConfirmModalState(prev => ({ ...prev, isOpen: false }));
                                      toast.success("Campaign removed");
                                    }
                                  });
                                }}
                                className="text-xs text-rose-500 hover:text-rose-700 font-extrabold opacity-0 group-hover/campaign:opacity-100 transition-opacity"
                              >
                                Remove
                              </button>
                            </div>
                          );
                        })}
                        {(editingProject.campaigns || []).length === 0 && (
                          <p className="text-xs text-muted-foreground italic font-medium py-4 text-center">No campaigns created yet.</p>
                        )}
                      </div>

                      <div className="flex gap-2 pt-2 border-t border-border/40">
                        <input
                          type="text"
                          placeholder="Campaign name (e.g. Winter Sales Ads)..."
                          id="edit_project_new_campaign_input"
                          className="flex-1 px-4 py-2.5 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none font-semibold text-foreground"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const btn = document.getElementById("add_campaign_edit_modal_btn");
                              if (btn) btn.click();
                            }
                          }}
                        />
                        <button
                          type="button"
                          id="add_campaign_edit_modal_btn"
                          onClick={() => {
                            const input = document.getElementById("edit_project_new_campaign_input") as HTMLInputElement;
                            if (input && input.value.trim()) {
                              const newCampaignName = input.value.trim();
                              const currentList = editingProject.campaigns || [];
                              const exists = currentList.some((c: any) => {
                                const name = typeof c === 'string' ? c : (c.name || "");
                                return name.toLowerCase() === newCampaignName.toLowerCase();
                              });
                              if (exists) {
                                toast.error("Campaign name already exists");
                                return;
                              }
                              setEditingProject({
                                ...editingProject,
                                campaigns: [...currentList, newCampaignName]
                              });
                              input.value = "";
                              toast.success("Campaign added!");
                            }
                          }}
                          className="px-4 py-2.5 bg-primary text-primary-foreground font-bold text-xs rounded-xl hover:bg-primary/95 transition-all shadow-sm flex items-center justify-center shrink-0"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="px-6 md:px-8 py-4 bg-muted/30 border-t border-border/50 flex justify-end gap-3 mt-auto shrink-0">
              <button 
                onClick={() => { setIsEditProjectModalOpen(false); setEditingProject(null); }}
                className="px-5 py-2.5 rounded-xl font-bold text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleUpdateProject}
                className="px-6 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl shadow-md hover:bg-primary/90 transition-all disabled:opacity-50"
              >
                Save Changes
              </button>
            </div>
            
            {/* Nested Manage Categories Modal for Edit */}
            <Dialog open={isManageCategoriesModalOpen} onOpenChange={setIsManageCategoriesModalOpen}>
              <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
                <div className="p-6 pb-4">
                  <div className="flex items-center justify-between px-6 md:px-8 py-6 border-b border-border/50 bg-muted/30">
          <div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight">Manage Categories</h2>
            
          </div>
          <DialogClose asChild>
            <button className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </DialogClose>
        </div>
                </div>
                
                <div className="p-6 md:p-8 space-y-6 overflow-y-auto max-h-[70vh]">
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="e.g. E-Commerce"
                      className={"flex-1 px-4 py-2.5 bg-muted/50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium " + (showCategoryErrors && !newCategoryName.trim() ? "border-red-500 ring-1 ring-red-500" : "border-border/50")}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddCategory();
                      }}
                    />
                    <button 
                      onClick={handleAddCategory}
                      className="px-4 py-2.5 bg-foreground text-background font-bold rounded-xl shadow-md hover:bg-foreground/90 transition-all disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                  
                  <div className="space-y-2 mt-4 max-h-[250px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted">
                    {categories.map(cat => {
                      const isLocked = LOCKED_CATEGORIES.includes(cat);
                      const isPending = categoryPendingDelete === cat;
                      return (
                        <div key={cat} className={cn("flex flex-col border rounded-xl overflow-hidden transition-all", isLocked ? "bg-primary/5 border-primary/20" : isPending ? "bg-rose-50 border-rose-300" : "bg-muted/30 border-border/50")}>
                          <div className="flex items-center justify-between p-3">
                            <div className="flex items-center gap-2">
                              {isLocked && <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-md uppercase tracking-wider">Fixed</span>}
                              <span className="font-bold text-sm">{cat}</span>
                            </div>
                            {isLocked ? (
                              <span className="text-[10px] text-muted-foreground font-medium italic">System</span>
                            ) : (
                              <button onClick={() => setCategoryPendingDelete(isPending ? null : cat)} className={cn("p-1.5 rounded-lg transition-colors", isPending ? "text-rose-500 bg-rose-100" : "text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10")}>
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          {isPending && (
                            <div className="flex items-center justify-between px-3 py-2 bg-rose-50 border-t border-rose-200 gap-2">
                              <span className="text-xs font-bold text-rose-600">Delete "{cat}"?</span>
                              <div className="flex gap-2">
                                <button onClick={() => setCategoryPendingDelete(null)} className="px-3 py-1 text-xs font-bold text-muted-foreground bg-white border border-border/50 rounded-lg hover:bg-muted transition-colors">Cancel</button>
                                <button onClick={() => { confirmDeleteCategory(cat); setCategoryPendingDelete(null); }} className="px-3 py-1 text-xs font-bold text-white bg-rose-500 rounded-lg hover:bg-rose-600 transition-colors">Delete</button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                <div className="px-6 md:px-8 py-4 md:py-6 bg-muted/30 border-t border-border/50 flex justify-end gap-3 mt-auto shrink-0">
                  <button 
                    onClick={() => setIsManageCategoriesModalOpen(false)}
                    className="px-5 py-2.5 bg-foreground text-background font-bold rounded-xl hover:bg-foreground/90 transition-colors"
                  >
                    Done
                  </button>
                </div>
              </DialogContent>
            </Dialog>

          </DialogContent>
        </Dialog>



      <ConfirmModal 
        isOpen={confirmModalState.isOpen}
        onClose={() => setConfirmModalState(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModalState.action}
        title={confirmModalState.title}
        description={confirmModalState.description}
        itemName={confirmModalState.itemName}
      />
      {renderSmmModals()}

    </>
    );
    }


    const clientProjects = projects.filter(p => {
      if (p.clientId !== client.id) return false;
      if (projectFilterStatuses.length > 0 && !projectFilterStatuses.includes(p.status)) return false;
      if (projectFilterCategories.length > 0 && !projectFilterCategories.includes(p.category)) return false;
      return true;
    });

    return (
      <>
        <div className="w-full space-y-8 animate-in fade-in duration-500">
        {/* Detail View Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSelectedClientId(null)}
              className="p-2.5 bg-card border border-border/60 rounded-xl hover:bg-muted/80 hover:text-primary transition-colors shadow-sm group"
            >
              <ArrowLeft className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </button>
            {/* K5: highlighted logo */}
            <BrandLogo src={client.logo} alt={client.name} size="w-20 h-20" />
            <div>
              <h1 className="text-3xl font-black tracking-tight text-foreground leading-tight">{client.name}</h1>
              <span className="px-2 py-0.5 mt-1 inline-flex text-[10px] font-bold uppercase tracking-widest rounded-lg items-center gap-1.5 text-primary bg-primary/10">
                <Circle className="w-1.5 h-1.5 fill-current" />
                {client.status} Client
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-4 py-2.5 bg-card border border-border/60 text-foreground font-bold text-sm rounded-xl hover:bg-muted/80 transition-all shadow-sm">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <span className="hidden sm:inline">Filter</span>
                  {(projectFilterStatuses.length > 0 || projectFilterCategories.length > 0) && (
                    <span className="w-2 h-2 rounded-full bg-primary ml-1"></span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 border-border/60 shadow-xl bg-background/95 backdrop-blur-md z-50">
                <div className="px-2 py-1.5 text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1 flex justify-between items-center">
                  <span>Status</span>
                  {(projectFilterStatuses.length > 0 || projectFilterCategories.length > 0) && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); setProjectFilterStatuses([]); setProjectFilterCategories([]); }}
                      className="text-[10px] text-primary hover:underline"
                    >
                      Clear All
                    </button>
                  )}
                </div>
                {["In Progress", "In Review", "Completed", "On Hold"].map(status => (
                  <DropdownMenuItem 
                    key={status}
                    onSelect={(e) => { 
                      e.preventDefault(); 
                      setProjectFilterStatuses(prev => 
                        prev.includes(status as ProjectStatus) 
                          ? prev.filter(s => s !== status) 
                          : [...prev, status as ProjectStatus]
                      ); 
                    }}
                    className={cn(
                      "rounded-xl cursor-pointer py-2 focus:bg-primary/10 focus:text-primary font-medium transition-colors flex items-center justify-between",
                      projectFilterStatuses.includes(status as ProjectStatus) && "bg-primary/10 text-primary"
                    )}
                  >
                    <span>{status}</span>
                    {projectFilterStatuses.includes(status as ProjectStatus) && <CheckCircle2 className="w-4 h-4" />}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator className="bg-border/50 my-2" />
                <div className="px-2 py-1.5 text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Category</div>
                {categories.map(cat => (
                  <DropdownMenuItem 
                    key={cat}
                    onSelect={(e) => { 
                      e.preventDefault(); 
                      setProjectFilterCategories(prev => 
                        prev.includes(cat) 
                          ? prev.filter(c => c !== cat) 
                          : [...prev, cat]
                      ); 
                    }}
                    className={cn(
                      "rounded-xl cursor-pointer py-2 focus:bg-primary/10 focus:text-primary font-medium transition-colors flex items-center justify-between",
                      projectFilterCategories.includes(cat) && "bg-primary/10 text-primary"
                    )}
                  >
                    <span>{cat}</span>
                    {projectFilterCategories.includes(cat) && <CheckCircle2 className="w-4 h-4" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <button onClick={() => setIsNewProjectModalOpen(true)} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground font-bold text-sm rounded-xl hover:bg-primary/90 transition-all shadow-sm">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Project</span>
            </button>
          </div>
        </div>

        {/* Summary Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-card border border-border/60 rounded-3xl p-5 flex flex-col justify-center shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <FolderGit2 className="w-4 h-4" />
              </div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Projects</p>
            </div>
            <h3 className="text-2xl font-black text-foreground font-mono">{clientProjects.length}</h3>
          </div>
          <div className="bg-card border border-border/60 rounded-3xl p-5 flex flex-col justify-center shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                <IndianRupee className="w-4 h-4" />
              </div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Budget</p>
            </div>
            <h3 className="text-2xl font-black text-foreground font-mono">{client.totalBudget}</h3>
          </div>
          <div className="bg-card border border-border/60 rounded-3xl p-5 flex flex-col justify-center shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Outstanding</p>
            </div>
            <h3 className="text-2xl font-black text-foreground font-mono">{client.outstandingPayment}</h3>
          </div>
          <div className="bg-card border border-border/60 rounded-3xl p-5 flex flex-col justify-center shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Onboarded</p>
            </div>
            <h3 className="text-2xl font-black text-foreground font-mono">{safeFormat(client.onboardingDate, "dd/MM/yyyy")}</h3>
          </div>
          <div className="bg-card border border-border/60 rounded-3xl p-5 flex flex-col justify-center shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Contacts</p>
            </div>
            <div className="flex -space-x-2">
              {(client.contacts ?? []).map((contact, i) => (
                <div key={i} className="w-8 h-8 rounded-full border-2 border-card overflow-hidden bg-muted shadow-sm">
                  <img src={contact.avatar} alt={contact.name} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Projects Grid for this Client */}
        <div>
          <h2 className="text-xl font-bold tracking-tight mb-4">Projects</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {clientProjects.map((project) => (
              <div 
                key={project.id} 
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.closest('button') || target.closest('[role="menuitem"]')) {
                    return;
                  }
                  setSelectedProjectId(project.id);
                }}
                className="group bg-card border border-border/60 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-primary/30 transition-all duration-300 relative overflow-hidden flex flex-col h-full cursor-pointer"
              >
                {/* Background Accent */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none transition-opacity opacity-0 group-hover:opacity-100"></div>

                <div className="flex justify-between items-start mb-4 relative z-10">
                  <div className="flex flex-col items-start gap-2">
                    <span className={cn("px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-lg flex items-center gap-1.5", getStatusColor(project.status))}>
                      <Circle className="w-2 h-2 fill-current" />
                      {project.status}
                    </span>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                      <Briefcase className="w-3 h-3" /> {project.category || "General"}
                    </span>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg transition-colors outline-none focus:ring-2 focus:ring-primary/20">
                        <MoreHorizontal className="w-5 h-5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent 
                      align="end" 
                      className="w-48 rounded-2xl p-2 border-border/60 shadow-xl bg-background/95 backdrop-blur-md"
                    >
                      <DropdownMenuItem 
                        onSelect={() => {
                          setTimeout(() => {
                            openEditModal(project);
                          }, 100);
                        }}
                        className="rounded-xl cursor-pointer py-2.5 focus:bg-primary/10 focus:text-primary font-medium transition-colors"
                      >
                        <Edit2 className="w-4 h-4 mr-2" /> Edit Project
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-border/50" />
                      <DropdownMenuItem 
                        onSelect={() => {
                          setTimeout(() => {
                            confirmDeleteProject(project);
                          }, 100);
                        }}
                        className="rounded-xl cursor-pointer py-2.5 focus:bg-rose-500/10 focus:text-rose-600 font-medium text-rose-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="relative z-10 mb-4">
                  <h3 className="text-xl font-black tracking-tight text-foreground line-clamp-2 leading-tight">{project.name}</h3>
                </div>

                {/* Finance Info */}
                <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-muted/20 rounded-2xl border border-border/40 relative z-10">
                  <div>
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block mb-0.5">Budget</span>
                    <span className="text-xs font-black text-foreground font-mono">{project.budget || "₹0"}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block mb-0.5">Received</span>
                    <span className="text-xs font-black text-emerald-500 font-mono">{project.amountReceived || "₹0"}</span>
                  </div>
                </div>

                {/* Progress */}
                <div className="mb-6 relative z-10">
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Progress</span>
                    <span className="text-sm font-black text-foreground">{project.progress}%</span>
                  </div>
                  <div className="h-2 w-full bg-muted/60 rounded-full overflow-hidden">
                    <div 
                      className={cn("h-full rounded-full transition-all duration-1000 ease-out", getProgressColor(project.status))}
                      style={{ width: `${project.progress}%` }}
                    ></div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center pt-4 border-t border-border/40 relative z-10">
                  <div className="flex -space-x-2">
                    {project.team.slice(0, 3).map((member, i) => (
                      <div key={i} className="w-8 h-8 rounded-full border-2 border-card overflow-hidden bg-muted relative shadow-sm">
                        <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                      </div>
                    ))}
                    {project.team.length > 3 && (
                      <div className="w-8 h-8 rounded-full border-2 border-card bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground z-10 shadow-sm">
                        +{project.team.length - 3}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/30 rounded-lg border border-border/30">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-bold text-foreground/80">{safeFormat(project.startDate, "dd/MM/yyyy")} - {safeFormat(project.endDate, "dd/MM/yyyy")}</span>
                  </div>
                </div>

              </div>
            ))}
            {clientProjects.length === 0 && (
              <div className="col-span-full py-12 flex flex-col items-center justify-center text-center bg-card border border-border/60 border-dashed rounded-3xl">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  <FolderGit2 className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-bold text-foreground">No projects yet</h3>
                <p className="text-muted-foreground mt-1 mb-4">This client doesn't have any active projects.</p>
                <button onClick={() => setIsNewProjectModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary font-bold text-sm rounded-xl hover:bg-primary/20 transition-all">
                  <Plus className="w-4 h-4" /> Add Project
                </button>
              </div>
            )}
          </div>
        </div>
        {/* New Project Modal */}
        <Dialog open={isNewProjectModalOpen} onOpenChange={(open) => { setIsNewProjectModalOpen(open); if (!open) { setActiveProjectTab('general'); setShowNewProjectErrors(false); } }}>
          <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 md:px-8 py-5 border-b border-border/50 bg-muted/30 shrink-0">
              <div>
                <h2 className="text-xl md:text-2xl font-black tracking-tight">New Project</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Fill in the details to create a new project.</p>
              </div>
              <DialogClose asChild>
                <button className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </DialogClose>
            </div>
            {/* Body: sidebar + content */}
            <div className="flex flex-row overflow-hidden" style={{ maxHeight: 'calc(90vh - 130px)' }}>
              {/* Sidebar Tabs */}
              <div className="w-44 shrink-0 border-r border-border/50 bg-muted/20 p-3 flex flex-col gap-1 overflow-y-auto">
                {([
                  { id: 'general', label: 'General', icon: <FolderGit2 className="w-4 h-4" /> },
                  { id: 'finance', label: 'Finance', icon: <IndianRupee className="w-4 h-4" /> },
                ] as const).map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveProjectTab(tab.id)}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-bold transition-all text-left w-full",
                      activeProjectTab === tab.id
                        ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>
              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-5">
                {activeProjectTab === 'general' && (
                  <>
                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Project Name <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        placeholder="e.g. Website Redesign"
                        className={cn("w-full px-4 h-[42px] bg-muted/50 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all", showNewProjectErrors && !newProjectName.trim() ? "border-red-500 ring-1 ring-red-500" : "border-border")}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Description</label>
                      <textarea
                        value={newProjectDescription}
                        onChange={(e) => setNewProjectDescription(e.target.value)}
                        placeholder="Brief project description..."
                        rows={3}
                        className="w-full px-4 py-3 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider flex items-center justify-between">
                        <span>Departments / Categories <span className="text-red-500">*</span></span>
                        <span className="text-[10px] text-muted-foreground font-normal">Select one or more</span>
                      </label>
                      <div className="flex flex-wrap gap-2 pt-0.5">
                        {FIXED_DEPARTMENTS.map(cat => {
                          const selectedDepts = parseDepartments(newProjectCategory);
                          const isSelected = selectedDepts.includes(cat);
                          return (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => {
                                let next: string[];
                                if (isSelected) {
                                  next = selectedDepts.filter(d => d !== cat);
                                  if (next.length === 0) next = [cat];
                                } else {
                                  next = [...selectedDepts, cat];
                                }
                                setNewProjectCategory(next.join(", "));
                              }}
                              className={cn(
                                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer",
                                isSelected
                                  ? "bg-primary text-primary-foreground border-primary shadow-xs"
                                  : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                              )}
                            >
                              {cat} {isSelected ? "✓" : "+"}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Priority</label>
                        <Select value={newProjectPriority} onValueChange={(val) => setNewProjectPriority(val as any)}>
                          <SelectTrigger className="w-full h-[42px] px-4 bg-muted/50 border border-border rounded-xl text-sm font-medium">
                            <SelectValue placeholder="Select Priority" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-border/60 shadow-xl bg-background/95 backdrop-blur-md z-[300]">
                            {["Low", "Medium", "High", "Critical"].map(p => (
                              <SelectItem key={p} value={p} className="text-sm font-medium rounded-lg cursor-pointer">
                                {p}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Start Date <span className="text-red-500">*</span></label>
                        <DatePicker
                          value={newProjectStartDate}
                          onChange={(val) => { const v = val; setNewProjectStartDate(v); if (newProjectEndDate < v) setNewProjectEndDate(v); }}
                          placeholder="Select start date"
                          className={cn("w-full h-[42px] bg-muted/50 border rounded-xl text-sm font-medium", showNewProjectErrors && !newProjectStartDate ? "border-red-500" : "border-border")}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">End Date <span className="text-red-500">*</span></label>
                        <DatePicker
                          value={newProjectEndDate}
                          minDate={newProjectStartDate}
                          onChange={(val) => setNewProjectEndDate(val)}
                          placeholder="Select end date"
                          className={cn("w-full h-[42px] bg-muted/50 border rounded-xl text-sm font-medium", showNewProjectErrors && !newProjectEndDate ? "border-red-500" : "border-border")}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Team Deadline (Internal)</label>
                      <DatePicker
                        value={newProjectTeamDeadline}
                        onChange={(val) => setNewProjectTeamDeadline(val)}
                        placeholder="Select team deadline"
                        className="w-full h-[42px] bg-muted/50 border border-border rounded-xl text-sm font-medium"
                      />
                    </div>
                    {newProjectCategory === "Digital Marketing" && (
                      <div className="space-y-4 pt-4 border-t border-border/40 mt-4">
                        <h4 className="text-xs font-bold text-foreground uppercase tracking-widest">Digital Marketing Stats</h4>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Reach Target</label>
                            <input 
                              type="text" 
                              value={newProjectReach} 
                              onChange={(e) => setNewProjectReach(e.target.value)} 
                              placeholder="e.g. 1.2M" 
                              className="w-full px-3 h-[38px] bg-muted/50 border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20" 
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Leads Target</label>
                            <input 
                              type="text" 
                              value={newProjectLeads} 
                              onChange={(e) => setNewProjectLeads(e.target.value)} 
                              placeholder="e.g. 3,240" 
                              className="w-full px-3 h-[38px] bg-muted/50 border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20" 
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">CPL (₹)</label>
                            <input 
                              type="text" 
                              value={newProjectCpl} 
                              onChange={(e) => setNewProjectCpl(e.target.value)} 
                              placeholder="e.g. 250" 
                              className="w-full px-3 h-[38px] bg-muted/50 border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20" 
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
                {activeProjectTab === 'finance' && (
                  <>
                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Project Budget</label>
                      <input type="text" value={newProjectBudget} onChange={(e) => setNewProjectBudget(e.target.value.replace(/[^0-9]/g, ""))} placeholder="e.g. 10000" className="w-full px-4 h-[42px] bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Amount Received</label>
                      <input type="text" value={newProjectAmountReceived} onChange={(e) => setNewProjectAmountReceived(e.target.value.replace(/[^0-9]/g, ""))} placeholder="e.g. 5000" className="w-full px-4 h-[42px] bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Next Payment Date</label>
                      <DatePicker
                        value={newProjectNextPaymentDate}
                        onChange={(val) => setNewProjectNextPaymentDate(val)}
                        placeholder="Select payment date"
                        className="w-full h-[42px] bg-muted/50 border border-border rounded-xl text-sm font-medium"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
            {/* Footer */}
            <div className="px-6 md:px-8 py-4 bg-muted/30 border-t border-border/50 flex justify-end gap-3 shrink-0">
              <button onClick={() => { setIsNewProjectModalOpen(false); setActiveProjectTab('general'); setShowNewProjectErrors(false); }} className="px-5 py-2.5 rounded-xl font-bold text-muted-foreground hover:bg-muted transition-colors">
                Cancel
              </button>
              <button onClick={handleCreateProject} className="px-6 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl shadow-md hover:bg-primary/90 transition-all">
                Create Project
              </button>
            </div>
            
            {/* Nested Manage Categories Modal */}
            <Dialog open={isManageCategoriesModalOpen} onOpenChange={setIsManageCategoriesModalOpen}>
              <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
                <div className="p-6 pb-4">
                  <div className="flex items-center justify-between px-6 md:px-8 py-6 border-b border-border/50 bg-muted/30">
          <div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight">Manage Categories</h2>
            
          </div>
          <DialogClose asChild>
            <button className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </DialogClose>
        </div>
                </div>
                
                <div className="p-6 md:p-8 space-y-6 overflow-y-auto max-h-[70vh]">
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="e.g. E-Commerce"
                      className={"flex-1 px-4 py-2.5 bg-muted/50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium " + (showCategoryErrors && !newCategoryName.trim() ? "border-red-500 ring-1 ring-red-500" : "border-border/50")}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddCategory();
                      }}
                    />
                    <button 
                      onClick={handleAddCategory}
                      className="px-4 py-2.5 bg-foreground text-background font-bold rounded-xl shadow-md hover:bg-foreground/90 transition-all disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                  
                  <div className="space-y-2 mt-4 max-h-[250px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted">
                    {categories.map(cat => {
                      const isLocked = LOCKED_CATEGORIES.includes(cat);
                      const isPending = categoryPendingDelete === cat;
                      return (
                        <div key={cat} className={cn("flex flex-col border rounded-xl overflow-hidden transition-all", isLocked ? "bg-primary/5 border-primary/20" : isPending ? "bg-rose-50 border-rose-300" : "bg-muted/30 border-border/50")}>
                          <div className="flex items-center justify-between p-3">
                            <div className="flex items-center gap-2">
                              {isLocked && <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-md uppercase tracking-wider">Fixed</span>}
                              <span className="font-bold text-sm">{cat}</span>
                            </div>
                            {isLocked ? (
                              <span className="text-[10px] text-muted-foreground font-medium italic">System</span>
                            ) : (
                              <button onClick={() => setCategoryPendingDelete(isPending ? null : cat)} className={cn("p-1.5 rounded-lg transition-colors", isPending ? "text-rose-500 bg-rose-100" : "text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10")}>
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          {isPending && (
                            <div className="flex items-center justify-between px-3 py-2 bg-rose-50 border-t border-rose-200 gap-2">
                              <span className="text-xs font-bold text-rose-600">Delete "{cat}"?</span>
                              <div className="flex gap-2">
                                <button onClick={() => setCategoryPendingDelete(null)} className="px-3 py-1 text-xs font-bold text-muted-foreground bg-white border border-border/50 rounded-lg hover:bg-muted transition-colors">Cancel</button>
                                <button onClick={() => { confirmDeleteCategory(cat); setCategoryPendingDelete(null); }} className="px-3 py-1 text-xs font-bold text-white bg-rose-500 rounded-lg hover:bg-rose-600 transition-colors">Delete</button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                <div className="px-6 md:px-8 py-4 md:py-6 bg-muted/30 border-t border-border/50 flex justify-end gap-3 mt-auto shrink-0">
                  <button 
                    onClick={() => setIsManageCategoriesModalOpen(false)}
                    className="px-5 py-2.5 bg-foreground text-background font-bold rounded-xl hover:bg-foreground/90 transition-colors"
                  >
                    Done
                  </button>
                </div>
              </DialogContent>
            </Dialog>
            
          </DialogContent>
        </Dialog>

        {/* Edit Project Modal */}
        <Dialog open={isEditProjectModalOpen} onOpenChange={setIsEditProjectModalOpen}>
          <DialogContent className="max-w-[90vw] md:max-w-[700px] p-0 overflow-hidden rounded-[2.5rem] border-border/60 shadow-2xl [&>button]:hidden bg-card flex flex-col h-[90vh] md:h-[550px] gap-0">
            <div className="p-6 pb-4">
              <div className="flex items-center justify-between px-6 md:px-8 py-6 border-b border-border/50 bg-muted/30">
                <div>
                  <h2 className="text-xl md:text-2xl font-black tracking-tight">Edit Project</h2>
                  <p className="text-xs text-muted-foreground mt-1">Modify project details, stats targets, and budgets</p>
                </div>
                <DialogClose asChild>
                  <button className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </DialogClose>
              </div>
            </div>
            {editingProject && (
              <div className="flex flex-row overflow-hidden flex-1" style={{ maxHeight: 'calc(90vh - 130px)' }}>
                {/* Sidebar Tabs */}
                <div className="w-44 shrink-0 border-r border-border/50 bg-muted/20 p-3 flex flex-col gap-1 overflow-y-auto">
                  {([
                    { id: 'general', label: 'General', icon: <FolderGit2 className="w-4 h-4" /> },
                    { id: 'finance', label: 'Finance', icon: <IndianRupee className="w-4 h-4" /> },
                    ...(editingProject.category === "Digital Marketing" ? [{ id: 'campaigns' as const, label: 'Campaigns', icon: <TrendingUp className="w-4 h-4" /> }] : []),
                  ] as const).map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveProjectTab(tab.id)}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-bold transition-all text-left w-full",
                        activeProjectTab === tab.id
                          ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-5">
                  {activeProjectTab === 'general' && (
                    <>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Project Name <span className="text-red-500">*</span></label>
                        <input 
                          type="text" 
                          value={editingProject.name}
                          onChange={(e) => setEditingProject({...editingProject, name: e.target.value})}
                          className={"w-full px-4 py-3 bg-muted/50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium " + (showEditProjectErrors && !editingProject.name.trim() ? "border-red-500 ring-1 ring-red-500" : "border-border/50")}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Description</label>
                        <textarea 
                          value={editingProject.description || ""}
                          onChange={(e) => setEditingProject({...editingProject, description: e.target.value})}
                          placeholder="Brief project description..."
                          rows={2}
                          className="w-full px-4 py-3 bg-muted/50 border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium resize-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Start Date <span className="text-red-500">*</span></label>
                          <DatePicker
                            value={editingProject.startDate}
                            onChange={(newStart) => {
                              setEditingProject({
                                ...editingProject, 
                                startDate: newStart,
                                endDate: editingProject.endDate < newStart ? newStart : editingProject.endDate
                              });
                            }}
                            placeholder="Select start date"
                            className={"w-full h-[42px] bg-muted/50 border rounded-xl font-medium " + (showEditProjectErrors && !editingProject.startDate ? "border-red-500 ring-1 ring-red-500" : "border-border/50")}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">End Date <span className="text-red-500">*</span></label>
                          <DatePicker
                            value={editingProject.endDate}
                            minDate={editingProject.startDate}
                            onChange={(val) => setEditingProject({...editingProject, endDate: val})}
                            placeholder="Select end date"
                            className={"w-full h-[42px] bg-muted/50 border rounded-xl font-medium " + (showEditProjectErrors && !editingProject.endDate ? "border-red-500 ring-1 ring-red-500" : "border-border/50")}
                          />
                        </div>
                      </div>
                      <RenewalsManager
                        ranges={editingProject.dateRanges || []}
                        onChange={(dateRanges) => {
                          const last = dateRanges[dateRanges.length - 1];
                          setEditingProject({
                            ...editingProject,
                            dateRanges,
                            ...(last && last.start_date && last.end_date ? { startDate: last.start_date, endDate: last.end_date } : {}),
                          });
                        }}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Category <span className="text-red-500">*</span></label>
                          <Select 
                            value={editingProject.category || "Creative"}
                            onValueChange={(val) => setEditingProject({...editingProject, category: val})}
                          >
                            <SelectTrigger className={cn("w-full h-[46px] px-4 bg-muted/50 border rounded-xl text-sm font-medium", showEditProjectErrors && !editingProject.category ? "border-red-500 ring-1 ring-red-500" : "border-border/50")}>
                              <SelectValue placeholder="Select Category" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-border/60 shadow-xl bg-background/95 backdrop-blur-md z-[300]">
                              {FIXED_DEPARTMENTS.map(cat => (
                                <SelectItem key={cat} value={cat} className="text-sm font-medium rounded-lg cursor-pointer">
                                  {cat}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Status <span className="text-red-500">*</span></label>
                          <Select 
                            value={editingProject.status || "In Progress"}
                            onValueChange={(val) => setEditingProject({...editingProject, status: val as ProjectStatus})}
                          >
                            <SelectTrigger className="w-full h-[46px] px-4 bg-muted/50 border border-border/50 rounded-xl text-sm font-medium">
                              <SelectValue placeholder="Select Status" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-border/60 shadow-xl bg-background/95 backdrop-blur-md z-[300]">
                              {["In Progress", "In Review", "Completed", "On Hold"].map(st => (
                                <SelectItem key={st} value={st} className="text-sm font-medium rounded-lg cursor-pointer">
                                  {st}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Priority</label>
                          <Select 
                            value={editingProject.priority || "Medium"} 
                            onValueChange={(val) => setEditingProject({...editingProject, priority: val as any})} 
                          >
                            <SelectTrigger className="w-full h-[46px] px-4 bg-muted/50 border border-border rounded-xl text-sm font-medium">
                              <SelectValue placeholder="Select Priority" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-border/60 shadow-xl bg-background/95 backdrop-blur-md z-[300]">
                              {["Low", "Medium", "High", "Critical"].map(p => (
                                <SelectItem key={p} value={p} className="text-sm font-medium rounded-lg cursor-pointer">
                                  {p}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 flex justify-between">
                            <span>Progress</span>
                            <span className="text-foreground">{editingProject.progress}%</span>
                          </label>
                          <input 
                            type="range" 
                            min="0" max="100" 
                            value={editingProject.progress}
                            onChange={(e) => setEditingProject({...editingProject, progress: parseInt(e.target.value)})}
                            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary mt-3"
                          />
                        </div>
                      </div>
                      {(editingProject.category === "Creative" || editingProject.category === "Digital Marketing") && (
                        <div className="space-y-4 pt-4 border-t border-border/40 mt-4">
                          <h4 className="text-xs font-bold text-foreground uppercase tracking-widest">Monthly Social Media Delivery Targets</h4>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Posts Target / Month</label>
                              <input 
                                type="number" 
                                value={editingProject.post ?? 0} 
                                onChange={(e) => setEditingProject({...editingProject, post: parseInt(e.target.value) || 0})} 
                                placeholder="e.g. 8" 
                                className="w-full px-3 h-[38px] bg-muted/50 border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 font-semibold" 
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Reels Target / Month</label>
                              <input 
                                type="number" 
                                value={editingProject.reel ?? 0} 
                                onChange={(e) => setEditingProject({...editingProject, reel: parseInt(e.target.value) || 0})} 
                                placeholder="e.g. 8" 
                                className="w-full px-3 h-[38px] bg-muted/50 border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 font-semibold" 
                              />
                            </div>
                          </div>
                        </div>
                      )}
                      {editingProject.category === "Digital Marketing" && (
                        <div className="space-y-4 pt-4 border-t border-border/40 mt-4">
                          <h4 className="text-xs font-bold text-foreground uppercase tracking-widest">Digital Marketing Stats</h4>
                          <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Reach Target</label>
                              <input 
                                type="text" 
                                value={editingProject.reach || ""} 
                                onChange={(e) => setEditingProject({...editingProject, reach: e.target.value})} 
                                placeholder="e.g. 1.2M" 
                                className="w-full px-3 h-[38px] bg-muted/50 border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20" 
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Leads Target</label>
                              <input 
                                type="text" 
                                value={editingProject.leads || ""} 
                                onChange={(e) => setEditingProject({...editingProject, leads: e.target.value})} 
                                placeholder="e.g. 3,240" 
                                className="w-full px-3 h-[38px] bg-muted/50 border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20" 
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">CPL (₹)</label>
                              <input 
                                type="text" 
                                value={editingProject.cpl || ""} 
                                onChange={(e) => setEditingProject({...editingProject, cpl: e.target.value})} 
                                placeholder="e.g. 250" 
                                className="w-full px-3 h-[38px] bg-muted/50 border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20" 
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  {activeProjectTab === 'finance' && (
                    <>
                      <div className="space-y-2">
                        <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider">Project Budget</label>
                        <input type="text" value={editingProject.budget || ""} onChange={(e) => setEditingProject({...editingProject, budget: e.target.value.replace(/[^0-9]/g, "")})} placeholder="e.g. 10000" className="w-full px-4 h-[42px] bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider">Amount Received</label>
                        <input type="text" value={editingProject.amountReceived || ""} onChange={(e) => setEditingProject({...editingProject, amountReceived: e.target.value.replace(/[^0-9]/g, "")})} placeholder="e.g. 5000" className="w-full px-4 h-[42px] bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider">Next Payment Date</label>
                        <DatePicker
                          value={editingProject.nextPaymentDate || ""}
                          onChange={(val) => setEditingProject({...editingProject, nextPaymentDate: val})}
                          placeholder="Select payment date"
                          className="w-full h-[42px] bg-muted/50 border border-border rounded-xl text-sm font-medium"
                        />
                      </div>
                    </>
                  )}
                  {activeProjectTab === 'campaigns' && (
                    <div className="space-y-4 text-left">
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-foreground mb-1">Marketing Campaigns</h4>
                        <p className="text-[10px] text-muted-foreground font-semibold">Manage active ad campaigns and performance targets</p>
                      </div>

                      <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                        {(editingProject.campaigns || []).map((c: any, index: number) => {
                          const campaignObj = typeof c === 'string' ? { name: c, status: 'Active' } : { name: c.name || "", status: c.status || 'Active' };
                          return (
                            <div key={index} className="flex justify-between items-center p-3 bg-muted/20 border border-border/40 rounded-2xl group/campaign">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-foreground">{campaignObj.name}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextStatus = campaignObj.status === 'Active' ? 'Inactive' : 'Active';
                                    const updated = [...(editingProject.campaigns || [])];
                                    updated[index] = { name: campaignObj.name, status: nextStatus };
                                    setEditingProject({ ...editingProject, campaigns: updated });
                                    toast.success(`Campaign marked ${nextStatus}`);
                                  }}
                                  className={cn("px-2 py-0.5 text-[9px] font-black rounded-lg uppercase tracking-wider transition-colors", 
                                    campaignObj.status === 'Active' ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-muted text-muted-foreground hover:bg-muted-foreground/20")}
                                >
                                  {campaignObj.status}
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmModalState({
                                    isOpen: true,
                                    title: "Remove Campaign",
                                    description: "Are you sure you want to remove this campaign?",
                                    itemName: campaignObj.name,
                                    action: () => {
                                      const updated = (editingProject.campaigns || []).filter((_: any, i: number) => i !== index);
                                      setEditingProject({ ...editingProject, campaigns: updated });
                                      setConfirmModalState(prev => ({ ...prev, isOpen: false }));
                                      toast.success("Campaign removed");
                                    }
                                  });
                                }}
                                className="text-xs text-rose-500 hover:text-rose-700 font-extrabold opacity-0 group-hover/campaign:opacity-100 transition-opacity"
                              >
                                Remove
                              </button>
                            </div>
                          );
                        })}
                        {(editingProject.campaigns || []).length === 0 && (
                          <p className="text-xs text-muted-foreground italic font-medium py-4 text-center">No campaigns created yet.</p>
                        )}
                      </div>

                      <div className="flex gap-2 pt-2 border-t border-border/40">
                        <input
                          type="text"
                          placeholder="Campaign name (e.g. Winter Sales Ads)..."
                          id="edit_project_new_campaign_input"
                          className="flex-1 px-4 py-2.5 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none font-semibold text-foreground"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const btn = document.getElementById("add_campaign_edit_modal_btn");
                              if (btn) btn.click();
                            }
                          }}
                        />
                        <button
                          type="button"
                          id="add_campaign_edit_modal_btn"
                          onClick={() => {
                            const input = document.getElementById("edit_project_new_campaign_input") as HTMLInputElement;
                            if (input && input.value.trim()) {
                              const newCampaignName = input.value.trim();
                              const currentList = editingProject.campaigns || [];
                              const exists = currentList.some((c: any) => {
                                const name = typeof c === 'string' ? c : (c.name || "");
                                return name.toLowerCase() === newCampaignName.toLowerCase();
                              });
                              if (exists) {
                                toast.error("Campaign name already exists");
                                return;
                              }
                              setEditingProject({
                                ...editingProject,
                                campaigns: [...currentList, newCampaignName]
                              });
                              input.value = "";
                              toast.success("Campaign added!");
                            }
                          }}
                          className="px-4 py-2.5 bg-primary text-primary-foreground font-bold text-xs rounded-xl hover:bg-primary/95 transition-all shadow-sm flex items-center justify-center shrink-0"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="px-6 md:px-8 py-4 bg-muted/30 border-t border-border/50 flex justify-end gap-3 mt-auto shrink-0">
              <button 
                onClick={() => { setIsEditProjectModalOpen(false); setEditingProject(null); }}
                className="px-5 py-2.5 rounded-xl font-bold text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleUpdateProject}
                className="px-6 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl shadow-md hover:bg-primary/90 transition-all disabled:opacity-50"
              >
                Save Changes
              </button>
            </div>
            
            {/* Nested Manage Categories Modal for Edit */}
            <Dialog open={isManageCategoriesModalOpen} onOpenChange={setIsManageCategoriesModalOpen}>
              <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
                <div className="p-6 pb-4">
                  <div className="flex items-center justify-between px-6 md:px-8 py-6 border-b border-border/50 bg-muted/30">
          <div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight">Manage Categories</h2>
            
          </div>
          <DialogClose asChild>
            <button className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </DialogClose>
        </div>
                </div>
                
                <div className="p-6 md:p-8 space-y-6 overflow-y-auto max-h-[70vh]">
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="e.g. E-Commerce"
                      className={"flex-1 px-4 py-2.5 bg-muted/50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium " + (showCategoryErrors && !newCategoryName.trim() ? "border-red-500 ring-1 ring-red-500" : "border-border/50")}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddCategory();
                      }}
                    />
                    <button 
                      onClick={handleAddCategory}
                      className="px-4 py-2.5 bg-foreground text-background font-bold rounded-xl shadow-md hover:bg-foreground/90 transition-all disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                  
                  <div className="space-y-2 mt-4 max-h-[250px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted">
                    {categories.map(cat => {
                      const isLocked = LOCKED_CATEGORIES.includes(cat);
                      const isPending = categoryPendingDelete === cat;
                      return (
                        <div key={cat} className={cn("flex flex-col border rounded-xl overflow-hidden transition-all", isLocked ? "bg-primary/5 border-primary/20" : isPending ? "bg-rose-50 border-rose-300" : "bg-muted/30 border-border/50")}>
                          <div className="flex items-center justify-between p-3">
                            <div className="flex items-center gap-2">
                              {isLocked && <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-md uppercase tracking-wider">Fixed</span>}
                              <span className="font-bold text-sm">{cat}</span>
                            </div>
                            {isLocked ? (
                              <span className="text-[10px] text-muted-foreground font-medium italic">System</span>
                            ) : (
                              <button onClick={() => setCategoryPendingDelete(isPending ? null : cat)} className={cn("p-1.5 rounded-lg transition-colors", isPending ? "text-rose-500 bg-rose-100" : "text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10")}>
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          {isPending && (
                            <div className="flex items-center justify-between px-3 py-2 bg-rose-50 border-t border-rose-200 gap-2">
                              <span className="text-xs font-bold text-rose-600">Delete "{cat}"?</span>
                              <div className="flex gap-2">
                                <button onClick={() => setCategoryPendingDelete(null)} className="px-3 py-1 text-xs font-bold text-muted-foreground bg-white border border-border/50 rounded-lg hover:bg-muted transition-colors">Cancel</button>
                                <button onClick={() => { confirmDeleteCategory(cat); setCategoryPendingDelete(null); }} className="px-3 py-1 text-xs font-bold text-white bg-rose-500 rounded-lg hover:bg-rose-600 transition-colors">Delete</button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                <div className="px-6 md:px-8 py-4 md:py-6 bg-muted/30 border-t border-border/50 flex justify-end gap-3 mt-auto shrink-0">
                  <button 
                    onClick={() => setIsManageCategoriesModalOpen(false)}
                    className="px-5 py-2.5 bg-foreground text-background font-bold rounded-xl hover:bg-foreground/90 transition-colors"
                  >
                    Done
                  </button>
                </div>
              </DialogContent>
            </Dialog>

          </DialogContent>
        </Dialog>



      </div>
      <ConfirmModal 
        isOpen={confirmModalState.isOpen}
        onClose={() => setConfirmModalState(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModalState.action}
        title={confirmModalState.title}
        description={confirmModalState.description}
        itemName={confirmModalState.itemName}
      />
      {renderSmmModals()}
    </>
  );
}

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
            {showBrandDivision ? "Brand Division" : PROJECT_TABS.includes(activeTab) ? "Projects" : "Clients"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {showBrandDivision
              ? "Team members and their assigned brands."
              : PROJECT_TABS.includes(activeTab)
              ? "Manage your projects across departments."
              : "Manage your clients and view their projects."}
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={PROJECT_TABS.includes(activeTab) && !showBrandDivision ? "Search projects..." : "Search clients..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-card border border-border/60 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 px-4 py-2.5 bg-card border border-border/60 text-foreground font-bold text-sm rounded-xl hover:bg-muted/80 transition-all shadow-sm">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <span className="hidden sm:inline">Filter & Sort</span>
                {clientFilterCategories.length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-primary ml-1"></span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 border-border/60 shadow-xl bg-background/95 backdrop-blur-md z-50">
              <div className="px-2 py-1.5 text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1 flex justify-between items-center">
                <span>Status</span>
              </div>
              {TABS.map(tab => (
                <DropdownMenuItem 
                  key={tab}
                  onSelect={(e) => { e.preventDefault(); selectTab(tab); }}
                  className={cn(
                    "rounded-xl cursor-pointer py-2 focus:bg-primary/10 focus:text-primary font-medium transition-colors flex items-center justify-between",
                    activeTab === tab && "bg-primary/10 text-primary"
                  )}
                >
                  <span>{tab}</span>
                  {activeTab === tab && <CheckCircle2 className="w-4 h-4" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator className="bg-border/50 my-2" />
              <div className="px-2 py-1.5 text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Sort By</div>
              <DropdownMenuItem 
                onSelect={(e) => { e.preventDefault(); setClientSort("name"); }}
                className={cn(
                  "rounded-xl cursor-pointer py-2 focus:bg-primary/10 focus:text-primary font-medium transition-colors flex items-center justify-between",
                  clientSort === "name" && "bg-primary/10 text-primary"
                )}
              >
                <span>A-Z Name</span>
                {clientSort === "name" && <CheckCircle2 className="w-4 h-4" />}
              </DropdownMenuItem>
              <DropdownMenuItem 
                onSelect={(e) => { e.preventDefault(); setClientSort("budgetDesc"); }}
                className={cn(
                  "rounded-xl cursor-pointer py-2 focus:bg-primary/10 focus:text-primary font-medium transition-colors flex items-center justify-between",
                  clientSort === "budgetDesc" && "bg-primary/10 text-primary"
                )}
              >
                <span>Highest Budget</span>
                {clientSort === "budgetDesc" && <CheckCircle2 className="w-4 h-4" />}
              </DropdownMenuItem>
              <DropdownMenuItem 
                onSelect={(e) => { e.preventDefault(); setClientSort("projectsDesc"); }}
                className={cn(
                  "rounded-xl cursor-pointer py-2 focus:bg-primary/10 focus:text-primary font-medium transition-colors flex items-center justify-between",
                  clientSort === "projectsDesc" && "bg-primary/10 text-primary"
                )}
              >
                <span>Most Projects</span>
                {clientSort === "projectsDesc" && <CheckCircle2 className="w-4 h-4" />}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border/50 my-2" />
              <div className="px-2 py-1.5 text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Project Category</div>
              {categories.map(cat => (
                <DropdownMenuItem 
                  key={cat}
                  onSelect={(e) => { 
                    e.preventDefault(); 
                    setClientFilterCategories(prev => 
                      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
                    ); 
                  }}
                  className={cn(
                    "rounded-xl cursor-pointer py-2 focus:bg-primary/10 focus:text-primary font-medium transition-colors flex items-center justify-between",
                    clientFilterCategories.includes(cat) && "bg-primary/10 text-primary"
                  )}
                >
                  <span>{cat}</span>
                  {clientFilterCategories.includes(cat) && <CheckCircle2 className="w-4 h-4" />}
                </DropdownMenuItem>
              ))}
              {(clientFilterCategories.length > 0 || clientSort !== "name" || activeTab !== TABS[0]) && (
                <>
                  <DropdownMenuSeparator className="bg-border/50 my-2" />
                  <DropdownMenuItem 
                    onSelect={(e) => { 
                      e.preventDefault(); 
                      setClientFilterCategories([]); 
                      setClientSort("name");
                      selectTab(TABS[0] ?? "Active Projects");
                    }}
                    className="rounded-xl cursor-pointer py-2 focus:bg-rose-500/10 focus:text-rose-500 text-rose-500 font-bold transition-colors flex items-center justify-center"
                  >
                    Clear All Filters
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Feature 3: Pending Brands Button */}
          <button 
            type="button"
            onClick={() => setIsPendingBrandsModalOpen(true)} 
            className="flex items-center gap-2 px-3.5 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-bold text-sm rounded-xl transition-all shadow-sm relative group"
            title="Brands awaiting Creative Team assignment"
          >
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="hidden sm:inline">Pending Brands</span>
            {pendingProjects.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-xs font-black shadow-sm">
                {pendingProjects.length}
              </span>
            )}
          </button>

          {/* K9: project tabs par New Project + New Client baju-bajuma */}
          {PROJECT_TABS.includes(activeTab) && !showBrandDivision && (
            <button onClick={() => { setLandingProjectClientId(""); setIsLandingProjectOpen(true); }} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground font-bold text-sm rounded-xl hover:bg-primary/90 transition-all shadow-sm">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Project</span>
            </button>
          )}
          <button onClick={() => setIsNewClientModalOpen(true)} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground font-bold text-sm rounded-xl hover:bg-primary/90 transition-all shadow-sm">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Client</span>
          </button>
        </div>
      </div>

      {/* Category KPIs */}
      <div className="flex flex-wrap gap-4 pt-4 pb-2">
        {categoryStats.map((stat, i) => (
          <div key={i} className="flex-1 min-w-[150px] bg-white border border-border/60 rounded-3xl p-5 shadow-sm flex flex-col justify-center transition-all hover:shadow-lg hover:-translate-y-1 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/50 to-primary/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors" />
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 truncate relative z-10" title={stat.category}>{stat.category}</p>
            <div className="flex items-baseline gap-1.5 relative z-10">
              <p className="text-3xl font-black text-foreground tracking-tighter">{stat.clientCount}</p>
              <p className="text-[10px] font-medium text-muted-foreground mb-1 uppercase">Clients</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs (K1: 4 landing tabs + Brand Division toggle) */}
      <div className="flex gap-2 border-b border-border/40 pb-4 overflow-x-auto hide-scrollbar">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => selectTab(tab)}
            className={cn(
              "px-5 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-300",
              activeTab === tab && !showBrandDivision
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                : "bg-card text-foreground/70 hover:bg-muted/80 border border-border/40"
            )}
          >
            {tab}
          </button>
        ))}
        <button
          onClick={() => setShowBrandDivision(v => !v)}
          className={cn(
            "px-5 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-300",
            showBrandDivision
              ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
              : "bg-card text-foreground/70 hover:bg-muted/80 border border-dashed border-border/60"
          )}
        >
          Brand Division
        </button>
      </div>

      {/* K2: Department-wise filter chips (project showcase). Synced with the
          Filter-dropdown category selection (single-select). */}
      {PROJECT_TABS.includes(activeTab) && !showBrandDivision && (
        <div className="flex gap-2 overflow-x-auto hide-scrollbar py-1">
          {["All", ...categories].map(cat => {
            const selected = cat === "All"
              ? clientFilterCategories.length === 0
              : clientFilterCategories.length === 1 && clientFilterCategories[0] === cat;
            return (
              <button
                key={cat}
                onClick={() => setClientFilterCategories(cat === "All" ? [] : [cat])}
                className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200 border",
                  selected
                    ? "bg-foreground text-background border-foreground shadow-sm"
                    : "bg-card text-foreground/70 hover:bg-muted/80 border-border/40"
                )}
              >
                {cat}
              </button>
            );
          })}
        </div>
      )}

      {/* Feature 2: Brand Division View or Landing Grids (K1) */}
      {showBrandDivision ? (
        <div className="space-y-6 pt-2">
          {/* Brand Division Controls */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-card border border-border/60 rounded-2xl p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative min-w-[220px] flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search member or brand..."
                  value={brandDivisionSearch}
                  onChange={(e) => setBrandDivisionSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-muted/30 border border-border/60 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Role Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">Role:</span>
                <select
                  value={brandDivisionRole}
                  onChange={(e) => setBrandDivisionRole(e.target.value)}
                  className="h-9 px-3 bg-muted/30 border border-border/60 rounded-xl text-xs font-semibold focus:outline-none text-foreground"
                >
                  <option value="All">All Roles</option>
                  {CREATIVE_ROLES.map(r => (
                    <option key={r.key} value={r.label}>{r.icon} {r.label}</option>
                  ))}
                </select>
              </div>

              {/* Category Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">Category:</span>
                <select
                  value={brandDivisionCategory}
                  onChange={(e) => setBrandDivisionCategory(e.target.value)}
                  className="h-9 px-3 bg-muted/30 border border-border/60 rounded-xl text-xs font-semibold focus:outline-none text-foreground"
                >
                  <option value="All">All Categories</option>
                  {categories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {(brandDivisionSearch || brandDivisionRole !== "All" || brandDivisionCategory !== "All") && (
                <button
                  type="button"
                  onClick={() => {
                    setBrandDivisionSearch("");
                    setBrandDivisionRole("All");
                    setBrandDivisionCategory("All");
                  }}
                  className="text-xs font-bold text-rose-500 hover:underline px-2"
                >
                  Reset
                </button>
              )}
            </div>

            <div className="flex items-center gap-4 text-xs font-bold text-muted-foreground shrink-0 border-t md:border-t-0 md:border-l border-border/50 pt-2 md:pt-0 md:pl-4">
              <span>{brandDivisionData.length} Members</span>
              <span>•</span>
              <span>{brandDivisionData.reduce((acc, curr) => acc + curr.assignedProjects.length, 0)} Total Brands</span>
            </div>
          </div>

          {/* Members Brand Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {brandDivisionData.map((item) => (
              <div
                key={item.employee.id}
                className="bg-card border border-border/60 rounded-[2rem] p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  {/* Member Header */}
                  <div className="flex items-start justify-between gap-4 pb-4 border-b border-border/50">
                    <div className="flex items-center gap-3">
                      <img
                        src={item.employee.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(item.employee.name)}`}
                        alt={item.employee.name}
                        className="w-12 h-12 rounded-2xl object-cover border border-primary/20 shadow-sm"
                      />
                      <div>
                        <h3 className="font-black text-foreground text-base tracking-tight">{item.employee.name}</h3>
                        <p className="text-xs text-muted-foreground font-medium">{item.employee.designation || item.employee.department || "Creative Team"}</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-black shrink-0">
                      {item.assignedProjects.length} {item.assignedProjects.length === 1 ? 'Brand' : 'Brands'}
                    </span>
                  </div>

                  {/* Assigned Brands List */}
                  <div className="space-y-3 pt-4">
                    {item.assignedProjects.map(({ project, client, roles }) => (
                      <div
                        key={project.id}
                        className="p-3.5 rounded-2xl border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg border border-border/50 overflow-hidden bg-white p-0.5 shrink-0">
                              <img src={client?.logo || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=80"} alt={project.name} className="w-full h-full object-cover rounded-md" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-foreground truncate">{project.name}</h4>
                              <p className="text-[10px] text-muted-foreground truncate">{client?.name || "Client"}</p>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-muted text-muted-foreground border border-border/40 shrink-0">
                            {project.category}
                          </span>
                        </div>

                        {/* Handled Roles */}
                        <div className="flex flex-wrap gap-1">
                          {roles.map((r, ri) => (
                            <span key={ri} className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                              {r}
                            </span>
                          ))}
                        </div>

                        {/* Contact & Open Actions */}
                        <div className="flex items-center justify-between pt-1 border-t border-border/30 text-xs">
                          <div className="flex items-center gap-2">
                            {client?.phone && (
                              <a
                                href={`tel:${client.phone}`}
                                className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-primary transition-colors"
                                title={`Call ${client.phone}`}
                              >
                                <Phone className="w-3 h-3 text-primary" />
                                <span className="truncate max-w-[90px]">{client.phone}</span>
                              </a>
                            )}
                            {project.whatsapp_group_link && (
                              <a
                                href={project.whatsapp_group_link}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
                                title="Open Client WhatsApp Group"
                              >
                                <MessageSquare className="w-3 h-3 fill-emerald-500/20" />
                                <span>Group</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedClientId(project.clientId);
                              setSelectedProjectId(project.id);
                            }}
                            className="px-2.5 py-1 bg-primary text-primary-foreground font-bold text-[10px] rounded-lg shadow-sm hover:bg-primary/90 transition-all flex items-center gap-1 shrink-0"
                          >
                            <span>Open Project</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            {brandDivisionData.length === 0 && (
              <div className="col-span-full py-16 flex flex-col items-center justify-center text-center">
                <Users className="w-12 h-12 text-muted-foreground/50 mb-3" />
                <h3 className="text-lg font-bold text-foreground">No brand assignments found</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">No team members match your role or category filter. Try clearing filters or assigning brands.</p>
              </div>
            )}
          </div>
        </div>
      ) : PROJECT_TABS.includes(activeTab) ? (
        /* K1: Projects Grid (Active / Archived) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
          {filteredProjects.map((project) => {
            const projClient = clients.find(c => c.id === project.clientId);
            const statusStyle =
              project.status === "Completed"
                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                : project.status === "In Review"
                ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                : project.status === "On Hold"
                ? "bg-rose-500/10 text-rose-500 border-rose-500/30"
                : "bg-blue-500/10 text-blue-600 border-blue-500/30";
            return (
              <div
                key={project.id}
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.closest('button') || target.closest('[role="menuitem"]')) {
                    return;
                  }
                  if (projClient) setSelectedClientId(projClient.id);
                  setSelectedProjectId(project.id);
                }}
                className="group bg-white border border-border/40 rounded-[2rem] p-6 shadow-sm hover:shadow-2xl hover:shadow-primary/5 hover:-translate-y-1 hover:border-primary/30 transition-all duration-300 relative flex flex-col cursor-pointer"
              >
                {/* Background Accent */}
                <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-primary/[0.03] to-transparent rounded-t-[2rem] pointer-events-none transition-opacity opacity-0 group-hover:opacity-100"></div>

                <div className="flex justify-between items-start mb-5 relative z-10">
                  {/* K5: highlighted logo */}
                  <BrandLogo src={projClient?.logo} alt={project.name} size="w-20 h-20" />
                  <span className={cn("px-2.5 py-1 rounded-full text-[11px] font-black border shrink-0", statusStyle)}>
                    {project.status}
                  </span>
                </div>

                <div className="relative z-10 mb-4 flex-grow">
                  <h3 className="text-xl font-black tracking-tight text-foreground line-clamp-2 leading-tight group-hover:text-primary transition-colors">{project.name}</h3>
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-1 bg-muted rounded-md text-muted-foreground">
                      <Briefcase className="w-3.5 h-3.5" /> {projClient?.name || "Client"}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-1 bg-primary/10 text-primary rounded-md">
                      {project.category}
                    </span>
                  </div>
                  {/* K14: brand status chips — WA green/red, festival, followup */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {project.whatsapp_group_link ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 rounded-full">
                        ✓ WA Created
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 bg-rose-500/10 text-rose-500 border border-rose-500/30 rounded-full">
                        ✕ WA Not Created
                      </span>
                    )}
                    {project.festivalPost === "Yes" && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 rounded-full">
                        ✓ Festival Post
                      </span>
                    )}
                    {project.nextFollowupDate && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-amber-500/10 text-amber-600 border border-amber-500/30 rounded-full">
                        Followup: {safeFormat(project.nextFollowupDate, "dd/MM/yyyy")}
                      </span>
                    )}
                  </div>
                  {(project.startDate || project.endDate) && (
                    <p className="text-[11px] font-semibold text-muted-foreground mt-2 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {project.startDate ? safeFormat(project.startDate, "dd/MM/yyyy") : ""}{project.startDate && project.endDate ? " → " : ""}{project.endDate ? safeFormat(project.endDate, "dd/MM/yyyy") : ""}
                    </p>
                  )}
                </div>

                {/* Team overlap */}
                {(project.team ?? []).length > 0 && (
                  <div className="flex items-center gap-3 mb-4 relative z-10">
                    <div className="flex -space-x-2">
                      {(project.team ?? []).slice(0, 5).map((t, idx) => (
                        <img key={idx} src={t.avatar} className="w-8 h-8 rounded-full border-2 border-white shadow-sm" title={t.name} />
                      ))}
                    </div>
                    <span className="text-xs font-bold text-muted-foreground">{(project.team ?? []).length} Members</span>
                  </div>
                )}

                {/* Footer Summary (K8: date-driven progress) */}
                {(() => {
                  const dp = getDateProgress(project.startDate, project.endDate);
                  const pct = dp ? dp.pct : (project.progress || 0);
                  return (
                    <>
                      <div className="flex justify-between items-end pt-4 border-t border-border/40 relative z-10 gap-3">
                        <div className="flex flex-col min-w-0">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Budget</span>
                          <span className="text-base font-black text-foreground mt-0.5 font-mono truncate">{project.budget || "—"}</span>
                        </div>
                        <div className="flex flex-col text-right shrink-0">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Progress</span>
                          <span className="text-base font-black text-primary mt-0.5 font-mono">{pct}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted mt-3 overflow-hidden relative z-10">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
                      </div>
                      {dp && (
                        <p className="text-[10px] font-bold text-muted-foreground mt-1.5 relative z-10">{dp.elapsed}/{dp.total} days</p>
                      )}
                    </>
                  );
                })()}

              </div>
            );
          })}
          {filteredProjects.length === 0 && (
            <div className="col-span-full py-12 flex flex-col items-center justify-center text-center">
              <h3 className="text-lg font-bold text-foreground">No projects found</h3>
              <p className="text-muted-foreground mt-1">Try adjusting your search query.</p>
            </div>
          )}
        </div>
      ) : (
        /* Clients Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
          {filteredClients.map((client) => (
            <div 
              key={client.id} 
              onClick={(e) => {
                const target = e.target as HTMLElement;
                if (target.closest('button') || target.closest('[role="menuitem"]')) {
                  return;
                }
                setSelectedClientId(client.id);
                setSelectedProjectId(null);
              }}
              className="group bg-white border border-border/40 rounded-[2rem] p-6 shadow-sm hover:shadow-2xl hover:shadow-primary/5 hover:-translate-y-1 hover:border-primary/30 transition-all duration-300 relative flex flex-col cursor-pointer"
            >
              {/* Background Accent */}
              <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-primary/[0.03] to-transparent rounded-t-[2rem] pointer-events-none transition-opacity opacity-0 group-hover:opacity-100"></div>

              <div className="flex justify-between items-start mb-5 relative z-10">
                {/* K5: highlighted logo */}
                <BrandLogo src={client.logo} alt={client.name} size="w-20 h-20" />
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg transition-colors outline-none focus:ring-2 focus:ring-primary/20 bg-background/50 backdrop-blur-sm">
                      <MoreHorizontal className="w-5 h-5" />
                    </button>
                  </DropdownMenuTrigger>
                   <DropdownMenuContent 
                    align="end" 
                    className="w-48 rounded-2xl p-2 border-border/60 shadow-xl bg-background/95 backdrop-blur-md"
                  >
                    <DropdownMenuItem 
                      onSelect={() => {
                        setTimeout(() => {
                          setEditingClient(client);
                          setIsEditClientModalOpen(true);
                        }, 100);
                      }}
                      className="rounded-xl cursor-pointer py-2.5 focus:bg-primary/10 focus:text-primary font-medium transition-colors"
                    >
                      <Edit2 className="w-4 h-4 mr-2" /> Edit Client
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-border/50" />
                    {client.status === 'Archived' ? (
                      <DropdownMenuItem 
                        onSelect={() => {
                          setTimeout(() => {
                            unarchiveClient(client);
                          }, 100);
                        }}
                        className="rounded-xl cursor-pointer py-2.5 focus:bg-emerald-500/10 focus:text-emerald-600 font-medium text-emerald-600 transition-colors"
                      >
                        <ArchiveRestore className="w-4 h-4 mr-2" /> Unarchive Client
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem 
                        onSelect={() => {
                          setTimeout(() => {
                            archiveClient(client);
                          }, 100);
                        }}
                        className="rounded-xl cursor-pointer py-2.5 focus:bg-amber-500/10 focus:text-amber-600 font-medium text-amber-600 transition-colors"
                      >
                        <Archive className="w-4 h-4 mr-2" /> Archive Client
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem 
                      onSelect={() => {
                        setTimeout(() => {
                          confirmDeleteClient(client);
                        }, 100);
                      }}
                      className="rounded-xl cursor-pointer py-2.5 focus:bg-rose-500/10 focus:text-rose-600 font-medium text-rose-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="relative z-10 mb-6 flex-grow">
                <h3 className="text-xl font-black tracking-tight text-foreground line-clamp-2 leading-tight group-hover:text-primary transition-colors">{client.name}</h3>
                
                <div className="flex flex-wrap items-center gap-3 mt-3">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-1 bg-primary/10 text-primary rounded-md">
                    <Briefcase className="w-3.5 h-3.5" /> {projects.filter(p => p.clientId === client.id).length} Active Projects
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-1 bg-muted rounded-md text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5" /> {safeFormat(client.onboardingDate, "MM/yyyy")}
                  </span>
                </div>
              </div>

              {/* Contacts overlap */}
              {(client.contacts ?? []).length > 0 && (
                <div className="flex items-center gap-3 mb-6 relative z-10">
                  <div className="flex -space-x-2">
                    {(client.contacts ?? []).map((c, idx) => (
                      <img key={idx} src={c.avatar} className="w-8 h-8 rounded-full border-2 border-white shadow-sm" title={c.name} />
                    ))}
                  </div>
                  <span className="text-xs font-bold text-muted-foreground">Key Contacts</span>
                </div>
              )}

              {/* Footer Summary */}
              <div className="flex justify-between items-end pt-5 border-t border-border/40 relative z-10">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Budget</span>
                  <span className="text-base font-black text-foreground mt-0.5 font-mono">{client.totalBudget}</span>
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Outstanding</span>
                  <span className="text-base font-black text-rose-500 mt-0.5 font-mono">{client.outstandingPayment}</span>
                </div>
              </div>

            </div>
          ))}
          {filteredClients.length === 0 && (
            <div className="col-span-full py-12 flex flex-col items-center justify-center text-center">
              <h3 className="text-lg font-bold text-foreground">No clients found</h3>
              <p className="text-muted-foreground mt-1">Try adjusting your search query.</p>
            </div>
          )}
        </div>
      )}

      {/* New Client Modal */}
      <Dialog open={isNewClientModalOpen} onOpenChange={setIsNewClientModalOpen}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className="flex items-center justify-between px-8 py-6 border-b border-border/50 bg-muted/30">
            <div>
              <h2 className="text-2xl font-black tracking-tight">Add Client</h2>
              <p className="text-sm text-muted-foreground mt-1">Complete all sections to register a new client.</p>
            </div>
            <button 
              onClick={() => { setIsNewClientModalOpen(false); setNewClientFormData(defaultClientForm); setShowNewClientErrors(false); setActiveClientTab('general'); }}
              className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex flex-col md:flex-row h-[70vh] max-h-[800px]">
            {/* Sidebar Tabs */}
            <div className="w-full md:w-64 bg-muted/20 border-r border-border/50 p-4 space-y-2 overflow-y-auto shrink-0">
              {clientTabs.map(tab => {
                const Icon = tab.icon;
                const isActive = activeClientTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveClientTab(tab.id as ClientTab)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all",
                      isActive 
                        ? "bg-primary text-primary-foreground shadow-md" 
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                    {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
                  </button>
                )
              })}
            </div>

            {/* Form Content */}
            <div className="flex-1 overflow-y-auto p-8 relative">
              <div className="space-y-8">
                {activeClientTab === 'general' && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-black tracking-tight text-foreground flex items-center gap-2">
                      <User className="w-5 h-5 text-primary" /> General Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Contact Person Name <span className="text-red-500">*</span></label>
                        <input 
                          type="text" value={newClientFormData.name} onChange={(e) => handleClientFormChange('name', e.target.value)} placeholder="e.g. John Doe"
                          className={cn("w-full px-4 h-[42px] bg-muted/50 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all", showNewClientErrors && !newClientFormData.name.trim() ? "border-red-500 ring-1 ring-red-500" : "border-border")}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Phone Number <span className="text-red-500">*</span></label>
                        <input 
                          type="text" value={newClientFormData.phone} onChange={(e) => handleClientFormChange('phone', e.target.value)} placeholder="+91 00000 00000"
                          className={cn("w-full px-4 h-[42px] bg-muted/50 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all", showNewClientErrors && !newClientFormData.phone?.trim() ? "border-red-500 ring-1 ring-red-500" : "border-border")}
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Email Address</label>
                        <input 
                          type="email" value={newClientFormData.email} onChange={(e) => handleClientFormChange('email', e.target.value)} placeholder="client@example.com"
                          className="w-full px-4 h-[42px] bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {activeClientTab === 'company' && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-black tracking-tight text-foreground flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-primary" /> Company Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Company Name <span className="text-red-500">*</span></label>
                        <input 
                          type="text" value={newClientFormData.companyName} onChange={(e) => handleClientFormChange('companyName', e.target.value)} placeholder="e.g. Acme Corp"
                          className={cn("w-full px-4 h-[42px] bg-muted/50 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all", showNewClientErrors && !newClientFormData.companyName?.trim() ? "border-red-500 ring-1 ring-red-500" : "border-border")}
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Address</label>
                        <input 
                          type="text" value={newClientFormData.address} onChange={(e) => handleClientFormChange('address', e.target.value)} placeholder="123 Main St, City"
                          className="w-full px-4 h-[42px] bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">State / UT</label>
                        <input 
                          type="text" value={newClientFormData.state} onChange={(e) => handleClientFormChange('state', e.target.value)} placeholder="e.g. MH"
                          className="w-full px-4 h-[42px] bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">GSTIN</label>
                        <input 
                          type="text" value={newClientFormData.gstin} onChange={(e) => handleClientFormChange('gstin', e.target.value)} placeholder="e.g. 22AAAAA0000A1Z5"
                          className="w-full px-4 h-[42px] bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">
                            Department(s) <span className="text-muted-foreground font-normal lowercase">(select multiple)</span>
                          </label>
                          <span className="text-[11px] font-bold text-primary">
                            {parseDepartments(newClientFormData.department).length} selected
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          {FIXED_DEPARTMENTS.map(dept => {
                            const isSelected = parseDepartments(newClientFormData.department).includes(dept);
                            return (
                              <button
                                key={dept}
                                type="button"
                                onClick={() => toggleClientDepartment(dept, false)}
                                className={cn(
                                  "flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all text-left",
                                  isSelected
                                    ? "bg-primary/10 border-primary text-primary shadow-sm"
                                    : "bg-muted/40 border-border/70 text-muted-foreground hover:bg-muted/80 hover:text-foreground hover:border-border"
                                )}
                              >
                                <span className="truncate">{dept}</span>
                                <div className={cn(
                                  "w-4 h-4 rounded-md flex items-center justify-center shrink-0 border ml-1.5 transition-colors",
                                  isSelected ? "bg-primary border-primary text-primary-foreground" : "border-border bg-background"
                                )}>
                                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        {/* K3: jetla departments select, etla projects auto-create thashe */}
                        {parseDepartments(newClientFormData.department).length > 0 && (
                          <p className="text-[11px] font-semibold text-primary bg-primary/5 border border-primary/20 rounded-xl px-3 py-2">
                            {parseDepartments(newClientFormData.department).length} department{parseDepartments(newClientFormData.department).length > 1 ? "s" : ""} selected → {parseDepartments(newClientFormData.department).length} project{parseDepartments(newClientFormData.department).length > 1 ? "s" : ""} auto-create thashe ({parseDepartments(newClientFormData.department).join(", ")})
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeClientTab === 'service' && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-black tracking-tight text-foreground flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-primary" /> Service & Billing Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Sales Focused</label>
                        <input type="text" value={newClientFormData.salesFocused} onChange={(e) => handleClientFormChange('salesFocused', e.target.value)} className="w-full px-4 h-[42px] bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Total Budget</label>
                        <input type="text" value={newClientFormData.totalBudget} onChange={(e) => handleClientFormChange('totalBudget', e.target.value)} className="w-full px-4 h-[42px] bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Outstanding Payment</label>
                        <input type="text" value={newClientFormData.outstandingPayment} onChange={(e) => handleClientFormChange('outstandingPayment', e.target.value)} className="w-full px-4 h-[42px] bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Onboarding Date</label>
                        <DatePicker
                          value={newClientFormData.onboardingDate}
                          onChange={(val) => handleClientFormChange('onboardingDate', val)}
                          placeholder="Select onboarding date"
                          className="w-full h-[42px] bg-muted/50 border border-border rounded-xl text-sm font-medium"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {activeClientTab === 'remarks' && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-black tracking-tight text-foreground flex items-center gap-2">
                      <FileText className="w-5 h-5 text-primary" /> Remarks
                    </h3>
                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Additional Notes</label>
                      <textarea value={newClientFormData.remarks} onChange={(e) => handleClientFormChange('remarks', e.target.value)} className="w-full px-4 py-3 bg-muted/50 border border-border rounded-xl text-sm min-h-[120px] resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Footer Actions */}
          <div className="px-6 md:px-8 py-4 md:py-6 bg-muted/30 border-t border-border/50 flex justify-between gap-3 mt-auto shrink-0">
            <button 
              onClick={() => { setIsNewClientModalOpen(false); setNewClientFormData(defaultClientForm); setShowNewClientErrors(false); setActiveClientTab('general'); }}
              className="px-5 py-2.5 rounded-xl font-bold text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleCreateClient}
              className="px-6 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl shadow-md hover:bg-primary/90 transition-all"
            >
              Create Client
            </button>
          </div>
        </DialogContent>
      </Dialog>
      {/* K9: Landing standalone New Project — client pela (select), pachhi project */}
      <Dialog open={isLandingProjectOpen} onOpenChange={setIsLandingProjectOpen}>
        <DialogContent className="sm:max-w-[560px] p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className="flex items-center justify-between px-6 md:px-8 py-5 border-b border-border/50 bg-muted/30">
            <div>
              <h2 className="text-xl md:text-2xl font-black tracking-tight">New Project</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Select a client first, then project details.</p>
            </div>
            <button
              onClick={() => setIsLandingProjectOpen(false)}
              className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-6 md:p-8 space-y-5 overflow-y-auto max-h-[70vh]">
            <div className="space-y-2">
              <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Client *</label>
              <div className="flex gap-2">
                <select
                  value={landingProjectClientId}
                  onChange={(e) => setLandingProjectClientId(e.target.value)}
                  className={"flex-1 px-4 h-[42px] bg-muted/50 border rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all " + (showNewProjectErrors && !landingProjectClientId ? "border-red-500 ring-1 ring-red-500" : "border-border/50")}
                >
                  <option value="">Select client...</option>
                  {clients.filter(c => c.status === "Active").sort((a, b) => a.name.localeCompare(b.name)).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => { setIsLandingProjectOpen(false); setIsNewClientModalOpen(true); }}
                  className="px-4 h-[42px] bg-primary/10 text-primary font-bold rounded-xl hover:bg-primary/20 transition-all text-sm whitespace-nowrap"
                  title="Navo client banavo"
                >
                  + New
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Project Name *</label>
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="e.g. Diwali Campaign"
                className={"w-full px-4 h-[42px] bg-muted/50 border rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all " + (showNewProjectErrors && !newProjectName.trim() ? "border-red-500 ring-1 ring-red-500" : "border-border/50")}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Department *</label>
              <select
                value={newProjectCategory}
                onChange={(e) => setNewProjectCategory(e.target.value)}
                className={"w-full px-4 h-[42px] bg-muted/50 border rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all " + (showNewProjectErrors && !newProjectCategory ? "border-red-500 ring-1 ring-red-500" : "border-border/50")}
              >
                <option value="">Select department...</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Start Date *</label>
                <DatePicker
                  value={newProjectStartDate}
                  onChange={(val) => setNewProjectStartDate(val)}
                  placeholder="Start date"
                  className="w-full h-[42px] bg-muted/50 border border-border rounded-xl text-sm font-medium"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">End Date *</label>
                <DatePicker
                  value={newProjectEndDate}
                  onChange={(val) => setNewProjectEndDate(val)}
                  placeholder="End date"
                  className="w-full h-[42px] bg-muted/50 border border-border rounded-xl text-sm font-medium"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Budget</label>
              <input
                type="text"
                value={newProjectBudget}
                onChange={(e) => setNewProjectBudget(e.target.value)}
                placeholder="e.g. ₹10,000"
                className="w-full px-4 h-[42px] bg-muted/50 border border-border/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>
          <div className="px-6 md:px-8 py-4 bg-muted/30 border-t border-border/50 flex justify-end gap-3 shrink-0">
            <button
              onClick={() => setIsLandingProjectOpen(false)}
              className="px-5 py-2.5 rounded-xl font-bold text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateProject}
              className="px-6 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl shadow-md hover:bg-primary/90 transition-all"
            >
              Create Project
            </button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Edit Client Modal */}
      <Dialog open={isEditClientModalOpen} onOpenChange={setIsEditClientModalOpen}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className="flex items-center justify-between px-8 py-6 border-b border-border/50 bg-muted/30">
            <div>
              <h2 className="text-2xl font-black tracking-tight">Edit Client</h2>
              <p className="text-sm text-muted-foreground mt-1">Update existing client information.</p>
            </div>
            <button 
              onClick={() => { setIsEditClientModalOpen(false); setEditingClient(null); setActiveClientTab('general'); }}
              className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {editingClient && (
            <div className="flex flex-col md:flex-row h-[70vh] max-h-[800px]">
              {/* Sidebar Tabs */}
              <div className="w-full md:w-64 bg-muted/20 border-r border-border/50 p-4 space-y-2 overflow-y-auto shrink-0">
                {clientTabs.map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeClientTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveClientTab(tab.id as ClientTab)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all",
                        isActive 
                          ? "bg-primary text-primary-foreground shadow-md" 
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                      {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
                    </button>
                  )
                })}
              </div>

              {/* Form Content */}
              <div className="flex-1 overflow-y-auto p-8 relative">
                <div className="space-y-8">
                  {activeClientTab === 'general' && (
                    <div className="space-y-6">
                      <h3 className="text-lg font-black tracking-tight text-foreground flex items-center gap-2">
                        <User className="w-5 h-5 text-primary" /> General Information
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Contact Person Name <span className="text-red-500">*</span></label>
                          <input 
                            type="text" value={editingClient.name || ''} onChange={(e) => handleClientFormChange('name', e.target.value, true)} 
                            className={cn("w-full px-4 h-[42px] bg-muted/50 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all", showEditClientErrors && !editingClient.name?.trim() ? "border-red-500 ring-1 ring-red-500" : "border-border")}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Phone Number <span className="text-red-500">*</span></label>
                          <input 
                            type="text" value={editingClient.phone || ''} onChange={(e) => handleClientFormChange('phone', e.target.value, true)} 
                            className={cn("w-full px-4 h-[42px] bg-muted/50 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all", showEditClientErrors && !editingClient.phone?.trim() ? "border-red-500 ring-1 ring-red-500" : "border-border")}
                          />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Email Address</label>
                          <input 
                            type="email" value={editingClient.email || ''} onChange={(e) => handleClientFormChange('email', e.target.value, true)} 
                            className="w-full px-4 h-[42px] bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {activeClientTab === 'company' && (
                    <div className="space-y-6">
                      <h3 className="text-lg font-black tracking-tight text-foreground flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-primary" /> Company Details
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2 md:col-span-2">
                          <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Company Name <span className="text-red-500">*</span></label>
                          <input 
                            type="text" value={editingClient.companyName || ''} onChange={(e) => handleClientFormChange('companyName', e.target.value, true)} 
                            className={cn("w-full px-4 h-[42px] bg-muted/50 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all", showEditClientErrors && !editingClient.companyName?.trim() ? "border-red-500 ring-1 ring-red-500" : "border-border")}
                          />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Address</label>
                          <input 
                            type="text" value={editingClient.address || ''} onChange={(e) => handleClientFormChange('address', e.target.value, true)} 
                            className="w-full px-4 h-[42px] bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">State / UT</label>
                          <input 
                            type="text" value={editingClient.state || ''} onChange={(e) => handleClientFormChange('state', e.target.value, true)} 
                            className="w-full px-4 h-[42px] bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">GSTIN</label>
                          <input 
                            type="text" value={editingClient.gstin || ''} onChange={(e) => handleClientFormChange('gstin', e.target.value, true)} 
                            className="w-full px-4 h-[42px] bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                          />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <div className="flex items-center justify-between">
                            <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">
                              Department(s) <span className="text-muted-foreground font-normal lowercase">(select multiple)</span>
                            </label>
                            <span className="text-[11px] font-bold text-primary">
                              {parseDepartments(editingClient.department).length} selected
                            </span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                            {FIXED_DEPARTMENTS.map(dept => {
                              const isSelected = parseDepartments(editingClient.department).includes(dept);
                              return (
                                <button
                                  key={dept}
                                  type="button"
                                onClick={() => toggleClientDepartment(dept, true)}
                                className={cn(
                                  "flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all text-left",
                                  isSelected
                                    ? "bg-primary/10 border-primary text-primary shadow-sm"
                                    : "bg-muted/40 border-border/70 text-muted-foreground hover:bg-muted/80 hover:text-foreground hover:border-border"
                                )}
                              >
                                <span className="truncate">{dept}</span>
                                <div className={cn(
                                  "w-4 h-4 rounded-md flex items-center justify-center shrink-0 border ml-1.5 transition-colors",
                                  isSelected ? "bg-primary border-primary text-primary-foreground" : "border-border bg-background"
                                )}>
                                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                </div>
                              </button>
                            );
                          })}
                          </div>
                          {/* K3: dept add/remove → per-dept projects auto add/remove thashe */}
                          {editingClient && parseDepartments(editingClient.department).length > 0 && (
                            <p className="text-[11px] font-semibold text-primary bg-primary/5 border border-primary/20 rounded-xl px-3 py-2">
                              {parseDepartments(editingClient.department).length} department{parseDepartments(editingClient.department).length > 1 ? "s" : ""} → {parseDepartments(editingClient.department).length} project{parseDepartments(editingClient.department).length > 1 ? "s" : ""} ({parseDepartments(editingClient.department).join(", ")})
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeClientTab === 'service' && (
                    <div className="space-y-6">
                      <h3 className="text-lg font-black tracking-tight text-foreground flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-primary" /> Service & Billing Details
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2 md:col-span-2">
                          <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Sales Focused</label>
                          <input type="text" value={editingClient.salesFocused || ''} onChange={(e) => handleClientFormChange('salesFocused', e.target.value, true)} className="w-full px-4 h-[42px] bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Total Budget</label>
                          <input type="text" value={editingClient.totalBudget || ''} onChange={(e) => handleClientFormChange('totalBudget', e.target.value, true)} className="w-full px-4 h-[42px] bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Outstanding Payment</label>
                          <input type="text" value={editingClient.outstandingPayment || ''} onChange={(e) => handleClientFormChange('outstandingPayment', e.target.value, true)} className="w-full px-4 h-[42px] bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Onboarding Date</label>
                          <DatePicker
                            value={editingClient.onboardingDate || ''}
                            onChange={(val) => handleClientFormChange('onboardingDate', val, true)}
                            placeholder="Select onboarding date"
                            className="w-full h-[42px] bg-muted/50 border border-border rounded-xl text-sm font-medium"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {activeClientTab === 'remarks' && (
                    <div className="space-y-6">
                      <h3 className="text-lg font-black tracking-tight text-foreground flex items-center gap-2">
                        <FileText className="w-5 h-5 text-primary" /> Remarks
                      </h3>
                      <div className="space-y-2">
                        <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Additional Notes</label>
                        <textarea value={editingClient.remarks || ''} onChange={(e) => handleClientFormChange('remarks', e.target.value, true)} className="w-full px-4 py-3 bg-muted/50 border border-border rounded-xl text-sm min-h-[120px] resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Footer Actions */}
          <div className="px-6 md:px-8 py-4 md:py-6 bg-muted/30 border-t border-border/50 flex justify-between gap-3 mt-auto shrink-0">
            <button 
              onClick={() => { setIsEditClientModalOpen(false); setEditingClient(null); setActiveClientTab('general'); }}
              className="px-5 py-2.5 rounded-xl font-bold text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleUpdateClient}
              className="px-6 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl shadow-md hover:bg-primary/90 transition-all"
            >
              Save Changes
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmModal 
        isOpen={confirmModalState.isOpen}
        onClose={() => setConfirmModalState(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModalState.action}
        title={confirmModalState.title}
        description={confirmModalState.description}
        itemName={confirmModalState.itemName}
      />
      {renderSmmModals()}
    </div>
  );
}
