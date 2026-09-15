from app.database.db import get_database
from bson import ObjectId
from typing import Optional
from datetime import datetime, date

class PenaltyTypeRepository:
    collection_name = "penalty_types"

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
    async def get_all(cls):
        collection = await cls.get_collection()
        items = []
        async for item in collection.find():
            item["_id"] = str(item["_id"])
            items.append(item)
        return items

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
        try:
            await collection.update_one({"_id": ObjectId(item_id)}, {"$set": update_data})
            return await cls.get_by_id(item_id)
        except Exception:
            return None

    @classmethod
    async def delete(cls, item_id: str):
        collection = await cls.get_collection()
        try:
            result = await collection.delete_one({"_id": ObjectId(item_id)})
            return result.deleted_count > 0
        except Exception:
            return False

class EmployeePenaltyRepository:
    collection_name = "employee_penalties"

    @classmethod
    async def get_collection(cls):
        db = get_database()
        return db[cls.collection_name]

    @classmethod
    async def create(cls, data: dict):
        collection = await cls.get_collection()
        data["created_at"] = datetime.utcnow()
        if data.get("penalty_date"):
            if isinstance(data["penalty_date"], date) and not isinstance(data["penalty_date"], datetime):
                data["penalty_date"] = datetime.combine(data["penalty_date"], datetime.min.time())
        else:
            data["penalty_date"] = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            
        data["is_deleted"] = False
        if "employee_id" in data:
            data["employee_id"] = ObjectId(data["employee_id"])
        if "penalty_type_id" in data:
            data["penalty_type_id"] = ObjectId(data["penalty_type_id"])
            
        result = await collection.insert_one(data)
        data["_id"] = str(result.inserted_id)
        if "employee_id" in data:
            data["employee_id"] = str(data["employee_id"])
        if "penalty_type_id" in data:
            data["penalty_type_id"] = str(data["penalty_type_id"])
        return data

    @classmethod
    async def get_all(cls, is_deleted: bool = False, employee_id: Optional[str] = None, penalty_type_id: Optional[str] = None, start_date: Optional[str] = None, end_date: Optional[str] = None, page: Optional[int] = None, limit: Optional[int] = None):
        collection = await cls.get_collection()
        query = {"is_deleted": is_deleted}
        if employee_id:
            query["employee_id"] = ObjectId(employee_id)
        if penalty_type_id:
            query["penalty_type_id"] = ObjectId(penalty_type_id)
            
        if start_date or end_date:
            query["penalty_date"] = {}
            if start_date:
                try:
                    s_date = datetime.strptime(start_date, "%Y-%m-%d")
                    query["penalty_date"]["$gte"] = s_date
                except ValueError:
                    pass
            if end_date:
                try:
                    e_date = datetime.strptime(end_date, "%Y-%m-%d")
                    e_date = e_date.replace(hour=23, minute=59, second=59, microsecond=999999)
                    query["penalty_date"]["$lte"] = e_date
                except ValueError:
                    pass
            if not query["penalty_date"]:
                del query["penalty_date"]

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
            if "employee_id" in item:
                item["employee_id"] = str(item["employee_id"])
            if "penalty_type_id" in item:
                item["penalty_type_id"] = str(item["penalty_type_id"])
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
                if "employee_id" in item:
                    item["employee_id"] = str(item["employee_id"])
                if "penalty_type_id" in item:
                    item["penalty_type_id"] = str(item["penalty_type_id"])
            return item
        except Exception:
            return None

    @classmethod
    async def update(cls, item_id: str, update_data: dict):
        collection = await cls.get_collection()
        if "penalty_type_id" in update_data and update_data["penalty_type_id"]:
            update_data["penalty_type_id"] = ObjectId(update_data["penalty_type_id"])
            
        if "penalty_date" in update_data and update_data["penalty_date"]:
            if isinstance(update_data["penalty_date"], date) and not isinstance(update_data["penalty_date"], datetime):
                update_data["penalty_date"] = datetime.combine(update_data["penalty_date"], datetime.min.time())
                
        try:
            await collection.update_one({"_id": ObjectId(item_id)}, {"$set": update_data})
            return await cls.get_by_id(item_id)
        except Exception:
            return None

    @classmethod
    async def soft_delete(cls, item_id: str):
        collection = await cls.get_collection()
        try:
            await collection.update_one({"_id": ObjectId(item_id)}, {"$set": {"is_deleted": True}})
            return True
        except Exception:
            return False

    @classmethod
    async def get_leaderboard(cls):
        collection = await cls.get_collection()
        pipeline = [
            {"$match": {"is_deleted": False}},
            {"$group": {
                "_id": "$employee_id",
                "total_violations": {"$sum": 1},
                "total_penalty_amount": {"$sum": {"$cond": [{"$eq": ["$is_warning", True]}, 0, "$price"]}}
            }},
            {"$facet": {
                "top_by_violations": [
                    {"$sort": {"total_violations": -1}},
                    {"$limit": 5}
                ],
                "top_by_amount": [
                    {"$sort": {"total_penalty_amount": -1}},
                    {"$limit": 5}
                ]
            }}
        ]
        
        result = []
        async for doc in collection.aggregate(pipeline):
            result.append(doc)
            
        if not result:
            return {"top_by_violations": [], "top_by_amount": []}
            
        facets = result[0]
        
        # Cleanup _id to employee_id and stringify
        for item in facets.get("top_by_violations", []):
            item["employee_id"] = str(item.pop("_id"))
            
        for item in facets.get("top_by_amount", []):
            item["employee_id"] = str(item.pop("_id"))
            
        return facets
