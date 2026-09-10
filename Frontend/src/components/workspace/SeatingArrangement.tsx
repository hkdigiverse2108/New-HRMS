import { useState, useEffect } from "react";
import { X,  Search, MousePointerClick, UserMinus, UserPlus, ChevronDown  } from "lucide-react";
import { cn } from "@/lib/utils";
import { DialogClose,  Dialog, DialogContent } from "@/components/ui/dialog";
import { EMPLOYEES } from "@/components/employees/employee-data";
import { SearchableSelect } from "@/components/ui/select";

// Mock Data
const ZONES = [
  { id: "engineering", name: "Engineering Wing", color: "bg-blue-500" },
  { id: "design", name: "Design Studio", color: "bg-fuchsia-500" },
  { id: "sales", name: "Sales Floor", color: "bg-emerald-500" },
];
export interface Desk {
  id: string;
  zone: string;
  isOccupied: boolean;
  employee: {
    name: string;
    avatar: string;
    role: string;
  } | null;
}

const INITIAL_DESKS: Desk[] = Array.from({ length: 48 }, (_, i) => {
  const isOccupied = Math.random() > 0.4;
  const zone = ZONES[Math.floor(i / 16)]?.id || "engineering";
  return {
    id: `desk-${i + 1}`,
    zone,
    isOccupied,
    employee: isOccupied ? {
      name: `Employee ${i + 1}`,
      avatar: `https://i.pravatar.cc/150?u=${i + 1}`,
      role: zone === 'engineering' ? 'Developer' : zone === 'design' ? 'Designer' : 'Sales Rep'
    } : null
  };
});

export function SeatingArrangement() {
  const [desks, setDesks] = useState<Desk[]>(() => {
    const saved = (typeof window !== 'undefined' ? localStorage.getItem('hrms_seating') : null);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return INITIAL_DESKS;
  });

  useEffect(() => {
    localStorage.setItem('hrms_seating', JSON.stringify(desks));
  }, [desks]);

  const [activeZone, setActiveZone] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [selectedDesk, setSelectedDesk] = useState<Desk | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newAssigneeName, setNewAssigneeName] = useState("");
  const [newAssigneeRole, setNewAssigneeRole] = useState("Developer");

  const filteredDesks = desks.filter(desk => 
    (!activeZone || desk.zone === activeZone) &&
    (!searchQuery || (desk.employee && desk.employee.name.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  const openDeskModal = (desk: Desk) => {
    setSelectedDesk(desk);
    setNewAssigneeName("");
    setNewAssigneeRole("Developer");
    setIsModalOpen(true);
  };

  const handleAssignDesk = () => {
    if (!selectedDesk || !newAssigneeName.trim()) return;
    
    const updatedDesks = desks.map(d => {
      if (d.id === selectedDesk.id) {
        return {
          ...d,
          isOccupied: true,
          employee: {
            name: newAssigneeName,
            avatar: `https://i.pravatar.cc/150?u=${encodeURIComponent(newAssigneeName)}`,
            role: newAssigneeRole
          }
        };
      }
      return d;
    });
    
    setDesks(updatedDesks);
    setIsModalOpen(false);
  };

  const handleUnassignDesk = () => {
    if (!selectedDesk) return;
    
    const updatedDesks = desks.map(d => {
      if (d.id === selectedDesk.id) {
        return {
          ...d,
          isOccupied: false,
          employee: null
        };
      }
      return d;
    });
    
    setDesks(updatedDesks);
    setIsModalOpen(false);
  };

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-foreground">Seating Arrangement</h1>
          <p className="text-muted-foreground mt-2 font-medium">Interactive floor plan and desk assignments.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Find employee..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-card border border-border/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium text-sm"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
        <button 
          onClick={() => setActiveZone(null)}
          className={cn("px-4 py-2 rounded-xl font-bold text-sm whitespace-nowrap transition-all border", !activeZone ? "bg-primary text-primary-foreground border-transparent shadow-md" : "bg-card border-border/60 text-muted-foreground hover:bg-muted/50")}
        >
          All Zones
        </button>
        {ZONES.map(zone => (
          <button 
            key={zone.id}
            onClick={() => setActiveZone(zone.id)}
            className={cn("px-4 py-2 rounded-xl font-bold text-sm whitespace-nowrap transition-all border", activeZone === zone.id ? "bg-primary text-primary-foreground border-transparent shadow-md" : "bg-card border-border/60 text-muted-foreground hover:bg-muted/50")}
          >
            {zone.name}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border/60 rounded-3xl p-8 shadow-sm">
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
          {filteredDesks.map(desk => {
            const zoneInfo = ZONES.find(z => z.id === desk.zone);
            return (
              <div 
                key={desk.id}
                onClick={() => openDeskModal(desk)}
                className={cn("group relative aspect-square rounded-2xl border-2 flex flex-col items-center justify-center p-2 transition-all cursor-pointer hover:shadow-lg hover:-translate-y-1 overflow-hidden", desk.isOccupied ? "bg-background border-border" : "bg-muted/30 border-dashed border-border/50")}
              >
                <div className="absolute top-2 left-2 flex items-center justify-center">
                   <div className={cn("w-2 h-2 rounded-full", desk.isOccupied ? "bg-emerald-500" : "bg-muted-foreground/30")} />
                </div>
                
                {desk.isOccupied && desk.employee ? (
                  <>
                    <div className="w-10 h-10 rounded-full overflow-hidden mb-2 ring-2 ring-background shadow-sm group-hover:scale-110 transition-transform">
                      <img src={desk.employee.avatar} alt={desk.employee.name} className="w-full h-full object-cover" />
                    </div>
                    <p className="text-[10px] font-bold text-foreground text-center leading-tight truncate w-full">{desk.employee.name}</p>
                    <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider truncate w-full text-center mt-0.5">{desk.employee.role}</p>
                  </>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-2">
                      <MousePointerClick className="w-4 h-4 text-muted-foreground/50" />
                    </div>
                    <p className="text-[10px] font-bold text-muted-foreground text-center">Available</p>
                  </>
                )}
                
                <div className={cn("absolute bottom-0 inset-x-0 h-1.5 opacity-80", zoneInfo?.color)} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Desk Assignment Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className="p-6 pb-4">
            <div className="flex items-center justify-between px-6 md:px-8 py-6 border-b border-border/50 bg-muted/30">
          <div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight">
                Desk Assignment
                <span className="text-sm font-bold bg-muted text-muted-foreground px-2 py-1 rounded-md ml-auto">
                  {selectedDesk?.id.toUpperCase()}
                </span>
              </h2>
            
          </div>
          <DialogClose asChild>
            <button className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </DialogClose>
        </div>
          </div>
          
          <div className="p-6 md:p-8 space-y-6 overflow-y-auto max-h-[70vh]">
            {selectedDesk?.isOccupied ? (
              <div className="flex flex-col items-center justify-center text-center space-y-4 py-4">
                <div className="w-20 h-20 rounded-full overflow-hidden ring-4 ring-muted shadow-lg">
                  <img src={selectedDesk.employee?.avatar} alt={selectedDesk.employee?.name} className="w-full h-full object-cover" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">{selectedDesk.employee?.name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedDesk.employee?.role}</p>
                </div>
                <div className="bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-xl p-4 w-full text-sm font-medium mt-4">
                  Do you want to unassign this employee from their desk? This will make the desk available for others.
                </div>
              </div>
            ) : (
              <div className="space-y-4 py-2">
                <div className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-xl p-4 text-sm font-medium mb-4">
                  This desk is currently available. Assign it to a new employee.
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Employee Name</label>
                    <div className="relative">
                      <SearchableSelect 
                        value={newAssigneeName}
                        onChange={val => setNewAssigneeName(val)}
                        options={EMPLOYEES.map(emp => ({ label: emp.name, value: emp.name }))}
                        placeholder="Select Employee"
                        className="w-full h-[38px] px-3 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none pr-8"
                      />
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Role / Title</label>
                  <input 
                    type="text" 
                    value={newAssigneeRole}
                    onChange={(e) => setNewAssigneeRole(e.target.value)}
                    placeholder="e.g. Product Manager"
                    className="w-full px-4 py-3 bg-muted/50 border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                  />
                </div>
              </div>
            )}
          </div>
          
          <div className="px-6 md:px-8 py-4 md:py-6 bg-muted/30 border-t border-border/50 flex justify-end gap-3 mt-auto shrink-0">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="px-5 py-2.5 rounded-xl font-bold text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            {selectedDesk?.isOccupied ? (
              <button 
                onClick={handleUnassignDesk}
                className="px-6 py-2.5 bg-rose-500 text-white font-bold rounded-xl shadow-md hover:bg-rose-600 transition-all flex items-center gap-2"
              >
                <UserMinus className="w-4 h-4" /> Unassign
              </button>
            ) : (
              <button 
                onClick={handleAssignDesk}
                disabled={!newAssigneeName.trim()}
                className="px-6 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl shadow-md hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" /> Assign Desk
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
