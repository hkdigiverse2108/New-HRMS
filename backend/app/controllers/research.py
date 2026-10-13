from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional
from app.schemas.research import ResearchCreate, ResearchUpdate, ResearchResponse
from app.schemas.pagination import PaginatedResponse
from app.services.research import ResearchService
from app.controllers.auth import get_current_employee
from app.redis.service import get_cache, set_cache, clear_pattern, make_list_key

router = APIRouter(prefix="/research", tags=["Research"])

@router.get("", response_model=PaginatedResponse[ResearchResponse])
async def get_all_research(
    department_id: Optional[str] = Query(None, description="Filter by Department ID"),
    department: Optional[str] = Query(None, description="Filter by Department Name or ID"),
    employee_id: Optional[str] = Query(None, description="Filter by Employee ID"),
    project_id: Optional[str] = Query(None, description="Filter by Project ID"),
    date: Optional[str] = Query(None, description="Filter by creation date (YYYY-MM-DD)"),
    search: Optional[str] = Query(None, description="Search by title, description or concept"),
    page: Optional[int] = Query(None, ge=1, description="Page number"),
    limit: Optional[int] = Query(None, ge=1, description="Items per page"),
    current_user: dict = Depends(get_current_employee)
):
    dept_filter = department or department_id
    user_id = str(current_user.get("_id") or current_user.get("id"))
    cache_key = make_list_key(
        f"research:list:{user_id}",
        department_id=dept_filter,
        employee_id=employee_id,
        project_id=project_id,
        date=date,
        search=search,
        page=page,
        limit=limit
    )
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    res = await ResearchService.get_all_research(
        department_id=dept_filter,
        filter_employee_id=employee_id,
        project_id=project_id,
        date_filter=date,
        search_query=search,
        current_user=current_user,
        page=page,
        limit=limit
    )
    await set_cache(cache_key, res, ttl=120)
    return res

@router.get("/{item_id}", response_model=ResearchResponse)
async def get_research_by_id(item_id: str, current_user: dict = Depends(get_current_employee)):
    user_id = str(current_user.get("_id") or current_user.get("id"))
    cache_key = f"research:item:{item_id}:{user_id}"
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    item = await ResearchService.get_research_by_id(item_id, current_user)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Research item not found")
    await set_cache(cache_key, item, ttl=180)
    return item

@router.post("", response_model=ResearchResponse, status_code=status.HTTP_201_CREATED)
async def create_research(data: ResearchCreate, current_user: dict = Depends(get_current_employee)):
    res = await ResearchService.create_research(data, current_user)
    await clear_pattern("research:*")
    return res

@router.put("/{item_id}", response_model=ResearchResponse)
async def update_research(item_id: str, data: ResearchUpdate, current_user: dict = Depends(get_current_employee)):
    item = await ResearchService.get_research_by_id(item_id, current_user)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Research item not found")
        
    emp_id = str(current_user.get("_id") or current_user.get("id"))
    role = current_user.get("work_details", {}).get("system_role", "")
    is_admin = role in ["Admin", "Super Admin"] or current_user.get("id") == "default-admin-id"
    is_creator = item.get("employee_id") == emp_id
    is_shared = emp_id in item.get("shared_with", [])
    
    if not (is_admin or is_creator or is_shared):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="You do not have permission to edit this research item"
        )
        
    res = await ResearchService.update_research(item_id, data, current_user)
    await clear_pattern("research:*")
    return res

@router.delete("/{item_id}", status_code=status.HTTP_200_OK)
async def delete_research(item_id: str, current_user: dict = Depends(get_current_employee)):
    item = await ResearchService.get_research_by_id(item_id, current_user)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Research item not found")
        
    emp_id = str(current_user.get("_id") or current_user.get("id"))
    role = current_user.get("work_details", {}).get("system_role", "")
    is_admin = role in ["Admin", "Super Admin"] or current_user.get("id") == "default-admin-id"
    is_creator = item.get("employee_id") == emp_id
    
    if not (is_admin or is_creator):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Only the creator of this research item or an Admin can delete it"
        )
        
    success = await ResearchService.delete_research(item_id, current_user)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to delete research item")
    await clear_pattern("research:*")
    return {"message": "Research item deleted successfully"}
