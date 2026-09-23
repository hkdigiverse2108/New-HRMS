from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, UploadFile, File, Query
from fastapi.responses import FileResponse
from typing import List, Optional
from app.schemas.chat import ChannelCreate, ChannelUpdate, ChannelResponse, MessageResponse, UnreadCountResponse, UserPresenceResponse, UserPresenceBatchRequest, UserProfileCardResponse, ReactionRequest, ForwardMessageRequest
from app.repository.chat import ChatRepository
from app.services.websocket_manager import manager
from app.controllers.auth import get_current_employee
from app.controllers.image import IMAGES_DIR
from app.config import BACKEND_DIR
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
    # Check file size (limit: 25MB)
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
    
    file_ext = Path(file.filename or "").suffix.lower()
    unique_filename = f"{uuid.uuid4().hex}{file_ext}"
    target_path = chat_dir / unique_filename
    
    with target_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    file_url = f"/images/chat_documents/{unique_filename}"
    return {
        "file_url": file_url,
        "file_name": file.filename,
        "file_type": file.content_type,
        "file_size": file_size
    }

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
    
    await ChatRepository.add_member_to_channel(channel_id, member_id)
    updated_channel = await ChatRepository.get_channel_by_id(channel_id)
    
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

# --- WebSocket ---

@router.websocket("/ws/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str):
    user_id = token 
    
    try:
        await manager.connect(websocket, user_id)
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
                            
                        updated_msg = await ChatRepository.vote_poll_option(message_id, option_id, user_id)
                        if updated_msg:
                            updated_msg["action"] = "poll_updated"
                            await manager.broadcast_to_channel(channel_id, updated_msg)
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
                    
                    elif "receiver_id" in message_data:
                        # 1-to-1 Direct Message
                        receiver_id = message_data["receiver_id"]
                        channel = await ChatRepository.get_direct_channel(user_id, receiver_id)
                        if not channel:
                            db = await ChatRepository.get_db()
                            import datetime
                            doc = {
                                "name": f"Direct: {user_id} & {receiver_id}",
                                "type": "direct",
                                "members": [user_id, receiver_id],
                                "created_at": datetime.datetime.utcnow()
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
            except Exception as err:
                import traceback
                print(f"Error handling WS msg for user {user_id}: {err}\n{traceback.format_exc()}")
                err_payload = json.dumps({"error": str(err)})
                await manager.send_personal_message(err_payload, user_id)
                
    except WebSocketDisconnect:
        await manager.disconnect(websocket, user_id)
