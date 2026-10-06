from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime

class MediaItemSchema(BaseModel):
    file_id: Optional[str] = None
    name: Optional[str] = None
    media_type: str = Field(default="image", description="'image' or 'video'")
    url: str

class GalleryEventCreate(BaseModel):
    event_name: str = Field(..., description="Name of event e.g. Annual Sports Day")
    date: Optional[str] = Field(None, description="Event date e.g. 05-10-2026 or 2026-10-05")
    link: Optional[str] = Field(None, description="Drive link or album URL")
    images: Optional[List[str]] = Field(default=[], description="List of image URLs or drive links")
    media_items: Optional[List[MediaItemSchema]] = Field(default=[], description="Structured media items")

class GalleryEventUpdate(BaseModel):
    event_name: Optional[str] = None
    date: Optional[str] = None
    link: Optional[str] = None
    images: Optional[List[str]] = None
    media_items: Optional[List[MediaItemSchema]] = None

class GalleryEventResponse(BaseModel):
    id: str = Field(alias="_id")
    event_name: str
    date: Optional[str] = None
    link: Optional[str] = None
    images: Optional[List[str]] = Field(default=[])
    media_items: Optional[List[MediaItemSchema]] = Field(default=[])
    created_by: Optional[Dict[str, Any]] = None
    is_deleted: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(populate_by_name=True)

class GalleryPaginatedResponse(BaseModel):
    items: List[GalleryEventResponse]
    data: List[GalleryEventResponse]
    total: int
    page: int
    limit: int
    total_pages: int

    model_config = ConfigDict(populate_by_name=True)
