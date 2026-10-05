from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Dict, Any
from datetime import datetime

class GalleryEventCreate(BaseModel):
    event_name: str = Field(..., description="Name of event e.g. Annual Sports Day")
    date: Optional[str] = Field(None, description="Event date e.g. 05-10-2026")
    link: Optional[str] = Field(None, description="Drive link or album URL")

class GalleryEventUpdate(BaseModel):
    event_name: Optional[str] = None
    date: Optional[str] = None
    link: Optional[str] = None

class GalleryEventResponse(BaseModel):
    id: str = Field(alias="_id")
    event_name: str
    date: Optional[str] = None
    link: Optional[str] = None
    created_by: Optional[Dict[str, Any]] = None
    is_deleted: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(populate_by_name=True)
