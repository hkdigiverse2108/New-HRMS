import { useState, useMemo } from "react";
import { User, Briefcase, CreditCard, FileText, Mail, Phone, MapPin, Building, Calendar, Key, Shield, CheckCircle2, ChevronRight, Edit2, Eye, EyeOff, Lock, Bell, Camera, PenTool } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { useEmployeesContext } from "@/components/employees/EmployeeContext";
import { EmployeeFormModal } from "@/components/employees/EmployeeFormModal";
import { useAuth } from "@/components/auth/AuthContext";
import { toast } from "@/lib/toast";
import { NotificationSettingsCard } from "@/components/notifications/NotificationSettingsCard";
import { getAvatarUrl, handleAvatarError } from "@/lib/config";
import { ChangePhotoModal } from "./ChangePhotoModal";
import { ChangeSignatureModal } from "./ChangeSignatureModal";

type TabType = 'overview' | 'personal' | 'financial' | 'offboarding' | 'notifications';

export function UserProfile() {
  const { user: authUser, refreshProfile } = useAuth();
  const { employees, updateEmployee, refreshEmployees } = useEmployeesContext();

  // Dynamically resolve current logged-in employee record with robust authUser fallback
  const user = useMemo(() => {
    if (authUser) {
      const byId = employees.find(e => 
        e.id === authUser.id || 
        (e as any)._id === authUser.id ||
        e.employeeId === authUser.employee_id ||
        e.employeeId === authUser.employeeId ||
        e.employeeId === authUser.id ||
        e.id === authUser.employee_id
      );
      if (byId) return byId;

      const byEmail = employees.find(e => e.email?.toLowerCase() === authUser.email?.toLowerCase());
      if (byEmail) return byEmail;

      // Construct robust fallback object from authUser so it ALWAYS displays for any logged in role
      const rawAuth: any = authUser;
      const nameParts = (rawAuth.name || "").trim().split(/\s+/);
      const fallbackUser: any = {
        ...rawAuth,
        id: rawAuth.id || "current-user",
        employeeId: rawAuth.employee_id || rawAuth.employeeId || rawAuth.id || "",
        name: rawAuth.name || "User",
        firstName: rawAuth.first_name || rawAuth.firstName || nameParts[0] || "",
        lastName: rawAuth.last_name || rawAuth.lastName || (nameParts.length > 1 ? nameParts.slice(1).join(" ") : ""),
        email: rawAuth.email || "",
        role: rawAuth.role || "Employee",
        department: rawAuth.department || "—",
        sub_department: rawAuth.sub_department || "—",
        designation: rawAuth.designation || rawAuth.role || "Employee",
        avatar: rawAuth.profile_photo || rawAuth.avatar || "",
        profile_photo: rawAuth.profile_photo || rawAuth.avatar || "",
        status: "Active",
        phone: rawAuth.phone || rawAuth.phone_number || "—",
        dob: rawAuth.dob || "—",
        gender: rawAuth.gender || "—",
        workMode: rawAuth.work_mode || rawAuth.workMode || "WFO",
        startTime: rawAuth.start_time || "09:30",
        endTime: rawAuth.end_time || "18:30",
      };
      return fallbackUser;
    }
    return employees[0] || null;
  }, [authUser, employees]);

  const roleLower = (authUser?.role || "").toLowerCase();
  const isAdminOrHR = roleLower === "admin" || roleLower === "superadmin" || roleLower === "hr";

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [userSignature, setUserSignature] = useState(() => 
    user?.signature || user?.signature_url || (typeof window !== "undefined" ? localStorage.getItem(`user_signature_${user?.id}`) : "") || ""
  );
  const [showProfilePassword, setShowProfilePassword] = useState(false);

  if (!user) {
    return <div className="p-8 text-center text-muted-foreground">User not found</div>;
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'personal', label: 'Personal Details', icon: FileText },
    { id: 'financial', label: 'Financial & Docs', icon: CreditCard },
    { id: 'offboarding', label: 'Offboarding', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell }
  ];
  
  const profileData = {
    firstName: user.firstName || user.name?.split(" ")[0] || "",
    lastName: user.lastName || user.name?.split(" ").slice(1).join(" ") || "",
    dob: user.dob || "—",
    gender: user.gender || "—",
    parentName: user.parentName || "—",
    parentNumber: user.parentNumber || "—",
    relation: user.relation || "Parent",
    password: "••••••••",
    salary: user.salary || "—",
    bankName: user.bankName || "—",
    accountNumber: user.accountNumber || "—",
    ifscCode: user.ifscCode || "—",
    upiId: user.upiId || "—",
    aadharCard: user.aadharCard || "—",
    panCard: user.panCard || "—",
    sub_department: user.sub_department || "—",
    designation: user.designation || user.role || "Employee",
    startTime: user.startTime || "10:00",
    endTime: user.endTime || "19:00",
    workMode: user.workMode || "Office",
    hasBond: user.hasBond || false,
    bondStartDate: user.bondStartDate || "—",
    bondEndDate: user.bondEndDate || "—",
    hasNoticePeriod: user.hasNoticePeriod || false,
    requiredDocuments: user.requiredDocuments || ["Aadhar Card", "PAN Card"],
    ...user
  };

  return (
    <div className="w-full h-full flex flex-col animate-in fade-in duration-300">
      
      {/* Header Profile Card */}
      <div className="bg-white border border-border/60 rounded-3xl overflow-hidden mb-6 shadow-sm relative shrink-0">
        <div className="h-32 bg-gradient-to-r from-emerald-500 to-teal-600 relative w-full" />
        
        <div className="px-4 sm:px-8 pb-6 sm:pb-8">
          <div className="flex flex-col md:flex-row gap-6 items-start md:items-end -mt-12 relative z-10">
            <div className="relative group">
              <div className="w-24 sm:w-28 h-24 sm:h-28 rounded-2xl overflow-hidden border-4 border-white shadow-md bg-white relative">
                <img 
                  src={getAvatarUrl(profileData.avatar || profileData.profile_photo, profileData.name)} 
                  alt={profileData.name} 
                  className="w-full h-full object-cover" 
                  onError={handleAvatarError}
                />
                <button
                  type="button"
                  onClick={() => setIsPhotoModalOpen(true)}
                  className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-white cursor-pointer"
                  title="Change profile photo"
                >
                  <Camera className="w-6 h-6 drop-shadow-md" />
                  <span className="text-[10px] font-bold mt-1 drop-shadow-md">Change</span>
                </button>
              </div>
              <span className="absolute -bottom-2 -right-2 px-3 py-1 bg-emerald-500 text-white rounded-xl text-[10px] font-bold border-2 border-white shadow-sm pointer-events-none z-10">
                {profileData.status}
              </span>
            </div>
            
            <div className="flex-1 mt-6 md:mt-0 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight truncate">{profileData.name}</h1>
              <p className="text-sm sm:text-[15px] font-medium text-muted-foreground mt-1 flex flex-wrap items-center gap-2">
                {profileData.designation || profileData.role} 
                <span>·</span> 
                <span className="text-primary font-bold">{profileData.department}</span>
              </p>
            </div>
            
            <div className="flex flex-wrap gap-2.5 w-full md:w-auto mt-2 md:mt-0">
              <button 
                onClick={() => setIsPhotoModalOpen(true)}
                className="flex items-center justify-center gap-2 bg-muted hover:bg-muted/80 text-foreground/80 px-4 py-2.5 rounded-xl font-bold transition-colors text-sm w-full md:w-auto"
                title="Change Profile Photo"
              >
                <Camera className="w-4 h-4" /> Change Photo
              </button>
              <button 
                onClick={() => setIsSignatureModalOpen(true)}
                className="flex items-center justify-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 px-4 py-2.5 rounded-xl font-bold transition-colors text-sm w-full md:w-auto shadow-xs"
                title="Add or edit your digital signature"
              >
                <PenTool className="w-4 h-4 text-emerald-600" />
                {userSignature || user?.signature || user?.signature_url ? "Change Signature" : "Add Signature"}
              </button>
              {isAdminOrHR && (
                <button 
                  onClick={() => setIsEditModalOpen(true)}
                  className="flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2.5 rounded-xl font-bold transition-colors text-sm w-full md:w-auto shadow-sm"
                >
                  <Edit2 className="w-4 h-4" /> Edit Profile
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
        
        {/* Sidebar Tabs */}
        <div className="w-full lg:w-72 shrink-0 flex flex-row lg:flex-col overflow-x-auto lg:overflow-visible gap-2 pb-2 lg:pb-0 scrollbar-hide">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={cn(
                  "flex items-center gap-3 px-4 sm:px-5 py-3 sm:py-4 rounded-2xl text-sm font-bold transition-all border whitespace-nowrap lg:w-full",
                  isActive 
                    ? "bg-white border-border shadow-sm text-foreground" 
                    : "bg-transparent border-transparent text-muted-foreground hover:bg-white/50"
                )}
              >
                <div className={cn("p-2 rounded-xl transition-colors", isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                  <Icon className="w-4 h-4" />
                </div>
                {tab.label}
                {isActive && <ChevronRight className="w-4 h-4 ml-auto opacity-50 hidden lg:block" />}
              </button>
            )
          })}
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-white border border-border/60 rounded-3xl p-4 sm:p-6 md:p-8 overflow-y-auto shadow-sm pb-20 min-w-0">
          
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <h2 className="text-xl font-black">Overview</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="p-5 bg-muted/20 border border-border/50 rounded-2xl flex items-center gap-4">
                  <div className="p-3 bg-blue-500/10 text-blue-600 rounded-xl"><Mail className="w-5 h-5" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">Email</p>
                    <p className="text-sm font-semibold truncate">{profileData.email}</p>
                  </div>
                </div>
                <div className="p-5 bg-muted/20 border border-border/50 rounded-2xl flex items-center gap-4">
                  <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-xl"><Phone className="w-5 h-5" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">Phone</p>
                    <p className="text-sm font-semibold truncate">{profileData.phone}</p>
                  </div>
                </div>
                <div className="p-5 bg-muted/20 border border-border/50 rounded-2xl flex items-center gap-4">
                  <div className="p-3 bg-purple-500/10 text-purple-600 rounded-xl"><Calendar className="w-5 h-5" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">Joined</p>
                    <p className="text-sm font-semibold">{profileData.joinDate ? formatDate(profileData.joinDate) : '-'}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Work Details</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 border-b border-border/50">
                      <span className="text-sm text-muted-foreground">Department</span>
                      <span className="text-sm font-semibold">{profileData.department}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 border-b border-border/50">
                      <span className="text-sm text-muted-foreground">Sub-Department</span>
                      <span className="text-sm font-semibold">{profileData.sub_department || '-'}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 border-b border-border/50">
                      <span className="text-sm text-muted-foreground">Work Mode</span>
                      <span className="text-sm font-semibold">{profileData.workMode || 'WFO'}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 border-b border-border/50">
                      <span className="text-sm text-muted-foreground">Timings</span>
                      <span className="text-sm font-semibold">{profileData.startTime} - {profileData.endTime}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Current Status</h3>
                  <div className="p-6 bg-primary/5 border border-primary/20 rounded-2xl h-full flex flex-col justify-center">
                    <div className="flex items-center gap-3 mb-2">
                      <CheckCircle2 className="w-5 h-5 text-primary" />
                      <h4 className="font-bold text-foreground">Active & In Good Standing</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">Performance Score: <span className="font-bold text-foreground">{profileData.performanceScore}/100</span></p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PERSONAL TAB */}
          {activeTab === 'personal' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <h2 className="text-xl font-black">Personal Details</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">First Name</p>
                  <p className="text-sm font-semibold p-3 bg-muted/20 border border-border/50 rounded-xl">{profileData.firstName || profileData.name?.split(' ')[0]}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">Last Name</p>
                  <p className="text-sm font-semibold p-3 bg-muted/20 border border-border/50 rounded-xl">{profileData.lastName || profileData.name?.split(' ')[1] || '-'}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">Date of Birth</p>
                  <p className="text-sm font-semibold p-3 bg-muted/20 border border-border/50 rounded-xl">{profileData.dob ? formatDate(profileData.dob) : '-'}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">Gender</p>
                  <p className="text-sm font-semibold p-3 bg-muted/20 border border-border/50 rounded-xl">{profileData.gender || '-'}</p>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">Password Setup</p>
                  <div className="flex items-center justify-between p-3 bg-muted/20 border border-border/50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <Key className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-semibold tracking-widest text-muted-foreground">
                        {showProfilePassword ? (profileData.password || "Not set") : "••••••••"}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowProfilePassword(!showProfilePassword)}
                      className="p-1 text-muted-foreground hover:text-foreground rounded-lg transition-colors focus:outline-none"
                      title={showProfilePassword ? "Hide password" : "Show password"}
                    >
                      {showProfilePassword ? <EyeOff className="w-4 h-4 text-primary" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-8 border-t border-border/50 space-y-6">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Emergency Contact</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">Name</p>
                    <p className="text-sm font-semibold p-3 bg-muted/20 border border-border/50 rounded-xl">{profileData.parentName || '-'}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">Relation</p>
                    <p className="text-sm font-semibold p-3 bg-muted/20 border border-border/50 rounded-xl">{profileData.relation || '-'}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">Phone Number</p>
                    <p className="text-sm font-semibold p-3 bg-muted/20 border border-border/50 rounded-xl">{profileData.parentNumber || '-'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* FINANCIAL TAB */}
          {activeTab === 'financial' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <h2 className="text-xl font-black">Financial & Documents</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">Bank Name</p>
                  <p className="text-sm font-semibold p-3 bg-muted/20 border border-border/50 rounded-xl">{profileData.bankName || '-'}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">Account Number</p>
                  <p className="text-sm font-semibold p-3 bg-muted/20 border border-border/50 rounded-xl">{profileData.accountNumber || '-'}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">IFSC Code</p>
                  <p className="text-sm font-semibold p-3 bg-muted/20 border border-border/50 rounded-xl uppercase">{profileData.ifscCode || '-'}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">UPI ID</p>
                  <p className="text-sm font-semibold p-3 bg-muted/20 border border-border/50 rounded-xl">{profileData.upiId || '-'}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">Aadhar Card</p>
                  <p className="text-sm font-semibold p-3 bg-muted/20 border border-border/50 rounded-xl">{profileData.aadharCard || '-'}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">PAN Card</p>
                  <p className="text-sm font-semibold p-3 bg-muted/20 border border-border/50 rounded-xl uppercase">{profileData.panCard || '-'}</p>
                </div>
              </div>

              <div className="pt-8 border-t border-border/50 space-y-5">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Submitted Documents</h3>
                <div className="flex flex-wrap gap-2 p-5 bg-muted/20 border border-border/50 rounded-2xl">
                  {profileData.requiredDocuments && profileData.requiredDocuments.length > 0 ? (
                    profileData.requiredDocuments.map((doc: any) => (
                      <span key={String(doc)} className="px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-lg text-xs font-bold">
                        {String(doc)}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">No documents submitted yet.</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* OFFBOARDING TAB */}
          {activeTab === 'offboarding' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <h2 className="text-xl font-black">Bonds & Exit Info</h2>
              
              <div className="space-y-6">
                <div className="p-6 bg-muted/20 border border-border/50 rounded-2xl">
                  <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border/50">
                    <div className={cn("p-2 rounded-xl", profileData.hasBond ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500")}>
                      <Shield className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-foreground">Bond Status</h3>
                  </div>
                  
                  {profileData.hasBond ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">Start Date</p>
                        <p className="text-sm font-semibold">{formatDate(profileData.bondStartDate) || '-'}</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">End Date</p>
                        <p className="text-sm font-semibold">{formatDate(profileData.bondEndDate) || '-'}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No active bond associated with this employee.</p>
                  )}
                </div>

                <div className="p-6 bg-muted/20 border border-border/50 rounded-2xl">
                  <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border/50">
                    <div className={cn("p-2 rounded-xl", profileData.hasResignation ? "bg-red-500/10 text-red-500" : "bg-emerald-500/10 text-emerald-500")}>
                      <FileText className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-foreground">Exit Status</h3>
                  </div>
                  
                  {profileData.hasResignation ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">Resignation Date</p>
                        <p className="text-sm font-semibold text-red-600">{profileData.resignationDate ? formatDate(profileData.resignationDate) : '-'}</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">Notice Period</p>
                        <p className="text-sm font-semibold">{profileData.hasNoticePeriod ? "Serving Notice" : "Not Serving"}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm font-medium text-emerald-600">Employee is active and has not filed for resignation.</p>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <NotificationSettingsCard className="w-full" />
          )}
        </div>
      </div>

      {/* Change Photo Modal for Employee & Admin */}
      <ChangePhotoModal
        isOpen={isPhotoModalOpen}
        onClose={() => setIsPhotoModalOpen(false)}
        currentPhotoUrl={profileData.avatar || profileData.profile_photo}
        userName={profileData.name}
        employeeId={user.id}
        onPhotoSaved={async (newPhotoUrl) => {
          try {
            await updateEmployee(user.id, { avatar: newPhotoUrl, profile_photo: newPhotoUrl });
          } catch {
            // ignore if already synced
          }
          if (refreshProfile) {
            await refreshProfile();
          }
        }}
      />

      {/* Digital Signature Modal */}
      <ChangeSignatureModal
        isOpen={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        currentSignatureUrl={userSignature || user?.signature || user?.signature_url}
        userName={profileData.name}
        employeeId={user.id}
        onSignatureSaved={async (newSigUrl) => {
          setUserSignature(newSigUrl);
          try {
            await updateEmployee(user.id, { signature: newSigUrl, signature_url: newSigUrl });
          } catch {
            // ignore if saved locally
          }
          if (refreshProfile) {
            await refreshProfile();
          }
          if (refreshEmployees) {
            await refreshEmployees();
          }
        }}
      />

      {/* Admin/HR Full Edit Modal ONLY */}
      {isAdminOrHR && (
        <EmployeeFormModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          initialData={profileData as any}
          isSelfEdit={false}
          onSubmit={async (updatedData) => {
            try {
              await updateEmployee(user.id, updatedData);
              setIsEditModalOpen(false);
              return true;
            } catch {
              return false;
            }
          }}
        />
      )}
    </div>
  );
}
