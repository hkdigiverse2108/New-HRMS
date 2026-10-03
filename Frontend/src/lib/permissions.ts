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
 * Known system parent modules that group distinct child sub-modules in Access Control.
 * A parent read permission on these groups does NOT grant read to its children.
 * Only explicit child permission OR parent `all` (Full Access) grants child access.
 */
const GROUP_PARENT_MODULES = new Set([
  "/employees",
  "/approvals",
  "/reports",
  "/recruitment",
  "/work/sales",
  "/payroll",
  "/finance",
  "/invoice",
  "/workspace",
  "/ceo-dashboard",
  "/recognitions",
]);

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

  const cleanUrl = (url.split("?")[0] ?? "").replace(/\/+$/, "") || "/";

  // Every logged-in user (Admin, Employee, Team Leader, etc.) ALWAYS has access to their own profile
  if (cleanUrl === "/profile" || cleanUrl.startsWith("/profile")) {
    return true;
  }

  // Dashboard read is always accessible for any logged in user
  if (cleanUrl === "/dashboard" && action === "read") {
    return true;
  }

  const perms = user.permissions;

  // Strict fallback: if no permissions are configured for the employee, profile view is permitted
  if (!perms || Object.keys(perms).length === 0) {
    return action === "read";
  }

  // 1. Direct match on exact URL
  if (perms[url]) {
    const p = perms[url];
    return Boolean(p.all || p[action]);
  }
  if (perms[cleanUrl]) {
    const p = perms[cleanUrl];
    if (cleanUrl === "/tasks" && action === "create") {
      return Boolean(p.all || p.create || p.read);
    }
    return Boolean(p.all || p[action]);
  }

  // 2. Dynamic hierarchical prefix matching (for dynamic sub-routes like "/tasks/123" or "/work/projects/edit/456")
  const parts = cleanUrl.split("/").filter(Boolean);
  for (let i = parts.length - 1; i >= 1; i--) {
    const parent = "/" + parts.slice(0, i).join("/");
    if (perms[parent]) {
      const p = perms[parent];
      // Full Access on parent grants all subpaths
      if (p.all) return true;

      // Category parent groups (/employees, /reports, etc.) should NEVER grant children unless p.all is True
      if (GROUP_PARENT_MODULES.has(parent)) {
        continue;
      }

      // Concrete functional modules (e.g. /tasks, /work/projects, /schedule) grant sub-routes
      return Boolean(p[action]);
    }
  }

  // 3. Dynamic child match for parent group URLs
  // If evaluating access for a parent group URL itself (e.g. "/employees" dropdown header),
  // allow read if user has access to any child module (e.g. "/employees/attendance")
  if (action === "read" && GROUP_PARENT_MODULES.has(cleanUrl)) {
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
        // Approvals Hub is strictly for approvers with /approvals module permissions
        if ((item.title === "Approvals Hub" || item.url === "/approvals") && !hasModulePermission(user, "/approvals", "read")) {
          return null;
        }

        const allowedChildren = item.children.filter((child) =>
          hasModulePermission(user, child.url, "read")
        );

        if (allowedChildren.length > 0) {
          return {
            ...item,
            children: allowedChildren,
          };
        }

        // If no children allowed, don't show the parent group unless parent URL is allowed and has no children
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
