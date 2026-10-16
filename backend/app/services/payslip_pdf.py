"""Salary slip PDF in the same table layout as the Payslips page."""
import io
import re
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Table, TableStyle

RED = colors.HexColor("#e11d48")
GREEN = colors.HexColor("#059669")
SHADE = colors.HexColor("#f1f5f9")

_ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
         "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"]
_TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]


def _below_hundred(n: int) -> str:
    return _ONES[n] if n < 20 else f"{_TENS[n // 10]}{' ' + _ONES[n % 10] if n % 10 else ''}"


def _below_thousand(n: int) -> str:
    h, r = divmod(n, 100)
    return " ".join(p for p in (f"{_ONES[h]} Hundred" if h else "", _below_hundred(r) if r else "") if p)


def amount_in_words(amount: float) -> str:
    """Indian numbering (Lakh / Crore) — same as the page."""
    amount = max(0.0, float(amount or 0))
    rupees = int(amount)
    paise = round((amount - rupees) * 100)
    crore, n = divmod(rupees, 10000000)
    lakh, n = divmod(n, 100000)
    thousand, n = divmod(n, 1000)
    parts = []
    if crore:
        parts.append(f"{_below_thousand(crore)} Crore")
    if lakh:
        parts.append(f"{_below_hundred(lakh)} Lakh")
    if thousand:
        parts.append(f"{_below_hundred(thousand)} Thousand")
    if n:
        parts.append(_below_thousand(n))
    words = " ".join(parts) or "Zero"
    return f"{words} and {_below_hundred(paise)} Paise" if paise else words


def company_city(address: str) -> str:
    match = re.search(r"([A-Za-z][A-Za-z .]*?)\s*-?\s*\d{6}", address or "")
    return match.group(1).split(",")[-1].strip().upper() if match else ""


def short_address(address: str) -> str:
    text = (address or "").strip()
    match = re.search(r"\d{6}\s*,?\s*(.*)$", text)
    city = company_city(text)
    if not match or not city:
        return text
    rest = [p.strip().rstrip(".").strip() for p in match.group(1).split(",")]
    return ", ".join([city] + [p for p in rest if p]).upper()


def _amount(n) -> str:
    v = float(n or 0)
    return f"{v:,.0f}" if v == int(v) else f"{v:,.2f}"


def _joining(d) -> str:
    try:
        return datetime.strptime(str(d)[:10], "%Y-%m-%d").strftime("%d/%m/%Y")
    except (TypeError, ValueError):
        return str(d or "")


def build_payslip_pdf(slip: dict, company: dict) -> bytes:
    emp = slip.get("employee") or {}
    att = slip.get("attendance") or {}
    earnings = slip.get("earnings") or []
    deductions = slip.get("deductions") or []
    net = float(slip.get("net_salary") or 0)
    company_name = (company.get("company_name") or "Company").upper()
    month = datetime.strptime(slip["month"], "%Y-%m").strftime("%B").upper() + f"-{slip['month'][:4]}"

    base = ParagraphStyle("base", fontName="Helvetica", fontSize=9, leading=11)
    bold = ParagraphStyle("bold", parent=base, fontName="Helvetica-Bold")
    center_bold = ParagraphStyle("cb", parent=bold, alignment=1)
    P = lambda t, s=base: Paragraph(str(t or "—"), s)  # noqa: E731

    rows, style = [], [
        ("GRID", (0, 0), (-1, -1), 0.6, colors.black),
        ("BOX", (0, 0), (-1, -1), 1.4, colors.black),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]

    def full(text, size=9, shade=False):
        rows.append([Paragraph(text, ParagraphStyle("h", parent=center_bold, fontSize=size, leading=size + 3)), "", "", ""])
        r = len(rows) - 1
        style.append(("SPAN", (0, r), (-1, r)))
        if shade:
            style.append(("BACKGROUND", (0, r), (-1, r), colors.HexColor("#f8fafc")))

    full(company_name, 12, True)
    if company.get("company_address"):
        full(short_address(company["company_address"]), 9, True)
    if company.get("company_gstin"):
        full(f"GSTIN: {company['company_gstin']}", 9, True)
    full("Salary Slip", 10)
    full(f"For {month}", 9)
    full(emp.get("name") or "", 11, True)

    for l1, v1, l2, v2 in (
        ("Employee ID", emp.get("emp_code"), "Location", company_city(company.get("company_address", ""))),
        ("Income Tax Number (PAN)", emp.get("pan"), "Bank Details", emp.get("bank_name")),
        ("Designation", emp.get("designation"), "A/C.NO:", emp.get("account")),
        ("Date of Joining", _joining(emp.get("joining_date")) if emp.get("joining_date") else "", "IFSC", emp.get("ifsc")),
    ):
        rows.append([P(l1, bold), P(v1), P(l2, bold), P(v2, base if l2 == "Location" else bold)])

    rows.append([P("Attendance Details", bold), "", "", ""])
    style.append(("SPAN", (0, len(rows) - 1), (2, len(rows) - 1)))
    rows.append([P("Present Days"), "", "", _amount(att.get("present"))])
    r = len(rows) - 1
    style += [("SPAN", (0, r), (2, r)), ("ALIGN", (3, r), (3, r), "CENTER"), ("FONTNAME", (3, r), (3, r), "Helvetica-Bold")]

    rows.append(["EARNINGS", "AMOUNT", "DEDUCTION", "AMOUNT"])
    r = len(rows) - 1
    style += [("BACKGROUND", (0, r), (-1, r), SHADE), ("FONTNAME", (0, r), (-1, r), "Helvetica-Bold"),
              ("ALIGN", (0, r), (-1, r), "CENTER"), ("LINEBELOW", (0, r), (-1, r), 1.4, colors.black)]
    first_line = len(rows)
    for i in range(max(len(earnings), len(deductions))):
        e = earnings[i] if i < len(earnings) else None
        d = deductions[i] if i < len(deductions) else None
        rows.append([e["name"] if e else "", _amount(e["amount"]) if e else "",
                     d["name"] if d else "", _amount(d["amount"]) if d else ""])
    last_line = len(rows) - 1
    style += [("ALIGN", (1, first_line), (1, last_line), "RIGHT"), ("ALIGN", (3, first_line), (3, last_line), "RIGHT"),
              ("TEXTCOLOR", (2, first_line), (3, last_line), RED)]

    rows.append(["Total Earnings", _amount(slip.get("total_earnings")), "Total Deduction", _amount(slip.get("total_deductions"))])
    r = len(rows) - 1
    style += [("FONTNAME", (0, r), (-1, r), "Helvetica-Bold"), ("ALIGN", (1, r), (1, r), "RIGHT"),
              ("ALIGN", (3, r), (3, r), "RIGHT"), ("LINEBELOW", (0, r), (-1, r), 1.4, colors.black)]
    rows.append(["", "", "NET AMOUNT", _amount(net)])
    r = len(rows) - 1
    style += [("SPAN", (0, r), (1, r)), ("BACKGROUND", (2, r), (3, r), SHADE), ("TEXTCOLOR", (2, r), (3, r), GREEN),
              ("FONTNAME", (2, r), (3, r), "Helvetica-Bold"), ("ALIGN", (3, r), (3, r), "RIGHT")]

    has_bank = bool(emp.get("account"))
    mode = Table(
        [["Mode", "A/C / Chq.No.", "Amount"],
         ["Bank Transfer", emp.get("account") or "-", f"{net if has_bank else 0:,.2f}"],
         ["Cash", "-", f"{0 if has_bank else net:,.2f}"],
         ["TOTAL", "", f"{net:,.2f}"]],
        colWidths=[28 * mm, 34 * mm, 24 * mm],
    )
    mode.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.6, colors.black),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"), ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTNAME", (0, 1), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (2, 1), (2, -1), "Helvetica-Bold"), ("ALIGN", (2, 0), (2, -1), "RIGHT"),
        ("ALIGN", (1, 0), (1, -1), "CENTER"), ("SPAN", (0, 3), (1, 3)), ("ALIGN", (0, 3), (1, 3), "RIGHT"),
    ]))
    words = [P("Amount (in words)", bold),
             Paragraph(f"<i>Rupees {amount_in_words(net)} Only</i>", ParagraphStyle("w", parent=base, fontSize=8.5)),
             Paragraph("&nbsp;", base), mode]
    rows.append([words, "", P(f"FOR {company_name}", bold), ""])
    r = len(rows) - 1
    style += [("SPAN", (0, r), (1, r)), ("SPAN", (2, r), (3, r)), ("VALIGN", (0, r), (-1, r), "TOP"),
              ("TOPPADDING", (0, r), (-1, r), 8), ("BOTTOMPADDING", (0, r), (-1, r), 10)]

    width = A4[0] - 24 * mm
    table = Table(rows, colWidths=[width * 0.30, width * 0.22, width * 0.30, width * 0.18])
    table.setStyle(TableStyle(style))

    buffer = io.BytesIO()
    SimpleDocTemplate(buffer, pagesize=A4, leftMargin=12 * mm, rightMargin=12 * mm, topMargin=12 * mm,
                      bottomMargin=12 * mm, title=f"Payslip {emp.get('name', '')} {slip['month']}").build([table])
    return buffer.getvalue()
