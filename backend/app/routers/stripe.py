"""
Stripe router - Subscription management and webhooks
"""

from fastapi import APIRouter, HTTPException, Depends, Request, status
from fastapi.responses import RedirectResponse
import stripe
import os
from datetime import datetime

from app.database import get_supabase_admin
from app.routers.auth import get_current_user

router = APIRouter()

# Stripe configuration
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
STRIPE_PRICE_ID = os.getenv("STRIPE_PRICE_ID")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")


@router.post("/create-checkout-session")
async def create_checkout_session(current_user: dict = Depends(get_current_user)):
    """Create a Stripe Checkout session for subscription"""
    user_id = current_user["id"]
    user_email = current_user.get("email", "")
    
    try:
        # Check if user already has a Stripe customer ID
        supabase = get_supabase_admin()
        profile = supabase.table("profiles").select("stripe_customer_id").eq("id", user_id).single().execute()
        
        customer_id = profile.data.get("stripe_customer_id") if profile.data else None
        
        # Create or retrieve customer
        if not customer_id:
            customer = stripe.Customer.create(
                email=user_email,
                metadata={"user_id": user_id}
            )
            customer_id = customer.id
            
            # Save customer ID to profile
            supabase.table("profiles").update({"stripe_customer_id": customer_id}).eq("id", user_id).execute()
        
        # Create checkout session
        checkout_session = stripe.checkout.Session.create(
            customer=customer_id,
            payment_method_types=["card"],
            line_items=[{
                "price": STRIPE_PRICE_ID,
                "quantity": 1
            }],
            mode="subscription",
            success_url=f"{FRONTEND_URL}/dashboard?subscription=success",
            cancel_url=f"{FRONTEND_URL}/dashboard?subscription=cancelled",
            metadata={"user_id": user_id},
            subscription_data={
                "trial_period_days": 14,
                "metadata": {"user_id": user_id}
            }
        )
        
        return {"checkout_url": checkout_session.url}
        
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create checkout: {str(e)}")


@router.post("/create-portal-session")
async def create_portal_session(current_user: dict = Depends(get_current_user)):
    """Create a Stripe Customer Portal session for managing subscription"""
    user_id = current_user["id"]
    
    try:
        supabase = get_supabase_admin()
        profile = supabase.table("profiles").select("stripe_customer_id").eq("id", user_id).single().execute()
        
        customer_id = profile.data.get("stripe_customer_id") if profile.data else None
        
        if not customer_id:
            raise HTTPException(status_code=400, detail="No subscription found")
        
        portal_session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=f"{FRONTEND_URL}/dashboard/settings"
        )
        
        return {"portal_url": portal_session.url}
        
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/subscription-status")
async def get_subscription_status(current_user: dict = Depends(get_current_user)):
    """Get current user's subscription status"""
    user_id = current_user["id"]
    
    try:
        supabase = get_supabase_admin()
        profile = supabase.table("profiles").select(
            "stripe_customer_id, subscription_status, subscription_tier, trial_ends_at"
        ).eq("id", user_id).single().execute()
        
        if not profile.data:
            return {
                "status": "none",
                "tier": "free",
                "trial_ends_at": None,
                "is_active": False
            }
        
        data = profile.data
        is_active = data.get("subscription_status") in ["active", "trialing"]
        
        return {
            "status": data.get("subscription_status", "none"),
            "tier": data.get("subscription_tier", "free"),
            "trial_ends_at": data.get("trial_ends_at"),
            "is_active": is_active
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get status: {str(e)}")


@router.post("/webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks"""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")
    
    try:
        if webhook_secret:
            event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
        else:
            event = stripe.Event.construct_from(
                stripe.util.json.loads(payload), stripe.api_key
            )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    supabase = get_supabase_admin()
    
    # Handle subscription events
    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        user_id = session.get("metadata", {}).get("user_id")
        
        if user_id:
            supabase.table("profiles").update({
                "subscription_status": "trialing",
                "subscription_tier": "pro",
                "trial_ends_at": datetime.utcnow().isoformat()
            }).eq("id", user_id).execute()
    
    elif event["type"] == "customer.subscription.updated":
        subscription = event["data"]["object"]
        customer_id = subscription["customer"]
        status = subscription["status"]
        
        # Find user by customer ID
        profile = supabase.table("profiles").select("id").eq("stripe_customer_id", customer_id).single().execute()
        
        if profile.data:
            supabase.table("profiles").update({
                "subscription_status": status,
                "subscription_tier": "pro" if status in ["active", "trialing"] else "free"
            }).eq("id", profile.data["id"]).execute()
    
    elif event["type"] == "customer.subscription.deleted":
        subscription = event["data"]["object"]
        customer_id = subscription["customer"]
        
        profile = supabase.table("profiles").select("id").eq("stripe_customer_id", customer_id).single().execute()
        
        if profile.data:
            supabase.table("profiles").update({
                "subscription_status": "cancelled",
                "subscription_tier": "free"
            }).eq("id", profile.data["id"]).execute()
    
    return {"status": "success"}


@router.get("/trial-status")
async def get_trial_status(current_user: dict = Depends(get_current_user)):
    """Get user's trial status including days remaining"""
    from app.middleware.subscription import check_subscription
    
    user_id = current_user["id"]
    result = await check_subscription(user_id)
    
    return result
