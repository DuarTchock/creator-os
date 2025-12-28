"""
Insights router - AI-generated clusters and content ideas
"""

from fastapi import APIRouter, HTTPException, Depends, status, Query
from typing import Optional, List
from uuid import UUID

from app.database import get_supabase
from app.routers.auth import get_current_user
from app.schemas import (
    ClusterCreate,
    ClusterResponse,
    ClusterListResponse,
    SuccessResponse
)

router = APIRouter()


@router.get("/clusters", response_model=ClusterListResponse)
async def list_clusters(
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    current_user: dict = Depends(get_current_user)
):
    """
    List all clusters for the current user
    """
    try:
        supabase = get_supabase()
        
        query = supabase.table("clusters").select("*", count="exact").eq("user_id", current_user["id"])
        
        if is_active is not None:
            query = query.eq("is_active", is_active)
        
        query = query.order("comment_count", desc=True)
        
        response = query.execute()
        
        clusters = [ClusterResponse(**cluster) for cluster in response.data]
        
        return ClusterListResponse(
            clusters=clusters,
            total=response.count or len(clusters)
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to list clusters: {str(e)}"
        )


@router.get("/clusters/{cluster_id}", response_model=ClusterResponse)
async def get_cluster(
    cluster_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """
    Get a specific cluster by ID
    """
    try:
        supabase = get_supabase()
        
        response = supabase.table("clusters").select("*").eq("id", str(cluster_id)).eq("user_id", current_user["id"]).single().execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cluster not found"
            )
        
        return ClusterResponse(**response.data)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to get cluster: {str(e)}"
        )


@router.get("/clusters/{cluster_id}/comments")
async def get_cluster_comments(
    cluster_id: UUID,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    """
    Get all comments in a specific cluster
    """
    try:
        supabase = get_supabase()
        
        # Verify cluster belongs to user
        cluster = supabase.table("clusters").select("id").eq("id", str(cluster_id)).eq("user_id", current_user["id"]).single().execute()
        
        if not cluster.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cluster not found"
            )
        
        # Get comments
        offset = (page - 1) * per_page
        response = supabase.table("comments").select("*", count="exact").eq("cluster_id", str(cluster_id)).order("created_at", desc=True).range(offset, offset + per_page - 1).execute()
        
        return {
            "comments": response.data,
            "total": response.count or len(response.data),
            "page": page,
            "per_page": per_page
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to get cluster comments: {str(e)}"
        )


@router.delete("/clusters/{cluster_id}", response_model=SuccessResponse)
async def delete_cluster(
    cluster_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete a cluster (comments will have cluster_id set to null)
    """
    try:
        supabase = get_supabase()
        
        # Check cluster exists and belongs to user
        existing = supabase.table("clusters").select("id").eq("id", str(cluster_id)).eq("user_id", current_user["id"]).single().execute()
        
        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cluster not found"
            )
        
        supabase.table("clusters").delete().eq("id", str(cluster_id)).execute()
        
        return SuccessResponse(message="Cluster deleted successfully")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to delete cluster: {str(e)}"
        )


@router.get("/summary")
async def get_insights_summary(
    days: int = Query(7, ge=1, le=30, description="Number of days to include"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get a summary of insights for the dashboard
    """
    try:
        supabase = get_supabase()
        
        # Get top clusters
        clusters_response = supabase.table("clusters").select("*").eq("user_id", current_user["id"]).eq("is_active", True).order("comment_count", desc=True).limit(5).execute()
        
        # Get comment stats
        comments_response = supabase.table("comments").select("sentiment, is_processed").eq("user_id", current_user["id"]).execute()
        
        comments = comments_response.data or []
        total_comments = len(comments)
        processed_comments = sum(1 for c in comments if c.get("is_processed"))
        
        # Sentiment breakdown
        sentiment_counts = {}
        for comment in comments:
            sentiment = comment.get("sentiment")
            if sentiment:
                sentiment_counts[sentiment] = sentiment_counts.get(sentiment, 0) + 1
        
        # Extract top questions (from clusters)
        top_questions = []
        content_ideas = []
        
        for cluster in clusters_response.data or []:
            # Add theme as a question if it looks like one
            theme = cluster.get("theme", "")
            if "?" in theme or theme.lower().startswith(("how", "what", "why", "when", "where", "who", "can", "do", "is")):
                top_questions.append({
                    "question": theme,
                    "count": cluster.get("comment_count", 0)
                })
            
            # Add content ideas from cluster
            ideas = cluster.get("content_ideas", [])
            for idea in ideas[:2]:  # Max 2 ideas per cluster
                content_ideas.append(idea)
        
        return {
            "total_comments": total_comments,
            "processed_comments": processed_comments,
            "clusters_count": len(clusters_response.data or []),
            "top_clusters": [ClusterResponse(**c) for c in clusters_response.data or []],
            "top_questions": top_questions[:5],
            "content_ideas": content_ideas[:10],
            "sentiment_breakdown": sentiment_counts
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to get insights summary: {str(e)}"
        )
