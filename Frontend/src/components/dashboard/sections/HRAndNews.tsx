import { useState, useEffect, useMemo } from "react";
import { HR_UPDATES, COMPANY_NEWS } from "../dashboard-data";
import {
  Gift,
  Award,
  CalendarDays,
  UserPlus,
  LogOut,
  CheckCircle2,
  ShieldAlert,
  Cake,
  Sparkles,
  Plus,
  Trash2,
  Edit2,
  Quote,
  X,
  Megaphone,
} from "lucide-react";
import { CollapsibleSection } from "./CollapsibleSection";
import { useEmployeesContext } from "@/components/employees/EmployeeContext";
import { useAuth } from "@/components/auth/AuthContext";
import { isUserAdmin } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { useDashboardOverview } from "@/hooks/useDashboardOverview";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { Dialog, DialogContent } from "@/components/ui/dialog";

function parseDobToNextBirthday(dobStr: string): { diffDays: number; formatted: string } | null {
  if (!dobStr) return null;
  const parts = dobStr.includes("-") ? dobStr.split("-") : dobStr.split("/");
  if (parts.length < 3) return null;
  let month = 0;
  let day = 0;
  const p0 = parts[0] ?? "";
  const p1 = parts[1] ?? "";
  const p2 = parts[2] ?? "";
  if (p0.length === 4) {
    // YYYY-MM-DD
    month = parseInt(p1, 10) - 1;
    day = parseInt(p2, 10);
  } else {
    // DD-MM-YYYY or MM-DD-YYYY
    day = parseInt(p0, 10);
    month = parseInt(p1, 10) - 1;
  }
  if (isNaN(month) || isNaN(day) || month < 0 || month > 11 || day < 1 || day > 31) return null;

  const now = new Date();
  const currentYear = now.getFullYear();
  let nextBday = new Date(currentYear, month, day);
  const todayReset = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (nextBday < todayReset) {
    nextBday = new Date(currentYear + 1, month, day);
  }

  const diffTime = nextBday.getTime() - todayReset.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const formatted = `${day} ${monthNames[month] ?? ""}`;
  return { diffDays, formatted };
}

interface NewsItem {
  _id?: string;
  id?: string;
  title: string;
  desc: string;
  date?: string;
  priority?: number;
}

interface MotivationItem {
  _id?: string;
  quote: string;
  author?: string;
  date?: string;
}

export function HRAndNews() {
  const { employees } = useEmployeesContext();
  const { user } = useAuth();
  const { data: dashboardData } = useDashboardOverview();
  const isAdmin = isUserAdmin(user);

  // ==================== COMPANY NEWS STATE ====================
  const [newsList, setNewsList] = useState<NewsItem[]>([]);
  const [isNewsModalOpen, setIsNewsModalOpen] = useState(false);
  const [editingNews, setEditingNews] = useState<NewsItem | null>(null);
  const [newsTitle, setNewsTitle] = useState("");
  const [newsDesc, setNewsDesc] = useState("");
  const [newsDate, setNewsDate] = useState("");
  const [isSavingNews, setIsSavingNews] = useState(false);

  const fetchNews = async () => {
    try {
      const res = await api.get<any>("/dashboard/news", { showErrorToast: false });
      if (res?.news && Array.isArray(res.news)) {
        setNewsList(res.news);
        return;
      }
    } catch {
      // Fallback
    }
    setNewsList(COMPANY_NEWS as any[]);
  };

  useEffect(() => {
    fetchNews();
  }, []);

  const handleOpenAddNews = () => {
    setEditingNews(null);
    setNewsTitle("");
    setNewsDesc("");
    setNewsDate(new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short" }));
    setIsNewsModalOpen(true);
  };

  const handleOpenEditNews = (item: NewsItem) => {
    setEditingNews(item);
    setNewsTitle(item.title);
    setNewsDesc(item.desc);
    setNewsDate(item.date || "");
    setIsNewsModalOpen(true);
  };

  const handleSaveNews = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsTitle.trim() || !newsDesc.trim()) return;
    setIsSavingNews(true);
    try {
      if (editingNews && (editingNews._id || editingNews.id)) {
        const id = editingNews._id || editingNews.id;
        await api.put(`/dashboard/news/${id}`, {
          title: newsTitle.trim(),
          desc: newsDesc.trim(),
          date: newsDate.trim() || undefined,
        });
        toast.success("News updated successfully");
      } else {
        await api.post("/dashboard/news", {
          title: newsTitle.trim(),
          desc: newsDesc.trim(),
          date: newsDate.trim() || undefined,
        });
        toast.success("News published successfully");
      }
      setIsNewsModalOpen(false);
      await fetchNews();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save news");
    } finally {
      setIsSavingNews(false);
    }
  };

  const handleDeleteNews = async (item: NewsItem) => {
    const id = item._id || item.id;
    if (!id) return;
    try {
      await api.delete(`/dashboard/news/${id}`);
      toast.success("News deleted");
      await fetchNews();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete news");
    }
  };

  // ==================== MOTIVATION STATE ====================
  const [currentMotivation, setCurrentMotivation] = useState<MotivationItem>({
    quote: "Discipline compounds faster than talent. Show up, ship, repeat.",
    author: "Daily Mindset",
  });
  const [allMotivations, setAllMotivations] = useState<MotivationItem[]>([]);
  const [isMotivationModalOpen, setIsMotivationModalOpen] = useState(false);
  const [editingMotivationId, setEditingMotivationId] = useState<string | null>(null);
  const [motQuote, setMotQuote] = useState("");
  const [motAuthor, setMotAuthor] = useState("");
  const [motDate, setMotDate] = useState("");
  const [isSavingMotivation, setIsSavingMotivation] = useState(false);

  const fetchMotivation = async () => {
    try {
      const res = await api.get<any>("/dashboard/motivation", { showErrorToast: false });
      if (res?.current) {
        setCurrentMotivation(res.current);
      }
      if (res?.quotes && Array.isArray(res.quotes)) {
        setAllMotivations(res.quotes);
      }
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    fetchMotivation();
  }, []);

  const handleOpenMotivationModal = () => {
    setEditingMotivationId(null);
    setMotQuote(currentMotivation.quote);
    setMotAuthor(currentMotivation.author || "");
    setMotDate(new Date().toISOString().split("T")[0] || "");
    setIsMotivationModalOpen(true);
  };

  const handleSaveMotivation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!motQuote.trim()) return;
    setIsSavingMotivation(true);
    try {
      if (editingMotivationId) {
        await api.put(`/dashboard/motivation/${editingMotivationId}`, {
          quote: motQuote.trim(),
          author: motAuthor.trim() || "Daily Mindset",
          date: motDate.trim() || undefined,
        });
        toast.success("Quote updated successfully");
      } else {
        await api.post("/dashboard/motivation", {
          quote: motQuote.trim(),
          author: motAuthor.trim() || "Daily Mindset",
          date: motDate.trim() || undefined,
        });
        toast.success("Quote added for display");
      }
      setIsMotivationModalOpen(false);
      await fetchMotivation();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save motivation quote");
    } finally {
      setIsSavingMotivation(false);
    }
  };

  const handleDeleteMotivationQuote = async (id: string) => {
    try {
      await api.delete(`/dashboard/motivation/${id}`);
      toast.success("Quote deleted");
      await fetchMotivation();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete quote");
    }
  };

  // ==================== DYNAMIC HR UPDATES ====================
  const canViewOffboarding = Boolean(
    isAdmin ||
    ["Admin", "HR", "Manager", "Sub-Admin", "Team Lead", "CEO", "CTO"].includes(
      (user as any)?.role || (user as any)?.work_details?.system_role || ""
    )
  );

  const realBirthdays = useMemo(() => {
    if (!employees || employees.length === 0) {
      return HR_UPDATES.birthdays.map((b) => ({ ...b, diffDays: null }));
    }
    const withDob = employees
      .map((e) => {
        const parsed = parseDobToNextBirthday(e.dob || "");
        return {
          name: e.name,
          date: parsed ? parsed.formatted : e.dob || "",
          diffDays: parsed ? parsed.diffDays : 999,
        };
      })
      .filter((e) => e.date)
      .sort((a, b) => (a.diffDays ?? 999) - (b.diffDays ?? 999));

    if (withDob.length === 0) {
      return HR_UPDATES.birthdays.map((b) => ({ ...b, diffDays: null }));
    }
    return withDob.slice(0, 6);
  }, [employees]);

  // Dynamic Work Anniversaries from backend overview or calculated from employee joining dates
  const dynamicAnniversaries = useMemo(() => {
    const fromApi = dashboardData?.hr_updates?.anniversaries;
    if (fromApi && fromApi.length > 0) return fromApi;

    if (!employees || employees.length === 0) return HR_UPDATES.anniversaries;
    const today = new Date();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const results: any[] = [];

    for (const e of employees) {
      const jDate = e.joinDate || (e as any).work_details?.joining_date || (e as any).employmentStartDate;
      if (jDate && jDate.length >= 10) {
        const d = new Date(jDate);
        if (!isNaN(d.getTime())) {
          const years = today.getFullYear() - d.getFullYear();
          if (years > 0) {
            results.push({
              name: e.name,
              tenure: `${years} ${years === 1 ? "year" : "years"}`,
              date: `${d.getDate()} ${monthNames[d.getMonth()]}`,
            });
          }
        }
      }
    }
    return results.length > 0 ? results.slice(0, 6) : HR_UPDATES.anniversaries;
  }, [dashboardData, employees]);

  // Dynamic New Joinings
  const dynamicNewJoinings = useMemo(() => {
    const fromApi = dashboardData?.hr_updates?.new_joinings;
    if (fromApi && fromApi.length > 0) return fromApi;

    if (!employees || employees.length === 0) return HR_UPDATES.joining;
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const results: any[] = [];
    const today = new Date();

    for (const e of employees) {
      const jDate = e.joinDate || (e as any).work_details?.joining_date || (e as any).employmentStartDate;
      if (jDate && jDate.length >= 10) {
        const d = new Date(jDate);
        if (!isNaN(d.getTime())) {
          const diffDays = Math.round((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays >= 0 && diffDays <= 60) {
            results.push({
              name: e.name,
              date: `${d.getDate()} ${monthNames[d.getMonth()]}`,
              role: e.role || "Team Member",
            });
          }
        }
      }
    }
    return results.length > 0 ? results.slice(0, 6) : HR_UPDATES.joining;
  }, [dashboardData, employees]);

  // Dynamic Interviews
  const dynamicInterviews = useMemo(() => {
    const fromApi = dashboardData?.hr_updates?.interviews;
    if (fromApi && fromApi.length > 0) {
      return fromApi.map((item: any) => ({
        role: `${item.name} (${item.role})`,
        time: `${item.date} • ${item.time}`,
      }));
    }
    return HR_UPDATES.interviews;
  }, [dashboardData]);

  // Dynamic Probation Ending
  const dynamicProbations = useMemo(() => {
    const fromApi = dashboardData?.hr_updates?.probations;
    if (fromApi && fromApi.length > 0) return fromApi;
    return HR_UPDATES.probation;
  }, [dashboardData]);

  // Dynamic Exits / Last Working Date
  const dynamicExits = useMemo(() => {
    const fromApi = dashboardData?.hr_updates?.exits;
    if (fromApi && fromApi.length > 0) return fromApi;

    if (!employees || employees.length === 0) return HR_UPDATES.exit;
    const exiting = employees.filter(
      (e) =>
        e.hasResignation ||
        (e as any).last_working_date ||
        (e as any).work_details?.last_working_date ||
        (e.role && e.role.toLowerCase().includes("intern") && (e as any).bondEndDate) ||
        (e.department === "Intern" && (e as any).employmentEndDate)
    );
    if (exiting.length === 0) return [];

    return exiting.slice(0, 6).map((e) => {
      const rawDate =
        (e as any).last_working_date ||
        (e as any).work_details?.last_working_date ||
        (e.resignationDate ? e.resignationDate : (e as any).bondEndDate || "Upcoming Exit");

      const isIntern = e.role?.toLowerCase().includes("intern") || e.department === "Intern";
      let diffDaysText = "";
      if (rawDate && rawDate !== "Upcoming Exit") {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) {
          const now = new Date();
          const todayReset = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const targetReset = new Date(d.getFullYear(), d.getMonth(), d.getDate());
          const diff = Math.round((targetReset.getTime() - todayReset.getTime()) / (1000 * 60 * 60 * 24));
          if (diff === 0) diffDaysText = "Today";
          else if (diff > 0) diffDaysText = `In ${diff}d`;
          else diffDaysText = "Completed";
        }
      }

      return {
        name: e.name,
        role: e.role || "Employee",
        isIntern,
        date: rawDate,
        diffDaysText,
      };
    });
  }, [dashboardData, employees]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-12 mb-12">
      {/* SECTION 11: HR Updates */}
      <div>
        <CollapsibleSection section="Section 11" title="HR Updates">
          <div className="bg-white border border-border/60 rounded-3xl p-6 shadow-sm space-y-6">
            {/* Row 1: Birthdays & Anniversaries */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Gift className="h-4 w-4 text-rose-500" />
                  <h3 className="text-[13px] font-bold text-foreground">Upcoming Birthdays</h3>
                </div>
                <ul className="space-y-2">
                  {realBirthdays.map((item, i) => {
                    const isToday = item.diffDays === 0;
                    const isSoon = item.diffDays !== null && item.diffDays > 0 && item.diffDays <= 7;
                    return (
                      <li key={i} className="flex justify-between items-center text-[11px] p-1.5 rounded-xl hover:bg-muted/40 transition-colors">
                        <div className="flex items-center gap-2 min-w-0">
                          {isToday ? <Cake className="w-3.5 h-3.5 text-rose-500 animate-bounce shrink-0" /> : <Sparkles className="w-3 h-3 text-muted-foreground shrink-0" />}
                          <span className="font-semibold text-foreground/90 truncate">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          <span className="text-muted-foreground">{item.date}</span>
                          {isToday && (
                            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-rose-500 text-white animate-pulse">
                              Today!
                            </span>
                          )}
                          {isSoon && (
                            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800">
                              In {item.diffDays}d
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Award className="h-4 w-4 text-amber-500" />
                  <h3 className="text-[13px] font-bold text-foreground">Work Anniversaries</h3>
                </div>
                <ul className="space-y-2">
                  {dynamicAnniversaries.map((item: any, i: number) => (
                    <li key={i} className="flex justify-between items-center text-[11px] p-1.5 rounded-xl hover:bg-muted/40 transition-colors">
                      <span className="font-semibold text-foreground/90">{item.name}</span>
                      <span className="text-muted-foreground font-medium">{item.tenure}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="h-px bg-border/60"></div>

            {/* Row 2: Interviews & New Joining */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <CalendarDays className="h-4 w-4 text-blue-500" />
                  <h3 className="text-[13px] font-bold text-foreground">Interview Schedule</h3>
                </div>
                {dynamicInterviews.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic p-2">No interviews scheduled this week.</p>
                ) : (
                  <ul className="space-y-2">
                    {dynamicInterviews.map((item: any, i: number) => (
                      <li key={i} className="flex justify-between items-center text-[11px] p-1.5 rounded-xl hover:bg-muted/40 transition-colors">
                        <span className="font-semibold text-foreground/90 truncate mr-2">{item.role}</span>
                        <span className="text-muted-foreground font-medium shrink-0">{item.time}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <UserPlus className="h-4 w-4 text-primary" />
                  <h3 className="text-[13px] font-bold text-foreground">New Joining</h3>
                </div>
                {dynamicNewJoinings.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic p-2">No new joinings this month.</p>
                ) : (
                  <ul className="space-y-2">
                    {dynamicNewJoinings.map((item: any, i: number) => (
                      <li key={i} className="flex justify-between items-center text-[11px] p-1.5 rounded-xl hover:bg-muted/40 transition-colors">
                        <span className="font-semibold text-foreground/90">{item.name}</span>
                        <span className="text-muted-foreground font-medium">{item.date}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="h-px bg-border/60"></div>

            {/* Row 3: Employee/Intern Last Date & Probation Ending */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <LogOut className="h-4 w-4 text-rose-500" />
                    <h3 className="text-[13px] font-bold text-foreground">Employee / Intern Last Date</h3>
                  </div>
                  {!canViewOffboarding && (
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider bg-muted px-2 py-0.5 rounded-md">
                      HR Only
                    </span>
                  )}
                </div>

                {!canViewOffboarding ? (
                  <div className="p-4 rounded-2xl bg-muted/30 border border-dashed border-border text-center">
                    <ShieldAlert className="w-5 h-5 text-muted-foreground mx-auto mb-1.5 opacity-60" />
                    <p className="text-[11px] font-medium text-muted-foreground">
                      Offboarding & Last working date details are restricted to HR & Admin.
                    </p>
                  </div>
                ) : dynamicExits.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-muted/20 border border-dashed border-border/50 text-center">
                    <p className="text-[11px] font-medium text-muted-foreground">
                      No pending offboardings or departures. 🎉
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {dynamicExits.map((item: any, i: number) => (
                      <li key={i} className="flex justify-between items-center text-[11px] p-1.5 rounded-xl hover:bg-muted/40 transition-colors">
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-foreground/90 truncate">{item.name}</span>
                            {item.isIntern && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-100 text-purple-700">
                                Intern
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground truncate">{item.role}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-muted-foreground font-medium">{item.date}</span>
                          {item.diffDaysText && (
                            <span
                              className={cn(
                                "px-1.5 py-0.5 rounded-md text-[9px] font-black",
                                item.diffDaysText === "Today"
                                  ? "bg-rose-500 text-white animate-pulse"
                                  : item.diffDaysText === "Completed"
                                  ? "bg-muted text-muted-foreground"
                                  : "bg-amber-100 text-amber-800"
                              )}
                            >
                              {item.diffDaysText}
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <h3 className="text-[13px] font-bold text-foreground">Probation Ending</h3>
                </div>
                {dynamicProbations.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic p-2">No probations ending this month.</p>
                ) : (
                  <ul className="space-y-2">
                    {dynamicProbations.map((item: any, i: number) => (
                      <li key={i} className="flex justify-between items-center text-[11px] p-1.5 rounded-xl hover:bg-muted/40 transition-colors">
                        <span className="font-semibold text-foreground/90">{item.name}</span>
                        <span className="text-muted-foreground font-medium">{item.date}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </CollapsibleSection>
      </div>

      {/* SECTION 12: Company News & Motivation */}
      <div>
        <CollapsibleSection section="Section 12" title="Company News">
          {/* Header Controls for News */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
              <Megaphone className="w-3.5 h-3.5 text-primary" />
              Latest Announcements
            </span>
            {isAdmin && (
              <button
                type="button"
                onClick={handleOpenAddNews}
                className="px-3 py-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-2xs"
              >
                <Plus className="w-3 h-3" /> Add News
              </button>
            )}
          </div>

          {/* Company News list: keeps 3 items visible, smoothly scrolls if more */}
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar mb-6">
            {newsList.length === 0 ? (
              <div className="bg-white border border-border/60 rounded-3xl p-6 shadow-sm text-center">
                <p className="text-xs text-muted-foreground italic">No company news published yet.</p>
              </div>
            ) : (
              newsList.map((news, i) => (
                <div
                  key={news._id || news.id || i}
                  className="bg-white border border-border/60 rounded-3xl p-5 shadow-xs transition-all hover:border-primary/30 group relative"
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-[14px] font-bold text-foreground truncate">{news.title}</h3>
                        {news.date && (
                          <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md shrink-0">
                            {news.date}
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] text-muted-foreground leading-relaxed">{news.desc}</p>
                    </div>

                    {isAdmin && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => handleOpenEditNews(news)}
                          className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                          title="Edit news"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteNews(news)}
                          className="p-1.5 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition-colors"
                          title="Delete news"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Today's Motivation: Rich, Stunning Gradient Card */}
          <div className="rounded-3xl p-6 sm:p-7 text-white shadow-lg relative overflow-hidden flex flex-col justify-between min-h-[150px] bg-gradient-to-br from-emerald-950 via-slate-900 to-teal-950 border border-emerald-500/30">
            {/* Background Accent Gradients */}
            <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 -ml-12 -mb-12 w-48 h-48 bg-teal-500/15 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2 text-emerald-400">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                  Today's Motivation
                </h3>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={handleOpenMotivationModal}
                    className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[10px] font-bold transition-all border border-white/20 flex items-center gap-1 backdrop-blur-xs"
                  >
                    <Edit2 className="w-3 h-3" /> Manage
                  </button>
                )}
              </div>
              <p className="text-base sm:text-lg font-bold leading-snug text-white/95 tracking-wide">
                “{currentMotivation.quote}”
              </p>
              {currentMotivation.author && (
                <p className="text-xs text-emerald-300/80 mt-2.5 font-medium flex items-center gap-1.5">
                  <Quote className="w-3 h-3 opacity-60" /> {currentMotivation.author}
                </p>
              )}
            </div>
          </div>
        </CollapsibleSection>
      </div>

      {/* Add / Edit Company News Dialog */}
      <Dialog open={isNewsModalOpen} onOpenChange={setIsNewsModalOpen}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden rounded-3xl border border-border/60 shadow-2xl bg-background [&>button]:hidden">
          <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-card">
            <div>
              <h3 className="text-base font-black text-foreground">
                {editingNews ? "Edit Company News" : "Add Company News"}
              </h3>
              <p className="text-xs text-muted-foreground">Post updates for the whole company dashboard</p>
            </div>
            <button
              onClick={() => setIsNewsModalOpen(false)}
              className="p-1.5 border border-border/60 rounded-xl text-muted-foreground hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleSaveNews} className="p-6 space-y-4">
            <div>
              <label className="text-xs font-bold text-foreground block mb-1.5">Headline / Title *</label>
              <input
                type="text"
                required
                value={newsTitle}
                onChange={(e) => setNewsTitle(e.target.value)}
                placeholder="e.g. Q4 Target Achieved! New Client Onboarded"
                className="w-full px-3.5 py-2.5 bg-muted/30 border border-border/60 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-foreground block mb-1.5">Description / Details *</label>
              <textarea
                required
                rows={3}
                value={newsDesc}
                onChange={(e) => setNewsDesc(e.target.value)}
                placeholder="Provide short, engaging details for this announcement..."
                className="w-full px-3.5 py-2 bg-muted/30 border border-border/60 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-foreground block mb-1.5">Date / Tag Badge (Optional)</label>
              <input
                type="text"
                value={newsDate}
                onChange={(e) => setNewsDate(e.target.value)}
                placeholder="e.g. 24 Oct or Important"
                className="w-full px-3.5 py-2.5 bg-muted/30 border border-border/60 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsNewsModalOpen(false)}
                className="px-4 py-2 border border-border/60 rounded-xl text-xs font-bold hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingNews}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl transition-colors shadow-xs"
              >
                {isSavingNews ? "Saving..." : editingNews ? "Save Changes" : "Publish News"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Motivation Management Dialog */}
      <Dialog open={isMotivationModalOpen} onOpenChange={setIsMotivationModalOpen}>
        <DialogContent className="sm:max-w-lg p-0 overflow-hidden rounded-3xl border border-border/60 shadow-2xl bg-background [&>button]:hidden">
          <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-card">
            <div>
              <h3 className="text-base font-black text-foreground">Manage Daily Motivation</h3>
              <p className="text-xs text-muted-foreground">Set inspiring daily quotes for the dashboard</p>
            </div>
            <button
              onClick={() => setIsMotivationModalOpen(false)}
              className="p-1.5 border border-border/60 rounded-xl text-muted-foreground hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
            {/* Form */}
            <form onSubmit={handleSaveMotivation} className="space-y-4 p-4 rounded-2xl bg-muted/20 border border-border/60">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {editingMotivationId ? "Edit Quote" : "Add or Set Quote"}
              </h4>
              <div>
                <label className="text-xs font-bold text-foreground block mb-1.5">Quote Text *</label>
                <textarea
                  required
                  rows={2}
                  value={motQuote}
                  onChange={(e) => setMotQuote(e.target.value)}
                  placeholder="e.g. Success is the sum of small efforts repeated day in and day out."
                  className="w-full px-3.5 py-2 bg-card border border-border/60 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1.5">Author / Source</label>
                  <input
                    type="text"
                    value={motAuthor}
                    onChange={(e) => setMotAuthor(e.target.value)}
                    placeholder="e.g. Robert Collier"
                    className="w-full px-3 py-2 bg-card border border-border/60 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1.5">Specific Date (Optional)</label>
                  <input
                    type="date"
                    value={motDate}
                    onChange={(e) => setMotDate(e.target.value)}
                    className="w-full px-3 py-2 bg-card border border-border/60 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                {editingMotivationId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingMotivationId(null);
                      setMotQuote("");
                      setMotAuthor("");
                      setMotDate("");
                    }}
                    className="px-3 py-1.5 border border-border/60 rounded-xl text-xs font-bold hover:bg-muted"
                  >
                    Cancel Edit
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSavingMotivation}
                  className="px-4 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl shadow-xs"
                >
                  {isSavingMotivation ? "Saving..." : editingMotivationId ? "Update Quote" : "Save Quote"}
                </button>
              </div>
            </form>

            {/* List of Scheduled / Custom Quotes */}
            {allMotivations.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                  Saved Motivation Quotes ({allMotivations.length})
                </h4>
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                  {allMotivations.map((item, idx) => (
                    <div
                      key={item._id || idx}
                      className="p-3 rounded-xl border border-border/50 bg-card flex justify-between items-start gap-2 hover:border-border transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-foreground line-clamp-2">“{item.quote}”</p>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                          {item.author && <span>— {item.author}</span>}
                          {item.date && (
                            <span className="bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded">
                              {item.date}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMotivationId(item._id || null);
                            setMotQuote(item.quote);
                            setMotAuthor(item.author || "");
                            setMotDate(item.date || "");
                          }}
                          className="p-1.5 text-muted-foreground hover:text-primary rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {item._id && (
                          <button
                            type="button"
                            onClick={() => handleDeleteMotivationQuote(item._id!)}
                            className="p-1.5 text-muted-foreground hover:text-rose-600 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
