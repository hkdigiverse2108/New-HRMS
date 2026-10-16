"""Overtime requests: employees request OT for a day, Admin / HR approve it, and only approved
hours are paid in payroll using the Overtime rules from Payroll Settings."""
from datetime import datetime
from typing import Optional

from fastapi import HTTPException, status

from app.repository.overtime import OvertimeRepository
from app.repository.payroll import PayrollRepository
from app.services.salary import IST, _today, _actor, _employee_name


def is_ot_holiday(day: str, holidays: set) -> bool:
    """Company holiday from Payroll Settings, or a Sunday."""
    try:
        return day in holidays or datetime.strptime(day, "%Y-%m-%d").weekday() == 6
    except ValueError:
        return False


def ot_pay_for(hours: float, day: str, rules: dict, holidays: set) -> dict:
    """Pay for one day's approved OT.

    Holiday / Sunday: every hour at rate x Holiday OT multiplier.
    Working day: hours up to 'Double OT after' at the OT rate, hours beyond it at 2x.
    """
    rate = float(rules.get("ot_rate") or 0)
    hours = max(0.0, float(hours or 0))
    if is_ot_holiday(day, holidays):
        mult = float(rules.get("holiday_ot_multiplier") or 1)
        return {"normal_hours": 0.0, "double_hours": 0.0, "holiday_hours": hours,
                "amount": round(hours * rate * mult, 2), "holiday": True}
    double_after = float(rules.get("double_ot_after") or 0)
    normal = min(hours, double_after) if double_after > 0 else hours
    double = hours - normal
    return {"normal_hours": normal, "double_hours": double, "holiday_hours": 0.0,
            "amount": round(normal * rate + double * rate * 2, 2), "holiday": False}


async def _rules_and_holidays() -> tuple:
    from app.services.payroll import _rules  # imported here: payroll imports this module
    settings = await PayrollRepository.get_settings()
    holidays = {h.get("date") for h in settings.get("holidays", []) if h.get("date")}
    return _rules(settings), holidays


def _role(user: dict) -> str:
    work = user.get("work_details") or {}
    return str(work.get("system_role") or user.get("role") or "Employee").strip()


def can_approve_overtime(user: dict) -> bool:
    """Admin, Sub-Admin and HR approve overtime."""
    work = user.get("work_details") or {}
    role = _role(user).lower()
    return role in ("admin", "superadmin", "sub-admin", "subadmin", "hr") or str(work.get("department") or "").strip().lower() == "hr"


def _is_admin(user: dict) -> bool:
    return _role(user).lower() in ("admin", "superadmin", "sub-admin", "subadmin")


class OvertimeService:

    @staticmethod
    async def worked_hours(employee_id: str, day: str) -> dict:
        """Hours worked that day from attendance, the most OT that can be requested, and why a
        request is not allowed (company holiday, approved leave, standard hours not complete)."""
        from app.repository.attendance import AttendanceRepository
        from app.repository.leave import LeaveRepository
        rules, holidays = await _rules_and_holidays()
        record = await AttendanceRepository.get_by_employee_and_date(employee_id, day) or {}
        seconds = record.get("net_work_seconds") or record.get("gross_seconds") or 0
        worked = round(float(seconds) / 3600, 2)
        standard = float(rules.get("standard_hours") or 0)
        is_sunday = is_ot_holiday(day, set())

        leave = await LeaveRepository.get_approved_leave_for_date(employee_id, day)
        on_leave = bool(leave) or str(record.get("status") or "") == "On Leave"
        # Sunday (not marked off in Payroll Settings): the whole day is overtime
        max_hours = worked if is_sunday else max(0.0, worked - standard)

        blocked = None
        if day in holidays:
            blocked = "This day is a company holiday / leave day in Payroll Settings — overtime cannot be requested."
        elif on_leave:
            blocked = "You are on approved leave this day — overtime cannot be requested."
        elif not record or worked <= 0:
            blocked = "No completed attendance for this day. Punch out first, then request overtime."
        elif not is_sunday and worked < standard:
            blocked = f"Complete your {standard:g} standard hours before requesting overtime (worked {worked:g} hrs)."
        elif max_hours <= 0:
            blocked = "No extra hours beyond the standard day to request as overtime."

        return {
            "date": day,
            "worked_hours": worked,
            "standard_hours": standard,
            "suggested_hours": round(max_hours, 2),
            "max_hours": round(max_hours, 2),
            "has_attendance": bool(record),
            "is_holiday": day in holidays,
            "is_sunday": is_sunday,
            "on_leave": on_leave,
            "blocked_reason": blocked,
        }

    @staticmethod
    async def _with_pay(items: list) -> list:
        """Estimated OT pay for each request with the current Payroll Settings."""
        rules, holidays = await _rules_and_holidays()
        for item in items:
            item["pay"] = ot_pay_for(item.get("hours", 0), item.get("date", ""), rules, holidays)
        return items

    @staticmethod
    async def create(user: dict, payload) -> dict:
        if _is_admin(user):  # Admin / Sub-Admin only approve; HR and employees request
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin cannot request overtime")
        rules, _ = await _rules_and_holidays()
        if not rules.get("enable_ot"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Overtime is turned off in Payroll Settings")
        if payload.date > _today():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Overtime can only be requested for today or a past day")
        employee_id = str(user.get("_id", ""))
        if await OvertimeRepository.find_active_for_day(employee_id, payload.date):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="You already have a pending or approved overtime request for this day")

        work = user.get("work_details") or {}
        attendance = await OvertimeService.worked_hours(employee_id, payload.date)
        if attendance["blocked_reason"]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=attendance["blocked_reason"])
        if payload.hours > attendance["max_hours"] + 0.01:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail=f"You can request at most {attendance['max_hours']:g} hrs overtime for this day")
        doc = await OvertimeRepository.create({
            "employee_id": employee_id,
            "employee_name": _employee_name(user),
            "emp_code": work.get("employee_id") or "",
            "department": work.get("department") or "",
            "date": payload.date,
            "hours": round(float(payload.hours), 2),
            "requested_hours": round(float(payload.hours), 2),
            "reason": payload.reason.strip(),
            "worked_hours": attendance["worked_hours"],
            "standard_hours": attendance["standard_hours"],
            "status": "Pending",
            "created_at": datetime.now(IST).isoformat(),
        })
        await OvertimeService._notify_approvers(user, doc)
        return (await OvertimeService._with_pay([doc]))[0]

    @staticmethod
    async def _notify_approvers(user: dict, doc: dict):
        try:
            from app.database.db import get_database
            from app.repository.notification import NotificationRepository
            approvers = await get_database()["employees"].find({
                "work_details.is_delete": {"$ne": True},
                "$or": [
                    {"work_details.system_role": {"$in": ["Admin", "HR", "superadmin", "Sub-Admin"]}},
                    {"role": {"$in": ["Admin", "HR", "superadmin"]}},
                    {"work_details.department": {"$regex": "^hr$", "$options": "i"}},
                ],
            }, {"_id": 1}).to_list(length=50)
            for a in approvers:
                if str(a["_id"]) == doc["employee_id"]:
                    continue
                await NotificationRepository.create_notification({
                    "recipient_id": str(a["_id"]),
                    "title": f"Overtime Request: {doc['employee_name']}",
                    "message": f"{doc['employee_name']} requested {doc['hours']:g} hrs overtime for {doc['date']}.",
                    "type": "overtime",
                    "action_url": "/employees/overtime",
                    "sender_id": doc["employee_id"],
                    "is_read": False,
                })
        except Exception as e:
            print(f"Error creating overtime notification: {e}")

    @staticmethod
    async def list_for(user: dict, scope: str, status_filter: Optional[str], month: Optional[str]) -> dict:
        approver = can_approve_overtime(user)
        start = end = None
        if month:
            start, end = f"{month}-01", f"{month}-31"
        employee_id = None if (scope == "all" and approver) else str(user.get("_id", ""))
        items = await OvertimeRepository.list(employee_id, status_filter or None, start, end)
        rules, _ = await _rules_and_holidays()
        return {
            "can_approve": approver,
            "rules": {k: rules[k] for k in ("enable_ot", "standard_hours", "ot_rate", "double_ot_after", "holiday_ot_multiplier")},
            "items": await OvertimeService._with_pay(items),
        }

    @staticmethod
    async def decide(request_id: str, payload, user: dict) -> dict:
        if not can_approve_overtime(user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Admin or HR can approve overtime")
        req = await OvertimeRepository.get_by_id(request_id)
        if not req:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Overtime request not found")
        if req["status"] != "Pending":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"This request is already {req['status'].lower()}")
        if req["employee_id"] == str(user.get("_id", "")) and not _is_admin(user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You cannot approve your own overtime. An Admin must approve it.")
        await OvertimeService._ensure_month_open(req["date"][:7])

        change = {}
        if payload.status == "Approved" and payload.hours is not None:
            change["hours"] = round(float(payload.hours), 2)  # approver's hours are what payroll pays
        updated = await OvertimeRepository.update(request_id, {
            **change,
            "status": payload.status,
            "decision_note": (payload.note or "").strip() or None,
            "decided_by": _actor(user),
            "decided_at": datetime.now(IST).isoformat(),
        })
        try:
            from app.repository.notification import NotificationRepository
            note = f" Note: {payload.note}" if payload.note else ""
            await NotificationRepository.create_notification({
                "recipient_id": req["employee_id"],
                "title": f"Overtime {payload.status}",
                "message": (f"Your overtime for {req['date']} was {payload.status.lower()} by {_employee_name(user)}"
                            + (f" for {updated['hours']:g} hrs (requested {req['hours']:g} hrs)"
                               if payload.status == "Approved" and updated["hours"] != req["hours"]
                               else f" ({req['hours']:g} hrs)")
                            + f".{note}"),
                "type": "overtime",
                "action_url": "/employees/overtime",
                "sender_id": str(user.get("_id", "")),
                "is_read": False,
            })
        except Exception as e:
            print(f"Error creating overtime decision notification: {e}")
        return (await OvertimeService._with_pay([updated]))[0]

    @staticmethod
    async def edit(request_id: str, payload, user: dict) -> dict:
        """Only Admin / HR edit a request; HR cannot edit their own (an Admin must)."""
        if not can_approve_overtime(user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Admin or HR can edit overtime requests")
        req = await OvertimeRepository.get_by_id(request_id)
        if not req:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Overtime request not found")
        if req["employee_id"] == str(user.get("_id", "")) and not _is_admin(user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You cannot edit your own overtime request. An Admin must do it.")
        await OvertimeService._ensure_month_open(req["date"][:7])

        change = {}
        if payload.hours is not None:
            change["hours"] = round(float(payload.hours), 2)
        if payload.reason is not None:
            change["reason"] = payload.reason.strip()
        if not change:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nothing to update")
        updated = await OvertimeRepository.update(request_id, {
            **change,
            "edited_by": _actor(user),
            "edited_at": datetime.now(IST).isoformat(),
        })
        if "hours" in change and change["hours"] != req["hours"]:
            try:
                from app.repository.notification import NotificationRepository
                await NotificationRepository.create_notification({
                    "recipient_id": req["employee_id"],
                    "title": "Overtime Updated",
                    "message": (f"{_employee_name(user)} changed your overtime for {req['date']} "
                                f"from {req['hours']:g} hrs to {change['hours']:g} hrs."),
                    "type": "overtime",
                    "action_url": "/employees/overtime",
                    "sender_id": str(user.get("_id", "")),
                    "is_read": False,
                })
            except Exception as e:
                print(f"Error creating overtime edit notification: {e}")
        return (await OvertimeService._with_pay([updated]))[0]

    @staticmethod
    async def cancel(request_id: str, user: dict) -> dict:
        req = await OvertimeRepository.get_by_id(request_id)
        if not req:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Overtime request not found")
        if req["employee_id"] != str(user.get("_id", "")):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only cancel your own request")
        if req["status"] != "Pending":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only a pending request can be cancelled")
        await OvertimeRepository.delete(request_id)
        return {"deleted": True}

    @staticmethod
    async def _ensure_month_open(month: str):
        from app.repository.payroll import PayrollRunRepository
        run = await PayrollRunRepository.get_by_month(month)
        if run and run.get("status") == "locked":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Payroll for this month is locked — overtime can no longer be changed")

    @staticmethod
    async def approved_by_employee(start: str, end: str) -> dict:
        """employee_id -> [approved requests in the period] for payroll."""
        result: dict = {}
        for r in await OvertimeRepository.list(status="Approved", start=start, end=end):
            result.setdefault(r["employee_id"], []).append(r)
        return result
