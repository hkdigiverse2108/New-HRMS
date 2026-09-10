from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from app.repository.employee import EmployeeRepository
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from app.config import settings
import random
import uuid
from fastapi import BackgroundTasks
from app.redis.client import redis_client
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
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

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

async def get_current_user(token: str = Depends(oauth2_scheme)):
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
        role = employee.get("work_details", {}).get("system_role")
        if role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Operation not permitted"
            )
        return employee

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

@router.post("/login")
async def login_for_access_token(login_data: LoginRequest, background_tasks: BackgroundTasks):
    # Find employee by email
    employee = await EmployeeRepository.get_employee_by_email(login_data.email)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    work_details = employee.get("work_details", {})
    if work_details.get("is_delete") is True:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deleted."
        )
        
    if work_details.get("is_block") is True:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is blocked. Please contact Admin."
        )
    
    # Verify password
    hashed_password = employee["personal_info"]["password"]
    if not verify_password(login_data.password, hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Generate 6 digit OTP
    otp = str(random.randint(100000, 999999))
    # Store OTP in Database
    await EmployeeRepository.update_employee(employee["_id"], {"otp": otp})
    
    # Send OTP email
    background_tasks.add_task(send_otp_email, login_data.email, otp)
    
    return {"message": "OTP sent to your email. Please verify."}

@router.post("/verify-otp", response_model=Token)
async def verify_otp(verify_data: VerifyOTPRequest):
    employee = await EmployeeRepository.get_employee_by_email(verify_data.email)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )
        
    stored_otp = employee.get("otp")
    if not stored_otp or stored_otp != verify_data.otp:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired OTP",
        )
    
    # OTP is valid, remove it from DB
    await EmployeeRepository.update_employee(employee["_id"], {"otp": None})
    
    # Create token
    # Hardcoded access token expiration time (10 seconds)
    access_token_expires = timedelta(seconds=60)
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
