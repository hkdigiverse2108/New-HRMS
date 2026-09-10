from fastapi import APIRouter, Depends, status, Query
from typing import List
from app.schemas.designation import DesignationCreate, DesignationUpdate, DesignationOut
from app.schemas.pagination import PaginatedResponse
from app.services.designation import DesignationService
from app.controllers.auth import RoleChecker, get_current_user

router = APIRouter(prefix="/designations", tags=["Designations"])

@router.post("/", response_model=DesignationOut, status_code=status.HTTP_201_CREATED)
async def create_designation(data: DesignationCreate, current_user: dict = Depends(RoleChecker(["Admin"]))):
    return await DesignationService.create(data)

@router.get("/", response_model=PaginatedResponse[DesignationOut])
async def get_all_designations(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    current_user: str = Depends(get_current_user)
):
    return await DesignationService.get_all(page, limit)

@router.get("/{item_id}", response_model=DesignationOut)
async def get_designation(item_id: str, current_user: str = Depends(get_current_user)):
    return await DesignationService.get_by_id(item_id)

@router.put("/{item_id}", response_model=DesignationOut)
async def update_designation(item_id: str, data: DesignationUpdate, current_user: dict = Depends(RoleChecker(["Admin"]))):
    return await DesignationService.update(item_id, data)

@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_designation(item_id: str, current_user: dict = Depends(RoleChecker(["Admin"]))):
    return await DesignationService.delete(item_id)
