/**
 * Advanced Profile Filter Parser
 * Parses boolean query expressions into MongoDB queries
 * 
 * Syntax Examples:
 * - Simple: interests:tech
 * - AND: interests:tech AND location:SF
 * - OR: platform:twitter OR platform:linkedin
 * - NOT: NOT status:rejected
 * - Grouped: (interests:ai OR interests:ml) AND location:US
 * - Range: followers:>1000 AND followers:<100000
 * - Contains: bio:*startup*
 */

import { z } from "zod";

// Token types for the lexer
type TokenType =
    | "FIELD"
    | "OPERATOR"
    | "VALUE"
    | "AND"
    | "OR"
    | "NOT"
    | "LPAREN"
    | "RPAREN"
    | "COLON"
    | "EOF";

interface Token {
    type: TokenType;
    value: string;
    position: number;
}

interface ParsedFilter {
    mongoQuery: Record<string, any>;
    errors: string[];
}

// Zod schema for validation
export const AdvancedFilterSchema = z.object({
    query: z.string().max(1000).optional(),
    filters: z
        .object({
            // Standard filters
            status: z.enum(["pending", "approved", "rejected", "engaged"]).optional(),
            platform: z.string().optional(),
            campaignId: z.string().optional(),

            // Range filters
            followersMin: z.number().optional(),
            followersMax: z.number().optional(),
            qualityScoreMin: z.number().min(0).max(100).optional(),
            qualityScoreMax: z.number().min(0).max(100).optional(),
            botProbabilityMax: z.number().min(0).max(100).optional(),

            // Array filters
            interests: z.array(z.string()).optional(),
            interestsMatchAll: z.boolean().optional(),

            // Date filters
            createdAfter: z.string().datetime().optional(),
            createdBefore: z.string().datetime().optional(),
            lastActiveAfter: z.string().datetime().optional(),

            // Boolean query (advanced)
            booleanQuery: z.string().max(1000).optional(),
        })
        .optional(),
});

export type AdvancedFilterInput = z.infer<typeof AdvancedFilterSchema>;
export type AdvancedFilterFilters = NonNullable<AdvancedFilterInput["filters"]>;

/**
 * Tokenize a boolean query string
 */
function tokenize(query: string): Token[] {
    const tokens: Token[] = [];
    let position = 0;

    while (position < query.length) {
        // Skip whitespace
        if (/\s/.test(query[position])) {
            position++;
            continue;
        }

        // Parentheses
        if (query[position] === "(") {
            tokens.push({ type: "LPAREN", value: "(", position });
            position++;
            continue;
        }
        if (query[position] === ")") {
            tokens.push({ type: "RPAREN", value: ")", position });
            position++;
            continue;
        }

        // Colon
        if (query[position] === ":") {
            tokens.push({ type: "COLON", value: ":", position });
            position++;
            continue;
        }

        // Keywords (AND, OR, NOT)
        const remaining = query.slice(position).toUpperCase();
        if (remaining.startsWith("AND ") || remaining.startsWith("AND)")) {
            tokens.push({ type: "AND", value: "AND", position });
            position += 3;
            continue;
        }
        if (remaining.startsWith("OR ") || remaining.startsWith("OR)")) {
            tokens.push({ type: "OR", value: "OR", position });
            position += 2;
            continue;
        }
        if (remaining.startsWith("NOT ")) {
            tokens.push({ type: "NOT", value: "NOT", position });
            position += 3;
            continue;
        }

        // Quoted string
        if (query[position] === '"') {
            let value = "";
            position++; // Skip opening quote
            while (position < query.length && query[position] !== '"') {
                value += query[position];
                position++;
            }
            position++; // Skip closing quote
            tokens.push({ type: "VALUE", value, position: position - value.length - 1 });
            continue;
        }

        // Unquoted word (field name or value)
        let word = "";
        const startPos = position;
        while (
            position < query.length &&
            !/[\s:()"]/.test(query[position])
        ) {
            word += query[position];
            position++;
        }
        if (word) {
            // Determine if it's a field or value based on context
            const lastToken = tokens[tokens.length - 1];
            if (lastToken?.type === "COLON") {
                tokens.push({ type: "VALUE", value: word, position: startPos });
            } else {
                tokens.push({ type: "FIELD", value: word, position: startPos });
            }
        }
    }

    tokens.push({ type: "EOF", value: "", position });
    return tokens;
}

/**
 * Parse tokens into a MongoDB query
 */
class QueryParser {
    private tokens: Token[];
    private position: number = 0;
    private errors: string[] = [];

    constructor(tokens: Token[]) {
        this.tokens = tokens;
    }

    private current(): Token {
        return this.tokens[this.position] || { type: "EOF", value: "", position: 0 };
    }

    private advance(): Token {
        const token = this.current();
        this.position++;
        return token;
    }

    private expect(type: TokenType): Token | null {
        if (this.current().type === type) {
            return this.advance();
        }
        this.errors.push(`Expected ${type} at position ${this.current().position}`);
        return null;
    }

    parse(): { query: Record<string, any>; errors: string[] } {
        const query = this.parseExpression();
        return { query, errors: this.errors };
    }

    private parseExpression(): Record<string, any> {
        return this.parseOr();
    }

    private parseOr(): Record<string, any> {
        let left = this.parseAnd();

        while (this.current().type === "OR") {
            this.advance();
            const right = this.parseAnd();
            left = { $or: [left, right] };
        }

        return left;
    }

    private parseAnd(): Record<string, any> {
        let left = this.parseNot();

        while (this.current().type === "AND") {
            this.advance();
            const right = this.parseNot();
            left = { $and: [left, right] };
        }

        return left;
    }

    private parseNot(): Record<string, any> {
        if (this.current().type === "NOT") {
            this.advance();
            const expr = this.parsePrimary();
            return { $nor: [expr] };
        }
        return this.parsePrimary();
    }

    private parsePrimary(): Record<string, any> {
        // Grouped expression
        if (this.current().type === "LPAREN") {
            this.advance();
            const expr = this.parseExpression();
            this.expect("RPAREN");
            return expr;
        }

        // Field:Value expression
        return this.parseFieldValue();
    }

    private parseFieldValue(): Record<string, any> {
        const fieldToken = this.current();
        if (fieldToken.type !== "FIELD") {
            this.errors.push(`Expected field name at position ${fieldToken.position}`);
            return {};
        }
        this.advance();

        if (this.current().type !== "COLON") {
            this.errors.push(`Expected ':' after field name at position ${this.current().position}`);
            return {};
        }
        this.advance();

        const valueToken = this.current();
        if (valueToken.type !== "VALUE" && valueToken.type !== "FIELD") {
            this.errors.push(`Expected value at position ${valueToken.position}`);
            return {};
        }
        this.advance();

        return this.buildFieldQuery(fieldToken.value, valueToken.value);
    }

    private buildFieldQuery(field: string, value: string): Record<string, any> {
        const fieldMap: Record<string, string> = {
            // Map query field names to MongoDB field names
            interests: "interests",
            platform: "platform",
            status: "status",
            location: "location",
            bio: "bio",
            username: "username",
            displayname: "displayName",
            followers: "followers",
            following: "following",
            posts: "posts",
            qualityscore: "qualityScore",
            quality: "qualityScore",
            botscore: "botProbability",
            bot: "botProbability",
            riskscore: "riskScore",
            risk: "riskScore",
            campaignid: "campaignId",
            verified: "verified",
        };

        const mongoField = fieldMap[field.toLowerCase()] || field;

        // Handle comparison operators
        if (value.startsWith(">")) {
            const numValue = parseFloat(value.slice(1));
            if (!isNaN(numValue)) {
                return { [mongoField]: { $gt: numValue } };
            }
        }
        if (value.startsWith(">=")) {
            const numValue = parseFloat(value.slice(2));
            if (!isNaN(numValue)) {
                return { [mongoField]: { $gte: numValue } };
            }
        }
        if (value.startsWith("<")) {
            const numValue = parseFloat(value.slice(1));
            if (!isNaN(numValue)) {
                return { [mongoField]: { $lt: numValue } };
            }
        }
        if (value.startsWith("<=")) {
            const numValue = parseFloat(value.slice(2));
            if (!isNaN(numValue)) {
                return { [mongoField]: { $lte: numValue } };
            }
        }

        // Handle wildcard patterns
        if (value.includes("*")) {
            const regexPattern = value.replace(/\*/g, ".*");
            return { [mongoField]: { $regex: regexPattern, $options: "i" } };
        }

        // Handle boolean values
        if (value.toLowerCase() === "true") {
            return { [mongoField]: true };
        }
        if (value.toLowerCase() === "false") {
            return { [mongoField]: false };
        }

        // Handle numeric values
        const numValue = parseFloat(value);
        if (!isNaN(numValue) && isFinite(numValue)) {
            return { [mongoField]: numValue };
        }

        // Array field (interests) - check if contains
        if (mongoField === "interests") {
            return { [mongoField]: value };
        }

        // Default: exact match (case-insensitive for strings)
        return { [mongoField]: { $regex: `^${escapeRegex(value)}$`, $options: "i" } };
    }
}

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Parse a boolean query string into a MongoDB query
 */
export function parseBooleanQuery(query: string): ParsedFilter {
    if (!query || query.trim() === "") {
        return { mongoQuery: {}, errors: [] };
    }

    try {
        const tokens = tokenize(query);
        const parser = new QueryParser(tokens);
        const { query: mongoQuery, errors } = parser.parse();
        return { mongoQuery, errors };
    } catch (err: any) {
        return {
            mongoQuery: {},
            errors: [`Parse error: ${err.message}`],
        };
    }
}

/**
 * Build a complete MongoDB query from structured filters
 */
export function buildAdvancedQuery(input: AdvancedFilterInput): Record<string, any> {
    const query: Record<string, any> = {};
    const filters = (input.filters || {}) as Partial<AdvancedFilterFilters>;

    // Standard filters
    if (filters.status) {
        query.status = filters.status;
    }
    if (filters.platform) {
        query.platform = { $regex: `^${escapeRegex(filters.platform)}$`, $options: "i" };
    }
    if (filters.campaignId) {
        query.campaignId = filters.campaignId;
    }

    // Range filters
    if (filters.followersMin !== undefined || filters.followersMax !== undefined) {
        query.followers = {};
        if (filters.followersMin !== undefined) query.followers.$gte = filters.followersMin;
        if (filters.followersMax !== undefined) query.followers.$lte = filters.followersMax;
    }
    if (filters.qualityScoreMin !== undefined || filters.qualityScoreMax !== undefined) {
        query.qualityScore = {};
        if (filters.qualityScoreMin !== undefined) query.qualityScore.$gte = filters.qualityScoreMin;
        if (filters.qualityScoreMax !== undefined) query.qualityScore.$lte = filters.qualityScoreMax;
    }
    if (filters.botProbabilityMax !== undefined) {
        query.botProbability = { $lte: filters.botProbabilityMax };
    }

    // Array filters
    if (filters.interests && filters.interests.length > 0) {
        if (filters.interestsMatchAll) {
            query.interests = { $all: filters.interests };
        } else {
            query.interests = { $in: filters.interests };
        }
    }

    // Date filters
    if (filters.createdAfter || filters.createdBefore) {
        query.createdAt = {};
        if (filters.createdAfter) query.createdAt.$gte = new Date(filters.createdAfter);
        if (filters.createdBefore) query.createdAt.$lte = new Date(filters.createdBefore);
    }
    if (filters.lastActiveAfter) {
        query.lastActive = { $gte: new Date(filters.lastActiveAfter) };
    }

    // Boolean query (advanced syntax)
    if (filters.booleanQuery) {
        const { mongoQuery, errors } = parseBooleanQuery(filters.booleanQuery);
        if (errors.length === 0 && Object.keys(mongoQuery).length > 0) {
            // Merge with existing query using $and
            if (Object.keys(query).length > 0) {
                return { $and: [query, mongoQuery] };
            }
            return mongoQuery;
        }
    }

    return query;
}
