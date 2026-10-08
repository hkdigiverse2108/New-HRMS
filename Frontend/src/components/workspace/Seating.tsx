"use client";
import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Package, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApi } from "@/hooks/useApi";
import { useUser } from "@/hooks/useUser";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/lib/toast";
import { API_URL, getAvatarUrl, handleAvatarError } from "@/lib/config";
import { DeleteConfirmDialog } from "@/components/hrms/delete-confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { hasModulePermission, isUserAdmin } from "@/lib/permissions";
import { api } from "@/lib/api";

interface Seat {
  id: string;
  x: number;
  available: boolean;
  assignedEmployeeId: string;
}

interface PC {
  id: string;
  x: number;
  y: number;
}

interface Desk {
  id: number;
  name: string;
  floor?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  topSeats: Seat[];
  bottomSeats: Seat[];
  pcs?: PC[] | undefined;
}

const defaultDesks: Desk[] = [
  {
    id: 1, name: "Desk 1", x: 5, y: 15, width: 35, height: 15,
    topSeats: [
      { id: 't1', x: 10, available: true, assignedEmployeeId: "" },
      { id: 't2', x: 30, available: true, assignedEmployeeId: "" },
      { id: 't3', x: 50, available: true, assignedEmployeeId: "" },
      { id: 't4', x: 70, available: true, assignedEmployeeId: "" },
      { id: 't5', x: 90, available: true, assignedEmployeeId: "" },
    ],
    bottomSeats: [
      { id: 'b1', x: 10, available: true, assignedEmployeeId: "" },
      { id: 'b2', x: 30, available: true, assignedEmployeeId: "" },
      { id: 'b3', x: 50, available: true, assignedEmployeeId: "" },
      { id: 'b4', x: 70, available: true, assignedEmployeeId: "" },
      { id: 'b5', x: 90, available: true, assignedEmployeeId: "" },
    ],
    pcs: [
      { id: 'pc1', x: 20, y: 10 },
      { id: 'pc2', x: 80, y: 70 }
    ]
  },
  {
    id: 2, name: "Desk 2", x: 5, y: 40, width: 35, height: 15,
    topSeats: [
      { id: 't1', x: 10, available: true, assignedEmployeeId: "" },
      { id: 't2', x: 30, available: true, assignedEmployeeId: "" },
      { id: 't3', x: 50, available: true, assignedEmployeeId: "" },
      { id: 't4', x: 70, available: true, assignedEmployeeId: "" },
      { id: 't5', x: 90, available: true, assignedEmployeeId: "" },
    ],
    bottomSeats: [
      { id: 'b1', x: 10, available: true, assignedEmployeeId: "" },
      { id: 'b2', x: 30, available: true, assignedEmployeeId: "" },
      { id: 'b3', x: 50, available: true, assignedEmployeeId: "" },
      { id: 'b4', x: 70, available: true, assignedEmployeeId: "" },
      { id: 'b5', x: 90, available: true, assignedEmployeeId: "" },
    ],
    pcs: [
      { id: 'pc1', x: 20, y: 10 },
      { id: 'pc2', x: 80, y: 70 }
    ]
  },
  {
    id: 3, name: "Desk 3", x: 5, y: 65, width: 35, height: 15,
    topSeats: [
      { id: 't1', x: 10, available: true, assignedEmployeeId: "" },
      { id: 't2', x: 30, available: true, assignedEmployeeId: "" },
      { id: 't3', x: 50, available: true, assignedEmployeeId: "" },
      { id: 't4', x: 70, available: true, assignedEmployeeId: "" },
      { id: 't5', x: 90, available: true, assignedEmployeeId: "" },
    ],
    bottomSeats: [
      { id: 'b1', x: 10, available: true, assignedEmployeeId: "" },
      { id: 'b2', x: 30, available: true, assignedEmployeeId: "" },
      { id: 'b3', x: 50, available: true, assignedEmployeeId: "" },
      { id: 'b4', x: 70, available: true, assignedEmployeeId: "" },
      { id: 'b5', x: 90, available: true, assignedEmployeeId: "" },
    ],
    pcs: [
      { id: 'pc1', x: 20, y: 10 },
      { id: 'pc2', x: 80, y: 70 }
    ]
  },
  {
    id: 4, name: "Desk 4", x: 50, y: 15, width: 35, height: 15,
    topSeats: [
      { id: 't1', x: 10, available: true, assignedEmployeeId: "" },
      { id: 't2', x: 30, available: true, assignedEmployeeId: "" },
      { id: 't3', x: 50, available: true, assignedEmployeeId: "" },
      { id: 't4', x: 70, available: true, assignedEmployeeId: "" },
      { id: 't5', x: 90, available: true, assignedEmployeeId: "" },
    ],
    bottomSeats: [
      { id: 'b1', x: 10, available: true, assignedEmployeeId: "" },
      { id: 'b2', x: 30, available: true, assignedEmployeeId: "" },
      { id: 'b3', x: 50, available: true, assignedEmployeeId: "" },
      { id: 'b4', x: 70, available: true, assignedEmployeeId: "" },
      { id: 'b5', x: 90, available: true, assignedEmployeeId: "" },
    ],
    pcs: [
      { id: 'pc1', x: 20, y: 10 },
      { id: 'pc2', x: 80, y: 70 }
    ]
  },
  {
    id: 5, name: "Desk 5", x: 50, y: 40, width: 35, height: 15,
    topSeats: [
      { id: 't1', x: 10, available: true, assignedEmployeeId: "" },
      { id: 't2', x: 30, available: true, assignedEmployeeId: "" },
      { id: 't3', x: 50, available: true, assignedEmployeeId: "" },
      { id: 't4', x: 70, available: true, assignedEmployeeId: "" },
      { id: 't5', x: 90, available: true, assignedEmployeeId: "" },
    ],
    bottomSeats: [
      { id: 'b1', x: 10, available: true, assignedEmployeeId: "" },
      { id: 'b2', x: 30, available: true, assignedEmployeeId: "" },
      { id: 'b3', x: 50, available: true, assignedEmployeeId: "" },
      { id: 'b4', x: 70, available: true, assignedEmployeeId: "" },
      { id: 'b5', x: 90, available: true, assignedEmployeeId: "" },
    ],
    pcs: [
      { id: 'pc1', x: 20, y: 10 },
      { id: 'pc2', x: 80, y: 70 }
    ]
  }
];

const getSeatEmployee = (seat: any, employees: any[], deskId: number, allDesks: any[]) => {
  if (seat.available) return null;
  if (!employees || employees.length === 0) return null;

  // Extract any assigned employee identifier or object from seat
  const assignedTarget = 
    seat.assignedEmployeeId || 
    seat.assigned_employee_id || 
    (typeof seat.assigned_to === 'object' ? seat.assigned_to?.employee_id || seat.assigned_to?.id || seat.assigned_to?._id : seat.assigned_to) || 
    (typeof seat.assignedEmployee === 'object' ? seat.assignedEmployee?.id || seat.assignedEmployee?._id : seat.assignedEmployee) || 
    "";

  const assignedStr = String(assignedTarget).trim();

  // If there's an explicit custom allotment, use robust matching across all employee identifiers
  if (assignedStr) {
    const targetLower = assignedStr.toLowerCase();
    const found = employees.find(emp => {
      const empId = String(emp.id || emp._id || "").trim();
      const empCode = String(emp.employeeCode || emp.employee_id || emp.work_details?.employee_id || "").trim();
      const empEmail = String(emp.email || "").toLowerCase().trim();
      const empName = String(emp.name || emp.full_name || `${emp.firstName || ''} ${emp.lastName || ''}`).toLowerCase().trim();
      
      return (
        (empId && empId === assignedStr) ||
        (empCode && empCode === assignedStr) ||
        (empEmail && empEmail === targetLower) ||
        (empName && empName === targetLower)
      );
    });

    if (found) return found;

    // Fallback: If seat.assigned_to is an object with name/details directly on the seat
    if (typeof seat.assigned_to === 'object' && seat.assigned_to !== null) {
      const seatEmp = seat.assigned_to;
      return {
        id: String(seatEmp.employee_id || seatEmp.id || seatEmp._id || assignedStr),
        _id: String(seatEmp.employee_id || seatEmp.id || seatEmp._id || assignedStr),
        name: seatEmp.full_name || seatEmp.name || "Employee",
        employeeCode: seatEmp.employee_id || "",
        employee_id: seatEmp.employee_id || "",
        designation: seatEmp.designation || "",
        department: seatEmp.department || "",
        email: seatEmp.email || "",
        avatar: seatEmp.profile_photo || seatEmp.avatar || ""
      };
    }
  }

  // Otherwise, fallback to a unique deterministic assignment
  // Gather all allocated seats (available === false) that do NOT have a custom assignedEmployeeId
  // and map them in a stable order to the remaining unused employees.
  
  // 1. Find all custom assigned employee IDs
  const customAssignedIds = new Set<string>();
  allDesks.forEach(d => {
    d.topSeats.forEach((s: any) => {
      if (s.assignedEmployeeId) customAssignedIds.add(String(s.assignedEmployeeId));
    });
    d.bottomSeats.forEach((s: any) => {
      if (s.assignedEmployeeId) customAssignedIds.add(String(s.assignedEmployeeId));
    });
  });

  // 2. Filter employees to only get the ones who are not custom assigned
  const availableEmployees = employees.filter(emp => !customAssignedIds.has(String(emp.id)) && !customAssignedIds.has(String(emp._id)));
  if (availableEmployees.length === 0) return null;

  // 3. Find all fallback seats (available === false, no assignedEmployeeId)
  // in a stable sorted order: deskId ASC, top/bottom, seatId ASC
  const fallbackSeats: { deskId: number; seatId: string; isTop: boolean }[] = [];
  allDesks.forEach(d => {
    d.topSeats.forEach((s: any) => {
      if (!s.available && !s.assignedEmployeeId) {
        fallbackSeats.push({ deskId: d.id, seatId: s.id, isTop: true });
      }
    });
    d.bottomSeats.forEach((s: any) => {
      if (!s.available && !s.assignedEmployeeId) {
        fallbackSeats.push({ deskId: d.id, seatId: s.id, isTop: false });
      }
    });
  });

  // 4. Find the index of the current seat in the list of fallback seats
  const isTop = seat.id.startsWith('t');
  const seatIndex = fallbackSeats.findIndex(fs => fs.deskId === deskId && fs.seatId === seat.id && fs.isTop === isTop);
  
  return availableEmployees[seatIndex] || null;
};

const updateSeatsCount = (prefix: 't' | 'b', count: number, currentSeats: any[]) => {
  const newSeats = [];
  for (let i = 0; i < count; i++) {
    const id = `${prefix}${i + 1}`;
    const existingSeat = currentSeats.find(s => s.id === id) || { available: true, assignedEmployeeId: "" };
    
    let xVal = 50;
    if (count > 1) {
      xVal = Math.round(10 + (80 * i) / (count - 1));
    }
    
    newSeats.push({
      ...existingSeat,
      id,
      x: xVal
    });
  }
  return newSeats;
};

const getEmployeeResources = (employee: any, inventoryList: any[], legacyAssets: any[]) => {
  if (!employee) return [];
  const empId = String(employee.id || employee._id || "").toLowerCase();
  const empCode = String(employee.employeeCode || "").toLowerCase();
  const empName = (employee.name || `${employee.firstName || ''} ${employee.lastName || ''}`).trim().toLowerCase();

  const invAssets = (inventoryList || []).filter(item => {
    if (!item.assigned_to) return false;
    
    if (typeof item.assigned_to === "object" && item.assigned_to !== null) {
      const objId = String(item.assigned_to._id || item.assigned_to.id || item.assigned_to.employee_id || "").toLowerCase();
      const objName = (item.assigned_to.full_name || item.assigned_to.name || `${item.assigned_to.first_name || ""} ${item.assigned_to.last_name || ""}`).trim().toLowerCase();
      if (empId && objId === empId) return true;
      if (empName && objName === empName) return true;
    } else if (typeof item.assigned_to === "string") {
      const strVal = item.assigned_to.trim().toLowerCase();
      if (empId && strVal === empId) return true;
      if (empCode && strVal === empCode) return true;
      if (empName && strVal === empName) return true;
    }
    return false;
  }).map(item => ({
    id: item._id || item.id || item.resource_id,
    name: item.category_name || "Physical Resource",
    assetId: item.resource_id || item.condition || "Assigned"
  }));

  if (invAssets.length > 0) return invAssets;

  return (legacyAssets || []).filter(asset => {
    if (!asset.assignedTo) return false;
    return asset.assignedTo.toLowerCase() === empName;
  }).map(asset => ({
    id: asset.id || asset.assetId,
    name: asset.name || "Asset",
    assetId: asset.assetId || "Assigned"
  }));
};



const sanitizeDesks = (desks: any[]): Desk[] => {
  return desks.map(d => {
    let pcs = d.pcs;
    if (!pcs) {
      pcs = [
        { id: `pc-${d.id}-1`, x: 20, y: 10 },
        { id: `pc-${d.id}-2`, x: 80, y: 70 }
      ];
    }
    return {
      ...d,
      floor: d.floor || "Floor 1",
      pcs
    };
  });
};

export default function SeatingArrangementPage() {
  const { data, isLoading } = useApi();
  const { user } = useUser();
  const [desksState, setDesksState] = useState<Desk[]>(sanitizeDesks(defaultDesks));
  const [floors, setFloors] = useState<string[]>(['Floor 1']);
  const [activeFloor, setActiveFloor] = useState<string>('Floor 1');
  const [isAddFloorOpen, setIsAddFloorOpen] = useState(false);
  const [newFloorName, setNewFloorName] = useState("");

  // Layout Editor states
  const [isLayoutEditMode, setIsLayoutEditMode] = useState(false);
  const [selectedDeskForEdit, setSelectedDeskForEdit] = useState<any | null>(null);
  const [backupDesks, setBackupDesks] = useState<any[] | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  
  // Reusable confirmation dialog states
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmDescription, setConfirmDescription] = useState("");
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);

  const triggerConfirm = (title: string, description: string, onConfirm: () => void) => {
    setConfirmTitle(title);
    setConfirmDescription(description);
    setConfirmAction(() => onConfirm);
    setConfirmOpen(true);
  };
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const savedSeating = localStorage.getItem("workspace_seating_arrangement");
    if (savedSeating) {
      try {
        setDesksState(sanitizeDesks(JSON.parse(savedSeating)));
      } catch (e) {
        console.error("Failed to parse seating layout from localStorage", e);
      }
    }
  }, []);
  
  // Drag states
  const [draggedDeskId, setDraggedDeskId] = useState<number | null>(null);
  const [draggedPc, setDraggedPc] = useState<{ deskId: number; pcId: string } | null>(null);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [dragStartPercent, setDragStartPercent] = useState({ x: 0, y: 0 });
  const [dragPcStartPercent, setDragPcStartPercent] = useState({ x: 0, y: 0 });
  const [hasDraggedDesk, setHasDraggedDesk] = useState(false);

  const [selectedSeat, setSelectedSeat] = useState<{ deskId: number; seatId: string; isTop: boolean } | null>(null);
  const [modalStatus, setModalStatus] = useState<"available" | "allocated">("available");
  const [modalEmployeeId, setModalEmployeeId] = useState<string>("");
  const [realEmployees, setRealEmployees] = useState<any[]>([]);
  const [allocatedResources, setAllocatedResources] = useState<any[]>([]);

  useEffect(() => {
    const fetchEmployeesAndResources = async () => {
      try {
        const [empRes, invRes] = await Promise.all([
          api.get("/employees?page=1&limit=100", { showLoader: false, showErrorToast: false }),
          api.get("/resource-inventory?page=1&limit=100", { showLoader: false, showErrorToast: false })
        ]);
        const emps = empRes?.items || empRes?.data || (Array.isArray(empRes) ? empRes : []);
        const invs = invRes?.items || invRes?.data || (Array.isArray(invRes) ? invRes : []);

        const mappedEmps = emps.map((emp: any) => {
          const pi = emp.personal_info || {};
          const ci = emp.contact_info || {};
          const wd = emp.work_details || {};
          const fullName = (
            pi.full_name || 
            ci.full_name || 
            emp.full_name || 
            emp.name || 
            `${pi.first_name || ci.first_name || emp.firstName || ""} ${pi.last_name || ci.last_name || emp.lastName || ""}`
          ).trim() || "Employee";

          const code = wd.employee_id || emp.employee_id || emp.employeeCode || "";
          const desig = wd.designation || emp.designation || "";
          const dept = wd.department || emp.department || "";
          const email = ci.email || pi.email || emp.email || "";

          return {
            id: String(emp._id || emp.id),
            _id: String(emp._id || emp.id),
            employee_id: code,
            employeeId: code,
            employeeCode: code,
            name: fullName,
            full_name: fullName,
            designation: desig,
            department: dept,
            email: email,
            avatar: emp.profile_photo || pi.profile_photo || ci.profile_photo || ""
          };
        });
        setRealEmployees(mappedEmps);
        setAllocatedResources(invs);
      } catch (err) {
        console.error("Failed to fetch employees and resources for seating:", err);
      }
    };

    fetchEmployeesAndResources();
  }, []);

  const anyUser = user as any;
  const userRole = String(anyUser?.role || anyUser?.work_details?.system_role || "Employee").toLowerCase();
  const userDept = String(anyUser?.department || anyUser?.work_details?.department || "").toLowerCase();
  const userDesig = String(anyUser?.designation || anyUser?.work_details?.designation || "").toLowerCase();

  const isAdminOrHR = 
    isUserAdmin(user) ||
    userRole === "admin" || 
    userRole === "superadmin" || 
    userRole === "hr" || 
    userRole === "subadmin" ||
    userDept === "hr" ||
    userDesig.includes("hr") ||
    hasModulePermission(user, "/workspace/seating", "update") ||
    hasModulePermission(user, "/workspace", "all");

  useEffect(() => {
    // Fetch seating arrangement from global database for all-employee sync
    const fetchSeatingArrangement = async () => {
      // Pause updating state if admin has selection/modal active or editing layout
      if (selectedSeat !== null || isLayoutEditMode) return;

      try {
        const resJson = await api.get("/seating-arrangement", { showLoader: false, showErrorToast: false });
        if (resJson && resJson.desks && Array.isArray(resJson.desks) && resJson.desks.length > 0) {
          setDesksState(sanitizeDesks(resJson.desks));
          localStorage.setItem("workspace_seating_arrangement", JSON.stringify(resJson.desks));
          return;
        }
      } catch (error) {
        console.error("Failed to load seating arrangement from global database", error);
      }

      // LocalStorage fallback
      const savedSeating = localStorage.getItem("workspace_seating_arrangement");
      if (savedSeating) {
        try {
          setDesksState(sanitizeDesks(JSON.parse(savedSeating)));
        } catch (e) {
          console.error("Failed to parse seating layout from localStorage", e);
        }
      }
    };

    fetchSeatingArrangement();

    const interval = setInterval(fetchSeatingArrangement, 4000);
    return () => clearInterval(interval);
  }, [selectedSeat, isLayoutEditMode]);

  const handleSeatClick = (deskId: number, seatId: string, isTop: boolean) => {
    if (!isAdminOrHR) {
      toast.error("Access Denied: Only Admins or HR can edit the seating arrangement.");
      return;
    }

    const desk = desksState.find(d => d.id === deskId);
    const seatsKey = isTop ? 'topSeats' : 'bottomSeats';
    const seat = desk?.[seatsKey].find(s => s.id === seatId);

    setSelectedSeat({ deskId, seatId, isTop });
    setModalStatus(seat?.available ? "available" : "allocated");
    setModalEmployeeId(seat?.assignedEmployeeId || "");
  };

  const saveLayout = async (updatedDesks: any[]) => {
    localStorage.setItem("workspace_seating_arrangement", JSON.stringify(updatedDesks));
    try {
      await api.post("/seating-arrangement", { desks: updatedDesks }, { showLoader: false, showErrorToast: false });
    } catch (err) {
      console.error("Failed to save seating arrangement to database", err);
    }
  };

  const handleAddDesk = () => {
    if (!isAdminOrHR) {
      toast.error("Access Denied: Only Admins or HR can add tables.");
      return;
    }
    const newId = Date.now();
    const newDesk = {
      id: newId,
      name: `Desk ${desksState.length + 1}`,
      floor: activeFloor,
      x: 10,
      y: 10,
      width: 35,
      height: 15,
      topSeats: [
        { id: 't1', x: 10, available: true, assignedEmployeeId: "" },
        { id: 't2', x: 30, available: true, assignedEmployeeId: "" },
        { id: 't3', x: 50, available: true, assignedEmployeeId: "" },
        { id: 't4', x: 70, available: true, assignedEmployeeId: "" },
        { id: 't5', x: 90, available: true, assignedEmployeeId: "" },
      ],
      bottomSeats: [
        { id: 'b1', x: 10, available: true, assignedEmployeeId: "" },
        { id: 'b2', x: 30, available: true, assignedEmployeeId: "" },
        { id: 'b3', x: 50, available: true, assignedEmployeeId: "" },
        { id: 'b4', x: 70, available: true, assignedEmployeeId: "" },
        { id: 'b5', x: 90, available: true, assignedEmployeeId: "" },
      ],
      pcs: [
        { id: `pc-${newId}-1`, x: 20, y: 10 },
        { id: `pc-${newId}-2`, x: 80, y: 70 }
      ]
    };
    const updatedDesks = [...desksState, newDesk];
    setDesksState(updatedDesks);
    saveLayout(updatedDesks);
    setBackupDesks(JSON.parse(JSON.stringify(updatedDesks)));
    setSelectedDeskForEdit(newDesk);
    toast.success("New desk added! Customise it below.");
  };

  const handleDeleteDesk = (deskId: number) => {
    if (!isAdminOrHR) {
      toast.error("Access Denied: Only Admins or HR can delete tables.");
      return;
    }
    const updatedDesks = desksState.filter(d => d.id !== deskId);
    setDesksState(updatedDesks);
    saveLayout(updatedDesks);
    setSelectedDeskForEdit(null);
    toast.success("Desk deleted successfully.");
  };

  const handleDeskMouseDown = (e: React.MouseEvent, deskId: number) => {
    if (!isAdminOrHR || !isLayoutEditMode) return;
    if (e.button !== 0) return; // left click only
    
    e.preventDefault();
    e.stopPropagation();
    
    const desk = desksState.find(d => d.id === deskId);
    if (!desk) return;
    
    setDraggedDeskId(deskId);
    setDragStartPos({ x: e.clientX, y: e.clientY });
    setDragStartPercent({ x: desk.x, y: desk.y });
    setHasDraggedDesk(false);
  };

  const handlePcMouseDown = (e: React.MouseEvent, deskId: number, pcId: string) => {
    if (!isLayoutEditMode) return;
    if (e.button !== 0) return; // left click only
    
    e.preventDefault();
    e.stopPropagation();
    
    const desk = desksState.find(d => d.id === deskId);
    const pc = desk?.pcs?.find(p => p.id === pcId);
    if (!desk || !pc) return;
    
    setDraggedPc({ deskId, pcId });
    setDragStartPos({ x: e.clientX, y: e.clientY });
    setDragPcStartPercent({ x: pc.x, y: pc.y });
    setHasDraggedDesk(false);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (draggedPc !== null) {
      const dx = e.clientX - dragStartPos.x;
      const dy = e.clientY - dragStartPos.y;
      
      const deskEl = document.getElementById(`desk-container-${draggedPc.deskId}`);
      if (!deskEl) return;
      
      const rect = deskEl.getBoundingClientRect();
      const dxPercent = (dx / rect.width) * 100;
      const dyPercent = (dy / rect.height) * 100;
      
      const desk = desksState.find(d => d.id === draggedPc.deskId);
      const pc = desk?.pcs?.find(p => p.id === draggedPc.pcId);
      if (!desk || !pc) return;
      
      let newX = dragPcStartPercent.x + dxPercent;
      let newY = dragPcStartPercent.y + dyPercent;
      
      newX = Math.max(0, Math.min(92, newX));
      newY = Math.max(0, Math.min(88, newY));
      
      setDesksState(prev => prev.map(d => {
        if (d.id === draggedPc.deskId) {
          return {
            ...d,
            pcs: d.pcs?.map(p => p.id === draggedPc.pcId ? { ...p, x: Math.round(newX * 10) / 10, y: Math.round(newY * 10) / 10 } : p)
          };
        }
        return d;
      }));
      return;
    }

    if (draggedDeskId === null || !canvasRef.current) return;
    
    const dx = e.clientX - dragStartPos.x;
    const dy = e.clientY - dragStartPos.y;
    
    if (Math.hypot(dx, dy) > 3) {
      setHasDraggedDesk(true);
    }
    
    const rect = canvasRef.current.getBoundingClientRect();
    const dxPercent = (dx / rect.width) * 100;
    const dyPercent = (dy / rect.height) * 100;
    
    const draggedDesk = desksState.find(d => d.id === draggedDeskId);
    if (!draggedDesk) return;
    
    let newX = dragStartPercent.x + dxPercent;
    let newY = dragStartPercent.y + dyPercent;
    
    newX = Math.max(0, Math.min(100 - draggedDesk.width, newX));
    newY = Math.max(0, Math.min(100 - draggedDesk.height, newY));
    
    setDesksState(prev => prev.map(d => {
      if (d.id === draggedDeskId) {
        return { ...d, x: Math.round(newX * 10) / 10, y: Math.round(newY * 10) / 10 };
      }
      return d;
    }));
  };

  const handleCanvasMouseUp = () => {
    if (draggedPc !== null) {
      setDraggedPc(null);
      saveLayout(desksState);
      return;
    }

    if (draggedDeskId !== null) {
      const clickedId = draggedDeskId;
      setDraggedDeskId(null);
      saveLayout(desksState);
      
      if (!hasDraggedDesk) {
        const desk = desksState.find(d => d.id === clickedId);
        if (desk) {
          setBackupDesks(JSON.parse(JSON.stringify(desksState)));
          setSelectedDeskForEdit(desk);
        }
      }
    }
  };

  const handleClearAllSeats = () => {
    if (!isAdminOrHR) return;
    triggerConfirm(
      "Reset All Allotments",
      "Are you sure you want to clear all seat allotments? This will make all seats available.",
      () => {
        const updatedDesks = desksState.map(d => ({
          ...d,
          topSeats: d.topSeats.map((s: any) => ({ ...s, available: true, assignedEmployeeId: "" })),
          bottomSeats: d.bottomSeats.map((s: any) => ({ ...s, available: true, assignedEmployeeId: "" }))
        }));
        
        setDesksState(updatedDesks);
        saveLayout(updatedDesks);
        toast.success("All seats have been reset to Available!");
      }
    );
  };

  const handleSaveAllotment = async () => {
    if (!selectedSeat) return;

    const { deskId, seatId, isTop } = selectedSeat;
    let oldSeatInfo = "";

    // Step 1: Scan and clear any previous seat allotment for this employee to enforce unique chair allocation
    const updatedDesksWithShift = desksState.map(desk => {
      const updatedTopSeats = desk.topSeats.map(seat => {
        // Skip the seat currently being edited
        if (desk.id === deskId && seat.id === seatId && isTop) return seat;

        if (modalStatus === "allocated" && modalEmployeeId && seat.assignedEmployeeId === modalEmployeeId) {
          oldSeatInfo = `Desk ${desk.id} Seat ${seat.id.toUpperCase()}`;
          return { ...seat, available: true, assignedEmployeeId: "" };
        }
        return seat;
      });

      const updatedBottomSeats = desk.bottomSeats.map(seat => {
        // Skip the seat currently being edited
        if (desk.id === deskId && seat.id === seatId && !isTop) return seat;

        if (modalStatus === "allocated" && modalEmployeeId && seat.assignedEmployeeId === modalEmployeeId) {
          oldSeatInfo = `Desk ${desk.id} Seat ${seat.id.toUpperCase()}`;
          return { ...seat, available: true, assignedEmployeeId: "" };
        }
        return seat;
      });

      return { ...desk, topSeats: updatedTopSeats, bottomSeats: updatedBottomSeats };
    });

    // Step 2: Set the allotment for the target seat
    const finalDesks = updatedDesksWithShift.map(desk => {
      if (desk.id !== deskId) return desk;

      const seatsKey = isTop ? 'topSeats' : 'bottomSeats';
      const updatedSeats = desk[seatsKey].map(seat => {
        if (seat.id !== seatId) return seat;
        
        return {
          ...seat,
          available: modalStatus === "available",
          assignedEmployeeId: modalStatus === "allocated" ? modalEmployeeId : ""
        };
      });

      return { ...desk, [seatsKey]: updatedSeats };
    });

    setDesksState(finalDesks);
    localStorage.setItem("workspace_seating_arrangement", JSON.stringify(finalDesks));

    // Save update to global database
    try {
      await api.post("/seating-arrangement", { desks: finalDesks }, { showLoader: false, showErrorToast: false });
    } catch (err) {
      console.error("Failed to save seating arrangement to database", err);
    }

    setSelectedSeat(null);

    if (modalStatus === "allocated" && modalEmployeeId) {
      const selectedEmp = realEmployees.find((emp: any) => String(emp.id) === String(modalEmployeeId)) || data?.employees?.find((emp: any) => emp.id === modalEmployeeId);
      const empName = selectedEmp ? selectedEmp.name : "Employee";
      if (oldSeatInfo) {
        toast.success(`${empName} has been shifted to Desk ${deskId} Seat ${seatId.toUpperCase()} (unassigned from ${oldSeatInfo}).`);
      } else {
        toast.success(`${empName} allotted to Desk ${deskId} Seat ${seatId.toUpperCase()} successfully.`);
      }
    } else {
      toast.success("Seating allotment updated successfully.");
    }
  };

  const checkIsMySeat = React.useCallback((employee: any) => {
    if (!employee || !user) return false;
    
    const anyUser = user as any;

    // 1. Check ID & Employee Code match
    const userIdentifiers = new Set<string>();
    if (user.id) userIdentifiers.add(String(user.id).toLowerCase().trim());
    if (anyUser._id) userIdentifiers.add(String(anyUser._id).toLowerCase().trim());
    if (user.employee_id) userIdentifiers.add(String(user.employee_id).toLowerCase().trim());
    if (user.employeeId) userIdentifiers.add(String(user.employeeId).toLowerCase().trim());
    if (anyUser.work_details?.employee_id) userIdentifiers.add(String(anyUser.work_details.employee_id).toLowerCase().trim());

    const empIdentifiers = new Set<string>();
    if (employee.id) empIdentifiers.add(String(employee.id).toLowerCase().trim());
    if (employee._id) empIdentifiers.add(String(employee._id).toLowerCase().trim());
    if (employee.employee_id) empIdentifiers.add(String(employee.employee_id).toLowerCase().trim());
    if (employee.employeeId) empIdentifiers.add(String(employee.employeeId).toLowerCase().trim());
    if (employee.employeeCode) empIdentifiers.add(String(employee.employeeCode).toLowerCase().trim());

    for (const id of empIdentifiers) {
      if (id && userIdentifiers.has(id)) return true;
    }

    // 2. Check Email match
    const empEmail = String(employee.email || "").toLowerCase().trim();
    const userEmail = String(user.email || anyUser.contact_info?.email || anyUser.personal_info?.email || "").toLowerCase().trim();
    if (empEmail && userEmail && empEmail === userEmail) return true;
    
    // 3. Check Full Name match
    const empFullName = String(employee.name || employee.full_name || `${employee.firstName || ''} ${employee.lastName || ''}`).toLowerCase().trim();
    const userFullName = String(
      user.name || 
      anyUser.full_name || 
      anyUser.personal_info?.full_name || 
      anyUser.contact_info?.full_name || 
      `${anyUser.firstName || anyUser.first_name || ''} ${anyUser.lastName || anyUser.last_name || ''}`
    ).toLowerCase().trim();
    
    if (empFullName && userFullName && empFullName === userFullName) return true;

    return false;
  }, [user]);

  // Find current user's allocated seat info across all desks
  const myAllocatedSeatInfo = React.useMemo(() => {
    if (!user) return null;
    const allEmps = realEmployees.length > 0 ? realEmployees : (data?.employees || []);
    
    for (const desk of desksState) {
      for (const seat of desk.topSeats) {
        if (!seat.available) {
          const emp = getSeatEmployee(seat, allEmps, desk.id, desksState);
          if (emp && checkIsMySeat(emp)) {
            return {
              deskId: desk.id,
              deskName: desk.name,
              floor: desk.floor || 'Floor 1',
              seatId: seat.id,
              isTop: true,
              employee: emp
            };
          }
        }
      }
      for (const seat of desk.bottomSeats) {
        if (!seat.available) {
          const emp = getSeatEmployee(seat, allEmps, desk.id, desksState);
          if (emp && checkIsMySeat(emp)) {
            return {
              deskId: desk.id,
              deskName: desk.name,
              floor: desk.floor || 'Floor 1',
              seatId: seat.id,
              isTop: false,
              employee: emp
            };
          }
        }
      }
    }
    return null;
  }, [user, realEmployees, data?.employees, desksState, checkIsMySeat]);

  return (
    <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex flex-col gap-4">
        {/* Floor Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {floors.map(f => (
            <button
              key={f}
              onClick={() => setActiveFloor(f)}
              className={cn(
                "px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors",
                activeFloor === f 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              {f}
            </button>
          ))}
          {isAdminOrHR && isLayoutEditMode && (
            <button
              onClick={() => {
                setNewFloorName("");
                setIsAddFloorOpen(true);
              }}
              className="px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap bg-white border border-dashed border-slate-300 text-slate-500 hover:border-brand-teal hover:text-brand-teal transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Floor
            </button>
          )}
        </div>
      <div className="flex items-center justify-between flex-wrap gap-4">
        {isAdminOrHR && (
          <div className="flex items-center gap-3">
            <Button
              variant={isLayoutEditMode ? "default" : "outline"}
              size="sm"
              onClick={async () => {
                if (isLayoutEditMode) {
                  await saveLayout(desksState);
                  toast.success("Layout saved successfully!");
                }
                setIsLayoutEditMode(!isLayoutEditMode);
                setSelectedDeskForEdit(null);
              }}
              className={cn(
                "gap-2 font-bold",
                isLayoutEditMode 
                  ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                  : "border-slate-300 text-slate-700 hover:bg-slate-50"
              )}
            >
              {isLayoutEditMode ? "Save Layout" : "Layout Editor"}
            </Button>
            
            {isLayoutEditMode && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddDesk}
                className="gap-2 font-bold border-brand-teal text-brand-teal hover:bg-brand-light bg-white"
              >
                <Plus className="w-4 h-4" />
                Add Table
              </Button>
            )}
            
            {!isLayoutEditMode ? (
              <div className="text-xs font-bold text-emerald-700 bg-emerald-100/80 backdrop-blur-sm border border-emerald-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm animate-in fade-in duration-200">
                <span className="w-2.5 h-2.5 bg-emerald-600 rounded-full animate-pulse flex-shrink-0"></span>
                Admin Mode: Click any seat to change employee allotment
              </div>
            ) : (
              <div className="text-xs font-bold text-brand-teal bg-brand-light/80 backdrop-blur-sm border border-brand-teal/20 px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm animate-in fade-in duration-200">
                <span className="w-2.5 h-2.5 bg-brand-teal rounded-full animate-pulse flex-shrink-0"></span>
                Layout Editor: Drag desks, click a desk to edit/delete
              </div>
            )}
          </div>
        )}
      </div>
      </div>
      <div className="flex-1 overflow-x-auto touch-pan-x touch-pan-y min-w-0">
        <div className="bg-[#e4dfcd] rounded-xl overflow-hidden shadow-sm relative min-h-[600px] min-w-[850px] border border-border">
        {!isMounted ? (
          <div className="w-full h-full flex items-center justify-center bg-[#e4dfcd]">
            <div className="flex flex-col items-center gap-3">
              <span className="w-10 h-10 border-4 border-brand-teal border-t-transparent rounded-full animate-spin"></span>
              <p className="text-slate-600 font-bold text-sm">Loading Seating Layout...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Legend */}
            <div className="absolute top-4 right-6 bg-white/90 backdrop-blur-md px-3 py-2 rounded-lg shadow-md flex flex-col gap-2 z-[100] text-sm font-medium border border-border/50">
              <div 
                onClick={handleClearAllSeats}
                className={cn(
                  "flex items-center gap-2",
                  isAdminOrHR && "cursor-pointer hover:bg-slate-100/80 p-0.5 rounded transition-colors group relative"
                )}
                title={isAdminOrHR ? "Click to clear all seat allocations" : ""}
              >
                <div className="w-6 h-4 bg-emerald-700 rounded-sm"></div>
                <span className="flex items-center gap-1 select-none">
                  Available Seats
                  {isAdminOrHR && (
                    <span className="text-[9px] font-bold text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                      (Reset All)
                    </span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-4 bg-primary rounded-sm"></div>
                <span>Allocated Seats</span>
              </div>
            </div>

            {/* Scrollable Canvas for Map */}
            <div className="w-full h-full overflow-auto">
              <div 
                ref={canvasRef}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={() => setDraggedDeskId(null)}
                className="min-w-[1000px] h-[800px] relative p-10 select-none"
              >
                {/* Desks loop */}
                {desksState.filter(d => (d.floor || 'Floor 1') === activeFloor).map(desk => (
                  <div 
                    key={desk.id}
                    id={`desk-container-${desk.id}`}
                    onMouseDown={(e) => handleDeskMouseDown(e, desk.id)}
                    className={cn(
                      "absolute bg-gray-400 border-2 rounded-sm shadow-md transition-all duration-150",
                      isLayoutEditMode ? "cursor-move select-none" : "hover:z-40",
                      draggedDeskId === desk.id 
                        ? "border-brand-teal ring-2 ring-brand-teal/50 shadow-lg scale-[1.01] z-50" 
                        : "border-gray-500 hover:border-brand-teal/60"
                    )}
                    style={{
                      left: `${desk.x}%`,
                      top: `${desk.y}%`,
                      width: `${desk.width}%`,
                      height: `${desk.height}%`
                    }}
                  >
                    {/* Dynamic Monitors/PCs on desk */}
                    {(desk.pcs || []).map(pc => (
                      <div 
                        key={pc.id}
                        onMouseDown={(e) => handlePcMouseDown(e, desk.id, pc.id)}
                        className={cn(
                          "absolute w-6 h-4 bg-slate-800 rounded-sm shadow-sm group/pc flex items-center justify-center",
                          isLayoutEditMode ? "cursor-move border border-brand-teal/40 hover:border-brand-teal z-30" : ""
                        )}
                        style={{
                          left: `${pc.x}%`,
                          top: `${pc.y}%`
                        }}
                      >
                        {isLayoutEditMode && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerConfirm(
                                "Delete PC",
                                "Are you sure you want to delete this PC?",
                                () => {
                                  setDesksState(prev => {
                                    const updated = prev.map(d => {
                                      if (d.id === desk.id) {
                                        return { ...d, pcs: d.pcs?.filter(p => p.id !== pc.id) };
                                      }
                                      return d;
                                    });
                                    saveLayout(updated);
                                    return updated;
                                  });
                                }
                              );
                            }}
                            className="absolute -top-2 -right-2 bg-rose-500 hover:bg-rose-600 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center text-[8px] font-bold shadow opacity-0 group-hover/pc:opacity-100 transition-opacity"
                            title="Delete PC"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}

                    {/* Top Chairs */}
                    {desk.topSeats.map(seat => {
                      const allEmps = realEmployees.length > 0 ? realEmployees : (data?.employees || []);
                      const employee = getSeatEmployee(seat, allEmps, desk.id, desksState);
                      const empAssets = employee ? getEmployeeResources(employee, allocatedResources, data?.assets || []) : [];
                      const isMySeat = checkIsMySeat(employee);
                      
                      // Smart positioning to avoid boundary clipping
                      const isLeftEdge = seat.id === 't1';
                      const isRightEdge = seat.id === 't5';
                      const isTopEdge = desk.id === 1 || desk.id === 4;

                      const xAlignClass = isLeftEdge 
                        ? "left-0 ml-[-16px]" 
                        : isRightEdge 
                          ? "right-0 mr-[-16px] left-auto translate-x-0" 
                          : "left-1/2 -translate-x-1/2";

                      const yAlignClass = isTopEdge 
                        ? "top-full mt-3" 
                        : "bottom-full mb-3";

                      const arrowXClass = isLeftEdge 
                        ? "left-[24px] -translate-x-0" 
                        : isRightEdge 
                          ? "right-[24px] left-auto -translate-x-0" 
                          : "left-1/2 -translate-x-1/2";

                      const arrowYClass = isTopEdge 
                        ? "bottom-full border-b-white" 
                        : "top-full border-t-white";

                      const originClass = isTopEdge 
                        ? "origin-top" 
                        : "origin-bottom";

                      return (
                        <div
                          key={seat.id}
                          onClick={(e) => {
                            if (isLayoutEditMode) {
                              e.stopPropagation();
                              return;
                            }
                            handleSeatClick(desk.id, seat.id, true);
                          }}
                          className={cn(
                            "absolute w-[12%] h-[30%] -top-[35%] rounded-t-2xl shadow-sm transition-all hover:-translate-y-1 group z-20 hover:z-50 flex items-center justify-center select-none",
                            isAdminOrHR ? "cursor-pointer" : "cursor-default",
                            seat.available 
                              ? 'bg-emerald-700 hover:bg-emerald-600' 
                              : 'bg-primary hover:bg-primary/90',
                            isMySeat && 'animate-pulse z-30 shadow-lg'
                          )}
                          style={{ left: `calc(${seat.x}% - 6%)` }}
                        >
                          {!seat.available && employee && (
                            <span className="text-[10px] font-black text-white uppercase tracking-tighter truncate px-0.5 opacity-90 group-hover:opacity-100">
                              {(employee.name || `${employee.firstName || ''} ${employee.lastName || ''}`).split(' ').map((n: string) => n[0]).join('')}
                            </span>
                          )}

                          {/* Tooltip Content */}
                          <div className={cn(
                            "absolute w-64 max-w-[calc(100vw-32px)] bg-white border border-brand-teal/20 rounded-xl p-4 shadow-xl pointer-events-auto before:absolute before:content-[''] before:left-0 before:right-0 before:-top-4 before:-bottom-4 before:bg-transparent before:z-[-1] opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all duration-200 z-50 transform scale-95 group-hover:scale-100 text-left",
                            xAlignClass,
                            yAlignClass,
                            originClass
                          )}>
                            {/* Tooltip Arrow */}
                            <div className={cn(
                              "absolute border-[6px] border-transparent drop-shadow-sm",
                              arrowXClass,
                              arrowYClass
                            )}></div>
                            
                            {seat.available ? (
                              <div className="text-center py-1">
                                <p className="font-bold text-brand-teal text-sm">Seat Available</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">Desk {desk.id} • Seat {seat.id.toUpperCase()}</p>
                              </div>
                            ) : employee ? (
                              <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                  <Avatar className="w-9 h-9 border border-brand-teal/20 shadow-sm flex-shrink-0">
                                    <AvatarImage src={getAvatarUrl(employee.avatar || employee.profilePhoto, employee.name || `${employee.firstName} ${employee.lastName}`)} onError={handleAvatarError} />
                                    <AvatarFallback className="bg-brand-light text-brand-teal text-xs font-bold">
                                      {(employee.name || `${employee.firstName} ${employee.lastName}`).split(' ').map((n: string) => n[0]).join('')}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0 flex-1">
                                    <p className="font-extrabold text-slate-900 text-sm truncate flex items-center gap-1.5">
                                      {employee.name || `${employee.firstName} ${employee.lastName}`}
                                      {isMySeat && (
                                        <span className="bg-brand-teal text-white text-[9px] font-extrabold px-1 rounded border border-brand-teal">YOU</span>
                                      )}
                                    </p>
                                    <p className="text-[10px] font-bold text-brand-teal/80 uppercase tracking-wider truncate">{employee.designation}</p>
                                    {employee.department && (
                                      <p className="text-[10px] text-muted-foreground truncate">{employee.department}</p>
                                    )}
                                  </div>
                                </div>
                                
                                <div className="border-t border-brand-teal/10 pt-2.5">
                                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                    <Package className="w-3 h-3 text-brand-teal" />
                                    Assigned Assets ({empAssets.length})
                                  </p>
                                  {empAssets.length > 0 ? (
                                    <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                                      {empAssets.map((asset: any) => (
                                        <div key={asset.id} className="flex items-center justify-between gap-2 p-1 rounded bg-[#EAF7F6]/40 hover:bg-[#EAF7F6]/60 transition-colors">
                                          <span className="text-[11px] font-semibold text-slate-800 truncate max-w-[120px]">{asset.name}</span>
                                          <span className="text-[9px] font-mono text-brand-teal font-bold bg-white px-1.5 py-0.5 rounded shadow-sm border border-brand-teal/10">{asset.assetId}</span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-[10px] italic text-muted-foreground py-0.5">No assets assigned</p>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="text-center py-1">
                                <p className="font-bold text-slate-900 text-sm">Seat Allocated</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">Desk {desk.id} • Seat {seat.id.toUpperCase()}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Bottom Chairs */}
                    {desk.bottomSeats.map(seat => {
                      const allEmps = realEmployees.length > 0 ? realEmployees : (data?.employees || []);
                      const employee = getSeatEmployee(seat, allEmps, desk.id, desksState);
                      const empAssets = employee ? getEmployeeResources(employee, allocatedResources, data?.assets || []) : [];
                      const isMySeat = checkIsMySeat(employee);
                      
                      // Smart positioning to avoid boundary clipping
                      const isLeftEdge = seat.id === 'b1';
                      const isRightEdge = seat.id === 'b5';
                      const isBottomEdge = desk.id === 3 || desk.id === 5;

                      const xAlignClass = isLeftEdge 
                        ? "left-0 ml-[-16px]" 
                        : isRightEdge 
                          ? "right-0 mr-[-16px] left-auto translate-x-0" 
                          : "left-1/2 -translate-x-1/2";

                      const yAlignClass = isBottomEdge 
                        ? "bottom-full mb-3" 
                        : "top-full mt-3";

                      const arrowXClass = isLeftEdge 
                        ? "left-[24px] -translate-x-0" 
                        : isRightEdge 
                          ? "right-[24px] left-auto -translate-x-0" 
                          : "left-1/2 -translate-x-1/2";

                      const arrowYClass = isBottomEdge 
                        ? "top-full border-t-white" 
                        : "bottom-full border-b-white";

                      const originClass = isBottomEdge 
                        ? "origin-bottom" 
                        : "origin-top";

                      return (
                        <div
                          key={seat.id}
                          onClick={(e) => {
                            if (isLayoutEditMode) {
                              e.stopPropagation();
                              return;
                            }
                            handleSeatClick(desk.id, seat.id, false);
                          }}
                          className={cn(
                            "absolute w-[12%] h-[30%] -bottom-[35%] rounded-b-2xl shadow-sm transition-all hover:translate-y-1 group z-20 hover:z-50 flex items-center justify-center select-none",
                            isAdminOrHR ? "cursor-pointer" : "cursor-default",
                            seat.available 
                              ? 'bg-emerald-700 hover:bg-emerald-600' 
                              : 'bg-primary hover:bg-primary/90',
                            isMySeat && 'animate-pulse z-30 shadow-lg'
                          )}
                          style={{ left: `calc(${seat.x}% - 6%)` }}
                        >
                          {!seat.available && employee && (
                            <span className="text-[10px] font-black text-white uppercase tracking-tighter truncate px-0.5 opacity-90 group-hover:opacity-100">
                              {(employee.name || `${employee.firstName || ''} ${employee.lastName || ''}`).split(' ').map((n: string) => n[0]).join('')}
                            </span>
                          )}

                          {/* Tooltip Content */}
                          <div className={cn(
                            "absolute w-64 max-w-[calc(100vw-32px)] bg-white border border-brand-teal/20 rounded-xl p-4 shadow-xl pointer-events-auto before:absolute before:content-[''] before:left-0 before:right-0 before:-top-4 before:-bottom-4 before:bg-transparent before:z-[-1] opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all duration-200 z-50 transform scale-95 group-hover:scale-100 text-left",
                            xAlignClass,
                            yAlignClass,
                            originClass
                          )}>
                            {/* Tooltip Arrow */}
                            <div className={cn(
                              "absolute border-[6px] border-transparent drop-shadow-sm",
                              arrowXClass,
                              arrowYClass
                            )}></div>
                            
                            {seat.available ? (
                              <div className="text-center py-1">
                                <p className="font-bold text-brand-teal text-sm">Seat Available</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">Desk {desk.id} • Seat {seat.id.toUpperCase()}</p>
                              </div>
                            ) : employee ? (
                              <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                  <Avatar className="w-9 h-9 border border-brand-teal/20 shadow-sm flex-shrink-0">
                                    <AvatarImage src={getAvatarUrl(employee.avatar || employee.profilePhoto, employee.name || `${employee.firstName} ${employee.lastName}`)} onError={handleAvatarError} />
                                    <AvatarFallback className="bg-brand-light text-brand-teal text-xs font-bold">
                                      {(employee.name || `${employee.firstName} ${employee.lastName}`).split(' ').map((n: string) => n[0]).join('')}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0 flex-1">
                                    <p className="font-extrabold text-slate-900 text-sm truncate flex items-center gap-1.5">
                                      {employee.name || `${employee.firstName} ${employee.lastName}`}
                                      {isMySeat && (
                                        <span className="bg-brand-teal text-white text-[9px] font-extrabold px-1 rounded border border-brand-teal">YOU</span>
                                      )}
                                    </p>
                                    <p className="text-[10px] font-bold text-brand-teal/80 uppercase tracking-wider truncate">{employee.designation}</p>
                                    {employee.department && (
                                      <p className="text-[10px] text-muted-foreground truncate">{employee.department}</p>
                                    )}
                                  </div>
                                </div>
                                
                                <div className="border-t border-brand-teal/10 pt-2.5">
                                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                    <Package className="w-3 h-3 text-brand-teal" />
                                    Assigned Assets ({empAssets.length})
                                  </p>
                                  {empAssets.length > 0 ? (
                                    <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                                      {empAssets.map((asset: any) => (
                                        <div key={asset.id} className="flex items-center justify-between gap-2 p-1 rounded bg-[#EAF7F6]/40 hover:bg-[#EAF7F6]/60 transition-colors">
                                          <span className="text-[11px] font-semibold text-slate-800 truncate max-w-[120px]">{asset.name}</span>
                                          <span className="text-[9px] font-mono text-brand-teal font-bold bg-white px-1.5 py-0.5 rounded shadow-sm border border-brand-teal/10">{asset.assetId}</span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-[10px] italic text-muted-foreground py-0.5">No assets assigned</p>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="text-center py-1">
                                <p className="font-bold text-slate-900 text-sm">Seat Allocated</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">Desk {desk.id} • Seat {seat.id.toUpperCase()}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}


              </div>
            </div>
          </>
        )}
        </div>
      </div>

      {/* Manage Seat Modal */}
      {selectedSeat && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform scale-100 transition-all">
            {/* Modal Header */}
            <div className="bg-slate-900 border-b border-slate-800 p-5 text-white flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-lg text-white">Manage Seating Allotment</h3>
                <p className="text-xs text-slate-300 mt-0.5 font-medium">Desk {selectedSeat.deskId} • Seat {selectedSeat.seatId.toUpperCase()}</p>
              </div>
              <button 
                onClick={() => setSelectedSeat(null)}
                className="text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 p-2 rounded-lg transition-colors font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {/* Status Select */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Seat Status</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setModalStatus("available")}
                    className={cn(
                      "py-3 px-4 rounded-xl border text-sm font-bold transition-all flex items-center justify-center gap-2",
                      modalStatus === "available"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-800 shadow-sm"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                    )}
                  >
                    <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></span>
                    Available
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalStatus("allocated")}
                    className={cn(
                      "py-3 px-4 rounded-xl border text-sm font-bold transition-all flex items-center justify-center gap-2",
                      modalStatus === "allocated"
                        ? "bg-emerald-600 border-emerald-600 text-white shadow-md"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                    )}
                  >
                    <span className="w-2.5 h-2.5 bg-white rounded-full"></span>
                    Allocated
                  </button>
                </div>
              </div>

              {/* Employee Select */}
              {modalStatus === "allocated" && (
                <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Assign Employee</label>
                  <select
                    value={modalEmployeeId}
                    onChange={(e) => setModalEmployeeId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  >
                    <option value="">-- Choose Employee --</option>
                    {(realEmployees.length > 0 ? realEmployees : (data?.employees || [])).map((emp: any) => {
                      const empId = emp.id || emp._id;
                      const empName = emp.name || `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || "Employee";
                      const desig = emp.designation || emp.department || "";
                      return (
                        <option key={empId} value={empId}>
                          {empName} {desig ? `(${desig})` : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {/* Allocated Physical Resources list */}
              {modalStatus === "allocated" && modalEmployeeId && (() => {
                const empResList = allocatedResources.filter((item: any) => {
                  const assigned = item.assigned_to;
                  if (!assigned) return false;
                  if (typeof assigned === "object" && assigned !== null) {
                    return String(assigned.employee_id) === String(modalEmployeeId);
                  }
                  return String(item.assigned_to_employee_id) === String(modalEmployeeId);
                });
                const selEmp = realEmployees.find(e => String(e.id) === String(modalEmployeeId));
                const empName = selEmp ? selEmp.name : "this employee";

                return (
                  <div className="space-y-2 bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs animate-in fade-in duration-200">
                    <div className="flex items-center justify-between font-bold text-slate-800 pb-2 border-b border-slate-200">
                      <span className="flex items-center gap-1.5">
                        <Package className="w-4 h-4 text-emerald-600" />
                        Allocated Physical Resources ({empResList.length})
                      </span>
                    </div>
                    {empResList.length === 0 ? (
                      <p className="text-slate-500 italic py-1.5 text-[11px]">No physical inventory resources currently allocated to {empName}.</p>
                    ) : (
                      <div className="space-y-1.5 pt-1 max-h-36 overflow-y-auto">
                        {empResList.map((res: any) => (
                          <div key={res._id || res.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg p-2 font-mono text-[11px] shadow-2xs">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">{res.resource_id || res.assetId}</span>
                              <span className="text-slate-600 font-sans font-medium">({res.category_name || res.name})</span>
                            </div>
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200 font-sans">
                              {res.condition || "Good"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-100 p-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setSelectedSeat(null)}
                className="font-bold text-slate-700 hover:text-slate-900 border border-slate-300 bg-white hover:bg-slate-50 rounded-xl px-4 py-2 text-sm"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveAllotment}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl px-5 py-2 text-sm shadow-md transition-colors"
              >
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Desk Modal */}
      {selectedDeskForEdit && desksState.find(d => d.id === selectedDeskForEdit.id) && (() => {
        const editingDesk = desksState.find(d => d.id === selectedDeskForEdit.id)!;
        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform scale-100 transition-all">
              {/* Modal Header */}
              <div className="bg-slate-900 border-b border-slate-800 p-5 text-white flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-lg text-white">Modify Desk Layout</h3>
                  <p className="text-xs text-slate-300 mt-0.5 font-medium">Configure dimensions, positioning, and seats</p>
                </div>
                <button 
                  onClick={() => {
                    if (backupDesks) {
                      setDesksState(backupDesks);
                      saveLayout(backupDesks);
                    }
                    setSelectedDeskForEdit(null);
                  }}
                  className="text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 p-2 rounded-lg transition-colors font-bold text-sm"
                >
                  ✕
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">

                {/* Seat Counts */}
                <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Top Seats Count</label>
                    <Input
                      type="number"
                      min="0"
                      max="20"
                      value={editingDesk.topSeats.length}
                      onChange={(e) => {
                        const count = Math.max(0, Math.min(20, parseInt(e.target.value) || 0));
                        setDesksState(prev => prev.map(d => {
                          if (d.id === editingDesk.id) {
                            return {
                              ...d,
                              topSeats: updateSeatsCount('t', count, d.topSeats)
                            };
                          }
                          return d;
                        }));
                      }}
                      className="bg-slate-50 border-slate-200 focus-visible:ring-emerald-500/50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Bottom Seats Count</label>
                    <Input
                      type="number"
                      min="0"
                      max="20"
                      value={editingDesk.bottomSeats.length}
                      onChange={(e) => {
                        const count = Math.max(0, Math.min(20, parseInt(e.target.value) || 0));
                        setDesksState(prev => prev.map(d => {
                          if (d.id === editingDesk.id) {
                            return {
                              ...d,
                              bottomSeats: updateSeatsCount('b', count, d.bottomSeats)
                            };
                          }
                          return d;
                        }));
                      }}
                      className="bg-slate-50 border-slate-200 focus-visible:ring-emerald-500/50"
                    />
                  </div>
                </div>

                {/* PCs Configuration */}
                <div className="border-t border-slate-100 pt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Desk PCs ({editingDesk.pcs?.length || 0})</label>
                    <button
                      type="button"
                      onClick={() => {
                        const newPc = { id: `pc-${Date.now()}`, x: 45, y: 45 };
                        setDesksState(prev => prev.map(d => {
                          if (d.id === editingDesk.id) {
                            return { ...d, pcs: [...(d.pcs || []), newPc] };
                          }
                          return d;
                        }));
                      }}
                      className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add PC
                    </button>
                  </div>
                  
                  {editingDesk.pcs && editingDesk.pcs.length > 0 ? (
                    <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                      {editingDesk.pcs.map((pc, idx) => (
                        <div key={pc.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-100 animate-in fade-in duration-150">
                          <span className="text-xs font-bold text-slate-700">PC #{idx + 1}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setDesksState(prev => prev.map(d => {
                                if (d.id === editingDesk.id) {
                                  return { ...d, pcs: d.pcs?.filter(p => p.id !== pc.id) };
                                }
                                return d;
                              }));
                            }}
                            className="text-rose-500 hover:text-rose-600 font-bold text-xs"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs italic text-slate-400">No PCs on this desk.</p>
                  )}
                </div>

                {/* Danger Zone */}
                <div className="border-t border-slate-100 pt-4 mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      triggerConfirm(
                        "Delete Desk",
                        `Are you sure you want to delete ${editingDesk.name || `Desk ${editingDesk.id}`}?`,
                        () => {
                          handleDeleteDesk(editingDesk.id);
                        }
                      );
                    }}
                    className="w-full py-2.5 px-4 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold transition-all flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Desk & All Associated Seats
                  </button>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-slate-100 p-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (backupDesks) {
                      setDesksState(backupDesks);
                      saveLayout(backupDesks);
                    }
                    setSelectedDeskForEdit(null);
                  }}
                  className="font-bold text-slate-700 hover:text-slate-900 border border-slate-300 bg-white hover:bg-slate-50 rounded-xl px-4 py-2 text-sm"
                >
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    await saveLayout(desksState);
                    setSelectedDeskForEdit(null);
                    toast.success("Desk configuration saved!");
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl px-5 py-2 text-sm shadow-md transition-colors"
                >
                  Save Layout
                </Button>
              </div>
            </div>
          </div>
        );
      })()}
      <DeleteConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={() => {
          if (confirmAction) confirmAction();
          setConfirmOpen(false);
        }}
        title={confirmTitle}
        description={confirmDescription}
      />

      {/* Add Floor Modal */}
      <Dialog open={isAddFloorOpen} onOpenChange={setIsAddFloorOpen}>
        <DialogContent className="sm:max-w-[425px] max-h-[90dvh] flex flex-col p-0 overflow-hidden rounded-2xl sm:rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
          <DialogHeader>
            <DialogTitle>Add New Floor</DialogTitle>
            <DialogDescription>
              Enter a name for the new floor or section in your workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              id="floorName"
              placeholder="e.g. Floor 2, Basement, Main Office"
              value={newFloorName}
              onChange={(e) => setNewFloorName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newFloorName.trim()) {
                  e.preventDefault();
                  if (!floors.includes(newFloorName.trim())) {
                    setFloors([...floors, newFloorName.trim()]);
                    setActiveFloor(newFloorName.trim());
                    setIsAddFloorOpen(false);
                  } else {
                    toast.error("Floor name already exists");
                  }
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddFloorOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (!newFloorName.trim()) {
                  toast.error("Please enter a floor name");
                  return;
                }
                if (!floors.includes(newFloorName.trim())) {
                  setFloors([...floors, newFloorName.trim()]);
                  setActiveFloor(newFloorName.trim());
                  setIsAddFloorOpen(false);
                } else {
                  toast.error("Floor name already exists");
                }
              }}
              className="bg-brand-teal hover:bg-brand-teal/90 text-white"
            >
              Add Floor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
