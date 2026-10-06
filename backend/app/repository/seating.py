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
        desks = floor_doc.get("desks", [])
        for desk in desks:
            for seat in desk.get("seats", []):
                assigned = seat.get("assigned_to")
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

        for desk in desks:
            for seat in desk.get("seats", []):
                assigned = seat.get("assigned_to")
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
            total_desks = len(desks)
            total_seats = 0
            allocated_seats = 0
            for d in desks:
                seats = d.get("seats", [])
                total_seats += len(seats)
                for s in seats:
                    if s.get("status") == "Allocated":
                        allocated_seats += 1
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
        total_seats = 0
        allocated_seats = 0
        for d in desks:
            seats = d.get("seats", [])
            total_seats += len(seats)
            for s in seats:
                if s.get("status") == "Allocated":
                    allocated_seats += 1
        doc["total_desks"] = len(desks)
        doc["total_seats"] = total_seats
        doc["allocated_seats"] = allocated_seats
        doc["available_seats"] = max(0, total_seats - allocated_seats)
        return doc

    @classmethod
    async def find_floor_by_desk_id(cls, desk_id: str) -> Optional[Dict[str, Any]]:
        collection = await cls.get_collection()
        doc = await collection.find_one({"desks.desk_id": str(desk_id), "is_deleted": False})
        if not doc:
            return None
        doc["_id"] = str(doc["_id"])
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
            target_desk_id = str(ObjectId())

        existing_desk = next((d for d in desks if d.get("desk_id") == target_desk_id), None)
        existing_seats = existing_desk.get("seats", []) if existing_desk else []

        top_count = int(desk_data.get("top_seats_count", 0) or 0)
        bottom_count = int(desk_data.get("bottom_seats_count", 0) or 0)
        total_seats_needed = top_count + bottom_count

        desk_pcs = desk_data.get("desk_pcs", [])
        if isinstance(desk_pcs, str):
            desk_pcs = [p.strip() for p in desk_pcs.split(",") if p.strip()]

        desk_name = desk_data.get("desk_name") or f"Table #{len(desks) + 1}"

        # Auto-generate MongoDB ObjectId strings for seat_id
        new_seats = []
        for i in range(1, total_seats_needed + 1):
            if (i - 1) < len(existing_seats):
                prev_seat = existing_seats[i - 1]
                new_seats.append({
                    "seat_id": prev_seat.get("seat_id") or str(ObjectId()),
                    "status": prev_seat.get("status", "Available"),
                    "assigned_to": prev_seat.get("assigned_to")
                })
            else:
                new_seats.append({
                    "seat_id": str(ObjectId()),
                    "status": "Available",
                    "assigned_to": None
                })

        updated_desk_obj = {
            "desk_id": target_desk_id,
            "desk_name": desk_name,
            "top_seats_count": top_count,
            "bottom_seats_count": bottom_count,
            "desk_pcs": desk_pcs,
            "seats": new_seats
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

        res = await collection.update_one(
            {"_id": ObjectId(floor_id)},
            {"$set": {"desks": desks, "updated_at": datetime.utcnow()}}
        )
        return res.modified_count > 0

    @classmethod
    async def allocate_seat(
        cls,
        floor_id: Optional[str],
        desk_id: Optional[str],
        seat_id: Optional[str],
        status: str,
        employee_info: Optional[dict] = None
    ) -> Optional[str]:
        collection = await cls.get_collection()

        target_floor_id = floor_id
        if not target_floor_id and desk_id:
            floor_doc = await cls.find_floor_by_desk_id(desk_id)
            if floor_doc:
                target_floor_id = floor_doc["_id"]

        if not target_floor_id or not ObjectId.is_valid(target_floor_id):
            return None

        floor = await cls.get_floor_by_id(target_floor_id)
        if not floor:
            return None

        desks = floor.get("desks", [])
        seat_found = False

        for desk in desks:
            if not desk_id or desk.get("desk_id") == desk_id:
                for seat in desk.get("seats", []):
                    if not seat_id or seat.get("seat_id") == seat_id:
                        seat_found = True
                        seat["status"] = status
                        if status == "Allocated" and employee_info:
                            seat["assigned_to"] = {
                                "employee_id": employee_info.get("employee_id"),
                                "first_name": employee_info.get("first_name", ""),
                                "last_name": employee_info.get("last_name", ""),
                                "full_name": f"{employee_info.get('first_name', '')} {employee_info.get('last_name', '')}".strip(),
                                "email": employee_info.get("email"),
                                "department": employee_info.get("department_name") or employee_info.get("department"),
                                "designation": employee_info.get("designation", ""),
                                "profile_picture": employee_info.get("profile_picture", ""),
                                "assigned_date": datetime.utcnow().isoformat()
                            }
                        else:
                            seat["status"] = "Available"
                            seat["assigned_to"] = None
                        break
                if seat_found:
                    break

        if not seat_found:
            return None

        res = await collection.update_one(
            {"_id": ObjectId(target_floor_id)},
            {"$set": {"desks": desks, "updated_at": datetime.utcnow()}}
        )
        return target_floor_id if (res.modified_count > 0 or res.matched_count > 0) else None

    @classmethod
    async def reset_floor_seats(cls, floor_id: Optional[str] = None) -> bool:
        """Reset all seats on a floor (or across all floors if floor_id is None) to Available and clear assigned employees."""
        collection = await cls.get_collection()
        now = datetime.utcnow()
        query: Dict[str, Any] = {"is_deleted": False}
        if floor_id:
            if not ObjectId.is_valid(floor_id):
                return False
            query["_id"] = ObjectId(floor_id)

        cursor = collection.find(query)
        async for floor in cursor:
            desks = floor.get("desks", [])
            modified = False
            for desk in desks:
                for seat in desk.get("seats", []):
                    if seat.get("status") != "Available" or seat.get("assigned_to") is not None:
                        seat["status"] = "Available"
                        seat["assigned_to"] = None
                        modified = True
            if modified:
                await collection.update_one(
                    {"_id": floor["_id"]},
                    {"$set": {"desks": desks, "updated_at": now}}
                )

        return True
