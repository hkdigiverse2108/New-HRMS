import { BarChart2, Download } from "lucide-react";
import { toast } from "sonner";

export function ReportsModule() {
  return (
    <div className="p-6 md:p-8 space-y-8 pb-24">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground mb-1">
            <span>Dashboard</span>
            <span>/</span>
            <span className="text-foreground">Reports</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground">Command Center Reports</h1>
          <p className="text-muted-foreground mt-2 font-medium">Generate cross-functional reports.</p>
        </div>
        <button onClick={() => toast.success("Exporting Report to PDF...")} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-primary/90 transition-colors">
          <Download className="w-4 h-4" /> Export Report
        </button>
      </div>

      <div className="flex flex-col items-center justify-center h-[500px] text-center space-y-4 bg-card border border-border/50 rounded-3xl p-6 shadow-sm">
        <BarChart2 className="w-16 h-16 text-muted-foreground/20" />
        <h2 className="text-2xl font-black">Advanced Reporting</h2>
        <p className="text-muted-foreground max-w-md">Comprehensive charts and analytical exports will be generated here.</p>
      </div>
    </div>
  );
}
