from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime

class InterviewStageCreate(BaseModel):
    name: str = Field(..., description="Name of the interview stage e.g., Screening, Technical")

class InterviewStageUpdate(BaseModel):
    name: Optional[str] = None

class InterviewStageResponse(BaseModel):
    id: str = Field(alias="_id")
    name: str
    is_deleted: bool = False
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(populate_by_name=True)

class InterviewScheduleCreate(BaseModel):
    candidate_name: str = Field(..., description="Candidate Name")
    role_position: str = Field(..., description="Job posting title or 'General Application'")
    hiring_id: Optional[str] = Field(None, description="Linked hiring_id, if not General Application")
    referral_id: Optional[str] = Field(None, description="Linked referral_id")
    interview_stage_id: str = Field(..., description="ID of the interview stage")
    interview_stage_name: str = Field(..., description="Name of the interview stage")
    date: Optional[str] = Field(None, description="Date of interview, e.g., Aug 15 or 2026-08-15")
    time: Optional[str] = Field(None, description="Time of interview, e.g., 2:00 PM")
    interviewer_name: Optional[str] = Field(None, description="Name of the interviewer")
    notes: Optional[str] = None

class InterviewScheduleUpdate(BaseModel):
    candidate_name: Optional[str] = None
    role_position: Optional[str] = None
    hiring_id: Optional[str] = None
    referral_id: Optional[str] = None
    interview_stage_id: Optional[str] = None
    interview_stage_name: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    interviewer_name: Optional[str] = None
    notes: Optional[str] = None

class InterviewScheduleResponse(BaseModel):
    id: str = Field(alias="_id")
    candidate_name: str
    role_position: str
    hiring_id: Optional[str] = None
    referral_id: Optional[str] = None
    interview_stage_id: str
    interview_stage_name: str
    date: Optional[str] = None
    time: Optional[str] = None
    interviewer_name: Optional[str] = None
    notes: Optional[str] = None
    created_by: Optional[Dict[str, Any]] = None
    is_deleted: bool = False
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(populate_by_name=True)
