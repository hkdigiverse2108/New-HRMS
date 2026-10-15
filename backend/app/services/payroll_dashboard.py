import asyncio
from collections import defaultdict
from datetime import datetime
from typing import Optional

from app.database.db import get_database
from app.repository.payroll import PayrollRepository
from app.repository.payslip import PayslipRepository
from app.repository.salary import SalaryRevisionRepository
from app.services.bonus_deduction import BonusDeductionService
from app.services.payroll import PayrollService, _month_bounds
from app.services.salary import SalaryService, _employee_name, _today

TREND_MONTHS = 6


def _shift_month(month: str, delta: int) -> str:
    y, m = int(month[:4]), int(month[5:7]) - 1 + delta
    return f"{y + m // 12:04d}-{m % 12 + 1:02d}"


def _label(month: str) -> str:
    return datetime.strptime(month, "%Y-%m").strftime("%b %Y")


class PayrollDashboardService:

    @staticmethod
    async def _audit_log(limit: Optional[int] = 8) -> list:
        """Latest payroll events from runs, salary revisions and bonus / deduction approvals (all when limit is None)."""
        db = get_database()
        events = []

        async for run in db["payroll_runs"].find({}):
            label = _label(run["month"])
            for key, text in (("generated", "Payroll generated"), ("approved", "Payroll approved"),
                              ("locked", "Payroll locked"), ("payslips_sent", "Payslips sent")):
                at, by = run.get(f"{key}_at"), run.get(f"{key}_by")
                if at:
                    events.append({"action": f"{text} — {label}", "by": (by or {}).get("name", ""), "at": at})

        async for rev in db["salary_revisions"].find({"status": {"$in": ["approved", "rejected"]}}) \
                .sort([("approved_at", -1)]).limit(limit or 0):
            verb = "approved" if rev["status"] == "approved" else "rejected"
            events.append({
                "action": f"Salary revision {verb} — ₹{float(rev.get('gross') or 0):,.0f}",
                "by": (rev.get("approved_by") or {}).get("name", ""),
                "at": rev.get("approved_at"),
                "employee_id": rev.get("employee_id"),
            })

        async for e in db["bonus_deductions"].find({"status": {"$in": ["approved", "rejected"]}}) \
                .sort([("approved_at", -1)]).limit(limit or 0):
            events.append({
                "action": f"{e.get('type', 'Deduction')} {e['status']} — {e.get('category', '')} ₹{float(e.get('amount') or 0):,.0f}",
                "by": (e.get("approved_by") or {}).get("name", ""),
                "at": e.get("approved_at"),
            })

        events = [e for e in events if e.get("at")]
        events.sort(key=lambda e: str(e["at"]), reverse=True)
        if limit:
            events = events[:limit]

        # Salary revisions store only the employee id — fill in names for the ones shown
        ids = [e["employee_id"] for e in events if e.get("employee_id")]
        if ids:
            from app.repository.employee import EmployeeRepository
            names = {emp["_id"]: _employee_name(emp) for emp in await EmployeeRepository.get_payroll_employees()}
            for e in events:
                if e.get("employee_id") in names:
                    e["action"] += f" for {names[e['employee_id']]}"
        for e in events:
            e.pop("employee_id", None)
        return events

    @staticmethod
    async def get(month: str) -> dict:
        _month_bounds(month)
        trend_months = [_shift_month(month, -i) for i in range(TREND_MONTHS - 1, -1, -1)]
        # Every section is independent — load them all at once instead of one after another
        (runs, overview, bd, settings, payslips, audit_log) = await asyncio.gather(
            asyncio.gather(*(PayrollService.get_run(m) for m in trend_months)),
            SalaryService.get_overview(),
            BonusDeductionService.list_entries(month),
            PayrollRepository.get_settings(),
            PayslipRepository.list(month),
            PayrollDashboardService._audit_log(),
        )
        run = runs[-1]
        rows = run.get("rows", [])
        paid_rows = [r for r in rows if r.get("gross", 0) > 0]
        summary = run.get("summary", {})

        # Salary Structure: current monthly salary of every employee
        salaried = [e for e in overview["employees"] if e["gross"] > 0]
        highest = max(salaried, key=lambda e: e["gross"], default=None)
        lowest = min(salaried, key=lambda e: e["gross"], default=None)

        # Bonus & Deductions: entries still waiting for Apply / approval this month
        pending_revisions = overview["summary"]["pending_revisions"]
        pending_entries = bd["summary"]["pending_count"]

        review = defaultdict(int)
        for r in paid_rows:
            review[r.get("review_status") or "pending"] += 1

        # Every department from the Employee List, including ones whose employees have no salary yet (₹0)
        departments = defaultdict(lambda: {"gross": 0.0, "net": 0.0, "employees": 0})
        for r in rows:
            if not r.get("department") and r.get("gross", 0) <= 0:
                continue
            d = departments[r.get("department") or "Unassigned"]
            d["gross"] += r["gross"]
            d["net"] += r.get("netSalary", 0)
            d["employees"] += 1

        trend = []
        for m, t in zip(trend_months, runs):
            s = t.get("summary", {})
            trend.append({
                "month": m,
                "label": _label(m),
                "net": s.get("total_net", 0),
                "earned": s.get("company_expense", 0),
                "status": t.get("status", "not_generated"),
            })


        return {
            "month": month,
            "is_current_month": month == _today()[:7],
            "status": run.get("status", "not_generated"),
            "calendar": run.get("calendar", {}),
            "metrics": {
                "net_payable": summary.get("total_net", 0),
                "earned": summary.get("company_expense", 0),
                "monthly_gross": round(sum(r["gross"] for r in paid_rows), 2),
                "total_bonus": summary.get("total_bonus", 0),
                "total_deduction": summary.get("total_deduction", 0),
                "not_due": summary.get("total_not_due", 0),
                "employees_on_payroll": len(paid_rows),
                "headcount": len(rows),
                "without_salary": len(rows) - len(paid_rows),
                "payslips_sent": len(payslips),
                "review": {"verified": review["verified"], "pending": review["pending"], "on_hold": review["on_hold"]},
            },
            "salary": {
                "average": round(sum(e["gross"] for e in salaried) / len(salaried), 2) if salaried else 0,
                "highest": highest and {"amount": highest["gross"], "name": highest["name"], "department": highest["department"]},
                "lowest": lowest and {"amount": lowest["gross"], "name": lowest["name"], "department": lowest["department"]},
                "revisions_this_year": overview["summary"]["revisions_this_year"],
            },
            "pending": {
                "salary_revisions": pending_revisions,
                "bonus_deductions": pending_entries,
                "employee_reviews": review["pending"] if run.get("status") in ("generated", "approved") else 0,
            },
            "next_salary_date": settings.get("nextSalaryDate") or None,
            "trend": trend,
            "departments": sorted(
                ({"department": k, **{f: round(v, 2) if isinstance(v, float) else v for f, v in d.items()}}
                 for k, d in departments.items()),
                key=lambda d: (-d["gross"], d["department"].lower()),
            ),
            "audit_log": audit_log,
        }
