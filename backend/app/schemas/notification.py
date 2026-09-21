from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class NotificationBase(BaseModel):
    recipient_id: str
    title: str
    message: str
    type: str = "general"
    is_read: bool = False
    action_url: Optional[str] = None

class NotificationCreate(NotificationBase):
    pass

class NotificationResponse(NotificationBase):
    id: str = Field(alias="_id")
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
