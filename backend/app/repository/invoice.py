import re
from app.database.db import get_database
from datetime import datetime, date, timezone
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

def _lowest_free_number(used: set) -> int:
    """Smallest positive number not in use, so a deleted document's number is reused first."""
    n = 1
    while n in used:
        n += 1
    return n

def _ledger_client_name(inv: dict) -> str:
    return str(inv.get("client_name") or inv.get("brand") or "Unknown Brand").strip()

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
        # Deleted invoices free their number, so only live invoices occupy one
        cursor = collection.find(
            {"invoice_number": {"$regex": regex_pattern, "$options": "i"}, "is_deleted": {"$ne": True}},
            {"invoice_number": 1}
        )
        items = await cursor.to_list(length=None)
        used = {
            int(m.group(1))
            for item in items
            if (m := re.search(rf"^{prefix}(\d+)", item.get("invoice_number", ""), re.IGNORECASE))
        }
        return f"{prefix}{_lowest_free_number(used):03d}"

    @classmethod
    async def create(cls, data: dict):
        collection = await cls.get_collection()
        data["created_at"] = datetime.now(timezone.utc)
        data["updated_at"] = datetime.now(timezone.utc)
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

        if invoice_type and invoice_type.strip().lower() != "all":
            query["invoice_type"] = invoice_type.strip()

        if status and status.strip().lower() != "all":
            clean_status = status.strip().lower()
            if clean_status in ["pending_approval", "pending approval", "payment approval", "payment_approval"]:
                query["status"] = "pending_approval"
            else:
                query["status"] = {"$regex": f"^{re.escape(clean_status)}$", "$options": "i"}

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
        update_data["updated_at"] = datetime.now(timezone.utc)
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
                    "updated_at": datetime.now(timezone.utc)
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
            {"$set": {"status": status, "updated_at": datetime.now(timezone.utc)}}
        )
        return result.modified_count > 0 or result.matched_count > 0

    @classmethod
    async def delete(cls, invoice_id: str):
        collection = await cls.get_collection()
        if not ObjectId.is_valid(invoice_id):
            return False

        result = await collection.update_one(
            {"_id": ObjectId(invoice_id)},
            {"$set": {"is_deleted": True, "updated_at": datetime.now(timezone.utc)}}
        )
        return result.modified_count > 0 or result.matched_count > 0

    @classmethod
    async def append_log(cls, invoice_id: str, log_entry: dict):
        collection = await cls.get_collection()
        if not ObjectId.is_valid(invoice_id):
            return False

        if "timestamp" not in log_entry:
            log_entry["timestamp"] = datetime.now(timezone.utc)

        result = await collection.update_one(
            {"_id": ObjectId(invoice_id)},
            {
                "$push": {"activity_logs": log_entry},
                "$set": {"updated_at": datetime.now(timezone.utc)}
            }
        )
        return result.modified_count > 0 or result.matched_count > 0

    # Statuses that never count as money received in the ledger
    LEDGER_EXCLUDED_STATUSES = ["draft", "cancelled", "canceled", "rejected"]

    @staticmethod
    def _parse_filter_date(value: Optional[str]) -> Optional[date]:
        if not value:
            return None
        for fmt in ("%Y-%m-%d", "%d-%m-%Y"):
            try:
                return datetime.strptime(value.strip(), fmt).date()
            except ValueError:
                pass
        return None

    @classmethod
    async def _fetch_ledger_invoices(
        cls,
        invoice_type: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        month: Optional[int] = None,
        year: Optional[int] = None,
        search: Optional[str] = None,
        client_name: Optional[str] = None,
        mode_of_payment: Optional[str] = None,
        user_id: Optional[str] = None,
        is_admin: bool = True
    ) -> List[tuple]:
        """Return [(invoice, invoice_date)] for active ledger invoices matching the filters."""
        collection = await cls.get_collection()
        excluded = "|".join(cls.LEDGER_EXCLUDED_STATUSES)
        query = {
            "is_deleted": False,
            "status": {"$not": re.compile(f"^({excluded})$", re.IGNORECASE)}
        }

        if not is_admin and user_id:
            uid_str = str(user_id)
            query["$or"] = [
                {"created_by.user_id": uid_str},
                {"accessible_employee_ids": uid_str}
            ]

        if invoice_type and invoice_type.strip().lower() != "all":
            query["invoice_type"] = invoice_type.strip()

        if mode_of_payment and mode_of_payment.strip().lower() != "all":
            query["mode_of_payment"] = mode_of_payment.strip()

        if search and search.strip():
            s = re.escape(search.strip())
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

        invoices = await collection.find(query).to_list(length=None)

        eff_start_date = cls._parse_filter_date(from_date or start_date)
        eff_end_date = cls._parse_filter_date(to_date or end_date)
        wanted_client = None
        if client_name and client_name.strip().lower() != "all":
            wanted_client = client_name.strip().lower()

        result = []
        for inv in invoices:
            if wanted_client and _ledger_client_name(inv).lower() != wanted_client:
                continue
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
            result.append((inv, inv_date))
        return result

    @classmethod
    async def get_ledger_entries(
        cls,
        invoice_type: Optional[str] = None,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        client_name: Optional[str] = None,
        mode_of_payment: Optional[str] = None,
        search: Optional[str] = None,
        user_id: Optional[str] = None,
        is_admin: bool = True,
        page: Optional[int] = None,
        limit: Optional[int] = None
    ):
        rows = await cls._fetch_ledger_invoices(
            invoice_type=invoice_type,
            from_date=from_date,
            to_date=to_date,
            search=search,
            client_name=client_name,
            mode_of_payment=mode_of_payment,
            user_id=user_id,
            is_admin=is_admin
        )
        # Oldest first so the running total reads top to bottom
        rows.sort(key=lambda r: (r[1] or date.min, str(r[0].get("invoice_number") or "")))

        summary = {
            "total_received": 0.0, "taxable_amount": 0.0, "cgst_amount": 0.0,
            "sgst_amount": 0.0, "igst_amount": 0.0, "gst_total": 0.0,
            "invoices_count": 0, "tax_count": 0, "proforma_count": 0,
            "tax_received": 0.0, "proforma_received": 0.0
        }
        entries = []
        running = 0.0
        for inv, inv_date in rows:
            total = float(inv.get("total_due") or 0.0)
            taxable = max(0.0, float(inv.get("total_before_tax") or 0.0) - float(inv.get("additional_discount") or 0.0))
            cgst = float(inv.get("cgst_amount") or 0.0)
            sgst = float(inv.get("sgst_amount") or 0.0)
            igst = float(inv.get("igst_amount") or 0.0)
            inv_type = inv.get("invoice_type") or "Tax Invoice"
            running += total

            entries.append({
                "id": str(inv["_id"]),
                "date": inv_date.isoformat() if inv_date else None,
                "invoice_number": inv.get("invoice_number"),
                "invoice_type": inv_type,
                "client_id": inv.get("client_id"),
                "client_name": _ledger_client_name(inv),
                "client_gstin": inv.get("client_gstin"),
                "state_ut": inv.get("state_ut"),
                "taxable_amount": round(taxable, 2),
                "cgst_amount": round(cgst, 2),
                "sgst_amount": round(sgst, 2),
                "igst_amount": round(igst, 2),
                "round_off": round(float(inv.get("round_off") or 0.0), 2),
                "total": round(total, 2),
                "mode_of_payment": inv.get("mode_of_payment"),
                "bank": inv.get("bank_nickname") or inv.get("bank_name"),
                "running_total": round(running, 2)
            })

            summary["total_received"] += total
            summary["taxable_amount"] += taxable
            summary["cgst_amount"] += cgst
            summary["sgst_amount"] += sgst
            summary["igst_amount"] += igst
            summary["invoices_count"] += 1
            if inv_type == "Proforma Invoice":
                summary["proforma_count"] += 1
                summary["proforma_received"] += total
            else:
                summary["tax_count"] += 1
                summary["tax_received"] += total

        summary["gst_total"] = summary["cgst_amount"] + summary["sgst_amount"] + summary["igst_amount"]
        for key in ("total_received", "taxable_amount", "cgst_amount", "sgst_amount", "igst_amount", "gst_total",
                    "tax_received", "proforma_received"):
            summary[key] = round(summary[key], 2)

        total_count = len(entries)
        data = entries
        if page and limit:
            skip = (page - 1) * limit
            data = entries[skip : skip + limit]

        return {
            "summary": summary,
            "data": data,
            "total": total_count,
            "page": page or 1,
            "limit": limit or total_count or 1,
            "total_pages": (total_count + (limit or 1) - 1) // (limit or 1) if limit else 1
        }

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
        rows = await cls._fetch_ledger_invoices(
            invoice_type=invoice_type,
            start_date=start_date,
            end_date=end_date,
            from_date=from_date,
            to_date=to_date,
            month=month,
            year=year,
            search=search,
            user_id=user_id,
            is_admin=is_admin
        )

        today_str = datetime.utcnow().strftime("%Y-%m-%d")

        # Group by brand (client_name)
        brands_map = {}
        overall_invoices_count = 0
        overall_total_amount = 0.0
        overall_total_paid = 0.0
        overall_total_pending = 0.0
        overall_total_overdue = 0.0

        for inv, inv_date in rows:
            brand_name = _ledger_client_name(inv)
            client_id = inv.get("client_id")

            if brand_name not in brands_map:
                brands_map[brand_name] = {
                    "brand": brand_name,
                    "client_id": client_id,
                    "invoices_count": 0,
                    "total_amount": 0.0,
                    "total_paid": 0.0,
                    "total_pending": 0.0,
                    "total_overdue": 0.0,
                    "taxable_amount": 0.0,
                    "gst_amount": 0.0,
                    "tax_invoice_count": 0,
                    "proforma_count": 0,
                    "last_invoice_date": None
                }

            b = brands_map[brand_name]
            amt = float(inv.get("total_due") or 0.0)
            status = str(inv.get("status") or "paid").lower()
            due_date = str(inv.get("due_date") or "").strip()

            b["invoices_count"] += 1
            b["total_amount"] += amt
            b["taxable_amount"] += max(0.0, float(inv.get("total_before_tax") or 0.0) - float(inv.get("additional_discount") or 0.0))
            b["gst_amount"] += float(inv.get("total_tax_amount") or 0.0)
            if inv.get("invoice_type") == "Proforma Invoice":
                b["proforma_count"] += 1
            else:
                b["tax_invoice_count"] += 1
            if inv_date:
                date_str = inv_date.isoformat()
                if not b["last_invoice_date"] or date_str > b["last_invoice_date"]:
                    b["last_invoice_date"] = date_str

            overall_invoices_count += 1
            overall_total_amount += amt

            if status == "paid":
                b["total_paid"] += amt
                overall_total_paid += amt
            elif status in ["pending_approval", "unpaid", "partially_paid"]:
                b["total_pending"] += amt
                overall_total_pending += amt

            # Check Overdue
            if due_date and due_date < today_str and status != "paid":
                b["total_overdue"] += amt
                overall_total_overdue += amt

        # Format items list
        brand_items = []
        for b in brands_map.values():
            brand_items.append({
                **b,
                "total_amount": round(b["total_amount"], 2),
                "total_paid": round(b["total_paid"], 2),
                "total_pending": round(b["total_pending"], 2),
                "total_overdue": round(b["total_overdue"], 2),
                "taxable_amount": round(b["taxable_amount"], 2),
                "gst_amount": round(b["gst_amount"], 2)
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
