import React, { createContext, useContext, useState, useEffect } from 'react';
import { AVAILABLE_DEPARTMENTS as initialDepartments } from './employee-data';

interface DepartmentContextType {
  departments: string[];
  addDepartment: (dept: string) => void;
  removeDepartment: (dept: string) => void;
  updateDepartment: (oldDept: string, newDept: string) => void;
}

const DepartmentContext = createContext<DepartmentContextType | undefined>(undefined);

export function DepartmentProvider({ children }: { children: React.ReactNode }) {
  const [departments, setDepartments] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hrms_departments');
      if (saved) return JSON.parse(saved);
    }
    return initialDepartments;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('hrms_departments', JSON.stringify(departments));
    }
  }, [departments]);

  const addDepartment = (dept: string) => {
    if (!departments.includes(dept) && dept.trim() !== '') {
      setDepartments([...departments, dept.trim()]);
    }
  };

  const removeDepartment = (dept: string) => {
    setDepartments(departments.filter(d => d !== dept));
  };

  const updateDepartment = (oldDept: string, newDept: string) => {
    if (newDept.trim() === '') return;
    setDepartments(departments.map(d => (d === oldDept ? newDept.trim() : d)));
  };

  return (
    <DepartmentContext.Provider value={{ departments, addDepartment, removeDepartment, updateDepartment }}>
      {children}
    </DepartmentContext.Provider>
  );
}

export function useDepartments() {
  const context = useContext(DepartmentContext);
  if (context === undefined) {
    throw new Error('useDepartments must be used within a DepartmentProvider');
  }
  return context;
}
