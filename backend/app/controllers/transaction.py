from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from typing import List, Optional
from datetime import datetime
from pathlib import Path
import shutil
import uuid
from bson import ObjectId
from app.config import ROOT_DIR
from app.database.db import get_database
from app.schemas.transaction import (
    TransactionCreate, TransactionUpdate, TransactionResponse, OpeningBalances,
    OptionList, OptionName, BankOpeningBalance,
)
from app.controllers.auth import get_current_employee

router = APIRouter(prefix="/transactions", tags=["Finance Transactions"])

COLLECTION = "finance_transactions"
SETTINGS_COLLECTION = "finance_settings"
OPENING_BALANCES_ID = "opening_balances"
BANK_OPENING_BALANCES_ID = "bank_opening_balances"
# Dropdown option lists (custom + hidden entries) stored in finance_settings
OPTION_LIST_IDS = {
    "credit-category": "credit_categories",
    "debit-category": "debit_categories",
    "brand": "transaction_brands",
}

ATTACHMENTS_DIR = ROOT_DIR / "uploads" / "transactions"
ALLOWED_ATTACHMENT_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".webp", ".doc", ".docx", ".xls", ".xlsx", ".csv"}


def _col():
    return get_database()[COLLECTION]


def _serialize(doc: dict) -> dict:
    doc["_id"] = str(doc["_id"])
    return doc


async def _next_expense_number(entry_date: str) -> tuple[str, int]:
    """Expense numbers are DDMM of the entry date + a running sequence, e.g. 1910001, 2010002.
    With no active debit entries the sequence starts again at 001; otherwise deleted entries keep
    their sequence so a number is never handed out twice."""
    has_active = await _col().find_one({"type": "debit", "is_deleted": {"$ne": True}}, {"_id": 1})
    last = await _col().find_one({"type": "debit", "expense_seq": {"$exists": True}}, sort=[("expense_seq", -1)]) if has_active else None
    seq = (last["expense_seq"] if last else 0) + 1
    try:
        prefix = datetime.strptime(entry_date[:10], "%Y-%m-%d").strftime("%d%m")
    except ValueError:
        prefix = datetime.now().strftime("%d%m")
    return f"{prefix}{seq:03d}", seq


async def _default_bank_account_id() -> Optional[str]:
    """Default bank account, else the oldest one; used when an invoice has no bank account."""
    accounts = get_database()["bank_accounts"]
    doc = await accounts.find_one({"is_deleted": False, "is_default": True}) or await accounts.find_one(
        {"is_deleted": False}, sort=[("created_at", 1)]
    )
    return str(doc["_id"]) if doc else None


def _require_bank_account(account: Optional[str], bank_account_id: Optional[str]) -> None:
    if account == "bank" and not bank_account_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please select a bank account for bank entries")


async def _get_or_404(transaction_id: str) -> dict:
    if not ObjectId.is_valid(transaction_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
    doc = await _col().find_one({"_id": ObjectId(transaction_id), "is_deleted": False})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
    return doc


@router.get("/opening-balances", response_model=OpeningBalances)
async def get_opening_balances(current_user: dict = Depends(get_current_employee)):
    doc = await get_database()[SETTINGS_COLLECTION].find_one({"_id": OPENING_BALANCES_ID}) or {}
    return OpeningBalances(bank=doc.get("bank", 0.0), cash=doc.get("cash", 0.0))


@router.put("/opening-balances", response_model=OpeningBalances)
async def update_opening_balances(data: OpeningBalances, current_user: dict = Depends(get_current_employee)):
    current = await get_database()[SETTINGS_COLLECTION].find_one({"_id": OPENING_BALANCES_ID}) or {}
    # "bank" here is the legacy balance for bank entries not linked to a bank account
    lock_queries = {
        "cash": {"account": "cash"},
        "bank": {"account": "bank", "bank_account_id": {"$in": [None, ""]}},
    }
    for field, query in lock_queries.items():
        if getattr(data, field) != current.get(field, 0.0) and await _col().count_documents({**query, "is_deleted": False}, limit=1):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"The {field} opening balance cannot be changed after an entry has been added",
            )
    await get_database()[SETTINGS_COLLECTION].update_one(
        {"_id": OPENING_BALANCES_ID},
        {"$set": {**data.model_dump(), "updated_at": datetime.utcnow()}},
        upsert=True,
    )
    return data


@router.get("/opening-balances/bank-accounts")
async def get_bank_opening_balances(current_user: dict = Depends(get_current_employee)):
    doc = await get_database()[SETTINGS_COLLECTION].find_one({"_id": BANK_OPENING_BALANCES_ID}) or {}
    return doc.get("balances", {})


@router.put("/opening-balances/bank-accounts/{account_id}")
async def update_bank_opening_balance(account_id: str, data: BankOpeningBalance, current_user: dict = Depends(get_current_employee)):
    settings = get_database()[SETTINGS_COLLECTION]
    balances = (await settings.find_one({"_id": BANK_OPENING_BALANCES_ID}) or {}).get("balances", {})
    if data.amount != balances.get(account_id, 0.0) and await _col().count_documents(
        {"bank_account_id": account_id, "is_deleted": False}, limit=1
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Opening balance cannot be changed after an entry has been added to this account",
        )
    await settings.update_one(
        {"_id": BANK_OPENING_BALANCES_ID},
        {"$set": {f"balances.{account_id}": data.amount, "updated_at": datetime.utcnow()}},
        upsert=True,
    )
    return {account_id: data.amount}


def _option_list_id(kind: str) -> str:
    if kind not in OPTION_LIST_IDS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown option list")
    return OPTION_LIST_IDS[kind]


async def _get_option_list(kind: str) -> OptionList:
    doc = await get_database()[SETTINGS_COLLECTION].find_one({"_id": _option_list_id(kind)}) or {}
    return OptionList(custom=doc.get("custom", []), hidden=doc.get("hidden", []))


@router.get("/options/{kind}", response_model=OptionList)
async def get_option_list(kind: str, current_user: dict = Depends(get_current_employee)):
    return await _get_option_list(kind)


@router.post("/options/{kind}", response_model=OptionList)
async def add_option(kind: str, data: OptionName, current_user: dict = Depends(get_current_employee)):
    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Name is required")
    await get_database()[SETTINGS_COLLECTION].update_one(
        {"_id": _option_list_id(kind)},
        {"$addToSet": {"custom": name}, "$pull": {"hidden": name}, "$set": {"updated_at": datetime.utcnow()}},
        upsert=True,
    )
    return await _get_option_list(kind)


@router.post("/options/{kind}/remove", response_model=OptionList)
async def remove_option(kind: str, data: OptionName, current_user: dict = Depends(get_current_employee)):
    """Hide an option from the dropdown. Existing transactions keep their value."""
    name = data.name.strip()
    await get_database()[SETTINGS_COLLECTION].update_one(
        {"_id": _option_list_id(kind)},
        {"$addToSet": {"hidden": name}, "$pull": {"custom": name}, "$set": {"updated_at": datetime.utcnow()}},
        upsert=True,
    )
    return await _get_option_list(kind)


@router.post("/upload-attachment")
async def upload_attachment(file: UploadFile = File(...), current_user: dict = Depends(get_current_employee)):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_ATTACHMENT_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed: {', '.join(sorted(ALLOWED_ATTACHMENT_EXTENSIONS))}",
        )
    ATTACHMENTS_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"trx_{uuid.uuid4().hex[:12]}{ext}"
    try:
        with open(ATTACHMENTS_DIR / filename, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    finally:
        await file.close()
    return {"url": f"/uploads/transactions/{filename}", "filename": file.filename}


@router.post("/sync-invoices")
async def sync_invoices(current_user: dict = Depends(get_current_employee)):
    """Create bank credit entries for invoices that are not yet in the ledger."""
    db = get_database()
    synced_ids = set(await _col().distinct("invoice_id", {"source": "invoice", "is_deleted": False}))
    cursor = db["invoices"].find({
        "is_deleted": {"$ne": True},
        "status": {"$nin": ["draft", "cancelled", "canceled", "rejected"]},
        "approval_status": {"$nin": ["pending", "rejected"]},
    })
    now = datetime.utcnow()
    new_docs = []
    default_bank_id = await _default_bank_account_id()
    async for inv in cursor:
        inv_id = str(inv["_id"])
        if inv_id in synced_ids:
            continue
        new_docs.append({
            "type": "credit",
            "account": "bank",
            "ref_no": inv.get("invoice_number") or inv_id[-6:],
            "date": (inv.get("issue_date") or now.strftime("%Y-%m-%d"))[:10],
            "amount": float(inv.get("total_due") or 0),
            "category": "",
            "brand": None,
            "description": inv.get("client_name") or "",
            "service": ", ".join(li.get("description", "") for li in inv.get("line_items", []) if li.get("description")),
            "remarks": inv.get("notes") or "",
            "source": "invoice",
            "invoice_id": inv_id,
            "bank_account_id": inv.get("bank_account_id") or default_bank_id,
            "created_at": now,
            "updated_at": now,
            "is_deleted": False,
        })
    if new_docs:
        await _col().insert_many(new_docs)
    return {"synced": len(new_docs)}


@router.get("", response_model=List[TransactionResponse], response_model_exclude_none=True)
async def get_transactions(
    account: Optional[str] = Query(None, description="'bank' or 'cash'"),
    type: Optional[str] = Query(None, description="'credit' or 'debit'"),
    bank_account_id: Optional[str] = Query(None, description="Bank account id"),
    current_user: dict = Depends(get_current_employee),
):
    query: dict = {"is_deleted": False}
    if account:
        query["account"] = account
    if type:
        query["type"] = type
    if bank_account_id:
        query["bank_account_id"] = bank_account_id
    items = await _col().find(query).sort([("date", -1), ("created_at", -1)]).to_list(length=5000)
    return [_serialize(i) for i in items]


@router.post("", response_model=TransactionResponse, response_model_exclude_none=True, status_code=status.HTTP_201_CREATED)
async def create_transaction(data: TransactionCreate, current_user: dict = Depends(get_current_employee)):
    doc = data.model_dump()
    _require_bank_account(doc["account"], doc.get("bank_account_id"))
    if not (doc.get("ref_no") or "").strip():
        if doc["type"] == "debit":
            doc["ref_no"], doc["expense_seq"] = await _next_expense_number(doc["date"])
        else:
            doc["ref_no"] = None
    now = datetime.utcnow()
    doc.update({"source": "manual", "created_at": now, "updated_at": now, "is_deleted": False})
    result = await _col().insert_one(doc)
    doc["_id"] = result.inserted_id
    return _serialize(doc)


@router.put("/{transaction_id}", response_model=TransactionResponse, response_model_exclude_none=True)
async def update_transaction(transaction_id: str, data: TransactionUpdate, current_user: dict = Depends(get_current_employee)):
    current = await _get_or_404(transaction_id)
    updates = data.model_dump(exclude_unset=True)
    _require_bank_account(updates.get("account", current.get("account")), updates.get("bank_account_id", current.get("bank_account_id")))
    updates["updated_at"] = datetime.utcnow()
    await _col().update_one({"_id": ObjectId(transaction_id)}, {"$set": updates})
    return _serialize(await _get_or_404(transaction_id))


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(transaction_id: str, current_user: dict = Depends(get_current_employee)):
    await _get_or_404(transaction_id)
    await _col().update_one(
        {"_id": ObjectId(transaction_id)},
        {"$set": {"is_deleted": True, "updated_at": datetime.utcnow()}},
    )
