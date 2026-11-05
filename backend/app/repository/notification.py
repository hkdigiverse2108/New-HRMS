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
        """Send push notification to user's devices with sender's avatar if available, otherwise default icon"""
        try:
            db = get_database()
            sender_photo = notification.get("icon") or notification.get("sender_avatar")
            
            # If not provided directly in notification, check sender_id
            sender_id = notification.get("sender_id") or notification.get("created_by")
            if not sender_photo and sender_id and ObjectId.is_valid(str(sender_id)):
                sender = await db["employees"].find_one({"_id": ObjectId(str(sender_id))})
                if sender:
                    p_info = sender.get("personal_info", {}) if isinstance(sender.get("personal_info"), dict) else {}
                    sender_photo = (
                        sender.get("avatar") or 
                        sender.get("profile_photo") or 
                        p_info.get("profile_photo") or 
                        p_info.get("avatar")
                    )
            
            action_url = notification.get("action_url")
            ntype = str(notification.get("type", "general")).lower()
            title = str(notification.get("title", "")).lower()

            # If action_url is missing or defaults to invalid /notifications, resolve intelligently
            if not action_url or action_url.strip() in ("", "/notifications"):
                if "chat" in ntype or "chat" in title or "message" in ntype:
                    cid = (
                        notification.get("data", {}).get("channel_id")
                        if isinstance(notification.get("data"), dict)
                        else None
                    ) or notification.get("channel_id")
                    action_url = f"/chat?channel={cid}" if cid else "/chat"
                elif "task" in ntype or "task" in title:
                    action_url = "/tasks"
                elif "leave" in ntype or "leave" in title:
                    action_url = "/employees/leave-requests"
                elif "attendance" in ntype or "punch" in ntype or "attendance" in title:
                    action_url = "/employees/attendance"
                elif "overtime" in ntype or "overtime" in title:
                    action_url = "/employees/overtime"
                elif "penalty" in ntype or "warning" in ntype or "penalty" in title:
                    action_url = "/penalty"
                elif "payroll" in ntype or "payslip" in ntype or "salary" in ntype:
                    action_url = "/payroll/payslips"
                elif "progress" in ntype or "daily" in ntype:
                    action_url = "/approvals/daily-progress"
                elif "remark" in ntype or "reminder" in ntype or "feedback" in ntype:
                    action_url = "/remarks"
                elif "project" in ntype or "client" in ntype:
                    action_url = "/work/projects"
                elif "interview" in ntype or "recruitment" in ntype or "hiring" in ntype:
                    action_url = "/recruitment/interviews"
                elif "invoice" in ntype:
                    action_url = "/invoice/all"
                elif "summon" in ntype or "meeting" in ntype:
                    action_url = "/?meeting_summon=1"
                else:
                    action_url = "/dashboard"

            extra_data = notification.get("data") if isinstance(notification.get("data"), dict) else {}

            await send_push_to_user(
                user_id=user_id,
                title=notification.get("title", "Notification"),
                body=notification.get("message", ""),
                icon=sender_photo,
                action_url=action_url,
                data={
                    "notificationId": str(notification.get("id") or notification.get("_id", "")),
                    "type": notification.get("type", "general"),
                    "url": action_url,
                    **extra_data,
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
