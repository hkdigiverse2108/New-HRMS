from app.database.db import get_database
from bson import ObjectId
from typing import Optional, List


class BonusDeductionRepository:
    collection_name = "bonus_deductions"

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
    async def next_ref(cls) -> str:
        collection = await cls.get_collection()
        return f"BD-{1001 + await collection.count_documents({})}"

    @classmethod
    async def get_by_id(cls, entry_id: str) -> Optional[dict]:
        if not ObjectId.is_valid(str(entry_id)):
            return None
        collection = await cls.get_collection()
        return cls._clean(await collection.find_one({"_id": ObjectId(str(entry_id))}))

    @classmethod
    async def update(cls, entry_id: str, update_data: dict) -> Optional[dict]:
        if not ObjectId.is_valid(str(entry_id)):
            return None
        collection = await cls.get_collection()
        await collection.update_one({"_id": ObjectId(str(entry_id))}, {"$set": update_data})
        return await cls.get_by_id(entry_id)

    @classmethod
    async def list_between(cls, start_date: str, end_date: str) -> List[dict]:
        """Entries whose payroll date (YYYY-MM-DD) falls within [start_date, end_date]."""
        collection = await cls.get_collection()
        cursor = collection.find({"date": {"$gte": start_date, "$lte": end_date}}).sort([("created_at", -1)])
        return [cls._clean(doc) async for doc in cursor]
