from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Dict, Any, Optional
from app.schemas.seating import FloorCreate, FloorUpdate, FloorResponse, DeskCreateOrUpdate, SeatAllocateRequest
from app.services.seating import SeatingService
from app.controllers.auth import get_current_employee
from app.redis.service import get_cache, set_cache, clear_pattern, make_list_key

router = APIRouter(prefix="/seating", tags=["Seating Arrangement & Floor Layout Management"])
global_seating_router = APIRouter(tags=["Seating Arrangement"])

@global_seating_router.get("/seating-arrangement", response_model=Dict[str, Any])
async def get_seating_arrangement_direct():
    """Get global seating arrangement layout for all employees."""
    cache_key = "seating:global_layout"
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    res = await SeatingService.get_global_layout()
    if res is not None:
        await set_cache(cache_key, res, ttl=60)
    return res

@global_seating_router.post("/seating-arrangement", response_model=Dict[str, Any])
async def save_seating_arrangement_direct(payload: Dict[str, Any]):
    """Save global seating arrangement layout across all employee views."""
    res = await SeatingService.save_global_layout(payload)
    await clear_pattern("seating:*")
    return res

@router.get("/layout", response_model=Dict[str, Any])
async def get_seating_layout():
    """Get global seating layout."""
    cache_key = "seating:global_layout"
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    res = await SeatingService.get_global_layout()
    if res is not None:
        await set_cache(cache_key, res, ttl=60)
    return res

@router.post("/layout", response_model=Dict[str, Any])
async def save_seating_layout(payload: Dict[str, Any]):
    """Save global seating layout."""
    res = await SeatingService.save_global_layout(payload)
    await clear_pattern("seating:*")
    return res

@router.get("/my-seat", response_model=Dict[str, Any])
async def get_my_seat(
    current_user: dict = Depends(get_current_employee)
):
    """
    Get current logged-in employee's allocated seat details and their assigned inventory resources.
    Accessible by any employee role.
    """
    user_id = str(current_user.get("_id") or current_user.get("id"))
    cache_key = f"seating:my_seat:{user_id}"
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    res = await SeatingService.get_my_seat(current_user)
    if res is not None:
        await set_cache(cache_key, res, ttl=60)
    return res

@router.get("/seats", response_model=List[Dict[str, Any]])
async def get_all_seats(
    status: Optional[str] = None,
    floor_id: Optional[str] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_employee)
):
    """
    Get a flat list of all seats across all floors with employee and allocated inventory resource details.
    Supports filtering by status (Allocated / Available / all), floor_id, and search query.
    """
    cache_key = make_list_key("seating:all_seats", st=status, fid=floor_id, s=search)
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    res = await SeatingService.get_all_seats(status_filter=status, floor_id=floor_id, search=search, current_user=current_user)
    if res is not None:
        await set_cache(cache_key, res, ttl=60)
    return res

@router.post("/floors", response_model=FloorResponse, status_code=status.HTTP_201_CREATED)
async def create_floor(
    data: FloorCreate,
    current_user: dict = Depends(get_current_employee)
):
    """Create a new floor layout (e.g., 1st Floor, Main Hall)."""
    res = await SeatingService.create_floor(data, current_user)
    await clear_pattern("seating:*")
    return res

@router.get("/floors", response_model=List[FloorResponse])
async def get_all_floors(
    current_user: dict = Depends(get_current_employee)
):
    """Get all seating floor layouts with desk and seat allocation statistics."""
    cache_key = "seating:all_floors"
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    res = await SeatingService.get_all_floors(current_user)
    if res is not None:
        await set_cache(cache_key, res, ttl=120)
    return res

@router.get("/floors/{floor_id}", response_model=FloorResponse)
async def get_floor_by_id(
    floor_id: str,
    current_user: dict = Depends(get_current_employee)
):
    """Get a single floor layout with detailed desks, PCs, and seat structures."""
    cache_key = f"seating:floor:{floor_id}"
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    res = await SeatingService.get_floor_by_id(floor_id, current_user)
    if res is not None:
        await set_cache(cache_key, res, ttl=120)
    return res

@router.put("/floors/{floor_id}", response_model=FloorResponse)
async def update_floor(
    floor_id: str,
    data: FloorUpdate,
    current_user: dict = Depends(get_current_employee)
):
    """Update floor name or floor level number."""
    res = await SeatingService.update_floor(floor_id, data, current_user)
    await clear_pattern("seating:*")
    return res

@router.delete("/floors/{floor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_floor(
    floor_id: str,
    current_user: dict = Depends(get_current_employee)
):
    """Soft delete a floor layout."""
    success = await SeatingService.delete_floor(floor_id, current_user)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to delete floor layout")
    await clear_pattern("seating:*")

@router.post("/floors/{floor_id}/desks", response_model=Dict[str, Any])
async def save_desk(
    floor_id: str,
    data: DeskCreateOrUpdate,
    current_user: dict = Depends(get_current_employee)
):
    """
    Add or update a table/desk layout on a specific floor.
    Allows defining top seats count, bottom seats count, and desk PCs list (supports multiple PC add & removal).
    Automatically generates or retains seat allocation details.
    """
    res = await SeatingService.save_desk(floor_id, data, current_user)
    await clear_pattern("seating:*")
    return res

@router.delete("/floors/{floor_id}/desks/{desk_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_desk(
    floor_id: str,
    desk_id: str,
    current_user: dict = Depends(get_current_employee)
):
    """Remove a desk and all its associated seats from a floor layout."""
    success = await SeatingService.delete_desk(floor_id, desk_id, current_user)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to delete desk")
    await clear_pattern("seating:*")

@router.put("/floors/{floor_id}/desks/{desk_id}/seats/{seat_id}", response_model=Dict[str, Any])
async def allocate_seat(
    floor_id: str,
    desk_id: str,
    seat_id: str,
    data: SeatAllocateRequest,
    current_user: dict = Depends(get_current_employee)
):
    """
    Allocate or unassign an employee to a seat using full URL path.
    """
    res = await SeatingService.allocate_seat(floor_id, desk_id, seat_id, data, current_user)
    await clear_pattern("seating:*")
    return res

@router.put("/desks/{desk_id}/allocate", response_model=Dict[str, Any])
async def allocate_seat_by_desk_id(
    desk_id: str,
    data: SeatAllocateRequest,
    current_user: dict = Depends(get_current_employee)
):
    """
    Directly allocate or unassign an employee to a seat using desk_id in URL without requiring floor_id!
    """
    res = await SeatingService.allocate_seat(None, desk_id, data.seat_id, data, current_user)
    await clear_pattern("seating:*")
    return res

@router.put("/allocate", response_model=Dict[str, Any])
async def allocate_seat_direct(
    data: SeatAllocateRequest,
    current_user: dict = Depends(get_current_employee)
):
    """
    Directly allocate or unassign an employee using request body (desk_id, seat_id, status, employee_id) without requiring floor_id in URL!
    """
    res = await SeatingService.allocate_seat(None, data.desk_id, data.seat_id, data, current_user)
    await clear_pattern("seating:*")
    return res

@router.put("/floors/{floor_id}/reset", response_model=Dict[str, Any])
async def reset_floor_seats(
    floor_id: str,
    current_user: dict = Depends(get_current_employee)
):
    """
    Reset All Seats on a specific floor layout: clears all assigned employees and sets all seat statuses to Available.
    """
    res = await SeatingService.reset_floor_seats(floor_id, current_user)
    await clear_pattern("seating:*")
    return res

@router.put("/reset", response_model=Dict[str, Any])
async def reset_all_floors_seats(
    floor_id: Optional[str] = None,
    current_user: dict = Depends(get_current_employee)
):
    """
    Reset All Seats across a floor or all floors layout: clears all assigned employees and resets all seats to Available.
    """
    res = await SeatingService.reset_floor_seats(floor_id, current_user)
    await clear_pattern("seating:*")
    return res
