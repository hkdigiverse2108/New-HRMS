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

class SubDepartmentDBModel(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    department_id: str
    name: str

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str}
    )

async def setup_sub_department_indexes(db):
    try:
        collection = db["sub_departments"]
        await collection.create_index("name", unique=False)
        # Assuming sub-department names might be same across different departments, 
        # so unique=False is safer unless we make compound index (department_id, name)
        await collection.create_index([("department_id", 1), ("name", 1)], unique=True)
        logger.info("Sub-department database indexes setup successfully.")
    except Exception as e:
        logger.error(f"Failed to setup sub-department indexes: {e}")
