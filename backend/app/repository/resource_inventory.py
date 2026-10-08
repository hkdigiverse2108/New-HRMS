import re
from app.database.db import get_database
from bson import ObjectId
from datetime import datetime
from typing import List, Dict, Any, Optional
from app.repository.employee import EmployeeRepository

def get_category_prefix(category_name: str) -> str:
    """Extracts first 2-3 uppercase alphanumeric letters for resource ID prefix e.g. TV -> TV, Printer -> PRI."""
    clean = re.sub(r'[^a-zA-Z0-9]', '', category_name or "").upper()
    if not clean:
        return "RES"
    if len(clean) <= 3:
        return clean
    return clean[:3]

class ResourceInventoryRepository:
    collection_name = "resource_inventory"

    @classmethod
    async def get_collection(cls):
        db = get_database()
        return db[cls.collection_name]

    @classmethod
    async def generate_inventory_items(cls, category_id: str, category_name: str, count: int, created_by: Optional[dict] = None) -> List[dict]:
        if count <= 0:
            return []

        collection = await cls.get_collection()
        prefix = get_category_prefix(category_name)
        cat_id_str = str(category_id)

        # Find current highest sequence number for active items in this category
        max_seq = 0
        query = {
            "is_deleted": False,
            "$or": [
                {"category_id": cat_id_str},
                {"category_name": {"$regex": f"^{re.escape(category_name)}$", "$options": "i"}}
            ]
        }
        cursor = collection.find(query)
        async for doc in cursor:
            res_id = str(doc.get("resource_id", ""))
            match = re.search(r"-(\d+)$", res_id)
            if match:
                seq = int(match.group(1))
                if seq > max_seq:
                    max_seq = seq

        now = datetime.utcnow()
        new_docs = []
        for i in range(1, count + 1):
            next_seq = max_seq + i
            formatted_id = f"HK-{prefix}-{next_seq:03d}"
            item_doc = {
                "resource_id": formatted_id,
                "category_id": cat_id_str,
                "category_name": category_name,
                "condition": "New",
                "status": "Available",
                "assigned_to": None,
                "created_by": created_by,
                "is_deleted": False,
                "created_at": now,
                "updated_at": now
            }
            new_docs.append(item_doc)

        if new_docs:
            res = await collection.insert_many(new_docs)
            for idx, inserted_id in enumerate(res.inserted_ids):
                new_docs[idx]["_id"] = str(inserted_id)

        return new_docs

    @classmethod
    async def remove_inventory_items(cls, category_id: str, count: int) -> int:
        """
        Removes `count` inventory items belonging to `category_id`.
        Prioritizes unassigned available items starting from the latest created ones.
        """
        if count <= 0:
            return 0

        collection = await cls.get_collection()
        cat_id_str = str(category_id)

        query = {
            "is_deleted": False,
            "$or": [{"category_id": cat_id_str}]
        }

        cursor = collection.find(query).sort([("assigned_to", 1), ("created_at", -1)]).limit(count)
        ids_to_delete = []
        async for doc in cursor:
            ids_to_delete.append(doc["_id"])

        if ids_to_delete:
            now = datetime.utcnow()
            res = await collection.update_many(
                {"_id": {"$in": ids_to_delete}},
                {"$set": {"is_deleted": True, "updated_at": now}}
            )
            return res.modified_count

        return 0

    @classmethod
    async def update_category_name(cls, category_id: str, new_category_name: str) -> int:
        collection = await cls.get_collection()
        now = datetime.utcnow()
        res = await collection.update_many(
            {"category_id": str(category_id)},
            {"$set": {"category_name": str(new_category_name).strip(), "updated_at": now}}
        )
        return res.modified_count

    @classmethod
    async def delete_all_by_category(cls, category_id: str) -> int:
        collection = await cls.get_collection()
        now = datetime.utcnow()
        res = await collection.update_many(
            {"category_id": str(category_id), "is_deleted": False},
            {"$set": {"is_deleted": True, "updated_at": now}}
        )
        return res.modified_count

    @classmethod
    async def get_all(
        cls,
        is_deleted: bool = False,
        category_id: Optional[str] = None,
        status: Optional[str] = None,
        condition: Optional[str] = None,
        assigned_to_employee_id: Optional[str] = None,
        search: Optional[str] = None,
        page: int = 1,
        limit: int = 10
    ) -> Dict[str, Any]:
        collection = await cls.get_collection()
        query: Dict[str, Any] = {"is_deleted": is_deleted}

        if category_id and str(category_id).lower() != "all":
            query["$or"] = [
                {"category_id": str(category_id)},
                {"category_name": {"$regex": f"^{re.escape(str(category_id))}$", "$options": "i"}}
            ]

        if status and str(status).lower() != "all":
            query["status"] = {"$regex": f"^{re.escape(str(status))}$", "$options": "i"}

        if condition and str(condition).lower() != "all":
            query["condition"] = {"$regex": f"^{re.escape(str(condition))}$", "$options": "i"}

        if assigned_to_employee_id and str(assigned_to_employee_id).lower() != "all":
            if str(assigned_to_employee_id).lower() in ["unassigned", "none", "null"]:
                query["assigned_to"] = None
            else:
                query["$or"] = [
                    {"assigned_to.employee_id": str(assigned_to_employee_id)},
                    {"assigned_to.employee_name": {"$regex": str(assigned_to_employee_id), "$options": "i"}}
                ]

        if search:
            query["$or"] = [
                {"resource_id": {"$regex": search, "$options": "i"}},
                {"category_name": {"$regex": search, "$options": "i"}},
                {"status": {"$regex": search, "$options": "i"}},
                {"condition": {"$regex": search, "$options": "i"}},
                {"assigned_to.employee_name": {"$regex": search, "$options": "i"}}
            ]

        total = await collection.count_documents(query)

        eff_page = max(1, page)
        eff_limit = max(1, min(100, limit))
        skip = (eff_page - 1) * eff_limit

        cursor = collection.find(query).sort("created_at", -1).skip(skip).limit(eff_limit)
        items = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            if not doc.get("category_id"):
                doc["category_id"] = ""
            if not doc.get("category_name"):
                doc["category_name"] = "General"
            if not doc.get("created_at"):
                doc["created_at"] = datetime.utcnow()
            if not doc.get("updated_at"):
                doc["updated_at"] = datetime.utcnow()
            items.append(doc)

        total_pages = (total + eff_limit - 1) // eff_limit if total > 0 else 0

        return {
            "items": items,
            "data": items,
            "total": total,
            "page": eff_page,
            "limit": eff_limit,
            "total_pages": total_pages
        }

    @classmethod
    async def get_by_id(cls, item_id: str) -> Optional[Dict[str, Any]]:
        collection = await cls.get_collection()
        if not ObjectId.is_valid(item_id):
            return None
        doc = await collection.find_one({"_id": ObjectId(item_id)})
        if doc:
            doc["_id"] = str(doc["_id"])
        return doc

    @classmethod
    async def update(cls, item_id: str, update_data: dict) -> bool:
        collection = await cls.get_collection()
        if not ObjectId.is_valid(item_id):
            return False

        existing = await collection.find_one({"_id": ObjectId(item_id)})
        if not existing:
            return False

        update_payload: Dict[str, Any] = {"updated_at": datetime.utcnow()}

        if "condition" in update_data and update_data["condition"]:
            cond = str(update_data["condition"]).strip().title()
            if cond in ["New", "Good", "Fair", "Poor"]:
                update_payload["condition"] = cond

        if "status" in update_data and update_data["status"]:
            st = str(update_data["status"]).strip().title()
            if st in ["Available", "Allocated", "Maintenance"]:
                update_payload["status"] = st

        if "assigned_to_employee_id" in update_data or "assigned_to_name" in update_data:
            emp_id = update_data.get("assigned_to_employee_id")
            emp_name_input = update_data.get("assigned_to_name")

            if (emp_id and str(emp_id).strip() and str(emp_id).lower() not in ["unassigned", "none", "null"]) or (emp_name_input and str(emp_name_input).strip() not in ["unassigned", "none", "null"]):
                employee = None
                if emp_id and ObjectId.is_valid(str(emp_id)):
                    employee = await EmployeeRepository.get_by_id(str(emp_id).strip())
                if not employee and emp_name_input:
                    employee = await EmployeeRepository.get_employee_by_email(str(emp_name_input))
                if not employee and emp_name_input:
                    from app.database.db import get_database
                    emp_coll = get_database()["employees"]
                    employee = await emp_coll.find_one({
                        "$or": [
                            {"personal_info.full_name": {"$regex": f"^{re.escape(str(emp_name_input))}$", "$options": "i"}},
                            {"personal_info.first_name": {"$regex": f"^{re.escape(str(emp_name_input))}$", "$options": "i"}},
                            {"name": {"$regex": f"^{re.escape(str(emp_name_input))}$", "$options": "i"}}
                        ]
                    })

                if employee:
                    pi = employee.get("personal_info", {}) or {}
                    wd = employee.get("work_details", {}) or {}
                    fn = str(pi.get("first_name") or "").strip()
                    ln = str(pi.get("last_name") or "").strip()
                    combined_name = f"{fn} {ln}".strip()
                    full_name = str(pi.get("full_name") or combined_name or employee.get("full_name") or employee.get("name") or emp_name_input or "Employee").strip()
                    clean_name = re.sub(r'\s*\([A-Z0-9-]+\)$', '', full_name, flags=re.IGNORECASE).strip()
                    update_payload["assigned_to"] = {
                        "employee_id": str(employee["_id"]),
                        "employee_name": clean_name,
                        "assigned_date": datetime.utcnow().strftime("%Y-%m-%d")
                    }
                    update_payload["assigned_to_name"] = clean_name
                    update_payload["assigned_to_employee_id"] = str(employee["_id"])
                    update_payload["status"] = "Allocated"
                elif emp_name_input:
                    clean_name = re.sub(r'\s*\([A-Z0-9-]+\)$', '', str(emp_name_input), flags=re.IGNORECASE).strip()
                    update_payload["assigned_to"] = {
                        "employee_id": str(emp_id or ""),
                        "employee_name": clean_name,
                        "assigned_date": datetime.utcnow().strftime("%Y-%m-%d")
                    }
                    update_payload["assigned_to_name"] = clean_name
                    update_payload["assigned_to_employee_id"] = str(emp_id or "")
                    update_payload["status"] = "Allocated"
            else:
                update_payload["assigned_to"] = None
                update_payload["assigned_to_name"] = None
                update_payload["assigned_to_employee_id"] = None
                if update_payload.get("status") == "Allocated":
                    update_payload["status"] = "Available"

        res = await collection.update_one({"_id": ObjectId(item_id)}, {"$set": update_payload})
        return res.modified_count > 0 or res.matched_count > 0

    @classmethod
    async def delete(cls, item_id: str) -> bool:
        collection = await cls.get_collection()
        if not ObjectId.is_valid(item_id):
            return False
        res = await collection.update_one(
            {"_id": ObjectId(item_id)},
            {"$set": {"is_deleted": True, "updated_at": datetime.utcnow()}}
        )
        return res.modified_count > 0

    @classmethod
    async def get_dashboard_analytics(cls) -> Dict[str, Any]:
        collection = await cls.get_collection()
        cat_collection = get_database()["resource_categories"]

        # Global counters
        total_assets = await collection.count_documents({"is_deleted": False})
        allocated_assets = await collection.count_documents({"is_deleted": False, "status": {"$regex": "^allocated$", "$options": "i"}})
        available_assets = await collection.count_documents({"is_deleted": False, "status": {"$regex": "^available$", "$options": "i"}})
        in_maintenance = await collection.count_documents({"is_deleted": False, "status": {"$regex": "^maintenance$", "$options": "i"}})

        assignment_rate = round((allocated_assets / float(total_assets)) * 100.0, 1) if total_assets > 0 else 0.0

        # Fetch all non-deleted categories
        cat_cursor = cat_collection.find({"is_deleted": False}).sort("created_at", -1)
        category_summary = []

        async for cat in cat_cursor:
            cat_id = str(cat["_id"])
            cat_name = cat.get("category_name", "General")

            cat_query = {"is_deleted": False, "$or": [{"category_id": cat_id}, {"category_name": cat_name}]}

            total_items = await collection.count_documents(cat_query)
            if total_items == 0:
                total_items = int(cat.get("total_resources", 0) or 0)

            avail_stock = await collection.count_documents({**cat_query, "status": {"$regex": "^available$", "$options": "i"}})
            alloc_assigned = await collection.count_documents({**cat_query, "status": {"$regex": "^allocated$", "$options": "i"}})
            maint_count = await collection.count_documents({**cat_query, "status": {"$regex": "^maintenance$", "$options": "i"}})

            alloc_ratio = round((alloc_assigned / float(total_items)) * 100.0, 1) if total_items > 0 else 0.0

            category_summary.append({
                "category_id": cat_id,
                "category_name": cat_name,
                "total_items": total_items,
                "available_stock": avail_stock,
                "allocated_assigned": alloc_assigned,
                "in_maintenance": maint_count,
                "allocation_ratio": alloc_ratio
            })

        return {
            "total_assets": total_assets,
            "allocated_assets": allocated_assets,
            "available_assets": available_assets,
            "in_maintenance": in_maintenance,
            "assignment_rate": assignment_rate,
            "category_summary": category_summary
        }
