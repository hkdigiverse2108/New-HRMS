import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { WEEKLY_ATTENDANCE } from "../dashboard-data";
import { CollapsibleSection } from "./CollapsibleSection";

export function AttendanceAnalytics() {
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());

  const generateHeatmap = () => {
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();
    
    // get first day of month (0-6 where 0 is Sunday, 1 is Monday...)
    const firstDay = new Date(year, month, 1).getDay();
    // adjust firstDay so that 0 is Monday, 6 is Sunday
    const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;
    
    // get total days in month
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const weeks = [];
    let currentDay = 1;
    
    for (let w = 0; w < 6; w++) {
      const days = [];
      for (let d = 0; d < 7; d++) {
        if (w === 0 && d < adjustedFirstDay) {
          // empty days before the 1st
          days.push({ val: 0, date: "" });
        } else if (currentDay > daysInMonth) {
          // empty days after the last day
          days.push({ val: 0, date: "" });
        } else {
          // actual days
          const isWeekend = (d === 5 || d === 6); // Sat=5, Sun=6
          const val = isWeekend ? 0 : Math.floor(Math.random() * 4) + 1;
          days.push({ val, date: currentDay });
          currentDay++;
        }
      }
      weeks.push(days);
      if (currentDay > daysInMonth) break;
    }
    return weeks;
  };
  
  const heatmap = generateHeatmap();

  return (
    <div className="mb-12">
      <CollapsibleSection section="Section 04" title="Attendance Analytics">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Weekly Attendance */}
        <div className="bg-white border border-border/60 rounded-3xl p-6 shadow-sm md:col-span-2">
          <div className="mb-6">
            <h3 className="font-bold text-foreground">Weekly Attendance</h3>
            <p className="text-[11px] text-muted-foreground">Present vs late vs WFH vs absent</p>
          </div>
          <div className="h-[250px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={WEEKLY_ATTENDANCE} margin={{ top: 10, right: 0, left: -20, bottom: 0 }} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} ticks={[0, 40, 80, 120, 160]} domain={[0, 160]} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '12px', color: 'var(--foreground)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ fontWeight: 'bold' }}
                  cursor={{ fill: 'var(--muted)', opacity: 0.2 }}
                />
                <Legend 
                  iconType="circle" 
                  wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} 
                  formatter={(value) => <span className="text-muted-foreground font-medium capitalize">{value}</span>}
                />
                <Bar dataKey="present" fill="#00A56C" radius={[4, 4, 0, 0]} barSize={16} />
                <Bar dataKey="late" fill="#F59E0B" radius={[4, 4, 0, 0]} barSize={16} />
                <Bar dataKey="wfh" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={16} />
                <Bar dataKey="absent" fill="#EF4444" radius={[4, 4, 0, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Small stats */}
        <div className="space-y-6">
          <div className="bg-white border border-border/60 rounded-3xl p-6 shadow-sm">
            <h3 className="font-bold text-foreground mb-1">Work From Home</h3>
            <p className="text-[11px] text-muted-foreground mb-4">26 employees remote today</p>
            <div className="flex items-end gap-2">
              <p className="text-3xl font-black text-blue-500 leading-none">17%</p>
            </div>
            <div className="h-1.5 w-full bg-muted rounded-full mt-4 overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: '17%' }}></div>
            </div>
          </div>
          
          <div className="bg-white border border-border/60 rounded-3xl p-6 shadow-sm">
            <h3 className="font-bold text-foreground mb-1">Late Analysis</h3>
            <p className="text-[11px] text-muted-foreground mb-4">Avg delay 18 min · peak on Wednesdays</p>
            <div className="flex items-end gap-2">
              <p className="text-3xl font-black text-amber-500 leading-none">8</p>
              <p className="text-[11px] font-bold text-muted-foreground mb-1">late today</p>
            </div>
            <div className="h-1.5 w-full bg-muted rounded-full mt-4 overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full" style={{ width: '8%' }}></div>
            </div>
          </div>
        </div>

        {/* Heatmap Calendar */}
        <div className="bg-white border border-border/60 rounded-3xl p-6 shadow-sm md:col-span-3">
          <div className="mb-6 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-foreground">Heatmap Calendar</h3>
              <p className="text-[11px] text-muted-foreground">Attendance intensity for {currentMonthDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1))}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-muted/50 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1))}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-muted/50 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {/* Days Header */}
            <div className="flex gap-2 mb-1">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, i) => (
                <div key={i} className="flex-1 text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  {day}
                </div>
              ))}
            </div>
            
            {/* Calendar Grid */}
            {heatmap.map((week, w) => (
              <div key={w} className="flex gap-2">
                {week.map((day, d) => (
                  <div 
                    key={d} 
                    className={`flex-1 h-10 flex items-center justify-center rounded-lg text-[12px] font-medium transition-all cursor-default ${!day.date ? 'opacity-0' : 'hover:scale-[1.02]'} ${
                      day.val === 0 ? 'bg-muted/50 text-muted-foreground' : 
                      day.val === 1 ? 'bg-emerald-100 text-emerald-800' :
                      day.val === 2 ? 'bg-emerald-300 text-emerald-900' :
                      day.val === 3 ? 'bg-emerald-500 text-white' : 'bg-emerald-700 text-white'
                    }`}
                  >
                    {day.date}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="flex justify-end items-center gap-2 mt-4 text-[10px] text-muted-foreground">
            <span>Low</span>
            <div className="w-3 h-3 rounded-sm bg-emerald-100"></div>
            <div className="w-3 h-3 rounded-sm bg-emerald-300"></div>
            <div className="w-3 h-3 rounded-sm bg-emerald-500"></div>
            <div className="w-3 h-3 rounded-sm bg-emerald-700"></div>
            <span>High</span>
          </div>
        </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}
