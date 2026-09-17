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
    async def create_content(project_id: str, data: ContentItemCreate):
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


        return await ContentRepository.create(insert_data)

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
                    
        # Check if issues changed
        if "issues" in data_dict and current_user_id:
            existing_item = await ContentRepository.get_by_id(item_id)
            if existing_item:
                old_issues = set(existing_item.get("issues", []))
                new_issues = set(data_dict["issues"])
                added_issues = new_issues - old_issues
                for issue in added_issues:
                    from app.services.activity import ActivityService, ActivityAction
                    topic = existing_item.get("topic_title", "Untitled")
                    desc = f"Added issue '{issue}' on content idea '{topic}'"
                    await ActivityService.log_activity(
                        project_id=existing_item["project_id"],
                        action=ActivityAction.LOGGED_ISSUE,
                        description=desc,
                        performed_by=current_user_id
                    )
                    
        return await ContentRepository.update(item_id, data_dict)

    @staticmethod
    async def delete_content(item_id: str):
        return await ContentRepository.soft_delete(item_id)
