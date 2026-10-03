from fastapi import APIRouter, Depends, HTTPException, status, Request
from typing import List
from app.schemas.push_subscription import (
    PushSubscriptionCreate,
    PushSubscriptionResponse,
    PushSubscriptionPublicKey,
)
from app.repository.push_subscription import PushSubscriptionRepository
from app.controllers.auth import get_current_employee
from app.utils.push_notifications import get_vapid_public_key, send_push_to_user

router = APIRouter(prefix="/push", tags=["Push Notifications"])


@router.get("/vapid-public-key", response_model=PushSubscriptionPublicKey)
async def get_vapid_public_key_endpoint():
    """Get the VAPID public key for client-side subscription"""
    return {"public_key": get_vapid_public_key()}


@router.post("/subscribe", response_model=PushSubscriptionResponse, status_code=status.HTTP_201_CREATED)
async def subscribe(
    subscription: PushSubscriptionCreate,
    current_user: dict = Depends(get_current_employee),
    request: Request = None
):
    """Subscribe the current user to push notifications"""
    user_id = str(current_user.get("_id") or current_user.get("id"))
    user_agent = request.headers.get("user-agent") if request else None
    
    sub_data = subscription.model_dump()
    sub_data["user_id"] = user_id
    sub_data["user_agent"] = user_agent
    
    return await PushSubscriptionRepository.create_or_update_subscription(sub_data)


@router.get("/subscriptions", response_model=List[PushSubscriptionResponse])
async def get_subscriptions(current_user: dict = Depends(get_current_employee)):
    """Get all active push subscriptions for the current user"""
    user_id = str(current_user.get("_id") or current_user.get("id"))
    return await PushSubscriptionRepository.get_active_subscriptions(user_id)


@router.delete("/subscriptions", status_code=status.HTTP_204_NO_CONTENT)
@router.delete("/subscriptions/{subscription_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unsubscribe(
    subscription_id: str = "all",
    current_user: dict = Depends(get_current_employee)
):
    """Unsubscribe from push notifications"""
    user_id = str(current_user.get("_id") or current_user.get("id"))
    await PushSubscriptionRepository.delete_subscription(subscription_id, user_id)
    return None


@router.post("/test", status_code=status.HTTP_200_OK)
async def test_push(current_user: dict = Depends(get_current_employee)):
    """Send a test push notification to the current user"""
    user_id = str(current_user.get("_id") or current_user.get("id"))
    p_info = current_user.get("personal_info", {}) if isinstance(current_user.get("personal_info"), dict) else {}
    first_name = p_info.get("first_name", "")
    last_name = p_info.get("last_name", "")
    user_name = f"{first_name} {last_name}".strip() or current_user.get("name") or "User"
    
    profile_photo = (
        current_user.get("avatar") or 
        current_user.get("profile_photo") or 
        p_info.get("profile_photo") or 
        p_info.get("avatar")
    )
    
    count = await send_push_to_user(
        user_id=user_id,
        title="HRMS Test Notification",
        body=f"Hello {user_name}! Background notifications are active even when HRMS is closed.",
        icon=profile_photo,
        action_url="/notifications",
        data={"type": "test"}
    )
    
    if count == 0:
        return {
            "sent": 0,
            "message": "No active device subscriptions found. Please enable Push Notifications in Settings first!"
        }
    return {"sent": count, "message": f"Test push sent successfully to {count} device(s)!"}