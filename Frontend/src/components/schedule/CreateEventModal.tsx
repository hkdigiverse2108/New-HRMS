import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Clock, MapPin, AlignLeft, Calendar, Users, Type } from "lucide-react";
import { cn } from "@/lib/utils";

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: any) => void;
  selectedDate?: Date;
}

export function CreateEventModal({ isOpen, onClose, onSave, selectedDate = new Date() }: CreateEventModalProps) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(selectedDate.toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [eventType, setEventType] = useState("Event");
  const [color, setColor] = useState("bg-blue-500");

  const colors = [
    { name: "Blue", class: "bg-blue-500" },
    { name: "Emerald", class: "bg-emerald-500" },
    { name: "Purple", class: "bg-purple-500" },
    { name: "Rose", class: "bg-rose-500" },
    { name: "Amber", class: "bg-amber-500" },
  ];

  const handleSave = () => {
    if (!title.trim()) return;
    
    onSave({
      title,
      date,
      startTime,
      endTime,
      color,
    });
    
    // Reset form
    setTitle("");
    setEventType("Event");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[480px] p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
        <div className="bg-white flex flex-col">
          {/* Header */}
          <div className="pt-6 pb-2 border-b border-border/50 relative pr-12">
            <div className="px-6 flex gap-4">
              <div className="w-5 flex-shrink-0 pt-1"></div> {/* Spacer to align with icons below */}
              <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    placeholder="Add title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full text-[22px] font-normal text-foreground placeholder:text-muted-foreground/70 border-none outline-none focus:ring-0 px-0 pb-1.5 bg-transparent"
                    autoFocus
                  />
                <div className="flex gap-4 mt-1">
                  {["Event", "Task", "Reminder"].map((type) => (
                    <button
                      key={type}
                      onClick={() => setEventType(type)}
                      className={cn(
                        "text-sm font-medium pb-2 border-b-2 transition-colors",
                        eventType === type 
                          ? "border-primary text-primary" 
                          : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-t-md px-2 -ml-2"
                      )}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-5 pt-5">
            {/* Date and Time Row */}
            <div className="flex gap-4 group">
              <div className="w-5 pt-2 flex justify-center text-muted-foreground group-hover:text-foreground transition-colors">
                <Clock className="w-5 h-5" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="flex h-8 rounded hover:bg-muted bg-transparent px-2 py-1 text-[13px] transition-colors border-none outline-none focus:ring-0 cursor-pointer"
                  />
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="flex h-8 rounded hover:bg-muted bg-transparent px-2 py-1 text-[13px] transition-colors border-none outline-none focus:ring-0 cursor-pointer"
                  />
                  <span className="text-muted-foreground text-sm">-</span>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="flex h-8 rounded hover:bg-muted bg-transparent px-2 py-1 text-[13px] transition-colors border-none outline-none focus:ring-0 cursor-pointer"
                  />
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="cursor-pointer hover:bg-muted px-2 py-1 rounded-md">Time zone</span>
                  <span>·</span>
                  <span className="cursor-pointer hover:bg-muted px-2 py-1 rounded-md">Does not repeat</span>
                </div>
              </div>
            </div>

            {/* Guests */}
            <div className="flex gap-4 items-center group">
              <div className="w-5 flex justify-center text-muted-foreground group-hover:text-foreground transition-colors">
                <Users className="w-5 h-5" />
              </div>
              <input
                type="text"
                placeholder="Add guests"
                className="flex-1 h-9 bg-transparent text-[13px] placeholder:text-muted-foreground border-none outline-none focus:ring-0 hover:bg-muted/50 rounded px-2 -ml-2 transition-colors"
              />
            </div>

            {/* Location */}
            <div className="flex gap-4 items-center group">
              <div className="w-5 flex justify-center text-muted-foreground group-hover:text-foreground transition-colors">
                <MapPin className="w-5 h-5" />
              </div>
              <input
                type="text"
                placeholder="Add location"
                className="flex-1 h-9 bg-transparent text-[13px] placeholder:text-muted-foreground border-none outline-none focus:ring-0 hover:bg-muted/50 rounded px-2 -ml-2 transition-colors"
              />
            </div>

            {/* Description */}
            <div className="flex gap-4 group items-start">
              <div className="w-5 pt-2 flex justify-center text-muted-foreground group-hover:text-foreground transition-colors">
                <AlignLeft className="w-5 h-5" />
              </div>
              <textarea
                placeholder="Add description"
                className="flex-1 min-h-[60px] resize-none bg-transparent hover:bg-muted/50 text-[13px] placeholder:text-muted-foreground border border-transparent outline-none focus:ring-0 rounded-md p-2 -ml-2 transition-colors"
              />
            </div>

            {/* Calendar Selection & Color */}
            <div className="flex gap-4 items-center group">
              <div className="w-5 flex justify-center text-muted-foreground group-hover:text-foreground transition-colors">
                <Calendar className="w-5 h-5" />
              </div>
              <div className="flex-1 flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">My Schedule</span>
                
                <div className="flex items-center gap-1.5">
                  {colors.map(c => (
                    <button
                      key={c.name}
                      onClick={() => setColor(c.class)}
                      className={cn(
                        "w-5 h-5 rounded-full transition-transform",
                        c.class,
                        color === c.class ? "ring-2 ring-offset-2 ring-primary scale-110" : "hover:scale-110 opacity-80 hover:opacity-100"
                      )}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium hover:bg-muted rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!title.trim()}
              className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              Save
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
