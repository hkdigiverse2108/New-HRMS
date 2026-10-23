import React, { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Check, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SocialDropdownOption {
  value: string;
  label: string;
  subLabel?: string | null | undefined;
  icon?: React.ReactNode | undefined;
  badge?: string | undefined;
  badgeColor?: string | undefined; // e.g., "bg-purple-500/10 text-purple-500 border-purple-500/20"
}

export interface SocialDropdownProps {
  label?: string | undefined;
  icon?: React.ReactNode | undefined;
  value: string;
  options: SocialDropdownOption[];
  onChange: (value: string) => void;
  placeholder?: string | undefined;
  defaultValue?: string | undefined;
  align?: ("left" | "right") | undefined;
  className?: string | undefined;
  fullWidth?: boolean | undefined;
  disabled?: boolean | undefined;
  searchable?: boolean | undefined;
  searchPlaceholder?: string | undefined;
}

export const SocialDropdown: React.FC<SocialDropdownProps> = ({
  label,
  icon,
  value,
  options,
  onChange,
  placeholder,
  defaultValue = "",
  align = "left",
  className,
  fullWidth = false,
  disabled = false,
  searchable = false,
  searchPlaceholder = "Search...",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Reset search when opening/closing
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm("");
    }
  }, [isOpen]);

  const selectedOption = options.find((opt) => opt.value === value);
  const isFiltered = value !== defaultValue && value !== "" && value !== "ALL";
  const displayLabel = selectedOption ? selectedOption.label : (placeholder || label || "Select option");

  const filteredOptions = useMemo(() => {
    if (!searchable || !searchTerm.trim()) return options;
    const q = searchTerm.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.subLabel && opt.subLabel.toLowerCase().includes(q)) ||
        (opt.badge && opt.badge.toLowerCase().includes(q))
    );
  }, [options, searchable, searchTerm]);

  return (
    <div
      ref={dropdownRef}
      className={cn("relative inline-block text-left", fullWidth ? "w-full" : "", className)}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "h-9 px-3 rounded-xl text-xs font-bold border transition-all duration-150 flex items-center justify-between gap-2 shadow-xs cursor-pointer select-none",
          fullWidth ? "w-full" : "",
          disabled && "opacity-50 cursor-not-allowed",
          isFiltered
            ? "bg-primary/10 text-primary border-primary/30 shadow-xs"
            : "bg-card text-foreground/85 border-border hover:border-border hover:bg-muted/50 hover:text-foreground",
          isOpen && "ring-2 ring-primary/20 border-primary"
        )}
      >
        <div className="flex items-center gap-2 truncate min-w-0">
          {(selectedOption?.icon || icon) && (
            <span className={cn("shrink-0", isFiltered ? "text-primary" : "text-muted-foreground")}>
              {selectedOption?.icon || icon}
            </span>
          )}
          {selectedOption?.badge && (
            <span
              className={cn(
                "px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase border shrink-0",
                selectedOption.badgeColor || "bg-primary/10 text-primary border-primary/20"
              )}
            >
              {selectedOption.badge}
            </span>
          )}
          <span className="truncate">{displayLabel}</span>
        </div>

        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 shrink-0 ml-1.5",
            isOpen && "transform rotate-180 text-foreground"
          )}
        />
      </button>

      {isOpen && (
        <div
          className={cn(
            "absolute mt-1.5 py-1.5 rounded-2xl bg-popover/95 backdrop-blur-md border border-border shadow-xl z-50 animate-in fade-in-0 zoom-in-95 duration-100 scrollbar-thin overflow-hidden flex flex-col",
            fullWidth ? "w-full min-w-[240px]" : "min-w-[200px] max-w-[320px]",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {searchable && (
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  autoFocus
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary outline-none"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="max-h-60 overflow-y-auto py-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                No matching options found
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer select-none group",
                      isSelected
                        ? "bg-primary/10 text-primary font-bold"
                        : "text-foreground hover:bg-muted/60"
                    )}
                  >
                    <div className="flex flex-col truncate pr-2 min-w-0">
                      <div className="flex items-center gap-2 truncate">
                        {opt.icon && (
                          <span
                            className={cn(
                              "shrink-0",
                              isSelected ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                            )}
                          >
                            {opt.icon}
                          </span>
                        )}
                        {opt.badge && (
                          <span
                            className={cn(
                              "px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase border shrink-0",
                              opt.badgeColor || "bg-primary/10 text-primary border-primary/20"
                            )}
                          >
                            {opt.badge}
                          </span>
                        )}
                        <span className="truncate">{opt.label}</span>
                      </div>
                      {opt.subLabel && (
                        <span className="text-[10px] text-muted-foreground font-normal truncate mt-0.5 pl-0.5">
                          {opt.subLabel}
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0 ml-2" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
