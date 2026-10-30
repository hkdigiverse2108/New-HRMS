import React, { useState, useEffect, useRef } from "react";
import {
  Vote,
  Plus,
  Filter,
  Users,
  Trash2,
  Award,
  Lock,
  BarChart3,
  Sparkles,
  RotateCcw,
  ShieldCheck,
  Calculator,
  Play,
  Pause,
  Search,
  Check,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Clock,
  CheckCircle2,
  Calendar,
  Eye,
  RefreshCw
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useUser } from "@/hooks/useUser";
import { cn } from "@/lib/utils";

interface Candidate {
  id: string;
  employee_id: string;
  name: string;
  department?: string;
  designation?: string;
  avatar?: string;
}

interface Election {
  id: string;
  title: string;
  description?: string;
  maxPreferences: number;
  electionMonth?: string;
  electionYear?: number;
  status: "active" | "completed" | "draft" | string;
  candidates: Candidate[];
  totalValidVotes: number;
  totalEligibleVoters: number;
  quota?: number;
  winner_candidate_id?: string;
  winner_name?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface TransferredVote {
  fromCandidateId: string;
  fromCandidateName: string;
  toCandidateId: string;
  toCandidateName: string;
  count: number;
}

interface ElectionRound {
  id?: string;
  roundNumber: number;
  tally: Record<string, { candidateName: string; votes: number }>;
  eliminatedCandidateIds: string[];
  eliminatedCandidateNames: string[];
  transferredVotes: TransferredVote[];
  winnerCandidateId?: string;
  winnerName?: string;
  quota: number;
  timestamp?: string;
}

interface AdminVoterBallot {
  id: string;
  voterId: string;
  voterName: string;
  preferences: { candidateId: string; candidateName: string }[];
  submittedAt?: string;
}

interface EmployeeItem {
  id: string;
  name: string;
  department?: string;
  designation?: string;
  avatar?: string;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export function Elections() {
  const { user } = useUser();
  const [elections, setElections] = useState<Election[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>("all");

  // Admin Check
  const isAdmin = user && (
    ["admin", "super admin", "superadmin", "administrator", "founder"].includes(
      String(user.role || "").toLowerCase().trim()
    ) ||
    String(user.role || "").toLowerCase() === "admin" ||
    user.name === "Admin Admin" ||
    user.email === "admin@hkdigiverse.com"
  );

  // Modal States
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [voteModalOpen, setVoteModalOpen] = useState(false);
  const [resultsModalOpen, setResultsModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [electionToDelete, setElectionToDelete] = useState<Election | null>(null);

  // Create Form State
  const [createLoading, setCreateLoading] = useState(false);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [empSearch, setEmpSearch] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formMaxPreferences, setFormMaxPreferences] = useState(5);
  const [formMonth, setFormMonth] = useState<string>(MONTHS[new Date().getMonth()] ?? "October");
  const [formYear, setFormYear] = useState(new Date().getFullYear());
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);

  // Vote Modal State
  const [activeElectionForVote, setActiveElectionForVote] = useState<Election | null>(null);
  const [myBallot, setMyBallot] = useState<{ isSubmitted: boolean; preferences: string[]; submittedAt?: string } | null>(null);
  const [votingPreferences, setVotingPreferences] = useState<string[]>([]);
  const [submittingVote, setSubmittingVote] = useState(false);

  // Results Modal State
  const [activeElectionForResults, setActiveElectionForResults] = useState<Election | null>(null);
  const [rounds, setRounds] = useState<ElectionRound[]>([]);
  const [voterBallots, setVoterBallots] = useState<AdminVoterBallot[]>([]);
  const [currentRoundIdx, setCurrentRoundIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [runningEngine, setRunningEngine] = useState(false);
  const [resultsTab, setResultsTab] = useState<"rounds" | "audit">("rounds");
  const playTimerRef = useRef<NodeJS.Timeout | null>(null);

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  // Fetch Elections List
  const fetchElections = async () => {
    setLoading(true);
    try {
      let endpoint = "/elections";
      const params: string[] = [];
      if (selectedMonth !== "all") params.push(`month=${encodeURIComponent(selectedMonth)}`);
      if (selectedYear !== "all") params.push(`year=${encodeURIComponent(selectedYear)}`);
      if (params.length > 0) endpoint += `?${params.join("&")}`;

      const res = await api.get<Election[]>(endpoint, { showLoader: false });
      setElections(Array.isArray(res) ? res : []);
    } catch (err: any) {
      console.error("Failed to fetch elections:", err);
      toast.error(err.message || "Failed to load elections");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchElections();
  }, [selectedMonth, selectedYear]);

  // Fetch Employees for Candidate Pool
  const fetchEmployees = async () => {
    if (employees.length > 0) return;
    setEmployeesLoading(true);
    try {
      const res = await api.get<any>("/employees", { showLoader: false });
      const list = Array.isArray(res) ? res : (res?.data || res?.employees || []);
      const mapped: EmployeeItem[] = list.map((emp: any) => {
        const p = emp.personal_info || {};
        const w = emp.work_details || {};
        const fullName = p.first_name
          ? `${p.first_name} ${p.last_name || ""}`.trim()
          : (emp.name || emp.fullName || "Employee");
        return {
          id: String(emp._id || emp.id),
          name: fullName,
          department: w.department || emp.department || "General",
          designation: w.designation || emp.designation || "Staff",
          avatar: p.profile_picture || emp.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(fullName)}`
        };
      });
      setEmployees(mapped);
    } catch (err) {
      console.warn("Error fetching employees pool:", err);
    } finally {
      setEmployeesLoading(false);
    }
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setFormTitle("");
    setFormDescription("");
    setFormMaxPreferences(5);
    setFormMonth(MONTHS[new Date().getMonth()] ?? "October");
    setFormYear(new Date().getFullYear());
    setSelectedCandidateIds([]);
    setEmpSearch("");
    fetchEmployees();
    setCreateModalOpen(true);
  };

  // Toggle candidate selection in create form
  const handleToggleCandidate = (empId: string) => {
    if (selectedCandidateIds.includes(empId)) {
      setSelectedCandidateIds(selectedCandidateIds.filter((id) => id !== empId));
    } else {
      setSelectedCandidateIds([...selectedCandidateIds, empId]);
    }
  };

  // Submit Create Election
  const handleCreateElection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      toast.error("Please enter election title");
      return;
    }
    if (selectedCandidateIds.length < 2) {
      toast.error("Please select at least 2 candidates for the voting pool");
      return;
    }

    setCreateLoading(true);
    try {
      const payload = {
        title: formTitle.trim(),
        description: formDescription.trim() || undefined,
        maxPreferences: formMaxPreferences,
        electionMonth: formMonth,
        electionYear: formYear,
        candidate_employee_ids: selectedCandidateIds,
        status: "active"
      };

      await api.post("/elections", payload);
      toast.success("Election created successfully! Voting is now open.");
      setCreateModalOpen(false);
      fetchElections();
    } catch (err: any) {
      toast.error(err.message || "Failed to create election");
    } finally {
      setCreateLoading(false);
    }
  };

  // Open Vote Modal
  const handleOpenVoteModal = async (election: Election) => {
    setActiveElectionForVote(election);
    setVotingPreferences([]);
    setMyBallot(null);
    setVoteModalOpen(true);

    try {
      const ballotRes = await api.get<any>(`/elections/${election.id}/my-ballot`, { showLoader: false });
      if (ballotRes && ballotRes.isSubmitted) {
        setMyBallot(ballotRes);
        setVotingPreferences(ballotRes.preferences || []);
      } else {
        setMyBallot(null);
      }
    } catch (err) {
      console.warn("Error fetching user ballot:", err);
    }
  };

  // Toggle Preference in Voting Modal
  const handleTogglePreference = (candidateId: string) => {
    if (myBallot?.isSubmitted || activeElectionForVote?.status === "completed") return;

    const maxPref = activeElectionForVote?.maxPreferences || 5;

    if (votingPreferences.includes(candidateId)) {
      setVotingPreferences(votingPreferences.filter((id) => id !== candidateId));
    } else {
      if (votingPreferences.length >= maxPref) {
        toast.warning(`Maximum ${maxPref} preferences allowed.`);
        return;
      }
      setVotingPreferences([...votingPreferences, candidateId]);
    }
  };

  // Submit Ballot
  const handleSubmitVote = async () => {
    if (!activeElectionForVote) return;
    const requiredCount = Math.min(
      activeElectionForVote.maxPreferences || 1,
      activeElectionForVote.candidates?.length || 1
    );

    if (votingPreferences.length < requiredCount) {
      toast.error(
        `Please select all ${requiredCount} candidate preferences before submitting (પૂરા ${requiredCount} ઉમેદવારો પસંદ કરવા જરૂરી છે).`
      );
      return;
    }

    setSubmittingVote(true);
    try {
      await api.post(`/elections/${activeElectionForVote.id}/ballots`, {
        preferences: votingPreferences
      });
      toast.success("Your ballot has been securely submitted and recorded!");
      setMyBallot({
        isSubmitted: true,
        preferences: votingPreferences,
        submittedAt: new Date().toISOString()
      });
      fetchElections();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit ballot");
    } finally {
      setSubmittingVote(false);
    }
  };

  // Open Results & STV Modal
  const handleOpenResultsModal = async (election: Election) => {
    setActiveElectionForResults(election);
    setRounds([]);
    setVoterBallots([]);
    setCurrentRoundIdx(0);
    setIsPlaying(false);
    setResultsTab("rounds");
    setResultsModalOpen(true);
    await loadResultsData(election.id);
  };

  // Load Results and Rounds
  const loadResultsData = async (electionId: string) => {
    try {
      const [roundsData, voterData, elDetail] = await Promise.all([
        api.get<ElectionRound[]>(`/elections/${electionId}/rounds`, { showLoader: false }).catch(() => []),
        isAdmin ? api.get<AdminVoterBallot[]>(`/elections/${electionId}/voter-ballots`, { showLoader: false }).catch(() => []) : Promise.resolve([]),
        api.get<Election>(`/elections/${electionId}`, { showLoader: false }).catch(() => null)
      ]);

      if (elDetail) {
        setActiveElectionForResults(elDetail);
      }
      setRounds(Array.isArray(roundsData) ? roundsData : []);
      if (Array.isArray(roundsData) && roundsData.length > 0) {
        setCurrentRoundIdx(roundsData.length - 1);
      }
      setVoterBallots(Array.isArray(voterData) ? voterData : []);
    } catch (err) {
      console.error("Error loading results data:", err);
    }
  };

  // Run STV Calculation Engine
  const handleRunSTVEngine = async () => {
    if (!activeElectionForResults) return;
    setRunningEngine(true);
    try {
      const res = await api.post(`/elections/${activeElectionForResults.id}/run`);
      toast.success(`STV Calculation Completed! Winner: ${res.winner || "Declared"}`);
      await loadResultsData(activeElectionForResults.id);
      fetchElections();
    } catch (err: any) {
      toast.error(err.message || "Failed to run STV calculation");
    } finally {
      setRunningEngine(false);
    }
  };

  // Play / Pause Round Stepper
  useEffect(() => {
    if (isPlaying && rounds.length > 1) {
      playTimerRef.current = setInterval(() => {
        setCurrentRoundIdx((prev) => {
          if (prev >= rounds.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 2500);
    } else {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    }

    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    };
  }, [isPlaying, rounds]);

  const handleTogglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
    } else {
      if (currentRoundIdx >= rounds.length - 1) {
        setCurrentRoundIdx(0);
      }
      setIsPlaying(true);
    }
  };

  // Delete Election
  const handleDeleteElection = async () => {
    if (!electionToDelete) return;
    try {
      await api.delete(`/elections/${electionToDelete.id}`);
      toast.success("Election deleted successfully");
      setDeleteConfirmOpen(false);
      setElectionToDelete(null);
      fetchElections();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete election");
    }
  };

  // Stats calculation
  const totalElections = elections.length;
  const activeElectionsCount = elections.filter((e) => e.status !== "completed").length;
  const completedElectionsCount = elections.filter((e) => e.status === "completed").length;
  const totalVotesCast = elections.reduce((acc, e) => acc + (e.totalValidVotes || 0), 0);

  // Filtered employees for candidate picker
  const filteredEmployees = employees.filter((emp) => {
    if (!empSearch.trim()) return true;
    const q = empSearch.toLowerCase();
    return emp.name.toLowerCase().includes(q) || (emp.department && emp.department.toLowerCase().includes(q));
  });

  const activeRound = rounds[currentRoundIdx];

  return (
    <div className="w-full min-w-0 space-y-5 sm:space-y-8 animate-in fade-in duration-500">
      {/* Top Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 bg-primary/10 text-primary rounded-2xl border border-primary/20 shadow-xs shrink-0">
              <Vote className="w-7 h-7" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-3xl font-black tracking-tight text-foreground">
                  Elections & Voting
                </h1>
                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-bold px-2 py-0.5 text-xs">
                  STV Ranked Choice
                </Badge>
              </div>
              <p className="text-xs sm:text-sm font-medium text-muted-foreground mt-1">
                Single Transferable Vote (STV) algorithm with Droop Quota, round elimination, and audit history.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={fetchElections}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-card hover:bg-muted text-foreground font-semibold rounded-xl border border-border/60 shadow-xs transition-all text-xs"
            title="Refresh List"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin text-primary")} />
            <span>Refresh</span>
          </button>

          {isAdmin && (
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl shadow-sm hover:bg-primary/90 transition-all duration-200 text-xs sm:text-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Create Election</span>
            </button>
          )}
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-card p-4 rounded-2xl border border-border/60 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Total Elections</span>
            <Vote className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-black text-foreground mt-2">{totalElections}</div>
        </div>

        <div className="bg-card p-4 rounded-2xl border border-border/60 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-wide">Active Voting</span>
            <Clock className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-foreground mt-2">{activeElectionsCount}</div>
        </div>

        <div className="bg-card p-4 rounded-2xl border border-border/60 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-600 uppercase tracking-wide">Completed</span>
            <Award className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-foreground mt-2">{completedElectionsCount}</div>
        </div>

        <div className="bg-card p-4 rounded-2xl border border-border/60 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Total Votes Cast</span>
            <Users className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-black text-foreground mt-2">{totalVotesCast}</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-card rounded-2xl p-4 sm:p-5 border border-border/60 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-foreground font-bold text-sm">
          <Filter className="w-4 h-4 text-primary" />
          <span>Filter Elections:</span>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-full sm:w-[140px] rounded-xl text-xs font-medium">
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Months</SelectItem>
              {MONTHS.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-full sm:w-[120px] rounded-xl text-xs font-medium">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(selectedMonth !== "all" || selectedYear !== "all") && (
            <button
              onClick={() => {
                setSelectedMonth("all");
                setSelectedYear("all");
              }}
              className="text-xs text-primary hover:underline font-bold px-2 py-1 transition-all"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Elections Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card rounded-3xl p-6 border border-border/60 animate-pulse space-y-4">
              <div className="h-6 bg-muted rounded-md w-1/3" />
              <div className="h-6 bg-muted rounded-md w-3/4" />
              <div className="h-16 bg-muted/60 rounded-xl" />
              <div className="h-10 bg-muted rounded-xl" />
            </div>
          ))}
        </div>
      ) : elections.length === 0 ? (
        <div className="bg-card rounded-3xl p-12 text-center border border-border/60 shadow-xs">
          <Vote className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-black text-foreground mb-1">
            No Elections Found
          </h3>
          <p className="text-sm font-medium text-muted-foreground max-w-md mx-auto mb-6">
            There are currently no active or past elections matching your selected filters.
          </p>
          {isAdmin && (
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl text-xs shadow-sm hover:bg-primary/90 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Election</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          {elections.map((election) => {
            const isCompleted = election.status === "completed";
            const turnoutPercent = election.totalEligibleVoters > 0
              ? Math.round((election.totalValidVotes / election.totalEligibleVoters) * 100)
              : 0;

            return (
              <div
                key={election.id}
                className="bg-card rounded-3xl border border-border/60 shadow-xs hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col justify-between group"
              >
                <div className="p-6">
                  {/* Top Bar with Status Tag */}
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={isCompleted ? "secondary" : "default"}
                        className={cn(
                          "rounded-full px-3 py-0.5 text-[11px] font-bold uppercase tracking-wide",
                          isCompleted
                            ? "bg-muted text-muted-foreground"
                            : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                        )}
                      >
                        {isCompleted ? "Completed" : "Active Voting"}
                      </Badge>
                      {election.electionMonth && (
                        <Badge variant="outline" className="rounded-full px-3 py-0.5 text-[11px] font-bold uppercase tracking-wide bg-muted/40 border-border/60">
                          {election.electionMonth} {election.electionYear}
                        </Badge>
                      )}
                    </div>

                    {isAdmin && (
                      <button
                        onClick={() => {
                          setElectionToDelete(election);
                          setDeleteConfirmOpen(true);
                        }}
                        className="text-muted-foreground hover:text-destructive p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
                        title="Delete Election"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-xl font-black text-foreground mb-1.5 line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                    {election.title}
                  </h3>
                  {election.description && (
                    <p className="text-xs font-medium text-muted-foreground line-clamp-2 mb-4">
                      {election.description}
                    </p>
                  )}

                  {/* Winner Banner if Completed */}
                  {isCompleted && election.winner_name && (
                    <div className="mt-3 mb-4 p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-3">
                      <div className="p-2 bg-amber-500/20 text-amber-600 rounded-xl shrink-0">
                        <Award className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-widest font-bold text-amber-600/80">
                          Declared Winner
                        </div>
                        <div className="text-base font-black text-amber-700 dark:text-amber-400 truncate">
                          {election.winner_name}
                        </div>
                        {election.quota && (
                          <div className="text-[10px] text-amber-600/70 font-semibold">
                            Achieved Droop Quota: {election.quota} votes
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Turnout Progress Bar */}
                  <div className="mt-2 pt-4 border-t border-border/40">
                    <div className="flex items-center justify-between text-xs font-bold text-muted-foreground mb-2">
                      <span className="flex items-center gap-1.5 uppercase tracking-wide">
                        <Users className="w-3.5 h-3.5 text-primary" />
                        Votes Cast
                      </span>
                      <span className="text-foreground font-black">
                        {election.totalValidVotes} / {election.totalEligibleVoters} ({turnoutPercent}%)
                      </span>
                    </div>
                    <Progress value={Math.min(turnoutPercent, 100)} className="h-2 rounded-full" />
                  </div>

                  {/* Candidate Count */}
                  <div className="flex items-center gap-2 mt-4 text-xs font-bold text-muted-foreground">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>{election.candidates?.length || 0} Candidates</span>
                    <span className="text-border">•</span>
                    <span>Max {election.maxPreferences} choices</span>
                  </div>
                </div>

                {/* Footer Action Buttons */}
                <div className="p-4 bg-muted/20 border-t border-border/40 flex items-center justify-between gap-3">
                  {!isCompleted ? (
                    <button
                      onClick={() => handleOpenVoteModal(election)}
                      className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-primary text-primary-foreground rounded-xl text-xs font-bold hover:bg-primary/90 transition-all shadow-xs"
                    >
                      <Vote className="w-4 h-4" />
                      <span>Vote / My Ballot</span>
                    </button>
                  ) : (
                    <div className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 px-2 uppercase tracking-wide">
                      <Lock className="w-3.5 h-3.5" /> Voting Closed
                    </div>
                  )}

                  <button
                    onClick={() => handleOpenResultsModal(election)}
                    className="inline-flex items-center gap-1.5 py-2.5 px-4 bg-card text-foreground border border-border/60 shadow-xs rounded-xl text-xs font-bold hover:bg-muted transition-all"
                  >
                    <BarChart3 className="w-4 h-4 text-primary" />
                    <span>Results</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE ELECTION MODAL */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 sm:p-8">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-foreground flex items-center gap-2">
              <Vote className="w-6 h-6 text-primary" />
              <span>Create New Election</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Configure candidate pool and preferences for Single Transferable Vote (STV) ranked choice voting.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateElection} className="space-y-5 mt-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wide text-foreground">Election Title *</label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g., Employee of the Month - October 2026"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wide text-foreground">Description (Optional)</label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Details or guidelines for voters..."
                rows={2}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wide text-foreground">Election Month</label>
                <Select value={formMonth} onValueChange={(val) => setFormMonth(val)}>
                  <SelectTrigger className="rounded-xl text-xs font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wide text-foreground">Election Year</label>
                <Select value={String(formYear)} onValueChange={(val) => setFormYear(Number(val))}>
                  <SelectTrigger className="rounded-xl text-xs font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wide text-foreground">Max Preferences (1-10)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formMaxPreferences}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "" || /^\d*$/.test(v)) {
                      setFormMaxPreferences(v === "" ? 1 : Math.max(1, Math.min(10, Number(v))));
                    }
                  }}
                  className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                />
              </div>
            </div>

            {/* Candidate Pool Selection */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-foreground">
                    Select Candidate Pool ({selectedCandidateIds.length} selected) *
                  </label>
                  <p className="text-[11px] text-muted-foreground">Select at least 2 candidates for the voting ballot.</p>
                </div>
                {selectedCandidateIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedCandidateIds([])}
                    className="text-xs text-destructive hover:underline font-bold"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {/* Search candidate */}
              <div className="relative">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                <input
                  type="text"
                  value={empSearch}
                  onChange={(e) => setEmpSearch(e.target.value)}
                  placeholder="Search employees by name or department..."
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-border bg-background text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Employee Selector List */}
              <div className="max-h-60 overflow-y-auto border border-border/80 rounded-2xl p-2 space-y-1.5 bg-muted/20">
                {employeesLoading ? (
                  <div className="text-center py-6 text-xs text-muted-foreground">Loading employees...</div>
                ) : filteredEmployees.length === 0 ? (
                  <div className="text-center py-6 text-xs text-muted-foreground">No employees found.</div>
                ) : (
                  filteredEmployees.map((emp) => {
                    const isSelected = selectedCandidateIds.includes(emp.id);
                    return (
                      <div
                        key={emp.id}
                        onClick={() => handleToggleCandidate(emp.id)}
                        className={cn(
                          "flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border",
                          isSelected
                            ? "bg-primary/10 border-primary text-foreground font-semibold"
                            : "bg-card border-border/40 hover:bg-muted/50 text-foreground"
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={emp.avatar}
                            alt={emp.name}
                            className="w-8 h-8 rounded-full border border-border shrink-0 object-cover"
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-bold truncate">{emp.name}</div>
                            <div className="text-[11px] text-muted-foreground truncate">
                              {emp.department} • {emp.designation}
                            </div>
                          </div>
                        </div>

                        <div
                          className={cn(
                            "w-5 h-5 rounded-md flex items-center justify-center border transition-all shrink-0",
                            isSelected
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-muted-foreground/30 bg-background"
                          )}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-border/60">
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createLoading || selectedCandidateIds.length < 2}
                className="px-5 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl text-xs shadow-sm hover:bg-primary/90 transition-all disabled:opacity-50"
              >
                {createLoading ? "Creating Election..." : "Launch Election"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* VOTE / MY BALLOT MODAL */}
      <Dialog open={voteModalOpen} onOpenChange={setVoteModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 sm:p-8">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-foreground flex items-center gap-2">
              <Vote className="w-6 h-6 text-primary" />
              <span>{myBallot?.isSubmitted ? "My Recorded Ballot" : "Cast Your Vote"}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {activeElectionForVote?.title} — Ranked Choice Single Transferable Vote (STV)
            </DialogDescription>
          </DialogHeader>

          {activeElectionForVote && (
            <div className="space-y-6 mt-4">
              {/* If already submitted: show locked banner */}
              {myBallot?.isSubmitted ? (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/20 text-emerald-600 rounded-xl shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-emerald-700 dark:text-emerald-400">
                      Your vote has been officially recorded and locked!
                    </div>
                    <div className="text-[11px] text-emerald-600/80 mt-0.5">
                      Submitted on: {myBallot.submittedAt ? new Date(myBallot.submittedAt).toLocaleString() : "Confirmed"}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 bg-primary/10 border border-primary/20 rounded-2xl flex items-center gap-3 text-xs text-primary font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>
                    Click candidates in order of your preference. (પૂરા{" "}
                    <span className="font-bold underline">
                      {Math.min(activeElectionForVote.maxPreferences, activeElectionForVote.candidates.length)}
                    </span>{" "}
                    ઉમેદવારો પસંદ કરવા જરૂરી છે).
                  </span>
                </div>
              )}

              {/* Preferences Slots Display */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-foreground uppercase tracking-wide">
                  <span>Your Ranked Preferences ({votingPreferences.length} / {Math.min(activeElectionForVote.maxPreferences, activeElectionForVote.candidates.length)})</span>
                  {!myBallot?.isSubmitted && votingPreferences.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setVotingPreferences([])}
                      className="text-xs text-destructive hover:underline font-bold flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {votingPreferences.length === 0 ? (
                    <div className="p-4 text-center border-2 border-dashed border-border/80 rounded-2xl text-xs text-muted-foreground">
                      No preferences selected yet. Click any candidate below to assign your 1st choice.
                    </div>
                  ) : (
                    votingPreferences.map((candId, idx) => {
                      const cand = activeElectionForVote.candidates.find((c) => c.id === candId);
                      return (
                        <div
                          key={candId}
                          className="flex items-center justify-between p-3 bg-muted/30 border border-border/80 rounded-2xl"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground font-black text-xs flex items-center justify-center shrink-0">
                              #{idx + 1}
                            </span>
                            <img
                              src={cand?.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${cand?.name || "Candidate"}`}
                              alt={cand?.name}
                              className="w-8 h-8 rounded-full border border-border object-cover"
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-black text-foreground truncate">{cand?.name || "Candidate"}</div>
                              <div className="text-[10px] text-muted-foreground truncate">{cand?.department} • {cand?.designation}</div>
                            </div>
                          </div>

                          {!myBallot?.isSubmitted && (
                            <button
                              type="button"
                              onClick={() => handleTogglePreference(candId)}
                              className="text-xs text-muted-foreground hover:text-destructive px-2 py-1 rounded-lg hover:bg-destructive/10 font-bold"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Candidate Pool to Pick From */}
              {!myBallot?.isSubmitted && (
                <div className="space-y-2 pt-2 border-t border-border/60">
                  <div className="text-xs font-bold text-foreground uppercase tracking-wide">
                    Available Candidates ({activeElectionForVote.candidates.length})
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {activeElectionForVote.candidates.map((cand) => {
                      const prefIndex = votingPreferences.indexOf(cand.id);
                      const isPicked = prefIndex !== -1;

                      return (
                        <div
                          key={cand.id}
                          onClick={() => handleTogglePreference(cand.id)}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-2xl cursor-pointer border transition-all",
                            isPicked
                              ? "bg-primary/10 border-primary"
                              : "bg-card border-border/60 hover:bg-muted/50"
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={cand.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${cand.name}`}
                              alt={cand.name}
                              className="w-9 h-9 rounded-full border border-border object-cover shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-foreground truncate">{cand.name}</div>
                              <div className="text-[10px] text-muted-foreground truncate">{cand.department}</div>
                            </div>
                          </div>

                          <div
                            className={cn(
                              "w-7 h-7 rounded-full text-xs font-black flex items-center justify-center shrink-0 border",
                              isPicked
                                ? "bg-primary text-primary-foreground border-primary"
                                : "border-border text-muted-foreground hover:bg-muted"
                            )}
                          >
                            {isPicked ? `#${prefIndex + 1}` : "+"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <DialogFooter className="pt-4 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setVoteModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted rounded-xl transition-all"
                >
                  Close
                </button>
                {!myBallot?.isSubmitted && (
                  <button
                    type="button"
                    onClick={handleSubmitVote}
                    disabled={submittingVote || votingPreferences.length < Math.min(activeElectionForVote.maxPreferences, activeElectionForVote.candidates.length)}
                    className="px-5 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl text-xs shadow-sm hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>{submittingVote ? "Submitting..." : "Confirm & Submit Ballot"}</span>
                  </button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* RESULTS & STV CALCULATION MODAL */}
      <Dialog open={resultsModalOpen} onOpenChange={setResultsModalOpen}>
        <DialogContent
          style={{ overflowX: "hidden" }}
          className="max-w-4xl w-[95vw] sm:w-[90vw] md:w-full max-h-[90vh] overflow-y-auto overflow-x-hidden rounded-3xl p-4 sm:p-7 block"
        >
          <DialogHeader className="w-full min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full min-w-0">
              <div className="min-w-0">
                <DialogTitle className="text-xl sm:text-2xl font-black text-foreground flex items-center gap-2 truncate">
                  <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-primary shrink-0" />
                  <span className="truncate">Election Results & STV Engine</span>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground break-words">
                  {activeElectionForResults?.title} — Round-by-Round Single Transferable Vote calculations
                </DialogDescription>
              </div>

              {isAdmin && (
                <button
                  onClick={handleRunSTVEngine}
                  disabled={runningEngine}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl shadow-xs hover:bg-primary/90 transition-all shrink-0 disabled:opacity-50 cursor-pointer"
                >
                  <Calculator className="w-4 h-4" />
                  <span>{runningEngine ? "Running STV..." : "Run STV Calculation"}</span>
                </button>
              )}
            </div>
          </DialogHeader>

          {activeElectionForResults && (
            <div className="w-full max-w-full min-w-0 overflow-x-hidden space-y-6 mt-4">
              {/* Winner Header if completed */}
              {activeElectionForResults.status === "completed" && activeElectionForResults.winner_name && (
                <div className="p-4 bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent border border-amber-500/30 rounded-2xl flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-amber-500/20 text-amber-600 rounded-xl shrink-0">
                      <Award className="w-7 h-7" />
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-widest font-black text-amber-600">
                        Official Winner
                      </div>
                      <div className="text-xl font-black text-foreground">
                        {activeElectionForResults.winner_name}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Achieved Droop Quota of {activeElectionForResults.quota || 0} votes
                      </div>
                    </div>
                  </div>

                  <Badge className="bg-amber-500 text-black font-black uppercase tracking-wider text-xs px-3 py-1">
                    Elected
                  </Badge>
                </div>
              )}

              {/* Turnout & Quota Metric Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 bg-muted/40 rounded-2xl border border-border/60">
                  <span className="text-[11px] font-bold text-muted-foreground block mb-0.5">Total Submitted Cast Votes</span>
                  <div className="text-lg font-black text-foreground flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    <span>{activeElectionForResults.totalValidVotes || 0} / {activeElectionForResults.totalEligibleVoters || 0} ({activeElectionForResults.totalEligibleVoters ? Math.round(((activeElectionForResults.totalValidVotes || 0) / activeElectionForResults.totalEligibleVoters) * 100) : 0}%)</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-0.5 block">
                    Calculations based strictly on submitted votes
                  </span>
                </div>

                <div className="p-3.5 bg-muted/40 rounded-2xl border border-border/60">
                  <span className="text-[11px] font-bold text-muted-foreground block mb-0.5">STV Winning Quota</span>
                  <div className="text-lg font-black text-foreground flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>{activeRound?.quota || activeElectionForResults.quota || Math.floor((activeElectionForResults.totalValidVotes || 0) / 2) + 1} Votes Needed</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-0.5 block">
                    Formula: ⌊Submitted Votes / 2⌋ + 1
                  </span>
                </div>

                <div className="p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-2xl">
                  <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 block mb-0.5">Election Status</span>
                  <div className="text-lg font-black text-foreground flex items-center gap-2 truncate">
                    <Award className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className="truncate">{activeElectionForResults.winner_name || "In Progress"}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-0.5 block">
                    {activeElectionForResults.winner_name ? "Official Winner Declared" : "Voting / Calculation Active"}
                  </span>
                </div>
              </div>

              {/* Navigation Tabs: STV Rounds vs Admin Ballot Audit */}
              <Tabs value={resultsTab} onValueChange={(v: any) => setResultsTab(v)}>
                <TabsList className="bg-muted/60 p-1 rounded-xl">
                  <TabsTrigger value="rounds" className="text-xs font-bold rounded-lg cursor-pointer">
                    STV Round Calculations ({rounds.length})
                  </TabsTrigger>
                  {isAdmin && (
                    <TabsTrigger value="audit" className="text-xs font-bold rounded-lg cursor-pointer">
                      Voter Ballots Audit ({voterBallots.length})
                    </TabsTrigger>
                  )}
                </TabsList>

                {/* TAB 1: ROUNDS AUDIT */}
                <TabsContent value="rounds" className="space-y-4 pt-3">
                  {rounds.length === 0 ? (
                    <div className="p-10 text-center border-2 border-dashed border-border/80 rounded-2xl">
                      <Calculator className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                      <h4 className="text-sm font-bold text-foreground">No STV Rounds Calculated Yet</h4>
                      <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
                        Ballots must be submitted and STV calculation run by an Administrator to determine round eliminations and the winner.
                      </p>
                      {isAdmin && (
                        <button
                          onClick={handleRunSTVEngine}
                          disabled={runningEngine}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl shadow-xs hover:bg-primary/90 transition-all cursor-pointer"
                        >
                          <Calculator className="w-4 h-4" />
                          <span>Run STV Engine Now</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      {/* Round Stepper & Play Bar */}
                      <div className="bg-muted/40 border border-border/80 rounded-2xl p-3.5 space-y-3 min-w-0 w-full overflow-hidden">
                        {/* Top row: Round Title & Controls */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-foreground">
                              Round {currentRoundIdx + 1} of {rounds.length}
                            </span>
                            {activeRound?.winnerName && (
                              <Badge className="bg-emerald-500/20 text-emerald-600 border border-emerald-500/30 text-[10px] font-black uppercase">
                                Winner: {activeRound.winnerName}
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setIsPlaying(false);
                                setCurrentRoundIdx((prev) => Math.max(0, prev - 1));
                              }}
                              disabled={currentRoundIdx === 0}
                              className="p-1.5 rounded-xl border border-border/80 hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 transition-all cursor-pointer"
                              title="Previous Round"
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={handleTogglePlay}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
                            >
                              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                              <span>{isPlaying ? "Pause Player" : "Play Story"}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setIsPlaying(false);
                                setCurrentRoundIdx((prev) => Math.min(rounds.length - 1, prev + 1));
                              }}
                              disabled={currentRoundIdx === rounds.length - 1}
                              className="p-1.5 rounded-xl border border-border/80 hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 transition-all cursor-pointer"
                              title="Next Round"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Bottom row: Horizontal scrollable round pills with proper containment */}
                        <div className="w-full max-w-full min-w-0 overflow-x-auto py-1 scrollbar-thin">
                          <div className="inline-flex items-center gap-1.5 w-max">
                            {rounds.map((r, idx) => (
                              <button
                                key={r.roundNumber}
                                type="button"
                                onClick={() => {
                                  setIsPlaying(false);
                                  setCurrentRoundIdx(idx);
                                }}
                                className={cn(
                                  "px-2.5 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer",
                                  currentRoundIdx === idx
                                    ? "bg-primary text-primary-foreground shadow-xs ring-1 ring-primary/40 font-black"
                                    : "text-muted-foreground hover:bg-muted/80 bg-background/60 border border-border/40"
                                )}
                              >
                                Round {r.roundNumber}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Active Round Detail View */}
                      {activeRound && (
                        <div className="bg-card border border-border/80 rounded-2xl p-5 space-y-5">
                          <div className="flex items-center justify-between border-b border-border/60 pb-3">
                            <div>
                              <h4 className="text-base font-black text-foreground flex items-center gap-2">
                                <span>Round {activeRound.roundNumber}</span>
                                {activeRound.winnerName && (
                                  <Badge className="bg-emerald-500/20 text-emerald-600 border border-emerald-500/30 text-[10px] uppercase font-bold">
                                    Winner Declared
                                  </Badge>
                                )}
                              </h4>
                              <p className="text-xs text-muted-foreground">
                                Quota needed to win: <span className="font-bold text-foreground">{activeRound.quota} votes</span>
                              </p>
                            </div>
                          </div>

                          {/* Candidate Tallies (Sorted Descending by Votes) */}
                          <div className="space-y-3">
                            <div className="text-xs font-bold text-foreground uppercase tracking-wide flex items-center justify-between">
                              <span>Candidate Vote Tallies</span>
                              <span className="text-[11px] text-muted-foreground font-normal">Quota threshold: {activeRound.quota} votes</span>
                            </div>
                            <div className="space-y-2.5">
                              {Object.entries(activeRound.tally)
                                .sort(([, a], [, b]) => (b.votes || 0) - (a.votes || 0))
                                .map(([cid, candData]) => {
                                  const votes = candData.votes || 0;
                                  const quota = activeRound.quota || 1;
                                  const percent = quota > 0 ? Math.min(Math.round((votes / quota) * 100), 100) : 0;
                                  const isWinnerInRound = activeRound.winnerCandidateId === cid;
                                  const isEliminatedInRound = activeRound.eliminatedCandidateIds?.includes(cid);
                                  const candidateInfo = activeElectionForResults.candidates?.find(c => c.id === cid || c.employee_id === cid);

                                  return (
                                    <div
                                      key={cid}
                                      className={cn(
                                        "p-3.5 rounded-2xl border transition-all duration-300 space-y-2",
                                        isWinnerInRound
                                          ? "bg-amber-500/10 border-amber-500/40 shadow-xs ring-1 ring-amber-500/30"
                                          : isEliminatedInRound
                                            ? "bg-muted/30 border-border/40 opacity-60"
                                            : "bg-muted/10 border-border/70 hover:border-border"
                                      )}
                                    >
                                      <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0 overflow-hidden border border-border/50">
                                            {candidateInfo?.avatar ? (
                                              <img src={candidateInfo.avatar} alt={candData.candidateName} className="w-full h-full object-cover" />
                                            ) : (
                                              <span>{candData.candidateName.charAt(0)}</span>
                                            )}
                                          </div>
                                          <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                              <span className="font-bold text-xs sm:text-sm text-foreground truncate">{candData.candidateName}</span>
                                              {isWinnerInRound && (
                                                <Badge className="bg-amber-500 text-black text-[10px] font-black px-1.5 py-0 uppercase">
                                                  Quota Hit - Winner
                                                </Badge>
                                              )}
                                              {isEliminatedInRound && (
                                                <Badge variant="outline" className="text-destructive border-destructive/30 text-[10px] font-bold px-1.5 py-0">
                                                  Eliminated
                                                </Badge>
                                              )}
                                            </div>
                                          </div>
                                        </div>

                                        <div className="text-right shrink-0">
                                          <span className="text-base sm:text-lg font-black text-foreground">{votes}</span>
                                          <span className="text-xs text-muted-foreground ml-1">votes</span>
                                          <span className="text-[11px] text-muted-foreground block">({percent}% of quota)</span>
                                        </div>
                                      </div>

                                      <Progress
                                        value={percent}
                                        className={cn(
                                          "h-2 rounded-full transition-all duration-500",
                                          isWinnerInRound ? "[&>div]:bg-amber-500" : isEliminatedInRound ? "[&>div]:bg-destructive/60" : "[&>div]:bg-primary"
                                        )}
                                      />
                                    </div>
                                  );
                                })}
                            </div>
                          </div>

                          {/* Transferred Votes in this Round */}
                          {activeRound.transferredVotes && activeRound.transferredVotes.length > 0 && (
                            <div className="p-3.5 bg-muted/30 border border-border/80 rounded-xl space-y-2">
                              <div className="text-xs font-bold text-foreground uppercase tracking-wide flex items-center gap-1.5">
                                <RotateCcw className="w-3.5 h-3.5 text-primary" />
                                <span>Vote Transfers in this Round</span>
                              </div>
                              <div className="space-y-1">
                                {activeRound.transferredVotes.map((tv, idx) => (
                                  <div key={idx} className="text-xs text-muted-foreground flex items-center gap-2">
                                    <span className="font-bold text-destructive">{tv.fromCandidateName}</span>
                                    <span>→</span>
                                    <span className="font-bold text-primary">{tv.toCandidateName}</span>
                                    <span className="text-[11px] text-foreground font-bold">({tv.count} votes)</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Eliminated Candidates in this Round */}
                          {activeRound.eliminatedCandidateNames && activeRound.eliminatedCandidateNames.length > 0 && (
                            <div className="text-xs text-muted-foreground">
                              <span className="font-bold text-foreground">Eliminated Candidates: </span>
                              {activeRound.eliminatedCandidateNames.join(", ")}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </TabsContent>

                {/* TAB 2: VOTER BALLOTS AUDIT (ADMIN ONLY) */}
                {isAdmin && (
                  <TabsContent value="audit" className="space-y-4 pt-3">
                    <div className="text-xs text-muted-foreground mb-2">
                      Individual recorded ballots for compliance and transparent STV election audit:
                    </div>

                    {voterBallots.length === 0 ? (
                      <div className="p-8 text-center border border-border/60 rounded-2xl text-xs text-muted-foreground">
                        No ballots recorded yet.
                      </div>
                    ) : (
                      <div className="border border-border/60 rounded-2xl overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-muted/50 border-b border-border/60">
                            <tr>
                              <th className="p-3 font-bold text-foreground uppercase">Voter</th>
                              <th className="p-3 font-bold text-foreground uppercase">Submission Time</th>
                              <th className="p-3 font-bold text-foreground uppercase">Ranked Preferences</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/40">
                            {voterBallots.map((b) => (
                              <tr key={b.id} className="hover:bg-muted/20">
                                <td className="p-3 font-bold text-foreground">{b.voterName}</td>
                                <td className="p-3 text-muted-foreground">
                                  {b.submittedAt ? new Date(b.submittedAt).toLocaleString() : "Recorded"}
                                </td>
                                <td className="p-3">
                                  <div className="flex flex-wrap gap-1">
                                    {b.preferences.map((p, idx) => (
                                      <Badge
                                        key={idx}
                                        variant="outline"
                                        className="text-[10px] font-semibold bg-muted/40"
                                      >
                                        #{idx + 1}: {p.candidateName}
                                      </Badge>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </TabsContent>
                )}
              </Tabs>

              <DialogFooter className="pt-4 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setResultsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted rounded-xl transition-all"
                >
                  Close
                </button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION DIALOG */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="rounded-3xl p-6 sm:p-8">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black text-foreground">
              Delete Election?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to delete <span className="font-bold text-foreground">"{electionToDelete?.title}"</span>? All candidate pools and ballot audits for this election will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel className="rounded-xl text-xs font-bold">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteElection}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl text-xs font-bold"
            >
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
