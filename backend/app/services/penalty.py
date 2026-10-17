from fastapi import HTTPException, status
from typing import Optional, List, Dict, Any
from app.repository.penalty import PenaltyTypeRepository, EmployeePenaltyRepository, EMPLOYEE_CARD_PROJECTION, employee_card
from app.schemas.penalty import PenaltyTypeCreate, PenaltyTypeUpdate, EmployeePenaltyCreate, EmployeePenaltyUpdate, PenaltySummaryResponse

# v2: older "penalties:types:all" entries never expired and could miss auto-created types
PENALTY_TYPES_CACHE_KEY = "penalties:types:v2"

class PenaltyService:
    # --- Penalty Types ---
    @staticmethod
    async def _ensure_unique_type_name(name: str, exclude_id: Optional[str] = None):
        for t in await PenaltyTypeRepository.get_all():
            if t.get("name", "").strip().lower() == name.strip().lower() and str(t["_id"]) != exclude_id:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Penalty type '{name.strip()}' already exists")

    @staticmethod
    async def create_penalty_type(data: PenaltyTypeCreate):
        insert_data = data.model_dump(exclude_unset=True)
        insert_data["name"] = data.name.strip()
        if not insert_data["name"]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Penalty type name is required")
        await PenaltyService._ensure_unique_type_name(insert_data["name"])
        return await PenaltyTypeRepository.create(insert_data)

    @staticmethod
    async def get_all_penalty_types():
        types = await PenaltyTypeRepository.get_all()
        if not types:
            # Seed default penalty presets if collection is empty
            defaults = [
                {"name": "Late Arrival", "default_price": 100.0, "warning_limit": 3, "description": "Repeated late arrivals without prior notice."},
                {"name": "Late Punch-in", "default_price": 100.0, "warning_limit": 0, "description": "Automatic penalty for punching in late."},
                {"name": "Security Policy Violation", "default_price": 500.0, "warning_limit": 0, "description": "Unauthorized access or violation of company security policies."},
                {"name": "No Show", "default_price": 200.0, "warning_limit": 0, "description": "Absent from work without notice or approval."}
            ]
            for d in defaults:
                await PenaltyTypeRepository.create(d)
            types = await PenaltyTypeRepository.get_all()
        elif not any(t.get("name", "").strip().lower() == "late punch-in" for t in types):
            # Automatic late penalties need this type; keep it in every dropdown
            await PenaltyService.ensure_late_punchin_penalty_type()
            types = await PenaltyTypeRepository.get_all()
        return types

    @staticmethod
    async def ensure_late_punchin_penalty_type() -> str:
        types = await PenaltyTypeRepository.get_all()
        for t in types:
            if t.get("name", "").lower() == "late punch-in":
                return str(t["_id"])
                
        # Create it if it doesn't exist
        new_type = PenaltyTypeCreate(
            name="Late Punch-in",
            default_price=100.0,
            warning_limit=0,
            description="Automatic penalty for punching in late."
        )
        created = await PenaltyService.create_penalty_type(new_type)
        # Created outside the types API, so drop the cached list ourselves
        from app.redis.service import delete_cache
        await delete_cache(PENALTY_TYPES_CACHE_KEY)
        return str(created.get("_id") or created.get("id"))

    @staticmethod
    async def get_penalty_type_by_id(item_id: str):
        item = await PenaltyTypeRepository.get_by_id(item_id)
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Penalty type not found")
        return item

    @staticmethod
    async def update_penalty_type(item_id: str, data: PenaltyTypeUpdate):
        update_data = data.model_dump(exclude_unset=True)
        if not update_data:
            return await PenaltyService.get_penalty_type_by_id(item_id)
        if "name" in update_data:
            update_data["name"] = (update_data["name"] or "").strip()
            if not update_data["name"]:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Penalty type name is required")
            existing = await PenaltyService.get_penalty_type_by_id(item_id)
            if existing.get("name", "").lower() == "late punch-in" and update_data["name"].lower() != "late punch-in":
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="'Late Punch-in' is used by automatic penalties and cannot be renamed")
            await PenaltyService._ensure_unique_type_name(update_data["name"], exclude_id=item_id)
            
        updated_item = await PenaltyTypeRepository.update(item_id, update_data)
        if not updated_item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Penalty type not found")
        return updated_item

    @staticmethod
    async def delete_penalty_type(item_id: str):
        existing = await PenaltyService.get_penalty_type_by_id(item_id)
        if existing.get("name", "").lower() == "late punch-in":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="'Late Punch-in' is used by automatic penalties and cannot be deleted")
        in_use = await EmployeePenaltyRepository.count_by_type(item_id)
        if in_use:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"This penalty type is used by {in_use} penalty record(s) and cannot be deleted"
            )
        success = await PenaltyTypeRepository.delete(item_id)
        if not success:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Penalty type not found")
        return {"detail": "Penalty type deleted successfully"}

    # --- Employee Penalties ---
    @staticmethod
    async def create_employee_penalty(data: EmployeePenaltyCreate):
        type_exists = await PenaltyTypeRepository.get_by_id(data.penalty_type_id)
        if not type_exists:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid penalty type")
        
        insert_data = data.model_dump(exclude_unset=True)
        warning_limit = type_exists.get("warning_limit", 0)
        
        # Check previous penalties for warning limit
        previous_penalties = await EmployeePenaltyRepository.get_all(
            is_deleted=False, 
            employee_id=data.employee_id, 
            penalty_type_id=data.penalty_type_id
        )
        count = previous_penalties.get("total", len(previous_penalties.get("data", [])))
        
        if data.is_warning is not None:
            insert_data["is_warning"] = data.is_warning
            if data.is_warning:
                insert_data["price"] = 0.0
            else:
                insert_data["price"] = data.price if data.price is not None else float(type_exists.get("default_price", 0.0))
        elif warning_limit > 0:
            if count < warning_limit:
                insert_data["is_warning"] = True
                insert_data["price"] = 0.0
            else:
                insert_data["is_warning"] = False
                insert_data["price"] = data.price if data.price is not None else float(type_exists.get("default_price", 0.0))
        else:
            insert_data["is_warning"] = False
            insert_data["price"] = data.price if data.price is not None else float(type_exists.get("default_price", 0.0))

        if "impact_payroll" not in insert_data:
            insert_data["impact_payroll"] = not insert_data.get("is_warning", False) and (float(insert_data.get("price", 0)) > 0)
            
        insert_data["status"] = insert_data.get("status", "Active")
        created_penalty = await EmployeePenaltyRepository.create(insert_data)

        # Notify strictly the penalized employee
        try:
            from app.repository.notification import NotificationRepository
            emp_id = str(data.employee_id)
            is_warn = insert_data.get("is_warning", False)
            price_val = insert_data.get("price", 0)
            reason_text = insert_data.get("reason", "")
            
            title = "Formal Warning Issued" if is_warn else "Penalty Recorded"
            if is_warn:
                msg = f"A formal warning has been issued: {reason_text}" if reason_text else "A formal warning has been recorded."
            else:
                msg = f"A penalty of ₹{int(price_val)} has been recorded: {reason_text}" if reason_text else f"A penalty of ₹{int(price_val)} has been applied."
                
            await NotificationRepository.create_notification({
                "recipient_id": emp_id,
                "title": title,
                "message": msg,
                "type": "penalty",
                "action_url": "/penalty",
                "is_read": False
            })
        except Exception as e:
            print(f"[PENALTY NOTIFICATION ERROR] Failed to create notification: {e}")

        return created_penalty

    @staticmethod
    async def get_all_penalties(
        is_deleted: bool = False, 
        employee_id: Optional[str] = None, 
        penalty_type_id: Optional[str] = None, 
        status: Optional[str] = None,
        type_filter: Optional[str] = None,
        search: Optional[str] = None,
        start_date: Optional[str] = None, 
        end_date: Optional[str] = None, 
        page: Optional[int] = None, 
        limit: Optional[int] = None
    ):
        return await EmployeePenaltyRepository.get_all_populated(
            is_deleted=is_deleted,
            employee_id=employee_id,
            penalty_type_id=penalty_type_id,
            status=status,
            type_filter=type_filter,
            search=search,
            start_date=start_date,
            end_date=end_date,
            page=page,
            limit=limit
        )

    @staticmethod
    async def get_penalty_by_id(item_id: str):
        item = await EmployeePenaltyRepository.get_by_id(item_id)
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Penalty not found")
        return item

    @staticmethod
    async def update_employee_penalty(item_id: str, data: EmployeePenaltyUpdate):
        update_data = data.model_dump(exclude_unset=True)
        if not update_data:
            return await PenaltyService.get_penalty_by_id(item_id)
            
        # If penalty type is changing and no explicit price is provided, update default price
        if "penalty_type_id" in update_data and "price" not in update_data:
            type_exists = await PenaltyTypeRepository.get_by_id(update_data["penalty_type_id"])
            if not type_exists:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid penalty type")
            update_data["price"] = type_exists.get("default_price", 0.0)
            
        updated_item = await EmployeePenaltyRepository.update(item_id, update_data)
        if not updated_item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Penalty not found")
        return updated_item

    @staticmethod
    async def soft_delete_employee_penalty(item_id: str):
        success = await EmployeePenaltyRepository.soft_delete(item_id)
        if not success:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Penalty not found")
        return {"detail": "Penalty deleted successfully"}

    @staticmethod
    async def get_leaderboard(month: Optional[int] = None, year: Optional[int] = None):
        facets = await EmployeePenaltyRepository.get_leaderboard(month=month, year=year)
        entries = facets.get("top_by_violations", []) + facets.get("top_by_amount", [])

        # One query for every employee on both boards, projected to the card fields only
        from bson import ObjectId
        from app.repository.employee import EmployeeRepository
        ids = {e["employee_id"] for e in entries if ObjectId.is_valid(e.get("employee_id") or "")}
        collection = await EmployeeRepository.get_collection()
        cards = {}
        async for emp in collection.find({"_id": {"$in": [ObjectId(i) for i in ids]}}, EMPLOYEE_CARD_PROJECTION):
            cards[str(emp["_id"])] = employee_card(emp)

        for entry in entries:
            entry.update(cards.get(entry.get("employee_id")) or employee_card(None))

        return facets

    @staticmethod
    async def get_summary_stats() -> dict:
        summary = await EmployeePenaltyRepository.get_summary_stats()
        leaderboard = await PenaltyService.get_leaderboard()
        
        top_violations = leaderboard.get("top_by_violations", [])
        top_amounts = leaderboard.get("top_by_amount", [])
        
        max_viol_emp = top_violations[0]["employee_name"] if top_violations else "None"
        max_viol_cnt = top_violations[0]["total_violations"] if top_violations else 0
        
        max_amt_emp = top_amounts[0]["employee_name"] if top_amounts else "None"
        max_amt_val = top_amounts[0]["total_penalty_amount"] if top_amounts else 0.0
        
        return {
            "active_penalties_count": summary["active_penalties_count"],
            "total_payroll_deductions": summary["total_payroll_deductions"],
            "max_violations_employee": max_viol_emp,
            "max_violations_count": max_viol_cnt,
            "max_penalty_employee": max_amt_emp,
            "max_penalty_amount": max_amt_val
        }

