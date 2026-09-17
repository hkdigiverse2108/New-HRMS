from pydantic import BaseModel, Field, ConfigDict
from bson import ObjectId
from datetime import datetime
from typing import Optional, Any
from pydantic_core import core_schema

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

class PenaltyTypeDBModel(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    name: str
    default_price: float
    description: Optional[str] = None

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str}
    )

class EmployeePenaltyDBModel(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    employee_id: PyObjectId
    penalty_type_id: PyObjectId
    price: float
    is_warning: bool = False
    status: str = "Active"  # "Active", "Resolved", "Waived"
    resolution_reason: Optional[str] = None
    impact_payroll: bool = True
    reason: Optional[str] = None
    is_deleted: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str}
    )

import logging
logger = logging.getLogger(__name__)

async def setup_penalty_indexes(db):
    try:
        pt_col = db["penalty_types"]
        await pt_col.create_index("name", unique=True)
        
        ep_col = db["employee_penalties"]
        await ep_col.create_index([("employee_id", 1), ("is_deleted", 1)])
        await ep_col.create_index([("penalty_type_id", 1)])
        await ep_col.create_index([("penalty_date", -1)])
        await ep_col.create_index([("status", 1)])
        logger.info("Penalty database indexes setup successfully.")
    except Exception as e:
        logger.warning(f"Failed to setup penalty indexes: {e}")

