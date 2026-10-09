import uuid
from datetime import datetime, date
from typing import Optional
from app.repository.project import ProjectRepository
from app.repository.client import ClientRepository
from app.schemas.project import ProjectCreate, ProjectUpdate, FollowUpLogCreate, DailyMarketingStatCreate, DailyMarketingStatUpdate, DailyMarketingStatBulkCreate, DailyRevenueCreate, DailyRevenueUpdate
from app.redis.service import get_cache, set_cache, delete_cache, clear_pattern, make_list_key

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
            data_dict["next_followup_date"] = datetime.combine(next_fup, datetime.min.time()) if isinstance(next_fup, date) and not isinstance(next_fup, datetime) else next_fup
        next_fb = ProjectService._calculate_next_schedule_date(data_dict, today, "feedback")
        if next_fb:
            data_dict["next_feedback_date"] = datetime.combine(next_fb, datetime.min.time()) if isinstance(next_fb, date) and not isinstance(next_fb, datetime) else next_fb
            
        created = await ProjectRepository.create(data_dict)
        await clear_pattern("projects:list:*")
        await clear_pattern("clients:list:*")
        if data_dict.get("client_id"):
            await delete_cache(f"client:{data_dict['client_id']}")
        return created

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
        cache_key = make_list_key(
            "projects",
            is_deleted=is_deleted,
            client_id=client_id,
            category=category,
            priority=priority,
            status=status,
            search=search,
            whatsapp_status=whatsapp_status,
            festival_posts=festival_posts,
            has_content_calendar=has_content_calendar,
            is_onhold=is_onhold,
            followup_due=followup_due,
            feedback_due=feedback_due,
            cc_status=cc_status,
            page=page,
            limit=limit
        )
        cached = await get_cache(cache_key)
        if cached is not None:
            return cached

        result = await ProjectRepository.get_all(is_deleted, client_id, category, priority, status, search, whatsapp_status, festival_posts, has_content_calendar, is_onhold, followup_due, feedback_due, cc_status, page, limit)
        client_cache = {}
        emp_cache = {}
        for item in result.get("data", []):
            await ProjectService._populate_client(item, client_cache)
            await ProjectService._populate_creative_team(item, emp_cache)
            
        await set_cache(cache_key, result, ttl=3600)
        return result

    @staticmethod
    async def get_project_by_id(project_id: str):
        cache_key = f"project:{project_id}"
        cached = await get_cache(cache_key)
        if cached is not None:
            return cached

        item = await ProjectRepository.get_by_id(project_id)
        if item:
            await ProjectService._populate_client(item, {})
            await ProjectService._populate_creative_team(item, {})
            await set_cache(cache_key, item, ttl=3600)
        return item

    @staticmethod
    async def renew_project(project_id: str, data: 'ProjectRenewalCreate', current_user_id: str):
        from app.schemas.project import ProjectRenewalCreate
        import uuid
        from datetime import datetime
        
        existing = await ProjectRepository.get_by_id(project_id)
        if not existing:
            return None
            
        # Add to history
        renewal_history = existing.get("renewal_history", [])
        if not renewal_history:
            # Add initial date as first renewal
            gen = existing.get("general", {})
            if gen.get("start_date") and gen.get("end_date"):
                renewal_history.append({
                    "id": str(uuid.uuid4()),
                    "start_date": gen.get("start_date"),
                    "end_date": gen.get("end_date"),
                    "renewed_at": existing.get("created_at") or datetime.utcnow(),
                    "renewed_by": existing.get("client_id")  # Placeholder for original creator
                })
                
        # Append new renewal
        now = datetime.utcnow()
        new_renewal = {
            "id": str(uuid.uuid4()),
            "start_date": datetime.combine(data.start_date, datetime.min.time()),
            "end_date": datetime.combine(data.end_date, datetime.min.time()),
            "renewed_at": now,
            "renewed_by": current_user_id
        }
        renewal_history.append(new_renewal)
        
        # Update general start/end date to latest
        gen = existing.get("general", {})
        gen["start_date"] = datetime.combine(data.start_date, datetime.min.time())
        gen["end_date"] = datetime.combine(data.end_date, datetime.min.time())
        
        update_data = {
            "renewal_history": renewal_history,
            "general": gen
        }
        
        await ProjectRepository.update(project_id, update_data)
        return await ProjectRepository.get_by_id(project_id)

    @staticmethod
    async def update_project(project_id: str, data: ProjectUpdate, current_user_id: Optional[str] = None):
        update_data = data.model_dump(exclude_unset=True)
        if not update_data:
            return True
            
        existing_project = await ProjectRepository.get_by_id(project_id)
        # If followup fields are updated, recalculate next_followup_date
        if any(k in update_data for k in ["followup_schedule_type", "followup_schedule_value", "last_followup_date"]):
            from datetime import date, datetime
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
            
        old_project = existing_project

        item = await ProjectRepository.get_by_id(project_id)
        
        import json
        from datetime import date
        data_dict = json.loads(data.model_dump_json(exclude_unset=True))
        if not data_dict:
            return True
            
        # Merge with existing config for auto-calculation
        merged_config = {**item} if item else {}
        merged_config.update(data_dict)
        
        today = date.today()
        next_fup = ProjectService._calculate_next_schedule_date(merged_config, today, "followup")
        if next_fup is not None:
            data_dict["next_followup_date"] = datetime.combine(next_fup, datetime.min.time()) if isinstance(next_fup, date) and not isinstance(next_fup, datetime) else next_fup
            
        next_fb = ProjectService._calculate_next_schedule_date(merged_config, today, "feedback")
        if next_fb is not None:
            data_dict["next_feedback_date"] = datetime.combine(next_fb, datetime.min.time()) if isinstance(next_fb, date) and not isinstance(next_fb, datetime) else next_fb

        old_project = None
        if "creative_team" in data_dict:
            old_project = await ProjectRepository.get_by_id(project_id)
            
        updated = await ProjectRepository.update(project_id, data_dict)
        
        if updated and "creative_team" in data_dict:
            try:
                old_team = (old_project.get("creative_team") if old_project else None) or {}
                new_team = data_dict.get("creative_team") or {}
                
                from app.repository.task import TaskRepository
                from app.schemas.task import TaskStatus
                
                for role, new_emp_id in new_team.items():
                    old_emp_id = old_team.get(role) if isinstance(old_team, dict) else None
                    if old_emp_id != new_emp_id and new_emp_id:
                        # Find incomplete SMM tasks for this role, project, and old employee
                        if old_emp_id:
                            existing_tasks = await TaskRepository.get_all(
                                project_id=project_id, 
                                creative_role=role, 
                                assigned_to=old_emp_id,
                                task_category="SMM"
                            )
                        else:
                            existing_tasks = await TaskRepository.get_all(
                                project_id=project_id, 
                                creative_role=role, 
                                task_category="SMM"
                            )
                        
                        if existing_tasks and existing_tasks.get("data"):
                            for task in existing_tasks["data"]:
                                # If old_emp_id was empty, only reassign tasks that were unassigned
                                if not old_emp_id and task.get("assigned_to"):
                                    continue
                                status_str = str(task.get("status", "")).lower()
                                if status_str not in ["completed", "done"]:
                                    update_fields = {"assigned_to": new_emp_id}
                                    if current_user_id:
                                        update_fields["assigned_by"] = current_user_id
                                    await TaskRepository.update(str(task["_id"]), update_fields)
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning(f"Error transferring tasks during creative team reassign: {e}")
                                
        if updated:
            await clear_pattern("projects:list:*")
            await delete_cache(f"project:{project_id}")
            await clear_pattern("clients:list:*")
            client_id = update_data.get("client_id") or (old_project.get("client_id") if old_project else None)
            if client_id:
                await delete_cache(f"client:{client_id}")

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
        
        # Format response (created_by_details must be a dict for FollowUpLog schema)
        emp_cache = {}
        await ProjectService._populate_creative_team({"creative_team": {"log_creator": log["created_by"]}}, emp_cache)
        creator_info = emp_cache.get(str(log["created_by"]), {"employee_name": str(log["created_by"])})
        log["created_by_details"] = creator_info if isinstance(creator_info, dict) else {"employee_name": str(creator_info)}

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

    # K12: Client Reviews system removed (transcript — no requirement).

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
            await clear_pattern("projects:list:*")
            await delete_cache(f"project:{project_id}")
            return new_approval
        return None

    @staticmethod
    async def delete_project(project_id: str):
        existing = await ProjectRepository.get_by_id(project_id)
        res = await ProjectRepository.delete(project_id)
        if res:
            await clear_pattern("projects:list:*")
            await delete_cache(f"project:{project_id}")
            await clear_pattern("clients:list:*")
            if existing and existing.get("client_id"):
                await delete_cache(f"client:{existing['client_id']}")
        return res

    @staticmethod
    async def add_daily_marketing_stat(project_id: str, data: DailyMarketingStatCreate, current_user_id: str):
        project = await ProjectRepository.get_by_id(project_id)
        if not project:
            return None
            
        stats = project.get("daily_marketing_stats", []) or []
        campaigns = project.get("marketing_campaigns", []) or []
        
        camp_clean = data.campaign_name.strip()
        if camp_clean and not any(c.lower() == camp_clean.lower() for c in campaigns):
            campaigns.append(camp_clean)
            
        target_date = datetime.combine(data.date, datetime.min.time())
        target_date_str = data.date.strftime("%Y-%m-%d") if isinstance(data.date, (date, datetime)) else str(data.date)[:10]
        
        def _get_date_str(d):
            if isinstance(d, datetime):
                return d.strftime("%Y-%m-%d")
            elif isinstance(d, date):
                return d.strftime("%Y-%m-%d")
            elif isinstance(d, str):
                return d[:10]
            return ""

        existing_idx = -1
        existing_item = None
        for idx, s in enumerate(stats):
            if s.get("campaign_name", "").strip().lower() == camp_clean.lower() and _get_date_str(s.get("date")) == target_date_str:
                existing_idx = idx
                existing_item = s
                break
                
        daily_revenues = project.get("daily_revenues", []) or []
        auto_revenue = data.revenue
        if auto_revenue == 0.0:
            for r in daily_revenues:
                if _get_date_str(r.get("date")) == target_date_str:
                    auto_revenue = r.get("revenue", 0.0) or 0.0
                    break

        now = datetime.utcnow()
        if existing_item:
            # Combine/sum values into existing entry
            existing_item["reach"] = (existing_item.get("reach", 0) or 0) + data.reach
            existing_item["impressions"] = (existing_item.get("impressions", 0) or 0) + data.impressions
            existing_item["leads"] = (existing_item.get("leads", 0) or 0) + data.leads
            existing_item["followers"] = (existing_item.get("followers", 0) or 0) + (data.followers or 0)
            existing_item["revenue"] = round((existing_item.get("revenue", 0.0) or 0.0) + (data.revenue if data.revenue > 0 else auto_revenue), 2)
            existing_item["spend"] = round((existing_item.get("spend", 0.0) or 0.0) + data.spend, 2)
            
            tot_leads = existing_item["leads"]
            tot_spend = existing_item["spend"]
            tot_reach = existing_item["reach"]
            
            if data.cost_metric is not None:
                existing_item["cost_metric"] = data.cost_metric
            elif tot_leads > 0:
                existing_item["cost_metric"] = round(tot_spend / tot_leads, 2)
            elif tot_reach > 0:
                existing_item["cost_metric"] = round(tot_spend / tot_reach, 4)
            else:
                existing_item["cost_metric"] = 0.0
                
            existing_item["updated_at"] = now
            stats[existing_idx] = existing_item
            stat_entry = existing_item
        else:
            # Create brand new entry
            cost_metric = data.cost_metric
            if cost_metric is None:
                if data.leads > 0:
                    cost_metric = round(data.spend / data.leads, 2)
                elif data.reach > 0:
                    cost_metric = round(data.spend / data.reach, 4)
                else:
                    cost_metric = 0.0
                    
            stat_entry = {
                "id": uuid.uuid4().hex[:12],
                "date": target_date,
                "campaign_name": camp_clean,
                "reach": data.reach,
                "impressions": data.impressions,
                "leads": data.leads,
                "followers": data.followers or 0,
                "revenue": auto_revenue,
                "spend": data.spend,
                "cost_metric": cost_metric,
                "created_at": now,
                "updated_at": now,
                "created_by": current_user_id
            }
            stats.append(stat_entry)
            
        updated = await ProjectRepository.update(project_id, {"daily_marketing_stats": stats, "marketing_campaigns": campaigns})
        if updated:
            await clear_pattern("projects:list:*")
            await delete_cache(f"project:{project_id}")
            # Calculate sn position
            sorted_stats = sorted(stats, key=lambda x: str(x.get("date") or ""))
            for idx, item in enumerate(sorted_stats):
                if item.get("id") == stat_entry.get("id"):
                    stat_entry["sn"] = idx + 1
                    break
            return stat_entry
        return None

    @staticmethod
    async def add_bulk_daily_marketing_stats(project_id: str, data: DailyMarketingStatBulkCreate, current_user_id: str):
        project = await ProjectRepository.get_by_id(project_id)
        if not project:
            return None
            
        stats = project.get("daily_marketing_stats", []) or []
        campaigns = project.get("marketing_campaigns", []) or []
        
        target_date = datetime.combine(data.date, datetime.min.time())
        target_date_str = data.date.strftime("%Y-%m-%d") if isinstance(data.date, (date, datetime)) else str(data.date)[:10]
        
        def _get_date_str(d):
            if isinstance(d, datetime):
                return d.strftime("%Y-%m-%d")
            elif isinstance(d, date):
                return d.strftime("%Y-%m-%d")
            elif isinstance(d, str):
                return d[:10]
            return ""

        now = datetime.utcnow()
        affected_ids = []
        
        for entry in data.entries:
            camp_clean = entry.campaign_name.strip()
            if not camp_clean:
                continue
            if not any(c.lower() == camp_clean.lower() for c in campaigns):
                campaigns.append(camp_clean)
                
            existing_idx = -1
            existing_item = None
            for idx, s in enumerate(stats):
                if s.get("campaign_name", "").strip().lower() == camp_clean.lower() and _get_date_str(s.get("date")) == target_date_str:
                    existing_idx = idx
                    existing_item = s
                    break
                    
            if existing_item:
                existing_item["reach"] = (existing_item.get("reach", 0) or 0) + entry.reach
                existing_item["impressions"] = (existing_item.get("impressions", 0) or 0) + entry.impressions
                existing_item["leads"] = (existing_item.get("leads", 0) or 0) + entry.leads
                existing_item["followers"] = (existing_item.get("followers", 0) or 0) + (entry.followers or 0)
                existing_item["revenue"] = round((existing_item.get("revenue", 0.0) or 0.0) + entry.revenue, 2)
                existing_item["spend"] = round((existing_item.get("spend", 0.0) or 0.0) + entry.spend, 2)
                
                tot_leads = existing_item["leads"]
                tot_spend = existing_item["spend"]
                tot_reach = existing_item["reach"]
                
                if entry.cost_metric is not None:
                    existing_item["cost_metric"] = entry.cost_metric
                elif tot_leads > 0:
                    existing_item["cost_metric"] = round(tot_spend / tot_leads, 2)
                elif tot_reach > 0:
                    existing_item["cost_metric"] = round(tot_spend / tot_reach, 4)
                else:
                    existing_item["cost_metric"] = 0.0
                    
                existing_item["updated_at"] = now
                stats[existing_idx] = existing_item
                affected_ids.append(existing_item["id"])
            else:
                cost_metric = entry.cost_metric
                if cost_metric is None:
                    if entry.leads > 0:
                        cost_metric = round(entry.spend / entry.leads, 2)
                    elif entry.reach > 0:
                        cost_metric = round(entry.spend / entry.reach, 4)
                    else:
                        cost_metric = 0.0
                        
                stat_entry = {
                    "id": uuid.uuid4().hex[:12],
                    "date": target_date,
                    "campaign_name": camp_clean,
                    "reach": entry.reach,
                    "impressions": entry.impressions,
                    "leads": entry.leads,
                    "followers": entry.followers or 0,
                    "revenue": entry.revenue,
                    "spend": entry.spend,
                    "cost_metric": cost_metric,
                    "created_at": now,
                    "updated_at": now,
                    "created_by": current_user_id
                }
                stats.append(stat_entry)
                affected_ids.append(stat_entry["id"])

        updated = await ProjectRepository.update(project_id, {"daily_marketing_stats": stats, "marketing_campaigns": campaigns})
        if updated:
            await clear_pattern("projects:list:*")
            await delete_cache(f"project:{project_id}")
            
            sorted_stats = sorted(stats, key=lambda x: str(x.get("date") or ""))
            result_list = []
            for idx, item in enumerate(sorted_stats):
                if item.get("id") in affected_ids:
                    item["sn"] = idx + 1
                    result_list.append(item)
            return result_list
        return None

    @staticmethod
    def _resolve_date_range(preset: Optional[str] = None, start_date: Optional[date] = None, end_date: Optional[date] = None):
        from datetime import timedelta
        today = date.today()
        
        if start_date or end_date:
            return start_date, end_date
            
        if not preset:
            return None, None
            
        clean_p = preset.lower().strip().replace(" ", "_").replace("-", "_")
        
        if clean_p == "today":
            return today, today
        elif clean_p == "yesterday":
            y = today - timedelta(days=1)
            return y, y
        elif clean_p == "last_7_days":
            return today - timedelta(days=6), today
        elif clean_p == "last_14_days":
            return today - timedelta(days=13), today
        elif clean_p == "last_28_days":
            return today - timedelta(days=27), today
        elif clean_p == "last_30_days":
            return today - timedelta(days=29), today
        elif clean_p == "this_week":
            start = today - timedelta(days=today.weekday())
            return start, today
        elif clean_p == "last_week":
            end = today - timedelta(days=today.weekday() + 1)
            start = end - timedelta(days=6)
            return start, end
        elif clean_p == "this_month":
            start = date(today.year, today.month, 1)
            return start, today
        elif clean_p == "last_month":
            first_this_month = date(today.year, today.month, 1)
            last_day_last_month = first_this_month - timedelta(days=1)
            first_day_last_month = date(last_day_last_month.year, last_day_last_month.month, 1)
            return first_day_last_month, last_day_last_month
        elif clean_p in ["maximum", "all"]:
            return None, None
            
        return None, None

    @staticmethod
    def _extract_item_date(d):
        if isinstance(d, datetime):
            return d.date()
        if isinstance(d, date):
            return d
        if isinstance(d, str):
            try:
                return datetime.strptime(d[:10], "%Y-%m-%d").date()
            except Exception:
                return None
        return None

    @staticmethod
    async def get_daily_marketing_stats(project_id: str, campaign_name: Optional[str] = None, start_date: Optional[date] = None, end_date: Optional[date] = None, preset: Optional[str] = None):
        project = await ProjectRepository.get_by_id(project_id)
        if not project:
            return None
            
        stats = project.get("daily_marketing_stats", []) or []
        s_date, e_date = ProjectService._resolve_date_range(preset, start_date, end_date)
        
        filtered = []
        for s in stats:
            if campaign_name and campaign_name.strip().lower() not in ["all", "all campaigns", ""]:
                if s.get("campaign_name", "").strip().lower() != campaign_name.strip().lower():
                    continue
                    
            item_date = ProjectService._extract_item_date(s.get("date"))
            if item_date:
                if s_date and item_date < s_date:
                    continue
                if e_date and item_date > e_date:
                    continue
                    
            filtered.append(s)

        sorted_stats = sorted(filtered, key=lambda x: str(x.get("date") or ""))
        for idx, item in enumerate(sorted_stats):
            item["sn"] = idx + 1
        return sorted_stats

    @staticmethod
    async def get_marketing_summary(project_id: str, campaign_name: Optional[str] = None, start_date: Optional[date] = None, end_date: Optional[date] = None, preset: Optional[str] = None):
        from datetime import timedelta
        project = await ProjectRepository.get_by_id(project_id)
        if not project:
            return None
            
        stats = await ProjectService.get_daily_marketing_stats(project_id, campaign_name=campaign_name, start_date=start_date, end_date=end_date, preset=preset)
        s_date, e_date = ProjectService._resolve_date_range(preset, start_date, end_date)
        
        tot_reach = sum((s.get("reach", 0) or 0) for s in stats)
        tot_impressions = sum((s.get("impressions", 0) or 0) for s in stats)
        tot_leads = sum((s.get("leads", 0) or 0) for s in stats)
        tot_revenue = round(sum((s.get("revenue", 0.0) or 0.0) for s in stats), 2)
        tot_spend = round(sum((s.get("spend", 0.0) or 0.0) for s in stats), 2)
        
        cost_metric = round(tot_spend / tot_leads, 2) if tot_leads > 0 else (round(tot_spend / tot_reach, 4) if tot_reach > 0 else 0.0)
        
        # Calculate Previous Period for Growth Pct Comparison
        prev_reach = 0
        prev_impressions = 0
        prev_leads = 0
        prev_revenue = 0.0
        prev_spend = 0.0
        prev_cpl = 0.0
        
        if s_date and e_date:
            days = max(1, (e_date - s_date).days + 1)
            prev_end = s_date - timedelta(days=1)
            prev_start = prev_end - timedelta(days=days - 1)
            prev_stats = await ProjectService.get_daily_marketing_stats(project_id, campaign_name=campaign_name, start_date=prev_start, end_date=prev_end)
            if prev_stats:
                prev_reach = sum((s.get("reach", 0) or 0) for s in prev_stats)
                prev_impressions = sum((s.get("impressions", 0) or 0) for s in prev_stats)
                prev_leads = sum((s.get("leads", 0) or 0) for s in prev_stats)
                prev_revenue = round(sum((s.get("revenue", 0.0) or 0.0) for s in prev_stats), 2)
                prev_spend = round(sum((s.get("spend", 0.0) or 0.0) for s in prev_stats), 2)
                prev_cpl = round(prev_spend / prev_leads, 2) if prev_leads > 0 else (round(prev_spend / prev_reach, 4) if prev_reach > 0 else 0.0)

        def _calc_growth(curr, prev):
            if prev > 0:
                return round(((curr - prev) / prev) * 100, 1)
            return 0.0

        def _format_short(n):
            if n >= 1_000_000:
                val = f"{n / 1_000_000:.1f}M"
                return val.replace(".0M", "M")
            elif n >= 1_000:
                val = f"{n / 1_000:.1f}K"
                return val.replace(".0K", "K")
            return f"{n:,.0f}"

        campaign_map = {}
        for s in stats:
            c_name = s.get("campaign_name", "Unknown").strip()
            if not c_name:
                continue
            if c_name not in campaign_map:
                campaign_map[c_name] = {"campaign_name": c_name, "leads": 0, "spend": 0.0, "reach": 0, "impressions": 0, "revenue": 0.0, "cpl": 0.0}
            campaign_map[c_name]["leads"] += (s.get("leads", 0) or 0)
            campaign_map[c_name]["spend"] = round(campaign_map[c_name]["spend"] + (s.get("spend", 0.0) or 0.0), 2)
            campaign_map[c_name]["reach"] += (s.get("reach", 0) or 0)
            campaign_map[c_name]["impressions"] += (s.get("impressions", 0) or 0)
            campaign_map[c_name]["revenue"] = round(campaign_map[c_name]["revenue"] + (s.get("revenue", 0.0) or 0.0), 2)

        for c_data in campaign_map.values():
            tot_c_leads = c_data["leads"]
            tot_c_spend = c_data["spend"]
            c_data["cpl"] = round(tot_c_spend / tot_c_leads, 2) if tot_c_leads > 0 else 0.0

        # Sort based on leads descending (top performing campaigns), limit to top 5
        top_campaigns = sorted(list(campaign_map.values()), key=lambda x: (x["leads"], x["spend"]), reverse=True)[:5]
        
        gen = project.get("general", {})
        project_name = gen.get("project_name") if isinstance(gen, dict) else "Project"
        
        return {
            "project_name": project_name or "Digital Marketing Project",
            "timeline": {
                "start_date": gen.get("start_date") if isinstance(gen, dict) else None,
                "end_date": gen.get("end_date") if isinstance(gen, dict) else None
            },
            "filters": {
                "campaign_name": campaign_name or "All Campaigns",
                "preset": preset,
                "start_date": s_date.strftime("%Y-%m-%d") if s_date else None,
                "end_date": e_date.strftime("%Y-%m-%d") if e_date else None
            },
            "kpis": {
                "reach": {
                    "value": float(tot_reach),
                    "formatted": _format_short(tot_reach),
                    "growth_pct": _calc_growth(tot_reach, prev_reach)
                },
                "leads": {
                    "value": float(tot_leads),
                    "formatted": f"{tot_leads:,}",
                    "growth_pct": _calc_growth(tot_leads, prev_leads)
                },
                "cost_per_lead": {
                    "value": float(cost_metric),
                    "formatted": f"₹{cost_metric:,.0f}",
                    "growth_pct": _calc_growth(cost_metric, prev_cpl)
                },
                "amount_spent": {
                    "value": float(tot_spend),
                    "formatted": f"₹{tot_spend:,.0f}",
                    "growth_pct": _calc_growth(tot_spend, prev_spend)
                },
                "impressions": {
                    "value": float(tot_impressions),
                    "formatted": _format_short(tot_impressions),
                    "growth_pct": _calc_growth(tot_impressions, prev_impressions)
                },
                "revenue": {
                    "value": float(tot_revenue),
                    "formatted": f"₹{tot_revenue:,.0f}",
                    "growth_pct": _calc_growth(tot_revenue, prev_revenue)
                }
            },
            "top_campaigns": top_campaigns
        }

    @staticmethod
    async def get_marketing_workspace(project_id: str, campaign_name: Optional[str] = None, start_date: Optional[date] = None, end_date: Optional[date] = None, preset: Optional[str] = None):
        project = await ProjectRepository.get_by_id(project_id)
        if not project:
            return None
            
        summary = await ProjectService.get_marketing_summary(project_id, campaign_name=campaign_name, start_date=start_date, end_date=end_date, preset=preset)
        stats_logs = await ProjectService.get_daily_marketing_stats(project_id, campaign_name=campaign_name, start_date=start_date, end_date=end_date, preset=preset)
        campaign_options = await ProjectService.get_marketing_campaigns(project_id)
        
        # Calculate All-time Total Revenue added
        daily_revenues = project.get("daily_revenues", []) or []
        all_time_revenue = round(sum((r.get("revenue", 0.0) or 0.0) for r in daily_revenues), 2)
        if all_time_revenue == 0.0:
            all_time_revenue = round(sum((s.get("revenue", 0.0) or 0.0) for s in (project.get("daily_marketing_stats", []) or [])), 2)

        filtered_revenue = summary.get("kpis", {}).get("revenue", {}).get("value", 0.0)

        gen = project.get("general", {}) if isinstance(project.get("general"), dict) else {}
        header_info = {
            "project_name": gen.get("project_name", "Digital Marketing Project"),
            "progress": gen.get("progress", 0),
            "status": gen.get("status", "In Review"),
            "category": gen.get("category", "Digital Marketing"),
            "start_date": str(gen.get("start_date") or ""),
            "end_date": str(gen.get("end_date") or ""),
            "budget": all_time_revenue if all_time_revenue > 0 else float(gen.get("budget", 0) or 0),
            "formatted_budget": f"₹{all_time_revenue:,.0f}" if all_time_revenue > 0 else (f"₹{float(gen.get('budget', 0)):,.0f}" if gen.get("budget") else "₹0"),
            "total_revenue": all_time_revenue,
            "formatted_total_revenue": f"₹{all_time_revenue:,.0f}",
            "filtered_revenue": filtered_revenue,
            "formatted_filtered_revenue": f"₹{filtered_revenue:,.0f}"
        }
        
        return {
            "header": header_info,
            "timeline": summary.get("timeline", {}),
            "filters": summary.get("filters", {}),
            "kpis": summary.get("kpis", {}),
            "top_campaigns": summary.get("top_campaigns", []),
            "stats_logs": stats_logs or [],
            "campaign_options": campaign_options or [],
            "renewal_history": project.get("renewal_history", [])
        }

    @staticmethod
    async def update_daily_marketing_stat(project_id: str, stat_id: str, data: DailyMarketingStatUpdate):
        project = await ProjectRepository.get_by_id(project_id)
        if not project:
            return None
            
        stats = project.get("daily_marketing_stats", []) or []
        campaigns = project.get("marketing_campaigns", []) or []
        target_idx = -1
        target_item = None
        
        for idx, item in enumerate(stats):
            if item.get("id") == stat_id:
                target_idx = idx
                target_item = item
                break
                
        if target_idx == -1 or not target_item:
            return None
            
        update_data = data.model_dump(exclude_unset=True)
        if "date" in update_data and update_data["date"] and isinstance(update_data["date"], date) and not isinstance(update_data["date"], datetime):
            update_data["date"] = datetime.combine(update_data["date"], datetime.min.time())
            
        if "campaign_name" in update_data and update_data["campaign_name"]:
            camp_clean = update_data["campaign_name"].strip()
            update_data["campaign_name"] = camp_clean
            if camp_clean and not any(c.lower() == camp_clean.lower() for c in campaigns):
                campaigns.append(camp_clean)

        for k, v in update_data.items():
            target_item[k] = v
            
        target_item["updated_at"] = datetime.utcnow()
        
        if "cost_metric" not in update_data:
            leads = target_item.get("leads", 0) or 0
            spend = target_item.get("spend", 0.0) or 0.0
            reach = target_item.get("reach", 0) or 0
            if leads > 0:
                target_item["cost_metric"] = round(spend / leads, 2)
            elif reach > 0:
                target_item["cost_metric"] = round(spend / reach, 4)
            else:
                target_item["cost_metric"] = 0.0
                
        stats[target_idx] = target_item
        updated = await ProjectRepository.update(project_id, {"daily_marketing_stats": stats, "marketing_campaigns": campaigns})
        if updated:
            await clear_pattern("projects:list:*")
            await delete_cache(f"project:{project_id}")
            target_item["sn"] = target_idx + 1
            return target_item
        return None

    @staticmethod
    async def delete_daily_marketing_stat(project_id: str, stat_id: str):
        project = await ProjectRepository.get_by_id(project_id)
        if not project:
            return False
            
        stats = project.get("daily_marketing_stats", []) or []
        new_stats = [item for item in stats if item.get("id") != stat_id]
        if len(new_stats) == len(stats):
            return False
            
        updated = await ProjectRepository.update(project_id, {"daily_marketing_stats": new_stats})
        if updated:
            await clear_pattern("projects:list:*")
            await delete_cache(f"project:{project_id}")
            return True
        return False

    @staticmethod
    async def get_marketing_campaigns(project_id: str):
        project = await ProjectRepository.get_by_id(project_id)
        if not project:
            return None
        campaigns = set(project.get("marketing_campaigns", []) or [])
        stats = project.get("daily_marketing_stats", []) or []
        for s in stats:
            if s.get("campaign_name"):
                campaigns.add(s["campaign_name"].strip())
        return sorted(list(campaigns))

    @staticmethod
    async def add_marketing_campaign(project_id: str, campaign_name: str):
        project = await ProjectRepository.get_by_id(project_id)
        if not project:
            return None
        campaigns = project.get("marketing_campaigns", []) or []
        camp_clean = campaign_name.strip()
        if camp_clean and not any(c.lower() == camp_clean.lower() for c in campaigns):
            campaigns.append(camp_clean)
            updated = await ProjectRepository.update(project_id, {"marketing_campaigns": campaigns})
            if updated:
                await clear_pattern("projects:list:*")
                await delete_cache(f"project:{project_id}")
        return campaigns

    @staticmethod
    async def add_daily_revenue(project_id: str, data: DailyRevenueCreate, current_user_id: str):
        project = await ProjectRepository.get_by_id(project_id)
        if not project:
            return None
            
        daily_revenues = project.get("daily_revenues", []) or []
        daily_stats = project.get("daily_marketing_stats", []) or []
        
        target_date = datetime.combine(data.date, datetime.min.time())
        target_date_str = data.date.strftime("%Y-%m-%d") if isinstance(data.date, (date, datetime)) else str(data.date)[:10]
        
        def _get_date_str(d):
            if isinstance(d, datetime):
                return d.strftime("%Y-%m-%d")
            elif isinstance(d, date):
                return d.strftime("%Y-%m-%d")
            elif isinstance(d, str):
                return d[:10]
            return ""

        existing_idx = -1
        existing_item = None
        for idx, r in enumerate(daily_revenues):
            if _get_date_str(r.get("date")) == target_date_str:
                existing_idx = idx
                existing_item = r
                break
                
        now = datetime.utcnow()
        if existing_item:
            existing_item["revenue"] = data.revenue
            existing_item["updated_at"] = now
            daily_revenues[existing_idx] = existing_item
            revenue_entry = existing_item
        else:
            revenue_entry = {
                "id": uuid.uuid4().hex[:12],
                "date": target_date,
                "revenue": data.revenue,
                "created_at": now,
                "updated_at": now,
                "created_by": current_user_id
            }
            daily_revenues.append(revenue_entry)
            
        for s in daily_stats:
            if _get_date_str(s.get("date")) == target_date_str:
                s["revenue"] = data.revenue
                s["updated_at"] = now

        updated = await ProjectRepository.update(project_id, {
            "daily_revenues": daily_revenues,
            "daily_marketing_stats": daily_stats
        })
        
        if updated:
            await clear_pattern("projects:list:*")
            await delete_cache(f"project:{project_id}")
            return revenue_entry
        return None

    @staticmethod
    async def get_daily_revenues(project_id: str, start_date: Optional[date] = None, end_date: Optional[date] = None, preset: Optional[str] = None):
        project = await ProjectRepository.get_by_id(project_id)
        if not project:
            return None
        revenues = project.get("daily_revenues", []) or []
        s_date, e_date = ProjectService._resolve_date_range(preset, start_date, end_date)
        
        filtered = []
        for r in revenues:
            item_date = ProjectService._extract_item_date(r.get("date"))
            if item_date:
                if s_date and item_date < s_date:
                    continue
                if e_date and item_date > e_date:
                    continue
            filtered.append(r)
            
        return sorted(filtered, key=lambda x: str(x.get("date") or ""))

    @staticmethod
    async def update_daily_revenue(project_id: str, revenue_id: str, data: DailyRevenueUpdate):
        project = await ProjectRepository.get_by_id(project_id)
        if not project:
            return None
            
        daily_revenues = project.get("daily_revenues", []) or []
        daily_stats = project.get("daily_marketing_stats", []) or []
        
        def _get_date_str(d):
            if isinstance(d, datetime):
                return d.strftime("%Y-%m-%d")
            elif isinstance(d, date):
                return d.strftime("%Y-%m-%d")
            elif isinstance(d, str):
                return d[:10]
            return ""

        target_idx = -1
        target_item = None
        for idx, r in enumerate(daily_revenues):
            if r.get("id") == revenue_id:
                target_idx = idx
                target_item = r
                break
                
        if target_idx == -1 or not target_item:
            return None
            
        target_item["revenue"] = data.revenue
        now = datetime.utcnow()
        target_item["updated_at"] = now
        daily_revenues[target_idx] = target_item
        
        target_date_str = _get_date_str(target_item.get("date"))
        
        for s in daily_stats:
            if _get_date_str(s.get("date")) == target_date_str:
                s["revenue"] = data.revenue
                s["updated_at"] = now

        updated = await ProjectRepository.update(project_id, {
            "daily_revenues": daily_revenues,
            "daily_marketing_stats": daily_stats
        })
        
        if updated:
            await clear_pattern("projects:list:*")
            await delete_cache(f"project:{project_id}")
            return target_item
        return None

    @staticmethod
    async def delete_daily_revenue(project_id: str, revenue_id: str):
        project = await ProjectRepository.get_by_id(project_id)
        if not project:
            return False
            
        daily_revenues = project.get("daily_revenues", []) or []
        daily_stats = project.get("daily_marketing_stats", []) or []
        
        def _get_date_str(d):
            if isinstance(d, datetime):
                return d.strftime("%Y-%m-%d")
            elif isinstance(d, date):
                return d.strftime("%Y-%m-%d")
            elif isinstance(d, str):
                return d[:10]
            return ""

        target_item = None
        new_revenues = []
        for r in daily_revenues:
            if r.get("id") == revenue_id:
                target_item = r
            else:
                new_revenues.append(r)
                
        if not target_item:
            return False
            
        target_date_str = _get_date_str(target_item.get("date"))
        now = datetime.utcnow()
        
        for s in daily_stats:
            if _get_date_str(s.get("date")) == target_date_str:
                s["revenue"] = 0.0
                s["updated_at"] = now

        updated = await ProjectRepository.update(project_id, {
            "daily_revenues": new_revenues,
            "daily_marketing_stats": daily_stats
        })
        
        if updated:
            await clear_pattern("projects:list:*")
            await delete_cache(f"project:{project_id}")
            return True
        return False

