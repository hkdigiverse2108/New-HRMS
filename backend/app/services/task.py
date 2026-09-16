from typing import Optional
from app.repository.task import TaskRepository
from app.repository.employee import EmployeeRepository
from app.schemas.task import TaskCreate, TaskUpdate, TaskQuickAssign

class TaskService:
    @staticmethod
    async def _populate_user_details(item: dict, emp_cache: dict):
        for field in ["assigned_to", "assigned_by"]:
            emp_id = item.get(field)
            if not emp_id:
                continue
                
            emp_id_str = str(emp_id)
            if emp_id_str not in emp_cache:
                if emp_id_str == "default-admin-id":
                    emp_cache[emp_id_str] = {"employee_name": "Default Admin"}
                else:
                    emp = await EmployeeRepository.get_employee_by_id(emp_id_str)
                    if emp:
                        personal = emp.get("personal_info", {})
                        name = f"{personal.get('first_name', '')} {personal.get('last_name', '')}".strip() or "Employee"
                        emp_cache[emp_id_str] = {"employee_name": name}
                    else:
                        emp_cache[emp_id_str] = {"employee_name": "Unknown"}
                    
            item[f"{field}_details"] = emp_cache[emp_id_str]

    @staticmethod
    async def create_task(data: TaskCreate, assigned_by: str):
        insert_data = data.model_dump(exclude_unset=True)
        insert_data["assigned_by"] = assigned_by
        return await TaskRepository.create(insert_data)

    @staticmethod
    async def quick_assign_tasks(tasks: list[TaskQuickAssign], assigned_by: str):
        insert_data_list = []
        for task in tasks:
            for assignee in task.assigned_to:
                insert_data = {
                    "title": task.title,
                    "description": None,
                    "status": "todo",
                    "priority": "medium",
                    "due_date": task.due_date,
                    "assigned_to": assignee,
                    "assigned_by": assigned_by
                }
                insert_data_list.append(insert_data)
            
        if not insert_data_list:
            return []
            
        created_items = await TaskRepository.create_many(insert_data_list)
        
        emp_cache = {}
        for item in created_items:
            await TaskService._populate_user_details(item, emp_cache)
            
        return created_items

    @staticmethod
    async def get_all_tasks(is_deleted: bool = False, assigned_to: Optional[str] = None, assigned_by: Optional[str] = None, status: Optional[str] = None, priority: Optional[str] = None, page: Optional[int] = None, limit: Optional[int] = None, involved_emp_id: Optional[str] = None):
        result = await TaskRepository.get_all(is_deleted, assigned_to, assigned_by, status, priority, page, limit, involved_emp_id)
        
        emp_cache = {}
        for item in result.get("data", []):
            await TaskService._populate_user_details(item, emp_cache)
            
        return result

    @staticmethod
    async def get_task_by_id(item_id: str):
        item = await TaskRepository.get_by_id(item_id)
        if item:
            emp_cache = {}
            await TaskService._populate_user_details(item, emp_cache)
        return item

    @staticmethod
    async def update_task(item_id: str, update_data: TaskUpdate):
        return await TaskRepository.update(item_id, update_data.model_dump(exclude_unset=True))

    @staticmethod
    async def delete_task(item_id: str):
        return await TaskRepository.soft_delete(item_id)
