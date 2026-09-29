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
        uid = str(user_id).strip()
        is_first_connection = uid not in self.active_connections or len(self.active_connections[uid]) == 0
        
        if uid not in self.active_connections:
            self.active_connections[uid] = []
        if websocket not in self.active_connections[uid]:
            self.active_connections[uid].append(websocket)

        if is_first_connection:
            try:
                presence_doc = await ChatRepository.update_user_presence(uid, True)
                await self.broadcast_presence_update(presence_doc)
            except Exception as e:
                print(f"Error updating user presence on connect for {uid}: {e}")

    async def disconnect(self, websocket: WebSocket, user_id: str):
        uid = str(user_id).strip()
        if uid in self.active_connections:
            if websocket in self.active_connections[uid]:
                self.active_connections[uid].remove(websocket)
            if len(self.active_connections[uid]) == 0:
                del self.active_connections[uid]
                try:
                    presence_doc = await ChatRepository.update_user_presence(uid, False)
                    await self.broadcast_presence_update(presence_doc)
                except Exception as e:
                    print(f"Error updating user presence on disconnect for {uid}: {e}")

    async def broadcast_presence_update(self, presence_doc: Dict[str, Any]):
        msg_data = {
            "action": "user_presence_updated",
            "presence": presence_doc
        }
        msg_str = json.dumps(msg_data, default=str)
        # Broadcast presence change to all online users
        for uid, connections in list(self.active_connections.items()):
            dead_conns = []
            for conn in list(connections):
                try:
                    await conn.send_text(msg_str)
                except Exception:
                    dead_conns.append(conn)
            for dc in dead_conns:
                if dc in self.active_connections.get(uid, []):
                    self.active_connections[uid].remove(dc)
            if uid in self.active_connections and len(self.active_connections[uid]) == 0:
                del self.active_connections[uid]

    async def send_personal_message(self, message: str, user_id: str):
        uid = str(user_id).strip()
        if uid in self.active_connections:
            dead_conns = []
            for connection in list(self.active_connections[uid]):
                try:
                    await connection.send_text(message)
                except Exception:
                    dead_conns.append(connection)
            for dc in dead_conns:
                if dc in self.active_connections.get(uid, []):
                    self.active_connections[uid].remove(dc)
            if uid in self.active_connections and len(self.active_connections[uid]) == 0:
                del self.active_connections[uid]

    async def broadcast_to_channel(self, channel_id: str, message: Dict[str, Any]):
        # Get members of the channel
        channel = await ChatRepository.get_channel_by_id(str(channel_id))
        if not channel:
            return
        
        members = channel.get("members", [])
        msg_str = json.dumps(message, default=str)
        
        for member_id in members:
            await self.send_personal_message(msg_str, str(member_id))

manager = ConnectionManager()


