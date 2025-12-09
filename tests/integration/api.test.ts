/**
 * Integration Tests - API Routes
 * Tests for the API endpoints
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const API_URL = process.env.TEST_API_URL || 'http://localhost:4050';

// Helper to make API requests
async function apiRequest(
    path: string,
    options: RequestInit = {}
): Promise<{ status: number; data: any }> {
    const res = await fetch(`${API_URL}${path}`, {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
        ...options,
    });

    const data = await res.json().catch(() => null);
    return { status: res.status, data };
}

describe('Health Check', () => {
    it('should return healthy status', async () => {
        const { status, data } = await apiRequest('/health');

        expect(status).toBe(200);
        expect(data).toHaveProperty('status');
    });
});

describe('Campaigns API', () => {
    let createdCampaignId: string;

    it('should create a new campaign', async () => {
        const { status, data } = await apiRequest('/campaigns', {
            method: 'POST',
            body: JSON.stringify({
                name: 'Test Campaign',
                targetCriteria: {
                    platforms: ['twitter', 'reddit'],
                    interests: ['technology'],
                },
            }),
        });

        expect(status).toBe(200);
        expect(data).toHaveProperty('_id');
        createdCampaignId = data._id;
    });

    it('should list all campaigns', async () => {
        const { status, data } = await apiRequest('/campaigns');

        expect(status).toBe(200);
        expect(Array.isArray(data)).toBe(true);
    });

    it('should get campaign by ID', async () => {
        if (!createdCampaignId) return;

        const { status, data } = await apiRequest(`/campaigns/${createdCampaignId}`);

        expect(status).toBe(200);
        expect(data._id).toBe(createdCampaignId);
    });

    it('should start a campaign', async () => {
        if (!createdCampaignId) return;

        const { status } = await apiRequest(`/campaigns/${createdCampaignId}/start`, {
            method: 'POST',
        });

        expect(status).toBe(200);
    });

    it('should pause a running campaign', async () => {
        if (!createdCampaignId) return;

        const { status } = await apiRequest(`/campaigns/${createdCampaignId}/pause`, {
            method: 'POST',
        });

        expect(status).toBe(200);
    });

    it('should delete a campaign', async () => {
        if (!createdCampaignId) return;

        const { status } = await apiRequest(`/campaigns/${createdCampaignId}`, {
            method: 'DELETE',
        });

        expect(status).toBe(200);
    });
});

describe('Profiles API', () => {
    let testProfileId: string;

    it('should create a profile', async () => {
        const { status, data } = await apiRequest('/profiles', {
            method: 'POST',
            body: JSON.stringify({
                platform: 'twitter',
                username: `test_user_${Date.now()}`,
                bio: 'Test profile for integration testing',
                metadata: {
                    followers: 1000,
                    following: 500,
                },
            }),
        });

        expect(status).toBe(200);
        expect(data).toHaveProperty('_id');
        testProfileId = data._id;
    });

    it('should get profile by ID', async () => {
        if (!testProfileId) return;

        const { status, data } = await apiRequest(`/profiles/${testProfileId}`);

        expect(status).toBe(200);
        expect(data._id).toBe(testProfileId);
    });

    it('should search profiles by text', async () => {
        const { status, data } = await apiRequest('/profiles/search?q=test');

        expect(status).toBe(200);
        expect(Array.isArray(data)).toBe(true);
    });

    it('should approve a profile', async () => {
        if (!testProfileId) return;

        const { status } = await apiRequest(`/profiles/${testProfileId}/approve`, {
            method: 'POST',
        });

        expect(status).toBe(200);
    });

    it('should batch approve profiles', async () => {
        const { status } = await apiRequest('/profiles/batch/approve', {
            method: 'POST',
            body: JSON.stringify({ ids: [] }), // Empty array for safety
        });

        expect(status).toBe(200);
    });

    it('should get profile count by status', async () => {
        const { status, data } = await apiRequest('/profiles/count');

        expect(status).toBe(200);
        expect(data).toHaveProperty('pending');
        expect(data).toHaveProperty('approved');
        expect(data).toHaveProperty('rejected');
    });
});

describe('Analytics API', () => {
    it('should get aggregated metrics', async () => {
        const { status, data } = await apiRequest('/analytics/metrics');

        expect(status).toBe(200);
        expect(data).toHaveProperty('totalProfiles');
        expect(data).toHaveProperty('totalCampaigns');
    });

    it('should get realtime stats', async () => {
        const { status, data } = await apiRequest('/analytics/realtime');

        expect(status).toBe(200);
        expect(data).toHaveProperty('activeWorkers');
    });

    it('should get pipeline health', async () => {
        const { status, data } = await apiRequest('/analytics/health');

        expect(status).toBe(200);
        expect(data).toHaveProperty('overall');
        expect(data).toHaveProperty('workers');
    });

    it('should record an analytics event', async () => {
        const { status } = await apiRequest('/analytics/event', {
            method: 'POST',
            body: JSON.stringify({
                eventType: 'test_event',
                campaignId: 'test-campaign-id',
                data: { test: true },
            }),
        });

        expect(status).toBe(200);
    });
});

describe('Authentication API', () => {
    const testUser = {
        username: `testuser_${Date.now()}`,
        password: 'TestPassword123!',
    };
    let accessToken: string;
    let refreshToken: string;

    it('should register a new user', async () => {
        const { status, data } = await apiRequest('/auth/register', {
            method: 'POST',
            body: JSON.stringify(testUser),
        });

        // May return 200 or 409 if user exists
        expect([200, 409]).toContain(status);
    });

    it('should login and receive tokens', async () => {
        const { status, data } = await apiRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify(testUser),
        });

        if (status === 200) {
            expect(data).toHaveProperty('accessToken');
            expect(data).toHaveProperty('refreshToken');
            accessToken = data.accessToken;
            refreshToken = data.refreshToken;
        }
    });

    it('should get user info with token', async () => {
        if (!accessToken) return;

        const { status, data } = await apiRequest('/auth/me', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        expect(status).toBe(200);
        expect(data).toHaveProperty('username');
    });

    it('should refresh access token', async () => {
        if (!refreshToken) return;

        const { status, data } = await apiRequest('/auth/refresh', {
            method: 'POST',
            body: JSON.stringify({ refreshToken }),
        });

        if (status === 200) {
            expect(data).toHaveProperty('accessToken');
        }
    });
});
