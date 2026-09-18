from fastapi import HTTPException, status
from typing import Optional, List, Dict, Any
from app.repository.penalty import PenaltyTypeRepository, EmployeePenaltyRepository
from app.schemas.penalty import PenaltyTypeCreate, PenaltyTypeUpdate, EmployeePenaltyCreate, EmployeePenaltyUpdate, PenaltySummaryResponse

class PenaltyService:
    # --- Penalty Types ---
    @staticmethod
    async def create_penalty_type(data: PenaltyTypeCreate):
        return await PenaltyTypeRepository.create(data.model_dump(exclude_unset=True))

    @staticmethod
    async def get_all_penalty_types():
        types = await PenaltyTypeRepository.get_all()
        if not types:
            # Seed default penalty presets if collection is empty
            defaults = [
                {"name": "Late Arrival", "default_price": 100.0, "warning_limit": 3, "description": "Repeated late arrivals without prior notice."},
                {"name": "Late Punch-in", "default_price": 100.0, "warning_limit": 0, "description": "Automatic penalty for punching in late."},
                {"name": "Security Policy Violation", "default_price": 500.0, "warning_limit": 0, "description": "Unauthorized access or violation of company security policies."},
                {"name": "No Show", "default_price": 200.0, "warning_limit": 0, "description": "Absent from work without notice or approval."}
            ]
            for d in defaults:
                await PenaltyTypeRepository.create(d)
            types = await PenaltyTypeRepository.get_all()
        return types

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
        type_exists = await PenaltyTypeRepository.get_by_id(data.penalty_type_id)
        if not type_exists:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid penalty type")
        
        insert_data = data.model_dump(exclude_unset=True)
        warning_limit = type_exists.get("warning_limit", 0)
        
        # Check previous penalties for warning limit
        previous_penalties = await EmployeePenaltyRepository.get_all(
            is_deleted=False, 
            employee_id=data.employee_id, 
            penalty_type_id=data.penalty_type_id
        )
        count = previous_penalties.get("total", len(previous_penalties.get("data", [])))
        
        if data.is_warning is not None:
            insert_data["is_warning"] = data.is_warning
            if data.is_warning:
                insert_data["price"] = 0.0
            else:
                insert_data["price"] = data.price if data.price is not None else float(type_exists.get("default_price", 0.0))
        elif warning_limit > 0:
            if count < warning_limit:
                insert_data["is_warning"] = True
                insert_data["price"] = 0.0
            else:
                insert_data["is_warning"] = False
                insert_data["price"] = data.price if data.price is not None else float(type_exists.get("default_price", 0.0))
        else:
            insert_data["is_warning"] = False
            insert_data["price"] = data.price if data.price is not None else float(type_exists.get("default_price", 0.0))

        if "impact_payroll" not in insert_data:
            insert_data["impact_payroll"] = not insert_data.get("is_warning", False) and (float(insert_data.get("price", 0)) > 0)
            
        insert_data["status"] = insert_data.get("status", "Active")
        return await EmployeePenaltyRepository.create(insert_data)

    @staticmethod
    async def get_all_penalties(
        is_deleted: bool = False, 
        employee_id: Optional[str] = None, 
        penalty_type_id: Optional[str] = None, 
        status: Optional[str] = None,
        type_filter: Optional[str] = None,
        search: Optional[str] = None,
        start_date: Optional[str] = None, 
        end_date: Optional[str] = None, 
        page: Optional[int] = None, 
        limit: Optional[int] = None
    ):
        result = await EmployeePenaltyRepository.get_all(
            is_deleted=is_deleted, 
            employee_id=employee_id, 
            penalty_type_id=penalty_type_id, 
            status=status,
            type_filter=type_filter,
            search=search,
            start_date=start_date, 
            end_date=end_date, 
            page=page, 
            limit=limit
        )
        
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
                        work = emp.get("work_details", {})
                        name = f"{personal.get('first_name', '')} {personal.get('last_name', '')}".strip() or "Employee"
                        avatar = personal.get("profile_photo", "") or personal.get("avatar", "")
                        role = work.get("designation", "") or work.get("system_role", "Employee")
                        dept = work.get("department", "")
                        emp_cache[str(emp_id)] = {
                            "employee_name": name, 
                            "avatar": avatar,
                            "role": role,
                            "department": dept
                        }
                    else:
                        emp_cache[str(emp_id)] = {
                            "employee_name": "Unknown", 
                            "avatar": "",
                            "role": "Staff",
                            "department": "General"
                        }
                
                cached_emp = emp_cache[str(emp_id)]
                item["employee_name"] = cached_emp["employee_name"]
                item["avatar"] = cached_emp["avatar"]
                item["role"] = cached_emp["role"]
                item["department"] = cached_emp["department"]
                
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
            
        # If penalty type is changing and no explicit price is provided, update default price
        if "penalty_type_id" in update_data and "price" not in update_data:
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

    @staticmethod
    async def get_summary_stats() -> dict:
        summary = await EmployeePenaltyRepository.get_summary_stats()
        leaderboard = await PenaltyService.get_leaderboard()
        
        top_violations = leaderboard.get("top_by_violations", [])
        top_amounts = leaderboard.get("top_by_amount", [])
        
        max_viol_emp = top_violations[0]["employee_name"] if top_violations else "None"
        max_viol_cnt = top_violations[0]["total_violations"] if top_violations else 0
        
        max_amt_emp = top_amounts[0]["employee_name"] if top_amounts else "None"
        max_amt_val = top_amounts[0]["total_penalty_amount"] if top_amounts else 0.0
        
        return {
            "active_penalties_count": summary["active_penalties_count"],
            "total_payroll_deductions": summary["total_payroll_deductions"],
            "max_violations_employee": max_viol_emp,
            "max_violations_count": max_viol_cnt,
            "max_penalty_employee": max_amt_emp,
            "max_penalty_amount": max_amt_val
        }

