import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { leads as initialLeads, pipelineStages, salesTasks as initialTasks, type Lead, type SalesTask } from "./sales-data";

type SalesContextType = {
  leads: Lead[];
  setLeads: (leads: Lead[]) => void;
  stages: string[];
  setStages: (stages: string[]) => void;
  tasks: SalesTask[];
  setTasks: (tasks: SalesTask[]) => void;
};

const SalesContext = createContext<SalesContextType | undefined>(undefined);

export function SalesProvider({ children }: { children: ReactNode }) {
  const [leads, setLeads] = useState<Lead[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hrms_sales_leads');
      return saved ? JSON.parse(saved) : initialLeads;
    }
    return initialLeads;
  });
  
  const [stages, setStages] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hrms_sales_stages');
      return saved ? JSON.parse(saved) : pipelineStages.map((s) => s.stage);
    }
    return pipelineStages.map((s) => s.stage);
  });

  const [tasks, setTasks] = useState<SalesTask[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hrms_sales_tasks');
      return saved ? JSON.parse(saved) : initialTasks;
    }
    return initialTasks;
  });

  useEffect(() => { if (typeof window !== 'undefined') localStorage.setItem('hrms_sales_leads', JSON.stringify(leads)); }, [leads]);
  useEffect(() => { if (typeof window !== 'undefined') localStorage.setItem('hrms_sales_stages', JSON.stringify(stages)); }, [stages]);
  useEffect(() => { if (typeof window !== 'undefined') localStorage.setItem('hrms_sales_tasks', JSON.stringify(tasks)); }, [tasks]);

  return (
    <SalesContext.Provider value={{ leads, setLeads, stages, setStages, tasks, setTasks }}>
      {children}
    </SalesContext.Provider>
  );
}

export function useSales() {
  const context = useContext(SalesContext);
  if (context === undefined) {
    throw new Error("useSales must be used within a SalesProvider");
  }
  return context;
}
