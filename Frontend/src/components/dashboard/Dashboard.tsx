import { DashboardHeader } from "./sections/DashboardHeader";
import { TimeTrackerWidget } from "./sections/TimeTrackerWidget";
import { TodaySchedule } from "./sections/TodaySchedule";
import { NotificationsStrip } from "./sections/NotificationsStrip";
import { useAuth } from "@/components/auth/AuthContext";
import { hasModulePermission, isUserAdmin } from "@/lib/permissions";
import { CompanyHealth } from "./sections/CompanyHealth";
import { EmployeePerformance } from "./sections/EmployeePerformance";
import { AttendanceAnalytics } from "./sections/AttendanceAnalytics";
import { DepartmentStatus } from "./sections/DepartmentStatus";
import { ProjectDelivery } from "./sections/ProjectDelivery";
import { SalesOverview } from "./sections/SalesOverview";
import { FinanceOverview } from "./sections/FinanceOverview";
import { TasksAndClients } from "./sections/TasksAndClients";
import { HRAndNews } from "./sections/HRAndNews";

export function Dashboard({ setActive, onAction }: { setActive?: (url: string) => void, onAction?: (action: string) => void }) {
  const { user } = useAuth();
  // Section-level access (Meeting PDF): jene je section no access aape te j dekhay.
  // Jo user pase koi section-level key j nathi → /dashboard read par fallback (jun behavior).
  const showSection = (key: string) => {
    if (!user) return false;
    if (isUserAdmin(user)) return true;
    const perms = (user as any).permissions as Record<string, any> | undefined;
    const hasAnySectionKey = perms && Object.keys(perms).some(k => k.startsWith("/dashboard#"));
    if (!hasAnySectionKey) {
      return hasModulePermission(user, "/dashboard", "read");
    }
    return hasModulePermission(user, `/dashboard#${key}`, "read");
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
      {/* SECTION 01: Header (always) */}
      <DashboardHeader setActive={setActive} onAction={onAction} />

      {/* Notifications strip (Meeting PDF compulsory, top) */}
      {showSection("notifications") && <NotificationsStrip />}

      {/* SECTION 01b: Time Tracker Widget */}
      {showSection("time-tracker") && <TimeTrackerWidget />}

      {/* K19: Aajno Schedule + Today's Tasks (andar javani wait nai) */}
      {showSection("today-schedule") && <TodaySchedule setActive={setActive} />}

      {/* SECTION 02: Company Health (12 Metrics) */}
      {showSection("company-health") && <CompanyHealth />}

      {/* SECTION 03: Employee Performance (Top 5, Spotlight) */}
      {showSection("employee-performance") && <EmployeePerformance />}

      {/* SECTION 04: Attendance Analytics (Heatmap, WFH, Leaves) */}
      {showSection("attendance-analytics") && <AttendanceAnalytics />}

      {/* SECTION 05: Department Status */}
      {showSection("department-status") && <DepartmentStatus />}

      {/* SECTION 06: Project Delivery (Metrics & Gantt) */}
      {showSection("project-delivery") && <ProjectDelivery />}

      {/* SECTION 07: Sales Overview */}
      {showSection("sales-overview") && <SalesOverview />}

      {/* SECTION 08: Finance Overview */}
      {showSection("finance-overview") && <FinanceOverview />}

      {/* SECTIONS 09 & 10: Tasks and Clients */}
      {showSection("tasks-clients") && <TasksAndClients />}

      {/* SECTIONS 11 & 12: HR Updates and Company News */}
      {showSection("hr-news") && <HRAndNews />}

      {/* SECTIONS 13, 14, 15: Calendar, Activity, AI Insights — REMOVED per Audio PDF */}
      {/* SECTIONS 16 & 17: Overall KPIs and Bottom Widgets — REMOVED per Audio PDF */}
    </div>
  );
}
