from app.database.db import get_database
from bson import ObjectId
from typing import Optional
from datetime import datetime

class DepartmentRepository:
    collection_name = "departments"

    @classmethod
    async def get_collection(cls):
        db = get_database()
        return db[cls.collection_name]

    @classmethod
    async def create(cls, data: dict):
        collection = await cls.get_collection()
        data["is_deleted"] = False
        result = await collection.insert_one(data)
        data["_id"] = str(result.inserted_id)
        return data

    @classmethod
    async def get_all(cls, page: Optional[int] = None, limit: Optional[int] = None):
        collection = await cls.get_collection()
        total = await collection.count_documents({"is_deleted": {"$ne": True}})
        items = []
        if limit is None or limit <= 0 or page is None:
            async for item in collection.find({"is_deleted": {"$ne": True}}):
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
            async for item in collection.find({"is_deleted": {"$ne": True}}).skip(skip).limit(limit):
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
            item = await collection.find_one({"_id": ObjectId(item_id), "is_deleted": {"$ne": True}})
            if item:
                item["_id"] = str(item["_id"])
            return item
        except Exception:
            return None

    @classmethod
    async def get_by_id_or_name(cls, query_str: str):
        if not query_str:
            return None
        collection = await cls.get_collection()
        try:
            item = await collection.find_one({"_id": ObjectId(query_str), "is_deleted": {"$ne": True}})
            if item:
                item["_id"] = str(item["_id"])
                return item
        except Exception:
            pass

        def clean(s: str) -> str:
            return str(s).lower().replace(" ", "").replace("-", "").replace("_", "")

        target = clean(query_str)
        async for item in collection.find({"is_deleted": {"$ne": True}}):
            dept_name = item.get("department_name") or item.get("name")
            if dept_name and clean(dept_name) == target:
                item["_id"] = str(item["_id"])
                return item

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
            result = await collection.update_one(
                {"_id": ObjectId(item_id), "is_deleted": {"$ne": True}},
                {"$set": {"is_deleted": True, "updated_at": datetime.utcnow()}}
            )
            return result.modified_count > 0
        except Exception:
            return False
