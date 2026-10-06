from fastapi import APIRouter, Depends, Query, status, HTTPException, Request
from fastapi.responses import RedirectResponse, HTMLResponse
from typing import Optional, List, Dict, Any
from datetime import date, datetime
import urllib.parse

from app.config import settings
from app.schemas.schedule import (
    ScheduleEventCreate,
    ScheduleEventUpdate,
    ScheduleEventResponse,
    FreeSlotsRequest,
    FreeSlotsResponse,
    BulkOptionsResponse,
    CalendarFeedResponse
)
from app.repository.schedule import ScheduleRepository
from app.repository.google_auth import GoogleAuthRepository
from app.services.google_calendar import GoogleCalendarService
from app.controllers.auth import get_current_employee

router = APIRouter(prefix="/schedule", tags=["Schedule & Calendar"])

@router.post("/events", response_model=ScheduleEventResponse, status_code=status.HTTP_201_CREATED)
async def create_schedule_event(
    payload: ScheduleEventCreate,
    current_employee: dict = Depends(get_current_employee)
):
    """
    Create a new schedule block or meeting event.
    Supports single primary host + individual colleagues + bulk criteria (department, designation, role).
    """
    user_id = str(current_employee.get("work_details", {}).get("employee_id") or current_employee.get("_id") or current_employee.get("id"))
    data = payload.model_dump()
    created = await ScheduleRepository.create_event(data=data, user_id=user_id)
    return created

@router.post("/available-slots", response_model=FreeSlotsResponse)
async def get_available_free_slots(
    payload: FreeSlotsRequest,
    current_employee: dict = Depends(get_current_employee)
):
    """
    Compute common overlapping free time slots for selected primary host + colleagues on a target date.
    Calculates existing schedules and approved leave requests.
    """
    result = await ScheduleRepository.get_free_time_slots(
        employee_ids=payload.employee_ids,
        target_date=payload.date,
        duration_minutes=payload.slot_duration_minutes
    )
    return result

@router.get("/bulk-options", response_model=BulkOptionsResponse)
async def get_bulk_options(
    current_employee: dict = Depends(get_current_employee)
):
    """
    Get dynamic dropdown lists for bulk attendee selection: Departments, Designations, and Roles.
    """
    options = await ScheduleRepository.get_bulk_options()
    return options

@router.get("/team-users", response_model=List[Dict[str, Any]])
async def get_schedule_team_users(
    q: Optional[str] = Query(None, description="Search active users by name or employee ID"),
    current_employee: dict = Depends(get_current_employee)
):
    """
    Team Calendars user list (Admin/HR only): all active, non-deleted users.
    """
    user_role = (current_employee.get("work_details", {}).get("system_role") or current_employee.get("role") or "Employee")
    if user_role not in ("Admin", "SuperAdmin", "HR", "Sub-Admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Admin/HR can view the team list.")
    return await ScheduleRepository.get_team_users(query_str=q)

@router.get("/feed", response_model=Dict[str, Any])
@router.get("/calendar", response_model=Dict[str, Any])
async def get_my_calendar_feed(
    reference_date: Optional[date] = Query(None, description="Target/Reference date (defaults to today)"),
    view_mode: str = Query("month", description="View mode: month, week, day, today"),
    categories: Optional[str] = Query(None, description="Comma-separated category filters: my_schedule,work_anniversary,birthday"),
    q: Optional[str] = Query(None, description="Search query string"),
    employee_ids: Optional[str] = Query(None, description="Admin/HR only: comma-separated employee IDs for multi-user team view"),
    current_employee: dict = Depends(get_current_employee)
):
    """
    Get Calendar Feed with full UI filters:
    - View Mode: Month, Week, Day, Today
    - Categories: My Schedule (my_schedule), Work Anniversaries (work_anniversary), Birthdays (birthday)
    - Date Navigation: Target reference date
    - Search: Filter events by title/search query
    """
    user_id = str(current_employee.get("work_details", {}).get("employee_id") or current_employee.get("_id") or current_employee.get("id"))
    user_role = (current_employee.get("work_details", {}).get("system_role") or current_employee.get("role") or "Employee")
    is_admin_or_hr = user_role in ("Admin", "SuperAdmin", "HR", "Sub-Admin")
    ref_d = reference_date or date.today()

    cat_list = [c.strip() for c in categories.split(",")] if categories else None

    # Multi-user team view: admin/HR only. Non-admin always sees only self.
    targets: Optional[List[str]] = None
    if employee_ids:
        if not is_admin_or_hr:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Admin/HR can view other users' calendars.")
        targets = [t.strip() for t in employee_ids.split(",") if t.strip()][:50]

    feed = await ScheduleRepository.get_calendar_feed(
        user_id=user_id,
        reference_date=ref_d,
        view_mode=view_mode.lower(),
        categories=cat_list,
        search_query=q,
        target_user_ids=targets,
        is_admin_or_hr=is_admin_or_hr
    )
    return feed

@router.get("/employee-events", response_model=Dict[str, Any])
async def get_other_employee_schedule(
    employee_id: str = Query(..., description="Target employee ID whose schedule to view"),
    reference_date: Optional[date] = Query(None, description="Reference date (defaults to today)"),
    view_mode: str = Query("week", description="View mode: today, day, week, month"),
    current_employee: dict = Depends(get_current_employee)
):
    """
    View another employee's schedule.
    Privacy Protection: Sensitive meeting details (title, description) are automatically masked as '🔒 Slot Booked'
    for regular employees, unless the viewer is an attendee/host or has Admin/HR role.
    """
    viewer_id = str(current_employee.get("work_details", {}).get("employee_id") or current_employee.get("_id") or current_employee.get("id"))
    user_role = (current_employee.get("work_details", {}).get("system_role") or current_employee.get("role") or "Employee")
    is_admin_or_hr = user_role in ("Admin", "HR", "Sub-Admin")

    ref_date = reference_date or date.today()

    view = await ScheduleRepository.get_employee_calendar_view(
        target_employee_id=employee_id,
        viewer_employee_id=viewer_id,
        reference_date=ref_date,
        view_mode=view_mode.lower(),
        is_admin_or_hr=is_admin_or_hr
    )
    return view

@router.get("/employees/search", response_model=List[Dict[str, Any]])
async def search_employees_for_schedule(
    q: Optional[str] = Query(None, description="Search by employee name, ID, email, department, or designation"),
    department_id: Optional[str] = Query(None, description="Filter by department ID or Name"),
    designation_id: Optional[str] = Query(None, description="Filter by designation ID or Name"),
    limit: int = Query(20, ge=1, le=100, description="Max results limit"),
    current_employee: dict = Depends(get_current_employee)
):
    """
    Search bar API for employees.
    Supports real-time search by Employee Name, Employee ID, Email, Department, or Designation.
    """
    results = await ScheduleRepository.search_employees(
        query_str=q,
        department_id=department_id,
        designation_id=designation_id,
        limit=limit
    )
    return results

@router.get("/events/{event_id}", response_model=ScheduleEventResponse)
async def get_event_by_id(
    event_id: str,
    current_employee: dict = Depends(get_current_employee)
):
    """
    Get single schedule event by ID.
    NOTE: declared after /employee-events and /employees/search so those
    static routes are matched first (Starlette matches in declaration order).
    """
    event = await ScheduleRepository.get_event_by_id(event_id)
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule event not found")
    return event

@router.put("/events/{event_id}", response_model=Dict[str, str])
async def update_schedule_event(
    event_id: str,
    payload: ScheduleEventUpdate,
    current_employee: dict = Depends(get_current_employee)
):
    """
    Update an existing schedule event. Creator, Host, Attendees, or Admin/HR can update.
    """
    user_id = str(current_employee.get("work_details", {}).get("employee_id") or current_employee.get("_id") or current_employee.get("id"))
    user_role = (current_employee.get("work_details", {}).get("system_role") or current_employee.get("role") or "Employee")
    is_admin_or_hr = user_role in ("Admin", "HR", "Sub-Admin")

    update_data = payload.model_dump(exclude_unset=True)
    if "date" in update_data and isinstance(update_data["date"], date):
        update_data["date"] = update_data["date"].isoformat()

    success = await ScheduleRepository.update_event(
        event_id=event_id,
        data=update_data,
        user_id=user_id,
        is_admin_or_hr=is_admin_or_hr
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to update event or user is unauthorized."
        )
    return {"message": "Schedule event updated successfully."}

@router.delete("/events/{event_id}", response_model=Dict[str, str])
async def delete_schedule_event(
    event_id: str,
    current_employee: dict = Depends(get_current_employee)
):
    """
    Delete a schedule event. Creator, Host, Attendees, or Admin/HR can delete.
    """
    user_id = str(current_employee.get("work_details", {}).get("employee_id") or current_employee.get("_id") or current_employee.get("id"))
    user_role = (current_employee.get("work_details", {}).get("system_role") or current_employee.get("role") or "Employee")
    is_admin_or_hr = user_role in ("Admin", "HR", "Sub-Admin")

    success = await ScheduleRepository.delete_event(
        event_id=event_id,
        user_id=user_id,
        is_admin_or_hr=is_admin_or_hr
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to delete event or user is unauthorized."
        )
    return {"message": "Schedule event deleted successfully."}

# ==========================================
# Google OAuth & Calendar Integration Routes
# ==========================================

@router.get("/google/status", response_model=Dict[str, Any])
async def get_google_auth_status(
    current_employee: dict = Depends(get_current_employee)
):
    """
    Check if current employee has linked their Google Calendar.
    Returns { "is_connected": bool, "google_email": str }
    """
    user_id = str(current_employee.get("work_details", {}).get("employee_id") or current_employee.get("_id") or current_employee.get("id"))
    auth_doc = await GoogleAuthRepository.get_auth_by_employee(user_id)
    if auth_doc and auth_doc.get("access_token"):
        return {
            "is_connected": True,
            "google_email": auth_doc.get("google_email", "")
        }
    return {
        "is_connected": False,
        "google_email": None
    }

@router.get("/google/config", response_model=Dict[str, Any])
async def google_oauth_config(
    request: Request,
    current_employee: dict = Depends(get_current_employee)
):
    """
    Non-secret OAuth diagnostics for the Schedule setup helper.
    Shows which redirect URI Google must have registered and whether keys exist.
    """
    client_id = (settings.GOOGLE_CLIENT_ID or "").strip()
    has_secret = bool((settings.GOOGLE_CLIENT_SECRET or "").strip())
    redirect_uri = GoogleCalendarService.get_redirect_uri(str(request.base_url))
    return {
        "configured": bool(client_id and has_secret),
        "client_id_hint": (client_id[:14] + "…") if client_id else "",
        "redirect_uri": redirect_uri,
        "steps": [
            "Google Cloud Console → APIs & Services → OAuth consent screen → Test users → Add each Gmail that signs in (Testing mode blocks others with 403 access_denied).",
            "Credentials → OAuth client → Authorized redirect URIs → add exactly: " + redirect_uri,
            "Enable 'Google Calendar API' in Library for the project.",
        ],
    }

@router.get("/google/auth")
@router.get("/google/login")
async def google_auth_login(
    request: Request,
    redirect: bool = Query(False, description="Set to true to directly redirect browser, or false to get JSON auth_url"),
    current_employee: dict = Depends(get_current_employee)
):
    """
    Initiate Google OAuth 2.0 flow.
    Returns JSON { "auth_url": "https://..." } for Postman/Frontend, or redirects browser if redirect=true.
    """
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google OAuth is not configured on the backend server. GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET are required."
        )

    user_id = str(current_employee.get("work_details", {}).get("employee_id") or current_employee.get("_id") or current_employee.get("id"))
    auth_url = GoogleCalendarService.generate_auth_url(employee_id=user_id, request_base_url=str(request.base_url))
    
    if redirect:
        return RedirectResponse(url=auth_url)

    return {
        "auth_url": auth_url,
        "message": "Copy and open the auth_url in your browser to complete Google Sign-in."
    }

@router.get("/google/callback")
async def google_auth_callback(
    request: Request,
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None), # Contains employee_id
    error: Optional[str] = Query(None)
):
    """
    Google OAuth Callback endpoint.
    Exchanges code for tokens, saves tokens in DB for employee, and returns confirmation HTML status page.
    """
    if error or not code or not state:
        err_msg = error or "Missing authorization code or state"
        denied_help = ""
        if str(error or "") == "access_denied":
            denied_help = """
            <p style="text-align:left; font-size:13px;">Google blocked the sign-in (403 access_denied). Usual cause: the OAuth
            consent screen is in <strong>Testing</strong> mode and this Gmail is not added under
            <strong>Test users</strong>.</p>
            <ol style="text-align:left; font-size:13px; color:#94a3b8; line-height:1.7;">
              <li>Google Cloud Console → APIs &amp; Services → OAuth consent screen → Test users → <strong>Add users</strong> (add this Gmail).</li>
              <li>Credentials → OAuth client → Authorized redirect URIs must contain the backend callback URL.</li>
              <li>Library → enable <strong>Google Calendar API</strong>.</li>
            </ol>"""
        return HTMLResponse(content=f"""
        <!DOCTYPE html>
        <html>
        <head>
          <title>Google Connection Failed</title>
          <style>
            body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #0f172a; color: #f8fafc; margin: 0; }}
            .card {{ background: #1e293b; padding: 40px; border-radius: 16px; text-align: center; max-width: 520px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border: 1px solid #334155; }}
            h2 {{ color: #ef4444; margin-top: 0; }}
            p {{ color: #94a3b8; line-height: 1.5; }}
          </style>
        </head>
        <body>
          <div class="card">
            <h2>❌ Connection Failed</h2>
            <p>Error: <strong>{err_msg}</strong></p>
            {denied_help}
            <p>Please try connecting again from HRMS.</p>
          </div>
        </body>
        </html>
        """, status_code=400)

    try:
        data = await GoogleCalendarService.exchange_code_for_tokens(code=code, request_base_url=str(request.base_url))
        tokens = data.get("tokens", {})
        google_email = data.get("google_email", "")

        await GoogleAuthRepository.save_tokens(
            employee_id=state,
            tokens=tokens,
            google_email=google_email
        )

        return HTMLResponse(content=f"""
        <!DOCTYPE html>
        <html>
        <head>
          <title>Google Calendar Connected</title>
          <style>
            body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #0f172a; color: #f8fafc; margin: 0; }}
            .card {{ background: #1e293b; padding: 40px; border-radius: 16px; text-align: center; max-width: 480px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border: 1px solid #334155; }}
            h2 {{ color: #22c55e; margin-top: 0; }}
            p {{ color: #cbd5e1; line-height: 1.5; }}
            .email {{ color: #38bdf8; font-weight: bold; }}
            .badge {{ display: inline-block; background: #064e3b; color: #34d399; padding: 6px 14px; border-radius: 20px; font-size: 14px; margin-top: 10px; font-weight: 600; }}
          </style>
        </head>
        <body>
          <div class="card">
            <h2>🎉 Google Calendar Connected!</h2>
            <p>Account <span class="email">{google_email}</span> is now successfully connected to HRMS Schedule.</p>
            <div class="badge">✓ Auto-Sync Active</div>
            <p style="margin-top: 24px; font-size: 13px; color: #64748b;">You can close this tab and return to HRMS.</p>
          </div>
          <script>
            try {{
              if (window.opener) window.opener.postMessage({{ type: "hrms-google-connected", email: "{google_email}" }}, "*");
            }} catch (e) {{}}
            setTimeout(function() {{ try {{ window.close(); }} catch (e) {{}} }}, 1800);
          </script>
        </body>
        </html>
        """)
    except Exception as e:
        print(f"[GOOGLE CALLBACK ERROR] {e}")
        return HTMLResponse(content=f"""
        <!DOCTYPE html>
        <html>
        <head>
          <title>Google Connection Error</title>
          <style>
            body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #0f172a; color: #f8fafc; margin: 0; }}
            .card {{ background: #1e293b; padding: 40px; border-radius: 16px; text-align: center; max-width: 480px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border: 1px solid #334155; }}
            h2 {{ color: #ef4444; margin-top: 0; }}
            p {{ color: #94a3b8; line-height: 1.5; }}
            code {{ background: #0f172a; padding: 4px 8px; border-radius: 6px; color: #f87171; font-size: 13px; word-break: break-all; }}
          </style>
        </head>
        <body>
          <div class="card">
            <h2>❌ Token Exchange Error</h2>
            <p>Could not complete Google authentication:</p>
            <p><code>{str(e)}</code></p>
          </div>
        </body>
        </html>
        """, status_code=500)

@router.post("/google/disconnect", response_model=Dict[str, str])
async def google_auth_disconnect(
    current_employee: dict = Depends(get_current_employee)
):
    """
    Disconnect Google Calendar for current employee.
    """
    user_id = str(current_employee.get("work_details", {}).get("employee_id") or current_employee.get("_id") or current_employee.get("id"))
    deleted = await GoogleAuthRepository.delete_tokens(user_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No Google connection found to disconnect.")
    return {"message": "Google Calendar disconnected successfully."}
