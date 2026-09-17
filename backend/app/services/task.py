from typing import Optional
from datetime import datetime
from app.repository.task import TaskRepository
from app.repository.employee import EmployeeRepository
from app.schemas.task import TaskCreate, TaskUpdate, TaskQuickAssign

class TaskService:
    @staticmethod
    async def _populate_user_details(item: dict, emp_cache: dict):
        async def get_details(emp_id):
            if not emp_id:
                return None
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
            return emp_cache[emp_id_str]

        for field in ["assigned_to", "assigned_by"]:
            item[f"{field}_details"] = await get_details(item.get(field))
            
        # fallback for existing tasks
        created_by = item.get("created_by") or item.get("assigned_by")
        item["created_by"] = created_by
        item["created_by_details"] = await get_details(created_by)
            
        transfer_req = item.get("transfer_request")
        if transfer_req:
            transfer_req["requested_to_details"] = await get_details(transfer_req.get("requested_to"))
            transfer_req["requested_by_details"] = await get_details(transfer_req.get("requested_by"))
            
        transfer_hist = item.get("transfer_history")
        if transfer_hist:
            for hist in transfer_hist:
                hist["from_employee_details"] = await get_details(hist.get("from_employee"))
                hist["to_employee_details"] = await get_details(hist.get("to_employee"))
                
        # Populate Project Details for SMM tasks
        project_id = item.get("project_id")
        if project_id:
            from app.repository.project import ProjectRepository
            proj = await ProjectRepository.get_by_id(project_id)
            if proj:
                if "_id" in proj:
                    proj["_id"] = str(proj["_id"])
                item["project_details"] = proj
                
        # Populate Content Details for SMM tasks
        content_item_id = item.get("content_item_id")
        if content_item_id:
            from app.repository.content import ContentRepository
            content = await ContentRepository.get_by_id(content_item_id)
            if content:
                if "_id" in content:
                    content["_id"] = str(content["_id"])
                item["content_item_details"] = content

    @staticmethod
    async def create_task(data: TaskCreate, assigned_by: str):
        insert_data = data.model_dump(exclude_unset=True)
        insert_data["assigned_by"] = assigned_by
        insert_data["created_by"] = assigned_by # same as assigned_by for now
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
                    "assigned_by": assigned_by,
                    "created_by": assigned_by # same as assigned_by for now
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
    async def get_all_tasks(is_deleted: bool = False, assigned_to: Optional[str] = None, assigned_by: Optional[str] = None, status: Optional[str] = None, priority: Optional[str] = None, page: Optional[int] = None, limit: Optional[int] = None, involved_emp_id: Optional[str] = None, history_assigned_to: Optional[str] = None, history_assigned_by: Optional[str] = None):
        result = await TaskRepository.get_all(is_deleted, assigned_to, assigned_by, status, priority, page, limit, involved_emp_id, history_assigned_to, history_assigned_by)
        
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

    @staticmethod
    async def request_transfer(task_id: str, requested_to: str, requested_by: str, reason: Optional[str] = None):
        transfer_req = {
            "requested_to": requested_to,
            "requested_by": requested_by,
            "requested_at": datetime.utcnow(),
            "reason": reason,
            "status": "pending"
        }
        return await TaskRepository.update(task_id, {"transfer_request": transfer_req})

    @staticmethod
    async def accept_transfer(task_id: str, task: dict):
        req = task.get("transfer_request")
        if not req or req.get("status") != "pending":
            return False
            
        history_item = {
            "from_employee": task.get("assigned_to"),
            "to_employee": req.get("requested_to"),
            "transferred_at": datetime.utcnow(),
            "reason": req.get("reason"),
            "status": "accepted"
        }
        
        current_history = task.get("transfer_history", [])
        current_history.append(history_item)
        
        update_data = {
            "assigned_to": req.get("requested_to"),
            "transfer_request": None,
            "transfer_history": current_history
        }
        
        return await TaskRepository.update(task_id, update_data)

    @staticmethod
    async def reject_transfer(task_id: str, task: dict):
        req = task.get("transfer_request")
        update_data = {"transfer_request": None}
        
        if req:
            history_item = {
                "from_employee": task.get("assigned_to"),
                "to_employee": req.get("requested_to"),
                "transferred_at": datetime.utcnow(),
                "reason": req.get("reason"),
                "status": "rejected"
            }
            current_history = task.get("transfer_history", [])
            current_history.append(history_item)
            update_data["transfer_history"] = current_history
            
        return await TaskRepository.update(task_id, update_data)
