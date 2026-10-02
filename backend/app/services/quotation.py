from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from app.repository.quotation import QuotationRepository
from app.schemas.quotation import QuotationCreate, QuotationUpdate
from app.schemas.invoice import InvoiceCreate, LineItemSchema
from app.services.invoice import InvoiceService
from app.redis.service import get_cache, set_cache, delete_cache, clear_pattern, make_list_key
from app.services.pdf import PDFGeneratorService
from app.utils.storage import save_pdf_file, delete_pdf_file

class QuotationService:

    @staticmethod
    async def _generate_and_store_quotation_pdf(quotation_id: str, delete_old: bool = True) -> Optional[Dict[str, Any]]:
        quo = await QuotationRepository.get_by_id(quotation_id)
        if not quo:
            return None

        if delete_old and quo.get("pdf_path"):
            delete_pdf_file(quo.get("pdf_path"))

        try:
            from app.services.settings import SettingsService
            settings = await SettingsService.get_settings()
            
            merged_quo = {
                **quo,
                **settings
            }
            if not merged_quo.get("bank_details") and settings.get("default_bank_details"):
                merged_quo["bank_details"] = settings.get("default_bank_details")

            pdf_bytes = PDFGeneratorService.generate_quotation_pdf(merged_quo)
            pdf_path, pdf_url = save_pdf_file(pdf_bytes, quo.get("quotation_number", f"QUO-{quotation_id[:6]}"), subfolder="quotations")
            await QuotationRepository.update(quotation_id, {"pdf_path": pdf_path, "pdf_url": pdf_url})
            quo["pdf_path"] = pdf_path
            quo["pdf_url"] = pdf_url
        except Exception as e:
            print(f"Error generating PDF for quotation {quotation_id}: {e}")

        return quo

    @staticmethod
    async def _calculate_quotation_fields(data_dict: Dict[str, Any], existing_item: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Auto-calculate line items, tax rates, tax amounts, round offs, and totals for quotation."""
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
                if not merged.get("client_phone"):
                    merged["client_phone"] = client_doc.get("phone_number") or client_doc.get("phone") or client_doc.get("client_phone")
                if not merged.get("client_company"):
                    merged["client_company"] = client_doc.get("company_name") or client_doc.get("brand_name") or client_doc.get("client_company")

        state_ut = merged.get("state_ut", "") or ""
        state_str = str(state_ut).lower()

        # 1. State-based Tax Options auto-selection & Rates
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

        # 2. Line items auto-calculation
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

        # 3. Tax amount calculation
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

        # 4. Rounding and Final Total Amount
        add_disc = float(merged.get("additional_discount") or 0.0)
        raw_total = merged["total_before_tax"] - add_disc + merged["total_tax_amount"]
        rounded_total = round(raw_total)
        round_off = round(rounded_total - raw_total, 2)

        merged["round_off"] = round_off
        merged["total_amount"] = float(rounded_total)

        if not merged.get("status"):
            merged["status"] = "sent"

        return merged

    @staticmethod
    async def get_next_number() -> str:
        return await QuotationRepository.get_next_number()

    @staticmethod
    async def create_quotation(data: QuotationCreate, current_user: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        data_dict = data.model_dump(exclude_unset=True)

        if not data_dict.get("quotation_number"):
            data_dict["quotation_number"] = await QuotationRepository.get_next_number()

        if current_user:
            work = current_user.get("work_details", {})
            user_role = str(work.get("system_role") or current_user.get("system_role", "Employee")).strip()
            creator_name = current_user.get("contact_info", {}).get("full_name") or current_user.get("full_name") or current_user.get("email_address") or "User"
            data_dict["created_by"] = {
                "user_id": str(current_user.get("_id", "")),
                "name": creator_name,
                "role": user_role
            }

        calculated_data = await QuotationService._calculate_quotation_fields(data_dict)
        created = await QuotationRepository.create(calculated_data)
        updated_created = await QuotationService._generate_and_store_quotation_pdf(created["_id"], delete_old=False)
        await clear_pattern("quotations:list:*")
        return updated_created or created

    @staticmethod
    async def get_all_quotations(
        is_deleted: bool = False,
        status: Optional[str] = None,
        search: Optional[str] = None,
        client_id: Optional[str] = None,
        timeline: Optional[str] = None,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        page: Optional[int] = None,
        limit: Optional[int] = None
    ) -> Dict[str, Any]:
        cache_key = make_list_key(
            "quotations",
            is_deleted=is_deleted,
            status=status,
            search=search,
            client_id=client_id,
            timeline=timeline,
            from_date=from_date,
            to_date=to_date,
            page=page,
            limit=limit
        )
        cached = await get_cache(cache_key)
        if cached is not None:
            return cached

        result = await QuotationRepository.get_all(
            is_deleted=is_deleted,
            status=status,
            search=search,
            client_id=client_id,
            timeline=timeline,
            from_date=from_date,
            to_date=to_date,
            page=page,
            limit=limit
        )
        await set_cache(cache_key, result, ttl=1800)
        return result

    @staticmethod
    async def get_kpi_stats(
        timeline: Optional[str] = "all",
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        client_id: Optional[str] = None
    ) -> Dict[str, Any]:
        cache_key = make_list_key(
            "quotations_kpi",
            timeline=timeline,
            from_date=from_date,
            to_date=to_date,
            client_id=client_id
        )
        cached = await get_cache(cache_key)
        if cached is not None:
            return cached

        res = await QuotationRepository.get_kpi_stats(
            timeline=timeline,
            from_date=from_date,
            to_date=to_date,
            client_id=client_id
        )
        await set_cache(cache_key, res, ttl=600)
        return res

    @staticmethod
    async def get_quotation_by_id(quotation_id: str) -> Optional[Dict[str, Any]]:
        cache_key = f"quotation:{quotation_id}"
        cached = await get_cache(cache_key)
        if cached is not None:
            return cached

        item = await QuotationRepository.get_by_id(quotation_id)
        if item:
            await set_cache(cache_key, item, ttl=1800)
        return item

    @staticmethod
    async def update_quotation(quotation_id: str, data: QuotationUpdate) -> bool:
        existing = await QuotationRepository.get_by_id(quotation_id)
        if not existing:
            return False

        update_dict = data.model_dump(exclude_unset=True)
        calculated_data = await QuotationService._calculate_quotation_fields(update_dict, existing_item=existing)

        success = await QuotationRepository.update(quotation_id, calculated_data)
        if success:
            await QuotationService._generate_and_store_quotation_pdf(quotation_id, delete_old=True)
            await clear_pattern("quotations:list:*")
            await delete_cache(f"quotation:{quotation_id}")
        return success

    @staticmethod
    async def update_status(quotation_id: str, status: str) -> bool:
        success = await QuotationRepository.update_status(quotation_id, status)
        if success:
            await QuotationService._generate_and_store_quotation_pdf(quotation_id, delete_old=True)
            await clear_pattern("quotations:list:*")
            await delete_cache(f"quotation:{quotation_id}")
        return success

    @staticmethod
    async def convert_to_invoice(
        quotation_id: str,
        convert_req: Optional[Any] = None,
        current_user: Optional[Dict[str, Any]] = None,
        invoice_type: str = "Tax Invoice",
        due_date: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        quotation = await QuotationRepository.get_by_id(quotation_id)
        if not quotation or quotation.get("is_deleted"):
            return None

        # Extract overrides if convert_req is provided
        req_dict = convert_req.model_dump(exclude_unset=True) if hasattr(convert_req, "model_dump") and convert_req else {}

        target_inv_type = req_dict.get("invoice_type") or invoice_type or "Tax Invoice"
        target_due_date = req_dict.get("due_date") or due_date

        # Build LineItemSchema objects (from req_dict override or quotation default)
        override_items = req_dict.get("line_items")
        if override_items:
            items_objs = override_items
        else:
            raw_items = quotation.get("line_items", []) or []
            items_objs = []
            for it in raw_items:
                items_objs.append(LineItemSchema(
                    description=it.get("description", ""),
                    sac=it.get("sac"),
                    quantity=float(it.get("quantity") or 1.0),
                    rate=float(it.get("rate") or 0.0),
                    discount=float(it.get("discount") or 0.0)
                ))

        notes_content = req_dict.get("notes") or f"Converted from Quotation {quotation.get('quotation_number')}. {quotation.get('notes') or ''}".strip()

        invoice_data = InvoiceCreate(
            invoice_type=target_inv_type,
            client_id=req_dict.get("client_id") or quotation.get("client_id"),
            client_name=req_dict.get("client_name") or quotation.get("client_name"),
            client_address=req_dict.get("client_address") or quotation.get("client_address"),
            client_phone=req_dict.get("client_phone") or quotation.get("client_phone"),
            client_gstin=req_dict.get("client_gstin") or quotation.get("client_gstin"),
            client_department=req_dict.get("client_department") or quotation.get("client_department"),
            state_ut=req_dict.get("state_ut") or quotation.get("state_ut"),
            due_date=target_due_date,
            line_items=items_objs,
            tax_option=req_dict.get("tax_option") or quotation.get("tax_option"),
            cgst_rate=req_dict.get("cgst_rate") if req_dict.get("cgst_rate") is not None else quotation.get("cgst_rate"),
            sgst_rate=req_dict.get("sgst_rate") if req_dict.get("sgst_rate") is not None else quotation.get("sgst_rate"),
            igst_rate=req_dict.get("igst_rate") if req_dict.get("igst_rate") is not None else quotation.get("igst_rate"),
            additional_discount=float(req_dict.get("additional_discount") if req_dict.get("additional_discount") is not None else (quotation.get("additional_discount") or 0.0)),
            bank_account_id=req_dict.get("bank_account_id"),
            notes=notes_content
        )

        created_invoice = await InvoiceService.create_invoice(invoice_data, current_user=current_user)
        inv_id = created_invoice["_id"]
        inv_num = created_invoice["invoice_number"]

        await QuotationRepository.mark_converted(quotation_id, inv_id, inv_num)
        await clear_pattern("quotations:list:*")
        await delete_cache(f"quotation:{quotation_id}")

        return created_invoice

    @staticmethod
    async def delete_quotation(quotation_id: str) -> bool:
        existing = await QuotationRepository.get_by_id(quotation_id)
        if existing and existing.get("pdf_path"):
            delete_pdf_file(existing.get("pdf_path"))

        success = await QuotationRepository.delete(quotation_id)
        if success:
            await clear_pattern("quotations:list:*")
            await delete_cache(f"quotation:{quotation_id}")
        return success
