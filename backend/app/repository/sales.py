from app.database.db import get_database
from datetime import datetime, timedelta
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
    settings_collection_name = "sales_settings"
    audit_collection_name = "sales_audit_logs"

    @classmethod
    async def get_collection(cls):
        db = get_database()
        return db[cls.collection_name]

    @classmethod
    async def get_targets_collection(cls):
        db = get_database()
        return db[cls.targets_collection_name]

    @classmethod
    async def get_settings_collection(cls):
        db = get_database()
        return db[cls.settings_collection_name]

    @classmethod
    async def get_audit_collection(cls):
        db = get_database()
        return db[cls.audit_collection_name]

    @classmethod
    async def _get_stage_maps(cls) -> tuple:
        """index->name and name->index from settings + legacy aliases ('0'..'8','Stage 0','Lead')."""
        try:
            settings = await cls.get_settings()
            stages = sorted(settings.get("stages", []), key=lambda s: s.get("index", 0))
        except Exception:
            stages = []
        index_to_name: Dict[str, str] = {}
        name_to_index: Dict[str, int] = {}
        for s in stages:
            try:
                idx = int(s.get("index", 0))
            except Exception:
                continue
            nm = str(s.get("name") or "").strip()
            if not nm:
                continue
            index_to_name[str(idx)] = nm
            name_to_index[nm] = idx
        return index_to_name, name_to_index

    @classmethod
    def _apply_stage_map(cls, doc: dict, index_to_name: Dict[str, str]) -> dict:
        """Rewrite legacy stage values ('5', 'Stage 0', 'Lead'...) to current settings names."""
        if not doc or not index_to_name:
            return doc
        legacy_aliases = {"stage 0": index_to_name.get("0"), "lead": index_to_name.get("0")}
        for key in ("stage", "status"):
            val = doc.get(key)
            if val is None:
                continue
            sv = str(val).strip()
            new_name = index_to_name.get(sv) or legacy_aliases.get(sv.lower())
            if new_name and sv != new_name:
                doc[key] = new_name
                try:
                    doc["stage_index"] = int(sv) if sv in index_to_name else 0
                    doc["stageIndex"] = doc["stage_index"]
                except Exception:
                    pass
                break
        return doc

    @classmethod
    def _normalize_lead(cls, doc: dict, stage_map: Optional[Dict[str, str]] = None) -> dict:
        if not doc:
            return doc
        doc = serialize_mongo(doc)
        if stage_map:
            doc = cls._apply_stage_map(doc, stage_map)
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

        if "deal_value" in doc and not doc.get("dealValue"):
            doc["dealValue"] = doc["deal_value"]
        elif "dealValue" in doc and not doc.get("deal_value"):
            doc["deal_value"] = doc["dealValue"]

        if "deal_note" in doc and not doc.get("dealNote"):
            doc["dealNote"] = doc["deal_note"]
        elif "dealNote" in doc and not doc.get("deal_note"):
            doc["deal_note"] = doc["dealNote"]

        if "quotation_id" in doc and not doc.get("quotationId"):
            doc["quotationId"] = doc["quotation_id"]
        elif "quotationId" in doc and not doc.get("quotation_id"):
            doc["quotation_id"] = doc["quotationId"]

        if "quotation_title" in doc and not doc.get("quotationTitle"):
            doc["quotationTitle"] = doc["quotation_title"]
        elif "quotationTitle" in doc and not doc.get("quotation_title"):
            doc["quotation_title"] = doc["quotationTitle"]

        if "quotation_value" in doc and not doc.get("quotationValue"):
            doc["quotationValue"] = doc["quotation_value"]
        elif "quotationValue" in doc and not doc.get("quotation_value"):
            doc["quotation_value"] = doc["quotationValue"]

        if "net_amount" in doc and not doc.get("netAmount"):
            doc["netAmount"] = doc["net_amount"]
        elif "netAmount" in doc and not doc.get("net_amount"):
            doc["net_amount"] = doc["netAmount"]

        if "gst_amount" in doc and not doc.get("gstAmount"):
            doc["gstAmount"] = doc["gst_amount"]
        elif "gstAmount" in doc and not doc.get("gst_amount"):
            doc["gst_amount"] = doc["gstAmount"]

        if "incentive_split" in doc and not doc.get("incentiveSplit"):
            doc["incentiveSplit"] = doc["incentive_split"]
        elif "incentiveSplit" in doc and not doc.get("incentive_split"):
            doc["incentive_split"] = doc["incentiveSplit"]

        if "project_handoff_notes" in doc and not doc.get("projectHandoffNotes"):
            doc["projectHandoffNotes"] = doc["project_handoff_notes"]
        elif "projectHandoffNotes" in doc and not doc.get("project_handoff_notes"):
            doc["project_handoff_notes"] = doc["projectHandoffNotes"]

        if "stage_index" in doc and not doc.get("stageIndex"):
            doc["stageIndex"] = doc["stage_index"]
        elif "stageIndex" in doc and not doc.get("stage_index"):
            doc["stage_index"] = doc["stageIndex"]

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

        if "next_follow_up_time" in doc and not doc.get("nextFollowUpTime"):
            doc["nextFollowUpTime"] = doc["next_follow_up_time"]
        elif "nextFollowUpTime" in doc and not doc.get("next_follow_up_time"):
            doc["next_follow_up_time"] = doc["nextFollowUpTime"]

        if "created_by_user_name" in doc and not doc.get("createdByUserName"):
            doc["createdByUserName"] = doc["created_by_user_name"]
        elif "createdByUserName" in doc and not doc.get("created_by_user_name"):
            doc["created_by_user_name"] = doc["createdByUserName"]

        if "follow_ups" in doc and not doc.get("followUps"):
            doc["followUps"] = doc["follow_ups"]
        elif "followUps" in doc and not doc.get("follow_ups"):
            doc["follow_ups"] = doc["followUps"]

        if "stage_history" in doc and not doc.get("stageHistory"):
            doc["stageHistory"] = doc["stage_history"]
        elif "stageHistory" in doc and not doc.get("stage_history"):
            doc["stage_history"] = doc["stageHistory"]
        if "stage_history" not in doc and "stageHistory" not in doc:
            doc["stage_history"] = []
            doc["stageHistory"] = []

        return doc


    @classmethod
    def _sanitize_phone(cls, data: dict) -> None:
        import re
        ph = data.get("phone")
        if isinstance(ph, str) and ph:
            digits = re.sub(r"[^0-9]", "", ph)
            data["phone"] = digits

    @classmethod
    async def create_lead(cls, data: dict) -> dict:
        collection = await cls.get_collection()
        now = datetime.utcnow()
        data["created_at"] = now
        data["updated_at"] = now
        data["is_deleted"] = False
        cls._sanitize_phone(data)
        
        # Ensure followUps array
        if "follow_ups" not in data and "followUps" not in data:
            data["follow_ups"] = []
            data["followUps"] = []

        # Init stage history - new lead always enters index-0 stage
        init_stage = data.get("stage") or data.get("status") or "New Lead"
        creator = data.get("created_by_user_name") or data.get("createdByUserName") or data.get("owner") or "System"
        history_entry = {
            "from_stage": None,
            "to_stage": init_stage,
            "changed_by": creator,
            "changed_at": now.isoformat(),
            "reason": "Lead created",
        }
        if "stage_history" not in data and "stageHistory" not in data:
            data["stage_history"] = [history_entry]
            data["stageHistory"] = [history_entry]

        # Audio 7 & 8: Auto-assignment check if owner is missing, empty, or 'Auto'
        owner_val = str(data.get("owner") or "").strip()
        assigned_val = data.get("assigned_to") or data.get("assignedTo")
        has_assigned = bool(assigned_val and len(assigned_val) > 0 and assigned_val != ["Unassigned"])

        if (not owner_val or owner_val in ["Auto", "Unassigned"]) and not has_assigned:
            auto_owner = await cls.get_next_auto_assigned_owner()
            if auto_owner:
                data["owner"] = auto_owner
                data["assigned_to"] = [auto_owner]
                data["assignedTo"] = [auto_owner]

        result = await collection.insert_one(data)
        data["_id"] = result.inserted_id
        return cls._normalize_lead(data)

    @classmethod
    async def create_leads_bulk(cls, leads: List[dict]) -> List[dict]:
        collection = await cls.get_collection()
        now = datetime.utcnow()
        # Default stage = index-0 from settings (new leads always enter first stage)
        settings = await cls.get_settings()
        stages = sorted(settings.get("stages", []), key=lambda s: s.get("index", 0))
        default_stage = stages[0].get("name", "New Lead") if stages else "New Lead"
        for l in leads:
            l["created_at"] = now
            l["updated_at"] = now
            l["is_deleted"] = False
            if "follow_ups" not in l and "followUps" not in l:
                l["follow_ups"] = []
                l["followUps"] = []
            if not l.get("stage") and not l.get("status"):
                l["stage"] = default_stage
                l["status"] = default_stage
                l["stage_index"] = 0
                l["stageIndex"] = 0
            creator = l.get("created_by_user_name") or l.get("createdByUserName") or l.get("owner") or "System"
            hist_entry = {"from_stage": None, "to_stage": l.get("stage") or default_stage, "changed_by": creator, "changed_at": now.isoformat(), "reason": "Lead created (bulk)"}
            if "stage_history" not in l and "stageHistory" not in l:
                l["stage_history"] = [hist_entry]
                l["stageHistory"] = [hist_entry]

            # Audio 7 & 8: Auto-assignment for bulk imports
            owner_val = str(l.get("owner") or "").strip()
            assigned_val = l.get("assigned_to") or l.get("assignedTo")
            has_assigned = bool(assigned_val and len(assigned_val) > 0 and assigned_val != ["Unassigned"])
            if (not owner_val or owner_val in ["Auto", "Unassigned"]) and not has_assigned:
                auto_owner = await cls.get_next_auto_assigned_owner()
                if auto_owner:
                    l["owner"] = auto_owner
                    l["assigned_to"] = [auto_owner]
                    l["assignedTo"] = [auto_owner]

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

        index_to_name, _ = await cls._get_stage_maps()
        cursor = collection.find(query).sort([("created_at", -1)]).skip(skip).limit(limit)
        docs = await cursor.to_list(length=limit)
        return [cls._normalize_lead(d, index_to_name) for d in docs]

    @classmethod
    async def get_lead_by_id(cls, lead_id: str) -> Optional[dict]:
        collection = await cls.get_collection()
        query = {"is_deleted": {"$ne": True}}
        if ObjectId.is_valid(lead_id):
            query["_id"] = ObjectId(lead_id)
        else:
            query["id"] = lead_id

        doc = await collection.find_one(query)
        if not doc:
            return None
        index_to_name, _ = await cls._get_stage_maps()
        return cls._normalize_lead(doc, index_to_name)

    @classmethod
    async def update_lead(cls, lead_id: str, update_data: dict) -> Optional[dict]:
        collection = await cls.get_collection()

        query = {"is_deleted": {"$ne": True}}
        if ObjectId.is_valid(lead_id):
            query["_id"] = ObjectId(lead_id)
        else:
            query["id"] = lead_id

        # Track stage shifts for timeline before update
        existing = await collection.find_one(query)
        new_stage = update_data.get("stage") or update_data.get("status")
        if existing and new_stage:
            old_stage = existing.get("stage") or existing.get("status") or ""
            if str(old_stage) != str(new_stage):
                changer = update_data.get("user_name") or update_data.get("userName") or existing.get("owner") or "System"
                reason = update_data.get("reason") or ""
                hist_entry = {
                    "from_stage": old_stage,
                    "to_stage": new_stage,
                    "changed_by": changer,
                    "changed_at": datetime.utcnow().isoformat(),
                    "reason": reason,
                }
                # Push atomically, keep both naming conventions in sync via later $set
                await collection.update_one(query, {"$push": {"stage_history": hist_entry, "stageHistory": hist_entry}})

        cls._sanitize_phone(update_data)
        # Remove internal meta keys - not stored on lead doc
        update_data.pop("performed_by", None)
        update_data.pop("performedBy", None)
        update_data.pop("user_name", None)
        update_data.pop("userName", None)
        update_data.pop("reason", None)
        update_data["updated_at"] = datetime.utcnow()

        # Also sync alias fields
        if "assigned_to" in update_data:
            update_data["assignedTo"] = update_data["assigned_to"]
        if "assignedTo" in update_data:
            update_data["assigned_to"] = update_data["assignedTo"]
        if "stage" in update_data and "status" not in update_data:
            update_data["status"] = update_data["stage"]
        if "status" in update_data and "stage" not in update_data:
            update_data["stage"] = update_data["status"]
        if "next_follow_up_time" in update_data:
            update_data["nextFollowUpTime"] = update_data["next_follow_up_time"]
        if "nextFollowUpTime" in update_data:
            update_data["next_follow_up_time"] = update_data["nextFollowUpTime"]

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

    # ==============================================================================
    # SENSITIVE PAYMENT & FINANCIAL DATA MASKING (Audio 8 privacy rule)
    # ==============================================================================
    @classmethod
    def mask_sensitive_lead(cls, lead: dict, has_payment_access: bool) -> dict:
        if has_payment_access or not lead:
            return lead
        masked = dict(lead)
        masked["deal_value"] = None
        masked["dealValue"] = None
        masked["net_amount"] = None
        masked["netAmount"] = None
        masked["gst_amount"] = None
        masked["gstAmount"] = None
        masked["incentive_split"] = None
        masked["incentiveSplit"] = None
        masked["quotation_value"] = None
        masked["quotationValue"] = None
        return masked

    # ==============================================================================
    # SALES SETTINGS & PERSISTENCE (Audio 7 & 8 Dynamic Configuration)
    # ==============================================================================
    @classmethod
    async def get_settings(cls) -> dict:
        coll = await cls.get_settings_collection()
        doc = await coll.find_one({"_id": "global_sales_settings"})
        if not doc:
            doc = {
                "_id": "global_sales_settings",
                "id": "global_sales_settings",
                "stages": [
                    {"name": "New Lead", "index": 0, "is_default": True, "color": "bg-blue-500"},
                    {"name": "Contacted", "index": 1, "is_default": False, "color": "bg-amber-500"},
                    {"name": "Meeting Scheduled / Demo", "index": 2, "is_default": False, "color": "bg-purple-500"},
                    {"name": "Proposal Sent", "index": 3, "is_default": False, "color": "bg-indigo-500"},
                    {"name": "Negotiation", "index": 4, "is_default": False, "color": "bg-orange-500"},
                    {"name": "Client Won", "index": 5, "is_default": False, "color": "bg-emerald-500"},
                    {"name": "Client Lost", "index": 6, "is_default": False, "color": "bg-rose-500"},
                    {"name": "On Hold", "index": 7, "is_default": False, "color": "bg-slate-400"}
                ],
                "categories": [
                    {"name": "Jewellery", "iconName": "Gem", "color": "bg-amber-500"},
                    {"name": "Restaurants", "iconName": "UtensilsCrossed", "color": "bg-orange-500"},
                    {"name": "Real Estate", "iconName": "Building2", "color": "bg-emerald-600"},
                    {"name": "Doctors", "iconName": "Stethoscope", "color": "bg-blue-500"},
                    {"name": "Education", "iconName": "GraduationCap", "color": "bg-primary"},
                    {"name": "Hospital", "iconName": "HeartPulse", "color": "bg-rose-500"},
                    {"name": "Manufacturing", "iconName": "Factory", "color": "bg-muted/500"},
                    {"name": "Textile", "iconName": "Shirt", "color": "bg-orange-600"},
                    {"name": "Finance", "iconName": "Landmark", "color": "bg-teal-600"},
                    {"name": "Automobile", "iconName": "Car", "color": "bg-card"},
                    {"name": "Travel", "iconName": "Plane", "color": "bg-sky-500"},
                    {"name": "IT Company", "iconName": "Cpu", "color": "bg-primary"},
                    {"name": "Salon", "iconName": "Scissors", "color": "bg-pink-500"},
                    {"name": "Gym", "iconName": "Dumbbell", "color": "bg-green-600"},
                    {"name": "Construction", "iconName": "HardHat", "color": "bg-yellow-700"},
                    {"name": "Others", "iconName": "Shapes", "color": "bg-slate-400"}
                ],
                "sources": [
                    "Meta Ads", "Google Ads", "Instagram", "Facebook", "WhatsApp",
                    "Website", "Reference", "Cold Calling", "LinkedIn", "Walk-in",
                    "Exhibition", "BNI", "PBN", "Organic", "Others"
                ],
                "assignment_rules": [
                    {"name": "Auto Assignment", "active": True},
                    {"name": "Round Robin", "active": True},
                    {"name": "Workload Balancing", "active": True},
                    {"name": "Manual Assignment", "active": False}
                ],
                "eligible_owners": [],
                "notifications": [
                    {"title": "New Lead Assigned", "subtitle": "Instant alerts when leads are assigned to you", "active": True},
                    {"title": "Follow-up Reminder", "subtitle": "Alerts when follow-ups are due", "active": True},
                    {"title": "Meeting Reminder", "subtitle": "Reminders for scheduled demos & client visits", "active": True},
                    {"title": "Target Achieved", "subtitle": "Alerts when members cross monthly revenue milestones", "active": True},
                    {"title": "Lead Converted", "subtitle": "Live notifications when a deal moves to Won", "active": True},
                    {"title": "Payment Received", "subtitle": "Alerts when collection amounts are confirmed", "active": True}
                ],
                "payment_visibility": {
                    "allowed_roles": ["Admin", "SuperAdmin", "CEO", "Sales Head"],
                    "allowed_employee_ids": [],
                    "allowed_employee_names": []
                },
                "follow_up_types": [
                    {"label": "CNR (Call Not Received)", "note": "Called but call was not received (CNR).", "action": "CNR", "offset_hours": 24, "active": True},
                    {"label": "Call Later (Client Busy)", "note": "Client is currently busy and asked to call back later.", "action": "Call Later", "offset_hours": 2, "active": True},
                    {"label": "Client Interested", "note": "Client is interested in our services. Follow-up required.", "action": "Meeting", "offset_hours": 48, "active": True},
                    {"label": "WhatsApp Details Sent", "note": "Sent portfolio & service details on WhatsApp.", "action": "WhatsApp", "offset_hours": 24, "active": True},
                    {"label": "Demo Requested", "note": "Client requested an online product demo.", "action": "Demo", "offset_hours": 24, "active": True}
                ],
                "role_permissions": [
                    {"role": "CEO", "perms": ["View all leads", "Edit all", "Delete leads", "Manage targets", "Manage users", "View audit log"]},
                    {"role": "Admin", "perms": ["View all leads", "Edit all", "Delete leads", "Manage settings", "View audit log"]},
                    {"role": "Sales Head", "perms": ["View team leads", "Assign leads", "Approve proposals", "Bulk edit"]},
                    {"role": "Sales Executive", "perms": ["View own leads", "Add lead", "Log follow-up", "Create quotation"]}
                ],
                "updated_at": datetime.utcnow()
            }
            try:
                await coll.insert_one(doc)
            except Exception:
                pass
        # Migrate older settings docs missing new keys
        needs_migration = False
        if "follow_up_types" not in doc:
            doc["follow_up_types"] = [
                {"label": "CNR (Call Not Received)", "note": "Called but call was not received (CNR).", "action": "CNR", "offset_hours": 24, "active": True},
                {"label": "Call Later (Client Busy)", "note": "Client is currently busy and asked to call back later.", "action": "Call Later", "offset_hours": 2, "active": True},
                {"label": "Client Interested", "note": "Client is interested in our services. Follow-up required.", "action": "Meeting", "offset_hours": 48, "active": True},
                {"label": "WhatsApp Details Sent", "note": "Sent portfolio & service details on WhatsApp.", "action": "WhatsApp", "offset_hours": 24, "active": True},
                {"label": "Demo Requested", "note": "Client requested an online product demo.", "action": "Demo", "offset_hours": 24, "active": True}
            ]
            needs_migration = True
        pv = doc.get("payment_visibility") or {}
        if "allowed_employee_names" not in pv:
            pv["allowed_employee_names"] = []
            doc["payment_visibility"] = pv
            needs_migration = True
        if "role_permissions" not in doc:
            doc["role_permissions"] = [
                {"role": "CEO", "perms": ["View all leads", "Edit all", "Delete leads", "Manage targets", "Manage users", "View audit log"]},
                {"role": "Admin", "perms": ["View all leads", "Edit all", "Delete leads", "Manage settings", "View audit log"]},
                {"role": "Sales Head", "perms": ["View team leads", "Assign leads", "Approve proposals", "Bulk edit"]},
                {"role": "Sales Executive", "perms": ["View own leads", "Add lead", "Log follow-up", "Create quotation"]}
            ]
            needs_migration = True
        if needs_migration:
            try:
                await coll.update_one({"_id": "global_sales_settings"}, {"$set": {"follow_up_types": doc["follow_up_types"], "payment_visibility": doc["payment_visibility"], "role_permissions": doc["role_permissions"]}})
            except Exception:
                pass
        return serialize_mongo(doc)

    @classmethod
    async def rename_category_across_leads(cls, old_name: str, new_name: str) -> int:
        """When a category is renamed in settings, migrate all leads. Returns modified count."""
        if not old_name or not new_name or old_name == new_name:
            return 0
        coll = await cls.get_collection()
        res = await coll.update_many(
            {"category": old_name},
            {"$set": {"category": new_name, "updated_at": datetime.utcnow()}}
        )
        return res.modified_count

    @classmethod
    async def rename_source_across_leads(cls, old_name: str, new_name: str) -> int:
        if not old_name or not new_name or old_name == new_name:
            return 0
        coll = await cls.get_collection()
        res = await coll.update_many(
            {"source": old_name},
            {"$set": {"source": new_name, "updated_at": datetime.utcnow()}}
        )
        return res.modified_count

    @classmethod
    async def rename_stage_across_leads(cls, old_name: str, new_name: str, performed_by: Optional[str] = None, user_name: Optional[str] = None) -> int:
        if not old_name or not new_name or old_name == new_name:
            return 0
        coll = await cls.get_collection()
        cursor = coll.find({"$or": [{"stage": old_name}, {"status": old_name}]})
        docs = await cursor.to_list(length=10000)
        count = 0
        for d in docs:
            lid = str(d.get("_id"))
            await cls.update_lead(lid, {"stage": new_name, "status": new_name, "reason": f"Stage renamed: {old_name} → {new_name}", "user_name": user_name or performed_by or "System"})
            count += 1
        return count

    @classmethod
    async def reassign_category_to_default(cls, deleted_name: str, default_name: str = "Others") -> int:
        if not deleted_name:
            return 0
        coll = await cls.get_collection()
        res = await coll.update_many(
            {"category": deleted_name},
            {"$set": {"category": default_name, "updated_at": datetime.utcnow()}}
        )
        return res.modified_count

    @classmethod
    async def update_settings(cls, update_data: dict) -> dict:
        coll = await cls.get_settings_collection()
        update_data["updated_at"] = datetime.utcnow()
        await coll.update_one(
            {"_id": "global_sales_settings"},
            {"$set": update_data},
            upsert=True
        )
        return await cls.get_settings()

    @classmethod
    async def get_next_auto_assigned_owner(cls) -> Optional[str]:
        """
        Audio 7 [27:30], Audio 8 [05:00] Auto-Assignment Engine:
        Round-robin or workload-balanced distribution among configured eligible_owners.
        """
        settings = await cls.get_settings()
        rules = settings.get("assignment_rules", [])
        auto_rule = next((r for r in rules if ("auto" in str(r.get("name", "")).lower() or "round robin" in str(r.get("name", "")).lower()) and r.get("active")), None)
        if not auto_rule:
            return None

        owners = settings.get("eligible_owners", [])
        if not owners or len(owners) == 0:
            return None

        # Clean owner names (strip role if formatted as "Name · Role")
        clean_owners = [o.split("·")[0].strip() if "·" in o else o.strip() for o in owners if o]
        if not clean_owners:
            return None

        coll = await cls.get_settings_collection()
        doc = await coll.find_one({"_id": "global_sales_settings"}) or {}
        last_idx = int(doc.get("last_assigned_index", -1))
        next_idx = (last_idx + 1) % len(clean_owners)
        assigned_owner = clean_owners[next_idx]

        await coll.update_one(
            {"_id": "global_sales_settings"},
            {"$set": {"last_assigned_index": next_idx, "updated_at": datetime.utcnow()}},
            upsert=True
        )
        return assigned_owner

    # ==============================================================================
    # SALES AUDIT LOGGING (Non-deletable trail, Audio 8 [04:32])
    # ==============================================================================
    @classmethod
    async def record_audit_log(
        cls,
        action: str,
        performed_by: Optional[str] = None,
        user_name: Optional[str] = None,
        lead_id: Optional[str] = None,
        company: Optional[str] = None,
        contact: Optional[str] = None,
        details: Optional[dict] = None
    ) -> dict:
        coll = await cls.get_audit_collection()
        log_entry = {
            "action": action,
            "performed_by": performed_by,
            "user_name": user_name or "System",
            "lead_id": lead_id,
            "company": company,
            "contact": contact,
            "details": details or {},
            "timestamp": datetime.utcnow()
        }
        res = await coll.insert_one(log_entry)
        log_entry["_id"] = res.inserted_id
        return serialize_mongo(log_entry)

    @classmethod
    async def get_audit_logs(cls, skip: int = 0, limit: int = 50, search: Optional[str] = None) -> List[dict]:
        coll = await cls.get_audit_collection()
        query = {}
        if search:
            query = {
                "$or": [
                    {"action": {"$regex": search, "$options": "i"}},
                    {"user_name": {"$regex": search, "$options": "i"}},
                    {"company": {"$regex": search, "$options": "i"}},
                    {"contact": {"$regex": search, "$options": "i"}}
                ]
            }
        cursor = coll.find(query).sort([("timestamp", -1)]).skip(skip).limit(limit)
        docs = await cursor.to_list(length=limit)
        return [serialize_mongo(d) for d in docs]

    # ==============================================================================
    # HIGH-PERFORMANCE SALES DASHBOARD SUMMARY (Audio 7 & 8 Core KPIs)
    # ==============================================================================
    @classmethod
    async def get_sales_summary(
        cls,
        user_id: Optional[str] = None,
        user_name: Optional[str] = None,
        is_admin: bool = True,
        period: Optional[str] = "month"
    ) -> dict:
        collection = await cls.get_collection()
        now = datetime.utcnow()
        today_str = now.strftime("%Y-%m-%d")

        query: Dict[str, Any] = {"is_deleted": {"$ne": True}}
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
                query["$or"] = or_parts

        all_leads_cursor = collection.find(query)
        leads = await all_leads_cursor.to_list(length=50000)

        # Normalize legacy numeric stages ('0'..'8') to current settings names for correct KPIs
        index_to_name, _ = await cls._get_stage_maps()
        if index_to_name:
            for _ld in leads:
                cls._apply_stage_map(_ld, index_to_name)

        total_leads = len(leads)
        won_leads = 0
        lost_leads = 0
        active_leads = 0
        hot_leads_count = 0
        today_followups_count = 0
        total_won_revenue = 0.0

        hot_leads_overdue_list = []
        funnel_counts: Dict[str, int] = {
            "New Lead": 0,
            "Contacted": 0,
            "Meeting Scheduled / Demo": 0,
            "Proposal Sent": 0,
            "Negotiation": 0,
            "Client Won": 0,
            "Client Lost": 0
        }
        source_counts: Dict[str, Dict[str, Any]] = {}

        for l in leads:
            st = str(l.get("status") or l.get("stage") or "Lead")
            st_lower = st.lower()
            val = float(l.get("net_amount") or l.get("netAmount") or l.get("deal_value") or l.get("dealValue") or l.get("expected_income") or l.get("expectedIncome") or 0.0)

            # Funnel mapping
            if "won" in st_lower:
                won_leads += 1
                total_won_revenue += val
                funnel_counts["Client Won"] = funnel_counts.get("Client Won", 0) + 1
            elif "lost" in st_lower:
                lost_leads += 1
                funnel_counts["Client Lost"] = funnel_counts.get("Client Lost", 0) + 1
            else:
                active_leads += 1
                if "contact" in st_lower:
                    funnel_counts["Contacted"] = funnel_counts.get("Contacted", 0) + 1
                elif "meet" in st_lower or "demo" in st_lower:
                    funnel_counts["Meeting Scheduled / Demo"] = funnel_counts.get("Meeting Scheduled / Demo", 0) + 1
                elif "proposal" in st_lower:
                    funnel_counts["Proposal Sent"] = funnel_counts.get("Proposal Sent", 0) + 1
                elif "negotiat" in st_lower:
                    funnel_counts["Negotiation"] = funnel_counts.get("Negotiation", 0) + 1
                else:
                    funnel_counts["New Lead"] = funnel_counts.get("New Lead", 0) + 1

            # Hot leads check
            is_hot = bool(l.get("is_hot") or l.get("isHot"))
            if is_hot:
                hot_leads_count += 1
                nxt_date = str(l.get("next_follow_up_date") or l.get("nextFollowUpDate") or "")
                if nxt_date and nxt_date <= today_str and "won" not in st_lower and "lost" not in st_lower:
                    hot_leads_overdue_list.append({
                        "id": str(l.get("_id", "")),
                        "company": l.get("company", ""),
                        "contact": l.get("contact", ""),
                        "phone": l.get("phone", ""),
                        "owner": l.get("owner", ""),
                        "next_follow_up_date": nxt_date,
                        "next_follow_up_time": l.get("next_follow_up_time") or l.get("nextFollowUpTime"),
                        "expected_income": val
                    })

            # Followups due today
            nxt_date = str(l.get("next_follow_up_date") or l.get("nextFollowUpDate") or "")
            if nxt_date == today_str and "won" not in st_lower and "lost" not in st_lower:
                today_followups_count += 1

            # Source analysis
            src = l.get("source") or "Others"
            if src not in source_counts:
                source_counts[src] = {"source": src, "count": 0, "revenue": 0.0}
            source_counts[src]["count"] += 1
            if "won" in st_lower:
                source_counts[src]["revenue"] += val

        # Targets
        current_month_str = now.strftime("%B")
        current_year = now.year
        targets_coll = await cls.get_targets_collection()
        target_docs = await targets_coll.find({"year": current_year}).to_list(length=100)
        total_target = sum(float(t.get("target_amount") or 0.0) for t in target_docs)
        if total_target == 0:
            total_target = 5000000.0  # default baseline if not configured

        remaining_target = max(0.0, total_target - total_won_revenue)
        conversion_rate = round((won_leads / total_leads * 100), 1) if total_leads > 0 else 0.0
        avg_deal_size = round((total_won_revenue / won_leads), 2) if won_leads > 0 else 0.0

        return {
            "total_leads": total_leads,
            "active_leads": active_leads,
            "won_leads": won_leads,
            "lost_leads": lost_leads,
            "hot_leads_count": hot_leads_count,
            "hot_leads_overdue_count": len(hot_leads_overdue_list),
            "hot_leads_needing_attention": hot_leads_overdue_list[:10],
            "today_followups_count": today_followups_count,
            "total_target": total_target,
            "achieved_target": total_won_revenue,
            "total_won_revenue": total_won_revenue,
            "remaining_target": remaining_target,
            "conversion_rate": conversion_rate,
            "avg_deal_size": avg_deal_size,
            "conversion_funnel": funnel_counts,
            "source_analysis": list(source_counts.values())
        }

    @classmethod
    async def generate_sales_report(
        cls,
        report_type: str = "revenue",
        date_range: str = "this_month",
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> dict:
        """
        Audio 8 [05:55-07:44]: Real-time Sales Reports Generator
        Generates server-side analytics, metrics, and structured rows for:
        - Revenue & Forecast (Won deals, Net recognition, GST, Quotations)
        - Team Performance (Per-rep conversion, Targets, Net revenue, Incentives)
        - Lead Generation (Source & Category funnel)
        - Activity & Tasks (Follow-up logs, CNR, Call later, Scheduled)
        """
        now = datetime.utcnow()
        today_date = now.date()

        def parse_date(val):
            if not val:
                return None
            if isinstance(val, datetime):
                return val.date()
            if isinstance(val, str):
                for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%d %H:%M:%S"):
                    try:
                        return datetime.strptime(val.split("T")[0].split(" ")[0], "%Y-%m-%d").date()
                    except Exception:
                        pass
            return None

        # Determine date filter boundary
        lower_bound = None
        upper_bound = None
        norm_range = (date_range or "this_month").lower().replace(" ", "_").replace("-", "_")

        if norm_range == "today":
            lower_bound = today_date
            upper_bound = today_date
        elif norm_range in ("this_week", "week"):
            lower_bound = today_date - timedelta(days=today_date.weekday())
            upper_bound = today_date
        elif norm_range in ("this_month", "month"):
            lower_bound = today_date.replace(day=1)
            upper_bound = today_date
        elif norm_range in ("last_month",):
            first_this_month = today_date.replace(day=1)
            last_day_prev_month = first_this_month - timedelta(days=1)
            lower_bound = last_day_prev_month.replace(day=1)
            upper_bound = last_day_prev_month
        elif norm_range in ("this_quarter", "quarter"):
            quarter = (today_date.month - 1) // 3
            first_month_q = quarter * 3 + 1
            lower_bound = today_date.replace(month=first_month_q, day=1)
            upper_bound = today_date
        elif norm_range == "custom" and start_date:
            lower_bound = parse_date(start_date)
            upper_bound = parse_date(end_date) if end_date else today_date

        leads = await cls.get_leads(limit=5000)

        # Filter leads in date range
        filtered_leads = []
        for l in leads:
            d = parse_date(l.get("closed_date") or l.get("closed_at") or l.get("created_at") or l.get("date"))
            if lower_bound and upper_bound and d:
                if lower_bound <= d <= upper_bound:
                    filtered_leads.append(l)
            else:
                filtered_leads.append(l)

        if report_type == "revenue":
            won_items = []
            for l in filtered_leads:
                is_won = bool(l.get("is_converted") or str(l.get("stage") or l.get("status") or "").lower() in ["won", "5", "converted", "closed won"])
                if is_won:
                    deal_val = float(l.get("deal_value") or l.get("budget") or 0.0)
                    net_val = float(l.get("net_amount") or deal_val)
                    gst_val = float(l.get("gst_amount") or 0.0)
                    won_items.append({
                        "id": str(l.get("_id") or l.get("id")),
                        "company": l.get("company") or l.get("contact") or "Unnamed",
                        "contact": l.get("contact") or "",
                        "phone": l.get("phone") or "",
                        "closed_date": str(l.get("closed_date") or l.get("created_at") or "")[:10],
                        "quotation_number": l.get("quotation_number") or l.get("quotation_id") or "N/A",
                        "quotation_title": l.get("quotation_title") or "",
                        "deal_value": deal_val,
                        "net_amount": net_val,
                        "gst_amount": gst_val,
                        "is_inclusive_tax": bool(l.get("is_inclusive_tax", False)),
                        "owner": l.get("owner") or (l.get("assigned_to", [""])[0] if isinstance(l.get("assigned_to"), list) and l.get("assigned_to") else "Sales Team"),
                        "incentive_split": l.get("incentive_split", [])
                    })

            gross_sum = sum(i["deal_value"] for i in won_items)
            net_sum = sum(i["net_amount"] for i in won_items)
            gst_sum = sum(i["gst_amount"] for i in won_items)
            avg_deal = round(gross_sum / len(won_items), 2) if won_items else 0.0

            return {
                "report_type": "revenue",
                "date_range": date_range,
                "summary": {
                    "total_deals": len(won_items),
                    "gross_revenue": gross_sum,
                    "net_revenue": net_sum,
                    "gst_collected": gst_sum,
                    "avg_deal_value": avg_deal
                },
                "items": won_items
            }

        elif report_type == "performance":
            settings = await cls.get_settings()
            eligible = settings.get("eligible_owners", [])
            clean_eligible = [e.split("·")[0].strip() if "·" in e else e.strip() for e in eligible]

            # Collect all owners
            all_owners_set = set(clean_eligible)
            for l in filtered_leads:
                o = l.get("owner")
                if o:
                    all_owners_set.add(o.strip())

            # Load targets
            targets_coll = await cls.get_targets_collection()
            targets_docs = await targets_coll.find({}).to_list(length=200)
            target_map = {t.get("employee_name"): float(t.get("target_amount") or 0.0) for t in targets_docs if t.get("employee_name")}

            rep_metrics = []
            for rep in sorted(all_owners_set):
                if not rep:
                    continue
                assigned = [l for l in filtered_leads if (l.get("owner") == rep or (isinstance(l.get("assigned_to"), list) and rep in l.get("assigned_to")))]
                won = [l for l in assigned if bool(l.get("is_converted") or str(l.get("stage") or l.get("status") or "").lower() in ["won", "5", "converted", "closed won"])]
                
                net_achieved = 0.0
                incentives = 0.0
                for w in won:
                    splits = w.get("incentive_split") or []
                    rep_split = next((s for s in splits if s.get("name") == rep), None)
                    if rep_split:
                        net_achieved += float(rep_split.get("amount") or 0.0) # rep contribution
                        incentives += float(rep_split.get("amount") or 0.0)
                    else:
                        net_achieved += float(w.get("net_amount") or w.get("deal_value") or 0.0)

                target_amt = target_map.get(rep, 500000.0)
                conv_rate = round((len(won) / len(assigned) * 100), 1) if assigned else 0.0
                achieve_pct = round((net_achieved / target_amt * 100), 1) if target_amt > 0 else 0.0

                rep_metrics.append({
                    "name": rep,
                    "assigned_leads": len(assigned),
                    "won_deals": len(won),
                    "conversion_rate": conv_rate,
                    "target_amount": target_amt,
                    "net_achieved": net_achieved,
                    "achievement_percentage": achieve_pct,
                    "incentives_earned": incentives
                })

            total_target = sum(r["target_amount"] for r in rep_metrics)
            total_achieved = sum(r["net_achieved"] for r in rep_metrics)
            total_won = sum(r["won_deals"] for r in rep_metrics)
            total_assigned = sum(r["assigned_leads"] for r in rep_metrics)

            return {
                "report_type": "performance",
                "date_range": date_range,
                "summary": {
                    "total_members": len(rep_metrics),
                    "total_target": total_target,
                    "total_achieved": total_achieved,
                    "overall_conversion_rate": round((total_won / total_assigned * 100), 1) if total_assigned else 0.0
                },
                "items": rep_metrics
            }

        elif report_type == "activity":
            activity_items = []
            cnr_count = 0
            later_count = 0
            today_cnt = 0

            for l in filtered_leads:
                f_list = l.get("follow_ups") or l.get("followUps") or []
                for f in f_list:
                    action_type = f.get("type") or f.get("action") or "Follow-up"
                    if "cnr" in str(action_type).lower():
                        cnr_count += 1
                    if "later" in str(action_type).lower():
                        later_count += 1
                    
                    f_date = parse_date(f.get("date") or f.get("createdAt"))
                    if f_date == today_date:
                        today_cnt += 1

                    activity_items.append({
                        "company": l.get("company") or l.get("contact") or "Unknown",
                        "contact": l.get("contact") or "",
                        "phone": l.get("phone") or "",
                        "owner": f.get("performedBy") or l.get("owner") or "Sales Rep",
                        "action": action_type,
                        "note": f.get("note") or f.get("comment") or "",
                        "date": str(f.get("date") or "")[:10],
                        "next_date": str(f.get("nextDate") or l.get("next_follow_up") or l.get("nextFollowUpDate") or "")[:10],
                        "stage": l.get("stage") or l.get("status") or ""
                    })

            return {
                "report_type": "activity",
                "date_range": date_range,
                "summary": {
                    "total_activities": len(activity_items),
                    "today_activities": today_cnt,
                    "cnr_count": cnr_count,
                    "call_later_count": later_count
                },
                "items": activity_items[:200]
            }

        else: # "leads"
            source_map = {}
            category_map = {}

            lead_items = []
            for l in filtered_leads:
                src = l.get("source") or "Direct"
                cat = l.get("category") or "General"
                is_won = bool(l.get("is_converted") or str(l.get("stage") or l.get("status") or "").lower() in ["won", "5", "converted"])
                val = float(l.get("deal_value") or l.get("budget") or 0.0)

                source_map.setdefault(src, {"name": src, "total": 0, "won": 0, "revenue": 0.0})
                source_map[src]["total"] += 1
                if is_won:
                    source_map[src]["won"] += 1
                    source_map[src]["revenue"] += val

                category_map.setdefault(cat, {"name": cat, "total": 0, "won": 0, "revenue": 0.0})
                category_map[cat]["total"] += 1
                if is_won:
                    category_map[cat]["won"] += 1
                    category_map[cat]["revenue"] += val

                lead_items.append({
                    "company": l.get("company") or l.get("contact") or "Unnamed",
                    "contact": l.get("contact") or "",
                    "phone": l.get("phone") or "",
                    "email": l.get("email") or "",
                    "category": cat,
                    "source": src,
                    "stage": l.get("stage") or l.get("status") or "New Lead",
                    "owner": l.get("owner") or "Unassigned",
                    "created_date": str(l.get("created_at") or l.get("date") or "")[:10]
                })

            return {
                "report_type": "leads",
                "date_range": date_range,
                "summary": {
                    "total_leads": len(lead_items),
                    "unique_sources": len(source_map),
                    "unique_categories": len(category_map)
                },
                "sources": list(source_map.values()),
                "categories": list(category_map.values()),
                "items": lead_items[:200]
            }

