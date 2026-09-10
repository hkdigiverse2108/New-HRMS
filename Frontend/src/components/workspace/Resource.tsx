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
import { toast } from "sonner";
import { PrintLabelsModal } from "./PrintLabelsModal";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableHeader } from "@/components/ui/sortable-header";

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

  const refreshAssets = async () => {
    try {
      const response = await fetch(`${API_URL}/assets`);
      if (response.ok) {
        updateData('assets', await response.json());
      }
    } catch (e) {
      console.error(e);
    }
  };
  
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
  
  // Dynamic categories and logs
  const [categories, setCategories] = useState<any[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
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

  const { checkPermission, isAdmin, permissionsLoading } = { checkPermission: (a: any, b: any) => true, isAdmin: true, permissionsLoading: false };
  const isEmployeeOnly = !isAdmin && user?.role?.toLowerCase() !== "hr";
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    if (isEmployeeOnly) {
      setActiveTab("registry");
    }
  }, [isEmployeeOnly]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, typeFilter, employeeFilter]);

  const fetchCategories = async () => {
    setCategoriesLoading(true);
    try {
      const response = await fetch(`${API_URL}/asset-categories`);
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error("Failed to fetch categories:", error);
    } finally {
      setCategoriesLoading(false);
    }
  };

  const fetchLogs = async () => {
    setLogsLoading(true);
    try {
      const [assetsRes, categoriesRes] = await Promise.all([
        fetch(`${API_URL}/assets/logs`),
        fetch(`${API_URL}/asset-categories/logs`)
      ]);
      
      if (assetsRes.ok) {
        setInventoryLogs(await assetsRes.json());
      }
      if (categoriesRes.ok) {
        setCategoryLogs(await categoriesRes.json());
      }
    } catch (error) {
      console.error("Failed to fetch logs:", error);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchLogs();
  }, []);

  useEffect(() => {
    if (activeTab === "history") {
      fetchLogs();
    }
    if (activeTab === "categories") {
      fetchCategories();
    }
  }, [activeTab]);

  const fetchItemLogs = async (type: 'category' | 'resource', id: string) => {
    setItemLogsLoading(true);
    try {
      const url = type === 'category' 
        ? `${API_URL}/asset-categories/logs?category_id=${id}`
        : `${API_URL}/assets/logs?asset_id=${id}`;
        
      const response = await fetch(url);
      if (response.ok) {
        setItemLogs(await response.json());
      } else {
        setItemLogs([]);
      }
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
      const payload: any = {
        [field]: value,
        performedBy: user?.id || user?.employeeId || "System",
        userName: user?.name || `${user?.firstName} ${user?.lastName}` || "System User"
      };

      if (field === "assignedTo") {
        if (value && value !== "unassigned") {
          payload.status = "Allocated";
        } else {
          payload.assignedTo = "";
          payload.status = "Available";
        }
      }
      
      if (field === "status" && value !== "Allocated") {
        payload.assignedTo = "";
      }

      const response = await fetch(`${API_URL}/assets/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        toast.success("Asset updated successfully");
        refreshAssets();
        fetchLogs();
      } else {
        toast.error("Failed to update asset");
      }
    } catch (error) {
      console.error(error);
      toast.error("An error occurred");
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
    const isConfirmed = await confirm({
      title: "Delete Resource",
      message: "Are you sure you want to delete this resource?",
      destructive: true,
      confirmText: "Delete"
    });
    if (!isConfirmed) return;

    // Optimistically hide from UI instantly
    setDeletedResourceIds(prev => [...prev, id]);

    try {
      const perfBy = user?.id || user?.employeeId || "System";
      const uName = user?.name || `${user?.firstName} ${user?.lastName}` || "System User";
      const response = await fetch(`${API_URL}/assets/${id}?performedBy=${encodeURIComponent(perfBy)}&userName=${encodeURIComponent(uName)}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Resource deleted successfully");
        refreshAssets();
        fetchCategories();
        fetchLogs();
      } else {
        // Revert on failure
        setDeletedResourceIds(prev => prev.filter(item => item !== id));
        toast.error("Failed to delete resource");
      }
    } catch (error) {
      console.error(error);
      // Revert on failure
      setDeletedResourceIds(prev => prev.filter(item => item !== id));
      toast.error("An error occurred while deleting");
    }
  };

  const handleCancel = () => {
    setIsAddingMode(false);
    setEditingId(null);
    setFormData(initialFormState);
  };

  const handleSaveResource = async () => {
    const finalName = formData.name || formData.category;
    if (!finalName || !formData.category) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSaving(true);
    try {
      const url = editingId ? `${API_URL}/assets/${editingId}` : `${API_URL}/assets`;
      const method = editingId ? "PUT" : "POST";
      
      const count = !editingId ? (formData.resourceCount || 1) : 1;
      
      for (let i = 0; i < count; i++) {
        const payload = {
          ...formData,
          name: finalName,
          performedBy: user?.id || user?.employeeId || "System",
          userName: user?.name || `${user?.firstName} ${user?.lastName}` || "System User"
        };

        if (!editingId) {
          if (!formData.assetId) {
            const code = getCategoryCode(formData.category);
            const nextNum = allResources.filter((res: any) => res.category === formData.category).length + 1 + i;
            payload.assetId = `HK-${code}-${String(nextNum).padStart(3, '0')}`;
          } else {
            if (count > 1) {
              payload.assetId = `${formData.assetId}-${i + 1}`;
            }
          }
          if (!formData.serialNumber) {
            payload.serialNumber = `SN-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
          } else if (count > 1) {
            payload.serialNumber = `${formData.serialNumber}-${i + 1}`;
          }
        }

        const response = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error("Failed to save one of the items");
        }
      }

      toast.success(editingId ? "Resource updated successfully" : `Successfully added ${count} resource(s)`);
      handleCancel();
      refreshAssets();
      fetchLogs();
    } catch (error) {
      console.error(error);
      toast.error("An error occurred");
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
    const catName = catToDelete?.name;
    const resourceCount = catName ? allResources.filter((r: any) => r.category === catName).length : 0;

    const isConfirmed = await confirm({
      title: "Delete Category",
      message: `Are you sure you want to delete "${catName}"? This will also permanently delete all ${resourceCount} resource(s) in this category.`,
      destructive: true,
      confirmText: "Delete All"
    });
    if (!isConfirmed) return;

    // Instantly hide category and its resources from UI
    setCategories(prev => prev.filter(cat => cat.id !== id));
    if (catName) {
      const idsToRemove = allResources.filter((r: any) => r.category === catName).map((r: any) => r.id);
      setDeletedResourceIds(prev => [...prev, ...idsToRemove]);
    }

    try {
      const perfBy = user?.id || user?.employeeId || "System";
      const uName = user?.name || "System User";

      // Step 1: Delete all assets for this category using dedicated endpoint
      if (catName) {
        await fetch(`${API_URL}/assets/by-category/${encodeURIComponent(catName)}?performedBy=${encodeURIComponent(perfBy)}&userName=${encodeURIComponent(uName)}`, {
          method: "DELETE",
        });
      }

      // Step 2: Delete the category itself
      const response = await fetch(`${API_URL}/asset-categories/${id}?performedBy=${encodeURIComponent(perfBy)}&userName=${encodeURIComponent(uName)}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success(`Category "${catName}" and all its resources deleted.`);
        // Clear all deleted IDs and do a full fresh fetch
        setDeletedResourceIds([]);
        await fetchCategories();
        refreshAssets();
        fetchLogs();
      } else {
        fetchCategories();
        refreshAssets();
        toast.error("Failed to delete category");
      }
    } catch (error) {
      console.error(error);
      fetchCategories();
      refreshAssets();
      toast.error("An error occurred while deleting category");
    }
  };

  const handleSaveCategory = async () => {
    if (!categoryFormData.name) {
      toast.error("Category name is required");
      return;
    }

    setIsSaving(true);
    try {
      const url = editingCategoryId ? `${API_URL}/asset-categories/${editingCategoryId}` : `${API_URL}/asset-categories`;
      const method = editingCategoryId ? "PUT" : "POST";

      const countToAdd = editingCategoryId
        ? (parseInt(newResourceCount) || 0)
        : (categoryFormData.totalItems || 0);
        
      const countToRemove = editingCategoryId
        ? (parseInt(removeResourceCount) || 0)
        : 0;

      const actualCurrentCount = editingCategoryId
        ? allResources.filter((r: any) => r.category === categoryFormData.name).length
        : 0;
        
      const availableCurrentCount = editingCategoryId
        ? allResources.filter((r: any) => r.category === categoryFormData.name && r.status === "Available").length
        : 0;

      if (countToRemove > availableCurrentCount) {
        toast.error(`Cannot remove ${countToRemove} items. Only ${availableCurrentCount} unassigned items are currently available.`);
        setIsSaving(false);
        return;
      }
        
      const finalTotalItems = Math.max(0, actualCurrentCount + countToAdd - countToRemove);

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...categoryFormData,
          totalItems: finalTotalItems,
          performedBy: user?.id || user?.employeeId || "System",
          userName: user?.name || "System User"
        })
      });

      if (response.ok) {
        if (countToAdd > 0 || countToRemove > 0) {
          if (editingCategoryId) {
            let msg = "Category updated.";
            if (countToAdd > 0) msg += ` ${countToAdd} item(s) added.`;
            if (countToRemove > 0) msg += ` ${countToRemove} item(s) removed.`;
            toast.success(msg);
          } else {
            toast.success(`Category created with ${countToAdd} item(s) added to inventory!`);
          }
        } else {
          toast.success(editingCategoryId ? "Category updated successfully" : "Category added successfully");
        }

        setIsAddingCategoryMode(false);
        setEditingCategoryId(null);
        setCategoryFormData(initialCategoryFormState);
        setIsAddingResourceCount(false);
        setNewResourceCount("");
        setRemoveResourceCount("");
        fetchCategories();
        refreshAssets();
      } else {
        toast.error(editingCategoryId ? "Failed to update category" : "Failed to add category");
      }
    } catch (error) {
      console.error(error);
      toast.error("An error occurred");
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

  if (userLoading || permissionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <RefreshCw className="w-8 h-8 text-brand-teal animate-spin" />
      </div>
    );
  }

  const hasAccess = isAdmin || user?.role?.toLowerCase() === "hr" || checkPermission('resource-management', 'canView');

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

  const rawResources = (data?.assets || []).filter((r: any) => !deletedResourceIds.includes(r.id));
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

  // Calculate statistics
  const allocatedCount = allResources.filter((r: any) => r.status === "Allocated").length;
  const availableCount = allResources.filter((r: any) => r.status === "Available").length;
  const maintenanceCount = allResources.filter((r: any) => r.status === "Maintenance").length;
  const totalValue = allResources.reduce((acc: number, r: any) => acc + (r.value || 0), 0);

  // Group by categories fetched dynamically
  const categoryStats = categories.map(cat => {
    const items = allResources.filter((r: any) => r.category === cat.name);
    const catTotal = items.length;
    const catAllocated = items.filter((r: any) => r.status === "Allocated").length;
    const catAvailable = items.filter((r: any) => r.status === "Available").length;
    const catMaintenance = items.filter((r: any) => r.status === "Maintenance").length;
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
                    const emp = data?.employees?.find((e:any) => (e.name || `${e.firstName} ${e.lastName}`) === formData.assignedTo);
                    return emp ? `${formData.assignedTo}|${emp.id}` : (formData.assignedTo || "unassigned");
                  })()}
                  onValueChange={handleAssignToChange}
                >
                  <SelectTrigger className="w-full bg-white focus-visible:ring-brand-teal">
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">-- Unassigned / Clear --</SelectItem>
                    {data?.employees?.map((emp: any) => {
                      const empName = emp.name || `${emp.firstName} ${emp.lastName}`;
                      return (
                        <SelectItem key={emp.id} value={`${empName}|${emp.id}`}>
                          {empName}
                        </SelectItem>
                      );
                    })}
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
              className="bg-brand-teal hover:bg-brand-teal-light text-white font-medium shadow-sm"
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
        <div className="flex border-b border-border bg-gray-50/50 p-1.5 rounded-xl max-w-2xl shadow-sm border">
          <button 
            onClick={() => setActiveTab("overview")} 
            className={`flex-1 py-2 px-3 text-xs sm:text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-all ${activeTab === "overview" ? "bg-white text-brand-teal shadow-sm border" : "text-muted-foreground hover:text-foreground"}`}
          >
            <TrendingUp className="w-4 h-4" />
            Dashboard
          </button>
          <button 
            onClick={() => setActiveTab("registry")} 
            className={`flex-1 py-2 px-3 text-xs sm:text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-all ${activeTab === "registry" ? "bg-white text-brand-teal shadow-sm border" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Archive className="w-4 h-4" />
            Inventory ({allResources.length})
          </button>
          <button 
            onClick={() => setActiveTab("categories")} 
            className={`flex-1 py-2 px-3 text-xs sm:text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-all ${activeTab === "categories" ? "bg-white text-brand-teal shadow-sm border" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Layers className="w-4 h-4" />
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
                <h3 className="text-3xl font-bold text-foreground mt-1">{allResources.length}</h3>
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
                  {allResources.length > 0 ? Math.round((allocatedCount / allResources.length) * 100) : 0}% assignment rate
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
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left whitespace-nowrap">
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
                    {sortedCategoryStats.map(cat => (
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
                        {data?.employees?.map((emp: any) => {
                          const name = emp.name || `${emp.firstName} ${emp.lastName}`;
                          return <SelectItem key={emp.id} value={name}>{name}</SelectItem>;
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
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
                              const emp = data?.employees?.find((e:any) => (e.name || `${e.firstName} ${e.lastName}`) === tempValue);
                              return emp ? `${tempValue}|${emp.id}` : (tempValue || "unassigned");
                            })()} 
                            onValueChange={(val) => {
                              const actualVal = val && val.includes('|') ? val.split('|')[0] : val;
                              handleInlineSave(res.id, 'assignedTo', actualVal);
                            }}
                          >
                            <SelectTrigger className="h-8 bg-white text-xs w-36">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent onClick={(e) => e.stopPropagation()}>
                              <SelectItem value="unassigned">-- Unassigned --</SelectItem>
                              {data?.employees?.map((emp: any) => {
                                const empName = emp.name || `${emp.firstName} ${emp.lastName}`;
                                return (
                                  <SelectItem key={emp.id} value={`${empName}|${emp.id}`}>
                                    {empName}
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        ) : res.assignedTo ? (
                          <div className="flex items-center gap-2">
                            <Avatar className="w-6 h-6 border">
                              <AvatarImage src={res.avatar || ""} />
                              <AvatarFallback className="bg-brand-light text-brand-teal text-[10px] font-bold">
                                {res.assignedTo.split(' ').map((n: string) => n[0]).join('')}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-semibold text-foreground text-xs">{res.assignedTo}</span>
                          </div>
                        ) : (
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
                        value={allResources.filter((r: any) => r.category === categoryFormData.name).length}
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
                <Button className="bg-brand-teal hover:bg-brand-teal-light text-white font-medium shadow-sm" size="sm" onClick={handleSaveCategory} disabled={isSaving}>
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
                <Button className="bg-brand-teal hover:bg-brand-teal-light text-white font-medium shadow-sm" size="sm" onClick={() => setIsAddingCategoryMode(true)}>
                  <Plus className="w-4 h-4 mr-1.5" />
                  Add Category
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left whitespace-nowrap">
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
                      <span className="text-[10px] text-muted-foreground font-mono">{log.timestamp}</span>
                    </div>
                    <p className="text-muted-foreground">{log.details}</p>
                    <div className="text-[10px] text-brand-teal/80 font-medium">
                      By: {log.userName} ({log.performedBy})
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
                      <span className="text-[10px] text-muted-foreground font-mono">{log.timestamp}</span>
                    </div>
                    <p className="text-muted-foreground">{log.details}</p>
                    <div className="text-[10px] text-brand-teal/80 font-medium">
                      By: {log.userName} ({log.performedBy})
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
                      <span className="text-[10px] text-muted-foreground font-mono bg-gray-100 px-1.5 py-0.5 rounded">{log.timestamp}</span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">{log.details}</p>
                    <div className="text-[10px] text-brand-teal/80 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-brand-teal rounded-full"></span>
                      Performed by: {log.userName} ({log.performedBy})
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
