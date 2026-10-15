from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import HTTPException, status

from app.repository.salary import SalaryRevisionRepository
from app.repository.employee import EmployeeRepository
from app.schemas.salary import SalaryRevisionCreate
from app.redis.service import delete_cache, clear_pattern

IST = timezone(timedelta(hours=5, minutes=30))


def _today() -> str:
    return datetime.now(IST).strftime("%Y-%m-%d")


def _employee_name(emp: dict) -> str:
    personal = emp.get("personal_info", {}) or {}
    name = f"{personal.get('first_name', '') or ''} {personal.get('last_name', '') or ''}".strip()
    return name or emp.get("name") or "Unknown"


def _actor(user: dict) -> dict:
    return {"id": str(user.get("_id", "")), "name": _employee_name(user)}


def _date_str(value) -> Optional[str]:
    if not value:
        return None
    if hasattr(value, "strftime"):
        return value.strftime("%Y-%m-%d")
    return str(value)[:10]


def _profile_gross(emp: dict) -> float:
    return float((emp.get("bank_and_docs") or {}).get("monthly_salary") or 0)


def _totals(components: list) -> dict:
    gross = sum(float(c["amount"]) for c in components if c["type"] == "earnings")
    deductions = sum(float(c["amount"]) for c in components if c["type"] == "deductions")
    return {"gross": gross, "total_deductions": deductions, "net": gross - deductions}


def _virtual_initial(emp: dict) -> dict:
    """Structure derived from the profile's monthly salary when no revision exists yet."""
    gross = _profile_gross(emp)
    components = [{"id": "gross", "name": "Gross Salary", "amount": gross, "type": "earnings"}] if gross else []
    return {
        "_id": None,
        "employee_id": emp["_id"],
        "components": components,
        **_totals(components),
        "effective_date": _date_str((emp.get("work_details") or {}).get("joining_date")),
        "reason": "From employee profile",
        "change_type": "Initial",
        "status": "approved",
        "is_virtual": True,
    }


def _employee_summary(emp: dict) -> dict:
    work = emp.get("work_details", {}) or {}
    return {
        "id": emp["_id"],
        "employee_code": work.get("employee_id") or emp.get("employee_id") or "",
        "name": _employee_name(emp),
        "designation": work.get("designation") or "",
        "department": work.get("department") or "",
        "joining_date": _date_str(work.get("joining_date")),
        "work_mode": work.get("work_mode") or "",
    }


class SalaryService:

    @staticmethod
    async def _sync_profile_salary(emp: dict, gross: float):
        if _profile_gross(emp) == gross:
            return
        await EmployeeRepository.update_employee(emp["_id"], {"bank_and_docs.monthly_salary": gross})
        await delete_cache(f"employee:{emp['_id']}")
        await clear_pattern("employees:list:*")

    @staticmethod
    async def _get_employee_or_404(employee_id: str) -> dict:
        emp = await EmployeeRepository.get_employee_by_id(employee_id)
        if not emp or (emp.get("work_details") or {}).get("is_delete"):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
        return emp

    @staticmethod
    async def get_overview() -> dict:
        today = _today()
        employees = await EmployeeRepository.get_payroll_employees()
        current_map = await SalaryRevisionRepository.list_current_approved(today)
        pending = await SalaryRevisionRepository.list_by_status("pending")
        pending_ids = {p["employee_id"] for p in pending}

        rows = []
        total_gross = 0.0
        for emp in employees:
            current = current_map.get(emp["_id"])
            if current:
                # Approved future-dated revisions take effect lazily once their date arrives
                await SalaryService._sync_profile_salary(emp, current["gross"])
            else:
                current = _virtual_initial(emp)
            total_gross += current["gross"]
            rows.append({
                **_employee_summary(emp),
                "gross": current["gross"],
                "net": current["net"],
                "effective_date": current.get("effective_date"),
                "has_pending": emp["_id"] in pending_ids,
            })

        year_start = f"{today[:4]}-01-01"
        return {
            "employees": rows,
            "summary": {
                "employees_on_payroll": len([r for r in rows if r["gross"] > 0]),
                "total_monthly_gross": total_gross,
                "revisions_this_year": await SalaryRevisionRepository.count_approved_between(year_start, f"{today[:4]}-12-31"),
                "pending_revisions": len(pending),
            },
        }

    @staticmethod
    async def get_employee_detail(employee_id: str) -> dict:
        emp = await SalaryService._get_employee_or_404(employee_id)
        current = await SalaryRevisionRepository.get_latest_approved_effective(emp["_id"], _today())
        history = await SalaryRevisionRepository.list_by_employee(emp["_id"])
        if not history:
            history = [_virtual_initial(emp)]
        return {
            "employee": _employee_summary(emp),
            "current": current or _virtual_initial(emp),
            "pending": next((h for h in history if h.get("status") == "pending"), None),
            "history": history,
        }

    @staticmethod
    async def create_revision(employee_id: str, data: SalaryRevisionCreate, user: dict) -> dict:
        emp = await SalaryService._get_employee_or_404(employee_id)
        if await SalaryRevisionRepository.get_pending_for_employee(emp["_id"]):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                                detail="A salary revision is already pending approval for this employee")

        components = [c.model_dump() for c in data.components]
        totals = _totals(components)
        current = await SalaryRevisionRepository.get_latest_approved_effective(emp["_id"], _today())
        previous_gross = current["gross"] if current else _profile_gross(emp)
        change_type = data.change_type or ("Decrease" if totals["gross"] < previous_gross else "Increase")

        return await SalaryRevisionRepository.create({
            "employee_id": emp["_id"],
            "components": components,
            **totals,
            "previous_gross": previous_gross,
            "effective_date": data.effective_date,
            "reason": data.reason,
            "change_type": change_type,
            "status": "pending",
            "created_by": _actor(user),
            "created_at": datetime.now(IST).isoformat(),
        })

    @staticmethod
    async def _get_pending_or_error(rev_id: str) -> dict:
        rev = await SalaryRevisionRepository.get_by_id(rev_id)
        if not rev:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Salary revision not found")
        if rev.get("status") != "pending":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only pending revisions can be approved or rejected")
        return rev

    @staticmethod
    async def approve(rev_id: str, user: dict) -> dict:
        rev = await SalaryService._get_pending_or_error(rev_id)
        updated = await SalaryRevisionRepository.update(rev_id, {
            "status": "approved",
            "approved_by": _actor(user),
            "approved_at": datetime.now(IST).isoformat(),
        })
        if rev["effective_date"] <= _today():
            emp = await EmployeeRepository.get_employee_by_id(rev["employee_id"])
            if emp:
                await SalaryService._sync_profile_salary(emp, rev["gross"])
        return updated

    @staticmethod
    async def reject(rev_id: str, reason: str, user: dict) -> dict:
        await SalaryService._get_pending_or_error(rev_id)
        return await SalaryRevisionRepository.update(rev_id, {
            "status": "rejected",
            "approved_by": _actor(user),
            "approved_at": datetime.now(IST).isoformat(),
            "reject_reason": reason,
        })
