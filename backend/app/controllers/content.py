from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional, List
from datetime import datetime, timedelta
import asyncio
import re
import urllib.request
from bson import ObjectId
from app.repository.project import ProjectRepository
from app.repository.content import ContentRepository
from app.schemas.content import (
    ContentItemCreate, 
    ContentItemUpdate, 
    ContentItemResponse, 
    ContentTimelineSettings, 
    BulkAddRequest,
    ContentCalendarResponse
)
from app.schemas.project import ContentCalendarApprovalUpdate, ContentCalendarApproval
from app.schemas.pagination import PaginatedResponse
from app.services.content import ContentService
from app.services.project import ProjectService
from app.controllers.auth import get_current_employee
from app.redis.service import get_cache, set_cache, clear_pattern, make_list_key

router = APIRouter(prefix="/projects", tags=["Content Calendar"])

@router.get("/{project_id}/content/settings", response_model=ContentTimelineSettings)
async def get_content_settings(
    project_id: str,
    current_user: dict = Depends(get_current_employee)
):
    cache_key = f"content:{project_id}:settings"
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    result = await ContentService.get_settings(project_id)
    if result:
        await set_cache(cache_key, result, ttl=120)
    return result

@router.put("/{project_id}/content/settings", response_model=ContentTimelineSettings)
async def update_content_settings(
    project_id: str,
    settings: ContentTimelineSettings,
    current_user: dict = Depends(get_current_employee)
):
    if settings.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Project ID mismatch")
    res = await ContentService.update_settings(project_id, settings)
    await clear_pattern(f"content:{project_id}:*")
    import asyncio
    asyncio.create_task(ContentService.sync_monthly_cc_creation_tasks())
    return res

@router.post("/{project_id}/content", response_model=ContentItemResponse, status_code=status.HTTP_201_CREATED)
async def create_content_item(
    project_id: str, 
    data: ContentItemCreate, 
    current_user: dict = Depends(get_current_employee)
):
    if data.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Project ID mismatch")
        
    emp_id = str(current_user.get("_id") or current_user.get("id"))
    created = await ContentService.create_content(project_id, data, emp_id)
    if not created:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    await clear_pattern(f"content:{project_id}:*")
    await clear_pattern("projects:*")
    await clear_pattern("tasks:*")
    return await ContentService.get_content_by_id(created["_id"])

@router.post("/{project_id}/content/bulk", response_model=List[ContentItemResponse], status_code=status.HTTP_201_CREATED)
async def bulk_add_content_items(
    project_id: str,
    data: BulkAddRequest,
    current_user: dict = Depends(get_current_employee)
):
    target_dates = []
    
    if data.specific_dates:
        target_dates.extend(data.specific_dates)
        
    if data.date_range:
        current_date = data.date_range.start_date
        end_date = data.date_range.end_date
        while current_date <= end_date:
            if current_date.weekday() in data.date_range.weekdays:
                target_dates.append(current_date)
            current_date += timedelta(days=1)
            
    if not target_dates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No valid dates provided for bulk add")
        
    # Remove duplicates and sort
    target_dates = sorted(list(set(target_dates)))
    
    created_items = []
    for dt in target_dates:
        new_item = ContentItemCreate(
            project_id=project_id,
            schedule_date=dt,
            content_type=data.default_format,
            topic_title="Untitled Idea"
        )
        emp_id = str(current_user.get("_id") or current_user.get("id"))
        created = await ContentService.create_content(project_id, new_item, emp_id)
        if created:
            item = await ContentService.get_content_by_id(created["_id"])
            if item:
                created_items.append(item)

    if created_items:
        await clear_pattern(f"content:{project_id}:*")
        await clear_pattern("projects:*")
        await clear_pattern("tasks:*")
    return created_items

@router.post("/{project_id}/content/batch", response_model=List[ContentItemResponse], status_code=status.HTTP_201_CREATED)
async def batch_create_content_items(
    project_id: str,
    items: List[ContentItemCreate],
    current_user: dict = Depends(get_current_employee)
):
    if not items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No content items provided in batch")
        
    created_items = []
    user_id = str(current_user.get("_id") or current_user.get("id"))
    for item_data in items:
        if item_data.project_id != project_id:
            item_data.project_id = project_id
        created = await ContentService.create_content(project_id, item_data, user_id)
        if created:
            item = await ContentService.get_content_by_id(created["_id"])
            if item:
                created_items.append(item)
                
    if created_items:
        await clear_pattern(f"content:{project_id}:*")
        await clear_pattern("projects:*")
        await clear_pattern("tasks:*")
    return created_items

@router.get("/{project_id}/content", response_model=ContentCalendarResponse)
async def get_all_content_items(
    project_id: str,
    page: Optional[int] = Query(None, ge=1, description="Page number"),
    limit: Optional[int] = Query(None, ge=1, description="Items per page"),
    content_type: Optional[List[str]] = Query(None, description="Filter by Content Type(s)"),
    status: Optional[List[str]] = Query(None, description="Filter by Approval Status(es)"),
    month: Optional[int] = Query(None, ge=1, le=12, description="Filter by month (1-12)"),
    year: Optional[int] = Query(None, description="Filter by year (e.g., 2026)"),
    start_date: Optional[str] = Query(None, description="Filter by start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="Filter by end date (YYYY-MM-DD)"),
    current_user: dict = Depends(get_current_employee)
):
    STATUS_MAP = {
        "todo": "To Do",
        "to do": "To Do",
        "inprogress": "In Progress",
        "in progress": "In Progress",
        "inreview": "In Review",
        "in review": "In Review",
        "pendingapproval": "Pending Approval",
        "pending approval": "Pending Approval",
        "approved": "Approved",
        "published": "Published",
        "cancelled": "Cancelled"
    }
    TYPE_MAP = {
        "reel": "Reel",
        "post": "Post",
        "story": "Story"
    }
    
    if content_type:
        content_type = [TYPE_MAP.get(v.lower(), v.title()) for v in content_type]
    if status:
        status = [STATUS_MAP.get(v.lower(), v.title()) for v in status]

    cache_key = make_list_key(
        f"content:{project_id}",
        page=page,
        limit=limit,
        month=month,
        year=year,
        start_date=start_date,
        end_date=end_date,
        content_type=",".join(sorted(content_type)) if content_type else None,
        status=",".join(sorted(status)) if status else None
    )
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    result = await ContentService.get_all_content(
        project_id=project_id,
        content_type=content_type,
        status=status,
        month=month,
        year=year,
        start_date=start_date,
        end_date=end_date,
        page=page,
        limit=limit
    )
    await set_cache(cache_key, result, ttl=1800)
    return result

@router.get("/{project_id}/content/approval", response_model=Optional[ContentCalendarApproval])
async def get_monthly_approval(
    project_id: str,
    month: int = Query(..., ge=1, le=12),
    year: int = Query(...),
    current_user: dict = Depends(get_current_employee)
):
    cache_key = f"content:{project_id}:approval:{year}:{month}"
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    project = await ProjectService.get_project_by_id(project_id)
    if not project:
        return None
        
    approvals = project.get("content_approvals", [])
    for approval in approvals:
        if approval.get("month") == month and approval.get("year") == year:
            await set_cache(cache_key, approval, ttl=60)
            return approval
            
    return None

@router.put("/{project_id}/content/approval", response_model=ContentCalendarApproval)
async def update_monthly_approval(
    project_id: str,
    data: ContentCalendarApprovalUpdate,
    current_user: dict = Depends(get_current_employee)
):
    project = await ProjectService.get_project_by_id(project_id)
    if not project or project.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
        
    emp_id = str(current_user.get("_id") or current_user.get("id"))
    updated_approval = await ProjectService.update_content_approval(project_id, data, current_user_id=emp_id)
    
    if not updated_approval:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to update approval status")

    await clear_pattern(f"content:{project_id}:*")
    await clear_pattern("projects:*")
    return updated_approval

@router.get("/{project_id}/content/{content_id}", response_model=ContentItemResponse)
async def get_content_item_by_id(
    project_id: str,
    content_id: str,
    current_user: dict = Depends(get_current_employee)
):
    if not ObjectId.is_valid(content_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid content ID format")

    cache_key = f"content:{project_id}:item:{content_id}"
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    item = await ContentService.get_content_by_id(content_id)
    if not item or item.get("project_id") != project_id or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content item not found")
        
    await set_cache(cache_key, item, ttl=120)
    return item

@router.put("/{project_id}/content/{content_id}", response_model=ContentItemResponse)
async def update_content_item(
    project_id: str,
    content_id: str,
    data: ContentItemUpdate,
    current_user: dict = Depends(get_current_employee)
):
    if not ObjectId.is_valid(content_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid content ID format")
    item = await ContentService.get_content_by_id(content_id)
    if not item or item.get("project_id") != project_id or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content item not found")
        
    emp_id = str(current_user.get("_id") or current_user.get("id"))
    updated = await ContentService.update_content(content_id, data, current_user_id=emp_id)
    
    if not updated:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to update content item")

    await clear_pattern(f"content:{project_id}:*")
    await clear_pattern("projects:*")
    await clear_pattern("tasks:*")
    return await ContentService.get_content_by_id(content_id)

@router.delete("/{project_id}/content/{content_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_content_item(
    project_id: str,
    content_id: str,
    current_user: dict = Depends(get_current_employee)
):
    if not ObjectId.is_valid(content_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid content ID format")
    item = await ContentService.get_content_by_id(content_id)
    if not item or item.get("project_id") != project_id or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content item not found")
        
    emp_id = str(current_user.get("_id") or current_user.get("id"))
    success = await ContentService.delete_content(content_id, current_user_id=emp_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to delete content item")

    await clear_pattern(f"content:{project_id}:*")
    await clear_pattern("projects:*")
    await clear_pattern("tasks:*")


# -------------------------------------------------------------
# Public Client Review Router (Magic Link for Clients - No Login Required)
# -------------------------------------------------------------
_DRIVE_FOLDER_CACHE = {}

def _fetch_folder_file_ids_sync(folder_id: str) -> list:
    if folder_id in _DRIVE_FOLDER_CACHE:
        return _DRIVE_FOLDER_CACHE[folder_id]
    try:
        embed_url = f"https://drive.google.com/embeddedfolderview?id={folder_id}#grid"
        req = urllib.request.Request(embed_url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
        html = urllib.request.urlopen(req, timeout=5).read().decode('utf-8', errors='ignore')
        raw_ids = (
            re.findall(r'id=([a-zA-Z0-9_-]{25,45})', html) +
            re.findall(r'/file/d/([a-zA-Z0-9_-]{25,45})', html)
        )
        ids = [x for x in dict.fromkeys(raw_ids) if x != folder_id]
        _DRIVE_FOLDER_CACHE[folder_id] = ids
        return ids
    except Exception as e:
        print(f"Error fetching drive folder {folder_id}: {e}")
        return []

public_router = APIRouter(prefix="/public/content-review", tags=["Public Client Content Review"])

@public_router.get("/{project_id}")
async def get_public_content_review(
    project_id: str,
    month: Optional[str] = Query(None, description="Month in YYYY-MM format, 'Current', or 'All'")
):
    project = await ProjectRepository.get_by_id(project_id)
    if not project or project.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    # Fetch all content items for this project
    all_res = await ContentService.get_all_content(project_id=project_id, page=None, limit=None)
    all_items = all_res.get("data", [])

    # Extract all unique months from items
    months_set = set()
    for itm in all_items:
        s_date = str(itm.get("schedule_date") or "").split("T")[0]
        if len(s_date) >= 7:
            months_set.add(s_date[:7])
    available_months = sorted(list(months_set), reverse=True)

    # Determine target month
    target_month = month
    current_ym = datetime.utcnow().strftime("%Y-%m")
    if not target_month or target_month == "Current":
        if current_ym in available_months:
            target_month = current_ym
        elif available_months:
            target_month = available_months[0]
        else:
            target_month = current_ym

    # Filter items
    if target_month == "All":
        filtered_items = all_items
    else:
        filtered_items = [
            itm for itm in all_items 
            if str(itm.get("schedule_date") or "").startswith(target_month)
        ]

    # Clean project representation for public view
    proj_summary = {
        "id": str(project.get("_id") or project_id),
        "name": project.get("name") or project.get("title") or "Content Calendar",
        "client_name": project.get("client_name") or (project.get("client") or {}).get("name") or "",
        "company_name": project.get("company_name") or (project.get("client") or {}).get("company") or "",
        "category": project.get("category") or "",
        "status": project.get("general", {}).get("status") if isinstance(project.get("general"), dict) else project.get("status", "Active")
    }

    # Clean item representation
    cleaned_items = []
    for itm in filtered_items:
        s_date = str(itm.get("schedule_date") or "").split("T")[0]
        
        # Robust reference resolution (check reference_link, reference, reference_text)
        raw_ref = str(itm.get("reference_link") or itm.get("reference") or itm.get("reference_text") or "").strip()
        if raw_ref in ["-", "--", "None", "null", "Not Required", "N/A", "not required", "none", "Done", "done"]:
            raw_ref = ""
        
        # Topic description / notes
        topic_desc = str(itm.get("topic_description") or "").strip()
        if topic_desc in ["-", "--", "None", "null", "Not Required", "N/A", "none"]:
            topic_desc = ""

        # Carousel / multi-image links
        raw_carousel = itm.get("carousel_images") or itm.get("images") or itm.get("media") or itm.get("files") or itm.get("carousel") or []
        if isinstance(raw_carousel, str):
            raw_carousel = [u.strip() for u in raw_carousel.split() if u.strip().startswith("http") or u.strip().startswith("/")]
        elif not isinstance(raw_carousel, list):
            raw_carousel = []

        # Check for Google Drive folder link in any media field and resolve file IDs inside it
        combined_links = " ".join([str(v) for v in [itm.get("editing"), itm.get("final_post_link"), itm.get("final_reel_link"), itm.get("thumbnail"), itm.get("carousel_images")]])
        folder_matches = re.findall(r'drive\.google\.com/drive/folders/([a-zA-Z0-9_-]+)', combined_links)
        for folder_id in dict.fromkeys(folder_matches):
            folder_file_ids = await asyncio.to_thread(_fetch_folder_file_ids_sync, folder_id)
            if folder_file_ids:
                folder_urls = [f"https://drive.google.com/file/d/{fid}/view" for fid in folder_file_ids]
                raw_carousel = folder_urls + [u for u in raw_carousel if u not in folder_urls]

        cleaned_items.append({
            "id": str(itm.get("_id")),
            "topic": itm.get("topic_title") or "Untitled",
            "type": itm.get("content_type") or "Post",
            "posting_date": s_date,
            "status": itm.get("approval_status") or "To Do",
            "caption": itm.get("caption_text") or "",
            "reference_link": raw_ref,
            "topic_description": topic_desc,
            "final_post_link": itm.get("final_post_link") or "",
            "final_reel_link": itm.get("final_reel_link") or "",
            "instagram_link": itm.get("instagram_link") or "",
            "thumbnail": itm.get("thumbnail") or {},
            "script": itm.get("script") or {},
            "editing": itm.get("editing") or {},
            "shoot": itm.get("shoot") or {},
            "carousel_images": raw_carousel,
            "issues": itm.get("issues") or [],
            "remark": itm.get("remark") or "",
            "revisions": itm.get("revisions") or [],
            "feedback_notes": itm.get("feedback_notes") or []
        })

    return {
        "project": proj_summary,
        "selected_month": target_month,
        "available_months": available_months,
        "items": cleaned_items,
        "total_count": len(cleaned_items),
        "approved_count": len([i for i in cleaned_items if i["status"] == "Approved"])
    }


@public_router.post("/{project_id}/action")
async def execute_public_content_action(
    project_id: str,
    payload: dict
):
    project = await ProjectRepository.get_by_id(project_id)
    if not project or project.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    action = payload.get("action")
    client_name = payload.get("client_name") or "Client (Public Link)"

    if action == "approve_all":
        month = payload.get("month")
        all_res = await ContentService.get_all_content(project_id=project_id, page=None, limit=None)
        items_to_approve = all_res.get("data", [])
        if month and month != "All":
            items_to_approve = [i for i in items_to_approve if str(i.get("schedule_date") or "").startswith(month)]

        for itm in items_to_approve:
            iid = str(itm["_id"])
            await ContentRepository.update(iid, {
                "approval_status": "Approved",
                "approved_by": client_name
            })
            # Log history on item
            logs = list(itm.get("logs") or [])
            logs.append({
                "userName": client_name,
                "action": "Status changed to Approved (Client Portal)",
                "timestamp": datetime.utcnow().isoformat(),
                "details": f"Bulk approved via Public Client Review Portal ({month or 'All'})"
            })
            await ContentRepository.update(iid, {"logs": logs})

        await clear_pattern(f"content:{project_id}:*")
        await clear_pattern("projects:*")
        return {"success": True, "message": f"Successfully approved {len(items_to_approve)} items"}

    elif action == "approve_item":
        item_id = payload.get("item_id")
        if not item_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="item_id is required")
        itm = await ContentRepository.get_by_id(item_id)
        if not itm or itm.get("project_id") != project_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content item not found")

        logs = list(itm.get("logs") or [])
        logs.append({
            "userName": client_name,
            "action": "Status changed to Approved",
            "timestamp": datetime.utcnow().isoformat(),
            "details": "Approved via Public Client Review Portal"
        })
        await ContentRepository.update(item_id, {
            "approval_status": "Approved",
            "approved_by": client_name,
            "logs": logs
        })
        await clear_pattern(f"content:{project_id}:*")
        await clear_pattern("projects:*")
        return {"success": True, "message": "Item approved successfully"}

    elif action in ("request_change", "add_feedback"):
        item_id = payload.get("item_id")
        feedback = (payload.get("feedback") or "").strip()
        timestamp_label = (payload.get("timestamp_label") or "").strip()
        timestamp_seconds = payload.get("timestamp_seconds")
        slide_index = payload.get("slide_index")
        pin_x = payload.get("pin_x")
        pin_y = payload.get("pin_y")
        feedback_tag = (payload.get("feedback_tag") or "").strip()
        if not item_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="item_id is required")
        if not feedback:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Feedback is required for changes")

        itm = await ContentRepository.get_by_id(item_id)
        if not itm or itm.get("project_id") != project_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content item not found")

        now_iso = datetime.utcnow().isoformat()
        prefix_parts = []
        if timestamp_label:
            prefix_parts.append(timestamp_label)
        if slide_index is not None:
            prefix_parts.append(f"Slide {int(slide_index) + 1}")
        if feedback_tag:
            prefix_parts.append(feedback_tag)
        formatted_text = f"[{' • '.join(prefix_parts)}] {feedback}" if prefix_parts else feedback

        # Append client issue
        existing_issues = list(itm.get("issues") or [])
        new_issue = {
            "id": f"cli-iss-{int(datetime.utcnow().timestamp())}",
            "text": formatted_text,
            "role": "Brand Person",
            "author": client_name,
            "isClientIssue": True,
            "issueType": "client_issue",
            "isPending": False,
            "timestamp": now_iso,
            "timestamp_label": timestamp_label or None,
            "timestamp_seconds": timestamp_seconds,
            "slide_index": slide_index,
            "pin_x": pin_x,
            "pin_y": pin_y,
            "feedback_tag": feedback_tag or None
        }
        existing_issues.append(new_issue)

        # Structured feedback notes for timestamped video & visual pin review
        existing_notes = list(itm.get("feedback_notes") or [])
        new_note = {
            "id": new_issue["id"],
            "text": feedback,
            "author": client_name,
            "timestamp_label": timestamp_label or None,
            "timestamp_seconds": timestamp_seconds,
            "slide_index": slide_index,
            "pin_x": pin_x,
            "pin_y": pin_y,
            "feedback_tag": feedback_tag or None,
            "created_at": now_iso
        }
        existing_notes.append(new_note)

        logs = list(itm.get("logs") or [])
        logs.append({
            "userName": client_name,
            "action": "Client Feedback Added" if action == "add_feedback" else "Client Change Requested",
            "timestamp": now_iso,
            "details": f"Client feedback: {formatted_text}"
        })

        update_fields = {
            "issues": existing_issues,
            "feedback_notes": existing_notes,
            "logs": logs
        }
        if action == "request_change":
            update_fields["approval_status"] = "In Progress" if itm.get("approval_status") == "Approved" else itm.get("approval_status", "In Progress")

        await ContentRepository.update(item_id, update_fields)

        # Sync tasks for content item so assigned team members get notified in Task Management
        try:
            itm["issues"] = existing_issues
            await ContentService._sync_tasks_for_content(item_id, itm, project, current_user_id=None)
        except Exception as e:
            print("Sync task error on client review:", e)

        await clear_pattern(f"content:{project_id}:*")
        await clear_pattern("projects:*")
        await clear_pattern("tasks:*")
        return {"success": True, "message": "Feedback submitted successfully", "note": new_note}

    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unknown action '{action}'")
