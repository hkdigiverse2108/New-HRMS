from app.database.db import get_database
from bson import ObjectId
from datetime import datetime, date
from typing import Optional, Dict, Any, List
import re

class ActivityRepository:
    collection_name = "activity_logs"

    @classmethod
    async def get_collection(cls):
        db = get_database()
        return db[cls.collection_name]

    @classmethod
    async def create(cls, data: dict):
        collection = await cls.get_collection()
        now = datetime.utcnow()
        if "created_at" not in data or not data["created_at"]:
            data["created_at"] = now
        if "timestamp" not in data or not data["timestamp"]:
            data["timestamp"] = now.isoformat()
        result = await collection.insert_one(data)
        data["_id"] = str(result.inserted_id)
        return data

    @classmethod
    async def get_all_by_project(
        cls, 
        project_id: str,
        page: int = 1, 
        limit: int = 10
    ):
        collection = await cls.get_collection()
        query = {"project_id": project_id}
            
        total = await collection.count_documents(query)

        skip = (page - 1) * limit
        cursor = collection.find(query).sort("timestamp", -1).skip(skip).limit(limit)
        total_pages = (total + limit - 1) // limit if limit > 0 else 1

        items = []
        async for item in cursor:
            item["_id"] = str(item["_id"])
            items.append(item)
            
        return {
            "data": items,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": total_pages
        }

    @classmethod
    async def get_system_logs(
        cls,
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
        db = get_database()
        collection = await cls.get_collection()
        conditions = []

        # 1. RBAC check: Admin/HR vs Regular Employee
        is_admin = True
        if current_user:
            w_details = current_user.get("work_details", {})
            user_role = (
                w_details.get("system_role") 
                or current_user.get("role") 
                or "Employee"
            ).lower()
            is_admin = user_role in ["admin", "superadmin", "hr"]

            if not is_admin:
                current_id = str(current_user.get("_id") or current_user.get("id") or "")
                p_info = current_user.get("personal_info", {})
                current_full_name = f"{p_info.get('first_name', '')} {p_info.get('last_name', '')}".strip() or current_user.get("name") or ""
                conditions.append({
                    "$or": [
                        {"performed_by_id": current_id},
                        {"performed_by": current_id},
                        {"performed_by_name": {"$regex": f"^{re.escape(current_full_name)}$", "$options": "i"}},
                        {"user_name": {"$regex": f"^{re.escape(current_full_name)}$", "$options": "i"}}
                    ]
                })

        # 2. Category filter
        if category and category.lower() not in ["all", "none", ""]:
            conditions.append({"category": {"$regex": f"^{re.escape(category)}$", "$options": "i"}})

        # 3. Severity filter
        if severity and severity.lower() not in ["all", "none", ""]:
            conditions.append({"severity": {"$regex": f"^{re.escape(severity)}$", "$options": "i"}})

        # 4. Department filter (Admin/HR only)
        if department and department.lower() not in ["all", "none", ""]:
            # Find all employees in this department
            emp_cursor = db["employees"].find(
                {"work_details.department": {"$regex": f"^{re.escape(department)}$", "$options": "i"}},
                {"_id": 1, "personal_info.first_name": 1, "personal_info.last_name": 1}
            )
            dept_emp_ids = []
            dept_emp_names = []
            async for e in emp_cursor:
                dept_emp_ids.append(str(e["_id"]))
                p = e.get("personal_info", {})
                nm = f"{p.get('first_name', '')} {p.get('last_name', '')}".strip()
                if nm:
                    dept_emp_names.append(nm)

            conditions.append({
                "$or": [
                    {"performed_by_department": {"$regex": f"^{re.escape(department)}$", "$options": "i"}},
                    {"performed_by_id": {"$in": dept_emp_ids}},
                    {"performed_by": {"$in": dept_emp_ids}},
                    {"performed_by_name": {"$in": dept_emp_names}}
                ]
            })

        # 5. Role filter
        if role and role.lower() not in ["all", "none", ""]:
            conditions.append({"performed_by_role": {"$regex": f"^{re.escape(role)}$", "$options": "i"}})

        # 6. User Name filter
        if user_name and user_name.lower() not in ["all", "none", ""]:
            conditions.append({
                "$or": [
                    {"performed_by_name": {"$regex": re.escape(user_name), "$options": "i"}},
                    {"user_name": {"$regex": re.escape(user_name), "$options": "i"}},
                    {"performed_by_id": user_name},
                    {"performed_by": user_name}
                ]
            })

        # 7. Action type filter
        if action_type and action_type.lower() not in ["all", "none", ""]:
            conditions.append({"action": {"$regex": re.escape(action_type), "$options": "i"}})

        # 8. Date range filtering (supports both YYYY-MM-DD string and ISO timestamp)
        start_dt = None
        end_dt = None
        if start_date:
            try:
                start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            except Exception:
                pass
        if end_date:
            try:
                end_dt = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59, microsecond=999999)
            except Exception:
                pass

        if start_dt or end_dt:
            df_str: Dict[str, Any] = {}
            if start_dt:
                df_str["$gte"] = start_dt.isoformat()
            if end_dt:
                df_str["$lte"] = end_dt.isoformat()
            conditions.append({"timestamp": df_str})

        # 9. Free-text Search
        if search and search.strip():
            rgx = {"$regex": re.escape(search.strip()), "$options": "i"}
            conditions.append({
                "$or": [
                    {"action": rgx},
                    {"description": rgx},
                    {"metadata": rgx},
                    {"performed_by_name": rgx},
                    {"user_name": rgx},
                    {"performed_by_department": rgx},
                    {"ip": rgx}
                ]
            })

        query = {"$and": conditions} if conditions else {}

        total = await collection.count_documents(query)
        total_pages = (total + limit - 1) // limit if limit > 0 else 1
        skip = (page - 1) * limit

        # Sort strictly by timestamp (ISO format strings sort 100% chronologically)
        sort_dir = -1 if sort_order.lower() == "desc" else 1
        cursor = collection.find(query).sort("timestamp", sort_dir).skip(skip).limit(limit)
        items = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            if "id" not in doc:
                doc["id"] = doc["_id"]
            items.append(doc)

        # 10. Load all active employees to build comprehensive lookup & user dropdown list
        emp_cursor = db["employees"].find({"work_details.is_delete": {"$ne": True}})
        emp_map = {}
        all_company_users = []
        company_departments = set()

        async for emp in emp_cursor:
            eid = str(emp["_id"])
            p = emp.get("personal_info", {})
            w = emp.get("work_details", {})
            first = (p.get("first_name") or "").strip()
            last = (p.get("last_name") or "").strip()
            name = f"{first} {last}".strip() or emp.get("name") or "Employee"
            dept = (w.get("department") or "").strip()
            role_title = (w.get("system_role") or w.get("role") or "Employee").strip()
            avatar = p.get("profile_photo") or ""

            info = {
                "id": eid,
                "name": name,
                "department": dept,
                "role": role_title,
                "avatar": avatar
            }
            emp_map[eid] = info
            all_company_users.append(info)
            if dept:
                company_departments.add(dept)

        # Default fallback admin employee (e.g. Het / Pramit / Admin)
        admin_fallback = next((e for e in all_company_users if "admin" in e["role"].lower()), None)

        # 11. Enrich each log item so that real employee name, role, department & avatar are ALWAYS shown
        for doc in items:
            perf_id = str(doc.get("performed_by_id") or doc.get("performed_by") or "")
            current_name = doc.get("performed_by_name")

            if perf_id in emp_map:
                emp = emp_map[perf_id]
                doc["performed_by_name"] = emp["name"]
                doc["performed_by_role"] = emp["role"]
                doc["performed_by_department"] = emp["department"]
                if not doc.get("performed_by_avatar"):
                    doc["performed_by_avatar"] = emp["avatar"]
            elif not current_name or current_name in ["System Admin", "System Engine", "None", None]:
                if admin_fallback:
                    doc["performed_by_name"] = admin_fallback["name"]
                    doc["performed_by_role"] = admin_fallback["role"]
                    doc["performed_by_department"] = admin_fallback["department"]
                    if not doc.get("performed_by_avatar"):
                        doc["performed_by_avatar"] = admin_fallback["avatar"]
                else:
                    doc["performed_by_name"] = "Admin"
                    doc["performed_by_role"] = "Admin"
                    doc["performed_by_department"] = "Management"
            else:
                # If name is present, match department from company users
                matched = next((e for e in all_company_users if e["name"].lower() == current_name.lower()), None)
                if matched:
                    doc["performed_by_department"] = matched["department"]
                    doc["performed_by_role"] = matched["role"]
                    if not doc.get("performed_by_avatar"):
                        doc["performed_by_avatar"] = matched["avatar"]

            # Ensure category is descriptive
            if not doc.get("category") or doc.get("category") == "System":
                act = (doc.get("action") or "").lower()
                if "content" in act or "task" in act or "issue" in act or "project" in act:
                    doc["category"] = "Work"
                elif "lead" in act or "sales" in act:
                    doc["category"] = "Sales"
                elif "login" in act or "auth" in act:
                    doc["category"] = "Auth"
                elif "employee" in act or "profile" in act or "leave" in act or "attendance" in act:
                    doc["category"] = "People"

            if not doc.get("created_at"):
                doc["created_at"] = doc.get("timestamp")

        # 12. Quick stats for today & alerts
        today_iso = datetime.utcnow().strftime("%Y-%m-%d")
        today_count = await collection.count_documents({"timestamp": {"$regex": f"^{today_iso}"}})
        critical_count = await collection.count_documents({"severity": {"$regex": "^critical$", "$options": "i"}})
        warning_count = await collection.count_documents({"severity": {"$regex": "^warning$", "$options": "i"}})

        # Standard company departments list
        depts_list = sorted(list(company_departments | {"Development", "Creative", "HR", "Sales", "Management"}))

        return {
            "data": items,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": total_pages,
            "is_admin": is_admin,
            "filter_options": {
                "categories": ["All", "Auth", "People", "Work", "Sales", "Payroll", "System"],
                "departments": depts_list,
                "users": sorted(all_company_users, key=lambda x: x["name"]),
                "severities": ["Info", "Warning", "Critical"]
            },
            "stats": {
                "events_today": today_count,
                "critical_alerts": critical_count,
                "warning_alerts": warning_count,
                "total_records": total
            }
        }
