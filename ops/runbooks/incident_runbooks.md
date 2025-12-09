# Incident Runbooks

## Auth Service Degradation
- Detect via elevated 401/403 rates and login failures.
- Validate JWKS availability and key rotation status.
- Check Redis availability for refresh token storage.
- Roll back recent deployments if error rate exceeds threshold.
- Communicate user impact and mitigation timeline.

## Rate Limit Breach
- Identify scope and actor via rate keys.
- Increase window or lower limits temporarily if necessary.
- Apply per-endpoint throttles for delivery and acquisition.
- Review proxy pool health and retry strategies.

## Session Degradation Alerts
- Inspect sessions by status and lastValidatedAt.
- Rotate proxies and user-agents for affected sessions.
- Pause automation on suspected detection.
- Escalate to manual review if repeated challenges occur.

## Database Performance Incident
- Review slow queries and index usage.
- Add or adjust compound indexes based on query patterns.
- Scale cluster nodes and review balancer activity.
- Enable caching for hot paths and reduce write contention.

## Security Event Response
- Triage alerts from SAST/DAST and dependency scans.
- Revoke sessions and rotate keys for suspected compromise.
- Apply hotfixes and increase monitoring granularity.
- Conduct post-incident review and update policies.