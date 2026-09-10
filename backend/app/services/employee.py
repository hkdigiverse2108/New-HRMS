from app.schemas.employee import EmployeeCreate, EmployeeUpdate
from app.repository.employee import EmployeeRepository
from app.controllers.auth import get_password_hash
from fastapi import HTTPException

from app.schemas.enums import GenderEnum, SystemRole, WorkModeEnum
from typing import Optional

class EmployeeService:
    @staticmethod
    async def create_employee(employee_in: EmployeeCreate):
        # Check if user already exists
        existing_user = await EmployeeRepository.get_employee_by_email(employee_in.personal_info.email_address)
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already registered")

        # Hash password
        employee_dict = employee_in.model_dump(mode="json")
        employee_dict["personal_info"]["password"] = get_password_hash(employee_dict["personal_info"]["password"])

        return await EmployeeRepository.create_employee(employee_dict)

    @staticmethod
    async def get_employees(
        page: int = 1, 
        limit: int = 10,
        gender: Optional[GenderEnum] = None,
        role: Optional[SystemRole] = None,
        department: Optional[str] = None,
        is_delete: Optional[bool] = None,
        is_block: Optional[bool] = None,
        work_mode: Optional[WorkModeEnum] = None
    ):
        return await EmployeeRepository.get_all_employees(page, limit, gender, role, department, is_delete, is_block, work_mode)

    @staticmethod
    async def get_employee(employee_id: str):
        employee = await EmployeeRepository.get_employee_by_id(employee_id)
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")
        return employee

    @staticmethod
    async def update_employee(employee_id: str, employee_update: EmployeeUpdate):
        update_data = employee_update.model_dump(exclude_unset=True, mode="json")
        
        # If password is being updated, hash it
        if "personal_info" in update_data and "password" in update_data["personal_info"]:
            update_data["personal_info"]["password"] = get_password_hash(update_data["personal_info"]["password"])
            
        updated_emp = await EmployeeRepository.update_employee(employee_id, update_data)
        if not updated_emp:
            raise HTTPException(status_code=404, detail="Employee not found or could not be updated")
        return updated_emp

    @staticmethod
    async def delete_employee(employee_id: str):
        deleted = await EmployeeRepository.delete_employee(employee_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Employee not found")
        return {"detail": "Employee deleted successfully"}
