import React, { useEffect, useState, useMemo } from "react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Briefcase,
  User,
  ArrowRight,
  ReceiptText,
  ListPlus,
  UserPlus,
  CalendarPlus,
  Target,
  FileText,
  Sparkles,
} from "lucide-react";
import { navItems, type NavItem } from "@/components/nav-data";
import { filterNavigationForUser, hasModulePermission } from "@/lib/permissions";
import { useAuth } from "@/components/auth/AuthContext";
import { useEmployeesContext } from "@/components/employees/EmployeeContext";
import { api } from "@/lib/api";

interface CommandPaletteProps {
  onNavigate: (url: string) => void;
  onQuickAction?: (action: string) => void;
}

const QUICK_ACTIONS = [
  { title: "New Invoice", url: "/invoice/create", icon: ReceiptText, keywords: "bill payment invoice create" },
  { title: "New Task", url: "/tasks?new=1", icon: ListPlus, keywords: "task todo assign create" },
  { title: "Add Employee", url: "/employees/list?new=1", icon: UserPlus, keywords: "staff hire employee onboard" },
  { title: "Apply Leave", url: "/employees/leave-requests?new=1", icon: CalendarPlus, keywords: "leave holiday time off" },
  { title: "New Project", url: "/work/projects?new=1", icon: Briefcase, keywords: "client project content calendar" },
  { title: "New Lead", url: "/work/sales/leads?new=1", icon: Target, keywords: "sales crm lead" },
  { title: "Add Document", url: "/employees/documents?new=1", icon: FileText, keywords: "offer letter document" },
];

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  onNavigate,
}) => {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const { employees } = useEmployeesContext();
  const [projects, setProjects] = useState<any[]>([]);
  const [loadedProjects, setLoadedProjects] = useState(false);

  // Listen for Ctrl+K / Cmd+K and custom "open-command-palette" event
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    const onCustomOpen = () => setOpen(true);

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("open-command-palette", onCustomOpen);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("open-command-palette", onCustomOpen);
    };
  }, []);

  // Fetch projects once when palette opens
  useEffect(() => {
    if (!open || loadedProjects) return;
    let mounted = true;
    const fetchProjects = async () => {
      try {
        const res = await api.get<any>("/projects?limit=150", { showLoader: false });
        const list = Array.isArray(res) ? res : (res?.data || []);
        if (mounted) {
          setProjects(list.filter((p: any) => !p.is_deleted && !p.is_archived));
          setLoadedProjects(true);
        }
      } catch {
        // Ignore silent fetch failures
      }
    };
    fetchProjects();
    return () => {
      mounted = false;
    };
  }, [open, loadedProjects]);

  const flatNavPages = useMemo(() => {
    const allowed = filterNavigationForUser(navItems, user);
    const pages: { title: string; url: string; group?: string; icon: any }[] = [];
    allowed.forEach((item: NavItem) => {
      if (item.url) {
        pages.push({ title: item.title, url: item.url, icon: item.icon });
      }
      if (item.children) {
        item.children.forEach(child => {
          if (!child.hideInSidebar) {
            pages.push({
              title: `${item.title} › ${child.title}`,
              url: child.url,
              group: item.title,
              icon: child.icon || item.icon,
            });
          }
        });
      }
    });
    return pages;
  }, [user]);

  const allowedActions = useMemo(() => {
    return QUICK_ACTIONS.filter(a => hasModulePermission(user, a.url, "create"));
  }, [user]);

  const handleSelectUrl = (url: string) => {
    setOpen(false);
    onNavigate(url);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search pages, employees, projects, or actions... (Esc to close)" />
      <CommandList className="max-h-[420px]">
        <CommandEmpty>No matching pages, employees, or projects found.</CommandEmpty>

        {/* Quick Actions */}
        {allowedActions.length > 0 && (
          <CommandGroup heading="Quick Actions">
            {allowedActions.map(action => {
              const Icon = action.icon;
              return (
                <CommandItem
                  key={action.url}
                  value={`${action.title} ${action.keywords}`}
                  onSelect={() => handleSelectUrl(action.url)}
                  className="cursor-pointer flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="font-semibold text-sm">{action.title}</span>
                  </div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                    Action <ArrowRight className="w-3 h-3" />
                  </span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        <CommandSeparator />

        {/* Navigation Pages */}
        <CommandGroup heading="Pages & Modules">
          {flatNavPages.map(page => {
            const Icon = page.icon;
            return (
              <CommandItem
                key={page.url}
                value={`${page.title} ${page.url}`}
                onSelect={() => handleSelectUrl(page.url)}
                className="cursor-pointer flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium">{page.title}</span>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground">{page.url}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>

        {/* Active Projects */}
        {projects.length > 0 && hasModulePermission(user, "/work/projects", "read") && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Projects & Content Calendars">
              {projects.slice(0, 25).map(proj => {
                const pid = String(proj._id || proj.id);
                const pName = proj.name || proj.title || "Project";
                const cName = proj.client_name || proj.company_name || "";
                return (
                  <CommandItem
                    key={pid}
                    value={`project ${pName} ${cName}`}
                    onSelect={() => {
                      if (typeof window !== "undefined") {
                        localStorage.setItem("hrms_selected_project_id", pid);
                      }
                      handleSelectUrl("/work/projects");
                    }}
                    className="cursor-pointer flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Briefcase className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span className="text-sm font-medium truncate">{pName}</span>
                    </div>
                    {cName && (
                      <span className="text-[11px] text-muted-foreground truncate max-w-[140px]">
                        {cName}
                      </span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}

        {/* Employees */}
        {employees.length > 0 && hasModulePermission(user, "/employees/list", "read") && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Employees">
              {employees.slice(0, 30).map((emp: any) => {
                const eid = String(emp.id || emp._id);
                const eName = emp.name || emp.full_name || "Employee";
                const dept = emp.department || emp.designation || "";
                return (
                  <CommandItem
                    key={eid}
                    value={`employee ${eName} ${dept}`}
                    onSelect={() => handleSelectUrl("/employees/list")}
                    className="cursor-pointer flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <User className="w-4 h-4 text-indigo-500 shrink-0" />
                      <span className="text-sm font-medium truncate">{eName}</span>
                    </div>
                    {dept && (
                      <span className="text-[11px] text-muted-foreground truncate max-w-[140px]">
                        {dept}
                      </span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}
      </CommandList>
      <div className="border-t border-border/50 px-4 py-2 bg-muted/30 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span>Universal HRMS Search</span>
        </span>
        <div className="flex items-center gap-2">
          <kbd className="px-1.5 py-0.5 rounded bg-background border border-border text-[10px] font-mono">↑↓</kbd>
          <span>Navigate</span>
          <kbd className="px-1.5 py-0.5 rounded bg-background border border-border text-[10px] font-mono">↵</kbd>
          <span>Open</span>
        </div>
      </div>
    </CommandDialog>
  );
};
