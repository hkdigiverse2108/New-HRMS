import io
import re
from datetime import datetime
from typing import List, Dict, Any, Optional
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT

from app.repository.document_template import DocumentTemplateRepository
from app.repository.generated_document import GeneratedDocumentRepository
from app.repository.employee import EmployeeRepository
from app.schemas.generated_document import (
    DocumentPreviewRequest, DocumentPreviewResponse, VariableItem,
    DocumentGenerateRequest, GeneratedDocumentResponse
)
from app.services.document_template import DocumentTemplateService
from app.utils.storage import save_pdf_file, delete_pdf_file
from app.redis.service import get_cache, set_cache, delete_cache, clear_pattern, make_list_key

import os
from PIL import Image
from fastapi import HTTPException, status
from app.services.settings import SettingsService

class DocumentGeneratorService:

    @staticmethod
    def _extract_employee_data(employee: Dict[str, Any]) -> Dict[str, str]:
        """Maps standard employee database fields to placeholder keys."""
        contact = employee.get("contact_info", {}) or {}
        work = employee.get("work_details", {}) or {}
        payroll = employee.get("payroll", {}) or {}

        full_name = str(contact.get("full_name") or employee.get("full_name") or employee.get("client_name") or "").strip()
        emp_code = str(employee.get("employee_code") or employee.get("employee_id") or str(employee.get("_id"))[:6]).strip()
        email = str(contact.get("email_address") or contact.get("email") or employee.get("email") or "").strip()
        phone = str(contact.get("phone_number") or contact.get("phone") or employee.get("phone") or "").strip()

        desig_obj = work.get("designation")
        if isinstance(desig_obj, dict):
            designation = str(desig_obj.get("name") or desig_obj.get("title") or "").strip()
        else:
            designation = str(desig_obj or "").strip()

        dept_obj = work.get("department")
        if isinstance(dept_obj, dict):
            department = str(dept_obj.get("name") or "").strip()
        else:
            department = str(dept_obj or "").strip()

        raw_jd = str(work.get("joining_date") or "")[:10]
        joining_date = raw_jd
        if len(raw_jd) == 10 and raw_jd[4] == "-" and raw_jd[7] == "-":
            p = raw_jd.split("-")
            joining_date = f"{p[2]}-{p[1]}-{p[0]}"

        address = str(contact.get("address") or contact.get("current_address") or "").strip()
        salary = str(payroll.get("net_salary") or payroll.get("basic_salary") or "").strip()

        today_str = datetime.utcnow().strftime("%d-%m-%Y")

        mapping = {
            "employee_name": full_name,
            "empName": full_name,
            "emp_name": full_name,
            "name": full_name,
            "full_name": full_name,
            "employee_code": emp_code,
            "empCode": emp_code,
            "emp_code": emp_code,
            "email": email,
            "employee_email": email,
            "phone": phone,
            "employee_phone": phone,
            "designation": designation,
            "Designation": designation,
            "desig_name": designation,
            "department": department,
            "Department": department,
            "dept_name": department,
            "joining_date": joining_date,
            "date_of_joining": joining_date,
            "startDateFormatted": joining_date,
            "start_date": joining_date,
            "address": address,
            "salary": salary,
            "date": today_str,
            "today_date": today_str,
            "todayDate": today_str,
            "Date": today_str,
            "current_date": today_str
        }
        return mapping

    @staticmethod
    def _render_html_with_variables(html_template: str, variables: Dict[str, Any]) -> str:
        """Replaces all {{variable_name}} in HTML template with supplied values."""
        if not html_template:
            return ""

        def replacer(match):
            key = match.group(1).strip()
            val = variables.get(key)
            if val is not None:
                return str(val)
            return match.group(0) # Keep unchanged if not provided

        return re.sub(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}", replacer, html_template)

    @staticmethod
    def html_to_pdf_bytes(title: str, category: str, rendered_html: str, letterhead_path: Optional[str] = None) -> bytes:
        """Generates an A4 PDF document matching the reference formatting and letterhead."""
        buffer = io.BytesIO()
        
        has_letterhead = bool(letterhead_path and os.path.exists(letterhead_path))
        header_h = 0.0

        if has_letterhead:
            try:
                with Image.open(letterhead_path) as img:
                    w, h = img.size
                    if w > 0:
                        header_h = (float(h) / float(w)) * A4[0]
            except Exception as e:
                print(f"[LETTERHEAD DIMENSION CALC WARNING] {e}")
                header_h = 110.0

        top_m = (header_h + 20.0) if has_letterhead else 40.0
        bot_m = 50.0 if has_letterhead else 40.0
        side_m = 45.0 if has_letterhead else 40.0

        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=side_m,
            leftMargin=side_m,
            topMargin=top_m,
            bottomMargin=bot_m
        )

        styles = getSampleStyleSheet()

        h1_style = ParagraphStyle(
            "DocH1",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=12,
            leading=16,
            textColor=colors.HexColor("#111827"),
            alignment=TA_LEFT,
            spaceBefore=12,
            spaceAfter=8
        )

        h3_style = ParagraphStyle(
            "DocH3",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=14,
            textColor=colors.HexColor("#111827"),
            alignment=TA_LEFT,
            spaceBefore=10,
            spaceAfter=6
        )

        body_style = ParagraphStyle(
            "DocBody",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=9.5,
            leading=14.5,
            textColor=colors.HexColor("#111827"),
            alignment=TA_LEFT,
            spaceBefore=2,
            spaceAfter=8
        )

        story = []

        # If no letterhead background is configured, draw standard top header banner
        if not has_letterhead:
            title_style = ParagraphStyle(
                "DocTitle",
                parent=styles["Normal"],
                fontName="Helvetica-Bold",
                fontSize=15,
                leading=19,
                textColor=colors.HexColor("#1F2937"),
                spaceAfter=4
            )
            cat_style = ParagraphStyle(
                "DocCat",
                parent=styles["Normal"],
                fontName="Helvetica-Bold",
                fontSize=8.5,
                leading=11,
                textColor=colors.HexColor("#6B7280"),
                spaceAfter=10
            )
            story.append(Paragraph(f"<b>{title.upper()}</b>", title_style))
            story.append(Paragraph(f"CATEGORY: {category.upper()}", cat_style))
            story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#E5E7EB"), spaceAfter=14))

        # Parse rendered_html blocks carefully to preserve exact line spacing and tags
        raw_html = rendered_html or ""
        
        # Replace common HTML block tags into standardized split markers
        raw_html = raw_html.replace("<h1>", "___H1___").replace("</h1>", "___END_H1___")
        raw_html = raw_html.replace("<h2>", "___H3___").replace("</h2>", "___END_H3___")
        raw_html = raw_html.replace("<h3>", "___H3___").replace("</h3>", "___END_H3___")
        raw_html = raw_html.replace("<p>", "___P___").replace("</p>", "___END_P___")
        raw_html = raw_html.replace("<br>", "<br/>").replace("\n", "<br/>")

        pattern = r"(___H1___.*?___END_H1___|___H3___.*?___END_H3___|___P___.*?___END_P___)"
        blocks = re.split(pattern, raw_html, flags=re.DOTALL)

        for b in blocks:
            b_str = b.strip()
            if not b_str:
                continue

            if b_str.startswith("___H1___"):
                content = b_str.replace("___H1___", "").replace("___END_H1___", "").strip()
                if content:
                    story.append(Paragraph(f"<b>{content}</b>", h1_style))
            elif b_str.startswith("___H3___"):
                content = b_str.replace("___H3___", "").replace("___END_H3___", "").strip()
                if content:
                    story.append(Paragraph(f"<b>{content}</b>", h3_style))
            elif b_str.startswith("___P___"):
                content = b_str.replace("___P___", "").replace("___END_P___", "").strip()
                if content:
                    story.append(Paragraph(content, body_style))
            else:
                clean_b = b_str.replace("___END_H1___", "").replace("___END_H3___", "").replace("___END_P___", "").strip()
                if clean_b and clean_b != "<br/>":
                    story.append(Paragraph(clean_b, body_style))

        def draw_bg(canvas, document):
            if has_letterhead and letterhead_path:
                canvas.saveState()
                try:
                    # Draw letterhead top banner accurately at the top of A4 page
                    canvas.drawImage(
                        letterhead_path,
                        0, A4[1] - header_h,
                        width=A4[0],
                        height=header_h,
                        preserveAspectRatio=False,
                        mask='auto'
                    )
                except Exception as e:
                    print(f"[LETTERHEAD BG DRAW WARNING] {e}")
                canvas.restoreState()

        if has_letterhead:
            doc.build(story, onFirstPage=draw_bg, onLaterPages=draw_bg)
        else:
            doc.build(story)

        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes

    @staticmethod
    async def preview_document(req: DocumentPreviewRequest) -> Optional[DocumentPreviewResponse]:
        template = await DocumentTemplateRepository.get_by_id(req.template_id)
        if not template or template.get("is_deleted"):
            return None

        employee = await EmployeeRepository.get_by_id(req.employee_id)
        if not employee or employee.get("is_deleted"):
            return None

        emp_mapping = DocumentGeneratorService._extract_employee_data(employee)
        placeholders = template.get("placeholders", []) or DocumentTemplateService.extract_placeholders(template.get("content", ""))

        variable_items = []
        preview_values = {}

        for key in placeholders:
            val = emp_mapping.get(key, "")
            is_auto = bool(val)
            variable_items.append(VariableItem(
                key=key,
                label=key.replace("_", " ").upper(),
                value=val,
                auto_filled=is_auto
            ))
            preview_values[key] = val or f"[{key.replace('_', ' ').upper()}]"

        rendered_preview = DocumentGeneratorService._render_html_with_variables(template.get("content", ""), preview_values)

        emp_name = emp_mapping.get("employee_name") or "Employee"
        emp_code = emp_mapping.get("employee_code")

        return DocumentPreviewResponse(
            template_id=str(template["_id"]),
            template_name=template.get("template_name", "Document"),
            category=template.get("category", "General"),
            employee_id=str(employee["_id"]),
            employee_name=f"{emp_name} ({emp_code})" if emp_code else emp_name,
            employee_code=emp_code,
            variables=variable_items,
            preview_html=rendered_preview
        )

    @staticmethod
    async def generate_document(req: DocumentGenerateRequest, current_user: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        template = await DocumentTemplateRepository.get_by_id(req.template_id)
        if not template or template.get("is_deleted"):
            return None

        employee = None
        if req.employee_id and req.employee_id != "manual":
            employee = await EmployeeRepository.get_by_id(req.employee_id)

        emp_mapping = DocumentGeneratorService._extract_employee_data(employee) if employee else {}
        custom_vars = dict(req.variables or {})
        if getattr(req, "placeholder_values", None):
            custom_vars.update(req.placeholder_values)
        merged_variables = {**emp_mapping, **custom_vars}

        # Ensure all template placeholders present in template have default values if omitted
        placeholders = template.get("placeholders", []) or DocumentTemplateService.extract_placeholders(template.get("content", ""))
        for key in placeholders:
            val = merged_variables.get(key)
            if val is None:
                merged_variables[key] = f"[{key}]"

        rendered_html = DocumentGeneratorService._render_html_with_variables(template.get("content", ""), merged_variables)

        template_name = template.get("template_name", "Document")
        category = template.get("category", "General")
        emp_name = merged_variables.get("employee_name") or merged_variables.get("name") or "Employee"
        emp_code = merged_variables.get("employee_code") or merged_variables.get("emp_code") or "EMP"

        # Check Letterhead from Admin Settings
        letterhead_path = None
        try:
            settings_data = await SettingsService.get_settings()
            if settings_data and settings_data.get("letterhead_url"):
                l_url = str(settings_data.get("letterhead_url")).lstrip("/")
                if os.path.exists(l_url):
                    letterhead_path = os.path.abspath(l_url)
                elif os.path.exists(os.path.join("uploads", "settings", os.path.basename(l_url))):
                    letterhead_path = os.path.abspath(os.path.join("uploads", "settings", os.path.basename(l_url)))
        except Exception as se:
            print(f"[SETTINGS LETTERHEAD FETCH WARNING] {se}")

        # Generate PDF File with Letterhead
        pdf_bytes = DocumentGeneratorService.html_to_pdf_bytes(template_name, category, rendered_html, letterhead_path=letterhead_path)
        safe_filename = f"{template_name.replace(' ', '_')}_{emp_code}"
        pdf_path, pdf_url = save_pdf_file(pdf_bytes, safe_filename, subfolder="documents/generated")

        user_info = None
        if current_user:
            work = current_user.get("work_details", {})
            user_role = str(work.get("system_role") or current_user.get("system_role", "Admin")).strip()
            creator_name = current_user.get("contact_info", {}).get("full_name") or current_user.get("full_name") or "Admin"
            user_info = {
                "user_id": str(current_user.get("_id", "")),
                "name": creator_name,
                "role": user_role
            }

        doc_record = {
            "template_id": str(template["_id"]),
            "template_name": template_name,
            "category": category,
            "employee_id": str(employee["_id"]) if employee else (req.employee_id or "manual"),
            "employee_name": emp_name,
            "employee_code": emp_code,
            "variables": merged_variables,
            "rendered_content": rendered_html,
            "pdf_path": pdf_path,
            "pdf_url": pdf_url,
            "generated_by": user_info
        }

        created = await GeneratedDocumentRepository.create(doc_record)
        await clear_pattern("generated_documents:*")
        return created

    @staticmethod
    async def get_all_generated_documents(is_deleted: bool = False, employee_id: Optional[str] = None, template_id: Optional[str] = None, search: Optional[str] = None) -> List[Dict[str, Any]]:
        cache_key = make_list_key("generated_documents:list", is_deleted=is_deleted, employee_id=employee_id, template_id=template_id, search=search)
        cached = await get_cache(cache_key)
        if cached is not None:
            return cached

        items = await GeneratedDocumentRepository.get_all(is_deleted=is_deleted, employee_id=employee_id, template_id=template_id, search=search)
        await set_cache(cache_key, items, ttl=1800)
        return items

    @staticmethod
    async def get_by_id(item_id: str) -> Optional[Dict[str, Any]]:
        cache_key = f"generated_document:{item_id}"
        cached = await get_cache(cache_key)
        if cached is not None:
            return cached

        item = await GeneratedDocumentRepository.get_by_id(item_id)
        if item:
            await set_cache(cache_key, item, ttl=1800)
        return item

    @staticmethod
    async def delete_generated_document(item_id: str) -> bool:
        item = await GeneratedDocumentRepository.get_by_id(item_id)
        if item and item.get("pdf_path"):
            delete_pdf_file(item.get("pdf_path"))

        success = await GeneratedDocumentRepository.delete(item_id)
        if success:
            await clear_pattern("generated_documents:*")
            await delete_cache(f"generated_document:{item_id}")
        return success
