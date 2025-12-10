# Bombardier System Architecture - Complete Analysis

> **Version:** 2.1.0
> **Last Updated:** December 10, 2024
> **Status:** Production-Ready
> **Security Audit:** ✅ 0 Vulnerabilities

---

## 1. System Overview

Bombardier is a distributed target acquisition and engagement platform consisting of:

| Component | Technology | Port | Purpose |
|-----------|------------|------|---------|
| **API Gateway** | Fastify (Node.js) | 4050 | User-facing REST API |
| **ML Service** | FastAPI (Python) | 5000 | AI/NLP analysis |
| **Browser Service** | Fastify + Playwright | 5100 | Web scraping & automation |
| **Workers** | Node.js | — | Background job processing |
| **Mission Control** | Node.js | — | Workflow orchestration |
| **Cloak Services** | Node.js | — | Anti-detection suite |

---

## 2. API Gateway (Port 4050)

### 2.1 Endpoint Inventory

| Category | Endpoints | Auth | Key Features |
|----------|-----------|------|--------------|
| **Auth** | 7 | Mixed | JWT sessions, OAuth, key rotation |
| **Campaigns** | 10 | ✅ RBAC | Full CRUD + state machine |
| **Profiles** | 13 | ✅ RBAC | Batch operations, search, **advanced boolean queries** |
| **Messages** | 3 | ✅ RBAC | Status tracking |
| **Analytics** | 6 | ✅ RBAC + API Key | Real-time + aggregation |
| **Cloak** | 11 | ✅ RBAC | Proxy/VPN/fingerprint control |
| **Webhooks** | 8 | ✅ RBAC | **External notifications, HMAC-signed** |
| **Tracking** | 2 | ✅ RBAC | SSE + WebSocket streams |
| **Health** | 4 | Mixed | Kubernetes probes |
| **Metrics** | 1 | ✅ Token | Prometheus export |
| **Pipeline** | 1 | ✅ RBAC | Quick campaign launch |
| **OAuth** | 2 | ❌ | Social login (suspended) |
| **Total** | **72** | — | **API Version: /v1** |

### 2.2 Security Model

```text
Request Flow:
┌─────────────────────────────────────────────────────────────┐
│  Client → Rate Limiter → JWT Plugin → RBAC Plugin → Route  │
└─────────────────────────────────────────────────────────────┘

Authentication Modes:
┌────────────┬────────────────────────────────────────────────┐
│ Mode       │ Behavior                                       │
├────────────┼────────────────────────────────────────────────┤
│ Production │ Real JWT verification (HS256)                  │
│ Development│ Mock admin user injection (AUTH_DISABLED=true) │
│ Internal   │ API Key (X-Api-Key header) for workers         │
└────────────┴────────────────────────────────────────────────┘

API Versioning:
┌────────────────────────────────────────────────────────────┐
│ Current: /v1 (all routes prefixed)                          │
│ Legacy routes include Deprecation + Sunset headers          │
│ Sunset date: 2025-06-01                                     │
└────────────────────────────────────────────────────────────┘
```

---

## 3. ML Service (Port 5000)

### 3.1 Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Service health |
| POST | `/analyze/profile` | Full profile analysis |
| POST | `/detect/bot` | Bot probability scoring |
| POST | `/analyze/sentiment` | Text sentiment (-1 to +1) |
| POST | `/extract/interests` | Topic/interest extraction |
| POST | `/generate/message-context` | Personalization hints |

### 3.2 Analyzers

- **BotDetector**: Heuristic rules + metadata analysis
- **SentimentAnalyzer**: VADER-based sentiment scoring
- **InterestExtractor**: Keyword + NER extraction
- **ProfileScorer**: Composite quality scoring

---

## 4. Browser Service (Port 5100)

### 4.1 Endpoints

| Category | Endpoints | Purpose |
|----------|-----------|---------|
| **Scraping** | 4 | Profile, posts, search, batch |
| **Messaging** | 2 | Send DM, check responses |
| **Sessions** | 3 | Create, check, close |

### 4.2 Supported Platforms

- Twitter/X
- LinkedIn
- Reddit
- Instagram

### 4.3 Anti-Detection Features

- Playwright stealth plugins
- Fingerprint randomization
- Proxy injection per session
- Session persistence (Redis)

---

## 5. Worker Pipeline

### 5.1 Queue Architecture

```text
┌───────────────────────────────────────────────────────────────────┐
│                       Redis Queues                                 │
├─────────────────┬─────────────────┬─────────────────┬─────────────┤
│ queue:acquisition│ queue:filtering │ queue:research  │ queue:engage│
│        ↓         │        ↓        │        ↓        │      ↓      │
│  ┌───────────┐   │  ┌───────────┐  │  ┌───────────┐  │  ┌────────┐ │
│  │ Acquisition│   │  │ Filtering │  │  │ Research  │  │  │Engage  │ │
│  │  Worker   │   │  │  Worker   │  │  │  Worker   │  │  │Worker  │ │
│  └───────────┘   │  └───────────┘  │  └───────────┘  │  └────────┘ │
│        ↓         │        ↓        │        ↓        │      ↓      │
│   [Profiles]     │  [Filtered]     │ [Researched]    │ [Engaged]   │
└─────────────────┴─────────────────┴─────────────────┴─────────────┘
                              ↓
                    queue:tracking → Tracking Worker
                              ↓
                    Webhook Dispatcher → External Notifications
```

### 5.2 Worker Responsibilities

| Worker | Input | Process | Output |
|--------|-------|---------|--------|
| **Acquisition** | Campaign criteria | Scrape platforms for targets | Raw profiles |
| **Filtering** | Raw profiles | Bot detection, quality scoring | Approved profiles |
| **Research** | Approved profiles | Deep analysis, interest extraction | Enriched profiles |
| **Engagement** | Enriched profiles | Generate & send messages | Sent messages |
| **Tracking** | Sent messages | Monitor responses, update status | Analytics events |

---

## 6. Mission Control

### 6.1 Bombing Methods

| Method | Flow | Use Case |
|--------|------|----------|
| **DR** | Acquisition → Filtering → Research → Engagement → Tracking | Full lifecycle |
| **IVM** | Acquisition → Research → Filtering → (Optional Engagement) | Lead qualification |

### 6.2 Trigger

```json
// Push to Redis: queue:mission-control:start
{
  "campaignId": "camp_123",
  "method": "DR",
  "targetCriteria": { "interests": ["tech"] },
  "cloakConfig": { "location": "US" }
}
```

---

## 7. Cloak Anti-Detection Suite

### 7.1 Services

| Service | Location | Function |
|---------|----------|----------|
| **Proxy Manager** | `cloak/proxy-manager/` | Rotation, health monitoring |
| **Fingerprint Engine** | `cloak/fingerprint/` | Canvas, WebGL, audio fingerprints |
| **Cloak Core** | `cloak/core/` | Unified session + leak prevention |
| **VPN Manager** | `cloak/vpn/` | OpenVPN/Tor integration |
| **Location Spoofer** | `cloak/location/` | Timezone, locale, geolocation |

### 7.2 API Endpoints (via /cloak/*)

- Status monitoring
- Fingerprint generation
- Proxy acquisition
- VPN connect/disconnect
- Location spoofing
- Leak testing

---

## 8. Configuration Files

| File | Purpose |
|------|---------|
| `config/rbac/permissions.json` | Role-permission mappings |
| `config/oauth/providers.json` | OAuth provider configs |
| `config/proxies.json` | Proxy server list |
| `.env` / `.env.example` | Environment variables |

---

## 9. Data Flow Summary

```text
User Request
     │
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         API GATEWAY (4050)                          │
│  /v1/* → Auth → RBAC → Validation → Handler → Response             │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌───────────────┐       ┌───────────────┐       ┌───────────────┐
│  MongoDB      │       │    Redis      │       │  Workers      │
│  (Persist)    │       │ (Cache/Queue) │       │  (Process)    │
└───────────────┘       └───────────────┘       └───────┬───────┘
                                                        │
                        ┌───────────────────────────────┤
                        ▼                               ▼
                ┌───────────────┐               ┌───────────────┐
                │  ML Service   │               │Browser Service│
                │    (5000)     │               │    (5100)     │
                └───────────────┘               └───────────────┘
                                                        │
                                                        ▼
                                               ┌───────────────────┐
                                               │ Webhook Dispatcher │
                                               │ (External Notify)  │
                                               └───────────────────┘
```

---

## 10. Gap Analysis & Recommendations

### 10.1 Addressed This Session

| Feature | Status | Details |
|---------|--------|----------|
| JWT authentication | ✅ Complete | Environment-controlled toggle |
| Cloak endpoint protection | ✅ Complete | RBAC permissions required |
| Metrics endpoint security | ✅ Complete | Token/API key required |
| Health check hierarchy | ✅ Complete | Basic + detailed + K8s probes |
| Rate limiting | ✅ Complete | 100 req/min per user/IP |
| Audit logging | ✅ Complete | Sensitive operations logged |
| Webhook system | ✅ Complete | 16 events, HMAC-signed |
| API versioning | ✅ Complete | /v1 prefix, deprecation headers |
| Advanced profile filtering | ✅ Complete | Boolean query language |
| Security vulnerabilities | ✅ Resolved | 0 vulnerabilities (Dec 10, 2024) |

### 10.2 Future Considerations

| Feature | Priority | Notes |
|---------|----------|-------|
| OAuth re-enablement | Medium | Requires credentials configuration |
| WebSocket notifications | Medium | Real-time UI updates |
| API v2 planning | Low | When breaking changes needed |
| Per-endpoint rate limits | Low | Customization for specific routes |

---

## 11. New Features Summary (December 2024)

### 11.1 Webhook System

| Feature | Description |
|---------|-------------|
| **Events** | 16 event types (campaign, profile, message, system) |
| **Security** | HMAC-SHA256 payload signing |
| **Reliability** | Exponential backoff retry (up to 4 attempts) |
| **Management** | Full CRUD + test + secret regeneration |
| **Endpoints** | 8 REST endpoints at `/v1/webhooks` |

### 11.2 API Versioning

| Feature | Description |
|---------|-------------|
| **Current** | `/v1` prefix on all routes |
| **Backward Compatible** | Legacy routes still work |
| **Deprecation Headers** | Sunset date: 2025-06-01 |
| **Documentation** | Root endpoint returns version info |

### 11.3 Advanced Profile Filtering

| Feature | Description |
|---------|-------------|
| **Boolean Queries** | AND, OR, NOT, grouping |
| **Operators** | >, >=, <, <=, wildcards |
| **Structured Filters** | Status, platform, ranges, dates |
| **Field Mapping** | Aliases (e.g., `bot` → `botProbability`) |
| **Endpoints** | 3 new endpoints at `/v1/profiles` |

---

## 12. Test Coverage

### 12.1 Test Suites

| Suite | Tests | Status |
|-------|-------|--------|
| `tests/api/webhooks.test.ts` | 16 | ✅ Passing |
| `tests/api/versioning.test.ts` | 14 | ✅ Passing |
| `tests/api/advanced-filter.test.ts` | 24 | ✅ Passing |
| `tests/unit/bot-detection.test.ts` | 8 | ✅ Passing |
| `tests/backend/api/health.test.ts` | 1 | ✅ Passing |
| `tests/backend/api/dto.test.ts` | 2 | ✅ Passing |
| `tests/contracts/api.pact.test.ts` | 1 | ✅ Passing |
| `tests/integration/worker-flow.test.ts` | 2 | ✅ Passing |
| **Total Unit/Contract Tests** | **68+** | ✅ All Passing |

### 12.2 Integration Tests

Integration tests require running API server at `localhost:4050`:

```bash
# Start server first
docker-compose up -d api

# Run integration tests
npm run test:integration
```

---

## 13. Dependencies & Security

### 13.1 Core Dependencies

| Package | Version | Purpose |
|---------|---------|----------|
| fastify | ^4.27.0 | HTTP framework |
| mongoose | ^8.6.2 | MongoDB ODM |
| zod | ^3.23.8 | Schema validation |
| argon2 | ^0.30.3 | Password hashing |
| jose | ^5.2.2 | JWT handling |

### 13.2 Security Audit

| Area | Status | Date |
|------|--------|------|
| Root dependencies | 0 vulnerabilities | Dec 10, 2024 |
| Backend API dependencies | 0 vulnerabilities | Dec 10, 2024 |
| Vitest | Updated to v4.0.15 | Dec 10, 2024 |
| Pact | Updated to v16.0.2 | Dec 10, 2024 |

---

## 14. Quick Reference

### 14.1 API Base URLs

```text
Production:  https://api.bombardier.app/v1
Development: http://localhost:4050/v1
Health:      http://localhost:4050/health
Metrics:     http://localhost:4050/metrics
```

### 14.2 Key Environment Variables

```bash
AUTH_DISABLED=false           # Enable production auth
JWT_SECRET=<64-char-secret>   # Required for production
INTERNAL_API_KEY=<api-key>    # For worker authentication
PROMETHEUS_TOKEN=<token>      # For metrics access
```

### 14.3 RBAC Roles

| Role | Permissions |
|------|-------------|
| `admin` | All permissions (`*`) |
| `operator` | profiles.*, campaigns.*, messages.*, analytics.read, cloak.*, webhooks.* |
| `viewer` | *.read only |
