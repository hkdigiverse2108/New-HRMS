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
import { SpotlightCelebrations } from "./sections/SpotlightCelebrations";
import { CalendarWidget } from "./sections/CalendarWidget";

export function Dashboard({ setActive, onAction }: { setActive?: (url: string) => void, onAction?: (action: string) => void }) {
  const { user } = useAuth();
  const showSection = (key: string) => {
    if (!user) return false;
    if (isUserAdmin(user)) return true;
    const perms = (user as any).permissions as Record<string, any> | undefined;
    if (!perms || Object.keys(perms).length === 0) {
      return false;
    }

    // Direct explicit grant for section
    const sectionKey = `/dashboard#${key}`;
    if (perms[sectionKey] !== undefined) {
      return Boolean(perms[sectionKey]?.read || perms[sectionKey]?.all);
    }

    // Calendar widget is tied to today-schedule
    if (key === "calendar-widget") {
      const todaySched = perms["/dashboard#today-schedule"];
      if (todaySched !== undefined) {
        return Boolean(todaySched?.read || todaySched?.all);
      }
    }

    // If full access on parent /dashboard
    if (perms["/dashboard"]?.all) return true;

    // Strict fallback ONLY when NO /dashboard# keys exist in perms at all (legacy users)
    const hasAnyDashboardSubKey = Object.keys(perms).some(k => k.startsWith("/dashboard#"));
    if (!hasAnyDashboardSubKey && hasModulePermission(user, "/dashboard", "read")) {
      return key === "time-tracker" || key === "today-schedule" || key === "calendar-widget";
    }

    return false;
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
      <SpotlightCelebrations />
      {/* SECTION 01: Header (always) */}
      <DashboardHeader setActive={setActive} onAction={onAction} />

      {/* Notifications strip (Meeting PDF compulsory, top) */}
      {showSection("notifications") && <NotificationsStrip />}

      {/* SECTION 01b: Time Tracker Widget */}
      {showSection("time-tracker") && <TimeTrackerWidget />}

      {/* K19: Today's Schedule + Today's Tasks (no need to open anything) */}
      {showSection("today-schedule") && <TodaySchedule setActive={setActive} />}

      {/* SECTION 01c: Interactive Company Calendar Widget */}
      {showSection("calendar-widget") && <CalendarWidget setActive={setActive} />}

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
      {showSection("tasks-clients") && <TasksAndClients setActive={setActive} />}

      {/* SECTIONS 11 & 12: HR Updates and Company News */}
      {showSection("hr-news") && <HRAndNews />}

      {/* SECTIONS 13, 14, 15: Calendar, Activity, AI Insights — REMOVED per Audio PDF */}
      {/* SECTIONS 16 & 17: Overall KPIs and Bottom Widgets — REMOVED per Audio PDF */}
    </div>
  );
}
