from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Dict, Any, Optional
from app.schemas.hiring import HiringCreate, HiringUpdate, HiringResponse, HiringManagerOption, HiringDashboardResponse
from app.schemas.pagination import PaginatedResponse
from app.services.hiring import HiringService
from app.controllers.auth import get_current_employee

router = APIRouter(prefix="/hirings", tags=["Hirings & Recruitment Management"])

@router.get("/employment-types", response_model=List[str])
async def get_employment_types():
    """
    Get hardcoded list of allowed employment types.
    Contract has been explicitly removed as per system requirements.
    Allowed: ['Full-time', 'Part-time', 'Internship']
    """
    return await HiringService.get_employment_types()

@router.get("/managers", response_model=List[HiringManagerOption])
async def get_hiring_managers(
    current_user: dict = Depends(get_current_employee)
):
    """
    Get dropdown list of all active employees to select as Hiring Manager.
    Returns employee_id, full_name, email, department, designation, profile_picture.
    """
    return await HiringService.get_hiring_managers(current_user)

@router.get("/dashboard/summary", response_model=HiringDashboardResponse)
async def get_hiring_dashboard_summary(
    current_user: dict = Depends(get_current_employee)
):
    """
    Get the top metrics for the hiring dashboard:
    Active Jobs, Total Applicants, Interviews Scheduled, Offers Extended.
    """
    return await HiringService.get_dashboard_summary(current_user)

@router.post("", response_model=HiringResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=HiringResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
async def create_hiring(
    data: HiringCreate,
    current_user: dict = Depends(get_current_employee)
):
    """
    Post a new job requirement (Add Hiring).
    Supported Fields: job_title, department, location, employment_type, status, applications_count, posted_date, experience, salary_range, job_description, hiring_manager_id.
    """
    return await HiringService.create_hiring(data, current_user)

@router.get("", response_model=PaginatedResponse[HiringResponse])
@router.get("/", response_model=PaginatedResponse[HiringResponse], include_in_schema=False)
async def get_all_hirings(
    department: Optional[str] = Query(None, description="Filter by department"),
    employment_type: Optional[str] = Query(None, description="Filter by employment type"),
    status: Optional[str] = Query(None, description="Filter by status e.g. Active, Closed, Draft"),
    search: Optional[str] = Query(None, description="Search by job title, department, location"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(100, ge=1, description="Items per page"),
    current_user: dict = Depends(get_current_employee)
):
    """
    Get list of all job postings with pagination and optional filters.
    """
    return await HiringService.get_all_hirings(
        current_user=current_user,
        department=department,
        employment_type=employment_type,
        status_val=status,
        search=search,
        page=page,
        limit=limit
    )

@router.get("/{hiring_id}", response_model=HiringResponse)
async def get_hiring_by_id(
    hiring_id: str,
    current_user: dict = Depends(get_current_employee)
):
    """Get single job posting details by ID."""
    return await HiringService.get_hiring_by_id(hiring_id, current_user)

@router.put("/{hiring_id}", response_model=HiringResponse)
async def update_hiring(
    hiring_id: str,
    data: HiringUpdate,
    current_user: dict = Depends(get_current_employee)
):
    """Update job posting details (Update Hiring)."""
    return await HiringService.update_hiring(hiring_id, data, current_user)

@router.delete("/{hiring_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_hiring(
    hiring_id: str,
    current_user: dict = Depends(get_current_employee)
):
    """Delete a job posting (Soft delete)."""
    success = await HiringService.delete_hiring(hiring_id, current_user)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to delete job posting")

# ==================== REFER A FRIEND (JOB REFERRALS) ====================

from app.schemas.hiring import ReferralCreate, ReferralUpdate, ReferralResponse
from fastapi import UploadFile, File
import shutil
import uuid
from pathlib import Path
from app.config import ROOT_DIR

@router.post("/referrals/upload-resume", response_model=Dict[str, Any])
async def upload_candidate_resume(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_employee)
):
    """
    Upload a candidate resume / CV file (PDF, DOC, DOCX, PNG, JPG).
    Saves file inside ROOT_DIR / 'uploads' / 'resumes' and returns relative file URL.
    """
    ext = Path(file.filename or "").suffix.lower()
    allowed_exts = {".pdf", ".doc", ".docx", ".png", ".jpg", ".jpeg"}
    if ext not in allowed_exts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid resume format. Allowed formats: {', '.join(sorted(allowed_exts))}"
        )

    target_dir = ROOT_DIR / "uploads" / "resumes"
    target_dir.mkdir(parents=True, exist_ok=True)

    filename = f"resume_{uuid.uuid4().hex[:12]}{ext}"
    dest_path = target_dir / filename

    try:
        with open(dest_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save resume file: {str(e)}"
        )
    finally:
        file.file.close()

    relative_url = f"/uploads/resumes/{filename}"
    return {
        "url": relative_url,
        "resume_url": relative_url,
        "filename": filename
    }

@router.post("/{hiring_id}/referrals", response_model=ReferralResponse, status_code=status.HTTP_201_CREATED)
async def create_referral_for_job(
    hiring_id: str,
    data: ReferralCreate,
    current_user: dict = Depends(get_current_employee)
):
    """
    Submit a 'Refer a Friend' candidate referral for a specific job posting.
    Auto-increments applications_count on the associated job posting.
    """
    return await HiringService.create_referral(hiring_id, data, current_user)

@router.post("/referrals", response_model=ReferralResponse, status_code=status.HTTP_201_CREATED)
async def create_referral_direct(
    data: ReferralCreate,
    current_user: dict = Depends(get_current_employee)
):
    """
    Submit a 'Refer a Friend' candidate referral passing hiring_id in JSON body.
    """
    return await HiringService.create_referral(None, data, current_user)

@router.get("/referrals", response_model=List[ReferralResponse])
async def get_all_referrals(
    hiring_id: Optional[str] = Query(None, description="Filter referrals by job posting ID"),
    status: Optional[str] = Query(None, description="Filter by status e.g. Pending, Reviewed, Shortlisted, Hired"),
    search: Optional[str] = Query(None, description="Search candidate name, email, or job title"),
    current_user: dict = Depends(get_current_employee)
):
    """
    Get referrals list.
    Admin / HR users see ALL referrals across all employees.
    Normal employees see ONLY their own submitted referrals.
    """
    return await HiringService.get_all_referrals(
        current_user=current_user,
        hiring_id=hiring_id,
        status_val=status,
        search=search
    )

@router.get("/{hiring_id}/referrals", response_model=List[ReferralResponse])
async def get_job_referrals(
    hiring_id: str,
    status: Optional[str] = Query(None, description="Filter by status"),
    search: Optional[str] = Query(None, description="Search candidate name or email"),
    current_user: dict = Depends(get_current_employee)
):
    """
    Get referrals list for a specific job posting ID.
    Admin / HR users see ALL referrals. Normal employees see ONLY their own.
    """
    return await HiringService.get_all_referrals(
        current_user=current_user,
        hiring_id=hiring_id,
        status_val=status,
        search=search
    )

@router.get("/referrals/{referral_id}", response_model=ReferralResponse)
async def get_referral_by_id(
    referral_id: str,
    current_user: dict = Depends(get_current_employee)
):
    """Get single referral details by ID."""
    return await HiringService.get_referral_by_id(referral_id, current_user)

@router.put("/referrals/{referral_id}", response_model=ReferralResponse)
async def update_referral(
    referral_id: str,
    data: ReferralUpdate,
    current_user: dict = Depends(get_current_employee)
):
    """Update candidate referral details or status."""
    return await HiringService.update_referral(referral_id, data, current_user)

@router.delete("/referrals/{referral_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_referral(
    referral_id: str,
    current_user: dict = Depends(get_current_employee)
):
    """Delete candidate referral (Soft delete). Auto-decrements applications_count on associated job posting."""
    success = await HiringService.delete_referral(referral_id, current_user)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to delete referral")
