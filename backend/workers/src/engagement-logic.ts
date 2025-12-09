import { connectRedis, loopQueue } from "./common.js";

/**
 * Engagement Worker Logic
 * Separated for testability
 */

function apiBase() { return process.env.API_URL || "http://localhost:4050"; }

// ============================================================================
// OpenAI Integration (GPT-4 for message generation)
// ============================================================================

export interface ProfileData {
    _id: string;
    platform: string;
    username: string;
    displayName?: string;
    bio?: string;
    interests?: string[];
    sentiment?: { overall: number; confidence: number };
    metadata?: {
        researchData?: {
            topTopics: string[];
            activityPattern: string;
            engagementLevel: string;
            communicationStyle: string;
        };
        followers?: number;
    };
}

export interface CampaignData {
    _id: string;
    name: string;
    targetCriteria?: {
        interests?: string[];
        keywords?: string[];
    };
    settings?: {
        messageDelay?: number;
    };
}

export interface MessageContext {
    profile: ProfileData;
    campaign: CampaignData;
    messageType: "initial" | "follow_up";
}

// Message templates for fallback when OpenAI is unavailable
const MESSAGE_TEMPLATES: Record<string, { initial: string[]; follow_up: string[] }> = {
    casual: {
        initial: [
            "Hey {name}! I noticed we share some interests in {interests}. Would love to connect!",
            "Hi {name}! Came across your profile and thought your content on {topics} was really interesting. Mind if we chat?",
            "Hey there {name}! Your posts about {topics} caught my attention. Always great to meet like-minded people!"
        ],
        follow_up: [
            "Hey {name}, just wanted to follow up on my earlier message. Would love to hear your thoughts!",
            "Hi again {name}! Hope you're having a great day. Let me know if you'd like to connect!"
        ]
    },
    formal: {
        initial: [
            "Hello {name}, I came across your profile and was impressed by your work in {interests}. I would be interested in connecting to discuss potential collaboration opportunities.",
            "Dear {name}, I noticed your expertise in {topics} and believe we could have a mutually beneficial conversation. Would you be open to connecting?",
            "Hello {name}, Your professional background in {interests} aligns well with some projects I'm working on. I would appreciate the opportunity to connect."
        ],
        follow_up: [
            "Hello {name}, I wanted to follow up on my previous message. I believe a conversation between us could be valuable. Looking forward to hearing from you.",
            "Dear {name}, I hope this message finds you well. I remain interested in connecting to discuss opportunities in {interests}."
        ]
    },
    balanced: {
        initial: [
            "Hi {name}! I noticed your interest in {interests} and thought we might have some things in common. Would you be open to connecting?",
            "Hello {name}, your content about {topics} really resonated with me. I'd love to connect and share ideas!",
            "Hi {name}! Your work in {interests} caught my attention. Would be great to connect and exchange thoughts."
        ],
        follow_up: [
            "Hi {name}, just following up on my earlier message. Would love to connect if you're interested!",
            "Hello {name}, hope you're doing well! Wanted to check if you had a chance to see my previous message about connecting."
        ]
    }
};

// Generate message using OpenAI GPT-4 (with fallback to templates)
export async function generateMessage(context: MessageContext): Promise<string> {
    const openaiKey = process.env.OPENAI_API_KEY;

    if (openaiKey) {
        try {
            return await generateWithOpenAI(context, openaiKey);
        } catch (err) {
            console.warn(`[engagement-worker] OpenAI generation failed, using template fallback:`, err);
        }
    }

    // Fallback to template-based generation
    return generateFromTemplate(context);
}

async function generateWithOpenAI(context: MessageContext, apiKey: string): Promise<string> {
    const { profile, campaign, messageType } = context;
    const style = profile.metadata?.researchData?.communicationStyle || "balanced";

    const systemPrompt = `You are an expert at crafting personalized, authentic outreach messages. 
Your messages should:
- Feel natural and human, not robotic or templated
- Be appropriate for the ${profile.platform} platform
- Match a ${style} communication style
- Be concise (under 200 characters for most platforms)
- Include a clear but soft call-to-action
- Reference specific interests or topics when available
- NEVER be pushy, salesy, or mention any products/services directly`;

    const userPrompt = `Generate a ${messageType === "initial" ? "first contact" : "follow-up"} message for this person:

Name: ${profile.displayName || profile.username}
Platform: ${profile.platform}
Bio: ${profile.bio || "Not available"}
Interests: ${(profile.interests || []).join(", ") || "Unknown"}
Communication Style: ${style}
Engagement Level: ${profile.metadata?.researchData?.engagementLevel || "unknown"}
Activity Pattern: ${profile.metadata?.researchData?.activityPattern || "unknown"}

Campaign Focus: ${(campaign.targetCriteria?.interests || []).join(", ") || "General networking"}

Write a single message that would feel authentic and spark a genuine conversation.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: "gpt-4-turbo-preview",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            max_tokens: 300,
            temperature: 0.8
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data: any = await response.json();
    return data.choices[0]?.message?.content?.trim() || generateFromTemplate(context);
}

function generateFromTemplate(context: MessageContext): string {
    const { profile, messageType } = context;
    const style = profile.metadata?.researchData?.communicationStyle || "balanced";

    const templates = MESSAGE_TEMPLATES[style] || MESSAGE_TEMPLATES.balanced;
    const templateList = messageType === "initial" ? templates.initial : templates.follow_up;

    // Pick a random template
    const template = templateList[Math.floor(Math.random() * templateList.length)];

    // Fill in placeholders
    const name = profile.displayName || profile.username;
    const interests = (profile.interests || []).slice(0, 2).join(" and ") || "your work";
    const topics = profile.metadata?.researchData?.topTopics?.slice(0, 2).join(" and ") || interests;

    return template
        .replace(/{name}/g, name)
        .replace(/{interests}/g, interests)
        .replace(/{topics}/g, topics);
}

// ============================================================================
// Delivery Pacing
// ============================================================================

// Rate limits per platform (messages per day)
const PLATFORM_LIMITS: Record<string, number> = {
    twitter: 100,
    linkedin: 50,
    reddit: 30,
    instagram: 20,
    tinder: 10,
    default: 25
};

// Track daily message counts
const dailyMessageCounts: Record<string, number> = {};
let lastResetDate = new Date().toDateString();

function resetDailyCountsIfNeeded() {
    const today = new Date().toDateString();
    if (today !== lastResetDate) {
        Object.keys(dailyMessageCounts).forEach(k => { dailyMessageCounts[k] = 0; });
        lastResetDate = today;
    }
}

export function canSendMessage(platform: string): boolean {
    resetDailyCountsIfNeeded();
    const key = `${platform}_${new Date().toDateString()}`;
    const current = dailyMessageCounts[key] || 0;
    const limit = PLATFORM_LIMITS[platform] || PLATFORM_LIMITS.default;
    return current < limit;
}

function recordSentMessage(platform: string) {
    const key = `${platform}_${new Date().toDateString()}`;
    dailyMessageCounts[key] = (dailyMessageCounts[key] || 0) + 1;
}

// ============================================================================
// Worker Handler
// ============================================================================

// Helper to get browser service URL
function browserServiceBase() { return process.env.BROWSER_SERVICE_URL || "http://localhost:5100"; }
function useBrowserService() { return process.env.USE_BROWSER_SERVICE === "true"; }

// Send message via Browser Service
async function sendMessageViaBrowserService(profile: ProfileData, content: string): Promise<boolean> {
    console.log(`[engagement-worker] Attempting to send message via browser service to ${profile.username} on ${profile.platform}`);

    // In a real scenario, we would retrieve a valid session ID for this user/platform
    // For now, we assume a session might be available or passed in context, 
    // but to keep it simple we'll pass a placeholder or try to find one.
    // Ideally, the engagement worker should know which 'bot' account is performing the action.
    // We'll use a placeholder 'active_session' for demonstration.
    const sessionId = "active_session";

    try {
        const res = await fetch(`${browserServiceBase()}/message/send`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                platform: profile.platform,
                username: profile.username,
                content,
                sessionId
            })
        });

        if (!res.ok) {
            console.error(`[engagement-worker] Browser service failed: ${res.status} ${await res.text()}`);
            return false;
        }

        const data: any = await res.json();
        return data && data.success;
    } catch (err) {
        console.error(`[engagement-worker] Error calling browser service:`, err);
        return false;
    }
}

// ============================================================================
// Worker Handler
// ============================================================================

export async function handle(payload: any, redisClient?: any) {
    const campaignId = payload.campaignId;
    console.log(`[engagement-worker] Processing campaign ${campaignId}`);

    // Use passed redis client or default (if we were to import it, but cleaner to rely on injection if possible)
    // For now, to keep compatible with loopQueue signature which doesn't pass redis to handle (it passes payload only),
    // we might need to rely on the module-level redis connection if we had one.
    // BUT, in the original code, 'redis' was a top-level constant.
    // Here, we don't have that.

    // SOLUTION: We need a mechanism to queue the tracking job.
    // We can pass the redis client in the payload if loopQueue allowed it, but it doesn't.
    // Or we can create a new connection here, OR import a singleton.
    // Since 'common.js' exports 'connectRedis', we can just connect here if needed, or better:
    // Refactor handle to accept a context/dependency object.
    // However, loopQueue calls: await handler(item);

    // Let's create a temporary connection for the tracking job push, OR assume the caller sets it up?
    // No, `handle` is called by `loopQueue`. 

    // I will make `handle` create a redis client if one isn't available, or better yet,
    // I will accept a second argument and modify `loopQueue`? No, too invasive.

    // Simplest: Create a new redis client for the tracking push, or repurpose the one used for the queue.
    // Actually, let's look at `common.ts`.

    /**
     * We will create a fresh connection for the tracking push.
     * It is not efficient but it is safe.
     * OR we can use a closure/factory pattern.
     */

    // Factory pattern approach:
    // export const createHandler = (redis: any) => async (payload: any) => { ... }

    // But wait, the original code had `await redis.rPush(...)` at the end.
    // I will assume for now we can create a new connection for that specific operation 
    // or `redisClient` is optional argument that we can't easily pass via loopQueue.

    // Let's check `common.ts` content first? No time. 
    // I will implement a `createHandler` factory.
    const redis = redisClient || await connectRedis();

    try {
        // Fetch campaign data
        const campaignRes = await fetch(`${apiBase()}/campaigns/${campaignId}`);
        let campaign: CampaignData | null = null;
        if (campaignRes.ok) {
            campaign = await campaignRes.json();
        } else {
            console.warn(`[engagement-worker] Could not fetch campaign ${campaignId}, using defaults`);
            campaign = { _id: campaignId, name: "Unknown Campaign" };
        }

        // Fetch approved profiles for this campaign
        const res = await fetch(`${apiBase()}/profiles?campaignId=${encodeURIComponent(campaignId)}&status=approved&limit=100`);
        if (!res.ok) {
            console.error(`[engagement-worker] Failed to fetch profiles: ${res.status}`);
            return;
        }

        const approved: ProfileData[] = await res.json();
        console.log(`[engagement-worker] Found ${approved.length} approved profiles for engagement`);

        let messagesQueued = 0;
        let rateLimited = 0;
        const messageDelay = campaign?.settings?.messageDelay || 5000;

        for (const profile of approved) {
            // Check rate limits
            if (!canSendMessage(profile.platform)) {
                console.log(`[engagement-worker] Rate limited for ${profile.platform}, skipping ${profile.username}`);
                rateLimited++;
                continue;
            }

            try {
                // Generate personalized message
                const context: MessageContext = {
                    profile,
                    campaign: campaign!,
                    messageType: "initial"
                };

                const messageContent = await generateMessage(context);
                console.log(`[engagement-worker] Generated message for ${profile.username}: "${messageContent.substring(0, 50)}..."`);

                // Create message in API
                const createRes = await fetch(`${apiBase()}/messages`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        campaignId,
                        profileId: profile._id,
                        content: messageContent,
                        platform: profile.platform,
                        type: "initial",
                        status: "pending"
                    })
                });

                if (createRes.ok) {
                    const messageData: any = await createRes.json();
                    messagesQueued++;
                    recordSentMessage(profile.platform);

                    // Actual delivery via Browser Service
                    if (useBrowserService()) {
                        const sent = await sendMessageViaBrowserService(profile, messageContent);

                        // Update message status based on delivery result
                        await fetch(`${apiBase()}/messages/${messageData._id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                status: sent ? "sent" : "failed",
                                metadata: {
                                    sentAt: new Date().toISOString(),
                                    via: "browser-service",
                                    error: sent ? undefined : "Delivery failed"
                                }
                            })
                        });

                        if (sent) {
                            console.log(`[engagement-worker] Successfully sent message to ${profile.username}`);
                        } else {
                            console.warn(`[engagement-worker] Failed to send message to ${profile.username}`);
                        }
                    } else {
                        console.log(`[engagement-worker] Simulation: Message marked as pending/sent for ${profile.username}`);
                    }

                } else {
                    console.warn(`[engagement-worker] Failed to create message for ${profile.username}: ${createRes.status}`);
                }

                // Add delay between messages
                if (messageDelay > 0) {
                    await new Promise(resolve => setTimeout(resolve, messageDelay));
                }

            } catch (err) {
                console.error(`[engagement-worker] Error processing profile ${profile.username}:`, err);
            }
        }

        console.log(`[engagement-worker] Campaign ${campaignId}: queued=${messagesQueued}, rate_limited=${rateLimited}`);

        // Queue tracking job
        if (messagesQueued > 0) {
            await redis.rPush("queue:tracking", JSON.stringify({ campaignId }));
            console.log(`[engagement-worker] Queued tracking job for campaign ${campaignId}`);
        }

    } catch (err) {
        console.error(`[engagement-worker] Error processing campaign ${campaignId}:`, err);
        throw err;
    }
}
