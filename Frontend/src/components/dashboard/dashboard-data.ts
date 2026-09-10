export const TOP_METRICS = [
  { label: "Total Employees", emoji: "👥", value: "148", change: "↗ 4.2%", trend: "up", color: "emerald", chartColor: "#00A56C" },
  { label: "Present Today", emoji: "🟢", value: "131", change: "↗ 2.8%", trend: "up", color: "emerald", chartColor: "#00A56C" },
  { label: "Absent Today", emoji: "🔴", value: "9", change: "↘ 12.5%", trend: "down", color: "rose", chartColor: "#e11d48" },
  { label: "Late Today", emoji: "🟠", value: "8", change: "↗ 6.1%", trend: "up", color: "emerald", chartColor: "#f59e0b" },
  { label: "Total Interns", emoji: "🎓", value: "22", change: "↗ 10.0%", trend: "up", color: "emerald", chartColor: "#3b82f6" },
  { label: "Pending Leaves", emoji: "📋", value: "6", change: "↘ 18.2%", trend: "down", color: "rose", chartColor: "#f59e0b" },
  { label: "Active Clients", emoji: "💼", value: "64", change: "↗ 7.4%", trend: "up", color: "emerald", chartColor: "#00A56C" },
  { label: "Running Projects", emoji: "📂", value: "31", change: "↗ 3.1%", trend: "up", color: "emerald", chartColor: "#3b82f6" },
  { label: "Pending Tasks", emoji: "📌", value: "187", change: "↘ 5.6%", trend: "down", color: "rose", chartColor: "#f59e0b" },
  { label: "Monthly Revenue", emoji: "💰", value: "₹48.20 L", change: "↗ 12.6%", trend: "up", color: "emerald", chartColor: "#00A56C" },
  { label: "Monthly Expense", emoji: "💸", value: "₹29.60 L", change: "↗ 4.8%", trend: "up", color: "emerald", chartColor: "#e11d48" },
  { label: "Net Profit", emoji: "📈", value: "₹18.60 L", change: "↗ 21.4%", trend: "up", color: "emerald", chartColor: "#00A56C" },
];

export const DEPARTMENTS = [
  { name: "Creative", total: 26, present: 23, tasks: 34, completed: 118 },
  { name: "Development", total: 42, present: 39, tasks: 61, completed: 244 },
  { name: "Sales", total: 24, present: 21, tasks: 29, completed: 156 },
  { name: "HR", total: 12, present: 11, tasks: 12, completed: 64 },
  { name: "Digital Marketing", total: 28, present: 25, tasks: 38, completed: 172 },
  { name: "Accounts", total: 16, present: 12, tasks: 13, completed: 88 }
];

export const PROJECTS_GANTT = [
  { name: "Aurora Commerce Revamp", client: "Aurora Retail", status: "Active", progress: 65, color: "emerald" },
  { name: "Nimbus CRM Rollout", client: "Nimbus Tech", status: "Delayed", progress: 42, color: "rose" },
  { name: "Vertex Brand Campaign", client: "Vertex Foods", status: "Active", progress: 88, color: "emerald" },
  { name: "Solaris Mobile App", client: "Solaris Energy", status: "Active", progress: 12, color: "emerald" },
  { name: "Kite Social Launch", client: "Kite Media", status: "Over Budget", progress: 95, color: "amber" }
];

export const UPCOMING_FOLLOW_UPS = [
  { client: "Aurora Retail", assignee: "Aarav Mehta", date: "Today" },
  { client: "Vertex Foods", assignee: "Sneha Iyer", date: "Tomorrow" },
  { client: "Kite Media", assignee: "Manav Desai", date: "14 Aug" }
];

export const UPCOMING_DEADLINES = [
  { task: "Kite Social Launch", date: "Today" },
  { task: "Vertex Brand Campaign", date: "05 Aug" },
  { task: "Aurora Commerce Revamp", date: "12 Aug" }
];

export const KEY_ACCOUNTS = [
  { name: "Aurora Retail", since: "2022", value: "High", health: "Good" },
  { name: "Nimbus Tech", since: "2023", value: "Medium", health: "Warning" },
  { name: "Vertex Foods", since: "2021", value: "High", health: "Good" },
  { name: "Solaris Energy", since: "2020", value: "Premium", health: "Good" }
];

export const ACTIVITY_FEED = [
  { icon: "UserPlus", title: "Aditya Bhatt joined Development", time: "12 min ago", color: "indigo" },
  { icon: "CheckCircle", title: "Leave approved for Priya Nair", time: "38 min ago", color: "emerald" },
  { icon: "CheckSquare", title: "Task Gateway patch completed by Riya Shah", time: "1 hr ago", color: "blue" },
  { icon: "IndianRupee", title: "Invoice #INV-2214 paid — ₹4,80,000", time: "2 hrs ago", color: "emerald" },
  { icon: "Briefcase", title: "New client added — Kite Media", time: "3 hrs ago", color: "indigo" },
  { icon: "Rocket", title: "Project Solaris Mobile App started", time: "5 hrs ago", color: "amber" },
  { icon: "Banknote", title: "July salary processed for 148 employees", time: "Yesterday", color: "emerald" }
];

export const PROFIT_TREND = [
  { month: "Jan", profit: 12.4 },
  { month: "Feb", profit: 11.2 },
  { month: "Mar", profit: 14.8 },
  { month: "Apr", profit: 13.5 },
  { month: "May", profit: 15.2 },
  { month: "Jun", profit: 16.1 },
  { month: "Jul", profit: 16.8 }
];

export const CASH_FLOW = [
  { month: "Jan", revenue: 42, expense: 29 },
  { month: "Feb", revenue: 40, expense: 28 },
  { month: "Mar", revenue: 45, expense: 30 },
  { month: "Apr", revenue: 44, expense: 30 },
  { month: "May", revenue: 46, expense: 31 },
  { month: "Jun", revenue: 48, expense: 31 },
  { month: "Jul", revenue: 48, expense: 31 }
];

export const TOP_PERFORMERS = [
  { name: "Riya Shah", dept: "Development", isTop: true },
  { name: "Aarav Mehta", dept: "Sales", isTop: false },
  { name: "Neha Patel", dept: "Creative", isTop: false },
  { name: "Karan Joshi", dept: "Digital Marketing", isTop: false },
  { name: "Ishita Rao", dept: "Accounts", isTop: false },
];

export const SPOTLIGHT_EMPLOYEES = [
  { name: "Parince", role: "Employee of the Month", image: "/prince.jpg" },
  { name: "Aarav Mehta", role: "Top Closer · Sales" },
  { name: "Neha Patel", role: "Creative Star · Design", image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&auto=format&fit=crop&q=80" }
];

export const LATE_LEADERBOARD = [
  { name: "Manav Desai", late: 9 },
  { name: "Sahil Kapoor", late: 7 },
  { name: "Dev Trivedi", late: 6 },
  { name: "Anaya Singh", late: 4 },
];

export const NEEDS_ATTENTION = [
  { name: "Manav Desai", dept: "Sales", score: 54 },
  { name: "Priya Nair", dept: "Creative", score: 58 },
  { name: "Dev Trivedi", dept: "Development", score: 61 },
];

export const WEEKLY_ATTENDANCE = [
  { day: "Mon", present: 135, late: 12, wfh: 28, absent: 5 },
  { day: "Tue", present: 140, late: 8, wfh: 25, absent: 3 },
  { day: "Wed", present: 132, late: 18, wfh: 30, absent: 8 },
  { day: "Thu", present: 138, late: 6, wfh: 26, absent: 4 },
  { day: "Fri", present: 128, late: 15, wfh: 35, absent: 7 },
  { day: "Sat", present: 110, late: 5, wfh: 45, absent: 12 },
];

export const SALES_METRICS = {
  today: "₹3.4 L",
  monthly: "₹48.2 L",
  target: "₹58.0 L",
  conversion: "24.6%",
  achievement: 83
};

export const FINANCE_METRICS = {
  todayIncome: "₹5.8 L",
  todayExpense: "₹2.1 L",
  outstanding: "₹31.2 L",
  pendingClient: "₹18.6 L",
  pendingVendor: "₹6.4 L"
};

export const MY_TASKS = [
  { title: "Approve Q3 hiring plan", assignee: "You", due: "Today", status: "pending" },
  { title: "Review Aurora design system", assignee: "Neha Patel", due: "Today", status: "pending" },
  { title: "Sign vendor contract – Nimbus", assignee: "You", due: "Tomorrow", status: "pending" },
  { title: "Finalize appraisal matrix", assignee: "HR Team", due: "02 Aug", status: "pending" },
  { title: "Ship payment gateway patch", assignee: "Riya Shah", due: "Today", status: "completed" },
];

export const HR_UPDATES = {
  birthdays: [
    { name: "Neha Patel", date: "Today" },
    { name: "Sahil Kapoor", date: "02 Aug" }
  ],
  anniversaries: [
    { name: "Riya Shah", tenure: "3 years" },
    { name: "Ishita Rao", tenure: "5 years" }
  ],
  interviews: [
    { role: "Frontend Engineer", time: "11:00 AM" },
    { role: "Performance Marketer", time: "03:30 PM" }
  ],
  joining: [{ name: "Aditya Bhatt", date: "01 Aug" }],
  exit: [{ name: "Rohan Verma", date: "15 Aug" }],
  probation: [{ name: "Tanvi Shah", date: "07 Aug" }],
  document: [{ name: "Nikhil – Passport", date: "18 Aug" }],
  policies: [{ name: "Hybrid Work Policy v2", status: "Published" }]
};

export const COMPANY_NEWS = [
  { title: "HK DigiVerse crosses 60 active clients", desc: "A new milestone driven by the Sales and Delivery teams." },
  { title: "Appraisal cycle starts 05 August", desc: "Managers must submit review drafts before 03 August." },
  { title: "Revised hybrid work policy", desc: "Minimum 3 office days per week from this month." }
];

export const AI_SUMMARY = {
  prediction: "₹54.5 L",
  predictionText: "Forecast close for this month (94% target)",
  actions: [
    "Review Creative dept workload distribution",
    "Escalate Vertex Foods payment to accounts",
    "Reallocate 2 developers to Solaris app",
    "Approve 6 pending leave requests"
  ]
};

export const OVERALL_KPIS = [
  { label: "Overall Productivity", value: "88%" },
  { label: "Company Growth", value: "12%" },
  { label: "Employee Utilization", value: "92%" },
  { label: "Project Completion", value: "85%" },
  { label: "Avg Response Time", value: "1.2 hrs" },
  { label: "Client Retention", value: "98%" },
  { label: "Employee Retention", value: "94%" },
  { label: "Monthly Burn Rate", value: "₹29.0L" },
  { label: "Profit Margin", value: "38.5%" },
  { label: "Revenue / Employee", value: "₹3.2L" },
  { label: "Avg Client Value", value: "₹7.5L" },
  { label: "Avg Task Time", value: "2.4 days" }
];
