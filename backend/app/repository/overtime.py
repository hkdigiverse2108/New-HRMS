from bson import ObjectId
from typing import Optional, List, Dict, Any
from app.database.db import get_database


class OvertimeRepository:
    collection_name = "overtime_requests"

    @classmethod
    async def get_collection(cls):
        return get_database()[cls.collection_name]

    @staticmethod
    def _clean(doc: Optional[dict]) -> Optional[dict]:
        if doc:
            doc["_id"] = str(doc["_id"])
        return doc

    @classmethod
    async def create(cls, data: dict) -> Dict[str, Any]:
        collection = await cls.get_collection()
        res = await collection.insert_one(data)
        return await cls.get_by_id(str(res.inserted_id))

    @classmethod
    async def get_by_id(cls, request_id: str) -> Optional[Dict[str, Any]]:
        if not ObjectId.is_valid(str(request_id)):
            return None
        collection = await cls.get_collection()
        return cls._clean(await collection.find_one({"_id": ObjectId(str(request_id))}))

    @classmethod
    async def find_active_for_day(cls, employee_id: str, date: str) -> Optional[Dict[str, Any]]:
        """A pending or approved request of this employee for this day (one per day)."""
        collection = await cls.get_collection()
        return cls._clean(await collection.find_one(
            {"employee_id": employee_id, "date": date, "status": {"$in": ["Pending", "Approved"]}}
        ))

    @classmethod
    async def list(cls, employee_id: Optional[str] = None, status: Optional[str] = None,
                   start: Optional[str] = None, end: Optional[str] = None) -> List[Dict[str, Any]]:
        collection = await cls.get_collection()
        query: Dict[str, Any] = {}
        if employee_id:
            query["employee_id"] = employee_id
        if status:
            query["status"] = status
        if start or end:
            query["date"] = {k: v for k, v in (("$gte", start), ("$lte", end)) if v}
        cursor = collection.find(query).sort([("date", -1), ("_id", -1)])
        return [cls._clean(doc) async for doc in cursor]

    @classmethod
    async def update(cls, request_id: str, data: dict) -> Optional[Dict[str, Any]]:
        collection = await cls.get_collection()
        await collection.update_one({"_id": ObjectId(str(request_id))}, {"$set": data})
        return await cls.get_by_id(request_id)

    @classmethod
    async def delete(cls, request_id: str) -> None:
        collection = await cls.get_collection()
        await collection.delete_one({"_id": ObjectId(str(request_id))})
