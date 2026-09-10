import { useState, useEffect } from "react";
import { User, Briefcase, FileText, Check, ChevronRight, Upload, X, MapPin, Phone, Mail, Building2, CreditCard, ShieldAlert } from "lucide-react";
import { DialogClose,  Dialog, DialogContent  } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/select";
import { Employee, EmployeeStatus } from "./employee-data";
import { useDepartments } from "./DepartmentContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface EmployeeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (employee: Partial<Employee>) => void;
  initialData?: Employee | null;
  isSelfEdit?: boolean;
}

type TabType = 'personal' | 'work' | 'bank' | 'offboarding';

const calculateResignationDate = (startDateStr: string, daysCountStr: string) => {
  if (!startDateStr || !daysCountStr) return '';
  const daysCount = parseInt(daysCountStr);
  if (isNaN(daysCount) || daysCount <= 0) return '';

  const parts = startDateStr.split('-');
  if (parts.length !== 3) return '';
  
  let currentDate = new Date(parseInt(parts[0] || '0'), parseInt(parts[1] || '1') - 1, parseInt(parts[2] || '1'));
  let daysAdded = 0;
  
  while (daysAdded < daysCount) {
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek !== 0) { // 0 is Sunday
      daysAdded++;
    }
    if (daysAdded < daysCount) {
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }
  
  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, '0');
  const day = String(currentDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const REQUIRED_DOCUMENTS_LIST = [
  "10th Marksheet",
  "12th Marksheet",
  "Degree Certificate",
  "Aadhar Card",
  "PAN Card",
  "Experience Letter",
  "Relieving Letter",
  "3 Months Payslip",
  "Passport Size Photo",
  "Bank Passbook / Cancelled Cheque"
];

export function EmployeeFormModal({ isOpen, onClose, onSubmit, initialData, isSelfEdit }: EmployeeFormModalProps) {
  const { departments } = useDepartments();
  const [activeTab, setActiveTab] = useState<TabType>('personal');
  
  const [formData, setFormData] = useState<Partial<Employee>>({
    name: "",
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    phone: "",
    dob: "",
    gender: "Male",
    parentName: "",
    parentNumber: "",
    relation: "",
    
    role: "Employee",
    department: "Development",
    sub_department: "",
    designation: "",
    status: "Active",
    workMode: "WFO",
    joinDate: new Date().toISOString().split("T")[0] || "",
    startTime: "09:30",
    endTime: "18:30",
    salary: "",
    
    upiId: "",
    accountNumber: "",
    ifscCode: "",
    bankName: "",
    accountHolderName: "",
    aadharCard: "",
    panCard: "",
    
    hasBond: false,
    bondStartDate: "",
    bondEndDate: "",
    hasNoticePeriod: false,
    noticePeriodDays: "",
    noticePeriodStartDate: "",
    hasResignation: false,
    resignationDate: "",
    hasEmployment: false,
    employmentStartDate: "",
    activelyUsingHRMS: true
  });

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({
        name: "",
        firstName: "",
        middleName: "",
        lastName: "",
        email: "",
        phone: "",
        dob: "",
        gender: "Male",
        parentName: "",
        parentNumber: "",
        relation: "",
        
        role: "Employee",
        department: "Development",
        sub_department: "",
        designation: "",
        status: "Active",
        workMode: "WFO",
        joinDate: new Date().toISOString().split("T")[0] || "",
        startTime: "09:30",
        endTime: "18:30",
        salary: "",
        
        upiId: "",
        accountNumber: "",
        ifscCode: "",
        bankName: "",
        accountHolderName: "",
        aadharCard: "",
        panCard: "",
        
        hasBond: false,
        bondStartDate: "",
        bondEndDate: "",
        hasNoticePeriod: false,
        noticePeriodDays: "",
        noticePeriodStartDate: "",
        hasResignation: false,
        resignationDate: "",
        hasEmployment: false,
        employmentStartDate: "",
        activelyUsingHRMS: true,
        requiredDocuments: []
      });
    }
  }, [initialData, isOpen]);

  // Handle derived names
  useEffect(() => {
    const fullName = [formData.firstName, formData.middleName, formData.lastName].filter(Boolean).join(" ");
    if (fullName !== formData.name) {
      setFormData(prev => ({ ...prev, name: fullName }));
    }
  }, [formData.firstName, formData.middleName, formData.lastName]);
  
  // Handle notice period calculation
  useEffect(() => {
    if (formData.hasNoticePeriod && formData.noticePeriodStartDate && formData.noticePeriodDays) {
      const calculatedDate = calculateResignationDate(formData.noticePeriodStartDate, formData.noticePeriodDays);
      if (calculatedDate && calculatedDate !== formData.resignationDate) {
        setFormData(prev => ({ ...prev, resignationDate: calculatedDate, hasResignation: true }));
      }
    }
  }, [formData.hasNoticePeriod, formData.noticePeriodStartDate, formData.noticePeriodDays]);
  
  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fullName = formData.name || `${formData.firstName || ''} ${formData.lastName || ''}`.trim();
    if (!fullName || !formData.email || !formData.role || !formData.phone) {
      toast.error("Please fill in all required fields (Name, Email, Phone, System Role).");
      return;
    }
    onSubmit({ ...formData, name: fullName });
    onClose();
  };

  const handleInputChange = (field: keyof Employee, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const tabs = [
    { id: 'personal', label: 'Personal Info', icon: User },
    { id: 'work', label: 'Work Details', icon: Briefcase },
    { id: 'bank', label: 'Bank & Docs', icon: CreditCard },
    { id: 'offboarding', label: 'Bonds & Exit', icon: FileText }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-border/50 bg-muted/30">
          <div>
            <h2 className="text-2xl font-black tracking-tight">{initialData ? 'Edit Employee Profile' : 'Add New Employee'}</h2>
            <p className="text-sm text-muted-foreground mt-1">Complete all sections to register a new member in the organization.</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

          <div className="flex flex-col md:flex-row h-[70vh] max-h-[800px]">
            {/* Sidebar Tabs */}
            <div className="w-full md:w-64 bg-muted/20 border-r border-border/50 p-4 space-y-2 overflow-y-auto shrink-0">
              {tabs.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as TabType)}
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
              <form id="employee-form" onSubmit={handleSubmit} className="space-y-8">
                
                {/* 1. PERSONAL INFO */}
                <div className={cn("space-y-6 animate-in fade-in slide-in-from-right-4 duration-300", activeTab === 'personal' ? 'block' : 'hidden')}>
                  <div className="pb-4 border-b border-border/50">
                    <h3 className="text-lg font-black">Personal Information</h3>
                    <p className="text-sm text-muted-foreground">Basic identity and contact details.</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">First Name *</label>
                      <input 
                        type="text" value={formData.firstName || ''} onChange={(e) => handleInputChange('firstName', e.target.value)}
                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                        placeholder="John"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Middle Name</label>
                      <input 
                        type="text" value={formData.middleName || ''} onChange={(e) => handleInputChange('middleName', e.target.value)}
                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                        placeholder="M"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Last Name *</label>
                      <input 
                        type="text" value={formData.lastName || ''} onChange={(e) => handleInputChange('lastName', e.target.value)}
                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                        placeholder="Doe"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Email Address *</label>
                      <input 
                        type="email" value={formData.email || ''} onChange={(e) => handleInputChange('email', e.target.value)}
                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                        placeholder="john@example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Phone Number *</label>
                      <input 
                        type="tel" value={formData.phone || ''} onChange={(e) => handleInputChange('phone', e.target.value)}
                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                        placeholder="+1 234 567 890"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Date of Birth</label>
                      <input 
                        type="date" value={formData.dob || ''} onChange={(e) => handleInputChange('dob', e.target.value)}
                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Gender</label>
                      <SearchableSelect 
                        value={formData.gender || ''} onChange={(val) => handleInputChange('gender', val)}
                        options={[
                          { label: 'Male', value: 'Male' },
                          { label: 'Female', value: 'Female' },
                          { label: 'Other', value: 'Other' }
                        ]}
                        className="w-full px-4 h-[42px] bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                      />
                    </div>

                    <div className="space-y-2 col-span-1 md:col-span-2">
                      <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Password</label>
                      <input 
                        type="password" value={formData.password || ''} onChange={(e) => handleInputChange('password', e.target.value)}
                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                        placeholder={initialData ? "Leave blank to keep current" : "Set login password"}
                      />
                    </div>
                  </div>

                  <div className="pt-6 border-t border-border/50 space-y-6">
                    <h4 className="text-sm font-bold">Emergency Contact / Parent</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Parent/Guardian Name</label>
                        <input 
                          type="text" value={formData.parentName || ''} onChange={(e) => handleInputChange('parentName', e.target.value)}
                          className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Contact Number</label>
                        <input 
                          type="tel" value={formData.parentNumber || ''} onChange={(e) => handleInputChange('parentNumber', e.target.value)}
                          className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Relation</label>
                        <SearchableSelect 
                          value={formData.relation || ''} 
                          onChange={(val) => handleInputChange('relation', val)}
                          options={[
                            { label: "Father", value: "Father" },
                            { label: "Mother", value: "Mother" },
                            { label: "Spouse", value: "Spouse" },
                            { label: "Sibling", value: "Sibling" },
                            { label: "Other", value: "Other" }
                          ]}
                          placeholder="Select Relation"
                          className="w-full h-[42px] px-4 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. WORK DETAILS */}
                <div className={cn("space-y-6 animate-in fade-in slide-in-from-right-4 duration-300", activeTab === 'work' ? 'block' : 'hidden')}>
                  <div className="pb-4 border-b border-border/50 flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-black">Work & Organization</h3>
                      <p className="text-sm text-muted-foreground">Roles, scheduling, and placement.</p>
                    </div>
                    {isSelfEdit && <span className="bg-muted px-3 py-1 rounded-lg text-xs font-bold text-muted-foreground">Read Only</span>}
                  </div>
                  
                  <fieldset disabled={isSelfEdit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">System Role *</label>
                      <SearchableSelect 
                        value={formData.role || ''} onChange={(val) => handleInputChange('role', val)}
                        options={[
                          { label: 'Employee', value: 'Employee' },
                          { label: 'Manager', value: 'Manager' },
                          { label: 'Admin', value: 'Admin' }
                        ]}
                        className="w-full px-4 h-[42px] bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Department *</label>
                      <SearchableSelect 
                        value={formData.department || ''} onChange={(val) => handleInputChange('department', val)}
                        options={departments.map(dept => ({ label: dept, value: dept }))}
                        className="w-full px-4 h-[42px] bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Sub-Department</label>
                      <input 
                        type="text" value={formData.sub_department || ''} onChange={(e) => handleInputChange('sub_department', e.target.value)}
                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                        placeholder="e.g. Frontend"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Designation / Title</label>
                      <input 
                        type="text" value={formData.designation || ''} onChange={(e) => handleInputChange('designation', e.target.value)}
                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                        placeholder="e.g. Senior Developer"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Status</label>
                      <SearchableSelect 
                        value={formData.status || 'Active'} onChange={(val) => handleInputChange('status', val as EmployeeStatus)}
                        options={[
                          { label: 'Active', value: 'Active' },
                          { label: 'Remote', value: 'Remote' },
                          { label: 'Inactive', value: 'Inactive' }
                        ]}
                        className="w-full px-4 h-[42px] bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Work Mode</label>
                      <SearchableSelect 
                        value={formData.workMode || 'WFO'} onChange={(val) => handleInputChange('workMode', val)}
                        options={[
                          { label: 'Work From Office', value: 'WFO' },
                          { label: 'Work From Home', value: 'WFH' },
                          { label: 'Hybrid', value: 'Hybrid' }
                        ]}
                        className="w-full px-4 h-[42px] bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-border/50">
                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Joining Date</label>
                      <input 
                        type="date" value={formData.joinDate || ''} onChange={(e) => handleInputChange('joinDate', e.target.value)}
                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Start Time</label>
                      <input 
                        type="time" value={formData.startTime || '09:30'} onChange={(e) => handleInputChange('startTime', e.target.value)}
                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">End Time</label>
                      <input 
                        type="time" value={formData.endTime || '18:30'} onChange={(e) => handleInputChange('endTime', e.target.value)}
                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                      />
                    </div>
                    </div>
                  </fieldset>
                </div>

                {/* 3. BANK & DOCS */}
                <div className={cn("space-y-6 animate-in fade-in slide-in-from-right-4 duration-300", activeTab === 'bank' ? 'block' : 'hidden')}>
                  <div className="pb-4 border-b border-border/50">
                    <h3 className="text-lg font-black">Financial & Documents</h3>
                    <p className="text-sm text-muted-foreground">Salary, banking details, and IDs.</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Monthly Salary</label>
                      <input 
                        type="number" disabled={isSelfEdit} value={formData.salary || ''} onChange={(e) => handleInputChange('salary', e.target.value)}
                        className={cn("w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all", isSelfEdit && "opacity-60 cursor-not-allowed")}
                        placeholder="e.g. 50000"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">UPI ID</label>
                      <input 
                        type="text" value={formData.upiId || ''} onChange={(e) => handleInputChange('upiId', e.target.value)}
                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                        placeholder="example@upi"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-border/50">
                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Bank Name</label>
                      <input 
                        type="text" value={formData.bankName || ''} onChange={(e) => handleInputChange('bankName', e.target.value)}
                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Account Holder Name</label>
                      <input 
                        type="text" value={formData.accountHolderName || ''} onChange={(e) => handleInputChange('accountHolderName', e.target.value)}
                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Account Number</label>
                      <input 
                        type="text" value={formData.accountNumber || ''} onChange={(e) => handleInputChange('accountNumber', e.target.value)}
                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">IFSC Code</label>
                      <input 
                        type="text" value={formData.ifscCode || ''} onChange={(e) => handleInputChange('ifscCode', e.target.value)}
                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all uppercase"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-border/50">
                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Aadhar Card Number</label>
                      <input 
                        type="text" value={formData.aadharCard || ''} onChange={(e) => handleInputChange('aadharCard', e.target.value)}
                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                        placeholder="1234 5678 9012"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">PAN Card Number</label>
                      <input 
                        type="text" value={formData.panCard || ''} onChange={(e) => handleInputChange('panCard', e.target.value)}
                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all uppercase"
                        placeholder="ABCDE1234F"
                      />
                    </div>
                  </div>

                  <div className="pt-6 border-t border-border/50">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-sm font-bold">Required Documents Checklist</h4>
                      {isSelfEdit && <span className="bg-muted px-3 py-1 rounded-lg text-xs font-bold text-muted-foreground">Read Only</span>}
                    </div>
                    <fieldset disabled={isSelfEdit} className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/20 p-5 rounded-2xl border border-border/50">
                      {REQUIRED_DOCUMENTS_LIST.map((docName) => {
                        const isChecked = formData.requiredDocuments?.includes(docName) || false;
                        return (
                          <label key={docName} className="flex items-center gap-3 cursor-pointer group">
                            <input 
                              type="checkbox" 
                              checked={isChecked}
                              onChange={(e) => {
                                const currentDocs = formData.requiredDocuments || [];
                                if (e.target.checked) {
                                  handleInputChange('requiredDocuments', [...currentDocs, docName]);
                                } else {
                                  handleInputChange('requiredDocuments', currentDocs.filter((d) => d !== docName));
                                }
                              }}
                              className="w-4 h-4 rounded border-border text-primary focus:ring-primary accent-primary"
                            />
                            <span className="text-sm text-foreground/80 group-hover:text-foreground transition-colors">{docName}</span>
                          </label>
                        );
                      })}
                    </fieldset>
                  </div>
                </div>

                {/* 4. BONDS & EXIT */}
                <div className={cn("space-y-8 animate-in fade-in slide-in-from-right-4 duration-300", activeTab === 'offboarding' ? 'block' : 'hidden')}>
                  <div className="pb-4 border-b border-border/50 flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-black">Bonds, Contracts & Exit</h3>
                      <p className="text-sm text-muted-foreground">Manage legal and timeline obligations.</p>
                    </div>
                    {isSelfEdit && <span className="bg-muted px-3 py-1 rounded-lg text-xs font-bold text-muted-foreground">Read Only</span>}
                  </div>
                  
                  <fieldset disabled={isSelfEdit} className="space-y-8">
                    {/* Bonds */}
                    <div className="p-5 rounded-2xl border border-border/60 bg-muted/30 space-y-5">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={formData.hasBond || false}
                        onChange={(e) => handleInputChange('hasBond', e.target.checked)}
                        className="w-5 h-5 rounded border-border text-primary focus:ring-primary accent-primary"
                      />
                      <span className="font-bold">Employee has an active bond</span>
                    </label>

                    {formData.hasBond && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in zoom-in-95 duration-200 pt-2 border-t border-border/50">
                        <div className="space-y-2">
                          <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Bond Start Date</label>
                          <input 
                            type="date" value={formData.bondStartDate || ''} onChange={(e) => handleInputChange('bondStartDate', e.target.value)}
                            className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Bond End Date</label>
                          <input 
                            type="date" value={formData.bondEndDate || ''} onChange={(e) => handleInputChange('bondEndDate', e.target.value)}
                            className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Notice Period */}
                  <div className="p-5 rounded-2xl border border-border/60 bg-muted/30 space-y-5">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={formData.hasNoticePeriod || false}
                        onChange={(e) => {
                          handleInputChange('hasNoticePeriod', e.target.checked);
                          if(e.target.checked) handleInputChange('hasResignation', true);
                          else handleInputChange('hasResignation', false);
                        }}
                        className="w-5 h-5 rounded border-border text-primary focus:ring-primary accent-primary"
                      />
                      <span className="font-bold">Serving Notice Period</span>
                    </label>

                    {formData.hasNoticePeriod && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in zoom-in-95 duration-200 pt-2 border-t border-border/50">
                        <div className="space-y-2">
                          <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Notice Period Days</label>
                          <input 
                            type="number" value={formData.noticePeriodDays || ''} 
                            onChange={(e) => {
                              handleInputChange('noticePeriodDays', e.target.value);
                            }}
                            className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Notice Start Date</label>
                          <input 
                            type="date" value={formData.noticePeriodStartDate || ''} 
                            onChange={(e) => {
                              handleInputChange('noticePeriodStartDate', e.target.value);
                            }}
                            className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Resignation / Exit */}
                  <div className="p-5 rounded-2xl border border-border/60 bg-muted/30 space-y-5">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={formData.hasResignation || false}
                        onChange={(e) => handleInputChange('hasResignation', e.target.checked)}
                        className="w-5 h-5 rounded border-border text-primary focus:ring-primary accent-primary"
                      />
                      <span className="font-bold">Has Resigned</span>
                    </label>

                    {formData.hasResignation && (
                      <div className="animate-in fade-in zoom-in-95 duration-200 pt-2 border-t border-border/50">
                        <div className="space-y-2">
                          <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Calculated Exit Date</label>
                          <input 
                            type="date" value={formData.resignationDate || ''} onChange={(e) => handleInputChange('resignationDate', e.target.value)}
                            className="w-full md:w-1/2 px-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                          />
                          <p className="text-xs text-muted-foreground mt-1">If notice period is provided, this date should be calculated automatically.</p>
                        </div>
                      </div>
                    )}
                  </div>
                  </fieldset>

                </div>

              </form>
            </div>
          </div>
          
          {/* Footer Actions */}
          <div className="p-6 border-t border-border/50 bg-muted/30 flex items-center justify-between">
            <div className="text-sm text-muted-foreground hidden sm:block">
              Tip: Navigate between sections using the tabs on the left.
            </div>
            <div className="flex gap-3 ml-auto">
              <button 
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 text-sm font-bold text-foreground/80 hover:bg-muted rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit"
                form="employee-form"
                className="px-6 py-2.5 text-sm font-bold text-primary-foreground bg-primary hover:bg-primary/90 rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                {initialData ? 'Save Changes' : 'Create Employee'}
              </button>
            </div>
          </div>
      </DialogContent>
    </Dialog>
  );
}
