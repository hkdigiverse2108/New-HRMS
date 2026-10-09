import urllib.parse
import httpx
from datetime import date, datetime
from typing import Dict, Any, List, Optional
from app.config import settings
from app.repository.google_auth import GoogleAuthRepository

class GoogleCalendarService:
    SCOPES = [
        "https://www.googleapis.com/auth/calendar.events",
        "https://www.googleapis.com/auth/calendar.readonly",
        "https://www.googleapis.com/auth/userinfo.email",
        "openid"
    ]

    @classmethod
    def get_redirect_uri(cls, request_base_url: Optional[str] = None) -> str:
        configured_uri = (settings.GOOGLE_REDIRECT_URI or "").strip()
        if request_base_url:
            base = request_base_url.rstrip('/')
            if "localhost" not in base and "127.0.0.1" not in base:
                return f"{base}/schedule/google/callback"
        if configured_uri:
            return configured_uri
        if request_base_url:
            return f"{request_base_url.rstrip('/')}/schedule/google/callback"
        return f"http://localhost:{settings.PORT}/schedule/google/callback"

    @classmethod
    def generate_auth_url(cls, employee_id: str, request_base_url: Optional[str] = None) -> str:
        client_id = (settings.GOOGLE_CLIENT_ID or "").strip()
        redirect_uri = cls.get_redirect_uri(request_base_url)

        params = {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": " ".join(cls.SCOPES),
            "access_type": "offline",
            "prompt": "consent",
            "state": employee_id
        }
        auth_url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode(params)
        return auth_url

    @classmethod
    async def exchange_code_for_tokens(cls, code: str, request_base_url: Optional[str] = None) -> Dict[str, Any]:
        token_url = "https://oauth2.googleapis.com/token"
        client_id = (settings.GOOGLE_CLIENT_ID or "").strip()
        client_secret = (settings.GOOGLE_CLIENT_SECRET or "").strip()
        redirect_uri = cls.get_redirect_uri(request_base_url)

        payload = {
            "client_id": client_id,
            "client_secret": client_secret,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": redirect_uri
        }

        async with httpx.AsyncClient() as client:
            resp = await client.post(token_url, data=payload, timeout=15.0)
            if resp.status_code != 200:
                raise Exception(f"Google Token Exchange Failed: {resp.text}")

            tokens = resp.json()
            access_token = tokens.get("access_token")

            # Fetch Google User Profile Email
            email = ""
            userinfo_url = "https://www.googleapis.com/oauth2/v2/userinfo"
            userinfo_resp = await client.get(
                userinfo_url,
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=10.0
            )
            if userinfo_resp.status_code == 200:
                userinfo = userinfo_resp.json()
                email = userinfo.get("email", "")

            return {
                "tokens": tokens,
                "google_email": email
            }

    @classmethod
    async def fetch_google_calendar_events(
        cls,
        employee_id: str,
        start_date: date,
        end_date: date
    ) -> List[Dict[str, Any]]:
        access_token = await GoogleAuthRepository.get_valid_access_token(employee_id)
        if not access_token:
            return []

        time_min = f"{start_date.isoformat()}T00:00:00Z"
        time_max = f"{end_date.isoformat()}T23:59:59Z"

        url = "https://www.googleapis.com/calendar/v3/calendars/primary/events"
        params = {
            "timeMin": time_min,
            "timeMax": time_max,
            "singleEvents": "true",
            "orderBy": "startTime"
        }

        events = []
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    url,
                    headers={"Authorization": f"Bearer {access_token}"},
                    params=params,
                    timeout=10.0
                )
                if resp.status_code == 200:
                    items = resp.json().get("items", [])
                    for item in items:
                        start_info = item.get("start", {})
                        end_info = item.get("end", {})

                        start_raw = start_info.get("dateTime") or start_info.get("date")
                        end_raw = end_info.get("dateTime") or end_info.get("date")

                        if not start_raw:
                            continue

                        # Parse date and start/end time
                        if "T" in start_raw:
                            dt_start = datetime.fromisoformat(start_raw.replace("Z", "+00:00"))
                            ev_date = dt_start.date().isoformat()
                            s_time = dt_start.strftime("%H:%M")
                        else:
                            ev_date = start_raw
                            s_time = "09:00"

                        if end_raw and "T" in end_raw:
                            dt_end = datetime.fromisoformat(end_raw.replace("Z", "+00:00"))
                            e_time = dt_end.strftime("%H:%M")
                        else:
                            e_time = "18:00"

                        hangout_link = item.get("hangoutLink") or item.get("htmlLink") or ""
                        summary = item.get("summary") or "Untitled Google Event"
                        desc = item.get("description") or ""
                        if hangout_link and hangout_link not in desc:
                            desc = f"Google Meet: {hangout_link}\n{desc}".strip()

                        events.append({
                            "_id": f"gcal_{item.get('id')}",
                            "id": f"gcal_{item.get('id')}",
                            "title": f"📅 Google: {summary}",
                            "primary_employee_id": employee_id,
                            "attendees": [item.get("creator", {}).get("email", "")],
                            "date": ev_date,
                            "type": "Google Calendar",
                            "start_time": s_time,
                            "end_time": e_time,
                            "description": desc,
                            "category": "google_calendar",
                            "color": "#4285F4", # Google Blue
                            "created_by": "google",
                            "is_auto_generated": True
                        })
        except Exception as e:
            print(f"[GOOGLE CALENDAR FETCH ERROR] Failed to fetch events for {employee_id}: {e}")

        return events

    @classmethod
    async def fetch_holiday_events(
        cls,
        employee_id: str,
        start_date: date,
        end_date: date
    ) -> List[Dict[str, Any]]:
        """
        Fetch festival/holiday events (e.g. 'Holidays in India', Diwali, Dussehra)
        from the Google calendars the user is subscribed to.
        Returns [] when Google is not connected — never raises.
        """
        access_token = await GoogleAuthRepository.get_valid_access_token(employee_id)
        if not access_token:
            return []

        time_min = f"{start_date.isoformat()}T00:00:00Z"
        time_max = f"{end_date.isoformat()}T23:59:59Z"

        events: List[Dict[str, Any]] = []
        try:
            async with httpx.AsyncClient() as client:
                # 1. Discover subscribed calendars, keep holiday ones
                cal_resp = await client.get(
                    "https://www.googleapis.com/calendar/v3/users/me/calendarList",
                    headers={"Authorization": f"Bearer {access_token}"},
                    timeout=10.0
                )
                if cal_resp.status_code != 200:
                    return []
                calendars = cal_resp.json().get("items", [])
                holiday_cals = [
                    c for c in calendars
                    if "holiday" in str(c.get("id", "")).lower()
                    or "holiday" in str(c.get("summary", "")).lower()
                ]

                # 2. Pull events from each holiday calendar
                for cal in holiday_cals:
                    cal_id = cal.get("id")
                    try:
                        resp = await client.get(
                            f"https://www.googleapis.com/calendar/v3/calendars/{urllib.parse.quote(cal_id, safe='')}/events",
                            headers={"Authorization": f"Bearer {access_token}"},
                            params={
                                "timeMin": time_min,
                                "timeMax": time_max,
                                "singleEvents": "true",
                                "orderBy": "startTime",
                            },
                            timeout=10.0
                        )
                        if resp.status_code != 200:
                            continue
                        for item in resp.json().get("items", []):
                            start_info = item.get("start", {})
                            start_raw = start_info.get("dateTime") or start_info.get("date")
                            if not start_raw:
                                continue
                            if "T" in start_raw:
                                dt_start = datetime.fromisoformat(start_raw.replace("Z", "+00:00"))
                                ev_date = dt_start.date().isoformat()
                            else:
                                ev_date = start_raw
                            summary = item.get("summary") or "Holiday"
                            events.append({
                                "_id": f"ghol_{item.get('id')}",
                                "id": f"ghol_{item.get('id')}",
                                "title": f"🎊 {summary}",
                                "primary_employee_id": employee_id,
                                "attendees": [],
                                "date": ev_date,
                                "type": "Holiday",
                                "start_time": "09:00",
                                "end_time": "18:00",
                                "description": f"{cal.get('summary', 'Holiday calendar')}",
                                "category": "google_holidays",
                                "color": "#0b8043",
                                "created_by": "google",
                                "is_auto_generated": True
                            })
                    except Exception as e:
                        print(f"[GOOGLE HOLIDAY FETCH WARNING] {cal.get('summary')}: {e}")
                        continue
        except Exception as e:
            print(f"[GOOGLE HOLIDAY FETCH ERROR] Failed for {employee_id}: {e}")

        return events

    @classmethod
    async def push_hrms_event_to_google(
        cls,
        employee_id: str,
        event_data: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        access_token = await GoogleAuthRepository.get_valid_access_token(employee_id)
        if not access_token:
            return None

        event_date_str = str(event_data.get("date"))
        s_time = event_data.get("start_time", "10:00")
        e_time = event_data.get("end_time", "11:00")

        start_datetime = f"{event_date_str}T{s_time}:00"
        end_datetime = f"{event_date_str}T{e_time}:00"

        gcal_payload = {
            "summary": f"[HRMS] {event_data.get('title')}",
            "description": event_data.get("description") or "Scheduled via HRMS Portal",
            "start": {
                "dateTime": f"{start_datetime}Z",
                "timeZone": "UTC"
            },
            "end": {
                "dateTime": f"{end_datetime}Z",
                "timeZone": "UTC"
            }
        }

        url = "https://www.googleapis.com/calendar/v3/calendars/primary/events"
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    url,
                    json=gcal_payload,
                    headers={"Authorization": f"Bearer {access_token}"},
                    timeout=10.0
                )
                if resp.status_code in (200, 201):
                    res_data = resp.json()
                    return {
                        "google_event_id": res_data.get("id")
                    }
        except Exception as e:
            print(f"[GOOGLE CALENDAR PUSH ERROR] Failed to push event for {employee_id}: {e}")

        return None
