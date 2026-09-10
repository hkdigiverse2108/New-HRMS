import { useState } from "react";
import { cn } from "@/lib/utils";
import { X, Plus } from "lucide-react";
import { useSettingsContext } from "./SettingsContext";
import { SearchableSelect } from "@/components/ui/select";

const TABS = [
  "General",
  "Leave & Holidays",
  "Attendance & OT",
  "Benefits",
  "Lock & Approval"
];

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

export function PayrollSettings() {
  const [activeTab, setActiveTab] = useState("General");
  const { leaveTypes, addLeaveType, removeLeaveType } = useSettingsContext();
  const [newLeaveTypeInput, setNewLeaveTypeInput] = useState("");
  
  // Settings State
  const [workingDays, setWorkingDays] = useState("26");
  const [calcMethod, setCalcMethod] = useState("Working Days");
  const [selectedOffs, setSelectedOffs] = useState<string[]>(["Sunday", "Alternate Saturday"]);
  const [customOffText, setCustomOffText] = useState("");

  // Advanced Settings State
  const [settings, setSettings] = useState({
    paidLeave: "18",
    unpaidLeaveCap: "6",
    halfDayRule: "4 hours",
    carryForward: true,
    maxCarryForward: "12",
    encashment: true,
    lateGrace: "15",
    latePenalty: "₹300 per instance",
    absentRule: "No punch = Absent",
    missingPunch: "Regularize within 3 days",
    enableOT: true,
    otRate: "₹250",
    doubleOTAfter: "4 hrs",
    holidayOT: "2x",
    healthIns: true,
    healthCoCont: "1200",
    healthEmpCont: "650",
    maternity: true,
    paternity: true,
    medical: true,
    travelReimburse: true,
    mealBenefit: true,
    internetReimburse: true,
    mobileAllowance: false,
    bonusEligible: true,
    lockPayroll: true
  });

  const toggleOff = (day: string) => {
    setSelectedOffs(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };

  const getSelectedText = () => {
    if (selectedOffs.length === 0) return "None";
    return selectedOffs.map(d => d === "Custom" && customOffText ? `${customOffText} (Custom)` : d).join(" + ");
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-[1400px]">
      
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Payroll Settings</h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground/80">Company-wide payroll rules applied to every processing cycle</p>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-1.5 bg-[#F6F8F7] p-1.5 rounded-xl w-full border-b border-border/50">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-5 py-2 text-[13px] font-semibold rounded-lg transition-all",
              activeTab === tab 
                ? "bg-white text-foreground shadow-sm" 
                : "text-muted-foreground hover:text-foreground/80"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="pt-8">
        {activeTab === "General" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            
            {/* Card 1: Working Days */}
            <div className="rounded-[16px] border border-border/60 bg-white p-6 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
              <div className="mb-5">
                <h2 className="text-[15px] font-bold text-foreground">Working Days Per Month</h2>
                <p className="text-[13px] text-muted-foreground/80 mt-1">Base divisor used for per-day salary calculation</p>
              </div>
              <div className="h-px w-full bg-border/40 mb-6" />
              
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="text-[12px] font-semibold text-muted-foreground mb-2 block">Working days</label>
                  <SearchableSelect 
                    value={workingDays}
                    onChange={setWorkingDays}
                    options={[
                      { label: "26", value: "26" },
                      { label: "28", value: "28" },
                      { label: "30", value: "30" },
                      { label: "Actual days", value: "actual" }
                    ]}
                    className="w-full h-[42px] rounded-[10px] border border-border/80 p-2.5 text-[13px] font-medium text-foreground/80 outline-none focus:border-emerald-500 bg-white shadow-sm"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-muted-foreground mb-2 block">Salary calculation method</label>
                  <SearchableSelect 
                    value={calcMethod}
                    onChange={setCalcMethod}
                    options={[
                      { label: "Working Days", value: "Working Days" },
                      { label: "Calendar Days", value: "Calendar Days" }
                    ]}
                    className="w-full h-[42px] rounded-[10px] border border-border/80 p-2.5 text-[13px] font-medium text-foreground/80 outline-none focus:border-emerald-500 bg-white shadow-sm"
                  />
                </div>
              </div>
            </div>

            {/* Card 2: Weekly Off */}
            <div className="rounded-[16px] border border-border/60 bg-white p-6 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
              <div className="mb-5">
                <h2 className="text-[15px] font-bold text-foreground">Weekly Off</h2>
                <p className="text-[13px] text-muted-foreground/80 mt-1">Non-working days excluded from attendance loss</p>
              </div>
              <div className="h-px w-full bg-border/40 mb-6" />
              
              <div className="flex flex-wrap gap-2.5 mb-5">
                {["Sunday", "Saturday", "Alternate Saturday", "Custom"].map(day => {
                  const isSelected = selectedOffs.includes(day);
                  return (
                    <button
                      key={day}
                      onClick={() => toggleOff(day)}
                      className={cn(
                        "px-4 py-1.5 rounded-full text-[13px] font-semibold transition-colors",
                        isSelected 
                          ? "bg-primary text-primary-foreground border border-primary" 
                          : "bg-white border border-border/80 text-foreground/80 hover:bg-muted/50"
                      )}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
              {selectedOffs.includes("Custom") && (
                <div className="mb-5 animate-in fade-in slide-in-from-top-1 duration-200">
                  <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Define Custom Off Days</label>
                  <input 
                    type="text" 
                    value={customOffText}
                    onChange={(e) => setCustomOffText(e.target.value)}
                    placeholder="e.g., Every 3rd Saturday, Last Friday..."
                    className="w-full h-[40px] rounded-[10px] border border-border/80 px-3 text-[13px] font-medium text-foreground/80 outline-none focus:border-emerald-500 bg-white shadow-sm"
                  />
                </div>
              )}
              <p className="text-[13px] text-muted-foreground">Selected: <span className="text-foreground/80">{getSelectedText()}</span></p>
            </div>

          </div>
        )}

        {/* Leave & Holidays Tab */}
        {activeTab === "Leave & Holidays" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <div className="rounded-[16px] border border-border/60 bg-white p-6 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
              <div className="mb-5">
                <h2 className="text-[15px] font-bold text-foreground">Holiday Calendar</h2>
                <p className="text-[13px] text-muted-foreground/80 mt-1">Holidays treated as paid non-working days</p>
              </div>
              <div className="h-px w-full bg-border/40 mb-6" />
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3.5 border border-border/80 rounded-xl">
                  <span className="text-[14px] font-semibold text-foreground">Company Holidays</span>
                  <span className="px-3 py-1 bg-[#E8F5F1] text-primary text-[12px] font-bold rounded-full">4 days</span>
                </div>
                <div className="flex items-center justify-between p-3.5 border border-border/80 rounded-xl">
                  <span className="text-[14px] font-semibold text-foreground">National Holidays</span>
                  <span className="px-3 py-1 bg-[#E8F5F1] text-primary text-[12px] font-bold rounded-full">3 days</span>
                </div>
                <div className="flex items-center justify-between p-3.5 border border-border/80 rounded-xl">
                  <span className="text-[14px] font-semibold text-foreground">Festival Holidays</span>
                  <span className="px-3 py-1 bg-[#E8F5F1] text-primary text-[12px] font-bold rounded-full">8 days</span>
                </div>
                <div className="flex items-center justify-between p-3.5 border border-border/80 rounded-xl">
                  <span className="text-[14px] font-semibold text-foreground">Optional Holidays</span>
                  <span className="px-3 py-1 bg-[#E8F5F1] text-primary text-[12px] font-bold rounded-full">2 of 5 selectable</span>
                </div>
              </div>
            </div>

            <div className="rounded-[16px] border border-border/60 bg-white p-6 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
              <div className="mb-5">
                <h2 className="text-[15px] font-bold text-foreground">Leave Policy</h2>
                <p className="text-[13px] text-muted-foreground/80 mt-1">Paid, unpaid, half-day, carry forward and encashment</p>
              </div>
              <div className="h-px w-full bg-border/40 mb-6" />
              
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="text-[12px] font-semibold text-muted-foreground mb-2 block">Paid leave / year</label>
                  <input type="text" value={settings.paidLeave} onChange={(e) => setSettings({...settings, paidLeave: e.target.value})} className="w-full rounded-[10px] border border-border/80 p-2.5 text-[13px] font-medium text-foreground/80 outline-none focus:border-emerald-500 bg-white shadow-sm" />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-muted-foreground mb-2 block">Unpaid leave cap</label>
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

              <div className="flex items-center justify-between p-4 border border-border/80 rounded-xl mb-4">
                <div>
                  <p className="text-[14px] font-semibold text-foreground">Carry Forward Leave</p>
                  <p className="text-[12px] text-muted-foreground mt-0.5">Unused paid leaves move to next year</p>
                </div>
                <Switch checked={settings.carryForward} onChange={() => setSettings({...settings, carryForward: !settings.carryForward})} />
              </div>

              <div className="mb-6">
                <label className="text-[12px] font-semibold text-muted-foreground mb-2 block">Maximum carry forward days</label>
                <input type="text" value={settings.maxCarryForward} onChange={(e) => setSettings({...settings, maxCarryForward: e.target.value})} className="w-full rounded-[10px] border border-border/80 p-2.5 text-[13px] font-medium text-foreground/80 outline-none focus:border-emerald-500 bg-white shadow-sm" />
              </div>

              <div className="flex items-center justify-between p-4 border border-border/80 rounded-xl">
                <div>
                  <p className="text-[14px] font-semibold text-foreground">Leave Encashment</p>
                  <p className="text-[12px] text-muted-foreground mt-0.5">Encash unused leave at year end</p>
                </div>
                <Switch checked={settings.encashment} onChange={() => setSettings({...settings, encashment: !settings.encashment})} />
              </div>
            </div>

            {/* Leave Types Configuration */}
            <div className="rounded-[16px] border border-border/60 bg-white p-6 shadow-[0_2px_8px_rgba(0,0,0,0.02)] mt-6 col-span-1 lg:col-span-2">
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
                  className="px-4 py-2.5 bg-card hover:bg-primary text-primary-foreground rounded-[10px] text-[13px] font-bold shadow-sm flex items-center gap-2 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Attendance & OT Tab */}
        {activeTab === "Attendance & OT" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <div className="rounded-[16px] border border-border/60 bg-white p-6 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
              <div className="mb-5">
                <h2 className="text-[15px] font-bold text-foreground">Attendance Rules</h2>
                <p className="text-[13px] text-muted-foreground/80 mt-1">Grace, penalty and punch rules affecting payable days</p>
              </div>
              <div className="h-px w-full bg-border/40 mb-6" />
              
              <div className="grid grid-cols-2 gap-5 mb-5">
                <div>
                  <label className="text-[12px] font-semibold text-muted-foreground mb-2 block">Late coming grace (minutes)</label>
                  <input type="text" value={settings.lateGrace} onChange={(e) => setSettings({...settings, lateGrace: e.target.value})} className="w-full rounded-[10px] border border-border/80 p-2.5 text-[13px] font-medium text-foreground/80 outline-none focus:border-emerald-500 bg-white shadow-sm" />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-muted-foreground mb-2 block">Late penalty</label>
                  <SearchableSelect
                    value={settings.latePenalty}
                    onChange={(val) => setSettings({...settings, latePenalty: val})}
                    options={[{ label: "₹300 per instance", value: "₹300 per instance" }]}
                    className="w-full h-[42px] rounded-[10px] border border-border/80 p-2.5 text-[13px] font-medium text-foreground/80 outline-none focus:border-emerald-500 bg-white shadow-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5 mb-5">
                <div>
                  <label className="text-[12px] font-semibold text-muted-foreground mb-2 block">Half day rule</label>
                  <SearchableSelect
                    value={settings.halfDayRule}
                    onChange={(val) => setSettings({...settings, halfDayRule: val})}
                    options={[{ label: "Below 4 hrs", value: "Below 4 hrs" }]}
                    className="w-full h-[42px] rounded-[10px] border border-border/80 p-2.5 text-[13px] font-medium text-foreground/80 outline-none focus:border-emerald-500 bg-white shadow-sm"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-muted-foreground mb-2 block">Absent rule</label>
                  <SearchableSelect
                    value={settings.absentRule}
                    onChange={(val) => setSettings({...settings, absentRule: val})}
                    options={[{ label: "No punch = Absent", value: "No punch = Absent" }]}
                    className="w-full h-[42px] rounded-[10px] border border-border/80 p-2.5 text-[13px] font-medium text-foreground/80 outline-none focus:border-emerald-500 bg-white shadow-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="text-[12px] font-semibold text-muted-foreground mb-2 block">Missing punch rule</label>
                  <SearchableSelect
                    value={settings.missingPunch}
                    onChange={(val) => setSettings({...settings, missingPunch: val})}
                    options={[{ label: "Regularize within 3 days", value: "Regularize within 3 days" }]}
                    className="w-full h-[42px] rounded-[10px] border border-border/80 p-2.5 text-[13px] font-medium text-foreground/80 outline-none focus:border-emerald-500 bg-white shadow-sm"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-[16px] border border-border/60 bg-white p-6 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
              <div className="mb-5">
                <h2 className="text-[15px] font-bold text-foreground">Overtime</h2>
                <p className="text-[13px] text-muted-foreground/80 mt-1">OT computed from approved attendance only</p>
              </div>
              <div className="h-px w-full bg-border/40 mb-6" />

              <div className="flex items-center justify-between p-4 border border-border/80 rounded-xl mb-6">
                <div>
                  <p className="text-[14px] font-semibold text-foreground">Enable Overtime</p>
                  <p className="text-[12px] text-muted-foreground mt-0.5">OT paid with monthly payroll</p>
                </div>
                <Switch checked={settings.enableOT} onChange={() => setSettings({...settings, enableOT: !settings.enableOT})} />
              </div>
              
              <div className="grid grid-cols-3 gap-4">
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
                    options={[{ label: "2x", value: "2x" }]}
                    className="w-full h-[42px] rounded-[10px] border border-border/80 p-2.5 text-[13px] font-medium text-foreground/80 outline-none focus:border-emerald-500 bg-white shadow-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Benefits Tab */}
        {activeTab === "Benefits" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <div className="rounded-[16px] border border-border/60 bg-white p-6 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
              <div className="mb-5">
                <h2 className="text-[15px] font-bold text-foreground">Health & Statutory Benefits</h2>
                <p className="text-[13px] text-muted-foreground/80 mt-1">Company and employee contributions</p>
              </div>
              <div className="h-px w-full bg-border/40 mb-6" />

              <div className="space-y-4">
                <div className="border border-border/80 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-[14px] font-semibold text-foreground">Health Insurance</p>
                      <p className="text-[12px] text-muted-foreground mt-0.5">Company ₹1,200 · Employee ₹650</p>
                    </div>
                    <Switch checked={settings.healthIns} onChange={() => setSettings({...settings, healthIns: !settings.healthIns})} />
                  </div>
                  <div className="px-4 pb-4 grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground mb-1.5 block">Company contribution</label>
                      <input type="text" value={settings.healthCoCont} onChange={(e) => setSettings({...settings, healthCoCont: e.target.value})} className="w-full rounded-[8px] border border-border/80 p-2 text-[13px] font-medium text-foreground/80 outline-none focus:border-emerald-500 bg-white" />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground mb-1.5 block">Employee contribution</label>
                      <input type="text" value={settings.healthEmpCont} onChange={(e) => setSettings({...settings, healthEmpCont: e.target.value})} className="w-full rounded-[8px] border border-border/80 p-2 text-[13px] font-medium text-foreground/80 outline-none focus:border-emerald-500 bg-white" />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border border-border/80 rounded-xl">
                  <div>
                    <p className="text-[14px] font-semibold text-foreground">Maternity Leave</p>
                    <p className="text-[12px] text-muted-foreground mt-0.5">Days allowed: 182</p>
                  </div>
                  <Switch checked={settings.maternity} onChange={() => setSettings({...settings, maternity: !settings.maternity})} />
                </div>

                <div className="flex items-center justify-between p-4 border border-border/80 rounded-xl">
                  <div>
                    <p className="text-[14px] font-semibold text-foreground">Paternity Leave</p>
                    <p className="text-[12px] text-muted-foreground mt-0.5">Days allowed: 15</p>
                  </div>
                  <Switch checked={settings.paternity} onChange={() => setSettings({...settings, paternity: !settings.paternity})} />
                </div>

                <div className="flex items-center justify-between p-4 border border-border/80 rounded-xl">
                  <div>
                    <p className="text-[14px] font-semibold text-foreground">Medical Benefit</p>
                  </div>
                  <Switch checked={settings.medical} onChange={() => setSettings({...settings, medical: !settings.medical})} />
                </div>
              </div>
            </div>

            <div className="rounded-[16px] border border-border/60 bg-white p-6 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
              <div className="mb-5">
                <h2 className="text-[15px] font-bold text-foreground">Reimbursements & Perks</h2>
                <p className="text-[13px] text-muted-foreground/80 mt-1">Applied as monthly allowances in payslips</p>
              </div>
              <div className="h-px w-full bg-border/40 mb-6" />

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-border/80 rounded-xl">
                  <p className="text-[14px] font-semibold text-foreground">Travel Reimbursement</p>
                  <Switch checked={settings.travelReimburse} onChange={() => setSettings({...settings, travelReimburse: !settings.travelReimburse})} />
                </div>
                <div className="flex items-center justify-between p-4 border border-border/80 rounded-xl">
                  <p className="text-[14px] font-semibold text-foreground">Meal Benefit</p>
                  <Switch checked={settings.mealBenefit} onChange={() => setSettings({...settings, mealBenefit: !settings.mealBenefit})} />
                </div>
                <div className="flex items-center justify-between p-4 border border-border/80 rounded-xl">
                  <p className="text-[14px] font-semibold text-foreground">Internet Reimbursement</p>
                  <Switch checked={settings.internetReimburse} onChange={() => setSettings({...settings, internetReimburse: !settings.internetReimburse})} />
                </div>
                <div className="flex items-center justify-between p-4 border border-border/80 rounded-xl bg-muted/50/30">
                  <p className={cn("text-[14px] font-semibold", settings.mobileAllowance ? "text-foreground" : "text-muted-foreground")}>Mobile Allowance</p>
                  <Switch checked={settings.mobileAllowance} onChange={() => setSettings({...settings, mobileAllowance: !settings.mobileAllowance})} />
                </div>
                <div className="flex items-center justify-between p-4 border border-border/80 rounded-xl">
                  <div>
                    <p className="text-[14px] font-semibold text-foreground">Bonus Eligibility</p>
                    <p className="text-[12px] text-muted-foreground mt-0.5">After 6 months of service</p>
                  </div>
                  <Switch checked={settings.bonusEligible} onChange={() => setSettings({...settings, bonusEligible: !settings.bonusEligible})} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Lock & Approval Tab */}
        {activeTab === "Lock & Approval" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <div className="rounded-[16px] border border-border/60 bg-white p-6 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
              <div className="mb-5">
                <h2 className="text-[15px] font-bold text-foreground">Payroll Lock</h2>
                <p className="text-[13px] text-muted-foreground/80 mt-1">Prevent edits once payroll is approved</p>
              </div>
              <div className="h-px w-full bg-border/40 mb-6" />

              <div className="flex items-center justify-between p-4 border border-border/80 rounded-xl mb-4">
                <div>
                  <p className="text-[14px] font-semibold text-foreground">Lock payroll after approval</p>
                  <p className="text-[12px] text-muted-foreground mt-0.5">Approved payroll becomes read-only forever</p>
                </div>
                <Switch checked={settings.lockPayroll} onChange={() => setSettings({...settings, lockPayroll: !settings.lockPayroll})} />
              </div>
              
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                Payroll records can never be deleted — corrections are posted as adjustments in the next cycle.
              </p>
            </div>

            <div className="rounded-[16px] border border-border/60 bg-white p-6 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
              <div className="mb-5">
                <h2 className="text-[15px] font-bold text-foreground">Approval Workflow</h2>
                <p className="text-[13px] text-muted-foreground/80 mt-1">Sequential approvals required before disbursement</p>
              </div>
              <div className="h-px w-full bg-border/40 mb-6" />

              <div className="space-y-4 relative before:absolute before:inset-y-0 before:left-[19px] before:w-px before:bg-border/60">
                <div className="flex items-center gap-4 p-4 border border-border/80 rounded-xl bg-white relative z-10">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[14px] font-bold shrink-0">1</div>
                  <div>
                    <p className="text-[14px] font-bold text-foreground">HR</p>
                    <p className="text-[12px] text-muted-foreground mt-0.5">Verifies attendance, leave and salary revisions</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 border border-border/80 rounded-xl bg-white relative z-10">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[14px] font-bold shrink-0">2</div>
                  <div>
                    <p className="text-[14px] font-bold text-foreground">Accounts</p>
                    <p className="text-[12px] text-muted-foreground mt-0.5">Validates deductions, recoveries and tax</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 border border-border/80 rounded-xl bg-white relative z-10">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[14px] font-bold shrink-0">3</div>
                  <div>
                    <p className="text-[14px] font-bold text-foreground">CEO</p>
                    <p className="text-[12px] text-muted-foreground mt-0.5">Final approval — locks payroll</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
