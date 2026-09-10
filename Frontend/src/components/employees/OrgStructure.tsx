import { useState, useEffect } from "react";
import { ORG_DATA, OrgNodeData } from "./org-data";
import { ChevronDown, ChevronUp, Users, ZoomIn, ZoomOut, Maximize, Settings, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ManageDepartmentsModal } from "./ManageDepartmentsModal";
import { AddOrgNodeModal } from "./AddOrgNodeModal";
import { DeleteConfirmModal } from "./DeleteConfirmModal";
import { UnassignedSidebar } from "./UnassignedSidebar";
import { toast } from "sonner";
import { useEmployeesContext } from "./EmployeeContext";

const OrgNodeCard = ({ 
  node, 
  isExpanded, 
  toggleExpand,
  onMoveNode,
  onAddClick,
  onDeleteClick
}: { 
  node: OrgNodeData, 
  isExpanded: boolean, 
  toggleExpand: () => void,
  onMoveNode: (draggedId: string, targetId: string) => void,
  onAddClick: (node: OrgNodeData) => void,
  onDeleteClick: (nodeId: string) => void
}) => {
  const hasChildren = node.children && node.children.length > 0;
  
  return (
    <div 
      draggable
      onDragStart={(e) => { 
        e.dataTransfer.setData('nodeId', node.id); 
        e.stopPropagation(); 
      }}
      onDragOver={(e) => { 
        e.preventDefault(); 
        e.stopPropagation(); 
      }}
      onDrop={(e) => { 
        e.preventDefault(); 
        e.stopPropagation(); 
        const draggedId = e.dataTransfer.getData('nodeId'); 
        if (draggedId) {
          onMoveNode(draggedId, node.id);
        }
      }}
      className="bg-white border border-border shadow-sm rounded-2xl p-4 w-[220px] z-10 relative transition-all hover:shadow-md hover:-translate-y-1 group inline-block mx-auto cursor-grab active:cursor-grabbing"
    >
      <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all z-20">
        <button 
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onAddClick(node);
          }}
          className="p-1.5 bg-muted/50 hover:bg-primary hover:text-primary-foreground text-muted-foreground rounded-lg shadow-sm border border-border transition-colors"
          title="Add report under this person"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
        <button 
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onDeleteClick(node.id);
          }}
          className="p-1.5 bg-muted/50 hover:bg-red-500 hover:text-white text-muted-foreground rounded-lg shadow-sm border border-border transition-colors"
          title="Remove this person"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex flex-col items-center text-center">
        <div className="relative mb-3">
          <img src={node.avatar} alt={node.name} className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-sm pointer-events-none" />
          <span className={cn(
            "absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white",
            node.status === 'Active' ? 'bg-emerald-500' : 
            node.status === 'On Leave' ? 'bg-amber-500' : 'bg-blue-500'
          )} />
        </div>
        <h3 className="text-[14px] font-bold text-foreground mb-0.5">{node.name}</h3>
        <p className="text-[11px] text-muted-foreground font-medium mb-3">{node.role}</p>
        <span className="px-2.5 py-1 bg-muted/50 text-foreground/80 border border-border/50 text-[10px] font-bold uppercase tracking-wider rounded-lg mb-2 inline-block">
          {node.department}
        </span>
        
        {hasChildren && (
          <button 
            onClick={toggleExpand}
            className="mt-2 w-full py-1.5 flex items-center justify-center gap-1.5 bg-muted/50 hover:bg-muted text-foreground/80 rounded-xl transition-colors text-[11px] font-bold"
          >
            <Users className="w-3 h-3" />
            {node.children!.length} Reports
            {isExpanded ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
          </button>
        )}
      </div>
    </div>
  );
};

const OrgTree = ({ 
  node,
  onMoveNode,
  onAddClick,
  onDeleteClick
}: { 
  node: OrgNodeData,
  onMoveNode: (draggedId: string, targetId: string) => void,
  onAddClick: (node: OrgNodeData) => void,
  onDeleteClick: (nodeId: string) => void
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <li className="relative p-[20px] pt-[20px] text-center float-left table-cell org-node">
      <OrgNodeCard 
        node={node} 
        isExpanded={isExpanded} 
        toggleExpand={() => setIsExpanded(!isExpanded)} 
        onMoveNode={onMoveNode}
        onAddClick={onAddClick}
        onDeleteClick={onDeleteClick}
      />
      {hasChildren && isExpanded && (
        <ul className="pt-[20px] relative flex justify-center org-children animate-in fade-in slide-in-from-top-4 duration-300 m-0 p-0">
          {node.children!.map((child) => (
            <OrgTree 
              key={child.id} 
              node={child} 
              onMoveNode={onMoveNode}
              onAddClick={onAddClick}
              onDeleteClick={onDeleteClick}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

export function OrgStructure() {
  const [zoom, setZoom] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedParent, setSelectedParent] = useState<OrgNodeData | null>(null);
  const [nodeToDelete, setNodeToDelete] = useState<OrgNodeData | null>(null);

  const { employees, treeData, updateTree, addEmployee } = useEmployeesContext();

  const handleMoveNode = (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;

    const newTree = JSON.parse(JSON.stringify(treeData)) as OrgNodeData;
    
    // Check if dragging from unassigned
    const unassignedEmployee = employees.find(emp => emp.id === draggedId);
    let draggedNode: OrgNodeData | null = null;
    
    if (draggedId === newTree.id) {
      toast.error("Cannot move the root node");
      return;
    }

    const findNode = (node: OrgNodeData, id: string): OrgNodeData | null => {
      if (node.id === id) return node;
      if (node.children) {
        for (const child of node.children) {
          const found = findNode(child, id);
          if (found) return found;
        }
      }
      return null;
    };

    const nodeToMove = unassignedEmployee || findNode(newTree, draggedId);
    if (!nodeToMove) return;

    if (!unassignedEmployee) {
      let isCircular = false;
      const checkDescendant = (node: OrgNodeData) => {
        if (node.id === targetId) isCircular = true;
        if (node.children) node.children.forEach(checkDescendant);
      };
      checkDescendant(nodeToMove as OrgNodeData);

      if (isCircular) {
        toast.error("Cannot move a manager under their own report");
        return;
      }
    }
    const removeNode = (node: OrgNodeData): boolean => {
      if (node.children) {
        const index = node.children.findIndex(c => c.id === draggedId);
        if (index !== -1) {
          draggedNode = node.children[index] || null;
          node.children.splice(index, 1);
          return true;
        }
        for (const child of node.children) {
          if (removeNode(child)) return true;
        }
      }
      return false;
    };

    if (unassignedEmployee) {
      draggedNode = {
        id: unassignedEmployee.id,
        name: unassignedEmployee.name,
        role: unassignedEmployee.role,
        department: unassignedEmployee.department,
        status: unassignedEmployee.status,
        avatar: unassignedEmployee.avatar,
        children: []
      };
    } else {
      removeNode(newTree);
    }
    
    if (!draggedNode) return;

    const insertNode = (node: OrgNodeData): boolean => {
      if (node.id === targetId) {
        if (!node.children) node.children = [];
        node.children.push(draggedNode!);
        return true;
      }
      if (node.children) {
        for (const child of node.children) {
          if (insertNode(child)) return true;
        }
      }
      return false;
    };

    if (insertNode(newTree)) {
      updateTree(newTree);
      toast.success("Employee moved successfully");
    }
  };

  const handleAddNode = (nodeData: Omit<OrgNodeData, 'id' | 'children'>) => {
    if (!selectedParent) return;

    const newTree = JSON.parse(JSON.stringify(treeData)) as OrgNodeData;
    const newId = `EMP-${Math.random().toString(36).substr(2, 9)}`;
    const insertChild = (node: OrgNodeData): boolean => {
      if (node.id === selectedParent.id) {
        if (!node.children) node.children = [];
        node.children.push({
          ...nodeData,
          id: newId,
        });
        return true;
      }
      if (node.children) {
        for (const child of node.children) {
          if (insertChild(child)) return true;
        }
      }
      return false;
    };

    if (insertChild(newTree)) {
      updateTree(newTree);
      
      // Also add to global employees list
      addEmployee({
        id: newId,
        name: nodeData.name,
        role: nodeData.role,
        department: "Engineering", // default or we can get from nodeData if we add it
        status: "Active",
        email: `${(nodeData.name.split(' ')[0] || "").toLowerCase()}@example.com`,
        phone: "+1 555-0000",
        avatar: nodeData.avatar,
        performanceScore: 85,
        joinDate: new Date().toISOString().split("T")[0] || ""
      });
      
      toast.success(`${nodeData.name} added under ${selectedParent.name}`);
      setAddModalOpen(false);
    }
  };

  const handleDeleteNode = (nodeId: string) => {
    const newTree = JSON.parse(JSON.stringify(treeData)) as OrgNodeData;
    
    if (nodeId === newTree.id) {
      toast.error("Cannot delete the root organization node.");
      return;
    }

    const findNode = (node: OrgNodeData, id: string): OrgNodeData | null => {
      if (node.id === id) return node;
      if (node.children) {
        for (const child of node.children) {
          const found = findNode(child, id);
          if (found) return found;
        }
      }
      return null;
    };

    const node = findNode(newTree, nodeId);
    if (node) {
      setNodeToDelete(node);
    }
  };

  const confirmDelete = () => {
    if (!nodeToDelete) return;
    
    const newTree = JSON.parse(JSON.stringify(treeData)) as OrgNodeData;
    
    const removeNode = (node: OrgNodeData): boolean => {
      if (node.children) {
        const index = node.children.findIndex(c => c.id === nodeToDelete.id);
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
      updateTree(newTree);
      toast.success("Team member unassigned from this branch");
    }
    setNodeToDelete(null);
  };

  return (
    <div className="w-full animate-in fade-in zoom-in-95 duration-300 flex flex-col h-[calc(100vh-4rem)] pb-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 shrink-0">
        <div>
          <h1 className="text-[28px] font-black text-foreground tracking-tight mb-2">Organizational Structure</h1>
          <p className="text-[14px] text-muted-foreground">Visual hierarchy of teams. Drag and drop cards to reorganize.</p>
        </div>
        
        <div className="flex gap-4 items-center">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-border text-foreground/80 font-bold rounded-xl shadow-sm hover:bg-muted/50 transition-colors"
          >
            <Settings className="w-4 h-4" />
            Manage Departments
          </button>
          
          <div className="flex items-center gap-2 bg-white border border-border p-1.5 rounded-2xl shadow-sm">
            <button 
              onClick={() => setZoom(Math.max(0.4, zoom - 0.1))}
              className="p-2 hover:bg-muted rounded-xl text-foreground/80 transition-colors"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-[12px] font-bold text-foreground/80 w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button 
              onClick={() => setZoom(Math.min(2, zoom + 0.1))}
              className="p-2 hover:bg-muted rounded-xl text-foreground/80 transition-colors"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <div className="w-px h-6 bg-slate-200 mx-1"></div>
            <button 
              onClick={() => setZoom(1)}
              className="p-2 hover:bg-muted rounded-xl text-foreground/80 transition-colors"
            >
              <Maximize className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Org Chart Container */}
      <div className="flex-1 flex relative overflow-hidden rounded-3xl border border-border/60 shadow-inner">
        <div className="flex-1 bg-muted/50/50 overflow-auto">
          <style dangerouslySetInnerHTML={{__html: `
            .org-children {
              padding-top: 20px; 
            position: relative;
            transition: all 0.5s;
          }
          
          .org-node {
            float: left; text-align: center;
            list-style-type: none;
            position: relative;
            padding: 20px 10px 0 10px;
            transition: all 0.5s;
          }

          /* Connectors */
          .org-node::before, .org-node::after {
            content: '';
            position: absolute; top: 0; right: 50%;
            border-top: 2px solid #cbd5e1;
            width: 50%; height: 20px;
          }
          .org-node::after {
            right: auto; left: 50%;
            border-left: 2px solid #cbd5e1;
          }

          /* We need to remove left-right connectors from elements without any siblings */
          .org-node:only-child::after, .org-node:only-child::before {
            display: none;
          }

          /* Remove space from the top of single children */
          .org-node:only-child { padding-top: 0; }

          /* Remove left connector from first child and right connector from last child */
          .org-node:first-child::before, .org-node:last-child::after {
            border: 0 none;
          }
          /* Adding back the vertical connector to the last nodes */
          .org-node:last-child::before {
            border-right: 2px solid #cbd5e1;
            border-radius: 0 5px 0 0;
          }
          .org-node:first-child::after {
            border-radius: 5px 0 0 0;
          }

          /* Vertical line going down from parents */
          .org-children::before {
            content: '';
            position: absolute; top: 0; left: 50%;
            border-left: 2px solid #cbd5e1;
            width: 0; height: 20px;
            transform: translateX(-50%);
          }
        `}} />

        <div className="min-w-max p-12 flex justify-center items-start min-h-full">
          <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', transition: 'transform 0.3s ease' }}>
            <ul className="flex justify-center m-0 p-0">
              <OrgTree 
                node={treeData} 
                onMoveNode={handleMoveNode} 
                onAddClick={(node) => {
                  setSelectedParent(node);
                  setAddModalOpen(true);
                }}
                onDeleteClick={handleDeleteNode}
              />
            </ul>
          </div>
        </div>
        </div>
        
        <UnassignedSidebar />
      </div>
      
      <ManageDepartmentsModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />

      <AddOrgNodeModal 
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSubmit={handleAddNode}
        {...(selectedParent?.name ? { parentName: selectedParent.name } : {})}
      />

      <DeleteConfirmModal 
        isOpen={!!nodeToDelete}
        node={nodeToDelete}
        onClose={() => setNodeToDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
