from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class CandidateOut(BaseModel):
    id: str
    employee_id: str
    name: str
    department: Optional[str] = None
    designation: Optional[str] = None
    avatar: Optional[str] = None

class ElectionCreate(BaseModel):
    title: str
    description: Optional[str] = None
    maxPreferences: int = Field(default=5, ge=1)
    candidate_employee_ids: List[str] = []
    electionMonth: Optional[str] = None
    electionYear: Optional[int] = None
    status: Optional[str] = "active"

class ElectionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    maxPreferences: Optional[int] = None
    candidate_employee_ids: Optional[List[str]] = None
    electionMonth: Optional[str] = None
    electionYear: Optional[int] = None
    status: Optional[str] = None

class ElectionOut(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    maxPreferences: int = 5
    electionMonth: Optional[str] = None
    electionYear: Optional[int] = None
    status: str = "active"
    candidates: List[CandidateOut] = []
    totalValidVotes: int = 0
    totalEligibleVoters: int = 0
    quota: Optional[int] = None
    winner_candidate_id: Optional[str] = None
    winner_name: Optional[str] = None
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None

class BallotSubmit(BaseModel):
    preferences: List[str]

class BallotOut(BaseModel):
    id: str
    electionId: str
    voterId: str
    voterName: Optional[str] = None
    preferences: List[str]
    isSubmitted: bool = True
    submittedAt: Optional[datetime] = None

class TransferredVote(BaseModel):
    fromCandidateId: str
    fromCandidateName: Optional[str] = None
    toCandidateId: str
    toCandidateName: Optional[str] = None
    count: int = 1

class ElectionRoundOut(BaseModel):
    id: str
    electionId: str
    roundNumber: int
    tally: Dict[str, Any]
    eliminatedCandidateIds: List[str] = []
    eliminatedCandidateNames: List[str] = []
    transferredVotes: List[Dict[str, Any]] = []
    winnerCandidateId: Optional[str] = None
    winnerName: Optional[str] = None
    quota: int
    timestamp: Optional[datetime] = None
