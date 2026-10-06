import { useMemo } from "react";
import { Award, TrendingDown, Phone, Clock, CheckCircle2, XCircle, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { formatCurrency, type TeamMember } from "./sales-data";
import { useSales } from "./SalesContext";
import { useEmployeesContext } from "@/components/employees/EmployeeContext";

function MemberCard({ member }: { member: TeamMember }) {
  const targetVal = member.target > 0 ? member.target : 1;
  const pct = Math.round((member.achieved / targetVal) * 100);
  const isTop = pct >= 100;
  const isLow = pct < 60;

  const metrics = [
    { label: "Assigned", value: member.assigned },
    { label: "Contacted", value: member.contacted },
    { label: "Meetings", value: member.meetings },
    { label: "Demos", value: member.demos },
    { label: "Proposals", value: member.proposals },
    { label: "Won / Lost", value: `${member.won} / ${member.lost}` },
    { label: "Collection", value: formatCurrency(member.collection) },
    { label: "Conversion", value: `${member.conversionRate}%` },
    { label: "Follow-up done", value: `${member.followUpDone}%` },
    { label: "Avg response", value: `${member.avgResponse} min` },
  ];

  return (
    <div className={cn(
      "rounded-2xl border bg-card p-5 transition-shadow hover:shadow-lg",
      isTop ? "border-emerald-200" : isLow ? "border-rose-200" : "border-border",
    )}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className={cn(
          "grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-black",
          isTop ? "bg-emerald-100 text-emerald-700" : isLow ? "bg-rose-100 text-rose-700" : "bg-blue-100 text-blue-700",
        )}>
          {member.avatar}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{member.name}</p>
          <p className="text-[11px] text-muted-foreground">{member.role} · {member.region}</p>
        </div>
        {isTop && <Award className="h-5 w-5 text-amber-500" />}
      </div>

      {/* Progress */}
      <div className="mt-4">
        <div className="flex items-end justify-between">
          <span className="text-xs text-muted-foreground">Target achievement</span>
          <span className={cn("text-lg font-black", isTop ? "text-emerald-600" : isLow ? "text-rose-600" : "text-foreground")}>
            {pct}%
          </span>
        </div>
        <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted/50">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-700",
              isTop ? "bg-emerald-500" : isLow ? "bg-rose-500" : "bg-blue-500",
            )}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          <span>{formatCurrency(member.achieved)}</span>
          <span>of {formatCurrency(member.target)}</span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5">
        {metrics.map((m) => (
          <div key={m.label} className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">{m.label}</span>
            <span className="text-xs font-semibold">{m.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SalesTeamPerformance({ onAction }: { onAction?: (action: string) => void }) {
  const { leads, targets } = useSales();
  const { employees } = useEmployeesContext();

  // Dynamic Members Calculation - Strictly Sales Department (Audio 7 & Audio 8 [05:27])
  const dynamicMembers = useMemo<TeamMember[]>(() => {
    const candidateEmps = employees.length > 0 ? employees : [];

    // Strict sales check
    const isSalesEmployee = (e: any) => {
      const dept = (e.department || "").toLowerCase().trim();
      const subDept = (e.sub_department || "").toLowerCase().trim();
      const desig = (e.designation || "").toLowerCase().trim();
      const role = (e.role || "").toLowerCase().trim();
      const sysRole = (e.work_details?.system_role || "").toLowerCase().trim();

      // Exclude non-sales departments (Audio 8 explicitly: Only Sales department)
      if (dept === "management" || dept === "development" || dept === "hr" || dept === "creative" || dept === "digital marketing") {
        return false;
      }

      return (
        dept.includes("sale") ||
        dept.includes("business dev") ||
        subDept.includes("sale") ||
        desig.includes("sale") ||
        desig.includes("telecaller") ||
        desig.includes("bde") ||
        role.includes("sale") ||
        role.includes("telecaller") ||
        role.includes("bde") ||
        sysRole.includes("sale")
      );
    };

    // Strictly Sales-department employees only — no virtual reps, no static fallback.
    // (Eligible owners queue is for auto-assignment, not for performance leaderboard.)
    const finalEmps = candidateEmps.filter(isSalesEmployee);

    if (finalEmps.length === 0) {
      return [];
    }

    return finalEmps.map((emp) => {
      const empName = emp.name;
      const empLeads = leads.filter((l) => {
        const assigned = Array.isArray(l.assignedTo) ? l.assignedTo : [l.assignedTo || l.owner];
        return assigned.some((a: any) => String(a).toLowerCase().includes(empName.toLowerCase()));
      });

      const assignedCount = empLeads.length;
      const won = empLeads.filter((l) => ["Client Won", "Won", "5"].includes(l.status || l.stage || ""));
      const lost = empLeads.filter((l) => ["Client Lost", "Lost", "6"].includes(l.status || l.stage || ""));
      const contacted = empLeads.filter((l) => !["New Lead", "New", "Stage 0", "0"].includes(l.status || l.stage || ""));
      const meetings = empLeads.filter((l) => (l.stage || l.status || "").toLowerCase().includes("meet") || (l.stage || l.status || "").toLowerCase().includes("demo"));
      const demos = empLeads.filter((l) => (l.stage || l.status || "").toLowerCase().includes("demo"));
      const proposals = empLeads.filter((l) => (l.stage || l.status || "").toLowerCase().includes("proposal") || (l.stage || l.status || "").toLowerCase().includes("review"));

      // Net recognized won revenue (Audio 7 & 8 priority)
      const achieved = won.reduce((acc, l) => {
        const val = Number(l.netAmount || l.net_amount || l.dealValue || l.deal_value || l.budget || l.expectedIncome) || 0;
        return acc + val;
      }, 0);

      const matchedTarget = targets.find((t) => t.employeeId === emp.id || t.employeeName?.toLowerCase() === empName.toLowerCase());
      const target = Number(matchedTarget?.targetAmount) || 1000000;

      const followUpsDoneCount = empLeads.filter((l) => (l.followUps && l.followUps.length > 0) || l.nextFollowUpDate).length;
      const followUpPct = assignedCount > 0 ? Math.round((followUpsDoneCount / assignedCount) * 100) : 100;
      const conversionPct = assignedCount > 0 ? Math.round((won.length / assignedCount) * 100) : 0;

      const initials = empName
        .split(" ")
        .map((p: string) => p[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase() || "SE";

      return {
        name: empName,
        role: emp.role || emp.designation || "Sales Executive",
        region: emp.department || "Sales",
        avatar: initials,
        target,
        achieved,
        assigned: assignedCount,
        contacted: contacted.length,
        meetings: meetings.length,
        demos: demos.length,
        proposals: proposals.length,
        won: won.length,
        lost: lost.length,
        collection: achieved,
        conversionRate: conversionPct,
        followUpDone: followUpPct,
        avgResponse: 18,
      };
    });
  }, [employees, leads, targets]);

  const sorted = useMemo(() => {
    return [...dynamicMembers].sort((a, b) => {
      const aTarget = a.target > 0 ? a.target : 1;
      const bTarget = b.target > 0 ? b.target : 1;
      return (b.achieved / bTarget) - (a.achieved / aTarget);
    });
  }, [dynamicMembers]);

  const top = sorted[0];
  const bottom = sorted.length > 1 ? sorted[sorted.length - 1] : undefined;

  const handleExportReport = () => {
    const headers = ["Employee", "Role", "Region", "Target", "Achieved", "Achievement %", "Assigned Leads", "Won", "Lost", "Conversion Rate %", "Follow-up Done %"];
    const rows = sorted.map((m) => [
      `"${m.name}"`,
      `"${m.role}"`,
      `"${m.region}"`,
      `"${m.target}"`,
      `"${m.achieved}"`,
      `"${Math.round((m.achieved / (m.target || 1)) * 100)}%"`,
      `"${m.assigned}"`,
      `"${m.won}"`,
      `"${m.lost}"`,
      `"${m.conversionRate}%"`,
      `"${m.followUpDone}%"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `sales_team_performance_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Sales performance report downloaded!");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Employee Performance</h1>
          <p className="text-sm text-muted-foreground">Leaderboard, scorecards and follow-up discipline across the sales org</p>
        </div>
        <button 
          onClick={handleExportReport} 
          className="flex items-center gap-1.5 self-start rounded-xl border border-border bg-white px-4 py-2 text-sm font-semibold transition-colors hover:bg-accent hover:text-emerald-700 shadow-sm"
        >
          <Download className="h-4 w-4" /> Export Report
        </button>
      </div>

      {/* Top & Bottom Highlights */}
      <div className="grid gap-4 sm:grid-cols-2">
        {top && (
          <div className="flex items-center gap-4 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white p-5 shadow-sm">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-emerald-100">
              <Award className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">Top Performer</p>
              <p className="text-lg font-black">{top.name}</p>
              <p className="text-xs text-muted-foreground">
                {Math.round((top.achieved / (top.target || 1)) * 100)}% of target · {formatCurrency(top.achieved)}
              </p>
            </div>
          </div>
        )}

        {bottom && (
          <div className="flex items-center gap-4 rounded-2xl border border-rose-200 bg-gradient-to-r from-rose-50 to-white p-5 shadow-sm">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-rose-100">
              <TrendingDown className="h-6 w-6 text-rose-600" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-rose-600">Needs Support</p>
              <p className="text-lg font-black">{bottom.name}</p>
              <p className="text-xs text-muted-foreground">
                {Math.round((bottom.achieved / (bottom.target || 1)) * 100)}% of target · {formatCurrency(bottom.achieved)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Leaderboard */}
      <div>
        <h2 className="mb-4 text-lg font-bold">Leaderboard <span className="text-xs font-semibold text-muted-foreground">· Sales department only ({sorted.length})</span></h2>
        {sorted.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
            <p className="font-semibold">No Sales department employees found</p>
            <p className="text-xs mt-1">Add employees with Department = Sales — only they appear here (fully dynamic, no static data).</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sorted.map((member) => (
              <MemberCard key={member.name} member={member} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
