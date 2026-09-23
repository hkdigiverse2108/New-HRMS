from fastapi import WebSocket
from typing import Dict, List, Any
from app.repository.chat import ChatRepository
import json

class ConnectionManager:
    def __init__(self):
        # user_id -> List of WebSockets (user might be logged in from multiple devices)
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        is_first_connection = user_id not in self.active_connections or len(self.active_connections[user_id]) == 0
        
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)

        if is_first_connection:
            try:
                presence_doc = await ChatRepository.update_user_presence(user_id, True)
                await self.broadcast_presence_update(presence_doc)
            except Exception as e:
                print(f"Error updating user presence on connect for {user_id}: {e}")

    async def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if len(self.active_connections[user_id]) == 0:
                del self.active_connections[user_id]
                try:
                    presence_doc = await ChatRepository.update_user_presence(user_id, False)
                    await self.broadcast_presence_update(presence_doc)
                except Exception as e:
                    print(f"Error updating user presence on disconnect for {user_id}: {e}")

    async def broadcast_presence_update(self, presence_doc: Dict[str, Any]):
        msg_data = {
            "action": "user_presence_updated",
            "presence": presence_doc
        }
        msg_str = json.dumps(msg_data, default=str)
        # Broadcast presence change to all online users
        for uid, connections in list(self.active_connections.items()):
            for conn in connections:
                try:
                    await conn.send_text(msg_str)
                except Exception:
                    pass

    async def send_personal_message(self, message: str, user_id: str):
        if user_id in self.active_connections:
            for connection in list(self.active_connections[user_id]):
                try:
                    await connection.send_text(message)
                except Exception:
                    pass

    async def broadcast_to_channel(self, channel_id: str, message: Dict[str, Any]):
        # Get members of the channel
        channel = await ChatRepository.get_channel_by_id(channel_id)
        if not channel:
            return
        
        members = channel.get("members", [])
        msg_str = json.dumps(message, default=str)
        
        for member_id in members:
            await self.send_personal_message(msg_str, member_id)

manager = ConnectionManager()

