import { connectRedis, loopQueue } from "./common.js";

/**
 * Tracking Worker
 * Per dev_docs/components_modules/specifications.md - ITrackingService
 * 
 * Intelligent response monitoring and analysis:
 * - Message delivery status monitoring
 * - Response detection and analysis
 * - Conversation intelligence
 * - Analytics recording
 */

function apiBase() { return process.env.API_URL || "http://localhost:4050"; }

interface MessageData {
  _id: string;
  campaignId: string;
  profileId: string;
  content: string;
  platform: string;
  status: string;
  type: string;
  sentAt?: string;
  response?: {
    received: boolean;
    content: string;
    timestamp: string;
    sentiment?: number;
  };
}

// ============================================================================
// Response Analysis
// ============================================================================

// Simple sentiment scoring for responses
function analyzeResponseSentiment(content: string): number {
  const positiveWords = ["thanks", "thank you", "great", "awesome", "love", "yes", "sure", "definitely", "absolutely", "happy", "excited", "interested"];
  const negativeWords = ["no", "not interested", "stop", "remove", "unsubscribe", "spam", "annoying", "busy", "leave me"];

  const lowerContent = content.toLowerCase();
  let score = 0;

  for (const word of positiveWords) {
    if (lowerContent.includes(word)) score += 0.15;
  }
  for (const word of negativeWords) {
    if (lowerContent.includes(word)) score -= 0.2;
  }

  return Math.max(-1, Math.min(1, score));
}

// Classify response type
function classifyResponse(content: string): "positive" | "negative" | "neutral" | "question" {
  const lowerContent = content.toLowerCase();

  // Check for questions
  if (content.includes("?") || lowerContent.startsWith("what") || lowerContent.startsWith("how") || lowerContent.startsWith("when") || lowerContent.startsWith("where") || lowerContent.startsWith("why")) {
    return "question";
  }

  // Check for negative indicators
  const negativeIndicators = ["no thanks", "not interested", "stop", "don't contact", "unsubscribe", "leave me alone", "spam"];
  for (const indicator of negativeIndicators) {
    if (lowerContent.includes(indicator)) return "negative";
  }

  // Check for positive indicators
  const positiveIndicators = ["yes", "sure", "sounds good", "interested", "tell me more", "love to", "would like"];
  for (const indicator of positiveIndicators) {
    if (lowerContent.includes(indicator)) return "positive";
  }

  return "neutral";
}

// ============================================================================
// Delivery Status Simulation
// In production, this would check actual platform APIs or webhooks
// ============================================================================

async function simulateDeliveryCheck(message: MessageData): Promise<{ delivered: boolean; error?: string }> {
  // Simulate random delivery success (90% success rate)
  const success = Math.random() > 0.1;

  if (!success) {
    const errors = [
      "recipient_blocked",
      "rate_limit_exceeded",
      "account_suspended",
      "invalid_recipient"
    ];
    return { delivered: false, error: errors[Math.floor(Math.random() * errors.length)] };
  }

  return { delivered: true };
}

// Simulate response check (in production, would poll platform APIs)
async function simulateResponseCheck(message: MessageData): Promise<{ hasResponse: boolean; content?: string; timestamp?: string }> {
  // Only check delivered messages
  if (message.status !== "delivered") {
    return { hasResponse: false };
  }

  // Simulate 20% response rate
  const hasResponse = Math.random() > 0.8;

  if (hasResponse) {
    const sampleResponses = [
      "Hey! Thanks for reaching out. I'd love to connect!",
      "Hi there! What kind of collaboration did you have in mind?",
      "Not interested, thanks.",
      "Sure, sounds interesting! Tell me more.",
      "Thanks for the message! I'm a bit busy right now but maybe later?",
      "Hey! I checked out your profile and it looks cool. Let's chat!"
    ];

    return {
      hasResponse: true,
      content: sampleResponses[Math.floor(Math.random() * sampleResponses.length)],
      timestamp: new Date().toISOString()
    };
  }

  return { hasResponse: false };
}

// ============================================================================
// Worker Handler
// ============================================================================

async function handle(payload: any) {
  const campaignId = payload.campaignId;
  console.log(`[tracking-worker] Processing campaign ${campaignId}`);

  try {
    // Fetch all messages for this campaign
    const res = await fetch(`${apiBase()}/messages?campaignId=${encodeURIComponent(campaignId)}&limit=500`);
    if (!res.ok) {
      console.error(`[tracking-worker] Failed to fetch messages: ${res.status}`);
      return;
    }

    const messages: MessageData[] = await res.json();
    console.log(`[tracking-worker] Found ${messages.length} messages to track`);

    let deliveredCount = 0;
    let failedCount = 0;
    let responsesReceived = 0;

    for (const message of messages) {
      try {
        // Check delivery for pending messages
        if (message.status === "pending") {
          const deliveryResult = await simulateDeliveryCheck(message);

          if (deliveryResult.delivered) {
            await fetch(`${apiBase()}/messages/${message._id}/status`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "delivered" })
            });
            deliveredCount++;
            console.log(`[tracking-worker] Message ${message._id} delivered`);
          } else {
            await fetch(`${apiBase()}/messages/${message._id}/status`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "failed", metadata: { error: deliveryResult.error } })
            });
            failedCount++;
            console.log(`[tracking-worker] Message ${message._id} failed: ${deliveryResult.error}`);
          }
        }

        // Check for responses on delivered messages
        if (message.status === "delivered" && !message.response?.received) {
          const responseResult = await simulateResponseCheck(message);

          if (responseResult.hasResponse && responseResult.content) {
            const sentiment = analyzeResponseSentiment(responseResult.content);
            const responseType = classifyResponse(responseResult.content);

            // Record the response
            await fetch(`${apiBase()}/messages/${message._id}/status`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                status: "delivered",
                metadata: {
                  response: {
                    received: true,
                    content: responseResult.content,
                    timestamp: responseResult.timestamp,
                    sentiment,
                    type: responseType
                  }
                }
              })
            });

            responsesReceived++;
            console.log(`[tracking-worker] Response received for ${message._id}: type=${responseType}, sentiment=${sentiment.toFixed(2)}`);

            // If positive response or question, could queue for follow-up engagement
            if (responseType === "positive" || responseType === "question") {
              // TODO: Queue for conversation continuation
              console.log(`[tracking-worker] Positive/question response from ${message.profileId} - consider follow-up`);
            }
          }
        }

        // Mark sent messages as delivered after some time (simulating async delivery)
        if (message.status === "sent") {
          await fetch(`${apiBase()}/messages/${message._id}/status`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "delivered" })
          });
          deliveredCount++;
        }

      } catch (err) {
        console.error(`[tracking-worker] Error processing message ${message._id}:`, err);
      }
    }

    console.log(`[tracking-worker] Campaign ${campaignId}: delivered=${deliveredCount}, failed=${failedCount}, responses=${responsesReceived}`);

    // Record analytics
    try {
      await fetch(`${apiBase()}/tracking/event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "tracking_completed",
          campaignId,
          data: {
            messagesProcessed: messages.length,
            delivered: deliveredCount,
            failed: failedCount,
            responses: responsesReceived
          }
        })
      });
    } catch (err) {
      // Analytics recording is non-critical
      console.warn(`[tracking-worker] Failed to record analytics:`, err);
    }

  } catch (err) {
    console.error(`[tracking-worker] Error processing campaign ${campaignId}:`, err);
    throw err;
  }
}

const redis = await connectRedis();
console.log("[tracking-worker] Started, waiting for jobs...");
await loopQueue(redis, "queue:tracking", handle);