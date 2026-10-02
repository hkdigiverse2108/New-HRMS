from bson import ObjectId
from datetime import datetime
from typing import Optional, List, Dict, Any
from app.database.db import db

class LetterRequestRepository:
    @staticmethod
    def get_collection():
        return db.db["letter_requests"]

    @staticmethod
    async def create(data: Dict[str, Any]) -> str:
        data["is_deleted"] = False
        data["created_at"] = datetime.utcnow().isoformat()
        data["updated_at"] = datetime.utcnow().isoformat()
        res = await LetterRequestRepository.get_collection().insert_one(data)
        return str(res.inserted_id)

    @staticmethod
    async def get_by_id(item_id: str) -> Optional[Dict[str, Any]]:
        if not ObjectId.is_valid(item_id):
            return None
        doc = await LetterRequestRepository.get_collection().find_one({
            "_id": ObjectId(item_id),
            "is_deleted": False
        })
        if doc:
            doc["id"] = str(doc["_id"])
        return doc

    @staticmethod
    async def get_all(
        is_deleted: bool = False,
        employee_id: Optional[str] = None,
        status: Optional[str] = None,
        search: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        query: Dict[str, Any] = {"is_deleted": is_deleted}
        if employee_id:
            query["employee_id"] = employee_id
        if status:
            query["status"] = status
        if search:
            query["$or"] = [
                {"employee_name": {"$regex": search, "$options": "i"}},
                {"letter_type": {"$regex": search, "$options": "i"}},
                {"reason": {"$regex": search, "$options": "i"}}
            ]

        cursor = LetterRequestRepository.get_collection().find(query).sort("created_at", -1)
        items = []
        async for doc in cursor:
            doc["id"] = str(doc["_id"])
            items.append(doc)
        return items

    @staticmethod
    async def update(item_id: str, data: Dict[str, Any]) -> bool:
        if not ObjectId.is_valid(item_id):
            return False
        data["updated_at"] = datetime.utcnow().isoformat()
        res = await LetterRequestRepository.get_collection().update_one(
            {"_id": ObjectId(item_id), "is_deleted": False},
            {"$set": data}
        )
        return res.modified_count > 0 or res.matched_count > 0

    @staticmethod
    async def delete(item_id: str) -> bool:
        if not ObjectId.is_valid(item_id):
            return False
        res = await LetterRequestRepository.get_collection().update_one(
            {"_id": ObjectId(item_id)},
            {"$set": {"is_deleted": True, "updated_at": datetime.utcnow().isoformat()}}
        )
        return res.modified_count > 0
