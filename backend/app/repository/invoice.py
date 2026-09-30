import re
from app.database.db import get_database
from datetime import datetime, date
from bson import ObjectId
from typing import Optional, List, Dict, Any

def parse_inv_date(inv: dict) -> Optional[date]:
    issue_date = inv.get("issue_date")
    if issue_date and isinstance(issue_date, str):
        issue_date = issue_date.strip()
        try:
            return datetime.strptime(issue_date, "%Y-%m-%d").date()
        except ValueError:
            pass
        try:
            return datetime.strptime(issue_date, "%d-%m-%Y").date()
        except ValueError:
            pass
        try:
            return datetime.fromisoformat(issue_date.replace("Z", "+00:00")).date()
        except ValueError:
            pass
    created_at = inv.get("created_at")
    if isinstance(created_at, datetime):
        return created_at.date()
    return None

class InvoiceRepository:
    collection_name = "invoices"

    @classmethod
    async def get_collection(cls):
        db = get_database()
        return db[cls.collection_name]

    @classmethod
    async def get_next_number(cls, invoice_type: str = "Tax Invoice") -> str:
        collection = await cls.get_collection()
        prefix = "PINV-" if invoice_type == "Proforma Invoice" else "INV-"
        
        regex_pattern = f"^{prefix}\\d+"
        cursor = collection.find(
            {"invoice_number": {"$regex": regex_pattern, "$options": "i"}},
            {"invoice_number": 1}
        )
        items = await cursor.to_list(length=None)
        
        max_num = 0
        for item in items:
            inv_num = item.get("invoice_number", "")
            match = re.search(rf"^{prefix}(\d+)", inv_num, re.IGNORECASE)
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
        if "accessible_employee_ids" not in data:
            data["accessible_employee_ids"] = []
        
        result = await collection.insert_one(data)
        data["_id"] = str(result.inserted_id)
        return data

    @classmethod
    async def get_all(
        cls,
        is_deleted: bool = False,
        invoice_type: Optional[str] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
        client_id: Optional[str] = None,
        user_id: Optional[str] = None,
        is_admin: bool = True,
        page: Optional[int] = None,
        limit: Optional[int] = None
    ):
        collection = await cls.get_collection()
        query = {"is_deleted": is_deleted}

        if not is_admin and user_id:
            uid_str = str(user_id)
            query["$or"] = [
                {"created_by.user_id": uid_str},
                {"accessible_employee_ids": uid_str}
            ]

        if invoice_type and invoice_type.strip().lower() != "all":
            query["invoice_type"] = invoice_type.strip()

        if status and status.strip().lower() != "all":
            clean_status = status.strip().lower()
            if clean_status in ["pending_approval", "pending approval", "payment approval", "payment_approval"]:
                query["status"] = "pending_approval"
            else:
                query["status"] = status.strip()

        if client_id:
            query["client_id"] = client_id

        if search and search.strip():
            s = search.strip()
            search_clause = [
                {"invoice_number": {"$regex": s, "$options": "i"}},
                {"client_name": {"$regex": s, "$options": "i"}},
                {"client_phone": {"$regex": s, "$options": "i"}},
                {"client_gstin": {"$regex": s, "$options": "i"}},
                {"client_department": {"$regex": s, "$options": "i"}},
                {"po_number": {"$regex": s, "$options": "i"}},
                {"mode_of_payment": {"$regex": s, "$options": "i"}},
                {"status": {"$regex": s, "$options": "i"}},
                {"invoice_type": {"$regex": s, "$options": "i"}},
                {"state_ut": {"$regex": s, "$options": "i"}},
                {"bank_nickname": {"$regex": s, "$options": "i"}},
                {"bank_name": {"$regex": s, "$options": "i"}},
                {"line_items.description": {"$regex": s, "$options": "i"}}
            ]
            if "$or" in query:
                access_or = query.pop("$or")
                query["$and"] = [
                    {"$or": access_or},
                    {"$or": search_clause}
                ]
            else:
                query["$or"] = search_clause

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
    async def get_by_id(cls, invoice_id: str):
        collection = await cls.get_collection()
        if not ObjectId.is_valid(invoice_id):
            return None
        item = await collection.find_one({"_id": ObjectId(invoice_id)})
        if item:
            item["_id"] = str(item["_id"])
        return item

    @classmethod
    async def update(cls, invoice_id: str, data: dict):
        collection = await cls.get_collection()
        if not ObjectId.is_valid(invoice_id):
            return False

        update_data = {k: v for k, v in data.items() if k != "_id"}
        update_data["updated_at"] = datetime.utcnow()
        result = await collection.update_one(
            {"_id": ObjectId(invoice_id)},
            {"$set": update_data}
        )
        return result.modified_count > 0 or result.matched_count > 0

    @classmethod
    async def update_access(cls, invoice_id: str, employee_ids: List[str], accessible_employees_info: List[dict]):
        collection = await cls.get_collection()
        if not ObjectId.is_valid(invoice_id):
            return False

        result = await collection.update_one(
            {"_id": ObjectId(invoice_id)},
            {
                "$set": {
                    "accessible_employee_ids": employee_ids,
                    "accessible_employees": accessible_employees_info,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        return result.modified_count > 0 or result.matched_count > 0

    @classmethod
    async def update_status(cls, invoice_id: str, status: str):
        collection = await cls.get_collection()
        if not ObjectId.is_valid(invoice_id):
            return False

        result = await collection.update_one(
            {"_id": ObjectId(invoice_id)},
            {"$set": {"status": status, "updated_at": datetime.utcnow()}}
        )
        return result.modified_count > 0 or result.matched_count > 0

    @classmethod
    async def delete(cls, invoice_id: str):
        collection = await cls.get_collection()
        if not ObjectId.is_valid(invoice_id):
            return False

        result = await collection.update_one(
            {"_id": ObjectId(invoice_id)},
            {"$set": {"is_deleted": True, "updated_at": datetime.utcnow()}}
        )
        return result.modified_count > 0 or result.matched_count > 0

    @classmethod
    async def append_log(cls, invoice_id: str, log_entry: dict):
        collection = await cls.get_collection()
        if not ObjectId.is_valid(invoice_id):
            return False

        if "timestamp" not in log_entry:
            log_entry["timestamp"] = datetime.utcnow()

        result = await collection.update_one(
            {"_id": ObjectId(invoice_id)},
            {
                "$push": {"activity_logs": log_entry},
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
        return result.modified_count > 0 or result.matched_count > 0

    @classmethod
    async def get_brand_ledger(
        cls,
        invoice_type: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        month: Optional[int] = None,
        year: Optional[int] = None,
        search: Optional[str] = None,
        user_id: Optional[str] = None,
        is_admin: bool = True,
        page: Optional[int] = None,
        limit: Optional[int] = None
    ):
        collection = await cls.get_collection()
        query = {"is_deleted": False}

        if not is_admin and user_id:
            uid_str = str(user_id)
            query["$or"] = [
                {"created_by.user_id": uid_str},
                {"accessible_employee_ids": uid_str}
            ]

        if invoice_type and invoice_type.strip().lower() != "all":
            query["invoice_type"] = invoice_type.strip()

        if search and search.strip():
            s = search.strip()
            search_clause = [
                {"client_name": {"$regex": s, "$options": "i"}},
                {"invoice_number": {"$regex": s, "$options": "i"}},
                {"client_phone": {"$regex": s, "$options": "i"}},
                {"client_gstin": {"$regex": s, "$options": "i"}}
            ]
            if "$or" in query:
                access_or = query.pop("$or")
                query["$and"] = [{"$or": access_or}, {"$or": search_clause}]
            else:
                query["$or"] = search_clause

        cursor = collection.find(query)
        invoices = await cursor.to_list(length=None)

        today_str = datetime.utcnow().strftime("%Y-%m-%d")

        # Parse date boundaries
        eff_start = from_date or start_date
        eff_end = to_date or end_date

        eff_start_date = None
        if eff_start:
            try:
                eff_start_date = datetime.strptime(eff_start.strip(), "%Y-%m-%d").date()
            except ValueError:
                try:
                    eff_start_date = datetime.strptime(eff_start.strip(), "%d-%m-%Y").date()
                except ValueError:
                    pass

        eff_end_date = None
        if eff_end:
            try:
                eff_end_date = datetime.strptime(eff_end.strip(), "%Y-%m-%d").date()
            except ValueError:
                try:
                    eff_end_date = datetime.strptime(eff_end.strip(), "%d-%m-%Y").date()
                except ValueError:
                    pass

        # Group by brand (client_name)
        brands_map = {}
        overall_invoices_count = 0
        overall_total_amount = 0.0
        overall_total_paid = 0.0
        overall_total_pending = 0.0
        overall_total_overdue = 0.0

        for inv in invoices:
            inv_date = parse_inv_date(inv)
            if inv_date:
                if month and inv_date.month != month:
                    continue
                if year and inv_date.year != year:
                    continue
                if eff_start_date and inv_date < eff_start_date:
                    continue
                if eff_end_date and inv_date > eff_end_date:
                    continue

            brand_name = inv.get("client_name") or inv.get("brand") or "Unknown Brand"
            brand_name = brand_name.strip()
            client_id = inv.get("client_id")

            if brand_name not in brands_map:
                brands_map[brand_name] = {
                    "brand": brand_name,
                    "client_id": client_id,
                    "invoices_count": 0,
                    "total_amount": 0.0,
                    "total_paid": 0.0,
                    "total_pending": 0.0,
                    "total_overdue": 0.0
                }

            b = brands_map[brand_name]
            amt = float(inv.get("total_due") or 0.0)
            status = str(inv.get("status") or "paid").lower()
            due_date = str(inv.get("due_date") or "").strip()

            b["invoices_count"] += 1
            b["total_amount"] += amt

            overall_invoices_count += 1
            overall_total_amount += amt

            if status == "paid":
                b["total_paid"] += amt
                overall_total_paid += amt
            elif status in ["pending_approval", "unpaid", "partially_paid"]:
                b["total_pending"] += amt
                overall_total_pending += amt

            # Check Overdue
            if due_date and due_date < today_str and status not in ["paid", "cancelled", "rejected"]:
                b["total_overdue"] += amt
                overall_total_overdue += amt

        # Format items list
        brand_items = []
        for b in brands_map.values():
            brand_items.append({
                "brand": b["brand"],
                "client_id": b["client_id"],
                "invoices_count": b["invoices_count"],
                "total_amount": round(b["total_amount"], 2),
                "total_paid": round(b["total_paid"], 2),
                "total_pending": round(b["total_pending"], 2),
                "total_overdue": round(b["total_overdue"], 2)
            })

        # Sort by total_amount descending
        brand_items.sort(key=lambda x: x["total_amount"], reverse=True)

        total_brands = len(brand_items)
        paginated_data = brand_items

        if page and limit:
            skip = (page - 1) * limit
            paginated_data = brand_items[skip : skip + limit]

        return {
            "overall_summary": {
                "total_brands_count": total_brands,
                "total_invoices_count": overall_invoices_count,
                "total_amount": round(overall_total_amount, 2),
                "total_paid": round(overall_total_paid, 2),
                "total_pending": round(overall_total_pending, 2),
                "total_overdue": round(overall_total_overdue, 2)
            },
            "data": paginated_data,
            "total_brands": total_brands,
            "page": page or 1,
            "limit": limit or total_brands or 1,
            "total_pages": (total_brands + (limit or 1) - 1) // (limit or 1) if limit else 1
        }
