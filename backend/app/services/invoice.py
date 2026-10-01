from typing import Optional, Dict, Any, List
from datetime import datetime
from app.repository.invoice import InvoiceRepository
from app.repository.bank_account import BankAccountRepository
from app.schemas.invoice import InvoiceCreate, InvoiceUpdate
from app.redis.service import get_cache, set_cache, delete_cache, clear_pattern, make_list_key

class InvoiceService:

    @staticmethod
    def _extract_user_info(user: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        if not user:
            return {"user_id": "system", "name": "System", "role": "System"}
        work = user.get("work_details", {})
        role = str(work.get("system_role") or user.get("system_role", "Employee")).strip()
        name = current_name = user.get("contact_info", {}).get("full_name") or user.get("full_name") or user.get("email_address") or "User"
        return {
            "user_id": str(user.get("_id", "")),
            "name": name,
            "role": role
        }

    @staticmethod
    def is_admin_user(user: Optional[Dict[str, Any]]) -> bool:
        if not user:
            return True
        work = user.get("work_details", {})
        role = str(work.get("system_role") or user.get("system_role", "Employee")).strip()
        return role.lower() in ["admin", "subadmin"]

    @staticmethod
    def check_user_access(invoice: Dict[str, Any], user: Optional[Dict[str, Any]]) -> bool:
        if not user or InvoiceService.is_admin_user(user):
            return True
        
        uid = str(user.get("_id", "")).strip()
        if not uid:
            return True

        creator_id = str(invoice.get("created_by", {}).get("user_id", "")).strip()
        if creator_id == uid:
            return True

        accessible_ids = [str(x).strip() for x in invoice.get("accessible_employee_ids", [])]
        if uid in accessible_ids:
            return True

        return False

    @staticmethod
    async def _calculate_invoice_fields(data_dict: Dict[str, Any], existing_item: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Auto-calculate line items, tax rates, tax amounts, round offs, payment modes, bank details, and totals."""
        
        if existing_item:
            merged = {**existing_item, **data_dict}
        else:
            merged = data_dict

        # 0. Client Details Auto-Lookup
        client_id = merged.get("client_id")
        if client_id:
            from app.repository.client import ClientRepository
            client_doc = await ClientRepository.get_by_id(client_id)
            if client_doc:
                if not merged.get("client_name"):
                    merged["client_name"] = client_doc.get("contact_person_name") or client_doc.get("company_name") or client_doc.get("client_name") or ""
                if not merged.get("client_email"):
                    merged["client_email"] = client_doc.get("email_address") or client_doc.get("email") or client_doc.get("client_email")
                if not merged.get("client_phone"):
                    merged["client_phone"] = client_doc.get("phone_number") or client_doc.get("phone") or client_doc.get("client_phone")
                if not merged.get("client_address"):
                    merged["client_address"] = client_doc.get("address") or client_doc.get("client_address")
                if not merged.get("client_gstin"):
                    merged["client_gstin"] = client_doc.get("gstin") or client_doc.get("client_gstin")
                if not merged.get("client_department"):
                    merged["client_department"] = client_doc.get("department") or client_doc.get("client_department")
                if not merged.get("state_ut"):
                    merged["state_ut"] = client_doc.get("state_ut") or client_doc.get("state")

        invoice_type = merged.get("invoice_type", "Tax Invoice")
        state_ut = merged.get("state_ut", "") or ""
        state_str = str(state_ut).lower()

        # 1. Mode of Payment default/validation
        mode_of_payment = merged.get("mode_of_payment")
        if invoice_type == "Proforma Invoice":
            valid_modes = ["Cash", "Other Account"]
            if not mode_of_payment or mode_of_payment not in valid_modes:
                merged["mode_of_payment"] = "Cash"
        else:
            valid_modes = ["Current Account", "Cash with GST"]
            if not mode_of_payment or mode_of_payment not in valid_modes:
                merged["mode_of_payment"] = "Current Account"

        # 2. Bank Account Details lookup & auto-attach
        bank_account = None
        bank_account_id = merged.get("bank_account_id")
        bank_nickname = merged.get("bank_nickname")

        if bank_account_id:
            bank_account = await BankAccountRepository.get_by_id(bank_account_id)
        elif bank_nickname:
            bank_account = await BankAccountRepository.get_by_nickname(bank_nickname)

        if not bank_account and (merged.get("mode_of_payment") in ["Other Account", "Current Account"]):
            bank_account = await BankAccountRepository.get_default()

        if bank_account:
            merged["bank_account_id"] = str(bank_account.get("_id", ""))
            merged["bank_nickname"] = bank_account.get("nickname")
            merged["bank_name"] = bank_account.get("bank_name")
            merged["account_number"] = bank_account.get("account_number")
            merged["ifsc_code"] = bank_account.get("ifsc_code")
            merged["bank_details"] = {
                "account_id": str(bank_account.get("_id", "")),
                "nickname": bank_account.get("nickname"),
                "bank_name": bank_account.get("bank_name"),
                "account_name": bank_account.get("account_name"),
                "account_number": bank_account.get("account_number"),
                "ifsc_code": bank_account.get("ifsc_code"),
                "branch": bank_account.get("branch"),
                "upi_id": bank_account.get("upi_id")
            }

        # 3. State-based Tax Options auto-selection & Rates
        tax_option = merged.get("tax_option")
        if not tax_option:
            if "gujarat" in state_str or "24" in state_str:
                tax_option = "CGST + SGST"
            else:
                tax_option = "IGST"
            merged["tax_option"] = tax_option

        if tax_option == "CGST + SGST":
            merged["cgst_rate"] = float(merged.get("cgst_rate") or 9.0)
            merged["sgst_rate"] = float(merged.get("sgst_rate") or 9.0)
            merged["igst_rate"] = 0.0
        else: # IGST
            merged["igst_rate"] = float(merged.get("igst_rate") or 18.0)
            merged["cgst_rate"] = 0.0
            merged["sgst_rate"] = 0.0

        # 4. Line items auto-calculation
        line_items = merged.get("line_items", []) or []
        processed_items = []
        total_before_tax = 0.0

        for item in line_items:
            if isinstance(item, dict):
                desc = item.get("description", "")
                sac = item.get("sac")
                qty = float(item.get("quantity") or 0.0)
                rate = float(item.get("rate") or 0.0)
                disc = float(item.get("discount") or 0.0)
            else:
                desc = getattr(item, "description", "")
                sac = getattr(item, "sac", None)
                qty = float(getattr(item, "quantity", 1.0) or 0.0)
                rate = float(getattr(item, "rate", 0.0) or 0.0)
                disc = float(getattr(item, "discount", 0.0) or 0.0)

            amt = round((qty * rate) - disc, 2)
            total_before_tax += amt

            processed_items.append({
                "description": desc,
                "sac": sac,
                "quantity": qty,
                "rate": rate,
                "discount": disc,
                "amount": amt
            })

        merged["line_items"] = processed_items
        merged["total_before_tax"] = round(total_before_tax, 2)

        # 5. Tax amount calculation
        taxable_amount = max(0.0, merged["total_before_tax"])
        if merged["tax_option"] == "CGST + SGST":
            cgst_amt = round(taxable_amount * (merged["cgst_rate"] / 100.0), 2)
            sgst_amt = round(taxable_amount * (merged["sgst_rate"] / 100.0), 2)
            igst_amt = 0.0
        else:
            cgst_amt = 0.0
            sgst_amt = 0.0
            igst_amt = round(taxable_amount * (merged["igst_rate"] / 100.0), 2)

        merged["cgst_amount"] = cgst_amt
        merged["sgst_amount"] = sgst_amt
        merged["igst_amount"] = igst_amt
        merged["total_tax_amount"] = round(cgst_amt + sgst_amt + igst_amt, 2)

        # 6. Rounding and Final Total Due
        add_disc = float(merged.get("additional_discount") or 0.0)
        raw_total = merged["total_before_tax"] - add_disc + merged["total_tax_amount"]
        rounded_total = round(raw_total)
        round_off = round(rounded_total - raw_total, 2)

        merged["round_off"] = round_off
        merged["total_due"] = float(rounded_total)

        return merged

    @staticmethod
    async def get_next_number(invoice_type: str = "Tax Invoice") -> str:
        return await InvoiceRepository.get_next_number(invoice_type)

    @staticmethod
    async def create_invoice(data: InvoiceCreate, current_user: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        data_dict = data.model_dump(exclude_unset=True)
        
        if not data_dict.get("invoice_number"):
            data_dict["invoice_number"] = await InvoiceRepository.get_next_number(
                data_dict.get("invoice_type", "Tax Invoice")
            )

        user_info = InvoiceService._extract_user_info(current_user)
        user_role = user_info["role"]
        is_admin = user_role.lower() in ["admin", "subadmin"]

        # Role-based status
        if is_admin:
            data_dict["status"] = data_dict.get("status") or "paid"
            data_dict["approval_status"] = "approved"
        else:
            data_dict["status"] = "pending_approval"
            data_dict["approval_status"] = "pending"

        data_dict["created_by"] = user_info

        # Create initial activity log
        log_entry = {
            "action": "created",
            "description": f"Invoice '{data_dict['invoice_number']}' created by {user_info['name']} ({user_role})",
            "performed_by": user_info,
            "timestamp": datetime.utcnow()
        }
        data_dict["activity_logs"] = [log_entry]

        calculated_data = await InvoiceService._calculate_invoice_fields(data_dict)
        
        created = await InvoiceRepository.create(calculated_data)
        await clear_pattern("invoices:list:*")
        return created

    @staticmethod
    async def approve_invoice(invoice_id: str, admin_user: Dict[str, Any]) -> bool:
        user_info = InvoiceService._extract_user_info(admin_user)
        
        update_data = {
            "status": "paid",
            "approval_status": "approved",
            "approved_by": {
                "user_id": user_info["user_id"],
                "name": user_info["name"],
                "role": user_info["role"],
                "timestamp": datetime.utcnow().isoformat()
            }
        }
        success = await InvoiceRepository.update(invoice_id, update_data)
        if success:
            log_entry = {
                "action": "approved",
                "description": f"Invoice payment approved by {user_info['name']} ({user_info['role']})",
                "performed_by": user_info,
                "timestamp": datetime.utcnow()
            }
            await InvoiceRepository.append_log(invoice_id, log_entry)
            await clear_pattern("invoices:list:*")
            await delete_cache(f"invoice:{invoice_id}")
        return success

    @staticmethod
    async def reject_invoice(invoice_id: str, admin_user: Dict[str, Any], reason: Optional[str] = None) -> bool:
        user_info = InvoiceService._extract_user_info(admin_user)
        rej_reason = reason or "Rejected by Admin"

        update_data = {
            "status": "rejected",
            "approval_status": "rejected",
            "rejection_reason": rej_reason,
            "approved_by": {
                "user_id": user_info["user_id"],
                "name": user_info["name"],
                "role": user_info["role"],
                "timestamp": datetime.utcnow().isoformat()
            }
        }
        success = await InvoiceRepository.update(invoice_id, update_data)
        if success:
            log_entry = {
                "action": "rejected",
                "description": f"Invoice rejected by {user_info['name']} ({user_info['role']}). Reason: {rej_reason}",
                "performed_by": user_info,
                "timestamp": datetime.utcnow()
            }
            await InvoiceRepository.append_log(invoice_id, log_entry)
            await clear_pattern("invoices:list:*")
            await delete_cache(f"invoice:{invoice_id}")
        return success

    @staticmethod
    async def update_invoice_access(invoice_id: str, employee_ids: List[str], current_user: Dict[str, Any]) -> bool:
        user_info = InvoiceService._extract_user_info(current_user)
        from app.database.db import get_database
        from bson import ObjectId
        db = get_database()

        valid_ids = [str(e_id) for e_id in employee_ids if e_id]
        accessible_employees_info = []

        if valid_ids:
            object_ids = [ObjectId(x) for x in valid_ids if ObjectId.is_valid(x)]
            cursor = db["employees"].find({"_id": {"$in": object_ids}, "is_deleted": {"$ne": True}})
            emp_docs = await cursor.to_list(length=None)

            for emp in emp_docs:
                name = emp.get("contact_info", {}).get("full_name") or emp.get("full_name") or emp.get("email_address") or "Employee"
                role = emp.get("work_details", {}).get("system_role", "Employee")
                dept = emp.get("work_details", {}).get("department", "")
                accessible_employees_info.append({
                    "id": str(emp["_id"]),
                    "name": name,
                    "role": role,
                    "department": dept
                })

        success = await InvoiceRepository.update_access(invoice_id, valid_ids, accessible_employees_info)
        if success:
            log_entry = {
                "action": "access_updated",
                "description": f"Invoice access granted to {len(valid_ids)} employee(s) by {user_info['name']}",
                "performed_by": user_info,
                "timestamp": datetime.utcnow()
            }
            await InvoiceRepository.append_log(invoice_id, log_entry)
            await clear_pattern("invoices:list:*")
            await delete_cache(f"invoice:{invoice_id}")
        return success

    @staticmethod
    async def get_all_invoices(
        is_deleted: bool = False,
        invoice_type: Optional[str] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
        client_id: Optional[str] = None,
        current_user: Optional[Dict[str, Any]] = None,
        page: Optional[int] = None,
        limit: Optional[int] = None
    ) -> Dict[str, Any]:
        is_admin = InvoiceService.is_admin_user(current_user)
        user_id = str(current_user.get("_id", "")) if current_user else None

        cache_key = make_list_key(
            "invoices",
            is_deleted=is_deleted,
            invoice_type=invoice_type,
            status=status,
            search=search,
            client_id=client_id,
            user_id=user_id if not is_admin else "admin",
            page=page,
            limit=limit
        )
        cached = await get_cache(cache_key)
        if cached is not None:
            return cached

        result = await InvoiceRepository.get_all(
            is_deleted=is_deleted,
            invoice_type=invoice_type,
            status=status,
            search=search,
            client_id=client_id,
            user_id=user_id,
            is_admin=is_admin,
            page=page,
            limit=limit
        )
        await set_cache(cache_key, result, ttl=3600)
        return result

    @staticmethod
    async def get_invoice_by_id(invoice_id: str) -> Optional[Dict[str, Any]]:
        cache_key = f"invoice:{invoice_id}"
        cached = await get_cache(cache_key)
        if cached is not None:
            return cached

        item = await InvoiceRepository.get_by_id(invoice_id)
        if item:
            await set_cache(cache_key, item, ttl=3600)
        return item

    @staticmethod
    async def update_invoice(invoice_id: str, data: InvoiceUpdate, current_user: Optional[Dict[str, Any]] = None) -> bool:
        existing = await InvoiceRepository.get_by_id(invoice_id)
        if not existing:
            return False

        user_info = InvoiceService._extract_user_info(current_user)
        update_dict = data.model_dump(exclude_unset=True)
        calculated_data = await InvoiceService._calculate_invoice_fields(update_dict, existing_item=existing)
        
        success = await InvoiceRepository.update(invoice_id, calculated_data)
        if success:
            log_entry = {
                "action": "updated",
                "description": f"Invoice updated by {user_info['name']} ({user_info['role']})",
                "performed_by": user_info,
                "timestamp": datetime.utcnow()
            }
            await InvoiceRepository.append_log(invoice_id, log_entry)
            await clear_pattern("invoices:list:*")
            await delete_cache(f"invoice:{invoice_id}")
        return success

    @staticmethod
    async def update_status(invoice_id: str, status: str, current_user: Optional[Dict[str, Any]] = None) -> bool:
        user_info = InvoiceService._extract_user_info(current_user)
        success = await InvoiceRepository.update_status(invoice_id, status)
        if success:
            log_entry = {
                "action": "status_updated",
                "description": f"Invoice status changed to '{status}' by {user_info['name']}",
                "performed_by": user_info,
                "timestamp": datetime.utcnow()
            }
            await InvoiceRepository.append_log(invoice_id, log_entry)
            await clear_pattern("invoices:list:*")
            await delete_cache(f"invoice:{invoice_id}")
        return success

    @staticmethod
    async def delete_invoice(invoice_id: str, current_user: Optional[Dict[str, Any]] = None) -> bool:
        user_info = InvoiceService._extract_user_info(current_user)
        success = await InvoiceRepository.delete(invoice_id)
        if success:
            log_entry = {
                "action": "deleted",
                "description": f"Invoice marked as deleted by {user_info['name']}",
                "performed_by": user_info,
                "timestamp": datetime.utcnow()
            }
            await InvoiceRepository.append_log(invoice_id, log_entry)
            await clear_pattern("invoices:list:*")
            await delete_cache(f"invoice:{invoice_id}")
        return success

    @staticmethod
    async def get_brand_ledger(
        invoice_type: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        month: Optional[int] = None,
        year: Optional[int] = None,
        search: Optional[str] = None,
        current_user: Optional[Dict[str, Any]] = None,
        page: Optional[int] = None,
        limit: Optional[int] = None
    ) -> Dict[str, Any]:
        is_admin = InvoiceService.is_admin_user(current_user)
        user_id = str(current_user.get("_id", "")) if current_user else None

        cache_key = make_list_key(
            "invoices:ledger:brands",
            invoice_type=invoice_type,
            start_date=start_date,
            end_date=end_date,
            from_date=from_date,
            to_date=to_date,
            month=month,
            year=year,
            search=search,
            user_id=user_id if not is_admin else "admin",
            page=page,
            limit=limit
        )
        cached = await get_cache(cache_key)
        if cached is not None:
            return cached

        result = await InvoiceRepository.get_brand_ledger(
            invoice_type=invoice_type,
            start_date=start_date,
            end_date=end_date,
            from_date=from_date,
            to_date=to_date,
            month=month,
            year=year,
            search=search,
            user_id=user_id,
            is_admin=is_admin,
            page=page,
            limit=limit
        )
        await set_cache(cache_key, result, ttl=1800)
        return result
