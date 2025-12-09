/**
 * Reddit Platform Adapter
 * Scraping and messaging for Reddit
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

export class RedditAdapter extends BasePlatformAdapter {
    constructor(browserPool: BrowserPool, sessionManager: SessionManager) {
        super(browserPool, sessionManager, "reddit");
    }

    async scrapeProfile(username: string, sessionId?: string): Promise<ProfileData> {
        logger.info({ username }, "Scraping Reddit profile");

        const session = sessionId ? await this.sessionManager.getActiveSession(sessionId) : null;
        const { context, page } = session
            ? { context: session.context, page: session.page }
            : await this.browserPool.acquireContext();

        try {
            const profileUrl = `https://www.reddit.com/user/${username}`;
            await page.goto(profileUrl, { waitUntil: "networkidle" });
            await this.humanDelay(1500, 3000);

            // Check if profile exists
            const notFound = await page.$('text="Sorry, nobody on Reddit goes by that name."');
            if (notFound) {
                throw new Error("Profile not found");
            }

            // Extract profile data (new Reddit UI)
            const displayName = await page.$eval('[data-testid="profile-name"]',
                el => el.textContent?.trim()).catch(() => username);

            const bio = await page.$eval('[data-testid="profile-description"]',
                el => el.textContent?.trim()).catch(() => "");

            const avatarUrl = await page.$eval('img[alt*="avatar"]',
                el => el.getAttribute("src")).catch(() => "");

            // Extract karma
            const karmaText = await page.$eval('[data-testid="karma"]',
                el => el.textContent?.trim()).catch(() => "0");

            // Extract cake day
            const cakeDay = await page.$eval('[data-testid="cake-day"]',
                el => el.textContent?.trim()).catch(() => "");

            const profile: ProfileData = {
                platform: "reddit",
                username,
                displayName: displayName || `u/${username}`,
                bio: bio || undefined,
                avatarUrl: avatarUrl || undefined,
                profileUrl,
                metadata: {
                    followers: this.parseCount(karmaText), // Using karma as follower equivalent
                    joinDate: cakeDay || undefined,
                },
            };

            logger.info({ username, karma: profile.metadata.followers }, "Reddit profile scraped");
            return profile;

        } finally {
            if (!sessionId) {
                await context.close();
            }
        }
    }

    async scrapePosts(username: string, sessionId?: string, limit: number = 20): Promise<PostData[]> {
        logger.info({ username, limit }, "Scraping Reddit posts");

        const session = sessionId ? await this.sessionManager.getActiveSession(sessionId) : null;
        const { context, page } = session
            ? { context: session.context, page: session.page }
            : await this.browserPool.acquireContext();

        try {
            await page.goto(`https://www.reddit.com/user/${username}/submitted`,
                { waitUntil: "networkidle" });
            await this.humanDelay(2000, 4000);

            const posts: PostData[] = [];
            let scrolls = 0;
            const maxScrolls = Math.ceil(limit / 5);

            while (posts.length < limit && scrolls < maxScrolls) {
                // Extract visible posts
                const postElements = await page.$$('[data-testid="post-container"]');

                for (const postEl of postElements) {
                    if (posts.length >= limit) break;

                    try {
                        const title = await postEl.$eval('h3',
                            el => el.textContent?.trim()).catch(() => "");
                        const content = await postEl.$eval('[data-testid="post-content"]',
                            el => el.textContent?.trim()).catch(() => "");

                        const fullContent = title + (content ? ` - ${content}` : "");
                        if (!fullContent || posts.some(p => p.content === fullContent)) continue;

                        const scoreText = await postEl.$eval('[data-testid="vote-score"]',
                            el => el.textContent?.trim()).catch(() => "0");
                        const commentsText = await postEl.$eval('[data-testid="comments-count"]',
                            el => el.textContent?.trim()).catch(() => "0");

                        posts.push({
                            id: `reddit_${Date.now()}_${posts.length}`,
                            content: fullContent,
                            engagement: {
                                likes: this.parseCount(scoreText),
                                comments: this.parseCount(commentsText),
                            },
                        });
                    } catch (err) {
                        // Skip invalid posts
                    }
                }

                await this.humanScroll(page, 1);
                scrolls++;
            }

            logger.info({ username, postCount: posts.length }, "Reddit posts scraped");
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
        logger.info({ query, limit }, "Searching Reddit profiles");

        const session = sessionId ? await this.sessionManager.getActiveSession(sessionId) : null;
        const { context, page } = session
            ? { context: session.context, page: session.page }
            : await this.browserPool.acquireContext();

        try {
            // Reddit search for subreddit members matching query
            const searchUrl = `https://www.reddit.com/search/?q=${encodeURIComponent(query)}&type=user`;
            await page.goto(searchUrl, { waitUntil: "networkidle" });
            await this.humanDelay(2000, 4000);

            const profiles: ProfileData[] = [];
            let scrolls = 0;
            const maxScrolls = Math.ceil(limit / 10);

            while (profiles.length < limit && scrolls < maxScrolls) {
                const userCards = await page.$$('[data-testid="user-result"]');

                for (const card of userCards) {
                    if (profiles.length >= limit) break;

                    try {
                        const username = await card.$eval('a',
                            el => el.getAttribute('href')?.split('/user/')[1]?.replace('/', '')).catch(() => "");

                        if (!username || profiles.some(p => p.username === username)) continue;

                        const displayName = await card.$eval('[data-testid="user-name"]',
                            el => el.textContent?.trim()).catch(() => username);
                        const karmaText = await card.$eval('[data-testid="user-karma"]',
                            el => el.textContent?.trim()).catch(() => "0");

                        profiles.push({
                            platform: "reddit",
                            username,
                            displayName: displayName || `u/${username}`,
                            profileUrl: `https://www.reddit.com/user/${username}`,
                            metadata: {
                                followers: this.parseCount(karmaText),
                            },
                        });
                    } catch (err) {
                        // Skip invalid cards
                    }
                }

                await this.humanScroll(page, 1);
                scrolls++;
            }

            logger.info({ query, resultCount: profiles.length }, "Reddit search completed");
            return profiles;

        } finally {
            if (!sessionId) {
                await context.close();
            }
        }
    }

    async sendMessage(username: string, content: string, sessionId: string): Promise<MessageResult> {
        logger.info({ username }, "Sending Reddit message");

        const session = await this.sessionManager.getActiveSession(sessionId);
        if (!session) {
            throw new Error("Session not found");
        }

        const { page } = session;

        try {
            // Navigate to compose message
            await page.goto(`https://www.reddit.com/message/compose/?to=${username}`,
                { waitUntil: "networkidle" });
            await this.humanDelay(2000, 4000);

            // Fill in subject
            const subject = content.substring(0, 50) + (content.length > 50 ? "..." : "");
            await page.fill('input[name="subject"]', subject);
            await this.humanDelay(500, 1000);

            // Fill in message
            await page.fill('textarea[name="text"]', content);
            await this.humanDelay(500, 1000);

            // Send message
            await page.click('button[type="submit"]');
            await this.humanDelay(1500, 2500);

            // Check for success
            const success = await page.$('text="Your message has been delivered"');

            logger.info({ username, success: !!success }, "Reddit message sent");
            return {
                success: !!success,
                timestamp: new Date().toISOString(),
            };

        } catch (err: any) {
            logger.error({ err, username }, "Failed to send Reddit message");
            return {
                success: false,
                error: err.message,
                timestamp: new Date().toISOString(),
            };
        }
    }

    async checkMessages(sessionId: string, lastCheckTime?: string): Promise<any[]> {
        logger.info({ sessionId }, "Checking Reddit messages");

        const session = await this.sessionManager.getActiveSession(sessionId);
        if (!session) {
            throw new Error("Session not found");
        }

        const { page } = session;

        try {
            await page.goto("https://www.reddit.com/message/inbox/", { waitUntil: "networkidle" });
            await this.humanDelay(2000, 4000);

            const messages = await page.$$eval('.message', (elements) => {
                return elements.slice(0, 10).map(el => {
                    const from = el.querySelector('.author')?.textContent?.trim() || "";
                    const subject = el.querySelector('.subject')?.textContent?.trim() || "";
                    const body = el.querySelector('.md')?.textContent?.trim() || "";
                    const unread = el.classList.contains('unread');

                    return { from, subject, body, unread };
                });
            });

            return messages.filter(m => m.unread);

        } catch (err: any) {
            logger.error({ err }, "Failed to check Reddit messages");
            return [];
        }
    }
}
