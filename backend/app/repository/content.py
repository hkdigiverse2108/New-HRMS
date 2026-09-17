from app.database.db import get_database
from bson import ObjectId
from typing import Optional
from datetime import datetime, date

class ContentRepository:
    collection_name = "content_items"

    @classmethod
    async def get_collection(cls):
        db = get_database()
        return db[cls.collection_name]

    @classmethod
    async def get_settings_collection(cls):
        db = get_database()
        return db["content_settings"]

    @classmethod
    async def get_settings(cls, project_id: str):
        collection = await cls.get_settings_collection()
        settings = await collection.find_one({"project_id": project_id})
        if settings:
            settings["_id"] = str(settings["_id"])
        return settings

    @classmethod
    async def update_settings(cls, project_id: str, settings_data: dict):
        collection = await cls.get_settings_collection()
        settings_data["updated_at"] = datetime.utcnow().isoformat()
        await collection.update_one(
            {"project_id": project_id}, 
            {"$set": settings_data}, 
            upsert=True
        )
        return await cls.get_settings(project_id)

    @classmethod
    async def create(cls, data: dict):
        collection = await cls.get_collection()
        now = datetime.utcnow().isoformat()
        data["created_at"] = now
        data["updated_at"] = now
        data["is_deleted"] = False
        
        # Convert date objects to datetime string for consistent storage if needed,
        # but pymongo can handle date objects. Pydantic might serialize them to string or we do it here.
        
        result = await collection.insert_one(data)
        data["_id"] = str(result.inserted_id)
        return data

    @classmethod
    async def get_all(
        cls, 
        project_id: str,
        content_type: Optional[list] = None, 
        status: Optional[list] = None, 
        month: Optional[int] = None,
        year: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        page: Optional[int] = None, 
        limit: Optional[int] = None
    ):
        collection = await cls.get_collection()
        query = {"is_deleted": False, "project_id": project_id}
        
        if content_type:
            query["content_type"] = {"$in": content_type}
        if status:
            query["approval_status"] = {"$in": status}
            
        date_query = {}
        if start_date:
            date_query["$gte"] = start_date
        if end_date:
            date_query["$lte"] = end_date
            
        if date_query:
            # We filter based on schedule_date since actual_posting_date might be None
            # Or we can do an $or if needed, but typically schedule_date is used for calendar filtering
            query["schedule_date"] = date_query
            
        if month and year:
            # Example: month=10, year=2026 => "2026-10-01" to "2026-10-31"
            start_m = f"{year}-{month:02d}-01"
            import calendar
            last_day = calendar.monthrange(year, month)[1]
            end_m = f"{year}-{month:02d}-{last_day}"
            query["schedule_date"] = {"$gte": start_m, "$lte": end_m}
        elif month:
            # If only month is provided, we can't easily do string comparison for month without regex
            # But usually they provide year as well. Using regex for Month:
            query["schedule_date"] = {"$regex": f"^-{month:02d}-"}
        elif year:
            query["schedule_date"] = {"$regex": f"^{year}-"}
            
        total = await collection.count_documents(query)

        if page and limit:
            skip = (page - 1) * limit
            cursor = collection.find(query).sort("schedule_date", 1).skip(skip).limit(limit)
            total_pages = (total + limit - 1) // limit
        else:
            cursor = collection.find(query).sort("schedule_date", 1)
            page = 1
            limit = total if total > 0 else 10
            total_pages = 1 if total > 0 else 0

        items = []
        async for item in cursor:
            item["_id"] = str(item["_id"])
            items.append(item)
            
        return {
            "data": items,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": total_pages
        }

    @classmethod
    async def get_by_id(cls, item_id: str):
        collection = await cls.get_collection()
        try:
            item = await collection.find_one({"_id": ObjectId(item_id), "is_deleted": {"$ne": True}})
            if item:
                item["_id"] = str(item["_id"])
            return item
        except Exception:
            return None

    @classmethod
    async def update(cls, item_id: str, update_data: dict):
        collection = await cls.get_collection()
        update_data["updated_at"] = datetime.utcnow().isoformat()
                
        try:
            await collection.update_one({"_id": ObjectId(item_id)}, {"$set": update_data})
            return await cls.get_by_id(item_id)
        except Exception:
            return None

    @classmethod
    async def soft_delete(cls, item_id: str):
        collection = await cls.get_collection()
        try:
            await collection.update_one(
                {"_id": ObjectId(item_id)}, 
                {"$set": {"is_deleted": True, "updated_at": datetime.utcnow().isoformat()}}
            )
            return True
        except Exception:
            return False
