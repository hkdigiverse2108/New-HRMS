import React, { useState } from "react";
import { Edit2, Plus, Trash2, X, ChevronDown, PartyPopper, Sparkles, Star, RefreshCw } from "lucide-react";
import { DialogClose,  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger  } from "@/components/ui/dialog";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { cn } from "@/lib/utils";
import { moveToRecycleBin } from "@/lib/recycle-bin";
import { EMPLOYEES } from "@/components/employees/employee-data";
import { SparklesCelebration } from "../../common/SparklesCelebration";
import { BADGE_PRESETS, CELEBRATION_PRESETS } from "./spotlight-constants";
import { SearchableSelect } from "@/components/ui/select";

export interface SpotlightEmployee {
  name: string;
  role: string;
  image?: string;
  ringStyle?: "none" | "white" | "gold" | "primary";
  popperStyle?: "none" | "poppers" | "sparkles" | "stars";
}

interface SpotlightEditorProps {
  spotlights: SpotlightEmployee[];
  setSpotlights: (data: SpotlightEmployee[]) => void;
}

export function SpotlightEditor({ spotlights, setSpotlights }: SpotlightEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Form state
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("");
  const [newImage, setNewImage] = useState("");
  const [newRingStyle, setNewRingStyle] = useState<"none" | "white" | "gold" | "primary">("none");
  const [newPopperStyle, setNewPopperStyle] = useState<"none" | "poppers" | "sparkles" | "stars">("none");
  const [replayCount, setReplayCount] = useState(0);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, index: number | null, name: string}>({isOpen: false, index: null, name: ""});

  const handleAdd = () => {
    if (!newName || !newRole) return;
    
    const newSpotlight: SpotlightEmployee = {
      name: newName,
      role: newRole,
    };
    if (newImage) newSpotlight.image = newImage;
    if (newRingStyle !== "none") newSpotlight.ringStyle = newRingStyle;
    if (newPopperStyle !== "none") newSpotlight.popperStyle = newPopperStyle;
    
    if (editIndex !== null) {
      const updated = [...spotlights];
      updated[editIndex] = newSpotlight;
      setSpotlights(updated);
      setEditIndex(null);
    } else {
      setSpotlights([...spotlights, newSpotlight]);
    }
    
    setNewName("");
    setNewRole("");
    setNewImage("");
    setNewRingStyle("none");
    setNewPopperStyle("none");
  };

  const handleEdit = (index: number) => {
    const emp = spotlights[index];
    if (!emp) return;
    setNewName(emp.name);
    setNewRole(emp.role);
    setNewImage(emp.image || "");
    setNewRingStyle(emp.ringStyle || "none");
    setNewPopperStyle(emp.popperStyle || "none");
    setEditIndex(index);
    setReplayCount(c => c + 1); // trigger preview replay for the loaded celebration
  };

  const handleCancelEdit = () => {
    setEditIndex(null);
    setNewName("");
    setNewRole("");
    setNewImage("");
    setNewRingStyle("none");
    setNewPopperStyle("none");
  };

  const confirmDelete = () => {
    if (deleteConfirm.index !== null) {
      const updated = [...spotlights];
      const itemToDelete = updated[deleteConfirm.index];
      if (!itemToDelete) return;
      moveToRecycleBin('Spotlight Employee', itemToDelete.name, itemToDelete, 'dashboard-spotlights');
      updated.splice(deleteConfirm.index, 1);
      setSpotlights(updated);
      if (editIndex === deleteConfirm.index) {
        handleCancelEdit();
      } else if (editIndex !== null && deleteConfirm.index < editIndex) {
        setEditIndex(editIndex - 1);
      }
    }
    setDeleteConfirm({ isOpen: false, index: null, name: "" });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-black/40 hover:bg-black/60 text-white backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-bold transition-all border border-white/20 shadow-xl opacity-0 group-hover:opacity-100 focus:opacity-100">
          <Edit2 className="w-3 h-3" />
          Manage Spotlight
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
        <div className="flex items-center justify-between px-6 md:px-8 py-6 border-b border-border/50 bg-muted/30 sticky top-0 z-50">
          <div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-primary" />
              Manage Spotlight
            </h2>
          </div>
          <DialogClose asChild>
            <button className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </DialogClose>
        </div>

        <div className="p-6 md:p-8 pt-6 space-y-8 overflow-y-auto max-h-[calc(90vh-100px)] custom-scrollbar">
          {/* Current List */}
          <div>
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Current Rotation</h4>
            <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
              {spotlights.length === 0 ? (
                <div className="text-sm text-muted-foreground italic p-4 text-center border border-dashed rounded-xl">No employees in spotlight</div>
              ) : (
                spotlights.map((emp, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-muted/30">
                    <div className="flex items-center gap-3">
                      {emp.image ? (
                        <img src={emp.image} alt={emp.name} className="w-10 h-10 rounded-full object-cover shadow-sm" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                          {emp.name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-bold text-foreground leading-tight">{emp.name}</p>
                        <p className="text-[11px] text-muted-foreground">{emp.role}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => handleEdit(i)}
                        className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        title="Edit employee"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setDeleteConfirm({ isOpen: true, index: i, name: emp.name })}
                        className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                        title="Remove employee"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="h-[1px] bg-border w-full" />

          {/* Add / Edit Form */}
          <div>
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">
              {editIndex !== null ? "Edit Spotlight" : "Add to Spotlight"}
            </h4>
            <div className="space-y-4">
              <div className="relative">
                <SearchableSelect
                  value={newName}
                  onChange={(val) => {
                    const selectedName = val;
                    setNewName(selectedName);
                    const emp = EMPLOYEES.find(emp => emp.name === selectedName);
                    if (emp) {
                      setNewRole(emp.role);
                      if (emp.avatar) setNewImage(emp.avatar);
                    }
                  }}
                  options={EMPLOYEES.map((emp) => ({ label: emp.name, value: emp.name }))}
                  placeholder="Select Employee"
                  className="w-full h-[42px] px-4 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none pr-10"
                />
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
              <input 
                type="text" 
                placeholder="Role / Tagline (e.g., Top Closer)" 
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <div className="pt-1">
                <label className="block text-xs font-semibold text-muted-foreground mb-2">Upload Background Image</label>
                <div className="relative">
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setNewImage(reader.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="w-full text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-colors border border-border rounded-xl bg-background pr-4 cursor-pointer"
                  />
                  {newImage && (
                    <button 
                      onClick={() => setNewImage("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 bg-destructive/10 text-destructive rounded-full hover:bg-destructive hover:text-white transition-colors"
                      title="Remove image"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                {newImage && (
                  <div className="mt-2 text-xs text-emerald-600 font-semibold flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" /> Image ready
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Avatar Ring</label>
                  <div className="relative">
                    <SearchableSelect
                      value={newRingStyle}
                      onChange={(val) => setNewRingStyle(val as any)}
                      options={Object.entries(BADGE_PRESETS).map(([key, preset]) => ({ label: preset.label, value: key }))}
                      className="w-full h-[38px] px-3 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none pr-8"
                    />
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Celebrations</label>
                  <div className="relative">
                    <SearchableSelect
                      value={newPopperStyle}
                      onChange={(val) => setNewPopperStyle(val as any)}
                      options={Object.entries(CELEBRATION_PRESETS).map(([key, preset]) => ({ label: preset.label, value: key }))}
                      className="w-full h-[38px] px-3 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none pr-8"
                    />
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Live Preview */}
              <div className="mt-4 p-6 rounded-2xl border border-border bg-muted/20 flex flex-col items-center justify-center relative overflow-hidden">
                {newPopperStyle !== "none" && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[800px] pointer-events-none transform scale-[0.35] z-50">
                    <SparklesCelebration key={`${newPopperStyle}-${replayCount}`} trigger={true} effectStyle={newPopperStyle} />
                  </div>
                )}
                <div className="absolute top-2 left-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 z-30">
                  Preview
                  {newPopperStyle !== "none" && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        setReplayCount(c => c + 1);
                      }}
                      className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors text-primary"
                      title="Replay Animation"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </button>
                  )}
                </div>
                
                <div className="relative mt-2">

                  <div className="w-16 h-16 rounded-full relative z-10 shadow-lg flex items-center justify-center">
                    {newRingStyle && newRingStyle !== "none" && (
                      <div className={cn("absolute -inset-[5px] rounded-full shadow-sm -z-10", BADGE_PRESETS[newRingStyle]?.class)}></div>
                    )}
                    <div className="w-full h-full rounded-full bg-background flex items-center justify-center relative z-10 overflow-hidden border-2 border-background">
                      {newImage ? (
                        <img src={newImage} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl font-bold text-muted-foreground">{newName ? newName.charAt(0) : "?"}</span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 text-center">
                  <p className="text-sm font-black text-foreground">{newName || "Employee Name"}</p>
                  <p className="text-[11px] text-muted-foreground">{newRole || "Role / Tagline"}</p>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                {editIndex !== null && (
                  <button 
                    onClick={handleCancelEdit}
                    className="flex-1 py-3 px-4 bg-muted hover:bg-muted/80 text-foreground font-bold rounded-xl transition-all border border-border"
                  >
                    Cancel
                  </button>
                )}
                <button 
                  onClick={handleAdd}
                  disabled={!newName || !newRole}
                  className="flex-1 py-3 px-4 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(var(--primary),0.3)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {editIndex !== null ? (
                    <>
                      <Edit2 className="w-4 h-4" /> Save Changes
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" /> Add Employee
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
      
      <ConfirmModal 
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, index: null, name: "" })}
        onConfirm={confirmDelete}
        title="Remove Spotlight Employee"
        description={`Are you sure you want to remove "${deleteConfirm.name}" from the spotlight?`}
        itemName={deleteConfirm.name}
      />
    </Dialog>
  );
}
