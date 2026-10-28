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


@router.get("/spotlights")
async def get_spotlights():
    from app.database.db import get_database
    db = get_database()
    doc = await db["dashboard_spotlights"].find_one({"key": "active_spotlights"})
    if doc and "items" in doc and doc["items"]:
        return {"spotlights": doc["items"]}

    defaults = [
        {"name": "Prince", "role": "Employee of the Month", "image": "/prince.jpg", "ringStyle": "gold", "popperStyle": "confetti"},
        {"name": "Aarav Mehta", "role": "Top Closer · Sales", "ringStyle": "emerald"},
        {"name": "Neha Patel", "role": "Creative Star · Design", "image": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&auto=format&fit=crop&q=80", "ringStyle": "neon"}
    ]
    return {"spotlights": defaults}


@router.put("/spotlights")
async def update_spotlights(data: SpotlightsListIn, current_user: dict = Depends(get_current_employee)):
    if not _is_admin(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    from app.database.db import get_database
    from datetime import datetime
    db = get_database()
    items = [s.model_dump() for s in data.spotlights]
    await db["dashboard_spotlights"].update_one(
        {"key": "active_spotlights"},
        {"$set": {"key": "active_spotlights", "items": items, "updated_at": datetime.utcnow()}},
        upsert=True
    )
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

class NewsIn(BaseModel):
    title: str
    desc: str
    date: Optional[str] = None
    priority: Optional[int] = 0


@router.get("/news")
async def get_company_news():
    from app.database.db import get_database
    from datetime import datetime
    db = get_database()
    news_items = []
    
    total_docs = await db["company_news"].count_documents({})
    if total_docs == 0:
        # Seed defaults with real ObjectIds once so they can be edited or permanently deleted
        defaults = [
            {"title": "HK DigiVerse crosses 60 active clients", "desc": "A new milestone driven by the Sales and Delivery teams.", "date": "Recent", "priority": 1, "is_deleted": False, "created_at": datetime.utcnow()},
            {"title": "Appraisal cycle starts 05 August", "desc": "Managers must submit review drafts before 03 August.", "date": "Important", "priority": 2, "is_deleted": False, "created_at": datetime.utcnow()},
            {"title": "Revised hybrid work policy", "desc": "Minimum 3 office days per week from this month.", "date": "Notice", "priority": 3, "is_deleted": False, "created_at": datetime.utcnow()}
        ]
        await db["company_news"].insert_many(defaults)

    cursor = db["company_news"].find({"is_deleted": {"$ne": True}}).sort([("priority", -1), ("created_at", -1)]).limit(50)
    async for n in cursor:
        n["_id"] = str(n["_id"])
        n["id"] = str(n["_id"])
        news_items.append(n)

    return {"news": news_items}


@router.post("/news")
async def create_company_news(data: NewsIn, current_user: dict = Depends(get_current_employee)):
    if not _is_admin(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    from app.database.db import get_database
    from datetime import datetime
    db = get_database()
    doc = {
        "title": data.title.strip(),
        "desc": data.desc.strip(),
        "date": data.date or datetime.utcnow().strftime("%d %b"),
        "priority": data.priority or 0,
        "is_deleted": False,
        "created_at": datetime.utcnow()
    }
    res = await db["company_news"].insert_one(doc)
    doc["_id"] = str(res.inserted_id)
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
    await db["company_news"].update_one(
        {"_id": oid},
        {"$set": {
            "title": data.title.strip(),
            "desc": data.desc.strip(),
            "date": data.date,
            "priority": data.priority or 0,
            "updated_at": datetime.utcnow()
        }}
    )
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
    await db["company_news"].update_one({"_id": oid}, {"$set": {"is_deleted": True, "updated_at": datetime.utcnow()}})
    return {"status": "success", "deleted_id": news_id}

