from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Dict, Any, Optional
from app.schemas.seating import FloorCreate, FloorUpdate, FloorResponse, DeskCreateOrUpdate, SeatAllocateRequest
from app.services.seating import SeatingService
from app.controllers.auth import get_current_employee

router = APIRouter(prefix="/seating", tags=["Seating Arrangement & Floor Layout Management"])

@router.post("/floors", response_model=FloorResponse, status_code=status.HTTP_201_CREATED)
async def create_floor(
    data: FloorCreate,
    current_user: dict = Depends(get_current_employee)
):
    """Create a new floor layout (e.g., 1st Floor, Main Hall)."""
    return await SeatingService.create_floor(data, current_user)

@router.get("/floors", response_model=List[FloorResponse])
async def get_all_floors(
    current_user: dict = Depends(get_current_employee)
):
    """Get all seating floor layouts with desk and seat allocation statistics."""
    return await SeatingService.get_all_floors(current_user)

@router.get("/floors/{floor_id}", response_model=FloorResponse)
async def get_floor_by_id(
    floor_id: str,
    current_user: dict = Depends(get_current_employee)
):
    """Get a single floor layout with detailed desks, PCs, and seat structures."""
    return await SeatingService.get_floor_by_id(floor_id, current_user)

@router.put("/floors/{floor_id}", response_model=FloorResponse)
async def update_floor(
    floor_id: str,
    data: FloorUpdate,
    current_user: dict = Depends(get_current_employee)
):
    """Update floor name or floor level number."""
    return await SeatingService.update_floor(floor_id, data, current_user)

@router.delete("/floors/{floor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_floor(
    floor_id: str,
    current_user: dict = Depends(get_current_employee)
):
    """Soft delete a floor layout."""
    success = await SeatingService.delete_floor(floor_id, current_user)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to delete floor layout")

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
    return await SeatingService.save_desk(floor_id, data, current_user)

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

@router.put("/floors/{floor_id}/desks/{desk_id}/seats/{seat_id}", response_model=FloorResponse)
async def allocate_seat(
    floor_id: str,
    desk_id: str,
    seat_id: str,
    data: SeatAllocateRequest,
    current_user: dict = Depends(get_current_employee)
):
    """
    Allocate or unassign an employee to a seat.
    - Set `status` to 'Allocated' and provide `employee_id` to assign an employee.
    - Set `status` to 'Available' or leave `employee_id` empty to unassign.
    """
    return await SeatingService.allocate_seat(floor_id, desk_id, seat_id, data, current_user)
