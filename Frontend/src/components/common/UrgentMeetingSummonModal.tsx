import React, { useState, useEffect } from "react";
import { 
  BellRing, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  ExternalLink, 
  AlertTriangle, 
  X,
  Volume2
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";
import { getAuthToken } from "@/lib/api";
import { getApiUrl } from "@/lib/config";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface SummonEvent {
  summon_id: string;
  caller_name: string;
  caller_role: string;
  location: string;
  notes: string;
  meet_link?: string;
  timestamp: string;
}

// Simple Web Audio API synthesizer for urgent alert beep
function playUrgentAlertTone() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    
    // Triple beep
    [0, 0.18, 0.36].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, now + offset); // A5
      osc.frequency.exponentialRampToValueAtTime(1174, now + offset + 0.12); // D6
      gain.gain.setValueAtTime(0.3, now + offset);
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
                location: data.location || "Meeting Room",
                notes: data.notes || "Urgent meeting requested immediately.",
                meet_link: data.meet_link,
                timestamp: data.timestamp || new Date().toISOString()
              };
              setActiveSummon(summon);
              playUrgentAlertTone();
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
          setActiveSummon(ev.data);
          playUrgentAlertTone();
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
  }, [user?.id]);

  if (!activeSummon) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
      <div className="relative w-full max-w-lg bg-card border-2 border-rose-500 rounded-[2.5rem] shadow-2xl overflow-hidden p-6 md:p-8 space-y-6 animate-bounce-subtle">
        {/* Pulsing Alert Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3.5 bg-rose-500/15 text-rose-600 rounded-2xl border border-rose-500/30 animate-pulse">
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
            <div className="text-base font-extrabold text-foreground flex items-center gap-2">
              <span>{activeSummon.caller_name}</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-primary/10 text-primary">
                {activeSummon.caller_role}
              </span>
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
                Time Summoned
              </span>
              <div className="text-xs font-medium text-muted-foreground font-mono">
                {new Date(activeSummon.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
            </div>
          </div>

          {activeSummon.notes && (
            <div className="pt-3 border-t border-border/40">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                Instructions / Message
              </span>
              <p className="text-xs font-medium text-foreground leading-relaxed bg-card p-3 rounded-2xl border border-border/50">
                "{activeSummon.notes}"
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
            <span>I'm On My Way / Acknowledge</span>
          </button>
        </div>
      </div>
    </div>
  );
}
