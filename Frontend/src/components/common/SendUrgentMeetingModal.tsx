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
import { BellRing, MapPin, Video, Users, AlertTriangle } from "lucide-react";
import { useEmployeesContext } from "@/components/employees/EmployeeContext";
import { useAuth } from "@/components/auth/AuthContext";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";

interface SendUrgentMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTargetId?: string;
}

const PRESET_LOCATIONS = [
  "Conference Room",
  "Director Cabin (Cabin 1)",
  "TL Cabin (Cabin 2)",
  "Discussion Lounge",
  "HR Room",
  "Google Meet / Online",
];

export function SendUrgentMeetingModal({
  isOpen,
  onClose,
  defaultTargetId,
}: SendUrgentMeetingModalProps) {
  const { user } = useAuth();
  const { employees } = useEmployeesContext();
  const [selectedTargets, setSelectedTargets] = useState<string[]>(() =>
    defaultTargetId ? [defaultTargetId] : []
  );
  const [location, setLocation] = useState("Conference Room");
  const [meetLink, setMeetLink] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleTarget = (id: string) => {
    setSelectedTargets((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedTargets.length === employees.length) {
      setSelectedTargets([]);
    } else {
      setSelectedTargets(employees.map((e) => e.id));
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTargets.length === 0) {
      toast.error("Please select at least one employee to summon.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        target_ids: selectedTargets,
        location,
        meet_link: meetLink.trim() || undefined,
        notes: notes.trim() || "Urgent meeting requested immediately. Please report now.",
      };

      await api.post("/chat/meeting-summon", payload);

      // Also broadcast on local browser channel for testing on same machine
      try {
        const bc = new BroadcastChannel("hrms_meeting_summon");
        selectedTargets.forEach((tid) => {
          bc.postMessage({
            type: "meeting_summon",
            target_id: tid,
            caller_name: user?.name || "Team Leader",
            caller_role: user?.role || "Admin",
            location,
            notes: notes.trim() || "Urgent meeting requested immediately. Please report now.",
            meet_link: meetLink.trim() || undefined,
            timestamp: new Date().toISOString(),
          });
        });
        bc.close();
      } catch {}

      toast.success(
        `🚨 Urgent meeting summon sent to ${selectedTargets.length} employee(s)!`
      );
      setSelectedTargets([]);
      setNotes("");
      setMeetLink("");
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to broadcast urgent meeting summon.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg rounded-2xl bg-card border border-rose-500/30 p-6 shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2.5 text-rose-600">
            <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-950/50">
              <BellRing className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <DialogTitle className="text-lg font-black text-foreground">
                Broadcast Urgent Meeting Summon
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Instantly displays a full-screen audio & visual alert on the employee's screen.
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSend} className="space-y-4 py-2 text-left">
          {/* Target selection */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-rose-500" /> Target Employee(s)
              </Label>
              <button
                type="button"
                onClick={selectAll}
                className="text-[11px] font-bold text-rose-600 hover:underline"
              >
                {selectedTargets.length === employees.length ? "Deselect All" : "Select All"}
              </button>
            </div>

            <div className="max-h-40 overflow-y-auto space-y-1 p-2 rounded-xl border border-border bg-muted/20 text-xs">
              {employees.map((emp) => {
                const isSelected = selectedTargets.includes(emp.id);
                return (
                  <label
                    key={emp.id}
                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-rose-500/10 text-rose-700 font-bold"
                        : "hover:bg-muted text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleTarget(emp.id)}
                        className="rounded border-border text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer"
                      />
                      <span>{emp.name || `${emp.firstName} ${emp.lastName}`.trim()}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-normal">
                      {emp.department || emp.designation || ""}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Location */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-rose-500" /> Meeting Location
            </Label>
            <Select value={location} onValueChange={setLocation}>
              <SelectTrigger className="text-xs h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRESET_LOCATIONS.map((loc) => (
                  <SelectItem key={loc} value={loc} className="text-xs font-semibold">
                    {loc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Optional Google Meet Link */}
          {location.includes("Google Meet") && (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold flex items-center gap-1.5">
                <Video className="w-3.5 h-3.5 text-blue-500" /> Google Meet / Online Link
              </Label>
              <Input
                placeholder="https://meet.google.com/xyz-abcd-efg"
                value={meetLink}
                onChange={(e) => setMeetLink(e.target.value)}
                className="text-xs h-9"
              />
            </div>
          )}

          {/* Urgent Note */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Urgent Notes / Reason
            </Label>
            <Textarea
              placeholder="e.g. Please bring the client file immediately to Conference Room."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-xs min-h-[60px]"
            />
          </div>

          <DialogFooter className="pt-2 gap-2">
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
              disabled={isSubmitting || selectedTargets.length === 0}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold gap-1.5"
            >
              <BellRing className="w-4 h-4" />
              {isSubmitting
                ? "Broadcasting..."
                : `Summon ${selectedTargets.length} Employee(s)`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
