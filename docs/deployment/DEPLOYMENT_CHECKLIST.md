# Phase 1 Deployment Checklist

## Pre-Deployment

### ✅ Configuration

- [ ] Configure proxy credentials in `config/proxies.json`
- [ ] Set all environment variables in `.env`
- [ ] Review and adjust warming schedule if needed
- [ ] Configure timing parameters for your use case

### ✅ Dependencies

- [ ] Install npm dependencies for all services
- [ ] Verify Docker and Docker Compose are installed
- [ ] Ensure Redis is accessible
- [ ] Test proxy connectivity

### ✅ Testing

- [ ] Run unit tests: `npm test`
- [ ] Run integration tests: `npm test tests/integration/anti-detection.test.ts`
- [ ] Manual test each service independently
- [ ] Test combined workflow end-to-end

---

## Deployment Steps

### Step 1: Build Services

```bash
# Build all anti-detection services
docker-compose build proxy-manager
docker-compose build fingerprint-engine
docker-compose build timing-engine
docker-compose build account-warming
```

### Step 2: Start Infrastructure

```bash
# Start Redis and MongoDB
docker-compose up -d redis mongodb

# Wait for health checks
docker-compose ps
```

### Step 3: Start Anti-Detection Services

```bash
# Start services in order
docker-compose up -d proxy-manager
docker-compose up -d fingerprint-engine
docker-compose up -d timing-engine
docker-compose up -d account-warming
```

### Step 4: Verify Services

```bash
# Check all services are running
docker-compose ps

# Check logs for errors
docker-compose logs proxy-manager
docker-compose logs fingerprint-engine
docker-compose logs timing-engine
docker-compose logs account-warming
```

### Step 5: Start Application Services

```bash
# Start API and workers
docker-compose up -d api
docker-compose up -d worker-acquisition
docker-compose up -d worker-filtering
docker-compose up -d worker-research
docker-compose up -d worker-engagement
docker-compose up -d worker-tracking
```

### Step 6: Start Frontend

```bash
# Start dashboard
docker-compose up -d dashboard
```

---

## Post-Deployment Verification

### Health Checks

#### 1. Proxy Manager

```bash
# Check proxy health via Redis
docker exec -it bombardier-redis redis-cli
> KEYS proxy:health:*
> GET proxy:health:proxy-us-res-1
```

Expected: JSON with health metrics

#### 2. Fingerprint Engine

```bash
# Check logs for personality generation
docker-compose logs fingerprint-engine | grep "personality"
```

Expected: No errors

#### 3. Timing Engine

```bash
# Check logs for delay calculations
docker-compose logs timing-engine | grep "delay"
```

Expected: Delays within configured range

#### 4. Account Warming

```bash
# Check account warming data
docker exec -it bombardier-redis redis-cli
> KEYS account:warming:*
> GET account:warming:twitter:test_user
```

Expected: JSON with warming status

### Integration Tests

#### Test 1: Proxy Acquisition

```typescript
const proxy = await proxyManager.acquireProxy({
    type: 'residential',
    geography: 'US'
});
console.log('✅ Proxy acquired:', proxy.id);
```

#### Test 2: Fingerprint Generation

```typescript
const personality = fingerprintEngine.generatePersonality();
console.log('✅ Personality generated:', personality.id);
```

#### Test 3: Timing Calculation

```typescript
const delay = timingEngine.calculateNextActionDelay(context);
console.log('✅ Delay calculated:', delay, 'ms');
```

#### Test 4: Account Warming

```typescript
const account = await warmingManager.registerAccount('twitter', 'test');
console.log('✅ Account registered:', account.id);
```

### Performance Metrics

Monitor these metrics for 24 hours:

- **Proxy Success Rate:** Should be > 80%
- **Proxy CAPTCHA Rate:** Should be < 20%
- **Account Warming Compliance:** 100% (no phase violations)
- **Timing Variance:** Delays should vary naturally
- **Service Uptime:** All services should stay running

---

## Monitoring Setup

### 1. Prometheus Metrics (Optional)

```bash
# Uncomment in docker-compose.yml
docker-compose up -d prometheus grafana
```

### 2. Log Aggregation

```bash
# View all service logs
docker-compose logs -f --tail=100

# Filter by service
docker-compose logs -f proxy-manager
```

### 3. Health Dashboards

Create monitoring scripts:

```bash
# scripts/monitor-proxies.sh
#!/bin/bash
while true; do
    echo "=== Proxy Health Report ==="
    docker exec bombardier-redis redis-cli --raw GET proxy:health:report
    sleep 300 # Every 5 minutes
done
```

```bash
# scripts/monitor-warming.sh
#!/bin/bash
while true; do
    echo "=== Account Warming Status ==="
    docker exec bombardier-redis redis-cli --raw KEYS "account:warming:*"
    sleep 600 # Every 10 minutes
done
```

---

## Rollback Plan

If issues occur:

### Quick Rollback

```bash
# Stop anti-detection services
docker-compose stop proxy-manager fingerprint-engine timing-engine account-warming

# Revert to previous version
git checkout main
docker-compose up -d --build
```

### Partial Rollback

```bash
# Disable specific service
docker-compose stop proxy-manager

# Update environment variable
echo "PROXY_MANAGER_ENABLED=false" >> .env

# Restart affected services
docker-compose restart worker-engagement
```

---

## Troubleshooting

### Issue: Services won't start

**Check:**

- Docker daemon is running
- Ports are not in use
- Environment variables are set
- Config files exist

**Solution:**

```bash
docker-compose down
docker-compose up -d --force-recreate
```

### Issue: Proxies all blocked

**Check:**

- Proxy credentials are correct
- Proxy service is active
- Success rate thresholds

**Solution:**

```bash
# Reset proxy health
docker exec bombardier-redis redis-cli FLUSHDB
docker-compose restart proxy-manager
```

### Issue: Account warming too restrictive

**Check:**

- Phase configuration
- Daily limits
- Automation levels

**Solution:**

```bash
# Adjust limits in .env
ACCOUNT_WARMING_MAX_ACTIONS_PER_DAY_MANUAL=50

# Restart service
docker-compose restart account-warming
```

### Issue: Timing delays too long

**Check:**

- Circadian rhythm settings
- Average action interval
- Session fatigue

**Solution:**

```bash
# Disable circadian rhythm for testing
TIMING_CIRCADIAN_ENABLED=false

# Reduce average interval
TIMING_MIN_DELAY_MS=500
```

---

## Maintenance

### Daily Tasks

- [ ] Check proxy health report
- [ ] Review account warming status
- [ ] Monitor service logs for errors
- [ ] Verify all services are running

### Weekly Tasks

- [ ] Rotate proxy credentials
- [ ] Update proxy pool configuration
- [ ] Review and adjust timing parameters
- [ ] Analyze detection rates

### Monthly Tasks

- [ ] Update dependencies
- [ ] Review and optimize configurations
- [ ] Analyze long-term metrics
- [ ] Plan Phase 2 implementation

---

## Success Criteria

### Week 1

- ✅ All services running without crashes
- ✅ Proxy success rate > 70%
- ✅ No account bans
- ✅ Timing delays working correctly

### Week 2

- ✅ Proxy success rate > 80%
- ✅ Account warming advancing phases correctly
- ✅ No CAPTCHA challenges
- ✅ Natural timing variance observed

### Week 4

- ✅ Proxy success rate > 85%
- ✅ First accounts reaching "full" phase
- ✅ Zero detection incidents
- ✅ Ready for Phase 2 implementation

---

## Next Steps

After successful Phase 1 deployment:

1. **Monitor for 2 weeks** - Ensure stability
2. **Collect metrics** - Analyze effectiveness
3. **Optimize parameters** - Fine-tune based on data
4. **Plan Phase 2** - API-First Acquisition, GraphQL Harvesting
5. **Scale gradually** - Increase automation slowly

---

## Support Contacts

- **Technical Issues:** Check logs and documentation
- **Proxy Issues:** Contact proxy service provider
- **Configuration Help:** Review `backend/services/README.md`
- **Emergency:** Rollback using rollback plan

---

**Deployment Date:** _____________  
**Deployed By:** _____________  
**Environment:** Production / Staging / Development  
**Version:** Phase 1 - v1.0.0
