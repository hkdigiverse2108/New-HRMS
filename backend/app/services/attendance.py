import calendar
import re
from datetime import datetime, time, timedelta
from typing import Optional, List, Dict, Any
from fastapi import HTTPException, status
import pytz

from app.repository.attendance import AttendanceRepository
from app.repository.leave import LeaveRepository
from app.repository.employee import EmployeeRepository
from app.repository.payroll import PayrollRepository
from app.redis.service import get_cache, set_cache, delete_cache, clear_pattern, make_list_key

IST = pytz.timezone("Asia/Kolkata")

async def get_company_leave_holidays(year: int, month: int) -> List[str]:
    """Fetch company leave holidays from payroll settings & schedule_events for given year/month, omitting deleted/excluded holidays."""
    result = []
    excluded_ids = set()
    excluded_dates = set()

    try:
        from app.database.db import get_database
        db = get_database()
        excluded_cursor = db["excluded_schedule_events"].find({}, {"event_id": 1, "date": 1})
        excluded_docs = await excluded_cursor.to_list(length=5000)
        excluded_ids = {str(d.get("event_id")) for d in excluded_docs if d.get("event_id")}
        excluded_dates = {str(d.get("date")) for d in excluded_docs if d.get("date")}
    except Exception:
        db = None

    try:
        settings = await PayrollRepository.get_settings()
        holidays = settings.get("holidays", [])
        for h in holidays:
            if h.get("isCompanyLeave") and h.get("date"):
                h_date = h["date"]
                h_id = str(h.get("id") or "")
                if h_id in excluded_ids or h_date in excluded_dates:
                    continue
                if h_date.startswith(f"{year:04d}-{month:02d}-"):
                    result.append(h_date)
    except Exception:
        pass

    try:
        if db is None:
            from app.database.db import get_database
            db = get_database()
        cursor = db["schedule_events"].find({
            "date": {"$regex": f"^{year:04d}-{month:02d}-"},
            "$or": [
                {"category": {"$in": ["company_leave", "google_holidays", "holiday"]}},
                {"type": {"$in": ["Company Leave", "Holiday", "Public Holiday"]}}
            ]
        })
        sched_holidays = await cursor.to_list(length=100)
        for sh in sched_holidays:
            sh_id = str(sh.get("_id") or sh.get("id") or "")
            d_val = sh.get("date")
            if sh_id in excluded_ids or (d_val in excluded_dates and sh.get("category") == "google_holidays"):
                continue
            if d_val and d_val not in result:
                result.append(d_val)
    except Exception:
        pass

    return result

def get_now_ist() -> datetime:
    return datetime.now(IST)

def format_time_ist(dt: datetime) -> str:
    return dt.strftime("%I:%M %p")

def format_date_ist(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d")

def parse_time_str(time_str: str) -> Optional[time]:
    """Parse time strings like '09:30 AM', '18:30', '18:30:00' into time object."""
    if not time_str or time_str == "--":
        return None
    time_str = time_str.strip()
    for fmt in ("%I:%M %p", "%I:%M%p", "%H:%M:%S", "%H:%M"):
        try:
            return datetime.strptime(time_str, fmt).time()
        except ValueError:
            continue
    return None

def compute_duration_seconds(t_start: time, t_end: time) -> int:
    """Computes difference in seconds between two times within the same day."""
    dt_start = datetime.combine(datetime.today(), t_start)
    dt_end = datetime.combine(datetime.today(), t_end)
    diff = (dt_end - dt_start).total_seconds()
    return int(diff) if diff >= 0 else 0

def format_seconds_to_hours(seconds: int) -> str:
    if seconds <= 0:
        return "0h 0m"
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    if hours == 0 and minutes == 0:
        return f"{seconds % 60}s"
    if hours == 0:
        return f"{minutes}m"
    return f"{hours}h {minutes}m"

def calculate_live_work_and_break_seconds(record: Dict[str, Any], now_dt: Optional[datetime] = None) -> Dict[str, Any]:
    """Calculates live gross work, total break, and net work seconds for today's session."""
    if not record:
        return {
            "gross_seconds": 0,
            "break_seconds": 0,
            "net_work_seconds": 0,
            "work_hours": "0h 0m",
            "break_hours": "0h 0m"
        }

    if now_dt is None:
        now_dt = get_now_ist()
    t_now = now_dt.time()

    current_status = record.get("status")
    breaks = record.get("breaks", [])
    total_break_seconds = 0
    for b in breaks:
        b_end = b.get("end_time") or b.get("endTime")
        b_dur = b.get("duration_seconds", 0)
        if b_end and b_end != "--":
            if b_dur:
                total_break_seconds += b_dur
            else:
                t_b_start = parse_time_str(b.get("start_time") or b.get("startTime"))
                t_b_end = parse_time_str(b_end)
                if t_b_start and t_b_end:
                    total_break_seconds += compute_duration_seconds(t_b_start, t_b_end)
        else:
            # Currently active open break
            if current_status == "On Break":
                start_iso = b.get("start_iso")
                if start_iso:
                    try:
                        s_dt = datetime.fromisoformat(start_iso)
                        dur = max(0, int((now_dt - s_dt).total_seconds()))
                        total_break_seconds += dur
                    except Exception:
                        t_b_start = parse_time_str(b.get("start_time") or b.get("startTime"))
                        if t_b_start:
                            total_break_seconds += compute_duration_seconds(t_b_start, t_now)
                else:
                    t_b_start = parse_time_str(b.get("start_time") or b.get("startTime"))
                    if t_b_start:
                        total_break_seconds += compute_duration_seconds(t_b_start, t_now)

    # Gross work seconds across punches
    punches = record.get("punches", [])
    gross_seconds = 0
    if punches:
        for p in punches:
            p_in = p.get("check_in") or p.get("punchIn")
            p_out = p.get("check_out") or p.get("punchOut")
            p_dur = p.get("duration_seconds", 0)
            if p_out and p_out != "--":
                if p_dur:
                    gross_seconds += p_dur
                else:
                    t_p_in = parse_time_str(p_in)
                    t_p_out = parse_time_str(p_out)
                    if t_p_in and t_p_out:
                        gross_seconds += compute_duration_seconds(t_p_in, t_p_out)
            else:
                # Active open punch session
                if current_status in ("Active", "Late", "Present", "On Break"):
                    t_p_in = parse_time_str(p_in)
                    if t_p_in:
                        gross_seconds += compute_duration_seconds(t_p_in, t_now)
    else:
        # Fallback to record-level check_in
        rec_in = record.get("check_in")
        rec_out = record.get("check_out")
        if rec_in and rec_in != "--":
            t_rec_in = parse_time_str(rec_in)
            if rec_out and rec_out != "--":
                t_rec_out = parse_time_str(rec_out)
                if t_rec_in and t_rec_out:
                    gross_seconds = compute_duration_seconds(t_rec_in, t_rec_out)
            else:
                if t_rec_in and current_status in ("Active", "Late", "Present", "On Break"):
                    gross_seconds = compute_duration_seconds(t_rec_in, t_now)

    # If already logged/closed and net_work_seconds exists in DB, preserve it
    if current_status == "Logged" and record.get("net_work_seconds"):
        net_seconds = record.get("net_work_seconds", 0)
        total_break_seconds = record.get("break_seconds", total_break_seconds)
        gross_seconds = record.get("gross_seconds", gross_seconds)
    else:
        net_seconds = max(0, gross_seconds - total_break_seconds)

    return {
        "gross_seconds": gross_seconds,
        "break_seconds": total_break_seconds,
        "net_work_seconds": net_seconds,
        "work_hours": format_seconds_to_hours(net_seconds),
        "break_hours": format_seconds_to_hours(total_break_seconds)
    }

def build_timeline_logs(record: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Builds a sequential, chronological list of punch and break events for timeline display."""
    logs: List[Dict[str, Any]] = []
    punches = record.get("punches", [])
    breaks = record.get("breaks", [])

    if punches:
        for idx, p in enumerate(punches):
            session_num = idx + 1
            cin = p.get("check_in") or p.get("punchIn")
            cout = p.get("check_out") or p.get("punchOut")
            if cin and cin != "--":
                logs.append({
                    "action": f"Punched In (Session {session_num})",
                    "time": cin,
                    "type": "punch_in"
                })
            if cout and cout != "--":
                logs.append({
                    "action": f"Punched Out (Session {session_num})",
                    "time": cout,
                    "type": "punch_out"
                })
    elif (record.get("check_in") or record.get("checkIn")) and (record.get("check_in") or record.get("checkIn")) != "--":
        cin = record.get("check_in") or record.get("checkIn")
        logs.append({
            "action": "Punched In (Session 1)",
            "time": cin,
            "type": "punch_in"
        })
        cout = record.get("check_out") or record.get("checkOut")
        if cout and cout != "--":
            logs.append({
                "action": "Punched Out (Session 1)",
                "time": cout,
                "type": "punch_out"
            })

    for b in breaks:
        b_start = b.get("start_time") or b.get("startTime")
        b_end = b.get("end_time") or b.get("endTime")
        dur_sec = b.get("duration_seconds", 0)
        dur_str = ""
        if dur_sec:
            m = dur_sec // 60
            s = dur_sec % 60
            dur_str = f" ({m}m)" if m > 0 else f" ({s}s)"
        elif b_start and b_end:
            t1 = parse_time_str(b_start)
            t2 = parse_time_str(b_end)
            if t1 and t2:
                sec = compute_duration_seconds(t1, t2)
                m = sec // 60
                dur_str = f" ({m}m)" if m > 0 else f" ({sec % 60}s)"

        if b_start:
            logs.append({
                "action": "Break Start",
                "time": b_start,
                "type": "break_start"
            })
        if b_end:
            logs.append({
                "action": f"Break End{dur_str}",
                "time": b_end,
                "type": "break_end"
            })

    def get_sort_minutes(item: Dict[str, Any]) -> int:
        t = parse_time_str(item.get("time", ""))
        return (t.hour * 60 + t.minute) if t else 0

    logs.sort(key=get_sort_minutes)
    return logs

class AttendanceService:

    @classmethod
    async def get_employee_info(cls, employee_id: str) -> Dict[str, Any]:
        """Helper to fetch employee metadata for attendance records."""
        try:
            emp = await EmployeeRepository.get_employee_by_id(employee_id)
            if not emp:
                emp = await EmployeeRepository.get_employee_by_email(employee_id)
            if emp:
                personal = emp.get("personal_info", {})
                work = emp.get("work_details", {})
                name = f"{personal.get('first_name', '')} {personal.get('last_name', '')}".strip() or "Employee"
                return {
                    "name": name,
                    "role": work.get("designation", "Staff"),
                    "department": work.get("department", "General"),
                    "avatar": personal.get("profile_photo", "") or personal.get("avatar", ""),
                    "actively_using_hrms": work.get("actively_using_hrms", True)
                }
        except Exception:
            pass
        return {
            "name": "Employee",
            "role": "Staff",
            "department": "General",
            "avatar": "",
            "actively_using_hrms": True
        }

    @classmethod
    async def get_late_cutoff(cls, employee_id: str) -> time:
        """Latest punch-in time not counted as late: the employee's start time
        (Employee List) plus the late coming grace from Payroll Settings."""
        start = time(9, 30)
        try:
            emp = await EmployeeRepository.get_employee_by_id(employee_id)
            if not emp:
                emp = await EmployeeRepository.get_employee_by_email(employee_id)
            emp_start = parse_time_str(str((emp or {}).get("work_details", {}).get("start_time") or ""))
            if emp_start:
                start = emp_start
        except Exception:
            pass

        grace_minutes = 10
        try:
            settings = await PayrollRepository.get_settings()
            raw_grace = settings.get("lateGrace")
            if raw_grace not in (None, ""):
                match = re.search(r"\d+", str(raw_grace))
                if match:
                    grace_minutes = int(match.group())
        except Exception:
            pass

        cutoff = datetime.combine(datetime.today(), start) + timedelta(minutes=grace_minutes)
        if cutoff.date() != datetime.today().date():
            return time(23, 59, 59)
        return cutoff.time()

    @classmethod
    async def get_today_record_robust(cls, employee_id: str, today_str: str) -> Optional[Dict[str, Any]]:
        """Finds today's attendance record with robust resolution across employee_id, ObjectId, and email."""
        record = await AttendanceRepository.get_by_employee_and_date(employee_id, today_str)
        if not record:
            emp = await EmployeeRepository.get_employee_by_id(employee_id)
            if not emp:
                emp = await EmployeeRepository.get_employee_by_email(employee_id)
            if emp:
                emp_oid = str(emp.get("_id") or emp.get("id"))
                if emp_oid != employee_id:
                    record = await AttendanceRepository.get_by_employee_and_date(emp_oid, today_str)
                if not record:
                    emp_code = emp.get("work_details", {}).get("employee_id") or emp.get("employee_id")
                    if emp_code and emp_code != employee_id and emp_code != emp_oid:
                        record = await AttendanceRepository.get_by_employee_and_date(str(emp_code), today_str)
        return record

    @classmethod
    async def check_pending_punch_out(cls, employee_id: str) -> Dict[str, Any]:
        """
        Checks if the employee's last attendance record has a checkIn but NO checkOut.
        If the record date is before today, it's a pending unclosed session that MUST be resolved.
        """
        last = await AttendanceRepository.get_last_record(employee_id)
        if not last:
            return {"has_pending": False, "pending_record": None}

        today_str = format_date_ist(get_now_ist())
        record_date = last.get("date", "")

        has_check_in = last.get("check_in") and last.get("check_in") != "--"
        has_check_out = last.get("check_out") and last.get("check_out") != "--"

        # If previous date has check-in but no check-out, it's an unclosed pending session!
        if record_date < today_str and has_check_in and not has_check_out:
            return {
                "has_pending": True,
                "pending_record": {
                    "record_id": last["id"],
                    "date": record_date,
                    "check_in": last.get("check_in"),
                    "employee_name": last.get("employee_name", "Employee")
                }
            }

        return {"has_pending": False, "pending_record": None}

    @classmethod
    async def resolve_pending_punch_out(
        cls,
        employee_id: str,
        record_id: str,
        punch_out_time_str: str,
        date_str: str
    ) -> Dict[str, Any]:
        """
        Resolves an unclosed session from a past date.
        Strict validation: selected punch-out time MUST be after punch-in time!
        """
        record = await AttendanceRepository.get_record_by_id(record_id)
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Attendance record not found."
            )

        check_in_str = record.get("check_in")
        t_in = parse_time_str(check_in_str)
        t_out = parse_time_str(punch_out_time_str)

        if not t_in or not t_out:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid punch-in or punch-out time format."
            )

        if t_out <= t_in:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Selected punch-out time ({punch_out_time_str}) must be strictly after punch-in time ({check_in_str})."
            )

        # Apply punch-out calculation
        gross_seconds = compute_duration_seconds(t_in, t_out)
        break_seconds = record.get("break_seconds", 0)
        net_seconds = max(0, gross_seconds - break_seconds)
        work_hours_str = format_seconds_to_hours(net_seconds)
        formatted_out = t_out.strftime("%I:%M %p")

        # Close open punches/breaks if any
        punches = record.get("punches", [])
        if punches and not punches[-1].get("check_out"):
            punches[-1]["check_out"] = formatted_out
            punches[-1]["duration_seconds"] = gross_seconds

        breaks = record.get("breaks", [])
        for b in breaks:
            if not b.get("end_time"):
                b["end_time"] = formatted_out

        update_data = {
            "check_out": formatted_out,
            "status": "Logged",
            "gross_seconds": gross_seconds,
            "break_seconds": break_seconds,
            "net_work_seconds": net_seconds,
            "work_hours": work_hours_str,
            "punches": punches,
            "breaks": breaks,
            "resolved_at": datetime.utcnow().isoformat()
        }

        await AttendanceRepository.update_record(record_id, update_data)
        updated = await AttendanceRepository.get_record_by_id(record_id)
        return updated or update_data

    @classmethod
    async def punch_in(
        cls,
        employee_id: str,
        notes: Optional[str] = None,
        task_id: Optional[str] = None,
        task_title: Optional[str] = None,
        task_type: Optional[str] = "Today's Work"
    ) -> Dict[str, Any]:
        """
        Handles Punch-In with Task Association.
        1. Checks for pending punch-out from past dates.
        2. Applies Late Detection against the employee's start time + Payroll Settings late grace.
        3. Checks for approved half-day leave for today.
        4. Resumes session if already punched out today.
        5. Associates current task and records task history.
        """
        # Step 1: Safety check for pending punch-out
        pending_check = await cls.check_pending_punch_out(employee_id)
        if pending_check["has_pending"]:
            pend = pending_check["pending_record"]
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Pending Punch-Out detected for {pend['date']} (Punch-In was at {pend['check_in']}). You must resolve it before punching in for today."
            )

        now = get_now_ist()
        today_str = format_date_ist(now)
        current_time_str = format_time_ist(now)

        # Step 2: Late detection (employee start time + Payroll Settings late grace)
        office_start_buffer = await cls.get_late_cutoff(employee_id)
        is_late = now.time() > office_start_buffer
        late_remark = "Late Punch-in Penalty Remark" if is_late else None

        # Step 3: Half-day leave check
        approved_leave = await LeaveRepository.get_approved_leave_for_date(employee_id, today_str)
        leave_remark = None
        if approved_leave:
            day_type = approved_leave.get("day_type", "")
            if "First Half" in day_type:
                leave_remark = "On Leave: First Half"
            elif "Second Half" in day_type:
                leave_remark = "On Leave: Second Half"
            elif day_type == "Half Day":
                leave_remark = "On Leave: Half Day"

        # Check existing record for today (Resume Session if re-punching in)
        today_record = await cls.get_today_record_robust(employee_id, today_str)

        if today_record:
            current_status = today_record.get("status")
            punches = today_record.get("punches", [])
            has_unclosed_punch = False
            if punches:
                last_p = punches[-1]
                if not last_p.get("check_out") or last_p.get("check_out") == "--":
                    has_unclosed_punch = True
            elif today_record.get("check_in") and today_record.get("check_in") != "--":
                if not today_record.get("check_out") or today_record.get("check_out") == "--":
                    has_unclosed_punch = True

            # If user has an open active session without punch out
            if has_unclosed_punch and current_status in ("Active", "On Break", "Late"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="You are already punched in. Please punch out first before punching in again."
                )

            # Resuming today's session
            punches = today_record.get("punches", [])
            if punches and (not punches[-1].get("check_out") or punches[-1].get("check_out") == "--"):
                punches[-1]["check_out"] = current_time_str
            punches.append({
                "check_in": current_time_str,
                "check_out": None,
                "duration_seconds": 0
            })
            remarks = today_record.get("remarks", [])
            if leave_remark and leave_remark not in remarks:
                remarks.append(leave_remark)
                
            # Re-evaluate is_late based on the first check-in to fix any corrupted states
            original_check_in = today_record.get("check_in")
            is_late_recalc = today_record.get("is_late", False)
            if original_check_in and original_check_in != "--":
                t_first = parse_time_str(original_check_in)
                if t_first:
                    is_late_recalc = t_first > office_start_buffer

            if not is_late_recalc and "Late Punch-in Penalty Remark" in remarks:
                remarks.remove("Late Punch-in Penalty Remark")

            task_history = today_record.get("task_history", [])
            if task_title:
                task_history.append({
                    "task_id": task_id,
                    "task_title": task_title,
                    "task_type": task_type or "Today's Work",
                    "started_at": current_time_str
                })

            update_data = {
                "status": "Active",
                "punches": punches,
                "is_late": is_late_recalc,
                "remarks": remarks,
                "check_out": "--"
            }
            if task_title:
                update_data["current_task_id"] = task_id
                update_data["current_task_title"] = task_title
                update_data["current_task_type"] = task_type or "Today's Work"
                update_data["task_history"] = task_history

            # Keep original check_in if already present
            if not today_record.get("check_in") or today_record.get("check_in") == "--":
                update_data["check_in"] = current_time_str

            await AttendanceRepository.update_record(today_record["id"], update_data)
            updated = await AttendanceRepository.get_record_by_id(today_record["id"])
            await set_cache(f"attendance:active:{employee_id}", {
                "status": "Active",
                "check_in": updated.get("check_in"),
                "current_task_id": task_id or updated.get("current_task_id"),
                "current_task_title": task_title or updated.get("current_task_title"),
                "record_id": updated.get("id"),
                "date": today_str
            }, ttl=86400)
            await delete_cache(f"attendance:last:{employee_id}")
            await clear_pattern("attendance:*")
            return updated

        # New record for today
        emp_info = await cls.get_employee_info(employee_id)
        remarks_list = []
        if late_remark:
            remarks_list.append(late_remark)
        if leave_remark:
            remarks_list.append(leave_remark)

        status_text = "Late" if is_late else "Active"

        if is_late:
            try:
                from app.services.penalty import PenaltyService
                from app.schemas.penalty import EmployeePenaltyCreate
                late_penalty_id = await PenaltyService.ensure_late_punchin_penalty_type()
                
                # Check if penalty already exists for today to prevent duplicates
                existing_penalties = await PenaltyService.get_all_penalties(
                    employee_id=employee_id, 
                    penalty_type_id=late_penalty_id, 
                    start_date=today_str, 
                    end_date=today_str
                )
                if not existing_penalties.get("data"):
                    penalty_data = EmployeePenaltyCreate(
                        employee_id=employee_id,
                        penalty_type_id=late_penalty_id,
                        reason="Automatic penalty for Late Punch-in",
                        penalty_date=datetime.strptime(today_str, "%Y-%m-%d").date()
                    )
                    await PenaltyService.create_employee_penalty(penalty_data)
                    await clear_pattern("penalties:list:*")
                    await delete_cache("penalties:leaderboard")
                    await delete_cache("penalties:summary")
            except Exception as e:
                print(f"Failed to auto-assign late penalty: {e}")

        task_history = []
        if task_title:
            task_history.append({
                "task_id": task_id,
                "task_title": task_title,
                "task_type": task_type or "Today's Work",
                "started_at": current_time_str
            })

        new_doc = {
            "employee_id": employee_id,
            "employee_name": emp_info["name"],
            "role": emp_info["role"],
            "department": emp_info["department"],
            "avatar": emp_info["avatar"],
            "date": today_str,
            "status": status_text,
            "check_in": current_time_str,
            "check_out": "--",
            "gross_seconds": 0,
            "break_seconds": 0,
            "net_work_seconds": 0,
            "work_hours": "--",
            "break_hours": "--",
            "is_late": is_late,
            "late_remark": late_remark,
            "remarks": remarks_list,
            "current_task_id": task_id,
            "current_task_title": task_title,
            "current_task_type": task_type or "Today's Work",
            "task_history": task_history,
            "punches": [{
                "check_in": current_time_str,
                "check_out": None,
                "duration_seconds": 0
            }],
            "breaks": [],
            "created_at": datetime.utcnow().isoformat()
        }

        created = await AttendanceRepository.create_record(new_doc)
        await set_cache(f"attendance:active:{employee_id}", {
            "status": status_text,
            "check_in": current_time_str,
            "current_task_id": task_id,
            "current_task_title": task_title,
            "record_id": created.get("id"),
            "date": today_str
        }, ttl=86400)
        await clear_pattern("attendance:list:*")
        await clear_pattern(f"attendance:summary:{employee_id}:*")
        return created

    @classmethod
    async def change_active_task(
        cls,
        employee_id: str,
        task_id: Optional[str] = None,
        task_title: Optional[str] = None,
        task_type: Optional[str] = "Today's Work"
    ) -> Dict[str, Any]:
        """Updates the active working task during an active punched-in session."""
        now = get_now_ist()
        today_str = format_date_ist(now)
        current_time_str = format_time_ist(now)
        record = await AttendanceRepository.get_by_employee_and_date(employee_id, today_str)
        if not record:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active attendance record found for today.")

        task_history = record.get("task_history", [])
        if task_title:
            task_history.append({
                "task_id": task_id,
                "task_title": task_title,
                "task_type": task_type or "Today's Work",
                "started_at": current_time_str
            })

        update_data = {
            "current_task_id": task_id,
            "current_task_title": task_title,
            "current_task_type": task_type or "Today's Work",
            "task_history": task_history
        }
        await AttendanceRepository.update_record(record["id"], update_data)
        updated = await AttendanceRepository.get_record_by_id(record["id"])
        await set_cache(f"attendance:active:{employee_id}", {
            "status": updated.get("status"),
            "check_in": updated.get("check_in"),
            "current_task_id": task_id,
            "current_task_title": task_title,
            "record_id": updated.get("id"),
            "date": today_str
        }, ttl=86400)
        await clear_pattern("attendance:list:*")
        return updated

    @classmethod
    async def break_in(cls, employee_id: str, reason: Optional[str] = None) -> Dict[str, Any]:
        """Pauses active work and starts a break entry."""
        now = get_now_ist()
        today_str = format_date_ist(now)
        record = await AttendanceRepository.get_by_employee_and_date(employee_id, today_str)

        if not record or record.get("status") not in ("Active", "Late", "Present"):
            if record and record.get("status") == "On Break":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="You are already on a break."
                )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You must be actively punched in to take a break."
            )

        current_time_str = format_time_ist(now)
        breaks = record.get("breaks", [])
        breaks.append({
            "start_time": current_time_str,
            "start_iso": now.isoformat(),
            "end_time": None,
            "end_iso": None,
            "duration_seconds": 0,
            "reason": reason
        })

        update_data = {
            "status": "On Break",
            "breaks": breaks
        }
        await AttendanceRepository.update_record(record["id"], update_data)
        updated = await AttendanceRepository.get_record_by_id(record["id"])
        await set_cache(f"attendance:active:{employee_id}", {
            "status": "On Break",
            "break_start": current_time_str,
            "record_id": record["id"],
            "date": today_str
        }, ttl=86400)
        await clear_pattern("attendance:list:*")
        return updated

    @classmethod
    async def break_out(cls, employee_id: str) -> Dict[str, Any]:
        """Closes the current break and resumes active session with exact second precision."""
        now = get_now_ist()
        today_str = format_date_ist(now)
        record = await AttendanceRepository.get_by_employee_and_date(employee_id, today_str)

        if not record:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No attendance record found.")

        if record.get("status") != "On Break":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You are not currently on a break."
            )

        current_time_str = format_time_ist(now)
        t_now = now.time()
        breaks = record.get("breaks", [])

        # Find the open break and calculate exact duration
        found_open = False
        for b in breaks:
            if not b.get("end_time"):
                b["end_time"] = current_time_str
                b["end_iso"] = now.isoformat()
                start_iso = b.get("start_iso")
                if start_iso:
                    try:
                        s_dt = datetime.fromisoformat(start_iso)
                        dur = max(0, int((now - s_dt).total_seconds()))
                    except Exception:
                        t_start = parse_time_str(b.get("start_time"))
                        dur = compute_duration_seconds(t_start, t_now) if t_start else 0
                else:
                    t_start = parse_time_str(b.get("start_time"))
                    dur = compute_duration_seconds(t_start, t_now) if t_start else 0

                b["duration_seconds"] = dur
                found_open = True
                break

        if not found_open:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No open break found to end.")

        # Clean, exact sum of all breaks prevents double accumulation
        total_break_seconds = sum(b.get("duration_seconds", 0) for b in breaks)
        break_hours_str = format_seconds_to_hours(total_break_seconds)

        update_data = {
            "status": "Active",
            "breaks": breaks,
            "break_seconds": total_break_seconds,
            "break_hours": break_hours_str
        }
        await AttendanceRepository.update_record(record["id"], update_data)
        updated = await AttendanceRepository.get_record_by_id(record["id"])
        await set_cache(f"attendance:active:{employee_id}", {
            "status": "Active",
            "break_seconds": total_break_seconds,
            "record_id": record["id"],
            "date": today_str
        }, ttl=86400)
        await clear_pattern("attendance:list:*")
        return updated

    @classmethod
    async def recover_break(
        cls,
        employee_id: str,
        date_str: str,
        break_start_time_str: str,
        actual_break_out_time_str: str
    ) -> Dict[str, Any]:
        """Recovers a missed break-out by updating the specific break's end time and recalculating net hours."""
        record = await AttendanceRepository.get_by_employee_and_date(employee_id, date_str)
        if not record:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attendance record not found for the given date.")

        t_start = parse_time_str(break_start_time_str)
        t_actual_out = parse_time_str(actual_break_out_time_str)

        if not t_start or not t_actual_out:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid break start or actual break out time format.")

        if t_actual_out <= t_start:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Actual break-out time must be after break start time.")

        # Ensure the actual break out time doesn't exceed check_out time if it exists and session is closed
        is_active_session = record.get("status") in ("Active", "On Break", "Late", "Present")
        if not is_active_session and record.get("check_out") and record.get("check_out") != "--":
            t_check_out = parse_time_str(record["check_out"])
            if t_check_out and t_actual_out > t_check_out:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Actual break-out time cannot be after the session check-out time.")

        breaks = record.get("breaks", [])
        target_break = None
        
        # Find the break that matches the start time
        for b in breaks:
            b_start = parse_time_str(b.get("start_time"))
            if b_start and b_start == t_start:
                target_break = b
                break

        if not target_break:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No break found starting at {break_start_time_str}.")

        # If the break already has an end_time, the user is likely correcting a late break-out.
        # The new actual break-out time MUST be less than or equal to the existing end_time.
        if target_break.get("end_time"):
            t_existing_end = parse_time_str(target_break["end_time"])
            if t_existing_end and t_actual_out > t_existing_end:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Actual break-out time ({actual_break_out_time_str}) cannot be after the existing break-out time ({target_break['end_time']})."
                )

        # Update the target break
        fmt_actual_out = datetime.combine(datetime.today(), t_actual_out).strftime("%I:%M %p")
        target_break["end_time"] = fmt_actual_out
        target_break["duration_seconds"] = compute_duration_seconds(t_start, t_actual_out)

        # Recalculate total break seconds
        total_break_seconds = 0
        for b in breaks:
            b_sec = b.get("duration_seconds", 0)
            total_break_seconds += b_sec

        break_hours_str = format_seconds_to_hours(total_break_seconds)

        # Recalculate net work seconds if gross_seconds > 0 (meaning punched out)
        gross_seconds = record.get("gross_seconds", 0)
        net_seconds = max(0, gross_seconds - total_break_seconds)
        work_hours_str = format_seconds_to_hours(net_seconds) if gross_seconds > 0 else "--"
        
        # Determine status. If it was "On Break" and this was the active break today, change to "Active"
        current_status = record.get("status")
        today_str = format_date_ist(get_now_ist())
        is_today = (date_str == today_str)

        update_data = {
            "breaks": breaks,
            "break_seconds": total_break_seconds,
            "break_hours": break_hours_str,
            "net_work_seconds": net_seconds
        }
        
        if gross_seconds > 0:
            update_data["work_hours"] = work_hours_str
            
        if current_status == "On Break" and is_today:
            # Check if there are any other open breaks
            has_open_breaks = any(not bk.get("end_time") for bk in breaks)
            if not has_open_breaks:
                update_data["status"] = "Active"

        await AttendanceRepository.update_record(record["id"], update_data)
        updated = await AttendanceRepository.get_record_by_id(record["id"])

        if is_today:
            await set_cache(f"attendance:active:{employee_id}", {
                "status": update_data.get("status", current_status),
                "break_seconds": total_break_seconds,
                "record_id": record["id"],
                "date": date_str
            }, ttl=86400)
            
        await clear_pattern("attendance:list:*")
        await clear_pattern(f"attendance:summary:{employee_id}:*")
        
        return updated

    @classmethod
    async def punch_out(cls, employee_id: str, notes: Optional[str] = None) -> Dict[str, Any]:
        """Applies punch-out to today's active session, calculating Gross and Net hours."""
        now = get_now_ist()
        today_str = format_date_ist(now)
        record = await cls.get_today_record_robust(employee_id, today_str)

        if not record or not record.get("check_in") or record.get("check_in") == "--":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active punch-in found for today.")

        return await cls._apply_punch_out_to_record(record, now)

    @classmethod
    async def _apply_punch_out_to_record(cls, record: Dict[str, Any], punch_out_dt: datetime) -> Dict[str, Any]:
        """Internal worker function to calculate work hours and close session."""
        current_time_str = format_time_ist(punch_out_dt)
        t_out = punch_out_dt.time()

        # 1. Close any open break
        breaks = record.get("breaks", [])
        for b in breaks:
            if not b.get("end_time"):
                b["end_time"] = current_time_str
                b["end_iso"] = punch_out_dt.isoformat()
                start_iso = b.get("start_iso")
                if start_iso:
                    try:
                        s_dt = datetime.fromisoformat(start_iso)
                        dur = max(0, int((punch_out_dt - s_dt).total_seconds()))
                    except Exception:
                        t_b_start = parse_time_str(b.get("start_time"))
                        dur = compute_duration_seconds(t_b_start, t_out) if t_b_start else 0
                else:
                    t_b_start = parse_time_str(b.get("start_time"))
                    dur = compute_duration_seconds(t_b_start, t_out) if t_b_start else 0
                b["duration_seconds"] = dur

        total_break_seconds = sum(b.get("duration_seconds", 0) for b in breaks)

        # 2. Close last punch
        punches = record.get("punches", [])
        if punches:
            last_punch = punches[-1]
            if not last_punch.get("check_out"):
                last_punch["check_out"] = current_time_str
                t_p_start = parse_time_str(last_punch.get("check_in"))
                if t_p_start:
                    last_punch["duration_seconds"] = compute_duration_seconds(t_p_start, t_out)

        # 3. Calculate Gross and Net Work Time across all punches
        if punches:
            gross_seconds = sum(
                p.get("duration_seconds", 0) or 
                (compute_duration_seconds(parse_time_str(p.get("check_in")), parse_time_str(p.get("check_out"))) if parse_time_str(p.get("check_in")) and parse_time_str(p.get("check_out")) else 0)
                for p in punches
            )
        else:
            t_first_in = parse_time_str(record.get("check_in")) or t_out
            gross_seconds = compute_duration_seconds(t_first_in, t_out)

        net_seconds = max(0, gross_seconds - total_break_seconds)

        work_hours_str = format_seconds_to_hours(net_seconds)
        break_hours_str = format_seconds_to_hours(total_break_seconds)

        update_data = {
            "check_out": current_time_str,
            "status": "Logged",
            "gross_seconds": gross_seconds,
            "break_seconds": total_break_seconds,
            "net_work_seconds": net_seconds,
            "work_hours": work_hours_str,
            "break_hours": break_hours_str,
            "punches": punches,
            "breaks": breaks,
            "updated_at": datetime.utcnow().isoformat()
        }

        await AttendanceRepository.update_record(record["id"], update_data)
        res = await AttendanceRepository.get_record_by_id(record["id"])
        emp_id = record.get("employee_id")
        if emp_id:
            await delete_cache(f"attendance:active:{emp_id}")
            await delete_cache(f"attendance:last:{emp_id}")
            await clear_pattern("attendance:*")
        return res

    @classmethod
    async def get_today_attendance(cls, employee_id: str) -> Dict[str, Any]:
        """
        Returns today's attendance state for an employee in IST.
        Includes live-calculated work seconds, break seconds, punches, and effective status.
        """
        now = get_now_ist()
        today_str = format_date_ist(now)
        record = await cls.get_today_record_robust(employee_id, today_str)

        if not record:
            return {
                "has_record": False,
                "status": "Punched Out",
                "effective_status": "Punched Out",
                "check_in": "--",
                "check_out": "--",
                "net_work_seconds": 0,
                "break_seconds": 0,
                "gross_seconds": 0,
                "work_hours": "0h 0m",
                "break_hours": "0h 0m",
                "current_task_id": None,
                "current_task_title": None,
                "current_task_type": None,
                "breaks": [],
                "punches": []
            }

        # Calculate live seconds
        live_times = calculate_live_work_and_break_seconds(record, now)
        record.update(live_times)
        record["has_record"] = True

        # Determine effective status
        punches = record.get("punches", [])
        has_open_punch = False
        if punches:
            last_p = punches[-1]
            if not last_p.get("check_out") or last_p.get("check_out") == "--":
                has_open_punch = True
        elif record.get("check_in") and record.get("check_in") != "--":
            if not record.get("check_out") or record.get("check_out") == "--":
                has_open_punch = True

        db_status = record.get("status")
        if db_status == "On Break":
            effective_status = "On Break"
        elif has_open_punch or (db_status in ("Active", "Late") and (not record.get("check_out") or record.get("check_out") == "--")):
            effective_status = "Punched In"
        elif db_status == "Logged" or (record.get("check_out") and record.get("check_out") != "--"):
            effective_status = "Punched Out"
        else:
            effective_status = "Punched Out"

        record["effective_status"] = effective_status
        return record

    @classmethod
    async def get_attendance_list(
        cls,
        employee_id: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        status: Optional[str] = None,
        page: Optional[int] = None,
        limit: Optional[int] = None,
        current_user_role: str = "Employee",
        current_user_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Role-scoped attendance list fetch with Redis caching:
        Admin & HR: Can view all employees or filter.
        Employee: Restricted ONLY to their own records.
        """
        scoped_emp_id = employee_id
        if current_user_role not in ("Admin", "HR"):
            scoped_emp_id = current_user_id or employee_id

        # Redis Cache Lookup
        cache_key = make_list_key(
            "attendance",
            employee_id=scoped_emp_id,
            start_date=start_date,
            end_date=end_date,
            status=status,
            page=page,
            limit=limit
        )
        cached = await get_cache(cache_key)
        if cached is not None:
            return cached

        records = await AttendanceRepository.get_records(
            employee_id=scoped_emp_id,
            start_date=start_date,
            end_date=end_date,
            status=status,
            page=page,
            limit=limit
        )
        today_str = format_date_ist(get_now_ist())
        for r in records:
            r["logs"] = build_timeline_logs(r)
            if r.get("date") == today_str and r.get("status") in ("Active", "Late", "On Break"):
                live_times = calculate_live_work_and_break_seconds(r)
                r.update(live_times)

        await set_cache(cache_key, records, ttl=300)
        return records

    @classmethod
    async def get_eom_summary(
        cls,
        month: str,
        year: int,
        employee_id: Optional[str] = None,
        current_user_role: str = "Employee",
        current_user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Calculates monthly summary:
        Working Days = Total days in month - Sundays - Company Holidays (assumed 1-2)
        Paid Leave vs LOP: Allowed paid leaves = 1.5/month.
        Performance score out of 15.
        """
        scoped_id = employee_id
        if current_user_role not in ("Admin", "HR"):
            scoped_id = current_user_id or employee_id

        # Month range
        month_idx = datetime.strptime(month, "%B").month if isinstance(month, str) and not month.isdigit() else int(month)
        _, total_days = calendar.monthrange(year, month_idx)
        start_date_str = f"{year:04d}-{month_idx:02d}-01"
        end_date_str = f"{year:04d}-{month_idx:02d}-{total_days:02d}"

        # Working days calculation (excluding Sundays and company leave holidays)
        sundays_count = 0
        company_leave_dates = await get_company_leave_holidays(year, month_idx)
        company_leave_count = len(company_leave_dates)
        for d in range(1, total_days + 1):
            date_str = f"{year:04d}-{month_idx:02d}-{d:02d}"
            if datetime(year, month_idx, d).weekday() == 6: # Sunday
                sundays_count += 1
        holidays_count = company_leave_count # company leave holidays
        working_days = max(1, total_days - sundays_count - holidays_count)

        # Fetch records
        records = await AttendanceRepository.get_records(
            employee_id=scoped_id,
            start_date=start_date_str,
            end_date=end_date_str
        )

        present_days = 0.0
        leave_days = 0.0

        for r in records:
            st = r.get("status", "")
            if st in ("Present", "Logged", "Active"):
                present_days += 1.0
            elif st == "On Leave":
                leave_days += 1.0
            elif st == "Late":
                present_days += 0.9

        allowed_paid_leaves = 1.5
        paid_leave_days = min(leave_days, allowed_paid_leaves)
        unapproved_absent = max(0.0, working_days - (present_days + leave_days))
        lop_days = max(0.0, (leave_days - allowed_paid_leaves)) + unapproved_absent

        # Performance score out of 15 (based on attendance ratio and punctuality)
        ratio = min(1.0, (present_days + paid_leave_days) / working_days)
        score = round(ratio * 15.0, 1)

        emp_info = await cls.get_employee_info(scoped_id) if scoped_id else {}

        return {
            "month": month,
            "year": year,
            "working_days": working_days,
            "present_days": round(present_days, 1),
            "paid_leave_days": round(paid_leave_days, 1),
            "lop_days": round(lop_days, 1),
            "performance_score": score,
            "employee_id": scoped_id,
            "employee_name": emp_info.get("name", "All Employees") if scoped_id else "All Employees"
        }

    @classmethod
    async def mark_manual_attendance(
        cls,
        date_str: str,
        status_val: str,
        employee_id: Optional[str] = None,
        employee_ids: Optional[List[str]] = None,
        check_in: Optional[str] = "09:30 AM",
        check_out: Optional[str] = "06:30 PM",
        remarks: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Manually marks attendance for selected active non-admin employees on a specific date.
        """
        target_emps = []
        if employee_ids and len(employee_ids) > 0:
            for eid in employee_ids:
                if not eid or eid.lower() == "all":
                    continue
                emp = await EmployeeRepository.get_employee_by_id(eid)
                if not emp:
                    emp = await EmployeeRepository.get_employee_by_email(eid)
                if emp:
                    target_emps.append(emp)
        elif employee_id and employee_id.lower() != "all":
            emp = await EmployeeRepository.get_employee_by_id(employee_id)
            if not emp:
                emp = await EmployeeRepository.get_employee_by_email(employee_id)
            if emp:
                target_emps.append(emp)
        else:
            all_result = await EmployeeRepository.get_all_employees()
            raw_emps = all_result.get("data", []) if isinstance(all_result, dict) else all_result
            # Only include active and non-admin employees
            target_emps = [
                e for e in raw_emps 
                if (e.get("work_details", {}).get("system_role") or "").lower() != "admin"
                and (e.get("status") or "active").lower() == "active"
            ]

        # Extra guard: Never mark attendance for Admin role
        target_emps = [
            e for e in target_emps 
            if (e.get("work_details", {}).get("system_role") or "").lower() != "admin"
        ]

        updated_count = 0
        for emp in target_emps:
            emp_id_str = str(emp.get("_id") or emp.get("id"))
            emp_info = await cls.get_employee_info(emp_id_str)
            await AttendanceRepository.upsert_manual_attendance(
                employee_id=emp_id_str,
                date_str=date_str,
                status=status_val,
                employee_info=emp_info,
                check_in=check_in,
                check_out=check_out,
                remarks=remarks
            )
            updated_count += 1
            await delete_cache(f"attendance:last:{emp_id_str}")

        await clear_pattern("attendance:*")
        return {
            "success": True,
            "count": updated_count,
            "message": f"Successfully updated attendance for {updated_count} employee(s) on {date_str}."
        }

    @classmethod
    async def get_punctuality_hall_of_fame(
        cls,
        month: Optional[str] = None,
        year: Optional[int] = None,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        from collections import defaultdict
        now = get_now_ist()
        target_year = year or now.year
        if month:
            month_idx = datetime.strptime(month, "%B").month if not month.isdigit() else int(month)
        else:
            month_idx = now.month

        _, total_days = calendar.monthrange(target_year, month_idx)
        start_date_str = f"{target_year:04d}-{month_idx:02d}-01"
        end_date_str = f"{target_year:04d}-{month_idx:02d}-{total_days:02d}"

        cache_key = f"attendance:punctuality:{target_year}:{month_idx}:{limit}"
        cached = await get_cache(cache_key)
        if cached is not None:
            return cached

        records = await AttendanceRepository.get_records(
            start_date=start_date_str,
            end_date=end_date_str
        )

        on_time_counts = defaultdict(int)
        emp_meta = {}
        for r in records:
            eid = r.get("employee_id")
            name = r.get("employee_name") or "Employee"
            status = r.get("status", "")
            is_late = r.get("is_late", False)
            dept = r.get("department") or "General"

            # Filter out admins
            if name.lower().startswith("admin"):
                continue

            if status in ("Present", "Logged", "Active") and not is_late:
                on_time_counts[eid] += 1
                if eid not in emp_meta:
                    emp_meta[eid] = {
                        "name": name,
                        "department": dept,
                        "avatar": r.get("avatar") or f"https://ui-avatars.com/api/?name={name}&background=random"
                    }

        sorted_emps = sorted(on_time_counts.items(), key=lambda x: x[1], reverse=True)
        results = []
        rank = 1
        for eid, count in sorted_emps[:limit]:
            meta = emp_meta.get(eid, {})
            results.append({
                "rank": rank,
                "employee_id": eid,
                "name": meta.get("name", "Employee"),
                "department": meta.get("department", "General"),
                "streak": f"{count} Days",
                "days": count,
                "avatar": meta.get("avatar", "")
            })
            rank += 1

        await set_cache(cache_key, results, ttl=180)
        return results

