import { useState, useEffect, useCallback } from "react";
import {
  X,
  Plus,
  Filter,
  Users,
  Briefcase,
  MapPin,
  Clock,
  MoreHorizontal,
  ArrowUpRight,
  UserPlus,
  Calendar as CalendarIcon,
  Trash2,
  DollarSign,
  BriefcaseBusiness,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Upload,
  RotateCcw,
  Check,
  ChevronDown,
  Pencil,
} from "lucide-react";
import {
  DialogClose,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDepartments } from "../employees/DepartmentContext";
import { toast } from "@/lib/toast";
import { api } from "@/lib/api";
import { SearchableSelect } from "@/components/ui/select";
import { SearchInput } from "@/components/common/SearchInput";
import { cn, formatDate, formatPersonName } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthContext";
import { isUserAdmin, hasModulePermission } from "@/lib/permissions";
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

export interface HiringManager {
  employee_id: string;
  full_name: string;
  email?: string;
  department?: string;
  designation?: string;
  profile_picture?: string;
}

export interface JobOpening {
  id: string;
  _id?: string;
  job_title: string;
  department: string;
  location: string;
  employment_type: string;
  status: "Open" | "Closed" | "On Hold" | string;
  applications_count: number;
  posted_date?: string;
  experience?: string;
  salary_range?: string;
  job_description?: string;
  description?: string;
  hiring_manager?: HiringManager | null;
  hiring_manager_id?: string | null;
  referrals?: Array<{
    id?: string;
    _id?: string;
    candidate_name: string;
    candidate_email: string;
    status?: string;
    resume_url?: string;
    why_good_fit?: string;
    created_at?: string;
  }>;
  created_at?: string;
  updated_at?: string;
}

export interface DashboardMetric {
  count: number;
  trend_text: string;
}

export interface HiringDashboardSummary {
  active_jobs: DashboardMetric;
  total_applicants: DashboardMetric;
  interviews_scheduled: DashboardMetric;
  offers_extended: DashboardMetric;
}

interface HiringsProps {
  setActive?: (tab: string) => void;
}

export function Hirings({ setActive }: HiringsProps = {}) {
  const { user } = useAuth();
  const { departments } = useDepartments();

  const anyUser = user as any;
  const userRole = String(anyUser?.role || anyUser?.work_details?.system_role || "").toLowerCase().trim();
  const userDesignation = String(anyUser?.work_details?.designation || anyUser?.designation || "").toLowerCase().trim();
  const userDepartment = String(anyUser?.work_details?.department || anyUser?.department || "").toLowerCase().trim();

  // Role Permissions:
  // - Team Leader, Head, Admin, and HR can add, edit, and delete hirings
  // - Regular Employee can only view hirings and refer a friend
  const isAdminOrHR =
    isUserAdmin(user) ||
    userRole === "admin" ||
    userRole === "superadmin" ||
    userRole === "subadmin" ||
    userRole === "hr" ||
    userRole.includes("hr manager") ||
    userDepartment === "hr" ||
    hasModulePermission(user, "/recruitment/hirings", "create");

  const isTeamLeader = userDesignation.includes("team leader") || userRole.includes("team leader");
  const isHead = userDesignation.includes("head") || userRole.includes("head");

  const canManageHirings = isAdminOrHR || isTeamLeader || isHead;

  // State
  const [jobs, setJobs] = useState<JobOpening[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [summary, setSummary] = useState<HiringDashboardSummary | null>(null);
  const [managers, setManagers] = useState<HiringManager[]>([]);
  const [employmentTypes, setEmploymentTypes] = useState<string[]>([
    "Full-time",
    "Part-time",
    "Internship",
  ]);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("ALL");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [showFilterBar, setShowFilterBar] = useState(false);

  // Modals
  const [isPostOpen, setIsPostOpen] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobOpening | null>(null);
  const [referJob, setReferJob] = useState<JobOpening | null>(null);

  // Post Job Form State
  const [newTitle, setNewTitle] = useState("");
  const [newDepartment, setNewDepartment] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newType, setNewType] = useState("Full-time");
  const [newHiringManagerId, setNewHiringManagerId] = useState("");
  const [newExperience, setNewExperience] = useState("");
  const [newSalary, setNewSalary] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newStatus, setNewStatus] = useState("Open");

  // Edit / Update Job Form State
  const [editingJob, setEditingJob] = useState<JobOpening | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDepartment, setEditDepartment] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editType, setEditType] = useState("Full-time");
  const [editHiringManagerId, setEditHiringManagerId] = useState("");
  const [editExperience, setEditExperience] = useState("");
  const [editSalary, setEditSalary] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatus, setEditStatus] = useState("Open");

  // Refer Form State
  const [referName, setReferName] = useState("");
  const [referEmail, setReferEmail] = useState("");
  const [referLinkedin, setReferLinkedin] = useState("");
  const [referWhyFit, setReferWhyFit] = useState("");
  const [referResumeFile, setReferResumeFile] = useState<File | null>(null);
  const [isSubmittingReferral, setIsSubmittingReferral] = useState(false);

  // Delete Dialog confirmation state
  const [jobToDelete, setJobToDelete] = useState<JobOpening | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Dynamic Interview stages & referral status updating
  const [interviewStages, setInterviewStages] = useState<string[]>(["Screening", "Technical", "Cultural", "Offer"]);
  const [updatingReferralId, setUpdatingReferralId] = useState<string | null>(null);

  // Load Job Openings from API
  const loadHirings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<any>("/hirings?limit=100", {
        showLoader: false,
        showErrorToast: false,
      });

      let items: any[] = [];
      if (Array.isArray(res)) {
        items = res;
      } else if (res && Array.isArray(res.items)) {
        items = res.items;
      } else if (res && Array.isArray(res.data)) {
        items = res.data;
      }

      const formatted: JobOpening[] = items.map((item) => ({
        ...item,
        id: String(item.id || item._id || ""),
        job_title: item.job_title || "Untitled Role",
        department: item.department || "General",
        location: item.location || "Remote",
        employment_type: item.employment_type || "Full-time",
        status: item.status || "Open",
        applications_count: Number(item.applications_count ?? item.referrals?.length ?? 0),
        posted_date: item.posted_date || (item.created_at ? formatDate(item.created_at) : "Recently"),
      }));

      setJobs(formatted);
    } catch (err: any) {
      console.error("Failed to load hirings:", err);
      toast.error("Failed to load job postings. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Synchronize selectedJob whenever jobs are loaded or updated
  useEffect(() => {
    if (selectedJob) {
      const latest = jobs.find((j) => j.id === selectedJob.id);
      if (latest && (latest.referrals !== selectedJob.referrals || latest.applications_count !== selectedJob.applications_count)) {
        setSelectedJob(latest);
      }
    }
  }, [jobs]);

  // Load Dashboard Summary
  const loadSummary = useCallback(async () => {
    try {
      const res = await api.get<HiringDashboardSummary>("/hirings/dashboard/summary", {
        showLoader: false,
        showErrorToast: false,
      });
      if (res && res.active_jobs) {
        setSummary(res);
      }
    } catch (err) {
      console.warn("Hirings summary not loaded:", err);
    }
  }, []);

  // Load Managers for Dropdown
  const loadManagers = useCallback(async () => {
    try {
      const res = await api.get<HiringManager[]>("/hirings/managers", {
        showLoader: false,
        showErrorToast: false,
      });
      if (Array.isArray(res)) {
        setManagers(res);
      }
    } catch (err) {
      console.warn("Managers options not loaded:", err);
    }
  }, []);

  // Load Employment Types
  const loadEmploymentTypes = useCallback(async () => {
    try {
      const res = await api.get<string[]>("/hirings/employment-types", {
        showLoader: false,
        showErrorToast: false,
      });
      if (Array.isArray(res) && res.length > 0) {
        setEmploymentTypes(res);
      }
    } catch {
      // Keep default
    }
  }, []);

  // Load Interview Stages for Referrals Dropdown
  const loadInterviewStages = useCallback(async () => {
    try {
      const res = await api.get<any[]>("/interviews/stages", {
        showLoader: false,
        showErrorToast: false,
      });
      if (Array.isArray(res) && res.length > 0) {
        const names = res.map((s) => s.name).filter(Boolean);
        if (names.length > 0) {
          setInterviewStages(names);
        }
      }
    } catch (err) {
      console.warn("Failed to load interview stages for referrals:", err);
    }
  }, []);

  // Initial Data Fetch
  useEffect(() => {
    loadHirings();
    loadSummary();
    loadManagers();
    loadEmploymentTypes();
    loadInterviewStages();
  }, [loadHirings, loadSummary, loadManagers, loadEmploymentTypes, loadInterviewStages]);

  // Keep selectedJob's referrals completely fresh when viewing Details modal
  useEffect(() => {
    if (selectedJob?.id) {
      api.get<any[]>(`/hirings/${selectedJob.id}/referrals`, {
        showLoader: false,
        showErrorToast: false,
      })
        .then((refs) => {
          if (Array.isArray(refs)) {
            setSelectedJob((prev) => {
              if (!prev || prev.id !== selectedJob.id) return prev;
              return { ...prev, referrals: refs };
            });
          }
        })
        .catch(() => {});
    }
  }, [selectedJob?.id]);

  // Set default department when departments context loads
  useEffect(() => {
    if (!newDepartment && departments.length > 0) {
      setNewDepartment(departments[0] || "");
    }
  }, [departments, newDepartment]);

  // Filtered Jobs
  const filteredJobs = jobs.filter((job) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      job.job_title.toLowerCase().includes(q) ||
      job.department.toLowerCase().includes(q) ||
      job.location.toLowerCase().includes(q) ||
      (job.hiring_manager?.full_name || "").toLowerCase().includes(q);

    const matchesDept = selectedDepartment === "ALL" || job.department === selectedDepartment;
    const matchesType = selectedType === "ALL" || job.employment_type === selectedType;

    const matchesStatus =
      selectedStatus === "ALL" ||
      (selectedStatus === "Open" && (job.status === "Open" || job.status === "Active")) ||
      job.status.toLowerCase() === selectedStatus.toLowerCase();

    return matchesSearch && matchesDept && matchesType && matchesStatus;
  });

  // Handle Post Job
  const handlePostJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageHirings) {
      toast.error("Only Team Leaders, Department Heads, Admins, and HR can post jobs.");
      return;
    }
    if (!newTitle.trim() || !newLocation.trim()) {
      toast.error("Please fill all required fields (Job Title & Location)");
      return;
    }

    try {
      setIsPosting(true);
      const payload: {
        job_title: string;
        department: string;
        location: string;
        employment_type: string;
        status: string;
        hiring_manager_id?: string;
        experience?: string;
        salary_range?: string;
        job_description?: string;
      } = {
        job_title: newTitle.trim(),
        department: newDepartment || (departments[0] || "General"),
        location: newLocation.trim(),
        employment_type: newType,
        status: newStatus || "Open",
      };

      if (newHiringManagerId) {
        payload.hiring_manager_id = newHiringManagerId;
      }
      if (newExperience.trim()) {
        payload.experience = newExperience.trim();
      }
      if (newSalary.trim()) {
        payload.salary_range = newSalary.trim();
      }
      if (newDescription.trim()) {
        payload.job_description = newDescription.trim();
      }

      await api.post("/hirings", payload);
      toast.success("Job requirement posted successfully!");

      // Reset form
      setNewTitle("");
      setNewLocation("");
      setNewExperience("");
      setNewSalary("");
      setNewDescription("");
      setNewHiringManagerId("");
      setNewStatus("Open");
      setIsPostOpen(false);

      // Refresh data
      await loadHirings();
      await loadSummary();
    } catch (err: any) {
      console.error("Failed to post job:", err);
      toast.error(err?.message || "Failed to post job. Please try again.");
    } finally {
      setIsPosting(false);
    }
  };

  // Handle Delete Job
  const handleDeleteJob = async (jobId: string) => {
    if (!canManageHirings) {
      toast.error("Only Team Leaders, Department Heads, Admins, and HR can delete jobs.");
      return;
    }
    try {
      setIsDeleting(true);
      await api.delete(`/hirings/${jobId}`);
      toast.success("Job posting removed successfully");
      setJobToDelete(null);
      if (selectedJob?.id === jobId) {
        setSelectedJob(null);
      }
      await loadHirings();
      await loadSummary();
    } catch (err: any) {
      console.error("Failed to delete job:", err);
      toast.error(err?.message || "Failed to delete job posting.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Open Edit / Update Job modal
  const openEditModal = (job: JobOpening) => {
    if (!canManageHirings) {
      toast.error("Only Team Leaders, Department Heads, Admins, and HR can edit jobs.");
      return;
    }
    setEditingJob(job);
    setEditTitle(job.job_title || "");
    setEditDepartment(job.department || (departments[0] || ""));
    setEditType(job.employment_type || "Full-time");
    setEditLocation(job.location || "");
    setEditStatus(normalizeStatus(job.status));
    setEditHiringManagerId(job.hiring_manager?.employee_id || "");
    setEditExperience(job.experience || "");
    setEditSalary(job.salary_range || "");
    setEditDescription(job.job_description || "");
  };

  // Submit Update Job
  const handleUpdateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingJob) return;

    if (!canManageHirings) {
      toast.error("Only Team Leaders, Department Heads, Admins, and HR can update jobs.");
      return;
    }

    if (!editTitle.trim() || !editDepartment.trim() || !editLocation.trim()) {
      toast.error("Please fill all required fields (Job Title, Department, Location).");
      return;
    }

    try {
      setIsUpdating(true);
      const payload: {
        job_title: string;
        department: string;
        location: string;
        employment_type: string;
        status: string;
        hiring_manager_id?: string;
        experience?: string;
        salary_range?: string;
        job_description?: string;
      } = {
        job_title: editTitle.trim(),
        department: editDepartment.trim(),
        location: editLocation.trim(),
        employment_type: editType,
        status: editStatus,
      };

      if (editHiringManagerId.trim()) {
        payload.hiring_manager_id = editHiringManagerId.trim();
      }
      if (editExperience.trim()) {
        payload.experience = editExperience.trim();
      }
      if (editSalary.trim()) {
        payload.salary_range = editSalary.trim();
      }
      if (editDescription.trim()) {
        payload.job_description = editDescription.trim();
      }

      await api.put(`/hirings/${editingJob.id}`, payload);
      toast.success("Job posting updated successfully!");
      setEditingJob(null);
      await loadHirings();
      await loadSummary();
      if (selectedJob?.id === editingJob.id) {
        setSelectedJob((prev) =>
          prev
            ? {
                ...prev,
                job_title: editTitle.trim(),
                department: editDepartment.trim(),
                location: editLocation.trim(),
                employment_type: editType,
                status: editStatus,
                experience: editExperience.trim(),
                salary_range: editSalary.trim(),
                job_description: editDescription.trim(),
              }
            : null
        );
      }
    } catch (err: any) {
      console.error("Failed to update job posting:", err);
      toast.error(err?.message || "Failed to update job posting.");
    } finally {
      setIsUpdating(false);
    }
  };

  // Update Job Status (Open | Closed | On Hold)
  const handleUpdateStatus = async (jobId: string, nextStatus: string) => {
    if (!canManageHirings) {
      toast.error("Only Team Leaders, Department Heads, Admins, and HR can change job status.");
      return;
    }

    try {
      await api.put(`/hirings/${jobId}`, { status: nextStatus });
      toast.success(`Job marked as ${nextStatus}`);
      await loadHirings();
      await loadSummary();
      if (selectedJob?.id === jobId) {
        setSelectedJob((prev) => (prev ? { ...prev, status: nextStatus } : null));
      }
    } catch (err: any) {
      console.error("Failed to update status:", err);
      toast.error(err?.message || "Failed to update job status.");
    }
  };

  // Submit Candidate Referral
  const handleSubmitReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!referJob) return;

    if (!referName.trim() || !referEmail.trim() || !referWhyFit.trim()) {
      toast.error("Please fill all required referral fields.");
      return;
    }

    try {
      setIsSubmittingReferral(true);
      let resumeUrl = "";

      // 1. Upload Resume file if provided
      if (referResumeFile) {
        try {
          const formData = new FormData();
          formData.append("file", referResumeFile);
          const uploadRes = await api.post<any>("/hirings/referrals/upload-resume", formData, {
            showLoader: false,
          });
          resumeUrl = uploadRes?.url || uploadRes?.resume_url || "";
        } catch (uploadErr: any) {
          console.error("Resume upload failed:", uploadErr);
          toast.error(uploadErr?.message || "Resume upload failed. Please try a valid file format (PDF, DOCX, PNG).");
          setIsSubmittingReferral(false);
          return;
        }
      }

      // 2. Submit Referral
      const payload: {
        hiring_id: string;
        candidate_name: string;
        candidate_email: string;
        why_good_fit: string;
        linkedin_profile?: string;
        resume_url?: string;
      } = {
        hiring_id: referJob.id,
        candidate_name: referName.trim(),
        candidate_email: referEmail.trim(),
        why_good_fit: referWhyFit.trim(),
      };

      if (referLinkedin.trim()) {
        payload.linkedin_profile = referLinkedin.trim();
      }
      if (resumeUrl) {
        payload.resume_url = resumeUrl;
      }

      const createdRef = await api.post<any>(`/hirings/${referJob.id}/referrals`, payload);
      toast.success(`Referral submitted for ${referJob.job_title}! Thank you.`);

      // Immediately reflect in jobs and selectedJob state
      const targetJobId = referJob.id;
      const refObject = createdRef || {
        ...payload,
        id: `ref_${Date.now()}`,
        _id: `ref_${Date.now()}`,
        status: "Pending",
        referred_by: {
          employee_id: String(anyUser?.id || anyUser?._id || anyUser?.employee_id || ""),
          full_name: anyUser?.name || formatPersonName(anyUser?.personal_info) || "You",
          email: String(anyUser?.email || anyUser?.personal_info?.email_address || ""),
        },
        created_at: new Date().toISOString(),
      };

      setJobs((prevJobs) =>
        prevJobs.map((j) => {
          if (j.id === targetJobId) {
            const currentRefs = j.referrals || [];
            return {
              ...j,
              applications_count: (j.applications_count || 0) + 1,
              referrals: [refObject, ...currentRefs],
            };
          }
          return j;
        })
      );

      // Reopen / update selectedJob so the employee immediately sees their submitted referral
      setSelectedJob((prev) => {
        const base = prev && prev.id === targetJobId ? prev : referJob;
        const currentRefs = base.referrals || [];
        return {
          ...base,
          applications_count: (base.applications_count || 0) + 1,
          referrals: [refObject, ...currentRefs],
        };
      });

      // Reset Refer Form
      setReferJob(null);
      setReferName("");
      setReferEmail("");
      setReferLinkedin("");
      setReferWhyFit("");
      setReferResumeFile(null);

      // Background Refresh
      await loadHirings();
      await loadSummary();
    } catch (err: any) {
      console.error("Referral submit error:", err);
      toast.error(err?.message || "Failed to submit referral. Please try again.");
    } finally {
      setIsSubmittingReferral(false);
    }
  };

  // Delete Candidate Referral
  const [deletingReferralId, setDeletingReferralId] = useState<string | null>(null);

  const handleDeleteReferral = async (referralId: string, candidateName: string) => {
    if (!referralId) return;
    if (!window.confirm(`Are you sure you want to delete the referral for "${candidateName}"?`)) {
      return;
    }

    try {
      setDeletingReferralId(referralId);
      await api.delete(`/hirings/referrals/${referralId}`);
      toast.success(`Referral for ${candidateName} has been deleted.`);

      // Update state immediately
      setSelectedJob((prev) => {
        if (!prev) return null;
        const updatedRefs = (prev.referrals || []).filter(
          (r: any) => (r.id || r._id) !== referralId
        );
        return {
          ...prev,
          referrals: updatedRefs,
          applications_count: Math.max(0, (prev.applications_count || 1) - 1),
        };
      });

      setJobs((prevJobs) =>
        prevJobs.map((j) => {
          if (selectedJob && j.id === selectedJob.id) {
            const updatedRefs = (j.referrals || []).filter(
              (r: any) => (r.id || r._id) !== referralId
            );
            return {
              ...j,
              referrals: updatedRefs,
              applications_count: Math.max(0, (j.applications_count || 1) - 1),
            };
          }
          return j;
        })
      );

      await loadHirings();
      await loadSummary();
    } catch (err: any) {
      console.error("Failed to delete referral:", err);
      toast.error(err?.message || "Failed to delete referral. Please try again.");
    } finally {
      setDeletingReferralId(null);
    }
  };

  // Update Referral Status (Pending -> Contacted -> Interview stages -> Hired / Rejected)
  const handleUpdateReferralStatus = async (
    referralId: string,
    newStatus: string,
    candidateName: string
  ) => {
    if (!referralId || !canManageHirings) {
      toast.error("Only HR, Admins, and Team Leaders can update referral status.");
      return;
    }

    try {
      setUpdatingReferralId(referralId);
      await api.put(`/hirings/referrals/${referralId}`, { status: newStatus });

      // Update in selectedJob immediately
      setSelectedJob((prev) => {
        if (!prev) return null;
        const updatedRefs = (prev.referrals || []).map((r: any) =>
          (r.id || r._id) === referralId ? { ...r, status: newStatus } : r
        );
        return { ...prev, referrals: updatedRefs };
      });

      // Update in jobs list
      setJobs((prevJobs) =>
        prevJobs.map((j) => {
          if (selectedJob && j.id === selectedJob.id) {
            const updatedRefs = (j.referrals || []).map((r: any) =>
              (r.id || r._id) === referralId ? { ...r, status: newStatus } : r
            );
            return { ...j, referrals: updatedRefs };
          }
          return j;
        })
      );

      if (newStatus.toLowerCase() !== "pending") {
        toast.success(
          `Moved to "${newStatus}"! Interview schedule for "${candidateName}" created/updated under "${newStatus}".`
        );
      } else {
        toast.success(`Referral status updated to "${newStatus}"`);
      }

      // Background refresh
      loadHirings();
    } catch (err: any) {
      console.error("Failed to update referral status:", err);
      toast.error(err?.message || "Failed to update referral status.");
    } finally {
      setUpdatingReferralId(null);
    }
  };

  // "Pending" is initial; all next stages come strictly from the Interview section
  const referralStatusOptions = [
    "Pending",
    ...interviewStages.filter(
      (s) =>
        !["pending", "contacted"].includes(
          s.toLowerCase().trim()
        )
    ),
  ];

  const getReferralStatusBadgeClass = (status?: string) => {
    const s = (status || "Pending").toLowerCase().trim();
    if (s === "pending") {
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
    }
    if (s.includes("screen")) {
      return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
    }
    if (s.includes("tech")) {
      return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20";
    }
    if (s.includes("cultur") || s.includes("hr")) {
      return "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20";
    }
    if (s.includes("offer") || s === "hired") {
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    }
    if (s.includes("reject")) {
      return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
    }
    return "bg-primary/10 text-primary border-primary/20";
  };

  // Hiring Status constants and helper
  const HIRING_STATUSES = ["Open", "Closed", "On Hold"] as const;
  type HiringStatus = (typeof HIRING_STATUSES)[number];

  const normalizeStatus = (status?: string): HiringStatus => {
    const s = (status || "").toLowerCase().trim();
    if (s === "open" || s === "active") return "Open";
    if (s === "closed" || s === "close") return "Closed";
    if (s === "on hold" || s === "onhold" || s === "hold") return "On Hold";
    return "Open";
  };

  // Helper for static status badge
  const renderStatusBadge = (status: string) => {
    const s = normalizeStatus(status);
    if (s === "Open") {
      return (
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Open
        </span>
      );
    }
    if (s === "On Hold") {
      return (
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          On Hold
        </span>
      );
    }
    return (
      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-muted text-muted-foreground border border-border inline-flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60" />
        Closed
      </span>
    );
  };

  return (
    <div className="h-full flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">Job Openings</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage active requisitions and hiring pipelines</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <SearchInput
            placeholder="Search jobs, departments..."
            value={searchQuery}
            onChange={setSearchQuery}
            className="w-full sm:w-64 flex-1 min-w-[180px]"
          />
          <button
            type="button"
            onClick={() => {
              if (setActive) {
                setActive("/recruitment/interviews");
              }
              if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("navigate_tab", { detail: "/recruitment/interviews" }));
              }
            }}
            className="px-4 py-2 min-h-[44px] sm:min-h-0 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl text-sm font-bold shadow-xs flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
          >
            <CalendarIcon className="w-4 h-4" /> Interviews
          </button>
          <button
            type="button"
            onClick={() => setShowFilterBar((prev) => !prev)}
            className={cn(
              "p-2 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 inline-flex items-center justify-center border rounded-xl transition-colors shrink-0 cursor-pointer shadow-xs",
              showFilterBar
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-border text-foreground hover:bg-muted/50"
            )}
            title="Toggle Filters"
          >
            <Filter className="w-4 h-4" />
          </button>
          {canManageHirings && (
            <Dialog open={isPostOpen} onOpenChange={setIsPostOpen}>
            <DialogTrigger asChild>
              <button
                type="button"
                className="px-4 py-2 min-h-[44px] sm:min-h-0 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-sm font-bold shadow-sm flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Post Job
              </button>
            </DialogTrigger>
            <DialogContent className="w-[calc(100vw-16px)] sm:w-full sm:max-w-[560px] max-h-[90dvh] flex flex-col p-0 overflow-hidden rounded-2xl sm:rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
              <div className="flex items-center justify-between px-6 md:px-8 py-5 border-b border-border/50 bg-muted/30">
                <div>
                  <h2 className="text-xl md:text-2xl font-black tracking-tight">Post New Job</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Create a new hiring requirement</p>
                </div>
                <DialogClose asChild>
                  <button
                    type="button"
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </DialogClose>
              </div>

              <form onSubmit={handlePostJob} className="flex flex-col min-h-0 max-h-[calc(90dvh-75px)]">
                <div className="p-6 md:p-8 space-y-4 overflow-y-auto flex-1">
                  {/* Job Title */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">
                      Job Title *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Senior Frontend Engineer"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  {/* Department & Employment Type */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">
                        Department *
                      </label>
                      <SearchableSelect
                        value={newDepartment}
                        onChange={(val) => setNewDepartment(val)}
                        options={departments.map((dept) => ({ label: dept, value: dept }))}
                        placeholder="Select Department"
                        className="w-full h-[42px] px-3.5 bg-background border border-border rounded-xl text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">
                        Employment Type *
                      </label>
                      <SearchableSelect
                        value={newType}
                        onChange={(val) => setNewType(val)}
                        options={employmentTypes.map((type) => ({ label: type, value: type }))}
                        placeholder="Select Type"
                        className="w-full h-[42px] px-3.5 bg-background border border-border rounded-xl text-sm"
                      />
                    </div>
                  </div>

                  {/* Location & Status */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">
                        Location *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Remote or Surat, India"
                        required
                        value={newLocation}
                        onChange={(e) => setNewLocation(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">
                        Status
                      </label>
                      <SearchableSelect
                        value={newStatus}
                        onChange={(val) => setNewStatus(val)}
                        options={[
                          { label: "Open", value: "Open" },
                          { label: "Closed", value: "Closed" },
                          { label: "On Hold", value: "On Hold" },
                        ]}
                        placeholder="Select Status"
                        className="w-full h-[42px] px-3.5 bg-background border border-border rounded-xl text-sm"
                      />
                    </div>
                  </div>

                  {/* Hiring Manager Selection */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">
                      Hiring Manager (Optional)
                    </label>
                    <SearchableSelect
                      value={newHiringManagerId}
                      onChange={(val) => setNewHiringManagerId(val)}
                      options={[
                        { label: "None / Unassigned", value: "" },
                        ...managers.map((m) => ({
                          label: `${m.full_name} (${m.designation || m.department || "Staff"})`,
                          value: m.employee_id,
                        })),
                      ]}
                      placeholder="Select Hiring Manager"
                      className="w-full h-[42px] px-3.5 bg-background border border-border rounded-xl text-sm"
                    />
                  </div>

                  {/* Experience & Salary Range */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">
                        Experience (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 2-4 years"
                        value={newExperience}
                        onChange={(e) => setNewExperience(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">
                        Salary Range (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. ₹8L - ₹12L or $80k - $100k"
                        value={newSalary}
                        onChange={(e) => setNewSalary(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>

                  {/* Job Description */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">
                      Job Description & Requirements
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Brief details about the role, key responsibilities and qualifications..."
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>

                <div className="px-6 md:px-8 py-4 bg-muted/30 border-t border-border/50 flex justify-end gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsPostOpen(false)}
                    className="px-4 py-2 bg-card border border-border text-foreground hover:bg-muted font-bold text-sm rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPosting}
                    className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm rounded-xl transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isPosting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isPosting ? "Posting..." : "Post Job"}
                  </button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          )}
        </div>
      </div>

      {/* Filter Bar (Collapsible) */}
      {showFilterBar && (
        <div className="p-4 bg-card border border-border rounded-2xl shadow-xs flex flex-wrap items-center gap-4 animate-in fade-in duration-200">
          <div className="flex-1 min-w-[160px]">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">
              Department
            </label>
            <SearchableSelect
              value={selectedDepartment}
              onChange={setSelectedDepartment}
              options={[{ label: "All Departments", value: "ALL" }, ...departments.map((d) => ({ label: d, value: d }))]}
              placeholder="All Departments"
              className="w-full h-[36px] bg-background text-xs"
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">
              Employment Type
            </label>
            <SearchableSelect
              value={selectedType}
              onChange={setSelectedType}
              options={[{ label: "All Types", value: "ALL" }, ...employmentTypes.map((t) => ({ label: t, value: t }))]}
              placeholder="All Types"
              className="w-full h-[36px] bg-background text-xs"
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">
              Status
            </label>
            <SearchableSelect
              value={selectedStatus}
              onChange={setSelectedStatus}
              options={[
                { label: "All Statuses", value: "ALL" },
                { label: "Open", value: "Open" },
                { label: "Closed", value: "Closed" },
                { label: "On Hold", value: "On Hold" },
              ]}
              placeholder="All Statuses"
              className="w-full h-[36px] bg-background text-xs"
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setSelectedDepartment("ALL");
                setSelectedType("ALL");
                setSelectedStatus("ALL");
                setSearchQuery("");
              }}
              className="h-[36px] px-3.5 bg-muted text-muted-foreground hover:text-foreground text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
          </div>
        </div>
      )}

      {/* Stats Overview (Live Backend Dashboard Metrics) */}
      <div className="grid grid-cols-1 min-[360px]:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Active Jobs",
            value: summary ? summary.active_jobs.count : jobs.filter((j) => j.status === "Open" || j.status === "Active").length,
            trend: summary?.active_jobs?.trend_text || "Active positions",
            color: "text-emerald-600 dark:text-emerald-400",
          },
          {
            label: "Total Applicants",
            value: summary ? summary.total_applicants.count : jobs.reduce((acc, j) => acc + (j.applications_count || 0), 0),
            trend: summary?.total_applicants?.trend_text || "Across all postings",
            color: "text-primary",
          },
          {
            label: "Interviews Scheduled",
            value: summary ? summary.interviews_scheduled.count : 0,
            trend: summary?.interviews_scheduled?.trend_text || "In candidate pipeline",
            color: "text-blue-600 dark:text-blue-400",
          },
          {
            label: "Offers Extended",
            value: summary ? summary.offers_extended.count : 0,
            trend: summary?.offers_extended?.trend_text || "Hiring confirmations",
            color: "text-purple-600 dark:text-purple-400",
          },
        ].map((stat) => (
          <div key={stat.label} className="bg-card p-5 rounded-2xl border border-border shadow-xs min-w-0">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">{stat.label}</p>
            <div className="flex items-baseline gap-2.5">
              <h3 className="text-2xl font-black text-foreground">{stat.value}</h3>
              <p className={cn("text-xs font-medium truncate", stat.color)}>{stat.trend}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-card rounded-2xl border border-border p-6 space-y-4 animate-pulse"
            >
              <div className="flex justify-between items-center">
                <div className="h-6 w-24 bg-muted rounded-full" />
                <div className="h-6 w-16 bg-muted rounded-full" />
              </div>
              <div className="h-6 w-3/4 bg-muted rounded-md" />
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="h-4 bg-muted rounded" />
                <div className="h-4 bg-muted rounded" />
              </div>
              <div className="h-10 bg-muted rounded-xl pt-4" />
            </div>
          ))}
        </div>
      ) : filteredJobs.length === 0 ? (
        /* Empty State */
        <div className="bg-card rounded-2xl border border-border p-12 text-center flex flex-col items-center justify-center max-w-lg mx-auto w-full my-6 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
            <BriefcaseBusiness className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-black text-foreground tracking-tight">No Job Openings Found</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            {searchQuery || selectedDepartment !== "ALL" || selectedStatus !== "ALL"
              ? "No jobs match your selected filter criteria. Try resetting filters."
              : "There are currently no job postings. Create one to begin receiving applications and referrals."}
          </p>
          <div className="mt-6 flex gap-3">
            {searchQuery || selectedDepartment !== "ALL" || selectedStatus !== "ALL" ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedDepartment("ALL");
                  setSelectedStatus("ALL");
                  setSelectedType("ALL");
                }}
                className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Clear Filters
              </button>
            ) : null}
            {canManageHirings && (
              <button
                type="button"
                onClick={() => setIsPostOpen(true)}
                className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold rounded-xl transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <Plus className="w-4 h-4" /> Post Your First Job
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Grid of Job Cards */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-4">
          {filteredJobs.map((job) => (
            <div
              key={job.id}
              className="bg-card rounded-2xl border border-border shadow-xs hover:shadow-md transition-all group flex flex-col min-w-0"
            >
              <div className="p-5 border-b border-border/50 flex-1 flex flex-col">
                <div className="flex justify-between items-start gap-2 mb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-muted text-foreground">
                      {job.department}
                    </span>
                    {renderStatusBadge(job.status)}
                  </div>

                  {canManageHirings && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
                          title="Job actions"
                        >
                          <MoreHorizontal className="w-5 h-5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44 rounded-xl p-1.5">
                        <DropdownMenuItem
                          onClick={() => setSelectedJob(job)}
                          className="text-xs font-semibold cursor-pointer"
                        >
                          <ArrowUpRight className="w-4 h-4 mr-2" /> View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => openEditModal(job)}
                          className="text-xs font-semibold cursor-pointer"
                        >
                          <Pencil className="w-4 h-4 mr-2" /> Update Posting
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setJobToDelete(job)}
                          className="text-xs font-semibold text-rose-600 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/20 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Delete Posting
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1 mb-4">
                  {job.job_title}
                </h3>

                <div className="grid grid-cols-2 gap-y-2.5 gap-x-2 text-xs text-foreground/80 font-medium mb-5">
                  <div className="flex items-center gap-1.5 truncate">
                    <Briefcase className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{job.employment_type}</span>
                  </div>
                  <div className="flex items-center gap-1.5 truncate">
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{job.location}</span>
                  </div>
                  <div className="flex items-center gap-1.5 truncate">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{job.posted_date}</span>
                  </div>
                  <div className="flex items-center gap-1.5 truncate">
                    <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{job.applications_count} applied</span>
                  </div>
                </div>

                {/* Pipeline visual bar */}
                <div className="mt-auto space-y-1.5 pt-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-muted-foreground">Applications</span>
                    <span className="text-primary font-semibold">{job.applications_count} candidate(s)</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, Math.max(15, (job.applications_count || 0) * 10))}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Card Footer: Hiring Manager & Actions */}
              <div className="p-4 bg-muted/30 rounded-b-2xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  {job.hiring_manager?.profile_picture ? (
                    <img
                      src={job.hiring_manager.profile_picture}
                      alt={job.hiring_manager.full_name}
                      className="w-8 h-8 rounded-full border border-border object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                      {(job.hiring_manager?.full_name || "HM").slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">
                      Hiring Manager
                    </p>
                    <p className="text-xs font-bold text-foreground truncate">
                      {job.hiring_manager?.full_name || "Unassigned"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setReferJob(job)}
                    className="px-2.5 py-1.5 bg-card border border-border hover:bg-muted text-xs font-bold text-foreground rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                  >
                    <UserPlus className="w-3.5 h-3.5 text-primary" /> Refer
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedJob(job)}
                    className="px-2.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-xs font-bold text-primary rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    Details <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Details Modal */}
      <Dialog open={!!selectedJob} onOpenChange={(open) => !open && setSelectedJob(null)}>
        <DialogContent className="w-[calc(100vw-16px)] sm:w-full max-w-2xl p-0 overflow-hidden rounded-2xl sm:rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className="flex items-center justify-between px-6 py-5 border-b border-border/50 bg-muted/30">
            <div className="min-w-0 pr-4">
              <div className="flex items-center gap-2 mb-1">
                {selectedJob && renderStatusBadge(selectedJob.status)}
                <span className="text-xs font-semibold text-muted-foreground">
                  Posted: {selectedJob?.posted_date}
                </span>
              </div>
              <h2 className="text-xl font-black tracking-tight truncate text-foreground">
                {selectedJob?.job_title}
              </h2>
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

          {selectedJob && (
            <div className="space-y-6 px-6 md:px-8 py-6 max-h-[75vh] overflow-y-auto">
              {/* Badges strip */}
              <div className="flex flex-wrap gap-3">
                <div className="bg-muted/60 px-3 py-1.5 rounded-xl flex items-center gap-2">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Dept</span>
                  <span className="text-xs font-bold text-foreground">{selectedJob.department}</span>
                </div>
                <div className="bg-muted/60 px-3 py-1.5 rounded-xl flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-bold text-foreground">{selectedJob.location}</span>
                </div>
                <div className="bg-muted/60 px-3 py-1.5 rounded-xl flex items-center gap-2">
                  <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-bold text-foreground">{selectedJob.employment_type}</span>
                </div>
                {selectedJob.salary_range && (
                  <div className="bg-muted/60 px-3 py-1.5 rounded-xl flex items-center gap-2">
                    <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-bold text-foreground">{selectedJob.salary_range}</span>
                  </div>
                )}
                {selectedJob.experience && (
                  <div className="bg-muted/60 px-3 py-1.5 rounded-xl flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-bold text-foreground">{selectedJob.experience}</span>
                  </div>
                )}
              </div>

              {/* Description */}
              {selectedJob.job_description && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Role Description & Requirements
                  </h4>
                  <div className="p-4 bg-muted/30 border border-border/50 rounded-xl text-sm leading-relaxed whitespace-pre-line text-foreground/90">
                    {selectedJob.job_description}
                  </div>
                </div>
              )}

              {/* Hiring Manager & Pipeline Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-muted/30 border border-border/50 rounded-xl space-y-2">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Hiring Manager
                  </h4>
                  {selectedJob.hiring_manager ? (
                    <div className="flex items-center gap-3 pt-1">
                      {selectedJob.hiring_manager.profile_picture ? (
                        <img
                          src={selectedJob.hiring_manager.profile_picture}
                          alt={selectedJob.hiring_manager.full_name}
                          className="w-10 h-10 rounded-full border border-border object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                          {selectedJob.hiring_manager.full_name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">
                          {selectedJob.hiring_manager.full_name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {selectedJob.hiring_manager.designation || selectedJob.hiring_manager.department || selectedJob.hiring_manager.email}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic pt-1">No hiring manager assigned</p>
                  )}
                </div>

                <div className="p-4 bg-muted/30 border border-border/50 rounded-xl space-y-2">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Applications Pipeline
                  </h4>
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-muted-foreground">Total Applicants</span>
                    <span className="text-base font-black text-primary">{selectedJob.applications_count}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Status</span>
                    <span>{renderStatusBadge(selectedJob.status)}</span>
                  </div>
                </div>
              </div>

              {/* Referrals list (Admin/HR sees all; normal employees see strictly only their own) */}
              {(() => {
                const currentUserEmpId = String(anyUser?.id || anyUser?._id || anyUser?.employee_id || "").trim();
                const currentUserEmail = String(anyUser?.email || anyUser?.personal_info?.email_address || "").trim().toLowerCase();
                const isStrictAdminOrHR =
                  isUserAdmin(user) ||
                  userRole === "admin" ||
                  userRole === "superadmin" ||
                  userRole === "super admin" ||
                  userRole === "ceo" ||
                  userRole === "hr" ||
                  userRole.includes("hr") ||
                  userDepartment === "hr" ||
                  userDepartment.includes("hr");

                const visibleReferrals = (selectedJob.referrals || []).filter((ref) => {
                  if (isStrictAdminOrHR) return true; // Only Admin and HR see ALL referrals

                  const refEmpId = String(ref.referred_by?.employee_id || (ref as any)?.employee_id || "").trim();
                  const refEmail = String(ref.referred_by?.email || "").trim().toLowerCase();

                  const matchesId = Boolean(
                    (currentUserEmpId && refEmpId && currentUserEmpId === refEmpId) ||
                    (anyUser?.id && refEmpId && String(anyUser.id).trim() === refEmpId) ||
                    (anyUser?._id && refEmpId && String(anyUser._id).trim() === refEmpId) ||
                    (anyUser?.employee_id && refEmpId && String(anyUser.employee_id).trim() === refEmpId)
                  );

                  const matchesEmail = Boolean(
                    (currentUserEmail && refEmail && currentUserEmail === refEmail) ||
                    (user?.email && refEmail && String(user.email).trim().toLowerCase() === refEmail)
                  );

                  if (matchesId || matchesEmail) return true;

                  // If referral doesn't have referred_by populated, backend already filtered it for this user!
                  if (!refEmpId && !refEmail) return true;

                  return false;
                });

                if (visibleReferrals.length === 0) {
                  return (
                    <div className="p-4 rounded-xl border border-dashed border-border/80 bg-muted/20 text-center space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground">
                        {isStrictAdminOrHR
                          ? "No candidate referrals submitted for this job yet."
                          : "You haven't submitted a referral for this position yet."}
                      </p>
                      <p className="text-[11px] text-muted-foreground/80">
                        {isStrictAdminOrHR
                          ? "When team members submit candidate referrals, they will appear here."
                          : "Click '+ Refer Candidate' below to refer a friend or contact."}
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        Submitted Referrals ({visibleReferrals.length})
                      </h4>
                      <span className="text-[11px] text-muted-foreground font-medium">
                        {isStrictAdminOrHR ? "All team referrals" : "Your submitted referral(s)"}
                      </span>
                    </div>
                    <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                      {visibleReferrals.map((ref, idx) => {
                        const rawResume = ref.resume_url || (ref as any).resume || (ref as any).file_url || (ref as any).url;
                        const fullResumeUrl = getFullResumeUrl(rawResume);
                        const refId = ref.id || ref._id;

                        const refEmpId = String(ref.referred_by?.employee_id || (ref as any)?.employee_id || "").trim();
                        const refEmail = String(ref.referred_by?.email || "").trim().toLowerCase();
                        const isOwner =
                          !isStrictAdminOrHR ||
                          Boolean(
                            (currentUserEmpId && refEmpId && currentUserEmpId === refEmpId) ||
                            (currentUserEmail && refEmail && currentUserEmail === refEmail) ||
                            (anyUser?.id && refEmpId && String(anyUser.id).trim() === refEmpId) ||
                            (anyUser?._id && refEmpId && String(anyUser._id).trim() === refEmpId) ||
                            (anyUser?.employee_id && refEmpId && String(anyUser.employee_id).trim() === refEmpId) ||
                            (user?.email && refEmail && String(user.email).trim().toLowerCase() === refEmail)
                          );

                        const canDeleteThisReferral = isStrictAdminOrHR || isOwner;

                        return (
                          <div
                            key={refId || idx}
                            className="p-3.5 bg-muted/30 border border-border/70 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-foreground text-sm">{ref.candidate_name}</p>
                                {canManageHirings ? (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button
                                        type="button"
                                        disabled={updatingReferralId === refId}
                                        className={cn(
                                          "px-2.5 py-0.5 rounded-full text-[11px] font-semibold border inline-flex items-center gap-1.5 transition-all hover:opacity-85 cursor-pointer shadow-2xs",
                                          getReferralStatusBadgeClass(ref.status)
                                        )}
                                        title="Click to change referral status"
                                      >
                                        {updatingReferralId === refId ? (
                                          <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                          <>
                                            <span>{ref.status || "Pending"}</span>
                                            <ChevronDown className="w-3 h-3 opacity-60" />
                                          </>
                                        )}
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="w-48 p-1.5 shadow-xl rounded-xl z-50">
                                      <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                        Update Pipeline Status
                                      </div>
                                      <DropdownMenuSeparator className="my-1" />
                                      {referralStatusOptions.map((opt) => {
                                        const isCurrent =
                                          (ref.status || "Pending").toLowerCase().trim() === opt.toLowerCase().trim();
                                        return (
                                          <DropdownMenuItem
                                            key={opt}
                                            onClick={() => handleUpdateReferralStatus(refId, opt, ref.candidate_name)}
                                            className={cn(
                                              "flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg cursor-pointer transition-colors",
                                              isCurrent && "font-bold text-primary bg-primary/10"
                                            )}
                                          >
                                            <span className="flex items-center gap-2">
                                              <span
                                                className={cn(
                                                  "w-2 h-2 rounded-full",
                                                  opt.toLowerCase() === "pending"
                                                    ? "bg-amber-500"
                                                    : "bg-primary"
                                                )}
                                              />
                                              {opt}
                                            </span>
                                            {isCurrent && <Check className="w-3.5 h-3.5 text-primary" />}
                                          </DropdownMenuItem>
                                        );
                                      })}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                ) : (
                                  <span
                                    className={cn(
                                      "px-2 py-0.5 rounded-full text-[10px] font-semibold border inline-flex items-center gap-1",
                                      getReferralStatusBadgeClass(ref.status)
                                    )}
                                  >
                                    <span
                                      className={cn(
                                        "w-1.5 h-1.5 rounded-full",
                                        (ref.status || "Pending").toLowerCase() === "pending"
                                          ? "bg-amber-500"
                                          : "bg-primary"
                                      )}
                                    />
                                    {ref.status || "Pending"}
                                  </span>
                                )}
                              </div>
                              <p className="text-muted-foreground">{ref.candidate_email}</p>
                              {ref.referred_by?.full_name && (
                                <p className="text-[11px] text-muted-foreground/90">
                                  Referred by: <span className="font-semibold text-foreground">{ref.referred_by.full_name}</span>
                                  {ref.referred_by?.department ? ` (${ref.referred_by.department})` : ""}
                                </p>
                              )}
                              {ref.why_good_fit && (
                                <p className="text-[11px] text-muted-foreground italic line-clamp-2 mt-0.5">
                                  "{ref.why_good_fit}"
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                              {ref.linkedin_profile && (
                                <a
                                  href={ref.linkedin_profile.startsWith("http") ? ref.linkedin_profile : `https://${ref.linkedin_profile}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2.5 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 font-bold rounded-lg transition-colors text-[11px]"
                                >
                                  LinkedIn
                                </a>
                              )}
                              {fullResumeUrl ? (
                                <a
                                  href={fullResumeUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                  }}
                                  className="px-2.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary font-bold rounded-lg flex items-center gap-1 transition-colors text-[11px] cursor-pointer"
                                  title="Open uploaded resume"
                                >
                                  <FileText className="w-3.5 h-3.5" /> Resume
                                </a>
                              ) : null}
                              {canDeleteThisReferral && (
                                <button
                                  type="button"
                                  disabled={deletingReferralId === refId}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteReferral(refId, ref.candidate_name);
                                  }}
                                  className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold rounded-lg flex items-center gap-1 transition-colors text-[11px] cursor-pointer disabled:opacity-50"
                                  title="Delete this referral"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>{deletingReferralId === refId ? "Deleting..." : "Delete"}</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Action buttons */}
              <div className="pt-4 border-t border-border/50 flex flex-wrap items-center justify-between gap-3">
                <div />
                <div className="flex gap-2">
                  {canManageHirings && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          const jobToEdit = selectedJob;
                          setSelectedJob(null);
                          openEditModal(jobToEdit);
                        }}
                        className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5 text-primary" /> Update Job
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setJobToDelete(selectedJob);
                        }}
                        className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete Job
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setReferJob(selectedJob);
                      setSelectedJob(null);
                    }}
                    className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" /> Refer Candidate
                  </button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Refer a Friend Modal (Connected to backend API & resume upload) */}
      <Dialog open={!!referJob} onOpenChange={(open) => !open && setReferJob(null)}>
        <DialogContent className="w-[calc(100vw-16px)] sm:w-full max-w-md p-0 overflow-hidden rounded-2xl sm:rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className="flex items-center justify-between px-6 py-5 border-b border-border/50 bg-muted/30">
            <div className="min-w-0 pr-2">
              <h2 className="text-base sm:text-lg font-black tracking-tight truncate">
                Refer for {referJob?.job_title}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">Submit a candidate recommendation</p>
            </div>
            <DialogClose asChild>
              <button
                type="button"
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors shrink-0 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </DialogClose>
          </div>

          <form onSubmit={handleSubmitReferral} className="space-y-4 px-6 py-5 max-h-[75vh] overflow-y-auto">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">
                Candidate Name *
              </label>
              <input
                type="text"
                required
                placeholder="Full Name"
                value={referName}
                onChange={(e) => setReferName(e.target.value)}
                className="w-full px-3.5 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">
                Candidate Email *
              </label>
              <input
                type="email"
                required
                placeholder="candidate@example.com"
                value={referEmail}
                onChange={(e) => setReferEmail(e.target.value)}
                className="w-full px-3.5 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">
                LinkedIn Profile (Optional)
              </label>
              <input
                type="url"
                placeholder="https://linkedin.com/in/..."
                value={referLinkedin}
                onChange={(e) => setReferLinkedin(e.target.value)}
                className="w-full px-3.5 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">
                Resume / CV (Optional)
              </label>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                onChange={(e) => setReferResumeFile(e.target.files?.[0] || null)}
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">
                Why are they a good fit? *
              </label>
              <textarea
                required
                rows={3}
                placeholder="Candidate background, key achievements, or reason for recommending..."
                value={referWhyFit}
                onChange={(e) => setReferWhyFit(e.target.value)}
                className="w-full px-3.5 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="pt-3 border-t border-border/50 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setReferJob(null)}
                className="px-4 py-2 bg-card border border-border text-foreground hover:bg-muted font-bold text-xs rounded-xl transition-colors shrink-0 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingReferral}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmittingReferral && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {isSubmittingReferral ? "Submitting..." : "Submit Referral"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Update Job Modal */}
      <Dialog open={!!editingJob} onOpenChange={(open) => !open && setEditingJob(null)}>
        <DialogContent className="w-[calc(100vw-16px)] sm:w-full sm:max-w-[560px] max-h-[90dvh] flex flex-col p-0 overflow-hidden rounded-2xl sm:rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className="flex items-center justify-between px-6 md:px-8 py-5 border-b border-border/50 bg-muted/30">
            <div>
              <h2 className="text-xl md:text-2xl font-black tracking-tight">Update Job Posting</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Edit requirements, hiring manager, or status</p>
            </div>
            <DialogClose asChild>
              <button
                type="button"
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </DialogClose>
          </div>

          <form onSubmit={handleUpdateJob} className="flex flex-col min-h-0 max-h-[calc(90dvh-75px)]">
            <div className="p-6 md:p-8 space-y-4 overflow-y-auto flex-1">
              {/* Job Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">
                  Job Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senior Frontend Engineer"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Department & Employment Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">
                    Department *
                  </label>
                  <SearchableSelect
                    value={editDepartment}
                    onChange={(val) => setEditDepartment(val)}
                    options={departments.map((dep) => ({ label: dep, value: dep }))}
                    placeholder="Select Department"
                    className="w-full h-[42px] px-3.5 bg-background border border-border rounded-xl text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">
                    Employment Type *
                  </label>
                  <SearchableSelect
                    value={editType}
                    onChange={(val) => setEditType(val)}
                    options={employmentTypes.map((type) => ({ label: type, value: type }))}
                    placeholder="Select Type"
                    className="w-full h-[42px] px-3.5 bg-background border border-border rounded-xl text-sm"
                  />
                </div>
              </div>

              {/* Location & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">
                    Location *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Remote or Surat, India"
                    required
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">
                    Status
                  </label>
                  <SearchableSelect
                    value={editStatus}
                    onChange={(val) => setEditStatus(val)}
                    options={[
                      { label: "Open", value: "Open" },
                      { label: "Closed", value: "Closed" },
                      { label: "On Hold", value: "On Hold" },
                    ]}
                    placeholder="Select Status"
                    className="w-full h-[42px] px-3.5 bg-background border border-border rounded-xl text-sm"
                  />
                </div>
              </div>

              {/* Hiring Manager Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">
                  Hiring Manager (Optional)
                </label>
                <SearchableSelect
                  value={editHiringManagerId}
                  onChange={(val) => setEditHiringManagerId(val)}
                  options={[
                    { label: "None / Unassigned", value: "" },
                    ...managers.map((m) => ({
                      label: `${m.full_name} (${m.designation || m.department || "Staff"})`,
                      value: m.employee_id,
                    })),
                  ]}
                  placeholder="Select Hiring Manager"
                  className="w-full h-[42px] px-3.5 bg-background border border-border rounded-xl text-sm"
                />
              </div>

              {/* Experience & Salary Range */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">
                    Experience (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 2-4 years"
                    value={editExperience}
                    onChange={(e) => setEditExperience(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">
                    Salary Range (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ₹8L - ₹12L or $80k - $100k"
                    value={editSalary}
                    onChange={(e) => setEditSalary(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              {/* Job Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">
                  Job Description & Requirements
                </label>
                <textarea
                  rows={3}
                  placeholder="Brief details about the role, key responsibilities and qualifications..."
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="px-6 md:px-8 py-4 bg-muted/30 border-t border-border/50 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setEditingJob(null)}
                className="px-4 py-2 bg-card border border-border text-foreground hover:bg-muted font-bold text-sm rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUpdating}
                className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm rounded-xl transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isUpdating && <Loader2 className="w-4 h-4 animate-spin" />}
                {isUpdating ? "Updating..." : "Update Job"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Job Confirmation Dialog */}
      <Dialog open={!!jobToDelete} onOpenChange={(open) => !open && setJobToDelete(null)}>
        <DialogContent className="w-[calc(100vw-16px)] sm:w-full max-w-md p-6 rounded-2xl gap-4 border-border/60 shadow-2xl bg-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Delete Job Opening?</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Are you sure you want to delete <span className="font-semibold text-foreground">"{jobToDelete?.job_title}"</span>? This action cannot be undone.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setJobToDelete(null)}
              className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => jobToDelete && handleDeleteJob(jobToDelete.id)}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isDeleting ? "Deleting..." : "Confirm Delete"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
