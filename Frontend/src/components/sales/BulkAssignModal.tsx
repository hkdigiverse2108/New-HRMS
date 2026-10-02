import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useSales } from "./SalesContext";
import { useEmployeesContext } from "@/components/employees/EmployeeContext";
import { toast } from "@/lib/toast";

interface BulkAssignModalProps {
  leadIds: string[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function BulkAssignModal({
  leadIds,
  isOpen,
  onClose,
  onSuccess,
}: BulkAssignModalProps) {
  const { bulkAssignLeads } = useSales();
  const { employees } = useEmployeesContext();
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleEmployee = (empName: string) => {
    setSelectedEmployees((prev) =>
      prev.includes(empName)
        ? prev.filter((name) => name !== empName)
        : [...prev, empName]
    );
  };

  const handleAssign = async () => {
    if (selectedEmployees.length === 0) {
      toast.error("Please select at least one employee");
      return;
    }
    setIsSubmitting(true);
    try {
      const ok = await bulkAssignLeads(leadIds, selectedEmployees);
      if (ok) {
        setSelectedEmployees([]);
        onSuccess?.();
        onClose();
      }
    } catch {
      toast.error("Error bulk assigning leads");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md rounded-2xl bg-card border border-border p-6 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-black text-foreground">
            Bulk Assign {leadIds.length} Lead{leadIds.length > 1 ? "s" : ""}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Select one or more sales representatives to assign to the selected leads.
          </p>
        </DialogHeader>

        <div className="py-2 space-y-3">
          <Label className="text-xs font-bold">Select Sales Representatives</Label>
          <div className="max-h-60 overflow-y-auto space-y-1.5 p-3 rounded-xl border border-border/80 bg-muted/20">
            {employees.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                No employees available.
              </p>
            ) : (
              employees.map((emp) => {
                const empName = emp.name || `${emp.firstName} ${emp.lastName}`.trim();
                const isChecked = selectedEmployees.includes(empName);
                return (
                  <label
                    key={emp.id}
                    className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/60 cursor-pointer text-xs font-semibold text-foreground transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleEmployee(empName)}
                      className="rounded border-border text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                    />
                    <div className="flex flex-col">
                      <span>{empName}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {emp.employeeId || "Sales"}
                      </span>
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>

        <DialogFooter className="pt-2 gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={isSubmitting || selectedEmployees.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
          >
            {isSubmitting ? "Assigning..." : `Assign to ${selectedEmployees.length} Member(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
