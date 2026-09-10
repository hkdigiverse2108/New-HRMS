from fastapi import HTTPException, status
from app.repository.department import DepartmentRepository
from app.schemas.department import DepartmentCreate, DepartmentUpdate

class DepartmentService:
    @staticmethod
    async def create(data: DepartmentCreate):
        return await DepartmentRepository.create(data.model_dump(exclude_unset=True))

    @staticmethod
    async def get_all(page: int = 1, limit: int = 10):
        return await DepartmentRepository.get_all(page, limit)

    @staticmethod
    async def get_by_id(item_id: str):
        item = await DepartmentRepository.get_by_id(item_id)
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")
        return item

    @staticmethod
    async def update(item_id: str, data: DepartmentUpdate):
        update_data = data.model_dump(exclude_unset=True)
        if not update_data:
            return await DepartmentService.get_by_id(item_id)
            
        updated_item = await DepartmentRepository.update(item_id, update_data)
        if not updated_item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")
        return updated_item

    @staticmethod
    async def delete(item_id: str):
        success = await DepartmentRepository.delete(item_id)
        if not success:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")
        return {"detail": "Department deleted successfully"}
