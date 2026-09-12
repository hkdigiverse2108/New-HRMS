import * as React from "react";
import { format, subDays, startOfMonth, endOfMonth, subMonths, isAfter, isBefore } from "date-fns";
import { Calendar as CalendarIcon, X, Check, ChevronDown } from "lucide-react";
import { DateRange } from "react-day-picker";
import { cn, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";

export interface DateRangeFilterProps {
  value?: DateRange | { from?: Date; to?: Date } | undefined;
  dateRange?: DateRange | { from?: Date; to?: Date } | undefined;
  onChange?: (range: any) => void;
  placeholder?: string;
  className?: string;
  align?: "start" | "center" | "end";
  showPresets?: boolean;
  minDate?: Date;
  maxDate?: Date;
}

interface PresetOption {
  label: string;
  getRange: () => { from: Date; to: Date };
}

export function DateRangeFilter({
  value,
  dateRange,
  onChange,
  placeholder = "Pick a date range",
  className,
  align = "end",
  showPresets = true,
  minDate,
  maxDate,
}: DateRangeFilterProps) {
  const effectiveValue = (value !== undefined ? value : dateRange) as DateRange | undefined;
  const [internalRange, setInternalRange] = React.useState<DateRange | undefined>(effectiveValue);
  const [isOpen, setIsOpen] = React.useState(false);
  const isMobile = useIsMobile();

  // Sync with controlled value
  React.useEffect(() => {
    setInternalRange(effectiveValue);
  }, [effectiveValue]);

  const presets: PresetOption[] = React.useMemo(
    () => [
      {
        label: "Today",
        getRange: () => {
          const now = new Date();
          return { from: now, to: now };
        },
      },
      {
        label: "Yesterday",
        getRange: () => {
          const y = subDays(new Date(), 1);
          return { from: y, to: y };
        },
      },
      {
        label: "Last 7 Days",
        getRange: () => ({
          from: subDays(new Date(), 6),
          to: new Date(),
        }),
      },
      {
        label: "Last 30 Days",
        getRange: () => ({
          from: subDays(new Date(), 29),
          to: new Date(),
        }),
      },
      {
        label: "This Month",
        getRange: () => ({
          from: startOfMonth(new Date()),
          to: endOfMonth(new Date()),
        }),
      },
      {
        label: "Last Month",
        getRange: () => {
          const prev = subMonths(new Date(), 1);
          return {
            from: startOfMonth(prev),
            to: endOfMonth(prev),
          };
        },
      },
    ],
    []
  );

  const handleSelect = (selected: DateRange | undefined) => {
    if (!selected) {
      setInternalRange(undefined);
      onChange?.(undefined);
      return;
    }

    // Validation: if both from and to are present, ensure to >= from
    if (selected.from && selected.to && isBefore(selected.to, selected.from)) {
      // Auto-swap if user clicked in reverse
      const corrected: DateRange = { from: selected.to, to: selected.from };
      setInternalRange(corrected);
      onChange?.(corrected);
      return;
    }

    setInternalRange(selected);
    // If complete range is chosen or single from is chosen, pass to parent
    onChange?.(selected);
  };

  const handleApplyPreset = (preset: PresetOption) => {
    const range = preset.getRange();
    setInternalRange(range);
    onChange?.(range);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setInternalRange(undefined);
    onChange?.(undefined);
  };

  const hasRange = Boolean(internalRange?.from);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "group flex items-center justify-between gap-2 px-3.5 py-2 bg-white border border-border/70 rounded-xl text-xs sm:text-sm font-semibold text-foreground/80 shadow-sm transition-all duration-200 hover:bg-muted/40 hover:border-border focus:outline-none focus:ring-2 focus:ring-primary/20 active:scale-[0.99] max-w-full truncate",
            !hasRange && "text-muted-foreground",
            className
          )}
        >
          <div className="flex items-center gap-2 min-w-0 truncate">
            <CalendarIcon className="h-4 w-4 text-primary/80 shrink-0" />
            <span className="truncate">
              {internalRange?.from ? (
                internalRange.to ? (
                  <>
                    <span className="font-bold text-foreground">{formatDate(internalRange.from)}</span>
                    <span className="mx-1 text-muted-foreground font-normal">to</span>
                    <span className="font-bold text-foreground">{formatDate(internalRange.to)}</span>
                  </>
                ) : (
                  <span className="font-bold text-foreground">From {formatDate(internalRange.from)}</span>
                )
              ) : (
                <span>{placeholder}</span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-1">
            {hasRange && (
              <span
                role="button"
                tabIndex={0}
                onClick={handleClear}
                onKeyDown={(e) => e.key === "Enter" && handleClear(e as any)}
                className="p-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="Clear date filter"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform duration-200", isOpen && "rotate-180")} />
          </div>
        </button>
      </PopoverTrigger>

      <PopoverContent
        align={align}
        sideOffset={6}
        collisionPadding={8}
        className="w-[calc(100vw-20px)] sm:w-auto p-0 rounded-2xl shadow-2xl border border-border/70 bg-card overflow-hidden max-w-[340px] sm:max-w-none max-h-[88vh] overflow-y-auto z-[70]"
      >
        <div className="flex flex-col sm:flex-row w-full max-w-full min-w-0">
          {showPresets && (
            <div className="flex sm:flex-col gap-1 p-2 sm:p-3 border-b sm:border-b-0 sm:border-r border-border/50 bg-muted/20 overflow-x-auto max-w-full shrink-0">
              <span className="hidden sm:block text-[10px] font-black uppercase tracking-wider text-muted-foreground px-2 py-1 mb-1">
                Quick Ranges
              </span>
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className="px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold text-left whitespace-nowrap text-foreground/80 hover:bg-primary/10 hover:text-primary transition-colors active:scale-95 shrink-0"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          )}

          <div className="p-2 sm:p-3 flex flex-col min-w-0 flex-1 max-w-full overflow-hidden">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={internalRange?.from || new Date()}
              selected={internalRange}
              onSelect={handleSelect}
              numberOfMonths={isMobile ? 1 : 2}
              disabled={(date) => {
                if (minDate && isBefore(date, minDate)) return true;
                if (maxDate && isAfter(date, maxDate)) return true;
                return false;
              }}
              className="p-0 w-full flex justify-center"
            />

            <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-border/50 text-xs gap-2 min-w-0">
              <span className="text-muted-foreground text-[10px] sm:text-[11px] truncate flex-1 min-w-0">
                {internalRange?.from && internalRange?.to
                  ? `${format(internalRange.from, "MMM dd, yyyy")} - ${format(internalRange.to, "MMM dd, yyyy")}`
                  : "Select start and end date"}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                {hasRange && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setInternalRange(undefined);
                      onChange?.(undefined);
                    }}
                    className="h-7 px-2 text-[11px] sm:text-xs text-muted-foreground hover:text-foreground"
                  >
                    Reset
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  className="h-7 px-2.5 sm:px-3 text-[11px] sm:text-xs font-bold rounded-lg"
                >
                  Done
                </Button>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
