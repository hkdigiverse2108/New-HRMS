from collections import defaultdict
from app.database.db import get_database
from bson import ObjectId
from typing import Optional, List


class SalaryRevisionRepository:
    collection_name = "salary_revisions"

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
    async def create(cls, data: dict) -> dict:
        collection = await cls.get_collection()
        result = await collection.insert_one(data)
        data["_id"] = str(result.inserted_id)
        return data

    @classmethod
    async def get_by_id(cls, rev_id: str) -> Optional[dict]:
        if not ObjectId.is_valid(str(rev_id)):
            return None
        collection = await cls.get_collection()
        return cls._clean(await collection.find_one({"_id": ObjectId(str(rev_id))}))

    @classmethod
    async def update(cls, rev_id: str, update_data: dict) -> Optional[dict]:
        if not ObjectId.is_valid(str(rev_id)):
            return None
        collection = await cls.get_collection()
        await collection.update_one({"_id": ObjectId(str(rev_id))}, {"$set": update_data})
        return await cls.get_by_id(rev_id)

    @classmethod
    async def list_by_employee(cls, employee_id: str) -> List[dict]:
        collection = await cls.get_collection()
        cursor = collection.find({"employee_id": employee_id}).sort([("created_at", -1)])
        return [cls._clean(doc) async for doc in cursor]

    @classmethod
    async def list_by_status(cls, status: str) -> List[dict]:
        collection = await cls.get_collection()
        return [cls._clean(doc) async for doc in collection.find({"status": status})]

    @classmethod
    async def get_pending_for_employee(cls, employee_id: str) -> Optional[dict]:
        collection = await cls.get_collection()
        return cls._clean(await collection.find_one({"employee_id": employee_id, "status": "pending"}))

    @classmethod
    async def get_latest_approved_effective(cls, employee_id: str, on_date: str) -> Optional[dict]:
        """Most recently approved revision among those effective (YYYY-MM-DD) on or before on_date."""
        collection = await cls.get_collection()
        doc = await collection.find_one(
            {"employee_id": employee_id, "status": "approved", "effective_date": {"$lte": on_date}},
            sort=[("approved_at", -1), ("created_at", -1)],
        )
        return cls._clean(doc)

    @classmethod
    async def list_current_approved(cls, on_date: str) -> dict:
        """Map employee_id -> most recently approved revision effective on or before on_date."""
        collection = await cls.get_collection()
        cursor = collection.find({"status": "approved", "effective_date": {"$lte": on_date}}).sort(
            [("approved_at", 1), ("created_at", 1)]
        )
        current = {}
        async for doc in cursor:
            current[doc["employee_id"]] = cls._clean(doc)
        return current

    @classmethod
    async def list_approved_timeline(cls, on_date: str) -> dict:
        """Map employee_id -> every approved revision effective on or before on_date, in approval order."""
        collection = await cls.get_collection()
        cursor = collection.find({"status": "approved", "effective_date": {"$lte": on_date}}).sort(
            [("approved_at", 1), ("created_at", 1)]
        )
        timeline = defaultdict(list)
        async for doc in cursor:
            timeline[doc["employee_id"]].append(cls._clean(doc))
        return timeline

    @classmethod
    async def count_approved_between(cls, start_date: str, end_date: str) -> int:
        collection = await cls.get_collection()
        return await collection.count_documents(
            {"status": "approved", "effective_date": {"$gte": start_date, "$lte": end_date}}
        )
