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
        result = await collection.insert_one(data)
        data["_id"] = str(result.inserted_id)
        return data

    @classmethod
    async def get_all(cls, page: int = 1, limit: int = 10):
        collection = await cls.get_collection()
        skip = (page - 1) * limit
        total = await collection.count_documents({})
        items = []
        async for item in collection.find().skip(skip).limit(limit):
            item["_id"] = str(item["_id"])
            items.append(item)
        return {
            "data": items,
            "total": total,
            "page": page,
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
    async def get_by_department_id(cls, department_id: str, page: int = 1, limit: int = 10):
        collection = await cls.get_collection()
        skip = (page - 1) * limit
        total = await collection.count_documents({"department_id": department_id})
        items = []
        async for item in collection.find({"department_id": department_id}).skip(skip).limit(limit):
            item["_id"] = str(item["_id"])
            items.append(item)
        return {
            "data": items,
            "total": total,
            "page": page,
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
            result = await collection.delete_one({"_id": ObjectId(item_id)})
            return result.deleted_count > 0
        except Exception:
            return False
