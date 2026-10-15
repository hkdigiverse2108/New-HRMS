import calendar
from datetime import datetime
from typing import Optional
from fastapi import HTTPException, status

from app.repository.bonus_deduction import BonusDeductionRepository
from app.repository.employee import EmployeeRepository
from app.repository.penalty import EmployeePenaltyRepository, PenaltyTypeRepository
from app.repository.salary import SalaryRevisionRepository
from app.schemas.bonus_deduction import BonusDeductionCreate
from app.services.salary import IST, _today, _actor, _employee_name, _date_str

SCOPE_LABELS = {"individual": "Individual", "department": "Department", "company": "Entire Company"}


def penalty_pending(p: dict) -> bool:
    """Active payroll-impacting penalty that nobody has applied to payroll yet."""
    return (p.get("status") or "Active") == "Active" and bool(p.get("impact_payroll", True))         and p.get("payroll_applied") is not True


def penalty_applies(p: dict) -> bool:
    """A penalty hits payroll only once it is Applied here: Active, impacting payroll, and confirmed.

    New penalties start Pending; Resolved and Waived penalties, or ones excluded from payroll, are never deducted.
    """
    return (p.get("status") or "Active") == "Active" and bool(p.get("impact_payroll", True))         and p.get("payroll_applied") is True


def _month_range(month: Optional[str]) -> tuple:
    """'YYYY-MM' (defaults to current month) -> (first day, last day) as YYYY-MM-DD."""
    month = month or _today()[:7]
    try:
        year, mon = int(month[:4]), int(month[5:7])
        last = calendar.monthrange(year, mon)[1]
    except (ValueError, IndexError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="month must be in YYYY-MM format")
    return f"{year:04d}-{mon:02d}-01", f"{year:04d}-{mon:02d}-{last:02d}"


def _department(emp: dict) -> str:
    return (emp.get("work_details") or {}).get("department") or ""


def _entry(**fields) -> dict:
    return {"counts": True, **fields}


class BonusDeductionService:

    @staticmethod
    async def _active_employees() -> dict:
        return {emp["_id"]: emp for emp in await EmployeeRepository.get_payroll_employees()}

    @staticmethod
    def _headcount(entry: dict, employees: dict) -> int:
        if entry["scope"] == "individual":
            return 1
        if entry["scope"] == "department":
            return sum(1 for e in employees.values() if _department(e) == entry.get("department"))
        return len(employees)

    @staticmethod
    def _manual_entry(doc: dict, employees: dict) -> dict:
        headcount = BonusDeductionService._headcount(doc, employees)
        if doc["scope"] == "individual":
            emp = employees.get(doc.get("employee_id"))
            applied_to = _employee_name(emp) if emp else "Unknown employee"
            applied_sub = SCOPE_LABELS["individual"]
        elif doc["scope"] == "department":
            applied_to = doc.get("department") or ""
            applied_sub = f"Department · {headcount} employee{'s' if headcount != 1 else ''}"
        else:
            applied_to = "All employees"
            applied_sub = f"Entire Company · {headcount} employee{'s' if headcount != 1 else ''}"
        state = (doc.get("status") or "pending").capitalize()
        return _entry(
            id=doc["_id"],
            ref=doc.get("ref") or "",
            source="manual",
            type=doc.get("type", "Deduction"),
            typeLabel=doc.get("category", ""),
            appliedTo=applied_to,
            appliedToSub=applied_sub,
            reason=doc.get("reason", ""),
            creator=(doc.get("created_by") or {}).get("name", ""),
            date=doc.get("date"),
            amount=float(doc.get("amount", 0)),
            total_amount=float(doc.get("amount", 0)) * headcount,
            state=state,
            reject_reason=doc.get("reject_reason"),
            counts=state == "Approved",
        )

    @staticmethod
    async def _penalty_entries(start: str, end: str, employees: dict) -> list:
        res = await EmployeePenaltyRepository.get_all(is_deleted=False, type_filter="penalty", start_date=start, end_date=end)
        type_names = {t["_id"]: t.get("name") for t in await PenaltyTypeRepository.get_all()}
        rows = []
        for p in res.get("data", []):
            amount = float(p.get("price") or 0)
            if amount <= 0:
                continue
            emp = employees.get(p.get("employee_id"))
            status_ = p.get("status") or "Active"
            counts = penalty_applies(p)
            rows.append(_entry(
                id=p["_id"],
                ref=f"PN-{p['_id'][-5:].upper()}",
                source="penalty",
                type="Deduction",
                typeLabel=type_names.get(p.get("penalty_type_id")) or "Penalty",
                appliedTo=_employee_name(emp) if emp else "Unknown employee",
                appliedToSub=f"Penalty · {_department(emp)}" if emp and _department(emp) else "Penalty",
                reason=p.get("reason") or "",
                creator="Penalty module",
                date=_date_str(p.get("penalty_date")),
                amount=amount,
                total_amount=amount,
                state=("Applied" if counts else "Pending" if penalty_pending(p) else "Not in payroll")
                if status_ == "Active" else status_,
                counts=counts,
            ))
        return rows

    @staticmethod
    async def _salary_entries(start: str, end: str, employees: dict) -> list:
        current_map = await SalaryRevisionRepository.list_current_approved(end)
        rows = []
        for emp_id, rev in current_map.items():
            emp = employees.get(emp_id)
            if not emp:
                continue
            for comp in rev.get("components", []):
                amount = float(comp.get("amount") or 0)
                if comp.get("type") != "deductions" or amount <= 0:
                    continue
                rows.append(_entry(
                    id=f"{rev['_id']}:{comp.get('id')}",
                    ref=f"SS-{rev['_id'][-5:].upper()}",
                    source="salary",
                    type="Deduction",
                    typeLabel=comp.get("name") or "Salary deduction",
                    appliedTo=_employee_name(emp),
                    appliedToSub="Salary structure · Recurring",
                    reason=f"Monthly deduction (effective {rev.get('effective_date')})",
                    creator=(rev.get("approved_by") or rev.get("created_by") or {}).get("name", ""),
                    date=start,
                    amount=amount,
                    total_amount=amount,
                    state="Recurring",
                ))
        return rows

    @staticmethod
    async def list_entries(month: Optional[str]) -> dict:
        start, end = _month_range(month)
        employees = await BonusDeductionService._active_employees()

        manual = [BonusDeductionService._manual_entry(d, employees)
                  for d in await BonusDeductionRepository.list_between(start, end)]
        entries = (manual
                   + await BonusDeductionService._penalty_entries(start, end, employees)
                   + await BonusDeductionService._salary_entries(start, end, employees))

        def total(kind: str) -> float:
            return sum(e["total_amount"] for e in entries if e["type"] == kind and e["counts"])

        return {
            "month": start[:7],
            "entries": entries,
            "summary": {
                "total_bonus": total("Bonus"),
                "total_deduction": total("Deduction"),
                "entries_count": len(entries),
                "pending_count": sum(1 for e in entries if e["state"] == "Pending"),
            },
            "employees": [
                {"id": emp_id, "name": _employee_name(emp), "department": _department(emp)}
                for emp_id, emp in employees.items()
            ],
            "departments": sorted({_department(e) for e in employees.values() if _department(e)}),
        }

    @staticmethod
    async def create(data: BonusDeductionCreate, user: dict) -> dict:
        if data.scope == "individual":
            emp = await EmployeeRepository.get_employee_by_id(data.employee_id)
            if not emp or (emp.get("work_details") or {}).get("is_delete"):
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
        payload = data.model_dump()
        if data.scope != "individual":
            payload["employee_id"] = None
        if data.scope != "department":
            payload["department"] = None
        return await BonusDeductionRepository.create({
            **payload,
            "ref": await BonusDeductionRepository.next_ref(),
            "status": "pending",
            "created_by": _actor(user),
            "created_at": datetime.now(IST).isoformat(),
        })

    @staticmethod
    async def apply_penalty(penalty_id: str, user: dict) -> dict:
        """Confirm a pending penalty so it is deducted in payroll and shown on the payslip."""
        penalty = await EmployeePenaltyRepository.get_by_id(penalty_id)
        if not penalty or penalty.get("is_deleted"):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Penalty not found")
        if not penalty_pending(penalty):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only pending penalties can be applied")
        return await EmployeePenaltyRepository.update(penalty_id, {
            "payroll_applied": True,
            "payroll_applied_by": _actor(user),
            "payroll_applied_at": datetime.now(IST).isoformat(),
        })

    @staticmethod
    async def _get_pending_or_error(entry_id: str) -> dict:
        entry = await BonusDeductionRepository.get_by_id(entry_id)
        if not entry:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")
        if entry.get("status") != "pending":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only pending entries can be approved or rejected")
        return entry

    @staticmethod
    async def approve(entry_id: str, user: dict) -> dict:
        await BonusDeductionService._get_pending_or_error(entry_id)
        return await BonusDeductionRepository.update(entry_id, {
            "status": "approved",
            "approved_by": _actor(user),
            "approved_at": datetime.now(IST).isoformat(),
        })

    @staticmethod
    async def reject(entry_id: str, reason: str, user: dict) -> dict:
        await BonusDeductionService._get_pending_or_error(entry_id)
        return await BonusDeductionRepository.update(entry_id, {
            "status": "rejected",
            "approved_by": _actor(user),
            "approved_at": datetime.now(IST).isoformat(),
            "reject_reason": reason,
        })
