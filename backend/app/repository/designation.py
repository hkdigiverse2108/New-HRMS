from app.database.db import get_database
from bson import ObjectId
from typing import Optional

class DesignationRepository:
    collection_name = "designations"

    @classmethod
    async def get_collection(cls):
        db = get_database()
        return db[cls.collection_name]

    @classmethod
    async def create(cls, data: dict):
        collection = await cls.get_collection()
        result = await collection.insert_one(data)
        data["_id"] = str(result.inserted_id)
        return data

    @classmethod
    async def get_all(cls, page: Optional[int] = None, limit: Optional[int] = None):
        collection = await cls.get_collection()
        total = await collection.count_documents({})
        items = []
        if limit is None or limit <= 0 or page is None:
            async for item in collection.find():
                item["_id"] = str(item["_id"])
                items.append(item)
            return {
                "data": items,
                "total": total,
                "page": 1,
                "limit": total,
                "total_pages": 1
            }
        else:
            p = page
            skip = (p - 1) * limit
            async for item in collection.find().skip(skip).limit(limit):
                item["_id"] = str(item["_id"])
                items.append(item)
            return {
                "data": items,
                "total": total,
                "page": p,
                "limit": limit,
                "total_pages": (total + limit - 1) // limit if limit > 0 else 1
            }

    @classmethod
    async def get_by_id(cls, item_id: str):
        collection = await cls.get_collection()
        try:
            item = await collection.find_one({"_id": ObjectId(item_id)})
            if item:
                item["_id"] = str(item["_id"])
            return item
        except Exception:
            return None

    @classmethod
    async def update(cls, item_id: str, update_data: dict):
        collection = await cls.get_collection()
        try:
            await collection.update_one({"_id": ObjectId(item_id)}, {"$set": update_data})
            return await cls.get_by_id(item_id)
        except Exception:
            return None

    @classmethod
    async def delete(cls, item_id: str):
        collection = await cls.get_collection()
        try:
            result = await collection.delete_one({"_id": ObjectId(item_id)})
            return result.deleted_count > 0
        except Exception:
            return False
