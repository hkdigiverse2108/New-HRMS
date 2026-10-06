from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional, List, Any
from app.schemas.sales import (
    LeadBase, LeadCreate, LeadUpdate, LeadOut,
    FollowUp, BulkAssignLeads, BulkDeleteLeads,
    SalesTargetBase, SalesTargetCreate, SalesTargetUpdate, SalesTargetOut,
    SalesSettingsUpdate, SalesSettingsOut, PipelineStageItem
)
from app.repository.sales import SalesRepository
from app.controllers.auth import get_current_employee
from app.redis.service import get_cache, set_cache, clear_pattern, make_list_key

router = APIRouter(tags=["Sales"])

# Helper to check sensitive payment visibility (Audio 8 privacy requirement)
def check_sales_payment_access(current_user: dict, settings: dict) -> bool:
    user_id = str(current_user.get("_id") or current_user.get("id") or "")
    role = str(current_user.get("role") or current_user.get("work_details", {}).get("system_role", "Employee")).strip()
    
    if role in ["Admin", "SuperAdmin", "superadmin", "CEO", "CTO", "Sales Head"]:
        return True
    
    vis = settings.get("payment_visibility") or {}
    allowed_roles = [r.lower() for r in vis.get("allowed_roles", [])]
    if role.lower() in allowed_roles:
        return True
        
    allowed_ids = [str(i) for i in vis.get("allowed_employee_ids", [])]
    if user_id in allowed_ids:
        return True
        
    p = current_user.get("personal_info") or {}
    name = f"{p.get('first_name', '')} {p.get('last_name', '')}".strip() or current_user.get("name") or ""
    allowed_names = [str(n).lower() for n in vis.get("allowed_employee_names", [])]
    if name.lower() in allowed_names:
        return True
        
    return False

# ==============================================================================
# SALES SETTINGS & STAGES (Audio 7 & 8 Dynamic Settings + Redis Cache)
# ==============================================================================
@router.get("/sales/settings", response_model=SalesSettingsOut)
@router.get("/sales-settings", response_model=SalesSettingsOut)
async def get_sales_settings(current_user: dict = Depends(get_current_employee)):
    cache_key = "sales:settings"
    cached = await get_cache(cache_key)
    if cached:
        return cached

    settings_doc = await SalesRepository.get_settings()
    await set_cache(cache_key, settings_doc, ttl=86400)
    return settings_doc

@router.put("/sales/settings", response_model=SalesSettingsOut)
@router.put("/sales-settings", response_model=SalesSettingsOut)
async def update_sales_settings(
    settings_data: SalesSettingsUpdate,
    current_user: dict = Depends(get_current_employee)
):
    role = str(current_user.get("role") or current_user.get("work_details", {}).get("system_role", "Employee")).strip()
    if role not in ["Admin", "SuperAdmin", "superadmin", "CEO", "CTO", "Sales Head"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Admins can modify sales settings")

    user_id = str(current_user.get("_id") or current_user.get("id") or "")
    p = current_user.get("personal_info") or {}
    user_name = f"{p.get('first_name', '')} {p.get('last_name', '')}".strip() or current_user.get("name") or "User"

    update_dict = settings_data.model_dump(by_alias=True, exclude_unset=True)
    updated = await SalesRepository.update_settings(update_dict)

    # Invalidate all sales caches
    await clear_pattern("sales:*")

    # Record non-deletable audit log
    await SalesRepository.record_audit_log(
        action="Updated Sales Settings",
        performed_by=user_id,
        user_name=user_name,
        details={"fields": list(update_dict.keys())}
    )

    return updated


def _require_settings_admin(current_user: dict):
    role = str(current_user.get("role") or current_user.get("work_details", {}).get("system_role", "Employee")).strip()
    if role not in ["Admin", "SuperAdmin", "superadmin", "CEO", "CTO", "Sales Head"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Admins can modify sales settings")


@router.post("/sales/settings/rename-category")
async def rename_sales_category(payload: dict, current_user: dict = Depends(get_current_employee)):
    _require_settings_admin(current_user)
    old_name = str(payload.get("old_name") or "").strip()
    new_name = str(payload.get("new_name") or "").strip()
    if not old_name or not new_name:
        raise HTTPException(status_code=400, detail="old_name and new_name required")
    count = await SalesRepository.rename_category_across_leads(old_name, new_name)
    await clear_pattern("sales:*")
    await clear_pattern("dashboard:overview:*")
    p = current_user.get("personal_info") or {}
    user_name = f"{p.get('first_name', '')} {p.get('last_name', '')}".strip() or current_user.get("name") or "User"
    await SalesRepository.record_audit_log(action=f"Renamed category '{old_name}' → '{new_name}' ({count} leads)", performed_by=str(current_user.get("_id") or current_user.get("id") or ""), user_name=user_name, details={"old": old_name, "new": new_name, "count": count})
    return {"migrated": count}


@router.post("/sales/settings/rename-source")
async def rename_sales_source(payload: dict, current_user: dict = Depends(get_current_employee)):
    _require_settings_admin(current_user)
    old_name = str(payload.get("old_name") or "").strip()
    new_name = str(payload.get("new_name") or "").strip()
    if not old_name or not new_name:
        raise HTTPException(status_code=400, detail="old_name and new_name required")
    count = await SalesRepository.rename_source_across_leads(old_name, new_name)
    await clear_pattern("sales:*")
    return {"migrated": count}


@router.post("/sales/settings/rename-stage")
async def rename_sales_stage(payload: dict, current_user: dict = Depends(get_current_employee)):
    _require_settings_admin(current_user)
    old_name = str(payload.get("old_name") or "").strip()
    new_name = str(payload.get("new_name") or "").strip()
    if not old_name or not new_name:
        raise HTTPException(status_code=400, detail="old_name and new_name required")
    p = current_user.get("personal_info") or {}
    user_name = f"{p.get('first_name', '')} {p.get('last_name', '')}".strip() or current_user.get("name") or "User"
    count = await SalesRepository.rename_stage_across_leads(old_name, new_name, user_name=user_name)
    await clear_pattern("sales:*")
    await clear_pattern("dashboard:overview:*")
    return {"migrated": count}


@router.post("/sales/settings/reassign-category")
async def reassign_deleted_category(payload: dict, current_user: dict = Depends(get_current_employee)):
    _require_settings_admin(current_user)
    deleted_name = str(payload.get("deleted_name") or "").strip()
    default_name = str(payload.get("default_name") or "Others").strip() or "Others"
    count = await SalesRepository.reassign_category_to_default(deleted_name, default_name)
    await clear_pattern("sales:*")
    await clear_pattern("dashboard:overview:*")
    return {"migrated": count}

@router.get("/sales/stages")
@router.get("/sales-stages")
async def get_sales_stages(current_user: dict = Depends(get_current_employee)):
    cache_key = "sales:stages"
    cached = await get_cache(cache_key)
    if cached:
        return cached

    settings_doc = await SalesRepository.get_settings()
    stages = settings_doc.get("stages", [])
    stages = sorted(stages, key=lambda s: s.get("index", 0))
    await set_cache(cache_key, stages, ttl=86400)
    return stages

# ==============================================================================
# SALES DASHBOARD SUMMARY & KPIS (Redis Cached, Audio 7 & 8)
# ==============================================================================
@router.get("/sales/summary")
@router.get("/sales-summary")
async def get_sales_summary(
    period: Optional[str] = Query("month"),
    current_user: dict = Depends(get_current_employee)
):
    user_id = str(current_user.get("_id") or current_user.get("id") or "")
    p = current_user.get("personal_info") or {}
    user_name = f"{p.get('first_name', '')} {p.get('last_name', '')}".strip() or current_user.get("name") or "User"
    role = str(current_user.get("role") or current_user.get("work_details", {}).get("system_role", "Employee")).strip()
    is_admin = role in ["Admin", "SuperAdmin", "superadmin", "HR", "Sales Head", "Sub-Admin", "CEO", "CTO"]

    cache_key = f"sales:summary:{period}:{user_id if not is_admin else 'admin'}"
    cached = await get_cache(cache_key)
    if cached:
        return cached

    summary = await SalesRepository.get_sales_summary(
        user_id=user_id,
        user_name=user_name,
        is_admin=is_admin,
        period=period
    )

    # Redis Cache for 10 minutes (fast dashboard retrieval)
    await set_cache(cache_key, summary, ttl=600)
    return summary

# ==============================================================================
# SALES AUDIT LOGS (Audio 8 [04:32])
# ==============================================================================
@router.get("/sales/audit-logs")
@router.get("/sales-audit-logs")
async def get_sales_audit_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_employee)
):
    logs = await SalesRepository.get_audit_logs(skip=skip, limit=limit, search=search)
    return logs

# ==============================================================================
# LEADS CRUD & OPERATIONS (With Redis Invalidation & Privacy Checks)
# ==============================================================================
@router.get("/leads")
async def get_leads(
    skip: int = Query(0, ge=0),
    limit: int = Query(10000, ge=1),
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    employee: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_employee)
):
    user_id = str(current_user.get("_id") or current_user.get("id") or "")
    p = current_user.get("personal_info") or {}
    user_name = f"{p.get('first_name', '')} {p.get('last_name', '')}".strip() or current_user.get("name") or "User"
    role = str(current_user.get("role") or current_user.get("work_details", {}).get("system_role", "Employee")).strip()
    is_admin = role in ["Admin", "SuperAdmin", "superadmin", "HR", "Sales Head", "Sub-Admin", "CEO", "CTO"]

    # Redis Cache Check
    cache_key = make_list_key(
        "sales:leads",
        skip=skip,
        limit=limit,
        search=search,
        category=category,
        status=status,
        employee=employee,
        user=user_id if not is_admin else "admin"
    )
    cached = await get_cache(cache_key)
    if cached is not None:
        leads = cached
    else:
        leads = await SalesRepository.get_leads(
            skip=skip, 
            limit=limit, 
            search=search, 
            category=category, 
            status=status,
            user_id=user_id,
            user_name=user_name,
            is_admin=is_admin,
            employee_filter=employee
        )
        await set_cache(cache_key, leads, ttl=300)

    # Privacy filter (Audio 8): creator sees own payment, admin sees all, else name-wise access
    settings_doc = await SalesRepository.get_settings()
    has_global_payment_access = check_sales_payment_access(current_user, settings_doc)
    if not has_global_payment_access:
        masked_leads = []
        for l in leads:
            is_own = (
                str(l.get("created_by") or "") == user_id
                or str(l.get("created_by_user_name") or "").lower() == user_name.lower()
                or str(l.get("createdByUserName") or "").lower() == user_name.lower()
            )
            masked_leads.append(l if is_own else SalesRepository.mask_sensitive_lead(l, has_payment_access=False))
        leads = masked_leads

    return leads

@router.post("/leads", status_code=status.HTTP_201_CREATED)
async def create_lead(
    lead_data: LeadCreate,
    current_user: dict = Depends(get_current_employee)
):
    user_id = str(current_user.get("_id") or current_user.get("id") or "")
    p = current_user.get("personal_info") or {}
    user_name = f"{p.get('first_name', '')} {p.get('last_name', '')}".strip() or current_user.get("name") or "User"
    role = str(current_user.get("role") or current_user.get("work_details", {}).get("system_role", "Employee")).strip()
    is_admin = role in ["Admin", "SuperAdmin", "superadmin", "HR", "Sales Head", "Sub-Admin", "CEO", "CTO"]

    lead_dict = lead_data.model_dump(by_alias=True, exclude_unset=True)
    lead_dict["created_by"] = user_id
    lead_dict["created_by_user_name"] = user_name
    lead_dict["createdByUserName"] = user_name

    # Audio 7 Requirement: Any newly added lead enters stage with Index 0 (New Lead)
    if not lead_dict.get("stage") and not lead_dict.get("status"):
        settings_doc = await SalesRepository.get_settings()
        stages = settings_doc.get("stages", [])
        stage_0 = next((s for s in stages if s.get("index") == 0), None)
        if stage_0:
            lead_dict["stage"] = stage_0.get("name", "New Lead")
            lead_dict["status"] = stage_0.get("name", "New Lead")
            lead_dict["stage_index"] = 0
            lead_dict["stageIndex"] = 0

    # Audio 7 [27:30], Audio 8 [05:00]: Check Auto-Assignment
    auto_assigned = False
    owner_val = str(lead_dict.get("owner") or "").strip()
    assigned_val = lead_dict.get("assigned_to") or lead_dict.get("assignedTo")
    has_assigned = bool(assigned_val and len(assigned_val) > 0 and assigned_val != ["Unassigned"])

    if (not owner_val or owner_val in ["Auto", "Unassigned", ""]) and not has_assigned:
        auto_owner = await SalesRepository.get_next_auto_assigned_owner()
        if auto_owner:
            lead_dict["owner"] = auto_owner
            lead_dict["assigned_to"] = [auto_owner]
            lead_dict["assignedTo"] = [auto_owner]
            auto_assigned = True

    if not auto_assigned:
        if not is_admin or not lead_dict.get("owner"):
            lead_dict["owner"] = user_name

        if not is_admin and not lead_dict.get("assigned_to") and not lead_dict.get("assignedTo"):
            lead_dict["assigned_to"] = [user_name]
            lead_dict["assignedTo"] = [user_name]

    created = await SalesRepository.create_lead(lead_dict)

    # Invalidate Redis Caches
    await clear_pattern("sales:*")
    await clear_pattern("dashboard:overview:*")

    # Record Audit Log
    audit_action = (
        f"Created new lead '{created.get('company') or created.get('contact')}' (Auto-assigned to {created.get('owner')} via Round Robin)"
        if auto_assigned
        else f"Created new lead '{created.get('company') or created.get('contact')}'"
    )
    await SalesRepository.record_audit_log(
        action=audit_action,
        performed_by=user_id,
        user_name=user_name,
        lead_id=str(created.get("id")),
        company=created.get("company"),
        contact=created.get("contact"),
        details={"source": created.get("source"), "status": created.get("status"), "owner": created.get("owner")}
    )

    return created

@router.post("/leads/bulk", status_code=status.HTTP_201_CREATED)
async def create_leads_bulk(
    leads_data: List[LeadCreate],
    current_user: dict = Depends(get_current_employee)
):
    p = current_user.get("personal_info") or {}
    user_name = f"{p.get('first_name', '')} {p.get('last_name', '')}".strip() or current_user.get("name") or "User"
    user_id = str(current_user.get("_id") or current_user.get("id") or "")

    dicts = []
    for l in leads_data:
        ld = l.model_dump(by_alias=True, exclude_unset=True)
        if not ld.get("created_by"):
            ld["created_by"] = user_id
        if not ld.get("created_by_user_name"):
            ld["created_by_user_name"] = user_name
            ld["createdByUserName"] = user_name
        dicts.append(ld)

    created_list = await SalesRepository.create_leads_bulk(dicts)

    # Invalidate Redis
    await clear_pattern("sales:*")
    await clear_pattern("dashboard:overview:*")

    # Audit Log
    await SalesRepository.record_audit_log(
        action=f"Bulk imported {len(created_list)} leads",
        performed_by=user_id,
        user_name=user_name,
        details={"count": len(created_list)}
    )

    return created_list

@router.put("/leads/bulk-assign")
async def bulk_assign_leads(
    payload: BulkAssignLeads,
    current_user: dict = Depends(get_current_employee)
):
    p = current_user.get("personal_info") or {}
    user_name = f"{p.get('first_name', '')} {p.get('last_name', '')}".strip() or current_user.get("name") or "User"
    user_id = str(current_user.get("_id") or current_user.get("id") or "")

    count = await SalesRepository.bulk_assign_leads(
        lead_ids=payload.lead_ids,
        assigned_to=payload.assigned_to,
        performed_by=user_id,
        user_name=user_name
    )

    # Invalidate Redis
    await clear_pattern("sales:*")
    await clear_pattern("dashboard:overview:*")

    await SalesRepository.record_audit_log(
        action=f"Assigned {count} leads to {payload.assigned_to}",
        performed_by=user_id,
        user_name=user_name,
        details={"count": count, "assigned_to": payload.assigned_to}
    )

    return {"message": "Leads assigned successfully", "modified_count": count}

@router.post("/leads/bulk-delete")
async def bulk_delete_leads(
    payload: BulkDeleteLeads,
    current_user: dict = Depends(get_current_employee)
):
    p = current_user.get("personal_info") or {}
    user_name = f"{p.get('first_name', '')} {p.get('last_name', '')}".strip() or current_user.get("name") or "User"
    user_id = str(current_user.get("_id") or current_user.get("id") or "")

    count = await SalesRepository.bulk_delete_leads(payload.lead_ids)

    # Invalidate Redis
    await clear_pattern("sales:*")
    await clear_pattern("dashboard:overview:*")

    await SalesRepository.record_audit_log(
        action=f"Bulk deleted {count} leads",
        performed_by=user_id,
        user_name=user_name,
        details={"count": count, "lead_ids": payload.lead_ids}
    )

    return {"message": "Leads deleted successfully", "deleted_count": count}

@router.put("/leads/{lead_id}")
async def update_lead(
    lead_id: str,
    lead_update: LeadUpdate,
    current_user: dict = Depends(get_current_employee)
):
    update_dict = lead_update.model_dump(by_alias=True, exclude_unset=True)
    p = current_user.get("personal_info") or {}
    user_name = f"{p.get('first_name', '')} {p.get('last_name', '')}".strip() or current_user.get("name") or "User"
    user_id = str(current_user.get("_id") or current_user.get("id") or "")
    update_dict["performed_by"] = user_id
    update_dict["user_name"] = user_name

    # Sync stage_index with the renamed/current stage name from settings
    new_stage = update_dict.get("stage") or update_dict.get("status")
    if new_stage:
        try:
            _settings = await SalesRepository.get_settings()
            _stages = sorted(_settings.get("stages", []), key=lambda s: s.get("index", 0))
            for _s in _stages:
                if str(_s.get("name")) == str(new_stage):
                    update_dict["stage_index"] = _s.get("index", 0)
                    update_dict["stageIndex"] = _s.get("index", 0)
                    break
        except Exception:
            pass

    updated = await SalesRepository.update_lead(lead_id, update_dict)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")

    # Privacy: mask payment fields in response if no access (own leads exempt)
    settings_doc = await SalesRepository.get_settings()
    if not check_sales_payment_access(current_user, settings_doc):
        is_own = (
            str(updated.get("created_by") or "") == user_id
            or str(updated.get("created_by_user_name") or "").lower() == user_name.lower()
        )
        if not is_own:
            updated = SalesRepository.mask_sensitive_lead(updated, has_payment_access=False)

    # Invalidate Redis
    await clear_pattern("sales:*")
    await clear_pattern("dashboard:overview:*")

    # Record Audit Log
    status_msg = f"Changed status to '{update_dict.get('status')}'" if "status" in update_dict else "Updated lead details"
    await SalesRepository.record_audit_log(
        action=f"{status_msg} on {updated.get('company') or updated.get('contact')}",
        performed_by=user_id,
        user_name=user_name,
        lead_id=lead_id,
        company=updated.get("company"),
        contact=updated.get("contact"),
        details=update_dict
    )

    return updated

@router.delete("/leads/{lead_id}")
async def delete_lead(
    lead_id: str,
    current_user: dict = Depends(get_current_employee)
):
    lead = await SalesRepository.get_lead_by_id(lead_id)
    success = await SalesRepository.delete_lead(lead_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")

    user_id = str(current_user.get("_id") or current_user.get("id") or "")
    p = current_user.get("personal_info") or {}
    user_name = f"{p.get('first_name', '')} {p.get('last_name', '')}".strip() or current_user.get("name") or "User"

    # Invalidate Redis
    await clear_pattern("sales:*")
    await clear_pattern("dashboard:overview:*")

    await SalesRepository.record_audit_log(
        action=f"Deleted lead '{lead.get('company') or lead.get('contact') if lead else lead_id}'",
        performed_by=user_id,
        user_name=user_name,
        lead_id=lead_id
    )

    return {"message": "Lead deleted successfully"}

@router.post("/leads/{lead_id}/follow-ups")
async def add_lead_follow_up(
    lead_id: str,
    follow_up: FollowUp,
    current_user: dict = Depends(get_current_employee)
):
    p = current_user.get("personal_info") or {}
    user_name = f"{p.get('first_name', '')} {p.get('last_name', '')}".strip() or current_user.get("name") or "User"
    user_id = str(current_user.get("_id") or current_user.get("id") or "")

    fu_dict = follow_up.model_dump(by_alias=True, exclude_unset=True)
    if not fu_dict.get("performed_by"):
        fu_dict["performed_by"] = user_id
    if not fu_dict.get("user_name"):
        fu_dict["user_name"] = user_name

    updated = await SalesRepository.add_follow_up(lead_id, fu_dict, performed_by=user_id, user_name=user_name)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")

    # Invalidate Redis
    await clear_pattern("sales:*")
    await clear_pattern("dashboard:overview:*")

    await SalesRepository.record_audit_log(
        action=f"Logged follow-up ({fu_dict.get('action_type', 'Call')}) on '{updated.get('company') or updated.get('contact')}': {fu_dict.get('note')}",
        performed_by=user_id,
        user_name=user_name,
        lead_id=lead_id,
        company=updated.get("company"),
        contact=updated.get("contact"),
        details=fu_dict
    )

    return updated

@router.put("/leads/{lead_id}/follow-ups/{follow_up_idx}")
async def update_lead_follow_up(
    lead_id: str,
    follow_up_idx: int,
    follow_up: FollowUp,
    current_user: dict = Depends(get_current_employee)
):
    p = current_user.get("personal_info") or {}
    user_name = f"{p.get('first_name', '')} {p.get('last_name', '')}".strip() or current_user.get("name") or "User"
    user_id = str(current_user.get("_id") or current_user.get("id") or "")

    fu_dict = follow_up.model_dump(by_alias=True, exclude_unset=True)
    updated = await SalesRepository.update_follow_up(lead_id, follow_up_idx, fu_dict, performed_by=user_id, user_name=user_name)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead or follow up not found")

    # Invalidate Redis
    await clear_pattern("sales:*")
    await clear_pattern("dashboard:overview:*")

    return updated

# ==============================================================================
# SALES TARGETS (Redis Cached & Invalidated)
# ==============================================================================
@router.get("/sales-targets")
async def get_sales_targets(
    month: Optional[str] = Query(None),
    year: Optional[int] = Query(None),
    type: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_employee)
):
    cache_key = f"sales:targets:{year}:{month}:{type}"
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    targets = await SalesRepository.get_targets(month=month, year=year, target_type=type)
    await set_cache(cache_key, targets, ttl=600)
    return targets

@router.post("/sales-targets", status_code=status.HTTP_201_CREATED)
async def create_sales_target(
    target_data: SalesTargetCreate,
    current_user: dict = Depends(get_current_employee)
):
    target_dict = target_data.model_dump(by_alias=True, exclude_unset=True)
    created = await SalesRepository.create_target(target_dict)

    # Invalidate Redis
    await clear_pattern("sales:*")
    await clear_pattern("dashboard:overview:*")

    return created

@router.put("/sales-targets/{target_id}")
async def update_sales_target(
    target_id: str,
    target_update: SalesTargetUpdate,
    current_user: dict = Depends(get_current_employee)
):
    update_dict = target_update.model_dump(by_alias=True, exclude_unset=True)
    updated = await SalesRepository.update_target(target_id, update_dict)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target not found")

    # Invalidate Redis
    await clear_pattern("sales:*")
    await clear_pattern("dashboard:overview:*")

    return updated

@router.delete("/sales-targets/{target_id}")
async def delete_sales_target(
    target_id: str,
    current_user: dict = Depends(get_current_employee)
):
    success = await SalesRepository.delete_target(target_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target not found")

    # Invalidate Redis
    await clear_pattern("sales:*")
    await clear_pattern("dashboard:overview:*")

    return {"message": "Target deleted successfully"}

# ==============================================================================
# SALES REPORTS (Audio 8 [05:55-07:44], Redis-Cached)
# ==============================================================================
@router.get("/reports")
@router.get("/sales/reports")
async def get_sales_report(
    report_type: str = Query("revenue"),
    date_range: str = Query("this_month"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_employee)
):
    cache_key = f"sales:report:{report_type}:{date_range}:{start_date}:{end_date}"
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    report_data = await SalesRepository.generate_sales_report(
        report_type=report_type,
        date_range=date_range,
        start_date=start_date,
        end_date=end_date
    )
    await set_cache(cache_key, report_data, ttl=300)
    return report_data


