import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AVAILABLE_DEPARTMENTS as initialDepartments } from './employee-data';
import { api } from '@/lib/api';

export interface DepartmentItem {
  id: string;
  name: string;
}

interface DepartmentContextType {
  departments: string[];
  departmentItems: DepartmentItem[];
  isLoading: boolean;
  addDepartment: (dept: string) => Promise<void> | void;
  removeDepartment: (dept: string) => Promise<void> | void;
  updateDepartment: (oldDept: string, newDept: string) => Promise<void> | void;
  refreshDepartments: () => Promise<void>;
}

const DepartmentContext = createContext<DepartmentContextType | undefined>(undefined);

export function DepartmentProvider({ children }: { children: React.ReactNode }) {
  const [departments, setDepartments] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hrms_departments');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch {
          // ignore
        }
      }
    }
    return initialDepartments;
  });

  const [departmentItems, setDepartmentItems] = useState<DepartmentItem[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hrms_department_items');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // ignore
        }
      }
    }
    return [];
  });

  const [isLoading, setIsLoading] = useState(false);
  const isFetchingRef = useRef(false);

  const fetchDepartments = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      setIsLoading(true);
      const json = await api.get<{ data?: any[]; total?: number }>('/departments?page=1&limit=100', {
        showLoader: false,
        showErrorToast: false,
      });

      const list = Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []);
      if (list && list.length > 0) {
        const items: DepartmentItem[] = list.map((item: any) => ({
          id: String(item._id || item.id || ''),
          name: typeof item === 'string' ? item : item.name || '',
        })).filter(item => Boolean(item.name));

        const names = Array.from(new Set(items.map(item => item.name)));
        
        if (names.length > 0) {
          setDepartments(names);
          setDepartmentItems(items);
          if (typeof window !== 'undefined') {
            localStorage.setItem('hrms_departments', JSON.stringify(names));
            localStorage.setItem('hrms_department_items', JSON.stringify(items));
          }
        }
      }
    } catch (err) {
      console.warn("Backend department fetch fallback to local storage:", err);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('hrms_departments', JSON.stringify(departments));
    }
  }, [departments]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('hrms_department_items', JSON.stringify(departmentItems));
    }
  }, [departmentItems]);

  const addDepartment = async (dept: string) => {
    const trimmed = dept.trim();
    if (!trimmed) return;
    
    // Check if department already exists (case-insensitive)
    if (departments.some(d => d.toLowerCase() === trimmed.toLowerCase())) {
      return;
    }

    // Optimistic UI update
    setDepartments(prev => [...prev, trimmed]);

    try {
      const res = await api.post<{ _id?: string; id?: string; name: string }>('/departments', { name: trimmed }, {
        showLoader: false,
        showErrorToast: false,
      });
      const newId = String(res?._id || res?.id || `dept-${Date.now()}`);
      setDepartmentItems(prev => [...prev, { id: newId, name: trimmed }]);
    } catch (err) {
      console.warn("Error creating department in backend:", err);
      // Still keep locally
      setDepartmentItems(prev => [...prev, { id: `dept-${Date.now()}`, name: trimmed }]);
    }
  };

  const removeDepartment = async (dept: string) => {
    const itemToDelete = departmentItems.find(d => d.name.toLowerCase() === dept.toLowerCase());
    
    // Optimistic UI update
    setDepartments(prev => prev.filter(d => d.toLowerCase() !== dept.toLowerCase()));
    setDepartmentItems(prev => prev.filter(d => d.name.toLowerCase() !== dept.toLowerCase()));

    if (itemToDelete?.id && !itemToDelete.id.startsWith('dept-')) {
      try {
        await api.delete(`/departments/${itemToDelete.id}`, {
          showLoader: false,
          showErrorToast: false,
        });
      } catch (err) {
        console.warn("Error deleting department in backend:", err);
      }
    }
  };

  const updateDepartment = async (oldDept: string, newDept: string) => {
    const trimmed = newDept.trim();
    if (!trimmed || trimmed.toLowerCase() === oldDept.toLowerCase()) return;

    const itemToUpdate = departmentItems.find(d => d.name.toLowerCase() === oldDept.toLowerCase());

    // Optimistic UI update
    setDepartments(prev => prev.map(d => (d.toLowerCase() === oldDept.toLowerCase() ? trimmed : d)));
    setDepartmentItems(prev => prev.map(d => (d.name.toLowerCase() === oldDept.toLowerCase() ? { ...d, name: trimmed } : d)));

    if (itemToUpdate?.id && !itemToUpdate.id.startsWith('dept-')) {
      try {
        await api.put(`/departments/${itemToUpdate.id}`, { name: trimmed }, {
          showLoader: false,
          showErrorToast: false,
        });
      } catch (err) {
        console.warn("Error updating department in backend:", err);
      }
    }
  };

  return (
    <DepartmentContext.Provider value={{
      departments,
      departmentItems,
      isLoading,
      addDepartment,
      removeDepartment,
      updateDepartment,
      refreshDepartments: fetchDepartments
    }}>
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
