import { connectRedis, loopQueue } from "./common.js";

/**
 * Filtering Worker
 * Per dev_docs/components_modules/specifications.md - IFilteringService
 * 
 * AI-powered filtering with:
 * - Multi-layer bot detection (local heuristics + ML service)
 * - Quality scoring
 * - Relevance ranking
 * - Interest extraction
 */

function apiBase() { return process.env.API_URL || "http://localhost:4050"; }
function mlServiceBase() { return process.env.ML_SERVICE_URL || "http://localhost:5000"; }

// Flag to use ML service for enhanced analysis
const USE_ML_SERVICE = process.env.USE_ML_SERVICE !== "false"; // Enabled by default

// ML Service integration
async function analyzeProfileWithML(profile: ProfileData): Promise<MLAnalysisResult | null> {
  if (!USE_ML_SERVICE) return null;

  try {
    const res = await fetch(`${mlServiceBase()}/analyze/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform: profile.platform,
        username: profile.username,
        bio: profile.bio,
        display_name: profile.displayName || profile.username,
        metadata: {
          followers: profile.metadata?.followers,
          following: profile.metadata?.following,
          posts_count: profile.metadata?.postsCount,
          verified: profile.metadata?.verified,
          join_date: profile.metadata?.joinDate,
          last_active: profile.metadata?.lastActive
        },
        posts: (profile.posts || []).map(p => ({
          id: p.id || "",
          content: p.content || "",
          timestamp: p.timestamp || p.createdAt
        }))
      })
    });

    if (!res.ok) {
      console.warn(`[filtering-worker] ML service returned ${res.status}`);
      return null;
    }

    const data: any = await res.json();
    if (!data.success) return null;

    return {
      botDetection: data.data.bot_detection || {},
      sentiment: data.data.sentiment || {},
      interests: data.data.interests || [],
      qualityScore: data.data.quality_score || {}
    };
  } catch (err) {
    console.warn(`[filtering-worker] ML service unavailable, using local heuristics`);
    return null;
  }
}

interface MLAnalysisResult {
  botDetection: {
    score?: number;
    is_bot?: boolean;
    flags?: string[];
    component_scores?: Record<string, number>;
  };
  sentiment: {
    overall?: number;
    label?: string;
    confidence?: number;
  };
  interests: string[];
  qualityScore: {
    overall?: number;
    components?: Record<string, number>;
    recommendation?: string;
    tier?: string;
  };
}


// ============================================================================
// Bot Detection - Multi-Layer Approach per dev docs
// ============================================================================

interface ProfileData {
  _id: string;
  platform: string;
  username: string;
  displayName?: string;
  bio?: string;
  metadata?: {
    followers?: number;
    following?: number;
    postsCount?: number;
    verified?: boolean;
    joinDate?: string;
    lastActive?: string;
  };
  posts?: any[];
}

interface FilterResult {
  isBot: boolean;
  botScore: number; // 0-100, higher = more likely bot
  qualityScore: number; // 0-100, higher = better quality
  relevanceScore: number; // 0-100, higher = more relevant
  flags: string[];
}

// Layer 1: Statistical Anomalies Detection
function detectStatisticalAnomalies(profile: ProfileData): { score: number; flags: string[] } {
  let score = 0;
  const flags: string[] = [];
  const meta = profile.metadata || {};

  // Follower/following ratio extremes
  const followers = meta.followers || 0;
  const following = meta.following || 0;
  const ratio = following > 0 ? followers / following : 0;

  if (ratio > 100) {
    score += 10;
    flags.push("extreme_follower_ratio_high");
  } else if (ratio < 0.01 && followers > 100) {
    score += 15;
    flags.push("extreme_follower_ratio_low");
  }

  // Too regular posting (bots often post at exact intervals)
  if (meta.postsCount && meta.postsCount > 1000) {
    score += 5;
    flags.push("high_post_count");
  }

  // New account with high activity
  if (meta.joinDate) {
    const accountAge = Date.now() - new Date(meta.joinDate).getTime();
    const daysOld = accountAge / (24 * 60 * 60 * 1000);
    if (daysOld < 30 && (meta.postsCount || 0) > 100) {
      score += 20;
      flags.push("new_account_high_activity");
    }
  }

  return { score, flags };
}

// Layer 2: Content Analysis
function analyzeContent(profile: ProfileData): { score: number; flags: string[] } {
  let score = 0;
  const flags: string[] = [];

  // Generic/template bio detection
  const bio = (profile.bio || "").toLowerCase();
  const genericPhrases = [
    "follow me", "dm for collab", "crypto", "nft", "get rich",
    "make money", "dm me now", "limited offer", "act now"
  ];

  for (const phrase of genericPhrases) {
    if (bio.includes(phrase)) {
      score += 15;
      flags.push(`suspicious_bio_phrase: ${phrase}`);
      break; // Only flag once
    }
  }

  // No bio at all
  if (!profile.bio || profile.bio.trim().length < 10) {
    score += 10;
    flags.push("missing_or_short_bio");
  }

  // Check for excessive links/mentions in bio
  const linkCount = (bio.match(/http|www\.|\.com|\.io/g) || []).length;
  if (linkCount > 3) {
    score += 10;
    flags.push("excessive_links_in_bio");
  }

  return { score, flags };
}

// Layer 3: Temporal Pattern Analysis
function analyzeTemporalPatterns(profile: ProfileData): { score: number; flags: string[] } {
  let score = 0;
  const flags: string[] = [];

  // If we have posts, analyze posting patterns
  const posts = profile.posts || [];
  if (posts.length > 1) {
    // Check for suspiciously regular posting intervals
    const timestamps = posts
      .map(p => new Date(p.timestamp).getTime())
      .sort((a, b) => a - b);

    if (timestamps.length > 2) {
      const intervals: number[] = [];
      for (let i = 1; i < timestamps.length; i++) {
        intervals.push(timestamps[i] - timestamps[i - 1]);
      }

      // Calculate variance in intervals
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const variance = intervals.reduce((sum, int) => sum + Math.pow(int - avgInterval, 2), 0) / intervals.length;
      const stdDev = Math.sqrt(variance);
      const coefficientOfVariation = avgInterval > 0 ? stdDev / avgInterval : 0;

      // Too regular = suspicious (bots post at exact intervals)
      if (coefficientOfVariation < 0.1 && intervals.length > 5) {
        score += 25;
        flags.push("suspiciously_regular_posting");
      }
    }
  }

  // Check last active time
  if (profile.metadata?.lastActive) {
    const lastActive = new Date(profile.metadata.lastActive);
    const daysSinceActive = (Date.now() - lastActive.getTime()) / (24 * 60 * 60 * 1000);
    if (daysSinceActive > 90) {
      score += 5;
      flags.push("inactive_user");
    }
  }

  return { score, flags };
}

// Calculate quality score (inverse of bot likelihood + engagement potential)
function calculateQualityScore(profile: ProfileData, botScore: number): number {
  let quality = 100 - botScore; // Start with inverse of bot score

  const meta = profile.metadata || {};

  // Bonus for verified accounts
  if (meta.verified) {
    quality += 20;
  }

  // Engagement potential (followers matter but not too many)
  const followers = meta.followers || 0;
  if (followers > 100 && followers < 50000) {
    quality += 10;
  } else if (followers >= 50000 && followers < 500000) {
    quality += 5;
  }

  // Has reasonable bio
  if (profile.bio && profile.bio.length > 50) {
    quality += 5;
  }

  // Has post history
  if ((profile.posts?.length || 0) > 5) {
    quality += 5;
  }

  return Math.max(0, Math.min(100, quality));
}

// Main filter function (local heuristics only)
function filterProfileLocal(profile: ProfileData): FilterResult {
  const layer1 = detectStatisticalAnomalies(profile);
  const layer2 = analyzeContent(profile);
  const layer3 = analyzeTemporalPatterns(profile);

  const botScore = Math.min(100, layer1.score + layer2.score + layer3.score);
  const qualityScore = calculateQualityScore(profile, botScore);

  // Relevance score would typically use ML/embeddings - for now, use simple heuristics
  let relevanceScore = 50; // Default baseline
  if (profile.bio && profile.bio.length > 20) relevanceScore += 20;
  if ((profile.posts?.length || 0) > 0) relevanceScore += 20;
  if (profile.metadata?.followers && profile.metadata.followers > 100) relevanceScore += 10;
  relevanceScore = Math.min(100, relevanceScore);

  return {
    isBot: botScore > 50,
    botScore,
    qualityScore,
    relevanceScore,
    flags: [...layer1.flags, ...layer2.flags, ...layer3.flags]
  };
}

// Enhanced filter function with ML service integration
async function filterProfile(profile: ProfileData): Promise<FilterResult & { mlAnalysis?: MLAnalysisResult; interests?: string[] }> {
  // Get local heuristic results first
  const localResult = filterProfileLocal(profile);

  // Try to get ML service analysis
  const mlResult = await analyzeProfileWithML(profile);

  if (!mlResult) {
    // ML service unavailable, return local results
    return localResult;
  }

  console.log(`[filtering-worker] ML analysis for ${profile.username}: bot=${mlResult.botDetection.score}, quality=${mlResult.qualityScore.overall}`);

  // Blend local heuristics with ML results (ML weighted more heavily)
  const mlBotScore = mlResult.botDetection.score || 0;
  const mlQualityScore = mlResult.qualityScore.overall || 50;

  // Weighted average: 40% local, 60% ML
  const blendedBotScore = Math.round(localResult.botScore * 0.4 + mlBotScore * 0.6);
  const blendedQualityScore = Math.round(localResult.qualityScore * 0.4 + mlQualityScore * 0.6);

  // Combine flags from both sources
  const allFlags = [...localResult.flags, ...(mlResult.botDetection.flags || [])];

  // Use ML sentiment for relevance adjustment
  let relevanceScore = localResult.relevanceScore;
  if (mlResult.sentiment.label === "positive") {
    relevanceScore = Math.min(100, relevanceScore + 10);
  } else if (mlResult.sentiment.label === "negative") {
    relevanceScore = Math.max(0, relevanceScore - 10);
  }

  return {
    isBot: blendedBotScore > 50,
    botScore: blendedBotScore,
    qualityScore: blendedQualityScore,
    relevanceScore,
    flags: [...new Set(allFlags)], // Deduplicate flags
    mlAnalysis: mlResult,
    interests: mlResult.interests
  };
}

// ============================================================================
// Worker Handler
// ============================================================================

// Thresholds for auto-approval/rejection
const BOT_THRESHOLD = 50; // Above this = auto-reject
const QUALITY_THRESHOLD = 30; // Below this = auto-reject
const AUTO_APPROVE_THRESHOLD = 70; // Quality above this + low bot score = auto-approve

async function handle(payload: any) {
  const campaignId = payload.campaignId;
  console.log(`[filtering-worker] Processing campaign ${campaignId}`);

  try {
    // Fetch pending profiles for this campaign
    const res = await fetch(`${apiBase()}/profiles?campaignId=${encodeURIComponent(campaignId)}&status=pending&limit=100`);
    if (!res.ok) {
      console.error(`[filtering-worker] Failed to fetch profiles: ${res.status}`);
      return;
    }

    const pending: ProfileData[] = await res.json();
    console.log(`[filtering-worker] Found ${pending.length} pending profiles`);

    let approved = 0;
    let rejected = 0;
    let pendingReview = 0;

    for (const profile of pending) {
      const result = await filterProfile(profile);

      console.log(`[filtering-worker] Profile ${profile.username}: bot=${result.botScore}, quality=${result.qualityScore}, flags=${result.flags.join(",")}`);

      // Auto-reject definite bots
      if (result.isBot || result.qualityScore < QUALITY_THRESHOLD) {
        await fetch(`${apiBase()}/profiles/${profile._id}/reject`, { method: "POST" });
        rejected++;
        continue;
      }

      // Update profile with scores and interests from ML analysis
      if (result.interests && result.interests.length > 0) {
        await fetch(`${apiBase()}/profiles/${profile._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filteringScores: {
              botScore: result.botScore,
              qualityScore: result.qualityScore,
              relevanceScore: result.relevanceScore,
              flags: result.flags
            },
            interests: result.interests
          })
        }).catch(() => { }); // Don't fail if update doesn't work
      }

      // Auto-approve high quality, low bot score profiles
      if (result.qualityScore >= AUTO_APPROVE_THRESHOLD && result.botScore < 20) {
        await fetch(`${apiBase()}/profiles/${profile._id}/approve`, { method: "POST" });
        approved++;
        continue;
      }

      // Others stay pending for human review
      pendingReview++;
    }

    console.log(`[filtering-worker] Campaign ${campaignId}: approved=${approved}, rejected=${rejected}, pending_review=${pendingReview}`);

    // Queue next job for approved profiles if workflow exists
    if (approved > 0) {
      const workflow = payload.workflow || [];
      const stepIndex = payload.currentStepIndex || 0;

      if (workflow.length > stepIndex + 1) {
        const nextStep = workflow[stepIndex + 1];
        const nextPayload = {
          ...payload,
          currentStepIndex: stepIndex + 1
        };
        await redis.rPush(`queue:${nextStep}`, JSON.stringify(nextPayload));
        console.log(`[filtering-worker] Workflow: ${workflow.join('->')}. Next step: ${nextStep}`);
      } else {
        // Fallback or end of workflow
        if (workflow.length === 0) {
          await redis.rPush("queue:research", JSON.stringify({ campaignId }));
          console.log(`[filtering-worker] Legacy: Queued research job for campaign ${campaignId}`);
        } else {
          console.log(`[filtering-worker] Workflow complete at filtering.`);
        }
      }
    }

  } catch (err) {
    console.error(`[filtering-worker] Error processing campaign ${campaignId}:`, err);
    throw err;
  }
}

const redis = await connectRedis();
console.log("[filtering-worker] Started, waiting for jobs...");
await loopQueue(redis, "queue:filtering", handle);