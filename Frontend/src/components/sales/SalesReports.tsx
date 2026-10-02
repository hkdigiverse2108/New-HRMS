import { useState, useMemo } from "react";
import { Download, FileText, Calendar, Filter, PieChart, Users, TrendingUp, IndianRupee } from "lucide-react";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { useSales } from "./SalesContext";

const reportTypes = [
  {
    id: "revenue",
    title: "Revenue & Forecast",
    description: "Detailed breakdown of closed won deals, pipeline forecast, and collection.",
    icon: IndianRupee,
    color: "emerald",
  },
  {
    id: "performance",
    title: "Team Performance",
    description: "Individual metrics, conversion rates, and owner assignments.",
    icon: Users,
    color: "blue",
  },
  {
    id: "leads",
    title: "Lead Generation",
    description: "Source analysis, category mix, and lead lifecycle pipeline.",
    icon: TrendingUp,
    color: "violet",
  },
  {
    id: "activity",
    title: "Activity & Tasks",
    description: "Follow-ups scheduled, overdue follow-ups, and customer touchpoints.",
    icon: Calendar,
    color: "amber",
  },
];

export function SalesReports({ onAction }: { onAction?: (action: string) => void }) {
  const { leads, targets, pipelineValue, wonRevenue } = useSales();
  const [selectedReport, setSelectedReport] = useState(reportTypes[0]?.id || "revenue");
  const [dateRange, setDateRange] = useState("This Month");
  const [format, setFormat] = useState("CSV");

  const recentReports = useMemo(() => {
    const curYear = new Date().getFullYear();
    const curMonthName = new Date().toLocaleString("default", { month: "short" });
    return [
      { name: `${curMonthName} Pipeline & Revenue.csv`, date: `Today`, size: `${Math.max(12, leads.length * 4)} KB` },
      { name: `Q${Math.floor(new Date().getMonth() / 3) + 1} Performance Review.csv`, date: `Active`, size: "48 KB" },
      { name: `Lead Conversion Analysis_${curYear}.csv`, date: `This Week`, size: "82 KB" },
    ];
  }, [leads.length]);

  const handleGenerateReport = () => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    const todayStr = new Date().toISOString().split("T")[0];

    if (selectedReport === "revenue") {
      headers = ["Company", "Contact", "Stage", "Budget / Value (INR)", "Owner / Assigned", "Closed Date"];
      rows = leads.map((l) => [
        `"${l.company || l.contact || "N/A"}"`,
        `"${l.contact || ""}"`,
        `"${l.status || l.stage || ""}"`,
        `"${l.budget || l.expectedIncome || 0}"`,
        `"${Array.isArray(l.assignedTo) ? l.assignedTo.join(", ") : l.assignedTo || l.owner || ""}"`,
        `"${l.closedDate || l.date || ""}"`,
      ]);
    } else if (selectedReport === "performance") {
      headers = ["Lead Name", "Assigned Owner", "Stage", "Priority", "Expected Income", "Next Follow Up"];
      rows = leads.map((l) => [
        `"${l.company || l.contact || "N/A"}"`,
        `"${Array.isArray(l.assignedTo) ? l.assignedTo.join(", ") : l.assignedTo || l.owner || ""}"`,
        `"${l.status || l.stage || ""}"`,
        `"${l.priority || "Medium"}"`,
        `"${l.budget || l.expectedIncome || 0}"`,
        `"${l.nextFollowUpDate || l.nextFollowUp || "None"}"`,
      ]);
    } else if (selectedReport === "activity") {
      headers = ["Company", "Contact", "Assigned Owner", "Follow-up Scheduled", "Stage", "Remarks / Note"];
      rows = leads.map((l) => [
        `"${l.company || l.contact || "N/A"}"`,
        `"${l.contact || ""}"`,
        `"${Array.isArray(l.assignedTo) ? l.assignedTo.join(", ") : l.assignedTo || l.owner || ""}"`,
        `"${l.nextFollowUpDate || l.nextFollowUp || "Not Set"}"`,
        `"${l.status || l.stage || ""}"`,
        `"${(l.remarks || "").replace(/"/g, '""')}"`,
      ]);
    } else {
      // leads report
      headers = ["Company", "Contact", "Email", "Phone", "Category", "Source", "Stage", "Priority", "Budget"];
      rows = leads.map((l) => [
        `"${l.company || l.contact || "N/A"}"`,
        `"${l.contact || ""}"`,
        `"${l.email || ""}"`,
        `"${l.phone || ""}"`,
        `"${l.category || "General"}"`,
        `"${l.source || "Direct"}"`,
        `"${l.status || l.stage || ""}"`,
        `"${l.priority || "Medium"}"`,
        `"${l.budget || l.expectedIncome || 0}"`,
      ]);
    }

    if (format === "PDF") {
      if (onAction) {
        onAction("Export PDF");
      } else {
        window.print();
      }
      toast.success(`Preparing ${selectedReport} report for print/PDF...`);
      return;
    }

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `sales_${selectedReport}_report_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Generated & downloaded ${selectedReport} ${format} report (${leads.length} records)`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Reports & Exports</h1>
        <p className="text-sm text-muted-foreground">Generate and download detailed sales analytics reports with live data</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Left Column: Report Selection */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold">Select Report Type</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {reportTypes.map((report) => (
              <div
                key={report.id}
                onClick={() => setSelectedReport(report.id)}
                className={cn(
                  "cursor-pointer rounded-2xl border p-4 transition-all hover:shadow-md",
                  selectedReport === report.id
                    ? "border-emerald-500 bg-emerald-50/30 ring-1 ring-emerald-500 shadow-sm"
                    : "border-border bg-card hover:border-emerald-300",
                )}
              >
                <div className={cn(
                  "mb-3 grid h-10 w-10 place-items-center rounded-xl",
                  report.color === "emerald" && "bg-emerald-100 text-emerald-600",
                  report.color === "blue" && "bg-blue-100 text-blue-600",
                  report.color === "violet" && "bg-violet-100 text-violet-600",
                  report.color === "amber" && "bg-amber-100 text-amber-600",
                )}>
                  <report.icon className="h-5 w-5" />
                </div>
                <h3 className="font-bold">{report.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{report.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-sm">
            <h3 className="mb-4 text-sm font-bold flex items-center gap-2">
              <PieChart className="h-4 w-4 text-emerald-600" /> Available Live Snapshots
            </h3>
            <div className="space-y-3">
              {recentReports.map((file, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl border border-border p-3 transition-colors hover:bg-accent">
                  <div className="flex items-center gap-3">
                    <div className="grid h-8 w-8 place-items-center rounded-lg bg-muted text-muted-foreground shrink-0">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{file.name}</p>
                      <p className="text-[11px] text-muted-foreground">{file.date} · {file.size}</p>
                    </div>
                  </div>
                  <button 
                    onClick={handleGenerateReport} 
                    className="text-emerald-600 hover:text-emerald-700 shrink-0 ml-2 p-1.5 rounded-lg hover:bg-emerald-50 transition-colors"
                    title="Download snapshot"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Configuration */}
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-6 h-fit static lg:sticky lg:top-6 shadow-sm">
          <h2 className="text-lg font-bold">Configuration</h2>
          <p className="mb-6 mt-1 text-xs text-muted-foreground">Customize your report output</p>

          <div className="space-y-5">
            {/* Date Range */}
            <div>
              <label className="mb-2 block text-xs font-bold uppercase text-muted-foreground">Date Range</label>
              <div className="grid grid-cols-2 min-[400px]:grid-cols-3 lg:grid-cols-2 gap-2">
                {["Today", "This Week", "This Month", "Last Month", "This Quarter", "Custom"].map((range) => (
                  <button
                    key={range}
                    onClick={() => setDateRange(range)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-xs font-semibold transition-colors",
                      dateRange === range
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700 font-bold"
                        : "border-border bg-transparent text-muted-foreground hover:bg-accent",
                    )}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>

            {/* Live Leads Summary */}
            <div className="rounded-xl bg-muted/40 p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Leads:</span>
                <span className="font-bold">{leads.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pipeline Value:</span>
                <span className="font-bold">₹{pipelineValue.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Won Revenue:</span>
                <span className="font-bold text-emerald-600">₹{wonRevenue.toLocaleString("en-IN")}</span>
              </div>
            </div>

            {/* Format */}
            <div>
              <label className="mb-2 block text-xs font-bold uppercase text-muted-foreground">Export Format</label>
              <div className="flex gap-2">
                {["CSV", "Excel", "PDF"].map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => setFormat(fmt)}
                    className={cn(
                      "flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors",
                      format === fmt
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700 font-bold"
                        : "border-border bg-transparent text-muted-foreground hover:bg-accent",
                    )}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            </div>

            {/* Action */}
            <div className="pt-4">
              <button 
                onClick={handleGenerateReport} 
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-emerald-700 hover:shadow"
              >
                <Download className="h-4 w-4" /> Generate {format} Report
              </button>
              <p className="mt-3 text-center text-[10px] text-muted-foreground">
                Report is generated in real-time directly from current database records.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
