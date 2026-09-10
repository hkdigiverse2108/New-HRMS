import React, { createContext, useContext, useState, useEffect } from 'react';
import { EMPLOYEES, Employee } from './employee-data';
import { ORG_DATA, OrgNodeData } from './org-data';

interface EmployeeContextType {
  employees: Employee[];
  treeData: OrgNodeData;
  addEmployee: (employee: Employee) => void;
  updateEmployee: (id: string, updates: Partial<Employee>) => void;
  deleteEmployee: (id: string) => void;
  updateTree: (newTree: OrgNodeData) => void;
}

const EmployeeContext = createContext<EmployeeContextType | undefined>(undefined);

export function EmployeeProvider({ children }: { children: React.ReactNode }) {
  const [employees, setEmployees] = useState<Employee[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hrms_employees');
      if (saved) return JSON.parse(saved);
    }
    return EMPLOYEES;
  });

  const [treeData, setTreeData] = useState<OrgNodeData>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hrms_org_tree');
      if (saved) return JSON.parse(saved);
    }
    return ORG_DATA;
  });

  useEffect(() => {
    localStorage.setItem('hrms_employees', JSON.stringify(employees));
  }, [employees]);

  useEffect(() => {
    localStorage.setItem('hrms_org_tree', JSON.stringify(treeData));
  }, [treeData]);

  const addEmployee = (employee: Employee) => {
    setEmployees(prev => [employee, ...prev]);
  };

  const updateEmployee = (id: string, updates: Partial<Employee>) => {
    setEmployees(prev => prev.map(emp => emp.id === id ? { ...emp, ...updates } : emp));
  };

  const deleteEmployee = (id: string) => {
    setEmployees(prev => prev.filter(emp => emp.id !== id));
    
    // Also remove from org tree if present
    const newTree = JSON.parse(JSON.stringify(treeData)) as OrgNodeData;
    const removeNode = (node: OrgNodeData): boolean => {
      if (node.children) {
        const index = node.children.findIndex(c => c.id === id);
        if (index !== -1) {
          node.children.splice(index, 1);
          return true;
        }
        for (const child of node.children) {
          if (removeNode(child)) return true;
        }
      }
      return false;
    };
    
    if (removeNode(newTree)) {
      setTreeData(newTree);
    }
  };

  const updateTree = (newTree: OrgNodeData) => {
    setTreeData(newTree);
  };

  return (
    <EmployeeContext.Provider value={{ employees, treeData, addEmployee, updateEmployee, deleteEmployee, updateTree }}>
      {children}
    </EmployeeContext.Provider>
  );
}

export function useEmployeesContext() {
  const context = useContext(EmployeeContext);
  if (context === undefined) {
    throw new Error('useEmployeesContext must be used within an EmployeeProvider');
  }
  return context;
}
