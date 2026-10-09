import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { EMPLOYEES, Employee } from './employee-data';
import { ORG_DATA, OrgNodeData } from './org-data';
import { api } from '@/lib/api';
import { toast } from "@/lib/toast";

interface EmployeeContextType {
  employees: Employee[];
  treeData: OrgNodeData;
  isLoading: boolean;
  addEmployee: (employee: Partial<Employee>) => Promise<Employee>;
  updateEmployee: (id: string, updates: Partial<Employee>) => Promise<Employee>;
  fetchEmployeeById: (id: string) => Promise<Employee | null>;
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

  const role = w.system_role || "Employee";
  const employeeId = role === "Admin" ? "" : (be.employee_id || w.employee_id || (String(be.id || "").startsWith("EMP-") ? String(be.id) : ""));

  return {
    id: String(be._id || be.id),
    employeeId: employeeId,
    name: name,
    firstName: p.first_name || "",
    middleName: p.middle_name || "",
    lastName: p.last_name || "",
    email: p.email_address || "",
    phone: p.phone_number || "",
    password: p.password || "",
    dob: p.date_of_birth ? String(p.date_of_birth) : "",
    gender: p.gender || "Male",
    parentName: p.parent_guardian_name || "",
    parentNumber: p.contact_number || "",
    relation: p.relation || "",
    avatar: photo,
    profile_photo: photo,
    signature: be.signature || p.signature || be.signature_url || p.signature_url || (typeof window !== "undefined" ? (localStorage.getItem(`user_signature_${String(be._id || be.id)}`) || localStorage.getItem(`user_signature_${employeeId}`)) : "") || "",
    signature_url: be.signature || p.signature || be.signature_url || p.signature_url || (typeof window !== "undefined" ? (localStorage.getItem(`user_signature_${String(be._id || be.id)}`) || localStorage.getItem(`user_signature_${employeeId}`)) : "") || "",

    role: role,
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
    bondStartDate: e.bond_start_date ? String(e.bond_start_date) : (be.bondStartDate || ""),
    bondEndDate: e.bond_end_date ? String(e.bond_end_date) : (be.bondEndDate || ""),
    hasNoticePeriod: !!e.serving_notice_period,
    noticePeriodDays: e.notice_period_days ? String(e.notice_period_days) : (be.noticePeriodDays || ""),
    noticePeriodStartDate: e.notice_period_start_date ? String(e.notice_period_start_date) : (be.noticePeriodStartDate || ""),
    hasResignation: !!e.has_resigned,
    resignationDate: e.resignation_date ? String(e.resignation_date) : (be.resignationDate || ""),
    hasEmployment: !!e.has_employment || !!be.hasEmployment,
    employmentStartDate: e.employment_start_date ? String(e.employment_start_date) : (be.employmentStartDate || ""),
    contractStatus: (e.contract_status || be.contract_status || be.contractStatus || "Pending") as any,
    activelyUsingHRMS: !w.is_block && !w.is_delete,

    requiredDocuments: be.required_documents || be.requiredDocuments || (d ? Object.entries(d).filter(([_, v]) => v).map(([k]) => k.replace(/_/g, ' ')) : []),
    securityDepositExempt: be.security_deposit_exempt ?? be.securityDepositExempt ?? false,
    securityDepositDirectPayments: be.security_deposit_direct_payments || be.securityDepositDirectPayments || [],
    targetSecurityDeposit: be.target_security_deposit || be.targetSecurityDeposit || be.deposit_details?.deposit_amount,
    depositAmount: be.deposit_details?.amount_paid || be.deposit_details?.deposit_amount || be.depositAmount,
    depositPaid: be.deposit_details?.amount_paid || be.depositPaid || 0,
    depositStatus: be.deposit_details?.status || be.depositStatus || "Pending",
    depositPaymentDate: be.deposit_details?.payment_date ? String(be.deposit_details.payment_date) : (be.depositPaymentDate || ""),
    depositRemarks: be.deposit_details?.remarks || be.depositRemarks || ""
  };
}

// Helper to convert frontend Employee to backend EmployeeCreate payload
function mapEmployeeToBackendPayload(fe: Partial<Employee>) {
  const parts = (fe.name || "").trim().split(/\s+/);
  const firstName = (fe.firstName || parts[0] || "").trim();
  const lastName = (fe.lastName || (parts.length > 1 ? parts.slice(1).join(" ") : "")).trim();
  const photo = fe.profile_photo || fe.avatar || "";
  const sig = fe.signature || fe.signature_url || null;

  return {
    signature: sig,
    signature_url: sig,
    personal_info: {
      first_name: firstName,
      middle_name: fe.middleName ? fe.middleName.trim() : null,
      last_name: lastName,
      email_address: (fe.email || "").trim(),
      phone_number: (fe.phone || "").trim() || null,
      date_of_birth: fe.dob || null,
      gender: fe.gender || "Male",
      // Blank password = omit (no change). New-employee modal validates required.
      ...(fe.password && String(fe.password).trim() ? { password: String(fe.password).trim() } : {}),
      parent_guardian_name: fe.parentName ? fe.parentName.trim() : null,
      contact_number: fe.parentNumber ? fe.parentNumber.trim() : null,
      relation: fe.relation || null,
      profile_photo: photo || null,
      signature: sig,
      signature_url: sig
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
      bond_start_date: fe.bondStartDate || null,
      bond_end_date: fe.bondEndDate || null,
      serving_notice_period: !!fe.hasNoticePeriod,
      notice_period_days: fe.noticePeriodDays || null,
      notice_period_start_date: fe.noticePeriodStartDate || null,
      has_resigned: !!fe.hasResignation,
      resignation_date: fe.resignationDate || null,
      has_employment: !!fe.hasEmployment,
      employment_start_date: fe.employmentStartDate || null,
      contract_status: (fe as any).contractStatus || "Verified"
    },
    profile_photo: photo || null,
    required_documents: fe.requiredDocuments || [],
    security_deposit_exempt: fe.securityDepositExempt ?? false,
    security_deposit_direct_payments: fe.securityDepositDirectPayments || [],
    target_security_deposit: fe.targetSecurityDeposit || null,
    deposit_details: {
      deposit_type: fe.designation?.toLowerCase().includes("intern") || fe.role?.toLowerCase().includes("intern") ? "Intern" : "Employee",
      deposit_amount: fe.depositAmount || fe.targetSecurityDeposit || (fe.designation?.toLowerCase().includes("intern") ? 2000 : 10000),
      amount_paid: fe.depositPaid || 0,
      status: fe.depositStatus || "Pending",
      payment_date: fe.depositPaymentDate || null,
      remarks: fe.depositRemarks || null
    }
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
        showLoader: false,
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

  const addEmployee = async (employeeData: Partial<Employee>): Promise<Employee> => {
    const payload = mapEmployeeToBackendPayload(employeeData);
    const created = await api.post('/employees', payload, {
      showLoader: false,
      showErrorToast: true,
    });

    if (created) {
      const newEmp = mapBackendToEmployee(created);
      setEmployees(prev => [newEmp, ...prev]);
      toast.success("Employee created successfully!");
      return newEmp;
    }
    throw new Error("Failed to create employee.");
  };

  const updateEmployee = async (id: string, updates: Partial<Employee>): Promise<Employee> => {
    const existing = employees.find(e => e.id === id);
    const merged = { ...existing, ...updates };
    const payload = mapEmployeeToBackendPayload(merged);

    const updated = await api.put(`/employees/${id}`, payload, {
      showLoader: false,
      showErrorToast: true,
    });

    if (updated) {
      const updatedEmp = mapBackendToEmployee(updated);
      setEmployees(prev => prev.map(emp => emp.id === id ? updatedEmp : emp));
      toast.success("Employee updated successfully!");
      return updatedEmp;
    }
    throw new Error("Failed to update employee.");
  };

  // Single record fetch (self record ma password pan aave — backend fakt self ne aape).
  const fetchEmployeeById = useCallback(async (id: string): Promise<Employee | null> => {
    try {
      const be = await api.get<any>(`/employees/${id}`, {
        showLoader: false,
        showErrorToast: false,
      });
      if (be && (be._id || be.id)) return mapBackendToEmployee(be);
      return null;
    } catch {
      return null;
    }
  }, []);

  const deleteEmployee = async (id: string) => {
    await api.delete(`/employees/${id}`, {
      showLoader: true,
      showErrorToast: true,
    });
    setEmployees(prev => prev.filter(emp => emp.id !== id));
    toast.success("Employee removed from company records.");

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
      fetchEmployeeById,
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
