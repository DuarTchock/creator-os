"""
Comments router - CRUD operations for audience comments (Inbox Brain)
"""

from fastapi import APIRouter, HTTPException, Depends, status, Query, UploadFile, File
from typing import Optional, List
from uuid import UUID
import csv
import io
from datetime import datetime

from app.database import get_supabase
from app.routers.auth import get_current_user
from app.schemas import (
    CommentCreate,
    CommentBulkCreate,
    CommentResponse,
    CommentListResponse,
    SuccessResponse
)

router = APIRouter()


@router.get("", response_model=CommentListResponse)
async def list_comments(
    platform: Optional[str] = Query(None, description="Filter by platform"),
    cluster_id: Optional[UUID] = Query(None, description="Filter by cluster"),
    is_processed: Optional[bool] = Query(None, description="Filter by processed status"),
    search: Optional[str] = Query(None, description="Search comment content"),
    page: int = Query(1, ge=1),
    per_page: int = Query(100, ge=1, le=500),
    current_user: dict = Depends(get_current_user)
):
    """
    List all comments for the current user with optional filters
    """
    try:
        supabase = get_supabase()
        
        # Build query
        query = supabase.table("comments").select("*", count="exact").eq("user_id", current_user["id"])
        
        # Apply filters
        if platform:
            query = query.eq("platform", platform)
        if cluster_id:
            query = query.eq("cluster_id", str(cluster_id))
        if is_processed is not None:
            query = query.eq("is_processed", is_processed)
        if search:
            query = query.ilike("content", f"%{search}%")
        
        # Pagination
        offset = (page - 1) * per_page
        query = query.order("created_at", desc=True).range(offset, offset + per_page - 1)
        
        response = query.execute()
        
        comments = [CommentResponse(**comment) for comment in response.data]
        
        return CommentListResponse(
            comments=comments,
            total=response.count or len(comments),
            page=page,
            per_page=per_page
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to list comments: {str(e)}"
        )


@router.post("", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
async def create_comment(
    comment_data: CommentCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Create a single comment
    """
    try:
        supabase = get_supabase()
        
        # Prepare comment data
        comment_dict = comment_data.model_dump()
        comment_dict["user_id"] = current_user["id"]
        
        # Convert datetime to string
        if comment_dict.get("original_date"):
            comment_dict["original_date"] = comment_dict["original_date"].isoformat()
        
        response = supabase.table("comments").insert(comment_dict).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create comment"
            )
        
        return CommentResponse(**response.data[0])
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create comment: {str(e)}"
        )


@router.post("/bulk", response_model=SuccessResponse, status_code=status.HTTP_201_CREATED)
async def create_comments_bulk(
    comments_data: CommentBulkCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Create multiple comments at once (max 1000)
    """
    try:
        supabase = get_supabase()
        
        # Prepare all comments
        comments_list = []
        for comment in comments_data.comments:
            comment_dict = comment.model_dump()
            comment_dict["user_id"] = current_user["id"]
            
            # Convert datetime to string
            if comment_dict.get("original_date"):
                comment_dict["original_date"] = comment_dict["original_date"].isoformat()
            
            comments_list.append(comment_dict)
        
        # Insert in batches of 100
        batch_size = 100
        inserted_count = 0
        
        for i in range(0, len(comments_list), batch_size):
            batch = comments_list[i:i + batch_size]
            response = supabase.table("comments").insert(batch).execute()
            inserted_count += len(response.data) if response.data else 0
        
        return SuccessResponse(message=f"Successfully created {inserted_count} comments")
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create comments: {str(e)}"
        )


@router.post("/upload/csv", response_model=SuccessResponse, status_code=status.HTTP_201_CREATED)
async def upload_comments_csv(
    file: UploadFile = File(..., description="CSV file with comments"),
    platform: str = Query(..., description="Platform source (instagram, youtube, etc.)"),
    current_user: dict = Depends(get_current_user)
):
    """
    Upload comments from a CSV file.
    
    Expected CSV columns:
    - content (required): The comment text
    - author_name (optional): Name of the commenter
    - author_handle (optional): Username/handle of the commenter
    - post_url (optional): URL of the post
    - post_title (optional): Title of the post
    - date (optional): Original comment date (ISO format)
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a CSV"
        )
    
    try:
        # Read CSV content
        content = await file.read()
        decoded = content.decode('utf-8-sig')  # Handle BOM
        reader = csv.DictReader(io.StringIO(decoded))
        
        comments_list = []
        errors = []
        row_num = 0
        
        for row in reader:
            row_num += 1
            
            # Get content (required)
            comment_content = row.get('content', '').strip()
            if not comment_content:
                errors.append(f"Row {row_num}: Missing 'content' field")
                continue
            
            # Parse optional date
            original_date = None
            if row.get('date'):
                try:
                    original_date = datetime.fromisoformat(row['date'].replace('Z', '+00:00'))
                except:
                    pass  # Ignore date parsing errors
            
            comment_dict = {
                "user_id": current_user["id"],
                "platform": platform,
                "content": comment_content,
                "author_name": row.get('author_name', '').strip() or None,
                "author_handle": row.get('author_handle', '').strip() or None,
                "post_url": row.get('post_url', '').strip() or None,
                "post_title": row.get('post_title', '').strip() or None,
                "original_date": original_date.isoformat() if original_date else None
            }
            
            comments_list.append(comment_dict)
        
        if not comments_list:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No valid comments found in CSV. Errors: {errors[:5]}"
            )
        
        # Insert in batches
        supabase = get_supabase()
        batch_size = 100
        inserted_count = 0
        
        for i in range(0, len(comments_list), batch_size):
            batch = comments_list[i:i + batch_size]
            response = supabase.table("comments").insert(batch).execute()
            inserted_count += len(response.data) if response.data else 0
        
        message = f"Successfully imported {inserted_count} comments"
        if errors:
            message += f" ({len(errors)} rows skipped)"
        
        return SuccessResponse(message=message)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to process CSV: {str(e)}"
        )


@router.get("/stats")
async def get_comment_stats(current_user: dict = Depends(get_current_user)):
    """
    Get comment statistics for the current user
    """
    try:
        supabase = get_supabase()
        
        # Get counts by platform
        response = supabase.table("comments").select("platform, sentiment, is_processed").eq("user_id", current_user["id"]).execute()
        
        comments = response.data or []
        
        total = len(comments)
        by_platform = {}
        by_sentiment = {}
        processed = 0
        unprocessed = 0
        
        for comment in comments:
            # Count by platform
            platform = comment.get("platform", "other")
            by_platform[platform] = by_platform.get(platform, 0) + 1
            
            # Count by sentiment
            sentiment = comment.get("sentiment")
            if sentiment:
                by_sentiment[sentiment] = by_sentiment.get(sentiment, 0) + 1
            
            # Count processed
            if comment.get("is_processed"):
                processed += 1
            else:
                unprocessed += 1
        
        return {
            "total": total,
            "by_platform": by_platform,
            "by_sentiment": by_sentiment,
            "processed": processed,
            "unprocessed": unprocessed
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to get stats: {str(e)}"
        )


@router.get("/{comment_id}", response_model=CommentResponse)
async def get_comment(
    comment_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """
    Get a specific comment by ID
    """
    try:
        supabase = get_supabase()
        
        response = supabase.table("comments").select("*").eq("id", str(comment_id)).eq("user_id", current_user["id"]).single().execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Comment not found"
            )
        
        return CommentResponse(**response.data)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to get comment: {str(e)}"
        )


@router.delete("/{comment_id}", response_model=SuccessResponse)
async def delete_comment(
    comment_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete a comment
    """
    try:
        supabase = get_supabase()
        
        # Check comment exists and belongs to user
        existing = supabase.table("comments").select("id").eq("id", str(comment_id)).eq("user_id", current_user["id"]).single().execute()
        
        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Comment not found"
            )
        
        supabase.table("comments").delete().eq("id", str(comment_id)).execute()
        
        return SuccessResponse(message="Comment deleted successfully")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to delete comment: {str(e)}"
        )


@router.delete("", response_model=SuccessResponse)
async def delete_all_comments(
    platform: Optional[str] = Query(None, description="Delete only from specific platform"),
    confirm: bool = Query(..., description="Confirm deletion"),
    current_user: dict = Depends(get_current_user)
):
    """
    Delete all comments (with optional platform filter)
    """
    if not confirm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please confirm deletion by setting confirm=true"
        )
    
    try:
        supabase = get_supabase()
        
        query = supabase.table("comments").delete().eq("user_id", current_user["id"])
        
        if platform:
            query = query.eq("platform", platform)
        
        query.execute()
        
        message = f"All comments deleted"
        if platform:
            message = f"All {platform} comments deleted"
        
        return SuccessResponse(message=message)
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to delete comments: {str(e)}"
        )
