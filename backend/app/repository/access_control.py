from app.database.db import get_database
from bson.objectid import ObjectId
from bson.errors import InvalidId
from typing import List, Dict, Any, Optional, Tuple

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
    s_val = str(val).strip()
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
    s_val = str(dept_val).strip()
    if s_val == "all":
        return ["all"]
        
    db = get_database()
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
    s_val = str(desig_val).strip()
    if s_val == "all":
        return ["all"]
        
    db = get_database()
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
    async def create_user_permission(cls, item_data: dict, is_custom: bool = True) -> dict:
        collection = await cls.get_collection()
        emp_id_str = str(item_data["employee_id"]).strip()
        item_data["employee_id"] = emp_id_str
        item_data["is_custom"] = is_custom

        # Find any existing document(s) for this employee
        existing = await collection.find_one({"employee_id": make_id_query_val(emp_id_str)})
        if existing:
            await collection.update_one(
                {"_id": existing["_id"]},
                {"$set": {
                    "module_permissions": item_data["module_permissions"],
                    "is_custom": is_custom,
                    "employee_id": emp_id_str
                }}
            )
            # Remove any duplicate records for the same employee
            await collection.delete_many({
                "employee_id": make_id_query_val(emp_id_str),
                "_id": {"$ne": existing["_id"]}
            })
            existing["module_permissions"] = item_data["module_permissions"]
            existing["_id"] = str(existing["_id"])
            existing["employee_id"] = emp_id_str
            existing["is_custom"] = is_custom
            return existing
        else:
            result = await collection.insert_one(item_data)
            item_data["_id"] = str(result.inserted_id)
            return item_data

    @classmethod
    async def get_user_permission(cls, employee_id: str) -> Optional[dict]:
        collection = await cls.get_collection()
        if not employee_id:
            return None
        emp_id_str = str(employee_id).strip()
        items = []
        async for doc in collection.find({"employee_id": make_id_query_val(emp_id_str)}):
            items.append(doc)
            
        if not items:
            return None
            
        # If multiple exist, clean up duplicates and pick the best one
        if len(items) > 1:
            # Pick custom one if exists, or one with most permissions
            best = max(items, key=lambda x: (1 if x.get("is_custom") else 0, len(x.get("module_permissions", {}))))
            await collection.delete_many({
                "employee_id": make_id_query_val(emp_id_str),
                "_id": {"$ne": best["_id"]}
            })
            chosen = best
        else:
            chosen = items[0]

        chosen["_id"] = str(chosen["_id"])
        chosen["employee_id"] = str(chosen["employee_id"])
        return chosen

    @classmethod
    async def update_user_permission(cls, employee_id: str, module_permissions: dict, is_custom: bool = True) -> bool:
        collection = await cls.get_collection()
        emp_id_str = str(employee_id).strip()
        result = await collection.update_one(
            {"employee_id": make_id_query_val(emp_id_str)},
            {"$set": {"module_permissions": module_permissions, "is_custom": is_custom, "employee_id": emp_id_str}}
        )
        return result.modified_count > 0

    @classmethod
    async def delete_user_permission(cls, employee_id: str) -> bool:
        collection = await cls.get_collection()
        emp_id_str = str(employee_id).strip()
        result = await collection.delete_many({"employee_id": make_id_query_val(emp_id_str)})
        return result.deleted_count > 0

    @classmethod
    async def get_all_user_permissions(cls) -> List[dict]:
        collection = await cls.get_collection()
        cursor = collection.find({})
        items = await cursor.to_list(1000)
        for it in items:
            it["_id"] = str(it["_id"])
            it["employee_id"] = str(it["employee_id"])
        return items


class PresetPermissionRepository:
    collection_name = "permission_presets"

    @classmethod
    async def get_collection(cls):
        db = get_database()
        return db[cls.collection_name]

    @classmethod
    async def create_preset(cls, item_data: dict) -> dict:
        collection = await cls.get_collection()
        role = str(item_data.get("role") or "").strip()
        
        # If role is provided, upsert by role
        if role:
            query = {"role": role}
            existing = await collection.find_one(query)
            if existing:
                await collection.update_one(
                    {"_id": existing["_id"]},
                    {"$set": {
                        "module_permissions": item_data["module_permissions"],
                        "role": role
                    }}
                )
                existing["module_permissions"] = item_data["module_permissions"]
                existing["_id"] = str(existing["_id"])
                existing["role"] = role
                return existing
            else:
                doc = {
                    "role": role,
                    "module_permissions": item_data["module_permissions"],
                    "department_id": str(item_data.get("department_id") or "all"),
                    "designation_id": str(item_data.get("designation_id") or "all"),
                }
                result = await collection.insert_one(doc)
                doc["_id"] = str(result.inserted_id)
                return doc
        else:
            # Fallback for dept/desig if passed
            dept_id = str(item_data.get("department_id", "all")).strip()
            desig_id = str(item_data.get("designation_id", "all")).strip()
            query = {"department_id": dept_id, "designation_id": desig_id}
            existing = await collection.find_one(query)
            if existing:
                await collection.update_one(
                    {"_id": existing["_id"]},
                    {"$set": {"module_permissions": item_data["module_permissions"]}}
                )
                existing["module_permissions"] = item_data["module_permissions"]
                existing["_id"] = str(existing["_id"])
                return existing
            else:
                result = await collection.insert_one(item_data)
                item_data["_id"] = str(result.inserted_id)
                return item_data

    @classmethod
    async def get_preset_by_role(cls, role: str) -> Optional[dict]:
        collection = await cls.get_collection()
        if not role:
            return None
        role_clean = str(role).strip()
        item = await collection.find_one({"role": role_clean})
        if item:
            item["_id"] = str(item["_id"])
            item["role"] = role_clean
        return item

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
    async def get_preset_for_employee(cls, role: Optional[str]) -> Tuple[Optional[dict], str]:
        """
        Dynamically finds the matching preset for an employee based on their role:
        1. Exact Role match (e.g. 'HR', 'Employee', 'Sub-Admin', 'Admin')
        2. Fallback to 'Employee' preset if available
        3. Fallback to DEFAULT_EMPLOYEE_PERMISSIONS
        """
        collection = await cls.get_collection()
        role_clean = str(role).strip() if role else "Employee"
        
        # 1. Match role preset
        preset = await collection.find_one({"role": role_clean})
        if preset and "module_permissions" in preset:
            preset["_id"] = str(preset["_id"])
            return preset, f"Role Preset ({role_clean})"

        # 2. Fallback to Employee role preset if specific role preset doesn't exist
        if role_clean != "Employee":
            emp_preset = await collection.find_one({"role": "Employee"})
            if emp_preset and "module_permissions" in emp_preset:
                emp_preset["_id"] = str(emp_preset["_id"])
                return emp_preset, "Role Preset (Employee)"

        # 3. Fallback to legacy global preset if exists
        global_doc = await collection.find_one({"department_id": "all", "designation_id": "all"})
        if global_doc and "module_permissions" in global_doc:
            global_doc["_id"] = str(global_doc["_id"])
            return global_doc, "Global Preset"

        return None, "Default System Permissions"

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

    @classmethod
    async def get_all_presets(cls) -> List[dict]:
        collection = await cls.get_collection()
        cursor = collection.find({})
        items = await cursor.to_list(1000)
        for it in items:
            it["_id"] = str(it["_id"])
            it["role"] = str(it.get("role", "Employee"))
            it["department_id"] = str(it.get("department_id", "all"))
            it["designation_id"] = str(it.get("designation_id", "all"))
        return items
