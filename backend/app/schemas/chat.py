from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class ChannelCreate(BaseModel):
    name: str
    members: List[str] = []

class ChannelUpdate(BaseModel):
    name: Optional[str] = None
    members: Optional[List[str]] = None

class LastMessageInfo(BaseModel):
    content: Optional[str] = ""
    sender_id: Optional[str] = None
    message_type: Optional[str] = "text"
    timestamp: Optional[datetime] = None

class ChannelResponse(BaseModel):
    id: str = Field(alias="_id")
    name: str
    type: Optional[str] = "group"
    members: List[str] = []
    created_by: Optional[str] = None
    created_at: Optional[datetime] = None
    last_message: Optional[LastMessageInfo] = None
    unread_count: int = 0

    class Config:
        populate_by_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class PollOption(BaseModel):
    id: str
    text: str
    voters: List[str] = []

class PollCreate(BaseModel):
    question: str
    options: List[str]
    allow_multiple_answers: bool = False
    hide_voters_name: bool = False

class PollResponse(BaseModel):
    question: str
    allow_multiple_answers: bool = False
    hide_voters_name: bool = False
    created_by: str
    options: List[PollOption] = []

class UnreadCountResponse(BaseModel):
    channel_id: str
    channel_name: Optional[str] = "Chat"
    unread_count: int = 0

class ReactionItem(BaseModel):
    emoji: str
    users: List[str] = []

class ReplyToSummary(BaseModel):
    message_id: str
    content: Optional[str] = ""
    sender_id: str
    message_type: Optional[str] = "text"

class ReactionRequest(BaseModel):
    emoji: str

class ForwardMessageRequest(BaseModel):
    message_ids: List[str]
    target_channel_id: Optional[str] = None
    target_receiver_id: Optional[str] = None

class MessageCreate(BaseModel):
    channel_id: Optional[str] = None
    receiver_id: Optional[str] = None
    content: Optional[str] = ""
    message_type: Optional[str] = "text"
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    poll: Optional[PollCreate] = None
    mentions: List[str] = []
    reply_to_id: Optional[str] = None

class UserPresenceResponse(BaseModel):
    user_id: str
    is_online: bool = False
    last_seen: Optional[datetime] = None

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class UserPresenceBatchRequest(BaseModel):
    user_ids: List[str]

class UserProfileCardResponse(BaseModel):
    user_id: str
    name: Optional[str] = "Employee"
    profile_photo: Optional[str] = None
    designation: Optional[str] = "N/A"
    department: Optional[str] = "N/A"
    system_role: Optional[str] = "Employee"
    email: Optional[str] = None
    phone: Optional[str] = None
    work_mode: Optional[str] = None
    is_online: bool = False
    last_seen: Optional[datetime] = None

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class MessageResponse(BaseModel):
    id: str = Field(alias="_id")
    channel_id: str
    sender_id: str
    content: Optional[str] = ""
    message_type: Optional[str] = "text"
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    poll: Optional[PollResponse] = None
    mentions: List[str] = []
    reply_to: Optional[ReplyToSummary] = None
    reactions: List[ReactionItem] = []
    is_forwarded: bool = False
    is_pinned: bool = False
    pinned_by: Optional[str] = None
    pinned_at: Optional[datetime] = None
    saved_by: List[str] = []
    is_saved: bool = False
    is_read_by: List[str] = []
    timestamp: datetime

    class Config:
        populate_by_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


