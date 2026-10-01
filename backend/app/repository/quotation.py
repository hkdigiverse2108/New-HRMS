import re
from app.database.db import get_database
from datetime import datetime
from bson import ObjectId
from typing import Optional, List, Dict, Any

class QuotationRepository:
    collection_name = "quotations"

    @classmethod
    async def get_collection(cls):
        db = get_database()
        return db[cls.collection_name]

    @classmethod
    async def get_next_number(cls) -> str:
        collection = await cls.get_collection()
        prefix = "QUO-"
        regex_pattern = f"^{prefix}\\d+"
        cursor = collection.find(
            {"quotation_number": {"$regex": regex_pattern, "$options": "i"}},
            {"quotation_number": 1}
        )
        items = await cursor.to_list(length=None)
        
        max_num = 0
        for item in items:
            quo_num = item.get("quotation_number", "")
            match = re.search(rf"^{prefix}(\d+)", quo_num, re.IGNORECASE)
            if match:
                try:
                    num = int(match.group(1))
                    if num > max_num:
                        max_num = num
                except ValueError:
                    pass

        next_num = max_num + 1
        return f"{prefix}{next_num:03d}"

    @classmethod
    async def create(cls, data: dict):
        collection = await cls.get_collection()
        data["created_at"] = datetime.utcnow()
        data["updated_at"] = datetime.utcnow()
        data["is_deleted"] = False
        
        result = await collection.insert_one(data)
        data["_id"] = str(result.inserted_id)
        return data

    @classmethod
    async def get_all(
        cls,
        is_deleted: bool = False,
        status: Optional[str] = None,
        search: Optional[str] = None,
        client_id: Optional[str] = None,
        timeline: Optional[str] = None,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        page: Optional[int] = None,
        limit: Optional[int] = None
    ):
        collection = await cls.get_collection()
        query = {"is_deleted": is_deleted}
        today_str = datetime.utcnow().strftime("%Y-%m-%d")

        if status and status.strip().lower() != "all":
            st = status.strip().lower()
            if st == "overdue":
                query["$or"] = [
                    {"status": "overdue"},
                    {
                        "status": {"$in": ["sent", "draft"]},
                        "valid_until": {"$exists": True, "$ne": None, "$ne": "", "$lt": today_str}
                    }
                ]
            elif st == "upcoming":
                query["$or"] = [
                    {"status": "upcoming"},
                    {
                        "status": {"$in": ["sent", "draft"]},
                        "valid_until": {"$exists": True, "$ne": None, "$ne": "", "$gte": today_str}
                    }
                ]
            elif st == "cancelled":
                query["status"] = {"$in": ["cancelled", "declined"]}
            else:
                query["status"] = status.strip()

        if client_id:
            query["client_id"] = client_id

        # Timeline / Date range filter
        date_cond = cls._build_date_query(timeline, from_date, to_date)
        if date_cond:
            query.update(date_cond)

        if search and search.strip():
            s = search.strip()
            search_or = [
                {"quotation_number": {"$regex": s, "$options": "i"}},
                {"client_name": {"$regex": s, "$options": "i"}},
                {"client_email": {"$regex": s, "$options": "i"}},
                {"client_phone": {"$regex": s, "$options": "i"}},
                {"client_company": {"$regex": s, "$options": "i"}},
                {"client_gstin": {"$regex": s, "$options": "i"}},
                {"subject": {"$regex": s, "$options": "i"}},
                {"status": {"$regex": s, "$options": "i"}},
                {"line_items.description": {"$regex": s, "$options": "i"}}
            ]
            if "$or" in query:
                query = {"$and": [{"$or": query.pop("$or")}, {"$or": search_or}]}
            else:
                query["$or"] = search_or

        total_count = await collection.count_documents(query)
        cursor = collection.find(query).sort("created_at", -1)

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
    def _build_date_query(cls, timeline: Optional[str], from_date: Optional[str], to_date: Optional[str]) -> dict:
        from datetime import timedelta
        now = datetime.utcnow()
        date_query = {}

        if from_date or to_date:
            t_query = {}
            if from_date:
                try:
                    dt_from = datetime.strptime(from_date, "%Y-%m-%d")
                    t_query["$gte"] = dt_from
                except ValueError:
                    pass
            if to_date:
                try:
                    dt_to = datetime.strptime(to_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
                    t_query["$lte"] = dt_to
                except ValueError:
                    pass
            if t_query:
                date_query["created_at"] = t_query
        elif timeline and timeline.lower() != "all":
            t = timeline.lower()
            start_date = None
            end_date = now.replace(hour=23, minute=59, second=59)

            if t == "today":
                start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
            elif t == "this_week":
                start_date = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
            elif t == "this_month":
                start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            elif t == "this_quarter":
                quarter_month = 3 * ((now.month - 1) // 3) + 1
                start_date = now.replace(month=quarter_month, day=1, hour=0, minute=0, second=0, microsecond=0)
            elif t == "this_year":
                start_date = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)

            if start_date:
                date_query["created_at"] = {"$gte": start_date, "$lte": end_date}

        return date_query

    @classmethod
    async def get_kpi_stats(
        cls,
        timeline: Optional[str] = "all",
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        client_id: Optional[str] = None
    ) -> dict:
        collection = await cls.get_collection()
        query = {"is_deleted": False}

        if client_id:
            query["client_id"] = client_id

        date_cond = cls._build_date_query(timeline, from_date, to_date)
        if date_cond:
            query.update(date_cond)

        items = await collection.find(query).to_list(length=None)
        today_str = datetime.utcnow().strftime("%Y-%m-%d")

        total_cnt = len(items)
        total_amt = sum(float(i.get("total_amount") or 0.0) for i in items)

        acc_conv_cnt = 0
        acc_conv_amt = 0.0

        up_act_cnt = 0
        up_act_amt = 0.0

        ovr_exp_cnt = 0
        ovr_exp_amt = 0.0

        can_dec_cnt = 0
        can_dec_amt = 0.0

        status_map: Dict[str, Dict[str, Any]] = {}

        for i in items:
            st = str(i.get("status") or "sent").lower()
            amt = float(i.get("total_amount") or 0.0)
            valid_until = i.get("valid_until")

            if st not in status_map:
                status_map[st] = {"count": 0, "total_amount": 0.0}
            status_map[st]["count"] += 1
            status_map[st]["total_amount"] = round(status_map[st]["total_amount"] + amt, 2)

            if st in ["accepted", "converted"]:
                acc_conv_cnt += 1
                acc_conv_amt += amt
            elif st in ["cancelled", "declined"]:
                can_dec_cnt += 1
                can_dec_amt += amt
            elif st in ["expired", "overdue"] or (valid_until and valid_until < today_str and st in ["sent", "draft"]):
                ovr_exp_cnt += 1
                ovr_exp_amt += amt
            else:
                up_act_cnt += 1
                up_act_amt += amt

        return {
            "timeline": timeline or "all",
            "total_quotations": {"count": total_cnt, "total_amount": round(total_amt, 2)},
            "accepted_converted": {"count": acc_conv_cnt, "total_amount": round(acc_conv_amt, 2)},
            "upcoming_active": {"count": up_act_cnt, "total_amount": round(up_act_amt, 2)},
            "overdue_expired": {"count": ovr_exp_cnt, "total_amount": round(ovr_exp_amt, 2)},
            "cancelled_declined": {"count": can_dec_cnt, "total_amount": round(can_dec_amt, 2)},
            "status_breakdown": status_map
        }

    @classmethod
    async def get_by_id(cls, quotation_id: str):
        collection = await cls.get_collection()
        if not ObjectId.is_valid(quotation_id):
            return None
        item = await collection.find_one({"_id": ObjectId(quotation_id)})
        if item:
            item["_id"] = str(item["_id"])
        return item

    @classmethod
    async def update(cls, quotation_id: str, data: dict):
        collection = await cls.get_collection()
        if not ObjectId.is_valid(quotation_id):
            return False

        update_data = {k: v for k, v in data.items() if k != "_id"}
        update_data["updated_at"] = datetime.utcnow()
        result = await collection.update_one(
            {"_id": ObjectId(quotation_id)},
            {"$set": update_data}
        )
        return result.modified_count > 0 or result.matched_count > 0

    @classmethod
    async def update_status(cls, quotation_id: str, status: str):
        collection = await cls.get_collection()
        if not ObjectId.is_valid(quotation_id):
            return False

        result = await collection.update_one(
            {"_id": ObjectId(quotation_id)},
            {"$set": {"status": status, "updated_at": datetime.utcnow()}}
        )
        return result.modified_count > 0 or result.matched_count > 0

    @classmethod
    async def mark_converted(cls, quotation_id: str, invoice_id: str, invoice_number: str):
        collection = await cls.get_collection()
        if not ObjectId.is_valid(quotation_id):
            return False

        result = await collection.update_one(
            {"_id": ObjectId(quotation_id)},
            {
                "$set": {
                    "status": "converted",
                    "converted_invoice_id": str(invoice_id),
                    "converted_invoice_number": invoice_number,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        return result.modified_count > 0 or result.matched_count > 0

    @classmethod
    async def delete(cls, quotation_id: str):
        collection = await cls.get_collection()
        if not ObjectId.is_valid(quotation_id):
            return False

        result = await collection.update_one(
            {"_id": ObjectId(quotation_id)},
            {"$set": {"is_deleted": True, "updated_at": datetime.utcnow()}}
        )
        return result.modified_count > 0 or result.matched_count > 0
