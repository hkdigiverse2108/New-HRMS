from typing import List, Optional
from datetime import datetime
from bson import ObjectId
from app.database.db import get_database

class PresetRepository:
    collection_name = "development_presets"

    @classmethod
    async def get_collection(cls):
        db = get_database()
        return db[cls.collection_name]

    @classmethod
    async def create(cls, data: dict) -> dict:
        collection = await cls.get_collection()
        now = datetime.utcnow()
        data["created_at"] = now
        data["updated_at"] = now
        data["is_deleted"] = False
        
        # Ensure all tasks have preset_task_id
        import uuid
        for group in data.get("task_groups", []):
            for task in group.get("tasks", []):
                if not task.get("preset_task_id"):
                    task["preset_task_id"] = str(uuid.uuid4())
                    
        result = await collection.insert_one(data)
        data["_id"] = result.inserted_id
        return data

    @classmethod
    async def get_by_id(cls, item_id: str) -> Optional[dict]:
        collection = await cls.get_collection()
        try:
            return await collection.find_one({"_id": ObjectId(item_id), "is_deleted": False})
        except:
            return None

    @classmethod
    async def get_all(cls, preset_type: Optional[str] = None) -> List[dict]:
        collection = await cls.get_collection()
        query = {"is_deleted": False}
        if preset_type:
            query["preset_type"] = preset_type
            
        cursor = collection.find(query).sort("created_at", -1)
        items = []
        async for doc in cursor:
            doc["id"] = str(doc["_id"])
            items.append(doc)
        return items

    @classmethod
    async def update(cls, item_id: str, data: dict) -> bool:
        collection = await cls.get_collection()
        data["updated_at"] = datetime.utcnow()
        try:
            result = await collection.update_one(
                {"_id": ObjectId(item_id)},
                {"$set": data}
            )
            return result.modified_count > 0
        except:
            return False

    @classmethod
    async def soft_delete(cls, item_id: str) -> bool:
        collection = await cls.get_collection()
        try:
            result = await collection.update_one(
                {"_id": ObjectId(item_id)},
                {"$set": {"is_deleted": True, "updated_at": datetime.utcnow()}}
            )
            return result.modified_count > 0
        except:
            return False
