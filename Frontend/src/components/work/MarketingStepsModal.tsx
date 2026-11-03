import React, { useState, useEffect, useMemo } from "react";
import { User, Plus, Trash2, X, ListChecks, Save, Loader2, Sparkles, Check, Search, ChevronDown } from "lucide-react";
import { toast } from "@/lib/toast";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { getAvatarUrl, uiAvatar } from "@/lib/config";
import { DatePicker } from "@/components/ui/date-picker";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface MarketingStepItem {
  id: string;
  order: number;
  title: string;
  description: string;
  assigned_to: string;
  assigned_to_name: string;
  due_date: string;
  is_completed: boolean;
  completed_at?: string | null;
  completed_by?: string | null;
  notes?: string;
}

interface MarketingStepsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  clientName?: string | undefined;
}

interface StepAssigneePickerProps {
  value: string;
  employees: any[];
  onChange: (empId: string, empName: string) => void;
}

const StepAssigneePicker: React.FC<StepAssigneePickerProps> = ({
  value,
  employees,
  onChange,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedEmp = useMemo(() => {
    return employees.find((e) => String(e.id || e._id) === String(value)) || null;
  }, [employees, value]);

  const selectedName = useMemo(() => {
    if (!selectedEmp) return "";
    return (
      selectedEmp.name ||
      `${selectedEmp.personal_info?.first_name || ""} ${selectedEmp.personal_info?.last_name || ""}`.trim() ||
      "Unknown"
    );
  }, [selectedEmp]);

  const filteredEmployees = useMemo(() => {
    if (!search.trim()) return employees;
    const q = search.toLowerCase();
    return employees.filter((e) => {
      const name = (
        e.name ||
        `${e.personal_info?.first_name || ""} ${e.personal_info?.last_name || ""}`
      ).toLowerCase();
      const role = (e.work_info?.designation || e.role || "").toLowerCase();
      const dept = (e.work_info?.department || "").toLowerCase();
      return name.includes(q) || role.includes(q) || dept.includes(q);
    });
  }, [employees, search]);

  const avatarUrl = useMemo(() => {
    if (!selectedEmp) return "";
    const raw = selectedEmp.profile_picture || selectedEmp.avatar || selectedEmp.image;
    return raw ? getAvatarUrl(raw, selectedName) : uiAvatar(selectedName);
  }, [selectedEmp, selectedName]);

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(""); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "h-8 px-2.5 rounded-xl border flex items-center justify-between gap-1.5 transition text-xs font-semibold cursor-pointer max-w-[175px] min-w-[130px] shadow-xs select-none",
            selectedEmp
              ? "bg-muted/60 border-border/70 text-foreground hover:bg-muted"
              : "bg-muted/30 border-border/50 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          )}
          title={selectedName ? `Assigned to: ${selectedName}` : "Select Assignee"}
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {selectedEmp ? (
              <img
                src={avatarUrl}
                alt={selectedName}
                className="w-4 h-4 rounded-full object-cover shrink-0 border border-border/50"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            ) : (
              <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            )}
            <span className="truncate text-left">
              {selectedName || "Select Assignee"}
            </span>
          </div>
          <ChevronDown className="w-3 h-3 text-muted-foreground/60 shrink-0 ml-0.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-64 p-0 rounded-2xl border border-border/70 shadow-2xl bg-card z-[320] overflow-hidden"
      >
        <div className="p-2 border-b border-border/40 bg-muted/20">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search team member..."
              className="w-full pl-8 pr-2.5 py-1 text-xs rounded-lg bg-background border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
            />
          </div>
        </div>

        <div className="max-h-56 overflow-y-auto p-1.5 space-y-0.5">
          {/* Unassigned / Clear Option */}
          <button
            type="button"
            onClick={() => {
              onChange("", "");
              setOpen(false);
            }}
            className={cn(
              "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer text-left",
              !value
                ? "bg-primary/10 text-primary font-bold"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center shrink-0">
                <User className="w-3 h-3 text-muted-foreground" />
              </div>
              <span className="truncate font-semibold">Unassigned (None)</span>
            </div>
            {!value && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
          </button>

          {filteredEmployees.length === 0 ? (
            <div className="py-4 text-center text-xs text-muted-foreground">
              No team members found
            </div>
          ) : (
            filteredEmployees.map((emp) => {
              const empId = String(emp.id || emp._id);
              const name = (
                emp.name ||
                `${emp.personal_info?.first_name || ""} ${emp.personal_info?.last_name || ""}`.trim() ||
                "Employee"
              );
              const role = emp.work_info?.designation || emp.role || "";
              const rawImg = emp.profile_picture || emp.avatar || emp.image;
              const empAvatar = rawImg ? getAvatarUrl(rawImg, name) : uiAvatar(name);
              const isSelected = String(value) === empId;

              return (
                <button
                  key={empId}
                  type="button"
                  onClick={() => {
                    onChange(empId, name);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer text-left",
                    isSelected
                      ? "bg-primary/10 text-primary font-bold"
                      : "text-foreground hover:bg-muted"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <img
                      src={empAvatar}
                      alt={name}
                      className="w-5 h-5 rounded-full object-cover shrink-0 border border-border/50"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold leading-tight">{name}</p>
                      {role && (
                        <p className="text-[10px] text-muted-foreground truncate leading-tight">
                          {role}
                        </p>
                      )}
                    </div>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0 ml-1.5" />}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export const MarketingStepsModal: React.FC<MarketingStepsModalProps> = ({
  isOpen,
  onClose,
  projectId,
  projectName,
  clientName,
}) => {
  const [steps, setSteps] = useState<MarketingStepItem[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Confirm delete modal state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    stepId: string;
    stepTitle: string;
  }>({
    isOpen: false,
    stepId: "",
    stepTitle: "",
  });

  const handleModalClose = () => {
    setSteps([]);
    onClose();
  };

  // Load steps and employees
  useEffect(() => {
    if (!isOpen || !projectId) {
      setSteps([]);
      return;
    }
    let alive = true;
    (async () => {
      try {
        setIsLoading(true);
        const [stepsRes, empRes] = await Promise.all([
          api.get<{ status: string; data: MarketingStepItem[] }>(`/projects/${projectId}/marketing-steps`),
          api.get<{ data: any[] }>("/employees?limit=200"),
        ]);
        if (alive) {
          if (stepsRes?.data && Array.isArray(stepsRes.data)) {
            setSteps(stepsRes.data);
          }
          if (empRes?.data && Array.isArray(empRes.data)) {
            setEmployees(empRes.data);
          }
        }
      } catch (err: any) {
        toast.error("Failed to load marketing steps");
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [isOpen, projectId]);

  const completedCount = useMemo(() => {
    return steps.filter((s) => s.is_completed).length;
  }, [steps]);

  const completionPct = useMemo(() => {
    if (steps.length === 0) return 0;
    return Math.round((completedCount / steps.length) * 100);
  }, [steps, completedCount]);

  /**
   * Cascading Sequential Completion Logic:
   * - When unchecking a step at index `stepIndex`:
   *   Uncheck this step AND ALL subsequent steps below it (idx >= stepIndex).
   * - When checking a step at index `stepIndex`:
   *   Check this step AND ALL preceding steps above it (idx <= stepIndex).
   */
  const handleToggleComplete = (stepIndex: number) => {
    setSteps((prev) => {
      const target = prev[stepIndex];
      if (!target) return prev;
      const isCurrentlyCompleted = Boolean(target.is_completed);

      if (isCurrentlyCompleted) {
        // Uncheck target step and all steps after it
        return prev.map((s, idx) => {
          if (idx >= stepIndex) {
            return {
              ...s,
              is_completed: false,
              completed_at: null,
              completed_by: null,
            };
          }
          return s;
        });
      } else {
        // Complete target step and all preceding steps
        const nowStr = new Date().toISOString();
        return prev.map((s, idx) => {
          if (idx <= stepIndex) {
            return {
              ...s,
              is_completed: true,
              completed_at: s.completed_at || nowStr,
              completed_by: s.completed_by || "Current User",
            };
          }
          return s;
        });
      }
    });
  };

  const handleUpdateField = (stepId: string, field: keyof MarketingStepItem, value: any) => {
    setSteps((prev) =>
      prev.map((s) => {
        if (s.id === stepId) {
          if (field === "assigned_to") {
            const emp = employees.find((e) => String(e.id || e._id) === String(value));
            return {
              ...s,
              assigned_to: value,
              assigned_to_name: emp
                ? (emp.name || `${emp.personal_info?.first_name || ""} ${emp.personal_info?.last_name || ""}`.trim())
                : "",
            };
          }
          return { ...s, [field]: value };
        }
        return s;
      })
    );
  };

  const handleAddStep = () => {
    const nextOrder = steps.length + 1;
    const newStep: MarketingStepItem = {
      id: `step_${Date.now()}`,
      order: nextOrder,
      title: `Step ${nextOrder}: New Workflow Step`,
      description: "Define actionable task for this phase...",
      assigned_to: "",
      assigned_to_name: "",
      due_date: "",
      is_completed: false,
      completed_at: null,
      completed_by: null,
      notes: "",
    };
    setSteps((prev) => [...prev, newStep]);
  };

  const handleSaveSteps = async () => {
    if (!projectId) return;
    try {
      setIsSaving(true);
      await api.put(`/projects/${projectId}/marketing-steps`, { steps });
      toast.success("Marketing steps updated successfully!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save marketing steps");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[280] flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200"
        onClick={handleModalClose}
      >
        <div className="absolute inset-0 bg-black/80 backdrop-blur-xs" />
        <div
          className="relative z-10 w-full max-w-4xl bg-card border border-border/80 rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden max-h-[92vh] animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-border/60 bg-muted/20 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold shrink-0 shadow-sm">
                <ListChecks className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black tracking-tight text-foreground truncate">
                    Digital Marketing Execution Steps
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
                    {completedCount} / {steps.length} Done
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {projectName} {clientName ? `• ${clientName}` : ""} • Set onboarding & launch pipeline by assignee
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleSaveSteps}
                disabled={isSaving}
                className="px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>Save Steps</span>
              </button>
              <button
                type="button"
                onClick={handleModalClose}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Progress Bar Header Card */}
          <div className="px-6 py-3.5 bg-muted/10 border-b border-border/40 shrink-0">
            <div className="flex items-center justify-between text-xs font-bold mb-1.5">
              <span className="text-muted-foreground">Pipeline Progress</span>
              <span className="text-foreground">{completionPct}% Completed</span>
            </div>
            <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
                style={{ width: `${completionPct}%` }}
              />
            </div>
          </div>

          {/* Steps List */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
            {isLoading ? (
              <div className="py-12 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span>Loading marketing steps...</span>
              </div>
            ) : steps.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                No steps defined. Click "+ Add Step" below.
              </div>
            ) : (
              steps.map((step, idx) => (
                <div
                  key={step.id}
                  className={cn(
                    "p-4 rounded-2xl border transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-4",
                    step.is_completed
                      ? "bg-emerald-500/[0.04] border-emerald-500/30"
                      : "bg-card border-border/60 hover:border-border"
                  )}
                >
                  {/* Checkbox + Order + Title & Desc */}
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => handleToggleComplete(idx)}
                      className={cn(
                        "mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center transition shrink-0 cursor-pointer",
                        step.is_completed
                          ? "bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/20"
                          : "border-2 border-muted-foreground/40 hover:border-primary text-transparent"
                      )}
                      title={step.is_completed ? "Click to uncheck (will also uncheck steps below)" : "Click to mark complete (will also complete previous steps)"}
                    >
                      <Check className="w-4 h-4" />
                    </button>

                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-muted text-muted-foreground">
                          Step {idx + 1}
                        </span>
                        <input
                          type="text"
                          value={step.title}
                          onChange={(e) => handleUpdateField(step.id, "title", e.target.value)}
                          className={cn(
                            "font-bold text-xs sm:text-sm bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-primary rounded px-1 flex-1 min-w-[200px]",
                            step.is_completed ? "line-through text-muted-foreground" : "text-foreground"
                          )}
                        />
                      </div>
                      <textarea
                        value={step.description}
                        onChange={(e) => handleUpdateField(step.id, "description", e.target.value)}
                        placeholder="Step details or instructions..."
                        rows={1}
                        className="w-full text-xs text-muted-foreground bg-transparent border-0 focus:outline-none resize-none p-1 placeholder:text-muted-foreground/40"
                      />
                    </div>
                  </div>

                  {/* Assignee Person + Due Date Controls */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0 self-end md:self-center">
                    {/* Modern Assignee Popover Picker */}
                    <StepAssigneePicker
                      value={step.assigned_to || ""}
                      employees={employees}
                      onChange={(empId) => handleUpdateField(step.id, "assigned_to", empId)}
                    />

                    {/* Modern App DatePicker */}
                    <div className="w-[130px]">
                      <DatePicker
                        value={step.due_date || ""}
                        onChange={(val) => handleUpdateField(step.id, "due_date", val)}
                        placeholder="Due date"
                        displayFormat="dd MMM yyyy"
                        clearable
                        className="h-8 text-xs bg-muted/40 border-border/50 hover:bg-muted/70 rounded-xl shadow-xs"
                      />
                    </div>

                    {/* Delete Step with ConfirmModal */}
                    <button
                      type="button"
                      onClick={() =>
                        setDeleteConfirm({
                          isOpen: true,
                          stepId: step.id,
                          stepTitle: step.title || `Step ${idx + 1}`,
                        })
                      }
                      className="p-1.5 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition cursor-pointer"
                      title="Delete Step"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}

            {/* Add Step Button */}
            <button
              type="button"
              onClick={handleAddStep}
              className="w-full py-2.5 rounded-2xl border border-dashed border-primary/40 hover:border-primary bg-primary/5 hover:bg-primary/10 text-primary text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Custom Step</span>
            </button>
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-border/50 bg-muted/20 flex items-center justify-between text-xs text-muted-foreground shrink-0">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Sequential workflow: unchecking any step will auto-uncheck dependent steps below it</span>
            </div>
            <button
              type="button"
              onClick={handleSaveSteps}
              disabled={isSaving}
              className="px-4 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>

      {/* Delete Step Confirm Modal */}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={() => {
          setSteps((prev) => prev.filter((s) => s.id !== deleteConfirm.stepId));
          setDeleteConfirm((prev) => ({ ...prev, isOpen: false }));
          toast.success("Workflow step removed");
        }}
        title="Delete Workflow Step"
        description="Are you sure you want to remove this workflow step? This step will be permanently removed once you save changes."
        itemName={deleteConfirm.stepTitle}
        confirmText="Delete Step"
        variant="destructive"
      />
    </>
  );
};
