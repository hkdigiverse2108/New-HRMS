from app.database.db import get_database
from datetime import datetime
from typing import Dict, Any

class PayrollRepository:
    collection_name = "payroll_settings"

    @classmethod
    async def get_collection(cls):
        db = get_database()
        return db[cls.collection_name]

    @classmethod
    async def get_settings(cls) -> Dict[str, Any]:
        try:
            collection = await cls.get_collection()
            doc = await collection.find_one({})
            if doc:
                doc["_id"] = str(doc["_id"])
                return doc
        except Exception:
            pass
        return {"holidays": []}

    @classmethod
    async def save_or_update_settings(cls, data: dict) -> Dict[str, Any]:
        collection = await cls.get_collection()
        existing = await collection.find_one({})
        data["updated_at"] = datetime.utcnow()

        if existing:
            update_data = {k: v for k, v in data.items() if k != "_id"}
            await collection.update_one({"_id": existing["_id"]}, {"$set": update_data})
            return await cls.get_settings()
        else:
            data["created_at"] = datetime.utcnow()
            res = await collection.insert_one(data)
            data["_id"] = str(res.inserted_id)
            return data
