/**
 * Browser Automation Service
 * Per dev_docs - Playwright-based browser automation with anti-detection
 * 
 * Features:
 * - Browser session management
 * - Anti-detection measures (fingerprint randomization, stealth plugins)
 * - Platform-specific adapters
 * - Session persistence and recovery
 */

import Fastify from "fastify";
import cors from "@fastify/cors";
import { BrowserPool } from "./lib/browser-pool.js";
import { SessionManager } from "./lib/session-manager.js";
import { TwitterAdapter } from "./adapters/twitter.js";
import { LinkedInAdapter } from "./adapters/linkedin.js";
import { RedditAdapter } from "./adapters/reddit.js";
import { InstagramAdapter } from "./adapters/instagram.js";
import pino from "pino";

const logger = pino({ level: process.env.LOG_LEVEL || "info" });
const PORT = Number(process.env.PORT || 5100);

// Initialize components
const browserPool = new BrowserPool({
    maxBrowsers: Number(process.env.MAX_BROWSERS || 5),
    headless: process.env.HEADLESS !== "false",
    proxyUrl: process.env.PROXY_URL,
});

const sessionManager = new SessionManager({
    redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
});

// Platform adapters
const adapters = {
    twitter: new TwitterAdapter(browserPool, sessionManager),
    linkedin: new LinkedInAdapter(browserPool, sessionManager),
    reddit: new RedditAdapter(browserPool, sessionManager),
    instagram: new InstagramAdapter(browserPool, sessionManager),
};

// Initialize Fastify
const server = Fastify({ logger: true });
await server.register(cors, { origin: true });

// Health check
server.get("/health", async () => ({
    status: "healthy",
    activeBrowsers: browserPool.getActiveCount(),
    activeSessions: sessionManager.getActiveCount(),
}));

// =============================================================================
// Scraping Endpoints
// =============================================================================

// Scrape profile data
server.post("/scrape/profile", async (request, reply) => {
    const { platform, username, sessionId } = request.body as any;

    if (!platform || !username) {
        return reply.code(400).send({ error: "MISSING_PARAMS", message: "platform and username required" });
    }

    const adapter = adapters[platform as keyof typeof adapters];
    if (!adapter) {
        return reply.code(400).send({ error: "UNSUPPORTED_PLATFORM", message: `Platform ${platform} not supported` });
    }

    try {
        const profile = await adapter.scrapeProfile(username, sessionId);
        return { success: true, data: profile };
    } catch (err: any) {
        logger.error({ err, platform, username }, "Profile scraping failed");
        return reply.code(500).send({ error: "SCRAPE_FAILED", message: err.message });
    }
});

// Batch scrape profiles
server.post("/scrape/profiles", async (request, reply) => {
    const { platform, usernames, sessionId, maxConcurrent = 3 } = request.body as any;

    if (!platform || !usernames || !Array.isArray(usernames)) {
        return reply.code(400).send({ error: "MISSING_PARAMS" });
    }

    const adapter = adapters[platform as keyof typeof adapters];
    if (!adapter) {
        return reply.code(400).send({ error: "UNSUPPORTED_PLATFORM" });
    }

    try {
        const results = await adapter.scrapeProfiles(usernames, sessionId, maxConcurrent);
        return { success: true, data: results };
    } catch (err: any) {
        logger.error({ err }, "Batch scraping failed");
        return reply.code(500).send({ error: "SCRAPE_FAILED", message: err.message });
    }
});

// Search for profiles
server.post("/search", async (request, reply) => {
    const { platform, query, filters, sessionId, limit = 50 } = request.body as any;

    if (!platform || !query) {
        return reply.code(400).send({ error: "MISSING_PARAMS" });
    }

    const adapter = adapters[platform as keyof typeof adapters];
    if (!adapter) {
        return reply.code(400).send({ error: "UNSUPPORTED_PLATFORM" });
    }

    try {
        const results = await adapter.searchProfiles(query, filters, sessionId, limit);
        return { success: true, data: results };
    } catch (err: any) {
        logger.error({ err }, "Search failed");
        return reply.code(500).send({ error: "SEARCH_FAILED", message: err.message });
    }
});

// Scrape user posts/timeline
server.post("/scrape/posts", async (request, reply) => {
    const { platform, username, sessionId, limit = 20 } = request.body as any;

    if (!platform || !username) {
        return reply.code(400).send({ error: "MISSING_PARAMS" });
    }

    const adapter = adapters[platform as keyof typeof adapters];
    if (!adapter) {
        return reply.code(400).send({ error: "UNSUPPORTED_PLATFORM" });
    }

    try {
        const posts = await adapter.scrapePosts(username, sessionId, limit);
        return { success: true, data: posts };
    } catch (err: any) {
        logger.error({ err }, "Posts scraping failed");
        return reply.code(500).send({ error: "SCRAPE_FAILED", message: err.message });
    }
});

// =============================================================================
// Message Delivery Endpoints
// =============================================================================

// Send a direct message
server.post("/message/send", async (request, reply) => {
    const { platform, username, content, sessionId } = request.body as any;

    if (!platform || !username || !content || !sessionId) {
        return reply.code(400).send({ error: "MISSING_PARAMS" });
    }

    const adapter = adapters[platform as keyof typeof adapters];
    if (!adapter) {
        return reply.code(400).send({ error: "UNSUPPORTED_PLATFORM" });
    }

    try {
        const result = await adapter.sendMessage(username, content, sessionId);
        return { success: true, data: result };
    } catch (err: any) {
        logger.error({ err }, "Message send failed");
        return reply.code(500).send({ error: "SEND_FAILED", message: err.message });
    }
});

// Check for new messages/responses
server.post("/message/check", async (request, reply) => {
    const { platform, sessionId, lastCheckTime } = request.body as any;

    if (!platform || !sessionId) {
        return reply.code(400).send({ error: "MISSING_PARAMS" });
    }

    const adapter = adapters[platform as keyof typeof adapters];
    if (!adapter) {
        return reply.code(400).send({ error: "UNSUPPORTED_PLATFORM" });
    }

    try {
        const messages = await adapter.checkMessages(sessionId, lastCheckTime);
        return { success: true, data: messages };
    } catch (err: any) {
        logger.error({ err }, "Message check failed");
        return reply.code(500).send({ error: "CHECK_FAILED", message: err.message });
    }
});

// =============================================================================
// Session Management Endpoints
// =============================================================================

// Create or restore a browser session
server.post("/session/create", async (request, reply) => {
    const { platform, credentials, proxyConfig } = request.body as any;

    if (!platform) {
        return reply.code(400).send({ error: "MISSING_PLATFORM" });
    }

    try {
        const session = await sessionManager.createSession({
            platform,
            credentials,
            proxyConfig,
            browserPool,
        });
        return { success: true, sessionId: session.id };
    } catch (err: any) {
        logger.error({ err }, "Session creation failed");
        return reply.code(500).send({ error: "SESSION_FAILED", message: err.message });
    }
});

// Check session status
server.get("/session/:sessionId", async (request, reply) => {
    const { sessionId } = request.params as any;

    const session = await sessionManager.getSession(sessionId);
    if (!session) {
        return reply.code(404).send({ error: "SESSION_NOT_FOUND" });
    }

    return { success: true, data: session };
});

// Close a session
server.delete("/session/:sessionId", async (request, reply) => {
    const { sessionId } = request.params as any;

    try {
        await sessionManager.closeSession(sessionId);
        return { success: true };
    } catch (err: any) {
        logger.error({ err }, "Session close failed");
        return reply.code(500).send({ error: "CLOSE_FAILED", message: err.message });
    }
});

// =============================================================================
// Start Server
// =============================================================================

try {
    await browserPool.initialize();
    await sessionManager.initialize();

    await server.listen({ port: PORT, host: "0.0.0.0" });
    logger.info(`Browser service started on port ${PORT}`);
} catch (err) {
    logger.error(err, "Failed to start browser service");
    process.exit(1);
}

// Graceful shutdown
process.on("SIGTERM", async () => {
    logger.info("Shutting down browser service...");
    await sessionManager.closeAll();
    await browserPool.cleanup();
    await server.close();
    process.exit(0);
});
