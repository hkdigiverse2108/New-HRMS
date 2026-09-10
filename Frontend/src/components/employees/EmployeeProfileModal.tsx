import { X, Calendar, MapPin, Phone, Mail, Briefcase, Award, TrendingUp, Clock, CheckCircle2, FileText, LogOut } from "lucide-react";
import { Employee } from "./employee-data";
import { DialogClose,  Dialog, DialogContent  } from "@/components/ui/dialog";
import { cn, formatDate } from "@/lib/utils";

interface EmployeeProfileModalProps {
  employee: Employee;
  onClose: () => void;
}

export function EmployeeProfileModal({ employee, onClose }: EmployeeProfileModalProps) {
  // Generate some realistic stats based on the employee
  const joinDateObj = new Date(employee.joinDate);
  const now = new Date();
  
  const diffTime = Math.abs(now.getTime() - joinDateObj.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffMonths / 12);
  
  const tenureText = diffYears > 0 
    ? `${diffYears} year${diffYears > 1 ? 's' : ''}, ${diffMonths % 12} month${diffMonths % 12 !== 1 ? 's' : ''}`
    : `${diffMonths} month${diffMonths !== 1 ? 's' : ''}`;

  const attendanceRate = Math.min(100, Math.max(85, Math.floor(employee.performanceScore + (Math.random() * 5 - 2))));
  const projectsCompleted = Math.floor(diffMonths * 1.5);
  const totalLeaves = Math.floor(diffMonths * 1.2);
  const awards = Math.floor(diffYears * 1.5);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-emerald-500 text-white';
      case 'On Leave': return 'bg-amber-500 text-white';
      case 'Remote': return 'bg-blue-500 text-white';
      default: return 'bg-muted/500 text-white';
    }
  };

  return (
    <Dialog open={!!employee} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
        {/* Header Background */}
        <div className="h-32 shrink-0 bg-gradient-to-r from-emerald-500 to-teal-600 relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/30 text-white rounded-full transition-colors backdrop-blur-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Profile Content */}
        <div className="px-8 pb-8 pt-0 relative flex-1">
          {/* Avatar & Basic Info */}
          <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-start md:items-end mb-8">
            <div className="relative -mt-12">
              <img 
                src={employee.avatar} 
                alt={employee.name} 
                className="w-24 h-24 rounded-2xl object-cover border-4 border-white shadow-lg bg-white" 
              />
              <span className={cn(
                "absolute -bottom-2 -right-2 px-3 py-1 rounded-xl text-[10px] font-bold border-2 border-white shadow-sm",
                getStatusColor(employee.status)
              )}>
                {employee.status}
              </span>
            </div>
            
            
            <div className="flex-1 pt-2 md:pt-0 pb-1">
              <h2 className="text-3xl font-black text-foreground tracking-tight">{employee.name}</h2>
              <p className="text-[15px] font-medium text-muted-foreground">{employee.role} · <span className="text-primary">{employee.department}</span></p>
            </div>
            
            <div className="flex gap-2 w-full md:w-auto mt-4 md:mt-0">
              <button className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm shadow-primary/20 active:scale-95 text-[13px]">
                <Mail className="w-4 h-4" /> Message
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Left Column: Contact & Details */}
            <div className="space-y-6">
              <div>
                <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Contact Information</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-[13px] text-foreground/80 font-medium">
                    <div className="p-2 bg-muted/50 rounded-lg text-muted-foreground"><Mail className="w-4 h-4" /></div>
                    {employee.email}
                  </div>
                  <div className="flex items-center gap-3 text-[13px] text-foreground/80 font-medium">
                    <div className="p-2 bg-muted/50 rounded-lg text-muted-foreground"><Phone className="w-4 h-4" /></div>
                    {employee.phone}
                  </div>
                  <div className="flex items-center gap-3 text-[13px] text-foreground/80 font-medium">
                    <div className="p-2 bg-muted/50 rounded-lg text-muted-foreground"><MapPin className="w-4 h-4" /></div>
                    Mumbai, India
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Employment</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-[13px] text-foreground/80 font-medium">
                    <div className="p-2 bg-muted/50 rounded-lg text-muted-foreground"><Calendar className="w-4 h-4" /></div>
                    Joined {employee.joinDate}
                  </div>
                  <div className="flex items-center gap-3 text-[13px] text-foreground/80 font-medium">
                    <div className="p-2 bg-muted/50 rounded-lg text-muted-foreground"><Clock className="w-4 h-4" /></div>
                    Tenure: {tenureText}
                  </div>
                  <div className="flex items-center gap-3 text-[13px] text-foreground/80 font-medium">
                    <div className="p-2 bg-muted/50 rounded-lg text-muted-foreground"><Briefcase className="w-4 h-4" /></div>
                    Full-time Employee
                  </div>
                </div>
              </div>

              {(employee.hasBond || employee.hasResignation || employee.hasNoticePeriod) && (
                <div>
                  <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Important Status</h3>
                  <div className="space-y-3">
                    {employee.hasBond && (
                      <div className="flex items-center gap-3 text-[13px] font-medium text-amber-600 bg-amber-50 p-2 rounded-xl border border-amber-100">
                        <div className="p-1.5 bg-amber-100 rounded-lg text-amber-600"><FileText className="w-4 h-4" /></div>
                        <span className="truncate">Bond: {employee.bondEndDate ? `Until ${formatDate(employee.bondEndDate)}` : 'Active'}</span>
                      </div>
                    )}
                    {employee.hasResignation && (
                      <div className="flex items-center gap-3 text-[13px] font-medium text-rose-600 bg-rose-50 p-2 rounded-xl border border-rose-100">
                        <div className="p-1.5 bg-rose-100 rounded-lg text-rose-600"><LogOut className="w-4 h-4" /></div>
                        <span className="truncate">Exiting: {employee.resignationDate ? formatDate(employee.resignationDate) : 'Pending'}</span>
                      </div>
                    )}
                    {employee.hasNoticePeriod && !employee.hasResignation && (
                      <div className="flex items-center gap-3 text-[13px] font-medium text-blue-600 bg-blue-50 p-2 rounded-xl border border-blue-100">
                        <div className="p-1.5 bg-blue-100 rounded-lg text-blue-600"><Clock className="w-4 h-4" /></div>
                        <span className="truncate">Notice Period: {employee.noticePeriodDays || '30'} Days</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Lifetime Stats */}
            <div className="md:col-span-2 space-y-6">
              <div>
                <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Lifetime Statistics</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  
                  <div className="bg-muted/50 p-4 rounded-2xl border border-border/50 flex flex-col justify-center items-center text-center">
                    <TrendingUp className="w-5 h-5 text-primary mb-2" />
                    <p className="text-2xl font-black text-foreground leading-none mb-1">{employee.performanceScore}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Perf. Score</p>
                  </div>
                  
                  <div className="bg-muted/50 p-4 rounded-2xl border border-border/50 flex flex-col justify-center items-center text-center">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 mb-2" />
                    <p className="text-2xl font-black text-foreground leading-none mb-1">{attendanceRate}%</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Attendance</p>
                  </div>

                  <div className="bg-muted/50 p-4 rounded-2xl border border-border/50 flex flex-col justify-center items-center text-center">
                    <Briefcase className="w-5 h-5 text-amber-500 mb-2" />
                    <p className="text-2xl font-black text-foreground leading-none mb-1">{projectsCompleted}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Projects</p>
                  </div>

                  <div className="bg-muted/50 p-4 rounded-2xl border border-border/50 flex flex-col justify-center items-center text-center">
                    <Award className="w-5 h-5 text-rose-500 mb-2" />
                    <p className="text-2xl font-black text-foreground leading-none mb-1">{awards}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Awards</p>
                  </div>

                </div>
              </div>

              <div>
                <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Recent Highlights</h3>
                <div className="space-y-3">
                  <div className="flex gap-3 items-start bg-white border border-border/50 p-3 rounded-xl shadow-sm">
                    <div className="p-2 bg-emerald-50 text-emerald-500 rounded-lg shrink-0"><Award className="w-4 h-4" /></div>
                    <div>
                      <p className="text-[13px] font-bold text-foreground">Employee of the Month</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Awarded last month for outstanding contribution to the core product.</p>
                    </div>
                  </div>
                  <div className="flex gap-3 items-start bg-white border border-border/50 p-3 rounded-xl shadow-sm">
                    <div className="p-2 bg-blue-50 text-blue-500 rounded-lg shrink-0"><CheckCircle2 className="w-4 h-4" /></div>
                    <div>
                      <p className="text-[13px] font-bold text-foreground">Completed Leadership Training</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Successfully finished the Level 2 management curriculum.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
