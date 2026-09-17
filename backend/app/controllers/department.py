from fastapi import APIRouter, Depends, status, Query
from typing import List, Optional
from app.schemas.department import DepartmentCreate, DepartmentUpdate, DepartmentOut
from app.schemas.pagination import PaginatedResponse
from app.services.department import DepartmentService
from app.controllers.auth import RoleChecker, get_current_user
from app.redis.service import get_cache, set_cache, delete_cache, clear_pattern, make_list_key

router = APIRouter(prefix="/departments", tags=["Departments"])

@router.post("", response_model=DepartmentOut, status_code=status.HTTP_201_CREATED)
async def create_department(data: DepartmentCreate, current_user: dict = Depends(RoleChecker(["Admin"]))):
    result = await DepartmentService.create(data)

    # Invalidate all department list caches so the new department appears
    await clear_pattern("*department*")
    await clear_pattern("*employees*")

    # Cache single department by ID
    item_id = str(result.get("_id") or result.get("id"))
    await set_cache(f"department:{item_id}", result)

    return result

@router.get("", response_model=PaginatedResponse[DepartmentOut])
async def get_all_departments(
    page: Optional[int] = Query(None, ge=1),
    limit: Optional[int] = Query(None, ge=1),
    current_user: str = Depends(get_current_user)
):
    cache_key = make_list_key("departments", page=page, limit=limit)

    # 1. Check Redis Cache
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    # 2. Fetch from DB
    response = await DepartmentService.get_all(page=page, limit=limit)

    # 3. Store in Redis without time expiry
    await set_cache(cache_key, response)

    return response

@router.get("/{item_id}", response_model=DepartmentOut)
async def get_department(item_id: str, current_user: str = Depends(get_current_user)):
    cache_key = f"department:{item_id}"

    # 1. Check Redis Cache
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    # 2. Fetch from DB
    item = await DepartmentService.get_by_id(item_id)

    # 3. Store in Redis
    await set_cache(cache_key, item)

    return item

@router.put("/{item_id}", response_model=DepartmentOut)
async def update_department(item_id: str, data: DepartmentUpdate, current_user: dict = Depends(RoleChecker(["Admin"]))):
    updated = await DepartmentService.update(item_id, data)

    # Invalidate single & all department list caches
    await delete_cache(f"department:{item_id}")
    await clear_pattern("*department*")
    await clear_pattern("*employees*")

    # Store updated department in cache
    await set_cache(f"department:{item_id}", updated)

    return updated

@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_department(item_id: str, current_user: dict = Depends(RoleChecker(["Admin"]))):
    result = await DepartmentService.delete(item_id)

    # Invalidate caches
    await delete_cache(f"department:{item_id}")
    await clear_pattern("*department*")
    await clear_pattern("*employees*")

    return result
