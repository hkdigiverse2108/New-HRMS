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

class WorkLogRepository:
    collection_name = "work_logs"

    @classmethod
    async def get_collection(cls):
        db = get_database()
        return db[cls.collection_name]

    @classmethod
    async def get_by_employee_and_date(cls, employee_id: str, date_str: str) -> Optional[Dict[str, Any]]:
        collection = await cls.get_collection()
        doc = await collection.find_one({"employee_id": employee_id, "date": date_str})
        return serialize_mongo(doc)

    @classmethod
    async def record_activity(cls, employee_id: str, date_str: str, activity_text: str, category: str = "Work"):
        if not activity_text or not activity_text.strip():
            return None

        collection = await cls.get_collection()
        now = datetime.utcnow()
        clean_text = activity_text.strip()

        doc = await collection.find_one({"employee_id": employee_id, "date": date_str})

        if doc:
            activities = doc.get("activities", [])
            # If the last activity is identical and in progress, skip duplicate recording
            if activities and activities[-1].get("is_in_progress") and activities[-1].get("activity") == clean_text:
                return doc

            # Close any currently in-progress activity
            for act in activities:
                if act.get("is_in_progress"):
                    act["is_in_progress"] = False
                    act["end_time"] = now
                    st = act.get("start_time")
                    if st and isinstance(st, datetime):
                        act["duration_seconds"] = max(0, int((now - st).total_seconds()))
                    elif st and isinstance(st, str):
                        try:
                            st_dt = datetime.fromisoformat(st)
                            act["duration_seconds"] = max(0, int((now - st_dt).total_seconds()))
                        except Exception:
                            act["duration_seconds"] = 0

            new_activity = {
                "log_id": str(ObjectId()),
                "category": category,
                "activity": clean_text,
                "start_time": now,
                "end_time": None,
                "duration_seconds": 0,
                "is_in_progress": True
            }
            activities.append(new_activity)

            await collection.update_one(
                {"_id": doc["_id"]},
                {"$set": {"activities": activities, "updated_at": now}}
            )
            doc["activities"] = activities
            return serialize_mongo(doc)
        else:
            new_doc = {
                "_id": ObjectId(),
                "employee_id": employee_id,
                "date": date_str,
                "activities": [
                    {
                        "log_id": str(ObjectId()),
                        "category": category,
                        "activity": clean_text,
                        "start_time": now,
                        "end_time": None,
                        "duration_seconds": 0,
                        "is_in_progress": True
                    }
                ],
                "created_at": now,
                "updated_at": now
            }
            await collection.insert_one(new_doc)
            return serialize_mongo(new_doc)

    @classmethod
    async def get_logs_for_date(
        cls,
        date_str: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        employee_id: Optional[str] = None,
        department_id: Optional[str] = None
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
        elif date_str:
            query["date"] = date_str

        cursor = collection.find(query).sort([("date", -1), ("created_at", -1)])
        records = []
        async for doc in cursor:
            records.append(serialize_mongo(doc))
        return records
