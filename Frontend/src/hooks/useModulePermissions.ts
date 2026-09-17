import { useMemo } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { hasModulePermission, isUserAdmin } from "@/lib/permissions";

export interface ModulePermissionsResult {
  isAdmin: boolean;
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canAll: boolean;
  canMutate: boolean;
  hasPermission: (action: "read" | "create" | "update" | "delete", customUrl?: string) => boolean;
}

/**
 * Custom hook to dynamically check module permissions for the current user.
 *
 * @param moduleUrl Optional module URL to check (e.g. "/employees/list", "/employees/departments-setup", "/employees/org").
 *                  If omitted, defaults to the active tab in localStorage or current window pathname.
 *
 * @returns An object with:
 *  - isAdmin: boolean (true if user has admin/superadmin role or admin email)
 *  - canRead: boolean (access to view/read this module)
 *  - canCreate: boolean (access to add/create records)
 *  - canUpdate: boolean (access to edit/update records or toggle status)
 *  - canDelete: boolean (access to delete/remove records)
 *  - canAll: boolean (full unrestricted access to the module)
 *  - canMutate: boolean (true if user can create, update, or delete)
 *  - hasPermission(action, customUrl?): helper function to check any action or specific module URL
 */
export function useModulePermissions(moduleUrl?: string): ModulePermissionsResult {
  const { user } = useAuth();

  return useMemo(() => {
    const admin = isUserAdmin(user);
    const targetUrl =
      moduleUrl ||
      (typeof window !== "undefined"
        ? (localStorage.getItem("activeSidebarTab")?.split("?")[0] || window.location.pathname)
        : "");

    const canRead = admin || hasModulePermission(user, targetUrl, "read");
    const canCreate = admin || hasModulePermission(user, targetUrl, "create");
    const canUpdate = admin || hasModulePermission(user, targetUrl, "update");
    const canDelete = admin || hasModulePermission(user, targetUrl, "delete");
    const canAll = admin || Boolean(user?.permissions?.[targetUrl]?.all);

    return {
      isAdmin: admin,
      canRead,
      canCreate,
      canUpdate,
      canDelete,
      canAll,
      canMutate: canCreate || canUpdate || canDelete,
      hasPermission: (action: "read" | "create" | "update" | "delete", customUrl?: string) => {
        return admin || hasModulePermission(user, customUrl || targetUrl, action);
      },
    };
  }, [user, moduleUrl]);
}
