import csv
import io
import json
import time
import logging
from datetime import datetime, timedelta
from typing import Optional, List
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Response
from fastapi.responses import StreamingResponse
from app.config import settings
from app.controllers.social_auth import get_strict_employee, require_social
from app.schemas.social import (
    SocialAccountCreate,
    SocialAccountUpdate,
    SocialAccountResponse,
    SocialKeywordCreate,
    SocialKeywordUpdate,
    SocialKeywordResponse,
    KeywordTestMatchRequest,
    KeywordTestMatchResponse,
    SocialPendingDmResponse,
    SocialEventLogResponse,
    SocialSettingsUpdate,
    SocialSettingsResponse,
    ProviderTestResponse,
    SocialOverviewResponse,
    SocialBrandCreate,
    SocialBrandUpdate,
    SocialBrandResponse,
)
from app.repository.social import (
    SocialAccountRepository,
    SocialKeywordRepository,
    SocialPendingDmRepository,
    SocialEventLogRepository,
    SocialSettingsRepository,
    SocialBrandRepository,
    SocialScriptRepository,
    SocialMediaRepository,
)
from app.utils.social_crypto import encrypt_social_token, decrypt_social_token
from app.services.social.instagram_client import InstagramClient
from app.services.social.keyword_matcher import match_keyword_rules, test_match_rules
from app.services.social.scheduler import SocialScheduler
from app.services.social.utils import norm, clean_id, to_bool
from app.redis.service import get_cache, set_cache, delete_cache, clear_pattern

from app.services.social.reel_script import ReelScriptEngine
from app.services.social.caption_engine import CaptionEngine

router = APIRouter(prefix="/social", tags=["Social Automation"])
logger = logging.getLogger(__name__)

# =========================================================================
# 1. OVERVIEW & KPI CARDS
# =========================================================================
@router.get("/overview", response_model=SocialOverviewResponse)
async def get_social_overview(emp: dict = Depends(require_social("/social", "read"))):
    """Returns aggregated KPI counts, webhook health status, and recent activity events."""
    accounts = await SocialAccountRepository.get_all()
    active_accts = sum(1 for a in accounts if a.get("is_active", True))
    
    # Tokens needing attention: last refresh failed or age >= 50 days
    now = datetime.utcnow()
    tokens_needing_attention = 0
    webhook_health = []
    for a in accounts:
        up_at = a.get("token_updated_at")
        days = (now - up_at).days if up_at else 999
        status = a.get("last_refresh_status", "ok")
        if status != "ok" or days >= 50:
            tokens_needing_attention += 1
        
        webhook_health.append({
            "account_id": a["id"],
            "username": a.get("username"),
            "is_active": a.get("is_active", True),
            "last_webhook_at": a.get("last_webhook_at"),
            "days_since_refresh": days if up_at else None,
            "status": status,
        })

    _, total_keywords = await SocialKeywordRepository.get_all(is_active=True)
    pending_count = await SocialPendingDmRepository.count()

    summary_24h = await SocialEventLogRepository.get_summary_24h()
    dms_sent_24h = summary_24h.get("dm_sent", 0) + summary_24h.get("pending_sent", 0)
    dms_failed_24h = summary_24h.get("dm_failed", 0) + summary_24h.get("gate_failed", 0)

    # 7-day DM count
    cutoff_7d = now - timedelta(days=7)
    events_7d, _ = await SocialEventLogRepository.get_events(
        type_="dm_sent",
        start_date=cutoff_7d,
        limit=5000
    )
    dms_sent_7d = len(events_7d)

    recent_events_raw, _ = await SocialEventLogRepository.get_events(limit=10)
    recent_events = [SocialEventLogResponse(**e) for e in recent_events_raw]

    return SocialOverviewResponse(
        active_accounts=active_accts,
        active_keywords=total_keywords,
        pending_dms=pending_count,
        dms_sent_24h=dms_sent_24h,
        dms_sent_7d=dms_sent_7d,
        dms_failed_24h=dms_failed_24h,
        tokens_needing_attention=tokens_needing_attention,
        recent_events=recent_events,
        webhook_health=webhook_health,
    )


# =========================================================================
# 2. ACCOUNTS MANAGEMENT
# =========================================================================
@router.get("/accounts", response_model=List[SocialAccountResponse])
async def list_accounts(emp: dict = Depends(require_social("/social/accounts", "read"))):
    """List connected Instagram accounts. Never returns raw access tokens."""
    accounts = await SocialAccountRepository.get_all()
    now = datetime.utcnow()
    res = []
    for a in accounts:
        up_at = a.get("token_updated_at")
        days = (now - up_at).days if up_at else None
        res.append(SocialAccountResponse(
            id=a["id"],
            ig_account_id=a["ig_account_id"],
            username=a["username"],
            brand_id=a.get("brand_id"),
            is_active=a.get("is_active", True),
            has_token=bool(a.get("access_token_enc")),
            token_last4=a.get("token_last4", "****"),
            token_updated_at=up_at,
            days_since_refresh=days,
            last_refresh_status=a.get("last_refresh_status"),
            last_webhook_at=a.get("last_webhook_at"),
            created_at=a.get("created_at"),
            updated_at=a.get("updated_at"),
        ))
    return res


@router.post("/accounts", response_model=SocialAccountResponse)
async def create_account(
    payload: SocialAccountCreate,
    emp: dict = Depends(require_social("/social/accounts", "create", require_admin_for_write=True))
):
    """Add a new Instagram account. Validates token with Graph API before persisting."""
    clean_user = payload.username.lstrip("@").strip()
    clean_ig_id = str(payload.ig_account_id).strip()

    # Check for existing
    existing = await SocialAccountRepository.get_by_ig_id(clean_ig_id)
    if existing:
        raise HTTPException(409, f"Account with ID {clean_ig_id} already exists (username: @{existing.get('username')})")

    # Validate token live against Graph API
    valid, user_data, hint = await InstagramClient.get_account_identity(payload.access_token)
    if not valid and not payload.force:
        raise HTTPException(400, f"Token validation failed with Graph API: {hint}")

    enc = encrypt_social_token(payload.access_token)
    doc = await SocialAccountRepository.create({
        "ig_account_id": clean_ig_id,
        "username": clean_user,
        "brand_id": payload.brand_id,
        "access_token_enc": enc,
        "token_last4": payload.access_token[-4:] if len(payload.access_token) >= 4 else "****",
        "is_active": payload.is_active,
        "created_by": emp.get("email") or str(emp.get("_id", "admin")),
    })

    await SocialEventLogRepository.log_event(
        type_="account_added",
        status_="ok",
        message=f"Added Instagram account @{clean_user} (ID: {clean_ig_id})",
        ig_account_id=clean_ig_id,
        username=clean_user,
        actor=emp.get("personal_info", {}).get("first_name", "Admin")
    )

    return SocialAccountResponse(
        id=doc["id"],
        ig_account_id=doc["ig_account_id"],
        username=doc["username"],
        brand_id=doc.get("brand_id"),
        is_active=doc["is_active"],
        has_token=True,
        token_last4=doc["token_last4"],
        token_updated_at=doc["token_updated_at"],
        days_since_refresh=0,
        last_refresh_status="ok",
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    )


@router.put("/accounts/{account_id}", response_model=SocialAccountResponse)
async def update_account(
    account_id: str,
    payload: SocialAccountUpdate,
    emp: dict = Depends(require_social("/social/accounts", "update", require_admin_for_write=True))
):
    """Update Instagram account metadata and optionally replace its access token."""
    account = await SocialAccountRepository.get_by_id(account_id)
    if not account:
        raise HTTPException(404, "Account not found")

    updates = {}
    if payload.username:
        updates["username"] = payload.username.lstrip("@").strip()
    if payload.brand_id is not None:
        updates["brand_id"] = payload.brand_id
    if payload.is_active is not None:
        updates["is_active"] = payload.is_active

    if payload.access_token and payload.access_token.strip():
        new_token = payload.access_token.strip()
        valid, _, hint = await InstagramClient.get_account_identity(new_token)
        if not valid:
            raise HTTPException(400, f"Token validation failed with Graph API: {hint}")
        updates["access_token_enc"] = encrypt_social_token(new_token)
        updates["token_last4"] = new_token[-4:]
        updates["token_updated_at"] = datetime.utcnow()
        updates["last_refresh_status"] = "ok"

    updated = await SocialAccountRepository.update(account_id, updates)
    now = datetime.utcnow()
    up_at = updated.get("token_updated_at")
    days = (now - up_at).days if up_at else None

    return SocialAccountResponse(
        id=updated["id"],
        ig_account_id=updated["ig_account_id"],
        username=updated["username"],
        brand_id=updated.get("brand_id"),
        is_active=updated.get("is_active", True),
        has_token=bool(updated.get("access_token_enc")),
        token_last4=updated.get("token_last4", "****"),
        token_updated_at=up_at,
        days_since_refresh=days,
        last_refresh_status=updated.get("last_refresh_status"),
        last_webhook_at=updated.get("last_webhook_at"),
        created_at=updated.get("created_at"),
        updated_at=updated.get("updated_at"),
    )


@router.patch("/accounts/{account_id}/toggle")
async def toggle_account(
    account_id: str,
    emp: dict = Depends(require_social("/social/accounts", "update"))
):
    """Toggles account active state."""
    account = await SocialAccountRepository.get_by_id(account_id)
    if not account:
        raise HTTPException(404, "Account not found")

    new_state = not account.get("is_active", True)
    await SocialAccountRepository.update(account_id, {"is_active": new_state})
    return {"id": account_id, "is_active": new_state}


@router.post("/accounts/{account_id}/refresh")
async def manual_refresh_account_token(
    account_id: str,
    emp: dict = Depends(require_social("/social/accounts", "update"))
):
    """Manual trigger to refresh an Instagram account's access token immediately."""
    account = await SocialAccountRepository.get_by_id(account_id)
    if not account:
        raise HTTPException(404, "Account not found")

    raw_token = decrypt_social_token(account.get("access_token_enc", ""))
    if not raw_token:
        raise HTTPException(400, "Account has no token stored")

    ok, new_token, hint = await InstagramClient.refresh_access_token(raw_token)
    now = datetime.utcnow()
    if ok and new_token:
        enc = encrypt_social_token(new_token)
        await SocialAccountRepository.update(account_id, {
            "access_token_enc": enc,
            "token_last4": new_token[-4:],
            "token_updated_at": now,
            "last_refresh_status": "ok",
        })
        await SocialEventLogRepository.log_event(
            type_="token_refreshed",
            status_="ok",
            message=f"Manually refreshed token for @{account.get('username')}",
            ig_account_id=account.get("ig_account_id"),
            username=account.get("username"),
            actor=emp.get("personal_info", {}).get("first_name", "Admin")
        )
        return {"ok": True, "token_updated_at": now, "message": "Token refreshed successfully"}
    else:
        await SocialAccountRepository.update(account_id, {"last_refresh_status": hint})
        await SocialEventLogRepository.log_event(
            type_="token_refresh_failed",
            status_="error",
            message=f"Manual refresh failed for @{account.get('username')}: {hint}",
            ig_account_id=account.get("ig_account_id"),
            username=account.get("username"),
            hint=hint,
            level="warn",
            actor=emp.get("personal_info", {}).get("first_name", "Admin")
        )
        raise HTTPException(400, f"Refresh failed: {hint}")


@router.post("/accounts/refresh-due")
async def refresh_all_due_tokens(
    emp: dict = Depends(require_social("/social/accounts", "update"))
):
    """Triggers refresh for all accounts whose tokens are due (>= 50 days old)."""
    results = await SocialScheduler.refresh_due_accounts()
    return {"results": results}


@router.get("/accounts/{account_id}/media")
async def get_account_media(
    account_id: str,
    limit: int = Query(150, ge=1, le=500),
    sync: bool = Query(False, description="Force re-sync latest media from Instagram Graph API"),
    emp: dict = Depends(require_social("/social/accounts", "read"))
):
    """
    Fetch all reels and posts for the given Instagram account dynamically with Redis caching.
    - If valid live Meta Graph API token exists: fetches live posts/reels from Meta Graph API
      and automatically upserts new items into MongoDB, ensuring future posts are always retained.
    - Dynamically queries MongoDB `social_account_media` collection for the account.
    - Auto-seeds realistic items if account has 0 items so it is never empty.
    - L1/L2 Redis caching for instant retrieval.
    """
    account = await SocialAccountRepository.get_by_id(account_id)
    if not account:
        account = await SocialAccountRepository.get_by_ig_id(account_id)
    if not account:
        raise HTTPException(404, "Account not found")

    token = decrypt_social_token(account.get("access_token_enc", "")) if account.get("access_token_enc") else ""
    ig_id = str(account.get("ig_account_id", "")).strip()
    username = account.get("username", "account").lstrip("@").strip()

    cache_key = f"social:media:{ig_id or username}:{limit}"
    if not sync:
        cached = await get_cache(cache_key)
        if cached and isinstance(cached, dict) and cached.get("items"):
            return cached

    # 1. Live Instagram Graph API fetch & sync (if token present and not mock)
    if token and not token.startswith("EAAG_MOCK") and (sync or not (await SocialMediaRepository.get_by_account(ig_id or username, limit=1))):
        try:
            base_url = (getattr(settings, "IG_GRAPH_BASE_URL", "") or getattr(settings, "IG_GRAPH_BASE", "https://graph.instagram.com")).rstrip("/")
            ver = getattr(settings, "IG_GRAPH_VERSION", "v21.0").lstrip("/")
            fields = "id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp,shortcode"
            
            headers = {"Authorization": f"Bearer {token}"}
            async with httpx.AsyncClient(timeout=25.0) as client:
                all_data_items = []
                next_url = f"{base_url}/{ver}/me/media?fields={fields}&limit={min(limit, 100)}"
                
                while next_url and len(all_data_items) < limit:
                    res = await client.get(next_url, headers=headers)
                    if res.status_code != 200:
                        # Fallback to /{ig_id}/media if /me/media failed
                        if not all_data_items and ig_id:
                            alt_url = f"{base_url}/{ver}/{ig_id}/media?fields={fields}&limit={min(limit, 100)}"
                            alt_res = await client.get(alt_url, headers=headers)
                            if alt_res.status_code == 200:
                                d = alt_res.json()
                                all_data_items.extend(d.get("data", []))
                                next_url = d.get("paging", {}).get("next")
                                continue
                        break
                    d = res.json()
                    page_items = d.get("data", [])
                    all_data_items.extend(page_items)
                    next_url = d.get("paging", {}).get("next")

                if all_data_items:
                    live_items = []
                    for m in all_data_items:
                        permalink = m.get("permalink") or ""
                        product_type = (m.get("media_product_type") or "").upper()
                        raw_media_type = (m.get("media_type") or "").upper()
                        is_reel = (
                            product_type == "REELS"
                            or "/reel/" in permalink
                            or (raw_media_type == "VIDEO" and product_type != "FEED")
                        )
                        shortcode = m.get("shortcode") or str(m.get("id"))[-8:]
                        thumb = m.get("thumbnail_url") or m.get("media_url") or ""
                        live_items.append({
                            "id": str(m.get("id")),
                            "media_id": str(m.get("id")),
                            "type": "REEL" if is_reel else "POST",
                            "media_type": raw_media_type,
                            "caption": m.get("caption") or "(No caption)",
                            "permalink": permalink or f"https://www.instagram.com/{'reel' if is_reel else 'p'}/{shortcode}/",
                            "timestamp": m.get("timestamp") or datetime.utcnow().isoformat(),
                            "thumbnail_url": thumb,
                            "media_url": m.get("media_url") or "",
                            "shortcode": shortcode,
                            "username": username.lower(),
                        })

                    # Upsert newly fetched live items to MongoDB so all future posts are saved permanently
                    await SocialMediaRepository.bulk_upsert(ig_id, live_items, username=username)
        except Exception as e:
            logger.warning(f"Live Instagram Graph API media fetch failed for @{username}: {e}")

    # 2. Dynamically fetch stored media items from MongoDB collection
    items = await SocialMediaRepository.get_by_account(ig_id or username, limit=limit)
    if not items and username:
        items = await SocialMediaRepository.get_by_username(username, limit=limit)

    for it in (items or []):
        sc = it.get("shortcode")
        if not sc and it.get("permalink"):
            parts = [p for p in str(it["permalink"]).split("/") if p]
            if parts:
                sc = parts[-1]
                it["shortcode"] = sc
        if sc:
            it["proxy_url"] = f"/social/media/proxy?shortcode={sc}"
        elif it.get("thumbnail_url") or it.get("media_url"):
            import urllib.parse
            raw_u = it.get("thumbnail_url") or it.get("media_url")
            it["proxy_url"] = f"/social/media/proxy?url={urllib.parse.quote(str(raw_u))}"

    result = {"items": items or [], "total": len(items or [])}
    await set_cache(cache_key, result, ttl=300)
    return result


@router.get("/media/proxy")
async def proxy_media_thumbnail(
    url: Optional[str] = Query(None),
    shortcode: Optional[str] = Query(None),
):
    """
    Proxies and streams Instagram media thumbnails to prevent broken images caused by expired Meta CDN URLs or CORS.
    Priority:
    1. If shortcode is provided: fetches fresh thumbnail from https://www.instagram.com/p/{shortcode}/media/?size=m
    2. If url is provided: fetches from URL. If 403 (expired signature), falls back to shortcode.
    """
    candidates = []
    if shortcode:
        clean_sc = str(shortcode).strip()
        candidates.append(f"https://www.instagram.com/p/{clean_sc}/media/?size=m")
    if url:
        candidates.append(str(url).strip())

    if not candidates:
        raise HTTPException(400, "Either url or shortcode query parameter is required")

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    }

    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
        for target in candidates:
            try:
                res = await client.get(target, headers=headers)
                if res.status_code == 200 and len(res.content) > 500:
                    content_type = res.headers.get("content-type") or "image/jpeg"
                    return Response(
                        content=res.content,
                        media_type=content_type,
                        headers={
                            "Cache-Control": "public, max-age=86400",
                            "Access-Control-Allow-Origin": "*",
                        }
                    )
            except Exception as e:
                logger.debug(f"Media proxy failed for {target}: {e}")
                continue

    raise HTTPException(404, "Thumbnail image could not be retrieved")


@router.post("/accounts/{account_id}/sync-media")
async def sync_account_media(
    account_id: str,
    limit: int = Query(200, ge=1, le=500),
    emp: dict = Depends(require_social("/social/accounts", "write"))
):
    """
    Manually trigger dynamic sync of recent posts and reels from Instagram Graph API into database.
    Ensures newly published posts on Instagram are pulled and persisted in MongoDB, and Redis cache is cleared.
    """
    account = await SocialAccountRepository.get_by_id(account_id)
    if not account:
        account = await SocialAccountRepository.get_by_ig_id(account_id)
    if not account:
        raise HTTPException(404, "Account not found")

    token = decrypt_social_token(account.get("access_token_enc", "")) if account.get("access_token_enc") else ""
    ig_id = str(account.get("ig_account_id", "")).strip()
    username = account.get("username", "account").lstrip("@").strip()

    synced_count = 0
    if token and not token.startswith("EAAG_MOCK"):
        try:
            base_url = (getattr(settings, "IG_GRAPH_BASE_URL", "") or getattr(settings, "IG_GRAPH_BASE", "https://graph.instagram.com")).rstrip("/")
            ver = getattr(settings, "IG_GRAPH_VERSION", "v21.0").lstrip("/")
            fields = "id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp,shortcode"
            
            headers = {"Authorization": f"Bearer {token}"}
            async with httpx.AsyncClient(timeout=30.0) as client:
                all_data_items = []
                next_url = f"{base_url}/{ver}/me/media?fields={fields}&limit={min(limit, 100)}"
                while next_url and len(all_data_items) < limit:
                    res = await client.get(next_url, headers=headers)
                    if res.status_code != 200:
                        if not all_data_items and ig_id:
                            alt_url = f"{base_url}/{ver}/{ig_id}/media?fields={fields}&limit={min(limit, 100)}"
                            alt_res = await client.get(alt_url, headers=headers)
                            if alt_res.status_code == 200:
                                d = alt_res.json()
                                all_data_items.extend(d.get("data", []))
                                next_url = d.get("paging", {}).get("next")
                                continue
                        break
                    d = res.json()
                    all_data_items.extend(d.get("data", []))
                    next_url = d.get("paging", {}).get("next")

                if all_data_items:
                    live_items = []
                    for m in all_data_items:
                        permalink = m.get("permalink") or ""
                        product_type = (m.get("media_product_type") or "").upper()
                        raw_media_type = (m.get("media_type") or "").upper()
                        is_reel = (
                            product_type == "REELS"
                            or "/reel/" in permalink
                            or (raw_media_type == "VIDEO" and product_type != "FEED")
                        )
                        shortcode = m.get("shortcode") or str(m.get("id"))[-8:]
                        thumb = m.get("thumbnail_url") or m.get("media_url") or ""
                        live_items.append({
                            "id": str(m.get("id")),
                            "media_id": str(m.get("id")),
                            "type": "REEL" if is_reel else "POST",
                            "media_type": raw_media_type,
                            "caption": m.get("caption") or "(No caption)",
                            "permalink": permalink or f"https://www.instagram.com/{'reel' if is_reel else 'p'}/{shortcode}/",
                            "timestamp": m.get("timestamp") or datetime.utcnow().isoformat(),
                            "thumbnail_url": thumb,
                            "media_url": m.get("media_url") or "",
                            "shortcode": shortcode,
                            "username": username.lower(),
                        })

                    synced_count = await SocialMediaRepository.bulk_upsert(ig_id, live_items, username=username)
        except Exception as e:
            logger.warning(f"Error during manual media sync for @{username}: {e}")
            raise HTTPException(502, f"Failed to sync media from Instagram Graph API: {str(e)}")

    # Invalidate Redis cache on sync
    await clear_pattern(f"social:media:{ig_id}*")
    await clear_pattern(f"social:media:{username}*")

    current_media = await SocialMediaRepository.get_by_account(ig_id or username, limit=limit)
    return {
        "success": True,
        "synced": synced_count,
        "total": len(current_media),
        "items": current_media,
    }


@router.delete("/accounts/{account_id}")
async def delete_account(
    account_id: str,
    cascade: bool = Query(False),
    emp: dict = Depends(require_social("/social/accounts", "delete", require_admin_for_write=True))
):
    """Delete an account. Blocked if active keywords exist unless cascade=true."""
    account = await SocialAccountRepository.get_by_id(account_id)
    if not account:
        raise HTTPException(404, "Account not found")

    ig_id = account["ig_account_id"]
    rules = await SocialKeywordRepository.get_active_rules_for_account(ig_id)
    if rules and not cascade:
        raise HTTPException(409, f"Account has {len(rules)} active keyword rule(s). Use ?cascade=true to delete with keywords.")

    if cascade and rules:
        for r in rules:
            await SocialKeywordRepository.delete(r["id"])

    await SocialAccountRepository.delete(account_id)
    await SocialEventLogRepository.log_event(
        type_="account_deleted",
        status_="ok",
        message=f"Deleted Instagram account @{account.get('username')} (ID: {ig_id})",
        ig_account_id=ig_id,
        username=account.get("username"),
        actor=emp.get("personal_info", {}).get("first_name", "Admin")
    )
    return {"ok": True}


# =========================================================================
# 3. KEYWORDS MANAGEMENT
# =========================================================================

_last_n8n_keywords_sync: float = 0.0

async def sync_keywords_from_n8n_table() -> dict:
    """Bi-directional sync between n8n 'Keywords' Data Table (table_id: 200EsLvhIlNU9amn) and MongoDB."""
    global _last_n8n_keywords_sync
    try:
        n8n_base = (getattr(settings, "N8N_BASE_URL", "") or "").rstrip("/")
        n8n_key = getattr(settings, "N8N_API_KEY", "")
        if not n8n_base or not n8n_key:
            return {"ok": False, "message": "N8N_BASE_URL or N8N_API_KEY is not configured", "inserted": 0, "updated": 0}

        table_id = "200EsLvhIlNU9amn"
        async with httpx.AsyncClient(timeout=15.0) as client:
            headers = {"X-N8N-API-KEY": n8n_key}
            res = await client.get(f"{n8n_base}/api/v1/data-tables/{table_id}/rows", headers=headers)
            if res.status_code != 200:
                logger.warning(f"Failed to fetch n8n Keywords table: {res.status_code} {res.text}")
                return {"ok": False, "message": f"n8n returned status {res.status_code}", "inserted": 0, "updated": 0}

            n8n_rows = res.json().get("data", [])
            inserted = 0
            updated = 0
            n8n_keys = set()

            col = await SocialKeywordRepository.get_collection()

            for row in n8n_rows:
                kw = str(row.get("keyword") or "").strip()
                kw_norm = norm(kw)
                if not kw_norm:
                    continue
                ig_account_id = str(row.get("ig_account_id") or "").strip()
                username = str(row.get("username") or "").strip().lstrip("@")
                media_id = clean_id(row.get("media_id") or "")
                n8n_keys.add((ig_account_id, kw_norm, media_id))

                msg = str(row.get("message") or "")
                r1 = str(row.get("comment_reply1") or "")
                r2 = str(row.get("comment_reply2") or "")
                r3 = str(row.get("comment_reply3") or "")
                desc = str(row.get("desc") or "")
                rf = to_bool(row.get("require_follow", True))
                act = to_bool(row.get("is_active", True))
                scope = "SPECIFIC_POSTS" if media_id else "ALL_POSTS"

                existing = await col.find_one({
                    "ig_account_id": ig_account_id,
                    "keyword_norm": kw_norm,
                    "media_id": media_id
                })

                now = datetime.utcnow()
                if existing:
                    await col.update_one(
                        {"_id": existing["_id"]},
                        {"$set": {
                            "message": msg,
                            "comment_reply1": r1,
                            "comment_reply2": r2,
                            "comment_reply3": r3,
                            "desc": desc or existing.get("desc", ""),
                            "require_follow": rf,
                            "is_active": act,
                            "scope": scope,
                            "username": username or existing.get("username", ""),
                            "updated_at": now
                        }}
                    )
                    updated += 1
                else:
                    doc = {
                        "ig_account_id": ig_account_id,
                        "username": username,
                        "keyword": kw,
                        "keyword_norm": kw_norm,
                        "scope": scope,
                        "message": msg,
                        "post_link": "",
                        "media_url": "",
                        "media_id": media_id,
                        "media_source": "form" if media_id else "none",
                        "comment_reply1": r1,
                        "comment_reply2": r2,
                        "comment_reply3": r3,
                        "require_follow": rf,
                        "desc": desc or f"Automation for {kw}",
                        "is_active": act,
                        "hit_count": 0,
                        "last_hit_at": None,
                        "created_at": now,
                        "updated_at": now,
                        "created_by": "n8n_sync"
                    }
                    await col.insert_one(doc)
                    inserted += 1

            # Push any MongoDB keywords missing in n8n into n8n table
            pushed_to_n8n = 0
            mongo_docs = await col.find({}).to_list(200)
            for m_doc in mongo_docs:
                m_kw = str(m_doc.get("keyword") or "").strip().upper()
                m_kw_norm = norm(m_kw)
                m_ig_id = str(m_doc.get("ig_account_id") or "").strip()
                m_mid = clean_id(m_doc.get("media_id") or "")
                if (m_ig_id, m_kw_norm, m_mid) not in n8n_keys:
                    n8n_row_payload = {
                        "ig_account_id": m_ig_id,
                        "username": str(m_doc.get("username") or ""),
                        "keyword": m_kw,
                        "desc": str(m_doc.get("desc") or f"Automation for {m_kw}"),
                        "message": str(m_doc.get("message") or ""),
                        "comment_reply1": str(m_doc.get("comment_reply1") or ""),
                        "comment_reply2": str(m_doc.get("comment_reply2") or ""),
                        "comment_reply3": str(m_doc.get("comment_reply3") or ""),
                        "media_id": m_mid,
                        "require_follow": "true" if m_doc.get("require_follow", True) else "false",
                        "is_active": "true" if m_doc.get("is_active", True) else "false",
                    }
                    try:
                        p_res = await client.post(
                            f"{n8n_base}/api/v1/data-tables/{table_id}/rows",
                            headers={"X-N8N-API-KEY": n8n_key, "Content-Type": "application/json"},
                            json={"data": [n8n_row_payload]}
                        )
                        if p_res.status_code == 200:
                            pushed_to_n8n += 1
                    except Exception as pe:
                        logger.warning(f"Error pushing mongo keyword {m_kw} to n8n: {pe}")

            _last_n8n_keywords_sync = time.time()
            await clear_pattern("social:keywords:*")
            await clear_pattern("social:overview:*")

            return {
                "ok": True,
                "total_n8n": len(n8n_rows),
                "inserted": inserted,
                "updated": updated,
                "pushed_to_n8n": pushed_to_n8n
            }
    except Exception as e:
        logger.warning(f"Failed to sync keywords from n8n Data Table: {e}")
        return {"ok": False, "message": str(e), "inserted": 0, "updated": 0}


@router.post("/keywords/sync")
async def sync_keywords_endpoint(emp: dict = Depends(require_social("/social/keywords", "read"))):
    """Manually triggers bidirectional sync between n8n Keywords Data Table and HRMS database."""
    res = await sync_keywords_from_n8n_table()
    return res


@router.get("/keywords")
async def list_keywords(
    ig_account_id: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    media_id: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    sync_n8n: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    emp: dict = Depends(require_social("/social/keywords", "read"))
):
    """List keyword rules with optional search, account filtering, and automatic live n8n sync."""
    global _last_n8n_keywords_sync
    # Auto-sync from live n8n if requested or if > 60s has passed
    if sync_n8n is True or (sync_n8n is None and (time.time() - _last_n8n_keywords_sync > 60.0)):
        await sync_keywords_from_n8n_table()

    skip = (page - 1) * limit
    rules, total = await SocialKeywordRepository.get_all(
        ig_account_id=ig_account_id,
        q=q,
        media_id=media_id,
        is_active=is_active,
        skip=skip,
        limit=limit
    )
    items = [SocialKeywordResponse(**r) for r in rules]
    return {"items": items, "total": total, "page": page, "limit": limit}


async def sync_keyword_to_n8n_table(doc: dict):
    """Sync keyword rule directly into n8n 'Keywords' Data Table (table_id: 200EsLvhIlNU9amn)"""
    try:
        n8n_base = (getattr(settings, "N8N_BASE_URL", "") or "").rstrip("/")
        n8n_key = getattr(settings, "N8N_API_KEY", "")
        if not n8n_base or not n8n_key:
            return
        
        table_id = "200EsLvhIlNU9amn"
        row = {
            "ig_account_id": str(doc.get("ig_account_id", "")),
            "username": str(doc.get("username", "")),
            "keyword": str(doc.get("keyword", "")).strip().upper(),
            "desc": str(doc.get("desc") or f"Automation for {doc.get('keyword', '')}"),
            "message": str(doc.get("message", "")),
            "comment_reply1": str(doc.get("comment_reply1", "")),
            "comment_reply2": str(doc.get("comment_reply2", "")),
            "comment_reply3": str(doc.get("comment_reply3", "")),
            "media_id": str(doc.get("media_id", "")),
            "require_follow": "true" if doc.get("require_follow", True) else "false",
            "is_active": "true" if doc.get("is_active", True) else "false",
        }
        async with httpx.AsyncClient(timeout=10.0) as client:
            headers = {"X-N8N-API-KEY": n8n_key, "Content-Type": "application/json"}
            url = f"{n8n_base}/api/v1/data-tables/{table_id}/rows"
            res = await client.post(url, headers=headers, json={"data": [row]})
            logger.info(f"Synced keyword '{row['keyword']}' to n8n Data Table: {res.status_code}")
    except Exception as e:
        logger.warning(f"Failed to sync keyword to n8n Data Table: {e}")


async def delete_keyword_from_n8n_table(ig_account_id: str, keyword: str):
    """Delete keyword rule from n8n 'Keywords' Data Table (table_id: 200EsLvhIlNU9amn)"""
    try:
        n8n_base = (getattr(settings, "N8N_BASE_URL", "") or "").rstrip("/")
        n8n_key = getattr(settings, "N8N_API_KEY", "")
        if not n8n_base or not n8n_key or not keyword:
            return
        
        table_id = "200EsLvhIlNU9amn"
        filters = [
            {"columnName": "keyword", "condition": "eq", "value": str(keyword).strip().upper()}
        ]
        if ig_account_id:
            filters.append({"columnName": "ig_account_id", "condition": "eq", "value": str(ig_account_id)})
            
        filter_payload = {
            "type": "and",
            "filters": filters
        }
        async with httpx.AsyncClient(timeout=10.0) as client:
            headers = {"X-N8N-API-KEY": n8n_key}
            url = f"{n8n_base}/api/v1/data-tables/{table_id}/rows/delete"
            res = await client.delete(url, headers=headers, params={"filter": json.dumps(filter_payload)})
            logger.info(f"Deleted keyword '{keyword}' from n8n Data Table: {res.status_code}")
    except Exception as e:
        logger.warning(f"Failed to delete keyword from n8n Data Table: {e}")


@router.post("/keywords", response_model=SocialKeywordResponse)
async def create_keyword(
    payload: SocialKeywordCreate,
    emp: dict = Depends(require_social("/social/keywords", "create"))
):
    """Create keyword rule matching the n8n form specifications."""
    # 1. Resolve Account by ig_account_id, username, or internal ID
    account = None
    target = (payload.ig_account_id or payload.username or "").strip()
    if target:
        account = await SocialAccountRepository.get_by_ig_id(target)
        if not account:
            account = await SocialAccountRepository.get_by_id(target)
        if not account and payload.username:
            account = await SocialAccountRepository.get_by_username(payload.username)

    if not account or not account.get("is_active", True):
        acc_label = payload.username or payload.ig_account_id or "target"
        raise HTTPException(400, f"Active account for @{acc_label} not found")

    raw_token = decrypt_social_token(account.get("access_token_enc", "")) or account.get("access_token_enc", "")
    if not raw_token:
        raise HTTPException(400, f"Account @{account.get('username')} has no access token")

    clean_kw = payload.keyword.strip()
    norm_kw = norm(clean_kw)
    if not norm_kw:
        raise HTTPException(400, "Keyword cannot be empty")

    if not payload.message.strip():
        raise HTTPException(400, "DM message is required")

    if not payload.comment_reply1.strip():
        raise HTTPException(400, "Public comment reply 1 is required")

    # 2. Determine Media ID priority
    resolved_media_id = ""
    media_source = "none"

    raw_media_id = clean_id(payload.media_id or "")
    if raw_media_id:
        resolved_media_id = raw_media_id
        media_source = "form"
    elif (payload.media_url or payload.post_link) and str(payload.media_url or payload.post_link).strip():
        link_str = str(payload.media_url or payload.post_link).strip()
        m_id, hint = await InstagramClient.resolve_permalink_to_media_id(link_str, raw_token)
        if m_id:
            resolved_media_id = m_id
            media_source = "link"
        else:
            resolved_media_id = ""
            media_source = "link"

    # 3. Duplicate rule check
    is_dup = await SocialKeywordRepository.check_duplicate(
        ig_account_id=account["ig_account_id"],
        keyword_norm=norm_kw,
        media_id=resolved_media_id
    )
    if is_dup:
        scope_text = f"for post {resolved_media_id}" if resolved_media_id else "globally across all posts"
        raise HTTPException(409, f"Keyword '{clean_kw}' already exists {scope_text} on account @{account.get('username')}.")

    final_scope = payload.scope or ("SPECIFIC_POSTS" if resolved_media_id else "ALL_POSTS")
    final_post_link = (payload.media_url or payload.post_link or "").strip()

    rule_doc = {
        "ig_account_id": account["ig_account_id"],
        "username": account["username"],
        "keyword": clean_kw,
        "keyword_norm": norm_kw,
        "scope": final_scope,
        "message": payload.message.strip(),
        "post_link": final_post_link,
        "media_url": final_post_link,
        "media_id": resolved_media_id,
        "media_source": media_source,
        "comment_reply1": payload.comment_reply1.strip(),
        "comment_reply2": (payload.comment_reply2 or "").strip(),
        "comment_reply3": (payload.comment_reply3 or "").strip(),
        "require_follow": payload.require_follow,
        "desc": (payload.desc or f"Automation for {clean_kw}").strip(),
        "created_by": emp.get("email") or str(emp.get("_id", "admin")),
    }

    created = await SocialKeywordRepository.create(rule_doc)

    # Sync to n8n Keywords Data Table
    await sync_keyword_to_n8n_table(created)

    # Invalidate Redis cache
    await clear_pattern("social:keywords:*")
    await clear_pattern("social:overview:*")

    await SocialEventLogRepository.log_event(
        type_="keyword_created",
        status_="ok",
        message=f"Added keyword rule '{clean_kw}' for @{account.get('username')}",
        ig_account_id=account["ig_account_id"],
        username=account["username"],
        actor=emp.get("personal_info", {}).get("first_name", "Staff")
    )

    return SocialKeywordResponse(**created)


@router.put("/keywords/{keyword_id}", response_model=SocialKeywordResponse)
async def update_keyword(
    keyword_id: str,
    payload: SocialKeywordUpdate,
    emp: dict = Depends(require_social("/social/keywords", "update"))
):
    """Update an existing keyword rule."""
    existing = await SocialKeywordRepository.get_by_id(keyword_id)
    if not existing:
        raise HTTPException(404, "Keyword rule not found")

    updates = {}
    if payload.keyword is not None:
        clean_kw = payload.keyword.strip()
        updates["keyword"] = clean_kw
        updates["keyword_norm"] = norm(clean_kw)
    if payload.message is not None:
        updates["message"] = payload.message.strip()
    if payload.post_link is not None:
        updates["post_link"] = payload.post_link.strip()
    if payload.media_id is not None:
        updates["media_id"] = clean_id(payload.media_id)
    if payload.comment_reply1 is not None:
        updates["comment_reply1"] = payload.comment_reply1.strip()
    if payload.comment_reply2 is not None:
        updates["comment_reply2"] = payload.comment_reply2.strip()
    if payload.comment_reply3 is not None:
        updates["comment_reply3"] = payload.comment_reply3.strip()
    if payload.require_follow is not None:
        updates["require_follow"] = payload.require_follow
    if payload.desc is not None:
        updates["desc"] = payload.desc.strip()
    if payload.is_active is not None:
        updates["is_active"] = payload.is_active

    # Duplicate check on edit
    kw_norm = updates.get("keyword_norm", existing.get("keyword_norm"))
    m_id = updates.get("media_id", existing.get("media_id", ""))
    is_dup = await SocialKeywordRepository.check_duplicate(
        ig_account_id=existing["ig_account_id"],
        keyword_norm=kw_norm,
        media_id=m_id,
        exclude_id=keyword_id
    )
    if is_dup:
        raise HTTPException(409, f"Keyword '{updates.get('keyword', existing.get('keyword'))}' already exists for this post.")

    updated = await SocialKeywordRepository.update(keyword_id, updates)
    if "keyword" in updates and updates["keyword"].strip().upper() != existing.get("keyword", "").strip().upper():
        await delete_keyword_from_n8n_table(existing.get("ig_account_id", ""), existing.get("keyword", ""))
    await sync_keyword_to_n8n_table(updated)
    return SocialKeywordResponse(**updated)


@router.patch("/keywords/{keyword_id}/toggle")
async def toggle_keyword(
    keyword_id: str,
    emp: dict = Depends(require_social("/social/keywords", "update"))
):
    """Toggle active state of a keyword rule."""
    existing = await SocialKeywordRepository.get_by_id(keyword_id)
    if not existing:
        raise HTTPException(404, "Keyword rule not found")
    new_state = not existing.get("is_active", True)
    updated = await SocialKeywordRepository.update(keyword_id, {"is_active": new_state})

    if not new_state:
        # If disabled, remove from n8n active matching table
        await delete_keyword_from_n8n_table(existing.get("ig_account_id", ""), existing.get("keyword", ""))
    else:
        # If re-enabled, sync back to n8n active matching table
        await sync_keyword_to_n8n_table(updated)

    await clear_pattern("social:keywords:*")
    await clear_pattern("social:overview:*")
    return {"id": keyword_id, "is_active": new_state}


@router.delete("/keywords/{keyword_id}")
async def delete_keyword(
    keyword_id: str,
    emp: dict = Depends(require_social("/social/keywords", "delete"))
):
    """Delete keyword rule."""
    existing = await SocialKeywordRepository.get_by_id(keyword_id)
    if not existing:
        raise HTTPException(404, "Keyword rule not found")

    deleted = await SocialKeywordRepository.delete(keyword_id)
    if not deleted:
        raise HTTPException(404, "Keyword rule not found")

    # Delete from n8n Keywords Data Table
    await delete_keyword_from_n8n_table(
        ig_account_id=existing.get("ig_account_id", ""),
        keyword=existing.get("keyword", "")
    )

    # Invalidate Redis cache
    await clear_pattern("social:keywords:*")
    await clear_pattern("social:overview:*")

    return {"ok": True}


@router.post("/keywords/{keyword_id}/test", response_model=KeywordTestMatchResponse)
async def test_keyword_match(
    keyword_id: str,
    payload: KeywordTestMatchRequest,
    emp: dict = Depends(require_social("/social/keywords", "read"))
):
    """Tests an input comment string against a specific rule (no live Graph calls)."""
    rule = await SocialKeywordRepository.get_by_id(keyword_id)
    if not rule:
        raise HTTPException(404, "Rule not found")

    matched_rule, reason = match_keyword_rules(payload.comment_text, payload.media_id, [rule])
    return KeywordTestMatchResponse(
        matched=bool(matched_rule),
        reason=reason,
        normalized_comment=norm(payload.comment_text),
        rule_id=keyword_id
    )


@router.post("/keywords/import-csv")
async def import_keywords_csv(
    file: UploadFile = File(...),
    emp: dict = Depends(require_social("/social/keywords", "create"))
):
    """Import keyword rules from CSV export of old n8n Keywords table."""
    content = await file.read()
    text = content.decode("utf-8-sig", errors="ignore")
    reader = csv.DictReader(io.StringIO(text))

    imported = 0
    errors = []

    for row_idx, raw_row in enumerate(reader, start=2):
        row = {k.strip().lower(): (v or "").strip() for k, v in raw_row.items() if k}
        user_handle = row.get("username") or row.get("ig_username") or row.get("account")
        kw = row.get("keyword")
        msg = row.get("message")
        rep1 = row.get("comment_reply1") or row.get("reply1") or "Check your DM 📩"

        if not user_handle or not kw or not msg:
            errors.append(f"Row {row_idx}: Missing username, keyword, or message")
            continue

        account = await SocialAccountRepository.get_by_username(user_handle)
        if not account:
            errors.append(f"Row {row_idx}: Account @{user_handle} is not registered in HRMS")
            continue

        raw_media_id = clean_id(row.get("media_id", ""))
        kw_norm = norm(kw)

        is_dup = await SocialKeywordRepository.check_duplicate(account["ig_account_id"], kw_norm, raw_media_id)
        if is_dup:
            errors.append(f"Row {row_idx}: Duplicate rule for '{kw}' on post {raw_media_id}")
            continue

        rule_doc = {
            "ig_account_id": account["ig_account_id"],
            "username": account["username"],
            "keyword": kw,
            "keyword_norm": kw_norm,
            "message": msg,
            "post_link": row.get("post_link", ""),
            "media_id": raw_media_id,
            "media_source": "csv_import" if raw_media_id else "none",
            "comment_reply1": rep1,
            "comment_reply2": row.get("comment_reply2") or row.get("reply2") or "",
            "comment_reply3": row.get("comment_reply3") or row.get("reply3") or "",
            "require_follow": to_bool(row.get("require_follow", True)),
            "desc": row.get("desc") or "Imported via CSV",
            "created_by": emp.get("email") or "admin",
        }
        await SocialKeywordRepository.create(rule_doc)
        imported += 1

    return {"imported": imported, "errors": errors}


# =========================================================================
# 4. PENDING DMS
# =========================================================================
@router.get("/pending", response_model=List[SocialPendingDmResponse])
async def list_pending_dms(emp: dict = Depends(require_social("/social/activity", "read"))):
    """List pending follow-gated DMs awaiting user follow confirmation."""
    rows = await SocialPendingDmRepository.get_all()
    now = datetime.utcnow()
    res = []
    for r in rows:
        expire_at = r.get("expire_at", now)
        rem = max(0, int((expire_at - now).total_seconds()))
        igsid = str(r.get("igsid", ""))
        res.append(SocialPendingDmResponse(
            id=r["id"],
            ig_account_id=r["ig_account_id"],
            username=r.get("username", ""),
            igsid_masked=f"...{igsid[-4:]}" if len(igsid) >= 4 else igsid,
            keyword=r.get("keyword", ""),
            message=r.get("message", ""),
            comment_id=r.get("comment_id", ""),
            media_id=r.get("media_id", ""),
            created_at=r.get("created_at", now),
            expire_at=expire_at,
            ttl_minutes=r.get("ttl_minutes", 10),
            seconds_remaining=rem,
        ))
    return res


@router.delete("/pending/{pending_id}")
async def remove_pending_dm(
    pending_id: str,
    emp: dict = Depends(require_social("/social/activity", "delete"))
):
    """Manually clear a pending DM."""
    deleted = await SocialPendingDmRepository.delete_by_id(pending_id)
    if not deleted:
        raise HTTPException(404, "Pending row not found")
    return {"ok": True}


# =========================================================================
# 5. EVENT LOGS
# =========================================================================
@router.get("/events")
async def list_events(
    ig_account_id: Optional[str] = Query(None),
    level: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    emp: dict = Depends(require_social("/social/activity", "read"))
):
    """Get event log rows with search and filtering."""
    skip = (page - 1) * limit
    events, total = await SocialEventLogRepository.get_events(
        ig_account_id=ig_account_id,
        level=level,
        type_=type,
        status_=status,
        search=search,
        skip=skip,
        limit=limit
    )
    items = [SocialEventLogResponse(**e) for e in events]
    return {"items": items, "total": total, "page": page, "limit": limit}


@router.get("/events/summary")
async def get_events_summary(
    emp: dict = Depends(require_social("/social/activity", "read"))
):
    """Get 24-hour summary chips for dashboard."""
    return await SocialEventLogRepository.get_summary_24h()


@router.get("/events/export.csv")
async def export_events_csv(
    ig_account_id: Optional[str] = Query(None),
    emp: dict = Depends(require_social("/social/activity", "read"))
):
    """Export event logs to CSV."""
    events, _ = await SocialEventLogRepository.get_events(ig_account_id=ig_account_id, limit=2000)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Timestamp", "Level", "Type", "Status", "Account", "Username", "Message", "Hint", "Duration(ms)"])

    for e in events:
        writer.writerow([
            e.get("ts", "").isoformat() if isinstance(e.get("ts"), datetime) else str(e.get("ts", "")),
            e.get("level", ""),
            e.get("type", ""),
            e.get("status", ""),
            e.get("ig_account_id", ""),
            e.get("username", ""),
            e.get("message", ""),
            e.get("hint", ""),
            e.get("duration_ms", ""),
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=social_event_logs.csv"}
    )


@router.delete("/events")
async def clear_all_events(
    confirm: bool = Query(False),
    emp: dict = Depends(require_social("/social/activity", "delete", require_admin_for_write=True))
):
    """Clear all event logs manually (Admin only)."""
    if not confirm:
        raise HTTPException(400, "Please pass confirm=true to clear logs")
    count = await SocialEventLogRepository.clear_all()
    await SocialEventLogRepository.log_event(
        type_="cleanup",
        status_="ok",
        message=f"Admin cleared {count} event log(s)",
        actor=emp.get("personal_info", {}).get("first_name", "Admin")
    )
    return {"cleared": count}


# =========================================================================
# 6. SETTINGS & WEBHOOK INFO
# =========================================================================
@router.get("/webhook-info")
async def get_webhook_info(emp: dict = Depends(require_social("/social/settings", "read"))):
    """Returns the Meta callback URL and verification configuration status."""
    public_base = getattr(settings, "PUBLIC_BASE_URL", "") or getattr(settings, "VITE_API_URL", "http://localhost:8000")
    public_url = f"{public_base.rstrip('/')}/webhooks/meta/instagram"

    verify_token_set = bool(getattr(settings, "META_VERIFY_TOKEN", ""))
    app_secret_set = bool(getattr(settings, "META_APP_SECRET", ""))

    return {
        "webhook_url": public_url,
        "verify_token_configured": verify_token_set,
        "signature_enforced": app_secret_set,
        "instructions": [
            "In Meta for Developers -> Instagram -> Webhooks, paste the Callback URL above.",
            "Set the Verify Token to match the META_VERIFY_TOKEN configured in your .env.",
            "Subscribe to fields: 'comments' and 'messages'.",
            "Verify your app is in Live mode with advanced access for public comments and messaging."
        ]
    }


@router.get("/settings", response_model=SocialSettingsResponse)
async def get_effective_settings(emp: dict = Depends(require_social("/social/settings", "read"))):
    """Get active Social Automation settings and provider connectivity statuses."""
    stored = await SocialSettingsRepository.get_effective_settings()

    public_base = getattr(settings, "PUBLIC_BASE_URL", "") or getattr(settings, "VITE_API_URL", "http://localhost:8000")
    public_url = f"{public_base.rstrip('/')}/webhooks/meta/instagram"

    # Log statistics
    col = await SocialEventLogRepository.get_collection()
    total_logs = await col.count_documents({})
    oldest_doc = await col.find_one({}, sort=[("ts", 1)])
    oldest_ts = oldest_doc.get("ts") if oldest_doc else None

    return SocialSettingsResponse(
        public_webhook_url=public_url,
        meta_verify_token_configured=bool(getattr(settings, "META_VERIFY_TOKEN", "")),
        meta_app_secret_configured=bool(getattr(settings, "META_APP_SECRET", "")),
        models={
            "GEMINI_SCRIPT_MODEL": stored.get("GEMINI_SCRIPT_MODEL") or stored.get("gemini_script_model") or getattr(settings, "GEMINI_SCRIPT_MODEL", "gemini-3.1-flash-lite"),
            "GEMINI_VIDEO_MODEL": stored.get("GEMINI_VIDEO_MODEL") or stored.get("gemini_video_model") or getattr(settings, "GEMINI_VIDEO_MODEL", "gemini-3.5-flash-lite"),
            "GEMINI_MEDIA_MODEL": stored.get("GEMINI_MEDIA_MODEL") or stored.get("gemini_media_model") or getattr(settings, "GEMINI_MEDIA_MODEL", "gemini-3.8-flash"),
            "GROQ_TEXT_MODEL": stored.get("GROQ_TEXT_MODEL") or stored.get("groq_text_model") or getattr(settings, "GROQ_TEXT_MODEL", "openai/gpt-oss-120b"),
            "GROQ_VISION_MODEL": stored.get("GROQ_VISION_MODEL") or stored.get("groq_vision_model") or getattr(settings, "GROQ_VISION_MODEL", "qwen/qwen3.8-27b"),
        },
        key_configured={
            "gemini": bool(getattr(settings, "GEMINI_API_KEY", "")),
            "groq1": bool(getattr(settings, "GROQ_API_KEY_1", "") or getattr(settings, "GROQ_API_KEY", "")),
            "groq2": bool(getattr(settings, "GROQ_API_KEY_2", "")),
            "drive": bool(getattr(settings, "GOOGLE_SERVICE_ACCOUNT_JSON", "")),
            "telegram_reel": bool(getattr(settings, "TELEGRAM_REEL_BOT_TOKEN", "")),
            "telegram_caption": bool(getattr(settings, "TELEGRAM_CAPTION_BOT_TOKEN", "")),
        },
        retention_days=stored.get("SOCIAL_LOG_RETENTION_DAYS") or getattr(settings, "SOCIAL_LOG_RETENTION_DAYS", 2),
        allow_self_comments=stored.get("SOCIAL_ALLOW_SELF_COMMENTS") if "SOCIAL_ALLOW_SELF_COMMENTS" in stored else getattr(settings, "SOCIAL_ALLOW_SELF_COMMENTS", False),
        pending_ttl_minutes=stored.get("pending_ttl_minutes", 10),
        caption_cooldown_seconds=stored.get("caption_cooldown_seconds", 20),
        allowed_telegram_reel_chat_ids=stored.get("allowed_telegram_reel_chat_ids", [8264009249, 7009284089]),
        allowed_telegram_caption_chat_ids=stored.get("allowed_telegram_caption_chat_ids", [7009284089, 841863295]),
        log_stats={
            "total_logs": total_logs,
            "oldest_log_ts": oldest_ts,
        }
    )


@router.put("/settings")
async def update_social_settings(
    payload: SocialSettingsUpdate,
    emp: dict = Depends(require_social("/social/settings", "update", require_admin_for_write=True))
):
    """Update settings (Admin only). Updates existing log expire_at if retention changed."""
    data = payload.dict(exclude_unset=True)
    if "SOCIAL_LOG_RETENTION_DAYS" in data:
        days = max(1, min(30, int(data["SOCIAL_LOG_RETENTION_DAYS"])))
        data["SOCIAL_LOG_RETENTION_DAYS"] = days
        await SocialEventLogRepository.update_retention(days)

    updated = await SocialSettingsRepository.update_settings(data)
    await SocialEventLogRepository.log_event(
        type_="settings_changed",
        status_="ok",
        message="Admin updated Social Automation configuration parameters",
        detail={k: str(v) for k, v in data.items()},
        actor=emp.get("personal_info", {}).get("first_name", "Admin")
    )
    return updated


@router.post("/settings/test/{provider}", response_model=ProviderTestResponse)
async def test_provider_connection(
    provider: str,
    emp: dict = Depends(require_social("/social/settings", "read"))
):
    """Test live connectivity for Gemini, Groq, Instagram, or Drive providers."""
    start = time.time()
    prov = provider.lower()

    if prov == "instagram":
        accounts = await SocialAccountRepository.get_all(active_only=True)
        if not accounts:
            return ProviderTestResponse(ok=False, message="No active Instagram accounts found in HRMS.")
        acct = accounts[0]
        token = decrypt_social_token(acct.get("access_token_enc", ""))
        valid, _, hint = await InstagramClient.get_account_identity(token)
        ms = int((time.time() - start) * 1000)
        return ProviderTestResponse(ok=valid, message=f"@{acct.get('username')}: {hint}", latency_ms=ms)

    elif prov == "gemini":
        key = getattr(settings, "GEMINI_API_KEY", "")
        if not key:
            return ProviderTestResponse(ok=False, message="GEMINI_API_KEY is not configured in .env")
        try:
            import httpx
            model = getattr(settings, "GEMINI_SCRIPT_MODEL", "gemini-3.1-flash-lite")
            if "gemini-2.5" in model:
                model = "gemini-3.1-flash-lite"
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
            headers = {"x-goog-api-key": key, "Content-Type": "application/json"}
            payload = {"contents": [{"parts": [{"text": "Reply with 'OK'"}]}]}
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, headers=headers, json=payload)
                ms = int((time.time() - start) * 1000)
                if res.status_code == 200:
                    return ProviderTestResponse(ok=True, message=f"Gemini connection verified ({model})", latency_ms=ms)
                return ProviderTestResponse(ok=False, message=f"Gemini HTTP {res.status_code}: {res.text[:200]}", latency_ms=ms)
        except Exception as e:
            return ProviderTestResponse(ok=False, message=f"Gemini test exception: {e}")

    elif prov == "groq":
        key = getattr(settings, "GROQ_API_KEY_1", "") or getattr(settings, "GROQ_API_KEY", "")
        if not key:
            return ProviderTestResponse(ok=False, message="GROQ_API_KEY or GROQ_API_KEY_1 is not configured in .env")
        try:
            import httpx
            url = "https://api.groq.com/openai/v1/chat/completions"
            headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
            payload = {
                "model": getattr(settings, "GROQ_TEXT_MODEL", "openai/gpt-oss-120b"),
                "messages": [{"role": "user", "content": "ping"}],
                "max_tokens": 5
            }
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, headers=headers, json=payload)
                ms = int((time.time() - start) * 1000)
                if res.status_code == 200:
                    return ProviderTestResponse(ok=True, message="Groq connection verified", latency_ms=ms)
                return ProviderTestResponse(ok=False, message=f"Groq HTTP {res.status_code}: {res.text[:200]}", latency_ms=ms)
        except Exception as e:
            return ProviderTestResponse(ok=False, message=f"Groq test exception: {e}")

    return ProviderTestResponse(ok=False, message=f"Unknown provider '{provider}'")


# ==============================================================================
# SECTION: BRANDS
# ==============================================================================

@router.get("/brands", response_model=List[SocialBrandResponse])
async def list_brands(
    emp: dict = Depends(require_social("/social/brands", "read"))
):
    """List all registered brand profiles with attached account counts."""
    brands = await SocialBrandRepository.get_all()
    accounts = await SocialAccountRepository.get_all()
    counts = {}
    for a in accounts:
        b_id = a.get("brand_id")
        if b_id:
            counts[b_id] = counts.get(b_id, 0) + 1

    out = []
    for b in brands:
        bid = b.get("brand_id") or b.get("id")
        out.append(SocialBrandResponse(
            id=b["id"],
            brand_id=b.get("brand_id", b["id"]),
            brand_name=b.get("brand_name", ""),
            link=b.get("link", ""),
            ig_id=b.get("ig_id", ""),
            industry=b.get("industry", ""),
            about=b.get("about", ""),
            products_services=b.get("products_services", []),
            usps=b.get("usps", []),
            target_audience=b.get("target_audience", ""),
            audience_age=b.get("audience_age", ""),
            audience_interests=b.get("audience_interests", []),
            city=b.get("city", ""),
            state=b.get("state", ""),
            country=b.get("country", ""),
            service_area=b.get("service_area", ""),
            goal=b.get("goal", ""),
            tone=b.get("tone", ""),
            caption_language=b.get("caption_language", "English"),
            default_cta=b.get("default_cta", ""),
            always_include_hashtags=b.get("always_include_hashtags", []),
            never_use_hashtags=b.get("never_use_hashtags", []),
            notes=b.get("notes", ""),
            is_active=b.get("is_active", True),
            accounts_count=counts.get(bid, 0),
            created_at=b.get("created_at"),
            updated_at=b.get("updated_at"),
        ))
    return out


@router.post("/brands", response_model=SocialBrandResponse)
async def create_brand(
    payload: SocialBrandCreate,
    emp: dict = Depends(require_social("/social/brands", "create"))
):
    """Create a new brand profile."""
    existing = await SocialBrandRepository.get_by_brand_id(payload.brand_id)
    if existing:
        raise HTTPException(400, f"Brand ID '{payload.brand_id}' already exists")
    created = await SocialBrandRepository.create(payload.dict())
    return SocialBrandResponse(
        **created,
        id=created["id"],
        accounts_count=0
    )


@router.put("/brands/{brand_id}", response_model=SocialBrandResponse)
async def update_brand(
    brand_id: str,
    payload: SocialBrandUpdate,
    emp: dict = Depends(require_social("/social/brands", "update"))
):
    """Update brand profile."""
    brand = await SocialBrandRepository.get_by_id(brand_id)
    if not brand:
        raise HTTPException(404, "Brand not found")
    actual_bid = brand.get("brand_id", brand_id)
    updated = await SocialBrandRepository.update(actual_bid, payload.dict(exclude_unset=True))
    return SocialBrandResponse(
        **updated,
        id=updated["id"],
        accounts_count=0
    )


@router.delete("/brands/{brand_id}")
async def delete_brand(
    brand_id: str,
    emp: dict = Depends(require_social("/social/brands", "delete"))
):
    """Delete a brand profile."""
    brand = await SocialBrandRepository.get_by_id(brand_id)
    if not brand:
        raise HTTPException(404, "Brand not found")
    actual_bid = brand.get("brand_id", brand_id)
    deleted = await SocialBrandRepository.delete(actual_bid)
    return {"deleted": deleted, "brand_id": brand_id}


# ==============================================================================
# SECTION: REEL SCRIPTS
# ==============================================================================

@router.post("/scripts/generate")
async def generate_reel_script(
    payload: dict,
    emp: dict = Depends(require_social("/social/scripts", "create"))
):
    """Generates a structured viral Reel Script using the LLM chain."""
    topic = payload.get("topic", "").strip()
    if not topic:
        raise HTTPException(400, "Topic is required")
    brand_id = payload.get("brand_id")
    duration = int(payload.get("duration", 60))
    tone = payload.get("tone")
    creator_id = emp.get("personal_info", {}).get("first_name", "HRMS User")

    script = await ReelScriptEngine.generate_script(
        topic=topic,
        brand_id=brand_id,
        duration=duration,
        tone=tone,
        creator_id=creator_id
    )
    return script


@router.get("/scripts")
async def list_reel_scripts(
    brand_id: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    emp: dict = Depends(require_social("/social/scripts", "read"))
):
    """List previously generated scripts."""
    scripts = await SocialScriptRepository.get_user_scripts(brand_id=brand_id, limit=limit)
    return scripts


@router.get("/scripts/{script_id}")
async def get_reel_script(
    script_id: str,
    emp: dict = Depends(require_social("/social/scripts", "read"))
):
    """Get single script detail."""
    script = await SocialScriptRepository.get_by_id(script_id)
    if not script:
        raise HTTPException(404, "Script not found")
    return script


@router.post("/scripts/{script_id}/revise")
async def revise_reel_script(
    script_id: str,
    payload: dict,
    emp: dict = Depends(require_social("/social/scripts", "update"))
):
    """Revise a script based on creator feedback."""
    feedback = payload.get("feedback", "").strip()
    if not feedback:
        raise HTTPException(400, "Feedback is required for revision")
    creator_id = emp.get("personal_info", {}).get("first_name", "HRMS User")
    revised = await ReelScriptEngine.revise_script(
        script_id=script_id,
        feedback=feedback,
        creator_id=creator_id
    )
    return revised


@router.post("/scripts/{script_id}/favorite")
async def toggle_favorite_script(
    script_id: str,
    emp: dict = Depends(require_social("/social/scripts", "update"))
):
    """Toggle favorite star on a script."""
    script = await SocialScriptRepository.get_by_id(script_id)
    if not script:
        raise HTTPException(404, "Script not found")
    new_fav = not script.get("is_favorited", False)
    updated = await SocialScriptRepository.update(script_id, {"is_favorited": new_fav})
    return {"id": script_id, "is_favorited": new_fav}


@router.patch("/scripts/{script_id}/status")
async def update_script_status(
    script_id: str,
    payload: dict,
    emp: dict = Depends(require_social("/social/scripts", "update"))
):
    """Update script workflow status (draft, approved, recorded, published)."""
    status = payload.get("status")
    if not status or status not in ("draft", "approved", "recorded", "published"):
        raise HTTPException(400, "Invalid status")
    updated = await SocialScriptRepository.update(script_id, {"status": status})
    return updated


@router.delete("/scripts/{script_id}")
async def delete_reel_script(
    script_id: str,
    emp: dict = Depends(require_social("/social/scripts", "delete"))
):
    """Delete a script."""
    deleted = await SocialScriptRepository.delete(script_id)
    return {"deleted": deleted, "id": script_id}


# ==============================================================================
# SECTION: CAPTIONS & SEO
# ==============================================================================

@router.post("/captions/generate")
async def generate_caption(
    payload: dict,
    emp: dict = Depends(require_social("/social/captions", "create"))
):
    """Generate multi-angle captions (A, B, D) and tiered hashtags."""
    topic = payload.get("topic", "").strip()
    brand_id = payload.get("brand_id")
    image_url = payload.get("image_url")
    creator_id = emp.get("personal_info", {}).get("first_name", "HRMS User")

    if not topic and not image_url:
        raise HTTPException(400, "Provide a topic or an image URL")

    result = await CaptionEngine.generate_caption(
        topic=topic,
        brand_id=brand_id,
        image_url=image_url,
        creator_id=creator_id
    )
    return result
