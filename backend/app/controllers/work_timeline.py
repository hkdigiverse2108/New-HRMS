from typing import Optional
from fastapi import APIRouter, Depends, Query

from app.controllers.auth import get_current_employee
from app.services.work_timeline import WorkTimelineService
from app.redis.service import get_cache, set_cache, make_list_key

router = APIRouter(prefix="/work-logs", tags=["Work Logs"])


@router.get("/timeline")
async def get_work_timeline(
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD (defaults to 6 days before end_date)"),
    end_date: Optional[str] = Query(None, description="YYYY-MM-DD (defaults to today)"),
    employee_id: Optional[str] = Query(None, description="Admin / HR only: one employee"),
    current_user: dict = Depends(get_current_employee),
):
    """Tasks worked on with their time, from punch-in and Change Active Task. Employees see only their own."""
    uid = str(current_user.get("_id", ""))
    cache_key = make_list_key("work_timeline", uid=uid, start_date=start_date, end_date=end_date, employee_id=employee_id)
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached
    res = await WorkTimelineService.list(current_user, start_date, end_date, employee_id)
    await set_cache(cache_key, res, ttl=60)
    return res
