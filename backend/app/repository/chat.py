from app.database.db import get_database
from bson import ObjectId
from typing import Dict, Any, List, Optional
from datetime import datetime
import pymongo

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

class ChatRepository:
    channels_collection = "chat_channels"
    messages_collection = "chat_messages"
    presence_collection = "chat_presence"

    @classmethod
    async def get_db(cls):
        return get_database()

    # --- Channels ---
    @classmethod
    async def create_channel(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        db = await cls.get_db()
        now = datetime.utcnow()
        doc = {**data, "created_at": now}
        result = await db[cls.channels_collection].insert_one(doc)
        doc["_id"] = result.inserted_id
        return serialize_mongo(doc)

    @classmethod
    async def get_channels_for_user(cls, user_id: str) -> List[Dict[str, Any]]:
        db = await cls.get_db()

        # Check if self channel exists for this user, if not create it automatically
        self_ch = await db[cls.channels_collection].find_one({"type": "self", "members": [user_id]})
        if not self_ch:
            self_doc = {
                "name": "You (Message Yourself)",
                "type": "self",
                "members": [user_id],
                "created_by": user_id,
                "created_at": datetime.utcnow()
            }
            await db[cls.channels_collection].insert_one(self_doc)

        cursor = db[cls.channels_collection].find({"members": user_id}).sort("created_at", -1)
        raw_channels = await cursor.to_list(length=100)
        channels = serialize_mongo(raw_channels)
        
        for ch in channels:
            ch_id = str(ch.get("id") or ch.get("_id"))
            
            # Fetch last message
            last_msg_doc = await db[cls.messages_collection].find_one(
                {"channel_id": ch_id},
                sort=[("timestamp", pymongo.DESCENDING)]
            )
            
            if last_msg_doc:
                ch["last_message"] = {
                    "content": last_msg_doc.get("content", ""),
                    "sender_id": str(last_msg_doc.get("sender_id", "")),
                    "message_type": last_msg_doc.get("message_type", "text"),
                    "timestamp": last_msg_doc.get("timestamp")
                }
            else:
                ch["last_message"] = None
                
            # Count unread messages for this user
            unread_count = await db[cls.messages_collection].count_documents({
                "channel_id": ch_id,
                "sender_id": {"$ne": user_id},
                "is_read_by": {"$ne": user_id}
            })
            ch["unread_count"] = unread_count

        # Sort channels by last message timestamp (or created_at if no messages yet)
        def get_sort_key(c):
            lm = c.get("last_message")
            if lm and lm.get("timestamp"):
                return lm["timestamp"]
            return c.get("created_at") or datetime.min

        channels.sort(key=get_sort_key, reverse=True)
        return channels

    @classmethod
    async def get_channel_by_id(cls, channel_id: str) -> Optional[Dict[str, Any]]:
        db = await cls.get_db()
        doc = await db[cls.channels_collection].find_one({"_id": ObjectId(channel_id)})
        return serialize_mongo(doc) if doc else None

    @classmethod
    async def get_direct_channel(cls, user1: str, user2: str) -> Optional[Dict[str, Any]]:
        db = await cls.get_db()
        if user1 == user2:
            doc = await db[cls.channels_collection].find_one({"type": "self", "members": [user1]})
            if not doc:
                doc = {
                    "name": "You (Message Yourself)",
                    "type": "self",
                    "members": [user1],
                    "created_by": user1,
                    "created_at": datetime.utcnow()
                }
                res = await db[cls.channels_collection].insert_one(doc)
                doc["_id"] = res.inserted_id
            return serialize_mongo(doc)

        doc = await db[cls.channels_collection].find_one({
            "type": "direct",
            "members": {"$all": [user1, user2], "$size": 2}
        })
        return serialize_mongo(doc) if doc else None

    @classmethod
    async def update_channel(cls, channel_id: str, data: Dict[str, Any], user_id: str) -> bool:
        db = await cls.get_db()
        result = await db[cls.channels_collection].update_one(
            {"_id": ObjectId(channel_id), "members": user_id},
            {"$set": data}
        )
        return result.modified_count > 0

    @classmethod
    async def delete_channel(cls, channel_id: str, user_id: str) -> bool:
        db = await cls.get_db()
        result = await db[cls.channels_collection].delete_one(
            {"_id": ObjectId(channel_id), "created_by": user_id}
        )
        return result.deleted_count > 0

    @classmethod
    async def add_member_to_channel(cls, channel_id: str, new_member_id: str) -> bool:
        db = await cls.get_db()
        result = await db[cls.channels_collection].update_one(
            {"_id": ObjectId(channel_id)},
            {"$addToSet": {"members": new_member_id}}
        )
        return result.modified_count > 0

    @classmethod
    async def remove_member_from_channel(cls, channel_id: str, member_id: str) -> bool:
        db = await cls.get_db()
        result = await db[cls.channels_collection].update_one(
            {"_id": ObjectId(channel_id)},
            {"$pull": {"members": member_id}}
        )
        return result.modified_count > 0

    # --- Messages ---
    @classmethod
    async def save_message(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        db = await cls.get_db()
        now = datetime.utcnow()
        doc = {**data, "timestamp": now, "is_read_by": [data.get("sender_id")]}

        # Resolve reply_to if reply_to_id is provided
        reply_to_id = data.get("reply_to_id")
        if reply_to_id and "reply_to" not in doc:
            try:
                parent_msg = await db[cls.messages_collection].find_one({"_id": ObjectId(reply_to_id)})
                if parent_msg:
                    doc["reply_to"] = {
                        "message_id": str(parent_msg["_id"]),
                        "content": parent_msg.get("content", ""),
                        "sender_id": str(parent_msg.get("sender_id", "")),
                        "message_type": parent_msg.get("message_type", "text")
                    }
            except Exception:
                pass

        result = await db[cls.messages_collection].insert_one(doc)
        doc["_id"] = result.inserted_id
        return serialize_mongo(doc)

    @classmethod
    async def get_messages(cls, channel_id: str, limit: int = 30, skip: int = 0) -> List[Dict[str, Any]]:
        db = await cls.get_db()
        cursor = db[cls.messages_collection].find(
            {"channel_id": channel_id}
        ).sort("timestamp", -1).skip(skip).limit(limit)
        docs = await cursor.to_list(length=limit)
        return serialize_mongo(docs)

    @classmethod
    async def mark_messages_read(cls, channel_id: str, user_id: str):
        db = await cls.get_db()
        await db[cls.messages_collection].update_many(
            {"channel_id": channel_id, "is_read_by": {"$ne": user_id}},
            {"$addToSet": {"is_read_by": user_id}}
        )

    @classmethod
    async def vote_poll_option(cls, message_id: str, option_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        db = await cls.get_db()
        try:
            msg_id_obj = ObjectId(message_id)
        except Exception:
            return None

        msg = await db[cls.messages_collection].find_one({"_id": msg_id_obj})
        if not msg or msg.get("message_type") != "poll" or "poll" not in msg:
            return None

        poll = msg["poll"]
        options = poll.get("options", [])
        allow_multiple = poll.get("allow_multiple_answers", False)

        target_opt = None
        for opt in options:
            if opt.get("id") == option_id:
                target_opt = opt
                break
        
        if not target_opt:
            return None

        voters = target_opt.get("voters", [])
        if user_id in voters:
            voters.remove(user_id)
        else:
            if not allow_multiple:
                for opt in options:
                    if user_id in opt.get("voters", []):
                        opt["voters"].remove(user_id)
            voters.append(user_id)

        target_opt["voters"] = voters

        await db[cls.messages_collection].update_one(
            {"_id": msg_id_obj},
            {"$set": {"poll.options": options}}
        )

        msg["poll"]["options"] = options
        return serialize_mongo(msg)

    @classmethod
    def sanitize_poll_for_user(cls, message_doc: Dict[str, Any], user_id: str) -> Dict[str, Any]:
        if not message_doc:
            return message_doc
        
        import copy
        sanitized_msg = copy.deepcopy(message_doc)
        sanitized_msg["is_saved"] = user_id in sanitized_msg.get("saved_by", [])

        if sanitized_msg.get("message_type") == "poll" and "poll" in sanitized_msg:
            poll = sanitized_msg.get("poll", {})
            hide_names = poll.get("hide_voters_name", False)
            created_by = poll.get("created_by") or sanitized_msg.get("sender_id")

            if hide_names and str(user_id) != str(created_by):
                for opt in poll.get("options", []):
                    voters_list = opt.get("voters", [])
                    opt["voters_count"] = len(voters_list)
                    opt["user_has_voted"] = user_id in voters_list
                    opt["voters"] = [] # Hide voter names/IDs from non-creators

        return sanitized_msg

    @classmethod
    async def toggle_save_message(cls, message_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        db = await cls.get_db()
        try:
            msg_id_obj = ObjectId(message_id)
        except Exception:
            return None

        msg = await db[cls.messages_collection].find_one({"_id": msg_id_obj})
        if not msg:
            return None

        saved_by = msg.get("saved_by", [])
        if user_id in saved_by:
            # Remove from saved
            await db[cls.messages_collection].update_one(
                {"_id": msg_id_obj},
                {"$pull": {"saved_by": user_id}}
            )
            saved_by.remove(user_id)
        else:
            # Add to saved
            await db[cls.messages_collection].update_one(
                {"_id": msg_id_obj},
                {"$addToSet": {"saved_by": user_id}}
            )
            saved_by.append(user_id)

        msg["saved_by"] = saved_by
        return cls.sanitize_poll_for_user(serialize_mongo(msg), user_id)

    @classmethod
    async def get_saved_messages(cls, user_id: str, limit: int = 50, skip: int = 0) -> List[Dict[str, Any]]:
        db = await cls.get_db()
        cursor = db[cls.messages_collection].find({
            "saved_by": user_id
        }).sort("timestamp", -1).skip(skip).limit(limit)
        docs = await cursor.to_list(length=limit)
        return [cls.sanitize_poll_for_user(serialize_mongo(doc), user_id) for doc in docs]

    @classmethod
    async def update_user_presence(cls, user_id: str, is_online: bool) -> Dict[str, Any]:
        db = await cls.get_db()
        now = datetime.utcnow()
        doc = {
            "user_id": user_id,
            "is_online": is_online,
            "last_seen": now
        }
        await db[cls.presence_collection].update_one(
            {"user_id": user_id},
            {"$set": doc},
            upsert=True
        )
        return serialize_mongo(doc)

    @classmethod
    async def get_user_presence(cls, user_id: str) -> Dict[str, Any]:
        db = await cls.get_db()
        doc = await db[cls.presence_collection].find_one({"user_id": user_id})
        if not doc:
            return {
                "user_id": user_id,
                "is_online": False,
                "last_seen": None
            }
        return serialize_mongo(doc)

    @classmethod
    async def get_batch_user_presence(cls, user_ids: List[str]) -> List[Dict[str, Any]]:
        db = await cls.get_db()
        cursor = db[cls.presence_collection].find({"user_id": {"$in": user_ids}})
        docs = await cursor.to_list(length=len(user_ids))
        found_map = {doc["user_id"]: serialize_mongo(doc) for doc in docs}
        
        result = []
        for uid in user_ids:
            if uid in found_map:
                result.append(found_map[uid])
            else:
                result.append({
                    "user_id": uid,
                    "is_online": False,
                    "last_seen": None
                })
        return result


    @classmethod
    async def toggle_pin_message(cls, message_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        db = await cls.get_db()
        try:
            msg_id_obj = ObjectId(message_id)
        except Exception:
            return None

        msg = await db[cls.messages_collection].find_one({"_id": msg_id_obj})
        if not msg:
            return None

        new_pinned_state = not msg.get("is_pinned", False)
        now = datetime.utcnow()
        update_doc = {
            "is_pinned": new_pinned_state,
            "pinned_by": user_id if new_pinned_state else None,
            "pinned_at": now if new_pinned_state else None
        }

        await db[cls.messages_collection].update_one(
            {"_id": msg_id_obj},
            {"$set": update_doc}
        )

        msg["is_pinned"] = new_pinned_state
        msg["pinned_by"] = user_id if new_pinned_state else None
        msg["pinned_at"] = now if new_pinned_state else None
        return serialize_mongo(msg)

    @classmethod
    async def get_pinned_messages(cls, channel_id: str) -> List[Dict[str, Any]]:
        db = await cls.get_db()
        cursor = db[cls.messages_collection].find({
            "channel_id": channel_id,
            "is_pinned": True
        }).sort("pinned_at", -1)
        docs = await cursor.to_list(length=50)
        return serialize_mongo(docs)

    @classmethod
    async def search_messages(cls, channel_id: str, query: str, limit: int = 50) -> List[Dict[str, Any]]:
        db = await cls.get_db()
        import re
        regex = re.compile(re.escape(query), re.IGNORECASE)
        cursor = db[cls.messages_collection].find({
            "channel_id": channel_id,
            "$or": [
                {"content": {"$regex": regex}},
                {"file_name": {"$regex": regex}},
                {"poll.question": {"$regex": regex}}
            ]
        }).sort("timestamp", -1).limit(limit)
        docs = await cursor.to_list(length=limit)
        return serialize_mongo(docs)

    @classmethod
    async def get_shared_media(cls, channel_id: str, media_type: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        db = await cls.get_db()
        query: Dict[str, Any] = {"channel_id": channel_id}
        
        if media_type == "docs":
            query["message_type"] = "file"
        elif media_type == "audio":
            query["message_type"] = "audio"
        elif media_type == "links":
            query["message_type"] = "link"
        else:
            query["$or"] = [
                {"message_type": {"$in": ["file", "audio", "link"]}},
                {"file_url": {"$ne": None}}
            ]
            
        cursor = db[cls.messages_collection].find(query).sort("timestamp", -1).limit(limit)
        docs = await cursor.to_list(length=limit)
        return serialize_mongo(docs)

    @classmethod
    async def get_unread_counts_for_user(cls, user_id: str) -> List[Dict[str, Any]]:
        db = await cls.get_db()
        channels = await cls.get_channels_for_user(user_id)
        results = []
        for ch in channels:
            ch_id = ch["id"]
            unread_count = await db[cls.messages_collection].count_documents({
                "channel_id": ch_id,
                "sender_id": {"$ne": user_id},
                "is_read_by": {"$ne": user_id}
            })
            results.append({
                "channel_id": ch_id,
                "channel_name": ch.get("name", "Chat"),
                "unread_count": unread_count
            })
        return results

    @classmethod
    async def get_user_profile_card(cls, user_id: str) -> Dict[str, Any]:
        presence = await cls.get_user_presence(user_id)
        db = await cls.get_db()
        
        # Try finding employee in employees collection
        emp_doc = None
        try:
            if len(user_id) == 24 and all(c in "0123456789abcdefABCDEF" for c in user_id):
                emp_doc = await db["employees"].find_one({"_id": ObjectId(user_id)})
        except Exception:
            pass

        if not emp_doc:
            emp_doc = await db["employees"].find_one({
                "$or": [
                    {"work_details.employee_id": user_id},
                    {"personal_info.email_address": user_id},
                    {"email": user_id}
                ]
            })

        name = "Employee"
        profile_photo = None
        designation = "N/A"
        department = "N/A"
        system_role = "Employee"
        email = None
        phone = None
        work_mode = None

        if emp_doc:
            p_info = emp_doc.get("personal_info", {})
            w_details = emp_doc.get("work_details", {})
            
            first_name = p_info.get("first_name", "") or emp_doc.get("first_name", "")
            last_name = p_info.get("last_name", "") or emp_doc.get("last_name", "")
            if first_name or last_name:
                name = f"{first_name} {last_name}".strip()
            elif emp_doc.get("name"):
                name = emp_doc.get("name")

            profile_photo = emp_doc.get("profile_photo") or p_info.get("profile_photo") or emp_doc.get("avatar")
            designation = w_details.get("designation") or emp_doc.get("designation") or "N/A"
            department = w_details.get("department") or emp_doc.get("department") or "N/A"
            system_role = w_details.get("system_role") or emp_doc.get("role") or "Employee"
            email = p_info.get("email_address") or emp_doc.get("email")
            phone = p_info.get("phone_number") or emp_doc.get("phone")
            work_mode = w_details.get("work_mode") or emp_doc.get("work_mode")

        return {
            "user_id": user_id,
            "name": name,
            "profile_photo": profile_photo,
            "designation": designation,
            "department": department,
            "system_role": system_role,
            "email": email,
            "phone": phone,
            "work_mode": work_mode,
            "is_online": presence.get("is_online", False),
            "last_seen": presence.get("last_seen")
        }

    @classmethod
    async def toggle_message_reaction(cls, message_id: str, emoji: str, user_id: str) -> Optional[Dict[str, Any]]:
        db = await cls.get_db()
        try:
            msg_id_obj = ObjectId(message_id)
        except Exception:
            return None

        msg = await db[cls.messages_collection].find_one({"_id": msg_id_obj})
        if not msg:
            return None

        reactions = msg.get("reactions", [])
        
        found_reaction = None
        for r in reactions:
            if r.get("emoji") == emoji:
                found_reaction = r
                break

        if found_reaction:
            users = found_reaction.get("users", [])
            if user_id in users:
                users.remove(user_id)
            else:
                users.append(user_id)
            found_reaction["users"] = users
        else:
            reactions.append({
                "emoji": emoji,
                "users": [user_id]
            })

        # Remove empty reaction items
        reactions = [r for r in reactions if r.get("users") and len(r.get("users")) > 0]

        await db[cls.messages_collection].update_one(
            {"_id": msg_id_obj},
            {"$set": {"reactions": reactions}}
        )

        msg["reactions"] = reactions
        return cls.sanitize_poll_for_user(serialize_mongo(msg), user_id)

    @classmethod
    async def forward_messages(
        cls,
        message_ids: List[str],
        target_channel_id: Optional[str],
        target_receiver_id: Optional[str],
        sender_id: str
    ) -> List[Dict[str, Any]]:
        db = await cls.get_db()
        
        channel_id = target_channel_id
        if not channel_id and target_receiver_id:
            direct_ch = await cls.get_direct_channel(sender_id, target_receiver_id)
            if not direct_ch:
                doc = {
                    "name": f"Direct: {sender_id} & {target_receiver_id}",
                    "type": "direct",
                    "members": [sender_id, target_receiver_id],
                    "created_at": datetime.utcnow()
                }
                res = await db[cls.channels_collection].insert_one(doc)
                channel_id = str(res.inserted_id)
            else:
                channel_id = str(direct_ch["id"])

        if not channel_id:
            return []

        forwarded_list = []
        for msg_id in message_ids:
            try:
                orig_msg = await db[cls.messages_collection].find_one({"_id": ObjectId(msg_id)})
            except Exception:
                orig_msg = None

            if not orig_msg:
                continue

            new_msg_data = {
                "channel_id": channel_id,
                "sender_id": sender_id,
                "content": orig_msg.get("content", ""),
                "message_type": orig_msg.get("message_type", "text"),
                "file_url": orig_msg.get("file_url"),
                "file_name": orig_msg.get("file_name"),
                "poll": orig_msg.get("poll"),
                "mentions": orig_msg.get("mentions", []),
                "is_forwarded": True
            }

            saved = await cls.save_message(new_msg_data)
            forwarded_list.append(saved)

        return forwarded_list


