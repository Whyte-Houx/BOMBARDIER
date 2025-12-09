/**
 * Base Platform Adapter
 * Common interface and utilities for all platform adapters
 */

import { BrowserContext, Page } from "playwright";
import pino from "pino";
import { BrowserPool } from "../lib/browser-pool.js";
import { SessionManager } from "../lib/session-manager.js";

export const logger = pino({ level: process.env.LOG_LEVEL || "info" });

export interface ProfileData {
    platform: string;
    username: string;
    displayName?: string;
    bio?: string;
    avatarUrl?: string;
    profileUrl: string;
    metadata: {
        followers?: number;
        following?: number;
        postsCount?: number;
        verified?: boolean;
        joinDate?: string;
        location?: string;
        website?: string;
    };
    posts?: PostData[];
}

export interface PostData {
    id: string;
    content: string;
    timestamp?: string;
    engagement?: {
        likes?: number;
        comments?: number;
        shares?: number;
        views?: number;
    };
    media?: string[];
}

export interface SearchFilters {
    location?: string;
    minFollowers?: number;
    maxFollowers?: number;
    verified?: boolean;
    hasWebsite?: boolean;
    joinedAfter?: string;
}

export interface MessageResult {
    success: boolean;
    messageId?: string;
    error?: string;
    timestamp: string;
}

export interface BaseAdapterConfig {
    browserPool: BrowserPool;
    sessionManager: SessionManager;
}

export abstract class BasePlatformAdapter {
    protected browserPool: BrowserPool;
    protected sessionManager: SessionManager;
    protected platform: string;

    constructor(browserPool: BrowserPool, sessionManager: SessionManager, platform: string) {
        this.browserPool = browserPool;
        this.sessionManager = sessionManager;
        this.platform = platform;
    }

    abstract scrapeProfile(username: string, sessionId?: string): Promise<ProfileData>;
    abstract scrapePosts(username: string, sessionId?: string, limit?: number): Promise<PostData[]>;
    abstract searchProfiles(query: string, filters?: SearchFilters, sessionId?: string, limit?: number): Promise<ProfileData[]>;
    abstract sendMessage(username: string, content: string, sessionId: string): Promise<MessageResult>;
    abstract checkMessages(sessionId: string, lastCheckTime?: string): Promise<any[]>;

    async scrapeProfiles(
        usernames: string[],
        sessionId?: string,
        maxConcurrent: number = 3
    ): Promise<{ username: string; data?: ProfileData; error?: string }[]> {
        const results: { username: string; data?: ProfileData; error?: string }[] = [];

        // Process in batches
        for (let i = 0; i < usernames.length; i += maxConcurrent) {
            const batch = usernames.slice(i, i + maxConcurrent);

            const batchResults = await Promise.all(
                batch.map(async (username) => {
                    try {
                        const data = await this.scrapeProfile(username, sessionId);
                        return { username, data };
                    } catch (err: any) {
                        logger.error({ err, username }, "Failed to scrape profile");
                        return { username, error: err.message };
                    }
                })
            );

            results.push(...batchResults);

            // Add delay between batches to avoid rate limiting
            if (i + maxConcurrent < usernames.length) {
                await this.humanDelay(2000, 4000);
            }
        }

        return results;
    }

    // Human-like delay
    protected async humanDelay(min: number = 1000, max: number = 3000): Promise<void> {
        const delay = min + Math.random() * (max - min);
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    // Human-like typing
    protected async humanType(page: Page, selector: string, text: string): Promise<void> {
        await page.click(selector);
        for (const char of text) {
            await page.type(selector, char, { delay: 50 + Math.random() * 100 });
        }
    }

    // Scroll with human-like behavior
    protected async humanScroll(page: Page, scrolls: number = 3): Promise<void> {
        for (let i = 0; i < scrolls; i++) {
            const scrollDistance = 300 + Math.random() * 400;
            await page.mouse.wheel(0, scrollDistance);
            await this.humanDelay(500, 1500);
        }
    }

    // Parse number from strings like "1.2K", "3.4M"
    protected parseCount(text: string | null | undefined): number {
        if (!text) return 0;

        const cleaned = text.toLowerCase().trim();
        let multiplier = 1;

        if (cleaned.includes('k')) multiplier = 1000;
        else if (cleaned.includes('m')) multiplier = 1000000;
        else if (cleaned.includes('b')) multiplier = 1000000000;

        const number = parseFloat(cleaned.replace(/[kmb,\s]/gi, ''));
        return Math.round(number * multiplier) || 0;
    }
}
