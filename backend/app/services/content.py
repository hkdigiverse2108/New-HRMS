from typing import Optional
from datetime import timedelta
from app.repository.content import ContentRepository
from app.repository.project import ProjectRepository
from app.repository.employee import EmployeeRepository
from app.schemas.content import ContentItemCreate, ContentItemUpdate, ContentTimelineSettings

class ContentService:
    @staticmethod
    async def _preload_employee_cache(items: list, emp_cache: dict):
        ids_to_fetch = set()
        for item in items:
            ap = item.get("approved_by")
            if ap and str(ap) not in emp_cache:
                ids_to_fetch.add(str(ap))
            bp = item.get("brand_person")
            if bp and len(str(bp)) == 24 and str(bp) not in emp_cache:
                ids_to_fetch.add(str(bp))
                
        if ids_to_fetch:
            from app.repository.employee import EmployeeRepository
            from bson import ObjectId
            valid_obj_ids = [ObjectId(x) for x in ids_to_fetch if ObjectId.is_valid(x)]
            if valid_obj_ids:
                collection = await EmployeeRepository.get_collection()
                async for emp in collection.find({"_id": {"$in": valid_obj_ids}}):
                    e_id = str(emp["_id"])
                    personal = emp.get("personal_info", {})
                    name = f"{personal.get('first_name', '')} {personal.get('last_name', '')}".strip() or "Employee"
                    emp_cache[e_id] = {"employee_name": name}
            for x in ids_to_fetch:
                if x not in emp_cache:
                    emp_cache[x] = {"employee_name": x}

    @staticmethod
    async def _populate_details(item: dict, emp_cache: dict):
        async def get_details(emp_id):
            if not emp_id:
                return None
            emp_id_str = str(emp_id)
            if emp_id_str not in emp_cache:
                emp = await EmployeeRepository.get_employee_by_id(emp_id_str)
                if emp:
                    personal = emp.get("personal_info", {})
                    name = f"{personal.get('first_name', '')} {personal.get('last_name', '')}".strip() or "Employee"
                    emp_cache[emp_id_str] = {"employee_name": name}
                else:
                    emp_cache[emp_id_str] = {"employee_name": emp_id_str}
            return emp_cache[emp_id_str]

        item["approved_by_details"] = await get_details(item.get("approved_by"))
        # brand_person could be an employee ID or just a text name. If it matches an employee, populate.
        # But commonly in this UI it's a selected user. Let's try to populate if it's an ObjectId string.
        brand_person = item.get("brand_person")
        if brand_person and len(brand_person) == 24:
            item["brand_person_details"] = await get_details(brand_person)
        else:
            item["brand_person_details"] = None

    @staticmethod
    async def get_settings(project_id: str):
        settings = await ContentRepository.get_settings(project_id)
        if not settings:
            if project_id != "global":
                global_settings = await ContentRepository.get_settings("global")
                if global_settings:
                    settings = dict(global_settings)
                    settings["project_id"] = project_id
                    settings["_id"] = "default"
                    return settings
            # Return default template
            default_settings = ContentTimelineSettings(project_id=project_id)
            settings = default_settings.model_dump()
            settings["_id"] = "default"
        return settings

    @staticmethod
    async def update_settings(project_id: str, settings_data: ContentTimelineSettings):
        data_dict = settings_data.model_dump(exclude_unset=True)
        return await ContentRepository.update_settings(project_id, data_dict)

    @staticmethod
    async def _sync_tasks_for_content(item_id: str, item_data: dict, project: dict, current_user_id: Optional[str] = None):
        team = project.get("creative_team")
        if not team:
            return
            
        topic_title_val = str(item_data.get("topic_title") or "").strip()
        topic_desc_val = str(item_data.get("topic_description") or item_data.get("concept") or "").strip()

        if topic_title_val and topic_title_val.lower() not in ["untitled", "untitled idea", "none"]:
            topic = topic_title_val
        elif topic_desc_val and topic_desc_val.lower() not in ["untitled", "untitled idea", "none"]:
            topic = topic_desc_val
        elif topic_title_val:
            topic = topic_title_val
        elif topic_desc_val:
            topic = topic_desc_val
        else:
            topic = "Untitled Idea"
        content_type = item_data.get("content_type", "Content")
        is_post_type = content_type in ["Post", "Carousel", "Story"]
        
        def _is_not_required(val) -> bool:
            if not val:
                return False
            if isinstance(val, dict):
                lnk = str(val.get("link") or "").strip().lower()
                st = str(val.get("status") or "").strip().lower()
                for s in [lnk, st]:
                    if not s:
                        continue
                    if s in [
                        "not required", "not req", "not_required", "not-required",
                        "no need", "no needed", "no script", "no req", "none required",
                        "client provide", "clinet provide"
                    ] or "not required" in s or "no need" in s or "no script" in s or "client provide" in s or "clinet provide" in s:
                        return True
                return False
            s = str(val).strip().lower()
            return (
                s in [
                    "not required", "not req", "not_required", "not-required",
                    "no need", "no needed", "no script", "no req", "none required",
                    "client provide", "clinet provide"
                ]
                or "not required" in s
                or "no need" in s
                or "no script" in s
                or "client provide" in s
                or "clinet provide" in s
            )

        def _check_has_content(val):
            """
            Audio Transcript:
            'એક પણ કેરેક્ટર એની અંદર લખ્યો હોય ને, તો ઈ કમ્પલીટેડ ગણાય જાય.
             ઈ એમ્પ્ટી હોય ને તો જ બાકી હોય... એની અંદર હાવ ખાલી, કોરે કોરું કાંઈ છે જ નહીં,
             નલ (Null) છે અથવા તો ખાલી છે અથવા તો એમ્પ્ટી છે, તો તે ઈ ટાસ્ક બાકી ગણાય.
             અને જેવો ઈ ટાસ્કની અંદર લિંક નંખાઈ જાય એટલે ઈ ટાસ્ક પૂરો થઈ ગયો ગણાય.
             એની અંદર લિંક નાખે, એક ડેશ મારી દે, એક નાનો અમથો વર્ડ લખી નાખે, Not Required લખ્યું છે, તો ઈ બધું પૂરું થઈ ગયું ગણાય.'
            """
            if val is None:
                return False
            if isinstance(val, dict):
                lnk = str(val.get("link") or "").strip()
                return len(lnk) > 0
            s = str(val).strip()
            return len(s) > 0

        def _is_role_not_required(role: str) -> bool:
            if is_post_type and role == "reel_editing":
                return True
            if content_type == "Reel" and role == "post_graphics":
                return True
            if role == "scripting":
                return _is_not_required(item_data.get("script"))
            if role == "shoot_videography":
                return _is_not_required(item_data.get("shoot"))
            if role == "thumbnail":
                return _is_not_required(item_data.get("thumbnail"))
            if role in ["reel_editing", "post_graphics"]:
                return _is_not_required(item_data.get("editing"))
            if role == "caption":
                return _is_not_required(item_data.get("caption_text")) or _is_not_required(item_data.get("caption"))
            if role == "approval_qc":
                return _is_not_required(item_data.get("approval_status"))
            if role == "posting_publisher":
                return _is_not_required(item_data.get("instagram_link"))
            return False

        roles_mapping = {
            "scripting": {"date_field": ["script", "date"], "is_completed": lambda d: _check_has_content(d.get("script")), "title": f"Scripting - {topic} ({content_type})"},
            "reel_editing": {"date_field": ["editing", "date"], "is_completed": lambda d: _check_has_content(d.get("editing")), "title": f"Editing - {topic} ({content_type})"},
            "post_graphics": {"date_field": ["editing", "date"], "is_completed": lambda d: _check_has_content(d.get("editing")), "title": f"Graphics - {topic} ({content_type})"},
            "shoot_videography": {"date_field": ["shoot", "date"], "is_completed": lambda d: _check_has_content(d.get("shoot")), "title": f"Shoot - {topic} ({content_type})"},
            "thumbnail": {"date_field": ["thumbnail", "date"], "is_completed": lambda d: _check_has_content(d.get("thumbnail")), "title": f"Thumbnail - {topic} ({content_type})"},
            "approval_qc": {"date_field": ["caption_date"], "is_completed": lambda d: str(d.get("approval_status") or "").strip().lower() == "approved", "title": f"Approval/QC - {topic} ({content_type})"},
            "posting_publisher": {"date_field": ["schedule_date"], "is_completed": lambda d: _check_has_content(d.get("instagram_link")) or _check_has_content(d.get("actual_posting_date")), "title": f"Posting - {topic} ({content_type})"},
            "caption": {"date_field": ["caption_date"], "is_completed": lambda d: _check_has_content(d.get("caption_text")) or _check_has_content(d.get("caption")), "title": f"Caption - {topic} ({content_type})"}
        }

        role_to_subcat = {
            "scripting": "Script",
            "shoot_videography": "Shoot",
            "reel_editing": "Editing",
            "post_graphics": "Post/Graphics",
            "thumbnail": "Thumbnail",
            "caption": "Caption",
            "approval_qc": "Approval",
            "posting_publisher": "Posting",
        }
        
        from app.services.task import TaskService
        from app.schemas.task import TaskCreate, TaskStatus
        from app.repository.task import TaskRepository
        
        for role, mapping in roles_mapping.items():
            # If stage is Not Required, DELETE any existing task and DO NOT create any new task!
            if _is_role_not_required(role):
                existing_tasks = await TaskRepository.get_all(content_item_id=item_id, creative_role=role)
                if existing_tasks and existing_tasks.get("data"):
                    for t in existing_tasks["data"]:
                        await TaskRepository.soft_delete(str(t["_id"]))
                continue

            emp_id = team.get(role)
            # If a role is not assigned in creative_team (e.g. Approval on ErthGlow), DO NOT create or retain ghost task!
            if not emp_id:
                existing_tasks = await TaskRepository.get_all(content_item_id=item_id, creative_role=role)
                if existing_tasks and existing_tasks.get("data"):
                    for t in existing_tasks["data"]:
                        await TaskRepository.soft_delete(str(t["_id"]))
                continue
                
            date_val = item_data
            for key in mapping["date_field"]:
                if isinstance(date_val, dict):
                    date_val = date_val.get(key)
                else:
                    date_val = None
                    break
            date_str = None
            if isinstance(date_val, str):
                date_str = date_val.split("T")[0]
            elif hasattr(date_val, "isoformat"):
                date_str = date_val.isoformat().split("T")[0]
            
            is_completed = mapping["is_completed"](item_data)
            
            # Check if task already exists for this content and role
            from app.repository.task import TaskRepository
            existing_tasks = await TaskRepository.get_all(content_item_id=item_id, creative_role=role)
            
            # Use the current user who triggered the action, or fallback to 'system'
            assigned_by = current_user_id if current_user_id else "system"
            
            if existing_tasks and existing_tasks.get("data"):
                task = existing_tasks["data"][0]
                task_id = str(task["_id"])
                update_payload = {}
                
                new_title = mapping.get("title")
                if new_title and task.get("title") != new_title:
                    update_payload["title"] = new_title
                if date_str and task.get("due_date") != date_str:
                    update_payload["due_date"] = date_str
                if not task.get("sub_category"):
                    update_payload["sub_category"] = role_to_subcat.get(role, "General")
                    
                if is_completed and task.get("status") != TaskStatus.COMPLETED:
                    update_payload["status"] = TaskStatus.COMPLETED
                elif not is_completed and task.get("status") == TaskStatus.COMPLETED:
                    update_payload["status"] = TaskStatus.TODO
                    
                if update_payload:
                    await TaskRepository.update(task_id, update_payload)
            else:
                # Create new task
                from datetime import datetime, date as py_date
                if isinstance(date_val, (py_date, datetime)):
                    due_date_obj = date_val if isinstance(date_val, py_date) and not isinstance(date_val, datetime) else date_val.date()
                elif date_str:
                    due_date_obj = datetime.strptime(date_str, "%Y-%m-%d").date()
                else:
                    due_date_obj = None
                    
                task_create = TaskCreate(
                    title=mapping["title"],
                    assigned_to=emp_id,
                    due_date=due_date_obj,
                    task_category="SMM",
                    sub_category=role_to_subcat.get(role, "General"),
                    content_item_id=str(item_id),
                    project_id=str(project.get("_id")),
                    creative_role=role,
                    status=TaskStatus.COMPLETED if is_completed else TaskStatus.TODO
                )
                await TaskService.create_task(task_create, assigned_by)

    @staticmethod
    async def create_content(project_id: str, data: ContentItemCreate, current_user_id: Optional[str] = None):
        project = await ProjectRepository.get_by_id(project_id)
        if not project:
            return None
            
        import json
        insert_data = json.loads(data.model_dump_json(exclude_unset=True))
        insert_data["project_id"] = project_id
        
        # Auto-population
        settings_dict = await ContentService.get_settings(project_id)
        settings = ContentTimelineSettings(**settings_dict)
        
        schedule_date = data.schedule_date
        
        # Safely auto-populate dates only if they are not provided by the user
        for stage, offset in [
            ("script", settings.script_days_before),
            ("shoot", settings.shoot_days_before),
            ("editing", settings.editing_graphics_days_before),
            ("thumbnail", settings.thumbnail_days_before)
        ]:
            if stage not in insert_data:
                insert_data[stage] = {}
            if insert_data[stage].get("date") is None:
                insert_data[stage]["date"] = (schedule_date - timedelta(days=offset)).isoformat()
                
        if insert_data.get("caption_date") is None:
            insert_data["caption_date"] = (schedule_date - timedelta(days=settings.approval_days_before)).isoformat()

        # For static Post deliverables, default Script, Shoot, Thumbnail to "Not Required"
        if insert_data.get("content_type") in ["Post", "Carousel", "Story"]:
            for stg in ["script", "shoot", "thumbnail"]:
                if stg not in insert_data:
                    insert_data[stg] = {}
                if not insert_data[stg].get("link"):
                    insert_data[stg]["link"] = "Not Required"


        created_item = await ContentRepository.create(insert_data)
        if created_item:
            item_id = str(created_item["_id"])
            await ContentService._sync_tasks_for_content(item_id, insert_data, project, current_user_id)
            
            # Log Creation
            if current_user_id:
                from app.services.activity import ActivityService, ActivityAction
                topic = insert_data.get("topic_title", "Untitled")
                await ActivityService.log_activity(
                    project_id=project_id,
                    action=ActivityAction.CREATED_CONTENT,
                    description=f"Created content idea '{topic}'",
                    performed_by=current_user_id
                )
                
            await ProjectRepository.update(project_id, {"has_content_calendar": True})
                
        return created_item

    @staticmethod
    async def get_all_content(
        project_id: str,
        content_type: Optional[list] = None, 
        status: Optional[list] = None, 
        month: Optional[int] = None,
        year: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        page: Optional[int] = None, 
        limit: Optional[int] = None
    ):
        result = await ContentRepository.get_all(project_id, content_type, status, month, year, start_date, end_date, page, limit)
        
        emp_cache = {}
        items = result.get("data", [])
        await ContentService._preload_employee_cache(items, emp_cache)
        for item in items:
            await ContentService._populate_details(item, emp_cache)
            
        # Calculate start_date and end_date directly from content collection
        pipeline = [
            {"$match": {"project_id": project_id, "is_deleted": False}},
            {"$group": {
                "_id": None,
                "first_date": {"$min": "$schedule_date"},
                "last_date": {"$max": "$schedule_date"}
            }}
        ]
        
        cursor = ContentRepository._collection.aggregate(pipeline) if hasattr(ContentRepository, '_collection') and ContentRepository._collection is not None else None
        
        if cursor is None:
            collection = await ContentRepository.get_collection()
            cursor = collection.aggregate(pipeline)
            
        dates = []
        async for doc in cursor:
            dates.append(doc)
            
        if dates:
            result["start_date"] = dates[0].get("first_date")
            result["end_date"] = dates[0].get("last_date")
        else:
            result["start_date"] = None
            result["end_date"] = None
            
        return result

    @staticmethod
    async def get_content_by_id(item_id: str):
        item = await ContentRepository.get_by_id(item_id)
        if item:
            emp_cache = {}
            await ContentService._populate_details(item, emp_cache)
        return item

    @staticmethod
    async def update_content(item_id: str, update_data: ContentItemUpdate, current_user_id: Optional[str] = None):
        import json
        data_dict = json.loads(update_data.model_dump_json(exclude_unset=True))
        
        # If approval_status changes to Approved, set approved_by
        if "approval_status" in data_dict:
            if data_dict["approval_status"] == "Approved":
                if "approved_by" not in data_dict and current_user_id:
                    data_dict["approved_by"] = current_user_id
            else:
                if "approved_by" not in data_dict:
                    data_dict["approved_by"] = None
                    
        # Compare existing_item with data_dict for Activity Logging
        existing_item = await ContentRepository.get_by_id(item_id)
        if current_user_id and existing_item:
            from app.services.activity import ActivityService, ActivityAction
            topic = existing_item.get("topic_title", "Untitled")
            
            changes = []
            
            # Compare top-level fields
            if "schedule_date" in data_dict and data_dict["schedule_date"] != existing_item.get("schedule_date"):
                changes.append(f"schedule date to {data_dict['schedule_date']}")
            if "approval_status" in data_dict and data_dict["approval_status"] != existing_item.get("approval_status"):
                changes.append(f"status to '{data_dict['approval_status']}'")
            if "caption_text" in data_dict and data_dict["caption_text"] != existing_item.get("caption_text"):
                changes.append("caption text")
            if "instagram_link" in data_dict and data_dict["instagram_link"] != existing_item.get("instagram_link"):
                changes.append("Instagram link")
                
            # Compare nested stage fields (script, shoot, editing, thumbnail)
            for stage in ["script", "shoot", "editing", "thumbnail"]:
                if stage in data_dict:
                    old_stage = existing_item.get(stage, {})
                    new_stage = data_dict[stage]
                    if new_stage.get("link") and new_stage.get("link") != old_stage.get("link"):
                        changes.append(f"{stage} link")
                    if new_stage.get("date") and new_stage.get("date") != old_stage.get("date"):
                        changes.append(f"{stage} date")

            # Check if issues changed
            if "issues" in data_dict:
                def _normalize_issue(iss):
                    if isinstance(iss, dict):
                        return iss.get("text") or iss.get("id") or str(iss)
                    return str(iss)
                old_issues = {_normalize_issue(i) for i in (existing_item.get("issues") or [])}
                new_issues = {_normalize_issue(i) for i in (data_dict.get("issues") or [])}
                added_issues = new_issues - old_issues
                for issue in added_issues:
                    desc = f"Added issue '{issue}' on content idea '{topic}'"
                    await ActivityService.log_activity(
                        project_id=existing_item["project_id"],
                        action=ActivityAction.LOGGED_ISSUE,
                        description=desc,
                        performed_by=current_user_id
                    )
                    
            if changes:
                desc = f"Updated {', '.join(changes)} for content idea '{topic}'"
                await ActivityService.log_activity(
                    project_id=existing_item["project_id"],
                    action=ActivityAction.UPDATED_CONTENT,
                    description=desc,
                    performed_by=current_user_id
                )
                    
        updated_item = await ContentRepository.update(item_id, data_dict)
        if updated_item:
            from app.services.project import ProjectService
            project = await ProjectService.get_project_by_id(updated_item.get("project_id"))
            if project:
                await ContentService._sync_tasks_for_content(item_id, updated_item, project, current_user_id)
        return updated_item

    @staticmethod
    async def delete_content(item_id: str, current_user_id: Optional[str] = None):
        existing = await ContentRepository.get_by_id(item_id)
        deleted = await ContentRepository.soft_delete(item_id)
        
        if deleted:
            from app.database.db import get_database
            from datetime import datetime
            from app.redis.service import clear_pattern
            db = get_database()
            await db["tasks"].update_many(
                {"content_item_id": item_id},
                {"$set": {"is_deleted": True, "updated_at": datetime.utcnow()}}
            )
            await clear_pattern("tasks:*")

        if deleted and existing and current_user_id:
            from app.services.activity import ActivityService, ActivityAction
            topic = existing.get("topic_title", "Untitled")
            await ActivityService.log_activity(
                project_id=existing["project_id"],
                action=ActivityAction.DELETED_CONTENT,
                description=f"Deleted content idea '{topic}'",
                performed_by=current_user_id
            )
            
            project_id = existing["project_id"]
            count = await ContentRepository.count_by_project_id(project_id)
            if count == 0:
                from app.repository.project import ProjectRepository
                await ProjectRepository.update(project_id, {"has_content_calendar": False})
                
        return deleted
