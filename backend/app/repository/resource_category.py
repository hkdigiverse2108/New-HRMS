from app.database.db import get_database
from bson import ObjectId
from datetime import datetime
from typing import List, Dict, Any, Optional

class ResourceCategoryRepository:
    collection_name = "resource_categories"

    @classmethod
    async def get_collection(cls):
        db = get_database()
        return db[cls.collection_name]

    @classmethod
    async def create(cls, data: dict) -> Dict[str, Any]:
        collection = await cls.get_collection()
        now = datetime.utcnow()
        doc = {
            "category_name": str(data.get("category_name", "")).strip(),
            "total_resources": int(data.get("total_resources", 0) or 0),
            "description": data.get("description"),
            "created_by": data.get("created_by"),
            "is_deleted": False,
            "created_at": now,
            "updated_at": now
        }
        res = await collection.insert_one(doc)
        doc["_id"] = str(res.inserted_id)
        return doc

    @classmethod
    async def get_all(
        cls,
        is_deleted: bool = False,
        search: Optional[str] = None,
        page: int = 1,
        limit: int = 10
    ) -> Dict[str, Any]:
        collection = await cls.get_collection()
        query: Dict[str, Any] = {"is_deleted": is_deleted}

        if search:
            query["$or"] = [
                {"category_name": {"$regex": search, "$options": "i"}},
                {"description": {"$regex": search, "$options": "i"}}
            ]

        total = await collection.count_documents(query)

        eff_page = max(1, page)
        eff_limit = max(1, min(100, limit))
        skip = (eff_page - 1) * eff_limit

        cursor = collection.find(query).sort("created_at", -1).skip(skip).limit(eff_limit)
        items = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            items.append(doc)

        total_pages = (total + eff_limit - 1) // eff_limit if total > 0 else 0

        return {
            "items": items,
            "data": items,
            "total": total,
            "page": eff_page,
            "limit": eff_limit,
            "total_pages": total_pages
        }

    @classmethod
    async def get_by_id(cls, item_id: str) -> Optional[Dict[str, Any]]:
        collection = await cls.get_collection()
        if not ObjectId.is_valid(item_id):
            return None
        doc = await collection.find_one({"_id": ObjectId(item_id)})
        if doc:
            doc["_id"] = str(doc["_id"])
        return doc

    @classmethod
    async def update(cls, item_id: str, update_data: dict) -> bool:
        collection = await cls.get_collection()
        if not ObjectId.is_valid(item_id):
            return False

        existing = await collection.find_one({"_id": ObjectId(item_id)})
        if not existing:
            return False

        current_total = int(existing.get("total_resources", 0) or 0)
        new_total = current_total

        # Apply add_resources
        add_res = update_data.pop("add_resources", None)
        if add_res is not None and int(add_res) > 0:
            new_total += int(add_res)

        # Apply remove_resources
        rem_res = update_data.pop("remove_resources", None)
        if rem_res is not None and int(rem_res) > 0:
            new_total = max(0, new_total - int(rem_res))

        update_payload: Dict[str, Any] = {
            "total_resources": new_total,
            "updated_at": datetime.utcnow()
        }

        if "category_name" in update_data and update_data["category_name"] is not None:
            update_payload["category_name"] = str(update_data["category_name"]).strip()

        if "description" in update_data:
            update_payload["description"] = update_data["description"]

        res = await collection.update_one({"_id": ObjectId(item_id)}, {"$set": update_payload})
        return res.modified_count > 0 or res.matched_count > 0

    @classmethod
    async def delete(cls, item_id: str) -> bool:
        collection = await cls.get_collection()
        if not ObjectId.is_valid(item_id):
            return False
        res = await collection.update_one(
            {"_id": ObjectId(item_id)},
            {"$set": {"is_deleted": True, "updated_at": datetime.utcnow()}}
        )
        return res.modified_count > 0
