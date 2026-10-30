import React, { useState, useEffect, useRef } from "react";
import {
  Award,
  Plus,
  Calendar,
  Users,
  Save,
  Trash2,
  Edit3,
  Settings,
  Sparkles,
  ArrowUpDown,
  UserPlus,
  Play,
  RotateCcw,
  RefreshCw,
  Trophy,
  Crown,
  User,
  Building2,
  Timer,
  Maximize,
  Minimize,
  Check,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  X
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useUser } from "@/hooks/useUser";
import { cn } from "@/lib/utils";

// --- Confetti particle engine (Zero npm dependencies) ---
const triggerConfetti = (isWinner = false) => {
  try {
    const canvas = document.createElement("canvas");
    canvas.style.position = "fixed";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.width = "100vw";
    canvas.style.height = "100vh";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "9999999";
    document.body.appendChild(canvas);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const pieces: any[] = [];
    const colors = ["#FBBF24", "#3B82F6", "#10B981", "#EC4899", "#A855F7", "#F59E0B", "#FFFFFF"];
    const count = isWinner ? 350 : 120;

    for (let i = 0; i < count; i++) {
      pieces.push({
        x: isWinner ? Math.random() * canvas.width : canvas.width / 2,
        y: isWinner ? canvas.height : canvas.height / 2,
        vx: (Math.random() - 0.5) * (isWinner ? 26 : 16),
        vy: (Math.random() - (isWinner ? 0.9 : 0.75)) * (isWinner ? 22 : 14),
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rSpeed: (Math.random() - 0.5) * 10,
        opacity: 1
      });
    }

    let frame = 0;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      pieces.forEach((p) => {
        if (p.opacity > 0) {
          alive = true;
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.45;
          p.rotation += p.rSpeed;
          if (frame > 50) p.opacity -= 0.018;

          ctx.save();
          ctx.globalAlpha = Math.max(0, p.opacity);
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          ctx.restore();
        }
      });

      frame++;
      if (alive && frame < 180) {
        requestAnimationFrame(animate);
      } else {
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      }
    };
    animate();
  } catch (e) {
    console.error("Confetti error:", e);
  }
};

interface Topic {
  id?: string;
  name: string;
  maxMarks: number;
  order?: number;
}

interface Participant {
  id: string;
  name: string;
  designation?: string;
  department?: string;
  subDepartment?: string;
  role?: string;
  isTeamLeader?: boolean;
}

interface WeeklyEntry {
  id?: string;
  employeeId: string;
  marksByTopic: Record<string, number>;
  sumMarks: number;
  focusTaskNote?: string;
  commitmentNote?: string;
}

interface WeeklyMeetingSummary {
  id: string;
  meetingDate: string;
  participantEmployeeIds: string[];
  createdAt?: string;
}

export function TeamLeaderOfWeek() {
  const { user } = useUser();
  const isAdmin = Boolean(
    user && (
      ["admin", "super admin", "superadmin", "administrator", "founder"].includes(
        String(user.role || "").toLowerCase().trim()
      ) ||
      String(user.role || "").toLowerCase() === "admin" ||
      user.name === "Admin Admin" ||
      user.email === "admin@hkdigiverse.com" ||
      String(user.department || "").toLowerCase().includes("hr")
    )
  );

  const [meetings, setMeetings] = useState<WeeklyMeetingSummary[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>("");
  const [meetingDetail, setMeetingDetail] = useState<any>(null);
  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingRowMap, setSavingRowMap] = useState<Record<string, boolean>>({});
  const [sortBy, setSortBy] = useState<"total" | "name">("total");
  const [viewMode, setViewMode] = useState<"grouped" | "flat">("grouped");

  // Form states for meeting entries
  const [marksState, setMarksState] = useState<Record<string, Record<string, number>>>({});
  const [focusTaskNotes, setFocusTaskNotes] = useState<Record<string, string>>({});
  const [commitmentNotes, setCommitmentNotes] = useState<Record<string, string>>({});

  // Dialogs
  const [newMeetingModalOpen, setNewMeetingModalOpen] = useState(false);
  const [newMeetingDate, setNewMeetingDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
  const [copyTopicsFromLast, setCopyTopicsFromLast] = useState<boolean>(true);
  const [creatingMeeting, setCreatingMeeting] = useState(false);

  // Edit Participants Dialog
  const [participantModalOpen, setParticipantModalOpen] = useState(false);
  const [editParticipantIds, setEditParticipantIds] = useState<string[]>([]);
  const [savingParticipants, setSavingParticipants] = useState(false);

  // Topics Config Dialog
  const [topicModalOpen, setTopicModalOpen] = useState(false);
  const [topicsState, setTopicsState] = useState<Topic[]>([]);
  const [savingTopics, setSavingTopics] = useState(false);

  // Master Topics Template Dialog
  const [masterModalOpen, setMasterModalOpen] = useState(false);
  const [masterTopicsState, setMasterTopicsState] = useState<Topic[]>([]);
  const [savingMaster, setSavingMaster] = useState(false);

  // Delete Meeting Dialog
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Declare Result Dialog
  const [declareModalOpen, setDeclareModalOpen] = useState(false);
  const [declareMonthYear, setDeclareMonthYear] = useState<string>(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  });
  const [selectedMeetingIdsForDeclare, setSelectedMeetingIdsForDeclare] = useState<string[]>([]);
  const [declaring, setDeclaring] = useState(false);

  // Auditorium Reveal Modal (Grand Finale Presentation)
  const [launchRevealModalOpen, setLaunchRevealModalOpen] = useState(false);
  const [revealModalOpen, setRevealModalOpen] = useState(false);
  const [revealMonthYear, setRevealMonthYear] = useState<string>("2026-08");
  const [declaredData, setDeclaredData] = useState<any>(null);
  const [revealLoading, setRevealLoading] = useState(false);
  const [revealDisplayTab, setRevealDisplayTab] = useState<"individual" | "team">("individual");
  const [stage, setStage] = useState<number>(0); // 0=Init, 1=Week by Week, 2=Total Sums, 3=Champion
  const [revealedWeekCount, setRevealedWeekCount] = useState<number>(0);
  const [isAutoTeasing, setIsAutoTeasing] = useState(false);
  const [teaseCountdown, setTeaseCountdown] = useState<number>(2);
  const [teasingRankIndex, setTeasingRankIndex] = useState<number>(-1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Load Initial Meetings & Employees
  useEffect(() => {
    fetchEmployees();
    fetchMeetings();
  }, []);

  // When selectedMeetingId changes, load meeting detail
  useEffect(() => {
    if (selectedMeetingId) {
      fetchMeetingDetail(selectedMeetingId);
    }
  }, [selectedMeetingId]);

  const fetchEmployees = async () => {
    try {
      const res = await api.get<any>("/employees", { showLoader: false });
      const rawList = Array.isArray(res) ? res : (res?.data || res?.employees || []);
      const mapped = rawList.map((emp: any) => {
        const p = emp.personal_info || {};
        const w = emp.work_details || {};
        const fn = p.first_name ? `${p.first_name} ${p.last_name || ""}`.trim() : (emp.name || "Employee");
        const desig = w.designation || emp.designation || "Staff";
        const role = w.system_role || emp.role || "Employee";
        const dept = w.department || emp.department || "General";
        const combined = `${role} ${desig} ${dept}`.toLowerCase();
        let roleBadge = "Staff";
        if (combined.includes("founder")) roleBadge = "Founder";
        else if (combined.includes("admin") || combined.includes("superadmin")) roleBadge = "Admin";
        else if (combined.includes("hr")) roleBadge = "HR";
        else if (combined.includes("tl") || combined.includes("team lead") || combined.includes("leader") || combined.includes("head")) roleBadge = "Team Leader";
        else if (desig) roleBadge = desig;

        return {
          id: String(emp._id || emp.id),
          name: fn,
          department: dept,
          designation: desig,
          role,
          roleBadge,
          avatar: p.profile_picture || emp.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(fn)}`
        };
      });
      setAllEmployees(mapped);
    } catch (e) {
      console.error("Failed to load employees:", e);
    }
  };

  const fetchMeetings = async () => {
    setLoading(true);
    try {
      const data = await api.get<WeeklyMeetingSummary[]>("/weekly-meetings", { showLoader: false });
      if (Array.isArray(data)) {
        // Sort newest date first
        const sorted = [...data].sort((a, b) => (b.meetingDate || "").localeCompare(a.meetingDate || ""));
        setMeetings(sorted);
        if (sorted[0] && !selectedMeetingId) {
          setSelectedMeetingId(sorted[0].id);
        }
      }
    } catch (e) {
      console.error("Failed to load weekly meetings:", e);
      toast.error("Failed to load weekly meetings");
    } finally {
      setLoading(false);
    }
  };

  const fetchMeetingDetail = async (mId: string) => {
    setDetailLoading(true);
    try {
      const data = await api.get<any>(`/weekly-meetings/${mId}`, { showLoader: false });
      if (data) {
        setMeetingDetail(data);
        setTopicsState(data.topics || []);

        const marksMap: Record<string, Record<string, number>> = {};
        const focusMap: Record<string, string> = {};
        const commitMap: Record<string, string> = {};

        (data.entries || []).forEach((e: WeeklyEntry) => {
          marksMap[e.employeeId] = e.marksByTopic || {};
          focusMap[e.employeeId] = e.focusTaskNote || "";
          commitMap[e.employeeId] = e.commitmentNote || "";
        });

        setMarksState(marksMap);
        setFocusTaskNotes(focusMap);
        setCommitmentNotes(commitMap);
      }
    } catch (e) {
      console.error("Failed to load meeting detail:", e);
    } finally {
      setDetailLoading(false);
    }
  };

  const fetchMasterTopics = async () => {
    try {
      const data = await api.get<Topic[]>("/weekly-meetings/master-topics", { showLoader: false });
      if (Array.isArray(data) && data.length > 0) {
        setMasterTopicsState(data);
      } else {
        setMasterTopicsState([
          { name: "Update Round", maxMarks: 20 },
          { name: "Focus Tasking", maxMarks: 20 },
          { name: "Challenge Discussion", maxMarks: 20 },
          { name: "English Speak", maxMarks: 10 },
          { name: "Innovation", maxMarks: 30 }
        ]);
      }
    } catch (e) {
      setMasterTopicsState([
        { name: "Update Round", maxMarks: 20 },
        { name: "Focus Tasking", maxMarks: 20 },
        { name: "Challenge Discussion", maxMarks: 20 },
        { name: "English Speak", maxMarks: 10 },
        { name: "Innovation", maxMarks: 30 }
      ]);
    } finally {
      setMasterModalOpen(true);
    }
  };

  const handleSaveMasterTopics = async () => {
    setSavingMaster(true);
    try {
      await api.post("/weekly-meetings/master-topics", { topics: masterTopicsState });
      toast.success("Master Topics Template saved!");
      setMasterModalOpen(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to save master topics template");
    } finally {
      setSavingMaster(false);
    }
  };

  const openNewMeetingModal = () => {
    const today = new Date().toISOString().slice(0, 10);
    setNewMeetingDate(today);

    // Pre-select TLs & HR members
    const defaultSelected = allEmployees
      .filter((e) => e.roleBadge === "Team Leader" || e.roleBadge === "HR")
      .map((e) => e.id);

    setSelectedParticipantIds(defaultSelected);
    setNewMeetingModalOpen(true);
  };

  const handleCreateMeeting = async () => {
    if (!newMeetingDate) {
      toast.error("Please pick a meeting date");
      return;
    }
    const isDuplicate = meetings.some((m) => m.meetingDate === newMeetingDate);
    if (isDuplicate) {
      toast.error(`A meeting block for date "${newMeetingDate}" already exists!`);
      return;
    }
    if (selectedParticipantIds.length === 0) {
      toast.error("Please select at least one participant");
      return;
    }

    setCreatingMeeting(true);
    try {
      const lastMeetingId = copyTopicsFromLast && meetings[0] ? meetings[0].id : null;
      const newMeeting = await api.post<any>("/weekly-meetings", {
        meetingDate: newMeetingDate,
        participantEmployeeIds: selectedParticipantIds,
        copyFromMeetingId: lastMeetingId
      });

      toast.success("New weekly meeting created!");
      setNewMeetingModalOpen(false);
      await fetchMeetings();
      if (newMeeting?.id) {
        setSelectedMeetingId(newMeeting.id);
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to create meeting block");
    } finally {
      setCreatingMeeting(false);
    }
  };

  const openParticipantModal = () => {
    if (!meetingDetail) return;
    setEditParticipantIds(meetingDetail.participantEmployeeIds || []);
    setParticipantModalOpen(true);
  };

  const handleSaveParticipants = async () => {
    if (!selectedMeetingId) return;
    setSavingParticipants(true);
    try {
      await api.put(`/weekly-meetings/${selectedMeetingId}/participants`, {
        participantEmployeeIds: editParticipantIds
      });
      toast.success("Meeting participants updated!");
      setParticipantModalOpen(false);
      fetchMeetingDetail(selectedMeetingId);
      fetchMeetings();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to update participants");
    } finally {
      setSavingParticipants(false);
    }
  };

  const handleSaveTopics = async () => {
    if (!selectedMeetingId) return;
    setSavingTopics(true);
    try {
      await api.put(`/weekly-meetings/${selectedMeetingId}/topics`, {
        topics: topicsState
      });
      toast.success("Topics updated!");
      setTopicModalOpen(false);
      fetchMeetingDetail(selectedMeetingId);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to update topics");
    } finally {
      setSavingTopics(false);
    }
  };

  const confirmDeleteMeeting = async () => {
    if (!selectedMeetingId) return;
    setDeleting(true);
    try {
      await api.delete(`/weekly-meetings/${selectedMeetingId}`);
      toast.success("Weekly meeting block deleted!");
      setDeleteModalOpen(false);
      const remaining = meetings.filter((m) => m.id !== selectedMeetingId);
      setMeetings(remaining);
      setSelectedMeetingId(remaining[0] ? remaining[0].id : "");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to delete meeting");
    } finally {
      setDeleting(false);
    }
  };

  const handleMarksChange = (empId: string, topicId: string, val: number) => {
    setMarksState((prev) => ({
      ...prev,
      [empId]: {
        ...(prev[empId] || {}),
        [topicId]: val
      }
    }));
  };

  const calculateEmployeeSum = (empId: string) => {
    const empMarks = marksState[empId] || {};
    return Object.values(empMarks).reduce((acc, val) => acc + (Number(val) || 0), 0);
  };

  const calculateTotalMaxMarks = () => {
    if (!meetingDetail || !meetingDetail.topics) return 100;
    return meetingDetail.topics.reduce((acc: number, t: Topic) => acc + (Number(t.maxMarks) || 0), 0);
  };

  const handleSaveSingleRow = async (empId: string) => {
    if (!selectedMeetingId) return;
    setSavingRowMap((prev) => ({ ...prev, [empId]: true }));
    try {
      const currentEntry = {
        employeeId: empId,
        marksByTopic: marksState[empId] || {},
        focusTaskNote: focusTaskNotes[empId] || "",
        commitmentNote: commitmentNotes[empId] || ""
      };

      await api.post(`/weekly-meetings/${selectedMeetingId}/entries`, {
        entries: [currentEntry]
      });
      toast.success("Saved row entry successfully!");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to save row");
    } finally {
      setSavingRowMap((prev) => ({ ...prev, [empId]: false }));
    }
  };

  const handleSaveAllEntries = async () => {
    if (!selectedMeetingId || !meetingDetail) return;
    setSaving(true);
    try {
      const entriesPayload = (meetingDetail.participants || []).map((p: Participant) => {
        const empId = p.id;
        return {
          employeeId: empId,
          marksByTopic: marksState[empId] || {},
          focusTaskNote: focusTaskNotes[empId] || "",
          commitmentNote: commitmentNotes[empId] || ""
        };
      });

      await api.post(`/weekly-meetings/${selectedMeetingId}/entries`, {
        entries: entriesPayload
      });
      toast.success("All weekly marks & notes saved successfully!");
      fetchMeetingDetail(selectedMeetingId);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to save entries");
    } finally {
      setSaving(false);
    }
  };

  // Declare Results
  const openDeclareModal = () => {
    // Pre-select meeting IDs matching the month if possible
    const currentM = declareMonthYear;
    const matching = meetings
      .filter((m) => m.meetingDate && m.meetingDate.startsWith(currentM))
      .map((m) => m.id);
    setSelectedMeetingIdsForDeclare(matching.length > 0 ? matching : meetings.slice(0, 4).map((m) => m.id));
    setDeclareModalOpen(true);
  };

  const handleDeclareResult = async () => {
    if (selectedMeetingIdsForDeclare.length === 0) {
      toast.error("Please select at least 1 meeting to include in the declaration!");
      return;
    }
    setDeclaring(true);
    try {
      await api.post("/weekly-meetings/declare-result", {
        weekMeetingIds: selectedMeetingIdsForDeclare,
        monthYear: declareMonthYear
      });
      toast.success(`Team Result Declared for ${declareMonthYear}!`);
      setDeclareModalOpen(false);
      // Open Auditorium Reveal directly
      openAuditoriumReveal(declareMonthYear);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to declare team result");
    } finally {
      setDeclaring(false);
    }
  };

  // Auditorium Reveal Presentation
  const openAuditoriumReveal = async (mYear: string = "2026-08") => {
    setRevealMonthYear(mYear);
    setRevealModalOpen(true);
    fetchDeclaredResults(mYear);
  };

  const fetchDeclaredResults = async (mYear: string) => {
    setRevealLoading(true);
    setStage(0);
    setRevealedWeekCount(0);
    setIsAutoTeasing(false);
    setTeasingRankIndex(-1);
    try {
      const data = await api.get<any>(`/weekly-meetings/declared-results/${mYear}`, { showLoader: false });
      setDeclaredData(data);
    } catch (e) {
      console.error(e);
      setDeclaredData(null);
    } finally {
      setRevealLoading(false);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(console.error);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => setIsFullscreen(false)).catch(console.error);
      }
    }
  };

  // Reveal Animation Stage Controller
  const rawParticipants = declaredData?.participants || [];
  const rawTeams = declaredData?.teams || [];
  const meetingsInfo = [...(declaredData?.meetingsInfo || [])].sort((a: any, b: any) =>
    (a.meetingDate || "").localeCompare(b.meetingDate || "")
  );
  const totalWeeks = meetingsInfo.length || 1;

  const getSortedDeclaredParticipants = () => {
    if (!rawParticipants.length) return [];
    const list = [...rawParticipants];

    // Stage 1: Sort by currently revealed week's score
    if (stage === 1 && revealedWeekCount > 0 && revealedWeekCount <= meetingsInfo.length) {
      const activeMeeting = meetingsInfo[revealedWeekCount - 1];
      if (activeMeeting?.id) {
        list.sort((a, b) => {
          const scoreA = Number(a.meetingScores?.[activeMeeting.id] || 0);
          const scoreB = Number(b.meetingScores?.[activeMeeting.id] || 0);
          return scoreB - scoreA;
        });
        return list;
      }
    }

    // Stage 2 & 3: Sort by Total Score
    list.sort((a, b) => Number(b.totalScore || 0) - Number(a.totalScore || 0));
    return list;
  };

  const getSortedDeclaredTeams = () => {
    if (!rawTeams.length) return [];
    const list = [...rawTeams];
    list.sort((a, b) => Number(b.grandTotal || 0) - Number(a.grandTotal || 0));
    return list;
  };

  const sortedDeclaredParticipants = getSortedDeclaredParticipants();
  const sortedDeclaredTeams = getSortedDeclaredTeams();

  // 2-Second Auto-Tease Countdown Effect for Stage 2
  useEffect(() => {
    let timer: any = null;
    if (isAutoTeasing && stage === 2) {
      const totalItems = revealDisplayTab === "individual" ? sortedDeclaredParticipants.length : sortedDeclaredTeams.length;

      if (teasingRankIndex < 0) {
        setTeasingRankIndex(totalItems - 1);
        setTeaseCountdown(2);
      } else if (teasingRankIndex >= 2) {
        if (teaseCountdown > 0) {
          timer = setTimeout(() => setTeaseCountdown((prev) => prev - 1), 1000);
        } else {
          triggerConfetti(false);
          setTeasingRankIndex((prev) => prev - 1);
          setTeaseCountdown(2);
        }
      } else {
        // Paused at Rank 2 for manual Champion coronation
        setIsAutoTeasing(false);
      }
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isAutoTeasing, teaseCountdown, teasingRankIndex, stage, revealDisplayTab, sortedDeclaredParticipants.length, sortedDeclaredTeams.length]);

  const handleNextStage = () => {
    if (stage === 0) {
      setStage(1);
      setRevealedWeekCount(1);
    } else if (stage === 1) {
      if (revealedWeekCount < totalWeeks) {
        setRevealedWeekCount((prev) => prev + 1);
      } else {
        setStage(2);
        const totalItems = revealDisplayTab === "individual" ? sortedDeclaredParticipants.length : sortedDeclaredTeams.length;
        setTeasingRankIndex(totalItems - 1);
        setTeaseCountdown(2);
        setIsAutoTeasing(true);
      }
    } else if (stage === 2) {
      setIsAutoTeasing(false);
      setStage(3);
      triggerConfetti(true);
    }
  };

  // Keyboard navigation for Auditorium Reveal: Space advances stage, Esc closes
  useEffect(() => {
    if (!revealModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        handleNextStage();
      } else if (e.code === "Escape") {
        setRevealModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [revealModalOpen, stage, revealedWeekCount, totalWeeks, isAutoTeasing]);

  // Grouped vs Flat sorting for Main Matrix
  const isTL = (p: Participant) => {
    if (p.isTeamLeader) return true;
    const d = (p.designation || "").toLowerCase();
    const r = (p.role || "").toLowerCase();
    return ["team leader", "tl", "team lead", "lead", "head"].some((term) => d.includes(term) || r.includes(term));
  };

  interface DeptGroup {
    department: string;
    teamLeaders: Participant[];
    members: Participant[];
    all: Participant[];
  }

  const getGroupedMatrixParticipants = (): DeptGroup[] => {
    if (!meetingDetail || !meetingDetail.participants) return [];
    const map: Record<string, Participant[]> = {};

    meetingDetail.participants.forEach((p: Participant) => {
      const dept = (p.department || "General").trim();
      if (!map[dept]) map[dept] = [];
      map[dept].push(p);
    });

    return Object.keys(map).sort().map((dept) => {
      const raw = map[dept] ?? [];
      const tls = raw.filter(isTL);
      const members = raw.filter((p) => !isTL(p));

      const sortFn = (a: Participant, b: Participant) => {
        const tlA = isTL(a) ? 1 : 0;
        const tlB = isTL(b) ? 1 : 0;
        if (tlB !== tlA) return tlB - tlA;

        if (sortBy === "total") {
          const scoreA = calculateEmployeeSum(a.id);
          const scoreB = calculateEmployeeSum(b.id);
          if (scoreB !== scoreA) return scoreB - scoreA;
        }
        return (a.name || "").localeCompare(b.name || "");
      };

      return {
        department: dept,
        teamLeaders: tls,
        members,
        all: [...raw].sort(sortFn)
      };
    });
  };

  const getSortedMatrixParticipants = () => {
    if (!meetingDetail || !meetingDetail.participants) return [];
    return [...meetingDetail.participants].sort((a: Participant, b: Participant) => {
      if (sortBy === "total") {
        const scoreA = calculateEmployeeSum(a.id);
        const scoreB = calculateEmployeeSum(b.id);
        if (scoreB !== scoreA) return scoreB - scoreA;
      }
      return (a.name || "").localeCompare(b.name || "");
    });
  };

  const championParticipant = sortedDeclaredParticipants.length > 0 ? sortedDeclaredParticipants[0] : null;
  const championTeam = sortedDeclaredTeams.length > 0 ? sortedDeclaredTeams[0] : null;

  return (
    <div className="w-full min-w-0 space-y-4 sm:space-y-6 animate-in fade-in duration-500 pb-20">
      {/* Top Header Card */}
      <div className="flex flex-col 2xl:flex-row 2xl:items-center justify-between gap-3 sm:gap-4 bg-card p-4 sm:p-6 rounded-2xl shadow-sm border border-border/70">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-3 bg-gradient-to-tr from-blue-600 to-indigo-500 text-white rounded-xl shadow-md shadow-blue-500/20 shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold text-foreground tracking-tight flex flex-wrap items-center gap-2">
              <span>Team Leader of the Week</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold border border-blue-500/20">
                Evaluation & Tracker
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              TL Meeting weekly marks evaluation, department aggregation & auditorium celebration.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2.5">
          {isAdmin && (
            <>
              <button
                type="button"
                onClick={openDeclareModal}
                className="col-span-2 sm:col-span-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 text-amber-950 font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-amber-500/25 transition-all uppercase tracking-wide cursor-pointer active:scale-95"
              >
                <Sparkles className="w-4 h-4 fill-amber-950" />
                Declare Team Result
              </button>

              <button
                type="button"
                onClick={() => setLaunchRevealModalOpen(true)}
                className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-slate-900 dark:bg-slate-800 text-amber-400 text-xs sm:text-sm font-bold rounded-xl border border-amber-500/40 hover:bg-slate-800 dark:hover:bg-slate-700 transition-all shadow-sm cursor-pointer"
              >
                <Play className="w-4 h-4 fill-amber-400 text-amber-400" />
                Auditorium Reveal
              </button>

              <button
                type="button"
                onClick={fetchMasterTopics}
                className="col-span-2 order-4 sm:order-none sm:col-span-1 flex items-center justify-center gap-2 px-3.5 py-2 bg-muted hover:bg-muted/80 text-foreground text-xs sm:text-sm font-semibold rounded-xl transition-all border border-border cursor-pointer"
              >
                <Settings className="w-4 h-4 text-muted-foreground" />
                Master Topics Template
              </button>

              <button
                type="button"
                onClick={openNewMeetingModal}
                className="order-3 sm:order-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4" />
                New Weekly Meeting
              </button>
            </>
          )}
        </div>
      </div>

      {/* Horizontal Date Blocks Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground px-1">
          <span>Weekly Meeting Blocks ({meetings.length})</span>
          <span className="text-[11px]">Click a date block to load sheet</span>
        </div>
        <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-thin">
          {meetings.length === 0 ? (
            <div className="w-full bg-card rounded-xl p-4 text-center text-xs text-muted-foreground border border-dashed border-border">
              No weekly meetings found. Click "+ New Weekly Meeting" to create the first meeting.
            </div>
          ) : (
            meetings.map((m) => {
              const isSelected = selectedMeetingId === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedMeetingId(m.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap border shadow-sm cursor-pointer",
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20 scale-[1.02]"
                      : "bg-card text-foreground hover:bg-muted/80 border-border/70"
                  )}
                >
                  <Calendar className="w-4 h-4 opacity-80" />
                  <span>{m.meetingDate}</span>
                  <Badge
                    variant={isSelected ? "secondary" : "outline"}
                    className={cn(
                      "ml-1 text-[10px] px-1.5 py-0 h-4 rounded-md font-semibold",
                      isSelected ? "bg-primary-foreground/20 text-primary-foreground border-none" : "bg-muted"
                    )}
                  >
                    {m.participantEmployeeIds?.length || 0} Participants
                  </Badge>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Evaluation Matrix Sheet */}
      {detailLoading ? (
        <div className="bg-card rounded-2xl border border-border/60 p-16 text-center text-muted-foreground space-y-3">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold">Loading meeting evaluation matrix...</p>
        </div>
      ) : !meetingDetail ? (
        <div className="bg-card rounded-2xl border border-border/60 p-16 text-center text-muted-foreground space-y-3">
          <Award className="w-12 h-12 text-muted-foreground/40 mx-auto" />
          <h3 className="text-base font-bold text-foreground">No Meeting Selected</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Select a meeting date from the horizontal bar above, or create a new meeting to evaluate team members.
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border/70 shadow-sm overflow-hidden p-4 sm:p-6 space-y-4">
          <div className="flex flex-col 2xl:flex-row 2xl:items-center justify-between gap-3 sm:gap-4">
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                <span>TL Meeting Evaluation ({meetingDetail.meetingDate})</span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Total Max Score: <strong className="text-blue-600 dark:text-blue-400 font-bold">{calculateTotalMaxMarks()} pts</strong> across {meetingDetail.topics?.length || 0} topics ({meetingDetail.participants?.length || 0} Participants)
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Grouped vs Flat View Toggle */}
              <div className="flex items-center p-1 bg-muted rounded-xl text-xs font-bold border border-border">
                <button
                  type="button"
                  onClick={() => setViewMode("grouped")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg transition-all cursor-pointer",
                    viewMode === "grouped" ? "bg-background text-primary shadow-sm font-black" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  🏢 Grouped by Team
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("flat")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg transition-all cursor-pointer",
                    viewMode === "flat" ? "bg-background text-primary shadow-sm font-black" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  📋 Flat List
                </button>
              </div>

              {/* Sort Toggle */}
              <button
                type="button"
                onClick={() => setSortBy((prev) => (prev === "total" ? "name" : "total"))}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground border border-border text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span>Sort: {sortBy === "total" ? "Highest Score" : "Name A-Z"}</span>
              </button>

              {isAdmin && (
                <>
                  <button
                    type="button"
                    onClick={openParticipantModal}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-xl transition-colors border border-indigo-500/20 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Edit Participants ({meetingDetail.participants?.length || 0})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTopicModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold rounded-xl transition-colors border border-border cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Configure Topics</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeleteModalOpen(true)}
                    className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors border border-rose-500/20 cursor-pointer"
                    title="Delete meeting block"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={handleSaveAllEntries}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? "Saving..." : "Save Marks & Notes"}</span>
              </button>
            </div>
          </div>

          {/* Sticky Matrix Table */}
          <div className="overflow-auto max-h-[68vh] rounded-xl border border-border relative">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="sticky top-0 z-30 bg-muted/90 backdrop-blur-md border-b border-border text-muted-foreground font-bold uppercase tracking-wider text-[11px]">
                  <th className="sticky top-0 left-0 z-40 bg-muted px-3 py-3 w-[45px] text-center border-r border-border">
                    #
                  </th>
                  <th className="sticky top-0 left-[45px] z-40 bg-muted px-4 py-3 min-w-[200px] border-r border-border shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)]">
                    Employee
                  </th>

                  {/* Topics Columns */}
                  {(meetingDetail.topics || []).map((t: Topic) => (
                    <th key={t.id || t.name} className="py-3 px-3 text-center min-w-[130px] border-r border-border/60">
                      <div className="font-bold text-foreground truncate max-w-[150px] mx-auto">{t.name}</div>
                      <span className="text-[10px] text-blue-500 dark:text-blue-400 lowercase font-semibold block">
                        (max {t.maxMarks} pts)
                      </span>
                    </th>
                  ))}

                  <th className="py-3 px-4 text-center min-w-[120px] bg-emerald-500/10 border-r border-border/60 text-emerald-600 dark:text-emerald-400 font-black">
                    TOTAL SUM
                  </th>
                  <th className="py-3 px-4 min-w-[200px] border-r border-border/60">Focus Task Note</th>
                  <th className="py-3 px-4 min-w-[200px] border-r border-border/60">Commitment Note</th>
                  <th className="py-3 px-4 min-w-[100px] text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-medium text-foreground">
                {(() => {
                  const renderRow = (p: Participant, idx: number) => {
                    const empId = p.id;
                    const empSum = calculateEmployeeSum(empId);
                    const totalMax = calculateTotalMaxMarks();
                    const isSavingThis = savingRowMap[empId];

                    return (
                      <tr key={empId} className="hover:bg-muted/30 transition-colors group">
                        <td className="sticky left-0 bg-card group-hover:bg-muted/50 px-3 py-3 text-center text-muted-foreground border-r border-border font-mono text-xs">
                          {idx + 1}
                        </td>
                        <td className="sticky left-[45px] bg-card group-hover:bg-muted/50 px-4 py-3 border-r border-border shadow-[4px_0_8px_-2px_rgba(0,0,0,0.06)]">
                          <div className="font-bold text-sm text-foreground flex items-center gap-1.5">
                            <span>{p.name}</span>
                            {isTL(p) && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[10px] font-black shrink-0">
                                👑 TL
                              </span>
                            )}
                          </div>
                          <div className="flex gap-1 mt-1">
                            <Badge variant="outline" className="text-[9px] h-4 px-1 rounded bg-muted/60">
                              {p.department || "General"}
                            </Badge>
                            <Badge variant="secondary" className="text-[9px] h-4 px-1 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border-none">
                              {p.designation || "Staff"}
                            </Badge>
                          </div>
                        </td>

                        {/* Topics Inputs */}
                        {(meetingDetail.topics || []).map((t: Topic) => {
                          const topicId = String(t.id);
                          const currentVal = marksState[empId]?.[topicId] ?? "";
                          const numVal = currentVal !== "" ? Number(currentVal) : NaN;
                          const isExceeded = !isNaN(numVal) && numVal > Number(t.maxMarks);

                          return (
                            <td key={topicId} className="py-2 px-2 text-center border-r border-border/50">
                              <div className="flex flex-col items-center">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={currentVal}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    if (v === "" || /^\d*\.?\d*$/.test(v)) {
                                      handleMarksChange(empId, topicId, v === "" ? 0 : Number(v));
                                    }
                                  }}
                                  placeholder="0"
                                  className={cn(
                                    "w-18 sm:w-20 px-2 py-1.5 border rounded-lg text-center font-bold text-xs outline-none transition-all",
                                    isExceeded
                                      ? "bg-rose-500/10 border-rose-500 text-rose-600 ring-1 ring-rose-500"
                                      : "bg-muted/50 border-border text-foreground focus:bg-background focus:border-primary focus:ring-1 focus:ring-primary"
                                  )}
                                />
                                {isExceeded && (
                                  <span className="text-[9px] text-rose-500 font-bold mt-0.5">Max {t.maxMarks}</span>
                                )}
                              </div>
                            </td>
                          );
                        })}

                        {/* Total Sum */}
                        <td className="py-3 px-4 text-center bg-emerald-500/5 font-black text-emerald-600 dark:text-emerald-400 border-r border-border/50 text-base">
                          {empSum}{" "}
                          <span className="text-[11px] text-muted-foreground font-semibold">/ {totalMax}</span>
                        </td>

                        {/* Focus Task Note */}
                        <td className="py-2 px-3 border-r border-border/50">
                          <textarea
                            rows={2}
                            value={focusTaskNotes[empId] || ""}
                            onChange={(e) => setFocusTaskNotes({ ...focusTaskNotes, [empId]: e.target.value })}
                            placeholder="Next meeting focus task notes..."
                            className="w-full text-xs p-2 bg-muted/40 border border-border/80 rounded-lg focus:bg-background focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none transition-all"
                          />
                        </td>

                        {/* Commitment Note */}
                        <td className="py-2 px-3 border-r border-border/50">
                          <textarea
                            rows={2}
                            value={commitmentNotes[empId] || ""}
                            onChange={(e) => setCommitmentNotes({ ...commitmentNotes, [empId]: e.target.value })}
                            placeholder="Commitment & milestone notes..."
                            className="w-full text-xs p-2 bg-muted/40 border border-border/80 rounded-lg focus:bg-background focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none transition-all"
                          />
                        </td>

                        {/* Row Save Action */}
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleSaveSingleRow(empId)}
                            disabled={isSavingThis}
                            className="flex items-center gap-1 mx-auto px-2.5 py-1.5 bg-primary/10 hover:bg-primary hover:text-primary-foreground text-primary rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>{isSavingThis ? "..." : "Save"}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  };

                  if (viewMode === "grouped") {
                    const groups = getGroupedMatrixParticipants();
                    const totalCols = 5 + (meetingDetail.topics?.length || 0);

                    return groups.map((group) => (
                      <React.Fragment key={`group-${group.department}`}>
                        <tr className="bg-slate-900 text-white font-bold border-y-2 border-slate-700 sticky z-10">
                          <td colSpan={totalCols} className="px-4 py-2.5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-xs sm:text-sm font-black text-amber-400 uppercase tracking-wider">
                                <Users className="w-4 h-4 text-amber-400 shrink-0" />
                                <span>{group.department} Team</span>
                                <span className="text-slate-300 font-medium text-xs normal-case">
                                  ({group.all.length} {group.all.length === 1 ? "Member" : "Members"})
                                </span>
                              </div>
                              {group.teamLeaders.length > 0 ? (
                                <div className="flex items-center gap-1.5 text-xs bg-amber-400 text-slate-950 px-3 py-1 rounded-full font-extrabold shadow-xs">
                                  <span>👑 Team Leader:</span>
                                  <span>{group.teamLeaders.map((tl) => tl.name).join(", ")}</span>
                                </div>
                              ) : (
                                <span className="text-[11px] text-slate-400 font-normal italic">No assigned Team Leader</span>
                              )}
                            </div>
                          </td>
                        </tr>
                        {group.all.map((p, idx) => renderRow(p, idx))}
                      </React.Fragment>
                    ));
                  }

                  return getSortedMatrixParticipants().map((p, idx) => renderRow(p, idx));
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DIALOG 1: Create New Weekly Meeting */}
      <Dialog open={newMeetingModalOpen} onOpenChange={setNewMeetingModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              <span>Create New Weekly Meeting Block</span>
            </DialogTitle>
            <DialogDescription>
              Specify the meeting date and choose the participants. All Team Leaders and HR staff are auto-selected.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            <div>
              <label className="block text-xs font-bold text-foreground mb-1">Meeting Date</label>
              <input
                type="date"
                value={newMeetingDate}
                onChange={(e) => setNewMeetingDate(e.target.value)}
                className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl font-semibold text-foreground outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground mb-1">
                Select Participants ({selectedParticipantIds.length} selected)
              </label>
              <div className="max-h-52 overflow-y-auto border border-border rounded-xl p-2 space-y-1 bg-muted/20">
                {allEmployees.map((emp) => {
                  const isChecked = selectedParticipantIds.includes(emp.id);
                  return (
                    <label
                      key={emp.id}
                      className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted cursor-pointer text-xs transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedParticipantIds([...selectedParticipantIds, emp.id]);
                          } else {
                            setSelectedParticipantIds(selectedParticipantIds.filter((id) => id !== emp.id));
                          }
                        }}
                        className="rounded text-primary focus:ring-primary"
                      />
                      <span className="font-semibold text-foreground">{emp.name}</span>
                      <span className="text-muted-foreground text-[10px] ml-auto">
                        ({emp.department} • {emp.roleBadge})
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={copyTopicsFromLast}
                onChange={(e) => setCopyTopicsFromLast(e.target.checked)}
                className="rounded text-primary focus:ring-primary"
              />
              <span>Copy Topics from last meeting (or load from Master Topics Template)</span>
            </label>
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => setNewMeetingModalOpen(false)}
              className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateMeeting}
              disabled={creatingMeeting}
              className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl shadow-md cursor-pointer disabled:opacity-50"
            >
              {creatingMeeting ? "Creating..." : "Create Meeting"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 2: Edit Participants */}
      <Dialog open={participantModalOpen} onOpenChange={setParticipantModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-indigo-500" />
              <span>Edit Participants for {meetingDetail?.meetingDate}</span>
            </DialogTitle>
            <DialogDescription>
              Add or remove attendees evaluated in this meeting block.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-2">
            <div className="max-h-60 overflow-y-auto border border-border rounded-xl p-2 space-y-1 bg-muted/20">
              {allEmployees.map((emp) => {
                const isChecked = editParticipantIds.includes(emp.id);
                return (
                  <label
                    key={emp.id}
                    className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted cursor-pointer text-xs transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setEditParticipantIds([...editParticipantIds, emp.id]);
                        } else {
                          setEditParticipantIds(editParticipantIds.filter((id) => id !== emp.id));
                        }
                      }}
                      className="rounded text-primary focus:ring-primary"
                    />
                    <span className="font-semibold text-foreground">{emp.name}</span>
                    <span className="text-muted-foreground text-[10px] ml-auto">
                      ({emp.department} • {emp.roleBadge})
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => setParticipantModalOpen(false)}
              className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveParticipants}
              disabled={savingParticipants}
              className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl shadow-md cursor-pointer disabled:opacity-50"
            >
              {savingParticipants ? "Saving..." : "Save Participants"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 3: Configure Topics for Meeting */}
      <Dialog open={topicModalOpen} onOpenChange={setTopicModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-primary" />
              <span>Configure Topics for {meetingDetail?.meetingDate}</span>
            </DialogTitle>
            <DialogDescription>
              Customize evaluation topics and maximum points for this specific meeting.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-2 max-h-72 overflow-y-auto">
            {topicsState.map((t, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="w-6 text-xs text-muted-foreground font-mono">{idx + 1}</span>
                <input
                  type="text"
                  value={t.name}
                  onChange={(e) => {
                    const next = [...topicsState];
                    const item = next[idx];
                    if (item) {
                      item.name = e.target.value;
                      setTopicsState(next);
                    }
                  }}
                  className="flex-1 px-3 py-1.5 border border-border rounded-lg text-xs font-semibold bg-muted/40 text-foreground outline-none focus:border-primary"
                  placeholder="Topic name"
                />
                <input
                  type="text"
                  inputMode="decimal"
                  value={t.maxMarks}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "" || /^\d*\.?\d*$/.test(v)) {
                      const next = [...topicsState];
                      const item = next[idx];
                      if (item) {
                        item.maxMarks = v === "" ? 0 : Number(v);
                        setTopicsState(next);
                      }
                    }
                  }}
                  className="w-20 px-2 py-1.5 border border-border rounded-lg text-xs font-bold text-center bg-muted/40 text-foreground outline-none focus:border-primary"
                  placeholder="Max"
                />
                <span className="text-xs text-muted-foreground">pts</span>
                <button
                  type="button"
                  onClick={() => setTopicsState(topicsState.filter((_, i) => i !== idx))}
                  className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={() => setTopicsState([...topicsState, { name: `Topic ${topicsState.length + 1}`, maxMarks: 20 }])}
              className="flex items-center gap-1 text-xs text-primary font-bold hover:underline pt-2 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Topic</span>
            </button>
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => setTopicModalOpen(false)}
              className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveTopics}
              disabled={savingTopics}
              className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl shadow-md cursor-pointer disabled:opacity-50"
            >
              {savingTopics ? "Saving..." : "Save Topics"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 4: Master Topics Template */}
      <Dialog open={masterModalOpen} onOpenChange={setMasterModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              <span>Master Weekly Topics Template</span>
            </DialogTitle>
            <DialogDescription>
              Global default topics automatically loaded when a new weekly meeting block is created.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-2 max-h-72 overflow-y-auto">
            {masterTopicsState.map((mt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="w-6 text-xs text-muted-foreground font-mono">{idx + 1}</span>
                <input
                  type="text"
                  value={mt.name}
                  onChange={(e) => {
                    const next = [...masterTopicsState];
                    const item = next[idx];
                    if (item) {
                      item.name = e.target.value;
                      setMasterTopicsState(next);
                    }
                  }}
                  className="flex-1 px-3 py-1.5 border border-border rounded-lg text-xs font-semibold bg-muted/40 text-foreground outline-none focus:border-primary"
                />
                <input
                  type="text"
                  inputMode="decimal"
                  value={mt.maxMarks}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "" || /^\d*\.?\d*$/.test(v)) {
                      const next = [...masterTopicsState];
                      const item = next[idx];
                      if (item) {
                        item.maxMarks = v === "" ? 0 : Number(v);
                        setMasterTopicsState(next);
                      }
                    }
                  }}
                  className="w-20 px-2 py-1.5 border border-border rounded-lg text-xs font-bold text-center bg-muted/40 text-foreground outline-none focus:border-primary"
                />
                <span className="text-xs text-muted-foreground">pts</span>
                <button
                  type="button"
                  onClick={() => setMasterTopicsState(masterTopicsState.filter((_, i) => i !== idx))}
                  className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={() => setMasterTopicsState([...masterTopicsState, { name: `Master Topic ${masterTopicsState.length + 1}`, maxMarks: 20 }])}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 text-xs font-bold rounded-lg border border-blue-500/20 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Master Topic</span>
            </button>
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => setMasterModalOpen(false)}
              className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveMasterTopics}
              disabled={savingMaster}
              className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl shadow-md cursor-pointer disabled:opacity-50"
            >
              {savingMaster ? "Saving..." : "Save Master Template"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 5: Delete Meeting */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <Trash2 className="w-5 h-5" />
              <span>Delete Weekly Meeting Block?</span>
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete the meeting block for date{" "}
              <strong>{meetingDetail?.meetingDate}</strong>? All marks and notes will be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setDeleteModalOpen(false)}
              className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDeleteMeeting}
              disabled={deleting}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer disabled:opacity-50"
            >
              {deleting ? "Deleting..." : "Delete Permanently"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 6: Declare Result */}
      <Dialog open={declareModalOpen} onOpenChange={setDeclareModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Sparkles className="w-5 h-5 text-amber-500 fill-amber-500" />
              <span>Declare Team Result</span>
            </DialogTitle>
            <DialogDescription>
              Select the evaluation month and pick the weekly meetings to calculate team totals & EOM bonuses.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            <div>
              <label className="block text-xs font-bold text-foreground mb-1">Target Evaluation Month</label>
              <input
                type="month"
                value={declareMonthYear}
                onChange={(e) => setDeclareMonthYear(e.target.value)}
                className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl font-bold text-foreground outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground mb-1">
                Select Weekly Meetings ({selectedMeetingIdsForDeclare.length} selected)
              </label>
              <div className="max-h-48 overflow-y-auto border border-border rounded-xl p-2 space-y-1.5 bg-muted/20">
                {meetings.map((m) => {
                  const isChecked = selectedMeetingIdsForDeclare.includes(m.id);
                  return (
                    <label
                      key={m.id}
                      className="flex items-center gap-2.5 p-2 rounded-lg bg-card border border-border/60 hover:bg-muted cursor-pointer text-xs font-medium transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedMeetingIdsForDeclare([...selectedMeetingIdsForDeclare, m.id]);
                          } else {
                            setSelectedMeetingIdsForDeclare(selectedMeetingIdsForDeclare.filter((id) => id !== m.id));
                          }
                        }}
                        className="rounded text-amber-600 focus:ring-amber-500"
                      />
                      <span className="font-bold text-foreground">Meeting on {m.meetingDate}</span>
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        ({m.participantEmployeeIds?.length || 0} participants)
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => setDeclareModalOpen(false)}
              className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeclareResult}
              disabled={declaring}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-xl shadow-md cursor-pointer disabled:opacity-50 uppercase tracking-wider"
            >
              {declaring ? "Declaring..." : "Confirm & Declare"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 6.5: AUDITORIUM REVEAL SETUP / SELECTION PROMPT */}
      <Dialog open={launchRevealModalOpen} onOpenChange={setLaunchRevealModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 sm:p-7">
          <DialogHeader>
            <div className="flex items-center gap-2 text-amber-500 font-bold mb-1">
              <Sparkles className="w-5 h-5 fill-amber-500" />
              <span className="text-xs uppercase tracking-wider font-extrabold">Auditorium Setup</span>
            </div>
            <DialogTitle className="text-xl font-black text-foreground">
              Launch Auditorium Reveal
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Choose the evaluation month and display perspective to present on the grand auditorium stage.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">
                Target Evaluation Month
              </label>
              <input
                type="month"
                value={revealMonthYear}
                onChange={(e) => setRevealMonthYear(e.target.value)}
                className="w-full bg-background text-foreground font-bold border border-input rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-500"
              />
              {/* Quick Month Chips */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {Array.from(new Set(meetings.map((m) => m.meetingDate?.slice(0, 7)).filter(Boolean)))
                  .sort()
                  .reverse()
                  .slice(0, 4)
                  .map((mStr) => (
                    <button
                      key={mStr}
                      type="button"
                      onClick={() => setRevealMonthYear(mStr as string)}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer",
                        revealMonthYear === mStr
                          ? "bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-500/50"
                          : "bg-muted text-muted-foreground border-transparent hover:bg-muted/80"
                      )}
                    >
                      {mStr}
                    </button>
                  ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">
                Presentation Focus Mode
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRevealDisplayTab("individual")}
                  className={cn(
                    "p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between",
                    revealDisplayTab === "individual"
                      ? "bg-amber-500/10 border-amber-500/60 text-foreground ring-1 ring-amber-500"
                      : "bg-muted/50 border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  <div className="p-2 rounded-xl bg-amber-500/20 text-amber-500 w-fit mb-2">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold">Individual TLs</div>
                    <div className="text-[10px] text-muted-foreground">Weekly marks & TL champion</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setRevealDisplayTab("team")}
                  className={cn(
                    "p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between",
                    revealDisplayTab === "team"
                      ? "bg-amber-500/10 border-amber-500/60 text-foreground ring-1 ring-amber-500"
                      : "bg-muted/50 border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  <div className="p-2 rounded-xl bg-blue-500/20 text-blue-500 w-fit mb-2">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold">Team Rankings</div>
                    <div className="text-[10px] text-muted-foreground">Department aggregate totals</div>
                  </div>
                </button>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <button
              type="button"
              onClick={() => setLaunchRevealModalOpen(false)}
              className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setLaunchRevealModalOpen(false);
                openAuditoriumReveal(revealMonthYear);
              }}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 text-slate-950 text-xs font-black rounded-xl shadow-lg shadow-amber-500/30 hover:scale-105 active:scale-95 transition-all cursor-pointer uppercase tracking-wider"
            >
              <Play className="w-3.5 h-3.5 fill-slate-950" />
              <span>Launch Auditorium</span>
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 7: AUDITORIUM REVEAL (Fullscreen Grand Finale Celebration) */}
      {revealModalOpen && (
        <div className="fixed inset-0 z-[999999] w-screen h-screen bg-[#070913] text-white overflow-y-auto select-none font-sans p-4 sm:p-8 space-y-6 animate-in fade-in duration-300">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Ambient Background Glows */}
            <div className="absolute -top-32 -left-32 w-80 h-80 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute top-1/3 right-0 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

            {/* Top Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 backdrop-blur-md p-4 sm:p-5 rounded-3xl border border-slate-800 shadow-2xl relative z-10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500 text-slate-950 rounded-2xl shadow-md">
                  <Sparkles className="w-5 h-5 fill-slate-950" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
                    <span>Auditorium Reveal — Weekly & Team Champions</span>
                  </h2>
                  <p className="text-xs text-amber-300 font-semibold">
                    Grand Finale Stage Presentation for Month: {revealMonthYear} • Press <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] font-mono">SPACE</kbd> to Advance
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Fullscreen Toggle */}
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer",
                    isFullscreen
                      ? "bg-amber-500 text-slate-950 border-amber-400"
                      : "bg-slate-800 hover:bg-slate-700 text-amber-400 border-amber-500/40"
                  )}
                >
                  {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
                  <span>{isFullscreen ? "Exit Fullscreen" : "Fullscreen"}</span>
                </button>

                {/* Tab Switcher */}
                <div className="flex items-center p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      setRevealDisplayTab("individual");
                      setStage(0);
                      setRevealedWeekCount(0);
                      setIsAutoTeasing(false);
                    }}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all cursor-pointer",
                      revealDisplayTab === "individual" ? "bg-amber-500 text-slate-950 shadow-md font-black" : "text-slate-400 hover:text-white"
                    )}
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>TL / Individual</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRevealDisplayTab("team");
                      setStage(0);
                      setRevealedWeekCount(0);
                      setIsAutoTeasing(false);
                    }}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all cursor-pointer",
                      revealDisplayTab === "team" ? "bg-amber-500 text-slate-950 shadow-md font-black" : "text-slate-400 hover:text-white"
                    )}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Team Summary</span>
                  </button>
                </div>

                {/* Month Input */}
                <input
                  type="month"
                  value={revealMonthYear}
                  onChange={(e) => {
                    setRevealMonthYear(e.target.value);
                    fetchDeclaredResults(e.target.value);
                  }}
                  className="bg-slate-800 text-white font-bold border border-slate-700 rounded-xl px-2.5 py-1 text-xs outline-none"
                />

                <button
                  type="button"
                  onClick={() => fetchDeclaredResults(revealMonthYear)}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all border border-slate-700 cursor-pointer"
                  title="Reload Results"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setRevealModalOpen(false)}
                  className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-xl transition-all cursor-pointer"
                  title="Close Auditorium Reveal (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Main Presentation Content */}
            {revealLoading ? (
              <div className="py-24 text-center">
                <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-400">Loading auditorium presentation data...</p>
              </div>
            ) : !declaredData || (!sortedDeclaredParticipants.length && !sortedDeclaredTeams.length) ? (
              <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-800 p-12 text-center text-slate-400 space-y-3 my-auto">
                <Trophy className="w-14 h-14 text-slate-600 mx-auto" />
                <h3 className="text-xl font-bold text-white">No Declared Results Found for {revealMonthYear}</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Click <strong>"Declare Team Result"</strong> on the main page to aggregate weekly meeting scores for this month.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Control Action Toolbar */}
                <div className="bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                    <span>Month: <strong className="text-amber-400">{revealMonthYear}</strong></span>
                    <span>•</span>
                    <span>Meetings: <strong className="text-emerald-400">{meetingsInfo.length}</strong></span>
                    {stage === 1 && (
                      <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full font-bold">
                        📍 Week {revealedWeekCount} Revealed
                      </span>
                    )}
                    {(stage === 2 || stage === 3) && (
                      <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full font-bold">
                        🏆 Total Scores Active
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {stage < 3 ? (
                      <button
                        type="button"
                        onClick={handleNextStage}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 text-slate-950 font-black rounded-xl shadow-lg shadow-amber-500/30 hover:scale-105 active:scale-95 transition-all cursor-pointer uppercase tracking-wider text-xs"
                      >
                        <Play className="w-4 h-4 fill-slate-950" />
                        <span>
                          {stage === 0
                            ? "Start Auditorium Reveal"
                            : stage === 1
                            ? revealedWeekCount < totalWeeks
                              ? `Reveal Week ${revealedWeekCount + 1}`
                              : "Reveal Total Sums"
                            : "Crown Champion (Reveal Top 2)"}
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setStage(0);
                          setRevealedWeekCount(0);
                          setIsAutoTeasing(false);
                        }}
                        className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold rounded-xl transition-all border border-amber-500/30 cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>Replay Animation</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* 2-Second Auto-Tease Countdown Bar */}
                {isAutoTeasing && stage === 2 && teasingRankIndex >= 2 && (
                  <div className="bg-gradient-to-r from-purple-900/80 via-indigo-900/80 to-purple-900/80 border border-purple-500/60 p-4 rounded-2xl flex items-center justify-between gap-4 shadow-xl animate-in fade-in">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-purple-500 text-white font-black flex items-center justify-center text-base animate-pulse">
                        {teaseCountdown}s
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-purple-300 uppercase tracking-widest flex items-center gap-1">
                          <Timer className="w-3.5 h-3.5" />
                          <span>2-Second Countdown Active (Revealing Ranks up to #3)</span>
                        </div>
                        <div className="text-xs font-bold text-white mt-0.5">
                          Revealing Rank #{teasingRankIndex + 1}:{" "}
                          <span className="text-amber-300 font-extrabold">
                            {revealDisplayTab === "individual"
                              ? sortedDeclaredParticipants[teasingRankIndex]?.name
                              : sortedDeclaredTeams[teasingRankIndex]?.department}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAutoTeasing(false);
                        setTeasingRankIndex(2);
                      }}
                      className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer"
                    >
                      Fast-Forward
                    </button>
                  </div>
                )}

                {/* Stage 3 Grand Champion Golden Banner */}
                {stage === 3 && (
                  <div className="bg-gradient-to-r from-amber-500/20 via-yellow-500/30 to-amber-500/20 border-2 border-amber-400/80 p-6 sm:p-8 rounded-3xl text-center space-y-3 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-500">
                    <div className="w-16 h-16 bg-gradient-to-tr from-amber-400 to-yellow-300 text-slate-950 rounded-full flex items-center justify-center mx-auto shadow-xl">
                      <Crown className="w-10 h-10 fill-slate-950" />
                    </div>

                    {revealDisplayTab === "individual" && championParticipant ? (
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-black text-amber-300 uppercase tracking-widest">
                          🏆 TEAM LEADER / EMPLOYEE CHAMPION 🏆
                        </span>
                        <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                          {championParticipant.name}
                        </h2>
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-400/20 border border-amber-400/50 rounded-full text-amber-200 text-xs font-bold">
                          <span>🏢 {championParticipant.department} Department</span>
                          {championParticipant.designation && <span>• {championParticipant.designation}</span>}
                        </div>
                        <div className="text-xl sm:text-3xl font-black text-amber-400 pt-1">
                          Total Score: {championParticipant.totalScore} pts
                        </div>
                      </div>
                    ) : championTeam ? (
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-black text-amber-300 uppercase tracking-widest">
                          🏆 TEAM OF THE MONTH CHAMPION 🏆
                        </span>
                        <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                          {championTeam.department} Team
                        </h2>
                        {championTeam.teamLeaders?.length > 0 && (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-400/20 border border-amber-400/50 rounded-full text-amber-200 text-xs font-bold">
                            👑 Team Leader: {championTeam.teamLeaders.map((tl: any) => tl.name).join(", ")}
                          </div>
                        )}
                        <div className="text-xl sm:text-3xl font-black text-amber-400 pt-1">
                          Grand Total Score: {championTeam.grandTotal} pts
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Table for TL / Individual Flat List */}
                {revealDisplayTab === "individual" && (
                  <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
                    <div className="p-3 sm:p-4 border-b border-slate-800 flex items-center justify-between text-xs sm:text-sm font-bold text-white">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-amber-400" />
                        <span>Team Leader / Participant Standings ({sortedDeclaredParticipants.length})</span>
                      </div>
                      {stage === 1 && (
                        <span className="text-[11px] font-extrabold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-lg border border-amber-500/30">
                          Sorted by Week {revealedWeekCount} Highest Score
                        </span>
                      )}
                    </div>

                    <div className="overflow-x-auto max-h-[50vh]">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-950/80 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-800">
                            <th className="py-3 px-3 text-center w-12">Rank</th>
                            <th className="py-3 px-4 min-w-[200px]">Participant</th>
                            <th className="py-3 px-3 min-w-[120px]">Department</th>
                            {meetingsInfo.map((m: any, idx: number) => {
                              const isCur = stage === 1 && idx === revealedWeekCount - 1;
                              return (
                                <th
                                  key={m.id || idx}
                                  className={cn(
                                    "py-3 px-3 text-center min-w-[100px]",
                                    isCur ? "bg-amber-500/20 text-amber-300 font-black border-x border-amber-500/40" : "bg-slate-950/40"
                                  )}
                                >
                                  Week ({m.meetingDate || `W${idx + 1}`})
                                </th>
                              );
                            })}
                            <th className="py-3 px-4 text-center min-w-[120px] bg-amber-950/40 text-amber-300 font-black">
                              Total Sum
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-semibold text-slate-300">
                          {sortedDeclaredParticipants.map((p: any, index: number) => {
                            const isWinner = index === 0 && stage === 3;
                            const isCurrentlyTeased = isAutoTeasing && index === teasingRankIndex;
                            const isTotalSumRevealed = stage === 3 || (stage === 2 && index >= 2 && (teasingRankIndex < 0 || index >= teasingRankIndex));
                            const isVisible = stage >= 1;

                            return (
                              <tr
                                key={p.id || index}
                                className={cn(
                                  "transition-all",
                                  isWinner
                                    ? "bg-amber-500/20 text-white border-l-4 border-l-amber-400 font-bold"
                                    : isCurrentlyTeased
                                    ? "bg-purple-600/30 text-purple-200 border-l-4 border-l-purple-400 shadow-lg"
                                    : isVisible
                                    ? "hover:bg-slate-800/50"
                                    : "opacity-30 blur-xs"
                                )}
                              >
                                <td className="py-3 px-3 text-center font-black">
                                  {isWinner ? (
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-400 text-slate-950 font-black text-xs">
                                      1
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 font-mono">#{index + 1}</span>
                                  )}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="font-bold text-white flex items-center gap-1.5">
                                    <span>{p.name}</span>
                                    {p.isTeamLeader && (
                                      <span className="px-1.5 py-0.2 bg-amber-400/15 text-amber-300 border border-amber-400/30 rounded text-[9px] font-bold">
                                        TL
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-400">{p.designation || "Staff"}</div>
                                </td>
                                <td className="py-3 px-3 text-slate-300">
                                  <span className="px-2 py-0.5 bg-slate-800 rounded text-[10px] border border-slate-700">
                                    {p.department || "General"}
                                  </span>
                                </td>

                                {meetingsInfo.map((m: any, idx: number) => {
                                  const score = p.meetingScores?.[m.id];
                                  const isWeekVis = stage >= 3 || (stage >= 1 && idx < revealedWeekCount);
                                  return (
                                    <td key={m.id || idx} className="py-3 px-3 text-center font-bold text-slate-300">
                                      {isWeekVis ? (score !== undefined ? `${score} pts` : "—") : "•••"}
                                    </td>
                                  );
                                })}

                                <td className="py-3 px-4 text-center font-black text-amber-400 text-sm bg-amber-950/20">
                                  {isTotalSumRevealed ? `${p.totalScore} pts` : "•••"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Table for Team Summary */}
                {revealDisplayTab === "team" && (
                  <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
                    <div className="p-3 sm:p-4 border-b border-slate-800 flex items-center justify-between text-xs sm:text-sm font-bold text-white">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-blue-400" />
                        <span>Team Standings Breakdown ({sortedDeclaredTeams.length})</span>
                      </div>
                    </div>

                    <div className="overflow-x-auto max-h-[50vh]">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-950/80 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-800">
                            <th className="py-3 px-3 text-center w-12">Rank</th>
                            <th className="py-3 px-4 min-w-[180px]">Team / Department</th>
                            <th className="py-3 px-4 min-w-[160px]">Team Leader(s)</th>
                            <th className="py-3 px-3 text-center min-w-[100px]">Weekly Total</th>
                            <th className="py-3 px-3 text-center min-w-[110px] bg-blue-950/40 text-blue-300">Team EOM Avg</th>
                            <th className="py-3 px-4 text-center min-w-[120px] bg-amber-950/40 text-amber-300 font-black">
                              Grand Total
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-semibold text-slate-300">
                          {sortedDeclaredTeams.map((team: any, index: number) => {
                            const isWinner = index === 0 && stage === 3;
                            const isCurrentlyTeased = isAutoTeasing && index === teasingRankIndex;
                            const isGrandTotalRevealed = stage === 3 || (stage === 2 && index >= 2 && (teasingRankIndex < 0 || index >= teasingRankIndex));
                            const isVisible = stage >= 1;

                            return (
                              <tr
                                key={team.department || index}
                                className={cn(
                                  "transition-all",
                                  isWinner
                                    ? "bg-amber-500/20 text-white border-l-4 border-l-amber-400 font-bold"
                                    : isCurrentlyTeased
                                    ? "bg-purple-600/30 text-purple-200 border-l-4 border-l-purple-400 shadow-lg"
                                    : isVisible
                                    ? "hover:bg-slate-800/50"
                                    : "opacity-30 blur-xs"
                                )}
                              >
                                <td className="py-3 px-3 text-center font-black">
                                  {isWinner ? (
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-400 text-slate-950 font-black text-xs">
                                      1
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 font-mono">#{index + 1}</span>
                                  )}
                                </td>
                                <td className="py-3 px-4 font-bold text-white">
                                  {team.department} Team
                                </td>
                                <td className="py-3 px-4">
                                  {team.teamLeaders?.length > 0 ? (
                                    <div className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-400/10 text-amber-300 border border-amber-400/30 rounded-lg text-[10px] font-bold">
                                      <span>👑 {team.teamLeaders.map((tl: any) => tl.name).join(", ")}</span>
                                    </div>
                                  ) : (
                                    <span className="text-slate-500 italic text-[10px]">No TL</span>
                                  )}
                                </td>
                                <td className="py-3 px-3 text-center font-bold text-slate-300">
                                  {stage >= 1 ? `${team.weeklyTotal} pts` : "•••"}
                                </td>
                                <td className="py-3 px-3 text-center font-bold text-blue-300 bg-blue-950/20">
                                  {stage >= 2 ? `${team.eomAverage} pts` : "•••"}
                                </td>
                                <td className="py-3 px-4 text-center font-black text-amber-400 text-sm bg-amber-950/20">
                                  {isGrandTotalRevealed ? `${team.grandTotal} pts` : "•••"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
