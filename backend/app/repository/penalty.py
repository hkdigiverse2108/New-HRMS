from app.database.db import get_database
from bson import ObjectId
from typing import Optional
from datetime import datetime, date

# Only these employee fields are shown next to a penalty
EMPLOYEE_CARD_PROJECTION = {
    "personal_info.first_name": 1,
    "personal_info.last_name": 1,
    "personal_info.profile_photo": 1,
    "personal_info.avatar": 1,
    "work_details.designation": 1,
    "work_details.system_role": 1,
    "work_details.department": 1,
}


def employee_card(emp: Optional[dict]) -> dict:
    """Flatten a projected employee doc into the name/avatar/role/department a penalty row shows."""
    if not emp:
        return {"employee_name": "Unknown", "avatar": "", "role": "Staff", "department": "General"}
    personal = emp.get("personal_info") or {}
    work = emp.get("work_details") or {}
    return {
        "employee_name": f"{personal.get('first_name', '')} {personal.get('last_name', '')}".strip() or "Employee",
        "avatar": personal.get("profile_photo") or personal.get("avatar") or "",
        "role": work.get("designation") or work.get("system_role") or "Employee",
        "department": work.get("department") or "",
    }


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
    async def count_by_type(cls, penalty_type_id: str) -> int:
        collection = await cls.get_collection()
        ids = [penalty_type_id]
        if ObjectId.is_valid(penalty_type_id):
            ids.append(ObjectId(penalty_type_id))
        return await collection.count_documents({"penalty_type_id": {"$in": ids}})

    @classmethod
    async def snapshot_type_name(cls, penalty_type_id: str, name: str) -> None:
        """Save the type name on older records that don't carry one yet, before the
        type is deleted, so they still show a name afterwards."""
        collection = await cls.get_collection()
        ids = [penalty_type_id]
        if ObjectId.is_valid(penalty_type_id):
            ids.append(ObjectId(penalty_type_id))
        await collection.update_many(
            {"penalty_type_id": {"$in": ids}, "penalty_type_name": {"$in": [None, ""]}},
            {"$set": {"penalty_type_name": name}},
        )

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
        data["status"] = data.get("status", "Active")
        data["impact_payroll"] = data.get("impact_payroll", True)
        data["resolution_reason"] = data.get("resolution_reason", None)
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
    async def get_all(
        cls, 
        is_deleted: bool = False, 
        employee_id: Optional[str] = None, 
        penalty_type_id: Optional[str] = None, 
        status: Optional[str] = None,
        type_filter: Optional[str] = None,
        search: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        page: Optional[int] = None,
        limit: Optional[int] = None
    ):
        collection = await cls.get_collection()
        query = cls._build_query(is_deleted, employee_id, penalty_type_id, status, type_filter, search, start_date, end_date)

        total = await collection.count_documents(query)

        if page and limit:
            skip = (page - 1) * limit
            cursor = collection.find(query).sort("created_at", -1).skip(skip).limit(limit)
            total_pages = (total + limit - 1) // limit
        else:
            cursor = collection.find(query).sort("created_at", -1)
            page = 1
            limit = total if total > 0 else 10
            total_pages = 1 if total > 0 else 0

        items = []
        async for item in cursor:
            items.append(cls._normalize(item))

        return {
            "data": items,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": total_pages
        }

    @classmethod
    async def get_all_populated(
        cls,
        is_deleted: bool = False,
        employee_id: Optional[str] = None,
        penalty_type_id: Optional[str] = None,
        status: Optional[str] = None,
        type_filter: Optional[str] = None,
        search: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        page: Optional[int] = None,
        limit: Optional[int] = None
    ):
        """Penalty list with only the employee and type fields the UI needs, in one aggregation."""
        collection = await cls.get_collection()
        query = cls._build_query(is_deleted, employee_id, penalty_type_id, status, type_filter, search, start_date, end_date)

        data_stages: list = [{"$sort": {"created_at": -1}}]
        if page and limit:
            data_stages += [{"$skip": (page - 1) * limit}, {"$limit": limit}]
        data_stages += [
            {"$lookup": {
                "from": "employees",
                "let": {"eid": "$employee_id"},
                "pipeline": [
                    {"$match": {"$expr": {"$eq": ["$_id", {"$convert": {"input": "$$eid", "to": "objectId", "onError": None, "onNull": None}}]}}},
                    {"$project": {"_id": 0, **EMPLOYEE_CARD_PROJECTION}},
                ],
                "as": "emp",
            }},
            {"$lookup": {
                "from": PenaltyTypeRepository.collection_name,
                "let": {"tid": "$penalty_type_id"},
                "pipeline": [
                    {"$match": {"$expr": {"$eq": ["$_id", {"$convert": {"input": "$$tid", "to": "objectId", "onError": None, "onNull": None}}]}}},
                    {"$project": {"_id": 0, "name": 1}},
                ],
                "as": "ptype",
            }},
            {"$project": {
                "employee_id": 1, "penalty_type_id": 1, "reason": 1, "penalty_date": 1,
                "price": 1, "is_warning": 1, "status": 1, "resolution_reason": 1,
                "impact_payroll": 1, "is_deleted": 1, "created_at": 1,
                "emp": {"$first": "$emp"},
                # Live type name (renames apply to old records); saved name once the type is deleted
                "penalty_type_name": {"$ifNull": [{"$first": "$ptype.name"}, "$penalty_type_name"]},
            }},
        ]

        pipeline = [
            {"$match": query},
            {"$facet": {"data": data_stages, "total": [{"$count": "n"}]}},
        ]
        result = await collection.aggregate(pipeline).to_list(1)
        facet = result[0] if result else {"data": [], "total": []}
        total = facet["total"][0]["n"] if facet["total"] else 0

        items = []
        for item in facet["data"]:
            item = cls._normalize(item)
            item.update(employee_card(item.pop("emp", None)))
            items.append(item)

        if page and limit:
            total_pages = (total + limit - 1) // limit
        else:
            page = 1
            limit = total if total > 0 else 10
            total_pages = 1 if total > 0 else 0

        return {
            "data": items,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": total_pages
        }

    @staticmethod
    def _normalize(item: dict) -> dict:
        item["_id"] = str(item["_id"])
        if "employee_id" in item:
            item["employee_id"] = str(item["employee_id"])
        if "penalty_type_id" in item:
            item["penalty_type_id"] = str(item["penalty_type_id"])
        if "status" not in item:
            item["status"] = "Active"
        if "impact_payroll" not in item:
            item["impact_payroll"] = not item.get("is_warning", False) and (float(item.get("price", 0)) > 0)
        if "resolution_reason" not in item:
            item["resolution_reason"] = None
        return item

    @staticmethod
    def _build_query(
        is_deleted: bool,
        employee_id: Optional[str],
        penalty_type_id: Optional[str],
        status: Optional[str],
        type_filter: Optional[str],
        search: Optional[str],
        start_date: Optional[str],
        end_date: Optional[str],
    ) -> dict:
        query = {"is_deleted": is_deleted}
        
        if employee_id and ObjectId.is_valid(str(employee_id)):
            query["employee_id"] = ObjectId(str(employee_id))
        if penalty_type_id and ObjectId.is_valid(str(penalty_type_id)):
            query["penalty_type_id"] = ObjectId(str(penalty_type_id))
            
        if status:
            if status == "Active":
                query["$or"] = [{"status": "Active"}, {"status": {"$exists": False}}]
            else:
                query["status"] = status
                
        if type_filter:
            if type_filter.lower() == "warning":
                query["is_warning"] = True
            elif type_filter.lower() == "penalty":
                query["is_warning"] = False
                
        if search:
            query["reason"] = {"$regex": search, "$options": "i"}
            
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

        return query

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
                
        # If status is Waived and impact_payroll is not explicitly set, disable payroll impact
        if update_data.get("status") == "Waived" and "impact_payroll" not in update_data:
            update_data["impact_payroll"] = False

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
    async def get_leaderboard(cls, month: Optional[int] = None, year: Optional[int] = None):
        collection = await cls.get_collection()
        match: dict = {"is_deleted": False}
        # Month-wise leaderboard (Audio PDF): current month default, changeable
        if month and year:
            try:
                start = datetime(year, int(month), 1)
                end = datetime(year + 1, 1, 1) if int(month) == 12 else datetime(year, int(month) + 1, 1)
                match["penalty_date"] = {"$gte": start, "$lt": end}
            except Exception:
                pass
        pipeline = [
            {"$match": match},
            {"$group": {
                "_id": "$employee_id",
                "total_violations": {"$sum": 1},
                "total_penalty_amount": {
                    "$sum": {
                        "$cond": [
                            {"$or": [
                                {"$eq": ["$is_warning", True]},
                                {"$eq": ["$status", "Waived"]}
                            ]},
                            0,
                            {"$ifNull": ["$price", 0]}
                        ]
                    }
                }
            }},
            {"$facet": {
                "top_by_violations": [
                    {"$sort": {"total_violations": -1, "total_penalty_amount": -1}},
                    {"$limit": 10}
                ],
                "top_by_amount": [
                    {"$sort": {"total_penalty_amount": -1, "total_violations": -1}},
                    {"$limit": 10}
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

    @classmethod
    async def get_summary_stats(cls):
        collection = await cls.get_collection()
        
        # 1. Total Active penalties (status != Waived/Resolved)
        active_count = await collection.count_documents({
            "is_deleted": False,
            "status": {"$in": ["Active", None]}
        })
        
        # 2. Total payroll deductions (active, financial, impact_payroll != False)
        pipeline = [
            {
                "$match": {
                    "is_deleted": False,
                    "status": {"$in": ["Active", None]},
                    "is_warning": False,
                    "impact_payroll": {"$ne": False}
                }
            },
            {
                "$group": {
                    "_id": None,
                    "total_amount": {"$sum": {"$ifNull": ["$price", 0]}}
                }
            }
        ]
        total_deductions = 0.0
        async for doc in collection.aggregate(pipeline):
            total_deductions = float(doc.get("total_amount", 0.0))

        return {
            "active_penalties_count": active_count,
            "total_payroll_deductions": total_deductions
        }

