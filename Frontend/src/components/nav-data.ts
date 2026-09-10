import {
  LayoutDashboard,
  Users,
  Files,
  IndianRupee,
  Building2,
  Landmark,
  Clock,
  CalendarDays,
  CalendarRange,
  MonitorPlay,
  MessageSquareWarning,
  Star,
  Activity,
  FileText,
  MessagesSquare,
  ClipboardList,
  Briefcase,
  BookOpen,
  Vote,
  Settings,
  Shield,
  ScrollText,
  BarChart3,
  CheckCheck,
  UserPlus,
  ReceiptText,
  CalendarPlus,
  ListPlus,
  Trophy,
  Kanban,
  SlidersHorizontal,
  LayoutGrid,
  Wallet,
  Settings2,
  PlayCircle,
  Gift,
  Handshake,
  Target,
  Cpu,
  Store,
  CheckSquare,
  BarChart2,
  Bell,
  Trash2,
  Package,
  Map,
  type LucideIcon,
} from "lucide-react";

export type NavChild = { title: string; url: string; badge?: number; icon?: LucideIcon };

export type NavItem = {
  title: string;
  url?: string;
  icon: LucideIcon;
  section: string;
  children?: NavChild[];
  badge?: number;
};

export const navItems: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, section: "Overview" },
  {
    title: "Approvals Hub",
    icon: CheckCheck,
    section: "Overview",
    badge: 9,
    children: [
      { title: "Leave Requests", url: "/employees/leave-requests", badge: 4 },
      { title: "Penalties", url: "/approvals/penalties", badge: 2 },
      { title: "Daily Progress", url: "/approvals/daily-progress" },
      { title: "Approval History", url: "/approvals/history" },
    ],
  },
  {
    title: "Reports & Analytics",
    icon: BarChart3,
    section: "Overview",
    children: [
      { title: "Overview", url: "/reports" },
      { title: "Attendance Report", url: "/reports/attendance" },
      { title: "Payroll Cost", url: "/reports/payroll" },
      { title: "Hiring Funnel", url: "/reports/hiring" },
      { title: "Project & Work Report", url: "/reports/work" },
    ],
  },
  {
    title: "Employees",
    icon: Users,
    section: "People",
    children: [
      { title: "Employee List", url: "/employees/list" },
      { title: "Org Structure", url: "/employees/org" },
      { title: "Attendance List", url: "/employees/attendance" },
      { title: "Leave Requests", url: "/employees/leave-requests", badge: 4 },
      { title: "Documents", url: "/employees/documents" },
    ],
  },
  {
    title: "Recruitment",
    icon: Building2,
    section: "People",
    children: [
      { title: "Interviews", url: "/recruitment/interviews", badge: 2 },
      { title: "Hirings", url: "/recruitment/hirings" },
    ],
  },

  { title: "Schedule", url: "/schedule", icon: CalendarRange, section: "Work" },
  {
    title: "Payroll",
    icon: IndianRupee,
    section: "Finance",
    children: [
      { title: "Payroll Dashboard", url: "/payroll/dashboard", icon: LayoutGrid },
      { title: "Salary Structure", url: "/payroll/structure", icon: Wallet },
      { title: "Payroll Settings", url: "/payroll/settings", icon: Settings2 },
      { title: "Payroll Processing", url: "/payroll/processing", icon: PlayCircle },
      { title: "Bonus & Deductions", url: "/payroll/bonuses", icon: Gift },
      { title: "Payslips", url: "/payroll/payslips", icon: FileText },
    ],
  },
  {
    title: "Company Finance",
    icon: Landmark,
    section: "Finance",
    children: [
      { title: "Transactions", url: "/finance/transactions" },
      { title: "Plan", url: "/finance/plan" },
      { title: "Summary", url: "/finance/summary" },
      { title: "Other Transactions", url: "/finance/clients" },
      { title: "Audit Logs", url: "/finance/audit" },
    ],
  },
  {
    title: "Invoice",
    icon: FileText,
    section: "Finance",
    children: [
      { title: "All Invoices", url: "/invoice/all" },
      { title: "Invoice Ledger", url: "/invoice/ledger" },
      { title: "Create Invoice", url: "/invoice/create" },
      { title: "Create Proforma Invoice", url: "/invoice/proforma" },
    ],
  },
  { title: "Clients & Projects", url: "/work/projects", icon: Briefcase, section: "Work" },
  { title: "Work Logs", url: "/work/logs", icon: ScrollText, section: "Work" },
  { title: "Research", url: "/work/research", icon: BookOpen, section: "Work" },
  {
    title: "Sales",
    icon: ReceiptText,
    section: "Work",
    children: [
      { title: "Dashboard", url: "/work/sales/dashboard", icon: LayoutDashboard },
      { title: "Pipeline", url: "/work/sales/pipeline", icon: Kanban },
      { title: "Leads", url: "/work/sales/leads", icon: Users },
      { title: "Tasks & Follow-ups", url: "/work/sales/tasks", icon: ClipboardList },
      { title: "Sales Analytics", url: "/work/sales/analytics", icon: BarChart3 },
      { title: "Team Performance", url: "/work/sales/team", icon: Trophy },
      { title: "Reports", url: "/work/sales/reports", icon: FileText },
      { title: "Settings", url: "/work/sales/settings", icon: SlidersHorizontal },
    ],
  },
  { title: "Tasks", url: "/tasks", icon: ClipboardList, section: "Work" },
  { title: "Chat", url: "/chat", icon: MessagesSquare, section: "Work", badge: 3 },

  {
    title: "Workspace",
    icon: MonitorPlay,
    section: "Workplace",
    children: [
      { title: "Seating Arrangement", url: "/workspace/seating" },
      { title: "Resource Management", url: "/workspace/resource" },
      { title: "Gallery", url: "/workspace/gallery" },
    ],
  },
  { title: "Penalty", url: "/penalty", icon: MessageSquareWarning, section: "Workplace" },
  { title: "Remarks", url: "/remarks", icon: Star, section: "Workplace" },
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    section: "Command Center",
    children: [
      { title: "CEO Overview", url: "/ceo-dashboard" }
    ]
  },
  {
    title: "B2B Partnership",
    icon: Handshake,
    section: "Command Center",
    children: [
      { title: "Overview", url: "/ceo-dashboard/b2b" },
      { title: "Partners", url: "/ceo-dashboard/b2b/partners" },
      { title: "Leads", url: "/ceo-dashboard/b2b/leads" },
      { title: "Opportunities", url: "/ceo-dashboard/b2b/opportunities" },
      { title: "Deals", url: "/ceo-dashboard/b2b/deals" },
      { title: "Invoices", url: "/ceo-dashboard/b2b/invoices" },
      { title: "Commission", url: "/ceo-dashboard/b2b/commission" },
      { title: "Monthly Settlement", url: "/ceo-dashboard/b2b/settlement" },
      { title: "Partner Performance", url: "/ceo-dashboard/b2b/performance" }
    ]
  },
  { title: "Tech Collaboration", url: "/ceo-dashboard/collaboration", icon: Cpu, section: "Command Center" },
  { title: "Franchise", url: "/ceo-dashboard/franchise", icon: Store, section: "Command Center" },
  { title: "Reports", url: "/ceo-dashboard/reports", icon: BarChart2, section: "Command Center" },
  { title: "Settings", url: "/ceo-dashboard/settings", icon: Settings, section: "Command Center" },
  { title: "Activity Tracker", url: "/activity-tracker", icon: Activity, section: "Admin" },

  {
    title: "Elections & Recognition",
    icon: Vote,
    section: "Admin",
    children: [
      { title: "Employee of Month", url: "/recognitions" },
      { title: "Team Leader of the Week", url: "/team-leader-of-the-week" },
      { title: "Elections", url: "/elections" },
    ],
  },
  { title: "Settings", url: "/settings", icon: Settings, section: "Admin" },
  { title: "Restrictions", url: "/restrictions", icon: Shield, section: "Admin" },
  { title: "Activity Logs", url: "/activity-logs", icon: ScrollText, section: "Admin" },
  { title: "Recycle Bin", url: "/recycle-bin", icon: Trash2, section: "Admin" },
];

export const sectionOrder = [
  "Overview",
  "Command Center",
  "People",
  "Finance",
  "Work",
  "Workplace",
  "Admin",
];

export type QuickAction = { title: string; url: string; icon: LucideIcon; hint?: string };

export const quickCreateActions: QuickAction[] = [
  { title: "New Invoice", url: "/invoice/create", icon: ReceiptText, hint: "Billing" },
  { title: "New Task", url: "/tasks?new=1", icon: ListPlus, hint: "Work" },
  { title: "Add Employee", url: "/employees/list?new=1", icon: UserPlus, hint: "People" },
  { title: "Apply Leave", url: "/employees/leave-requests?new=1", icon: CalendarPlus, hint: "Work" },
];

export const mobileBarItems: QuickAction[] = [
  { title: "Home", url: "/dashboard", icon: LayoutDashboard },
  { title: "Tasks", url: "/tasks", icon: ClipboardList },
  { title: "Approvals", url: "/approvals/leave-requests", icon: CheckCheck },
  { title: "Chat", url: "/chat", icon: MessagesSquare },
];
