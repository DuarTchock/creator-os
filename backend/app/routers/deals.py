"""
Deals router - CRUD operations for brand deals (Brand Deal OS)
"""

from fastapi import APIRouter, HTTPException, Depends, status, Query
from typing import Optional, List
from uuid import UUID
from decimal import Decimal

from app.database import get_supabase
from app.routers.auth import get_current_user
from app.schemas import (
    DealCreate,
    DealUpdate,
    DealResponse,
    DealListResponse,
    DealStats,
    SuccessResponse
)

router = APIRouter()


@router.get("", response_model=DealListResponse)
async def list_deals(
    status: Optional[str] = Query(None, description="Filter by status"),
    category: Optional[str] = Query(None, description="Filter by category"),
    source: Optional[str] = Query(None, description="Filter by source"),
    search: Optional[str] = Query(None, description="Search brand name"),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    """
    List all deals for the current user with optional filters
    """
    try:
        supabase = get_supabase()
        
        # Build query
        query = supabase.table("deals").select("*", count="exact").eq("user_id", current_user["id"])
        
        # Apply filters
        if status:
            query = query.eq("status", status)
        if category:
            query = query.eq("category", category)
        if source:
            query = query.eq("source", source)
        if search:
            query = query.ilike("brand_name", f"%{search}%")
        
        # Pagination
        offset = (page - 1) * per_page
        query = query.order("created_at", desc=True).range(offset, offset + per_page - 1)
        
        response = query.execute()
        
        deals = [DealResponse(**deal) for deal in response.data]
        
        return DealListResponse(
            deals=deals,
            total=response.count or len(deals),
            page=page,
            per_page=per_page
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to list deals: {str(e)}"
        )


@router.get("/stats", response_model=DealStats)
async def get_deal_stats(current_user: dict = Depends(get_current_user)):
    """
    Get deal statistics for the current user
    """
    try:
        supabase = get_supabase()
        
        # Get all deals for stats calculation
        response = supabase.table("deals").select("status, amount").eq("user_id", current_user["id"]).execute()
        
        deals = response.data or []
        
        # Calculate stats
        total_deals = len(deals)
        
        by_status = {}
        pipeline_value = Decimal("0")
        closed_value = Decimal("0")
        deal_amounts = []
        
        for deal in deals:
            # Count by status
            deal_status = deal.get("status", "lead")
            by_status[deal_status] = by_status.get(deal_status, 0) + 1
            
            # Calculate values
            amount = Decimal(str(deal.get("amount") or 0))
            if amount > 0:
                deal_amounts.append(amount)
                
                if deal_status == "closed_won":
                    closed_value += amount
                elif deal_status in ["lead", "outreach", "negotiation"]:
                    pipeline_value += amount
        
        avg_deal_size = sum(deal_amounts) / len(deal_amounts) if deal_amounts else None
        
        return DealStats(
            total_deals=total_deals,
            by_status=by_status,
            pipeline_value=pipeline_value,
            closed_value=closed_value,
            avg_deal_size=avg_deal_size
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to get stats: {str(e)}"
        )


@router.post("", response_model=DealResponse, status_code=status.HTTP_201_CREATED)
async def create_deal(
    deal_data: DealCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Create a new deal
    """
    try:
        supabase = get_supabase()
        
        # Prepare deal data
        deal_dict = deal_data.model_dump()
        deal_dict["user_id"] = current_user["id"]
        
        # Convert deliverables to JSON-serializable format
        if deal_dict.get("deliverables"):
            deal_dict["deliverables"] = [d.model_dump() if hasattr(d, "model_dump") else d for d in deal_dict["deliverables"]]
        
        # Convert amount to string for JSON
        if deal_dict.get("amount"):
            deal_dict["amount"] = str(deal_dict["amount"])
        
        # Convert date to string
        if deal_dict.get("deadline"):
            deal_dict["deadline"] = deal_dict["deadline"].isoformat()
        
        response = supabase.table("deals").insert(deal_dict).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create deal"
            )
        
        return DealResponse(**response.data[0])
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create deal: {str(e)}"
        )


@router.get("/{deal_id}", response_model=DealResponse)
async def get_deal(
    deal_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """
    Get a specific deal by ID
    """
    try:
        supabase = get_supabase()
        
        response = supabase.table("deals").select("*").eq("id", str(deal_id)).eq("user_id", current_user["id"]).single().execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Deal not found"
            )
        
        return DealResponse(**response.data)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to get deal: {str(e)}"
        )


@router.patch("/{deal_id}", response_model=DealResponse)
async def update_deal(
    deal_id: UUID,
    deal_data: DealUpdate,
    current_user: dict = Depends(get_current_user)
):
    """
    Update a deal
    """
    try:
        supabase = get_supabase()
        
        # Check deal exists and belongs to user
        existing = supabase.table("deals").select("id").eq("id", str(deal_id)).eq("user_id", current_user["id"]).single().execute()
        
        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Deal not found"
            )
        
        # Prepare update data (only non-None values)
        update_dict = {k: v for k, v in deal_data.model_dump().items() if v is not None}
        
        if not update_dict:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update"
            )
        
        # Convert deliverables to JSON-serializable format
        if update_dict.get("deliverables"):
            update_dict["deliverables"] = [d.model_dump() if hasattr(d, "model_dump") else d for d in update_dict["deliverables"]]
        
        # Convert amount to string for JSON
        if update_dict.get("amount"):
            update_dict["amount"] = str(update_dict["amount"])
        
        # Convert date to string
        if update_dict.get("deadline"):
            update_dict["deadline"] = update_dict["deadline"].isoformat()
        
        response = supabase.table("deals").update(update_dict).eq("id", str(deal_id)).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to update deal"
            )
        
        return DealResponse(**response.data[0])
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to update deal: {str(e)}"
        )


@router.delete("/{deal_id}", response_model=SuccessResponse)
async def delete_deal(
    deal_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete a deal
    """
    try:
        supabase = get_supabase()
        
        # Check deal exists and belongs to user
        existing = supabase.table("deals").select("id").eq("id", str(deal_id)).eq("user_id", current_user["id"]).single().execute()
        
        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Deal not found"
            )
        
        supabase.table("deals").delete().eq("id", str(deal_id)).execute()
        
        return SuccessResponse(message="Deal deleted successfully")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to delete deal: {str(e)}"
        )


@router.post("/{deal_id}/move", response_model=DealResponse)
async def move_deal(
    deal_id: UUID,
    new_status: str = Query(..., description="New status for the deal"),
    current_user: dict = Depends(get_current_user)
):
    """
    Move a deal to a new status (for Kanban board)
    """
    valid_statuses = ["lead", "outreach", "negotiation", "closed_won", "closed_lost"]
    
    if new_status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
        )
    
    try:
        supabase = get_supabase()
        
        response = supabase.table("deals").update({"status": new_status}).eq("id", str(deal_id)).eq("user_id", current_user["id"]).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Deal not found"
            )
        
        return DealResponse(**response.data[0])
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to move deal: {str(e)}"
        )
