from typing import Optional
from fastapi import HTTPException, status
from app.repository.sub_department import SubDepartmentRepository
from app.schemas.sub_department import SubDepartmentCreate, SubDepartmentUpdate

class SubDepartmentService:
    @staticmethod
    async def create(data: SubDepartmentCreate):
        dump = data.model_dump(exclude_unset=True)
        if not dump.get("department_name") and dump.get("department_id"):
            from app.database.db import get_database
            from bson import ObjectId
            db = get_database()
            dept_id = dump["department_id"]
            dept = None
            if ObjectId.is_valid(dept_id):
                dept = await db["departments"].find_one({"_id": ObjectId(dept_id)})
            if not dept:
                dept = await db["departments"].find_one({"name": dept_id})
            if dept:
                dump["department_id"] = str(dept["_id"])
                dump["department_name"] = dept["name"]
        return await SubDepartmentRepository.create(dump)

    @staticmethod
    async def get_all(page: Optional[int] = None, limit: Optional[int] = None):
        return await SubDepartmentRepository.get_all(page, limit)

    @staticmethod
    async def get_by_id(item_id: str):
        item = await SubDepartmentRepository.get_by_id(item_id)
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SubDepartment not found")
        return item

    @staticmethod
    async def get_by_department_id(department_id: str, page: Optional[int] = None, limit: Optional[int] = None):
        return await SubDepartmentRepository.get_by_department_id(department_id, page, limit)

    @staticmethod
    async def update(item_id: str, data: SubDepartmentUpdate):
        update_data = data.model_dump(exclude_unset=True)
        if not update_data:
            return await SubDepartmentService.get_by_id(item_id)

        if update_data.get("department_id") and not update_data.get("department_name"):
            from app.database.db import get_database
            from bson import ObjectId
            db = get_database()
            dept_id = update_data["department_id"]
            dept = None
            if ObjectId.is_valid(dept_id):
                dept = await db["departments"].find_one({"_id": ObjectId(dept_id)})
            if not dept:
                dept = await db["departments"].find_one({"name": dept_id})
            if dept:
                update_data["department_id"] = str(dept["_id"])
                update_data["department_name"] = dept["name"]

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
