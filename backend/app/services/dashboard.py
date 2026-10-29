"""Dashboard ONE-API aggregation (fast: single round-trip, parallel DB reads, Redis 60s cache)."""
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

from bson import ObjectId

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


async def get_previous_month_eom() -> Dict[str, Any]:
    """Previous calendar month's Employee-of-the-Month result (read-only).

    Returns {"period": {...}, "board": [entries sorted by rank], "max_total": float}.
    Board is empty when that month has no EOM criteria/scores yet.
    """
    db = get_database()
    today = datetime.now()
    py, pm = (today.year - 1, 12) if today.month == 1 else (today.year, today.month - 1)
    month_year = f"{py:04d}-{pm:02d}"
    period = {"month": pm, "year": py, "label": datetime(py, pm, 1).strftime("%B %Y")}
    out: Dict[str, Any] = {"period": period, "board": [], "max_total": 100.0}
    try:
        # Read-only guard: calculate_eom_leaderboard would otherwise create default criteria
        if await db["eom_criteria"].count_documents({"month_year": month_year}, limit=1):
            from app.services import eom_service
            res = await eom_service.calculate_eom_leaderboard(month_year)
            board = res.get("leaderboard") or []
            if any(float(e.get("totalScore") or 0) > 0 for e in board):
                out["board"] = board
                out["max_total"] = sum(float(c.get("maxScore") or 0) for c in res.get("criteria") or []) or 100.0
    except Exception as exc:
        logger.warning("Previous month EOM lookup failed: %s", exc)
    return out


class DashboardService:
    @staticmethod
    async def get_overview(user_id: str, month: Optional[int] = None, year: Optional[int] = None) -> Dict[str, Any]:
        from app.services.task import TaskService
        from app.services.penalty import PenaltyService
        from app.services.attendance import AttendanceService
        from app.services.remark import RemarkService
        from app.repository.task import TaskRepository

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

        async def wfh_block():
            # WFH today: names + auto % (Audio PDF)
            db = get_database()
            names = []
            total = 0
            try:
                total = await db["employees"].count_documents({})
                cursor = db["employees"].find(
                    {"work_details.work_mode": {"$in": ["WFH", "Work From Home", "Remote", "Hybrid", "wfh"]}},
                    {"personal_info": 1},
                )
                async for doc in cursor:
                    p = doc.get("personal_info", {}) or {}
                    nm = f"{p.get('first_name', '')} {p.get('last_name', '')}".strip()
                    names.append(nm or "Employee")
            except Exception:
                pass
            pct = round(len(names) / total * 100, 1) if total else 0
            return {"total": total, "count": len(names), "names": names, "pct": pct}

        async def company_health():
            # Section 02 live: headcounts, today attendance, leaves, interns, clients, revenue
            from datetime import date as _date
            db = get_database()
            today = _date.today()
            ds = today.isoformat()
            dstart = datetime(today.year, today.month, today.day)
            emp_filter = {"work_details.is_delete": {"$ne": True}}
            out = {
                "total_employees": 0, "present_today": 0, "absent_today": 0, "late_today": 0,
                "total_interns": 0, "pending_leaves": 0,
                "total_clients": 0, "active_clients": 0,
                "running_projects": 0, "pending_tasks": 0,
                "monthly_revenue": 0.0,
            }
            try:
                out["total_employees"] = await db["employees"].count_documents(emp_filter)
            except Exception:
                pass
            try:
                present_ids: set = set()
                cursor = db["attendance"].find({"date": ds}, {"status": 1, "is_late": 1, "employee_id": 1})
                async for doc in cursor:
                    st = str(doc.get("status") or "")
                    if st in ("Present", "Half Day"):
                        out["present_today"] += 1
                        if doc.get("employee_id"):
                            present_ids.add(str(doc["employee_id"]))
                    if doc.get("is_late"):
                        out["late_today"] += 1
                leave_ids: set = set()
                try:
                    cur2 = db["leave_requests"].find(
                        {"status": "Approved", "start_date": {"$lte": ds}, "end_date": {"$gte": ds}, "is_deleted": {"$ne": True}},
                        {"employee_id": 1},
                    )
                    async for doc in cur2:
                        if doc.get("employee_id"):
                            leave_ids.add(str(doc["employee_id"]))
                except Exception:
                    pass
                out["absent_today"] = max(0, out["total_employees"] - len(present_ids | leave_ids))
            except Exception:
                pass
            try:
                out["total_interns"] = await db["employees"].count_documents(
                    {**emp_filter, "work_details.designation": {"$regex": "intern", "$options": "i"}}
                )
            except Exception:
                pass
            try:
                out["pending_leaves"] = await db["leave_requests"].count_documents({"status": "Pending", "is_deleted": {"$ne": True}})
            except Exception:
                pass
            try:
                out["total_clients"] = await db["clients"].count_documents(
                    {"is_deleted": {"$ne": True}, "is_archived": {"$ne": True}}
                )
            except Exception:
                pass
            try:
                ids = await db["projects"].distinct(
                    "client_id",
                    {"is_deleted": {"$ne": True}, "$or": [{"general.status": "In Progress"}, {"status": "In Progress"}]},
                )
                out["active_clients"] = len([i for i in ids if i])
            except Exception:
                pass
            try:
                prefix = f"{y}-{m:02d}"
                pipeline = [
                    {"$match": {"is_deleted": {"$ne": True}}},
                    {"$unwind": "$finance.payments"},
                    {"$match": {"finance.payments.date": {"$regex": f"^{prefix}"}}},
                    {"$group": {"_id": None, "rev": {"$sum": {"$ifNull": ["$finance.payments.amount", 0]}}}},
                ]
                async for doc in db["projects"].aggregate(pipeline):
                    out["monthly_revenue"] = float(doc.get("rev") or 0)
                # Audio 8: Include sales collection in monthly revenue
                from app.repository.sales import SalesRepository
                sales_sum = await SalesRepository.get_sales_summary()
                s_rev = float(sales_sum.get("total_won_revenue") or 0.0)
                if out.get("monthly_revenue", 0.0) == 0.0:
                    out["monthly_revenue"] = s_rev
                else:
                    out["monthly_revenue"] = max(out.get("monthly_revenue", 0.0), s_rev)

                out["monthly_expense"] = 0.0
                try:
                    pr = await db["payroll_runs"].find_one({"month": prefix})
                    if pr and "summary" in pr and pr["summary"].get("company_expense"):
                        out["monthly_expense"] = float(pr["summary"]["company_expense"])
                    else:
                        pipe_sal = [
                            {"$match": {"work_details.is_delete": {"$ne": True}}},
                            {"$group": {"_id": None, "total_sal": {"$sum": {"$ifNull": ["$bank_and_docs.monthly_salary", 0]}}}}
                        ]
                        async for sdoc in db["employees"].aggregate(pipe_sal):
                            out["monthly_expense"] = float(sdoc.get("total_sal") or 0.0)
                except Exception:
                    pass
                out["net_profit"] = max(0.0, out.get("monthly_revenue", 0.0) - out.get("monthly_expense", 0.0))
            except Exception:
                pass
            return out

        async def tasks_clients_block():
            # Sections 09-10 live: task KPIs, client KPIs, key accounts, deadlines, follow-ups
            from datetime import date as _date
            db = get_database()
            today = _date.today()
            dstart = datetime(today.year, today.month, today.day)
            out = {
                "overdue": 0, "completed_today": 0, "new_this_month": 0,
                "key_accounts": [], "upcoming_deadlines": [], "follow_ups": [],
            }
            try:
                out["overdue"] = await db["tasks"].count_documents(
                    {"status": {"$ne": "completed"}, "due_date": {"$lt": dstart}}
                )
            except Exception:
                pass
            try:
                out["completed_today"] = await db["tasks"].count_documents(
                    {"status": "completed", "updated_at": {"$gte": dstart}}
                )
            except Exception:
                pass
            try:
                out["new_this_month"] = await db["clients"].count_documents(
                    {"is_deleted": {"$ne": True}, "created_at": {"$gte": start}}
                )
            except Exception:
                pass
            try:
                pipeline = [
                    {"$match": {"is_deleted": {"$ne": True}}},
                    {"$group": {
                        "_id": "$client_id",
                        "budget": {"$sum": {"$ifNull": ["$finance.project_budget", 0]}},
                        "received": {"$sum": {"$ifNull": ["$finance.amount_received", 0]}},
                        "since": {"$min": "$created_at"},
                    }},
                    {"$sort": {"budget": -1}},
                    {"$limit": 4},
                ]
                raw = []
                async for doc in db["projects"].aggregate(pipeline):
                    if doc.get("_id"):
                        raw.append(doc)
                cmap = {}
                try:
                    oids = []
                    for r in raw:
                        try:
                            oids.append(ObjectId(str(r["_id"])))
                        except Exception:
                            pass
                    cur = db["clients"].find({"_id": {"$in": oids}}, {"company_name": 1})
                    async for c in cur:
                        cmap[str(c["_id"])] = c.get("company_name") or "Client"
                except Exception:
                    pass
                for r in raw:
                    cid = str(r["_id"])
                    budget = float(r.get("budget") or 0)
                    received = float(r.get("received") or 0)
                    pct = (received / budget * 100) if budget else 0
                    since = r.get("since")
                    year = since.year if hasattr(since, "year") else "—"
                    out["key_accounts"].append({
                        "name": cmap.get(cid, "Client"),
                        "since": str(year),
                        "value": "High" if budget >= 500000 else ("Medium" if budget >= 100000 else "Standard"),
                        "health": "Good" if pct >= 40 or received > 0 else "Warning",
                    })
            except Exception:
                pass
            try:
                emap: dict = {}
                try:
                    cur = db["employees"].find({}, {"personal_info": 1})
                    async for e in cur:
                        p = e.get("personal_info", {}) or {}
                        emap[str(e["_id"])] = f"{p.get('first_name', '')} {p.get('last_name', '')}".strip() or "Employee"
                except Exception:
                    pass
                cur = db["tasks"].find(
                    {"status": {"$ne": "completed"}, "due_date": {"$gte": dstart}},
                    {"title": 1, "due_date": 1, "assigned_to": 1},
                ).sort("due_date", 1).limit(6)
                async for t in cur:
                    dd = t.get("due_date")
                    ds2 = dd.date().isoformat() if hasattr(dd, "date") else str(dd or "")[:10]
                    aid = str(t.get("assigned_to") or "")
                    out["upcoming_deadlines"].append({
                        "title": t.get("title") or "Task",
                        "due": ds2,
                        "assignee": emap.get(aid, "Team"),
                    })
            except Exception:
                pass
            try:
                cur = db["projects"].find(
                    {"is_deleted": {"$ne": True}, "finance.next_payment_date": {"$gte": dstart}},
                    {"general.project_name": 1, "client_id": 1, "finance.next_payment_date": 1, "finance.project_budget": 1},
                ).sort("finance.next_payment_date", 1).limit(5)
                proj_rows = []
                cids = set()
                async for p in cur:
                    g = p.get("general", {}) or {}
                    f = p.get("finance", {}) or {}
                    cid = str(p.get("client_id") or "")
                    if cid:
                        cids.add(cid)
                    proj_rows.append({"name": g.get("project_name") or "Project", "cid": cid,
                                      "npd": f.get("next_payment_date"), "budget": f.get("project_budget") or 0})
                cmap2: dict = {}
                if cids:
                    try:
                        oids = []
                        for c in cids:
                            try:
                                oids.append(ObjectId(c))
                            except Exception:
                                pass
                        cur2 = db["clients"].find({"_id": {"$in": oids}}, {"company_name": 1, "contact_person_name": 1})
                        async for c in cur2:
                            cmap2[str(c["_id"])] = c.get("company_name") or c.get("contact_person_name") or "Client"
                    except Exception:
                        pass
                for r in proj_rows:
                    npd = r["npd"]
                    ds3 = npd.date().isoformat() if hasattr(npd, "date") else str(npd or "")[:10]
                    out["follow_ups"].append({
                        "client": cmap2.get(r["cid"], r["name"]),
                        "assignee": r["name"],
                        "date": ds3,
                    })
            except Exception:
                pass
            return out

        async def departments_block():
            # Section 05 live: per-department headcount, present today, tasks done/total
            from datetime import date as _date
            db = get_database()
            ds = _date.today().isoformat()
            names: list = []
            try:
                cur = db["departments"].find({"is_deleted": {"$ne": True}}, {"name": 1})
                async for d in cur:
                    if d.get("name"):
                        names.append(d["name"])
            except Exception:
                pass
            emps: list = []
            try:
                cur = db["employees"].find(
                    {"work_details.is_delete": {"$ne": True}},
                    {"work_details.department": 1},
                )
                async for d in cur:
                    emps.append((str(d["_id"]), (d.get("work_details") or {}).get("department") or "General"))
            except Exception:
                pass
            if not names:
                names = sorted({dept for _, dept in emps})
            present_ids: set = set()
            try:
                cur = db["attendance"].find({"date": ds}, {"status": 1, "employee_id": 1})
                async for d in cur:
                    if str(d.get("status") or "") in ("Present", "Half Day") and d.get("employee_id"):
                        present_ids.add(str(d["employee_id"]))
            except Exception:
                pass
            tasks_by_emp: dict = {}
            try:
                cur = db["tasks"].find({}, {"status": 1, "assigned_to": 1})
                async for t in cur:
                    aid = str(t.get("assigned_to") or "")
                    if not aid:
                        continue
                    e = tasks_by_emp.setdefault(aid, {"open": 0, "done": 0})
                    if str(t.get("status") or "") == "completed":
                        e["done"] += 1
                    else:
                        e["open"] += 1
            except Exception:
                pass
            out = []
            for n in names:
                ids = [eid for eid, dept in emps if dept == n]
                ids_set = set(ids)
                total = len(ids)
                present = len([i for i in ids if i in present_ids])
                done = sum(tasks_by_emp.get(i, {}).get("done", 0) for i in ids)
                open_n = sum(tasks_by_emp.get(i, {}).get("open", 0) for i in ids)
                _ = ids_set
                out.append({"name": n, "total": total, "present": present, "tasks": open_n, "completed": done})
            return out

        async def eom_block():            # Employee-of-Month latest winners for Top-5 performance (Audio PDF)
            db = get_database()
            winners = []
            try:
                cursor = db["eom_winners"].find({}).sort([("year", -1), ("month", -1)]).limit(12)
                async for doc in cursor:
                    winners.append({
                        "month": doc.get("month"),
                        "year": doc.get("year"),
                        "rank": doc.get("rank"),
                        "employee_id": str(doc.get("employee_id") or ""),
                        "employee_name": doc.get("employee_name") or "Employee",
                        "score_pct": doc.get("score_pct") or 0,
                    })
            except Exception:
                pass
            return {"winners": winners}

        async def sales_block():
            from app.repository.sales import SalesRepository
            import calendar
            try:
                summary = await SalesRepository.get_sales_summary()
                perf_report = await SalesRepository.generate_sales_report(report_type="performance", date_range="this_month")
                top_salespeople = sorted(perf_report.get("items", []), key=lambda x: x.get("net_achieved", 0), reverse=True)[:3]

                today_d = datetime.utcnow().date()
                last_day = calendar.monthrange(today_d.year, today_d.month)[1]
                days_remaining = max(0, last_day - today_d.day)

                return {
                    "today_sales_count": summary.get("today_followups_count", 0),
                    "total_leads": summary.get("total_leads", 0),
                    "active_leads": summary.get("active_leads", 0),
                    "won_leads": summary.get("won_leads", 0),
                    "conversion_rate": summary.get("conversion_rate", 0.0),
                    "monthly_collection": summary.get("total_won_revenue", 0.0),
                    "sales_target": summary.get("total_target", 5000000.0),
                    "achieved_target": summary.get("achieved_target", 0.0),
                    "remaining_target": summary.get("remaining_target", 0.0),
                    "target_achievement_pct": round((summary.get("achieved_target", 0.0) / (summary.get("total_target") or 5000000.0) * 100), 1) if (summary.get("total_target") or 5000000.0) > 0 else 0.0,
                    "days_remaining": days_remaining,
                    "top_salespeople": top_salespeople,
                    "upcoming_hot_followups": summary.get("hot_leads_needing_attention", [])[:6]
                }
            except Exception as e:
                logger.warning(f"Sales block dashboard failure: {e}")
                return {}

        async def attendance_heatmap_block():
            db = get_database()
            emp_count = await db["employees"].count_documents({"work_details.is_delete": {"$ne": True}})
            if emp_count == 0:
                emp_count = await db["employees"].count_documents({})

            import calendar
            total_days = calendar.monthrange(y, m)[1]
            prefix = f"{y}-{m:02d}-"

            pipeline = [
                {"$match": {
                    "date": {"$regex": f"^{prefix}"},
                    "status": {"$in": ["Present", "Half Day", "Late", "Logged", "Active", "On Break"]}
                }},
                {"$group": {
                    "_id": "$date",
                    "present_employees": {"$addToSet": "$employee_id"}
                }},
                {"$project": {
                    "_id": 1,
                    "present_count": {"$size": "$present_employees"}
                }}
            ]
            daily_map = {}
            try:
                async for doc in db["attendance"].aggregate(pipeline):
                    d_str = doc["_id"]
                    parts = d_str.split("-")
                    if len(parts) == 3:
                        day_num = int(parts[2])
                        cnt = doc.get("present_count", 0)
                        pct = round((cnt / emp_count * 100), 1) if emp_count > 0 else 0.0

                        # 25% Quartiles: 0% -> 0, 1-25% -> 1, 26-50% -> 2, 51-75% -> 3, 76-100% -> 4
                        if pct > 75.0:
                            lvl = 4
                        elif pct > 50.0:
                            lvl = 3
                        elif pct > 25.0:
                            lvl = 2
                        elif pct > 0.0:
                            lvl = 1
                        else:
                            lvl = 0

                        daily_map[str(day_num)] = {
                            "date": d_str,
                            "day": day_num,
                            "present": cnt,
                            "total": emp_count,
                            "pct": pct,
                            "level": lvl
                        }
            except Exception as e:
                logger.warning(f"Heatmap block failure: {e}")

            for d in range(1, total_days + 1):
                s_day = str(d)
                if s_day not in daily_map:
                    daily_map[s_day] = {
                        "date": f"{y}-{m:02d}-{d:02d}",
                        "day": d,
                        "present": 0,
                        "total": emp_count,
                        "pct": 0.0,
                        "level": 0
                    }

            return {
                "total_employees": emp_count,
                "month": m,
                "year": y,
                "daily": daily_map
            }

        async def hr_updates_block():
            db = get_database()
            today_dt = datetime.utcnow()
            prefix = f"{y}-{m:02d}"

            interviews = []
            try:
                # Current week (Mon-Sun); interview dates are stored as ISO YYYY-MM-DD strings
                now_local = datetime.now()
                week_start = (now_local - timedelta(days=now_local.weekday())).date()
                week_end = week_start + timedelta(days=6)
                cur = db["interview_schedules"].find(
                    {
                        "is_deleted": {"$ne": True},
                        "date": {"$gte": week_start.isoformat(), "$lte": week_end.isoformat()}
                    },
                    {"candidate_name": 1, "role_position": 1, "date": 1, "time": 1, "interviewer_name": 1}
                ).sort("date", 1).limit(50)
                async for item in cur:
                    interviews.append({
                        "name": item.get("candidate_name") or "Candidate",
                        "role": item.get("role_position") or "Interview",
                        "date": item.get("date") or "",
                        "time": item.get("time") or "",
                        "interviewer": item.get("interviewer_name") or ""
                    })
            except Exception:
                pass

            all_emps = []
            try:
                cur_emp = db["employees"].find(
                    {"work_details.is_delete": {"$ne": True}},
                    {"personal_info": 1, "work_details": 1, "bond_and_exit": 1}
                )
                async for e in cur_emp:
                    all_emps.append(e)
            except Exception:
                pass

            anniversaries = []
            new_joinings = []
            probations = []
            exits = []

            month_abbrs = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

            for e in all_emps:
                p = e.get("personal_info") or {}
                w = e.get("work_details") or {}
                b = e.get("bond_and_exit") or {}
                fname = f"{p.get('first_name', '')} {p.get('last_name', '')}".strip() or "Employee"
                role = w.get("designation") or w.get("department") or "Team Member"

                jdate_str = str(w.get("joining_date") or "")
                if jdate_str and len(jdate_str) >= 10:
                    try:
                        jy, jm, jd = int(jdate_str[:4]), int(jdate_str[5:7]), int(jdate_str[8:10])

                        years = today_dt.year - jy
                        if years > 0:
                            ann_date = f"{jd:02d} {month_abbrs[jm-1]}"
                            anniversaries.append({
                                "name": fname,
                                "tenure": f"{years} {'year' if years == 1 else 'years'}",
                                "date": ann_date,
                                "month": jm,
                                "day": jd
                            })

                        diff_days = (today_dt.date() - datetime(jy, jm, jd).date()).days
                        if 0 <= diff_days <= 60 or (jy == today_dt.year and jm == today_dt.month):
                            new_joinings.append({
                                "name": fname,
                                "role": role,
                                "date": f"{jd:02d} {month_abbrs[jm-1]}",
                                "diff_days": diff_days
                            })
                    except Exception:
                        pass

                prob_end_str = str(b.get("probation_end_date") or "")
                if b.get("has_probation") and len(prob_end_str) >= 10:
                    try:
                        py, pm, pd = int(prob_end_str[:4]), int(prob_end_str[5:7]), int(prob_end_str[8:10])
                        days_left = (datetime(py, pm, pd).date() - today_dt.date()).days
                        if days_left >= 0:
                            probations.append({
                                "name": fname,
                                "role": role,
                                "date": f"{pd:02d} {month_abbrs[pm-1]}",
                                "raw_date": prob_end_str[:10],
                                "days_left": days_left
                            })
                    except Exception:
                        pass

                last_w_date = str(w.get("last_working_date") or b.get("resignation_date") or b.get("bond_end_date") or "")
                if last_w_date and len(last_w_date) >= 10:
                    try:
                        ey, em, ed = int(last_w_date[:4]), int(last_w_date[5:7]), int(last_w_date[8:10])
                        exits.append({
                            "name": fname,
                            "role": role,
                            "date": f"{ed:02d} {month_abbrs[em-1]}",
                            "raw_date": last_w_date[:10],
                            "isIntern": "intern" in role.lower()
                        })
                    except Exception:
                        pass

            anniversaries.sort(key=lambda x: (abs(x["month"] - today_dt.month), abs(x["day"] - today_dt.day)))
            new_joinings.sort(key=lambda x: x.get("diff_days", 99))
            probations.sort(key=lambda x: x["days_left"])

            return {
                "interviews": interviews,
                "anniversaries": anniversaries[:6],
                "new_joinings": new_joinings[:6],
                "probations": probations,
                "exits": exits[:6]
            }

        async def performance_and_attention_block():
            """Top 5 / bottom 3 from the PREVIOUS calendar month's Employee-of-the-Month result."""
            eom = await get_previous_month_eom()
            period, board, max_total = eom["period"], eom["board"], eom["max_total"]

            def pct(entry):
                return round(float(entry.get("totalScore") or 0) / max_total * 100)

            top = board[:5]
            top_performers = [
                {"name": e.get("name") or "Employee", "score": pct(e), "rank": e.get("rank"),
                 "month": period["month"], "year": period["year"]}
                for e in top
            ]
            # Bottom 3, lowest first, never repeating someone already in the top 5
            needs_attention = [
                {"name": e.get("name") or "Employee", "dept": e.get("department") or "General", "score": pct(e)}
                for e in reversed(board[len(top):][-3:])
            ]
            return {
                "top_performers": top_performers,
                "needs_attention": needs_attention,
                "performance_period": period,
            }

        results = await asyncio.gather(
            safe(TaskRepository.get_stats(user_id), {}),
            safe(TaskService.get_daily_overview(user_id), {"today": [], "upcoming": []}),
            safe(PenaltyService.get_summary_stats(), {}),
            safe(PenaltyService.get_leaderboard(month=m, year=y), {}),
            safe(AttendanceService.get_eom_summary(str(m), y, None, "Employee", user_id), {}),
            safe(RemarkService.get_overview({"_id": user_id, "work_details": {"system_role": "Employee"}}), {}),
            safe(projects_summary(), {}),
            safe(notifications_unread(), {"unread_count": 0, "latest": []}),
            safe(clients_outstanding(), {}),
            safe(wfh_block(), {"total": 0, "count": 0, "names": [], "pct": 0}),
            safe(eom_block(), {"winners": []}),
            safe(company_health(), {}),
            safe(tasks_clients_block(), {}),
            safe(departments_block(), []),
            safe(sales_block(), {}),
            safe(attendance_heatmap_block(), {"daily": {}, "total_employees": 0}),
            safe(hr_updates_block(), {"interviews": [], "anniversaries": [], "new_joinings": [], "probations": [], "exits": []}),
            safe(performance_and_attention_block(), {"top_performers": [], "needs_attention": []}),
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
            "wfh": results[9] or {},
            "eom": results[10] or {},
            "health": results[11] or {},
            "tasks_clients": results[12] or {},
            "departments": results[13] or [],
            "sales": results[14] or {},
            "attendance_heatmap": results[15] or {},
            "hr_updates": results[16] or {},
            "top_performers": (results[17] or {}).get("top_performers", []),
            "needs_attention": (results[17] or {}).get("needs_attention", []),
            "performance_period": (results[17] or {}).get("performance_period", {}),
        }
        # cross-block reuse (no extra queries)
        try:
            proj = payload.get("projects") or {}
            tstats = payload.get("tasks") or {}
            h = payload.get("health") or {}
            h["running_projects"] = proj.get("active", 0)
            h["pending_tasks"] = (
                int(tstats.get("todo") or 0) + int(tstats.get("inprogress") or 0) + int(tstats.get("inreview") or 0)
            )
            payload["health"] = h
            tc = payload.get("tasks_clients") or {}
            tc["my_tasks"] = [
                {
                    "title": t.get("title") or "Task",
                    "status": str(t.get("status") or "todo"),
                    "assignee": t.get("task_category") or "General",
                    "due": (str(t.get("due_date") or "")[:10] or "—"),
                }
                for t in ((payload.get("today") or {}).get("today") or [])
            ][:6]
            tc["satisfaction"] = (payload.get("remarks") or {}).get("average_satisfaction", 0)
            payload["tasks_clients"] = tc
        except Exception:
            pass
        try:
            await set_cache(cache_key, payload, ttl=60)
        except Exception:
            pass
        return payload
