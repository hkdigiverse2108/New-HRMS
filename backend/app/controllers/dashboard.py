from fastapi import APIRouter, Depends, Query, HTTPException, status
from typing import Optional, List
from pydantic import BaseModel
from app.services.dashboard import DashboardService
from app.controllers.auth import get_current_employee

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/overview")
async def get_dashboard_overview(
    month: Optional[int] = Query(None, ge=1, le=12, description="Month (1-12), default current"),
    year: Optional[int] = Query(None, ge=2000, le=2100, description="Year, default current"),
    current_user: dict = Depends(get_current_employee),
):
    user_id = str(current_user.get("_id") or current_user.get("id"))
    return await DashboardService.get_overview(user_id, month=month, year=year)


class EomWinnerIn(BaseModel):
    employee_id: str
    employee_name: Optional[str] = ""
    rank: int = 1
    score_pct: float = 0


class EomMonthIn(BaseModel):
    month: int
    year: int
    winners: List[EomWinnerIn] = []


def _is_admin(user: dict) -> bool:
    role = str(user.get("work_details", {}).get("system_role", "")).lower()
    return role in ("admin", "super admin", "superadmin") or str(user.get("_id") or user.get("id")) == "default-admin-id"


@router.post("/eom", status_code=status.HTTP_201_CREATED)
async def set_eom_winners(data: EomMonthIn, current_user: dict = Depends(get_current_employee)):
    """Admin sets Employee-of-Month winners (Top-5 source for dashboard)."""
    if not _is_admin(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    from app.database.db import get_database
    db = get_database()
    await db["eom_winners"].delete_many({"month": data.month, "year": data.year})
    docs = [{
        "month": data.month,
        "year": data.year,
        "rank": w.rank,
        "employee_id": w.employee_id,
        "employee_name": w.employee_name or "",
        "score_pct": w.score_pct,
    } for w in data.winners]
    if docs:
        await db["eom_winners"].insert_many(docs)
    try:
        from app.redis.service import clear_pattern
        await clear_pattern("dashboard:overview:*")
    except Exception:
        pass
    return {"month": data.month, "year": data.year, "count": len(docs)}


@router.get("/eom/latest")
async def get_eom_latest(current_user: dict = Depends(get_current_employee)):
    from app.database.db import get_database
    db = get_database()
    out: list = []
    try:
        cursor = db["eom_winners"].find({}).sort([("year", -1), ("month", -1)]).limit(12)
        async for doc in cursor:
            out.append({
                "month": doc.get("month"),
                "year": doc.get("year"),
                "rank": doc.get("rank"),
                "employee_id": str(doc.get("employee_id") or ""),
                "employee_name": doc.get("employee_name") or "Employee",
                "score_pct": doc.get("score_pct") or 0,
            })
    except Exception:
        pass
    return {"winners": out}
