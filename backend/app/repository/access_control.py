from app.database.db import get_database
from bson.objectid import ObjectId
from bson.errors import InvalidId
from typing import List, Dict, Any, Optional

def has_manual_permissions(module_permissions: Optional[dict]) -> bool:
    if not module_permissions or not isinstance(module_permissions, dict):
        return False
    
    def _check_truthy(obj):
        if isinstance(obj, bool):
            return obj
        if isinstance(obj, dict):
            return any(_check_truthy(v) for v in obj.values())
        if isinstance(obj, list):
            return any(_check_truthy(v) for v in obj)
        return False

    return _check_truthy(module_permissions)

def make_id_query_val(val: Any):
    if not val:
        return val
    s_val = str(val)
    vals = [s_val]
    try:
        if ObjectId.is_valid(s_val):
            vals.append(ObjectId(s_val))
    except Exception:
        pass
    return {"$in": vals}

async def resolve_department_values(dept_val: Any) -> list:
    if not dept_val:
        return []
    db = get_database()
    s_val = str(dept_val).strip()
    vals = {s_val}
    if ObjectId.is_valid(s_val):
        vals.add(ObjectId(s_val))
        try:
            doc = await db["departments"].find_one({"_id": ObjectId(s_val)})
            if doc and doc.get("name"):
                vals.add(doc["name"])
        except Exception:
            pass
            
    try:
        doc_name = await db["departments"].find_one({"name": s_val})
        if doc_name and "_id" in doc_name:
            vals.add(str(doc_name["_id"]))
            vals.add(doc_name["_id"])
    except Exception:
        pass
        
    return list(vals)

async def resolve_designation_values(desig_val: Any) -> list:
    if not desig_val:
        return []
    db = get_database()
    s_val = str(desig_val).strip()
    vals = {s_val}
    if ObjectId.is_valid(s_val):
        vals.add(ObjectId(s_val))
        try:
            doc = await db["designations"].find_one({"_id": ObjectId(s_val)})
            if doc and doc.get("name"):
                vals.add(doc["name"])
        except Exception:
            pass
            
    try:
        doc_name = await db["designations"].find_one({"name": s_val})
        if doc_name and "_id" in doc_name:
            vals.add(str(doc_name["_id"]))
            vals.add(doc_name["_id"])
    except Exception:
        pass
        
    return list(vals)


class UserPermissionRepository:
    collection_name = "user_permissions"

    @classmethod
    async def get_collection(cls):
        db = get_database()
        return db[cls.collection_name]

    @classmethod
    async def create_user_permission(cls, item_data: dict) -> dict:
        collection = await cls.get_collection()
        emp_id_str = str(item_data["employee_id"])
        
        # Check if user already exists, update instead of create
        existing = await collection.find_one({"employee_id": make_id_query_val(emp_id_str)})
        if existing:
            await collection.update_one(
                {"_id": existing["_id"]},
                {"$set": {"module_permissions": item_data["module_permissions"]}}
            )
            existing["module_permissions"] = item_data["module_permissions"]
            existing["_id"] = str(existing["_id"])
            existing["employee_id"] = str(existing["employee_id"])
            return existing
        else:
            try:
                if ObjectId.is_valid(emp_id_str):
                    item_data["employee_id"] = ObjectId(emp_id_str)
                else:
                    item_data["employee_id"] = emp_id_str
            except Exception:
                item_data["employee_id"] = emp_id_str

            result = await collection.insert_one(item_data)
            item_data["_id"] = str(result.inserted_id)
            item_data["employee_id"] = str(item_data["employee_id"])
            return item_data

    @classmethod
    async def get_user_permission(cls, employee_id: str) -> Optional[dict]:
        collection = await cls.get_collection()
        if not employee_id:
            return None
        item = await collection.find_one({"employee_id": make_id_query_val(employee_id)})
        if item:
            item["_id"] = str(item["_id"])
            item["employee_id"] = str(item["employee_id"])
        return item

    @classmethod
    async def update_user_permission(cls, employee_id: str, module_permissions: dict) -> bool:
        collection = await cls.get_collection()
        result = await collection.update_one(
            {"employee_id": make_id_query_val(employee_id)},
            {"$set": {"module_permissions": module_permissions}}
        )
        return result.modified_count > 0

    @classmethod
    async def delete_user_permission(cls, employee_id: str) -> bool:
        collection = await cls.get_collection()
        result = await collection.delete_one({"employee_id": make_id_query_val(employee_id)})
        return result.deleted_count > 0

class PresetPermissionRepository:
    collection_name = "permission_presets"

    @classmethod
    async def get_collection(cls):
        db = get_database()
        return db[cls.collection_name]

    @classmethod
    async def create_preset(cls, item_data: dict) -> dict:
        collection = await cls.get_collection()
        dept_id = str(item_data["department_id"])
        desig_id = str(item_data["designation_id"])
        
        dept_vals = await resolve_department_values(dept_id)
        desig_vals = await resolve_designation_values(desig_id)
        
        dept_or = [{"department_id": v} for v in dept_vals]
        desig_or = [{"designation_id": v} for v in desig_vals]

        # Check if preset already exists for this dept and desig, update instead of create
        existing = await collection.find_one({
            "$and": [
                {"$or": dept_or},
                {"$or": desig_or}
            ]
        })
        if existing:
            await collection.update_one(
                {"_id": existing["_id"]},
                {"$set": {"module_permissions": item_data["module_permissions"]}}
            )
            existing["module_permissions"] = item_data["module_permissions"]
            existing["_id"] = str(existing["_id"])
            existing["department_id"] = str(existing.get("department_id", dept_id))
            existing["designation_id"] = str(existing.get("designation_id", desig_id))
            return existing
        else:
            item_data["department_id"] = dept_id
            item_data["designation_id"] = desig_id
            result = await collection.insert_one(item_data)
            item_data["_id"] = str(result.inserted_id)
            return item_data

    @classmethod
    async def get_preset_by_id(cls, preset_id: str) -> Optional[dict]:
        collection = await cls.get_collection()
        try:
            item = await collection.find_one({"_id": ObjectId(preset_id)})
            if item:
                item["_id"] = str(item["_id"])
            return item
        except InvalidId:
            return None

    @classmethod
    async def get_preset(cls, department_id: str, designation_id: str) -> Optional[dict]:
        collection = await cls.get_collection()
        if not department_id or not designation_id:
            return None
            
        dept_vals = await resolve_department_values(department_id)
        desig_vals = await resolve_designation_values(designation_id)
        
        dept_or = [{"department_id": v} for v in dept_vals]
        desig_or = [{"designation_id": v} for v in desig_vals]

        item = await collection.find_one({
            "$and": [
                {"$or": dept_or},
                {"$or": desig_or}
            ]
        })
        if item:
            item["_id"] = str(item["_id"])
            item["department_id"] = str(item.get("department_id", department_id))
            item["designation_id"] = str(item.get("designation_id", designation_id))
        return item

    @classmethod
    async def update_preset(cls, preset_id: str, module_permissions: dict) -> bool:
        collection = await cls.get_collection()
        result = await collection.update_one(
            {"_id": ObjectId(preset_id)},
            {"$set": {"module_permissions": module_permissions}}
        )
        return result.modified_count > 0

    @classmethod
    async def delete_preset(cls, preset_id: str) -> bool:
        collection = await cls.get_collection()
        result = await collection.delete_one({"_id": ObjectId(preset_id)})
        return result.deleted_count > 0


