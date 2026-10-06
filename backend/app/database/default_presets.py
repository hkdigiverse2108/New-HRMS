from typing import Dict, Any, List
from app.database.db import get_database

# ==============================================================================
# ALL SYSTEM MODULES & SUB-MODULES (Full Hierarchy matching Navigation)
# ==============================================================================
SYSTEM_MODULES: List[Dict[str, Any]] = [
    # --- OVERVIEW ---
    {"id": "/dashboard", "name": "Dashboard", "section": "Overview", "is_parent": True},
    # Dashboard inner sections (section-level access, e.g. Princebhai sees only section-2)
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
    
    {"id": "/approvals", "name": "Approvals Hub", "section": "Overview", "is_parent": True},
    {"id": "/employees/leave-requests", "name": "Leave Requests (Approvals)", "section": "Overview", "parent_id": "/approvals"},
    {"id": "/approvals/penalties", "name": "Penalties (Approvals)", "section": "Overview", "parent_id": "/approvals"},
    {"id": "/approvals/daily-progress", "name": "Daily Progress", "section": "Overview", "parent_id": "/approvals"},
    {"id": "/approvals/history", "name": "Approval History", "section": "Overview", "parent_id": "/approvals"},

    {"id": "/reports", "name": "Reports & Analytics", "section": "Overview", "is_parent": True},
    {"id": "/reports/attendance", "name": "Attendance Report", "section": "Overview", "parent_id": "/reports"},
    {"id": "/reports/payroll", "name": "Payroll Cost", "section": "Overview", "parent_id": "/reports"},
    {"id": "/reports/hiring", "name": "Hiring Funnel", "section": "Overview", "parent_id": "/reports"},
    {"id": "/reports/work", "name": "Project & Work Report", "section": "Overview", "parent_id": "/reports"},

    # --- PEOPLE ---
    {"id": "/employees", "name": "Employees", "section": "People", "is_parent": True},
    {"id": "/employees/list", "name": "Employee List", "section": "People", "parent_id": "/employees"},
    {"id": "/employees/org", "name": "Org Structure", "section": "People", "parent_id": "/employees"},
    {"id": "/employees/departments-setup", "name": "Sub-Departments & Designations", "section": "People", "parent_id": "/employees"},
    {"id": "/employees/attendance", "name": "Attendance List", "section": "People", "parent_id": "/employees"},
    {"id": "/employees/documents", "name": "Documents", "section": "People", "parent_id": "/employees"},

    {"id": "/recruitment", "name": "Recruitment", "section": "People", "is_parent": True},
    {"id": "/recruitment/interviews", "name": "Interviews", "section": "People", "parent_id": "/recruitment"},
    {"id": "/recruitment/hirings", "name": "Hirings", "section": "People", "parent_id": "/recruitment"},

    # --- WORK ---
    {"id": "/schedule", "name": "Schedule", "section": "Work", "is_parent": False},
    {"id": "/work/projects", "name": "Clients & Projects", "section": "Work", "is_parent": False},
    {"id": "/work/logs", "name": "Work Logs", "section": "Work", "is_parent": False},
    {"id": "/work/research", "name": "Research", "section": "Work", "is_parent": False},
    
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

    {"id": "/tasks", "name": "Tasks", "section": "Work", "is_parent": False},
    {"id": "/chat", "name": "Chat", "section": "Work", "is_parent": False},

    # --- FINANCE ---
    {"id": "/payroll", "name": "Payroll", "section": "Finance", "is_parent": True},
    {"id": "/payroll/dashboard", "name": "Payroll Dashboard", "section": "Finance", "parent_id": "/payroll"},
    {"id": "/payroll/structure", "name": "Salary Structure", "section": "Finance", "parent_id": "/payroll"},
    {"id": "/payroll/settings", "name": "Payroll Settings", "section": "Finance", "parent_id": "/payroll"},
    {"id": "/payroll/processing", "name": "Payroll Processing", "section": "Finance", "parent_id": "/payroll"},
    {"id": "/payroll/bonuses", "name": "Bonus & Deductions", "section": "Finance", "parent_id": "/payroll"},
    {"id": "/payroll/payslips", "name": "Payslips", "section": "Finance", "parent_id": "/payroll"},

    {"id": "/finance", "name": "Company Finance", "section": "Finance", "is_parent": True},
    {"id": "/finance/transactions", "name": "Finance Transactions", "section": "Finance", "parent_id": "/finance"},
    {"id": "/finance/plan", "name": "Financial Plan", "section": "Finance", "parent_id": "/finance"},
    {"id": "/finance/summary", "name": "Financial Summary", "section": "Finance", "parent_id": "/finance"},
    {"id": "/finance/clients", "name": "Other Transactions", "section": "Finance", "parent_id": "/finance"},
    {"id": "/finance/audit", "name": "Audit Logs", "section": "Finance", "parent_id": "/finance"},

    {"id": "/invoice", "name": "Invoice", "section": "Finance", "is_parent": True},
    {"id": "/invoice/all", "name": "All Invoices", "section": "Finance", "parent_id": "/invoice"},
    {"id": "/invoice/ledger", "name": "Invoice Ledger", "section": "Finance", "parent_id": "/invoice"},
    {"id": "/invoice/create", "name": "Create Invoice", "section": "Finance", "parent_id": "/invoice"},
    {"id": "/invoice/proforma", "name": "Create Proforma Invoice", "section": "Finance", "parent_id": "/invoice"},

    # --- WORKPLACE ---
    {"id": "/workspace", "name": "Workspace", "section": "Workplace", "is_parent": True},
    {"id": "/workspace/seating", "name": "Seating Arrangement", "section": "Workplace", "parent_id": "/workspace"},
    {"id": "/workspace/resource", "name": "Resource Management", "section": "Workplace", "parent_id": "/workspace"},
    {"id": "/workspace/gallery", "name": "Gallery", "section": "Workplace", "parent_id": "/workspace"},

    {"id": "/penalty", "name": "Penalty", "section": "Workplace", "is_parent": False},
    {"id": "/remarks", "name": "Remarks", "section": "Workplace", "is_parent": False},

    # --- COMMAND CENTER ---
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

    # --- ADMIN ---
    {"id": "/activity-tracker", "name": "Activity Tracker", "section": "Admin", "is_parent": False},
    
    {"id": "/recognitions", "name": "Elections & Recognition", "section": "Admin", "is_parent": True},
    {"id": "/team-leader-of-the-week", "name": "Team Leader of the Week", "section": "Admin", "parent_id": "/recognitions"},
    {"id": "/elections", "name": "Elections", "section": "Admin", "parent_id": "/recognitions"},

    {"id": "/access-control", "name": "Access Control", "section": "Admin", "is_parent": False},
    {"id": "/settings", "name": "Settings", "section": "Admin", "is_parent": False},
    {"id": "/restrictions", "name": "Restrictions", "section": "Admin", "is_parent": False},
    {"id": "/activity-logs", "name": "Activity Logs", "section": "Admin", "is_parent": False},
    {"id": "/recycle-bin", "name": "Recycle Bin", "section": "Admin", "is_parent": False},
]

def make_perm(read=False, create=False, update=False, delete=False, all_perm=False) -> dict:
    if all_perm:
        return {"read": True, "create": True, "update": True, "delete": True, "all": True}
    return {"read": read, "create": create, "update": update, "delete": delete, "all": all_perm}

def get_admin_full_permissions() -> Dict[str, dict]:
    """Returns full CRUD permissions for every single parent module and child sub-module."""
    return {mod["id"]: make_perm(all_perm=True) for mod in SYSTEM_MODULES}

# Default permissions for general employees
DEFAULT_EMPLOYEE_PERMISSIONS: Dict[str, dict] = {
    "/dashboard": make_perm(read=True),
    "/employees/attendance": make_perm(read=True, create=True),
    "/employees/leave-requests": make_perm(read=True, create=True),
    "/schedule": make_perm(read=True),
    "/work/logs": make_perm(read=True, create=True, update=True),
    "/tasks": make_perm(read=True, create=True, update=True),
    "/chat": make_perm(read=True, create=True),
    "/workspace": make_perm(read=True),
    "/workspace/seating": make_perm(read=True),
    "/workspace/gallery": make_perm(read=True),
    "/remarks": make_perm(read=True),
    "/recognitions": make_perm(read=True),
}

# Default permissions for HR Department
DEFAULT_HR_PERMISSIONS: Dict[str, dict] = {
    "/dashboard": make_perm(all_perm=True),
    "/approvals": make_perm(all_perm=True),
    "/employees/leave-requests": make_perm(all_perm=True),
    "/approvals/penalties": make_perm(all_perm=True),
    "/approvals/daily-progress": make_perm(all_perm=True),
    "/approvals/history": make_perm(all_perm=True),
    "/reports": make_perm(all_perm=True),
    "/reports/attendance": make_perm(all_perm=True),
    "/reports/payroll": make_perm(all_perm=True),
    "/reports/hiring": make_perm(all_perm=True),
    "/reports/work": make_perm(all_perm=True),
    "/employees": make_perm(all_perm=True),
    "/employees/list": make_perm(all_perm=True),
    "/employees/org": make_perm(all_perm=True),
    "/employees/departments-setup": make_perm(all_perm=True),
    "/employees/attendance": make_perm(all_perm=True),
    "/employees/documents": make_perm(all_perm=True),
    "/recruitment": make_perm(all_perm=True),
    "/recruitment/interviews": make_perm(all_perm=True),
    "/recruitment/hirings": make_perm(all_perm=True),
    "/schedule": make_perm(all_perm=True),
    "/work/logs": make_perm(all_perm=True),
    "/tasks": make_perm(all_perm=True),
    "/chat": make_perm(all_perm=True),
    "/payroll": make_perm(all_perm=True),
    "/payroll/dashboard": make_perm(all_perm=True),
    "/payroll/structure": make_perm(all_perm=True),
    "/payroll/settings": make_perm(all_perm=True),
    "/payroll/processing": make_perm(all_perm=True),
    "/payroll/bonuses": make_perm(all_perm=True),
    "/payroll/payslips": make_perm(all_perm=True),
    "/workspace": make_perm(all_perm=True),
    "/workspace/seating": make_perm(all_perm=True),
    "/workspace/resource": make_perm(all_perm=True),
    "/workspace/gallery": make_perm(all_perm=True),
    "/penalty": make_perm(all_perm=True),
    "/remarks": make_perm(all_perm=True),
    "/recognitions": make_perm(all_perm=True),
    "/team-leader-of-the-week": make_perm(all_perm=True),
    "/elections": make_perm(all_perm=True),
}

# Default permissions for Development Department
DEFAULT_DEVELOPMENT_PERMISSIONS: Dict[str, dict] = {
    "/dashboard": make_perm(read=True),
    "/dashboard#time-tracker": make_perm(read=True),
    "/dashboard#today-schedule": make_perm(read=True),
    "/dashboard#project-delivery": make_perm(read=True),
    "/dashboard#tasks-clients": make_perm(read=True),
    "/dashboard#attendance-analytics": make_perm(read=True),
    "/dashboard#hr-news": make_perm(read=True),
    "/dashboard#notifications": make_perm(read=True),
    "/schedule": make_perm(read=True),
    "/work/projects": make_perm(read=True, create=True, update=True),
    "/work/logs": make_perm(read=True, create=True, update=True),
    "/tasks": make_perm(read=True, create=True, update=True),
    "/chat": make_perm(read=True, create=True),
    "/employees/attendance": make_perm(read=True, create=True),
    "/employees/leave-requests": make_perm(read=True, create=True),
    "/workspace/seating": make_perm(read=True),
}

# Default permissions for Python Department
DEFAULT_PYTHON_PERMISSIONS: Dict[str, dict] = {
    "/dashboard": make_perm(read=True),
    "/schedule": make_perm(read=True),
    "/work/projects": make_perm(read=True, create=True, update=True),
    "/work/logs": make_perm(read=True, create=True, update=True),
    "/work/research": make_perm(read=True, create=True, update=True),
    "/tasks": make_perm(read=True, create=True, update=True),
    "/chat": make_perm(read=True, create=True),
    "/employees/attendance": make_perm(read=True, create=True),
    "/employees/leave-requests": make_perm(read=True, create=True),
    "/workspace": make_perm(read=True),
    "/workspace/seating": make_perm(read=True),
    "/workspace/gallery": make_perm(read=True),
    "/remarks": make_perm(read=True),
    "/recognitions": make_perm(read=True),
}

# Default permissions for Sales Department
DEFAULT_SALES_PERMISSIONS: Dict[str, dict] = {
    "/dashboard": make_perm(read=True),
    "/schedule": make_perm(read=True),
    "/work/sales": make_perm(all_perm=True),
    "/work/sales/dashboard": make_perm(all_perm=True),
    "/work/sales/pipeline": make_perm(all_perm=True),
    "/work/sales/leads": make_perm(all_perm=True),
    "/work/sales/tasks": make_perm(all_perm=True),
    "/work/sales/analytics": make_perm(all_perm=True),
    "/work/sales/team": make_perm(read=True),
    "/work/sales/reports": make_perm(all_perm=True),
    "/work/sales/settings": make_perm(read=True, update=True),
    "/invoice": make_perm(read=True, create=True),
    "/invoice/all": make_perm(read=True),
    "/invoice/create": make_perm(read=True, create=True),
    "/invoice/proforma": make_perm(read=True, create=True),
    "/work/logs": make_perm(read=True, create=True, update=True),
    "/tasks": make_perm(read=True, create=True, update=True),
    "/chat": make_perm(read=True, create=True),
    "/employees/attendance": make_perm(read=True, create=True),
    "/employees/leave-requests": make_perm(read=True, create=True),
    "/workspace": make_perm(read=True),
    "/workspace/seating": make_perm(read=True),
    "/workspace/gallery": make_perm(read=True),
    "/remarks": make_perm(read=True),
    "/recognitions": make_perm(read=True),
}

# Default permissions for Finance Department
DEFAULT_FINANCE_PERMISSIONS: Dict[str, dict] = {
    "/dashboard": make_perm(read=True),
    "/payroll": make_perm(all_perm=True),
    "/payroll/dashboard": make_perm(all_perm=True),
    "/payroll/structure": make_perm(all_perm=True),
    "/payroll/settings": make_perm(all_perm=True),
    "/payroll/processing": make_perm(all_perm=True),
    "/payroll/bonuses": make_perm(all_perm=True),
    "/payroll/payslips": make_perm(all_perm=True),
    "/finance": make_perm(all_perm=True),
    "/finance/transactions": make_perm(all_perm=True),
    "/finance/plan": make_perm(all_perm=True),
    "/finance/summary": make_perm(all_perm=True),
    "/finance/clients": make_perm(all_perm=True),
    "/finance/audit": make_perm(all_perm=True),
    "/invoice": make_perm(all_perm=True),
    "/invoice/all": make_perm(all_perm=True),
    "/invoice/ledger": make_perm(all_perm=True),
    "/invoice/create": make_perm(all_perm=True),
    "/invoice/proforma": make_perm(all_perm=True),
    "/reports": make_perm(read=True),
    "/reports/payroll": make_perm(all_perm=True),
    "/work/logs": make_perm(read=True, create=True, update=True),
    "/tasks": make_perm(read=True, create=True, update=True),
    "/chat": make_perm(read=True, create=True),
    "/employees/attendance": make_perm(read=True, create=True),
    "/employees/leave-requests": make_perm(read=True, create=True),
    "/workspace": make_perm(read=True),
    "/remarks": make_perm(read=True),
    "/recognitions": make_perm(read=True),
}

# Default permissions for Management Department
DEFAULT_MANAGEMENT_PERMISSIONS: Dict[str, dict] = {
    "/dashboard": make_perm(all_perm=True),
    "/approvals": make_perm(all_perm=True),
    "/approvals/daily-progress": make_perm(all_perm=True),
    "/approvals/history": make_perm(all_perm=True),
    "/reports": make_perm(all_perm=True),
    "/reports/attendance": make_perm(all_perm=True),
    "/reports/payroll": make_perm(all_perm=True),
    "/reports/hiring": make_perm(all_perm=True),
    "/reports/work": make_perm(all_perm=True),
    "/employees": make_perm(all_perm=True),
    "/employees/list": make_perm(read=True),
    "/employees/org": make_perm(read=True),
    "/employees/attendance": make_perm(all_perm=True),
    "/recruitment": make_perm(all_perm=True),
    "/schedule": make_perm(all_perm=True),
    "/work/projects": make_perm(all_perm=True),
    "/work/logs": make_perm(all_perm=True),
    "/tasks": make_perm(all_perm=True),
    "/chat": make_perm(all_perm=True),
    "/workspace": make_perm(all_perm=True),
    "/workspace/seating": make_perm(all_perm=True),
    "/workspace/resource": make_perm(all_perm=True),
    "/workspace/gallery": make_perm(all_perm=True),
    "/remarks": make_perm(all_perm=True),
    "/recognitions": make_perm(all_perm=True),
}

# Default permissions for Digital Marketing Department
DEFAULT_DIGITAL_MARKETING_PERMISSIONS: Dict[str, dict] = {
    "/dashboard": make_perm(read=True),
    "/schedule": make_perm(read=True),
    "/work/projects": make_perm(read=True, create=True, update=True),
    "/work/logs": make_perm(read=True, create=True, update=True),
    "/work/research": make_perm(read=True, create=True, update=True),
    "/work/sales/leads": make_perm(read=True, create=True),
    "/tasks": make_perm(read=True, create=True, update=True),
    "/chat": make_perm(read=True, create=True),
    "/employees/attendance": make_perm(read=True, create=True),
    "/employees/leave-requests": make_perm(read=True, create=True),
    "/workspace": make_perm(read=True),
    "/workspace/gallery": make_perm(read=True),
    "/remarks": make_perm(read=True),
    "/recognitions": make_perm(read=True),
}

# Default permissions for Creative Department
DEFAULT_CREATIVE_PERMISSIONS: Dict[str, dict] = {
    "/dashboard": make_perm(read=True),
    "/schedule": make_perm(read=True),
    "/work/projects": make_perm(read=True, create=True, update=True),
    "/work/logs": make_perm(read=True, create=True, update=True),
    "/tasks": make_perm(read=True, create=True, update=True),
    "/chat": make_perm(read=True, create=True),
    "/workspace": make_perm(read=True),
    "/workspace/gallery": make_perm(read=True, create=True, update=True),
    "/employees/attendance": make_perm(read=True, create=True),
    "/employees/leave-requests": make_perm(read=True, create=True),
    "/remarks": make_perm(read=True),
    "/recognitions": make_perm(read=True),
}

# Default permissions for Product Department
DEFAULT_PRODUCT_PERMISSIONS: Dict[str, dict] = {
    "/dashboard": make_perm(read=True),
    "/schedule": make_perm(read=True),
    "/work/projects": make_perm(all_perm=True),
    "/work/logs": make_perm(read=True, create=True, update=True),
    "/work/research": make_perm(all_perm=True),
    "/tasks": make_perm(all_perm=True),
    "/chat": make_perm(all_perm=True),
    "/reports/work": make_perm(all_perm=True),
    "/employees/attendance": make_perm(read=True, create=True),
    "/employees/leave-requests": make_perm(read=True, create=True),
    "/workspace": make_perm(read=True),
    "/remarks": make_perm(read=True),
    "/recognitions": make_perm(read=True),
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

    NOTE: No master admin is auto-created. Admin accounts come from
    real employee records (migration / manual create).
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

    # 3. Seed Role Presets (Admin & Employee)
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
