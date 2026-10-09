from app.database.db import get_database
from app.config import settings
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional, List
import httpx

class GoogleAuthRepository:
    collection_name = "user_google_auth"

    @classmethod
    async def get_db(cls):
        return get_database()

    @classmethod
    async def _get_all_possible_employee_ids(cls, db, employee_id: str) -> List[str]:
        if not employee_id:
            return []
        possible_ids = [str(employee_id)]
        try:
            from bson import ObjectId
            emp = None
            if ObjectId.is_valid(employee_id):
                emp = await db["employees"].find_one({"_id": ObjectId(employee_id)})
            if not emp:
                emp = await db["employees"].find_one({
                    "$or": [
                        {"work_details.employee_id": employee_id},
                        {"employee_id": employee_id}
                    ]
                })
            if emp:
                for candidate in [
                    str(emp.get("_id")),
                    emp.get("work_details", {}).get("employee_id"),
                    emp.get("employee_id")
                ]:
                    if candidate and str(candidate) not in possible_ids:
                        possible_ids.append(str(candidate))
        except Exception:
            pass
        return possible_ids

    @classmethod
    async def save_tokens(cls, employee_id: str, tokens: Dict[str, Any], google_email: str) -> Dict[str, Any]:
        db = await cls.get_db()
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        
        expires_in = tokens.get("expires_in", 3600)
        expires_at = now + timedelta(seconds=expires_in - 60)

        possible_ids = await cls._get_all_possible_employee_ids(db, employee_id)

        update_data = {
            "google_email": google_email,
            "access_token": tokens.get("access_token"),
            "token_type": tokens.get("token_type", "Bearer"),
            "scope": tokens.get("scope", ""),
            "expires_at": expires_at,
            "updated_at": now
        }

        # Preserve existing refresh token if not returned by Google
        rt = tokens.get("refresh_token")
        if not rt:
            # 1. Search existing document across any possible employee IDs
            existing = await db[cls.collection_name].find_one({
                "employee_id": {"$in": possible_ids},
                "refresh_token": {"$exists": True, "$ne": None}
            })
            if existing and existing.get("refresh_token"):
                rt = existing["refresh_token"]
            elif google_email:
                # 2. Search by matching google_email
                by_email = await db[cls.collection_name].find_one({
                    "google_email": google_email,
                    "refresh_token": {"$exists": True, "$ne": None}
                })
                if by_email and by_email.get("refresh_token"):
                    rt = by_email["refresh_token"]

        if rt:
            update_data["refresh_token"] = rt

        # Save/upsert across all possible IDs so both ObjectId and employee code stay synchronized
        for pid in possible_ids:
            doc_data = dict(update_data)
            doc_data["employee_id"] = pid
            await db[cls.collection_name].find_one_and_update(
                {"employee_id": pid},
                {
                    "$set": doc_data,
                    "$setOnInsert": {"created_at": now}
                },
                upsert=True
            )

        return update_data

    @classmethod
    async def get_auth_by_employee(cls, employee_id: str) -> Optional[Dict[str, Any]]:
        db = await cls.get_db()
        if not employee_id:
            return None

        possible_ids = await cls._get_all_possible_employee_ids(db, employee_id)
        docs = await db[cls.collection_name].find({"employee_id": {"$in": possible_ids}}).to_list(10)
        if not docs:
            return None

        # Prefer the document that contains a valid refresh_token, or newest updated_at
        best_doc = None
        for d in docs:
            if d.get("refresh_token"):
                best_doc = d
                break
        if not best_doc:
            best_doc = docs[0]

        # If refresh_token is missing, check by google_email across collection
        if not best_doc.get("refresh_token") and best_doc.get("google_email"):
            email_doc = await db[cls.collection_name].find_one({
                "google_email": best_doc["google_email"],
                "refresh_token": {"$exists": True, "$ne": None}
            })
            if email_doc and email_doc.get("refresh_token"):
                best_doc["refresh_token"] = email_doc["refresh_token"]
                # Backfill to all possible IDs
                await db[cls.collection_name].update_many(
                    {"employee_id": {"$in": possible_ids}},
                    {"$set": {"refresh_token": email_doc["refresh_token"]}}
                )

        return best_doc

    @classmethod
    async def get_valid_access_token(cls, employee_id: str) -> Optional[str]:
        auth_doc = await cls.get_auth_by_employee(employee_id)
        if not auth_doc:
            return None

        access_token = auth_doc.get("access_token")
        refresh_token = auth_doc.get("refresh_token")
        expires_at = auth_doc.get("expires_at")

        now = datetime.now(timezone.utc).replace(tzinfo=None)
        # If token is valid and not expiring within 5 minutes, return it
        if access_token and expires_at and expires_at > (now + timedelta(minutes=5)):
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
                    resp = await client.post(token_url, data=payload, timeout=12.0)
                    if resp.status_code == 200:
                        new_tokens = resp.json()
                        await cls.save_tokens(
                            employee_id=employee_id,
                            tokens=new_tokens,
                            google_email=auth_doc.get("google_email", "")
                        )
                        return new_tokens.get("access_token")
                    else:
                        print(f"[GOOGLE AUTH REFRESH FAILED: {resp.status_code}] {resp.text}")
            except Exception as e:
                print(f"[GOOGLE AUTH REFRESH ERROR] Failed to refresh token for {employee_id}: {e}")

        # Fallback to existing access_token if still strictly in the future
        if access_token and expires_at and expires_at > now:
            return access_token

        return None

    @classmethod
    async def delete_tokens(cls, employee_id: str) -> bool:
        db = await cls.get_db()
        if not employee_id:
            return True
        possible_ids = await cls._get_all_possible_employee_ids(db, employee_id)
        await db[cls.collection_name].delete_many({"employee_id": {"$in": possible_ids}})
        return True
