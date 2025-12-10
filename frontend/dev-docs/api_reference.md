# Bombardier Backend API Reference

> **Base URL:** `http://localhost:4050`  
> **Total Endpoints:** 57  
> **Authentication:** JWT Bearer Token or Internal API Key  
> **Last Updated:** December 10, 2024

---

## 🔐 Authentication & Authorization

### Authentication Modes

The API supports two authentication modes controlled by environment variables:

| Mode | `AUTH_DISABLED` | Description |
|------|-----------------|-------------|
| **Production** | `false` | Real JWT verification required |
| **Development** | `true` | Mock admin user injected for testing |

### JWT Authentication

Protected endpoints require: `Authorization: Bearer <token>`

### Internal API Key (Workers)

Internal services (workers) can authenticate using: `X-Api-Key: <internal_key>`

Set via `INTERNAL_API_KEY` environment variable.

### RBAC Roles & Permissions

| Role | Permissions |
|------|-------------|
| **admin** | `*` (all permissions) |
| **operator** | `profiles.*`, `campaigns.*`, `messages.*`, `analytics.read`, `cloak.*` |
| **viewer** | `*.read` only |

---

## 📚 API Endpoints

### Auth (`/auth`)

| Method | Endpoint | Auth | Permission | Description |
|--------|----------|------|------------|-------------|
| POST | `/register` | ❌ | — | Create user account |
| POST | `/login` | ❌ | — | Login, returns JWT |
| POST | `/refresh` | ✅ | — | Refresh access token |
| POST | `/logout` | ✅ | — | Invalidate session |
| POST | `/revoke` | ✅ | — | Revoke specific session |
| GET | `/me` | ✅ | — | Get current user |
| POST | `/keys/rotate` | ✅ | `system.write` | Rotate JWT signing keys |

**Input/Output:**

- `POST /register`: `{ email, password (≥12 chars), username }` → `{ id, email, username }`
- `POST /login`: `{ email, password }` → `{ token, user: { id, role } }` + `Set-Cookie: refresh_token`

---

### OAuth (`/oauth`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/:provider/start` | ❌ | Initiate OAuth flow (PKCE) |
| GET | `/:provider/callback` | ❌ | OAuth callback, exchanges code for token |

**Supported Providers:** Configured via `config/oauth/providers.json`

---

### Campaigns (`/campaigns`)

| Method | Endpoint | Auth | Permission | Description |
|--------|----------|------|------------|-------------|
| GET | `/` | ✅ | `campaigns.read` | List campaigns (filtered by user) |
| POST | `/` | ✅ | `campaigns.write` | Create campaign |
| GET | `/:id` | ✅ | `campaigns.read` | Get campaign by ID |
| GET | `/:id/status` | ✅ | `campaigns.read` | Get profile/message counts (cached 10s) |
| PATCH | `/:id` | ✅ | `campaigns.write` | Update campaign |
| POST | `/:id/start` | ✅ | `campaigns.write` | Start campaign → enqueues acquisition |
| POST | `/:id/pause` | ✅ | `campaigns.write` | Pause active campaign |
| POST | `/:id/complete` | ✅ | `campaigns.write` | Mark campaign complete |
| DELETE | `/:id` | ✅ | `campaigns.write` | Delete campaign |
| GET | `/:id/analytics` | ✅ | `analytics.read` | Get campaign analytics |

**Validation:** Uses `CampaignStartSchema` / `CampaignUpdateSchema` (Zod)

---

### Profiles (`/profiles`)

| Method | Endpoint | Auth | Permission | Description |
|--------|----------|------|------------|-------------|
| GET | `/` | ✅ | `profiles.read` | List profiles by status |
| GET | `/:id` | ✅ | `profiles.read` | Get profile by ID |
| GET | `/search` | ✅ | `profiles.read` | Text search (≥2 chars) |
| GET | `/count` | ✅ | `profiles.read` | Count by status |
| POST | `/` | ✅ | `profiles.write` | Create/upsert profile |
| POST | `/:id/approve` | ✅ | `profiles.write` | Approve single profile |
| POST | `/:id/reject` | ✅ | `profiles.write` | Reject single profile |
| POST | `/batch/approve` | ✅ | `profiles.write` | Batch approve (max 100) |
| POST | `/batch/reject` | ✅ | `profiles.write` | Batch reject (max 100) |
| POST | `/find-by-interests` | ✅ | `profiles.read` | Find by interests array |

---

### Messages (`/messages`)

| Method | Endpoint | Auth | Permission | Description |
|--------|----------|------|------------|-------------|
| GET | `/` | ✅ | `messages.read` | List by campaignId (required) |
| POST | `/` | ✅ | `messages.write` | Create message |
| POST | `/:id/status` | ✅ | `messages.write` | Update message status |

---

### Analytics (`/analytics`)

| Method | Endpoint | Auth | Permission | Description |
|--------|----------|------|------------|-------------|
| GET | `/metrics` | ✅ | `analytics.read` | Get time-bucketed metrics |
| GET | `/summary/:campaignId` | ✅ | `analytics.read` | Campaign summary (30 days) |
| POST | `/event` | ✅ | Internal API Key | Record event (internal/workers) |
| POST | `/metric` | ✅ | Internal API Key | Record metric (internal/workers) |
| GET | `/realtime` | ✅ | `analytics.read` | Last hour stats |
| GET | `/health` | ✅ | `analytics.read` | Pipeline health status |

> ✅ **SECURED:** `/event` and `/metric` require internal API key (`X-Api-Key` header) or admin role.

---

### Tracking (`/tracking`)

| Method | Endpoint | Auth | Permission | Description |
|--------|----------|------|------------|-------------|
| GET | `/stream` | ✅ | `analytics.read` | SSE event stream |
| GET | `/ws` | ✅ | `analytics.read` | WebSocket connection |

---

### Pipeline (`/pipeline`)

| Method | Endpoint | Auth | Permission | Description |
|--------|----------|------|------------|-------------|
| POST | `/run` | ✅ | `campaigns.write` | Create & start campaign immediately |

---

### Cloak (`/cloak`) — Anti-Detection System

| Method | Endpoint | Auth | Permission | Description |
|--------|----------|------|------------|-------------|
| GET | `/status` | ✅ | `cloak.read` | Full cloak system status |
| GET | `/health` | ✅ | `cloak.read` | Cloak health check |
| POST | `/fingerprint/generate` | ✅ | `cloak.write` | Generate browser fingerprint |
| POST | `/proxy/acquire` | ✅ | `cloak.write` | Acquire a proxy |
| POST | `/vpn/connect` | ✅ | `cloak.write` | Connect to VPN |
| POST | `/vpn/disconnect` | ✅ | `cloak.write` | Disconnect VPN |
| GET | `/vpn/status` | ✅ | `cloak.read` | VPN connection status |
| POST | `/location/set` | ✅ | `cloak.write` | Set spoofed location |
| GET | `/location/available` | ✅ | `cloak.read` | List available countries |
| POST | `/leak-test` | ✅ | `cloak.write` | Run IP/DNS/WebRTC leak tests |
| POST | `/account/register` | ✅ | `cloak.write` | Register account for warming |

> ✅ **SECURED:** All cloak endpoints require `cloak.read` or `cloak.write` permissions.

---

### Health & Metrics

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health/` | ❌ | Basic health check → `{ status, timestamp, service, version }` |
| GET | `/health/detailed` | ❌ | Detailed health with MongoDB & Redis status |
| GET | `/metrics/` | ✅ | Prometheus-format metrics |

**Health Endpoints (Public):**

- `/health/` - For load balancers and Kubernetes probes
- `/health/detailed` - Returns dependency connectivity and latency

**Metrics Authentication Options:**

- `Authorization: Bearer <jwt>` with `system.read` permission
- `X-Prometheus-Token: <token>` for Prometheus scraping
- `X-Api-Key: <key>` for internal monitoring services

> ✅ **SECURED:** `/metrics` now requires authentication to protect internal system data.

---

## 📦 Data Schemas (Zod DTOs)

### CampaignStartSchema

```typescript
{
  name: string (1-200 chars),
  description?: string,
  targetCriteria: {
    platforms: string[] (min 1),
    ageRange?: { min?, max? },
    locations?: string[],
    interests?: string[],
    keywords?: string[],
    followersRange?: { min?, max? }
  },
  settings?: {
    maxProfilesPerDay?: number (1-1000),
    messageDelay?: number (seconds),
    retryAttempts?: number (0-10)
  }
}
```

### ProfileCreateSchema

```typescript
{
  platform: string,
  username: string,
  displayName?: string,
  profileUrl?: URL,
  bio?: string,
  interests?: string[],
  riskScore?: number (0-100),
  status?: "pending" | "approved" | "rejected" | "engaged"
}
```

---

## 🗄️ Repositories

| Repository | Model | Key Operations |
|------------|-------|----------------|
| `ProfileRepo` | Profile | upsert, findByStatus, batchApprove/Reject, searchByText |
| `CampaignRepo` | Campaign | create, list, update, setStatus, updateStats |
| `MessageRepo` | Message | create, listByCampaign, setStatus, markDelivered/Failed |
| `UserRepo` | User | findByEmail, create, linkOAuth, setRole |
| `SessionRepo` | Session | create, findBySessionId, expire, cleanup |
| `AnalyticsRepo` | Analytics | recordEvent, recordMetric, getMetrics, aggregate |

---

## ✅ Security Improvements (December 2024)

### Fixed Issues

| Issue | Status | Solution |
|-------|--------|----------|
| Mock JWT in dev | ✅ Fixed | Environment-controlled (`AUTH_DISABLED`), disabled in production |
| No auth on `/analytics/event` | ✅ Fixed | Requires internal API key or admin role |
| No auth on `/metrics` | ✅ Fixed | Requires `system.read`, Prometheus token, or API key |
| No auth on Cloak endpoints | ✅ Fixed | Added `cloak.read`/`cloak.write` permissions |
| Cloak routes not registered | ✅ Fixed | Added to server.ts |
| Rate limiting missing | ✅ Fixed | Added `@fastify/rate-limit` plugin |
| Audit logging missing | ✅ Fixed | Added audit logging hook for sensitive operations |
| Basic health check only | ✅ Fixed | Added `/health/detailed` with dependency checks |

### Implemented Features

| Feature | Status | Details |
|---------|--------|---------|
| Rate limiting | ✅ | 100 req/min per user/IP |
| Input validation | ✅ | Zod schemas on all routes |
| Audit logging | ✅ | Sensitive operations logged |
| Internal API key | ✅ | For worker authentication |
| Prometheus auth | ✅ | Token-based metrics access |
| Health checks | ✅ | Basic + detailed with dependencies |

---

## 📊 Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| `UNAUTHENTICATED` | 401 | Missing or invalid authorization |
| `INVALID_TOKEN` | 401 | JWT verification failed |
| `FORBIDDEN` | 403 | Missing RBAC permission |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `WEAK_OR_MISSING_FIELDS` | 400 | Registration validation failed |
| `USER_EXISTS` | 409 | Email/username already taken |
| `INVALID_CREDENTIALS` | 401 | Wrong email/password |
| `LOCKED` | 429 | Account locked (10+ failed attempts) |
| `CAMPAIGN_NOT_FOUND` | 404 | Campaign ID doesn't exist |
| `PROFILE_NOT_FOUND` | 404 | Profile ID doesn't exist |
| `VALIDATION_ERROR` | 400 | Zod schema validation failed |
| `MISSING_TYPE` | 400 | Analytics event type required |
| `INVALID_METRICS` | 400 | Metrics object malformed |

---

## 🔧 Environment Variables

```bash
# ============================================
# Authentication
# ============================================
AUTH_DISABLED=true              # Set to false in production!
JWT_SECRET=<secret>             # Required in production (openssl rand -base64 32)
INTERNAL_API_KEY=<key>          # For worker authentication (openssl rand -hex 32)

# ============================================
# Rate Limiting
# ============================================
RATE_LIMIT_MAX=100              # Requests per window
RATE_LIMIT_WINDOW_MS=60000      # Window duration (1 minute)

# ============================================
# Monitoring
# ============================================
PROMETHEUS_TOKEN=<token>        # For /metrics endpoint access (openssl rand -hex 32)
```

---

## 🚀 Quick Reference

### Common Headers

```http
# JWT Authentication
Authorization: Bearer <token>

# Internal API Key (workers)
X-Api-Key: <internal_key>

# Prometheus Metrics
X-Prometheus-Token: <token>
```

### Response Format

All endpoints return consistent JSON:

```json
{
  "success": true,
  "data": { ... }
}
```

Or on error:

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human-readable description"
}
```
