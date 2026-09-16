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
                client_cache[client_id_str] = {}
                
        item["client"] = client_cache.get(client_id_str)

    @staticmethod
    async def create_project(data: ProjectCreate):
        return await ProjectRepository.create(data.model_dump(exclude_unset=True))

    @staticmethod
    async def get_all_projects(is_deleted: bool = False, client_id: Optional[str] = None, category: Optional[str] = None, priority: Optional[str] = None, status: Optional[str] = None, search: Optional[str] = None, page: Optional[int] = None, limit: Optional[int] = None):
        result = await ProjectRepository.get_all(is_deleted, client_id, category, priority, status, search, page, limit)
        client_cache = {}
        for item in result.get("data", []):
            await ProjectService._populate_client(item, client_cache)
        return result

    @staticmethod
    async def get_project_by_id(project_id: str):
        item = await ProjectRepository.get_by_id(project_id)
        if item:
            await ProjectService._populate_client(item, {})
        return item

    @staticmethod
    async def update_project(project_id: str, data: ProjectUpdate):
        update_data = data.model_dump(exclude_unset=True)
        if not update_data:
            return True
        return await ProjectRepository.update(project_id, update_data)

    @staticmethod
    async def delete_project(project_id: str):
        return await ProjectRepository.delete(project_id)

    @staticmethod
    async def remove_campaign(project_id: str, campaign_name: str):
        return await ProjectRepository.remove_campaign(project_id, campaign_name)
