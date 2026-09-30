from typing import Optional, List, Dict, Any
from app.repository.bank_account import BankAccountRepository
from app.schemas.bank_account import BankAccountCreate, BankAccountUpdate
from app.redis.service import get_cache, set_cache, delete_cache, clear_pattern

class BankAccountService:

    @staticmethod
    async def create_bank_account(data: BankAccountCreate) -> Dict[str, Any]:
        data_dict = data.model_dump(exclude_unset=True)
        created = await BankAccountRepository.create(data_dict)
        await clear_pattern("bank_accounts:*")
        return created

    @staticmethod
    async def get_all_bank_accounts(page: Optional[int] = None, limit: Optional[int] = None) -> Any:
        cache_key = f"bank_accounts:list:page={page}:limit={limit}"
        cached = await get_cache(cache_key)
        if cached is not None:
            return cached

        items = await BankAccountRepository.get_all(is_deleted=False, page=page, limit=limit)
        await set_cache(cache_key, items, ttl=3600)
        return items

    @staticmethod
    async def get_bank_account_by_id(account_id: str) -> Optional[Dict[str, Any]]:
        cache_key = f"bank_account:{account_id}"
        cached = await get_cache(cache_key)
        if cached is not None:
            return cached

        item = await BankAccountRepository.get_by_id(account_id)
        if item:
            await set_cache(cache_key, item, ttl=3600)
        return item

    @staticmethod
    async def get_bank_account_by_nickname(nickname: str) -> Optional[Dict[str, Any]]:
        return await BankAccountRepository.get_by_nickname(nickname)

    @staticmethod
    async def update_bank_account(account_id: str, data: BankAccountUpdate) -> bool:
        update_dict = data.model_dump(exclude_unset=True)
        if not update_dict:
            return True

        success = await BankAccountRepository.update(account_id, update_dict)
        if success:
            await clear_pattern("bank_accounts:*")
            await delete_cache(f"bank_account:{account_id}")
        return success

    @staticmethod
    async def delete_bank_account(account_id: str) -> bool:
        success = await BankAccountRepository.delete(account_id)
        if success:
            await clear_pattern("bank_accounts:*")
            await delete_cache(f"bank_account:{account_id}")
        return success
