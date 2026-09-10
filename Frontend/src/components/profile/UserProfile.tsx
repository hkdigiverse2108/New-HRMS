import { useState } from "react";
import { User, Briefcase, CreditCard, FileText, Mail, Phone, MapPin, Building, Calendar, Key, Shield, CheckCircle2, ChevronRight, Edit2 } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { useEmployeesContext } from "@/components/employees/EmployeeContext";
import { EmployeeFormModal } from "@/components/employees/EmployeeFormModal";
import { toast } from "sonner";

type TabType = 'overview' | 'personal' | 'financial' | 'offboarding';

export function UserProfile() {
  const { employees, updateEmployee } = useEmployeesContext();
  // Use EMP-002 (Aarav Mehta) as the current logged in user
  const user = employees.find(e => e.id === "EMP-002") || employees[0];
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  if (!user) {
    return <div className="p-8 text-center text-muted-foreground">User not found</div>;
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'personal', label: 'Personal Details', icon: FileText },
    { id: 'financial', label: 'Financial & Docs', icon: CreditCard },
    { id: 'offboarding', label: 'Offboarding', icon: Shield }
  ];
  
  // Mock some of the extensive fields for Aarav since dummy data doesn't have them yet
  const profileData = {
    firstName: "Aarav",
    lastName: "R.",
    dob: "1992-05-15",
    gender: "Male",
    parentName: "Rajesh R.",
    parentNumber: "+91 98765 11111",
    relation: "Father",
    password: "••••••••",
    salary: "85000",
    bankName: "HDFC Bank",
    accountNumber: "50100293847561",
    ifscCode: "HDFC0001234",
    upiId: "aarav.r@okhdfc",
    aadharCard: "1234 5678 9012",
    panCard: "ABCDE1234F",
    sub_department: "Core HR",
    designation: "HR Administrator",
    startTime: "10:00",
    endTime: "19:00",
    workMode: "Hybrid",
    hasBond: true,
    bondStartDate: "2020-02-15",
    bondEndDate: "2022-02-15",
    hasNoticePeriod: false,
    requiredDocuments: ["10th Marksheet", "12th Marksheet", "Degree Certificate", "Aadhar Card", "PAN Card"],
    ...user
  };

  return (
    <div className="w-full h-full flex flex-col animate-in fade-in duration-300">
      
      {/* Header Profile Card */}
      <div className="bg-white border border-border/60 rounded-3xl overflow-hidden mb-6 shadow-sm relative shrink-0">
        <div className="h-32 bg-gradient-to-r from-emerald-500 to-teal-600 relative w-full" />
        
        <div className="px-8 pb-8">
          <div className="flex flex-col md:flex-row gap-6 items-start md:items-end -mt-12 relative z-10">
            <div className="relative">
              <img 
                src={profileData.avatar} 
                alt={profileData.name} 
                className="w-28 h-28 rounded-2xl object-cover border-4 border-white shadow-md bg-white" 
              />
              <span className="absolute -bottom-2 -right-2 px-3 py-1 bg-emerald-500 text-white rounded-xl text-[10px] font-bold border-2 border-white shadow-sm">
                {profileData.status}
              </span>
            </div>
            
            <div className="flex-1 mt-14 md:mt-0">
              <h1 className="text-3xl font-black text-foreground tracking-tight">{profileData.name}</h1>
              <p className="text-[15px] font-medium text-muted-foreground mt-1 flex items-center gap-2">
                {profileData.designation || profileData.role} 
                <span>·</span> 
                <span className="text-primary font-bold">{profileData.department}</span>
              </p>
            </div>
            
            <div className="flex gap-3 w-full md:w-auto mt-4 md:mt-0">
              <button 
                onClick={() => setIsEditModalOpen(true)}
                className="flex items-center gap-2 bg-muted hover:bg-muted/80 text-foreground/80 px-4 py-2.5 rounded-xl font-bold transition-colors text-sm"
              >
                <Edit2 className="w-4 h-4" /> Edit Profile
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
        
        {/* Sidebar Tabs */}
        <div className="w-full lg:w-72 shrink-0 space-y-2">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={cn(
                  "w-full flex items-center gap-3 px-5 py-4 rounded-2xl text-sm font-bold transition-all border",
                  isActive 
                    ? "bg-white border-border shadow-sm text-foreground" 
                    : "bg-transparent border-transparent text-muted-foreground hover:bg-white/50"
                )}
              >
                <div className={cn("p-2 rounded-xl transition-colors", isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                  <Icon className="w-4 h-4" />
                </div>
                {tab.label}
                {isActive && <ChevronRight className="w-4 h-4 ml-auto opacity-50" />}
              </button>
            )
          })}
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-white border border-border/60 rounded-3xl p-8 overflow-y-auto shadow-sm pb-20">
          
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
                  <div className="flex items-center gap-3 p-3 bg-muted/20 border border-border/50 rounded-xl">
                    <Key className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-semibold tracking-widest text-muted-foreground">{profileData.password || "Not set"}</span>
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
                    profileData.requiredDocuments.map(doc => (
                      <span key={doc} className="px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-lg text-xs font-bold">
                        {doc}
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

        </div>
      </div>

      <EmployeeFormModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        initialData={profileData as any}
        isSelfEdit={true}
        onSubmit={(updatedData) => {
          updateEmployee(user.id, updatedData);
          toast.success("Profile updated successfully!");
          setIsEditModalOpen(false);
        }}
      />
    </div>
  );
}
