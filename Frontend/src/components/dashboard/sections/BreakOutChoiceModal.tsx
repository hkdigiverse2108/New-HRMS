import React from "react";
import { Coffee, ArrowRight, RefreshCw, X, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";

interface BreakOutChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTaskTitle: string | null;
  onContinueCurrentTask: () => void;
  onSelectNewTask: () => void;
}

export function BreakOutChoiceModal({
  isOpen,
  onClose,
  currentTaskTitle,
  onContinueCurrentTask,
  onSelectNewTask,
}: BreakOutChoiceModalProps) {
  if (!isOpen) return null;

  const displayTask = currentTaskTitle || "General Work";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg max-h-[90dvh] bg-card border border-border/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border/60">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 flex items-center justify-center text-amber-500 shrink-0">
              <Coffee className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-black text-foreground tracking-tight truncate sm:whitespace-normal">Break Out - Resume Work</h2>
              <p className="text-xs text-muted-foreground">Select how you would like to resume your session</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center shrink-0 text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Task Banner */}
        <div className="px-6 pt-5 pb-2">
          <div className="p-3.5 bg-muted/60 border border-border/80 rounded-2xl flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Briefcase className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Current Active Task
              </span>
              <p className="text-sm font-bold text-foreground truncate" title={displayTask}>
                {displayTask}
              </p>
            </div>
          </div>
        </div>

        {/* Options */}
        <div className="p-6 space-y-3 overflow-y-auto flex-1 min-h-0">
          {/* Option 1: Continue Previous Task */}
          <button
            type="button"
            onClick={onContinueCurrentTask}
            className="w-full group p-4 rounded-2xl border-2 border-border/70 hover:border-primary/60 bg-card hover:bg-primary/5 transition-all text-left flex items-start gap-4 cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/10 group-hover:bg-primary text-primary group-hover:text-primary-foreground flex items-center justify-center shrink-0 transition-colors mt-0.5">
              <ArrowRight className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-black text-foreground group-hover:text-primary transition-colors min-w-0 truncate">
                  Continue with Current Task
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary shrink-0">
                  Previous Task
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                Keep working on &quot;{displayTask}&quot; without changing task
              </p>
            </div>
          </button>

          {/* Option 2: Choose New Task */}
          <button
            type="button"
            onClick={onSelectNewTask}
            className="w-full group p-4 rounded-2xl border-2 border-border/70 hover:border-emerald-500/60 bg-card hover:bg-emerald-500/5 transition-all text-left flex items-start gap-4 cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 group-hover:bg-emerald-500 text-emerald-500 group-hover:text-white flex items-center justify-center shrink-0 transition-colors mt-0.5">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-black text-foreground group-hover:text-emerald-500 transition-colors min-w-0 truncate">
                  Switch to New Task
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 shrink-0">
                  New Task
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Choose another task from Today&apos;s Work, Upcoming, Research, or add custom
              </p>
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-muted/30 border-t border-border/60 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-border/70 font-semibold text-xs text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
