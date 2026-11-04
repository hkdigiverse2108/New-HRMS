import asyncio

async def inspect_68_tasks():
    import sys
    sys.path.append('D:/New-HRMS/backend')
    from app.repository.task import TaskRepository
    from app.repository.employee import EmployeeRepository
    
    collection = await TaskRepository.get_collection()
    db = collection.database
    
    dept_emps = await EmployeeRepository.get_all_employees(department='Creative', limit=1000)
    dept_emp_ids = [str(e["_id"]) for e in dept_emps.get("data", [])] + [e["_id"] for e in dept_emps.get("data", [])]
    
    archived_projs = await db["projects"].find({"is_archived": True}, {"_id": 1}).to_list(length=10000)
    archived_proj_ids = [str(p["_id"]) for p in archived_projs] + [p["_id"] for p in archived_projs]

    exclude_issue_cond = {
        "task_category": {"$nin": ["Client Issue", "Pending"]},
        "is_client_issue": {"$ne": True},
        "is_pending_issue": {"$ne": True},
        "status": {"$nin": ["client_issue", "pending", "Client Issue", "Pending"]},
        "title": {"$not": {"$regex": r"^\[(client issue|pending)\]", "$options": "i"}}
    }

    base_query = {
        "is_deleted": False,
        "is_archived": {"$ne": True},
        "$nor": [{"content_item_id": {"$exists": True, "$ne": None}, "status": {"$in": ["completed", "done"]}}],
        "assigned_to": {"$in": dept_emp_ids},
        **exclude_issue_cond
    }
    if archived_proj_ids:
        base_query["project_id"] = {"$nin": archived_proj_ids}
        
    tasks = await collection.find(base_query).to_list(200)
    print(f"Total matching tasks: {len(tasks)}")
    
    # Let's inspect sub_category, creative_role, task_category, content_item_id
    breakdown = {}
    for t in tasks:
        sc = t.get("sub_category")
        cr = t.get("creative_role")
        key = f"sub_category: '{sc}' | creative_role: '{cr}'"
        breakdown[key] = breakdown.get(key, 0) + 1
        
    print("\n--- Breakdown of the 68 tasks ---")
    for k, v in sorted(breakdown.items(), key=lambda x: -x[1]):
        print(f"  {k} => {v} tasks")
        
    print("\n--- Tasks with sub_category None or empty ---")
    for t in tasks:
        if not t.get("sub_category"):
            safe_title = t.get('title', '').encode('ascii', 'replace').decode('ascii')
            print(f"  ID: {t['_id']} | Title: {safe_title} | creative_role: {t.get('creative_role')} | content_item_id: {t.get('content_item_id')}")

asyncio.run(inspect_68_tasks())

