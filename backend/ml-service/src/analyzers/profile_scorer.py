"""
Profile Scorer Module
Per dev_docs - Overall profile quality scoring for targeting

Combines multiple signals to produce a single quality score
that helps prioritize outreach targets.
"""

import logging
from typing import Dict, List, Any

logger = logging.getLogger(__name__)


class ProfileScorer:
    """
    Score profiles for quality and targeting potential
    """
    
    # Scoring weights
    WEIGHTS = {
        "authenticity": 0.30,    # Inverse of bot score
        "engagement": 0.25,      # Follower/following ratio, post engagement
        "relevance": 0.25,       # Interest alignment
        "accessibility": 0.20,   # Likelihood to respond
    }
    
    def __init__(self):
        """Initialize the profile scorer"""
        logger.info("ProfileScorer initialized")
    
    def score(self, profile_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Calculate overall profile quality score
        
        Args:
            profile_data: Dict with bot_score, sentiment, interests, metadata
            
        Returns:
            Dict with overall score and component breakdown
        """
        components = {}
        
        # 1. Authenticity score (inverse of bot score)
        bot_score = profile_data.get("bot_score", 50)
        authenticity = max(0, 100 - bot_score)
        components["authenticity"] = authenticity
        
        # 2. Engagement score
        metadata = profile_data.get("metadata", {})
        engagement = self._calculate_engagement_score(metadata)
        components["engagement"] = engagement
        
        # 3. Relevance score
        interests = profile_data.get("interests", [])
        target_interests = profile_data.get("target_interests", [])
        relevance = self._calculate_relevance_score(interests, target_interests)
        components["relevance"] = relevance
        
        # 4. Accessibility score
        sentiment = profile_data.get("sentiment", {})
        accessibility = self._calculate_accessibility_score(metadata, sentiment)
        components["accessibility"] = accessibility
        
        # Calculate weighted overall score
        overall = sum(
            components[key] * weight 
            for key, weight in self.WEIGHTS.items()
        )
        
        # Determine recommendation
        if overall >= 75:
            recommendation = "high_priority"
            recommendation_text = "Excellent target - prioritize outreach"
        elif overall >= 50:
            recommendation = "good_target"
            recommendation_text = "Good target - include in campaign"
        elif overall >= 30:
            recommendation = "consider"
            recommendation_text = "Moderate target - consider for larger campaigns"
        else:
            recommendation = "skip"
            recommendation_text = "Low quality target - skip or deprioritize"
        
        return {
            "overall": round(overall, 1),
            "components": {k: round(v, 1) for k, v in components.items()},
            "recommendation": recommendation,
            "recommendation_text": recommendation_text,
            "tier": self._get_tier(overall)
        }
    
    def _calculate_engagement_score(self, metadata: Dict[str, Any]) -> float:
        """Calculate engagement potential score"""
        score = 50  # Base score
        
        followers = metadata.get("followers", 0)
        following = metadata.get("following", 0)
        posts_count = metadata.get("posts_count", 0)
        verified = metadata.get("verified", False)
        
        # Verified accounts get a boost
        if verified:
            score += 20
        
        # Follower count contribution
        if followers > 10000:
            score += 15
        elif followers > 1000:
            score += 10
        elif followers > 100:
            score += 5
        elif followers < 10:
            score -= 10
        
        # Follower/following ratio
        if following > 0:
            ratio = followers / following
            if ratio > 2:
                score += 15  # Good ratio - audience trusts them
            elif ratio > 1:
                score += 10
            elif ratio < 0.1:
                score -= 15  # Mass following - likely low quality
        
        # Activity level
        if posts_count > 100:
            score += 10
        elif posts_count > 20:
            score += 5
        elif posts_count < 5:
            score -= 10
        
        return max(0, min(100, score))
    
    def _calculate_relevance_score(
        self, 
        profile_interests: List[str], 
        target_interests: List[str]
    ) -> float:
        """Calculate relevance to campaign interests"""
        if not profile_interests:
            return 30  # Low score if no interests detected
        
        if not target_interests:
            return 50  # Neutral if no target interests specified
        
        score = 30  # Base score
        
        # Find matches
        profile_set = set(i.lower() for i in profile_interests)
        target_set = set(i.lower() for i in target_interests)
        
        # Direct matches
        matches = profile_set & target_set
        score += len(matches) * 15  # 15 points per match
        
        # Partial matches (substring)
        for p_interest in profile_set:
            for t_interest in target_set:
                if p_interest in t_interest or t_interest in p_interest:
                    score += 5
        
        return max(0, min(100, score))
    
    def _calculate_accessibility_score(
        self, 
        metadata: Dict[str, Any],
        sentiment: Dict[str, Any]
    ) -> float:
        """Calculate likelihood of positive response"""
        score = 50  # Base score
        
        # Positive sentiment = more likely to respond positively
        overall_sentiment = sentiment.get("overall", 0)
        if overall_sentiment > 0.3:
            score += 20
        elif overall_sentiment > 0:
            score += 10
        elif overall_sentiment < -0.3:
            score -= 15
        
        # Verified accounts might be harder to reach
        if metadata.get("verified"):
            score -= 10
        
        # High follower count = harder to get attention
        followers = metadata.get("followers", 0)
        if followers > 100000:
            score -= 20
        elif followers > 10000:
            score -= 10
        elif followers < 100:
            score += 10  # Smaller accounts more likely to engage
        
        # Active accounts more likely to respond
        posts_count = metadata.get("posts_count", 0)
        if posts_count > 50:
            score += 10
        elif posts_count < 5:
            score -= 10
        
        return max(0, min(100, score))
    
    def _get_tier(self, score: float) -> str:
        """Get tier classification based on score"""
        if score >= 80:
            return "S"
        elif score >= 65:
            return "A"
        elif score >= 50:
            return "B"
        elif score >= 35:
            return "C"
        else:
            return "D"
    
    def rank_profiles(self, profiles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Rank multiple profiles by quality score
        
        Args:
            profiles: List of profile data dicts
            
        Returns:
            Sorted list with scores attached
        """
        scored = []
        for profile in profiles:
            score_result = self.score(profile)
            scored.append({
                **profile,
                "quality_score": score_result
            })
        
        # Sort by overall score descending
        scored.sort(key=lambda x: x["quality_score"]["overall"], reverse=True)
        
        return scored
    
    def filter_profiles(
        self, 
        profiles: List[Dict[str, Any]], 
        min_score: float = 40,
        max_count: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Filter and rank profiles above minimum score
        
        Args:
            profiles: List of profile data dicts
            min_score: Minimum score to include
            max_count: Maximum profiles to return
            
        Returns:
            Filtered and sorted list
        """
        ranked = self.rank_profiles(profiles)
        
        # Filter by minimum score
        filtered = [
            p for p in ranked 
            if p["quality_score"]["overall"] >= min_score
        ]
        
        # Limit count
        return filtered[:max_count]
