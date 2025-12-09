"""
Unit Tests for ML Service Analyzers
"""

import pytest
from unittest.mock import MagicMock
import sys
import os

# Add src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))


class TestBotDetector:
    """Tests for bot detection functionality"""
    
    def test_username_pattern_detection(self):
        """Should detect bot-like username patterns"""
        from analyzers.bot_detector import BotDetector
        
        detector = BotDetector()
        
        # Bot-like usernames
        bot_result = detector.analyze({
            "username": "user12345678",
            "platform": "twitter"
        })
        
        # Human-like usernames
        human_result = detector.analyze({
            "username": "john_doe",
            "platform": "twitter"
        })
        
        # Bot-like should have higher score
        assert bot_result["score"] >= human_result["score"]
    
    def test_empty_bio_detection(self):
        """Should flag profiles with empty bios"""
        from analyzers.bot_detector import BotDetector
        
        detector = BotDetector()
        
        result = detector.analyze({
            "username": "test_user",
            "bio": "",
            "platform": "twitter"
        })
        
        assert "empty_bio" in result["flags"]
    
    def test_extreme_follower_ratio(self):
        """Should detect extreme follower/following ratios"""
        from analyzers.bot_detector import BotDetector
        
        detector = BotDetector()
        
        # Mass follower pattern (following >> followers)
        result = detector.analyze({
            "username": "follow_bot",
            "platform": "twitter",
            "metadata": {
                "followers": 50,
                "following": 5000
            }
        })
        
        assert result["score"] > 20
        assert "suspicious_ratio" in result["flags"]
    
    def test_verified_accounts_lower_score(self):
        """Verified accounts should have lower bot scores"""
        from analyzers.bot_detector import BotDetector
        
        detector = BotDetector()
        
        verified_result = detector.analyze({
            "username": "official_brand",
            "platform": "twitter",
            "metadata": {"verified": True}
        })
        
        unverified_result = detector.analyze({
            "username": "random_account",
            "platform": "twitter",
            "metadata": {"verified": False}
        })
        
        assert verified_result["score"] < unverified_result["score"]


class TestSentimentAnalyzer:
    """Tests for sentiment analysis functionality"""
    
    def test_positive_sentiment(self):
        """Should detect positive sentiment"""
        from analyzers.sentiment_analyzer import SentimentAnalyzer
        
        analyzer = SentimentAnalyzer()
        
        result = analyzer.analyze({
            "bio": "I love technology and innovation! Amazing opportunities ahead.",
            "posts": [
                {"content": "Great day at work! Excited about the future."},
                {"content": "So happy to announce our new product!"}
            ]
        })
        
        assert result["overall"] > 0
        assert result["label"] == "positive"
    
    def test_negative_sentiment(self):
        """Should detect negative sentiment"""
        from analyzers.sentiment_analyzer import SentimentAnalyzer
        
        analyzer = SentimentAnalyzer()
        
        result = analyzer.analyze({
            "bio": "Everything is terrible and frustrating.",
            "posts": [
                {"content": "This is awful. I hate it."},
                {"content": "Disappointed and angry."}
            ]
        })
        
        assert result["overall"] < 0
        assert result["label"] == "negative"
    
    def test_neutral_sentiment(self):
        """Should detect neutral sentiment"""
        from analyzers.sentiment_analyzer import SentimentAnalyzer
        
        analyzer = SentimentAnalyzer()
        
        result = analyzer.analyze({
            "bio": "Software engineer at tech company.",
            "posts": [
                {"content": "Just published a new blog post."},
                {"content": "Attending the conference next week."}
            ]
        })
        
        assert abs(result["overall"]) < 0.3
        assert result["label"] == "neutral"


class TestInterestExtractor:
    """Tests for interest extraction functionality"""
    
    def test_hashtag_extraction(self):
        """Should extract interests from hashtags"""
        from analyzers.interest_extractor import InterestExtractor
        
        extractor = InterestExtractor()
        
        result = extractor.extract({
            "bio": "Tech enthusiast #AI #MachineLearning",
            "posts": [
                {"content": "Working on #DeepLearning projects #Python"}
            ]
        })
        
        interests = [i["topic"].lower() for i in result]
        assert "ai" in interests or "machinelearning" in interests
    
    def test_keyword_matching(self):
        """Should extract interests from keywords"""
        from analyzers.interest_extractor import InterestExtractor
        
        extractor = InterestExtractor()
        
        result = extractor.extract({
            "bio": "Passionate about artificial intelligence and blockchain technology",
            "posts": []
        })
        
        assert len(result) > 0
    
    def test_interest_ranking(self):
        """Interests should be ranked by relevance"""
        from analyzers.interest_extractor import InterestExtractor
        
        extractor = InterestExtractor()
        
        result = extractor.extract({
            "bio": "Python developer building AI applications",
            "posts": [
                {"content": "Just released a new Python package for machine learning"},
                {"content": "Python is the best language for AI"},
                {"content": "More Python tips coming soon"}
            ]
        })
        
        # Python should be highly ranked due to frequency
        if len(result) > 0:
            top_topics = [i["topic"].lower() for i in result[:3]]
            assert "python" in top_topics or "ai" in top_topics


class TestProfileScorer:
    """Tests for profile scoring functionality"""
    
    def test_high_quality_profile(self):
        """High quality profiles should get high scores"""
        from analyzers.profile_scorer import ProfileScorer
        
        scorer = ProfileScorer()
        
        result = scorer.score({
            "username": "authentic_user",
            "bio": "Senior software engineer with 10 years of experience in machine learning and AI.",
            "metadata": {
                "followers": 5000,
                "following": 500,
                "verified": True
            },
            "posts": [{"content": "post"} for _ in range(10)],
            "bot_score": 5
        })
        
        assert result["overall"] >= 70
        assert result["tier"] in ["S", "A"]
    
    def test_low_quality_profile(self):
        """Low quality profiles should get low scores"""
        from analyzers.profile_scorer import ProfileScorer
        
        scorer = ProfileScorer()
        
        result = scorer.score({
            "username": "bot12345678",
            "bio": "",
            "metadata": {
                "followers": 10,
                "following": 5000
            },
            "posts": [],
            "bot_score": 80
        })
        
        assert result["overall"] <= 40
        assert result["tier"] in ["D", "C"]
    
    def test_recommendation_generation(self):
        """Should generate appropriate recommendations"""
        from analyzers.profile_scorer import ProfileScorer
        
        scorer = ProfileScorer()
        
        result = scorer.score({
            "username": "test_user",
            "bio": "Just a test",
            "metadata": {"followers": 100},
            "posts": [],
            "bot_score": 30
        })
        
        assert "recommendation" in result
        assert len(result["recommendation"]) > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
