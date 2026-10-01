import io
import os
from typing import Dict, Any, Optional
from PIL import Image
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether, Image as RLImage, Flowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT

from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

MAIN_FONT = "Helvetica"
BOLD_FONT = "Helvetica-Bold"
CURRENCY_SYMBOL = "Rs."

def hex_to_rgb(h: str):
    h = str(h or "").lstrip('#')
    if len(h) != 6:
        h = "C08497"
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def get_gradient_colors(primary_hex: str, secondary_hex: Optional[str] = None):
    primary_hex = str(primary_hex or "#C08497").strip()
    if not primary_hex.startswith("#"):
        primary_hex = f"#{primary_hex}"

    if secondary_hex:
        secondary_hex = str(secondary_hex).strip()
        if not secondary_hex.startswith("#"):
            secondary_hex = f"#{secondary_hex}"

    if not secondary_hex:
        try:
            h = primary_hex.lstrip('#')
            r, g, b = tuple(int(h[i:i+2], 16) for i in (0, 2, 4))
            r_end = max(0, int(r * 0.75))
            g_end = max(0, int(g * 0.75))
            b_end = max(0, int(b * 0.75))
            secondary_hex = f"#{r_end:02x}{g_end:02x}{b_end:02x}"
        except Exception:
            secondary_hex = "#906371"

    return primary_hex, secondary_hex

def generate_gradient_png(start_hex: str, end_hex: str, width: int = 545, height: int = 30, filename: str = "gradient.png") -> str:
    c1 = hex_to_rgb(start_hex)
    c2 = hex_to_rgb(end_hex)
    w = max(10, int(width * 2))
    h = max(10, int(height * 2))

    base = Image.new("RGBA", (w, h), c1)
    top = Image.new("RGBA", (w, h), c2)
    mask = Image.new("L", (w, h))
    mask_data = [int(255 * (x / float(w))) for _ in range(h) for x in range(w)]
    mask.putdata(mask_data)
    img = Image.composite(top, base, mask)

    cache_dir = os.path.join("uploads", "cache")
    os.makedirs(cache_dir, exist_ok=True)
    clean_filename = f"grad_{start_hex.replace('#', '')}_{end_hex.replace('#', '')}_{width}_{height}.png"
    filepath = os.path.abspath(os.path.join(cache_dir, clean_filename))
    img.save(filepath)
    return filepath

class GradientBox(Flowable):
    def __init__(self, width: float, height: float, start_hex: str, end_hex: str, content_flowable: Flowable, filename: str = "grad.png"):
        super().__init__()
        self.width = width
        self.height = height
        self.start_hex = start_hex
        self.end_hex = end_hex
        self.content = content_flowable
        self.img_path = generate_gradient_png(start_hex, end_hex, int(width), int(height), filename)

    def wrap(self, availWidth, availHeight):
        w, h = self.content.wrap(self.width, self.height)
        self.width = w if w > 0 else self.width
        self.height = h if h > 0 else self.height
        return self.width, self.height

    def draw(self):
        self.canv.drawImage(self.img_path, 0, 0, width=self.width, height=self.height)
        self.content.drawOn(self.canv, 0, 0)

class GradientTable(Table):
    def __init__(self, data, colWidths=None, rowHeights=None, style=None, start_hex='#C08497', end_hex='#906371'):
        super().__init__(data, colWidths=colWidths, rowHeights=rowHeights, style=style)
        self.start_hex = start_hex
        self.end_hex = end_hex

    def draw(self):
        w = sum(self._colWidths)
        h = self._rowHeights[0] if (self._rowHeights and len(self._rowHeights) > 0) else 23
        total_h = self._height
        y0 = total_h - h
        img_path = generate_gradient_png(self.start_hex, self.end_hex, int(w), int(h))
        self.canv.drawImage(img_path, 0, y0, width=w, height=h)
        super().draw()

try:
    if os.path.exists("C:/Windows/Fonts/segoeui.ttf") and os.path.exists("C:/Windows/Fonts/segoeuib.ttf"):
        pdfmetrics.registerFont(TTFont("SegoeUI", "C:/Windows/Fonts/segoeui.ttf"))
        pdfmetrics.registerFont(TTFont("SegoeUI-Bold", "C:/Windows/Fonts/segoeuib.ttf"))
        MAIN_FONT = "SegoeUI"
        BOLD_FONT = "SegoeUI-Bold"
        CURRENCY_SYMBOL = "₹"
except Exception as fe:
    print(f"[PDF FONT NOTICE] Fallback to standard fonts: {fe}")

def number_to_words_indian(num: float) -> str:
    """Converts a number to Indian currency words format (e.g. Two Lakh Thirty Five Thousand...)"""
    try:
        num_int = int(round(num))
        if num_int == 0:
            return "Zero Rupees Only"
        
        units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
                 "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"]
        tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]
        
        def _convert_below_thousand(n):
            if n == 0:
                return ""
            elif n < 20:
                return units[n]
            elif n < 100:
                return tens[n // 10] + (" " + units[n % 10] if n % 10 != 0 else "")
            else:
                return units[n // 100] + " Hundred" + (" and " + _convert_below_thousand(n % 100) if n % 100 != 0 else "")

        parts = []
        crores = num_int // 10000000
        num_int %= 10000000
        
        lakhs = num_int // 100000
        num_int %= 100000
        
        thousands = num_int // 1000
        num_int %= 1000
        
        if crores > 0:
            parts.append(_convert_below_thousand(crores) + " Crore")
        if lakhs > 0:
            parts.append(_convert_below_thousand(lakhs) + " Lakh")
        if thousands > 0:
            parts.append(_convert_below_thousand(thousands) + " Thousand")
        if num_int > 0:
            parts.append(_convert_below_thousand(num_int))
            
        return " ".join(parts).strip() + " Rupees Only"
    except Exception:
        return f"{num:,.2f} Rupees Only"


class PDFGeneratorService:

    @staticmethod
    def generate_invoice_pdf(data: Dict[str, Any]) -> bytes:
        """
        Generates an Invoice PDF in A4 size matching the exact spacing & styling of Image 2.
        Preserves original Dusty Rose color theme (#C08497 / #B5798C) as requested.
        Matches Tax Summary underline and Signature block alignment pixel-perfectly.
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,  # Standard A4 Page Size (595.27 x 841.89 pt)
            rightMargin=25,
            leftMargin=25,
            topMargin=25,
            bottomMargin=25
        )

        styles = getSampleStyleSheet()
        
        # Color Palette Dynamically Fetched from Settings (Primary Color & Secondary Color)
        start_color, end_color = get_gradient_colors(data.get("primary_color"), data.get("secondary_color"))
        clean_s = start_color.replace("#", "")
        clean_e = end_color.replace("#", "")

        try:
            accent_theme = colors.HexColor(start_color)
        except Exception:
            accent_theme = colors.HexColor("#C08497")

        text_dark = colors.HexColor("#1F2937")           # Main Body Text
        text_muted = colors.HexColor("#6B7280")          # Muted Gray labels
        gray_bg = colors.HexColor("#F9FAFB")             # Subtle background
        gray_box_bg = colors.HexColor("#F3F4F6")         # Amount in words box
        gray_border = colors.HexColor("#E5E7EB")         # Table / Box borders

        # Enhanced Paragraph Styles with Clean Line Spacing (Leading)
        company_name_style = ParagraphStyle("CompName", parent=styles["Normal"], fontName=BOLD_FONT, fontSize=14, leading=17, textColor=text_dark, spaceAfter=4)
        company_addr_style = ParagraphStyle("CompAddr", parent=styles["Normal"], fontName=MAIN_FONT, fontSize=8.5, leading=12.5, textColor=text_muted, spaceAfter=2)
        
        badge_style = ParagraphStyle("Badge", parent=styles["Normal"], fontName=BOLD_FONT, fontSize=9, textColor=colors.white, alignment=TA_CENTER)
        
        label_muted = ParagraphStyle("LabelMuted", parent=styles["Normal"], fontName=BOLD_FONT, fontSize=8.5, leading=11, textColor=text_muted, spaceAfter=3)
        client_name_style = ParagraphStyle("ClientName", parent=styles["Normal"], fontName=BOLD_FONT, fontSize=11, leading=14, textColor=text_dark, spaceAfter=3)
        body_text = ParagraphStyle("BodyText", parent=styles["Normal"], fontName=MAIN_FONT, fontSize=8.5, leading=12.5, textColor=text_dark)
        
        meta_label = ParagraphStyle("MetaLabel", parent=styles["Normal"], fontName=MAIN_FONT, fontSize=8.5, leading=12, textColor=text_muted, alignment=TA_RIGHT)
        meta_val = ParagraphStyle("MetaVal", parent=styles["Normal"], fontName=BOLD_FONT, fontSize=8.5, leading=12, textColor=text_dark, alignment=TA_RIGHT)

        th_left = ParagraphStyle("THLeft", parent=styles["Normal"], fontName=BOLD_FONT, fontSize=8.5, leading=11, textColor=colors.white)
        th_right = ParagraphStyle("THRight", parent=styles["Normal"], fontName=BOLD_FONT, fontSize=8.5, leading=11, textColor=colors.white, alignment=TA_RIGHT)
        
        tb_left = ParagraphStyle("TBLeft", parent=styles["Normal"], fontName=MAIN_FONT, fontSize=8.5, leading=12, textColor=text_dark)
        tb_right = ParagraphStyle("TBRight", parent=styles["Normal"], fontName=MAIN_FONT, fontSize=8.5, leading=12, textColor=text_dark, alignment=TA_RIGHT)
        tb_bold_right = ParagraphStyle("TBBoldRight", parent=styles["Normal"], fontName=BOLD_FONT, fontSize=8.5, leading=12, textColor=text_dark, alignment=TA_RIGHT)

        total_badge_lbl = ParagraphStyle("TotalBadgeLbl", parent=styles["Normal"], fontName=BOLD_FONT, fontSize=10, textColor=colors.white)
        total_badge_val = ParagraphStyle("TotalBadgeVal", parent=styles["Normal"], fontName=BOLD_FONT, fontSize=11, textColor=colors.white, alignment=TA_RIGHT)

        story = []

        # Dynamic Company Header Data
        comp_name = data.get("company_name") or "Harikrushn DigiVerse LLP"
        comp_addr = data.get("company_address") or "FLAT-204, 2nd FLOOR, RS NO-67/1, WING-A, HARIKRUSHANA COMPLEX, OPP. BHAGAT NAGAR, VED, GURUKULROAD, KATARGAM, SURAT- 395004, Gujarat, INDIA..."
        comp_phone = data.get("company_phone") or "+919537150942"
        comp_email = data.get("company_email") or "parthlathiya2004@gmail.com"
        comp_gstin = data.get("company_gstin") or "24AAXFN3372M1ZK"
        comp_pan = data.get("company_pan") or "AAXFN3372M"
        comp_llpin = data.get("company_llpin") or "ACK-1143"
        comp_state = data.get("company_state_code") or "24"
        logo_url = data.get("logo_url")
        sig_url = data.get("signature_url")
        sig_name = data.get("signature_name") or "Authorized Signatory"

        # ---------------------------------------------------------
        # 1. HEADER SECTION (Company Info Left, TAX INVOICE Badge Right)
        # ---------------------------------------------------------
        company_text_block = [
            Paragraph(f"<b>{comp_name}</b>", company_name_style),
            Paragraph(comp_addr, company_addr_style),
            Paragraph(f"Ph: {comp_phone} | {comp_email}", company_addr_style),
            Paragraph(f"GSTIN: {comp_gstin} | PAN: {comp_pan} | LLPIN: {comp_llpin} | State: {comp_state}", company_addr_style),
        ]

        # Logo handling if provided
        logo_path = None
        if logo_url:
            clean_rel = logo_url.lstrip("/")
            if os.path.exists(clean_rel):
                logo_path = os.path.abspath(clean_rel)

        if logo_path:
            logo_img = RLImage(logo_path, width=54, height=54)
            company_left_table = Table([[logo_img, company_text_block]], colWidths=[65, 350])
            company_left_table.setStyle(TableStyle([
                ("VALIGN", (0, 0), (0, 0), "MIDDLE"),
                ("VALIGN", (1, 0), (1, 0), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (0, 0), 10),
            ]))
            company_left = [company_left_table]
        else:
            company_left = company_text_block

        inv_type = str(data.get("invoice_type") or "TAX INVOICE").upper()
        badge_table = Table([[Paragraph(f"<b>{inv_type}</b>", badge_style)]], colWidths=[120], rowHeights=[22])
        badge_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ]))
        badge_gradient = GradientBox(120, 22, start_color, end_color, badge_table, f"badge_{clean_s}_{clean_e}.png")

        header_right = [badge_gradient]

        header_table = Table([[company_left, header_right]], colWidths=[415, 130])
        header_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("ALIGN", (1, 0), (1, 0), "RIGHT"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ]))
        story.append(header_table)
        story.append(Spacer(1, 10))
        story.append(HRFlowable(width="100%", thickness=0.8, color=colors.HexColor("#E5E7EB"), spaceAfter=14))

        # ---------------------------------------------------------
        # 2. CLIENT & INVOICE META SECTION
        # ---------------------------------------------------------
        client_name = data.get("client_name") or ""
        client_company = data.get("client_company")
        client_addr = data.get("client_address")
        client_phone = data.get("client_phone")
        client_gstin = data.get("client_gstin")
        state_ut = data.get("state_ut")
        if state_ut and " - " in state_ut:
            state_ut = state_ut.split(" - ")[-1]

        label_title = "QUOTATION TO" if inv_type == "QUOTATION" else "BILL TO"
        bill_to_cell = [
            Paragraph(label_title, label_muted),
            Paragraph(f"<b>{client_name}</b>", client_name_style),
        ]
        if client_company:
            bill_to_cell.append(Paragraph(client_company, body_text))
        if client_addr:
            bill_to_cell.append(Paragraph(client_addr, body_text))
        if client_phone:
            bill_to_cell.append(Paragraph(f"Ph: {client_phone}", body_text))
        if client_gstin and str(client_gstin).strip():
            bill_to_cell.append(Paragraph(f"GSTIN: {client_gstin}", body_text))

        inv_num = data.get("invoice_number") or data.get("quotation_number", "QUO-001")
        issue_date = data.get("issue_date") or data.get("quotation_date") or data.get("created_at")
        if hasattr(issue_date, "strftime"):
            issue_date = issue_date.strftime("%Y-%m-%d")
        else:
            issue_date = str(issue_date or "2026-10-01")[:10]

        num_label = "Quotation No." if inv_type == "QUOTATION" else "Invoice No."
        meta_table_data = [
            [Paragraph(num_label, meta_label), Paragraph(inv_num, meta_val)],
            [Paragraph("Date", meta_label), Paragraph(issue_date, meta_val)],
        ]
        if state_ut:
            meta_table_data.append([Paragraph("Place of Supply", meta_label), Paragraph(state_ut, meta_val)])

        meta_table = Table(meta_table_data, colWidths=[100, 100])
        meta_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
        ]))

        meta_cell = [meta_table]

        info_table = Table([[bill_to_cell, meta_cell]], colWidths=[345, 200])
        info_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ]))
        story.append(info_table)
        story.append(Spacer(1, 16))

        # ---------------------------------------------------------
        # 3. LINE ITEMS TABLE (A4 Standard Width = 545 pt)
        # ---------------------------------------------------------
        col_widths = [28, 170, 42, 28, 68, 70, 68, 71]

        table_headers = [
            Paragraph("S.No", th_left),
            Paragraph("Product Description", th_left),
            Paragraph("SAC", th_left),
            Paragraph("Qty", th_right),
            Paragraph("Rate", th_right),
            Paragraph("Amount", th_right),
            Paragraph("Disc.", th_right),
            Paragraph("Taxable Amt", th_right),
        ]

        line_items = data.get("line_items", []) or []
        total_qty = 0
        total_gross = 0.0
        total_disc = 0.0
        total_taxable = 0.0
        data_rows = []

        for idx, item in enumerate(line_items, 1):
            if isinstance(item, dict):
                desc = item.get("description", "")
                sac = item.get("sac") or "-"
                qty = float(item.get("quantity") or 1)
                rate = float(item.get("rate") or 0.0)
                disc = float(item.get("discount") or 0.0)
                amt = float(item.get("amount") or (qty * rate) - disc)
            else:
                desc = getattr(item, "description", "")
                sac = getattr(item, "sac", None) or "-"
                qty = float(getattr(item, "quantity", 1))
                rate = float(getattr(item, "rate", 0.0))
                disc = float(getattr(item, "discount", 0.0))
                amt = float(getattr(item, "amount", (qty * rate) - disc))

            gross_amt = (qty * rate)
            total_qty += int(qty)
            total_gross += gross_amt
            total_disc += disc
            total_taxable += amt

            data_rows.append([
                Paragraph(str(idx), tb_left),
                Paragraph(str(desc), tb_left),
                Paragraph(str(sac), tb_left),
                Paragraph(f"{int(qty) if qty.is_integer() else qty}", tb_right),
                Paragraph(f"{rate:,.2f}", tb_right),
                Paragraph(f"{gross_amt:,.2f}", tb_right),
                Paragraph(f"{CURRENCY_SYMBOL}{disc:,.2f}" if disc > 0 else f"{disc:.2f}", tb_right),
                Paragraph(f"{amt:,.2f}", tb_right),
            ])

        # Add Total Row inside table
        data_rows.append([
            Paragraph("<b>Total</b>", tb_left),
            Paragraph("", tb_left),
            Paragraph("", tb_left),
            Paragraph(f"<b>{total_qty}</b>", tb_bold_right),
            Paragraph("", tb_right),
            Paragraph(f"<b>{total_gross:,.2f}</b>", tb_bold_right),
            Paragraph(f"<b>{total_disc:,.2f}</b>", tb_bold_right),
            Paragraph(f"<b>{total_taxable:,.2f}</b>", tb_bold_right),
        ])

        full_table_data = [table_headers] + data_rows
        items_table = GradientTable(full_table_data, colWidths=col_widths, start_hex=start_color, end_hex=end_color)
        items_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, 0), "MIDDLE"),      # Table Header Row
            ("VALIGN", (0, 1), (-1, -2), "TOP"),        # Data Rows: TOP aligned with line 1 of Description
            ("VALIGN", (0, -1), (-1, -1), "MIDDLE"),    # Total Row
            ("LEFTPADDING", (0, 0), (-1, -1), 2),
            ("RIGHTPADDING", (0, 0), (-1, -1), 2),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, 0), 6),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
            ("LINEBELOW", (0, 0), (-1, -2), 0.5, gray_border),
            ("LINEABOVE", (0, -1), (-1, -1), 1, colors.HexColor("#D1D5DB")),
            ("LINEBELOW", (0, -1), (-1, -1), 1, colors.HexColor("#D1D5DB")),
        ]))
        story.append(items_table)
        story.append(Spacer(1, 12))

        # ---------------------------------------------------------
        # 4. TAX SUMMARY TABLE (Right Aligned Matching Image 2)
        # ---------------------------------------------------------
        tax_before = data.get("total_before_tax") or total_taxable
        cgst_amt = data.get("cgst_amount", 0.0)
        sgst_amt = data.get("sgst_amount", 0.0)
        igst_amt = data.get("igst_amount", 0.0)
        tot_tax = data.get("total_tax_amount") or (cgst_amt + sgst_amt + igst_amt)
        round_off = data.get("round_off", 0.0)
        total_after_tax = data.get("total_due") or (tax_before + tot_tax + round_off)

        summary_rows = [
            [Paragraph("Total Before Tax", meta_label), Paragraph(f"{CURRENCY_SYMBOL}{tax_before:,.2f}", meta_val)],
        ]

        tax_opt = data.get("tax_option", "CGST + SGST")
        if tax_opt == "CGST + SGST":
            summary_rows.append([Paragraph(f"Add: CGST @ {data.get('cgst_rate', 9.0)}%", meta_label), Paragraph(f"{CURRENCY_SYMBOL}{cgst_amt:,.2f}", meta_val)])
            summary_rows.append([Paragraph(f"Add: SGST @ {data.get('sgst_rate', 9.0)}%", meta_label), Paragraph(f"{CURRENCY_SYMBOL}{sgst_amt:,.2f}", meta_val)])
        else:
            summary_rows.append([Paragraph(f"Add: IGST @ {data.get('igst_rate', 18.0)}%", meta_label), Paragraph(f"{CURRENCY_SYMBOL}{igst_amt:,.2f}", meta_val)])

        summary_rows.append([Paragraph("<b>Total Tax Amount</b>", ParagraphStyle("TLabel", parent=meta_label, fontName=BOLD_FONT, textColor=text_dark)), Paragraph(f"<b>{CURRENCY_SYMBOL}{tot_tax:,.2f}</b>", meta_val)])
        summary_rows.append([Paragraph("Round Off", meta_label), Paragraph(f"{CURRENCY_SYMBOL}{round_off:,.2f}", meta_val)])

        summary_table = Table(summary_rows, colWidths=[115, 95])
        summary_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("LINEABOVE", (0, 1), (-1, 1), 0.4, colors.HexColor("#CBD5E1")),  # Shorter and thinner divider line
        ]))

        # Total After Tax Full Width Box with White Bold Text (Gradient Background)
        total_badge_table = Table([[Paragraph("<b>Total After Tax</b>", total_badge_lbl), Paragraph(f"<b>{CURRENCY_SYMBOL}{total_after_tax:,.2f}</b>", total_badge_val)]], colWidths=[125, 125], rowHeights=[26])
        total_badge_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("PADDING", (0, 0), (-1, -1), 5),
        ]))
        total_badge_gradient = GradientBox(250, 26, start_color, end_color, total_badge_table, f"tot_{clean_s}_{clean_e}.png")

        right_summary_container = Table([[summary_table], [Spacer(1, 8)], [total_badge_gradient]], colWidths=[250])
        right_summary_container.setStyle(TableStyle([
            ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ]))

        outer_summary_table = Table([[Spacer(1, 1), right_summary_container]], colWidths=[295, 250])
        outer_summary_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ]))
        story.append(outer_summary_table)
        story.append(Spacer(1, 14))

        # ---------------------------------------------------------
        # 5. AMOUNT IN WORDS BOX
        # ---------------------------------------------------------
        words_text = number_to_words_indian(total_after_tax)
        words_paragraph = Paragraph(f"Amount In Words: <b>{words_text}</b>", ParagraphStyle("WordsStyle", parent=styles["Normal"], fontName=MAIN_FONT, fontSize=9, textColor=text_dark))
        
        words_table = Table([[words_paragraph]], colWidths=[545])
        words_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), gray_box_bg),
            ("PADDING", (0, 0), (-1, -1), 9),
            ("BOX", (0, 0), (-1, -1), 0.5, gray_border),
        ]))
        story.append(words_table)
        story.append(Spacer(1, 14))

        # ---------------------------------------------------------
        # 6. BANK DETAILS BOX
        # ---------------------------------------------------------
        bank_details = data.get("bank_details") or {}
        bank_name = bank_details.get("bank_name") or data.get("bank_name") or "Axis Bankk"
        acc_num = bank_details.get("account_number") or data.get("account_number") or "9240200573774150"
        ifsc = bank_details.get("ifsc_code") or data.get("ifsc_code") or "UTIB00028912"

        bank_content = [
            Paragraph("BANK DETAILS", label_muted),
            Spacer(1, 3),
            Paragraph(f"Bank: <b>{bank_name}</b> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; A/c: <b>{acc_num}</b> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; IFSC: <b>{ifsc}</b>", body_text)
        ]
        bank_table = Table([[bank_content]], colWidths=[545])
        bank_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.white),
            ("PADDING", (0, 0), (-1, -1), 9),
            ("BOX", (0, 0), (-1, -1), 0.5, gray_border),
        ]))
        story.append(bank_table)
        story.append(Spacer(1, 20))

        # ---------------------------------------------------------
        # 7. TERMS & CONDITIONS AND AUTHORIZED SIGNATURE
        # ---------------------------------------------------------
        terms_text = data.get("default_terms") or data.get("notes") or "1. Payment is due within 3 days of the invoice date.\n2. Late payments may incur additional charges.\n3. All disputes are subject to Gujarat Jurisdiction."
        
        terms_content = [
            Paragraph("TERMS & CONDITIONS", label_muted),
            Spacer(1, 3),
            Paragraph(terms_text.replace("\n", "<br/>"), body_text)
        ]

        # Signature Handling & Perfect Alignment Container
        sig_path = None
        if sig_url:
            clean_sig = sig_url.lstrip("/")
            if os.path.exists(clean_sig):
                sig_path = os.path.abspath(clean_sig)

        if sig_path:
            sig_element = RLImage(sig_path, width=85, height=38)
        else:
            sig_element = Paragraph("<i>(Authorized Signature)</i>", ParagraphStyle("SignStyle", parent=styles["Normal"], fontName="Helvetica-Oblique", fontSize=9, textColor=colors.HexColor("#4B5563"), alignment=TA_CENTER))

        sig_divider_line = HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#94A3B8"), spaceBefore=2, spaceAfter=4)
        sig_label_text = Paragraph(f"<b>{sig_name}</b>", ParagraphStyle("SignLabel", parent=styles["Normal"], fontName=BOLD_FONT, fontSize=8.5, textColor=colors.HexColor("#0F172A"), alignment=TA_CENTER))

        # 140 pt inner table locks Signature Image, Line, and Text together centered
        sig_inner_table = Table([
            [sig_element],
            [sig_divider_line],
            [sig_label_text]
        ], colWidths=[140])

        sig_inner_table.setStyle(TableStyle([
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 1),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
        ]))

        right_sig_wrapper = Table([[sig_inner_table]], colWidths=[190])
        right_sig_wrapper.setStyle(TableStyle([
            ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ]))

        sign_content = [
            Spacer(1, 10),
            right_sig_wrapper
        ]

        footer_table = Table([[terms_content, sign_content]], colWidths=[355, 190])
        footer_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ]))

        story.append(KeepTogether(footer_table))

        doc.build(story)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes

    @staticmethod
    def generate_quotation_pdf(data: Dict[str, Any]) -> bytes:
        """
        Generates a Quotation PDF matching A4 layout.
        """
        data_copy = dict(data)
        if not data_copy.get("invoice_type"):
            data_copy["invoice_type"] = "QUOTATION"
        if not data_copy.get("invoice_number"):
            data_copy["invoice_number"] = data_copy.get("quotation_number", "QUO-001")
        if not data_copy.get("issue_date"):
            data_copy["issue_date"] = data_copy.get("quotation_date")
        if not data_copy.get("total_due"):
            data_copy["total_due"] = data_copy.get("total_amount", 0.0)

        return PDFGeneratorService.generate_invoice_pdf(data_copy)
