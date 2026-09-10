import { useState, useEffect, useMemo } from "react";
import { X,  Search, Plus, Filter, MoreHorizontal, LayoutGrid, List, Briefcase, Calendar, Clock, Star, Circle, Trash2, Edit2, Archive, ArchiveRestore, ArrowLeft, Users, IndianRupee, FolderGit2, CheckCircle2, Settings2, TrendingUp, MousePointerClick, Target, BarChart3, ChevronDown, User, Building2, CreditCard, FileText, ChevronRight, Video, Instagram, Layers  } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DialogClose,  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter  } from "@/components/ui/dialog";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { format, subDays, startOfYear, differenceInDays } from "date-fns";
import { DateRange } from "react-day-picker";
import { moveToRecycleBin } from "@/lib/recycle-bin";
import { SearchableSelect } from "@/components/ui/select";

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

interface Project {
  id: string;
  clientId: string;
  name: string;
  description?: string;
  category: string;
  status: ProjectStatus;
  priority?: "Low" | "Medium" | "High" | "Critical";
  progress: number;
  startDate: string;
  endDate: string;
  teamDeadline?: string;
  budget: string;
  services?: string;
  post?: number;
  reel?: number;
  festivalPost?: string;
  amountReceived?: string;
  nextPaymentDate?: string;
  reach?: string;
  leads?: string;
  cpl?: string;
  campaigns?: any[];
  contentCalendar?: CalendarItem[];
  team: { name: string; avatar: string }[];
  dailyStats?: {
    id: string;
    date: string;
    campaignName: string;
    reach: number;
    leads: number;
    spend: number;
  }[];
  activityLogs?: {
    id: string;
    action: string;
    performedBy: string;
    timestamp: string;
    details?: string;
  }[];
  modules?: {
    id: string;
    name: string;
    assignedToName?: string;
    status?: "todo" | "in-progress" | "bugs" | "onhold" | "pending" | "completed";
    priority?: "low" | "medium" | "high" | "urgent";
    estimatedHours?: number;
    dueDate?: string;
    tasks: {
      id: string;
      title: string;
      status: "todo" | "in-progress" | "bugs" | "onhold" | "pending" | "completed";
      dueDate?: string;
      assignedToName?: string;
      assignedToAvatar?: string;
      reasonForPending?: string;
      phase?: string;
    }[];
  }[];
}

interface CalendarItem {
  id: string;
  postingDate: string;
  postingDay?: string | undefined;
  type: string;
  topic: string;
  concept?: string | undefined;
  reference?: string | undefined;
  assignedTo?: string[] | undefined;
  scriptDate?: string | undefined;
  scriptLink?: string | undefined;
  shootDate?: string | undefined;
  shootLink?: string | undefined;
  editingStart?: string | undefined;
  finalReelLink?: string | undefined;
  finalPostLink?: string | undefined;
  approval?: string | undefined;
  status: string;
  thumbnailDate?: string | undefined;
  thumbnailLink?: string | undefined;
  captionDate?: string | undefined;
  caption?: string | undefined;
  postingLinkOfIg?: string | undefined;
  actualPostingDate?: string | undefined;
  remark?: string | undefined;
  issues?: { id: string; text: string; timestamp: string }[] | undefined;
}

const LOCKED_CATEGORIES = ["Digital Marketing", "Social Media Management", "Web Dev", "App Dev"];
const DEFAULT_CATEGORIES = ["Digital Marketing", "Social Media Management", "Web Dev", "App Dev", "Design", "Consulting", "General"];


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
      { id: "ds-1", date: "2026-08-24", campaignName: "Q4 Retargeting Ads", reach: 15000, leads: 45, spend: 8100 },
      { id: "ds-2", date: "2026-08-24", campaignName: "Holiday Social Push", reach: 28000, leads: 92, spend: 15600 },
      { id: "ds-3", date: "2026-08-23", campaignName: "Q4 Retargeting Ads", reach: 14200, leads: 38, spend: 7800 },
      { id: "ds-4", date: "2026-08-23", campaignName: "Holiday Social Push", reach: 25400, leads: 81, spend: 14500 },
      { id: "ds-5", date: "2026-08-22", campaignName: "B2B Email Drip", reach: 4100, leads: 12, spend: 3200 }
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

const TABS = ["Active Clients", "Archived Clients"];

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
  const [newIssueText, setNewIssueText] = useState("");
  const issuesList = item.issues || [];

  const handleAddIssue = () => {
    if (!newIssueText.trim()) return;
    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    const newIssue = {
      id: `issue-${Date.now()}`,
      text: newIssueText.trim(),
      timestamp: dateStr
    };

    const updatedIssues = [...issuesList, newIssue];
    const updatedCalendar = projectCalendar.map((x: any) => 
      x.id === item.id ? { ...x, issues: updatedIssues } : x
    );
    setProjects(projects.map(p => p.id === project.id ? { ...p, contentCalendar: updatedCalendar } : p));
    onLogActivity("Logged Issue", `Added issue "${newIssueText.trim()}" on content idea "${item.topic || 'Untitled'}"`);
    setNewIssueText("");
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
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className={cn(
          "mx-auto px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider block text-center cursor-pointer transition-all border shadow-sm",
          issuesList.length > 0 ? "bg-rose-500/10 text-rose-600 border-rose-500/25 hover:bg-rose-500/20" : "bg-muted text-muted-foreground hover:bg-muted/80 border-border/40"
        )}>
          {issuesList.length > 0 ? `⚠️ ${issuesList.length} Issues` : "+ Log Issue"}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-4 bg-card border border-border rounded-2xl shadow-xl z-50 text-left" align="center">
        <div className="space-y-3">
          <div className="flex justify-between items-center border-b border-border/40 pb-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-foreground">Logged Issues ({issuesList.length})</h4>
          </div>
          
          <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
            {issuesList.length === 0 ? (
              <p className="text-[10px] text-muted-foreground italic font-medium">No active issues logged.</p>
            ) : (
              issuesList.map((issue) => (
                <div key={issue.id} className="p-2 bg-rose-500/5 rounded-xl border border-rose-500/10 flex justify-between items-start gap-2 group/issue">
                  <div className="space-y-0.5">
                    <p className="text-[11px] font-bold text-rose-700 leading-normal">{issue.text}</p>
                    <span className="text-[9px] text-rose-400 font-mono block">{issue.timestamp}</span>
                  </div>
                  <button 
                    onClick={() => handleRemoveIssue(issue.id)}
                    className="text-[9px] text-rose-500 hover:text-rose-700 font-black"
                    title="Resolve/Delete Issue"
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="pt-2 border-t border-border/40 space-y-1.5">
            <textarea
              placeholder="Type issue details..."
              value={newIssueText}
              onChange={(e) => setNewIssueText(e.target.value)}
              rows={2}
              className="w-full px-2.5 py-1.5 bg-muted/30 border border-border/50 rounded-xl text-xs focus:outline-none resize-none font-medium text-foreground"
            />
            <button
              onClick={handleAddIssue}
              className="w-full py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition-colors shadow-sm"
            >
              Add Issue
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

export function Projects({ isNew }: { isNew?: boolean }) {
  const [projectSubTab, setProjectSubTab] = useState<"workspace" | "logs">("workspace");
  const [isBulkAdd, setIsBulkAdd] = useState(false);
  const [bulkStatsEntries, setBulkStatsEntries] = useState<{ [campaignName: string]: { reach: string, leads: string, spend: string } }>({});

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
  // One-time migration: clear old localStorage if version mismatch
  const STORAGE_VERSION = 'v3';
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

  const [categories, setCategories] = useState<string[]>(() => {
    const saved = (typeof window !== 'undefined' ? localStorage.getItem('hrms_categories') : null);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Ensure all locked categories are present
          const merged = [...parsed];
          LOCKED_CATEGORIES.forEach(cat => {
            if (!merged.includes(cat)) {
              merged.push(cat);
            }
          });
          return merged;
        }
      } catch (e) {}
    }
    return DEFAULT_CATEGORIES;
  });

  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [clientSort, setClientSort] = useState<"name" | "budgetDesc" | "projectsDesc">("name");
  const [clientFilterCategories, setClientFilterCategories] = useState<string[]>([]);
  const [projectFilterStatuses, setProjectFilterStatuses] = useState<ProjectStatus[]>([]);
  const [projectFilterCategories, setProjectFilterCategories] = useState<string[]>([]);
  
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
  }, [selectedProjectId]);
  
  const [campaignDateRange, setCampaignDateRange] = useState("Last 30 Days");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [selectedCampaignForStats, setSelectedCampaignForStats] = useState("All Campaigns");
  const [isLogDailyStatsOpen, setIsLogDailyStatsOpen] = useState(false);
  const [dailyStatsForm, setDailyStatsForm] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    campaignName: "Q4 Retargeting Ads",
    reach: "",
    leads: "",
    spend: ""
  });

  useEffect(() => {
    if (isLogDailyStatsOpen && selectedProjectId) {
      const project = projects.find(p => p.id === selectedProjectId);
      const campaignList = (project?.campaigns && project.campaigns.length > 0)
        ? project.campaigns
            .map(c => typeof c === 'string' ? { name: c, status: 'Active' } : { name: c.name || "", status: c.status || 'Active' })
            .filter(c => c.status === 'Active')
            .map(c => c.name)
        : ["Q4 Retargeting Ads", "Holiday Social Push", "B2B Email Drip"];
      
      const dailyStats = project?.dailyStats || [];
      const initial: any = {};
      campaignList.forEach(name => {
        const match = dailyStats.find((s: any) => s.campaignName === name && s.date === dailyStatsForm.date);
        if (match) {
          initial[name] = {
            reach: match.reach !== undefined ? String(match.reach) : "",
            leads: match.leads !== undefined ? String(match.leads) : "",
            spend: match.spend !== undefined ? String(match.spend) : ""
          };
        } else {
          initial[name] = { reach: "", leads: "", spend: "" };
        }
      });
      setBulkStatsEntries(initial);
    }
  }, [isLogDailyStatsOpen, selectedProjectId, dailyStatsForm.date]);

  const handleLogDailyStats = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) return;
    const project = projects.find(p => p.id === selectedProjectId);
    if (!project) return;

    if (!dailyStatsForm.date) {
      toast.error("Please select a date");
      return;
    }

    if (isBulkAdd) {
      const newStatsList: any[] = [];
      const logDetails: string[] = [];
      
      for (const [campaignName, entry] of Object.entries(bulkStatsEntries)) {
        if (!entry.reach && !entry.leads && !entry.spend) continue;
        
        const reachVal = entry.reach ? parseInt(entry.reach) : 0;
        const leadsVal = entry.leads ? parseInt(entry.leads) : 0;
        const spendVal = entry.spend ? parseInt(entry.spend) : 0;
        
        if (isNaN(reachVal) || reachVal < 0 || isNaN(leadsVal) || leadsVal < 0 || isNaN(spendVal) || spendVal < 0) {
          toast.error(`Please enter valid positive numbers for ${campaignName}`);
          return;
        }
        
        newStatsList.push({
          id: `ds-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          date: dailyStatsForm.date,
          campaignName,
          reach: reachVal,
          leads: leadsVal,
          spend: spendVal
        });
        
        logDetails.push(`${campaignName} (Reach: ${reachVal}, Leads: ${leadsVal}, Spend: ₹${spendVal})`);
      }
      
      if (newStatsList.length === 0) {
        toast.error("Please enter stats for at least one campaign.");
        return;
      }
      
      const loggedCampaignNames = newStatsList.map(s => s.campaignName);
      const remainingStats = (project.dailyStats || []).filter((s: any) => 
        !(s.date === dailyStatsForm.date && loggedCampaignNames.includes(s.campaignName))
      );
      const updatedStats = [...newStatsList, ...remainingStats];
      
      const nowLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        action: "Logged Bulk Daily Stats",
        performedBy: "Alex (You)",
        timestamp: `${String(new Date().getDate()).padStart(2, '0')}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${new Date().getFullYear()} ${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`,
        details: `Logged stats for ${newStatsList.length} campaigns on ${dailyStatsForm.date}: ${logDetails.join("; ")}`
      };
      
      const newProjects = projects.map(p => p.id === selectedProjectId ? { 
        ...p, 
        dailyStats: updatedStats,
        activityLogs: [...(p.activityLogs || []), nowLog]
      } : p);
      
      setProjects(newProjects);
      localStorage.setItem("hrms_projects", JSON.stringify(newProjects));
      setIsLogDailyStatsOpen(false);
      toast.success("Bulk stats logged successfully!");
      return;
    }

    const reachVal = parseInt(dailyStatsForm.reach);
    const leadsVal = parseInt(dailyStatsForm.leads);
    const spendVal = parseInt(dailyStatsForm.spend);
    if (isNaN(reachVal) || reachVal < 0) {
      toast.error("Please enter a valid reach number");
      return;
    }
    if (isNaN(leadsVal) || leadsVal < 0) {
      toast.error("Please enter a valid leads number");
      return;
    }
    if (isNaN(spendVal) || spendVal < 0) {
      toast.error("Please enter a valid spend amount");
      return;
    }

    const newStat = {
      id: `ds-${Date.now()}`,
      date: dailyStatsForm.date,
      campaignName: dailyStatsForm.campaignName,
      reach: reachVal,
      leads: leadsVal,
      spend: spendVal
    };

    const remainingStats = (project.dailyStats || []).filter((s: any) => 
      !(s.date === dailyStatsForm.date && s.campaignName === dailyStatsForm.campaignName)
    );
    const updatedStats = [newStat, ...remainingStats];
    
    const nowLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      action: "Logged Daily Stats",
      performedBy: "Alex (You)",
      timestamp: `${String(new Date().getDate()).padStart(2, '0')}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${new Date().getFullYear()} ${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`,
      details: `Added stats for ${dailyStatsForm.campaignName} on ${dailyStatsForm.date} (Reach: ${reachVal}, Leads: ${leadsVal}, Spend: ₹${spendVal})`
    };

    const newProjects = projects.map(p => p.id === selectedProjectId ? { 
      ...p, 
      dailyStats: updatedStats,
      activityLogs: [...(p.activityLogs || []), nowLog]
    } : p);

    setProjects(newProjects);
    localStorage.setItem("hrms_projects", JSON.stringify(newProjects));
    window.dispatchEvent(new Event("storage"));
    
    setIsLogDailyStatsOpen(false);
    setDailyStatsForm({
      date: format(new Date(), "yyyy-MM-dd"),
      campaignName: "Q4 Retargeting Ads",
      reach: "",
      leads: "",
      spend: ""
    });
    toast.success("Daily stats logged successfully!");
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

  const handleCreateClient = () => {
    if (!newClientFormData.name.trim() || !newClientFormData.companyName?.trim() || !newClientFormData.phone?.trim()) {
      setShowNewClientErrors(true);
      toast.error("Please fill all required fields");
      return;
    }

    const newClient: Client = {
      id: `c${Date.now()}`,
      ...newClientFormData,
      logo: `https://i.pravatar.cc/150?u=${encodeURIComponent(newClientFormData.name)}`,
      totalBudget: newClientFormData.totalBudget || "₹0",
      outstandingPayment: newClientFormData.outstandingPayment || "₹0",
      activeProjects: 0,
      contacts: []
    };

    setClients([newClient, ...clients]);
    setIsNewClientModalOpen(false);
    setNewClientFormData(defaultClientForm);
    setShowNewClientErrors(false);
    toast.success("Client created successfully");
  };
  const handleUpdateClient = () => {
    if (!editingClient || !editingClient.name.trim() || !editingClient.companyName?.trim() || !editingClient.phone?.trim()) {
      setShowEditClientErrors(true);
      toast.error("Please fill all required fields");
      return;
    }

    setClients(clients.map(c => c.id === editingClient.id ? editingClient : c));
    setIsEditClientModalOpen(false);
    setEditingClient(null);
    setShowEditClientErrors(false);
    toast.success("Client updated successfully");
  };

  const handleCreateProject = () => {
    setShowNewProjectErrors(true);
    if (!newProjectName.trim() || !selectedClientId || !newProjectCategory || !newProjectStartDate || !newProjectEndDate) {
      toast.error("Please fill in all required fields");
      setTimeout(() => setShowNewProjectErrors(false), 3000);
      return;
    }
    const newProject: Project = {
      id: `p${Date.now()}`,
      clientId: selectedClientId,
      name: newProjectName,
      category: newProjectCategory,
      status: "In Progress",
      progress: 0,
      startDate: newProjectStartDate ?? (new Date().toISOString().split('T')[0] as string),
      endDate: newProjectEndDate ?? (new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] as string),
      budget: newProjectBudget || "₹0",
      team: [{ name: "User", avatar: "https://i.pravatar.cc/150?u=user" }]
    };

    if (newProjectDescription) newProject.description = newProjectDescription;
    if (newProjectPriority) newProject.priority = newProjectPriority;
    if (newProjectTeamDeadline) newProject.teamDeadline = newProjectTeamDeadline;
    if (newProjectServices) newProject.services = newProjectServices;
    if (newProjectPost) newProject.post = parseInt(newProjectPost);
    if (newProjectReel) newProject.reel = parseInt(newProjectReel);
    if (newProjectFestivalPost) newProject.festivalPost = newProjectFestivalPost;
    if (newProjectAmountReceived) newProject.amountReceived = newProjectAmountReceived;
    if (newProjectNextPaymentDate) newProject.nextPaymentDate = newProjectNextPaymentDate;
    if (newProjectReach) newProject.reach = newProjectReach;
    if (newProjectLeads) newProject.leads = newProjectLeads;
    if (newProjectCpl) newProject.cpl = newProjectCpl;
    
    setClients(clients.map(c => 
      c.id === selectedClientId ? { ...c, activeProjects: c.activeProjects + 1 } : c
    ));
    
    setProjects([newProject, ...projects]);
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
    toast.success("Project created successfully!");
  };

  const openEditModal = (project: Project) => {
    setEditingProject({ ...project });
    setActiveProjectTab('general');
    setIsEditProjectModalOpen(true);
  };

  const handleUpdateProject = () => {
    setShowEditProjectErrors(true);
    if (!editingProject || !editingProject.name.trim() || !editingProject.category || !editingProject.startDate || !editingProject.endDate) {
      toast.error("Please fill in all required fields");
      setTimeout(() => setShowEditProjectErrors(false), 3000);
      return;
    }
    setProjects(projects.map(p => p.id === editingProject.id ? editingProject : p));
    setShowEditProjectErrors(false);
    setIsEditProjectModalOpen(false);
    setEditingProject(null);
    setActiveProjectTab('general');
    toast.success("Project updated successfully!");
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
      action: () => {
        moveToRecycleBin('Project', project.name, project, 'hrms_projects');
        setProjects(prev => prev.filter(p => p.id !== project.id));
        setClients(prev => prev.map(c => 
          c.id === project.clientId ? { ...c, activeProjects: Math.max(0, c.activeProjects - 1) } : c
        ));
        if (selectedProjectId === project.id) {
          setSelectedProjectId(null);
        }
        toast.success(`Project "${project.name}" deleted.`);
      }
    });
  };

  const confirmDeleteClient = (client: Client) => {
    setConfirmModalState({
      isOpen: true,
      title: "Delete Client",
      description: "Are you sure you want to delete this client? All associated projects will also be permanently deleted.",
      itemName: client.name,
      action: () => {
        moveToRecycleBin('Client', client.name, client, 'hrms_clients');
        setClients(prev => prev.filter(c => c.id !== client.id));
        setProjects(prev => prev.filter(p => p.clientId !== client.id));
        if (selectedClientId === client.id) {
          setSelectedClientId(null);
          setSelectedProjectId(null);
        }
        toast.success(`Client "${client.name}" deleted.`);
      }
    });
  };


  const archiveClient = (client: Client) => {
    setClients(prev => prev.map(c => c.id === client.id ? { ...c, status: 'Archived' as ClientStatus } : c));
    if (selectedClientId === client.id) setSelectedClientId(null);
    toast.success(`Client "${client.name}" archived successfully.`);
  };

  const unarchiveClient = (client: Client) => {
    setClients(prev => prev.map(c => c.id === client.id ? { ...c, status: 'Active' as ClientStatus } : c));
    toast.success(`Client "${client.name}" restored to Active.`);
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

  if (selectedClientId) {
    const client = clients.find(c => c.id === selectedClientId);
    if (!client) return null;

    if (selectedProjectId) {
      const project = projects.find(p => p.id === selectedProjectId);
      if (!project) return null;

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
            
            <button 
              onClick={() => openEditModal(project)}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground font-bold text-sm rounded-xl hover:bg-primary/90 transition-all shadow-sm"
            >
              <Edit2 className="w-4 h-4" />
              <span className="hidden sm:inline">Edit Project</span>
            </button>
          </div>

          {/* Top Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-card border border-border/60 rounded-3xl p-6 shadow-sm">
               <div className="flex justify-between items-end mb-2">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Progress</span>
                  <span className="text-3xl font-black text-foreground font-mono">{project.progress}%</span>
               </div>
               <div className="h-2 w-full bg-muted/60 rounded-full overflow-hidden mt-4">
                 <div 
                   className={cn("h-full rounded-full transition-all duration-1000 ease-out", getProgressColor(project.status))}
                   style={{ width: `${project.progress}%` }}
                 ></div>
               </div>
            </div>
            
            <div className="bg-card border border-border/60 rounded-3xl p-6 flex items-center gap-5 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                <IndianRupee className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Budget</p>
                <h3 className="text-3xl font-black text-foreground font-mono">{project.budget}</h3>
              </div>
            </div>
            
            <div className="bg-card border border-border/60 rounded-3xl p-6 flex items-center gap-5 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Timeline</p>
                <h3 className="text-sm font-black text-foreground">{safeFormat(project.startDate, "dd/MM/yyyy")} - {safeFormat(project.endDate, "dd/MM/yyyy")}</h3>
              </div>
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
                {(!project.activityLogs || project.activityLogs.length === 0) ? (
                  <div className="text-center py-16 text-sm text-muted-foreground/60 font-semibold italic">
                    No activity logs recorded yet.
                  </div>
                ) : (
                  [...project.activityLogs].reverse().map((log: any) => (
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
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {project.category === "Social Media Management" ? (() => {
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
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold tracking-tight">Content Calendar</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">Plan, schedule, and track content approval pipeline</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select 
                        value={calendarTypeFilter} 
                        onChange={(e) => setCalendarTypeFilter(e.target.value)} 
                        className="px-3 py-1.5 bg-card border border-border/60 rounded-xl text-xs font-bold text-foreground focus:outline-none"
                      >
                        <option value="All">All Types</option>
                        <option value="Post">Post</option>
                        <option value="Reel">Reel</option>
                        <option value="Story">Story</option>
                        <option value="Carousel">Carousel</option>
                      </select>
                      <select 
                        value={calendarStatusFilter} 
                        onChange={(e) => setCalendarStatusFilter(e.target.value)} 
                        className="px-3 py-1.5 bg-card border border-border/60 rounded-xl text-xs font-bold text-foreground focus:outline-none"
                      >
                        <option value="All">All Statuses</option>
                        <option value="To Do">To Do</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Pending Approval">Pending Approval</option>
                        <option value="Approved">Approved</option>
                        <option value="Published">Published</option>
                      </select>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsCalendarSettingsOpen(true);
                        }}
                        className="px-3 py-1.5 bg-card hover:bg-muted border border-border/60 rounded-xl text-xs font-bold text-muted-foreground flex items-center gap-1.5 transition-colors"
                      >
                        <Settings2 className="w-3.5 h-3.5" />
                        Settings
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
                        className="flex items-center gap-1.5 px-3.5 py-2 border border-border/40 text-muted-foreground hover:text-foreground font-bold text-xs rounded-xl hover:bg-muted/50 transition-all shadow-sm"
                      >
                        <Layers className="w-3.5 h-3.5" /> Bulk Add Slots
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingCalendarItem(null);
                          setCalendarForm({ ...defaultCalendarForm });
                          setIsAddCalendarItemModalOpen(true);
                        }}
                        className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-xl hover:bg-primary/90 transition-all shadow-sm"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Idea
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

                              const saveInlineEdit = (field: string, value: string) => {
                                const updated = projectCalendar.map((x: any) =>
                                  x.id === item.id ? { ...x, [field]: value, ...(field === 'postingDate' ? { postingDay: new Date(value).toLocaleDateString("en-US", { weekday: "long" }) } : {}) } : x
                                );
                                setProjects(projects.map(p => p.id === project.id ? { ...p, contentCalendar: updated, modules: syncSocialMediaTasksForProject(p, updated) } : p));
                                setInlineEdit(null);
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
                                  <input
                                    autoFocus
                                    type="date"
                                    value={inlineEdit!.value}
                                    onChange={e => setInlineEdit({ ...inlineEdit!, value: e.target.value })}
                                    onBlur={() => saveInlineEdit(field, inlineEdit!.value)}
                                    onKeyDown={e => { if (e.key === 'Escape') setInlineEdit(null); }}
                                    onClick={e => e.stopPropagation()}
                                    className="px-2 py-1 bg-primary/5 border border-primary/40 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                                  />
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
                                <tr key={item.id} onClick={() => setExpandedRowId(isExpanded ? null : item.id)} className={cn("hover:bg-muted/20 transition-all group cursor-pointer", isExpanded ? "bg-muted/10 align-top" : "h-[80px]")}>

                                  {/* Schedule */}
                                  <td className="py-2 px-5 text-center whitespace-nowrap">
                                    <div className="flex flex-col items-center gap-0.5">
                                      {isEd('postingDate') ? (
                                        <input autoFocus type="date" value={inlineEdit!.value} onChange={e => setInlineEdit({ ...inlineEdit!, value: e.target.value })} onBlur={() => saveInlineEdit('postingDate', inlineEdit!.value)} onKeyDown={e => { if (e.key === 'Escape') setInlineEdit(null); }} onClick={e => e.stopPropagation()} className="px-2 py-1 bg-primary/5 border border-primary/40 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-primary" />
                                      ) : (
                                        <span onClick={e => startEdit(e, 'postingDate', item.postingDate)} className="font-extrabold text-foreground block text-sm cursor-text hover:bg-primary/5 rounded px-1 py-0.5 transition-colors group/pd" title="Click to edit">
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
                                      <span onClick={e => startEdit(e, 'type', item.type)} className={cn("mx-auto px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest border rounded-full block text-center max-w-[90px] cursor-pointer hover:opacity-80", getCalTypeColor(item.type))} title="Click to change">{item.type}</span>
                                    )}
                                  </td>

                                  {/* Topic / Concept */}
                                  <td className={cn("py-2 px-5 text-center min-w-[200px]", isExpanded ? "max-w-none" : "max-w-[240px]")}>
                                    <InlineText field="topic" value={item.topic} placeholder="Enter topic..." cls={cn("font-bold text-foreground leading-normal", isExpanded ? "" : "line-clamp-1")} />
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
                                    <InlineText field="_assignedTo" value={(item.assignedTo || []).join(", ")} placeholder="Unassigned" cls="text-foreground font-bold text-[13px]" />
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
                                    <InlineText field="approval" value={item.approval} placeholder="+ feedback" cls="text-[11px] text-foreground font-semibold mb-1" />
                                    {isEd('status') ? (
                                      <select autoFocus value={inlineEdit!.value} onChange={e => saveInlineEdit('status', e.target.value)} onBlur={() => saveInlineEdit('status', inlineEdit!.value)} onKeyDown={e => { if (e.key === 'Escape') setInlineEdit(null); }} onClick={e => e.stopPropagation()} className="px-2 py-1 bg-primary/5 border border-primary/40 rounded-lg text-xs font-bold focus:outline-none mx-auto block">
                                        {["To Do", "In Progress", "Pending Approval", "Approved", "Published"].map(o => <option key={o} value={o}>{o}</option>)}
                                      </select>
                                    ) : (
                                      <span onClick={e => startEdit(e, 'status', item.status)} className={cn("mx-auto px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider block text-center max-w-[110px] cursor-pointer hover:opacity-80", getCalStatusColor(item.status))} title="Click to change status">{item.status}</span>
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
                                            action: () => {
                                              const updated = projectCalendar.filter((x: any) => x.id !== item.id);
                                              setProjects(projects.map(p => p.id === project.id ? { ...p, contentCalendar: updated, modules: syncSocialMediaTasksForProject(p, updated) } : p));
                                              toast.success("Content idea deleted successfully");
                                              setConfirmModalState(prev => ({ ...prev, isOpen: false }));
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
                </div>
              );
            })() : project.category === "Digital Marketing" ? (() => {
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
              
              let reachTrend = "+14.2%", leadsTrend = "+8.1%", cplTrend = "-5.4%", amountSpentTrend = "+12.2%";

              if (totalReach === 0) {
                reach = project.reach || "1.2M";
                leads = project.leads || "3,240";
                cpl = project.cpl || "250";
                amountSpent = "8,10,000";

                if (selectedCampaignForStats === "Q4 Retargeting Ads") {
                  reach = "450K"; leads = "1,400"; cpl = "180"; amountSpent = "2,52,000";
                  reachTrend = "+5.1%"; leadsTrend = "+12.0%"; cplTrend = "-2.5%"; amountSpentTrend = "+8.4%";
                } else if (selectedCampaignForStats === "Holiday Social Push") {
                  reach = "850K"; leads = "1,600"; cpl = "320"; amountSpent = "5,12,000";
                  reachTrend = "+22.4%"; leadsTrend = "+4.2%"; cplTrend = "+1.1%"; amountSpentTrend = "+2.1%";
                } else if (selectedCampaignForStats === "B2B Email Drip") {
                  reach = "120K"; leads = "240"; cpl = "450"; amountSpent = "1,08,000";
                  reachTrend = "+2.0%"; leadsTrend = "+1.1%"; cplTrend = "-8.5%"; amountSpentTrend = "+1.0%";
                }

                let days = 30;
                if (customDateRange?.from && customDateRange?.to) {
                  days = differenceInDays(customDateRange.to, customDateRange.from) || 1;
                }

                if (days !== 30) {
                  const ratio = days / 30;
                  reach = (parseFloat(reach) * ratio).toFixed(1) + (reach.includes("M") ? "M" : "K");
                  leads = Math.floor(parseInt(leads.replace(/,/g, "")) * ratio).toLocaleString("en-IN");
                  amountSpent = Math.floor(parseInt(amountSpent.replace(/,/g, "")) * ratio).toLocaleString("en-IN");
                }
              }

              return (
                <div className="lg:col-span-3 space-y-6">
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Top Performing Campaigns */}
                    <div className="bg-card border border-border/60 rounded-3xl p-6 shadow-sm">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-sm font-bold text-foreground">Top Performing Campaigns</h3>
                      </div>
                      <div className="space-y-4">
                        {[
                          { name: "Q4 Retargeting Ads", budget: "₹45,000", leads: 450, status: "Active", progress: 75 },
                          { name: "Holiday Social Push", budget: "₹20,000", leads: 180, status: "Active", progress: 40 },
                          { name: "B2B Email Drip", budget: "₹15,000", leads: 85, status: "Completed", progress: 100 }
                        ].map((camp, i) => (
                          <div key={i} className="flex items-center gap-4">
                            <div className="flex-1">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-sm font-bold text-foreground">{camp.name}</span>
                                <span className="text-xs font-bold text-muted-foreground font-mono">{camp.leads} leads</span>
                              </div>
                              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                <div className={cn("h-full rounded-full transition-all duration-1000", camp.progress === 100 ? "bg-emerald-500" : "bg-primary")} style={{ width: `${camp.progress}%` }}></div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Daily Data Entry Tasks */}
                    <div className="bg-card border border-border/60 rounded-3xl p-6 shadow-sm">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-sm font-bold text-foreground">Daily Data Entry Tasks</h3>
                      </div>
                      <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                        {(() => {
                          const dailyModule = (project.modules || []).find((m: any) => m.id === "daily-data-entry");
                          const dailyTasks = dailyModule ? dailyModule.tasks || [] : [];
                          if (dailyTasks.length === 0) {
                            return (
                              <div className="text-center py-8 text-xs font-semibold text-muted-foreground/40 border border-dashed border-border/20 rounded-2xl bg-muted/5">
                                No daily tasks yet.
                              </div>
                            );
                          }
                          return dailyTasks.map((t: any) => {
                            const isCompleted = t.status === "completed";
                            return (
                              <div key={t.id} className="flex items-center justify-between p-3 rounded-2xl border border-border/40 hover:bg-muted/30 transition-colors">
                                <div className="flex items-center gap-3">
                                  <button
                                    onClick={() => {
                                      const nextStatus = isCompleted ? "todo" : "completed";
                                      const updatedModules = (project.modules || []).map((m: any) => {
                                        if (m.id === "daily-data-entry") {
                                          return {
                                            ...m,
                                            tasks: m.tasks.map((task: any) => task.id === t.id ? { ...task, status: nextStatus } : task)
                                          };
                                        }
                                        return m;
                                      });
                                      const newProjects = projects.map(p => p.id === project.id ? { ...p, modules: updatedModules } : p);
                                      setProjects(newProjects);
                                      localStorage.setItem("hrms_projects", JSON.stringify(newProjects));
                                      window.dispatchEvent(new Event("storage"));
                                      toast.success(isCompleted ? "Task marked incomplete" : "Task completed!");
                                    }}
                                    className={cn(
                                      "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors shrink-0",
                                      isCompleted ? "border-emerald-500 bg-emerald-500/10 text-emerald-500" : "border-muted-foreground hover:border-primary text-transparent"
                                    )}
                                  >
                                    {isCompleted && <CheckCircle2 className="w-3.5 h-3.5" />}
                                  </button>
                                  <div className="flex flex-col">
                                    <span className={cn("text-xs font-bold", isCompleted ? "text-muted-foreground line-through decoration-muted-foreground/50" : "text-foreground")}>
                                      {t.title}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground mt-0.5">
                                      Due: {t.dueDate} • Assigned: {t.assignedToName || "Emma"}
                                    </span>
                                  </div>
                                </div>
                                <span className={cn(
                                  "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border",
                                  isCompleted ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                )}>
                                  {isCompleted ? "Done" : "Pending"}
                                </span>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
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
                          <tr className="border-b border-border/40 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                            <th className="pb-3 pl-4">Date</th>
                            <th className="pb-3">Campaign</th>
                            <th className="pb-3 text-right">Reach</th>
                            <th className="pb-3 text-right">Leads</th>
                            <th className="pb-3 text-right">Spend</th>
                            <th className="pb-3 text-right">CPL</th>
                            <th className="pb-3 text-right pr-4">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20 text-xs font-semibold text-foreground">
                          {(() => {
                            const dailyStats = dateFiltered || [];
                            if (dailyStats.length === 0) {
                              return (
                                <tr>
                                  <td colSpan={7} className="py-8 text-center text-xs font-semibold text-muted-foreground/40">
                                    No stats logged yet matching the filters.
                                  </td>
                                </tr>
                              );
                            }
                            return dailyStats.slice(0, 10).map((stat: any) => {
                              const cpl = stat.leads > 0 ? Math.round(stat.spend / stat.leads) : 0;
                              return (
                                <tr key={stat.id} className="hover:bg-muted/10 transition-colors">
                                  <td className="py-3.5 pl-4 font-mono">{safeFormat(stat.date, "dd/MM/yyyy")}</td>
                                  <td className="py-3.5 font-bold">{stat.campaignName}</td>
                                  <td className="py-3.5 text-right font-mono">{Number(stat.reach || 0).toLocaleString()}</td>
                                  <td className="py-3.5 text-right font-mono">{Number(stat.leads || 0).toLocaleString()}</td>
                                  <td className="py-3.5 text-right font-mono">₹{Number(stat.spend || 0).toLocaleString()}</td>
                                  <td className="py-3.5 text-right font-mono text-primary">₹{cpl}</td>
                                  <td className="py-3.5 text-right pr-4">
                                    <button
                                      onClick={() => {
                                        setConfirmModalState({
                                          isOpen: true,
                                          title: "Delete Daily Stats Log",
                                          description: `Are you sure you want to delete this daily stat log for "${stat.campaignName}" on ${stat.date}? This action cannot be undone.`,
                                          itemName: `${stat.campaignName} (${stat.date})`,
                                          action: () => {
                                            const updatedStats = (project.dailyStats || []).filter((s: any) => s.id !== stat.id);
                                            const newProjects = projects.map(p => p.id === project.id ? { ...p, dailyStats: updatedStats } : p);
                                            setProjects(newProjects);
                                            localStorage.setItem("hrms_projects", JSON.stringify(newProjects));
                                            window.dispatchEvent(new Event("storage"));
                                            toast.success("Daily stats log deleted successfully!");
                                            setConfirmModalState(prev => ({ ...prev, isOpen: false }));
                                          }
                                        });
                                      }}
                                      className="p-1 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition-colors border border-border/30 shadow-sm bg-card inline-flex items-center justify-center"
                                      title="Delete stats log"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })() : (
              <>
                {/* Left Col: Tasks / Kanban */}
                <div className="lg:col-span-2 space-y-6">
                  {project.category === "App Dev" || project.category === "Web Dev" ? (() => {
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
                      setProjects(projects.map(p => p.id === project.id ? { ...p, modules: updatedModules } : p));
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
                      setProjects(projects.map(p => p.id === project.id ? { ...p, modules: updatedModules } : p));
                      setNewModuleTaskTitle("");
                      setInlineEdit(null); // Close task input
                      toast.success("Task added successfully!");
                    };

                    const handleDeleteTask = (taskId: string) => {
                      if (!activeModule) return;
                      const updatedTasks = activeModule.tasks.filter(t => t.id !== taskId);
                      const updatedModules: NonNullable<Project['modules']> = projectModules.map(m => m.id === activeModule.id ? { ...m, tasks: updatedTasks } : m);
                      setProjects(projects.map(p => p.id === project.id ? { ...p, modules: updatedModules } : p));
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
                      setProjects(projects.map(p => p.id === project.id ? { ...p, modules: updatedModules } : p));
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
                                                 setProjects(projects.map(p => p.id === project.id ? { ...p, modules: updatedModules } : p));
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
                  })() : (
                    <>
                      {/* Standard Tasks View */}
                      <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold tracking-tight">Milestones &amp; Tasks</h2>
                        <button 
                          onClick={() => setIsKanbanView(!isKanbanView)}
                          className="text-sm font-bold text-primary hover:underline"
                        >
                          {isKanbanView ? "View List" : "View Kanban"}
                        </button>
                      </div>
                      
                      {isKanbanView ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                           <div className="space-y-3 bg-muted/20 p-4 rounded-3xl border border-border/40">
                              <h4 className="font-bold text-xs text-muted-foreground uppercase tracking-widest mb-4 flex items-center justify-between">
                                To Do <span className="bg-background px-2 py-0.5 rounded-md">2</span>
                              </h4>
                              {["Development Sprint 1", "QA & Testing"].map((task, i) => (
                                <div key={i} className="bg-card border border-border/60 p-4 rounded-2xl shadow-sm hover:border-primary/30 hover:shadow-md transition-all cursor-pointer">
                                   <p className="font-bold text-sm text-foreground">{task}</p>
                                   <p className="text-xs font-medium text-muted-foreground mt-3 flex items-center gap-1.5"><Calendar className="w-3 h-3" /> Due in {i + 2} weeks</p>
                                </div>
                              ))}
                              <button className="w-full py-2 border-2 border-dashed border-border/60 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted/50 transition-colors flex items-center justify-center gap-1">
                                <Plus className="w-3 h-3" /> Add Task
                              </button>
                           </div>
                           
                           <div className="space-y-3 bg-muted/20 p-4 rounded-3xl border border-border/40">
                              <h4 className="font-bold text-xs text-primary uppercase tracking-widest mb-4 flex items-center justify-between">
                                In Progress <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-md">0</span>
                              </h4>
                              <div className="p-4 rounded-2xl border-2 border-border/40 border-dashed text-center py-8">
                                <p className="text-xs font-bold text-muted-foreground">No tasks</p>
                              </div>
                           </div>
                           
                           <div className="space-y-3 bg-muted/20 p-4 rounded-3xl border border-border/40">
                              <h4 className="font-bold text-xs text-emerald-500 uppercase tracking-widest mb-4 flex items-center justify-between">
                                Done <span className="bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-md">2</span>
                              </h4>
                              {["Requirement Analysis", "Design Phase"].map((task, i) => (
                                <div key={i} className="bg-muted/40 border border-border/40 p-4 rounded-2xl">
                                   <p className="font-bold text-sm text-muted-foreground line-through decoration-muted-foreground/50">{task}</p>
                                   <p className="text-xs font-medium text-muted-foreground/70 mt-3 flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3" /> Completed</p>
                                </div>
                              ))}
                           </div>
                        </div>
                      ) : (
                        <div className="bg-card border border-border/60 rounded-3xl p-6 shadow-sm space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                          {/* Mock Tasks */}
                          {["Requirement Analysis", "Design Phase", "Development Sprint 1", "QA & Testing"].map((task, i) => (
                            <div key={i} className="flex items-center gap-4 p-4 rounded-2xl border border-border/40 hover:bg-muted/30 transition-colors">
                               <div className={cn("w-6 h-6 rounded-full border-2 flex items-center justify-center", i < 2 ? "border-primary bg-primary/10 text-primary" : "border-muted-foreground text-transparent")}>
                                  {i < 2 && <CheckCircle2 className="w-4 h-4" />}
                               </div>
                               <div>
                                 <p className={cn("font-bold", i < 2 ? "line-through text-muted-foreground" : "text-foreground")}>{task}</p>
                                 <p className="text-xs font-medium text-muted-foreground mt-0.5">Due {format(new Date(Date.now() + i * 7 * 24 * 60 * 60 * 1000), "dd/MM/yyyy")}</p>
                               </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
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
                  onClick={() => {
                    localStorage.setItem('hrms_calendar_offsets', JSON.stringify(calendarOffsets));
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
                            <input type="date" value={calendarForm.postingDate || ""} onChange={(e) => {
                              const newDate = e.target.value;
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
                            }} className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none" />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Format Type</label>
                            <select value={calendarForm.type || "Post"} onChange={(e) => setCalendarForm({ ...calendarForm, type: e.target.value })} className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none font-medium">
                              {["Post", "Reel", "Story", "Carousel"].map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
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
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Assign Team / Brand Person</label>
                          <div className="grid grid-cols-2 gap-2 mt-1">
                            {(currentSelectedProject?.team || []).map((m: any) => {
                              const isAssigned = (calendarForm.assignedTo || []).includes(m.name);
                              return (
                                <button key={m.name} type="button" onClick={() => { const list = calendarForm.assignedTo || []; setCalendarForm({ ...calendarForm, assignedTo: isAssigned ? list.filter((n: string) => n !== m.name) : [...list, m.name] }); }} className={cn("flex items-center gap-2 p-2 rounded-xl text-left border text-xs font-semibold transition-all", isAssigned ? "border-primary/40 bg-primary/10 text-primary" : "border-border/50 bg-muted/30 text-muted-foreground hover:bg-muted")}>
                                  <img src={m.avatar} className="w-5 h-5 rounded-full object-cover" />
                                  <span className="truncate">{m.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    )}
                    {activeCalendarTab === 'production' && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Script Date</label>
                            <input type="date" value={calendarForm.scriptDate || ""} onChange={(e) => setCalendarForm({ ...calendarForm, scriptDate: e.target.value })} className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none" />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Script Link</label>
                            <input type="text" value={calendarForm.scriptLink || ""} onChange={(e) => setCalendarForm({ ...calendarForm, scriptLink: e.target.value })} placeholder="Docs script Link" className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Shoot Date</label>
                            <input type="date" value={calendarForm.shootDate || ""} onChange={(e) => setCalendarForm({ ...calendarForm, shootDate: e.target.value })} className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none" />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Shoot Assets Link</label>
                            <input type="text" value={calendarForm.shootLink || ""} onChange={(e) => setCalendarForm({ ...calendarForm, shootLink: e.target.value })} placeholder="Drive assets folder URL" className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Editing Start Date</label>
                            <input type="date" value={calendarForm.editingStart || ""} onChange={(e) => setCalendarForm({ ...calendarForm, editingStart: e.target.value })} className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none" />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Final Reel Link</label>
                            <input type="text" value={calendarForm.finalReelLink || ""} onChange={(e) => setCalendarForm({ ...calendarForm, finalReelLink: e.target.value })} placeholder="Reel draft link" className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Thumbnail Date</label>
                            <input type="date" value={calendarForm.thumbnailDate || ""} onChange={(e) => setCalendarForm({ ...calendarForm, thumbnailDate: e.target.value })} className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none" />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Thumbnail Link</label>
                            <input type="text" value={calendarForm.thumbnailLink || ""} onChange={(e) => setCalendarForm({ ...calendarForm, thumbnailLink: e.target.value })} placeholder="Design link URL" className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none" />
                          </div>
                        </div>
                      </>
                    )}
                    {activeCalendarTab === 'publishing' && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Approval Feedback (Het)</label>
                            <input type="text" value={calendarForm.approval || ""} onChange={(e) => setCalendarForm({ ...calendarForm, approval: e.target.value })} placeholder="e.g. Approved / Changes requested" className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none" />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Workflow Status</label>
                            <select value={calendarForm.status || "To Do"} onChange={(e) => setCalendarForm({ ...calendarForm, status: e.target.value })} className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none font-medium">
                              {["To Do", "In Progress", "Pending Approval", "Approved", "Published"].map(st => <option key={st} value={st}>{st}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Caption Date</label>
                            <input type="date" value={calendarForm.captionDate || ""} onChange={(e) => setCalendarForm({ ...calendarForm, captionDate: e.target.value })} className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none" />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Final Post Link</label>
                            <input type="text" value={calendarForm.finalPostLink || ""} onChange={(e) => setCalendarForm({ ...calendarForm, finalPostLink: e.target.value })} placeholder="Standard post image draft link" className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none" />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Caption Text</label>
                          <textarea value={calendarForm.caption || ""} onChange={(e) => setCalendarForm({ ...calendarForm, caption: e.target.value })} placeholder="Write finalized copy and hashtags here..." rows={3} className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none resize-none font-medium" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Actual Posting Date</label>
                            <input type="date" value={calendarForm.actualPostingDate || ""} onChange={(e) => setCalendarForm({ ...calendarForm, actualPostingDate: e.target.value })} className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none" />
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
                    onClick={() => {
                      if (!calendarForm.postingDate || !calendarForm.topic || !calendarForm.topic.trim()) { toast.error("Posting Date and Topic Hook are required"); return; }
                      if (!currentSelectedProject) return;
                      const targetProjCalendar = currentSelectedProject.contentCalendar || [];
                      let updated: CalendarItem[] = [];
                      const completeItem: CalendarItem = {
                        id: editingCalendarItem?.id || `cal-${Date.now()}`,
                        postingDate: calendarForm.postingDate,
                        postingDay: calendarForm.postingDay || new Date(calendarForm.postingDate).toLocaleDateString("en-US", { weekday: "long" }),
                        type: calendarForm.type || "Post",
                        topic: calendarForm.topic || "",
                        concept: calendarForm.concept || undefined,
                        reference: calendarForm.reference || undefined,
                        assignedTo: calendarForm.assignedTo || undefined,
                        scriptDate: calendarForm.scriptDate || undefined,
                        scriptLink: calendarForm.scriptLink || undefined,
                        shootDate: calendarForm.shootDate || undefined,
                        shootLink: calendarForm.shootLink || undefined,
                        editingStart: calendarForm.editingStart || undefined,
                        finalReelLink: calendarForm.finalReelLink || undefined,
                        finalPostLink: calendarForm.finalPostLink || undefined,
                        approval: calendarForm.approval || undefined,
                        status: calendarForm.status || "To Do",
                        thumbnailDate: calendarForm.thumbnailDate || undefined,
                        thumbnailLink: calendarForm.thumbnailLink || undefined,
                        captionDate: calendarForm.captionDate || undefined,
                        caption: calendarForm.caption || undefined,
                        postingLinkOfIg: calendarForm.postingLinkOfIg || undefined,
                        actualPostingDate: calendarForm.actualPostingDate || undefined,
                        remark: calendarForm.remark || undefined,
                        issues: calendarForm.issues || undefined,
                      };
                      if (editingCalendarItem) {
                        updated = targetProjCalendar.map((item: any) => item.id === editingCalendarItem.id ? completeItem : item);
                        toast.success("Content Idea updated successfully!");
                      } else {
                        updated = [...targetProjCalendar, completeItem];
                        toast.success("Content Idea added to calendar!");
                      }
                      setProjects(projects.map(p => p.id === currentSelectedProject.id ? { ...p, contentCalendar: updated, modules: syncSocialMediaTasksForProject(p, updated) } : p));
                      setIsAddCalendarItemModalOpen(false);
                      setEditingCalendarItem(null);
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
          
          const handleGenerateBulkSlots = () => {
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

            const generated: CalendarItem[] = [];
            const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
              const dayIndex = d.getDay();
              if (bulkSelectedDays.includes(dayIndex)) {
                const dateStr = d.toISOString().split('T')[0] || "";
                generated.push({
                  id: `cal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  postingDate: dateStr,
                  postingDay: dayNames[dayIndex],
                  type: bulkFormatType,
                  topic: "",
                  status: "To Do",
                  ...getPresetDates(dateStr)
                });
              }
            }

            if (generated.length === 0) {
              toast.error("No slots generated matching the chosen days and date range.");
              return;
            }

            const existingCalendar = currentSelectedProject.contentCalendar || [];
            const updated = [...existingCalendar, ...generated].sort((a, b) => new Date(a.postingDate).getTime() - new Date(b.postingDate).getTime());
            
            setProjects(projects.map(p => p.id === currentSelectedProject.id ? { ...p, contentCalendar: updated, modules: syncSocialMediaTasksForProject(p, updated) } : p));
            setIsBulkAddModalOpen(false);
            toast.success(`Generated ${generated.length} calendar slots successfully!`);
          };

          const handleSyncVisualDates = () => {
            if (!currentSelectedProject) return;
            const existingCalendar = currentSelectedProject.contentCalendar || [];
            
            const selectedStrings = (visualSelectedDates || []).map(date => {
              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, '0');
              const day = String(date.getDate()).padStart(2, '0');
              return `${year}-${month}-${day}`;
            });

            // Add newly selected dates (always add new slots for each selected date)
            const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
            const newlyAdded: CalendarItem[] = [];

            selectedStrings.forEach(dateStr => {
              const d = new Date(dateStr);
              newlyAdded.push({
                id: `cal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                postingDate: dateStr,
                postingDay: dayNames[d.getDay()],
                type: bulkFormatType,
                topic: "",
                status: "To Do",
                ...getPresetDates(dateStr)
              });
            });

            const updated = [...existingCalendar, ...newlyAdded].sort((a, b) => new Date(a.postingDate || 0).getTime() - new Date(b.postingDate || 0).getTime());
            setProjects(projects.map(p => p.id === currentSelectedProject.id ? { ...p, contentCalendar: updated, modules: syncSocialMediaTasksForProject(p, updated) } : p));
            setIsBulkAddModalOpen(false);

            toast.success(`Successfully added ${newlyAdded.length} new content slots!`);
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
                    onClick={() => setBulkAddTab('visual')}
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
                <div className="p-8 space-y-6 overflow-y-auto max-h-[60vh] flex flex-col items-center">
                  {bulkAddTab === 'range' ? (
                    <div className="w-full space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Start Date</label>
                          <input 
                            type="date" 
                            value={bulkStartDate} 
                            onChange={(e) => setBulkStartDate(e.target.value)} 
                            className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary font-bold text-center" 
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">End Date</label>
                          <input 
                            type="date" 
                            value={bulkEndDate} 
                            onChange={(e) => setBulkEndDate(e.target.value)} 
                            className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary font-bold text-center" 
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
                      <p className="text-[11px] text-muted-foreground text-center font-medium max-w-[400px]">
                        Click on dates in the calendar below to toggle slots. Syncing will add slots for newly selected dates and delete slots for unselected dates.
                      </p>
                      <div className="border border-border/50 rounded-2xl p-4 bg-muted/10 shadow-inner flex justify-center">
                        <CalendarUI
                          mode="multiple"
                          selected={visualSelectedDates}
                          onSelect={setVisualSelectedDates}
                          className="rounded-md border-0 bg-transparent font-medium"
                          {...({ required: false } as any)}
                        />
                      </div>
                    </div>
                  )}

                  <div className="w-full">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Default Format Type</label>
                    <select 
                      value={bulkFormatType} 
                      onChange={(e) => setBulkFormatType(e.target.value)}
                      className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none font-bold"
                    >
                      {["Post", "Reel", "Story", "Carousel"].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
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
                    {bulkAddTab === 'range' ? "Generate Slots" : "Add Selected Dates"}
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
            setProjects(projects.map(p => p.id === currentSelectedProject.id ? { ...p, modules: updatedModules } : p));
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
                        <select 
                          value={addModuleForm.assignedToName} 
                          onChange={(e) => setAddModuleForm({ ...addModuleForm, assignedToName: e.target.value })}
                          className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none font-bold"
                        >
                          <option value="">Unassigned</option>
                          {currentSelectedProject.team.map(m => (
                            <option key={m.name} value={m.name}>{m.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Stage Status</label>
                        <select 
                          value={addModuleForm.status} 
                          onChange={(e) => setAddModuleForm({ ...addModuleForm, status: e.target.value as any })}
                          className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none font-bold"
                        >
                          {["todo", "in-progress", "bugs", "onhold", "pending", "completed"].map(st => (
                            <option key={st} value={st}>{st === "todo" ? "To Do" : st === "in-progress" ? "In Progress" : st.charAt(0).toUpperCase() + st.slice(1)}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Priority</label>
                        <select 
                          value={addModuleForm.priority} 
                          onChange={(e) => setAddModuleForm({ ...addModuleForm, priority: e.target.value as any })}
                          className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none font-bold"
                        >
                          {["low", "medium", "high", "urgent"].map(pr => (
                            <option key={pr} value={pr}>{pr.charAt(0).toUpperCase() + pr.slice(1)}</option>
                          ))}
                        </select>
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
                      <input 
                        type="date" 
                        value={addModuleForm.dueDate} 
                        onChange={(e) => setAddModuleForm({ ...addModuleForm, dueDate: e.target.value })} 
                        className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary font-bold text-center" 
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

            setProjects(projects.map(p => p.id === currentSelectedProject.id ? { ...p, modules: updatedModules } : p));
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
                        <select 
                          value={editModuleForm.assignedToName} 
                          onChange={(e) => setEditModuleForm({ ...editModuleForm, assignedToName: e.target.value })}
                          className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none font-bold"
                        >
                          <option value="">Unassigned</option>
                          {currentSelectedProject.team.map(m => (
                            <option key={m.name} value={m.name}>{m.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Stage Status</label>
                        <select 
                          value={editModuleForm.status} 
                          onChange={(e) => setEditModuleForm({ ...editModuleForm, status: e.target.value as any })}
                          className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none font-bold"
                        >
                          {["todo", "in-progress", "bugs", "onhold", "pending", "completed"].map(st => (
                            <option key={st} value={st}>{st === "todo" ? "To Do" : st === "in-progress" ? "In Progress" : st.charAt(0).toUpperCase() + st.slice(1)}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Priority</label>
                        <select 
                          value={editModuleForm.priority} 
                          onChange={(e) => setEditModuleForm({ ...editModuleForm, priority: e.target.value as any })}
                          className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none font-bold"
                        >
                          {["low", "medium", "high", "urgent"].map(pr => (
                            <option key={pr} value={pr}>{pr.charAt(0).toUpperCase() + pr.slice(1)}</option>
                          ))}
                        </select>
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
                      <input 
                        type="date" 
                        value={editModuleForm.dueDate} 
                        onChange={(e) => setEditModuleForm({ ...editModuleForm, dueDate: e.target.value })} 
                        className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary font-bold text-center" 
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
            setProjects(projects.map(p => p.id === currentSelectedProject.id ? { ...p, modules: updatedModules } : p));
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
            setProjects(projects.map(p => p.id === currentSelectedProject.id ? { ...p, modules: updatedModules } : p));
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
                        <input 
                          type="date" 
                          value={editingModuleTask.dueDate || ""} 
                          onChange={(e) => setEditingModuleTask({ ...editingModuleTask, dueDate: e.target.value })} 
                          className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary font-bold text-center" 
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
            
            const nowLog = {
              id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              action: "Created Task",
              performedBy: "Alex (You)",
              timestamp: `${String(new Date().getDate()).padStart(2, '0')}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${new Date().getFullYear()} ${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`,
              details: `Added new task "${addTaskForm.title.trim()}" inside module "${activeModule.name}"`
            };

            setProjects(projects.map(p => p.id === currentSelectedProject.id ? { 
              ...p, 
              modules: updatedModules,
              activityLogs: [...(p.activityLogs || []), nowLog]
            } : p));
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
                        <input 
                          type="date" 
                          value={addTaskForm.dueDate} 
                          onChange={(e) => setAddTaskForm({ ...addTaskForm, dueDate: e.target.value })} 
                          className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary font-bold text-center" 
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

      <Dialog open={isLogDailyStatsOpen} onOpenChange={setIsLogDailyStatsOpen}>
        <DialogContent className={cn("p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl bg-card z-50 transition-all duration-300", isBulkAdd ? "sm:max-w-[700px]" : "sm:max-w-[450px]")}>
          <div className="p-6 md:p-8 border-b border-border/40">
            <h2 className="text-lg font-black tracking-tight text-foreground flex items-center gap-2">
              📈 Log Daily Marketing Stats
            </h2>
            <p className="text-xs text-muted-foreground mt-1 font-medium">Enter performance metrics for the selected campaign and date.</p>
          </div>

          <form onSubmit={handleLogDailyStats} className="p-6 md:p-8 space-y-5">
            {/* Mode Switcher */}
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

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Date</label>
              <input
                type="date"
                required
                value={dailyStatsForm.date}
                onChange={(e) => setDailyStatsForm({ ...dailyStatsForm, date: e.target.value })}
                className="w-full px-4 h-[42px] bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-semibold text-foreground"
              />
            </div>

            {!isBulkAdd ? (
              <>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Campaign</label>
                  <select
                    value={dailyStatsForm.campaignName}
                    onChange={(e) => setDailyStatsForm({ ...dailyStatsForm, campaignName: e.target.value })}
                    className="w-full px-4 h-[42px] bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-semibold text-foreground"
                  >
                    {(() => {
                      const project = projects.find(p => p.id === selectedProjectId);
                      const campaignList = (project?.campaigns && project.campaigns.length > 0)
                        ? project.campaigns
                            .map(c => typeof c === 'string' ? { name: c, status: 'Active' } : { name: c.name || "", status: c.status || 'Active' })
                            .filter(c => c.status === 'Active')
                            .map(c => c.name)
                        : ["Q4 Retargeting Ads", "Holiday Social Push", "B2B Email Drip"];
                      return campaignList.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ));
                    })()}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Reach</label>
                    <input
                      type="number"
                      required={!isBulkAdd}
                      placeholder="e.g. 15000"
                      value={dailyStatsForm.reach}
                      onChange={(e) => setDailyStatsForm({ ...dailyStatsForm, reach: e.target.value })}
                      className="w-full px-4 h-[42px] bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-semibold"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Leads</label>
                    <input
                      type="number"
                      required={!isBulkAdd}
                      placeholder="e.g. 42"
                      value={dailyStatsForm.leads}
                      onChange={(e) => setDailyStatsForm({ ...dailyStatsForm, leads: e.target.value })}
                      className="w-full px-4 h-[42px] bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-semibold"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Spend (₹)</label>
                  <input
                    type="number"
                    required={!isBulkAdd}
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
                  const entry = bulkStatsEntries[campaignName] || { reach: "", leads: "", spend: "" };
                  return (
                    <div key={campaignName} className="p-4 bg-muted/20 border border-border/40 rounded-2xl space-y-3">
                      <p className="text-xs font-black text-foreground">{campaignName}</p>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[9px] font-bold text-muted-foreground uppercase mb-1 block">Reach</label>
                          <input
                            type="number"
                            placeholder="e.g. 12000"
                            value={entry.reach}
                            onChange={(e) => setBulkStatsEntries({
                              ...bulkStatsEntries,
                              [campaignName]: { ...entry, reach: e.target.value }
                            })}
                            className="w-full px-2.5 h-[34px] bg-background border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary font-semibold"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-muted-foreground uppercase mb-1 block">Leads</label>
                          <input
                            type="number"
                            placeholder="e.g. 35"
                            value={entry.leads}
                            onChange={(e) => setBulkStatsEntries({
                              ...bulkStatsEntries,
                              [campaignName]: { ...entry, leads: e.target.value }
                            })}
                            className="w-full px-2.5 h-[34px] bg-background border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary font-semibold"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-muted-foreground uppercase mb-1 block">Spend (₹)</label>
                          <input
                            type="number"
                            placeholder="e.g. 3000"
                            value={entry.spend}
                            onChange={(e) => setBulkStatsEntries({
                              ...bulkStatsEntries,
                              [campaignName]: { ...entry, spend: e.target.value }
                            })}
                            className="w-full px-2.5 h-[34px] bg-background border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary font-semibold"
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
                          <input 
                            type="date" 
                            value={editingProject.startDate}
                            onChange={(e) => {
                              const newStart = e.target.value;
                              setEditingProject({
                                ...editingProject, 
                                startDate: newStart,
                                endDate: editingProject.endDate < newStart ? newStart : editingProject.endDate
                              });
                            }}
                            className={"w-full px-4 py-3 bg-muted/50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium " + (showEditProjectErrors && !editingProject.startDate ? "border-red-500 ring-1 ring-red-500" : "border-border/50")}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">End Date <span className="text-red-500">*</span></label>
                          <input 
                            type="date" 
                            value={editingProject.endDate}
                            min={editingProject.startDate}
                            onChange={(e) => setEditingProject({...editingProject, endDate: e.target.value})}
                            className={"w-full px-4 py-3 bg-muted/50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium " + (showEditProjectErrors && !editingProject.endDate ? "border-red-500 ring-1 ring-red-500" : "border-border/50")}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">Category <span className="text-red-500">*</span></label>
                            <button 
                              type="button"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsManageCategoriesModalOpen(true); }}
                              className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                            >
                              <Settings2 className="w-3 h-3" /> Manage
                            </button>
                          </div>
                          <SearchableSelect 
                            value={editingProject.category}
                            onChange={(val) => setEditingProject({...editingProject, category: val})}
                            options={categories.map(cat => ({ label: cat, value: cat }))}
                            className={"w-full h-[46px] px-4 bg-muted/50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium " + (showEditProjectErrors && !editingProject.category ? "border-red-500 ring-1 ring-red-500" : "border-border/50")}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Status <span className="text-red-500">*</span></label>
                          <SearchableSelect 
                            value={editingProject.status}
                            onChange={(val) => setEditingProject({...editingProject, status: val as ProjectStatus})}
                            options={[
                              { label: "In Progress", value: "In Progress" },
                              { label: "In Review", value: "In Review" },
                              { label: "Completed", value: "Completed" },
                              { label: "On Hold", value: "On Hold" }
                            ]}
                            className="w-full h-[46px] px-4 bg-muted/50 border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Priority</label>
                          <select 
                            value={editingProject.priority || "Medium"} 
                            onChange={(e) => setEditingProject({...editingProject, priority: e.target.value as any})} 
                            className="w-full h-[46px] px-4 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                          >
                            {["Low", "Medium", "High", "Critical"].map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
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
                        <input type="text" value={editingProject.budget || ""} onChange={(e) => setEditingProject({...editingProject, budget: e.target.value})} placeholder="e.g. ₹10,000" className="w-full px-4 h-[42px] bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider">Amount Received</label>
                        <input type="text" value={editingProject.amountReceived || ""} onChange={(e) => setEditingProject({...editingProject, amountReceived: e.target.value})} placeholder="e.g. ₹5,000" className="w-full px-4 h-[42px] bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider">Next Payment Date</label>
                        <input type="date" value={editingProject.nextPaymentDate || ""} onChange={(e) => setEditingProject({...editingProject, nextPaymentDate: e.target.value})} className="w-full px-4 h-[42px] bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium" />
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
            <div className="w-14 h-14 rounded-2xl border-2 border-border/50 overflow-hidden shadow-sm bg-card">
              <img src={client.logo} alt={client.name} className="w-full h-full object-cover" />
            </div>
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
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Category <span className="text-red-500">*</span></label>
                          <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsManageCategoriesModalOpen(true); }} className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1">
                            <Settings2 className="w-3 h-3" /> Manage
                          </button>
                        </div>
                        <SearchableSelect
                          value={newProjectCategory}
                          onChange={(val) => setNewProjectCategory(val)}
                          options={categories.map(cat => ({ label: cat, value: cat }))}
                          placeholder="Select Category"
                          className={cn("w-full h-[42px] px-4 bg-muted/50 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all", showNewProjectErrors && !newProjectCategory ? "border-red-500 ring-1 ring-red-500" : "border-border")}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Priority</label>
                        <select value={newProjectPriority} onChange={(e) => setNewProjectPriority(e.target.value as "Low" | "Medium" | "High" | "Critical")} className="w-full h-[42px] px-4 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all">
                          {["Low", "Medium", "High", "Critical"].map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Start Date <span className="text-red-500">*</span></label>
                        <input type="date" value={newProjectStartDate} onChange={(e) => { const v = e.target.value; setNewProjectStartDate(v); if (newProjectEndDate < v) setNewProjectEndDate(v); }} className={cn("w-full px-4 h-[42px] bg-muted/50 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all", showNewProjectErrors && !newProjectStartDate ? "border-red-500" : "border-border")} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">End Date <span className="text-red-500">*</span></label>
                        <input type="date" value={newProjectEndDate} min={newProjectStartDate} onChange={(e) => setNewProjectEndDate(e.target.value)} className={cn("w-full px-4 h-[42px] bg-muted/50 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all", showNewProjectErrors && !newProjectEndDate ? "border-red-500" : "border-border")} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Team Deadline (Internal)</label>
                      <input type="date" value={newProjectTeamDeadline} onChange={(e) => setNewProjectTeamDeadline(e.target.value)} className="w-full px-4 h-[42px] bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
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
                      <input type="text" value={newProjectBudget} onChange={(e) => setNewProjectBudget(e.target.value)} placeholder="e.g. ₹10,000" className="w-full px-4 h-[42px] bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Amount Received</label>
                      <input type="text" value={newProjectAmountReceived} onChange={(e) => setNewProjectAmountReceived(e.target.value)} placeholder="e.g. ₹5,000" className="w-full px-4 h-[42px] bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Next Payment Date</label>
                      <input type="date" value={newProjectNextPaymentDate} onChange={(e) => setNewProjectNextPaymentDate(e.target.value)} className="w-full px-4 h-[42px] bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
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
                          <input 
                            type="date" 
                            value={editingProject.startDate}
                            onChange={(e) => {
                              const newStart = e.target.value;
                              setEditingProject({
                                ...editingProject, 
                                startDate: newStart,
                                endDate: editingProject.endDate < newStart ? newStart : editingProject.endDate
                              });
                            }}
                            className={"w-full px-4 py-3 bg-muted/50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium " + (showEditProjectErrors && !editingProject.startDate ? "border-red-500 ring-1 ring-red-500" : "border-border/50")}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">End Date <span className="text-red-500">*</span></label>
                          <input 
                            type="date" 
                            value={editingProject.endDate}
                            min={editingProject.startDate}
                            onChange={(e) => setEditingProject({...editingProject, endDate: e.target.value})}
                            className={"w-full px-4 py-3 bg-muted/50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium " + (showEditProjectErrors && !editingProject.endDate ? "border-red-500 ring-1 ring-red-500" : "border-border/50")}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">Category <span className="text-red-500">*</span></label>
                            <button 
                              type="button"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsManageCategoriesModalOpen(true); }}
                              className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                            >
                              <Settings2 className="w-3 h-3" /> Manage
                            </button>
                          </div>
                          <SearchableSelect 
                            value={editingProject.category}
                            onChange={(val) => setEditingProject({...editingProject, category: val})}
                            options={categories.map(cat => ({ label: cat, value: cat }))}
                            className={"w-full h-[46px] px-4 bg-muted/50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium " + (showEditProjectErrors && !editingProject.category ? "border-red-500 ring-1 ring-red-500" : "border-border/50")}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Status <span className="text-red-500">*</span></label>
                          <SearchableSelect 
                            value={editingProject.status}
                            onChange={(val) => setEditingProject({...editingProject, status: val as ProjectStatus})}
                            options={[
                              { label: "In Progress", value: "In Progress" },
                              { label: "In Review", value: "In Review" },
                              { label: "Completed", value: "Completed" },
                              { label: "On Hold", value: "On Hold" }
                            ]}
                            className="w-full h-[46px] px-4 bg-muted/50 border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Priority</label>
                          <select 
                            value={editingProject.priority || "Medium"} 
                            onChange={(e) => setEditingProject({...editingProject, priority: e.target.value as any})} 
                            className="w-full h-[46px] px-4 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                          >
                            {["Low", "Medium", "High", "Critical"].map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
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
                        <input type="text" value={editingProject.budget || ""} onChange={(e) => setEditingProject({...editingProject, budget: e.target.value})} placeholder="e.g. ₹10,000" className="w-full px-4 h-[42px] bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider">Amount Received</label>
                        <input type="text" value={editingProject.amountReceived || ""} onChange={(e) => setEditingProject({...editingProject, amountReceived: e.target.value})} placeholder="e.g. ₹5,000" className="w-full px-4 h-[42px] bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider">Next Payment Date</label>
                        <input type="date" value={editingProject.nextPaymentDate || ""} onChange={(e) => setEditingProject({...editingProject, nextPaymentDate: e.target.value})} className="w-full px-4 h-[42px] bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium" />
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
    </>
  );
}

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">Clients</h1>
          <p className="text-muted-foreground mt-1">Manage your clients and view their projects.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search clients..." 
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
                  onSelect={(e) => { e.preventDefault(); setActiveTab(tab); }}
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
                      setActiveTab(TABS[0]);
                    }}
                    className="rounded-xl cursor-pointer py-2 focus:bg-rose-500/10 focus:text-rose-500 text-rose-500 font-bold transition-colors flex items-center justify-center"
                  >
                    Clear All Filters
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
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

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border/40 pb-4 overflow-x-auto hide-scrollbar">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-5 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-300",
              activeTab === tab 
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" 
                : "bg-card text-foreground/70 hover:bg-muted/80 border border-border/40"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Clients Grid */}
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
              <div className="w-16 h-16 rounded-2xl border border-border/50 overflow-hidden shadow-sm bg-white p-1 group-hover:scale-105 group-hover:border-primary/30 transition-all duration-300">
                <img src={client.logo} alt={client.name} className="w-full h-full object-cover rounded-xl" />
              </div>
              
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
                        <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Department(s)</label>
                        <input 
                          type="text" value={newClientFormData.department} onChange={(e) => handleClientFormChange('department', e.target.value)} placeholder="e.g. Marketing, Development"
                          className="w-full px-4 h-[42px] bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                        />
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
                        <input type="date" value={newClientFormData.onboardingDate} onChange={(e) => handleClientFormChange('onboardingDate', e.target.value)} className="w-full px-4 h-[42px] bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
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
                          <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Department(s)</label>
                          <input 
                            type="text" value={editingClient.department || ''} onChange={(e) => handleClientFormChange('department', e.target.value, true)} 
                            className="w-full px-4 h-[42px] bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                          />
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
                          <input type="date" value={editingClient.onboardingDate || ''} onChange={(e) => handleClientFormChange('onboardingDate', e.target.value, true)} className="w-full px-4 h-[42px] bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
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
    </div>
  );
}
