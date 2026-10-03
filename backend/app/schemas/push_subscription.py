from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class PushSubscriptionBase(BaseModel):
    user_id: Optional[str] = None
    endpoint: str
    p256dh: str
    auth: str
    user_agent: Optional[str] = None
    is_active: bool = True


class PushSubscriptionCreate(PushSubscriptionBase):
    pass


class PushSubscriptionResponse(PushSubscriptionBase):
    id: str = Field(alias="_id")
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class PushSubscriptionPublicKey(BaseModel):
    public_key: str