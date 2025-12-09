/**
 * LinkedIn Platform Adapter
 * Scraping and messaging for LinkedIn
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

export class LinkedInAdapter extends BasePlatformAdapter {
    constructor(browserPool: BrowserPool, sessionManager: SessionManager) {
        super(browserPool, sessionManager, "linkedin");
    }

    async scrapeProfile(username: string, sessionId?: string): Promise<ProfileData> {
        logger.info({ username }, "Scraping LinkedIn profile");

        const session = sessionId ? await this.sessionManager.getActiveSession(sessionId) : null;
        if (!session && !sessionId) {
            // LinkedIn requires authentication
            throw new Error("LinkedIn scraping requires an authenticated session");
        }

        const { page } = session || await this.browserPool.acquireContext();

        try {
            const profileUrl = `https://www.linkedin.com/in/${username}`;
            await page.goto(profileUrl, { waitUntil: "networkidle" });
            await this.humanDelay(2000, 4000);

            // Check for login wall
            const loginWall = await page.$('.join-login-options');
            if (loginWall) {
                throw new Error("Authentication required");
            }

            // Check if profile exists
            const notFound = await page.$('text="Page not found"');
            if (notFound) {
                throw new Error("Profile not found");
            }

            // Extract profile data
            const displayName = await page.$eval('.pv-text-details__left-panel h1',
                el => el.textContent?.trim()).catch(() => username);

            const headline = await page.$eval('.pv-text-details__left-panel .text-body-medium',
                el => el.textContent?.trim()).catch(() => "");

            const avatarUrl = await page.$eval('.pv-top-card-profile-picture__image',
                el => el.getAttribute("src")).catch(() => "");

            // Extract about section
            const bio = await page.$eval('#about + div .pv-shared-text-with-see-more span',
                el => el.textContent?.trim()).catch(() => "");

            // Extract location
            const location = await page.$eval('.pv-text-details__left-panel .text-body-small',
                el => el.textContent?.trim()).catch(() => "");

            // Extract connections count
            const connectionsText = await page.$eval('.pv-top-card--list-bullet li span',
                el => el.textContent?.trim()).catch(() => "0");

            // Check for verified badge
            const verified = await page.$('.artdeco-verify-badge') !== null;

            const profile: ProfileData = {
                platform: "linkedin",
                username,
                displayName: displayName || username,
                bio: bio || headline || undefined,
                avatarUrl: avatarUrl || undefined,
                profileUrl,
                metadata: {
                    followers: this.parseCount(connectionsText),
                    verified,
                    location: location || undefined,
                },
            };

            logger.info({ username, connections: profile.metadata.followers }, "LinkedIn profile scraped");
            return profile;

        } finally {
            if (!sessionId && !session) {
                await page.context().close();
            }
        }
    }

    async scrapePosts(username: string, sessionId?: string, limit: number = 20): Promise<PostData[]> {
        logger.info({ username, limit }, "Scraping LinkedIn posts");

        const session = sessionId ? await this.sessionManager.getActiveSession(sessionId) : null;
        if (!session) {
            throw new Error("LinkedIn scraping requires an authenticated session");
        }

        const { page } = session;

        try {
            await page.goto(`https://www.linkedin.com/in/${username}/recent-activity/all/`,
                { waitUntil: "networkidle" });
            await this.humanDelay(2000, 4000);

            const posts: PostData[] = [];
            let scrolls = 0;
            const maxScrolls = Math.ceil(limit / 3);

            while (posts.length < limit && scrolls < maxScrolls) {
                // Extract visible posts
                const postElements = await page.$$('.feed-shared-update-v2');

                for (const postEl of postElements) {
                    if (posts.length >= limit) break;

                    try {
                        const content = await postEl.$eval('.feed-shared-text span',
                            el => el.textContent?.trim()).catch(() => "");

                        if (!content || posts.some(p => p.content === content)) continue;

                        const timestamp = await postEl.$eval('time',
                            el => el.getAttribute('datetime')).catch(() => "");

                        const likesText = await postEl.$eval('.social-details-social-counts__reactions-count',
                            el => el.textContent?.trim()).catch(() => "0");
                        const commentsText = await postEl.$eval('.social-details-social-counts__comments',
                            el => el.textContent?.trim()).catch(() => "0");

                        posts.push({
                            id: `linkedin_${Date.now()}_${posts.length}`,
                            content,
                            timestamp: timestamp || undefined,
                            engagement: {
                                likes: this.parseCount(likesText),
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

            logger.info({ username, postCount: posts.length }, "LinkedIn posts scraped");
            return posts;

        } catch (err: any) {
            logger.error({ err }, "Failed to scrape LinkedIn posts");
            return [];
        }
    }

    async searchProfiles(
        query: string,
        filters?: SearchFilters,
        sessionId?: string,
        limit: number = 50
    ): Promise<ProfileData[]> {
        logger.info({ query, limit }, "Searching LinkedIn profiles");

        const session = sessionId ? await this.sessionManager.getActiveSession(sessionId) : null;
        if (!session) {
            throw new Error("LinkedIn search requires an authenticated session");
        }

        const { page } = session;

        try {
            // Navigate to search
            let searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(query)}`;

            // Add filters
            if (filters?.location) {
                searchUrl += `&geoUrn=${encodeURIComponent(filters.location)}`;
            }

            await page.goto(searchUrl, { waitUntil: "networkidle" });
            await this.humanDelay(2000, 4000);

            const profiles: ProfileData[] = [];
            let pageNum = 1;
            const maxPages = Math.ceil(limit / 10);

            while (profiles.length < limit && pageNum <= maxPages) {
                // Extract visible profile cards
                const cards = await page.$$('.entity-result');

                for (const card of cards) {
                    if (profiles.length >= limit) break;

                    try {
                        const profileLink = await card.$eval('.entity-result__title-text a',
                            el => el.getAttribute('href')).catch(() => "");

                        if (!profileLink) continue;

                        const username = profileLink.split('/in/')[1]?.split('/')[0] || "";
                        if (!username || profiles.some(p => p.username === username)) continue;

                        const displayName = await card.$eval('.entity-result__title-text span[aria-hidden="true"]',
                            el => el.textContent?.trim()).catch(() => "");
                        const headline = await card.$eval('.entity-result__primary-subtitle',
                            el => el.textContent?.trim()).catch(() => "");
                        const location = await card.$eval('.entity-result__secondary-subtitle',
                            el => el.textContent?.trim()).catch(() => "");
                        const avatarUrl = await card.$eval('.entity-result__image img',
                            el => el.getAttribute('src')).catch(() => "");

                        profiles.push({
                            platform: "linkedin",
                            username,
                            displayName: displayName || username,
                            bio: headline || undefined,
                            avatarUrl: avatarUrl || undefined,
                            profileUrl: `https://www.linkedin.com/in/${username}`,
                            metadata: {
                                location: location || undefined,
                            },
                        });
                    } catch (err) {
                        // Skip invalid cards
                    }
                }

                // Go to next page
                if (profiles.length < limit) {
                    const nextBtn = await page.$('button[aria-label="Next"]');
                    if (nextBtn) {
                        await nextBtn.click();
                        await page.waitForLoadState("networkidle");
                        await this.humanDelay(2000, 4000);
                        pageNum++;
                    } else {
                        break;
                    }
                }
            }

            logger.info({ query, resultCount: profiles.length }, "LinkedIn search completed");
            return profiles;

        } catch (err: any) {
            logger.error({ err }, "Failed to search LinkedIn");
            return [];
        }
    }

    async sendMessage(username: string, content: string, sessionId: string): Promise<MessageResult> {
        logger.info({ username }, "Sending LinkedIn message");

        const session = await this.sessionManager.getActiveSession(sessionId);
        if (!session) {
            throw new Error("Session not found");
        }

        const { page } = session;

        try {
            // Navigate to profile
            await page.goto(`https://www.linkedin.com/in/${username}`, { waitUntil: "networkidle" });
            await this.humanDelay(2000, 4000);

            // Click message button
            const messageBtn = await page.$('button:has-text("Message")');
            if (!messageBtn) {
                throw new Error("Message button not found - may need to connect first");
            }
            await messageBtn.click();
            await this.humanDelay(1500, 2500);

            // Wait for message modal
            await page.waitForSelector('.msg-form__contenteditable');
            await this.humanDelay(500, 1000);

            // Type message
            await page.click('.msg-form__contenteditable');
            await page.type('.msg-form__contenteditable', content, { delay: 30 + Math.random() * 50 });
            await this.humanDelay(500, 1000);

            // Send message
            await page.click('button.msg-form__send-button');
            await this.humanDelay(1000, 2000);

            logger.info({ username }, "LinkedIn message sent");
            return {
                success: true,
                timestamp: new Date().toISOString(),
            };

        } catch (err: any) {
            logger.error({ err, username }, "Failed to send LinkedIn message");
            return {
                success: false,
                error: err.message,
                timestamp: new Date().toISOString(),
            };
        }
    }

    async checkMessages(sessionId: string, lastCheckTime?: string): Promise<any[]> {
        logger.info({ sessionId }, "Checking LinkedIn messages");

        const session = await this.sessionManager.getActiveSession(sessionId);
        if (!session) {
            throw new Error("Session not found");
        }

        const { page } = session;

        try {
            await page.goto("https://www.linkedin.com/messaging/", { waitUntil: "networkidle" });
            await this.humanDelay(2000, 4000);

            // Extract recent conversations
            const conversations = await page.$$eval('.msg-conversation-listitem', (elements) => {
                return elements.slice(0, 10).map(el => {
                    const name = el.querySelector('.msg-conversation-listitem__participant-names')?.textContent?.trim() || "";
                    const lastMessage = el.querySelector('.msg-conversation-card__message-snippet-body')?.textContent?.trim() || "";
                    const time = el.querySelector('.msg-conversation-listitem__time-stamp')?.textContent?.trim() || "";
                    const unread = el.classList.contains('msg-conversation-listitem--unread');

                    return { name, lastMessage, time, unread };
                });
            });

            return conversations.filter(c => c.unread);

        } catch (err: any) {
            logger.error({ err }, "Failed to check LinkedIn messages");
            return [];
        }
    }
}
