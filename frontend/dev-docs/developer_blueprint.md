# Developer Blueprint: Bombardier Frontend v2.0

> **Stack:** Next.js 14, TypeScript, TailwindCSS, Zustand, Framer Motion
> **Objective:** Production-ready "Neon Command" ChatOps Interface
> **Last Updated:** December 10, 2024

---

## 1. Project Structure

```
frontend/
├── public/
│   └── assets/
│       ├── logo.svg              # Main logo
│       ├── app-home.svg          # Reference layout
│       ├── mockup.svg            # UI reference
│       └── icons/                # UI icons
│
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── layout.tsx            # Root layout + providers
│   │   ├── page.tsx              # Main command interface
│   │   ├── login/page.tsx        # Login page
│   │   └── globals.css           # Global styles
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.tsx      # Main layout wrapper
│   │   │   ├── Header.tsx        # Top navigation bar
│   │   │   ├── HUD.tsx           # Right sidebar stats
│   │   │   └── CommandInput.tsx  # Bottom input bar
│   │   │
│   │   ├── stream/
│   │   │   ├── MessageStream.tsx # Scrollable message list
│   │   │   ├── Message.tsx       # Base message component
│   │   │   ├── TextBubble.tsx    # Plain text message
│   │   │   ├── AlertBubble.tsx   # Error/warning message
│   │   │   └── WidgetBubble.tsx  # Interactive card container
│   │   │
│   │   ├── widgets/
│   │   │   ├── CampaignWizard.tsx    # New campaign form
│   │   │   ├── ProfileCard.tsx       # Profile review card
│   │   │   ├── LiveFeed.tsx          # Real-time log viewer
│   │   │   ├── AnalyticsChart.tsx    # Embedded chart
│   │   │   └── CloakStatus.tsx       # Anti-detection status
│   │   │
│   │   ├── settings/
│   │   │   ├── SettingsModal.tsx     # Full-screen settings
│   │   │   ├── AccountSettings.tsx   # Account tab
│   │   │   ├── AuthSettings.tsx      # Auth configuration
│   │   │   ├── OAuthSettings.tsx     # OAuth connections
│   │   │   ├── ApiKeySettings.tsx    # API key management
│   │   │   ├── CloakSettings.tsx     # Proxy/VPN config
│   │   │   ├── WorkerSettings.tsx    # Worker status
│   │   │   └── DisplaySettings.tsx   # Theme preferences
│   │   │
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       ├── Select.tsx
│   │       ├── Badge.tsx
│   │       ├── Toast.tsx
│   │       └── Skeleton.tsx
│   │
│   ├── hooks/
│   │   ├── useSocket.ts          # WebSocket management
│   │   ├── useCommand.ts         # Command parsing logic
│   │   ├── useApi.ts             # API client wrapper
│   │   ├── useAuth.ts            # Auth state & actions
│   │   └── useSystemStatus.ts    # Health/metrics polling
│   │
│   ├── stores/
│   │   ├── useChatStore.ts       # Message history
│   │   ├── useAuthStore.ts       # User & session
│   │   ├── useSettingsStore.ts   # User preferences
│   │   └── useSystemStore.ts     # Worker/cloak status
│   │
│   ├── lib/
│   │   ├── api.ts                # Axios instance + interceptors
│   │   ├── socket.ts             # WebSocket client
│   │   ├── commands.ts           # Slash command definitions
│   │   └── constants.ts          # App-wide constants
│   │
│   └── types/
│       ├── api.ts                # API response types
│       ├── message.ts            # Message interfaces
│       └── campaign.ts           # Campaign/profile types
│
├── tailwind.config.ts            # Tailwind + theme tokens
├── next.config.js
└── package.json
```

---

## 2. Component Specifications

### 2.1 AppShell

```typescript
// src/components/layout/AppShell.tsx
interface AppShellProps {
  children: React.ReactNode;
}

// State: isHudCollapsed, isSettingsOpen
// Refs: streamRef (for scroll control)
```

**Layout ASCII:**

```
┌────────────────────────────────────────────────────────┐
│ <Header />                                             │
├──────────────────────────────────────────────┬─────────┤
│                                              │         │
│ <MessageStream />                            │ <HUD /> │
│                                              │         │
├──────────────────────────────────────────────┴─────────┤
│ <CommandInput />                                       │
└────────────────────────────────────────────────────────┘
```

---

### 2.2 Header

```typescript
interface HeaderProps {
  user: User | null;
  isConnected: boolean;
  unreadCount: number;
  onSettingsClick: () => void;
  onLogout: () => void;
}
```

**Elements:**

- Logo (SVG import from `public/assets/logo.svg`)
- Connection indicator (green dot pulsing when connected)
- Notification bell with badge
- Settings gear button
- User avatar dropdown

---

### 2.3 MessageStream

```typescript
interface MessageStreamProps {
  messages: Message[];
  isLoading: boolean;
}

interface Message {
  id: string;
  sender: 'user' | 'system';
  type: 'text' | 'alert' | 'widget';
  content: string | object;
  timestamp: Date;
  widgetType?: 'campaign-wizard' | 'profile-card' | 'live-feed' | 'chart';
  widgetProps?: Record<string, any>;
  status?: 'sending' | 'sent' | 'error';
}
```

**Behavior:**

- Auto-scroll to bottom when new messages arrive
- Scroll up for history (lazy load)
- Render appropriate bubble based on `type`
- If `type === 'widget'`, dynamically render component from `widgetType`

---

### 2.4 CommandInput

```typescript
interface CommandInputProps {
  onSend: (text: string) => void;
  isProcessing: boolean;
  disabled: boolean;
}

// Local state: inputValue, showSuggestions, suggestions[]
```

**Features:**

1. On `/` key: Show slash command suggestions
2. On `Enter`: Fire `onSend`, clear input
3. On `Shift+Enter`: New line (multiline support)
4. File attachment button (for proxy lists, etc.)

**Slash Commands:**

```typescript
const COMMANDS = [
  { trigger: '/start', description: 'Start a new campaign', action: 'SHOW_CAMPAIGN_WIZARD' },
  { trigger: '/status', description: 'Show campaign status', action: 'FETCH_STATUS' },
  { trigger: '/profiles', description: 'List pending profiles', action: 'LIST_PROFILES' },
  { trigger: '/cloak', description: 'Show cloak status', action: 'SHOW_CLOAK' },
  { trigger: '/settings', description: 'Open settings', action: 'OPEN_SETTINGS' },
  { trigger: '/help', description: 'Show help', action: 'SHOW_HELP' },
];
```

---

### 2.5 HUD (Heads-Up Display)

```typescript
interface HUDProps {
  workerStatus: WorkerStatus[];
  cloakStatus: CloakStatus;
  queueDepth: number;
  activeCampaign: Campaign | null;
}

interface WorkerStatus {
  name: string;
  status: 'running' | 'idle' | 'error';
  lastHeartbeat: Date;
}

interface CloakStatus {
  proxiesOk: boolean;
  vpnActive: boolean;
  noLeaks: boolean;
  currentIp: string;
}
```

**Sections:**

1. Worker heartbeats (colored dots)
2. Cloak health (checkmarks/warnings)
3. Queue depth (progress bar)
4. Active campaign summary

**Data Source:** Poll `/health/detailed` every 5s + WebSocket events

---

### 2.6 CampaignWizard

```typescript
interface CampaignWizardProps {
  onSubmit: (data: CampaignFormData) => Promise<void>;
  onCancel: () => void;
  initialData?: Partial<CampaignFormData>;
}

interface CampaignFormData {
  name: string;
  platforms: ('twitter' | 'linkedin' | 'reddit' | 'instagram')[];
  keywords: string[];
  location?: string;
  followersMin?: number;
  followersMax?: number;
  ageRangeMin?: number;
  ageRangeMax?: number;
}
```

**API Calls:**

1. `POST /campaigns` (create draft)
2. `POST /campaigns/:id/start` (activate)

**States:**

- `idle` → `submitting` → `success` | `error`
- On success: Collapse into status badge

---

### 2.7 ProfileCard

```typescript
interface ProfileCardProps {
  profile: Profile;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string, reason?: string) => Promise<void>;
  onViewDetails: (id: string) => void;
}

interface Profile {
  id: string;
  platform: string;
  username: string;
  displayName: string;
  bio: string;
  followers: number;
  following: number;
  posts: number;
  interests: string[];
  qualityScore: number;
  botProbability: number;
  status: 'pending' | 'approved' | 'rejected' | 'engaged';
}
```

**API Calls:**

- `POST /profiles/:id/approve`
- `POST /profiles/:id/reject`

---

### 2.8 LiveFeed

```typescript
interface LiveFeedProps {
  campaignId: string;
  maxLines?: number;
  onClose: () => void;
}

// Uses WebSocket: /tracking/ws
// Filters events by campaignId
```

**Log Format:**

```
HH:MM:SS  [STAGE] Message
14:32:01  [ACQ] Scraped @username
14:32:02  [FLT] @username passed (score: 89)
```

---

## 3. State Management

### 3.1 Chat Store (Zustand)

```typescript
interface ChatState {
  messages: Message[];
  isLoading: boolean;
  addMessage: (msg: Message) => void;
  addSystemMessage: (content: string, type?: 'text' | 'alert') => void;
  addWidget: (widgetType: string, props: object) => void;
  clearMessages: () => void;
}
```

### 3.2 Auth Store

```typescript
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
}
```

### 3.3 System Store

```typescript
interface SystemState {
  isConnected: boolean;
  workers: WorkerStatus[];
  cloak: CloakStatus;
  queueDepth: number;
  setConnected: (val: boolean) => void;
  updateWorkers: (workers: WorkerStatus[]) => void;
  updateCloak: (cloak: CloakStatus) => void;
}
```

---

## 4. Event Flow Diagrams

### 4.1 Starting a Campaign

```
User                    Frontend                    Backend
 │                          │                          │
 │ Types "/start"           │                          │
 │ ─────────────────────────>                          │
 │                          │                          │
 │ Renders CampaignWizard   │                          │
 │ <─────────────────────────                          │
 │                          │                          │
 │ Fills form, clicks Deploy│                          │
 │ ─────────────────────────>                          │
 │                          │                          │
 │                          │ POST /pipeline/run       │
 │                          │ ─────────────────────────>
 │                          │                          │
 │                          │ { campaignId: "123" }    │
 │                          │ <─────────────────────────
 │                          │                          │
 │ Wizard transforms to     │                          │
 │ status card              │                          │
 │ <─────────────────────────                          │
 │                          │                          │
 │                          │ Subscribes to WS:        │
 │                          │ campaignId="123"         │
 │                          │ ─────────────────────────>
 │                          │                          │
 │ Live feed appears        │ Events stream in         │
 │ <─────────────────────────  <─────────────────────── │
```

### 4.2 Profile Review Flow

```
User                    Frontend                    Backend
 │                          │                          │
 │ Views profile card       │                          │
 │                          │                          │
 │ Clicks [Approve]         │                          │
 │ ─────────────────────────>                          │
 │                          │                          │
 │                          │ POST /profiles/:id/approve
 │                          │ ─────────────────────────>
 │                          │                          │
 │                          │ { status: "approved" }   │
 │                          │ <─────────────────────────
 │                          │                          │
 │ Card animates out        │                          │
 │ <─────────────────────────                          │
 │                          │                          │
 │ Next profile loads       │                          │
 │ <─────────────────────────                          │
```

### 4.3 Real-Time Status Update

```
Backend                   WebSocket                  Frontend
 │                          │                          │
 │ Worker processes job     │                          │
 │ ─────────────────────────>                          │
 │                          │ Event: { type: "acq",    │
 │                          │   profile: "@user" }     │
 │                          │ ─────────────────────────>
 │                          │                          │
 │                          │                          │
 │                          │  HUD updates queue depth │
 │                          │  LiveFeed appends log    │
 │                          │  ────────────────────────>
```

---

## 5. API Integration

### 5.1 API Client Setup

```typescript
// src/lib/api.ts
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4050/v1',
  timeout: 10000,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Attempt token refresh or redirect to login
    }
    return Promise.reject(error);
  }
);

export default api;
```

### 5.2 WebSocket Setup

```typescript
// src/lib/socket.ts
class SocketClient {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Function[]> = new Map();

  connect(token: string) {
    this.ws = new WebSocket(`ws://localhost:4050/tracking/ws`);
    
    this.ws.onopen = () => {
      this.emit('connected', true);
    };
    
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.emit('event', data);
    };
    
    this.ws.onclose = () => {
      this.emit('connected', false);
      // Reconnect logic
    };
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  private emit(event: string, data: any) {
    this.listeners.get(event)?.forEach(cb => cb(data));
  }
}

export const socket = new SocketClient();
```

---

## 6. Tailwind Configuration

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        void: '#050505',
        surface: {
          DEFAULT: '#0A0A0A',
          hover: '#141414',
          border: '#1A1A1A',
        },
        neon: {
          green: '#00FF94',
          red: '#FF0055',
          purple: '#7000FF',
          blue: '#00E0FF',
          orange: '#FF9500',
        },
      },
      fontFamily: {
        display: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'glow-green': '0 0 20px rgba(0, 255, 148, 0.3)',
        'glow-red': '0 0 20px rgba(255, 0, 85, 0.3)',
        'glow-purple': '0 0 20px rgba(112, 0, 255, 0.3)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-up': 'slideUp 0.2s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
```

---

## 7. Interaction Rules

### 7.1 Loading States

| Component | Loading Behavior |
|-----------|-----------------|
| MessageStream | Skeleton shimmer for pending messages |
| CampaignWizard | Button spinner, disabled inputs |
| ProfileCard | Overlay with spinner on action |
| HUD | Pulsing placeholder bars |

### 7.2 Error Handling

| Error Type | UI Response |
|------------|-------------|
| Network failure | Toast + retry button |
| 401 Unauthorized | Redirect to login |
| 403 Forbidden | Alert bubble in stream |
| 429 Rate Limited | Toast with countdown |
| 500 Server Error | Alert bubble + retry |

### 7.3 Optimistic Updates

- When user sends a command, show it immediately in stream
- If API fails, mark message with error state
- Profile approve/reject: Update UI first, revert on failure

---

## 8. Implementation Roadmap

### Phase 1: Foundation (Week 1)

- [ ] Next.js project setup with Tailwind
- [ ] AppShell, Header, basic routing
- [ ] Auth flow (login page, token storage)
- [ ] API client with interceptors

### Phase 2: Core Interface (Week 2)

- [ ] MessageStream component
- [ ] CommandInput with slash commands
- [ ] WebSocket connection
- [ ] HUD with mock data

### Phase 3: Widgets (Week 3)

- [ ] CampaignWizard (full form)
- [ ] ProfileCard (approve/reject)
- [ ] LiveFeed (WebSocket integration)
- [ ] Connect to real API endpoints

### Phase 4: Settings & Polish (Week 4)

- [ ] Full settings modal with all tabs
- [ ] Toast notification system
- [ ] Framer Motion animations
- [ ] Responsive breakpoints
- [ ] Accessibility audit

### Phase 5: Integration Testing (Week 5)

- [ ] End-to-end flow testing
- [ ] Error scenario testing
- [ ] Performance optimization
- [ ] Production deployment prep
