import React, { useEffect, useState } from "react";
import { subscribeLoader } from "@/lib/api";
import { Loader2 } from "lucide-react";

export const GlobalApiLoader: React.FC = () => {
  const [activeRequests, setActiveRequests] = useState(0);

  useEffect(() => {
    return subscribeLoader((count) => {
      setActiveRequests(count);
    });
  }, []);

  if (activeRequests === 0) return null;

  return (
    <div className="fixed inset-0 z-[99999] pointer-events-none flex items-start justify-end p-6">
      {/* Sleek floating badge indicator */}
      <div className="pointer-events-auto flex items-center gap-3 bg-background/90 backdrop-blur-md border border-primary/30 shadow-2xl px-4 py-2.5 rounded-2xl animate-in fade-in slide-in-from-top-4 duration-200">
        <div className="relative flex items-center justify-center">
          <Loader2 className="w-4 h-4 text-primary animate-spin" />
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-bold text-foreground tracking-tight">Syncing Data</span>
          <span className="text-[10px] text-muted-foreground">Communicating with server...</span>
        </div>
      </div>
    </div>
  );
};
