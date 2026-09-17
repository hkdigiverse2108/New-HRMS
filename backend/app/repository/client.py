from app.database.db import get_database
from datetime import datetime
from bson import ObjectId
from typing import Optional

class ClientRepository:
    collection_name = "clients"

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
        data["is_archived"] = False
        
        result = await collection.insert_one(data)
        data["_id"] = str(result.inserted_id)
        return data

    @classmethod
    async def get_all(cls, is_deleted: bool = False, is_archived: bool = False, search: Optional[str] = None, project_category: Optional[str] = None, page: Optional[int] = None, limit: Optional[int] = None):
        collection = await cls.get_collection()
        
        query = {"is_deleted": is_deleted}
        if is_archived:
            query["is_archived"] = True
        else:
            query["is_archived"] = {"$ne": True}
            
        if project_category:
            from app.repository.project import ProjectRepository
            project_coll = await ProjectRepository.get_collection()
            clean_category = project_category.lower().replace(" ", "").replace("_", "")
            cat_map = {"development": "Development", "creative": "Creative", "digitalmarketing": "Digital Marketing", "sales": "Sales"}
            mapped_cat = cat_map.get(clean_category, project_category)
            
            proj_query = {"is_deleted": False, "general.category": {"$in": [mapped_cat, clean_category, project_category]}}
            matching_projects = await project_coll.find(proj_query).to_list(length=None)
            
            from bson.objectid import ObjectId
            client_ids = []
            for p in matching_projects:
                if "client_id" in p and ObjectId.is_valid(p["client_id"]):
                    client_ids.append(ObjectId(p["client_id"]))
                    
            if client_ids:
                query["_id"] = {"$in": client_ids}
            else:
                query["_id"] = {"$in": []}
        
        if search:
            query["$or"] = [
                {"contact_person_name": {"$regex": search, "$options": "i"}},
                {"company_name": {"$regex": search, "$options": "i"}},
                {"phone_number": {"$regex": search, "$options": "i"}},
                {"email_address": {"$regex": search, "$options": "i"}}
            ]
            
        total_count = await collection.count_documents(query)
        
        cursor = collection.find(query)
        
        if page and limit:
            skip = (page - 1) * limit
            cursor = cursor.skip(skip).limit(limit)
            
        items = await cursor.to_list(length=limit or 1000)
        
        for item in items:
            item["_id"] = str(item["_id"])
            
        return {
            "data": items,
            "total": total_count,
            "page": page or 1,
            "limit": limit or total_count or 1,
            "total_pages": (total_count + (limit or 1) - 1) // (limit or 1) if limit else 1
        }

    @classmethod
    async def get_by_id(cls, client_id: str):
        collection = await cls.get_collection()
        if not ObjectId.is_valid(client_id):
            return None
        item = await collection.find_one({"_id": ObjectId(client_id)})
        if item:
            item["_id"] = str(item["_id"])
        return item

    @classmethod
    async def update(cls, client_id: str, data: dict):
        collection = await cls.get_collection()
        if not ObjectId.is_valid(client_id):
            return False
            
        data["updated_at"] = datetime.utcnow()
        result = await collection.update_one(
            {"_id": ObjectId(client_id)},
            {"$set": data}
        )
        return result.modified_count > 0

    @classmethod
    async def delete(cls, client_id: str):
        collection = await cls.get_collection()
        if not ObjectId.is_valid(client_id):
            return False
            
        result = await collection.update_one(
            {"_id": ObjectId(client_id)},
            {"$set": {"is_deleted": True, "updated_at": datetime.utcnow()}}
        )
        return result.modified_count > 0

    @classmethod
    async def archive(cls, client_id: str, status: bool = True):
        collection = await cls.get_collection()
        if not ObjectId.is_valid(client_id):
            return False
            
        result = await collection.update_one(
            {"_id": ObjectId(client_id)},
            {"$set": {"is_archived": status, "updated_at": datetime.utcnow()}}
        )
        return result.modified_count > 0
