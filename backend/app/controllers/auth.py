from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from app.repository.employee import EmployeeRepository
from app.repository.access_control import UserPermissionRepository, PresetPermissionRepository, has_manual_permissions
import bcrypt
# Patch passlib compatibility with bcrypt >= 4.1.0
if not hasattr(bcrypt, "__about__"):
    class _BcryptAbout:
        __version__ = getattr(bcrypt, "__version__", "4.0.1")
    bcrypt.__about__ = _BcryptAbout()

from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from app.config import settings
import random
import uuid
from fastapi import BackgroundTasks
from app.redis.service import redis_client
from app.utils.email import send_otp_email

# Temporary in-memory store for OTPs (to bypass Redis error)
otp_store = {}
forgot_password_otp_store = {}
reset_token_store = {}

# --- Schemas ---
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: str | None = None

# --- Utilities ---
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login", auto_error=False)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

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
        
        employee_id = str(employee.get("_id"))
        
        # 1. Fetch Manual Permissions
        user_permission = await UserPermissionRepository.get_user_permission(employee_id)
        module_perms = {}
        if user_permission:
            user_module_perms = user_permission.get("module_permissions", {})
            if has_manual_permissions(user_module_perms):
                module_perms = user_module_perms.get(module_id, {})
            
        # 2. Fallback to Presets if manual permissions don't exist or all are false
        if not module_perms:
            dept_id = employee.get("work_details", {}).get("department")
            desig_id = employee.get("work_details", {}).get("designation")
            
            if dept_id and desig_id:
                preset = await PresetPermissionRepository.get_preset(dept_id, desig_id)
                if preset:
                    module_perms = preset.get("module_permissions", {}).get(module_id, {})

        # If no permissions are found at all, deny access
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
    """Returns the authenticated user details from token."""
    personal = current_employee.get("personal_info", {})
    work = current_employee.get("work_details", {})
    return {
        "id": str(current_employee.get("_id", "")),
        "email": personal.get("email_address") or current_employee.get("email"),
        "name": f"{personal.get('first_name', '')} {personal.get('last_name', '')}".strip() or "Employee",
        "role": work.get("system_role", "Employee"),
        "department": work.get("department", ""),
        "profile_photo": personal.get("profile_photo", "") or current_employee.get("profile_photo", "")
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
    if not hashed_password or not verify_password(login_data.password, hashed_password):
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
        # We shouldn't reveal if the email exists for security reasons, but for simplicity we can return success anyway
        return {"message": "If your email is registered, you will receive an OTP."}

    # Generate 6 digit OTP
    otp = str(random.randint(100000, 999999))
    forgot_password_otp_store[request.email] = otp
    
    # Send OTP email
    background_tasks.add_task(send_otp_email, request.email, otp)
    return {"message": "If your email is registered, you will receive an OTP."}

@router.post("/verify-forgot-password-otp")
async def verify_forgot_password_otp(request: VerifyForgotPasswordRequest):
    stored_otp = forgot_password_otp_store.get(request.email)
    if not stored_otp or stored_otp != request.otp:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired OTP")
    
    # OTP is valid, remove it
    del forgot_password_otp_store[request.email]
    
    # Generate a secure reset token
    reset_token = str(uuid.uuid4())
    reset_token_store[request.email] = reset_token
    
    return {"message": "OTP verified successfully", "reset_token": reset_token}

@router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest):
    stored_token = reset_token_store.get(request.email)
    if not stored_token or stored_token != request.reset_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired reset token")
    
    employee = await EmployeeRepository.get_employee_by_email(request.email)
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
        
    # Hash the new password
    hashed_password = get_password_hash(request.new_password)
    
    # Update employee document in DB
    updated = await EmployeeRepository.update_employee(employee["_id"], {"personal_info.password": hashed_password})
    if not updated:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update password")
        
    # Remove the reset token so it can't be used again
    del reset_token_store[request.email]
    
    return {"message": "Password reset successfully. You can now login."}
