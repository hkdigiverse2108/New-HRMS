from pydantic import BaseModel, Field, ConfigDict
from bson import ObjectId
from app.schemas.employee import PersonalInfo, WorkDetails, BankAndDocs, DocumentChecklist, BondAndExit
import logging
from typing import Any
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

class EmployeeDBModel(BaseModel):
    """
    આ પ્રોપર Database Model છે. આ દર્શાવે છે કે MongoDB માં ડેટા કઈ રીતે સ્ટોર થશે.
    """
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    personal_info: PersonalInfo
    work_details: WorkDetails
    bank_and_docs: BankAndDocs
    document_checklist: DocumentChecklist
    bond_and_exit: BondAndExit

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str}
    )

async def setup_employee_indexes(db):
    """
    ડેટાબેઝ લેવલ પર સિક્યોરિટી અને સ્પીડ માટે પ્રોપર Indexes.
    અહીં આપણે ઇમેઇલ ને UNIQUE બનાવીએ છીએ, જેથી MongoDB ક્યારેય ડુપ્લીકેટ ઇમેઇલ સેવ ના થવા દે.
    """
    try:
        collection = db["employees"]
        # Email ને Unique બનાવવાનો ઇન્ડેક્સ
        await collection.create_index("personal_info.email_address", unique=True)
        # નામ પરથી ફાસ્ટ સર્ચ કરવા માટેનો ઇન્ડેક્સ
        await collection.create_index([
            ("personal_info.first_name", 1), 
            ("personal_info.last_name", 1)
        ])
        logger.info("Employee database indexes setup successfully.")
    except Exception as e:
        logger.error(f"Failed to setup employee indexes: {e}")
