import hmac
import hashlib
import json
import logging
from fastapi import APIRouter, Request, Response, BackgroundTasks, Query
from fastapi.responses import PlainTextResponse
from app.config import settings
from app.repository.social import SocialEventLogRepository
from app.services.social.dm_engine import DmEngine

logger = logging.getLogger("hrms.social")

router = APIRouter(prefix="/webhooks/meta", tags=["Social Meta Webhooks"])

@router.get("/instagram")
async def verify_instagram_webhook(
    request: Request,
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
):
    """Meta webhook verification endpoint.
    Must return plain challenge string on matching verify_token.
    """
    configured_token = getattr(settings, "META_VERIFY_TOKEN", "") or ""
    if not configured_token:
        logger.warning("Meta webhook GET rejected: META_VERIFY_TOKEN is not configured in .env.")
        return Response(content="Verification token not configured", status_code=403, media_type="text/plain")

    if hub_mode == "subscribe" and hmac.compare_digest(str(hub_verify_token or ""), configured_token):
        logger.info("Meta Instagram webhook verified successfully.")
        await SocialEventLogRepository.log_event(
            type_="webhook_verified",
            status_="ok",
            message="Meta Webhook verification challenge accepted and verified",
            actor="meta"
        )
        return PlainTextResponse(content=hub_challenge or "", status_code=200)

    logger.warning("Meta webhook GET rejected: verify token mismatch or invalid mode.")
    return Response(content="Forbidden", status_code=403, media_type="text/plain")


def verify_signature(raw_body: bytes, hub_sig: str, app_secret: str) -> bool:
    """Verifies X-Hub-Signature-256 header against raw request body."""
    if not hub_sig or not hub_sig.startswith("sha256="):
        return False
    expected_hash = hmac.new(app_secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    received_hash = hub_sig.replace("sha256=", "").strip()
    return hmac.compare_digest(expected_hash, received_hash)

@router.post("/instagram")
async def receive_instagram_webhook_events(
    request: Request,
    background_tasks: BackgroundTasks,
):
    """Receives Instagram webhook events (comments, messages, postbacks).
    Validates HMAC signature if META_APP_SECRET is set, returns 200 immediately,
    and processes the event payload in the background.
    """
    raw_body = await request.body()
    app_secret = getattr(settings, "META_APP_SECRET", "") or ""

    # Signature verification if secret configured (§5.1)
    if app_secret:
        hub_sig = request.headers.get("X-Hub-Signature-256", "")
        if not verify_signature(raw_body, hub_sig, app_secret):
            logger.warning("Meta webhook POST rejected: Signature mismatch or missing header")
            await SocialEventLogRepository.log_event(
                type_="signature_failed",
                status_="error",
                message="Webhook rejected: X-Hub-Signature-256 invalid or missing",
                actor="meta",
                level="error"
            )
            return Response(content="Signature verification failed", status_code=403, media_type="text/plain")

    # Parse JSON payload
    try:
        body_json = json.loads(raw_body.decode("utf-8")) if raw_body else {}
    except Exception as e:
        logger.error(f"Failed to parse webhook JSON body: {e}")
        return Response(content="Invalid JSON", status_code=400, media_type="text/plain")

    # Dispatch to background task to guarantee instant 200 HTTP response to Meta
    background_tasks.add_task(DmEngine.handle_payload, body_json)

    return {"status": "received"}
