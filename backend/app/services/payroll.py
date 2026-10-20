import calendar
import re
from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Optional
from fastapi import HTTPException, status

from app.database.db import get_database
from app.repository.payroll import PayrollRepository, PayrollRunRepository
from app.repository.bonus_deduction import BonusDeductionRepository
from app.services.bonus_deduction import penalty_applies
from app.repository.employee import EmployeeRepository
from app.repository.penalty import EmployeePenaltyRepository
from app.repository.salary import SalaryRevisionRepository
from app.services.salary import IST, _today, _actor, _employee_name, _date_str, _virtual_initial

# Attendance statuses that mean the employee actually worked that day
WORKED_STATUSES = {"Present", "Late", "Logged", "Active", "On Break"}
HALF_DAY_TYPES = {"First Half", "Second Half", "Half Day"}
# Leave types that are always loss of pay and never use the paid leave quota
UNPAID_LEAVE_KEYWORDS = ("unpaid", "loss of pay", "lop", "lwp", "without pay")


def _is_unpaid_type(leave_type) -> bool:
    text = str(leave_type or "").lower()
    return any(k in text for k in UNPAID_LEAVE_KEYWORDS)


def _structure_on(timeline: list, day: str, fallback: dict) -> dict:
    """Salary structure that applies on `day`: the most recently approved revision effective by then.

    Days before the first revision take effect use its previous gross (no deductions known), so a
    mid-month joiner or increment is paid pro-rata on the old and new salary.
    """
    current = None
    for rev in timeline:  # approval order — a later approval overrides an earlier one
        if (rev.get("effective_date") or "") <= day:
            current = rev
    if current:
        return current
    if not timeline:
        return fallback
    first = min(timeline, key=lambda r: r.get("effective_date") or "")
    previous = float(first.get("previous_gross") or 0)
    if previous > 0:
        return {"_id": "previous", "gross": previous, "total_deductions": 0.0}
    return first


def _num(value, default: float = 0.0) -> float:
    """Pull the first number out of a settings value such as '₹250', '4 hrs' or '2x'."""
    if isinstance(value, (int, float)):
        return float(value)
    match = re.search(r"\d+(?:\.\d+)?", str(value or ""))
    return float(match.group()) if match else default


def _month_bounds(month: str) -> tuple:
    try:
        year, mon = int(month[:4]), int(month[5:7])
        last = calendar.monthrange(year, mon)[1]
    except (ValueError, IndexError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="month must be in YYYY-MM format")
    return date(year, mon, 1), date(year, mon, last)


def _rules(settings: dict) -> dict:
    return {
        "paid_leave_per_month": _num(settings.get("paidLeave"), 0),
        "unpaid_leave_cap": _num(settings.get("unpaidLeaveCap"), 0),
        "half_day_hours": _num(settings.get("halfDayRule"), 4),
        "standard_hours": _num(settings.get("standardHours"), 9),
        "enable_ot": bool(settings.get("enableOT", True)),
        "ot_rate": _num(settings.get("otRate"), 0),
        "double_ot_after": _num(settings.get("doubleOTAfter"), 0),
        "holiday_ot_multiplier": _num(settings.get("holidayOT"), 2),
        "carry_forward": bool(settings.get("carryForward", False)),
        "max_carry_forward": _num(settings.get("maxCarryForward"), 0),
    }


def _prev_month(month: str) -> str:
    year, mon = int(month[:4]), int(month[5:7])
    return f"{year - 1:04d}-12" if mon == 1 else f"{year:04d}-{mon - 1:02d}"


# How many months back the carry forward chain is rebuilt when older months were never approved
CARRY_FORWARD_LOOKBACK = 12


def _is_closed(rec: dict) -> bool:
    return str(rec.get("check_out") or "--").strip() not in ("", "--")


class PayrollService:

    @staticmethod
    async def _attendance_by_employee(start: str, end: str) -> dict:
        """employee_id -> date -> {worked, hours, closed, leave} merged from every attendance record of that day.

        Leave marks come from 'On Leave' status or an 'On Leave…' / 'Auto-marked leave' remark; a half-day
        leave keeps any hours the employee punched that day.
        """
        collection = get_database()["attendance"]
        result = defaultdict(dict)
        async for rec in collection.find({"date": {"$gte": start, "$lte": end}}):
            remarks = [str(r) for r in (rec.get("remarks") or [])]
            leave_remarks = [r for r in remarks if r.startswith("On Leave") or r.startswith("Auto-marked leave")]
            leave = 0.0
            if rec.get("status") == "On Leave" or leave_remarks:
                leave = 0.5 if any("Half" in r for r in leave_remarks) else 1.0
            hours = float(rec.get("net_work_seconds") or 0) / 3600
            worked = rec.get("status") in WORKED_STATUSES or hours > 0

            day = result[str(rec.get("employee_id"))].setdefault(
                rec["date"], {"worked": False, "hours": 0.0, "closed": False, "leave": 0.0}
            )
            day["leave"] = max(day["leave"], leave)
            day["worked"] = day["worked"] or worked
            if worked and (hours >= day["hours"]):
                day["hours"] = hours
                day["closed"] = _is_closed(rec)
        return result

    @staticmethod
    async def _leaves_by_employee(start: str, end: str) -> dict:
        """employee_id -> date -> {weight, unpaid} of approved leaves.

        weight is 1 for a full day and 0.5 for a half day; unpaid marks an Unpaid / LOP leave type,
        which is deducted directly instead of using the paid leave quota.
        """
        collection = get_database()["leave_requests"]
        result = defaultdict(dict)
        query = {"status": "Approved", "start_date": {"$lte": end}, "end_date": {"$gte": start}, "is_deleted": {"$ne": True}}
        async for lv in collection.find(query):
            weight = 0.5 if lv.get("day_type") in HALF_DAY_TYPES else 1.0
            unpaid = _is_unpaid_type(lv.get("type") or lv.get("leave_type"))
            try:
                d = datetime.strptime(lv["start_date"][:10], "%Y-%m-%d").date()
                last = datetime.strptime(lv["end_date"][:10], "%Y-%m-%d").date()
            except (KeyError, ValueError):
                continue
            days = result[str(lv.get("employee_id"))]
            while d <= last:
                key = d.isoformat()
                if start <= key <= end:
                    prev = days.get(key)
                    if not prev or weight > prev["weight"]:
                        days[key] = {"weight": weight, "unpaid": unpaid}
                    elif weight == prev["weight"]:
                        # Overlapping requests: a paid one wins over an unpaid one
                        prev["unpaid"] = prev["unpaid"] and unpaid
                d += timedelta(days=1)
        return result

    @staticmethod
    async def _penalties_by_employee(start: str, end: str) -> dict:
        res = await EmployeePenaltyRepository.get_all(is_deleted=False, type_filter="penalty", start_date=start, end_date=end)
        totals = defaultdict(float)
        for p in res.get("data", []):
            if not penalty_applies(p):  # same rule as the Applied badge on Bonus & Deductions
                continue
            totals[str(p.get("employee_id"))] += float(p.get("price") or 0)
        return totals

    @staticmethod
    def _manual_amount(entries: list, kind: str, emp_id: str, department: str) -> float:
        total = 0.0
        for e in entries:
            if e.get("type") != kind or e.get("status") != "approved":  # only Approved entries are applied
                continue
            scope = e.get("scope")
            if (scope == "company"
                    or (scope == "department" and e.get("department") == department)
                    or (scope == "individual" and e.get("employee_id") == emp_id)):
                total += float(e.get("amount") or 0)
        return total

    @staticmethod
    async def _carry_forward_in(month: str, rules: dict, earliest_joining: str, depth: int) -> dict:
        """employee_id -> unused paid leave carried into `month` from the previous month.

        An approved / locked run of the previous month is trusted as stored; otherwise that month is
        recomputed (which pulls its own carry from the month before, up to the lookback limit).
        """
        if not rules["carry_forward"] or rules["max_carry_forward"] <= 0 or depth >= CARRY_FORWARD_LOOKBACK:
            return {}
        prev = _prev_month(month)
        if not earliest_joining or f"{prev}-31" < earliest_joining:
            return {}
        run = await PayrollRunRepository.get_by_month(prev)
        rows = (run or {}).get("rows") or []
        if not (run and run.get("status") in ("approved", "locked") and rows
                and all("carry_forward_out" in r for r in rows)):
            rows = (await PayrollService.compute(prev, _depth=depth + 1))["rows"]
        return {r["id"]: float(r.get("carry_forward_out") or 0) for r in rows}

    @staticmethod
    async def compute(month: str, _depth: int = 0) -> dict:
        first, last = _month_bounds(month)
        start, end = first.isoformat(), last.isoformat()
        today = _today()
        cutoff = min(today, end)  # days after today are not counted as absent yet

        settings = await PayrollRepository.get_settings()
        rules = _rules(settings)
        holidays = {h.get("date") for h in settings.get("holidays", []) if start <= str(h.get("date", "")) <= end}
        all_days = [(first + timedelta(days=i)).isoformat() for i in range((last - first).days + 1)]
        working_days = [d for d in all_days if d not in holidays]
        per_day_divisor = len(working_days)

        employees = await EmployeeRepository.get_payroll_employees()
        earliest_joining = min((_date_str((e.get("work_details") or {}).get("joining_date")) or start
                                for e in employees), default="")
        carry_in = await PayrollService._carry_forward_in(month, rules, earliest_joining, _depth)
        # Every approved revision effective by month end, so a mid-month revision is paid pro-rata per day
        timelines = await SalaryRevisionRepository.list_approved_timeline(end)
        attendance = await PayrollService._attendance_by_employee(start, end)
        leaves = await PayrollService._leaves_by_employee(start, end)
        penalties = await PayrollService._penalties_by_employee(start, end)
        manual_entries = await BonusDeductionRepository.list_between(start, end)
        from app.services.overtime import OvertimeService, ot_pay_for
        overtime = await OvertimeService.approved_by_employee(start, end) if rules["enable_ot"] else {}
        all_holidays = {h.get("date") for h in settings.get("holidays", []) if h.get("date")}

        rows = []
        for emp in employees:
            emp_id = emp["_id"]
            work = emp.get("work_details") or {}
            joining = _date_str(work.get("joining_date")) or start
            exit_date = _date_str(work.get("last_working_date"))
            if joining > end or (exit_date and exit_date < start):
                continue
            timeline = timelines.get(emp_id, [])
            fallback = _virtual_initial(emp)

            emp_att = attendance.get(emp_id, {})
            emp_leave = leaves.get(emp_id, {})
            present = absent = leave_days = ot_hours = ot_pay = 0.0
            not_joined = after_exit = 0
            half_day_converted = 0
            half_day_details = []
            half_h = rules["half_day_hours"]
            # Month salary and structure deductions are built day by day from the structure in effect that day
            gross = earned = structure_deductions = 0.0
            not_due_amount = 0.0  # salary for working days that have not arrived yet (current month)
            day_rate = {}       # date -> (gross per day, structure deductions per day)
            leave_log = []      # (date, leave days, forced unpaid) in date order for the paid quota
            salary_changes = []
            prev_structure_id = None

            for d in working_days:
                structure = _structure_on(timeline, d, fallback)
                rate = (float(structure.get("gross") or 0) / per_day_divisor,
                        float(structure.get("total_deductions") or 0) / per_day_divisor)
                gross += rate[0]
                day_rate[d] = rate

                if d < joining:
                    not_joined += 1
                    continue
                if exit_date and d > exit_date:
                    after_exit += 1
                    continue
                sid = structure.get("_id")
                if prev_structure_id is not None and sid != prev_structure_id:
                    salary_changes.append({"date": d, "gross": float(structure.get("gross") or 0)})
                prev_structure_id = sid
                day = emp_att.get(d) or {"worked": False, "hours": 0.0, "closed": False, "leave": 0.0}
                # Approved leave requests and attendance leave marks both count
                request = emp_leave.get(d) or {"weight": 0.0, "unpaid": False}
                leave_w = max(day["leave"], request["weight"])
                # Unpaid / LOP leave type only when the request is what marks the day as leave
                forced_unpaid = request["unpaid"] and request["weight"] >= day["leave"]
                elapsed = d <= cutoff
                in_progress = d == today and not day["closed"]
                worked_part = day_leave = not_due = 0.0

                if leave_w >= 1:
                    day_leave = 1.0
                elif leave_w > 0:
                    # Half-day leave: the other half must be worked for the Half Day Rule hours
                    worked_hours = round(day["hours"] if day["worked"] else 0.0, 2)  # no punch-in -> 0 hrs
                    if not elapsed:
                        day_leave = not_due = 0.5
                        result = "Upcoming"
                    elif day["worked"] and (day["hours"] >= half_h or in_progress):
                        worked_part = day_leave = 0.5
                        result = "In progress" if in_progress and day["hours"] < half_h else "Half day"
                    else:
                        day_leave = 1.0
                        half_day_converted += 1
                        result = "Full day leave"
                    half_day_details.append({"date": d, "hours": worked_hours, "required": half_h, "result": result})
                elif day["worked"]:
                    if day["closed"] and day["hours"] < half_h:
                        worked_part = 0.5
                        absent += 0.5
                    else:
                        worked_part = 1.0
                elif elapsed:
                    absent += 1
                else:
                    not_due = 1.0

                present += worked_part
                earned += rate[0] * worked_part
                structure_deductions += rate[1] * worked_part
                not_due_amount += rate[0] * not_due
                if day_leave:
                    leave_days += day_leave
                    leave_log.append((d, day_leave, forced_unpaid))

            # Overtime: only Admin / HR approved requests, paid with the Overtime rules from Payroll Settings
            ot_details = []
            for req in sorted(overtime.get(emp_id, []), key=lambda r: r["date"]):
                if req["date"] < joining or (exit_date and req["date"] > exit_date):
                    continue
                pay = ot_pay_for(req["hours"], req["date"], rules, all_holidays)
                ot_hours += float(req["hours"])
                ot_pay += pay["amount"]
                ot_details.append({"date": req["date"], "hours": float(req["hours"]), **pay})

            # Leave policy from Payroll Settings: the paid quota covers leave in date order (Unpaid / LOP
            # leave types never use it), then the unpaid cap; anything beyond is excess.
            # With Carry Forward on, last month's unused paid leave is added to this month's quota.
            carry_forward_in = carry_in.get(emp_id, 0.0)
            quota = rules["paid_leave_per_month"] + carry_forward_in
            paid_leave = 0.0
            for d, amount, forced_unpaid in leave_log:
                if forced_unpaid or quota <= 0:
                    continue
                paid = min(amount, quota)
                quota -= paid
                paid_leave += paid
                earned += day_rate[d][0] * paid
                structure_deductions += day_rate[d][1] * paid
            unpaid_total = leave_days - paid_leave
            carry_forward_out = min(rules["max_carry_forward"], max(0.0, quota)) if rules["carry_forward"] else 0.0
            unpaid_leave = min(unpaid_total, rules["unpaid_leave_cap"])
            excess_leave = unpaid_total - unpaid_leave
            # Attendance-based pay: only present days and paid leave are payable
            payable_days = present + paid_leave
            lop_days = len(working_days) - payable_days
            per_day = gross / len(working_days) if working_days else 0
            gross = round(gross, 2)
            earned = round(min(gross, earned), 2)
            # Upcoming days are not a deduction yet — they are kept apart so the month's totals stay real
            not_due_amount = round(min(gross - earned, not_due_amount), 2)
            lop_amount = round(gross - earned - not_due_amount, 2)
            # Where the unpaid days come from (paid leave is never part of it)
            upcoming_days = max(0.0, lop_days - absent - unpaid_total - not_joined - after_exit)

            department = work.get("department") or ""
            penalty_deductions = penalties.get(emp_id, 0.0)
            other_deductions = PayrollService._manual_amount(manual_entries, "Deduction", emp_id, department)
            bonus = PayrollService._manual_amount(manual_entries, "Bonus", emp_id, department)
            if gross <= 0:
                # No salary set: attendance is still shown but every amount stays ₹0
                ot_pay = bonus = structure_deductions = penalty_deductions = other_deductions = not_due_amount = 0.0
            structure_deductions = round(structure_deductions, 2)
            deduction = lop_amount + structure_deductions + penalty_deductions + other_deductions
            earnings = gross - not_due_amount + ot_pay + bonus

            warnings = [] if gross > 0 else ["Salary not set — add it in Salary Structure"]
            if excess_leave > 0:
                warnings.append(f"{excess_leave:g} leave day(s) beyond the unpaid leave cap of {rules['unpaid_leave_cap']:g} — deducted from salary")
            if salary_changes:
                changes = ", ".join(f"₹{c['gross']:,.0f} from {c['date']}" for c in salary_changes)
                warnings.append(f"Salary revised this month ({changes}) — paid pro-rata per day")
            if after_exit:
                warnings.append(f"Last working day {exit_date} — {after_exit} later working day(s) not paid")
            if half_day_converted:
                warnings.append(f"{half_day_converted} half-day leave(s) counted as full day — less than {half_h:g} hrs worked")
            if gross > 0 and deduction > earnings:
                warnings.append("Deductions exceed earnings — net salary capped at ₹0")

            rows.append({
                "id": emp_id,
                "employee": _employee_name(emp),
                "empId": work.get("employee_id") or emp.get("employee_id") or "",
                "department": department,
                "designation": work.get("designation") or "",
                "working": len(working_days),
                "present": present,
                "payable_days": payable_days,
                "per_day": round(per_day, 2),
                "absent": absent,
                "leave": leave_days,
                "paid_leave": paid_leave,
                "carry_forward_in": carry_forward_in,
                "carry_forward_out": carry_forward_out,
                "unpaid_leave": unpaid_leave,
                "excess_leave": excess_leave,
                "half_day_converted": half_day_converted,
                "half_day_details": half_day_details,
                "not_joined_days": not_joined,
                "exit_days": after_exit,
                "salary_changes": salary_changes,
                "lop_days": lop_days,
                "upcoming_days": upcoming_days,
                "otHrs": round(ot_hours, 2),
                "gross": gross,
                "ot_pay": round(ot_pay, 2),
                "ot_details": ot_details,
                "bonus": bonus,
                "lop_amount": lop_amount,
                "not_due_amount": not_due_amount,
                "structure_deductions": structure_deductions,
                "penalty_deductions": penalty_deductions,
                "other_deductions": other_deductions,
                "deduction": round(deduction, 2),
                "netSalary": round(max(0.0, earnings - deduction), 2),
                "warnings": warnings,
            })

        rows.sort(key=lambda r: r["employee"].lower())
        return {
            "month": month,
            "rows": rows,
            "summary": {
                "company_expense": round(sum(r["gross"] - r["lop_amount"] - r.get("not_due_amount", 0) + r["ot_pay"] + r["bonus"] for r in rows), 2),
                "eligible": sum(1 for r in rows if r["gross"] > 0),
                "employees": len(rows),
                "total_bonus": round(sum(r["bonus"] for r in rows), 2),
                "total_deduction": round(sum(r["deduction"] for r in rows), 2),
                "total_not_due": round(sum(r.get("not_due_amount", 0) for r in rows), 2),
                "upcoming_days": max((r.get("upcoming_days", 0) for r in rows), default=0),
                "total_net": round(sum(r["netSalary"] for r in rows), 2),
            },
            "calendar": {
                "total_days": len(all_days),
                "holidays": len(holidays),
                "working_days": len(working_days),
                "counted_until": cutoff,
            },
            "rules": rules,
        }

    @staticmethod
    async def get_run(month: str) -> dict:
        _month_bounds(month)
        run = await PayrollRunRepository.get_by_month(month)
        if run:
            return run
        return {**await PayrollService.compute(month), "status": "not_generated"}

    @staticmethod
    async def generate(month: str, user: dict) -> dict:
        run = await PayrollRunRepository.get_by_month(month)
        if run and run.get("status") == "locked":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payroll is locked for this month")
        data = await PayrollService.compute(month)
        PayrollService._carry_review(run, data["rows"])
        return await PayrollRunRepository.upsert(month, {
            **data,
            "status": "generated",
            "generated_by": _actor(user),
            "generated_at": datetime.now(IST).isoformat(),
            "approved_by": None,
            "approved_at": None,
            "payslips_sent_at": None,
        })

    @staticmethod
    def _carry_review(previous_run: Optional[dict], rows: list):
        """Keep each employee's manual review across a re-generate.

        On Hold always stays; Verified stays only while the net salary is unchanged, otherwise the row
        goes back to Pending so the new amount gets checked again.
        """
        old = {r.get("id"): r for r in (previous_run or {}).get("rows", [])}
        for row in rows:
            prev = old.get(row["id"]) or {}
            review = prev.get("review_status") or "pending"
            if review == "verified" and round(float(prev.get("netSalary") or 0), 2) != row["netSalary"]:
                review = "pending"
            row["review_status"] = review
            if review != "pending":
                row["review_note"] = prev.get("review_note")
                row["reviewed_by"] = prev.get("reviewed_by")
                row["reviewed_at"] = prev.get("reviewed_at")

    @staticmethod
    async def set_row_status(month: str, employee_id: str, review: str, note: Optional[str], user: dict) -> dict:
        run = await PayrollRunRepository.get_by_month(month)
        if not run or run.get("status") not in ("generated", "approved"):
            detail = "Payroll is locked for this month" if run and run.get("status") == "locked"                 else "Generate payroll before reviewing employees"
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)
        updated = await PayrollRunRepository.update_row(month, employee_id, {
            "review_status": review,
            "review_note": (note or "").strip() or None,
            "reviewed_by": _actor(user) if review != "pending" else None,
            "reviewed_at": datetime.now(IST).isoformat() if review != "pending" else None,
        })
        if not updated:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee is not in this payroll run")
        return updated

    @staticmethod
    async def _transition(month: str, expected: str, new_status: str, user: dict, prefix: str) -> dict:
        run = await PayrollRunRepository.get_by_month(month)
        if not run or run.get("status") != expected:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail=f"Payroll must be {expected.replace('_', ' ')} first")
        return await PayrollRunRepository.upsert(month, {
            "status": new_status,
            f"{prefix}_by": _actor(user),
            f"{prefix}_at": datetime.now(IST).isoformat(),
        })

    @staticmethod
    async def approve(month: str, user: dict) -> dict:
        run = await PayrollRunRepository.get_by_month(month)
        if not run or run.get("status") != "generated":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payroll must be generated first")
        # Approving the run verifies every employee at once; rows deliberately put On Hold stay on hold
        actor, now = _actor(user), datetime.now(IST).isoformat()
        rows = run.get("rows", [])
        for row in rows:
            if row.get("review_status") != "on_hold":
                row.update({"review_status": "verified", "reviewed_by": actor, "reviewed_at": now})
        return await PayrollRunRepository.upsert(month, {
            "rows": rows,
            "status": "approved",
            "approved_by": actor,
            "approved_at": now,
        })

    @staticmethod
    async def lock(month: str, user: dict) -> dict:
        return await PayrollService._transition(month, "approved", "locked", user, "locked")

    @staticmethod
    async def send_payslips(month: str, user: dict) -> dict:
        run = await PayrollRunRepository.get_by_month(month)
        if not run or run.get("status") != "locked":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Lock payroll before sending payslips")

        from app.repository.notification import NotificationRepository
        from app.services.payslip import PayslipService
        # Payslips are saved first so every notified employee can open theirs right away
        published = await PayslipService.publish(run, user)
        label = datetime.strptime(month, "%Y-%m").strftime("%B %Y")
        sent = 0
        for row in run.get("rows", []):
            if not row.get("gross") or row.get("review_status") == "on_hold":
                continue
            try:
                await NotificationRepository.create_notification({
                    "recipient_id": row["id"],
                    "title": f"Payslip for {label}",
                    "message": f"Your salary for {label} has been processed. Net pay: ₹{row['netSalary']:,.0f}.",
                    "type": "payroll",
                    "action_url": "/payroll/payslips",
                    "is_read": False,
                })
                sent += 1
            except Exception as e:
                print(f"[PAYSLIP NOTIFICATION ERROR] {row.get('employee')}: {e}")

        updated = await PayrollRunRepository.upsert(month, {
            "payslips_sent_at": datetime.now(IST).isoformat(),
            "payslips_sent_by": _actor(user),
        })
        return {**updated, "sent": sent, "published": published}
