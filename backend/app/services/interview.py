from typing import List, Dict, Any, Optional
from fastapi import HTTPException, status
from app.repository.interview import InterviewRepository
from app.schemas.interview import (
    InterviewStageCreate, InterviewStageUpdate,
    InterviewScheduleCreate, InterviewScheduleUpdate
)
from app.redis.service import clear_pattern

class InterviewService:

    @staticmethod
    async def check_user_permission(current_user: dict, action: str) -> bool:
        if not current_user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

        work = current_user.get("work_details", {}) or {}
        role = str(work.get("system_role") or current_user.get("system_role", "Employee")).strip().lower()

        # Admin, HR, SubAdmin roles have full access to interviews
        if role in ["admin", "ceo", "hr", "hr manager", "subadmin", "sub admin", "sub_admin"]:
            return True

        if action == "read":
            return True

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You do not have permission to perform '{action}' on Interviews."
        )

    # ==================== INTERVIEW STAGES ====================

    @staticmethod
    async def create_stage(data: InterviewStageCreate, current_user: dict) -> Dict[str, Any]:
        await InterviewService.check_user_permission(current_user, "create")
        created = await InterviewRepository.create_stage(data.model_dump())
        await clear_pattern("interview_stages:*")
        return created

    @staticmethod
    async def get_all_stages(current_user: dict) -> List[Dict[str, Any]]:
        await InterviewService.check_user_permission(current_user, "read")
        return await InterviewRepository.get_all_stages(is_deleted=False)

    @staticmethod
    async def get_stage_by_id(stage_id: str, current_user: dict) -> Dict[str, Any]:
        await InterviewService.check_user_permission(current_user, "read")
        item = await InterviewRepository.get_stage_by_id(stage_id)
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview stage not found")
        return item

    @staticmethod
    async def update_stage(stage_id: str, data: InterviewStageUpdate, current_user: dict) -> Dict[str, Any]:
        await InterviewService.check_user_permission(current_user, "edit")
        existing = await InterviewRepository.get_stage_by_id(stage_id)
        if not existing:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview stage not found")
            
        success = await InterviewRepository.update_stage(stage_id, data.model_dump(exclude_unset=True))
        if not success:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to update interview stage")
            
        await clear_pattern("interview_stages:*")
        return await InterviewRepository.get_stage_by_id(stage_id)

    @staticmethod
    async def delete_stage(stage_id: str, current_user: dict) -> bool:
        await InterviewService.check_user_permission(current_user, "delete")
        existing = await InterviewRepository.get_stage_by_id(stage_id)
        if not existing:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview stage not found")
            
        success = await InterviewRepository.delete_stage(stage_id)
        if success:
            await clear_pattern("interview_stages:*")
        return success

    # ==================== INTERVIEW SCHEDULES ====================

    @staticmethod
    async def create_schedule(data: InterviewScheduleCreate, current_user: dict) -> Dict[str, Any]:
        await InterviewService.check_user_permission(current_user, "create")
        
        p_info = current_user.get("personal_info", {}) or {}
        first_name = p_info.get("first_name") or current_user.get("first_name", "")
        last_name = p_info.get("last_name") or current_user.get("last_name", "")
        creator_name = f"{first_name} {last_name}".strip() or "System User"

        schedule_dict = data.model_dump()
        schedule_dict["created_by"] = {
            "employee_id": str(current_user.get("_id") or current_user.get("id")),
            "full_name": creator_name,
            "email": p_info.get("email_address") or current_user.get("email", "")
        }

        created = await InterviewRepository.create_schedule(schedule_dict)
        await clear_pattern("interview_schedules:*")
        return created

    @staticmethod
    async def get_all_schedules(
        current_user: dict,
        search: Optional[str] = None,
        page: int = 1,
        limit: int = 100
    ) -> Dict[str, Any]:
        await InterviewService.check_user_permission(current_user, "read")
        
        skip = (page - 1) * limit
        items, total_count = await InterviewRepository.get_all_schedules(
            skip=skip,
            limit=limit,
            search=search
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
    async def get_schedule_by_id(schedule_id: str, current_user: dict) -> Dict[str, Any]:
        await InterviewService.check_user_permission(current_user, "read")
        item = await InterviewRepository.get_schedule_by_id(schedule_id)
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview schedule not found")
        return item

    @staticmethod
    async def update_schedule(schedule_id: str, data: InterviewScheduleUpdate, current_user: dict) -> Dict[str, Any]:
        await InterviewService.check_user_permission(current_user, "edit")
        existing = await InterviewRepository.get_schedule_by_id(schedule_id)
        if not existing:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview schedule not found")
            
        success = await InterviewRepository.update_schedule(schedule_id, data.model_dump(exclude_unset=True))
        if not success:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to update interview schedule")
            
        updated = await InterviewRepository.get_schedule_by_id(schedule_id)
        
        # Sync interview stage to referral status if it changed
        if "interview_stage_name" in data.model_dump(exclude_unset=True) and updated and updated.get("referral_id"):
            from app.repository.hiring import HiringRepository
            ref_id = updated["referral_id"]
            new_stage_name = updated["interview_stage_name"]
            await HiringRepository.update_referral(ref_id, {"status": new_stage_name})
            await clear_pattern("hiring:*")
            
        await clear_pattern("interview_schedules:*")
        return updated

    @staticmethod
    async def delete_schedule(schedule_id: str, current_user: dict) -> bool:
        await InterviewService.check_user_permission(current_user, "delete")
        existing = await InterviewRepository.get_schedule_by_id(schedule_id)
        if not existing:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview schedule not found")
            
        success = await InterviewRepository.delete_schedule(schedule_id)
        if success:
            await clear_pattern("interview_schedules:*")
        return success
