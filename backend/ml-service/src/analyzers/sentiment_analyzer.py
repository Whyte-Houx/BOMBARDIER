"""
Sentiment Analysis Module
Per dev_docs - NLP-based sentiment analysis for profile content

Uses multiple approaches:
1. Lexicon-based analysis (VADER-style)
2. Keyword pattern matching
3. Contextual analysis
"""

import re
import logging
from typing import Dict, List, Any, Optional, Tuple

logger = logging.getLogger(__name__)


class SentimentAnalyzer:
    """
    Multi-approach sentiment analysis system
    """
    
    # Positive lexicon
    POSITIVE_WORDS = {
        # Strong positive
        'amazing': 0.9, 'excellent': 0.9, 'outstanding': 0.9, 'incredible': 0.9,
        'fantastic': 0.9, 'wonderful': 0.9, 'brilliant': 0.9, 'exceptional': 0.9,
        # Moderate positive
        'great': 0.7, 'good': 0.6, 'nice': 0.5, 'happy': 0.7, 'love': 0.8,
        'awesome': 0.8, 'beautiful': 0.7, 'perfect': 0.9, 'best': 0.8,
        'excited': 0.7, 'grateful': 0.7, 'blessed': 0.6, 'thrilled': 0.8,
        'enjoy': 0.6, 'appreciate': 0.6, 'thankful': 0.7, 'proud': 0.7,
        'successful': 0.7, 'positive': 0.6, 'inspiring': 0.7, 'motivated': 0.6,
        # Mild positive
        'like': 0.4, 'okay': 0.2, 'fine': 0.3, 'cool': 0.5, 'interesting': 0.4,
        'helpful': 0.5, 'useful': 0.5, 'recommend': 0.6, 'thanks': 0.5,
    }
    
    # Negative lexicon
    NEGATIVE_WORDS = {
        # Strong negative
        'terrible': -0.9, 'horrible': -0.9, 'awful': -0.9, 'worst': -0.9,
        'disgusting': -0.9, 'hate': -0.8, 'disaster': -0.8, 'pathetic': -0.8,
        # Moderate negative
        'bad': -0.6, 'poor': -0.5, 'disappointing': -0.7, 'upset': -0.6,
        'angry': -0.7, 'frustrated': -0.6, 'annoyed': -0.5, 'sad': -0.6,
        'boring': -0.5, 'waste': -0.6, 'stupid': -0.7, 'useless': -0.7,
        'wrong': -0.5, 'failed': -0.6, 'broken': -0.5, 'problem': -0.4,
        # Mild negative
        'dislike': -0.4, 'meh': -0.2, 'mediocre': -0.3, 'issue': -0.3,
        'difficult': -0.3, 'confusing': -0.4, 'worried': -0.4,
    }
    
    # Intensifiers
    INTENSIFIERS = {
        'very': 1.5, 'really': 1.4, 'extremely': 1.7, 'absolutely': 1.8,
        'totally': 1.5, 'completely': 1.6, 'incredibly': 1.7, 'super': 1.4,
        'so': 1.3, 'quite': 1.2, 'pretty': 1.2, 'highly': 1.4,
    }
    
    # Negators
    NEGATORS = ['not', "n't", 'no', 'never', 'none', 'nothing', 'neither', 'nowhere']
    
    # Emoji sentiment mapping
    EMOJI_PATTERNS = {
        'positive': r'[😀😃😄😁😆😅🤣😂🙂🙃😉😊😇🥰😍🤩😘😗☺😚😙🥲😋😛😜🤪😝👍👏🎉❤️💕💖💗💙💚💛🧡💜🤎🖤🤍💯✨🌟⭐🔥💪]',
        'negative': r'[😞😔😟😕🙁☹️😣😖😫😩🥺😢😭😤😠😡🤬😈👿💀👎💔😰😨😱]',
        'neutral': r'[😐😑😶🤔🤨🧐😏🙄😬🤥]',
    }
    
    def __init__(self):
        """Initialize the sentiment analyzer"""
        logger.info("SentimentAnalyzer initialized")
    
    def analyze(self, text: str, context: Optional[str] = None) -> Dict[str, Any]:
        """
        Analyze sentiment of text content
        
        Args:
            text: Text to analyze
            context: Optional context for better analysis
            
        Returns:
            Dict with overall sentiment (-1 to 1), confidence, and breakdown
        """
        if not text or not text.strip():
            return {
                "overall": 0,
                "confidence": 0,
                "label": "neutral",
                "breakdown": {}
            }
        
        # Normalize text
        text = text.strip()
        
        # Analyze using multiple methods
        lexicon_score = self._lexicon_analysis(text)
        emoji_score = self._emoji_analysis(text)
        pattern_score = self._pattern_analysis(text)
        
        # Combine scores (weighted)
        scores = [
            (lexicon_score, 0.5),
            (emoji_score, 0.25),
            (pattern_score, 0.25),
        ]
        
        # Filter out None scores
        valid_scores = [(s, w) for s, w in scores if s is not None]
        
        if not valid_scores:
            overall = 0
        else:
            total_weight = sum(w for _, w in valid_scores)
            overall = sum(s * w for s, w in valid_scores) / total_weight
        
        # Calculate confidence
        confidence = self._calculate_confidence(text, valid_scores)
        
        # Determine label
        if overall > 0.2:
            label = "positive"
        elif overall < -0.2:
            label = "negative"
        else:
            label = "neutral"
        
        return {
            "overall": round(overall, 3),
            "confidence": round(confidence, 3),
            "label": label,
            "breakdown": {
                "lexicon": round(lexicon_score, 3) if lexicon_score else 0,
                "emoji": round(emoji_score, 3) if emoji_score else 0,
                "pattern": round(pattern_score, 3) if pattern_score else 0,
            }
        }
    
    def _lexicon_analysis(self, text: str) -> Optional[float]:
        """Analyze using word-level lexicon matching"""
        words = re.findall(r'\b\w+\b', text.lower())
        
        if not words:
            return None
        
        scores = []
        i = 0
        while i < len(words):
            word = words[i]
            
            # Check for negation before the word
            negated = False
            if i > 0 and any(neg in words[i-1] for neg in self.NEGATORS):
                negated = True
            
            # Check for intensifier before the word
            intensity = 1.0
            if i > 0 and words[i-1] in self.INTENSIFIERS:
                intensity = self.INTENSIFIERS[words[i-1]]
            
            # Get word score
            if word in self.POSITIVE_WORDS:
                score = self.POSITIVE_WORDS[word] * intensity
                if negated:
                    score = -score * 0.5
                scores.append(score)
            elif word in self.NEGATIVE_WORDS:
                score = self.NEGATIVE_WORDS[word] * intensity
                if negated:
                    score = -score * 0.5
                scores.append(score)
            
            i += 1
        
        if not scores:
            return 0
        
        # Normalize to -1 to 1 range
        return sum(scores) / max(len(scores), len(words) / 5)
    
    def _emoji_analysis(self, text: str) -> Optional[float]:
        """Analyze sentiment from emojis"""
        positive_count = len(re.findall(self.EMOJI_PATTERNS['positive'], text))
        negative_count = len(re.findall(self.EMOJI_PATTERNS['negative'], text))
        neutral_count = len(re.findall(self.EMOJI_PATTERNS['neutral'], text))
        
        total = positive_count + negative_count + neutral_count
        
        if total == 0:
            return None
        
        # Calculate weighted score
        score = (positive_count * 0.8 - negative_count * 0.8) / total
        return max(-1, min(1, score))
    
    def _pattern_analysis(self, text: str) -> Optional[float]:
        """Analyze using pattern matching for sentiment indicators"""
        score = 0
        indicators = 0
        
        text_lower = text.lower()
        
        # Exclamation marks (can indicate strong emotion)
        exclamation_count = text.count('!')
        if exclamation_count > 0:
            indicators += 1
            # Exclamations amplify existing sentiment
            # Multiple exclamations suggest stronger emotion
            score += min(exclamation_count * 0.05, 0.2)
        
        # Question marks might indicate uncertainty
        question_count = text.count('?')
        if question_count > 0:
            indicators += 1
            score -= min(question_count * 0.02, 0.1)
        
        # ALL CAPS (strong emotion)
        words = text.split()
        caps_words = sum(1 for w in words if w.isupper() and len(w) > 2)
        if caps_words > 0:
            indicators += 1
            # Caps can indicate strong emotion but could be positive or negative
            score += 0.1 * (caps_words / max(len(words), 1))
        
        # Check for common positive patterns
        positive_patterns = [
            r'\b(lol|lmao|haha|hehe)\b',
            r'\b(thank(s|you)?)\b',
            r'\b(congrat(s|ulations)?)\b',
            r'\bwell done\b',
            r'\bgood (job|work)\b',
        ]
        for pattern in positive_patterns:
            if re.search(pattern, text_lower):
                indicators += 1
                score += 0.2
        
        # Check for negative patterns
        negative_patterns = [
            r'\b(ugh|ew|yuck)\b',
            r'\b(unfortunately)\b',
            r'\bwaste of\b',
            r'\b(can\'t|cannot) stand\b',
        ]
        for pattern in negative_patterns:
            if re.search(pattern, text_lower):
                indicators += 1
                score -= 0.2
        
        if indicators == 0:
            return None
        
        return max(-1, min(1, score))
    
    def _calculate_confidence(self, text: str, valid_scores: List[Tuple[float, float]]) -> float:
        """Calculate confidence in the sentiment analysis"""
        confidence = 0.5  # Base confidence
        
        # More text = higher confidence
        word_count = len(text.split())
        if word_count > 50:
            confidence += 0.2
        elif word_count > 20:
            confidence += 0.1
        elif word_count < 5:
            confidence -= 0.1
        
        # More signals = higher confidence
        signal_count = len(valid_scores)
        confidence += signal_count * 0.1
        
        # Agreement between methods = higher confidence
        if len(valid_scores) >= 2:
            scores_only = [s for s, _ in valid_scores]
            # Check if all scores have the same sign
            if all(s > 0 for s in scores_only if s != 0) or all(s < 0 for s in scores_only if s != 0):
                confidence += 0.15
        
        return min(max(confidence, 0.1), 1.0)
    
    def analyze_batch(self, texts: List[str]) -> List[Dict[str, Any]]:
        """Analyze multiple texts"""
        return [self.analyze(text) for text in texts]
