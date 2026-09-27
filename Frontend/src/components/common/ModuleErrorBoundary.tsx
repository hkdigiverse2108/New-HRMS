import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
  moduleName?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ModuleErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ModuleErrorBoundary caught an error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
    if (typeof window !== "undefined") {
      // Clear potentially corrupted local state for modules
      localStorage.removeItem("hrms_selected_client_id");
      localStorage.removeItem("hrms_selected_project_id");
    }
  };

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="w-full min-h-[400px] flex flex-col items-center justify-center p-8 bg-card/60 backdrop-blur-md border border-border/60 rounded-3xl text-center space-y-4 shadow-sm animate-in fade-in duration-300">
          <div className="w-14 h-14 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center shadow-inner">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div className="space-y-1 max-w-md">
            <h2 className="text-xl font-black text-foreground">
              {this.props.moduleName || "Module"} could not load
            </h2>
            <p className="text-xs text-muted-foreground font-medium">
              An unexpected error occurred while rendering this section. You can try reloading it.
            </p>
            {this.state.error?.message && (
              <p className="text-[11px] font-mono text-destructive/80 bg-destructive/5 px-3 py-1.5 rounded-xl border border-destructive/20 mt-2 break-words">
                {this.state.error.message}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={this.handleReset}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-bold text-xs rounded-xl shadow-md hover:bg-primary/90 transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              Reload Module
            </button>
            <button
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.href = "/";
                }
              }}
              className="px-4 py-2.5 bg-muted text-muted-foreground font-bold text-xs rounded-xl hover:bg-muted/80 hover:text-foreground transition-all"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
