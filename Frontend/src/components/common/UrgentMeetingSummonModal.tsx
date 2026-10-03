import React, { useState, useEffect, useCallback } from "react";
import { 
  BellRing, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  ExternalLink, 
  X,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";
import { getAuthToken } from "@/lib/api";
import { getApiUrl } from "@/lib/config";

interface SummonEvent {
  summon_id: string;
  caller_name: string;
  caller_role: string;
  caller_avatar?: string | undefined;
  location: string;
  notes: string;
  meet_link?: string | undefined;
  timestamp: string;
}

// Format timestamp accurately to Indian Standard Time (IST)
function formatToIST(timestamp?: string | number | Date): string {
  if (!timestamp) return "";
  try {
    let dateStr = String(timestamp).trim();
    // If ISO string without timezone offset or Z, treat as UTC
    if (!dateStr.endsWith("Z") && !dateStr.includes("+") && !dateStr.includes("-", 10)) {
      dateStr += "Z";
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      return String(timestamp);
    }
    return d.toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  } catch {
    return String(timestamp);
  }
}

// Convert relative avatar path to full backend image URL
function getFullAvatarUrl(avatar?: string): string {
  if (!avatar) return "/favicon.ico";
  if (avatar.startsWith("http://") || avatar.startsWith("https://") || avatar.startsWith("data:")) {
    return avatar;
  }
  const apiUrl = getApiUrl().replace(/\/$/, "");
  const path = avatar.startsWith("/") ? avatar : `/${avatar}`;
  return `${apiUrl}${path}`;
}

// Simple Web Audio API synthesizer for urgent alert beep
function playUrgentAlertTone() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    
    // Triple loud alerting beep
    [0, 0.18, 0.36].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, now + offset); // A5
      osc.frequency.exponentialRampToValueAtTime(1174, now + offset + 0.12); // D6
      gain.gain.setValueAtTime(0.35, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.01, now + offset + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.12);
    });
  } catch {
    // AudioContext might be blocked until user gesture, quiet fail
  }
}

export function UrgentMeetingSummonModal() {
  const { user } = useAuth();
  const [activeSummon, setActiveSummon] = useState<SummonEvent | null>(null);

  const triggerSummonAlert = useCallback((summon: SummonEvent) => {
    setActiveSummon(summon);
    playUrgentAlertTone();

    // 1. Try to bring browser window to focus immediately
    try {
      window.focus();
    } catch {}

    // 2. Fire high-priority desktop notification so user sees it over WhatsApp or any other app
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      try {
        const avatarUrl = summon.caller_avatar ? getFullAvatarUrl(summon.caller_avatar) : "/favicon.ico";
        const notif = new Notification(`🚨 URGENT SUMMON: ${summon.caller_name}`, {
          body: `Report immediately to ${summon.location}. Instructions: "${summon.notes}"`,
          icon: avatarUrl,
          badge: "/favicon.ico",
          requireInteraction: true,
          tag: `summon-${summon.summon_id}`,
        });
        notif.onclick = () => {
          try {
            window.focus();
          } catch {}
          setActiveSummon(summon);
          notif.close();
        };
      } catch (e) {
        console.warn("[Summon] Desktop notification trigger:", e);
      }
    }
  }, []);

  // 1. Check URL parameters on mount (when opened via push notification or direct link)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("meeting_summon") === "1" || params.get("summon_id")) {
      const summonFromUrl: SummonEvent = {
        summon_id: params.get("summon_id") || String(Date.now()),
        caller_name: params.get("caller_name") || "Team Leader",
        caller_role: params.get("caller_role") || "Admin",
        caller_avatar: params.get("caller_avatar") || undefined,
        location: params.get("location") || "Meeting Room",
        notes: params.get("notes") || "Urgent meeting requested immediately.",
        meet_link: params.get("meet_link") || undefined,
        timestamp: params.get("timestamp") || new Date().toISOString(),
      };
      triggerSummonAlert(summonFromUrl);

      // Clean query params so refresh doesn't keep stale summon
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("meeting_summon");
        url.searchParams.delete("summon_id");
        url.searchParams.delete("caller_name");
        url.searchParams.delete("caller_role");
        url.searchParams.delete("caller_avatar");
        url.searchParams.delete("location");
        url.searchParams.delete("notes");
        url.searchParams.delete("meet_link");
        url.searchParams.delete("timestamp");
        window.history.replaceState({}, "", url.pathname + (url.search ? url.search : "") + url.hash);
      } catch {}
    }
  }, [triggerSummonAlert]);

  // 2. Listen for Service Worker messages (when user clicks desktop notification)
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "OPEN_MEETING_SUMMON" || event.data?.type === "NOTIFICATION_CLICK") {
        const data = event.data?.summonData || event.data?.data;
        if (data && (data.type === "meeting_summon" || data.action === "meeting_summon" || data.summon_id)) {
          const summon: SummonEvent = {
            summon_id: data.summon_id || String(Date.now()),
            caller_name: data.caller_name || "Team Leader",
            caller_role: data.caller_role || "Admin",
            caller_avatar: data.caller_avatar || data.sender_avatar,
            location: data.location || "Meeting Room",
            notes: data.notes || "Urgent meeting requested immediately.",
            meet_link: data.meet_link,
            timestamp: data.timestamp || new Date().toISOString(),
          };
          triggerSummonAlert(summon);
        }
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => {
      navigator.serviceWorker.removeEventListener("message", handler);
    };
  }, [triggerSummonAlert]);

  // 3. Connect WebSocket & BroadcastChannel for real-time live events
  useEffect(() => {
    if (!user?.id) return;

    let isDisposed = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: any = null;

    const connectWs = () => {
      if (isDisposed) return;
      try {
        const token = getAuthToken();
        const apiUrl = getApiUrl();
        const isSsl = apiUrl.startsWith("https://");
        const wsHost = apiUrl.replace(/^https?:\/\//, "");
        const wsUrl = `${isSsl ? "wss://" : "ws://"}${wsHost}/chat/ws/${user.id}${token ? `?token=${token}` : ""}`;

        socket = new WebSocket(wsUrl);

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "meeting_summon" || data.action === "meeting_summon") {
              const summon: SummonEvent = {
                summon_id: data.summon_id || String(Date.now()),
                caller_name: data.caller_name || "Team Leader",
                caller_role: data.caller_role || "Admin",
                caller_avatar: data.caller_avatar,
                location: data.location || "Meeting Room",
                notes: data.notes || "Urgent meeting requested immediately.",
                meet_link: data.meet_link,
                timestamp: data.timestamp || new Date().toISOString()
              };
              triggerSummonAlert(summon);
            } else if (data.action === "new_message" || (data.type === "message" && data.content) || (data.content && data.channel_id)) {
              // Real-time chat message broadcast event (actual messages only)
              window.dispatchEvent(new CustomEvent("hrms:chat_message", { detail: data }));
            } else if (data.type === "notification" || data.type === "leave" || data.type === "penalty") {
              // Real-time notification update event
              window.dispatchEvent(new CustomEvent("hrms:notification_update", { detail: data }));
            }
          } catch {
            // quiet ignore non-json
          }
        };

        socket.onclose = () => {
          if (!isDisposed) {
            reconnectTimer = setTimeout(connectWs, 5000);
          }
        };

        socket.onerror = () => {
          try { socket?.close(); } catch {}
        };
      } catch {
        if (!isDisposed) {
          reconnectTimer = setTimeout(connectWs, 5000);
        }
      }
    };

    connectWs();

    // Also listen for in-browser local broadcast channel for same-machine testing
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("hrms_meeting_summon");
      bc.onmessage = (ev) => {
        if (ev.data && (ev.data.target_id === user.id || ev.data.target_id === (user as any)._id)) {
          triggerSummonAlert(ev.data);
        }
      };
    } catch {}

    return () => {
      isDisposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket) {
        try { socket.close(); } catch {}
      }
      if (bc) {
        try { bc.close(); } catch {}
      }
    };
  }, [user?.id, triggerSummonAlert]);

  if (!activeSummon) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
      <div className="relative w-full max-w-lg bg-card border-2 border-rose-500 rounded-[2.5rem] shadow-2xl overflow-hidden p-6 md:p-8 space-y-6 animate-bounce-subtle">
        {/* Pulsing Alert Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3.5 bg-rose-500/15 text-rose-600 rounded-2xl border border-rose-500/30 animate-pulse shrink-0">
              <BellRing className="w-8 h-8 stroke-[2.5]" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 text-[10px] font-black uppercase tracking-widest border border-rose-500/20 mb-1">
                <span>🚨 Action Required</span>
              </div>
              <h2 className="text-xl md:text-2xl font-black text-foreground tracking-tight">
                Urgent Meeting Summon!
              </h2>
            </div>
          </div>
          <button
            onClick={() => setActiveSummon(null)}
            className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summon Information Box */}
        <div className="bg-muted/30 border border-border/60 rounded-3xl p-5 space-y-4">
          <div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
              Summoned By
            </span>
            <div className="text-base font-extrabold text-foreground flex items-center gap-3">
              {activeSummon.caller_avatar ? (
                <img
                  src={getFullAvatarUrl(activeSummon.caller_avatar)}
                  alt={activeSummon.caller_name}
                  className="w-9 h-9 rounded-full object-cover border border-border/70 shadow-sm shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/favicon.ico";
                  }}
                />
              ) : null}
              <div className="flex items-center gap-2">
                <span>{activeSummon.caller_name}</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-primary/10 text-primary">
                  {activeSummon.caller_role}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-border/40">
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1">
                <MapPin className="w-3.5 h-3.5 text-rose-500" />
                Location / Meet Link
              </span>
              <div className="text-xs font-extrabold text-foreground font-mono">
                {activeSummon.location}
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                Time Summoned (IST)
              </span>
              <div className="text-xs font-bold text-foreground font-mono">
                {formatToIST(activeSummon.timestamp)}
              </div>
            </div>
          </div>

          {activeSummon.notes && (
            <div className="pt-3 border-t border-border/40">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                Instructions / Message
              </span>
              <p className="text-xs font-medium text-foreground leading-relaxed bg-card p-3 rounded-2xl border border-border/50">
                &ldquo;{activeSummon.notes}&rdquo;
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          {activeSummon.meet_link && (
            <a
              href={activeSummon.meet_link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setActiveSummon(null)}
              className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-2xl text-center shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Join Online Meeting</span>
            </a>
          )}
          <button
            type="button"
            onClick={() => {
              setActiveSummon(null);
            }}
            className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-2xl text-center shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>I&apos;m On My Way / Acknowledge</span>
          </button>
        </div>
      </div>
    </div>
  );
}
