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


class PushSubscriptionRepository:
    collection_name = "push_subscriptions"

    @classmethod
    async def get_collection(cls):
        db = get_database()
        return db[cls.collection_name]

    @classmethod
    async def create_or_update_subscription(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        collection = await cls.get_collection()
        now = datetime.utcnow()
        
        existing = await collection.find_one({
            "user_id": data["user_id"],
            "endpoint": data["endpoint"]
        })
        
        if existing:
            result = await collection.update_one(
                {"_id": existing["_id"]},
                {"$set": {
                    **data,
                    "is_active": True,
                    "updated_at": now
                }}
            )
            doc = await collection.find_one({"_id": existing["_id"]})
        else:
            doc = {
                **data,
                "created_at": now,
                "updated_at": now
            }
            result = await collection.insert_one(doc)
            doc["_id"] = result.inserted_id
        
        return serialize_mongo(doc)

    @classmethod
    async def get_active_subscriptions(cls, user_id: str) -> List[Dict[str, Any]]:
        collection = await cls.get_collection()
        cursor = collection.find({
            "user_id": user_id,
            "is_active": True
        })
        records = []
        async for doc in cursor:
            records.append(serialize_mongo(doc))
        return records

    @classmethod
    async def deactivate_subscription(cls, subscription_id: str, user_id: str) -> bool:
        collection = await cls.get_collection()
        result = await collection.update_one(
            {"_id": ObjectId(subscription_id), "user_id": user_id},
            {"$set": {"is_active": False, "updated_at": datetime.utcnow()}}
        )
        return result.modified_count > 0

    @classmethod
    async def deactivate_subscriptions(cls, subscription_ids: List[str]) -> int:
        collection = await cls.get_collection()
        object_ids = [ObjectId(sid) for sid in subscription_ids]
        result = await collection.update_many(
            {"_id": {"$in": object_ids}},
            {"$set": {"is_active": False, "updated_at": datetime.utcnow()}}
        )
        return result.modified_count

    @classmethod
    async def delete_subscription(cls, subscription_id: str, user_id: str) -> bool:
        collection = await cls.get_collection()
        result = await collection.delete_one({
            "_id": ObjectId(subscription_id),
            "user_id": user_id
        })
        return result.deleted_count > 0