import {
  LayoutDashboard,
  Users,
  Files,
  IndianRupee,
  Building2,
  Layers,
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
  section?: string;
  children?: NavChild[];
  badge?: number;
};

export const navItems: NavItem[] = [
  // 1. Dashboard
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },

  // 2. Employees
  {
    title: "Employees",
    icon: Users,
    children: [
      { title: "Employee List", url: "/employees/list" },
      { title: "Org Structure", url: "/employees/org" },
      { title: "Sub-Departments & Designations", url: "/employees/departments-setup" },
    ],
  },

  // 3. Documents
  {
    title: "Documents",
    icon: Files,
    children: [
      { title: "Submitted Documents", url: "/employees/documents" },
      { title: "Document Generator", url: "/employees/documents/generate" },
    ],
  },

  // 4. Payroll
  {
    title: "Payroll",
    icon: IndianRupee,
    children: [
      { title: "Payroll Dashboard", url: "/payroll/dashboard", icon: LayoutGrid },
      { title: "Salary Structure", url: "/payroll/structure", icon: Wallet },
      { title: "Payroll Settings", url: "/payroll/settings", icon: Settings2 },
      { title: "Payroll Processing", url: "/payroll/processing", icon: PlayCircle },
      { title: "Bonus & Deductions", url: "/payroll/bonuses", icon: Gift },
      { title: "Payslips", url: "/payroll/payslips", icon: FileText },
    ],
  },

  // 5. Recruitment
  {
    title: "Recruitment",
    icon: Briefcase,
    children: [
      { title: "Interviews", url: "/recruitment/interviews", badge: 2 },
      { title: "Hirings", url: "/recruitment/hirings" },
    ],
  },

  // 6. Company Finance
  {
    title: "Company Finance",
    icon: Landmark,
    children: [
      { title: "Transactions", url: "/finance/transactions" },
      { title: "Plan", url: "/finance/plan" },
      { title: "Summary", url: "/finance/summary" },
      { title: "Other Transactions", url: "/finance/clients" },
      { title: "Audit Logs", url: "/finance/audit" },
    ],
  },

  // 7. Attendance
  { title: "Attendance", url: "/employees/attendance", icon: Clock },

  // 8. Leave
  { title: "Leave", url: "/employees/leave-requests", icon: CalendarDays },

  // 9. Schedule
  { title: "Schedule", url: "/schedule", icon: CalendarRange },

  // 10. Workspace
  {
    title: "Workspace",
    icon: MonitorPlay,
    children: [
      { title: "Seating Arrangement", url: "/workspace/seating" },
      { title: "Resource Management", url: "/workspace/resource" },
      { title: "Gallery", url: "/workspace/gallery" },
    ],
  },

  // 11. Penalty
  { title: "Penalty", url: "/penalty", icon: MessageSquareWarning },

  // 12. Remarks
  { title: "Remarks", url: "/remarks", icon: Star },

  // 13. Activity Tracker
  { title: "Activity Tracker", url: "/activity-tracker", icon: Activity },

  // 14. Invoice
  {
    title: "Invoice",
    icon: FileText,
    children: [
      { title: "All Invoices", url: "/invoice/all" },
      { title: "Invoice Ledger", url: "/invoice/ledger" },
      { title: "Create Invoice", url: "/invoice/create" },
      { title: "Create Proforma Invoice", url: "/invoice/proforma" },
    ],
  },

  // 15. Chat
  { title: "Chat", url: "/chat", icon: MessagesSquare, badge: 3 },

  // 16. Tasks
  { title: "Tasks", url: "/tasks", icon: ClipboardList },

  // 17. Work Management
  {
    title: "Work Management",
    icon: Briefcase,
    children: [
      { title: "Clients & Projects", url: "/work/projects", icon: Briefcase },
      { title: "Work Logs", url: "/work/logs", icon: ScrollText },
      { title: "Research", url: "/work/research", icon: BookOpen },
      { title: "Sales Dashboard", url: "/work/sales/dashboard", icon: LayoutDashboard },
      { title: "Sales Pipeline", url: "/work/sales/pipeline", icon: Kanban },
      { title: "Sales Leads", url: "/work/sales/leads", icon: Users },
      { title: "Sales Tasks & Follow-ups", url: "/work/sales/tasks", icon: ClipboardList },
      { title: "Sales Analytics", url: "/work/sales/analytics", icon: BarChart3 },
      { title: "Team Performance", url: "/work/sales/team", icon: Trophy },
      { title: "Sales Reports", url: "/work/sales/reports", icon: FileText },
      { title: "Sales Settings", url: "/work/sales/settings", icon: SlidersHorizontal },
    ],
  },

  // 18. Elections & Recognition
  {
    title: "Elections & Recognition",
    icon: Vote,
    children: [
      { title: "Employee of Month", url: "/recognitions" },
      { title: "Team Leader of the Week", url: "/team-leader-of-the-week" },
      { title: "Elections", url: "/elections" },
    ],
  },

  // 19. Settings
  { title: "Settings", url: "/settings", icon: Settings },

  // 20. Restrictions
  { title: "Restrictions", url: "/restrictions", icon: Shield },

  // 21. Activity Logs
  { title: "Activity Logs", url: "/activity-logs", icon: Activity },

  // --- ADDITIONAL MODULES (Present in code, placed below the image items) ---
  // 22. Access Control
  { title: "Access Control", url: "/access-control", icon: Shield },

  // 23. Approvals Hub
  {
    title: "Approvals Hub",
    icon: CheckCheck,
    badge: 9,
    children: [
      { title: "Leave Requests", url: "/employees/leave-requests", badge: 4 },
      { title: "Penalties", url: "/approvals/penalties", badge: 2 },
      { title: "Daily Progress", url: "/approvals/daily-progress" },
      { title: "Approval History", url: "/approvals/history" },
    ],
  },

  // 24. Reports & Analytics
  {
    title: "Reports & Analytics",
    icon: BarChart3,
    children: [
      { title: "Overview", url: "/reports" },
      { title: "Attendance Report", url: "/reports/attendance" },
      { title: "Payroll Cost", url: "/reports/payroll" },
      { title: "Hiring Funnel", url: "/reports/hiring" },
      { title: "Project & Work Report", url: "/reports/work" },
    ],
  },

  // 25. CEO Dashboard
  {
    title: "CEO Dashboard",
    icon: LayoutDashboard,
    children: [
      { title: "CEO Overview", url: "/ceo-dashboard" },
      { title: "B2B Partnership", url: "/ceo-dashboard/b2b" },
      { title: "Tech Collaboration", url: "/ceo-dashboard/collaboration" },
      { title: "Franchise", url: "/ceo-dashboard/franchise" },
      { title: "Reports", url: "/ceo-dashboard/reports" },
      { title: "Settings", url: "/ceo-dashboard/settings" },
    ],
  },

  // 26. Recycle Bin
  { title: "Recycle Bin", url: "/recycle-bin", icon: Trash2 },
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
