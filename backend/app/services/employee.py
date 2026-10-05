from app.schemas.employee import EmployeeCreate, EmployeeUpdate
from app.repository.employee import EmployeeRepository
from app.controllers.auth import get_password_hash
from app.utils.password_vault import encrypt_password
from fastapi import HTTPException

from app.schemas.enums import GenderEnum, SystemRole, WorkModeEnum
from typing import Optional

class EmployeeService:
    @staticmethod
    async def create_employee(employee_in: EmployeeCreate):
        # 1. Check if email already exists
        email = employee_in.personal_info.email_address if employee_in.personal_info else None
        if email:
            existing_email = await EmployeeRepository.get_employee_by_email(str(email))
            if existing_email:
                raise HTTPException(status_code=400, detail="An employee with this email address already exists.")

        # 2. Check if phone already exists
        phone = employee_in.personal_info.phone_number if employee_in.personal_info else None
        if phone:
            existing_phone = await EmployeeRepository.get_employee_by_phone(str(phone))
            if existing_phone:
                raise HTTPException(status_code=400, detail="An employee with this phone number already exists.")

        # Hash password & sync profile_photo
        employee_dict = employee_in.model_dump(mode="json")
        photo = employee_in.profile_photo or (employee_in.personal_info.profile_photo if employee_in.personal_info else None)
        if photo:
            if "personal_info" not in employee_dict or not employee_dict["personal_info"]:
                employee_dict["personal_info"] = {}
            employee_dict["personal_info"]["profile_photo"] = photo
            employee_dict["profile_photo"] = photo

        plain_password = str(employee_dict["personal_info"]["password"])
        employee_dict["personal_info"]["password"] = get_password_hash(plain_password)
        try:
            employee_dict["personal_info"]["password_enc"] = encrypt_password(plain_password)
        except Exception:
            pass

        # Auto-generate unique sequential employee_id only for Employee role (never for Admin)
        role = str((employee_dict.get("work_details") or {}).get("system_role") or "Employee")
        if role != "Admin":
            if not employee_dict.get("employee_id"):
                new_emp_code = await EmployeeRepository.get_next_employee_id()
                employee_dict["employee_id"] = new_emp_code
                if "work_details" in employee_dict and employee_dict["work_details"]:
                    employee_dict["work_details"]["employee_id"] = new_emp_code
        else:
            employee_dict["employee_id"] = None
            if "work_details" in employee_dict and employee_dict["work_details"]:
                employee_dict["work_details"]["employee_id"] = None

        created_emp = await EmployeeRepository.create_employee(employee_dict)
        try:
            emp_id = str(created_emp.get("_id") or created_emp.get("id"))
            if emp_id:
                from app.repository.chat import ChatRepository
                await ChatRepository.auto_add_new_employee_to_channels(emp_id)
        except Exception as e:
            print(f"Error auto-joining employee to chat groups: {e}")

        return created_emp

    @staticmethod
    async def get_employees(
        page: Optional[int] = None, 
        limit: Optional[int] = None,
        gender: Optional[GenderEnum] = None,
        role: Optional[str] = None,
        exclude_role: Optional[str] = None,
        department: Optional[str] = None,
        is_delete: Optional[bool] = None,
        is_block: Optional[bool] = None,
        work_mode: Optional[WorkModeEnum] = None
    ):
        return await EmployeeRepository.get_all_employees(page, limit, gender, role, exclude_role, department, is_delete, is_block, work_mode)

    @staticmethod
    async def get_employee(employee_id: str):
        employee = await EmployeeRepository.get_employee_by_id(employee_id)
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")
        return employee

    @staticmethod
    def _flatten_update(data: dict, prefix: str = "") -> dict:
        """Flatten nested dicts to dotted keys so $set merges subdocuments
        instead of replacing them (partial updates stay safe)."""
        flat: dict = {}
        for k, v in (data or {}).items():
            key = f"{prefix}.{k}" if prefix else k
            if isinstance(v, dict):
                flat.update(EmployeeService._flatten_update(v, key))
            else:
                flat[key] = v
        return flat

    @staticmethod
    async def update_employee(employee_id: str, employee_update: EmployeeUpdate):
        update_data = employee_update.model_dump(exclude_unset=True, mode="json")
        
        # Check if email or phone is being updated and already taken by another employee
        if "personal_info" in update_data and update_data["personal_info"]:
            p_info = update_data["personal_info"]
            new_email = p_info.get("email_address")
            if new_email:
                existing_email = await EmployeeRepository.get_employee_by_email(str(new_email))
                if existing_email and str(existing_email.get("_id")) != str(employee_id):
                    raise HTTPException(status_code=400, detail="An employee with this email address already exists.")

            new_phone = p_info.get("phone_number")
            if new_phone:
                existing_phone = await EmployeeRepository.get_employee_by_phone(str(new_phone))
                if existing_phone and str(existing_phone.get("_id")) != str(employee_id):
                    raise HTTPException(status_code=400, detail="An employee with this phone number already exists.")

        # If photo is updated, sync profile_photo
        photo = employee_update.profile_photo or (employee_update.personal_info.profile_photo if employee_update.personal_info else None)
        if photo:
            if "personal_info" not in update_data or not update_data["personal_info"]:
                update_data["personal_info"] = {}
            update_data["personal_info"]["profile_photo"] = photo
            update_data["profile_photo"] = photo

        # If password is being updated, hash it (+ refresh vault copy).
        # Blank/missing password = no change (never overwrite).
        # NOTE: repo $set replaces the whole personal_info subdocument, so the
        # existing hash/vault copy must be re-injected when password is untouched.
        existing_emp = await EmployeeRepository.get_employee_by_id(employee_id)
        if existing_emp is None:
            raise HTTPException(status_code=404, detail="Employee not found")
        if "personal_info" in update_data and update_data["personal_info"]:
            pw = update_data["personal_info"].get("password")
            if pw is not None and str(pw).strip():
                plain = str(update_data["personal_info"]["password"])
                update_data["personal_info"]["password"] = get_password_hash(plain)
                try:
                    update_data["personal_info"]["password_enc"] = encrypt_password(plain)
                except Exception:
                    pass
            else:
                update_data["personal_info"].pop("password", None)
                old_pi = existing_emp.get("personal_info") or {}
                if old_pi.get("password"):
                    update_data["personal_info"]["password"] = old_pi["password"]
                if old_pi.get("password_enc"):
                    update_data["personal_info"]["password_enc"] = old_pi["password_enc"]
            
        new_role = update_data.get("work_details", {}).get("system_role")
        if new_role == "Admin":
            update_data["employee_id"] = None
            if "work_details" in update_data:
                update_data["work_details"]["employee_id"] = None

        updated_emp = await EmployeeRepository.update_employee(
            employee_id, EmployeeService._flatten_update(update_data)
        )
        if not updated_emp:
            raise HTTPException(status_code=404, detail="Employee not found or could not be updated")
        return updated_emp

    @staticmethod
    async def delete_employee(employee_id: str):
        deleted = await EmployeeRepository.delete_employee(employee_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Employee not found")
        return {"detail": "Employee deleted successfully"}
