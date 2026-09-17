import type { UserProfile, PermissionFlags } from "@/components/auth/AuthContext";
import { NavItem, NavChild } from "@/components/nav-data";

/**
 * Determines if the current user has full Admin privileges.
 */
export function isUserAdmin(user: UserProfile | null): boolean {
  if (!user) return false;
  const role = String(user.role || (user as any).system_role || "").toLowerCase().trim();
  return (
    role === "admin" ||
    role === "super admin" ||
    role === "superadmin" ||
    Boolean((user as any).is_superuser)
  );
}

/**
 * Checks if the user has permission to access a given URL or perform an action.
 * - Admin role always has 100% full access to all modules and actions.
 * - Non-admin users check their dynamically resolved module permissions from the database.
 */
export function hasModulePermission(
  user: UserProfile | null,
  url?: string,
  action: "read" | "create" | "update" | "delete" = "read"
): boolean {
  if (!user) return false;

  // Admin has full unrestricted access everywhere based purely on role
  if (isUserAdmin(user)) {
    return true;
  }

  if (!url) return false;

  const perms = user.permissions;

  // Basic fallback for standard employee when no custom permissions are set
  if (!perms || Object.keys(perms).length === 0) {
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
    return action === "read" && defaultAllowedPrefixes.some(prefix => url.startsWith(prefix));
  }

  const cleanUrl = (url.split("?")[0] ?? "").replace(/\/+$/, "") || "/";

  // 1. Direct match on exact URL
  if (perms[url]) {
    const p = perms[url];
    return Boolean(p.all || p[action]);
  }
  if (perms[cleanUrl]) {
    const p = perms[cleanUrl];
    return Boolean(p.all || p[action]);
  }

  // 2. Dynamic hierarchical prefix matching (e.g. "/work/tasks/123" checks "/work/tasks", then "/work")
  const parts = cleanUrl.split("/").filter(Boolean);
  for (let i = parts.length - 1; i >= 1; i--) {
    const parent = "/" + parts.slice(0, i).join("/");
    if (perms[parent]) {
      const p = perms[parent];
      return Boolean(p.all || p[action]);
    }
  }

  // 3. Dynamic child match for parent group URLs
  // If user requests read on parent (e.g. "/employees"), allow read if user has access to any child module (e.g. "/employees/list")
  if (action === "read") {
    const hasAnyChildPermitted = Object.keys(perms).some(permUrl => {
      if (permUrl !== cleanUrl && permUrl.startsWith(cleanUrl + "/")) {
        const p = perms[permUrl];
        return Boolean(p?.all || p?.read);
      }
      return false;
    });
    if (hasAnyChildPermitted) {
      return true;
    }
  }

  return false;
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
  if (isUserAdmin(user)) {
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
