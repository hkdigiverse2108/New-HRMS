from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from app.schemas.remark import (
    RemarkCreate, RemarkUpdate, RemarkResponse, RemarkStats, SendReminderRequest,
    RemarkQuestionCreate, RemarkQuestionUpdate, RemarkQuestionResponse
)
from app.services.remark import RemarkService
from app.repository.remark import RemarkRepository
from app.controllers.auth import get_current_employee
from app.redis.service import get_cache, set_cache, clear_pattern, make_list_key

router = APIRouter(prefix="/remarks", tags=["Remarks"])

def is_admin(user: dict) -> bool:
    role = user.get("work_details", {}).get("system_role", "")
    user_id = str(user.get("_id") or user.get("id"))
    return role in ["Admin", "Super Admin"] or user_id == "default-admin-id"

@router.get("/overview", response_model=RemarkStats)
async def get_remark_overview(current_user: dict = Depends(get_current_employee)):
    user_id = str(current_user.get("_id") or current_user.get("id"))
    cache_key = f"remarks:overview:{user_id}"
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    res = await RemarkService.get_overview(current_user)
    await set_cache(cache_key, res, ttl=60)
    return res

@router.post("/send-reminders")
async def send_reminders(data: SendReminderRequest, current_user: dict = Depends(get_current_employee)):
    if not is_admin(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can send reminders")
    count = await RemarkService.send_reminders(data, current_user)
    await clear_pattern("remarks:*")
    return {"message": f"Reminders sent successfully to {count} employees."}

@router.post("", response_model=RemarkResponse, status_code=status.HTTP_201_CREATED)
async def create_remark(data: RemarkCreate, current_user: dict = Depends(get_current_employee)):
    res = await RemarkService.create_remark(data, current_user)
    await clear_pattern("remarks:*")
    return res

@router.get("", response_model=List[RemarkResponse])
async def get_all_remarks(
    search: Optional[str] = Query(None, description="Search by department or submitter"),
    submission_rate: bool = Query(False, description="Filter by Submission Rate"),
    avg_satisfaction: bool = Query(False, description="Filter by Avg Satisfaction"),
    current_user: dict = Depends(get_current_employee)
):
    user_id = str(current_user.get("_id") or current_user.get("id"))
    cache_key = make_list_key(
        f"remarks:list:{user_id}",
        search=search,
        submission_rate=submission_rate,
        avg_satisfaction=avg_satisfaction
    )
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    res = await RemarkService.get_all_remarks(current_user, search, submission_rate, avg_satisfaction)
    await set_cache(cache_key, res, ttl=120)
    return res

@router.get("/{remark_id}", response_model=RemarkResponse)
async def get_remark_by_id(remark_id: str, current_user: dict = Depends(get_current_employee)):
    user_id = str(current_user.get("_id") or current_user.get("id"))
    cache_key = f"remarks:item:{remark_id}:{user_id}"
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    remark = await RemarkService.get_remark_by_id(remark_id, current_user)
    if not remark:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Remark not found or access denied")
    await set_cache(cache_key, remark, ttl=180)
    return remark

@router.put("/{remark_id}", response_model=RemarkResponse)
async def update_remark(remark_id: str, data: RemarkUpdate, current_user: dict = Depends(get_current_employee)):
    remark = await RemarkService.update_remark(remark_id, data, current_user)
    if not remark:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Remark not found or access denied")
    await clear_pattern("remarks:*")
    return remark

@router.delete("/{remark_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_remark(remark_id: str, current_user: dict = Depends(get_current_employee)):
    success = await RemarkService.delete_remark(remark_id, current_user)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Remark not found or access denied")
    await clear_pattern("remarks:*")

@router.post("/questions", response_model=RemarkQuestionResponse, status_code=status.HTTP_201_CREATED)
async def create_question(data: RemarkQuestionCreate, current_user: dict = Depends(get_current_employee)):
    if not is_admin(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can manage questions")
    res = await RemarkRepository.create_question(data.dict())
    await clear_pattern("remarks:*")
    return res

@router.get("/questions/all", response_model=List[RemarkQuestionResponse])
async def get_all_questions(current_user: dict = Depends(get_current_employee)):
    cache_key = "remarks:questions:all"
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    res = await RemarkRepository.get_all_questions()
    await set_cache(cache_key, res, ttl=300)
    return res

@router.get("/questions/{question_id}", response_model=RemarkQuestionResponse)
async def get_question_by_id(question_id: str, current_user: dict = Depends(get_current_employee)):
    cache_key = f"remarks:question:{question_id}"
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    question = await RemarkRepository.get_question_by_id(question_id)
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
    await set_cache(cache_key, question, ttl=300)
    return question

@router.put("/questions/{question_id}", response_model=RemarkQuestionResponse)
async def update_question(question_id: str, data: RemarkQuestionUpdate, current_user: dict = Depends(get_current_employee)):
    if not is_admin(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can manage questions")
    update_data = data.dict(exclude_unset=True)
    if not update_data:
        return await RemarkRepository.get_question_by_id(question_id)
    updated = await RemarkRepository.update_question(question_id, update_data)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
    await clear_pattern("remarks:*")
    return updated

@router.delete("/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_question(question_id: str, current_user: dict = Depends(get_current_employee)):
    if not is_admin(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can manage questions")
    success = await RemarkRepository.delete_question(question_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
    await clear_pattern("remarks:*")
