# 🔧 Troubleshooting Guide

Common issues and their solutions for Bombardier.

---

## 📋 Quick Diagnostics

```bash
# Check Docker status
docker ps

# Check service health
curl http://localhost:4050/health

# Check logs
docker-compose logs -f api

# Check port usage
lsof -i :3000,:4050,:5050,:27017,:6379
```

---

## 🐳 Docker Issues

### Docker Desktop Not Running

**Symptoms:**

- `Cannot connect to Docker daemon`
- `docker ps` hangs or fails

**Solution:**

```bash
# Restart Docker Desktop
killall Docker && open -a Docker

# Wait for Docker to start (30 seconds)
sleep 30

# Verify
docker ps
```

---

### Container Won't Start

**Symptoms:**

- Container exits immediately
- `docker ps` shows container as `Exited`

**Solution:**

```bash
# Check logs for errors
docker logs bombardier-api

# Rebuild container
docker-compose build --no-cache api
docker-compose up -d api

# If still failing, check Docker resources
# Docker Desktop > Settings > Resources
# Recommended: 4 CPUs, 8GB RAM
```

---

### Port Already in Use

**Symptoms:**

- `port is already allocated`
- `address already in use`

**Solution:**

```bash
# Find what's using the port
lsof -i :4050

# Kill the process
kill -9 <PID>

# Or change the port in docker-compose.yml
# ports:
#   - "4051:4050"  # Changed from 4050:4050
```

---

## 🧪 Test Issues

### Tests Failing with ECONNREFUSED

**Symptoms:**

```
TypeError: fetch failed
Error: connect ECONNREFUSED ::1:4050
```

**Solution:**

```bash
# 1. Start infrastructure
docker-compose up -d mongodb redis api

# 2. Wait for services to be ready
sleep 10

# 3. Run tests
npm test
```

---

### Tests Timing Out

**Symptoms:**

- Tests hang indefinitely
- `Timeout of 5000ms exceeded`

**Solution:**

```bash
# Check if services are responding
curl http://localhost:4050/health
redis-cli -h localhost ping

# Restart services
docker-compose restart api redis mongodb

# Run tests with more time
npm test -- --testTimeout=10000
```

---

### Anti-Detection Tests Skipped

**Expected Behavior**: Anti-detection tests are skipped by design

**Reason**: They require TypeScript compilation of cloak services

**To Enable:** (optional)

```bash
# Build each cloak service
cd backend/services/cloak/proxy-manager && npm run build
cd ../fingerprint && npm run build
cd ../timing && npm run build
cd ../account-warming && npm run build

# Then run tests
npm test
```

---

## 🌐 API Issues

### API Returns 500 Error

**Symptoms:**

- API requests return 500 status
- `Internal Server Error`

**Solution:**

```bash
# 1. Check API logs
docker logs bombardier-api --tail 50

# 2. Common causes:
# - MongoDB not connected
# - Redis not connected
# - Missing environment variables

# 3. Verify connections
docker exec bombardier-mongodb mongosh --eval "db.runCommand({ ping: 1 })"
docker exec bombardier-redis redis-cli ping

# 4. Restart API
docker-compose restart api
```

---

### API Returns 401 Unauthorized

**Symptoms:**

- All API requests return 401
- `Unauthorized` error

**Solution:**

```bash
# 1. Get a valid token
curl -X POST http://localhost:4050/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"TestPassword123!"}'

# 2. Use token in requests
curl http://localhost:4050/campaigns \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### MongoDB Connection Failed

**Symptoms:**

- `MongooseError: Could not connect to database`
- API logs show connection errors

**Solution:**

```bash
# 1. Check if MongoDB is running
docker ps | grep mongodb

# 2. Restart MongoDB
docker-compose restart mongodb

# 3. Check MongoDB logs
docker logs bombardier-mongodb

# 4. Try connecting manually
docker exec -it bombardier-mongodb mongosh

# 5. Verify connection string in .env
MONGODB_URI=mongodb://admin:password@mongodb:27017/bombardier?authSource=admin
```

---

## 📊 Frontend Issues

### Dashboard Won't Load

**Symptoms:**

- Blank page
- `Cannot GET /`
- Build errors

**Solution:**

```bash
# 1. Check if dashboard is running
curl http://localhost:3000

# 2. Check logs
docker-compose logs -f dashboard

# 3. Rebuild
cd frontend/dashboard
rm -rf .next node_modules
npm install
npm run dev

# 4. Or use Docker
docker-compose build --no-cache dashboard
docker-compose up -d dashboard
```

---

### Dashboard Not Connecting to API

**Symptoms:**

- Dashboard loads but no data
- Console shows fetch errors

**Solution:**

```bash
# 1. Check API is running
curl http://localhost:4050/health

# 2. Verify API URL in frontend/.env
NEXT_PUBLIC_API_URL=http://localhost:4050

# 3. Check CORS settings
# API should allow requests from http://localhost:3000

# 4. Open browser console (F12) and check for errors
```

---

## 💾 Database Issues

### Database is Empty/No Data

**Symptoms:**

- Campaigns/profiles show empty
- `No data found`

**Solution:**

```bash
# 1. Check if you're connected to the right database
docker exec -it bombardier-mongodb mongosh
> use bombardier
> show collections
> db.campaigns.count()

# 2. Create test data (for development)
curl -X POST http://localhost:4050/campaigns \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"name":"Test Campaign","targetCriteria":{"platforms":["twitter"]}}'

# 3. Or run seed script (if available)
npm run seed
```

---

### Redis Connection Issues

**Symptoms:**

- Worker jobs not processing
- `Redis connection failed`

**Solution:**

```bash
# 1. Check Redis is running
docker ps | grep redis

# 2. Test connection
docker exec bombardier-redis redis-cli ping
# Should return: PONG

# 3. Check Redis URL in .env
REDIS_URL=redis://localhost:6379

# 4. View Redis data
docker exec -it bombardier-redis redis-cli
> KEYS *
> GET key_name
```

---

## 🔐 Authentication Issues

### Cannot Register User

**Symptoms:**

- Registration fails with 400
- `Validation error`

**Solution:**

```bash
# Password requirements:
# - At least 8 characters
# - Contains uppercase and lowercase
# - Contains numbers
# - Contains special characters

# Example valid password:
TestPassword123!

# Check API validation rules in backend/api/src/dto.ts
```

---

### Token Expired

**Symptoms:**

- API returns 401 after some time
- `Token expired`

**Solution:**

```bash
# 1. Login again to get new token
curl -X POST http://localhost:4050/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"your_user","password":"your_pass"}'

# 2. Or use refresh token
curl -X POST http://localhost:4050/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"YOUR_REFRESH_TOKEN"}'
```

---

## ⚡ Performance Issues

### Slow API Responses

**Solution:**

```bash
# 1. Check MongoDB indexes
docker exec -it bombardier-mongodb mongosh
> use bombardier
> db.campaigns.getIndexes()
> db.profiles.getIndexes()

# 2. Check Redis cache
docker exec bombardier-redis redis-cli
> INFO stats
> DBSIZE

# 3. Monitor resource usage
docker stats

# 4. Increase Docker resources if needed
# Docker Desktop > Settings > Resources
```

---

### High Memory Usage

**Solution:**

```bash
# 1. Check which container is using memory
docker stats

# 2. Restart the hungry container
docker-compose restart <service-name>

# 3. Increase Docker memory limit
# Docker Desktop > Settings > Resources > Memory: 8GB

# 4. Optimize code (check for memory leaks)
node --inspect backend/api/dist/index.js
```

---

## 🔧 Development Issues

### TypeScript Compilation Errors

**Solution:**

```bash
# 1. Check Node.js version
node --version  # Should be 20.x

# 2. Clean and reinstall
rm -rf node_modules package-lock.json
npm install

# 3. Check TypeScript version
npx tsc --version

# 4. Rebuild
npm run build
```

---

### ESM Module Errors

**Symptoms:**

- `Cannot find module`
- `ERR_MODULE_NOT_FOUND`

**Solution:**

```bash
# 1. Ensure package.json has:
"type": "module"

# 2. Use .js extensions in imports:
import { something } from './file.js'  // Not './file'

# 3. Check tsconfig.json:
"module": "ESNext"
"moduleResolution": "NodeNext"
```

---

## 📝 Logging & Debugging

### Enable Debug Logs

```bash
# API logs
DEBUG=bombardier:* npm run dev

# Worker logs
DEBUG=worker:* npm run dev

# All logs
DEBUG=* npm run dev
```

### View Real-time Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api

# Last 100 lines
docker-compose logs --tail 100 api

# Since specific time
docker-compose logs --since 30m api
```

---

## 🆘 Still Having Issues?

### Collect Debug Information

```bash
# System info
node --version
docker --version
docker-compose --version

# Service status
docker ps
docker-compose ps

# Recent logs
docker-compose logs --tail 50 api > debug.log
docker-compose logs --tail 50 mongodb >> debug.log
docker-compose logs --tail 50 redis >> debug.log

# Test output
npm test > test-output.log 2>&1
```

### Get Help

1. **Check Documentation**
   - [Testing Guide](../testing/TESTING.md)
   - [API Documentation](../api/README.md)
   - [Architecture Docs](../architecture/OVERVIEW.md)

2. **Review Test Results**
   - [Latest Test Results](../testing/FINAL_TEST_RESULTS_100_PERCENT.md)

3. **Contact Support**
   - Email: <support@bombardier.ai>
   - Include debug logs and error messages

---

## ✅ Prevention Tips

1. **Always check Docker is running** before starting services
2. **Wait for services to be healthy** before running tests
3. **Keep dependencies updated** with `npm audit fix`
4. **Monitor resource usage** with `docker stats`
5. **Regular backups** of MongoDB data
6. **Check logs** when something goes wrong

---

**Last Updated**: December 9, 2025

For more help, see the [Documentation Index](../README.md)
