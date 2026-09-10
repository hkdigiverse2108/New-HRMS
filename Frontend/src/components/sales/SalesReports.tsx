import { useState } from "react";
import { Download, FileText, Calendar, Filter, PieChart, Users, TrendingUp, IndianRupee } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const reportTypes = [
  {
    id: "revenue",
    title: "Revenue & Forecast",
    description: "Detailed breakdown of closed won deals and pipeline forecast.",
    icon: IndianRupee,
    color: "emerald",
  },
  {
    id: "performance",
    title: "Team Performance",
    description: "Individual metrics, conversion rates, and activity logs.",
    icon: Users,
    color: "blue",
  },
  {
    id: "leads",
    title: "Lead Generation",
    description: "Source analysis, category mix, and drop-off rates.",
    icon: TrendingUp,
    color: "violet",
  },
  {
    id: "activity",
    title: "Activity & Tasks",
    description: "Follow-ups completed, overdue tasks, and response times.",
    icon: Calendar,
    color: "amber",
  },
];

export function SalesReports({ onAction }: { onAction?: (action: string) => void }) {
  const [selectedReport, setSelectedReport] = useState(reportTypes[0]?.id || "");
  const [dateRange, setDateRange] = useState("This Month");
  const [format, setFormat] = useState("PDF");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Reports & Exports</h1>
        <p className="text-sm text-muted-foreground">Generate and download detailed sales analytics reports</p>
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
                    ? "border-emerald-500 bg-emerald-50/30 ring-1 ring-emerald-500"
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

          <div className="mt-8 rounded-2xl border border-border bg-card p-6">
            <h3 className="mb-4 text-sm font-bold flex items-center gap-2">
              <PieChart className="h-4 w-4 text-emerald-600" /> Recent Reports
            </h3>
            <div className="space-y-3">
              {[
                { name: "Q3 Performance Review.pdf", date: "Oct 12, 2023", size: "2.4 MB" },
                { name: "September Revenue.csv", date: "Oct 1, 2023", size: "840 KB" },
                { name: "Lost Deals Analysis.pdf", date: "Sep 28, 2023", size: "1.1 MB" },
              ].map((file, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl border border-border p-3 transition-colors hover:bg-accent">
                  <div className="flex items-center gap-3">
                    <div className="grid h-8 w-8 place-items-center rounded-lg bg-muted text-muted-foreground">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{file.name}</p>
                      <p className="text-[11px] text-muted-foreground">{file.date} · {file.size}</p>
                    </div>
                  </div>
                  <button onClick={() => onAction?.(`Export ${file.name.endsWith(".csv") ? "Excel" : "PDF"}`)} className="text-emerald-600 hover:text-emerald-700">
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Configuration */}
        <div className="rounded-2xl border border-border bg-card p-6 h-fit sticky top-6">
          <h2 className="text-lg font-bold">Configuration</h2>
          <p className="mb-6 mt-1 text-xs text-muted-foreground">Customize your report output</p>

          <div className="space-y-5">
            {/* Date Range */}
            <div>
              <label className="mb-2 block text-xs font-bold uppercase text-muted-foreground">Date Range</label>
              <div className="grid grid-cols-2 gap-2">
                {["Today", "This Week", "This Month", "Last Month", "This Quarter", "Custom"].map((range) => (
                  <button
                    key={range}
                    onClick={() => setDateRange(range)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-xs font-semibold transition-colors",
                      dateRange === range
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-border bg-transparent text-muted-foreground hover:bg-accent",
                    )}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>

            {/* Filters */}
            <div>
              <label className="mb-2 block text-xs font-bold uppercase text-muted-foreground">Apply Filters</label>
              <button onClick={() => toast("Filter options opened")} className="flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground hover:bg-accent">
                <span className="flex items-center gap-2"><Filter className="h-4 w-4" /> All Users & Teams</span>
              </button>
            </div>

            {/* Format */}
            <div>
              <label className="mb-2 block text-xs font-bold uppercase text-muted-foreground">Export Format</label>
              <div className="flex gap-2">
                {["PDF", "CSV", "Excel"].map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => setFormat(fmt)}
                    className={cn(
                      "flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors",
                      format === fmt
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
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
              <button onClick={() => onAction?.(`Export ${format === "CSV" ? "Excel" : format}`)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-emerald-700 hover:shadow">
                <Download className="h-4 w-4" /> Generate {format} Report
              </button>
              <p className="mt-3 text-center text-[10px] text-muted-foreground">
                Report will be generated based on current real-time data.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
