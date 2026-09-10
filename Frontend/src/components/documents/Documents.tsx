import { useState } from "react";
import { cn } from "@/lib/utils";
import { 
  FileText, 
  Mail, 
  Settings2, 
  FileSignature, 
  Stamp, 
  PenTool
} from "lucide-react";
import { SubmittedDocuments } from "./tabs/SubmittedDocuments";
import { OfficialLetters } from "./tabs/OfficialLetters";
import { DocumentTypes } from "./tabs/DocumentTypes";
import { DocumentTemplates } from "./tabs/DocumentTemplates";
import { VerifyContracts } from "./tabs/VerifyContracts";
import { EmployeeSignatures } from "./tabs/EmployeeSignatures";

const TABS = [
  { id: "submitted", label: "Submitted Documents", icon: FileText },
  { id: "requests", label: "Official Letters & Requests", icon: Mail },
  { id: "types", label: "Document Types", icon: Settings2 },
  { id: "templates", label: "Document Templates", icon: PenTool },
  { id: "contracts", label: "Verify Contracts", icon: Stamp },
  { id: "signatures", label: "Employee Signatures", icon: FileSignature },
];

export function Documents({ setActive }: { setActive?: (path: string) => void }) {
  const [activeTab, setActiveTab] = useState(TABS[0]!.id);

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">
            Document Center
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            Manage employee documents, letters, contracts, and signatures in one place.
          </p>
        </div>
      </div>

      <div className="flex overflow-x-auto pb-2 scrollbar-none border-b border-border/50">
        <div className="flex gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-5 py-3 text-sm font-bold rounded-t-xl transition-all border-b-2",
                activeTab === tab.id
                  ? "bg-primary/5 text-primary border-primary"
                  : "text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/50"
              )}
            >
              <tab.icon className={cn("w-4 h-4", activeTab === tab.id ? "text-primary" : "text-muted-foreground/70")} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8">
        {activeTab === "submitted" && <SubmittedDocuments />}
        {activeTab === "requests" && <OfficialLetters onNavigate={setActive} />}
        {activeTab === "types" && <DocumentTypes />}
        {activeTab === "templates" && <DocumentTemplates />}
        {activeTab === "contracts" && <VerifyContracts />}
        {activeTab === "signatures" && <EmployeeSignatures />}
      </div>
    </div>
  );
}
