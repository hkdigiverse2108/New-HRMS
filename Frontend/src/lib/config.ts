export const API_URL = import.meta.env['VITE_API_URL'] || "http://localhost:8000";

export function getAvatarUrl(url: string | null | undefined, fallbackName: string) {
  if (url) return url;
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackName || 'User')}&background=random`;
}
