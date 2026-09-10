import { useState } from "react";
import { X,  Search, Plus, Filter, Users, Briefcase, MapPin, Clock, MoreHorizontal, ArrowUpRight, UserPlus  } from "lucide-react";
import { DialogClose,  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger  } from "@/components/ui/dialog";
import { useDepartments } from "../employees/DepartmentContext";
import { toast } from "sonner";
import { SearchableSelect } from "@/components/ui/select";

interface JobOpening {
  id: string;
  title: string;
  department: string;
  location: string;
  type: string;
  status: "Active" | "Draft" | "Closed";
  applicants: number;
  interviewing: number;
  offers: number;
  postedDate: string;
  hiringManager: string;
  managerAvatar: string;
}

const MOCK_JOBS: JobOpening[] = [
  {
    id: "JOB-01",
    title: "Senior Frontend Engineer",
    department: "Engineering",
    location: "Remote",
    type: "Full-time",
    status: "Active",
    applicants: 142,
    interviewing: 12,
    offers: 1,
    postedDate: "2 weeks ago",
    hiringManager: "Alex Turner",
    managerAvatar: "https://i.pravatar.cc/150?u=alex",
  },
  {
    id: "JOB-02",
    title: "Product Marketing Manager",
    department: "Marketing",
    location: "New York, NY",
    type: "Full-time",
    status: "Active",
    applicants: 89,
    interviewing: 5,
    offers: 0,
    postedDate: "1 week ago",
    hiringManager: "Sarah Connor",
    managerAvatar: "https://i.pravatar.cc/150?u=sarah",
  },
  {
    id: "JOB-03",
    title: "UX Researcher",
    department: "Design",
    location: "San Francisco, CA",
    type: "Contract",
    status: "Draft",
    applicants: 0,
    interviewing: 0,
    offers: 0,
    postedDate: "Just now",
    hiringManager: "David Kim",
    managerAvatar: "https://i.pravatar.cc/150?u=david",
  },
  {
    id: "JOB-04",
    title: "Data Scientist",
    department: "Engineering",
    location: "Remote",
    type: "Full-time",
    status: "Active",
    applicants: 215,
    interviewing: 8,
    offers: 2,
    postedDate: "3 weeks ago",
    hiringManager: "Elena Rodriguez",
    managerAvatar: "https://i.pravatar.cc/150?u=elena",
  }
];

export function Hirings() {
  const { departments } = useDepartments();
  const [searchQuery, setSearchQuery] = useState("");
  const [jobs, setJobs] = useState<JobOpening[]>(MOCK_JOBS);
  const [isPostOpen, setIsPostOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobOpening | null>(null);
  const [referJob, setReferJob] = useState<JobOpening | null>(null);
  
  // Form State
  const [newTitle, setNewTitle] = useState("");
  const [newDepartment, setNewDepartment] = useState(departments[0] || "Engineering");
  const [newLocation, setNewLocation] = useState("");
  const [newType, setNewType] = useState("Full-time");
  const [newHiringManager, setNewHiringManager] = useState("");

  const handlePostJob = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newLocation || !newHiringManager) {
      toast.error("Please fill all required fields");
      return;
    }

    const newJob: JobOpening = {
      id: `JOB-${Math.random().toString(36).substr(2, 9)}`,
      title: newTitle,
      department: newDepartment,
      location: newLocation,
      type: newType,
      status: "Active",
      applicants: 0,
      interviewing: 0,
      offers: 0,
      postedDate: "Just now",
      hiringManager: newHiringManager,
      managerAvatar: `https://i.pravatar.cc/150?u=${newHiringManager.replace(/\s/g, '')}`,
    };

    setJobs(prev => [newJob, ...prev]);
    setIsPostOpen(false);
    toast.success("Job posted successfully!");
    
    setNewTitle("");
    setNewDepartment(departments[0] || "Engineering");
    setNewLocation("");
    setNewType("Full-time");
    setNewHiringManager("");
  };

  const filteredJobs = jobs.filter(job => 
    job.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    job.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">Job Openings</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage active requisitions and hiring pipelines</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <input 
              type="text" 
              placeholder="Search jobs..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full sm:w-64 pl-10 pr-4 py-2 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          </div>
          <button className="p-2 bg-white border border-border rounded-xl text-foreground/80 hover:bg-muted/50 shadow-sm transition-colors">
            <Filter className="w-4 h-4" />
          </button>
          <Dialog open={isPostOpen} onOpenChange={setIsPostOpen}>
            <DialogTrigger asChild>
              <button className="px-4 py-2 bg-primary hover:bg-primary text-primary-foreground rounded-xl text-sm font-bold shadow-sm flex items-center gap-2 transition-colors whitespace-nowrap">
                <Plus className="w-4 h-4" /> Post Job
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] md:max-w-[500px] p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
              <div className="flex items-center justify-between px-6 md:px-8 py-6 border-b border-border/50 bg-muted/30">
          <div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight">Post New Job</h2>
            
          </div>
          <DialogClose asChild>
            <button className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </DialogClose>
        </div>
              <form onSubmit={handlePostJob} className="flex flex-col max-h-[70vh]">
                <div className="p-6 md:p-8 space-y-6 overflow-y-auto">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Job Title</label>
                  <input 
                    type="text" 
                    required
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Department</label>
                    <SearchableSelect 
                      value={newDepartment}
                      onChange={val => setNewDepartment(val)}
                      options={departments.map(dept => ({ label: dept, value: dept }))}
                      className="w-full h-[38px] px-3 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Employment Type</label>
                    <SearchableSelect 
                      value={newType}
                      onChange={val => setNewType(val)}
                      options={[
                        { label: "Full-time", value: "Full-time" },
                        { label: "Part-time", value: "Part-time" },
                        { label: "Contract", value: "Contract" },
                        { label: "Internship", value: "Internship" }
                      ]}
                      className="w-full h-[38px] px-3 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Location</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Remote or San Francisco, CA"
                    required
                    value={newLocation}
                    onChange={e => setNewLocation(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Hiring Manager</label>
                  <input 
                    type="text" 
                    required
                    value={newHiringManager}
                    onChange={e => setNewHiringManager(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                </div>
<div className="px-6 md:px-8 py-4 md:py-6 bg-muted/30 border-t border-border/50 flex justify-end gap-3 mt-auto shrink-0">
                  <button 
                    type="button" 
                    onClick={() => setIsPostOpen(false)}
                    className="px-4 py-2 bg-white border border-border text-foreground/80 hover:bg-muted/50 font-bold text-sm rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="px-4 py-2 bg-primary hover:bg-primary text-primary-foreground font-bold text-sm rounded-xl transition-colors"
                  >
                    Post Job
                  </button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Active Jobs", value: "3", trend: "+1 this month" },
          { label: "Total Applicants", value: "446", trend: "+12% vs last month" },
          { label: "Interviews Scheduled", value: "25", trend: "+5 this week" },
          { label: "Offers Extended", value: "3", trend: "1 accepted" },
        ].map(stat => (
          <div key={stat.label} className="bg-white p-5 rounded-2xl border border-border shadow-sm">
            <p className="text-sm font-semibold text-muted-foreground mb-1">{stat.label}</p>
            <div className="flex items-end gap-3">
              <h3 className="text-2xl font-black text-foreground">{stat.value}</h3>
              <p className="text-xs font-medium text-emerald-600 mb-1">{stat.trend}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Grid of Job Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-4">
        {filteredJobs.map(job => (
          <div key={job.id} className="bg-white rounded-2xl border border-border shadow-sm hover:shadow-md transition-all group flex flex-col">
            <div className="p-5 border-b border-border/50 flex-1">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-muted text-foreground/80">
                      {job.department}
                    </span>
                    {job.status === "Active" ? (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600">Active</span>
                    ) : (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-600">Draft</span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">{job.title}</h3>
                </div>
                <button className="p-1.5 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-lg transition-colors">
                  <MoreHorizontal className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-y-3 mb-6">
                <div className="flex items-center gap-2 text-sm text-foreground/80 font-medium">
                  <Briefcase className="w-4 h-4 text-muted-foreground" /> {job.type}
                </div>
                <div className="flex items-center gap-2 text-sm text-foreground/80 font-medium">
                  <MapPin className="w-4 h-4 text-muted-foreground" /> {job.location}
                </div>
                <div className="flex items-center gap-2 text-sm text-foreground/80 font-medium">
                  <Clock className="w-4 h-4 text-muted-foreground" /> {job.postedDate}
                </div>
                <div className="flex items-center gap-2 text-sm text-foreground/80 font-medium">
                  <Users className="w-4 h-4 text-muted-foreground" /> {job.applicants} applied
                </div>
              </div>

              {/* Pipeline Pipeline Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-muted-foreground">Pipeline Pipeline</span>
                  <span className="text-primary">{job.interviewing} Interviewing</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden flex">
                  <div className="h-full bg-slate-300 rounded-l-full" style={{ width: '40%' }} />
                  <div className="h-full bg-primary" style={{ width: '30%' }} />
                  <div className="h-full bg-emerald-500 rounded-r-full" style={{ width: '10%' }} />
                </div>
              </div>
            </div>

            <div className="p-4 bg-muted/50/50 rounded-b-2xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img src={job.managerAvatar} alt={job.hiringManager} className="w-8 h-8 rounded-full border-2 border-white shadow-sm" />
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Hiring Manager</p>
                  <p className="text-xs font-semibold text-foreground/80">{job.hiringManager}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setReferJob(job)}
                  className="text-xs font-bold text-muted-foreground hover:text-foreground/80 flex items-center gap-1.5 transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Refer
                </button>
                <button 
                  onClick={() => setSelectedJob(job)}
                  className="text-xs font-bold text-primary hover:text-primary flex items-center gap-1 transition-colors"
                >
                  View Details <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* View Details Modal */}
      <Dialog open={!!selectedJob} onOpenChange={(open) => !open && setSelectedJob(null)}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className="flex items-center justify-between px-6 md:px-8 py-6 border-b border-border/50 bg-muted/30">
          <div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight">{selectedJob?.title}</h2>
            
          </div>
          <DialogClose asChild>
            <button className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </DialogClose>
        </div>
          {selectedJob && (
            <div className="space-y-6 px-6 md:px-8 py-6">
              <div className="flex flex-wrap gap-4 pt-2 border-b border-border/50 pb-4">
                <div className="bg-muted/50 px-3 py-1.5 rounded-lg flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Department</span>
                  <span className="text-sm font-bold text-foreground/80">{selectedJob.department}</span>
                </div>
                <div className="bg-muted/50 px-3 py-1.5 rounded-lg flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Location</span>
                  <span className="text-sm font-bold text-foreground/80">{selectedJob.location}</span>
                </div>
                <div className="bg-muted/50 px-3 py-1.5 rounded-lg flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Type</span>
                  <span className="text-sm font-bold text-foreground/80">{selectedJob.type}</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-bold text-foreground mb-3">Hiring Manager</h4>
                  <div className="flex items-center gap-3">
                    <img src={selectedJob.managerAvatar} alt={selectedJob.hiringManager} className="w-10 h-10 rounded-full" />
                    <div>
                      <p className="text-sm font-bold text-foreground/80">{selectedJob.hiringManager}</p>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground mb-3">Pipeline</h4>
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground font-medium">Total Applicants</span>
                      <span className="font-bold text-foreground">{selectedJob.applicants}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground font-medium">Interviewing</span>
                      <span className="font-bold text-primary">{selectedJob.interviewing}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Refer a Friend Modal */}
      <Dialog open={!!referJob} onOpenChange={(open) => !open && setReferJob(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className="flex items-center justify-between px-6 md:px-8 py-6 border-b border-border/50 bg-muted/30">
          <div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight">Refer someone for {referJob?.title}</h2>
            
          </div>
          <DialogClose asChild>
            <button className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </DialogClose>
        </div>
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              toast.success("Referral submitted successfully! Thank you.");
              setReferJob(null);
            }} 
            className="space-y-4 px-6 md:px-8 py-6"
          >
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Candidate Name</label>
              <input type="text" required className="w-full px-3 py-2 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Candidate Email</label>
              <input type="email" required className="w-full px-3 py-2 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">LinkedIn Profile (Optional)</label>
              <input type="url" className="w-full px-3 py-2 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Resume / CV</label>
              <input type="file" required className="w-full px-3 py-2 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/10" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Why are they a good fit?</label>
              <textarea required rows={3} className="w-full px-3 py-2 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            
            <div className="pt-4 flex justify-end gap-3">
              <button 
                type="button" 
                onClick={() => setReferJob(null)}
                className="px-4 py-2 bg-white border border-border text-foreground/80 hover:bg-muted/50 font-bold text-sm rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="px-4 py-2 bg-primary hover:bg-primary text-primary-foreground font-bold text-sm rounded-xl transition-colors"
              >
                Submit Referral
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
