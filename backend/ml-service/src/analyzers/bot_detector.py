"""
Bot Detection Module
Per dev_docs - Multi-stage bot detection using ML and heuristics

Combines multiple signals:
1. Statistical anomalies in account metrics
2. Content analysis patterns
3. Temporal posting patterns
4. Username and bio analysis
"""

import re
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
import numpy as np

logger = logging.getLogger(__name__)


class BotDetector:
    """
    Multi-layer bot detection system combining heuristics and ML
    """
    
    # Suspicious patterns in usernames
    BOT_USERNAME_PATTERNS = [
        r'\d{6,}$',           # Ends with 6+ digits
        r'^[a-z]{3,5}\d{4,}', # Short letters + numbers
        r'bot$',              # Ends with 'bot'
        r'^user\d+',          # Starts with 'user' + numbers
        r'[a-z]{1,3}\d+[a-z]{1,3}\d+',  # Alternating letters/numbers
    ]
    
    # Spam phrases in bio
    SPAM_BIO_PHRASES = [
        'follow back', 'f4f', 'follow for follow', 'dm for promo',
        'link in bio', 'check link', 'free followers', 'get followers',
        'grow your', 'make money', 'work from home', 'earn $',
        'click here', 'limited time', 'act now', 'special offer'
    ]
    
    # Generic bot bios
    GENERIC_BIOS = [
        'just here', 'living life', 'lover of life', 'follow me',
        'entrepreneur', 'influencer', 'content creator', 'dreamer'
    ]
    
    def __init__(self):
        """Initialize the bot detector"""
        logger.info("BotDetector initialized")
        self.model = None  # Placeholder for ML model
    
    def analyze(self, profile_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze a profile for bot-like behavior
        
        Args:
            profile_data: Dict containing platform, username, bio, metadata, posts
            
        Returns:
            Dict with score (0-100), is_bot (bool), confidence, and flags
        """
        scores = []
        flags = []
        
        # 1. Username analysis
        username_score, username_flags = self._analyze_username(
            profile_data.get("username", "")
        )
        scores.append(username_score)
        flags.extend(username_flags)
        
        # 2. Bio analysis
        bio_score, bio_flags = self._analyze_bio(
            profile_data.get("bio", "")
        )
        scores.append(bio_score)
        flags.extend(bio_flags)
        
        # 3. Metrics analysis
        metadata = profile_data.get("metadata", {})
        metrics_score, metrics_flags = self._analyze_metrics(metadata)
        scores.append(metrics_score)
        flags.extend(metrics_flags)
        
        # 4. Content analysis
        posts = profile_data.get("posts", [])
        content_score, content_flags = self._analyze_content(posts)
        scores.append(content_score)
        flags.extend(content_flags)
        
        # 5. Temporal analysis
        temporal_score, temporal_flags = self._analyze_temporal(posts)
        scores.append(temporal_score)
        flags.extend(temporal_flags)
        
        # Calculate final score (weighted average)
        weights = [0.15, 0.15, 0.25, 0.25, 0.20]  # username, bio, metrics, content, temporal
        final_score = sum(s * w for s, w in zip(scores, weights))
        
        # Confidence based on data availability
        confidence = self._calculate_confidence(profile_data)
        
        return {
            "score": round(final_score, 1),
            "is_bot": final_score > 50,
            "confidence": confidence,
            "flags": list(set(flags)),
            "component_scores": {
                "username": username_score,
                "bio": bio_score,
                "metrics": metrics_score,
                "content": content_score,
                "temporal": temporal_score
            }
        }
    
    def _analyze_username(self, username: str) -> tuple:
        """Analyze username for bot-like patterns"""
        if not username:
            return 50, []  # Neutral if no username
        
        score = 0
        flags = []
        
        # Check patterns
        for pattern in self.BOT_USERNAME_PATTERNS:
            if re.search(pattern, username, re.IGNORECASE):
                score += 25
                flags.append(f"suspicious_username_pattern:{pattern}")
        
        # Check length
        if len(username) < 3:
            score += 20
            flags.append("very_short_username")
        elif len(username) > 25:
            score += 10
            flags.append("very_long_username")
        
        # Check for random characters
        if not any(c.isalpha() for c in username):
            score += 30
            flags.append("no_letters_in_username")
        
        # Check consonant/vowel ratio (random strings often have weird ratios)
        vowels = sum(1 for c in username.lower() if c in 'aeiou')
        consonants = sum(1 for c in username.lower() if c.isalpha() and c not in 'aeiou')
        if consonants > 0 and vowels / max(consonants, 1) < 0.1:
            score += 15
            flags.append("unusual_character_distribution")
        
        return min(score, 100), flags
    
    def _analyze_bio(self, bio: str) -> tuple:
        """Analyze bio for spam/bot indicators"""
        if not bio:
            return 30, ["no_bio"]  # Slightly suspicious
        
        score = 0
        flags = []
        bio_lower = bio.lower()
        
        # Check for spam phrases
        spam_matches = sum(1 for phrase in self.SPAM_BIO_PHRASES if phrase in bio_lower)
        if spam_matches > 0:
            score += spam_matches * 20
            flags.append(f"spam_phrases:{spam_matches}")
        
        # Check for generic bios
        generic_matches = sum(1 for phrase in self.GENERIC_BIOS if phrase in bio_lower)
        if generic_matches > 0:
            score += generic_matches * 10
            flags.append("generic_bio")
        
        # Check for excessive emojis
        emoji_count = sum(1 for char in bio if ord(char) > 127462)
        if emoji_count > 10:
            score += 15
            flags.append("excessive_emojis")
        
        # Check for excessive hashtags
        hashtag_count = bio.count('#')
        if hashtag_count > 5:
            score += 20
            flags.append("excessive_hashtags")
        
        # Check for URLs
        url_count = len(re.findall(r'https?://', bio))
        if url_count > 2:
            score += 25
            flags.append("multiple_urls")
        
        # Very short bio
        if len(bio) < 10:
            score += 15
            flags.append("very_short_bio")
        
        return min(score, 100), flags
    
    def _analyze_metrics(self, metadata: Dict[str, Any]) -> tuple:
        """Analyze account metrics for anomalies"""
        score = 0
        flags = []
        
        followers = metadata.get("followers", 0)
        following = metadata.get("following", 0)
        posts_count = metadata.get("posts_count", 0)
        verified = metadata.get("verified", False)
        
        # Verified accounts are less likely to be bots
        if verified:
            return 5, ["verified_account"]
        
        # Check follower/following ratio
        if following > 0:
            ratio = followers / following
            if ratio < 0.01:  # Following many, few followers
                score += 40
                flags.append("suspicious_follower_ratio")
            elif ratio > 100 and followers > 10000:
                # Could be celebrity/influencer, but also could be bought followers
                score += 10
                flags.append("extremely_high_follower_ratio")
        
        # Check for unrealistic metrics
        if followers > 1000000 and posts_count < 10:
            score += 50
            flags.append("unrealistic_followers_to_posts")
        
        if following > 5000:
            score += 25
            flags.append("mass_following")
        
        # Very new account with high activity
        if posts_count > 100 and followers < 10:
            score += 30
            flags.append("high_activity_low_followers")
        
        # No posts but many followers (could be bought)
        if posts_count == 0 and followers > 100:
            score += 35
            flags.append("no_posts_many_followers")
        
        return min(score, 100), flags
    
    def _analyze_content(self, posts: List[Dict[str, Any]]) -> tuple:
        """Analyze post content for bot patterns"""
        if not posts:
            return 30, ["no_posts"]
        
        score = 0
        flags = []
        
        contents = [p.get("content", "") for p in posts if p.get("content")]
        
        if not contents:
            return 30, ["empty_posts"]
        
        # Check for duplicate content
        unique_contents = set(contents)
        if len(unique_contents) < len(contents) * 0.5:
            score += 40
            flags.append("high_content_duplication")
        
        # Check for repetitive hashtag usage
        all_hashtags = []
        for content in contents:
            all_hashtags.extend(re.findall(r'#\w+', content))
        
        if len(all_hashtags) > 0:
            unique_hashtags = set(all_hashtags)
            hashtag_repetition = len(all_hashtags) / len(unique_hashtags)
            if hashtag_repetition > 5:
                score += 25
                flags.append("repetitive_hashtags")
        
        # Check average content length
        avg_length = sum(len(c) for c in contents) / len(contents)
        if avg_length < 20:
            score += 20
            flags.append("very_short_posts")
        
        # Check for promotional content
        promo_count = sum(1 for c in contents if any(phrase in c.lower() 
                         for phrase in ['buy', 'sale', 'discount', 'link', 'shop', 'promo']))
        if promo_count > len(contents) * 0.5:
            score += 35
            flags.append("high_promotional_content")
        
        return min(score, 100), flags
    
    def _analyze_temporal(self, posts: List[Dict[str, Any]]) -> tuple:
        """Analyze posting patterns for bot behavior"""
        if not posts or len(posts) < 3:
            return 30, ["insufficient_temporal_data"]
        
        score = 0
        flags = []
        
        # Extract timestamps
        timestamps = []
        for p in posts:
            ts = p.get("timestamp")
            if ts:
                try:
                    if isinstance(ts, str):
                        timestamps.append(datetime.fromisoformat(ts.replace('Z', '+00:00')))
                except:
                    pass
        
        if len(timestamps) < 3:
            return 30, ["insufficient_temporal_data"]
        
        # Sort timestamps
        timestamps.sort()
        
        # Calculate intervals between posts
        intervals = []
        for i in range(1, len(timestamps)):
            interval = (timestamps[i] - timestamps[i-1]).total_seconds()
            intervals.append(interval)
        
        if not intervals:
            return 30, []
        
        # Check for suspiciously regular intervals
        avg_interval = np.mean(intervals)
        std_interval = np.std(intervals)
        
        # Very regular posting pattern (bots often post at exact intervals)
        if avg_interval > 0 and std_interval / avg_interval < 0.1:
            score += 50
            flags.append("suspiciously_regular_posting")
        
        # Check for burst posting
        short_intervals = sum(1 for i in intervals if i < 60)  # Less than 1 minute apart
        if short_intervals > len(intervals) * 0.3:
            score += 35
            flags.append("burst_posting_pattern")
        
        # Check for 24/7 activity (no sleep pattern)
        hours = [ts.hour for ts in timestamps]
        unique_hours = len(set(hours))
        if len(timestamps) > 20 and unique_hours > 20:
            score += 30
            flags.append("no_sleep_pattern")
        
        return min(score, 100), flags
    
    def _calculate_confidence(self, profile_data: Dict[str, Any]) -> float:
        """Calculate confidence based on data availability"""
        confidence = 0.5  # Base confidence
        
        if profile_data.get("bio"):
            confidence += 0.1
        
        if profile_data.get("metadata"):
            confidence += 0.15
        
        posts = profile_data.get("posts", [])
        if posts:
            if len(posts) > 10:
                confidence += 0.2
            elif len(posts) > 3:
                confidence += 0.1
        
        return min(round(confidence, 2), 1.0)
