from fastapi import HTTPException, status
from app.repository.designation import DesignationRepository
from app.schemas.designation import DesignationCreate, DesignationUpdate

class DesignationService:
    @staticmethod
    async def create(data: DesignationCreate):
        return await DesignationRepository.create(data.model_dump(exclude_unset=True))

    @staticmethod
    async def get_all():
        return await DesignationRepository.get_all()

    @staticmethod
    async def get_by_id(item_id: str):
        item = await DesignationRepository.get_by_id(item_id)
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Designation not found")
        return item

    @staticmethod
    async def update(item_id: str, data: DesignationUpdate):
        update_data = data.model_dump(exclude_unset=True)
        if not update_data:
            return await DesignationService.get_by_id(item_id)
            
        updated_item = await DesignationRepository.update(item_id, update_data)
        if not updated_item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Designation not found")
        return updated_item

    @staticmethod
    async def delete(item_id: str):
        success = await DesignationRepository.delete(item_id)
        if not success:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Designation not found")
        return {"detail": "Designation deleted successfully"}
