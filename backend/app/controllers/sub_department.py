from fastapi import APIRouter, Depends, status, Query
from typing import List
from app.schemas.sub_department import SubDepartmentCreate, SubDepartmentUpdate, SubDepartmentOut
from app.schemas.pagination import PaginatedResponse
from app.services.sub_department import SubDepartmentService
from app.controllers.auth import RoleChecker, get_current_user
from app.redis.service import get_cache, set_cache, delete_cache, clear_pattern, make_list_key

router = APIRouter(prefix="/sub-departments", tags=["Sub-Departments"])

@router.post("/", response_model=SubDepartmentOut, status_code=status.HTTP_201_CREATED)
async def create_sub_department(data: SubDepartmentCreate, current_user: dict = Depends(RoleChecker(["Admin"]))):
    result = await SubDepartmentService.create(data)

    # Invalidate all sub-department list caches
    await clear_pattern("sub_departments:list:*")

    # Cache single sub-department by ID
    item_id = str(result.get("_id") or result.get("id"))
    await set_cache(f"sub_department:{item_id}", result)

    return result

@router.get("/", response_model=PaginatedResponse[SubDepartmentOut])
async def get_all_sub_departments(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    current_user: str = Depends(get_current_user)
):
    cache_key = make_list_key("sub_departments", page=page, limit=limit)

    # 1. Check Redis Cache
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    # 2. Fetch from DB
    response = await SubDepartmentService.get_all(page, limit)

    # 3. Store in Redis without time expiry
    await set_cache(cache_key, response)

    return response

@router.get("/{item_id}", response_model=SubDepartmentOut)
async def get_sub_department(item_id: str, current_user: str = Depends(get_current_user)):
    cache_key = f"sub_department:{item_id}"

    # 1. Check Redis Cache
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    # 2. Fetch from DB
    item = await SubDepartmentService.get_by_id(item_id)

    # 3. Store in Redis
    await set_cache(cache_key, item)

    return item

@router.get("/department/{department_id}", response_model=PaginatedResponse[SubDepartmentOut])
async def get_sub_departments_by_department(
    department_id: str, 
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    current_user: str = Depends(get_current_user)
):
    cache_key = make_list_key("sub_departments", department_id=department_id, page=page, limit=limit)

    # 1. Check Redis Cache
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    # 2. Fetch from DB
    response = await SubDepartmentService.get_by_department_id(department_id, page, limit)

    # 3. Store in Redis
    await set_cache(cache_key, response)

    return response

@router.put("/{item_id}", response_model=SubDepartmentOut)
async def update_sub_department(item_id: str, data: SubDepartmentUpdate, current_user: dict = Depends(RoleChecker(["Admin"]))):
    updated = await SubDepartmentService.update(item_id, data)

    # Invalidate single & all sub-department list caches
    await delete_cache(f"sub_department:{item_id}")
    await clear_pattern("sub_departments:list:*")
    await clear_pattern("employees:list:*")

    # Store updated sub-department in cache
    await set_cache(f"sub_department:{item_id}", updated)

    return updated

@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sub_department(item_id: str, current_user: dict = Depends(RoleChecker(["Admin"]))):
    result = await SubDepartmentService.delete(item_id)

    # Invalidate caches
    await delete_cache(f"sub_department:{item_id}")
    await clear_pattern("sub_departments:list:*")
    await clear_pattern("employees:list:*")

    return result
