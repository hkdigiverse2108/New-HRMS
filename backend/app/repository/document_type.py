from app.database.db import get_database
from bson import ObjectId
from datetime import datetime
from typing import List, Dict, Any, Optional

class DocumentTypeRepository:
    collection_name = "document_types"

    @classmethod
    async def get_collection(cls):
        db = get_database()
        return db[cls.collection_name]

    @classmethod
    async def create(cls, data: dict) -> Dict[str, Any]:
        collection = await cls.get_collection()
        now = datetime.utcnow()
        doc = {
            **data,
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
        is_mandatory: Optional[bool] = None, 
        search: Optional[str] = None,
        page: Optional[int] = None,
        limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        collection = await cls.get_collection()
        query: Dict[str, Any] = {"is_deleted": is_deleted}
        
        if is_mandatory is not None:
            query["is_mandatory"] = is_mandatory
            
        if search:
            query["$or"] = [
                {"name": {"$regex": search, "$options": "i"}},
                {"description": {"$regex": search, "$options": "i"}}
            ]

        cursor = collection.find(query).sort("created_at", -1)
        if page and limit and page > 0 and limit > 0:
            cursor = cursor.skip((page - 1) * limit).limit(limit)

        items = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            items.append(doc)
        return items

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
    async def update(cls, item_id: str, data: dict) -> bool:
        collection = await cls.get_collection()
        if not ObjectId.is_valid(item_id):
            return False
        update_data = {**data, "updated_at": datetime.utcnow()}
        res = await collection.update_one({"_id": ObjectId(item_id)}, {"$set": update_data})
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
        return res.modified_count > 0 or res.matched_count > 0
