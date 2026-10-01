from app.database.db import get_database
from datetime import datetime
from bson import ObjectId
from typing import Optional

class BankAccountRepository:
    collection_name = "bank_accounts"

    @classmethod
    async def get_collection(cls):
        db = get_database()
        return db[cls.collection_name]

    @classmethod
    async def create(cls, data: dict):
        collection = await cls.get_collection()
        data["created_at"] = datetime.utcnow()
        data["updated_at"] = datetime.utcnow()
        data["is_deleted"] = False

        if data.get("is_default"):
            await collection.update_many({}, {"$set": {"is_default": False}})

        result = await collection.insert_one(data)
        data["_id"] = str(result.inserted_id)
        return data

    @classmethod
    async def get_all(cls, is_deleted: bool = False, page: Optional[int] = None, limit: Optional[int] = None):
        collection = await cls.get_collection()
        query = {"is_deleted": is_deleted}
        total_count = await collection.count_documents(query)
        cursor = collection.find(query).sort("created_at", -1)

        if page and limit:
            skip = (page - 1) * limit
            cursor = cursor.skip(skip).limit(limit)

        items = await cursor.to_list(length=limit or 1000)
        for item in items:
            item["_id"] = str(item["_id"])

        if page and limit:
            return {
                "data": items,
                "total": total_count,
                "page": page,
                "limit": limit,
                "total_pages": (total_count + limit - 1) // limit
            }
        return items

    @classmethod
    async def get_by_id(cls, account_id: str):
        collection = await cls.get_collection()
        if not ObjectId.is_valid(account_id):
            return None
        item = await collection.find_one({"_id": ObjectId(account_id), "is_deleted": False})
        if item:
            item["_id"] = str(item["_id"])
        return item

    @classmethod
    async def get_by_nickname(cls, nickname: str):
        collection = await cls.get_collection()
        item = await collection.find_one({
            "nickname": {"$regex": f"^{nickname.strip()}$", "$options": "i"},
            "is_deleted": False
        })
        if item:
            item["_id"] = str(item["_id"])
        return item

    @classmethod
    async def get_default(cls):
        collection = await cls.get_collection()
        item = await collection.find_one({"is_default": True, "is_deleted": False})
        if not item:
            item = await collection.find_one({"is_deleted": False})
        if item:
            item["_id"] = str(item["_id"])
        return item

    @classmethod
    async def update(cls, account_id: str, data: dict):
        collection = await cls.get_collection()
        if not ObjectId.is_valid(account_id):
            return False

        data["updated_at"] = datetime.utcnow()

        if data.get("is_default"):
            await collection.update_many({"_id": {"$ne": ObjectId(account_id)}}, {"$set": {"is_default": False}})

        result = await collection.update_one(
            {"_id": ObjectId(account_id)},
            {"$set": data}
        )
        return result.modified_count > 0 or result.matched_count > 0

    @classmethod
    async def delete(cls, account_id: str):
        collection = await cls.get_collection()
        if not ObjectId.is_valid(account_id):
            return False

        result = await collection.update_one(
            {"_id": ObjectId(account_id)},
            {"$set": {"is_deleted": True, "updated_at": datetime.utcnow()}}
        )
        return result.modified_count > 0 or result.matched_count > 0
