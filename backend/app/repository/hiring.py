import re
from app.database.db import get_database
from bson import ObjectId
from datetime import datetime
from typing import List, Dict, Any, Optional
from datetime import timedelta
from app.repository.employee import EmployeeRepository

class HiringRepository:
    collection_name = "hirings"

    @classmethod
    async def get_collection(cls):
        db = get_database()
        return db[cls.collection_name]

    @classmethod
    async def get_hiring_managers(cls) -> List[Dict[str, Any]]:
        """Returns a list of all active employees to populate the Hiring Manager dropdown."""
        db = get_database()
        emp_collection = db["employees"]
        cursor = emp_collection.find({"is_deleted": {"$ne": True}}).sort("personal_info.first_name", 1)
        
        managers = []
        async for emp in cursor:
            emp_id = str(emp.get("_id") or emp.get("employee_id"))
            p_info = emp.get("personal_info", {}) or {}
            w_info = emp.get("work_details", {}) or {}
            first_name = p_info.get("first_name") or emp.get("first_name", "")
            last_name = p_info.get("last_name") or emp.get("last_name", "")
            full_name = f"{first_name} {last_name}".strip() or f"Employee #{emp_id[:6]}"
            
            managers.append({
                "employee_id": emp_id,
                "full_name": full_name,
                "email": p_info.get("email_address") or emp.get("email", ""),
                "department": w_info.get("department") or "",
                "designation": w_info.get("designation") or w_info.get("job_title") or "",
                "profile_picture": p_info.get("profile_picture") or ""
            })
        return managers

    @classmethod
    async def _populate_hiring_manager(cls, doc: dict) -> dict:
        if not doc:
            return doc
        
        hm_id = doc.get("hiring_manager_id")
        if not hm_id and isinstance(doc.get("hiring_manager"), dict):
            hm_id = doc["hiring_manager"].get("employee_id")

        if hm_id and str(hm_id).strip():
            emp = await EmployeeRepository.get_employee_by_id(str(hm_id))
            if emp:
                p_info = emp.get("personal_info", {}) or {}
                w_info = emp.get("work_details", {}) or {}
                first_name = p_info.get("first_name") or emp.get("first_name", "")
                last_name = p_info.get("last_name") or emp.get("last_name", "")
                
                doc["hiring_manager"] = {
                    "employee_id": str(emp.get("_id") or emp.get("employee_id")),
                    "full_name": f"{first_name} {last_name}".strip(),
                    "email": p_info.get("email_address") or emp.get("email", ""),
                    "department": w_info.get("department") or "",
                    "designation": w_info.get("designation") or w_info.get("job_title") or "",
                    "profile_picture": p_info.get("profile_picture") or ""
                }
            else:
                doc["hiring_manager"] = None
        else:
            doc["hiring_manager"] = None

        return doc

    @classmethod
    async def create_hiring(cls, data: dict) -> Dict[str, Any]:
        collection = await cls.get_collection()
        now = datetime.utcnow()
        posted_d = data.get("posted_date") or now.strftime("%Y-%m-%d")
        desc = data.get("job_description") or data.get("description")

        doc = {
            "job_title": str(data.get("job_title", "")).strip(),
            "department": str(data.get("department", "")).strip(),
            "location": str(data.get("location", "")).strip(),
            "employment_type": str(data.get("employment_type", "Full-time")).strip(),
            "status": str(data.get("status", "Open")).strip(),
            "applications_count": int(data.get("applications_count", 0) or 0),
            "posted_date": str(posted_d).strip(),
            "experience": str(data.get("experience", "")).strip() if data.get("experience") else None,
            "salary_range": str(data.get("salary_range", "")).strip() if data.get("salary_range") else None,
            "job_description": str(desc).strip() if desc else None,
            "hiring_manager_id": str(data.get("hiring_manager_id")).strip() if data.get("hiring_manager_id") else None,
            "created_by": data.get("created_by"),
            "is_deleted": False,
            "created_at": now,
            "updated_at": now
        }
        res = await collection.insert_one(doc)
        doc["_id"] = str(res.inserted_id)
        doc = await cls._populate_hiring_manager(doc)
        return doc

    @classmethod
    async def get_all_hirings(
        cls,
        is_deleted: bool = False,
        department: Optional[str] = None,
        employment_type: Optional[str] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
        filter_emp_id: Optional[str] = None
    ) -> tuple[List[Dict[str, Any]], int]:
        collection = await cls.get_collection()
        query: Dict[str, Any] = {"is_deleted": is_deleted}

        if department and department.strip().lower() != "all":
            query["department"] = {"$regex": f"^{re.escape(department.strip())}$", "$options": "i"}

        if employment_type and employment_type.strip().lower() != "all":
            query["employment_type"] = {"$regex": f"^{re.escape(employment_type.strip())}$", "$options": "i"}

        if status and status.strip().lower() != "all":
            query["status"] = {"$regex": f"^{re.escape(status.strip())}$", "$options": "i"}

        if search and search.strip():
            s = re.escape(search.strip())
            query["$or"] = [
                {"job_title": {"$regex": s, "$options": "i"}},
                {"department": {"$regex": s, "$options": "i"}},
                {"location": {"$regex": s, "$options": "i"}},
                {"experience": {"$regex": s, "$options": "i"}},
                {"salary_range": {"$regex": s, "$options": "i"}},
                {"job_description": {"$regex": s, "$options": "i"}}
            ]

        total_count = await collection.count_documents(query)

        cursor = collection.find(query).sort("created_at", -1)
        if skip > 0:
            cursor = cursor.skip(skip)
        if limit > 0:
            cursor = cursor.limit(limit)
            
        items = []
        ref_collection = await cls.get_referral_collection()
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            doc = await cls._populate_hiring_manager(doc)
            
            # Fetch referrals
            ref_query: Dict[str, Any] = {"hiring_id": doc["_id"], "is_deleted": False}
            if filter_emp_id:
                ref_query["referred_by.employee_id"] = filter_emp_id
            
            ref_cursor = ref_collection.find(ref_query).sort("created_at", -1)
            referrals = []
            async for r_doc in ref_cursor:
                r_doc["_id"] = str(r_doc["_id"])
                referrals.append(r_doc)
            doc["referrals"] = referrals
            
            items.append(doc)

        return items, total_count

    @classmethod
    async def get_hiring_by_id(cls, hiring_id: str, filter_emp_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        collection = await cls.get_collection()
        if not ObjectId.is_valid(hiring_id):
            return None
        doc = await collection.find_one({"_id": ObjectId(hiring_id), "is_deleted": False})
        if doc:
            doc["_id"] = str(doc["_id"])
            doc = await cls._populate_hiring_manager(doc)
            
            # Fetch referrals
            ref_collection = await cls.get_referral_collection()
            ref_query: Dict[str, Any] = {"hiring_id": doc["_id"], "is_deleted": False}
            if filter_emp_id:
                ref_query["referred_by.employee_id"] = filter_emp_id
                
            ref_cursor = ref_collection.find(ref_query).sort("created_at", -1)
            referrals = []
            async for r_doc in ref_cursor:
                r_doc["_id"] = str(r_doc["_id"])
                referrals.append(r_doc)
            doc["referrals"] = referrals
            
        return doc

    @classmethod
    async def update_hiring(cls, hiring_id: str, update_data: dict) -> bool:
        collection = await cls.get_collection()
        if not ObjectId.is_valid(hiring_id):
            return False

        payload: Dict[str, Any] = {"updated_at": datetime.utcnow()}
        fields = [
            "job_title", "department", "location", "employment_type", "status",
            "applications_count", "posted_date", "experience", "salary_range",
            "job_description", "description", "hiring_manager_id"
        ]
        
        for k in fields:
            if k in update_data and update_data[k] is not None:
                if k in ["job_description", "description"]:
                    payload["job_description"] = update_data[k]
                else:
                    payload[k] = update_data[k]

        res = await collection.update_one(
            {"_id": ObjectId(hiring_id), "is_deleted": False},
            {"$set": payload}
        )
        return res.modified_count > 0 or res.matched_count > 0

    @classmethod
    async def delete_hiring(cls, hiring_id: str) -> bool:
        collection = await cls.get_collection()
        if not ObjectId.is_valid(hiring_id):
            return False
        res = await collection.update_one(
            {"_id": ObjectId(hiring_id)},
            {"$set": {"is_deleted": True, "updated_at": datetime.utcnow()}}
        )
        return res.modified_count > 0

    @classmethod
    async def get_referral_collection(cls):
        db = get_database()
        return db["job_referrals"]

    @classmethod
    async def create_referral(cls, data: dict) -> Dict[str, Any]:
        collection = await cls.get_referral_collection()
        now = datetime.utcnow()

        h_id = str(data.get("hiring_id", "")).strip()

        doc = {
            "hiring_id": h_id,
            "job_title": str(data.get("job_title", "")).strip(),
            "department": str(data.get("department", "")).strip(),
            "candidate_name": str(data.get("candidate_name", "")).strip(),
            "candidate_email": str(data.get("candidate_email", "")).strip(),
            "linkedin_profile": str(data.get("linkedin_profile", "")).strip() if data.get("linkedin_profile") else None,
            "resume_url": str(data.get("resume_url", "")).strip() if data.get("resume_url") else None,
            "why_good_fit": str(data.get("why_good_fit", "")).strip() if data.get("why_good_fit") else None,
            "hr_notes": str(data.get("hr_notes", "")).strip() if data.get("hr_notes") else None,
            "status": str(data.get("status", "Pending")).strip(),
            "referred_by": data.get("referred_by"),
            "is_deleted": False,
            "created_at": now,
            "updated_at": now
        }
        res = await collection.insert_one(doc)
        doc["_id"] = str(res.inserted_id)

        # Auto-increment applications_count on the hiring job posting
        if h_id and ObjectId.is_valid(h_id):
            h_coll = await cls.get_collection()
            await h_coll.update_one(
                {"_id": ObjectId(h_id)},
                {"$inc": {"applications_count": 1}}
            )

        return doc

    @classmethod
    async def get_all_referrals(
        cls,
        is_deleted: bool = False,
        hiring_id: Optional[str] = None,
        referred_by_employee_id: Optional[str] = None,
        status: Optional[str] = None,
        search: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        collection = await cls.get_referral_collection()
        query: Dict[str, Any] = {"is_deleted": is_deleted}

        if hiring_id and hiring_id.strip():
            query["hiring_id"] = hiring_id.strip()

        if referred_by_employee_id and referred_by_employee_id.strip():
            query["referred_by.employee_id"] = referred_by_employee_id.strip()

        if status and status.strip().lower() != "all":
            query["status"] = {"$regex": f"^{re.escape(status.strip())}$", "$options": "i"}

        if search and search.strip():
            s = re.escape(search.strip())
            query["$or"] = [
                {"candidate_name": {"$regex": s, "$options": "i"}},
                {"candidate_email": {"$regex": s, "$options": "i"}},
                {"job_title": {"$regex": s, "$options": "i"}},
                {"why_good_fit": {"$regex": s, "$options": "i"}}
            ]

        cursor = collection.find(query).sort("created_at", -1)
        items = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            items.append(doc)

        return items

    @classmethod
    async def get_referral_by_id(cls, referral_id: str) -> Optional[Dict[str, Any]]:
        collection = await cls.get_referral_collection()
        if not ObjectId.is_valid(referral_id):
            return None
        doc = await collection.find_one({"_id": ObjectId(referral_id), "is_deleted": False})
        if doc:
            doc["_id"] = str(doc["_id"])
        return doc

    @classmethod
    async def update_referral(cls, referral_id: str, update_data: dict) -> bool:
        collection = await cls.get_referral_collection()
        if not ObjectId.is_valid(referral_id):
            return False

        payload: Dict[str, Any] = {"updated_at": datetime.utcnow()}
        fields = ["candidate_name", "candidate_email", "linkedin_profile", "resume_url", "why_good_fit", "status", "hr_notes"]

        for k in fields:
            if k in update_data and update_data[k] is not None:
                payload[k] = update_data[k]

        res = await collection.update_one(
            {"_id": ObjectId(referral_id), "is_deleted": False},
            {"$set": payload}
        )
        return res.modified_count > 0 or res.matched_count > 0

    @classmethod
    async def delete_referral(cls, referral_id: str) -> bool:
        collection = await cls.get_referral_collection()
        if not ObjectId.is_valid(referral_id):
            return False

        existing = await collection.find_one({"_id": ObjectId(referral_id)})
        if not existing:
            return False

        res = await collection.update_one(
            {"_id": ObjectId(referral_id)},
            {"$set": {"is_deleted": True, "updated_at": datetime.utcnow()}}
        )

        # Auto-decrement applications_count on the hiring job posting if soft deleted
        if res.modified_count > 0 and existing.get("hiring_id"):
            h_id = existing.get("hiring_id")
            if ObjectId.is_valid(h_id):
                h_coll = await cls.get_collection()
                await h_coll.update_one(
                    {"_id": ObjectId(h_id)},
                    {"$inc": {"applications_count": -1}}
                )

        return res.modified_count > 0

    @classmethod
    async def get_dashboard_summary(cls) -> Dict[str, Any]:
        db = get_database()
        hirings_coll = db["hirings"]
        referrals_coll = db["job_referrals"]
        interviews_coll = db["interview_schedules"]

        now = datetime.utcnow()
        first_day_this_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        last_month = first_day_this_month - timedelta(days=1)
        first_day_last_month = last_month.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # 1. Active Jobs
        active_jobs_count = await hirings_coll.count_documents({"is_deleted": False, "status": "Open"})
        jobs_this_month = await hirings_coll.count_documents({
            "is_deleted": False,
            "status": "Open",
            "created_at": {"$gte": first_day_this_month}
        })

        # 2. Total Applicants
        total_applicants_count = await referrals_coll.count_documents({"is_deleted": False})
        applicants_this_month = await referrals_coll.count_documents({
            "is_deleted": False,
            "created_at": {"$gte": first_day_this_month}
        })
        applicants_last_month = await referrals_coll.count_documents({
            "is_deleted": False,
            "created_at": {"$gte": first_day_last_month, "$lt": first_day_this_month}
        })

        applicant_trend = ""
        if applicants_last_month > 0:
            diff = applicants_this_month - applicants_last_month
            percent = (diff / applicants_last_month) * 100
            if percent >= 0:
                applicant_trend = f"+{int(percent)}% vs last month"
            else:
                applicant_trend = f"{int(percent)}% vs last month"
        else:
            applicant_trend = f"+{applicants_this_month} this month"

        # 3. Interviews Scheduled
        interviews_count = await interviews_coll.count_documents({"is_deleted": False})
        start_of_week = now - timedelta(days=now.weekday())
        start_of_week = start_of_week.replace(hour=0, minute=0, second=0, microsecond=0)
        interviews_this_week = await interviews_coll.count_documents({
            "is_deleted": False,
            "created_at": {"$gte": start_of_week}
        })

        # 4. Offers Extended (Check for 'Hired', 'Offered', 'Selected', 'Offer')
        offers_count = await referrals_coll.count_documents({
            "is_deleted": False,
            "status": {"$regex": "(?i)^(hired|offered|selected|offer extended)$"}
        })
        accepted_count = await referrals_coll.count_documents({
            "is_deleted": False,
            "status": {"$regex": "(?i)^(hired|accepted)$"}
        })

        return {
            "active_jobs": {
                "count": active_jobs_count,
                "trend_text": f"+{jobs_this_month} this month" if jobs_this_month > 0 else "0 this month"
            },
            "total_applicants": {
                "count": total_applicants_count,
                "trend_text": applicant_trend
            },
            "interviews_scheduled": {
                "count": interviews_count,
                "trend_text": f"+{interviews_this_week} this week" if interviews_this_week > 0 else "0 this week"
            },
            "offers_extended": {
                "count": offers_count,
                "trend_text": f"{accepted_count} accepted"
            }
        }
