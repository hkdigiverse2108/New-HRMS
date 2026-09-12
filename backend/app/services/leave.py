from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from fastapi import HTTPException, status

from app.repository.leave import LeaveRepository
from app.repository.attendance import AttendanceRepository
from app.services.attendance import AttendanceService
from app.redis.service import get_cache, set_cache, delete_cache, clear_pattern, make_list_key

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
            "attachment": leave_data.get("attachment"),
            "applied_on": datetime.utcnow().strftime("%Y-%m-%d"),
            "created_at": datetime.utcnow().isoformat() + "Z"
        }

        res = await LeaveRepository.create_leave(doc)
        await clear_pattern("leaves:list:*")
        return res

    @classmethod
    async def update_leave_details(
        cls,
        leave_id: str,
        employee_id: str,
        update_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Updates an existing leave request if it is still Pending."""
        leave = await LeaveRepository.get_by_id(leave_id)
        if not leave:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave request not found.")
        
        # Ensure only the creator can update it
        if leave.get("employee_id") != employee_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only update your own leave request.")
        
        # Ensure it's in Pending status
        if leave.get("status") != "Pending":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="You can only update leave requests that are still Pending."
            )

        # Remove None values
        update_data = {k: v for k, v in update_data.items() if v is not None}
        
        if not update_data:
            return leave

        # Re-calculate duration if dates or day_type changed
        start_date = update_data.get("start_date", leave.get("start_date"))
        end_date = update_data.get("end_date", leave.get("end_date"))
        day_type = update_data.get("day_type", leave.get("day_type", "Full Day"))

        if "start_date" in update_data or "end_date" in update_data or "day_type" in update_data:
            dates = generate_date_range(start_date, end_date)
            if "Half Day" in day_type or "Half" in day_type:
                duration = 0.5 * len(dates)
            else:
                duration = float(len(dates))
            update_data["duration_days"] = update_data.get("duration_days") or duration
            
        updated = await LeaveRepository.update_leave_details(leave_id, update_data)
        
        await clear_pattern("leaves:list:*")
        await delete_cache(f"leave:{leave_id}")
        
        return updated or leave

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
    async def delete_leave(
        cls,
        leave_id: str,
        current_user_id: str,
        current_user_role: str
    ) -> bool:
        """
        Deletes a leave request.
        - Admin can delete any leave request.
        - Employee can only delete their own leave request AND only if it is still Pending.
        """
        leave = await LeaveRepository.get_by_id(leave_id)
        if not leave:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave request not found.")

        is_admin = current_user_role in ("Admin", "HR", "Sub-Admin")
        
        if not is_admin:
            if leave.get("employee_id") != current_user_id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only delete your own leave request.")
            if leave.get("status") != "Pending":
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You can only delete a leave request that is still Pending.")
                
        deleted = await LeaveRepository.delete_leave(leave_id)
        
        if deleted:
            await clear_pattern("leaves:list:*")
            await delete_cache(f"leave:{leave_id}")
            # If Admin deleted an approved leave, ideally we should undo attendance, 
            # but for simplicity, we just clear caches and let attendance stand or be manually fixed.
            if leave.get("status") == "Approved":
                await clear_pattern("attendance:list:*")
                await clear_pattern(f"attendance:summary:{leave.get('employee_id')}:*")
                
        return deleted

    @classmethod
    async def get_leaves(
        cls,
        employee_id: Optional[str] = None,
        status: Optional[str] = None,
        leave_type: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        page: Optional[int] = None,
        limit: Optional[int] = None,
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
            end_date=end_date,
            page=page,
            limit=limit
        )
        cached = await get_cache(cache_key)
        if cached is not None:
            return cached

        results = await LeaveRepository.get_leaves(
            employee_id=scoped_emp_id,
            status=status,
            leave_type=leave_type,
            start_date=start_date,
            end_date=end_date,
            page=page,
            limit=limit
        )
        await set_cache(cache_key, results, ttl=300)
        return results
