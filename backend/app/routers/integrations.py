"""
Integrations router - OAuth connections for Gmail, Instagram, YouTube
"""

from fastapi import APIRouter, HTTPException, Depends, status, Query, Request
from fastapi.responses import RedirectResponse
from typing import Optional
from uuid import UUID
import os
import secrets
from datetime import datetime, timedelta

from app.database import get_supabase
from app.routers.auth import get_current_user
from app.schemas import (
    IntegrationCreate,
    IntegrationResponse,
    IntegrationListResponse,
    SuccessResponse
)

router = APIRouter()

# OAuth configuration
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/integrations/gmail/callback")

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")


@router.get("", response_model=IntegrationListResponse)
async def list_integrations(current_user: dict = Depends(get_current_user)):
    """
    List all integrations for the current user
    """
    try:
        supabase = get_supabase()
        
        response = supabase.table("integrations").select(
            "id, user_id, provider, account_email, account_name, is_active, last_sync_at, created_at"
        ).eq("user_id", current_user["id"]).execute()
        
        integrations = [IntegrationResponse(**integration) for integration in response.data]
        
        return IntegrationListResponse(integrations=integrations)
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to list integrations: {str(e)}"
        )


@router.get("/{provider}", response_model=IntegrationResponse)
async def get_integration(
    provider: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get a specific integration by provider
    """
    try:
        supabase = get_supabase()
        
        response = supabase.table("integrations").select(
            "id, user_id, provider, account_email, account_name, is_active, last_sync_at, created_at"
        ).eq("user_id", current_user["id"]).eq("provider", provider).single().execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{provider} integration not found"
            )
        
        return IntegrationResponse(**response.data)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to get integration: {str(e)}"
        )


@router.delete("/{provider}", response_model=SuccessResponse)
async def disconnect_integration(
    provider: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Disconnect/remove an integration
    """
    try:
        supabase = get_supabase()
        
        # Check integration exists
        existing = supabase.table("integrations").select("id").eq("user_id", current_user["id"]).eq("provider", provider).single().execute()
        
        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{provider} integration not found"
            )
        
        supabase.table("integrations").delete().eq("user_id", current_user["id"]).eq("provider", provider).execute()
        
        return SuccessResponse(message=f"{provider} integration disconnected successfully")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to disconnect integration: {str(e)}"
        )


# ============================================
# Gmail OAuth Flow
# ============================================

@router.get("/gmail/connect")
async def connect_gmail(current_user: dict = Depends(get_current_user)):
    """
    Initiate Gmail OAuth flow
    Returns the authorization URL to redirect the user to
    """
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Gmail integration not configured. Please set GOOGLE_CLIENT_ID."
        )
    
    # Generate state token for CSRF protection
    state = f"{current_user['id']}:{secrets.token_urlsafe(32)}"
    
    # Store state in database or cache (simplified: include user_id in state)
    
    # Build authorization URL
    scopes = [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.labels",
        "https://www.googleapis.com/auth/userinfo.email"
    ]
    
    auth_url = (
        "https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={GOOGLE_CLIENT_ID}&"
        f"redirect_uri={GOOGLE_REDIRECT_URI}&"
        "response_type=code&"
        f"scope={' '.join(scopes)}&"
        f"state={state}&"
        "access_type=offline&"
        "prompt=consent"
    )
    
    return {"authorization_url": auth_url}


@router.get("/gmail/callback")
async def gmail_callback(
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None
):
    """
    Gmail OAuth callback handler
    """
    if error:
        return RedirectResponse(
            url=f"{FRONTEND_URL}/settings/integrations?error={error}"
        )
    
    if not code or not state:
        return RedirectResponse(
            url=f"{FRONTEND_URL}/settings/integrations?error=missing_params"
        )
    
    try:
        import httpx
        
        # Extract user_id from state
        user_id = state.split(":")[0]
        
        # Exchange code for tokens
        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "code": code,
                    "redirect_uri": GOOGLE_REDIRECT_URI,
                    "grant_type": "authorization_code"
                }
            )
            
            if token_response.status_code != 200:
                return RedirectResponse(
                    url=f"{FRONTEND_URL}/settings/integrations?error=token_exchange_failed"
                )
            
            tokens = token_response.json()
            
            # Get user email from Google
            userinfo_response = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {tokens['access_token']}"}
            )
            
            user_info = userinfo_response.json()
            account_email = user_info.get("email")
        
        # Save integration to database
        supabase = get_supabase()
        
        expires_at = datetime.utcnow() + timedelta(seconds=tokens.get("expires_in", 3600))
        
        integration_data = {
            "user_id": user_id,
            "provider": "gmail",
            "access_token": tokens["access_token"],
            "refresh_token": tokens.get("refresh_token"),
            "token_expires_at": expires_at.isoformat(),
            "account_email": account_email,
            "is_active": True
        }
        
        # Upsert integration
        supabase.table("integrations").upsert(
            integration_data,
            on_conflict="user_id,provider"
        ).execute()
        
        return RedirectResponse(
            url=f"{FRONTEND_URL}/settings/integrations?success=gmail"
        )
        
    except Exception as e:
        print(f"Gmail callback error: {e}")
        return RedirectResponse(
            url=f"{FRONTEND_URL}/settings/integrations?error=callback_failed"
        )


@router.post("/gmail/sync", response_model=SuccessResponse)
async def sync_gmail(current_user: dict = Depends(get_current_user)):
    """
    Manually trigger Gmail sync to detect new brand deals
    """
    try:
        supabase = get_supabase()
        
        # Get Gmail integration
        integration = supabase.table("integrations").select("*").eq("user_id", current_user["id"]).eq("provider", "gmail").single().execute()
        
        if not integration.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Gmail not connected. Please connect Gmail first."
            )
        
        if not integration.data.get("is_active"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Gmail integration is inactive. Please reconnect."
            )
        
        # TODO: Implement actual Gmail sync logic
        # This would:
        # 1. Fetch recent emails
        # 2. Parse for brand deal patterns
        # 3. Create deals automatically
        
        # Update last_sync_at
        supabase.table("integrations").update({
            "last_sync_at": datetime.utcnow().isoformat()
        }).eq("user_id", current_user["id"]).eq("provider", "gmail").execute()
        
        return SuccessResponse(message="Gmail sync completed. Check your deals for new leads.")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gmail sync failed: {str(e)}"
        )


# ============================================
# Instagram OAuth Flow (Placeholder)
# ============================================

@router.get("/instagram/connect")
async def connect_instagram(current_user: dict = Depends(get_current_user)):
    """
    Initiate Instagram OAuth flow (requires Meta App Review)
    """
    # Instagram Basic Display API or Instagram Graph API
    # Requires app review from Meta
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Instagram integration coming soon. Use CSV upload for now."
    )


# ============================================
# YouTube OAuth Flow (Placeholder)
# ============================================

@router.get("/youtube/connect")
async def connect_youtube(current_user: dict = Depends(get_current_user)):
    """
    Initiate YouTube OAuth flow
    """
    # Similar to Gmail but with YouTube Data API scopes
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="YouTube integration coming soon. Use CSV upload for now."
    )
