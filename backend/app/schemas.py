"""
Pydantic schemas for request/response validation
"""

from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, List, Literal
from datetime import datetime, date
from uuid import UUID
from decimal import Decimal


# ============================================
# Auth Schemas
# ============================================

class UserSignUp(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, description="Password must be at least 8 characters")
    full_name: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: UUID
    email: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    subscription_tier: Literal["free", "pro", "agency"] = "free"
    onboarding_completed: bool = False
    created_at: datetime

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    refresh_token: Optional[str] = None
    user: UserResponse

class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None


# ============================================
# Deal Schemas (Brand Deal OS)
# ============================================

DealStatus = Literal["lead", "outreach", "negotiation", "closed_won", "closed_lost"]
DealSource = Literal["manual", "gmail", "instagram", "other"]

class Deliverable(BaseModel):
    type: str  # "reel", "story", "post", "video", etc.
    quantity: int = 1
    description: Optional[str] = None
    due_date: Optional[date] = None
    completed: bool = False

class DealCreate(BaseModel):
    brand_name: str = Field(..., min_length=1, max_length=200)
    brand_email: Optional[EmailStr] = None
    brand_contact: Optional[str] = None
    status: DealStatus = "lead"
    amount: Optional[Decimal] = Field(None, ge=0)
    currency: str = "USD"
    category: Optional[str] = None
    source: DealSource = "manual"
    notes: Optional[str] = None
    deliverables: List[Deliverable] = []
    deadline: Optional[date] = None

class DealUpdate(BaseModel):
    brand_name: Optional[str] = Field(None, min_length=1, max_length=200)
    brand_email: Optional[EmailStr] = None
    brand_contact: Optional[str] = None
    status: Optional[DealStatus] = None
    amount: Optional[Decimal] = Field(None, ge=0)
    currency: Optional[str] = None
    category: Optional[str] = None
    notes: Optional[str] = None
    pitch_draft: Optional[str] = None
    deliverables: Optional[List[Deliverable]] = None
    deadline: Optional[date] = None

class DealResponse(BaseModel):
    id: UUID
    user_id: UUID
    brand_name: str
    brand_email: Optional[str] = None
    brand_contact: Optional[str] = None
    status: DealStatus
    amount: Optional[Decimal] = None
    currency: str
    category: Optional[str] = None
    source: DealSource
    source_email_id: Optional[str] = None
    notes: Optional[str] = None
    pitch_draft: Optional[str] = None
    deliverables: List[Deliverable] = []
    deadline: Optional[date] = None
    created_at: datetime
    updated_at: datetime

class DealListResponse(BaseModel):
    deals: List[DealResponse]
    total: int
    page: int = 1
    per_page: int = 50

class DealStats(BaseModel):
    total_deals: int
    by_status: dict
    pipeline_value: Decimal
    closed_value: Decimal
    avg_deal_size: Optional[Decimal] = None


# ============================================
# Comment Schemas (Inbox Brain)
# ============================================

Platform = Literal["instagram", "youtube", "tiktok", "email", "other"]
Sentiment = Literal["positive", "negative", "neutral", "question"]

class CommentCreate(BaseModel):
    platform: Platform
    content: str = Field(..., min_length=1)
    author_name: Optional[str] = None
    author_handle: Optional[str] = None
    post_url: Optional[str] = None
    post_title: Optional[str] = None
    original_date: Optional[datetime] = None

class CommentBulkCreate(BaseModel):
    comments: List[CommentCreate] = Field(..., max_items=1000)

class CommentResponse(BaseModel):
    id: UUID
    user_id: UUID
    platform: Platform
    content: str
    author_name: Optional[str] = None
    author_handle: Optional[str] = None
    post_url: Optional[str] = None
    post_title: Optional[str] = None
    sentiment: Optional[Sentiment] = None
    cluster_id: Optional[UUID] = None
    is_processed: bool
    original_date: Optional[datetime] = None
    created_at: datetime

class CommentListResponse(BaseModel):
    comments: List[CommentResponse]
    total: int
    page: int = 1
    per_page: int = 100


# ============================================
# Cluster Schemas (AI Insights)
# ============================================

class ContentIdea(BaseModel):
    title: str
    description: Optional[str] = None
    content_type: Optional[str] = None  # "video", "reel", "post", "story"
    priority: Optional[int] = None

class ClusterCreate(BaseModel):
    theme: str
    summary: Optional[str] = None
    sample_comments: List[str] = []
    content_ideas: List[ContentIdea] = []

class ClusterResponse(BaseModel):
    id: UUID
    user_id: UUID
    theme: str
    summary: Optional[str] = None
    comment_count: int
    sample_comments: List[str] = []
    content_ideas: List[ContentIdea] = []
    is_active: bool
    created_at: datetime
    updated_at: datetime

class ClusterListResponse(BaseModel):
    clusters: List[ClusterResponse]
    total: int


# ============================================
# Cluster Stats Schemas (Filtro Inteligente)
# ============================================

class PlatformBreakdown(BaseModel):
    """Comment count per platform for a cluster"""
    instagram: int = 0
    youtube: int = 0
    tiktok: int = 0

class ImportInfo(BaseModel):
    """Import metadata for filters"""
    id: UUID
    name: str
    platform: str
    comment_count: int

class ClusterWithStats(BaseModel):
    """Cluster with detailed statistics for intelligent filtering"""
    id: UUID
    theme: str
    summary: Optional[str] = None
    sample_comments: List[str] = []
    content_ideas: List[ContentIdea] = []
    created_at: datetime
    total_comment_count: int
    platform_breakdown: dict  # {"instagram": 5, "youtube": 3}
    filtered_comment_count: int
    platforms: List[str]  # Platforms to display (filtered)
    import_ids: List[str]

class ClusterStatsResponse(BaseModel):
    """Response for clusters-with-stats endpoint"""
    clusters: List[ClusterWithStats]
    meta: dict  # Contains filter info and available options


# ============================================
# Integration Schemas
# ============================================

Provider = Literal["gmail", "instagram", "youtube", "tiktok"]

class IntegrationCreate(BaseModel):
    provider: Provider
    access_token: str
    refresh_token: Optional[str] = None
    token_expires_at: Optional[datetime] = None
    account_email: Optional[str] = None
    account_name: Optional[str] = None

class IntegrationResponse(BaseModel):
    id: UUID
    user_id: UUID
    provider: Provider
    account_email: Optional[str] = None
    account_name: Optional[str] = None
    is_active: bool
    last_sync_at: Optional[datetime] = None
    created_at: datetime

class IntegrationListResponse(BaseModel):
    integrations: List[IntegrationResponse]


# ============================================
# AI Schemas
# ============================================

class PitchGenerateRequest(BaseModel):
    brand_name: str
    brand_category: Optional[str] = None
    deal_amount: Optional[Decimal] = None
    creator_name: Optional[str] = None
    creator_niche: Optional[str] = None
    follower_count: Optional[str] = None  # Accept string like "50,000"
    engagement_rate: Optional[float] = None
    unique_value: Optional[str] = None
    tone: Optional[str] = "professional"
    additional_context: Optional[str] = None

class PitchGenerateResponse(BaseModel):
    pitch: str
    subject_line: str
    key_points: List[str]
    suggested_rate: Optional[Decimal] = None
    confidence_score: Optional[float] = None

class ClusterAnalysisRequest(BaseModel):
    comment_ids: Optional[List[UUID]] = None  # If None, process all unprocessed comments
    num_clusters: int = Field(default=10, ge=3, le=20)
    min_cluster_size: int = Field(default=5, ge=2)

class ClusterAnalysisResponse(BaseModel):
    clusters_created: int
    comments_processed: int
    clusters: List[ClusterResponse]

class InsightBriefRequest(BaseModel):
    include_deals: bool = True
    include_comments: bool = True
    time_period_days: int = Field(default=7, ge=1, le=30)

class InsightBriefResponse(BaseModel):
    summary: str
    top_questions: List[str]
    content_ideas: List[ContentIdea]
    deal_highlights: List[str]
    action_items: List[str]
    generated_at: datetime


# ============================================
# Common Schemas
# ============================================

class SuccessResponse(BaseModel):
    success: bool = True
    message: str

class ErrorResponse(BaseModel):
    success: bool = False
    error: str
    detail: Optional[str] = None

class PaginationParams(BaseModel):
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=50, ge=1, le=100)
