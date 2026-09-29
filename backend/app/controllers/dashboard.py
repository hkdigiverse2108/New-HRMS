from fastapi import APIRouter, Depends, Query
from typing import Optional
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
