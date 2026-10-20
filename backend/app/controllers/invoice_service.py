import re
from datetime import datetime
from typing import List

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.controllers.auth import get_current_employee
from app.controllers.settings import check_admin_role
from app.database.db import get_database
from app.schemas.invoice_service import InvoiceServiceCreate, InvoiceServiceResponse, InvoiceServiceUpdate

# Catalog of services picked from the "Item Description" dropdown on invoices. Editing a service here
# never touches invoices already created from it: invoices keep their own copy of each line.
router = APIRouter(prefix="/invoice-services", tags=["Invoice Services"])


def _col():
    return get_database()["invoice_services"]


def _with_discounts(rate: float, discount: float, discount_amount: float, discount_type: str) -> dict:
    """One discount, two views: the one the user typed is the source of truth, the other is derived from the rate."""
    if discount_type == "amount":
        discount_amount = min(discount_amount, rate)
        discount = round(discount_amount / rate * 100, 2) if rate else 0
    else:
        discount_amount = round(rate * discount / 100, 2)
    return {"discount": discount, "discount_amount": discount_amount, "discount_type": discount_type}


def _normalize(doc: dict) -> dict:
    """Settles records from earlier versions: no type, or a % and a flat amount saved side by side."""
    rate = doc.get("rate", 0)
    pct = doc.get("discount", 0)
    amt = doc.get("discount_amount", 0)
    kind = doc.get("discount_type")
    if kind is None:
        if pct and amt:
            amt, kind = round(rate * pct / 100 + amt, 2), "amount"
        else:
            kind = "amount" if amt and not pct else "percent"
    doc.update(_with_discounts(rate, pct, amt, kind))
    return doc


def _serialize(doc: dict) -> dict:
    _normalize(doc)
    doc["_id"] = str(doc["_id"])
    doc["amount"] = round(doc.get("rate", 0) - doc["discount_amount"], 2)
    return doc


async def _get_or_404(service_id: str) -> dict:
    if not ObjectId.is_valid(service_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")
    doc = await _col().find_one({"_id": ObjectId(service_id), "is_deleted": {"$ne": True}})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")
    return doc


async def _ensure_unique(description: str, exclude_id: str = "") -> None:
    query = {"description": {"$regex": f"^{re.escape(description.strip())}$", "$options": "i"}, "is_deleted": {"$ne": True}}
    if exclude_id:
        query["_id"] = {"$ne": ObjectId(exclude_id)}
    if await _col().count_documents(query, limit=1):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A service with this description already exists")


@router.get("", response_model=List[InvoiceServiceResponse], response_model_by_alias=True)
async def list_services(current_user: dict = Depends(get_current_employee)):
    docs = await _col().find({"is_deleted": {"$ne": True}}).sort("description", 1).to_list(length=1000)
    return [_serialize(d) for d in docs]


@router.post("", response_model=InvoiceServiceResponse, response_model_by_alias=True, status_code=status.HTTP_201_CREATED)
async def create_service(data: InvoiceServiceCreate, current_user: dict = Depends(get_current_employee)):
    check_admin_role(current_user)
    await _ensure_unique(data.description)
    now = datetime.utcnow()
    doc = {
        **data.model_dump(),
        "description": data.description.strip(),
        "sac": data.sac.strip(),
        **_with_discounts(data.rate, data.discount, data.discount_amount, data.discount_type),
        "is_deleted": False,
        "created_at": now,
        "updated_at": now,
    }
    res = await _col().insert_one(doc)
    doc["_id"] = res.inserted_id
    return _serialize(doc)


@router.put("/{service_id}", response_model=InvoiceServiceResponse, response_model_by_alias=True)
async def update_service(service_id: str, data: InvoiceServiceUpdate, current_user: dict = Depends(get_current_employee)):
    check_admin_role(current_user)
    current = await _get_or_404(service_id)
    updates = data.model_dump(exclude_unset=True)
    # Re-derive the discounts whenever any pricing field changes
    if {"rate", "discount", "discount_amount", "discount_type"} & updates.keys():
        merged = {**_normalize(dict(current)), **updates}
        updates.update(_with_discounts(merged.get("rate", 0), merged.get("discount", 0), merged.get("discount_amount", 0), merged.get("discount_type", "percent")))
    if "description" in updates:
        updates["description"] = updates["description"].strip()
        await _ensure_unique(updates["description"], exclude_id=service_id)
    if "sac" in updates:
        updates["sac"] = updates["sac"].strip()
    updates["updated_at"] = datetime.utcnow()
    await _col().update_one({"_id": ObjectId(service_id)}, {"$set": updates})
    return _serialize(await _get_or_404(service_id))


@router.delete("/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_service(service_id: str, current_user: dict = Depends(get_current_employee)):
    check_admin_role(current_user)
    await _get_or_404(service_id)
    await _col().update_one(
        {"_id": ObjectId(service_id)},
        {"$set": {"is_deleted": True, "deleted_at": datetime.utcnow(), "updated_at": datetime.utcnow()}},
    )
