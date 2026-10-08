from typing import Dict, Any, List
from app.database.db import get_database

# ==============================================================================
# ALL SYSTEM MODULES & SUB-MODULES (Exact 1-to-30 HRMS Navigation Order)
# ==============================================================================
SYSTEM_MODULES: List[Dict[str, Any]] = [
    # 1. Dashboard
    {"id": "/dashboard", "name": "Dashboard", "section": "Overview", "is_parent": True},
    {"id": "/dashboard#time-tracker", "name": "Dashboard: Time Tracker", "section": "Overview", "parent_id": "/dashboard"},
    {"id": "/dashboard#today-schedule", "name": "Dashboard: Today Schedule", "section": "Overview", "parent_id": "/dashboard"},
    {"id": "/dashboard#company-health", "name": "Dashboard: Company Health", "section": "Overview", "parent_id": "/dashboard"},
    {"id": "/dashboard#employee-performance", "name": "Dashboard: Employee Performance", "section": "Overview", "parent_id": "/dashboard"},
    {"id": "/dashboard#attendance-analytics", "name": "Dashboard: Attendance Analytics", "section": "Overview", "parent_id": "/dashboard"},
    {"id": "/dashboard#department-status", "name": "Dashboard: Department Status", "section": "Overview", "parent_id": "/dashboard"},
    {"id": "/dashboard#project-delivery", "name": "Dashboard: Project Delivery", "section": "Overview", "parent_id": "/dashboard"},
    {"id": "/dashboard#sales-overview", "name": "Dashboard: Sales Overview", "section": "Overview", "parent_id": "/dashboard"},
    {"id": "/dashboard#finance-overview", "name": "Dashboard: Finance Overview", "section": "Overview", "parent_id": "/dashboard"},
    {"id": "/dashboard#tasks-clients", "name": "Dashboard: Tasks & Clients", "section": "Overview", "parent_id": "/dashboard"},
    {"id": "/dashboard#hr-news", "name": "Dashboard: HR & News", "section": "Overview", "parent_id": "/dashboard"},
    {"id": "/dashboard#notifications", "name": "Dashboard: Notifications", "section": "Overview", "parent_id": "/dashboard"},

    # 2. Attendance
    {"id": "/employees/attendance", "name": "Attendance", "section": "Work", "is_parent": False},

    # 3. Leave
    {"id": "/employees/leave-requests", "name": "Leave", "section": "Work", "is_parent": False},

    # 4. Schedule
    {"id": "/schedule", "name": "Schedule", "section": "Work", "is_parent": False},

    # 5. Task
    {"id": "/tasks", "name": "Task", "section": "Work", "is_parent": False},

    # 6. Client & Project (Main Page)
    {"id": "/work/projects", "name": "Client & Project", "section": "Work", "is_parent": False},

    # 7. Chat
    {"id": "/chat", "name": "Chat", "section": "Work", "is_parent": False},

    # 8. Work Logs (Main Page)
    {"id": "/work/logs", "name": "Work Logs", "section": "Work", "is_parent": False},

    # 9. Research (Main Page)
    {"id": "/work/research", "name": "Research", "section": "Work", "is_parent": False},

    # 10. Sales (Unified Main Page with 8 Internal Sub-Features)
    {"id": "/work/sales", "name": "Sales", "section": "Work", "is_parent": True},
    {"id": "/work/sales/dashboard", "name": "Sales Dashboard", "section": "Work", "parent_id": "/work/sales"},
    {"id": "/work/sales/pipeline", "name": "Sales Pipeline", "section": "Work", "parent_id": "/work/sales"},
    {"id": "/work/sales/leads", "name": "Sales Leads", "section": "Work", "parent_id": "/work/sales"},
    {"id": "/work/sales/tasks", "name": "Sales Tasks & Follow-ups", "section": "Work", "parent_id": "/work/sales"},
    {"id": "/work/sales/analytics", "name": "Sales Analytics", "section": "Work", "parent_id": "/work/sales"},
    {"id": "/work/sales/team", "name": "Sales Team Performance", "section": "Work", "parent_id": "/work/sales"},
    {"id": "/work/sales/reports", "name": "Sales Reports", "section": "Work", "parent_id": "/work/sales"},
    {"id": "/work/sales/settings", "name": "Sales Settings", "section": "Work", "parent_id": "/work/sales"},
    {"id": "/work/sales#payment-details", "name": "Sales: View Payment Details", "section": "Work", "parent_id": "/work/sales"},

    # 11. Daily Progress (Main Page)
    {"id": "/approvals/daily-progress", "name": "Daily Progress", "section": "Work", "is_parent": False},

    # 12. Interview (Main Page)
    {"id": "/recruitment/interviews", "name": "Interview", "section": "People", "is_parent": False},

    # 13. Activity Tracker
    {"id": "/activity-tracker", "name": "Activity Tracker", "section": "Admin", "is_parent": False},

    # 14. Invoices (5 Sub-Departments)
    {"id": "/invoice", "name": "Invoices", "section": "Finance", "is_parent": True},
    {"id": "/invoice/all", "name": "Invoices", "section": "Finance", "parent_id": "/invoice"},
    {"id": "/invoice/proforma", "name": "Quotation", "section": "Finance", "parent_id": "/invoice"},
    {"id": "/invoice/ledger", "name": "Ledger", "section": "Finance", "parent_id": "/invoice"},
    {"id": "/invoice/create", "name": "Create Invoice", "section": "Finance", "parent_id": "/invoice"},
    {"id": "/invoice/proforma?create=1", "name": "Create Quotations", "section": "Finance", "parent_id": "/invoice"},

    # 15. Penalty
    {"id": "/penalty", "name": "Penalty", "section": "Workplace", "is_parent": False},

    # 16. Remarks
    {"id": "/remarks", "name": "Remarks", "section": "Workplace", "is_parent": False},

    # 17. Our Gallery
    {"id": "/workspace/gallery", "name": "Our Gallery", "section": "Workplace", "is_parent": False},

    # 18. Seating
    {"id": "/workspace/seating", "name": "Seating", "section": "Workplace", "is_parent": False},

    # 19. Recruitment
    {"id": "/recruitment/hirings", "name": "Recruitment", "section": "People", "is_parent": False},

    # 20. Payroll (6 Sub-Departments)
    {"id": "/payroll", "name": "Payroll", "section": "Finance", "is_parent": True},
    {"id": "/payroll/dashboard", "name": "Payroll Dashboard", "section": "Finance", "parent_id": "/payroll"},
    {"id": "/payroll/structure", "name": "Salary Structure", "section": "Finance", "parent_id": "/payroll"},
    {"id": "/payroll/settings", "name": "Payroll Settings", "section": "Finance", "parent_id": "/payroll"},
    {"id": "/payroll/processing", "name": "Payroll Processing", "section": "Finance", "parent_id": "/payroll"},
    {"id": "/payroll/bonuses", "name": "Bonus & Deductions", "section": "Finance", "parent_id": "/payroll"},
    {"id": "/payroll/payslips", "name": "Payslips", "section": "Finance", "parent_id": "/payroll"},

    # 21. Document Center (Main Page)
    {"id": "/employees/documents", "name": "Document Center", "section": "People", "is_parent": False},

    # 22. Document Generate (Main Page)
    {"id": "/employees/documents/generate", "name": "Document Generate", "section": "People", "is_parent": False},

    # 23. Election (Unified Main Page with 3 Sub-Features)
    {"id": "/elections", "name": "Election", "section": "Admin", "is_parent": True},
    {"id": "/elections/list", "name": "Elections", "section": "Admin", "parent_id": "/elections"},
    {"id": "/recognitions", "name": "Employee of the Month", "section": "Admin", "parent_id": "/elections"},
    {"id": "/team-leader-of-the-week", "name": "Team Leader of the Week", "section": "Admin", "parent_id": "/elections"},

    # 24. Company Finance (4 Sub-Departments)
    {"id": "/finance", "name": "Company Finance", "section": "Finance", "is_parent": True},
    {"id": "/finance/transactions", "name": "Transactions", "section": "Finance", "parent_id": "/finance"},
    {"id": "/finance/plan", "name": "Financial Plan", "section": "Finance", "parent_id": "/finance"},
    {"id": "/finance/summary", "name": "Financial Summary", "section": "Finance", "parent_id": "/finance"},
    {"id": "/finance/clients", "name": "Other Transactions", "section": "Finance", "parent_id": "/finance"},
    {"id": "/finance/audit", "name": "Audit Logs", "section": "Finance", "parent_id": "/finance"},

    # 25. Employees (Employee list as default, plus sub-departments)
    {"id": "/employees", "name": "Employees", "section": "People", "is_parent": True},
    {"id": "/employees/list", "name": "Employee List", "section": "People", "parent_id": "/employees"},
    {"id": "/employees/org", "name": "Org Structure", "section": "People", "parent_id": "/employees"},
    {"id": "/employees/departments-setup", "name": "Sub-Departments & Designations", "section": "People", "parent_id": "/employees"},

    # 26. Deposit (Main Page)
    {"id": "/employees/deposits", "name": "Deposit", "section": "People", "is_parent": False},

    # 27. Activity Logs
    {"id": "/activity-logs", "name": "Activity Logs", "section": "Admin", "is_parent": False},

    # 28. Recycle Bin
    {"id": "/recycle-bin", "name": "Recycle Bin", "section": "Admin", "is_parent": False},

    # 29. Access Control
    {"id": "/access-control", "name": "Access Control", "section": "Admin", "is_parent": False},

    # 30. Settings
    {"id": "/settings", "name": "Settings", "section": "Admin", "is_parent": False},

    # --- CEO Command Center (Preserved for CEO/Executive Roles) ---
    {"id": "/ceo-dashboard", "name": "CEO Overview", "section": "Command Center", "is_parent": False},
    {"id": "/ceo-dashboard/b2b", "name": "B2B Partnership", "section": "Command Center", "is_parent": True},
    {"id": "/ceo-dashboard/b2b/partners", "name": "B2B Partners", "section": "Command Center", "parent_id": "/ceo-dashboard/b2b"},
    {"id": "/ceo-dashboard/b2b/leads", "name": "B2B Leads", "section": "Command Center", "parent_id": "/ceo-dashboard/b2b"},
    {"id": "/ceo-dashboard/b2b/opportunities", "name": "B2B Opportunities", "section": "Command Center", "parent_id": "/ceo-dashboard/b2b"},
    {"id": "/ceo-dashboard/b2b/deals", "name": "B2B Deals", "section": "Command Center", "parent_id": "/ceo-dashboard/b2b"},
    {"id": "/ceo-dashboard/b2b/invoices", "name": "B2B Invoices", "section": "Command Center", "parent_id": "/ceo-dashboard/b2b"},
    {"id": "/ceo-dashboard/b2b/commission", "name": "B2B Commission", "section": "Command Center", "parent_id": "/ceo-dashboard/b2b"},
    {"id": "/ceo-dashboard/b2b/settlement", "name": "Monthly Settlement", "section": "Command Center", "parent_id": "/ceo-dashboard/b2b"},
    {"id": "/ceo-dashboard/b2b/performance", "name": "Partner Performance", "section": "Command Center", "parent_id": "/ceo-dashboard/b2b"},
    {"id": "/ceo-dashboard/collaboration", "name": "Tech Collaboration", "section": "Command Center", "is_parent": False},
    {"id": "/ceo-dashboard/franchise", "name": "Franchise", "section": "Command Center", "is_parent": False},
    {"id": "/ceo-dashboard/reports", "name": "CEO Reports", "section": "Command Center", "is_parent": False},
    {"id": "/ceo-dashboard/settings", "name": "CEO Settings", "section": "Command Center", "is_parent": False},

    # --- Legacy Preserved Aliases ---
    {"id": "/approvals", "name": "Approvals Hub (Legacy)", "section": "Overview", "is_parent": False},
    {"id": "/reports", "name": "Reports & Analytics (Legacy)", "section": "Overview", "is_parent": False},
    {"id": "/restrictions", "name": "Restrictions", "section": "Admin", "is_parent": False},
]

def make_perm(read=False, create=False, update=False, delete=False, all_perm=False) -> dict:
    if all_perm:
        return {"read": True, "create": True, "update": True, "delete": True, "all": True}
    return {"read": read, "create": create, "update": update, "delete": delete, "all": all_perm}

def get_admin_full_permissions() -> Dict[str, dict]:
    """Returns full CRUD permissions for every single parent module and child sub-module."""
    return {mod["id"]: make_perm(all_perm=True) for mod in SYSTEM_MODULES}

# ==============================================================================
# PERMISSION NORMALIZER & COMPATIBILITY EXPANDER
# Ensures old database permissions seamlessly grant access to new structure
# ==============================================================================
def normalize_and_expand_permissions(perms: Dict[str, dict]) -> Dict[str, dict]:
    """
    Ensures 100% backward compatibility between legacy database permissions
    and the new HRMS 30-item navigation structure.
    Expands parent permissions to children and child permissions to parents.
    """
    if not isinstance(perms, dict):
        return perms

    expanded = {k: dict(v) if isinstance(v, dict) else v for k, v in perms.items()}

    # 1. Alias mappings (bidirectional sync if one exists)
    aliases = [
        ("/workspace/gallery", "/gallery"),
        ("/penalty", "/approvals/penalties"),
        ("/penalty", "/penalties"),
        ("/employees/leave-requests", "/leaves"),
        ("/employees/attendance", "/attendance"),
        ("/recruitment/hirings", "/recruitment"),
        ("/employees/list", "/employees"),
    ]

    for p1, p2 in aliases:
        if p1 in expanded and p2 not in expanded:
            expanded[p2] = dict(expanded[p1])
        elif p2 in expanded and p1 not in expanded:
            expanded[p1] = dict(expanded[p2])

    # 2. Sales Hub: Unified main page
    # If user has permissions for ANY sales sub-module, grant access to main /work/sales
    sales_sub_keys = [
        "/work/sales/dashboard", "/work/sales/pipeline", "/work/sales/leads",
        "/work/sales/tasks", "/work/sales/analytics", "/work/sales/team",
        "/work/sales/reports", "/work/sales/settings", "/work/sales#payment-details"
    ]
    sales_has_read = any(expanded.get(k, {}).get("read") or expanded.get(k, {}).get("all") for k in sales_sub_keys)
    sales_has_create = any(expanded.get(k, {}).get("create") or expanded.get(k, {}).get("all") for k in sales_sub_keys)
    sales_has_update = any(expanded.get(k, {}).get("update") or expanded.get(k, {}).get("all") for k in sales_sub_keys)
    sales_has_delete = any(expanded.get(k, {}).get("delete") or expanded.get(k, {}).get("all") for k in sales_sub_keys)
    sales_has_all = any(expanded.get(k, {}).get("all") for k in sales_sub_keys)

    if sales_has_read or sales_has_all:
        if "/work/sales" not in expanded:
            expanded["/work/sales"] = {"read": True, "create": sales_has_create, "update": sales_has_update, "delete": sales_has_delete, "all": sales_has_all}
        else:
            curr = dict(expanded["/work/sales"])
            curr["read"] = curr.get("read") or sales_has_read
            curr["create"] = curr.get("create") or sales_has_create
            curr["update"] = curr.get("update") or sales_has_update
            curr["delete"] = curr.get("delete") or sales_has_delete
            curr["all"] = curr.get("all") or sales_has_all
            expanded["/work/sales"] = curr

    if "/work/sales" in expanded:
        parent_p = expanded["/work/sales"]
        for k in sales_sub_keys:
            if k not in expanded:
                expanded[k] = dict(parent_p)

    # 3. Election Hub: Unified main page
    election_sub_keys = ["/elections", "/elections/list", "/recognitions", "/team-leader-of-the-week"]
    election_has_read = any(expanded.get(k, {}).get("read") or expanded.get(k, {}).get("all") for k in election_sub_keys)
    election_has_all = any(expanded.get(k, {}).get("all") for k in election_sub_keys)
    if election_has_read or election_has_all:
        if "/elections" not in expanded:
            expanded["/elections"] = {"read": True, "all": election_has_all}
        for k in election_sub_keys:
            if k not in expanded:
                expanded[k] = {"read": True, "all": election_has_all}

    # 4. Invoices (5 Sub-Departments)
    invoice_sub_keys = [
        "/invoice/all", "/invoice/proforma", "/invoice/ledger",
        "/invoice/create", "/invoice/proforma?create=1"
    ]
    if "/invoice" in expanded:
        inv_p = expanded["/invoice"]
        for k in invoice_sub_keys:
            if k not in expanded:
                expanded[k] = dict(inv_p)
    elif any(expanded.get(k, {}).get("read") or expanded.get(k, {}).get("all") for k in invoice_sub_keys):
        expanded["/invoice"] = {"read": True}

    # 5. Employees
    emp_sub_keys = ["/employees/list", "/employees/org", "/employees/departments-setup"]
    if "/employees" in expanded:
        emp_p = expanded["/employees"]
        for k in emp_sub_keys:
            if k not in expanded:
                expanded[k] = dict(emp_p)
    elif any(expanded.get(k, {}).get("read") or expanded.get(k, {}).get("all") for k in emp_sub_keys):
        expanded["/employees"] = {"read": True}

    # 6. Legacy Approvals expansion
    if "/approvals" in expanded:
        app_p = expanded["/approvals"]
        for k in ["/employees/leave-requests", "/penalty", "/approvals/daily-progress"]:
            if k not in expanded:
                expanded[k] = dict(app_p)

    # 7. Legacy Workspace expansion
    if "/workspace" in expanded:
        ws_p = expanded["/workspace"]
        for k in ["/workspace/seating", "/workspace/gallery"]:
            if k not in expanded:
                expanded[k] = dict(ws_p)

    # 8. Legacy Recruitment expansion
    if "/recruitment" in expanded:
        rec_p = expanded["/recruitment"]
        for k in ["/recruitment/interviews", "/recruitment/hirings"]:
            if k not in expanded:
                expanded[k] = dict(rec_p)

    # 9. Document Center & Generate
    if "/employees/documents" in expanded and "/employees/documents/generate" not in expanded:
        expanded["/employees/documents/generate"] = dict(expanded["/employees/documents"])

    return expanded

# ==============================================================================
# DEFAULT DEPARTMENT PRESETS (1 to 30 Ordered)
# ==============================================================================

# Default permissions for general employees
DEFAULT_EMPLOYEE_PERMISSIONS: Dict[str, dict] = {
    "/dashboard": make_perm(read=True),
    "/employees/attendance": make_perm(read=True, create=True),
    "/employees/leave-requests": make_perm(read=True, create=True),
    "/schedule": make_perm(read=True),
    "/tasks": make_perm(read=True, create=True, update=True),
    "/work/projects": make_perm(read=True),
    "/chat": make_perm(read=True, create=True),
    "/work/logs": make_perm(read=True, create=True, update=True),
    "/work/research": make_perm(read=True),
    "/approvals/daily-progress": make_perm(read=True, create=True),
    "/penalty": make_perm(read=True),
    "/remarks": make_perm(read=True),
    "/workspace/gallery": make_perm(read=True),
    "/workspace/seating": make_perm(read=True),
    "/employees/documents": make_perm(read=True),
    "/elections": make_perm(read=True),
}

# Default permissions for HR Department
DEFAULT_HR_PERMISSIONS: Dict[str, dict] = {
    "/dashboard": make_perm(all_perm=True),
    "/employees/attendance": make_perm(all_perm=True),
    "/employees/leave-requests": make_perm(all_perm=True),
    "/schedule": make_perm(all_perm=True),
    "/tasks": make_perm(all_perm=True),
    "/work/projects": make_perm(all_perm=True),
    "/chat": make_perm(all_perm=True),
    "/work/logs": make_perm(all_perm=True),
    "/work/research": make_perm(all_perm=True),
    "/approvals/daily-progress": make_perm(all_perm=True),
    "/recruitment/interviews": make_perm(all_perm=True),
    "/activity-tracker": make_perm(all_perm=True),
    "/invoice": make_perm(read=True),
    "/penalty": make_perm(all_perm=True),
    "/remarks": make_perm(all_perm=True),
    "/workspace/gallery": make_perm(all_perm=True),
    "/workspace/seating": make_perm(all_perm=True),
    "/recruitment/hirings": make_perm(all_perm=True),
    "/payroll": make_perm(all_perm=True),
    "/employees/documents": make_perm(all_perm=True),
    "/employees/documents/generate": make_perm(all_perm=True),
    "/elections": make_perm(all_perm=True),
    "/team-leader-of-the-week": make_perm(all_perm=True),
    "/recognitions": make_perm(all_perm=True),
    "/employees": make_perm(all_perm=True),
    "/employees/list": make_perm(all_perm=True),
    "/employees/org": make_perm(all_perm=True),
    "/employees/departments-setup": make_perm(all_perm=True),
    "/employees/deposits": make_perm(all_perm=True),
    "/activity-logs": make_perm(all_perm=True),
    "/recycle-bin": make_perm(all_perm=True),
}

# Default permissions for Development Department
DEFAULT_DEVELOPMENT_PERMISSIONS: Dict[str, dict] = {
    "/dashboard": make_perm(read=True),
    "/employees/attendance": make_perm(read=True, create=True),
    "/employees/leave-requests": make_perm(read=True, create=True),
    "/schedule": make_perm(read=True),
    "/tasks": make_perm(read=True, create=True, update=True),
    "/work/projects": make_perm(read=True, create=True, update=True),
    "/chat": make_perm(read=True, create=True),
    "/work/logs": make_perm(read=True, create=True, update=True),
    "/work/research": make_perm(read=True),
    "/approvals/daily-progress": make_perm(read=True, create=True),
    "/penalty": make_perm(read=True),
    "/remarks": make_perm(read=True),
    "/workspace/gallery": make_perm(read=True),
    "/workspace/seating": make_perm(read=True),
    "/employees/documents": make_perm(read=True),
    "/elections": make_perm(read=True),
}

# Default permissions for Python Department
DEFAULT_PYTHON_PERMISSIONS: Dict[str, dict] = {
    "/dashboard": make_perm(read=True),
    "/employees/attendance": make_perm(read=True, create=True),
    "/employees/leave-requests": make_perm(read=True, create=True),
    "/schedule": make_perm(read=True),
    "/tasks": make_perm(read=True, create=True, update=True),
    "/work/projects": make_perm(read=True, create=True, update=True),
    "/chat": make_perm(read=True, create=True),
    "/work/logs": make_perm(read=True, create=True, update=True),
    "/work/research": make_perm(read=True, create=True, update=True),
    "/approvals/daily-progress": make_perm(read=True, create=True),
    "/penalty": make_perm(read=True),
    "/remarks": make_perm(read=True),
    "/workspace/gallery": make_perm(read=True),
    "/workspace/seating": make_perm(read=True),
    "/employees/documents": make_perm(read=True),
    "/elections": make_perm(read=True),
}

# Default permissions for Sales Department
DEFAULT_SALES_PERMISSIONS: Dict[str, dict] = {
    "/dashboard": make_perm(read=True),
    "/employees/attendance": make_perm(read=True, create=True),
    "/employees/leave-requests": make_perm(read=True, create=True),
    "/schedule": make_perm(read=True),
    "/tasks": make_perm(read=True, create=True, update=True),
    "/work/projects": make_perm(read=True),
    "/chat": make_perm(read=True, create=True),
    "/work/logs": make_perm(read=True, create=True, update=True),
    "/work/sales": make_perm(all_perm=True),
    "/approvals/daily-progress": make_perm(read=True, create=True),
    "/invoice": make_perm(read=True, create=True),
    "/invoice/all": make_perm(read=True),
    "/invoice/create": make_perm(read=True, create=True),
    "/invoice/proforma": make_perm(read=True, create=True),
    "/penalty": make_perm(read=True),
    "/remarks": make_perm(read=True),
    "/workspace/gallery": make_perm(read=True),
    "/workspace/seating": make_perm(read=True),
    "/employees/documents": make_perm(read=True),
    "/elections": make_perm(read=True),
}

# Default permissions for Finance Department
DEFAULT_FINANCE_PERMISSIONS: Dict[str, dict] = {
    "/dashboard": make_perm(read=True),
    "/employees/attendance": make_perm(read=True, create=True),
    "/employees/leave-requests": make_perm(read=True, create=True),
    "/schedule": make_perm(read=True),
    "/tasks": make_perm(read=True, create=True, update=True),
    "/chat": make_perm(read=True, create=True),
    "/work/logs": make_perm(read=True, create=True, update=True),
    "/invoice": make_perm(all_perm=True),
    "/penalty": make_perm(all_perm=True),
    "/remarks": make_perm(read=True),
    "/workspace/gallery": make_perm(read=True),
    "/workspace/seating": make_perm(read=True),
    "/payroll": make_perm(all_perm=True),
    "/finance": make_perm(all_perm=True),
    "/employees/documents": make_perm(read=True),
    "/elections": make_perm(read=True),
}

# Default permissions for Management Department
DEFAULT_MANAGEMENT_PERMISSIONS: Dict[str, dict] = {
    "/dashboard": make_perm(all_perm=True),
    "/employees/attendance": make_perm(all_perm=True),
    "/employees/leave-requests": make_perm(all_perm=True),
    "/schedule": make_perm(all_perm=True),
    "/tasks": make_perm(all_perm=True),
    "/work/projects": make_perm(all_perm=True),
    "/chat": make_perm(all_perm=True),
    "/work/logs": make_perm(all_perm=True),
    "/work/research": make_perm(all_perm=True),
    "/work/sales": make_perm(all_perm=True),
    "/approvals/daily-progress": make_perm(all_perm=True),
    "/recruitment/interviews": make_perm(all_perm=True),
    "/activity-tracker": make_perm(all_perm=True),
    "/invoice": make_perm(all_perm=True),
    "/penalty": make_perm(all_perm=True),
    "/remarks": make_perm(all_perm=True),
    "/workspace/gallery": make_perm(all_perm=True),
    "/workspace/seating": make_perm(all_perm=True),
    "/recruitment/hirings": make_perm(all_perm=True),
    "/payroll": make_perm(all_perm=True),
    "/employees/documents": make_perm(all_perm=True),
    "/employees/documents/generate": make_perm(all_perm=True),
    "/elections": make_perm(all_perm=True),
    "/finance": make_perm(all_perm=True),
    "/employees": make_perm(all_perm=True),
    "/employees/deposits": make_perm(all_perm=True),
    "/activity-logs": make_perm(all_perm=True),
    "/recycle-bin": make_perm(all_perm=True),
}

# Default permissions for Digital Marketing Department
DEFAULT_DIGITAL_MARKETING_PERMISSIONS: Dict[str, dict] = {
    "/dashboard": make_perm(read=True),
    "/employees/attendance": make_perm(read=True, create=True),
    "/employees/leave-requests": make_perm(read=True, create=True),
    "/schedule": make_perm(read=True),
    "/tasks": make_perm(read=True, create=True, update=True),
    "/work/projects": make_perm(read=True, create=True, update=True),
    "/chat": make_perm(read=True, create=True),
    "/work/logs": make_perm(read=True, create=True, update=True),
    "/work/research": make_perm(read=True, create=True, update=True),
    "/work/sales/leads": make_perm(read=True, create=True),
    "/work/sales": make_perm(read=True),
    "/approvals/daily-progress": make_perm(read=True, create=True),
    "/penalty": make_perm(read=True),
    "/remarks": make_perm(read=True),
    "/workspace/gallery": make_perm(read=True),
    "/workspace/seating": make_perm(read=True),
    "/employees/documents": make_perm(read=True),
    "/elections": make_perm(read=True),
}

# Default permissions for Creative Department
DEFAULT_CREATIVE_PERMISSIONS: Dict[str, dict] = {
    "/dashboard": make_perm(read=True),
    "/employees/attendance": make_perm(read=True, create=True),
    "/employees/leave-requests": make_perm(read=True, create=True),
    "/schedule": make_perm(read=True),
    "/tasks": make_perm(read=True, create=True, update=True),
    "/work/projects": make_perm(read=True, create=True, update=True),
    "/chat": make_perm(read=True, create=True),
    "/work/logs": make_perm(read=True, create=True, update=True),
    "/approvals/daily-progress": make_perm(read=True, create=True),
    "/penalty": make_perm(read=True),
    "/remarks": make_perm(read=True),
    "/workspace/gallery": make_perm(read=True, create=True, update=True),
    "/workspace/seating": make_perm(read=True),
    "/employees/documents": make_perm(read=True),
    "/elections": make_perm(read=True),
}

# Default permissions for Product Department
DEFAULT_PRODUCT_PERMISSIONS: Dict[str, dict] = {
    "/dashboard": make_perm(read=True),
    "/employees/attendance": make_perm(read=True, create=True),
    "/employees/leave-requests": make_perm(read=True, create=True),
    "/schedule": make_perm(read=True),
    "/tasks": make_perm(all_perm=True),
    "/work/projects": make_perm(all_perm=True),
    "/chat": make_perm(all_perm=True),
    "/work/logs": make_perm(read=True, create=True, update=True),
    "/work/research": make_perm(all_perm=True),
    "/approvals/daily-progress": make_perm(read=True, create=True),
    "/penalty": make_perm(read=True),
    "/remarks": make_perm(read=True),
    "/workspace/gallery": make_perm(read=True),
    "/workspace/seating": make_perm(read=True),
    "/employees/documents": make_perm(read=True),
    "/elections": make_perm(read=True),
}

DEFAULT_DEPARTMENT_PERMISSIONS: Dict[str, Dict[str, dict]] = {
    "HR": DEFAULT_HR_PERMISSIONS,
    "Development": DEFAULT_DEVELOPMENT_PERMISSIONS,
    "Python": DEFAULT_PYTHON_PERMISSIONS,
    "Sales": DEFAULT_SALES_PERMISSIONS,
    "Finance": DEFAULT_FINANCE_PERMISSIONS,
    "Management": DEFAULT_MANAGEMENT_PERMISSIONS,
    "Digital Marketing": DEFAULT_DIGITAL_MARKETING_PERMISSIONS,
    "Creative": DEFAULT_CREATIVE_PERMISSIONS,
    "Product": DEFAULT_PRODUCT_PERMISSIONS,
}

def get_default_permissions_for_department(dept_name: str) -> Dict[str, dict]:
    if not dept_name:
        return DEFAULT_DEVELOPMENT_PERMISSIONS
    clean = str(dept_name).strip().lower()
    for name, perms in DEFAULT_DEPARTMENT_PERMISSIONS.items():
        if name.lower() == clean:
            return perms
    return DEFAULT_DEVELOPMENT_PERMISSIONS

# ==============================================================================
# DATABASE INITIALIZER & SEEDER
# ==============================================================================
async def init_database_presets_and_admin(db):
    """
    Seeds permission presets only:
    1. Department-wise permission presets.
    2. Dual-role presets (Admin, Employee).
    """
    admin_full_perms = get_admin_full_permissions()

    # 1. Seed Department-Wise Permission Presets
    for dept_name, default_perms in DEFAULT_DEPARTMENT_PERMISSIONS.items():
        existing_preset = await db["permission_presets"].find_one({"department": dept_name})
        if not existing_preset:
            await db["permission_presets"].update_one(
                {"department": dept_name},
                {"$set": {
                    "department": dept_name,
                    "role": "Employee",
                    "department_id": "all",
                    "designation_id": "all",
                    "module_permissions": default_perms
                }},
                upsert=True
            )
            print(f"[Presets] Seeded department-wise preset for '{dept_name}'.")

    # 2. Seed Role Presets (Admin & Employee)
    for role_name, default_perms in [("Admin", admin_full_perms), ("Employee", DEFAULT_DEVELOPMENT_PERMISSIONS)]:
        existing_role_preset = await db["permission_presets"].find_one({"role": role_name, "department": None})
        if not existing_role_preset:
            await db["permission_presets"].update_one(
                {"role": role_name, "department": None},
                {"$set": {
                    "role": role_name,
                    "department": None,
                    "department_id": "all",
                    "designation_id": "all",
                    "module_permissions": default_perms
                }},
                upsert=True
            )

    print("[Presets] Permission presets seeding complete (no master admin created).")
