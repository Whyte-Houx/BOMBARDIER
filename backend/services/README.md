# Anti-Detection Services & Mission Control Setup

This guide covers the setup and configuration of the Phase 1 anti-detection services and the Mission Control orchestration layer.

## Services Overview

### 1. Mission Control (Orchestrator) 🎮

**Purpose:** Manages "Bombing Methods" (DR, IVM) and orchestrates the workflow between services.  
**Location:** `backend/services/mission-control/`  
**Dependencies:** Redis  
**Functions:**

- Receives Mission Config
- Determines Workflow (e.g., DR: `acquisition` -> `filtering` -> `research` -> `engagement`)
- Dispatches jobs to appropriate queues

### 2. Proxy Manager 🛡️

**Purpose:** Sophisticated proxy rotation with health monitoring  
**Location:** `backend/services/cloak/proxy-manager/`  
**Dependencies:** Redis

### 3. Fingerprint Engine 🆔

**Purpose:** Advanced browser fingerprint generation  
**Location:** `backend/services/cloak/fingerprint/`  
**Dependencies:** Playwright

### 4. Cloak Core 🎭

**Purpose:** Unified session management and leak prevention APIs  
**Location:** `backend/services/cloak/core/`

---

## Installation

### Prerequisites

- Node.js 20.x
- Docker & Docker Compose
- Redis (via Docker)

### Step 1: Install Dependencies

```bash
# Install dependencies for mission control
cd backend/services/mission-control && npm install
```

### Step 2: Build and Start

```bash
# Build all services including mission control
docker-compose build

# Start services
docker-compose up -d
```

---

## Bombing Methods (Mission Control)

The system supports two primary bombing methods orchestrated by Mission Control:

### 1. DR (Dating & Relationship) Method

**Flow:** `Acquisition` -> `Filtering` -> `Research` -> `Engagement` -> `Tracking`

- Uses all services.
- Focuses on deep engagement and tracking.

### 2. IVM (Investment) Method

**Flow:** `Acquisition` -> `Research` -> `Filtering` -> (Engagement Optional)

- Focuses on acquiring and qualifying leads.

---

## Triggering a Mission

To start a campaign, push a JSON payload to Redis queue `queue:mission-control:start`:

```json
{
  "campaignId": "camp_123",
  "method": "DR",
  "targetCriteria": {
    "interests": ["tech", "ai"]
  },
  "cloakConfig": {
    "location": "US"
  }
}
```

Or usage via code:

```typescript
import { MissionOrchestrator, BombingMethod } from './backend/services/mission-control/src/orchestrator';

const mc = new MissionOrchestrator(REDIS_URL);
await mc.startMission({
    campaignId: 'test_1',
    method: BombingMethod.DR,
    targetCriteria: {}
});
```
