from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, UploadFile, File, Query
from fastapi.responses import FileResponse
from typing import List, Optional
from app.schemas.chat import ChannelCreate, ChannelUpdate, ChannelResponse, MessageResponse, UnreadCountResponse, UserPresenceResponse, UserPresenceBatchRequest, UserProfileCardResponse, ReactionRequest, ForwardMessageRequest
from app.repository.chat import ChatRepository
from app.repository.access_control import UserPermissionRepository
from app.services.websocket_manager import manager
from app.controllers.auth import get_current_employee
from app.controllers.image import IMAGES_DIR
from app.config import BACKEND_DIR
from pydantic import BaseModel
from datetime import datetime
from app.redis.service import delete_cache, clear_pattern
import json
import shutil
import uuid
import re
from pathlib import Path

router = APIRouter(prefix="/chat", tags=["Chat"])

# --- Upload Document/File API ---

MAX_CHAT_FILE_SIZE_MB = 100

@router.post("/upload")
async def upload_chat_file(file: UploadFile = File(...)):
    # Check file size (limit: 100MB)
    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)
    
    if file_size > (MAX_CHAT_FILE_SIZE_MB * 1024 * 1024):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size exceeds the limit of {MAX_CHAT_FILE_SIZE_MB}MB."
        )

    chat_dir = IMAGES_DIR / "chat_documents"
    chat_dir.mkdir(parents=True, exist_ok=True)
    
    raw_name = file.filename or "image.png"
    # Clean up non-ASCII or strange characters from ChatGPT/DALL-E filenames (e.g. middle dots, symbols)
    safe_filename = re.sub(r'[^\w\s\.-]', '_', raw_name).strip() or "chat_file"
    file_ext = Path(safe_filename).suffix.lower()
    
    # If no extension or invalid, infer from content_type
    if not file_ext or file_ext not in [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".pdf", ".mp4", ".webm", ".mp3", ".wav", ".doc", ".docx"]:
        ct = (file.content_type or "").lower()
        if "png" in ct:
            file_ext = ".png"
        elif "jpeg" in ct or "jpg" in ct:
            file_ext = ".jpg"
        elif "webp" in ct:
            file_ext = ".webp"
        elif "gif" in ct:
            file_ext = ".gif"
        elif "pdf" in ct:
            file_ext = ".pdf"
        elif "webm" in ct:
            file_ext = ".webm"
        elif "audio" in ct:
            file_ext = ".webm"
        else:
            file_ext = file_ext or ".png"

    unique_filename = f"{uuid.uuid4().hex}{file_ext}"
    target_path = chat_dir / unique_filename
    
    with target_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    file_url = f"/images/chat_documents/{unique_filename}"
    
    # Ensure correct content_type is returned
    resp_content_type = file.content_type
    if not resp_content_type or resp_content_type == "application/octet-stream":
        if file_ext == ".png":
            resp_content_type = "image/png"
        elif file_ext in (".jpg", ".jpeg"):
            resp_content_type = "image/jpeg"
        elif file_ext == ".webp":
            resp_content_type = "image/webp"

    # Return both new + legacy keys for frontend compatibility (url vs file_url)
    return {
        "file_url": file_url,
        "url": file_url,
        "file_name": safe_filename,
        "fileName": safe_filename,
        "file_type": resp_content_type,
        "media_type": resp_content_type,
        "file_size": file_size,
        "fileSize": file_size
    }

# --- Download File API (forces Save As / attachment header) ---
@router.get("/download")
async def download_chat_file(file_url: str = Query(...), filename: Optional[str] = Query(None)):
    clean = file_url.strip()
    if "://" in clean:
        clean = "/" + clean.split("://", 1)[1].split("/", 1)[1]
    
    rel = clean
    for prefix in ["/images/", "images/", "/uploads/", "uploads/"]:
        if rel.startswith(prefix):
            rel = rel[len(prefix):]
            break
            
    target_path = (IMAGES_DIR / rel).resolve()
    if not str(target_path).startswith(str(IMAGES_DIR.resolve())):
        raise HTTPException(status_code=403, detail="Forbidden")
        
    if not target_path.exists() or not target_path.is_file():
        target_path_alt = (IMAGES_DIR / "chat_documents" / Path(clean).name).resolve()
        if target_path_alt.exists() and target_path_alt.is_file():
            target_path = target_path_alt
        else:
            raise HTTPException(status_code=404, detail="File not found")
            
    download_name = filename or target_path.name
    return FileResponse(
        path=str(target_path),
        filename=download_name,
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{download_name}"',
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )

@router.get("/files/{filename}")
async def serve_chat_file(filename: str):
    clean = Path(filename).name
    target_path = (IMAGES_DIR / "chat_documents" / clean).resolve()
    if not target_path.exists() or not target_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    
    ext = target_path.suffix.lower()
    ct = "application/octet-stream"
    if ext == ".png":
        ct = "image/png"
    elif ext in (".jpg", ".jpeg"):
        ct = "image/jpeg"
    elif ext == ".webp":
        ct = "image/webp"
    elif ext == ".gif":
        ct = "image/gif"
    elif ext == ".svg":
        ct = "image/svg+xml"
    elif ext == ".pdf":
        ct = "application/pdf"
    elif ext in (".mp4", ".mov", ".mkv"):
        ct = "video/mp4"
    elif ext in (".webm", ".mp3", ".wav", ".ogg", ".m4a"):
        ct = "audio/webm"
        
    return FileResponse(path=str(target_path), media_type=ct)

# --- Channels API ---

@router.post("/channels", response_model=ChannelResponse)
async def create_channel(data: ChannelCreate, current_user: dict = Depends(get_current_employee)):
    user_id = str(current_user.get("_id") or current_user.get("id"))
    channel_data = data.model_dump()
    channel_data["created_by"] = user_id
    if user_id not in channel_data["members"]:
        channel_data["members"].append(user_id)
    
    channel = await ChatRepository.create_channel(channel_data)
    return channel

@router.get("/channels", response_model=List[ChannelResponse])
async def get_my_channels(current_user: dict = Depends(get_current_employee)):
    user_id = str(current_user.get("_id") or current_user.get("id"))
    channels = await ChatRepository.get_channels_for_user(user_id)
    return channels

class DmRequest(BaseModel):
    other_user_id: str

@router.post("/channels/dm", response_model=ChannelResponse)
async def get_or_create_dm_channel(data: DmRequest, current_user: dict = Depends(get_current_employee)):
    user_id = str(current_user.get("_id") or current_user.get("id"))
    other_id = str(data.other_user_id)

    db = await ChatRepository.get_db()
    from bson import ObjectId
    other_user_doc = None
    try:
        other_user_doc = await db["employees"].find_one({"_id": ObjectId(other_id)})
    except Exception:
        pass
    if not other_user_doc:
        other_user_doc = await db["employees"].find_one({"id": other_id})

    other_name = other_user_doc.get("name") if other_user_doc else "Direct Message"

    # 1. Look for existing direct channel
    channel = await ChatRepository.get_direct_channel(user_id, other_id)
    if channel:
        if not channel.get("name"):
            channel["name"] = other_name
            ch_id = channel.get("id") or channel.get("_id")
            try:
                await db["chat_channels"].update_one(
                    {"_id": ObjectId(ch_id)},
                    {"$set": {"name": other_name}}
                )
            except Exception:
                pass
        return channel

    new_doc = {
        "name": other_name,
        "type": "direct",
        "members": [user_id, other_id],
        "created_by": user_id,
        "created_at": datetime.utcnow()
    }
    created = await ChatRepository.create_channel(new_doc)
    await delete_cache(f"chat:channels:{user_id}")
    await delete_cache(f"chat:channels:{other_id}")
    return created

@router.put("/channels/{channel_id}")
async def update_channel(channel_id: str, data: ChannelUpdate, current_user: dict = Depends(get_current_employee)):
    user_id = str(current_user.get("_id") or current_user.get("id"))
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    success = await ChatRepository.update_channel(channel_id, update_data, user_id)
    if not success:
        raise HTTPException(status_code=403, detail="Not authorized or channel not found")
    return {"message": "Channel updated"}

@router.delete("/channels/{channel_id}")
async def delete_channel(channel_id: str, current_user: dict = Depends(get_current_employee)):
    user_id = str(current_user.get("_id") or current_user.get("id"))
    success = await ChatRepository.delete_channel(channel_id, user_id)
    if not success:
        raise HTTPException(status_code=403, detail="Not authorized or channel not found")
    return {"message": "Channel deleted"}

@router.get("/channels/{channel_id}", response_model=ChannelResponse)
async def get_channel_detail(channel_id: str, current_user: dict = Depends(get_current_employee)):
    user_id = str(current_user.get("_id") or current_user.get("id"))
    channel = await ChatRepository.get_channel_by_id(channel_id)
    if not channel or user_id not in channel.get("members", []):
        raise HTTPException(status_code=403, detail="Not authorized or channel not found")
    return channel

@router.post("/channels/{channel_id}/members")
async def add_channel_member(channel_id: str, member_id: str = Query(...), current_user: dict = Depends(get_current_employee)):
    user_id = str(current_user.get("_id") or current_user.get("id"))
    channel = await ChatRepository.get_channel_by_id(channel_id)
    if not channel or user_id not in channel.get("members", []):
        raise HTTPException(status_code=403, detail="Not authorized or channel not found")
    if channel.get("type") == "self" or "yourself" in str(channel.get("name", "")).lower() or channel.get("name") == "You":
        raise HTTPException(status_code=400, detail="Cannot add members to personal or self chat")
    
    await ChatRepository.add_member_to_channel(channel_id, member_id)
    updated_channel = await ChatRepository.get_channel_by_id(channel_id)

    # Invalidate channel-list cache so the newly added user sees the group
    # immediately without a page refresh (get_channels_for_user is cached).
    try:
        await delete_cache(f"chat:channels:{member_id}")
        await delete_cache(f"chat:channels:{user_id}")
        # Belt & braces: id-format mismatches must never leave a stale list
        await clear_pattern("chat:channels:*")
    except Exception:
        pass

    event_data = {
        "action": "group_member_updated",
        "channel_id": channel_id,
        "channel": updated_channel,
        "event_type": "member_added",
        "member_id": member_id,
        "updated_by": user_id
    }
    await manager.broadcast_to_channel(channel_id, event_data)
    await manager.send_personal_message(json.dumps(event_data, default=str), member_id)
    return {"message": f"Member {member_id} added to group", "channel": updated_channel}

@router.delete("/channels/{channel_id}/members/{member_id}")
async def remove_channel_member(channel_id: str, member_id: str, current_user: dict = Depends(get_current_employee)):
    user_id = str(current_user.get("_id") or current_user.get("id"))
    channel = await ChatRepository.get_channel_by_id(channel_id)
    if not channel or user_id not in channel.get("members", []):
        raise HTTPException(status_code=403, detail="Not authorized or channel not found")
    
    # Broadcast before or fetch updated channel after removal
    await ChatRepository.remove_member_from_channel(channel_id, member_id)
    updated_channel = await ChatRepository.get_channel_by_id(channel_id)

    try:
        await delete_cache(f"chat:channels:{member_id}")
        await delete_cache(f"chat:channels:{user_id}")
        await clear_pattern("chat:channels:*")
    except Exception:
        pass

    event_data = {
        "action": "group_member_updated",
        "channel_id": channel_id,
        "channel": updated_channel,
        "event_type": "member_removed",
        "member_id": member_id,
        "updated_by": user_id
    }
    await manager.broadcast_to_channel(channel_id, event_data)
    await manager.send_personal_message(json.dumps(event_data, default=str), member_id)
    return {"message": f"Member {member_id} removed from group", "channel": updated_channel}

# --- Chat History API ---

@router.get("/history/{channel_id}", response_model=List[MessageResponse])
async def get_chat_history(channel_id: str, limit: int = 30, skip: int = 0, current_user: dict = Depends(get_current_employee)):
    # Verify user is in channel
    channel = await ChatRepository.get_channel_by_id(channel_id)
    user_id = str(current_user.get("_id") or current_user.get("id"))
    if not channel or user_id not in channel.get("members", []):
        raise HTTPException(status_code=403, detail="Not authorized to view this channel")
    
    messages = await ChatRepository.get_messages(channel_id, limit, skip)
    
    # Sanitize poll visibility for user
    sanitized_messages = [ChatRepository.sanitize_poll_for_user(msg, user_id) for msg in messages]
    
    # Mark messages as read for this user
    await ChatRepository.mark_messages_read(channel_id, user_id)
    
    return sanitized_messages

# --- Messages REST Endpoints for live chat ---

@router.get("/channels/{channel_id}/messages")
async def get_channel_messages(
    channel_id: str,
    limit: int = 50,
    skip: int = 0,
    current_user: dict = Depends(get_current_employee)
):
    user_id = str(current_user.get("_id") or current_user.get("id"))
    channel = await ChatRepository.get_channel_by_id(channel_id)
    if not channel or user_id not in channel.get("members", []):
        return []

    messages = await ChatRepository.get_messages(channel_id, limit, skip)
    messages.reverse()
    sanitized = [ChatRepository.sanitize_poll_for_user(msg, user_id) for msg in messages]
    await ChatRepository.mark_messages_read(channel_id, user_id)
    try:
        read_event = {
            "action": "messages_read",
            "type": "messages_read",
            "channel_id": channel_id,
            "user_id": user_id,
            "user_name": current_user.get("name"),
            "timestamp": datetime.utcnow().isoformat()
        }
        await manager.broadcast_to_channel(channel_id, read_event)
    except Exception:
        pass
    return sanitized

class SendMessageRequest(BaseModel):
    content: Optional[str] = ""
    media_url: Optional[str] = None
    media_type: Optional[str] = None
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    reply_to: Optional[dict] = None
    group_id: Optional[str] = None

def extract_employee_name(emp: dict) -> str:
    if not emp:
        return "User"
    if emp.get("name"):
        return emp["name"]
    p_info = emp.get("personal_info", {}) if isinstance(emp.get("personal_info"), dict) else {}
    fn = p_info.get("first_name", "").strip()
    ln = p_info.get("last_name", "").strip()
    full = f"{fn} {ln}".strip()
    if full:
        return full
    if emp.get("email"):
        return emp["email"].split("@")[0].capitalize()
    return "User"

def extract_employee_avatar(emp: dict) -> Optional[str]:
    if not emp:
        return None
    if emp.get("avatar"):
        return emp["avatar"]
    if emp.get("profile_photo"):
        return emp["profile_photo"]
    p_info = emp.get("personal_info", {}) if isinstance(emp.get("personal_info"), dict) else {}
    return p_info.get("profile_photo") or p_info.get("avatar")

async def send_chat_push_notifications(
    channel: dict,
    sender_emp: dict,
    content: str,
    file_name: Optional[str] = None,
    mentions: Optional[List[str]] = None,
    channel_id: Optional[str] = None
):
    """Deliver push notifications for direct chat messages or channel mentions when HRMS tab is closed"""
    try:
        from app.utils.push_notifications import send_push_to_user
        sender_id = str(sender_emp.get("_id") or sender_emp.get("id"))
        sender_name = extract_employee_name(sender_emp)
        sender_avatar = extract_employee_avatar(sender_emp)
        
        preview = (content or "").strip()
        if not preview and file_name:
            preview = f"📎 Sent a file: {file_name}"
        elif not preview:
            preview = "Sent a message"
        if len(preview) > 120:
            preview = preview[:117] + "..."

        targets = set()
        channel_type = channel.get("type", "channel")
        channel_name = channel.get("name", "Chat")

        if channel_type == "direct":
            for m in channel.get("members", []):
                if str(m) != sender_id:
                    targets.add(str(m))
        elif mentions:
            for m in mentions:
                if str(m) != sender_id:
                    targets.add(str(m))

        cid = str(channel_id or channel.get("id") or channel.get("_id", ""))
        for target_id in targets:
            title = sender_name if channel_type == "direct" else f"{sender_name} (#{channel_name})"
            await send_push_to_user(
                user_id=target_id,
                title=title,
                body=preview,
                icon=sender_avatar,
                action_url=f"/chat?channel={cid}",
                data={
                    "type": "chat",
                    "channel_id": cid,
                    "sender_id": sender_id
                }
            )
    except Exception as e:
        print(f"[CHAT PUSH ERROR] {e}")

@router.post("/channels/{channel_id}/messages")
async def send_channel_message(
    channel_id: str,
    data: SendMessageRequest,
    current_user: dict = Depends(get_current_employee)
):
    user_id = str(current_user.get("_id") or current_user.get("id"))
    user_name = extract_employee_name(current_user)
    user_avatar = extract_employee_avatar(current_user)

    channel = await ChatRepository.get_channel_by_id(channel_id)
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    message_data = {
        "channel_id": channel_id,
        "sender_id": user_id,
        "sender_name": user_name,
        "sender_avatar": user_avatar,
        "content": data.content or "",
        "media_url": data.media_url,
        "media_type": data.media_type or ("text" if not data.media_url else "file"),
        "file_url": data.media_url,
        "message_type": data.media_type or ("text" if not data.media_url else "file"),
        "file_name": data.file_name,
        "file_size": data.file_size,
        "reply_to": data.reply_to,
        "group_id": data.group_id,
        "reactions": []
    }
    saved_msg = await ChatRepository.save_message(message_data)
    
    ws_event = {
        "type": "new_message",
        "action": "new_message",
        "channel_id": channel_id,
        "message": saved_msg
    }
    await manager.broadcast_to_channel(channel_id, ws_event)
    await send_chat_push_notifications(
        channel=channel,
        sender_emp=current_user,
        content=data.content or "",
        file_name=data.file_name,
        channel_id=channel_id
    )
    return saved_msg

@router.post("/channels/{channel_id}/read")
async def mark_channel_messages_read(
    channel_id: str,
    current_user: dict = Depends(get_current_employee)
):
    user_id = str(current_user.get("_id") or current_user.get("id"))
    await ChatRepository.mark_messages_read(channel_id, user_id)
    ws_event = {
        "type": "read_receipt",
        "channel_id": channel_id,
        "user_id": user_id
    }
    await manager.broadcast_to_channel(channel_id, ws_event)
    return {"status": "ok"}

class CreatePollRequest(BaseModel):
    question: str
    options: List[str]
    allow_multiple_answers: bool = False

@router.post("/channels/{channel_id}/polls")
async def create_channel_poll(
    channel_id: str,
    data: CreatePollRequest,
    current_user: dict = Depends(get_current_employee)
):
    user_id = str(current_user.get("_id") or current_user.get("id"))
    user_name = extract_employee_name(current_user)
    user_avatar = extract_employee_avatar(current_user)

    formatted_options = [
        {"id": f"opt_{i+1}", "text": opt, "voters": []}
        for i, opt in enumerate(data.options)
    ]
    poll_data = {
        "question": data.question,
        "allow_multiple_answers": data.allow_multiple_answers,
        "hide_voters_name": False,
        "created_by": user_id,
        "options": formatted_options
    }

    message_data = {
        "channel_id": channel_id,
        "sender_id": user_id,
        "sender_name": user_name,
        "sender_avatar": user_avatar,
        "content": f"📊 Poll: {data.question}",
        "message_type": "poll",
        "poll": poll_data,
        "reactions": []
    }
    saved_msg = await ChatRepository.save_message(message_data)
    
    ws_event = {
        "type": "new_message",
        "action": "new_message",
        "channel_id": channel_id,
        "message": saved_msg
    }
    await manager.broadcast_to_channel(channel_id, ws_event)
    return saved_msg

class ReactRequest(BaseModel):
    emoji: str

@router.post("/messages/{message_id}/react")
async def react_to_message(
    message_id: str,
    data: ReactRequest,
    current_user: dict = Depends(get_current_employee)
):
    user_id = str(current_user.get("_id") or current_user.get("id"))
    updated = await ChatRepository.toggle_message_reaction(message_id, data.emoji, user_id)
    if updated and updated.get("channel_id"):
        ws_event = {
            "type": "reaction_updated",
            "action": "reaction_updated",
            "message_id": message_id,
            "reactions": updated.get("reactions")
        }
        await manager.broadcast_to_channel(updated["channel_id"], ws_event)
    return updated or {"status": "ok"}

class VoteRequest(BaseModel):
    option_id: str

@router.post("/messages/{message_id}/vote")
async def vote_poll_option(
    message_id: str,
    data: VoteRequest,
    current_user: dict = Depends(get_current_employee)
):
    user_id = str(current_user.get("_id") or current_user.get("id"))
    user_name = current_user.get("name") or "User"
    updated = await ChatRepository.vote_poll_option(message_id, data.option_id, user_id, user_name=user_name)
    if updated and updated.get("channel_id"):
        ws_event = {
            "type": "poll_updated",
            "action": "poll_updated",
            "message_id": message_id,
            "poll": updated.get("poll"),
            "channel_id": updated.get("channel_id")
        }
        await manager.broadcast_to_channel(updated["channel_id"], ws_event)
    return updated or {"status": "ok"}

@router.get("/pinned/{channel_id}", response_model=List[MessageResponse])
async def get_pinned_messages(channel_id: str, current_user: dict = Depends(get_current_employee)):
    channel = await ChatRepository.get_channel_by_id(channel_id)
    user_id = str(current_user.get("_id") or current_user.get("id"))
    if not channel or user_id not in channel.get("members", []):
        raise HTTPException(status_code=403, detail="Not authorized to view this channel")
        
    messages = await ChatRepository.get_pinned_messages(channel_id)
    sanitized = [ChatRepository.sanitize_poll_for_user(msg, user_id) for msg in messages]
    return sanitized

@router.get("/search/{channel_id}", response_model=List[MessageResponse])
async def search_chat_messages(channel_id: str, q: str, limit: int = 50, current_user: dict = Depends(get_current_employee)):
    channel = await ChatRepository.get_channel_by_id(channel_id)
    user_id = str(current_user.get("_id") or current_user.get("id"))
    if not channel or user_id not in channel.get("members", []):
        raise HTTPException(status_code=403, detail="Not authorized to view this channel")
        
    messages = await ChatRepository.search_messages(channel_id, q, limit)
    sanitized = [ChatRepository.sanitize_poll_for_user(msg, user_id) for msg in messages]
    return sanitized

@router.get("/media/{channel_id}", response_model=List[MessageResponse])
async def get_shared_media_files(
    channel_id: str,
    media_type: Optional[str] = Query(None, description="Optional type filter: 'docs', 'audio', 'links'"),
    limit: int = 100,
    current_user: dict = Depends(get_current_employee)
):
    channel = await ChatRepository.get_channel_by_id(channel_id)
    user_id = str(current_user.get("_id") or current_user.get("id"))
    if not channel or user_id not in channel.get("members", []):
        raise HTTPException(status_code=403, detail="Not authorized to view this channel")
        
    messages = await ChatRepository.get_shared_media(channel_id, media_type, limit)
    sanitized = [ChatRepository.sanitize_poll_for_user(msg, user_id) for msg in messages]
    return sanitized

@router.get("/unread-counts", response_model=List[UnreadCountResponse])
async def get_unread_counts(current_user: dict = Depends(get_current_employee)):
    user_id = str(current_user.get("_id") or current_user.get("id"))
    counts = await ChatRepository.get_unread_counts_for_user(user_id)
    return counts

# --- Save for Later (Saved Messages) API ---

@router.post("/save/{message_id}", response_model=MessageResponse)
async def toggle_save_message(message_id: str, current_user: dict = Depends(get_current_employee)):
    user_id = str(current_user.get("_id") or current_user.get("id"))
    updated_msg = await ChatRepository.toggle_save_message(message_id, user_id)
    if not updated_msg:
        raise HTTPException(status_code=404, detail="Message not found")
    return updated_msg

@router.get("/saved-messages", response_model=List[MessageResponse])
async def get_saved_messages(limit: int = 50, skip: int = 0, current_user: dict = Depends(get_current_employee)):
    user_id = str(current_user.get("_id") or current_user.get("id"))
    messages = await ChatRepository.get_saved_messages(user_id, limit, skip)
    return messages

# --- User Presence / Online-Offline Status API ---

@router.get("/presence/{user_id}", response_model=UserPresenceResponse)
async def get_user_presence(user_id: str, current_user: dict = Depends(get_current_employee)):
    presence = await ChatRepository.get_user_presence(user_id)
    return presence

@router.post("/presence/batch", response_model=List[UserPresenceResponse])
async def get_batch_user_presence(body: UserPresenceBatchRequest, current_user: dict = Depends(get_current_employee)):
    presences = await ChatRepository.get_batch_user_presence(body.user_ids)
    return presences

# --- Employee Profile Card API ---

@router.get("/profile/{user_id}", response_model=UserProfileCardResponse)
async def get_chat_user_profile(user_id: str, current_user: dict = Depends(get_current_employee)):
    profile = await ChatRepository.get_user_profile_card(user_id)
    return profile

# --- Emoji Reactions & Forwarding REST APIs ---

@router.post("/react/{message_id}", response_model=MessageResponse)
async def toggle_message_reaction(message_id: str, body: ReactionRequest, current_user: dict = Depends(get_current_employee)):
    user_id = str(current_user.get("_id") or current_user.get("id"))
    updated_msg = await ChatRepository.toggle_message_reaction(message_id, body.emoji, user_id)
    if not updated_msg:
        raise HTTPException(status_code=404, detail="Message not found")
    return updated_msg

@router.post("/forward", response_model=List[MessageResponse])
async def forward_messages(body: ForwardMessageRequest, current_user: dict = Depends(get_current_employee)):
    user_id = str(current_user.get("_id") or current_user.get("id"))
    forwarded = await ChatRepository.forward_messages(
        message_ids=body.message_ids,
        target_channel_id=body.target_channel_id,
        target_receiver_id=body.target_receiver_id,
        sender_id=user_id
    )
    return forwarded

@router.delete("/messages/{message_id}")
async def delete_chat_message(message_id: str, current_user: dict = Depends(get_current_employee)):
    user_id = str(current_user.get("_id") or current_user.get("id"))
    
    # Task 41 & User Instruction: Message delete permission is strictly controlled via Access Control.
    # User must have explicit delete or all permission in their module_permissions for "/chat" (or "chat").
    user_perm = await UserPermissionRepository.get_user_permission(user_id)
    perms = (user_perm.get("module_permissions") or {}) if user_perm else {}
    chat_perm = perms.get("/chat") or perms.get("chat") or {}
    can_delete = bool(chat_perm.get("delete") or chat_perm.get("all"))
    
    if not can_delete:
        raise HTTPException(
            status_code=403, 
            detail="Access denied: You do not have permission to delete chat messages in Access Control."
        )

    deleted_msg = await ChatRepository.delete_message(message_id, user_id, is_admin=True)
    if not deleted_msg:
        raise HTTPException(status_code=404, detail="Message not found")
    
    channel_id = deleted_msg.get("channel_id")
    if channel_id:
        ws_event = {
            "type": "message_deleted",
            "action": "message_deleted",
            "message_id": message_id,
            "channel_id": channel_id
        }
        await manager.broadcast_to_channel(channel_id, ws_event)
        
    return {"message": "Message deleted successfully", "message_id": message_id}

# --- WebSocket ---

@router.websocket("/ws/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str):
    user_id = token 
    
    # Resolve user details once on connect
    current_user = None
    try:
        db = await ChatRepository.get_db()
        from bson import ObjectId
        if ObjectId.is_valid(user_id):
            current_user = await db["employees"].find_one({"_id": ObjectId(user_id)})
        if not current_user:
            current_user = await db["employees"].find_one({"$or": [{"id": user_id}, {"employee_id": user_id}, {"_id": user_id}]})
    except Exception:
        pass
    resolved_user_name = (current_user.get("name") if isinstance(current_user, dict) else None) or "User"

    try:
        await manager.connect(websocket, user_id)
        # Send current online users list over websocket immediately (eliminates HTTP batch presence calls)
        online_list = [uid for uid, conns in manager.active_connections.items() if len(conns) > 0]
        await websocket.send_text(json.dumps({
            "action": "presence_state",
            "type": "presence_state",
            "online_users": online_list
        }))
    except Exception as e:
        print(f"WebSocket Connect Error for user {user_id}: {e}")
        return

    try:
        while True:
            try:
                data = await websocket.receive_text()
            except Exception:
                break

            try:
                message_data = json.loads(data)
            except Exception:
                continue

            # Heartbeat ping/pong support
            if message_data.get("type") == "ping" or message_data.get("action") == "ping":
                try:
                    await websocket.send_text(json.dumps({"type": "pong", "action": "pong"}))
                except Exception:
                    pass
                continue

            # Presence state request over WebSocket
            if message_data.get("action") in ("get_presence", "presence_state"):
                try:
                    online_list = [uid for uid, conns in manager.active_connections.items() if len(conns) > 0]
                    await websocket.send_text(json.dumps({
                        "action": "presence_state",
                        "type": "presence_state",
                        "online_users": online_list
                    }))
                except Exception:
                    pass
                continue

            try:
                # --- Handle Add / Remove Group Member Actions ---
                if message_data.get("action") in ("add_group_member", "remove_group_member", "add_member", "remove_member"):
                    action_name = message_data.get("action")
                    channel_id = message_data.get("channel_id")
                    member_id = message_data.get("member_id")
                    if channel_id and member_id:
                        if "add" in action_name:
                            await ChatRepository.add_member_to_channel(channel_id, member_id)
                            event_type = "member_added"
                        else:
                            await ChatRepository.remove_member_from_channel(channel_id, member_id)
                            event_type = "member_removed"
                        
                        updated_channel = await ChatRepository.get_channel_by_id(channel_id)
                        event_data = {
                            "action": "group_member_updated",
                            "channel_id": channel_id,
                            "channel": updated_channel,
                            "event_type": event_type,
                            "member_id": member_id,
                            "updated_by": user_id
                        }
                        await manager.broadcast_to_channel(channel_id, event_data)
                        await manager.send_personal_message(json.dumps(event_data, default=str), member_id)
                    continue

                # --- Handle Emoji Reaction Action ---
                if message_data.get("action") in ("react_message", "toggle_reaction"):
                    message_id = message_data.get("message_id")
                    emoji = message_data.get("emoji")
                    channel_id = message_data.get("channel_id")
                    if message_id and emoji:
                        updated_msg = await ChatRepository.toggle_message_reaction(message_id, emoji, user_id)
                        if updated_msg:
                            updated_msg["action"] = "message_reaction_updated"
                            if channel_id:
                                await manager.broadcast_to_channel(channel_id, updated_msg)
                            else:
                                msg_str = json.dumps(updated_msg, default=str)
                                await manager.send_personal_message(msg_str, user_id)
                    continue

                # --- Handle Message Forwarding Action ---
                if message_data.get("action") in ("forward_message", "forward_messages"):
                    message_ids = message_data.get("message_ids") or ([message_data.get("message_id")] if message_data.get("message_id") else [])
                    target_channel_id = message_data.get("target_channel_id") or message_data.get("channel_id")
                    target_receiver_id = message_data.get("target_receiver_id") or message_data.get("receiver_id")
                    
                    if message_ids:
                        forwarded_msgs = await ChatRepository.forward_messages(message_ids, target_channel_id, target_receiver_id, user_id)
                        for f_msg in forwarded_msgs:
                            f_msg["action"] = "new_message"
                            ch_id = f_msg.get("channel_id")
                            if ch_id:
                                await manager.broadcast_to_channel(ch_id, f_msg)
                    continue

                # --- Handle Delete Message Action ---
                if message_data.get("action") in ("delete_message", "remove_message"):
                    message_id = message_data.get("message_id")
                    channel_id = message_data.get("channel_id")
                    if message_id:
                        user_perm = await UserPermissionRepository.get_user_permission(user_id)
                        perms = (user_perm.get("module_permissions") or {}) if user_perm else {}
                        chat_perm = perms.get("/chat") or perms.get("chat") or {}
                        can_del = bool(chat_perm.get("delete") or chat_perm.get("all"))
                        if can_del:
                            deleted = await ChatRepository.delete_message(message_id, user_id, is_admin=True)
                            if deleted:
                                del_event = {
                                    "action": "message_deleted",
                                    "type": "message_deleted",
                                    "message_id": message_id,
                                    "channel_id": channel_id,
                                    "deleted_by": user_id
                                }
                                if channel_id:
                                    await manager.broadcast_to_channel(channel_id, del_event)
                                else:
                                    await manager.send_personal_message(json.dumps(del_event, default=str), user_id)
                    continue

                # --- Handle Save for Later Action ---
                if message_data.get("action") in ("toggle_save", "save_message", "unsave_message"):
                    message_id = message_data.get("message_id")
                    if message_id:
                        updated_msg = await ChatRepository.toggle_save_message(message_id, user_id)
                        if updated_msg:
                            updated_msg["action"] = "message_save_updated"
                            msg_str = json.dumps(updated_msg, default=str)
                            await manager.send_personal_message(msg_str, user_id)
                    continue

                # --- Handle Message Pinning Action ---
                if message_data.get("action") in ("pin_message", "toggle_pin", "unpin_message"):
                    message_id = message_data.get("message_id")
                    channel_id = message_data.get("channel_id")
                    if message_id and channel_id:
                        channel = await ChatRepository.get_channel_by_id(channel_id)
                        if not channel or user_id not in channel.get("members", []):
                            err_msg = json.dumps({"error": "You are not a member of this group."})
                            await manager.send_personal_message(err_msg, user_id)
                            continue
                            
                        updated_msg = await ChatRepository.toggle_pin_message(message_id, user_id)
                        if updated_msg:
                            updated_msg["action"] = "message_pinned_updated"
                            await manager.broadcast_to_channel(channel_id, updated_msg)
                    continue

                # --- Handle Poll Voting Action ---
                if message_data.get("action") == "vote_poll":
                    message_id = message_data.get("message_id")
                    option_id = message_data.get("option_id")
                    channel_id = message_data.get("channel_id")
                    
                    if message_id and option_id and channel_id:
                        channel = await ChatRepository.get_channel_by_id(channel_id)
                        if not channel or user_id not in channel.get("members", []):
                            err_msg = json.dumps({"error": "You are not a member of this group."})
                            await manager.send_personal_message(err_msg, user_id)
                            continue
                            
                        user_name = message_data.get("user_name") or resolved_user_name or "User"
                        updated_msg = await ChatRepository.vote_poll_option(message_id, option_id, user_id, user_name=user_name)
                        if updated_msg:
                            updated_msg["action"] = "poll_updated"
                            await manager.broadcast_to_channel(channel_id, updated_msg)
                    continue

                # --- Handle Mark Messages Read Action ---
                if message_data.get("action") in ("mark_channel_read", "mark_read", "messages_read"):
                    ch_id = message_data.get("channel_id")
                    if ch_id:
                        user_name = message_data.get("user_name") or resolved_user_name or "User"
                        await ChatRepository.mark_messages_read(ch_id, user_id)
                        read_event = {
                            "action": "messages_read",
                            "type": "messages_read",
                            "channel_id": ch_id,
                            "user_id": user_id,
                            "user_name": user_name,
                            "timestamp": datetime.utcnow().isoformat()
                        }
                        await manager.broadcast_to_channel(ch_id, read_event)
                    continue

                content = message_data.get("content", "")
                file_url = message_data.get("file_url")
                file_name = message_data.get("file_name")
                message_type = message_data.get("message_type")
                mentions = message_data.get("mentions", [])
                
                # Auto-detect mentions if content has @employee_id pattern
                if not mentions and content:
                    mentions = re.findall(r'@([a-zA-Z0-9_-]+)', content)
                
                # Auto-detect message type if not specified
                if not message_type:
                    if "poll" in message_data:
                        message_type = "poll"
                    elif file_url:
                        ext = Path(file_name or file_url).suffix.lower()
                        if ext in (".webm", ".mp3", ".wav", ".ogg", ".m4a", ".aac"):
                            message_type = "audio"
                        elif ext in (".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".bmp"):
                            message_type = "image"
                        elif ext in (".mp4", ".mov", ".avi", ".mkv"):
                            message_type = "video"
                        else:
                            message_type = "file"
                    elif content and content.strip().startswith(("http://", "https://")):
                        message_type = "link"
                    else:
                        message_type = "text"

                if message_type == "poll" or "poll" in message_data:
                    # Reject poll creation in personal 1-to-1 or self chats
                    if "receiver_id" in message_data:
                        err_msg = json.dumps({"error": "Polls can only be created in group chats, not in personal chats."})
                        await manager.send_personal_message(err_msg, user_id)
                        continue

                    if "channel_id" in message_data:
                        channel_id = message_data["channel_id"]
                        channel = await ChatRepository.get_channel_by_id(channel_id)
                        if not channel or user_id not in channel.get("members", []):
                            err_msg = json.dumps({"error": "You are not a member of this group."})
                            await manager.send_personal_message(err_msg, user_id)
                            continue

                        if channel.get("type") != "group":
                            err_msg = json.dumps({"error": "Polls can only be created in group chats, not in personal chats."})
                            await manager.send_personal_message(err_msg, user_id)
                            continue

                        poll_input = message_data.get("poll", {})
                        question = poll_input.get("question") or content or "Poll"
                        raw_options = poll_input.get("options", [])
                        
                        formatted_options = []
                        for idx, opt_item in enumerate(raw_options):
                            if isinstance(opt_item, str):
                                formatted_options.append({"id": f"opt_{idx+1}", "text": opt_item, "voters": []})
                            elif isinstance(opt_item, dict):
                                formatted_options.append({
                                    "id": opt_item.get("id", f"opt_{idx+1}"),
                                    "text": opt_item.get("text", ""),
                                    "voters": opt_item.get("voters", [])
                                })
                                
                        poll_data = {
                            "question": question,
                            "allow_multiple_answers": bool(poll_input.get("allow_multiple_answers", False)),
                            "hide_voters_name": bool(poll_input.get("hide_voters_name", False)),
                            "created_by": user_id,
                            "options": formatted_options
                        }

                        saved_msg = await ChatRepository.save_message({
                            "channel_id": channel_id,
                            "sender_id": user_id,
                            "content": f"📊 Poll: {question}",
                            "message_type": "poll",
                            "poll": poll_data,
                            "mentions": mentions
                        })
                        await manager.broadcast_to_channel(channel_id, saved_msg)
                    continue

                if content or file_url:
                    if "channel_id" in message_data:
                        # Group / Channel Message
                        channel_id = message_data["channel_id"]
                        channel = await ChatRepository.get_channel_by_id(channel_id)
                        if not channel or user_id not in channel.get("members", []):
                            err_msg = json.dumps({"error": "You are not a member of this group."})
                            await manager.send_personal_message(err_msg, user_id)
                            continue

                        reply_to_id = message_data.get("reply_to_id")
                        saved_msg = await ChatRepository.save_message({
                            "channel_id": channel_id,
                            "sender_id": user_id,
                            "content": content,
                            "message_type": message_type,
                            "file_url": file_url,
                            "file_name": file_name,
                            "mentions": mentions,
                            "reply_to_id": reply_to_id
                        })
                        await manager.broadcast_to_channel(channel_id, saved_msg)
                        if mentions:
                            sender_emp = await ChatRepository.get_employee_by_id(user_id)
                            if sender_emp and channel:
                                await send_chat_push_notifications(
                                    channel=channel,
                                    sender_emp=sender_emp,
                                    content=content,
                                    file_name=file_name,
                                    mentions=mentions,
                                    channel_id=channel_id
                                )
                    
                    elif "receiver_id" in message_data:
                        # 1-to-1 Direct Message
                        receiver_id = message_data["receiver_id"]
                        channel = await ChatRepository.get_direct_channel(user_id, receiver_id)
                        if not channel:
                            db = await ChatRepository.get_db()
                            doc = {
                                "name": f"Direct: {user_id} & {receiver_id}",
                                "type": "direct",
                                "members": [user_id, receiver_id],
                                "created_at": datetime.utcnow()
                            }
                            result = await db[ChatRepository.channels_collection].insert_one(doc)
                            channel_id = str(result.inserted_id)
                        else:
                            channel_id = str(channel["id"])
                            
                        reply_to_id = message_data.get("reply_to_id")
                        saved_msg = await ChatRepository.save_message({
                            "channel_id": channel_id,
                            "sender_id": user_id,
                            "content": content,
                            "message_type": message_type,
                            "file_url": file_url,
                            "file_name": file_name,
                            "mentions": mentions,
                            "reply_to_id": reply_to_id
                        })
                        
                        msg_str = json.dumps(saved_msg, default=str)
                        await manager.send_personal_message(msg_str, user_id)
                        if user_id != receiver_id:
                            await manager.send_personal_message(msg_str, receiver_id)
                            sender_emp = await ChatRepository.get_employee_by_id(user_id)
                            if sender_emp:
                                await send_chat_push_notifications(
                                    channel={"type": "direct", "members": [user_id, receiver_id], "name": "Direct"},
                                    sender_emp=sender_emp,
                                    content=content,
                                    file_name=file_name,
                                    channel_id=channel_id
                                )
            except Exception as err:
                import traceback
                print(f"Error handling WS msg for user {user_id}: {err}\n{traceback.format_exc()}")
                err_payload = json.dumps({"error": str(err)})
                await manager.send_personal_message(err_payload, user_id)
                
    except WebSocketDisconnect:
        await manager.disconnect(websocket, user_id)

class MeetingSummonRequest(BaseModel):
    target_ids: List[str]
    location: str
    notes: Optional[str] = "Urgent meeting requested immediately."
    meet_link: Optional[str] = None

@router.post("/meeting-summon")
async def trigger_meeting_summon(data: MeetingSummonRequest, current_user: dict = Depends(get_current_employee)):
    caller_name = current_user.get("personal_info", {}).get("first_name", "") + " " + current_user.get("personal_info", {}).get("last_name", "")
    caller_name = caller_name.strip() or current_user.get("name") or "Team Leader"
    caller_role = current_user.get("work_details", {}).get("designation") or current_user.get("work_details", {}).get("system_role") or "Admin"
    
    summon_id = str(uuid.uuid4())
    sent_count = 0
    now_iso = datetime.utcnow().isoformat() + "Z"
    caller_id = str(current_user.get("_id") or current_user.get("id"))
    caller_avatar = extract_employee_avatar(current_user)
    
    for tid in data.target_ids:
        tid_str = str(tid).strip()
        if not tid_str:
            continue
        payload = {
            "type": "meeting_summon",
            "action": "meeting_summon",
            "summon_id": summon_id,
            "caller_id": caller_id,
            "caller_name": caller_name,
            "caller_role": caller_role,
            "caller_avatar": caller_avatar,
            "location": data.location,
            "notes": data.notes or "Urgent meeting requested immediately.",
            "meet_link": data.meet_link,
            "timestamp": now_iso,
            "target_id": tid_str
        }
        await manager.send_personal_message(json.dumps(payload), tid_str)
        try:
            from app.repository.notification import NotificationRepository
            import urllib.parse
            summon_params = urllib.parse.urlencode({
                "meeting_summon": "1",
                "summon_id": summon_id,
                "caller_name": caller_name,
                "caller_role": caller_role,
                "caller_avatar": caller_avatar or "",
                "location": data.location or "Meeting Room",
                "notes": data.notes or "",
                "meet_link": data.meet_link or "",
                "timestamp": now_iso
            })
            action_url = f"/?{summon_params}"

            await NotificationRepository.create_notification({
                "recipient_id": tid_str,
                "title": f"🚨 URGENT SUMMON: {caller_name}",
                "message": f"Report immediately to {data.location}. Note: {data.notes or ''}",
                "type": "meeting_summon",
                "action_url": action_url,
                "is_read": False,
                "sender_id": caller_id,
                "sender_avatar": caller_avatar,
                "data": payload
            })
        except Exception as e:
            print(f"[SUMMON] Error creating notification: {e}")
        sent_count += 1
        
    return {"status": "success", "sent_to": sent_count, "summon_id": summon_id}
