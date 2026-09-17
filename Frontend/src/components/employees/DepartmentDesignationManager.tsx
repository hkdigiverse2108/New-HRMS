import React, { useState } from "react";
import { Layers, Briefcase, Building2 } from "lucide-react";
import { DepartmentsManager } from "./DepartmentsManager";
import { SubDepartmentsManager } from "./SubDepartmentsManager";
import { DesignationsManager } from "./DesignationsManager";
import { useDepartments } from "./DepartmentContext";
import { cn } from "@/lib/utils";

export function DepartmentDesignationManager() {
  const [activeTab, setActiveTab] = useState<"sub_departments" | "designations" | "departments">("sub_departments");
  const [subDeptCountMap, setSubDeptCountMap] = useState<Record<string, number>>({});
  const { departments, refreshDepartments } = useDepartments();

  return (
    <div className="w-full animate-in fade-in zoom-in-95 duration-300 flex flex-col h-[calc(100vh-4rem)] pb-8 overflow-y-auto">
      {/* Header */}
      <div className="mb-6 shrink-0">
        <h1 className="text-[28px] font-black text-foreground tracking-tight mb-1">
          Sub-Departments & Designations
        </h1>
        <p className="text-[14px] text-muted-foreground">
          Dynamically manage sub-departments, designations, and departments for the organization.
        </p>
      </div>

      {/* Top Division / Tabs */}
      <div className="flex border-b border-border gap-2 sm:gap-6 overflow-x-auto scrollbar-hide mb-6 shrink-0">
        <button
          onClick={() => setActiveTab("sub_departments")}
          className={cn(
            "pb-3.5 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap",
            activeTab === "sub_departments"
              ? "border-primary text-primary font-black"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Layers className="w-4 h-4" />
          <span>Sub-Departments</span>
        </button>

        <button
          onClick={() => setActiveTab("designations")}
          className={cn(
            "pb-3.5 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap",
            activeTab === "designations"
              ? "border-primary text-primary font-black"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Briefcase className="w-4 h-4" />
          <span>Designations</span>
        </button>

        <button
          onClick={() => setActiveTab("departments")}
          className={cn(
            "pb-3.5 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap",
            activeTab === "departments"
              ? "border-primary text-primary font-black"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Building2 className="w-4 h-4" />
          <span>Departments</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
            {departments.length}
          </span>
        </button>
      </div>

      {/* Division Content */}
      <div className="flex-1">
        {activeTab === "sub_departments" && (
          <SubDepartmentsManager onSubDepartmentsCountChange={setSubDeptCountMap} />
        )}

        {activeTab === "designations" && (
          <DesignationsManager />
        )}

        {activeTab === "departments" && (
          <DepartmentsManager
            subDepartmentsCountMap={subDeptCountMap}
            onDepartmentChanged={refreshDepartments}
          />
        )}
      </div>
    </div>
  );
}
