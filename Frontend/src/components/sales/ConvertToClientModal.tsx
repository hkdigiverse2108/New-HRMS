import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/lib/toast";
import { api } from "@/lib/api";
import { useSales } from "./SalesContext";
import type { Lead } from "./sales-data";

interface ConvertToClientModalProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const AVAILABLE_DEPARTMENTS = [
  "SEO",
  "Web Development",
  "Social Media",
  "Performance Marketing",
  "Graphic Design",
  "Video Editing",
  "Sales",
  "IT Services",
];

export function ConvertToClientModal({
  lead,
  isOpen,
  onClose,
  onSuccess,
}: ConvertToClientModalProps) {
  const { updateLead } = useSales();
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [stateUt, setStateUt] = useState("");
  const [gstin, setGstin] = useState("");
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (lead) {
      setCompanyName(lead.company || lead.contact || "");
      setContactName(lead.contact || "");
      setPhone(lead.phone || "");
      setEmail(lead.email || "");
      setStateUt(lead.state || "");
      setNotes(lead.remarks || "");
      setSelectedDepts([]);
    }
  }, [lead]);

  const toggleDept = (dept: string) => {
    setSelectedDepts((prev) =>
      prev.includes(dept) ? prev.filter((d) => d !== dept) : [...prev, dept]
    );
  };

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      toast.error("Company name is required");
      return;
    }
    if (!contactName.trim()) {
      toast.error("Contact person name is required");
      return;
    }
    if (!phone.trim()) {
      toast.error("Phone number is required");
      return;
    }

    if (!lead) return;

    setIsSubmitting(true);
    try {
      const clientPayload: any = {
        company_name: companyName.trim(),
        contact_person_name: contactName.trim(),
        phone_number: phone.trim(),
        email_address: email.trim() || undefined,
        address: address.trim() || undefined,
        state_ut: stateUt.trim() || undefined,
        gstin: gstin.trim() || undefined,
        additional_notes: notes.trim() || undefined,
      };

      if (selectedDepts.length > 0) {
        clientPayload.service_details = { departments: selectedDepts };
      }

      // Create client in DB
      await api.post("/clients", clientPayload);

      // Update lead to Client Won
      const leadId = lead.id || lead._id || "";
      const closedDateStr = new Date().toISOString().split("T")[0] || null;
      await updateLead(leadId, {
        status: "Client Won",
        stage: "Won",
        closedDate: closedDateStr,
      });

      toast.success("Lead converted to Client successfully!");
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to convert lead to client");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-card border border-border p-6 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-foreground">
            Convert Lead to Client
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Generate an official client entry in the database and mark this deal as Won.
          </p>
        </DialogHeader>

        <form onSubmit={handleConvert} className="space-y-4 py-2 text-left">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">
                Company Name <span className="text-rose-500">*</span>
              </Label>
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Company Pvt Ltd"
                required
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">
                Contact Person <span className="text-rose-500">*</span>
              </Label>
              <Input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Full name"
                required
                className="text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">
                Phone Number <span className="text-rose-500">*</span>
              </Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 9876543210"
                required
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Email Address</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="client@company.com"
                className="text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">State / UT</Label>
              <Input
                value={stateUt}
                onChange={(e) => setStateUt(e.target.value)}
                placeholder="Gujarat"
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">GSTIN (Optional)</Label>
              <Input
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
                placeholder="24AAAAA0000A1Z5"
                className="text-xs font-mono uppercase"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Office Address</Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Building, Street, City"
              className="text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Departments / Services</Label>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {AVAILABLE_DEPARTMENTS.map((dept) => {
                const isSelected = selectedDepts.includes(dept);
                return (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => toggleDept(dept)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all border ${
                      isSelected
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                        : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                    }`}
                  >
                    {dept}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Deal Notes / Requirements</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Key deliverables, payment schedule, holding details..."
              className="text-xs min-h-[60px]"
            />
          </div>

          <DialogFooter className="pt-3 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Converting..." : "Convert & Create Client"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
