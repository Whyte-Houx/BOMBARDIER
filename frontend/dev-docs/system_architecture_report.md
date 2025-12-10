# Bombardier System Architecture - Complete Analysis

> **Version:** 2.0.0
> **Last Updated:** December 10, 2024
> **Status:** Production-Ready

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
| **Profiles** | 10 | ✅ RBAC | Batch operations, search |
| **Messages** | 3 | ✅ RBAC | Status tracking |
| **Analytics** | 6 | ✅ RBAC + API Key | Real-time + aggregation |
| **Cloak** | 11 | ✅ RBAC | Proxy/VPN/fingerprint control |
| **Tracking** | 2 | ✅ RBAC | SSE + WebSocket streams |
| **Health** | 4 | Mixed | Kubernetes probes |
| **Metrics** | 1 | ✅ Token | Prometheus export |
| **Pipeline** | 1 | ✅ RBAC | Quick campaign launch |
| **OAuth** | 2 | ❌ | Social login (suspended) |
| **Total** | **59** | — | — |

### 2.2 Security Model

```
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

```
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

```
User Request
     │
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         API GATEWAY (4050)                          │
│  Auth → RBAC → Validation → Handler → Response                     │
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
```

---

## 10. Gap Analysis & Recommendations

### Addressed This Session

- ✅ JWT authentication with env toggle
- ✅ Cloak endpoint protection
- ✅ Metrics endpoint security
- ✅ Health check hierarchy
- ✅ Rate limiting
- ✅ Audit logging

### Future Considerations

- ⏳ OAuth re-enablement (credentials needed)
- ⏳ Webhook system for external notifications
- ⏳ API versioning (/v1/ prefix)
- ⏳ Advanced profile filtering (boolean queries)
