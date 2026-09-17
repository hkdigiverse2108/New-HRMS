import { useState, useEffect } from "react";
import { User, Briefcase, FileText, Check, ChevronRight, Upload, X, MapPin, Phone, Mail, Building2, CreditCard, ShieldAlert, AlertCircle, Lock } from "lucide-react";
import { DialogClose,  Dialog, DialogContent  } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/select";
import { Employee, EmployeeStatus } from "./employee-data";
import { useDepartments } from "./DepartmentContext";
import { toast } from "react-toastify";
import { cn } from "@/lib/utils";
import { getAvatarUrl, API_URL } from "@/lib/config";
import { api } from "@/lib/api";
import { Camera, Loader2, Image as ImageIcon, FolderOpen } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { PasswordInput } from "@/components/ui/password-input";

interface EmployeeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (employee: Partial<Employee>) => Promise<boolean | void> | void;
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

interface EmployeeFormErrors {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  password?: string;
  role?: string;
  department?: string;
  bankName?: string;
  accountHolderName?: string;
  accountNumber?: string;
  ifscCode?: string;
}

export function EmployeeFormModal({ isOpen, onClose, onSubmit, initialData, isSelfEdit }: EmployeeFormModalProps) {
  const { departments } = useDepartments();
  const [activeTab, setActiveTab] = useState<TabType>('personal');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [galleryImages, setGalleryImages] = useState<Array<{ filename: string; url: string; folder: string }>>([]);
  const [isLoadingGallery, setIsLoadingGallery] = useState(false);
  const [errors, setErrors] = useState<EmployeeFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    avatar: "",
    profile_photo: "",
    
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

  const [subDepartments, setSubDepartments] = useState<string[]>([]);
  const [allDesignations, setAllDesignations] = useState<string[]>([]);
  const [isLoadingSubDepts, setIsLoadingSubDepts] = useState(false);
  const [isLoadingDesignations, setIsLoadingDesignations] = useState(false);

  // Fetch all designations once on modal open
  useEffect(() => {
    if (isOpen) {
      const fetchDesignations = async () => {
        setIsLoadingDesignations(true);
        try {
          const res = await api.get<any>("/designations", { showErrorToast: false });
          const raw = res?.data || res?.items || (Array.isArray(res) ? res : []);
          const names = raw.map((d: any) => typeof d === 'string' ? d : d.name).filter(Boolean);
          if (names.length > 0) {
            setAllDesignations(names);
          }
        } catch (err) {
          console.warn("Failed to fetch designations", err);
        } finally {
          setIsLoadingDesignations(false);
        }
      };
      fetchDesignations();
    }
  }, [isOpen]);

  // Fetch sub-departments dynamically when department changes
  useEffect(() => {
    if (isOpen && formData.department) {
      const fetchSubDepartments = async (dept: string) => {
        setIsLoadingSubDepts(true);
        try {
          const res = await api.get<any>(`/sub-departments/department/${encodeURIComponent(dept)}`, { showErrorToast: false });
          const raw = res?.data || res?.items || (Array.isArray(res) ? res : []);
          let names = raw.map((s: any) => typeof s === 'string' ? s : s.name).filter(Boolean);
          if (names.length === 0) {
            const allRes = await api.get<any>("/sub-departments", { showErrorToast: false });
            const allRaw = allRes?.data || allRes?.items || (Array.isArray(allRes) ? allRes : []);
            names = allRaw.map((s: any) => typeof s === 'string' ? s : s.name).filter(Boolean);
          }
          setSubDepartments(names);
        } catch (err) {
          console.warn("Failed to fetch sub-departments", err);
          setSubDepartments([]);
        } finally {
          setIsLoadingSubDepts(false);
        }
      };
      fetchSubDepartments(formData.department);
    }
  }, [isOpen, formData.department]);

  useEffect(() => {
    setErrors({});
    setIsSubmitting(false);
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
  
  const validateForm = () => {
    const newErrors: EmployeeFormErrors = {};

    // 1. First Name *
    const cleanFirstName = (formData.firstName || "").trim();
    if (!cleanFirstName) {
      newErrors.firstName = "First Name is required.";
    }

    // 2. Middle Name *
    const cleanMiddleName = (formData.middleName || "").trim();
    if (!cleanMiddleName) {
      newErrors.middleName = "Middle Name is required.";
    }

    // 3. Last Name *
    const cleanLastName = (formData.lastName || "").trim();
    if (!cleanLastName) {
      newErrors.lastName = "Last Name is required.";
    }

    // 4. Email Address *
    const cleanEmail = (formData.email || "").trim();
    if (!cleanEmail) {
      newErrors.email = "Email Address is required.";
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        newErrors.email = "Please enter a valid email address.";
      }
    }

    // 5. Phone Number *
    const cleanPhone = (formData.phone || "").trim();
    if (!cleanPhone) {
      newErrors.phone = "Phone Number is required.";
    } else {
      const digits = cleanPhone.replace(/\D/g, "");
      if (digits.length < 7) {
        newErrors.phone = "Please enter a valid phone number (at least 7 digits).";
      }
    }

    // 6. Password * (Required for new employee)
    const cleanPassword = (formData.password || "").trim();
    if (!initialData && !cleanPassword) {
      newErrors.password = "Password is required.";
    } else if (cleanPassword && cleanPassword.length < 6) {
      newErrors.password = "Password must be at least 6 characters.";
    }

    // 7. System Role *
    const cleanRole = (formData.role || "").trim();
    if (!cleanRole) {
      newErrors.role = "System Role is required.";
    }

    // 8. Department *
    const cleanDept = (formData.department || "").trim();
    if (!cleanDept) {
      newErrors.department = "Department is required.";
    }

    // 9. Bank Name *
    const cleanBankName = (formData.bankName || "").trim();
    if (!cleanBankName) {
      newErrors.bankName = "Bank Name is required.";
    }

    // 10. Account Holder Name *
    const cleanAccountHolderName = (formData.accountHolderName || "").trim();
    if (!cleanAccountHolderName) {
      newErrors.accountHolderName = "Account Holder Name is required.";
    }

    // 11. Account Number *
    const cleanAccountNumber = (formData.accountNumber || "").trim();
    if (!cleanAccountNumber) {
      newErrors.accountNumber = "Account Number is required.";
    }

    // 12. IFSC Code *
    const cleanIfscCode = (formData.ifscCode || "").trim();
    if (!cleanIfscCode) {
      newErrors.ifscCode = "IFSC Code is required.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      // Automatically jump to the tab containing the first error
      if (newErrors.firstName || newErrors.middleName || newErrors.lastName || newErrors.email || newErrors.phone || newErrors.password) {
        setActiveTab('personal');
      } else if (newErrors.role || newErrors.department) {
        setActiveTab('work');
      } else if (newErrors.bankName || newErrors.accountHolderName || newErrors.accountNumber || newErrors.ifscCode) {
        setActiveTab('bank');
      }
      toast.error("Please fill in all required fields marked with * across Personal Info, Work Details, and Bank & Docs.");
      return false;
    }

    setErrors({});
    return true;
  };

  const isFormValid = Boolean(
    // 1. Personal Info
    (formData.firstName || "").trim() &&
    (formData.middleName || "").trim() &&
    (formData.lastName || "").trim() &&
    (formData.email || "").trim() &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((formData.email || "").trim()) &&
    (formData.phone || "").trim().replace(/\D/g, "").length >= 7 &&
    (initialData ? true : (formData.password || "").trim().length >= 6) &&
    // 2. Work Details
    (formData.role || "").trim() &&
    (formData.department || "").trim() &&
    // 3. Bank & Docs
    (formData.bankName || "").trim() &&
    (formData.accountHolderName || "").trim() &&
    (formData.accountNumber || "").trim() &&
    (formData.ifscCode || "").trim()
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const fullName = `${(formData.firstName || "").trim()} ${(formData.lastName || "").trim()}`.trim() || formData.name || "";
    const cleanPayload: Partial<Employee> = {
      ...formData,
      name: fullName,
      firstName: (formData.firstName || "").trim(),
      middleName: (formData.middleName || "").trim(),
      lastName: (formData.lastName || "").trim(),
      email: (formData.email || "").trim(),
      phone: (formData.phone || "").trim(),
      role: formData.role || "Employee",
      department: formData.department || "Development",
    };

    try {
      setIsSubmitting(true);
      const res = await onSubmit(cleanPayload);
      if (res === false) {
        return;
      }
      onClose();
    } catch (err: any) {
      const msg = err?.message || "Failed to save employee.";
      // Error toast is displayed automatically by the centralized api.ts client
      if (msg.toLowerCase().includes("email")) {
        setErrors(prev => ({ ...prev, email: msg }));
        setActiveTab('personal');
      } else if (msg.toLowerCase().includes("phone") || msg.toLowerCase().includes("mobile")) {
        setErrors(prev => ({ ...prev, phone: msg }));
        setActiveTab('personal');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof Employee, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    const errorKey = field as keyof EmployeeFormErrors;
    if (errors[errorKey]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[errorKey];
        return next;
      });
    }
  };

  const fetchGallery = async () => {
    try {
      setIsLoadingGallery(true);
      const images = await api.listImages("employee");
      setGalleryImages(images);
    } catch (err) {
      console.error("Failed to load gallery images:", err);
    } finally {
      setIsLoadingGallery(false);
    }
  };

  const handleOpenGallery = () => {
    setShowGallery(true);
    fetchGallery();
  };

  const handleImageUpload = async (file: File) => {
    if (!file) return;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Please select a valid image (JPG, PNG, WebP, GIF, SVG).");
      return;
    }

    try {
      setIsUploadingPhoto(true);
      const result = await api.uploadImage(file, "employee");
      const photoUrl = result.url;
      setFormData(prev => ({
        ...prev,
        avatar: photoUrl,
        profile_photo: photoUrl
      }));
      toast.success("Profile photo uploaded to employee folder successfully!");
      if (showGallery) fetchGallery();
    } catch (err: any) {
      // Toast is handled automatically by common api client
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const tabs = [
    { id: 'personal', label: 'Personal Info', icon: User },
    { id: 'work', label: 'Work Details', icon: Briefcase },
    { id: 'bank', label: 'Bank & Docs', icon: CreditCard },
    { id: 'offboarding', label: 'Bonds & Exit', icon: FileText }
  ];

  return (
    <>
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100vw-16px)] sm:w-full max-w-5xl p-0 overflow-hidden rounded-2xl sm:rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card h-[92dvh] sm:h-[85vh] max-h-[850px] flex flex-col">
        {/* Header - Fixed Height */}
        <div className="flex items-center justify-between px-4 sm:px-8 py-3.5 sm:py-5 border-b border-border/50 bg-muted/30 shrink-0">
          <div className="min-w-0 pr-2">
            <h2 className="text-base sm:text-2xl font-black tracking-tight truncate">{initialData ? 'Edit Employee Profile' : 'Add New Employee'}</h2>
            <p className="text-[11px] sm:text-sm text-muted-foreground mt-0.5 line-clamp-1 sm:line-clamp-none">Complete all sections to register a new member in the organization.</p>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 sm:p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Middle Body - Flex 1, Scrolls Internally */}
        <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">
          {/* Mobile Tabs: 2x2 Grid (All 4 tabs 100% visible, never cut off!) */}
          <div className="grid grid-cols-2 gap-1.5 p-2 bg-muted/20 border-b border-border/50 shrink-0 md:hidden">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const hasError = (tab.id === 'personal' && (errors.firstName || errors.middleName || errors.lastName || errors.email || errors.phone || errors.password)) ||
                               (tab.id === 'work' && (errors.role || errors.department)) ||
                               (tab.id === 'bank' && (errors.bankName || errors.accountHolderName || errors.accountNumber || errors.ifscCode));
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={cn(
                    "flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-bold transition-all text-center relative",
                    isActive 
                      ? "bg-primary text-primary-foreground shadow-sm" 
                      : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground border border-border/60",
                    hasError && !isActive && "border-destructive/60 text-destructive"
                  )}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{tab.label}</span>
                  {hasError && (
                    <span className="w-2 h-2 rounded-full bg-destructive shrink-0 animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Desktop/Tablet Sidebar Tabs */}
          <div className="hidden md:flex md:w-64 bg-muted/20 border-r border-border/50 p-4 flex-col gap-2 overflow-y-auto shrink-0">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const hasError = (tab.id === 'personal' && (errors.firstName || errors.middleName || errors.lastName || errors.email || errors.phone || errors.password)) ||
                               (tab.id === 'work' && (errors.role || errors.department)) ||
                               (tab.id === 'bank' && (errors.bankName || errors.accountHolderName || errors.accountNumber || errors.ifscCode));
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all w-full text-left relative",
                    isActive 
                      ? "bg-primary text-primary-foreground shadow-md" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    hasError && !isActive && "text-destructive hover:bg-destructive/10"
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{tab.label}</span>
                  {hasError && (
                    <span className="w-2 h-2 rounded-full bg-destructive shrink-0 ml-auto mr-1 animate-pulse" />
                  )}
                  {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
                </button>
              );
            })}
          </div>

            {/* Form Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 relative">
              <form id="employee-form" onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
                
                {/* 1. PERSONAL INFO */}
                <div className={cn("space-y-6 animate-in fade-in slide-in-from-right-4 duration-300", activeTab === 'personal' ? 'block' : 'hidden')}>
                  <div className="pb-4 border-b border-border/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-black">Personal Information</h3>
                      <p className="text-sm text-muted-foreground">Basic identity, profile photo, and contact details.</p>
                    </div>

                    {/* Photo Upload, Gallery Selector & Preview */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 bg-muted/30 p-2.5 sm:p-3 px-3 sm:px-4 rounded-2xl border border-border/50 w-full">
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="relative group w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden bg-muted border-2 border-border/80 flex items-center justify-center shrink-0 shadow-inner">
                          <img 
                            src={getAvatarUrl(formData.avatar || formData.profile_photo || '', formData.name || 'Employee')} 
                            alt="Employee"
                            className="w-full h-full object-cover"
                          />
                          {isUploadingPhoto && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                              <Loader2 className="w-5 h-5 text-white animate-spin" />
                            </div>
                          )}
                        </div>
                        <div className="sm:hidden flex flex-col">
                          <span className="text-xs font-bold text-foreground">Profile Photo</span>
                          <span className="text-[10px] text-muted-foreground">JPG, PNG, WebP</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5 min-w-0 flex-1 w-full sm:w-auto">
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-lg cursor-pointer transition-all shadow-sm">
                            <Camera className="w-3.5 h-3.5" />
                            <span>{isUploadingPhoto ? "Uploading..." : "Upload New"}</span>
                            <input 
                              type="file" 
                              accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                              className="hidden"
                              disabled={isUploadingPhoto}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleImageUpload(file);
                              }}
                            />
                          </label>

                          <button
                            type="button"
                            onClick={handleOpenGallery}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground text-xs font-bold rounded-lg border border-border/80 transition-all shadow-sm"
                          >
                            <FolderOpen className="w-3.5 h-3.5 text-primary" />
                            <span>Choose Existing</span>
                          </button>
                        </div>
                        <span className="text-[10px] text-muted-foreground hidden sm:block">Stored in root: /images/employee</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider flex items-center gap-1">
                        <span>First Name</span>
                        <span className="text-destructive font-black">*</span>
                      </label>
                      <input 
                        type="text" 
                        value={formData.firstName || ''} 
                        onChange={(e) => handleInputChange('firstName', e.target.value)}
                        className={cn(
                          "w-full px-4 py-2.5 bg-muted/50 border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all",
                          errors.firstName ? "border-destructive focus:ring-destructive/20 focus:border-destructive" : "border-border focus:ring-primary/20 focus:border-primary/50"
                        )}
                        placeholder="John"
                      />
                      {errors.firstName && (
                        <p className="text-[11px] font-semibold text-destructive mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{errors.firstName}</span>
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider flex items-center gap-1">
                        <span>Middle Name</span>
                        <span className="text-destructive font-black">*</span>
                      </label>
                      <input 
                        type="text" 
                        value={formData.middleName || ''} 
                        onChange={(e) => handleInputChange('middleName', e.target.value)}
                        className={cn(
                          "w-full px-4 py-2.5 bg-muted/50 border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all",
                          errors.middleName ? "border-destructive focus:ring-destructive/20 focus:border-destructive" : "border-border focus:ring-primary/20 focus:border-primary/50"
                        )}
                        placeholder="M"
                      />
                      {errors.middleName && (
                        <p className="text-[11px] font-semibold text-destructive mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{errors.middleName}</span>
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider flex items-center gap-1">
                        <span>Last Name</span>
                        <span className="text-destructive font-black">*</span>
                      </label>
                      <input 
                        type="text" 
                        value={formData.lastName || ''} 
                        onChange={(e) => handleInputChange('lastName', e.target.value)}
                        className={cn(
                          "w-full px-4 py-2.5 bg-muted/50 border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all",
                          errors.lastName ? "border-destructive focus:ring-destructive/20 focus:border-destructive" : "border-border focus:ring-primary/20 focus:border-primary/50"
                        )}
                        placeholder="Doe"
                      />
                      {errors.lastName && (
                        <p className="text-[11px] font-semibold text-destructive mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{errors.lastName}</span>
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider flex items-center gap-1">
                        <span>Email Address</span>
                        <span className="text-destructive font-black">*</span>
                      </label>
                      <input 
                        type="email" 
                        value={formData.email || ''} 
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        className={cn(
                          "w-full px-4 py-2.5 bg-muted/50 border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all",
                          errors.email ? "border-destructive focus:ring-destructive/20 focus:border-destructive" : "border-border focus:ring-primary/20 focus:border-primary/50"
                        )}
                        placeholder="john@example.com"
                      />
                      {errors.email && (
                        <p className="text-[11px] font-semibold text-destructive mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{errors.email}</span>
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider flex items-center gap-1">
                        <span>Phone Number</span>
                        <span className="text-destructive font-black">*</span>
                      </label>
                      <input 
                        type="tel" 
                        value={formData.phone || ''} 
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        className={cn(
                          "w-full px-4 py-2.5 bg-muted/50 border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all",
                          errors.phone ? "border-destructive focus:ring-destructive/20 focus:border-destructive" : "border-border focus:ring-primary/20 focus:border-primary/50"
                        )}
                        placeholder="+1 234 567 890"
                      />
                      {errors.phone && (
                        <p className="text-[11px] font-semibold text-destructive mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{errors.phone}</span>
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Date of Birth</label>
                      <DatePicker 
                        value={formData.dob || ''} 
                        onChange={(val) => handleInputChange('dob', val)}
                        placeholder="Select date of birth"
                        fromYear={1940}
                        toYear={new Date().getFullYear()}
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
                      <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider flex items-center gap-1">
                        <span>Password</span>
                        {!initialData && <span className="text-destructive font-black">*</span>}
                      </label>
                      <PasswordInput 
                        disabled={isSelfEdit}
                        value={formData.password || ''} 
                        onChange={(e) => handleInputChange('password', e.target.value)}
                        placeholder={initialData ? "Leave blank to keep current" : "Set login password (min 6 characters) *"}
                        className={cn(
                          isSelfEdit && "opacity-60 cursor-not-allowed",
                          errors.password && "border-destructive focus:ring-destructive/20 focus:border-destructive"
                        )}
                      />
                      {errors.password && (
                        <p className="text-[11px] font-semibold text-destructive mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{errors.password}</span>
                        </p>
                      )}
                      {initialData && <p className="text-[11px] text-muted-foreground">Only enter a new password if you wish to reset it.</p>}
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
                      <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider flex items-center gap-1">
                        <span>System Role</span>
                        <span className="text-destructive font-black">*</span>
                      </label>
                      <SearchableSelect 
                        value={formData.role || ''} 
                        onChange={(val) => handleInputChange('role', val)}
                        options={[
                          { label: 'Employee', value: 'Employee' },
                          { label: 'Admin', value: 'Admin' }
                        ]}
                        className={cn(
                          "w-full px-4 h-[42px] bg-muted/50 border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all",
                          errors.role ? "border-destructive focus:ring-destructive/20 focus:border-destructive" : "border-border focus:ring-primary/20 focus:border-primary/50"
                        )}
                      />
                      {errors.role && (
                        <p className="text-[11px] font-semibold text-destructive mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{errors.role}</span>
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider flex items-center gap-1">
                        <span>Department</span>
                        <span className="text-destructive font-black">*</span>
                      </label>
                      <SearchableSelect 
                        value={formData.department || ''} 
                        onChange={(val) => {
                          handleInputChange('department', val);
                          handleInputChange('sub_department', '');
                        }}
                        options={departments.map(dept => ({ label: dept, value: dept }))}
                        className={cn(
                          "w-full px-4 h-[42px] bg-muted/50 border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all",
                          errors.department ? "border-destructive focus:ring-destructive/20 focus:border-destructive" : "border-border focus:ring-primary/20 focus:border-primary/50"
                        )}
                      />
                      {errors.department && (
                        <p className="text-[11px] font-semibold text-destructive mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{errors.department}</span>
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Sub-Department</label>
                      <SearchableSelect 
                        value={formData.sub_department || ''} 
                        onChange={(val) => handleInputChange('sub_department', val)}
                        options={Array.from(new Set([
                          ...(formData.sub_department ? [formData.sub_department] : []),
                          ...subDepartments
                        ])).map(s => ({ label: s, value: s }))}
                        placeholder={isLoadingSubDepts ? "Loading sub-departments..." : (subDepartments.length === 0 ? "Select or Add Sub-Department" : "Select Sub-Department")}
                        className="w-full px-4 h-[42px] bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Designation / Title</label>
                      <SearchableSelect 
                        value={formData.designation || ''} 
                        onChange={(val) => handleInputChange('designation', val)}
                        options={Array.from(new Set([
                          ...(formData.designation ? [formData.designation] : []),
                          ...allDesignations
                        ])).map(d => ({ label: d, value: d }))}
                        placeholder={isLoadingDesignations ? "Loading designations..." : "Select Designation / Title"}
                        className="w-full px-4 h-[42px] bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
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
                      <DatePicker 
                        value={formData.joinDate || ''} 
                        onChange={(val) => handleInputChange('joinDate', val)}
                        placeholder="Select joining date"
                        fromYear={2000}
                        toYear={2040}
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
                      <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider flex items-center gap-1">
                        <span>Bank Name</span>
                        <span className="text-destructive font-black">*</span>
                      </label>
                      <input 
                        type="text" 
                        value={formData.bankName || ''} 
                        onChange={(e) => handleInputChange('bankName', e.target.value)}
                        className={cn(
                          "w-full px-4 py-2.5 bg-muted/50 border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all",
                          errors.bankName ? "border-destructive focus:ring-destructive/20 focus:border-destructive" : "border-border focus:ring-primary/20 focus:border-primary/50"
                        )}
                        placeholder="e.g. State Bank of India"
                      />
                      {errors.bankName && (
                        <p className="text-[11px] font-semibold text-destructive mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{errors.bankName}</span>
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider flex items-center gap-1">
                        <span>Account Holder Name</span>
                        <span className="text-destructive font-black">*</span>
                      </label>
                      <input 
                        type="text" 
                        value={formData.accountHolderName || ''} 
                        onChange={(e) => handleInputChange('accountHolderName', e.target.value)}
                        className={cn(
                          "w-full px-4 py-2.5 bg-muted/50 border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all",
                          errors.accountHolderName ? "border-destructive focus:ring-destructive/20 focus:border-destructive" : "border-border focus:ring-primary/20 focus:border-primary/50"
                        )}
                        placeholder="Account holder's full name"
                      />
                      {errors.accountHolderName && (
                        <p className="text-[11px] font-semibold text-destructive mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{errors.accountHolderName}</span>
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider flex items-center gap-1">
                        <span>Account Number</span>
                        <span className="text-destructive font-black">*</span>
                      </label>
                      <input 
                        type="text" 
                        value={formData.accountNumber || ''} 
                        onChange={(e) => handleInputChange('accountNumber', e.target.value)}
                        className={cn(
                          "w-full px-4 py-2.5 bg-muted/50 border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all",
                          errors.accountNumber ? "border-destructive focus:ring-destructive/20 focus:border-destructive" : "border-border focus:ring-primary/20 focus:border-primary/50"
                        )}
                        placeholder="e.g. 123456789012"
                      />
                      {errors.accountNumber && (
                        <p className="text-[11px] font-semibold text-destructive mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{errors.accountNumber}</span>
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider flex items-center gap-1">
                        <span>IFSC Code</span>
                        <span className="text-destructive font-black">*</span>
                      </label>
                      <input 
                        type="text" 
                        value={formData.ifscCode || ''} 
                        onChange={(e) => handleInputChange('ifscCode', e.target.value.toUpperCase())}
                        className={cn(
                          "w-full px-4 py-2.5 bg-muted/50 border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all uppercase",
                          errors.ifscCode ? "border-destructive focus:ring-destructive/20 focus:border-destructive" : "border-border focus:ring-primary/20 focus:border-primary/50"
                        )}
                        placeholder="e.g. SBIN0001234"
                      />
                      {errors.ifscCode && (
                        <p className="text-[11px] font-semibold text-destructive mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{errors.ifscCode}</span>
                        </p>
                      )}
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
                          <DatePicker 
                            value={formData.bondStartDate || ''} 
                            onChange={(val) => handleInputChange('bondStartDate', val)}
                            placeholder="Select bond start date"
                            className="bg-background"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[12px] font-bold text-foreground/80 uppercase tracking-wider">Bond End Date</label>
                          <DatePicker 
                            value={formData.bondEndDate || ''} 
                            onChange={(val) => handleInputChange('bondEndDate', val)}
                            placeholder="Select bond end date"
                            className="bg-background"
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
                          <DatePicker 
                            value={formData.noticePeriodStartDate || ''} 
                            onChange={(val) => {
                              handleInputChange('noticePeriodStartDate', val);
                            }}
                            placeholder="Select notice start date"
                            className="bg-background"
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
                          <DatePicker 
                            value={formData.resignationDate || ''} 
                            onChange={(val) => handleInputChange('resignationDate', val)}
                            placeholder="Select exit date"
                            className="w-full md:w-1/2 bg-background"
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
          
          {/* Footer Actions - Fixed Height */}
          <div className="p-3 sm:p-5 border-t border-border/50 bg-muted/30 flex items-center justify-between shrink-0 gap-2">
            <div className="text-xs text-muted-foreground hidden md:block">
              Tip: Navigate between sections using the tabs on the left.
            </div>
            <div className="flex items-center gap-2 sm:gap-3 ml-auto w-full sm:w-auto justify-end">
              <button 
                type="button"
                onClick={onClose}
                className="px-3 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-foreground/80 hover:bg-muted rounded-xl transition-colors shrink-0"
              >
                Cancel
              </button>

              {/* Quick Mobile Next Button */}
              {activeTab === 'personal' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('work')}
                  className="md:hidden px-2.5 py-2 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 rounded-xl transition-colors shrink-0"
                >
                  Next: Work →
                </button>
              )}
              {activeTab === 'work' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('bank')}
                  className="md:hidden px-2.5 py-2 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 rounded-xl transition-colors shrink-0"
                >
                  Next: Bank →
                </button>
              )}
              {activeTab === 'bank' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('offboarding')}
                  className="md:hidden px-2.5 py-2 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 rounded-xl transition-colors shrink-0"
                >
                  Next: Exit →
                </button>
              )}

              {isFormValid ? (
                <button 
                  type="submit"
                  form="employee-form"
                  disabled={isSubmitting}
                  className="px-3.5 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-primary-foreground bg-primary hover:bg-primary/90 rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1.5 sm:gap-2 shrink-0 whitespace-nowrap cursor-pointer disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{initialData ? 'Saving...' : 'Creating...'}</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{initialData ? 'Save Changes' : 'Create Employee'}</span>
                    </>
                  )}
                </button>
              ) : (
                <div 
                  title="Please fill all required (*) fields: First Name, Last Name, Email, Phone, Role and Department"
                  className="px-3 sm:px-4 py-2 sm:py-2.5 bg-muted/60 text-muted-foreground border border-dashed border-border/80 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 select-none cursor-not-allowed transition-all opacity-80"
                >
                  <Lock className="w-3.5 h-3.5 text-muted-foreground/70 shrink-0" />
                  <span>Fill all (*) to {initialData ? 'Save' : 'Create'}</span>
                </div>
              )}
            </div>
          </div>
      </DialogContent>
    </Dialog>

    {/* Gallery Picker Modal */}
    {showGallery && (
      <Dialog open={showGallery} onOpenChange={(open) => !open && setShowGallery(false)}>
        <DialogContent className="max-w-3xl p-6 rounded-3xl bg-card border border-border/60 shadow-2xl">
          <div className="flex items-center justify-between pb-4 border-b border-border/50">
            <div>
              <h3 className="text-xl font-black">Employee Image Library</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Select an existing photo from the server's employee folder</p>
            </div>
            <button 
              type="button"
              onClick={() => setShowGallery(false)}
              className="p-1.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="py-4">
            {isLoadingGallery ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="text-xs font-semibold">Loading employee images...</span>
              </div>
            ) : galleryImages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                <ImageIcon className="w-12 h-12 stroke-[1.2] mb-3 text-muted-foreground/50" />
                <p className="text-sm font-bold">No images found in employee library</p>
                <p className="text-xs mt-1">Upload an image using "Upload New" to store it here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4 max-h-[380px] overflow-y-auto p-1">
                {galleryImages.map((img, idx) => {
                  const fullUrl = getAvatarUrl(img.url, 'Employee');
                  const isSelected = formData.avatar === img.url || formData.profile_photo === img.url;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          avatar: img.url,
                          profile_photo: img.url
                        }));
                        setShowGallery(false);
                        toast.success("Image selected from library!");
                      }}
                      className={cn(
                        "group relative aspect-square rounded-2xl overflow-hidden border-2 transition-all p-1 bg-muted/20 hover:scale-105",
                        isSelected ? "border-primary ring-2 ring-primary/30" : "border-border/60 hover:border-primary/50"
                      )}
                    >
                      <img 
                        src={fullUrl} 
                        alt={img.filename}
                        className="w-full h-full object-cover rounded-xl"
                      />
                      {isSelected && (
                        <div className="absolute top-2 right-2 bg-primary text-primary-foreground p-1 rounded-full shadow-md">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-black/60 text-[9px] text-white p-1 truncate text-center opacity-0 group-hover:opacity-100 transition-opacity">
                        {img.filename}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-border/50 flex justify-end">
            <button
              type="button"
              onClick={() => setShowGallery(false)}
              className="px-5 py-2 text-xs font-bold text-muted-foreground hover:text-foreground bg-muted rounded-xl"
            >
              Close
            </button>
          </div>
        </DialogContent>
      </Dialog>
    )}
  </>
  );
}
