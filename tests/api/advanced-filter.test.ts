/**
 * Test Suite: Advanced Profile Filtering
 * Tests boolean query parsing and MongoDB query generation
 */

import { describe, it, expect } from "vitest";
import {
    parseBooleanQuery,
    buildAdvancedQuery,
    AdvancedFilterSchema,
} from "../../backend/api/src/lib/advanced-filter.js";

describe("Boolean Query Parser", () => {
    describe("Simple Queries", () => {
        it("should parse single field:value", () => {
            const { mongoQuery, errors } = parseBooleanQuery("interests:tech");
            expect(errors).toHaveLength(0);
            expect(mongoQuery).toEqual({ interests: "tech" });
        });

        it("should parse numeric comparison (>)", () => {
            const { mongoQuery, errors } = parseBooleanQuery("followers:>1000");
            expect(errors).toHaveLength(0);
            expect(mongoQuery).toEqual({ followers: { $gt: 1000 } });
        });

        it("should parse numeric comparison (>=)", () => {
            const { mongoQuery, errors } = parseBooleanQuery("qualityScore:>=80");
            expect(errors).toHaveLength(0);
            expect(mongoQuery).toEqual({ qualityScore: { $gte: 80 } });
        });

        it("should parse numeric comparison (<)", () => {
            const { mongoQuery, errors } = parseBooleanQuery("botProbability:<30");
            expect(errors).toHaveLength(0);
            expect(mongoQuery).toEqual({ botProbability: { $lt: 30 } });
        });

        it("should parse wildcard patterns", () => {
            const { mongoQuery, errors } = parseBooleanQuery("bio:*startup*");
            expect(errors).toHaveLength(0);
            expect(mongoQuery.bio.$regex).toBe(".*startup.*");
            expect(mongoQuery.bio.$options).toBe("i");
        });

        it("should parse boolean values", () => {
            const { mongoQuery: trueQuery } = parseBooleanQuery("verified:true");
            expect(trueQuery).toEqual({ verified: true });

            const { mongoQuery: falseQuery } = parseBooleanQuery("verified:false");
            expect(falseQuery).toEqual({ verified: false });
        });
    });

    describe("Compound Queries", () => {
        it("should parse AND expressions", () => {
            const { mongoQuery, errors } = parseBooleanQuery(
                "platform:twitter AND followers:>1000"
            );
            expect(errors).toHaveLength(0);
            expect(mongoQuery.$and).toBeDefined();
            expect(mongoQuery.$and).toHaveLength(2);
        });

        it("should parse OR expressions", () => {
            const { mongoQuery, errors } = parseBooleanQuery(
                "platform:twitter OR platform:linkedin"
            );
            expect(errors).toHaveLength(0);
            expect(mongoQuery.$or).toBeDefined();
            expect(mongoQuery.$or).toHaveLength(2);
        });

        it("should parse NOT expressions", () => {
            const { mongoQuery, errors } = parseBooleanQuery("NOT status:rejected");
            expect(errors).toHaveLength(0);
            expect(mongoQuery.$nor).toBeDefined();
        });

        it("should parse grouped expressions", () => {
            const { mongoQuery, errors } = parseBooleanQuery(
                "(interests:ai OR interests:ml) AND location:US"
            );
            expect(errors).toHaveLength(0);
            expect(mongoQuery.$and).toBeDefined();
        });

        it("should handle complex nested queries", () => {
            const { mongoQuery, errors } = parseBooleanQuery(
                "(interests:tech AND followers:>1000) OR (platform:linkedin AND verified:true)"
            );
            expect(errors).toHaveLength(0);
            expect(mongoQuery.$or).toBeDefined();
        });
    });

    describe("Field Name Mapping", () => {
        it("should map qualityscore to qualityScore", () => {
            const { mongoQuery } = parseBooleanQuery("qualityscore:>80");
            expect(mongoQuery.qualityScore).toBeDefined();
        });

        it("should map displayname to displayName", () => {
            const { mongoQuery } = parseBooleanQuery("displayname:John");
            expect(mongoQuery.displayName).toBeDefined();
        });

        it("should map bot to botProbability", () => {
            const { mongoQuery } = parseBooleanQuery("bot:<20");
            expect(mongoQuery.botProbability).toBeDefined();
        });
    });

    describe("Error Handling", () => {
        it("should return empty query for empty string", () => {
            const { mongoQuery, errors } = parseBooleanQuery("");
            expect(errors).toHaveLength(0);
            expect(mongoQuery).toEqual({});
        });

        it("should return empty query for whitespace only", () => {
            const { mongoQuery, errors } = parseBooleanQuery("   ");
            expect(errors).toHaveLength(0);
            expect(mongoQuery).toEqual({});
        });
    });
});

describe("Advanced Filter Schema", () => {
    it("should validate correct structured filters", () => {
        const input = {
            query: "search term",
            filters: {
                status: "pending",
                platform: "twitter",
                followersMin: 1000,
                followersMax: 100000,
                qualityScoreMin: 70,
                interests: ["ai", "tech"],
            },
        };

        const result = AdvancedFilterSchema.safeParse(input);
        expect(result.success).toBe(true);
    });

    it("should reject invalid status", () => {
        const input = {
            filters: {
                status: "invalid-status",
            },
        };

        const result = AdvancedFilterSchema.safeParse(input);
        expect(result.success).toBe(false);
    });

    it("should reject quality score out of range", () => {
        const input = {
            filters: {
                qualityScoreMin: 150, // Invalid, max is 100
            },
        };

        const result = AdvancedFilterSchema.safeParse(input);
        expect(result.success).toBe(false);
    });
});

describe("buildAdvancedQuery", () => {
    it("should build query from structured filters", () => {
        const query = buildAdvancedQuery({
            filters: {
                status: "pending",
                platform: "twitter",
                followersMin: 1000,
                followersMax: 50000,
            },
        });

        expect(query.status).toBe("pending");
        expect(query.platform.$regex).toBeDefined();
        expect(query.followers.$gte).toBe(1000);
        expect(query.followers.$lte).toBe(50000);
    });

    it("should build query with interests array (OR)", () => {
        const query = buildAdvancedQuery({
            filters: {
                interests: ["ai", "ml", "data"],
                interestsMatchAll: false,
            },
        });

        expect(query.interests.$in).toEqual(["ai", "ml", "data"]);
    });

    it("should build query with interests array (AND)", () => {
        const query = buildAdvancedQuery({
            filters: {
                interests: ["ai", "ml"],
                interestsMatchAll: true,
            },
        });

        expect(query.interests.$all).toEqual(["ai", "ml"]);
    });

    it("should merge structured filters with boolean query", () => {
        const query = buildAdvancedQuery({
            filters: {
                status: "approved",
                booleanQuery: "followers:>5000",
            },
        });

        expect(query.$and).toBeDefined();
        expect(query.$and).toHaveLength(2);
    });

    it("should handle date filters", () => {
        const query = buildAdvancedQuery({
            filters: {
                createdAfter: "2024-01-01T00:00:00Z",
                createdBefore: "2024-12-31T23:59:59Z",
            },
        });

        expect(query.createdAt.$gte).toBeInstanceOf(Date);
        expect(query.createdAt.$lte).toBeInstanceOf(Date);
    });
});
