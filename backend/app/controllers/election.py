from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional, List, Dict, Any
from app.schemas.election import (
    ElectionCreate,
    ElectionOut,
    BallotSubmit,
    BallotOut,
    ElectionRoundOut
)
from app.repository.election import ElectionRepository
from app.controllers.auth import get_current_employee

router = APIRouter(prefix="/elections", tags=["Elections & Voting"])

def is_admin_or_hr(employee: dict) -> bool:
    if not employee:
        return False
    work = employee.get("work_details", {})
    role = str(work.get("system_role") or employee.get("role", "Employee")).lower().strip()
    dept = str(work.get("department") or employee.get("department", "")).lower().strip()
    if role in ["admin", "superadmin", "subadmin", "sub-admin", "administrator", "founder"]:
        return True
    if dept == "hr" or role in ["hr", "hr manager"]:
        return True
    return False

@router.post("", response_model=ElectionOut)
async def create_election(
    data: ElectionCreate,
    current_employee: dict = Depends(get_current_employee)
):
    if not is_admin_or_hr(current_employee):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Administrators or HR can create elections."
        )
    user_id = str(current_employee.get("_id") or current_employee.get("id"))
    election = await ElectionRepository.create_election(data, user_id)
    return election

@router.get("", response_model=List[ElectionOut])
async def list_elections(
    month: Optional[str] = Query(None),
    year: Optional[int] = Query(None),
    current_employee: dict = Depends(get_current_employee)
):
    return await ElectionRepository.get_elections(month=month, year=year)

@router.get("/{election_id}", response_model=ElectionOut)
async def get_election(
    election_id: str,
    current_employee: dict = Depends(get_current_employee)
):
    election = await ElectionRepository.get_election_by_id(election_id)
    if not election:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Election not found.")
    return election

@router.delete("/{election_id}")
async def delete_election(
    election_id: str,
    current_employee: dict = Depends(get_current_employee)
):
    if not is_admin_or_hr(current_employee):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Administrators or HR can delete elections."
        )
    deleted = await ElectionRepository.soft_delete_election(election_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Election not found or already deleted.")
    return {"message": "Election deleted successfully."}

@router.post("/{election_id}/ballots")
async def submit_ballot(
    election_id: str,
    data: BallotSubmit,
    current_employee: dict = Depends(get_current_employee)
):
    voter_id = str(current_employee.get("_id") or current_employee.get("id"))
    try:
        ballot = await ElectionRepository.submit_ballot(election_id, voter_id, data.preferences)
        return {"message": "Vote submitted successfully.", "ballot": ballot}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.get("/{election_id}/my-ballot")
async def get_my_ballot(
    election_id: str,
    current_employee: dict = Depends(get_current_employee)
):
    voter_id = str(current_employee.get("_id") or current_employee.get("id"))
    ballot = await ElectionRepository.get_voter_ballot(election_id, voter_id)
    return ballot or {"isSubmitted": False, "preferences": []}

@router.post("/{election_id}/run")
async def run_election_stv(
    election_id: str,
    current_employee: dict = Depends(get_current_employee)
):
    if not is_admin_or_hr(current_employee):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Administrators or HR can run STV calculation."
        )
    try:
        result = await ElectionRepository.run_stv_round_calculation(election_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.get("/{election_id}/rounds", response_model=List[ElectionRoundOut])
async def get_election_rounds(
    election_id: str,
    current_employee: dict = Depends(get_current_employee)
):
    return await ElectionRepository.get_election_rounds_history(election_id)

@router.get("/{election_id}/result", response_model=ElectionOut)
async def get_election_result(
    election_id: str,
    current_employee: dict = Depends(get_current_employee)
):
    election = await ElectionRepository.get_election_by_id(election_id)
    if not election:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Election not found.")
    return election

@router.get("/{election_id}/voter-ballots")
async def get_voter_ballots_admin(
    election_id: str,
    current_employee: dict = Depends(get_current_employee)
):
    if not is_admin_or_hr(current_employee):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Administrators or HR can view voter ballots audit."
        )
    return await ElectionRepository.get_admin_voter_ballots(election_id)
