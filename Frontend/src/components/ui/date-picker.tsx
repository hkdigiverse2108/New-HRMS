"use client";

import * as React from "react";
import { format, isValid, isBefore, isAfter, startOfToday } from "date-fns";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface DatePickerProps {
  value?: string | Date | null | undefined;
  onChange?: ((dateString: string, dateObj?: Date) => void) | undefined;
  placeholder?: string | undefined;
  className?: string | undefined;
  disabled?: boolean | undefined;
  minDate?: string | Date | undefined;
  maxDate?: string | Date | undefined;
  fromYear?: number | undefined;
  toYear?: number | undefined;
  displayFormat?: string | undefined; // e.g. "dd/MM/yyyy", "dd-MM-yyyy", "MMM dd, yyyy"
  valueFormat?: string | undefined; // default "yyyy-MM-dd"
  clearable?: boolean | undefined;
  id?: string | undefined;
  name?: string | undefined;
  required?: boolean | undefined;
  align?: "start" | "center" | "end" | undefined;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function parseDate(val: string | Date | null | undefined): Date | undefined {
  if (!val) return undefined;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? undefined : val;
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed) return undefined;
    // YYYY-MM-DD format support
    const match = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (match && match[1] && match[2] && match[3]) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const day = parseInt(match[3], 10);
      const d = new Date(year, month, day);
      return isValid(d) ? d : undefined;
    }
    const d = new Date(trimmed);
    return isValid(d) ? d : undefined;
  }
  return undefined;
}

function formatDateToStr(date: Date | undefined, formatStr: string = "yyyy-MM-dd"): string {
  if (!date || !isValid(date)) return "";
  if (formatStr === "yyyy-MM-dd") {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return format(date, formatStr);
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Select date",
  className,
  disabled = false,
  minDate,
  maxDate,
  fromYear = 1940,
  toYear = 2050,
  displayFormat = "dd/MM/yyyy",
  valueFormat = "yyyy-MM-dd",
  clearable = true,
  id,
  name,
  align = "start",
}: DatePickerProps) {
  const selectedDate = React.useMemo(() => parseDate(value), [value]);
  const minDateObj = React.useMemo(() => parseDate(minDate), [minDate]);
  const maxDateObj = React.useMemo(() => parseDate(maxDate), [maxDate]);

  const [isOpen, setIsOpen] = React.useState(false);
  const [currentMonth, setCurrentMonth] = React.useState<Date>(() => selectedDate || new Date());

  // Keep calendar month aligned with selected date when value changes or popover opens
  React.useEffect(() => {
    if (selectedDate && isValid(selectedDate)) {
      setCurrentMonth(selectedDate);
    }
  }, [selectedDate, isOpen]);

  const years = React.useMemo(() => {
    const list: number[] = [];
    for (let y = toYear; y >= fromYear; y--) {
      list.push(y);
    }
    return list;
  }, [fromYear, toYear]);

  const handleDaySelect = (day: Date | undefined) => {
    if (!day) {
      if (clearable) {
        onChange?.("", undefined);
      }
      setIsOpen(false);
      return;
    }

    const strValue = formatDateToStr(day, valueFormat);
    onChange?.(strValue, day);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange?.("", undefined);
  };

  const handleSelectToday = () => {
    const today = startOfToday();
    const strValue = formatDateToStr(today, valueFormat);
    setCurrentMonth(today);
    onChange?.(strValue, today);
    setIsOpen(false);
  };

  const handlePrevMonth = () => {
    setCurrentMonth((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() - 1);
      return d;
    });
  };

  const handleNextMonth = () => {
    setCurrentMonth((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + 1);
      return d;
    });
  };

  const handleMonthChange = (monthIdx: number) => {
    setCurrentMonth((prev) => {
      const d = new Date(prev);
      d.setMonth(monthIdx);
      return d;
    });
  };

  const handleYearChange = (yearVal: number) => {
    setCurrentMonth((prev) => {
      const d = new Date(prev);
      d.setFullYear(yearVal);
      return d;
    });
  };

  const displayText = selectedDate && isValid(selectedDate) ? format(selectedDate, displayFormat) : "";

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          name={name}
          disabled={disabled}
          className={cn(
            "w-full flex items-center justify-between px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm font-medium text-left transition-all",
            "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50",
            "hover:bg-muted/70 hover:border-border/80",
            disabled && "opacity-60 cursor-not-allowed",
            !displayText && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{displayText || placeholder}</span>

          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            {clearable && displayText && !disabled && (
              <span
                role="button"
                tabIndex={0}
                onClick={handleClear}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleClear(e as any);
                  }
                }}
                className="p-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="Clear date"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
        </button>
      </PopoverTrigger>

      <PopoverContent
        align={align}
        sideOffset={6}
        className="w-auto p-3 rounded-2xl shadow-2xl border border-border/70 bg-card z-[70] max-w-[calc(100vw-24px)] overflow-hidden"
      >
        <div className="space-y-3">
          {/* Header with Month & Year Selectors */}
          <div className="flex items-center justify-between gap-1.5 pb-2 border-b border-border/50">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handlePrevMonth}
              className="h-7 w-7 p-0 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground shrink-0"
              title="Previous Month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-1.5 min-w-0">
              <select
                value={currentMonth.getMonth()}
                onChange={(e) => handleMonthChange(parseInt(e.target.value, 10))}
                className="h-7 px-2 text-xs font-bold bg-muted/60 hover:bg-muted border border-border/60 rounded-lg cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={name} value={idx}>
                    {name}
                  </option>
                ))}
              </select>

              <select
                value={currentMonth.getFullYear()}
                onChange={(e) => handleYearChange(parseInt(e.target.value, 10))}
                className="h-7 px-2 text-xs font-bold bg-muted/60 hover:bg-muted border border-border/60 rounded-lg cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleNextMonth}
              className="h-7 w-7 p-0 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground shrink-0"
              title="Next Month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* DayPicker Calendar Grid */}
          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDaySelect}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              disabled={(date) => {
                if (minDateObj && isBefore(date, minDateObj)) return true;
                if (maxDateObj && isAfter(date, maxDateObj)) return true;
                return false;
              }}
              className="p-0 pointer-events-auto"
            />
          </div>

          {/* Footer Quick Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs">
            {clearable && displayText ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  onChange?.("", undefined);
                  setIsOpen(false);
                }}
                className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                Clear
              </Button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSelectToday}
                className="h-7 px-2.5 text-xs font-semibold rounded-lg"
              >
                Today
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="h-7 px-3 text-xs font-bold rounded-lg"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
