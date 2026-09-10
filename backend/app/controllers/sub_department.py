from fastapi import APIRouter, Depends, status
from typing import List
from app.schemas.sub_department import SubDepartmentCreate, SubDepartmentUpdate, SubDepartmentOut
from app.services.sub_department import SubDepartmentService
from app.controllers.auth import RoleChecker, get_current_user

router = APIRouter(prefix="/sub-departments", tags=["Sub-Departments"])

@router.post("/", response_model=SubDepartmentOut, status_code=status.HTTP_201_CREATED)
async def create_sub_department(data: SubDepartmentCreate, current_user: dict = Depends(RoleChecker(["Admin"]))):
    return await SubDepartmentService.create(data)

@router.get("/", response_model=List[SubDepartmentOut])
async def get_all_sub_departments(current_user: str = Depends(get_current_user)):
    return await SubDepartmentService.get_all()

@router.get("/{item_id}", response_model=SubDepartmentOut)
async def get_sub_department(item_id: str, current_user: str = Depends(get_current_user)):
    return await SubDepartmentService.get_by_id(item_id)

@router.get("/department/{department_id}", response_model=List[SubDepartmentOut])
async def get_sub_departments_by_department(department_id: str, current_user: str = Depends(get_current_user)):
    return await SubDepartmentService.get_by_department_id(department_id)

@router.put("/{item_id}", response_model=SubDepartmentOut)
async def update_sub_department(item_id: str, data: SubDepartmentUpdate, current_user: dict = Depends(RoleChecker(["Admin"]))):
    return await SubDepartmentService.update(item_id, data)

@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sub_department(item_id: str, current_user: dict = Depends(RoleChecker(["Admin"]))):
    return await SubDepartmentService.delete(item_id)
