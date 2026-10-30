import { useEffect, useRef } from "react";
import { usePersistentState } from "@/hooks/usePersistentState";
import { cn } from "@/lib/utils";
import { 
  FileText, 
  Mail, 
  Settings2, 
  FileSignature, 
  Stamp, 
  PenTool
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";
import { isUserAdmin } from "@/lib/permissions";
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
  const { user } = useAuth();

  const userRole = String((user as any)?.role || (user as any)?.work_details?.system_role || (user as any)?.system_role || "").toLowerCase();
  const userDept = String((user as any)?.department || (user as any)?.work_details?.department || "").toLowerCase();
  const isAdminOrHR = isUserAdmin(user) || ["admin", "subadmin", "superadmin", "hr", "hr manager"].some(r => userRole.includes(r)) || userDept === "hr";

  const visibleTabs = TABS.filter(tab => {
    if (["types", "templates", "contracts", "signatures"].includes(tab.id)) {
      return isAdminOrHR;
    }
    return true;
  });

  const [activeTab, setActiveTab] = usePersistentState("documents.tab", "submitted");

  // Fallback to submitted if non-admin somehow has an admin tab selected
  const currentTab = !isAdminOrHR && ["types", "templates", "contracts", "signatures"].includes(activeTab)
    ? "submitted"
    : activeTab;

  // Keep the selected tab centred in the scrollable tab strip
  const tabsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const box = tabsRef.current;
      const el = box?.querySelector<HTMLElement>(`[data-tab="${currentTab}"]`);
      if (!box || !el) return;
      const b = box.getBoundingClientRect();
      const t = el.getBoundingClientRect();
      box.scrollTo({ left: box.scrollLeft + (t.left - b.left) - (b.width - t.width) / 2, behavior: "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [currentTab, visibleTabs.length]);

  return (
    <div className="w-full min-w-0 space-y-5 sm:space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
            Document Center
          </h1>
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm font-medium">
            Manage employee documents, letters, contracts, and signatures in one place.
          </p>
        </div>
      </div>

      {visibleTabs.length > 1 && (
        <div ref={tabsRef} className="flex overflow-x-auto pb-2 scrollbar-none border-b -mx-1 px-1 border-border/50">
          <div className="flex gap-2">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                data-tab={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-3 sm:px-5 py-3 min-h-[44px] text-xs sm:text-sm font-bold rounded-t-xl transition-all border-b-2 whitespace-nowrap shrink-0",
                  currentTab === tab.id
                    ? "bg-primary/5 text-primary border-primary"
                    : "text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/50"
                )}
              >
                <tab.icon className={cn("w-4 h-4", currentTab === tab.id ? "text-primary" : "text-muted-foreground/70")} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 sm:mt-8 min-w-0">
        {currentTab === "submitted" && <SubmittedDocuments />}
        {currentTab === "requests" && <OfficialLetters onNavigate={setActive} />}
        {currentTab === "types" && isAdminOrHR && <DocumentTypes />}
        {currentTab === "templates" && isAdminOrHR && <DocumentTemplates />}
        {currentTab === "contracts" && isAdminOrHR && <VerifyContracts />}
        {currentTab === "signatures" && isAdminOrHR && <EmployeeSignatures />}
      </div>
    </div>
  );
}
