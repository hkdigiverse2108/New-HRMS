from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime, date

ALLOWED_EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Internship"]

class HiringCreate(BaseModel):
    job_title: str = Field(..., description="Job Title e.g. Senior React Developer")
    department: str = Field(..., description="Department e.g. Development, Design, HR")
    location: str = Field(..., description="Location e.g. Surat, Remote")
    employment_type: str = Field(..., description="Employment Type e.g. Full-time, Part-time, Internship")
    status: str = Field("Open", description="Job status: Open, Closed, Draft")
    applications_count: int = Field(0, ge=0, description="Count of applications received e.g. 0")
    posted_date: Optional[str] = Field(None, description="Date when job was posted e.g. 06-10-2026 or 2026-10-06")
    experience: Optional[str] = Field(None, description="Required experience e.g. 2-4 years")
    salary_range: Optional[str] = Field(None, description="Offered salary range e.g. $80k - $100k or 15L - 20L")
    job_description: Optional[str] = Field(None, description="Detailed job description and requirements")
    description: Optional[str] = Field(None, description="Alternative field for job description")
    hiring_manager_id: Optional[str] = Field(None, description="Employee ID selected as Hiring Manager")

    @field_validator("employment_type")
    @classmethod
    def validate_employment_type(cls, v: str) -> str:
        clean = (v or "").strip()
        clean_normalized = clean.replace(" ", "-")
        if clean.lower() == "contract":
            raise ValueError("Employment type 'Contract' is disabled. Valid options are: Full-time, Part-time, Internship")
        
        for allowed in ALLOWED_EMPLOYMENT_TYPES:
            if allowed.lower() == clean.lower() or allowed.lower() == clean_normalized.lower():
                return allowed

        raise ValueError(f"Invalid employment type '{v}'. Allowed options: {', '.join(ALLOWED_EMPLOYMENT_TYPES)}")

class HiringUpdate(BaseModel):
    job_title: Optional[str] = None
    department: Optional[str] = None
    location: Optional[str] = None
    employment_type: Optional[str] = None
    status: Optional[str] = None
    applications_count: Optional[int] = None
    posted_date: Optional[str] = None
    experience: Optional[str] = None
    salary_range: Optional[str] = None
    job_description: Optional[str] = None
    description: Optional[str] = None
    hiring_manager_id: Optional[str] = None

    @field_validator("employment_type")
    @classmethod
    def validate_employment_type(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        clean = (v or "").strip()
        clean_normalized = clean.replace(" ", "-")
        if clean.lower() == "contract":
            raise ValueError("Employment type 'Contract' is disabled. Valid options are: Full-time, Part-time, Internship")

        for allowed in ALLOWED_EMPLOYMENT_TYPES:
            if allowed.lower() == clean.lower() or allowed.lower() == clean_normalized.lower():
                return allowed

        raise ValueError(f"Invalid employment type '{v}'. Allowed options: {', '.join(ALLOWED_EMPLOYMENT_TYPES)}")

class HiringManagerOption(BaseModel):
    employee_id: str
    full_name: str
    email: Optional[str] = ""
    department: Optional[str] = ""
    designation: Optional[str] = ""
    profile_picture: Optional[str] = ""

class HiringResponse(BaseModel):
    id: str = Field(alias="_id")
    job_title: str
    department: str
    location: str
    employment_type: str
    status: str = "Open"
    applications_count: int = 0
    posted_date: Optional[str] = None
    experience: Optional[str] = None
    salary_range: Optional[str] = None
    job_description: Optional[str] = None
    hiring_manager: Optional[Dict[str, Any]] = None
    created_by: Optional[Dict[str, Any]] = None
    is_deleted: bool = False
    created_at: datetime
    updated_at: datetime
    referrals: Optional[List[Dict[str, Any]]] = None

    model_config = ConfigDict(populate_by_name=True)

class ReferralCreate(BaseModel):
    hiring_id: Optional[str] = Field(None, description="Job Posting MongoDB ObjectId e.g. 6ac48dbd462f259ea1313d7e")
    candidate_name: str = Field(..., description="Candidate Full Name e.g. John Doe")
    candidate_email: str = Field(..., description="Candidate Email Address e.g. john@example.com")
    linkedin_profile: Optional[str] = Field(None, description="LinkedIn Profile URL (optional)")
    resume_url: Optional[str] = Field(None, description="Resume / CV File Path or URL")
    why_good_fit: Optional[str] = Field(None, description="Why are they a good fit for this role?")
    hr_notes: Optional[str] = Field(None, description="Internal notes by HR")

class ReferralUpdate(BaseModel):
    candidate_name: Optional[str] = None
    candidate_email: Optional[str] = None
    linkedin_profile: Optional[str] = None
    resume_url: Optional[str] = None
    why_good_fit: Optional[str] = None
    status: Optional[str] = Field(None, description="Status e.g. Pending, Contacted, Screening, Technical...")
    hr_notes: Optional[str] = None

class ReferralResponse(BaseModel):
    id: str = Field(alias="_id")
    hiring_id: str
    job_title: str
    department: str
    candidate_name: str
    candidate_email: str
    linkedin_profile: Optional[str] = None
    resume_url: Optional[str] = None
    why_good_fit: Optional[str] = None
    status: str = "Pending"
    hr_notes: Optional[str] = None
    referred_by: Optional[Dict[str, Any]] = None
    is_deleted: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(populate_by_name=True)

class DashboardStat(BaseModel):
    count: int
    trend_text: str

class HiringDashboardResponse(BaseModel):
    active_jobs: DashboardStat
    total_applicants: DashboardStat
    interviews_scheduled: DashboardStat
    offers_extended: DashboardStat
