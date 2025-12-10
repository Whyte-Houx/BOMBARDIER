# UI/UX Concept: "Neon Command" v2.0

> **Design Philosophy:** "The Interface is the Agent"
> **Target:** Single-page ChatOps interface
> **Style:** Cybernetic Dark Mode / Tactical Operations Center

---

## 1. Core Design Principles

### 1.1 Unified Stream Architecture

All interactions happen in a **single chronological stream**. No page navigation, no modal hell.

```
┌─────────────────────────────────────────────────────────────────────┐
│  ┌─────────┐                    NEON COMMAND                    [≡] │
│  │ LOGO    │           [ Status: CONNECTED ]                        │
├──┴─────────┴────────────────────────────────────────────────────────┤
│                                                          ┌─────────┐│
│  ╔═══════════════════════════════════════════════════╗   │   HUD   ││
│  ║  THE STREAM (Main Content Area)                   ║   │─────────││
│  ║                                                   ║   │ Workers ││
│  ║  [System] Welcome, Operator. Type /help.          ║   │  ●●●●●  ││
│  ║                                                   ║   │─────────││
│  ║  [User] Start a new campaign                      ║   │ Cloak   ││
│  ║                                                   ║   │  ✓ Safe ││
│  ║  [System] ┌────────────────────────────────────┐  ║   │─────────││
│  ║           │   CAMPAIGN WIZARD [Interactive]   │  ║   │ Proxies ││
│  ║           │   Name: [________________]        │  ║   │  22/25  ││
│  ║           │   Platforms: [Twitter] [LinkedIn] │  ║   │─────────││
│  ║           │   [Deploy Campaign]               │  ║   │ Queue   ││
│  ║           └────────────────────────────────────┘  ║   │   147   ││
│  ║                                                   ║   │         ││
│  ╚═══════════════════════════════════════════════════╝   └─────────┘│
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │ > Type a command or message...                         [⚡][⚙️] ││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Message Types in Stream

| Type | Visual | Purpose |
|------|--------|---------|
| **Text** | Plain bubble | Info, confirmations |
| **Alert** | Red border, icon | Errors, warnings |
| **Widget** | Interactive card | Forms, controls |
| **Live Feed** | Scrolling terminal | Real-time logs |
| **Chart** | Embedded visualization | Analytics |

---

## 2. Visual Identity

### 2.1 Color System

```css
/* Core Palette */
--void:           #050505;    /* True black background */
--surface:        #0A0A0A;    /* Elevated surfaces */
--surface-hover:  #141414;    /* Interactive hover */
--border:         #1A1A1A;    /* Subtle borders */
--text-primary:   #FFFFFF;    /* Main text */
--text-secondary: #888888;    /* Muted text */

/* Accent Colors */
--neon-green:     #00FF94;    /* Success, active, primary */
--neon-red:       #FF0055;    /* Errors, alerts, danger */
--neon-purple:    #7000FF;    /* AI actions, intelligence */
--neon-blue:      #00E0FF;    /* Links, info */
--neon-orange:    #FF9500;    /* Warnings */

/* Glow Effects */
--glow-green:     0 0 20px rgba(0, 255, 148, 0.3);
--glow-red:       0 0 20px rgba(255, 0, 85, 0.3);
```

### 2.2 Typography

```css
/* Font Stack */
--font-display:   'Inter', -apple-system, sans-serif;
--font-mono:      'JetBrains Mono', 'Fira Code', monospace;

/* Scale */
--text-xs:        0.75rem;   /* 12px */
--text-sm:        0.875rem;  /* 14px */
--text-base:      1rem;      /* 16px */
--text-lg:        1.125rem;  /* 18px */
--text-xl:        1.5rem;    /* 24px */
--text-2xl:       2rem;      /* 32px */

/* Weights */
--font-normal:    400;
--font-medium:    500;
--font-bold:      700;
```

### 2.3 Spacing & Sizing

```css
/* Spacing Scale */
--space-1:  0.25rem;  /* 4px  */
--space-2:  0.5rem;   /* 8px  */
--space-3:  0.75rem;  /* 12px */
--space-4:  1rem;     /* 16px */
--space-6:  1.5rem;   /* 24px */
--space-8:  2rem;     /* 32px */
--space-12: 3rem;     /* 48px */

/* Border Radius */
--radius-sm:  4px;
--radius-md:  8px;
--radius-lg:  12px;
--radius-xl:  16px;
--radius-full: 9999px;

/* Shadows */
--shadow-sm:  0 1px 2px rgba(0,0,0,0.5);
--shadow-md:  0 4px 12px rgba(0,0,0,0.4);
--shadow-lg:  0 8px 24px rgba(0,0,0,0.5);
```

---

## 3. Key Interface Regions

### 3.1 Header Bar

```
┌─────────────────────────────────────────────────────────────────────┐
│  [LOGO]  BOMBARDIER          [● Connected]     [🔔]  [⚙️]  [👤]    │
└─────────────────────────────────────────────────────────────────────┘

Components:
- Logo (from image-files/logo.svg)
- Connection status indicator (WebSocket state)
- Notification bell (unread count badge)
- Settings gear (opens settings panel)
- User avatar (dropdown: profile, logout)
```

### 3.2 The Stream (Main Content)

- Vertically scrolling message container
- Auto-scroll to bottom on new messages
- Infinite scroll up for history
- Message grouping by time

### 3.3 HUD (Heads-Up Display)

```
┌─────────────────┐
│   SYSTEM HUD    │
├─────────────────┤
│ Workers         │
│ ● Acquisition   │
│ ● Filtering     │
│ ● Research      │
│ ○ Engagement    │
│ ● Tracking      │
├─────────────────┤
│ Cloak Status    │
│ ✓ Proxies OK    │
│ ✓ VPN Active    │
│ ✓ No Leaks      │
├─────────────────┤
│ Queue Depth     │
│ ███████░░ 147   │
├─────────────────┤
│ Active Campaign │
│ "Tech Leaders"  │
│ 2,340 profiles  │
└─────────────────┘
```

### 3.4 Command Input

```
┌─────────────────────────────────────────────────────────────────────┐
│  > /start campaign "Tech Leaders" twitter --location=SF            │
│    ↑                                                    [📎] [🚀]  │
│    Slash command auto-complete                                      │
└─────────────────────────────────────────────────────────────────────┘

Features:
- Slash command parsing (/start, /status, /help, /settings)
- Natural language understanding
- File attachment (for proxy lists, etc.)
- Send button with loading state
```

---

## 4. Interactive Widgets (In-Stream)

### 4.1 Campaign Wizard

```
┌──────────────────────────────────────────────────────────────────┐
│  🚀 NEW CAMPAIGN                                           [×]  │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Campaign Name    [ Tech Leaders Q1 2025________________ ]       │
│                                                                   │
│  Target Platforms                                                 │
│  [✓] Twitter   [✓] LinkedIn   [ ] Reddit   [ ] Instagram        │
│                                                                   │
│  Target Criteria                                                  │
│  Keywords:   [ AI, Machine Learning, Startup ]                   │
│  Location:   [ San Francisco, CA                    ▼ ]          │
│  Followers:  [ 1,000 ] to [ 100,000 ]                            │
│                                                                   │
│  ─────────────────────────────────────────────────────────────   │
│                                                                   │
│  Advanced Settings                                         [▼]   │
│                                                                   │
├──────────────────────────────────────────────────────────────────┤
│  [Cancel]                           [Save Draft]  [🚀 Deploy]   │
└──────────────────────────────────────────────────────────────────┘
```

### 4.2 Profile Review Card

```
┌──────────────────────────────────────────────────────────────────┐
│  👤 @techfounder                                    PENDING      │
├──────────────────────────────────────────────────────────────────┤
│  Jane Doe • San Francisco, CA                                    │
│  "Building the future of AI. Ex-Google, Stanford CS."           │
│                                                                   │
│  Followers: 45.2K │ Following: 1.2K │ Posts: 3,421               │
│                                                                   │
│  Interests: [AI] [Startups] [Machine Learning] [Investing]      │
│                                                                   │
│  Quality Score: ████████░░ 82/100                                │
│  Bot Probability: ██░░░░░░░░ 12%                                 │
│                                                                   │
├──────────────────────────────────────────────────────────────────┤
│  [╳ Reject]            [View Profile]            [✓ Approve]    │
└──────────────────────────────────────────────────────────────────┘
```

### 4.3 Live Activity Feed

```
┌──────────────────────────────────────────────────────────────────┐
│  📡 LIVE FEED: "Tech Leaders"                     [Pause] [×]   │
├──────────────────────────────────────────────────────────────────┤
│  14:32:01  [ACQ] Scraped @ai_developer                           │
│  14:32:02  [FLT] @ai_developer passed quality check (89)         │
│  14:32:03  [RES] Extracted 12 interests from @ai_developer       │
│  14:32:05  [ENG] Message sent to @ai_developer                   │
│  14:32:08  [ACQ] Scraped @ml_engineer                            │
│  14:32:09  [FLT] ⚠ @ml_engineer flagged as bot (78%)            │
│  ...                                                             │
│  ▼ Auto-scrolling                                                │
└──────────────────────────────────────────────────────────────────┘
```

---

## 5. Settings Page

The settings page opens as a **full-screen overlay** with tabbed navigation.

```
┌──────────────────────────────────────────────────────────────────┐
│  [←]  SETTINGS                                            [×]   │
├───────────┬──────────────────────────────────────────────────────┤
│           │                                                      │
│ [Account] │  ACCOUNT SETTINGS                                    │
│ [Auth]    │  ───────────────────────────────────────────────    │
│ [OAuth]   │                                                      │
│ [API Keys]│  Email         [ operator@bombardier.io     ]       │
│ [Cloak]   │  Password      [ ●●●●●●●●●●●●  ] [Change]           │
│ [Proxies] │  Role          Admin                                 │
│ [Workers] │                                                      │
│ [Display] │  Two-Factor    [ Enabled ✓ ]                        │
│ [Danger]  │                                                      │
│           │  ───────────────────────────────────────────────    │
│           │                                                      │
│           │  Session Management                                  │
│           │  ┌────────────────────────────────────────────────┐ │
│           │  │ Chrome / macOS    Active now      [Revoke]    │ │
│           │  │ Firefox / Windows  2 hours ago    [Revoke]    │ │
│           │  └────────────────────────────────────────────────┘ │
│           │                                                      │
└───────────┴──────────────────────────────────────────────────────┘
```

### Settings Tabs

| Tab | Contents |
|-----|----------|
| **Account** | Email, password, 2FA, sessions |
| **Auth** | JWT settings, AUTH_DISABLED toggle (dev) |
| **OAuth** | Google, GitHub, Microsoft connection |
| **API Keys** | Create/revoke API keys, permissions |
| **Cloak** | Proxy config, VPN settings, location |
| **Proxies** | Proxy list management, health view |
| **Workers** | Worker status, queue depths, restart |
| **Display** | Theme, font size, animations |
| **Danger** | Delete account, clear data |

---

## 6. Brand & Reference Assets

### Available in `frontend/dev-docs/image-files/`

| File | Usage |
|------|-------|
| `logo.svg` | Header logo, loading screen |
| `dev-logo.svg` | Alternative development logo |
| `banner.svg` / `banner.png` | Marketing, README |
| `app-home.svg` | **Primary reference** for layout |
| `mockup.svg` / `mockup.png` | High-fidelity UI reference |
| `cl-market.svg` | Campaign/acquisition icon |
| `more-info.svg` | Help/info tooltips |

---

## 7. Animation & Micro-Interactions

### 7.1 Entrance Animations

- Stream messages: Fade up + slide from bottom (200ms)
- Widgets: Scale from 0.95 + fade (300ms)
- Alerts: Shake + glow pulse

### 7.2 Hover States

- Buttons: Background brightens, subtle glow
- Cards: Border illuminates, shadow deepens
- Links: Underline slides in from left

### 7.3 Loading States

- Skeleton shimmer for content loading
- Pulsing dots for AI "thinking"
- Spinning ring for network requests

---

## 8. Responsive Breakpoints

```css
/* Mobile First */
--bp-sm:  640px;   /* Phones */
--bp-md:  768px;   /* Tablets */
--bp-lg:  1024px;  /* Small laptops */
--bp-xl:  1280px;  /* Desktops */
--bp-2xl: 1536px;  /* Large screens */

/* Layout Rules */
< 768px:  HUD collapses to bottom sheet
< 1024px: Single column, stream only
≥ 1024px: Full layout with HUD sidebar
```
