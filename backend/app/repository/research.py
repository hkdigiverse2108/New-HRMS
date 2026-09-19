from app.database.db import get_database
from bson import ObjectId
from typing import Optional
from datetime import datetime

class ResearchRepository:
    collection_name = "research_items"

    @classmethod
    async def get_collection(cls):
        db = get_database()
        return db[cls.collection_name]

    @classmethod
    async def create(cls, data: dict):
        collection = await cls.get_collection()
        now = datetime.utcnow()
        if "_id" not in data:
            data["_id"] = ObjectId()
        if "created_at" not in data:
            data["created_at"] = now
        data["updated_at"] = now
        data["is_deleted"] = False

        if "history" not in data:
            data["history"] = [{
                "log_id": str(ObjectId()),
                "employee_id": data.get("employee_id"),
                "action": "created",
                "timestamp": now,
                "changes_summary": "Created research document",
                "changed_fields": []
            }]

        await collection.insert_one(data)
        data["_id"] = str(data["_id"])
        return data

    @classmethod
    async def get_all(
        cls,
        department_id: Optional[str] = None,
        filter_employee_id: Optional[str] = None,
        project_id: Optional[str] = None,
        date_filter: Optional[str] = None,
        search_query: Optional[str] = None,
        employee_id: Optional[str] = None,
        emp_department_id: Optional[str] = None,
        is_admin: bool = False,
        page: Optional[int] = None,
        limit: Optional[int] = None
    ):
        collection = await cls.get_collection()

        query_conditions = [{"is_deleted": {"$ne": True}}]

        # Visibility filter: Non-admin employees see only their own research or research shared with them
        if not is_admin and employee_id:
            visibility_conditions = [
                {"employee_id": employee_id},
                {"shared_with": employee_id}
            ]
            query_conditions.append({"$or": visibility_conditions})

        # Employee filter (Filter by specific author employee_id)
        if filter_employee_id:
            query_conditions.append({"employee_id": filter_employee_id})

        # Department filter (supports matching department ObjectId, department name, or normalized lowercase name)
        if department_id and department_id.lower() != "all":
            dept_ids = [department_id]
            from app.repository.department import DepartmentRepository
            dept_doc = await DepartmentRepository.get_by_id_or_name(department_id)
            if dept_doc:
                real_id = str(dept_doc.get("_id"))
                dept_name = dept_doc.get("department_name") or dept_doc.get("name")
                if real_id not in dept_ids:
                    dept_ids.append(real_id)
                if dept_name and dept_name not in dept_ids:
                    dept_ids.append(dept_name)
            
            import re
            clean_str = department_id.replace(" ", "").replace("-", "").replace("_", "")
            regex_pattern = f".*{re.escape(clean_str)}.*"
            dept_regex = re.compile(regex_pattern, re.IGNORECASE)

            query_conditions.append({
                "$or": [
                    {"department_id": {"$in": dept_ids}},
                    {"department_id": dept_regex}
                ]
            })

        # Project filter
        if project_id:
            query_conditions.append({"project_id": project_id})

        # Exact Date filter (YYYY-MM-DD)
        if date_filter:
            try:
                from datetime import datetime, time
                parsed_date = datetime.strptime(date_filter.strip(), "%Y-%m-%d").date()
                day_start = datetime.combine(parsed_date, time.min)
                day_end = datetime.combine(parsed_date, time.max)
                query_conditions.append({
                    "$or": [
                        {"created_at": {"$gte": day_start, "$lte": day_end}},
                        {"planner_date": date_filter.strip()}
                    ]
                })
            except Exception:
                pass

        # Search query filter
        if search_query:
            import re
            regex = re.compile(re.escape(search_query), re.IGNORECASE)
            query_conditions.append({
                "$or": [
                    {"title": regex},
                    {"description": regex},
                    {"concepts.concept_name": regex}
                ]
            })

        final_query = {"$and": query_conditions} if len(query_conditions) > 1 else query_conditions[0]

        total = await collection.count_documents(final_query)
        cursor = collection.find(final_query).sort("created_at", -1)

        if page is not None and limit is not None and limit > 0:
            skip = (page - 1) * limit
            cursor = cursor.skip(skip).limit(limit)

        items = []
        async for item in cursor:
            item["_id"] = str(item["_id"])
            items.append(item)

        eff_limit = limit if (limit and limit > 0) else (total if total > 0 else 1)
        eff_page = page or 1
        total_pages = (total + eff_limit - 1) // eff_limit if eff_limit > 0 else 1

        return {
            "data": items,
            "total": total,
            "page": eff_page,
            "limit": eff_limit,
            "total_pages": total_pages
        }

    @classmethod
    async def get_by_id(cls, item_id: str):
        collection = await cls.get_collection()
        try:
            item = await collection.find_one({"_id": ObjectId(item_id), "is_deleted": {"$ne": True}})
            if item:
                item["_id"] = str(item["_id"])
            return item
        except Exception:
            return None

    @classmethod
    async def update(cls, item_id: str, update_data: dict, history_entry: Optional[dict] = None):
        collection = await cls.get_collection()
        update_data["updated_at"] = datetime.utcnow()
        update_op = {"$set": update_data}
        if history_entry:
            update_op["$push"] = {"history": history_entry}
        try:
            result = await collection.update_one(
                {"_id": ObjectId(item_id)},
                update_op
            )
            return result.modified_count > 0 or result.matched_count > 0
        except Exception:
            return False

    @classmethod
    async def delete(cls, item_id: str, user_id: Optional[str] = None):
        collection = await cls.get_collection()
        now = datetime.utcnow()
        history_entry = {
            "log_id": str(ObjectId()),
            "employee_id": user_id,
            "action": "deleted",
            "timestamp": now,
            "changes_summary": "Deleted research document",
            "changed_fields": []
        }
        try:
            result = await collection.update_one(
                {"_id": ObjectId(item_id)},
                {
                    "$set": {"is_deleted": True, "updated_at": now},
                    "$push": {"history": history_entry}
                }
            )
            return result.modified_count > 0
        except Exception:
            return False

    @classmethod
    async def upsert_from_planner(cls, employee_id: str, date_str: str, research_text: str, department_id: Optional[str] = None):
        if not research_text or not research_text.strip():
            return None

        collection = await cls.get_collection()
        existing = await collection.find_one({
            "employee_id": employee_id,
            "planner_date": date_str,
            "is_deleted": {"$ne": True}
        })

        now = datetime.utcnow()
        title_text = research_text.strip()
        if len(title_text) > 60:
            title_text = title_text[:57] + "..."

        if existing:
            old_desc = existing.get("description", "")
            update_fields = {
                "title": title_text,
                "description": research_text,
                "updated_at": now
            }
            if department_id:
                update_fields["department_id"] = department_id
            
            update_op = {"$set": update_fields}
            if old_desc != research_text:
                history_entry = {
                    "log_id": str(ObjectId()),
                    "employee_id": employee_id,
                    "action": "updated",
                    "timestamp": now,
                    "changes_summary": "Updated research from daily planner punch-in",
                    "changed_fields": [
                        {
                            "field": "description",
                            "old_value": old_desc,
                            "new_value": research_text
                        }
                    ]
                }
                update_op["$push"] = {"history": history_entry}

            await collection.update_one({"_id": existing["_id"]}, update_op)
            existing["_id"] = str(existing["_id"])
            return existing
        else:
            initial_history = [{
                "log_id": str(ObjectId()),
                "employee_id": employee_id,
                "action": "created",
                "timestamp": now,
                "changes_summary": "Created research document from daily planner punch-in",
                "changed_fields": []
            }]
            new_item = {
                "_id": ObjectId(),
                "title": title_text,
                "description": research_text,
                "employee_id": employee_id,
                "department_id": department_id,
                "project_id": None,
                "concepts": [],
                "shared_with": [],
                "planner_date": date_str,
                "created_at": now,
                "updated_at": now,
                "history": initial_history,
                "is_deleted": False
            }
            await collection.insert_one(new_item)
            new_item["_id"] = str(new_item["_id"])
            return new_item
