import asyncio

async def check_roles():
    import sys
    sys.path.append('D:/New-HRMS/backend')
    from app.repository.task import TaskRepository
    from bson import ObjectId
    
    collection = await TaskRepository.get_collection()
    db = collection.database
    
    roles = ["scripting", "caption", "approval_qc", "posting_publisher"]
    for r in roles:
        tasks = await collection.find({
            "is_deleted": False,
            "is_archived": {"$ne": True},
            "$nor": [{"content_item_id": {"$exists": True, "$ne": None}, "status": {"$in": ["completed", "done"]}}],
            "creative_role": r
        }).to_list(100)
        print(f"\n--- Role: {r} (Active count: {len(tasks)}) ---")
        for t in tasks:
            aid = str(t.get("assigned_to"))
            emp = await db["employees"].find_one({"_id": ObjectId(aid)}) if ObjectId.is_valid(aid) else None
            emp_name = (emp.get("personal_details", {}).get("first_name", "") + " " + emp.get("personal_details", {}).get("last_name", "")) if emp else "Unknown"
            emp_dept = emp.get("work_details", {}).get("department") if emp else "Unknown"
            print(f"  Title: {t.get('title')} | Assigned to: {emp_name} ({aid}) | Dept: {emp_dept} | Status: {t.get('status')}")

asyncio.run(check_roles())

