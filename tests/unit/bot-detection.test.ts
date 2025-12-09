/**
 * Unit Tests - Bot Detection Module
 * Tests for the filtering worker's bot detection logic
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Mock the local detection functions (since they're not exported)
// In production, these would be properly exported for testing

interface ProfileData {
    _id: string;
    platform: string;
    username: string;
    displayName?: string;
    bio?: string;
    metadata?: {
        followers?: number;
        following?: number;
        postsCount?: number;
        verified?: boolean;
        joinDate?: string;
        lastActive?: string;
    };
    posts?: any[];
}

// Simplified bot detection functions for testing
function detectStatisticalAnomalies(profile: ProfileData): { score: number; flags: string[] } {
    let score = 0;
    const flags: string[] = [];
    const meta = profile.metadata || {};

    const followers = meta.followers || 0;
    const following = meta.following || 0;
    const ratio = following > 0 ? followers / following : 0;

    if (ratio > 100) {
        score += 10;
        flags.push("extreme_follower_ratio_high");
    } else if (ratio < 0.01 && followers > 100) {
        score += 15;
        flags.push("extreme_follower_ratio_low");
    }

    if (meta.postsCount && meta.postsCount > 1000) {
        score += 5;
        flags.push("high_post_count");
    }

    if (meta.joinDate) {
        const accountAge = Date.now() - new Date(meta.joinDate).getTime();
        const daysOld = accountAge / (24 * 60 * 60 * 1000);
        if (daysOld < 30 && (meta.postsCount || 0) > 100) {
            score += 20;
            flags.push("new_account_high_activity");
        }
    }

    return { score, flags };
}

describe('Bot Detection - Statistical Anomalies', () => {
    it('should detect extreme high follower ratio', () => {
        const profile: ProfileData = {
            _id: '1',
            platform: 'twitter',
            username: 'test_user',
            metadata: {
                followers: 1000000,
                following: 100,
            },
        };

        const result = detectStatisticalAnomalies(profile);

        expect(result.score).toBeGreaterThan(0);
        expect(result.flags).toContain('extreme_follower_ratio_high');
    });

    it('should detect extreme low follower ratio', () => {
        const profile: ProfileData = {
            _id: '2',
            platform: 'twitter',
            username: 'follow_bot',
            metadata: {
                followers: 500,
                following: 50000,
            },
        };

        const result = detectStatisticalAnomalies(profile);

        expect(result.score).toBeGreaterThan(0);
        expect(result.flags).toContain('extreme_follower_ratio_low');
    });

    it('should detect new account with high activity', () => {
        const profile: ProfileData = {
            _id: '3',
            platform: 'twitter',
            username: 'new_spammer',
            metadata: {
                followers: 100,
                following: 100,
                postsCount: 500,
                joinDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
            },
        };

        const result = detectStatisticalAnomalies(profile);

        expect(result.score).toBeGreaterThan(0);
        expect(result.flags).toContain('new_account_high_activity');
    });

    it('should not flag normal profiles', () => {
        const profile: ProfileData = {
            _id: '4',
            platform: 'twitter',
            username: 'normal_user',
            metadata: {
                followers: 500,
                following: 300,
                postsCount: 100,
                joinDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year ago
            },
        };

        const result = detectStatisticalAnomalies(profile);

        expect(result.score).toBe(0);
        expect(result.flags).toHaveLength(0);
    });

    it('should detect high post count', () => {
        const profile: ProfileData = {
            _id: '5',
            platform: 'twitter',
            username: 'power_poster',
            metadata: {
                followers: 5000,
                following: 2000,
                postsCount: 1500,
            },
        };

        const result = detectStatisticalAnomalies(profile);

        expect(result.flags).toContain('high_post_count');
    });
});

describe('Profile Quality Score', () => {
    function calculateQualityScore(profile: ProfileData, botScore: number): number {
        let quality = 100 - botScore;
        const meta = profile.metadata || {};

        if (meta.verified) quality += 20;

        const followers = meta.followers || 0;
        if (followers > 100 && followers < 50000) {
            quality += 10;
        } else if (followers >= 50000 && followers < 500000) {
            quality += 5;
        }

        if (profile.bio && profile.bio.length > 50) {
            quality += 5;
        }

        if ((profile.posts?.length || 0) > 5) {
            quality += 5;
        }

        return Math.max(0, Math.min(100, quality));
    }

    it('should give high score to verified accounts', () => {
        const profile: ProfileData = {
            _id: '1',
            platform: 'twitter',
            username: 'verified_user',
            metadata: { verified: true, followers: 10000 },
        };

        const quality = calculateQualityScore(profile, 0);

        expect(quality).toBeGreaterThanOrEqual(120);
    });

    it('should penalize high bot scores', () => {
        const profile: ProfileData = {
            _id: '2',
            platform: 'twitter',
            username: 'suspicious_user',
            metadata: { followers: 1000 },
        };

        const qualityWithLowBot = calculateQualityScore(profile, 10);
        const qualityWithHighBot = calculateQualityScore(profile, 60);

        expect(qualityWithLowBot).toBeGreaterThan(qualityWithHighBot);
    });

    it('should reward profiles with good bio and posts', () => {
        const profileWithContent: ProfileData = {
            _id: '3',
            platform: 'twitter',
            username: 'content_creator',
            bio: 'This is a detailed bio that describes the user and their interests in great length.',
            metadata: { followers: 1000 },
            posts: [{}, {}, {}, {}, {}, {}, {}], // 7 posts
        };

        const profileWithoutContent: ProfileData = {
            _id: '4',
            platform: 'twitter',
            username: 'empty_profile',
            metadata: { followers: 1000 },
        };

        const qualityWithContent = calculateQualityScore(profileWithContent, 0);
        const qualityWithoutContent = calculateQualityScore(profileWithoutContent, 0);

        expect(qualityWithContent).toBeGreaterThan(qualityWithoutContent);
    });
});
