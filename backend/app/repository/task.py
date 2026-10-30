from app.database.db import get_database
from bson import ObjectId
from typing import Optional
from datetime import datetime, date, timedelta

class TaskRepository:
    collection_name = "tasks"

    @classmethod
    async def get_collection(cls):
        db = get_database()
        return db[cls.collection_name]

    @classmethod
    async def create(cls, data: dict):
        collection = await cls.get_collection()
        data["created_at"] = datetime.utcnow()
        data["updated_at"] = datetime.utcnow()
        data["is_deleted"] = False
        
        if "due_date" in data and isinstance(data["due_date"], date) and not isinstance(data["due_date"], datetime):
            data["due_date"] = datetime.combine(data["due_date"], datetime.min.time())
            
        result = await collection.insert_one(data)
        data["_id"] = str(result.inserted_id)
        return data

    @classmethod
    async def create_many(cls, data_list: list[dict]):
        collection = await cls.get_collection()
        now = datetime.utcnow()
        for data in data_list:
            data["created_at"] = now
            data["updated_at"] = now
            data["is_deleted"] = False
            
            if "due_date" in data and data["due_date"] and isinstance(data["due_date"], date) and not isinstance(data["due_date"], datetime):
                data["due_date"] = datetime.combine(data["due_date"], datetime.min.time())
                
        if not data_list:
            return []
            
        result = await collection.insert_many(data_list)
        for data, inserted_id in zip(data_list, result.inserted_ids):
            data["_id"] = str(inserted_id)
        return data_list

    @classmethod
    async def get_all(
        cls, 
        is_deleted: bool = False, 
        assigned_to: Optional[str] = None, 
        assigned_by: Optional[str] = None, 
        status: Optional[str] = None, 
        priority: Optional[str] = None, 
        page: Optional[int] = None, 
        limit: Optional[int] = None, 
        involved_emp_id: Optional[str] = None,
        history_assigned_to: Optional[str] = None,
        history_assigned_by: Optional[str] = None,
        content_item_id: Optional[str] = None,
        project_id: Optional[str] = None,
        creative_role: Optional[str] = None,
        task_category: Optional[str] = None,
        timeline_filter: Optional[str] = None,
        target_date: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        search: Optional[str] = None,
        team_employee_ids: Optional[list[str]] = None,
        sub_category: Optional[str] = None
    ):
        collection = await cls.get_collection()
        
        # Ensure tasks belonging to archived projects are excluded from active tasks
        from app.database.db import get_database
        db = get_database()
        archived_projs = await db["projects"].find({"is_archived": True}, {"_id": 1}).to_list(length=10000)
        archived_proj_ids = []
        for p in archived_projs:
            archived_proj_ids.append(str(p["_id"]))
            archived_proj_ids.append(p["_id"])

        and_conditions = [
            {"is_deleted": is_deleted}, 
            {"is_archived": {"$ne": True}},
            # Audio 19: Completed automated content calendar tasks are fully done and dropped from the active backlog
            {"$nor": [{"content_item_id": {"$exists": True, "$ne": None}, "status": {"$in": ["completed", "done"]}}]}
        ]
        if archived_proj_ids:
            and_conditions.append({"project_id": {"$nin": archived_proj_ids}})
        
        if involved_emp_id:
            and_conditions.append({
                "$or": [
                    {"assigned_to": involved_emp_id},
                    {"assigned_by": involved_emp_id},
                    {"created_by": involved_emp_id},
                    {"collaborators": involved_emp_id},
                    {"transfer_request.requested_to": involved_emp_id},
                    {"transfer_request.requested_by": involved_emp_id},
                    {"transfer_history.to_employee": involved_emp_id},
                    {"transfer_history.from_employee": involved_emp_id},
                ]
            })
            
        if team_employee_ids is not None:
            and_conditions.append({"assigned_to": {"$in": team_employee_ids}})
            
        if assigned_to:
            and_conditions.append({"assigned_to": assigned_to})
        if assigned_by:
            and_conditions.append({"assigned_by": assigned_by})
        if status and status != "All":
            norm_status = status.lower().replace(" ", "").replace("_", "")
            if norm_status in ["done", "completed"]:
                and_conditions.append({"status": {"$in": ["completed", "done"]}})
            elif norm_status in ["inprogress"]:
                and_conditions.append({"status": "inprogress"})
            elif norm_status in ["inreview", "review"]:
                and_conditions.append({"status": {"$in": ["inreview", "review"]}})
            elif norm_status in ["todo"]:
                and_conditions.append({"status": "todo"})
            else:
                and_conditions.append({"status": status.lower()})
        if priority and priority != "All":
            and_conditions.append({"priority": priority.lower()})
        if history_assigned_to:
            and_conditions.append({"transfer_history.to_employee": history_assigned_to})
        if history_assigned_by:
            and_conditions.append({"transfer_history.from_employee": history_assigned_by})
        if content_item_id:
            and_conditions.append({"content_item_id": content_item_id})
        if project_id:
            and_conditions.append({"project_id": project_id})
        if creative_role:
            and_conditions.append({"creative_role": creative_role})
        if task_category and task_category != "All":
            and_conditions.append({"task_category": task_category})
        if sub_category and sub_category != "All":
            import re as _re
            stage = sub_category.strip()
            # Manual tasks store the stage in `sub_category`; Content-Calendar synced tasks store it in `creative_role`
            stage_roles = {
                "script": ["scripting"],
                "scripting": ["scripting"],
                "shoot": ["shoot_videography"],
                "editing": ["reel_editing"],
                "thumbnail": ["thumbnail"],
                "caption": ["caption"],
                "approval": ["approval_qc"],
                "posting": ["posting_publisher"],
                "post/graphics": ["post_graphics"],
                "post graphics": ["post_graphics"],
                "graphics": ["post_graphics"],
                "brand person": ["brand_person"],
            }
            stage_or = [{"sub_category": {"$regex": f"^{_re.escape(stage)}$", "$options": "i"}}]
            roles = stage_roles.get(stage.lower())
            if roles:
                stage_or.append({"creative_role": {"$in": roles}})
            and_conditions.append({"$or": stage_or})
            
        if search and search.strip():
            and_conditions.append({"title": {"$regex": search.strip(), "$options": "i"}})
            
        if target_date:
            try:
                ref_date = datetime.strptime(target_date.strip(), "%Y-%m-%d")
            except Exception:
                ref_date = datetime.utcnow() + timedelta(hours=5, minutes=30)
        else:
            ref_date = datetime.utcnow() + timedelta(hours=5, minutes=30)

        start_of_today = datetime(ref_date.year, ref_date.month, ref_date.day)
        end_of_today = datetime(ref_date.year, ref_date.month, ref_date.day, 23, 59, 59, 999999)
        today_str = ref_date.strftime("%Y-%m-%d")

        if timeline_filter:
            tf = timeline_filter.lower().strip()
            if tf == "today":
                # Today's Work: Due today OR overdue (incomplete tasks with due_date before today)
                and_conditions.append({
                    "$or": [
                        {"due_date": {"$gte": start_of_today, "$lte": end_of_today}},
                        {"due_date": today_str},
                        {
                            "$or": [
                                {"due_date": {"$lt": start_of_today}},
                                {"due_date": {"$type": "string", "$lt": today_str}}
                            ],
                            "status": {"$nin": ["completed", "done"]}
                        }
                    ]
                })
            elif tf == "overdue":
                and_conditions.append({
                    "$or": [
                        {"due_date": {"$lt": start_of_today}},
                        {"due_date": {"$type": "string", "$lt": today_str}}
                    ],
                    "status": {"$nin": ["completed", "done"]}
                })
            elif tf == "pending":
                and_conditions.append({
                    "$or": [
                        {"task_category": "Pending"},
                        {"title": {"$regex": "^\\[pending\\]", "$options": "i"}},
                        {"is_pending_issue": True}
                    ]
                })
            elif tf == "upcoming":
                and_conditions.append({
                    "$or": [
                        {"due_date": {"$gt": end_of_today}},
                        {"due_date": {"$type": "string", "$gt": today_str}}
                    ],
                    "status": {"$nin": ["completed", "done"]}
                })
            elif tf == "client_issue":
                and_conditions.append({
                    "$or": [
                        {"task_category": "Client Issue"},
                        {"title": {"$regex": "^\\[client issue\\]", "$options": "i"}},
                        {"is_client_issue": True}
                    ]
                })

        if start_date or end_date:
            date_query = {}
            if start_date:
                date_query["$gte"] = datetime.combine(start_date, datetime.min.time())
            if end_date:
                date_query["$lte"] = datetime.combine(end_date, datetime.max.time())
            and_conditions.append({"due_date": date_query})

        query = {"$and": and_conditions} if len(and_conditions) > 1 else and_conditions[0]

        total = await collection.count_documents(query)

        # In Today's Work view, prioritize overdue tasks at the top by sorting due_date ascending
        if timeline_filter and timeline_filter.lower().strip() == "today":
            sort_criteria = [("due_date", 1), ("created_at", -1)]
        else:
            sort_criteria = [("due_date", -1), ("created_at", -1)]

        if page and limit:
            skip = (page - 1) * limit
            cursor = collection.find(query).sort(sort_criteria).skip(skip).limit(limit)
            total_pages = (total + limit - 1) // limit
        else:
            cursor = collection.find(query).sort(sort_criteria)
            page = 1
            limit = total if total > 0 else 10
            total_pages = 1 if total > 0 else 0

        items = []
        async for item in cursor:
            item["_id"] = str(item["_id"])
            items.append(item)
            
        return {
            "data": items,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": total_pages
        }

    @classmethod
    async def get_by_id(cls, item_id: str):
        collection = await cls.get_collection()
        try:
            item = await collection.find_one({"_id": ObjectId(item_id)})
            if item:
                item["_id"] = str(item["_id"])
            return item
        except Exception:
            return None

    @classmethod
    async def update(cls, item_id: str, update_data: dict):
        collection = await cls.get_collection()
        update_data["updated_at"] = datetime.utcnow()
        
        if "due_date" in update_data and update_data["due_date"]:
            if isinstance(update_data["due_date"], date) and not isinstance(update_data["due_date"], datetime):
                update_data["due_date"] = datetime.combine(update_data["due_date"], datetime.min.time())
                
        try:
            await collection.update_one({"_id": ObjectId(item_id)}, {"$set": update_data})
            return await cls.get_by_id(item_id)
        except Exception:
            return None

    @classmethod
    async def soft_delete(cls, item_id: str):
        collection = await cls.get_collection()
        try:
            await collection.update_one({"_id": ObjectId(item_id)}, {"$set": {"is_deleted": True, "updated_at": datetime.utcnow()}})
            return True
        except Exception:
            return False

    @classmethod
    async def get_stats(
        cls, 
        involved_emp_id: Optional[str] = None, 
        target_date: Optional[str] = None,
        assigned_to: Optional[str] = None,
        assigned_by: Optional[str] = None,
        team_employee_ids: Optional[list[str]] = None,
        task_category: Optional[str] = None,
        sub_category: Optional[str] = None,
        project_id: Optional[str] = None,
        priority: Optional[str] = None,
        search: Optional[str] = None
    ):
        collection = await cls.get_collection()
        
        from app.database.db import get_database
        db = get_database()
        archived_projs = await db["projects"].find({"is_archived": True}, {"_id": 1}).to_list(length=10000)
        archived_proj_ids = []
        for p in archived_projs:
            archived_proj_ids.append(str(p["_id"]))
            archived_proj_ids.append(p["_id"])

        base_query = {
            "is_deleted": False, 
            "is_archived": {"$ne": True},
            # Audio 19: Exclude completed automated tasks from stats entirely
            "$nor": [{"content_item_id": {"$exists": True, "$ne": None}, "status": {"$in": ["completed", "done"]}}]
        }
        if archived_proj_ids:
            base_query["project_id"] = {"$nin": archived_proj_ids}
        if involved_emp_id:
            base_query["$or"] = [
                {"assigned_to": involved_emp_id},
                {"assigned_by": involved_emp_id},
                {"transfer_request.requested_to": involved_emp_id},
                {"transfer_request.requested_by": involved_emp_id},
                {"transfer_history.to_employee": involved_emp_id},
                {"transfer_history.from_employee": involved_emp_id},
            ]
        
        if assigned_to:
            base_query["assigned_to"] = assigned_to
        if assigned_by:
            base_query["assigned_by"] = assigned_by
        if team_employee_ids is not None:
            base_query["assigned_to"] = {"$in": team_employee_ids}
        if task_category and task_category != "All":
            base_query["task_category"] = task_category
        if priority and priority != "All":
            base_query["priority"] = priority.lower()
        if search and search.strip():
            base_query["title"] = {"$regex": search.strip(), "$options": "i"}
        if project_id and project_id != "All":
            base_query["project_id"] = project_id
        if sub_category and sub_category != "All":
            import re as _re
            stage = sub_category.strip()
            stage_roles = {
                "script": ["scripting"],
                "scripting": ["scripting"],
                "shoot": ["shoot_videography"],
                "editing": ["reel_editing", "post_graphics"],
                "thumbnail": ["thumbnail"],
                "caption": ["caption"],
                "approval": ["approval_qc"],
                "posting": ["posting_publisher"],
                "post/graphics": ["post_graphics"],
                "post graphics": ["post_graphics"],
                "graphics": ["post_graphics"],
                "brand person": ["brand_person"],
            }
            stage_or = [{"sub_category": {"$regex": f"^{_re.escape(stage)}$", "$options": "i"}}]
            roles = stage_roles.get(stage.lower())
            if roles:
                stage_or.append({"creative_role": {"$in": roles}})
            base_query["$or"] = stage_or
        
        if target_date:
            try:
                ref_date = datetime.strptime(target_date.strip(), "%Y-%m-%d")
            except Exception:
                ref_date = datetime.utcnow() + timedelta(hours=5, minutes=30)
        else:
            ref_date = datetime.utcnow() + timedelta(hours=5, minutes=30)

        start_of_today = datetime(ref_date.year, ref_date.month, ref_date.day)
        end_of_today = datetime(ref_date.year, ref_date.month, ref_date.day, 23, 59, 59, 999999)
        today_str = ref_date.strftime("%Y-%m-%d")

        # Single round-trip facet with filter-wise KPIs
        facet_res = await collection.aggregate([
            {"$match": base_query},
            {"$facet": {
                "total": [{"$count": "n"}],
                "todo": [{"$match": {"status": "todo"}}, {"$count": "n"}],
                "inprogress": [{"$match": {"status": "inprogress"}}, {"$count": "n"}],
                "inreview": [{"$match": {"status": {"$in": ["inreview", "review"]}}}, {"$count": "n"}],
                "completed": [{"$match": {"status": {"$in": ["completed", "done"]}, "content_item_id": {"$in": [None, ""]}}}, {"$count": "n"}],
                "today": [{"$match": {"$or": [{"due_date": {"$gte": start_of_today, "$lte": end_of_today}}, {"due_date": today_str}]}}, {"$count": "n"}],
                "overdue": [{"$match": {"$or": [{"due_date": {"$lt": start_of_today}}, {"due_date": {"$type": "string", "$lt": today_str}}], "status": {"$nin": ["completed", "done"]}}}, {"$count": "n"}],
                "upcoming": [{"$match": {"$or": [{"due_date": {"$gt": end_of_today}}, {"due_date": {"$type": "string", "$gt": today_str}}], "status": {"$nin": ["completed", "done"]}}}, {"$count": "n"}],
                "client_issue": [{"$match": {"$or": [{"task_category": "Client Issue"}, {"title": {"$regex": "^\\[client issue\\]", "$options": "i"}}, {"is_client_issue": True}]}}, {"$count": "n"}],
                "pending": [{"$match": {"$or": [{"task_category": "Pending"}, {"title": {"$regex": "^\\[pending\\]", "$options": "i"}}, {"is_pending_issue": True}]}}, {"$count": "n"}]
            }},
        ]).to_list(length=1)

        def _n(key: str) -> int:
            try:
                arr = (facet_res[0] if facet_res else {}).get(key, [])
                return int(arr[0].get("n", 0)) if arr else 0
            except Exception:
                return 0

        return {
            "total": _n("total"),
            "todo": _n("todo"),
            "inprogress": _n("inprogress"),
            "inreview": _n("inreview"),
            "completed": _n("completed"),
            "today": _n("today"),
            "overdue": _n("overdue"),
            "upcoming": _n("upcoming"),
            "client_issue": _n("client_issue"),
            "pending": _n("pending")
        }
        
    @classmethod
    async def get_project_activity_logs(cls, project_id: str, page: int = 1, limit: int = 20):
        collection = await cls.get_collection()
        match_stage = {"$match": {"project_id": project_id, "is_deleted": False, "activity_history": {"$exists": True, "$ne": []}}}
        unwind_stage = {"$unwind": "$activity_history"}
        sort_stage = {"$sort": {"activity_history.timestamp": -1}}
        
        # Count total logs
        count_pipeline = [match_stage, unwind_stage, {"$count": "total"}]
        count_cursor = collection.aggregate(count_pipeline)
        total_logs = 0
        async for doc in count_cursor:
            total_logs = doc["total"]
            
        # Get paginated logs
        skip = (page - 1) * limit
        pipeline = [
            match_stage,
            unwind_stage,
            sort_stage,
            {"$skip": skip},
            {"$limit": limit},
            {"$project": {
                "_id": 0,
                "task_id": {"$toString": "$_id"},
                "task_title": "$title",
                "action": "$activity_history.action",
                "performed_by": "$activity_history.performed_by",
                "performed_by_name": "$activity_history.performed_by_name",
                "timestamp": "$activity_history.timestamp",
                "details": "$activity_history.details"
            }}
        ]
        
        cursor = collection.aggregate(pipeline)
        logs = []
        async for doc in cursor:
            logs.append(doc)
            
        return {
            "data": logs,
            "total": total_logs,
            "page": page,
            "limit": limit,
            "total_pages": (total_logs + limit - 1) // limit if limit > 0 else 1
        }
