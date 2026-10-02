from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional, List, Any
from app.schemas.sales import (
    LeadBase, LeadCreate, LeadUpdate, LeadOut,
    FollowUp, BulkAssignLeads, BulkDeleteLeads,
    SalesTargetBase, SalesTargetCreate, SalesTargetUpdate, SalesTargetOut
)
from app.repository.sales import SalesRepository
from app.controllers.auth import get_current_employee

router = APIRouter(tags=["Sales"])

# Leads Endpoints
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

    lead_dict = lead_data.model_dump(exclude_unset=True)
    # Automatically attach non-admin employee identity
    lead_dict["created_by"] = user_id
    lead_dict["created_by_user_name"] = user_name
    lead_dict["createdByUserName"] = user_name

    if not is_admin or not lead_dict.get("owner"):
        lead_dict["owner"] = user_name

    if not is_admin and not lead_dict.get("assigned_to") and not lead_dict.get("assignedTo"):
        lead_dict["assigned_to"] = [user_name]
        lead_dict["assignedTo"] = [user_name]

    created = await SalesRepository.create_lead(lead_dict)
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
        ld = l.model_dump(exclude_unset=True)
        if not ld.get("created_by"):
            ld["created_by"] = user_id
        if not ld.get("created_by_user_name"):
            ld["created_by_user_name"] = user_name
            ld["createdByUserName"] = user_name
        dicts.append(ld)

    created_list = await SalesRepository.create_leads_bulk(dicts)
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
    return {"message": "Leads assigned successfully", "modified_count": count}

@router.post("/leads/bulk-delete")
async def bulk_delete_leads(
    payload: BulkDeleteLeads,
    current_user: dict = Depends(get_current_employee)
):
    count = await SalesRepository.bulk_delete_leads(payload.lead_ids)
    return {"message": "Leads deleted successfully", "deleted_count": count}

@router.put("/leads/{lead_id}")
async def update_lead(
    lead_id: str,
    lead_update: LeadUpdate,
    current_user: dict = Depends(get_current_employee)
):
    update_dict = lead_update.model_dump(exclude_unset=True)
    p = current_user.get("personal_info") or {}
    user_name = f"{p.get('first_name', '')} {p.get('last_name', '')}".strip() or current_user.get("name") or "User"
    update_dict["performed_by"] = str(current_user.get("_id") or current_user.get("id") or "")
    update_dict["user_name"] = user_name

    updated = await SalesRepository.update_lead(lead_id, update_dict)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    return updated

@router.delete("/leads/{lead_id}")
async def delete_lead(
    lead_id: str,
    current_user: dict = Depends(get_current_employee)
):
    success = await SalesRepository.delete_lead(lead_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
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

    fu_dict = follow_up.model_dump(exclude_unset=True)
    if not fu_dict.get("performed_by"):
        fu_dict["performed_by"] = user_id
    if not fu_dict.get("user_name"):
        fu_dict["user_name"] = user_name

    updated = await SalesRepository.add_follow_up(lead_id, fu_dict, performed_by=user_id, user_name=user_name)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
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

    fu_dict = follow_up.model_dump(exclude_unset=True)
    updated = await SalesRepository.update_follow_up(lead_id, follow_up_idx, fu_dict, performed_by=user_id, user_name=user_name)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead or follow up not found")
    return updated

# Sales Targets Endpoints
@router.get("/sales-targets")
async def get_sales_targets(
    month: Optional[str] = Query(None),
    year: Optional[int] = Query(None),
    type: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_employee)
):
    targets = await SalesRepository.get_targets(month=month, year=year, target_type=type)
    return targets

@router.post("/sales-targets", status_code=status.HTTP_201_CREATED)
async def create_sales_target(
    target_data: SalesTargetCreate,
    current_user: dict = Depends(get_current_employee)
):
    target_dict = target_data.model_dump(by_alias=True, exclude_unset=True)
    created = await SalesRepository.create_target(target_dict)
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
    return updated

@router.delete("/sales-targets/{target_id}")
async def delete_sales_target(
    target_id: str,
    current_user: dict = Depends(get_current_employee)
):
    success = await SalesRepository.delete_target(target_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target not found")
    return {"message": "Target deleted successfully"}
