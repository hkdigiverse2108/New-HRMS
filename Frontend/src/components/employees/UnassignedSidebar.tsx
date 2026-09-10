import { useState } from "react";
import { Users, GripVertical, ChevronRight, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEmployeesContext } from "./EmployeeContext";
import { OrgNodeData } from "./org-data";

export function UnassignedSidebar() {
  const [isOpen, setIsOpen] = useState(true);
  const { employees, treeData } = useEmployeesContext();

  // Helper to find all names in the tree
  const getTreeNames = (node: OrgNodeData, names: Set<string>) => {
    names.add(node.name);
    if (node.children) {
      node.children.forEach(child => getTreeNames(child, names));
    }
    return names;
  };

  const assignedNames = getTreeNames(treeData, new Set<string>());
  
  const unassignedEmployees = employees.filter(emp => !assignedNames.has(emp.name));

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("nodeId", id);
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div 
      className={cn(
        "absolute right-0 top-0 bottom-0 bg-white border-l border-border shadow-xl transition-all duration-300 flex flex-col z-40",
        isOpen ? "w-[300px]" : "w-[0px] border-l-0"
      )}
    >
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="absolute -left-10 top-1/2 -translate-y-1/2 bg-white border border-border border-r-0 p-2 rounded-l-xl shadow-sm text-muted-foreground hover:text-foreground/80 hover:bg-muted/50 transition-colors z-50"
      >
        {isOpen ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
      </button>

      <div className={cn("flex flex-col h-full overflow-hidden w-[300px]", !isOpen && "hidden")}>
        <div className="p-5 border-b border-border/50 bg-muted/50/50">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Unassigned Pool</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Drag these employees onto a manager card in the chart to assign them.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/50/30">
          {unassignedEmployees.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Users className="w-8 h-8 text-border" />
              </div>
              <p className="text-sm font-medium text-foreground/80">All caught up!</p>
              <p className="text-xs mt-1">Everyone is assigned to the organization chart.</p>
            </div>
          ) : (
            unassignedEmployees.map(emp => (
              <div 
                key={emp.id}
                draggable
                onDragStart={(e) => handleDragStart(e, emp.id)}
                className="bg-white border border-border rounded-xl p-3 shadow-sm hover:shadow-md hover:border-primary/30 cursor-grab active:cursor-grabbing transition-all flex items-center gap-3 group"
              >
                <div className="text-border group-hover:text-indigo-300 transition-colors">
                  <GripVertical className="w-4 h-4" />
                </div>
                <img 
                  src={emp.avatar} 
                  alt={emp.name} 
                  className="w-10 h-10 rounded-full object-cover border border-border/50 pointer-events-none" 
                />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground truncate leading-tight mb-0.5">{emp.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{emp.role}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
