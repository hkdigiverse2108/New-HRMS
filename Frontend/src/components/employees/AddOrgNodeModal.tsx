import { useState } from "react";
import { X, User, Briefcase, Building2, ShieldAlert, ChevronDown } from "lucide-react";
import { DialogClose,  Dialog, DialogContent  } from "@/components/ui/dialog";
import { OrgNodeData } from "./org-data";
import { EMPLOYEES } from "@/components/employees/employee-data";
import { toast } from "sonner";
import { useDepartments } from "./DepartmentContext";
import { SearchableSelect } from "@/components/ui/select";

interface AddOrgNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<OrgNodeData, 'id' | 'children'>) => void;
  parentName?: string;
}

export function AddOrgNodeModal({ isOpen, onClose, onSubmit, parentName }: AddOrgNodeModalProps) {
  const { departments } = useDepartments();
  const [formData, setFormData] = useState({
    name: "",
    role: "",
    department: departments[0] || "Engineering",
    status: "Active" as 'Active' | 'On Leave' | 'Remote',
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.role || !formData.department) {
      toast.error("Please fill in all fields");
      return;
    }
    
    onSubmit({
      ...formData,
      avatar: `https://i.pravatar.cc/150?u=${(formData.name.split(' ')[0] || "").toLowerCase()}`
    });
    
    // Reset form
    setFormData({
      name: "",
      role: "",
      department: departments[0] || "Engineering",
      status: "Active",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className="flex items-center justify-between px-6 py-5 border-b border-border/50 bg-muted/50/50">
            <div>
              <h2 className="text-xl font-black text-foreground">Add Team Member</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {parentName ? `Adding new report under ${parentName}` : 'Add a new member to the organization'}
              </p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col max-h-[70vh]">
            <div className="p-6 md:p-8 space-y-6 overflow-y-auto">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Full Name</label>
              <div className="relative">
                <SearchableSelect 
                  value={formData.name}
                  onChange={(val) => setFormData({...formData, name: val})}
                  options={EMPLOYEES.map(emp => ({ label: emp.name, value: emp.name }))}
                  placeholder="Select Employee"
                  className="w-full px-4 py-3 bg-muted/50 border border-border/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Job Role</label>
              <input 
                type="text" 
                required
                value={formData.role}
                onChange={(e) => setFormData({...formData, role: e.target.value})}
                className="w-full px-4 py-3 bg-muted/50 border border-border/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                placeholder="e.g. Senior Designer"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Department</label>
              <SearchableSelect 
                value={formData.department}
                onChange={(val) => setFormData({...formData, department: val})}
                options={departments.map(dept => ({ label: dept, value: dept }))}
                className="w-full px-4 py-3 bg-muted/50 border border-border/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Status</label>
              <SearchableSelect 
                value={formData.status}
                onChange={(val) => setFormData({...formData, status: val as 'Active' | 'On Leave' | 'Remote'})}
                options={[
                  { label: "Active", value: "Active" },
                  { label: "Remote", value: "Remote" },
                  { label: "On Leave", value: "On Leave" }
                ]}
                className="w-full px-4 py-3 bg-muted/50 border border-border/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
              />
            </div>

            </div>
            <div className="px-6 md:px-8 py-4 md:py-6 bg-muted/30 border-t border-border/50 flex justify-end gap-3 mt-auto shrink-0">
              <button 
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl font-bold text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="px-6 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl shadow-md hover:bg-primary/90 transition-all"
              >
                Add Member
              </button>
            </div>
          </form>
      </DialogContent>
    </Dialog>
  );
}
