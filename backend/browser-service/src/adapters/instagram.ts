/**
 * Instagram Platform Adapter
 * Scraping and messaging for Instagram
 */

import { BrowserPool } from "../lib/browser-pool.js";
import { SessionManager } from "../lib/session-manager.js";
import {
    BasePlatformAdapter,
    ProfileData,
    PostData,
    SearchFilters,
    MessageResult,
    logger
} from "./base.js";

export class InstagramAdapter extends BasePlatformAdapter {
    constructor(browserPool: BrowserPool, sessionManager: SessionManager) {
        super(browserPool, sessionManager, "instagram");
    }

    async scrapeProfile(username: string, sessionId?: string): Promise<ProfileData> {
        logger.info({ username }, "Scraping Instagram profile");

        const session = sessionId ? await this.sessionManager.getActiveSession(sessionId) : null;
        if (!session) {
            // Instagram requires authentication for most content
            throw new Error("Instagram scraping requires an authenticated session");
        }

        const { page } = session;

        try {
            const profileUrl = `https://www.instagram.com/${username}/`;
            await page.goto(profileUrl, { waitUntil: "networkidle" });
            await this.humanDelay(2000, 4000);

            // Check for login wall or profile not found
            const loginRequired = await page.$('input[name="username"]');
            if (loginRequired) {
                throw new Error("Authentication required");
            }

            const notFound = await page.$('text="Sorry, this page isn\'t available."');
            if (notFound) {
                throw new Error("Profile not found");
            }

            // Extract profile data
            const displayName = await page.$eval('header h2',
                el => el.textContent?.trim()).catch(() => username);

            const bio = await page.$eval('header section div:last-child span',
                el => el.textContent?.trim()).catch(() => "");

            const avatarUrl = await page.$eval('header img',
                el => el.getAttribute("src")).catch(() => "");

            // Extract stats (posts, followers, following)
            const statsElements = await page.$$('header ul li');
            let postsCount = 0;
            let followers = 0;
            let following = 0;

            if (statsElements.length >= 3) {
                postsCount = this.parseCount(await statsElements[0].$eval('span',
                    el => el.textContent).catch(() => "0"));
                followers = this.parseCount(await statsElements[1].$eval('span',
                    el => el.getAttribute("title") || el.textContent).catch(() => "0"));
                following = this.parseCount(await statsElements[2].$eval('span',
                    el => el.textContent).catch(() => "0"));
            }

            // Check for verified badge
            const verified = await page.$('svg[aria-label="Verified"]') !== null;

            // Extract website
            const website = await page.$eval('a[rel="noopener noreferrer"]',
                el => el.textContent?.trim()).catch(() => "");

            const profile: ProfileData = {
                platform: "instagram",
                username,
                displayName: displayName || username,
                bio: bio || undefined,
                avatarUrl: avatarUrl || undefined,
                profileUrl,
                metadata: {
                    followers,
                    following,
                    postsCount,
                    verified,
                    website: website || undefined,
                },
            };

            logger.info({ username, followers: profile.metadata.followers }, "Instagram profile scraped");
            return profile;

        } catch (err: any) {
            logger.error({ err, username }, "Failed to scrape Instagram profile");
            throw err;
        }
    }

    async scrapePosts(username: string, sessionId?: string, limit: number = 20): Promise<PostData[]> {
        logger.info({ username, limit }, "Scraping Instagram posts");

        const session = sessionId ? await this.sessionManager.getActiveSession(sessionId) : null;
        if (!session) {
            throw new Error("Instagram scraping requires an authenticated session");
        }

        const { page } = session;

        try {
            await page.goto(`https://www.instagram.com/${username}/`, { waitUntil: "networkidle" });
            await this.humanDelay(2000, 4000);

            const posts: PostData[] = [];

            // Get post links from grid
            const postLinks = await page.$$eval('article a',
                els => els.map(el => el.getAttribute('href')).filter(Boolean).slice(0, 30));

            for (const link of postLinks.slice(0, limit)) {
                try {
                    await page.goto(`https://www.instagram.com${link}`, { waitUntil: "networkidle" });
                    await this.humanDelay(1500, 3000);

                    const content = await page.$eval('article h1, article div[class*="Caption"] span',
                        el => el.textContent?.trim()).catch(() => "");

                    const likesText = await page.$eval('button[class*="Likes"] span, section span[class*="likes"]',
                        el => el.textContent?.trim()).catch(() => "0");

                    const commentsText = await page.$eval('ul[class*="comments"] > li',
                        el => {
                            const parent = el.closest('ul');
                            return parent?.children.length.toString() || "0";
                        }).catch(() => "0");

                    const timestamp = await page.$eval('time',
                        el => el.getAttribute('datetime')).catch(() => "");

                    posts.push({
                        id: link || `instagram_${Date.now()}_${posts.length}`,
                        content: content || "[Media Post]",
                        timestamp: timestamp || undefined,
                        engagement: {
                            likes: this.parseCount(likesText),
                            comments: this.parseCount(commentsText),
                        },
                    });

                } catch (err) {
                    // Skip failed posts
                }
            }

            // Return to profile
            await page.goto(`https://www.instagram.com/${username}/`, { waitUntil: "networkidle" });

            logger.info({ username, postCount: posts.length }, "Instagram posts scraped");
            return posts;

        } catch (err: any) {
            logger.error({ err }, "Failed to scrape Instagram posts");
            return [];
        }
    }

    async searchProfiles(
        query: string,
        filters?: SearchFilters,
        sessionId?: string,
        limit: number = 50
    ): Promise<ProfileData[]> {
        logger.info({ query, limit }, "Searching Instagram profiles");

        const session = sessionId ? await this.sessionManager.getActiveSession(sessionId) : null;
        if (!session) {
            throw new Error("Instagram search requires an authenticated session");
        }

        const { page } = session;

        try {
            // Navigate to explore/search
            await page.goto("https://www.instagram.com/explore/", { waitUntil: "networkidle" });
            await this.humanDelay(1500, 2500);

            // Click search
            await page.click('svg[aria-label="Search"]').catch(() => { });
            await this.humanDelay(500, 1000);

            // Type search query
            await page.fill('input[placeholder="Search"]', query);
            await this.humanDelay(2000, 3000);

            const profiles: ProfileData[] = [];

            // Extract search results
            const resultLinks = await page.$$('a[role="link"]');

            for (const link of resultLinks.slice(0, limit)) {
                try {
                    const href = await link.getAttribute('href');
                    if (!href || !href.startsWith('/') || href.includes('/explore/')) continue;

                    const username = href.replace(/\//g, '');
                    if (!username || profiles.some(p => p.username === username)) continue;

                    const displayName = await link.$eval('span',
                        el => el.textContent?.trim()).catch(() => username);

                    const avatarUrl = await link.$eval('img',
                        el => el.getAttribute('src')).catch(() => "");

                    profiles.push({
                        platform: "instagram",
                        username,
                        displayName: displayName || username,
                        avatarUrl: avatarUrl || undefined,
                        profileUrl: `https://www.instagram.com/${username}/`,
                        metadata: {},
                    });
                } catch (err) {
                    // Skip invalid results
                }
            }

            logger.info({ query, resultCount: profiles.length }, "Instagram search completed");
            return profiles;

        } catch (err: any) {
            logger.error({ err }, "Failed to search Instagram");
            return [];
        }
    }

    async sendMessage(username: string, content: string, sessionId: string): Promise<MessageResult> {
        logger.info({ username }, "Sending Instagram DM");

        const session = await this.sessionManager.getActiveSession(sessionId);
        if (!session) {
            throw new Error("Session not found");
        }

        const { page } = session;

        try {
            // Navigate to profile
            await page.goto(`https://www.instagram.com/${username}/`, { waitUntil: "networkidle" });
            await this.humanDelay(2000, 4000);

            // Click message button
            const messageBtn = await page.$('button:has-text("Message")');
            if (!messageBtn) {
                throw new Error("Message button not found - may need to follow first");
            }
            await messageBtn.click();
            await this.humanDelay(2000, 4000);

            // Wait for message input
            await page.waitForSelector('textarea[placeholder*="Message"], div[contenteditable="true"]');
            await this.humanDelay(500, 1000);

            // Type message
            const inputSelector = 'textarea[placeholder*="Message"], div[contenteditable="true"]';
            await page.click(inputSelector);
            await page.type(inputSelector, content, { delay: 30 + Math.random() * 50 });
            await this.humanDelay(500, 1000);

            // Send message (Enter key or send button)
            await page.keyboard.press('Enter');
            await this.humanDelay(1500, 2500);

            logger.info({ username }, "Instagram DM sent");
            return {
                success: true,
                timestamp: new Date().toISOString(),
            };

        } catch (err: any) {
            logger.error({ err, username }, "Failed to send Instagram DM");
            return {
                success: false,
                error: err.message,
                timestamp: new Date().toISOString(),
            };
        }
    }

    async checkMessages(sessionId: string, lastCheckTime?: string): Promise<any[]> {
        logger.info({ sessionId }, "Checking Instagram DMs");

        const session = await this.sessionManager.getActiveSession(sessionId);
        if (!session) {
            throw new Error("Session not found");
        }

        const { page } = session;

        try {
            await page.goto("https://www.instagram.com/direct/inbox/", { waitUntil: "networkidle" });
            await this.humanDelay(2000, 4000);

            // Extract conversations
            const conversations = await page.$$eval('[role="listitem"] a', (elements) => {
                return elements.slice(0, 10).map(el => {
                    const name = el.querySelector('span[style*="font-weight"]')?.textContent?.trim() || "";
                    const lastMessage = el.querySelector('span[style*="color"]')?.textContent?.trim() || "";
                    const unread = el.querySelector('[aria-label*="unread"]') !== null;

                    return { name, lastMessage, unread };
                });
            });

            return conversations.filter(c => c.unread);

        } catch (err: any) {
            logger.error({ err }, "Failed to check Instagram DMs");
            return [];
        }
    }
}
