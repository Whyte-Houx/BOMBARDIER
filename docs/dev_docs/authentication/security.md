# Authentication & Security System

## Authentication Architecture Overview

The Target Acquisition & Engagement AI system implements a comprehensive multi-layered authentication and authorization framework that supports both user authentication for the dashboard and platform authentication for social media integrations.

## User Authentication System

### Authentication Methods

#### 1. Email/Password Authentication
**Implementation**: Password hashing with `argon2id` (preferred) or `bcrypt`.
**Policy**:
- `argon2id` parameters: memoryCost=65536, timeCost=3, parallelism=1
- `bcrypt` fallback: cost factor=12
- Minimum password length: 12 characters; block common/known-breached passwords
- Progressive backoff on failed attempts; CAPTCHA after 5 failures
- Account lockout for 10 minutes after 10 consecutive failures

**Endpoints**:
- `POST /auth/register`: `{ email, password, username }` → 201 on success
- `POST /auth/login`: `{ email, password }` → access + refresh tokens
- `POST /auth/logout`: revokes current session and refresh token
- `POST /auth/change-password`: requires current password; rotates all tokens

**Error Codes**:
- `401_INVALID_CREDENTIALS`, `429_TOO_MANY_ATTEMPTS`, `400_WEAK_PASSWORD`



#### 2. JWT Token Management
**Token Types**:
- Access Token: 15 minutes–1 hour (default 30 minutes)
- Refresh Token: 30 days; single-use rotation with every refresh

**Signing & Keys**:
- Algorithm: `RS256` with per-environment key pairs
- JWKS endpoint: `GET /.well-known/jwks.json` exposing public keys with `kid`
- Key rotation every 90 days; maintain previous keys for 30-day grace window

**Claims**:
- Standard: `sub`, `iss`, `aud`, `iat`, `exp`
- Custom: `role`, `permissionsVersion`, `sessionId`

**Storage**:
- Access token in `Authorization: Bearer <token>` header
- Refresh token in httpOnly, Secure, SameSite=Strict cookie `refresh_token`

**Revocation & Rotation**:
- Store refresh token hashes in Redis keyed by `sessionId`
- On refresh: invalidate prior token id; issue new `sessionId`
- Immediate revocation: `POST /auth/revoke` with `sessionId`

**Middleware**:
- Validate signature and `kid`; enforce `aud`/`iss`
- Attach `user` context; enforce RBAC



#### 3. OAuth 2.0 Integration
**Supported Providers**: Google, GitHub, Microsoft
**Flow**: Authorization Code Grant with PKCE

**Scopes**:
- Google: `openid email profile`
- GitHub: `read:user user:email`
- Microsoft: `openid email profile`

**Endpoints**:
- `GET /oauth/:provider/start` → redirects to provider with PKCE
- `GET /oauth/:provider/callback` → exchanges code; links/creates local account

**Account Linking**:
- If email matches existing account, prompt to link; require email verification
- Store provider `providerId`, refresh token (encrypted), and last-used timestamp

**Error Handling**:
- Graceful fallback on denied consent; audit event `oauth_consent_denied`



### Authorization System

#### Role-Based Access Control (RBAC)
**Roles**: `admin`, `operator`, `viewer`
**Policy**:
- `admin`: full access including system/settings endpoints
- `operator`: read/write on profiles, campaigns, messages; read analytics; limited system
- `viewer`: read-only on profiles, campaigns, messages, analytics

**Permission Model**:
- Define atomic permissions (e.g., `profiles.read`, `campaigns.write`)
- Associate role → permission sets via versioned policy `permissionsVersion`

**Enforcement**:
- Middleware `requirePermission(permission)` for route guards
- Resource-level checks: verify ownership (`userId`) for non-admins
#### Permission Middleware
**Contract**:
- Evaluate JWT `role` and resolved permission set
- Support overrides via per-user custom permissions
- Deny with `403_FORBIDDEN` including `missingPermissions`

**Examples**:
- `POST /campaigns` → `campaigns.write`
- `GET /profiles/:id` → `profiles.read`
- `POST /messages/:id/deliver` → `messages.deliver`

## Platform Authentication System

### Social Media Platform Authentication

#### 1. Twitter Authentication
**Method**: OAuth 2.0 with PKCE
**Scopes**: tweet.read, users.read, follows.read

**Operational Notes**:
- Respect rate limits; store `rate_limit_reset` per token
- Use app-only auth for public data when viable



#### 2. LinkedIn Authentication
**Method**: OAuth 2.0 with browser automation fallback
**Scopes**: r_liteprofile, r_emailaddress, w_member_social

**Operational Notes**:
- Prefer official API; reserve browser automation for non-API actions with human review



#### 3. Instagram Authentication
**Method**: Browser automation with session management
**Note**: Instagram doesn't provide public APIs for most operations

**Session Handling**:
- Persist session cookies encrypted; rotate user-agents; proxy per session
- Detect anti-bot challenges; stop on suspicion; escalate to manual



## Security Measures

### API Security

#### Rate Limiting
**Design**:
- Global per-IP limits: `100 req/min`
- Per-user limits: `1000 req/hour` with burst allowance
- Per-endpoint custom limits for `deliverMessage`, `acquire` routes

**Storage**: Redis sliding window; keys `rate:{scope}:{id}`

**Responses**: `429_TOO_MANY_REQUESTS` with `retryAfter`
#### Input Validation & Sanitization
**Validation**:
- Enforce JSON schemas per endpoint; reject unknown fields
- Sanitize strings; limit payload sizes; validate file uploads

**Protection**:
- Prevent SQL/NoSQL injection via parameterized queries and strict operators
- Output escaping; consistent charset; reject malformed UTF-8

### Data Protection

#### Encryption at Rest
**Policy**:
- Encrypt databases and backups using cloud KMS-managed keys
- Field-level encryption for secrets: tokens, API keys, session cookies

**Key Management**:
- Rotate data encryption keys annually; audit key access
#### Secure Communication
**Transport**:
- TLS 1.3 enforced; HSTS enabled; strong ciphers
- Mutual TLS for internal service calls where feasible

**Headers**:
- `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`
## Session Management

### Browser Session Handling
**Storage**: Redis `sessions:*` with TTL matching platform policies
**Rotation**: Rotate proxies and user-agents per session; regenerate fingerprints
**Lifecycle**: Initiate → validate → use → retire; purge on detection signals
**Observability**: Track session health metrics; emit `session_degraded` alerts

## Security Monitoring & Audit

### Audit Logging
**Events**:
- Auth: login, logout, register, password change, revoke, failed attempts
- OAuth: start, callback, consent denied, error
- Admin actions: role changes, policy updates, sensitive reads

**Structure**:
- `{ id, timestamp, actorId, action, resource, result, correlationId }`
- Immutable append-only; redact PII; store 1 year; exportable

### Security Monitoring
**Monitoring**:
- Centralized logs to ELK; alerts via Grafana/Prometheus
- SAST/DAST scheduled scans; dependency vulnerability alerts
- Incident runbooks; RTO < 4h; RPO < 24h


