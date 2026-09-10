import { useState, useMemo } from "react";
import { X,  Search, Filter, Download, MoreHorizontal, CheckCircle2, XCircle, Clock, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Coffee, Briefcase, Award } from "lucide-react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DialogClose,  Dialog, DialogContent, DialogHeader, DialogTitle  } from "@/components/ui/dialog";
import { cn, formatDate } from "@/lib/utils";
import { useEmployeesContext } from "./EmployeeContext";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableHeader } from "@/components/ui/sortable-header";

type AttendanceStatus = "Present" | "Absent" | "Late" | "On Leave";

interface AttendanceRecord {
  employeeId: string;
  employeeName: string;
  role: string;
  department: string;
  avatar: string;
  date: string;
  status: AttendanceStatus;
  checkIn: string | null;
  checkOut: string | null;
  totalHours: string | null;
  breakHours: string | null;
  logs: { action: string; time: string; type: "punch" | "break" }[];
}

export function AttendanceList() {
  const { employees } = useEmployeesContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | "All">("All");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(new Date().setDate(new Date().getDate() - 7)),
    to: new Date(),
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const itemsPerPage = 10;

  // Generate mock attendance data based on actual employees for the last 7 days
  const attendanceData = useMemo(() => {
    const records: AttendanceRecord[] = [];
    
    for (let i = 0; i < 7; i++) {
      const dateObj = new Date();
      dateObj.setDate(dateObj.getDate() - i);
      const dateStr = dateObj.toISOString().split("T")[0] || "";
      
      // Skip weekends to make it realistic
      if (dateObj.getDay() === 0 || dateObj.getDay() === 6) continue;

      employees.forEach(emp => {
        // Deterministic pseudo-random status based on employee ID and date
        const hash = emp.id.charCodeAt(emp.id.length - 1) + i;
        let status: AttendanceStatus = "Present";
        let checkIn: string | null = "09:00 AM";
        let checkOut: string | null = "05:30 PM";
        let totalHours: string | null = "8.5h";

        let breakHours: string | null = "1h";
        let logs: { action: string; time: string; type: "punch" | "break" }[] = [];

        if (hash % 10 === 0) {
          status = "Absent";
          checkIn = null;
          checkOut = null;
          totalHours = null;
          breakHours = null;
        } else if (hash % 7 === 0) {
          status = "On Leave";
          checkIn = null;
          checkOut = null;
          totalHours = null;
          breakHours = null;
        } else if (hash % 5 === 0) {
          status = "Late";
          checkIn = "10:15 AM";
          checkOut = "06:00 PM";
          totalHours = "7.75h";
          breakHours = "0.75h";
          logs = [
            { action: "Punched In", time: "10:15 AM", type: "punch" },
            { action: "Break In", time: "01:30 PM", type: "break" },
            { action: "Break Out", time: "02:15 PM", type: "break" },
            { action: "Punched Out", time: "06:00 PM", type: "punch" },
          ];
        } else {
          // Randomize check-in times slightly for Present
          const mins = (hash % 15).toString().padStart(2, '0');
          checkIn = `08:${45 + (hash % 15)} AM`;
          if (45 + (hash % 15) >= 60) {
            checkIn = `09:${(45 + (hash % 15) - 60).toString().padStart(2, '0')} AM`;
          }
          logs = [
            { action: "Punched In", time: checkIn, type: "punch" },
            { action: "Break In", time: "12:30 PM", type: "break" },
            { action: "Break Out", time: "01:30 PM", type: "break" },
            { action: "Punched Out", time: checkOut || "05:30 PM", type: "punch" },
          ];
        }

        records.push({
          employeeId: `${emp.id}-${dateStr}`,
          employeeName: emp.name,
          role: emp.role,
          department: emp.department,
          avatar: emp.avatar || "",
          date: dateStr,
          status,
          checkIn,
          checkOut,
          totalHours,
          breakHours,
          logs
        });
      });
    }
    
    return records;
  }, [employees]);

  const filteredData = useMemo(() => {
    return attendanceData.filter(record => {
      const matchesSearch = record.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            record.role.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "All" || record.status === statusFilter;
      
      let matchesDate = true;
      if (dateRange?.from) {
        const recordDate = new Date(record.date);
        const fromDate = new Date(dateRange.from);
        fromDate.setHours(0, 0, 0, 0);
        
        if (dateRange.to) {
          const toDate = new Date(dateRange.to);
          toDate.setHours(23, 59, 59, 999);
          matchesDate = recordDate >= fromDate && recordDate <= toDate;
        } else {
          matchesDate = recordDate.getTime() === fromDate.getTime();
        }
      }

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [attendanceData, searchQuery, statusFilter, dateRange]);

  const { items: sortedData, requestSort, sortConfig } = useSortableData(filteredData);

  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedData.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedData, currentPage]);

  // Reset page when filters change
  useMemo(() => setCurrentPage(1), [searchQuery, statusFilter, dateRange]);

  const stats = useMemo(() => {
    return {
      present: filteredData.filter(r => r.status === "Present" || r.status === "Late").length,
      absent: filteredData.filter(r => r.status === "Absent").length,
      onLeave: filteredData.filter(r => r.status === "On Leave").length,
      late: filteredData.filter(r => r.status === "Late").length,
    };
  }, [filteredData]);

  const getStatusBadge = (status: AttendanceStatus) => {
    switch (status) {
      case "Present": return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/50"><CheckCircle2 className="w-3.5 h-3.5" /> Present</span>;
      case "Absent": return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200/50"><XCircle className="w-3.5 h-3.5" /> Absent</span>;
      case "Late": return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200/50"><Clock className="w-3.5 h-3.5" /> Late</span>;
      case "On Leave": return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/50"><Clock className="w-3.5 h-3.5" /> On Leave</span>;
    }
  };

  return (
    <div className="h-full flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">Daily Attendance</h1>
          <p className="text-sm text-muted-foreground mt-1">Past 7 Days</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 bg-white border border-border rounded-xl text-sm font-bold text-foreground/80 hover:bg-muted/50 shadow-sm flex items-center gap-2">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      {/* Top Section: KPIs & Calendar */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left Column: KPI Cards */}
        <div className="xl:col-span-2 flex flex-col gap-6">
          {/* Overall Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Present", value: stats.present, color: "text-emerald-600", bg: "bg-emerald-50" },
              { label: "Total Absent", value: stats.absent, color: "text-rose-600", bg: "bg-rose-50" },
              { label: "Late Arrivals", value: stats.late, color: "text-amber-600", bg: "bg-amber-50" },
              { label: "On Leave", value: stats.onLeave, color: "text-blue-600", bg: "bg-blue-50" },
            ].map((stat, i) => (
              <div key={i} className="bg-white border border-border rounded-2xl p-5 shadow-sm flex flex-col justify-center">
                <p className="text-sm font-bold text-muted-foreground">{stat.label}</p>
                <p className={cn("text-3xl font-black mt-2", stat.color)}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Personal Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: "Avg Daily Hours", value: "8h 23m", sub: "Based on active logs", icon: Clock },
              { label: "Break Time", value: "51h 01m", sub: "Cumulative break duration", icon: Coffee },
              { label: "Working Time", value: "142h 34m", sub: "Total hours this month", icon: Briefcase },
            ].map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div key={i} className="bg-white border border-border/60 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-1.5">
                    <p className="text-[12px] font-bold text-muted-foreground truncate mr-2">{stat.label}</p>
                    <Icon className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                  </div>
                  <p className="text-2xl font-black text-foreground">{stat.value}</p>
                  <p className="text-[10px] font-medium text-muted-foreground mt-1.5 truncate" title={stat.sub}>{stat.sub}</p>
                </div>
              );
            })}
          </div>

          {/* Top Punctual Employees / Hall of Fame */}
          <div className="bg-white border border-border/60 rounded-3xl shadow-sm p-5 h-[160px] flex flex-col relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-600" /> 
                Punctuality Hall of Fame
              </h3>
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">This Month</p>
            </div>
            <div className="flex-1 overflow-y-auto pr-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {[
                  { name: "Sneha Pillai", dept: "Operations", streak: "14 Days" },
                  { name: "Rahul Sharma", dept: "Marketing", streak: "12 Days" },
                  { name: "Meera Kapoor", dept: "Design", streak: "9 Days" },
                  { name: "Vikram Iyer", dept: "Engineering", streak: "7 Days" },
                  { name: "Aditi Desai", dept: "Sales", streak: "6 Days" },
                ].map((emp, i) => (
                  <div key={i} className="flex flex-col p-3 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-[9px] font-black text-emerald-700">
                        #{i + 1}
                      </div>
                      <div className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                        {emp.streak}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground line-clamp-1">{emp.name}</p>
                      <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{emp.dept}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Calendar Preview */}
        <div className="xl:col-span-1 flex flex-col gap-6">
          <div className="bg-white border border-border/60 rounded-3xl shadow-sm p-6 flex flex-col relative overflow-hidden shrink-0 h-full">
            <h3 className="text-lg font-black text-foreground mb-2">Schedule Preview</h3>
            <div className="flex-1 flex items-center justify-center">
              <Calendar
                mode="single"
                selected={new Date()}
                className="bg-transparent p-0 [&_.rdp]:bg-transparent"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-white border border-border rounded-3xl shadow-sm overflow-hidden flex flex-col min-h-[500px]">
        {/* Toolbar */}
        <div className="p-4 border-b border-border flex flex-col sm:flex-row justify-between items-center gap-4 bg-muted/50/50">
          <div className="relative w-full sm:w-72">
            <input 
              type="text" 
              placeholder="Search by name or role..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
            />
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          </div>
          
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 bg-white border border-border rounded-xl text-sm font-medium text-foreground/80 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 hover:bg-muted/50 transition-colors",
                    !dateRange && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-1 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {formatDate(dateRange.from)} -{" "}
                        {formatDate(dateRange.to)}
                      </>
                    ) : (
                      formatDate(dateRange.from)
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from || new Date()}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
            
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 hide-scrollbar">
              {(["All", "Present", "Absent", "Late", "On Leave"] as const).map(status => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all duration-200",
                    statusFilter === status 
                      ? "bg-primary text-primary-foreground shadow-md" 
                      : "bg-white text-foreground/80 border border-border hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-muted/50/80 sticky top-0 z-10 backdrop-blur-sm">
              <tr>
                <SortableHeader label="Employee" sortKey="employeeName" currentSort={sortConfig} onSort={requestSort} className="px-6 py-4 text-xs font-black text-muted-foreground uppercase tracking-wider border-b border-border" />
                <SortableHeader label="Date" sortKey="date" currentSort={sortConfig} onSort={requestSort} className="px-6 py-4 text-xs font-black text-muted-foreground uppercase tracking-wider border-b border-border" />
                <SortableHeader label="Status" sortKey="status" currentSort={sortConfig} onSort={requestSort} className="px-6 py-4 text-xs font-black text-muted-foreground uppercase tracking-wider border-b border-border" />
                <SortableHeader label="Check In" sortKey="checkIn" currentSort={sortConfig} onSort={requestSort} className="px-6 py-4 text-xs font-black text-muted-foreground uppercase tracking-wider border-b border-border" />
                <SortableHeader label="Check Out" sortKey="checkOut" currentSort={sortConfig} onSort={requestSort} className="px-6 py-4 text-xs font-black text-muted-foreground uppercase tracking-wider border-b border-border" />
                <SortableHeader label="Break Hours" sortKey="breakHours" currentSort={sortConfig} onSort={requestSort} className="px-6 py-4 text-xs font-black text-muted-foreground uppercase tracking-wider border-b border-border" />
                <SortableHeader label="Total Hours" sortKey="totalHours" currentSort={sortConfig} onSort={requestSort} className="px-6 py-4 text-xs font-black text-muted-foreground uppercase tracking-wider border-b border-border" />
                <th className="px-6 py-4 border-b border-border"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                    No attendance records found matching your filters.
                  </td>
                </tr>
              ) : (
                paginatedData.map((record) => (
                  <tr key={record.employeeId} className="hover:bg-muted/50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img src={record.avatar} alt={record.employeeName} className="w-10 h-10 rounded-full object-cover border border-border" />
                        <div>
                          <p className="font-bold text-foreground">{record.employeeName}</p>
                          <p className="text-xs text-muted-foreground font-medium">{record.role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-foreground/80">{record.date}</span>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(record.status)}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-foreground/80">{record.checkIn || "--:--"}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-foreground/80">{record.checkOut || "--:--"}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "text-sm font-bold",
                        record.breakHours ? "text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md" : "text-muted-foreground"
                      )}>
                        {record.breakHours || "-"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "text-sm font-bold",
                        record.totalHours ? "text-primary bg-primary/10 px-2.5 py-1 rounded-md" : "text-muted-foreground"
                      )}>
                        {record.totalHours || "-"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => setSelectedRecord(record)}
                        className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <MoreHorizontal className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-border bg-white flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing <span className="font-bold text-foreground">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-bold text-foreground">{Math.min(currentPage * itemsPerPage, filteredData.length)}</span> of <span className="font-bold text-foreground">{filteredData.length}</span> records
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 border border-border rounded-lg text-muted-foreground hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="text-sm font-bold text-foreground/80 px-2">
                Page {currentPage} of {totalPages}
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 border border-border rounded-lg text-muted-foreground hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>


      <Dialog open={!!selectedRecord} onOpenChange={(open) => !open && setSelectedRecord(null)}>
        <DialogContent className="sm:max-w-[425px] md:max-w-[500px] p-0 overflow-hidden rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <div className="flex items-center justify-between px-6 md:px-8 py-6 border-b border-border/50 bg-muted/30">
          <div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight">Attendance Logs</h2>
            
          </div>
          <DialogClose asChild>
            <button className="p-2 text-muted-foreground hover:text-foreground/80 hover:bg-muted rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </DialogClose>
        </div>
          <div className="mt-4 px-6 md:px-8 py-6">
            {selectedRecord && (
              <>
                <div className="flex items-center gap-4 mb-6 pb-4 border-b border-border/50">
                  <img src={selectedRecord.avatar} alt={selectedRecord.employeeName} className="w-12 h-12 rounded-full border border-border" />
                  <div>
                    <p className="font-bold text-foreground">{selectedRecord.employeeName}</p>
                    <p className="text-sm text-muted-foreground">{selectedRecord.date}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {selectedRecord.logs && selectedRecord.logs.length > 0 ? (
                    selectedRecord.logs.map((log, i) => (
                      <div key={i} className="flex gap-4 relative">
                        {i !== selectedRecord.logs.length - 1 && (
                          <div className="absolute left-2.5 top-6 bottom-[-16px] w-0.5 bg-border/50"></div>
                        )}
                        <div className={cn(
                          "w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 border-2 border-white ring-1",
                          log.type === "punch" ? "bg-primary ring-primary/30" : "bg-amber-500 ring-amber-500/30"
                        )}></div>
                        <div className="bg-muted/30 rounded-xl p-3 flex-1 border border-border/50">
                          <p className="text-sm font-bold text-foreground/80">{log.action}</p>
                          <p className="text-xs font-medium text-muted-foreground mt-0.5">{log.time}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      No logs available for this day.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
