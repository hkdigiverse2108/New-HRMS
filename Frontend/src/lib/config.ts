import type { SyntheticEvent } from "react";

/**
 * Resolves API URL with priority:
 * 1. Explicit runtime VITE_API_URL from window.__ENV__ (injected live from .env by start.py/run-preview.mjs).
 * 2. Explicit build-time import.meta.env.VITE_API_URL.
 * 3. If running in browser on a production domain (e.g. new-hrms.hkdigiverse.com) and VITE_API_URL
 *    points to localhost, intelligently route to https://api-new-hrms.hkdigiverse.com.
 * 4. Default to http://localhost:8000 for local development.
 */
export function resolveApiUrl(): string {
  // 1. Live runtime environment injected via /env-config.js
  let envUrl = "";
  if (typeof window !== "undefined" && (window as any).__ENV__?.VITE_API_URL) {
    envUrl = String((window as any).__ENV__.VITE_API_URL).trim();
  }

  // 2. Build-time statically inlined env
  if (!envUrl) {
    envUrl = (import.meta.env['VITE_API_URL'] || "").trim();
  }

  if (typeof window !== "undefined" && window.location) {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";

    // If client is on a remote domain (not localhost)
    if (!isLocalhost) {
      // If envUrl is explicitly provided and does NOT point to localhost, use it directly!
      if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
        return envUrl.replace(/\/+$/, "");
      }

      // If envUrl was missing or mistakenly inlined as localhost during build:
      if (hostname.startsWith("new-hrms.")) {
        return `${protocol}//api-${hostname}`;
      } else if (hostname.includes(".")) {
        return `${protocol}//api.${hostname}`;
      }
    }
  }

  if (envUrl && envUrl !== "undefined" && envUrl !== "null") {
    return envUrl.replace(/\/+$/, "");
  }

  return "http://localhost:8000";
}

export function getApiUrl(): string {
  return resolveApiUrl();
}

export const API_URL = resolveApiUrl();


export function uiAvatar(name: string) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=random`;
}

export function getAvatarUrl(_url: string | null | undefined, fallbackName: string) {
  // Employee photos REMOVED (no need) — always initials avatar.
  // This guarantees the browser never fires /images/* requests for legacy photo names.
  return uiAvatar(fallbackName);
}

// <img onError={handleAvatarError} /> — legacy /images/* paths whose files are
// gone from the server 404; swap to initials instead of a broken icon.
export function handleAvatarError(e: SyntheticEvent<HTMLImageElement>) {
  const t = e.currentTarget;
  if (!t.dataset["avatarFallback"]) {
    t.dataset["avatarFallback"] = "1";
    t.src = uiAvatar(t.alt);
  }
}
