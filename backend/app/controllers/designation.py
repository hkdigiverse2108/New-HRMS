from fastapi import APIRouter, Depends, status, Query
from typing import List
from app.schemas.designation import DesignationCreate, DesignationUpdate, DesignationOut
from app.schemas.pagination import PaginatedResponse
from app.services.designation import DesignationService
from app.controllers.auth import RoleChecker, get_current_user
from app.redis.service import get_cache, set_cache, delete_cache, clear_pattern, make_list_key

router = APIRouter(prefix="/designations", tags=["Designations"])

@router.post("", response_model=DesignationOut, status_code=status.HTTP_201_CREATED)
async def create_designation(data: DesignationCreate, current_user: dict = Depends(RoleChecker(["Admin"]))):
    result = await DesignationService.create(data)

    # Invalidate all designation list caches so the new designation appears
    await clear_pattern("designations:list:*")

    # Cache single designation by ID
    item_id = str(result.get("_id") or result.get("id"))
    await set_cache(f"designation:{item_id}", result)

    return result

@router.get("", response_model=PaginatedResponse[DesignationOut])
async def get_all_designations(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    current_user: str = Depends(get_current_user)
):
    cache_key = make_list_key("designations", page=page, limit=limit)

    # 1. Check Redis Cache
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    # 2. Fetch from DB
    response = await DesignationService.get_all(page, limit)

    # 3. Store in Redis without time expiry
    await set_cache(cache_key, response)

    return response

@router.get("/{item_id}", response_model=DesignationOut)
async def get_designation(item_id: str, current_user: str = Depends(get_current_user)):
    cache_key = f"designation:{item_id}"

    # 1. Check Redis Cache
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    # 2. Fetch from DB
    item = await DesignationService.get_by_id(item_id)

    # 3. Store in Redis
    await set_cache(cache_key, item)

    return item

@router.put("/{item_id}", response_model=DesignationOut)
async def update_designation(item_id: str, data: DesignationUpdate, current_user: dict = Depends(RoleChecker(["Admin"]))):
    updated = await DesignationService.update(item_id, data)

    # Invalidate single & all designation list caches
    await delete_cache(f"designation:{item_id}")
    await clear_pattern("designations:list:*")
    await clear_pattern("employees:list:*")

    # Store updated designation in cache
    await set_cache(f"designation:{item_id}", updated)

    return updated

@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_designation(item_id: str, current_user: dict = Depends(RoleChecker(["Admin"]))):
    result = await DesignationService.delete(item_id)

    # Invalidate caches
    await delete_cache(f"designation:{item_id}")
    await clear_pattern("designations:list:*")
    await clear_pattern("employees:list:*")

    return result
