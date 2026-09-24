from typing import Optional
from app.repository.client import ClientRepository
from app.schemas.client import ClientCreate, ClientUpdate

from app.schemas.project import ProjectCreate, ProjectCategory
from app.services.project import ProjectService
from app.repository.project import ProjectRepository
from app.redis.service import get_cache, set_cache, delete_cache, clear_pattern, make_list_key
from datetime import datetime, timedelta

class ClientService:
    @staticmethod
    async def create_client(data: ClientCreate):
        created_client = await ClientRepository.create(data.model_dump(exclude_unset=True))
        client_id = created_client["_id"]
        
        if data.service_details and data.service_details.departments:
            company_name = data.company_name
            today = datetime.utcnow().date()
            
            for dept in data.service_details.departments:
                try:
                    category = ProjectCategory(dept)
                    project_name = f"{company_name} - {dept}"
                    
                    project_data = ProjectCreate(
                        client_id=client_id,
                        general={
                            "project_name": project_name,
                            "category": category,
                            "start_date": today,
                            "end_date": today + timedelta(days=30)
                        }
                    )
                    await ProjectService.create_project(project_data)
                except ValueError:
                    pass # Ignore if department string doesn't match enum
                    
        await clear_pattern("clients:list:*")
        await clear_pattern("projects:list:*")
        return created_client

    @staticmethod
    async def get_all_clients(is_deleted: bool = False, is_archived: bool = False, search: Optional[str] = None, project_category: Optional[str] = None, page: Optional[int] = None, limit: Optional[int] = None):
        cache_key = make_list_key("clients", is_deleted=is_deleted, is_archived=is_archived, search=search, project_category=project_category, page=page, limit=limit)
        cached = await get_cache(cache_key)
        if cached is not None:
            return cached

        result = await ClientRepository.get_all(is_deleted, is_archived, search, project_category, page, limit)
        
        from app.repository.project import ProjectRepository
        for client in result.get("data", []):
            client_id = client.get("_id")
            if not client_id:
                continue
                
            projects_data = await ProjectRepository.get_all(is_deleted=False, client_id=str(client_id), limit=1000)
            projects = projects_data.get("data", [])
            
            total_projects = len(projects)
            total_budget = 0.0
            outstanding_amount = 0.0
            
            for p in projects:
                if "finance" in p and p["finance"]:
                    budget = p["finance"].get("project_budget", 0) or 0
                    received = p["finance"].get("amount_received", 0) or 0
                    total_budget += budget
                    outstanding_amount += (budget - received)
                    
            client["client_stats"] = {
                "total_projects": total_projects,
                "total_budget": total_budget,
                "outstanding_amount": outstanding_amount
            }
            client["projects"] = projects
            
        await set_cache(cache_key, result, ttl=3600)
        return result

    @staticmethod
    async def get_client_by_id(client_id: str):
        cache_key = f"client:{client_id}"
        cached = await get_cache(cache_key)
        if cached is not None:
            return cached

        client = await ClientRepository.get_by_id(client_id)
        if not client:
            return None
            
        from app.repository.project import ProjectRepository
        projects_data = await ProjectRepository.get_all(is_deleted=False, client_id=client_id, limit=1000)
        projects = projects_data.get("data", [])
        
        total_projects = len(projects)
        total_budget = 0.0
        outstanding_amount = 0.0
        
        for p in projects:
            if "finance" in p and p["finance"]:
                budget = p["finance"].get("project_budget", 0) or 0
                received = p["finance"].get("amount_received", 0) or 0
                total_budget += budget
                outstanding_amount += (budget - received)
                
        client["client_stats"] = {
            "total_projects": total_projects,
            "total_budget": total_budget,
            "outstanding_amount": outstanding_amount
        }
        
        client["projects"] = projects
        await set_cache(cache_key, client, ttl=3600)
        return client

    @staticmethod
    async def update_client(client_id: str, data: ClientUpdate):
        update_data = data.model_dump(exclude_unset=True)
        if not update_data:
            return True
            
        old_client = await ClientRepository.get_by_id(client_id)
        if not old_client:
            return False
            
        old_depts = old_client.get("service_details", {}).get("departments", []) if old_client.get("service_details") else []
            
        success = await ClientRepository.update(client_id, update_data)
        
        if success and data.service_details and data.service_details.departments is not None:
            new_depts = data.service_details.departments
            depts_to_remove = set(old_depts) - set(new_depts)
            depts_to_add = set(new_depts) - set(old_depts)
            
            company_name = update_data.get("company_name", old_client.get("company_name", "Unknown"))
            today = datetime.utcnow().date()
            
            for dept in depts_to_remove:
                try:
                    category = ProjectCategory(dept)
                    projects_res = await ProjectRepository.get_all(is_deleted=False, client_id=client_id, category=category)
                    for p in projects_res.get("data", []):
                        await ProjectService.delete_project(p["_id"])
                except ValueError:
                    pass
                    
            for dept in depts_to_add:
                try:
                    category = ProjectCategory(dept)
                    project_name = f"{company_name} - {dept}"
                    
                    project_data = ProjectCreate(
                        client_id=client_id,
                        general={
                            "project_name": project_name,
                            "category": category,
                            "start_date": today,
                            "end_date": today + timedelta(days=30)
                        }
                    )
                    await ProjectService.create_project(project_data)
                except ValueError:
                    pass
                    
        if success:
            await clear_pattern("clients:list:*")
            await delete_cache(f"client:{client_id}")
            await clear_pattern("projects:list:*")
        return success

    @staticmethod
    async def delete_client(client_id: str):
        success = await ClientRepository.delete(client_id)
        if success:
            projects_res = await ProjectRepository.get_all(is_deleted=False, client_id=client_id, limit=1000)
            for p in projects_res.get("data", []):
                await ProjectService.delete_project(p["_id"])
            await clear_pattern("clients:list:*")
            await delete_cache(f"client:{client_id}")
            await clear_pattern("projects:list:*")
        return success

    @staticmethod
    async def archive_client(client_id: str, status: bool = True):
        res = await ClientRepository.archive(client_id, status)
        if res:
            await clear_pattern("clients:list:*")
            await delete_cache(f"client:{client_id}")
        return res

