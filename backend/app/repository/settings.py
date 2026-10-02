from app.database.db import get_database
from datetime import datetime
from typing import Dict, Any, Optional

class SettingsRepository:
    collection_name = "invoice_settings"

    @classmethod
    async def get_collection(cls):
        db = get_database()
        return db[cls.collection_name]

    @classmethod
    async def get_settings(cls) -> Dict[str, Any]:
        collection = await cls.get_collection()
        doc = await collection.find_one({})
        if doc:
            doc["_id"] = str(doc["_id"])
            return doc
        
        # Default document if not created yet
        default_doc = {
            "company_name": "Harikrushn DigiVerse LLP",
            "company_address": "FLAT-204, 2nd FLOOR, RS NO-67/1, WING-A, HARIKRUSHANA COMPLEX, OPP. BHAGAT NAGAR, VED, GURUKULROAD, KATARGAM, SURAT- 395004, Gujarat, INDIA...",
            "company_phone": "+919537150942",
            "company_email": "parthlathiya2004@gmail.com",
            "company_gstin": "24AAXFN3372M1ZK",
            "company_pan": "AAXFN3372M",
            "company_llpin": "ACK-1143",
            "company_state_code": "24",
            "logo_url": None,
            "letterhead_url": None,
            "signature_url": None,
            "signature_name": "Authorized Signatory",
            "default_terms": "1. Payment is due within 3 days of the invoice date.\n2. Late payments may incur additional charges.\n3. All disputes are subject to Gujarat Jurisdiction.",
            "bank_name": "Axis Bankk",
            "account_number": "9240200573774150",
            "ifsc_code": "UTIB00028912",
            "account_name": "Harikrushn DigiVerse LLP",
            "primary_color": "#C08497",
            "secondary_color": "#B5798C",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        res = await collection.insert_one(default_doc)
        default_doc["_id"] = str(res.inserted_id)
        return default_doc

    @classmethod
    async def save_or_update_settings(cls, data: dict) -> Dict[str, Any]:
        collection = await cls.get_collection()
        existing = await collection.find_one({})
        data["updated_at"] = datetime.utcnow()

        if existing:
            update_data = {k: v for k, v in data.items() if k != "_id"}
            await collection.update_one({"_id": existing["_id"]}, {"$set": update_data})
            return await cls.get_settings()
        else:
            data["created_at"] = datetime.utcnow()
            res = await collection.insert_one(data)
            data["_id"] = str(res.inserted_id)
            return data

InvoiceSettingsRepository = SettingsRepository
