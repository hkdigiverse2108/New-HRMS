from app.repository.daily_planner import DailyPlannerRepository
from app.repository.task import TaskRepository
from app.schemas.task import DailyPlannerCreate, DailyPlannerUpdate
from datetime import date
from typing import Optional

class DailyPlannerService:

    @staticmethod
    async def _sync_research_item(employee_id: str, research_text: str):
        if not research_text or not research_text.strip():
            return
        from app.repository.employee import EmployeeRepository
        from app.repository.research import ResearchRepository
        emp = await EmployeeRepository.get_employee_by_id(employee_id)
        dept_id = None
        if emp:
            work = emp.get("work_details", {})
            raw_dept = work.get("department") or work.get("department_id")
            if raw_dept:
                from app.repository.department import DepartmentRepository
                dept_doc = await DepartmentRepository.get_by_id_or_name(str(raw_dept))
                if dept_doc:
                    dept_id = str(dept_doc.get("_id"))
                else:
                    dept_id = str(raw_dept)
        today_str = date.today().isoformat()
        await ResearchRepository.upsert_from_planner(employee_id, today_str, research_text, dept_id)

    @staticmethod
    async def create_planner(employee_id: str, data: DailyPlannerCreate):
        today_str = date.today().isoformat()
        
        # Check if already exists
        existing = await DailyPlannerRepository.get_by_employee_and_date(employee_id, today_str)
        if existing:
            # Update instead
            clean_dict = {k: v for k, v in data.model_dump().items() if v is not None}
            return await DailyPlannerService.update_planner(employee_id, DailyPlannerUpdate(**clean_dict))
            
        insert_data = data.model_dump()
        insert_data["employee_id"] = employee_id
        insert_data["date"] = today_str
        
        created = await DailyPlannerRepository.create(insert_data)
        if data.research:
            await DailyPlannerService._sync_research_item(employee_id, data.research)
        return await DailyPlannerService.get_planner_for_today(employee_id)

    @staticmethod
    async def update_planner(employee_id: str, data: DailyPlannerUpdate):
        today_str = date.today().isoformat()
        
        existing = await DailyPlannerRepository.get_by_employee_and_date(employee_id, today_str)
        if not existing:
            # Create instead
            clean_dict = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
            return await DailyPlannerService.create_planner(employee_id, DailyPlannerCreate(**clean_dict))
            
        update_data = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
        if update_data:
            await DailyPlannerRepository.update(employee_id, today_str, update_data)
        if data.research:
            await DailyPlannerService._sync_research_item(employee_id, data.research)
        return await DailyPlannerService.get_planner_for_today(employee_id)

    @staticmethod
    async def get_planner_for_today(employee_id: str):
        today_str = date.today().isoformat()
        planner = await DailyPlannerRepository.get_by_employee_and_date(employee_id, today_str)
        
        if not planner:
            return None
            
        # Populate selected_tasks_details
        task_ids = planner.get("selected_tasks") or []
        planner["selected_tasks"] = task_ids
        if task_ids:
            # Fetch tasks by IDs
            # TaskRepository.get_all doesn't have an ID array filter, we can just fetch them individually or all tasks for employee
            # Since these are tasks assigned to the employee, we can fetch all assigned to employee and filter
            all_tasks_res = await TaskRepository.get_all(assigned_to=employee_id, limit=1000)
            all_tasks = all_tasks_res.get("data", [])
            
            from app.services.task import TaskService
            emp_cache = {}
            task_map = {str(t["_id"]): t for t in all_tasks if "_id" in t}
            
            populated_tasks = []
            for tid in task_ids:
                if tid in task_map:
                    t = task_map[tid]
                    await TaskService._populate_user_details(t, emp_cache)
                    populated_tasks.append(t)
                    
            planner["selected_tasks_details"] = populated_tasks
        else:
            planner["selected_tasks_details"] = []
            
        return planner
