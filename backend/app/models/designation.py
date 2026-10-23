from app.database.soft_delete_index import ensure_active_unique_index
from pydantic import BaseModel, Field, ConfigDict
from bson import ObjectId
import logging
from typing import Optional, Any
from pydantic_core import core_schema

logger = logging.getLogger(__name__)

class PyObjectId(ObjectId):
    @classmethod
    def __get_pydantic_core_schema__(
        cls, _source_type: Any, _handler: Any
    ) -> core_schema.CoreSchema:
        return core_schema.union_schema(
            [
                core_schema.is_instance_schema(ObjectId),
                core_schema.chain_schema(
                    [
                        core_schema.str_schema(),
                        core_schema.no_info_plain_validator_function(cls.validate),
                    ]
                ),
            ]
        )

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid objectid")
        return ObjectId(v)

class DesignationDBModel(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    name: str

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str}
    )

async def setup_designation_indexes(db):
    try:
        collection = db["designations"]
        # Backfill name from title if missing/null to prevent duplicate null key index errors
        async for doc in collection.find({"$or": [{"name": {"$exists": False}}, {"name": None}, {"name": ""}]}):
            title_val = doc.get("title")
            if title_val and str(title_val).strip():
                await collection.update_one(
                    {"_id": doc["_id"]},
                    {"$set": {"name": str(title_val).strip(), "title": str(title_val).strip()}}
                )
            else:
                await collection.update_one(
                    {"_id": doc["_id"]},
                    {"$set": {"is_deleted": True}}
                )

        # Also sync title from name if missing
        async for doc in collection.find({"$or": [{"title": {"$exists": False}}, {"title": None}, {"title": ""}]}):
            name_val = doc.get("name")
            if name_val and str(name_val).strip():
                await collection.update_one(
                    {"_id": doc["_id"]},
                    {"$set": {"title": str(name_val).strip()}}
                )

        await ensure_active_unique_index(collection, [("name", 1)])
        logger.info("Designation database indexes setup successfully.")
    except Exception as e:
        logger.error(f"Failed to setup designation indexes: {e}")
