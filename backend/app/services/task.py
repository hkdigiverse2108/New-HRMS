from typing import Optional
from datetime import datetime
from app.repository.task import TaskRepository
from app.repository.employee import EmployeeRepository
from app.schemas.task import TaskCreate, TaskUpdate, TaskQuickAssign
from app.redis.service import get_cache, set_cache, delete_cache, clear_pattern, make_list_key

class TaskService:
    @staticmethod
    async def _populate_user_details(item: dict, emp_cache: dict):
        async def get_details(emp_id):
            if not emp_id:
                return {"employee_name": "Management"}
            emp_id_str = str(emp_id).strip()
            if emp_id_str not in emp_cache:
                if emp_id_str.lower() in ["system", "default-admin-id", "unknown", "none"]:
                    emp_cache[emp_id_str] = {"employee_name": "Management"}
                else:
                    emp = await EmployeeRepository.get_employee_by_id(emp_id_str)
                    if emp:
                        personal = emp.get("personal_info", {})
                        first = (personal.get("first_name") or "").strip()
                        last = (personal.get("last_name") or "").strip()
                        name = f"{first} {last}".strip()
                        if not name:
                            name = emp.get("name") or "Employee"
                        emp_cache[emp_id_str] = {"employee_name": name}
                    else:
                        emp_cache[emp_id_str] = {"employee_name": "Management"}
            return emp_cache[emp_id_str]

        if "_id" in item:
            item["id"] = str(item["_id"])
            item["_id"] = str(item["_id"])

        for field in ["assigned_to", "assigned_by"]:
            item[f"{field}_details"] = await get_details(item.get(field))
            
        # fallback for existing tasks
        created_by = item.get("created_by") or item.get("assigned_by")
        item["created_by"] = created_by
        item["created_by_details"] = await get_details(created_by)
        
        approved_by = item.get("approved_by")
        if approved_by:
            item["approved_by_details"] = await get_details(approved_by)
            
        transfer_req = item.get("transfer_request")
        if transfer_req:
            transfer_req["requested_to_details"] = await get_details(transfer_req.get("requested_to"))
            transfer_req["requested_by_details"] = await get_details(transfer_req.get("requested_by"))
            
        transfer_hist = item.get("transfer_history")
        if transfer_hist:
            for hist in transfer_hist:
                hist["from_employee_details"] = await get_details(hist.get("from_employee"))
                hist["to_employee_details"] = await get_details(hist.get("to_employee"))

        activity_hist = item.get("activity_history")
        if activity_hist:
            for act in activity_hist:
                perf = act.get("performed_by")
                act["performed_by_name"] = (await get_details(perf)).get("employee_name", "Management")
                
        # Populate Project Details for SMM tasks
        project_id = item.get("project_id")
        if project_id:
            from app.repository.project import ProjectRepository
            proj = await ProjectRepository.get_by_id(project_id)
            if proj:
                if "_id" in proj:
                    proj["_id"] = str(proj["_id"])
                item["project_details"] = proj
                
        # Populate Content Details for SMM tasks
        content_item_id = item.get("content_item_id")
        if content_item_id:
            from app.repository.content import ContentRepository
            content = await ContentRepository.get_by_id(content_item_id)
            if content:
                if "_id" in content:
                    content["_id"] = str(content["_id"])
                item["content_item_details"] = content

    @staticmethod
    async def process_recurring_tasks():
        """
        Auto-generates daily routine tasks if not yet created for today.
        """
        try:
            collection = await TaskRepository.get_collection()
            now = datetime.utcnow()
            start_of_today = datetime(now.year, now.month, now.day)
            end_of_today = datetime(now.year, now.month, now.day, 23, 59, 59, 999999)

            cursor = collection.find({
                "is_deleted": False,
                "recurrence": {"$in": ["daily", "Daily Routine", "weekly", "Weekly Task", "monthly", "Monthly Task"]},
                "is_recurring_instance": {"$ne": True}
            })

            new_instances = []
            async for task in cursor:
                rec_val = str(task.get("recurrence") or "").lower()
                parent_id = str(task["_id"])

                if "daily" in rec_val:
                    existing = await collection.find_one({
                        "is_deleted": False,
                        "$or": [
                            {"parent_task_id": parent_id, "due_date": {"$gte": start_of_today, "$lte": end_of_today}},
                            {"_id": task["_id"], "due_date": {"$gte": start_of_today, "$lte": end_of_today}}
                        ]
                    })
                    if not existing:
                        instance = {
                            "title": task.get("title"),
                            "description": task.get("description"),
                            "status": "todo",
                            "priority": task.get("priority", "medium"),
                            "due_date": start_of_today,
                            "assigned_to": task.get("assigned_to"),
                            "assigned_by": task.get("assigned_by"),
                            "created_by": task.get("created_by"),
                            "recurrence": task.get("recurrence"),
                            "parent_task_id": parent_id,
                            "is_recurring_instance": True,
                            "created_at": now,
                            "updated_at": now,
                            "is_deleted": False,
                            "activity_history": [{
                                "action": "created",
                                "performed_by": str(task.get("assigned_by") or "system"),
                                "timestamp": now,
                                "details": "Daily routine task automatically generated for today."
                            }]
                        }
                        new_instances.append(instance)

            if new_instances:
                await collection.insert_many(new_instances)
                await clear_pattern("tasks:*")
        except Exception as e:
            pass

    @staticmethod
    async def create_task(data: TaskCreate, assigned_by: str):
        insert_data = data.model_dump(exclude_unset=True)
        insert_data["assigned_by"] = assigned_by
        insert_data["created_by"] = assigned_by
        now = datetime.utcnow()
        if "activity_history" not in insert_data or not insert_data["activity_history"]:
            insert_data["activity_history"] = [{
                "action": "created",
                "performed_by": assigned_by,
                "timestamp": now,
                "details": "Task created"
            }]
        created = await TaskRepository.create(insert_data)
        await clear_pattern("tasks:*")
        return created

    @staticmethod
    async def quick_assign_tasks(tasks: list[TaskQuickAssign], assigned_by: str):
        insert_data_list = []
        now = datetime.utcnow()
        for task in tasks:
            task_assigned_by = task.assigned_by if task.assigned_by else assigned_by
            for assignee in task.assigned_to:
                insert_data = {
                    "title": task.title,
                    "description": None,
                    "status": "todo",
                    "priority": "medium",
                    "due_date": task.due_date,
                    "assigned_to": assignee,
                    "assigned_by": task_assigned_by,
                    "created_by": task_assigned_by,
                    "activity_history": [{
                        "action": "created",
                        "performed_by": task_assigned_by,
                        "timestamp": now,
                        "details": "Quick assigned task created"
                    }]
                }
                insert_data_list.append(insert_data)
            
        if not insert_data_list:
            return []
            
        created_items = await TaskRepository.create_many(insert_data_list)
        await clear_pattern("tasks:*")
        
        emp_cache = {}
        for item in created_items:
            await TaskService._populate_user_details(item, emp_cache)
            
        return created_items

    @staticmethod
    async def get_all_tasks(
        is_deleted: bool = False, 
        assigned_to: Optional[str] = None, 
        assigned_by: Optional[str] = None, 
        status: Optional[str] = None, 
        priority: Optional[str] = None, 
        page: Optional[int] = None, 
        limit: Optional[int] = None, 
        involved_emp_id: Optional[str] = None, 
        history_assigned_to: Optional[str] = None, 
        history_assigned_by: Optional[str] = None
    ):
        await TaskService.process_recurring_tasks()

        cache_key = make_list_key(
            "tasks",
            is_deleted=is_deleted,
            assigned_to=assigned_to,
            assigned_by=assigned_by,
            status=status,
            priority=priority,
            page=page,
            limit=limit,
            involved_emp_id=involved_emp_id,
            history_assigned_to=history_assigned_to,
            history_assigned_by=history_assigned_by
        )
        cached = await get_cache(cache_key)
        if cached is not None:
            return cached

        result = await TaskRepository.get_all(
            is_deleted, 
            assigned_to, 
            assigned_by, 
            status, 
            priority, 
            page, 
            limit, 
            involved_emp_id, 
            history_assigned_to, 
            history_assigned_by
        )
        
        emp_cache = {}
        for item in result.get("data", []):
            await TaskService._populate_user_details(item, emp_cache)
            
        await set_cache(cache_key, result, ttl=300)
        return result

    @staticmethod
    async def get_task_by_id(item_id: str):
        cache_key = f"tasks:item:{item_id}"
        cached = await get_cache(cache_key)
        if cached is not None:
            return cached

        item = await TaskRepository.get_by_id(item_id)
        if item:
            emp_cache = {}
            await TaskService._populate_user_details(item, emp_cache)
            await set_cache(cache_key, item, ttl=300)
        return item

    @staticmethod
    async def update_task(item_id: str, update_data: TaskUpdate, updater_id: Optional[str] = None):
        existing = await TaskRepository.get_by_id(item_id)
        update_dict = update_data.model_dump(exclude_unset=True)
        now = datetime.utcnow()
        
        activity = list(existing.get("activity_history", [])) if existing else []
        if "status" in update_dict and existing and existing.get("status") != update_dict["status"]:
            old_s = existing.get("status")
            new_s = update_dict["status"]
            activity.append({
                "action": "status_changed",
                "performed_by": updater_id,
                "timestamp": now,
                "details": f"Status updated from '{old_s}' to '{new_s}'"
            })
            update_dict["activity_history"] = activity

        res = await TaskRepository.update(item_id, update_dict)
        await clear_pattern("tasks:*")
        return res

    @staticmethod
    async def delete_task(item_id: str):
        res = await TaskRepository.soft_delete(item_id)
        await clear_pattern("tasks:*")
        return res

    @staticmethod
    async def request_transfer(task_id: str, requested_to: str, requested_by: str, reason: Optional[str] = None):
        existing = await TaskRepository.get_by_id(task_id)
        now = datetime.utcnow()
        activity = list(existing.get("activity_history", [])) if existing else []
        activity.append({
            "action": "transfer_requested",
            "performed_by": requested_by,
            "timestamp": now,
            "details": f"Transfer requested to employee {requested_to}. Reason: {reason or 'Not specified'}"
        })

        transfer_req = {
            "requested_to": requested_to,
            "requested_by": requested_by,
            "requested_at": now,
            "reason": reason,
            "status": "pending"
        }
        res = await TaskRepository.update(task_id, {
            "transfer_request": transfer_req,
            "activity_history": activity
        })
        await clear_pattern("tasks:*")
        return res

    @staticmethod
    async def accept_transfer(task_id: str, task: dict):
        req = task.get("transfer_request")
        if not req or req.get("status") != "pending":
            return False
            
        now = datetime.utcnow()
        history_item = {
            "from_employee": task.get("assigned_to"),
            "to_employee": req.get("requested_to"),
            "transferred_at": now,
            "reason": req.get("reason"),
            "status": "accepted"
        }
        
        current_history = task.get("transfer_history", [])
        current_history.append(history_item)

        activity = list(task.get("activity_history", []))
        activity.append({
            "action": "transfer_accepted",
            "performed_by": req.get("requested_to"),
            "timestamp": now,
            "details": f"Transfer accepted. Task reassigned."
        })
        
        update_data = {
            "assigned_to": req.get("requested_to"),
            "transfer_request": None,
            "transfer_history": current_history,
            "activity_history": activity
        }
        
        res = await TaskRepository.update(task_id, update_data)
        await clear_pattern("tasks:*")
        return res

    @staticmethod
    async def get_daily_overview(employee_id: str):
        from datetime import date
        today = date.today()
        
        # Get all tasks for this employee
        all_tasks_res = await TaskRepository.get_all(assigned_to=employee_id, limit=1000)
        tasks = all_tasks_res.get("data", [])
        
        emp_cache = {}
        today_tasks = []
        upcoming_tasks = []
        
        for t in tasks:
            if t.get("status") == "completed":
                continue
                
            await TaskService._populate_user_details(t, emp_cache)
                
            due_date_str = t.get("due_date")
            if not due_date_str:
                upcoming_tasks.append(t)
                continue
                
            # Parse due date
            from datetime import datetime
            if isinstance(due_date_str, str):
                due_date = datetime.fromisoformat(due_date_str.replace('Z', '+00:00')).date()
            else:
                due_date = due_date_str.date() if hasattr(due_date_str, 'date') else due_date_str
                
            if due_date <= today:
                today_tasks.append((t, due_date))
            else:
                upcoming_tasks.append(t)
                
        # Sort today_tasks: Overdue first (oldest first), then today's tasks
        today_tasks.sort(key=lambda x: x[1])
        
        # Return just the task dicts
        return {
            "today": [item[0] for item in today_tasks],
            "upcoming": upcoming_tasks
        }

    @staticmethod
    async def reject_transfer(task_id: str, task: dict):
        req = task.get("transfer_request")
        now = datetime.utcnow()
        update_data = {"transfer_request": None}
        
        if req:
            history_item = {
                "from_employee": task.get("assigned_to"),
                "to_employee": req.get("requested_to"),
                "transferred_at": now,
                "reason": req.get("reason"),
                "status": "rejected"
            }
            current_history = task.get("transfer_history", [])
            current_history.append(history_item)
            update_data["transfer_history"] = current_history

            activity = list(task.get("activity_history", []))
            activity.append({
                "action": "transfer_declined",
                "performed_by": req.get("requested_to"),
                "timestamp": now,
                "details": f"Transfer request was declined."
            })
            update_data["activity_history"] = activity
            
        res = await TaskRepository.update(task_id, update_data)
        await clear_pattern("tasks:*")
        return res

    @staticmethod
    async def approve_task(task_id: str, approved_by: str):
        existing = await TaskRepository.get_by_id(task_id)
        now = datetime.utcnow()
        activity = list(existing.get("activity_history", [])) if existing else []
        activity.append({
            "action": "approved",
            "performed_by": approved_by,
            "timestamp": now,
            "details": "Task submitted work approved and marked as Completed"
        })

        update_data = {
            "status": "completed",
            "approved_by": approved_by,
            "approved_at": now,
            "review_rejected_reason": None,
            "activity_history": activity
        }
        res = await TaskRepository.update(task_id, update_data)
        await clear_pattern("tasks:*")
        return res

    @staticmethod
    async def reject_review(task_id: str, reason: Optional[str] = None, rejector_id: Optional[str] = None):
        existing = await TaskRepository.get_by_id(task_id)
        now = datetime.utcnow()
        activity = list(existing.get("activity_history", [])) if existing else []
        activity.append({
            "action": "revision_requested",
            "performed_by": rejector_id,
            "timestamp": now,
            "details": f"Revision requested: {reason or 'Needs rework'}"
        })

        update_data = {
            "status": "inprogress",
            "review_rejected_reason": reason or "Needs rework",
            "activity_history": activity
        }
        res = await TaskRepository.update(task_id, update_data)
        await clear_pattern("tasks:*")
        return res

    @staticmethod
    async def get_task_stats(involved_emp_id: Optional[str] = None):
        await TaskService.process_recurring_tasks()

        cache_key = f"tasks:stats:{involved_emp_id or 'all'}"
        cached = await get_cache(cache_key)
        if cached is not None:
            return cached

        stats = await TaskRepository.get_stats(involved_emp_id)
        await set_cache(cache_key, stats, ttl=300)
        return stats
