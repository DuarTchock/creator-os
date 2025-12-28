"""
Authentication router - handles signup, login, logout, and session management
Uses Supabase Auth
"""

from fastapi import APIRouter, HTTPException, Depends, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
import os

from app.database import get_supabase
from app.schemas import (
    UserSignUp, 
    UserLogin, 
    UserResponse, 
    TokenResponse, 
    ProfileUpdate,
    SuccessResponse,
    ErrorResponse
)

router = APIRouter()
security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """
    Dependency to get current authenticated user from JWT token
    """
    try:
        supabase = get_supabase()
        
        # Verify the JWT token with Supabase
        user_response = supabase.auth.get_user(credentials.credentials)
        
        if not user_response or not user_response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )
        
        return {
            "id": user_response.user.id,
            "email": user_response.user.email,
            "token": credentials.credentials
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(e)}"
        )


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def signup(user_data: UserSignUp):
    """
    Register a new user account
    """
    try:
        supabase = get_supabase()
        
        # Create user with Supabase Auth
        response = supabase.auth.sign_up({
            "email": user_data.email,
            "password": user_data.password,
            "options": {
                "data": {
                    "full_name": user_data.full_name or user_data.email.split("@")[0]
                }
            }
        })
        
        if not response.user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create user account"
            )
        
        # Get user profile
        profile_response = supabase.table("profiles").select("*").eq("id", response.user.id).single().execute()
        
        user_profile = profile_response.data if profile_response.data else {
            "id": response.user.id,
            "email": response.user.email,
            "full_name": user_data.full_name,
            "subscription_tier": "free",
            "onboarding_completed": False,
            "created_at": response.user.created_at
        }
        
        return TokenResponse(
            access_token=response.session.access_token if response.session else "",
            expires_in=response.session.expires_in if response.session else 3600,
            refresh_token=response.session.refresh_token if response.session else None,
            user=UserResponse(
                id=response.user.id,
                email=response.user.email,
                full_name=user_profile.get("full_name"),
                avatar_url=user_profile.get("avatar_url"),
                subscription_tier=user_profile.get("subscription_tier", "free"),
                onboarding_completed=user_profile.get("onboarding_completed", False),
                created_at=response.user.created_at
            )
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Signup failed: {str(e)}"
        )


@router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    """
    Login with email and password
    """
    try:
        supabase = get_supabase()
        
        # Authenticate with Supabase
        response = supabase.auth.sign_in_with_password({
            "email": credentials.email,
            "password": credentials.password
        })
        
        if not response.user or not response.session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )
        
        # Get user profile
        profile_response = supabase.table("profiles").select("*").eq("id", response.user.id).single().execute()
        
        user_profile = profile_response.data if profile_response.data else {}
        
        return TokenResponse(
            access_token=response.session.access_token,
            expires_in=response.session.expires_in,
            refresh_token=response.session.refresh_token,
            user=UserResponse(
                id=response.user.id,
                email=response.user.email,
                full_name=user_profile.get("full_name"),
                avatar_url=user_profile.get("avatar_url"),
                subscription_tier=user_profile.get("subscription_tier", "free"),
                onboarding_completed=user_profile.get("onboarding_completed", False),
                created_at=response.user.created_at
            )
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Login failed: {str(e)}"
        )


@router.post("/logout", response_model=SuccessResponse)
async def logout(current_user: dict = Depends(get_current_user)):
    """
    Logout current user and invalidate session
    """
    try:
        supabase = get_supabase()
        supabase.auth.sign_out()
        
        return SuccessResponse(message="Successfully logged out")
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Logout failed: {str(e)}"
        )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(refresh_token: str):
    """
    Refresh access token using refresh token
    """
    try:
        supabase = get_supabase()
        
        response = supabase.auth.refresh_session(refresh_token)
        
        if not response.session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )
        
        # Get user profile
        profile_response = supabase.table("profiles").select("*").eq("id", response.user.id).single().execute()
        
        user_profile = profile_response.data if profile_response.data else {}
        
        return TokenResponse(
            access_token=response.session.access_token,
            expires_in=response.session.expires_in,
            refresh_token=response.session.refresh_token,
            user=UserResponse(
                id=response.user.id,
                email=response.user.email,
                full_name=user_profile.get("full_name"),
                avatar_url=user_profile.get("avatar_url"),
                subscription_tier=user_profile.get("subscription_tier", "free"),
                onboarding_completed=user_profile.get("onboarding_completed", False),
                created_at=response.user.created_at
            )
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token refresh failed: {str(e)}"
        )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """
    Get current authenticated user's profile
    """
    try:
        supabase = get_supabase()
        
        # Get user profile from database
        response = supabase.table("profiles").select("*").eq("id", current_user["id"]).single().execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User profile not found"
            )
        
        profile = response.data
        
        return UserResponse(
            id=profile["id"],
            email=profile["email"],
            full_name=profile.get("full_name"),
            avatar_url=profile.get("avatar_url"),
            subscription_tier=profile.get("subscription_tier", "free"),
            onboarding_completed=profile.get("onboarding_completed", False),
            created_at=profile["created_at"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to get profile: {str(e)}"
        )


@router.patch("/me", response_model=UserResponse)
async def update_profile(
    profile_data: ProfileUpdate,
    current_user: dict = Depends(get_current_user)
):
    """
    Update current user's profile
    """
    try:
        supabase = get_supabase()
        
        # Prepare update data (only non-None values)
        update_data = {k: v for k, v in profile_data.model_dump().items() if v is not None}
        
        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update"
            )
        
        # Update profile
        response = supabase.table("profiles").update(update_data).eq("id", current_user["id"]).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Profile not found"
            )
        
        profile = response.data[0]
        
        return UserResponse(
            id=profile["id"],
            email=profile["email"],
            full_name=profile.get("full_name"),
            avatar_url=profile.get("avatar_url"),
            subscription_tier=profile.get("subscription_tier", "free"),
            onboarding_completed=profile.get("onboarding_completed", False),
            created_at=profile["created_at"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to update profile: {str(e)}"
        )


@router.post("/password/reset", response_model=SuccessResponse)
async def request_password_reset(email: str):
    """
    Request password reset email
    """
    try:
        supabase = get_supabase()
        
        supabase.auth.reset_password_email(
            email,
            options={
                "redirect_to": f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/auth/reset-password"
            }
        )
        
        return SuccessResponse(message="Password reset email sent if account exists")
        
    except Exception as e:
        # Don't reveal if email exists or not
        return SuccessResponse(message="Password reset email sent if account exists")


@router.post("/password/update", response_model=SuccessResponse)
async def update_password(
    new_password: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Update password for authenticated user
    """
    try:
        supabase = get_supabase()
        
        supabase.auth.update_user({"password": new_password})
        
        return SuccessResponse(message="Password updated successfully")
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to update password: {str(e)}"
        )
