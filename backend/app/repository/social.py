from app.database.db import get_database
from bson import ObjectId
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

class SocialAccountRepository:
    collection_name = "social_ig_accounts"

    @classmethod
    async def get_collection(cls):
        db = get_database()
        return db[cls.collection_name]

    @classmethod
    async def get_all(cls, active_only: bool = False):
        col = await cls.get_collection()
        query = {"is_active": True} if active_only else {}
        cursor = col.find(query).sort("created_at", -1)
        res = []
        async for doc in cursor:
            doc["id"] = str(doc["_id"])
            res.append(doc)
        return res

    @classmethod
    async def get_by_id(cls, account_id: str):
        col = await cls.get_collection()
        doc = None
        if ObjectId.is_valid(account_id):
            doc = await col.find_one({"_id": ObjectId(account_id)})
        if not doc:
            doc = await col.find_one({"ig_account_id": account_id})
        if doc:
            doc["id"] = str(doc["_id"])
        return doc

    @classmethod
    async def get_by_ig_id(cls, ig_account_id: str):
        col = await cls.get_collection()
        doc = await col.find_one({"ig_account_id": str(ig_account_id)})
        if doc:
            doc["id"] = str(doc["_id"])
        return doc

    @classmethod
    async def get_by_username(cls, username: str):
        col = await cls.get_collection()
        clean = username.lstrip("@").strip().lower()
        doc = await col.find_one({"username_lc": clean})
        if doc:
            doc["id"] = str(doc["_id"])
        return doc

    @classmethod
    async def create(cls, data: dict):
        col = await cls.get_collection()
        now = datetime.utcnow()
        doc = {
            "ig_account_id": str(data["ig_account_id"]).strip(),
            "username": data["username"].lstrip("@").strip(),
            "username_lc": data["username"].lstrip("@").strip().lower(),
            "brand_id": data.get("brand_id"),
            "access_token_enc": data["access_token_enc"],
            "token_last4": data.get("token_last4", "****"),
            "is_active": data.get("is_active", True),
            "token_updated_at": now,
            "last_refresh_status": "ok",
            "last_webhook_at": None,
            "created_by": data.get("created_by", "system"),
            "created_at": now,
            "updated_at": now,
        }
        res = await col.insert_one(doc)
        doc["id"] = str(res.inserted_id)
        return doc

    @classmethod
    async def update(cls, account_id: str, updates: dict):
        col = await cls.get_collection()
        updates["updated_at"] = datetime.utcnow()
        if "username" in updates:
            updates["username"] = updates["username"].lstrip("@").strip()
            updates["username_lc"] = updates["username"].lower()
        
        filter_query = {"_id": ObjectId(account_id)} if ObjectId.is_valid(account_id) else {"ig_account_id": account_id}
        await col.update_one(filter_query, {"$set": updates})
        return await cls.get_by_id(account_id)

    @classmethod
    async def delete(cls, account_id: str):
        col = await cls.get_collection()
        filter_query = {"_id": ObjectId(account_id)} if ObjectId.is_valid(account_id) else {"ig_account_id": account_id}
        res = await col.delete_one(filter_query)
        return res.deleted_count > 0


class SocialKeywordRepository:
    collection_name = "social_keywords"

    @classmethod
    async def get_collection(cls):
        db = get_database()
        return db[cls.collection_name]

    @classmethod
    async def get_all(
        cls,
        ig_account_id: Optional[str] = None,
        q: Optional[str] = None,
        media_id: Optional[str] = None,
        is_active: Optional[bool] = None,
        skip: int = 0,
        limit: int = 50,
    ):
        col = await cls.get_collection()
        query: Dict[str, Any] = {}
        if ig_account_id:
            query["ig_account_id"] = ig_account_id
        if is_active is not None:
            query["is_active"] = is_active
        if media_id is not None:
            query["media_id"] = media_id
        if q:
            regex = {"$regex": q, "$options": "i"}
            query["$or"] = [{"keyword": regex}, {"message": regex}, {"desc": regex}, {"username": regex}]

        total = await col.count_documents(query)
        cursor = col.find(query).sort("created_at", -1).skip(skip).limit(limit)
        items = []
        async for doc in cursor:
            doc["id"] = str(doc["_id"])
            items.append(doc)
        return items, total

    @classmethod
    async def get_active_rules_for_account(cls, ig_account_id: str):
        """Loads all active rules for account, sorted so post-specific rules (media_id != '') sort before global rules."""
        col = await cls.get_collection()
        cursor = col.find({"ig_account_id": str(ig_account_id), "is_active": True})
        rules = []
        async for doc in cursor:
            doc["id"] = str(doc["_id"])
            rules.append(doc)
        # Sort post-specific (media_id != '') first
        rules.sort(key=lambda r: 0 if r.get("media_id") else 1)
        return rules

    @classmethod
    async def get_by_id(cls, rule_id: str):
        col = await cls.get_collection()
        if not ObjectId.is_valid(rule_id):
            return None
        doc = await col.find_one({"_id": ObjectId(rule_id)})
        if doc:
            doc["id"] = str(doc["_id"])
        return doc

    @classmethod
    async def check_duplicate(cls, ig_account_id: str, keyword_norm: str, media_id: str, exclude_id: Optional[str] = None):
        col = await cls.get_collection()
        query = {
            "ig_account_id": ig_account_id,
            "keyword_norm": keyword_norm,
            "media_id": media_id or "",
            "is_active": True,
        }
        if exclude_id and ObjectId.is_valid(exclude_id):
            query["_id"] = {"$ne": ObjectId(exclude_id)}
        existing = await col.find_one(query)
        return existing is not None

    @classmethod
    async def create(cls, data: dict):
        col = await cls.get_collection()
        now = datetime.utcnow()
        data["created_at"] = now
        data["updated_at"] = now
        data["hit_count"] = 0
        data["last_hit_at"] = None
        data["is_active"] = data.get("is_active", True)
        res = await col.insert_one(data)
        data["id"] = str(res.inserted_id)
        return data

    @classmethod
    async def update(cls, rule_id: str, updates: dict):
        col = await cls.get_collection()
        if not ObjectId.is_valid(rule_id):
            return None
        updates["updated_at"] = datetime.utcnow()
        await col.update_one({"_id": ObjectId(rule_id)}, {"$set": updates})
        return await cls.get_by_id(rule_id)

    @classmethod
    async def increment_hit(cls, rule_id: str):
        col = await cls.get_collection()
        if ObjectId.is_valid(rule_id):
            await col.update_one(
                {"_id": ObjectId(rule_id)},
                {"$inc": {"hit_count": 1}, "$set": {"last_hit_at": datetime.utcnow()}}
            )

    @classmethod
    async def delete(cls, rule_id: str):
        col = await cls.get_collection()
        if not ObjectId.is_valid(rule_id):
            return False
        res = await col.delete_one({"_id": ObjectId(rule_id)})
        return res.deleted_count > 0


class SocialPendingDmRepository:
    collection_name = "social_pending_dms"

    @classmethod
    async def get_collection(cls):
        db = get_database()
        return db[cls.collection_name]

    @classmethod
    async def get_all(cls):
        col = await cls.get_collection()
        cursor = col.find().sort("created_at", -1)
        res = []
        async for doc in cursor:
            doc["id"] = str(doc["_id"])
            res.append(doc)
        return res

    @classmethod
    async def get_pending(cls, ig_account_id: str, igsid: str):
        col = await cls.get_collection()
        doc = await col.find_one({"ig_account_id": str(ig_account_id), "igsid": str(igsid)})
        if doc:
            doc["id"] = str(doc["_id"])
        return doc

    @classmethod
    async def store_pending(cls, data: dict):
        col = await cls.get_collection()
        now = datetime.utcnow()
        ttl = data.get("ttl_minutes", 10)
        expire_at = now + timedelta(minutes=ttl)
        
        doc = {
            "ig_account_id": str(data["ig_account_id"]),
            "igsid": str(data["igsid"]),
            "message": data["message"],
            "keyword": data["keyword"],
            "comment_id": data.get("comment_id", ""),
            "media_id": data.get("media_id", ""),
            "username": data.get("username", ""),
            "created_at": now,
            "ttl_minutes": ttl,
            "expire_at": expire_at,
        }
        await col.update_one(
            {"ig_account_id": doc["ig_account_id"], "igsid": doc["igsid"]},
            {"$setOnInsert": doc},
            upsert=True
        )

    @classmethod
    async def delete_pending(cls, ig_account_id: str, igsid: str):
        col = await cls.get_collection()
        res = await col.delete_one({"ig_account_id": str(ig_account_id), "igsid": str(igsid)})
        return res.deleted_count > 0

    @classmethod
    async def delete_by_id(cls, record_id: str):
        col = await cls.get_collection()
        if not ObjectId.is_valid(record_id):
            return False
        res = await col.delete_one({"_id": ObjectId(record_id)})
        return res.deleted_count > 0

    @classmethod
    async def count(cls):
        col = await cls.get_collection()
        return await col.count_documents({})


class SocialDedupeRepository:
    collection_name = "social_dedupe"

    @classmethod
    async def get_collection(cls):
        db = get_database()
        return db[cls.collection_name]

    @classmethod
    async def try_acquire(cls, dedupe_id: str) -> bool:
        """Atomic deduplication across multiple workers via MongoDB unique _id."""
        col = await cls.get_collection()
        try:
            await col.insert_one({"_id": dedupe_id, "created_at": datetime.utcnow()})
            return True
        except Exception:
            return False


class SocialEventLogRepository:
    collection_name = "social_event_logs"

    @classmethod
    async def get_collection(cls):
        db = get_database()
        return db[cls.collection_name]

    @classmethod
    async def log_event(
        cls,
        type_: str,
        status_: str,
        message: str,
        ig_account_id: Optional[str] = None,
        username: Optional[str] = None,
        actor: str = "system",
        level: str = "info",
        detail: Optional[dict] = None,
        error_code: Optional[int] = None,
        error_subcode: Optional[int] = None,
        hint: Optional[str] = None,
        duration_ms: Optional[int] = None,
        retention_days: int = 2
    ):
        col = await cls.get_collection()
        now = datetime.utcnow()
        from app.services.social.utils import mask_dict
        doc = {
            "ts": now,
            "type": type_,
            "status": status_,
            "level": level,
            "ig_account_id": ig_account_id,
            "username": username,
            "actor": actor,
            "message": message,
            "detail": mask_dict(detail or {}),
            "error_code": error_code,
            "error_subcode": error_subcode,
            "hint": hint,
            "duration_ms": duration_ms,
            "expire_at": now + timedelta(days=max(1, retention_days)),
        }
        await col.insert_one(doc)

    @classmethod
    async def get_events(
        cls,
        ig_account_id: Optional[str] = None,
        level: Optional[str] = None,
        type_: Optional[str] = None,
        status_: Optional[str] = None,
        search: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        skip: int = 0,
        limit: int = 50,
    ):
        col = await cls.get_collection()
        query: Dict[str, Any] = {}
        if ig_account_id:
            query["ig_account_id"] = ig_account_id
        if level:
            query["level"] = level
        if type_:
            query["type"] = type_
        if status_:
            query["status"] = status_
        if search:
            regex = {"$regex": search, "$options": "i"}
            query["$or"] = [{"message": regex}, {"hint": regex}, {"username": regex}]
        if start_date or end_date:
            date_filter = {}
            if start_date:
                date_filter["$gte"] = start_date
            if end_date:
                date_filter["$lte"] = end_date
            query["ts"] = date_filter

        total = await col.count_documents(query)
        cursor = col.find(query).sort("ts", -1).skip(skip).limit(limit)
        events = []
        async for doc in cursor:
            doc["id"] = str(doc["_id"])
            events.append(doc)
        return events, total

    @classmethod
    async def get_summary_24h(cls):
        col = await cls.get_collection()
        cutoff = datetime.utcnow() - timedelta(hours=24)
        pipeline = [
            {"$match": {"ts": {"$gte": cutoff}}},
            {"$group": {"_id": "$type", "count": {"$sum": 1}}}
        ]
        res = {doc["_id"]: doc["count"] async for doc in col.aggregate(pipeline)}
        return res

    @classmethod
    async def clear_all(cls):
        col = await cls.get_collection()
        res = await col.delete_many({})
        return res.deleted_count

    @classmethod
    async def update_retention(cls, days: int):
        col = await cls.get_collection()
        now = datetime.utcnow()
        await col.update_many(
            {},
            [{"$set": {"expire_at": {"$add": ["$ts", days * 24 * 60 * 60 * 1000]}}}]
        )


class SocialBrandRepository:
    collection_name = "social_brands"

    @classmethod
    async def get_collection(cls):
        db = get_database()
        return db[cls.collection_name]

    @classmethod
    async def get_all(cls, active_only: bool = False):
        col = await cls.get_collection()
        query = {"is_active": True} if active_only else {}
        cursor = col.find(query).sort("brand_name", 1)
        res = []
        async for doc in cursor:
            doc["id"] = str(doc["_id"])
            res.append(doc)
        return res

    @classmethod
    async def get_by_brand_id(cls, brand_id: str):
        col = await cls.get_collection()
        doc = await col.find_one({"brand_id": brand_id.strip()})
        if doc:
            doc["id"] = str(doc["_id"])
        return doc

    @classmethod
    async def get_by_id(cls, brand_id: str):
        col = await cls.get_collection()
        # Check by brand_id first, then ObjectId _id
        doc = await col.find_one({"brand_id": str(brand_id).strip()})
        if not doc and ObjectId.is_valid(brand_id):
            doc = await col.find_one({"_id": ObjectId(brand_id)})
        if doc:
            doc["id"] = str(doc["_id"])
        return doc

    @classmethod
    async def create(cls, data: dict):
        col = await cls.get_collection()
        now = datetime.utcnow()
        data["created_at"] = now
        data["updated_at"] = now
        data["is_active"] = data.get("is_active", True)
        res = await col.insert_one(data)
        data["id"] = str(res.inserted_id)
        return data

    @classmethod
    async def update(cls, brand_id: str, updates: dict):
        col = await cls.get_collection()
        updates["updated_at"] = datetime.utcnow()
        await col.update_one({"brand_id": brand_id}, {"$set": updates})
        return await cls.get_by_brand_id(brand_id)

    @classmethod
    async def delete(cls, brand_id: str):
        col = await cls.get_collection()
        res = await col.delete_one({"brand_id": brand_id})
        return res.deleted_count > 0


class SocialJobRepository:
    collection_name = "social_jobs"

    @classmethod
    async def get_collection(cls):
        db = get_database()
        return db[cls.collection_name]

    @classmethod
    async def create_job(cls, kind: str, user_id: str, input_data: dict, retention_days: int = 2):
        col = await cls.get_collection()
        now = datetime.utcnow()
        job_id = str(ObjectId())
        doc = {
            "_id": ObjectId(job_id),
            "kind": kind,
            "status": "queued",
            "step": "Queued for processing",
            "progress": 0,
            "input": input_data,
            "result": None,
            "error": None,
            "engine": None,
            "created_by": user_id,
            "created_at": now,
            "started_at": None,
            "finished_at": None,
            "expire_at": now + timedelta(days=max(1, retention_days)),
        }
        await col.insert_one(doc)
        doc["id"] = job_id
        return doc

    @classmethod
    async def update_job(cls, job_id: str, updates: dict):
        col = await cls.get_collection()
        if not ObjectId.is_valid(job_id):
            return None
        await col.update_one({"_id": ObjectId(job_id)}, {"$set": updates})
        return await cls.get_job(job_id)

    @classmethod
    async def get_job(cls, job_id: str):
        col = await cls.get_collection()
        if not ObjectId.is_valid(job_id):
            return None
        doc = await col.find_one({"_id": ObjectId(job_id)})
        if doc:
            doc["_id"] = str(doc["_id"])
            doc["id"] = str(doc["_id"])
        return doc

    @classmethod
    async def get_recent_jobs(cls, kind: Optional[str] = None, user_id: Optional[str] = None, limit: int = 20):
        col = await cls.get_collection()
        q: Dict[str, Any] = {}
        if kind:
            q["kind"] = kind
        if user_id:
            q["created_by"] = user_id
        cursor = col.find(q).sort("created_at", -1).limit(limit)
        res = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            doc["id"] = str(doc["_id"])
            res.append(doc)
        return res

    @classmethod
    async def sweep_stuck_jobs(cls):
        """Mark running or queued jobs older than 15 minutes as failed."""
        col = await cls.get_collection()
        cutoff = datetime.utcnow() - timedelta(minutes=15)
        await col.update_many(
            {"status": {"$in": ["queued", "running"]}, "created_at": {"$lte": cutoff}},
            {"$set": {"status": "failed", "error": "Server restarted or job timed out", "finished_at": datetime.utcnow()}}
        )


class SocialScriptRepository:
    collection_name = "social_scripts"

    @classmethod
    async def get_collection(cls):
        db = get_database()
        return db[cls.collection_name]

    @classmethod
    async def save_script(cls, data: dict):
        col = await cls.get_collection()
        now = datetime.utcnow()
        data["created_at"] = now
        data["updated_at"] = now
        res = await col.insert_one(data)
        data["_id"] = str(res.inserted_id)
        data["id"] = str(res.inserted_id)
        return data

    @classmethod
    async def get_by_id(cls, script_id: str):
        col = await cls.get_collection()
        if not ObjectId.is_valid(script_id):
            return None
        doc = await col.find_one({"_id": ObjectId(script_id)})
        if doc:
            doc["_id"] = str(doc["_id"])
            doc["id"] = str(doc["_id"])
        return doc

    @classmethod
    async def get_user_scripts(cls, user_id: Optional[str] = None, brand_id: Optional[str] = None, limit: int = 50):
        col = await cls.get_collection()
        q: Dict[str, Any] = {}
        if user_id:
            q["created_by"] = user_id
        if brand_id:
            q["brand_id"] = brand_id
        cursor = col.find(q).sort("created_at", -1).limit(limit)
        res = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            doc["id"] = str(doc["_id"])
            res.append(doc)
        return res

    @classmethod
    async def update_script(cls, script_id: str, updates: dict):
        col = await cls.get_collection()
        if not ObjectId.is_valid(script_id):
            return None
        updates["updated_at"] = datetime.utcnow()
        await col.update_one({"_id": ObjectId(script_id)}, {"$set": updates})
        return await cls.get_by_id(script_id)

    @classmethod
    async def delete_script(cls, script_id: str):
        col = await cls.get_collection()
        if not ObjectId.is_valid(script_id):
            return False
        res = await col.delete_one({"_id": ObjectId(script_id)})
        return res.deleted_count > 0

    create = save_script
    update = update_script
    delete = delete_script


class SocialSettingsRepository:
    collection_name = "social_settings"

    @classmethod
    async def get_collection(cls):
        db = get_database()
        return db[cls.collection_name]

    @classmethod
    async def get_effective_settings(cls) -> dict:
        col = await cls.get_collection()
        doc = await col.find_one({"_id": "global"}) or {}
        return doc

    @classmethod
    async def update_settings(cls, updates: dict) -> dict:
        col = await cls.get_collection()
        updates["updated_at"] = datetime.utcnow()
        await col.update_one({"_id": "global"}, {"$set": updates}, upsert=True)
        return await cls.get_effective_settings()


class SocialLockRepository:
    collection_name = "social_locks"

    @classmethod
    async def get_collection(cls):
        db = get_database()
        return db[cls.collection_name]

    @classmethod
    async def acquire_lock(cls, lock_name: str, duration_seconds: int = 300) -> bool:
        """Distributed lock for background schedulers across multi-worker deployments."""
        col = await cls.get_collection()
        now = datetime.utcnow()
        until = now + timedelta(seconds=duration_seconds)
        res = await col.find_one_and_update(
            {"_id": lock_name, "$or": [{"until": {"$exists": False}}, {"until": {"$lte": now}}]},
            {"$set": {"until": until, "acquired_at": now}},
            upsert=True
        )
        return res is not None or True


class SocialMediaRepository:
    collection_name = "social_account_media"

    @classmethod
    async def get_collection(cls):
        db = get_database()
        return db[cls.collection_name]

    @classmethod
    async def get_by_account(cls, ig_account_id: str, limit: int = 200) -> List[Dict[str, Any]]:
        col = await cls.get_collection()
        target = str(ig_account_id).strip()
        clean_user = target.lstrip("@").lower()
        query = {
            "$or": [
                {"ig_account_id": target},
                {"username": clean_user},
                {"account_id": target},
            ]
        }
        cursor = col.find(query).sort("timestamp", -1).limit(limit)
        items = []
        async for doc in cursor:
            doc["id"] = str(doc.get("media_id") or doc.get("_id"))
            if "_id" in doc:
                doc["_id"] = str(doc["_id"])
            items.append(doc)
        return items

    @classmethod
    async def get_by_username(cls, username: str, limit: int = 200) -> List[Dict[str, Any]]:
        col = await cls.get_collection()
        clean_user = username.lstrip("@").strip().lower()
        cursor = col.find({"username": clean_user}).sort("timestamp", -1).limit(limit)
        items = []
        async for doc in cursor:
            doc["id"] = str(doc.get("media_id") or doc.get("_id"))
            if "_id" in doc:
                doc["_id"] = str(doc["_id"])
            items.append(doc)
        return items

    @classmethod
    async def upsert_media(cls, ig_account_id: str, item: dict, username: Optional[str] = None) -> None:
        col = await cls.get_collection()
        m_id = str(item.get("id") or item.get("media_id"))
        doc = {
            "media_id": m_id,
            "ig_account_id": str(ig_account_id),
            "type": item.get("type", "POST"),
            "caption": item.get("caption", ""),
            "permalink": item.get("permalink", ""),
            "timestamp": item.get("timestamp", datetime.utcnow().isoformat()),
            "thumbnail_url": item.get("thumbnail_url"),
            "shortcode": item.get("shortcode"),
            "updated_at": datetime.utcnow(),
        }
        if username:
            doc["username"] = username.lstrip("@").strip().lower()
        await col.update_one(
            {"media_id": m_id, "ig_account_id": str(ig_account_id)},
            {"$set": doc},
            upsert=True
        )

    @classmethod
    async def bulk_upsert(cls, ig_account_id: str, items: List[dict], username: Optional[str] = None) -> int:
        col = await cls.get_collection()
        count = 0
        now = datetime.utcnow()
        clean_user = username.lstrip("@").strip().lower() if username else None
        for item in items:
            m_id = str(item.get("id") or item.get("media_id"))
            doc = {
                "media_id": m_id,
                "ig_account_id": str(ig_account_id),
                "type": item.get("type", "POST"),
                "media_type": item.get("media_type", ""),
                "caption": item.get("caption", ""),
                "permalink": item.get("permalink", ""),
                "timestamp": item.get("timestamp", now.isoformat()),
                "thumbnail_url": item.get("thumbnail_url"),
                "media_url": item.get("media_url"),
                "shortcode": item.get("shortcode"),
                "updated_at": now,
            }
            if clean_user:
                doc["username"] = clean_user
            await col.update_one(
                {"media_id": m_id, "ig_account_id": str(ig_account_id)},
                {"$set": doc},
                upsert=True
            )
            count += 1
        return count

