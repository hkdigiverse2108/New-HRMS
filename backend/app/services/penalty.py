from fastapi import HTTPException, status
from typing import Optional
from app.repository.penalty import PenaltyTypeRepository, EmployeePenaltyRepository
from app.schemas.penalty import PenaltyTypeCreate, PenaltyTypeUpdate, EmployeePenaltyCreate, EmployeePenaltyUpdate

class PenaltyService:
    # --- Penalty Types ---
    @staticmethod
    async def create_penalty_type(data: PenaltyTypeCreate):
        return await PenaltyTypeRepository.create(data.model_dump(exclude_unset=True))

    @staticmethod
    async def get_all_penalty_types():
        return await PenaltyTypeRepository.get_all()

    @staticmethod
    async def ensure_late_punchin_penalty_type() -> str:
        types = await PenaltyTypeRepository.get_all()
        for t in types:
            if t.get("name", "").lower() == "late punch-in":
                return str(t["_id"])
                
        # Create it if it doesn't exist
        new_type = PenaltyTypeCreate(
            name="Late Punch-in",
            default_price=100.0,
            warning_limit=0,
            description="Automatic penalty for punching in late."
        )
        created = await PenaltyService.create_penalty_type(new_type)
        return str(created.get("_id") or created.get("id"))

    @staticmethod
    async def get_penalty_type_by_id(item_id: str):
        item = await PenaltyTypeRepository.get_by_id(item_id)
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Penalty type not found")
        return item

    @staticmethod
    async def update_penalty_type(item_id: str, data: PenaltyTypeUpdate):
        update_data = data.model_dump(exclude_unset=True)
        if not update_data:
            return await PenaltyService.get_penalty_type_by_id(item_id)
            
        updated_item = await PenaltyTypeRepository.update(item_id, update_data)
        if not updated_item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Penalty type not found")
        return updated_item

    @staticmethod
    async def delete_penalty_type(item_id: str):
        success = await PenaltyTypeRepository.delete(item_id)
        if not success:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Penalty type not found")
        return {"detail": "Penalty type deleted successfully"}

    # --- Employee Penalties ---
    @staticmethod
    async def create_employee_penalty(data: EmployeePenaltyCreate):
        # Could add check if penalty_type_id exists
        type_exists = await PenaltyTypeRepository.get_by_id(data.penalty_type_id)
        if not type_exists:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid penalty type")
        
        insert_data = data.model_dump(exclude_unset=True)
        
        warning_limit = type_exists.get("warning_limit", 0)
        
        if warning_limit > 0:
            previous_penalties = await EmployeePenaltyRepository.get_all(
                is_deleted=False, 
                employee_id=data.employee_id, 
                penalty_type_id=data.penalty_type_id
            )
            count = len(previous_penalties)
            if count <= warning_limit:
                insert_data["is_warning"] = True
                insert_data["price"] = 0.0
            else:
                insert_data["is_warning"] = False
                insert_data["price"] = type_exists.get("default_price", 0.0)
        else:
            # If no limit, it's always a penalty
            insert_data["is_warning"] = False
            insert_data["price"] = type_exists.get("default_price", 0.0)
            
        return await EmployeePenaltyRepository.create(insert_data)

    @staticmethod
    async def get_all_penalties(is_deleted: bool = False, employee_id: Optional[str] = None, penalty_type_id: Optional[str] = None, start_date: Optional[str] = None, end_date: Optional[str] = None, page: Optional[int] = None, limit: Optional[int] = None):
        result = await EmployeePenaltyRepository.get_all(is_deleted, employee_id, penalty_type_id, start_date, end_date, page, limit)
        
        from app.repository.employee import EmployeeRepository
        # Cache penalty types to avoid N queries
        penalty_types = await PenaltyTypeRepository.get_all()
        pt_map = {str(pt["_id"]): pt.get("name") for pt in penalty_types}
        
        # Cache employees to avoid repeated queries for the same employee
        emp_cache = {}
        
        for item in result.get("data", []):
            pt_id = item.get("penalty_type_id")
            if pt_id:
                item["penalty_type_name"] = pt_map.get(str(pt_id))
                
            emp_id = item.get("employee_id")
            if emp_id:
                if str(emp_id) not in emp_cache:
                    emp = await EmployeeRepository.get_employee_by_id(emp_id)
                    if emp:
                        personal = emp.get("personal_info", {})
                        name = f"{personal.get('first_name', '')} {personal.get('last_name', '')}".strip() or "Employee"
                        avatar = personal.get("profile_photo", "") or personal.get("avatar", "")
                        emp_cache[str(emp_id)] = {"employee_name": name, "avatar": avatar}
                    else:
                        emp_cache[str(emp_id)] = {"employee_name": "Unknown", "avatar": ""}
                
                cached_emp = emp_cache[str(emp_id)]
                item["employee_name"] = cached_emp["employee_name"]
                item["avatar"] = cached_emp["avatar"]
                
        return result

    @staticmethod
    async def get_penalty_by_id(item_id: str):
        item = await EmployeePenaltyRepository.get_by_id(item_id)
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Penalty not found")
        return item

    @staticmethod
    async def update_employee_penalty(item_id: str, data: EmployeePenaltyUpdate):
        update_data = data.model_dump(exclude_unset=True)
        if not update_data:
            return await PenaltyService.get_penalty_by_id(item_id)
            
        # If they are changing the penalty type, we must also update the price
        if "penalty_type_id" in update_data:
            type_exists = await PenaltyTypeRepository.get_by_id(update_data["penalty_type_id"])
            if not type_exists:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid penalty type")
            update_data["price"] = type_exists.get("default_price", 0.0)
            
        updated_item = await EmployeePenaltyRepository.update(item_id, update_data)
        if not updated_item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Penalty not found")
        return updated_item

    @staticmethod
    async def soft_delete_employee_penalty(item_id: str):
        success = await EmployeePenaltyRepository.soft_delete(item_id)
        if not success:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Penalty not found")
        return {"detail": "Penalty deleted successfully"}

    @staticmethod
    async def get_leaderboard():
        facets = await EmployeePenaltyRepository.get_leaderboard()
        
        from app.repository.employee import EmployeeRepository
        
        async def enrich_entry(entry: dict):
            emp_id = entry.get("employee_id")
            if not emp_id:
                return
            emp = await EmployeeRepository.get_employee_by_id(emp_id)
            if emp:
                personal = emp.get("personal_info", {})
                work = emp.get("work_details", {})
                name = f"{personal.get('first_name', '')} {personal.get('last_name', '')}".strip() or "Employee"
                entry["employee_name"] = name
                entry["avatar"] = personal.get("profile_photo", "") or personal.get("avatar", "")
                entry["department"] = work.get("department", "General")
                entry["role"] = work.get("designation", "Staff")
            else:
                entry["employee_name"] = "Unknown Employee"
                entry["avatar"] = ""
                entry["department"] = "Unknown"
                entry["role"] = "Unknown"
                
        for entry in facets.get("top_by_violations", []):
            await enrich_entry(entry)
            
        for entry in facets.get("top_by_amount", []):
            await enrich_entry(entry)
            
        return facets
