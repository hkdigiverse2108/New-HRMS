import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface PenaltyTemplate {
  id: string;
  label: string;
  description: string;
  type: "Penalty" | "Warning";
  amount: string;
}

interface SettingsContextType {
  leaveTypes: string[];
  addLeaveType: (type: string) => void;
  removeLeaveType: (type: string) => void;
  penaltyTemplates: PenaltyTemplate[];
  addPenaltyTemplate: (template: Omit<PenaltyTemplate, "id">) => void;
  removePenaltyTemplate: (id: string) => void;
}

const defaultLeaveTypes = ["Sick Leave", "Casual Leave", "Annual Leave", "Unpaid Leave"];

const defaultPenaltyTemplates: PenaltyTemplate[] = [
  { id: "1", label: "Custom (Manual Entry)", description: "", type: "Penalty", amount: "" },
  { id: "2", label: "Late Arrival (3+ times)", description: "Repeated late arrivals (more than 3 times this month) without prior notice.", type: "Penalty", amount: "50" },
  { id: "3", label: "Missed Deadline (Minor)", description: "Missed internal deadline without prior communication.", type: "Warning", amount: "" },
  { id: "4", label: "Security Policy Violation", description: "Unauthorized access or violation of company security policies.", type: "Penalty", amount: "500" },
  { id: "5", label: "No Show", description: "Absent from work without notice or approval.", type: "Penalty", amount: "200" },
];

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [leaveTypes, setLeaveTypes] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem("hrms_leave_types");
      if (saved) {
        try { return JSON.parse(saved); } catch (e) { return defaultLeaveTypes; }
      }
    }
    return defaultLeaveTypes;
  });

  const [penaltyTemplates, setPenaltyTemplates] = useState<PenaltyTemplate[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem("hrms_penalty_templates");
      if (saved) {
        try { return JSON.parse(saved); } catch (e) { return defaultPenaltyTemplates; }
      }
    }
    return defaultPenaltyTemplates;
  });

  useEffect(() => {
    localStorage.setItem("hrms_leave_types", JSON.stringify(leaveTypes));
  }, [leaveTypes]);

  useEffect(() => {
    localStorage.setItem("hrms_penalty_templates", JSON.stringify(penaltyTemplates));
  }, [penaltyTemplates]);

  const addLeaveType = (type: string) => {
    if (!leaveTypes.includes(type)) {
      setLeaveTypes(prev => [...prev, type]);
    }
  };

  const removeLeaveType = (type: string) => {
    setLeaveTypes(prev => prev.filter(t => t !== type));
  };

  const addPenaltyTemplate = (template: Omit<PenaltyTemplate, "id">) => {
    const newTemplate = { ...template, id: Math.random().toString(36).substr(2, 9) };
    setPenaltyTemplates(prev => [...prev, newTemplate]);
  };

  const removePenaltyTemplate = (id: string) => {
    setPenaltyTemplates(prev => prev.filter(t => t.id !== id));
  };

  return (
    <SettingsContext.Provider value={{ 
      leaveTypes, addLeaveType, removeLeaveType,
      penaltyTemplates, addPenaltyTemplate, removePenaltyTemplate 
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettingsContext() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettingsContext must be used within a SettingsProvider");
  }
  return context;
}
