"""Work Logs page: what each employee worked on, built from attendance.

Every punch-in and every "Change Active Task" adds an entry to the day's attendance `task_history`
(task + start time). A task runs until the next task starts, the employee punches out, or now if the
session is still open. Time outside punches and on breaks is not counted.
"""
from datetime import datetime, timedelta
from typing import Optional

from bson import ObjectId
from fastapi import HTTPException, status

from app.database.db import get_database
from app.repository.attendance import AttendanceRepository
from app.services.salary import IST, _today

MAX_RANGE_DAYS = 92


def _minutes(value) -> Optional[int]:
    """'09:30 AM' / '18:30' -> minutes since midnight."""
    text = str(value or "").strip()
    if not text or text == "--":
        return None
    for fmt in ("%I:%M %p", "%I:%M:%S %p", "%H:%M", "%H:%M:%S"):
        try:
            t = datetime.strptime(text, fmt)
            return t.hour * 60 + t.minute
        except ValueError:
            continue
    return None


def _clock(minutes: int) -> str:
    h, m = divmod(int(minutes) % (24 * 60), 60)
    return f"{h % 12 or 12:02d}:{m:02d} {'AM' if h < 12 else 'PM'}"


def _overlap(a: tuple, b: tuple) -> int:
    return max(0, min(a[1], b[1]) - max(a[0], b[0]))


def can_view_all_logs(user: dict) -> bool:
    work = user.get("work_details") or {}
    role = str(work.get("system_role") or user.get("system_role") or user.get("role") or "").strip().lower()
    return role in ("admin", "superadmin", "sub-admin", "subadmin", "hr") or str(work.get("department") or "").strip().lower() == "hr"


async def _task_projects(task_ids: set) -> dict:
    """task_id -> project name (empty when the task has no project)."""
    db = get_database()
    ids = [ObjectId(t) for t in task_ids if t and ObjectId.is_valid(str(t))]
    if not ids:
        return {}
    task_project = {}
    async for t in db["tasks"].find({"_id": {"$in": ids}}, {"project_id": 1}):
        task_project[str(t["_id"])] = str(t.get("project_id") or "")
    project_ids = [ObjectId(p) for p in set(task_project.values()) if p and ObjectId.is_valid(p)]
    # Project name lives in general.project_name; fall back to the client's company name
    projects, client_ids = {}, set()
    if project_ids:
        async for p in db["projects"].find({"_id": {"$in": project_ids}}, {"general": 1, "client_id": 1}):
            general = p.get("general") if isinstance(p.get("general"), dict) else {}
            projects[str(p["_id"])] = (general.get("project_name") or "", str(p.get("client_id") or ""))
            if p.get("client_id"):
                client_ids.add(str(p["client_id"]))
    clients = {}
    ids = [ObjectId(c) for c in client_ids if ObjectId.is_valid(c)]
    if ids:
        async for c in db["clients"].find({"_id": {"$in": ids}}, {"company_name": 1, "contact_person_name": 1}):
            clients[str(c["_id"])] = c.get("company_name") or c.get("contact_person_name") or ""
    names = {pid: (name or clients.get(cid, "")) for pid, (name, cid) in projects.items()}
    return {tid: names.get(pid, "") for tid, pid in task_project.items()}


def _day_entries(rec: dict, now_minutes: Optional[int]) -> list:
    """Task segments of one attendance day with worked time (punches minus breaks)."""
    history = [h for h in rec.get("task_history") or [] if h.get("task_title") and _minutes(h.get("started_at")) is not None]
    if not history:
        return []

    # Worked intervals from punches; an open punch runs until now (today) or the day's check-out
    day_end = _minutes(rec.get("check_out"))
    punches = []
    for p in rec.get("punches") or []:
        start, end = _minutes(p.get("check_in")), _minutes(p.get("check_out"))
        if start is None:
            continue
        if end is None:
            end = now_minutes if now_minutes is not None else (day_end if day_end is not None else start)
        punches.append((start, max(start, end)))
    if not punches:
        start = _minutes(rec.get("check_in"))
        end = day_end if day_end is not None else now_minutes
        if start is not None and end is not None:
            punches.append((start, max(start, end)))
    breaks = []
    for b in rec.get("breaks") or []:
        start = _minutes(b.get("start_time"))
        end = _minutes(b.get("end_time"))
        if start is not None:
            breaks.append((start, end if end is not None else (now_minutes if now_minutes is not None else start)))

    last_out = max((p[1] for p in punches), default=None)
    open_session = now_minutes is not None and str(rec.get("status") or "") in ("Active", "Late", "Present", "On Break") \
        and str(rec.get("check_out") or "--") in ("", "--")

    entries = []
    for i, h in enumerate(history):
        start = _minutes(h["started_at"])
        is_last = i == len(history) - 1
        if not is_last:
            end = _minutes(history[i + 1]["started_at"])
        elif open_session:
            end = now_minutes
        else:
            end = last_out if last_out is not None else start
        end = max(start, end)
        seconds = 60 * sum(_overlap((start, end), p) for p in punches)
        seconds -= 60 * sum(_overlap((start, end), b) for b in breaks)
        entries.append({
            "task_id": h.get("task_id"),
            "task": h["task_title"],
            "type": h.get("task_type") or "Today's Work",
            "start": _clock(start),
            "end": "Now" if is_last and open_session else _clock(end),
            "seconds": max(0, seconds),
            "in_progress": bool(is_last and open_session),
            "start_minutes": start,
        })
    return entries


class WorkTimelineService:

    @staticmethod
    async def list(user: dict, start: Optional[str], end: Optional[str], employee_id: Optional[str]) -> dict:
        today = _today()
        end = end or today
        start = start or (datetime.strptime(end, "%Y-%m-%d") - timedelta(days=6)).strftime("%Y-%m-%d")
        if start > end:
            start, end = end, start
        if (datetime.strptime(end, "%Y-%m-%d") - datetime.strptime(start, "%Y-%m-%d")).days > MAX_RANGE_DAYS:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Pick a range of at most {MAX_RANGE_DAYS} days")

        view_all = can_view_all_logs(user)
        scope_id = (employee_id or None) if view_all else str(user.get("_id", ""))
        records = await AttendanceRepository.get_records(employee_id=scope_id, start_date=start, end_date=end)

        now = datetime.now(IST)
        now_minutes = now.hour * 60 + now.minute
        logs, task_ids = [], set()
        for rec in records:
            day_now = now_minutes if rec.get("date") == today else None
            for e in _day_entries(rec, day_now):
                task_ids.add(e["task_id"])
                logs.append({
                    "id": f"{rec.get('id') or rec.get('_id')}-{e['start_minutes']}-{len(logs)}",
                    "employee_id": rec.get("employee_id"),
                    "employee": rec.get("employee_name") or "Employee",
                    "avatar": rec.get("avatar") or "",
                    "department": rec.get("department") or "",
                    "date": rec.get("date"),
                    **e,
                })

        projects = await _task_projects(task_ids)
        for log in logs:
            log["project"] = projects.get(str(log.get("task_id") or ""), "")
            log["hours"] = round(log["seconds"] / 3600, 2)
        logs.sort(key=lambda l: (l["date"], l["start_minutes"]), reverse=True)

        return {
            "can_view_all": view_all,
            "start": start,
            "end": end,
            "logs": logs,
            "summary": {
                "total_seconds": sum(l["seconds"] for l in logs),
                "entries": len(logs),
                "employees": len({l["employee_id"] for l in logs}),
                "active_now": len({l["employee_id"] for l in logs if l["in_progress"]}),
            },
        }
