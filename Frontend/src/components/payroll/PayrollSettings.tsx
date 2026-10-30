// @ts-nocheck
import { useState, useEffect } from "react";
import { cn, formatDate } from "@/lib/utils";
import { X, Plus, Trash2, Calendar, Save, Loader2 } from "lucide-react";
import { format, parseISO, getDaysInMonth, isSameMonth } from "date-fns";
import { useSettingsContext } from "./SettingsContext";
import { SearchableSelect } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Calendar as DayCalendar } from "@/components/ui/calendar";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";

// Helper Toggle Component for reusability
function Switch({ checked, onChange }: { checked?: boolean; onChange?: () => void }) {
  return (
    <div 
      className={cn(
        "w-11 h-6 rounded-full relative cursor-pointer transition-colors duration-200 ease-in-out",
        checked ? "bg-primary" : "bg-slate-200"
      )}
      onClick={onChange}
    >
      <div 
        className={cn(
          "absolute top-[2px] left-[2px] w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ease-in-out",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </div>
  );
}

// Pay multiplier for overtime on holidays / Sundays (stored as e.g. "1.5x"; payroll reads the number)
const HOLIDAY_OT_OPTIONS = [
  { label: "1x", value: "1x" },
  { label: "1.5x", value: "1.5x" },
  { label: "2x", value: "2x" },
];

/** Typed multiplier like "1.8", "1.8x" or "1.8 x" -> "1.8x" (between 0.5x and 10x), otherwise null. */
const toMultiplier = (input: string): string | null => {
  const match = input.trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*x?$/);
  const n = match ? Number(match[1]) : NaN;
  if (!Number.isFinite(n) || n < 0.5 || n > 10) {
    toast.error("Enter a multiplier between 0.5 and 10, e.g. 1.8x");
    return null;
  }
  return `${+n.toFixed(2)}x`;
};

/** Preset multipliers plus a saved custom one, in order. */
const holidayOtOptions = (current?: string) => {
  const options = [...HOLIDAY_OT_OPTIONS];
  if (current && !options.some(o => o.value === current)) options.push({ label: current, value: current });
  return options.sort((a, b) => parseFloat(a.value) - parseFloat(b.value));
};

export function PayrollSettings() {
  const { leaveTypes, addLeaveType, removeLeaveType } = useSettingsContext();
  const [newLeaveTypeInput, setNewLeaveTypeInput] = useState("");
  
  // Settings State
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());

  // Advanced Settings State
  const [settings, setSettings] = useState({
    paidLeave: "1.5",
    unpaidLeaveCap: "2",
    halfDayRule: "4 hours",
    carryForward: true,
    maxCarryForward: "12",
    lateGrace: "15",
    enableOT: true,
    standardHours: "9",
    otRate: "₹250",
    doubleOTAfter: "4 hrs",
    holidayOT: "2x",
    nextSalaryDate: ""
  });

  // Holiday management state
  const [holidays, setHolidays] = useState<Array<{id: string; name: string; date: string; type: "company" | "national" | "festival" | "optional"; isCompanyLeave: boolean}>>([]);
  const [isAddHolidayOpen, setIsAddHolidayOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load saved payroll settings
  useEffect(() => {
    api.get<any>("/payroll/settings", { showLoader: false, showErrorToast: false })
      .then(res => {
        if (!res) return;
        const { holidays: savedHolidays, _id, created_at, updated_at, ...rest } = res;
        setSettings(prev => {
          const next = { ...prev };
          Object.keys(prev).forEach(key => {
            if (rest[key] !== undefined && rest[key] !== null) next[key] = rest[key];
          });
          return next;
        });
        if (Array.isArray(savedHolidays)) {
          setHolidays([...savedHolidays].sort((a, b) => String(a.date).localeCompare(String(b.date))));
        }
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.put("/payroll/settings", { ...settings, holidays }, { showLoader: false });
      toast.success("Payroll settings saved");
    } catch {
      // error toast shown by api
    } finally {
      setIsSaving(false);
    }
  };
  const [newHolidayName, setNewHolidayName] = useState("");
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayType, setNewHolidayType] = useState<"company" | "national" | "festival" | "optional">("company");
  const [newHolidayIsCompanyLeave, setNewHolidayIsCompanyLeave] = useState(false);

  const addHoliday = () => {
    if (!newHolidayName.trim() || !newHolidayDate) return;
    setHolidays(prev => [...prev.filter(h => h.date !== newHolidayDate), {
      id: `hol-${Date.now()}`,
      name: newHolidayName.trim(),
      date: newHolidayDate,
      type: newHolidayType,
      isCompanyLeave: newHolidayIsCompanyLeave
    }].sort((a, b) => a.date.localeCompare(b.date)));
    setNewHolidayName("");
    setNewHolidayDate("");
    setNewHolidayType("company");
    setNewHolidayIsCompanyLeave(false);
    setIsAddHolidayOpen(false);
  };

  const toDateKey = (d: Date) => format(d, "yyyy-MM-dd");

  // Calendar selection: each selected day becomes a holiday entry, unselecting removes it
  const handleCalendarSelect = (dates?: Date[]) => {
    const selectedKeys = new Set((dates || []).map(toDateKey));
    setHolidays(prev => {
      const kept = prev.filter(h => selectedKeys.has(h.date));
      const existing = new Set(kept.map(h => h.date));
      const added = [...selectedKeys]
        .filter(key => !existing.has(key))
        .map(key => ({
          id: `hol-${key}-${Date.now()}`,
          name: "Leave",
          date: key,
          type: "company" as const,
          isCompanyLeave: true
        }));
      return [...kept, ...added].sort((a, b) => a.date.localeCompare(b.date));
    });
  };

  const updateHolidayName = (id: string, name: string) => {
    setHolidays(prev => prev.map(h => h.id === id ? { ...h, name } : h));
  };

  const removeHoliday = (id: string) => {
    setHolidays(prev => prev.filter(h => h.id !== id));
  };

  const companyLeaveCount = holidays.filter(h => h.isCompanyLeave).length;
  const totalHolidays = holidays.length;

  const holidayDates = holidays.map(h => parseISO(h.date));
  const daysInMonth = getDaysInMonth(calendarMonth);
  const monthOffDays = holidayDates.filter(d => isSameMonth(d, calendarMonth)).length;
  const monthWorkingDays = daysInMonth - monthOffDays;

  // Add Holiday Modal
  const AddHolidayModal = () => (
    <Dialog open={isAddHolidayOpen} onOpenChange={setIsAddHolidayOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Add New Holiday</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">Enter holiday details</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label className="text-sm font-medium">Holiday Name</Label>
            <Input value={newHolidayName} onChange={e => setNewHolidayName(e.target.value)} placeholder="e.g., Diwali, Christmas, Foundation Day" />
          </div>
          <div className="grid gap-2">
            <Label className="text-sm font-medium">Date</Label>
            <DatePicker value={newHolidayDate} onChange={val => setNewHolidayDate(val)} placeholder="Select date" className="w-full" />
          </div>
          <div className="grid gap-2">
            <Label className="text-sm font-medium">Type</Label>
            <Select value={newHolidayType} onValueChange={setNewHolidayType}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="company">Company Holiday</SelectItem>
                <SelectItem value="national">National Holiday</SelectItem>
                <SelectItem value="festival">Festival Holiday</SelectItem>
                <SelectItem value="optional">Optional Holiday</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={newHolidayIsCompanyLeave} onCheckedChange={setNewHolidayIsCompanyLeave} />
            <Label className="text-sm font-medium">Mark as Company Leave (excluded from attendance/leave calculations)</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsAddHolidayOpen(false)}>Cancel</Button>
          <Button onClick={addHoliday} disabled={!newHolidayName.trim() || !newHolidayDate}>Add Holiday</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <div>
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full min-w-0 max-w-[1400px]">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Payroll Settings</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground/80">Company-wide payroll rules applied to every processing cycle</p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center justify-center gap-2 px-5 h-[40px] bg-primary text-primary-foreground text-[13px] font-semibold rounded-xl shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-60 shrink-0"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {isSaving ? "Saving..." : "Save Settings"}
        </button>
      </div>

      {/* Salary & Attendance */}
      <section className="mt-8">
        <div className="mb-4">
          <h2 className="text-[13px] font-bold uppercase tracking-wider text-muted-foreground">Salary & Attendance</h2>
          <p className="text-[12px] text-muted-foreground/80 mt-0.5">Working days, holidays, late arrival grace and overtime pay</p>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
            {/* Card 1: Working Days & Holidays */}
            <div className="rounded-[16px] border border-border/60 bg-white p-4 sm:p-6 shadow-[0_2px_8px_rgba(0,0,0,0.02)] xl:col-span-2 min-w-0">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 xl:gap-8">
                {/* Working Days Per Month */}
                <div className="min-w-0">
                  <h3 className="text-[13px] font-semibold text-foreground">Working Days Per Month</h3>
                  <p className="text-[12px] text-muted-foreground/80 mt-0.5 mb-4">Select leave / off days on the calendar — they are added to the holiday list</p>

                  <div className="flex flex-col sm:flex-row xl:flex-col 2xl:flex-row gap-4 sm:gap-5 items-start">
                    <DayCalendar
                      mode="multiple"
                      selected={holidayDates}
                      onSelect={handleCalendarSelect}
                      month={calendarMonth}
                      onMonthChange={setCalendarMonth}
                      showOutsideDays={false}
                      className="rounded-xl border border-border/80 bg-white shadow-sm shrink-0 max-w-full !w-full sm:!w-fit [--cell-size:clamp(1.75rem,9.5vw,2.5rem)] sm:[--cell-size:2rem]"
                    />

                    <div className="flex-1 w-full min-w-0 space-y-3">
                      <div className="rounded-xl border border-primary/30 bg-[#E8F5F1] p-4">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Working days · {format(calendarMonth, "MMMM yyyy")}</p>
                        <p className="text-3xl font-bold text-primary mt-1">{monthWorkingDays}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-border/80 p-3">
                          <p className="text-[11px] font-semibold text-muted-foreground">Total days</p>
                          <p className="text-lg font-bold text-foreground">{daysInMonth}</p>
                        </div>
                        <div className="rounded-xl border border-border/80 p-3">
                          <p className="text-[11px] font-semibold text-muted-foreground">Leave / off days</p>
                          <p className="text-lg font-bold text-rose-500">{monthOffDays}</p>
                        </div>
                      </div>
                      <div>
                        <label className="text-[12px] font-semibold text-muted-foreground mb-2 block">Next salary date</label>
                        <DatePicker
                          value={settings.nextSalaryDate}
                          onChange={(val) => setSettings({...settings, nextSalaryDate: val})}
                          placeholder="Select salary date"
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Holiday Calendar */}
                <div className="min-w-0 border-t border-border/40 pt-6 xl:border-t-0 xl:pt-0 xl:border-l xl:pl-8">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 mb-4">
                    <div className="min-w-0">
                      <h3 className="text-[13px] font-semibold text-foreground">Holiday Calendar</h3>
                      <p className="text-[12px] text-muted-foreground/80 mt-0.5">Holidays treated as paid non-working days</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-3 py-1 bg-[#E8F5F1] text-primary text-[12px] font-bold rounded-full whitespace-nowrap">Total: {totalHolidays}</span>
                      <button 
                        onClick={() => setIsAddHolidayOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-colors whitespace-nowrap"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add
                      </button>
                    </div>
                  </div>
                  <div className="space-y-3 max-h-80 sm:max-h-96 overflow-y-auto pr-1">
                    {holidays.length === 0 ? (
                      <p className="text-[13px] text-muted-foreground/60 text-center py-8 border border-dashed border-border/40 rounded-xl">No holidays added yet. Click "Add" to create one.</p>
                    ) : (
                      holidays.map(h => (
                        <div key={h.id} className="flex items-center justify-between gap-3 p-3.5 border border-border/80 rounded-xl bg-white">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="flex flex-col flex-1 min-w-0">
                              <input
                                type="text"
                                value={h.name}
                                onChange={(e) => updateHolidayName(h.id, e.target.value)}
                                placeholder="Enter reason"
                                title="Click to edit reason"
                                className="w-full text-[14px] font-semibold text-foreground bg-transparent rounded-md px-1 -mx-1 border border-transparent hover:border-border/80 focus:border-emerald-500 outline-none"
                              />
                              <span className="text-[12px] text-muted-foreground">{formatDate(parseISO(h.date))} • {h.type}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => removeHoliday(h.id)}
                              className="p-1 text-muted-foreground hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-colors"
                              title="Delete holiday"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="mt-4 pt-4 border-t border-border/40 flex items-center justify-between">
                    <span className="text-[13px] font-medium text-muted-foreground">Company Leave Days: {companyLeaveCount}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Late Coming */}
            <div className="rounded-[16px] border border-border/60 bg-white p-4 sm:p-6 shadow-[0_2px_8px_rgba(0,0,0,0.02)] min-w-0">
              <div className="mb-5">
                <h2 className="text-[15px] font-bold text-foreground">Late Coming</h2>
                <p className="text-[13px] text-muted-foreground/80 mt-1">Grace period before an arrival is marked late</p>
              </div>
              <div className="h-px w-full bg-border/40 mb-6" />

              <div className="grid grid-cols-1 gap-5">
                <div>
                  <label className="text-[12px] font-semibold text-muted-foreground mb-2 block">Late coming grace (minutes)</label>
                  <input type="text" value={settings.lateGrace} onChange={(e) => setSettings({...settings, lateGrace: e.target.value})} className="w-full rounded-[10px] border border-border/80 p-2.5 text-[13px] font-medium text-foreground/80 outline-none focus:border-emerald-500 bg-white shadow-sm" />
                </div>
              </div>
            </div>

            {/* Card 3: Overtime */}
            <div className="rounded-[16px] border border-border/60 bg-white p-4 sm:p-6 shadow-[0_2px_8px_rgba(0,0,0,0.02)] min-w-0">
              <div className="mb-5">
                <h2 className="text-[15px] font-bold text-foreground">Overtime</h2>
                <p className="text-[13px] text-muted-foreground/80 mt-1">Hours worked beyond the standard day are paid as OT</p>
              </div>
              <div className="h-px w-full bg-border/40 mb-6" />

              <div className="flex items-center justify-between p-4 border border-border/80 rounded-xl mb-6">
                <div>
                  <p className="text-[14px] font-semibold text-foreground">Enable Overtime</p>
                  <p className="text-[12px] text-muted-foreground mt-0.5">OT paid with monthly payroll</p>
                </div>
                <Switch checked={settings.enableOT} onChange={() => setSettings({...settings, enableOT: !settings.enableOT})} />
              </div>
            
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[12px] font-semibold text-muted-foreground mb-2 block">Standard work hours / day</label>
                  <input type="text" value={settings.standardHours} onChange={(e) => setSettings({...settings, standardHours: e.target.value})} className="w-full rounded-[10px] border border-border/80 p-2.5 text-[13px] font-medium text-foreground/80 outline-none focus:border-emerald-500 bg-white shadow-sm" />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-muted-foreground mb-2 block">OT rate / hour</label>
                  <input type="text" value={settings.otRate} onChange={(e) => setSettings({...settings, otRate: e.target.value})} className="w-full rounded-[10px] border border-border/80 p-2.5 text-[13px] font-medium text-foreground/80 outline-none focus:border-emerald-500 bg-white shadow-sm" />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-muted-foreground mb-2 block">Double OT after</label>
                  <input type="text" value={settings.doubleOTAfter} onChange={(e) => setSettings({...settings, doubleOTAfter: e.target.value})} className="w-full rounded-[10px] border border-border/80 p-2.5 text-[13px] font-medium text-foreground/80 outline-none focus:border-emerald-500 bg-white shadow-sm" />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-muted-foreground mb-2 block">Holiday OT multiplier</label>
                  <SearchableSelect
                    value={settings.holidayOT}
                    onChange={(val) => setSettings({...settings, holidayOT: val})}
                    options={holidayOtOptions(settings.holidayOT)}
                    onCreate={toMultiplier}
                    placeholder="Select or type"
                    className="w-full h-[42px] rounded-[10px] border border-border/80 p-2.5 text-[13px] font-medium text-foreground/80 outline-none focus:border-emerald-500 bg-white shadow-sm"
                  />
                </div>
              </div>
            </div>
        </div>
      </section>

      {/* Leave */}
      <section className="mt-8">
        <div className="mb-4">
          <h2 className="text-[13px] font-bold uppercase tracking-wider text-muted-foreground">Leave</h2>
          <p className="text-[12px] text-muted-foreground/80 mt-0.5">Leave entitlements and leave types</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Card 4: Leave Policy */}
            <div className="rounded-[16px] border border-border/60 bg-white p-4 sm:p-6 shadow-[0_2px_8px_rgba(0,0,0,0.02)] min-w-0">
              <div className="mb-5">
                <h2 className="text-[15px] font-bold text-foreground">Leave Policy</h2>
                <p className="text-[13px] text-muted-foreground/80 mt-1">Monthly paid, unpaid, half-day, and carry forward rules</p>
              </div>
              <div className="h-px w-full bg-border/40 mb-6" />
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="text-[12px] font-semibold text-muted-foreground mb-2 block">Paid leave / month</label>
                  <input type="text" value={settings.paidLeave} onChange={(e) => setSettings({...settings, paidLeave: e.target.value})} className="w-full rounded-[10px] border border-border/80 p-2.5 text-[13px] font-medium text-foreground/80 outline-none focus:border-emerald-500 bg-white shadow-sm" />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-muted-foreground mb-2 block">Unpaid leave cap / month</label>
                  <input type="text" value={settings.unpaidLeaveCap} onChange={(e) => setSettings({...settings, unpaidLeaveCap: e.target.value})} className="w-full rounded-[10px] border border-border/80 p-2.5 text-[13px] font-medium text-foreground/80 outline-none focus:border-emerald-500 bg-white shadow-sm" />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-muted-foreground mb-2 block">Half day rule</label>
                  <SearchableSelect
                    value={settings.halfDayRule}
                    onChange={(val) => setSettings({...settings, halfDayRule: val})}
                    options={[{ label: "4 hours", value: "4 hours" }]}
                    className="w-full h-[42px] rounded-[10px] border border-border/80 p-2.5 text-[13px] font-medium text-foreground/80 outline-none focus:border-emerald-500 bg-white shadow-sm"
                  />
                </div>
              </div>

              <div className={`flex items-center justify-between p-4 border border-border/80 rounded-xl ${settings.carryForward ? "mb-4" : ""}`}>
                <div>
                  <p className="text-[14px] font-semibold text-foreground">Carry Forward Leave</p>
                  <p className="text-[12px] text-muted-foreground mt-0.5">Unused paid leaves move to next month</p>
                </div>
                <Switch checked={settings.carryForward} onChange={() => setSettings({...settings, carryForward: !settings.carryForward})} />
              </div>

              {settings.carryForward && (
                <div>
                  <label className="text-[12px] font-semibold text-muted-foreground mb-2 block">Maximum carry forward days</label>
                  <input type="text" value={settings.maxCarryForward} onChange={(e) => setSettings({...settings, maxCarryForward: e.target.value})} className="w-full rounded-[10px] border border-border/80 p-2.5 text-[13px] font-medium text-foreground/80 outline-none focus:border-emerald-500 bg-white shadow-sm" />
                </div>
              )}
            </div>

            {/* Card 5: Leave Types */}
            <div className="rounded-[16px] border border-border/60 bg-white p-4 sm:p-6 shadow-[0_2px_8px_rgba(0,0,0,0.02)] min-w-0">
              <div className="mb-5">
                <h2 className="text-[15px] font-bold text-foreground">Leave Types</h2>
                <p className="text-[13px] text-muted-foreground/80 mt-1">Configure available leave types for employees</p>
              </div>
              <div className="h-px w-full bg-border/40 mb-6" />
              
              <div className="flex flex-wrap gap-2 mb-6">
                {leaveTypes.map(type => (
                  <div key={type} className="flex items-center gap-2 px-3 py-1.5 bg-muted border border-border rounded-lg">
                    <span className="text-[13px] font-semibold text-foreground/80">{type}</span>
                    <button 
                      onClick={() => removeLeaveType(type)}
                      className="p-0.5 text-muted-foreground hover:text-rose-500 rounded-md transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3 max-w-md">
                <input 
                  type="text" 
                  placeholder="New leave type (e.g. Maternity Leave)"
                  value={newLeaveTypeInput}
                  onChange={e => setNewLeaveTypeInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newLeaveTypeInput.trim()) {
                      addLeaveType(newLeaveTypeInput.trim());
                      setNewLeaveTypeInput("");
                    }
                  }}
                  className="flex-1 rounded-[10px] border border-border/80 p-2.5 text-[13px] font-medium text-foreground/80 outline-none focus:border-primary bg-white shadow-sm"
                />
                <button 
                  onClick={() => {
                    if (newLeaveTypeInput.trim()) {
                      addLeaveType(newLeaveTypeInput.trim());
                      setNewLeaveTypeInput("");
                    }
                  }}
                  className="px-4 py-2.5 bg-primary hover:bg-[#00925e] text-primary-foreground rounded-[10px] text-[13px] font-bold shadow-sm flex items-center gap-2 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>
            </div>
        </div>
      </section>
      </div>

      <AddHolidayModal />
    </div>
  );
}
