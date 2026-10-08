import { useState, useEffect, useCallback } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { CollapsibleSection } from "./CollapsibleSection";
import { useNavigate } from "@tanstack/react-router";

interface Notif {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at?: string;
  action_url?: string;
}

// Meeting PDF compulsory: dashboard top par notifications (aajna kaam + followups).
export function NotificationsStrip() {
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const navigate = useNavigate();

  const fetchNotifs = useCallback(async () => {
    try {
      const res = await api.get<any[]>("/notifications/me", { showLoader: false, showErrorToast: false });
      setNotifs(Array.isArray(res) ? res.slice(0, 8).map((n: any) => ({
        id: String(n.id || n._id),
        title: n.title || "Notification",
        message: n.message || "",
        type: n.type || "general",
        is_read: Boolean(n.is_read),
        created_at: n.created_at || "",
        action_url: n.action_url || undefined,
      })) : []);
    } catch {
      setNotifs([]);
    }
  }, []);

  useEffect(() => {
    fetchNotifs();
  }, [fetchNotifs]);

  const markAllRead = async () => {
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
    try {
      await api.put("/notifications/read-all", {}, { showLoader: false, showErrorToast: false });
    } catch {
      fetchNotifs();
    }
  };

  const unread = notifs.filter(n => !n.is_read).length;

  return (
    <div className="mb-12">
      <CollapsibleSection section="Notifications" title="Notifications & Follow-ups">
        <div className="bg-white border border-border/60 rounded-3xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Bell className="w-4 h-4 text-primary" />
                {unread > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center">
                    {unread}
                  </span>
                )}
              </div>
              <span className="text-xs font-bold text-muted-foreground">
                {unread > 0 ? `${unread} unread` : "All caught up"}
              </span>
            </div>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
              >
                <CheckCheck className="w-3.5 h-3.5" /> Mark all read
              </button>
            )}
          </div>
          {notifs.length === 0 ? (
            <p className="text-xs font-semibold text-muted-foreground/60 border border-dashed border-border/40 rounded-2xl px-4 py-3 text-center">No notifications.</p>
          ) : (
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {notifs.map(n => (
                <div
                  key={n.id}
                  className={cn(
                    "px-3.5 py-2.5 rounded-2xl border text-xs cursor-pointer transition-colors",
                    n.is_read ? "bg-muted/30 border-border/40 hover:bg-muted/50" : "bg-primary/5 border-primary/20 hover:bg-primary/10"
                  )}
                  onClick={async () => {
                    if (!n.is_read) {
                      setNotifs(prev => prev.map(item => item.id === n.id ? { ...item, is_read: true } : item));
                      try {
                        await api.put(`/notifications/${n.id}/read`, {}, { showLoader: false, showErrorToast: false });
                      } catch {}
                    }
                    let target = n.action_url;
                    if (!target) {
                      const t = (n.type || "").toLowerCase();
                      const title = (n.title || "").toLowerCase();
                      if (t.includes("penalty") || title.includes("penalty")) target = "/penalty";
                      else if (t.includes("leave") || title.includes("leave")) target = "/employees/leave-requests";
                      else if (t.includes("task") || title.includes("task")) target = "/tasks";
                      else if (t.includes("progress") || title.includes("progress")) target = "/approvals/daily-progress";
                      else if (t.includes("remark") || title.includes("remark")) target = "/remarks";
                      else if (t.includes("attendance") || title.includes("attendance")) target = "/employees/attendance";
                      else if (t.includes("chat") || title.includes("chat")) target = "/chat";
                      else if (t.includes("invoice") || title.includes("invoice")) target = "/invoice/all";
                      else if (t.includes("project") || title.includes("project")) target = "/work/projects";
                    }
                    if (target) {
                      window.dispatchEvent(new CustomEvent("navigate_tab", { detail: target }));
                    }
                  }}
                >
                  <p className="font-black text-foreground text-[13px]">{n.title}</p>
                  <p className="text-muted-foreground font-medium mt-0.5">{n.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </CollapsibleSection>
    </div>
  );
}
