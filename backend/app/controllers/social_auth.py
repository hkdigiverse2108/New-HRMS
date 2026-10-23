from fastapi import Depends, HTTPException, Request, status
from app.controllers.auth import oauth2_scheme, resolve_effective_permissions_for_employee, get_current_employee

async def get_strict_employee(emp: dict = Depends(get_current_employee)) -> dict:
    """Strict authentication dependency for Social Automation.
    Uses HRMS employee resolution and ensures account is active.
    """
    if not emp:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    work = emp.get("work_details", {})
    if work.get("is_delete") or work.get("is_block"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is deactivated or blocked",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return emp

def require_social(module: str = "/social", action: str | None = None, require_admin_for_write: bool = False):
    """Permission dependency enforcing module access for /social and its submodules."""
    async def dep(request: Request, emp: dict = Depends(get_strict_employee)):
        work = emp.get("work_details", {})
        role = work.get("system_role", "Employee")
        if role in ("Admin", "Super Admin"):
            return emp

        # Sensitive writes like tokens or settings may require full Admin or module 'all'
        perms = await resolve_effective_permissions_for_employee(emp)
        act = action or {
            "GET": "read",
            "POST": "create",
            "PUT": "update",
            "PATCH": "update",
            "DELETE": "delete",
        }.get(request.method, "read")

        for cand in (module, "/social"):
            p = perms.get(cand, {})
            if p.get("all"):
                return emp
            if not require_admin_for_write and p.get(act):
                return emp

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operation not permitted for your role"
        )
    return dep
