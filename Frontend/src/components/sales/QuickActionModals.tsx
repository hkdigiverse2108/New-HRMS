import { useSales } from "./SalesContext";
import { useState, useEffect } from "react";
import { type SalesTask } from "./sales-data";
import { DialogClose,  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter  } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X,  UploadCloud, CheckCircle2  } from "lucide-react";
import { toast } from "sonner";

export function QuickActionModals({ activeAction, onClose }: { activeAction: string | null; onClose: () => void }) {
  const { tasks, setTasks } = useSales();
  
  // Create Task Form States
  const [taskDescription, setTaskDescription] = useState("");
  const [taskPriority, setTaskPriority] = useState("medium");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (activeAction && activeAction !== "Export Excel" && activeAction !== "Export PDF") {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [activeAction]);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(onClose, 200); // Give time for close animation
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    if (activeAction === "Create Task") {
      const dateParts = new Date().toISOString().split('T');
      const todayStr = dateParts[0] || "";
      let status: "overdue" | "today" | "upcoming" | "completed" = "upcoming";
      if (taskDueDate === todayStr) {
        status = "today";
      } else if (taskDueDate < todayStr) {
        status = "overdue";
      }
      
      const type = taskDescription.toLowerCase().includes("proposal") ? "Proposal" :
                   taskDescription.toLowerCase().includes("meeting") ? "Meeting" :
                   taskDescription.toLowerCase().includes("demo") ? "Demo" : "Call Client";
                   
      const newTask: SalesTask = {
        id: `task-${Date.now()}`,
        type,
        company: taskDescription.split(" for ")[1] || "Apex Industries",
        assignee: "Riya Mehta",
        dueDate: taskDueDate,
        status,
        priority: (taskPriority.charAt(0).toUpperCase() + taskPriority.slice(1)) as "High" | "Medium" | "Low"
      };
      
      setTasks([newTask, ...tasks]);
    }

    setTimeout(() => {
      setIsSubmitting(false);
      handleClose();
      toast.success(`${activeAction} successful!`, { description: "The system has been updated." });
      // Reset form states
      setTaskDescription("");
      setTaskPriority("medium");
      setTaskDueDate("");
    }, 1000);
  };

  if (!activeAction) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[425px] md:max-w-[500px] p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
        <div className="flex items-center justify-between px-6 md:px-8 py-6 border-b border-border/50 bg-muted/30">
          <div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight">{activeAction}</h2>
            <p className="text-sm text-muted-foreground mt-1">
            {activeAction === "Add Lead" && "Enter the details of the new prospective client."}
            {activeAction === "Add Meeting" && "Schedule a new meeting with a lead or client."}
            {activeAction === "Schedule Follow-up" && "Set a reminder to follow up on an ongoing deal."}
            {activeAction === "Create Task" && "Add a new task to your personal or team to-do list."}
            {activeAction === "Add Payment" && "Log a received payment against a deal or invoice."}
            {activeAction === "Add Note" && "Quickly jot down a note for future reference."}
            {activeAction === "Create Quotation" && "Generate a quick quotation estimate."}
            {activeAction === "Convert Lead" && "Mark a lead as successfully won and convert to client."}
            {(activeAction === "Bulk Upload Leads" || activeAction === "Import CSV") && "Upload a spreadsheet to import multiple records at once."}
          </p>
          </div>
          <DialogClose asChild>
            <button className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </DialogClose>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col max-h-[80vh] overflow-hidden">
          <div className="p-6 md:p-8 space-y-4 overflow-y-auto text-left">
          {/* Add Lead Form */}
          {activeAction === "Add Lead" && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="name">Contact Name</Label>
                <Input id="name" placeholder="John Doe" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="company">Company</Label>
                <Input id="company" placeholder="Acme Corp" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="john@acme.com" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" type="tel" placeholder="+91 98765 43210" />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="source">Lead Source</Label>
                <Select defaultValue="organic">
                  <SelectTrigger>
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="organic">Organic Search</SelectItem>
                    <SelectItem value="referral">Referral</SelectItem>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                    <SelectItem value="cold_call">Cold Call</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Add Meeting / Schedule Follow-up */}
          {(activeAction === "Add Meeting" || activeAction === "Schedule Follow-up") && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" placeholder={activeAction === "Add Meeting" ? "Product Demo" : "Follow up on proposal"} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lead">Related Lead/Client</Label>
                <Select defaultValue="1">
                  <SelectTrigger>
                    <SelectValue placeholder="Select lead" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">TechNova Solutions</SelectItem>
                    <SelectItem value="2">Global Retail Ltd</SelectItem>
                    <SelectItem value="3">Apex Industries</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="date">Date</Label>
                  <Input id="date" type="date" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="time">Time</Label>
                  <Input id="time" type="time" required />
                </div>
              </div>
            </>
          )}

          {/* Create Task */}
          {activeAction === "Create Task" && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="task">Task Description</Label>
                <Input 
                  id="task" 
                  placeholder="e.g. Draft contract for Apex Industries" 
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  required 
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="priority">Priority</Label>
                <Select value={taskPriority} onValueChange={setTaskPriority}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <Input 
                  id="dueDate" 
                  type="date" 
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  required 
                />
              </div>
            </>
          )}

          {/* Add Payment */}
          {activeAction === "Add Payment" && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="client">Client / Deal</Label>
                <Select defaultValue="1">
                  <SelectTrigger>
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">TechNova Solutions - Phase 1</SelectItem>
                    <SelectItem value="2">Global Retail - Retainer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="amount">Amount Received (₹)</Label>
                <Input id="amount" type="number" placeholder="50000" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="method">Payment Method</Label>
                <Select defaultValue="bank">
                  <SelectTrigger>
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank">Bank Transfer (NEFT/RTGS)</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="card">Credit Card</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Add Note */}
          {activeAction === "Add Note" && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="note">Note Content</Label>
                <Textarea id="note" placeholder="Type your note here..." className="h-32" required />
              </div>
            </>
          )}

          {/* Create Quotation */}
          {activeAction === "Create Quotation" && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="q_client">Client Name</Label>
                <Input id="q_client" placeholder="Acme Corp" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="q_amount">Estimated Amount (₹)</Label>
                <Input id="q_amount" type="number" placeholder="100000" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="q_desc">Description</Label>
                <Textarea id="q_desc" placeholder="Brief description of the services..." required />
              </div>
            </>
          )}

          {/* Convert Lead */}
          {activeAction === "Convert Lead" && (
            <>
              <div className="flex items-center justify-center py-4">
                <div className="grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
              </div>
              <div className="grid gap-2 text-center">
                <Label>Select a Lead to Convert</Label>
                <Select defaultValue="1">
                  <SelectTrigger>
                    <SelectValue placeholder="Select lead" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">TechNova Solutions (₹5.2 L)</SelectItem>
                    <SelectItem value="2">Global Retail Ltd (₹3.8 L)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2 mt-2">
                <Label htmlFor="c_value">Final Deal Value (₹)</Label>
                <Input id="c_value" type="number" defaultValue={520000} required />
              </div>
            </>
          )}

          {/* Bulk Upload / Import CSV */}
          {(activeAction === "Bulk Upload Leads" || activeAction === "Import CSV") && (
            <div className="flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-border px-6 py-12 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-600">
                <UploadCloud className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Click to upload or drag and drop</p>
                <p className="text-xs text-muted-foreground">CSV or Excel files only (max 5MB)</p>
              </div>
              <Button type="button" variant="outline" size="sm">Choose File</Button>
            </div>
          )}

          </div>
          <div className="px-6 md:px-8 py-4 md:py-6 bg-muted/30 border-t border-border/50 flex justify-end gap-3 mt-auto shrink-0">
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={isSubmitting}>
              {isSubmitting ? "Processing..." : activeAction.includes("Upload") || activeAction.includes("Import") ? "Upload Data" : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
