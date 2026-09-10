export type EmployeeStatus = 'Active' | 'On Leave' | 'Remote' | 'Inactive';

export interface Employee {
  id: string;
  name: string;
  role: string;
  department: string;
  status: EmployeeStatus;
  email: string;
  phone: string;
  joinDate: string;
  avatar: string;
  performanceScore: number; // Out of 100
  
  // Extended HRMS-1 fields (optional for backward compatibility with mock data)
  firstName?: string;
  middleName?: string;
  lastName?: string;
  password?: string;
  dob?: string;
  salary?: string;
  upiId?: string;
  accountNumber?: string;
  ifscCode?: string;
  bankName?: string;
  accountHolderName?: string;
  parentName?: string;
  parentNumber?: string;
  relation?: string;
  aadharCard?: string;
  panCard?: string;
  sub_department?: string;
  designation?: string;
  startTime?: string;
  endTime?: string;
  workMode?: string;
  activelyUsingHRMS?: boolean;
  gender?: string;
  position?: string;
  requiredDocuments?: string[];
  hasBond?: boolean;
  bondStartDate?: string;
  bondEndDate?: string;
  hasNoticePeriod?: boolean;
  noticePeriodDays?: string;
  noticePeriodStartDate?: string;
  hasResignation?: boolean;
  resignationDate?: string;
  hasEmployment?: boolean;
  employmentStartDate?: string;
  bondsHistory?: any[];
}

export const AVAILABLE_DEPARTMENTS = [
  "Development",
  "Sales",
  "Creative",
  "HR",
  "Product",
  "Marketing",
  "Finance"
];

export const EMPLOYEES: Employee[] = [
  {
    id: "EMP-001",
    name: "Riya Shah",
    role: "Senior Frontend Engineer",
    department: "Development",
    status: "Active",
    email: "riya.shah@hkdigiverse.com",
    phone: "+91 98765 43210",
    joinDate: "2021-04-12",
    avatar: "https://i.pravatar.cc/150?u=riya",
    performanceScore: 98
  },
  {
    id: "EMP-002",
    name: "Aarav Mehta",
    role: "Sales Director",
    department: "Sales",
    status: "Active",
    email: "aarav.mehta@hkdigiverse.com",
    phone: "+91 98765 43211",
    joinDate: "2020-02-15",
    avatar: "https://i.pravatar.cc/150?u=aarav",
    performanceScore: 95
  },
  {
    id: "EMP-003",
    name: "Neha Patel",
    role: "UI/UX Lead",
    department: "Creative",
    status: "On Leave",
    email: "neha.patel@hkdigiverse.com",
    phone: "+91 98765 43212",
    joinDate: "2022-08-01",
    avatar: "https://i.pravatar.cc/150?u=neha",
    performanceScore: 92
  },
  {
    id: "EMP-004",
    name: "Vikram Singh",
    role: "Backend Developer",
    department: "Development",
    status: "Remote",
    email: "vikram.singh@hkdigiverse.com",
    phone: "+91 98765 43213",
    joinDate: "2023-01-10",
    avatar: "https://i.pravatar.cc/150?u=vikram",
    performanceScore: 88
  },
  {
    id: "EMP-005",
    name: "Ananya Desai",
    role: "HR Manager",
    department: "HR",
    status: "Active",
    email: "ananya.desai@hkdigiverse.com",
    phone: "+91 98765 43214",
    joinDate: "2019-11-20",
    avatar: "https://i.pravatar.cc/150?u=ananya",
    performanceScore: 94
  },
  {
    id: "EMP-006",
    name: "Rahul Verma",
    role: "Product Manager",
    department: "Product",
    status: "Active",
    email: "rahul.verma@hkdigiverse.com",
    phone: "+91 98765 43215",
    joinDate: "2021-06-05",
    avatar: "https://i.pravatar.cc/150?u=rahul",
    performanceScore: 91
  },
  {
    id: "EMP-007",
    name: "Priya Sharma",
    role: "Marketing Specialist",
    department: "Marketing",
    status: "Remote",
    email: "priya.sharma@hkdigiverse.com",
    phone: "+91 98765 43216",
    joinDate: "2022-03-15",
    avatar: "https://i.pravatar.cc/150?u=priya",
    performanceScore: 86
  },
  {
    id: "EMP-008",
    name: "Karan Patel",
    role: "QA Engineer",
    department: "Development",
    status: "On Leave",
    email: "karan.patel@hkdigiverse.com",
    phone: "+91 98765 43217",
    joinDate: "2023-05-12",
    avatar: "https://i.pravatar.cc/150?u=karan",
    performanceScore: 82
  },
  {
    id: "EMP-009",
    name: "Sneha Reddy",
    role: "Account Executive",
    department: "Sales",
    status: "Active",
    email: "sneha.reddy@hkdigiverse.com",
    phone: "+91 98765 43218",
    joinDate: "2022-11-01",
    avatar: "https://i.pravatar.cc/150?u=sneha",
    performanceScore: 89
  },
  {
    id: "EMP-010",
    name: "Dev Trivedi",
    role: "Creative Director",
    department: "Creative",
    status: "Active",
    email: "dev.trivedi@hkdigiverse.com",
    phone: "+91 98765 43219",
    joinDate: "2018-09-25",
    avatar: "https://i.pravatar.cc/150?u=dev",
    performanceScore: 97
  },
  {
    id: "EMP-011",
    name: "Siddharth Rao",
    role: "Financial Analyst",
    department: "Finance",
    status: "Active",
    email: "siddharth.rao@hkdigiverse.com",
    phone: "+91 98765 43220",
    joinDate: "2020-07-14",
    avatar: "https://i.pravatar.cc/150?u=siddharth",
    performanceScore: 93
  },
  {
    id: "EMP-012",
    name: "Kavya Iyer",
    role: "Content Writer",
    department: "Marketing",
    status: "Remote",
    email: "kavya.iyer@hkdigiverse.com",
    phone: "+91 98765 43221",
    joinDate: "2023-02-28",
    avatar: "https://i.pravatar.cc/150?u=kavya",
    performanceScore: 85
  }
];
