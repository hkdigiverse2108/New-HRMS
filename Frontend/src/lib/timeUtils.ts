/**
 * Common Centralized Indian Standard Time (IST, UTC+5:30) utility.
 * Enforces rule: All date/time displayed anywhere in the UI MUST be shown in IST.
 */

// IST is UTC + 5 hours 30 minutes = +330 minutes
const IST_OFFSET_MINUTES = 330;

/**
 * Converts any date string, timestamp, or Date object to an IST Date representation.
 */
export function toIST(dateInput: string | number | Date | null | undefined): Date | null {
  if (!dateInput || dateInput === "--") return null;

  let d: Date;
  if (dateInput instanceof Date) {
    d = new Date(dateInput.getTime());
  } else if (typeof dateInput === "number") {
    d = new Date(dateInput);
  } else {
    // If it's pure date "YYYY-MM-DD", treat as start of day in IST
    const match = String(dateInput).trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (match && match[1] && match[2] && match[3]) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const day = parseInt(match[3], 10);
      return new Date(year, month, day);
    }
    d = new Date(dateInput);
  }

  if (isNaN(d.getTime())) return null;

  return d;
}

/**
 * Formats a date into IST date string according to chosen pattern.
 * Default: 'MMM DD, YYYY' or 'DD/MM/YYYY'
 */
export function formatISTDate(
  dateInput: string | number | Date | null | undefined,
  pattern: "DD/MM/YYYY" | "YYYY-MM-DD" | "MMM DD, YYYY" | "DD MMM YYYY" = "MMM DD, YYYY"
): string {
  const d = toIST(dateInput);
  if (!d) return "--";

  const options: Intl.DateTimeFormatOptions = {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  };

  const formatter = new Intl.DateTimeFormat("en-IN", options);
  const parts = formatter.formatToParts(d);
  const day = parts.find((p) => p.type === "day")?.value.padStart(2, "0") || "";
  const monthNum = parts.find((p) => p.type === "month")?.value.padStart(2, "0") || "";
  const year = parts.find((p) => p.type === "year")?.value || "";

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const mIndex = parseInt(monthNum, 10) - 1;
  const shortMonth = monthNames[mIndex] || monthNum;

  switch (pattern) {
    case "DD/MM/YYYY":
      return `${day}/${monthNum}/${year}`;
    case "YYYY-MM-DD":
      return `${year}-${monthNum}-${day}`;
    case "DD MMM YYYY":
      return `${day} ${shortMonth} ${year}`;
    case "MMM DD, YYYY":
    default:
      return `${shortMonth} ${day}, ${year}`;
  }
}

/**
 * Formats any time or date input into IST 12-hour format e.g. "09:30 AM" or "06:45 PM".
 */
export function formatISTTime(dateInput: string | number | Date | null | undefined): string {
  if (!dateInput || dateInput === "--") return "--:--";

  // If already formatted like "09:30 AM", return directly
  if (typeof dateInput === "string") {
    const trimmed = dateInput.trim();
    if (/^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(trimmed)) {
      return trimmed.toUpperCase();
    }
    // If "HH:MM" or "HH:MM:SS"
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(trimmed)) {
      const parts = trimmed.split(":");
      const hStr = parts[0] || "0";
      const mStr = parts[1] || "00";
      let h = parseInt(hStr, 10);
      const m = mStr.padStart(2, "0");
      const ampm = h >= 12 ? "PM" : "AM";
      h = h % 12 || 12;
      return `${String(h).padStart(2, "0")}:${m} ${ampm}`;
    }
  }

  const d = toIST(dateInput);
  if (!d) return "--:--";

  const options: Intl.DateTimeFormatOptions = {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  };

  return new Intl.DateTimeFormat("en-IN", options).format(d);
}

/**
 * Formats full IST date and time e.g. "Sep 11, 2026, 09:30 AM".
 */
export function formatISTDateTime(dateInput: string | number | Date | null | undefined): string {
  const d = toIST(dateInput);
  if (!d) return "--";

  const datePart = formatISTDate(d, "MMM DD, YYYY");
  const timePart = formatISTTime(d);
  return `${datePart}, ${timePart}`;
}

/**
 * Formats date and time into 12-hour IST format: "12 Sep 2026 04:32 PM"
 */
export function formatAppliedOnIST(dateInput: string | number | Date | null | undefined): string {
  if (!dateInput || dateInput === "--") return "--";
  const d = toIST(dateInput);
  if (!d) return "--";

  const datePart = formatISTDate(d, "DD MMM YYYY");

  // If input was purely a date string (YYYY-MM-DD) without time information
  if (typeof dateInput === "string" && /^\d{4}-\d{1,2}-\d{1,2}$/.test(dateInput.trim())) {
    return datePart;
  }

  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  const timePart = timeFormatter.format(d).toUpperCase();

  return `${datePart} ${timePart}`;
}

/**
 * Formats duration in hours/minutes e.g. "8h 30m" or "0.5h".
 */
export function formatDurationHours(hoursDec: number | null | undefined): string {
  if (hoursDec === null || hoursDec === undefined || isNaN(hoursDec)) return "-";
  // Defensive guard: A duration > 24 hours for daily attendance/break is physically impossible.
  // It is raw seconds accidentally passed to this function.
  if (hoursDec > 24) {
    return formatDurationSeconds(hoursDec);
  }
  const totalMins = Math.round(hoursDec * 60);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Formats duration from raw seconds into readable "0h 0m", "15m 30s", "45s", or "1h 15m".
 */
export function formatDurationSeconds(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || isNaN(seconds) || seconds <= 0) return "0h 0m";
  const totalSec = Math.round(seconds);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h === 0 && m === 0) return `${s}s`;
  if (h === 0) return `${m}m ${s}s`;
  return `${h}h ${m}m`;
}

/**
 * Formats seconds into HH:MM:SS format for live stopwatch.
 */
export function formatStopwatchTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Helper to parse time string like "09:30 AM", "18:30" to minutes from midnight for comparison.
 */
export function parseTimeToMinutes(timeStr: string): number | null {
  if (!timeStr || timeStr === "--") return null;
  const trimmed = timeStr.trim();

  // Check for 12-hour format e.g. "09:30 AM" or "9:30pm"
  const match12 = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12 && match12[1] && match12[2] && match12[3]) {
    let hours = parseInt(match12[1], 10);
    const minutes = parseInt(match12[2], 10);
    const ampm = match12[3].toUpperCase();
    if (ampm === "PM" && hours < 12) hours += 12;
    if (ampm === "AM" && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }

  // Check for 24-hour format e.g. "18:30" or "09:30:00"
  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (match24 && match24[1] && match24[2]) {
    const hours = parseInt(match24[1], 10);
    const minutes = parseInt(match24[2], 10);
    return hours * 60 + minutes;
  }

  return null;
}

/**
 * Validates if timeStrA is strictly after timeStrB within the same day.
 */
export function isTimeStrictlyAfter(timeStrA: string, timeStrB: string): boolean {
  const minA = parseTimeToMinutes(timeStrA);
  const minB = parseTimeToMinutes(timeStrB);
  if (minA === null || minB === null) return false;
  return minA > minB;
}

/**
 * Returns today's date in IST formatted as "YYYY-MM-DD".
 */
export function getTodayDateIST(): string {
  return formatISTDate(new Date(), "YYYY-MM-DD");
}
