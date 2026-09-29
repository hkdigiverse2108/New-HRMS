from typing import List, Optional
from app.repository.preset import PresetRepository
from app.schemas.preset import PresetCreate, PresetUpdate
from app.services.task import TaskService
from app.repository.task import TaskRepository
from app.schemas.task import TaskCreate

class PresetService:

    @staticmethod
    async def create_preset(data: PresetCreate, emp_id: str) -> dict:
        preset_dict = data.model_dump()
        preset_dict["created_by"] = emp_id
        
        created = await PresetRepository.create(preset_dict)
        
        # If it's an intern preset, generate tasks for assigned interns
        if created.get("preset_type") == "intern" and created.get("assigned_interns"):
            await PresetService._sync_intern_tasks(created, emp_id)
            
        return created

    @staticmethod
    async def get_preset_by_id(item_id: str) -> Optional[dict]:
        return await PresetRepository.get_by_id(item_id)

    @staticmethod
    async def get_all_presets(preset_type: Optional[str] = None) -> List[dict]:
        return await PresetRepository.get_all(preset_type)

    @staticmethod
    async def update_preset(item_id: str, data: PresetUpdate, emp_id: str) -> bool:
        existing = await PresetRepository.get_by_id(item_id)
        if not existing:
            return False
            
        update_data = data.model_dump(exclude_unset=True)
        
        # Merge task_groups with existing or generate new preset_task_ids if needed
        if "task_groups" in update_data:
            import uuid
            for group in update_data["task_groups"]:
                for task in group.get("tasks", []):
                    if not task.get("preset_task_id"):
                        task["preset_task_id"] = str(uuid.uuid4())
                        
        success = await PresetRepository.update(item_id, update_data)
        if not success:
            return False
            
        # Re-fetch updated preset to sync tasks
        updated_preset = await PresetRepository.get_by_id(item_id)
        if updated_preset and updated_preset.get("preset_type") == "intern":
            await PresetService._sync_intern_tasks(updated_preset, emp_id)
            
        return True

    @staticmethod
    async def delete_preset(item_id: str) -> bool:
        # We don't delete the generated tasks if the preset is deleted
        return await PresetRepository.soft_delete(item_id)
        
    @staticmethod
    async def apply_preset_to_project(preset_id: str, project_id: str, emp_id: str) -> bool:
        preset = await PresetRepository.get_by_id(preset_id)
        if not preset or preset.get("preset_type") != "normal":
            return False
            
        tasks_to_create = []
        for group in preset.get("task_groups", []):
            for task in group.get("tasks", []):
                new_task = TaskCreate(
                    title=task.get("title"),
                    description=task.get("description"),
                    priority=task.get("priority", "medium"),
                    project_id=project_id,
                    preset_id=preset_id,
                    preset_task_id=task.get("preset_task_id")
                )
                tasks_to_create.append(new_task)
                
        for tk in tasks_to_create:
            await TaskService.create_task(tk, emp_id)
            
        return True

    @staticmethod
    async def _sync_intern_tasks(preset: dict, emp_id: str):
        preset_id = str(preset["_id"])
        assigned_interns = preset.get("assigned_interns", [])
        
        # We need sequential ordering for deadlines
        ordered_template_tasks = []
        template_tasks = {}
        for group in preset.get("task_groups", []):
            for task in group.get("tasks", []):
                pt_id = task.get("preset_task_id")
                if pt_id:
                    template_tasks[pt_id] = task
                    ordered_template_tasks.append(task)

        db = await TaskRepository.get_collection()
        cursor = db.find({"preset_id": preset_id, "is_deleted": False})
        existing_tasks = []
        async for doc in cursor:
            existing_tasks.append(doc)
            
        for existing in existing_tasks:
            task_assigned_to = existing.get("assigned_to")
            pt_id = existing.get("preset_task_id")
            
            if task_assigned_to not in assigned_interns or pt_id not in template_tasks:
                await TaskRepository.soft_delete(str(existing["_id"]))
                
        from app.repository.employee import EmployeeRepository
        from datetime import date, timedelta, datetime
        
        today = date.today()
        
        for intern_id in assigned_interns:
            # Fetch working hours for intern
            intern_data = await EmployeeRepository.get_employee_by_id(intern_id)
            working_hours = 8.5 # fallback
            if intern_data and "work_details" in intern_data:
                wd = intern_data["work_details"]
                st = wd.get("start_time")
                et = wd.get("end_time")
                if st and et:
                    # Convert to hours
                    try:
                        st_dt = datetime.strptime(st, "%H:%M:%S") if isinstance(st, str) else datetime.combine(today, st)
                        et_dt = datetime.strptime(et, "%H:%M:%S") if isinstance(et, str) else datetime.combine(today, et)
                        working_hours = (et_dt - st_dt).total_seconds() / 3600.0
                    except:
                        pass
                        
            if working_hours <= 0:
                working_hours = 8.5
                
            current_date = today
            hours_left_today = working_hours
            
            for template_task in ordered_template_tasks:
                pt_id = template_task.get("preset_task_id")
                task_hours = template_task.get("estimated_hours") or 0.0
                
                # Calculate sequential deadline
                remaining_task_hours = task_hours
                while remaining_task_hours > hours_left_today and hours_left_today > 0:
                    remaining_task_hours -= hours_left_today
                    current_date += timedelta(days=1)
                    # Skip weekends
                    while current_date.weekday() >= 5:
                        current_date += timedelta(days=1)
                    hours_left_today = working_hours
                    
                if remaining_task_hours > 0:
                    hours_left_today -= remaining_task_hours
                    
                calculated_due_date = current_date
                
                existing = next((t for t in existing_tasks if t.get("preset_task_id") == pt_id and t.get("assigned_to") == intern_id), None)
                
                if existing:
                    if (existing.get("title") != template_task.get("title") or 
                        existing.get("description") != template_task.get("description") or 
                        existing.get("estimated_hours") != task_hours or
                        (existing.get("due_date") and existing.get("due_date").date() != calculated_due_date if isinstance(existing.get("due_date"), datetime) else existing.get("due_date") != calculated_due_date)):
                        
                        await db.update_one(
                            {"_id": existing["_id"]},
                            {"$set": {
                                "title": template_task.get("title"),
                                "description": template_task.get("description"),
                                "estimated_hours": task_hours,
                                "due_date": datetime.combine(calculated_due_date, datetime.min.time())
                            }}
                        )
                else:
                    new_task = TaskCreate(
                        title=template_task.get("title"),
                        description=template_task.get("description"),
                        priority=template_task.get("priority", "medium"),
                        assigned_to=intern_id,
                        preset_id=preset_id,
                        preset_task_id=pt_id,
                        estimated_hours=task_hours,
                        due_date=calculated_due_date
                    )
                    await TaskService.create_task(new_task, emp_id)
