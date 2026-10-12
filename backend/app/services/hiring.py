from typing import List, Dict, Any, Optional
from fastapi import HTTPException, status
from app.repository.hiring import HiringRepository
from app.repository.access_control import UserPermissionRepository
from app.schemas.hiring import HiringCreate, HiringUpdate, ALLOWED_EMPLOYMENT_TYPES
from app.redis.service import clear_pattern

class HiringService:

    @staticmethod
    def _is_leader_or_admin(current_user: dict) -> bool:
        if not current_user:
            return False
        work = current_user.get("work_details", {}) or {}
        role = str(work.get("system_role") or current_user.get("system_role") or current_user.get("role", "Employee")).strip().lower()
        designation = str(work.get("designation") or current_user.get("designation") or "").strip().lower()
        department = str(work.get("department") or current_user.get("department") or "").strip().lower()

        # Admin, CEO, HR, SubAdmin roles
        if role in ["admin", "superadmin", "super admin", "ceo", "hr", "hr manager", "subadmin", "sub admin", "sub_admin"] or department == "hr":
            return True

        # Team Leader and Head
        if "team leader" in role or "head" in role or "team leader" in designation or "head" in designation:
            return True

        return False

    @staticmethod
    async def check_user_permission(current_user: dict, action: str) -> bool:
        if not current_user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

        # Everyone can view/read hirings
        if action == "read":
            return True

        # Team Leader, Head, Admin, and HR can create, edit, delete
        if HiringService._is_leader_or_admin(current_user):
            return True

        emp_id = str(current_user.get("_id") or current_user.get("id", "")).strip()

        # Check manual/custom permissions for this employee
        user_perm = await UserPermissionRepository.get_user_permission(emp_id)
        if user_perm and user_perm.get("module_permissions"):
            mod_perms = user_perm.get("module_permissions", [])
            for mod in mod_perms:
                mod_id = str(mod.get("module_id", "")).lower()
                if mod_id in ["/workspace/hiring", "/hiring", "hiring", "hirings", "recruitment", "/recruitment/hirings"]:
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
            detail=f"You do not have permission to perform '{action}' on Hirings/Job Postings. Only Team Leaders, Heads, Admins, and HR can post or manage jobs."
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
        p_info = current_user.get("personal_info", {}) or {}
        user_email = str(p_info.get("email_address") or current_user.get("email", "")).strip()

        filter_emp_id = None if is_privileged else emp_id
        filter_email = None if is_privileged else user_email

        items, total_count = await HiringRepository.get_all_hirings(
            is_deleted=False,
            department=department,
            employment_type=employment_type,
            status=status_val,
            search=search,
            skip=skip,
            limit=limit,
            filter_emp_id=filter_emp_id,
            filter_email=filter_email
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
        p_info = current_user.get("personal_info", {}) or {}
        user_email = str(p_info.get("email_address") or current_user.get("email", "")).strip()

        filter_emp_id = None if is_privileged else emp_id
        filter_email = None if is_privileged else user_email

        item = await HiringRepository.get_hiring_by_id(hiring_id, filter_emp_id=filter_emp_id, filter_email=filter_email)
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
        if not current_user:
            return False
        work = current_user.get("work_details", {}) or {}
        role = str(work.get("system_role") or current_user.get("system_role") or current_user.get("role", "Employee")).strip().lower()
        department = str(work.get("department") or current_user.get("department") or "").strip().lower()
        designation = str(work.get("designation") or current_user.get("designation") or "").strip().lower()
        return (
            role in ["admin", "superadmin", "super admin", "ceo", "hr", "hr manager", "subadmin", "sub admin", "sub_admin"]
            or department == "hr"
            or "team leader" in role
            or "head" in role
            or "team leader" in designation
            or "head" in designation
        )

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
        p_info = current_user.get("personal_info", {}) or {}
        user_email = str(p_info.get("email_address") or current_user.get("email", "")).strip()

        filter_emp_id = None if is_privileged else emp_id
        filter_email = None if is_privileged else user_email

        return await HiringRepository.get_all_referrals(
            is_deleted=False,
            hiring_id=hiring_id,
            referred_by_employee_id=filter_emp_id,
            referred_by_email=filter_email,
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

        # Auto-create or move interview schedule when status changes
        old_status = str(item.get("status") or "").strip()
        new_status = str(update_dict.get("status") or old_status).strip()
        if new_status and new_status.lower() != old_status.lower():
            from app.repository.interview import InterviewRepository
            db = (await HiringRepository.get_collection()).database
            sch_coll = db["interview_schedules"]
            stages = await InterviewRepository.get_all_stages(is_deleted=False)

            # Check if new_status matches an interview stage
            matched_stage = next((s for s in stages if str(s.get("name", "")).strip().lower() == new_status.lower()), None)
            if not matched_stage and new_status.lower() != "pending" and stages:
                matched_stage = stages[0]

            if matched_stage and new_status.lower() != "pending":
                target_stage_id = str(matched_stage["_id"])
                target_stage_name = str(matched_stage["name"])

                # Determine best default interviewer and job details
                p_info = current_user.get("personal_info", {}) or {}
                first_name = p_info.get("first_name") or current_user.get("first_name", "")
                last_name = p_info.get("last_name") or current_user.get("last_name", "")
                user_full_name = f"{first_name} {last_name}".strip() or "HR Team"

                role_pos = item.get("job_title")
                h_job = None
                if item.get("hiring_id"):
                    try:
                        h_job = await HiringRepository.get_by_id(str(item["hiring_id"]))
                        if h_job and not role_pos:
                            role_pos = h_job.get("job_title")
                    except Exception:
                        pass
                if not role_pos:
                    role_pos = "General Application"

                interviewer_default = (h_job.get("hiring_manager", {}) or {}).get("full_name") if h_job else None
                if not interviewer_default:
                    interviewer_default = user_full_name

                # Compile rich notes from referral
                ref_by = item.get("referred_by", {}) or {}
                ref_person = ref_by.get("full_name") or ""
                ref_dept = ref_by.get("department") or ""
                why_fit = item.get("why_good_fit") or ""
                cand_email = item.get("candidate_email") or ""
                cand_linkedin = item.get("linkedin_profile") or ""

                note_parts = []
                if ref_person:
                    note_parts.append(f"Referred by: {ref_person}" + (f" ({ref_dept})" if ref_dept else ""))
                if cand_email:
                    note_parts.append(f"Email: {cand_email}")
                if cand_linkedin:
                    note_parts.append(f"LinkedIn: {cand_linkedin}")
                if why_fit:
                    note_parts.append(f"Reason: {why_fit}")
                notes_content = "\n".join(note_parts) if note_parts else (item.get("why_good_fit") or f"Candidate moved to {target_stage_name}")

                today_date_str = datetime.utcnow().strftime("%Y-%m-%d")
                default_time_slot = "11:00 AM - 12:00 PM"

                # Check if schedule already exists for this referral
                existing_sch = await sch_coll.find_one({
                    "$or": [
                        {"referral_id": str(referral_id)},
                        {"candidate_name": item.get("candidate_name")}
                    ],
                    "is_deleted": False
                })

                if existing_sch:
                    sch_update_fields = {
                        "interview_stage_id": target_stage_id,
                        "interview_stage_name": target_stage_name,
                        "referral_id": str(referral_id),
                        "updated_at": datetime.utcnow()
                    }
                    if not existing_sch.get("resume_url") and item.get("resume_url"):
                        sch_update_fields["resume_url"] = item.get("resume_url")
                    if not existing_sch.get("candidate_email") and cand_email:
                        sch_update_fields["candidate_email"] = cand_email
                    if not existing_sch.get("linkedin_profile") and cand_linkedin:
                        sch_update_fields["linkedin_profile"] = cand_linkedin
                    if not existing_sch.get("notes") and notes_content:
                        sch_update_fields["notes"] = notes_content
                    if existing_sch.get("date") in (None, "", "TBD"):
                        sch_update_fields["date"] = today_date_str
                    if existing_sch.get("time") in (None, "", "TBD"):
                        sch_update_fields["time"] = default_time_slot
                    if existing_sch.get("interviewer_name") in (None, "", "TBD"):
                        sch_update_fields["interviewer_name"] = interviewer_default

                    await sch_coll.update_one(
                        {"_id": existing_sch["_id"]},
                        {"$set": sch_update_fields}
                    )
                else:
                    schedule_dict = {
                        "candidate_name": item.get("candidate_name", ""),
                        "candidate_email": cand_email,
                        "role_position": role_pos,
                        "hiring_id": str(item.get("hiring_id")) if item.get("hiring_id") else None,
                        "referral_id": str(referral_id),
                        "resume_url": item.get("resume_url") or "",
                        "linkedin_profile": cand_linkedin,
                        "interview_stage_id": target_stage_id,
                        "interview_stage_name": target_stage_name,
                        "date": today_date_str,
                        "time": default_time_slot,
                        "interviewer_name": interviewer_default,
                        "notes": notes_content,
                        "created_by": {
                            "employee_id": emp_id,
                            "full_name": user_full_name,
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
        ref_emp_id = str(item.get("referred_by", {}).get("employee_id", "") if item.get("referred_by") else "").strip()

        p_info = current_user.get("personal_info", {}) or {}
        user_email = str(p_info.get("email_address") or current_user.get("email", "")).strip().lower()
        ref_email = str(item.get("referred_by", {}).get("email", "") if item.get("referred_by") else "").strip().lower()

        is_owner = bool((emp_id and ref_emp_id and emp_id == ref_emp_id) or (user_email and ref_email and user_email == ref_email))

        if not is_privileged and not is_owner:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to delete this referral.")

        success = await HiringRepository.delete_referral(referral_id)
        if success:
            await clear_pattern("hiring:*")
        return success

    @staticmethod
    async def get_dashboard_summary(current_user: dict) -> Dict[str, Any]:
        await HiringService.check_user_permission(current_user, "read")
        return await HiringRepository.get_dashboard_summary()
