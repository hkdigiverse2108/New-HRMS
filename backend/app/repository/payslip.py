from bson import ObjectId
from app.database.db import get_database
from typing import Optional, List, Dict, Any


class PayslipRepository:
    collection_name = "payslips"

    @classmethod
    async def get_collection(cls):
        db = get_database()
        return db[cls.collection_name]

    @staticmethod
    def _clean(doc: Optional[dict]) -> Optional[dict]:
        if doc:
            doc["_id"] = str(doc["_id"])
        return doc

    @classmethod
    async def upsert(cls, month: str, employee_id: str, data: dict) -> None:
        collection = await cls.get_collection()
        await collection.update_one(
            {"month": month, "employee_id": employee_id},
            {"$set": {**data, "month": month, "employee_id": employee_id}},
            upsert=True,
        )

    @classmethod
    async def get_by_id(cls, payslip_id: str) -> Optional[Dict[str, Any]]:
        if not ObjectId.is_valid(payslip_id):
            return None
        collection = await cls.get_collection()
        return cls._clean(await collection.find_one({"_id": ObjectId(payslip_id)}))

    @classmethod
    async def update_by_id(cls, payslip_id: str, data: dict) -> Optional[Dict[str, Any]]:
        collection = await cls.get_collection()
        await collection.update_one({"_id": ObjectId(payslip_id)}, {"$set": data})
        return await cls.get_by_id(payslip_id)

    @classmethod
    async def list(cls, month: str, employee_id: Optional[str] = None) -> List[Dict[str, Any]]:
        collection = await cls.get_collection()
        query = {"month": month}
        if employee_id:
            query["employee_id"] = employee_id
        cursor = collection.find(query).sort([("employee.name", 1)])
        return [cls._clean(doc) async for doc in cursor]

    @classmethod
    async def months(cls, employee_id: Optional[str] = None) -> List[str]:
        """Months (YYYY-MM) that have payslips, newest first."""
        collection = await cls.get_collection()
        months = await collection.distinct("month", {"employee_id": employee_id} if employee_id else {})
        return sorted(months, reverse=True)
