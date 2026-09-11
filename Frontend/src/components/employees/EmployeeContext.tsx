import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { EMPLOYEES, Employee } from './employee-data';
import { ORG_DATA, OrgNodeData } from './org-data';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface EmployeeContextType {
  employees: Employee[];
  treeData: OrgNodeData;
  isLoading: boolean;
  addEmployee: (employee: Partial<Employee>) => Promise<void>;
  updateEmployee: (id: string, updates: Partial<Employee>) => Promise<void>;
  deleteEmployee: (id: string) => Promise<void>;
  refreshEmployees: () => Promise<void>;
  updateTree: (newTree: OrgNodeData) => void;
}

const EmployeeContext = createContext<EmployeeContextType | undefined>(undefined);

// Helper to convert backend JSON structure to frontend Employee model
function mapBackendToEmployee(be: any): Employee {
  const p = be.personal_info || {};
  const w = be.work_details || {};
  const b = be.bank_and_docs || {};
  const d = be.document_checklist || {};
  const e = be.bond_and_exit || {};

  const name = [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(" ") || "Unnamed Employee";
  const photo = be.profile_photo || p.profile_photo || be.avatar || "";

  return {
    id: String(be._id || be.id),
    name: name,
    firstName: p.first_name || "",
    middleName: p.middle_name || "",
    lastName: p.last_name || "",
    email: p.email_address || "",
    phone: p.phone_number || "",
    dob: p.date_of_birth ? String(p.date_of_birth) : "",
    gender: p.gender || "Male",
    parentName: p.parent_guardian_name || "",
    parentNumber: p.contact_number || "",
    relation: p.relation || "",
    avatar: photo,
    profile_photo: photo,

    role: w.system_role || "Employee",
    department: w.department || "Development",
    sub_department: w.sub_department || "",
    designation: w.designation || "",
    status: w.is_block ? "Inactive" : "Active",
    workMode: w.work_mode || "WFO",
    joinDate: w.joining_date ? String(w.joining_date) : "",
    startTime: w.start_time ? String(w.start_time) : "09:30",
    endTime: w.end_time ? String(w.end_time) : "18:30",
    performanceScore: 85,

    salary: b.monthly_salary !== undefined && b.monthly_salary !== null ? String(b.monthly_salary) : "",
    upiId: b.upi_id || "",
    accountHolderName: b.account_holder_name || "",
    accountNumber: b.account_number || "",
    bankName: b.bank_name || "",
    ifscCode: b.ifsc_code || "",
    aadharCard: b.aadhar_card_number || "",
    panCard: b.pan_card_number || "",

    hasBond: !!e.has_active_bond,
    hasNoticePeriod: !!e.serving_notice_period,
    hasResignation: !!e.has_resigned,
    activelyUsingHRMS: !w.is_block && !w.is_delete
  };
}

// Helper to convert frontend Employee to backend EmployeeCreate payload
function mapEmployeeToBackendPayload(fe: Partial<Employee>) {
  const parts = (fe.name || "").trim().split(/\s+/);
  const firstName = fe.firstName || parts[0] || "Employee";
  const lastName = fe.lastName || (parts.length > 1 ? parts.slice(1).join(" ") : "User");
  const photo = fe.profile_photo || fe.avatar || "";

  return {
    personal_info: {
      first_name: firstName,
      middle_name: fe.middleName || null,
      last_name: lastName,
      email_address: fe.email || `emp_${Date.now()}@hrms.com`,
      phone_number: fe.phone || null,
      date_of_birth: fe.dob || null,
      gender: fe.gender || "Male",
      password: fe.password || "Password@123",
      parent_guardian_name: fe.parentName || null,
      contact_number: fe.parentNumber || null,
      relation: fe.relation || null,
      profile_photo: photo || null
    },
    work_details: {
      system_role: fe.role || "Employee",
      department: fe.department || "Development",
      sub_department: fe.sub_department || null,
      designation: fe.designation || null,
      is_delete: false,
      is_block: fe.status === "Inactive",
      work_mode: fe.workMode || "WFO",
      joining_date: fe.joinDate || null,
      start_time: fe.startTime ? (fe.startTime.length === 5 ? `${fe.startTime}:00` : fe.startTime) : null,
      end_time: fe.endTime ? (fe.endTime.length === 5 ? `${fe.endTime}:00` : fe.endTime) : null
    },
    bank_and_docs: {
      monthly_salary: fe.salary ? parseFloat(String(fe.salary)) : null,
      upi_id: fe.upiId || null,
      bank_name: fe.bankName || null,
      account_holder_name: fe.accountHolderName || null,
      account_number: fe.accountNumber || null,
      ifsc_code: fe.ifscCode || null,
      aadhar_card_number: fe.aadharCard || null,
      pan_card_number: fe.panCard || null
    },
    document_checklist: {
      marksheet_10th: false,
      marksheet_12th: false,
      degree_certificate: false,
      aadhar_card: !!fe.aadharCard,
      pan_card: !!fe.panCard,
      experience_letter: false,
      relieving_letter: false,
      payslip_3_months: false,
      passport_size_photo: !!photo,
      bank_passbook_or_cheque: false
    },
    bond_and_exit: {
      has_active_bond: !!fe.hasBond,
      serving_notice_period: !!fe.hasNoticePeriod,
      has_resigned: !!fe.hasResignation
    },
    profile_photo: photo || null
  };
}

export function EmployeeProvider({ children }: { children: React.ReactNode }) {
  const [employees, setEmployees] = useState<Employee[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hrms_employees');
      if (saved) return JSON.parse(saved);
    }
    return EMPLOYEES;
  });

  const [isLoading, setIsLoading] = useState(false);

  const [treeData, setTreeData] = useState<OrgNodeData>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hrms_org_tree');
      if (saved) return JSON.parse(saved);
    }
    return ORG_DATA;
  });

  const isFetchingRef = useRef(false);

  const fetchEmployeesFromBackend = useCallback(async () => {
    // Prevent duplicate parallel or strict mode double fetching
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      setIsLoading(true);
      const json = await api.get<{ data?: any[]; total?: number }>('/employees', {
        showLoader: true,
        showErrorToast: false,
      });

      const list = Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []);
      if (list && list.length > 0) {
        const mapped = list.map(mapBackendToEmployee);
        setEmployees(mapped);
      }
    } catch (err) {
      console.warn("Backend employee fetch fallback to local storage:", err);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchEmployeesFromBackend();
  }, [fetchEmployeesFromBackend]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('hrms_employees', JSON.stringify(employees));
    }
  }, [employees]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('hrms_org_tree', JSON.stringify(treeData));
    }
  }, [treeData]);

  const addEmployee = async (employeeData: Partial<Employee>) => {
    try {
      const payload = mapEmployeeToBackendPayload(employeeData);
      const created = await api.post('/employees', payload, {
        showLoader: true,
        showErrorToast: true,
      });

      if (created) {
        const newEmp = mapBackendToEmployee(created);
        setEmployees(prev => [newEmp, ...prev]);
        toast.success("Employee created successfully!");
        return;
      }
    } catch (err) {
      console.error("Failed to add employee via API, adding locally:", err);
    }

    // Local fallback if API fails
    const localEmp: Employee = {
      ...employeeData,
      id: employeeData.id || `EMP-${Date.now()}`,
      name: employeeData.name || "New Employee",
      role: employeeData.role || "Employee",
      department: employeeData.department || "Development",
      status: employeeData.status || "Active",
      email: employeeData.email || "",
      phone: employeeData.phone || "",
      joinDate: employeeData.joinDate || new Date().toISOString().split("T")[0] || "",
      avatar: employeeData.avatar || employeeData.profile_photo || "",
      performanceScore: employeeData.performanceScore || 85
    } as Employee;
    setEmployees(prev => [localEmp, ...prev]);
    toast.success("Employee saved locally!");
  };

  const updateEmployee = async (id: string, updates: Partial<Employee>) => {
    try {
      const existing = employees.find(e => e.id === id);
      const merged = { ...existing, ...updates };
      const payload = mapEmployeeToBackendPayload(merged);

      const updated = await api.put(`/employees/${id}`, payload, {
        showLoader: true,
        showErrorToast: true,
      });

      if (updated) {
        const updatedEmp = mapBackendToEmployee(updated);
        setEmployees(prev => prev.map(emp => emp.id === id ? updatedEmp : emp));
        toast.success("Employee updated successfully!");
        return;
      }
    } catch (err) {
      console.error("Failed to update employee via API, updating locally:", err);
    }

    setEmployees(prev => prev.map(emp => emp.id === id ? { ...emp, ...updates } : emp));
    toast.success("Employee updated locally!");
  };

  const deleteEmployee = async (id: string) => {
    try {
      await api.delete(`/employees/${id}`, {
        showLoader: true,
        showErrorToast: true,
      });
      toast.success("Employee deleted successfully!");
    } catch (err) {
      console.error("Failed to delete employee via API:", err);
    }

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
    <EmployeeContext.Provider value={{
      employees,
      treeData,
      isLoading,
      addEmployee,
      updateEmployee,
      deleteEmployee,
      refreshEmployees: fetchEmployeesFromBackend,
      updateTree
    }}>
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
