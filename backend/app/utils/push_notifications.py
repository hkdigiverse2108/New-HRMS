import os
import json
import base64
from pathlib import Path
from pywebpush import webpush, WebPushException, Vapid
from typing import Optional, Dict, Any
from app.config import settings
from cryptography.hazmat.primitives import serialization

VAPID_KEYS_FILE = Path(__file__).parent.parent / "vapid_keys.json"


def generate_vapid_keys() -> Dict[str, str]:
    """Generate new VAPID keys for web push"""
    vapid = Vapid()
    vapid.generate_keys()
    
    # Get private key in PEM format for pywebpush
    private_pem = vapid.private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    ).decode()
    
    # Get public key in uncompressed point format (base64url) for frontend
    public_numbers = vapid.public_key.public_numbers()
    x = public_numbers.x.to_bytes(32, 'big')
    y = public_numbers.y.to_bytes(32, 'big')
    uncompressed = b'\x04' + x + y
    public_key_b64url = base64.urlsafe_b64encode(uncompressed).decode().rstrip('=')
    
    return {
        "public_key": public_key_b64url,
        "private_key": private_pem,
    }


def load_vapid_keys() -> Dict[str, str]:
    """Load VAPID keys from file or generate new ones"""
    if VAPID_KEYS_FILE.exists():
        with open(VAPID_KEYS_FILE, "r") as f:
            return json.load(f)
    keys = generate_vapid_keys()
    save_vapid_keys(keys)
    return keys


def save_vapid_keys(keys: Dict[str, str]) -> None:
    """Save VAPID keys to file"""
    with open(VAPID_KEYS_FILE, "w") as f:
        json.dump(keys, f)


def get_vapid_public_key() -> str:
    """Get the VAPID public key for frontend subscription"""
    keys = load_vapid_keys()
    return keys["public_key"]


def get_vapid_private_key() -> str:
    """Get the VAPID private key for sending pushes"""
    keys = load_vapid_keys()
    return keys["private_key"]


def get_vapid_claims() -> Dict[str, str]:
    """Get VAPID claims for push sending"""
    return {
        "sub": f"mailto:{settings.admin_email or 'admin@hrms.local'}",
    }


async def send_push_notification(
    subscription: Dict[str, Any],
    payload: Dict[str, Any],
    ttl: int = 86400
) -> bool:
    """
    Send a push notification to a subscription
    Returns True if successful, False otherwise
    """
    try:
        webpush(
            subscription_info=subscription,
            data=json.dumps(payload),
            vapid_private_key=get_vapid_private_key(),
            vapid_claims=get_vapid_claims(),
            ttl=ttl,
        )
        return True
    except WebPushException as e:
        if e.response and e.response.status_code in (404, 410):
            return "expired"
        print(f"[PUSH ERROR] Failed to send push: {e}")
        return False
    except Exception as e:
        print(f"[PUSH ERROR] Unexpected error: {e}")
        return False


async def send_push_to_user(
    user_id: str,
    title: str,
    body: str,
    icon: Optional[str] = None,
    data: Optional[Dict[str, Any]] = None,
    action_url: Optional[str] = None
) -> int:
    """
    Send push notification to all subscriptions for a user
    Returns number of successful sends
    """
    from app.repository.push_subscription import PushSubscriptionRepository
    
    subscriptions = await PushSubscriptionRepository.get_active_subscriptions(user_id)
    if not subscriptions:
        return 0
    
    payload = {
        "title": title,
        "body": body,
        "icon": icon or "/favicon.ico",
        "badge": "/favicon.ico",
        "data": {
            "url": action_url or "/",
            "userId": user_id,
            **(data or {}),
        },
        "actions": [
            {"action": "open", "title": "Open"},
            {"action": "close", "title": "Dismiss"},
        ],
        "requireInteraction": True,
    }
    
    success_count = 0
    expired_subscriptions = []
    
    for sub in subscriptions:
        subscription_info = {
            "endpoint": sub["endpoint"],
            "keys": {
                "p256dh": sub["p256dh"],
                "auth": sub["auth"],
            },
        }
        result = await send_push_notification(subscription_info, payload)
        if result is True:
            success_count += 1
        elif result == "expired":
            expired_subscriptions.append(sub["_id"])
    
    if expired_subscriptions:
        await PushSubscriptionRepository.deactivate_subscriptions(expired_subscriptions)
    
    return success_count