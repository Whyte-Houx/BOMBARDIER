# 🚀 Bombardier

**AI-Powered Target Acquisition & Engagement Platform**

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)]()
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

# 4. Start all services
docker-compose up -d

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
│   │   ├── cloak/            # Anti-detection (10 modules)
│   │   └── ...               # acquisition, filtering, etc.
│   └── workers/          # Queue workers
├── frontend/
│   └── dashboard/        # Next.js dashboard
├── config/               # Configuration files
├── docs/                 # Documentation
├── tests/                # Test suites
└── docker-compose.yml    # Full environment
```

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

[📖 Full Cloak Documentation](./CLOAK_SYSTEM.md)

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

| Endpoint | Description |
|----------|-------------|
| `POST /auth/login` | User authentication |
| `GET /campaigns` | List campaigns |
| `POST /campaigns` | Create campaign |
| `POST /campaigns/:id/start` | Start campaign |
| `GET /profiles` | List profiles |
| `GET /analytics` | Campaign analytics |
| `GET /cloak/status` | Cloak system status |

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
```

---

## 📊 Dashboard

Access the dashboard at `http://localhost:3000`:

- **Campaigns** - Create, manage, monitor campaigns
- **Review** - Profile review with keyboard shortcuts
- **Analytics** - Real-time performance metrics
- **Cloak** - Anti-detection system control

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific tests
npm test tests/integration/anti-detection.test.ts

# Run with coverage
npm run test:coverage
```

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [PROJECT_STATUS.md](./PROJECT_STATUS.md) | Complete system review |
| [CLOAK_SYSTEM.md](./CLOAK_SYSTEM.md) | Anti-detection documentation |
| [USER_FLOW.md](./USER_FLOW.md) | System flow diagrams |
| [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) | Deployment guide |

---

## 🔒 Security

- JWT authentication with rotating keys
- OAuth 2.0 (Google, GitHub)
- Role-based access control (RBAC)
- Encrypted credential storage
- Secure cookie handling

---

## 📈 Project Status

**Overall Completion: 82%**

| Area | Status |
|------|--------|
| Core Infrastructure | ✅ 95% |
| Anti-Detection | ✅ 95% |
| AI/ML Integration | ✅ 95% |
| Worker Pipeline | ✅ 90% |
| Frontend | ✅ 85% |
| Testing | ⚠️ 75% |

---

## 📝 License

Proprietary - All Rights Reserved

---

## 🤝 Contributing

Internal development only. Contact project leads for access.

---

**Built with ❤️ for intelligent automation**
