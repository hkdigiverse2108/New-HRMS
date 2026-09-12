import bcrypt
from typing import Dict, Any, List
from app.database.db import get_database

# ==============================================================================
# ALL SYSTEM MODULES & SUB-MODULES (Full Hierarchy matching Navigation)
# ==============================================================================
SYSTEM_MODULES: List[Dict[str, Any]] = [
    # --- OVERVIEW ---
    {"id": "/dashboard", "name": "Dashboard", "section": "Overview", "is_parent": False},
    
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
    "/employees": make_perm(read=True),
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

# Default permissions for HR role
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

# Default permissions for Sub-Admin role (almost all modules except access control)
DEFAULT_SUB_ADMIN_PERMISSIONS: Dict[str, dict] = {
    mod["id"]: make_perm(all_perm=True) 
    for mod in SYSTEM_MODULES 
    if mod["id"] not in ["/access-control", "/restrictions"]
}

# ==============================================================================
# DATABASE INITIALIZER & SEEDER
# ==============================================================================
async def init_database_presets_and_admin(db):
    """
    1. Ensures the single Master Admin user exists with 'Admin@123' password and full system access.
    2. Does NOT modify any other users' existing roles.
    3. Seeds role-based permission presets (HR, Employee, Sub-Admin, Admin) if not existing.
    """
    # 1. Setup Master Admin: admin@hrms.com
    admin_email = "admin@hrms.com"
    salt = bcrypt.gensalt()
    admin_hashed_pw = bcrypt.hashpw("Admin@123".encode("utf-8"), salt).decode("utf-8")
    
    admin_full_perms = get_admin_full_permissions()
    
    existing_admin = await db["employees"].find_one({
        "$or": [
            {"personal_info.email_address": admin_email},
            {"email": admin_email}
        ]
    })
    
    admin_id = None
    if existing_admin:
        admin_id = str(existing_admin["_id"])
        await db["employees"].update_one(
            {"_id": existing_admin["_id"]},
            {
                "$set": {
                    "personal_info.password": admin_hashed_pw,
                    "personal_info.email_address": admin_email,
                    "personal_info.first_name": "System",
                    "personal_info.last_name": "Admin",
                    "work_details.system_role": "Admin",
                    "work_details.is_delete": False,
                    "work_details.is_block": False,
                }
            }
        )
    else:
        new_admin = {
            "personal_info": {
                "first_name": "System",
                "last_name": "Admin",
                "email_address": admin_email,
                "password": admin_hashed_pw,
                "gender": "Male",
                "profile_photo": ""
            },
            "work_details": {
                "system_role": "Admin",
                "department": "Management",
                "designation": "Administrator",
                "is_delete": False,
                "is_block": False,
                "work_mode": "WFO"
            },
            "profile_photo": "",
            "otp": None
        }
        res = await db["employees"].insert_one(new_admin)
        admin_id = str(res.inserted_id)

    # Ensure admin has full user permissions in user_permissions collection
    if admin_id:
        await db["user_permissions"].update_one(
            {"employee_id": admin_id},
            {
                "$set": {
                    "employee_id": admin_id,
                    "module_permissions": admin_full_perms,
                    "is_custom": True
                }
            },
            upsert=True
        )

    # 2. Seed Role-Based Permission Presets (HR, Employee, Sub-Admin, Admin)
    role_presets = [
        ("HR", DEFAULT_HR_PERMISSIONS),
        ("Employee", DEFAULT_EMPLOYEE_PERMISSIONS),
        ("Sub-Admin", DEFAULT_SUB_ADMIN_PERMISSIONS),
        ("Admin", admin_full_perms),
    ]

    for role_name, default_perms in role_presets:
        existing_preset = await db["permission_presets"].find_one({"role": role_name})
        if not existing_preset:
            await db["permission_presets"].update_one(
                {"role": role_name},
                {"$set": {
                    "role": role_name,
                    "department_id": "all",
                    "designation_id": "all",
                    "module_permissions": default_perms
                }},
                upsert=True
            )
            print(f"[Presets] Seeded role-based preset for '{role_name}'.")

    print(f"[Admin] Master admin initialized: {admin_email} (Password: Admin@123)")
