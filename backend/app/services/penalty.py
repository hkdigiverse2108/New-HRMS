from fastapi import HTTPException, status
from typing import Optional, List, Dict, Any
from app.repository.penalty import PenaltyTypeRepository, EmployeePenaltyRepository, EMPLOYEE_CARD_PROJECTION, employee_card
from app.schemas.penalty import PenaltyTypeCreate, PenaltyTypeUpdate, EmployeePenaltyCreate, EmployeePenaltyUpdate, PenaltySummaryResponse

# v3: cached lists must carry system_key (v2 entries predate it)
PENALTY_TYPES_CACHE_KEY = "penalties:types:v3"
# Marks the type used by automatic late penalties, so it can be renamed freely
LATE_PUNCHIN_SYSTEM_KEY = "late_punch_in"

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
                {"name": "Late Punch-in", "default_price": 100.0, "warning_limit": 0, "description": "Automatic penalty for punching in late.", "system_key": LATE_PUNCHIN_SYSTEM_KEY},
                {"name": "Security Policy Violation", "default_price": 500.0, "warning_limit": 0, "description": "Unauthorized access or violation of company security policies."},
                {"name": "No Show", "default_price": 200.0, "warning_limit": 0, "description": "Absent from work without notice or approval."}
            ]
            for d in defaults:
                await PenaltyTypeRepository.create(d)
            types = await PenaltyTypeRepository.get_all()
        elif not any(t.get("system_key") == LATE_PUNCHIN_SYSTEM_KEY for t in types):
            # Automatic late penalties need this type; keep it in every dropdown
            await PenaltyService.ensure_late_punchin_penalty_type()
            types = await PenaltyTypeRepository.get_all()
        return types

    @staticmethod
    async def ensure_late_punchin_penalty_type() -> str:
        from app.redis.service import delete_cache
        types = await PenaltyTypeRepository.get_all()
        for t in types:
            if t.get("system_key") == LATE_PUNCHIN_SYSTEM_KEY:
                return str(t["_id"])

        # Older data identified this type by name only; tag it so a rename keeps it linked
        for t in types:
            if t.get("name", "").strip().lower() == "late punch-in":
                await PenaltyTypeRepository.update(str(t["_id"]), {"system_key": LATE_PUNCHIN_SYSTEM_KEY})
                await delete_cache(PENALTY_TYPES_CACHE_KEY)
                return str(t["_id"])

        # Create it if it doesn't exist
        created = await PenaltyTypeRepository.create({
            "name": "Late Punch-in",
            "default_price": 100.0,
            "warning_limit": 0,
            "description": "Automatic penalty for punching in late.",
            "system_key": LATE_PUNCHIN_SYSTEM_KEY,
        })
        # Created outside the types API, so drop the cached list ourselves
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
            await PenaltyService._ensure_unique_type_name(update_data["name"], exclude_id=item_id)
            
        updated_item = await PenaltyTypeRepository.update(item_id, update_data)
        if not updated_item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Penalty type not found")
        return updated_item

    @staticmethod
    async def delete_penalty_type(item_id: str):
        existing = await PenaltyService.get_penalty_type_by_id(item_id)
        # Records keep a copy of the type name so their history still reads correctly
        if await EmployeePenaltyRepository.count_by_type(item_id):
            await EmployeePenaltyRepository.snapshot_type_name(item_id, existing.get("name") or "Penalty")
        # The automatic late type is re-created with defaults the next time it is needed
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
        # Fallback name for this record if its type is ever deleted (live type name is shown otherwise)
        insert_data["penalty_type_name"] = type_exists.get("name") or "Penalty"
        warning_limit = int(type_exists.get("warning_limit", 0) or 0)
        default_price = float(type_exists.get("default_price", 0.0))

        # Warnings this employee already got for this type (waived ones don't count)
        warnings_given = 0
        if warning_limit > 0:
            previous_warnings = await EmployeePenaltyRepository.get_all(
                is_deleted=False,
                employee_id=data.employee_id,
                penalty_type_id=data.penalty_type_id,
                type_filter="warning",
            )
            warnings_given = sum(1 for p in previous_warnings.get("data", []) if p.get("status") != "Waived")

        if warning_limit > 0 and warnings_given < warning_limit:
            # Type's warning limit decides first: the first N records are always warnings
            insert_data["is_warning"] = True
            insert_data["price"] = 0.0
            insert_data["impact_payroll"] = False
        elif data.is_warning:
            # Limit used up (or none set), but a warning was asked for explicitly
            insert_data["is_warning"] = True
            insert_data["price"] = 0.0
            insert_data["impact_payroll"] = False
        else:
            insert_data["is_warning"] = False
            insert_data["price"] = data.price if data.price else default_price

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
            
        # If penalty type is changing, take its current name (and default price unless one is given)
        if update_data.get("penalty_type_id"):
            type_exists = await PenaltyTypeRepository.get_by_id(update_data["penalty_type_id"])
            if not type_exists:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid penalty type")
            update_data["penalty_type_name"] = type_exists.get("name") or "Penalty"
            if "price" not in update_data:
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

