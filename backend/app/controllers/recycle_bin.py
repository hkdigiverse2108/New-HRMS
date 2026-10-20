from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pymongo.errors import DuplicateKeyError

from app.controllers.auth import RoleChecker
from app.database.db import get_database
from app.redis.service import clear_pattern

router = APIRouter(prefix="/recycle-bin", tags=["Recycle Bin"])

admin_only = RoleChecker(["Admin", "CEO"])

DEFAULT_FLAG = "is_deleted"


def _entry(label: str, collection: str, names: List[str], page: str, flag: str = DEFAULT_FLAG, cache: Optional[List[str]] = None) -> Dict[str, Any]:
    return {"label": label, "collection": collection, "names": names, "page": page, "flag": flag, "cache": cache or []}


# Every collection that soft-deletes. `names` are the fields (dotted paths) tried in order to label a row.
REGISTRY: Dict[str, Dict[str, Any]] = {
    "employee": _entry("Employee", "employees", ["personal_info.first_name", "email"], page="Employees", flag="work_details.is_delete"),
    "department": _entry("Department", "departments", ["name", "department_name"], page="Departments & Designations"),
    "sub_department": _entry("Sub Department", "sub_departments", ["name"], page="Departments & Designations"),
    "designation": _entry("Designation", "designations", ["name"], page="Departments & Designations"),
    "leave": _entry("Leave Request", "leave_requests", ["employee_name", "type", "leave_type"], page="Leave Requests"),
    "overtime": _entry("Overtime Request", "overtime_requests", ["employee_name", "date"], page="Overtime"),
    "remark": _entry("Remark", "remarks", ["employee_name", "remark", "content"], page="Remarks"),
    "remark_question": _entry("Remark Question", "remark_questions", ["question", "text"], page="Remarks"),
    "daily_progress": _entry("Daily Progress", "daily_progress", ["employee_name", "employee_id"], page="Daily Progress"),
    "penalty_type": _entry("Penalty Type", "penalty_types", ["name"], page="Penalties"),
    "penalty": _entry("Penalty", "employee_penalties", ["penalty_type_name", "employee_id"], page="Penalties"),
    "booking_page": _entry("Booking Page", "booking_pages", ["title", "name"], page="Schedule", cache=["booking_pages:*"]),
    "sales_target": _entry("Sales Target", "sales_targets", ["name", "type", "month"], page="Sales"),
    "sales_lead": _entry("Sales Lead", "sales_leads", ["name", "company", "email"], page="Sales"),
    "schedule_event": _entry("Schedule Event", "schedule_events", ["title"], page="Schedule", cache=["schedule:*", "attendance:*"]),
    "chat_channel": _entry("Chat Channel", "chat_channels", ["name"], page="Chat", cache=["chat:*"]),
    "chat_message": _entry("Chat Message", "chat_messages", ["content", "file_name"], page="Chat", cache=["chat:*"]),
    "client": _entry("Client", "clients", ["name", "company_name"], page="Projects & Clients"),
    "project": _entry("Project", "projects", ["general.name", "name"], page="Projects & Clients"),
    "task": _entry("Task", "tasks", ["title", "name"], page="Tasks"),
    "content": _entry("Content Item", "content_items", ["title", "name"], page="Projects & Clients"),
    "bank_account": _entry("Bank Account", "bank_accounts", ["bank_name", "account_name"], page="Finance"),
    "invoice_service": _entry("Invoice Service", "invoice_services", ["description"], page="Invoices"),
    "invoice": _entry("Invoice", "invoices", ["invoice_number"], page="Invoices"),
    "quotation": _entry("Quotation", "quotations", ["quotation_number"], page="Quotations"),
    "transaction": _entry("Transaction", "finance_transactions", ["ref_no", "description", "brand"], page="Finance"),
    "other_transaction": _entry("Other Transaction", "other_transactions", ["description", "party", "reference"], page="Finance"),
    "other_bank_account": _entry("Other Bank Account", "other_bank_accounts", ["bank_name", "account_name"], page="Finance"),
    "document_type": _entry("Document Type", "document_types", ["name"], page="Documents"),
    "document_template": _entry("Document Template", "document_templates", ["name", "title"], page="Documents"),
    "generated_document": _entry("Generated Document", "generated_documents", ["title", "name"], page="Documents"),
    "submitted_document": _entry("Submitted Document", "submitted_documents", ["title", "name", "document_name"], page="Documents"),
    "letter_request": _entry("Letter Request", "letter_requests", ["letter_type", "employee_name"], page="Documents"),
    "gallery": _entry("Gallery Event", "gallery_events", ["title", "name"], page="Gallery"),
    "hiring": _entry("Job Opening", "hirings", ["job_title", "title", "position"], page="Recruitment"),
    "referral": _entry("Job Referral", "job_referrals", ["candidate_name", "name"], page="Recruitment"),
    "interview_stage": _entry("Interview Stage", "interview_stages", ["name"], page="Recruitment"),
    "interview_schedule": _entry("Interview Schedule", "interview_schedules", ["candidate_name", "title"], page="Recruitment"),
    "research": _entry("Research", "research_items", ["title", "name"], page="Research"),
    "resource_category": _entry("Resource Category", "resource_categories", ["name"], page="Resource Management"),
    "resource_inventory": _entry("Resource Item", "resource_inventory", ["name", "asset_tag", "serial_number"], page="Resource Management"),
    "seating_floor": _entry("Seating Floor", "seating_floors", ["name", "floor_name"], page="Seating"),
    "preset": _entry("Development Preset", "development_presets", ["name", "title"], page="Projects & Clients"),
}


def _get(doc: Dict[str, Any], path: str) -> Any:
    cur: Any = doc
    for part in path.split("."):
        if not isinstance(cur, dict):
            return None
        cur = cur.get(part)
    return cur


def _to_dt(value: Any) -> Optional[datetime]:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str) and value:
        try:
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except ValueError:
            return None
    return None


def _deleted_at(doc: Dict[str, Any], flag: str) -> Optional[datetime]:
    # Soft deletes stamp `deleted_at` where they can; otherwise the last update is the best guess.
    # With neither, the age is unknown, so the item is kept (never expires out of the bin).
    for key in ("deleted_at", "updated_at"):
        dt = _to_dt(_get(doc, key))
        if dt:
            return dt
    return None


def _item_name(doc: Dict[str, Any], names: List[str], label: str) -> str:
    parts: List[str] = []
    for path in names:
        val = _get(doc, path)
        if val not in (None, ""):
            parts.append(str(val))
            break
    if doc.get("work_details") and "personal_info" in doc and _get(doc, "personal_info.last_name"):
        parts.append(str(_get(doc, "personal_info.last_name")))
    name = " ".join(parts).strip()
    return name[:120] if name else f"{label} #{str(doc.get('_id'))[-6:]}"


def _id_query(item_id: str) -> Dict[str, Any]:
    return {"_id": ObjectId(item_id)} if ObjectId.is_valid(item_id) else {"_id": item_id}


def _entry_or_404(module: str) -> Dict[str, Any]:
    entry = REGISTRY.get(module)
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown recycle bin module")
    return entry


async def _clear_caches(entry: Dict[str, Any]) -> None:
    for pattern in entry["cache"]:
        try:
            await clear_pattern(pattern)
        except Exception:
            pass


@router.get("", dependencies=[Depends(admin_only)])
async def list_deleted_items(
    module: Optional[str] = Query(None, description="Limit to one module key"),
    page: Optional[str] = Query(None, description="Limit to one page (e.g. Tasks)"),
    search: Optional[str] = Query(None),
):
    db = get_database()
    needle = (search or "").strip().lower()
    keys = [module] if module else list(REGISTRY.keys())
    if page:
        keys = [k for k in keys if REGISTRY[k]["page"] == page]
    items: List[Dict[str, Any]] = []

    for key in keys:
        entry = _entry_or_404(key)
        try:
            cursor = db[entry["collection"]].find({entry["flag"]: True})
            async for doc in cursor:
                deleted_at = _deleted_at(doc, entry["flag"])
                name = _item_name(doc, entry["names"], entry["label"])
                if needle and needle not in name.lower() and needle not in entry["label"].lower():
                    continue
                items.append({
                    "id": str(doc["_id"]),
                    "module": key,
                    "module_label": entry["label"],
                    "page": entry["page"],
                    "item_name": name,
                    "deleted_at": deleted_at.isoformat() if deleted_at else None,
                    "deleted_by": doc.get("deleted_by"),
                })
        except Exception as e:
            print(f"[RECYCLE BIN] skipped {entry['collection']}: {e}")

    items.sort(key=lambda i: i["deleted_at"] or "", reverse=True)
    return items


@router.post("/{module}/{item_id}/restore", dependencies=[Depends(admin_only)])
async def restore_item(module: str, item_id: str):
    entry = _entry_or_404(module)
    db = get_database()
    try:
        result = await db[entry["collection"]].update_one(
            {**_id_query(item_id), entry["flag"]: True},
            {"$set": {entry["flag"]: False}, "$unset": {"deleted_at": "", "deleted_by": ""}},
        )
    except DuplicateKeyError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An active item with the same name already exists. Rename or delete it first.",
        )
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found in recycle bin")
    await _clear_caches(entry)
    return {"message": f"{entry['label']} restored"}


@router.delete("/{module}/{item_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(admin_only)])
async def permanently_delete_item(module: str, item_id: str):
    entry = _entry_or_404(module)
    db = get_database()
    result = await db[entry["collection"]].delete_one({**_id_query(item_id), entry["flag"]: True})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found in recycle bin")
    await _clear_caches(entry)
