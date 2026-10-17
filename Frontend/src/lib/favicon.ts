// Favicon uploaded in Admin Settings → Company Identity (stored as a data URL)
export const FAVICON_STORAGE_KEY = "app-theme-favicon";

/** The uploaded favicon, or undefined when none is set (callers then show no icon). */
export function getAppFavicon(): string | undefined {
  try {
    return localStorage.getItem(FAVICON_STORAGE_KEY) || undefined;
  } catch {
    return undefined;
  }
}

/** Hand the favicon to the service worker so push notifications use it too. */
export function syncFaviconToServiceWorker(url: string) {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.ready
    .then(reg => reg.active?.postMessage({ type: "SET_FAVICON", url }))
    .catch(() => {});
}
