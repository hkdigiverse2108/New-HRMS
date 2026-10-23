import httpx
import re
import logging
from typing import Optional, Dict, Any, Tuple
from app.config import settings

logger = logging.getLogger("hrms.social")

def parse_graph_error(response_json: dict, raw_text: str = "") -> Tuple[Optional[int], Optional[int], str]:
    """Parse Graph API error, code, error_subcode, and return admin-friendly hint."""
    err = response_json.get("error", {}) if isinstance(response_json, dict) else {}
    code = err.get("code")
    subcode = err.get("error_subcode")
    msg = err.get("message", "")

    if not code and raw_text:
        c_match = re.search(r'"code":\s*(\d+)', raw_text)
        if c_match:
            code = int(c_match.group(1))
        sc_match = re.search(r'"error_subcode":\s*(\d+)', raw_text)
        if sc_match:
            subcode = int(sc_match.group(1))

    # Error-hint lookup (§5.7)
    hint = "Graph API request failed."
    if subcode == 2534025:
        hint = "Invalid for a comment private reply: fake/test comment ID, a reply was already sent for this comment, the comment is from your own account, older than 7 days, or is a sub-reply (not top-level)."
    elif code == 190 or "expired" in msg.lower() or "invalid" in msg.lower() or "session" in msg.lower():
        hint = "Access token expired or invalid: generate a new long-lived token in Meta for Developers and update it in Accounts."
    elif code in (10, 200) or "permission" in msg.lower():
        hint = "Permission missing: instagram_business_manage_messages (DM) or instagram_business_manage_comments (replies). Verify App Review / Live mode in Meta Dashboard."
    elif code == 100:
        hint = "Invalid parameter: comment was deleted, or comment_id / message format is incorrect."
    elif code in (613, 4) or "rate" in msg.lower():
        hint = "Rate limit reached: Meta rate limits private replies. Will retry later."

    return code, subcode, hint

class InstagramClient:
    """Async Instagram Graph API client with Bearer token authentication."""

    @classmethod
    def get_base_url(cls) -> str:
        base = getattr(settings, "IG_GRAPH_BASE", "https://graph.instagram.com").rstrip("/")
        ver = getattr(settings, "IG_GRAPH_VERSION", "v21.0").lstrip("/")
        return f"{base}/{ver}"

    @classmethod
    async def get_account_identity(cls, access_token: str) -> Tuple[bool, Dict[str, Any], str]:
        """Validate an access token by calling GET /me?fields=user_id,username."""
        url = f"{cls.get_base_url()}/me?fields=user_id,username"
        headers = {"Authorization": f"Bearer {access_token}"}
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.get(url, headers=headers)
                data = res.json()
                if res.status_code == 200 and "user_id" in data:
                    return True, data, "Valid token"
                code, subcode, hint = parse_graph_error(data, res.text)
                return False, data, hint
        except Exception as e:
            return False, {}, f"Network error contacting Graph API: {e}"

    @classmethod
    async def is_user_following_business(cls, igsid: str, access_token: str) -> bool:
        """Query GET /{igsid}?fields=is_user_follow_business. Only explicit True means following."""
        url = f"{cls.get_base_url()}/{igsid}?fields=is_user_follow_business"
        headers = {"Authorization": f"Bearer {access_token}"}
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.get(url, headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    return data.get("is_user_follow_business") is True
                return False
        except Exception as e:
            logger.warning(f"Error checking follow status for {igsid}: {e}")
            return False

    @classmethod
    async def post_public_reply(cls, comment_id: str, message: str, access_token: str) -> Tuple[bool, dict, str]:
        """POST /{comment_id}/replies body {'message': message}."""
        url = f"{cls.get_base_url()}/{comment_id}/replies"
        headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(url, headers=headers, json={"message": message})
                data = res.json()
                if res.status_code in (200, 201) and "id" in data:
                    return True, data, "Public reply sent"
                code, subcode, hint = parse_graph_error(data, res.text)
                return False, data, hint
        except Exception as e:
            return False, {}, f"Network exception: {e}"

    @classmethod
    async def send_private_reply_to_comment(cls, comment_id: str, message: str, access_token: str) -> Tuple[bool, dict, str]:
        """POST /me/messages body {'recipient':{'comment_id': comment_id}, 'message':{'text': message}}."""
        url = f"{cls.get_base_url()}/me/messages"
        headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
        payload = {
            "recipient": {"comment_id": comment_id},
            "message": {"text": message}
        }
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                res = await client.post(url, headers=headers, json=payload)
                data = res.json()
                if res.status_code in (200, 201) and "recipient_id" in data:
                    return True, data, "Private DM sent"
                code, subcode, hint = parse_graph_error(data, res.text)
                return False, data, hint
        except Exception as e:
            return False, {}, f"Network exception: {e}"

    @classmethod
    async def send_direct_message_by_igsid(cls, igsid: str, message: str, access_token: str) -> Tuple[bool, dict, str]:
        """POST /me/messages body {'recipient':{'id': igsid}, 'message':{'text': message}}."""
        url = f"{cls.get_base_url()}/me/messages"
        headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
        payload = {
            "recipient": {"id": igsid},
            "message": {"text": message}
        }
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                res = await client.post(url, headers=headers, json=payload)
                data = res.json()
                if res.status_code in (200, 201) and "recipient_id" in data:
                    return True, data, "Direct DM sent"
                code, subcode, hint = parse_graph_error(data, res.text)
                return False, data, hint
        except Exception as e:
            return False, {}, f"Network exception: {e}"

    @classmethod
    async def send_follow_gate_template(
        cls,
        recipient_target: dict,  # {"comment_id": ...} or {"id": igsid}
        username: str,
        access_token: str,
        custom_text: Optional[str] = None
    ) -> Tuple[bool, dict, str]:
        """Send follow gate button template via /me/messages."""
        clean_user = username.lstrip("@").strip()
        profile_url = f"https://instagram.com/{clean_user}"
        text = custom_text or (
            f"You are not following us yet ❤️\n\n"
            f"Please follow us first:\n{profile_url}\n\n"
            f"Once you follow, tap the button below 👇"
        )
        payload = {
            "recipient": recipient_target,
            "message": {
                "attachment": {
                    "type": "template",
                    "payload": {
                        "template_type": "button",
                        "text": text[:640],
                        "buttons": [
                            {"type": "web_url", "url": profile_url, "title": "Visit Profile"[:20]},
                            {"type": "postback", "title": "I'm Following"[:20], "payload": "IM_FOLLOWING"}
                        ]
                    }
                }
            }
        }
        url = f"{cls.get_base_url()}/me/messages"
        headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                res = await client.post(url, headers=headers, json=payload)
                data = res.json()
                if res.status_code in (200, 201) and "recipient_id" in data:
                    return True, data, "Follow-gate template sent"
                code, subcode, hint = parse_graph_error(data, res.text)
                return False, data, hint
        except Exception as e:
            return False, {}, f"Network exception sending gate: {e}"

    @classmethod
    async def refresh_access_token(cls, raw_token: str) -> Tuple[bool, str, str]:
        """Refresh long-lived token via GET https://graph.instagram.com/refresh_access_token."""
        url = f"https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token={raw_token}"
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                res = await client.get(url)
                data = res.json()
                if res.status_code == 200 and "access_token" in data:
                    return True, data["access_token"], "ok"
                code, subcode, hint = parse_graph_error(data, res.text)
                return False, "", hint
        except Exception as e:
            return False, "", f"Network error during refresh: {e}"

    @classmethod
    async def resolve_permalink_to_media_id(cls, post_link: str, access_token: str) -> Tuple[Optional[str], str]:
        """Extract shortcode from Instagram link and resolve numeric media_id via /me/media pagination."""
        match = re.search(r"instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)", post_link)
        if not match:
            return None, "Invalid Instagram post link format. Supported: /p/, /reel/, /reels/, /tv/."

        shortcode = match.group(1)
        url = f"{cls.get_base_url()}/me/media?fields=id,shortcode,permalink&limit=50"
        headers = {"Authorization": f"Bearer {access_token}"}

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                current_url = url
                pages_checked = 0
                while current_url and pages_checked < 10:
                    pages_checked += 1
                    res = await client.get(current_url, headers=headers)
                    if res.status_code != 200:
                        break
                    data = res.json()
                    items = data.get("data", [])
                    for item in items:
                        if item.get("shortcode") == shortcode or f"/{shortcode}/" in item.get("permalink", ""):
                            return str(item.get("id")), f"Resolved from shortcode {shortcode}"
                    
                    paging = data.get("paging", {})
                    current_url = paging.get("next")

            return None, f"Post with shortcode {shortcode} was not found in the {pages_checked * 50} most recent posts. Enter media_id directly."
        except Exception as e:
            return None, f"Error resolving link via Graph API: {e}"
