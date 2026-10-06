import { useState, useEffect, useCallback, useMemo } from "react";
import {
  format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  eachDayOfInterval, isSameMonth, isSameDay, isToday
} from "date-fns";
import {
  ChevronLeft, ChevronRight, Search, Plus, Calendar as CalendarIcon, ChevronDown, Clock, Trash2, Link2Off, RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Calendar as MiniCalendar } from "@/components/ui/calendar";
import { CreateEventModal } from "./CreateEventModal";
import { toast } from "@/lib/toast";
import { api } from "@/lib/api";
import { useDebounce } from "@/hooks/useDebounce";
import { useAuth } from "@/components/auth/AuthContext";

function canViewTeamCalendars(role: any): boolean {
  const r = String(role || "").toLowerCase().replace(/[_-]+/g, " ").trim();
  return r === "admin" || r === "super admin" || r === "superadmin" || r === "hr" || r === "sub admin" || r === "subadmin";
}

type ViewType = "Month" | "Week" | "Day";

export interface ScheduleEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  color: string; // tailwind class or #hex
  description?: string;
  type?: string;
  category?: string;
  attendees?: string[];
  primary_employee_id?: string;
}

const CATEGORY_OPTIONS = [
  { key: "my_schedule", label: "My Schedule" },
  { key: "work_anniversary", label: "Work Anniversaries" },
  { key: "birthday", label: "Birthdays" },
  { key: "google_calendar", label: "Google Calendar" },
  { key: "google_holidays", label: "Festivals & Holidays" },
] as const;

function toUiEvent(raw: any): ScheduleEvent {
  const id = String(raw.id || raw._id || "");
  const color: string = raw.color || "bg-blue-500";
  return {
    id,
    title: raw.title || "(No title)",
    date: String(raw.date || "").slice(0, 10),
    startTime: raw.start_time || raw.startTime || undefined,
    endTime: raw.end_time || raw.endTime || undefined,
    color,
    description: raw.description || "",
    type: raw.type || "",
    category: raw.category || "",
    attendees: raw.attendees || [],
    primary_employee_id: raw.primary_employee_id,
  };
}

export function Schedule({ isNew }: { isNew?: boolean }) {
  const { user } = useAuth();
  const canViewTeam = canViewTeamCalendars(user?.role || (user as any)?.system_role);
  const selfId = String(user?.employee_id || user?.employeeId || user?.id || "");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewType>("Month");
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(isNew || false);
  const [selectedDateForCreate, setSelectedDateForCreate] = useState<Date>(new Date());
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | null>(null);
  const [activeCategories, setActiveCategories] = useState<string[]>((["my_schedule", "work_anniversary", "birthday", "google_calendar", "google_holidays"]));
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounce(searchInput, 400);

  // Team calendars (admin/HR only): active users, multi-tick. Non-admin sees only self.
  const [teamUsers, setTeamUsers] = useState<{ id?: string; employee_id: string; name: string; email?: string; department?: string }[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [teamSearchInput, setTeamSearchInput] = useState("");
  const teamSearch = useDebounce(teamSearchInput, 350);

  // Resolve self to the team-list row (match by employee_id, mongo id, or email),
  // so the user's own entry is ticked by default even when login id != employee code.
  const selfEmployeeId = useMemo(() => {
    if (teamUsers.length === 0) return "";
    const email = String(user?.email || "").toLowerCase();
    const hit =
      teamUsers.find((u) => u.employee_id === selfId) ||
      teamUsers.find((u) => u.id === selfId) ||
      (email ? teamUsers.find((u) => String(u.email || "").toLowerCase() === email) : undefined);
    return hit ? hit.employee_id : "";
  }, [teamUsers, selfId, user?.email]);

  useEffect(() => {
    const fallback = selfEmployeeId || selfId;
    if (fallback) setSelectedUserIds((prev) => (prev.length === 0 ? [fallback] : prev));
  }, [selfEmployeeId, selfId]);

  const fetchTeamUsers = useCallback(async () => {
    if (!canViewTeam) return;
    try {
      const params = teamSearch.trim() ? `?q=${encodeURIComponent(teamSearch.trim())}` : "";
      const res = await api.get<any[]>(`/schedule/team-users${params}`, { showErrorToast: false });
      setTeamUsers(Array.isArray(res) ? res : []);
    } catch {
      setTeamUsers([]);
    }
  }, [canViewTeam, teamSearch]);

  useEffect(() => {
    fetchTeamUsers();
  }, [fetchTeamUsers]);

  const toggleTeamUser = (employee_id: string) => {
    setSelectedUserIds((prev) => (prev.includes(employee_id) ? prev.filter((id) => id !== employee_id) : [...prev, employee_id]));
  };

  // Google connection state (per logged-in HRMS user -> their own Google account)
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState("");
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [showGoogleHelp, setShowGoogleHelp] = useState(false);
  const [googleConfig, setGoogleConfig] = useState<{ configured?: boolean; client_id_hint?: string; redirect_uri?: string; steps?: string[] } | null>(null);

  const openGoogleHelp = async () => {
    setShowGoogleHelp(true);
    try {
      const cfg = await api.get<any>("/schedule/google/config", { showErrorToast: false });
      setGoogleConfig(cfg);
    } catch {
      setGoogleConfig(null);
    }
  };

  const viewMode = view === "Month" ? "month" : view === "Week" ? "week" : "day";
  const referenceDate = format(currentDate, "yyyy-MM-dd");

  const fetchFeed = useCallback(async () => {
    // Admin/HR with zero ticked users -> empty board with hint
    if (canViewTeam && selectedUserIds.length === 0) {
      setEvents([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        reference_date: referenceDate,
        view_mode: viewMode,
      });
      if (activeCategories.length > 0 && activeCategories.length < CATEGORY_OPTIONS.length) {
        params.set("categories", activeCategories.join(","));
      }
      if (search.trim()) {
        params.set("q", search.trim());
      }
      // Admin/HR: union of ticked users (each user's own connected Google included).
      // Others: backend always scopes to self.
      if (canViewTeam && selectedUserIds.length > 0) {
        params.set("employee_ids", selectedUserIds.join(","));
      }
      const res = await api.get<any>(`/schedule/feed?${params.toString()}`, { showErrorToast: false });
      const list = Array.isArray(res?.events) ? res.events : [];
      setEvents(list.map(toUiEvent));
    } catch {
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, [referenceDate, viewMode, activeCategories, search, canViewTeam, selectedUserIds]);

  const fetchGoogleStatus = useCallback(async () => {
    try {
      const res = await api.get<{ is_connected?: boolean; google_email?: string }>("/schedule/google/status", { showErrorToast: false });
      setGoogleConnected(!!res?.is_connected);
      setGoogleEmail(res?.google_email || "");
    } catch {
      setGoogleConnected(false);
      setGoogleEmail("");
    }
  }, []);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  useEffect(() => {
    fetchGoogleStatus();
  }, [fetchGoogleStatus]);

  // Refresh when Google OAuth popup completes (backend postMessages + auto-closes)
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e?.data?.type === "hrms-google-connected") {
        toast.success(`Google connected${e.data.email ? `: ${e.data.email}` : ""}`);
        fetchGoogleStatus();
        fetchFeed();
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [fetchGoogleStatus, fetchFeed]);

  const handleGoogleCalendarLogin = async () => {
    try {
      setIsConnectingGoogle(true);
      const res = await api.get<{ auth_url?: string }>("/schedule/google/auth");
      if (res?.auth_url) {
        // Same-window redirect keeps popup-blockers away; OAuth callback auto-closes
        // and the page refires status on focus. Open in new tab for safety:
        window.open(res.auth_url, "_blank", "width=520,height=640");
        toast.info("Complete Google Sign-in in the opened window — your own account's calendar will sync.");
      } else {
        toast.info("Google OAuth is not configured on the backend server.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Google Calendar login could not be initiated.");
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  // Re-check status when user returns from the OAuth tab
  useEffect(() => {
    const onFocus = () => fetchGoogleStatus();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchGoogleStatus]);

  const handleGoogleDisconnect = async () => {
    try {
      await api.post("/schedule/google/disconnect", {});
      toast.success("Google Calendar disconnected.");
      setGoogleConnected(false);
      setGoogleEmail("");
      fetchFeed();
    } catch (err: any) {
      toast.error(err?.message || "Could not disconnect Google Calendar.");
    }
  };

  const handleSaveEvent = async (payload: any) => {
    try {
      if (editingEvent) {
        await api.put(`/schedule/events/${editingEvent.id}`, payload);
        toast.success("Event updated.");
      } else {
        await api.post("/schedule/events", payload);
        toast.success("Event created.");
      }
      setIsCreateModalOpen(false);
      setEditingEvent(null);
      fetchFeed();
    } catch (err: any) {
      toast.error(err?.message || "Could not save event.");
    }
  };

  const handleDeleteEvent = async () => {
    if (!editingEvent) return;
    try {
      await api.delete(`/schedule/events/${editingEvent.id}`);
      toast.success("Event deleted.");
      setIsCreateModalOpen(false);
      setEditingEvent(null);
      fetchFeed();
    } catch (err: any) {
      toast.error(err?.message || "Could not delete event.");
    }
  };

  const openCreate = (d: Date) => {
    setEditingEvent(null);
    setSelectedDateForCreate(d);
    setIsCreateModalOpen(true);
  };

  const openEdit = (ev: ScheduleEvent) => {
    setEditingEvent(ev);
    setSelectedDateForCreate(new Date(`${ev.date}T00:00:00`));
    setIsCreateModalOpen(true);
  };

  const toggleCategory = (key: string) => {
    setActiveCategories((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const eventStyle = (color: string) =>
    color.startsWith("#") ? { backgroundColor: color } : undefined;
  const eventClass = (color: string) =>
    color.startsWith("#") ? "text-white" : color;

  // Date calculations
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const weekStart = startOfWeek(currentDate);
  const weekEnd = endOfWeek(currentDate);

  const monthDays = eachDayOfInterval({ start: startDate, end: endDate });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const next = () => {
    if (view === "Month") setCurrentDate(addMonths(currentDate, 1));
    else if (view === "Week") setCurrentDate(addWeeks(currentDate, 1));
    else if (view === "Day") setCurrentDate(addDays(currentDate, 1));
  };

  const prev = () => {
    if (view === "Month") setCurrentDate(subMonths(currentDate, 1));
    else if (view === "Week") setCurrentDate(subWeeks(currentDate, 1));
    else if (view === "Day") setCurrentDate(subDays(currentDate, 1));
  };

  const today = () => setCurrentDate(new Date());

  // Time slots for week view (8am to 8pm)
  const hours = Array.from({ length: 13 }, (_, i) => i + 8);

  const eventsByDay = useMemo(() => {
    const map: Record<string, ScheduleEvent[]> = {};
    for (const e of events) {
      if (!e.date) continue;
      (map[e.date] ||= []).push(e);
    }
    return map;
  }, [events]);

  const getEventsForDay = (dateStr: string) => eventsByDay[dateStr] || [];

  const renderEventChip = (event: ScheduleEvent, extra?: string) => (
    <div
      key={event.id}
      onClick={(e) => {
        e.stopPropagation();
        if (!event.id.startsWith("bday_") && !event.id.startsWith("anniv_") && !event.id.startsWith("gcal_")) {
          openEdit(event);
        }
      }}
      title={`${event.title}${event.startTime ? ` (${event.startTime}${event.endTime ? ` - ${event.endTime}` : ""})` : ""}${event.description ? `\n${event.description}` : ""}`}
      style={eventStyle(event.color)}
      className={cn(
        "text-[10px] px-1.5 py-0.5 rounded truncate text-white font-medium shadow-sm cursor-pointer",
        eventClass(event.color),
        extra
      )}
    >
      {event.startTime} {event.title}
    </div>
  );

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)] bg-white rounded-2xl border border-border overflow-hidden shadow-sm">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border gap-3">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary rounded-lg text-primary-foreground">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">Calendar</h1>
          </div>

          <div className="h-6 w-px bg-slate-200 mx-1 sm:mx-2 hidden min-[400px]:block"></div>

          <button onClick={today} className="px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-semibold border border-border rounded-md hover:bg-muted/50 transition-colors">
            Today
          </button>

          <div className="flex items-center gap-1">
            <button onClick={prev} className="p-1.5 hover:bg-muted rounded-full transition-colors">
              <ChevronLeft className="w-5 h-5 text-foreground/80" />
            </button>
            <button onClick={next} className="p-1.5 hover:bg-muted rounded-full transition-colors">
              <ChevronRight className="w-5 h-5 text-foreground/80" />
            </button>
          </div>

          <h2 className="text-base sm:text-xl font-medium text-foreground/80 min-w-fit">
            {view === "Day" ? format(currentDate, "dd/MM/yyyy") : format(currentDate, "MMMM yyyy")}
          </h2>
          <button onClick={fetchFeed} title="Refresh" className="p-1.5 hover:bg-muted rounded-full transition-colors">
            <RefreshCw className={cn("w-4 h-4 text-muted-foreground", isLoading && "animate-spin")} />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 justify-between sm:justify-end w-full md:w-auto">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search events…"
              className="h-8 w-40 sm:w-48 rounded-lg border border-border bg-white pl-8 pr-2 text-xs outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
            {(["Month", "Week", "Day"] as ViewType[]).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "px-2.5 sm:px-3 py-1 text-xs sm:text-sm font-medium rounded-md transition-all",
                  view === v ? "bg-white text-primary shadow-sm" : "text-foreground/80 hover:text-foreground"
                )}
              >
                {v}
              </button>
            ))}
          </div>

          {googleConnected ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700" title={googleEmail || "Google connected"}>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="hidden sm:inline max-w-[140px] truncate">{googleEmail || "Google Connected"}</span>
              <button onClick={handleGoogleDisconnect} title="Disconnect Google Calendar" className="p-0.5 hover:text-rose-600">
                <Link2Off className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleGoogleCalendarLogin}
                disabled={isConnectingGoogle}
                title="Sign in with Google — syncs YOUR Google account's calendar"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg border border-border bg-white hover:bg-muted text-foreground transition-all shadow-sm"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span className="hidden sm:inline">Sign in with Google</span>
              </button>
              <button
                type="button"
                onClick={openGoogleHelp}
                title="Google setup help — if sign-in is blocked"
                className="px-1.5 py-1.5 text-xs font-bold rounded-lg border border-border bg-white hover:bg-muted text-muted-foreground"
              >
                ?
              </button>
            </div>
          )}

          <button
            onClick={() => openCreate(currentDate)}
            className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 bg-primary text-primary-foreground text-xs sm:text-sm font-semibold rounded-lg hover:bg-primary transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Create
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 border-r border-border p-4 hidden lg:flex flex-col gap-6 overflow-y-auto hide-scrollbar bg-muted/50/50">
          <div className="-ml-2">
            <MiniCalendar
              mode="single"
              selected={currentDate}
              onSelect={(date) => date && setCurrentDate(date)}
              month={currentDate}
              onMonthChange={setCurrentDate}
              className="bg-transparent"
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between group cursor-pointer">
              <h3 className="text-sm font-bold text-foreground">My Calendars</h3>
              <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground/80" />
            </div>
            <div className="space-y-2.5">
              {CATEGORY_OPTIONS.map((c) => (
                <label key={c.key} className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={activeCategories.includes(c.key)}
                    onChange={() => toggleCategory(c.key)}
                    className="w-4 h-4 rounded text-primary focus:ring-primary/20 border-border"
                  />
                  <span className="text-sm font-medium text-foreground/80 group-hover:text-foreground">
                    {c.label}
                    {c.key === "google_calendar" && googleConnected && googleEmail && (
                      <span className="block text-[10px] text-muted-foreground truncate max-w-[160px]">{googleEmail}</span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {canViewTeam && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground">Team Calendars</h3>
                <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                  {teamUsers.length} users · {selectedUserIds.length} selected
                </span>
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={teamSearchInput}
                  onChange={(e) => setTeamSearchInput(e.target.value)}
                  placeholder="Search users…"
                  className="h-8 w-full rounded-lg border border-border bg-white pl-8 pr-2 text-xs outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedUserIds(teamUsers.map((u) => u.employee_id))}
                  className="text-[11px] font-semibold text-primary hover:underline"
                >
                  Select all
                </button>
                <span className="text-muted-foreground">·</span>
                <button
                  onClick={() => setSelectedUserIds(selfEmployeeId || selfId ? [selfEmployeeId || selfId] : [])}
                  className="text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:underline"
                >
                  Only me
                </button>
              </div>
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
                {teamUsers.length === 0 && (
                  <p className="text-[11px] text-muted-foreground">No active users found.</p>
                )}
                {teamUsers.map((u) => (
                  <label key={u.employee_id} className="flex items-center gap-2.5 cursor-pointer group rounded-lg px-1.5 py-1 hover:bg-muted/60">
                    <input
                      type="checkbox"
                      checked={selectedUserIds.includes(u.employee_id)}
                      onChange={() => toggleTeamUser(u.employee_id)}
                      className="w-4 h-4 rounded text-primary focus:ring-primary/20 border-border shrink-0"
                    />
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold text-foreground/90 truncate group-hover:text-foreground">
                          {u.name}
                          {u.employee_id === (selfEmployeeId || selfId) && <span className="text-muted-foreground font-normal"> (you)</span>}
                        </span>
                      {u.department && (
                        <span className="block text-[10px] text-muted-foreground truncate">{u.department}</span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Main Calendar Area */}
        <main className="flex-1 overflow-y-auto flex flex-col bg-white min-w-0">
          {isLoading && (
            <div className="px-4 py-1.5 text-[11px] text-muted-foreground border-b border-border bg-muted/30">
              Loading schedule…
            </div>
          )}
          {view === "Month" && (
            <div className="flex-1 flex flex-col min-h-[600px] overflow-x-auto min-w-0">
              <div className="min-w-[600px] flex-1 flex flex-col">
                {/* Days Header */}
                <div className="grid grid-cols-7 border-b border-border">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="py-2 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Month Grid */}
                <div className="flex-1 grid grid-cols-7 border-l border-border auto-rows-fr">
                  {monthDays.map((day) => {
                    const dateStr = format(day, "yyyy-MM-dd");
                    const dayEvents = getEventsForDay(dateStr);

                    return (
                      <div
                        key={day.toString()}
                        className={cn(
                          "p-1 border-r border-b border-border transition-colors hover:bg-muted/50 cursor-pointer overflow-hidden",
                          !isSameMonth(day, monthStart) && "bg-muted/50/50 text-muted-foreground"
                        )}
                        onClick={() => {
                          setCurrentDate(day);
                          setView("Day");
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          openCreate(day);
                        }}
                      >
                        <div className="flex justify-center mb-1">
                          <span className={cn(
                            "w-7 h-7 flex items-center justify-center text-sm font-medium rounded-full",
                            isToday(day) ? "bg-primary text-primary-foreground" :
                              isSameDay(day, currentDate) ? "bg-primary/10 text-primary" :
                                "text-foreground/80"
                          )}>
                            {format(day, "d")}
                          </span>
                        </div>

                        <div className="space-y-1 overflow-y-auto max-h-[80px] hide-scrollbar px-1">
                          {dayEvents.map(event => renderEventChip(event))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {view === "Week" && (
            <div className="flex-1 flex flex-col min-h-[600px] overflow-x-auto min-w-0 relative">
              <div className="min-w-[600px] flex-1 flex flex-col">
                {/* Week Header */}
                <div className="flex border-b border-border sticky top-0 bg-white z-20 ml-16">
                  {weekDays.map(day => (
                    <div key={day.toString()} className="flex-1 flex flex-col items-center justify-center py-3 border-l border-border">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">{format(day, "EEE")}</span>
                      <span className={cn(
                        "text-xl flex items-center justify-center rounded-full w-10 h-10 transition-colors",
                        isToday(day) ? "bg-primary text-primary-foreground font-bold" :
                          isSameDay(day, currentDate) ? "bg-primary/10 text-primary font-bold" :
                            "text-foreground font-medium"
                      )}>
                        {format(day, "d")}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Time Grid */}
                <div className="flex-1 overflow-y-auto relative bg-muted/50/30">
                  <div className="flex min-h-[960px]"> {/* 12 hours * 80px */}
                    {/* Time Axis */}
                    <div className="w-16 flex-shrink-0 border-r border-border bg-white relative z-10">
                      {hours.map(hour => (
                        <div key={hour} className="h-20 relative border-b border-transparent">
                          <span className="absolute -top-2.5 right-3 text-[11px] font-semibold text-muted-foreground bg-white px-1">
                            {hour > 12 ? `${hour - 12} PM` : hour === 12 ? "12 PM" : `${hour} AM`}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Day Columns */}
                    <div className="flex-1 flex relative">
                      {weekDays.map(day => {
                        const dateStr = format(day, "yyyy-MM-dd");
                        const dayEvents = getEventsForDay(dateStr);

                        return (
                          <div key={day.toString()} className="flex-1 border-l border-border relative min-w-0">
                            {/* Grid Lines */}
                            {hours.map(hour => (
                              <div key={hour} className="h-20 border-b border-border/60 w-full absolute left-0 right-0 pointer-events-none" style={{ top: `${(hour - 8) * 80}px` }}></div>
                            ))}

                            {/* Events */}
                            {dayEvents.map(event => {
                              if (!event.startTime || !event.endTime) return null;
                              const startParts = event.startTime.split(':').map(Number);
                              const endParts = event.endTime.split(':').map(Number);
                              const startH = startParts[0] || 0;
                              const startM = startParts[1] || 0;
                              const endH = endParts[0] || 0;
                              const endM = endParts[1] || 0;

                              const top = ((startH - 8) + (startM / 60)) * 80;
                              const height = (((endH - startH) + ((endM - startM) / 60))) * 80;

                              if (startH < 8) return null; // skip events outside view for simplicity

                              return (
                                <div
                                  key={event.id}
                                  onClick={() => {
                                    if (!event.id.startsWith("bday_") && !event.id.startsWith("anniv_") && !event.id.startsWith("gcal_")) {
                                      openEdit(event);
                                    }
                                  }}
                                  style={{ top: `${top}px`, height: `${height}px`, ...eventStyle(event.color) }}
                                  className={cn(
                                    "absolute left-1 right-1 rounded-md p-2 text-white shadow-sm overflow-hidden border border-white/20 transition-all hover:brightness-110 cursor-pointer z-10",
                                    eventClass(event.color)
                                  )}
                                >
                                  <div className="text-xs font-bold truncate leading-tight">{event.title}</div>
                                  <div className="text-[10px] opacity-90 truncate mt-0.5">{event.startTime} - {event.endTime}</div>
                                </div>
                              );
                            })}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {view === "Day" && (
            <div className="flex-1 flex flex-col min-h-[600px] relative">
              {/* Day Header */}
              <div className="flex border-b border-border sticky top-0 bg-white z-20 ml-16">
                {[currentDate].map(day => (
                  <div key={day.toString()} className="flex-1 flex flex-col items-center justify-center py-3 border-l border-border bg-muted/20">
                    <span className="text-xs font-semibold text-primary uppercase tracking-widest mb-1">{format(day, "EEEE")}</span>
                    <span className="text-2xl flex items-center justify-center rounded-full w-12 h-12 bg-primary text-primary-foreground font-black shadow-md">
                      {format(day, "d")}
                    </span>
                  </div>
                ))}
              </div>

              {/* Time Grid */}
              <div className="flex-1 overflow-y-auto relative bg-muted/50/30">
                <div className="flex min-h-[960px]">
                  {/* Time Axis */}
                  <div className="w-16 flex-shrink-0 border-r border-border bg-white relative z-10">
                    {hours.map(hour => (
                      <div key={hour} className="h-20 relative border-b border-transparent">
                        <span className="absolute -top-2.5 right-3 text-[11px] font-semibold text-muted-foreground bg-white px-1">
                          {hour > 12 ? `${hour - 12} PM` : hour === 12 ? "12 PM" : `${hour} AM`}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Day Column */}
                  <div className="flex-1 flex relative">
                    {[currentDate].map(day => {
                      const dateStr = format(day, "yyyy-MM-dd");
                      const dayEvents = getEventsForDay(dateStr);

                      return (
                        <div key={day.toString()} className="flex-1 border-l border-border relative min-w-0 bg-white">
                          {/* Grid Lines */}
                          {hours.map(hour => (
                            <div key={hour} className="h-20 border-b border-border/60 w-full absolute left-0 right-0 pointer-events-none" style={{ top: `${(hour - 8) * 80}px` }}></div>
                          ))}

                          {/* Events */}
                          {dayEvents.map(event => {
                            if (!event.startTime || !event.endTime) return null;
                            const startParts = event.startTime.split(':').map(Number);
                            const endParts = event.endTime.split(':').map(Number);
                            const startH = startParts[0] || 0;
                            const startM = startParts[1] || 0;
                            const endH = endParts[0] || 0;
                            const endM = endParts[1] || 0;

                            const top = ((startH - 8) + (startM / 60)) * 80;
                            const height = (((endH - startH) + ((endM - startM) / 60))) * 80;

                            if (startH < 8) return null; // skip events outside view

                            return (
                              <div
                                key={event.id}
                                onClick={() => {
                                  if (!event.id.startsWith("bday_") && !event.id.startsWith("anniv_") && !event.id.startsWith("gcal_")) {
                                    openEdit(event);
                                  }
                                }}
                                style={{ top: `${top}px`, height: `${height}px`, ...eventStyle(event.color) }}
                                className={cn(
                                  "absolute left-4 right-4 rounded-xl px-3 py-1.5 text-white shadow-md overflow-hidden border border-white/20 transition-all hover:scale-[1.02] hover:z-20 cursor-pointer z-10 flex flex-col justify-start",
                                  eventClass(event.color)
                                )}
                              >
                                <div className="text-sm font-bold truncate leading-tight mt-0.5 flex items-center gap-2">
                                  <span>{event.title}</span>
                                  {height <= 45 && <span className="text-[10px] font-normal opacity-80">{event.startTime}</span>}
                                </div>
                                {height > 45 && (
                                  <div className="text-xs opacity-90 font-medium truncate flex items-center gap-1 mt-0.5">
                                    <Clock className="w-3 h-3" /> {event.startTime} - {event.endTime}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {!isLoading && events.length === 0 && (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground">
              {canViewTeam && selectedUserIds.length === 0
                ? "Tick at least one user in Team Calendars to see their schedule."
                : <>No events in this view. Click <b>Create</b> or double-click a day to add one.</>}
            </div>
          )}
        </main>
      </div>

      <CreateEventModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingEvent(null);
        }}
        onSave={handleSaveEvent}
        onDelete={editingEvent ? handleDeleteEvent : undefined}
        selectedDate={selectedDateForCreate}
        initialEvent={editingEvent}
      />

      {showGoogleHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowGoogleHelp(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-sm">Google Sign-in blocked (403 access_denied)?</h3>
            <p className="text-xs text-muted-foreground">
              Google blocks sign-in while the OAuth app is in <b>Testing</b> mode and your Gmail is not added as a test user.
              Fix it once in Google Cloud Console:
            </p>
            <ol className="text-xs text-foreground space-y-1.5 list-decimal list-inside">
              <li><b>OAuth consent screen → Test users → Add users</b> — add every Gmail that signs in.</li>
              <li><b>Credentials → OAuth client → Authorized redirect URIs</b> — add exactly:<br />
                <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded break-all">{googleConfig?.redirect_uri || "loading…"}</code>
              </li>
              <li><b>Library</b> — enable <b>Google Calendar API</b>.</li>
            </ol>
            {!googleConfig?.configured && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">
                Backend keys missing — set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET in .env
                {googleConfig?.client_id_hint ? ` (current: ${googleConfig.client_id_hint})` : ""}.
              </p>
            )}
            <div className="flex justify-end">
              <button onClick={() => setShowGoogleHelp(false)} className="px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground">
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
