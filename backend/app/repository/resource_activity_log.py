import re
from bson import ObjectId
from app.database.db import get_database
from datetime import datetime
from typing import List, Dict, Any, Optional

class ResourceActivityLogRepository:
    collection_name = "resource_activity_logs"

    @classmethod
    async def get_collection(cls):
        db = get_database()
        return db[cls.collection_name]

    @classmethod
    async def log_activity(
        cls,
        target_type: str,
        target_id: str,
        action: str,
        details: str,
        performed_by: Optional[dict] = None
    ) -> Dict[str, Any]:
        collection = await cls.get_collection()
        now = datetime.utcnow()
        
        user_name = "Admin"
        if isinstance(performed_by, dict):
            pi = performed_by.get("personal_info", {}) or {}
            ci = performed_by.get("contact_info", {}) or {}
            fn = str(pi.get("first_name") or "").strip()
            ln = str(pi.get("last_name") or "").strip()
            combined = f"{fn} {ln}".strip()
            user_name = str(performed_by.get("full_name") or pi.get("full_name") or ci.get("full_name") or combined or performed_by.get("name") or performed_by.get("email") or "Admin").strip()

        doc = {
            "target_type": str(target_type).lower(),
            "target_id": str(target_id),
            "action": action,
            "details": details,
            "performed_by": user_name,
            "user_name": user_name,
            "timestamp": now.strftime("%Y-%m-%d %H:%M:%S UTC"),
            "created_at": now
        }
        res = await collection.insert_one(doc)
        doc["_id"] = str(res.inserted_id)
        return doc

    @classmethod
    async def get_logs(
        cls,
        target_type: Optional[str] = None,
        target_id: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        collection = await cls.get_collection()
        query: Dict[str, Any] = {}
        
        if target_type and str(target_type).lower() not in ["all", "none", "null"]:
            query["target_type"] = str(target_type).lower()

        if target_id and str(target_id).lower() not in ["all", "none", "null"]:
            clean_id = str(target_id).strip()
            id_list = [clean_id]

            if str(target_type).lower() == "resource":
                inv_coll = get_database()["resource_inventory"]
                inv_doc = None
                if ObjectId.is_valid(clean_id):
                    inv_doc = await inv_coll.find_one({"_id": ObjectId(clean_id)})
                if not inv_doc:
                    inv_doc = await inv_coll.find_one({"resource_id": clean_id})
                if inv_doc:
                    id_list.append(str(inv_doc["_id"]))
                    if inv_doc.get("resource_id"):
                        id_list.append(str(inv_doc["resource_id"]))
            elif str(target_type).lower() == "category":
                cat_coll = get_database()["resource_categories"]
                cat_doc = None
                if ObjectId.is_valid(clean_id):
                    cat_doc = await cat_coll.find_one({"_id": ObjectId(clean_id)})
                if not cat_doc:
                    cat_doc = await cat_coll.find_one({"category_name": clean_id})
                if cat_doc:
                    id_list.append(str(cat_doc["_id"]))
                    if cat_doc.get("category_name"):
                        id_list.append(str(cat_doc["category_name"]))

            query["target_id"] = {"$in": list(set(id_list))}

        cursor = collection.find(query).sort("created_at", -1).limit(limit)
        items = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            if "timestamp" not in doc:
                cat = doc.get("created_at") or datetime.utcnow()
                doc["timestamp"] = cat.strftime("%Y-%m-%d %H:%M:%S UTC") if isinstance(cat, datetime) else str(cat)
            items.append(doc)
        return items
