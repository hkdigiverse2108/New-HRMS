from app.database.db import get_database
from app.config import settings
from bson import ObjectId
from typing import Dict, Any, List, Optional
from datetime import date, datetime, timedelta
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

class BookingRepository:
    page_collection = "booking_pages"
    booking_collection = "appointment_bookings"

    @classmethod
    async def get_db(cls):
        return get_database()

    @staticmethod
    def build_general_availability(
        working_days: List[str],
        start_time: str = "09:00",
        end_time: str = "17:00",
        custom_availability: Optional[Dict[str, Any]] = None,
        copy_from_day: Optional[str] = None
    ) -> Dict[str, Any]:
        all_days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        res = {}

        # If copy_from_day is specified and exists in custom_availability, extract its windows to replicate
        copied_windows = None
        if copy_from_day and custom_availability and copy_from_day in custom_availability:
            day_cfg = custom_availability[copy_from_day]
            if isinstance(day_cfg, dict):
                copied_windows = day_cfg.get("windows", [])
            elif isinstance(day_cfg, list):
                copied_windows = day_cfg

        for day in all_days:
            is_working = day in working_days
            if custom_availability and day in custom_availability and not (copy_from_day and is_working):
                day_cfg = custom_availability[day]
                if isinstance(day_cfg, dict):
                    res[day] = {
                        "is_available": day_cfg.get("is_available", is_working),
                        "windows": day_cfg.get("windows", [])
                    }
                elif isinstance(day_cfg, list):
                    res[day] = {
                        "is_available": is_working and len(day_cfg) > 0,
                        "windows": day_cfg
                    }
            elif copied_windows is not None:
                res[day] = {
                    "is_available": is_working,
                    "windows": copied_windows if is_working else []
                }
            else:
                res[day] = {
                    "is_available": is_working,
                    "windows": [{"start_time": start_time, "end_time": end_time}] if is_working else []
                }
        return res

    @classmethod
    def get_base_frontend_url(cls, request_base_url: Optional[str] = None) -> str:
        env_url = (settings.FRONTEND_SCHEDULE_URL or "").strip()
        if env_url:
            if env_url.endswith("/schedule"):
                env_url = env_url[:-9]
            elif env_url.endswith("/schedule/"):
                env_url = env_url[:-10]
            return env_url.rstrip('/')
        if request_base_url:
            return request_base_url.rstrip('/')
        return f"http://localhost:{settings.PORT}"

    @classmethod
    async def create_booking_page(cls, employee_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        db = await cls.get_db()
        now = datetime.utcnow()

        base_frontend = cls.get_base_frontend_url(data.get("request_base_url"))
        shareable_url = f"{base_frontend}/book/{employee_id}"

        working_days = data.get("working_days", ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"])
        start_time = data.get("start_time", "09:00")
        end_time = data.get("end_time", "17:00")
        gen_avail = data.get("general_availability")
        copy_from_day = data.get("copy_from_day")

        formatted_avail = cls.build_general_availability(
            working_days=working_days,
            start_time=start_time,
            end_time=end_time,
            custom_availability=gen_avail,
            copy_from_day=copy_from_day
        )

        doc = {
            "employee_id": employee_id,
            "title": data.get("title", "30 Min Consultation"),
            "shareable_url": shareable_url,
            "duration_minutes": data.get("duration_minutes", 30),
            "recurrence": data.get("recurrence", "Repeat weekly"),
            "general_availability": formatted_avail,
            "co_host_employee_ids": data.get("co_host_employee_ids", []),
            "working_days": working_days,
            "start_time": start_time,
            "end_time": end_time,
            "is_active": data.get("is_active", True),
            "created_at": now
        }

        result = await db[cls.page_collection].insert_one(doc)
        doc["_id"] = result.inserted_id
        doc["id"] = str(result.inserted_id)
        
        # Update shareable_url with specific page_id
        shareable_url = f"{base_frontend}/book/{employee_id}?page_id={doc['id']}"
        await db[cls.page_collection].update_one({"_id": result.inserted_id}, {"$set": {"shareable_url": shareable_url}})
        doc["shareable_url"] = shareable_url

        return await cls._populate_page_doc(doc)

    @classmethod
    async def populate_employee_info(cls, employee_id: str) -> Dict[str, Any]:
        if not employee_id:
            return {}
        db = await cls.get_db()
        query = {
            "$or": [
                {"work_details.employee_id": employee_id},
                {"_id": ObjectId(employee_id) if ObjectId.is_valid(employee_id) else None}
            ]
        }
        emp = await db["employees"].find_one(query)
        if not emp:
            return {"employee_id": employee_id, "name": employee_id}

        emp_code = emp.get("work_details", {}).get("employee_id") or str(emp.get("_id"))
        p_info = emp.get("personal_info", {})
        w_details = emp.get("work_details", {})

        fn = p_info.get("first_name", "")
        ln = p_info.get("last_name", "")
        name = emp.get("name") or f"{fn} {ln}".strip() or emp_code

        return {
            "employee_id": emp_code,
            "name": name,
            "email": emp.get("email") or p_info.get("email") or ""
        }

    @classmethod
    async def _populate_page_doc(cls, doc: Dict[str, Any]) -> Dict[str, Any]:
        if not doc:
            return doc
        doc = serialize_mongo(doc)

        emp_id = doc.get("employee_id")
        if emp_id:
            doc["employee_details"] = await cls.populate_employee_info(emp_id)

        co_host_ids = doc.get("co_host_employee_ids") or []
        co_hosts_list = []
        for ch_id in co_host_ids:
            ch_info = await cls.populate_employee_info(ch_id)
            if ch_info:
                co_hosts_list.append(ch_info)
        doc["co_hosts"] = co_hosts_list

        return doc

    @classmethod
    async def _populate_appointment_doc(cls, doc: Dict[str, Any]) -> Dict[str, Any]:
        if not doc:
            return doc
        doc = serialize_mongo(doc)

        host_id = doc.get("host_employee_id")
        if host_id:
            doc["host_details"] = await cls.populate_employee_info(host_id)

        b_page_id = doc.get("booking_page_id")
        if b_page_id:
            page_doc = await cls.get_booking_page_by_id(b_page_id)
            if page_doc:
                doc["booking_page_details"] = page_doc

        return doc

    @classmethod
    async def get_employee_booking_pages(cls, employee_id: str) -> List[Dict[str, Any]]:
        db = await cls.get_db()
        cursor = db[cls.page_collection].find({"employee_id": employee_id})
        docs = await cursor.to_list(length=100)
        return [await cls._populate_page_doc(d) for d in docs]

    @classmethod
    async def get_booking_page_by_id(cls, page_id: str, employee_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        db = await cls.get_db()
        try:
            obj_id = ObjectId(page_id)
            query = {"_id": obj_id}
            if employee_id:
                query["employee_id"] = employee_id
            doc = await db[cls.page_collection].find_one(query)
            return await cls._populate_page_doc(doc) if doc else None
        except Exception:
            return None

    @classmethod
    async def update_booking_page(cls, page_id: str, employee_id: str, update_data: Dict[str, Any]) -> bool:
        db = await cls.get_db()
        try:
            obj_id = ObjectId(page_id)
            existing = await db[cls.page_collection].find_one({"_id": obj_id, "employee_id": employee_id})
            if not existing:
                return False

            copy_from_day = update_data.pop("copy_from_day", None)
            
            working_days = update_data.get("working_days", existing.get("working_days", ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]))
            start_time = update_data.get("start_time", existing.get("start_time", "09:00"))
            end_time = update_data.get("end_time", existing.get("end_time", "17:00"))
            gen_avail = update_data.get("general_availability", existing.get("general_availability"))

            if copy_from_day or "general_availability" in update_data or "working_days" in update_data or "start_time" in update_data or "end_time" in update_data:
                update_data["general_availability"] = cls.build_general_availability(
                    working_days=working_days,
                    start_time=start_time,
                    end_time=end_time,
                    custom_availability=gen_avail,
                    copy_from_day=copy_from_day
                )

            result = await db[cls.page_collection].update_one(
                {"_id": obj_id, "employee_id": employee_id},
                {"$set": update_data}
            )
            return result.modified_count > 0 or result.matched_count > 0
        except Exception:
            return False

    @classmethod
    async def delete_booking_page(cls, page_id: str, employee_id: str) -> bool:
        db = await cls.get_db()
        try:
            obj_id = ObjectId(page_id)
            result = await db[cls.page_collection].delete_one({"_id": obj_id, "employee_id": employee_id})
            return result.deleted_count > 0
        except Exception:
            return False

    @classmethod
    async def get_public_employee_profile(cls, employee_id: str) -> Optional[Dict[str, Any]]:
        db = await cls.get_db()

        # Find employee
        query = {
            "$or": [
                {"work_details.employee_id": employee_id},
                {"_id": ObjectId(employee_id) if ObjectId.is_valid(employee_id) else None}
            ]
        }
        emp = await db["employees"].find_one(query)
        if not emp:
            return None

        emp_code = emp.get("work_details", {}).get("employee_id") or str(emp.get("_id"))
        p_info = emp.get("personal_info", {})
        w_details = emp.get("work_details", {})

        name = emp.get("name")
        if not name:
            fn = p_info.get("first_name", "")
            ln = p_info.get("last_name", "")
            name = f"{fn} {ln}".strip() or emp_code

        dept = w_details.get("department_name") or w_details.get("department") or ""
        desig = w_details.get("designation_name") or w_details.get("designation") or ""
        email = emp.get("email") or p_info.get("email") or ""

        # Fetch active booking pages for employee
        pages = await cls.get_employee_booking_pages(emp_code)
        active_pages = [p for p in pages if p.get("is_active", True)]

        return {
            "employee_id": emp_code,
            "name": name,
            "email": email,
            "department": dept,
            "designation": desig,
            "profile_image": emp.get("profile_image") or p_info.get("profile_image"),
            "booking_pages": active_pages
        }

    @classmethod
    async def calculate_public_available_slots(
        cls,
        employee_id: str,
        target_date: date,
        page_id: Optional[str] = None
    ) -> Dict[str, Any]:
        db = await cls.get_db()
        date_str = target_date.isoformat()
        day_name = target_date.strftime("%A") # e.g. "Monday"

        # Fetch booking page config or default
        page_config = None
        if page_id:
            page_config = await cls.get_booking_page_by_id(page_id)
            if not page_config or not page_config.get("is_active", True):
                return {
                    "is_valid_page": False,
                    "date": date_str,
                    "day_name": day_name,
                    "is_working_day": False,
                    "total_available_slots": 0,
                    "available_slots": []
                }
        else:
            pages = await cls.get_employee_booking_pages(employee_id)
            active_pages = [p for p in pages if p.get("is_active", True)]
            if not active_pages:
                return {
                    "is_valid_page": False,
                    "date": date_str,
                    "day_name": day_name,
                    "is_working_day": False,
                    "total_available_slots": 0,
                    "available_slots": []
                }
            page_config = active_pages[0]

        working_days = page_config.get("working_days") or ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
        if day_name not in working_days:
            return {
                "date": date_str,
                "day_name": day_name,
                "is_working_day": False,
                "total_available_slots": 0,
                "available_slots": []
            }

        start_time_str = page_config.get("start_time", "09:00")
        end_time_str = page_config.get("end_time", "17:00")
        duration = page_config.get("duration_minutes", 30)

        # Parse general_availability if configured for day_name
        gen_availability = page_config.get("general_availability") or {}
        day_windows = []

        if isinstance(gen_availability, dict) and day_name in gen_availability:
            day_cfg = gen_availability[day_name]
            if isinstance(day_cfg, dict):
                is_avail = day_cfg.get("is_available", True)
                if not is_avail:
                    return {
                        "date": date_str,
                        "day_name": day_name,
                        "is_working_day": False,
                        "total_available_slots": 0,
                        "available_slots": []
                    }
                raw_wins = day_cfg.get("windows", [])
                for w in raw_wins:
                    if isinstance(w, dict) and "start_time" in w and "end_time" in w:
                        day_windows.append((parse_time_to_minutes(w["start_time"]), parse_time_to_minutes(w["end_time"])))
            elif isinstance(day_cfg, list):
                for w in day_cfg:
                    if isinstance(w, dict) and "start_time" in w and "end_time" in w:
                        day_windows.append((parse_time_to_minutes(w["start_time"]), parse_time_to_minutes(w["end_time"])))

        # Fallback to single daily window if no specific per-day windows were found
        if not day_windows:
            day_start = parse_time_to_minutes(start_time_str)
            day_end = parse_time_to_minutes(end_time_str)
            if day_end > day_start:
                day_windows = [(day_start, day_end)]

        # Collect busy ranges
        busy_ranges = []

        # 1. HRMS Events
        hrms_cursor = db["schedule_events"].find({
            "date": date_str,
            "$or": [
                {"primary_employee_id": employee_id},
                {"attendees": employee_id},
                {"created_by": employee_id}
            ]
        })
        hrms_events = await hrms_cursor.to_list(length=200)
        for ev in hrms_events:
            s_m = parse_time_to_minutes(ev.get("start_time", "09:00"))
            e_m = parse_time_to_minutes(ev.get("end_time", "18:00"))
            if e_m > s_m:
                busy_ranges.append((s_m, e_m))

        # 2. Google Calendar Events
        try:
            from app.services.google_calendar import GoogleCalendarService
            g_events = await GoogleCalendarService.fetch_google_calendar_events(
                employee_id=employee_id,
                start_date=target_date,
                end_date=target_date
            )
            for gev in g_events:
                s_m = parse_time_to_minutes(gev.get("start_time", "09:00"))
                e_m = parse_time_to_minutes(gev.get("end_time", "18:00"))
                if e_m > s_m:
                    busy_ranges.append((s_m, e_m))
        except Exception:
            pass

        # 3. Approved Leaves
        try:
            leave_cursor = db["leave_requests"].find({
                "employee_id": employee_id,
                "status": "APPROVED",
                "start_date": {"$lte": date_str},
                "end_date": {"$gte": date_str}
            })
            leaves = await leave_cursor.to_list(length=100)
            if leaves:
                busy_ranges.append((0, 24 * 60))
        except Exception:
            pass

        # Evaluate available slots
        available_slots = []
        step = duration

        for win_start, win_end in day_windows:
            curr = win_start
            while curr + step <= win_end:
                slot_s = curr
                slot_e = curr + step

                is_busy = False
                for b_s, b_e in busy_ranges:
                    if max(slot_s, b_s) < min(slot_e, b_e):
                        is_busy = True
                        break

                if not is_busy:
                    s_str = format_minutes_to_time(slot_s)
                    e_str = format_minutes_to_time(slot_e)
                    label = f"{format_minutes_to_12h(slot_s)} - {format_minutes_to_12h(slot_e)}"
                    available_slots.append({
                        "start_time": s_str,
                        "end_time": e_str,
                        "label": label
                    })

                curr += step

        page_title = page_config.get("title", "Appointment Schedule")
        page_id_str = page_config.get("id") or page_config.get("_id")

        return {
            "booking_page_id": page_id_str,
            "booking_page_title": page_title,
            "configured_start_time": start_time_str,
            "configured_end_time": end_time_str,
            "duration_minutes": duration,
            "date": date_str,
            "day_name": day_name,
            "is_working_day": True,
            "total_available_slots": len(available_slots),
            "available_slots": available_slots
        }

    @classmethod
    async def create_guest_appointment_booking(
        cls,
        employee_id: str,
        booking_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        db = await cls.get_db()
        now = datetime.utcnow()

        target_date_val = booking_data.get("date")
        date_str = target_date_val.isoformat() if isinstance(target_date_val, date) else str(target_date_val)
        
        first_name = (booking_data.get("first_name") or "").strip()
        last_name = (booking_data.get("last_name") or booking_data.get("surname") or "").strip()
        guest_name = (booking_data.get("guest_name") or "").strip()
        if not guest_name:
            guest_name = f"{first_name} {last_name}".strip()
        if not guest_name:
            guest_name = "Guest User"

        guest_email = booking_data.get("guest_email", "")
        guest_notes = booking_data.get("guest_notes", "")
        start_time = booking_data.get("start_time", "10:00")
        end_time = booking_data.get("end_time", "10:30")

        req_s = parse_time_to_minutes(start_time)
        req_e = parse_time_to_minutes(end_time)

        # 1. Check existing confirmed appointment bookings for host
        existing_bookings_cursor = db[cls.booking_collection].find({
            "host_employee_id": employee_id,
            "date": date_str,
            "status": "CONFIRMED"
        })
        existing_bookings = await existing_bookings_cursor.to_list(length=100)
        for b in existing_bookings:
            b_s = parse_time_to_minutes(b.get("start_time", ""))
            b_e = parse_time_to_minutes(b.get("end_time", ""))
            if max(req_s, b_s) < min(req_e, b_e):
                return {"error": "This time slot has already been booked. Please select a different time slot."}

        # 2. Check existing HRMS schedule events for host
        existing_events_cursor = db["schedule_events"].find({
            "date": date_str,
            "$or": [
                {"primary_employee_id": employee_id},
                {"attendees": employee_id}
            ]
        })
        existing_events = await existing_events_cursor.to_list(length=100)
        for ev in existing_events:
            ev_s = parse_time_to_minutes(ev.get("start_time", ""))
            ev_e = parse_time_to_minutes(ev.get("end_time", ""))
            if max(req_s, ev_s) < min(req_e, ev_e):
                return {"error": "This time slot has already been booked. Please select a different time slot."}

        # Get Host Employee details
        profile = await cls.get_public_employee_profile(employee_id)
        host_name = profile.get("name") if profile else employee_id

        # Fetch booking page title & co-hosts if page ID supplied
        b_page_id = booking_data.get("booking_page_id")
        page_title = "Appointment"
        co_hosts = []
        if b_page_id:
            p_cfg = await cls.get_booking_page_by_id(b_page_id)
            if p_cfg:
                if p_cfg.get("title"):
                    page_title = p_cfg.get("title")
                co_hosts = p_cfg.get("co_host_employee_ids") or []

        event_title = f"🤝 {page_title}: {guest_name}"

        attendees_list = list(set([employee_id] + co_hosts))

        # 1. Create HRMS Schedule Event
        hrms_event_doc = {
            "title": event_title,
            "primary_employee_id": employee_id,
            "attendees": attendees_list,
            "date": date_str,
            "type": "Meeting",
            "start_time": start_time,
            "end_time": end_time,
            "description": f"Guest Booking by {guest_name} ({guest_email})\nNotes: {guest_notes}",
            "category": "my_schedule",
            "color": "#6f42c1", # Purple
            "created_by": f"guest_{guest_email}",
            "created_at": now,
            "is_auto_generated": False
        }
        hrms_res = await db["schedule_events"].insert_one(hrms_event_doc)
        hrms_event_id = str(hrms_res.inserted_id)

        # 2. Push to Host's Google Calendar
        try:
            from app.services.google_calendar import GoogleCalendarService
            await GoogleCalendarService.push_hrms_event_to_google(employee_id, {
                "id": hrms_event_id,
                "title": event_title,
                "date": date_str,
                "start_time": start_time,
                "end_time": end_time,
                "description": f"Guest Booking by {guest_name} ({guest_email})\nNotes: {guest_notes}"
            })
        except Exception as e:
            print(f"[GUEST BOOKING GOOGLE SYNC WARNING] {e}")

        # 3. Create Appointment Booking Record
        booking_doc = {
            "booking_page_id": booking_data.get("booking_page_id"),
            "host_employee_id": employee_id,
            "host_name": host_name,
            "guest_name": guest_name,
            "first_name": first_name,
            "last_name": last_name,
            "guest_email": guest_email,
            "guest_notes": guest_notes,
            "date": date_str,
            "start_time": start_time,
            "end_time": end_time,
            "status": "CONFIRMED",
            "hrms_event_id": hrms_event_id,
            "created_at": now
        }
        booking_res = await db[cls.booking_collection].insert_one(booking_doc)
        booking_doc["_id"] = booking_res.inserted_id

        # 4. Attempt Confirmation Email
        try:
            from app.utils.email import send_otp_email
            # Simple notification print or email trigger
            print(f"[BOOKING CONFIRMED] Appointment created for {guest_name} with {host_name} on {date_str} {start_time}-{end_time}")
        except Exception:
            pass

        return await cls._populate_appointment_doc(booking_doc)

    @classmethod
    async def get_employee_bookings(cls, employee_id: str) -> List[Dict[str, Any]]:
        db = await cls.get_db()
        cursor = db[cls.booking_collection].find({"host_employee_id": employee_id}).sort("created_at", -1)
        docs = await cursor.to_list(length=200)
        return [await cls._populate_appointment_doc(d) for d in docs]

    @classmethod
    async def cancel_booking(cls, booking_id: str) -> bool:
        db = await cls.get_db()
        try:
            obj_id = ObjectId(booking_id)
            booking = await db[cls.booking_collection].find_one({"_id": obj_id})
            if not booking:
                return False

            # Delete associated HRMS event if present
            hrms_event_id = booking.get("hrms_event_id")
            if hrms_event_id and ObjectId.is_valid(hrms_event_id):
                await db["schedule_events"].delete_one({"_id": ObjectId(hrms_event_id)})

            # Update booking status to CANCELLED
            await db[cls.booking_collection].update_one({"_id": obj_id}, {"$set": {"status": "CANCELLED"}})
            return True
        except Exception:
            return False
