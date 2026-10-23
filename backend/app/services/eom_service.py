from datetime import datetime, date, timedelta
from bson import ObjectId
import pytz
import calendar
from pymongo import UpdateOne
from dateutil.parser import parse
from app.database.db import get_database
from app.redis.service import clear_pattern
from app.repository.election import ElectionRepository as crud

IST = pytz.timezone('Asia/Kolkata')

class DBProxy:
    def __getattr__(self, name):
        return get_database()[name]
    def __getitem__(self, name):
        return get_database()[name]

db = DBProxy()

class RedisProxy:
    async def invalidate_namespace(self, ns: str):
        try:
            await clear_pattern(f"{ns}*")
        except Exception:
            pass

redis_manager = RedisProxy()

def stringify_object_ids(obj):
    if isinstance(obj, ObjectId):
        return str(obj)
    if isinstance(obj, dict):
        return {str(k): stringify_object_ids(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [stringify_object_ids(item) for item in obj]
    return obj

def get_emp_display_name(emp: dict) -> str:
    if not emp:
        return "Employee"
    pi = emp.get("personal_info") or {}
    fn = pi.get("first_name", "")
    ln = pi.get("last_name", "")
    if fn:
        return f"{fn} {ln}".strip()
    return emp.get("name") or f"{emp.get('firstName', '')} {emp.get('lastName', '')}".strip() or "Employee"

def get_emp_dept(emp: dict) -> str:
    if not emp:
        return "General"
    wd = emp.get("work_details") or {}
    return wd.get("department") or emp.get("department") or "General"

def get_emp_desig(emp: dict) -> str:
    if not emp:
        return "Staff"
    wd = emp.get("work_details") or {}
    return wd.get("designation") or emp.get("designation") or "Staff"

def get_emp_role(emp: dict) -> str:
    if not emp:
        return "Employee"
    wd = emp.get("work_details") or {}
    return wd.get("system_role") or emp.get("role") or "Employee"

FIXED_CRITERIA_DEFAULTS = [
    {"name": "VOTE", "maxScore": 10, "isFixed": True, "order": 1},
    {"name": "DISCIPLINE", "maxScore": 10, "isFixed": True, "order": 2},
    {"name": "Work Completion", "maxScore": 15, "isFixed": True, "order": 3},
    {"name": "ATTENDANCE", "maxScore": 15, "isFixed": True, "order": 4},
    {"name": "Supportive", "maxScore": 15, "isFixed": True, "order": 5},
    {"name": "Communication", "maxScore": 15, "isFixed": False, "order": 6},
    {"name": "PERFORMANCE", "maxScore": 20, "isFixed": False, "order": 7},
]

# --- MASTER TEMPLATE MANAGEMENT ---

async def get_or_init_master_criteria():
    master = await db.eom_master_criteria.find({}).sort("order", 1).to_list(length=100)
    if not master:
        for idx, item in enumerate(FIXED_CRITERIA_DEFAULTS, start=1):
            doc = {
                "name": item["name"],
                "maxScore": item["maxScore"],
                "isFixed": item["isFixed"],
                "order": item["order"],
                "assignedPersonIds": [],
                "createdAt": datetime.now(IST)
            }
            res = await db.eom_master_criteria.insert_one(doc)
            doc["id"] = str(res.inserted_id)
            if "_id" in doc:
                del doc["_id"]
            master.append(doc)
    else:
        for m in master:
            m["id"] = str(m.get("_id", m.get("id")))
            if "_id" in m:
                del m["_id"]
    return master

async def save_master_criteria(criteria_list: list):
    await db.eom_master_criteria.delete_many({})
    saved = []
    for idx, c in enumerate(criteria_list, start=1):
        doc = {
            "name": c.get("name", "").strip(),
            "maxScore": float(c.get("maxScore", 0)),
            "isFixed": c.get("isFixed", False),
            "entryType": c.get("entryType", "direct"),
            "category": c.get("category", "+ve"),
            "order": idx,
            "assignedPersonIds": c.get("assignedPersonIds", []),
            "updatedAt": datetime.now(IST)
        }
        res = await db.eom_master_criteria.insert_one(doc)
        doc["id"] = str(res.inserted_id)
        if "_id" in doc:
            del doc["_id"]
        saved.append(doc)
    await redis_manager.invalidate_namespace("hrms:eom")
    return saved

# --- EMPLOYEE OF THE MONTH (PER-MONTH CRITERIA & SCORES) ---

async def get_or_init_criteria(month_year: str):
    criteria = await db.eom_criteria.find({"month_year": month_year}).sort("order", 1).to_list(length=100)
    if not criteria:
        # Copy from Master Template if month-specific criteria don't exist yet!
        master = await get_or_init_master_criteria()
        for idx, item in enumerate(master, start=1):
            doc = {
                "month_year": month_year,
                "name": item["name"],
                "maxScore": item["maxScore"],
                "isFixed": item.get("isFixed", False),
                "entryType": item.get("entryType", "direct"),
                "category": item.get("category", "+ve"),
                "order": idx,
                "assignedPersonIds": item.get("assignedPersonIds", []),
                "createdAt": datetime.now(IST)
            }
            res = await db.eom_criteria.insert_one(doc)
            doc["id"] = str(res.inserted_id)
            if "_id" in doc:
                del doc["_id"]
            criteria.append(doc)
    else:
        for c in criteria:
            c["id"] = str(c.get("_id", c.get("id")))
            if "_id" in c:
                del c["_id"]
    return criteria

async def save_criteria(month_year: str, criteria_list: list, expected_total: float = None):
    total_score = sum(float(c.get("maxScore", 0)) for c in criteria_list)
    if expected_total is not None and abs(total_score - expected_total) > 0.01:
        raise ValueError(f"Total max score must be exactly {expected_total}. Current total is {round(total_score, 2)}.")
    
    # Process and upsert per-month criteria independently from Master Template
    saved_criteria = []
    existing_ids = []
    
    for idx, c in enumerate(criteria_list, start=1):
        cid = c.get("id")
        c_name = c.get("name", "").strip()
        is_fixed = c.get("isFixed", False)
        
        doc = {
            "month_year": month_year,
            "name": c_name,
            "maxScore": float(c.get("maxScore", 0)),
            "isFixed": is_fixed,
            "entryType": c.get("entryType", "direct"),
            "category": c.get("category", "+ve"),
            "order": idx,
            "assignedPersonIds": c.get("assignedPersonIds", []),
            "updatedAt": datetime.now(IST)
        }
        
        if cid and len(cid) == 24:
            await db.eom_criteria.update_one({"_id": ObjectId(cid)}, {"$set": doc})
            doc["id"] = cid
            existing_ids.append(ObjectId(cid))
        else:
            doc["createdAt"] = datetime.now(IST)
            res = await db.eom_criteria.insert_one(doc)
            doc["id"] = str(res.inserted_id)
            existing_ids.append(res.inserted_id)
            if "_id" in doc:
                del doc["_id"]
        saved_criteria.append(doc)

    # Clean up criteria removed in this update for this specific month_year
    await db.eom_criteria.delete_many({
        "month_year": month_year,
        "_id": {"$nin": existing_ids}
    })

    return saved_criteria

def compute_hybrid_rank_and_score(entries: list, category_type: str, max_score: float):
    """
    Dynamic Rank-to-Score Formula Solver:
    Let N = Total number of employees
    Equal Step Width: I = max_score / (N - 1)
    Score for Rank R: Score = max_score - ((R - 1) * I)
    Tied values receive identical ranks (e.g., two Rank 1s). The subsequent rank is skipped (1, 1, 3, 4...).
    """
    N = len(entries)
    if N == 0:
        return []

    I = (max_score / (N - 1)) if N > 1 else 0.0
    has_quantity = any(e.get("quantity") is not None and str(e.get("quantity")).strip() != "" for e in entries)

    if has_quantity:
        reverse = (category_type != "-ve")
        def parse_qty(v):
            try:
                return float(v)
            except (ValueError, TypeError):
                return float('-inf') if reverse else float('inf')

        sorted_entries = sorted(entries, key=lambda x: parse_qty(x.get("quantity")), reverse=reverse)
        computed = []
        for idx, item in enumerate(sorted_entries):
            q_val = parse_qty(item.get("quantity"))
            if idx > 0:
                prev_q = parse_qty(sorted_entries[idx - 1].get("quantity"))
                if q_val == prev_q and q_val not in (float('-inf'), float('inf')):
                    item_rank = computed[-1]["rank"]
                else:
                    item_rank = idx + 1
            else:
                item_rank = 1

            score = max_score - ((item_rank - 1) * I)
            score = max(0.0, min(max_score, score))

            computed.append({
                "employeeId": item["employeeId"],
                "quantity": float(item["quantity"]) if item.get("quantity") is not None and str(item.get("quantity")).strip() != "" else None,
                "rank": item_rank,
                "score": round(score, 2)
            })
        return computed
    else:
        computed = []
        for item in entries:
            r = item.get("manualRank")
            if r is not None and str(r).strip() != "" and int(r) > 0:
                item_rank = int(r)
                score = max_score - ((item_rank - 1) * I)
                score = max(0.0, min(max_score, score))
            else:
                item_rank = None
                try:
                    score = float(item.get("score", 0))
                except (ValueError, TypeError):
                    score = 0.0

            computed.append({
                "employeeId": item["employeeId"],
                "quantity": None,
                "rank": item_rank,
                "score": round(score, 2)
            })
        return computed

async def bulk_save_hybrid_scores(month_year: str, criteria_id: str, category_type: str, max_score: float, entries: list, scored_by: str = "System"):
    computed_results = compute_hybrid_rank_and_score(entries, category_type, max_score)
    saved_scores = []
    for res in computed_results:
        s_doc = await save_score(
            month_year=month_year,
            criteria_id=criteria_id,
            employee_id=res["employeeId"],
            score=res["score"],
            raw_quantity=res.get("quantity"),
            calculated_rank=res.get("rank"),
            scored_by=scored_by
        )
        saved_scores.append(s_doc)
    return saved_scores

async def get_eom_reveal_order(month_year: str):
    criteria_list = await get_or_init_criteria(month_year)
    if not criteria_list:
        return {"month_year": month_year, "stages": [], "totalStages": 0}

    vote_criteria = next((c for c in criteria_list if "vote" in str(c.get("name", "")).lower()), None)
    other_criteria = [c for c in criteria_list if c != vote_criteria]

    stages = []
    if vote_criteria:
        stages.append({
            "stageIndex": 1,
            "type": "VOTE_BASELINE",
            "criteria": vote_criteria
        })
        start_idx = 2
    else:
        start_idx = 1

    for idx, crit in enumerate(other_criteria, start=start_idx):
        is_final = (idx == len(criteria_list))
        stages.append({
            "stageIndex": idx,
            "type": "GRAND_FINALE" if is_final else "PROGRESSIVE_REVEAL",
            "criteria": crit
        })

    return {
        "month_year": month_year,
        "stages": stages,
        "totalStages": len(stages)
    }

ADMIN_ROLES = {"admin", "super admin", "superadmin", "administrator", "founder"}

def is_admin_employee(emp: dict) -> bool:
    if not emp:
        return False
    wd = emp.get("work_details") or {}
    role = str(wd.get("system_role") or emp.get("role") or wd.get("designation") or emp.get("designation") or "").lower().strip()
    return role in ADMIN_ROLES

async def get_month_config(month_year: str):
    config = await db.eom_month_config.find_one({"month_year": month_year})
    if not config:
        return {
            "month_year": month_year,
            "isConfigured": False,
            "selectedEmployeeIds": None,
            "revealDateTime": None
        }
    return {
        "month_year": month_year,
        "isConfigured": True,
        "selectedEmployeeIds": config.get("selectedEmployeeIds", []),
        "revealDateTime": config.get("revealDateTime", None)
    }

async def save_month_config(month_year: str, selected_employee_ids: list = None, reveal_date_time: str = None):
    existing = await db.eom_month_config.find_one({"month_year": month_year}) or {}
    update_fields = {"updatedAt": datetime.now(IST)}
    if selected_employee_ids is not None:
        update_fields["selectedEmployeeIds"] = selected_employee_ids
    else:
        update_fields["selectedEmployeeIds"] = existing.get("selectedEmployeeIds", None)
    
    if reveal_date_time is not None:
        update_fields["revealDateTime"] = reveal_date_time
    elif "revealDateTime" in existing:
        update_fields["revealDateTime"] = existing["revealDateTime"]

    await db.eom_month_config.update_one(
        {"month_year": month_year},
        {"$set": update_fields},
        upsert=True
    )
    await redis_manager.invalidate_namespace("hrms:eom")
    return await get_month_config(month_year)

async def clone_criteria(from_month_year: str, to_month_year: str):
    source_criteria = await db.eom_criteria.find({"month_year": from_month_year}).sort("order", 1).to_list(length=100)
    if not source_criteria:
        return await get_or_init_criteria(to_month_year)
    
    # Delete existing criteria for to_month_year
    await db.eom_criteria.delete_many({"month_year": to_month_year})
    
    cloned = []
    for item in source_criteria:
        doc = {
            "month_year": to_month_year,
            "name": item["name"],
            "maxScore": item["maxScore"],
            "isFixed": item.get("isFixed", False),
            "order": item.get("order", 1),
            "assignedPersonIds": item.get("assignedPersonIds", []),
            "createdAt": datetime.now(IST)
        }
        res = await db.eom_criteria.insert_one(doc)
        doc["id"] = str(res.inserted_id)
        if "_id" in doc:
            del doc["_id"]
        cloned.append(doc)
    return cloned

from pymongo import UpdateOne

async def save_score(month_year: str, criteria_id: str, employee_id: str, score: float, raw_quantity: float = None, calculated_rank: int = None, scored_by: str = "System", evaluator_id: str = None):
    criteria_doc = await db.eom_criteria.find_one({"_id": ObjectId(criteria_id) if len(criteria_id) == 24 else criteria_id}) or {}
    is_multi_admin = criteria_doc.get("entryType") == "multi_admin" or len(criteria_doc.get("assignedPersonIds", [])) > 0

    doc = {
        "month_year": month_year,
        "criteriaId": criteria_id,
        "employeeId": employee_id,
        "scoredBy": scored_by,
        "evaluatorId": evaluator_id or scored_by,
        "score": float(score),
        "rawQuantity": raw_quantity,
        "calculatedRank": calculated_rank,
        "submittedAt": datetime.now(IST)
    }

    filter_query = {
        "month_year": month_year,
        "criteriaId": criteria_id,
        "employeeId": employee_id
    }
    if is_multi_admin:
        filter_query["scoredBy"] = scored_by

    await db.eom_scores.update_one(
        filter_query,
        {"$set": doc},
        upsert=True
    )
    return doc

async def bulk_save_all_matrix(month_year: str, scores_list: list, scored_by: str = "System", evaluator_id: str = None):
    if not scores_list:
        return {"savedCount": 0}

    criteria_docs = await db.eom_criteria.find({"month_year": month_year}).to_list(length=100)
    multi_admin_crit_ids = set(
        str(c.get("_id") or c.get("id"))
        for c in criteria_docs
        if c.get("entryType") == "multi_admin" or len(c.get("assignedPersonIds", [])) > 0
    )

    now_ist = datetime.now(IST)
    ops = []
    for item in scores_list:
        c_id = str(item.get("criteriaId"))
        e_id = str(item.get("employeeId"))
        sc = float(item.get("score", 0))
        raw_qty = item.get("rawQuantity")
        calc_rank = item.get("calculatedRank")

        doc = {
            "month_year": month_year,
            "criteriaId": c_id,
            "employeeId": e_id,
            "scoredBy": scored_by,
            "evaluatorId": evaluator_id or scored_by,
            "score": sc,
            "rawQuantity": raw_qty,
            "calculatedRank": calc_rank,
            "submittedAt": now_ist
        }

        filter_query = {
            "month_year": month_year,
            "criteriaId": c_id,
            "employeeId": e_id
        }
        if c_id in multi_admin_crit_ids:
            filter_query["scoredBy"] = scored_by

        ops.append(
            UpdateOne(
                filter_query,
                {"$set": doc},
                upsert=True
            )
        )

    if ops:
        res = await db.eom_scores.bulk_write(ops, ordered=False)
        return {
            "savedCount": len(ops),
            "upsertedCount": res.upserted_count,
            "modifiedCount": res.modified_count
        }
    return {"savedCount": 0}

async def get_scores(month_year: str, criteria_id: str = None, scored_by: str = None):
    query = {"month_year": month_year}
    if criteria_id:
        query["criteriaId"] = criteria_id
    if scored_by:
        query["scoredBy"] = scored_by
    scores = await db.eom_scores.find(query).sort("submittedAt", 1).to_list(length=5000)
    for s in scores:
        s["id"] = str(s.get("_id", s.get("id")))
        if "_id" in s:
            del s["_id"]
    return scores

import calendar
from datetime import date, datetime

async def get_eom_attendance_stats(month_year: str, max_score: float = 15.0):
    try:
        parts = month_year.split("-")
        year, month = int(parts[0]), int(parts[1])
    except Exception:
        now_dt = datetime.now()
        year, month = now_dt.year, now_dt.month

    num_days = calendar.monthrange(year, month)[1]
    
    # 1. Calculate Sundays in month
    sundays = 0
    sunday_dates = set()
    for day in range(1, num_days + 1):
        d = date(year, month, day)
        if d.weekday() == 6: # Sunday
            sundays += 1
            sunday_dates.add(f"{year:04d}-{month:02d}-{day:02d}")

    # 2. Fetch Company Holidays for month (excluding Sundays)
    start_dt = datetime(year, month, 1, 0, 0, 0)
    end_dt = datetime(year, month, num_days, 23, 59, 59)
    start_str = f"{year:04d}-{month:02d}-01"
    end_str = f"{year:04d}-{month:02d}-{num_days:02d}"

    holidays_cursor = db.holidays.find({
        "$or": [
            {"date": {"$gte": start_dt, "$lte": end_dt}},
            {"date": {"$gte": start_str, "$lte": end_str}}
        ]
    })
    month_holidays = await holidays_cursor.to_list(length=100)
    
    unique_company_holidays = set()
    for h in month_holidays:
        h_d = h.get("date")
        if isinstance(h_d, (datetime, date)):
            h_str = h_d.strftime("%Y-%m-%d")
        else:
            h_str = str(h_d).split("T")[0] if h_d else ""
        
        if h_str and h_str not in sunday_dates:
            unique_company_holidays.add(h_str)

    total_company_holidays_count = len(unique_company_holidays)
    total_working_days = max(1, num_days - sundays - total_company_holidays_count)

    # 3. Query Attendance Records for month
    att_cursor = db.attendance.find({
        "$or": [
            {"date": {"$gte": start_dt, "$lte": end_dt}},
            {"date": {"$gte": start_str, "$lte": end_str}},
            {"date": {"$regex": f"^{year:04d}-{month:02d}"}}
        ]
    })
    att_records = await att_cursor.to_list(length=10000)

    emp_present_map = {}
    emp_distinct_dates = {}

    for r in att_records:
        emp_id = str(r.get("employeeId") or r.get("employee_id") or r.get("empId") or r.get("userId") or r.get("user_id") or "").strip()
        emp_name = str(r.get("employeeName") or r.get("employee_name") or r.get("name") or "").strip().lower()
        st = str(r.get("status", "")).lower().strip()
        check_in = str(r.get("checkIn", "")).strip()
        punches = r.get("punches", [])
        sec = r.get("accumulatedWorkSeconds", 0)

        r_d = r.get("date")
        if isinstance(r_d, (datetime, date)):
            d_str = r_d.strftime("%Y-%m-%d")
        else:
            d_str = str(r_d).split("T")[0] if r_d else ""

        is_present = False
        is_half = False

        if "half" in st:
            is_half = True
        elif "present" in st or "logged" in st or "late" in st or "on time" in st or st == "p":
            is_present = True
        elif check_in and check_in != "--" and check_in != "-":
            is_present = True
        elif isinstance(punches, list) and len(punches) > 0:
            is_present = True
        elif isinstance(sec, (int, float)) and sec > 0:
            is_present = True

        val = 0.5 if is_half else (1.0 if is_present else 0.0)

        if val > 0:
            keys_to_add = set()
            if emp_id:
                keys_to_add.add(emp_id)
            if emp_name:
                keys_to_add.add(emp_name)
                parts_name = emp_name.split()
                if len(parts_name) >= 2:
                    keys_to_add.add(f"{parts_name[0]} {parts_name[-1]}")

            for k in keys_to_add:
                if k not in emp_distinct_dates:
                    emp_distinct_dates[k] = {}
                emp_distinct_dates[k][d_str] = max(emp_distinct_dates[k].get(d_str, 0.0), val)

    for key, dates_dict in emp_distinct_dates.items():
        emp_present_map[key] = sum(dates_dict.values())

    # 4. Fetch Approved Leaves for month (db.leave_requests)
    # ONLY status == "Approved" (case-insensitive) counts!
    try:
        leaves_cursor = db.leave_requests.find({
            "status": {"$regex": "^approved$", "$options": "i"}
        })
        approved_leaves = await leaves_cursor.to_list(length=10000)

        emp_leave_deductions = {}
        from datetime import timedelta

        for l_req in approved_leaves:
            l_emp_id = str(l_req.get("employee_id") or l_req.get("employeeId") or "").strip()
            l_emp_name = str(l_req.get("employee_name") or l_req.get("employeeName") or "").strip().lower()

            is_half = (
                l_req.get("half_day") is True or
                "half" in str(l_req.get("day_type", "")).lower() or
                "half" in str(l_req.get("duration", "")).lower() or
                "half" in str(l_req.get("type", "")).lower()
            )
            deduction_per_day = 0.5 if is_half else 1.0

            s_date_val = l_req.get("start_date") or l_req.get("startDate")
            e_date_val = l_req.get("end_date") or l_req.get("endDate")

            def parse_date(v):
                if isinstance(v, (datetime, date)):
                    return v.date() if isinstance(v, datetime) else v
                s = str(v).split()[0].split("T")[0]
                for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y"):
                    try:
                        return datetime.strptime(s, fmt).date()
                    except ValueError:
                        pass
                return None

            s_d = parse_date(s_date_val)
            e_d = parse_date(e_date_val)

            if s_d and e_d:
                curr = s_d
                while curr <= e_d:
                    if curr.year == year and curr.month == month:
                        d_str = curr.strftime("%Y-%m-%d")
                        if curr.weekday() != 6 and d_str not in unique_company_holidays:
                            if l_emp_id:
                                emp_leave_deductions[l_emp_id] = emp_leave_deductions.get(l_emp_id, 0.0) + deduction_per_day
                            if l_emp_name:
                                emp_leave_deductions[l_emp_name] = emp_leave_deductions.get(l_emp_name, 0.0) + deduction_per_day
                    curr += timedelta(days=1)
            else:
                dur_days = float(l_req.get("leaveDays") or l_req.get("days") or (0.5 if is_half else 1.0))
                if l_emp_id:
                    emp_leave_deductions[l_emp_id] = emp_leave_deductions.get(l_emp_id, 0.0) + dur_days
                if l_emp_name:
                    emp_leave_deductions[l_emp_name] = emp_leave_deductions.get(l_emp_name, 0.0) + dur_days

        # Apply leave deductions to present days count
        for key in list(emp_present_map.keys()):
            base_days = emp_present_map[key]
            deduction = emp_leave_deductions.get(key, 0.0)
            net_days = max(0.0, base_days - deduction)
            emp_present_map[key] = round(net_days, 1)

    except Exception as err:
        print("Error processing approved leave deductions for EOM:", err)

    now_dt = datetime.now()
    is_current_month = (year == now_dt.year and month == now_dt.month)

    max_present = max(emp_present_map.values()) if emp_present_map else 0.0

    if is_current_month:
        sundays_so_far = sum(1 for d_idx in range(1, now_dt.day + 1) if date(year, month, d_idx).weekday() == 6)
        holidays_so_far = sum(1 for h in unique_company_holidays if int(h.split("-")[2]) <= now_dt.day)
        working_days_so_far = max(1, now_dt.day - sundays_so_far - holidays_so_far)
        effective_working_days = max(working_days_so_far, int(round(max_present)))
    else:
        effective_working_days = total_working_days

    return {
        "month_year": month_year,
        "totalDaysInMonth": num_days,
        "sundays": sundays,
        "companyHolidays": total_company_holidays_count,
        "totalWorkingDays": effective_working_days,
        "fullMonthWorkingDays": total_working_days,
        "maxScore": max_score,
        "formula": f"Score = (Present Days / {effective_working_days} Working Days) * {max_score} pts",
        "employeeStats": emp_present_map
    }

async def get_eom_discipline_stats(month_year: str, max_score: float = 10.0):
    """
    Auto-calculate Discipline score based on HRMS Penalty amounts in db.remarks for given month (Strict Month-Wise).
    Highest Penalty (₹) gets 0.0 points.
    0 Penalty (₹) gets max_score.
    """
    try:
        parts = month_year.split("-")
        year, month = int(parts[0]), int(parts[1])
    except Exception:
        year, month = datetime.now().year, datetime.now().month

    penalty_types = await db.penalty_types.find().to_list(length=100)
    pt_names = [p["name"].lower() for p in penalty_types]

    remarks_cursor = db.remarks.find({
        "isDeleted": {"$nin": [True, "true", "True"]}
    })
    all_remarks = await remarks_cursor.to_list(length=20000)

    def is_matching_month(r_date):
        if not r_date:
            return False
        if isinstance(r_date, (datetime, date)):
            return r_date.year == year and r_date.month == month
        s = str(r_date).strip()
        if s.startswith(f"{year:04d}-{month:02d}"):
            return True
        if f"-{month:02d}-{year:04d}" in s or f"/{month:02d}/{year:04d}" in s:
            return True
        try:
            from dateutil.parser import parse
            dt = parse(s)
            return dt.year == year and dt.month == month
        except Exception:
            return False

    emp_penalty_map = {}
    for r in all_remarks:
        if not is_matching_month(r.get("date")):
            continue

        emp_id = str(r.get("employeeId") or r.get("employee_id") or "").strip()
        emp_name = str(r.get("employeeName") or r.get("employee_name") or r.get("name") or "").strip().lower()

        r_type = str(r.get("type", "")).lower().strip()
        p_amount = float(r.get("amount") or r.get("penaltyAmount") or 0.0)

        if p_amount == 0 and (r_type in pt_names or r_type == "late punch-in"):
            pt_obj = next((p for p in penalty_types if p["name"].lower() == r_type), None)
            if pt_obj and pt_obj.get("amount"):
                p_amount = float(pt_obj["amount"])

        if p_amount > 0 or r_type in pt_names or r_type == "late punch-in":
            keys = set()
            if emp_id:
                keys.add(emp_id)
            if emp_name:
                keys.add(emp_name)
            for k in keys:
                emp_penalty_map[k] = emp_penalty_map.get(k, 0.0) + p_amount

    return {
        "month_year": month_year,
        "maxScore": max_score,
        "employeePenaltyAmounts": emp_penalty_map,
        "formula": f"Strict Month ({month:02d}/{year}): Highest Penalty Amount (₹) receives 0 pts, 0 Penalty receives {max_score} pts using Equal Interval Rank formula"
    }

async def get_eom_work_completion_stats(month_year: str, max_score: float = 10.0):
    """
    Auto-calculate Work Completion score based on Days Verified x Avg Rating in employee daily reports for given month (Strict Month-Wise).
    """
    try:
        parts = month_year.split("-")
        year, month = int(parts[0]), int(parts[1])
    except Exception:
        now_dt = datetime.now()
        year, month = now_dt.year, now_dt.month

    reports_cursor = db.employee_daily_reports.find({
        "rating": {"$exists": True, "$ne": None}
    })
    reports = await reports_cursor.to_list(length=20000)

    if not reports:
        reports_cursor = db.daily_reports.find({
            "rating": {"$exists": True, "$ne": None}
        })
        reports = await reports_cursor.to_list(length=20000)

    def is_matching_month(r_date):
        if not r_date:
            return False
        if isinstance(r_date, (datetime, date)):
            return r_date.year == year and r_date.month == month
        s = str(r_date).strip()
        if s.startswith(f"{year:04d}-{month:02d}"):
            return True
        if f"-{month:02d}-{year:04d}" in s or f"/{month:02d}/{year:04d}" in s:
            return True
        try:
            from dateutil.parser import parse
            dt = parse(s)
            return dt.year == year and dt.month == month
        except Exception:
            return False

    emp_date_ratings = {}
    for r in reports:
        if not is_matching_month(r.get("date")):
            continue

        emp_id = str(r.get("employeeId") or r.get("employee_id") or "").strip()
        emp_name = str(r.get("employeeName") or r.get("name") or "").strip().lower()
        try:
            rating_val = float(r.get("rating") or 0.0)
        except (TypeError, ValueError):
            rating_val = 0.0

        if rating_val > 0:
            raw_d = r.get("date")
            d_str = raw_d.strftime("%Y-%m-%d") if isinstance(raw_d, (datetime, date)) else str(raw_d).split("T")[0].split(" ")[0].strip()

            keys = set()
            if emp_id:
                keys.add(emp_id)
            if emp_name:
                keys.add(emp_name)

            for k in keys:
                if k not in emp_date_ratings:
                    emp_date_ratings[k] = {}
                if d_str not in emp_date_ratings[k] or rating_val > emp_date_ratings[k][d_str]:
                    emp_date_ratings[k][d_str] = rating_val

    result_stats = {}
    for k, date_map in emp_date_ratings.items():
        cnt = len(date_map)
        total_val = sum(date_map.values())
        avg_r = round((total_val / cnt), 1) if cnt > 0 else 0.0
        factor = round(cnt * avg_r, 2)
        result_stats[k] = {
            "daysVerified": cnt,
            "avgRating": avg_r,
            "factor": factor
        }

    return {
        "month_year": month_year,
        "maxScore": max_score,
        "employeeStats": result_stats,
        "formula": f"Strict Month ({month:02d}/{year}): Factor = Days Verified x Avg Rating. Ranked using Equal Interval Rank formula up to {max_score} pts"
    }

async def get_eom_work_dedication_stats(month_year: str, max_score: float = 10.0):
    """
    Auto-calculate Work Dedication score based on total logged/worked hours in attendance table for given month (Strict Month-Wise).
    Fallback to daily reports if no attendance records found.
    """
    try:
        parts = month_year.split("-")
        year, month = int(parts[0]), int(parts[1])
    except Exception:
        now_dt = datetime.now()
        year, month = now_dt.year, now_dt.month

    def is_matching_month(r_date):
        if not r_date:
            return False
        if isinstance(r_date, (datetime, date)):
            return r_date.year == year and r_date.month == month
        s = str(r_date).strip()
        if s.startswith(f"{year:04d}-{month:02d}"):
            return True
        if f"-{month:02d}-{year:04d}" in s or f"/{month:02d}/{year:04d}" in s:
            return True
        try:
            from dateutil.parser import parse
            dt = parse(s)
            return dt.year == year and dt.month == month
        except Exception:
            return False

    def parse_attendance_hours(r):
        sec = r.get("accumulatedWorkSeconds")
        if sec is not None and isinstance(sec, (int, float)) and sec > 0:
            return float(sec) / 3600.0

        wh = r.get("workHours")
        if wh and isinstance(wh, str) and wh.strip() not in ["--", "None", "null", ""]:
            s = wh.strip()
            hrs = 0.0
            if "h" in s:
                parts = s.split("h")
                try:
                    hrs += float(parts[0].strip())
                except Exception:
                    pass
                if len(parts) > 1 and "m" in parts[1]:
                    m_part = parts[1].replace("m", "").strip()
                    try:
                        hrs += float(m_part) / 60.0
                    except Exception:
                        pass
                if hrs > 0:
                    return hrs
            else:
                try:
                    val = float(s)
                    if val > 0:
                        return val
                except Exception:
                    pass

        status = str(r.get("status") or "").strip().lower()
        if status in ["present", "active", "logged", "on break"]:
            return 8.0
        return 0.0

    emp_hours_map = {}

    # 1. Fetch from attendance collection
    att_cursor = db.attendance.find({})
    att_records = await att_cursor.to_list(length=30000)

    matched_att_count = 0
    for r in att_records:
        if not is_matching_month(r.get("date")):
            continue

        hrs = parse_attendance_hours(r)
        if hrs <= 0:
            continue

        matched_att_count += 1
        emp_id = str(r.get("employeeId") or "").strip()
        emp_name = str(r.get("employeeName") or "").strip().lower()

        keys = set()
        if emp_id:
            keys.add(emp_id)
        if emp_name:
            keys.add(emp_name)

        for k in keys:
            emp_hours_map[k] = round(emp_hours_map.get(k, 0.0) + hrs, 2)

    # 2. Fallback to daily reports if no attendance data for the month
    if matched_att_count == 0:
        reports_cursor = db.employee_daily_reports.find({})
        reports = await reports_cursor.to_list(length=20000)
        if not reports:
            reports_cursor = db.daily_reports.find({})
            reports = await reports_cursor.to_list(length=20000)

        for r in reports:
            if not is_matching_month(r.get("date")):
                continue

            emp_id = str(r.get("employeeId") or r.get("employee_id") or "").strip()
            emp_name = str(r.get("employeeName") or r.get("name") or "").strip().lower()

            hrs = 0.0
            for k in ["workHours", "totalHours", "hours", "loggedHours", "hoursWorked"]:
                if r.get(k) is not None:
                    try:
                        hrs = float(r.get(k))
                        break
                    except (TypeError, ValueError):
                        pass

            if hrs == 0.0:
                hrs = 8.0

            keys = set()
            if emp_id:
                keys.add(emp_id)
            if emp_name:
                keys.add(emp_name)

            for k in keys:
                emp_hours_map[k] = round(emp_hours_map.get(k, 0.0) + hrs, 2)

    return {
        "month_year": month_year,
        "maxScore": max_score,
        "employeeHours": emp_hours_map,
        "formula": f"Strict Month ({month:02d}/{year}): Total Logged Hours from Attendance ranked using Equal Interval Rank formula up to {max_score} pts"
    }

async def get_eom_vote_stats(month_year: str, max_score: float = 10.0):
    """
    Fetch voting and election preference statistics for Employee of the Month.
    """
    month_names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
    try:
        parts = month_year.split("-")
        year_num = int(parts[0])
        month_num = int(parts[1])
        month_name = month_names[month_num - 1]
    except Exception:
        year_num = 2026
        month_name = "August"

    # Find election for the given month/year
    election = await db.elections.find_one({
        "isDeleted": {"$ne": True},
        "$or": [
            {"electionMonth": month_name, "electionYear": year_num},
            {"electionMonth": {"$regex": f"^{month_name}$", "$options": "i"}},
            {"title": {"$regex": month_name, "$options": "i"}},
            {"title": {"$regex": month_year, "$options": "i"}}
        ]
    })

    emp_votes_map = {}
    emp_rank_map = {}
    emp_score_map = {}
    total_ballots = 0
    election_title = None
    election_id = None

    if election:
        election_id = str(election.get("_id") or election.  get("id"))
        election_title = election.get("title")

        # Import crud for STV rounds history
        # crud imported
        rounds = await crud.get_election_rounds_history(election_id)
        if not rounds:
            valid_b = await db.ballots.count_documents({"electionId": election_id, "isSubmitted": True})
            if valid_b > 0:
                await crud.run_stv_round_calculation(election_id)
                rounds = await crud.get_election_rounds_history(election_id)

        # Fetch candidates
        candidates = await db.candidates.find({"electionId": election_id}).to_list(length=200)
        cand_to_emp = {str(c["_id"]): str(c.get("employee_id", "")) for c in candidates}
        cand_to_name = {str(c["_id"]): str(c.get("name", "")).strip().lower() for c in candidates}

        # Initialize all candidates with 0 votes
        for c in candidates:
            e_id = str(c.get("employee_id", ""))
            e_name = str(c.get("name", "")).strip().lower()
            if e_id:
                emp_votes_map[e_id] = 0
            if e_name:
                emp_votes_map[e_name] = 0

        # Ballots count
        ballots_cnt = await db.ballots.count_documents({"electionId": election_id, "isSubmitted": True})
        total_ballots = ballots_cnt

        # 1. Round 1 tally gives exact initial votes for Value column
        r1 = rounds[0] if rounds else None
        r1_tally = r1.get("tally", {}) if r1 else {}
        for cid, info in r1_tally.items():
            cid_str = str(cid)
            v_cnt = info.get("votes", 0) if isinstance(info, dict) else int(info)
            e_id = cand_to_emp.get(cid_str)
            e_name = cand_to_name.get(cid_str)
            if e_id:
                emp_votes_map[e_id] = v_cnt
            if e_name:
                emp_votes_map[e_name] = v_cnt

        # Filter candidates and elimination order to only include participating employees in EOM for this month
        cfg = await get_month_config(month_year)
        selected_ids = None
        if cfg.get("isConfigured") and cfg.get("selectedEmployeeIds") is not None:
            selected_ids = set(str(x) for x in cfg.get("selectedEmployeeIds", []))

        part_candidates = [c for c in candidates if (selected_ids is None or str(c.get("employee_id", "")) in selected_ids)]
        valid_cand_ids = set(str(c["_id"]) for c in part_candidates)

        # 2. STV Round-by-Round Elimination Sequence for Ranks
        elimination_order = []
        if rounds:
            last_round = rounds[-1]
            winner_id = str(last_round.get("winnerCandidateId") or "")
            if winner_id and winner_id in valid_cand_ids:
                elimination_order.append(winner_id)

            # Runner up (candidates active in last round)
            last_tally = last_round.get("tally", {})
            active_sorted = sorted(
                last_tally.items(),
                key=lambda x: (x[1].get("votes", 0) if isinstance(x[1], dict) else int(x[1])),
                reverse=True
            )
            for cid, info in active_sorted:
                cid_str = str(cid)
                v = info.get("votes", 0) if isinstance(info, dict) else int(info)
                if cid_str != winner_id and cid_str not in elimination_order and cid_str in valid_cand_ids and v > 0:
                    elimination_order.append(cid_str)

            # From second to last round down to round 2
            for r in reversed(rounds):
                if r.get("roundNumber") != 1:
                    elim_ids = [str(x) for x in r.get("eliminatedCandidateIds", [])]
                    for cid in elim_ids:
                        if cid not in elimination_order and cid in valid_cand_ids:
                            elimination_order.append(cid)

            # Round 1 zero-vote eliminated candidates at the bottom
            r1_zero_elim = [str(x) for x in rounds[0].get("eliminatedCandidateIds", [])]
            for cid in r1_zero_elim:
                if cid not in elimination_order and cid in valid_cand_ids:
                    elimination_order.append(cid)

        # Any remaining participating candidates
        for c in part_candidates:
            cid_str = str(c["_id"])
            if cid_str not in elimination_order:
                elimination_order.append(cid_str)

        # Compute STV Ranks and Equal Interval Scores
        N = len(elimination_order)
        interval = max_score / (N - 1) if N > 1 else 0

        for rank_idx, cid_str in enumerate(elimination_order):
            e_id = cand_to_emp.get(cid_str)
            e_name = cand_to_name.get(cid_str)
            calculated_rank = rank_idx + 1
            calculated_score = max(0.0, min(max_score, round(max_score - (rank_idx * interval), 2)))

            if e_id:
                emp_rank_map[e_id] = calculated_rank
                emp_score_map[e_id] = calculated_score
            if e_name:
                emp_rank_map[e_name] = calculated_rank
                emp_score_map[e_name] = calculated_score

    return {
        "month_year": month_year,
        "maxScore": max_score,
        "electionId": election_id,
        "electionTitle": election_title,
        "totalBallots": total_ballots,
        "employeeVoteCounts": emp_votes_map,
        "employeeRanks": emp_rank_map,
        "employeeScores": emp_score_map,
        "formula": f"STV Election ({election_title or month_name}): Exact Round-by-Round STV Elimination Standing with Round 1 Votes"
    }

async def calculate_eom_leaderboard(month_year: str):
    criteria_list = await get_or_init_criteria(month_year)
    scores_list = await get_scores(month_year)
    
    # Fetch active employees
    inactive_statuses = ["inactive", "Inactive", "INACTIVE", "terminated", "Terminated", "TERMINATED", "resigned", "Resigned", "RESIGNED"]
    raw_employees = await db.employees.find({"status": {"$nin": inactive_statuses}}).to_list(length=1000)

    # Always exclude Admins from EOM candidates
    non_admin_employees = [e for e in raw_employees if not is_admin_employee(e)]

    # Get month configuration for participating employees
    cfg = await get_month_config(month_year)
    if cfg.get("isConfigured") and cfg.get("selectedEmployeeIds") is not None:
        selected_ids = set(cfg.get("selectedEmployeeIds", []))
        employees = [e for e in non_admin_employees if str(e.get("_id")) in selected_ids]
    else:
        employees = non_admin_employees

    submitted_scores = {}
    for s in scores_list:
        c_id = str(s.get("criteriaId"))
        e_id = str(s.get("employeeId"))
        key = (c_id, e_id)
        if key not in submitted_scores:
            submitted_scores[key] = []
        submitted_scores[key].append(float(s.get("score", 0)))

    leaderboard = []
    for emp in employees:
        emp_id = str(emp.get("_id"))
        emp_name = get_emp_display_name(emp)
        
        c_scores = {}
        total_score = 0.0

        for crit in criteria_list:
            cid = str(crit.get("id"))
            max_sc = float(crit.get("maxScore", 0))
            cat = str(crit.get("category", "+ve")).lower().strip()
            entry_type = str(crit.get("entryType", "direct")).lower().strip()
            c_name_lower = str(crit.get("name", "")).lower()
            key = (cid, emp_id)
            sub_list = submitted_scores.get(key, [])
            
            if sub_list:
                if entry_type == "direct":
                    avg_sc = sub_list[-1]
                else:
                    avg_sc = sum(sub_list) / len(sub_list)
            elif "discipline" in c_name_lower:
                # Auto-fetch penalties for month if no manual score submitted
                try:
                    penalties = await db.penalties.find({
                        "employeeId": emp_id,
                        "date": {"$regex": f"^{re.escape(month_year)}"}
                    }).to_list(length=100)
                    total_pen_amt = sum(float(p.get("amount", 0)) for p in penalties)
                    avg_sc = min(max_sc, total_pen_amt)
                except Exception:
                    avg_sc = 0.0
            else:
                avg_sc = 0.0
            
            avg_sc = min(avg_sc, max_sc) # Cap at maxScore
            c_scores[cid] = round(avg_sc, 2)
            total_score += avg_sc

        leaderboard.append({
            "employeeId": emp_id,
            "name": emp_name,
            "department": emp.get("department", "General"),
            "designation": emp.get("designation", "Staff"),
            "avatar": emp.get("avatar", ""),
            "criteriaScores": c_scores,
            "totalScore": round(total_score, 2),
        })

    leaderboard.sort(key=lambda x: x["totalScore"], reverse=True)
    
    for idx, entry in enumerate(leaderboard, start=1):
        entry["rank"] = idx

    return {
        "month_year": month_year,
        "criteria": criteria_list,
        "leaderboard": leaderboard
    }

async def get_eom_month_history():
    months_cursor = db.eom_criteria.aggregate([
        {"$group": {"_id": "$month_year", "count": {"$sum": 1}}},
        {"$sort": {"_id": -1}}
    ])
    months_list = await months_cursor.to_list(length=100)
    result = []
    for item in months_list:
        m_str = item["_id"]
        lb_res = await calculate_eom_leaderboard(m_str)
        top = lb_res["leaderboard"][0] if lb_res["leaderboard"] else None
        result.append({
            "month_year": m_str,
            "criteriaCount": item["count"],
            "winner": top["name"] if top else "N/A",
            "winnerScore": top["totalScore"] if top else 0
        })
    return result

# --- EMPLOYEE OF THE WEEK (EOW) ---

async def get_weekly_meetings():
    meetings = await db.weekly_meetings.find({}).sort("meetingDate", -1).to_list(length=200)
    result = []
    for m in meetings:
        mid = str(m.get("_id", m.get("id")))
        mid_filter = {"$in": [mid, ObjectId(mid)]} if ObjectId.is_valid(mid) else mid
        topics_count = await db.weekly_topics.count_documents({"meetingId": mid_filter})
        p_ids = m.get("participantEmployeeIds", [])
        result.append({
            "id": mid,
            "meetingDate": m.get("meetingDate", ""),
            "participantEmployeeIds": p_ids,
            "participantsCount": len(p_ids),
            "topicsCount": topics_count,
            "createdAt": m.get("createdAt", "")
        })
    return result

async def get_weekly_master_topics():
    topics = await db.weekly_master_topics.find({}).sort("order", 1).to_list(length=100)
    if not topics:
        default_master = [
            {"name": "Update Round", "maxMarks": 20.0, "order": 1},
            {"name": "Focus Tasking", "maxMarks": 20.0, "order": 2},
            {"name": "Challenge Discussion", "maxMarks": 20.0, "order": 3},
            {"name": "English Speak", "maxMarks": 10.0, "order": 4},
            {"name": "Innovation", "maxMarks": 30.0, "order": 5},
        ]
        for idx, t in enumerate(default_master, start=1):
            t["createdAt"] = datetime.now(IST)
            res = await db.weekly_master_topics.insert_one(t)
            t["id"] = str(res.inserted_id)
            if "_id" in t:
                del t["_id"]
        return default_master

    for t in topics:
        t["id"] = str(t.get("_id", t.get("id")))
        if "_id" in t:
            del t["_id"]
    return topics

async def save_weekly_master_topics(topics_list: list):
    await db.weekly_master_topics.delete_many({})
    saved = []
    for idx, t in enumerate(topics_list, start=1):
        doc = {
            "name": t.get("name", "").strip(),
            "maxMarks": float(t.get("maxMarks", 20)),
            "order": idx,
            "createdAt": datetime.now(IST)
        }
        res = await db.weekly_master_topics.insert_one(doc)
        doc["id"] = str(res.inserted_id)
        if "_id" in doc:
            del doc["_id"]
        saved.append(doc)
    return saved

async def create_weekly_meeting(meeting_date: str, participant_ids: list, copy_from_meeting_id: str = None):
    # Prevent duplicate meeting creation for same date
    existing = await db.weekly_meetings.find_one({"meetingDate": meeting_date})
    if existing:
        raise ValueError(f"A weekly meeting block for {meeting_date} already exists! Please select a different date.")

    doc = {
        "meetingDate": meeting_date,
        "participantEmployeeIds": participant_ids or [],
        "createdAt": datetime.now(IST)
    }
    res = await db.weekly_meetings.insert_one(doc)
    new_id = str(res.inserted_id)

    if copy_from_meeting_id:
        prev_topics = await db.weekly_topics.find({"meetingId": copy_from_meeting_id}).sort("order", 1).to_list(length=100)
        for t in prev_topics:
            topic_doc = {
                "meetingId": new_id,
                "name": t.get("name", ""),
                "maxMarks": float(t.get("maxMarks", 20)),
                "order": t.get("order", 1),
                "createdAt": datetime.now(IST)
            }
            await db.weekly_topics.insert_one(topic_doc)
    else:
        # Load from Master Topics Template
        master_topics = await get_weekly_master_topics()
        for idx, mt in enumerate(master_topics, start=1):
            topic_doc = {
                "meetingId": new_id,
                "name": mt.get("name", ""),
                "maxMarks": float(mt.get("maxMarks", 20)),
                "order": idx,
                "createdAt": datetime.now(IST)
            }
            await db.weekly_topics.insert_one(topic_doc)

    doc["id"] = new_id
    if "_id" in doc:
        del doc["_id"]
    return doc

async def get_weekly_meeting_detail(meeting_id: str):
    meeting = await db.weekly_meetings.find_one({"_id": ObjectId(meeting_id) if len(meeting_id) == 24 else meeting_id})
    if not meeting:
        return None

    mid = str(meeting.get("_id", meeting.get("id")))
    mid_filter = {"$in": [mid, ObjectId(mid)]} if ObjectId.is_valid(mid) else mid
    topics = await db.weekly_topics.find({"meetingId": mid_filter}).sort("order", 1).to_list(length=100)
    for t in topics:
        t["id"] = str(t.get("_id", t.get("id")))
        t["meetingId"] = str(t.get("meetingId", mid))
        if "_id" in t:
            del t["_id"]

    entries = await db.weekly_entries.find({"meetingId": mid_filter}).to_list(length=500)
    for e in entries:
        e["id"] = str(e.get("_id", e.get("id")))
        e["meetingId"] = str(e.get("meetingId", mid))
        e["employeeId"] = str(e.get("employeeId", ""))
        if "_id" in e:
            del e["_id"]

    participant_ids = meeting.get("participantEmployeeIds", [])
    participants = []
    if participant_ids:
        emp_query = [{"_id": ObjectId(pid)} if len(pid) == 24 else {"_id": pid} for pid in participant_ids]
        raw_emps = await db.employees.find({"$or": emp_query}).to_list(length=500)
        for emp in raw_emps:
            desig = get_emp_desig(emp)
            role = get_emp_role(emp)
            desig_lower = desig.lower()
            role_lower = role.lower()
            is_tl = any(term in desig_lower or term in role_lower for term in ["team leader", "tl", "team lead", "lead", "head"])
            participants.append({
                "id": str(emp.get("_id")),
                "name": get_emp_display_name(emp),
                "designation": desig,
                "department": get_emp_dept(emp),
                "subDepartment": emp.get("subDepartment") or emp.get("sub_department") or "",
                "role": role,
                "isTeamLeader": is_tl
            })

    return {
        "id": mid,
        "meetingDate": meeting.get("meetingDate"),
        "participantEmployeeIds": participant_ids,
        "participants": participants,
        "topics": topics,
        "entries": entries
    }

async def save_weekly_topics(meeting_id: str, topics_list: list):
    await db.weekly_topics.delete_many({"meetingId": meeting_id})
    saved = []
    for idx, t in enumerate(topics_list, start=1):
        doc = {
            "meetingId": meeting_id,
            "name": t.get("name", "").strip(),
            "maxMarks": float(t.get("maxMarks", 0)),
            "order": idx,
            "createdAt": datetime.now(IST)
        }
        res = await db.weekly_topics.insert_one(doc)
        doc["id"] = str(res.inserted_id)
        if "_id" in doc:
            del doc["_id"]
        saved.append(doc)
    return saved

async def save_weekly_entries(meeting_id: str, entries_list: list):
    saved_entries = []
    for entry in entries_list:
        emp_id = entry.get("employeeId")
        marks_by_topic = entry.get("marksByTopic", {})
        
        sum_marks = sum(float(v) for v in marks_by_topic.values() if v is not None)

        doc = {
            "meetingId": meeting_id,
            "employeeId": emp_id,
            "marksByTopic": marks_by_topic,
            "sumMarks": round(sum_marks, 2),
            "focusTaskNote": entry.get("focusTaskNote", ""),
            "commitmentNote": entry.get("commitmentNote", ""),
            "updatedAt": datetime.now(IST)
        }

        await db.weekly_entries.update_one(
            {"meetingId": meeting_id, "employeeId": emp_id},
            {"$set": doc},
            upsert=True
        )
        saved_entries.append(doc)
    await redis_manager.invalidate_namespace("hrms:eom")
    await redis_manager.invalidate_namespace("hrms:weekly")
    return saved_entries

async def delete_weekly_meeting(meeting_id: str):
    mid_obj = ObjectId(meeting_id) if len(meeting_id) == 24 else meeting_id
    await db.weekly_meetings.delete_one({"_id": mid_obj})
    await db.weekly_topics.delete_many({"meetingId": meeting_id})
    await db.weekly_entries.delete_many({"meetingId": meeting_id})
    await redis_manager.invalidate_namespace("hrms:eom")
    await redis_manager.invalidate_namespace("hrms:weekly")
    return True

async def calculate_team_eom_average(month_year: str, department: str):
    eom_board = await db.eom_leaderboards.find_one({"monthYear": month_year})
    if not eom_board or not eom_board.get("leaderboard"):
        try:
            eom_board = await calculate_eom_leaderboard(month_year)
        except Exception:
            eom_board = None

    if not eom_board or not eom_board.get("leaderboard"):
        return 0.0

    dept_clean = department.strip().lower()
    dept_scores = []
    for item in eom_board["leaderboard"]:
        emp_dept = str(item.get("department") or "General").strip().lower()
        if emp_dept == dept_clean:
            dept_scores.append(float(item.get("totalScore", 0)))

    if not dept_scores:
        return 0.0

    team_avg = sum(dept_scores) / len(dept_scores)
    return round(team_avg, 2)

async def declare_weekly_team_result(week_meeting_ids: list, month_year: str):
    if not week_meeting_ids:
        raise ValueError("At least one weekly meeting must be selected.")

    eom_board = await db.eom_leaderboards.find_one({"monthYear": month_year})
    if not eom_board or not eom_board.get("leaderboard"):
        try:
            eom_board = await calculate_eom_leaderboard(month_year)
        except Exception:
            pass

    if not eom_board or not eom_board.get("leaderboard"):
        raise ValueError(f"EOM evaluation for {month_year} has not been completed yet! Please complete Employee of the Month scoring first.")

    meetings = []
    for mid in week_meeting_ids:
        detail = await get_weekly_meeting_detail(mid)
        if detail:
            meetings.append(detail)

    if not meetings:
        raise ValueError("None of the selected weekly meetings were found.")

    # Sort meetings chronologically date-wise (oldest date to newest date)
    meetings.sort(key=lambda m: m.get("meetingDate") or "")

    department_data = {}

    for m in meetings:
        m_id = m["id"]
        entries_map = {e["employeeId"]: e.get("sumMarks", 0) for e in m.get("entries", [])}
        for p in m.get("participants", []):
            dept = (p.get("department") or "General").strip()
            if dept not in department_data:
                department_data[dept] = {
                    "department": dept,
                    "teamLeaders": [],
                    "members": [],
                    "meetingScores": {},
                    "eomAverage": 0.0,
                    "grandTotal": 0.0
                }
            
            if not any(existing["id"] == p["id"] for existing in department_data[dept]["members"] + department_data[dept]["teamLeaders"]):
                if p.get("isTeamLeader"):
                    department_data[dept]["teamLeaders"].append(p)
                else:
                    department_data[dept]["members"].append(p)

            p_score = entries_map.get(p["id"], 0)
            department_data[dept]["meetingScores"][m_id] = department_data[dept]["meetingScores"].get(m_id, 0) + p_score

    # Compute individual participants breakdown across all meetings
    participants_map = {}
    meetings_info = []
    for m in meetings:
        m_id = m["id"]
        meetings_info.append({"id": m_id, "meetingDate": m.get("meetingDate")})
        entries_map = {e["employeeId"]: e.get("sumMarks", 0) for e in m.get("entries", [])}
        for p in m.get("participants", []):
            p_id = p["id"]
            if p_id not in participants_map:
                participants_map[p_id] = {
                    "id": p_id,
                    "name": p.get("name") or "Employee",
                    "department": p.get("department") or "General",
                    "designation": p.get("designation") or "",
                    "role": p.get("role") or "",
                    "isTeamLeader": p.get("isTeamLeader", False),
                    "meetingScores": {},
                    "totalScore": 0.0
                }
            p_score = entries_map.get(p_id, 0)
            participants_map[p_id]["meetingScores"][m_id] = p_score

    result_participants = list(participants_map.values())
    for p in result_participants:
        p["totalScore"] = round(sum(p["meetingScores"].values()), 2)

    result_participants.sort(key=lambda x: x["totalScore"], reverse=True)
    for rank, p in enumerate(result_participants, start=1):
        p["rank"] = rank

    result_teams = []
    for dept, data in department_data.items():
        eom_avg = await calculate_team_eom_average(month_year, dept)
        data["eomAverage"] = eom_avg

        weekly_sum = sum(data["meetingScores"].values())
        data["weeklyTotal"] = round(weekly_sum, 2)
        data["grandTotal"] = round(weekly_sum + eom_avg, 2)
        result_teams.append(data)

    result_teams.sort(key=lambda x: x["grandTotal"], reverse=True)
    for rank, t in enumerate(result_teams, start=1):
        t["rank"] = rank

    doc = {
        "monthYear": month_year,
        "weekMeetingIds": week_meeting_ids,
        "meetingsInfo": meetings_info,
        "participants": result_participants,
        "declaredAt": datetime.now(IST),
        "teams": result_teams
    }

    await db.team_declared_results.update_one(
        {"monthYear": month_year},
        {"$set": doc},
        upsert=True
    )

    doc["id"] = str(doc.get("_id", month_year))
    if "_id" in doc:
        del doc["_id"]

    await redis_manager.invalidate_namespace("hrms:eom")
    await redis_manager.invalidate_namespace("hrms:weekly")
    return stringify_object_ids(doc)

async def get_team_declared_result(month_year: str):
    doc = await db.team_declared_results.find_one({"monthYear": month_year})
    if doc:
        doc["id"] = str(doc.get("_id", doc.get("id")))
        if "_id" in doc:
            del doc["_id"]

        # Backfill participants and meetingsInfo if missing from legacy records
        if not doc.get("participants") and doc.get("weekMeetingIds"):
            try:
                meetings = []
                for mid in doc["weekMeetingIds"]:
                    detail = await get_weekly_meeting_detail(mid)
                    if detail:
                        meetings.append(detail)
                
                meetings.sort(key=lambda m: m.get("meetingDate") or "")
                meetings_info = []
                participants_map = {}
                for m in meetings:
                    m_id = m["id"]
                    meetings_info.append({"id": m_id, "meetingDate": m.get("meetingDate")})
                    entries_map = {e["employeeId"]: e.get("sumMarks", 0) for e in m.get("entries", [])}
                    for p in m.get("participants", []):
                        p_id = p["id"]
                        if p_id not in participants_map:
                            participants_map[p_id] = {
                                "id": p_id,
                                "name": p.get("name") or "Employee",
                                "department": p.get("department") or "General",
                                "designation": p.get("designation") or "",
                                "role": p.get("role") or "",
                                "isTeamLeader": p.get("isTeamLeader", False),
                                "meetingScores": {},
                                "totalScore": 0.0
                            }
                        p_score = entries_map.get(p_id, 0)
                        participants_map[p_id]["meetingScores"][m_id] = p_score

                result_participants = list(participants_map.values())
                for p in result_participants:
                    p["totalScore"] = round(sum(p["meetingScores"].values()), 2)
                result_participants.sort(key=lambda x: x["totalScore"], reverse=True)
                for rank, p in enumerate(result_participants, start=1):
                    p["rank"] = rank

                doc["meetingsInfo"] = meetings_info
                doc["participants"] = result_participants
            except Exception as e:
                print("Error backfilling participants in get_team_declared_result:", e)

    return stringify_object_ids(doc) if doc else None

async def update_weekly_participants(meeting_id: str, participant_ids: list):
    mid_obj = ObjectId(meeting_id) if len(meeting_id) == 24 else meeting_id
    res = await db.weekly_meetings.update_one(
        {"$or": [{"_id": mid_obj}, {"id": meeting_id}]},
        {"$set": {"participantEmployeeIds": participant_ids, "updatedAt": datetime.now(IST)}}
    )
    await redis_manager.invalidate_namespace("hrms:eom")
    await redis_manager.invalidate_namespace("hrms:weekly")
    return res
