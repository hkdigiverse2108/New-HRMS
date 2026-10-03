from app.database.db import get_database
from datetime import datetime
from bson import ObjectId
from typing import Optional, List, Dict, Any

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

class SalesRepository:
    collection_name = "sales_leads"
    targets_collection_name = "sales_targets"

    @classmethod
    async def get_collection(cls):
        db = get_database()
        return db[cls.collection_name]

    @classmethod
    async def get_targets_collection(cls):
        db = get_database()
        return db[cls.targets_collection_name]

    @classmethod
    def _normalize_lead(cls, doc: dict) -> dict:
        if not doc:
            return doc
        doc = serialize_mongo(doc)
        doc["id"] = str(doc.get("_id", ""))
        # Normalize fields for frontend consistency
        if "assigned_to" in doc and not doc.get("assignedTo"):
            doc["assignedTo"] = doc["assigned_to"]
        elif "assignedTo" in doc and not doc.get("assigned_to"):
            doc["assigned_to"] = doc["assignedTo"]

        if "expected_income" in doc and not doc.get("expectedIncome"):
            doc["expectedIncome"] = doc["expected_income"]
        elif "expectedIncome" in doc and not doc.get("expected_income"):
            doc["expected_income"] = doc["expectedIncome"]

        if "is_hot" in doc and not doc.get("isHot"):
            doc["isHot"] = doc["is_hot"]
        elif "isHot" in doc and not doc.get("is_hot"):
            doc["is_hot"] = doc["isHot"]

        if "hold_resume_date" in doc and not doc.get("holdResumeDate"):
            doc["holdResumeDate"] = doc["hold_resume_date"]
        elif "holdResumeDate" in doc and not doc.get("hold_resume_date"):
            doc["hold_resume_date"] = doc["holdResumeDate"]

        if "next_follow_up_date" in doc and not doc.get("nextFollowUpDate"):
            doc["nextFollowUpDate"] = doc["next_follow_up_date"]
        elif "nextFollowUpDate" in doc and not doc.get("next_follow_up_date"):
            doc["next_follow_up_date"] = doc["nextFollowUpDate"]

        if "created_by_user_name" in doc and not doc.get("createdByUserName"):
            doc["createdByUserName"] = doc["created_by_user_name"]
        elif "createdByUserName" in doc and not doc.get("created_by_user_name"):
            doc["created_by_user_name"] = doc["createdByUserName"]

        if "follow_ups" in doc and not doc.get("followUps"):
            doc["followUps"] = doc["follow_ups"]
        elif "followUps" in doc and not doc.get("follow_ups"):
            doc["follow_ups"] = doc["followUps"]

        return doc


    @classmethod
    async def create_lead(cls, data: dict) -> dict:
        collection = await cls.get_collection()
        data["created_at"] = datetime.utcnow()
        data["updated_at"] = datetime.utcnow()
        data["is_deleted"] = False
        
        # Ensure followUps array
        if "follow_ups" not in data and "followUps" not in data:
            data["follow_ups"] = []
            data["followUps"] = []

        result = await collection.insert_one(data)
        data["_id"] = result.inserted_id
        return cls._normalize_lead(data)

    @classmethod
    async def create_leads_bulk(cls, leads: List[dict]) -> List[dict]:
        collection = await cls.get_collection()
        now = datetime.utcnow()
        for l in leads:
            l["created_at"] = now
            l["updated_at"] = now
            l["is_deleted"] = False
            if "follow_ups" not in l and "followUps" not in l:
                l["follow_ups"] = []
                l["followUps"] = []

        if leads:
            result = await collection.insert_many(leads)
            for i, inserted_id in enumerate(result.inserted_ids):
                leads[i]["_id"] = inserted_id
                cls._normalize_lead(leads[i])
        return leads

    @classmethod
    async def get_leads(
        cls, 
        skip: int = 0, 
        limit: int = 10000, 
        search: Optional[str] = None, 
        category: Optional[str] = None, 
        status: Optional[str] = None,
        user_id: Optional[str] = None,
        user_name: Optional[str] = None,
        is_admin: bool = True,
        employee_filter: Optional[str] = None
    ) -> List[dict]:
        collection = await cls.get_collection()
        query: Dict[str, Any] = {"is_deleted": {"$ne": True}}

        if status and status != "all":
            query["status"] = status

        if category and category != "all":
            query["category"] = category

        # Role-based scoping: non-admin can only see leads assigned to or created by them
        and_clauses: List[Dict[str, Any]] = []

        if not is_admin and (user_id or user_name):
            or_parts = []
            if user_id:
                or_parts.extend([
                    {"created_by": user_id},
                    {"assigned_to": user_id},
                    {"assignedTo": user_id},
                    {"owner": user_id},
                ])
            if user_name:
                or_parts.extend([
                    {"owner": {"$regex": f"^{user_name}$", "$options": "i"}},
                    {"created_by_user_name": {"$regex": f"^{user_name}$", "$options": "i"}},
                    {"assigned_to": user_name},
                    {"assignedTo": user_name},
                ])
            if or_parts:
                and_clauses.append({"$or": or_parts})

        elif is_admin and employee_filter and employee_filter != "all":
            and_clauses.append({
                "$or": [
                    {"created_by": employee_filter},
                    {"assigned_to": employee_filter},
                    {"assignedTo": employee_filter},
                    {"owner": {"$regex": employee_filter, "$options": "i"}},
                    {"created_by_user_name": {"$regex": employee_filter, "$options": "i"}},
                ]
            })

        if search:
            and_clauses.append({
                "$or": [
                    {"company": {"$regex": search, "$options": "i"}},
                    {"contact": {"$regex": search, "$options": "i"}},
                    {"email": {"$regex": search, "$options": "i"}},
                    {"phone": {"$regex": search, "$options": "i"}},
                    {"remarks": {"$regex": search, "$options": "i"}}
                ]
            })

        if and_clauses:
            query["$and"] = and_clauses

        cursor = collection.find(query).sort([("created_at", -1)]).skip(skip).limit(limit)
        docs = await cursor.to_list(length=limit)
        return [cls._normalize_lead(d) for d in docs]

    @classmethod
    async def get_lead_by_id(cls, lead_id: str) -> Optional[dict]:
        collection = await cls.get_collection()
        query = {"is_deleted": {"$ne": True}}
        if ObjectId.is_valid(lead_id):
            query["_id"] = ObjectId(lead_id)
        else:
            query["id"] = lead_id

        doc = await collection.find_one(query)
        return cls._normalize_lead(doc) if doc else None

    @classmethod
    async def update_lead(cls, lead_id: str, update_data: dict) -> Optional[dict]:
        collection = await cls.get_collection()
        update_data["updated_at"] = datetime.utcnow()

        query = {"is_deleted": {"$ne": True}}
        if ObjectId.is_valid(lead_id):
            query["_id"] = ObjectId(lead_id)
        else:
            query["id"] = lead_id

        # Also sync alias fields
        if "assigned_to" in update_data:
            update_data["assignedTo"] = update_data["assigned_to"]
        if "assignedTo" in update_data:
            update_data["assigned_to"] = update_data["assignedTo"]

        if "expected_income" in update_data:
            update_data["expectedIncome"] = update_data["expected_income"]
        if "expectedIncome" in update_data:
            update_data["expected_income"] = update_data["expectedIncome"]

        if "is_hot" in update_data:
            update_data["isHot"] = update_data["is_hot"]
        if "isHot" in update_data:
            update_data["is_hot"] = update_data["isHot"]

        if "hold_resume_date" in update_data:
            update_data["holdResumeDate"] = update_data["hold_resume_date"]
        if "holdResumeDate" in update_data:
            update_data["hold_resume_date"] = update_data["holdResumeDate"]

        if "next_follow_up_date" in update_data:
            update_data["nextFollowUpDate"] = update_data["next_follow_up_date"]
        if "nextFollowUpDate" in update_data:
            update_data["next_follow_up_date"] = update_data["nextFollowUpDate"]

        await collection.update_one(query, {"$set": update_data})
        return await cls.get_lead_by_id(lead_id)

    @classmethod
    async def delete_lead(cls, lead_id: str) -> bool:
        collection = await cls.get_collection()
        query = {}
        if ObjectId.is_valid(lead_id):
            query["_id"] = ObjectId(lead_id)
        else:
            query["id"] = lead_id

        result = await collection.update_one(query, {"$set": {"is_deleted": True, "updated_at": datetime.utcnow()}})
        return result.modified_count > 0

    @classmethod
    async def bulk_assign_leads(cls, lead_ids: List[str], assigned_to: Any, performed_by: Optional[str] = None, user_name: Optional[str] = None) -> int:
        collection = await cls.get_collection()
        object_ids = [ObjectId(lid) for lid in lead_ids if ObjectId.is_valid(lid)]
        string_ids = [lid for lid in lead_ids if not ObjectId.is_valid(lid)]

        query = {
            "$or": [
                {"_id": {"$in": object_ids}},
                {"id": {"$in": string_ids}}
            ]
        }
        update = {
            "$set": {
                "assigned_to": assigned_to,
                "assignedTo": assigned_to,
                "updated_at": datetime.utcnow()
            }
        }
        result = await collection.update_many(query, update)
        return result.modified_count

    @classmethod
    async def bulk_delete_leads(cls, lead_ids: List[str]) -> int:
        collection = await cls.get_collection()
        object_ids = [ObjectId(lid) for lid in lead_ids if ObjectId.is_valid(lid)]
        string_ids = [lid for lid in lead_ids if not ObjectId.is_valid(lid)]

        query = {
            "$or": [
                {"_id": {"$in": object_ids}},
                {"id": {"$in": string_ids}}
            ]
        }
        result = await collection.update_many(query, {"$set": {"is_deleted": True, "updated_at": datetime.utcnow()}})
        return result.modified_count

    @classmethod
    async def add_follow_up(cls, lead_id: str, follow_up: dict, performed_by: Optional[str] = None, user_name: Optional[str] = None) -> Optional[dict]:
        collection = await cls.get_collection()
        lead = await cls.get_lead_by_id(lead_id)
        if not lead:
            return None

        follow_ups = lead.get("follow_ups") or lead.get("followUps") or []
        follow_ups.append(follow_up)

        update_fields: Dict[str, Any] = {
            "follow_ups": follow_ups,
            "followUps": follow_ups,
            "updated_at": datetime.utcnow()
        }
        if follow_up.get("next_follow_up_date") or follow_up.get("nextFollowUpDate"):
            next_date = follow_up.get("next_follow_up_date") or follow_up.get("nextFollowUpDate")
            update_fields["next_follow_up_date"] = next_date
            update_fields["nextFollowUpDate"] = next_date

        return await cls.update_lead(lead_id, update_fields)

    @classmethod
    async def update_follow_up(cls, lead_id: str, idx: int, follow_up: dict, performed_by: Optional[str] = None, user_name: Optional[str] = None) -> Optional[dict]:
        lead = await cls.get_lead_by_id(lead_id)
        if not lead:
            return None

        follow_ups = lead.get("follow_ups") or lead.get("followUps") or []
        if 0 <= idx < len(follow_ups):
            follow_ups[idx] = follow_up
            update_fields: Dict[str, Any] = {
                "follow_ups": follow_ups,
                "followUps": follow_ups,
                "updated_at": datetime.utcnow()
            }
            return await cls.update_lead(lead_id, update_fields)
        return lead

    # Sales Targets
    @classmethod
    async def get_targets(cls, month: Optional[str] = None, year: Optional[int] = None, target_type: Optional[str] = None) -> List[dict]:
        coll = await cls.get_targets_collection()
        query: Dict[str, Any] = {}
        if month:
            query["month"] = month
        if year:
            query["year"] = year
        if target_type:
            query["type"] = target_type

        docs = await coll.find(query).to_list(length=1000)
        for d in docs:
            d["id"] = str(d.get("_id", ""))
        return docs

    @classmethod
    async def create_target(cls, target_dict: dict) -> dict:
        coll = await cls.get_targets_collection()
        target_dict["created_at"] = datetime.utcnow()
        result = await coll.insert_one(target_dict)
        target_dict["id"] = str(result.inserted_id)
        return target_dict

    @classmethod
    async def update_target(cls, target_id: str, update_dict: dict) -> Optional[dict]:
        coll = await cls.get_targets_collection()
        query = {"_id": ObjectId(target_id)} if ObjectId.is_valid(target_id) else {"id": target_id}
        await coll.update_one(query, {"$set": update_dict})
        doc = await coll.find_one(query)
        if doc:
            doc["id"] = str(doc.get("_id", ""))
        return doc

    @classmethod
    async def delete_target(cls, target_id: str) -> bool:
        coll = await cls.get_targets_collection()
        query = {"_id": ObjectId(target_id)} if ObjectId.is_valid(target_id) else {"id": target_id}
        result = await coll.delete_one(query)
        return result.deleted_count > 0
