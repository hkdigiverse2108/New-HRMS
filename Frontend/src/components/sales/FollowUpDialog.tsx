import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MessageSquare, Calendar, User, Clock, CheckCircle } from "lucide-react";
import { toast } from "@/lib/toast";
import { useSales } from "./SalesContext";
import type { Lead } from "./sales-data";

interface FollowUpDialogProps {
  lead: Lead;
  userName?: string;
  trigger?: React.ReactNode;
}

export function FollowUpDialog({ lead, userName, trigger }: FollowUpDialogProps) {
  const { addFollowUp } = useSales();
  const [note, setNote] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const followUps = lead.followUps || [];

  const handleAddFollowUp = async () => {
    if (!note.trim()) {
      toast.error("Please enter a follow-up note");
      return;
    }
    setIsSubmitting(true);
    try {
      const success = await addFollowUp(
        lead.id || lead._id || "",
        note.trim(),
        nextDate ? new Date(nextDate).toISOString() : null
      );
      if (success) {
        toast.success("Follow-up added successfully");
        setNote("");
        setNextDate("");
        setIsOpen(false);
      }
    } catch {
      toast.error("Failed to add follow-up");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);
      return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return String(dateStr);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger ? (
          trigger
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsOpen(true)}
            className="h-7 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 hover:text-emerald-800 gap-1.5 transition-colors rounded-lg px-2.5"
          >
            <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
            Follow-ups ({followUps.length})
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md p-6 max-h-[85vh] overflow-y-auto rounded-2xl bg-card border border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
            Follow-ups:{" "}
            <span className="text-emerald-600 font-extrabold">
              {lead.company || lead.contact}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Add New Follow-up */}
          <div className="space-y-3 bg-muted/40 p-4 rounded-xl border border-border/60">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              New Follow-up Note
            </Label>
            <Textarea
              placeholder="What was the outcome of the interaction? Next steps..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-[80px] bg-background border-border text-xs"
            />
            <div className="space-y-1.5">
              <Label
                htmlFor="nextFollowUpDate"
                className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
              >
                Next Follow-up Date & Time (Optional)
              </Label>
              <input
                type="datetime-local"
                id="nextFollowUpDate"
                value={nextDate}
                onChange={(e) => setNextDate(e.target.value)}
                className="w-full text-xs bg-background border border-border rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div className="flex justify-end pt-1">
              <Button
                size="sm"
                onClick={handleAddFollowUp}
                disabled={isSubmitting || !note.trim()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 h-8 rounded-lg"
              >
                {isSubmitting ? "Adding..." : "Add Note"}
              </Button>
            </div>
          </div>

          {/* Follow-up Timeline */}
          <div className="space-y-2">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              History ({followUps.length})
            </Label>
            {followUps.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6 italic border border-dashed border-border rounded-xl">
                No follow-ups recorded yet.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {[...followUps].reverse().map((fu, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-background rounded-xl border border-border/70 space-y-1 text-xs shadow-xs"
                  >
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1 font-semibold text-foreground/80">
                        <User className="w-3 h-3 text-emerald-600" />
                        {fu.performedBy || userName || "Sales Rep"}
                      </span>
                      <span className="flex items-center gap-1 font-medium">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        {formatDate(fu.date)}
                      </span>
                    </div>
                    <p className="text-xs text-foreground font-medium pt-1 whitespace-pre-wrap">
                      {fu.note}
                    </p>
                    {fu.nextFollowUpDate && (
                      <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-semibold pt-1 border-t border-border/40 mt-1">
                        <Calendar className="w-3 h-3" />
                        Next Follow-up: {formatDate(fu.nextFollowUpDate)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
