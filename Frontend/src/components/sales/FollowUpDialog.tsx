import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MessageSquare, Calendar, User, Clock, CheckCircle } from "lucide-react";
import { toast } from "@/lib/toast";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSales } from "./SalesContext";
import type { Lead } from "./sales-data";

interface FollowUpDialogProps {
  lead: Lead;
  userName?: string;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function FollowUpDialog({ lead, userName, trigger, open, onOpenChange }: FollowUpDialogProps) {
  const { addFollowUp, salesSettings } = useSales();
  const [note, setNote] = useState("");
  const [actionType, setActionType] = useState("Call");
  const [nextDate, setNextDate] = useState("");
  const [nextTime, setNextTime] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [internalOpen, setInternalOpen] = useState(false);

  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setIsOpen = isControlled ? (onOpenChange || (() => {})) : setInternalOpen;

  const followUps = (lead as any).followUps || (lead as any).follow_ups || [];

  const PRESETS = (salesSettings?.follow_up_types && salesSettings.follow_up_types.length > 0
    ? salesSettings.follow_up_types.filter((f: any) => f.active !== false).map((f: any) => ({
      label: f.label,
      note: f.note || f.label,
      action: f.action || f.label,
      defaultOffsetHours: f.offset_hours ?? 24,
    }))
    : [
      { label: "CNR (Call Not Received)", note: "Called but call was not received (CNR).", action: "CNR", defaultOffsetHours: 24 },
      { label: "Call Later (Client Busy)", note: "Client is currently busy and asked to call back later.", action: "Call Later", defaultOffsetHours: 2 },
      { label: "Client Interested", note: "Client is interested in our services. Follow-up required.", action: "Meeting", defaultOffsetHours: 48 },
      { label: "WhatsApp Details Sent", note: "Sent portfolio & service details on WhatsApp.", action: "WhatsApp", defaultOffsetHours: 24 },
      { label: "Demo Requested", note: "Client requested an online product demo.", action: "Demo", defaultOffsetHours: 24 },
    ]);

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setNote(preset.note);
    setActionType(preset.action || "Call");
    const d = new Date(Date.now() + preset.defaultOffsetHours * 3600000);
    setNextDate(d.toISOString().split("T")[0] || "");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    setNextTime(`${hh}:${mm}`);
  };

  const handleAddFollowUp = async () => {
    if (!note.trim()) {
      toast.error("Please enter a follow-up note");
      return;
    }
    setIsSubmitting(true);
    try {
      let combinedDate: string | null = null;
      if (nextDate) {
        if (nextTime) {
          combinedDate = `${nextDate}T${nextTime}:00`;
        } else {
          combinedDate = nextDate;
        }
      }

      const success = await addFollowUp(
        lead.id || lead._id || "",
        note.trim(),
        combinedDate,
        actionType,
        nextTime || undefined
      );
      if (success) {
        toast.success("Follow-up logged successfully");
        setNote("");
        setActionType("Call");
        setNextDate("");
        setNextTime("");
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
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : !isControlled ? (
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsOpen(true)}
            className="h-7 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 hover:text-emerald-800 gap-1.5 transition-colors rounded-lg px-2.5"
          >
            <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
            Follow-ups ({followUps.length})
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg p-4 sm:p-6 max-h-[90dvh] overflow-y-auto rounded-3xl bg-card border border-border shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 text-base font-bold text-foreground min-w-0">
            Follow-up Management:{" "}
            <span className="text-emerald-600 font-extrabold truncate min-w-0 max-w-[40vw] sm:max-w-[260px]">
              {lead.company || lead.contact}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Quick Presets (Audio 7 [21:30] Requirement) */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Quick Presets (1-Click Fill)</span>
              <span className="text-emerald-600 font-semibold normal-case">Audio 7 Standard</span>
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-border bg-muted/50 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 transition-all text-left"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Add New Follow-up */}
          <div className="space-y-3 bg-muted/30 p-4 rounded-2xl border border-border/70">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Follow-up Note / Discussion Summary
            </Label>
            <Textarea
              placeholder="What was discussed? Next action plan..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-[75px] bg-background border-border text-xs rounded-xl"
            />

            {/* Separate Date and Time Pickers (Audio 7 [12:00] & [34:50]) */}
            <div className="space-y-1.5 pt-1">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span>Next Follow-up Schedule (Optional)</span>
                <span className="text-[10px] text-muted-foreground font-normal">
                  {nextDate && nextTime ? "Exact reminder time set" : nextDate ? "Anytime on date" : "No date"}
                </span>
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <Label htmlFor="fu_date" className="text-[10px] text-muted-foreground font-medium mb-1 block">
                    Reminder Date
                  </Label>
                  <input
                    type="date"
                    id="fu_date"
                    value={nextDate}
                    onChange={(e) => setNextDate(e.target.value)}
                    className="w-full text-xs font-semibold bg-background border border-border rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <Label htmlFor="fu_time" className="text-[10px] text-muted-foreground font-medium mb-1 block">
                    Exact Time (e.g. 03:00 PM)
                  </Label>
                  <input
                    type="time"
                    id="fu_time"
                    value={nextTime}
                    onChange={(e) => setNextTime(e.target.value)}
                    className="w-full text-xs font-semibold bg-background border border-border rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                size="sm"
                onClick={handleAddFollowUp}
                disabled={isSubmitting || !note.trim()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-5 min-h-[44px] sm:min-h-0 sm:h-8 w-full sm:w-auto rounded-xl shadow-xs"
              >
                {isSubmitting ? "Saving..." : "Log Follow-up"}
              </Button>
            </div>
          </div>

          {/* Follow-up Timeline & History (Audio 7 [14:41] Requirement) */}
          <div className="space-y-2 pt-1">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Follow-up History Log</span>
              <span className="font-semibold text-emerald-600">{followUps.length} Records</span>
            </Label>
            {followUps.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6 italic border border-dashed border-border rounded-2xl bg-muted/20">
                No past follow-ups recorded yet.
              </p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {[...followUps].reverse().map((fu, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 bg-background rounded-2xl border border-border/80 space-y-1.5 text-xs shadow-xs"
                  >
                    <div className="flex items-center justify-between text-[11px] gap-2">
                      <span className="flex items-center gap-1 font-bold text-foreground min-w-0 truncate">
                        <User className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate">{fu.performedBy || userName || "Sales Rep"}</span>
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono shrink-0 ml-2">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        {formatDate(fu.date)}
                      </span>
                    </div>
                    <p className="text-xs text-foreground font-medium whitespace-pre-wrap leading-relaxed">
                      {fu.note}
                    </p>
                    {fu.nextFollowUpDate && (
                      <div className="flex items-center gap-1.5 text-[10px] text-emerald-700 font-bold pt-1.5 border-t border-border/50">
                        <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                        Next Follow-up Scheduled: {formatDate(fu.nextFollowUpDate)}
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
