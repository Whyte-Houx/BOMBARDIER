import { connectRedis, loopQueue } from "./common.js";

/**
 * Research Worker
 * Per dev_docs/components_modules/specifications.md - IResearchService
 * 
 * Deep analysis of approved profiles:
 * - Timeline analysis (topics, activity patterns)
 * - Interest graph extraction
 * - Sentiment analysis
 * - Risk assessment
 */

function apiBase() { return process.env.API_URL || "http://localhost:4050"; }

// ============================================================================
// Analysis Functions
// ============================================================================

interface ProfileData {
  _id: string;
  platform: string;
  username: string;
  bio?: string;
  metadata?: any;
  posts?: Array<{ content: string; timestamp: string; engagement?: any }>;
}

interface ResearchResult {
  interests: string[];
  sentiment: { overall: number; confidence: number };
  riskScore: number;
  analysisData: {
    topTopics: string[];
    activityPattern: string;
    engagementLevel: string;
    communicationStyle: string;
  };
}

// Interest extraction using keyword analysis
function extractInterests(profile: ProfileData): string[] {
  const interests: Set<string> = new Set();
  const text = [profile.bio || "", ...(profile.posts || []).map(p => p.content || "")].join(" ").toLowerCase();

  // Keyword categories for interest detection
  const interestKeywords: Record<string, string[]> = {
    technology: ["tech", "programming", "coding", "software", "developer", "ai", "machine learning", "startup"],
    sports: ["sports", "fitness", "gym", "running", "football", "basketball", "soccer", "workout"],
    music: ["music", "guitar", "piano", "singing", "concert", "musician", "band", "playlist"],
    travel: ["travel", "adventure", "exploring", "wanderlust", "vacation", "trip", "destination"],
    food: ["food", "cooking", "chef", "recipe", "restaurant", "foodie", "cuisine", "baking"],
    art: ["art", "design", "creative", "photography", "illustration", "drawing", "artist"],
    business: ["business", "entrepreneur", "startup", "marketing", "sales", "growth", "CEO", "founder"],
    gaming: ["gaming", "gamer", "video games", "esports", "twitch", "streaming", "xbox", "playstation"],
    fashion: ["fashion", "style", "clothing", "beauty", "makeup", "skincare", "model"],
    health: ["health", "wellness", "mental health", "meditation", "yoga", "mindfulness", "self-care"]
  };

  for (const [category, keywords] of Object.entries(interestKeywords)) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        interests.add(category);
        break;
      }
    }
  }

  return Array.from(interests);
}

// Simple sentiment analysis (in production, use NLP library or OpenAI)
function analyzeSentiment(profile: ProfileData): { overall: number; confidence: number } {
  const text = [profile.bio || "", ...(profile.posts || []).map(p => p.content || "")].join(" ").toLowerCase();

  const positiveWords = ["love", "great", "amazing", "happy", "excited", "wonderful", "fantastic", "awesome", "excellent", "good", "best", "beautiful", "enjoying", "grateful", "blessed"];
  const negativeWords = ["hate", "terrible", "awful", "angry", "frustrated", "disappointed", "sad", "worst", "bad", "ugly", "annoying", "boring", "struggling"];

  let positiveCount = 0;
  let negativeCount = 0;

  for (const word of positiveWords) {
    positiveCount += (text.match(new RegExp(word, "g")) || []).length;
  }
  for (const word of negativeWords) {
    negativeCount += (text.match(new RegExp(word, "g")) || []).length;
  }

  const total = positiveCount + negativeCount;
  if (total === 0) {
    return { overall: 0, confidence: 0.1 }; // Neutral with low confidence
  }

  const overall = (positiveCount - negativeCount) / total; // -1 to 1
  const confidence = Math.min(1, total / 10); // More words = higher confidence

  return { overall: Math.round(overall * 100) / 100, confidence: Math.round(confidence * 100) / 100 };
}

// Risk assessment
function assessRisk(profile: ProfileData): number {
  let riskScore = 0;
  const text = [profile.bio || "", ...(profile.posts || []).map(p => p.content || "")].join(" ").toLowerCase();

  // Red flags in content
  const redFlags = [
    { pattern: /scam|fraud|fake|illegal/i, weight: 30 },
    { pattern: /hate|violence|threat|kill/i, weight: 40 },
    { pattern: /nsfw|adult|xxx/i, weight: 20 },
    { pattern: /crypto.*guarantee|guaranteed.*profit/i, weight: 25 },
    { pattern: /buy now|limited time|act fast/i, weight: 15 }
  ];

  for (const { pattern, weight } of redFlags) {
    if (pattern.test(text)) {
      riskScore += weight;
    }
  }

  // Account characteristics that increase risk
  const meta = profile.metadata || {};

  // Very new account
  if (meta.joinDate) {
    const age = Date.now() - new Date(meta.joinDate).getTime();
    if (age < 30 * 24 * 60 * 60 * 1000) { // Less than 30 days
      riskScore += 10;
    }
  }

  // Suspicious follower patterns
  if (meta.followers && meta.following) {
    const ratio = meta.followers / (meta.following || 1);
    if (ratio > 50 || ratio < 0.02) {
      riskScore += 10;
    }
  }

  return Math.min(100, riskScore);
}

// Activity pattern analysis
function analyzeActivityPattern(profile: ProfileData): string {
  const posts = profile.posts || [];
  if (posts.length < 2) return "insufficient_data";

  const timestamps = posts.map(p => new Date(p.timestamp).getTime()).sort((a, b) => a - b);
  const lastWeek = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentPosts = timestamps.filter(t => t > lastWeek).length;

  if (recentPosts > 14) return "very_active";
  if (recentPosts > 7) return "active";
  if (recentPosts > 2) return "moderate";
  if (recentPosts > 0) return "occasional";
  return "inactive";
}

// Communication style analysis
function analyzeCommunicationStyle(profile: ProfileData): string {
  const text = [profile.bio || "", ...(profile.posts || []).map(p => p.content || "")].join(" ");

  // Check formality
  const casualIndicators = ["lol", "omg", "tbh", "ngl", "fr", "💀", "😂", "🤣"];
  const formalIndicators = ["therefore", "however", "furthermore", "regarding", "sincerely"];

  let casualCount = 0;
  let formalCount = 0;

  const lowerText = text.toLowerCase();
  for (const ind of casualIndicators) {
    if (lowerText.includes(ind)) casualCount++;
  }
  for (const ind of formalIndicators) {
    if (lowerText.includes(ind)) formalCount++;
  }

  if (casualCount > formalCount * 2) return "casual";
  if (formalCount > casualCount * 2) return "formal";
  return "balanced";
}

// Main research function
function researchProfile(profile: ProfileData): ResearchResult {
  const interests = extractInterests(profile);
  const sentiment = analyzeSentiment(profile);
  const riskScore = assessRisk(profile);
  const activityPattern = analyzeActivityPattern(profile);
  const communicationStyle = analyzeCommunicationStyle(profile);

  // Calculate engagement level from metadata
  const meta = profile.metadata || {};
  let engagementLevel = "unknown";
  if (meta.followers) {
    if (meta.followers > 10000) engagementLevel = "influencer";
    else if (meta.followers > 1000) engagementLevel = "high";
    else if (meta.followers > 100) engagementLevel = "medium";
    else engagementLevel = "low";
  }

  return {
    interests,
    sentiment,
    riskScore,
    analysisData: {
      topTopics: interests.slice(0, 5),
      activityPattern,
      engagementLevel,
      communicationStyle
    }
  };
}

// ============================================================================
// Worker Handler
// ============================================================================

async function handle(payload: any) {
  const campaignId = payload.campaignId;
  console.log(`[research-worker] Processing campaign ${campaignId}`);

  try {
    // Fetch approved profiles for this campaign
    const res = await fetch(`${apiBase()}/profiles?campaignId=${encodeURIComponent(campaignId)}&status=approved&limit=100`);
    if (!res.ok) {
      console.error(`[research-worker] Failed to fetch profiles: ${res.status}`);
      return;
    }

    const approved: ProfileData[] = await res.json();
    console.log(`[research-worker] Found ${approved.length} approved profiles to research`);

    let processed = 0;

    for (const profile of approved) {
      try {
        const result = researchProfile(profile);

        console.log(`[research-worker] Profile ${profile.username}: interests=${result.interests.join(",")}, sentiment=${result.sentiment.overall}, risk=${result.riskScore}`);

        // Update profile with research data
        await fetch(`${apiBase()}/profiles`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            platform: profile.platform,
            username: profile.username,
            status: "approved", // Keep approved status
            campaignIds: [campaignId],
            interests: result.interests,
            sentiment: result.sentiment,
            riskScore: result.riskScore,
            metadata: {
              ...profile.metadata,
              researchData: result.analysisData,
              researchedAt: new Date().toISOString()
            }
          })
        });

        processed++;
      } catch (err) {
        console.error(`[research-worker] Error researching profile ${profile.username}:`, err);
      }
    }

    console.log(`[research-worker] Campaign ${campaignId}: Researched ${processed}/${approved.length} profiles`);

    // Queue engagement job
    if (processed > 0) {
      await redis.rPush("queue:engagement", JSON.stringify({ campaignId }));
      console.log(`[research-worker] Queued engagement job for campaign ${campaignId}`);
    }

  } catch (err) {
    console.error(`[research-worker] Error processing campaign ${campaignId}:`, err);
    throw err;
  }
}

const redis = await connectRedis();
console.log("[research-worker] Started, waiting for jobs...");
await loopQueue(redis, "queue:research", handle);