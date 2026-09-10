import React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { SortConfig } from "@/hooks/useSortableData";

interface SortableHeaderProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  label: React.ReactNode;
  sortKey: string;
  currentSort: SortConfig | null;
  onSort: (key: string) => void;
  align?: "left" | "center" | "right";
}

export function SortableHeader({
  label,
  sortKey,
  currentSort,
  onSort,
  align = "left",
  className,
  ...props
}: SortableHeaderProps) {
  const isActive = currentSort?.key === sortKey;
  const isAscending = isActive && currentSort?.direction === "ascending";
  const isDescending = isActive && currentSort?.direction === "descending";

  return (
    <th
      className={cn(
        "cursor-pointer select-none group hover:bg-muted/50 transition-colors",
        className
      )}
      onClick={() => onSort(sortKey)}
      {...props}
    >
      <div
        className={cn(
          "flex items-center gap-1.5",
          align === "center" ? "justify-center" : align === "right" ? "justify-end" : "justify-start"
        )}
      >
        <span className={cn(isActive ? "text-foreground font-bold" : "text-muted-foreground")}>
          {label}
        </span>
        <div className="flex flex-col opacity-40 group-hover:opacity-100 transition-opacity">
          {isAscending ? (
            <ArrowUp className="w-3.5 h-3.5 text-primary opacity-100" />
          ) : isDescending ? (
            <ArrowDown className="w-3.5 h-3.5 text-primary opacity-100" />
          ) : (
            <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </div>
      </div>
    </th>
  );
}
