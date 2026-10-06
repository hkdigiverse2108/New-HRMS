import React, { useState, useEffect } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
} from "date-fns";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  ExternalLink,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CollapsibleSection } from "./CollapsibleSection";
import { CreateEventModal } from "@/components/schedule/CreateEventModal";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";

interface EventItem {
  id?: string;
  title: string;
  date: string;
  startTime?: string;
  endTime?: string;
  color?: string;
}

export function CalendarWidget({
  setActive,
}: {
  setActive?: ((url: string) => void) | undefined;
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<EventItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Live feed for the visible month (HRMS events + birthdays + connected Google events)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ref = format(currentMonth, "yyyy-MM-dd");
        const res = await api.get<any>(`/schedule/feed?reference_date=${ref}&view_mode=month`, { showErrorToast: false });
        const list = Array.isArray(res?.events) ? res.events : [];
        if (!cancelled) {
          setEvents(list.map((raw: any) => ({
            id: String(raw.id || raw._id || ""),
            title: raw.title || "(No title)",
            date: String(raw.date || "").slice(0, 10),
            startTime: raw.start_time || undefined,
            endTime: raw.end_time || undefined,
            color: raw.color || "bg-emerald-500",
          })));
        }
      } catch {
        if (!cancelled) setEvents([]);
      }
    })();
    return () => { cancelled = true; };
  }, [currentMonth]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Filter events for selected date
  const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
  const dayEvents = events.filter((ev) => ev.date === selectedDateStr);

  const handleAddEvent = async (payload: any) => {
    try {
      const created = await api.post<any>("/schedule/events", payload);
      const raw = created || payload;
      setEvents((prev) => [
        ...prev,
        {
          id: String(raw.id || raw._id || Date.now()),
          title: raw.title || payload.title,
          date: String(raw.date || payload.date).slice(0, 10),
          startTime: raw.start_time || payload.start_time,
          endTime: raw.end_time || payload.end_time,
          color: raw.color || payload.color || "bg-emerald-500",
        },
      ]);
      setIsModalOpen(false);
      toast.success("Event added to schedule");
    } catch (err: any) {
      toast.error(err?.message || "Could not create event.");
    }
  };

  return (
    <div className="mb-12">
      <CollapsibleSection section="Section 13" title="Calendar & Events Schedule">
        <div className="bg-white border border-border/60 rounded-3xl p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-emerald-600" /> Company Calendar & Meetings
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Quick schedule overview, deadlines, and client meetings
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsModalOpen(true)}
                className="h-8 text-xs font-bold gap-1 rounded-xl"
              >
                <Plus className="w-3.5 h-3.5" /> Quick Event
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActive?.("/schedule")}
                className="h-8 text-xs font-bold gap-1 rounded-xl text-emerald-600 hover:text-emerald-700"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Full Calendar
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Mini Calendar Grid */}
            <div className="lg:col-span-7 bg-muted/20 border border-border/60 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-bold text-xs text-foreground">
                  {format(currentMonth, "MMMM yyyy")}
                </h4>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentMonth((prev) => subMonths(prev, 1))}
                    className="p-1 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCurrentMonth(new Date())}
                    className="text-[10px] font-bold px-2 py-0.5 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground"
                  >
                    Today
                  </button>
                  <button
                    onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}
                    className="p-1 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 text-center text-[10px] font-bold text-muted-foreground uppercase mb-2">
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                  <div key={d} className="py-1">
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar Days */}
              <div className="grid grid-cols-7 gap-1 text-xs">
                {daysInMonth.map((day) => {
                  const dayStr = format(day, "yyyy-MM-dd");
                  const hasEvents = events.some((e) => e.date === dayStr);
                  const isSelected = isSameDay(day, selectedDate);
                  const isCurrentDay = isToday(day);

                  return (
                    <button
                      key={dayStr}
                      type="button"
                      onClick={() => setSelectedDate(day)}
                      className={`relative flex flex-col items-center justify-center p-2 rounded-xl transition-all font-semibold ${
                        isSelected
                          ? "bg-emerald-600 text-white font-bold shadow-xs"
                          : isCurrentDay
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "hover:bg-muted/80 text-foreground"
                      }`}
                    >
                      <span>{format(day, "d")}</span>
                      {hasEvents && (
                        <span
                          className={`w-1 h-1 rounded-full mt-0.5 ${
                            isSelected ? "bg-white" : "bg-emerald-600"
                          }`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: Selected Date Event List */}
            <div className="lg:col-span-5 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <span className="text-xs font-bold text-foreground">
                    {format(selectedDate, "EEE, dd MMM yyyy")}
                  </span>
                  <Badge variant="secondary" className="text-[10px] font-bold h-5 px-2">
                    {dayEvents.length} Event{dayEvents.length !== 1 ? "s" : ""}
                  </Badge>
                </div>

                <div className="mt-3 space-y-2.5 max-h-56 overflow-y-auto pr-1">
                  {dayEvents.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground text-xs italic border border-dashed border-border rounded-xl">
                      No meetings or events on this date.
                    </div>
                  ) : (
                    dayEvents.map((ev, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-2xl bg-muted/40 border border-border/80 flex items-start gap-3"
                      >
                        <div
                          className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${
                            ev.color || "bg-emerald-500"
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-foreground leading-tight truncate">
                            {ev.title}
                          </p>
                          {(ev.startTime || ev.endTime) && (
                            <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {ev.startTime} - {ev.endTime}
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-border flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">
                  Synchronized with Google & Company Schedule
                </span>
              </div>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      <CreateEventModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleAddEvent}
        selectedDate={selectedDate}
      />
    </div>
  );
}
