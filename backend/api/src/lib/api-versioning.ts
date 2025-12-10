/**
 * API Versioning Framework
 * 
 * Provides infrastructure for managing multiple API versions:
 * - Version negotiation via headers, path, or query
 * - Deprecation warnings and sunset headers
 * - Migration helpers
 * - Version-specific transformers
 * 
 * @module lib/api-versioning
 */

import { FastifyInstance, FastifyRequest, FastifyReply, FastifyPluginAsync } from 'fastify';

// ============================================================================
// Types
// ============================================================================

export interface ApiVersion {
    /** Version number (e.g., 1, 2) */
    version: number;
    /** Version string (e.g., "v1", "v2") */
    prefix: string;
    /** Status of this version */
    status: 'current' | 'supported' | 'deprecated' | 'sunset';
    /** End of life date (ISO string) */
    sunsetDate?: string;
    /** Release date */
    releasedAt: string;
    /** Description of this version */
    description: string;
    /** Breaking changes from previous version */
    breakingChanges?: string[];
    /** New features added */
    newFeatures?: string[];
    /** Deprecated endpoints in this version */
    deprecatedEndpoints?: string[];
}

export interface VersionNegotiationResult {
    version: number;
    prefix: string;
    source: 'path' | 'header' | 'query' | 'default';
    isDeprecated: boolean;
    sunsetDate?: string;
}

export interface ApiVersionConfig {
    /** All supported API versions */
    versions: ApiVersion[];
    /** Default version when none specified */
    defaultVersion: number;
    /** Header name for version negotiation */
    versionHeader: string;
    /** Query parameter for version */
    versionQuery: string;
    /** Enable migration warnings */
    enableMigrationWarnings: boolean;
}

export interface EndpointMigration {
    /** Old endpoint path */
    from: string;
    /** New endpoint path */
    to: string;
    /** Version this migration applies to */
    fromVersion: number;
    /** Target version */
    toVersion: number;
    /** Type of migration */
    type: 'moved' | 'renamed' | 'removed' | 'merged';
    /** Description of the change */
    description: string;
    /** Automatic redirect enabled */
    autoRedirect: boolean;
}

export interface ResponseTransformer {
    /** Version this transformer applies to */
    version: number;
    /** Endpoint pattern to match */
    endpointPattern: string;
    /** Transform function */
    transform: (data: unknown, request: FastifyRequest) => unknown;
}

// ============================================================================
// Version Registry
// ============================================================================

export const API_VERSIONS: ApiVersion[] = [
    {
        version: 1,
        prefix: 'v1',
        status: 'current',
        releasedAt: '2024-12-01',
        description: 'Initial stable API release',
        newFeatures: [
            'Full CRUD for campaigns, profiles, messages',
            'Webhook notification system',
            'Advanced profile filtering with boolean queries',
            'Cloak anti-detection endpoints',
            'Real-time WebSocket notifications',
            'RBAC-based authorization'
        ],
        deprecatedEndpoints: []
    },
    {
        version: 2,
        prefix: 'v2',
        status: 'supported', // Will switch to 'current' when v2 is ready
        releasedAt: '2025-03-01', // Planned release
        sunsetDate: undefined,
        description: 'Enhanced API with improved data models',
        breakingChanges: [
            'Profile response structure changed (nested → flat)',
            'Campaign status enum values changed',
            'Pagination uses cursor-based instead of offset',
            'Auth tokens now use RS256 instead of HS256',
            'Webhook events use CloudEvents format'
        ],
        newFeatures: [
            'GraphQL endpoint for complex queries',
            'Batch operations with transactions',
            'Enhanced rate limiting with quotas',
            'Server-sent events for streaming',
            'Improved error response format (RFC 7807)'
        ],
        deprecatedEndpoints: [
            '/v2/profiles/search (use /v2/profiles/query)',
            '/v2/analytics/metrics (use /v2/analytics/time-series)'
        ]
    }
];

// ============================================================================
// Endpoint Migrations v1 → v2
// ============================================================================

export const ENDPOINT_MIGRATIONS: EndpointMigration[] = [
    {
        from: '/v1/profiles/search',
        to: '/v2/profiles/query',
        fromVersion: 1,
        toVersion: 2,
        type: 'renamed',
        description: 'Text search merged with advanced query endpoint',
        autoRedirect: true
    },
    {
        from: '/v1/profiles/batch/approve',
        to: '/v2/profiles/batch',
        fromVersion: 1,
        toVersion: 2,
        type: 'merged',
        description: 'Batch operations consolidated to single endpoint with action parameter',
        autoRedirect: false
    },
    {
        from: '/v1/analytics/metrics',
        to: '/v2/analytics/time-series',
        fromVersion: 1,
        toVersion: 2,
        type: 'renamed',
        description: 'Metrics endpoint renamed for clarity',
        autoRedirect: true
    },
    {
        from: '/v1/tracking/stream',
        to: '/v2/events/stream',
        fromVersion: 1,
        toVersion: 2,
        type: 'moved',
        description: 'Tracking stream moved to events namespace',
        autoRedirect: true
    }
];

// ============================================================================
// Response Transformers
// ============================================================================

export const RESPONSE_TRANSFORMERS: ResponseTransformer[] = [
    {
        version: 2,
        endpointPattern: '/v2/profiles/*',
        transform: (data: unknown) => {
            // Transform profile response to v2 format
            if (data && typeof data === 'object' && 'profile' in data) {
                const profile = (data as any).profile;
                return {
                    ...data,
                    profile: {
                        ...profile,
                        // Flatten nested structures
                        metrics: {
                            followers: profile.followers,
                            following: profile.following,
                            posts: profile.posts,
                            qualityScore: profile.qualityScore,
                            botProbability: profile.botProbability
                        },
                        meta: {
                            createdAt: profile.createdAt,
                            updatedAt: profile.updatedAt,
                            analyzedAt: profile.analyzedAt
                        }
                    }
                };
            }
            return data;
        }
    },
    {
        version: 2,
        endpointPattern: '/v2/campaigns/*',
        transform: (data: unknown) => {
            // Transform campaign response to v2 format
            if (data && typeof data === 'object' && 'campaign' in data) {
                const campaign = (data as any).campaign;
                return {
                    ...data,
                    campaign: {
                        ...campaign,
                        // Use standardized status values
                        status: campaign.status?.toUpperCase(),
                        // Add computed fields
                        progress: campaign.stats ?
                            Math.round((campaign.stats.engaged / campaign.stats.acquired) * 100) : 0
                    }
                };
            }
            return data;
        }
    }
];

// ============================================================================
// Version Negotiation
// ============================================================================

export function negotiateVersion(
    request: FastifyRequest,
    config: ApiVersionConfig
): VersionNegotiationResult {
    let version = config.defaultVersion;
    let source: 'path' | 'header' | 'query' | 'default' = 'default';

    // 1. Check path prefix (highest priority)
    const pathMatch = request.url.match(/^\/v(\d+)/);
    if (pathMatch) {
        version = parseInt(pathMatch[1], 10);
        source = 'path';
    }
    // 2. Check header
    else if (request.headers[config.versionHeader.toLowerCase()]) {
        const headerValue = request.headers[config.versionHeader.toLowerCase()] as string;
        const headerMatch = headerValue.match(/v?(\d+)/);
        if (headerMatch) {
            version = parseInt(headerMatch[1], 10);
            source = 'header';
        }
    }
    // 3. Check query parameter
    else if ((request.query as any)?.[config.versionQuery]) {
        const queryValue = (request.query as any)[config.versionQuery];
        const queryMatch = String(queryValue).match(/v?(\d+)/);
        if (queryMatch) {
            version = parseInt(queryMatch[1], 10);
            source = 'query';
        }
    }

    // Find version info
    const versionInfo = config.versions.find(v => v.version === version);
    const isDeprecated = versionInfo?.status === 'deprecated' || versionInfo?.status === 'sunset';

    return {
        version,
        prefix: `v${version}`,
        source,
        isDeprecated,
        sunsetDate: versionInfo?.sunsetDate
    };
}

// ============================================================================
// API Version Plugin
// ============================================================================

export const apiVersionPlugin: FastifyPluginAsync<Partial<ApiVersionConfig>> = async (
    app: FastifyInstance,
    options
) => {
    const config: ApiVersionConfig = {
        versions: options.versions || API_VERSIONS,
        defaultVersion: options.defaultVersion || 1,
        versionHeader: options.versionHeader || 'X-API-Version',
        versionQuery: options.versionQuery || 'api-version',
        enableMigrationWarnings: options.enableMigrationWarnings ?? true
    };

    // Decorate request with version info
    app.decorateRequest('apiVersion', null);

    // Version negotiation hook
    app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
        const negotiation = negotiateVersion(request, config);
        (request as any).apiVersion = negotiation;

        // Add version headers to response
        reply.header('X-API-Version', `v${negotiation.version}`);

        if (negotiation.isDeprecated) {
            reply.header('Deprecation', 'true');
            if (negotiation.sunsetDate) {
                reply.header('Sunset', negotiation.sunsetDate);
            }

            // Add migration info header
            if (config.enableMigrationWarnings) {
                const latestVersion = config.versions
                    .filter(v => v.status === 'current')
                    .sort((a, b) => b.version - a.version)[0];

                if (latestVersion && latestVersion.version > negotiation.version) {
                    reply.header('X-Upgrade-Available', `v${latestVersion.version}`);
                    reply.header('Link', `</v${latestVersion.version}>; rel="successor-version"`);
                }
            }
        }
    });

    // Version info endpoint
    app.get('/api/versions', async () => ({
        current: config.versions.find(v => v.status === 'current'),
        supported: config.versions.filter(v => v.status === 'supported'),
        deprecated: config.versions.filter(v => v.status === 'deprecated'),
        all: config.versions
    }));

    // Migration guide endpoint
    app.get('/api/migrations', async () => ({
        migrations: ENDPOINT_MIGRATIONS,
        transformers: RESPONSE_TRANSFORMERS.map(t => ({
            version: t.version,
            endpoint: t.endpointPattern
        }))
    }));
};

// ============================================================================
// Version-Specific Route Registration
// ============================================================================

export interface VersionedRouteOptions {
    /** Minimum version this route is available */
    minVersion?: number;
    /** Maximum version this route is available */
    maxVersion?: number;
    /** Versions where this route is deprecated */
    deprecatedIn?: number[];
    /** Route is experimental */
    experimental?: boolean;
}

export function createVersionedRoutes(
    app: FastifyInstance,
    versionOptions: VersionedRouteOptions = {}
): {
    forVersion: (version: number, registerFn: (app: FastifyInstance) => Promise<void>) => Promise<void>;
    withVersionCheck: (handler: (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>) => (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>;
} {
    return {
        /**
         * Register routes for a specific version
         */
        forVersion: async (version: number, registerFn: (app: FastifyInstance) => Promise<void>) => {
            await app.register(async (versionedApp) => {
                // Add version-specific hooks
                versionedApp.addHook('preHandler', async (request, reply) => {
                    const apiVersion = (request as any).apiVersion?.version || 1;

                    if (versionOptions.minVersion && apiVersion < versionOptions.minVersion) {
                        return reply.code(400).send({
                            error: 'VERSION_TOO_LOW',
                            message: `This endpoint requires API version ${versionOptions.minVersion} or higher`
                        });
                    }

                    if (versionOptions.maxVersion && apiVersion > versionOptions.maxVersion) {
                        return reply.code(400).send({
                            error: 'VERSION_TOO_HIGH',
                            message: `This endpoint is not available in API version ${apiVersion}`
                        });
                    }

                    if (versionOptions.deprecatedIn?.includes(apiVersion)) {
                        reply.header('Deprecation', 'true');
                    }

                    if (versionOptions.experimental) {
                        reply.header('X-Experimental', 'true');
                    }
                });

                await registerFn(versionedApp);
            }, { prefix: `/v${version}` });
        },

        /**
         * Wrap a handler with version checking
         */
        withVersionCheck: (handler) => async (request, reply) => {
            const apiVersion = (request as any).apiVersion?.version || 1;

            if (versionOptions.minVersion && apiVersion < versionOptions.minVersion) {
                return reply.code(400).send({
                    error: 'VERSION_NOT_SUPPORTED',
                    message: `This feature requires API version ${versionOptions.minVersion}+`
                });
            }

            return handler(request, reply);
        }
    };
}

// ============================================================================
// V2 Preview Routes (Experimental)
// ============================================================================

export async function v2PreviewRoutes(app: FastifyInstance): Promise<void> {
    // v2 version info
    app.get('/', async () => ({
        version: 2,
        status: 'preview',
        releaseDate: '2025-03-01',
        breakingChanges: API_VERSIONS.find(v => v.version === 2)?.breakingChanges || [],
        newFeatures: API_VERSIONS.find(v => v.version === 2)?.newFeatures || [],
        message: 'This is a preview of API v2. Do not use in production.'
    }));

    // v2 Profiles with new flat structure
    app.get('/profiles/:id', async (request, reply) => {
        const { id } = request.params as { id: string };

        // Return v2 format (flat structure)
        return {
            id,
            platform: 'twitter',
            username: 'example_user',
            displayName: 'Example User',
            bio: 'This is a preview of the v2 profile format',
            status: 'PENDING', // Uppercase in v2
            metrics: {
                followers: 1500,
                following: 200,
                posts: 500,
                qualityScore: 85,
                botProbability: 12
            },
            interests: ['tech', 'ai', 'automation'],
            meta: {
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                analyzedAt: null
            },
            _links: {
                self: `/v2/profiles/${id}`,
                campaign: `/v2/campaigns/{campaignId}`,
                approve: `/v2/profiles/${id}/actions/approve`,
                reject: `/v2/profiles/${id}/actions/reject`
            }
        };
    });

    // v2 Cursor-based pagination
    app.get('/profiles', async (request) => {
        const { cursor, limit = '20' } = request.query as { cursor?: string; limit?: string };

        return {
            data: [], // Would be filled with actual profiles
            pagination: {
                cursor: cursor || null,
                nextCursor: 'eyJpZCI6Im5leHRfaWQifQ==',
                prevCursor: cursor ? 'eyJpZCI6InByZXZfaWQifQ==' : null,
                limit: parseInt(limit, 10),
                hasMore: true
            },
            _meta: {
                apiVersion: 2,
                experimental: true
            }
        };
    });

    // v2 Error format (RFC 7807)
    app.get('/error-example', async (request, reply) => {
        return reply.code(400).send({
            type: 'https://api.bombardier.app/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: 'The request body contains invalid data',
            instance: `/v2/error-example`,
            errors: [
                { field: 'email', message: 'Invalid email format' }
            ]
        });
    });
}

// ============================================================================
// Export Utilities
// ============================================================================

export const versionConfig: ApiVersionConfig = {
    versions: API_VERSIONS,
    defaultVersion: 1,
    versionHeader: 'X-API-Version',
    versionQuery: 'api-version',
    enableMigrationWarnings: true
};

export function getLatestVersion(): ApiVersion | undefined {
    return API_VERSIONS
        .filter(v => v.status === 'current')
        .sort((a, b) => b.version - a.version)[0];
}

export function getVersionInfo(version: number): ApiVersion | undefined {
    return API_VERSIONS.find(v => v.version === version);
}

export function isVersionSupported(version: number): boolean {
    const info = getVersionInfo(version);
    return info !== undefined && info.status !== 'sunset';
}
