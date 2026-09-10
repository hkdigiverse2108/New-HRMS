import json
import logging
import redis.asyncio as redis
from typing import Optional, Any
from datetime import date, datetime, time
from bson import ObjectId
from pydantic import BaseModel
from app.config import settings

logger = logging.getLogger("redis_service")

# ==============================================================================
# REDIS CLIENT INSTANCE
# ==============================================================================
redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)

async def get_redis():
    """FastAPI dependency to get redis connection"""
    return redis_client

# ==============================================================================
# JSON SERIALIZER FOR MONGODB & PYDANTIC
# ==============================================================================
class MongoJSONEncoder(json.JSONEncoder):
    """Encodes MongoDB ObjectId, datetime, date, time and Pydantic models into valid JSON."""
    def default(self, o: Any) -> Any:
        if isinstance(o, (datetime, date, time)):
            return o.isoformat()
        if isinstance(o, ObjectId):
            return str(o)
        if isinstance(o, BaseModel):
            return o.model_dump(by_alias=True)
        return super().default(o)

# ==============================================================================
# COMMON REUSABLE REDIS FUNCTIONS (Used across all controllers)
# ==============================================================================

async def get_cache(key: str) -> Optional[Any]:
    """Fetch cached data from Redis. Returns None on cache miss or error."""
    try:
        data = await redis_client.get(key)
        if data:
            return json.loads(data)
    except Exception as e:
        logger.warning(f"Redis get_cache error for key '{key}': {e}")
    return None

async def set_cache(key: str, data: Any, ttl: Optional[int] = None):
    """
    Store data in Redis.
    If ttl is None, data persists indefinitely until Add, Edit, or Delete clears it.
    """
    try:
        val = json.dumps(data, cls=MongoJSONEncoder)
        if ttl:
            await redis_client.set(key, val, ex=ttl)
        else:
            await redis_client.set(key, val)
    except Exception as e:
        logger.warning(f"Redis set_cache error for key '{key}': {e}")

async def delete_cache(key: str):
    """Delete a specific key from Redis."""
    try:
        await redis_client.delete(key)
    except Exception as e:
        logger.warning(f"Redis delete_cache error for key '{key}': {e}")

async def clear_pattern(pattern: str):
    """Delete all keys matching pattern (e.g. 'departments:list:*', 'employees:list:*')."""
    try:
        keys = []
        async for key in redis_client.scan_iter(match=pattern):
            keys.append(key)
        if keys:
            await redis_client.delete(*keys)
    except Exception as e:
        logger.warning(f"Redis clear_pattern error for pattern '{pattern}': {e}")

def make_list_key(prefix: str, **kwargs) -> str:
    """
    Build dynamic deterministic cache key for any module (departments, designations, sub-departments, employees).
    Example: make_list_key('departments', page=1, limit=10)
             -> 'departments:list:limit=10:page=1'
    """
    sorted_parts = []
    for k, v in sorted(kwargs.items()):
        if v is None:
            continue
        # Skip FastAPI Query / Param objects if not resolved
        if str(type(v)).startswith("<class 'fastapi.params"):
            continue
        val_str = v.value if hasattr(v, "value") else str(v)
        sorted_parts.append(f"{k}={val_str}")

    query_str = ":".join(sorted_parts)
    return f"{prefix}:list:{query_str}" if query_str else f"{prefix}:list:all"
