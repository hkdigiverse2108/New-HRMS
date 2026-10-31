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
            match_assignees = [str(assigned_to)]
            if ObjectId.is_valid(str(assigned_to)):
                match_assignees.append(ObjectId(str(assigned_to)))
            and_conditions.append({
                "$or": [
                    {"assigned_to": {"$in": match_assignees}},
                    {"transfer_request.requested_to": {"$in": match_assignees}, "transfer_request.status": "pending"}
                ]
            })
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
            s_clean = sub_category.strip().lower()
            if s_clean in ["editing", "video editing", "reel editing", "video"]:
                and_conditions.append({"$or": [{"sub_category": {"$regex": "^(editing|video editing|reel editing)$", "$options": "i"}}, {"creative_role": "reel_editing"}]})
            elif s_clean in ["post/graphics", "post graphics", "graphics", "post"]:
                and_conditions.append({"$or": [{"sub_category": {"$regex": "^(post/graphics|post graphics|graphics|post)$", "$options": "i"}}, {"creative_role": "post_graphics"}]})
            elif "script" in s_clean:
                and_conditions.append({"$or": [{"sub_category": {"$regex": "^script", "$options": "i"}}, {"creative_role": "scripting"}]})
            elif "shoot" in s_clean:
                and_conditions.append({"$or": [{"sub_category": {"$regex": "^shoot", "$options": "i"}}, {"creative_role": "shoot_videography"}]})
            elif "caption" in s_clean:
                and_conditions.append({"$or": [{"sub_category": {"$regex": "^caption", "$options": "i"}}, {"creative_role": "caption"}]})
            elif "thumb" in s_clean:
                and_conditions.append({"$or": [{"sub_category": {"$regex": "^thumb", "$options": "i"}}, {"creative_role": "thumbnail"}]})
            elif "approval" in s_clean:
                and_conditions.append({"$or": [{"sub_category": {"$regex": "^approval", "$options": "i"}}, {"creative_role": "approval_qc"}]})
            elif "posting" in s_clean:
                and_conditions.append({"$or": [{"sub_category": {"$regex": "^posting", "$options": "i"}}, {"creative_role": "posting_publisher"}]})
            else:
                and_conditions.append({"sub_category": {"$regex": f"^{_re.escape(sub_category.strip())}$", "$options": "i"}})
            
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
        search: Optional[str] = None,
        timeline_filter: Optional[str] = None,
        status: Optional[str] = None
    ):
        collection = await cls.get_collection()
        
        from app.database.db import get_database
        db = get_database()
        archived_projs = await db["projects"].find({"is_archived": True}, {"_id": 1}).to_list(length=10000)
        archived_proj_ids = []
        for p in archived_projs:
            archived_proj_ids.append(str(p["_id"]))
            archived_proj_ids.append(p["_id"])

        common_conditions = [
            {"is_deleted": False},
            {"is_archived": {"$ne": True}},
            # Audio 19: Exclude completed automated tasks from stats entirely
            {"$nor": [{"content_item_id": {"$exists": True, "$ne": None}, "status": {"$in": ["completed", "done"]}}]}
        ]
        if archived_proj_ids:
            common_conditions.append({"project_id": {"$nin": archived_proj_ids}})
        if involved_emp_id:
            common_conditions.append({
                "$or": [
                    {"assigned_to": involved_emp_id},
                    {"assigned_by": involved_emp_id},
                    {"transfer_request.requested_to": involved_emp_id},
                    {"transfer_request.requested_by": involved_emp_id},
                    {"transfer_history.to_employee": involved_emp_id},
                    {"transfer_history.from_employee": involved_emp_id},
                ]
            })
        
        if assigned_to:
            match_assignees = [str(assigned_to)]
            if ObjectId.is_valid(str(assigned_to)):
                match_assignees.append(ObjectId(str(assigned_to)))
            common_conditions.append({
                "$or": [
                    {"assigned_to": {"$in": match_assignees}},
                    {"transfer_request.requested_to": {"$in": match_assignees}, "transfer_request.status": "pending"}
                ]
            })
        if assigned_by:
            common_conditions.append({"assigned_by": assigned_by})
        if team_employee_ids is not None:
            common_conditions.append({"assigned_to": {"$in": team_employee_ids}})
        if task_category and task_category != "All":
            common_conditions.append({"task_category": task_category})
        if priority and priority != "All":
            common_conditions.append({"priority": priority.lower()})
        if search and search.strip():
            common_conditions.append({"title": {"$regex": search.strip(), "$options": "i"}})
        if project_id and project_id != "All":
            common_conditions.append({"project_id": project_id})
        
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

        today_work_cond = {
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
        }
        overdue_cond = {
            "$or": [
                {"due_date": {"$lt": start_of_today}},
                {"due_date": {"$type": "string", "$lt": today_str}}
            ],
            "status": {"$nin": ["completed", "done"]}
        }
        upcoming_cond = {
            "$or": [
                {"due_date": {"$gt": end_of_today}},
                {"due_date": {"$type": "string", "$gt": today_str}}
            ],
            "status": {"$nin": ["completed", "done"]}
        }
        client_issue_cond = {
            "$or": [
                {"task_category": "Client Issue"},
                {"title": {"$regex": "^\\[client issue\\]", "$options": "i"}},
                {"is_client_issue": True}
            ]
        }
        pending_cond = {
            "$or": [
                {"task_category": "Pending"},
                {"title": {"$regex": "^\\[pending\\]", "$options": "i"}},
                {"is_pending_issue": True}
            ]
        }

        stage_matchers = {
            "Script": {"$or": [{"sub_category": {"$regex": "^script", "$options": "i"}}, {"creative_role": "scripting"}]},
            "Shoot": {"$or": [{"sub_category": {"$regex": "^shoot", "$options": "i"}}, {"creative_role": "shoot_videography"}]},
            "Editing": {"$or": [{"sub_category": {"$regex": "^(editing|video editing|reel editing)$", "$options": "i"}}, {"creative_role": "reel_editing"}]},
            "Post/Graphics": {"$or": [{"sub_category": {"$regex": "^(post/graphics|post graphics|graphics|post)$", "$options": "i"}}, {"creative_role": "post_graphics"}]},
            "Caption": {"$or": [{"sub_category": {"$regex": "^caption", "$options": "i"}}, {"creative_role": "caption"}]},
            "Thumbnail": {"$or": [{"sub_category": {"$regex": "^thumb", "$options": "i"}}, {"creative_role": "thumbnail"}]},
            "Approval": {"$or": [{"sub_category": {"$regex": "^approval", "$options": "i"}}, {"creative_role": "approval_qc"}]},
            "Posting": {"$or": [{"sub_category": {"$regex": "^posting", "$options": "i"}}, {"creative_role": "posting_publisher"}]}
        }

        timeline_cond = None
        if timeline_filter:
            tf = timeline_filter.lower().strip()
            if tf == "today":
                timeline_cond = today_work_cond
            elif tf == "overdue":
                timeline_cond = overdue_cond
            elif tf == "upcoming":
                timeline_cond = upcoming_cond
            elif tf == "client_issue":
                timeline_cond = client_issue_cond
            elif tf == "pending":
                timeline_cond = pending_cond

        status_cond = None
        if status and status != "All":
            raw_st = status.lower().replace(" ", "").replace("_", "")
            if raw_st in ["todo"]:
                status_cond = {"status": "todo"}
            elif raw_st in ["inprogress"]:
                status_cond = {"status": "inprogress"}
            elif raw_st in ["inreview", "review"]:
                status_cond = {"status": {"$in": ["inreview", "review"]}}
            elif raw_st in ["completed", "done"]:
                status_cond = {"status": {"$in": ["completed", "done"]}}

        def make_stage_match(stage_name: Optional[str] = None):
            conds = []
            if timeline_cond:
                conds.append(timeline_cond)
            if status_cond:
                conds.append(status_cond)
            if stage_name and stage_name in stage_matchers:
                conds.append(stage_matchers[stage_name])
            if not conds:
                return {}
            if len(conds) == 1:
                return conds[0]
            return {"$and": conds}

        # Build subcategory matcher for KPI cards if a subcategory is selected
        sub_cat_match = None
        if sub_category and sub_category != "All":
            sc_lower = sub_category.strip().lower()
            if sc_lower in ["editing", "video editing", "reel editing", "video"]:
                sub_cat_match = stage_matchers["Editing"]
            elif sc_lower in ["post/graphics", "post graphics", "graphics", "post"]:
                sub_cat_match = stage_matchers["Post/Graphics"]
            else:
                matched_stage = None
                for s_name in stage_matchers:
                    if s_name.lower() in sc_lower or sc_lower in s_name.lower():
                        matched_stage = s_name
                        break
                if matched_stage:
                    sub_cat_match = stage_matchers[matched_stage]
                else:
                    import re as _re
                    sub_cat_match = {"sub_category": {"$regex": f"^{_re.escape(sub_category.strip())}$", "$options": "i"}}

        def make_kpi_match(kpi_cond: dict):
            if sub_cat_match:
                return {"$and": [sub_cat_match, kpi_cond]}
            return kpi_cond

        # Single round-trip facet with filter-wise KPIs and dynamic stage counts
        facet_def = {
            "total": [{"$count": "n"}],
            "todo": [{"$match": {"status": "todo"}}, {"$count": "n"}],
            "inprogress": [{"$match": {"status": "inprogress"}}, {"$count": "n"}],
            "inreview": [{"$match": {"status": {"$in": ["inreview", "review"]}}}, {"$count": "n"}],
            "completed": [{"$match": {"status": {"$in": ["completed", "done"]}, "content_item_id": {"$in": [None, ""]}}}, {"$count": "n"}],
            "today": [{"$match": today_work_cond}, {"$count": "n"}],
            "overdue": [{"$match": overdue_cond}, {"$count": "n"}],
            "upcoming": [{"$match": upcoming_cond}, {"$count": "n"}],
            "client_issue": [{"$match": client_issue_cond}, {"$count": "n"}],
            "pending": [{"$match": pending_cond}, {"$count": "n"}],
            # Stage breakdowns (stable counts independent of single subcategory selection)
            "sc_all": [{"$match": make_stage_match()}, {"$count": "n"}],
            "sc_script": [{"$match": make_stage_match("Script")}, {"$count": "n"}],
            "sc_shoot": [{"$match": make_stage_match("Shoot")}, {"$count": "n"}],
            "sc_editing": [{"$match": make_stage_match("Editing")}, {"$count": "n"}],
            "sc_post_graphics": [{"$match": make_stage_match("Post/Graphics")}, {"$count": "n"}],
            "sc_caption": [{"$match": make_stage_match("Caption")}, {"$count": "n"}],
            "sc_thumbnail": [{"$match": make_stage_match("Thumbnail")}, {"$count": "n"}],
            "sc_approval": [{"$match": make_stage_match("Approval")}, {"$count": "n"}],
            "sc_posting": [{"$match": make_stage_match("Posting")}, {"$count": "n"}],
        }

        root_match = {"$and": common_conditions} if len(common_conditions) > 1 else common_conditions[0]
        facet_res = await collection.aggregate([
            {"$match": root_match},
            {"$facet": facet_def},
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
            "pending": _n("pending"),
            "sub_categories": {
                "All": _n("sc_all"),
                "Script": _n("sc_script"),
                "Shoot": _n("sc_shoot"),
                "Editing": _n("sc_editing"),
                "Video Editing": _n("sc_editing"),
                "Post/Graphics": _n("sc_post_graphics"),
                "Post Graphics": _n("sc_post_graphics"),
                "Post": _n("sc_post_graphics"),
                "Graphics": _n("sc_post_graphics"),
                "Caption": _n("sc_caption"),
                "Thumbnail": _n("sc_thumbnail"),
                "Approval": _n("sc_approval"),
                "Posting": _n("sc_posting")
            }
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
