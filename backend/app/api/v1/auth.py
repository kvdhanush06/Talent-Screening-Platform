"""Authentication routes."""

import uuid as uuid_mod
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field

from app.core.security import create_access_token, verify_password, get_password_hash
from app.core.deps import get_current_user
from app.data_store import USERS

router = APIRouter()

# Schemas
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: str = Field(..., min_length=1)
    company_name: str = ""

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    company_name: str
    role: str
    is_active: bool
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class UserUpdate(BaseModel):
    full_name: str | None = None
    company_name: str | None = None

# Routes
@router.post("/register", response_model=TokenResponse)
async def register(user_in: UserCreate):
    """Register a new recruiter."""
    for u in USERS.values():
        if u["email"] == user_in.email:
            raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid_mod.uuid4())
    user = {
        "id": user_id,
        "email": user_in.email,
        "password_hash": get_password_hash(user_in.password),
        "full_name": user_in.full_name,
        "company_name": user_in.company_name,
        "role": "recruiter",
        "is_active": True,
        "created_at": str(datetime.utcnow()),
        "updated_at": str(datetime.utcnow()),
    }
    USERS[user_id] = user
    token = create_access_token({"sub": user_id})
    return TokenResponse(access_token=token, user=UserResponse(**user))

@router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    """Login and get access token."""
    user = None
    for u in USERS.values():
        if u["email"] == credentials.email:
            user = u
            break
    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token({"sub": user["id"]})
    return TokenResponse(access_token=token, user=UserResponse(**user))

@router.get("/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    """Get current user profile."""
    return UserResponse(**user)

@router.put("/me", response_model=UserResponse)
async def update_me(data: UserUpdate, user: dict = Depends(get_current_user)):
    """Update current user profile."""
    user_id = user["id"]
    if data.full_name is not None:
        USERS[user_id]["full_name"] = data.full_name
    if data.company_name is not None:
        USERS[user_id]["company_name"] = data.company_name
    USERS[user_id]["updated_at"] = str(datetime.utcnow())
    return UserResponse(**USERS[user_id])
