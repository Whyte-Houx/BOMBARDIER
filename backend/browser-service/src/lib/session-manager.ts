/**
 * Session Manager
 * Per dev_docs - Smart session management for browser automation
 * 
 * Features:
 * - Session persistence with Redis
 * - Cookie management
 * - Session health monitoring
 * - Automatic session recovery
 */

import { Redis } from "ioredis";
import { BrowserContext, Page } from "playwright";
import pino from "pino";
import { v4 as uuidv4 } from "uuid";
import { BrowserPool } from "./browser-pool.js";

const logger = pino({ level: process.env.LOG_LEVEL || "info" });

interface SessionConfig {
    redisUrl: string;
}

interface SessionData {
    id: string;
    platform: string;
    userId?: string;
    status: "active" | "idle" | "error" | "expired";
    createdAt: string;
    lastActivityAt: string;
    cookies?: any[];
    metadata?: Record<string, any>;
}

interface CreateSessionOptions {
    platform: string;
    credentials?: {
        username?: string;
        password?: string;
        cookies?: any[];
    };
    proxyConfig?: {
        url: string;
        username?: string;
        password?: string;
    };
    browserPool: BrowserPool;
}

interface ActiveSession {
    data: SessionData;
    context: BrowserContext;
    page: Page;
    browserId: string;
}

export class SessionManager {
    private config: SessionConfig;
    private redis: Redis | null = null;
    private activeSessions: Map<string, ActiveSession> = new Map();
    private sessionTTL = 3600 * 24; // 24 hours default

    constructor(config: SessionConfig) {
        this.config = config;
    }

    async initialize(): Promise<void> {
        try {
            this.redis = new Redis(this.config.redisUrl);
            logger.info("Session manager connected to Redis");

            // Start session health check loop
            this.startHealthCheck();
        } catch (err) {
            logger.error({ err }, "Failed to connect to Redis");
            // Continue without Redis - sessions won't persist
        }
    }

    async createSession(options: CreateSessionOptions): Promise<SessionData> {
        const sessionId = uuidv4();

        // Acquire browser context
        const { id: contextId, context, page } = await options.browserPool.acquireContext({
            sessionId,
            proxyUrl: options.proxyConfig?.url,
            cookies: options.credentials?.cookies,
        });

        // Create session data
        const sessionData: SessionData = {
            id: sessionId,
            platform: options.platform,
            status: "active",
            createdAt: new Date().toISOString(),
            lastActivityAt: new Date().toISOString(),
            metadata: {},
        };

        // Perform login if credentials provided
        if (options.credentials?.username && options.credentials?.password) {
            try {
                await this.performLogin(
                    page,
                    options.platform,
                    options.credentials.username,
                    options.credentials.password
                );

                // Store cookies after successful login
                sessionData.cookies = await context.cookies();
            } catch (err: any) {
                logger.error({ err, platform: options.platform }, "Login failed");
                sessionData.status = "error";
                sessionData.metadata = { error: err.message };
            }
        }

        // Store active session
        this.activeSessions.set(sessionId, {
            data: sessionData,
            context,
            page,
            browserId: contextId,
        });

        // Persist to Redis
        await this.persistSession(sessionData);

        logger.info({ sessionId, platform: options.platform }, "Session created");
        return sessionData;
    }

    async getSession(sessionId: string): Promise<SessionData | null> {
        // Check active sessions first
        const active = this.activeSessions.get(sessionId);
        if (active) {
            return active.data;
        }

        // Check Redis
        if (this.redis) {
            const data = await this.redis.get(`session:${sessionId}`);
            if (data) {
                return JSON.parse(data);
            }
        }

        return null;
    }

    async getActiveSession(sessionId: string): Promise<ActiveSession | null> {
        const session = this.activeSessions.get(sessionId);

        if (session) {
            // Update last activity
            session.data.lastActivityAt = new Date().toISOString();
            await this.persistSession(session.data);
            return session;
        }

        // Try to restore from Redis
        const sessionData = await this.getSession(sessionId);
        if (sessionData && sessionData.cookies) {
            // Note: In production, would restore browser context here
            logger.info({ sessionId }, "Would restore session from cookies");
        }

        return null;
    }

    async closeSession(sessionId: string): Promise<void> {
        const session = this.activeSessions.get(sessionId);

        if (session) {
            // Save cookies before closing
            try {
                session.data.cookies = await session.context.cookies();
                session.data.status = "idle";
                await this.persistSession(session.data);
            } catch (err) {
                logger.error({ err }, "Error saving session cookies");
            }

            // Close browser context
            try {
                await session.context.close();
            } catch (err) {
                logger.error({ err }, "Error closing browser context");
            }

            this.activeSessions.delete(sessionId);
            logger.info({ sessionId }, "Session closed");
        }
    }

    async closeAll(): Promise<void> {
        for (const sessionId of this.activeSessions.keys()) {
            await this.closeSession(sessionId);
        }

        if (this.redis) {
            await this.redis.quit();
        }
    }

    getActiveCount(): number {
        return this.activeSessions.size;
    }

    private async persistSession(session: SessionData): Promise<void> {
        if (!this.redis) return;

        try {
            await this.redis.setex(
                `session:${session.id}`,
                this.sessionTTL,
                JSON.stringify(session)
            );
        } catch (err) {
            logger.error({ err }, "Failed to persist session");
        }
    }

    private async performLogin(
        page: Page,
        platform: string,
        username: string,
        password: string
    ): Promise<void> {
        // Platform-specific login flows
        switch (platform) {
            case "twitter":
                await this.loginTwitter(page, username, password);
                break;
            case "linkedin":
                await this.loginLinkedIn(page, username, password);
                break;
            case "reddit":
                await this.loginReddit(page, username, password);
                break;
            case "instagram":
                await this.loginInstagram(page, username, password);
                break;
            default:
                throw new Error(`Login not implemented for platform: ${platform}`);
        }
    }

    private async loginTwitter(page: Page, username: string, password: string): Promise<void> {
        await page.goto("https://twitter.com/login");
        await page.waitForLoadState("networkidle");

        // Enter username
        await page.fill('input[autocomplete="username"]', username);
        await page.click('text=Next');

        // Wait for password field
        await page.waitForSelector('input[type="password"]', { timeout: 10000 });
        await page.fill('input[type="password"]', password);
        await page.click('text=Log in');

        // Wait for login to complete
        await page.waitForURL(/home/, { timeout: 30000 });

        // Add human-like delay
        await page.waitForTimeout(2000 + Math.random() * 1000);
    }

    private async loginLinkedIn(page: Page, username: string, password: string): Promise<void> {
        await page.goto("https://www.linkedin.com/login");
        await page.waitForLoadState("networkidle");

        await page.fill('#username', username);
        await page.fill('#password', password);
        await page.click('button[type="submit"]');

        // Wait for login to complete
        await page.waitForURL(/feed/, { timeout: 30000 });
        await page.waitForTimeout(2000 + Math.random() * 1000);
    }

    private async loginReddit(page: Page, username: string, password: string): Promise<void> {
        await page.goto("https://www.reddit.com/login");
        await page.waitForLoadState("networkidle");

        await page.fill('#loginUsername', username);
        await page.fill('#loginPassword', password);
        await page.click('button[type="submit"]');

        // Wait for login to complete
        await page.waitForTimeout(5000);
        await page.waitForLoadState("networkidle");
    }

    private async loginInstagram(page: Page, username: string, password: string): Promise<void> {
        await page.goto("https://www.instagram.com/accounts/login/");
        await page.waitForLoadState("networkidle");

        await page.fill('input[name="username"]', username);
        await page.fill('input[name="password"]', password);
        await page.click('button[type="submit"]');

        // Wait for login to complete
        await page.waitForTimeout(5000);
        await page.waitForLoadState("networkidle");
    }

    private startHealthCheck(): void {
        // Check session health every 5 minutes
        setInterval(async () => {
            for (const [sessionId, session] of this.activeSessions.entries()) {
                // Check if context is still valid
                try {
                    await session.context.pages();
                } catch (err) {
                    logger.warn({ sessionId }, "Session context invalid, marking as error");
                    session.data.status = "error";
                    await this.persistSession(session.data);
                    this.activeSessions.delete(sessionId);
                }

                // Check for idle sessions (no activity in 30 minutes)
                const lastActivity = new Date(session.data.lastActivityAt).getTime();
                const idleTime = Date.now() - lastActivity;
                if (idleTime > 30 * 60 * 1000) {
                    logger.info({ sessionId }, "Session idle for 30 minutes, closing");
                    await this.closeSession(sessionId);
                }
            }
        }, 5 * 60 * 1000);
    }
}
