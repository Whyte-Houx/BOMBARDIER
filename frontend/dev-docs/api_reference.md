# Bombardier Backend API Reference

> [!CAUTION]
> ## ⚠️ AUTHENTICATION SUSPENDED
> **Status:** All login/registration functionality is DISABLED  
> **Date:** December 2024  
> 
> The application currently operates **WITHOUT authentication**. A mock admin user is injected for all requests via `plugins/jwt.ts`. This means:
> - No login required
> - All users have admin privileges
> - Auth endpoints (`/auth/*`, `/oauth/*`) are non-functional
> 
> **To re-enable:** See comments in `backend/api/src/plugins/jwt.ts`

> **Base URL:** `http://localhost:4050`  
> **Total Endpoints:** 55  
> **Authentication:** ~~JWT Bearer Token~~ **SUSPENDED**  

---

## 🔐 Authentication & Authorization

### JWT Authentication
All protected endpoints require: `Authorization: Bearer <token>`

### RBAC Roles & Permissions

| Role | Permissions |
|------|-------------|
| **admin** | `*` (all permissions) |
| **operator** | `profiles.*`, `campaigns.*`, `messages.*`, `analytics.read` |
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
| POST | `/event` | ❌ | — | Record event (internal/workers) |
| POST | `/metric` | ❌ | — | Record metric (internal/workers) |
| GET | `/realtime` | ✅ | `analytics.read` | Last hour stats |
| GET | `/health` | ✅ | `analytics.read` | Pipeline health status |

> ⚠️ **Security Concern:** `/event` and `/metric` have **no auth check** — intended for internal workers but exposed publicly.

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

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/status` | ❌ | Full cloak system status |
| GET | `/health` | ❌ | Cloak health check |
| POST | `/fingerprint/generate` | ❌ | Generate browser fingerprint |
| POST | `/proxy/acquire` | ❌ | Acquire a proxy |
| POST | `/vpn/connect` | ❌ | Connect to VPN |
| POST | `/vpn/disconnect` | ❌ | Disconnect VPN |
| GET | `/vpn/status` | ❌ | VPN connection status |
| POST | `/location/set` | ❌ | Set spoofed location |
| GET | `/location/available` | ❌ | List available countries |
| POST | `/leak-test` | ❌ | Run IP/DNS/WebRTC leak tests |
| POST | `/account/register` | ❌ | Register account for warming |

> ⚠️ **Security Concern:** All cloak endpoints have **no authentication** — should be internal only.

---

### Health & Metrics

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health/` | ❌ | Basic health check → `{ status: "ok" }` |
| GET | `/metrics/` | ❌ | Prometheus-format metrics |

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

## 🚨 Flagged Issues

### Critical Security Concerns

| Issue | Location | Severity | Recommendation |
|-------|----------|----------|----------------|
| Mock JWT in dev | `plugins/jwt.ts` | 🔴 Critical | Auto-injects admin user; ensure disabled in production |
| No auth on `/analytics/event` | `routes/analytics.ts:55` | 🟠 High | Add internal API key or network-level protection |
| No auth on Cloak endpoints | `routes/cloak.ts` | 🟠 High | Add RBAC or restrict to internal network |
| `as any` overuse | All routes | 🟡 Medium | Replace with proper Zod parsing + types |

### Missing Features

| Feature | Expected | Actual |
|---------|----------|--------|
| Rate limiting | Per-user rate limits | ❌ Not implemented |
| Input validation | All endpoints | ⚠️ Partial (some routes skip Zod) |
| Audit logging | Security events | ❌ Not implemented |
| API versioning | `/v1/` prefix | ❌ Not implemented |

---

## 📊 Error Codes

| Code | Meaning |
|------|---------|
| `WEAK_OR_MISSING_FIELDS` | Registration validation failed |
| `USER_EXISTS` | Email/username already taken |
| `INVALID_CREDENTIALS` | Wrong email/password |
| `LOCKED` | Account locked (10+ failed attempts) |
| `FORBIDDEN` | Missing RBAC permission |
| `CAMPAIGN_NOT_FOUND` | Campaign ID doesn't exist |
| `PROFILE_NOT_FOUND` | Profile ID doesn't exist |
| `VALIDATION_ERROR` | Zod schema validation failed |
