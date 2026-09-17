from typing import Optional
from app.repository.project import ProjectRepository
from app.repository.client import ClientRepository
from app.schemas.project import ProjectCreate, ProjectUpdate

class ProjectService:
    @staticmethod
    async def _populate_client(item: dict, client_cache: dict):
        client_id = item.get("client_id")
        if not client_id:
            return
            
        client_id_str = str(client_id)
        if client_id_str not in client_cache:
            from app.repository.client import ClientRepository
            client = await ClientRepository.get_by_id(client_id_str)
            if client:
                client_cache[client_id_str] = client
            else:
                client_cache[client_id_str] = {"company_name": client_id_str}
        item["client"] = client_cache[client_id_str]

    @staticmethod
    async def _populate_creative_team(item: dict, emp_cache: dict):
        team = item.get("creative_team")
        if not team:
            item["creative_team_details"] = None
            return
            
        async def get_emp_name(emp_id):
            if not emp_id: return None
            emp_id_str = str(emp_id)
            if emp_id_str not in emp_cache:
                from app.repository.employee import EmployeeRepository
                emp = await EmployeeRepository.get_employee_by_id(emp_id_str)
                if emp:
                    personal = emp.get("personal_info", {})
                    name = f"{personal.get('first_name', '')} {personal.get('last_name', '')}".strip() or "Employee"
                    emp_cache[emp_id_str] = name
                else:
                    emp_cache[emp_id_str] = emp_id_str
            return {"employee_name": emp_cache[emp_id_str]}
            
        details = {}
        for role, emp_id in team.items():
            details[role] = await get_emp_name(emp_id)
            
        item["creative_team_details"] = details

    @staticmethod
    def _calculate_next_followup_date(config: dict, default_start_date) -> Optional['date']:
        if not config: return None
        from datetime import date, timedelta
        import calendar
        
        schedule_type = config.get("followup_schedule_type")
        schedule_value = config.get("followup_schedule_value", [])
        if not schedule_value: return None
        
        last_date = config.get("last_followup_date") or default_start_date
        if isinstance(last_date, str):
            from datetime import datetime
            last_date = datetime.fromisoformat(last_date.replace('Z', '+00:00')).date()
        elif hasattr(last_date, 'date'):
            last_date = last_date.date()
            
        if schedule_type == "Fixed Interval (Days)":
            interval = schedule_value[0]
            return last_date + timedelta(days=interval)
            
        elif schedule_type == "Weekly (Specific Days)":
            # schedule_value contains weekdays (0=Mon, 6=Sun)
            target_days = sorted(schedule_value)
            curr_weekday = last_date.weekday()
            # Find the next day in the list that is > curr_weekday
            days_to_add = None
            for d in target_days:
                if d > curr_weekday:
                    days_to_add = d - curr_weekday
                    break
            if days_to_add is None:
                # Wrap around to the first day next week
                days_to_add = (7 - curr_weekday) + target_days[0]
                
            return last_date + timedelta(days=days_to_add)
            
        elif schedule_type == "Monthly (Specific Dates)":
            # schedule_value contains dates (e.g. 1, 15)
            target_dates = sorted(schedule_value)
            curr_day = last_date.day
            curr_month = last_date.month
            curr_year = last_date.year
            
            # Check if there is a target date later in the current month
            for d in target_dates:
                if d > curr_day:
                    # ensure valid date (e.g. Feb 30 -> Feb 28)
                    max_days = calendar.monthrange(curr_year, curr_month)[1]
                    safe_d = min(d, max_days)
                    return date(curr_year, curr_month, safe_d)
                    
            # Wrap to next month
            next_month = curr_month + 1 if curr_month < 12 else 1
            next_year = curr_year if curr_month < 12 else curr_year + 1
            max_days = calendar.monthrange(next_year, next_month)[1]
            safe_d = min(target_dates[0], max_days)
            return date(next_year, next_month, safe_d)
            
        return None

    @staticmethod
    async def create_project(data: ProjectCreate):
        insert_data = data.model_dump(exclude_unset=True)
        
        # Calculate initial follow-up date if config provided
        if insert_data.get("followup_schedule_type") and insert_data.get("followup_schedule_value"):
            from datetime import date
            start_date = insert_data.get("general", {}).get("start_date") or date.today()
            next_date = ProjectService._calculate_next_followup_date(insert_data, start_date)
            if next_date:
                # convert to datetime for mongo
                from datetime import datetime
                insert_data["next_followup_date"] = datetime.combine(next_date, datetime.min.time())
                
        return await ProjectRepository.create(insert_data)

    @staticmethod
    async def get_all_projects(
        is_deleted: bool = False, 
        client_id: Optional[str] = None, 
        category: Optional[str] = None, 
        priority: Optional[str] = None, 
        status: Optional[str] = None, 
        search: Optional[str] = None, 
        whatsapp_status: Optional[str] = None,
        festival_posts: Optional[bool] = None,
        page: Optional[int] = None, 
        limit: Optional[int] = None
    ):
        result = await ProjectRepository.get_all(is_deleted, client_id, category, priority, status, search, whatsapp_status, festival_posts, page, limit)
        client_cache = {}
        emp_cache = {}
        for item in result.get("data", []):
            await ProjectService._populate_client(item, client_cache)
            await ProjectService._populate_creative_team(item, emp_cache)
        return result

    @staticmethod
    async def get_project_by_id(project_id: str):
        item = await ProjectRepository.get_by_id(project_id)
        if item:
            await ProjectService._populate_client(item, {})
            await ProjectService._populate_creative_team(item, {})
        return item

    @staticmethod
    async def update_project(project_id: str, data: ProjectUpdate, current_user_id: Optional[str] = None):
        update_data = data.model_dump(exclude_unset=True)
        if not update_data:
            return True
            
        # If followup fields are updated, recalculate next_followup_date
        if any(k in update_data for k in ["followup_schedule_type", "followup_schedule_value", "last_followup_date"]):
            from datetime import date, datetime
            existing_project = await ProjectRepository.get_by_id(project_id)
            start_date = date.today()
            if existing_project and existing_project.get("general", {}).get("start_date"):
                start_date = existing_project["general"]["start_date"]
                if isinstance(start_date, datetime):
                    start_date = start_date.date()
                    
            merged_config = {
                "followup_schedule_type": update_data.get("followup_schedule_type", existing_project.get("followup_schedule_type") if existing_project else None),
                "followup_schedule_value": update_data.get("followup_schedule_value", existing_project.get("followup_schedule_value") if existing_project else []),
                "last_followup_date": update_data.get("last_followup_date", existing_project.get("last_followup_date") if existing_project else None)
            }
            
            if merged_config.get("followup_schedule_type") and merged_config.get("followup_schedule_value"):
                next_date = ProjectService._calculate_next_followup_date(merged_config, start_date)
                if next_date:
                    update_data["next_followup_date"] = datetime.combine(next_date, datetime.min.time())
                else:
                    update_data["next_followup_date"] = None
            else:
                update_data["next_followup_date"] = None
            
        old_project = None
        if "creative_team" in update_data:
            old_project = await ProjectRepository.get_by_id(project_id)
            
        updated = await ProjectRepository.update(project_id, update_data)
        
        if updated and old_project and "creative_team" in update_data:
            old_team = old_project.get("creative_team", {})
            new_team = update_data["creative_team"]
            
            from app.repository.task import TaskRepository
            from app.schemas.task import TaskStatus
            
            for role, new_emp_id in new_team.items():
                old_emp_id = old_team.get(role)
                if old_emp_id != new_emp_id and new_emp_id:
                    # Find incomplete SMM tasks for this role, project, and old employee
                    existing_tasks = await TaskRepository.get_all(
                        project_id=project_id, 
                        creative_role=role, 
                        assigned_to=old_emp_id,
                        task_category="SMM"
                    )
                    
                    if existing_tasks and existing_tasks.get("data"):
                        for task in existing_tasks["data"]:
                            if task.get("status") != TaskStatus.COMPLETED:
                                update_fields = {"assigned_to": new_emp_id}
                                if current_user_id:
                                    update_fields["assigned_by"] = current_user_id
                                await TaskRepository.update(str(task["_id"]), update_fields)
                                
        return updated
        
    @staticmethod
    async def update_content_approval(project_id: str, data: dict, current_user_id: str):
        project = await ProjectRepository.get_by_id(project_id)
        if not project:
            return None
            
        from datetime import datetime
        
        # We need to find the specific month/year inside content_approvals and update or append it
        approvals = project.get("content_approvals", [])
        
        # Convert schema payload to dict
        new_approval = data.model_dump() if hasattr(data, "model_dump") else data
        new_approval["updated_at"] = datetime.utcnow()
        new_approval["updated_by"] = current_user_id
        
        found = False
        for i, approval in enumerate(approvals):
            if approval.get("month") == new_approval["month"] and approval.get("year") == new_approval["year"]:
                approvals[i] = new_approval
                found = True
                break
                
        if not found:
            approvals.append(new_approval)
            
        updated = await ProjectRepository.update(project_id, {"content_approvals": approvals})
        if updated:
            return new_approval
        return None

    @staticmethod
    async def delete_project(project_id: str):
        return await ProjectRepository.delete(project_id)

    @staticmethod
    async def remove_campaign(project_id: str, campaign_name: str):
        return await ProjectRepository.remove_campaign(project_id, campaign_name)
