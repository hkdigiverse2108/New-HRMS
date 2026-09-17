from app.database.db import get_database
from bson import ObjectId
from typing import Optional

class ActivityRepository:
    collection_name = "activity_logs"

    @classmethod
    async def get_collection(cls):
        db = get_database()
        return db[cls.collection_name]

    @classmethod
    async def create(cls, data: dict):
        collection = await cls.get_collection()
        result = await collection.insert_one(data)
        data["_id"] = str(result.inserted_id)
        return data

    @classmethod
    async def get_all_by_project(
        cls, 
        project_id: str,
        page: int = 1, 
        limit: int = 10
    ):
        collection = await cls.get_collection()
        query = {"project_id": project_id}
            
        total = await collection.count_documents(query)

        skip = (page - 1) * limit
        # Sort by timestamp descending (newest first)
        cursor = collection.find(query).sort("timestamp", -1).skip(skip).limit(limit)
        total_pages = (total + limit - 1) // limit

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
