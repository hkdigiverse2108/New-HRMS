import React, { useState, useEffect, useRef } from "react";
import {
  Trophy,
  Users,
  History,
  Settings,
  Edit,
  Play,
  SquarePause,
  Copy,
  Check,
  Plus,
  Trash2,
  Calendar,
  Search,
  Sparkles,
  RotateCcw,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  ArrowUp,
  ArrowDown,
  Maximize2,
  Minimize2,
  Crown,
  Zap
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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useUser } from "@/hooks/useUser";
import { cn } from "@/lib/utils";

// --- Confetti particle engine for Auditorium Celebration (Zero dependencies) ---
const triggerConfetti = (isGrandFinale = false) => {
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
    const colors = ["#22D3EE", "#FBBF24", "#A855F7", "#EC4899", "#10B981", "#3B82F6", "#FFFFFF", "#FF6B6B"];
    const count = isGrandFinale ? 450 : 140;

    for (let i = 0; i < count; i++) {
      pieces.push({
        x: isGrandFinale ? Math.random() * canvas.width : canvas.width / 2,
        y: isGrandFinale ? canvas.height : canvas.height / 2,
        vx: (Math.random() - 0.5) * (isGrandFinale ? 32 : 20),
        vy: (Math.random() - (isGrandFinale ? 0.95 : 0.8)) * (isGrandFinale ? 28 : 20),
        size: Math.random() * 10 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rSpeed: (Math.random() - 0.5) * 14,
        opacity: 1
      });
    }

    let frame = 0;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      pieces.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.35;
        p.opacity -= 0.007;
        p.rotation += p.rSpeed;

        if (p.opacity > 0) {
          alive = true;
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
      if (alive && frame < 300) {
        requestAnimationFrame(animate);
      } else {
        canvas.remove();
      }
    };
    animate();
  } catch (e) {
    console.error(e);
  }
};

const triggerGrandFinaleConfetti10s = () => {
  try {
    const endTime = Date.now() + 10 * 1000;
    const interval: any = setInterval(() => {
      if (Date.now() > endTime) {
        clearInterval(interval);
        return;
      }
      triggerConfetti(true);
    }, 1100);
    triggerConfetti(true);
  } catch (e) {
    console.error(e);
  }
};

interface Criterion {
  id?: string;
  name: string;
  maxScore: number;
  isFixed: boolean;
  order?: number;
  assignedPersonIds?: string[];
  entryType?: "direct" | "multi_admin" | string;
  category?: "+ve" | "-ve" | string;
}

interface LeaderboardEntry {
  employeeId: string;
  name: string;
  department: string;
  designation: string;
  avatar: string;
  criteriaScores: Record<string, number>;
  totalScore: number;
  rank: number;
}

interface MonthHistoryItem {
  month_year: string;
  criteriaCount: number;
  winner: string;
  winnerScore: number;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export function Recognitions() {
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

  const now = new Date();
  const currentYearNum = now.getFullYear();
  const currentMonthIdx = now.getMonth();

  // Active Tab: Criteria first, Leaderboard second
  const [activeTab, setActiveTab] = useState<"criteria" | "leaderboard">("criteria");

  // Delete Parameter Modal State
  const [deleteParamModalOpen, setDeleteParamModalOpen] = useState(false);
  const [paramToDelete, setParamToDelete] = useState<{ index: number; name: string } | null>(null);

  // Selected Month/Year State
  const [selectedMonth, setSelectedMonth] = useState<string>(MONTHS[currentMonthIdx] ?? "September");
  const [selectedYear, setSelectedYear] = useState<string>(String(currentYearNum));

  const monthNumber = String(MONTHS.indexOf(selectedMonth) + 1).padStart(2, "0");
  const monthYearStr = `${selectedYear}-${monthNumber}`;

  // Data States
  const [loading, setLoading] = useState(true);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [monthHistory, setMonthHistory] = useState<MonthHistoryItem[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  // Drag and drop state for criteria
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Modals
  const [participantModalOpen, setParticipantModalOpen] = useState(false);
  const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>([]);
  const [empSearch, setEmpSearch] = useState("");
  const [savingParticipants, setSavingParticipants] = useState(false);

  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [masterModalOpen, setMasterModalOpen] = useState(false);
  const [masterCriteria, setMasterCriteria] = useState<Criterion[]>([]);
  const [savingMaster, setSavingMaster] = useState(false);

  // Score Entry Stepper / Matrix States
  const [scoreEntryModalOpen, setScoreEntryModalOpen] = useState(false);
  const [scoreViewMode, setScoreViewMode] = useState<"stepper" | "matrix">("stepper");
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [scoreMatrix, setScoreMatrix] = useState<Record<string, Record<string, number | "">>>({});
  const [rawQuantityMap, setRawQuantityMap] = useState<Record<string, Record<string, number | "">>>({});
  const [calculatedRankMap, setCalculatedRankMap] = useState<Record<string, Record<string, number | "">>>({});
  const [savingScores, setSavingScores] = useState(false);
  const [autoCalculating, setAutoCalculating] = useState<Record<string, boolean>>({});

  // Auditorium Reveal Ceremony States
  const [revealModalOpen, setRevealModalOpen] = useState(false);
  const [revealDateTime, setRevealDateTime] = useState<string>("");
  const [savingReveal, setSavingReveal] = useState(false);

  // Auditorium Presentation Interactive Modal
  const [ceremonyOpen, setCeremonyOpen] = useState(false);
  const [ceremonyStage, setCeremonyStage] = useState<number>(0);
  const [ceremonyFullscreen, setCeremonyFullscreen] = useState(false);
  const [isWinnerAnnounced, setIsWinnerAnnounced] = useState(false);
  const [isTop2Showdown, setIsTop2Showdown] = useState(false);
  const [teasingEmpId, setTeasingEmpId] = useState<string | null>(null);
  const [finaleRevealedIds, setFinaleRevealedIds] = useState<Set<string>>(new Set());
  const [finaleRevealQueue, setFinaleRevealQueue] = useState<LeaderboardEntry[]>([]);
  const [isAutoPlayingStory, setIsAutoPlayingStory] = useState(false);
  const [rankShiftHighlights, setRankShiftHighlights] = useState<
    Record<string, { diff: number; from: number; to: number; direction: "up" | "down" }>
  >({});
  const highlightTimerRef = useRef<NodeJS.Timeout | null>(null);

  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYearNum - i);

  // Load Criteria, Leaderboard, Employees, and Month History
  const loadData = async () => {
    setLoading(true);
    try {
      const [cRes, lRes, hRes, eRes, cfgRes] = await Promise.all([
        api.get<Criterion[]>(`/eom/criteria?month_year=${monthYearStr}`, { showLoader: false }).catch(() => []),
        api.get<any>(`/eom/leaderboard?month_year=${monthYearStr}`, { showLoader: false }).catch(() => ({ leaderboard: [] })),
        api.get<MonthHistoryItem[]>(`/eom/month-history`, { showLoader: false }).catch(() => []),
        api.get<any>(`/employees`, { showLoader: false }).catch(() => []),
        api.get<any>(`/eom/month-config?month_year=${monthYearStr}`, { showLoader: false }).catch(() => null),
      ]);

      const sortedCriteria = Array.isArray(cRes)
        ? [...cRes].sort((a, b) => (Number(a.order || 0) - Number(b.order || 0)))
        : [];
      setCriteria(sortedCriteria);
      setLeaderboard(lRes?.leaderboard || []);
      setMonthHistory(Array.isArray(hRes) ? hRes : []);

      const rawEmps = Array.isArray(eRes) ? eRes : (eRes?.data || eRes?.employees || []);
      const mappedEmps = rawEmps.map((emp: any) => {
        const p = emp.personal_info || {};
        const w = emp.work_details || {};
        const fullName = p.first_name ? `${p.first_name} ${p.last_name || ""}`.trim() : (emp.name || "Employee");
        return {
          id: String(emp._id || emp.id),
          name: fullName,
          department: w.department || emp.department || "General",
          designation: w.designation || emp.designation || "Staff",
          role: w.system_role || emp.role || "Employee",
          avatar: p.profile_picture || emp.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(fullName)}`
        };
      });
      setEmployees(mappedEmps);

      if (cfgRes) {
        setRevealDateTime(cfgRes.revealDateTime || "");
        if (cfgRes.isConfigured && Array.isArray(cfgRes.selectedEmployeeIds)) {
          setSelectedEmpIds(cfgRes.selectedEmployeeIds);
        } else {
          // Default: all non-admin employees
          const nonAdmins = mappedEmps.filter((e: any) => {
            const r = String(e.role || "").toLowerCase();
            return !["admin", "superadmin", "founder"].includes(r);
          });
          setSelectedEmpIds(nonAdmins.map((e: any) => e.id));
        }
      }
    } catch (err: any) {
      console.error("Failed to load EOM data:", err);
      toast.error("Failed to load EOM data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [monthYearStr]);

  // Open Score Entry Matrix / Stepper
  const handleOpenScoreEntry = async () => {
    try {
      const scoresRes = await api.get<any[]>(`/eom/scores?month_year=${monthYearStr}`, { showLoader: false });
      const initialMatrix: Record<string, Record<string, number | "">> = {};
      const initialQty: Record<string, Record<string, number | "">> = {};
      const initialRanks: Record<string, Record<string, number | "">> = {};

      (scoresRes || []).forEach((s) => {
        const eId = String(s.employeeId);
        const cId = String(s.criteriaId);
        if (!initialMatrix[eId]) initialMatrix[eId] = {};
        if (!initialQty[eId]) initialQty[eId] = {};
        if (!initialRanks[eId]) initialRanks[eId] = {};

        initialMatrix[eId][cId] = s.score ?? "";
        if (s.rawQuantity !== undefined && s.rawQuantity !== null) {
          initialQty[eId][cId] = s.rawQuantity;
        }
        if (s.calculatedRank !== undefined && s.calculatedRank !== null) {
          initialRanks[eId][cId] = s.calculatedRank;
        }
      });

      setScoreMatrix(initialMatrix);
      setRawQuantityMap(initialQty);
      setCalculatedRankMap(initialRanks);
      setCurrentStepIndex(0);
      setScoreEntryModalOpen(true);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load scores for entry");
    }
  };

  // Math calculation engine for equal-interval ranking
  const computeHybridScoresForCriteria = (
    crit: Criterion,
    currentEmpList: any[],
    currentQtyMap: Record<string, Record<string, number | "">>,
    currentRankMap: Record<string, Record<string, number | "">>,
    currentScoresMap: Record<string, Record<string, number | "">>
  ) => {
    const maxScore = Number(crit.maxScore) || 10;
    const N = currentEmpList.length;
    if (N === 0) return { updatedScores: currentScoresMap, updatedRanks: currentRankMap };

    const interval = N > 1 ? maxScore / (N - 1) : 0;
    const isLowerBetter = crit.category === "-ve";

    const hasQuantity = currentEmpList.some((emp) => {
      const eId = String(emp.id);
      const q = currentQtyMap[eId]?.[String(crit.id)];
      return q !== undefined && q !== "" && !isNaN(Number(q));
    });

    const nextScores = { ...currentScoresMap };
    const nextRanks = { ...currentRankMap };
    const cId = String(crit.id);

    if (hasQuantity) {
      const listWithQty = currentEmpList.map((emp) => {
        const eId = String(emp.id);
        const qVal = currentQtyMap[eId]?.[cId];
        const parsedQty = qVal !== undefined && qVal !== "" && !isNaN(Number(qVal)) ? Number(qVal) : null;
        return { eId, qty: parsedQty };
      });

      listWithQty.sort((a, b) => {
        if (a.qty === null && b.qty === null) return 0;
        if (a.qty === null) return 1;
        if (b.qty === null) return -1;
        return isLowerBetter ? a.qty - b.qty : b.qty - a.qty;
      });

      currentEmpList.forEach((emp) => {
        const eId = String(emp.id);
        if (!nextScores[eId]) nextScores[eId] = {};
        if (!nextRanks[eId]) nextRanks[eId] = {};

        const item = listWithQty.find((x) => x.eId === eId);
        if (item && item.qty !== null) {
          const idx = listWithQty.findIndex((x) => x.eId === eId);
          let rankIndex = idx;
          for (let j = 0; j < idx; j++) {
            if (listWithQty[j]?.qty === item.qty) {
              rankIndex = j;
              break;
            }
          }
          const calculatedRank = rankIndex + 1;
          const rawScore = maxScore - (rankIndex * interval);
          const calcScore = Math.max(0, Math.min(maxScore, Math.round(rawScore * 100) / 100));

          nextRanks[eId][cId] = calculatedRank;
          nextScores[eId][cId] = calcScore;
        }
      });
    } else {
      currentEmpList.forEach((emp) => {
        const eId = String(emp.id);
        const manualRank = currentRankMap[eId]?.[cId];
        if (manualRank !== undefined && manualRank !== "" && !isNaN(Number(manualRank))) {
          const r = Number(manualRank);
          if (r > 0) {
            const rawScore = maxScore - ((r - 1) * interval);
            const calcScore = Math.max(0, Math.min(maxScore, Math.round(rawScore * 100) / 100));
            if (!nextScores[eId]) nextScores[eId] = {};
            nextScores[eId][cId] = calcScore;
          }
        }
      });
    }

    return { updatedScores: nextScores, updatedRanks: nextRanks };
  };

  const handleQuantityChange = (empId: string, crit: Criterion, valStr: string) => {
    const val: number | "" = valStr === "" ? "" : Number(valStr);
    const cId = String(crit.id);
    const nextQtyMap = {
      ...rawQuantityMap,
      [empId]: {
        ...(rawQuantityMap[empId] || {}),
        [cId]: val
      }
    };
    setRawQuantityMap(nextQtyMap);

    const eligibleEmps = employees.filter((e) => selectedEmpIds.includes(e.id));
    const { updatedScores, updatedRanks } = computeHybridScoresForCriteria(
      crit,
      eligibleEmps,
      nextQtyMap,
      calculatedRankMap,
      scoreMatrix
    );
    setScoreMatrix(updatedScores);
    setCalculatedRankMap(updatedRanks);
  };

  const handleRankChange = (empId: string, crit: Criterion, rankStr: string) => {
    const rVal: number | "" = rankStr === "" ? "" : Number(rankStr);
    const cId = String(crit.id);
    const nextRankMap = {
      ...calculatedRankMap,
      [empId]: {
        ...(calculatedRankMap[empId] || {}),
        [cId]: rVal
      }
    };
    setCalculatedRankMap(nextRankMap);

    if (rVal !== "") {
      const eligibleEmps = employees.filter((e) => selectedEmpIds.includes(e.id));
      const N = eligibleEmps.length;
      const interval = N > 1 ? Number(crit.maxScore) / (N - 1) : 0;
      const rawScore = Number(crit.maxScore) - ((Number(rVal) - 1) * interval);
      const calcScore = Math.max(0, Math.min(Number(crit.maxScore), Math.round(rawScore * 100) / 100));

      setScoreMatrix((prev) => ({
        ...prev,
        [empId]: {
          ...(prev[empId] || {}),
          [cId]: calcScore
        }
      }));
    }
  };

  const handleScoreChange = (empId: string, critId: string, valStr: string) => {
    const val: number | "" = valStr === "" ? "" : Number(valStr);
    setScoreMatrix((prev) => ({
      ...prev,
      [empId]: {
        ...(prev[empId] || {}),
        [critId]: val
      }
    }));
  };

  // Auto-calculate stats for a criterion
  const handleAutoCalculateCriterion = async (criterion: Criterion) => {
    const cName = criterion.name.toLowerCase();
    const cid = String(criterion.id);
    setAutoCalculating((prev) => ({ ...prev, [cid]: true }));

    const eligibleEmps = employees.filter((e) => selectedEmpIds.includes(e.id));
    const maxScore = Number(criterion.maxScore) || 10;
    const isLowerBetter = criterion.category === "-ve";

    try {
      if (cName.includes("vote")) {
        const res = await api.get<any>(`/eom/vote-stats?month_year=${monthYearStr}&maxScore=${maxScore}`);
        const voteCounts = res.employeeVoteCounts || {};
        const ranks = res.employeeRanks || {};
        const scores = res.employeeScores || {};

        const nextScores = { ...scoreMatrix };
        const nextRanks = { ...calculatedRankMap };
        const nextQty = { ...rawQuantityMap };

        eligibleEmps.forEach((emp) => {
          const eId = emp.id;
          const eName = emp.name.toLowerCase();
          if (!nextScores[eId]) nextScores[eId] = {};
          if (!nextRanks[eId]) nextRanks[eId] = {};
          if (!nextQty[eId]) nextQty[eId] = {};

          const v = voteCounts[eId] ?? voteCounts[eName] ?? 0;
          const r = ranks[eId] ?? ranks[eName] ?? eligibleEmps.length;
          const s = scores[eId] ?? scores[eName] ?? 0;

          nextQty[eId][cid] = v;
          nextRanks[eId][cid] = r;
          nextScores[eId][cid] = s;
        });

        setRawQuantityMap(nextQty);
        setCalculatedRankMap(nextRanks);
        setScoreMatrix(nextScores);
        toast.success(`Vote scores auto-calculated from STV Election (${res.totalBallots || 0} ballots)!`);

      } else if (cName.includes("discipline")) {
        const res = await api.get<any>(`/eom/discipline-stats?month_year=${monthYearStr}&maxScore=${maxScore}`);
        const penalties = res.employeePenaltyAmounts || res.employeeStats || {};

        const listWithPenalty = eligibleEmps.map((emp) => {
          const eId = emp.id;
          const eName = emp.name.toLowerCase();
          const p = Number(penalties[eId] ?? penalties[eName] ?? 0);
          return { eId, penalty: p };
        });

        listWithPenalty.sort((a, b) => (isLowerBetter ? a.penalty - b.penalty : b.penalty - a.penalty));

        const N = eligibleEmps.length;
        const interval = N > 1 ? maxScore / (N - 1) : 0;
        const nextScores = { ...scoreMatrix };
        const nextRanks = { ...calculatedRankMap };
        const nextQty = { ...rawQuantityMap };

        eligibleEmps.forEach((emp) => {
          const eId = emp.id;
          if (!nextScores[eId]) nextScores[eId] = {};
          if (!nextRanks[eId]) nextRanks[eId] = {};
          if (!nextQty[eId]) nextQty[eId] = {};

          const idx = listWithPenalty.findIndex((x) => x.eId === eId);
          const item = idx !== -1 ? listWithPenalty[idx] : null;
          if (item) {
            let rankIndex = idx;
            for (let j = 0; j < idx; j++) {
              if (listWithPenalty[j]?.penalty === item.penalty) {
                rankIndex = j;
                break;
              }
            }
            const calculatedRank = rankIndex + 1;
            const rawScore = maxScore - (rankIndex * interval);
            const calcScore = Math.max(0, Math.min(maxScore, Math.round(rawScore * 100) / 100));

            nextScores[eId][cid] = calcScore;
            nextRanks[eId][cid] = calculatedRank;
            nextQty[eId][cid] = item.penalty;
          }
        });

        setRawQuantityMap(nextQty);
        setCalculatedRankMap(nextRanks);
        setScoreMatrix(nextScores);
        toast.success(`Discipline scores auto-calculated (${criterion.category || "-ve"} Equal Interval formula)!`);

      } else if (cName.includes("attendance")) {
        const res = await api.get<any>(`/eom/attendance-stats?month_year=${monthYearStr}&maxScore=${maxScore}`);
        const attStats = res.employeeStats || {};

        const listWithDays = eligibleEmps.map((emp) => {
          const eId = emp.id;
          const eName = emp.name.toLowerCase();
          const p = Number(attStats[eId] ?? attStats[eName] ?? 0);
          return { eId, days: p };
        });

        listWithDays.sort((a, b) => (isLowerBetter ? a.days - b.days : b.days - a.days));

        const N = eligibleEmps.length;
        const interval = N > 1 ? maxScore / (N - 1) : 0;
        const nextScores = { ...scoreMatrix };
        const nextRanks = { ...calculatedRankMap };
        const nextQty = { ...rawQuantityMap };

        eligibleEmps.forEach((emp) => {
          const eId = emp.id;
          if (!nextScores[eId]) nextScores[eId] = {};
          if (!nextRanks[eId]) nextRanks[eId] = {};
          if (!nextQty[eId]) nextQty[eId] = {};

          const idx = listWithDays.findIndex((x) => x.eId === eId);
          const item = idx !== -1 ? listWithDays[idx] : null;
          if (item) {
            let rankIndex = idx;
            for (let j = 0; j < idx; j++) {
              if (listWithDays[j]?.days === item.days) {
                rankIndex = j;
                break;
              }
            }
            const calculatedRank = rankIndex + 1;
            const rawScore = maxScore - (rankIndex * interval);
            const calcScore = Math.max(0, Math.min(maxScore, Math.round(rawScore * 100) / 100));

            nextScores[eId][cid] = calcScore;
            nextRanks[eId][cid] = calculatedRank;
            nextQty[eId][cid] = item.days;
          }
        });

        setRawQuantityMap(nextQty);
        setCalculatedRankMap(nextRanks);
        setScoreMatrix(nextScores);
        toast.success(`Attendance scores auto-calculated!`);

      } else if (cName.includes("completion") || cName.includes("work completion")) {
        const res = await api.get<any>(`/eom/work-completion-stats?month_year=${monthYearStr}&maxScore=${maxScore}`);
        const statsMap = res.employeeStats || {};

        const listWithFactor = eligibleEmps.map((emp) => {
          const eId = emp.id;
          const eName = emp.name.toLowerCase();
          const obj = statsMap[eId] || statsMap[eName] || {};
          const factor = Number(obj.factor) || (Number(obj.daysVerified || 0) * Number(obj.avgRating || 0));
          return { eId, factor };
        });

        listWithFactor.sort((a, b) => (isLowerBetter ? a.factor - b.factor : b.factor - a.factor));

        const N = eligibleEmps.length;
        const interval = N > 1 ? maxScore / (N - 1) : 0;
        const nextScores = { ...scoreMatrix };
        const nextRanks = { ...calculatedRankMap };
        const nextQty = { ...rawQuantityMap };

        eligibleEmps.forEach((emp) => {
          const eId = emp.id;
          if (!nextScores[eId]) nextScores[eId] = {};
          if (!nextRanks[eId]) nextRanks[eId] = {};
          if (!nextQty[eId]) nextQty[eId] = {};

          const idx = listWithFactor.findIndex((x) => x.eId === eId);
          const item = idx !== -1 ? listWithFactor[idx] : null;
          if (item) {
            let rankIndex = idx;
            for (let j = 0; j < idx; j++) {
              if (listWithFactor[j]?.factor === item.factor) {
                rankIndex = j;
                break;
              }
            }
            const calculatedRank = rankIndex + 1;
            const rawScore = maxScore - (rankIndex * interval);
            const calcScore = Math.max(0, Math.min(maxScore, Math.round(rawScore * 100) / 100));

            nextScores[eId][cid] = calcScore;
            nextRanks[eId][cid] = calculatedRank;
            nextQty[eId][cid] = item.factor;
          }
        });

        setRawQuantityMap(nextQty);
        setCalculatedRankMap(nextRanks);
        setScoreMatrix(nextScores);
        toast.success(`Work Completion scores auto-calculated from Daily Reports!`);

      } else if (cName.includes("dedication") || cName.includes("work dedication")) {
        const res = await api.get<any>(`/eom/work-dedication-stats?month_year=${monthYearStr}&maxScore=${maxScore}`);
        const hoursMap = res.employeeHours || {};

        const listWithHours = eligibleEmps.map((emp) => {
          const eId = emp.id;
          const eName = emp.name.toLowerCase();
          const h = Number(hoursMap[eId] ?? hoursMap[eName] ?? 0);
          return { eId, hours: h };
        });

        listWithHours.sort((a, b) => (isLowerBetter ? a.hours - b.hours : b.hours - a.hours));

        const N = eligibleEmps.length;
        const interval = N > 1 ? maxScore / (N - 1) : 0;
        const nextScores = { ...scoreMatrix };
        const nextRanks = { ...calculatedRankMap };
        const nextQty = { ...rawQuantityMap };

        eligibleEmps.forEach((emp) => {
          const eId = emp.id;
          if (!nextScores[eId]) nextScores[eId] = {};
          if (!nextRanks[eId]) nextRanks[eId] = {};
          if (!nextQty[eId]) nextQty[eId] = {};

          const idx = listWithHours.findIndex((x) => x.eId === eId);
          const item = idx !== -1 ? listWithHours[idx] : null;
          if (item) {
            let rankIndex = idx;
            for (let j = 0; j < idx; j++) {
              if (listWithHours[j]?.hours === item.hours) {
                rankIndex = j;
                break;
              }
            }
            const calculatedRank = rankIndex + 1;
            const rawScore = maxScore - (rankIndex * interval);
            const calcScore = Math.max(0, Math.min(maxScore, Math.round(rawScore * 100) / 100));

            nextScores[eId][cid] = calcScore;
            nextRanks[eId][cid] = calculatedRank;
            nextQty[eId][cid] = item.hours;
          }
        });

        setRawQuantityMap(nextQty);
        setCalculatedRankMap(nextRanks);
        setScoreMatrix(nextScores);
        toast.success(`Work Dedication scores auto-calculated!`);

      } else {
        toast.info(`Manual evaluation required for "${criterion.name}".`);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || `Failed to auto-calculate ${criterion.name}`);
    } finally {
      setAutoCalculating((prev) => ({ ...prev, [cid]: false }));
    }
  };

  // Confirm Delete Custom Parameter
  const confirmDeleteParam = () => {
    if (paramToDelete !== null) {
      setCriteria(criteria.filter((_, i) => i !== paramToDelete.index));
      toast.success(`Removed parameter "${paramToDelete.name}". Click "Save Month Criteria" to save.`);
      setDeleteParamModalOpen(false);
      setParamToDelete(null);
    }
  };

  // Save All Scores Matrix
  const handleSaveAllScores = async () => {
    setSavingScores(true);
    try {
      const scoresPayload: any[] = [];
      Object.entries(scoreMatrix).forEach(([empId, critScores]) => {
        Object.entries(critScores).forEach(([cId, scoreVal]) => {
          if (scoreVal !== "" && scoreVal !== undefined && scoreVal !== null) {
            const rawQty = rawQuantityMap[empId]?.[cId];
            const calcRank = calculatedRankMap[empId]?.[cId];

            scoresPayload.push({
              employeeId: empId,
              criteriaId: cId,
              score: Number(scoreVal),
              rawQuantity: rawQty !== undefined && rawQty !== "" ? Number(rawQty) : null,
              calculatedRank: calcRank !== undefined && calcRank !== "" ? Number(calcRank) : null
            });
          }
        });
      });

      await api.post(`/eom/save-all-matrix`, {
        month_year: monthYearStr,
        scores: scoresPayload
      });

      toast.success("All EOM scores successfully saved and recalculating leaderboard!");
      setScoreEntryModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to save scores");
    } finally {
      setSavingScores(false);
    }
  };

  // Criteria Reordering Handlers (Month-Wise)
  const moveCriterion = (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= criteria.length) return;

    const updated = [...criteria];
    const removed = updated.splice(index, 1);
    const moved = removed[0];
    if (!moved) return;
    updated.splice(targetIdx, 0, moved);

    const reindexed = updated.map((item, i) => ({
      ...item,
      order: i + 1
    }));
    setCriteria(reindexed);
    toast.success(`Moved "${moved.name}". Click "Save Criteria" to persist for ${selectedMonth} ${selectedYear}!`);
  };

  const handleAddCriterion = () => {
    const newCrit: Criterion = {
      name: `Custom Metric ${criteria.length + 1}`,
      maxScore: 10,
      isFixed: false,
      order: criteria.length + 1,
      category: "+ve",
      entryType: "direct",
      assignedPersonIds: []
    };
    setCriteria([...criteria, newCrit]);
    toast.info("Added new parameter! Adjust score and click 'Save Criteria'.");
  };

  // Save Month Criteria (Strictly Month-Wise)
  const handleSaveCriteria = async () => {
    try {
      await api.post(`/eom/criteria`, {
        month_year: monthYearStr,
        criteria
      });
      toast.success(`Criteria configuration saved for ${selectedMonth} ${selectedYear}!`);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to save criteria");
    }
  };

  // Clone from Previous Month
  const handleClonePreviousMonth = async () => {
    const prevDate = new Date(Number(selectedYear), MONTHS.indexOf(selectedMonth) - 1, 1);
    const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
    try {
      await api.post(`/eom/clone-criteria`, {
        from_month_year: prevMonthStr,
        to_month_year: monthYearStr
      });
      toast.success(`Cloned criteria from ${prevMonthStr} into ${monthYearStr}!`);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to clone criteria");
    }
  };

  // Save Selected Employees for Month
  const handleSaveParticipants = async () => {
    setSavingParticipants(true);
    try {
      await api.post(`/eom/month-config`, {
        month_year: monthYearStr,
        selectedEmployeeIds: selectedEmpIds
      });
      toast.success("Participating employees saved!");
      setParticipantModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update participants");
    } finally {
      setSavingParticipants(false);
    }
  };

  // Save Reveal Schedule
  const handleSaveReveal = async () => {
    if (!revealDateTime) {
      toast.error("Please pick a reveal date & time");
      return;
    }
    setSavingReveal(true);
    try {
      await api.post(`/eom/reveal-schedule`, {
        month_year: monthYearStr,
        revealDateTime
      });
      toast.success("Auditorium Reveal schedule saved!");
      setRevealModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to save reveal schedule");
    } finally {
      setSavingReveal(false);
    }
  };

  // Master Template
  const handleOpenMasterModal = async () => {
    try {
      const res = await api.get<Criterion[]>(`/eom/master-criteria`);
      setMasterCriteria(Array.isArray(res) ? res : []);
      setMasterModalOpen(true);
    } catch (err) {
      toast.error("Failed to load master criteria");
    }
  };

  const handleSaveMasterCriteria = async () => {
    setSavingMaster(true);
    try {
      await api.post(`/eom/master-criteria`, { criteria: masterCriteria });
      toast.success("Master criteria template updated!");
      setMasterModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save master template");
    } finally {
      setSavingMaster(false);
    }
  };

  // Generate countdown reveal queue for the last parameter:
  // Non-top-5 candidates first (bottom up), followed by Rank 5, Rank 4, Rank 3
  // Top 2 contenders are saved for the dramatic Top 2 showdown!
  const generateRevealQueue = (candList: LeaderboardEntry[]): LeaderboardEntry[] => {
    if (!candList || candList.length === 0) return [];
    const sorted = [...candList].sort((a, b) => b.totalScore - a.totalScore);
    if (sorted.length <= 2) {
      return [];
    }
    if (sorted.length <= 5) {
      return sorted.slice(2).reverse();
    }
    const lowerCandidates = [...sorted.slice(5)].reverse();
    const top3to5Countdown: LeaderboardEntry[] = [];
    if (sorted[4]) top3to5Countdown.push(sorted[4]);
    if (sorted[3]) top3to5Countdown.push(sorted[3]);
    if (sorted[2]) top3to5Countdown.push(sorted[2]);
    return [...lowerCandidates, ...top3to5Countdown];
  };

  // Compute auditorium standings with stage-by-stage and last-column candidate-by-candidate reveal
  const computeAuditoriumList = (
    stage: number = ceremonyStage,
    revealedIds: Set<string> = finaleRevealedIds,
    winnerDeclared: boolean = isWinnerAnnounced
  ) => {
    const lastCritIdx = criteria.length - 1;
    const isAtLastColumn = stage === criteria.length;

    const list = leaderboard.map((cand) => {
      let cumulative = 0;
      const colScores: Record<string, number | string> = {};

      criteria.forEach((crit, idx) => {
        const cId = String(crit.id || "");
        const rawScore = Number(cand.criteriaScores?.[cId] ?? 0);

        if (idx < lastCritIdx) {
          // Earlier parameters (1 to criteria.length - 1)
          if (idx < stage) {
            colScores[cId] = rawScore;
            cumulative += rawScore;
          } else {
            colScores[cId] = "—";
          }
        } else {
          // THE FINAL PARAMETER (last column)
          if (!isAtLastColumn) {
            colScores[cId] = "—";
          } else {
            const isRevealedInLastCol = revealedIds.has(cand.employeeId) || winnerDeclared;
            if (isRevealedInLastCol) {
              colScores[cId] = rawScore;
              cumulative += rawScore;
            } else {
              colScores[cId] = "???";
            }
          }
        }
      });

      const isFinaleRevealed = revealedIds.has(cand.employeeId) || winnerDeclared;

      return {
        ...cand,
        cumulative: Number(cumulative.toFixed(2)),
        colScores,
        isFinaleRevealed
      };
    });

    if (winnerDeclared) {
      list.sort((a, b) => b.totalScore - a.totalScore);
    } else {
      list.sort((a, b) => {
        if (b.cumulative !== a.cumulative) {
          return b.cumulative - a.cumulative;
        }
        return a.name.localeCompare(b.name);
      });
    }

    list.forEach((item, idx) => {
      item.rank = idx + 1;
    });

    return list;
  };

  const getAuditoriumList = () => computeAuditoriumList();

  // Auditorium Ceremony Launcher
  const handleLaunchAuditoriumCeremony = () => {
    if (leaderboard.length === 0) {
      toast.error("No leaderboard data to reveal! Enter scores and recalculate first.");
      return;
    }
    const queue = generateRevealQueue(leaderboard);
    setFinaleRevealQueue(queue);
    setFinaleRevealedIds(new Set());
    setIsTop2Showdown(false);
    setIsWinnerAnnounced(false);
    setTeasingEmpId(null);
    setRankShiftHighlights({});
    setCeremonyStage(1); // Start at Stage 1 (reveals Column 1)
    setIsAutoPlayingStory(false);
    setCeremonyOpen(true);
    triggerConfetti(false);

    try {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().then(() => setCeremonyFullscreen(true)).catch(() => {});
      }
    } catch (_) {}
  };

  // Advance ceremony step (Spacebar or Next button)
  const handleCeremonyNext = () => {
    if (criteria.length === 0 || leaderboard.length === 0) return;
    if (isWinnerAnnounced) {
      triggerGrandFinaleConfetti10s();
      return;
    }

    // Phase 1: Advancing regular columns (1 to criteria.length - 1)
    if (ceremonyStage < criteria.length) {
      const currentList = computeAuditoriumList();
      const oldRanksMap: Record<string, number> = {};
      currentList.forEach((item) => {
        oldRanksMap[item.employeeId] = item.rank;
      });

      const nextStage = ceremonyStage + 1;
      setCeremonyStage(nextStage);
      triggerConfetti(false);

      if (nextStage === criteria.length) {
        // Just entered the final column!
        const queue = generateRevealQueue(leaderboard);
        setFinaleRevealQueue(queue);
        setFinaleRevealedIds(new Set());
        if (queue.length === 0) {
          setIsTop2Showdown(true);
        } else {
          setIsTop2Showdown(false);
        }
        setRankShiftHighlights({});
        toast.info(`Final Parameter: "${criteria[criteria.length - 1]?.name}"! Press NEXT or SPACE to reveal contenders one by one!`);
        return;
      }

      // Rank movement calculation for intermediate columns
      setTimeout(() => {
        const nextList = computeAuditoriumList(nextStage, new Set(), false);
        const shifts: Record<string, { diff: number; from: number; to: number; direction: "up" | "down" }> = {};
        nextList.forEach((cand) => {
          const oldR = oldRanksMap[cand.employeeId];
          if (oldR !== undefined && oldR !== cand.rank) {
            const diff = oldR - cand.rank;
            shifts[cand.employeeId] = {
              diff: Math.abs(diff),
              from: oldR,
              to: cand.rank,
              direction: diff > 0 ? "up" : "down"
            };
          }
        });
        setRankShiftHighlights(shifts);
        if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = setTimeout(() => {
          setRankShiftHighlights({});
        }, 4000);
      }, 50);

    } else {
      // Phase 2: In Last Column - Reveal Contender by Contender!
      const sorted = [...leaderboard].sort((a, b) => b.totalScore - a.totalScore);
      const queue = finaleRevealQueue.length > 0 ? finaleRevealQueue : generateRevealQueue(leaderboard);
      const revealedCount = finaleRevealedIds.size;

      if (revealedCount < queue.length) {
        const targetCand = queue[revealedCount];
        if (targetCand) {
          const currentList = computeAuditoriumList();
          const oldRank = currentList.find((x) => x.employeeId === targetCand.employeeId)?.rank || sorted.length;

          const nextRevealed = new Set(finaleRevealedIds);
          nextRevealed.add(targetCand.employeeId);
          setFinaleRevealedIds(nextRevealed);
          setTeasingEmpId(targetCand.employeeId);
          triggerConfetti(false);

          if (nextRevealed.size === queue.length) {
            setIsTop2Showdown(true);
          }

          setTimeout(() => {
            const nextList = computeAuditoriumList(ceremonyStage, nextRevealed, false);
            const newRank = nextList.find((x) => x.employeeId === targetCand.employeeId)?.rank || oldRank;
            const diff = oldRank - newRank;

            setRankShiftHighlights({
              [targetCand.employeeId]: {
                diff: Math.abs(diff),
                from: oldRank,
                to: newRank,
                direction: diff >= 0 ? "up" : "down"
              }
            });
          }, 60);

          if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
          highlightTimerRef.current = setTimeout(() => {
            setRankShiftHighlights({});
            setTeasingEmpId(null);
          }, 4000);
        }
      } else if (isTop2Showdown || revealedCount >= queue.length) {
        // Grand Finale Top 2 Reveal!
        const allIds = new Set(leaderboard.map((l) => l.employeeId));
        setFinaleRevealedIds(allIds);
        setIsTop2Showdown(false);
        setIsWinnerAnnounced(true);
        triggerGrandFinaleConfetti10s();
      }
    }
  };

  const handleCeremonyPrev = () => {
    if (isWinnerAnnounced) {
      setIsWinnerAnnounced(false);
      setIsTop2Showdown(true);
      return;
    }
    if (ceremonyStage === criteria.length && finaleRevealedIds.size > 0) {
      const queue = finaleRevealQueue.length > 0 ? finaleRevealQueue : generateRevealQueue(leaderboard);
      const nextSet = new Set(finaleRevealedIds);
      const lastRevealed = queue[finaleRevealedIds.size - 1];
      if (lastRevealed) {
        nextSet.delete(lastRevealed.employeeId);
      }
      setFinaleRevealedIds(nextSet);
      setIsTop2Showdown(false);
      setRankShiftHighlights({});
      return;
    }
    if (ceremonyStage > 1) {
      setCeremonyStage((prev) => prev - 1);
      setFinaleRevealedIds(new Set());
      setIsTop2Showdown(false);
      setRankShiftHighlights({});
    }
  };

  // Keyboard navigation: SPACE to advance, ESC to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!ceremonyOpen) return;
      if (e.key === "Escape") {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
        setCeremonyOpen(false);
        setIsAutoPlayingStory(false);
      } else if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        handleCeremonyNext();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [ceremonyOpen, ceremonyStage, finaleRevealedIds, isTop2Showdown, criteria, leaderboard, isWinnerAnnounced, finaleRevealQueue]);

  // Auto-play story ticker (Advances stage / reveal every 4.5 seconds)
  useEffect(() => {
    if (!isAutoPlayingStory || !ceremonyOpen || isWinnerAnnounced) {
      return;
    }
    const timer = setInterval(() => {
      handleCeremonyNext();
    }, 4500);
    return () => clearInterval(timer);
  }, [isAutoPlayingStory, ceremonyOpen, ceremonyStage, finaleRevealedIds, isTop2Showdown, criteria, leaderboard, isWinnerAnnounced, finaleRevealQueue]);

  const totalMaxScore = criteria.reduce((sum, item) => sum + (Number(item.maxScore) || 0), 0);

  // Participating Employees
  const participatingEmployees = employees.filter((emp) => selectedEmpIds.includes(emp.id));

  // Current Criterion in Stepper
  const currentCriterion = criteria[currentStepIndex];

  // In Stepper mode, sort employees descending by their score in the current parameter (highest score at top)
  const currentCritId = currentCriterion ? String(currentCriterion.id) : "";
  const sortedParticipatingForStep = [...participatingEmployees].sort((a, b) => {
    const scA = Number(scoreMatrix[a.id]?.[currentCritId] ?? -1);
    const scB = Number(scoreMatrix[b.id]?.[currentCritId] ?? -1);
    if (scB !== scA) return scB - scA;
    return a.name.localeCompare(b.name);
  });

  // Filtered participants for selection modal
  const filteredParticipants = employees.filter((emp) => {
    if (!empSearch.trim()) return true;
    const q = empSearch.toLowerCase();
    return emp.name.toLowerCase().includes(q) || emp.department.toLowerCase().includes(q);
  });

  const top3 = leaderboard.slice(0, 3);

  return (
    <div className="w-full min-w-0 space-y-4 sm:space-y-6 animate-in fade-in duration-500">
      {/* Top Header Bar */}
      <div className="flex flex-col 2xl:flex-row 2xl:items-center justify-between gap-3 sm:gap-4 bg-card p-4 sm:p-6 rounded-3xl shadow-xs border border-border/60">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-3 bg-amber-500/10 text-amber-500 rounded-2xl border border-amber-500/20 shadow-xs shrink-0">
            <Trophy className="w-7 h-7" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg sm:text-2xl font-black text-foreground">
                Employee of the Month (EOM)
              </h1>
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 font-bold px-2 py-0.5 text-xs">
                {selectedMonth} {selectedYear}
              </Badge>
            </div>
            <p className="text-xs font-medium text-muted-foreground mt-0.5">
              Step-by-step scoring submissions, month-wise parameters reordering, auto-sync STV voting, and live auditorium ceremony.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          {isAdmin && (
            <>
              <button
                onClick={() => setParticipantModalOpen(true)}
                className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-bold rounded-xl transition-all border border-amber-500/20 shadow-xs cursor-pointer"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Employees ({selectedEmpIds.length})</span>
              </button>

              <button
                onClick={() => setHistoryModalOpen(true)}
                className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-muted hover:bg-muted/80 text-foreground text-xs font-bold rounded-xl transition-all border border-border shadow-xs cursor-pointer"
              >
                <History className="w-3.5 h-3.5" />
                <span>History</span>
              </button>

              <button
                onClick={handleOpenMasterModal}
                className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 px-3.5 py-2 bg-muted hover:bg-muted/80 text-foreground text-xs font-bold rounded-xl transition-all border border-border shadow-xs cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Master Template</span>
              </button>
            </>
          )}

          {/* Month / Year Pickers */}
          <div className="col-span-2 sm:col-span-1 grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-1.5">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-full sm:w-[125px] rounded-xl font-bold text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-full sm:w-[95px] rounded-xl font-bold text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isAdmin && (
            <>
              <button
                onClick={handleOpenScoreEntry}
                className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl hover:bg-primary/90 transition-all shadow-xs cursor-pointer"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Score Entry (Stepper)</span>
              </button>

              <div className="col-span-2 flex items-stretch gap-2 sm:contents">
              <button
                onClick={handleLaunchAuditoriumCeremony}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 text-xs font-black rounded-xl hover:shadow-md transition-all uppercase tracking-wide cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-slate-950" />
                <span>Auditorium Reveal</span>
              </button>

              <button
                onClick={() => setRevealModalOpen(true)}
                title="Schedule Reveal Date & Time"
                className="p-2 text-muted-foreground hover:bg-muted rounded-xl transition-colors border border-border cursor-pointer"
              >
                <Calendar className="w-4 h-4" />
              </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Tabs: Criteria Setup first, Leaderboard second */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
        <TabsList className="bg-muted/60 p-1 rounded-xl h-auto w-full sm:w-auto flex flex-wrap justify-start">
          <TabsTrigger value="criteria" className="text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer">
            <Settings className="w-3.5 h-3.5" />
            <span>Criteria Setup ({criteria.length} • {totalMaxScore} Pts)</span>
          </TabsTrigger>
          <TabsTrigger value="leaderboard" className="text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer">
            <Trophy className="w-3.5 h-3.5" />
            <span>Leaderboard & Podium ({leaderboard.length})</span>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: LEADERBOARD & PODIUM */}
        <TabsContent value="leaderboard" className="space-y-6 pt-2">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-card rounded-3xl p-6 border border-border/60 animate-pulse space-y-3">
                  <div className="h-12 bg-muted rounded-full w-12 mx-auto" />
                  <div className="h-4 bg-muted rounded w-1/2 mx-auto" />
                  <div className="h-6 bg-muted rounded w-1/3 mx-auto" />
                </div>
              ))}
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="bg-card rounded-3xl p-12 text-center border border-border/60 shadow-xs">
              <Trophy className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <h3 className="text-lg font-black text-foreground mb-1">
                No Leaderboard Data for {selectedMonth} {selectedYear}
              </h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto mb-5">
                Click on "Score Entry" above to auto-calculate scores from Vote, Attendance, and Discipline, or submit scores for the parameters.
              </p>
              {isAdmin && (
                <button
                  onClick={handleOpenScoreEntry}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl text-xs shadow-xs hover:bg-primary/90 transition-all cursor-pointer"
                >
                  <Edit className="w-4 h-4" />
                  <span>Open Score Entry Stepper</span>
                </button>
              )}
            </div>
          ) : (
            <>
              {/* TOP 3 PODIUM */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 pt-4">
                {top3.map((entry, index) => {
                  const is1st = index === 0;
                  const is2nd = index === 1;
                  const is3rd = index === 2;

                  return (
                    <div
                      key={entry.employeeId}
                      className={cn(
                        "rounded-3xl p-6 border transition-all duration-300 relative overflow-hidden flex flex-col items-center text-center",
                        is1st
                          ? "bg-gradient-to-b from-amber-500/15 via-card to-card border-amber-500/40 shadow-lg shadow-amber-500/10 md:-translate-y-2 order-1 md:order-2"
                          : is2nd
                            ? "bg-card border-border/80 shadow-xs order-2 md:order-1"
                            : "bg-card border-border/80 shadow-xs order-3"
                      )}
                    >
                      <div className="absolute top-4 left-4">
                        <span
                          className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shadow-xs",
                            is1st
                              ? "bg-amber-400 text-amber-950 ring-4 ring-amber-400/30"
                              : is2nd
                                ? "bg-slate-300 text-slate-800 ring-2 ring-slate-300/40"
                                : "bg-amber-700 text-amber-100 ring-2 ring-amber-700/40"
                          )}
                        >
                          #{entry.rank}
                        </span>
                      </div>

                      {is1st && (
                        <div className="absolute top-3 right-3 text-amber-500 animate-bounce">
                          <Crown className="w-6 h-6 fill-amber-400" />
                        </div>
                      )}

                      <div className="relative mt-2 mb-3">
                        <img
                          src={entry.avatar}
                          alt={entry.name}
                          className={cn(
                            "w-20 h-20 rounded-full object-cover border-4",
                            is1st ? "border-amber-400 shadow-md shadow-amber-400/20" : "border-border"
                          )}
                        />
                      </div>

                      <h3 className="text-base font-black text-foreground mb-0.5 line-clamp-1">
                        {entry.name}
                      </h3>
                      <p className="text-xs text-muted-foreground mb-4">
                        {entry.department} • {entry.designation}
                      </p>

                      <div className="w-full bg-muted/40 rounded-2xl p-3 border border-border/60">
                        <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
                          Total Score
                        </div>
                        <div className="text-2xl font-black text-primary">
                          {entry.totalScore}{" "}
                          <span className="text-xs text-muted-foreground font-semibold">/ {totalMaxScore} pts</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* COMPLETE LEADERBOARD TABLE */}
              <div className="bg-card rounded-3xl border border-border/60 shadow-xs overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-border/60 flex items-center justify-between">
                  <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-500" />
                    <span>Complete Monthly Standings</span>
                  </h3>
                  <Badge variant="outline" className="text-xs font-bold">
                    {leaderboard.length} Ranked Participants
                  </Badge>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-muted/40 text-muted-foreground font-bold uppercase tracking-wider text-[11px] border-b border-border/60">
                      <tr>
                        <th className="p-3 w-12 text-center">Rank</th>
                        <th className="p-3">Employee</th>
                        {criteria.map((c) => (
                          <th key={c.id} className="p-3 text-center">
                            {c.name}
                          </th>
                        ))}
                        <th className="p-3 text-right">Total Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 font-medium text-foreground">
                      {leaderboard.map((row) => (
                        <tr key={row.employeeId} className="hover:bg-muted/30 transition-colors">
                          <td className="p-3 text-center font-bold">
                            <span
                              className={cn(
                                "w-6 h-6 rounded-full inline-flex items-center justify-center text-xs",
                                row.rank === 1
                                  ? "bg-amber-400 text-amber-950 font-black"
                                  : row.rank === 2
                                    ? "bg-slate-300 text-slate-800 font-bold"
                                    : row.rank === 3
                                      ? "bg-amber-700 text-amber-100 font-bold"
                                      : "text-muted-foreground font-mono"
                              )}
                            >
                              {row.rank}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2.5">
                              <img src={row.avatar} alt={row.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                              <div>
                                <div className="font-bold text-foreground text-xs sm:text-sm">{row.name}</div>
                                <div className="text-[10px] text-muted-foreground">{row.department} • {row.designation}</div>
                              </div>
                            </div>
                          </td>
                          {criteria.map((c) => {
                            const sc = row.criteriaScores[String(c.id)] ?? "-";
                            return (
                              <td key={c.id} className="p-3 text-center font-semibold text-foreground">
                                {sc}
                              </td>
                            );
                          })}
                          <td className="p-3 text-right font-black text-primary text-sm">
                            {row.totalScore}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </TabsContent>

        {/* TAB 2: CRITERIA SETUP (MONTH-WISE WITH REORDERING UP/DOWN & DRAG-DROP) */}
        <TabsContent value="criteria" className="space-y-4 pt-2">
          <div className="bg-card border border-border/60 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Evaluation Parameters for {selectedMonth} {selectedYear}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Reorder parameters using <span className="font-bold text-primary">↑ Up / ↓ Down</span> or Drag & Drop. Sum of max scores: <span className="font-bold text-primary">{totalMaxScore} / 100 points</span>.
                </p>
              </div>

              {isAdmin && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={handleAddCriterion}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 rounded-xl border border-amber-500/20 transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Parameter</span>
                  </button>

                  <button
                    onClick={handleClonePreviousMonth}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-muted hover:bg-muted/80 rounded-xl border border-border transition-all cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Clone Previous Month</span>
                  </button>

                  <button
                    onClick={handleSaveCriteria}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-xs cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Month Criteria</span>
                  </button>
                </div>
              )}
            </div>

            {/* Criteria List with Reorder buttons */}
            <div className="space-y-2.5">
              {criteria.map((c, idx) => (
                <div
                  key={idx}
                  draggable={isAdmin}
                  onDragStart={(e) => {
                    setDraggedIndex(idx);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggedIndex === null || draggedIndex === idx) return;
                    const updated = [...criteria];
                    const removed = updated.splice(draggedIndex, 1);
                    const moved = removed[0];
                    if (!moved) return;
                    updated.splice(idx, 0, moved);
                    const reindexed = updated.map((item, i) => ({ ...item, order: i + 1 }));
                    setCriteria(reindexed);
                    setDraggedIndex(null);
                    toast.success("Criteria reordered! Click 'Save Month Criteria' to save changes.");
                  }}
                  className={cn(
                    "flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-muted/20 border border-border/60 rounded-2xl gap-3 transition-all",
                    draggedIndex === idx ? "opacity-40 border-dashed border-primary" : "hover:bg-muted/40"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Move Up / Down Buttons */}
                    {isAdmin && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveCriterion(idx, -1)}
                          className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg disabled:opacity-30 cursor-pointer"
                          title="Move Up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === criteria.length - 1}
                          onClick={() => moveCriterion(idx, 1)}
                          className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg disabled:opacity-30 cursor-pointer"
                          title="Move Down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>

                    <div className="min-w-0 flex-1">
                      {isAdmin ? (
                        <input
                          type="text"
                          value={c.name}
                          onChange={(e) => {
                            const next = [...criteria];
                            const it = next[idx];
                            if (it) {
                              it.name = e.target.value;
                              setCriteria(next);
                            }
                          }}
                          className="font-bold text-xs sm:text-sm text-foreground bg-transparent border-b border-border/60 focus:border-primary outline-none w-full sm:w-64"
                        />
                      ) : (
                        <div className="text-xs sm:text-sm font-bold text-foreground truncate">{c.name}</div>
                      )}
                      <div className="flex items-center gap-1.5 mt-1">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-muted/40">
                          {c.isFixed ? "Fixed Core" : "Dynamic"}
                        </Badge>
                        <button
                          type="button"
                          disabled={!isAdmin}
                          onClick={() => {
                            const next = [...criteria];
                            const it = next[idx];
                            if (it) {
                              it.category = it.category === "-ve" ? "+ve" : "-ve";
                              setCriteria(next);
                            }
                          }}
                          className={cn(
                            "text-[10px] font-bold px-1.5 py-0.5 rounded cursor-pointer transition-colors",
                            c.category === "-ve"
                              ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                              : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                          )}
                          title="Click to toggle Category"
                        >
                          {c.category === "-ve" ? "Category: -ve (Lower is better)" : "Category: +ve (Higher is better)"}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-muted-foreground">Max:</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={c.maxScore}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "" || /^\d*\.?\d*$/.test(v)) {
                            const next = [...criteria];
                            const it = next[idx];
                            if (it) {
                              it.maxScore = v === "" ? 0 : Number(v);
                              setCriteria(next);
                            }
                          }
                        }}
                        disabled={!isAdmin}
                        className="w-16 px-2 py-1 bg-background border border-border rounded-lg text-xs font-bold text-center outline-none focus:ring-1 focus:ring-primary"
                      />
                      <span className="text-xs text-muted-foreground">pts</span>
                    </div>

                    {isAdmin && !c.isFixed && (
                      <button
                        onClick={() => {
                          setParamToDelete({ index: idx, name: c.name });
                          setDeleteParamModalOpen(true);
                        }}
                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
                        title="Remove Parameter"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* =========================================================================
          SCORE ENTRY MODAL (STEPPER MODE PER PARAMETER + MATRIX TOGGLE)
         ========================================================================= */}
      <Dialog open={scoreEntryModalOpen} onOpenChange={setScoreEntryModalOpen}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto rounded-3xl p-6 sm:p-8">
          <DialogHeader>
            <div className="flex items-center justify-between gap-3">
              <DialogTitle className="text-xl font-black text-foreground flex items-center gap-2">
                <Edit className="w-5 h-5 text-primary" />
                <span>Score Entry Evaluation ({selectedMonth} {selectedYear})</span>
              </DialogTitle>
              {/* Toggle Stepper vs Matrix Mode */}
              <div className="flex items-center gap-1 bg-muted p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setScoreViewMode("stepper")}
                  className={cn(
                    "px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer",
                    scoreViewMode === "stepper"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Stepper Mode (1-by-1)
                </button>
                <button
                  type="button"
                  onClick={() => setScoreViewMode("matrix")}
                  className={cn(
                    "px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer",
                    scoreViewMode === "matrix"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Full Matrix View
                </button>
              </div>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Evaluate scores step-by-step per parameter with equal-interval rank calculations, or switch to full matrix view.
            </DialogDescription>
          </DialogHeader>

          {scoreViewMode === "stepper" ? (
            /* STEPPER VIEW: 1 PARAMETER AT A TIME */
            <div className="space-y-4">
              {currentCriterion ? (
                <>
                  {/* Current Parameter Banner with Step Indicator */}
                  <div className="bg-gradient-to-r from-amber-500/10 via-primary/5 to-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 text-amber-950 font-black flex items-center justify-center text-sm shadow-xs shrink-0">
                        {currentStepIndex + 1}/{criteria.length}
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                          Current Parameter ({currentStepIndex + 1} of {criteria.length})
                        </div>
                        <div className="text-base font-black text-foreground flex items-center gap-2 flex-wrap">
                          <span>{currentCriterion.name}</span>
                          <Badge variant="outline" className="bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold text-xs">
                            Max {currentCriterion.maxScore} pts
                          </Badge>
                          <Badge
                            variant="secondary"
                            className={cn(
                              "text-xs font-bold",
                              currentCriterion.category === "-ve"
                                ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                                : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            )}
                          >
                            Category: {currentCriterion.category || "+ve"} ({currentCriterion.category === "-ve" ? "Lower is better" : "Higher is better"})
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Step Navigation & Auto-Calculate Button directly above Prev & Next */}
                    <div className="flex flex-col sm:items-end gap-2 shrink-0">
                      {/* Only show for the 5 auto-calculable parameters: Vote, Discipline, Attendance, Work Completion, Work Dedication */}
                      {(() => {
                        const n = (currentCriterion.name || "").toLowerCase();
                        const isAuto = n.includes("vote") ||
                          n.includes("discipline") ||
                          n.includes("penalty") ||
                          n.includes("work completion") ||
                          n.includes("attendance") ||
                          (n.includes("work") && n.includes("dedication")) ||
                          n.includes("dedication");

                        if (!isAuto) return null;

                        return (
                          <button
                            type="button"
                            onClick={() => handleAutoCalculateCriterion(currentCriterion)}
                            disabled={autoCalculating[String(currentCriterion.id)]}
                            className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-amber-400 to-amber-500 text-amber-950 text-xs font-black rounded-xl hover:shadow-xs transition-all cursor-pointer disabled:opacity-50"
                          >
                            {autoCalculating[String(currentCriterion.id)] ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Sparkles className="w-3.5 h-3.5 fill-amber-950" />
                            )}
                            <span>Auto-Calculate {currentCriterion.name}</span>
                          </button>
                        );
                      })()}

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setCurrentStepIndex((prev) => Math.max(0, prev - 1))}
                          disabled={currentStepIndex === 0}
                          className="flex items-center gap-1 px-3 py-1.5 bg-card hover:bg-muted text-foreground text-xs font-bold rounded-xl border border-border transition-all disabled:opacity-40 cursor-pointer"
                        >
                          <ChevronLeft className="w-4 h-4" />
                          <span>Prev</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setCurrentStepIndex((prev) => Math.min(criteria.length - 1, prev + 1))}
                          disabled={currentStepIndex === criteria.length - 1}
                          className="flex items-center gap-1 px-3.5 py-1.5 bg-foreground text-background text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-40 cursor-pointer"
                        >
                          <span>Next</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Parameter Selection Pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {criteria.map((c, i) => (
                      <button
                        key={c.id || i}
                        type="button"
                        onClick={() => setCurrentStepIndex(i)}
                        className={cn(
                          "px-2.5 py-1 text-xs font-bold rounded-lg shrink-0 transition-all cursor-pointer",
                          currentStepIndex === i
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "bg-muted/60 text-muted-foreground hover:bg-muted"
                        )}
                      >
                        {i + 1}. {c.name}
                      </button>
                    ))}
                  </div>

                  {/* Stepper Table: Employees sorted descending by current score (highest score at top) */}
                  <div className="border border-border/60 rounded-2xl overflow-hidden max-h-[55vh] overflow-y-auto">
                    <table className="w-full text-left text-xs sm:text-sm">
                      <thead className="bg-muted/70 border-b border-border/60 sticky top-0 z-10 text-muted-foreground font-bold uppercase tracking-wider text-[11px]">
                        <tr>
                          <th className="p-3 w-12 text-center">#</th>
                          <th className="p-3 min-w-[200px]">Employee</th>
                          <th className="p-3 text-center min-w-[140px]">
                            <div>Value / Raw Count</div>
                            <span className="text-[10px] text-muted-foreground lowercase">
                              ({currentCriterion.name.toLowerCase().includes("discipline") ? "Penalties ₹" : currentCriterion.name.toLowerCase().includes("attendance") ? "Present Days" : "Raw Count / Stat"})
                            </span>
                          </th>
                          <th className="p-3 text-center min-w-[110px]">
                            <div>Rank Position</div>
                            <span className="text-[10px] text-amber-600 lowercase">(Equal Interval)</span>
                          </th>
                          <th className="p-3 text-center min-w-[130px] text-emerald-600 dark:text-emerald-400 font-black">
                            <div>Points Awarded</div>
                            <span className="text-[10px] lowercase">(Max {currentCriterion.maxScore} pts)</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40 font-medium text-foreground">
                        {sortedParticipatingForStep.map((emp, idx) => {
                          const eId = emp.id;
                          const currentVal = scoreMatrix[eId]?.[currentCritId] ?? "";
                          const currentQty = rawQuantityMap[eId]?.[currentCritId] ?? "";
                          const currentRank = calculatedRankMap[eId]?.[currentCritId] ?? "";

                          return (
                            <tr key={eId} className="hover:bg-muted/30 transition-colors">
                              <td className="p-3 text-center font-mono text-muted-foreground font-bold">
                                {idx + 1}
                              </td>

                              <td className="p-3">
                                <div className="flex items-center gap-2.5">
                                  <img src={emp.avatar} alt={emp.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                                  <div>
                                    <div className="font-bold text-foreground text-xs sm:text-sm">{emp.name}</div>
                                    <div className="text-[10px] text-muted-foreground">{emp.department} • {emp.designation}</div>
                                  </div>
                                </div>
                              </td>

                              {/* VALUE Input */}
                              <td className="p-3 text-center">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={currentQty}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === "" || /^-?\d*\.?\d*$/.test(val)) {
                                      handleQuantityChange(eId, currentCriterion, val);
                                    }
                                  }}
                                  placeholder="0"
                                  className="w-20 px-2 py-1.5 bg-background border border-border rounded-lg text-center font-bold text-xs outline-none focus:ring-1 focus:ring-primary"
                                />
                              </td>

                              {/* RANK Input */}
                              <td className="p-3 text-center">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={currentRank}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === "" || /^\d*$/.test(val)) {
                                      handleRankChange(eId, currentCriterion, val);
                                    }
                                  }}
                                  placeholder="Rank"
                                  className="w-16 px-2 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 rounded-lg text-center font-bold text-xs outline-none focus:ring-1 focus:ring-amber-500"
                                />
                              </td>

                              {/* POINTS / CALCULATED SCORE Input */}
                              <td className="p-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={currentVal}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (val === "" || /^\d*\.?\d*$/.test(val)) {
                                        handleScoreChange(eId, currentCritId, val);
                                      }
                                    }}
                                    placeholder="0"
                                    className="w-20 px-2 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 rounded-lg text-center font-black text-xs sm:text-sm outline-none focus:ring-1 focus:ring-emerald-500"
                                  />
                                  <span className="text-[11px] text-muted-foreground font-semibold">/ {currentCriterion.maxScore}</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="py-12 text-center text-muted-foreground text-xs">No parameters configured.</div>
              )}
            </div>
          ) : (
            /* FULL MATRIX VIEW (HORIZONTAL ALL CRITERIA) */
            <div className="border border-border/60 rounded-2xl overflow-hidden max-h-[60vh] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/60 border-b border-border/60 sticky top-0 z-10 text-muted-foreground font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="p-3 text-foreground">Employee</th>
                    {criteria.map((c) => (
                      <th key={c.id} className="p-3 text-center">
                        <div>{c.name}</div>
                        <span className="text-[10px] text-muted-foreground lowercase">(Max {c.maxScore})</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-medium text-foreground">
                  {participatingEmployees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-muted/20">
                      <td className="p-3">
                        <div className="font-bold text-foreground">{emp.name}</div>
                        <div className="text-[10px] text-muted-foreground">{emp.department} • {emp.designation}</div>
                      </td>
                      {criteria.map((c) => {
                        const val = scoreMatrix[emp.id]?.[String(c.id)] ?? "";
                        return (
                          <td key={c.id} className="p-3 text-center">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={val}
                              onChange={(ev) => {
                                const v = ev.target.value;
                                if (v === "" || /^\d*\.?\d*$/.test(v)) {
                                  handleScoreChange(emp.id, String(c.id), v);
                                }
                              }}
                              className="w-16 px-2 py-1 bg-background border border-border rounded-md text-xs font-bold text-center outline-none focus:ring-1 focus:ring-primary"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <DialogFooter className="pt-4 border-t border-border/60 flex items-center justify-between sm:justify-between w-full">
            <button
              type="button"
              onClick={() => setScoreEntryModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveAllScores}
              disabled={savingScores}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{savingScores ? "Saving..." : "Save Scores & Recalculate"}</span>
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =========================================================================
          AUDITORIUM REVEAL CEREMONY MODAL (CINEMATIC PRESENTATION)
         ========================================================================= */}
      {/* =========================================================================
          AUDITORIUM REVEAL CEREMONY (FULL-SCREEN CINEMATIC PRESENTATION)
         ========================================================================= */}
      {ceremonyOpen && (
        <div className="fixed inset-0 z-[999999] bg-[#070913] text-white flex flex-col w-screen h-screen overflow-hidden select-none animate-in fade-in duration-300 font-sans">
          {/* Subtle Ambient Radial Glow & Grid Background */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-amber-500/10 via-purple-500/5 to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />

          {/* Top Ceremony Control Bar */}
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 bg-slate-950/80 border-b border-white/10 backdrop-blur-md shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 rounded-2xl shadow-lg shadow-amber-500/25 shrink-0">
                <Crown className="w-6 h-6 fill-slate-950" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                    Company-Wide Ceremony
                  </span>
                  <Badge variant="outline" className="border-amber-500/30 text-amber-400 bg-amber-500/10 text-[10px] font-bold px-2 py-0">
                    {selectedMonth} {selectedYear}
                  </Badge>
                  {isWinnerAnnounced ? (
                    <Badge className="bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-wider px-2.5 py-0 shadow-sm animate-pulse">
                      👑 Champion Declared!
                    </Badge>
                  ) : isTop2Showdown ? (
                    <Badge className="bg-rose-500 text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-0 shadow-sm animate-bounce">
                      ⚔️ Top 2 Showdown!
                    </Badge>
                  ) : ceremonyStage === criteria.length ? (
                    <Badge className="bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 text-[10px] font-black uppercase tracking-wider px-2 py-0 shadow-sm">
                      Final Parameter: {criteria[ceremonyStage - 1]?.name} ({finaleRevealedIds.size}/{leaderboard.length} Revealed)
                    </Badge>
                  ) : (
                    <Badge className="bg-white/10 text-slate-200 text-[10px] font-bold px-2 py-0">
                      Parameter {ceremonyStage} of {criteria.length}: {criteria[ceremonyStage - 1]?.name} (Max {criteria[ceremonyStage - 1]?.maxScore} pts)
                    </Badge>
                  )}
                </div>
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight mt-0.5">
                  Grand Auditorium Reveal — {selectedMonth} {selectedYear}
                </h2>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsAutoPlayingStory((prev) => !prev)}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                  isAutoPlayingStory
                    ? "bg-amber-400 text-slate-950 shadow-md ring-2 ring-amber-400/50 font-black animate-pulse"
                    : "bg-white/10 hover:bg-white/20 text-white"
                )}
                title="Automatically step through parameters"
              >
                {isAutoPlayingStory ? <SquarePause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                <span>{isAutoPlayingStory ? "Pause Auto Story" : "▶ Auto Story"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsAutoPlayingStory(false);
                  handleCeremonyPrev();
                }}
                disabled={ceremonyStage <= 1 && finaleRevealedIds.size === 0 && !isWinnerAnnounced}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1"
                title="Previous Step"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Prev</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsAutoPlayingStory(false);
                  handleCeremonyNext();
                }}
                className="px-4 py-1.5 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 text-slate-950 text-xs font-black rounded-xl shadow-md shadow-amber-500/25 transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
              >
                <span>
                  {isWinnerAnnounced
                    ? "🎉 Confetti Blast"
                    : ceremonyStage < criteria.length
                    ? `Next: ${criteria[ceremonyStage]?.name || "Next Column"}`
                    : isTop2Showdown
                    ? "🏆 Crown Winner & Top 2!"
                    : (() => {
                        const queue = finaleRevealQueue.length > 0 ? finaleRevealQueue : generateRevealQueue(leaderboard);
                        const nextCand = queue[finaleRevealedIds.size];
                        return nextCand ? `Reveal: ${nextCand.name}` : "Reveal Next Contender";
                      })()}
                </span>
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsAutoPlayingStory(false);
                  setCeremonyStage(1);
                  setFinaleRevealedIds(new Set());
                  setIsTop2Showdown(false);
                  setIsWinnerAnnounced(false);
                  setTeasingEmpId(null);
                  setRankShiftHighlights({});
                  setFinaleRevealQueue(generateRevealQueue(leaderboard));
                  triggerConfetti(false);
                }}
                className="p-2 hover:bg-white/10 text-white/70 hover:text-white rounded-xl transition-colors cursor-pointer"
                title="Replay Ceremony from Column 1"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen().then(() => setCeremonyFullscreen(true)).catch(() => {});
                  } else {
                    if (document.exitFullscreen) {
                      document.exitFullscreen().then(() => setCeremonyFullscreen(false)).catch(() => {});
                    }
                  }
                }}
                className="p-2 hover:bg-white/10 text-white/70 hover:text-white rounded-xl transition-colors cursor-pointer"
                title="Toggle Fullscreen Mode (F11)"
              >
                {ceremonyFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (document.fullscreenElement) {
                    document.exitFullscreen().catch(() => {});
                  }
                  setCeremonyOpen(false);
                }}
                className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-bold rounded-xl border border-rose-500/30 transition-colors cursor-pointer"
                title="Exit Ceremony (ESC)"
              >
                Close (ESC)
              </button>
            </div>
          </div>

          {/* Main Presentation View Container - Truly Full Screen Edge-to-Edge */}
          <div className="relative z-10 flex-1 min-h-0 flex flex-col p-2 sm:p-4 overflow-hidden">
            {/* Grand Podium & Winner Celebration (Appears ONLY when the EOM Winner is officially revealed) */}
            {isWinnerAnnounced && (
              <div className="space-y-4 mb-3 shrink-0 max-h-[48vh] overflow-y-auto animate-in zoom-in-95 duration-500">
                {/* 3D Glassmorphism Podium */}
                {(() => {
                  const currentAudList = getAuditoriumList();
                  const p1 = currentAudList[0];
                  const p2 = currentAudList[1];
                  const p3 = currentAudList[2];

                  return (
                    <div className="bg-gradient-to-b from-[#13192B]/95 via-[#0F1426]/90 to-[#0A0D18]/90 border-2 border-amber-400/60 rounded-3xl p-5 sm:p-6 shadow-2xl backdrop-blur-xl relative overflow-hidden">
                      <div className="absolute top-0 right-1/2 translate-x-1/2 w-full max-w-lg h-36 bg-gradient-to-b from-amber-400/20 via-purple-500/10 to-transparent blur-3xl pointer-events-none" />

                      <div className="flex items-center justify-center mb-2 px-2 text-xs font-black uppercase tracking-widest text-amber-400 gap-2">
                        <Trophy className="w-5 h-5 text-amber-400 animate-bounce" />
                        <span>Official Grand Finale Podium</span>
                        <Trophy className="w-5 h-5 text-amber-400 animate-bounce" />
                      </div>

                      <div className="grid grid-cols-3 gap-2 sm:gap-6 items-end max-w-2xl mx-auto pt-4 pb-2 relative z-10">
                        {/* 2nd Place Silver Stand */}
                        <div className="text-center space-y-1.5">
                          {p2 ? (
                            <div className="space-y-1 transition-all duration-500">
                              <img src={p2.avatar} alt={p2.name} className="w-12 h-12 sm:w-16 sm:h-16 rounded-full border-2 border-cyan-400 shadow-lg shadow-cyan-500/30 mx-auto object-cover" />
                              <p className="text-xs font-black text-slate-200 truncate max-w-[120px] mx-auto drop-shadow-sm">{p2.name}</p>
                              <span className="inline-block px-2.5 py-0.5 bg-slate-900/90 text-cyan-400 font-mono font-bold text-xs rounded-lg border border-cyan-500/40">
                                {p2.cumulative.toFixed(2)} pts
                              </span>
                            </div>
                          ) : (
                            <div className="w-12 h-12 bg-slate-800/50 rounded-full mx-auto" />
                          )}
                          <div className="h-24 sm:h-32 bg-gradient-to-t from-slate-900/90 via-slate-800/80 to-cyan-950/40 rounded-t-2xl border-t-2 border-x border-cyan-400/80 shadow-2xl shadow-cyan-500/20 backdrop-blur-md flex items-center justify-center">
                            <span className="text-2xl sm:text-3xl font-black text-cyan-300/80">2</span>
                          </div>
                        </div>

                        {/* 1st Place Gold Stand */}
                        <div className="text-center space-y-1.5 -translate-y-3">
                          {p1 ? (
                            <div className="space-y-1 transition-all duration-500 relative">
                              <Crown className="w-8 h-8 text-amber-400 mx-auto animate-bounce drop-shadow-[0_0_10px_rgba(251,191,36,0.8)]" />
                              <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-24 h-28 bg-gradient-to-b from-amber-400/25 to-transparent blur-md pointer-events-none" />
                              <img src={p1.avatar} alt={p1.name} className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-amber-400 shadow-2xl shadow-amber-500/50 ring-4 ring-amber-500/20 mx-auto object-cover" />
                              <p className="text-xs sm:text-sm font-black text-amber-300 truncate max-w-[140px] mx-auto drop-shadow-md">
                                {p1.name}
                              </p>
                              <span className="inline-block px-3 py-1 bg-amber-500/20 text-amber-300 font-mono font-black text-xs sm:text-sm rounded-xl border border-amber-400/80 shadow-lg shadow-amber-500/30">
                                {p1.cumulative.toFixed(2)} pts
                              </span>
                            </div>
                          ) : (
                            <div className="w-16 h-16 bg-slate-800/50 rounded-full mx-auto" />
                          )}
                          <div className="h-32 sm:h-44 bg-gradient-to-t from-amber-950/90 via-amber-900/40 to-yellow-500/20 rounded-t-2xl border-t-4 border-x border-amber-400 shadow-2xl shadow-amber-500/30 backdrop-blur-xl flex items-center justify-center relative overflow-hidden">
                            <span className="text-3xl sm:text-4xl font-black text-amber-300/90">1</span>
                          </div>
                        </div>

                        {/* 3rd Place Bronze Stand */}
                        <div className="text-center space-y-1.5">
                          {p3 ? (
                            <div className="space-y-1 transition-all duration-500">
                              <img src={p3.avatar} alt={p3.name} className="w-12 h-12 sm:w-16 sm:h-16 rounded-full border-2 border-orange-400 shadow-lg shadow-orange-500/30 mx-auto object-cover" />
                              <p className="text-xs font-black text-slate-200 truncate max-w-[120px] mx-auto drop-shadow-sm">{p3.name}</p>
                              <span className="inline-block px-2.5 py-0.5 bg-slate-900/90 text-orange-400 font-mono font-bold text-xs rounded-lg border border-orange-500/40">
                                {p3.cumulative.toFixed(2)} pts
                              </span>
                            </div>
                          ) : (
                            <div className="w-12 h-12 bg-slate-800/50 rounded-full mx-auto" />
                          )}
                          <div className="h-20 sm:h-28 bg-gradient-to-t from-slate-900/90 via-slate-800/80 to-orange-950/40 rounded-t-2xl border-t-2 border-x border-orange-400/80 shadow-2xl shadow-orange-500/20 backdrop-blur-md flex items-center justify-center">
                            <span className="text-2xl sm:text-3xl font-black text-orange-300/80">3</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Winner Announcement Card */}
                <div className="bg-gradient-to-r from-amber-500/20 via-yellow-500/30 to-amber-500/20 border-2 border-amber-400 rounded-3xl p-6 sm:p-8 text-center space-y-3 shadow-2xl shadow-amber-500/40 backdrop-blur-xl">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-widest shadow-md">
                    <Crown className="w-4 h-4 fill-slate-950" />
                    <span>Official Employee of the Month Winner</span>
                  </div>
                  {(() => {
                    const sortedTop = [...leaderboard].sort((a, b) => b.totalScore - a.totalScore);
                    const champion = sortedTop[0];
                    if (!champion) return null;

                    return (
                      <div className="space-y-1">
                        <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight drop-shadow-md">
                          {champion.name}
                        </h2>
                        <p className="text-xs sm:text-sm text-amber-200/90 font-bold">
                          {champion.department} • {champion.designation}
                        </p>
                        <div className="text-2xl sm:text-3xl font-black text-amber-400 pt-2">
                          Grand Total: {champion.totalScore} pts
                        </div>
                      </div>
                    );
                  })()}

                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => triggerGrandFinaleConfetti10s()}
                      className="px-6 py-2.5 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black rounded-xl shadow-lg shadow-amber-500/30 text-xs uppercase tracking-wider transition-all cursor-pointer"
                    >
                      🎉 Fire More Confetti
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCeremonyStage(1);
                        setFinaleRevealedIds(new Set());
                        setIsTop2Showdown(false);
                        setIsWinnerAnnounced(false);
                        setTeasingEmpId(null);
                        setRankShiftHighlights({});
                        setFinaleRevealQueue(generateRevealQueue(leaderboard));
                        triggerConfetti(false);
                      }}
                      className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold rounded-xl border border-amber-500/30 text-xs transition-all cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4 inline mr-1.5" />
                      Replay Ceremony
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Top 2 Showdown Glowing Banner */}
            {isTop2Showdown && (
              <div className="p-3 mb-3 bg-gradient-to-r from-purple-950 via-indigo-900 to-purple-950 border-2 border-purple-400 rounded-2xl text-center space-y-1 shadow-2xl shadow-purple-500/40 animate-pulse shrink-0">
                <p className="text-xs sm:text-sm font-black uppercase tracking-widest text-purple-300 flex items-center justify-center gap-2">
                  <Zap className="w-5 h-5 text-purple-400 animate-bounce" /> TOP 2 SIMULTANEOUS SHOWDOWN <Zap className="w-5 h-5 text-purple-400 animate-bounce" />
                </p>
                <p className="text-xs text-purple-200 font-bold">
                  Press SPACEBAR or click "Crown Winner" to declare the Champion!
                </p>
              </div>
            )}

            {/* Grand Column-by-Column Presentation Table - Full Screen Edge-to-Edge */}
            <div className="flex-1 min-h-0 w-full bg-slate-900/90 border border-white/10 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-md flex flex-col">
              <div className="flex-1 w-full h-full overflow-auto scrollbar-thin">
                <table className="w-full text-left text-xs sm:text-sm border-collapse">
                  <thead className="sticky top-0 z-20 bg-slate-950/95 backdrop-blur-md border-b border-white/15 text-slate-300 font-black uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="sticky left-0 z-30 bg-slate-950 px-3 py-3.5 w-20 text-center border-r border-white/10">
                        RANK
                      </th>
                      <th className="sticky left-20 z-30 bg-slate-950 px-4 py-3.5 min-w-[200px] border-r border-white/10 shadow-[4px_0_10px_rgba(0,0,0,0.5)]">
                        CANDIDATE
                      </th>
                      {criteria.slice(0, Math.min(ceremonyStage, criteria.length)).map((crit, idx, arr) => {
                        const isJustRevealed = idx === arr.length - 1;

                        return (
                          <th
                            key={crit.id || idx}
                            className={cn(
                              "px-4 py-3.5 text-center min-w-[130px] transition-all duration-300 border-r border-white/10",
                              isJustRevealed
                                ? "bg-gradient-to-b from-amber-500/30 to-amber-500/10 text-amber-300 ring-2 ring-amber-400 shadow-lg shadow-amber-500/20 animate-in fade-in zoom-in-95"
                                : "bg-slate-900/90 text-white"
                            )}
                          >
                            <div className="flex flex-col items-center gap-1">
                              {isJustRevealed && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black uppercase tracking-wider animate-pulse">
                                  ★ REVEALED
                                </span>
                              )}
                              <span className="truncate max-w-[140px] font-black text-xs">
                                {crit.name.toUpperCase()}
                              </span>
                              <span className="text-[10px] font-mono text-amber-300/80 font-bold">
                                ({crit.maxScore} PTS)
                              </span>
                            </div>
                          </th>
                        );
                      })}
                      <th className="px-4 py-3.5 text-center min-w-[140px] bg-amber-500/15 text-amber-300 font-black border-l border-white/10">
                        {ceremonyStage === criteria.length ? "GRAND TOTAL" : "PROGRESSIVE TOTAL"}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 font-medium">
                    {getAuditoriumList().map((item) => {
                      const isGold = item.rank === 1 && (isWinnerAnnounced || ceremonyStage === criteria.length);
                      const isSilver = item.rank === 2 && (isWinnerAnnounced || ceremonyStage === criteria.length);
                      const isBronze = item.rank === 3 && (isWinnerAnnounced || ceremonyStage === criteria.length);

                      const shift = rankShiftHighlights[item.employeeId];
                      const isClimbing = shift && shift.direction === "up";
                      const isDropping = shift && shift.direction === "down";
                      const isTeasing = item.employeeId === teasingEmpId;

                      return (
                        <tr
                          key={item.employeeId}
                          className={cn(
                            "transition-all duration-700 ease-in-out",
                            isTeasing
                              ? "bg-amber-400/30 ring-2 ring-amber-400 animate-pulse scale-[1.01]"
                              : isClimbing
                              ? "bg-emerald-500/25 ring-2 ring-emerald-400 shadow-lg shadow-emerald-500/30 animate-pulse"
                              : isDropping
                              ? "bg-rose-500/20 ring-1 ring-rose-400/60 shadow-md shadow-rose-500/20"
                              : isGold
                              ? "bg-amber-500/20 font-black"
                              : isSilver
                              ? "bg-cyan-500/15"
                              : isBronze
                              ? "bg-amber-700/15"
                              : "hover:bg-white/5"
                          )}
                        >
                          <td className="sticky left-0 z-10 bg-slate-950/90 px-3 py-3 text-center font-black font-mono border-r border-white/10">
                            <div className="flex flex-col items-center justify-center gap-1">
                              {isGold ? (
                                <span className="w-7 h-7 rounded-full bg-amber-400 text-slate-950 inline-flex items-center justify-center text-xs font-black shadow-lg shadow-amber-400/50">
                                  1
                                </span>
                              ) : isSilver ? (
                                <span className="w-7 h-7 rounded-full bg-cyan-300 text-slate-950 inline-flex items-center justify-center text-xs font-black shadow-md">
                                  2
                                </span>
                              ) : isBronze ? (
                                <span className="w-7 h-7 rounded-full bg-amber-700 text-white inline-flex items-center justify-center text-xs font-black shadow-md">
                                  3
                                </span>
                              ) : (
                                <span className="text-white/70 text-xs">#{item.rank}</span>
                              )}

                              {/* 3-5 Second Highlight Badge for Rank Movement */}
                              {isClimbing && (
                                <span className="px-1.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-black text-[9px] inline-flex items-center gap-0.5 shadow-md animate-bounce">
                                  ▲ +{shift.diff}
                                </span>
                              )}
                              {isDropping && (
                                <span className="px-1.5 py-0.5 rounded-full bg-rose-500/40 text-rose-300 font-bold text-[9px] inline-flex items-center gap-0.5">
                                  ▼ -{shift.diff}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="sticky left-20 z-10 bg-slate-950/90 px-4 py-3 border-r border-white/10 shadow-[4px_0_10px_rgba(0,0,0,0.5)]">
                            <div className="flex items-center gap-2.5">
                              <img src={item.avatar} alt={item.name} className="w-8 h-8 rounded-full object-cover shrink-0 border border-white/20" />
                              <div className="min-w-0">
                                <div className="font-bold text-xs sm:text-sm text-white truncate flex items-center gap-1.5">
                                  <span>{item.name}</span>
                                  {isGold && <Crown className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />}
                                  {isClimbing && (
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-black uppercase tracking-wider">
                                      Climbed #{shift.to}
                                    </span>
                                  )}
                                  {isDropping && (
                                    <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[9px] font-bold uppercase tracking-wider">
                                      Dropped #{shift.to}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-white/50 truncate">
                                  {item.department} • {item.designation}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Only Revealed Columns mapped step-by-step! */}
                          {criteria.slice(0, Math.min(ceremonyStage, criteria.length)).map((crit, idx, arr) => {
                            const cId = String(crit.id || "");
                            const val = item.colScores[cId] ?? 0;
                            const isJustRevealed = idx === arr.length - 1;
                            const isLastParam = idx === criteria.length - 1;

                            return (
                              <td
                                key={cId || idx}
                                className={cn(
                                  "px-4 py-3 text-center border-r border-white/10 font-bold transition-colors",
                                  isJustRevealed ? "bg-amber-500/15 text-amber-300 font-black text-sm" : "text-slate-200"
                                )}
                              >
                                {isLastParam && !item.isFinaleRevealed ? (
                                  <span className="px-2.5 py-1 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 font-mono text-xs font-bold animate-pulse">
                                    ???
                                  </span>
                                ) : (
                                  val
                                )}
                              </td>
                            );
                          })}

                          {/* Cumulative Progressive / Grand Total Score */}
                          <td className="px-4 py-3 text-center font-black border-l border-white/10">
                            {ceremonyStage === criteria.length ? (
                              item.isFinaleRevealed ? (
                                <span className="text-sm sm:text-base text-amber-300 font-black tracking-tight drop-shadow-sm">
                                  {item.cumulative} pts
                                </span>
                              ) : (
                                <div className="flex items-center justify-center gap-1 font-bold">
                                  <span className="text-xs sm:text-sm text-slate-300">{item.cumulative} pts</span>
                                  <span className="text-[10px] text-amber-400 font-mono">+ ?</span>
                                </div>
                              )
                            ) : (
                              <span className="text-sm sm:text-base text-amber-300 font-extrabold tracking-tight">
                                {item.cumulative} pts
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PARTICIPATING EMPLOYEES SELECTION MODAL */}
      <Dialog open={participantModalOpen} onOpenChange={setParticipantModalOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto rounded-3xl p-6 sm:p-8">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-foreground flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <span>Select Participating Employees</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Choose staff eligible for EOM recognition in {selectedMonth} {selectedYear}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 mt-3">
            <div className="relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
              <input
                type="text"
                value={empSearch}
                onChange={(e) => setEmpSearch(e.target.value)}
                placeholder="Search by name or department..."
                className="w-full pl-9 pr-3.5 py-2 bg-background border border-border rounded-xl text-xs"
              />
            </div>

            <div className="max-h-60 overflow-y-auto border border-border/60 rounded-2xl p-2 space-y-1 bg-muted/20">
              {filteredParticipants.map((emp) => {
                const isSelected = selectedEmpIds.includes(emp.id);
                return (
                  <div
                    key={emp.id}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedEmpIds(selectedEmpIds.filter((id) => id !== emp.id));
                      } else {
                        setSelectedEmpIds([...selectedEmpIds, emp.id]);
                      }
                    }}
                    className={cn(
                      "flex items-center justify-between p-2.5 rounded-xl cursor-pointer border text-xs",
                      isSelected ? "bg-primary/10 border-primary font-bold" : "bg-card border-border/60 hover:bg-muted"
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <img src={emp.avatar} alt={emp.name} className="w-7 h-7 rounded-full object-cover" />
                      <div>
                        <div>{emp.name}</div>
                        <div className="text-[10px] text-muted-foreground font-normal">{emp.department} • {emp.designation}</div>
                      </div>
                    </div>
                    <div className={cn(
                      "w-4 h-4 rounded flex items-center justify-center border",
                      isSelected ? "bg-primary text-primary-foreground border-primary" : "border-muted-foreground/30"
                    )}>
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter className="pt-4 border-t border-border/60">
            <button
              onClick={() => setParticipantModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveParticipants}
              disabled={savingParticipants}
              className="px-5 py-2 bg-primary text-primary-foreground font-bold rounded-xl text-xs shadow-xs cursor-pointer"
            >
              {savingParticipants ? "Saving..." : "Save Selection"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MONTH HISTORY MODAL */}
      <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto rounded-3xl p-6 sm:p-8">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-foreground flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              <span>EOM Past Month History</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2 mt-3">
            {monthHistory.map((item) => (
              <div
                key={item.month_year}
                onClick={() => {
                  const parts = item.month_year.split("-");
                  const y = parts[0];
                  const mNum = parts[1];
                  if (y && mNum) {
                    setSelectedYear(y);
                    const mName = MONTHS[parseInt(mNum, 10) - 1];
                    if (mName) setSelectedMonth(mName);
                    setHistoryModalOpen(false);
                  }
                }}
                className="flex items-center justify-between p-3.5 bg-card hover:bg-muted/50 border border-border/60 rounded-2xl cursor-pointer transition-all"
              >
                <div>
                  <div className="text-sm font-bold text-foreground">{item.month_year}</div>
                  <div className="text-xs text-muted-foreground">Winner: <span className="font-bold text-foreground">{item.winner}</span></div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs font-bold">{item.criteriaCount} Criteria</Badge>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* MASTER TEMPLATE MODAL */}
      <Dialog open={masterModalOpen} onOpenChange={setMasterModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl p-6 sm:p-8">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-foreground flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              <span>EOM Master Criteria Template</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              These criteria are copied automatically whenever a new month is initialized.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2.5 mt-3">
            {masterCriteria.map((c, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-muted/20 border border-border/60 rounded-2xl gap-3 text-xs">
                <span className="font-bold text-foreground">{c.name}</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Max Score:</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={c.maxScore}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "" || /^\d*\.?\d*$/.test(v)) {
                        const next = [...masterCriteria];
                        const item = next[idx];
                        if (item) {
                          item.maxScore = v === "" ? 0 : Number(v);
                          setMasterCriteria(next);
                        }
                      }
                    }}
                    className="w-16 px-2 py-1 bg-background border border-border rounded-lg text-center font-bold outline-none focus:ring-1 focus:ring-primary"
                  />
                  <span>pts</span>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="pt-4 border-t border-border/60">
            <button
              onClick={() => setMasterModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveMasterCriteria}
              disabled={savingMaster}
              className="px-5 py-2 bg-primary text-primary-foreground font-bold rounded-xl text-xs shadow-xs cursor-pointer"
            >
              {savingMaster ? "Saving..." : "Save Master Template"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* REVEAL SCHEDULE MODAL */}
      <Dialog open={revealModalOpen} onOpenChange={setRevealModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 sm:p-8">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-foreground flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-500" />
              <span>Schedule Auditorium Reveal</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Set the exact date & time when the winner podium will be unlocked for company-wide auditorium broadcast.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 mt-3">
            <label className="text-xs font-bold uppercase tracking-wide text-foreground">Reveal Date & Time</label>
            <input
              type="datetime-local"
              value={revealDateTime ? revealDateTime.slice(0, 16) : ""}
              onChange={(e) => setRevealDateTime(new Date(e.target.value).toISOString())}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm font-bold"
            />
          </div>

          <DialogFooter className="pt-4 border-t border-border/60">
            <button
              onClick={() => setRevealModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveReveal}
              disabled={savingReveal}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 text-amber-950 font-black rounded-xl text-xs shadow-xs uppercase tracking-wide cursor-pointer"
            >
              {savingReveal ? "Saving..." : "Confirm Schedule"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE PARAMETER CONFIRMATION DIALOG */}
      <AlertDialog open={deleteParamModalOpen} onOpenChange={setDeleteParamModalOpen}>
        <AlertDialogContent className="rounded-3xl p-6 sm:p-8 max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black text-foreground flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              <span>Delete Evaluation Parameter?</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to remove <span className="font-bold text-foreground">"{paramToDelete?.name}"</span> for {selectedMonth} {selectedYear}? This parameter will be removed from this month's evaluation criteria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel className="rounded-xl text-xs font-bold cursor-pointer">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteParam}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl text-xs font-bold cursor-pointer"
            >
              Remove Parameter
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
