import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Clock, AlignLeft, Calendar, Users, Type, Trash2, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DatePicker } from "@/components/ui/date-picker";
import { toast } from "@/lib/toast";
import { api } from "@/lib/api";
import { useDebounce } from "@/hooks/useDebounce";
import type { ScheduleEvent } from "./Schedule";

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: any) => void;
  onDelete?: () => void;
  selectedDate?: Date;
  initialEvent?: ScheduleEvent | null;
}

interface EmpOption {
  id: string;
  employee_id: string;
  name: string;
  department?: string;
  designation?: string;
}

const EVENT_TYPES = ["Meeting", "Focused Work", "Client Call", "Task", "Standup", "Sync"];

const COLORS = [
  { name: "Blue", class: "bg-blue-500" },
  { name: "Emerald", class: "bg-emerald-500" },
  { name: "Purple", class: "bg-purple-500" },
  { name: "Rose", class: "bg-rose-500" },
  { name: "Amber", class: "bg-amber-500" },
];

export function CreateEventModal({ isOpen, onClose, onSave, onDelete, selectedDate = new Date(), initialEvent }: CreateEventModalProps) {
  const isEdit = !!initialEvent;
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(selectedDate.toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [eventType, setEventType] = useState("Meeting");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("bg-blue-500");

  // Attendees (individual, dynamic from /schedule/employees/search)
  const [attendeeQuery, setAttendeeQuery] = useState("");
  const debouncedQuery = useDebounce(attendeeQuery, 350);
  const [attendeeResults, setAttendeeResults] = useState<EmpOption[]>([]);
  const [attendees, setAttendees] = useState<EmpOption[]>([]);

  // Bulk add (dynamic from /schedule/bulk-options)
  const [bulkOptions, setBulkOptions] = useState<{ departments: any[]; designations: any[]; roles: string[] }>({ departments: [], designations: [], roles: [] });
  const [bulkDept, setBulkDept] = useState("");
  const [bulkDesig, setBulkDesig] = useState("");
  const [bulkRole, setBulkRole] = useState("");

  // Free slots suggestion
  const [freeSlots, setFreeSlots] = useState<any[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);

  // Prefill on edit / reset on open
  useEffect(() => {
    if (!isOpen) return;
    if (initialEvent) {
      setTitle(initialEvent.title || "");
      setDate(initialEvent.date || selectedDate.toISOString().split('T')[0]);
      setStartTime(initialEvent.startTime || "09:00");
      setEndTime(initialEvent.endTime || "10:00");
      setEventType(initialEvent.type || "Meeting");
      setDescription(initialEvent.description || "");
      setColor(initialEvent.color || "bg-blue-500");
      setAttendees(
        (initialEvent.attendees || []).map((a) => ({ id: a, employee_id: a, name: a }))
      );
    } else {
      setTitle("");
      setDate(selectedDate.toISOString().split('T')[0]);
      setStartTime("09:00");
      setEndTime("10:00");
      setEventType("Meeting");
      setDescription("");
      setColor("bg-blue-500");
      setAttendees([]);
    }
    setAttendeeQuery("");
    setAttendeeResults([]);
    setBulkDept("");
    setBulkDesig("");
    setBulkRole("");
    setFreeSlots([]);
  }, [isOpen, initialEvent, selectedDate]);

  // Load bulk dropdown options once per open
  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const res = await api.get<any>("/schedule/bulk-options", { showErrorToast: false });
        setBulkOptions({
          departments: res?.departments || [],
          designations: res?.designations || [],
          roles: res?.roles || [],
        });
      } catch {
        setBulkOptions({ departments: [], designations: [], roles: [] });
      }
    })();
  }, [isOpen]);

  // Employee search for attendees
  useEffect(() => {
    if (!isOpen || !debouncedQuery.trim()) {
      setAttendeeResults([]);
      return;
    }
    (async () => {
      try {
        const res = await api.get<EmpOption[]>(`/schedule/employees/search?q=${encodeURIComponent(debouncedQuery.trim())}&limit=10`, { showErrorToast: false });
        const picked = new Set(attendees.map((a) => a.employee_id));
        setAttendeeResults((Array.isArray(res) ? res : []).filter((e) => !picked.has(e.employee_id)));
      } catch {
        setAttendeeResults([]);
      }
    })();
  }, [debouncedQuery, isOpen]);

  const addAttendee = (emp: EmpOption) => {
    setAttendees((prev) => [...prev, emp]);
    setAttendeeResults((prev) => prev.filter((e) => e.employee_id !== emp.employee_id));
    setAttendeeQuery("");
  };

  const removeAttendee = (employee_id: string) => {
    setAttendees((prev) => prev.filter((a) => a.employee_id !== employee_id));
  };

  const checkFreeSlots = async () => {
    if (attendees.length === 0) {
      toast.info("Add at least one attendee to check common free slots.");
      return;
    }
    if (!date) {
      toast.error("Pick a date first.");
      return;
    }
    setIsLoadingSlots(true);
    try {
      const res = await api.post<any>("/schedule/available-slots", {
        employee_ids: attendees.map((a) => a.employee_id),
        date,
        slot_duration_minutes: 30,
      }, { showErrorToast: false });
      setFreeSlots(res?.available_slots || []);
      if ((res?.available_slots || []).length === 0) {
        toast.info("No common free slots on this date.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Could not fetch free slots.");
    } finally {
      setIsLoadingSlots(false);
    }
  };

  const attendeeIds = useMemo(() => attendees.map((a) => a.employee_id), [attendees]);

  const handleSave = () => {
    if (!title.trim()) {
      toast.error("Title is required.");
      return;
    }
    if (!date) {
      toast.error("Date is required.");
      return;
    }
    if (startTime >= endTime) {
      toast.error("End time must be after start time.");
      return;
    }
    const payload: any = {
      title: title.trim(),
      date,
      start_time: startTime,
      end_time: endTime,
      type: eventType,
      description: description.trim() || undefined,
      attendees: attendeeIds,
      color,
    };
    if (bulkDept || bulkDesig || bulkRole) {
      payload.bulk_add_filter = {
        ...(bulkDept ? { department: bulkDept } : {}),
        ...(bulkDesig ? { designation: bulkDesig } : {}),
        ...(bulkRole ? { role: bulkRole } : {}),
      };
    }
    onSave(payload);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100vw-16px)] sm:max-w-[520px] p-0 overflow-hidden border-none shadow-2xl rounded-2xl max-h-[90dvh] overflow-y-auto">
        <div className="bg-white flex flex-col">
          {/* Header */}
          <div className="pt-6 pb-2 border-b border-border/50 relative pr-12">
            <div className="px-6 flex gap-4">
              <div className="w-5 flex-shrink-0 pt-1"></div>
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  placeholder="Add title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-[22px] font-normal text-foreground placeholder:text-muted-foreground/70 border-none outline-none focus:ring-0 px-0 pb-1.5 bg-transparent"
                  autoFocus
                />
                <div className="flex gap-4 mt-1 flex-wrap">
                  {EVENT_TYPES.map((type) => (
                    <button
                      key={type}
                      onClick={() => setEventType(type)}
                      className={cn(
                        "text-sm font-medium pb-2 border-b-2 transition-colors",
                        eventType === type
                          ? "border-primary text-primary"
                          : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-t-md px-2 -ml-2"
                      )}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-5 pt-5">
            {/* Date and Time Row */}
            <div className="flex gap-4 group">
              <div className="w-5 pt-2 flex justify-center text-muted-foreground group-hover:text-foreground transition-colors">
                <Clock className="w-5 h-5" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <DatePicker
                    value={date}
                    onChange={(val) => setDate(val)}
                    className="w-auto h-8 px-2.5 py-1 text-[13px] bg-muted/40 hover:bg-muted border border-border/50 rounded-lg shrink-0"
                    placeholder="Select date"
                  />
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="flex h-8 rounded hover:bg-muted bg-transparent px-2 py-1 text-[13px] transition-colors border-none outline-none focus:ring-0 cursor-pointer"
                  />
                  <span className="text-muted-foreground text-sm">-</span>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="flex h-8 rounded hover:bg-muted bg-transparent px-2 py-1 text-[13px] transition-colors border-none outline-none focus:ring-0 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Attendees */}
            <div className="flex gap-4 items-start group">
              <div className="w-5 pt-2 flex justify-center text-muted-foreground group-hover:text-foreground transition-colors">
                <Type className="w-5 h-5" />
              </div>
              <div className="flex-1 space-y-2 min-w-0">
                <input
                  type="text"
                  placeholder="Add attendees — type a name, ID or email"
                  value={attendeeQuery}
                  onChange={(e) => setAttendeeQuery(e.target.value)}
                  className="w-full h-9 bg-transparent text-[13px] placeholder:text-muted-foreground border border-border/60 rounded-lg outline-none px-2.5 focus:ring-1 focus:ring-primary/30"
                />
                {attendeeResults.length > 0 && (
                  <div className="border border-border rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                    {attendeeResults.map((emp) => (
                      <button
                        key={emp.employee_id}
                        onClick={() => addAttendee(emp)}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-muted/60 flex items-center justify-between gap-2"
                      >
                        <span className="font-semibold truncate">{emp.name}</span>
                        <span className="text-muted-foreground truncate">{emp.employee_id}{emp.department ? ` · ${emp.department}` : ""}</span>
                      </button>
                    ))}
                  </div>
                )}
                {attendees.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {attendees.map((a) => (
                      <span key={a.employee_id} className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-[11px] font-semibold">
                        {a.name}
                        <button onClick={() => removeAttendee(a.employee_id)} className="hover:text-rose-600">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {/* Bulk add */}
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-medium">
                    Or invite a whole team (department / designation / role)
                  </summary>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                    <select value={bulkDept} onChange={(e) => setBulkDept(e.target.value)} className="h-8 text-xs border border-border rounded-lg px-2 bg-white">
                      <option value="">Department…</option>
                      {bulkOptions.departments.map((d: any) => (
                        <option key={d.id} value={d.name}>{d.name}</option>
                      ))}
                    </select>
                    <select value={bulkDesig} onChange={(e) => setBulkDesig(e.target.value)} className="h-8 text-xs border border-border rounded-lg px-2 bg-white">
                      <option value="">Designation…</option>
                      {bulkOptions.designations.map((d: any) => (
                        <option key={d.id} value={d.name}>{d.name}</option>
                      ))}
                    </select>
                    <select value={bulkRole} onChange={(e) => setBulkRole(e.target.value)} className="h-8 text-xs border border-border rounded-lg px-2 bg-white">
                      <option value="">Role…</option>
                      {bulkOptions.roles.map((r: string) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                </details>
                {/* Free slots */}
                <button
                  onClick={checkFreeSlots}
                  disabled={isLoadingSlots}
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {isLoadingSlots ? "Checking…" : "Suggest common free slots"}
                </button>
                {freeSlots.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {freeSlots.slice(0, 8).map((s: any) => (
                      <button
                        key={s.start_time}
                        onClick={() => {
                          setStartTime(s.start_time);
                          setEndTime(s.end_time);
                        }}
                        className="text-[11px] font-semibold px-2 py-1 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="flex gap-4 group items-start">
              <div className="w-5 pt-2 flex justify-center text-muted-foreground group-hover:text-foreground transition-colors">
                <AlignLeft className="w-5 h-5" />
              </div>
              <textarea
                placeholder="Add description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="flex-1 min-h-[60px] resize-none bg-transparent hover:bg-muted/50 text-[13px] placeholder:text-muted-foreground border border-transparent outline-none focus:ring-0 rounded-md p-2 -ml-2 transition-colors"
              />
            </div>

            {/* Calendar Selection & Color */}
            <div className="flex gap-4 items-center group">
              <div className="w-5 flex justify-center text-muted-foreground group-hover:text-foreground transition-colors">
                <Calendar className="w-5 h-5" />
              </div>
              <div className="flex-1 flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">My Schedule</span>

                <div className="flex items-center gap-1.5">
                  {COLORS.map(c => (
                    <button
                      key={c.name}
                      onClick={() => setColor(c.class)}
                      className={cn(
                        "w-5 h-5 rounded-full transition-transform",
                        c.class,
                        color === c.class ? "ring-2 ring-offset-2 ring-primary scale-110" : "hover:scale-110 opacity-80 hover:opacity-100"
                      )}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 flex justify-between gap-2">
            <div>
              {isEdit && onDelete && (
                <button
                  onClick={onDelete}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium hover:bg-muted rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!title.trim()}
                className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {isEdit ? "Update" : "Save"}
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
