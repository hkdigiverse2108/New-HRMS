from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from typing import Optional, List, Dict, Any
from app.services import eom_service
from app.controllers.auth import get_current_employee
from app.redis.service import get_cache, set_cache, clear_pattern, make_list_key

router = APIRouter(tags=["Employee of the Month & Weekly Team Leader"])

def is_admin_or_hr(employee: dict) -> bool:
    if not employee:
        return True
    work = employee.get("work_details", {})
    role = str(work.get("system_role") or employee.get("role", "Employee")).lower().strip()
    dept = str(work.get("department") or employee.get("department", "")).lower().strip()
    if role in ["admin", "super admin", "superadmin", "subadmin", "sub-admin", "administrator", "founder"]:
        return True
    if dept == "hr" or role in ["hr", "hr manager"]:
        return True
    return False

def get_actor_info(employee: dict) -> tuple[str, str]:
    if not employee:
        return "admin-id", "Admin Admin"
    emp_id = str(employee.get("_id") or employee.get("id", "admin-id"))
    pi = employee.get("personal_info") or {}
    fn = pi.get("first_name", "")
    ln = pi.get("last_name", "")
    if fn:
        name = f"{fn} {ln}".strip()
    else:
        name = employee.get("name") or "Admin Admin"
    return emp_id, name

# --- MASTER CRITERIA ---
@router.get("/eom/master-criteria")
async def get_eom_master_criteria_endpoint(current_employee: dict = Depends(get_current_employee)):
    cache_key = "eom:master_criteria"
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached
    res = await eom_service.get_or_init_master_criteria()
    await set_cache(cache_key, res)
    return res

@router.post("/eom/master-criteria")
async def save_eom_master_criteria_endpoint(
    request: Request,
    current_employee: dict = Depends(get_current_employee)
):
    if not is_admin_or_hr(current_employee):
        raise HTTPException(status_code=403, detail="Only Admin or HR can manage EOM master template.")
    data = await request.json()
    criteria_list = data.get("criteria", [])
    res = await eom_service.save_master_criteria(criteria_list)
    await clear_pattern("eom*")
    return res

# --- MONTH HISTORY & CRITERIA ---
@router.get("/eom/month-history")
async def get_eom_month_history_endpoint(current_employee: dict = Depends(get_current_employee)):
    cache_key = "eom:month_history"
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached
    res = await eom_service.get_eom_month_history()
    await set_cache(cache_key, res)
    return res

@router.get("/eom/criteria")
async def get_eom_criteria_endpoint(
    month_year: str = Query(...),
    current_employee: dict = Depends(get_current_employee)
):
    try:
        cache_key = f"eom:criteria:{month_year}"
        cached = await get_cache(cache_key)
        if cached is not None:
            return cached
        res = await eom_service.get_or_init_criteria(month_year)
        await set_cache(cache_key, res)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/eom/criteria")
async def save_eom_criteria_endpoint(
    request: Request,
    current_employee: dict = Depends(get_current_employee)
):
    if not is_admin_or_hr(current_employee):
        raise HTTPException(status_code=403, detail="Only Admin or HR can manage EOM criteria.")
    data = await request.json()
    month_year = data.get("month_year")
    criteria_list = data.get("criteria", [])
    if not month_year:
        raise HTTPException(status_code=400, detail="month_year is required")
    try:
        res = await eom_service.save_criteria(month_year, criteria_list)
        await clear_pattern("eom*")
        return res
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/eom/clone-criteria")
async def clone_eom_criteria_endpoint(
    request: Request,
    current_employee: dict = Depends(get_current_employee)
):
    if not is_admin_or_hr(current_employee):
        raise HTTPException(status_code=403, detail="Only Admin or HR can clone criteria.")
    data = await request.json()
    from_month = data.get("from_month_year")
    to_month = data.get("to_month_year")
    if not from_month or not to_month:
        raise HTTPException(status_code=400, detail="from_month_year and to_month_year are required")
    res = await eom_service.clone_criteria(from_month, to_month)
    await clear_pattern("eom*")
    return res

# --- MONTH CONFIG & REVEAL SCHEDULE ---
@router.get("/eom/month-config")
async def get_eom_month_config_endpoint(
    month_year: str = Query(...),
    current_employee: dict = Depends(get_current_employee)
):
    cache_key = f"eom:month_config:{month_year}"
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached
    res = await eom_service.get_month_config(month_year)
    await set_cache(cache_key, res)
    return res

@router.post("/eom/month-config")
async def save_eom_month_config_endpoint(
    request: Request,
    current_employee: dict = Depends(get_current_employee)
):
    if not is_admin_or_hr(current_employee):
        raise HTTPException(status_code=403, detail="Only Admin or HR can configure participating employees.")
    data = await request.json()
    month_year = data.get("month_year")
    selected_employee_ids = data.get("selectedEmployeeIds", [])
    if not month_year:
        raise HTTPException(status_code=400, detail="month_year is required")
    res = await eom_service.save_month_config(month_year, selected_employee_ids)
    await clear_pattern("eom*")
    return res

@router.post("/eom/reveal-schedule")
async def save_eom_reveal_schedule_endpoint(
    request: Request,
    current_employee: dict = Depends(get_current_employee)
):
    if not is_admin_or_hr(current_employee):
        raise HTTPException(status_code=403, detail="Only Admin or HR can schedule reveal time.")
    data = await request.json()
    month_year = data.get("month_year")
    reveal_date_time = data.get("revealDateTime")
    if not month_year:
        raise HTTPException(status_code=400, detail="month_year is required")
    res = await eom_service.save_month_config(month_year, reveal_date_time=reveal_date_time)
    await clear_pattern("eom*")
    return res

# --- SCORES & LEADERBOARD ---
@router.post("/eom/scores")
async def save_eom_score_endpoint(
    request: Request,
    current_employee: dict = Depends(get_current_employee)
):
    data = await request.json()
    month_year = data.get("month_year")
    criteria_id = data.get("criteriaId")
    employee_id = data.get("employeeId")
    score = data.get("score")
    raw_quantity = data.get("rawQuantity")
    calculated_rank = data.get("calculatedRank")
    
    if not month_year or not criteria_id or not employee_id or score is None:
        raise HTTPException(status_code=400, detail="Missing required score fields")

    actor_id, actor_name = get_actor_info(current_employee)
    res = await eom_service.save_score(
        month_year=month_year,
        criteria_id=criteria_id,
        employee_id=employee_id,
        score=score,
        raw_quantity=raw_quantity,
        calculated_rank=calculated_rank,
        scored_by=actor_name,
        evaluator_id=actor_id
    )
    await clear_pattern("eom*")
    return res

@router.post("/eom/bulk-scores")
async def save_eom_bulk_scores_endpoint(
    request: Request,
    current_employee: dict = Depends(get_current_employee)
):
    data = await request.json()
    month_year = data.get("month_year")
    criteria_id = data.get("criteriaId")
    category_type = data.get("categoryType", "+ve")
    max_score = float(data.get("maxScore", 10.0))
    entries = data.get("entries", [])
    
    if not month_year or not criteria_id:
        raise HTTPException(status_code=400, detail="Missing month_year or criteriaId")

    actor_id, actor_name = get_actor_info(current_employee)
    res = await eom_service.bulk_save_hybrid_scores(
        month_year=month_year,
        criteria_id=criteria_id,
        category_type=category_type,
        max_score=max_score,
        entries=entries,
        scored_by=actor_name
    )
    await clear_pattern("eom*")
    return res

@router.post("/eom/save-all-matrix")
async def save_eom_all_matrix_endpoint(
    request: Request,
    current_employee: dict = Depends(get_current_employee)
):
    data = await request.json()
    month_year = data.get("month_year")
    scores_list = data.get("scores", [])
    if not month_year or not isinstance(scores_list, list):
        raise HTTPException(status_code=400, detail="month_year and scores list are required")

    actor_id, actor_name = get_actor_info(current_employee)
    res = await eom_service.bulk_save_all_matrix(
        month_year=month_year,
        scores_list=scores_list,
        scored_by=actor_name,
        evaluator_id=actor_id
    )
    await clear_pattern("eom*")
    return res

@router.get("/eom/scores")
async def get_eom_scores_endpoint(
    month_year: str = Query(...),
    criteriaId: Optional[str] = Query(None),
    scoredBy: Optional[str] = Query(None),
    current_employee: dict = Depends(get_current_employee)
):
    cache_key = make_list_key("eom_scores", month_year=month_year, criteriaId=criteriaId, scoredBy=scoredBy)
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached
    res = await eom_service.get_scores(month_year, criteriaId, scored_by=scoredBy)
    await set_cache(cache_key, res)
    return res

@router.get("/eom/leaderboard")
async def get_eom_leaderboard_endpoint(
    month_year: str = Query(...),
    current_employee: dict = Depends(get_current_employee)
):
    cache_key = f"eom:leaderboard:{month_year}"
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached
    res = await eom_service.calculate_eom_leaderboard(month_year)
    await set_cache(cache_key, res, ttl=120)
    return res

@router.get("/eom/reveal-order")
async def get_eom_reveal_order_endpoint(
    month_year: str = Query(...),
    current_employee: dict = Depends(get_current_employee)
):
    cache_key = f"eom:reveal_order:{month_year}"
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached
    res = await eom_service.get_eom_reveal_order(month_year)
    await set_cache(cache_key, res, ttl=120)
    return res

# --- AUTO STATS ---
@router.get("/eom/attendance-stats")
async def get_eom_attendance_stats_endpoint(
    month_year: str = Query(...),
    maxScore: float = Query(15.0),
    current_employee: dict = Depends(get_current_employee)
):
    cache_key = make_list_key("eom_att_stats", month_year=month_year, maxScore=maxScore)
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached
    res = await eom_service.get_eom_attendance_stats(month_year, maxScore)
    await set_cache(cache_key, res, ttl=120)
    return res

@router.get("/eom/discipline-stats")
async def get_eom_discipline_stats_endpoint(
    month_year: str = Query(...),
    maxScore: float = Query(10.0),
    current_employee: dict = Depends(get_current_employee)
):
    cache_key = make_list_key("eom_disc_stats", month_year=month_year, maxScore=maxScore)
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached
    res = await eom_service.get_eom_discipline_stats(month_year, maxScore)
    await set_cache(cache_key, res, ttl=120)
    return res

@router.get("/eom/work-completion-stats")
async def get_eom_work_completion_stats_endpoint(
    month_year: str = Query(...),
    maxScore: float = Query(10.0),
    current_employee: dict = Depends(get_current_employee)
):
    cache_key = make_list_key("eom_wc_stats", month_year=month_year, maxScore=maxScore)
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached
    res = await eom_service.get_eom_work_completion_stats(month_year, maxScore)
    await set_cache(cache_key, res, ttl=120)
    return res

@router.get("/eom/work-dedication-stats")
async def get_eom_work_dedication_stats_endpoint(
    month_year: str = Query(...),
    maxScore: float = Query(10.0),
    current_employee: dict = Depends(get_current_employee)
):
    cache_key = make_list_key("eom_wd_stats", month_year=month_year, maxScore=maxScore)
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached
    res = await eom_service.get_eom_work_dedication_stats(month_year, maxScore)
    await set_cache(cache_key, res, ttl=120)
    return res

@router.get("/eom/vote-stats")
async def get_eom_vote_stats_endpoint(
    month_year: str = Query(...),
    maxScore: float = Query(10.0),
    current_employee: dict = Depends(get_current_employee)
):
    cache_key = make_list_key("eom_vote_stats", month_year=month_year, maxScore=maxScore)
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached
    res = await eom_service.get_eom_vote_stats(month_year, maxScore)
    await set_cache(cache_key, res, ttl=120)
    return res

# --- WEEKLY MEETINGS & TEAM LEADER OF THE WEEK ---
@router.get("/weekly-meetings/master-topics")
async def get_weekly_master_topics_endpoint(current_employee: dict = Depends(get_current_employee)):
    cache_key = "weekly_meetings:master_topics"
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached
    res = await eom_service.get_weekly_master_topics()
    await set_cache(cache_key, res)
    return res

@router.post("/weekly-meetings/master-topics")
async def save_weekly_master_topics_endpoint(
    request: Request,
    current_employee: dict = Depends(get_current_employee)
):
    if not is_admin_or_hr(current_employee):
        raise HTTPException(status_code=403, detail="Only Admin or HR can configure master topics.")
    data = await request.json()
    topics = data.get("topics", [])
    res = await eom_service.save_weekly_master_topics(topics)
    await clear_pattern("weekly_meetings*")
    return res

@router.get("/weekly-meetings")
async def get_weekly_meetings_endpoint(current_employee: dict = Depends(get_current_employee)):
    cache_key = "weekly_meetings:list"
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached
    res = await eom_service.get_weekly_meetings()
    await set_cache(cache_key, res)
    return res

@router.post("/weekly-meetings")
async def create_weekly_meeting_endpoint(
    request: Request,
    current_employee: dict = Depends(get_current_employee)
):
    if not is_admin_or_hr(current_employee):
        raise HTTPException(status_code=403, detail="Only Admin or HR can create weekly meetings.")
    data = await request.json()
    meeting_date = data.get("meetingDate")
    participant_ids = data.get("participantEmployeeIds", [])
    copy_from_id = data.get("copyFromMeetingId")
    if not meeting_date:
        raise HTTPException(status_code=400, detail="meetingDate is required")
    try:
        res = await eom_service.create_weekly_meeting(meeting_date, participant_ids, copy_from_id)
        await clear_pattern("weekly_meetings*")
        return res
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

@router.get("/weekly-meetings/{meeting_id}")
async def get_weekly_meeting_detail_endpoint(
    meeting_id: str,
    current_employee: dict = Depends(get_current_employee)
):
    cache_key = f"weekly_meetings:detail:{meeting_id}"
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached
    detail = await eom_service.get_weekly_meeting_detail(meeting_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Meeting not found")
    await set_cache(cache_key, detail)
    return detail

@router.delete("/weekly-meetings/{meeting_id}")
async def delete_weekly_meeting_endpoint(
    meeting_id: str,
    current_employee: dict = Depends(get_current_employee)
):
    if not is_admin_or_hr(current_employee):
        raise HTTPException(status_code=403, detail="Only Admin or HR can delete weekly meetings.")
    ok = await eom_service.delete_weekly_meeting(meeting_id)
    await clear_pattern("weekly_meetings*")
    return {"success": ok}

@router.put("/weekly-meetings/{meeting_id}/participants")
async def update_weekly_participants_endpoint(
    meeting_id: str,
    request: Request,
    current_employee: dict = Depends(get_current_employee)
):
    if not is_admin_or_hr(current_employee):
        raise HTTPException(status_code=403, detail="Only Admin or HR can update meeting participants.")
    data = await request.json()
    participant_ids = data.get("participantEmployeeIds", [])
    ok = await eom_service.update_weekly_participants(meeting_id, participant_ids)
    await clear_pattern("weekly_meetings*")
    return {"success": ok}

@router.put("/weekly-meetings/{meeting_id}/topics")
async def save_weekly_topics_endpoint(
    meeting_id: str,
    request: Request,
    current_employee: dict = Depends(get_current_employee)
):
    if not is_admin_or_hr(current_employee):
        raise HTTPException(status_code=403, detail="Only Admin or HR can edit topics.")
    data = await request.json()
    topics = data.get("topics", [])
    res = await eom_service.save_weekly_topics(meeting_id, topics)
    await clear_pattern("weekly_meetings*")
    return res

@router.post("/weekly-meetings/{meeting_id}/entries")
async def save_weekly_entries_endpoint(
    meeting_id: str,
    request: Request,
    current_employee: dict = Depends(get_current_employee)
):
    data = await request.json()
    entries = data.get("entries", [])
    res = await eom_service.save_weekly_entries(meeting_id, entries)
    await clear_pattern("weekly_meetings*")
    return res

@router.post("/weekly-meetings/declare-result")
async def declare_weekly_team_result_endpoint(
    request: Request,
    current_employee: dict = Depends(get_current_employee)
):
    if not is_admin_or_hr(current_employee):
        raise HTTPException(status_code=403, detail="Only Admin or HR can declare results.")
    data = await request.json()
    week_ids = data.get("weekMeetingIds", [])
    month_year = data.get("monthYear", "")
    try:
        res = await eom_service.declare_weekly_team_result(week_ids, month_year)
        await clear_pattern("weekly_meetings*")
        return res
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

@router.get("/weekly-meetings/declared-results/{month_year}")
async def get_team_declared_result_endpoint(
    month_year: str,
    current_employee: dict = Depends(get_current_employee)
):
    cache_key = f"weekly_meetings:declared:{month_year}"
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached
    res = await eom_service.get_team_declared_result(month_year)
    if not res:
        raise HTTPException(status_code=404, detail=f"No declared team result found for {month_year}")
    await set_cache(cache_key, res)
    return res
