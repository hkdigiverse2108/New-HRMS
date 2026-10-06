import re
from app.database.db import get_database
from bson import ObjectId
from datetime import datetime
from typing import List, Dict, Any, Optional

class InterviewRepository:
    
    @classmethod
    async def get_stage_collection(cls):
        return get_database()["interview_stages"]

    @classmethod
    async def get_schedule_collection(cls):
        return get_database()["interview_schedules"]

    # ==================== INTERVIEW STAGES ====================
    
    @classmethod
    async def create_stage(cls, data: dict) -> Dict[str, Any]:
        collection = await cls.get_stage_collection()
        now = datetime.utcnow()
        doc = {
            "name": str(data.get("name", "")).strip(),
            "is_deleted": False,
            "created_at": now,
            "updated_at": now
        }
        res = await collection.insert_one(doc)
        doc["_id"] = str(res.inserted_id)
        return doc

    @classmethod
    async def get_all_stages(cls, is_deleted: bool = False) -> List[Dict[str, Any]]:
        collection = await cls.get_stage_collection()
        cursor = collection.find({"is_deleted": is_deleted}).sort("created_at", 1)
        items = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            items.append(doc)
        return items

    @classmethod
    async def get_stage_by_id(cls, stage_id: str) -> Optional[Dict[str, Any]]:
        collection = await cls.get_stage_collection()
        if not ObjectId.is_valid(stage_id):
            return None
        doc = await collection.find_one({"_id": ObjectId(stage_id), "is_deleted": False})
        if doc:
            doc["_id"] = str(doc["_id"])
        return doc

    @classmethod
    async def update_stage(cls, stage_id: str, data: dict) -> bool:
        collection = await cls.get_stage_collection()
        if not ObjectId.is_valid(stage_id):
            return False
            
        payload = {"updated_at": datetime.utcnow()}
        if "name" in data and data["name"] is not None:
            payload["name"] = str(data["name"]).strip()
            
        res = await collection.update_one(
            {"_id": ObjectId(stage_id), "is_deleted": False},
            {"$set": payload}
        )
        return res.modified_count > 0 or res.matched_count > 0

    @classmethod
    async def delete_stage(cls, stage_id: str) -> bool:
        collection = await cls.get_stage_collection()
        if not ObjectId.is_valid(stage_id):
            return False
        res = await collection.update_one(
            {"_id": ObjectId(stage_id)},
            {"$set": {"is_deleted": True, "updated_at": datetime.utcnow()}}
        )
        return res.modified_count > 0


    # ==================== INTERVIEW SCHEDULES ====================

    @classmethod
    async def create_schedule(cls, data: dict) -> Dict[str, Any]:
        collection = await cls.get_schedule_collection()
        now = datetime.utcnow()
        doc = {
            "candidate_name": str(data.get("candidate_name", "")).strip(),
            "role_position": str(data.get("role_position", "")).strip(),
            "hiring_id": str(data.get("hiring_id", "")).strip() if data.get("hiring_id") else None,
            "referral_id": str(data.get("referral_id", "")).strip() if data.get("referral_id") else None,
            "interview_stage_id": str(data.get("interview_stage_id", "")).strip(),
            "interview_stage_name": str(data.get("interview_stage_name", "")).strip(),
            "date": str(data.get("date", "")).strip(),
            "time": str(data.get("time", "")).strip(),
            "interviewer_name": str(data.get("interviewer_name", "")).strip(),
            "notes": str(data.get("notes", "")).strip() if data.get("notes") else None,
            "created_by": data.get("created_by"),
            "is_deleted": False,
            "created_at": now,
            "updated_at": now
        }
        res = await collection.insert_one(doc)
        doc["_id"] = str(res.inserted_id)
        return doc

    @classmethod
    async def get_all_schedules(
        cls, 
        skip: int = 0, 
        limit: int = 100, 
        search: Optional[str] = None
    ) -> tuple[List[Dict[str, Any]], int]:
        collection = await cls.get_schedule_collection()
        query: Dict[str, Any] = {"is_deleted": False}
        
        if search and search.strip():
            s = re.escape(search.strip())
            query["$or"] = [
                {"candidate_name": {"$regex": s, "$options": "i"}},
                {"role_position": {"$regex": s, "$options": "i"}},
                {"interviewer_name": {"$regex": s, "$options": "i"}},
                {"interview_stage_name": {"$regex": s, "$options": "i"}}
            ]
            
        total_count = await collection.count_documents(query)
        
        cursor = collection.find(query).sort("created_at", -1)
        if skip > 0:
            cursor = cursor.skip(skip)
        if limit > 0:
            cursor = cursor.limit(limit)
            
        items = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            items.append(doc)
            
        return items, total_count

    @classmethod
    async def get_schedule_by_id(cls, schedule_id: str) -> Optional[Dict[str, Any]]:
        collection = await cls.get_schedule_collection()
        if not ObjectId.is_valid(schedule_id):
            return None
        doc = await collection.find_one({"_id": ObjectId(schedule_id), "is_deleted": False})
        if doc:
            doc["_id"] = str(doc["_id"])
        return doc

    @classmethod
    async def update_schedule(cls, schedule_id: str, data: dict) -> bool:
        collection = await cls.get_schedule_collection()
        if not ObjectId.is_valid(schedule_id):
            return False
            
        payload = {"updated_at": datetime.utcnow()}
        fields = ["candidate_name", "role_position", "hiring_id", "referral_id", "interview_stage_id", "interview_stage_name", "date", "time", "interviewer_name", "notes"]
        
        for k in fields:
            if k in data and data[k] is not None:
                payload[k] = data[k]
                
        res = await collection.update_one(
            {"_id": ObjectId(schedule_id), "is_deleted": False},
            {"$set": payload}
        )
        return res.modified_count > 0 or res.matched_count > 0

    @classmethod
    async def delete_schedule(cls, schedule_id: str) -> bool:
        collection = await cls.get_schedule_collection()
        if not ObjectId.is_valid(schedule_id):
            return False
        res = await collection.update_one(
            {"_id": ObjectId(schedule_id)},
            {"$set": {"is_deleted": True, "updated_at": datetime.utcnow()}}
        )
        return res.modified_count > 0
