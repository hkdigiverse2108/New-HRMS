import { useState, useEffect } from "react";
import { X,  Calendar as CalendarIcon, Clock, Users, Tv, Presentation, ShieldAlert, Armchair, Plus, Settings2, Trash2  } from "lucide-react";
import { cn } from "@/lib/utils";
import { DialogClose,  Dialog, DialogContent, DialogHeader, DialogTitle  } from "@/components/ui/dialog";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { moveToRecycleBin } from "@/lib/recycle-bin";
import { SearchableSelect } from "@/components/ui/select";

export interface Resource {
  id: string;
  name: string;
  type: string;
  capacity: number | null;
  status: string;
  facilities: string[];
}

const INITIAL_RESOURCES: Resource[] = [
  { id: "r1", name: "Boardroom Alpha", type: "Room", capacity: 12, status: "Available", facilities: ["Video Conf", "Whiteboard", "TV"] },
  { id: "r2", name: "Huddle Room B", type: "Room", capacity: 4, status: "In Use", facilities: ["TV"] },
  { id: "r3", name: "Conference Room C", type: "Room", capacity: 8, status: "Maintenance", facilities: ["Projector"] },
  { id: "r4", name: "Mobile AV Cart", type: "Equipment", capacity: null, status: "Available", facilities: ["75 inch Screen", "Webcam"] },
  { id: "r5", name: "4K Projector", type: "Equipment", capacity: null, status: "In Use", facilities: ["HDMI", "Wireless"] },
];

const getIconForType = (type: string) => {
  switch (type) {
    case 'Room': return Users;
    case 'Equipment': return Tv;
    case 'Furniture': return Armchair;
    default: return Presentation;
  }
};

export function ResourceManagement() {
  const [resources, setResources] = useState<Resource[]>(() => {
    const saved = (typeof window !== 'undefined' ? localStorage.getItem('hrms_resources') : null);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return INITIAL_RESOURCES;
  });

  const [resourceTypes, setResourceTypes] = useState<string[]>(() => {
    const saved = (typeof window !== 'undefined' ? localStorage.getItem('hrms_resource_types') : null);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return ["Room", "Equipment", "Furniture"];
  });

  useEffect(() => {
    localStorage.setItem('hrms_resources', JSON.stringify(resources));
  }, [resources]);

  useEffect(() => {
    localStorage.setItem('hrms_resource_types', JSON.stringify(resourceTypes));
  }, [resourceTypes]);

  const [filterType, setFilterType] = useState<string | null>(null);
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isManageTypesModalOpen, setIsManageTypesModalOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");

  const [confirmModalState, setConfirmModalState] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    itemName?: string;
    action: () => void;
  }>({ isOpen: false, title: "", description: "", action: () => {} });
  
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("Equipment");
  const [newCapacity, setNewCapacity] = useState("");
  const [newFacilities, setNewFacilities] = useState("");

  const filteredResources = filterType ? resources.filter(r => r.type === filterType) : resources;

  const handleAddResource = () => {
    if (!newName.trim()) return;
    
    const newResource: Resource = {
      id: `r${Date.now()}`,
      name: newName,
      type: newType,
      capacity: newType === "Room" ? parseInt(newCapacity) || null : null,
      status: "Available",
      facilities: newFacilities.split(',').map(f => f.trim()).filter(Boolean)
    };
    
    setResources([newResource, ...resources]);
    setIsAddModalOpen(false);
    setNewName("");
    setNewType(resourceTypes[0] || "Equipment");
    setNewCapacity("");
    setNewFacilities("");
  };

  const handleAddType = () => {
    if (newTypeName.trim() && !resourceTypes.includes(newTypeName.trim())) {
      setResourceTypes([...resourceTypes, newTypeName.trim()]);
      setNewTypeName("");
    }
  };

  const confirmDeleteType = (typeToDelete: string) => {
    if (resources.some(r => r.type === typeToDelete)) {
      alert(`Cannot delete type "${typeToDelete}" because it is currently assigned to one or more resources.`);
      return;
    }
    
    setConfirmModalState({
      isOpen: true,
      title: "Delete Resource Type",
      description: "Are you sure you want to delete this resource type? This action cannot be undone.",
      itemName: typeToDelete,
      action: () => {
        moveToRecycleBin('Resource Type', typeToDelete, typeToDelete, 'hrms_resource_types');
        setResourceTypes(resourceTypes.filter(t => t !== typeToDelete));
        if (newType === typeToDelete) {
          setNewType(resourceTypes[0] || "");
        }
        if (filterType === typeToDelete) {
          setFilterType(null);
        }
      }
    });
  };



  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-foreground">Resource Management</h1>
          <p className="text-muted-foreground mt-2 font-medium">Book meeting rooms and office equipment.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="px-5 py-2.5 bg-foreground text-background font-bold text-sm rounded-xl hover:bg-foreground/90 transition-all shadow-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add Resource
          </button>
          <button 
            onClick={() => {
              const resAvailable = resources.find(r => r.status === "Available");
              if (resAvailable) {
                alert(`Quick booking initiated for resource: ${resAvailable.name}`);
              } else {
                alert("No available resource for quick booking!");
              }
            }}
            className="px-5 py-2.5 bg-primary text-primary-foreground font-bold text-sm rounded-xl hover:bg-primary/90 transition-all shadow-sm"
          >
            + New Booking
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button 
          onClick={() => setFilterType(null)}
          className={cn("px-4 py-2 rounded-xl font-bold text-sm transition-all border", !filterType ? "bg-foreground text-background border-transparent" : "bg-card border-border/60 text-muted-foreground hover:bg-muted/50")}
        >
          All Resources
        </button>
        {resourceTypes.map(type => (
          <button 
            key={type}
            onClick={() => setFilterType(type)}
            className={cn("px-4 py-2 rounded-xl font-bold text-sm transition-all border", filterType === type ? "bg-foreground text-background border-transparent" : "bg-card border-border/60 text-muted-foreground hover:bg-muted/50")}
          >
            {type}
          </button>
        ))}
        <button 
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsManageTypesModalOpen(true); }}
          className="ml-auto p-2.5 rounded-xl bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
          title="Manage Resource Types"
        >
          <Settings2 className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredResources.map(resource => {
          const Icon = getIconForType(resource.type);
          return (
          <div key={resource.id} className="bg-card border border-border/60 rounded-3xl p-6 shadow-sm flex flex-col hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-6">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <Icon className="w-6 h-6" />
              </div>
              <span className={cn(
                "px-3 py-1 text-xs font-bold uppercase tracking-widest rounded-lg flex items-center gap-1.5",
                resource.status === "Available" ? "bg-emerald-500/10 text-emerald-500" :
                resource.status === "In Use" ? "bg-amber-500/10 text-amber-500" :
                "bg-rose-500/10 text-rose-500"
              )}>
                {resource.status === "Maintenance" && <ShieldAlert className="w-3 h-3" />}
                {resource.status}
              </span>
            </div>
            
            <h3 className="text-xl font-black text-foreground">{resource.name}</h3>
            
            <div className="mt-4 flex flex-wrap gap-2 mb-6">
              {resource.type === "Room" && (
                <span className="px-2 py-1 bg-muted rounded-md text-xs font-bold text-muted-foreground flex items-center gap-1">
                  <Users className="w-3 h-3" /> {resource.capacity} People
                </span>
              )}
              {resource.facilities.map(fac => (
                <span key={fac} className="px-2 py-1 bg-muted/50 border border-border/50 rounded-md text-xs font-medium text-muted-foreground">
                  {fac}
                </span>
              ))}
            </div>

            <div className="mt-auto pt-6 border-t border-border/50 flex justify-between items-center">
              {resource.status === "In Use" ? (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-bold text-foreground">Until 2:30 PM</span>
                </div>
              ) : resource.status === "Available" ? (
                <button className="w-full py-2.5 bg-foreground text-background font-bold rounded-xl text-sm hover:bg-foreground/90 transition-colors">
                  Book Now
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-muted-foreground">Under Maintenance</span>
                </div>
              )}
            </div>
          </div>
          );
        })}
      </div>

      {/* Add Resource Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-[425px] md:max-w-[500px] p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className="p-6 pb-4">
            <div className="flex items-center justify-between px-6 md:px-8 py-6 border-b border-border/50 bg-muted/30">
          <div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight">Add Resource</h2>
            
          </div>
          <DialogClose asChild>
            <button className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </DialogClose>
        </div>
          </div>
          
          <div className="p-6 md:p-8 space-y-6 overflow-y-auto max-h-[70vh]">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Resource Name</label>
              <input 
                type="text" 
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Ergonomic Chair"
                className="w-full px-4 py-3 bg-muted/50 border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">Type</label>
                <button 
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsManageTypesModalOpen(true); }}
                  className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                >
                  <Settings2 className="w-3 h-3" /> Manage Types
                </button>
              </div>
              <SearchableSelect 
                value={newType}
                onChange={(val) => setNewType(val)}
                options={resourceTypes.map(type => ({ label: type, value: type }))}
                className="w-full h-[46px] px-4 bg-muted/50 border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
              />
            </div>
            
            {newType === "Room" && (
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Capacity (People)</label>
                <input 
                  type="number" 
                  value={newCapacity}
                  onChange={(e) => setNewCapacity(e.target.value)}
                  placeholder="e.g. 10"
                  className="w-full px-4 py-3 bg-muted/50 border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                />
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Facilities / Features (Comma separated)</label>
              <input 
                type="text" 
                value={newFacilities}
                onChange={(e) => setNewFacilities(e.target.value)}
                placeholder="e.g. Lumbar Support, Adjustable"
                className="w-full px-4 py-3 bg-muted/50 border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
              />
            </div>
          </div>
          
          <div className="px-6 md:px-8 py-4 md:py-6 bg-muted/30 border-t border-border/50 flex justify-end gap-3 mt-auto shrink-0">
            <button 
              onClick={() => setIsAddModalOpen(false)}
              className="px-5 py-2.5 rounded-xl font-bold text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleAddResource}
              disabled={!newName.trim()}
              className="px-6 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl shadow-md hover:bg-primary/90 transition-all disabled:opacity-50"
            >
              Save Resource
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manage Types Modal */}
      <Dialog open={isManageTypesModalOpen} onOpenChange={setIsManageTypesModalOpen}>
        <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className="p-6 pb-4">
            <div className="flex items-center justify-between px-6 md:px-8 py-6 border-b border-border/50 bg-muted/30">
          <div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight">Manage Resource Types</h2>
            
          </div>
          <DialogClose asChild>
            <button className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </DialogClose>
        </div>
          </div>
          
          <div className="p-6 md:p-8 space-y-6 overflow-y-auto max-h-[70vh]">
            <div className="flex gap-2">
              <input 
                type="text" 
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
                placeholder="e.g. Vehicle"
                className="flex-1 px-4 py-2.5 bg-muted/50 border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddType();
                }}
              />
              <button 
                onClick={handleAddType}
                disabled={!newTypeName.trim()}
                className="px-4 py-2.5 bg-foreground text-background font-bold rounded-xl shadow-md hover:bg-foreground/90 transition-all disabled:opacity-50"
              >
                Add
              </button>
            </div>
            
            <div className="space-y-2 mt-4 max-h-[250px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted">
              {resourceTypes.map(type => (
                <div key={type} className="flex items-center justify-between p-3 bg-muted/30 border border-border/50 rounded-xl">
                  <span className="font-bold text-sm">{type}</span>
                  <button 
                    onClick={() => confirmDeleteType(type)}
                    className="p-1.5 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {resourceTypes.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No custom types defined.</p>
              )}
            </div>
          </div>
          
          <div className="px-6 md:px-8 py-4 md:py-6 bg-muted/30 border-t border-border/50 flex justify-end gap-3 mt-auto shrink-0">
            <button 
              onClick={() => setIsManageTypesModalOpen(false)}
              className="px-5 py-2.5 bg-foreground text-background font-bold rounded-xl hover:bg-foreground/90 transition-colors"
            >
              Done
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmModal 
        isOpen={confirmModalState.isOpen}
        onClose={() => setConfirmModalState(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModalState.action}
        title={confirmModalState.title}
        description={confirmModalState.description}
        itemName={confirmModalState.itemName}
      />
    </div>
  );
}
