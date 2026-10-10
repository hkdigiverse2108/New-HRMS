from datetime import datetime, timedelta
from app.repository.activity import ActivityRepository
from app.repository.employee import EmployeeRepository
from app.schemas.activity import ActivityLogCreate, ActivityAction
from app.database.db import get_database
from typing import Optional, Dict, Any

class ActivityService:
    @staticmethod
    async def _populate_details(item: dict, emp_cache: dict):
        emp_id = item.get("performed_by") or item.get("performed_by_id")
        if not emp_id:
            item["performed_by_details"] = None
            return

        emp_id_str = str(emp_id)
        if emp_id_str not in emp_cache:
            emp = await EmployeeRepository.get_employee_by_id(emp_id_str)
            if emp:
                personal = emp.get("personal_info", {})
                work = emp.get("work_details", {})
                name = f"{personal.get('first_name', '')} {personal.get('last_name', '')}".strip() or "Employee"
                emp_cache[emp_id_str] = {
                    "employee_name": name,
                    "department": work.get("department", ""),
                    "role": work.get("system_role", "Employee"),
                    "profile_photo": personal.get("profile_photo", "")
                }
            else:
                emp_cache[emp_id_str] = {"employee_name": emp_id_str}
                
        item["performed_by_details"] = emp_cache[emp_id_str]

    @staticmethod
    async def log_activity(project_id: str, action: Any, description: str, performed_by: str):
        """Unified logging for Project / Content calendar events with full employee details"""
        emp_name = "Employee"
        emp_role = "Employee"
        emp_dept = "Development"
        emp_avatar = ""

        if performed_by:
            emp_id_str = str(performed_by).strip()
            if emp_id_str.lower() not in ["system", "default-admin-id", ""]:
                try:
                    emp = await EmployeeRepository.get_employee_by_id(emp_id_str)
                    if emp:
                        p = emp.get("personal_info", {})
                        w = emp.get("work_details", {})
                        emp_name = f"{p.get('first_name', '')} {p.get('last_name', '')}".strip() or "Employee"
                        emp_role = w.get("system_role") or w.get("role") or "Employee"
                        emp_dept = w.get("department") or "Development"
                        emp_avatar = p.get("profile_photo") or ""
                except Exception:
                    pass
            else:
                emp_name = "Admin"
                emp_role = "Admin"
                emp_dept = "Management"

        now = datetime.utcnow()
        doc = {
            "project_id": project_id,
            "action": str(action.value if hasattr(action, "value") else action),
            "category": "Work",
            "severity": "Info",
            "description": description,
            "performed_by": str(performed_by),
            "performed_by_id": str(performed_by),
            "performed_by_name": emp_name,
            "performed_by_role": emp_role,
            "performed_by_department": emp_dept,
            "performed_by_avatar": emp_avatar,
            "timestamp": now.isoformat(),
            "created_at": now
        }
        return await ActivityRepository.create(doc)

    @staticmethod
    async def get_project_activities(project_id: str, page: int = 1, limit: int = 10):
        result = await ActivityRepository.get_all_by_project(project_id, page, limit)
        emp_cache = {}
        for item in result.get("data", []):
            await ActivityService._populate_details(item, emp_cache)
        return result

    @staticmethod
    async def log_system_activity(
        action: str,
        category: str = "System",
        severity: str = "Info",
        description: str = "",
        performed_by_id: Optional[str] = None,
        performed_by_name: Optional[str] = None,
        performed_by_role: Optional[str] = None,
        performed_by_department: Optional[str] = None,
        performed_by_avatar: Optional[str] = None,
        metadata: Optional[str] = None,
        ip: Optional[str] = None
    ) -> Dict[str, Any]:
        """Centralized helper to log any system event in HRMS with real employee data"""
        now = datetime.utcnow()

        # If name is missing but ID is provided, look up from employee database
        if (not performed_by_name or performed_by_name in ["System Admin", "User"]) and performed_by_id:
            try:
                emp = await EmployeeRepository.get_employee_by_id(str(performed_by_id))
                if emp:
                    p = emp.get("personal_info", {})
                    w = emp.get("work_details", {})
                    performed_by_name = f"{p.get('first_name', '')} {p.get('last_name', '')}".strip() or "Employee"
                    performed_by_role = w.get("system_role") or w.get("role") or "Employee"
                    performed_by_department = w.get("department") or "Development"
                    performed_by_avatar = p.get("profile_photo") or ""
            except Exception:
                pass

        doc = {
            "action": action,
            "category": category,
            "severity": severity,
            "description": description or action,
            "performed_by_id": str(performed_by_id) if performed_by_id else None,
            "performed_by_name": performed_by_name or "Admin",
            "performed_by_role": performed_by_role or "Admin",
            "performed_by_department": performed_by_department or "Management",
            "performed_by_avatar": performed_by_avatar or "",
            "metadata": metadata or "",
            "ip": ip or "127.0.0.1",
            "timestamp": now.isoformat(),
            "created_at": now
        }
        return await ActivityRepository.create(doc)

    @staticmethod
    async def ensure_seed_logs():
        """Ensure audit logs are backfilled with real employee information and clean timestamps"""
        db = get_database()
        coll = db["activity_logs"]

        # Backfill any legacy documents missing category or with 'System' for Content/Issue
        try:
            await coll.update_many(
                {"category": {"$in": ["System", None]}, "action": {"$regex": "Content|Issue|Task", "$options": "i"}},
                {"$set": {"category": "Work", "severity": "Info"}}
            )
            await coll.update_many(
                {"category": {"$in": ["System", None]}, "action": {"$regex": "Lead|Sales", "$options": "i"}},
                {"$set": {"category": "Sales", "severity": "Info"}}
            )
            await coll.update_many(
                {"category": {"$in": ["System", None]}, "action": {"$regex": "Employee|Profile|Leave|Attendance", "$options": "i"}},
                {"$set": {"category": "People", "severity": "Info"}}
            )
        except Exception:
            pass

    @staticmethod
    async def get_system_activities(
        current_user: Optional[dict] = None,
        page: int = 1,
        limit: int = 25,
        category: Optional[str] = None,
        severity: Optional[str] = None,
        user_name: Optional[str] = None,
        department: Optional[str] = None,
        role: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        action_type: Optional[str] = None,
        search: Optional[str] = None,
        sort_order: str = "desc"
    ) -> Dict[str, Any]:
        await ActivityService.ensure_seed_logs()
        return await ActivityRepository.get_system_logs(
            current_user=current_user,
            page=page,
            limit=limit,
            category=category,
            severity=severity,
            user_name=user_name,
            department=department,
            role=role,
            start_date=start_date,
            end_date=end_date,
            action_type=action_type,
            search=search,
            sort_order=sort_order
        )
