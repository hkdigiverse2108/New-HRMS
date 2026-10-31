import asyncio
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, date
from fastapi import HTTPException
from app.repository.task import TaskRepository
from app.repository.employee import EmployeeRepository
from app.schemas.task import TaskCreate, TaskUpdate, TaskQuickAssign
from app.redis.service import get_cache, set_cache, delete_cache, clear_pattern, make_list_key

class TaskService:
    @staticmethod
    async def _batch_prefetch(items: list[dict]) -> tuple[dict, dict, dict]:
        """Pre-fetch all employees, projects, and clients for the given tasks in 3 batch queries."""
        from app.database.db import get_database
        from bson import ObjectId
        db = get_database()

        emp_cache: Dict[str, dict] = {}
        proj_cache: Dict[str, dict] = {}
        client_cache: Dict[str, dict] = {}
        if not items or db is None:
            return emp_cache, proj_cache, client_cache

        emp_ids = set()
        proj_ids = set()

        for item in items:
            for f in ["assigned_to", "assigned_by", "created_by", "approved_by"]:
                val = item.get(f)
                if val and str(val).strip().lower() not in ["system", "default-admin-id", "unknown", "none"]:
                    emp_ids.add(str(val).strip())
            tr = item.get("transfer_request")
            if isinstance(tr, dict):
                if tr.get("requested_to"): emp_ids.add(str(tr["requested_to"]).strip())
                if tr.get("requested_by"): emp_ids.add(str(tr["requested_by"]).strip())
            for hist in (item.get("transfer_history") or []):
                if isinstance(hist, dict):
                    if hist.get("from_employee"): emp_ids.add(str(hist["from_employee"]).strip())
                    if hist.get("to_employee"): emp_ids.add(str(hist["to_employee"]).strip())
            for act in (item.get("activity_history") or []):
                if isinstance(act, dict) and act.get("performed_by"):
                    emp_ids.add(str(act["performed_by"]).strip())
            pid = item.get("project_id")
            if pid and str(pid).strip():
                proj_ids.add(str(pid).strip())

        # 1. Batch fetch employees in ONE single database query
        if emp_ids:
            obj_ids = [ObjectId(sid) for sid in emp_ids if ObjectId.is_valid(sid)]
            str_ids = list(emp_ids)
            query = {"$or": [{"_id": {"$in": obj_ids}}, {"id": {"$in": str_ids}}]} if obj_ids else {"id": {"$in": str_ids}}
            try:
                cursor = db["employees"].find(query)
                async for emp in cursor:
                    eid_str = str(emp.get("_id") or emp.get("id"))
                    personal = emp.get("personal_info", {})
                    first = (personal.get("first_name") or "").strip()
                    last = (personal.get("last_name") or "").strip()
                    name = f"{first} {last}".strip() or emp.get("name") or "Employee"
                    entry = {"employee_name": name}
                    emp_cache[eid_str] = entry
                    if emp.get("id"):
                        emp_cache[str(emp["id"])] = entry
            except Exception:
                pass

        # 2. Batch fetch projects in ONE single database query
        client_ids = set()
        if proj_ids:
            obj_ids = [ObjectId(sid) for sid in proj_ids if ObjectId.is_valid(sid)]
            str_ids = list(proj_ids)
            query = {"$or": [{"_id": {"$in": obj_ids}}, {"id": {"$in": str_ids}}]} if obj_ids else {"id": {"$in": str_ids}}
            try:
                cursor = db["projects"].find(query)
                async for proj in cursor:
                    pid_str = str(proj.get("_id") or proj.get("id"))
                    proj_cache[pid_str] = proj
                    if proj.get("id"):
                        proj_cache[str(proj["id"])] = proj
                    cid = proj.get("client_id")
                    if cid and str(cid).strip():
                        client_ids.add(str(cid).strip())
            except Exception:
                pass

        # 3. Batch fetch clients in ONE single database query
        if client_ids:
            obj_ids = [ObjectId(sid) for sid in client_ids if ObjectId.is_valid(sid)]
            str_ids = list(client_ids)
            query = {"$or": [{"_id": {"$in": obj_ids}}, {"id": {"$in": str_ids}}]} if obj_ids else {"id": {"$in": str_ids}}
            try:
                cursor = db["clients"].find(query)
                async for cl in cursor:
                    cid_str = str(cl.get("_id") or cl.get("id"))
                    client_cache[cid_str] = cl
                    if cl.get("id"):
                        client_cache[str(cl["id"])] = cl
            except Exception:
                pass

        return emp_cache, proj_cache, client_cache
    @staticmethod
    async def _populate_user_details(item: dict, emp_cache: dict, proj_cache: Optional[dict] = None, client_cache: Optional[dict] = None, content_cache: Optional[dict] = None):
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
                
        # Populate Project Details and Client Details for tasks with caching
        project_id = str(item.get("project_id") or "").strip()
        if project_id:
            from app.repository.project import ProjectRepository
            from app.repository.client import ClientRepository
            
            proj = None
            if proj_cache is not None and project_id in proj_cache:
                proj = proj_cache[project_id]
            else:
                proj = await ProjectRepository.get_by_id(project_id)
                if proj_cache is not None:
                    proj_cache[project_id] = proj

            if proj:
                gen = (proj.get("general") or {}) if isinstance(proj.get("general"), dict) else {}
                client_id = str(proj.get("client_id") or "").strip()
                
                proj_summary = {
                    "_id": str(proj.get("_id") or project_id),
                    "id": str(proj.get("_id") or project_id),
                    "project_name": gen.get("project_name", "Development Project"),
                    "category": str(gen.get("category", "Development")),
                    "status": str(gen.get("status", "In Progress")),
                    "client_id": client_id if client_id else None
                }
                
                if client_id:
                    client = None
                    if client_cache is not None and client_id in client_cache:
                        client = client_cache[client_id]
                    else:
                        client = await ClientRepository.get_by_id(client_id)
                        if client_cache is not None:
                            client_cache[client_id] = client

                    if client:
                        client_summary = {
                            "_id": str(client.get("_id") or client_id),
                            "id": str(client.get("_id") or client_id),
                            "company_name": client.get("company_name", ""),
                            "contact_person_name": client.get("contact_person_name", "")
                        }
                        proj_summary["client_details"] = client_summary
                        item["client_details"] = client_summary
                        
                item["project_details"] = proj_summary
                
        # Populate Content Details for SMM tasks with caching
        content_item_id = str(item.get("content_item_id") or "").strip()
        if content_item_id:
            from app.repository.content import ContentRepository
            content = None
            if content_cache is not None and content_item_id in content_cache:
                content = content_cache[content_item_id]
            else:
                content = await ContentRepository.get_by_id(content_item_id)
                if content_cache is not None:
                    content_cache[content_item_id] = content

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

        if not insert_data.get("status"):
            insert_data["status"] = "todo"

        if not insert_data.get("priority"):
            insert_data["priority"] = "medium"

        # Deduplication: Prevent duplicate active tasks for the same employee
        assigned_to = insert_data.get("assigned_to")
        title = (insert_data.get("title") or "").strip()
        due_date = insert_data.get("due_date")
        desc = insert_data.get("description") or ""
        is_punch_in_task = "Created during Punch-In activity tracking" in desc

        if assigned_to and title:
            import re
            collection = await TaskRepository.get_collection()
            dup_query = {
                "assigned_to": str(assigned_to),
                "is_deleted": False,
                "status": {"$in": ["todo", "inprogress", "inreview", "bugs"]},
                "title": {"$regex": f"^{re.escape(title)}$", "$options": "i"}
            }
            if not is_punch_in_task and due_date:
                d_val = due_date.date() if hasattr(due_date, 'date') else due_date
                if isinstance(d_val, date):
                    d_start = datetime.combine(d_val, datetime.min.time())
                    d_end = datetime.combine(d_val, datetime.max.time())
                    dup_query["due_date"] = {"$gte": d_start, "$lte": d_end}

            existing_task = await collection.find_one(dup_query)
            if existing_task:
                existing_task["_id"] = str(existing_task["_id"])
                return existing_task

        if insert_data.get("project_id") and (not insert_data.get("task_category") or insert_data.get("task_category") == "General"):
            from app.repository.project import ProjectRepository
            proj = await ProjectRepository.get_by_id(insert_data["project_id"])
            if proj:
                gen_cat = (proj.get("general", {}) or {}).get("category", "Development")
                insert_data["task_category"] = str(gen_cat)
            else:
                insert_data["task_category"] = "Development"

        now = datetime.utcnow()
        if "activity_history" not in insert_data or not insert_data["activity_history"]:
            insert_data["activity_history"] = [{
                "action": "created",
                "performed_by": assigned_by,
                "timestamp": now,
                "details": "Task created"
            }]
        created = await TaskRepository.create(insert_data)
        created_id = str(created.get("_id") or created.get("id"))
        
        if insert_data.get("assigned_to") and str(insert_data["assigned_to"]) != str(assigned_by):
            try:
                from app.repository.notification import NotificationRepository
                await NotificationRepository.create_notification({
                    "recipient_id": str(insert_data["assigned_to"]),
                    "title": "New Task Assigned",
                    "message": f"You were assigned: {insert_data.get('title', 'New Task')}",
                    "type": "task",
                    "action_url": "/tasks",
                    "sender_id": str(assigned_by),
                    "is_read": False
                })
            except Exception as ne:
                print(f"[TASK NOTIF ERROR] {ne}")

        status_value = getattr(insert_data.get("status"), "value", insert_data.get("status"))
        if str(status_value or "").lower() == "inprogress" and insert_data.get("assigned_to"):
            await TaskService._enforce_single_inprogress_task(insert_data["assigned_to"], created_id, assigned_by)

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
                    "project_id": getattr(task, "project_id", None),
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
        history_assigned_by: Optional[str] = None,
        content_item_id: Optional[str] = None,
        project_id: Optional[str] = None,
        creative_role: Optional[str] = None,
        task_category: Optional[str] = None,
        timeline_filter: Optional[str] = None,
        target_date: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        search: Optional[str] = None,
        team_employee_ids: Optional[list[str]] = None,
        sub_category: Optional[str] = None
    ):
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
            history_assigned_by=history_assigned_by,
            content_item_id=content_item_id,
            project_id=project_id,
            creative_role=creative_role,
            task_category=task_category,
            timeline_filter=timeline_filter,
            target_date=target_date,
            start_date=start_date.isoformat() if start_date else None,
            end_date=end_date.isoformat() if end_date else None,
            search=search,
            team_employee_ids=",".join(team_employee_ids) if team_employee_ids else None,
            sub_category=sub_category
        )
        cached = await get_cache(cache_key)
        if cached is not None:
            return cached

        # Run recurring tasks processing in the background (non-blocking) with throttle
        last_rec = await get_cache("tasks:last_recurring_run")
        if not last_rec:
            await set_cache("tasks:last_recurring_run", "1", ttl=1800)
            asyncio.create_task(TaskService.process_recurring_tasks())

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
            history_assigned_by,
            content_item_id,
            project_id,
            creative_role,
            task_category,
            timeline_filter,
            target_date,
            start_date,
            end_date,
            search,
            team_employee_ids,
            sub_category
        )
        
        items = result.get("data", [])
        emp_cache, proj_cache, client_cache = await TaskService._batch_prefetch(items)
        content_cache = {}
        for item in items:
            await TaskService._populate_user_details(item, emp_cache, proj_cache, client_cache, content_cache)
            
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
    async def start_task_for_punch_in(employee_id: str, task_id: Optional[str]) -> None:
        """Task picked in the punch-in widget becomes the employee's only in-progress task."""
        if not task_id or not employee_id:
            return
        task = await TaskRepository.get_by_id(task_id)
        # Research items and custom entries are not tasks; finished tasks stay finished
        if not task or task.get("is_deleted") or str(task.get("assigned_to")) != str(employee_id):
            return
        if task.get("status") in ("inprogress", "completed"):
            return
        from app.schemas.task import TaskUpdate
        await TaskService.update_task(task_id, TaskUpdate(status="inprogress"), updater_id=str(employee_id))

    @staticmethod
    async def _enforce_single_inprogress_task(employee_id: str, current_task_id: str, updater_id: Optional[str] = None):
        if not employee_id:
            return
        collection = await TaskRepository.get_collection()
        now = datetime.utcnow()
        emp_id_str = str(employee_id).strip()
        
        cursor = collection.find({
            "is_deleted": False,
            "assigned_to": emp_id_str,
            "status": "inprogress"
        })
        async for other_task in cursor:
            other_id = str(other_task.get("_id") or other_task.get("id"))
            if other_id != str(current_task_id):
                act_hist = list(other_task.get("activity_history") or [])
                act_hist.append({
                    "action": "status_changed",
                    "performed_by": updater_id or "System",
                    "timestamp": now,
                    "details": "Status automatically changed from 'inprogress' to 'todo' because another task was set to in-progress"
                })
                await collection.update_one(
                    {"_id": other_task["_id"]},
                    {"$set": {"status": "todo", "activity_history": act_hist, "updated_at": now}}
                )

    @staticmethod
    async def update_task(item_id: str, update_data: TaskUpdate, updater_id: Optional[str] = None):
        existing = await TaskRepository.get_by_id(item_id)
        update_dict = update_data.model_dump(exclude_unset=True)
        now = datetime.utcnow()
        
        activity = list(existing.get("activity_history", [])) if existing else []
        changes_made = []
        status_changed = False
        
        if existing:
            for key, new_val in update_dict.items():
                old_val = existing.get(key)
                # Convert dates to string for comparison if needed
                if hasattr(old_val, 'isoformat') and not hasattr(new_val, 'isoformat'):
                    pass # rough comparison, skip complex types
                    
                if old_val != new_val:
                    if key == "status":
                        old_s = old_val
                        # TaskStatus is a str Enum: str() gives "TaskStatus.IN_PROGRESS", so use .value
                        new_s = str(getattr(new_val, "value", new_val)).lower()
                        status_changed = True
                        activity.append({
                            "action": "status_changed",
                            "performed_by": updater_id,
                            "timestamp": now,
                            "details": f"Status updated from '{old_s}' to '{new_s}'"
                        })
                        # Enforce strict single inprogress task rule per assigned employee
                        if new_s == "inprogress":
                            target_emp = update_dict.get("assigned_to") or existing.get("assigned_to")
                            if target_emp:
                                await TaskService._enforce_single_inprogress_task(target_emp, item_id, updater_id)
                    else:
                        changes_made.append(f"{key.replace('_', ' ').title()}")
                        
            if changes_made:
                activity.append({
                    "action": "updated",
                    "performed_by": updater_id,
                    "timestamp": now,
                    "details": f"Updated fields: {', '.join(changes_made)}"
                })
                
            if status_changed or changes_made:
                update_dict["activity_history"] = activity

        res = await TaskRepository.update(item_id, update_dict)
        await clear_pattern("tasks:*")
        return res

    @staticmethod
    async def delete_task(item_id: str):
        existing = await TaskRepository.get_by_id(item_id)
        if existing and existing.get("content_item_id"):
            raise HTTPException(status_code=400, detail="Auto-assigned tasks linked to Content Calendar cannot be deleted.")
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
    async def get_task_stats(
        involved_emp_id: Optional[str] = None, 
        target_date: Optional[str] = None,
        assigned_to: Optional[str] = None,
        assigned_by: Optional[str] = None,
        team_employee_ids: Optional[list[str]] = None,
        task_category: Optional[str] = None,
        sub_category: Optional[str] = None,
        project_id: Optional[str] = None,
        priority: Optional[str] = None,
        search: Optional[str] = None,
        timeline_filter: Optional[str] = None,
        status: Optional[str] = None
    ):
        cache_key = f"tasks:stats:{involved_emp_id or 'all'}:{target_date or 'today'}:{assigned_to or 'all'}:{assigned_by or 'all'}:{task_category or 'all'}:{sub_category or 'all'}:{project_id or 'all'}:{priority or 'all'}:{search or ''}:{timeline_filter or 'all'}:{status or 'all'}"
        cached = await get_cache(cache_key)
        if cached is not None:
            return cached

        # Heavy recurring generation only on cache miss (was running on every call)
        await TaskService.process_recurring_tasks()

        stats = await TaskRepository.get_stats(
            involved_emp_id=involved_emp_id, 
            target_date=target_date,
            assigned_to=assigned_to,
            assigned_by=assigned_by,
            team_employee_ids=team_employee_ids,
            task_category=task_category,
            sub_category=sub_category,
            project_id=project_id,
            priority=priority,
            search=search,
            timeline_filter=timeline_filter,
            status=status
        )
        await set_cache(cache_key, stats, ttl=60)
        return stats

    @staticmethod
    async def get_project_task_summary(project_id: str):
        from app.repository.project import ProjectRepository
        
        project = await ProjectRepository.get_by_id(project_id)
        if not project:
            return None
            
        gen = project.get("general", {})
        start_date = gen.get("start_date")
        end_date = gen.get("end_date")
        
        collection = await TaskRepository.get_collection()
        base_query = {"is_deleted": False, "project_id": project_id}
        
        total_tasks = await collection.count_documents(base_query)
        completed = await collection.count_documents({**base_query, "status": "completed"})
        
        pipeline = [
            {"$match": base_query},
            {"$group": {"_id": "$status", "count": {"$sum": 1}}}
        ]
        
        cursor = collection.aggregate(pipeline)
        status_counts = {
            "todo": 0,
            "inprogress": 0,
            "inreview": 0,
            "bugs": 0,
            "completed": 0
        }
        
        async for doc in cursor:
            status_val = doc["_id"]
            if status_val in status_counts:
                status_counts[status_val] = doc["count"]
            else:
                status_counts[status_val] = doc["count"]
                
        progress = 0
        if total_tasks > 0:
            progress = int((completed / total_tasks) * 100)
            
        return {
            "progress": progress,
            "total_tasks": total_tasks,
            "status_counts": status_counts,
            "timeline": {
                "start_date": start_date,
                "end_date": end_date
            }
        }

    @staticmethod
    async def get_project_activity_logs(project_id: str, page: int = 1, limit: int = 20):
        result = await TaskRepository.get_project_activity_logs(project_id, page, limit)
        
        emp_cache = {}
        # We need a dummy structure to reuse _populate_user_details logic easily, 
        # or we can just fetch names directly.
        async def get_details(emp_id):
            if not emp_id:
                return "Management"
            emp_id_str = str(emp_id).strip()
            if emp_id_str not in emp_cache:
                if emp_id_str.lower() in ["system", "default-admin-id", "unknown", "none"]:
                    emp_cache[emp_id_str] = "Management"
                else:
                    emp = await EmployeeRepository.get_employee_by_id(emp_id_str)
                    if emp:
                        personal = emp.get("personal_info", {})
                        first = (personal.get("first_name") or "").strip()
                        last = (personal.get("last_name") or "").strip()
                        name = f"{first} {last}".strip()
                        emp_cache[emp_id_str] = name or emp.get("name") or "Employee"
                    else:
                        emp_cache[emp_id_str] = "Management"
            return emp_cache[emp_id_str]

        for log in result.get("data", []):
            if not log.get("performed_by_name"):
                log["performed_by_name"] = await get_details(log.get("performed_by"))
                
        return result
