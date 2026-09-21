from app.repository.daily_progress import DailyProgressRepository
from app.schemas.daily_progress import DailyProgressCreate, DailyProgressUpdate, DailyProgressApprove
from app.repository.notification import NotificationRepository
from typing import Optional, List, Dict, Any
from datetime import datetime, date

class DailyProgressService:

    @staticmethod
    def _is_admin_or_hr(current_user: dict) -> bool:
        role = str(current_user.get("work_details", {}).get("system_role", "")).lower()
        user_id = str(current_user.get("_id") or current_user.get("id"))
        return role in ["admin", "hr", "subadmin", "sub-admin"] or user_id == "default-admin-id"

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
            return existing[0]
            
        from app.repository.task import TaskRepository
        all_tasks_res = await TaskRepository.get_all(assigned_to=user_id, limit=1000)
        tasks = all_tasks_res.get("data", [])
        
        draft = await DailyProgressService._generate_draft(current_user, tasks, today)
        return await DailyProgressRepository.create_progress(draft)

    @staticmethod
    async def get_all_progress(
        current_user: dict, 
        search: Optional[str] = None, 
        employee_id: Optional[str] = None,
        status: Optional[str] = None,
        date_filter: Optional[str] = None,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        view_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        is_admin = DailyProgressService._is_admin_or_hr(current_user)
        user_id = str(current_user.get("_id") or current_user.get("id"))
        
        query = {}
        
        if view_type == "my":
            query["employee_id"] = user_id
        elif view_type == "team":
            department = current_user.get("work_details", {}).get("department")
            if department:
                query["department"] = department
            else:
                query["employee_id"] = user_id
        else:
            if not is_admin:
                query["employee_id"] = user_id
            elif employee_id:
                query["employee_id"] = employee_id
                
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
                # Sync logic: Ensure all employees have a DB record for this date
                # If they have a PENDING record, update it. If they have none, create it.
                from app.repository.employee import EmployeeRepository
                from app.repository.task import TaskRepository
                
                emp_res = await EmployeeRepository.get_all_employees(limit=1000)
                all_emps = emp_res.get("data", [])
                
                # Fetch all tasks in one go to optimize? Or just fetch per employee since we need to.
                # Actually, we should just update existing records if they are PENDING, and create if missing.
                for emp in all_emps:
                    emp_id_str = str(emp.get("_id") or emp.get("id"))
                    
                    if view_type == "my" and emp_id_str != user_id:
                        continue
                    if view_type == "team":
                        emp_dept = emp.get("work_details", {}).get("department")
                        if current_user.get("work_details", {}).get("department") != emp_dept:
                            continue
                            
                    if not view_type and not is_admin and emp_id_str != user_id:
                        continue
                    
                    if employee_id and emp_id_str != employee_id:
                        continue
                    if search:
                        emp_name = f"{emp.get('personal_info', {}).get('first_name', '')} {emp.get('personal_info', {}).get('last_name', '')}".strip()
                        if search.lower() not in emp_name.lower():
                            continue
                            
                    # Check if record exists for this employee and date
                    emp_query = {
                        "employee_id": emp_id_str,
                        "submitted_at": {
                            "$gte": datetime(target_date.year, target_date.month, target_date.day),
                            "$lte": datetime(target_date.year, target_date.month, target_date.day, 23, 59, 59)
                        }
                    }
                    existing_for_emp = await DailyProgressRepository.get_all_progress(emp_query)
                    
                    if not existing_for_emp:
                        # Create new record in DB
                        tasks_res = await TaskRepository.get_all(assigned_to=emp_id_str, limit=1000)
                        emp_tasks = tasks_res.get("data", [])
                        draft = await DailyProgressService._generate_draft(emp, emp_tasks, target_date)
                        await DailyProgressRepository.create_progress(draft)
                    else:
                        # If exists and is PENDING, we should update it with latest tasks
                        emp_record = existing_for_emp[0]
                        if emp_record.get("status") == "PENDING":
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
                            
                # Re-fetch after sync
                records = await DailyProgressRepository.get_all_progress(query)
                
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
        is_admin = DailyProgressService._is_admin_or_hr(current_user)
        user_id = str(current_user.get("_id") or current_user.get("id"))
        
        query = {}
        
        if view_type == "my":
            query["employee_id"] = user_id
        elif view_type == "team":
            department = current_user.get("work_details", {}).get("department")
            if department:
                query["department"] = department
            else:
                query["employee_id"] = user_id
        else:
            if not is_admin:
                query["employee_id"] = user_id
            elif employee_id:
                query["employee_id"] = employee_id

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
            
        is_admin = DailyProgressService._is_admin_or_hr(current_user)
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
        if not DailyProgressService._is_admin_or_hr(current_user):
            return None
            
        progress = await DailyProgressRepository.get_progress_by_id(progress_id)
        if not progress:
            return None
            
        user_id = str(current_user.get("_id") or current_user.get("id"))
        
        update_data = {
            "status": "VERIFIED",
            "rating": data.rating,
            "remarks": data.remarks,
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
    async def delete_progress(progress_id: str, current_user: dict) -> bool:
        if not DailyProgressService._is_admin_or_hr(current_user):
            return False
            
        return await DailyProgressRepository.delete_progress(progress_id)
