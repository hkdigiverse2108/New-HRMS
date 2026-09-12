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

class LeaveRepository:
    collection_name = "leave_requests"

    @classmethod
    async def get_collection(cls):
        db = get_database()
        return db[cls.collection_name]

    @classmethod
    async def create_leave(cls, leave_data: Dict[str, Any]) -> Dict[str, Any]:
        collection = await cls.get_collection()
        leave_data["applied_on"] = leave_data.get("applied_on") or datetime.utcnow().strftime("%Y-%m-%d")
        leave_data["created_at"] = datetime.utcnow().isoformat()
        result = await collection.insert_one(leave_data)
        leave_data["id"] = str(result.inserted_id)
        leave_data["_id"] = str(result.inserted_id)
        return serialize_mongo(leave_data)

    @classmethod
    async def get_by_id(cls, leave_id: str) -> Optional[Dict[str, Any]]:
        collection = await cls.get_collection()
        try:
            doc = await collection.find_one({"_id": ObjectId(leave_id)})
        except Exception:
            doc = await collection.find_one({"id": leave_id})
        return serialize_mongo(doc)

    @classmethod
    async def update_status(
        cls,
        leave_id: str,
        status: str,
        rejection_reason: Optional[str] = None,
        decided_by: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        collection = await cls.get_collection()
        try:
            filter_query = {"_id": ObjectId(leave_id)}
        except Exception:
            filter_query = {"_id": leave_id}

        update_fields: Dict[str, Any] = {
            "status": status,
            "decided_by": decided_by or "Admin",
            "decided_at": datetime.utcnow().isoformat()
        }
        if rejection_reason is not None:
            update_fields["rejection_reason"] = rejection_reason

        await collection.update_one(filter_query, {"$set": update_fields})
        return await cls.get_by_id(leave_id)

    @classmethod
    async def get_leaves(
        cls,
        employee_id: Optional[str] = None,
        status: Optional[str] = None,
        leave_type: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        page: Optional[int] = None,
        limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        collection = await cls.get_collection()
        query: Dict[str, Any] = {}
        if employee_id:
            query["employee_id"] = employee_id
        if status and status != "All":
            query["status"] = status
        if leave_type and leave_type != "All":
            query["type"] = leave_type
        if start_date and end_date:
            query["$or"] = [
                {"start_date": {"$lte": end_date}, "end_date": {"$gte": start_date}}
            ]
        elif start_date:
            query["end_date"] = {"$gte": start_date}
        elif end_date:
            query["start_date"] = {"$lte": end_date}

        cursor = collection.find(query).sort("applied_on", -1)
        if limit is not None and limit > 0:
            if page is not None and page > 1:
                cursor = cursor.skip((page - 1) * limit)
            cursor = cursor.limit(limit)

        results = []
        async for doc in cursor:
            results.append(serialize_mongo(doc))
        return results

    @classmethod
    async def get_approved_leave_for_date(cls, employee_id: str, date_str: str) -> Optional[Dict[str, Any]]:
        collection = await cls.get_collection()
        doc = await collection.find_one({
            "employee_id": employee_id,
            "status": "Approved",
            "start_date": {"$lte": date_str},
            "end_date": {"$gte": date_str}
        })
        return serialize_mongo(doc)

