import uuid
from app.database.db import get_database
from bson import ObjectId
from datetime import datetime
from typing import List, Dict, Any, Optional

class SeatingRepository:
    collection_name = "seating_floors"

    @classmethod
    async def get_collection(cls):
        db = get_database()
        return db[cls.collection_name]

    @classmethod
    async def _populate_employee_resources(cls, floor_doc: dict) -> dict:
        if not floor_doc:
            return floor_doc

        emp_ids = set()
        allocations = floor_doc.get("allocations", [])
        for item in allocations:
            assigned = item.get("assigned_to")
            if assigned and assigned.get("employee_id"):
                emp_ids.add(str(assigned["employee_id"]))

        emp_resources_map: Dict[str, List[dict]] = {}
        if emp_ids:
            db = get_database()
            res_collection = db["resource_inventory"]
            or_conditions = [{"assigned_to.employee_id": str(eid)} for eid in emp_ids]
            valid_oids = [ObjectId(eid) for eid in emp_ids if ObjectId.is_valid(eid)]
            if valid_oids:
                or_conditions.extend([{"assigned_to.employee_id": oid} for oid in valid_oids])

            query = {
                "is_deleted": False,
                "$or": or_conditions
            }
            cursor = res_collection.find(query)
            async for r in cursor:
                r_assigned = r.get("assigned_to") or {}
                e_id = str(r_assigned.get("employee_id", ""))
                if e_id not in emp_resources_map:
                    emp_resources_map[e_id] = []
                emp_resources_map[e_id].append({
                    "_id": str(r["_id"]),
                    "resource_id": r.get("resource_id"),
                    "category_name": r.get("category_name"),
                    "condition": r.get("condition", "Good"),
                    "status": r.get("status", "Allocated")
                })

        for item in allocations:
            assigned = item.get("assigned_to")
            if assigned and assigned.get("employee_id"):
                e_id = str(assigned["employee_id"])
                assigned["allocated_resources"] = emp_resources_map.get(e_id, [])
            elif assigned:
                assigned["allocated_resources"] = []

        return floor_doc

    @classmethod
    async def create_floor(cls, data: dict) -> Dict[str, Any]:
        collection = await cls.get_collection()
        now = datetime.utcnow()
        doc = {
            "floor_name": str(data.get("floor_name", "")).strip(),
            "desks": [],
            "allocations": [],
            "created_by": data.get("created_by"),
            "is_deleted": False,
            "created_at": now,
            "updated_at": now
        }
        res = await collection.insert_one(doc)
        doc["_id"] = str(res.inserted_id)
        doc["total_desks"] = 0
        doc["total_seats"] = 0
        doc["allocated_seats"] = 0
        doc["available_seats"] = 0
        return doc

    @classmethod
    async def get_all_floors(cls, is_deleted: bool = False) -> List[Dict[str, Any]]:
        collection = await cls.get_collection()
        query = {"is_deleted": is_deleted}
        cursor = collection.find(query).sort("created_at", 1)
        floors = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            doc = await cls._populate_employee_resources(doc)
            desks = doc.get("desks", [])
            allocations = doc.get("allocations", [])
            total_desks = len(desks)
            total_seats = sum(int(d.get("top_seats_count", 0) or 0) + int(d.get("bottom_seats_count", 0) or 0) for d in desks)
            allocated_seats = len(allocations)
            doc["total_desks"] = total_desks
            doc["total_seats"] = total_seats
            doc["allocated_seats"] = allocated_seats
            doc["available_seats"] = max(0, total_seats - allocated_seats)
            floors.append(doc)
        return floors

    @classmethod
    async def get_floor_by_id(cls, floor_id: str) -> Optional[Dict[str, Any]]:
        collection = await cls.get_collection()
        if not ObjectId.is_valid(floor_id):
            return None
        doc = await collection.find_one({
            "_id": ObjectId(floor_id),
            "is_deleted": False
        })
        if not doc:
            return None
        doc["_id"] = str(doc["_id"])
        doc = await cls._populate_employee_resources(doc)
        desks = doc.get("desks", [])
        allocations = doc.get("allocations", [])
        total_seats = sum(int(d.get("top_seats_count", 0) or 0) + int(d.get("bottom_seats_count", 0) or 0) for d in desks)
        allocated_seats = len(allocations)
        doc["total_desks"] = len(desks)
        doc["total_seats"] = total_seats
        doc["allocated_seats"] = allocated_seats
        doc["available_seats"] = max(0, total_seats - allocated_seats)
        return doc

    @classmethod
    async def update_floor(cls, floor_id: str, update_data: dict) -> bool:
        collection = await cls.get_collection()
        if not ObjectId.is_valid(floor_id):
            return False
        payload = {"updated_at": datetime.utcnow()}
        if "floor_name" in update_data and update_data["floor_name"]:
            payload["floor_name"] = str(update_data["floor_name"]).strip()

        res = await collection.update_one(
            {"_id": ObjectId(floor_id), "is_deleted": False},
            {"$set": payload}
        )
        return res.modified_count > 0 or res.matched_count > 0

    @classmethod
    async def delete_floor(cls, floor_id: str) -> bool:
        collection = await cls.get_collection()
        if not ObjectId.is_valid(floor_id):
            return False
        res = await collection.update_one(
            {"_id": ObjectId(floor_id)},
            {"$set": {"is_deleted": True, "updated_at": datetime.utcnow()}}
        )
        return res.modified_count > 0

    @classmethod
    async def save_desk(cls, floor_id: str, desk_data: dict) -> Optional[Dict[str, Any]]:
        collection = await cls.get_collection()
        floor = await cls.get_floor_by_id(floor_id)
        if not floor:
            return None

        desks = floor.get("desks", [])
        target_desk_id = desk_data.get("desk_id")

        if not target_desk_id:
            existing_ids = [d.get("desk_id") for d in desks if d.get("desk_id")]
            count = len(desks) + 1
            target_desk_id = f"desk-{count:02d}"
            while target_desk_id in existing_ids:
                count += 1
                target_desk_id = f"desk-{count:02d}"

        existing_desk = next((d for d in desks if d.get("desk_id") == target_desk_id), None)

        top_count = int(desk_data.get("top_seats_count", 0) or 0)
        bottom_count = int(desk_data.get("bottom_seats_count", 0) or 0)

        desk_pcs = desk_data.get("desk_pcs", [])
        if isinstance(desk_pcs, str):
            desk_pcs = [p.strip() for p in desk_pcs.split(",") if p.strip()]

        desk_name = desk_data.get("desk_name") or f"Desk #{target_desk_id.replace('desk-', '')}"

        updated_desk_obj = {
            "desk_id": target_desk_id,
            "desk_name": desk_name,
            "top_seats_count": top_count,
            "bottom_seats_count": bottom_count,
            "desk_pcs": desk_pcs
        }

        if existing_desk:
            for idx, d in enumerate(desks):
                if d.get("desk_id") == target_desk_id:
                    desks[idx] = updated_desk_obj
                    break
        else:
            desks.append(updated_desk_obj)

        res = await collection.update_one(
            {"_id": ObjectId(floor_id)},
            {"$set": {"desks": desks, "updated_at": datetime.utcnow()}}
        )

        return updated_desk_obj if (res.modified_count > 0 or res.matched_count > 0) else None

    @classmethod
    async def delete_desk(cls, floor_id: str, desk_id: str) -> bool:
        collection = await cls.get_collection()
        if not ObjectId.is_valid(floor_id):
            return False
        floor = await cls.get_floor_by_id(floor_id)
        if not floor:
            return False

        desks = [d for d in floor.get("desks", []) if d.get("desk_id") != desk_id]
        allocations = [a for a in floor.get("allocations", []) if a.get("desk_id") != desk_id]

        res = await collection.update_one(
            {"_id": ObjectId(floor_id)},
            {"$set": {"desks": desks, "allocations": allocations, "updated_at": datetime.utcnow()}}
        )
        return res.modified_count > 0

    @classmethod
    async def allocate_seat(
        cls,
        floor_id: str,
        desk_id: Optional[str],
        seat_id: Optional[str],
        status: str,
        employee_info: Optional[dict] = None
    ) -> bool:
        collection = await cls.get_collection()
        if not ObjectId.is_valid(floor_id):
            return False
        floor = await cls.get_floor_by_id(floor_id)
        if not floor:
            return False

        allocations = floor.get("allocations", [])
        target_seat_id = seat_id or f"seat-{uuid.uuid4().hex[:8]}"

        # Remove existing allocation for this seat_id if updating/unassigning
        allocations = [a for a in allocations if a.get("seat_id") != target_seat_id]

        if status == "Allocated" and employee_info:
            new_alloc = {
                "seat_id": target_seat_id,
                "desk_id": desk_id,
                "status": "Allocated",
                "assigned_to": {
                    "employee_id": employee_info.get("employee_id"),
                    "first_name": employee_info.get("first_name", ""),
                    "last_name": employee_info.get("last_name", ""),
                    "full_name": f"{employee_info.get('first_name', '')} {employee_info.get('last_name', '')}".strip(),
                    "email": employee_info.get("email"),
                    "department": employee_info.get("department_name") or employee_info.get("department"),
                    "assigned_date": datetime.utcnow().isoformat()
                }
            }
            allocations.append(new_alloc)

        res = await collection.update_one(
            {"_id": ObjectId(floor_id)},
            {"$set": {"allocations": allocations, "updated_at": datetime.utcnow()}}
        )
        return res.modified_count > 0 or res.matched_count > 0
