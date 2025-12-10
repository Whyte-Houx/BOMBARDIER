# Event Flow Documentation

> **Purpose:** Complete mapping of user actions to backend API calls
> **Version:** 1.0.0

---

## 1. Authentication Flows

### 1.1 Login Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                           LOGIN FLOW                                 │
└─────────────────────────────────────────────────────────────────────┘

User                    Frontend                    Backend (4050)
 │                          │                          │
 │ Navigates to /login      │                          │
 │ ─────────────────────────>                          │
 │                          │                          │
 │ Enters email/password    │                          │
 │                          │                          │
 │ Clicks [Login]           │                          │
 │ ─────────────────────────>                          │
 │                          │                          │
 │                          │ POST /auth/login         │
 │                          │ { email, password }      │
 │                          │ ─────────────────────────>
 │                          │                          │
 │                          │                    ┌─────┴─────┐
 │                          │                    │ Validate  │
 │                          │                    │ Argon2    │
 │                          │                    │ Check     │
 │                          │                    └─────┬─────┘
 │                          │                          │
 │                          │ 200 OK                   │
 │                          │ { token, user }          │
 │                          │ Set-Cookie: refresh_token│
 │                          │ <─────────────────────────
 │                          │                          │
 │              ┌───────────┴───────────┐              │
 │              │ Store token (memory)  │              │
 │              │ Store refresh (cookie)│              │
 │              │ Update AuthStore      │              │
 │              └───────────┬───────────┘              │
 │                          │                          │
 │ Redirect to main app     │                          │
 │ <─────────────────────────                          │
 │                          │                          │
 │                          │ Connect WebSocket        │
 │                          │ ─────────────────────────>
```

### 1.2 Token Refresh Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        TOKEN REFRESH FLOW                            │
└─────────────────────────────────────────────────────────────────────┘

Frontend                    API Interceptor              Backend
 │                          │                          │
 │ API request              │                          │
 │ ─────────────────────────>                          │
 │                          │                          │
 │                          │ Request with token       │
 │                          │ ─────────────────────────>
 │                          │                          │
 │                          │ 401 Token Expired        │
 │                          │ <─────────────────────────
 │                          │                          │
 │               ┌──────────┴──────────┐               │
 │               │ Intercept 401       │               │
 │               │ Check if refreshable│               │
 │               └──────────┬──────────┘               │
 │                          │                          │
 │                          │ POST /auth/refresh       │
 │                          │ Cookie: refresh_token    │
 │                          │ ─────────────────────────>
 │                          │                          │
 │                          │ 200 { newToken }         │
 │                          │ <─────────────────────────
 │                          │                          │
 │               ┌──────────┴──────────┐               │
 │               │ Update stored token │               │
 │               │ Retry original req  │               │
 │               └──────────┬──────────┘               │
 │                          │                          │
 │                          │ Retry with new token     │
 │                          │ ─────────────────────────>
 │                          │                          │
 │ Original response        │ 200 OK                   │
 │ <───────────────────────── <─────────────────────────
```

---

## 2. Campaign Lifecycle

### 2.1 Create & Start Campaign

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CREATE & START CAMPAIGN                           │
└─────────────────────────────────────────────────────────────────────┘

User                   Frontend                  API (4050)         Workers
 │                        │                         │                  │
 │ "/start" command       │                         │                  │
 │ ───────────────────────>                         │                  │
 │                        │                         │                  │
 │ CampaignWizard renders │                         │                  │
 │ <───────────────────────                         │                  │
 │                        │                         │                  │
 │ Fills form             │                         │                  │
 │                        │                         │                  │
 │ Clicks [Deploy]        │                         │                  │
 │ ───────────────────────>                         │                  │
 │                        │                         │                  │
 │                        │ POST /pipeline/run      │                  │
 │                        │ { name, criteria }      │                  │
 │                        │ ────────────────────────>                  │
 │                        │                         │                  │
 │                        │              ┌──────────┴──────────┐       │
 │                        │              │ Create campaign     │       │
 │                        │              │ Set status="active" │       │
 │                        │              │ Enqueue acquisition │       │
 │                        │              └──────────┬──────────┘       │
 │                        │                         │                  │
 │                        │                         │ LPUSH            │
 │                        │                         │ queue:acquisition│
 │                        │                         │ ─────────────────>
 │                        │                         │                  │
 │                        │ 202 Accepted            │                  │
 │                        │ { campaignId }          │                  │
 │                        │ <────────────────────────                  │
 │                        │                         │                  │
 │     Wizard → Badge     │                         │                  │
 │ <───────────────────────                         │                  │
 │                        │                         │                  │
 │                        │ WS: Subscribe           │                  │
 │                        │ { campaignId }          │                  │
 │                        │ ────────────────────────>                  │
 │                        │                         │                  │
 │                        │                         │         ┌────────┴────────┐
 │                        │                         │         │ Worker pulls    │
 │                        │                         │         │ job from queue  │
 │                        │                         │         └────────┬────────┘
 │                        │                         │                  │
 │                        │                         │ POST /analytics  │
 │                        │                         │ /event           │
 │                        │                         │ <─────────────────
 │                        │                         │                  │
 │                        │ WS: Event               │                  │
 │                        │ { type: "acquisition" } │                  │
 │                        │ <────────────────────────                  │
 │                        │                         │                  │
 │ LiveFeed updates       │                         │                  │
 │ <───────────────────────                         │                  │
```

### 2.2 Pause Campaign

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PAUSE CAMPAIGN                                │
└─────────────────────────────────────────────────────────────────────┘

User                   Frontend                  API (4050)
 │                        │                         │
 │ Clicks [Pause]         │                         │
 │ ───────────────────────>                         │
 │                        │                         │
 │                        │ POST /campaigns/:id     │
 │                        │ /pause                  │
 │                        │ ────────────────────────>
 │                        │                         │
 │                        │              ┌──────────┴──────────┐
 │                        │              │ Validate status     │
 │                        │              │ Set status="paused" │
 │                        │              │ Emit tracking event │
 │                        │              └──────────┬──────────┘
 │                        │                         │
 │                        │ 200 { status: "paused" }│
 │                        │ <────────────────────────
 │                        │                         │
 │ Badge updates to PAUSED│                         │
 │ <───────────────────────                         │

Note: Workers check campaign status before processing.
      Paused campaigns are skipped.
```

---

## 3. Profile Review Flow

### 3.1 Approve Profile

```
┌─────────────────────────────────────────────────────────────────────┐
│                       APPROVE PROFILE                                │
└─────────────────────────────────────────────────────────────────────┘

User                   Frontend                  API (4050)
 │                        │                         │
 │ Views ProfileCard      │                         │
 │                        │                         │
 │ Clicks [✓ Approve]     │                         │
 │ ───────────────────────>                         │
 │                        │                         │
 │      Card dims         │                         │
 │      (optimistic)      │                         │
 │ <───────────────────────                         │
 │                        │                         │
 │                        │ POST /profiles/:id      │
 │                        │ /approve                │
 │                        │ ────────────────────────>
 │                        │                         │
 │                        │              ┌──────────┴──────────┐
 │                        │              │ Update profile      │
 │                        │              │ status="approved"   │
 │                        │              │ Emit tracking event │
 │                        │              └──────────┬──────────┘
 │                        │                         │
 │                        │ 200 OK                  │
 │                        │ <────────────────────────
 │                        │                         │
 │ Card slides out        │                         │
 │ Next profile loads     │                         │
 │ <───────────────────────                         │
```

### 3.2 Batch Approve

```
┌─────────────────────────────────────────────────────────────────────┐
│                      BATCH APPROVE PROFILES                          │
└─────────────────────────────────────────────────────────────────────┘

User                   Frontend                  API (4050)
 │                        │                         │
 │ Selects 50 profiles    │                         │
 │                        │                         │
 │ Clicks [Approve All]   │                         │
 │ ───────────────────────>                         │
 │                        │                         │
 │                        │ POST /profiles/batch    │
 │                        │ /approve                │
 │                        │ { ids: [...50 ids] }    │
 │                        │ ────────────────────────>
 │                        │                         │
 │                        │              ┌──────────┴──────────┐
 │                        │              │ updateMany()        │
 │                        │              │ Emit batch event    │
 │                        │              └──────────┬──────────┘
 │                        │                         │
 │                        │ 200 { matched: 50,      │
 │                        │       modified: 50 }    │
 │                        │ <────────────────────────
 │                        │                         │
 │ Success toast          │                         │
 │ List refreshes         │                         │
 │ <───────────────────────                         │
```

---

## 4. Real-Time Communication

### 4.1 WebSocket Connection

```
┌─────────────────────────────────────────────────────────────────────┐
│                     WEBSOCKET CONNECTION                             │
└─────────────────────────────────────────────────────────────────────┘

Frontend                                         Backend (4050)
 │                                                   │
 │ Connect: ws://localhost:4050/tracking/ws          │
 │ ───────────────────────────────────────────────────>
 │                                                   │
 │                                    ┌──────────────┴──────────────┐
 │                                    │ Validate permissions        │
 │                                    │ requirePermission("analytics│
 │                                    │ .read")                     │
 │                                    └──────────────┬──────────────┘
 │                                                   │
 │ Connection established                            │
 │ <───────────────────────────────────────────────────
 │                                                   │
 │ Keep-alive: ping                                  │
 │ ───────────────────────────────────────────────────>
 │                                                   │
 │ pong                                              │
 │ <───────────────────────────────────────────────────
 │                                                   │
 │─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│
 │           (Events stream as they occur)           │
 │─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│
 │                                                   │
 │ Event: { type: "acquisition", profile: "@user" }  │
 │ <───────────────────────────────────────────────────
 │                                                   │
 │ Event: { type: "filtering", score: 92 }           │
 │ <───────────────────────────────────────────────────
```

### 4.2 SSE Alternative (Server-Sent Events)

```
┌─────────────────────────────────────────────────────────────────────┐
│                      SSE CONNECTION                                  │
└─────────────────────────────────────────────────────────────────────┘

Frontend                                         Backend (4050)
 │                                                   │
 │ GET /tracking/stream                              │
 │ Accept: text/event-stream                         │
 │ Authorization: Bearer <token>                     │
 │ ───────────────────────────────────────────────────>
 │                                                   │
 │ HTTP 200                                          │
 │ Content-Type: text/event-stream                   │
 │ Cache-Control: no-cache                           │
 │ Connection: keep-alive                            │
 │                                                   │
 │ :ok                                               │
 │ <───────────────────────────────────────────────────
 │                                                   │
 │ event: update                                     │
 │ data: {"type":"acquisition","profile":"@user"}    │
 │ <───────────────────────────────────────────────────
 │                                                   │
 │ event: update                                     │
 │ data: {"type":"filtering","score":92}             │
 │ <───────────────────────────────────────────────────
```

---

## 5. Cloak Operations

### 5.1 Connect VPN

```
┌─────────────────────────────────────────────────────────────────────┐
│                        VPN CONNECTION                                │
└─────────────────────────────────────────────────────────────────────┘

User                   Frontend                  API (4050)        Cloak
 │                        │                         │               │
 │ Opens Cloak Settings   │                         │               │
 │                        │                         │               │
 │ Clicks [Connect VPN]   │                         │               │
 │ ───────────────────────>                         │               │
 │                        │                         │               │
 │                        │ POST /cloak/vpn/connect │               │
 │                        │ { location: "US",       │               │
 │                        │   protocol: "openvpn" } │               │
 │                        │ ────────────────────────>               │
 │                        │                         │               │
 │                        │                         │ Connect to    │
 │                        │                         │ VPN server    │
 │                        │                         │ ──────────────>
 │                        │                         │               │
 │                        │                         │ { connected,  │
 │                        │                         │   exitIp }    │
 │                        │                         │ <──────────────
 │                        │                         │               │
 │                        │ 200 {                   │               │
 │                        │   connected: true,      │               │
 │                        │   exitIp: "x.x.x.x" }   │               │
 │                        │ <────────────────────────               │
 │                        │                         │               │
 │ Status updates to      │                         │               │
 │ "Connected"            │                         │               │
 │ HUD shows new IP       │                         │               │
 │ <───────────────────────                         │               │
```

### 5.2 Run Leak Test

```
┌─────────────────────────────────────────────────────────────────────┐
│                         LEAK TEST                                    │
└─────────────────────────────────────────────────────────────────────┘

User                   Frontend                  API (4050)
 │                        │                         │
 │ Clicks [Run Leak Test] │                         │
 │ ───────────────────────>                         │
 │                        │                         │
 │                        │ POST /cloak/leak-test   │
 │                        │ ────────────────────────>
 │                        │                         │
 │                        │        ┌────────────────┴────────────────┐
 │                        │        │ Check IP (expected vs actual)  │
 │                        │        │ Check DNS (expected resolver)   │
 │                        │        │ Check WebRTC (STUN response)    │
 │                        │        └────────────────┬────────────────┘
 │                        │                         │
 │                        │ 200 {                   │
 │                        │   ipLeak: false,        │
 │                        │   dnsLeak: false,       │
 │                        │   webrtcLeak: true }    │
 │                        │ <────────────────────────
 │                        │                         │
 │ Results displayed      │                         │
 │ ⚠️ WebRTC leak detected│                         │
 │ [Fix WebRTC] button    │                         │
 │ <───────────────────────                         │
```

---

## 6. Error Handling Flows

### 6.1 Rate Limit Exceeded

```
User                   Frontend                  API (4050)
 │                        │                         │
 │ Rapid API calls        │                         │
 │ ───────────────────────>                         │
 │                        │ Request N+1             │
 │                        │ ────────────────────────>
 │                        │                         │
 │                        │ 429 Too Many Requests   │
 │                        │ { retryAfter: 30 }      │
 │                        │ <────────────────────────
 │                        │                         │
 │              ┌─────────┴─────────┐               │
 │              │ Queue request     │               │
 │              │ Start countdown   │               │
 │              └─────────┬─────────┘               │
 │                        │                         │
 │ Toast: "Rate limited.  │                         │
 │ Retry in 30s"          │                         │
 │ <───────────────────────                         │
 │                        │                         │
 │              (30 seconds pass)                   │
 │                        │                         │
 │                        │ Retry queued request    │
 │                        │ ────────────────────────>
```

### 6.2 Unauthorized (Session Expired)

```
User                   Frontend                  API (4050)
 │                        │                         │
 │ Action that needs auth │                         │
 │ ───────────────────────>                         │
 │                        │ Request                 │
 │                        │ ────────────────────────>
 │                        │                         │
 │                        │ 401 Unauthorized        │
 │                        │ { error: "INVALID_TOKEN"}
 │                        │ <────────────────────────
 │                        │                         │
 │              ┌─────────┴─────────┐               │
 │              │ Try token refresh │               │
 │              │ (see flow 1.2)    │               │
 │              └─────────┬─────────┘               │
 │                        │                         │
 │                  (If refresh fails)              │
 │                        │                         │
 │              ┌─────────┴─────────┐               │
 │              │ Clear auth state  │               │
 │              │ Redirect to login │               │
 │              └─────────┬─────────┘               │
 │                        │                         │
 │ Redirected to /login   │                         │
 │ Toast: "Session expired"                         │
 │ <───────────────────────                         │
```

---

## 7. Quick Reference: API Endpoint Map

| User Action | API Call | Method |
|-------------|----------|--------|
| Login | `/auth/login` | POST |
| Logout | `/auth/logout` | POST |
| Token refresh | `/auth/refresh` | POST |
| Get current user | `/auth/me` | GET |
| List campaigns | `/campaigns` | GET |
| Create campaign | `/campaigns` | POST |
| Start campaign | `/campaigns/:id/start` | POST |
| Pause campaign | `/campaigns/:id/pause` | POST |
| Stop campaign | `/campaigns/:id/complete` | POST |
| Quick start | `/pipeline/run` | POST |
| List profiles | `/profiles` | GET |
| Approve profile | `/profiles/:id/approve` | POST |
| Reject profile | `/profiles/:id/reject` | POST |
| Batch approve | `/profiles/batch/approve` | POST |
| Batch reject | `/profiles/batch/reject` | POST |
| Get analytics | `/analytics/metrics` | GET |
| Real-time stream | `/tracking/stream` | GET (SSE) |
| WebSocket | `/tracking/ws` | WS |
| Cloak status | `/cloak/status` | GET |
| Connect VPN | `/cloak/vpn/connect` | POST |
| Disconnect VPN | `/cloak/vpn/disconnect` | POST |
| Leak test | `/cloak/leak-test` | POST |
| System health | `/health/detailed` | GET |
| Prometheus metrics | `/metrics` | GET |
