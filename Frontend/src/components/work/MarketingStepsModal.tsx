import React, { useState, useEffect, useMemo } from "react";
import {
  CheckCircle2,
  Circle,
  Clock,
  User,
  Calendar,
  Plus,
  Trash2,
  X,
  ListChecks,
  Save,
  Loader2,
  ChevronRight,
  ArrowRight,
  Sparkles,
  AlertCircle,
  Check,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { getAvatarUrl, uiAvatar } from "@/lib/config";

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

  // Load steps and employees
  useEffect(() => {
    if (!isOpen || !projectId) return;
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

  const handleToggleComplete = (stepId: string) => {
    setSteps((prev) =>
      prev.map((s) => {
        if (s.id === stepId) {
          const next = !s.is_completed;
          return {
            ...s,
            is_completed: next,
            completed_at: next ? new Date().toISOString() : null,
            completed_by: next ? "Current User" : null,
          };
        }
        return s;
      })
    );
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
              assigned_to_name: emp ? (emp.name || `${emp.personal_info?.first_name || ""} ${emp.personal_info?.last_name || ""}`.trim()) : "",
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

  const handleDeleteStep = (stepId: string) => {
    if (!confirm("Are you sure you want to remove this workflow step?")) return;
    setSteps((prev) => prev.filter((s) => s.id !== stepId));
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
    <div
      className="fixed inset-0 z-[280] flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200"
      onClick={onClose}
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
              onClick={onClose}
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
                    onClick={() => handleToggleComplete(step.id)}
                    className={cn(
                      "mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center transition shrink-0 cursor-pointer",
                      step.is_completed
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "border-2 border-muted-foreground/40 hover:border-primary text-transparent"
                    )}
                    title={step.is_completed ? "Mark as Incomplete" : "Mark as Completed"}
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
                <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-end md:self-center">
                  {/* Assignee Person Dropdown */}
                  <div className="flex items-center gap-1.5 bg-muted/40 border border-border/50 rounded-xl px-2.5 py-1.5 text-xs">
                    <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <select
                      value={step.assigned_to || ""}
                      onChange={(e) => handleUpdateField(step.id, "assigned_to", e.target.value)}
                      className="bg-transparent text-xs font-semibold text-foreground focus:outline-none cursor-pointer max-w-[140px] truncate"
                    >
                      <option value="">Select Assignee</option>
                      {employees.map((emp) => {
                        const empId = String(emp.id || emp._id);
                        const empName = emp.name || `${emp.personal_info?.first_name || ""} ${emp.personal_info?.last_name || ""}`.trim();
                        return (
                          <option key={empId} value={empId}>
                            {empName}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Due Date Input */}
                  <div className="flex items-center gap-1.5 bg-muted/40 border border-border/50 rounded-xl px-2.5 py-1.5 text-xs">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <input
                      type="date"
                      value={step.due_date || ""}
                      onChange={(e) => handleUpdateField(step.id, "due_date", e.target.value)}
                      className="bg-transparent text-xs text-foreground focus:outline-none cursor-pointer"
                    />
                  </div>

                  {/* Delete Step */}
                  <button
                    type="button"
                    onClick={() => handleDeleteStep(step.id)}
                    className="p-1.5 text-muted-foreground hover:text-rose-600 rounded-lg transition"
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
            <span>Track client requirement gathering, access setups & campaign launches step-by-step</span>
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
  );
};
