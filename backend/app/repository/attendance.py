from app.database.db import get_database
from bson import ObjectId
from typing import Optional, List, Dict, Any
from datetime import datetime

def serialize_mongo(data: Any) -> Any:
    if isinstance(data, list):
        return [serialize_mongo(item) for item in data]
    if isinstance(data, dict):
        res = {}
        for k, v in data.items():
            if isinstance(v, ObjectId):
                res[k] = str(v)
            elif isinstance(v, (dict, list)):
                res[k] = serialize_mongo(v)
            else:
                res[k] = v
        if "_id" in res:
            res["id"] = str(res["_id"])
            res["_id"] = str(res["_id"])
        return res
    if isinstance(data, ObjectId):
        return str(data)
    return data

class AttendanceRepository:
    collection_name = "attendance"

    @classmethod
    async def get_collection(cls):
        db = get_database()
        return db[cls.collection_name]

    @classmethod
    async def get_last_record(cls, employee_id: str) -> Optional[Dict[str, Any]]:
        collection = await cls.get_collection()
        doc = await collection.find_one(
            {"employee_id": employee_id},
            sort=[("date", -1), ("_id", -1)]
        )
        return serialize_mongo(doc)

    @classmethod
    async def get_record_by_id(cls, record_id: str) -> Optional[Dict[str, Any]]:
        collection = await cls.get_collection()
        try:
            doc = await collection.find_one({"_id": ObjectId(record_id)})
        except Exception:
            doc = await collection.find_one({"id": record_id})
        return serialize_mongo(doc)

    @classmethod
    async def get_by_employee_and_date(cls, employee_id: str, date_str: str) -> Optional[Dict[str, Any]]:
        collection = await cls.get_collection()
        doc = await collection.find_one({"employee_id": employee_id, "date": date_str})
        return serialize_mongo(doc)

    @classmethod
    async def create_record(cls, record_data: Dict[str, Any]) -> Dict[str, Any]:
        collection = await cls.get_collection()
        result = await collection.insert_one(record_data)
        record_data["id"] = str(result.inserted_id)
        record_data["_id"] = str(result.inserted_id)
        return serialize_mongo(record_data)

    @classmethod
    async def update_record(cls, record_id: str, update_fields: Dict[str, Any]) -> bool:
        collection = await cls.get_collection()
        try:
            filter_query = {"_id": ObjectId(record_id)}
        except Exception:
            filter_query = {"_id": record_id}
        result = await collection.update_one(filter_query, {"$set": update_fields})
        return result.modified_count > 0

    @classmethod
    async def get_records(
        cls,
        employee_id: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 1000
    ) -> List[Dict[str, Any]]:
        collection = await cls.get_collection()
        query: Dict[str, Any] = {}
        if employee_id:
            query["employee_id"] = employee_id
        if start_date and end_date:
            query["date"] = {"$gte": start_date, "$lte": end_date}
        elif start_date:
            query["date"] = {"$gte": start_date}
        elif end_date:
            query["date"] = {"$lte": end_date}
        if status and status != "All":
            query["status"] = status

        cursor = collection.find(query).sort("date", -1).limit(limit)
        records = []
        async for doc in cursor:
            records.append(serialize_mongo(doc))
        return records

    @classmethod
    async def upsert_leave_attendance(
        cls,
        employee_id: str,
        date_str: str,
        leave_type: str,
        employee_info: Dict[str, Any],
        is_half_day: bool = False,
        half_day_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """Auto-creates or updates attendance when a leave request is approved."""
        collection = await cls.get_collection()
        existing = await collection.find_one({"employee_id": employee_id, "date": date_str})

        if is_half_day:
            remark = f"On Leave: {half_day_type or 'Half Day'} ({leave_type})"
            if existing:
                remarks_list = existing.get("remarks", [])
                if remark not in remarks_list:
                    remarks_list.append(remark)
                await collection.update_one(
                    {"_id": existing["_id"]},
                    {"$set": {"remarks": remarks_list, "status": "On Leave"}}
                )
                existing["remarks"] = remarks_list
                return serialize_mongo(existing)
            else:
                new_doc = {
                    "employee_id": employee_id,
                    "employee_name": employee_info.get("name", "Employee"),
                    "role": employee_info.get("role", "Staff"),
                    "department": employee_info.get("department", "General"),
                    "avatar": employee_info.get("avatar", ""),
                    "date": date_str,
                    "status": "On Leave",
                    "check_in": "--",
                    "check_out": "--",
                    "gross_seconds": 0,
                    "break_seconds": 0,
                    "net_work_seconds": 0,
                    "work_hours": "--",
                    "break_hours": "--",
                    "is_late": False,
                    "remarks": [remark],
                    "punches": [],
                    "breaks": [],
                    "created_at": datetime.utcnow().isoformat()
                }
                res = await collection.insert_one(new_doc)
                new_doc["id"] = str(res.inserted_id)
                new_doc["_id"] = str(res.inserted_id)
                return serialize_mongo(new_doc)
        else:
            # Full Day Leave
            remark = f"Auto-marked leave - {leave_type} approved"
            if existing:
                await collection.update_one(
                    {"_id": existing["_id"]},
                    {"$set": {
                        "status": "On Leave",
                        "check_in": "--",
                        "check_out": "--",
                        "work_hours": "--",
                        "gross_seconds": 0,
                        "break_seconds": 0,
                        "net_work_seconds": 0,
                        "remarks": [remark]
                    }}
                )
                existing["status"] = "On Leave"
                existing["work_hours"] = "--"
                existing["remarks"] = [remark]
                return serialize_mongo(existing)
            else:
                new_doc = {
                    "employee_id": employee_id,
                    "employee_name": employee_info.get("name", "Employee"),
                    "role": employee_info.get("role", "Staff"),
                    "department": employee_info.get("department", "General"),
                    "avatar": employee_info.get("avatar", ""),
                    "date": date_str,
                    "status": "On Leave",
                    "check_in": "--",
                    "check_out": "--",
                    "gross_seconds": 0,
                    "break_seconds": 0,
                    "net_work_seconds": 0,
                    "work_hours": "--",
                    "break_hours": "--",
                    "is_late": False,
                    "remarks": [remark],
                    "punches": [],
                    "breaks": [],
                    "created_at": datetime.utcnow().isoformat()
                }
                res = await collection.insert_one(new_doc)
                new_doc["id"] = str(res.inserted_id)
                new_doc["_id"] = str(res.inserted_id)
                return serialize_mongo(new_doc)

