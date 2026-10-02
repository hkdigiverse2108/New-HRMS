from app.database.db import get_database
from bson import ObjectId
from datetime import datetime
from typing import List, Dict, Any, Optional

class SubmittedDocumentRepository:
    collection_name = "submitted_documents"

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
    async def get_all(cls, is_deleted: bool = False, employee_id: Optional[str] = None, document_type_id: Optional[str] = None, status: Optional[str] = None, search: Optional[str] = None) -> List[Dict[str, Any]]:
        collection = await cls.get_collection()
        query: Dict[str, Any] = {"is_deleted": is_deleted}

        if employee_id:
            query["employee_id"] = employee_id

        if document_type_id:
            query["document_type_id"] = document_type_id

        if status and status.lower() != "all":
            query["status"] = status

        if search:
            query["$or"] = [
                {"employee_name": {"$regex": search, "$options": "i"}},
                {"employee_code": {"$regex": search, "$options": "i"}},
                {"document_type_name": {"$regex": search, "$options": "i"}},
                {"document_number": {"$regex": search, "$options": "i"}},
                {"file_name": {"$regex": search, "$options": "i"}}
            ]

        cursor = collection.find(query).sort("created_at", -1)
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
