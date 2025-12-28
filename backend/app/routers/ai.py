"""
AI router - Pitch generation and comment clustering using Groq (Llama 3.3)
Uses admin client with manual user_id filtering for security
Requires active subscription or free trial
"""

from fastapi import APIRouter, HTTPException, Depends, status, BackgroundTasks
from typing import Optional, List
from uuid import UUID
from decimal import Decimal
from datetime import datetime
import os
import json
from collections import Counter

from app.database import get_supabase_admin
from app.routers.auth import get_current_user
from app.middleware.subscription import check_subscription
from app.schemas import (
    PitchGenerateRequest,
    PitchGenerateResponse,
    ClusterAnalysisRequest,
    ClusterAnalysisResponse,
    InsightBriefRequest,
    InsightBriefResponse,
    ClusterResponse,
    ContentIdea,
    SuccessResponse
)

router = APIRouter()

GROQ_MODEL = "llama-3.3-70b-versatile"


def get_groq_api_key() -> str:
    return os.getenv("GROQ_API_KEY", "")


async def verify_subscription(current_user: dict = Depends(get_current_user)):
    """Verify user has active subscription or is in trial"""
    user_id = current_user["id"]
    result = await check_subscription(user_id)
    
    if not result["has_access"]:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "error": "subscription_required",
                "message": result.get("message", "Your 7-day free trial has expired. Please upgrade to continue."),
                "upgrade_url": "/pricing"
            }
        )
    
    return current_user


async def call_groq(prompt: str, system_prompt: str = None, max_tokens: int = 2000) -> str:
    groq_api_key = get_groq_api_key()
    
    if not groq_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service not configured. Please set GROQ_API_KEY."
        )
    
    try:
        import httpx
        
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {groq_api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": GROQ_MODEL,
                    "messages": messages,
                    "max_tokens": max_tokens,
                    "temperature": 0.7
                }
            )
            
            if response.status_code != 200:
                print(f"Groq Error: {response.text}")
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=f"AI service error: {response.text}"
                )
            
            result = response.json()
            return result["choices"][0]["message"]["content"]
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail="AI timeout")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"AI error: {str(e)}")


@router.post("/generate-pitch", response_model=PitchGenerateResponse)
async def generate_pitch(request: PitchGenerateRequest, current_user: dict = Depends(verify_subscription)):
    user_id = current_user["id"]
    supabase = get_supabase_admin()
    
    creator_name = request.creator_name
    if not creator_name:
        profile = supabase.table("profiles").select("full_name").eq("id", user_id).single().execute()
        creator_name = profile.data.get("full_name", "Creator") if profile.data else "Creator"
    
    tone_instructions = {
        "professional": "Write in a professional, business-like tone.",
        "friendly": "Write in a friendly, warm, and approachable tone.",
        "enthusiastic": "Write with enthusiasm and energy.",
        "concise": "Keep it brief, maximum 150 words."
    }
    tone_instruction = tone_instructions.get(request.tone, tone_instructions["professional"])
    
    system_prompt = f"""You are an expert at writing brand deal pitch emails for social media influencers. 
{tone_instruction}
Write the email directly without any JSON formatting."""

    prompt = f"""Write a brand deal pitch email:
Brand: {request.brand_name}
Category: {request.brand_category or "Not specified"}
Creator: {creator_name}
Niche: {request.creator_niche or "Lifestyle"}
Followers: {request.follower_count or "Not specified"}
Value: {request.unique_value or "Engaging content"}

Write a compelling pitch email."""

    try:
        response_text = await call_groq(prompt, system_prompt)
        return PitchGenerateResponse(
            pitch=response_text,
            subject_line=f"Partnership Opportunity - {creator_name}",
            key_points=["AI-generated pitch ready"],
            suggested_rate=request.deal_amount,
            confidence_score=0.85
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed: {str(e)}")


@router.get("/clusters-with-stats")
async def get_clusters_with_stats(
    platform: Optional[str] = None,
    import_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Get clusters with detailed statistics for intelligent filtering.
    
    - If platform filter is applied: returns only clusters with comments from that platform,
      with filtered_comment_count showing only comments from that platform.
    - If import_id filter is applied: returns only clusters with comments from that import.
    """
    user_id = current_user["id"]
    supabase = get_supabase_admin()
    
    try:
        # Get all active clusters for the user
        clusters_response = supabase.table("clusters")\
            .select("id, theme, summary, sample_comments, content_ideas, created_at, platforms, import_ids")\
            .eq("user_id", user_id)\
            .eq("is_active", True)\
            .execute()
        
        clusters_data = clusters_response.data or []
        
        # Get available imports (always needed for meta)
        imports_response = supabase.table("imports")\
            .select("id, name, platform, comment_count")\
            .eq("user_id", user_id)\
            .order("created_at", desc=True)\
            .execute()
        
        available_imports = imports_response.data or []
        
        if not clusters_data:
            return {
                "clusters": [],
                "meta": {
                    "total_clusters": 0,
                    "filter_applied": {
                        "platform": platform,
                        "import_id": import_id
                    },
                    "available_platforms": [],
                    "available_imports": available_imports
                }
            }
        
        # Get platform breakdown for each cluster from cluster_comments
        cluster_ids = [c["id"] for c in clusters_data]
        
        # Get all cluster_comments relationships
        cc_response = supabase.table("cluster_comments")\
            .select("cluster_id, comment_id")\
            .in_("cluster_id", cluster_ids)\
            .execute()
        
        cluster_comments_map = {}  # cluster_id -> [comment_ids]
        for cc in (cc_response.data or []):
            cid = cc["cluster_id"]
            if cid not in cluster_comments_map:
                cluster_comments_map[cid] = []
            cluster_comments_map[cid].append(cc["comment_id"])
        
        # Get all relevant comments with platform and import_id
        all_comment_ids = []
        for cids in cluster_comments_map.values():
            all_comment_ids.extend(cids)
        
        if all_comment_ids:
            comments_response = supabase.table("comments")\
                .select("id, platform, import_id")\
                .in_("id", all_comment_ids)\
                .execute()
            comments_data = comments_response.data or []
        else:
            comments_data = []
        
        comments_lookup = {c["id"]: c for c in comments_data}
        
        # Build platform breakdown per cluster
        cluster_breakdowns = {}  # cluster_id -> {platforms: {}, import_ids: set}
        all_platforms_set = set()
        
        for cluster_id, comment_ids in cluster_comments_map.items():
            breakdown = {"platforms": {}, "import_ids": set()}
            for comment_id in comment_ids:
                comment = comments_lookup.get(comment_id)
                if comment:
                    plat = comment.get("platform", "other")
                    breakdown["platforms"][plat] = breakdown["platforms"].get(plat, 0) + 1
                    all_platforms_set.add(plat)
                    if comment.get("import_id"):
                        breakdown["import_ids"].add(comment["import_id"])
            cluster_breakdowns[cluster_id] = breakdown
        
        # Build response clusters with filtering
        result_clusters = []
        
        for cluster in clusters_data:
            cluster_id = cluster["id"]
            breakdown = cluster_breakdowns.get(cluster_id, {"platforms": {}, "import_ids": set()})
            
            platform_breakdown = breakdown["platforms"]
            cluster_import_ids = list(breakdown["import_ids"])
            
            total_count = sum(platform_breakdown.values())
            
            # Apply platform filter
            if platform:
                filtered_count = platform_breakdown.get(platform, 0)
                if filtered_count == 0:
                    continue  # Skip clusters with no comments from this platform
                display_platforms = [platform]
            else:
                filtered_count = total_count
                display_platforms = list(platform_breakdown.keys())
            
            # Apply import_id filter
            if import_id:
                if import_id not in cluster_import_ids:
                    continue  # Skip clusters with no comments from this import
                # Recalculate filtered_count for this specific import
                # We need to count comments from this import only
                import_comment_count = 0
                for comment_id in cluster_comments_map.get(cluster_id, []):
                    comment = comments_lookup.get(comment_id)
                    if comment and comment.get("import_id") == import_id:
                        import_comment_count += 1
                filtered_count = import_comment_count
            
            result_clusters.append({
                "id": cluster_id,
                "theme": cluster["theme"],
                "summary": cluster.get("summary"),
                "sample_comments": cluster.get("sample_comments", []),
                "content_ideas": cluster.get("content_ideas", []),
                "created_at": cluster["created_at"],
                "total_comment_count": total_count,
                "platform_breakdown": platform_breakdown,
                "filtered_comment_count": filtered_count,
                "platforms": display_platforms,
                "import_ids": cluster_import_ids
            })
        
        # Sort by filtered_comment_count descending
        result_clusters.sort(key=lambda x: x["filtered_comment_count"], reverse=True)
        
        return {
            "clusters": result_clusters,
            "meta": {
                "total_clusters": len(result_clusters),
                "filter_applied": {
                    "platform": platform,
                    "import_id": import_id
                },
                "available_platforms": sorted(list(all_platforms_set)),
                "available_imports": available_imports
            }
        }
        
    except Exception as e:
        print(f"Error in clusters-with-stats: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch clusters: {str(e)}")


@router.post("/cluster-comments", response_model=ClusterAnalysisResponse)
async def cluster_comments(request: ClusterAnalysisRequest, background_tasks: BackgroundTasks, current_user: dict = Depends(verify_subscription)):
    user_id = current_user["id"]
    supabase = get_supabase_admin()
    
    try:
        # Fetch comments with platform and import_id for filtering support
        query = supabase.table("comments").select("id, content, platform, import_id").eq("user_id", user_id)
        
        if request.comment_ids:
            query = query.in_("id", [str(id) for id in request.comment_ids])
        else:
            query = query.eq("is_processed", False)
        
        response = query.limit(500).execute()
        comments = response.data or []
        
        print(f"Found {len(comments)} comments for user {user_id}")
        
        if len(comments) < request.min_cluster_size:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Not enough comments. Need {request.min_cluster_size}, found {len(comments)}."
            )
        
        # Build comment text for AI with IDs for tracking
        comments_for_ai = []
        for i, c in enumerate(comments[:200]):
            comments_for_ai.append(f"[{i}] {c['content']}")
        comments_text = "\n".join(comments_for_ai)
        
        system_prompt = """You are an expert at analyzing audience feedback for content creators.
Group similar comments and provide actionable insights.
IMPORTANT: In sample_comment_indices, return the numeric indices [0], [1], etc. of the comments that belong to each cluster."""

        prompt = f"""Analyze these comments and group into {request.num_clusters} themes:

{comments_text}

Respond in JSON format:
{{"clusters": [
  {{
    "theme": "Theme Name",
    "summary": "Brief summary of what viewers are asking about",
    "sample_comment_indices": [0, 1, 2],
    "content_ideas": [
      {{"title": "Video Title Idea", "description": "Description", "content_type": "video"}}
    ]
  }}
]}}

Make sure sample_comment_indices contains the [N] numbers from the comments above."""

        response_text = await call_groq(prompt, system_prompt, max_tokens=3000)
        
        # Parse AI response
        try:
            cleaned = response_text.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("```")[1]
                if cleaned.startswith("json"):
                    cleaned = cleaned[4:]
            cleaned = cleaned.strip()
            result = json.loads(cleaned)
            clusters_data = result.get("clusters", [])
        except json.JSONDecodeError as e:
            print(f"JSON Parse Error: {e}")
            print(f"Response was: {response_text[:500]}")
            raise HTTPException(status_code=500, detail="Failed to parse AI response")
        
        created_clusters = []
        
        for cluster_data in clusters_data:
            # Get comment indices from AI response
            comment_indices = cluster_data.get("sample_comment_indices", [])
            
            # Map indices to actual comments
            cluster_comments_list = []
            cluster_comment_ids = []
            cluster_platforms = []
            cluster_import_ids = []
            
            for idx in comment_indices:
                if isinstance(idx, int) and 0 <= idx < len(comments):
                    comment = comments[idx]
                    cluster_comments_list.append(comment["content"])
                    cluster_comment_ids.append(comment["id"])
                    if comment.get("platform"):
                        cluster_platforms.append(comment["platform"])
                    if comment.get("import_id"):
                        cluster_import_ids.append(comment["import_id"])
            
            # If AI didn't return indices, use sample_comments text matching as fallback
            if not cluster_comments_list:
                sample_texts = cluster_data.get("sample_comments", [])
                for sample in sample_texts[:5]:
                    for comment in comments:
                        if sample.lower() in comment["content"].lower() or comment["content"].lower() in sample.lower():
                            cluster_comments_list.append(comment["content"])
                            cluster_comment_ids.append(comment["id"])
                            if comment.get("platform"):
                                cluster_platforms.append(comment["platform"])
                            if comment.get("import_id"):
                                cluster_import_ids.append(comment["import_id"])
                            break
            
            # Determine primary platform (most common)
            primary_platform = None
            unique_platforms = list(set(cluster_platforms))
            if cluster_platforms:
                platform_counts = Counter(cluster_platforms)
                primary_platform = platform_counts.most_common(1)[0][0]
            
            # Get unique import_ids
            unique_import_ids = list(set([str(iid) for iid in cluster_import_ids if iid]))
            
            # Format content ideas
            content_ideas = cluster_data.get("content_ideas", [])
            if content_ideas and isinstance(content_ideas[0], dict):
                content_ideas = [
                    {
                        "title": i.get("title", ""),
                        "description": i.get("description", ""),
                        "content_type": i.get("content_type", "video")
                    } for i in content_ideas
                ]
            
            # Create cluster with platform/import metadata
            cluster_insert = {
                "user_id": user_id,
                "theme": cluster_data.get("theme", "Theme"),
                "summary": cluster_data.get("summary", ""),
                "sample_comments": cluster_comments_list[:5],
                "content_ideas": content_ideas,
                "comment_count": len(cluster_comment_ids) if cluster_comment_ids else len(cluster_data.get("sample_comments", [])),
                "is_active": True,
                "primary_platform": primary_platform,
                "platforms": unique_platforms,
                "import_ids": unique_import_ids
            }
            
            insert_response = supabase.table("clusters").insert(cluster_insert).execute()
            
            if insert_response.data:
                cluster_id = insert_response.data[0]["id"]
                
                # Create cluster_comments relationships
                if cluster_comment_ids:
                    cluster_comment_relations = [
                        {"cluster_id": cluster_id, "comment_id": cid}
                        for cid in cluster_comment_ids
                    ]
                    try:
                        supabase.table("cluster_comments").insert(cluster_comment_relations).execute()
                    except Exception as e:
                        print(f"Warning: Failed to insert cluster_comments: {e}")
                
                # Update comments with cluster_id
                if cluster_comment_ids:
                    try:
                        supabase.table("comments").update({"cluster_id": cluster_id}).in_("id", cluster_comment_ids).execute()
                    except Exception as e:
                        print(f"Warning: Failed to update comments with cluster_id: {e}")
                
                created_clusters.append(ClusterResponse(
                    id=insert_response.data[0]["id"],
                    user_id=insert_response.data[0]["user_id"],
                    theme=insert_response.data[0]["theme"],
                    summary=insert_response.data[0].get("summary"),
                    comment_count=insert_response.data[0]["comment_count"],
                    sample_comments=insert_response.data[0].get("sample_comments", []),
                    content_ideas=insert_response.data[0].get("content_ideas", []),
                    is_active=insert_response.data[0]["is_active"],
                    created_at=insert_response.data[0]["created_at"],
                    updated_at=insert_response.data[0].get("updated_at", insert_response.data[0]["created_at"])
                ))
        
        # Mark all fetched comments as processed
        comment_ids = [c["id"] for c in comments]
        supabase.table("comments").update({"is_processed": True}).in_("id", comment_ids).execute()
        
        return ClusterAnalysisResponse(
            clusters_created=len(created_clusters),
            comments_processed=len(comments),
            clusters=created_clusters
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Cluster error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed: {str(e)}")


@router.post("/generate-brief", response_model=InsightBriefResponse)
async def generate_insight_brief(request: InsightBriefRequest, current_user: dict = Depends(verify_subscription)):
    user_id = current_user["id"]
    supabase = get_supabase_admin()
    
    try:
        brief_data = {"deals": [], "clusters": [], "comment_count": 0}
        
        if request.include_deals:
            deals_response = supabase.table("deals").select("brand_name, status, amount, category").eq("user_id", user_id).limit(10).execute()
            brief_data["deals"] = deals_response.data or []
        
        if request.include_comments:
            clusters_response = supabase.table("clusters").select("theme, summary, comment_count").eq("user_id", user_id).eq("is_active", True).limit(5).execute()
            brief_data["clusters"] = clusters_response.data or []
            
            comments_response = supabase.table("comments").select("id", count="exact").eq("user_id", user_id).execute()
            brief_data["comment_count"] = comments_response.count or 0
        
        prompt = f"""Generate insight brief:
Deals: {json.dumps(brief_data['deals'])}
Themes: {json.dumps(brief_data['clusters'])}

Respond in JSON:
{{"summary": "string", "top_questions": ["string"], "content_ideas": [{{"title": "string", "description": "string", "content_type": "video", "priority": 1}}], "deal_highlights": ["string"], "action_items": ["string"]}}"""

        response_text = await call_groq(prompt, max_tokens=2000)
        
        try:
            cleaned = response_text.strip()
            if "```" in cleaned:
                cleaned = cleaned.split("```")[1].replace("json", "").strip()
            result = json.loads(cleaned)
            
            content_ideas = [ContentIdea(title=i.get("title", ""), description=i.get("description", ""), content_type=i.get("content_type", "video"), priority=i.get("priority", 3)) for i in result.get("content_ideas", [])]
            
            return InsightBriefResponse(
                summary=result.get("summary", "Brief ready."),
                top_questions=result.get("top_questions", []),
                content_ideas=content_ideas,
                deal_highlights=result.get("deal_highlights", []),
                action_items=result.get("action_items", []),
                generated_at=datetime.utcnow()
            )
        except:
            return InsightBriefResponse(summary=response_text[:500], top_questions=[], content_ideas=[], deal_highlights=[], action_items=[], generated_at=datetime.utcnow())
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed: {str(e)}")


@router.post("/analyze-sentiment")
async def analyze_sentiment(comment_ids: List[UUID], current_user: dict = Depends(verify_subscription)):
    user_id = current_user["id"]
    supabase = get_supabase_admin()
    
    try:
        response = supabase.table("comments").select("id, content").eq("user_id", user_id).in_("id", [str(id) for id in comment_ids]).execute()
        comments = response.data or []
        
        if not comments:
            raise HTTPException(status_code=404, detail="No comments found")
        
        comments_text = "\n".join([f"ID:{c['id']} - {c['content']}" for c in comments])
        prompt = f"""Analyze sentiment (positive/negative/neutral/question):
{comments_text}
Respond: {{"sentiments": {{"id": "sentiment"}}}}"""

        response_text = await call_groq(prompt, max_tokens=1000)
        
        try:
            cleaned = response_text.strip()
            if "```" in cleaned:
                cleaned = cleaned.split("```")[1].replace("json", "").strip()
            result = json.loads(cleaned)
            sentiments = result.get("sentiments", {})
            
            for comment_id, sentiment in sentiments.items():
                if sentiment in ["positive", "negative", "neutral", "question"]:
                    supabase.table("comments").update({"sentiment": sentiment}).eq("id", comment_id).eq("user_id", user_id).execute()
            
            return {"updated": len(sentiments), "sentiments": sentiments}
        except:
            raise HTTPException(status_code=500, detail="Failed to parse")
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed: {str(e)}")
