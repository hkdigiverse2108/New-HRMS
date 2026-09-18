from typing import Optional
from app.repository.project import ProjectRepository
from app.repository.client import ClientRepository
from app.schemas.project import ProjectCreate, ProjectUpdate, FollowUpLogCreate, ClientReviewCreate, ClientReviewUpdate

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
    def _calculate_next_schedule_date(config: dict, default_start_date, prefix: str) -> Optional['date']:
        if not config: return None
        from datetime import date, timedelta
        import calendar
        
        schedule_type = config.get(f"{prefix}_schedule_type")
        schedule_value = config.get(f"{prefix}_schedule_value", [])
        if not schedule_value: return None
        
        last_date = config.get(f"last_{prefix}_date") or default_start_date
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
        from datetime import date
        today = date.today()
        data_dict = data.model_dump(exclude_unset=True)
        
        next_fup = ProjectService._calculate_next_schedule_date(data_dict, today, "followup")
        if next_fup:
            data_dict["next_followup_date"] = next_fup
        next_fb = ProjectService._calculate_next_schedule_date(data_dict, today, "feedback")
        if next_fb:
            data_dict["next_feedback_date"] = next_fb
            
        return await ProjectRepository.create(data_dict)

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
        has_content_calendar: Optional[bool] = None,
        is_onhold: Optional[bool] = None,
        followup_due: Optional[bool] = None,
        feedback_due: Optional[bool] = None,
        cc_status: Optional[str] = None,
        page: Optional[int] = None, 
        limit: Optional[int] = None
    ):
        result = await ProjectRepository.get_all(is_deleted, client_id, category, priority, status, search, whatsapp_status, festival_posts, has_content_calendar, is_onhold, followup_due, feedback_due, cc_status, page, limit)
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
            
        item = await ProjectRepository.get_by_id(project_id)
        
        import json
        from datetime import date
        data_dict = json.loads(data.model_dump_json(exclude_unset=True))
        
        # Merge with existing config for auto-calculation
        merged_config = {**item} if item else {}
        merged_config.update(data_dict)
        
        today = date.today()
        next_fup = ProjectService._calculate_next_schedule_date(merged_config, today, "followup")
        if next_fup is not None:
            data_dict["next_followup_date"] = next_fup.isoformat() if hasattr(next_fup, 'isoformat') else next_fup
            
        next_fb = ProjectService._calculate_next_schedule_date(merged_config, today, "feedback")
        if next_fb is not None:
            data_dict["next_feedback_date"] = next_fb.isoformat() if hasattr(next_fb, 'isoformat') else next_fb

        old_project = None
        if "creative_team" in data_dict:
            old_project = await ProjectRepository.get_by_id(project_id)
            
        updated = await ProjectRepository.update(project_id, data_dict)
        
        if updated and old_project and "creative_team" in data_dict:
            old_team = old_project.get("creative_team", {})
            new_team = data_dict["creative_team"]
            
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
    async def add_followup_log(project_id: str, data: FollowUpLogCreate, current_user_id: str):
        project = await ProjectRepository.get_by_id(project_id)
        if not project:
            return None
            
        from datetime import date, datetime
        import uuid
        
        # 1. Create the log
        log = {
            "id": str(uuid.uuid4()),
            "text": data.text,
            "created_at": datetime.utcnow(),
            "created_by": current_user_id
        }
        
        # Add it to the array
        logs = project.get("followup_logs", [])
        logs.append(log)
        
        # 2. Update the project's last_followup_date to today
        # which will auto-trigger recalculation of next_followup_date
        from app.schemas.project import ProjectUpdate
        today = date.today()
        
        update_schema = ProjectUpdate(last_followup_date=today, followup_logs=logs)
        await ProjectService.update_project(project_id, update_schema, current_user_id)
        
        # Format response
        emp_cache = {}
        await ProjectService._populate_creative_team({"creative_team": {"log_creator": log["created_by"]}}, emp_cache)
        log["created_by_details"] = emp_cache.get(str(log["created_by"]), {"employee_name": str(log["created_by"])})
        
        return log

    @staticmethod
    async def get_followup_logs(project_id: str):
        project = await ProjectRepository.get_by_id(project_id)
        if not project:
            return []
            
        logs = project.get("followup_logs", [])
        # Sort desc by date
        logs = sorted(logs, key=lambda x: x.get("created_at"), reverse=True)
        
        if logs:
            emp_cache = {}
            for log in logs:
                emp_id_str = str(log.get("created_by", ""))
                if emp_id_str not in emp_cache:
                    from app.repository.employee import EmployeeRepository
                    emp = await EmployeeRepository.get_employee_by_id(emp_id_str)
                    if emp:
                        personal = emp.get("personal_info", {})
                        name = f"{personal.get('first_name', '')} {personal.get('last_name', '')}".strip() or "Employee"
                        emp_cache[emp_id_str] = {"employee_name": name}
                    else:
                        emp_cache[emp_id_str] = {"employee_name": emp_id_str}
                
                log["created_by_details"] = emp_cache[emp_id_str]
                
        return logs

    @staticmethod
    async def add_client_review(project_id: str, data: ClientReviewCreate, current_user_id: str):
        project = await ProjectRepository.get_by_id(project_id)
        if not project:
            return None
            
        from datetime import datetime
        import uuid
        
        review = {
            "id": str(uuid.uuid4()),
            "review_text": data.review_text,
            "admin_comment": None,
            "created_at": datetime.utcnow(),
            "created_by": current_user_id
        }
        
        reviews = project.get("client_reviews", [])
        reviews.append(review)
        
        from app.schemas.project import ProjectUpdate
        update_schema = ProjectUpdate(client_reviews=reviews)
        await ProjectService.update_project(project_id, update_schema, current_user_id)
        
        emp_cache = {}
        await ProjectService._populate_creative_team({"creative_team": {"rev_creator": review["created_by"]}}, emp_cache)
        review["created_by_details"] = emp_cache.get(str(review["created_by"]), {"employee_name": str(review["created_by"])})
        
        return review

    @staticmethod
    async def update_client_review_comment(project_id: str, review_id: str, data: ClientReviewUpdate, current_user_id: str):
        project = await ProjectRepository.get_by_id(project_id)
        if not project:
            return None
            
        reviews = project.get("client_reviews", [])
        updated_review = None
        for rev in reviews:
            if rev.get("id") == review_id:
                rev["admin_comment"] = data.admin_comment
                updated_review = rev
                break
                
        if not updated_review:
            return None
            
        from app.schemas.project import ProjectUpdate
        update_schema = ProjectUpdate(client_reviews=reviews)
        await ProjectService.update_project(project_id, update_schema, current_user_id)
        
        emp_cache = {}
        await ProjectService._populate_creative_team({"creative_team": {"rev_creator": updated_review["created_by"]}}, emp_cache)
        updated_review["created_by_details"] = emp_cache.get(str(updated_review["created_by"]), {"employee_name": str(updated_review["created_by"])})
        
        return updated_review

    @staticmethod
    async def get_client_reviews(project_id: str):
        project = await ProjectRepository.get_by_id(project_id)
        if not project:
            return []
            
        reviews = project.get("client_reviews", [])
        reviews = sorted(reviews, key=lambda x: x.get("created_at"), reverse=True)
        
        if reviews:
            emp_cache = {}
            for rev in reviews:
                emp_id_str = str(rev.get("created_by", ""))
                if emp_id_str not in emp_cache:
                    from app.repository.employee import EmployeeRepository
                    emp = await EmployeeRepository.get_employee_by_id(emp_id_str)
                    if emp:
                        personal = emp.get("personal_info", {})
                        name = f"{personal.get('first_name', '')} {personal.get('last_name', '')}".strip() or "Employee"
                        emp_cache[emp_id_str] = {"employee_name": name}
                    else:
                        emp_cache[emp_id_str] = {"employee_name": emp_id_str}
                
                rev["created_by_details"] = emp_cache[emp_id_str]
                
        return reviews
        
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
