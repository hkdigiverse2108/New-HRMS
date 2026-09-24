from typing import Optional, List, Dict, Any
from datetime import datetime, date, timedelta
from app.repository.work_log import WorkLogRepository
from app.repository.employee import EmployeeRepository
from app.repository.attendance import AttendanceRepository
from app.repository.daily_planner import DailyPlannerRepository

def format_seconds(total_seconds: int) -> str:
    if total_seconds <= 0:
        return "0m"
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    if hours > 0:
        return f"{hours}h {minutes}m"
    return f"{minutes}m"

def format_time_12h(dt_val: Any) -> str:
    if not dt_val:
        return "--"
    if isinstance(dt_val, str):
        try:
            dt_val = datetime.fromisoformat(dt_val)
        except Exception:
            return dt_val
    if isinstance(dt_val, datetime):
        return dt_val.strftime("%I:%M %p")
    return str(dt_val)

class WorkLogService:

    @staticmethod
    async def log_activity_change(employee_id: str, activity_text: str, category: str = "Work"):
        if not activity_text or not activity_text.strip():
            return None
        today_str = date.today().isoformat()
        return await WorkLogRepository.record_activity(employee_id, today_str, activity_text, category)

    @staticmethod
    async def get_work_logs_dashboard(
        date_str: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        filter_employee_id: Optional[str] = None,
        department_id: Optional[str] = None,
        status: Optional[str] = None,
        current_user: Optional[dict] = None
    ) -> Dict[str, Any]:
        now = datetime.utcnow()

        user_id = str(current_user.get("_id") or current_user.get("id")) if current_user else None
        role = current_user.get("work_details", {}).get("system_role", "") if current_user else ""
        is_admin = role in ["Admin", "Super Admin"] or (current_user and current_user.get("id") == "default-admin-id")

        eff_emp_id = filter_employee_id if is_admin else (filter_employee_id or user_id)

        # Resolve date filter / range
        s_date = start_date.strip() if start_date else None
        e_date = end_date.strip() if end_date else None

        if date_str:
            clean_date = date_str.strip().lower().replace(" ", "_").replace("-", "_")
            today_dt = date.today()
            if clean_date in ["today"]:
                s_date = today_dt.isoformat()
                e_date = today_dt.isoformat()
            elif clean_date in ["yesterday"]:
                y_dt = today_dt - timedelta(days=1)
                s_date = y_dt.isoformat()
                e_date = y_dt.isoformat()
            elif clean_date in ["last_7_days", "7_days", "last7days", "this_week", "week"]:
                start_7d = today_dt - timedelta(days=6)
                s_date = start_7d.isoformat()
                e_date = today_dt.isoformat()
            elif clean_date in ["last_month", "this_month", "month", "lastmonth"]:
                start_lm = today_dt - timedelta(days=30)
                s_date = start_lm.isoformat()
                e_date = today_dt.isoformat()
            elif clean_date in ["all_time", "all", "alltime"]:
                s_date = None
                e_date = None
            elif clean_date in ["custom", "custom_date"]:
                # Keep s_date and e_date provided in start_date / end_date
                pass
            else:
                s_date = date_str.strip()
                e_date = date_str.strip()
        elif not start_date and not end_date:
            s_date = date.today().isoformat()
            e_date = date.today().isoformat()

        # 1. Fetch Work Log documents for resolved range
        log_docs = await WorkLogRepository.get_logs_for_date(
            start_date=s_date,
            end_date=e_date,
            employee_id=eff_emp_id,
            department_id=department_id
        )

        # 2. Fetch Attendance records for resolved range
        attendance_records = await AttendanceRepository.get_records(
            employee_id=eff_emp_id,
            start_date=s_date,
            end_date=e_date
        )

        emp_date_pairs = set()
        emp_logs_map = {}
        for doc in log_docs:
            pair = (doc["employee_id"], doc["date"])
            emp_date_pairs.add(pair)
            emp_logs_map[pair] = doc

        attendance_map = {}
        for rec in attendance_records:
            pair = (rec["employee_id"], rec.get("date", s_date))
            emp_date_pairs.add(pair)
            attendance_map[pair] = rec

        if not emp_date_pairs and eff_emp_id:
            emp_date_pairs.add((eff_emp_id, s_date))

        sorted_pairs = sorted(list(emp_date_pairs), key=lambda x: (x[1], x[0]), reverse=True)

        total_work_sec = 0
        total_research_sec = 0
        total_other_sec = 0

        employee_cards = []
        emp_info_cache = {}

        for emp_id, rec_date in sorted_pairs:
            if emp_id not in emp_info_cache:
                emp_info = await EmployeeRepository.get_employee_by_id(emp_id)
                emp_name = "Employee"
                designation = "Staff"
                avatar = None

                if emp_info:
                    personal = emp_info.get("personal_info", {})
                    emp_name = f"{personal.get('first_name', '')} {personal.get('last_name', '')}".strip() or "Employee"
                    avatar = personal.get("profile_picture")
                    work = emp_info.get("work_details", {})
                    designation = work.get("designation") or work.get("job_title") or "Staff"
                elif emp_id == "default-admin-id":
                    emp_name = "Default Admin"
                    designation = "Administrator"

                emp_info_cache[emp_id] = {
                    "name": emp_name,
                    "designation": designation,
                    "avatar": avatar
                }

            emp_details = emp_info_cache[emp_id]

            # Attendance info
            att = attendance_map.get((emp_id, rec_date), {})
            check_in = att.get("check_in") or "--"
            punch_in_display = f"In at {check_in}" if check_in != "--" else "Not Punched In"

            # Work Log document activities
            doc = emp_logs_map.get((emp_id, rec_date))
            raw_activities = doc.get("activities", []) if doc else []

            # Fallback to Daily Planner if no work log document exists yet
            if not raw_activities:
                planner = await DailyPlannerRepository.get_by_employee_and_date(emp_id, rec_date)
                if planner:
                    p_act = planner.get("activity")
                    p_res = planner.get("research")
                    p_meet = planner.get("meeting")
                    if p_act:
                        raw_activities.append({
                            "log_id": f"pl_{emp_id}_{rec_date}_act",
                            "category": "Work",
                            "activity": f"Work: {p_act}",
                            "start_time": planner.get("created_at") or now,
                            "end_time": None,
                            "duration_seconds": 0,
                            "is_in_progress": True
                        })
                    if p_res:
                        raw_activities.append({
                            "log_id": f"pl_{emp_id}_{rec_date}_res",
                            "category": "Research",
                            "activity": f"Research: {p_res}",
                            "start_time": planner.get("created_at") or now,
                            "end_time": planner.get("updated_at") or now,
                            "duration_seconds": 0,
                            "is_in_progress": False
                        })
                    if p_meet:
                        raw_activities.append({
                            "log_id": f"pl_{emp_id}_{rec_date}_meet",
                            "category": "Other",
                            "activity": f"Meeting: {p_meet}",
                            "start_time": planner.get("created_at") or now,
                            "end_time": planner.get("updated_at") or now,
                            "duration_seconds": 0,
                            "is_in_progress": False
                        })

            emp_work_sec = 0
            emp_research_sec = 0
            emp_other_sec = 0

            formatted_activities = []
            for act in raw_activities:
                cat = act.get("category", "Work")
                act_text = act.get("activity", "")
                st = act.get("start_time")
                et = act.get("end_time")
                is_prog = act.get("is_in_progress", False)

                dur_sec = act.get("duration_seconds", 0)
                if is_prog:
                    if st and isinstance(st, datetime):
                        dur_sec = max(0, int((now - st).total_seconds()))
                    elif st and isinstance(st, str):
                        try:
                            st_dt = datetime.fromisoformat(st)
                            dur_sec = max(0, int((now - st_dt).total_seconds()))
                        except Exception:
                            dur_sec = 0
                    dur_str = "In Progress"
                    end_time_str = "Now"
                else:
                    dur_str = format_seconds(dur_sec)
                    end_time_str = format_time_12h(et)

                start_time_str = format_time_12h(st)

                norm_cat = cat.lower()
                if "research" in norm_cat or act_text.lower().startswith("research:"):
                    emp_research_sec += dur_sec
                    final_cat = "Research"
                elif "work" in norm_cat or act_text.lower().startswith("work:"):
                    emp_work_sec += dur_sec
                    final_cat = "Work"
                else:
                    emp_other_sec += dur_sec
                    final_cat = "Other"

                formatted_activities.append({
                    "log_id": str(act.get("log_id") or ""),
                    "category": final_cat,
                    "activity": act_text,
                    "start_time": start_time_str,
                    "end_time": end_time_str,
                    "duration": dur_str,
                    "duration_seconds": dur_sec,
                    "is_in_progress": is_prog
                })

            total_work_sec += emp_work_sec
            total_research_sec += emp_research_sec
            total_other_sec += emp_other_sec

            if status in ["current", "current_activity"]:
                formatted_activities = [act for act in formatted_activities if act.get("is_in_progress")]
                if not formatted_activities:
                    continue  # Skip employee if they have no current activity

            employee_cards.append({
                "employee_id": emp_id,
                "employee_name": emp_details["name"],
                "designation": emp_details["designation"],
                "avatar": emp_details["avatar"],
                "date": rec_date,
                "punch_in_time": punch_in_display,
                "activities": formatted_activities
            })

        emp_count = len(employee_cards) or 1

        summary = {
            "work_time": format_seconds(total_work_sec),
            "work_seconds": total_work_sec,
            "work_avg": format_seconds(total_work_sec // emp_count),
            "research_time": format_seconds(total_research_sec),
            "research_seconds": total_research_sec,
            "research_avg": format_seconds(total_research_sec // emp_count),
            "other_time": format_seconds(total_other_sec),
            "other_seconds": total_other_sec,
            "other_avg": format_seconds(total_other_sec // emp_count)
        }

        return {
            "summary": summary,
            "employees": employee_cards
        }
