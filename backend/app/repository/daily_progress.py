from app.database.db import get_database
from bson import ObjectId
from typing import Optional, List, Dict, Any
from datetime import datetime

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

class DailyProgressRepository:
    collection_name = "daily_progress"

    @classmethod
    async def get_collection(cls):
        db = get_database()
        return db[cls.collection_name]

    @classmethod
    async def create_progress(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        collection = await cls.get_collection()
        now = datetime.utcnow()
        doc = {
            **data,
            "status": "PENDING",
            "rating": 0,
            "remarks": None,
            "verified_by_id": None,
            "submitted_at": now,
            "verified_at": None,
            "activity_logs": [{
                "action": "AUTO_GENERATED",
                "performed_by_id": "system",
                "performed_by_name": "System",
                "timestamp": now,
                "details": "Draft created automatically based on assigned tasks."
            }]
        }
        result = await collection.insert_one(doc)
        doc["_id"] = result.inserted_id
        return serialize_mongo(doc)

    @classmethod
    async def get_progress_by_id(cls, progress_id: str) -> Optional[Dict[str, Any]]:
        collection = await cls.get_collection()
        if not ObjectId.is_valid(progress_id):
            return None
        doc = await collection.find_one({"_id": ObjectId(progress_id)})
        return serialize_mongo(doc) if doc else None

    @classmethod
    async def get_all_progress(cls, query: Dict[str, Any]) -> List[Dict[str, Any]]:
        collection = await cls.get_collection()
        cursor = collection.find(query).sort("submitted_at", -1)
        records = []
        async for doc in cursor:
            records.append(serialize_mongo(doc))
        return records

    @classmethod
    async def update_progress(cls, progress_id: str, data: Dict[str, Any], push_log: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        collection = await cls.get_collection()
        if not ObjectId.is_valid(progress_id):
            return None
            
        update_doc: Dict[str, Any] = {"$set": data}
        if push_log:
            update_doc["$push"] = {"activity_logs": push_log}
            
        result = await collection.update_one(
            {"_id": ObjectId(progress_id)},
            update_doc
        )
        if result.modified_count > 0:
            return await cls.get_progress_by_id(progress_id)
        return None

    @classmethod
    async def delete_progress(cls, progress_id: str) -> bool:
        collection = await cls.get_collection()
        if not ObjectId.is_valid(progress_id):
            return False
        result = await collection.delete_one({"_id": ObjectId(progress_id)})
        return result.deleted_count > 0

    @classmethod
    async def get_stats(cls, query: Dict[str, Any]) -> Dict[str, Any]:
        collection = await cls.get_collection()
        
        total_reports = await collection.count_documents(query)
        
        pending_query = {**query, "status": "PENDING"}
        pending_verification = await collection.count_documents(pending_query)
        
        # Calculate average rating
        verified_query = {**query, "status": "VERIFIED", "rating": {"$gt": 0}}
        pipeline = [
            {"$match": verified_query},
            {"$group": {"_id": None, "avg_rating": {"$avg": "$rating"}}}
        ]
        
        cursor = collection.aggregate(pipeline)
        avg_rating = 0.0
        async for doc in cursor:
            avg_rating = round(doc.get("avg_rating", 0.0), 1)
            
        return {
            "total_reports": total_reports,
            "pending_verification": pending_verification,
            "average_rating": avg_rating
        }
