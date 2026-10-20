from app.repository.daily_progress import DailyProgressRepository
from app.schemas.daily_progress import DailyProgressCreate, DailyProgressUpdate, DailyProgressApprove
from app.repository.notification import NotificationRepository
from typing import Optional, List, Dict, Any
from datetime import datetime, date

class DailyProgressService:

    @staticmethod
    def _is_admin(current_user: dict) -> bool:
        role = str(current_user.get("work_details", {}).get("system_role", "")).lower()
        top_role = str(current_user.get("role", "")).lower()
        user_id = str(current_user.get("_id") or current_user.get("id"))
        return role == "admin" or top_role == "admin" or user_id == "default-admin-id"

    @staticmethod
    def _is_hr(current_user: dict) -> bool:
        if DailyProgressService._is_admin(current_user):
            return False
        dept = str(current_user.get("work_details", {}).get("department", "")).lower()
        role = str(current_user.get("work_details", {}).get("system_role", "")).lower()
        desig = str(current_user.get("work_details", {}).get("designation", "")).lower()
        top_role = str(current_user.get("role", "")).lower()
        return dept == "hr" or "hr" in desig or role == "hr" or top_role == "hr"

    @staticmethod
    def _is_head(current_user: dict) -> bool:
        if DailyProgressService._is_admin(current_user):
            return False
        desig = str(current_user.get("work_details", {}).get("designation", "")).lower()
        role = str(current_user.get("work_details", {}).get("system_role", "")).lower()
        return "head" in desig or "head" in role

    @staticmethod
    def _is_team_leader(current_user: dict) -> bool:
        if DailyProgressService._is_admin(current_user) or DailyProgressService._is_head(current_user):
            return False
        desig = str(current_user.get("work_details", {}).get("designation", "")).lower()
        role = str(current_user.get("work_details", {}).get("system_role", "")).lower()
        return "team leader" in desig or "team leader" in role or "tl" in desig

    @staticmethod
    def _is_leader_or_hr(emp: dict) -> bool:
        w = emp.get("work_details", {})
        desig = str(w.get("designation") or "").strip().lower()
        dept = str(w.get("department") or "").strip().lower()
        role = str(w.get("system_role") or emp.get("role") or "").strip().lower()
        if "head" in desig or "head" in role:
            return True
        if "team leader" in desig or "team leader" in role or "tl" in desig:
            return True
        if dept == "hr" or "hr" in desig or role == "hr":
            return True
        return False

    @staticmethod
    def _is_admin_or_hr(current_user: dict) -> bool:
        return DailyProgressService._is_admin(current_user) or DailyProgressService._is_hr(current_user)

    @staticmethod
    async def _can_manage_progress(current_user: dict, action: str = "read") -> bool:
        if DailyProgressService._is_admin_or_hr(current_user):
            return True
        if DailyProgressService._is_head(current_user) or DailyProgressService._is_team_leader(current_user):
            return True
        from app.controllers.auth import resolve_effective_permissions_for_employee
        perms = await resolve_effective_permissions_for_employee(current_user)
        for mod in ["/approvals/daily-progress", "/daily-progress", "/approvals"]:
            p = perms.get(mod, {})
            if p.get("all") or p.get(action):
                return True
        return False

    @staticmethod
    def _is_active_emp(emp: dict) -> bool:
        w = emp.get("work_details", {})
        if emp.get("is_delete") or w.get("is_delete"):
            return False
        if emp.get("is_block") or w.get("is_block"):
            return False
        status = str(emp.get("status") or w.get("status") or "").strip().lower()
        if status in ["inactive", "terminated", "resigned", "blocked", "deleted"]:
            return False
        return True

    @staticmethod
    def _get_joining_date(emp: dict) -> Optional[date]:
        w = emp.get("work_details", {})
        jd = w.get("joining_date")
        if not jd:
            return None
        try:
            return datetime.strptime(str(jd)[:10], "%Y-%m-%d").date()
        except Exception:
            return None

    @staticmethod
    def _record_date_iso(r: dict) -> Optional[str]:
        sub = r.get("submitted_at")
        if not sub:
            return None
        if isinstance(sub, datetime):
            return sub.strftime("%Y-%m-%d")
        if isinstance(sub, date):
            return sub.strftime("%Y-%m-%d")
        sub_str = str(sub).strip()
        if len(sub_str) >= 10:
            return sub_str[:10]
        return None

    @staticmethod
    async def _get_scoped_employees(current_user: dict, group_filter: Optional[str] = None) -> List[dict]:
        from app.repository.employee import EmployeeRepository
        emp_res = await EmployeeRepository.get_all_employees(exclude_role="Admin")
        raw_emps = emp_res.get("data", [])

        # Filter: only active users (not deleted, not blocked)
        all_emps = [e for e in raw_emps if DailyProgressService._is_active_emp(e)]

        uid = str(current_user.get("_id") or current_user.get("id"))
        is_admin = DailyProgressService._is_admin(current_user)
        is_hr = DailyProgressService._is_hr(current_user)
        is_head = DailyProgressService._is_head(current_user)
        is_tl = DailyProgressService._is_team_leader(current_user)

        target = []
        for e in all_emps:
            eid = str(e.get("_id") or e.get("id"))
            w = e.get("work_details", {})
            role = str(w.get("system_role") or e.get("role") or "").strip().lower()
            if role == "admin":
                continue

            is_l_hr = DailyProgressService._is_leader_or_hr(e)

            if is_admin or is_hr:
                if group_filter == "employees" and is_l_hr:
                    continue
                if group_filter == "leaders_hr" and not is_l_hr:
                    continue
                target.append(e)
            elif is_head:
                user_dept = str(current_user.get("work_details", {}).get("department") or "").strip().lower()
                e_dept = str(w.get("department") or "").strip().lower()
                # Head manages own department, excludes own report
                if e_dept != user_dept or eid == uid:
                    continue
                if group_filter == "employees" and is_l_hr:
                    continue
                if group_filter == "leaders_hr" and not is_l_hr:
                    continue
                target.append(e)
            elif is_tl:
                # Team Leader: own report plus team members (no other TL/Head/HR)
                if eid == uid:
                    target.append(e)
                    continue
                if is_l_hr:
                    continue
                user_dept = str(current_user.get("work_details", {}).get("department") or "").strip().lower()
                user_sub = str(current_user.get("work_details", {}).get("sub_department") or "").strip().lower()
                e_dept = str(w.get("department") or "").strip().lower()
                e_sub = str(w.get("sub_department") or "").strip().lower()
                if user_sub and e_sub != user_sub:
                    continue
                if e_dept != user_dept:
                    continue
                target.append(e)
            else:
                # Regular employee: self only
                if eid == uid:
                    target.append(e)

        return target

    @staticmethod
    async def create_progress(data: DailyProgressCreate, current_user: dict) -> Dict[str, Any]:
        user_id = str(current_user.get("_id") or current_user.get("id"))
        personal = current_user.get("personal_info", {})
        work = current_user.get("work_details", {})
        
        user_name = f"{personal.get('first_name', '')} {personal.get('last_name', '')}".strip() or "Employee"
        department = work.get('department', 'Unknown')
        
        # Auto-fetch tasks from Task API
        from app.repository.task import TaskRepository
        from datetime import date, datetime
        today = date.today()
        
        all_tasks_res = await TaskRepository.get_all(assigned_to=user_id, limit=1000)
        tasks = all_tasks_res.get("data", [])
        
        assigned_tasks = []
        pending_tasks = []
        upcoming_tasks = []
        completed_today_tasks = []
        
        for t in tasks:
            task_summary = {
                "task_id": str(t.get("_id") or t.get("id")),
                "title": t.get("title", ""),
                "status": t.get("status", "")
            }
            
            if t.get("status") == "completed":
                # Check if completed today
                updated_at = t.get("updated_at")
                if updated_at:
                    if isinstance(updated_at, str):
                        try:
                            comp_date = datetime.fromisoformat(updated_at.replace('Z', '+00:00')).date()
                        except:
                            comp_date = None
                    else:
                        comp_date = updated_at.date() if hasattr(updated_at, 'date') else None
                        
                    if comp_date == today:
                        completed_today_tasks.append(task_summary)
                continue
                
            due_date_str = t.get("due_date")
            if not due_date_str:
                upcoming_tasks.append(task_summary)
                continue
                
            if isinstance(due_date_str, str):
                try:
                    due_date = datetime.fromisoformat(due_date_str.replace('Z', '+00:00')).date()
                except:
                    due_date = None
            else:
                due_date = due_date_str.date() if hasattr(due_date_str, 'date') else due_date_str
                
            if due_date:
                if due_date < today:
                    pending_tasks.append(task_summary)
                elif due_date == today:
                    assigned_tasks.append(task_summary)
                else:
                    upcoming_tasks.append(task_summary)
            else:
                upcoming_tasks.append(task_summary)
        
        progress_data = data.dict(exclude_unset=True)
        progress_data["employee_id"] = user_id
        progress_data["employee_name"] = user_name
        progress_data["department"] = department
        progress_data["assigned_tasks"] = assigned_tasks
        progress_data["pending_tasks"] = pending_tasks
        progress_data["upcoming_tasks"] = upcoming_tasks
        progress_data["completed_today_tasks"] = completed_today_tasks
        
        return await DailyProgressRepository.create_progress(progress_data)

    @staticmethod
    async def get_today_progress(current_user: dict) -> Dict[str, Any]:
        user_id = str(current_user.get("_id") or current_user.get("id"))
        from datetime import date, datetime
        today = date.today()
        
        # Check if already submitted today
        query = {
            "employee_id": user_id,
            "submitted_at": {
                "$gte": datetime(today.year, today.month, today.day),
                "$lte": datetime(today.year, today.month, today.day, 23, 59, 59)
            }
        }
        existing = await DailyProgressRepository.get_all_progress(query)
        if existing:
            return existing[0]
            
    @staticmethod
    async def _generate_draft(employee: dict, tasks: List[dict], target_date: date) -> dict:
        user_id = str(employee.get("_id") or employee.get("id"))
        assigned_tasks, pending_tasks, upcoming_tasks, completed_today_tasks = [], [], [], []
        
        for t in tasks:
            task_summary = {
                "task_id": str(t.get("_id") or t.get("id")),
                "title": t.get("title", ""),
                "status": t.get("status", "")
            }
            
            if t.get("status") == "completed":
                updated_at = t.get("updated_at")
                if updated_at:
                    if isinstance(updated_at, str):
                        try:
                            comp_date = datetime.fromisoformat(updated_at.replace('Z', '+00:00')).date()
                        except:
                            comp_date = None
                    else:
                        comp_date = updated_at.date() if hasattr(updated_at, 'date') else None
                    if comp_date == target_date:
                        completed_today_tasks.append(task_summary)
                continue
                
            due_date_str = t.get("due_date")
            if not due_date_str:
                upcoming_tasks.append(task_summary)
                continue
                
            if isinstance(due_date_str, str):
                try:
                    due_date = datetime.fromisoformat(due_date_str.replace('Z', '+00:00')).date()
                except:
                    due_date = None
            else:
                due_date = due_date_str.date() if hasattr(due_date_str, 'date') else due_date_str
                
            if due_date:
                if due_date < target_date:
                    pending_tasks.append(task_summary)
                elif due_date == target_date:
                    assigned_tasks.append(task_summary)
                else:
                    upcoming_tasks.append(task_summary)
            else:
                upcoming_tasks.append(task_summary)
                
        personal = employee.get("personal_info", {})
        work = employee.get("work_details", {})
        
        dt_str = datetime.combine(target_date, datetime.min.time()).isoformat()
        
        return {
            "employee_id": user_id,
            "employee_name": f"{personal.get('first_name', '')} {personal.get('last_name', '')}".strip() or "Employee",
            "department": work.get('department', 'Unknown'),
            "designation": work.get('designation', ''),
            "sub_department": work.get('sub_department', ''),
            "assigned_tasks": assigned_tasks,
            "pending_tasks": pending_tasks,
            "upcoming_tasks": upcoming_tasks,
            "completed_today_tasks": completed_today_tasks,
            "status": "PENDING", 
            "rating": 0,
            "remarks": None,
            "verified_by_id": None,
            "submitted_at": dt_str,
            "verified_at": None
        }

    @staticmethod
    async def get_today_progress(current_user: dict) -> Dict[str, Any]:
        user_id = str(current_user.get("_id") or current_user.get("id"))
        today = date.today()
        
        query = {
            "employee_id": user_id,
            "submitted_at": {
                "$gte": datetime(today.year, today.month, today.day),
                "$lte": datetime(today.year, today.month, today.day, 23, 59, 59)
            }
        }
        existing = await DailyProgressRepository.get_all_progress(query)
        if existing:
            emp_record = existing[0]
            if emp_record.get("status") == "PENDING":
                from app.repository.task import TaskRepository
                tasks_res = await TaskRepository.get_all(assigned_to=user_id, limit=1000)
                emp_tasks = tasks_res.get("data", [])
                draft = await DailyProgressService._generate_draft(current_user, emp_tasks, today)
                update_payload = {
                    "assigned_tasks": draft["assigned_tasks"],
                    "pending_tasks": draft["pending_tasks"],
                    "upcoming_tasks": draft["upcoming_tasks"],
                    "completed_today_tasks": draft["completed_today_tasks"]
                }
                await DailyProgressRepository.update_progress(str(emp_record.get("_id") or emp_record.get("id")), update_payload)
                # re-fetch
                existing = await DailyProgressRepository.get_all_progress(query)
            await DailyProgressService._attach_leave_flags(existing)
            return existing[0]
            
        from app.repository.task import TaskRepository
        all_tasks_res = await TaskRepository.get_all(assigned_to=user_id, limit=1000)
        tasks = all_tasks_res.get("data", [])
        
        draft = await DailyProgressService._generate_draft(current_user, tasks, today)
        created = await DailyProgressRepository.create_progress(draft)
        await DailyProgressService._attach_leave_flags([created])
        return created

    @staticmethod
    async def get_all_progress(
        current_user: dict, 
        search: Optional[str] = None, 
        employee_id: Optional[str] = None,
        status: Optional[str] = None,
        date_filter: Optional[str] = None,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        view_type: Optional[str] = None,
        department: Optional[str] = None,
        group_filter: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        user_id = str(current_user.get("_id") or current_user.get("id"))
        
        # Scoped employees according to role, team, and group_filter
        scoped_emps = await DailyProgressService._get_scoped_employees(current_user, group_filter=group_filter)
        scoped_ids = [str(e.get("_id") or e.get("id")) for e in scoped_emps]
        emp_map = {str(e.get("_id") or e.get("id")): e for e in scoped_emps}

        query = {}
        if view_type == "my":
            query["employee_id"] = user_id
        else:
            if employee_id:
                if employee_id in scoped_ids:
                    query["employee_id"] = employee_id
                else:
                    return []
            else:
                query["employee_id"] = {"$in": scoped_ids}

        if department:
            query["department"] = {"$regex": f"^{department}$", "$options": "i"}
                
        if search:
            search_regex = {"$regex": search, "$options": "i"}
            query["employee_name"] = search_regex
            
        mapped_status = None
        if status:
            clean_status = status.replace(" ", "").replace("-", "").replace("_", "").upper()
            if clean_status not in ["ALL", "ALLSTATUSES"]:
                mapped_status = clean_status
                if mapped_status == "APPROVED":
                    mapped_status = "VERIFIED"
                elif mapped_status == "PENDINGVERIFICATION":
                    mapped_status = "PENDING"
                query["status"] = mapped_status
            
        if date_filter:
            try:
                dt = datetime.strptime(date_filter, "%Y-%m-%d")
                query["submitted_at"] = {
                    "$gte": dt,
                    "$lte": dt.replace(hour=23, minute=59, second=59)
                }
            except ValueError:
                pass
        elif from_date or to_date:
            date_query = {}
            if from_date:
                try:
                    date_query["$gte"] = datetime.strptime(from_date, "%Y-%m-%d")
                except ValueError:
                    pass
            if to_date:
                try:
                    date_query["$lte"] = datetime.strptime(to_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
                except ValueError:
                    pass
            if date_query:
                query["submitted_at"] = date_query
                
        records = await DailyProgressRepository.get_all_progress(query)
        
        # If user wants ONLY VERIFIED or REJECTED, or we're filtering by a non-date range, we can return as is.
        # But if they want ALL or PENDING, we should append missing dynamic drafts.
        if not mapped_status or mapped_status in ["ALL", "PENDING"]:
            target_date = None
            if date_filter:
                try:
                    target_date = datetime.strptime(date_filter, "%Y-%m-%d").date()
                except ValueError:
                    pass
            elif not from_date and not to_date:
                # Default to today if no date range is provided
                target_date = date.today()
                
            if target_date:
                from app.repository.task import TaskRepository
                
                target_sync_emps = scoped_emps
                if view_type == "my":
                    target_sync_emps = [e for e in scoped_emps if str(e.get("_id") or e.get("id")) == user_id]
                elif employee_id:
                    target_sync_emps = [e for e in scoped_emps if str(e.get("_id") or e.get("id")) == employee_id]

                # Filter target_sync_emps by joining date: only include employees who joined on or before target_date
                valid_sync_emps = []
                for emp in target_sync_emps:
                    emp_jd = DailyProgressService._get_joining_date(emp)
                    if emp_jd and target_date < emp_jd:
                        continue
                    valid_sync_emps.append(emp)

                # Batch lookup existing records for target_date
                start_day = datetime(target_date.year, target_date.month, target_date.day)
                end_day = datetime(target_date.year, target_date.month, target_date.day, 23, 59, 59)
                existing_for_day = await DailyProgressRepository.get_all_progress({
                    "employee_id": {"$in": [str(e.get("_id") or e.get("id")) for e in valid_sync_emps]},
                    "submitted_at": {"$gte": start_day, "$lte": end_day}
                })
                existing_map = {str(d.get("employee_id")): d for d in existing_for_day}

                needs_refetch = False
                for emp in valid_sync_emps:
                    emp_id_str = str(emp.get("_id") or emp.get("id"))
                    if search:
                        emp_name = f"{emp.get('personal_info', {}).get('first_name', '')} {emp.get('personal_info', {}).get('last_name', '')}".strip()
                        if search.lower() not in emp_name.lower():
                            continue
                            
                    emp_record = existing_map.get(emp_id_str)
                    if not emp_record:
                        tasks_res = await TaskRepository.get_all(assigned_to=emp_id_str, limit=1000)
                        emp_tasks = tasks_res.get("data", [])
                        draft = await DailyProgressService._generate_draft(emp, emp_tasks, target_date)
                        await DailyProgressRepository.create_progress(draft)
                        needs_refetch = True
                    elif emp_record.get("status") == "PENDING":
                        # If pending and user wants latest tasks synced
                        tasks_res = await TaskRepository.get_all(assigned_to=emp_id_str, limit=1000)
                        emp_tasks = tasks_res.get("data", [])
                        draft = await DailyProgressService._generate_draft(emp, emp_tasks, target_date)
                        update_payload = {
                            "assigned_tasks": draft["assigned_tasks"],
                            "pending_tasks": draft["pending_tasks"],
                            "upcoming_tasks": draft["upcoming_tasks"],
                            "completed_today_tasks": draft["completed_today_tasks"]
                        }
                        await DailyProgressRepository.update_progress(str(emp_record.get("_id") or emp_record.get("id")), update_payload)
                        needs_refetch = True
                            
                if needs_refetch:
                    records = await DailyProgressRepository.get_all_progress(query)

        # Attach designation, sub_department, and leave flags
        for r in records:
            eid = str(r.get("employee_id") or "")
            if eid in emp_map:
                w = emp_map[eid].get("work_details", {})
                if not r.get("designation"):
                    r["designation"] = w.get("designation")
                if not r.get("sub_department"):
                    r["sub_department"] = w.get("sub_department")

        # Exclude any records before the employee's joining date
        valid_records = []
        for r in records:
            eid = str(r.get("employee_id") or "")
            emp = emp_map.get(eid)
            if emp:
                emp_jd = DailyProgressService._get_joining_date(emp)
                if emp_jd:
                    r_date_str = DailyProgressService._record_date_iso(r)
                    if r_date_str:
                        try:
                            if date.fromisoformat(r_date_str) < emp_jd:
                                continue # Prior to joining date
                        except Exception:
                            pass
            valid_records.append(r)

        # Deduplicate records by (employee_id, record_date)
        # Guarantees that each employee appears at most once per date
        unique_map: Dict[tuple, Dict[str, Any]] = {}
        for r in valid_records:
            eid = str(r.get("employee_id") or "")
            r_date_str = DailyProgressService._record_date_iso(r) or ""
            key = (eid, r_date_str)
            if key not in unique_map:
                unique_map[key] = r
            else:
                existing = unique_map[key]
                ex_status = str(existing.get("status") or "").upper()
                new_status = str(r.get("status") or "").upper()
                # Priority: VERIFIED > REJECTED > PENDING
                if new_status == "VERIFIED" and ex_status != "VERIFIED":
                    unique_map[key] = r
                elif new_status == ex_status:
                    # Prefer the record with more tasks
                    ex_cnt = len(existing.get("completed_today_tasks", [])) + len(existing.get("assigned_tasks", [])) + len(existing.get("pending_tasks", []))
                    new_cnt = len(r.get("completed_today_tasks", [])) + len(r.get("assigned_tasks", [])) + len(r.get("pending_tasks", []))
                    if new_cnt > ex_cnt:
                        unique_map[key] = r
        records = list(unique_map.values())

        await DailyProgressService._attach_leave_flags(records)
        return records

    @staticmethod
    async def get_stats(
        current_user: dict,
        time_range: Optional[str] = None,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        employee_id: Optional[str] = None,
        view_type: Optional[str] = None
    ) -> Dict[str, Any]:
        user_id = str(current_user.get("_id") or current_user.get("id"))
        scoped_emps = await DailyProgressService._get_scoped_employees(current_user)
        scoped_ids = [str(e.get("_id") or e.get("id")) for e in scoped_emps]
        
        query = {}
        
        if view_type == "my":
            query["employee_id"] = user_id
        elif employee_id:
            if employee_id in scoped_ids:
                query["employee_id"] = employee_id
            else:
                return {
                    "average_rating": 0.0,
                    "total_verified": 0,
                    "total_rejected": 0,
                    "total_pending": 0,
                    "total_records": 0
                }
        else:
            query["employee_id"] = {"$in": scoped_ids}

        from datetime import timedelta
        now = datetime.now()
        dt_start = None
        dt_end = None
        
        if time_range:
            tr = time_range.replace(" ", "").replace("-", "").replace("_", "").lower()
            if tr == "today":
                dt_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
                dt_end = now.replace(hour=23, minute=59, second=59, microsecond=999999)
            elif tr == "yesterday":
                yest = now - timedelta(days=1)
                dt_start = yest.replace(hour=0, minute=0, second=0, microsecond=0)
                dt_end = yest.replace(hour=23, minute=59, second=59, microsecond=999999)
            elif tr == "lastweek":
                dt_start = (now - timedelta(days=7)).replace(hour=0, minute=0, second=0, microsecond=0)
                dt_end = now.replace(hour=23, minute=59, second=59, microsecond=999999)
            elif tr == "thismonth":
                dt_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                dt_end = now.replace(hour=23, minute=59, second=59, microsecond=999999)
            elif tr == "lastmonth":
                first_of_this_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                last_of_last_month = first_of_this_month - timedelta(days=1)
                dt_start = last_of_last_month.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                dt_end = last_of_last_month.replace(hour=23, minute=59, second=59, microsecond=999999)
            elif tr == "customrange" or tr == "custom":
                if from_date:
                    try: dt_start = datetime.strptime(from_date, "%Y-%m-%d")
                    except: pass
                if to_date:
                    try: dt_end = datetime.strptime(to_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
                    except: pass
        else:
            if from_date:
                try: dt_start = datetime.strptime(from_date, "%Y-%m-%d")
                except: pass
            if to_date:
                try: dt_end = datetime.strptime(to_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
                except: pass
                
        if dt_start or dt_end:
            query["submitted_at"] = {}
            if dt_start: query["submitted_at"]["$gte"] = dt_start
            if dt_end: query["submitted_at"]["$lte"] = dt_end
            
            
        return await DailyProgressRepository.get_stats(query)

    @staticmethod
    async def get_progress_by_id(progress_id: str, current_user: dict) -> Optional[Dict[str, Any]]:
        progress = await DailyProgressRepository.get_progress_by_id(progress_id)
        if not progress:
            return None
            
        is_admin = await DailyProgressService._can_manage_progress(current_user, "read")
        user_id = str(current_user.get("_id") or current_user.get("id"))
        
        if not is_admin and progress.get("employee_id") != user_id:
            return None
            
        return progress

    @staticmethod
    async def update_progress(progress_id: str, data: DailyProgressUpdate, current_user: dict) -> Optional[Dict[str, Any]]:
        progress = await DailyProgressRepository.get_progress_by_id(progress_id)
        if not progress:
            return None
            
        user_id = str(current_user.get("_id") or current_user.get("id"))
        
        # Only the creator can update their progress
        if progress.get("employee_id") != user_id:
            return None
            
        update_data = data.model_dump(exclude_unset=True)
        update_data["updated_at"] = datetime.utcnow()
        
        personal_info = current_user.get("personal_info", {})
        user_name = f"{personal_info.get('first_name', '')} {personal_info.get('last_name', '')}".strip() or "Unknown"
        
        push_log = {
            "action": "DAILY REPORT UPDATED",
            "performed_by_id": user_id,
            "performed_by_name": user_name,
            "timestamp": datetime.utcnow(),
            "details": f"Updated daily report on {datetime.utcnow().date()}"
        }
        
        return await DailyProgressRepository.update_progress(progress_id, update_data, push_log)

    @staticmethod
    async def approve_progress(progress_id: str, data: DailyProgressApprove, current_user: dict) -> Optional[Dict[str, Any]]:
        if not await DailyProgressService._can_manage_progress(current_user, "update"):
            return None
            
        progress = await DailyProgressRepository.get_progress_by_id(progress_id)
        if not progress:
            return None
            
        user_id = str(current_user.get("_id") or current_user.get("id"))
        
        from fastapi import HTTPException, status
        if not data.rating or data.rating <= 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Rating is required.")

        if not data.remarks or not data.remarks.strip():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Manager remarks note is required.")

        # Self-approval block (Team Leader, Head, HR, and Employee cannot self-approve)
        if str(progress.get("employee_id")) == user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You cannot approve your own daily progress report. An Admin or another Head must verify it."
            )

        # On-leave block: If employee is on approved leave for this date, approval is disallowed
        d_iso = DailyProgressService._record_date_iso(progress)
        if d_iso:
            try:
                from datetime import date as _date
                d_obj = _date.fromisoformat(d_iso)
                leaves = await DailyProgressService._leave_ranges(d_obj, d_obj)
                target_eid = str(progress.get("employee_id") or "")
                if any(e2 == target_eid and ls <= d_iso <= le for (e2, ls, le) in leaves):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Cannot approve daily progress: Employee is on approved leave for this date."
                    )
            except HTTPException:
                raise
            except Exception:
                pass
        
        update_data = {
            "status": "VERIFIED",
            "rating": data.rating,
            "remarks": data.remarks.strip(),
            "verified_by_id": user_id,
            "verified_at": datetime.utcnow()
        }
        
        personal_info = current_user.get("personal_info", {})
        user_name = f"{personal_info.get('first_name', '')} {personal_info.get('last_name', '')}".strip() or "Unknown"
        emp_name = progress.get("employee_name", "Unknown")
        target_date = progress.get("submitted_at")
        date_str = target_date.strftime("%Y-%m-%d") if isinstance(target_date, datetime) else str(datetime.utcnow().date())
        
        push_log = {
            "action": "DAILY REPORT APPROVED",
            "performed_by_id": user_id,
            "performed_by_name": user_name,
            "timestamp": datetime.utcnow(),
            "details": f"Approved daily report for {emp_name} on {date_str}"
        }
        
        result = await DailyProgressRepository.update_progress(progress_id, update_data, push_log)
        
        if result:
            # Send notification to the employee
            await NotificationRepository.create_notification({
                "recipient_id": progress.get("employee_id"),
                "title": "Daily Progress Verified",
                "message": f"Your daily progress has been verified with a {data.rating}/10 rating.",
                "type": "general"
            })
            
        return result

    @staticmethod
    async def reject_progress(progress_id: str, current_user: dict) -> Optional[Dict[str, Any]]:
        if not DailyProgressService._is_admin_or_hr(current_user):
            return None
            
        progress = await DailyProgressRepository.get_progress_by_id(progress_id)
        if not progress:
            return None
            
        user_id = str(current_user.get("_id") or current_user.get("id"))
        
        update_data = {
            "status": "REJECTED",
            "verified_by_id": user_id,
            "verified_at": datetime.utcnow()
        }
        
        personal_info = current_user.get("personal_info", {})
        user_name = f"{personal_info.get('first_name', '')} {personal_info.get('last_name', '')}".strip() or "Unknown"
        emp_name = progress.get("employee_name", "Unknown")
        target_date = progress.get("submitted_at")
        date_str = target_date.strftime("%Y-%m-%d") if isinstance(target_date, datetime) else str(datetime.utcnow().date())
        
        push_log = {
            "action": "DAILY REPORT REJECTED",
            "performed_by_id": user_id,
            "performed_by_name": user_name,
            "timestamp": datetime.utcnow(),
            "details": f"Rejected daily report for {emp_name} on {date_str}"
        }
        
        result = await DailyProgressRepository.update_progress(progress_id, update_data, push_log)
        
        if result:
            # Send notification to the employee
            await NotificationRepository.create_notification({
                "recipient_id": progress.get("employee_id"),
                "title": "Daily Progress Rejected",
                "message": "Your daily progress report has been rejected. Please review and submit again.",
                "type": "general"
            })
            
        return result

    @staticmethod
    async def _leave_ranges(start, end):
        """Approved leaves overlapping [start, end] as (employee_id, start_iso, end_iso)."""
        from app.database.db import get_database
        out = []
        try:
            db = get_database()
            if db is None:
                return out
            cursor = db["leave_requests"].find(
                {"status": "Approved", "start_date": {"$lte": end.isoformat()}, "end_date": {"$gte": start.isoformat()}, "is_deleted": {"$ne": True}},
                {"employee_id": 1, "start_date": 1, "end_date": 1},
            )
            async for doc in cursor:
                eid = doc.get("employee_id")
                if eid:
                    out.append((str(eid), str(doc.get("start_date") or ""), str(doc.get("end_date") or "")))
        except Exception:
            pass
        return out

    @staticmethod
    def _record_date_iso(rec) -> str:
        dt = rec.get("submitted_at")
        try:
            if isinstance(dt, datetime):
                return dt.date().isoformat()
            if isinstance(dt, str):
                return dt[:10]
        except Exception:
            pass
        return ""

    @staticmethod
    async def _attach_leave_flags(records):
        """Leave-parallel: mark records whose employee is on approved leave that day."""
        try:
            dates = sorted({DailyProgressService._record_date_iso(r) for r in records if DailyProgressService._record_date_iso(r)})
            if not dates:
                for r in records:
                    r["on_leave"] = False
                return records
            from datetime import date as _date
            s = _date.fromisoformat(dates[0])
            e = _date.fromisoformat(dates[-1])
            leaves = await DailyProgressService._leave_ranges(s, e)
            for r in records:
                d = DailyProgressService._record_date_iso(r)
                eid = str(r.get("employee_id") or "")
                r["on_leave"] = any(e2 == eid and ls <= d <= le for (e2, ls, le) in leaves)
        except Exception:
            for r in records:
                r.setdefault("on_leave", False)
        return records

    @staticmethod
    async def reset_progress(progress_id: str, current_user: dict) -> Optional[Dict[str, Any]]:
        """Reopen VERIFIED/REJECTED back to PENDING (reset verification)."""
        if not DailyProgressService._is_admin_or_hr(current_user):
            return None

        progress = await DailyProgressRepository.get_progress_by_id(progress_id)
        if not progress:
            return None

        user_id = str(current_user.get("_id") or current_user.get("id"))

        update_data = {
            "status": "PENDING",
            "rating": 0,
            "remarks": None,
            "verified_by_id": None,
            "verified_at": None,
        }

        personal_info = current_user.get("personal_info", {})
        user_name = f"{personal_info.get('first_name', '')} {personal_info.get('last_name', '')}".strip() or "Unknown"
        emp_name = progress.get("employee_name", "Unknown")

        push_log = {
            "action": "DAILY REPORT RESET",
            "performed_by_id": user_id,
            "performed_by_name": user_name,
            "timestamp": datetime.utcnow(),
            "details": f"Reset daily report for {emp_name} back to pending"
        }

        result = await DailyProgressRepository.update_progress(progress_id, update_data, push_log)

        if result:
            await NotificationRepository.create_notification({
                "recipient_id": progress.get("employee_id"),
                "title": "Daily Progress Reopened",
                "message": "Your daily progress report was reset to pending for re-review.",
                "type": "general"
            })

        return result

    @staticmethod
    async def delete_progress(progress_id: str, current_user: dict) -> bool:
        if not DailyProgressService._is_admin_or_hr(current_user):
            return False
            
        return await DailyProgressRepository.delete_progress(progress_id)
