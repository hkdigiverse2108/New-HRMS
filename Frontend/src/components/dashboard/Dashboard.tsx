import { DashboardHeader } from "./sections/DashboardHeader";
import { TimeTrackerWidget } from "./sections/TimeTrackerWidget";
import { CompanyHealth } from "./sections/CompanyHealth";
import { EmployeePerformance } from "./sections/EmployeePerformance";
import { AttendanceAnalytics } from "./sections/AttendanceAnalytics";
import { DepartmentStatus } from "./sections/DepartmentStatus";
import { ProjectDelivery } from "./sections/ProjectDelivery";
import { SalesOverview } from "./sections/SalesOverview";
import { FinanceOverview } from "./sections/FinanceOverview";
import { TasksAndClients } from "./sections/TasksAndClients";
import { HRAndNews } from "./sections/HRAndNews";
import { ActivityAndAI } from "./sections/ActivityAndAI";
import { OverallKPIs } from "./sections/OverallKPIs";

export function Dashboard({ setActive, onAction }: { setActive?: (url: string) => void, onAction?: (action: string) => void }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
      {/* SECTION 01: Header */}
      <DashboardHeader setActive={setActive} onAction={onAction} />

      {/* SECTION 01b: Time Tracker Widget */}
      <TimeTrackerWidget />

      {/* SECTION 02: Company Health (12 Metrics) */}
      <CompanyHealth />

      {/* SECTION 03: Employee Performance (Top 5, Spotlight) */}
      <EmployeePerformance />

      {/* SECTION 04: Attendance Analytics (Heatmap, WFH, Leaves) */}
      <AttendanceAnalytics />

      {/* SECTION 05: Department Status */}
      <DepartmentStatus />

      {/* SECTION 06: Project Delivery (Metrics & Gantt) */}
      <ProjectDelivery />

      {/* SECTION 07: Sales Overview */}
      <SalesOverview />

      {/* SECTION 08: Finance Overview */}
      <FinanceOverview />

      {/* SECTIONS 09 & 10: Tasks and Clients */}
      <TasksAndClients />

      {/* SECTIONS 11 & 12: HR Updates and Company News */}
      <HRAndNews />

      {/* SECTIONS 13, 14, 15: Calendar, Activity, AI Insights */}
      <ActivityAndAI />

      {/* SECTIONS 16 & 17: Overall KPIs and Bottom Widgets */}
      <OverallKPIs />
    </div>
  );
}
