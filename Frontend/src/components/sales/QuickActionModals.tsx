import { useSales } from "./SalesContext";
import { useState, useEffect } from "react";
import { type SalesTask, type Lead } from "./sales-data";
import { DialogClose, Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, UploadCloud, CheckCircle2 } from "lucide-react";
import { toast } from "@/lib/toast";

export function QuickActionModals({ activeAction, onClose }: { activeAction: string | null; onClose: () => void }) {
  const { tasks, setTasks, addLead, salesSettings, stages } = useSales();

  // Lead Form States with Sticky defaults from localStorage
  const [leadName, setLeadName] = useState("");
  const [leadCompany, setLeadCompany] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadSource, setLeadSource] = useState(() => {
    return (typeof window !== "undefined" && localStorage.getItem("hrms_sticky_lead_source")) || "Website";
  });
  const [leadCategory, setLeadCategory] = useState(() => {
    return (typeof window !== "undefined" && localStorage.getItem("hrms_sticky_lead_category")) || "Others";
  });

  // Keep sticky values synced to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("hrms_sticky_lead_source", leadSource);
    }
  }, [leadSource]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("hrms_sticky_lead_category", leadCategory);
    }
  }, [leadCategory]);

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

  const saveLeadInternal = async () => {
    const digitsOnly = leadPhone.replace(/[^0-9]/g, "");
    if (!digitsOnly) {
      toast.error("Phone number is required (digits only)");
      return false;
    }
    if (digitsOnly.length < 10) {
      toast.error("Enter valid 10-digit mobile number");
      return false;
    }
    const companyVal = leadCompany.trim() || leadName.trim() || `Lead ${digitsOnly.slice(-4)}`;
    const contactVal = leadName.trim() || companyVal;
    const defaultStage: string = (stages && stages[0]) || (salesSettings?.stages && salesSettings.stages[0]?.name) || "New Lead";

    const leadPayload: Partial<Lead> = {
      contact: contactVal,
      company: companyVal,
      phone: digitsOnly,
      source: leadSource,
      category: leadCategory,
      stage: defaultStage,
      status: defaultStage,
      priority: "Medium",
      date: new Date().toISOString().split("T")[0] || "",
    };
    if (leadEmail.trim()) leadPayload.email = leadEmail.trim();

    await addLead(leadPayload);
    return true;
  };

  const handleSaveAndNew = async (e: React.MouseEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const ok = await saveLeadInternal();
      if (ok) {
        toast.success("Lead saved successfully! Ready for next lead.");
        setLeadName("");
        setLeadCompany("");
        setLeadEmail("");
        setLeadPhone("");
        // Retain leadSource and leadCategory completely sticky!
        const phoneEl = document.getElementById("phone");
        if (phoneEl) phoneEl.focus();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (activeAction === "Add Lead") {
      try {
        const ok = await saveLeadInternal();
        if (ok) {
          toast.success("Lead added successfully!");
          setLeadName("");
          setLeadCompany("");
          setLeadEmail("");
          setLeadPhone("");
          handleClose();
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

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
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-[425px] md:max-w-[500px] max-h-[90dvh] flex flex-col p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
        <div className="flex items-center justify-between px-6 md:px-8 py-6 border-b border-border/50 bg-muted/30">
          <div className="min-w-0 flex-1">
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
            <button className="p-2 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center shrink-0 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </DialogClose>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 max-h-[90dvh] overflow-hidden">
          <div className="p-6 md:p-8 space-y-4 overflow-y-auto text-left">
            {/* Add Lead Form */}
            {activeAction === "Add Lead" && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="phone" className="text-xs font-bold text-foreground flex items-center gap-1">
                      Phone Number <span className="text-rose-500 font-black">*</span>
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="10-digit mobile (digits only)"
                      value={leadPhone}
                      onChange={(e) => setLeadPhone(e.target.value.replace(/[^0-9]/g, "").slice(0, 12))}
                      onKeyDown={(e) => { if (!/[0-9]/.test(e.key) && !["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", "Enter"].includes(e.key)) e.preventDefault(); }}
                      required
                      autoFocus
                      className="text-sm font-semibold bg-background"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="name" className="text-xs font-medium text-muted-foreground">
                      Contact Name (Optional)
                    </Label>
                    <Input
                      id="name"
                      placeholder="e.g. Rahul Sharma"
                      value={leadName}
                      onChange={(e) => setLeadName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="company" className="text-xs font-medium text-muted-foreground">
                      Company / Business Name (Optional)
                    </Label>
                    <Input
                      id="company"
                      placeholder="e.g. Apex Jewels"
                      value={leadCompany}
                      onChange={(e) => setLeadCompany(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="email" className="text-xs font-medium text-muted-foreground">
                      Email (Optional)
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="client@example.com"
                      value={leadEmail}
                      onChange={(e) => setLeadEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-1">
                  <div className="grid gap-2">
                    <Label htmlFor="source" className="text-xs font-semibold text-foreground flex items-center justify-between">
                      <span>Lead Source</span>
                      <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">Sticky</span>
                    </Label>
                    <Select value={leadSource} onValueChange={setLeadSource}>
                      <SelectTrigger className="text-xs font-semibold">
                        <SelectValue placeholder="Select source" />
                      </SelectTrigger>
                      <SelectContent>
                        {(salesSettings?.sources && salesSettings.sources.length > 0 ? salesSettings.sources : [
                          "Meta Ads", "Google Ads", "Instagram", "Facebook", "WhatsApp",
                          "Website", "Reference", "Cold Calling", "LinkedIn", "Walk-in", "Others"
                        ]).map((src) => (
                          <SelectItem key={src} value={src}>{src}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="category" className="text-xs font-semibold text-foreground flex items-center justify-between">
                      <span>Business Category</span>
                      <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">Sticky</span>
                    </Label>
                    <Select value={leadCategory} onValueChange={setLeadCategory}>
                      <SelectTrigger className="text-xs font-semibold">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {(salesSettings?.categories && salesSettings.categories.length > 0
                          ? salesSettings.categories.map((c) => c.name)
                          : [
                            "Jewellery", "Restaurants", "Real Estate", "Doctors", "Education",
                            "Hospital", "Manufacturing", "Textile", "Finance", "Automobile", "IT Company", "Others"
                          ]
                        ).map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
          <div className="px-6 md:px-8 py-4 md:py-6 bg-muted/30 border-t border-border/50 flex flex-col-reverse sm:flex-row sm:flex-wrap sm:items-center sm:justify-end gap-3 mt-auto shrink-0 [&>button]:w-full sm:[&>button]:w-auto [&>button]:min-h-[44px] sm:[&>button]:min-h-0">
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            {activeAction === "Add Lead" && (
              <Button
                type="button"
                variant="secondary"
                onClick={handleSaveAndNew}
                disabled={isSubmitting || !leadPhone.trim()}
                className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 font-bold"
              >
                {isSubmitting ? "Saving..." : "Save & New"}
              </Button>
            )}
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={isSubmitting}>
              {isSubmitting ? "Processing..." : activeAction.includes("Upload") || activeAction.includes("Import") ? "Upload Data" : activeAction === "Add Lead" ? "Save Lead" : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
