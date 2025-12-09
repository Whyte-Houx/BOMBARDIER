"""
ML Service - Target Acquisition & Engagement AI
FastAPI application for ML/NLP capabilities

Per dev_docs/components_modules/specifications.md
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import os
import logging
from contextlib import asynccontextmanager

# Import analyzers
from .analyzers.bot_detector import BotDetector
from .analyzers.sentiment_analyzer import SentimentAnalyzer
from .analyzers.interest_extractor import InterestExtractor
from .analyzers.profile_scorer import ProfileScorer

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize analyzers (lazy loading for faster startup)
bot_detector: Optional[BotDetector] = None
sentiment_analyzer: Optional[SentimentAnalyzer] = None
interest_extractor: Optional[InterestExtractor] = None
profile_scorer: Optional[ProfileScorer] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize ML models on startup"""
    global bot_detector, sentiment_analyzer, interest_extractor, profile_scorer
    
    logger.info("Initializing ML models...")
    bot_detector = BotDetector()
    sentiment_analyzer = SentimentAnalyzer()
    interest_extractor = InterestExtractor()
    profile_scorer = ProfileScorer()
    logger.info("ML models initialized successfully")
    
    yield
    
    logger.info("Shutting down ML service")


app = FastAPI(
    title="Bombardier ML Service",
    description="AI/ML microservice for profile analysis and scoring",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==============================================================================
# Request/Response Models
# ==============================================================================

class ProfileMetadata(BaseModel):
    followers: Optional[int] = None
    following: Optional[int] = None
    posts_count: Optional[int] = None
    verified: Optional[bool] = None
    join_date: Optional[str] = None
    last_active: Optional[str] = None


class Post(BaseModel):
    id: Optional[str] = None
    content: str
    timestamp: Optional[str] = None
    engagement: Optional[Dict[str, int]] = None


class ProfileAnalysisRequest(BaseModel):
    platform: str
    username: str
    bio: Optional[str] = None
    display_name: Optional[str] = None
    metadata: Optional[ProfileMetadata] = None
    posts: Optional[List[Post]] = None


class BotDetectionRequest(BaseModel):
    platform: str
    username: str
    bio: Optional[str] = None
    metadata: Optional[ProfileMetadata] = None
    posts: Optional[List[Post]] = None


class SentimentRequest(BaseModel):
    text: str
    context: Optional[str] = None


class InterestExtractionRequest(BaseModel):
    bio: Optional[str] = None
    posts: Optional[List[str]] = None


class MessageContextRequest(BaseModel):
    profile: ProfileAnalysisRequest
    campaign_interests: Optional[List[str]] = None
    tone: Optional[str] = "balanced"  # formal, casual, balanced


class AnalysisResponse(BaseModel):
    success: bool = True
    data: Dict[str, Any]


class HealthResponse(BaseModel):
    status: str
    version: str
    models_loaded: bool


# ==============================================================================
# API Endpoints
# ==============================================================================

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        version="1.0.0",
        models_loaded=bot_detector is not None
    )


@app.post("/analyze/profile", response_model=AnalysisResponse)
async def analyze_profile(request: ProfileAnalysisRequest):
    """
    Full profile analysis combining all ML capabilities
    Returns bot score, sentiment, interests, and overall quality score
    """
    try:
        # Combine text content
        text_content = []
        if request.bio:
            text_content.append(request.bio)
        if request.posts:
            text_content.extend([p.content for p in request.posts])
        combined_text = " ".join(text_content)
        
        # Bot detection
        bot_result = bot_detector.analyze({
            "platform": request.platform,
            "username": request.username,
            "bio": request.bio,
            "metadata": request.metadata.model_dump() if request.metadata else {},
            "posts": [p.model_dump() for p in request.posts] if request.posts else []
        })
        
        # Sentiment analysis
        sentiment_result = sentiment_analyzer.analyze(combined_text) if combined_text else {
            "overall": 0, "confidence": 0
        }
        
        # Interest extraction
        interests = interest_extractor.extract(combined_text) if combined_text else []
        
        # Overall profile score
        quality_score = profile_scorer.score({
            "bot_score": bot_result["score"],
            "sentiment": sentiment_result,
            "interests": interests,
            "metadata": request.metadata.model_dump() if request.metadata else {}
        })
        
        return AnalysisResponse(data={
            "bot_detection": bot_result,
            "sentiment": sentiment_result,
            "interests": interests,
            "quality_score": quality_score,
            "communication_style": _detect_communication_style(combined_text),
            "activity_pattern": _analyze_activity_pattern(request.posts)
        })
        
    except Exception as e:
        logger.error(f"Profile analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/detect/bot", response_model=AnalysisResponse)
async def detect_bot(request: BotDetectionRequest):
    """
    Bot detection scoring
    Returns probability score (0-100) and detection flags
    """
    try:
        result = bot_detector.analyze({
            "platform": request.platform,
            "username": request.username,
            "bio": request.bio,
            "metadata": request.metadata.model_dump() if request.metadata else {},
            "posts": [p.model_dump() for p in request.posts] if request.posts else []
        })
        
        return AnalysisResponse(data=result)
        
    except Exception as e:
        logger.error(f"Bot detection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analyze/sentiment", response_model=AnalysisResponse)
async def analyze_sentiment(request: SentimentRequest):
    """
    Sentiment analysis for text content
    Returns overall sentiment (-1 to 1) and confidence score
    """
    try:
        result = sentiment_analyzer.analyze(request.text, request.context)
        return AnalysisResponse(data=result)
        
    except Exception as e:
        logger.error(f"Sentiment analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/extract/interests", response_model=AnalysisResponse)
async def extract_interests(request: InterestExtractionRequest):
    """
    Extract interests/topics from profile content
    Returns categorized interests with confidence scores
    """
    try:
        text_content = []
        if request.bio:
            text_content.append(request.bio)
        if request.posts:
            text_content.extend(request.posts)
        combined_text = " ".join(text_content)
        
        interests = interest_extractor.extract(combined_text)
        topics = interest_extractor.extract_topics(combined_text)
        
        return AnalysisResponse(data={
            "interests": interests,
            "topics": topics
        })
        
    except Exception as e:
        logger.error(f"Interest extraction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/generate/message-context", response_model=AnalysisResponse)
async def generate_message_context(request: MessageContextRequest):
    """
    Generate context for personalized message generation
    Returns recommended talking points, tone, and approach
    """
    try:
        # Analyze the profile
        text_content = []
        if request.profile.bio:
            text_content.append(request.profile.bio)
        if request.profile.posts:
            text_content.extend([p.content for p in request.profile.posts])
        combined_text = " ".join(text_content)
        
        # Extract interests
        interests = interest_extractor.extract(combined_text) if combined_text else []
        
        # Find common interests with campaign
        common_interests = []
        if request.campaign_interests:
            common_interests = [i for i in interests if i in request.campaign_interests]
        
        # Detect communication style
        style = _detect_communication_style(combined_text)
        
        # Generate talking points
        talking_points = []
        if common_interests:
            talking_points.append(f"Common interest in {common_interests[0]}")
        if interests:
            talking_points.append(f"Their focus on {interests[0]}")
        if request.profile.metadata and request.profile.metadata.verified:
            talking_points.append("Acknowledge their verified status")
        
        return AnalysisResponse(data={
            "recommended_tone": style,
            "talking_points": talking_points,
            "common_interests": common_interests,
            "profile_interests": interests[:5],
            "personalization_score": len(common_interests) * 20 + len(talking_points) * 10
        })
        
    except Exception as e:
        logger.error(f"Message context generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==============================================================================
# Helper Functions
# ==============================================================================

def _detect_communication_style(text: str) -> str:
    """Detect communication style from text content"""
    if not text:
        return "balanced"
    
    text_lower = text.lower()
    
    # Casual indicators
    casual_count = sum(1 for word in ["lol", "omg", "tbh", "ngl", "fr", "btw", "dm", "haha"] 
                       if word in text_lower)
    
    # Formal indicators
    formal_count = sum(1 for word in ["therefore", "however", "furthermore", "regarding", 
                                       "sincerely", "professional", "opportunity"] 
                       if word in text_lower)
    
    # Emoji count
    emoji_count = sum(1 for char in text if ord(char) > 127462)
    
    if casual_count > formal_count * 2 or emoji_count > 3:
        return "casual"
    elif formal_count > casual_count * 2:
        return "formal"
    else:
        return "balanced"


def _analyze_activity_pattern(posts: Optional[List[Post]]) -> str:
    """Analyze posting activity pattern"""
    if not posts:
        return "unknown"
    
    count = len(posts)
    if count > 50:
        return "very_active"
    elif count > 20:
        return "active"
    elif count > 5:
        return "moderate"
    elif count > 0:
        return "occasional"
    else:
        return "inactive"


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
