"""Dashboard ONE-API aggregation (fast: single round-trip, parallel DB reads, Redis 60s cache)."""
import asyncio
import logging
from datetime import datetime
from typing import Any, Dict, Optional

from app.database.db import get_database
from app.redis.service import get_cache, set_cache

logger = logging.getLogger("dashboard_service")


def _month_bounds(month: Optional[int], year: Optional[int]):
    now = datetime.utcnow()
    m = int(month) if month else now.month
    y = int(year) if year else now.year
    try:
        start = datetime(y, m, 1)
    except Exception:
        start = datetime(now.year, now.month, 1)
        m, y = start.month, start.year
    end = datetime(y + 1, 1, 1) if m == 12 else datetime(y, m + 1, 1)
    return m, y, start, end


class DashboardService:
    @staticmethod
    async def get_overview(user_id: str, month: Optional[int] = None, year: Optional[int] = None) -> Dict[str, Any]:
        from app.services.task import TaskService
        from app.services.penalty import PenaltyService
        from app.services.attendance import AttendanceService
        from app.services.remark import RemarkService

        m, y, start, end = _month_bounds(month, year)
        cache_key = f"dashboard:overview:{user_id}:{y}-{m:02d}"
        try:
            cached = await get_cache(cache_key)
            if cached is not None:
                return cached
        except Exception:
            pass

        async def safe(coro, default=None):
            try:
                return await coro
            except Exception as e:
                logger.warning(f"dashboard overview partial failure: {e}")
                return default

        async def projects_summary():
            from app.repository.project import ProjectRepository
            col = await ProjectRepository.get_collection()
            # count by status (support both string + nested general.status shapes)
            total = await col.count_documents({"is_deleted": {"$ne": True}})
            active = await col.count_documents({"is_deleted": {"$ne": True}, "$or": [{"general.status": "In Progress"}, {"status": "In Progress"}]})
            completed = await col.count_documents({"is_deleted": {"$ne": True}, "$or": [{"general.status": "Completed"}, {"status": "Completed"}]})
            onhold = await col.count_documents({"is_deleted": {"$ne": True}, "$or": [{"general.status": "On Hold"}, {"status": "On Hold"}]})
            # live roadmap: random 5 active projects
            pipeline = [
                {"$match": {"is_deleted": {"$ne": True}, "$or": [{"general.status": "In Progress"}, {"status": "In Progress"}]}},
                {"$sample": {"size": 5}},
                {"$project": {"_id": 1, "general.project_name": 1, "general.status": 1, "general.progress": 1, "client_id": 1}},
            ]
            roadmap = []
            try:
                async for doc in col.aggregate(pipeline):
                    g = doc.get("general", {}) or {}
                    roadmap.append({
                        "id": str(doc.get("_id")),
                        "name": g.get("project_name") or "Project",
                        "status": g.get("status") or "In Progress",
                        "progress": g.get("progress") or 0,
                    })
            except Exception:
                pass
            return {"total": total, "active": active, "completed": completed, "onhold": onhold, "roadmap": roadmap}

        async def notifications_unread():
            db = get_database()
            try:
                count = await db["notifications"].count_documents({"recipient_id": user_id, "is_read": False})
            except Exception:
                count = 0
            latest = []
            try:
                cursor = db["notifications"].find({"recipient_id": user_id}).sort("created_at", -1).limit(8)
                async for doc in cursor:
                    doc["_id"] = str(doc["_id"])
                    latest.append({
                        "id": doc["_id"],
                        "title": doc.get("title", "Notification"),
                        "message": doc.get("message", ""),
                        "is_read": bool(doc.get("is_read", False)),
                    })
            except Exception:
                pass
            return {"unread_count": count, "latest": latest}

        async def clients_outstanding():
            db = get_database()
            # sum from embedded project finance (same source as client_stats rollup)
            pipeline = [
                {"$match": {"is_deleted": {"$ne": True}}},
                {"$group": {
                    "_id": None,
                    "total_budget": {"$sum": {"$ifNull": ["$finance.project_budget", 0]}},
                    "total_received": {"$sum": {"$ifNull": ["$finance.amount_received", 0]}},
                }},
            ]
            total_budget = 0.0
            total_received = 0.0
            try:
                async for doc in db["projects"].aggregate(pipeline):
                    total_budget = float(doc.get("total_budget") or 0)
                    total_received = float(doc.get("total_received") or 0)
            except Exception:
                pass
            return {
                "total_budget": total_budget,
                "total_received": total_received,
                "outstanding": max(0.0, total_budget - total_received),
            }

        results = await asyncio.gather(
            safe(TaskService.get_task_stats(user_id), {}),
            safe(TaskService.get_daily_overview(user_id), {"today": [], "upcoming": []}),
            safe(PenaltyService.get_summary_stats(), {}),
            safe(PenaltyService.get_leaderboard(month=m, year=y), {}),
            safe(AttendanceService.get_eom_summary(str(m), y, None, "Employee", user_id), {}),
            safe(RemarkService.get_overview({"_id": user_id, "work_details": {"system_role": "Employee"}}), {}),
            safe(projects_summary(), {}),
            safe(notifications_unread(), {"unread_count": 0, "latest": []}),
            safe(clients_outstanding(), {}),
        )

        payload = {
            "month": m,
            "year": y,
            "tasks": results[0] or {},
            "today": results[1] or {},
            "penalties": results[2] or {},
            "penalty_leaderboard": results[3] or {},
            "attendance": results[4] or {},
            "remarks": results[5] or {},
            "projects": results[6] or {},
            "notifications": results[7] or {},
            "finance_pending": results[8] or {},
        }
        try:
            await set_cache(cache_key, payload, ttl=60)
        except Exception:
            pass
        return payload
