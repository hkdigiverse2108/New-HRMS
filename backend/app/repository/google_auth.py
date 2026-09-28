from app.database.db import get_database
from app.config import settings
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
import httpx

class GoogleAuthRepository:
    collection_name = "user_google_auth"

    @classmethod
    async def get_db(cls):
        return get_database()

    @classmethod
    async def save_tokens(cls, employee_id: str, tokens: Dict[str, Any], google_email: str) -> Dict[str, Any]:
        db = await cls.get_db()
        now = datetime.utcnow()
        
        expires_in = tokens.get("expires_in", 3600)
        expires_at = now + timedelta(seconds=expires_in - 60)

        update_data = {
            "employee_id": employee_id,
            "google_email": google_email,
            "access_token": tokens.get("access_token"),
            "token_type": tokens.get("token_type", "Bearer"),
            "scope": tokens.get("scope", ""),
            "expires_at": expires_at,
            "updated_at": now
        }

        # Google only returns refresh_token on initial consent. Preserve existing refresh_token if not returned.
        if tokens.get("refresh_token"):
            update_data["refresh_token"] = tokens.get("refresh_token")

        result = await db[cls.collection_name].find_one_and_update(
            {"employee_id": employee_id},
            {
                "$set": update_data,
                "$setOnInsert": {"created_at": now}
            },
            upsert=True,
            return_document=True
        )
        return result

    @classmethod
    async def get_auth_by_employee(cls, employee_id: str) -> Optional[Dict[str, Any]]:
        db = await cls.get_db()
        return await db[cls.collection_name].find_one({"employee_id": employee_id})

    @classmethod
    async def get_valid_access_token(cls, employee_id: str) -> Optional[str]:
        auth_doc = await cls.get_auth_by_employee(employee_id)
        if not auth_doc:
            return None

        access_token = auth_doc.get("access_token")
        refresh_token = auth_doc.get("refresh_token")
        expires_at = auth_doc.get("expires_at")

        now = datetime.utcnow()
        # If token is valid and not expiring within 2 minutes, return it
        if access_token and expires_at and expires_at > (now + timedelta(minutes=2)):
            return access_token

        # Attempt auto-refresh if refresh_token exists
        if refresh_token and settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET:
            try:
                token_url = "https://oauth2.googleapis.com/token"
                payload = {
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "refresh_token": refresh_token,
                    "grant_type": "refresh_token"
                }
                async with httpx.AsyncClient() as client:
                    resp = await client.post(token_url, data=payload, timeout=10.0)
                    if resp.status_code == 200:
                        new_tokens = resp.json()
                        await cls.save_tokens(
                            employee_id=employee_id,
                            tokens=new_tokens,
                            google_email=auth_doc.get("google_email", "")
                        )
                        return new_tokens.get("access_token")
            except Exception as e:
                print(f"[GOOGLE AUTH REFRESH ERROR] Failed to refresh token for {employee_id}: {e}")

        return access_token if access_token else None

    @classmethod
    async def delete_tokens(cls, employee_id: str) -> bool:
        db = await cls.get_db()
        result = await db[cls.collection_name].delete_one({"employee_id": employee_id})
        return result.deleted_count > 0
