import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Menu,
  Pin,
  PinOff,
  Plus,
  Search,
  X,
  Clock,
  Lock,
  Unlock,
  Settings,
  ReceiptText,
  ListPlus,
  UserPlus,
  CalendarPlus,
  Briefcase,
  Target,
  MonitorPlay,
  FileText
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  mobileBarItems,
  navItems,
  sectionOrder,
  type NavItem,
  type QuickAction
} from "./nav-data";
import { useTheme } from "./ThemeProvider";
import { triggerGlobalModal, type GlobalModalType } from "./GlobalModalContext";
import { useAuth } from "./auth/AuthContext";
import { LoginModal } from "./auth/LoginModal";
import { getAvatarUrl } from "@/lib/config";
import { LogIn, LogOut } from "lucide-react";
import { filterNavigationForUser, hasModulePermission } from "@/lib/permissions";


function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span 
      className="ml-auto shrink-0 rounded-full bg-primary w-2.5 h-2.5 shadow-sm shadow-primary/30" 
      aria-label={`${count} notifications`} 
    />
  );
}

const ALL_CREATE_ACTIONS: QuickAction[] = [
  { title: "New Invoice", url: "/invoice/create", icon: ReceiptText, hint: "Finance" },
  { title: "New Task", url: "/tasks?new=1", icon: ListPlus, hint: "Work" },
  { title: "Add Employee", url: "/employees/list?new=1", icon: UserPlus, hint: "People" },
  { title: "Apply Leave", url: "/employees/leave-requests?new=1", icon: CalendarPlus, hint: "Work" },
  { title: "New Project", url: "/work/projects?new=1", icon: Briefcase, hint: "Work" },
  { title: "New Lead", url: "/work/sales/leads?new=1", icon: Target, hint: "Sales" },
  { title: "New Meeting", url: "/meetings?new=1", icon: MonitorPlay, hint: "Collaboration" },
  { title: "Add Document", url: "/employees/documents?new=1", icon: FileText, hint: "People" },
];

function CreateMenu({ collapsed, onNavigate }: { collapsed: boolean; onNavigate: (url: string) => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  
  const allowedCreateActions = useMemo(() => {
    return ALL_CREATE_ACTIONS.filter(a => hasModulePermission(user, a.url, "create"));
  }, [user]);

  const [selectedUrls, setSelectedUrls] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("hrms_custom_create_actions");
      if (stored) return JSON.parse(stored);
    }
    return ["/invoice/create", "/tasks?new=1", "/employees/list?new=1", "/employees/leave-requests?new=1"];
  });

  const activeActions = useMemo(() => {
    return allowedCreateActions.filter(a => selectedUrls.includes(a.url));
  }, [allowedCreateActions, selectedUrls]);

  const toggleAction = (url: string) => {
    setSelectedUrls(prev => {
      const next = prev.includes(url) ? prev.filter(u => u !== url) : [...prev, url];
      if (typeof window !== "undefined") {
        localStorage.setItem("hrms_custom_create_actions", JSON.stringify(next));
      }
      return next;
    });
  };

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      // Don't close if clicking inside the customize dialog
      if ((e.target as Element).closest('[role="dialog"]')) return;
      setOpen(false);
    };
    window.addEventListener("click", close, false);
    return () => window.removeEventListener("click", close, false);
  }, [open]);

  return (
    <>
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((o) => !o)}
        title={collapsed ? "Create" : undefined}
        aria-label="Create"
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg bg-sidebar-primary px-3 py-2 text-sm font-semibold text-sidebar-primary-foreground transition-opacity hover:opacity-90",
          collapsed && "justify-center px-0",
        )}
      >
        <Plus className="h-4 w-4 shrink-0" />
        {!collapsed && <span>Create</span>}
      </button>

      {open && (
        <div
          className={cn(
            "absolute z-50 mt-1 w-56 overflow-hidden rounded-xl border border-sidebar-border bg-sidebar-surface p-1 shadow-lg",
            collapsed ? "left-full top-0 ml-2" : "left-0 right-0",
          )}
        >
          {activeActions.length > 0 ? (
            activeActions.map((a) => (
              <button
                key={a.url}
                onClick={() => {
                  setOpen(false);
                  onNavigate(a.url);
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-sidebar-accent"
              >
                <a.icon className="h-4 w-4 shrink-0 text-sidebar-muted" />
                <span className="flex-1 truncate">{a.title}</span>
                {a.hint && <span className="text-[10px] uppercase text-sidebar-muted">{a.hint}</span>}
              </button>
            ))
          ) : (
            <div className="px-3 py-4 text-center text-xs text-sidebar-muted">No actions selected</div>
          )}
          <div className="h-px bg-sidebar-border my-1" />
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
              setIsCustomizeOpen(true);
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
          >
            <Settings className="h-4 w-4 shrink-0" />
            <span className="flex-1 truncate">Customize Menu</span>
          </button>
        </div>
      )}
    </div>

    <Dialog open={isCustomizeOpen} onOpenChange={setIsCustomizeOpen}>
      <DialogContent className="max-w-[425px] p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card z-[9999]">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border/50 bg-muted/30">
          <div>
            <h2 className="text-lg font-black tracking-tight">Customize Create Menu</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Select which shortcuts appear in the Create menu</p>
          </div>
          <DialogClose asChild>
            <button className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </DialogClose>
        </div>
        <div className="p-4 max-h-[60vh] overflow-y-auto space-y-1 bg-white">
          {ALL_CREATE_ACTIONS.map((a) => {
            const isSelected = selectedUrls.includes(a.url);
            return (
              <label key={a.url} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 cursor-pointer transition-colors border border-transparent hover:border-border/50">
                <div className={cn("w-5 h-5 rounded flex items-center justify-center border transition-colors", isSelected ? "bg-primary border-primary text-primary-foreground" : "border-input bg-background")}>
                  {isSelected && <Plus className="w-3.5 h-3.5 rotate-45" />}
                </div>
                <input 
                  type="checkbox" 
                  className="hidden" 
                  checked={isSelected}
                  onChange={() => toggleAction(a.url)}
                />
                <div className="flex items-center gap-2.5 flex-1">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                    <a.icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{a.title}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">{a.hint}</p>
                  </div>
                </div>
              </label>
            );
          })}
        </div>
        <div className="px-6 py-4 border-t border-border/50 bg-muted/30">
          <button onClick={() => setIsCustomizeOpen(false)} className="w-full px-4 py-2 bg-primary text-primary-foreground font-bold rounded-xl text-sm hover:bg-primary/95 transition-colors">
            Done
          </button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

function SidebarBody({
  collapsed,
  setCollapsed,
  active,
  setActive,
  isMobile,
  onClose,
  isLocked,
}: {
  collapsed: boolean;
  setCollapsed: (fn: (c: boolean) => boolean) => void;
  active: string;
  setActive: (url: string) => void;
  isMobile?: boolean;
  onClose?: () => void;
  isLocked?: boolean;
}) {
  const { logoUrl, companyName } = useTheme();
  const { user, isAuthenticated, logout } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [query, setQuery] = useState("");
  const [openGroups, setOpenGroups] = useState<string[]>(
    navItems.filter((i) => i.children?.length).map((i) => i.title),
  );
  const [pinned, setPinned] = useState<string[]>(["Attendance"]);
  const [collapsedSections, setCollapsedSections] = useState<string[]>([]);
  const [recents, setRecents] = useState<{ title: string; url: string }[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sidebar-recents");
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  const q = query.trim().toLowerCase();

  const go = (url: string) => {
    setActive(url);
    onClose?.();

    // Find title of item being navigated to
    let title = "";
    for (const item of navItems) {
      if (item.url === url) {
        title = item.title;
        break;
      }
      const child = item.children?.find((c) => c.url === url);
      if (child) {
        title = `${item.title} — ${child.title}`;
        break;
      }
    }

    if (title) {
      setRecents((prev) => {
        const filtered = prev.filter((r) => r.url !== url);
        const updated = [{ title, url }, ...filtered].slice(0, 5);
        localStorage.setItem("sidebar-recents", JSON.stringify(updated));
        return updated;
      });
    }
  };

  const toggleSection = (section: string) => {
    setCollapsedSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section],
    );
  };

  const userAllowedNavItems = useMemo(() => {
    return filterNavigationForUser(navItems, user);
  }, [user]);

  const filtered = useMemo(() => {
    const baseItems = userAllowedNavItems;
    if (!q) return baseItems;
    return baseItems
      .map((item) => {
        const selfMatch = item.title.toLowerCase().includes(q);
        const children = item.children?.filter((c) => c.title.toLowerCase().includes(q));
        if (selfMatch) return item;
        if (children && children.length) return { ...item, children };
        return null;
      })
      .filter(Boolean) as NavItem[];
  }, [userAllowedNavItems, q]);

  const grouped = useMemo(
    () =>
      sectionOrder
        .map((section) => ({
          section,
          items: filtered.filter((i) => i.section === section),
        }))
        .filter((g) => g.items.length > 0),
    [filtered],
  );

  const pinnedLinks = useMemo(() => {
    const out: { title: string; url: string }[] = [];
    for (const item of userAllowedNavItems) {
      if (item.url && pinned.includes(item.title)) out.push({ title: item.title, url: item.url });
      for (const c of item.children ?? []) {
        const compoundTitle = `${item.title} — ${c.title}`;
        if (pinned.includes(compoundTitle) || pinned.includes(c.title)) out.push({ title: compoundTitle, url: c.url });
      }
    }
    return out;
  }, [userAllowedNavItems, pinned]);

  const toggleGroup = (title: string) => {
    const item = navItems.find((i) => i.title === title);
    if (!item) return;

    setOpenGroups((prev) => {
      const isAlreadyOpen = prev.includes(title);
      if (isAlreadyOpen) {
        return prev.filter((t) => t !== title);
      } else {
        const siblingGroupTitles = navItems
          .filter((i) => i.section === item.section && i.title !== title && i.children?.length)
          .map((i) => i.title);
        return [...prev.filter((t) => !siblingGroupTitles.includes(t)), title];
      }
    });
  };

  const togglePin = (title: string) =>
    setPinned((prev) =>
      prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title],
    );

  return (
    <>
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-sidebar-border px-3">
        {logoUrl ? (
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white border border-border overflow-hidden">
            <img src={logoUrl} alt="Logo" className="max-w-full max-h-full object-contain p-0.5" />
          </div>
        ) : (
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sidebar-primary text-sm font-black text-sidebar-primary-foreground">
            {companyName.charAt(0)}
          </div>
        )}
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{companyName}</p>
            <p className="truncate text-[11px] text-sidebar-muted">Workspace</p>
          </div>
        )}
        {isMobile ? (
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          !collapsed && (
            <button
              onClick={() => setCollapsed((c) => !c)}
              aria-label={isLocked ? "Collapse sidebar" : "Lock sidebar open"}
              title={isLocked ? "Collapse sidebar" : "Lock sidebar open"}
              className="ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              {isLocked ? <Lock className="h-4 w-4 text-sidebar-primary" /> : <Unlock className="h-4 w-4" />}
            </button>
          )
        )}
      </div>

      <div className="px-3 pb-2 pt-3">
        <CreateMenu collapsed={collapsed} onNavigate={go} />
      </div>

      {!collapsed && (
        <div className="px-3 pb-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sidebar-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search menu…"
              className="h-9 w-full rounded-lg border border-sidebar-border bg-sidebar-surface pl-8 pr-8 text-sm outline-none placeholder:text-sidebar-muted focus:ring-2 focus:ring-sidebar-ring/40"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-sidebar-muted hover:text-sidebar-accent-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        {!collapsed && !q && pinnedLinks.length > 0 && (
          <div className="mb-2">
            <button
              onClick={() => toggleSection("Pinned")}
              className="flex w-full items-center justify-between px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-sidebar-muted hover:text-sidebar-foreground"
            >
              <span>Pinned</span>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform",
                  collapsedSections.includes("Pinned") ? "-rotate-90" : "",
                )}
              />
            </button>
            {!collapsedSections.includes("Pinned") &&
              pinnedLinks.map((p) => (
                <button
                  key={p.url}
                  onClick={() => go(p.url)}
                  className={cn(
                    "group flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors",
                    active === p.url
                      ? "bg-sidebar-primary font-semibold text-sidebar-primary-foreground"
                      : "hover:bg-sidebar-accent",
                  )}
                >
                  <Pin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{p.title}</span>
                  <span
                    role="button"
                    aria-label={`Unpin ${p.title}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePin(p.title);
                    }}
                    className="ml-auto hidden shrink-0 group-hover:block"
                  >
                    <PinOff className="h-3.5 w-3.5" />
                  </span>
                </button>
              ))}
          </div>
        )}

        {!collapsed && !q && recents.length > 0 && (
          <div className="mb-2">
            <button
              onClick={() => toggleSection("Recents")}
              className="flex w-full items-center justify-between px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-sidebar-muted hover:text-sidebar-foreground"
            >
              <span>Recents</span>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform",
                  collapsedSections.includes("Recents") ? "-rotate-90" : "",
                )}
              />
            </button>
            {!collapsedSections.includes("Recents") &&
              recents.map((r) => (
                <button
                  key={r.url}
                  onClick={() => go(r.url)}
                  className={cn(
                    "group flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors",
                    active === r.url
                      ? "bg-sidebar-primary font-semibold text-sidebar-primary-foreground"
                      : "hover:bg-sidebar-accent",
                  )}
                >
                  <Clock className={cn("h-3.5 w-3.5 shrink-0", active === r.url ? "text-sidebar-primary-foreground" : "text-sidebar-muted")} />
                  <span className="truncate">{r.title}</span>
                </button>
              ))}
          </div>
        )}

        {grouped.map((group) => {
          const isSectionCollapsed = collapsedSections.includes(group.section);
          return (
            <div key={group.section} className="mb-1">
              {!collapsed && (
                <button
                  onClick={() => toggleSection(group.section)}
                  className="flex w-full items-center justify-between px-2 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wider text-sidebar-muted hover:text-sidebar-foreground"
                >
                  <span>{group.section}</span>
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 transition-transform",
                      isSectionCollapsed ? "-rotate-90" : "",
                    )}
                  />
                </button>
              )}
              {(!isSectionCollapsed || collapsed) &&
                group.items.map((item) => {
              const isOpen = openGroups.includes(item.title) || Boolean(q);
              const hasChildren = Boolean(item.children?.length);
              const selfActive = item.url === active;
              const childActive = item.children?.some((c) => c.url === active);

              return (
                <div key={item.title}>
                  <button
                    title={collapsed ? item.title : undefined}
                    onClick={() => (hasChildren ? toggleGroup(item.title) : item.url && go(item.url))}
                    className={cn(
                      "group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                      collapsed && "justify-center px-0",
                      selfActive
                        ? "bg-sidebar-primary font-semibold text-sidebar-primary-foreground"
                        : childActive && !isOpen
                          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                          : "hover:bg-sidebar-accent",
                    )}
                  >
                    <item.icon className="h-4.5 w-4.5 shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="min-w-0 flex-1 truncate text-left">{item.title}</span>
                        {item.badge ? <Badge count={item.badge} /> : null}
                        {hasChildren && (
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 shrink-0 transition-transform",
                              isOpen && "rotate-180",
                            )}
                          />
                        )}
                        {!hasChildren && (
                          <span
                            role="button"
                            aria-label={`Pin ${item.title}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePin(item.title);
                            }}
                            className="hidden shrink-0 text-sidebar-muted group-hover:block hover:text-sidebar-foreground"
                          >
                            <Pin className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </>
                    )}
                  </button>

                  {!collapsed && hasChildren && isOpen && (
                    <div className="my-0.5 ml-[19px] border-l border-sidebar-border pl-2">
                      {item.children!.map((child) => (
                        <button
                          key={child.url}
                          onClick={() => go(child.url)}
                          className={cn(
                            "group flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors",
                            child.url === active
                              ? "bg-sidebar-surface font-semibold text-sidebar-accent-foreground shadow-sm"
                              : "text-sidebar-foreground/80 hover:bg-sidebar-accent",
                          )}
                        >
                          {child.icon && (
                            <child.icon
                              className={cn(
                                "h-4 w-4 shrink-0 transition-colors",
                                child.url === active
                                  ? "text-sidebar-accent-foreground"
                                  : "text-sidebar-muted group-hover:text-sidebar-accent-foreground",
                              )}
                            />
                          )}
                          <span className="min-w-0 flex-1 truncate text-left">{child.title}</span>
                          {child.badge ? <Badge count={child.badge} /> : null}
                          <span
                            role="button"
                            aria-label={`Pin ${child.title}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePin(`${item.title} — ${child.title}`);
                            }}
                            className="hidden shrink-0 text-sidebar-muted group-hover:block"
                          >
                            <Pin className="h-3.5 w-3.5" />
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )})}

        {q && grouped.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-sidebar-muted">No matches</p>
        )}
      </nav>

      {/* User Footer / Login Action */}
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
      <div className="border-t border-sidebar-border p-2 shrink-0">
        {isAuthenticated && user ? (
          <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-sidebar-accent/40">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src={getAvatarUrl(user.profile_photo || user.avatar, user.name || "User")}
                alt={user.name}
                className="w-8 h-8 rounded-full object-cover shrink-0 border border-border"
              />
              {!collapsed && (
                <div className="min-w-0 text-left">
                  <p className="text-xs font-bold text-sidebar-foreground truncate">{user.name}</p>
                  <p className="text-[10px] text-sidebar-muted truncate">{user.role}</p>
                </div>
              )}
            </div>
            {!collapsed && (
              <button
                onClick={logout}
                title="Sign Out"
                className="p-1.5 text-sidebar-muted hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={() => setShowLoginModal(true)}
            className={cn(
              "w-full flex items-center gap-2.5 p-2 rounded-xl text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 transition-all",
              collapsed ? "justify-center" : "justify-between"
            )}
          >
            <div className="flex items-center gap-2">
              <LogIn className="w-4 h-4 shrink-0" />
              {!collapsed && <span>Sign In</span>}
            </div>
          </button>
        )}
      </div>
    </>
  );
}

export function AppSidebar({ active = "/dashboard", setActive }: { active?: string; setActive?: (url: string) => void }) {
  const { logoUrl, companyName } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  // Default to internal state if no setActive is provided (for backward compatibility if used elsewhere)
  const [internalActive, setInternalActive] = useState(active);
  
  const currentActive = setActive ? active : internalActive;
  const handleSetActive = setActive || setInternalActive;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const effectivelyCollapsed = collapsed && !isHovered;

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  return (
    <>
      {/* Mobile top bar */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-2 border-b border-sidebar-border bg-sidebar px-3 text-sidebar-foreground md:hidden">
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          className="grid h-9 w-9 place-items-center rounded-lg hover:bg-sidebar-accent"
        >
          <Menu className="h-5 w-5" />
        </button>
        <p className="text-sm font-bold truncate flex-1 min-w-0">{companyName}</p>
      </header>

      {/* Mobile drawer */}
      <div
        className={cn(
          "fixed inset-0 z-50 md:hidden",
          drawerOpen ? "pointer-events-auto" : "pointer-events-none",
        )}
        aria-hidden={!drawerOpen}
      >
        <div
          onClick={() => setDrawerOpen(false)}
          className={cn(
            "absolute inset-0 bg-black/50 transition-opacity duration-200",
            drawerOpen ? "opacity-100" : "opacity-0",
          )}
        />
        <aside
          className={cn(
            "absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-2xl transition-transform duration-200",
            drawerOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <SidebarBody
            collapsed={false}
            setCollapsed={() => {}}
            active={currentActive}
            setActive={handleSetActive}
            isMobile
            onClose={() => setDrawerOpen(false)}
          />
        </aside>
      </div>

      {/* Mobile bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-sidebar-border bg-sidebar text-sidebar-foreground md:hidden pb-[max(0.25rem,env(safe-area-inset-bottom))] shadow-lg">
        {mobileBarItems.map((item) => (
          <button
            key={item.url}
            onClick={() => handleSetActive(item.url)}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 px-1 text-[10px] font-semibold min-w-0 transition-colors active:scale-95",
              currentActive === item.url ? "text-sidebar-primary font-bold" : "text-sidebar-muted hover:text-sidebar-foreground",
            )}
          >
            <item.icon className="h-4.5 w-4.5 shrink-0" />
            <span className="truncate max-w-[60px] text-center block leading-tight">{item.title}</span>
          </button>
        ))}
      </nav>

      {/* Desktop sidebar */}
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          "hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:sticky md:top-0 md:flex",
          effectivelyCollapsed ? "w-[68px]" : "w-[268px]",
        )}
      >
        <SidebarBody
          collapsed={effectivelyCollapsed}
          setCollapsed={setCollapsed}
          active={currentActive}
          setActive={handleSetActive}
          isLocked={!collapsed}
        />
      </aside>
    </>
  );
}
