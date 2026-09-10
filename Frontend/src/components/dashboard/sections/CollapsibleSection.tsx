import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollapsibleSectionProps {
  section: string;
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  titleIcon?: React.ReactNode;
}

export function CollapsibleSection({ section, title, children, defaultExpanded = true, titleIcon }: CollapsibleSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="flex flex-col h-full">
      <div 
        className="mb-6 pl-2 flex items-center justify-between cursor-pointer select-none group"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div>
          <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-0.5">{section}</p>
          <div className="flex items-center gap-2">
            {titleIcon}
            <h2 className="text-[18px] font-black text-foreground tracking-tight group-hover:text-primary transition-colors">{title}</h2>
          </div>
        </div>
        <div className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors">
          <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform duration-300", !isExpanded ? "rotate-180" : "")} />
        </div>
      </div>
      
      <div className={cn("transition-all duration-500 overflow-hidden", isExpanded ? "opacity-100" : "opacity-0 max-h-0")}>
        {children}
      </div>
    </div>
  );
}
