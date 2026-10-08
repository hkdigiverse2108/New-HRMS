"use client";

import React, { useState, useEffect } from "react";
import { 
  Plus, 
  CheckCircle2, 
  Package, 
  Wrench,
  Image as ImageIcon,
  RefreshCw,
  Calendar as CalendarIcon,
  ChevronRight,
  Pencil,
  Trash2,
  Laptop,
  Monitor,
  Keyboard,
  Mouse,
  CreditCard,
  Layers,
  Activity,
  ShieldAlert,
  MapPin,
  User,
  Hash,
  Coins,
  TrendingUp,
  Archive,
  ArrowLeft,
  FileText,
  Tag,
  History,
  Printer
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Switch } from "@/components/ui/switch";
import { useApi } from "@/hooks/useApi";
import { useUser } from "@/hooks/useUser";
import { API_URL } from "@/lib/config";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { PrintLabelsModal } from "./PrintLabelsModal";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableHeader } from "@/components/ui/sortable-header";
import { hasModulePermission, isUserAdmin } from "@/lib/permissions";

const getStatusBadge = (status: string) => {
  switch (status) {
    case "Allocated": return "bg-blue-100/70 text-blue-700 border-blue-200";
    case "Available": return "bg-emerald-100/70 text-emerald-700 border-emerald-200";
    case "Maintenance": return "bg-amber-100/70 text-amber-700 border-amber-200";
    default: return "bg-gray-100 text-gray-700 border-gray-200";
  }
};

const getConditionBadge = (condition: string) => {
  switch (condition) {
    case "New": return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "Good": return "bg-blue-50 text-blue-700 border-blue-200";
    case "Fair": return "bg-amber-50 text-amber-700 border-amber-200";
    case "Poor": return "bg-rose-50 text-rose-700 border-rose-200";
    default: return "bg-gray-50 text-gray-700 border-gray-200";
  }
};

const getCategoryIcon = (iconName: string) => {
  switch (iconName) {
    case "Laptop": return <Laptop className="w-5 h-5" />;
    case "Monitor": return <Monitor className="w-5 h-5" />;
    case "Keyboard": return <Keyboard className="w-5 h-5" />;
    case "Mouse": return <Mouse className="w-5 h-5" />;
    case "Layers": return <Layers className="w-5 h-5" />;
    case "CreditCard": return <CreditCard className="w-5 h-5" />;
    case "ImageIcon": return <ImageIcon className="w-5 h-5" />;
    default: return <Package className="w-5 h-5" />;
  }
};

const getCategoryColors = (iconName: string) => {
  switch (iconName) {
    case "Laptop": return "text-indigo-600 bg-indigo-50 border-indigo-100";
    case "Layers": return "text-blue-600 bg-blue-50 border-blue-100";
    case "Monitor": return "text-sky-600 bg-sky-50 border-sky-100";
    case "Keyboard": return "text-emerald-600 bg-emerald-50 border-emerald-100";
    case "Mouse": return "text-teal-600 bg-teal-50 border-teal-100";
    case "ImageIcon": return "text-pink-600 bg-pink-50 border-pink-100";
    case "CreditCard": return "text-amber-600 bg-amber-50 border-amber-100";
    default: return "text-purple-600 bg-purple-50 border-purple-100";
  }
};

const getCategoryCode = (categoryName: string): string => {
  const upper = (categoryName || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return upper ? upper.slice(0, 3) : "AST";
};

export default function ResourceManagementPage() {
  const { user, isLoading: userLoading } = useUser();
  const { data, isLoading, refresh: apiRefresh, updateData } = useApi();
  const confirm = async (msg: any) => window.confirm(msg.title || "Confirm");

  const [activeTab, setActiveTab] = useState<"overview" | "registry" | "categories" | "history">("overview");
  const [isAddingMode, setIsAddingMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  
  // Category management mode
  const [isAddingCategoryMode, setIsAddingCategoryMode] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  
  // Filters state
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  
  // Dynamic categories, inventory items, employees, dashboard and logs
  const [realEmployees, setRealEmployees] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [inventoryLogs, setInventoryLogs] = useState<any[]>([]);
  const [categoryLogs, setCategoryLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [deletedResourceIds, setDeletedResourceIds] = useState<string[]>([]);

  const initialFormState = {
    assetId: "",
    name: "",
    category: "",
    status: "Available",
    assignedTo: "",
    assignedToEmpId: "",
    purchaseDate: new Date().toISOString().split('T')[0],
    description: "",
    value: 0,
    serialNumber: "",
    condition: "Good",
    location: "",
    resourceCount: 1
  };

  const initialCategoryFormState = {
    name: "",
    description: "",
    icon: "Package",
    totalItems: 0,
    valuation: 0
  };

  const [formData, setFormData] = useState(initialFormState);
  const [categoryFormData, setCategoryFormData] = useState(initialCategoryFormState);
  const [editingCell, setEditingCell] = useState<{ id: string, field: string } | null>(null);
  const [tempValue, setTempValue] = useState<any>(null);
  const [isAddingResourceCount, setIsAddingResourceCount] = useState(false);
  const [newResourceCount, setNewResourceCount] = useState<string>("");
  const [removeResourceCount, setRemoveResourceCount] = useState<string>("");
  const [selectedItemForLogs, setSelectedItemForLogs] = useState<{ type: 'category' | 'resource', id: string, name: string } | null>(null);
  const [itemLogs, setItemLogs] = useState<any[]>([]);
  const [itemLogsLoading, setItemLogsLoading] = useState(false);

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
    hasModulePermission(user, "/workspace/resource", "update") ||
    hasModulePermission(user, "/workspace", "all");

  const isAdmin = isAdminOrHR;
  const isEmployeeOnly = !isAdminOrHR;
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    if (isEmployeeOnly) {
      setActiveTab("registry");
    }
  }, [isEmployeeOnly]);

  const formatLogTime = (dateStr: string) => {
    if (!dateStr) return "";
    try {
      const raw = dateStr.endsWith("Z") || dateStr.includes("UTC") ? dateStr.replace(" UTC", "Z") : dateStr;
      const d = new Date(raw);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true
      });
    } catch {
      return dateStr;
    }
  };

  const fetchDashboardData = async () => {
    try {
      const res = await api.get("/resource-inventory/dashboard", { showLoader: false, showErrorToast: false });
      if (res) setDashboardData(res);
    } catch (err) {
      console.error("Failed to fetch resource dashboard:", err);
    }
  };

  const fetchCategories = async () => {
    setCategoriesLoading(true);
    try {
      const response = await api.get("/resource-categories?page=1&limit=100", { showLoader: false, showErrorToast: false });
      const rawCats = response?.items || response?.data || (Array.isArray(response) ? response : []);
      setCategories(rawCats.map((c: any) => ({
        id: c.id || c._id,
        name: c.category_name || c.name,
        description: c.description || "",
        icon: c.icon || "Package",
        totalItems: c.total_items ?? c.total_resources ?? c.totalItems ?? 0,
        availableStock: c.available_stock ?? c.availableStock ?? 0,
        allocatedItems: c.allocated_items ?? c.allocatedItems ?? 0,
        inMaintenance: c.in_maintenance ?? c.inMaintenance ?? 0,
        valuation: c.valuation || 0
      })));
    } catch (error) {
      console.error("Failed to fetch categories:", error);
    } finally {
      setCategoriesLoading(false);
    }
  };

  const fetchInventoryItems = async () => {
    setInventoryLoading(true);
    try {
      const endpoint = isEmployeeOnly
        ? "/resource-inventory/my-resources?page=1&limit=100"
        : "/resource-inventory?page=1&limit=100";
      const response = await api.get(endpoint, { showLoader: false, showErrorToast: false });
      const rawItems = response?.items || response?.data || (Array.isArray(response) ? response : []);
      setInventoryItems(rawItems.map((item: any) => ({
        id: item.id || item._id,
        assetId: item.resource_id || item.assetId || `HK-AST-${(item.id || item._id)?.slice(-4) || "0001"}`,
        name: item.category_name || item.name || item.resource_id,
        category: item.category_name || item.category || "General",
        categoryId: item.category_id,
        status: item.status || "Available",
        condition: item.condition || "Good",
        assignedTo: (() => {
          const raw = item.assigned_to
            ? (typeof item.assigned_to === "object" && item.assigned_to !== null ? (item.assigned_to.employee_name || item.assigned_to.name || "") : item.assigned_to)
            : (item.assigned_to_name || item.assignedTo || "");
          return String(raw || "").replace(/\s*\([A-Z0-9-]+\)$/i, "").trim();
        })(),
        assignedToEmpId: item.assigned_to_employee_id || (item.assigned_to && typeof item.assigned_to === "object" ? item.assigned_to.employee_id : null),
        serialNumber: item.serial_number || item.serialNumber || "",
        location: item.location || "",
        purchaseDate: item.purchase_date || item.purchaseDate || "",
        value: item.value || 0,
        description: item.description || ""
      })));
    } catch (error) {
      console.error("Failed to fetch inventory items:", error);
    } finally {
      setInventoryLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await api.get("/employees?page=1&limit=100", { showLoader: false, showErrorToast: false });
      const rawEmps = res?.items || res?.data || (Array.isArray(res) ? res : []);
      const mapped = rawEmps.map((emp: any) => {
        const pi = emp.personal_info || {};
        const fullName = (pi.full_name || emp.full_name || emp.name || `${pi.first_name || ""} ${pi.last_name || ""}`).trim() || "Employee";
        const code = emp.work_details?.employee_id || emp.employee_id || "";
        return {
          id: emp.id || emp._id,
          name: fullName,
          displayName: fullName,
          employeeCode: code,
          avatar: emp.profile_photo || pi.profile_photo || ""
        };
      });
      setRealEmployees(mapped);
    } catch (err) {
      console.error("Failed to fetch real employees:", err);
    }
  };

  const refreshAssets = async () => {
    await Promise.all([fetchInventoryItems(), fetchCategories(), fetchDashboardData(), fetchEmployees()]);
  };

  const fetchLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await api.get("/resource-inventory/logs", { showLoader: false, showErrorToast: false });
      const invLogs = res?.inventory_logs || [];
      const catLogs = res?.category_logs || [];
      setInventoryLogs(invLogs.map((l: any) => ({
        id: l._id || l.id,
        action: l.action,
        details: l.details,
        userName: l.user_name || "Admin",
        performedBy: l.performed_by || "Admin",
        timestamp: l.timestamp || l.created_at
      })));
      setCategoryLogs(catLogs.map((l: any) => ({
        id: l._id || l.id,
        action: l.action,
        details: l.details,
        userName: l.user_name || "Admin",
        performedBy: l.performed_by || "Admin",
        timestamp: l.timestamp || l.created_at
      })));
    } catch (error) {
      console.error("Failed to fetch logs:", error);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
    fetchCategories();
    fetchInventoryItems();
    fetchDashboardData();
    fetchLogs();
  }, [isEmployeeOnly]);

  useEffect(() => {
    if (activeTab === "overview") fetchDashboardData();
    if (activeTab === "history") fetchLogs();
    if (activeTab === "categories") { fetchCategories(); fetchInventoryItems(); }
    if (activeTab === "registry") fetchInventoryItems();
  }, [activeTab]);

  const fetchItemLogs = async (type: 'category' | 'resource', id: string) => {
    setItemLogsLoading(true);
    try {
      const res = await api.get(`/resource-inventory/logs/${type}/${id}`, { showLoader: false, showErrorToast: false });
      const rawLogs = res?.items || (Array.isArray(res) ? res : []);
      setItemLogs(rawLogs.map((l: any) => ({
        id: l._id || l.id,
        action: l.action,
        details: l.details,
        userName: l.user_name || "Admin",
        performedBy: l.performed_by || "Admin",
        timestamp: l.timestamp || l.created_at
      })));
    } catch (error) {
      console.error("Failed to fetch item logs:", error);
      setItemLogs([]);
    } finally {
      setItemLogsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedItemForLogs) {
      fetchItemLogs(selectedItemForLogs.type, selectedItemForLogs.id);
    } else {
      setItemLogs([]);
    }
  }, [selectedItemForLogs]);

  const handleAssignToChange = (val: string) => {
    const isClear = val === "unassigned" || !val;
    const actualVal = val && val.includes('|') ? val.split('|')[0] : val;
    setFormData(prev => ({
      ...prev,
      assignedTo: isClear ? "" : (actualVal || ""),
      status: isClear ? "Available" : "Allocated"
    }));
  };

  const handleStatusChange = (val: string) => {
    setFormData(prev => ({
      ...prev,
      status: val,
      assignedTo: val === "Allocated" ? prev.assignedTo : ""
    }));
  };

  const handleCategoryChange = (val: string) => {
    setFormData(prev => {
      const updated = { ...prev, category: val, name: prev.name || val };
      if (!editingId) {
        const code = getCategoryCode(val);
        const nextNum = allResources.filter((res: any) => res.category === val).length + 1;
        updated.assetId = `HK-${code}-${String(nextNum).padStart(3, '0')}`;
      }
      return updated;
    });
  };

  const handleInlineSave = async (id: string, field: string, value: any) => {
    const originalResource = allResources.find((r: any) => r.id === id);
    if (originalResource && originalResource[field] === value) {
      setEditingCell(null);
      return;
    }

    try {
      const payload: any = {};
      if (field === "assignedTo") {
        if (value && value !== "unassigned") {
          const emp = realEmployees.find((e: any) => e.name === value || e.displayName === value || e.id === value);
          payload.assigned_to_name = emp ? emp.name : value;
          payload.assigned_to_employee_id = emp ? emp.id : null;
          payload.status = "Allocated";
        } else {
          payload.assigned_to_name = null;
          payload.assigned_to_employee_id = null;
          payload.assigned_to_department = null;
          payload.status = "Available";
        }
      } else if (field === "status") {
        payload.status = value;
        if (value !== "Allocated") {
          payload.assigned_to_name = null;
          payload.assigned_to_employee_id = null;
          payload.assigned_to_department = null;
        }
      } else if (field === "condition") {
        payload.condition = value;
      } else if (field === "location") {
        payload.location = value;
      } else if (field === "serialNumber") {
        payload.serial_number = value;
      }

      await api.put(`/resource-inventory/${id}`, payload);
      toast.success("Asset updated successfully");
      await refreshAssets();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "Failed to update asset");
    } finally {
      setEditingCell(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string, field: string) => {
    if (e.key === "Enter") {
      handleInlineSave(id, field, tempValue);
    } else if (e.key === "Escape") {
      setEditingCell(null);
    }
  };

  const handleEditClick = (resource: any) => {
    setEditingId(resource.id);
    setFormData({
      assetId: resource.assetId || "",
      name: resource.name,
      category: resource.category,
      status: resource.status,
      assignedTo: resource.assignedTo || "",
      assignedToEmpId: resource.assignedToEmpId || "",
      purchaseDate: resource.purchaseDate || new Date().toISOString().split('T')[0],
      description: resource.description || "",
      value: resource.value || 0,
      serialNumber: resource.serialNumber || "",
      condition: resource.condition || "Good",
      location: resource.location || "",
      resourceCount: 1
    });
    setIsAddingMode(true);
  };

  const handleDeleteResource = async (id: string) => {
    const itemToDelete = allResources.find((r: any) => r.id === id);
    const itemCode = itemToDelete?.assetId || itemToDelete?.name || "this item";

    const isConfirmed = await confirm({
      title: "Delete Resource Item",
      message: `Are you sure you want to delete asset item "${itemCode}"? This will automatically decrease the category total resources count by 1.`,
      destructive: true,
      confirmText: "Delete Item"
    });
    if (!isConfirmed) return;

    try {
      await api.delete(`/resource-inventory/${id}`);
      toast.success(`Inventory item "${itemCode}" deleted and category count updated.`);
      await refreshAssets();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "Failed to delete inventory item");
    }
  };

  const handleCancel = () => {
    setIsAddingMode(false);
    setEditingId(null);
    setFormData(initialFormState);
  };

  const handleSaveResource = async () => {
    if (!formData.category) {
      toast.error("Please select a category");
      return;
    }

    setIsSaving(true);
    try {
      if (editingId) {
        const payload: any = {
          condition: formData.condition,
          status: formData.status,
          location: formData.location,
          serial_number: formData.serialNumber,
          description: formData.description
        };
        if (formData.assignedTo && formData.assignedTo !== "unassigned") {
          const emp = realEmployees.find((e: any) => 
            (formData.assignedToEmpId && (String(e.id) === String(formData.assignedToEmpId) || String(e._id) === String(formData.assignedToEmpId))) ||
            e.name === formData.assignedTo || 
            e.displayName === formData.assignedTo ||
            e.name.toLowerCase().startsWith(formData.assignedTo.toLowerCase())
          );
          payload.assigned_to_name = emp ? emp.name : formData.assignedTo;
          payload.assigned_to_employee_id = emp ? emp.id : (formData.assignedToEmpId || null);
          payload.status = "Allocated";
        } else {
          payload.assigned_to_name = null;
          payload.assigned_to_employee_id = null;
          payload.assigned_to_department = null;
        }
        await api.put(`/resource-inventory/${editingId}`, payload);
        toast.success("Resource item updated successfully!");
      } else {
        const cat = categories.find(c => c.name === formData.category);
        const count = formData.resourceCount || 1;
        if (cat?.id) {
          await api.put(`/resource-categories/${cat.id}`, {
            category_name: cat.name,
            add_resources: count
          });
          toast.success(`Successfully added ${count} resource(s) to ${cat.name}!`);
        } else {
          await api.post("/resource-categories", {
            category_name: formData.category,
            description: formData.description || `Category for ${formData.category}`,
            icon: "Package",
            initial_resource_count: count
          });
          toast.success(`Category and ${count} item(s) created!`);
        }
      }

      handleCancel();
      await refreshAssets();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "Failed to save resource");
    } finally {
      setIsSaving(false);
    }
  };

  // Category CRUD Handlers
  const handleEditCategoryClick = (cat: any) => {
    setEditingCategoryId(cat.id);
    setCategoryFormData({
      name: cat.name,
      description: cat.description || "",
      icon: cat.icon || "Package",
      totalItems: cat.totalItems || 0,
      valuation: cat.valuation || 0
    });
    setIsAddingCategoryMode(true);
  };

  const handleDeleteCategory = async (id: string) => {
    const catToDelete = categories.find(c => c.id === id);
    const catName = catToDelete?.name || "this category";

    const isConfirmed = await confirm({
      title: "Delete Category",
      message: `Are you sure you want to delete category "${catName}"? This will also remove all associated inventory items.`,
      destructive: true,
      confirmText: "Delete Category"
    });
    if (!isConfirmed) return;

    try {
      await api.delete(`/resource-categories/${id}`);
      toast.success(`Category "${catName}" deleted successfully.`);
      await refreshAssets();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "Failed to delete category");
    }
  };

  const handleSaveCategory = async () => {
    if (!categoryFormData.name.trim()) {
      toast.error("Category name is required");
      return;
    }

    setIsSaving(true);
    try {
      const countToAdd = editingCategoryId
        ? (parseInt(newResourceCount) || 0)
        : (categoryFormData.totalItems || 0);

      const countToRemove = editingCategoryId
        ? (parseInt(removeResourceCount) || 0)
        : 0;

      if (editingCategoryId) {
        await api.put(`/resource-categories/${editingCategoryId}`, {
          category_name: categoryFormData.name.trim(),
          description: categoryFormData.description.trim(),
          icon: categoryFormData.icon || "Package",
          add_resources: countToAdd > 0 ? countToAdd : undefined,
          remove_resources: countToRemove > 0 ? countToRemove : undefined
        });
        toast.success("Category updated successfully!");
      } else {
        await api.post("/resource-categories", {
          category_name: categoryFormData.name.trim(),
          description: categoryFormData.description.trim(),
          icon: categoryFormData.icon || "Package",
          total_resources: countToAdd > 0 ? countToAdd : 0,
          initial_resource_count: countToAdd > 0 ? countToAdd : 0
        });
        toast.success("Category created successfully!");
      }

      handleCancelCategory();
      await refreshAssets();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "Failed to save category");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelCategory = () => {
    setIsAddingCategoryMode(false);
    setEditingCategoryId(null);
    setCategoryFormData(initialCategoryFormState);
    setIsAddingResourceCount(false);
    setNewResourceCount("");
    setRemoveResourceCount("");
  };

  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <RefreshCw className="w-8 h-8 text-brand-teal animate-spin" />
      </div>
    );
  }

  const hasAccess = Boolean(user);

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-4 px-4">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
          <Wrench className="w-10 h-10 text-red-600" />
        </div>
        <h2 className="text-3xl font-bold text-foreground">Access Denied</h2>
        <p className="text-muted-foreground text-center max-w-md">
          This section is restricted to Admin and HR personnel only. Please contact your administrator if you believe this is an error.
        </p>
        <Button 
          className="bg-brand-teal hover:bg-brand-teal-light text-white"
          onClick={() => window.location.href = "/"}
        >
          Return to Dashboard
        </Button>
      </div>
    );
  }

  const rawResources = (inventoryItems.length > 0 ? inventoryItems : (data?.assets || [])).filter((r: any) => !deletedResourceIds.includes(r.id));
  const currentUserName = (user?.name || `${user?.firstName || ""} ${user?.lastName || ""}`).trim().toLowerCase();

  const allResources = isEmployeeOnly 
    ? rawResources.filter((r: any) => r.assignedTo && r.assignedTo.trim().toLowerCase() === currentUserName)
    : rawResources;
  const filteredResources = allResources.filter((res: any) => {
    const matchStatus = statusFilter === "all" || res.status.toLowerCase() === statusFilter.toLowerCase();
    const matchType = typeFilter === "all" || res.category === typeFilter;
    const matchEmployee = isEmployeeOnly || employeeFilter === "all" || (res.assignedTo && res.assignedTo.trim().toLowerCase() === employeeFilter.trim().toLowerCase());
    const matchSearch = searchTerm === "" || 
                        res.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        res.assetId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        res.serialNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchStatus && matchType && matchEmployee && matchSearch;
  });
  
  const { items: sortedResources, requestSort: requestSortResources, sortConfig: sortConfigResources } = useSortableData(filteredResources);

  const paginatedResources = sortedResources.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Calculate statistics using live backend dashboardData if present
  const totalAssetsCount = dashboardData?.total_assets ?? allResources.length;
  const allocatedCount = dashboardData?.allocated_assets ?? allResources.filter((r: any) => r.status === "Allocated").length;
  const availableCount = dashboardData?.available_assets ?? allResources.filter((r: any) => r.status === "Available").length;
  const maintenanceCount = dashboardData?.in_maintenance ?? allResources.filter((r: any) => r.status === "Maintenance").length;
  const assignmentRate = dashboardData?.assignment_rate ?? (totalAssetsCount > 0 ? Math.round((allocatedCount / totalAssetsCount) * 100) : 0);
  const totalValue = allResources.reduce((acc: number, r: any) => acc + (r.value || 0), 0);

  // Group by categories fetched dynamically
  const categoryStats = (dashboardData?.category_summary && dashboardData.category_summary.length > 0)
    ? dashboardData.category_summary.map((catSummary: any) => {
        const catInfo = categories.find(c => c.name === catSummary.category_name || c.id === catSummary.category_id) || {};
        return {
          id: catSummary.category_id,
          name: catSummary.category_name,
          icon: catInfo.icon || "Package",
          description: catInfo.description || "",
          total: catSummary.total_items,
          allocated: catSummary.allocated_items ?? catSummary.allocated_assigned ?? 0,
          available: catSummary.available_stock,
          maintenance: catSummary.in_maintenance,
          valuation: catInfo.valuation || 0,
          valuation_calculated: 0,
          totalItems: catSummary.total_items,
          allocationRate: catSummary.allocation_ratio
        };
      })
    : categories.map(cat => {
        const items = allResources.filter((r: any) => r.category === cat.name);
        const catTotal = cat.totalItems || items.length;
        const catAllocated = items.filter((r: any) => r.status === "Allocated").length;
        const catAvailable = cat.availableStock || items.filter((r: any) => r.status === "Available").length;
        const catMaintenance = cat.inMaintenance || items.filter((r: any) => r.status === "Maintenance").length;
        const catValuation = items.reduce((acc: number, r: any) => acc + (r.value || 0), 0);
        const allocationRate = catTotal > 0 ? Math.round((catAllocated / catTotal) * 100) : 0;
        return {
          id: cat.id,
          name: cat.name,
          icon: cat.icon || "Package",
          description: cat.description || "",
          total: catTotal,
          allocated: catAllocated,
          available: catAvailable,
          maintenance: catMaintenance,
          valuation: cat.valuation || 0,
          valuation_calculated: catValuation,
          totalItems: cat.totalItems || 0,
          allocationRate
        };
      });

  const { items: sortedCategoryStats, requestSort: requestSortCategories, sortConfig: sortConfigCategories } = useSortableData(categoryStats);

  if (isAddingMode) {
    return (
      <div className="space-y-6 pb-10 animate-in fade-in-50 duration-200">
        <div className="flex flex-col gap-4">
          <div className="flex items-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <span className="cursor-pointer hover:text-brand-teal transition-colors" onClick={handleCancel}>Resource Management</span>
            <ChevronRight className="w-3.5 h-3.5 mx-1.5 text-muted-foreground/60" />
            <span className="text-brand-teal">{editingId ? "Edit Resource" : "Add Resource"}</span>
          </div>
          
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{editingId ? "Edit Inventory Item" : "Add New Inventory Item"}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {editingId ? "Modify specific details for this asset item." : "Create and register a new item in the organization's registry catalog."}
            </p>
          </div>
        </div>

        <div className="bg-white border border-border rounded-2xl shadow-sm w-full overflow-hidden mt-2">
          <div className="p-6 border-b border-border bg-gray-50/50">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Archive className="w-5 h-5 text-brand-teal" />
              Item Technical Specifications
            </h3>
            <p className="text-sm text-muted-foreground mt-1">{editingId ? "Modify the specification details of the existing inventory asset." : "Provide detailed information to add this item to the organization's resource catalog."}</p>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground flex items-center gap-1.5"><Hash className="w-4 h-4 text-muted-foreground" /> Asset Code (Asset ID)</label>
                <Input 
                  placeholder="e.g. HK-LAP-001 (auto-generated if empty)" 
                  className="bg-white focus-visible:ring-brand-teal" 
                  value={formData.assetId}
                  onChange={(e) => setFormData({...formData, assetId: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground/80 flex items-center gap-1.5"><Tag className="w-4 h-4 text-muted-foreground" /> Category <span className="text-red-500">*</span></label>
                <Select value={formData.category} onValueChange={handleCategoryChange}>
                  <SelectTrigger className="w-full bg-white focus-visible:ring-brand-teal">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat: any) => (
                      <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground flex items-center gap-1.5"><User className="w-4 h-4 text-muted-foreground" /> Assign To</label>
                <Select 
                  value={(() => {
                    if (!formData.assignedTo && !formData.assignedToEmpId) return "unassigned";
                    const cleaned = String(formData.assignedTo || "").replace(/\s*\([A-Z0-9-]+\)$/i, "").trim().toLowerCase();
                    const empId = String(formData.assignedToEmpId || "").trim();

                    const emp = realEmployees.find((e: any) => {
                      const eId = String(e.id || e._id || "").trim();
                      const eName = String(e.name || e.displayName || "").trim().toLowerCase();
                      if (empId && eId === empId) return true;
                      if (cleaned && (eName === cleaned || eName.startsWith(cleaned) || cleaned.startsWith(eName))) return true;
                      return false;
                    });

                    return emp ? emp.name : (formData.assignedTo || "unassigned");
                  })()}
                  onValueChange={(val) => {
                    if (val === "unassigned" || !val) {
                      setFormData(prev => ({ ...prev, assignedTo: "", assignedToEmpId: "", status: "Available" }));
                    } else {
                      const emp = realEmployees.find((e: any) => e.name === val || e.id === val);
                      setFormData(prev => ({ ...prev, assignedTo: emp ? emp.name : val, assignedToEmpId: emp ? emp.id : "", status: "Allocated" }));
                    }
                  }}
                >
                  <SelectTrigger className="w-full bg-white focus-visible:ring-brand-teal">
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">-- Unassigned / Clear --</SelectItem>
                    {realEmployees.map((emp: any) => (
                      <SelectItem key={emp.id} value={emp.name}>
                        {emp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground/80 flex items-center gap-1.5"><ShieldAlert className="w-4 h-4 text-muted-foreground" /> Condition State</label>
                <Select value={formData.condition} onValueChange={(val) => setFormData({...formData, condition: val})}>
                  <SelectTrigger className="w-full bg-white focus-visible:ring-brand-teal">
                    <SelectValue placeholder="Select physical state" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="New">New / Sealed</SelectItem>
                    <SelectItem value="Good">Good / Working</SelectItem>
                    <SelectItem value="Fair">Fair / Refurbished</SelectItem>
                    <SelectItem value="Poor">Poor / Damaged</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground/80 flex items-center gap-1.5"><Activity className="w-4 h-4 text-muted-foreground" /> Inventory Status</label>
                <Select value={formData.status} onValueChange={handleStatusChange}>
                  <SelectTrigger className="w-full bg-white focus-visible:ring-brand-teal">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Available">Available (In Stock)</SelectItem>
                    <SelectItem value="Allocated">Allocated (Assigned)</SelectItem>
                    <SelectItem value="Maintenance">Maintenance (Repair)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {!editingId && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground flex items-center gap-1.5"><Plus className="w-4 h-4 text-muted-foreground" /> Resource Count</label>
                  <Input 
                    type="number"
                    min="1"
                    placeholder="1"
                    className="bg-white focus-visible:ring-brand-teal" 
                    value={formData.resourceCount || 1}
                    onChange={(e) => setFormData({...formData, resourceCount: Math.max(1, parseInt(e.target.value) || 1)})}
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground/80 flex items-center gap-1.5"><FileText className="w-4 h-4 text-muted-foreground" /> Description & Technical Notes</label>
              <Textarea 
                placeholder="Add hardware configuration specs, license keys, warranty details, etc..." 
                className="h-28 resize-none bg-white focus-visible:ring-brand-teal" 
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
              />
            </div>


          </div>
          
          <div className="p-6 border-t border-border flex justify-end gap-3 bg-gray-50/50">
            <Button variant="outline" className="font-medium bg-white" onClick={handleCancel} disabled={isSaving}>Cancel</Button>
            <Button 
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md"
              onClick={handleSaveResource}
              disabled={isSaving}
            >
              {isSaving ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              {isSaving ? "Saving..." : (editingId ? "Update Item" : "Save Resource")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Resource & Inventory Management</h1>
      </div>

      {/* Tab Navigation */}
      {!isEmployeeOnly && (
        <div className="flex border-b border-border bg-gray-50/50 p-1.5 rounded-xl max-w-full sm:max-w-2xl overflow-x-auto shadow-sm border">
          <button 
            onClick={() => setActiveTab("overview")} 
            className={`flex-1 min-h-[44px] sm:min-h-0 whitespace-nowrap shrink-0 py-2 px-3 text-xs sm:text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-all ${activeTab === "overview" ? "bg-white text-emerald-700 shadow-sm border border-emerald-200" : "text-muted-foreground hover:text-foreground"}`}
          >
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            Dashboard
          </button>
          <button 
            onClick={() => setActiveTab("registry")} 
            className={`flex-1 min-h-[44px] sm:min-h-0 whitespace-nowrap shrink-0 py-2 px-3 text-xs sm:text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-all ${activeTab === "registry" ? "bg-white text-emerald-700 shadow-sm border border-emerald-200" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Archive className="w-4 h-4 text-emerald-600" />
            Inventory ({allResources.length})
          </button>
          <button 
            onClick={() => setActiveTab("categories")} 
            className={`flex-1 py-2 px-3 text-xs sm:text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-all ${activeTab === "categories" ? "bg-white text-emerald-700 shadow-sm border border-emerald-200" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Layers className="w-4 h-4 text-emerald-600" />
            Categories ({categories.length})
          </button>
        </div>
      )}

      {activeTab === "overview" && !isEmployeeOnly && (
        <div className="space-y-8 animate-in fade-in-50 duration-200">
          {/* Top Level KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white border border-border rounded-2xl p-6 shadow-sm flex items-center justify-between group hover:border-brand-teal/30 transition-all hover:shadow-md">
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Assets</span>
                <h3 className="text-3xl font-bold text-foreground mt-1">{totalAssetsCount}</h3>
                <span className="text-xs text-muted-foreground mt-2 inline-block">Registered inventory</span>
              </div>
              <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 transition-transform group-hover:scale-110">
                <Archive className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white border border-border rounded-2xl p-6 shadow-sm flex items-center justify-between group hover:border-brand-teal/30 transition-all hover:shadow-md">
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Allocated Assets</span>
                <h3 className="text-3xl font-bold text-foreground mt-1">{allocatedCount}</h3>
                <span className="text-xs text-blue-600 font-medium mt-2 inline-block">
                  {assignmentRate}% assignment rate
                </span>
              </div>
              <div className="w-12 h-12 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center text-blue-600 transition-transform group-hover:scale-110">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white border border-border rounded-2xl p-6 shadow-sm flex items-center justify-between group hover:border-brand-teal/30 transition-all hover:shadow-md">
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">In Maintenance</span>
                <h3 className="text-3xl font-bold text-foreground mt-1">{maintenanceCount}</h3>
                <span className="text-xs text-amber-600 font-medium mt-2 inline-block">Requiring attention</span>
              </div>
              <div className="w-12 h-12 bg-amber-50 border border-amber-100 rounded-xl flex items-center justify-center text-amber-600 transition-transform group-hover:scale-110">
                <Wrench className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Category Breakdown Table */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Layers className="w-5 h-5 text-brand-teal" />
                Category Inventory Summary
              </h3>
            </div>
            <div className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto min-w-0">
                <table className="w-full text-sm text-left whitespace-nowrap min-w-[700px]">
                  <thead className="text-xs text-muted-foreground font-semibold border-b border-border bg-gray-50/50 uppercase tracking-wider">
                    <tr>
                      <SortableHeader label="Category Name" sortKey="name" currentSort={sortConfigCategories} onSort={requestSortCategories} className="px-6 py-4" />
                      <SortableHeader label="Total Items" sortKey="total" currentSort={sortConfigCategories} onSort={requestSortCategories} className="px-6 py-4 text-center" />
                      <SortableHeader label="Available Stock" sortKey="available" currentSort={sortConfigCategories} onSort={requestSortCategories} className="px-6 py-4 text-center" />
                      <SortableHeader label="Allocated (Assigned)" sortKey="allocated" currentSort={sortConfigCategories} onSort={requestSortCategories} className="px-6 py-4 text-center" />
                      <SortableHeader label="In Maintenance" sortKey="maintenance" currentSort={sortConfigCategories} onSort={requestSortCategories} className="px-6 py-4 text-center" />
                      <SortableHeader label="Allocation Ratio" sortKey="allocationRate" currentSort={sortConfigCategories} onSort={requestSortCategories} className="px-6 py-4" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {sortedCategoryStats.map((cat: any) => (
                      <tr key={cat.name} className="hover:bg-gray-50/30 transition-colors">
                        <td className="px-6 py-4 font-medium text-foreground">
                          <span className="font-semibold text-sm">{cat.name}</span>
                        </td>
                        <td className="px-6 py-4 text-center font-semibold text-foreground text-sm">
                          {cat.total}
                        </td>
                        <td className="px-6 py-4 text-center text-sm">
                          <span className={cat.available > 0 ? "text-emerald-700 font-semibold" : "text-muted-foreground"}>
                            {cat.available}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center text-sm">
                          <span className={cat.allocated > 0 ? "text-blue-700 font-semibold" : "text-muted-foreground"}>
                            {cat.allocated}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center text-sm">
                          <span className={cat.maintenance > 0 ? "text-amber-700 font-semibold" : "text-muted-foreground"}>
                            {cat.maintenance || "-"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-24 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                              <div className="bg-brand-teal h-1.5 rounded-full transition-all" style={{ width: `${cat.allocationRate}%` }}></div>
                            </div>
                            <span className="text-xs font-semibold text-muted-foreground w-8">{cat.allocationRate}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {(activeTab === "registry" || isEmployeeOnly) && (
        <div className="bg-white border border-border rounded-2xl shadow-sm flex flex-col animate-in fade-in-50 duration-200">
          <div className="p-6 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-foreground">Asset Catalog</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Add, allocate, check health, and track all physical resources.</p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              {!isEmployeeOnly && (
                <Button 
                  onClick={() => setIsPrintModalOpen(true)} 
                  variant="outline"
                  className="w-full sm:w-auto bg-white border-border text-foreground hover:bg-gray-50 flex items-center gap-2"
                >
                  <Printer className="w-4 h-4 text-brand-teal" />
                  Print Labels
                </Button>
              )}
              <div className="relative w-full sm:w-64">
                <RefreshCw className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground ${isLoading ? 'animate-spin text-brand-teal' : ''}`} />
                <Input 
                  placeholder="Search name, ID, SN..." 
                  className="pl-9 bg-gray-50 border-border focus-visible:ring-brand-teal" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[140px] bg-gray-50">
                    <SelectValue placeholder="Select Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="allocated">Allocated</SelectItem>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-full sm:w-[150px] bg-gray-50">
                    <SelectValue placeholder="Select Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!isEmployeeOnly && (
                  <div className="w-full sm:w-[180px]">
                    <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
                      <SelectTrigger className="w-full bg-gray-50">
                        <SelectValue placeholder="Select Employee" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Employees</SelectItem>
                        {realEmployees.map((emp: any) => (
                          <SelectItem key={emp.id} value={emp.name}>{emp.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto min-w-0">
            <table className="w-full text-sm text-left whitespace-nowrap min-w-[700px]">
              <thead className="text-xs text-muted-foreground font-semibold border-b border-border bg-gray-50/50 uppercase tracking-wider">
                <tr>
                  <SortableHeader label="Resource ID" sortKey="assetId" currentSort={sortConfigResources} onSort={requestSortResources} className="px-6 py-4" />
                  <SortableHeader label="Category" sortKey="category" currentSort={sortConfigResources} onSort={requestSortResources} className="px-6 py-4" />
                  <SortableHeader label="Condition" sortKey="condition" currentSort={sortConfigResources} onSort={requestSortResources} className="px-6 py-4 text-center" />
                  <SortableHeader label="Status" sortKey="status" currentSort={sortConfigResources} onSort={requestSortResources} className="px-6 py-4" />
                  <SortableHeader label="Assigned To" sortKey="assignedTo" currentSort={sortConfigResources} onSort={requestSortResources} className="px-6 py-4" />
                  {!isEmployeeOnly && <th className="px-6 py-4 font-bold text-foreground text-right sticky right-0 z-20 bg-[#f9fafb] shadow-[-1px_0_0_0_#e2e8f0]">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredResources.length === 0 ? (
                  <tr>
                    <td colSpan={isEmployeeOnly ? 5 : 6} className="px-6 py-10 text-center text-muted-foreground">
                      {isLoading ? "Loading resources..." : "No resources matching the criteria found."}
                    </td>
                  </tr>
                ) : paginatedResources.map((res: any) => {
                  const matchedCat = categories.find(c => c.name === res.category) || { icon: "Package" };
                  return (
                    <tr 
                      key={res.id} 
                      className="hover:bg-gray-50/30 transition-colors"
                    >

                      <td className={`px-6 py-4 text-xs font-semibold text-muted-foreground font-mono ${!isEmployeeOnly ? 'cursor-pointer hover:bg-gray-50/50' : ''}`} onClick={isEmployeeOnly ? undefined : (e) => { e.stopPropagation(); setEditingCell({ id: res.id, field: 'assetId' }); setTempValue(res.assetId); }}>
                        {editingCell?.id === res.id && editingCell?.field === 'assetId' ? (
                          <Input 
                            value={tempValue} 
                            onChange={(e) => setTempValue(e.target.value)} 
                            onBlur={() => handleInlineSave(res.id, 'assetId', tempValue)}
                            onKeyDown={(e) => handleKeyDown(e, res.id, 'assetId')}
                            autoFocus
                            className="h-8 py-1 text-sm bg-white font-mono"
                          />
                        ) : (
                          res.assetId
                        )}
                      </td>
                      <td className={`px-6 py-4 text-muted-foreground text-xs font-semibold ${!isEmployeeOnly ? 'cursor-pointer hover:bg-gray-50/50' : ''}`} onClick={isEmployeeOnly ? undefined : (e) => { e.stopPropagation(); setEditingCell({ id: res.id, field: 'category' }); setTempValue(res.category); }}>
                        {editingCell?.id === res.id && editingCell?.field === 'category' ? (
                          <Select value={tempValue} onValueChange={(val) => handleInlineSave(res.id, 'category', val)}>
                            <SelectTrigger className="h-8 bg-white text-xs">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent onClick={(e) => e.stopPropagation()}>
                              {categories.map((cat: any) => (
                                <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          res.category
                        )}
                      </td>
                      <td className={`px-6 py-4 text-center ${!isEmployeeOnly ? 'cursor-pointer hover:bg-gray-50/50' : ''}`} onClick={isEmployeeOnly ? undefined : (e) => { e.stopPropagation(); setEditingCell({ id: res.id, field: 'condition' }); setTempValue(res.condition || 'Good'); }}>
                        {editingCell?.id === res.id && editingCell?.field === 'condition' ? (
                          <Select value={tempValue} onValueChange={(val) => handleInlineSave(res.id, 'condition', val)}>
                            <SelectTrigger className="h-8 bg-white text-xs mx-auto w-24">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent onClick={(e) => e.stopPropagation()}>
                              <SelectItem value="New">New</SelectItem>
                              <SelectItem value="Good">Good</SelectItem>
                              <SelectItem value="Fair">Fair</SelectItem>
                              <SelectItem value="Poor">Poor</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${getConditionBadge(res.condition || "Good")}`}>
                            {res.condition || "Good"}
                          </span>
                        )}
                      </td>

                      <td className={`px-6 py-4 ${!isEmployeeOnly ? 'cursor-pointer hover:bg-gray-50/50' : ''}`} onClick={isEmployeeOnly ? undefined : (e) => { e.stopPropagation(); setEditingCell({ id: res.id, field: 'status' }); setTempValue(res.status); }}>
                        {editingCell?.id === res.id && editingCell?.field === 'status' ? (
                          <Select value={tempValue} onValueChange={(val) => handleInlineSave(res.id, 'status', val)}>
                            <SelectTrigger className="h-8 bg-white text-xs w-28">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent onClick={(e) => e.stopPropagation()}>
                              <SelectItem value="Available">Available</SelectItem>
                              <SelectItem value="Allocated">Allocated</SelectItem>
                              <SelectItem value="Maintenance">Maintenance</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className={`inline-flex px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wide uppercase border ${getStatusBadge(res.status)}`}>
                            {res.status}
                          </span>
                        )}
                      </td>
                      <td className={`px-6 py-4 ${!isEmployeeOnly ? 'cursor-pointer hover:bg-gray-50/50' : ''}`} onClick={isEmployeeOnly ? undefined : (e) => { e.stopPropagation(); setEditingCell({ id: res.id, field: 'assignedTo' }); setTempValue(res.assignedTo || 'unassigned'); }}>
                        {editingCell?.id === res.id && editingCell?.field === 'assignedTo' ? (
                          <Select 
                            value={(() => {
                              const current = tempValue || res.assignedTo;
                              if (!current || current === "unassigned") return "unassigned";
                              const cleaned = String(current).replace(/\s*\([A-Z0-9-]+\)$/i, "").trim();
                              const emp = realEmployees.find((e: any) => e.name === cleaned || e.displayName === cleaned || e.id === cleaned || (res.assignedToEmpId && e.id === res.assignedToEmpId));
                              return emp ? emp.name : (cleaned || "unassigned");
                            })()} 
                            onValueChange={(val) => handleInlineSave(res.id, 'assignedTo', val)}
                          >
                            <SelectTrigger className="h-8 bg-white text-xs min-w-[160px]">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent onClick={(e) => e.stopPropagation()}>
                              <SelectItem value="unassigned">-- Unassigned --</SelectItem>
                              {realEmployees.map((emp: any) => (
                                <SelectItem key={emp.id} value={emp.name}>
                                  {emp.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : res.assignedTo ? (() => {
                          const matchedEmp = realEmployees.find((e: any) => 
                            (res.assignedToEmpId && String(e.id) === String(res.assignedToEmpId)) ||
                            e.name.toLowerCase() === res.assignedTo.toLowerCase() ||
                            e.name.toLowerCase().startsWith(res.assignedTo.toLowerCase()) ||
                            res.assignedTo.toLowerCase().startsWith(e.name.toLowerCase())
                          );
                          const fullName = matchedEmp ? matchedEmp.name : res.assignedTo;
                          return (
                            <div className="flex items-center gap-2">
                              <Avatar className="w-6 h-6 border">
                                <AvatarImage src={matchedEmp?.avatar || res.avatar || ""} />
                                <AvatarFallback className="bg-brand-light text-brand-teal text-[10px] font-bold">
                                  {fullName.split(' ').map((n: string) => n[0]).join('')}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-semibold text-foreground text-xs">{fullName}</span>
                            </div>
                          );
                        })() : (
                          <span className="text-muted-foreground text-xs">Unassigned</span>
                        )}
                      </td>
                      {!isEmployeeOnly && (
                        <td className="px-6 py-4 text-right sticky right-0 z-10 bg-white group-hover:bg-slate-50 shadow-[-1px_0_0_0_#e2e8f0] transition-colors" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="w-8 h-8 text-muted-foreground hover:text-brand-teal hover:bg-brand-light/50 rounded-lg"
                              title="View Resource Logs"
                              onClick={() => setSelectedItemForLogs({ type: 'resource', id: res.id, name: res.name || res.assetId })}
                            >
                              <History className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="w-8 h-8 text-muted-foreground hover:text-brand-teal hover:bg-brand-light/50 rounded-lg"
                              onClick={() => handleEditClick(res)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="w-8 h-8 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-lg"
                              onClick={() => handleDeleteResource(res.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {/* Pagination stripped */}
        </div>
      )}

      {activeTab === "categories" && !isEmployeeOnly && (
        <div className="space-y-6 animate-in fade-in-50 duration-200">
          {isAddingCategoryMode ? (
            <div className="bg-white border border-border rounded-2xl shadow-sm max-w-xl overflow-hidden">
              <div className="p-6 border-b border-border bg-gray-50/50">
                <h3 className="text-md font-bold text-foreground">
                  {editingCategoryId ? "Edit Asset Category" : "Add New Asset Category"}
                </h3>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-foreground">Category Name *</label>
                  <Input 
                    placeholder="e.g. Printer, Software License, Desk" 
                    value={categoryFormData.name}
                    onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                  />
                </div>

                {!editingCategoryId ? (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground">Total Resources (Count)</label>
                    <Input 
                      type="number"
                      min="0"
                      placeholder="e.g. 10" 
                      value={categoryFormData.totalItems || ""}
                      onChange={(e) => setCategoryFormData({ ...categoryFormData, totalItems: parseInt(e.target.value) || 0 })}
                    />
                    <p className="text-[10px] text-muted-foreground">Items will be automatically created in inventory when the category is saved.</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-foreground">Total Resources</label>
                      <Input 
                        type="number"
                        disabled
                        value={categoryFormData.totalItems || allResources.filter((r: any) => r.category === categoryFormData.name).length}
                        className="bg-muted cursor-not-allowed"
                      />
                      <p className="text-[10px] text-muted-foreground">Current inventory count (read-only).</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-foreground">Add New Resources (Count)</label>
                        <Input 
                          type="number"
                          min="0"
                          placeholder="e.g. 5" 
                          value={newResourceCount}
                          onChange={(e) => setNewResourceCount(e.target.value)}
                        />
                        <p className="text-[10px] text-muted-foreground">Type a number to add new items to the inventory upon category update.</p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-foreground">Remove Resources (Count)</label>
                        <Input 
                          type="number"
                          min="0"
                          placeholder="e.g. 2" 
                          value={removeResourceCount}
                          onChange={(e) => setRemoveResourceCount(e.target.value)}
                        />
                        <p className="text-[10px] text-muted-foreground">Type a number to deduct items from the inventory upon category update.</p>
                      </div>
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-bold text-foreground">Category Description</label>
                  <Textarea 
                    placeholder="Brief description about the type of resources in this category..."
                    className="h-20 resize-none"
                    value={categoryFormData.description}
                    onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                  />
                </div>
              </div>
              <div className="p-6 border-t border-border flex justify-end gap-3 bg-gray-50/50">
                <Button variant="outline" size="sm" onClick={handleCancelCategory}>Cancel</Button>
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md" size="sm" onClick={handleSaveCategory} disabled={isSaving}>
                  {isSaving ? "Saving..." : (editingCategoryId ? "Update Category" : "Save Category")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-border rounded-2xl shadow-sm flex flex-col">
              <div className="p-6 border-b border-border flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Asset Categories</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Perform CRUD operations on inventory asset classifications.</p>
                </div>
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md" size="sm" onClick={() => setIsAddingCategoryMode(true)}>
                  <Plus className="w-4 h-4 mr-1.5" />
                  Add Category
                </Button>
              </div>

              <div className="overflow-x-auto min-w-0">
                <table className="w-full text-sm text-left whitespace-nowrap min-w-[650px]">
                  <thead className="text-xs text-muted-foreground font-semibold border-b border-border bg-gray-50/50 uppercase tracking-wider">
                    <tr>
                      <SortableHeader label="Category" sortKey="name" currentSort={sortConfigCategories} onSort={requestSortCategories} className="px-6 py-4" />
                      <SortableHeader label="Description" sortKey="description" currentSort={sortConfigCategories} onSort={requestSortCategories} className="px-6 py-4" />
                      <SortableHeader label="Total Resources" sortKey="total" currentSort={sortConfigCategories} onSort={requestSortCategories} className="px-6 py-4" />
                      <th className="px-6 py-4 font-bold text-foreground text-right sticky right-0 z-20 bg-[#f9fafb] shadow-[-1px_0_0_0_#e2e8f0]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {sortedCategoryStats.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-10 text-center text-muted-foreground">
                          {categoriesLoading ? "Syncing categories..." : "No categories found. Click 'Add Category' to create one."}
                        </td>
                      </tr>
                    ) : sortedCategoryStats.map((cat: any) => (
                      <tr key={cat.id} className="hover:bg-gray-50/30 transition-colors">
                        <td className="px-6 py-4 font-medium text-foreground">
                          <span className="font-semibold text-sm">{cat.name}</span>
                        </td>
                        <td className="px-6 py-4 text-xs text-muted-foreground">
                          {cat.description || "No description provided."}
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-foreground">
                          {cat.total}
                        </td>
                        <td className="px-6 py-4 text-right sticky right-0 z-10 bg-white group-hover:bg-slate-50 shadow-[-1px_0_0_0_#e2e8f0] transition-colors">
                          <div className="flex justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="w-8 h-8 text-muted-foreground hover:text-brand-teal hover:bg-brand-light/50 rounded-lg"
                              title="View Category Logs"
                              onClick={() => setSelectedItemForLogs({ type: 'category', id: cat.id, name: cat.name })}
                            >
                              <History className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="w-8 h-8 text-muted-foreground hover:text-brand-teal hover:bg-brand-light/50 rounded-lg"
                              onClick={() => handleEditCategoryClick(cat)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="w-8 h-8 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-lg"
                              onClick={() => { apiRefresh(); handleDeleteCategory(cat.id); }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "history" && !isEmployeeOnly && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in-50 duration-200">
          {/* Inventory Logs Panel */}
          <div className="bg-white border border-border rounded-2xl shadow-sm flex flex-col overflow-hidden">
            <div className="p-6 border-b border-border bg-gray-50/50">
              <h3 className="text-md font-bold text-foreground flex items-center gap-2">
                <Archive className="w-5 h-5 text-brand-teal" />
                Inventory Logs
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Logs for individual resources & inventory updates.</p>
            </div>
            
            <div className="p-6 divide-y divide-border overflow-y-auto max-h-[500px]">
              {logsLoading ? (
                <div className="text-center py-10 text-xs text-muted-foreground">Loading logs...</div>
              ) : inventoryLogs.length === 0 ? (
                <div className="text-center py-10 text-xs text-muted-foreground">No inventory logs found.</div>
              ) : (
                inventoryLogs.map((log: any, idx: number) => (
                  <div key={log.id || idx} className="py-3 first:pt-0 last:pb-0 text-xs space-y-1">
                    <div className="flex justify-between items-start">
                      <span className="font-semibold text-foreground">{log.action}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">{formatLogTime(log.timestamp)}</span>
                    </div>
                    <p className="text-muted-foreground">{log.details}</p>
                    <div className="text-[10px] text-brand-teal/80 font-medium">
                      By: {log.userName}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Category Logs Panel */}
          <div className="bg-white border border-border rounded-2xl shadow-sm flex flex-col overflow-hidden">
            <div className="p-6 border-b border-border bg-gray-50/50">
              <h3 className="text-md font-bold text-foreground flex items-center gap-2">
                <Layers className="w-5 h-5 text-brand-teal" />
                Category Logs
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Logs for asset category creation & updates.</p>
            </div>
            
            <div className="p-6 divide-y divide-border overflow-y-auto max-h-[500px]">
              {logsLoading ? (
                <div className="text-center py-10 text-xs text-muted-foreground">Loading logs...</div>
              ) : categoryLogs.length === 0 ? (
                <div className="text-center py-10 text-xs text-muted-foreground">No category logs found.</div>
              ) : (
                categoryLogs.map((log: any, idx: number) => (
                  <div key={log.id || idx} className="py-3 first:pt-0 last:pb-0 text-xs space-y-1">
                    <div className="flex justify-between items-start">
                      <span className="font-semibold text-foreground">{log.action}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">{formatLogTime(log.timestamp)}</span>
                    </div>
                    <p className="text-muted-foreground">{log.details}</p>
                    <div className="text-[10px] text-brand-teal/80 font-medium">
                      By: {log.userName}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {selectedItemForLogs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-border rounded-2xl shadow-xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="p-6 border-b border-border bg-gray-50/50 flex justify-between items-center">
              <div>
                <h3 className="text-md font-bold text-foreground">
                  Activity Logs: {selectedItemForLogs.name}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5 uppercase tracking-wider font-semibold">
                  Type: {selectedItemForLogs.type}
                </p>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-muted-foreground hover:text-foreground h-8 px-2"
                onClick={() => setSelectedItemForLogs(null)}
              >
                Close
              </Button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1 divide-y divide-border">
              {itemLogsLoading ? (
                <div className="text-center py-12 text-sm text-muted-foreground flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-brand-teal" />
                  <span>Loading logs...</span>
                </div>
              ) : itemLogs.length === 0 ? (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  No activity logs recorded for this item.
                </div>
              ) : (
                itemLogs.map((log: any, idx: number) => (
                  <div key={log.id || idx} className="py-3.5 first:pt-0 last:pb-0 text-xs space-y-1.5">
                    <div className="flex justify-between items-start gap-4">
                      <span className="font-semibold text-foreground text-sm">{log.action}</span>
                      <span className="text-[10px] text-muted-foreground font-mono bg-gray-100 px-1.5 py-0.5 rounded">{formatLogTime(log.timestamp)}</span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">{log.details}</p>
                    <div className="text-[10px] text-brand-teal/80 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-brand-teal rounded-full"></span>
                      Performed by: {log.userName}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border flex justify-end bg-gray-50/30">
              <Button 
                className="bg-brand-teal hover:bg-brand-teal-light text-white font-medium shadow-sm text-xs px-4 py-2 h-9" 
                onClick={() => setSelectedItemForLogs(null)}
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      <PrintLabelsModal 
        isOpen={isPrintModalOpen} 
        onClose={() => setIsPrintModalOpen(false)} 
        resources={filteredResources}
      />
    </div>
  );
}
