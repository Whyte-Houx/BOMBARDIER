# Developer Blueprint: Bombardier V2 Frontend

> **Target Stack:** Next.js (React), TypeScript, TailwindCSS, Framer Motion (Animations), Recharts (Data).
> **Objective:** Build the "Neon Command" ChatOps Interface.

---

## 1. Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── chat/
│   │   │   ├── CommandInput.tsx       # The main input bar
│   │   │   ├── MessageStream.tsx      # The scrollable container
│   │   │   ├── Bubbles/               # Different message types
│   │   │   │   ├── TextBubble.tsx
│   │   │   │   ├── SystemAlert.tsx
│   │   │   │   └── InteractiveCard.tsx
│   │   ├── widgets/                   # Embedded functionality
│   │   │   ├── CampaignWizard.tsx
│   │   │   ├── LiveLog.tsx
│   │   │   └── CloakStatus.tsx
│   │   └── layout/
│   │       ├── HUD.tsx                # Right sidebar (Stats)
│   │       └── BackgroundLoom.tsx     # WebGL/Canvas visualizer
│   ├── hooks/
│   │   ├── useSocket.ts               # WebSocket manager
│   │   ├── useCommand.ts              # NLP/Slash command parser
│   │   └── useSystemStatus.ts         # Polling /health/detailed
│   ├── store/
│   │   └── useChatStore.ts            # Zustand store for message history
│   └── styles/
│       └── theme.ts                   # Tailwind config extensions
```

---

## 2. Component Specifications

### A. `<CommandInput />`

* **Props:** `onSend: (text: string) => void`, `isProcessing: boolean`
* **State:** `inputValue`
* **Behavior:**
  * On `Enter`: Emits event.
  * Supports "Slash Commands" (type `/` to see popup menu).
  * **Auto-Complete:** Suggests campaigns or profiles based on typing.

### B. `<MessageStream />`

* **Props:** `messages: Message[]`
* **Interface Message:**

    ```typescript
    interface Message {
      id: string;
      sender: "user" | "system";
      type: "text" | "alert" | "widget";
      content: string; // or JSON data for widgets
      timestamp: number;
      component?: React.FC; // Dynamic component rendering
    }
    ```

* **Behavior:** Auto-scroll to bottom. "Typing..." indicators for AI latency.

### C. `<CampaignWizard />` (Interactive Widget)

* **Usage:** Renders *inside* the chat stream when user asks to create campaign.
* **State:** Form data (Name, Platforms[], Keywords[]).
* **API Interactions:**
  * `POST /campaigns` (on submit)
  * `POST /campaigns/:id/start` (after creation)
* **Visuals:**
  * Multi-step "Wizard" feel but compact.
  * Success state: Transforms into a `<CampaignStatusCard />`.

### D. `<HUD />` (Heads-Up Display)

* **Data Source:** `/metrics` and `/health/detailed`
* **Refresh Rate:** 5s
* **Sections:**
    1. **System:** CPU/RAM, API Latency (ms).
    2. **Workers:** Active threads count, Queue depth.
    3. **Cloak:** Current IP, Proxy Success Rate (%).

---

## 3. State Management & Event Flow

### Scenario: User types "Start campaign"

1. **UI:** `CommandInput` fires `onSend("Start campaign")`.
2. **Logic:** `useCommand` parses intent -> Identifies `INTENT_CREATE_CAMPAIGN`.
3. **UI:** Append `Message` (User: "Start campaign") to Store.
4. **UI:** Append `Message` (System: Widget) to Store.
    * `type: 'widget'`, `component: 'CampaignWizard'`
5. **User:** Fills out Wizard card in the stream.
6. **Action:** Clicks "Deploy".
7. **API:** Calls `Pipeline` endpoint (`POST /pipeline/run`).
8. **Response:** API returns `{ campaignId: "123" }`.
9. **UI:** Wizard card updates to "Success" state.
10. **Socket:** Subscribes to `creation-log-${campaignId}` via WebSocket.
11. **UI:** Appends `LiveLog` widget to stream showing initial scraper output.

---

## 4. Styling System (Tailwind Token Map)

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        void: "#050505",
        surface: "#0A0A0A",
        surfaceHighlight: "#141414",
        neon: {
          green: "#00FF94",
          red: "#FF0055",
          purple: "#7000FF",
          blue: "#00E0FF"
        }
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace'],
        display: ['"Inter"', 'sans-serif']
      },
      boxShadow: {
        'glow-green': '0 0 20px rgba(0, 255, 148, 0.3)',
        'glow-red': '0 0 20px rgba(255, 0, 85, 0.3)',
      }
    }
  }
}
```

---

## 5. Interaction Rules

1. **No Dead Ends:** Every error message (red bubble) must include a "Retry" or "Fix" action button.
2. **Optimistic UI:** When a user sends a command, show it immediately. Don't wait for server ack.
3. **Skeleton Loading:** Use "shimmering" text lines for AI responses while calculating.
4. **Notifications:** Critical alerts (Proxy ban, Auth failure) trigger a `Toast` notification (top-right) AND a chat message.

---

## 6. Implementation Roadmap

1. **Phase 1: Shell & Connection**
    * Setup Next.js + Tailwind.
    * Implement `useSocket` to connect to backend.
    * Build `CommandInput` and basic `MessageStream`.

2. **Phase 2: The Brain**
    * Implement Command Parser (Regex/Keyword matching first).
    * Map `/start`, `/help`, `/status` to API calls.

3. **Phase 3: Widgets**
    * Build `CampaignWizard` (Forms).
    * Build `LiveLog` (Terminal-like view).
    * Build `HUD` (Stats sidebar).

4. **Phase 4: Polish**
    * Add Framer Motion entrance animations for messages.
    * Implement the "Glow" effects.
    * Sound effects (optional).
