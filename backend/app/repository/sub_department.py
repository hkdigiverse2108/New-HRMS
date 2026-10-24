from typing import Optional
from datetime import datetime
from app.database.db import get_database
from bson import ObjectId

class SubDepartmentRepository:
    collection_name = "sub_departments"

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
    def _format_doc(cls, item: dict) -> dict:
        if not item:
            return item
        item["_id"] = str(item["_id"])
        dept_name = str(item.get("department_name") or item.get("department") or "").strip()
        dept_id = str(item.get("department_id") or dept_name).strip()
        item["department_id"] = dept_id
        item["department_name"] = dept_name
        item["department"] = dept_name
        return item

    @classmethod
    async def get_all(cls, page: Optional[int] = None, limit: Optional[int] = None):
        collection = await cls.get_collection()
        total = await collection.count_documents({"is_deleted": {"$ne": True}})
        items = []
        if limit is None or limit <= 0 or page is None:
            async for item in collection.find({"is_deleted": {"$ne": True}}):
                items.append(cls._format_doc(item))
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
                items.append(cls._format_doc(item))
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
            return cls._format_doc(item)
        except Exception:
            return None

    @classmethod
    async def get_by_department_id(cls, department_id: str, page: Optional[int] = None, limit: Optional[int] = None):
        collection = await cls.get_collection()
        dept_str = str(department_id).strip()
        db = get_database()
        dept_ids_to_match = [dept_str]

        try:
            dept_doc = await db["departments"].find_one({
                "$or": [
                    {"name": dept_str},
                    {"name": {"$regex": f"^{dept_str}$", "$options": "i"}}
                ]
            })
            if dept_doc:
                dept_ids_to_match.append(str(dept_doc["_id"]))
        except Exception:
            pass

        query = {
            "is_deleted": {"$ne": True},
            "$or": [
                {"department_id": {"$in": dept_ids_to_match}},
                {"department_name": dept_str},
                {"department_name": {"$regex": f"^{dept_str}$", "$options": "i"}}
            ]
        }
        total = await collection.count_documents(query)
        items = []
        if limit is None or limit <= 0 or page is None:
            async for item in collection.find(query):
                items.append(cls._format_doc(item))
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
            async for item in collection.find(query).skip(skip).limit(limit):
                items.append(cls._format_doc(item))
            return {
                "data": items,
                "total": total,
                "page": p,
                "limit": limit,
                "total_pages": (total + limit - 1) // limit if limit > 0 else 1
            }

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
