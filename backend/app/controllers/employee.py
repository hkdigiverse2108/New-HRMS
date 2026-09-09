from fastapi import APIRouter, Depends, status
from typing import List, Dict
from app.schemas.enums import SystemRole, GenderEnum, RelationEnum, StatusEnum, WorkModeEnum
from app.schemas.employee import EmployeeCreate, EmployeeOut, EmployeeUpdate
from app.services.employee import EmployeeService
from app.controllers.auth import get_current_user

router = APIRouter(prefix="/employees", tags=["Employees"])

@router.get("/form-options")
async def get_employee_form_options() -> Dict[str, List[dict]]:
    """Returns all static dropdown options for the employee form"""
    return {
        "genders": [{"id": e.value, "label": e.value, "value": e.value} for e in GenderEnum],
        "system_roles": [{"id": e.value, "label": e.value, "value": e.value} for e in SystemRole],
        "relations": [{"id": e.value, "label": e.value, "value": e.value} for e in RelationEnum],
        "status": [{"id": e.value, "label": e.value, "value": e.value} for e in StatusEnum],
        "work_modes": [{"id": e.value, "label": e.value, "value": e.value} for e in WorkModeEnum]
    }

@router.post("/", response_model=EmployeeOut, status_code=status.HTTP_201_CREATED)
async def create_employee(employee: EmployeeCreate):
    return await EmployeeService.create_employee(employee)

@router.get("/", response_model=List[EmployeeOut])
async def get_all_employees():
    return await EmployeeService.get_employees()

@router.get("/{employee_id}", response_model=EmployeeOut)
async def get_employee(employee_id: str):
    return await EmployeeService.get_employee(employee_id)

@router.put("/{employee_id}", response_model=EmployeeOut)
async def update_employee(employee_id: str, employee: EmployeeUpdate):
    return await EmployeeService.update_employee(employee_id, employee)

@router.delete("/{employee_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_employee(employee_id: str):
    return await EmployeeService.delete_employee(employee_id)
