export const API_URL = import.meta.env['VITE_API_URL'] || "http://localhost:8000";

export function getAvatarUrl(url: string | null | undefined, fallbackName: string) {
  if (url && typeof url === "string" && url.trim() !== "") {
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
      return url;
    }
    const cleanUrl = url.startsWith("/") ? url : `/${url}`;
    return `${API_URL}${cleanUrl}`;
  }
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackName || 'User')}&background=random`;
}
