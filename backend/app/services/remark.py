from app.repository.remark import RemarkRepository
from app.schemas.remark import RemarkCreate, RemarkUpdate
from typing import Optional, List, Dict, Any

class RemarkService:

    @staticmethod
    def _apply_visibility_rules(remark: Dict[str, Any], current_user: dict) -> Dict[str, Any]:
        role = current_user.get("work_details", {}).get("system_role", "")
        user_id = str(current_user.get("_id") or current_user.get("id"))
        is_admin = role in ["Admin", "Super Admin"] or user_id == "default-admin-id"

        # If the user is the one who submitted it, they can see everything natively.
        if remark.get("submitted_by_id") == user_id:
            return remark

        # If it's an admin viewing
        if is_admin:
            if not remark.get("show_name"):
                remark["submitted_by_id"] = None
                remark["submitted_by_name"] = "Anonymous"
        else:
            # Regular employee (not admin, not submitter). Based on requirements, they shouldn't even get here 
            # if we restrict GET /remarks correctly, but just in case:
            remark["submitted_by_id"] = None
            remark["submitted_by_name"] = "Anonymous"

        return remark

    @staticmethod
    async def create_remark(data: RemarkCreate, current_user: dict) -> Dict[str, Any]:
        user_id = str(current_user.get("_id") or current_user.get("id"))
        personal = current_user.get("personal_info", {})
        user_name = f"{personal.get('first_name', '')} {personal.get('last_name', '')}".strip() or "Employee"
        
        remark_data = data.dict(exclude_unset=True)
        remark_data["submitted_by_id"] = user_id
        remark_data["submitted_by_name"] = user_name

        created = await RemarkRepository.create_remark(remark_data)
        return RemarkService._apply_visibility_rules(created, current_user)

    @staticmethod
    async def get_remark_by_id(remark_id: str, current_user: dict) -> Optional[Dict[str, Any]]:
        remark = await RemarkRepository.get_remark_by_id(remark_id)
        if not remark:
            return None
            
        role = current_user.get("work_details", {}).get("system_role", "")
        user_id = str(current_user.get("_id") or current_user.get("id"))
        is_admin = role in ["Admin", "Super Admin"] or user_id == "default-admin-id"

        # Employee can only see their own submitted remarks. Admin can see all.
        if not is_admin and remark.get("submitted_by_id") != user_id:
            return None

        return RemarkService._apply_visibility_rules(remark, current_user)

    @staticmethod
    async def get_overview(current_user: dict) -> Dict[str, Any]:
        from app.database.db import get_database
        
        db = get_database()
        total_employees = await db["employees"].count_documents({})
        
        pipeline = [
            {"$group": {"_id": "$employee_id", "avg_rating": {"$avg": "$rating"}}}
        ]
        cursor = db["remarks"].aggregate(pipeline)
        
        unique_submitted = 0
        total_rating = 0
        async for doc in cursor:
            unique_submitted += 1
            total_rating += doc.get("avg_rating", 0)
            
        avg_satisfaction = round(total_rating / unique_submitted, 1) if unique_submitted > 0 else 0.0
        
        return {
            "total_employees": total_employees,
            "submitted_count": unique_submitted,
            "submission_rate_percent": round((unique_submitted / total_employees * 100)) if total_employees > 0 else 0,
            "average_satisfaction": avg_satisfaction
        }

    @staticmethod
    async def get_all_remarks(
        current_user: dict, 
        search: Optional[str] = None, 
        submission_rate: bool = False,
        avg_satisfaction: bool = False
    ) -> List[Dict[str, Any]]:
        role = current_user.get("work_details", {}).get("system_role", "")
        user_id = str(current_user.get("_id") or current_user.get("id"))
        is_admin = role in ["Admin", "Super Admin"] or user_id == "default-admin-id"

        query = {}
        # If not admin, restrict to their own submissions
        if not is_admin:
            query["submitted_by_id"] = user_id

        if search:
            search_regex = {"$regex": search, "$options": "i"}
            query["$or"] = [
                {"department": search_regex},
                {"submitted_by_name": search_regex}
            ]

        if avg_satisfaction:
            query["rating"] = {"$lte": 3}

        if submission_rate:
            # For missing submissions, we first find who has submitted
            from app.database.db import get_database
            db = get_database()
            remarks = await RemarkRepository.get_all_remarks(query)
            submitted_ids = {str(r.get("submitted_by_id")) for r in remarks if r.get("submitted_by_id")}
            
            # Find employees who are NOT in submitted_ids
            # Convert submitted_ids back to ObjectId if needed, but employee _id is ObjectId
            from bson import ObjectId
            submitted_obj_ids = [ObjectId(id) for id in submitted_ids if ObjectId.is_valid(id)]
            
            if not is_admin:
                if ObjectId(user_id) in submitted_obj_ids:
                    employees = []
                else:
                    employees = await db["employees"].find({"_id": ObjectId(user_id)}).to_list(None)
            else:
                employees = await db["employees"].find({"_id": {"$nin": submitted_obj_ids}}).to_list(None)
            
            missing_remarks = []
            for emp in employees:
                missing_remarks.append({
                    "_id": f"missing-{emp.get('_id')}",
                    "id": f"missing-{emp.get('_id')}",
                    "employee_id": str(emp.get('_id')),
                    "submitted_by_id": str(emp.get('_id')),
                    "submitted_by_name": f"{emp.get('personal_info', {}).get('first_name', '')} {emp.get('personal_info', {}).get('last_name', '')}".strip() or "Employee",
                    "department": emp.get('work_details', {}).get('department', 'Unknown'),
                    "rating": 0,  # 0 indicates pending/missing
                    "created_at": None,
                    "updated_at": None,
                })
            return missing_remarks

        remarks = await RemarkRepository.get_all_remarks(query)
        return [RemarkService._apply_visibility_rules(r, current_user) for r in remarks]

    @staticmethod
    async def update_remark(remark_id: str, data: RemarkUpdate, current_user: dict) -> Optional[Dict[str, Any]]:
        remark = await RemarkRepository.get_remark_by_id(remark_id)
        if not remark:
            return None

        role = current_user.get("work_details", {}).get("system_role", "")
        user_id = str(current_user.get("_id") or current_user.get("id"))
        is_admin = role in ["Admin", "Super Admin"] or user_id == "default-admin-id"

        if not is_admin and remark.get("submitted_by_id") != user_id:
            return None

        update_data = data.dict(exclude_unset=True)
        if not update_data:
            return RemarkService._apply_visibility_rules(remark, current_user)

        updated = await RemarkRepository.update_remark(remark_id, update_data)
        return RemarkService._apply_visibility_rules(updated, current_user) if updated else None

    @staticmethod
    async def delete_remark(remark_id: str, current_user: dict) -> bool:
        remark = await RemarkRepository.get_remark_by_id(remark_id)
        if not remark:
            return False

        role = current_user.get("work_details", {}).get("system_role", "")
        user_id = str(current_user.get("_id") or current_user.get("id"))
        is_admin = role in ["Admin", "Super Admin"] or user_id == "default-admin-id"

        if not is_admin and remark.get("submitted_by_id") != user_id:
            return False

        return await RemarkRepository.delete_remark(remark_id)
