import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string | Date | undefined): string {
  if (!dateString) return "-";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return String(dateString);

    const format = typeof window !== 'undefined' 
      ? (localStorage.getItem('hrms_date_format') || 'MMM DD, YYYY') 
      : 'MMM DD, YYYY';

    const day = String(d.getDate()).padStart(2, '0');
    const monthNum = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const shortMonth = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(d);

    switch (format) {
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
