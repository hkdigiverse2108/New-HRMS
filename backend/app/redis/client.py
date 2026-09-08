import redis.asyncio as redis
from app.config import settings

# Create the async Redis client instance
redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)

async def get_redis():
    """Dependency to get redis connection"""
    return redis_client
