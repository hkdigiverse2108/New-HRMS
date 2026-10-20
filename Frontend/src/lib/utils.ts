import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Company-wide display preferences (Admin Settings → System Preferences). The server copy is the source of
// truth; ThemeProvider mirrors it into localStorage so these helpers can read it synchronously anywhere.
export const DATE_FORMAT_KEY = "hrms_date_format";
export const NAME_FORMAT_KEY = "hrms_name_format";

export type DateFormatSetting = "DD/MM/YYYY" | "MM/DD/YYYY" | "DD MMM YYYY" | "MMM DD, YYYY" | "YYYY-MM-DD";
export type NameFormatSetting = "First Last" | "Last, First" | "First M. Last" | "Last, First M.";

const DATE_FNS_PATTERNS: Record<DateFormatSetting, string> = {
  "DD/MM/YYYY": "dd/MM/yyyy",
  "MM/DD/YYYY": "MM/dd/yyyy",
  "DD MMM YYYY": "dd MMM yyyy",
  "MMM DD, YYYY": "MMM dd, yyyy",
  "YYYY-MM-DD": "yyyy-MM-dd",
};

function readSetting(key: string, fallback: string): string {
  try {
    return (typeof window !== "undefined" && localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

export function getDateFormat(): DateFormatSetting {
  const v = readSetting(DATE_FORMAT_KEY, "MMM DD, YYYY") as DateFormatSetting;
  return v in DATE_FNS_PATTERNS ? v : "MMM DD, YYYY";
}

export function getNameFormat(): NameFormatSetting {
  return readSetting(NAME_FORMAT_KEY, "First Last") as NameFormatSetting;
}

/** The chosen date format as a date-fns pattern, for `format(date, dateFnsPattern())`. */
export function dateFnsPattern(): string {
  return DATE_FNS_PATTERNS[getDateFormat()];
}

/** Parses "YYYY-MM-DD" as a local date (new Date() would read it as UTC and can land on the previous day). */
function parseDateInput(value: string | Date): Date {
  if (value instanceof Date) return value;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value).trim());
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
}

export function formatDate(dateString: string | Date | undefined | null): string {
  if (!dateString) return "-";
  try {
    const d = parseDateInput(dateString);
    if (isNaN(d.getTime())) return String(dateString);

    const day = String(d.getDate()).padStart(2, '0');
    const monthNum = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const shortMonth = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(d);

    switch (getDateFormat()) {
      case 'DD/MM/YYYY':
        return `${day}/${monthNum}/${year}`;
      case 'MM/DD/YYYY':
        return `${monthNum}/${day}/${year}`;
      case 'DD MMM YYYY':
        return `${day} ${shortMonth} ${year}`;
      case 'YYYY-MM-DD':
        return `${year}-${monthNum}-${day}`;
      case 'MMM DD, YYYY':
      default:
        return `${shortMonth} ${day}, ${year}`;
    }
  } catch (e) {
    return String(dateString);
  }
}

interface NameParts {
  first?: string | null;
  middle?: string | null;
  last?: string | null;
}

/** A person's name in the company-wide name format. Missing parts are skipped, never printed as "undefined". */
export function formatName({ first, middle, last }: NameParts, format: NameFormatSetting = getNameFormat()): string {
  const f = (first || "").trim();
  const m = (middle || "").trim();
  const l = (last || "").trim();
  const initial = m ? `${m.charAt(0).toUpperCase()}.` : "";
  const join = (...parts: string[]) => parts.filter(Boolean).join(" ");

  switch (format) {
    case "Last, First":
      return l && f ? `${l}, ${f}` : join(f, l);
    case "First M. Last":
      return join(f, initial, l);
    case "Last, First M.":
      return l && (f || initial) ? `${l}, ${join(f, initial)}` : join(f, initial, l);
    case "First Last":
    default:
      return join(f, l);
  }
}

/** Same, from an employee's `personal_info` object (as returned by the API). */
export function formatPersonName(personal: any): string {
  if (!personal) return "";
  return formatName({ first: personal.first_name, middle: personal.middle_name, last: personal.last_name });
}
