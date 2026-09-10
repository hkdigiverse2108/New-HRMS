export interface SalaryComponent {
  id: string;
  name: string;
  amount: number;
  type: "earnings" | "deductions";
}

export interface SalaryHistory {
  date: string;
  amount: number;
  reason: string;
  actionBy: string;
  type: "Promotion" | "Increase" | "Initial";
}

export interface EmployeeSalary {
  id: string;
  empId: string;
  name: string;
  designation: string;
  department: string;
  joiningDate: string;
  type: string;
  effectiveDate: string;
  grossSalary: number;
  components: SalaryComponent[];
  history: { date: string; amount: number; reason: string; type: string; actionBy: string }[];
  attendance: {
    workingDays: number;
    present: number;
    leave: number;
    absent: number;
    overtimeHrs: number;
  };
}

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
};

export const MOCK_EMPLOYEES: EmployeeSalary[] = [
  {
    id: "1",
    empId: "HKD-001",
    name: "Ananya Sharma",
    designation: "Senior Software Engineer",
    department: "Engineering",
    joiningDate: "11 Mar 2024",
    type: "Full Time",
    effectiveDate: "01 Jul 2026",
    grossSalary: 81400,
    components: [],
    history: [
      { date: "01 Apr 2026", amount: 81400, reason: "Annual Appraisal", type: "Promotion", actionBy: "HR Admin" },
      { date: "05 Jun 2022", amount: 65000, reason: "Joined Company", type: "Initial", actionBy: "HR Admin" }
    ],
    attendance: { workingDays: 26, present: 24, leave: 2, absent: 0, overtimeHrs: 6 }
  },
  {
    id: "2",
    empId: "HKD-002",
    name: "Rahul Verma",
    designation: "Backend Developer",
    department: "Engineering",
    joiningDate: "12 Oct 2023",
    type: "Full Time",
    effectiveDate: "01 Jul 2026",
    grossSalary: 68000,
    components: [],
    history: [
      { date: "01 Apr 2026", amount: 68000, reason: "Annual Appraisal", type: "Promotion", actionBy: "HR Admin" },
      { date: "12 Oct 2023", amount: 55000, reason: "Joined Company", type: "Initial", actionBy: "HR Admin" }
    ],
    attendance: { workingDays: 26, present: 26, leave: 0, absent: 0, overtimeHrs: 12 }
  },
  {
    id: "3",
    empId: "HKD-003",
    name: "Priya Nair",
    designation: "Product Designer",
    department: "Design",
    joiningDate: "15 Jan 2024",
    type: "Full Time",
    effectiveDate: "01 Jul 2026",
    grossSalary: 72500,
    components: [],
    history: [
      { date: "15 Jan 2024", amount: 72500, reason: "Joined Company", type: "Initial", actionBy: "HR Admin" }
    ],
    attendance: { workingDays: 26, present: 25, leave: 1, absent: 0, overtimeHrs: 0 }
  }
];

export const MOCK_AUDIT_LOGS = [
  { id: 1, action: "Approved payroll for Jun 2026 — locked as read-only", by: "CEO", date: "2026-07-24 18:22" },
  { id: 2, action: "Added Loan EMI deduction ₹3,000 for HKD-002", by: "Accounts", date: "2026-07-22 11:05" },
  { id: 3, action: "Created referral bonus BD-1044 (pending approval)", by: "HR Admin", date: "2026-07-18 09:47" },
  { id: 4, action: "Salary revision HKD-001 ₹74,000 → ₹92,000 (Promotion)", by: "CEO", date: "2026-07-01 10:12" },
  { id: 5, action: "Salary revision HKD-003 ₹32,000 → ₹38,000 (Increase)", by: "HR Admin", date: "2026-07-01 10:03" }
];

export const MOCK_PAYROLL_TRENDS = [
  { month: "Jan", cost: 3.8 },
  { month: "Feb", cost: 3.8 },
  { month: "Mar", cost: 3.8 },
  { month: "Apr", cost: 4.1 },
  { month: "May", cost: 4.1 },
  { month: "Jun", cost: 4.1 },
  { month: "Jul", cost: 4.22 }
];

export const MOCK_DEPARTMENT_COSTS = [
  { name: "Engineering", value: 45, color: "#0088FE" },
  { name: "Sales", value: 25, color: "#00C49F" },
  { name: "Marketing", value: 15, color: "#FFBB28" },
  { name: "HR & Admin", value: 15, color: "#FF8042" },
];

export const MOCK_BONUS_DEDUCTIONS = [
  { ref: "BD-1041", type: "Bonus", typeLabel: "Festival Bonus", appliedTo: "All employees", appliedToSub: "Entire Company", reason: "Diwali festival bonus 2026", creator: "HR Admin", date: "05 Jul 2026", amount: 5000, state: "Approved" },
  { ref: "BD-1042", type: "Bonus", typeLabel: "Performance Bonus", appliedTo: "Ananya Sharma", appliedToSub: "Individual", reason: "Q2 delivery excellence", creator: "HR Admin", date: "12 Jul 2026", amount: 8000, state: "Approved" },
  { ref: "BD-1043", type: "Bonus", typeLabel: "Sales Incentive", appliedTo: "Sales", appliedToSub: "Department", reason: "Q2 target 128% achieved", creator: "Accounts", date: "14 Jul 2026", amount: 12000, state: "Approved" },
  { ref: "BD-1044", type: "Bonus", typeLabel: "Referral Bonus", appliedTo: "Meera Krishnan", appliedToSub: "Individual", reason: "Referral joined & confirmed", creator: "HR Admin", date: "18 Jul 2026", amount: 6000, state: "Pending" },
  { ref: "BD-1045", type: "Deduction", typeLabel: "Late Coming", appliedTo: "Vikram Joshi", appliedToSub: "Individual", reason: "6 late marks beyond grace", creator: "HR Admin", date: "20 Jul 2026", amount: -500, state: "Approved" },
  { ref: "BD-1046", type: "Deduction", typeLabel: "Advance Recovery", appliedTo: "Vikram Joshi", appliedToSub: "Individual", reason: "Salary advance EMI 2/4", creator: "Accounts", date: "21 Jul 2026", amount: -2500, state: "Approved" },
  { ref: "BD-1047", type: "Deduction", typeLabel: "Loan EMI", appliedTo: "Rahul Verma", appliedToSub: "Individual", reason: "Personal loan EMI 7/12", creator: "Accounts", date: "22 Jul 2026", amount: -3000, state: "Approved" },
  { ref: "BD-1048", type: "Bonus", typeLabel: "Project Bonus", appliedTo: "Imran Qureshi", appliedToSub: "Individual", reason: "Audit closure ahead of schedule", creator: "CEO", date: "24 Jul 2026", amount: 5000, state: "Approved" }
];

export const MOCK_PAYROLL_RUNS = [
  { id: "1", employee: "Ananya Sharma", empId: "HKD-001", working: 26, present: 24, absent: 0, leave: 2, otHrs: 6, gross: 92000, deduction: 11708, netSalary: 93596, status: "Not Generated" },
  { id: "2", employee: "Rahul Verma", empId: "HKD-002", working: 26, present: 25, absent: 1, leave: 0, otHrs: 0, gross: 66000, deduction: 9610, netSalary: 68390, status: "Not Generated" },
  { id: "3", employee: "Priya Nair", empId: "HKD-003", working: 26, present: 22, absent: 2, leave: 2, otHrs: 4, gross: 38000, deduction: 4872, netSalary: 34592, status: "Not Generated" },
  { id: "4", employee: "Imran Qureshi", empId: "HKD-004", working: 26, present: 26, absent: 0, leave: 0, otHrs: 9, gross: 71000, deduction: 6910, netSalary: 75228, status: "Not Generated" },
  { id: "5", employee: "Sneha Patil", empId: "HKD-005", working: 26, present: 23, absent: 1, leave: 2, otHrs: 2, gross: 45000, deduction: 5281, netSalary: 40583, status: "Not Generated" },
  { id: "6", employee: "Vikram Joshi", empId: "HKD-006", working: 26, present: 20, absent: 4, leave: 2, otHrs: 0, gross: 36000, deduction: 7983, netSalary: 28017, status: "Not Generated" },
  { id: "7", employee: "Meera Krishnan", empId: "HKD-007", working: 26, present: 25, absent: 0, leave: 1, otHrs: 3, gross: 52000, deduction: 3690, netSalary: 55810, status: "Not Generated" }
];

export type PayrollRun = typeof MOCK_PAYROLL_RUNS[number];
