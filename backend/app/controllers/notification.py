from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from app.schemas.notification import NotificationResponse
from app.repository.notification import NotificationRepository
from app.controllers.auth import get_current_employee

router = APIRouter(prefix="/notifications", tags=["Notifications"])

@router.get("/me", response_model=List[NotificationResponse])
async def get_my_notifications(current_user: dict = Depends(get_current_employee)):
    user_id = str(current_user.get("_id") or current_user.get("id"))
    return await NotificationRepository.get_notifications_for_user(user_id)

@router.put("/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_as_read(notification_id: str, current_user: dict = Depends(get_current_employee)):
    user_id = str(current_user.get("_id") or current_user.get("id"))
    success = await NotificationRepository.mark_as_read(notification_id, user_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found or access denied")

@router.put("/read-all", status_code=status.HTTP_204_NO_CONTENT)
async def mark_all_as_read(current_user: dict = Depends(get_current_employee)):
    user_id = str(current_user.get("_id") or current_user.get("id"))
    await NotificationRepository.mark_all_as_read(user_id)
