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


@router.delete("/subscriptions/{subscription_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unsubscribe(
    subscription_id: str,
    current_user: dict = Depends(get_current_employee)
):
    """Unsubscribe from push notifications"""
    user_id = str(current_user.get("_id") or current_user.get("id"))
    success = await PushSubscriptionRepository.delete_subscription(subscription_id, user_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")


@router.post("/test", status_code=status.HTTP_200_OK)
async def test_push(current_user: dict = Depends(get_current_employee)):
    """Send a test push notification to the current user"""
    user_id = str(current_user.get("_id") or current_user.get("id"))
    user_name = current_user.get("personal_info", {}).get("first_name", "User")
    profile_photo = current_user.get("personal_info", {}).get("profile_photo")
    
    count = await send_push_to_user(
        user_id=user_id,
        title="Test Notification",
        body=f"Hello {user_name}! Push notifications are working correctly.",
        icon=profile_photo or "/favicon.ico",
        action_url="/notifications",
        data={"type": "test"}
    )
    
    return {"sent": count, "message": f"Test push sent to {count} device(s)"}