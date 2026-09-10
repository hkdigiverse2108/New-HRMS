import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppSidebar } from "@/components/AppSidebar";

// Sales Components
import { SalesDashboard } from "@/components/sales/SalesDashboard";
import { SalesPipeline } from "@/components/sales/SalesPipeline";
import { SalesLeads } from "@/components/sales/SalesLeads";
import { SalesTasks } from "@/components/sales/SalesTasks";
import { SalesAnalytics } from "@/components/sales/SalesAnalytics";
import { SalesTeamPerformance } from "@/components/sales/SalesTeamPerformance";
import { SalesReports } from "@/components/sales/SalesReports";
import { SalesSettings } from "@/components/sales/SalesSettings";
import { PayrollDashboard } from "@/components/payroll/PayrollDashboard";
import { SalaryStructure } from "@/components/payroll/SalaryStructure";
import { PayrollSettings } from "@/components/payroll/PayrollSettings";
import { PayrollProcessing } from "@/components/payroll/PayrollProcessing";
import { BonusDeductions } from "@/components/payroll/BonusDeductions";
import { Payslips } from "@/components/payroll/Payslips";
import { QuickActionModals } from "@/components/sales/QuickActionModals";
import { SalesProvider } from "@/components/sales/SalesContext";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { EmployeeList } from "@/components/employees/EmployeeList";
import { OrgStructure } from "@/components/employees/OrgStructure";
import { AttendanceList } from "@/components/employees/AttendanceList";
import { LeaveRequests } from "@/components/employees/LeaveRequests";
import { toast } from "sonner";
import { DepartmentProvider } from "@/components/employees/DepartmentContext";
import { EmployeeProvider } from "@/components/employees/EmployeeContext";
import { SettingsProvider } from "@/components/payroll/SettingsContext";
import { Interviews } from "@/components/recruitment/Interviews";
import { Hirings } from "@/components/recruitment/Hirings";
import { Schedule } from "@/components/schedule/Schedule";
import { WorkLogs } from "@/components/work/WorkLogs";
import { Tasks } from "@/components/work/Tasks";
import { Chat } from "@/components/work/Chat";
import { Research } from "@/components/work/Research";
import { Projects } from "@/components/work/Projects";
import { Penalties } from "@/components/employees/Penalties";
import { Remarks } from "@/components/employees/Remarks";
import { ActivityLogs } from "@/components/admin/ActivityLogs";
import { ActivityTracker } from "@/components/admin/ActivityTracker";
import { Restrictions } from "@/components/admin/Restrictions";
import { AdminSettings } from "@/components/admin/AdminSettings";
import { RecycleBin } from "@/components/admin/RecycleBin";
import { CEODashboard } from "@/components/admin/CEODashboard";
import { Elections } from "@/components/admin/Elections";
import { Recognitions } from "@/components/admin/Recognitions";
import { TeamLeaderOfWeek } from "@/components/admin/TeamLeaderOfWeek";
import { B2BModule } from "@/components/admin/b2b/B2BModule";
import { CollaborationModule } from "@/components/admin/collaboration/CollaborationModule";
import { FranchiseModule } from "@/components/admin/franchise/FranchiseModule";
import { ReportsModule } from "@/components/admin/reports/ReportsModule";
import { SettingsModule } from "@/components/admin/settings/SettingsModule";
import SeatingArrangementPage from "@/components/workspace/Seating";
import ResourceManagementPage from "@/components/workspace/Resource";
import { Gallery } from "@/components/workspace/Gallery";
import { Documents } from "@/components/documents/Documents";
import { DocumentGenerator } from "@/components/documents/DocumentGenerator";
import { DailyProgress } from "@/components/approvals/DailyProgress";
import { ApprovalHistory } from "@/components/approvals/ApprovalHistory";
import { AllInvoices } from "@/components/invoice/AllInvoices";
import { CreateInvoice } from "@/components/invoice/CreateInvoice";
import { CreateProforma } from "@/components/invoice/CreateProforma";
import { InvoiceLedger } from "@/components/invoice/InvoiceLedger";
import { InvoiceApprovals } from "@/components/approvals/InvoiceApprovals";
import { ReportsOverview } from "@/components/reports/ReportsOverview";
import { AttendanceReport } from "@/components/reports/AttendanceReport";
import { PayrollReport } from "@/components/reports/PayrollReport";
import { HiringFunnel } from "@/components/reports/HiringFunnel";
import { WorkReport } from "@/components/reports/WorkReport";
import { Transactions } from "@/components/finance/Transactions";
import { FinancialPlan } from "@/components/finance/FinancialPlan";
import { FinancialSummary } from "@/components/finance/FinancialSummary";
import { OtherTransactions } from "@/components/finance/OtherTransactions";
import { AuditLogs } from "@/components/finance/AuditLogs";
import { UserProfile } from "@/components/profile/UserProfile";
import { GlobalModalProvider } from "@/components/GlobalModalContext";
import { GlobalModalManager } from "@/components/GlobalModalManager";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HR Suite — Optimized Sidebar Navigation" },
      {
        name: "description",
        content:
          "A grouped, searchable and collapsible sidebar for an HR, payroll and work management platform.",
      },
      { property: "og:title", content: "HR Suite — Optimized Sidebar Navigation" },
      {
        property: "og:description",
        content:
          "Grouped sections, quick search, pinned shortcuts and badge counts for a 40+ item admin menu.",
      },
    ],
  }),
  component: Index,
});

const improvements = [
  ["Grouped sections", "40+ flat items are now split into Overview, People, Time, Finance, Work, Workplace and Admin."],
  ["Menu search", "Type to filter items and sub-items instantly — the fastest path in a deep menu."],
  ["Pinned shortcuts", "Hover any item to pin it to the top; each user keeps their own 3–5 daily screens."],
  ["Icon-collapse mode", "Shrinks to a 68px icon rail instead of disappearing, so the content area gets more room."],
  ["Single-column accordions", "Sub-items sit on a guide rail with a clear active pill — no more losing your place."],
  ["Live badges", "Counts on Leave Requests, Interviews, Tasks and Chat surface work without opening pages."],
];

const suggestions = [
  ["Command palette (⌘K)", "Jump to any screen or record, plus quick actions like 'Create Invoice'."],
  ["Recently visited", "Auto-list the last 5 screens under Pinned — zero setup for the user."],
  ["Role-based menus", "Hide Finance/Restrictions from non-admins; a shorter menu is a faster menu."],
  ["Notifications inbox", "One bell for approvals, penalties and remarks instead of hunting per module."],
  ["Approvals hub", "Merge Leave Requests, Penalty and Invoice approvals into one queue."],
  ["Reports & Analytics", "Attendance, payroll cost and hiring funnel in one place — currently missing."],
  ["Global 'Create' button", "Invoice, task, employee, leave — the top 4 create actions in one menu."],
  ["Mobile drawer", "Off-canvas sidebar with a bottom bar for the 4 most used screens."],
];

function Index() {
  const [isClient, setIsClient] = useState(false);
  const [active, setActiveState] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem("activeSidebarTab") || "/dashboard";
    }
    return "/dashboard";
  });

  useEffect(() => {
    setIsClient(true);
  }, []);
  
  const setActive = (val: string) => {
    setActiveState(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem("activeSidebarTab", val);
    }
  };

  const [activeAction, setActiveAction] = useState<string | null>(null);

  const handleQuickAction = (label: string) => {
    if (label === "Export Excel" || label === "Export PDF") {
      const type = label.split(" ")[1];
      toast.loading(`Exporting data to ${type}...`, { duration: 1500 });
      setTimeout(() => toast.success(`${type} export complete!`, { description: "Your file has been downloaded." }), 1500);
    } else {
      setActiveAction(label);
    }
  };

  if (!isClient) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-r-transparent animate-spin" />
      </div>
    );
  }

  const basePath = active.split('?')[0] || "/";
  const isNew = active.includes('?new=1');

  return (
    <GlobalModalProvider>
    <SettingsProvider>
      <DepartmentProvider>
        <EmployeeProvider>
          <SalesProvider>
            <div className="flex h-screen overflow-hidden bg-gradient-to-br from-background via-background to-primary/5">
          <AppSidebar active={active} setActive={setActive} />
          <GlobalModalManager />
        <main className="min-w-0 flex-1 overflow-x-hidden px-6 pb-24 pt-20 sm:px-10 md:pb-8 md:pt-8">
          {/* Main Dashboard */}
          {basePath === "/dashboard" && <Dashboard setActive={setActive} onAction={handleQuickAction} />}

          {/* Render the appropriate sales page based on state */}
          {basePath === "/work/sales/dashboard" && <SalesDashboard setActive={setActive} onAction={handleQuickAction} />}
          {basePath === "/work/sales/pipeline" && <SalesPipeline onAction={handleQuickAction} />}
          {basePath === "/work/sales/leads" && <SalesLeads onAction={handleQuickAction} isNew={isNew} />}
          {basePath === "/work/sales/tasks" && <SalesTasks onAction={handleQuickAction} />}
          {basePath === "/work/sales/analytics" && <SalesAnalytics onAction={handleQuickAction} />}
          {basePath === "/work/sales/team" && <SalesTeamPerformance onAction={handleQuickAction} />}
          {basePath === "/work/sales/reports" && <SalesReports onAction={handleQuickAction} />}
          {basePath === "/work/sales/settings" && <SalesSettings />}

        {/* Render Payroll pages */}
        {basePath === "/payroll/dashboard" && <PayrollDashboard />}
        {basePath === "/payroll/structure" && <SalaryStructure />}
        {basePath === "/payroll/settings" && <PayrollSettings />}
        {basePath === "/payroll/processing" && <PayrollProcessing />}
        {basePath === "/payroll/bonuses" && <BonusDeductions />}
        {basePath === "/payroll/payslips" && <Payslips />}

        {/* Render Employee pages */}
        {basePath === "/employees/list" && <EmployeeList isNew={isNew} />}
        {basePath === "/employees/org" && <OrgStructure />}
        {basePath === "/employees/attendance" && <AttendanceList />}
        {basePath === "/employees/leave-requests" && <LeaveRequests isNew={isNew} />}
        {basePath === "/employees/documents" && <Documents setActive={setActive} />}
        {basePath === "/employees/documents/generate" && <DocumentGenerator onBack={() => setActive("/employees/documents")} />}
        {(active === "/penalty" || active === "/approvals/penalties") && <Penalties />}
        {basePath === "/approvals/daily-progress" && <DailyProgress />}
        {basePath === "/approvals/history" && <ApprovalHistory />}
        {basePath === "/approvals/invoices" && <InvoiceApprovals />}
        {basePath === "/remarks" && <Remarks />}
        
        {/* Finance */}
        {basePath === "/finance/transactions" && <Transactions />}
        {basePath === "/finance/plan" && <FinancialPlan />}
        {basePath === "/finance/summary" && <FinancialSummary />}
        {basePath === "/finance/clients" && <OtherTransactions />}
        {basePath === "/finance/audit" && <AuditLogs />}
        {basePath === "/invoice/all" && <AllInvoices />}
        {basePath === "/invoice/ledger" && <InvoiceLedger />}
        {basePath === "/invoice/create" && <CreateInvoice onBack={() => setActive("/invoice/all")} />}
        {basePath === "/invoice/proforma" && <CreateProforma onBack={() => setActive("/invoice/all")} />}

        {/* Reports */}
        {basePath === "/reports" && <ReportsOverview />}
        {basePath === "/reports/attendance" && <AttendanceReport />}
        {basePath === "/reports/payroll" && <PayrollReport />}
        {basePath === "/reports/hiring" && <HiringFunnel />}
        {basePath === "/reports/work" && <WorkReport />}

        {/* Recruitment */}
        {basePath === "/recruitment/interviews" && <Interviews />}
        {basePath === "/recruitment/hirings" && <Hirings />}

        {/* Schedule */}
        {basePath === "/schedule" && <Schedule isNew={isNew} />}

        {/* Work */}
        {basePath === "/work/logs" && <WorkLogs />}
        {basePath === "/work/projects" && <Projects isNew={isNew} />}
        {basePath === "/tasks" && <Tasks setActive={setActive} isNew={isNew} />}
        {basePath === "/chat" && <Chat />}
        {basePath === "/work/research" && <Research />}

        {/* Workspace */}
        {basePath === "/workspace/seating" && <SeatingArrangementPage />}
        {basePath === "/workspace/resource" && <ResourceManagementPage />}
        {basePath === "/workspace/gallery" && <Gallery />}


        {/* Admin & Command Center */}
        {basePath === "/ceo-dashboard" && <CEODashboard active={active} />}
        {basePath.startsWith("/ceo-dashboard/b2b") && <B2BModule active={active} />}
        {basePath === "/ceo-dashboard/collaboration" && <CollaborationModule />}
        {basePath === "/ceo-dashboard/franchise" && <FranchiseModule />}
        {basePath === "/ceo-dashboard/reports" && <ReportsModule />}
        {basePath === "/ceo-dashboard/settings" && <SettingsModule />}
        {basePath === "/activity-logs" && <ActivityLogs />}
        {basePath === "/activity-tracker" && <ActivityTracker />}
        {basePath === "/restrictions" && <Restrictions />}
        {basePath === "/settings" && <AdminSettings />}
        {basePath === "/recycle-bin" && <RecycleBin />}
        {basePath === "/elections" && <Elections />}
        {basePath === "/recognitions" && <Recognitions />}
        {basePath === "/team-leader-of-the-week" && <TeamLeaderOfWeek />}

        {/* User Profile */}
        {basePath === "/profile" && <UserProfile />}

        {/* Fallback original content for all other items */}
        {basePath !== "/dashboard" && basePath !== "/profile" && basePath !== "/schedule" && basePath !== "/work/logs" && basePath !== "/work/projects" && basePath !== "/tasks" && basePath !== "/chat" && basePath !== "/work/research" && basePath !== "/penalty" && basePath !== "/approvals/penalties" && basePath !== "/remarks" && basePath !== "/activity-logs" && basePath !== "/activity-tracker" && basePath !== "/restrictions" && basePath !== "/settings" && basePath !== "/recycle-bin" && basePath !== "/elections" && basePath !== "/recognitions" && basePath !== "/team-leader-of-the-week" && !basePath.startsWith("/ceo-dashboard") && !basePath.startsWith("/work/sales") && !basePath.startsWith("/payroll") && !basePath.startsWith("/employees") && !basePath.startsWith("/recruitment") && !basePath.startsWith("/workspace") && !basePath.startsWith("/approvals") && !basePath.startsWith("/invoice") && !basePath.startsWith("/reports") && !basePath.startsWith("/finance") && (
          <>
            <header className="mb-8 max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Navigation review
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                Your sidebar, reorganized
              </h1>
              <p className="mt-3 text-muted-foreground">
                Same menu items from your screenshots — regrouped, searchable and collapsible. Click
                around the sidebar to try it.
              </p>
            </header>

            <section className="mb-10">
              <h2 className="mb-4 text-lg font-bold">What changed</h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {improvements.map(([title, body]) => (
                  <div key={title} className="rounded-xl border border-border bg-card p-4">
                    <p className="font-semibold">{title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{body}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="max-w-5xl">
              <h2 className="mb-4 text-lg font-bold">Worth adding next</h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {suggestions.map(([title, body]) => (
                  <li key={title} className="rounded-xl border border-dashed border-border p-4">
                    <p className="font-semibold">{title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{body}</p>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </main>
        <QuickActionModals activeAction={activeAction} onClose={() => setActiveAction(null)} />
      </div>
          </SalesProvider>
        </EmployeeProvider>
      </DepartmentProvider>
    </SettingsProvider>
    </GlobalModalProvider>
  );
}
