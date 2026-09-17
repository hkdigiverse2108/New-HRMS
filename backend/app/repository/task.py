from app.database.db import get_database
from bson import ObjectId
from typing import Optional
from datetime import datetime, date

class TaskRepository:
    collection_name = "tasks"

    @classmethod
    async def get_collection(cls):
        db = get_database()
        return db[cls.collection_name]

    @classmethod
    async def create(cls, data: dict):
        collection = await cls.get_collection()
        data["created_at"] = datetime.utcnow()
        data["updated_at"] = datetime.utcnow()
        data["is_deleted"] = False
        
        if "due_date" in data and isinstance(data["due_date"], date) and not isinstance(data["due_date"], datetime):
            data["due_date"] = datetime.combine(data["due_date"], datetime.min.time())
            
        result = await collection.insert_one(data)
        data["_id"] = str(result.inserted_id)
        return data

    @classmethod
    async def create_many(cls, data_list: list[dict]):
        collection = await cls.get_collection()
        now = datetime.utcnow()
        for data in data_list:
            data["created_at"] = now
            data["updated_at"] = now
            data["is_deleted"] = False
            
            if "due_date" in data and data["due_date"] and isinstance(data["due_date"], date) and not isinstance(data["due_date"], datetime):
                data["due_date"] = datetime.combine(data["due_date"], datetime.min.time())
                
        if not data_list:
            return []
            
        result = await collection.insert_many(data_list)
        for data, inserted_id in zip(data_list, result.inserted_ids):
            data["_id"] = str(inserted_id)
        return data_list

    @classmethod
    async def get_all(
        cls, 
        is_deleted: bool = False, 
        assigned_to: Optional[str] = None, 
        assigned_by: Optional[str] = None, 
        status: Optional[str] = None, 
        priority: Optional[str] = None, 
        page: Optional[int] = None, 
        limit: Optional[int] = None, 
        involved_emp_id: Optional[str] = None,
        history_assigned_to: Optional[str] = None,
        history_assigned_by: Optional[str] = None,
        content_item_id: Optional[str] = None,
        project_id: Optional[str] = None,
        creative_role: Optional[str] = None,
        task_category: Optional[str] = None
    ):
        collection = await cls.get_collection()
        and_conditions = [{"is_deleted": is_deleted}]
        
        if involved_emp_id:
            and_conditions.append({"$or": [{"assigned_to": involved_emp_id}, {"assigned_by": involved_emp_id}]})
            
        if assigned_to:
            and_conditions.append({"assigned_to": assigned_to})
        if assigned_by:
            and_conditions.append({"assigned_by": assigned_by})
        if status:
            and_conditions.append({"status": status})
        if priority:
            and_conditions.append({"priority": priority})
        if history_assigned_to:
            and_conditions.append({"transfer_history.to_employee": history_assigned_to})
        if history_assigned_by:
            and_conditions.append({"transfer_history.from_employee": history_assigned_by})
            
        query = {"$and": and_conditions} if len(and_conditions) > 1 else and_conditions[0]
            
        
        if content_item_id:
            query["content_item_id"] = content_item_id
        if project_id:
            query["project_id"] = project_id
        if creative_role:
            query["creative_role"] = creative_role
        if task_category:
            query["task_category"] = task_category
            
        total = await collection.count_documents(query)

        if page and limit:
            skip = (page - 1) * limit
            cursor = collection.find(query).skip(skip).limit(limit)
            total_pages = (total + limit - 1) // limit
        else:
            cursor = collection.find(query)
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
            item = await collection.find_one({"_id": ObjectId(item_id)})
            if item:
                item["_id"] = str(item["_id"])
            return item
        except Exception:
            return None

    @classmethod
    async def update(cls, item_id: str, update_data: dict):
        collection = await cls.get_collection()
        update_data["updated_at"] = datetime.utcnow()
        
        if "due_date" in update_data and update_data["due_date"]:
            if isinstance(update_data["due_date"], date) and not isinstance(update_data["due_date"], datetime):
                update_data["due_date"] = datetime.combine(update_data["due_date"], datetime.min.time())
                
        try:
            await collection.update_one({"_id": ObjectId(item_id)}, {"$set": update_data})
            return await cls.get_by_id(item_id)
        except Exception:
            return None

    @classmethod
    async def soft_delete(cls, item_id: str):
        collection = await cls.get_collection()
        try:
            await collection.update_one({"_id": ObjectId(item_id)}, {"$set": {"is_deleted": True, "updated_at": datetime.utcnow()}})
            return True
        except Exception:
            return False
