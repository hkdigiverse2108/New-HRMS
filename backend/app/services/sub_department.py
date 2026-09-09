from fastapi import HTTPException, status
from app.repository.sub_department import SubDepartmentRepository
from app.schemas.sub_department import SubDepartmentCreate, SubDepartmentUpdate

class SubDepartmentService:
    @staticmethod
    async def create(data: SubDepartmentCreate):
        return await SubDepartmentRepository.create(data.model_dump(exclude_unset=True))

    @staticmethod
    async def get_all():
        return await SubDepartmentRepository.get_all()

    @staticmethod
    async def get_by_id(item_id: str):
        item = await SubDepartmentRepository.get_by_id(item_id)
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SubDepartment not found")
        return item

    @staticmethod
    async def get_by_department_id(department_id: str):
        return await SubDepartmentRepository.get_by_department_id(department_id)

    @staticmethod
    async def update(item_id: str, data: SubDepartmentUpdate):
        update_data = data.model_dump(exclude_unset=True)
        if not update_data:
            return await SubDepartmentService.get_by_id(item_id)
            
        updated_item = await SubDepartmentRepository.update(item_id, update_data)
        if not updated_item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SubDepartment not found")
        return updated_item

    @staticmethod
    async def delete(item_id: str):
        success = await SubDepartmentRepository.delete(item_id)
        if not success:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SubDepartment not found")
        return {"detail": "SubDepartment deleted successfully"}
