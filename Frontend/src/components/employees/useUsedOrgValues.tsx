import { useMemo } from "react";
import { useEmployeesContext } from "./EmployeeContext";

const norm = (v?: string | null) => String(v || "").trim().toLowerCase();

/** Departments / sub-departments / designations that real employees actually use, with head-counts. */
export function useUsedOrgValues() {
  const { employees } = useEmployeesContext();

  return useMemo(() => {
    const departments = new Map<string, number>();
    const subDepartments = new Map<string, number>();
    const designations = new Map<string, number>();
    const bump = (m: Map<string, number>, key: string) => {
      if (key) m.set(key, (m.get(key) || 0) + 1);
    };
    employees.forEach((e) => {
      bump(departments, norm(e.department));
      bump(subDepartments, norm((e as any).sub_department));
      bump(designations, norm((e as any).designation));
    });
    return {
      departmentCount: (name: string) => departments.get(norm(name)) || 0,
      subDepartmentCount: (name: string) => subDepartments.get(norm(name)) || 0,
      designationCount: (name: string) => designations.get(norm(name)) || 0,
    };
  }, [employees]);
}

export function ShowUnusedToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-primary cursor-pointer"
      />
      Show unused (no employees)
    </label>
  );
}
