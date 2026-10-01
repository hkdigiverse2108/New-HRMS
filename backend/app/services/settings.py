from typing import Dict, Any, Optional
from app.repository.settings import SettingsRepository
from app.schemas.settings import SettingsCreateOrUpdate
from app.redis.service import get_cache, set_cache, delete_cache

CACHE_KEY_SETTINGS = "invoice_settings:active"

class SettingsService:

    @staticmethod
    async def get_settings() -> Dict[str, Any]:
        cached = await get_cache(CACHE_KEY_SETTINGS)
        if cached is not None:
            return cached

        settings = await SettingsRepository.get_settings()
        await set_cache(CACHE_KEY_SETTINGS, settings, ttl=3600)
        return settings

    @staticmethod
    async def update_settings(data: SettingsCreateOrUpdate) -> Dict[str, Any]:
        update_dict = data.model_dump(exclude_unset=True)
        updated = await SettingsRepository.save_or_update_settings(update_dict)
        await delete_cache(CACHE_KEY_SETTINGS)
        return updated

InvoiceSettingsService = SettingsService
