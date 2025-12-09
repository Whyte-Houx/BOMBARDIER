"""
Interest Extraction Module
Per dev_docs - Extract interests and topics from profile content

Uses multiple approaches:
1. Keyword extraction
2. Topic categorization
3. Entity recognition (simplified)
"""

import re
import logging
from typing import Dict, List, Any, Set, Tuple
from collections import Counter

logger = logging.getLogger(__name__)


class InterestExtractor:
    """
    Extract interests and topics from text content
    """
    
    # Interest categories with keywords
    INTEREST_CATEGORIES = {
        'technology': [
            'tech', 'coding', 'programming', 'developer', 'software', 'hardware',
            'ai', 'artificial intelligence', 'machine learning', 'ml', 'data science',
            'blockchain', 'crypto', 'web3', 'nft', 'startup', 'saas', 'api',
            'javascript', 'python', 'react', 'node', 'ios', 'android', 'app',
            'cloud', 'devops', 'cybersecurity', 'hacking', 'opensource'
        ],
        'business': [
            'entrepreneur', 'entrepreneurship', 'startup', 'founder', 'ceo', 'cto',
            'business', 'marketing', 'sales', 'growth', 'revenue', 'investment',
            'venture', 'vc', 'funding', 'money', 'finance', 'fintech', 'banking',
            'stocks', 'trading', 'real estate', 'consulting', 'strategy'
        ],
        'creative': [
            'design', 'designer', 'art', 'artist', 'creative', 'photography',
            'photo', 'video', 'film', 'music', 'musician', 'producer', 'dj',
            'writing', 'writer', 'author', 'content', 'creator', 'influencer',
            'fashion', 'style', 'aesthetic', 'visual', 'graphic', 'ui', 'ux'
        ],
        'sports': [
            'fitness', 'gym', 'workout', 'training', 'sports', 'athlete',
            'running', 'marathon', 'cycling', 'swimming', 'yoga', 'meditation',
            'football', 'soccer', 'basketball', 'baseball', 'tennis', 'golf',
            'crossfit', 'bodybuilding', 'weightlifting', 'hiking', 'climbing'
        ],
        'entertainment': [
            'gaming', 'gamer', 'esports', 'twitch', 'streaming', 'youtube',
            'movies', 'film', 'tv', 'netflix', 'anime', 'manga', 'comics',
            'music', 'concerts', 'festivals', 'podcast', 'comedy', 'memes'
        ],
        'lifestyle': [
            'travel', 'adventure', 'wanderlust', 'backpacking', 'foodie', 'food',
            'cooking', 'chef', 'wine', 'coffee', 'wellness', 'health', 'vegan',
            'sustainable', 'minimalist', 'luxury', 'lifestyle', 'parenting', 'family'
        ],
        'education': [
            'learning', 'education', 'teacher', 'professor', 'student', 'university',
            'research', 'science', 'physics', 'chemistry', 'biology', 'math',
            'history', 'philosophy', 'psychology', 'sociology', 'economics'
        ],
        'social': [
            'activism', 'social', 'community', 'nonprofit', 'charity', 'volunteer',
            'politics', 'environment', 'climate', 'sustainability', 'diversity',
            'inclusion', 'equality', 'justice', 'human rights', 'mental health'
        ],
    }
    
    # Common hashtag prefixes to clean
    HASHTAG_PREFIXES = ['#', '@']
    
    def __init__(self):
        """Initialize the interest extractor"""
        logger.info("InterestExtractor initialized")
        
        # Build reverse lookup for faster categorization
        self._keyword_to_category = {}
        for category, keywords in self.INTEREST_CATEGORIES.items():
            for keyword in keywords:
                self._keyword_to_category[keyword.lower()] = category
    
    def extract(self, text: str) -> List[str]:
        """
        Extract interests from text content
        
        Args:
            text: Text to analyze
            
        Returns:
            List of extracted interests/keywords
        """
        if not text:
            return []
        
        interests = set()
        text_lower = text.lower()
        
        # Extract hashtags
        hashtags = re.findall(r'#(\w+)', text)
        for tag in hashtags:
            # Clean and add hashtag content
            clean_tag = tag.lower()
            if len(clean_tag) > 2:
                interests.add(clean_tag)
        
        # Extract keywords from categories
        for category, keywords in self.INTEREST_CATEGORIES.items():
            for keyword in keywords:
                if keyword in text_lower:
                    interests.add(keyword)
        
        # Extract entities (simplified - look for capitalized words)
        words = text.split()
        for i, word in enumerate(words):
            # Skip first word of sentences
            if i == 0 or (i > 0 and words[i-1].endswith('.')):
                continue
            
            # Check if capitalized (might be an entity)
            clean_word = re.sub(r'[^\w]', '', word)
            if clean_word and clean_word[0].isupper() and len(clean_word) > 2:
                # Avoid common words
                if clean_word.lower() not in ['the', 'and', 'for', 'with', 'this', 'that']:
                    interests.add(clean_word.lower())
        
        # Limit and sort by relevance
        return self._rank_interests(list(interests), text_lower)[:15]
    
    def extract_topics(self, text: str) -> List[Dict[str, Any]]:
        """
        Extract topics with categories and confidence
        
        Returns:
            List of topics with category, name, and confidence
        """
        if not text:
            return []
        
        text_lower = text.lower()
        topics = []
        category_scores = Counter()
        
        # Count category matches
        for category, keywords in self.INTEREST_CATEGORIES.items():
            matches = []
            for keyword in keywords:
                # Count occurrences
                count = text_lower.count(keyword)
                if count > 0:
                    matches.append({
                        "keyword": keyword,
                        "count": count
                    })
                    category_scores[category] += count
            
            if matches:
                # Calculate confidence based on matches
                confidence = min(len(matches) / 5, 1.0)  # Cap at 1.0
                topics.append({
                    "category": category,
                    "matches": sorted(matches, key=lambda x: x["count"], reverse=True)[:5],
                    "confidence": round(confidence, 2)
                })
        
        # Sort by confidence
        topics.sort(key=lambda x: x["confidence"], reverse=True)
        
        return topics[:5]  # Return top 5 topic categories
    
    def _rank_interests(self, interests: List[str], text: str) -> List[str]:
        """Rank interests by relevance"""
        if not interests:
            return []
        
        scored = []
        for interest in interests:
            score = 0
            
            # Count occurrences
            count = text.count(interest)
            score += count * 2
            
            # Bonus if in known categories
            if interest in self._keyword_to_category:
                score += 5
            
            # Bonus for longer interests (usually more specific)
            if len(interest) > 8:
                score += 2
            
            scored.append((interest, score))
        
        # Sort by score and return interests
        scored.sort(key=lambda x: x[1], reverse=True)
        return [interest for interest, _ in scored]
    
    def get_category(self, interest: str) -> str:
        """Get the category for an interest"""
        return self._keyword_to_category.get(interest.lower(), "general")
    
    def categorize_interests(self, interests: List[str]) -> Dict[str, List[str]]:
        """Group interests by category"""
        categorized = {}
        
        for interest in interests:
            category = self.get_category(interest)
            if category not in categorized:
                categorized[category] = []
            categorized[category].append(interest)
        
        return categorized
    
    def find_common_interests(self, interests1: List[str], interests2: List[str]) -> List[str]:
        """Find common interests between two lists"""
        set1 = set(i.lower() for i in interests1)
        set2 = set(i.lower() for i in interests2)
        
        # Direct matches
        common = list(set1 & set2)
        
        # Category matches (same category but different keyword)
        categories1 = set(self.get_category(i) for i in interests1)
        categories2 = set(self.get_category(i) for i in interests2)
        
        # Add category-level matches
        for cat in categories1 & categories2:
            if cat != "general":
                common.append(f"[{cat}]")
        
        return common
