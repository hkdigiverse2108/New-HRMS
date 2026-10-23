from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings
import logging

logger = logging.getLogger(__name__)

class Database:
    client: AsyncIOMotorClient = None
    db = None

db = Database()

async def connect_to_mongo():
    try:
        logger.info("Connecting to MongoDB...")
        db.client = AsyncIOMotorClient(settings.MONGODB_URL)
        db.db = db.client[settings.MONGODB_DB_NAME]
        logger.info("Connected to MongoDB successfully!")
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB: {e}")

async def close_mongo_connection():
    try:
        if db.client:
            logger.info("Closing MongoDB connection...")
            db.client.close()
            logger.info("MongoDB connection closed.")
    except Exception as e:
        logger.error(f"Failed to close MongoDB connection: {e}")

def get_database():
    if db.db is None:
        if db.client is None:
            db.client = AsyncIOMotorClient(settings.MONGODB_URL)
        db.db = db.client[settings.MONGODB_DB_NAME]
    return db.db

def serialize_mongo_doc(data):
    """Recursively converts MongoDB ObjectId instances to strings."""
    from bson import ObjectId
    if isinstance(data, ObjectId):
        return str(data)
    if isinstance(data, dict):
        return {k: serialize_mongo_doc(v) for k, v in data.items()}
    if isinstance(data, list):
        return [serialize_mongo_doc(item) for item in data]
    return data
