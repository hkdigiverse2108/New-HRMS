import { useState } from "react";
import { 
  format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, 
  eachDayOfInterval, isSameMonth, isSameDay, isToday
} from "date-fns";
import { 
  ChevronLeft, ChevronRight, Search, Plus, Calendar as CalendarIcon, ChevronDown, Clock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Calendar as MiniCalendar } from "@/components/ui/calendar";
import { CreateEventModal } from "./CreateEventModal";

type ViewType = "Month" | "Week" | "Day";

interface ScheduleEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  color: string;
}

const MOCK_EVENTS: ScheduleEvent[] = [
  { id: "1", title: "Team Standup", date: format(new Date(), "yyyy-MM-dd"), startTime: "10:00", endTime: "10:30", color: "bg-blue-500" },
  { id: "2", title: "Product Sync", date: format(new Date(), "yyyy-MM-dd"), startTime: "13:00", endTime: "14:00", color: "bg-emerald-500" },
  { id: "3", title: "Client Call", date: format(new Date(), "yyyy-MM-dd"), startTime: "15:30", endTime: "16:30", color: "bg-purple-500" },
];

export function Schedule({ isNew }: { isNew?: boolean }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewType>("Month");
  const [events, setEvents] = useState<ScheduleEvent[]>(MOCK_EVENTS);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(isNew || false);
  const [selectedDateForCreate, setSelectedDateForCreate] = useState<Date>(new Date());
  
  // Date calculations
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  
  const weekStart = startOfWeek(currentDate);
  const weekEnd = endOfWeek(currentDate);
  
  const monthDays = eachDayOfInterval({ start: startDate, end: endDate });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
  
  const next = () => {
    if (view === "Month") setCurrentDate(addMonths(currentDate, 1));
    else if (view === "Week") setCurrentDate(addWeeks(currentDate, 1));
    else if (view === "Day") setCurrentDate(addDays(currentDate, 1));
  };
  
  const prev = () => {
    if (view === "Month") setCurrentDate(subMonths(currentDate, 1));
    else if (view === "Week") setCurrentDate(subWeeks(currentDate, 1));
    else if (view === "Day") setCurrentDate(subDays(currentDate, 1));
  };
  
  const today = () => setCurrentDate(new Date());
  
  // Time slots for week view (8am to 8pm)
  const hours = Array.from({ length: 13 }, (_, i) => i + 8);

  const getEventsForDay = (dateStr: string) => {
    return events.filter(e => e.date === dateStr);
  };
  
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-white rounded-2xl border border-border overflow-hidden shadow-sm">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary rounded-lg text-primary-foreground">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">Calendar</h1>
          </div>
          
          <div className="h-6 w-px bg-slate-200 mx-2"></div>
          
          <button onClick={today} className="px-4 py-1.5 text-sm font-semibold border border-border rounded-md hover:bg-muted/50 transition-colors">
            Today
          </button>
          
          <div className="flex items-center gap-1">
            <button onClick={prev} className="p-1.5 hover:bg-muted rounded-full transition-colors">
              <ChevronLeft className="w-5 h-5 text-foreground/80" />
            </button>
            <button onClick={next} className="p-1.5 hover:bg-muted rounded-full transition-colors">
              <ChevronRight className="w-5 h-5 text-foreground/80" />
            </button>
          </div>
          
          <h2 className="text-xl font-medium text-foreground/80 w-64">
            {view === "Day" ? format(currentDate, "dd/MM/yyyy") : format(currentDate, "MMMM yyyy")}
          </h2>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search..." 
              className="pl-9 pr-4 py-1.5 bg-muted border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none w-48"
            />
          </div>
          
          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
            {(["Month", "Week", "Day"] as ViewType[]).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "px-3 py-1 text-sm font-medium rounded-md transition-all",
                  view === v ? "bg-white text-primary shadow-sm" : "text-foreground/80 hover:text-foreground"
                )}
              >
                {v}
              </button>
            ))}
          </div>
          
          <button 
            onClick={() => {
              setSelectedDateForCreate(currentDate);
              setIsCreateModalOpen(true);
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary transition-colors shadow-sm ml-2">
            <Plus className="w-4 h-4" /> Create
          </button>
        </div>
      </header>
      
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 border-r border-border p-4 hidden lg:flex flex-col gap-6 overflow-y-auto hide-scrollbar bg-muted/50/50">
          <div className="-ml-2">
             <MiniCalendar 
               mode="single" 
               selected={currentDate} 
               onSelect={(date) => date && setCurrentDate(date)} 
               month={currentDate}
               onMonthChange={setCurrentDate}
               className="bg-transparent"
             />
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between group cursor-pointer">
              <h3 className="text-sm font-bold text-foreground">My Calendars</h3>
              <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground/80" />
            </div>
            <div className="space-y-2.5">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" defaultChecked className="w-4 h-4 rounded text-primary focus:ring-primary/20 border-border" />
                <span className="text-sm font-medium text-foreground/80 group-hover:text-foreground">My Schedule</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" defaultChecked className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500/20 border-border" />
                <span className="text-sm font-medium text-foreground/80 group-hover:text-foreground">Work Anniversaries</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" defaultChecked className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500/20 border-border" />
                <span className="text-sm font-medium text-foreground/80 group-hover:text-foreground">Birthdays</span>
              </label>
            </div>
          </div>
        </aside>
        
        {/* Main Calendar Area */}
        <main className="flex-1 overflow-y-auto flex flex-col bg-white">
          {view === "Month" && (
            <div className="flex-1 flex flex-col min-h-[600px]">
              {/* Days Header */}
              <div className="grid grid-cols-7 border-b border-border">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="py-2 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Month Grid */}
              <div className="flex-1 grid grid-cols-7 border-l border-border auto-rows-fr">
                {monthDays.map((day, idx) => {
                  const dateStr = format(day, "yyyy-MM-dd");
                  const dayEvents = getEventsForDay(dateStr);
                  
                  return (
                    <div 
                      key={day.toString()} 
                      className={cn(
                        "p-1 border-r border-b border-border transition-colors hover:bg-muted/50 cursor-pointer overflow-hidden",
                        !isSameMonth(day, monthStart) && "bg-muted/50/50 text-muted-foreground"
                      )}
                      onClick={() => {
                        setCurrentDate(day);
                        setView("Day");
                      }}
                    >
                      <div className="flex justify-center mb-1">
                        <span className={cn(
                          "w-7 h-7 flex items-center justify-center text-sm font-medium rounded-full",
                          isToday(day) ? "bg-primary text-primary-foreground" : 
                          isSameDay(day, currentDate) ? "bg-primary/10 text-primary" :
                          "text-foreground/80"
                        )}>
                          {format(day, "d")}
                        </span>
                      </div>
                      
                      <div className="space-y-1 overflow-y-auto max-h-[80px] hide-scrollbar px-1">
                        {dayEvents.map(event => (
                          <div 
                            key={event.id}
                            className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded truncate text-white font-medium shadow-sm",
                              event.color
                            )}
                          >
                            {event.startTime} {event.title}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {view === "Week" && (
            <div className="flex-1 flex flex-col min-h-[600px] relative">
              {/* Week Header */}
              <div className="flex border-b border-border sticky top-0 bg-white z-20 ml-16">
                {weekDays.map(day => (
                  <div key={day.toString()} className="flex-1 flex flex-col items-center justify-center py-3 border-l border-border">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">{format(day, "EEE")}</span>
                    <span className={cn(
                      "text-xl flex items-center justify-center rounded-full w-10 h-10 transition-colors",
                      isToday(day) ? "bg-primary text-primary-foreground font-bold" : 
                      isSameDay(day, currentDate) ? "bg-primary/10 text-primary font-bold" :
                      "text-foreground font-medium"
                    )}>
                      {format(day, "d")}
                    </span>
                  </div>
                ))}
              </div>
              
              {/* Time Grid */}
              <div className="flex-1 overflow-y-auto relative bg-muted/50/30">
                <div className="flex min-h-[960px]"> {/* 12 hours * 80px */}
                  {/* Time Axis */}
                  <div className="w-16 flex-shrink-0 border-r border-border bg-white relative z-10">
                    {hours.map(hour => (
                      <div key={hour} className="h-20 relative border-b border-transparent">
                        <span className="absolute -top-2.5 right-3 text-[11px] font-semibold text-muted-foreground bg-white px-1">
                          {hour > 12 ? `${hour-12} PM` : hour === 12 ? "12 PM" : `${hour} AM`}
                        </span>
                      </div>
                    ))}
                  </div>
                  
                  {/* Day Columns */}
                  <div className="flex-1 flex relative">
                    {weekDays.map(day => {
                      const dateStr = format(day, "yyyy-MM-dd");
                      const dayEvents = getEventsForDay(dateStr);
                      
                      return (
                        <div key={day.toString()} className="flex-1 border-l border-border relative min-w-0">
                          {/* Grid Lines */}
                          {hours.map(hour => (
                            <div key={hour} className="h-20 border-b border-border/60 w-full absolute left-0 right-0 pointer-events-none" style={{ top: `${(hour - 8) * 80}px` }}></div>
                          ))}
                          
                          {/* Events */}
                          {dayEvents.map(event => {
                            if (!event.startTime || !event.endTime) return null;
                            const startParts = event.startTime.split(':').map(Number);
                            const endParts = event.endTime.split(':').map(Number);
                            const startH = startParts[0] || 0;
                            const startM = startParts[1] || 0;
                            const endH = endParts[0] || 0;
                            const endM = endParts[1] || 0;
                            
                            const top = ((startH - 8) + (startM / 60)) * 80;
                            const height = (((endH - startH) + ((endM - startM) / 60))) * 80;
                            
                            if (startH < 8) return null; // skip events outside view for simplicity
                            
                            return (
                              <div 
                                key={event.id}
                                className={cn(
                                  "absolute left-1 right-1 rounded-md p-2 text-white shadow-sm overflow-hidden border border-white/20 transition-all hover:brightness-110 cursor-pointer z-10",
                                  event.color
                                )}
                                style={{ top: `${top}px`, height: `${height}px` }}
                              >
                                <div className="text-xs font-bold truncate leading-tight">{event.title}</div>
                                <div className="text-[10px] opacity-90 truncate mt-0.5">{event.startTime} - {event.endTime}</div>
                              </div>
                            );
                          })}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {view === "Day" && (
            <div className="flex-1 flex flex-col min-h-[600px] relative">
              {/* Day Header */}
              <div className="flex border-b border-border sticky top-0 bg-white z-20 ml-16">
                {[currentDate].map(day => (
                  <div key={day.toString()} className="flex-1 flex flex-col items-center justify-center py-3 border-l border-border bg-muted/20">
                    <span className="text-xs font-semibold text-primary uppercase tracking-widest mb-1">{format(day, "EEEE")}</span>
                    <span className="text-2xl flex items-center justify-center rounded-full w-12 h-12 bg-primary text-primary-foreground font-black shadow-md">
                      {format(day, "d")}
                    </span>
                  </div>
                ))}
              </div>
              
              {/* Time Grid */}
              <div className="flex-1 overflow-y-auto relative bg-muted/50/30">
                <div className="flex min-h-[960px]">
                  {/* Time Axis */}
                  <div className="w-16 flex-shrink-0 border-r border-border bg-white relative z-10">
                    {hours.map(hour => (
                      <div key={hour} className="h-20 relative border-b border-transparent">
                        <span className="absolute -top-2.5 right-3 text-[11px] font-semibold text-muted-foreground bg-white px-1">
                          {hour > 12 ? `${hour-12} PM` : hour === 12 ? "12 PM" : `${hour} AM`}
                        </span>
                      </div>
                    ))}
                  </div>
                  
                  {/* Day Column */}
                  <div className="flex-1 flex relative">
                    {[currentDate].map(day => {
                      const dateStr = format(day, "yyyy-MM-dd");
                      const dayEvents = getEventsForDay(dateStr);
                      
                      return (
                        <div key={day.toString()} className="flex-1 border-l border-border relative min-w-0 bg-white">
                          {/* Grid Lines */}
                          {hours.map(hour => (
                            <div key={hour} className="h-20 border-b border-border/60 w-full absolute left-0 right-0 pointer-events-none" style={{ top: `${(hour - 8) * 80}px` }}></div>
                          ))}
                          
                          {/* Events */}
                          {dayEvents.map(event => {
                            if (!event.startTime || !event.endTime) return null;
                            const startParts = event.startTime.split(':').map(Number);
                            const endParts = event.endTime.split(':').map(Number);
                            const startH = startParts[0] || 0;
                            const startM = startParts[1] || 0;
                            const endH = endParts[0] || 0;
                            const endM = endParts[1] || 0;
                            
                            const top = ((startH - 8) + (startM / 60)) * 80;
                            const height = (((endH - startH) + ((endM - startM) / 60))) * 80;
                            
                            if (startH < 8) return null; // skip events outside view
                            
                            return (
                              <div 
                                key={event.id}
                                className={cn(
                                  "absolute left-4 right-4 rounded-xl px-3 py-1.5 text-white shadow-md overflow-hidden border border-white/20 transition-all hover:scale-[1.02] hover:z-20 cursor-pointer z-10 flex flex-col justify-start",
                                  event.color
                                )}
                                style={{ top: `${top}px`, height: `${height}px` }}
                              >
                                <div className="text-sm font-bold truncate leading-tight mt-0.5 flex items-center gap-2">
                                  <span>{event.title}</span>
                                  {height <= 45 && <span className="text-[10px] font-normal opacity-80">{event.startTime}</span>}
                                </div>
                                {height > 45 && (
                                  <div className="text-xs opacity-90 font-medium truncate flex items-center gap-1 mt-0.5">
                                    <Clock className="w-3 h-3" /> {event.startTime} - {event.endTime}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      <CreateEventModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        onSave={(newEvent) => {
          setEvents([...events, { id: Date.now().toString(), ...newEvent }]);
          setIsCreateModalOpen(false);
        }}
        selectedDate={selectedDateForCreate}
      />
    </div>
  );
}
