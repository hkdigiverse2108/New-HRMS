from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from app.schemas.penalty import PenaltyTypeCreate, PenaltyTypeUpdate, PenaltyTypeResponse, EmployeePenaltyCreate, EmployeePenaltyUpdate, EmployeePenaltyResponse
from app.schemas.pagination import PaginatedResponse
from app.services.penalty import PenaltyService
from app.controllers.auth import RoleChecker, get_current_employee

router = APIRouter(prefix="/penalties", tags=["Penalties"])

# Permissions
admin_hr_checker = RoleChecker(["Admin", "Subadmin", "HR"])

# --- Penalty Types ---
@router.post("/types", response_model=PenaltyTypeResponse, status_code=status.HTTP_201_CREATED)
async def create_penalty_type(data: PenaltyTypeCreate, current_user: dict = Depends(admin_hr_checker)):
    return await PenaltyService.create_penalty_type(data)

@router.get("/types", response_model=List[PenaltyTypeResponse])
async def get_penalty_types(current_user: dict = Depends(admin_hr_checker)):
    return await PenaltyService.get_all_penalty_types()

@router.put("/types/{item_id}", response_model=PenaltyTypeResponse)
async def update_penalty_type(item_id: str, data: PenaltyTypeUpdate, current_user: dict = Depends(admin_hr_checker)):
    return await PenaltyService.update_penalty_type(item_id, data)

@router.delete("/types/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_penalty_type(item_id: str, current_user: dict = Depends(admin_hr_checker)):
    return await PenaltyService.delete_penalty_type(item_id)

# --- Employee Penalties ---
@router.post("", response_model=EmployeePenaltyResponse, status_code=status.HTTP_201_CREATED)
async def create_employee_penalty(data: EmployeePenaltyCreate, current_user: dict = Depends(admin_hr_checker)):
    return await PenaltyService.create_employee_penalty(data)

@router.get("", response_model=PaginatedResponse[EmployeePenaltyResponse])
async def get_all_employee_penalties(
    page: Optional[int] = Query(None, ge=1, description="Page number"),
    limit: Optional[int] = Query(None, ge=1, description="Items per page"),
    employee_id: Optional[str] = Query(None, description="Filter by employee ID (Admin/HR only)"),
    penalty_type_id: Optional[str] = Query(None, description="Filter by penalty type ID"),
    start_date: Optional[str] = Query(None, description="Start date in YYYY-MM-DD format"),
    end_date: Optional[str] = Query(None, description="End date in YYYY-MM-DD format"),
    current_user: dict = Depends(get_current_employee)
):
    role = current_user.get("work_details", {}).get("system_role", "Employee")
    
    # If regular Employee, force filter by their own ID (ignoring any passed employee_id)
    if role not in ["Admin", "Subadmin", "HR"]:
        emp_id = str(current_user.get("_id") or current_user.get("id"))
        return await PenaltyService.get_all_penalties(is_deleted=False, employee_id=emp_id, penalty_type_id=penalty_type_id, start_date=start_date, end_date=end_date, page=page, limit=limit)
        
    # If Admin/HR, return all or filter by the requested employee_id
    return await PenaltyService.get_all_penalties(is_deleted=False, employee_id=employee_id, penalty_type_id=penalty_type_id, start_date=start_date, end_date=end_date, page=page, limit=limit)

@router.get("/deleted", response_model=PaginatedResponse[EmployeePenaltyResponse])
async def get_deleted_employee_penalties(
    page: Optional[int] = Query(None, ge=1, description="Page number"),
    limit: Optional[int] = Query(None, ge=1, description="Items per page"),
    current_user: dict = Depends(admin_hr_checker)
):
    return await PenaltyService.get_all_penalties(is_deleted=True, page=page, limit=limit)

@router.get("/leaderboard")
async def get_penalty_leaderboard(current_user: dict = Depends(admin_hr_checker)):
    return await PenaltyService.get_leaderboard()

@router.put("/{item_id}", response_model=EmployeePenaltyResponse)
async def update_employee_penalty(item_id: str, data: EmployeePenaltyUpdate, current_user: dict = Depends(admin_hr_checker)):
    return await PenaltyService.update_employee_penalty(item_id, data)

@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def soft_delete_employee_penalty(item_id: str, current_user: dict = Depends(admin_hr_checker)):
    return await PenaltyService.soft_delete_employee_penalty(item_id)
