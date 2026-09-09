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

class DepartmentDBModel(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    name: str

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str}
    )

async def setup_department_indexes(db):
    try:
        collection = db["departments"]
        await collection.create_index("name", unique=True)
        logger.info("Department database indexes setup successfully.")
    except Exception as e:
        logger.error(f"Failed to setup department indexes: {e}")
