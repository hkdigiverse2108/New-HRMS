import React, { useState, useEffect, useMemo } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogClose 
} from "@/components/ui/dialog";
import { 
  Shield, 
  Check, 
  X, 
  Search, 
  Save, 
  RotateCcw, 
  CheckCheck, 
  Ban, 
  Sparkles,
  ChevronRight,
  Loader2,
  ExternalLink
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Employee } from "./employee-data";
import { cn } from "@/lib/utils";
import { getAvatarUrl } from "@/lib/config";
import { useAuth } from "@/components/auth/AuthContext";

interface SystemModule {
  id: string;
  name: string;
  section: string;
  is_parent?: boolean;
  parent_id?: string;
}

interface PermissionFlags {
  read: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
  all: boolean;
}

interface EmployeePermissionsModalProps {
  employee: Employee | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function EmployeePermissionsModal({
  employee,
  isOpen,
  onClose,
  onSuccess
}: EmployeePermissionsModalProps) {
  const { refreshProfile } = useAuth();
  const [modules, setModules] = useState<SystemModule[]>([]);
  const [permissions, setPermissions] = useState<Record<string, PermissionFlags>>({});
  const [inheritanceInfo, setInheritanceInfo] = useState<{ isCustom: boolean; inheritedFrom?: string }>({
    isCustom: false
  });
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSection, setSelectedSection] = useState<string>("All");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Load modules and employee permissions when modal opens
  useEffect(() => {
    if (isOpen && employee?.id) {
      loadData(employee.id);
    }
  }, [isOpen, employee?.id]);

  const loadData = async (empId: string) => {
    setIsLoading(true);
    try {
      // 1. Fetch system modules
      const mods = await api.get<SystemModule[]>("/permissions/modules", { showErrorToast: false });
      const moduleList = mods || [];
      setModules(moduleList);

      // 2. Fetch employee specific permissions
      const permRes = await api.get<any>(`/permissions/${empId}`, { showErrorToast: false });
      setInheritanceInfo({
        isCustom: Boolean(permRes?.is_custom),
        inheritedFrom: permRes?.inherited_from || undefined
      });

      const rawPerms = permRes?.module_permissions || {};
      const formatted: Record<string, PermissionFlags> = {};

      moduleList.forEach((m) => {
        const p = rawPerms[m.id] || {};
        formatted[m.id] = {
          read: Boolean(p.read || p.all),
          create: Boolean(p.create || p.all),
          update: Boolean(p.update || p.all),
          delete: Boolean(p.delete || p.all),
          all: Boolean(p.all)
        };
      });

      setPermissions(formatted);
    } catch (err: any) {
      console.error("Failed to load permissions", err);
      toast.error(err?.message || "Failed to load permissions");
    } finally {
      setIsLoading(false);
    }
  };

  // Unique sections
  const sections = useMemo(() => {
    const list: string[] = ["All"];
    const set = new Set<string>();
    modules.forEach((m) => {
      if (m.section && !set.has(m.section)) {
        set.add(m.section);
        list.push(m.section);
      }
    });
    return list;
  }, [modules]);

  // Filter modules based on search and section
  const filteredModules = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return modules.filter((m) => {
      const matchesSearch = !query || m.name.toLowerCase().includes(query) || m.section.toLowerCase().includes(query);
      const matchesSection = selectedSection === "All" || m.section === selectedSection;
      return matchesSearch && matchesSection;
    });
  }, [modules, searchQuery, selectedSection]);

  // Group filtered modules by section
  const groupedModules = useMemo(() => {
    const map = new Map<string, SystemModule[]>();
    filteredModules.forEach((m) => {
      const list = map.get(m.section) || [];
      list.push(m);
      map.set(m.section, list);
    });
    return Array.from(map.entries());
  }, [filteredModules]);

  // Toggle single action on a module
  const handleToggleAction = (moduleId: string, action: keyof PermissionFlags) => {
    setPermissions((prev) => {
      const current = prev[moduleId] || { read: false, create: false, update: false, delete: false, all: false };
      let updated: PermissionFlags;

      if (action === "all") {
        const nextVal = !current.all;
        updated = {
          read: nextVal,
          create: nextVal,
          update: nextVal,
          delete: nextVal,
          all: nextVal
        };
      } else {
        const nextVal = !current[action];
        updated = {
          ...current,
          [action]: nextVal
        };
        // Auto-compute 'all' if all four are checked
        if (updated.read && updated.create && updated.update && updated.delete) {
          updated.all = true;
        } else {
          updated.all = false;
        }
      }

      // If this is a parent module and toggled 'all', also cascade to its sub-modules
      const mod = modules.find((m) => m.id === moduleId);
      const childUpdates: Record<string, PermissionFlags> = {};
      if (mod?.is_parent && action === "all") {
        const children = modules.filter((m) => m.parent_id === moduleId);
        children.forEach((c) => {
          childUpdates[c.id] = { ...updated };
        });
      }

      return {
        ...prev,
        [moduleId]: updated,
        ...childUpdates
      };
    });
  };

  // Quick Action: Grant All Permissions
  const handleGrantAll = () => {
    const updated: Record<string, PermissionFlags> = {};
    modules.forEach((m) => {
      updated[m.id] = { read: true, create: true, update: true, delete: true, all: true };
    });
    setPermissions(updated);
    toast.success("Full Access enabled for all modules");
  };

  // Quick Action: Revoke All Permissions
  const handleRevokeAll = () => {
    const updated: Record<string, PermissionFlags> = {};
    modules.forEach((m) => {
      updated[m.id] = { read: false, create: false, update: false, delete: false, all: false };
    });
    setPermissions(updated);
    toast.info("Revoked access from all modules");
  };

  // Reset to default role preset
  const handleResetToDefault = async () => {
    if (!employee?.id) return;
    setIsResetting(true);
    try {
      await api.delete(`/permissions/${employee.id}`);
      toast.success("Employee permissions reset to default role preset!");
      await loadData(employee.id);
      refreshProfile();
      try {
        const bc = new BroadcastChannel("hrms_permissions_sync");
        bc.postMessage({ type: "PERMISSIONS_UPDATED", employee_id: employee.id });
        bc.close();
      } catch {}
      onSuccess?.();
    } catch (err: any) {
      toast.error(err?.message || "Failed to reset permissions");
    } finally {
      setIsResetting(false);
    }
  };

  // Save changes
  const handleSave = async () => {
    if (!employee?.id) return;
    setIsSaving(true);
    try {
      await api.post("/permissions", {
        employee_id: employee.id,
        module_permissions: permissions
      });
      toast.success(`Permissions updated successfully for ${employee.name}`);
      setInheritanceInfo({ isCustom: true });
      refreshProfile();
      try {
        const bc = new BroadcastChannel("hrms_permissions_sync");
        bc.postMessage({ type: "PERMISSIONS_UPDATED", employee_id: employee.id });
        bc.close();
      } catch {}
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save permissions");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !employee) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100vw-20px)] sm:w-full sm:max-w-[760px] p-0 overflow-hidden rounded-2xl sm:rounded-3xl gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card box-border">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 sm:py-5 border-b border-border/50 bg-muted/20">
          <div className="flex items-center gap-3 min-w-0 pr-2">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-base sm:text-lg font-black tracking-tight text-foreground truncate">
                  Manage Permissions
                </DialogTitle>
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                  inheritanceInfo.isCustom
                    ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                    : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                )}>
                  {inheritanceInfo.isCustom ? "Custom Overrides" : "Role Preset"}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-muted-foreground truncate">
                {employee.name} • {employee.role} ({employee.department})
              </p>
            </div>
          </div>
          <DialogClose asChild>
            <button className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors shrink-0">
              <X className="w-5 h-5" />
            </button>
          </DialogClose>
        </div>

        {/* Employee Details Strip & Inheritance Info */}
        <div className="px-4 sm:px-6 py-3 bg-muted/40 border-b border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <img 
              src={getAvatarUrl(employee.avatar || employee.profile_photo, employee.name)} 
              alt={employee.name} 
              className="w-7 h-7 rounded-full object-cover border border-border shrink-0" 
            />
            <div className="min-w-0 truncate">
              <span className="font-bold text-foreground">{employee.name}</span>
              <span className="text-muted-foreground mx-1.5">•</span>
              <span className="text-muted-foreground truncate">{employee.email || "No email"}</span>
            </div>
          </div>

          <div className="text-[11px] text-muted-foreground shrink-0">
            {inheritanceInfo.isCustom ? (
              <span className="text-amber-600 font-medium flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                Custom permissions explicitly configured
              </span>
            ) : (
              <span>Inherited from: <strong className="text-foreground">{inheritanceInfo.inheritedFrom || employee.role}</strong></span>
            )}
          </div>
        </div>

        {/* Quick Actions & Search Bar */}
        <div className="p-3.5 sm:p-4 border-b border-border/40 space-y-3 bg-background">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Search modules..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 bg-muted/40 border border-border/60 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium placeholder:text-muted-foreground"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleGrantAll}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all active:scale-95"
                title="Grant full access to all modules"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Grant All</span>
              </button>

              <button
                type="button"
                onClick={handleRevokeAll}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 border border-rose-500/20 transition-all active:scale-95"
                title="Revoke access from all modules"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>Revoke All</span>
              </button>

              {inheritanceInfo.isCustom && (
                <button
                  type="button"
                  onClick={handleResetToDefault}
                  disabled={isResetting}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-border/60 transition-all active:scale-95 disabled:opacity-50"
                  title="Remove custom overrides and inherit role preset"
                >
                  {isResetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                  <span>Reset Default</span>
                </button>
              )}
            </div>
          </div>

          {/* Section Pills */}
          {sections.length > 2 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
              {sections.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setSelectedSection(sec)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all border shrink-0",
                    selectedSection === sec
                      ? "bg-primary text-primary-foreground border-primary shadow-xs"
                      : "bg-muted/30 text-muted-foreground hover:bg-muted/60 border-border/50"
                  )}
                >
                  {sec}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Permissions Matrix Body */}
        <div className="p-3 sm:p-5 overflow-y-auto max-h-[50vh] sm:max-h-[55vh] space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <p className="text-xs font-medium">Loading permissions configuration...</p>
            </div>
          ) : groupedModules.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-xs">
              No modules match your search query "{searchQuery}".
            </div>
          ) : (
            groupedModules.map(([sectionName, sectionMods]) => (
              <div key={sectionName} className="rounded-2xl border border-border/60 overflow-hidden bg-card shadow-xs">
                {/* Section Header */}
                <div className="px-3.5 py-2.5 bg-muted/40 border-b border-border/50 flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                    {sectionName}
                  </span>
                  <span className="text-[10px] font-bold text-muted-foreground">
                    {sectionMods.length} {sectionMods.length === 1 ? "module" : "modules"}
                  </span>
                </div>

                {/* Table Header (Hidden on small mobile, visible on tablet+) */}
                <div className="hidden sm:grid sm:grid-cols-12 px-3.5 py-2 bg-muted/20 border-b border-border/40 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <div className="col-span-5">Module</div>
                  <div className="col-span-7 grid grid-cols-5 text-center">
                    <div>Read</div>
                    <div>Create</div>
                    <div>Update</div>
                    <div>Delete</div>
                    <div className="text-primary font-black">All</div>
                  </div>
                </div>

                {/* Section Module Rows */}
                <div className="divide-y divide-border/40">
                  {sectionMods.map((mod) => {
                    const p = permissions[mod.id] || { read: false, create: false, update: false, delete: false, all: false };
                    const isChild = Boolean(mod.parent_id);

                    return (
                      <div 
                        key={mod.id} 
                        className={cn(
                          "flex flex-col sm:grid sm:grid-cols-12 items-stretch sm:items-center px-3.5 py-2.5 transition-colors hover:bg-muted/30 gap-2 sm:gap-0",
                          isChild && "bg-muted/10 sm:pl-7"
                        )}
                      >
                        {/* Module Name */}
                        <div className="sm:col-span-5 flex items-center gap-2 min-w-0">
                          {isChild && <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />}
                          <span className={cn(
                            "text-xs truncate font-medium",
                            mod.is_parent ? "font-bold text-foreground" : "text-foreground/90",
                            isChild && "text-muted-foreground"
                          )}>
                            {mod.name}
                          </span>
                        </div>

                        {/* Permission Toggles Grid */}
                        <div className="sm:col-span-7 grid grid-cols-5 gap-1.5 sm:gap-0 text-center items-center">
                          {/* Read */}
                          <label className="flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer py-1 select-none">
                            <span className="text-[9px] font-bold text-muted-foreground sm:hidden">Read</span>
                            <input
                              type="checkbox"
                              checked={Boolean(p.read || p.all)}
                              onChange={() => handleToggleAction(mod.id, "read")}
                              className="w-4 h-4 rounded text-primary border-border focus:ring-primary/20 cursor-pointer"
                            />
                          </label>

                          {/* Create */}
                          <label className="flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer py-1 select-none">
                            <span className="text-[9px] font-bold text-muted-foreground sm:hidden">Add</span>
                            <input
                              type="checkbox"
                              checked={Boolean(p.create || p.all)}
                              onChange={() => handleToggleAction(mod.id, "create")}
                              className="w-4 h-4 rounded text-primary border-border focus:ring-primary/20 cursor-pointer"
                            />
                          </label>

                          {/* Update */}
                          <label className="flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer py-1 select-none">
                            <span className="text-[9px] font-bold text-muted-foreground sm:hidden">Edit</span>
                            <input
                              type="checkbox"
                              checked={Boolean(p.update || p.all)}
                              onChange={() => handleToggleAction(mod.id, "update")}
                              className="w-4 h-4 rounded text-primary border-border focus:ring-primary/20 cursor-pointer"
                            />
                          </label>

                          {/* Delete */}
                          <label className="flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer py-1 select-none">
                            <span className="text-[9px] font-bold text-muted-foreground sm:hidden">Del</span>
                            <input
                              type="checkbox"
                              checked={Boolean(p.delete || p.all)}
                              onChange={() => handleToggleAction(mod.id, "delete")}
                              className="w-4 h-4 rounded text-primary border-border focus:ring-primary/20 cursor-pointer"
                            />
                          </label>

                          {/* All */}
                          <label className="flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer py-1 select-none">
                            <span className="text-[9px] font-bold text-primary sm:hidden">All</span>
                            <input
                              type="checkbox"
                              checked={Boolean(p.all)}
                              onChange={() => handleToggleAction(mod.id, "all")}
                              className="w-4 h-4 rounded text-primary border-border focus:ring-primary/20 cursor-pointer ring-1 ring-primary/30"
                            />
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-3.5 sm:px-6 py-3 sm:py-4 bg-muted/20 border-t border-border/50 flex items-center justify-between gap-2 mt-auto shrink-0">
          <div className="text-[11px] text-muted-foreground hidden sm:flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary inline-block"></span>
            <span>Checking <strong>All</strong> grants complete read/write access.</span>
          </div>

          <div className="flex items-center justify-end gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-muted-foreground hover:bg-muted transition-colors shrink-0"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || isLoading}
              className="px-4 sm:px-5 py-2 bg-primary text-primary-foreground text-xs sm:text-sm font-bold rounded-xl shadow-md hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center gap-1.5 shrink-0 whitespace-nowrap active:scale-95"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Permissions</span>
                </>
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
