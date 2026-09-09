from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from app.repository.employee import EmployeeRepository
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from app.config import settings
import random
from fastapi import BackgroundTasks
from app.redis.client import redis_client
from app.utils.email import send_otp_email

# Temporary in-memory store for OTPs (to bypass Redis error)
otp_store = {}

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
        return email
    except JWTError:
        raise credentials_exception

# --- Router & Endpoints ---
router = APIRouter(tags=["Authentication"])

from pydantic import BaseModel, EmailStr

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp: str

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
    
    # Store OTP in dictionary (temporary alternative to Redis)
    otp_store[login_data.email] = otp
    # await redis_client.setex(f"otp:{login_data.email}", 300, otp)
    
    # Send OTP email
    background_tasks.add_task(send_otp_email, login_data.email, otp)
    
    return {"message": "OTP sent to your email. Please verify."}

@router.post("/verify-otp", response_model=Token)
async def verify_otp(verify_data: VerifyOTPRequest):
    # Check OTP from dictionary
    stored_otp = otp_store.get(verify_data.email)
    # stored_otp = await redis_client.get(f"otp:{verify_data.email}")
    if not stored_otp or stored_otp != verify_data.otp:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired OTP",
        )
    
    # OTP is valid, remove it
    if verify_data.email in otp_store:
        del otp_store[verify_data.email]
    # await redis_client.delete(f"otp:{verify_data.email}")
    
    # Create token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": verify_data.email}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}
