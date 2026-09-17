from typing import Optional
from datetime import timedelta
from app.repository.content import ContentRepository
from app.repository.project import ProjectRepository
from app.repository.employee import EmployeeRepository
from app.schemas.content import ContentItemCreate, ContentItemUpdate, ContentTimelineSettings

class ContentService:
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
            # Return default
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
            
        topic = item_data.get("topic_title", "Untitled")
        content_type = item_data.get("content_type", "Content")
        
        roles_mapping = {
            "scripting": {"date_field": ["script", "date"], "is_completed": lambda d: bool(d.get("script", {}).get("link")), "title": f"Scripting - {topic} ({content_type})"},
            "reel_editing": {"date_field": ["editing", "date"], "is_completed": lambda d: bool(d.get("editing", {}).get("link")), "title": f"Editing - {topic} ({content_type})"},
            "post_graphics": {"date_field": ["editing", "date"], "is_completed": lambda d: bool(d.get("editing", {}).get("link")), "title": f"Graphics - {topic} ({content_type})"},
            "shoot_videography": {"date_field": ["shoot", "date"], "is_completed": lambda d: bool(d.get("shoot", {}).get("link")), "title": f"Shoot - {topic} ({content_type})"},
            "thumbnail": {"date_field": ["thumbnail", "date"], "is_completed": lambda d: bool(d.get("thumbnail", {}).get("link")), "title": f"Thumbnail - {topic} ({content_type})"},
            "approval_qc": {"date_field": ["caption_date"], "is_completed": lambda d: d.get("approval_status") == "Approved", "title": f"Approval/QC - {topic} ({content_type})"},
            "posting_publisher": {"date_field": ["schedule_date"], "is_completed": lambda d: bool(d.get("instagram_link")), "title": f"Posting - {topic} ({content_type})"},
            "caption": {"date_field": ["caption_date"], "is_completed": lambda d: bool(d.get("caption_text")), "title": f"Caption - {topic} ({content_type})"}
        }
        
        from app.services.task import TaskService
        from app.schemas.task import TaskCreate, TaskStatus
        
        for role, mapping in roles_mapping.items():
            emp_id = team.get(role)
            if not emp_id:
                continue
                
            date_val = item_data
            for key in mapping["date_field"]:
                if isinstance(date_val, dict):
                    date_val = date_val.get(key)
                else:
                    date_val = None
                    break
            date_str = date_val if isinstance(date_val, str) else None
            
            is_completed = mapping["is_completed"](item_data)
            
            # Check if task already exists for this content and role
            from app.repository.task import TaskRepository
            existing_tasks = await TaskRepository.get_all(content_item_id=item_id, creative_role=role)
            
            # Use the current user who triggered the action, or fallback to 'system'
            assigned_by = current_user_id if current_user_id else "system"
            
            if existing_tasks and existing_tasks.get("data"):
                # Update existing task if not completed
                task = existing_tasks["data"][0]
                task_id = str(task["_id"])
                
                # Only update if date changed
                if date_str and task.get("due_date") != date_str:
                    await TaskRepository.update(task_id, {"due_date": date_str})
                    
                # If a link is added, mark completed
                if is_completed and task.get("status") != TaskStatus.COMPLETED:
                    await TaskRepository.update(task_id, {"status": TaskStatus.COMPLETED})
            else:
                # Create new task
                if date_str:
                    from datetime import datetime
                    due_date_obj = datetime.strptime(date_str, "%Y-%m-%d").date()
                else:
                    due_date_obj = None
                    
                task_create = TaskCreate(
                    title=mapping["title"],
                    assigned_to=emp_id,
                    due_date=due_date_obj,
                    task_category="SMM",
                    content_item_id=str(item_id),
                    project_id=str(project.get("_id")),
                    creative_role=role
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
            ("thumbnail", settings.editing_graphics_days_before)
        ]:
            if stage not in insert_data:
                insert_data[stage] = {}
            if insert_data[stage].get("date") is None:
                insert_data[stage]["date"] = (schedule_date - timedelta(days=offset)).isoformat()
                
        if insert_data.get("caption_date") is None:
            insert_data["caption_date"] = (schedule_date - timedelta(days=settings.approval_days_before)).isoformat()


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
        for item in result.get("data", []):
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
                old_issues = set(existing_item.get("issues", []))
                new_issues = set(data_dict["issues"])
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
        
        if deleted and existing and current_user_id:
            from app.services.activity import ActivityService, ActivityAction
            topic = existing.get("topic_title", "Untitled")
            await ActivityService.log_activity(
                project_id=existing["project_id"],
                action=ActivityAction.DELETED_CONTENT,
                description=f"Deleted content idea '{topic}'",
                performed_by=current_user_id
            )
            
        return deleted
