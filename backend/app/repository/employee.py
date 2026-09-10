from app.database.db import get_database
from bson import ObjectId
from app.schemas.enums import GenderEnum, SystemRole, WorkModeEnum
from typing import Optional

class EmployeeRepository:
    collection_name = "employees"

    @classmethod
    async def get_collection(cls):
        db = get_database()
        return db[cls.collection_name]

    @classmethod
    async def create_employee(cls, employee_data: dict):
        collection = await cls.get_collection()
        result = await collection.insert_one(employee_data)
        employee_data["_id"] = str(result.inserted_id)
        return employee_data

    @classmethod
    async def get_all_employees(
        cls, 
        page: int = 1, 
        limit: int = 10,
        gender: Optional[GenderEnum] = None,
        role: Optional[SystemRole] = None,
        department: Optional[str] = None,
        is_delete: Optional[bool] = None,
        is_block: Optional[bool] = None,
        work_mode: Optional[WorkModeEnum] = None
    ):
        collection = await cls.get_collection()
        skip = (page - 1) * limit
        
        query = {}
        if gender and hasattr(gender, "value"):
            query["personal_info.gender"] = gender.value
        elif isinstance(gender, str):
            query["personal_info.gender"] = gender

        if role and hasattr(role, "value"):
            query["work_details.system_role"] = role.value
        elif isinstance(role, str):
            query["work_details.system_role"] = role

        if department and isinstance(department, str):
            query["work_details.department"] = department

        if isinstance(is_delete, bool):
            query["work_details.is_delete"] = is_delete

        if isinstance(is_block, bool):
            query["work_details.is_block"] = is_block

        if work_mode and hasattr(work_mode, "value"):
            query["work_details.work_mode"] = work_mode.value
        elif isinstance(work_mode, str):
            query["work_details.work_mode"] = work_mode
            
        total = await collection.count_documents(query)
        employees = []
        async for emp in collection.find(query).skip(skip).limit(limit):
            emp["_id"] = str(emp["_id"])
            employees.append(emp)
        return {
            "data": employees,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": (total + limit - 1) // limit if limit > 0 else 1
        }

    @classmethod
    async def get_employee_by_id(cls, employee_id: str):
        collection = await cls.get_collection()
        try:
            employee = await collection.find_one({"_id": ObjectId(employee_id)})
            if employee:
                employee["_id"] = str(employee["_id"])
            return employee
        except Exception:
            return None

    @classmethod
    async def get_employee_by_email(cls, email: str):
        collection = await cls.get_collection()
        employee = await collection.find_one({"personal_info.email_address": email})
        if employee:
            employee["_id"] = str(employee["_id"])
        return employee

    @classmethod
    async def update_employee(cls, employee_id: str, update_data: dict):
        collection = await cls.get_collection()
        try:
            await collection.update_one({"_id": ObjectId(employee_id)}, {"$set": update_data})
            return await cls.get_employee_by_id(employee_id)
        except Exception:
            return None

    @classmethod
    async def delete_employee(cls, employee_id: str):
        collection = await cls.get_collection()
        try:
            result = await collection.update_one(
                {"_id": ObjectId(employee_id)}, 
                {"$set": {"work_details.is_delete": True}}
            )
            return result.modified_count > 0
        except Exception:
            return False
