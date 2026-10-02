import { Settings, Save, Bell, BellOff, Loader2, CheckCircle2, AlertCircle, HelpCircle, Mail } from "lucide-react";
import { useState } from "react";
import { toast } from "@/lib/toast";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function SettingsModule() {
  const {
    isSupported,
    permission,
    isSubscribed,
    subscriptions,
    isLoading,
    requestPermission,
    subscribe,
    unsubscribe,
    testPush,
  } = usePushNotifications();

  const [generalSettings, setGeneralSettings] = useState({
    emailNotifications: true,
    desktopNotifications: true,
    pushNotifications: isSubscribed,
  });

  const handlePushToggle = async (enabled: boolean) => {
    if (enabled) {
      await subscribe();
    } else {
      // Unsubscribe from all
      for (const sub of subscriptions) {
        await unsubscribe(sub.id);
      }
    }
    setGeneralSettings(prev => ({ ...prev, pushNotifications: enabled }));
  };

  const getPermissionStatus = () => {
    if (!isSupported) return { label: "Not Supported", color: "text-muted-foreground", icon: AlertCircle };
    switch (permission) {
      case "granted": return { label: "Enabled", color: "text-green-600", icon: CheckCircle2 };
      case "denied": return { label: "Blocked", color: "text-red-600", icon: AlertCircle };
      default: return { label: "Not Granted", color: "text-yellow-600", icon: HelpCircle };
    }
  };

  const permStatus = getPermissionStatus();

  return (
    <div className="p-6 md:p-8 space-y-8 pb-24">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground mb-1">
            <span>Dashboard</span>
            <span>/</span>
            <span className="text-foreground">Settings</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground">Command Center Settings</h1>
          <p className="text-muted-foreground mt-2 font-medium">Configure your executive dashboard preferences.</p>
        </div>
        <button 
          onClick={() => toast.success("Settings saved successfully!")} 
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-primary/90 transition-colors"
        >
          <Save className="w-4 h-4" /> Save Changes
        </button>
      </div>

      {/* Notification Preferences Section */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl font-black">
                <Bell className="w-6 h-6 text-primary" />
                Notification Preferences
              </CardTitle>
              <CardDescription>Manage how you receive alerts and updates</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-0">
          
          {/* Push Notifications */}
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <label htmlFor="push-notifications" className="flex items-center gap-2 cursor-pointer">
                    <Bell className="w-5 h-5 text-foreground" />
                    <span className="font-semibold text-lg">Push Notifications</span>
                  </label>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-muted ${permStatus.color}`}>
                    {permStatus.icon && <permStatus.icon className="w-3 h-3 inline-block align-middle mr-1" />}
                    {permStatus.label}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Receive notifications even when HRMS is closed or browser tab is closed. 
                  Works on desktop and mobile devices.
                </p>
              </div>
              <Switch
                id="push-notifications"
                checked={isSubscribed}
                onCheckedChange={handlePushToggle}
                disabled={!isSupported || isLoading || permission === "denied"}
                aria-label="Enable push notifications"
              />
            </div>

            {/* Permission Status */}
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
              <permStatus.icon className={`w-5 h-5 ${permStatus.color} flex-shrink-0`} />
              <div className="flex-1">
                <p className="font-medium text-sm">Browser Permission: <span className={permStatus.color}>{permStatus.label}</span></p>
                {permission !== "granted" && isSupported && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Click "Enable" above to request notification permission
                  </p>
                )}
                {permission === "denied" && (
                  <p className="text-xs text-red-600 mt-1">
                    Notifications are blocked. Enable them in your browser's site settings (lock icon in address bar).
                  </p>
                )}
                {!isSupported && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Your browser doesn't support push notifications.
                  </p>
                )}
              </div>
              {permission !== "granted" && isSupported && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={requestPermission}
                  disabled={isLoading}
                >
                  Request Permission
                </Button>
              )}
            </div>

            {/* Subscribed Devices */}
            {subscriptions.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border/50">
                <p className="text-sm font-medium text-muted-foreground">Active Devices ({subscriptions.length})</p>
                {subscriptions.map((sub) => (
                  <div key={sub.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Bell className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{sub.user_agent || "Unknown Device"}</p>
                        <p className="text-xs text-muted-foreground">
                          Added: {new Date(sub.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => unsubscribe(sub.id)}
                      disabled={isLoading}
                      className="text-red-600 hover:text-red-700"
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Test Button */}
            {isSubscribed && (
              <Button
                variant="outline"
                onClick={testPush}
                disabled={isLoading}
                className="w-full md:w-auto"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Bell className="w-4 h-4 mr-2" />
                    Send Test Notification
                  </>
                )}
              </Button>
            )}
          </div>

          <Separator />

          {/* Email Notifications */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="flex items-center gap-2 cursor-pointer font-semibold text-lg">
                <Mail className="w-5 h-5 text-foreground" />
                Email Notifications
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Receive important updates via email
              </p>
            </div>
            <Switch
              checked={generalSettings.emailNotifications}
              onCheckedChange={(checked) => setGeneralSettings(prev => ({ ...prev, emailNotifications: checked }))}
            />
          </div>

          {/* In-App Notifications */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="flex items-center gap-2 cursor-pointer font-semibold text-lg">
                <Bell className="w-5 h-5 text-foreground" />
                In-App Notifications
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Show notification badge and dropdown in the app
              </p>
            </div>
            <Switch
              checked={generalSettings.desktopNotifications}
              onCheckedChange={(checked) => setGeneralSettings(prev => ({ ...prev, desktopNotifications: checked }))}
            />
          </div>

        </CardContent>
      </Card>

      {/* Placeholder for other settings */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-2xl font-black">
            <Settings className="w-6 h-6 text-primary" />
            Other Settings
          </CardTitle>
          <CardDescription>Additional configuration options</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-muted-foreground">More settings coming soon...</p>
        </CardContent>
      </Card>
    </div>
  );
}