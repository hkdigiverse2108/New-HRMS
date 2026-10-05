import { Bell, BellOff, CheckCircle2, AlertCircle, HelpCircle, Loader2, Send } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function NotificationSettingsCard({ className = "" }: { className?: string }) {
  const {
    isSupported,
    permission,
    isSubscribed,
    subscriptions,
    isLoading,
    toggleNotifications,
    testPush,
  } = usePushNotifications();

  const getPermissionStatus = () => {
    if (!isSupported) {
      return {
        label: "Not Supported",
        color: "text-muted-foreground bg-muted border-border",
        icon: AlertCircle,
        desc: "Push notifications are not supported by this browser.",
      };
    }
    switch (permission) {
      case "granted":
        return {
          label: "Permission Allowed",
          color: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
          icon: CheckCircle2,
          desc: "Browser has granted permission to deliver alerts.",
        };
      case "denied":
        return {
          label: "Blocked by Browser",
          color: "text-rose-700 bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800",
          icon: AlertCircle,
          desc: "Notifications are blocked. Please click the tune/lock icon in your browser URL bar and allow notifications.",
        };
      default:
        return {
          label: "Needs Permission",
          color: "text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
          icon: HelpCircle,
          desc: "Permission will be requested when you toggle the switch ON.",
        };
    }
  };

  const permStatus = getPermissionStatus();

  return (
    <Card className={`border-border/60 shadow-sm rounded-3xl overflow-hidden bg-card ${className}`}>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-xl font-black text-foreground">
                Notification Preferences
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Stay updated even when HRMS is closed or Chrome tab is closed.
              </CardDescription>
            </div>
          </div>

          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${permStatus.color}`}>
            <permStatus.icon className="w-3.5 h-3.5" />
            <span>{permStatus.label}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-2">
        {/* Toggle Option */}
        <div className="flex items-start justify-between gap-4 p-4 rounded-2xl border border-border/50 bg-muted/20">
          <div className="space-y-1 pr-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm sm:text-base text-foreground">
                Desktop &amp; Background Push Notifications
              </span>
              {isSubscribed && (
                <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded-md bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  ON
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              When turned ON, you will receive native system notifications for chat messages, task assignments, leave updates, and urgent summons even if you close HRMS or close the browser tab. Notifications will display the sender&apos;s profile photo.
            </p>
          </div>

          <div className="pt-1">
            <Switch
              id="hrms-push-toggle"
              checked={isSubscribed}
              onCheckedChange={toggleNotifications}
              disabled={isLoading || !isSupported}
            />
          </div>
        </div>

        {/* Action & Status Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1 border-t border-border/40">
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <span className="font-semibold text-foreground">
              {subscriptions.length}
            </span>{" "}
            active device subscription{subscriptions.length === 1 ? "" : "s"} registered.
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={testPush}
              disabled={isLoading || !isSubscribed}
              className="rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              {isLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              Send Test Notification
            </Button>
          </div>
        </div>

        {isSubscribed && (
          <p className="text-[11px] text-muted-foreground/80 italic bg-primary/5 p-3 rounded-xl border border-primary/10">
            💡 <strong>Test Tip:</strong> Click &ldquo;Send Test Notification&rdquo;, then minimize or close this Chrome tab. The notification will pop up directly on your desktop with your profile picture!
          </p>
        )}
      </CardContent>
    </Card>
  );
}
