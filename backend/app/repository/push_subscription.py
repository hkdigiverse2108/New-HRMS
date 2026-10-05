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
        user_id = str(data["user_id"])
        endpoint = str(data["endpoint"]).strip()
        user_agent = data.get("user_agent")
        
        # 1. Check if this exact endpoint already exists
        existing = await collection.find_one({
            "user_id": user_id,
            "endpoint": endpoint
        })
        
        if existing:
            await collection.update_one(
                {"_id": existing["_id"]},
                {"$set": {
                    **data,
                    "is_active": True,
                    "updated_at": now
                }}
            )
            doc = await collection.find_one({"_id": existing["_id"]})
        else:
            # 2. Deactivate old subscriptions for this same user on the same browser/agent
            # so multiple duplicate notifications don't accumulate
            if user_agent:
                await collection.update_many(
                    {
                        "user_id": user_id,
                        "user_agent": user_agent,
                        "endpoint": {"$ne": endpoint}
                    },
                    {"$set": {"is_active": False, "updated_at": now}}
                )
            doc = {
                **data,
                "created_at": now,
                "updated_at": now,
                "is_active": True
            }
            result = await collection.insert_one(doc)
            doc["_id"] = result.inserted_id
        
        return serialize_mongo(doc)

    @classmethod
    async def get_active_subscriptions(cls, user_id: str) -> List[Dict[str, Any]]:
        collection = await cls.get_collection()
        cursor = collection.find({
            "user_id": str(user_id),
            "is_active": True
        }).sort("updated_at", -1)
        
        seen_endpoints = set()
        records = []
        async for doc in cursor:
            ep = doc.get("endpoint")
            if ep and ep not in seen_endpoints:
                seen_endpoints.add(ep)
                records.append(serialize_mongo(doc))
        return records

    @classmethod
    async def deactivate_subscription(cls, subscription_id: str, user_id: str) -> bool:
        collection = await cls.get_collection()
        query: Dict[str, Any] = {"user_id": str(user_id)}
        if ObjectId.is_valid(str(subscription_id)):
            query["_id"] = ObjectId(str(subscription_id))
        else:
            query["endpoint"] = str(subscription_id)
            
        result = await collection.update_one(
            query,
            {"$set": {"is_active": False, "updated_at": datetime.utcnow()}}
        )
        return result.modified_count > 0

    @classmethod
    async def deactivate_subscriptions(cls, subscription_ids: List[str]) -> int:
        collection = await cls.get_collection()
        valid_oids = [ObjectId(sid) for sid in subscription_ids if ObjectId.is_valid(str(sid))]
        str_ids = [str(sid) for sid in subscription_ids]
        
        result = await collection.update_many(
            {"$or": [{"_id": {"$in": valid_oids}}, {"endpoint": {"$in": str_ids}}]},
            {"$set": {"is_active": False, "updated_at": datetime.utcnow()}}
        )
        return result.modified_count

    @classmethod
    async def delete_dead_subscriptions(cls, endpoints_or_ids: List[str]) -> int:
        """Permanently remove dead/expired (410 Gone / 404) subscriptions"""
        if not endpoints_or_ids:
            return 0
        collection = await cls.get_collection()
        valid_oids = [ObjectId(sid) for sid in endpoints_or_ids if ObjectId.is_valid(str(sid))]
        str_items = [str(item) for item in endpoints_or_ids]
        
        result = await collection.delete_many({
            "$or": [
                {"_id": {"$in": valid_oids}},
                {"endpoint": {"$in": str_items}}
            ]
        })
        return result.deleted_count

    @classmethod
    async def delete_subscription(cls, subscription_id: Optional[str], user_id: str) -> bool:
        collection = await cls.get_collection()
        str_uid = str(user_id)
        
        # If 'undefined', 'null', 'all', or empty string: delete/deactivate all subscriptions for user
        if not subscription_id or str(subscription_id).strip().lower() in ("undefined", "null", "all", ""):
            await collection.delete_many({"user_id": str_uid})
            return True

        sub_str = str(subscription_id).strip()
        query: Dict[str, Any] = {"user_id": str_uid}
        if ObjectId.is_valid(sub_str):
            query["_id"] = ObjectId(sub_str)
        else:
            query["$or"] = [{"endpoint": sub_str}, {"_id": sub_str}]
            
        result = await collection.delete_one(query)
        return result.deleted_count > 0