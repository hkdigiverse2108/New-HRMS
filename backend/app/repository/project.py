from app.database.db import get_database
from datetime import datetime, date
from bson import ObjectId
from typing import Optional

class ProjectRepository:
    collection_name = "projects"

    @classmethod
    async def get_collection(cls):
        db = get_database()
        return db[cls.collection_name]

    @classmethod
    async def create(cls, data: dict):
        collection = await cls.get_collection()
        data["created_at"] = datetime.utcnow()
        data["updated_at"] = datetime.utcnow()
        data["is_deleted"] = False
        
        # Convert date to datetime for MongoDB
        if "general" in data and isinstance(data["general"], dict):
            for date_field in ["start_date", "end_date", "team_deadline"]:
                if date_field in data["general"] and isinstance(data["general"][date_field], date) and not isinstance(data["general"][date_field], datetime):
                    data["general"][date_field] = datetime.combine(data["general"][date_field], datetime.min.time())
                    
        if "finance" in data and data["finance"] and isinstance(data["finance"], dict):
            if "next_payment_date" in data["finance"] and isinstance(data["finance"]["next_payment_date"], date) and not isinstance(data["finance"]["next_payment_date"], datetime):
                data["finance"]["next_payment_date"] = datetime.combine(data["finance"]["next_payment_date"], datetime.min.time())
                
        result = await collection.insert_one(data)
        data["_id"] = str(result.inserted_id)
        return data

    @classmethod
    async def get_all(
        cls, 
        is_deleted: bool = False, 
        client_id: Optional[str] = None, 
        category: Optional[str] = None, 
        priority: Optional[str] = None, 
        status: Optional[str] = None, 
        search: Optional[str] = None, 
        whatsapp_status: Optional[str] = None,
        festival_posts: Optional[bool] = None,
        has_content_calendar: Optional[bool] = None,
        is_onhold: Optional[bool] = None,
        followup_due: Optional[bool] = None,
        feedback_due: Optional[bool] = None,
        cc_status: Optional[str] = None,
        page: Optional[int] = None, 
        limit: Optional[int] = None
    ):
        collection = await cls.get_collection()
        query = {"is_deleted": is_deleted}
        
        if client_id:
            query["client_id"] = client_id
        if category:
            clean_category = category.lower().replace(" ", "").replace("_", "")
            cat_map = {"development": "Development", "creative": "Creative", "digitalmarketing": "Digital Marketing", "sales": "Sales"}
            query["general.category"] = {"$in": [cat_map.get(clean_category, category), clean_category, category]}
        if priority:
            clean_priority = priority.lower().replace(" ", "").replace("_", "")
            pri_map = {"low": "Low", "medium": "Medium", "high": "High", "urgent": "Urgent"}
            query["general.priority"] = {"$in": [pri_map.get(clean_priority, priority), clean_priority, priority]}
        if status:
            clean_status = status.lower().replace(" ", "").replace("_", "")
            stat_map = {"notstarted": "Not Started", "inprogress": "In Progress", "onhold": "On Hold", "completed": "Completed", "cancelled": "Cancelled"}
            query["general.status"] = {"$in": [stat_map.get(clean_status, status), clean_status, status]}
            
        if search:
            query["general.project_name"] = {"$regex": search, "$options": "i"}
            
        if whatsapp_status:
            clean = whatsapp_status.lower().replace(" ", "")
            if clean == "groupcreated":
                query["whatsapp_group_link"] = {"$ne": None, "$exists": True}
            elif clean == "grouppending":
                query["whatsapp_group_link"] = {"$in": [None, ""]}
            elif clean == "greetingssent":
                query["greetings_msg_sent"] = True
            elif clean == "greetingspending":
                query["greetings_msg_sent"] = {"$ne": True}
                
        if festival_posts is not None:
            query["general.creative_stats.festival_posts_included"] = festival_posts
            
        if has_content_calendar is not None:
            query["has_content_calendar"] = has_content_calendar
            
        if is_onhold is not None:
            if is_onhold:
                query["general.status"] = "On Hold"
            else:
                query["general.status"] = {"$ne": "On Hold"}
                
        if followup_due:
            from datetime import datetime
            now = datetime.utcnow()
            query["next_followup_date"] = {"$lte": now, "$ne": None}
            
        if feedback_due:
            from datetime import datetime
            now = datetime.utcnow()
            query["next_feedback_date"] = {"$lte": now, "$ne": None}
            
        if cc_status:
            clean_cc = cc_status.lower().replace(" ", "")
            cc_map = {
                "pending": "Pending",
                "approvedbyclient": "Approved by Client",
                "changesrequested": "Changes Requested",
                "rejected": "Rejected"
            }
            query["content_approvals.status"] = cc_map.get(clean_cc, cc_status)
                
        total_count = await collection.count_documents(query)
        
        cursor = collection.find(query)
        
        if page and limit:
            skip = (page - 1) * limit
            cursor = cursor.skip(skip).limit(limit)
            
        items = await cursor.to_list(length=limit or 1000)
        
        for item in items:
            item["_id"] = str(item["_id"])
            
        return {
            "data": items,
            "total": total_count,
            "page": page or 1,
            "limit": limit or total_count or 1,
            "total_pages": (total_count + (limit or 1) - 1) // (limit or 1) if limit else 1
        }

    @classmethod
    async def get_by_id(cls, project_id: str):
        collection = await cls.get_collection()
        if not ObjectId.is_valid(project_id):
            return None
        item = await collection.find_one({"_id": ObjectId(project_id)})
        if item:
            item["_id"] = str(item["_id"])
        return item

    @classmethod
    async def update(cls, project_id: str, data: dict):
        collection = await cls.get_collection()
        if not ObjectId.is_valid(project_id):
            return False
            
        data["updated_at"] = datetime.utcnow()
        
        for date_field in ["start_date", "end_date", "team_deadline"]:
            if "general" in data and data["general"] and isinstance(data["general"], dict):
                if date_field in data["general"] and data["general"][date_field] and isinstance(data["general"][date_field], date) and not isinstance(data["general"][date_field], datetime):
                    data["general"][date_field] = datetime.combine(data["general"][date_field], datetime.min.time())
                    
        if "finance" in data and data["finance"] and isinstance(data["finance"], dict):
            if "next_payment_date" in data["finance"] and data["finance"]["next_payment_date"] and isinstance(data["finance"]["next_payment_date"], date) and not isinstance(data["finance"]["next_payment_date"], datetime):
                data["finance"]["next_payment_date"] = datetime.combine(data["finance"]["next_payment_date"], datetime.min.time())
                
        result = await collection.update_one(
            {"_id": ObjectId(project_id)},
            {"$set": data}
        )
        return result.modified_count > 0

    @classmethod
    async def delete(cls, project_id: str):
        collection = await cls.get_collection()
        if not ObjectId.is_valid(project_id):
            return False
            
        result = await collection.update_one(
            {"_id": ObjectId(project_id)},
            {"$set": {"is_deleted": True, "updated_at": datetime.utcnow()}}
        )
        return result.modified_count > 0

    @classmethod
    async def remove_campaign(cls, project_id: str, campaign_name: str):
        collection = await cls.get_collection()
        if not ObjectId.is_valid(project_id):
            return False
        
        result = await collection.update_one(
            {"_id": ObjectId(project_id)},
            {"$pull": {"campaigns": {"name": campaign_name}}}
        )
        return result.modified_count > 0
