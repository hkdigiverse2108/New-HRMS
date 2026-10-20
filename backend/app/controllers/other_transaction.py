from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
from app.database.db import get_database
from app.schemas.other_transaction import (
    OtherTransactionCreate, OtherTransactionUpdate, OtherTransactionResponse,
    OtherBankAccountCreate, OtherBankAccountUpdate, OtherBankAccountResponse,
)
from app.controllers.auth import get_current_employee

router = APIRouter(prefix="/other-transactions", tags=["Client & External Transactions"])

COLLECTION = "other_transactions"
# This page keeps its own bank accounts, separate from the ledger / invoice "bank_accounts"
BANK_COLLECTION = "other_bank_accounts"


def _col():
    return get_database()[COLLECTION]


def _banks():
    return get_database()[BANK_COLLECTION]


def _serialize(doc: dict) -> dict:
    doc["_id"] = str(doc["_id"])
    return doc


async def _require_bank_account(method: Optional[str], bank_account_id: Optional[str]) -> None:
    if (method or "").lower() == "cash":
        return
    if not bank_account_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please select a bank account (or choose Cash as the method)")
    if not ObjectId.is_valid(bank_account_id) or not await _banks().find_one({"_id": ObjectId(bank_account_id), "is_deleted": False}):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Selected bank account was not found")


async def _get_bank_or_404(account_id: str) -> dict:
    if not ObjectId.is_valid(account_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bank account not found")
    doc = await _banks().find_one({"_id": ObjectId(account_id), "is_deleted": False})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bank account not found")
    return doc


async def _get_or_404(transaction_id: str) -> dict:
    if not ObjectId.is_valid(transaction_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
    doc = await _col().find_one({"_id": ObjectId(transaction_id), "is_deleted": False})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
    return doc


# ---------- Bank accounts (this page only) ----------
@router.get("/bank-accounts", response_model=List[OtherBankAccountResponse], response_model_exclude_none=True)
async def get_other_bank_accounts(current_user: dict = Depends(get_current_employee)):
    items = await _banks().find({"is_deleted": False}).sort("created_at", 1).to_list(length=500)
    return [_serialize(i) for i in items]


@router.post("/bank-accounts", response_model=OtherBankAccountResponse, response_model_exclude_none=True, status_code=status.HTTP_201_CREATED)
async def create_other_bank_account(data: OtherBankAccountCreate, current_user: dict = Depends(get_current_employee)):
    doc = data.model_dump()
    doc["ifsc_code"] = doc["ifsc_code"].strip().upper()
    now = datetime.utcnow()
    doc.update({"created_at": now, "updated_at": now, "is_deleted": False})
    result = await _banks().insert_one(doc)
    doc["_id"] = result.inserted_id
    return _serialize(doc)


@router.put("/bank-accounts/{account_id}", response_model=OtherBankAccountResponse, response_model_exclude_none=True)
async def update_other_bank_account(account_id: str, data: OtherBankAccountUpdate, current_user: dict = Depends(get_current_employee)):
    await _get_bank_or_404(account_id)
    updates = data.model_dump(exclude_unset=True)
    if updates.get("ifsc_code"):
        updates["ifsc_code"] = updates["ifsc_code"].strip().upper()
    updates["updated_at"] = datetime.utcnow()
    await _banks().update_one({"_id": ObjectId(account_id)}, {"$set": updates})
    return _serialize(await _get_bank_or_404(account_id))


@router.delete("/bank-accounts/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_other_bank_account(account_id: str, current_user: dict = Depends(get_current_employee)):
    await _get_bank_or_404(account_id)
    if await _col().count_documents({"bank_account_id": account_id, "is_deleted": False}, limit=1):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This bank account has transactions. Move or delete them first.")
    await _banks().update_one({"_id": ObjectId(account_id)}, {"$set": {"is_deleted": True, "updated_at": datetime.utcnow()}})


# ---------- Transactions ----------
@router.get("", response_model=List[OtherTransactionResponse], response_model_exclude_none=True)
async def get_other_transactions(
    party: Optional[str] = Query(None, description="Client / entity name"),
    bank_account_id: Optional[str] = Query(None, description="Bank account id"),
    current_user: dict = Depends(get_current_employee),
):
    query: dict = {"is_deleted": False}
    if party:
        query["party"] = party
    if bank_account_id:
        query["bank_account_id"] = bank_account_id
    items = await _col().find(query).sort([("date", -1), ("created_at", -1)]).to_list(length=5000)
    return [_serialize(i) for i in items]


@router.post("", response_model=OtherTransactionResponse, response_model_exclude_none=True, status_code=status.HTTP_201_CREATED)
async def create_other_transaction(data: OtherTransactionCreate, current_user: dict = Depends(get_current_employee)):
    doc = data.model_dump()
    doc["party"] = doc["party"].strip()
    if doc["method"].lower() == "cash":
        doc["bank_account_id"] = None
    await _require_bank_account(doc["method"], doc["bank_account_id"])
    now = datetime.utcnow()
    doc.update({"created_at": now, "updated_at": now, "is_deleted": False})
    result = await _col().insert_one(doc)
    doc["_id"] = result.inserted_id
    return _serialize(doc)


@router.put("/{transaction_id}", response_model=OtherTransactionResponse, response_model_exclude_none=True)
async def update_other_transaction(transaction_id: str, data: OtherTransactionUpdate, current_user: dict = Depends(get_current_employee)):
    current = await _get_or_404(transaction_id)
    updates = data.model_dump(exclude_unset=True)
    if "party" in updates and updates["party"]:
        updates["party"] = updates["party"].strip()
    method = updates.get("method", current.get("method"))
    if (method or "").lower() == "cash":
        updates["bank_account_id"] = None
    await _require_bank_account(method, updates.get("bank_account_id", current.get("bank_account_id")))
    updates["updated_at"] = datetime.utcnow()
    await _col().update_one({"_id": ObjectId(transaction_id)}, {"$set": updates})
    return _serialize(await _get_or_404(transaction_id))


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_other_transaction(transaction_id: str, current_user: dict = Depends(get_current_employee)):
    await _get_or_404(transaction_id)
    await _col().update_one(
        {"_id": ObjectId(transaction_id)},
        {"$set": {"is_deleted": True, "updated_at": datetime.utcnow()}},
    )
