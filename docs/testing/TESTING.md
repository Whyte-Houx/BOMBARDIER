# Bombardier Testing Guide

## Quick Start

```bash
# Install all dependencies
npm install

# Run unit tests only (no infrastructure required)
npm run test:unit

# Run all tests (requires infrastructure)
npm test

# Run with coverage
npm run test:coverage
```

## Current Test Status

✅ **22/41 tests passing (53.7%)**

### Passing Tests (No Infrastructure Required)

- ✅ Unit Tests: 8/8 (Bot Detection)
- ✅ Worker Logic: 2/2 (Engagement Worker)
- ✅ Backend API: 3/3 (Health, DTO Validation)
- ✅ Contract Tests: 1/1 (Pact)

### Pending Tests (Require Infrastructure)

- ⚠️ API Integration: 21 tests (need API server on port 4050)
- ⚠️ Error Handling: 6 tests (need API server)
- ⚠️ Anti-Detection: 18 tests (need Redis on port 6379)

## Setting Up Test Infrastructure

### Option 1: Automated Setup (Recommended)

```bash
# Run the setup script
./setup-test-infrastructure.sh
```

This will:

- Start Redis in Docker (port 6379)
- Start MongoDB in Docker (port 27017)
- Create a `.env` file with test configuration
- Display connection information

### Option 2: Manual Setup

#### Start Redis

```bash
docker run -d --name bombardier-redis -p 6379:6379 redis:7-alpine
```

#### Start MongoDB

```bash
docker run -d --name bombardier-mongo \
  -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=password \
  mongo:7
```

#### Start API Server

```bash
cd backend/api
npm install
npm run dev
```

## Test Categories

### 1. Unit Tests (`tests/unit/`)

**No infrastructure required** - Tests isolated business logic.

```bash
npm run test:unit
```

**Coverage:**

- Bot detection algorithms
- Profile quality scoring
- Statistical anomaly detection

### 2. Integration Tests (`tests/integration/`)

**Requires:** API server, Redis

```bash
npm run test:integration
```

**Coverage:**

- API endpoints (campaigns, profiles, analytics, auth)
- Error handling and validation
- Worker flow (engagement, message generation)
- Anti-detection services (proxy, fingerprint, timing, account warming)

### 3. Contract Tests (`tests/contracts/`)

**No infrastructure required** - Uses Pact mock server.

```bash
npm test -- tests/contracts/
```

**Coverage:**

- API contract verification
- Consumer-provider contracts

### 4. Backend Tests (`tests/backend/`)

**No infrastructure required** - Tests DTO validation and health checks.

```bash
npm test -- tests/backend/
```

**Coverage:**

- DTO schema validation
- Health endpoint specs

## Running Specific Tests

```bash
# Run a specific test file
npm test -- tests/unit/bot-detection.test.ts

# Run tests matching a pattern
npm test -- --grep "Bot Detection"

# Run in watch mode
npm run test:watch

# Run with verbose output
npm test -- --reporter=verbose
```

## Environment Variables

Create a `.env` file in the project root:

```bash
# Database
MONGODB_URI=mongodb://admin:password@localhost:27017/bombardier?authSource=admin
REDIS_URL=redis://localhost:6379

# API
API_URL=http://localhost:4050
BROWSER_SERVICE_URL=http://localhost:5100
USE_BROWSER_SERVICE=true

# OpenAI (optional for tests)
OPENAI_API_KEY=your-key-here

# JWT
JWT_SECRET=test-secret-key
JWT_REFRESH_SECRET=test-refresh-secret-key

# Test Environment
NODE_ENV=test
TEST_API_URL=http://localhost:4050
```

## Test Coverage Report

Generate a detailed coverage report:

```bash
npm run test:coverage
```

This will:

- Run all tests with coverage tracking
- Generate HTML report in `coverage/` directory
- Display coverage summary in terminal

View the HTML report:

```bash
open coverage/index.html
```

## Troubleshooting

### Tests Failing with "ECONNREFUSED"

**Problem:** API server is not running.

**Solution:**

```bash
cd backend/api
npm run dev
```

### Tests Failing with "Redis connection error"

**Problem:** Redis is not running.

**Solution:**

```bash
docker start bombardier-redis
# or
docker run -d --name bombardier-redis -p 6379:6379 redis:7-alpine
```

### Module Import Errors

**Problem:** TypeScript modules not found.

**Solution:**

```bash
# Install dependencies in all services
cd backend/services/cloak/proxy-manager && npm install
cd ../fingerprint && npm install
cd ../timing && npm install
cd ../account-warming && npm install
```

### Port Already in Use

**Problem:** Port 4050, 6379, or 27017 is already in use.

**Solution:**

```bash
# Find what's using the port
lsof -i :4050

# Kill the process or stop the container
docker stop bombardier-redis bombardier-mongo
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
      
      mongodb:
        image: mongo:7
        ports:
          - 27017:27017
        env:
          MONGO_INITDB_ROOT_USERNAME: admin
          MONGO_INITDB_ROOT_PASSWORD: password
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm install
      
      - name: Run unit tests
        run: npm run test:unit
      
      - name: Start API server
        run: |
          cd backend/api
          npm install
          npm run dev &
          sleep 5
      
      - name: Run integration tests
        run: npm run test:integration
      
      - name: Generate coverage
        run: npm run test:coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## Test Writing Guidelines

### Unit Test Example

```typescript
import { describe, it, expect } from 'vitest';

describe('MyFunction', () => {
    it('should do something', () => {
        const result = myFunction(input);
        expect(result).toBe(expected);
    });
});
```

### Integration Test Example

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('API Integration', () => {
    beforeAll(async () => {
        // Setup: start services, seed data
    });

    afterAll(async () => {
        // Cleanup: stop services, clear data
    });

    it('should create a resource', async () => {
        const response = await fetch('http://localhost:4050/resource', {
            method: 'POST',
            body: JSON.stringify(data)
        });
        expect(response.status).toBe(200);
    });
});
```

## Test Maintenance

### Adding New Tests

1. Create test file in appropriate directory:
   - `tests/unit/` for unit tests
   - `tests/integration/` for integration tests
   - `tests/contracts/` for contract tests
   - `tests/e2e/` for end-to-end tests

2. Follow naming convention: `*.test.ts` or `*.spec.ts`

3. Import from vitest: `import { describe, it, expect } from 'vitest';`

4. Run the test: `npm test -- path/to/test.test.ts`

### Updating Existing Tests

1. Make changes to test file
2. Run specific test to verify: `npm test -- path/to/test.test.ts`
3. Run full suite to ensure no regressions: `npm test`

## Performance Testing

For load testing and performance benchmarks:

```bash
# Install k6 (load testing tool)
brew install k6

# Run performance tests
k6 run tests/performance/load-test.js
```

## Security Testing

For security and penetration testing:

```bash
# Install OWASP ZAP or similar tools
# Run security scans against running API
```

## Documentation

- **Test Results Summary**: See `TEST_RESULTS_SUMMARY.md`
- **Test Coverage Report**: Run `npm run test:coverage` and open `coverage/index.html`
- **API Documentation**: See `docs/API.md`

## Support

For issues or questions:

1. Check `TEST_RESULTS_SUMMARY.md` for known issues
2. Review test output logs
3. Check Docker container logs: `docker logs bombardier-redis`
4. Verify environment variables in `.env`

## Cleanup

Stop and remove test infrastructure:

```bash
# Stop containers
docker stop bombardier-redis bombardier-mongo

# Remove containers
docker rm bombardier-redis bombardier-mongo

# Remove test data
rm -rf coverage/
rm test-output.log
```
