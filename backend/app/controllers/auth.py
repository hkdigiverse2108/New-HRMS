from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from app.repository.employee import EmployeeRepository
from app.repository.access_control import UserPermissionRepository, PresetPermissionRepository, has_manual_permissions
import bcrypt
from datetime import datetime, timedelta
from jose import JWTError, jwt
from pydantic import BaseModel
from app.config import settings
import random
import uuid
from fastapi import BackgroundTasks
from app.redis.service import redis_client
from app.utils.email import send_otp_email

# --- Schemas ---
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: str | None = None

# --- Utilities ---
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login", auto_error=False)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        if not plain_password or not hashed_password:
            return False
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

# Default mock employee for requests without token (frontend dev / preview)
DEFAULT_ADMIN_EMPLOYEE = {
    "id": "default-admin-id",
    "email": "admin@hrms.com",
    "personal_info": {"first_name": "Admin", "last_name": "User", "email": "admin@hrms.com"},
    "work_details": {"system_role": "Admin", "is_delete": False, "is_block": False}
}

async def get_current_user(token: str = Depends(oauth2_scheme)):
    if not token:
        return "admin@hrms.com"
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
            
        employee = await EmployeeRepository.get_employee_by_email(email)
        if not employee:
            raise credentials_exception
            
        work_details = employee.get("work_details", {})
        if work_details.get("is_delete") is True or work_details.get("is_block") is True:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Your account is blocked or deleted.",
                headers={"WWW-Authenticate": "Bearer"}
            )
            
        return email
    except JWTError:
        raise credentials_exception

async def get_current_employee(token: str = Depends(oauth2_scheme)):
    if not token:
        return DEFAULT_ADMIN_EMPLOYEE
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    employee = await EmployeeRepository.get_employee_by_email(email)
    if employee is None:
        raise credentials_exception
        
    work_details = employee.get("work_details", {})
    if work_details.get("is_delete") is True or work_details.get("is_block") is True:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your account is blocked or deleted.",
            headers={"WWW-Authenticate": "Bearer"}
        )
        
    return employee

class RoleChecker:
    def __init__(self, allowed_roles: list[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, employee: dict = Depends(get_current_employee)):
        if not employee:
            return True
        role = employee.get("work_details", {}).get("system_role", "Admin")
        if self.allowed_roles and role not in self.allowed_roles and "Admin" not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Operation not permitted for this role"
            )
        return True

async def resolve_effective_permissions_for_employee(employee: dict) -> dict:
    """Unified single source of truth for resolving dynamic employee permissions."""
    emp_id = str(employee.get("_id", "")).strip()
    work = employee.get("work_details", {})
    role = work.get("system_role", "Employee")

    if role == "Admin":
        from app.database.default_presets import get_admin_full_permissions
        return get_admin_full_permissions()

    from app.redis.service import get_cache, set_cache
    cached_perms = await get_cache(f"user_perms_resolved:{emp_id}")
    if cached_perms:
        return cached_perms

    # 1. Check Custom Manual Permissions (only if is_custom is explicitly True)
    user_perm_doc = await UserPermissionRepository.get_user_permission(emp_id)
    if user_perm_doc and user_perm_doc.get("is_custom") is True and has_manual_permissions(user_perm_doc.get("module_permissions")):
        perms = user_perm_doc["module_permissions"]
    else:
        # 2. Inherit dynamically from Role Preset (HR, Employee, Sub-Admin, Admin)
        preset, _ = await PresetPermissionRepository.get_preset_for_employee(role)
        if preset and "module_permissions" in preset:
            perms = preset["module_permissions"]
        else:
            from app.database.default_presets import DEFAULT_EMPLOYEE_PERMISSIONS
            perms = DEFAULT_EMPLOYEE_PERMISSIONS

    await set_cache(f"user_perms_resolved:{emp_id}", perms, ttl=300)
    return perms

class DynamicPermissionChecker:
    async def __call__(self, request: Request, employee: dict = Depends(get_current_employee)):
        if not employee:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
            
        role = employee.get("work_details", {}).get("system_role", "Employee")
        if role == "Admin":
            return employee
            
        # Extract base module ID from the request URL path (e.g., "/employees/123" -> "/employees")
        path_parts = request.url.path.strip("/").split("/")
        module_id = "/" + path_parts[0] if path_parts and path_parts[0] else "/"
        
        # Map HTTP methods to CRUD operations
        method_map = {
            "GET": "read",
            "POST": "create",
            "PUT": "update",
            "PATCH": "update",
            "DELETE": "delete"
        }
        required_permission = method_map.get(request.method, "read")
        
        perms = await resolve_effective_permissions_for_employee(employee)
        module_perms = perms.get(module_id, {})
        
        # If still no permissions are found, deny access
        if not module_perms:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied. No permissions set.")
        
        has_all = module_perms.get("all", False)
        has_required = module_perms.get(required_permission, False)
        
        if has_all or has_required:
            return employee
            
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Operation '{required_permission}' not permitted on '{module_id}'")

# --- Router & Endpoints ---
router = APIRouter(tags=["Authentication"])

from pydantic import BaseModel, EmailStr

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class VerifyForgotPasswordRequest(BaseModel):
    email: EmailStr
    otp: str

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    reset_token: str
    new_password: str


@router.get("/me")
async def get_me(current_employee: dict = Depends(get_current_employee)):
    """Returns authenticated user details along with their full dynamic permissions."""
    personal = current_employee.get("personal_info", {})
    work = current_employee.get("work_details", {})
    role = work.get("system_role", "Employee")
    emp_id = str(current_employee.get("_id", ""))

    perms = await resolve_effective_permissions_for_employee(current_employee)

    return {
        "id": emp_id,
        "email": personal.get("email_address") or current_employee.get("email"),
        "name": f"{personal.get('first_name', '')} {personal.get('last_name', '')}".strip() or "Employee",
        "role": role,
        "department": work.get("department", ""),
        "designation": work.get("designation", ""),
        "profile_photo": personal.get("profile_photo", "") or current_employee.get("profile_photo", ""),
        "permissions": perms
    }

@router.post("/login")
async def login_for_access_token(login_data: LoginRequest, background_tasks: BackgroundTasks):
    print(f"\n[Auth] Login attempt for email: {login_data.email}")
    # Find employee by email
    employee = await EmployeeRepository.get_employee_by_email(login_data.email)
    if not employee:
        print(f"[Auth] Login failed: {login_data.email} not found")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    work_details = employee.get("work_details", {})
    if work_details.get("is_delete") is True:
        print(f"[Auth] Login rejected: {login_data.email} account is deleted")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deleted."
        )
        
    if work_details.get("is_block") is True:
        print(f"[Auth] Login rejected: {login_data.email} account is blocked")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is blocked. Please contact Admin."
        )
    
    # Verify password safely
    personal_info = employee.get("personal_info") or {}
    hashed_password = personal_info.get("password")

    is_valid_pw = False
    if hashed_password:
        is_valid_pw = verify_password(login_data.password, hashed_password)

    # Master Admin convenience: support both Password@123 and Admin@123
    clean_email = str(login_data.email).strip().lower()
    if not is_valid_pw and clean_email == "admin@hrms.com":
        if login_data.password in ("Password@123", "Admin@123"):
            is_valid_pw = True

    if not is_valid_pw:
        print(f"[Auth] Login failed: Incorrect password for {login_data.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Generate 6 digit OTP
    otp = str(random.randint(100000, 999999))
    print(f"[Auth] Login credentials verified for {login_data.email}. Generated OTP: {otp}")
    # Store OTP in Redis (with 5 min expiry) and fallback in Database
    try:
        await redis_client.set(f"otp:{login_data.email}", otp, ex=300)
    except Exception as e:
        print(f"Redis warning: {e}")
    await EmployeeRepository.update_employee(employee["_id"], {"otp": otp})
    
    # Send OTP email
    background_tasks.add_task(send_otp_email, login_data.email, otp)
    
    return {"message": "OTP sent to your email. Please verify.", "email": login_data.email}

@router.post("/verify-otp", response_model=Token)
async def verify_otp(verify_data: VerifyOTPRequest):
    employee = await EmployeeRepository.get_employee_by_email(verify_data.email)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )
        
    stored_otp = None
    try:
        stored_otp = await redis_client.get(f"otp:{verify_data.email}")
    except Exception as e:
        print(f"Redis warning: {e}")

    if not stored_otp:
        stored_otp = employee.get("otp")

    if not stored_otp or str(stored_otp).strip() != str(verify_data.otp).strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired OTP",
        )
    
    # OTP is valid, remove it from Redis and DB
    try:
        await redis_client.delete(f"otp:{verify_data.email}")
    except Exception:
        pass
    await EmployeeRepository.update_employee(employee["_id"], {"otp": None})
    
    # Create token - 7 days expiry
    access_token_expires = timedelta(days=7)
    access_token = create_access_token(
        data={"sub": verify_data.email}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest, background_tasks: BackgroundTasks):
    employee = await EmployeeRepository.get_employee_by_email(request.email)
    if not employee:
        return {"message": "If your email is registered, you will receive an OTP."}

    # Generate 6 digit OTP
    otp = str(random.randint(100000, 999999))
    try:
        await redis_client.set(f"forgot_otp:{request.email}", otp, ex=300)
    except Exception as e:
        print(f"Redis warning for forgot_otp: {e}")
    
    # Send OTP email
    background_tasks.add_task(send_otp_email, request.email, otp)
    return {"message": "If your email is registered, you will receive an OTP."}

@router.post("/verify-forgot-password-otp")
async def verify_forgot_password_otp(request: VerifyForgotPasswordRequest):
    stored_otp = None
    try:
        stored_otp = await redis_client.get(f"forgot_otp:{request.email}")
    except Exception as e:
        print(f"Redis warning: {e}")

    if not stored_otp or str(stored_otp).strip() != str(request.otp).strip():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired OTP")
    
    # OTP is valid, remove it from Redis
    try:
        await redis_client.delete(f"forgot_otp:{request.email}")
    except Exception:
        pass
    
    # Generate a secure reset token and store in Redis with 15 min expiry
    reset_token = str(uuid.uuid4())
    try:
        await redis_client.set(f"reset_token:{request.email}", reset_token, ex=900)
    except Exception as e:
        print(f"Redis warning: {e}")
    
    return {"message": "OTP verified successfully", "reset_token": reset_token}

@router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest):
    stored_token = None
    try:
        stored_token = await redis_client.get(f"reset_token:{request.email}")
    except Exception as e:
        print(f"Redis warning: {e}")

    if not stored_token or str(stored_token).strip() != str(request.reset_token).strip():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired reset token")
    
    employee = await EmployeeRepository.get_employee_by_email(request.email)
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
        
    # Hash the new password with bcrypt
    hashed_password = get_password_hash(request.new_password)
    
    # Update employee document in DB
    updated = await EmployeeRepository.update_employee(employee["_id"], {"personal_info.password": hashed_password})
    if not updated:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update password")
        
    # Invalidate reset token from Redis
    try:
        await redis_client.delete(f"reset_token:{request.email}")
    except Exception:
        pass
    
    return {"message": "Password reset successfully. You can now login."}
