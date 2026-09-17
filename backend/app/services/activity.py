from datetime import datetime
from app.repository.activity import ActivityRepository
from app.repository.employee import EmployeeRepository
from app.schemas.activity import ActivityLogCreate, ActivityAction
from typing import Optional

class ActivityService:
    @staticmethod
    async def _populate_details(item: dict, emp_cache: dict):
        emp_id = item.get("performed_by")
        if not emp_id:
            item["performed_by_details"] = None
            return

        emp_id_str = str(emp_id)
        if emp_id_str not in emp_cache:
            emp = await EmployeeRepository.get_employee_by_id(emp_id_str)
            if emp:
                personal = emp.get("personal_info", {})
                name = f"{personal.get('first_name', '')} {personal.get('last_name', '')}".strip() or "Employee"
                emp_cache[emp_id_str] = {"employee_name": name}
            else:
                emp_cache[emp_id_str] = {"employee_name": emp_id_str}
                
        item["performed_by_details"] = emp_cache[emp_id_str]

    @staticmethod
    async def log_activity(project_id: str, action: ActivityAction, description: str, performed_by: str):
        log_data = ActivityLogCreate(
            project_id=project_id,
            action=action,
            description=description,
            performed_by=performed_by,
            timestamp=datetime.utcnow().isoformat()
        )
        return await ActivityRepository.create(log_data.model_dump())

    @staticmethod
    async def get_project_activities(project_id: str, page: int = 1, limit: int = 10):
        result = await ActivityRepository.get_all_by_project(project_id, page, limit)
        
        emp_cache = {}
        for item in result.get("data", []):
            await ActivityService._populate_details(item, emp_cache)
            
        return result
