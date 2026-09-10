import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { DialogClose,  Dialog, DialogContent  } from "@/components/ui/dialog";
import { 
  Building2, Users, MapPin, DollarSign, Calendar, Target,
  Briefcase, TrendingUp, CheckCircle2, ShieldAlert, BadgeCent,
  Pencil, Trash2, Settings, Plus, Shuffle, Bell, Shield, History,
  Check, X, Gem, UtensilsCrossed, Stethoscope, GraduationCap,
  HeartPulse, Factory, Shirt, Landmark, Car, Plane, Cpu,
  Scissors, Dumbbell, HardHat, Shapes, ChevronUp, ChevronDown, ChevronRight
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { useSales } from "./SalesContext";
import { moveToRecycleBin } from "@/lib/recycle-bin";

const TABS = ["Pipeline Stages", "Lead Categories", "Lead Sources", "Assignment", "Notifications", "Permissions", "Audit Log"] as const;
type Tab = typeof TABS[number];

const INITIAL_LEAD_CATEGORIES = [
  { name: "Jewellery", icon: Gem, color: "bg-amber-500", iconName: "Gem" },
  { name: "Restaurants", icon: UtensilsCrossed, color: "bg-orange-500", iconName: "UtensilsCrossed" },
  { name: "Real Estate", icon: Building2, color: "bg-emerald-600", iconName: "Building2" },
  { name: "Doctors", icon: Stethoscope, color: "bg-blue-500", iconName: "Stethoscope" },
  { name: "Education", icon: GraduationCap, color: "bg-primary", iconName: "GraduationCap" },
  { name: "Hospital", icon: HeartPulse, color: "bg-rose-500", iconName: "HeartPulse" },
  { name: "Manufacturing", icon: Factory, color: "bg-muted/500", iconName: "Factory" },
  { name: "Textile", icon: Shirt, color: "bg-orange-600", iconName: "Shirt" },
  { name: "Finance", icon: Landmark, color: "bg-teal-600", iconName: "Landmark" },
  { name: "Automobile", icon: Car, color: "bg-card", iconName: "Car" },
  { name: "Travel", icon: Plane, color: "bg-sky-500", iconName: "Plane" },
  { name: "IT Company", icon: Cpu, color: "bg-primary", iconName: "Cpu" },
  { name: "Salon", icon: Scissors, color: "bg-pink-500", iconName: "Scissors" },
  { name: "Gym", icon: Dumbbell, color: "bg-green-600", iconName: "Dumbbell" },
  { name: "Construction", icon: HardHat, color: "bg-yellow-700", iconName: "HardHat" },
  { name: "Others", icon: Shapes, color: "bg-slate-400", iconName: "Shapes" },
];

const INITIAL_LEAD_SOURCES = [
  "Meta Ads", "Google Ads", "Instagram", "Facebook", "WhatsApp",
  "Website", "Reference", "Cold Calling", "LinkedIn", "Walk-in",
  "Exhibition", "BNI", "PBN", "Organic", "Others"
];

const AVAILABLE_ICONS = [
  { name: "Gem", icon: Gem }, { name: "Utensils", icon: UtensilsCrossed }, 
  { name: "Building", icon: Building2 }, { name: "Stethoscope", icon: Stethoscope }, 
  { name: "Education", icon: GraduationCap }, { name: "Heart", icon: HeartPulse },
  { name: "Factory", icon: Factory }, { name: "Shirt", icon: Shirt }, 
  { name: "Landmark", icon: Landmark }, { name: "Car", icon: Car }, 
  { name: "Plane", icon: Plane }, { name: "Cpu", icon: Cpu },
  { name: "Scissors", icon: Scissors }, { name: "Dumbbell", icon: Dumbbell }, 
  { name: "HardHat", icon: HardHat }, { name: "Shapes", icon: Shapes },
];

const getIconComponent = (iconName: string) => {
  const match = AVAILABLE_ICONS.find(i => i.name === iconName);
  return match ? match.icon : Shapes;
};

const COLORS = [
  "bg-amber-500", "bg-orange-500", "bg-emerald-600", "bg-blue-500", 
  "bg-primary", "bg-rose-500", "bg-muted/500", "bg-teal-600", 
  "bg-sky-500", "bg-pink-500", "bg-green-600", "bg-yellow-700"
];

const ASSIGNMENT_RULES = [
  { name: "Auto Assignment", active: true },
  { name: "Round Robin", active: true },
  { name: "Manual Assignment", active: false },
  { name: "Department Wise", active: false },
  { name: "Region Wise", active: false },
  { name: "Business Category Wise", active: false },
];

const ELIGIBLE_OWNERS = [
  "Het Kansara · CEO", "Riya Mehta · Sales Head", "Aarav Shah · Sales Executive",
  "Neha Verma · Sales Executive", "Karan Patel · Sales Executive",
  "Simran Kaur · Sales Executive", "Devansh Rao · Admin"
];

const NOTIFICATIONS = [
  { title: "New Lead Assigned", subtitle: "Skyline Realtors assigned to Riya Mehta", active: true },
  { title: "Follow-up Reminder", subtitle: "42 follow-ups are due today", active: true },
  { title: "Meeting Reminder", subtitle: "Demo with CloudNova Labs at 3:30 PM", active: true },
  { title: "Target Achieved", subtitle: "Aarav Shah crossed 115% of monthly target", active: true },
  { title: "Lead Converted", subtitle: "Zenith Diamonds moved to Won — ₹6,20,000", active: true },
  { title: "Payment Received", subtitle: "₹2,40,000 received from Precision Industries", active: true },
  { title: "Proposal Approved", subtitle: "Urban Tandoor approved quotation QT-4398", active: true },
];

const INITIAL_PERMISSIONS = [
  { role: "CEO", perms: ["View all leads", "Edit all", "Delete leads", "Manage targets", "Manage users", "View audit log"] },
  { role: "Admin", perms: ["View all leads", "Edit all", "Delete leads", "Manage settings", "View audit log"] },
  { role: "Sales Head", perms: ["View team leads", "Assign leads", "Approve proposals", "Bulk edit"] },
  { role: "Sales Executive", perms: ["View own leads", "Add lead", "Log follow-up", "Create quotation"] },
];

const AVAILABLE_PERMISSIONS = [
  "View all leads", "View team leads", "View own leads", 
  "Add lead", "Edit all", "Bulk edit", "Delete leads",
  "Assign leads", "Manage targets", "Manage users", 
  "Manage settings", "View audit log", "Approve proposals",
  "Log follow-up", "Create quotation"
];

const AUDIT_LOG = [
  { action: "Moved Skyline Realtors to Negotiation", by: "by Riya Mehta", time: "Today 11:42" },
  { action: "Deleted duplicate lead LD-1043", by: "by Het Kansara", time: "Today 10:07" },
  { action: "Created quotation QT-4412 (₹4,50,000)", by: "by Aarav Shah", time: "Yesterday 18:20" },
  { action: "Round-robin assigned 12 new Meta Ads leads", by: "by System", time: "Yesterday 09:00" },
  { action: "Updated budget for BrightMind Academy", by: "by Neha Verma", time: "28 Jul 16:11" },
];

function ToggleSwitch({ active }: { active: boolean }) {
  const [isOn, setIsOn] = useState(active);
  return (
    <button
      onClick={() => setIsOn(!isOn)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
        isOn ? "bg-emerald-500" : "bg-muted"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
          isOn ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );
}

export function SalesSettings() {
  const { stages, setStages } = useSales();
  const [activeTab, setActiveTab] = useState<Tab>("Lead Categories");

  const moveStage = (index: number, direction: 'up' | 'down') => {
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= stages.length) return;
    
    const updated = [...stages];
    const temp = updated[index];
    const nextVal = updated[nextIndex];
    
    if (temp !== undefined && nextVal !== undefined) {
      updated[index] = nextVal;
      updated[nextIndex] = temp;
      setStages(updated);
      toast.success("Pipeline stages reordered!");
    }
  };
  
  const [categories, setCategories] = useState(() => {
    const saved = (typeof window !== 'undefined' ? localStorage.getItem('hrms_sales_categories') : null);
    return saved ? JSON.parse(saved) : INITIAL_LEAD_CATEGORIES;
  });
  
  const [sources, setSources] = useState(() => {
    const saved = (typeof window !== 'undefined' ? localStorage.getItem('hrms_sales_sources') : null);
    return saved ? JSON.parse(saved) : INITIAL_LEAD_SOURCES;
  });
  
  const [permissions, setPermissions] = useState(() => {
    const saved = (typeof window !== 'undefined' ? localStorage.getItem('hrms_sales_permissions') : null);
    return saved ? JSON.parse(saved) : INITIAL_PERMISSIONS;
  });

  useEffect(() => { localStorage.setItem('hrms_sales_categories', JSON.stringify(categories)); }, [categories]);
  useEffect(() => { localStorage.setItem('hrms_sales_sources', JSON.stringify(sources)); }, [sources]);
  useEffect(() => { localStorage.setItem('hrms_sales_permissions', JSON.stringify(permissions)); }, [permissions]);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newSourceName, setNewSourceName] = useState("");
  const [newStageName, setNewStageName] = useState("");
  const [newCategoryIconIdx, setNewCategoryIconIdx] = useState(0);
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    type: "category" | "source" | "stage" | null;
    index: number;
    name: string;
  }>({ isOpen: false, type: null, index: -1, name: "" });

  const [editRoleIdx, setEditRoleIdx] = useState<number | null>(null);
  const [tempPerms, setTempPerms] = useState<string[]>([]);

  // Edit States
  const [editingCategoryIdx, setEditingCategoryIdx] = useState<number | null>(null);
  const [editCategoryName, setEditCategoryName] = useState("");
  const [editCategoryIconIdx, setEditCategoryIconIdx] = useState(0);
  const [isEditIconPickerOpen, setIsEditIconPickerOpen] = useState(false);

  const [editingSourceIdx, setEditingSourceIdx] = useState<number | null>(null);
  const [editSourceName, setEditSourceName] = useState("");

  const [editingStageIdx, setEditingStageIdx] = useState<number | null>(null);
  const [editStageName, setEditStageName] = useState("");

  const handleEditPermissions = (idx: number) => {
    const rolePerms = permissions[idx]?.perms;
    if (rolePerms) {
      setTempPerms([...rolePerms]);
      setEditRoleIdx(idx);
    }
  };

  const handleSavePermissions = () => {
    if (editRoleIdx !== null && permissions[editRoleIdx]) {
      const updated = [...permissions];
      const role = updated[editRoleIdx];
      if (role) {
        role.perms = [...tempPerms];
        setPermissions(updated);
        toast.success(`${role.role} permissions updated`);
      }
    }
    setEditRoleIdx(null);
  };

  const handleTogglePerm = (p: string) => {
    setTempPerms(prev => 
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    );
  };

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) {
      toast.error("Please enter a category name first");
      return;
    }
    const selectedIcon = AVAILABLE_ICONS[newCategoryIconIdx];
    if (!selectedIcon) return;
    const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)] || "bg-muted/500";
    
    setCategories([{ 
      name: newCategoryName, 
      icon: selectedIcon.icon, 
      color: randomColor, 
      iconName: selectedIcon.name 
    }, ...categories]);
    
    setNewCategoryName("");
    setNewCategoryIconIdx(0);
    toast.success("Category added successfully");
  };

  const confirmDeleteCategory = (idx: number, name: string) => {
    setDeleteConfirm({ isOpen: true, type: "category", index: idx, name });
  };

  const handleAddSource = () => {
    if (!newSourceName.trim()) {
      toast.error("Please enter a lead source name first");
      return;
    }
    setSources([newSourceName, ...sources]);
    setNewSourceName("");
    toast.success("Lead source added");
  };

  const confirmDeleteSource = (idx: number, name: string) => {
    setDeleteConfirm({ isOpen: true, type: "source", index: idx, name });
  };

  const handleAddStage = () => {
    if (!newStageName.trim()) {
      toast.error("Please enter a stage name first");
      return;
    }
    setStages([...stages, newStageName]);
    setNewStageName("");
    toast.success("Pipeline stage added");
  };

  const confirmDeleteStage = (idx: number, name: string) => {
    setDeleteConfirm({ isOpen: true, type: "stage", index: idx, name });
  };

  const executeDelete = () => {
    if (deleteConfirm.type === "category") {
      const item = categories[deleteConfirm.index];
      if (item) {
        moveToRecycleBin('Lead Category', item.name, item, 'hrms_sales_categories');
      }
      setCategories(categories.filter((_: any, i: number) => i !== deleteConfirm.index));
      toast.success(`${deleteConfirm.name} deleted successfully`);
    } else if (deleteConfirm.type === "source") {
      const item = sources[deleteConfirm.index];
      if (item) {
        moveToRecycleBin('Lead Source', item, item, 'hrms_sales_sources');
      }
      setSources(sources.filter((_: any, i: number) => i !== deleteConfirm.index));
      toast.success(`Lead source deleted`);
    } else if (deleteConfirm.type === "stage") {
      const item = stages[deleteConfirm.index];
      if (item) {
        moveToRecycleBin('Pipeline Stage', item, item, 'hrms_sales_stages');
      }
      setStages(stages.filter((_: any, i: number) => i !== deleteConfirm.index));
      toast.success(`Pipeline stage deleted`);
    }
    setDeleteConfirm({ isOpen: false, type: null, index: -1, name: "" });
  };

  // Edit Handlers
  const startEditCategory = (idx: number) => {
    const cat = categories[idx];
    if (!cat) return;
    setEditingCategoryIdx(idx);
    setEditCategoryName(cat.name);
    const iconIdx = AVAILABLE_ICONS.findIndex(i => i.name === cat.iconName);
    setEditCategoryIconIdx(iconIdx !== -1 ? iconIdx : 0);
  };
  const saveEditCategory = () => {
    if (editingCategoryIdx === null) return;
    if (!editCategoryName.trim()) {
      toast.error("Name cannot be empty");
      return;
    }
    const updated = [...categories];
    const iconObj = AVAILABLE_ICONS[editCategoryIconIdx];
    if (!iconObj || !updated[editingCategoryIdx]) return;
    
    updated[editingCategoryIdx] = {
      ...updated[editingCategoryIdx],
      name: editCategoryName,
      iconName: iconObj.name,
      icon: iconObj.icon
    };
    setCategories(updated);
    setEditingCategoryIdx(null);
    toast.success("Category updated");
  };

  const startEditSource = (idx: number) => {
    const src = sources[idx];
    if (!src) return;
    setEditingSourceIdx(idx);
    setEditSourceName(src);
  };
  const saveEditSource = () => {
    if (editingSourceIdx === null) return;
    if (!editSourceName.trim()) {
      toast.error("Name cannot be empty");
      return;
    }
    const updated = [...sources];
    updated[editingSourceIdx] = editSourceName;
    setSources(updated);
    setEditingSourceIdx(null);
    toast.success("Lead source updated");
  };

  const startEditStage = (idx: number) => {
    const stage = stages[idx];
    if (!stage) return;
    setEditingStageIdx(idx);
    setEditStageName(stage);
  };
  const saveEditStage = () => {
    if (editingStageIdx === null) return;
    if (!editStageName.trim()) {
      toast.error("Name cannot be empty");
      return;
    }
    const updated = [...stages];
    updated[editingStageIdx] = editStageName;
    setStages(updated);
    setEditingStageIdx(null);
    toast.success("Pipeline stage updated");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-black tracking-tight">CRM Settings</h1>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">Live</span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Categories, sources, assignment rules, permissions and audit trail</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-full bg-muted/40 p-1 w-fit">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition-colors",
              activeTab === tab
                ? "bg-white text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="rounded-3xl border border-emerald-100/50 bg-emerald-50/10 p-6 md:p-8">
        
        {/* Pipeline Stages Tab */}
        {activeTab === "Pipeline Stages" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6 text-left">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <input 
                type="text" 
                placeholder="e.g. Contract Signed" 
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddStage()}
                className="w-full sm:w-80 rounded-xl border border-border bg-white px-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-emerald-500/20 font-semibold text-foreground"
              />
              <button 
                onClick={handleAddStage}
                className="flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-5 py-2.5 text-xs font-bold text-white transition-all hover:bg-emerald-800 shadow-sm"
              >
                <Plus className="h-4 w-4" /> Add Stage
              </button>
            </div>

            {/* Visual Pathway Preview */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-3">Pathway Preview</p>
              <div className="overflow-x-auto pb-3 pt-1 scrollbar-none">
                <div className="flex items-center gap-2 min-w-max p-1.5 bg-muted/40 rounded-2xl border border-border/50">
                  {stages.map((stage: string, idx: number) => (
                    <div 
                      key={idx} 
                      className="flex items-center gap-2 px-3 py-1.5 bg-white border border-border/60 rounded-xl shadow-sm text-xs font-bold text-foreground"
                    >
                      <span className="grid h-4.5 w-4.5 place-items-center rounded bg-emerald-100 text-emerald-700 border border-emerald-200 text-[9px] font-black">
                        {idx + 1}
                      </span>
                      <span>{stage}</span>
                      {idx < stages.length - 1 && (
                        <ChevronRight className="w-3 h-3 text-muted-foreground/40 ml-1" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* List and Actions */}
            <div className="space-y-3 max-w-2xl">
              <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Manage Pipeline Sequence</p>
              {stages.map((stage: string, i: number) => (
                <div 
                  key={i} 
                  className="flex items-center justify-between rounded-2xl border border-border bg-white p-4 shadow-sm hover:shadow-md hover:border-emerald-600/20 transition-all group"
                >
                  {editingStageIdx === i ? (
                    <div className="flex items-center gap-2.5 w-full">
                      <input 
                        value={editStageName} 
                        onChange={(e) => setEditStageName(e.target.value)} 
                        onKeyDown={(e) => e.key === 'Enter' && saveEditStage()}
                        className="flex-1 rounded-xl border border-border px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-semibold text-foreground bg-muted/20"
                        autoFocus
                      />
                      <button onClick={saveEditStage} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors" title="Save"><Check className="h-4 w-4" /></button>
                      <button onClick={() => setEditingStageIdx(null)} className="p-2 text-muted-foreground hover:bg-muted rounded-xl transition-colors" title="Cancel"><X className="h-4 w-4" /></button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <span className="grid h-6 w-6 place-items-center rounded-lg text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-inner">
                          {i + 1}
                        </span>
                        <span className="text-sm font-black text-foreground tracking-tight">{stage}</span>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <button 
                          type="button"
                          disabled={i === 0}
                          onClick={() => moveStage(i, 'up')}
                          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg disabled:opacity-30 disabled:pointer-events-none transition-all"
                          title="Move Up"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button 
                          type="button"
                          disabled={i === stages.length - 1}
                          onClick={() => moveStage(i, 'down')}
                          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg disabled:opacity-30 disabled:pointer-events-none transition-all"
                          title="Move Down"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>

                        <div className="w-[1px] h-4 bg-border/60 mx-1"></div>

                        <button 
                          type="button"
                          onClick={() => startEditStage(i)} 
                          className="p-1.5 text-muted-foreground hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Edit Stage"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button 
                          type="button"
                          onClick={() => confirmDeleteStage(i, stage)} 
                          className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete Stage"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lead Categories Tab */}
        {activeTab === "Lead Categories" && (
          <div className="animate-in fade-in slide-in-from-bottom-2">
            <div className="mb-8 flex flex-col sm:flex-row items-center gap-4 relative">
              <div className="relative flex items-center gap-2 w-full sm:w-auto">
                <button 
                  onClick={() => setIsIconPickerOpen(!isIconPickerOpen)}
                  className="flex shrink-0 items-center justify-center h-11 w-11 rounded-full border border-border bg-white hover:bg-muted transition-colors shadow-sm"
                  title="Choose Icon"
                >
                  {(() => {
                    const IconComp = AVAILABLE_ICONS[newCategoryIconIdx]?.icon;
                    return IconComp ? <IconComp className="h-5 w-5 text-emerald-600" /> : null;
                  })()}
                </button>
                
                {isIconPickerOpen && (
                  <div className="absolute top-14 left-0 z-20 w-64 rounded-2xl border border-border bg-white p-3 shadow-xl grid grid-cols-4 gap-2 animate-in fade-in zoom-in-95">
                    {AVAILABLE_ICONS.map((iconObj, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setNewCategoryIconIdx(idx);
                          setIsIconPickerOpen(false);
                        }}
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
                          idx === newCategoryIconIdx 
                            ? "bg-emerald-100 text-emerald-700" 
                            : "text-muted-foreground hover:bg-emerald-50 hover:text-emerald-600"
                        )}
                        title={iconObj.name}
                      >
                        <iconObj.icon className="h-5 w-5" />
                      </button>
                    ))}
                  </div>
                )}
                
                <input 
                  type="text" 
                  placeholder="New category name" 
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                  className="w-full sm:w-80 rounded-full border border-border bg-white px-5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>
              <button 
                onClick={handleAddCategory}
                className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-emerald-700 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-800"
              >
                <Plus className="h-4 w-4" /> Add Category
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((cat: any, i: number) => (
                <div key={i} className="flex items-center justify-between rounded-2xl border border-border bg-white p-4 transition-shadow hover:shadow-sm">
                  {editingCategoryIdx === i ? (
                    <div className="flex flex-col gap-2 w-full relative">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setIsEditIconPickerOpen(!isEditIconPickerOpen)}
                          className={cn("flex shrink-0 items-center justify-center h-10 w-10 rounded-full text-white", cat.color)}
                          title="Choose Icon"
                        >
                          {(() => {
                            const IconComp = AVAILABLE_ICONS[editCategoryIconIdx]?.icon;
                            return IconComp ? <IconComp className="h-5 w-5" /> : null;
                          })()}
                        </button>
                        <input 
                          value={editCategoryName} 
                          onChange={(e) => setEditCategoryName(e.target.value)} 
                          onKeyDown={(e) => e.key === 'Enter' && saveEditCategory()}
                          className="flex-1 rounded-md border border-border px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
                          autoFocus
                        />
                      </div>
                      
                      {isEditIconPickerOpen && (
                        <div className="absolute top-12 left-0 z-20 w-64 rounded-2xl border border-border bg-white p-3 shadow-xl grid grid-cols-4 gap-2 animate-in fade-in zoom-in-95">
                          {AVAILABLE_ICONS.map((iconObj, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                setEditCategoryIconIdx(idx);
                                setIsEditIconPickerOpen(false);
                              }}
                              className={cn(
                                "flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
                                idx === editCategoryIconIdx 
                                  ? "bg-emerald-100 text-emerald-700" 
                                  : "text-muted-foreground hover:bg-emerald-50 hover:text-emerald-600"
                              )}
                              title={iconObj.name}
                            >
                              <iconObj.icon className="h-5 w-5" />
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="px-6 md:px-8 py-4 md:py-6 bg-muted/30 border-t border-border/50 flex justify-end gap-3 mt-auto shrink-0">
                        <button onClick={saveEditCategory} className="text-emerald-600 hover:text-emerald-700 font-medium text-sm">Save</button>
                        <button onClick={() => { setEditingCategoryIdx(null); setIsEditIconPickerOpen(false); }} className="text-muted-foreground hover:text-foreground font-medium text-sm">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-4">
                        <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full text-white", cat.color)}>
                          {(() => {
                            const IconComponent = getIconComponent(cat.iconName);
                            return <IconComponent className="h-5 w-5" />;
                          })()}
                        </div>
                        <div>
                          <p className="font-bold text-sm">{cat.name}</p>
                          <p className="text-[11px] text-muted-foreground">Icon: {cat.iconName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <button onClick={() => startEditCategory(i)} className="hover:text-foreground"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => confirmDeleteCategory(i, cat.name)} className="hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lead Sources Tab */}
        {activeTab === "Lead Sources" && (
          <div className="animate-in fade-in slide-in-from-bottom-2">
            <div className="mb-8 flex flex-col sm:flex-row items-center gap-4">
              <input 
                type="text" 
                placeholder="New lead source" 
                value={newSourceName}
                onChange={(e) => setNewSourceName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddSource()}
                className="w-full sm:w-80 rounded-full border border-border bg-white px-5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
              <button 
                onClick={handleAddSource}
                className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-emerald-700 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-800"
              >
                <Plus className="h-4 w-4" /> Add Source
              </button>
            </div>

            <div className="flex flex-wrap gap-3">
              {sources.map((source: any, i: number) => (
                <div key={i} className="flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/50">
                  {editingSourceIdx === i ? (
                    <div className="flex items-center gap-2">
                      <input 
                        value={editSourceName} 
                        onChange={(e) => setEditSourceName(e.target.value)} 
                        onKeyDown={(e) => e.key === 'Enter' && saveEditSource()}
                        className="w-24 rounded-md border border-border px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-emerald-500/30 bg-transparent"
                        autoFocus
                      />
                      <button onClick={saveEditSource} className="text-emerald-600 hover:text-emerald-700"><Check className="h-3.5 w-3.5" /></button>
                      <button onClick={() => setEditingSourceIdx(null)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button> 
                    </div>
                  ) : (
                    <>
                      {source}
                      <button onClick={() => startEditSource(i)} className="ml-1 text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => confirmDeleteSource(i, source)} className="text-rose-400 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Assignment Tab */}
        {activeTab === "Assignment" && (
          <div className="animate-in fade-in slide-in-from-bottom-2">
            <h2 className="mb-6 flex items-center gap-2 text-lg font-bold">
              <Shuffle className="h-5 w-5 text-emerald-600" /> Lead Assignment Rules
            </h2>
            
            <div className="space-y-3">
              {ASSIGNMENT_RULES.map((rule, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl border border-border bg-white p-4">
                  <span className="font-medium text-sm">{rule.name}</span>
                  <ToggleSwitch active={rule.active} />
                </div>
              ))}
            </div>

            <div className="mt-8">
              <h3 className="mb-3 text-sm font-bold">Eligible owners</h3>
              <div className="flex flex-wrap gap-2">
                {ELIGIBLE_OWNERS.map((owner, i) => (
                  <span key={i} className="rounded-full border border-emerald-100 bg-emerald-50/50 px-3 py-1 text-xs font-semibold">
                    {owner}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === "Notifications" && (
          <div className="animate-in fade-in slide-in-from-bottom-2">
            <h2 className="mb-6 flex items-center gap-2 text-lg font-bold">
              <Bell className="h-5 w-5 text-emerald-600" /> Notification Triggers
            </h2>
            
            <div className="space-y-3">
              {NOTIFICATIONS.map((notif, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl border border-border bg-white p-4">
                  <div>
                    <p className="font-medium text-sm">{notif.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{notif.subtitle}</p>
                  </div>
                  <ToggleSwitch active={notif.active} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Permissions Tab */}
        {activeTab === "Permissions" && (
          <div className="animate-in fade-in slide-in-from-bottom-2">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Shield className="h-5 w-5 text-emerald-600" /> Role Permissions
            </h2>
            <p className="mt-1 mb-6 text-sm text-muted-foreground">
              Only CEO and Admin can delete leads. Every action is written to the audit log.
            </p>
            
            <div className="grid gap-4 md:grid-cols-2">
              {permissions.map((perm: any, i: number) => (
                <div key={i} className="rounded-2xl border border-border bg-white p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold">{perm.role}</h3>
                    <button 
                      onClick={() => handleEditPermissions(i)} 
                      className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {perm.perms.map((p: any, j: number) => (
                      <span key={j} className="rounded-full bg-muted/70 px-3 py-1.5 text-xs font-medium">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Audit Log Tab */}
        {activeTab === "Audit Log" && (
          <div className="animate-in fade-in slide-in-from-bottom-2">
            <h2 className="mb-6 flex items-center gap-2 text-lg font-bold">
              <History className="h-5 w-5 text-emerald-600" /> Audit Log
            </h2>
            
            <div className="space-y-3">
              {AUDIT_LOG.map((log, i) => (
                <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border bg-white p-4">
                  <div>
                    <p className="font-medium text-sm">{log.action}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{log.by}</p>
                  </div>
                  <span className="text-xs text-muted-foreground sm:text-right">{log.time}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal 
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, type: null, index: -1, name: "" })}
        onConfirm={executeDelete}
        title={`Delete ${deleteConfirm.type === 'category' ? 'Category' : deleteConfirm.type === 'source' ? 'Source' : 'Stage'}`}
        description={`Are you sure you want to delete "${deleteConfirm.name}"? This action cannot be undone.`}
        itemName={deleteConfirm.name}
      />

      {/* Edit Permissions Modal */}
      <Dialog open={editRoleIdx !== null} onOpenChange={(open) => !open && setEditRoleIdx(null)}>
        <DialogContent className="max-w-lg p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <h3 className="text-xl font-black tracking-tight mb-2">Edit {editRoleIdx !== null ? permissions[editRoleIdx]?.role : "Role"} Permissions</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Select the capabilities this role should have access to.
          </p>
          
          <div className="overflow-y-auto pr-2 mb-6 space-y-2 flex-1">
            {AVAILABLE_PERMISSIONS.map(p => (
              <label key={p} className="flex items-center gap-3 rounded-xl border border-border p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                <input 
                  type="checkbox" 
                  checked={tempPerms.includes(p)}
                  onChange={() => handleTogglePerm(p)}
                  className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-600"
                />
                <span className="text-sm font-medium">{p}</span>
              </label>
            ))}
          </div>

          <div className="flex gap-3 pt-2 mt-auto">
            <button 
              onClick={() => setEditRoleIdx(null)}
              className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleSavePermissions}
              className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
            >
              Save Changes
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
