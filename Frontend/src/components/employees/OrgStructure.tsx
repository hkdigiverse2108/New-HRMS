import { useState, useEffect, useRef } from "react";
import { OrgNodeData, ORG_ROOT_ID } from "./org-data";
import { ChevronDown, ChevronUp, Users, ZoomIn, ZoomOut, Maximize, Settings, Plus, Trash2, Network, Building2, Layers, Briefcase, X, Pencil, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ManageDepartmentsModal } from "./ManageDepartmentsModal";
import { DepartmentDesignationManager } from "./DepartmentDesignationManager";
import { AddOrgNodeModal } from "./AddOrgNodeModal";
import { DeleteConfirmModal } from "./DeleteConfirmModal";
import { UnassignedSidebar } from "./UnassignedSidebar";
import { toast } from "@/lib/toast";
import { useEmployeesContext, type OrgChange } from "./EmployeeContext";
import { useAuth } from "@/components/auth/AuthContext";
import { useModulePermissions } from "@/hooks/useModulePermissions";

const PersonCard = ({
  person,
  isRoot,
  onMoveNode,
  dropTargetId,
  onAddClick,
  onDeleteClick,
  canCreate,
  canUpdate,
  canDelete,
  compact = false,
  footer,
}: {
  person: OrgNodeData,
  isRoot: boolean,
  onMoveNode: (draggedId: string, targetId: string) => void | Promise<void>,
  dropTargetId: string,
  onAddClick?: (() => void) | undefined,
  onDeleteClick: (nodeId: string) => void,
  canCreate?: boolean | undefined,
  canUpdate?: boolean | undefined,
  canDelete?: boolean | undefined,
  compact?: boolean,
  footer?: React.ReactNode,
}) => (
  <div
    draggable={canUpdate && !isRoot}
    onDragStart={(e) => {
      if (!canUpdate) return;
      e.dataTransfer.setData('nodeId', person.id);
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
      if (draggedId) onMoveNode(draggedId, dropTargetId);
    }}
    className={cn(
      "bg-white border border-border shadow-sm rounded-2xl p-4 max-w-[calc(100vw-48px)] z-10 relative transition-all hover:shadow-md hover:-translate-y-1 group/card inline-block mx-auto",
      compact ? "w-[200px]" : "w-[220px]",
      canUpdate && !isRoot ? "cursor-grab active:cursor-grabbing" : ""
    )}
  >
    {((canCreate && onAddClick) || (canDelete && !isRoot)) && (
      <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-100 lg:opacity-0 lg:group-hover/card:opacity-100 lg:focus-within:opacity-100 transition-all z-20">
        {canCreate && onAddClick && (
          <button
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onAddClick();
            }}
            className="p-1.5 min-w-[44px] min-h-[44px] lg:min-w-0 lg:min-h-0 inline-flex items-center justify-center bg-muted/50 hover:bg-primary hover:text-primary-foreground text-muted-foreground rounded-lg shadow-sm border border-border transition-colors"
            title="Add a member below or alongside this person"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
        {canDelete && !isRoot && (
          <button
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onDeleteClick(person.id);
            }}
            className="p-1.5 min-w-[44px] min-h-[44px] lg:min-w-0 lg:min-h-0 inline-flex items-center justify-center bg-muted/50 hover:bg-red-500 hover:text-white text-muted-foreground rounded-lg shadow-sm border border-border transition-colors"
            title="Remove this person"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    )}

    <div className="flex flex-col items-center text-center">
      <div className="relative mb-3">
        <img
          src={person.avatar}
          alt={person.name}
          className={cn(
            "pointer-events-none box-border",
            isRoot
              ? "w-[72px] h-[72px] object-contain rounded-full bg-white p-[13px] border border-border/60 shadow-sm"
              : "w-14 h-14 object-cover rounded-full border-2 border-white shadow-sm"
          )}
        />
        {!isRoot && <span className={cn(
          "absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white",
          person.status === 'Active' ? 'bg-emerald-500' :
            person.status === 'On Leave' ? 'bg-amber-500' : 'bg-blue-500'
        )} />}
      </div>
      <h3 className="text-[14px] font-bold text-foreground mb-0.5 truncate max-w-full" title={person.name}>{person.name}</h3>
      <p className="text-[11px] text-muted-foreground font-medium mb-3 truncate max-w-full">{person.role}</p>
      <span className="px-2.5 py-1 bg-muted/50 text-foreground/80 border border-border/50 text-[10px] font-bold uppercase tracking-wider rounded-lg mb-2 inline-block max-w-full truncate">
        {person.department}
      </span>
      {footer}
    </div>
  </div>
);

const OrgNodeCard = ({
  node,
  isExpanded,
  toggleExpand,
  onMoveNode,
  onAddClick,
  onDeleteClick,
  canCreate = true,
  canUpdate = true,
  canDelete = true,
}: {
  node: OrgNodeData,
  isExpanded: boolean,
  toggleExpand: () => void,
  onMoveNode: (draggedId: string, targetId: string) => void | Promise<void>,
  onAddClick: (node: OrgNodeData) => void,
  onDeleteClick: (nodeId: string) => void,
  canCreate?: boolean | undefined,
  canUpdate?: boolean | undefined,
  canDelete?: boolean | undefined,
}) => {
  const hasChildren = node.children && node.children.length > 0;
  const isRoot = node.id === ORG_ROOT_ID;
  const members = node.members || [];

  const reportsToggle = hasChildren ? (
    <button
      onClick={toggleExpand}
      className="mt-2 w-full py-1.5 flex items-center justify-center gap-1.5 bg-muted/50 hover:bg-muted text-foreground/80 rounded-xl transition-colors text-[11px] font-bold"
    >
      <Users className="w-3 h-3" />
      {node.children!.reduce((n, c) => n + 1 + (c.members?.length || 0), 0)} Reports
      {isExpanded ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
    </button>
  ) : null;

  const common = { isRoot, onMoveNode, dropTargetId: node.id, onDeleteClick, canCreate, canUpdate, canDelete };

  if (members.length === 0) {
    const card = <PersonCard person={node} {...common} onAddClick={() => onAddClick(node)} footer={reportsToggle} />;
    if (!canUpdate || isRoot) return card;
    // Edit mode: show each box as a drop zone
    return (
      <div className="relative z-10 inline-flex rounded-3xl border-2 border-dashed border-emerald-300/70 bg-emerald-50/30 p-4">
        {card}
      </div>
    );
  }

  // Joint stage: several people share one box and the same reports
  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const draggedId = e.dataTransfer.getData('nodeId');
        if (draggedId) onMoveNode(draggedId, node.id);
      }}
      className={cn(
        "relative z-10 inline-flex flex-col items-center gap-3 rounded-3xl p-4 group/box",
        canUpdate
          ? "border-2 border-dashed border-emerald-300/70 bg-emerald-50/30"
          : "border border-emerald-200/70 bg-emerald-50/20"
      )}
    >
      {canCreate && (
        <button
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onAddClick(node);
          }}
          className="absolute -top-3 -right-3 p-1.5 inline-flex items-center justify-center bg-white hover:bg-primary hover:text-primary-foreground text-muted-foreground rounded-lg shadow-sm border border-border transition-colors z-20"
          title="Add members below this group"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      )}
      <div className="flex gap-4">
        {[node, ...members].map((p) => (
          <PersonCard key={p.id} person={p} {...common} compact onAddClick={() => onAddClick(node)} />
        ))}
      </div>
      {reportsToggle && <div className="w-[220px]">{reportsToggle}</div>}
    </div>
  );
};

const OrgTree = ({
  node,
  onMoveNode,
  onAddClick,
  onDeleteClick,
  canCreate,
  canUpdate,
  canDelete,
}: {
  node: OrgNodeData,
  onMoveNode: (draggedId: string, targetId: string) => void | Promise<void>,
  onAddClick: (node: OrgNodeData) => void,
  onDeleteClick: (nodeId: string) => void,
  canCreate?: boolean | undefined,
  canUpdate?: boolean | undefined,
  canDelete?: boolean | undefined,
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
        canCreate={canCreate}
        canUpdate={canUpdate}
        canDelete={canDelete}
      />
      {hasChildren && isExpanded && (
        <ul className="pt-[20px] relative flex justify-center org-children animate-in fade-in slide-from-top-4 duration-300 m-0 p-0">
          {node.children!.map((child) => (
            <OrgTree
              key={child.id}
              node={child}
              onMoveNode={onMoveNode}
              onAddClick={onAddClick}
              onDeleteClick={onDeleteClick}
              canCreate={canCreate}
              canUpdate={canUpdate}
              canDelete={canDelete}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

export function OrgStructure() {
  const { isAdmin } = useModulePermissions("/employees/org");
  // Everyone can view the chart; only Admin and HR can change it
  const { user } = useAuth();
  const anyUser = user as any;
  const userDept = String(anyUser?.department || anyUser?.work_details?.department || "").toLowerCase().trim();
  const userDesig = String(anyUser?.designation || anyUser?.work_details?.designation || "").toLowerCase().trim();
  const userRole = String(anyUser?.role || anyUser?.work_details?.system_role || "").toLowerCase().trim();
  const isHr = userDept === "hr" || userDesig.includes("hr") || userRole === "hr";
  const canEditOrg = isAdmin || isHr;
  // Chart opens in view mode; Admin/HR switch to edit mode with the "Edit Chart" button
  const [isEditMode, setIsEditMode] = useState(false);
  const editing = canEditOrg && isEditMode;
  const canCreate = editing;
  const canUpdate = editing;
  const canDelete = editing;
  const [zoom, setZoom] = useState(1);
  const chartRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === chartRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await chartRef.current?.requestFullscreen();
    } catch {
      toast.error("Fullscreen is not supported in this browser");
    }
  };
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeptDesignationOpen, setIsDeptDesignationOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedParent, setSelectedParent] = useState<OrgNodeData | null>(null);
  const [nodeToDelete, setNodeToDelete] = useState<OrgNodeData | null>(null);

  const { employees, treeData, applyOrgChanges } = useEmployeesContext();

  // Box that contains this person (as main person or as a peer)
  const findNode = (node: OrgNodeData, id: string): OrgNodeData | null => {
    if (node.id === id || (node.members || []).some((m) => m.id === id)) return node;
    for (const child of node.children || []) {
      const found = findNode(child, id);
      if (found) return found;
    }
    return null;
  };

  const findParent = (node: OrgNodeData, id: string): OrgNodeData | null => {
    for (const child of node.children || []) {
      if (child.id === id || (child.members || []).some((m) => m.id === id)) return node;
      const found = findParent(child, id);
      if (found) return found;
    }
    return null;
  };

  // Drag & drop: reassign the dragged person (from the chart or the unassigned pool) to a new manager
  const handleMoveNode = async (draggedId: string, targetId: string) => {
    if (!canUpdate) return;
    if (draggedId === targetId) return;
    if (draggedId === ORG_ROOT_ID) {
      toast.error("Cannot move the root node");
      return;
    }
    const dragged = findNode(treeData, draggedId);
    // Dragging the main person of a joint box moves the whole box; a peer is pulled out on its own
    const movesWholeBox = dragged && dragged.id === draggedId;
    if (movesWholeBox && findNode(dragged, targetId)) {
      toast.error("Cannot move a manager under their own report");
      return;
    }
    const target = findNode(treeData, targetId);
    if (dragged && target && dragged.id === target.id) return; // dropped inside its own box
    const targetId2 = target ? target.id : targetId;
    try {
      await applyOrgChanges([
        ...(movesWholeBox ? detachBoxChanges(dragged!) : []),
        { id: draggedId, reportsTo: targetId2 === ORG_ROOT_ID ? "ROOT" : targetId2 },
      ]);
      toast.success("Reporting line updated");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update the organization structure");
    }
  };

  // Before a box's main person leaves it, hand the box (peers + reports) to the next person in it
  const detachBoxChanges = (box: OrgNodeData): OrgChange[] => {
    const [next, ...rest] = box.members || [];
    if (!next) return [];
    const parent = findParent(treeData, box.id);
    const parentId = parent && parent.id !== ORG_ROOT_ID ? parent.id : "ROOT";
    return [
      { id: next.id, reportsTo: parentId },
      ...rest.map((m) => ({ id: m.id, peerOf: next.id })),
      ...(box.children || []).map((c) => ({ id: c.id, reportsTo: next.id })),
    ];
  };

  // "+" on a card: pick an unassigned employee to place below this box or alongside it (same stage)
  // "+" on a card: place the selected people below this box, separately or together in one box
  const handleAddNode = async (employeeIds: string[], together: boolean) => {
    if (!selectedParent || employeeIds.length === 0) return;
    const names = employeeIds.map((id) => employees.find((e) => e.id === id)?.name || "Employee").join(", ");
    const managerId = selectedParent.id === ORG_ROOT_ID ? "ROOT" : selectedParent.id;
    try {
      const [first, ...rest] = employeeIds;
      // Close straight away; the chart updates instantly and the save runs in one request
      setAddModalOpen(false);
      await applyOrgChanges([
        { id: first!, reportsTo: managerId },
        ...rest.map((id) => (together ? { id, peerOf: first! } : { id, reportsTo: managerId })),
      ]);
      toast.success(`${names} added under ${selectedParent.name}${together && rest.length ? " in one box" : ""}`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update the organization structure");
    }
  };

  const handleDeleteNode = (nodeId: string) => {
    if (nodeId === treeData.id) {
      toast.error("Cannot delete the root organization node.");
      return;
    }
    const box = findNode(treeData, nodeId);
    if (!box) return;
    if (box.id === nodeId) setNodeToDelete(box);
    else {
      // A peer in a joint box: removing it leaves the box and its reports untouched
      const peer = (box.members || []).find((m) => m.id === nodeId);
      if (peer) setNodeToDelete({ ...peer, children: [] });
    }
  };

  // Removing someone from the chart only unassigns them; their reports move up to their manager
  const confirmDelete = async () => {
    if (!nodeToDelete) return;
    const box = findNode(treeData, nodeToDelete.id);
    const changes: OrgChange[] = [];
    if (box && box.id === nodeToDelete.id && (box.members || []).length > 0) {
      changes.push(...detachBoxChanges(box));
    } else if (box && box.id === nodeToDelete.id) {
      const parent = findParent(treeData, nodeToDelete.id);
      const newManager = parent && parent.id !== ORG_ROOT_ID ? parent.id : "ROOT";
      for (const child of nodeToDelete.children || []) changes.push({ id: child.id, reportsTo: newManager });
    }
    changes.push({ id: nodeToDelete.id, reportsTo: null });
    setNodeToDelete(null);
    try {
      await applyOrgChanges(changes);
      toast.success("Team member unassigned from this branch");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update the organization structure");
    }
  };

  const placedIds = new Set<string>();
  const collectIds = (n: OrgNodeData) => {
    placedIds.add(n.id);
    (n.members || []).forEach((m) => placedIds.add(m.id));
    (n.children || []).forEach(collectIds);
  };
  collectIds(treeData);
  const unassignedOptions = employees
    .filter((e) => e.status !== "Inactive" && !placedIds.has(e.id))
    .map((e) => ({ label: `${e.name}${e.designation || e.role ? ` (${e.designation || e.role})` : ""}`, value: e.id }));

  return (
    <div className="w-full animate-in fade-in zoom-in-95 duration-300 flex flex-col h-[calc(100vh-4rem)] pb-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 shrink-0">
        <div>
          <h1 className="text-[28px] font-black text-foreground tracking-tight mb-1">Organizational Structure</h1>
          <p className="text-[14px] text-muted-foreground">{editing ? "Edit mode: drag and drop cards to reorganize, use + to add members." : "Visual hierarchy of teams."}</p>
        </div>

        <div className="flex flex-wrap gap-2 sm:gap-4 items-center">
          {canEditOrg && (
            <button
              onClick={() => setIsEditMode((v) => !v)}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2 font-bold rounded-xl shadow-sm transition-all text-xs active:scale-95 cursor-pointer",
                isEditMode
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : "bg-card border border-border text-foreground/80 hover:bg-muted/50"
              )}
              title={isEditMode ? "Finish editing" : "Edit the organization chart"}
            >
              {isEditMode ? <Check className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
              {isEditMode ? "Done" : "Edit Chart"}
            </button>
          )}
          {canEditOrg && (
            <>
              <button
                onClick={() => setIsDeptDesignationOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2 bg-primary text-primary-foreground font-bold rounded-xl shadow-sm hover:bg-primary/90 transition-all text-xs active:scale-95 cursor-pointer"
                title="Manage Sub-Departments & Designations"
              >
                <Layers className="w-4 h-4" />
                <span>Sub-Departments &amp; Designations</span>
              </button>

              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2 bg-card border border-border text-foreground/80 font-bold rounded-xl shadow-sm hover:bg-muted/50 transition-colors text-xs cursor-pointer"
              >
                <Settings className="w-4 h-4" />
                Manage Departments
              </button>
            </>
          )}

          <div className="flex items-center gap-2 bg-card border border-border p-1.5 rounded-2xl shadow-sm">
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
            <div className="w-px h-6 bg-border mx-1"></div>
            <button
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              className="p-2 hover:bg-muted rounded-xl text-foreground/80 transition-colors cursor-pointer"
            >
              <Maximize className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Org Chart Container */}
      <div ref={chartRef} className="flex-1 flex relative overflow-hidden rounded-3xl border border-border/60 shadow-inner bg-background">
        <div className="flex-1 bg-muted/50/50 overflow-auto">
          <style dangerouslySetInnerHTML={{
            __html: `
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

                .org-node:only-child::after, .org-node:only-child::before {
                  display: none;
                }

                .org-node:only-child { padding-top: 0; }

                .org-node:first-child::before, .org-node:last-child::after {
                  border: 0 none;
                }
                .org-node:last-child::before {
                  border-right: 2px solid #cbd5e1;
                  border-radius: 0 5px 0 0;
                }
                .org-node:first-child::after {
                  border-radius: 5px 0 0 0;
                }

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
                    if (!canCreate) return;
                    setSelectedParent(node);
                    setAddModalOpen(true);
                  }}
                  onDeleteClick={(nodeId) => {
                    if (!canDelete) return;
                    handleDeleteNode(nodeId);
                  }}
                  canCreate={canCreate}
                  canUpdate={canUpdate}
                  canDelete={canDelete}
                />
              </ul>
            </div>
          </div>
        </div>

        {editing && <UnassignedSidebar />}
      </div>

      <ManageDepartmentsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      <AddOrgNodeModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSubmit={handleAddNode}
        options={unassignedOptions}
        {...(selectedParent?.name ? { parentName: selectedParent.name } : {})}
      />

      <DeleteConfirmModal
        isOpen={!!nodeToDelete}
        node={nodeToDelete}
        onClose={() => setNodeToDelete(null)}
        onConfirm={confirmDelete}
      />

      {/* Sub-Departments & Designations Modal Popup */}
      {isDeptDesignationOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-3xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border bg-muted/20 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-xl font-black text-foreground">
                    Sub-Departments &amp; Designations
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Manage departments, sub-departments, and designations
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDeptDesignationOpen(false)}
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <DepartmentDesignationManager hideHeader={true} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
