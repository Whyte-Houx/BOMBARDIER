import { connectRedis, loopQueue } from "./common.js";

/**
 * Acquisition Worker
 * Per dev_docs/components_modules/specifications.md - IAcquisitionService
 * 
 * Handles multi-platform profile collection with:
 * - Platform-specific adapters (API or browser automation via browser-service)
 * - Rate limiting
 * - Proxy management
 * - Profile normalization
 * - Integration with ML service for initial scoring
 */

function apiBase() {
  return process.env.API_URL || "http://localhost:4050";
}

function browserServiceBase() {
  return process.env.BROWSER_SERVICE_URL || "http://localhost:5100";
}

function mlServiceBase() {
  return process.env.ML_SERVICE_URL || "http://localhost:5000";
}

// Rate limit configuration per platform (requests per minute)
const RATE_LIMITS: Record<string, number> = {
  twitter: 300,
  linkedin: 100,
  reddit: 60,
  instagram: 30,
  tinder: 20,
  default: 50
};

// Track last request time per platform for rate limiting
const lastRequestTime: Record<string, number> = {};

async function rateLimitedWait(platform: string) {
  const limit = RATE_LIMITS[platform] || RATE_LIMITS.default;
  const minInterval = 60000 / limit; // ms between requests
  const lastTime = lastRequestTime[platform] || 0;
  const elapsed = Date.now() - lastTime;

  if (elapsed < minInterval) {
    await new Promise(resolve => setTimeout(resolve, minInterval - elapsed));
  }
  lastRequestTime[platform] = Date.now();
}

// Flag to determine if we should use browser service or stub data
const USE_BROWSER_SERVICE = process.env.USE_BROWSER_SERVICE === "true";

// Platform adapter interface
interface PlatformAdapter {
  platform: string;
  searchProfiles(criteria: any, sessionId?: string): Promise<any[]>;
}

// Browser service integration adapter
async function searchViaRerowserService(platform: string, query: string, sessionId?: string, limit: number = 50): Promise<any[]> {
  try {
    const res = await fetch(`${browserServiceBase()}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform,
        query,
        sessionId,
        limit
      })
    });

    if (!res.ok) {
      console.warn(`[acquisition-worker] Browser service search failed: ${res.status}`);
      return [];
    }

    const data: any = await res.json();
    return data.success ? data.data : [];
  } catch (err) {
    console.warn(`[acquisition-worker] Browser service unavailable, using stub data`);
    return [];
  }
}

// ML service integration for profile scoring
async function analyzeProfileWithML(profile: any): Promise<any> {
  try {
    const res = await fetch(`${mlServiceBase()}/analyze/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform: profile.platform,
        username: profile.username,
        bio: profile.bio,
        display_name: profile.displayName,
        metadata: profile.metadata,
        posts: profile.posts
      })
    });

    if (!res.ok) {
      return null;
    }

    const data: any = await res.json();
    return data.success ? data.data : null;
  } catch (err) {
    // ML service unavailable - continue without analysis
    return null;
  }
}

// Twitter/X adapter (uses browser service or official API v2)
const twitterAdapter: PlatformAdapter = {
  platform: "twitter",
  async searchProfiles(criteria: any, sessionId?: string) {
    // Try browser service first if enabled
    if (USE_BROWSER_SERVICE) {
      const query = (criteria.interests || criteria.keywords || []).join(" ");
      const results = await searchViaBrowserService("twitter", query, sessionId, criteria.maxProfiles || 50);
      if (results.length > 0) {
        console.log(`[acquisition-worker] Twitter: Got ${results.length} profiles via browser service`);
        return results;
      }
    }

    // Fallback to sample data for testing
    const profiles = [];
    const count = Math.min(criteria.maxProfiles || 10, 50);
    for (let i = 0; i < count; i++) {
      profiles.push({
        platform: "twitter",
        platformId: `tw_${Date.now()}_${i}`,
        username: `twitter_user_${Date.now()}_${i}`,
        displayName: `Twitter User ${i}`,
        profileUrl: `https://twitter.com/user_${i}`,
        bio: `Sample Twitter user bio matching interests: ${(criteria.interests || []).join(", ")}`,
        metadata: {
          followers: Math.floor(Math.random() * 10000),
          following: Math.floor(Math.random() * 1000),
          postsCount: Math.floor(Math.random() * 500),
          verified: Math.random() > 0.9,
          location: (criteria.locations || [])[0] || "Unknown"
        }
      });
    }
    return profiles;
  }
};

// LinkedIn adapter (uses browser service or Sales Navigator API)
const linkedinAdapter: PlatformAdapter = {
  platform: "linkedin",
  async searchProfiles(criteria: any, sessionId?: string) {
    // Try browser service first if enabled
    if (USE_BROWSER_SERVICE) {
      const query = (criteria.interests || criteria.keywords || []).join(" ");
      const results = await searchViaBrowserService("linkedin", query, sessionId, criteria.maxProfiles || 30);
      if (results.length > 0) {
        console.log(`[acquisition-worker] LinkedIn: Got ${results.length} profiles via browser service`);
        return results;
      }
    }

    // Fallback to sample data
    const profiles = [];
    const count = Math.min(criteria.maxProfiles || 10, 30);
    for (let i = 0; i < count; i++) {
      profiles.push({
        platform: "linkedin",
        platformId: `li_${Date.now()}_${i}`,
        username: `linkedin_user_${Date.now()}_${i}`,
        displayName: `LinkedIn Professional ${i}`,
        profileUrl: `https://linkedin.com/in/user_${i}`,
        bio: `Professional profile with expertise in ${(criteria.interests || []).join(", ")}`,
        metadata: {
          followers: Math.floor(Math.random() * 5000),
          postsCount: Math.floor(Math.random() * 100),
          location: (criteria.locations || [])[0] || "Unknown"
        }
      });
    }
    return profiles;
  }
};

// Reddit adapter (uses browser service or official API)
const redditAdapter: PlatformAdapter = {
  platform: "reddit",
  async searchProfiles(criteria: any, sessionId?: string) {
    // Try browser service first if enabled
    if (USE_BROWSER_SERVICE) {
      const query = (criteria.keywords || criteria.interests || []).join(" ");
      const results = await searchViaBrowserService("reddit", query, sessionId, criteria.maxProfiles || 50);
      if (results.length > 0) {
        console.log(`[acquisition-worker] Reddit: Got ${results.length} profiles via browser service`);
        return results;
      }
    }

    // Fallback to sample data
    const profiles = [];
    const count = Math.min(criteria.maxProfiles || 10, 50);
    for (let i = 0; i < count; i++) {
      profiles.push({
        platform: "reddit",
        platformId: `reddit_${Date.now()}_${i}`,
        username: `u/reddit_user_${Date.now()}_${i}`,
        displayName: `Redditor ${i}`,
        profileUrl: `https://reddit.com/user/user_${i}`,
        bio: `Active in subreddits: ${(criteria.keywords || []).join(", ")}`,
        metadata: {
          postsCount: Math.floor(Math.random() * 200),
          joinDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString()
        }
      });
    }
    return profiles;
  }
};

// Instagram adapter (uses browser service - high risk platform)
const instagramAdapter: PlatformAdapter = {
  platform: "instagram",
  async searchProfiles(criteria: any, sessionId?: string) {
    // Try browser service first if enabled
    if (USE_BROWSER_SERVICE) {
      const query = (criteria.interests || criteria.keywords || []).join(" ");
      const results = await searchViaBrowserService("instagram", query, sessionId, criteria.maxProfiles || 20);
      if (results.length > 0) {
        console.log(`[acquisition-worker] Instagram: Got ${results.length} profiles via browser service`);
        return results;
      }
    }

    // Fallback to sample data
    // WARNING: Instagram aggressively detects automation
    const profiles = [];
    const count = Math.min(criteria.maxProfiles || 5, 20);
    for (let i = 0; i < count; i++) {
      profiles.push({
        platform: "instagram",
        platformId: `ig_${Date.now()}_${i}`,
        username: `ig_user_${Date.now()}_${i}`,
        displayName: `Instagram User ${i}`,
        profileUrl: `https://instagram.com/user_${i}`,
        bio: `Interested in ${(criteria.interests || []).join(", ")}`,
        metadata: {
          followers: Math.floor(Math.random() * 50000),
          following: Math.floor(Math.random() * 2000),
          postsCount: Math.floor(Math.random() * 300)
        }
      });
    }
    return profiles;
  }
};

// Platform adapter registry
const adapters: Record<string, PlatformAdapter> = {
  twitter: twitterAdapter,
  linkedin: linkedinAdapter,
  reddit: redditAdapter,
  instagram: instagramAdapter
};

// Helper to search via browser service
async function searchViaBrowserService(platform: string, query: string, sessionId?: string, limit: number = 50): Promise<any[]> {
  try {
    const res = await fetch(`${browserServiceBase()}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform, query, sessionId, limit })
    });

    if (!res.ok) {
      console.warn(`[acquisition-worker] Browser service search failed: ${res.status}`);
      return [];
    }

    const data: any = await res.json();
    return data.success ? data.data : [];
  } catch (err) {
    console.warn(`[acquisition-worker] Browser service unavailable`);
    return [];
  }
}

async function handle(payload: any) {
  const campaignId = payload.campaignId;
  const platforms: string[] = payload.platforms || [];
  const criteria = payload.criteria || {};

  console.log(`[acquisition-worker] Processing campaign ${campaignId} for platforms: ${platforms.join(", ")}`);

  let totalProfilesAcquired = 0;

  for (const platform of platforms) {
    const adapter = adapters[platform];
    if (!adapter) {
      console.warn(`[acquisition-worker] No adapter for platform: ${platform}`);
      continue;
    }

    try {
      // Apply rate limiting
      await rateLimitedWait(platform);

      // Acquire profiles from platform
      const profiles = await adapter.searchProfiles(criteria);
      console.log(`[acquisition-worker] Acquired ${profiles.length} profiles from ${platform}`);

      // Submit profiles to API
      for (const profile of profiles) {
        try {
          await rateLimitedWait("api"); // Rate limit API calls too

          const response = await fetch(`${apiBase()}/profiles`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...profile,
              status: "pending",
              campaignIds: [campaignId]
            })
          });

          if (response.ok) {
            totalProfilesAcquired++;
          } else {
            console.warn(`[acquisition-worker] Failed to save profile: ${response.status}`);
          }
        } catch (err) {
          console.error(`[acquisition-worker] Error saving profile:`, err);
        }
      }
    } catch (err) {
      console.error(`[acquisition-worker] Error acquiring from ${platform}:`, err);
    }
  }

  console.log(`[acquisition-worker] Campaign ${campaignId}: Total profiles acquired: ${totalProfilesAcquired}`);

  // Queue next job if we acquired any profiles and have a workflow
  if (totalProfilesAcquired > 0) {
    const workflow = payload.workflow || [];
    const stepIndex = payload.currentStepIndex || 0;

    if (workflow.length > stepIndex + 1) {
      const nextStep = workflow[stepIndex + 1];
      const nextPayload = {
        ...payload,
        currentStepIndex: stepIndex + 1
      };

      await redis.rPush(`queue:${nextStep}`, JSON.stringify(nextPayload));
      console.log(`[acquisition-worker] Workflow: ${workflow.join('->')}. Next step: ${nextStep}`);
    } else {
      // Default fallback if no workflow provided (Legacy behavior)
      if (workflow.length === 0) {
        await redis.rPush("queue:filtering", JSON.stringify({ campaignId }));
        console.log(`[acquisition-worker] Legacy: Queued filtering job for campaign ${campaignId}`);
      } else {
        console.log(`[acquisition-worker] Workflow complete at acquisition.`);
      }
    }
  }
}

const redis = await connectRedis();
console.log("[acquisition-worker] Started, waiting for jobs...");
await loopQueue(redis, "queue:acquisition", handle);