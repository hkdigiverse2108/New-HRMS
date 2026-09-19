from app.database.db import get_database
from datetime import datetime
from bson import ObjectId

class DailyPlannerRepository:
    collection_name = "daily_planners"

    @classmethod
    async def get_collection(cls):
        db = get_database()
        return db[cls.collection_name]

    @classmethod
    async def create(cls, data: dict):
        collection = await cls.get_collection()
        if "_id" not in data:
            data["_id"] = ObjectId()
        if "created_at" not in data:
            data["created_at"] = datetime.utcnow()
        if "updated_at" not in data:
            data["updated_at"] = datetime.utcnow()
            
        await collection.insert_one(data)
        
        # Convert _id to string for response
        data["_id"] = str(data["_id"])
        return data

    @classmethod
    async def get_by_employee_and_date(cls, employee_id: str, date_str: str):
        collection = await cls.get_collection()
        item = await collection.find_one({"employee_id": employee_id, "date": date_str})
        if item:
            item["_id"] = str(item["_id"])
        return item

    @classmethod
    async def update(cls, employee_id: str, date_str: str, data: dict):
        collection = await cls.get_collection()
        data["updated_at"] = datetime.utcnow()
        result = await collection.update_one(
            {"employee_id": employee_id, "date": date_str},
            {"$set": data}
        )
        return result.modified_count > 0 or result.matched_count > 0
