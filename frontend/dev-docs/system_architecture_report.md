# Backend System Architecture & Analysis Report

> **Date:** December 10, 2024
> **Version:** 1.0.0
> **Status:** Production-Ready (Security Hardened)

---

## 1. Executive Summary

The **Bombardier Backend** is a high-performance, Fastify-based system designed for automated target acquisition and engagement. It follows a microservices-ready architecture with a centralized API gateway (monolithic deployment currently).

**Key Strengths:**

- **Robust Security:** Dual-mode auth (JWT/Mock), granular RBAC (Role-Based Access Control), and internal API keys for worker services.
- **Anti-Detection Core:** Dedicated `/cloak` module for managing fingerprints, proxies, and VPNs (critical for scraping operations).
- **Real-time Capability:** Native SSE (`/tracking/stream`) and WebSocket (`/tracking/ws`) support for live feedback loops.
- **Scalability:** Worker-based job queues (`queue:acquisition`, `queue:filtering`, etc.) decoupled from the main API.

---

## 2. API Endpoint Analysis

### Core Business Logic

| Domain | Role | Key Functionality | Notes |
|--------|------|-------------------|-------|
| **Campaigns** | Orchestrator | CRUD, State Machine (Draft -> Active -> Paused -> Completed) | Tightly coupled with `queue:acquisition`. Includes 10s caching for status counts. |
| **Pipeline** | Executor | `/run` shortcut for immediate execution | Directly enqueues jobs, skipping draft phase. |
| **Profiles** | Data Asset | Workflow Engine (Pending -> Approved/Rejected -> Engaged) | Supports batch operations (max 100). "Interests" array is key for AI filtering. |
| **Messages** | Communication | Content Management | Linked to profiles and campaigns. Simple status tracking. |
| **Analytics** | Intelligence | Aggregation & Reporting | **Internal Secure Endpoints:** `/event` & `/metric` (Worker-only). |

### Infrastructure & Security

| Domain | Role | Key Functionality | Notes |
|--------|------|-------------------|-------|
| **Auth** | Gatekeeper | JWT Session Management | **Dual Mode**: Dev (Mock Admin) / Prod (Real verification). |
| **Cloak** | Stealth | Proxy/VPN/Fingerprint Management | **New:** All endpoints secured with `cloak.*` permissions. |
| **Health** | Observability | Liveness/Readiness Probes | **New:** `/health/detailed` (Protected) vs `/health/live` (Public). |
| **Metrics** | Observability | Prometheus Exporters | Protected by token/RBAC. |

---

## 3. Data Flow & Dependencies

### Request Lifecycle

1. **Ingress:** Client request -> Nginx/Docker Router -> Fastify API.
2. **Security Layer:** `rateLimit` -> `jwtPlugin` (Authentication) -> `rbacPlugin` (Authorization).
3. **Controller Layer:** Zod Validation -> Business Logic.
4. **Data Layer:** MongoDB (Persistence) / Redis (Cache & Queues).
5. **Audit:** Sensitive actions logged via `onResponse` hook.

### Worker Integration

* **Trigger:** API pushes to Redis List (`queue:*`).
- **Execution:** Python/Node workers process jobs.
- **Feedback:** Workers call back to API (`POST /analytics/event`) using `X-Api-Key`.

---

## 4. Gap Analysis & Recommendations

### Missing Features (Flagged)

1. **OAuth Suspension**: The `/oauth` routes are explicitly marked "SUSPENDED".
    - *Impact*: Social login is currently dead code.
    - *Recommendation*: Re-enable once provider credentials are secured in prod env.
2. **Webhooks**: No outbound webhook system for external integrations (e.g., Slack notifications on lead found).
3. **Advanced Filtering**: Profile search is basic (`/search` text or `/find-by-interests`). No complex boolean logic (AND/OR).

### Security Concerns (addressed, to monitor)

1. **Rate Limiting**: Newly implemented. Monitor logs for `RATE_LIMIT_EXCEEDED` to tune the 100 req/min threshold.
2. **Internal Key Rotation**: `INTERNAL_API_KEY` is an env var. Requires restart to rotate. Consider DB-backed keys for zero-downtime rotation.

---

## 5. Conclusion

The backend is **structurally sound and secure**. The separation of concerns between the API (User/State management) and Workers (Heavy lifting) is excellent. The recent security patches (Auth, Cloak, Metrics) have closed the major vulnerability gaps.

**Readiness for UI:**
The API is fully ready to support the proposed "Chat Interface" UI. The real-time streams (`/tracking/*`) will be crucial for the "living system" feel of the chat interface.
