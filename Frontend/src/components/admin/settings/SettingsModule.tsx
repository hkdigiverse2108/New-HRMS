import { Settings, Save } from "lucide-react";
import { toast } from "sonner";

export function SettingsModule() {
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
        <button onClick={() => toast.success("Settings saved successfully!")} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-primary/90 transition-colors">
          <Save className="w-4 h-4" /> Save Changes
        </button>
      </div>

      <div className="flex flex-col items-center justify-center h-[500px] text-center space-y-4 bg-card border border-border/50 rounded-3xl p-6 shadow-sm">
        <Settings className="w-16 h-16 text-muted-foreground/20" />
        <h2 className="text-2xl font-black">Configuration Panel</h2>
        <p className="text-muted-foreground max-w-md">System settings, notification preferences, and integrations will be configured here.</p>
      </div>
    </div>
  );
}
