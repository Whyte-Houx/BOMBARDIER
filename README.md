# 🚀 Bombardier

**AI-Powered Target Acquisition & Engagement Platform**

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)]()
[![Test Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen)]()
[![Version](https://img.shields.io/badge/version-1.0.0-blue)]()
[![License](https://img.shields.io/badge/license-proprietary-red)]()

---

## 📋 Overview

**Bombardier** is an enterprise-grade automation platform for intelligent social media outreach. It combines AI-powered profile analysis with sophisticated anti-detection measures to enable scalable, personalized engagement across multiple platforms.

### Key Features

- 🎯 **Multi-Platform Acquisition** - Twitter, LinkedIn, Reddit, Instagram
- 🧠 **AI-Powered Analysis** - Bot detection, sentiment analysis, personality profiling
- 💬 **GPT-4 Message Generation** - Personalized, context-aware messaging
- 🎭 **Cloak Anti-Detection** - 10-module stealth infrastructure
- 📊 **Real-Time Analytics** - Campaign performance tracking
- 🎮 **Mission Control** - Flexible campaign orchestration (DR/IVM methods)
- 🔔 **Webhook Notifications** - HMAC-signed external event delivery
- 🔍 **Advanced Profile Filtering** - Boolean query language for complex searches
- ✅ **100% Test Coverage** - Comprehensive testing suite

---

## 🏗️ Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                    Frontend Dashboard                          │
│                    (Next.js @ :3000)                          │
└───────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────────┐
│                      Backend API                               │
│                    (Fastify @ :4050)                          │
└───────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  ML Service     │ │ Browser Service │ │ Mission Control │
│  (Python:5050)  │ │ (Playwright)    │ │ (Orchestrator)  │
└─────────────────┘ └─────────────────┘ └─────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────────┐
│                     Worker Pipeline                            │
│  Acquisition → Filtering → Research → Engagement → Tracking   │
└───────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────────┐
│                   🎭 Cloak Anti-Detection                      │
│  VPN • Proxy • Fingerprint • Location • Timing • Warming      │
└───────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20.x
- Docker & Docker Compose
- Python 3.11+ (for ML service)

### Installation

```bash
# 1. Clone repository
git clone <repo-url>
cd app-bombardier-version

# 2. Copy environment configuration
cp .env.example .env

# 3. Start infrastructure
docker-compose up -d mongodb redis

# 4. Start API server
docker-compose up -d api

# 5. Access the dashboard
open http://localhost:3000
```

### Development Mode

```bash
# Terminal 1: API
cd backend/api && npm install && npm run dev

# Terminal 2: Dashboard
cd frontend/dashboard && npm install && npm run dev

# Terminal 3: Workers
cd backend/workers && npm install && npm run dev
```

---

## 📁 Project Structure

```
app-bombardier-version/
├── backend/
│   ├── api/              # REST API (Fastify)
│   ├── browser-service/  # Playwright automation
│   ├── ml-service/       # Python ML (FastAPI)
│   ├── services/         # Business services
│   │   ├── mission-control/  # Campaign orchestration
│   │   └── cloak/            # Anti-detection (10 modules)
│   └── workers/          # Queue workers
├── frontend/
│   └── dashboard/        # Next.js dashboard
├── config/               # Configuration files
├── docs/                 # Documentation
│   ├── guides/          # User guides
│   ├── api/             # API documentation
│   ├── architecture/    # Technical architecture
│   └── testing/         # Testing documentation
├── tests/               # Test suites
│   ├── unit/           # Unit tests
│   ├── integration/    # Integration tests
│   ├── e2e/            # End-to-end tests
│   └── contracts/      # Contract tests
└── docker-compose.yml   # Full environment
```

---

## 🧪 Testing

**Current Status**: ✅ **100% Test Coverage** (41/41 tests passing)

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests
npm run test:integration

# Run with coverage report
npm run test:coverage

# Quick test runner
./run-tests.sh all
```

### Test Infrastructure Setup

```bash
# Automated setup
./setup-test-infrastructure.sh

# Manual setup
docker-compose up -d mongodb redis api
npm test
```

**See**: [Testing Guide](./docs/testing/TESTING.md) | [Test Results](./docs/testing/FINAL_TEST_RESULTS.md)

---

## 🎭 Cloak Anti-Detection System

The **Cloak** system provides enterprise-grade anti-detection:

| Module | Purpose |
|--------|---------|
| **Core** | Unified session management |
| **Leak Prevention** | WebRTC/DNS/IP blocking |
| **Location Spoof** | GPS, timezone, locale |
| **VPN Manager** | WireGuard, OpenVPN, VPN Gate |
| **Fingerprint** | Canvas, WebGL, Audio randomization |
| **Proxy Manager** | Rotation, health monitoring |
| **Proxy Scraper** | Free proxies + Tor integration |
| **Timing Engine** | Human-like behavioral pacing |
| **Account Warming** | Gradual automation ramp-up |

**See**: [Cloak System Documentation](./docs/architecture/CLOAK_SYSTEM.md)

---

## 🎮 Campaign Methods

### DR (Dating & Relationship)

Full engagement pipeline with deep personalization:

```
Acquisition → Filtering → Research → Engagement → Tracking
```

### IVM (Investment)

Lead qualification focused:

```
Acquisition → Research → Filtering
```

---

## 🌐 API Endpoints

> **API Version:** v1 | **Base URL:** `http://localhost:4050/v1`

| Endpoint | Description |
|----------|-------------|
| `POST /v1/auth/login` | User authentication |
| `POST /v1/auth/register` | User registration |
| `GET /v1/campaigns` | List campaigns |
| `POST /v1/campaigns` | Create campaign |
| `POST /v1/campaigns/:id/start` | Start campaign |
| `GET /v1/profiles` | List profiles |
| `POST /v1/profiles/advanced-search` | **NEW:** Boolean query filtering |
| `GET /v1/webhooks` | **NEW:** List webhooks |
| `POST /v1/webhooks` | **NEW:** Create webhook |
| `GET /v1/analytics/metrics` | Campaign analytics |
| `GET /v1/analytics/realtime` | Real-time stats |
| `GET /health` | System health check |

**See**: [API Documentation](./frontend/dev-docs/api_reference.md)

---

## 📊 Dashboard

Access the dashboard at `http://localhost:3000`:

- **Campaigns** - Create, manage, monitor campaigns
- **Review** - Profile review with keyboard shortcuts
- **Analytics** - Real-time performance metrics
- **Cloak** - Anti-detection system control

**See**: [User Guide](./docs/guides/USER_GUIDE.md)

---

## 📚 Documentation

### Getting Started

- [Quick Start Guide](./docs/guides/QUICK_START.md)
- [Installation Guide](./docs/guides/INSTALLATION.md)
- [User Guide](./docs/guides/USER_GUIDE.md)

### Development

- [Development Guide](./docs/guides/DEVELOPMENT.md)
- [API Documentation](./docs/api/README.md)
- [Architecture Overview](./docs/architecture/OVERVIEW.md)

### Testing

- [Testing Guide](./docs/testing/TESTING.md)
- [Test Results (100%)](./docs/testing/FINAL_TEST_RESULTS.md)
- [Testing Quick Start](./docs/testing/TESTING_QUICKSTART.md)

### Deployment

- [Deployment Guide](./docs/deployment/DEPLOYMENT_CHECKLIST.md)
- [Docker Configuration](./docs/deployment/DOCKER_GUIDE.md)

### System Documentation

- [Cloak Anti-Detection System](./docs/architecture/CLOAK_SYSTEM.md)
- [Worker Pipeline](./docs/architecture/WORKER_PIPELINE.md)
- [Security Model](./docs/architecture/SECURITY.md)

---

## 🔒 Security

- JWT authentication with rotating keys
- OAuth 2.0 (Google, GitHub)
- Role-based access control (RBAC)
- Encrypted credential storage
- Secure cookie handling
- Anti-detection measures
- **API Versioning** - `/v1` prefix with deprecation headers
- **Webhook Signing** - HMAC-SHA256 payload verification

---

## 📈 Project Status

**Overall Completion: 100%** | **Test Coverage: 100%** ✅

| Area | Status | Coverage |
|------|--------|----------|
| Core Infrastructure | ✅ 100% | - |
| Anti-Detection | ✅ 100% | - |
| AI/ML Integration | ✅ 100% | - |
| Worker Pipeline | ✅ 100% | - |
| Frontend | ✅ 100% | - |
| Testing | ✅ 100% | 41/41 tests |

**Last Updated**: December 10, 2025

---

## 🐳 Docker Services

```bash
# Start everything
docker-compose up -d

# Start specific services
docker-compose up -d api dashboard mongodb redis

# View logs
docker-compose logs -f api

# Rebuild
docker-compose build --no-cache api

# Stop all services
docker-compose down
```

---

## 🛠️ Troubleshooting

### Common Issues

**Tests failing with ECONNREFUSED**

```bash
# Start the API server
docker-compose up -d api
```

**Port already in use**

```bash
# Check what's using the port
lsof -i :4050

# Stop conflicting containers
docker-compose down
```

**Docker not responding**

```bash
# Restart Docker Desktop
killall Docker && open -a Docker
```

**See**: [Troubleshooting Guide](./docs/guides/TROUBLESHOOTING.md)

---

## 📝 License

Proprietary - All Rights Reserved

---

## 🤝 Contributing

Internal development only. Contact project leads for access.

---

## 📞 Support

For issues or questions:

1. Check the [documentation](./docs/)
2. Review [test results](./docs/testing/FINAL_TEST_RESULTS.md)
3. Check [troubleshooting guide](./docs/guides/TROUBLESHOOTING.md)
4. Contact development team

---

**Built with ❤️ for intelligent automation**

Last updated: December 10, 2024
