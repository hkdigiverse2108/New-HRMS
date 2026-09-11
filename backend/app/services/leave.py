from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from fastapi import HTTPException, status

from app.repository.leave import LeaveRepository
from app.repository.attendance import AttendanceRepository
from app.services.attendance import AttendanceService
from app.redis.service import get_cache, set_cache, clear_pattern, make_list_key

def generate_date_range(start_date_str: str, end_date_str: str) -> List[str]:
    """Generates a list of date strings (YYYY-MM-DD) between start and end date inclusive."""
    try:
        d_start = datetime.strptime(start_date_str, "%Y-%m-%d").date()
        d_end = datetime.strptime(end_date_str, "%Y-%m-%d").date()
    except ValueError:
        return [start_date_str]

    if d_end < d_start:
        return [start_date_str]

    dates = []
    curr = d_start
    while curr <= d_end:
        # Optionally exclude Sundays from leave calendar auto-creation if desired
        dates.append(curr.strftime("%Y-%m-%d"))
        curr += timedelta(days=1)
    return dates

class LeaveService:

    @classmethod
    async def apply_leave(
        cls,
        employee_id: str,
        leave_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Creates a new leave request with status 'Pending'."""
        emp_info = await AttendanceService.get_employee_info(employee_id)
        
        # Calculate duration days if not explicitly provided
        start_date = leave_data.get("start_date")
        end_date = leave_data.get("end_date")
        day_type = leave_data.get("day_type", "Full Day")

        dates = generate_date_range(start_date, end_date)
        if "Half Day" in day_type or "Half" in day_type:
            duration = 0.5 * len(dates)
        else:
            duration = float(len(dates))

        doc = {
            "employee_id": employee_id,
            "employee_name": emp_info.get("name", "Employee"),
            "avatar": emp_info.get("avatar", ""),
            "role": emp_info.get("role", "Staff"),
            "department": emp_info.get("department", "General"),
            "type": leave_data.get("type", "Annual Leave"),
            "start_date": start_date,
            "end_date": end_date,
            "day_type": day_type,
            "duration_days": leave_data.get("duration_days") or duration,
            "reason": leave_data.get("reason", ""),
            "status": "Pending",
            "is_conditional": leave_data.get("is_conditional", False),
            "applied_on": datetime.utcnow().strftime("%Y-%m-%d")
        }

        res = await LeaveRepository.create_leave(doc)
        await clear_pattern("leaves:list:*")
        return res

    @classmethod
    async def update_leave_status(
        cls,
        leave_id: str,
        new_status: str,
        rejection_reason: Optional[str] = None,
        decided_by: str = "Admin"
    ) -> Dict[str, Any]:
        """
        Updates leave request status.
        CRITICAL AUTO-SYNC: When approved, updates or creates attendance records for each day in range!
        """
        leave = await LeaveRepository.get_by_id(leave_id)
        if not leave:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave request not found.")

        updated_leave = await LeaveRepository.update_status(
            leave_id=leave_id,
            status=new_status,
            rejection_reason=rejection_reason,
            decided_by=decided_by
        )

        await clear_pattern("leaves:list:*")

        # Trigger auto-sync if Approved!
        if new_status == "Approved":
            employee_id = leave["employee_id"]
            emp_info = await AttendanceService.get_employee_info(employee_id)
            dates = generate_date_range(leave["start_date"], leave["end_date"])
            day_type = leave.get("day_type", "Full Day")
            is_half = "Half" in day_type
            leave_type = leave.get("type", "Leave")

            for d in dates:
                await AttendanceRepository.upsert_leave_attendance(
                    employee_id=employee_id,
                    date_str=d,
                    leave_type=leave_type,
                    employee_info=emp_info,
                    is_half_day=is_half,
                    half_day_type=day_type if is_half else None
                )
            await clear_pattern("attendance:list:*")
            await clear_pattern(f"attendance:summary:{employee_id}:*")

        return updated_leave or leave

    @classmethod
    async def get_leaves(
        cls,
        employee_id: Optional[str] = None,
        status: Optional[str] = None,
        leave_type: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        current_user_role: str = "Employee",
        current_user_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Role-scoped leave requests with Redis caching:
        Admin & HR: Can view all leave requests.
        Employee: Restricted ONLY to their own requests.
        """
        scoped_emp_id = employee_id
        if current_user_role not in ("Admin", "HR"):
            scoped_emp_id = current_user_id or employee_id

        cache_key = make_list_key(
            "leaves",
            employee_id=scoped_emp_id,
            status=status,
            leave_type=leave_type,
            start_date=start_date,
            end_date=end_date
        )
        cached = await get_cache(cache_key)
        if cached is not None:
            return cached

        results = await LeaveRepository.get_leaves(
            employee_id=scoped_emp_id,
            status=status,
            leave_type=leave_type,
            start_date=start_date,
            end_date=end_date
        )
        await set_cache(cache_key, results, ttl=300)
        return results
