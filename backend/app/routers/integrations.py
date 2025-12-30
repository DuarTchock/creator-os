"""
Integrations router - OAuth connections for Gmail, Instagram, YouTube
"""

from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.responses import RedirectResponse
from typing import Optional, List
from pydantic import BaseModel
import os
import secrets
from datetime import datetime, timedelta
import urllib.parse

from app.database import get_supabase_admin
from app.routers.auth import get_current_user
from app.schemas import (
    IntegrationResponse,
    IntegrationListResponse,
    SuccessResponse
)

router = APIRouter()

# OAuth configuration
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
YOUTUBE_REDIRECT_URI = os.getenv("YOUTUBE_REDIRECT_URI", "http://localhost:8000/api/integrations/youtube/callback")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")


# Request models
class YouTubeImportRequest(BaseModel):
    video_ids: List[str]
    import_name: str


@router.get("", response_model=IntegrationListResponse)
async def list_integrations(current_user: dict = Depends(get_current_user)):
    """List all integrations for the current user"""
    try:
        supabase = get_supabase_admin()
        
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


@router.delete("/{provider}", response_model=SuccessResponse)
async def disconnect_integration(
    provider: str,
    current_user: dict = Depends(get_current_user)
):
    """Disconnect/remove an integration"""
    try:
        supabase = get_supabase_admin()
        
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
# YouTube OAuth Flow
# ============================================

@router.get("/youtube/connect")
async def connect_youtube(current_user: dict = Depends(get_current_user)):
    """Initiate YouTube OAuth flow"""
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="YouTube integration not configured. Please set GOOGLE_CLIENT_ID."
        )
    
    state = f"{current_user['id']}:{secrets.token_urlsafe(32)}"
    
    scopes = [
        "https://www.googleapis.com/auth/youtube.force-ssl",
        "https://www.googleapis.com/auth/userinfo.email"
    ]
    
    auth_url = (
        "https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={GOOGLE_CLIENT_ID}&"
        f"redirect_uri={urllib.parse.quote(YOUTUBE_REDIRECT_URI)}&"
        "response_type=code&"
        f"scope={urllib.parse.quote(' '.join(scopes))}&"
        f"state={state}&"
        "access_type=offline&"
        "prompt=consent"
    )
    
    return {"authorization_url": auth_url}


@router.get("/youtube/callback")
async def youtube_callback(
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None
):
    """YouTube OAuth callback handler"""
    if error:
        return RedirectResponse(url=f"{FRONTEND_URL}/dashboard/inbox?error={error}")
    
    if not code or not state:
        return RedirectResponse(url=f"{FRONTEND_URL}/dashboard/inbox?error=missing_params")
    
    try:
        import httpx
        
        user_id = state.split(":")[0]
        
        async with httpx.AsyncClient() as client:
            # Exchange code for tokens
            token_response = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "code": code,
                    "redirect_uri": YOUTUBE_REDIRECT_URI,
                    "grant_type": "authorization_code"
                }
            )
            
            if token_response.status_code != 200:
                print(f"Token exchange failed: {token_response.text}")
                return RedirectResponse(url=f"{FRONTEND_URL}/dashboard/inbox?error=token_exchange_failed")
            
            tokens = token_response.json()
            
            # Get user email
            userinfo_response = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {tokens['access_token']}"}
            )
            user_info = userinfo_response.json()
            account_email = user_info.get("email")
            
            # Get YouTube channel info
            channel_response = await client.get(
                "https://www.googleapis.com/youtube/v3/channels",
                params={"part": "snippet", "mine": "true"},
                headers={"Authorization": f"Bearer {tokens['access_token']}"}
            )
            
            channel_data = channel_response.json()
            channel_name = None
            if channel_data.get("items"):
                channel_name = channel_data["items"][0]["snippet"]["title"]
        
        # Save integration
        supabase = get_supabase_admin()
        expires_at = datetime.utcnow() + timedelta(seconds=tokens.get("expires_in", 3600))
        
        integration_data = {
            "user_id": user_id,
            "provider": "youtube",
            "access_token": tokens["access_token"],
            "refresh_token": tokens.get("refresh_token"),
            "token_expires_at": expires_at.isoformat(),
            "account_email": account_email,
            "account_name": channel_name,
            "is_active": True
        }
        
        supabase.table("integrations").upsert(
            integration_data,
            on_conflict="user_id,provider"
        ).execute()
        
        return RedirectResponse(url=f"{FRONTEND_URL}/dashboard/inbox?success=youtube")
        
    except Exception as e:
        print(f"YouTube callback error: {e}")
        return RedirectResponse(url=f"{FRONTEND_URL}/dashboard/inbox?error=callback_failed")


@router.get("/youtube/status")
async def youtube_status(current_user: dict = Depends(get_current_user)):
    """Check YouTube connection status"""
    supabase = get_supabase_admin()
    
    integration = supabase.table("integrations").select(
        "id, account_name, account_email, is_active, last_sync_at"
    ).eq("user_id", current_user["id"]).eq("provider", "youtube").single().execute()
    
    if not integration.data:
        return {"connected": False}
    
    return {
        "connected": True,
        "channel_name": integration.data.get("account_name"),
        "account_email": integration.data.get("account_email"),
        "last_sync_at": integration.data.get("last_sync_at")
    }


@router.delete("/youtube/disconnect", response_model=SuccessResponse)
async def disconnect_youtube(current_user: dict = Depends(get_current_user)):
    """Disconnect YouTube account"""
    supabase = get_supabase_admin()
    
    result = supabase.table("integrations").delete().eq(
        "user_id", current_user["id"]
    ).eq("provider", "youtube").execute()
    
    return SuccessResponse(message="YouTube disconnected successfully")


@router.get("/youtube/videos")
async def list_youtube_videos(
    current_user: dict = Depends(get_current_user),
    max_results: int = 50,
    published_after: Optional[str] = None,
    published_before: Optional[str] = None
):
    """List videos from user's YouTube channel with optional date filtering
    
    Args:
        max_results: Maximum number of videos to return (default 50)
        published_after: ISO date string - only videos published after this date
        published_before: ISO date string - only videos published before this date
    """
    supabase = get_supabase_admin()
    
    integration = supabase.table("integrations").select("*").eq(
        "user_id", current_user["id"]
    ).eq("provider", "youtube").single().execute()
    
    if not integration.data:
        raise HTTPException(status_code=404, detail="YouTube not connected")
    
    access_token = integration.data.get("access_token")
    
    # Check if token needs refresh
    token_expires = integration.data.get("token_expires_at")
    if token_expires:
        try:
            expires_at = datetime.fromisoformat(token_expires.replace("Z", "+00:00"))
            if expires_at < datetime.now(expires_at.tzinfo):
                access_token = await refresh_youtube_token(
                    integration.data.get("refresh_token"),
                    current_user["id"],
                    supabase
                )
        except:
            pass
    
    try:
        import httpx
        
        async with httpx.AsyncClient() as client:
            # Get channel's uploads playlist
            channel_response = await client.get(
                "https://www.googleapis.com/youtube/v3/channels",
                params={"part": "contentDetails", "mine": "true"},
                headers={"Authorization": f"Bearer {access_token}"}
            )
            
            if channel_response.status_code == 401:
                # Token expired, try refresh
                access_token = await refresh_youtube_token(
                    integration.data.get("refresh_token"),
                    current_user["id"],
                    supabase
                )
                channel_response = await client.get(
                    "https://www.googleapis.com/youtube/v3/channels",
                    params={"part": "contentDetails", "mine": "true"},
                    headers={"Authorization": f"Bearer {access_token}"}
                )
            
            if channel_response.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to fetch channel info")
            
            channel_data = channel_response.json()
            if not channel_data.get("items"):
                return {"videos": [], "channel_name": integration.data.get("account_name")}
            
            uploads_playlist_id = channel_data["items"][0]["contentDetails"]["relatedPlaylists"]["uploads"]
            
            # Get videos
            videos_response = await client.get(
                "https://www.googleapis.com/youtube/v3/playlistItems",
                params={
                    "part": "snippet,contentDetails",
                    "playlistId": uploads_playlist_id,
                    "maxResults": max_results
                },
                headers={"Authorization": f"Bearer {access_token}"}
            )
            
            if videos_response.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to fetch videos")
            
            videos_data = videos_response.json()
            
            videos = []
            for item in videos_data.get("items", []):
                snippet = item["snippet"]
                published_at = snippet["publishedAt"]
                
                # Apply date filters
                if published_after:
                    try:
                        filter_date = datetime.fromisoformat(published_after.replace("Z", "+00:00"))
                        video_date = datetime.fromisoformat(published_at.replace("Z", "+00:00"))
                        if video_date < filter_date:
                            continue
                    except:
                        pass
                
                if published_before:
                    try:
                        filter_date = datetime.fromisoformat(published_before.replace("Z", "+00:00"))
                        video_date = datetime.fromisoformat(published_at.replace("Z", "+00:00"))
                        if video_date > filter_date:
                            continue
                    except:
                        pass
                
                description = snippet.get("description", "")
                videos.append({
                    "video_id": snippet["resourceId"]["videoId"],
                    "title": snippet["title"],
                    "description": description[:150] + "..." if len(description) > 150 else description,
                    "thumbnail": snippet["thumbnails"].get("medium", {}).get("url") or snippet["thumbnails"].get("default", {}).get("url"),
                    "published_at": published_at
                })
            
            return {
                "videos": videos,
                "channel_name": integration.data.get("account_name")
            }
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching videos: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch videos: {str(e)}")


@router.post("/youtube/import")
async def import_youtube_comments(
    request: YouTubeImportRequest,
    current_user: dict = Depends(get_current_user)
):
    """Import comments from selected YouTube videos"""
    if not request.video_ids:
        raise HTTPException(status_code=400, detail="No videos selected")
    
    supabase = get_supabase_admin()
    
    integration = supabase.table("integrations").select("*").eq(
        "user_id", current_user["id"]
    ).eq("provider", "youtube").single().execute()
    
    if not integration.data:
        raise HTTPException(status_code=404, detail="YouTube not connected")
    
    access_token = integration.data.get("access_token")
    
    # Check token expiry
    token_expires = integration.data.get("token_expires_at")
    if token_expires:
        try:
            expires_at = datetime.fromisoformat(token_expires.replace("Z", "+00:00"))
            if expires_at < datetime.now(expires_at.tzinfo):
                access_token = await refresh_youtube_token(
                    integration.data.get("refresh_token"),
                    current_user["id"],
                    supabase
                )
        except:
            pass
    
    try:
        import httpx
        
        # Create import record
        import_record = supabase.table("imports").insert({
            "user_id": current_user["id"],
            "name": request.import_name,
            "platform": "youtube",
            "comment_count": 0
        }).execute()
        
        if not import_record.data:
            raise HTTPException(status_code=500, detail="Failed to create import record")
        
        import_id = import_record.data[0]["id"]
        all_comments = []
        
        async with httpx.AsyncClient() as client:
            for video_id in request.video_ids:
                next_page_token = None
                
                while True:
                    params = {
                        "part": "snippet",
                        "videoId": video_id,
                        "maxResults": 100,
                        "textFormat": "plainText"
                    }
                    if next_page_token:
                        params["pageToken"] = next_page_token
                    
                    comments_response = await client.get(
                        "https://www.googleapis.com/youtube/v3/commentThreads",
                        params=params,
                        headers={"Authorization": f"Bearer {access_token}"}
                    )
                    
                    if comments_response.status_code != 200:
                        print(f"Failed to fetch comments for video {video_id}: {comments_response.text}")
                        break
                    
                    comments_data = comments_response.json()
                    
                    for item in comments_data.get("items", []):
                        comment = item["snippet"]["topLevelComment"]["snippet"]
                        all_comments.append({
                            "user_id": current_user["id"],
                            "import_id": import_id,
                            "content": comment["textDisplay"],
                            "platform": "youtube",
                            "author_name": comment.get("authorDisplayName"),
                            "post_url": f"https://youtube.com/watch?v={video_id}",
                            "is_processed": False,
                            "original_date": comment.get("publishedAt")
                        })
                    
                    next_page_token = comments_data.get("nextPageToken")
                    if not next_page_token or len(all_comments) >= 500:
                        break
                
                if len(all_comments) >= 500:
                    break
        
        # Insert comments in batches
        if all_comments:
            for i in range(0, len(all_comments), 100):
                batch = all_comments[i:i+100]
                supabase.table("comments").insert(batch).execute()
            
            supabase.table("imports").update({
                "comment_count": len(all_comments)
            }).eq("id", import_id).execute()
        
        # Update last_sync
        supabase.table("integrations").update({
            "last_sync_at": datetime.utcnow().isoformat()
        }).eq("user_id", current_user["id"]).eq("provider", "youtube").execute()
        
        return {
            "success": True,
            "import_id": import_id,
            "comments_imported": len(all_comments),
            "videos_processed": len(request.video_ids)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error importing comments: {e}")
        # Cleanup failed import
        supabase.table("imports").delete().eq("id", import_id).execute()
        raise HTTPException(status_code=500, detail=f"Failed to import comments: {str(e)}")


async def refresh_youtube_token(refresh_token: str, user_id: str, supabase) -> str:
    """Refresh YouTube access token"""
    import httpx
    
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token. Please reconnect YouTube.")
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token"
            }
        )
        
        if response.status_code != 200:
            raise HTTPException(status_code=401, detail="Failed to refresh token. Please reconnect YouTube.")
        
        tokens = response.json()
        new_access_token = tokens["access_token"]
        expires_at = datetime.utcnow() + timedelta(seconds=tokens.get("expires_in", 3600))
        
        supabase.table("integrations").update({
            "access_token": new_access_token,
            "token_expires_at": expires_at.isoformat()
        }).eq("user_id", user_id).eq("provider", "youtube").execute()
        
        return new_access_token


# ============================================
# Instagram OAuth Flow (Placeholder)
# ============================================

@router.get("/instagram/connect")
async def connect_instagram(current_user: dict = Depends(get_current_user)):
    """Initiate Instagram OAuth flow (requires Meta App Review)"""
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Instagram integration coming soon. Use CSV upload for now."
    )
