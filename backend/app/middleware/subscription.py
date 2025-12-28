"""
Subscription middleware - Check if user has active subscription or is in trial
"""

from fastapi import HTTPException, status
from datetime import datetime, timedelta
from app.database import get_supabase_admin


async def check_subscription(user_id: str) -> dict:
    """
    Check if user has active subscription or is within free trial.
    Returns subscription status info.
    """
    supabase = get_supabase_admin()
    
    profile = supabase.table("profiles").select(
        "subscription_status, subscription_tier, trial_ends_at, created_at"
    ).eq("id", user_id).single().execute()
    
    if not profile.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found"
        )
    
    data = profile.data
    subscription_status = data.get("subscription_status", "none")
    subscription_tier = data.get("subscription_tier", "free")
    created_at = data.get("created_at")
    
    # Check if user has active paid subscription
    if subscription_status in ["active", "trialing"] and subscription_tier == "pro":
        return {
            "has_access": True,
            "reason": "active_subscription",
            "subscription_status": subscription_status,
            "tier": subscription_tier
        }
    
    # Check if user is within 7-day free trial (from account creation)
    if created_at:
        created_date = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        trial_end_date = created_date + timedelta(days=7)
        now = datetime.now(created_date.tzinfo)
        
        if now < trial_end_date:
            days_left = (trial_end_date - now).days
            return {
                "has_access": True,
                "reason": "free_trial",
                "trial_days_left": days_left,
                "trial_ends_at": trial_end_date.isoformat()
            }
    
    # No access - trial expired and no subscription
    return {
        "has_access": False,
        "reason": "trial_expired",
        "message": "Your 7-day free trial has expired. Please upgrade to continue."
    }
