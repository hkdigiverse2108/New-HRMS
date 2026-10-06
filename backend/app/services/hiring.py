from typing import List, Dict, Any, Optional
from fastapi import HTTPException, status
from app.repository.hiring import HiringRepository
from app.repository.access_control import UserPermissionRepository
from app.schemas.hiring import HiringCreate, HiringUpdate, ALLOWED_EMPLOYMENT_TYPES
from app.redis.service import clear_pattern

class HiringService:

    @staticmethod
    async def check_user_permission(current_user: dict, action: str) -> bool:
        if not current_user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

        work = current_user.get("work_details", {}) or {}
        role = str(work.get("system_role") or current_user.get("system_role", "Employee")).strip().lower()

        # Admin, CEO, HR, SubAdmin roles have full access
        if role in ["admin", "ceo", "hr", "hr manager", "subadmin", "sub admin", "sub_admin"]:
            return True

        if action == "read":
            return True

        emp_id = str(current_user.get("_id") or current_user.get("id", "")).strip()

        # Check manual/custom permissions for this employee
        user_perm = await UserPermissionRepository.get_user_permission(emp_id)
        if user_perm and user_perm.get("module_permissions"):
            mod_perms = user_perm.get("module_permissions", [])
            for mod in mod_perms:
                mod_id = str(mod.get("module_id", "")).lower()
                if mod_id in ["/workspace/hiring", "/hiring", "hiring", "hirings", "recruitment"]:
                    if action == "read" and mod.get("read"):
                        return True
                    if action == "create" and (mod.get("create") or mod.get("add")):
                        return True
                    if action in ["edit", "update"] and (mod.get("edit") or mod.get("update")):
                        return True
                    if action == "delete" and mod.get("delete"):
                        return True

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You do not have permission to perform '{action}' on Hirings/Job Postings."
        )

    @staticmethod
    async def get_employment_types() -> List[str]:
        """Returns hardcoded allowed employment types (Contract removed)."""
        return ALLOWED_EMPLOYMENT_TYPES

    @staticmethod
    async def get_hiring_managers(current_user: dict) -> List[Dict[str, Any]]:
        """Returns all employees formatted for Hiring Manager dropdown selection."""
        await HiringService.check_user_permission(current_user, "read")
        return await HiringRepository.get_hiring_managers()

    @staticmethod
    async def create_hiring(data: HiringCreate, current_user: dict) -> Dict[str, Any]:
        await HiringService.check_user_permission(current_user, "create")

        p_info = current_user.get("personal_info", {}) or {}
        first_name = p_info.get("first_name") or current_user.get("first_name", "")
        last_name = p_info.get("last_name") or current_user.get("last_name", "")
        creator_name = f"{first_name} {last_name}".strip() or "System User"

        hiring_dict = data.model_dump()
        hiring_dict["created_by"] = {
            "employee_id": str(current_user.get("_id") or current_user.get("id")),
            "full_name": creator_name,
            "email": p_info.get("email_address") or current_user.get("email", "")
        }

        created = await HiringRepository.create_hiring(hiring_dict)
        await clear_pattern("hiring:*")
        return created

    @staticmethod
    async def get_all_hirings(
        current_user: dict,
        department: Optional[str] = None,
        employment_type: Optional[str] = None,
        status_val: Optional[str] = None,
        search: Optional[str] = None,
        page: int = 1,
        limit: int = 100
    ) -> Dict[str, Any]:
        await HiringService.check_user_permission(current_user, "read")
        
        skip = (page - 1) * limit
        
        is_privileged = HiringService._is_admin_or_hr(current_user)
        emp_id = str(current_user.get("_id") or current_user.get("id", "")).strip()
        filter_emp_id = None if is_privileged else emp_id
        
        items, total_count = await HiringRepository.get_all_hirings(
            is_deleted=False,
            department=department,
            employment_type=employment_type,
            status=status_val,
            search=search,
            skip=skip,
            limit=limit,
            filter_emp_id=filter_emp_id
        )
        
        total_pages = (total_count + limit - 1) // limit if limit > 0 else 1
        
        return {
            "data": items,
            "total": total_count,
            "page": page,
            "limit": limit,
            "total_pages": total_pages
        }

    @staticmethod
    async def get_hiring_by_id(hiring_id: str, current_user: dict) -> Dict[str, Any]:
        await HiringService.check_user_permission(current_user, "read")
        
        is_privileged = HiringService._is_admin_or_hr(current_user)
        emp_id = str(current_user.get("_id") or current_user.get("id", "")).strip()
        filter_emp_id = None if is_privileged else emp_id
        
        item = await HiringRepository.get_hiring_by_id(hiring_id, filter_emp_id)
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job posting not found")
        return item

    @staticmethod
    async def update_hiring(hiring_id: str, data: HiringUpdate, current_user: dict) -> Dict[str, Any]:
        await HiringService.check_user_permission(current_user, "edit")

        existing = await HiringRepository.get_hiring_by_id(hiring_id)
        if not existing:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job posting not found")

        update_dict = data.model_dump(exclude_unset=True)
        success = await HiringRepository.update_hiring(hiring_id, update_dict)
        if not success:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to update job posting")

        await clear_pattern("hiring:*")
        
        is_privileged = HiringService._is_admin_or_hr(current_user)
        emp_id = str(current_user.get("_id") or current_user.get("id", "")).strip()
        filter_emp_id = None if is_privileged else emp_id
        
        updated = await HiringRepository.get_hiring_by_id(hiring_id, filter_emp_id)
        return updated

    @staticmethod
    async def delete_hiring(hiring_id: str, current_user: dict) -> bool:
        await HiringService.check_user_permission(current_user, "delete")

        existing = await HiringRepository.get_hiring_by_id(hiring_id)
        if not existing:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job posting not found")

        success = await HiringRepository.delete_hiring(hiring_id)
        if success:
            await clear_pattern("hiring:*")
        return success

    @staticmethod
    def _is_admin_or_hr(current_user: dict) -> bool:
        work = current_user.get("work_details", {}) or {}
        role = str(work.get("system_role") or current_user.get("system_role", "Employee")).strip().lower()
        return role in ["admin", "ceo", "hr", "hr manager", "subadmin", "sub admin", "sub_admin"]

    @staticmethod
    async def create_referral(hiring_id: Optional[str], data: Any, current_user: dict) -> Dict[str, Any]:
        """Submits a new Referral for a Job Posting. Auto-increments job applications_count."""
        if not current_user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

        target_hiring_id = hiring_id or data.hiring_id
        if not target_hiring_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="hiring_id is required")

        hiring_item = await HiringRepository.get_hiring_by_id(target_hiring_id)
        if not hiring_item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Associated Job Posting not found")

        p_info = current_user.get("personal_info", {}) or {}
        w_info = current_user.get("work_details", {}) or {}
        first_name = p_info.get("first_name") or current_user.get("first_name", "")
        last_name = p_info.get("last_name") or current_user.get("last_name", "")

        ref_dict = data.model_dump()
        ref_dict["hiring_id"] = target_hiring_id
        ref_dict["job_title"] = hiring_item.get("job_title", "")
        ref_dict["department"] = hiring_item.get("department", "")
        ref_dict["referred_by"] = {
            "employee_id": str(current_user.get("_id") or current_user.get("id")),
            "full_name": f"{first_name} {last_name}".strip() or "Employee",
            "email": p_info.get("email_address") or current_user.get("email", ""),
            "department": w_info.get("department") or "",
            "designation": w_info.get("designation") or w_info.get("job_title") or ""
        }

        created = await HiringRepository.create_referral(ref_dict)
        await clear_pattern("hiring:*")
        return created

    @staticmethod
    async def get_all_referrals(
        current_user: dict,
        hiring_id: Optional[str] = None,
        status_val: Optional[str] = None,
        search: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Returns referrals list.
        Admin/HR users see ALL referrals across all employees.
        Normal employees see ONLY their own submitted referrals.
        """
        if not current_user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

        is_privileged = HiringService._is_admin_or_hr(current_user)
        emp_id = str(current_user.get("_id") or current_user.get("id", "")).strip()

        filter_emp_id = None if is_privileged else emp_id

        return await HiringRepository.get_all_referrals(
            is_deleted=False,
            hiring_id=hiring_id,
            referred_by_employee_id=filter_emp_id,
            status=status_val,
            search=search
        )

    @staticmethod
    async def get_referral_by_id(referral_id: str, current_user: dict) -> Dict[str, Any]:
        if not current_user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

        item = await HiringRepository.get_referral_by_id(referral_id)
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Referral not found")

        is_privileged = HiringService._is_admin_or_hr(current_user)
        emp_id = str(current_user.get("_id") or current_user.get("id", "")).strip()
        ref_emp_id = str(item.get("referred_by", {}).get("employee_id", "") if item.get("referred_by") else "")

        if not is_privileged and ref_emp_id != emp_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to view this referral.")

        return item

    @staticmethod
    async def update_referral(referral_id: str, data: Any, current_user: dict) -> Dict[str, Any]:
        if not current_user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

        item = await HiringRepository.get_referral_by_id(referral_id)
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Referral not found")

        is_privileged = HiringService._is_admin_or_hr(current_user)
        emp_id = str(current_user.get("_id") or current_user.get("id", "")).strip()
        ref_emp_id = str(item.get("referred_by", {}).get("employee_id", "") if item.get("referred_by") else "")

        if not is_privileged and ref_emp_id != emp_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to edit this referral.")

        update_dict = data.model_dump(exclude_unset=True)

        # Normal employees cannot modify status if status change is for HR process
        if not is_privileged and "status" in update_dict:
            update_dict.pop("status", None)

        success = await HiringRepository.update_referral(referral_id, update_dict)
        if not success:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to update referral")

        # Auto-create interview schedule if status changed to "Contacted"
        old_status = item.get("status", "")
        new_status = update_dict.get("status", old_status)
        if new_status == "Contacted" and old_status != "Contacted":
            from app.services.interview import InterviewService
            from app.repository.interview import InterviewRepository
            stages = await InterviewRepository.get_all_stages(is_deleted=False)
            if stages:
                first_stage = stages[0]
                stage_id = str(first_stage["_id"])
                stage_name = first_stage["name"]
            else:
                stage_id = "pending_stage"
                stage_name = "Initial Stage"

            p_info = current_user.get("personal_info", {}) or {}
            first_name = p_info.get("first_name") or current_user.get("first_name", "")
            last_name = p_info.get("last_name") or current_user.get("last_name", "")
            
            schedule_dict = {
                "candidate_name": item.get("candidate_name", ""),
                "role_position": item.get("job_title", "General Application"),
                "hiring_id": item.get("hiring_id"),
                "referral_id": referral_id,
                "interview_stage_id": stage_id,
                "interview_stage_name": stage_name,
                "date": "TBD",
                "time": "TBD",
                "interviewer_name": "TBD",
                "notes": update_dict.get("hr_notes", item.get("hr_notes")),
                "created_by": {
                    "employee_id": emp_id,
                    "full_name": f"{first_name} {last_name}".strip() or "System",
                    "email": p_info.get("email_address") or ""
                }
            }
            await InterviewRepository.create_schedule(schedule_dict)
            await clear_pattern("interview_schedules:*")

        await clear_pattern("hiring:*")
        return await HiringRepository.get_referral_by_id(referral_id)

    @staticmethod
    async def delete_referral(referral_id: str, current_user: dict) -> bool:
        if not current_user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

        item = await HiringRepository.get_referral_by_id(referral_id)
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Referral not found")

        is_privileged = HiringService._is_admin_or_hr(current_user)
        emp_id = str(current_user.get("_id") or current_user.get("id", "")).strip()
        ref_emp_id = str(item.get("referred_by", {}).get("employee_id", "") if item.get("referred_by") else "")

        if not is_privileged and ref_emp_id != emp_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to delete this referral.")

        success = await HiringRepository.delete_referral(referral_id)
        if success:
            await clear_pattern("hiring:*")
        return success

    @staticmethod
    async def get_dashboard_summary(current_user: dict) -> Dict[str, Any]:
        await HiringService.check_user_permission(current_user, "read")
        return await HiringRepository.get_dashboard_summary()
