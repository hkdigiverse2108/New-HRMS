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
redis_client = redis.from_url(
    settings.REDIS_URL,
    decode_responses=True,
    # Fast-fail when Redis is down (else retries add ~4s per cache op).
    socket_connect_timeout=1,
    socket_timeout=1,
    retry_on_timeout=False,
)

async def get_redis():
    """FastAPI dependency to get redis connection"""
    return redis_client

# In-memory fallback (per-process) so caching still works when Redis is down.
# Same TTL semantics; cleared on delete/clear_pattern. Redis stays primary.
import time as _time
import fnmatch as _fnmatch

_memory_cache: dict = {}

# Circuit breaker: after consecutive Redis failures, skip Redis attempts briefly
# (each attempt costs the socket timeout). Resets on first success.
_redis_down_until: float = 0.0
_redis_fail_count: int = 0
_REDIS_FAIL_THRESHOLD = 2
_REDIS_COOLDOWN_SEC = 30.0


def _redis_available() -> bool:
    return _time.time() >= _redis_down_until


def _redis_ok():
    global _redis_fail_count, _redis_down_until
    _redis_fail_count = 0
    _redis_down_until = 0.0


def _redis_failed():
    global _redis_fail_count, _redis_down_until
    _redis_fail_count += 1
    if _redis_fail_count >= _REDIS_FAIL_THRESHOLD:
        _redis_down_until = _time.time() + _REDIS_COOLDOWN_SEC


def _mem_get(key: str) -> Optional[Any]:
    try:
        entry = _memory_cache.get(key)
        if not entry:
            return None
        val, exp = entry
        if exp is not None and _time.time() > exp:
            _memory_cache.pop(key, None)
            return None
        return json.loads(val)
    except Exception:
        return None


def _mem_set(key: str, val: str, ttl: Optional[int] = None):
    try:
        exp = (_time.time() + ttl) if ttl else None
        _memory_cache[key] = (val, exp)
    except Exception:
        pass

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
    """Fetch cached data (Redis primary, in-memory fallback). Returns None on miss."""
    if _redis_available():
        try:
            data = await redis_client.get(key)
            _redis_ok()
            if data:
                return json.loads(data)
        except Exception as e:
            logger.warning(f"Redis get_cache error for key '{key}': {e}")
            _redis_failed()
            return _mem_get(key)
        return None
    return _mem_get(key)

async def set_cache(key: str, data: Any, ttl: Optional[int] = None):
    """
    Store data in Redis (+ in-memory mirror so cache works with Redis down).
    If ttl is None, data persists indefinitely until Add, Edit, or Delete clears it.
    """
    try:
        val = json.dumps(data, cls=MongoJSONEncoder)
    except Exception as e:
        logger.warning(f"Redis set_cache serialize error for key '{key}': {e}")
        return
    _mem_set(key, val, ttl)
    if not _redis_available():
        return
    try:
        if ttl:
            await redis_client.set(key, val, ex=ttl)
        else:
            await redis_client.set(key, val)
        _redis_ok()
    except Exception as e:
        logger.warning(f"Redis set_cache error for key '{key}': {e}")
        _redis_failed()

async def delete_cache(key: str):
    """Delete a specific key from Redis (+ memory mirror)."""
    _memory_cache.pop(key, None)
    if not _redis_available():
        return
    try:
        await redis_client.delete(key)
        _redis_ok()
    except Exception as e:
        logger.warning(f"Redis delete_cache error for key '{key}': {e}")
        _redis_failed()

async def clear_pattern(pattern: str):
    """Delete all keys matching pattern (e.g. 'departments:list:*', 'employees:list:*')."""
    try:
        for k in [k for k in list(_memory_cache.keys()) if _fnmatch.fnmatch(k, pattern)]:
            _memory_cache.pop(k, None)
    except Exception:
        pass
    if not _redis_available():
        return
    try:
        keys = []
        async for key in redis_client.scan_iter(match=pattern):
            keys.append(key)
        if keys:
            await redis_client.delete(*keys)
        _redis_ok()
    except Exception as e:
        logger.warning(f"Redis clear_pattern error for pattern '{pattern}': {e}")
        _redis_failed()

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
