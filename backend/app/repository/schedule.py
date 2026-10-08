from app.database.db import get_database
from bson import ObjectId
from typing import Dict, Any, List, Optional
from datetime import date, datetime, timedelta, time
import calendar
import re

def serialize_mongo(data: Any) -> Any:
    if isinstance(data, list):
        return [serialize_mongo(item) for item in data]
    if isinstance(data, dict):
        res = {}
        for k, v in data.items():
            if isinstance(v, ObjectId):
                res[k] = str(v)
            elif isinstance(v, (dict, list)):
                res[k] = serialize_mongo(v)
            else:
                res[k] = v
        if "_id" in res:
            res["id"] = str(res["_id"])
            res["_id"] = str(res["_id"])
        return res
    if isinstance(data, ObjectId):
        return str(data)
    return data

def parse_time_to_minutes(time_str: str) -> int:
    try:
        parts = time_str.strip().split(":")
        hours = int(parts[0])
        minutes = int(parts[1]) if len(parts) > 1 else 0
        return hours * 60 + minutes
    except Exception:
        return 0

def format_minutes_to_time(total_minutes: int) -> str:
    hours = total_minutes // 60
    mins = total_minutes % 60
    return f"{hours:02d}:{mins:02d}"

def format_minutes_to_12h(total_minutes: int) -> str:
    hours = total_minutes // 60
    mins = total_minutes % 60
    period = "AM" if hours < 12 else "PM"
    display_hours = hours % 12
    if display_hours == 0:
        display_hours = 12
    return f"{display_hours:02d}:{mins:02d} {period}"

def normalize_holiday_title(title: Optional[str]) -> str:
    if not title:
        return ""
    import re
    cleaned = re.sub(r"[^\w\s]", "", str(title)).strip().lower()
    return " ".join(cleaned.split())

class ScheduleRepository:
    events_collection = "schedule_events"

    @classmethod
    async def get_db(cls):
        return get_database()

    @classmethod
    async def resolve_bulk_attendees(cls, bulk_filter: Dict[str, Any]) -> List[str]:
        db = await cls.get_db()
        and_conditions = []
        
        dept_val = bulk_filter.get("department_id") or bulk_filter.get("department") or bulk_filter.get("department_name")
        desig_val = bulk_filter.get("designation_id") or bulk_filter.get("designation") or bulk_filter.get("designation_name")
        role_val = bulk_filter.get("role") or bulk_filter.get("system_role")

        if dept_val:
            dept_regex = re.compile(f"^{re.escape(str(dept_val))}$", re.IGNORECASE)
            and_conditions.append({
                "$or": [
                    {"work_details.department_id": str(dept_val)},
                    {"work_details.department_name": dept_regex},
                    {"work_details.department": dept_regex},
                    {"department_id": str(dept_val)},
                    {"department_name": dept_regex},
                    {"department": dept_regex}
                ]
            })

        if desig_val:
            desig_regex = re.compile(f"^{re.escape(str(desig_val))}$", re.IGNORECASE)
            and_conditions.append({
                "$or": [
                    {"work_details.designation_id": str(desig_val)},
                    {"work_details.designation_name": desig_regex},
                    {"work_details.designation": desig_regex},
                    {"designation_id": str(desig_val)},
                    {"designation_name": desig_regex},
                    {"designation": desig_regex}
                ]
            })

        if role_val:
            role_regex = re.compile(f"^{re.escape(str(role_val))}$", re.IGNORECASE)
            and_conditions.append({
                "$or": [
                    {"work_details.system_role": role_regex},
                    {"work_details.role": role_regex},
                    {"system_role": role_regex},
                    {"role": role_regex}
                ]
            })

        if not and_conditions:
            return []

        query = {"$and": and_conditions} if len(and_conditions) > 1 else and_conditions[0]

        cursor = db["employees"].find(query, {"_id": 1, "work_details.employee_id": 1})
        docs = await cursor.to_list(length=1000)
        
        employee_ids = []
        for d in docs:
            emp_code = d.get("work_details", {}).get("employee_id") or str(d.get("_id"))
            if emp_code and emp_code not in employee_ids:
                employee_ids.append(emp_code)
            str_id = str(d.get("_id"))
            if str_id and str_id not in employee_ids:
                employee_ids.append(str_id)
        return employee_ids

    @classmethod
    async def create_event(cls, data: Dict[str, Any], user_id: str) -> Dict[str, Any]:
        db = await cls.get_db()
        now = datetime.utcnow()
        
        # Handle bulk attendees if bulk_add_filter provided
        bulk_filter = data.get("bulk_add_filter")
        attendees = data.get("attendees", [])
        if bulk_filter:
            bulk_emp_ids = await cls.resolve_bulk_attendees(bulk_filter)
            for b_id in bulk_emp_ids:
                if b_id not in attendees:
                    attendees.append(b_id)

        primary_emp = data.get("primary_employee_id") or user_id
        if primary_emp not in attendees:
            attendees.append(primary_emp)

        doc = {
            "title": data.get("title"),
            "primary_employee_id": primary_emp,
            "attendees": attendees,
            "date": data.get("date").isoformat() if isinstance(data.get("date"), date) else str(data.get("date")),
            "type": data.get("type", "Meeting"),
            "start_time": data.get("start_time"),
            "end_time": data.get("end_time"),
            "description": data.get("description"),
            "category": data.get("category", "my_schedule"),
            "color": data.get("color") or cls._get_default_color(data.get("type", "Meeting")),
            "created_by": user_id,
            "created_at": now,
            "is_auto_generated": False
        }

        result = await db[cls.events_collection].insert_one(doc)
        doc["_id"] = result.inserted_id
        serialized = serialize_mongo(doc)

        # If this date/holiday was previously excluded, un-exclude it since it's explicitly created
        d_val = doc.get("date")
        norm_t = normalize_holiday_title(doc.get("title"))
        if d_val and norm_t:
            try:
                await db["excluded_schedule_events"].delete_many({
                    "$or": [
                        {"date": d_val, "normalized_title": norm_t},
                        {"date": d_val, "title": doc.get("title")}
                    ]
                })
            except Exception:
                pass

        # Clear Redis cache for schedule
        try:
            from app.redis.service import clear_pattern
            await clear_pattern("schedule:*")
        except Exception:
            pass

        # Sync meeting event to participating employees' connected Google Calendars
        try:
            from app.services.google_calendar import GoogleCalendarService
            for att_id in attendees:
                await GoogleCalendarService.push_hrms_event_to_google(att_id, serialized)
        except Exception as e:
            print(f"[EVENT GOOGLE SYNC WARNING] {e}")

        return serialized

    @classmethod
    def _get_default_color(cls, event_type: str) -> str:
        t = (event_type or "").lower()
        if "standup" in t:
            return "#007bff" # Blue
        elif "sync" in t or "focused" in t or "work" in t:
            return "#28a745" # Green
        elif "call" in t or "client" in t:
            return "#6f42c1" # Purple
        elif "meeting" in t:
            return "#fd7e14" # Orange
        return "#17a2b8" # Teal

    @classmethod
    async def get_team_users(cls, query_str: Optional[str] = None, limit: int = 1000) -> List[Dict[str, Any]]:
        """Active, non-deleted (and non-blocked) employees for the Team Calendars list."""
        import re as _re
        db = await cls.get_db()
        query: Dict[str, Any] = {
            "work_details.is_delete": {"$ne": True},
            "work_details.is_block": {"$ne": True},
        }
        if query_str and query_str.strip():
            q_regex = _re.compile(_re.escape(query_str.strip()), _re.IGNORECASE)
            query["$or"] = [
                {"name": q_regex},
                {"personal_info.first_name": q_regex},
                {"personal_info.last_name": q_regex},
                {"work_details.employee_id": q_regex},
            ]
        cursor = db["employees"].find(query).sort("personal_info.first_name", 1).limit(limit)
        docs = await cursor.to_list(length=limit)
        results = []
        for emp in docs:
            emp_code = emp.get("work_details", {}).get("employee_id") or str(emp.get("_id"))
            p_info = emp.get("personal_info", {})
            w_details = emp.get("work_details", {})
            name = emp.get("name") or f"{p_info.get('first_name', '')} {p_info.get('last_name', '')}".strip() or emp_code
            results.append({
                "id": str(emp.get("_id")),
                "employee_id": emp_code,
                "name": name,
                "email": emp.get("email") or p_info.get("email") or "",
                "department": w_details.get("department_name") or w_details.get("department") or "",
                "designation": w_details.get("designation_name") or w_details.get("designation") or "",
            })
        return results

    @classmethod
    async def _company_day_events(
        cls,
        db,
        start_date: date,
        end_date: date,
        reference_date: date,
        categories: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """Birthdays + work anniversaries for ALL employees (company-wide days)."""
        out: List[Dict[str, Any]] = []
        if categories and "birthday" not in categories and "work_anniversary" not in categories:
            return out
        emp_cursor = db["employees"].find({})
        employees = await emp_cursor.to_list(length=1000)

        for emp in employees:
            emp_id = emp.get("work_details", {}).get("employee_id") or str(emp.get("_id"))
            p_info = emp.get("personal_info", {})
            w_details = emp.get("work_details", {})

            name = emp.get("name")
            if not name:
                fn = p_info.get("first_name", "")
                ln = p_info.get("last_name", "")
                name = f"{fn} {ln}".strip() or emp_id

            dob_raw = p_info.get("date_of_birth") or emp.get("dob")
            if dob_raw and (not categories or "birthday" in categories):
                try:
                    if isinstance(dob_raw, str):
                        dob_d = datetime.strptime(dob_raw[:10], "%Y-%m-%d").date()
                    elif isinstance(dob_raw, datetime):
                        dob_d = dob_raw.date()
                    else:
                        dob_d = dob_raw

                    curr_bday = date(reference_date.year, dob_d.month, dob_d.day)
                    if start_date <= curr_bday <= end_date:
                        out.append({
                            "_id": f"bday_{emp_id}_{curr_bday.isoformat()}",
                            "id": f"bday_{emp_id}_{curr_bday.isoformat()}",
                            "title": f"🎂 Birthday: {name}",
                            "primary_employee_id": emp_id,
                            "primary_employee_name": name,
                            "attendees": [emp_id],
                            "date": curr_bday.isoformat(),
                            "type": "Birthday",
                            "start_time": "09:00",
                            "end_time": "18:00",
                            "description": f"Celebrate {name}'s birthday today!",
                            "category": "birthday",
                            "color": "#ffc107",
                            "created_by": "system",
                            "is_auto_generated": True
                        })
                except Exception:
                    pass

            joining_raw = w_details.get("joining_date") or emp.get("joining_date")
            if joining_raw and (not categories or "work_anniversary" in categories):
                try:
                    if isinstance(joining_raw, str):
                        join_d = datetime.strptime(joining_raw[:10], "%Y-%m-%d").date()
                    elif isinstance(joining_raw, datetime):
                        join_d = joining_raw.date()
                    else:
                        join_d = joining_raw

                    if join_d.year < reference_date.year:
                        years_count = reference_date.year - join_d.year
                        curr_anniv = date(reference_date.year, join_d.month, join_d.day)
                        if start_date <= curr_anniv <= end_date:
                            out.append({
                                "_id": f"anniv_{emp_id}_{curr_anniv.isoformat()}",
                                "id": f"anniv_{emp_id}_{curr_anniv.isoformat()}",
                                "title": f"🎉 {years_count} Yr Work Anniversary: {name}",
                                "primary_employee_id": emp_id,
                                "primary_employee_name": name,
                                "attendees": [emp_id],
                                "date": curr_anniv.isoformat(),
                                "type": "Work Anniversary",
                                "start_time": "09:00",
                                "end_time": "18:00",
                                "description": f"Congratulate {name} on {years_count} years with the team!",
                                "category": "work_anniversary",
                                "color": "#e83e8c",
                                "created_by": "system",
                                "is_auto_generated": True
                            })
                except Exception:
                    pass
        return out

    @classmethod
    async def _resolve_employee_ids(cls, db, emp_id: str) -> List[str]:
        ids = [emp_id]
        if not emp_id:
            return ids
        try:
            from bson import ObjectId
            emp = None
            if ObjectId.is_valid(emp_id):
                emp = await db["employees"].find_one({"_id": ObjectId(emp_id)})
            if not emp:
                emp = await db["employees"].find_one({
                    "$or": [
                        {"work_details.employee_id": emp_id},
                        {"employee_id": emp_id}
                    ]
                })
            if emp:
                for candidate in [str(emp.get("_id")), emp.get("work_details", {}).get("employee_id"), emp.get("employee_id")]:
                    if candidate and candidate not in ids:
                        ids.append(candidate)
        except Exception:
            pass
        return ids

    @classmethod
    async def get_calendar_feed(
        cls,
        user_id: str,
        reference_date: date,
        view_mode: str = "week",
        categories: Optional[List[str]] = None,
        search_query: Optional[str] = None,
        target_user_ids: Optional[List[str]] = None,
        is_admin_or_hr: bool = False
    ) -> Dict[str, Any]:
        # Check Redis Cache first for instant response
        try:
            from app.redis.service import get_cache
            cats_k = ",".join(sorted(categories)) if categories else "all"
            targs_k = ",".join(sorted(target_user_ids)) if target_user_ids else "self"
            feed_cache_key = f"schedule:feed:{user_id}:{reference_date.isoformat()}:{view_mode}:{cats_k}:{targs_k}:{search_query or ''}"
            cached_feed = await get_cache(feed_cache_key)
            if cached_feed:
                return cached_feed
        except Exception:
            feed_cache_key = None

        db = await cls.get_db()

        # Permanently excluded/deleted event IDs & (date, title) pairs (e.g. deleted Google holidays, leaves)
        excluded_ids = set()
        excluded_date_titles = set()
        try:
            excluded_cursor = db["excluded_schedule_events"].find(
                {},
                {"event_id": 1, "date": 1, "normalized_title": 1, "title": 1}
            )
            excluded_docs = await excluded_cursor.to_list(length=5000)
            for d in excluded_docs:
                if d.get("event_id"):
                    excluded_ids.add(str(d["event_id"]))
                d_date = d.get("date")
                d_title = d.get("normalized_title") or normalize_holiday_title(d.get("title"))
                if d_date and d_title:
                    excluded_date_titles.add((str(d_date), d_title))
        except Exception:
            pass

        def is_event_excluded(ev: Dict[str, Any]) -> bool:
            ev_id = str(ev.get("id") or "")
            ev_oid = str(ev.get("_id") or "")
            if (ev_id and ev_id in excluded_ids) or (ev_oid and ev_oid in excluded_ids):
                return True
            ev_date = str(ev.get("date") or "")
            ev_norm = normalize_holiday_title(ev.get("title"))
            if ev_date and ev_norm and (ev_date, ev_norm) in excluded_date_titles:
                return True
            return False

        # Calculate start_date & end_date based on view_mode first (applies to both team & single user)
        if view_mode in ("today", "day"):
            start_date = reference_date
            end_date = reference_date
            date_range_label = reference_date.strftime("%B %d, %Y")
        elif view_mode == "week":
            # Week starts on Sunday
            idx = (reference_date.weekday() + 1) % 7
            start_date = reference_date - timedelta(days=idx)
            end_date = start_date + timedelta(days=6)
            if start_date.month == end_date.month:
                date_range_label = f"{start_date.strftime('%b %d')} – {end_date.strftime('%d, %Y')}"
            else:
                date_range_label = f"{start_date.strftime('%b %d')} – {end_date.strftime('%b %d, %Y')}"
        else:
            # Month view
            start_date = reference_date.replace(day=1)
            _, last_day = calendar.monthrange(reference_date.year, reference_date.month)
            end_date = reference_date.replace(day=last_day)
            date_range_label = reference_date.strftime("%B %Y")

        # Multi-user team view (admin/HR only, enforced by controller):
        # union of each selected user's events (each user's own connected Google included)
        if target_user_ids:
            merged: Dict[str, Dict[str, Any]] = {}
            for tid in target_user_ids[:50]:
                try:
                    sub = await cls.get_employee_calendar_view(
                        target_employee_id=tid,
                        viewer_employee_id=user_id,
                        reference_date=reference_date,
                        view_mode=view_mode,
                        is_admin_or_hr=True
                    )
                    for ev in sub.get("events", []):
                        key = str(ev.get("_id") or ev.get("id"))
                        merged[key] = ev
                except Exception:
                    continue

            # Ensure current logged-in user's Google Calendar events are included if category selected
            if not categories or "google_calendar" in categories:
                try:
                    from app.services.google_calendar import GoogleCalendarService
                    my_g_events = await GoogleCalendarService.fetch_google_calendar_events(
                        employee_id=user_id,
                        start_date=start_date,
                        end_date=end_date
                    )
                    for ev in my_g_events:
                        merged[str(ev.get("id"))] = ev
                except Exception:
                    pass

            try:
                comp_days = await cls._company_day_events(db, start_date, end_date, reference_date, categories)
                for ev in comp_days:
                    merged[str(ev.get("id"))] = ev
            except Exception:
                pass

            # System Public Holidays & Company Leaves (company-wide, visible to everyone)
            want_holidays = not categories or "google_holidays" in categories
            want_company_leaves = not categories or "company_leave" in categories
            h_cats = []
            if want_holidays:
                h_cats.extend(["google_holidays", "holiday", "Holiday", "Public Holiday"])
            if want_company_leaves:
                h_cats.extend(["company_leave", "Company Leave"])
            if h_cats:
                try:
                    h_query = {
                        "date": {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()},
                        "$or": [
                            {"category": {"$in": h_cats}},
                            {"type": {"$in": ["Holiday", "Public Holiday", "Company Leave"]}}
                        ]
                    }
                    h_cursor = db[cls.events_collection].find(h_query)
                    h_events_raw = await h_cursor.to_list(length=500)
                    for ev in serialize_mongo(h_events_raw):
                        merged[str(ev.get("_id") or ev.get("id"))] = ev
                except Exception:
                    pass

            # Google Holiday Calendar (Holidays in India, etc.)
            if not categories or "google_holidays" in categories:
                try:
                    from app.services.google_calendar import GoogleCalendarService
                    h_events = await GoogleCalendarService.fetch_holiday_events(
                        employee_id=user_id, start_date=start_date, end_date=end_date
                    )
                    for ev in h_events:
                        merged[str(ev.get("id"))] = ev
                except Exception:
                    pass

            all_events = [ev for ev in merged.values() if not is_event_excluded(ev)]
            if search_query:
                sq = search_query.lower()
                all_events = [ev for ev in all_events
                              if sq in (ev.get("title") or "").lower()
                              or sq in (ev.get("description") or "").lower()
                              or sq in (ev.get("primary_employee_name") or "").lower()]
            all_events.sort(key=lambda ev: f"{ev.get('date') or ''}T{ev.get('start_time') or '00:00'}")
            today_str = date.today().isoformat()
            feed_res = {
                "view_mode": view_mode,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "date_range_label": date_range_label,
                "todays_meetings_count": sum(1 for ev in all_events if (ev.get("date") or "") == today_str),
                "events": all_events
            }
            if feed_cache_key:
                try:
                    from app.redis.service import set_cache
                    await set_cache(feed_cache_key, feed_res, ttl=300)
                except Exception:
                    pass
            return feed_res

        # Single user calendar feed
        user_ids = await cls._resolve_employee_ids(db, user_id)
        today_str = date.today().isoformat()
        todays_count = await db[cls.events_collection].count_documents({
            "date": today_str,
            "$or": [
                {"created_by": {"$in": user_ids}},
                {"primary_employee_id": {"$in": user_ids}},
                {"attendees": {"$in": user_ids}}
            ]
        })

        all_events = []

        # 1. Custom User Schedule Events
        if not categories or "my_schedule" in categories:
            start_iso = start_date.isoformat()
            end_iso = end_date.isoformat()
            
            query = {
                "date": {"$gte": start_iso, "$lte": end_iso},
                "$or": [
                    {"created_by": {"$in": user_ids}},
                    {"primary_employee_id": {"$in": user_ids}},
                    {"attendees": {"$in": user_ids}}
                ]
            }
            cursor = db[cls.events_collection].find(query)
            custom_events_raw = await cursor.to_list(length=500)
            custom_events = serialize_mongo(custom_events_raw)
            all_events.extend(custom_events)

        # 1b. System Company Leaves & Public Holidays (company-wide, visible to all employees)
        want_holidays = not categories or "google_holidays" in categories
        want_company_leaves = not categories or "company_leave" in categories
        h_cats = []
        if want_holidays:
            h_cats.extend(["google_holidays", "holiday", "Holiday", "Public Holiday"])
        if want_company_leaves:
            h_cats.extend(["company_leave", "Company Leave"])
        if h_cats:
            try:
                start_iso = start_date.isoformat()
                end_iso = end_date.isoformat()
                h_query = {
                    "date": {"$gte": start_iso, "$lte": end_iso},
                    "$or": [
                        {"category": {"$in": h_cats}},
                        {"type": {"$in": ["Holiday", "Public Holiday", "Company Leave"]}}
                    ]
                }
                h_cursor = db[cls.events_collection].find(h_query)
                h_events_raw = await h_cursor.to_list(length=500)
                for ev in serialize_mongo(h_events_raw):
                    ev_id = str(ev.get("_id") or ev.get("id"))
                    if not any(str(x.get("_id") or x.get("id")) == ev_id for x in all_events):
                        all_events.append(ev)
            except Exception:
                pass

        # 2. Auto-generated Birthdays & Work Anniversaries (company-wide)
        try:
            all_events.extend(await cls._company_day_events(db, start_date, end_date, reference_date, categories))
        except Exception:
            pass

        # 3. Google Calendar Events
        if not categories or "google_calendar" in categories:
            try:
                from app.services.google_calendar import GoogleCalendarService
                g_events = await GoogleCalendarService.fetch_google_calendar_events(
                    employee_id=user_id,
                    start_date=start_date,
                    end_date=end_date
                )
                all_events.extend(g_events)
            except Exception as e:
                print(f"[GOOGLE CALENDAR FEED WARNING] {e}")

        # 3b. Google Festival/Holiday Events (e.g. Holidays in India: Diwali, Dussehra)
        if not categories or "google_holidays" in categories:
            try:
                from app.services.google_calendar import GoogleCalendarService
                h_events = await GoogleCalendarService.fetch_holiday_events(
                    employee_id=user_id,
                    start_date=start_date,
                    end_date=end_date
                )
                all_events.extend(h_events)
            except Exception as e:
                print(f"[GOOGLE HOLIDAY FEED WARNING] {e}")

        # Permanently exclude deleted events/holidays
        all_events = [ev for ev in all_events if not is_event_excluded(ev)]

        # Filter by search_query if provided
        if search_query:
            sq = search_query.lower()
            filtered = []
            for ev in all_events:
                t = (ev.get("title") or "").lower()
                d = (ev.get("description") or "").lower()
                p = (ev.get("primary_employee_name") or "").lower()
                if sq in t or sq in d or sq in p:
                    filtered.append(ev)
            all_events = filtered

        # Sort events by date and start_time
        def sort_key(ev):
            d_str = ev.get("date") or ""
            t_str = ev.get("start_time") or "00:00"
            return f"{d_str}T{t_str}"

        all_events.sort(key=sort_key)

        feed_res = {
            "view_mode": view_mode,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "date_range_label": date_range_label,
            "todays_meetings_count": todays_count,
            "events": all_events
        }
        if feed_cache_key:
            try:
                from app.redis.service import set_cache
                await set_cache(feed_cache_key, feed_res, ttl=300)
            except Exception:
                pass
        return feed_res

    @classmethod
    async def get_free_time_slots(
        cls,
        employee_ids: List[str],
        target_date: date,
        duration_minutes: int = 30
    ) -> Dict[str, Any]:
        db = await cls.get_db()
        date_str = target_date.isoformat()

        # Define boundary work hours: 09:00 AM (540 mins) to 06:00 PM (1080 mins)
        day_start = 9 * 60
        day_end = 18 * 60

        # Query existing events for any of the employee_ids on target_date
        query = {
            "date": date_str,
            "$or": [
                {"primary_employee_id": {"$in": employee_ids}},
                {"attendees": {"$in": employee_ids}}
            ]
        }
        cursor = db[cls.events_collection].find(query)
        existing_events = await cursor.to_list(length=200)

        # Build list of busy minute ranges
        busy_ranges = []
        for ev in existing_events:
            s_min = parse_time_to_minutes(ev.get("start_time", "09:00"))
            e_min = parse_time_to_minutes(ev.get("end_time", "18:00"))
            if e_min > s_min:
                busy_ranges.append((s_min, e_min))

        # Check leaves collection if present
        try:
            leave_cursor = db["leave_requests"].find({
                "employee_id": {"$in": employee_ids},
                "status": "APPROVED",
                "start_date": {"$lte": date_str},
                "end_date": {"$gte": date_str}
            })
            leaves = await leave_cursor.to_list(length=100)
            if leaves:
                # Whole day busy
                busy_ranges.append((day_start, day_end))
        except Exception:
            pass

        # Evaluate free 30-min slots between 09:00 and 18:00
        available_slots = []
        curr = day_start
        step = duration_minutes if duration_minutes in (15, 30, 60) else 30

        while curr + step <= day_end:
            slot_start = curr
            slot_end = curr + step
            
            # Check overlap with busy ranges
            is_busy = False
            for b_start, b_end in busy_ranges:
                if max(slot_start, b_start) < min(slot_end, b_end):
                    is_busy = True
                    break

            if not is_busy:
                s_str = format_minutes_to_time(slot_start)
                e_str = format_minutes_to_time(slot_end)
                label = f"{format_minutes_to_12h(slot_start)} - {format_minutes_to_12h(slot_end)}"
                available_slots.append({
                    "start_time": s_str,
                    "end_time": e_str,
                    "label": label
                })

            curr += step

        return {
            "date": date_str,
            "employee_ids": employee_ids,
            "total_common_slots": len(available_slots),
            "available_slots": available_slots
        }

    @classmethod
    async def get_bulk_options(cls) -> Dict[str, Any]:
        db = await cls.get_db()
        
        # 1. Departments dynamically from 'departments' collection + 'employees'
        dept_cursor = db["departments"].find({}, {"_id": 1, "department_name": 1, "name": 1})
        raw_depts = await dept_cursor.to_list(length=200)
        
        departments = []
        seen_dept_names = set()
        for d in raw_depts:
            d_name = (d.get("department_name") or d.get("name") or "").strip()
            if d_name:
                departments.append({"id": str(d["_id"]), "name": d_name})
                seen_dept_names.add(d_name.lower())

        # Also aggregate any distinct department names present in employees collection
        try:
            emp_depts = await db["employees"].distinct("work_details.department_name")
            emp_depts_alt = await db["employees"].distinct("work_details.department")
            all_emp_depts = set(emp_depts + emp_depts_alt)
            for ed in all_emp_depts:
                if ed and isinstance(ed, str) and ed.strip().lower() not in seen_dept_names:
                    departments.append({"id": ed.strip(), "name": ed.strip()})
                    seen_dept_names.add(ed.strip().lower())
        except Exception:
            pass

        # 2. Designations dynamically from 'designations' collection + 'employees'
        desig_cursor = db["designations"].find({}, {"_id": 1, "designation_name": 1, "name": 1})
        raw_desigs = await desig_cursor.to_list(length=200)
        
        designations = []
        seen_desig_names = set()
        for d in raw_desigs:
            d_name = (d.get("designation_name") or d.get("name") or "").strip()
            if d_name:
                designations.append({"id": str(d["_id"]), "name": d_name})
                seen_desig_names.add(d_name.lower())

        # Also aggregate any distinct designation names present in employees collection
        try:
            emp_desigs = await db["employees"].distinct("work_details.designation_name")
            emp_desigs_alt = await db["employees"].distinct("work_details.designation")
            all_emp_desigs = set(emp_desigs + emp_desigs_alt)
            for ed in all_emp_desigs:
                if ed and isinstance(ed, str) and ed.strip().lower() not in seen_desig_names:
                    designations.append({"id": ed.strip(), "name": ed.strip()})
                    seen_desig_names.add(ed.strip().lower())
        except Exception:
            pass

        # 3. System Roles dynamically from 'employees' collection + default presets
        roles_set = set(["Admin", "HR", "Manager", "Team Leader", "Employee"])
        try:
            emp_roles = await db["employees"].distinct("work_details.system_role")
            emp_roles_alt = await db["employees"].distinct("role")
            for r in (emp_roles + emp_roles_alt):
                if r and isinstance(r, str) and r.strip():
                    roles_set.add(r.strip())
        except Exception:
            pass

        roles = sorted(list(roles_set))

        return {
            "departments": departments,
            "designations": designations,
            "roles": roles
        }

    @classmethod
    async def get_employee_calendar_view(
        cls,
        target_employee_id: str,
        viewer_employee_id: str,
        reference_date: date,
        view_mode: str = "week",
        is_admin_or_hr: bool = False
    ) -> Dict[str, Any]:
        db = await cls.get_db()

        # Calculate start_date & end_date based on view_mode
        if view_mode in ("today", "day"):
            start_date = reference_date
            end_date = reference_date
            date_range_label = reference_date.strftime("%B %d, %Y")
        elif view_mode == "week":
            idx = (reference_date.weekday() + 1) % 7
            start_date = reference_date - timedelta(days=idx)
            end_date = start_date + timedelta(days=6)
            if start_date.month == end_date.month:
                date_range_label = f"{start_date.strftime('%b %d')} – {end_date.strftime('%d, %Y')}"
            else:
                date_range_label = f"{start_date.strftime('%b %d')} – {end_date.strftime('%b %d, %Y')}"
        else:
            start_date = reference_date.replace(day=1)
            _, last_day = calendar.monthrange(reference_date.year, reference_date.month)
            end_date = reference_date.replace(day=last_day)
            date_range_label = reference_date.strftime("%B %Y")

        # Resolve target employee identifiers (both MongoDB ObjectId and employee code)
        target_ids = await cls._resolve_employee_ids(db, target_employee_id)

        # Query events for target_employee_id
        start_iso = start_date.isoformat()
        end_iso = end_date.isoformat()
        
        query = {
            "date": {"$gte": start_iso, "$lte": end_iso},
            "$or": [
                {"created_by": {"$in": target_ids}},
                {"primary_employee_id": {"$in": target_ids}},
                {"attendees": {"$in": target_ids}}
            ]
        }
        cursor = db[cls.events_collection].find(query)
        custom_events_raw = await cursor.to_list(length=500)
        custom_events = serialize_mongo(custom_events_raw)

        # Google Calendar events for target employee
        try:
            from app.services.google_calendar import GoogleCalendarService
            g_events = await GoogleCalendarService.fetch_google_calendar_events(
                employee_id=target_employee_id,
                start_date=start_date,
                end_date=end_date
            )
            custom_events.extend(g_events)
        except Exception:
            pass

        # Apply Privacy Protection if viewer is another regular employee
        final_events = []
        is_same_user = (target_employee_id == viewer_employee_id)

        for ev in custom_events:
            ev_creator = ev.get("created_by")
            ev_host = ev.get("primary_employee_id")
            ev_attendees = ev.get("attendees", [])

            can_view_full = (
                is_same_user or
                is_admin_or_hr or
                viewer_employee_id == ev_creator or
                viewer_employee_id == ev_host or
                viewer_employee_id in ev_attendees
            )

            if can_view_full:
                final_events.append(ev)
            else:
                # Privacy Mode: Mask title and description as "Slot Booked" / "Busy"
                masked_ev = dict(ev)
                masked_ev["title"] = "🔒 Slot Booked"
                masked_ev["description"] = "Slot Booked (Private Schedule)"
                masked_ev["attendees"] = [target_employee_id]
                masked_ev["color"] = "#6c757d" # Muted Gray for private slots
                final_events.append(masked_ev)

        # Permanently exclude deleted events/holidays
        try:
            excluded_cursor = db["excluded_schedule_events"].find(
                {},
                {"event_id": 1, "date": 1, "normalized_title": 1, "title": 1}
            )
            excluded_docs = await excluded_cursor.to_list(length=5000)
            view_ex_ids = set()
            view_ex_dt = set()
            for d in excluded_docs:
                if d.get("event_id"):
                    view_ex_ids.add(str(d["event_id"]))
                d_date = d.get("date")
                d_title = d.get("normalized_title") or normalize_holiday_title(d.get("title"))
                if d_date and d_title:
                    view_ex_dt.add((str(d_date), d_title))
            final_events = [
                ev for ev in final_events
                if (str(ev.get("id")) not in view_ex_ids and str(ev.get("_id")) not in view_ex_ids) and
                   not (str(ev.get("date") or "") and normalize_holiday_title(ev.get("title")) and (str(ev.get("date") or ""), normalize_holiday_title(ev.get("title"))) in view_ex_dt)
            ]
        except Exception:
            pass

        # Sort by date & time
        def sort_key(ev):
            d_str = ev.get("date") or ""
            t_str = ev.get("start_time") or "00:00"
            return f"{d_str}T{t_str}"

        final_events.sort(key=sort_key)

        return {
            "target_employee_id": target_employee_id,
            "view_mode": view_mode,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "date_range_label": date_range_label,
            "total_events": len(final_events),
            "events": final_events
        }

    @classmethod
    async def get_event_by_id(cls, event_id: str) -> Optional[Dict[str, Any]]:
        db = await cls.get_db()
        try:
            obj_id = ObjectId(event_id)
            doc = await db[cls.events_collection].find_one({"_id": obj_id})
            return serialize_mongo(doc) if doc else None
        except Exception:
            return None

    @classmethod
    async def update_event(cls, event_id: str, data: Dict[str, Any], user_id: str, is_admin_or_hr: bool = False) -> bool:
        db = await cls.get_db()
        try:
            from bson import ObjectId
            match_or = []
            if ObjectId.is_valid(event_id):
                match_or.append({"_id": ObjectId(event_id)})
            match_or.append({"_id": event_id})
            match_or.append({"id": event_id})

            if is_admin_or_hr:
                query = {"$or": match_or}
            else:
                user_ids = await cls._resolve_employee_ids(db, user_id)
                query = {
                    "$and": [
                        {"$or": match_or},
                        {"$or": [
                            {"created_by": {"$in": user_ids}},
                            {"primary_employee_id": {"$in": user_ids}},
                            {"attendees": {"$in": user_ids}}
                        ]}
                    ]
                }
            result = await db[cls.events_collection].update_one(query, {"$set": data})
            if result.modified_count > 0 or result.matched_count > 0:
                try:
                    from app.redis.service import clear_pattern
                    await clear_pattern("schedule:*")
                except Exception:
                    pass
                return True
            return False
        except Exception:
            return False

    @classmethod
    async def delete_event(
        cls,
        event_id: str,
        user_id: str,
        is_admin_or_hr: bool = False,
        event_date: Optional[str] = None,
        event_title: Optional[str] = None
    ) -> bool:
        if not event_id:
            return False

        db = await cls.get_db()
        try:
            from bson import ObjectId
            match_or = []
            if ObjectId.is_valid(event_id):
                match_or.append({"_id": ObjectId(event_id)})
            match_or.append({"_id": str(event_id)})
            match_or.append({"id": str(event_id)})

            is_external_or_holiday = (
                str(event_id).startswith("ghol_") or
                str(event_id).startswith("gcal_") or
                str(event_id).startswith("bday_") or
                str(event_id).startswith("anniv_") or
                str(event_id).startswith("holiday_") or
                str(event_id).startswith("leave_")
            )

            # Try to retrieve existing doc if in database to retain date/title
            existing_doc = await db[cls.events_collection].find_one({"$or": match_or})
            if existing_doc:
                if not event_date:
                    event_date = existing_doc.get("date")
                if not event_title:
                    event_title = existing_doc.get("title")

            if is_admin_or_hr:
                # 1. Permanently record in excluded_schedule_events so Google holidays & leaves NEVER reappear
                await db["excluded_schedule_events"].update_one(
                    {"event_id": str(event_id)},
                    {
                        "$set": {
                            "event_id": str(event_id),
                            "date": event_date,
                            "title": event_title,
                            "normalized_title": normalize_holiday_title(event_title),
                            "deleted_by": user_id,
                            "deleted_at": datetime.utcnow()
                        }
                    },
                    upsert=True
                )

                # 2. Delete from schedule_events collection if it exists there
                await db[cls.events_collection].delete_many({"$or": match_or})

                # 3. Clear Redis cache for instant update
                try:
                    from app.redis.service import clear_pattern
                    await clear_pattern("schedule:*")
                    await clear_pattern("attendance:*")
                except Exception:
                    pass

                return True

            # Regular employee trying to delete
            if is_external_or_holiday:
                return False

            user_ids = await cls._resolve_employee_ids(db, user_id)
            query = {
                "$and": [
                    {"$or": match_or},
                    {"$or": [
                        {"created_by": {"$in": user_ids}},
                        {"primary_employee_id": {"$in": user_ids}},
                        {"attendees": {"$in": user_ids}}
                    ]}
                ]
            }
            result = await db[cls.events_collection].delete_one(query)
            if result.deleted_count > 0:
                try:
                    from app.redis.service import clear_pattern
                    await clear_pattern("schedule:*")
                except Exception:
                    pass
                return True
            return False
        except Exception as e:
            print(f"[DELETE EVENT ERROR] {e}")
            return False

    @classmethod
    async def search_employees(
        cls,
        query_str: Optional[str] = None,
        department_id: Optional[str] = None,
        designation_id: Optional[str] = None,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        db = await cls.get_db()
        and_conditions = []

        if query_str and query_str.strip():
            q_regex = re.compile(re.escape(query_str.strip()), re.IGNORECASE)
            and_conditions.append({
                "$or": [
                    {"name": q_regex},
                    {"personal_info.first_name": q_regex},
                    {"personal_info.last_name": q_regex},
                    {"work_details.employee_id": q_regex},
                    {"email": q_regex},
                    {"work_details.department_name": q_regex},
                    {"work_details.designation_name": q_regex}
                ]
            })

        if department_id:
            dept_regex = re.compile(f"^{re.escape(str(department_id))}$", re.IGNORECASE)
            and_conditions.append({
                "$or": [
                    {"work_details.department_id": str(department_id)},
                    {"work_details.department_name": dept_regex},
                    {"work_details.department": dept_regex},
                    {"department_id": str(department_id)},
                    {"department_name": dept_regex}
                ]
            })

        if designation_id:
            desig_regex = re.compile(f"^{re.escape(str(designation_id))}$", re.IGNORECASE)
            and_conditions.append({
                "$or": [
                    {"work_details.designation_id": str(designation_id)},
                    {"work_details.designation_name": desig_regex},
                    {"work_details.designation": desig_regex},
                    {"designation_id": str(designation_id)},
                    {"designation_name": desig_regex}
                ]
            })

        query = {"$and": and_conditions} if and_conditions else {}

        cursor = db["employees"].find(query).limit(limit)
        docs = await cursor.to_list(length=limit)

        results = []
        for emp in docs:
            emp_id = emp.get("work_details", {}).get("employee_id") or str(emp.get("_id"))
            p_info = emp.get("personal_info", {})
            w_details = emp.get("work_details", {})

            name = emp.get("name")
            if not name:
                fn = p_info.get("first_name", "")
                ln = p_info.get("last_name", "")
                name = f"{fn} {ln}".strip() or emp_id

            dept = w_details.get("department_name") or w_details.get("department") or ""
            desig = w_details.get("designation_name") or w_details.get("designation") or ""
            email = emp.get("email") or p_info.get("email") or ""

            results.append({
                "id": str(emp["_id"]),
                "employee_id": emp_id,
                "name": name,
                "email": email,
                "department": dept,
                "designation": desig,
                "profile_image": emp.get("profile_image") or p_info.get("profile_image")
            })

        return results
