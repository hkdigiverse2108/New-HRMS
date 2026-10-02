from app.database.db import get_database
from bson import ObjectId
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.utils.push_notifications import send_push_to_user

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
    async def create_notification(cls, data: Dict[str, Any], send_push: bool = True) -> Dict[str, Any]:
        collection = await cls.get_collection()
        now = datetime.utcnow()
        doc = {
            **data,
            "created_at": now,
            "updated_at": now
        }
        result = await collection.insert_one(doc)
        doc["_id"] = result.inserted_id
        notification = serialize_mongo(doc)
        
        # Send push notification if enabled and user has subscriptions
        if send_push and data.get("recipient_id"):
            await cls._send_push_notification(data["recipient_id"], notification)
        
        return notification

    @classmethod
    async def _send_push_notification(cls, user_id: str, notification: Dict[str, Any]) -> None:
        """Send push notification to user's devices"""
        try:
            # Get user's profile photo for notification icon
            db = get_database()
            user = await db["employees"].find_one({"_id": ObjectId(user_id)})
            profile_photo = None
            user_name = "User"
            if user:
                profile_photo = user.get("personal_info", {}).get("profile_photo")
                first_name = user.get("personal_info", {}).get("first_name", "")
                last_name = user.get("personal_info", {}).get("last_name", "")
                user_name = f"{first_name} {last_name}".strip() or "User"
            
            action_url = notification.get("action_url") or "/notifications"
            
            await send_push_to_user(
                user_id=user_id,
                title=notification.get("title", "Notification"),
                body=notification.get("message", ""),
                icon=profile_photo,
                action_url=action_url,
                data={
                    "notificationId": notification.get("id"),
                    "type": notification.get("type", "general"),
                }
            )
        except Exception as e:
            # Log error but don't fail the notification creation
            print(f"[PUSH ERROR] Failed to send push for notification {notification.get('id')}: {e}")

    @classmethod
    async def get_notifications_for_user(cls, user_id: str) -> List[Dict[str, Any]]:
        collection = await cls.get_collection()
        pipeline = [
            {"$match": {"recipient_id": user_id}},
            {"$sort": {"created_at": -1}},
            {"$limit": 50},
            {
                "$lookup": {
                    "from": "employees",
                    "localField": "sender_id",
                    "foreignField": "_id",
                    "as": "sender"
                }
            },
            {
                "$unwind": {
                    "path": "$sender",
                    "preserveNullAndEmptyArrays": True
                }
            },
            {
                "$addFields": {
                    "sender_name": {
                        "$concat": [
                            {"$ifNull": ["$sender.personal_info.first_name", ""]},
                            " ",
                            {"$ifNull": ["$sender.personal_info.last_name", ""]}
                        ]
                    },
                    "sender_avatar": "$sender.personal_info.profile_photo"
                }
            },
            {
                "$project": {
                    "sender": 0
                }
            }
        ]
        cursor = collection.aggregate(pipeline)
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
