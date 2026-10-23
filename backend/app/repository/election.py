from datetime import datetime
from typing import Optional, List, Dict, Any
from bson import ObjectId
from app.database.db import get_database
from app.schemas.election import ElectionCreate

def calculate_quota(total_valid_votes: int) -> int:
    """Droop Quota: (votes / (seats + 1)) + 1 where seats = 1."""
    if total_valid_votes <= 0:
        return 0
    return (total_valid_votes // 2) + 1

def election_id_query(el_id: Any) -> Dict[str, Any]:
    el_str = str(el_id)
    if ObjectId.is_valid(el_str):
        return {"$or": [{"electionId": el_str}, {"electionId": ObjectId(el_str)}]}
    return {"electionId": el_str}

class ElectionRepository:
    @classmethod
    async def get_db(cls):
        return get_database()

    @classmethod
    async def create_election(cls, data: ElectionCreate, created_by_id: str) -> Dict[str, Any]:
        db = await cls.get_db()
        now = datetime.utcnow()
        month_str = data.electionMonth or now.strftime("%B")
        year_num = data.electionYear or now.year

        election_doc = {
            "title": data.title.strip(),
            "description": data.description.strip() if data.description else None,
            "maxPreferences": data.maxPreferences,
            "electionMonth": month_str,
            "electionYear": year_num,
            "status": data.status or "active",
            "isDeleted": False,
            "created_by": str(created_by_id),
            "created_at": now,
            "updated_at": now
        }
        res = await db["elections"].insert_one(election_doc)
        election_id = str(res.inserted_id)

        # Insert candidates
        candidates_list = []
        if data.candidate_employee_ids:
            for emp_id in data.candidate_employee_ids:
                emp = None
                try:
                    if ObjectId.is_valid(emp_id):
                        emp = await db["employees"].find_one({"_id": ObjectId(emp_id)})
                except Exception:
                    pass
                if not emp:
                    emp = await db["employees"].find_one({"_id": emp_id})

                emp_name = "Employee"
                dept = None
                desig = None
                avatar = None

                if emp:
                    pi = emp.get("personal_info", {})
                    wd = emp.get("work_details", {})
                    emp_name = f"{pi.get('first_name', '')} {pi.get('last_name', '')}".strip() or emp.get("name") or "Employee"
                    dept = wd.get("department") or emp.get("department")
                    desig = wd.get("designation") or emp.get("designation") or wd.get("system_role")
                    avatar = pi.get("profile_photo") or emp.get("profile_photo") or emp.get("avatar")

                cand_doc = {
                    "electionId": election_id,
                    "employee_id": str(emp_id),
                    "name": emp_name,
                    "department": dept,
                    "designation": desig,
                    "avatar": avatar,
                    "created_at": now
                }
                c_res = await db["candidates"].insert_one(cand_doc)
                cand_doc["id"] = str(c_res.inserted_id)
                cand_doc["_id"] = str(c_res.inserted_id)
                candidates_list.append(cand_doc)

        election_doc["id"] = election_id
        election_doc["candidates"] = candidates_list
        return election_doc

    @classmethod
    async def get_elections(cls, month: Optional[str] = None, year: Optional[int] = None) -> List[Dict[str, Any]]:
        db = await cls.get_db()
        query: Dict[str, Any] = {"isDeleted": {"$ne": True}}
        if month and month.lower() != "all":
            query["electionMonth"] = month
        if year and str(year).lower() != "all":
            query["electionYear"] = int(year)

        cursor = db["elections"].find(query).sort("created_at", -1)
        raw_elections = await cursor.to_list(length=500)

        total_eligible = await db["employees"].count_documents({
            "work_details.is_delete": {"$ne": True},
            "work_details.is_block": {"$ne": True}
        })
        if total_eligible == 0:
            total_eligible = await db["employees"].count_documents({})

        result = []
        for el in raw_elections:
            el_id = str(el["_id"])
            cands = await db["candidates"].find(election_id_query(el_id)).to_list(length=100)
            formatted_cands = []
            for c in cands:
                formatted_cands.append({
                    "id": str(c["_id"]),
                    "employee_id": str(c.get("employee_id", "")),
                    "name": c.get("name", "Unknown"),
                    "department": c.get("department"),
                    "designation": c.get("designation"),
                    "avatar": c.get("avatar")
                })

            ballot_q = election_id_query(el_id)
            ballot_q["isSubmitted"] = True
            valid_votes = await db["ballots"].count_documents(ballot_q)

            winner_name = None
            if el.get("winner_candidate_id"):
                w_cand = next((c for c in formatted_cands if c["id"] == str(el["winner_candidate_id"])), None)
                if w_cand:
                    winner_name = w_cand["name"]

            result.append({
                "id": el_id,
                "title": el.get("title", ""),
                "description": el.get("description"),
                "maxPreferences": el.get("maxPreferences", 5),
                "electionMonth": el.get("electionMonth"),
                "electionYear": el.get("electionYear"),
                "status": el.get("status", "active"),
                "candidates": formatted_cands,
                "totalValidVotes": valid_votes,
                "totalEligibleVoters": total_eligible,
                "quota": el.get("quota"),
                "winner_candidate_id": str(el["winner_candidate_id"]) if el.get("winner_candidate_id") else None,
                "winner_name": winner_name or el.get("winner_name"),
                "createdAt": el.get("created_at"),
                "updatedAt": el.get("updated_at")
            })
        return result

    @classmethod
    async def get_election_by_id(cls, election_id: str) -> Optional[Dict[str, Any]]:
        db = await cls.get_db()
        query: Dict[str, Any] = {"isDeleted": {"$ne": True}}
        try:
            if ObjectId.is_valid(election_id):
                query["_id"] = ObjectId(election_id)
            else:
                query["_id"] = election_id
        except Exception:
            query["_id"] = election_id

        el = await db["elections"].find_one(query)
        if not el:
            return None

        el_id = str(el["_id"])
        cands = await db["candidates"].find(election_id_query(el_id)).to_list(length=100)
        formatted_cands = []
        for c in cands:
            formatted_cands.append({
                "id": str(c["_id"]),
                "employee_id": str(c.get("employee_id", "")),
                "name": c.get("name", "Unknown"),
                "department": c.get("department"),
                "designation": c.get("designation"),
                "avatar": c.get("avatar")
            })

        ballot_q = election_id_query(el_id)
        ballot_q["isSubmitted"] = True
        valid_votes = await db["ballots"].count_documents(ballot_q)
        total_eligible = await db["employees"].count_documents({
            "work_details.is_delete": {"$ne": True},
            "work_details.is_block": {"$ne": True}
        })
        if total_eligible == 0:
            total_eligible = await db["employees"].count_documents({})

        winner_name = None
        if el.get("winner_candidate_id"):
            w_cand = next((c for c in formatted_cands if c["id"] == str(el["winner_candidate_id"])), None)
            if w_cand:
                winner_name = w_cand["name"]

        return {
            "id": str(el["_id"]),
            "title": el.get("title", ""),
            "description": el.get("description"),
            "maxPreferences": el.get("maxPreferences", 5),
            "electionMonth": el.get("electionMonth"),
            "electionYear": el.get("electionYear"),
            "status": el.get("status", "active"),
            "candidates": formatted_cands,
            "totalValidVotes": valid_votes,
            "totalEligibleVoters": total_eligible,
            "quota": el.get("quota"),
            "winner_candidate_id": str(el["winner_candidate_id"]) if el.get("winner_candidate_id") else None,
            "winner_name": winner_name or el.get("winner_name"),
            "createdAt": el.get("created_at"),
            "updatedAt": el.get("updated_at")
        }

    @classmethod
    async def soft_delete_election(cls, election_id: str) -> bool:
        db = await cls.get_db()
        query: Dict[str, Any] = {}
        try:
            if ObjectId.is_valid(election_id):
                query["_id"] = ObjectId(election_id)
            else:
                query["_id"] = election_id
        except Exception:
            query["_id"] = election_id

        res = await db["elections"].update_one(
            query,
            {"$set": {"isDeleted": True, "deletedAt": datetime.utcnow()}}
        )
        return res.modified_count > 0

    @classmethod
    async def submit_ballot(cls, election_id: str, voter_id: str, preferences: List[str]) -> Dict[str, Any]:
        db = await cls.get_db()
        election = await cls.get_election_by_id(election_id)
        if not election:
            raise ValueError("Election not found")
        if election.get("status") == "completed":
            raise ValueError("Election is completed. Voting is closed.")

        cands = election.get("candidates", [])
        cand_ids = {c["id"] for c in cands}
        max_pref = election.get("maxPreferences", 5)
        required_count = min(max_pref, len(cand_ids)) if cand_ids else max_pref

        # Sanitize preference list
        clean_prefs = [str(p) for p in preferences if str(p) in cand_ids]
        # Remove duplicates while preserving order
        unique_prefs = []
        for p in clean_prefs:
            if p not in unique_prefs:
                unique_prefs.append(p)

        if len(unique_prefs) == 0:
            raise ValueError("Please select at least 1 candidate preference.")
        if len(unique_prefs) > required_count:
            raise ValueError(f"You can select a maximum of {required_count} candidate preferences.")

        # Check existing ballot
        existing = await db["ballots"].find_one({"electionId": str(election["id"]), "voterId": str(voter_id)})
        if existing and existing.get("isSubmitted"):
            raise ValueError("Your vote has already been recorded and is locked.")

        now = datetime.utcnow()
        ballot_doc = {
            "electionId": str(election["id"]),
            "voterId": str(voter_id),
            "preferences": unique_prefs,
            "isSubmitted": True,
            "submittedAt": now,
            "created_at": now
        }

        if existing:
            await db["ballots"].update_one(
                {"_id": existing["_id"]},
                {"$set": ballot_doc}
            )
            ballot_doc["id"] = str(existing["_id"])
        else:
            res = await db["ballots"].insert_one(ballot_doc)
            ballot_doc["id"] = str(res.inserted_id)

        ballot_doc.pop("_id", None)
        return ballot_doc

    @classmethod
    async def get_voter_ballot(cls, election_id: str, voter_id: str) -> Optional[Dict[str, Any]]:
        db = await cls.get_db()
        ballot = await db["ballots"].find_one({
            "electionId": str(election_id),
            "voterId": str(voter_id)
        })
        if not ballot:
            return None
        return {
            "id": str(ballot["_id"]),
            "electionId": ballot.get("electionId"),
            "voterId": ballot.get("voterId"),
            "preferences": ballot.get("preferences", []),
            "isSubmitted": ballot.get("isSubmitted", False),
            "submittedAt": ballot.get("submittedAt")
        }

    @classmethod
    async def run_stv_round_calculation(cls, election_id: str) -> Dict[str, Any]:
        """
        Core Single Transferable Vote (STV) Ranked-Choice Engine Implementation:
        - Dynamic Droop Quota calculation based on submitted ballots: (votes // 2) + 1
        - Priority allocation with candidate transfer logic
        - Batch zero-vote elimination & lowest-vote candidate elimination
        - Auto-stop as soon as quota is reached or 1 candidate remains
        - Stores round-by-round audit snapshots
        """
        db = await cls.get_db()
        election = await cls.get_election_by_id(election_id)
        if not election:
            raise ValueError("Election not found")

        raw_candidates = await db["candidates"].find(election_id_query(str(election["id"]))).to_list(length=200)
        if not raw_candidates:
            raise ValueError("No candidates configured for this election")

        cand_map = {str(c["_id"]): c.get("name", "Candidate") for c in raw_candidates}
        all_candidate_ids = set(cand_map.keys())

        raw_ballots_q = election_id_query(str(election["id"]))
        raw_ballots_q["isSubmitted"] = True
        raw_ballots = await db["ballots"].find(raw_ballots_q).to_list(length=10000)

        total_valid_votes = len(raw_ballots)
        quota = calculate_quota(total_valid_votes)

        # Delete previous round records for clean recalculation
        await db["election_rounds"].delete_many(election_id_query(str(election["id"])))

        # Sanitize ballots and remove duplicates per ballot
        processed_ballots = []
        for b in raw_ballots:
            raw_prefs = [str(p) for p in b.get("preferences", []) if str(p) in all_candidate_ids]
            unique_prefs = []
            for p in raw_prefs:
                if p not in unique_prefs:
                    unique_prefs.append(p)
            if unique_prefs:
                processed_ballots.append(unique_prefs)

        active_candidate_ids = set(all_candidate_ids)
        winner_id = None
        round_number = 1
        rounds_summary = []

        while active_candidate_ids and not winner_id:
            now = datetime.utcnow()
            tally = {cid: 0 for cid in all_candidate_ids}

            # Count 1st preference candidate who is still active
            for prefs in processed_ballots:
                first_active = next((p for p in prefs if p in active_candidate_ids), None)
                if first_active:
                    tally[first_active] += 1

            # Check Quota condition
            potential_winners = [cid for cid in active_candidate_ids if tally[cid] >= quota and quota > 0]
            if potential_winners:
                potential_winners.sort(key=lambda cid: tally[cid], reverse=True)
                winner_id = potential_winners[0]
                winner_name = cand_map.get(winner_id, "Winner")

                round_doc = {
                    "electionId": str(election["id"]),
                    "roundNumber": round_number,
                    "tally": tally,
                    "eliminatedCandidateIds": [],
                    "transferredVotes": [],
                    "winnerCandidateId": winner_id,
                    "winnerName": winner_name,
                    "quota": quota,
                    "timestamp": now,
                    "created_at": now
                }
                res = await db["election_rounds"].insert_one(round_doc)
                round_doc["id"] = str(res.inserted_id)
                round_doc.pop("_id", None)
                rounds_summary.append(round_doc)

                # Auto-stop and mark election completed
                query = {"_id": ObjectId(election["id"]) if ObjectId.is_valid(election["id"]) else election["id"]}
                await db["elections"].update_one(
                    query,
                    {"$set": {
                        "status": "completed",
                        "winner_candidate_id": winner_id,
                        "winner_name": winner_name,
                        "quota": quota,
                        "updated_at": now
                    }}
                )
                break

            # If only 1 candidate remains active
            if len(active_candidate_ids) == 1:
                winner_id = list(active_candidate_ids)[0]
                winner_name = cand_map.get(winner_id, "Winner")

                round_doc = {
                    "electionId": str(election["id"]),
                    "roundNumber": round_number,
                    "tally": tally,
                    "eliminatedCandidateIds": [],
                    "transferredVotes": [],
                    "winnerCandidateId": winner_id,
                    "winnerName": winner_name,
                    "quota": quota,
                    "timestamp": now,
                    "created_at": now
                }
                res = await db["election_rounds"].insert_one(round_doc)
                round_doc["id"] = str(res.inserted_id)
                round_doc.pop("_id", None)
                rounds_summary.append(round_doc)

                query = {"_id": ObjectId(election["id"]) if ObjectId.is_valid(election["id"]) else election["id"]}
                await db["elections"].update_one(
                    query,
                    {"$set": {
                        "status": "completed",
                        "winner_candidate_id": winner_id,
                        "winner_name": winner_name,
                        "quota": quota,
                        "updated_at": now
                    }}
                )
                break

            # Elimination logic
            zero_vote_candidates = [cid for cid in active_candidate_ids if tally[cid] == 0]
            eliminated_ids = []
            transferred_votes_log = []

            if len(zero_vote_candidates) > 0 and len(zero_vote_candidates) < len(active_candidate_ids):
                eliminated_ids = zero_vote_candidates
                for cid in zero_vote_candidates:
                    active_candidate_ids.remove(cid)
            else:
                active_list = list(active_candidate_ids)
                active_list.sort(key=lambda cid: tally[cid])
                lowest_cand_id = active_list[0]
                eliminated_ids = [lowest_cand_id]
                active_candidate_ids.remove(lowest_cand_id)

                # Track vote transfers
                for prefs in processed_ballots:
                    first_active = next((p for p in prefs if p in (active_candidate_ids | set(eliminated_ids))), None)
                    if first_active == lowest_cand_id:
                        next_active = next((p for p in prefs if p in active_candidate_ids), None)
                        if next_active:
                            transferred_votes_log.append({
                                "fromCandidateId": lowest_cand_id,
                                "fromCandidateName": cand_map.get(lowest_cand_id),
                                "toCandidateId": next_active,
                                "toCandidateName": cand_map.get(next_active),
                                "count": 1
                            })

            round_doc = {
                "electionId": str(election["id"]),
                "roundNumber": round_number,
                "tally": tally,
                "eliminatedCandidateIds": eliminated_ids,
                "transferredVotes": transferred_votes_log,
                "winnerCandidateId": None,
                "winnerName": None,
                "quota": quota,
                "timestamp": now,
                "created_at": now
            }
            res = await db["election_rounds"].insert_one(round_doc)
            round_doc["id"] = str(res.inserted_id)
            round_doc.pop("_id", None)
            rounds_summary.append(round_doc)

            round_number += 1

        return {
            "electionId": str(election["id"]),
            "quota": quota,
            "totalValidVotes": total_valid_votes,
            "winnerCandidateId": winner_id,
            "winnerName": cand_map.get(winner_id) if winner_id else None,
            "rounds": rounds_summary
        }

    @classmethod
    async def get_election_rounds_history(cls, election_id: str) -> List[Dict[str, Any]]:
        db = await cls.get_db()
        cursor = db["election_rounds"].find(election_id_query(election_id)).sort("roundNumber", 1)
        rounds = await cursor.to_list(length=100)

        raw_cands = await db["candidates"].find(election_id_query(election_id)).to_list(length=200)
        cand_map = {str(c["_id"]): c.get("name", "Candidate") for c in raw_cands}

        result = []
        for r in rounds:
            tally = r.get("tally", {})
            formatted_tally = {}
            for cid, count in tally.items():
                c_name = cand_map.get(cid, cid)
                formatted_tally[cid] = {"candidateName": c_name, "votes": count}

            result.append({
                "id": str(r["_id"]),
                "electionId": r.get("electionId"),
                "roundNumber": r.get("roundNumber"),
                "tally": formatted_tally,
                "eliminatedCandidateIds": r.get("eliminatedCandidateIds", []),
                "eliminatedCandidateNames": [cand_map.get(cid, cid) for cid in r.get("eliminatedCandidateIds", [])],
                "transferredVotes": r.get("transferredVotes", []),
                "winnerCandidateId": r.get("winnerCandidateId"),
                "winnerName": r.get("winnerName"),
                "quota": r.get("quota", 0),
                "timestamp": r.get("timestamp")
            })
        return result

    @classmethod
    async def get_admin_voter_ballots(cls, election_id: str) -> List[Dict[str, Any]]:
        db = await cls.get_db()
        ballot_q = election_id_query(election_id)
        ballot_q["isSubmitted"] = True
        cursor = db["ballots"].find(ballot_q)
        ballots = await cursor.to_list(length=10000)

        raw_cands = await db["candidates"].find(election_id_query(election_id)).to_list(length=200)
        cand_map = {str(c["_id"]): c.get("name", "Candidate") for c in raw_cands}

        result = []
        for b in ballots:
            voter_id = b.get("voterId")
            voter_name = "Unknown Voter"
            if voter_id:
                emp = None
                try:
                    if ObjectId.is_valid(voter_id):
                        emp = await db["employees"].find_one({"_id": ObjectId(voter_id)})
                except Exception:
                    pass
                if not emp:
                    emp = await db["employees"].find_one({"_id": voter_id})
                if emp:
                    pi = emp.get("personal_info", {})
                    voter_name = f"{pi.get('first_name', '')} {pi.get('last_name', '')}".strip() or emp.get("name") or "Employee"

            ranked_preferences = []
            for pid in b.get("preferences", []):
                ranked_preferences.append({
                    "candidateId": pid,
                    "candidateName": cand_map.get(pid, pid)
                })

            result.append({
                "id": str(b["_id"]),
                "electionId": election_id,
                "voterId": voter_id,
                "voterName": voter_name,
                "preferences": ranked_preferences,
                "isSubmitted": b.get("isSubmitted", True),
                "submittedAt": b.get("submittedAt")
            })
        return result
