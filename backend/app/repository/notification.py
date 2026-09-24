from app.database.db import get_database
from bson import ObjectId
from typing import Optional, List, Dict, Any
from datetime import datetime

def serialize_mongo(data: Any) -> Any:
    if isinstance(data, list):
        return [serialize_mongo(item) for item in data]
    if isinstance(data, dict):
        res = {}
        for k, v in data.items():
            if isinstance(v, ObjectId):
                res[k] = str(v)
            elif isinstance(v, (dict, list)):
                res[k] = serialize_mongo(v)
            else:
                res[k] = v
        if "_id" in res:
            res["id"] = str(res["_id"])
            res["_id"] = str(res["_id"])
        return res
    if isinstance(data, ObjectId):
        return str(data)
    return data

class NotificationRepository:
    collection_name = "notifications"

    @classmethod
    async def get_collection(cls):
        db = get_database()
        return db[cls.collection_name]

    @classmethod
    async def create_notification(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        collection = await cls.get_collection()
        now = datetime.utcnow()
        doc = {
            **data,
            "created_at": now,
            "updated_at": now
        }
        result = await collection.insert_one(doc)
        doc["_id"] = result.inserted_id
        return serialize_mongo(doc)

    @classmethod
    async def get_notifications_for_user(cls, user_id: str) -> List[Dict[str, Any]]:
        collection = await cls.get_collection()
        cursor = collection.find({"recipient_id": user_id}).sort("created_at", -1).limit(50)
        records = []
        async for doc in cursor:
            records.append(serialize_mongo(doc))
        return records

    @classmethod
    async def mark_as_read(cls, notification_id: str, user_id: str) -> bool:
        collection = await cls.get_collection()
        result = await collection.update_one(
            {"_id": ObjectId(notification_id), "recipient_id": user_id},
            {"$set": {"is_read": True, "updated_at": datetime.utcnow()}}
        )
        return result.modified_count > 0

    @classmethod
    async def mark_all_as_read(cls, user_id: str) -> int:
        collection = await cls.get_collection()
        result = await collection.update_many(
            {"recipient_id": user_id, "is_read": False},
            {"$set": {"is_read": True, "updated_at": datetime.utcnow()}}
        )
        return result.modified_count
