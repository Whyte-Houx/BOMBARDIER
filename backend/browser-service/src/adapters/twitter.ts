/**
 * Twitter/X Platform Adapter
 * Scraping and messaging for Twitter/X
 */

import { Page } from "playwright";
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

export class TwitterAdapter extends BasePlatformAdapter {
    constructor(browserPool: BrowserPool, sessionManager: SessionManager) {
        super(browserPool, sessionManager, "twitter");
    }

    async scrapeProfile(username: string, sessionId?: string): Promise<ProfileData> {
        logger.info({ username }, "Scraping Twitter profile");

        // Get or create browser context
        const session = sessionId ? await this.sessionManager.getActiveSession(sessionId) : null;
        const { context, page } = session
            ? { context: session.context, page: session.page }
            : await this.browserPool.acquireContext();

        try {
            // Navigate to profile
            const profileUrl = `https://twitter.com/${username}`;
            await page.goto(profileUrl, { waitUntil: "networkidle" });
            await this.humanDelay(1500, 3000);

            // Check if profile exists
            const notFound = await page.$('text="This account doesn\'t exist"');
            if (notFound) {
                throw new Error("Profile not found");
            }

            // Wait for profile to load
            await page.waitForSelector('[data-testid="UserName"]', { timeout: 10000 }).catch(() => { });

            // Extract profile data
            const displayName = await page.$eval('[data-testid="UserName"] span span',
                el => el.textContent).catch(() => username);

            const bio = await page.$eval('[data-testid="UserDescription"]',
                el => el.textContent).catch(() => "");

            const avatarUrl = await page.$eval('[data-testid="UserAvatar-Container-unknown"] img',
                el => el.getAttribute("src")).catch(() => "");

            // Extract follower data
            const followersText = await page.$eval('a[href$="/verified_followers"] span span',
                el => el.textContent).catch(() => "0");
            const followingText = await page.$eval('a[href$="/following"] span span',
                el => el.textContent).catch(() => "0");

            // Check verification
            const verified = await page.$('[data-testid="icon-verified"]') !== null;

            // Extract location and website
            const location = await page.$eval('[data-testid="UserProfileHeader_Items"] [data-testid="UserLocation"]',
                el => el.textContent).catch(() => "");
            const website = await page.$eval('[data-testid="UserProfileHeader_Items"] a[role="link"]',
                el => el.textContent).catch(() => "");

            // Extract join date
            const joinDate = await page.$eval('[data-testid="UserProfileHeader_Items"] [data-testid="UserJoinDate"]',
                el => el.textContent).catch(() => "");

            const profile: ProfileData = {
                platform: "twitter",
                username,
                displayName: displayName || username,
                bio: bio || undefined,
                avatarUrl: avatarUrl || undefined,
                profileUrl,
                metadata: {
                    followers: this.parseCount(followersText),
                    following: this.parseCount(followingText),
                    verified,
                    location: location || undefined,
                    website: website || undefined,
                    joinDate: joinDate || undefined,
                },
            };

            logger.info({ username, followers: profile.metadata.followers }, "Twitter profile scraped");
            return profile;

        } finally {
            // Only close if we created a new context
            if (!sessionId) {
                await context.close();
            }
        }
    }

    async scrapePosts(username: string, sessionId?: string, limit: number = 20): Promise<PostData[]> {
        logger.info({ username, limit }, "Scraping Twitter posts");

        const session = sessionId ? await this.sessionManager.getActiveSession(sessionId) : null;
        const { context, page } = session
            ? { context: session.context, page: session.page }
            : await this.browserPool.acquireContext();

        try {
            await page.goto(`https://twitter.com/${username}`, { waitUntil: "networkidle" });
            await this.humanDelay(2000, 4000);

            const posts: PostData[] = [];
            let scrolls = 0;
            const maxScrolls = Math.ceil(limit / 5); // About 5 posts per viewport

            while (posts.length < limit && scrolls < maxScrolls) {
                // Extract visible tweets
                const tweets = await page.$$eval('[data-testid="tweet"]', (elements) => {
                    return elements.map(el => {
                        const content = el.querySelector('[data-testid="tweetText"]')?.textContent || "";
                        const time = el.querySelector('time')?.getAttribute('datetime') || "";
                        const likes = el.querySelector('[data-testid="like"] span')?.textContent || "0";
                        const retweets = el.querySelector('[data-testid="retweet"] span')?.textContent || "0";
                        const replies = el.querySelector('[data-testid="reply"] span')?.textContent || "0";

                        return {
                            content,
                            timestamp: time,
                            likes,
                            retweets,
                            replies,
                        };
                    });
                });

                for (const tweet of tweets) {
                    if (posts.length >= limit) break;
                    if (posts.some(p => p.content === tweet.content)) continue;

                    posts.push({
                        id: `twitter_${Date.now()}_${posts.length}`,
                        content: tweet.content,
                        timestamp: tweet.timestamp,
                        engagement: {
                            likes: this.parseCount(tweet.likes),
                            shares: this.parseCount(tweet.retweets),
                            comments: this.parseCount(tweet.replies),
                        },
                    });
                }

                // Scroll for more
                await this.humanScroll(page, 1);
                scrolls++;
            }

            logger.info({ username, postCount: posts.length }, "Twitter posts scraped");
            return posts;

        } finally {
            if (!sessionId) {
                await context.close();
            }
        }
    }

    async searchProfiles(
        query: string,
        filters?: SearchFilters,
        sessionId?: string,
        limit: number = 50
    ): Promise<ProfileData[]> {
        logger.info({ query, limit }, "Searching Twitter profiles");

        const session = sessionId ? await this.sessionManager.getActiveSession(sessionId) : null;
        const { context, page } = session
            ? { context: session.context, page: session.page }
            : await this.browserPool.acquireContext();

        try {
            // Navigate to search
            const searchUrl = `https://twitter.com/search?q=${encodeURIComponent(query)}&src=typed_query&f=user`;
            await page.goto(searchUrl, { waitUntil: "networkidle" });
            await this.humanDelay(2000, 4000);

            const profiles: ProfileData[] = [];
            let scrolls = 0;
            const maxScrolls = Math.ceil(limit / 10);

            while (profiles.length < limit && scrolls < maxScrolls) {
                // Extract visible user cards
                const userCards = await page.$$('[data-testid="UserCell"]');

                for (const card of userCards) {
                    if (profiles.length >= limit) break;

                    try {
                        const username = await card.$eval('a[role="link"]',
                            el => el.getAttribute('href')?.replace('/', '')).catch(() => "");

                        if (!username || profiles.some(p => p.username === username)) continue;

                        const displayName = await card.$eval('[data-testid="UserName"] span span',
                            el => el.textContent).catch(() => username);
                        const bio = await card.$eval('[data-testid="UserDescription"]',
                            el => el.textContent).catch(() => "");
                        const verified = await card.$('[data-testid="icon-verified"]') !== null;
                        const followersText = await card.$eval('[data-testid="userFollowerCount"]',
                            el => el.textContent).catch(() => "0");

                        const followers = this.parseCount(followersText);

                        // Apply filters
                        if (filters?.minFollowers && followers < filters.minFollowers) continue;
                        if (filters?.maxFollowers && followers > filters.maxFollowers) continue;
                        if (filters?.verified && !verified) continue;

                        profiles.push({
                            platform: "twitter",
                            username,
                            displayName: displayName || username,
                            bio: bio || undefined,
                            profileUrl: `https://twitter.com/${username}`,
                            metadata: {
                                followers,
                                verified,
                            },
                        });
                    } catch (err) {
                        // Skip invalid cards
                    }
                }

                await this.humanScroll(page, 1);
                scrolls++;
            }

            logger.info({ query, resultCount: profiles.length }, "Twitter search completed");
            return profiles;

        } finally {
            if (!sessionId) {
                await context.close();
            }
        }
    }

    async sendMessage(username: string, content: string, sessionId: string): Promise<MessageResult> {
        logger.info({ username }, "Sending Twitter DM");

        const session = await this.sessionManager.getActiveSession(sessionId);
        if (!session) {
            throw new Error("Session not found");
        }

        const { page } = session;

        try {
            // Navigate to DM compose
            await page.goto(`https://twitter.com/messages/compose`, { waitUntil: "networkidle" });
            await this.humanDelay(1500, 2500);

            // Search for user
            const searchInput = await page.waitForSelector('[data-testid="searchPeople"]');
            await this.humanType(page, '[data-testid="searchPeople"]', username);
            await this.humanDelay(1500, 2500);

            // Select user from results
            await page.click(`[data-testid="TypeaheadUser-${username}"]`).catch(() => {
                // Try alternative selector
                return page.click(`text="@${username}"`);
            });
            await this.humanDelay(1000, 2000);

            // Click next/compose
            await page.click('[data-testid="nextButton"]');
            await this.humanDelay(1000, 2000);

            // Type message
            await this.humanType(page, '[data-testid="dmComposerTextInput"]', content);
            await this.humanDelay(500, 1000);

            // Send message
            await page.click('[data-testid="dmComposerSendButton"]');
            await this.humanDelay(1000, 2000);

            logger.info({ username }, "Twitter DM sent");
            return {
                success: true,
                timestamp: new Date().toISOString(),
            };

        } catch (err: any) {
            logger.error({ err, username }, "Failed to send Twitter DM");
            return {
                success: false,
                error: err.message,
                timestamp: new Date().toISOString(),
            };
        }
    }

    async checkMessages(sessionId: string, lastCheckTime?: string): Promise<any[]> {
        logger.info({ sessionId }, "Checking Twitter DMs");

        const session = await this.sessionManager.getActiveSession(sessionId);
        if (!session) {
            throw new Error("Session not found");
        }

        const { page } = session;

        try {
            await page.goto("https://twitter.com/messages", { waitUntil: "networkidle" });
            await this.humanDelay(2000, 4000);

            // Extract recent conversations
            const conversations = await page.$$eval('[data-testid="conversation"]', (elements) => {
                return elements.slice(0, 10).map(el => {
                    const name = el.querySelector('[data-testid="conversationName"]')?.textContent || "";
                    const lastMessage = el.querySelector('[data-testid="lastMessage"]')?.textContent || "";
                    const time = el.querySelector('time')?.getAttribute('datetime') || "";
                    const unread = el.querySelector('[data-testid="unreadIndicator"]') !== null;

                    return { name, lastMessage, time, unread };
                });
            });

            // Filter to messages after lastCheckTime
            if (lastCheckTime) {
                const checkTime = new Date(lastCheckTime).getTime();
                return conversations.filter(c => {
                    if (!c.time) return c.unread;
                    return new Date(c.time).getTime() > checkTime || c.unread;
                });
            }

            return conversations.filter(c => c.unread);

        } catch (err: any) {
            logger.error({ err }, "Failed to check Twitter DMs");
            return [];
        }
    }
}
