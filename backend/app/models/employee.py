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

from typing import Any, Optional
import re

class EmployeeDBModel(BaseModel):
    """
    આ પ્રોપર Database Model છે. આ દર્શાવે છે કે MongoDB માં ડેટા કઈ રીતે સ્ટોર થશે.
    """
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    employee_id: Optional[str] = None
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

async def auto_assign_missing_employee_ids(db):
    """
    હયાત તમામ કર્મચારીઓ જેમને employee_id નથી તેમને ક્રમબદ્ધ EMP-001, EMP-002... અસાઇન કરે છે
    અને counters કલેક્શનને સિંક કરે છે જેથી ક્યારેય ડુપ્લીકેટ ના થાય.
    """
    try:
        collection = db["employees"]
        counters = db["counters"]
        cursor = collection.find({}).sort([("created_at", 1), ("_id", 1)])
        all_emps = await cursor.to_list(None)

        max_seq = 0
        unassigned = []
        for emp in all_emps:
            role = str((emp.get("work_details") or {}).get("system_role") or "Employee")
            if role == "Admin":
                continue # Admins do not have employee IDs
            emp_id_val = emp.get("employee_id") or (emp.get("work_details") or {}).get("employee_id")
            if emp_id_val and isinstance(emp_id_val, str):
                match = re.search(r"EMP-(\d+)", emp_id_val, re.IGNORECASE)
                if match:
                    seq_num = int(match.group(1))
                    if seq_num > max_seq:
                        max_seq = seq_num
            else:
                unassigned.append(emp)

        for emp in unassigned:
            max_seq += 1
            code = f"EMP-{max_seq:03d}"
            await collection.update_one(
                {"_id": emp["_id"]},
                {"$set": {
                    "employee_id": code,
                    "work_details.employee_id": code
                }}
            )

        counter_doc = await counters.find_one({"_id": "employee_id"})
        current_counter = counter_doc.get("seq", 0) if counter_doc else 0
        if max_seq > current_counter:
            await counters.update_one(
                {"_id": "employee_id"},
                {"$set": {"seq": max_seq}},
                upsert=True
            )
        logger.info(f"Auto-assigned employee IDs. Total employees: {len(all_emps)}, Max sequence: {max_seq}")
    except Exception as e:
        logger.error(f"Error in auto_assign_missing_employee_ids: {e}")

async def setup_employee_indexes(db):
    """
    ડેટાબેઝ લેવલ પર સિક્યોરિટી અને સ્પીડ માટે પ્રોપર Indexes.
    અહીં આપણે ઇમેઇલ અને Employee ID ને UNIQUE બનાવીએ છીએ, જેથી MongoDB ક્યારેય ડુપ્લીકેટ સેવ ના થવા દે.
    """
    try:
        collection = db["employees"]
        # 1. Backfill any missing employee_ids
        await auto_assign_missing_employee_ids(db)

        # 2. Email ને Unique બનાવવાનો ઇન્ડેક્સ
        await collection.create_index("personal_info.email_address", unique=True)
        # 3. નામ પરથી ફાસ્ટ સર્ચ કરવા માટેનો ઇન્ડેક્સ
        await collection.create_index([
            ("personal_info.first_name", 1), 
            ("personal_info.last_name", 1)
        ])
        # 4. Employee ID Unique index (sparse for non-admin employees only)
        await collection.create_index("employee_id", unique=True, sparse=True)
        await collection.create_index("work_details.employee_id")
        logger.info("Employee database indexes and IDs setup successfully.")
    except Exception as e:
        logger.error(f"Failed to setup employee indexes: {e}")
