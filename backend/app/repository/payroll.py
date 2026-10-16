from app.database.db import get_database
from datetime import datetime
from typing import Dict, Any, Optional

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


class PayrollRunRepository:
    collection_name = "payroll_runs"

    @classmethod
    async def get_collection(cls):
        db = get_database()
        return db[cls.collection_name]

    @classmethod
    async def get_by_month(cls, month: str) -> Optional[Dict[str, Any]]:
        collection = await cls.get_collection()
        doc = await collection.find_one({"month": month})
        if doc:
            doc["_id"] = str(doc["_id"])
        return doc

    @classmethod
    async def update_row(cls, month: str, employee_id: str, data: dict) -> Optional[Dict[str, Any]]:
        """Set fields on one employee row of the month's run; None when the row does not exist."""
        collection = await cls.get_collection()
        res = await collection.update_one(
            {"month": month, "rows.id": employee_id},
            {"$set": {f"rows.$.{k}": v for k, v in data.items()}},
        )
        if not res.matched_count:
            return None
        return await cls.get_by_month(month)

    @classmethod
    async def upsert(cls, month: str, data: dict) -> Dict[str, Any]:
        collection = await cls.get_collection()
        await collection.update_one({"month": month}, {"$set": {**data, "month": month}}, upsert=True)
        return await cls.get_by_month(month)
