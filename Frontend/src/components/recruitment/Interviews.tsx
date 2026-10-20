import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  X,
  Plus,
  Calendar as CalendarIcon,
  Video,
  MoreHorizontal,
  Clock,
  User,
  Briefcase,
  Trash2,
  Pencil,
  ArrowRight,
  ExternalLink,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  Sparkles,
  ChevronDown,
  FileText,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/lib/toast";
import { cn, formatPersonName } from "@/lib/utils";
import { SearchInput } from "@/components/common/SearchInput";
import { SearchableSelect } from "@/components/ui/select";
import { api } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthContext";
import { isUserAdmin } from "@/lib/permissions";
import { resolveApiUrl } from "@/lib/config";

function getFullResumeUrl(url?: string | null): string {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("data:")
  ) {
    return trimmed;
  }
  const apiBase = resolveApiUrl().replace(/\/api\/v1\/?$/, "").replace(/\/+$/, "");
  return `${apiBase}${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;
}

function formatTime12h(time24: string): string {
  if (!time24) return "";
  const parts = time24.split(":");
  if (parts.length < 2) return time24;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  if (isNaN(hours)) return time24;
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const strHours = hours < 10 ? `0${hours}` : `${hours}`;
  return `${strHours}:${minutes} ${ampm}`;
}

function parseTimeTo24h(str?: string): { start: string; end: string } {
  if (!str || str.toLowerCase().includes("tbd")) {
    return { start: "11:00", end: "12:00" };
  }
  const rangeMatch = str.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?(?:\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)?)?/i);
  if (rangeMatch) {
    let h1 = parseInt(rangeMatch[1], 10);
    const m1 = rangeMatch[2];
    const p1 = rangeMatch[3]?.toUpperCase();

    if (p1 === "PM" && h1 < 12) h1 += 12;
    if (p1 === "AM" && h1 === 12) h1 = 0;
    const s24 = `${String(h1).padStart(2, "0")}:${m1}`;

    if (rangeMatch[4] && rangeMatch[5]) {
      let h2 = parseInt(rangeMatch[4], 10);
      const m2 = rangeMatch[5];
      const p2 = rangeMatch[6]?.toUpperCase() || p1;
      if (p2 === "PM" && h2 < 12) h2 += 12;
      if (p2 === "AM" && h2 === 12) h2 = 0;
      const e24 = `${String(h2).padStart(2, "0")}:${m2}`;
      return { start: s24, end: e24 };
    }

    const endH = (h1 + 1) % 24;
    return { start: s24, end: `${String(endH).padStart(2, "0")}:${m1}` };
  }
  return { start: "11:00", end: "12:00" };
}

// Types
export interface InterviewStageData {
  id: string;
  name: string;
  created_at?: string;
  is_deleted?: boolean;
}

export interface InterviewScheduleData {
  id: string;
  candidate_name: string;
  candidate_email?: string;
  role_position: string;
  hiring_id?: string | null;
  referral_id?: string | null;
  interview_stage_id: string;
  interview_stage_name: string;
  date?: string;
  time?: string;
  interviewer_name?: string;
  meet_link?: string;
  resume_url?: string;
  linkedin_profile?: string;
  notes?: string;
  created_by?: {
    employee_id?: string;
    full_name?: string;
    email?: string;
  };
  created_at?: string;
}

interface JobOpeningOption {
  id: string;
  job_title: string;
  department: string;
}

interface InterviewerOption {
  employee_id: string;
  full_name: string;
  designation?: string;
  department?: string;
}

const STAGE_THEMES = [
  {
    color: "text-blue-700 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950/40",
    border: "border-blue-200 dark:border-blue-800/40",
    badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  },
  {
    color: "text-primary",
    bgColor: "bg-primary/10",
    border: "border-primary/20",
    badge: "bg-primary/15 text-primary",
  },
  {
    color: "text-purple-700 dark:text-purple-400",
    bgColor: "bg-purple-50 dark:bg-purple-950/40",
    border: "border-purple-200 dark:border-purple-800/40",
    badge: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  },
  {
    color: "text-emerald-700 dark:text-emerald-400",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/40",
    border: "border-emerald-200 dark:border-emerald-800/40",
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  {
    color: "text-amber-700 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-200 dark:border-amber-800/40",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  },
  {
    color: "text-rose-700 dark:text-rose-400",
    bgColor: "bg-rose-50 dark:bg-rose-950/40",
    border: "border-rose-200 dark:border-rose-800/40",
    badge: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
  },
];

interface InterviewsProps {
  setActive?: (tab: string) => void;
}

export function Interviews({ setActive }: InterviewsProps = {}) {
  const { user } = useAuth();
  const anyUser = user as any;
  const userRole = String(anyUser?.role || anyUser?.work_details?.system_role || "").toLowerCase().trim();
  const userDesignation = String(anyUser?.work_details?.designation || anyUser?.designation || "").toLowerCase().trim();
  const userDepartment = String(anyUser?.work_details?.department || anyUser?.department || "").toLowerCase().trim();

  const isAdminOrHR =
    isUserAdmin(user) ||
    userRole === "admin" ||
    userRole === "superadmin" ||
    userRole === "subadmin" ||
    userRole === "hr" ||
    userRole.includes("hr") ||
    userDepartment === "hr";

  const isTeamLeader = userDesignation.includes("team leader") || userRole.includes("team leader");
  const isHead = userDesignation.includes("head") || userRole.includes("head");
  const canManage = isAdminOrHR || isTeamLeader || isHead;

  // Data State
  const [stages, setStages] = useState<InterviewStageData[]>([]);
  const [schedules, setSchedules] = useState<InterviewScheduleData[]>([]);
  const [jobOptions, setJobOptions] = useState<JobOpeningOption[]>([]);
  const [interviewerOptions, setInterviewerOptions] = useState<InterviewerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals & Forms
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<InterviewScheduleData | null>(null);
  const [isSubmittingSchedule, setIsSubmittingSchedule] = useState(false);

  // Form Fields
  const [formCandidateName, setFormCandidateName] = useState("");
  const [formCandidateEmail, setFormCandidateEmail] = useState("");
  const [formRole, setFormRole] = useState("");
  const [formHiringId, setFormHiringId] = useState("");
  const [formStageId, setFormStageId] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formStartTime, setFormStartTime] = useState("11:00");
  const [formEndTime, setFormEndTime] = useState("12:00");
  const [formTime, setFormTime] = useState("11:00 AM - 12:00 PM");
  const [formInterviewer, setFormInterviewer] = useState("");
  const [formMeetLink, setFormMeetLink] = useState("");
  const [formResumeUrl, setFormResumeUrl] = useState("");
  const [formLinkedin, setFormLinkedin] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const handleStartTimeChange = (val: string) => {
    setFormStartTime(val);
    let newEnd = formEndTime;
    const parts = val.split(":");
    if (parts.length === 2) {
      const nextH = (parseInt(parts[0], 10) + 1) % 24;
      newEnd = `${String(nextH).padStart(2, "0")}:${parts[1]}`;
      setFormEndTime(newEnd);
    }
    setFormTime(`${formatTime12h(val)} - ${formatTime12h(newEnd)}`);
  };

  const handleEndTimeChange = (val: string) => {
    setFormEndTime(val);
    setFormTime(`${formatTime12h(formStartTime)} - ${formatTime12h(val)}`);
  };

  // Add / Rename Stage
  const [isAddingStage, setIsAddingStage] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [renamingStageId, setRenamingStageId] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [isSavingStage, setIsSavingStage] = useState(false);

  // Drag & drop state
  const [draggingScheduleId, setDraggingScheduleId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);

  // 1. Fetch Stages & Schedules from API
  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const [stagesRes, schedulesRes] = await Promise.allSettled([
        api.get<any[]>("/interviews/stages", { showLoader: false, showErrorToast: false }),
        api.get<any>("/interviews/schedules?limit=200", { showLoader: false, showErrorToast: false }),
      ]);

      // Process Stages
      let loadedStages: InterviewStageData[] = [];
      if (stagesRes.status === "fulfilled" && Array.isArray(stagesRes.value)) {
        loadedStages = stagesRes.value.map((s) => ({
          id: s._id || s.id,
          name: s.name,
          created_at: s.created_at,
          is_deleted: s.is_deleted,
        }));
      }
      setStages(loadedStages);

      // Process Schedules
      let loadedSchedules: InterviewScheduleData[] = [];
      if (schedulesRes.status === "fulfilled") {
        const val = schedulesRes.value;
        const list = Array.isArray(val) ? val : Array.isArray(val?.data) ? val.data : [];
        loadedSchedules = list.map((sc: any) => ({
          id: sc._id || sc.id,
          candidate_name: sc.candidate_name,
          candidate_email: sc.candidate_email,
          role_position: sc.role_position,
          hiring_id: sc.hiring_id,
          referral_id: sc.referral_id,
          interview_stage_id: sc.interview_stage_id,
          interview_stage_name: sc.interview_stage_name,
          date: sc.date,
          time: sc.time,
          interviewer_name: sc.interviewer_name,
          meet_link: sc.meet_link,
          resume_url: sc.resume_url,
          linkedin_profile: sc.linkedin_profile,
          notes: sc.notes,
          created_by: sc.created_by,
          created_at: sc.created_at,
        }));
      }
      setSchedules(loadedSchedules);
    } catch (err) {
      console.error("Failed to load interview data:", err);
      toast.error("Failed to load interview pipeline data.");
    } finally {
      setLoading(false);
    }
  }, []);

  // 2. Fetch Supporting Select Options (Jobs & Interviewers / Employees)
  const loadOptions = useCallback(async () => {
    try {
      const [jobsRes, empsRes, managersRes] = await Promise.allSettled([
        api.get<any>("/hirings?limit=100", { showLoader: false, showErrorToast: false }),
        api.get<any>("/employees?limit=200", { showLoader: false, showErrorToast: false }),
        api.get<any>("/hirings/managers", { showLoader: false, showErrorToast: false }),
      ]);

      if (jobsRes.status === "fulfilled") {
        const list = Array.isArray(jobsRes.value) ? jobsRes.value : jobsRes.value?.data || [];
        setJobOptions(
          list.map((j: any) => ({
            id: j._id || j.id,
            job_title: j.job_title,
            department: j.department,
          }))
        );
      }

      const allInterviewers: InterviewerOption[] = [];
      const seenNames = new Set<string>();

      if (empsRes.status === "fulfilled") {
        const val = empsRes.value;
        const list = Array.isArray(val) ? val : Array.isArray(val?.data) ? val.data : Array.isArray(val?.items) ? val.items : [];
        for (const e of list) {
          const empId = String(e.id || e._id || e.employee_id || "");
          const p = e.personal_info || {};
          const w = e.work_details || {};
          const name = (e.name || formatPersonName(p)).trim();
          if (name && !seenNames.has(name.toLowerCase())) {
            seenNames.add(name.toLowerCase());
            allInterviewers.push({
              employee_id: empId,
              full_name: name,
              designation: w.designation || e.designation,
              department: w.department || e.department,
            });
          }
        }
      }

      if (managersRes.status === "fulfilled" && Array.isArray(managersRes.value)) {
        for (const m of managersRes.value) {
          const name = (m.full_name || "").trim();
          if (name && !seenNames.has(name.toLowerCase())) {
            seenNames.add(name.toLowerCase());
            allInterviewers.push({
              employee_id: m.employee_id,
              full_name: name,
              designation: m.designation,
              department: m.department,
            });
          }
        }
      }

      if (allInterviewers.length > 0) {
        setInterviewerOptions(allInterviewers);
      }
    } catch (err) {
      console.warn("Supporting options not loaded:", err);
    }
  }, []);

  const jobSelectOptions = useMemo(() => {
    const opts = jobOptions.map((opt) => ({
      label: `${opt.job_title}${opt.department ? ` (${opt.department})` : ""}`,
      value: opt.job_title,
    }));
    if (formRole && !opts.some((o) => o.value.toLowerCase() === formRole.toLowerCase())) {
      opts.unshift({ label: formRole, value: formRole });
    }
    return opts;
  }, [jobOptions, formRole]);

  const interviewerSelectOptions = useMemo(() => {
    return interviewerOptions.map((opt) => ({
      label: `${opt.full_name}${opt.designation ? ` — ${opt.designation}` : opt.department ? ` (${opt.department})` : ""}`,
      value: opt.full_name,
    }));
  }, [interviewerOptions]);

  useEffect(() => {
    loadData();
    loadOptions();
  }, [loadData, loadOptions]);

  // Set default stage and job when modal opens
  useEffect(() => {
    if (isScheduleOpen && !editingSchedule) {
      if (stages.length > 0 && !formStageId) {
        setFormStageId(stages[0].id);
      }
      if (jobOptions.length > 0 && !formRole) {
        setFormRole(jobOptions[0].job_title);
        setFormHiringId(jobOptions[0].id);
      }
    }
  }, [isScheduleOpen, editingSchedule, stages, formStageId, jobOptions, formRole]);

  // Handle Drag & Drop
  const handleDragStart = (e: React.DragEvent, scheduleId: string) => {
    if (!canManage) return;
    setDraggingScheduleId(scheduleId);
    e.dataTransfer.setData("text/plain", scheduleId);
  };

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    if (!canManage) return;
    if (dragOverStageId !== stageId) {
      setDragOverStageId(stageId);
    }
  };

  const handleDragLeave = () => {
    setDragOverStageId(null);
  };

  const handleDrop = async (e: React.DragEvent, targetStage: InterviewStageData) => {
    e.preventDefault();
    setDragOverStageId(null);
    const scheduleId = draggingScheduleId || e.dataTransfer.getData("text/plain");
    setDraggingScheduleId(null);

    if (!scheduleId || !canManage) return;

    const currentSchedule = schedules.find((s) => s.id === scheduleId);
    if (!currentSchedule || currentSchedule.interview_stage_id === targetStage.id) {
      return;
    }

    // Optimistic UI Update
    setSchedules((prev) =>
      prev.map((s) =>
        s.id === scheduleId
          ? {
              ...s,
              interview_stage_id: targetStage.id,
              interview_stage_name: targetStage.name,
            }
          : s
      )
    );

    try {
      await api.put(`/interviews/schedules/${scheduleId}`, {
        interview_stage_id: targetStage.id,
        interview_stage_name: targetStage.name,
      });
      toast.success(`Moved ${currentSchedule.candidate_name} to "${targetStage.name}"`);
    } catch (err: any) {
      console.error("Failed to move schedule:", err);
      toast.error(err?.message || "Failed to update interview stage.");
      // Rollback
      loadData();
    }
  };

  // Open Schedule / Edit Form
  const openScheduleModal = (itemToEdit?: InterviewScheduleData) => {
    loadOptions();
    if (itemToEdit) {
      setEditingSchedule(itemToEdit);
      setFormCandidateName(itemToEdit.candidate_name);
      setFormCandidateEmail(itemToEdit.candidate_email || "");
      const matchedJob = jobOptions.find(
        (j) =>
          (itemToEdit.hiring_id && j.id === itemToEdit.hiring_id) ||
          j.job_title.toLowerCase() === (itemToEdit.role_position || "").toLowerCase()
      );
      setFormRole(itemToEdit.role_position || matchedJob?.job_title || (jobOptions[0]?.job_title || ""));
      setFormHiringId(itemToEdit.hiring_id || matchedJob?.id || (jobOptions[0]?.id || ""));
      setFormStageId(itemToEdit.interview_stage_id);

      const cleanDate =
        !itemToEdit.date || itemToEdit.date.toLowerCase() === "tbd"
          ? new Date().toISOString().split("T")[0]
          : itemToEdit.date;
      setFormDate(cleanDate);

      const parsed = parseTimeTo24h(itemToEdit.time);
      setFormStartTime(parsed.start);
      setFormEndTime(parsed.end);
      const cleanTime =
        !itemToEdit.time || itemToEdit.time.toLowerCase() === "tbd"
          ? `${formatTime12h(parsed.start)} - ${formatTime12h(parsed.end)}`
          : itemToEdit.time;
      setFormTime(cleanTime);

      const cleanInterviewer =
        !itemToEdit.interviewer_name || itemToEdit.interviewer_name.toLowerCase() === "tbd"
          ? interviewerOptions[0]?.full_name || anyUser?.name || ""
          : itemToEdit.interviewer_name;
      setFormInterviewer(cleanInterviewer);

      setFormMeetLink(itemToEdit.meet_link || "");
      setFormResumeUrl(itemToEdit.resume_url || "");
      setFormLinkedin(itemToEdit.linkedin_profile || "");
      setFormNotes(itemToEdit.notes || "");
    } else {
      setEditingSchedule(null);
      setFormCandidateName("");
      setFormCandidateEmail("");
      const defaultJob = jobOptions[0]?.job_title || "";
      const defaultHiringId = jobOptions[0]?.id || "";
      setFormRole(defaultJob);
      setFormHiringId(defaultHiringId);
      setFormStageId(stages[0]?.id || "");
      setFormDate(new Date().toISOString().split("T")[0]);
      setFormStartTime("11:00");
      setFormEndTime("12:00");
      setFormTime("11:00 AM - 12:00 PM");
      setFormInterviewer(interviewerOptions[0]?.full_name || anyUser?.name || "");
      setFormMeetLink("");
      setFormResumeUrl("");
      setFormLinkedin("");
      setFormNotes("");
    }
    setIsScheduleOpen(true);
  };

  // Submit Schedule
  const handleSubmitSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCandidateName.trim() || !formRole.trim() || !formStageId) {
      toast.error("Please fill in Candidate Name, Position, and Interview Stage.");
      return;
    }

    const selectedStage = stages.find((s) => s.id === formStageId);
    const stageName = selectedStage?.name || "Screening";
    const formattedTime = formTime.trim() || `${formatTime12h(formStartTime)} - ${formatTime12h(formEndTime)}`;

    const payload = {
      candidate_name: formCandidateName.trim(),
      candidate_email: formCandidateEmail.trim() || undefined,
      role_position: formRole.trim(),
      hiring_id: formHiringId || null,
      interview_stage_id: formStageId,
      interview_stage_name: stageName,
      date: formDate.trim() || new Date().toISOString().split("T")[0],
      time: formattedTime,
      interviewer_name: formInterviewer.trim() || anyUser?.name || "Interviewer",
      meet_link: formMeetLink.trim() || undefined,
      resume_url: formResumeUrl.trim() || undefined,
      linkedin_profile: formLinkedin.trim() || undefined,
      notes: formNotes.trim() || undefined,
    };

    try {
      setIsSubmittingSchedule(true);

      if (editingSchedule) {
        await api.put<any>(`/interviews/schedules/${editingSchedule.id}`, payload);
        toast.success(`Updated interview schedule for ${formCandidateName}!`);
        setSchedules((prev) =>
          prev.map((s) => (s.id === editingSchedule.id ? { ...s, ...payload, id: editingSchedule.id } : s))
        );
      } else {
        const created = await api.post<any>("/interviews/schedules", payload);
        toast.success(`Interview scheduled for ${formCandidateName}!`);
        const newObj: InterviewScheduleData = {
          id: created?._id || created?.id || `sc_${Date.now()}`,
          ...payload,
        };
        setSchedules((prev) => [newObj, ...prev]);
      }

      setIsScheduleOpen(false);
      await loadData();
    } catch (err: any) {
      console.error("Schedule error:", err);
      toast.error(err?.message || "Failed to schedule interview. Please try again.");
    } finally {
      setIsSubmittingSchedule(false);
    }
  };

  // Delete Schedule
  const handleDeleteSchedule = async (scheduleId: string, candidateName: string) => {
    if (!window.confirm(`Are you sure you want to cancel and delete the interview for "${candidateName}"?`)) {
      return;
    }

    try {
      await api.delete(`/interviews/schedules/${scheduleId}`);
      toast.success(`Interview for ${candidateName} has been cancelled.`);
      setSchedules((prev) => prev.filter((s) => s.id !== scheduleId));
    } catch (err: any) {
      console.error("Delete schedule error:", err);
      toast.error(err?.message || "Failed to delete schedule.");
    }
  };

  // Add Dynamic Stage
  const handleAddStage = async () => {
    if (!newStageName.trim()) return;
    try {
      setIsSavingStage(true);
      const res = await api.post<any>("/interviews/stages", { name: newStageName.trim() });
      toast.success(`Stage "${newStageName.trim()}" added successfully!`);
      const newStage: InterviewStageData = {
        id: res?._id || res?.id || `stg_${Date.now()}`,
        name: newStageName.trim(),
      };
      setStages((prev) => [...prev, newStage]);
      setNewStageName("");
      setIsAddingStage(false);
    } catch (err: any) {
      console.error("Add stage error:", err);
      toast.error(err?.message || "Failed to add interview stage.");
    } finally {
      setIsSavingStage(false);
    }
  };

  // Rename Stage
  const handleRenameStage = async (stageId: string, oldName: string) => {
    if (!renameInput.trim() || renameInput.trim() === oldName) {
      setRenamingStageId(null);
      return;
    }

    const newName = renameInput.trim();
    try {
      await api.put(`/interviews/stages/${stageId}`, { name: newName });
      toast.success(`Stage renamed to "${newName}"`);
      setStages((prev) => prev.map((s) => (s.id === stageId ? { ...s, name: newName } : s)));
      setSchedules((prev) =>
        prev.map((s) => (s.interview_stage_id === stageId ? { ...s, interview_stage_name: newName } : s))
      );
    } catch (err: any) {
      console.error("Rename stage error:", err);
      toast.error(err?.message || "Failed to rename stage.");
    } finally {
      setRenamingStageId(null);
    }
  };

  // Delete Stage
  const handleDeleteStage = async (stage: InterviewStageData) => {
    const candidatesInStage = schedules.filter((s) => s.interview_stage_id === stage.id);
    if (candidatesInStage.length > 0) {
      toast.error(
        `Cannot delete stage "${stage.name}". Please move or delete the ${candidatesInStage.length} candidate(s) in this stage first.`
      );
      return;
    }

    if (!window.confirm(`Are you sure you want to delete the stage "${stage.name}"?`)) {
      return;
    }

    try {
      await api.delete(`/interviews/stages/${stage.id}`);
      toast.success(`Stage "${stage.name}" deleted.`);
      setStages((prev) => prev.filter((s) => s.id !== stage.id));
    } catch (err: any) {
      console.error("Delete stage error:", err);
      toast.error(err?.message || "Failed to delete stage.");
    }
  };

  // Filtered schedules by search query
  const filteredSchedules = useMemo(() => {
    if (!searchQuery.trim()) return schedules;
    const q = searchQuery.toLowerCase().trim();
    return schedules.filter(
      (s) =>
        s.candidate_name?.toLowerCase().includes(q) ||
        s.role_position?.toLowerCase().includes(q) ||
        s.interviewer_name?.toLowerCase().includes(q) ||
        s.interview_stage_name?.toLowerCase().includes(q)
    );
  }, [schedules, searchQuery]);

  return (
    <div className="h-full flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300 w-full">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-foreground tracking-tight">Interviews</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-primary/10 text-primary border border-primary/20">
              {schedules.length} scheduled
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Dynamic recruitment pipeline, interview stages, and candidate schedules
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <SearchInput
            placeholder="Search candidates or interviewer..."
            value={searchQuery}
            onChange={setSearchQuery}
            className="w-full sm:w-64 flex-1 min-w-[200px]"
          />

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-2.5 bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground rounded-xl transition-colors cursor-pointer border border-border/60"
            title="Refresh interviews"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </button>

          <button
            type="button"
            onClick={() => {
              if (setActive) {
                setActive("/recruitment/hirings");
              }
              if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("navigate_tab", { detail: "/recruitment/hirings" }));
              }
            }}
            className="px-3.5 py-2 min-h-[40px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Briefcase className="w-3.5 h-3.5" /> Hirings
          </button>

          {canManage && (
            <button
              type="button"
              onClick={() => openScheduleModal()}
              className="px-4 py-2 min-h-[40px] bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs sm:text-sm font-bold shadow-sm flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Schedule Interview
            </button>
          )}
        </div>
      </div>

      {/* Kanban Board Container */}
      {loading && stages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 bg-card rounded-2xl border border-border/60">
          <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
          <p className="text-sm font-bold text-foreground">Loading interview pipeline...</p>
          <p className="text-xs text-muted-foreground mt-1">Connecting to live candidate stages and schedules</p>
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto min-w-0 pb-4">
          <div className="flex gap-4 sm:gap-5 min-w-max h-full items-start">
            {stages.map((stage, sIdx) => {
              const theme = STAGE_THEMES[sIdx % STAGE_THEMES.length];
              const stageCandidates = filteredSchedules.filter(
                (c) => c.interview_stage_id === stage.id || c.interview_stage_name?.toLowerCase() === stage.name?.toLowerCase()
              );
              const isOver = dragOverStageId === stage.id;

              return (
                <div
                  key={stage.id}
                  className={cn(
                    "w-[290px] sm:w-[320px] flex flex-col bg-muted/30 rounded-2xl border border-border/70 p-3.5 transition-all min-h-[480px]",
                    isOver && "ring-2 ring-primary border-primary bg-primary/5 scale-[1.01]"
                  )}
                  onDragOver={(e) => handleDragOver(e, stage.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, stage)}
                >
                  {/* Stage Header */}
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2 min-w-0">
                      {renamingStageId === stage.id ? (
                        <input
                          type="text"
                          autoFocus
                          value={renameInput}
                          onChange={(e) => setRenameInput(e.target.value)}
                          onBlur={() => handleRenameStage(stage.id, stage.name)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRenameStage(stage.id, stage.name);
                            if (e.key === "Escape") setRenamingStageId(null);
                          }}
                          className="font-bold text-foreground bg-background border border-primary rounded-lg px-2 py-0.5 text-xs w-36 outline-none shadow-xs"
                        />
                      ) : (
                        <h3 className="font-bold text-sm text-foreground truncate">{stage.name}</h3>
                      )}
                      <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-black shrink-0", theme.badge)}>
                        {stageCandidates.length}
                      </span>
                    </div>

                    {canManage && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="p-1 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                            title="Stage actions"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40 rounded-xl p-1 text-xs">
                          <DropdownMenuItem
                            onClick={() => {
                              setRenameInput(stage.name);
                              setRenamingStageId(stage.id);
                            }}
                            className="cursor-pointer font-medium"
                          >
                            <Pencil className="w-3.5 h-3.5 mr-2 text-primary" /> Rename Stage
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDeleteStage(stage)}
                            className="cursor-pointer font-medium text-rose-600 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/20"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Stage
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>

                  {/* Stage Candidate Cards */}
                  <div className="flex flex-col gap-2.5 flex-1 overflow-y-auto max-h-[calc(100vh-270px)] pr-0.5">
                    {stageCandidates.map((candidate) => {
                      const meetUrl = candidate.meet_link?.trim();
                      const finalMeetUrl = meetUrl
                        ? meetUrl.startsWith("http")
                          ? meetUrl
                          : `https://${meetUrl}`
                        : "https://meet.google.com/new";

                      return (
                        <div
                          key={candidate.id}
                          draggable={canManage}
                          onDragStart={(e) => handleDragStart(e, candidate.id)}
                          className={cn(
                            "bg-card p-3.5 rounded-xl border border-border/80 shadow-2xs hover:shadow-md transition-all group select-none",
                            canManage && "cursor-grab active:cursor-grabbing hover:border-primary/40",
                            draggingScheduleId === candidate.id && "opacity-40"
                          )}
                        >
                          <div className="flex justify-between items-start gap-2 mb-2">
                            <div className="min-w-0">
                              <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">
                                {candidate.candidate_name}
                              </h4>
                              <p className="text-xs font-semibold text-muted-foreground truncate flex items-center gap-1.5 mt-0.5">
                                <Briefcase className="w-3 h-3 text-muted-foreground/70 shrink-0" />
                                <span className="truncate">{candidate.role_position}</span>
                              </p>
                              {candidate.candidate_email && (
                                <p className="text-[11px] text-muted-foreground/80 truncate mt-0.5">
                                  {candidate.candidate_email}
                                </p>
                              )}
                            </div>

                            {canManage && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    type="button"
                                    className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors cursor-pointer shrink-0"
                                  >
                                    <MoreHorizontal className="w-3.5 h-3.5" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40 rounded-xl p-1 text-xs">
                                  <DropdownMenuItem
                                    onClick={() => openScheduleModal(candidate)}
                                    className="cursor-pointer font-medium"
                                  >
                                    <Pencil className="w-3.5 h-3.5 mr-2 text-primary" /> Edit Interview
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleDeleteSchedule(candidate.id, candidate.candidate_name)}
                                    className="cursor-pointer font-medium text-rose-600 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/20"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 mr-2" /> Cancel Interview
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>

                          {candidate.notes && (
                            <p className="text-[11px] text-muted-foreground italic line-clamp-2 mb-2.5 bg-muted/40 p-1.5 rounded-lg">
                              "{candidate.notes}"
                            </p>
                          )}

                          {/* Card Footer: Date, Interviewer & Meet button */}
                          <div className="space-y-2 pt-2.5 border-t border-border/50 text-[11px]">
                            <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
                              <CalendarIcon className="w-3.5 h-3.5 text-primary shrink-0" />
                              <span className="truncate">
                                {candidate.date || "TBD"} {candidate.time ? `• ${candidate.time}` : ""}
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-2 pt-0.5">
                              <div className="flex items-center gap-1.5 text-foreground/80 font-semibold truncate min-w-0">
                                <User className="w-3 h-3 text-muted-foreground shrink-0" />
                                <span className="truncate">{candidate.interviewer_name || "Unassigned"}</span>
                              </div>

                              <a
                                href={finalMeetUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="px-2 py-1 bg-primary/10 hover:bg-primary/20 text-primary font-bold rounded-lg flex items-center gap-1 text-[11px] transition-colors shrink-0 cursor-pointer"
                                title="Open meeting link"
                              >
                                <Video className="w-3 h-3" />
                                <span>Meet</span>
                              </a>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {stageCandidates.length === 0 && (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-border/80 rounded-xl bg-card/40 my-2">
                        <p className="text-xs font-semibold text-muted-foreground">No interviews in {stage.name}</p>
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                          Drag a candidate here or click Schedule
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Add Dynamic Stage Column */}
            {canManage && (
              <div className="w-[280px] sm:w-[300px] flex flex-col shrink-0">
                {isAddingStage ? (
                  <div className="bg-card rounded-2xl border border-border p-4 shadow-sm space-y-3">
                    <p className="text-xs font-bold text-foreground">New Interview Stage</p>
                    <input
                      type="text"
                      autoFocus
                      placeholder="e.g. HR Round, Cultural Fit"
                      value={newStageName}
                      onChange={(e) => setNewStageName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddStage();
                        if (e.key === "Escape") {
                          setIsAddingStage(false);
                          setNewStageName("");
                        }
                      }}
                      className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isSavingStage || !newStageName.trim()}
                        onClick={handleAddStage}
                        className="px-3.5 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {isSavingStage ? "Adding..." : "Add Stage"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingStage(false);
                          setNewStageName("");
                        }}
                        className="px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground font-bold text-xs rounded-lg transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsAddingStage(true)}
                    className="flex items-center justify-center gap-2 h-14 bg-muted/30 hover:bg-muted/60 border border-dashed border-border/80 text-muted-foreground hover:text-foreground font-bold text-xs rounded-2xl transition-colors w-full cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Add Interview Stage
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Schedule / Edit Interview Modal */}
      <Dialog open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
        <DialogContent className="w-[calc(100vw-16px)] sm:w-full max-w-lg p-0 overflow-hidden rounded-2xl sm:rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className="flex items-center justify-between px-6 py-5 border-b border-border/50 bg-muted/30">
            <div>
              <h2 className="text-lg sm:text-xl font-black tracking-tight text-foreground">
                {editingSchedule ? "Edit Interview Schedule" : "Schedule Interview"}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Set candidate, job position, round stage, and interview details
              </p>
            </div>
            <DialogClose asChild>
              <button
                type="button"
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </DialogClose>
          </div>

          <form onSubmit={handleSubmitSchedule} className="flex flex-col max-h-[80vh]">
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Candidate Referral Context Banner */}
              {(formResumeUrl || formLinkedin) && (
                <div className="p-3 bg-muted/40 border border-border/70 rounded-xl flex items-center justify-between gap-3 text-xs">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Candidate Referral Attachments:
                  </span>
                  <div className="flex items-center gap-2">
                    {formResumeUrl && (
                      <a
                        href={getFullResumeUrl(formResumeUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary font-bold rounded-lg flex items-center gap-1 transition-colors text-xs cursor-pointer"
                        title="View resume"
                      >
                        <FileText className="w-3.5 h-3.5" /> Resume
                      </a>
                    )}
                    {formLinkedin && (
                      <a
                        href={formLinkedin.startsWith("http") ? formLinkedin : `https://${formLinkedin}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 font-bold rounded-lg flex items-center gap-1 transition-colors text-xs cursor-pointer"
                        title="LinkedIn Profile"
                      >
                        LinkedIn ↗
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Candidate Name & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                    Candidate Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={formCandidateName}
                    onChange={(e) => setFormCandidateName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-muted/30 border border-border rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                    Candidate Email
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. candidate@example.com"
                    value={formCandidateEmail}
                    onChange={(e) => setFormCandidateEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-muted/30 border border-border rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                  />
                </div>
              </div>

              {/* Position / Role (Job Vacancies Dropdown from Hirings) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  Job Position / Vacancy *
                </label>
                <select
                  required
                  value={formRole}
                  onChange={(e) => {
                    const selectedTitle = e.target.value;
                    setFormRole(selectedTitle);
                    const matchingJob = jobOptions.find(
                      (j) => j.job_title.toLowerCase() === selectedTitle.toLowerCase()
                    );
                    setFormHiringId(matchingJob ? matchingJob.id : "");
                  }}
                  className="w-full px-3.5 py-2.5 bg-muted/30 border border-border rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground cursor-pointer"
                >
                  {jobOptions.length === 0 && (
                    <option value="" disabled>
                      No job vacancies found in Hirings
                    </option>
                  )}
                  {jobOptions.length > 0 && !formRole && (
                    <option value="" disabled>
                      Select Job Vacancy
                    </option>
                  )}
                  {jobOptions.map((j) => (
                    <option key={j.id} value={j.job_title}>
                      {j.job_title} {j.department ? `(${j.department})` : ""}
                    </option>
                  ))}
                  {formRole && !jobOptions.some((j) => j.job_title.toLowerCase() === formRole.toLowerCase()) && (
                    <option value={formRole}>{formRole}</option>
                  )}
                </select>
              </div>

              {/* Stage Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  Interview Stage *
                </label>
                <select
                  required
                  value={formStageId}
                  onChange={(e) => setFormStageId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-muted/30 border border-border rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground cursor-pointer"
                >
                  {stages.map((stg) => (
                    <option key={stg.id} value={stg.id}>
                      {stg.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date & Time Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full h-10 px-3 bg-muted/30 border border-border rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground cursor-pointer"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={formStartTime}
                    onChange={(e) => handleStartTimeChange(e.target.value)}
                    className="w-full h-10 px-3 bg-muted/30 border border-border rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground cursor-pointer"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                    End Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={formEndTime}
                    onChange={(e) => handleEndTimeChange(e.target.value)}
                    className="w-full h-10 px-3 bg-muted/30 border border-border rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground cursor-pointer"
                  />
                </div>
              </div>

              {/* Interviewer Name with Employee Dropdown */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  Interviewer Name *
                </label>
                <SearchableSelect
                  value={formInterviewer}
                  onChange={(val) => setFormInterviewer(val)}
                  options={interviewerSelectOptions}
                  placeholder="Select Interviewer (Search employee...)"
                  className="w-full h-10 px-3.5 bg-muted/30 border border-border rounded-xl text-xs sm:text-sm font-medium"
                />
              </div>

              {/* Meeting Link */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  Video Meeting Link (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. https://meet.google.com/abc-defg-hij"
                  value={formMeetLink}
                  onChange={(e) => setFormMeetLink(e.target.value)}
                  className="w-full px-3.5 py-2 bg-muted/30 border border-border rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  Notes / Preparation (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Focus on system design and React performance..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3.5 py-2 bg-muted/30 border border-border rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground resize-none"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 bg-muted/30 border-t border-border/50 flex items-center justify-end gap-2.5 mt-auto">
              <button
                type="button"
                onClick={() => setIsScheduleOpen(false)}
                className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingSchedule}
                className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSubmittingSchedule ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                  </>
                ) : editingSchedule ? (
                  "Update Interview"
                ) : (
                  "Schedule Interview"
                )}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
export default Interviews;
