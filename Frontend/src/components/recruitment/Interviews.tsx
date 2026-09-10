import { useState } from "react";
import { X,  Search, Plus, Calendar as CalendarIcon, Video, MoreHorizontal, Clock, CheckCircle2, ChevronRight, User  } from "lucide-react";
import { DialogClose,  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger  } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SearchableSelect } from "@/components/ui/select";

type InterviewStage = string;

interface InterviewCandidate {
  id: string;
  name: string;
  role: string;
  avatar: string;
  stage: InterviewStage;
  date: string;
  time: string;
  interviewer: string;
  interviewerAvatar: string;
}

const MOCK_CANDIDATES: InterviewCandidate[] = [
  {
    id: "C-001",
    name: "Alex Johnson",
    role: "Senior Frontend Engineer",
    avatar: "https://i.pravatar.cc/150?u=alex",
    stage: "Technical",
    date: "Today",
    time: "2:00 PM - 3:00 PM",
    interviewer: "Sarah Lee",
    interviewerAvatar: "https://i.pravatar.cc/150?u=sarah",
  },
  {
    id: "C-002",
    name: "Maria Garcia",
    role: "Product Designer",
    avatar: "https://i.pravatar.cc/150?u=maria",
    stage: "Screening",
    date: "Today",
    time: "4:00 PM - 4:30 PM",
    interviewer: "David Kim",
    interviewerAvatar: "https://i.pravatar.cc/150?u=david",
  },
  {
    id: "C-003",
    name: "James Smith",
    role: "Backend Developer",
    avatar: "https://i.pravatar.cc/150?u=james",
    stage: "Cultural",
    date: "Tomorrow",
    time: "10:00 AM - 11:00 AM",
    interviewer: "Elena Rodriguez",
    interviewerAvatar: "https://i.pravatar.cc/150?u=elena",
  },
  {
    id: "C-004",
    name: "Sophia Chen",
    role: "Marketing Manager",
    avatar: "https://i.pravatar.cc/150?u=sophia",
    stage: "Offer",
    date: "Tomorrow",
    time: "1:00 PM - 1:30 PM",
    interviewer: "Michael Scott",
    interviewerAvatar: "https://i.pravatar.cc/150?u=michael",
  },
  {
    id: "C-005",
    name: "Liam O'Connor",
    role: "DevOps Engineer",
    avatar: "https://i.pravatar.cc/150?u=liam",
    stage: "Technical",
    date: "Aug 14, 2026",
    time: "11:00 AM - 12:30 PM",
    interviewer: "Sarah Lee",
    interviewerAvatar: "https://i.pravatar.cc/150?u=sarah",
  },
];

const INITIAL_STAGES: { label: InterviewStage; color: string; bgColor: string }[] = [
  { label: "Screening", color: "text-blue-700", bgColor: "bg-blue-50" },
  { label: "Technical", color: "text-primary", bgColor: "bg-primary/10" },
  { label: "Cultural", color: "text-purple-700", bgColor: "bg-purple-50" },
  { label: "Offer", color: "text-emerald-700", bgColor: "bg-emerald-50" },
];

export function Interviews() {
  const [searchQuery, setSearchQuery] = useState("");
  const [candidates, setCandidates] = useState<InterviewCandidate[]>(MOCK_CANDIDATES);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [stages, setStages] = useState(INITIAL_STAGES);
  
  // Add Stage State
  const [isAddingStage, setIsAddingStage] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const handleDeleteStage = (stageLabel: string) => {
    const stageCandidates = candidates.filter(c => c.stage === stageLabel);
    if (stageCandidates.length > 0) {
      toast.error(`Cannot delete stage "${stageLabel}". Please move or delete the ${stageCandidates.length} candidates in this stage first.`);
      return;
    }
    
    setStages(prev => prev.filter(s => s.label !== stageLabel));
    toast.success(`Stage deleted`);
  };

  const [renamingStage, setRenamingStage] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState("");

  const handleRenameStage = (oldLabel: string) => {
    if (!renameInput.trim() || renameInput.trim() === oldLabel) {
      setRenamingStage(null);
      return;
    }
    const newLabel = renameInput.trim();
    
    setStages(prev => prev.map(s => s.label === oldLabel ? { ...s, label: newLabel } : s));
    setCandidates(prev => prev.map(c => c.stage === oldLabel ? { ...c, stage: newLabel } : c));
    
    setRenamingStage(null);
    toast.success("Stage renamed");
  };

  const handleAddStage = () => {
    if (!newStageName.trim()) return;
    setStages(prev => [...prev, {
      label: newStageName.trim(),
      color: "text-foreground/80",
      bgColor: "bg-muted"
    }]);
    setNewStageName("");
    setIsAddingStage(false);
    toast.success("Stage added successfully");
  };

  const handleDragStart = (e: React.DragEvent, candidateId: string) => {
    e.dataTransfer.setData("candidateId", candidateId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necessary to allow dropping
  };

  const handleDrop = (e: React.DragEvent, stageLabel: string) => {
    e.preventDefault();
    const candidateId = e.dataTransfer.getData("candidateId");
    if (!candidateId) return;

    setCandidates(prev => prev.map(c => 
      c.id === candidateId ? { ...c, stage: stageLabel } : c
    ));
  };

  // Form State
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("");
  const [newStage, setNewStage] = useState<InterviewStage>(stages[0]?.label || "Screening");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [newInterviewer, setNewInterviewer] = useState("");

  const handleSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newRole || !newDate || !newTime || !newInterviewer) {
      toast.error("Please fill all required fields");
      return;
    }

    const newCandidate: InterviewCandidate = {
      id: `C-${Math.random().toString(36).substr(2, 9)}`,
      name: newName,
      role: newRole,
      avatar: `https://i.pravatar.cc/150?u=${newName.replace(/\s/g, '')}`,
      stage: newStage,
      date: newDate,
      time: newTime,
      interviewer: newInterviewer,
      interviewerAvatar: `https://i.pravatar.cc/150?u=${newInterviewer.replace(/\s/g, '')}`,
    };

    setCandidates(prev => [...prev, newCandidate]);
    setIsScheduleOpen(false);
    toast.success("Interview scheduled successfully!");
    
    setNewName("");
    setNewRole("");
    setNewStage("Screening");
    setNewDate("");
    setNewTime("");
    setNewInterviewer("");
  };

  const filteredCandidates = candidates.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">Interviews</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage candidate pipeline and schedules</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <input 
              type="text" 
              placeholder="Search candidates..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full sm:w-64 pl-10 pr-4 py-2 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
            />
          </div>
          <Dialog open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
            <DialogTrigger asChild>
              <button className="px-4 py-2 bg-primary hover:bg-primary text-primary-foreground rounded-xl text-sm font-bold shadow-sm flex items-center gap-2 transition-colors whitespace-nowrap">
                <Plus className="w-4 h-4" /> Schedule
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] md:max-w-[500px] p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
              <div className="flex items-center justify-between px-6 md:px-8 py-6 border-b border-border/50 bg-muted/30">
          <div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight">Schedule Interview</h2>
            
          </div>
          <DialogClose asChild>
            <button className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </DialogClose>
        </div>
              <form onSubmit={handleSchedule} className="flex flex-col max-h-[70vh]">
                <div className="p-6 md:p-8 space-y-6 overflow-y-auto">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Candidate Name</label>
                  <input 
                    type="text" 
                    required
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Role / Position</label>
                  <input 
                    type="text" 
                    required
                    value={newRole}
                    onChange={e => setNewRole(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Interview Stage</label>
                  <SearchableSelect 
                    value={newStage}
                    onChange={val => setNewStage(val as InterviewStage)}
                    options={stages.map(s => ({ label: s.label, value: s.label }))}
                    className="w-full h-[38px] px-3 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Date</label>
                    <input 
                      type="text"
                      placeholder="e.g. Aug 15"
                      required
                      value={newDate}
                      onChange={e => setNewDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Time</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 2:00 PM"
                      required
                      value={newTime}
                      onChange={e => setNewTime(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Interviewer Name</label>
                  <input 
                    type="text" 
                    required
                    value={newInterviewer}
                    onChange={e => setNewInterviewer(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                </div>
<div className="px-6 md:px-8 py-4 md:py-6 bg-muted/30 border-t border-border/50 flex justify-end gap-3 mt-auto shrink-0">
                  <button 
                    type="button" 
                    onClick={() => setIsScheduleOpen(false)}
                    className="px-4 py-2 bg-white border border-border text-foreground/80 hover:bg-muted/50 font-bold text-sm rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="px-4 py-2 bg-primary hover:bg-primary text-primary-foreground font-bold text-sm rounded-xl transition-colors"
                  >
                    Schedule Interview
                  </button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto hide-scrollbar pb-4">
        <div className="flex gap-6 min-w-max h-full">
          {stages.map(stage => {
            const stageCandidates = filteredCandidates.filter(c => c.stage === stage.label);
            
            return (
              <div 
                key={stage.label} 
                className="w-[320px] flex flex-col bg-muted/50/50 rounded-2xl border border-border/60 p-4 transition-colors"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, stage.label)}
              >
                <div className="flex items-center justify-between mb-4 px-1">
                  <div className="flex items-center gap-2">
                    {renamingStage === stage.label ? (
                      <input 
                        type="text" 
                        autoFocus
                        value={renameInput}
                        onChange={e => setRenameInput(e.target.value)}
                        onBlur={() => handleRenameStage(stage.label)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleRenameStage(stage.label);
                          if (e.key === 'Escape') setRenamingStage(null);
                        }}
                        className="font-bold text-foreground bg-white border border-primary/30 rounded px-2 py-0.5 text-sm w-32 outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    ) : (
                      <h3 className="font-bold text-foreground">{stage.label}</h3>
                    )}
                    <span className={cn("px-2 py-0.5 rounded-full text-xs font-bold", stage.bgColor, stage.color)}>
                      {stageCandidates.length}
                    </span>
                  </div>
                  <div className="relative">
                    <button 
                      onClick={() => setActiveDropdown(activeDropdown === stage.label ? null : stage.label)}
                      className="p-1 hover:bg-slate-200 rounded text-muted-foreground hover:text-foreground/80 transition-colors"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    {activeDropdown === stage.label && (
                      <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-xl shadow-lg border border-border/50 py-1 z-10 animate-in fade-in zoom-in duration-200">
                        <button 
                          onClick={() => {
                            setRenameInput(stage.label);
                            setRenamingStage(stage.label);
                            setActiveDropdown(null);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-foreground/80 hover:bg-muted/50 font-medium transition-colors"
                        >
                          Rename Stage
                        </button>
                        <button 
                          onClick={() => {
                            handleDeleteStage(stage.label);
                            setActiveDropdown(null);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 font-medium transition-colors"
                        >
                          Delete Stage
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-3 flex-1 overflow-y-auto hide-scrollbar">
                  {stageCandidates.map(candidate => (
                    <div 
                      key={candidate.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, candidate.id)}
                      className="bg-white p-4 rounded-xl border border-border shadow-sm hover:shadow-md hover:border-primary/30 transition-all group cursor-grab active:cursor-grabbing"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-3">
                          <img src={candidate.avatar} alt={candidate.name} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm" />
                          <div>
                            <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{candidate.name}</h4>
                            <p className="text-xs font-medium text-muted-foreground">{candidate.role}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-2 mt-4 pt-4 border-t border-border/50">
                        <div className="flex items-center gap-2 text-xs font-medium text-foreground/80">
                          <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>{candidate.date} • {candidate.time}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs font-medium text-foreground/80">
                          <div className="flex items-center gap-2">
                            <User className="w-3.5 h-3.5 text-muted-foreground" />
                            <span>{candidate.interviewer}</span>
                          </div>
                          <div className="flex items-center gap-1 text-primary bg-primary/10 px-2 py-1 rounded-lg">
                            <Video className="w-3 h-3" />
                            <span>Meet</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {stageCandidates.length === 0 && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-border rounded-xl">
                      <p className="text-sm font-medium text-muted-foreground">No candidates in this stage</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Add Stage Column */}
          <div className="w-[320px] flex flex-col shrink-0 h-full min-h-[300px]">
            {isAddingStage ? (
              <div className="bg-muted/50/50 rounded-2xl border border-border/60 p-4">
                <input 
                  type="text"
                  autoFocus
                  placeholder="Stage Name"
                  value={newStageName}
                  onChange={e => setNewStageName(e.target.value)}
                  onKeyDown={e => { 
                    if(e.key === 'Enter') handleAddStage(); 
                    if(e.key === 'Escape') { setIsAddingStage(false); setNewStageName(""); } 
                  }}
                  className="w-full px-3 py-2 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <div className="flex items-center gap-2 mt-3">
                  <button onClick={handleAddStage} className="px-3 py-1.5 bg-primary hover:bg-primary text-primary-foreground font-bold text-xs rounded-lg transition-colors">
                    Add
                  </button>
                  <button onClick={() => { setIsAddingStage(false); setNewStageName(""); }} className="px-3 py-1.5 bg-white border border-border text-foreground/80 hover:bg-muted/50 font-bold text-xs rounded-lg transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button 
                onClick={() => setIsAddingStage(true)}
                className="flex items-center justify-center gap-2 h-14 bg-muted/50/50 hover:bg-muted border-2 border-dashed border-border text-muted-foreground hover:text-foreground/80 font-bold text-sm rounded-2xl transition-colors w-full"
              >
                <Plus className="w-4 h-4" /> Add Stage
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
