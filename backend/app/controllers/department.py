from fastapi import APIRouter, Depends, status
from typing import List
from app.schemas.department import DepartmentCreate, DepartmentUpdate, DepartmentOut
from app.services.department import DepartmentService
from app.controllers.auth import RoleChecker, get_current_user

router = APIRouter(prefix="/departments", tags=["Departments"])

@router.post("/", response_model=DepartmentOut, status_code=status.HTTP_201_CREATED)
async def create_department(data: DepartmentCreate, current_user: dict = Depends(RoleChecker(["Admin"]))):
    return await DepartmentService.create(data)

@router.get("/", response_model=List[DepartmentOut])
async def get_all_departments(current_user: str = Depends(get_current_user)):
    return await DepartmentService.get_all()

@router.get("/{item_id}", response_model=DepartmentOut)
async def get_department(item_id: str, current_user: str = Depends(get_current_user)):
    return await DepartmentService.get_by_id(item_id)

@router.put("/{item_id}", response_model=DepartmentOut)
async def update_department(item_id: str, data: DepartmentUpdate, current_user: dict = Depends(RoleChecker(["Admin"]))):
    return await DepartmentService.update(item_id, data)

@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_department(item_id: str, current_user: dict = Depends(RoleChecker(["Admin"]))):
    return await DepartmentService.delete(item_id)
