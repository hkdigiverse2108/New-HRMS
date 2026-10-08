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
  Target,
  Trash2,
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

  // 2. Attendance
  { title: "Attendance", url: "/employees/attendance", icon: Clock },

  // 3. Leave
  { title: "Leave", url: "/employees/leave-requests", icon: CalendarDays },

  // 4. Schedule
  { title: "Schedule", url: "/schedule", icon: CalendarRange },

  // 5. Task
  { title: "Task", url: "/tasks", icon: ClipboardList },

  // 6. Client & Project (Promoted to Main Page)
  { title: "Client & Project", url: "/work/projects", icon: Briefcase },

  // 7. Chat
  { title: "Chat", url: "/chat", icon: MessagesSquare },

  // 8. Work Logs (Promoted to Main Page)
  { title: "Work Logs", url: "/work/logs", icon: ScrollText },

  // 9. Research (Promoted to Main Page)
  { title: "Research", url: "/work/research", icon: BookOpen },

  // 10. Sales (Unified Main Page, sub-pages integrated inside SalesHub)
  { title: "Sales", url: "/work/sales", icon: Target },

  // 11. Daily Progress
  { title: "Daily Progress", url: "/approvals/daily-progress", icon: CheckCheck },

  // 12. Interview
  { title: "Interview", url: "/recruitment/interviews", icon: Users },

  // 13. Activity Tracker
  { title: "Activity Tracker", url: "/activity-tracker", icon: Activity },

  // 14. Invoices (5 Sub-Departments)
  {
    title: "Invoices",
    icon: FileText,
    children: [
      { title: "Invoices", url: "/invoice/all" },
      { title: "Quotation", url: "/invoice/proforma" },
      { title: "Ledger", url: "/invoice/ledger" },
      { title: "Create Invoice", url: "/invoice/create" },
      { title: "Create Quotations", url: "/invoice/proforma?create=1" },
    ],
  },

  // 15. Penalty
  { title: "Penalty", url: "/penalty", icon: MessageSquareWarning },

  // 16. Remarks
  { title: "Remarks", url: "/remarks", icon: Star },

  // 17. Our Gallery
  { title: "Our Gallery", url: "/workspace/gallery", icon: MonitorPlay },

  // 18. Seating
  { title: "Seating", url: "/workspace/seating", icon: LayoutGrid },

  // 19. Recruitment
  { title: "Recruitment", url: "/recruitment/hirings", icon: UserPlus },

  // 20. Payroll (Existing sub-departments preserved)
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

  // 21. Document Center (Direct Main Page)
  { title: "Document Center", url: "/employees/documents", icon: Files },

  // 22. Document Generate (Direct Main Page)
  { title: "Document Generate", url: "/employees/documents/generate", icon: FileText },

  // 23. Election (Unified Main Page, sub-pages integrated inside ElectionsHub)
  { title: "Election", url: "/elections", icon: Vote },

  // 24. Company Finance (Existing sub-departments preserved)
  {
    title: "Company Finance",
    icon: Landmark,
    children: [
      { title: "Transactions", url: "/finance/transactions" },
      { title: "Plan", url: "/finance/plan" },
      { title: "Summary", url: "/finance/summary" },
      { title: "Other Transactions", url: "/finance/clients" },
    ],
  },

  // 25. Employees (Employee list is default main view, plus sub-departments)
  {
    title: "Employees",
    url: "/employees/list",
    icon: Users,
    children: [
      { title: "Org Structure", url: "/employees/org" },
      { title: "Sub-Departments & Designations", url: "/employees/departments-setup" },
    ],
  },

  // 26. Deposit (Promoted to Main Page)
  { title: "Deposit", url: "/employees/deposits", icon: Wallet },

  // 27. Activity Logs
  { title: "Activity Logs", url: "/activity-logs", icon: Activity },

  // 28. Recycle Bin
  { title: "Recycle Bin", url: "/recycle-bin", icon: Trash2 },

  // 29. Access Control
  { title: "Access Control", url: "/access-control", icon: Shield },

  // 30. Settings
  { title: "Settings", url: "/settings", icon: Settings },
];

export const sectionOrder = [
  "Overview",
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
