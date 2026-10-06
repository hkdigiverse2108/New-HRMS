import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSales } from "./SalesContext";
import { toast } from "@/lib/toast";

export const STATUS_REASONS: Record<string, string[]> = {
  Lead: ["New lead created", "Reopened", "Other"],
  Contacted: ["Introductory call completed", "Client responded", "Other"],
  "Proposal Sent": ["Proposal document ready", "Pricing discussed", "Other"],
  "On Hold": ["Client request", "Budget constraint", "No contact from client", "Other"],
  "Client Won": ["Contract signed", "Requirements finalized", "Payment received", "Other"],
  "Client Lost": ["Budget too high", "Lost to competitor", "Not interested", "No response", "Other"],
};

interface StatusChangeModalProps {
  leadId: string | null;
  newStatus: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function StatusChangeModal({
  leadId,
  newStatus,
  isOpen,
  onClose,
  onSuccess,
}: StatusChangeModalProps) {
  const { updateLead } = useSales();
  const [selectedReason, setSelectedReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [holdResumeDate, setHoldResumeDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reasons = STATUS_REASONS[newStatus] || ["Other"];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadId) return;

    const finalReason =
      selectedReason === "Other" || !selectedReason
        ? customReason
        : `${selectedReason}${customReason ? ` - ${customReason}` : ""}`;

    setIsSubmitting(true);
    try {
      const updates: any = {
        status: newStatus,
        stage: newStatus === "Client Lost" ? "Lost" : newStatus === "Client Won" ? "Won" : newStatus,
        remarks: finalReason || undefined,
      };

      if (newStatus === "On Hold" && holdResumeDate) {
        updates.holdResumeDate = holdResumeDate;
      }

      await updateLead(leadId, updates);
      toast.success(`Status updated to ${newStatus}`);
      onSuccess?.();
      onClose();
    } catch {
      toast.error("Failed to update status");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md max-h-[90dvh] overflow-y-auto rounded-2xl bg-card border border-border p-4 sm:p-6 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-black text-foreground">
            Update Status to {newStatus}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Please specify the reason for updating this lead status.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-left">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Reason</Label>
            <Select value={selectedReason} onValueChange={setSelectedReason}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Select reason..." />
              </SelectTrigger>
              <SelectContent>
                {reasons.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {newStatus === "On Hold" && (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Resume Date (When to follow up again?)</Label>
              <Input
                type="date"
                value={holdResumeDate}
                onChange={(e) => setHoldResumeDate(e.target.value)}
                className="text-xs"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Additional Notes (Optional)</Label>
            <Textarea
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="Provide extra details..."
              className="text-xs min-h-[60px]"
            />
          </div>

          <DialogFooter className="pt-2 gap-2 flex-col-reverse sm:flex-row sm:justify-end [&>button]:w-full sm:[&>button]:w-auto [&>button]:min-h-[44px] sm:[&>button]:min-h-0">
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
              className={
                newStatus === "Client Lost"
                  ? "bg-rose-600 hover:bg-rose-700 text-white font-bold"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              }
              disabled={isSubmitting}
            >
              {isSubmitting ? "Updating..." : "Update Status"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
