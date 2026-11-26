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
    role = str(user.get("work_details", {}).get("system_role") or user.get("role") or "").lower()
    dept = str(user.get("work_details", {}).get("department") or user.get("department") or "").lower()
    desig = str(user.get("work_details", {}).get("designation") or user.get("designation") or "").lower()
    return role in ("admin", "super admin", "superadmin", "subadmin", "hr", "director", "ceo") or dept == "hr" or "hr" in desig or str(user.get("_id") or user.get("id")) == "default-admin-id" or bool(user.get("is_superuser"))


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
        await clear_pattern("dashboard:spotlights*")
        await clear_pattern("dashboard:prev_eom:*")
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


# ==================== SPOTLIGHT PERSISTENCE ====================

class SpotlightItem(BaseModel):
    id: Optional[str] = None
    name: str
    role: Optional[str] = "Employee of the Month"
    image: Optional[str] = None
    ringStyle: Optional[str] = "none"
    popperStyle: Optional[str] = "none"
    model_config = {"extra": "allow"}


class SpotlightsListIn(BaseModel):
    spotlights: List[SpotlightItem]


SPOTLIGHT_KEY = "active_spotlights"


@router.get("/spotlights")
async def get_spotlights():
    """Auto spotlight = previous month's Employee of the Month winner (with photo),
    followed by any spotlights an admin added manually."""
    from app.database.db import get_database
    from app.services.dashboard import get_previous_month_eom
    from app.redis.service import get_cache, set_cache
    from bson import ObjectId

    cache_key = "dashboard:spotlights"
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    db = get_database()

    manual = []
    doc = await db[NEWS_COLLECTION].find_one({"kind": "dashboard_spotlights", "key": SPOTLIGHT_KEY})
    if doc and doc.get("items"):
        manual = [i for i in doc["items"] if not i.get("auto")]

    spotlights = []
    eom = await get_previous_month_eom()
    if eom["board"]:
        winner = eom["board"][0]
        photo = ""
        dept = winner.get("department") or ""
        try:
            emp = await db["employees"].find_one(
                {"_id": ObjectId(str(winner.get("employeeId")))},
                {"personal_info.profile_photo": 1, "profile_photo": 1, "avatar": 1, "work_details.department": 1},
            )
            if emp:
                pi = emp.get("personal_info") or {}
                photo = pi.get("profile_photo") or emp.get("profile_photo") or emp.get("avatar") or ""
                dept = (emp.get("work_details") or {}).get("department") or dept
        except Exception:
            pass
        label = eom["period"]["label"]
        item = {
            "name": winner.get("name") or "Employee",
            "role": f"Employee of the Month · {label}",
            "ringStyle": "gold",
            "popperStyle": "none",
            "auto": True,
        }
        if photo:
            item["image"] = photo
        spotlights.append(item)

    winner_name = spotlights[0]["name"].strip().lower() if spotlights else None
    spotlights += [i for i in manual if str(i.get("name", "")).strip().lower() != winner_name]
    res = {"spotlights": spotlights}
    await set_cache(cache_key, res, ttl=300)
    return res


@router.put("/spotlights")
async def update_spotlights(data: SpotlightsListIn, current_user: dict = Depends(get_current_employee)):
    if not _is_admin(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    from app.database.db import get_database
    from datetime import datetime
    db = get_database()
    # The auto EOM winner is recomputed on every load, so never persist it
    items = [s.model_dump() for s in data.spotlights if not (s.model_dump().get("auto"))]
    await db[NEWS_COLLECTION].update_one(
        {"kind": "dashboard_spotlights", "key": SPOTLIGHT_KEY},
        {"$set": {"kind": "dashboard_spotlights", "key": SPOTLIGHT_KEY, "items": items, "updated_at": datetime.utcnow()}},
        upsert=True
    )
    from app.redis.service import delete_cache
    await delete_cache("dashboard:spotlights")
    return {"status": "success", "spotlights": items}


# ==================== DAILY MOTIVATION ====================

class MotivationIn(BaseModel):
    quote: str
    author: Optional[str] = "Daily Mindset"
    date: Optional[str] = None  # YYYY-MM-DD or None for general pool
    color: Optional[str] = None


@router.get("/motivation")
async def get_motivation():
    from app.database.db import get_database
    from datetime import date
    db = get_database()
    today_str = date.today().isoformat()

    quote_today = await db["dashboard_motivation"].find_one({"date": today_str})
    if quote_today:
        quote_today["_id"] = str(quote_today["_id"])
        all_quotes = []
        cursor = db["dashboard_motivation"].find().sort("created_at", -1).limit(50)
        async for q in cursor:
            q["_id"] = str(q["_id"])
            all_quotes.append(q)
        return {"current": quote_today, "quotes": all_quotes}

    all_quotes = []
    cursor = db["dashboard_motivation"].find().sort("created_at", -1).limit(50)
    async for q in cursor:
        q["_id"] = str(q["_id"])
        all_quotes.append(q)

    if all_quotes:
        current = all_quotes[0]
    else:
        current = {
            "quote": "Discipline compounds faster than talent. Show up, ship, repeat.",
            "author": "Daily Mindset",
            "date": today_str
        }

    return {"current": current, "quotes": all_quotes}


@router.post("/motivation")
async def add_motivation(data: MotivationIn, current_user: dict = Depends(get_current_employee)):
    if not _is_admin(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    from app.database.db import get_database
    from datetime import datetime
    db = get_database()
    doc = {
        "quote": data.quote.strip(),
        "author": data.author.strip() if data.author else "Daily Mindset",
        "date": data.date,
        "color": data.color,
        "created_at": datetime.utcnow()
    }
    res = await db["dashboard_motivation"].insert_one(doc)
    doc["_id"] = str(res.inserted_id)
    return doc


@router.put("/motivation/{quote_id}")
async def update_motivation(quote_id: str, data: MotivationIn, current_user: dict = Depends(get_current_employee)):
    if not _is_admin(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    from app.database.db import get_database
    from datetime import datetime
    from bson import ObjectId
    db = get_database()
    update_data = {
        "quote": data.quote.strip(),
        "author": data.author.strip() if data.author else "Daily Mindset",
        "date": data.date,
        "color": data.color,
        "updated_at": datetime.utcnow()
    }
    oid = ObjectId(quote_id) if ObjectId.is_valid(quote_id) else quote_id
    await db["dashboard_motivation"].update_one({"_id": oid}, {"$set": update_data})
    return {"status": "success", "quote_id": quote_id}


@router.delete("/motivation/{quote_id}")
async def delete_motivation(quote_id: str, current_user: dict = Depends(get_current_employee)):
    if not _is_admin(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    from app.database.db import get_database
    from bson import ObjectId
    db = get_database()
    oid = ObjectId(quote_id) if ObjectId.is_valid(quote_id) else quote_id
    await db["dashboard_motivation"].delete_one({"_id": oid})
    return {"status": "success", "deleted_id": quote_id}


# ==================== COMPANY NEWS ====================

# Atlas cluster is at its collection limit, so news lives in the existing `counters` utility
# collection (only ever accessed by _id elsewhere), separated by `kind`.
NEWS_COLLECTION = "counters"
NEWS_KIND = "company_news"


class NewsIn(BaseModel):
    title: str
    desc: str
    date: Optional[str] = None
    priority: Optional[int] = 0


@router.get("/news")
async def get_company_news():
    from app.database.db import get_database
    from app.redis.service import get_cache, set_cache
    cache_key = "dashboard:news"
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    db = get_database()
    news_items = []

    cursor = db[NEWS_COLLECTION].find({"kind": NEWS_KIND, "is_deleted": {"$ne": True}}).sort([("priority", -1), ("created_at", -1)]).limit(50)
    async for n in cursor:
        n["_id"] = str(n["_id"])
        n["id"] = str(n["_id"])
        news_items.append(n)

    res = {"news": news_items}
    await set_cache(cache_key, res, ttl=120)
    return res


@router.post("/news")
async def create_company_news(data: NewsIn, current_user: dict = Depends(get_current_employee)):
    if not _is_admin(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    from app.database.db import get_database
    from datetime import datetime
    db = get_database()
    doc = {
        "kind": NEWS_KIND,
        "title": data.title.strip(),
        "desc": data.desc.strip(),
        "date": data.date or datetime.utcnow().strftime("%d %b"),
        "priority": data.priority or 0,
        "is_deleted": False,
        "created_at": datetime.utcnow()
    }
    res = await db[NEWS_COLLECTION].insert_one(doc)
    doc["_id"] = str(res.inserted_id)
    from app.redis.service import delete_cache
    await delete_cache("dashboard:news")
    return doc


@router.put("/news/{news_id}")
async def update_company_news(news_id: str, data: NewsIn, current_user: dict = Depends(get_current_employee)):
    if not _is_admin(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    from app.database.db import get_database
    from datetime import datetime
    from bson import ObjectId
    db = get_database()
    oid = ObjectId(news_id) if ObjectId.is_valid(news_id) else news_id
    await db[NEWS_COLLECTION].update_one(
        {"_id": oid, "kind": NEWS_KIND},
        {"$set": {
            "title": data.title.strip(),
            "desc": data.desc.strip(),
            "date": data.date,
            "priority": data.priority or 0,
            "updated_at": datetime.utcnow()
        }}
    )
    from app.redis.service import delete_cache
    await delete_cache("dashboard:news")
    return {"status": "success", "news_id": news_id}


@router.delete("/news/{news_id}")
async def delete_company_news(news_id: str, current_user: dict = Depends(get_current_employee)):
    if not _is_admin(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    from app.database.db import get_database
    from datetime import datetime
    from bson import ObjectId
    db = get_database()
    oid = ObjectId(news_id) if ObjectId.is_valid(news_id) else news_id
    await db[NEWS_COLLECTION].update_one({"_id": oid, "kind": NEWS_KIND}, {"$set": {"is_deleted": True, "updated_at": datetime.utcnow()}})
    from app.redis.service import delete_cache
    await delete_cache("dashboard:news")
    return {"status": "success", "deleted_id": news_id}


# ==================== UNIFIED APPROVALS HUB (#1) ====================

@router.get("/approvals-hub")
async def get_approvals_hub(current_user: dict = Depends(get_current_employee)):
    """Unified pending approvals across Leaves, Overtime, Daily Progress, and Invoices (Redis cached)."""
    if not _is_admin(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin or HR only")

    from app.redis.service import get_cache, set_cache
    cache_key = "dashboard:approvals_hub"
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    import asyncio
    from app.database.db import get_database
    from app.repository.overtime import OvertimeRepository
    from app.repository.daily_progress import DailyProgressRepository

    db = get_database()
    ot_col, dp_col = await asyncio.gather(
        OvertimeRepository.get_collection(),
        DailyProgressRepository.get_collection(),
    )

    emps, raw_leaves, raw_ot, raw_dp, raw_inv = await asyncio.gather(
        db["employees"].find(
            {"is_deleted": {"$ne": True}},
            {"personal_info.first_name": 1, "personal_info.last_name": 1, "name": 1, "work_details.department": 1},
        ).to_list(length=1000),
        db["leave_requests"].find({
            "status": {"$in": ["Pending", "pending"]},
            "is_deleted": {"$ne": True},
        }).sort("created_at", -1).limit(50).to_list(length=50),
        ot_col.find({
            "status": {"$in": ["Pending", "pending"]},
            "is_deleted": {"$ne": True},
        }).sort("created_at", -1).limit(50).to_list(length=50),
        dp_col.find(
            {"status": {"$in": ["Pending", "pending"]}, "is_deleted": {"$ne": True}},
            {"employee_id": 1, "employee_name": 1, "date": 1, "tasks": 1, "summary": 1, "notes": 1, "created_at": 1},
        ).sort("date", -1).limit(50).to_list(length=50),
        db["invoices"].find({
            "approval_status": {"$in": ["Pending", "pending"]},
            "is_deleted": {"$ne": True},
        }).sort("created_at", -1).limit(50).to_list(length=50),
    )

    emp_map = {}
    for e in emps:
        eid = str(e["_id"])
        pi = e.get("personal_info") or {}
        full = f"{pi.get('first_name', '')} {pi.get('last_name', '')}".strip() or e.get("name") or "Employee"
        emp_map[eid] = {"name": full, "department": (e.get("work_details") or {}).get("department", "")}

    # 1. Pending Leave Requests
    leaves = []
    for lv in raw_leaves:
        eid = str(lv.get("employee_id") or "")
        info = emp_map.get(eid, {})
        leaves.append({
            "id": str(lv["_id"]),
            "type": "leave",
            "employee_id": eid,
            "employee_name": lv.get("employee_name") or info.get("name", "Employee"),
            "department": info.get("department", ""),
            "title": f"{lv.get('leave_type', 'Leave')} ({lv.get('total_days', 1)}d)",
            "subtitle": f"{lv.get('start_date', '')} to {lv.get('end_date', '')}",
            "reason": lv.get("reason") or "",
            "created_at": str(lv.get("created_at") or ""),
        })

    # 2. Pending Overtime Requests
    overtime = []
    for ot in raw_ot:
        eid = str(ot.get("employee_id") or "")
        info = emp_map.get(eid, {})
        overtime.append({
            "id": str(ot["_id"]),
            "type": "overtime",
            "employee_id": eid,
            "employee_name": ot.get("employee_name") or info.get("name", "Employee"),
            "department": info.get("department", ""),
            "title": f"Overtime: {ot.get('hours', 0)} hrs",
            "subtitle": f"Date: {ot.get('date', '')}",
            "reason": ot.get("reason") or ot.get("description") or "",
            "created_at": str(ot.get("created_at") or ""),
        })

    # 3. Pending Daily Progress
    daily_progress = []
    for dp in raw_dp:
        eid = str(dp.get("employee_id") or "")
        info = emp_map.get(eid, {})
        daily_progress.append({
            "id": str(dp["_id"]),
            "type": "daily_progress",
            "employee_id": eid,
            "employee_name": dp.get("employee_name") or info.get("name", "Employee"),
            "department": info.get("department", ""),
            "title": f"Daily Progress ({dp.get('date', '')})",
            "subtitle": f"Tasks: {len(dp.get('tasks') or [])} logged",
            "reason": dp.get("summary") or dp.get("notes") or "",
            "created_at": str(dp.get("created_at") or ""),
        })

    # 4. Pending Invoices
    invoices = []
    for inv in raw_inv:
        invoices.append({
            "id": str(inv["_id"]),
            "type": "invoice",
            "employee_id": str(inv.get("created_by") or ""),
            "employee_name": inv.get("client_name") or "Client",
            "department": "Finance",
            "title": f"Invoice #{inv.get('invoice_number') or str(inv['_id'])[-6:]}",
            "subtitle": f"Amount: ₹{inv.get('total_due', 0)}",
            "reason": inv.get("notes") or "",
            "created_at": str(inv.get("created_at") or ""),
        })

    result = {
        "leaves": leaves,
        "overtime": overtime,
        "daily_progress": daily_progress,
        "invoices": invoices,
        "total_pending": len(leaves) + len(overtime) + len(daily_progress) + len(invoices)
    }
    await set_cache(cache_key, result, ttl=60)
    return result


class ApprovalHubActionIn(BaseModel):
    type: str  # leave | overtime | daily_progress | invoice
    id: str
    decision: str  # approve | reject
    reason: Optional[str] = ""


@router.post("/approvals-hub/action")
async def execute_approvals_hub_action(
    payload: ApprovalHubActionIn,
    current_user: dict = Depends(get_current_employee)
):
    """1-click approve/reject from Unified Approvals Hub + invalidates all related Redis caches."""
    if not _is_admin(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin or HR only")

    from datetime import datetime
    from bson import ObjectId
    from app.database.db import get_database
    from app.redis.service import clear_pattern

    db = get_database()
    actor_id = str(current_user.get("_id") or current_user.get("id"))
    is_approve = payload.decision.lower() == "approve"
    now = datetime.utcnow()

    if payload.type == "leave":
        from app.services.leave import LeaveService
        from app.schemas.leave import LeaveStatusUpdate
        new_status = "Approved" if is_approve else "Rejected"
        await LeaveService.update_leave_status(
            payload.id,
            LeaveStatusUpdate(status=new_status, rejection_reason=payload.reason or None),
            actor_id
        )
    elif payload.type == "overtime":
        from app.services.overtime import OvertimeService
        from app.schemas.overtime import OvertimeStatusUpdate
        new_status = "Approved" if is_approve else "Rejected"
        await OvertimeService.decide(
            payload.id,
            OvertimeStatusUpdate(status=new_status, note=payload.reason or None),
            current_user
        )
    elif payload.type == "daily_progress":
        from app.services.daily_progress import DailyProgressService
        from app.schemas.daily_progress import DailyProgressApprove
        if is_approve:
            await DailyProgressService.approve_progress(
                payload.id,
                DailyProgressApprove(rating=8.0, remarks=payload.reason or "Approved via Unified Approvals Hub"),
                current_user
            )
        else:
            await DailyProgressService.reject_progress(payload.id, current_user)
    elif payload.type == "invoice":
        oid = ObjectId(payload.id) if ObjectId.is_valid(payload.id) else payload.id
        new_status = "approved" if is_approve else "rejected"
        await db["invoices"].update_one(
            {"_id": oid},
            {"$set": {
                "approval_status": new_status,
                "approved_by": actor_id,
                "approved_at": now,
                "updated_at": now
            }}
        )
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unsupported approval type: {payload.type}")

    # Clear all related Redis caches
    for pat in ["dashboard:*", "leaves*", "overtime*", "daily_progress*", "invoices*"]:
        await clear_pattern(pat)

    return {"success": True, "type": payload.type, "id": payload.id, "decision": payload.decision}


# ==================== LIVE TEAM PULSE (#3) ====================

@router.get("/team-pulse")
async def get_team_pulse(current_user: dict = Depends(get_current_employee)):
    """Real-time 'Who is in Office' status breakdown for Active Employees only (Redis cached)."""
    from datetime import datetime, timezone, timedelta
    from app.redis.service import get_cache, set_cache
    from app.database.db import get_database

    ist = timezone(timedelta(hours=5, minutes=30))
    today_str = datetime.now(ist).strftime("%Y-%m-%d")
    cache_key = f"dashboard:team_pulse:{today_str}"
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    import asyncio
    db = get_database()
    # Run all 3 queries concurrently with slim projections
    emps, att_records, approved_leaves = await asyncio.gather(
        db["employees"].find(
            {
                "is_deleted": {"$ne": True},
                "work_details.is_delete": {"$ne": True},
                "work_details.is_block": {"$ne": True},
                "status": {"$nin": ["Inactive", "inactive", "Terminated", "Blocked"]},
                "work_details.system_role": {"$nin": ["Admin", "admin", "Super Admin", "superadmin", "Superadmin"]},
            },
            {
                "personal_info.first_name": 1,
                "personal_info.last_name": 1,
                "personal_info.avatar": 1,
                "name": 1,
                "avatar": 1,
                "profile_photo": 1,
                "work_details.department": 1,
                "work_details.designation": 1,
                "work_details.system_role": 1,
                "role": 1,
            },
        ).to_list(length=1000),
        db["attendance"].find(
            {"date": today_str},
            {"employee_id": 1, "check_in": 1, "punch_in": 1, "check_out": 1, "punch_out": 1, "status": 1, "breaks": 1},
        ).to_list(length=1000),
        db["leave_requests"].find(
            {
                "status": {"$in": ["Approved", "approved"]},
                "start_date": {"$lte": today_str},
                "end_date": {"$gte": today_str},
                "is_deleted": {"$ne": True},
            },
            {"employee_id": 1, "leave_type": 1},
        ).to_list(length=500),
    )

    # Extra safety filter for top-level role
    active_emps = []
    for e in emps:
        wd = e.get("work_details") or {}
        sys_role = str(wd.get("system_role") or e.get("role") or "Employee").strip().lower()
        if sys_role in ("admin", "super admin", "superadmin", "administrator"):
            continue
        active_emps.append(e)

    att_by_emp = {}
    for a in att_records:
        eid = str(a.get("employee_id") or "")
        if eid:
            att_by_emp[eid] = a

    leave_by_emp = {str(lv.get("employee_id") or ""): lv for lv in approved_leaves}

    active, on_break, half_day, punched_out, absent_or_leave = [], [], [], [], []

    for e in active_emps:
        eid = str(e["_id"])
        pi = e.get("personal_info") or {}
        wd = e.get("work_details") or {}
        name = f"{pi.get('first_name', '')} {pi.get('last_name', '')}".strip() or e.get("name") or "Employee"
        base = {
            "id": eid,
            "name": name,
            "avatar": e.get("profile_photo") or e.get("avatar") or pi.get("avatar") or "",
            "department": wd.get("department") or "",
            "designation": wd.get("designation") or "",
        }
        att = att_by_emp.get(eid)
        lv = leave_by_emp.get(eid)

        check_in_val = str(att.get("check_in") or att.get("punch_in") or "").strip() if att else ""
        check_out_val = str(att.get("check_out") or att.get("punch_out") or "").strip() if att else ""
        has_checked_in = bool(check_in_val and check_in_val != "--")
        has_checked_out = bool(check_out_val and check_out_val != "--")

        if att and has_checked_in:
            att_status = str(att.get("status") or "").strip().lower()
            breaks = att.get("breaks") or []
            open_brk = next(
                (b for b in reversed(breaks) if isinstance(b, dict) and (b.get("start_time") or b.get("break_in")) and not (b.get("end_time") or b.get("break_out"))),
                None
            )
            if has_checked_out or att_status in ("checked out", "punched out", "completed"):
                punched_out.append({**base, "punch_in": check_in_val, "punch_out": check_out_val})
            elif open_brk or att_status == "on break":
                brk_start = str(open_brk.get("start_time") or open_brk.get("break_in") or "") if open_brk else ""
                on_break.append({**base, "punch_in": check_in_val, "break_in": brk_start})
            elif att_status in ("half day", "half_day", "half-day"):
                half_day.append({**base, "punch_in": check_in_val})
            else:
                active.append({**base, "punch_in": check_in_val})
        elif lv:
            absent_or_leave.append({**base, "leave_type": lv.get("leave_type") or "On Leave", "on_leave": True})
        else:
            absent_or_leave.append({**base, "leave_type": "Not Punched In", "on_leave": False})

    result = {
        "date": today_str,
        "counts": {
            "active": len(active),
            "on_break": len(on_break),
            "half_day": len(half_day),
            "punched_out": len(punched_out),
            "absent_or_leave": len(absent_or_leave),
            "total": len(active_emps),
        },
        "active": active,
        "on_break": on_break,
        "half_day": half_day,
        "punched_out": punched_out,
        "absent_or_leave": absent_or_leave,
    }
    await set_cache(cache_key, result, ttl=60)
    return result

