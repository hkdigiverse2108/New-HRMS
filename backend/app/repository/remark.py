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

class RemarkRepository:
    collection_name = "remarks"

    @classmethod
    async def get_collection(cls):
        db = get_database()
        return db[cls.collection_name]

    @classmethod
    async def create_remark(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        collection = await cls.get_collection()
        now = datetime.utcnow()
        doc = {
            **data,
            "created_at": now,
            "updated_at": now
        }
        result = await collection.insert_one(doc)
        doc["_id"] = result.inserted_id
        return serialize_mongo(doc)

    @classmethod
    async def get_remark_by_id(cls, remark_id: str) -> Optional[Dict[str, Any]]:
        collection = await cls.get_collection()
        doc = await collection.find_one({"_id": ObjectId(remark_id)})
        return serialize_mongo(doc) if doc else None

    @classmethod
    async def get_all_remarks(cls, query: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        collection = await cls.get_collection()
        query = query or {}
        cursor = collection.find(query).sort("created_at", -1)
        records = []
        async for doc in cursor:
            records.append(serialize_mongo(doc))
        return records

    @classmethod
    async def update_remark(cls, remark_id: str, update_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        collection = await cls.get_collection()
        update_data["updated_at"] = datetime.utcnow()
        await collection.update_one(
            {"_id": ObjectId(remark_id)},
            {"$set": update_data}
        )
        return await cls.get_remark_by_id(remark_id)

    @classmethod
    async def delete_remark(cls, remark_id: str) -> bool:
        collection = await cls.get_collection()
        result = await collection.delete_one({"_id": ObjectId(remark_id)})
        return result.deleted_count > 0

    @classmethod
    async def get_all_questions(cls, query: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        db = get_database()
        collection = db["remark_questions"]
        query = query or {}
        cursor = collection.find(query).sort("created_at", 1)
        records = []
        async for doc in cursor:
            records.append(serialize_mongo(doc))
        return records

    @classmethod
    async def create_question(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        db = get_database()
        collection = db["remark_questions"]
        now = datetime.utcnow()
        doc = {
            **data,
            "created_at": now,
            "updated_at": now
        }
        result = await collection.insert_one(doc)
        doc["_id"] = result.inserted_id
        return serialize_mongo(doc)

    @classmethod
    async def get_question_by_id(cls, question_id: str) -> Optional[Dict[str, Any]]:
        db = get_database()
        collection = db["remark_questions"]
        doc = await collection.find_one({"_id": ObjectId(question_id)})
        return serialize_mongo(doc) if doc else None

    @classmethod
    async def update_question(cls, question_id: str, update_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        db = get_database()
        collection = db["remark_questions"]
        update_data["updated_at"] = datetime.utcnow()
        await collection.update_one(
            {"_id": ObjectId(question_id)},
            {"$set": update_data}
        )
        return await cls.get_question_by_id(question_id)

    @classmethod
    async def delete_question(cls, question_id: str) -> bool:
        db = get_database()
        collection = db["remark_questions"]
        result = await collection.delete_one({"_id": ObjectId(question_id)})
        return result.deleted_count > 0
