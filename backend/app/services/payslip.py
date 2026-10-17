import calendar
import re
from datetime import datetime
from typing import Optional

from app.repository.bonus_deduction import BonusDeductionRepository
from app.repository.employee import EmployeeRepository
from app.repository.payslip import PayslipRepository
from app.repository.salary import SalaryRevisionRepository
from app.services.salary import IST, _actor, _date_str, _virtual_initial


def _scaled(components: list, total: float) -> list:
    """Structure components scaled so they add up to `total` (pro-rata / LOP-adjusted amount)."""
    base = sum(float(c.get("amount") or 0) for c in components)
    if not components or base <= 0 or total <= 0:
        return []
    lines = [{"name": c.get("name") or "Component", "amount": round(float(c.get("amount") or 0) * total / base, 2)}
             for c in components if float(c.get("amount") or 0) > 0]
    # Rounding difference goes to the largest line so the lines match the total exactly
    diff = round(total - sum(l["amount"] for l in lines), 2)
    if lines and diff:
        biggest = max(lines, key=lambda l: l["amount"])
        biggest["amount"] = round(biggest["amount"] + diff, 2)
    return lines


def _manual_lines(entries: list, emp_id: str, department: str) -> list:
    """Approved manual deductions that apply to this employee, one line per category."""
    totals = {}
    for e in entries:
        if e.get("type") != "Deduction" or e.get("status") != "approved":
            continue
        scope = e.get("scope")
        if (scope == "company"
                or (scope == "department" and e.get("department") == department)
                or (scope == "individual" and e.get("employee_id") == emp_id)):
            name = e.get("category") or "Other deduction"
            totals[name] = totals.get(name, 0.0) + float(e.get("amount") or 0)
    return [{"name": k, "amount": round(v, 2)} for k, v in totals.items()]


# Fixed payslip layout: every line is always shown (₹0 when it does not apply).
# Salary structure components are matched to a line by keywords in their name.
EARNING_LINES = [
    ("Basic Salary", ("basic", "base", "gross")),
    ("HRA", ("hra", "house rent")),
    ("Special Allowance", ("special",)),
    ("Medical Allowance", ("medical",)),
    ("Travel Allowance", ("travel", "conveyance", "transport")),
    ("Internet Allowance", ("internet", "broadband", "mobile", "phone")),
    ("Food Allowance", ("food", "meal")),
    ("Performance Allowance", ("performance", "incentive")),
    ("Other Allowance", ()),
]
STRUCTURE_DEDUCTION_LINES = [
    ("Professional Tax", ("professional tax", "pt")),
    ("TDS", ("tds", "income tax")),
    ("Provident Fund", ("provident", "pf", "epf")),
    ("ESIC", ("esic", "esi")),
    ("Health Insurance", ("health", "insurance", "mediclaim")),
]
DEDUCTION_LINES = [name for name, _ in STRUCTURE_DEDUCTION_LINES] + [
    "Loan Recovery", "Advance Salary Recovery", "Penalty", "Late Coming Deduction", "Leave Deduction", "Other Deduction",
]
# Bonus & Deductions categories -> payslip line
MANUAL_CATEGORY_LINES = {
    "loan emi": "Loan Recovery",
    "advance recovery": "Advance Salary Recovery",
    "late coming": "Late Coming Deduction",
}


def _match_line(name: str, lines: list, fallback: Optional[str]) -> Optional[str]:
    words = set(re.findall(r"[a-z]+", name.lower()))
    text = " ".join(re.findall(r"[a-z]+", name.lower()))
    for line, keys in lines:
        for k in keys:
            if (" " in k and k in text) or k in words:
                return line
    return fallback


def _fixed_lines(order: list, amounts: dict) -> list:
    return [{"name": name, "amount": round(amounts.get(name, 0.0), 2)} for name in order]


async def _penalties_split(start: str, end: str) -> dict:
    """employee_id -> {"late": amount, "other": amount} for penalties applied to payroll this month."""
    from collections import defaultdict
    from app.database.db import get_database
    from app.repository.penalty import EmployeePenaltyRepository
    from app.services.bonus_deduction import penalty_applies

    late_ids = set()
    async for t in get_database()["penalty_types"].find({}, {"name": 1, "system_key": 1}):
        # The automatic late type can be renamed, so match it by system_key too
        if t.get("system_key") == "late_punch_in" or "late" in str(t.get("name", "")).lower():
            late_ids.add(str(t["_id"]))
    res = await EmployeePenaltyRepository.get_all(is_deleted=False, type_filter="penalty", start_date=start, end_date=end)
    totals = defaultdict(lambda: {"late": 0.0, "other": 0.0})
    for p in res.get("data", []):
        if not penalty_applies(p):
            continue
        # Records of a deleted type only have the saved name left to go by
        is_late = str(p.get("penalty_type_id")) in late_ids or "late" in str(p.get("penalty_type_name") or "").lower()
        kind = "late" if is_late else "other"
        totals[str(p.get("employee_id"))][kind] += float(p.get("price") or 0)
    return totals


class PayslipService:

    @staticmethod
    async def publish(run: dict, user: dict) -> int:
        """Create (or refresh) a payslip for every paid employee of a locked payroll run."""
        month = run["month"]
        year, mon = int(month[:4]), int(month[5:7])
        start = f"{month}-01"
        end = f"{month}-{calendar.monthrange(year, mon)[1]:02d}"

        employees = {e["_id"]: e for e in await EmployeeRepository.get_payroll_employees()}
        structures = await SalaryRevisionRepository.list_current_approved(end)
        manual_entries = await BonusDeductionRepository.list_between(start, end)
        penalties = await _penalties_split(start, end)
        actor, now = _actor(user), datetime.now(IST).isoformat()

        count = 0
        for row in run.get("rows", []):
            if not row.get("gross") or row.get("review_status") == "on_hold":
                continue
            emp = employees.get(row["id"]) or {"_id": row["id"]}
            work = emp.get("work_details") or {}
            bank = emp.get("bank_and_docs") or {}
            structure = structures.get(row["id"]) or _virtual_initial(emp)
            components = structure.get("components") or []

            # Earnings: structure components on the fixed lines, then overtime and bonus
            earn = {}
            scaled = _scaled([c for c in components if c.get("type") == "earnings"], float(row["gross"])) \
                or [{"name": "Basic Salary", "amount": float(row["gross"])}]
            for c in scaled:
                line = _match_line(c["name"], EARNING_LINES, "Other Allowance")
                earn[line] = earn.get(line, 0.0) + c["amount"]
            earnings = _fixed_lines([name for name, _ in EARNING_LINES], earn)
            earnings.append({"name": f"Overtime ({float(row.get('otHrs') or 0):g} hrs)", "amount": round(float(row.get("ot_pay") or 0), 2)})
            earnings.append({"name": "Bonus", "amount": round(float(row.get("bonus") or 0), 2)})

            # Deductions: statutory lines from the structure, then recoveries, penalties and leave
            ded = {}
            for c in _scaled([c for c in components if c.get("type") == "deductions"],
                             float(row.get("structure_deductions") or 0)):
                line = _match_line(c["name"], STRUCTURE_DEDUCTION_LINES, "Other Deduction")
                ded[line] = ded.get(line, 0.0) + c["amount"]
            ded["Leave Deduction"] = float(row.get("lop_amount") or 0) + float(row.get("not_due_amount") or 0)

            penalty_total = float(row.get("penalty_deductions") or 0)
            split = penalties.get(row["id"]) or {"late": 0.0, "other": 0.0}
            if round(split["late"] + split["other"], 2) == round(penalty_total, 2):
                ded["Late Coming Deduction"] = split["late"]
                ded["Penalty"] = split["other"]
            else:  # penalties changed after the run was generated — keep the run's total
                ded["Penalty"] = penalty_total

            manual = _manual_lines(manual_entries, row["id"], row.get("department") or "")
            if round(sum(l["amount"] for l in manual), 2) == round(float(row.get("other_deductions") or 0), 2):
                for l in manual:
                    line = MANUAL_CATEGORY_LINES.get(l["name"].strip().lower(), "Other Deduction")
                    ded[line] = ded.get(line, 0.0) + l["amount"]
            else:  # entries changed after the run was generated — keep the run's total
                ded["Other Deduction"] = ded.get("Other Deduction", 0.0) + float(row.get("other_deductions") or 0)
            deductions = _fixed_lines(DEDUCTION_LINES, ded)

            await PayslipRepository.upsert(month, row["id"], {
                "period_start": start,
                "period_end": end,
                "employee": {
                    "name": row.get("employee"),
                    "emp_code": row.get("empId"),
                    "department": row.get("department"),
                    "designation": row.get("designation"),
                    "joining_date": _date_str(work.get("joining_date")),
                    "work_mode": work.get("work_mode") or "",
                    "bank_name": bank.get("bank_name") or "",
                    "account": str(bank.get("account_number") or "").strip(),
                    "ifsc": str(bank.get("ifsc_code") or "").strip().upper(),
                    "pan": str(bank.get("pan_card_number") or "").strip().upper(),
                    "uan": bank.get("uan_number") or bank.get("uan") or "",
                },
                "attendance": {
                    "working_days": row.get("working"),
                    "present": row.get("present"),
                    "paid_leave": row.get("paid_leave"),
                    "unpaid_leave": (row.get("unpaid_leave") or 0) + (row.get("excess_leave") or 0),
                    "absent": row.get("absent"),
                    "payable_days": row.get("payable_days"),
                    "lop_days": row.get("lop_days"),
                },
                "earnings": earnings,
                "deductions": deductions,
                "total_earnings": round(sum(l["amount"] for l in earnings), 2),
                "total_deductions": round(sum(l["amount"] for l in deductions), 2),
                "net_salary": float(row.get("netSalary") or 0),
                "published_by": actor,
                "published_at": now,
            })
            count += 1
        return count

    @staticmethod
    async def update(payslip_id: str, payload, user: dict, can_view_all: bool) -> dict:
        """Manual correction of a sent payslip; totals and net salary are recalculated from the lines."""
        from fastapi import HTTPException, status
        slip = await PayslipRepository.get_by_id(payslip_id)
        if not slip:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payslip not found")
        if not can_view_all and slip.get("employee_id") != str(user.get("_id", "")):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only edit your own payslip")

        update = {}
        if payload.employee is not None:
            for field, value in payload.employee.model_dump(exclude_none=True).items():
                value = value.strip()
                update[f"employee.{field}"] = value.upper() if field in ("pan", "ifsc") else value
        if payload.present_days is not None:
            update["attendance.present"] = payload.present_days

        earnings = [l.model_dump() for l in payload.earnings] if payload.earnings is not None else slip.get("earnings", [])
        deductions = [l.model_dump() for l in payload.deductions] if payload.deductions is not None else slip.get("deductions", [])
        total_earnings = round(sum(float(l["amount"]) for l in earnings), 2)
        total_deductions = round(sum(float(l["amount"]) for l in deductions), 2)
        update.update({
            "earnings": earnings,
            "deductions": deductions,
            "total_earnings": total_earnings,
            "total_deductions": total_deductions,
            "net_salary": round(max(0.0, total_earnings - total_deductions), 2),
            "edited_by": _actor(user),
            "edited_at": datetime.now(IST).isoformat(),
        })
        return await PayslipRepository.update_by_id(payslip_id, update)

    @staticmethod
    async def _contacts(employee_ids: list) -> dict:
        """employee_id -> {email, phone} from the Employee List."""
        from bson import ObjectId
        from app.database.db import get_database
        ids = [ObjectId(i) for i in employee_ids if ObjectId.is_valid(str(i))]
        contacts = {}
        if not ids:
            return contacts
        cursor = get_database()["employees"].find(
            {"_id": {"$in": ids}},
            {"personal_info.email_address": 1, "personal_info.phone_number": 1, "personal_info.contact_number": 1},
        )
        async for emp in cursor:
            info = emp.get("personal_info") or {}
            contacts[str(emp["_id"])] = {
                "email": info.get("email_address") or "",
                "phone": info.get("phone_number") or info.get("contact_number") or "",
            }
        return contacts

    @staticmethod
    async def send_email(payslip_id: str, user: dict, can_view_all: bool) -> dict:
        """Email the payslip PDF to the employee's registered email address."""
        import asyncio
        from fastapi import HTTPException, status
        from app.repository.settings import SettingsRepository
        from app.services.payslip_pdf import build_payslip_pdf
        from app.utils.email import send_email_with_attachment

        slip = await PayslipRepository.get_by_id(payslip_id)
        if not slip:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payslip not found")
        if not can_view_all and slip.get("employee_id") != str(user.get("_id", "")):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only send your own payslip")
        to_email = (await PayslipService._contacts([slip["employee_id"]])).get(slip["employee_id"], {}).get("email")
        if not to_email:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This employee has no email address in the Employee List")

        company = await SettingsRepository.get_settings() or {}
        company_name = company.get("company_name") or "Company"
        name = (slip.get("employee") or {}).get("name") or "Employee"
        label = datetime.strptime(slip["month"], "%Y-%m").strftime("%B %Y")
        net = float(slip.get("net_salary") or 0)
        pdf = build_payslip_pdf(slip, company)
        text = (f"Dear {name},\n\nPlease find attached your salary slip for {label}.\n"
                f"Net amount: Rs. {net:,.2f}\n\nRegards,\n{company_name}")
        html = (f"<p>Dear {name},</p><p>Please find attached your salary slip for <b>{label}</b>.</p>"
                f"<p>Net amount: <b>&#8377;{net:,.2f}</b></p><p>Regards,<br>{company_name}</p>")
        try:
            await asyncio.to_thread(
                send_email_with_attachment, to_email, f"Salary Slip - {label}", text, html, pdf,
                f"Payslip-{name.replace(' ', '_')}-{slip['month']}.pdf",
            )
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Could not send email: {e}")
        return {"sent_to": to_email}

    @staticmethod
    async def list_for(user: dict, can_view_all: bool, month: Optional[str], employee_id: Optional[str]) -> dict:
        own_id = str(user.get("_id", ""))
        scope_id = (employee_id or None) if can_view_all else own_id
        months = await PayslipRepository.months(None if can_view_all else own_id)
        month = month or (months[0] if months else None)
        payslips = await PayslipRepository.list(month, scope_id) if month else []
        contacts = await PayslipService._contacts([p["employee_id"] for p in payslips])
        for p in payslips:
            p["contact"] = contacts.get(p["employee_id"], {"email": "", "phone": ""})
        return {"months": months, "month": month, "can_view_all": can_view_all, "payslips": payslips}
