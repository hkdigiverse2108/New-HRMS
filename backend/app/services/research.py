from typing import Optional
from datetime import datetime
from bson import ObjectId
from app.repository.research import ResearchRepository
from app.repository.employee import EmployeeRepository
from app.repository.department import DepartmentRepository
from app.repository.project import ProjectRepository
from app.schemas.research import ResearchCreate, ResearchUpdate

class ResearchService:
    @staticmethod
    async def _populate_details(item: dict, emp_cache: dict, dept_cache: dict, proj_cache: dict, current_user: Optional[dict] = None):
        if not item:
            return

        # Ensure _id and id are present
        if "_id" in item:
            item["id"] = str(item["_id"])
            item["_id"] = str(item["_id"])

        # Calculate permissions
        if current_user:
            user_id = str(current_user.get("_id") or current_user.get("id"))
            role = current_user.get("work_details", {}).get("system_role", "")
            is_admin = role in ["Admin", "Super Admin"] or current_user.get("id") == "default-admin-id"
            is_creator = item.get("employee_id") == user_id
            is_shared = user_id in item.get("shared_with", [])
            item["can_edit"] = is_admin or is_creator or is_shared
            item["can_delete"] = is_admin or is_creator
        else:
            item["can_edit"] = False
            item["can_delete"] = False

        # 1. Populate Author / Employee details
        emp_id = item.get("employee_id")
        if emp_id:
            emp_id_str = str(emp_id)
            if emp_id_str not in emp_cache:
                if emp_id_str == "default-admin-id":
                    emp_cache[emp_id_str] = {
                        "_id": "default-admin-id",
                        "employee_name": "Default Admin",
                        "email": "admin@hrms.com",
                        "avatar": None
                    }
                else:
                    emp = await EmployeeRepository.get_employee_by_id(emp_id_str)
                    if emp:
                        personal = emp.get("personal_info", {})
                        name = f"{personal.get('first_name', '')} {personal.get('last_name', '')}".strip() or "Employee"
                        emp_cache[emp_id_str] = {
                            "_id": str(emp.get("_id") or emp_id_str),
                            "employee_name": name,
                            "email": personal.get("email"),
                            "avatar": personal.get("profile_picture")
                        }
                    else:
                        emp_cache[emp_id_str] = {
                            "_id": emp_id_str,
                            "employee_name": "Unknown Employee",
                            "email": None,
                            "avatar": None
                        }
            item["employee_details"] = emp_cache[emp_id_str]

        # 2. Populate Department details
        dept_id = item.get("department_id")
        if dept_id:
            dept_id_str = str(dept_id)
            if dept_id_str not in dept_cache:
                dept = await DepartmentRepository.get_by_id_or_name(dept_id_str)
                if dept:
                    real_dept_id = str(dept.get("_id"))
                    dept_name = dept.get("department_name") or dept.get("name") or dept_id_str
                    dept_cache[dept_id_str] = {
                        "_id": real_dept_id,
                        "department_name": dept_name,
                        "description": dept.get("description")
                    }
                else:
                    dept_cache[dept_id_str] = {
                        "_id": dept_id_str,
                        "department_name": dept_id_str,
                        "description": None
                    }
            dept_info = dept_cache[dept_id_str]
            item["department_id"] = dept_info.get("_id")
            item["department"] = dept_info.get("department_name")
        else:
            item["department"] = None

        # 3. Populate Project details
        proj_id = item.get("project_id")
        if proj_id:
            proj_id_str = str(proj_id)
            if proj_id_str not in proj_cache:
                proj = await ProjectRepository.get_by_id(proj_id_str)
                if proj:
                    if "_id" in proj:
                        proj["_id"] = str(proj["_id"])
                    proj_cache[proj_id_str] = proj
                else:
                    proj_cache[proj_id_str] = {"_id": proj_id_str, "project_name": "Unknown Project"}
            item["project_details"] = proj_cache[proj_id_str]
        else:
            item["project_details"] = None

        # 4. Populate Shared With details
        shared_with_ids = item.get("shared_with", [])
        shared_details = []
        for s_id in shared_with_ids:
            s_id_str = str(s_id)
            if s_id_str not in emp_cache:
                emp = await EmployeeRepository.get_employee_by_id(s_id_str)
                if emp:
                    personal = emp.get("personal_info", {})
                    name = f"{personal.get('first_name', '')} {personal.get('last_name', '')}".strip() or "Employee"
                    emp_cache[s_id_str] = {
                        "_id": str(emp.get("_id") or s_id_str),
                        "employee_name": name,
                        "email": personal.get("email"),
                        "avatar": personal.get("profile_picture")
                    }
                else:
                    emp_cache[s_id_str] = {
                        "_id": s_id_str,
                        "employee_name": "Unknown",
                        "email": None,
                        "avatar": None
                    }
            shared_details.append(emp_cache[s_id_str])
        item["shared_with_details"] = shared_details

        # 5. Populate History Employee details
        history_list = item.get("history", [])
        for h_entry in history_list:
            h_emp_id = h_entry.get("employee_id")
            if h_emp_id:
                h_emp_id_str = str(h_emp_id)
                if h_emp_id_str not in emp_cache:
                    if h_emp_id_str == "default-admin-id":
                        emp_cache[h_emp_id_str] = {
                            "_id": "default-admin-id",
                            "employee_name": "Default Admin",
                            "email": "admin@hrms.com",
                            "avatar": None
                        }
                    else:
                        emp = await EmployeeRepository.get_employee_by_id(h_emp_id_str)
                        if emp:
                            personal = emp.get("personal_info", {})
                            name = f"{personal.get('first_name', '')} {personal.get('last_name', '')}".strip() or "Employee"
                            emp_cache[h_emp_id_str] = {
                                "_id": str(emp.get("_id") or h_emp_id_str),
                                "employee_name": name,
                                "email": personal.get("email"),
                                "avatar": personal.get("profile_picture")
                            }
                        else:
                            emp_cache[h_emp_id_str] = {
                                "_id": h_emp_id_str,
                                "employee_name": "Unknown Employee",
                                "email": None,
                                "avatar": None
                            }
                h_entry["employee_details"] = emp_cache[h_emp_id_str]
            else:
                h_entry["employee_details"] = None

    @staticmethod
    async def create_research(data: ResearchCreate, current_user: dict):
        emp_id = str(current_user.get("_id") or current_user.get("id"))
        insert_data = data.model_dump(exclude_unset=True)
        insert_data["employee_id"] = emp_id

        # Always fetch department_id automatically from employee's profile
        emp_info = await EmployeeRepository.get_employee_by_id(emp_id)
        if emp_info:
            work = emp_info.get("work_details", {})
            raw_dept = work.get("department") or work.get("department_id")
            if raw_dept:
                dept_doc = await DepartmentRepository.get_by_id_or_name(str(raw_dept))
                if dept_doc:
                    insert_data["department_id"] = str(dept_doc.get("_id"))
                else:
                    insert_data["department_id"] = str(raw_dept)

        created = await ResearchRepository.create(insert_data)
        emp_cache, dept_cache, proj_cache = {}, {}, {}
        await ResearchService._populate_details(created, emp_cache, dept_cache, proj_cache, current_user)
        return created

    @staticmethod
    async def get_all_research(
        department_id: Optional[str] = None,
        filter_employee_id: Optional[str] = None,
        project_id: Optional[str] = None,
        date_filter: Optional[str] = None,
        search_query: Optional[str] = None,
        current_user: dict = None,
        page: Optional[int] = None,
        limit: Optional[int] = None
    ):
        emp_id = str(current_user.get("_id") or current_user.get("id"))
        role = current_user.get("work_details", {}).get("system_role", "")
        is_admin = role in ["Admin", "Super Admin"] or current_user.get("id") == "default-admin-id"

        emp_dept_id = None
        if not is_admin:
            emp_info = await EmployeeRepository.get_employee_by_id(emp_id)
            if emp_info:
                work = emp_info.get("work_details", {})
                emp_dept_id = work.get("department") or work.get("department_id")

        res = await ResearchRepository.get_all(
            department_id=department_id,
            filter_employee_id=filter_employee_id,
            project_id=project_id,
            date_filter=date_filter,
            search_query=search_query,
            employee_id=emp_id,
            emp_department_id=emp_dept_id,
            is_admin=is_admin,
            page=page,
            limit=limit
        )

        emp_cache, dept_cache, proj_cache = {}, {}, {}
        for item in res.get("data", []):
            await ResearchService._populate_details(item, emp_cache, dept_cache, proj_cache, current_user)

        return res

    @staticmethod
    async def get_research_by_id(item_id: str, current_user: Optional[dict] = None):
        item = await ResearchRepository.get_by_id(item_id)
        if item:
            emp_cache, dept_cache, proj_cache = {}, {}, {}
            await ResearchService._populate_details(item, emp_cache, dept_cache, proj_cache, current_user)
        return item

    @staticmethod
    async def update_research(item_id: str, data: ResearchUpdate, current_user: Optional[dict] = None):
        user_id = str(current_user.get("_id") or current_user.get("id")) if current_user else None
        existing = await ResearchRepository.get_by_id(item_id)
        if not existing:
            return None

        update_dict = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
        if not update_dict:
            return await ResearchService.get_research_by_id(item_id, current_user)

        changed_fields = []
        for field, new_val in update_dict.items():
            old_val = existing.get(field)

            if field == "concepts":
                import json
                def norm_concepts(c_list):
                    result = []
                    for c in (c_list or []):
                        if isinstance(c, dict):
                            result.append({
                                "concept_name": c.get("concept_name"),
                                "details": c.get("details"),
                                "reference_links": [str(l) for l in c.get("reference_links", [])]
                            })
                        else:
                            result.append(str(c))
                    return result
                
                norm_old = norm_concepts(old_val)
                norm_new = norm_concepts(new_val)
                if norm_old != norm_new:
                    changed_fields.append({
                        "field": "concepts",
                        "old_value": json.dumps(norm_old),
                        "new_value": json.dumps(norm_new)
                    })
            elif field == "shared_with":
                old_list = [str(x) for x in (old_val or [])]
                new_list = [str(x) for x in (new_val or [])]
                if sorted(old_list) != sorted(new_list):
                    changed_fields.append({
                        "field": "shared_with",
                        "old_value": ", ".join(old_list) if old_list else "None",
                        "new_value": ", ".join(new_list) if new_list else "None"
                    })
            else:
                str_old = str(old_val) if old_val is not None else ""
                str_new = str(new_val) if new_val is not None else ""
                if str_old != str_new:
                    changed_fields.append({
                        "field": field,
                        "old_value": str_old,
                        "new_value": str_new
                    })

        history_entry = None
        if changed_fields:
            field_names = [cf["field"] for cf in changed_fields]
            summary = f"Updated {', '.join(field_names)}"
            history_entry = {
                "log_id": str(ObjectId()),
                "employee_id": user_id,
                "action": "updated",
                "timestamp": datetime.utcnow(),
                "changes_summary": summary,
                "changed_fields": changed_fields
            }

        await ResearchRepository.update(item_id, update_dict, history_entry=history_entry)
        return await ResearchService.get_research_by_id(item_id, current_user)

    @staticmethod
    async def delete_research(item_id: str, current_user: Optional[dict] = None):
        user_id = str(current_user.get("_id") or current_user.get("id")) if current_user else None
        return await ResearchRepository.delete(item_id, user_id=user_id)
