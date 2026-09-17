import type { UserProfile, PermissionFlags } from "@/components/auth/AuthContext";
import { NavItem, NavChild } from "@/components/nav-data";

/**
 * Checks if the user has permission to access a given URL or perform an action.
 * - Admin role always has 100% full access to all modules and actions.
 * - Non-admin users check their resolved module permissions from user_permissions or presets.
 */
export function hasModulePermission(
  user: UserProfile | null,
  url?: string,
  action: "read" | "create" | "update" | "delete" = "read"
): boolean {
  if (!user) return false;

  // Admin has full unrestricted access everywhere
  if (user.role === "Admin") {
    return true;
  }

  if (!url) return false;

  const perms = user.permissions;
  if (!perms || Object.keys(perms).length === 0) {
    // Basic fallback for standard employee
    const defaultAllowedPrefixes = [
      "/dashboard",
      "/employees/attendance",
      "/employees/leave-requests",
      "/schedule",
      "/tasks",
      "/chat",
      "/work/logs",
      "/workspace",
      "/remarks",
      "/profile"
    ];
    return defaultAllowedPrefixes.some(prefix => url.startsWith(prefix));
  }

  // 1. Direct match on url
  if (perms[url]) {
    const p = perms[url];
    return Boolean(p.all || p[action]);
  }

  // 2. Find matching base prefix
  // e.g., url "/employees/list" -> check "/employees"
  // url "/payroll/dashboard" -> check "/payroll"
  // url "/work/sales/leads" -> check "/work/sales", then "/work"
  const basePath = url.split("?")[0] ?? "";
  const parts = basePath.split("/").filter(Boolean);

  // Try longest prefix to shortest
  for (let i = parts.length; i >= 1; i--) {
    const candidate = "/" + parts.slice(0, i).join("/");
    if (perms[candidate]) {
      const p = perms[candidate];
      return Boolean(p.all || p[action]);
    }
  }

  // Admin-only sections are denied by default if not granted
  const adminOnlyPrefixes = [
    "/access-control",
    "/settings",
    "/restrictions",
    "/activity-tracker",
    "/activity-logs",
    "/recycle-bin",
    "/ceo-dashboard",
    "/payroll",
    "/finance",
    "/invoice",
    "/recruitment"
  ];
  if (adminOnlyPrefixes.some(pref => url.startsWith(pref))) {
    return false;
  }

  // For general work items, allow if read is default
  const generalAllowed = ["/dashboard", "/schedule", "/chat", "/tasks", "/work/logs", "/profile"];
  return generalAllowed.some(pref => url.startsWith(pref));
}

/**
 * Filters the sidebar navigation tree based on user permissions.
 */
export function filterNavigationForUser(
  items: NavItem[],
  user: UserProfile | null
): NavItem[] {
  if (!user) return [];

  // Admin gets the full unaltered navigation
  if (user.role === "Admin") {
    return items;
  }

  return items
    .map((item) => {
      // Filter children if present
      if (item.children && item.children.length > 0) {
        const allowedChildren = item.children.filter((child) =>
          hasModulePermission(user, child.url, "read")
        );

        if (allowedChildren.length > 0) {
          return {
            ...item,
            children: allowedChildren,
          };
        }

        // If no children allowed, don't show the parent group unless parent URL is allowed
        if (item.url && hasModulePermission(user, item.url, "read")) {
          return {
            ...item,
            children: [],
          };
        }
        return null;
      }

      // Single item without children
      if (item.url && hasModulePermission(user, item.url, "read")) {
        return item;
      }

      return null;
    })
    .filter(Boolean) as NavItem[];
}
