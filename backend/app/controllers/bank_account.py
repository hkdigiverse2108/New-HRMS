from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional, Union
from app.schemas.bank_account import BankAccountCreate, BankAccountUpdate, BankAccountResponse
from app.schemas.pagination import PaginatedResponse
from app.services.bank_account import BankAccountService
from app.controllers.auth import get_current_employee
from app.redis.service import get_cache, set_cache, clear_pattern, make_list_key

router = APIRouter(prefix="/bank-accounts", tags=["Bank Accounts"])

@router.post("", response_model=BankAccountResponse, response_model_exclude_none=True, status_code=status.HTTP_201_CREATED)
async def create_bank_account(data: BankAccountCreate, current_user: dict = Depends(get_current_employee)):
    created = await BankAccountService.create_bank_account(data)
    await clear_pattern("bank_accounts:*")
    return await BankAccountService.get_bank_account_by_id(created["_id"])

@router.get("", response_model=Union[PaginatedResponse[BankAccountResponse], List[BankAccountResponse]], response_model_exclude_none=True)
async def get_all_bank_accounts(
    page: Optional[int] = Query(None, ge=1, description="Page number"),
    limit: Optional[int] = Query(None, ge=1, description="Items per page"),
    current_user: dict = Depends(get_current_employee)
):
    cache_key = make_list_key("bank_accounts:list", page=page, limit=limit)
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    res = await BankAccountService.get_all_bank_accounts(page=page, limit=limit)
    if res is not None:
        await set_cache(cache_key, res, ttl=120)
    return res

@router.get("/{account_id}", response_model=BankAccountResponse, response_model_exclude_none=True)
async def get_bank_account_by_id(account_id: str, current_user: dict = Depends(get_current_employee)):
    cache_key = f"bank_accounts:item:{account_id}"
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    item = await BankAccountService.get_bank_account_by_id(account_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bank account not found")

    await set_cache(cache_key, item, ttl=300)
    return item

@router.put("/{account_id}", response_model=BankAccountResponse, response_model_exclude_none=True)
async def update_bank_account(
    account_id: str,
    data: BankAccountUpdate,
    current_user: dict = Depends(get_current_employee)
):
    item = await BankAccountService.get_bank_account_by_id(account_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bank account not found")

    updated = await BankAccountService.update_bank_account(account_id, data)
    if not updated:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to update bank account")

    await clear_pattern("bank_accounts:*")
    return await BankAccountService.get_bank_account_by_id(account_id)

@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bank_account(account_id: str, current_user: dict = Depends(get_current_employee)):
    item = await BankAccountService.get_bank_account_by_id(account_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bank account not found")

    success = await BankAccountService.delete_bank_account(account_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to delete bank account")
    await clear_pattern("bank_accounts:*")
