import { useState, useMemo } from "react";
import { ArrowLeft, Download, Send, Printer, User, FileText, Sparkles, Building2, Calendar, IndianRupee, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SearchableSelect } from "@/components/ui/select";

// Mock Data
const MOCK_EMPLOYEES = [
  { id: "e1", name: "Sarah Jenkins", role: "Frontend Developer", department: "Engineering", location: "Mumbai", joiningDate: "2024-03-01" },
  { id: "e2", name: "Michael Chen", role: "Product Manager", department: "Product", location: "Bangalore", joiningDate: "2023-08-15" },
];

const MOCK_TEMPLATES = [
  { 
    id: "t1", 
    name: "Offer Letter", 
    content: `Dear {{employee_name}},

We are pleased to offer you the position of {{role}} in the {{department}} department at our company. Your expected joining date is {{joining_date}} at our {{location}} office.

Your annual compensation will be {{salary}}. 

Please sign and return this letter by {{due_date}} to indicate your acceptance of this offer.

Sincerely,
HR Department` 
  },
  { 
    id: "t2", 
    name: "Relieving Letter", 
    content: `To Whom It May Concern,

This is to certify that {{employee_name}} was employed with us as a {{role}} in the {{department}} department from {{joining_date}} to {{last_working_day}}.

During this tenure, we found their performance to be satisfactory. 

We wish them all the best in their future endeavors.

Sincerely,
HR Department` 
  }
];

export function DocumentGenerator({ onBack }: { onBack?: () => void }) {
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [selectedTempId, setSelectedTempId] = useState("");
  
  const [customVars, setCustomVars] = useState<Record<string, string>>({
    salary: "₹ 12,00,000",
    due_date: "2024-03-25",
    last_working_day: "2024-03-20"
  });

  const selectedEmp = MOCK_EMPLOYEES.find(e => e.id === selectedEmpId);
  const selectedTemp = MOCK_TEMPLATES.find(t => t.id === selectedTempId);

  const activeVariables = useMemo(() => {
    return {
      employee_name: selectedEmp?.name || "[Employee Name]",
      role: selectedEmp?.role || "[Role]",
      department: selectedEmp?.department || "[Department]",
      location: selectedEmp?.location || "[Location]",
      joining_date: selectedEmp?.joiningDate || "[Joining Date]",
      ...customVars
    };
  }, [selectedEmp, customVars]);

  const previewContent = useMemo(() => {
    if (!selectedTemp) return "";
    let content = selectedTemp.content;
    
    // Replace all {{variable}} occurrences
    Object.entries(activeVariables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      content = content.replace(regex, `<span class="bg-primary/20 text-primary-foreground font-bold px-1 rounded mx-0.5">${value}</span>`);
    });

    // Highlight missing variables that haven't been replaced
    content = content.replace(/{{([^}]+)}}/g, '<span class="bg-rose-500/20 text-rose-500 font-bold px-1 rounded mx-0.5" title="Missing Variable">{$1}</span>');

    // Format newlines to HTML br
    return content.replace(/\n/g, '<br/>');
  }, [selectedTemp, activeVariables]);

  const handleVarChange = (key: string, val: string) => {
    setCustomVars(prev => ({ ...prev, [key]: val }));
  };

  return (
    <div className="flex flex-col h-full min-h-[85vh] animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 mb-6 border-b border-border/50">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2.5 bg-card border border-border/50 rounded-xl hover:bg-muted/50 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-primary" />
              Document Generator
            </h1>
            <p className="text-muted-foreground text-sm font-medium">Create and preview dynamic documents</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2.5 bg-card border border-border/50 text-foreground font-bold rounded-xl hover:bg-muted/50 transition-colors flex items-center gap-2 shadow-sm">
            <Printer className="w-4 h-4" />
            Print
          </button>
          <button className="px-4 py-2.5 bg-card border border-border/50 text-foreground font-bold rounded-xl hover:bg-muted/50 transition-colors flex items-center gap-2 shadow-sm">
            <Download className="w-4 h-4" />
            Export PDF
          </button>
          <button className="px-5 py-2.5 bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl transition-colors flex items-center gap-2 shadow-sm">
            <Send className="w-4 h-4" />
            Send for Signature
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex flex-col lg:flex-row gap-8 h-full flex-grow">
        
        {/* Left Panel: Configuration */}
        <div className="w-full lg:w-[400px] flex flex-col gap-6 shrink-0">
          
          {/* Target Selection */}
          <div className="bg-card border border-border/50 p-5 rounded-2xl shadow-sm space-y-4">
            <h3 className="font-bold flex items-center gap-2 text-foreground">
              <User className="w-4 h-4 text-primary" />
              Target Employee
            </h3>
            <SearchableSelect 
              value={selectedEmpId}
              onChange={(val) => setSelectedEmpId(val)}
              options={MOCK_EMPLOYEES.map(emp => ({ label: `${emp.name} - ${emp.role}`, value: emp.id }))}
              placeholder="Select Employee..."
              className="w-full h-[38px] px-4 bg-background border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
            />
            
            <h3 className="font-bold flex items-center gap-2 text-foreground pt-2">
              <FileText className="w-4 h-4 text-primary" />
              Document Template
            </h3>
            <SearchableSelect 
              value={selectedTempId}
              onChange={(val) => setSelectedTempId(val)}
              options={MOCK_TEMPLATES.map(tmp => ({ label: tmp.name, value: tmp.id }))}
              placeholder="Select Template..."
              className="w-full h-[38px] px-4 bg-background border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
            />
          </div>

          {/* Dynamic Variables */}
          {selectedTemp && (
            <div className="bg-card border border-border/50 p-5 rounded-2xl shadow-sm flex-grow">
              <h3 className="font-bold flex items-center gap-2 text-foreground mb-4">
                <Settings2 className="w-4 h-4 text-primary" />
                Template Variables
              </h3>
              
              <div className="space-y-4 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
                {selectedTemp.content.includes("{{salary}}") && (
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <IndianRupee className="w-3 h-3" /> Salary Amount
                    </label>
                    <input 
                      value={customVars["salary"] || ""}
                      onChange={(e) => handleVarChange("salary", e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                  </div>
                )}
                
                {selectedTemp.content.includes("{{due_date}}") && (
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Due Date
                    </label>
                    <input 
                      type="date"
                      value={customVars["due_date"] || ""}
                      onChange={(e) => handleVarChange("due_date", e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                  </div>
                )}

                {selectedTemp.content.includes("{{last_working_day}}") && (
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Last Working Day
                    </label>
                    <input 
                      type="date"
                      value={customVars["last_working_day"] || ""}
                      onChange={(e) => handleVarChange("last_working_day", e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Panel: Live Preview */}
        <div className="flex-grow bg-muted/30 border border-border/50 rounded-3xl p-6 flex flex-col h-full min-h-[600px]">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-muted-foreground uppercase tracking-wider text-xs">Live Preview</h3>
            <span className="flex items-center gap-2 text-xs font-bold text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded-md">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Auto-syncing
            </span>
          </div>

          {!selectedTemp ? (
            <div className="flex-grow flex flex-col items-center justify-center text-center p-8 bg-card border border-dashed border-border/50 rounded-2xl">
              <FileText className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <h4 className="text-lg font-bold text-foreground mb-1">No Template Selected</h4>
              <p className="text-sm text-muted-foreground max-w-sm">Select an employee and a document template from the configuration panel to view the live preview.</p>
            </div>
          ) : (
            <div className="flex-grow bg-white dark:bg-card border border-border/50 shadow-sm rounded-2xl p-8 overflow-y-auto custom-scrollbar">
              <div 
                className="prose prose-sm dark:prose-invert max-w-none font-medium leading-relaxed"
                dangerouslySetInnerHTML={{ __html: previewContent }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
