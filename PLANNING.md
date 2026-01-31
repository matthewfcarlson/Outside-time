# Outside Time Tracker - Technical Planning Document

## Overview

This document outlines the technical architecture, data models, and implementation plan for Outside Time Tracker - an application to help users track and visualize their outdoor time throughout the year.

---

## Core Concepts

### Time Tracking Model

**10-Minute Chunks**: All time is tracked and displayed in 10-minute increments. This provides:
- Simplified data storage and visualization
- Encourages meaningful outdoor time (not just stepping outside briefly)
- Cleaner statistics and goal tracking

**Timer-Based Sessions**:
1. User taps "Go Outside" to start a timer
2. Timer runs until user taps "I'm Back Inside"
3. Time is rounded to nearest 10-minute chunk (minimum 10 minutes if any time recorded)
4. Multiple sessions per day are supported and aggregated

**Retroactive Adjustments**:
- Users can add past outdoor sessions manually
- Users can edit existing sessions (adjust start/end time)
- Users can delete incorrect entries
- All adjustments maintain the 10-minute chunk granularity

---

## Data Architecture

### Cloudflare D1 Schema

```sql
-- Users table
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  timezone TEXT DEFAULT 'UTC',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Outdoor sessions table
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,        -- Unix timestamp
  ended_at INTEGER,                    -- NULL if session is active
  duration_minutes INTEGER,            -- Calculated, rounded to 10-min chunks
  notes TEXT,                          -- Optional notes about the session
  location_name TEXT,                  -- Optional: "Park", "Backyard", etc.
  is_manual_entry INTEGER DEFAULT 0,  -- Flag for retroactive entries
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Goals table
CREATE TABLE goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  goal_type TEXT NOT NULL,            -- 'daily', 'weekly', 'monthly', 'yearly'
  target_minutes INTEGER NOT NULL,    -- Target in minutes (multiples of 10)
  is_active INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Indexes for performance
CREATE INDEX idx_sessions_user_date ON sessions(user_id, started_at);
CREATE INDEX idx_sessions_active ON sessions(user_id, ended_at) WHERE ended_at IS NULL;
```

### Cloudflare KV Usage

| Key Pattern | Value | Purpose |
|-------------|-------|---------|
| `session:active:{user_id}` | Session ID | Track active timer session |
| `auth:token:{token}` | User ID + expiry | JWT validation cache |
| `stats:daily:{user_id}:{date}` | Minutes JSON | Cached daily totals |
| `share:{share_id}` | Share data JSON | Temporary share links |

---

## API Design

### Authentication

```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/refresh
GET  /api/auth/me
```

### Sessions

```
# Get sessions (with date range filtering)
GET /api/sessions?start_date=2024-01-01&end_date=2024-12-31

# Start a new outdoor session (timer starts)
POST /api/sessions/start
Response: { id, started_at, status: "active" }

# End current outdoor session (timer stops)
POST /api/sessions/end
Response: { id, started_at, ended_at, duration_minutes }

# Get current active session (if any)
GET /api/sessions/active
Response: { id, started_at, elapsed_minutes } or null

# Add a manual/retroactive session
POST /api/sessions
Body: { started_at, ended_at, notes?, location_name? }

# Update a session (retroactive adjustment)
PUT /api/sessions/:id
Body: { started_at?, ended_at?, notes?, location_name? }

# Delete a session
DELETE /api/sessions/:id
```

### Statistics

```
# Get aggregated stats
GET /api/stats?period=day|week|month|year&date=2024-06-15

Response: {
  period: "day",
  date: "2024-06-15",
  total_minutes: 120,
  total_chunks: 12,          # 10-min chunks
  session_count: 3,
  streak_days: 14,
  comparison: {
    previous_period: 90,
    change_percent: 33.3
  }
}

# Get yearly heatmap data
GET /api/stats/heatmap?year=2024

Response: {
  year: 2024,
  data: [
    { date: "2024-01-01", minutes: 60, chunks: 6 },
    { date: "2024-01-02", minutes: 30, chunks: 3 },
    ...
  ]
}
```

### Goals

```
GET    /api/goals
POST   /api/goals      Body: { goal_type, target_minutes }
PUT    /api/goals/:id  Body: { target_minutes?, is_active? }
DELETE /api/goals/:id
```

### Sharing

```
# Generate a shareable image/link
POST /api/share
Body: { type: "stats_card" | "heatmap" | "achievement", period?, date? }
Response: { share_url, image_url, expires_at }

# Get shared content (public endpoint)
GET /api/share/:share_id
```

---

## Frontend Architecture

### Web App (Next.js)

```
web-app/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx
│   │   ├── page.tsx            # Landing/Dashboard
│   │   ├── login/
│   │   ├── register/
│   │   ├── dashboard/
│   │   ├── history/
│   │   ├── goals/
│   │   ├── settings/
│   │   └── share/[id]/         # Public share pages
│   ├── components/
│   │   ├── ui/                 # Reusable UI components
│   │   ├── Timer.tsx           # Main timer component
│   │   ├── Heatmap.tsx         # Yearly heatmap visualization
│   │   ├── StatsCard.tsx
│   │   ├── SessionList.tsx
│   │   └── GoalProgress.tsx
│   ├── hooks/
│   │   ├── useTimer.ts
│   │   ├── useAuth.ts
│   │   └── useSessions.ts
│   ├── lib/
│   │   ├── api.ts              # API client
│   │   └── utils.ts
│   └── styles/
├── public/
├── next.config.js
├── tailwind.config.js
└── package.json
```

### iOS App (SwiftUI)

```
ios-app/
├── OutsideTime/
│   ├── App/
│   │   ├── OutsideTimeApp.swift
│   │   └── AppDelegate.swift
│   ├── Models/
│   │   ├── User.swift
│   │   ├── Session.swift
│   │   └── Goal.swift
│   ├── Views/
│   │   ├── ContentView.swift
│   │   ├── Dashboard/
│   │   │   ├── DashboardView.swift
│   │   │   ├── TimerView.swift
│   │   │   └── QuickStatsView.swift
│   │   ├── History/
│   │   │   ├── HistoryView.swift
│   │   │   ├── HeatmapView.swift
│   │   │   └── SessionRowView.swift
│   │   ├── Goals/
│   │   │   └── GoalsView.swift
│   │   ├── Settings/
│   │   │   └── SettingsView.swift
│   │   └── Shared/
│   │       └── ShareCardView.swift
│   ├── ViewModels/
│   │   ├── TimerViewModel.swift
│   │   ├── SessionsViewModel.swift
│   │   └── StatsViewModel.swift
│   ├── Services/
│   │   ├── APIService.swift
│   │   ├── AuthService.swift
│   │   └── TimerService.swift
│   ├── Widgets/
│   │   └── OutsideTimeWidget/
│   ├── Extensions/
│   └── Resources/
├── OutsideTime.xcodeproj
└── OutsideTimeTests/
```

### Cloudflare Workers

```
cloudflare-workers/
├── src/
│   ├── index.ts                # Main entry point
│   ├── router.ts               # Request routing
│   ├── middleware/
│   │   ├── auth.ts             # Authentication middleware
│   │   ├── cors.ts
│   │   └── rateLimit.ts
│   ├── handlers/
│   │   ├── auth.ts
│   │   ├── sessions.ts
│   │   ├── stats.ts
│   │   ├── goals.ts
│   │   └── share.ts
│   ├── services/
│   │   ├── database.ts         # D1 operations
│   │   ├── cache.ts            # KV operations
│   │   └── time.ts             # Time rounding logic
│   ├── utils/
│   │   └── response.ts
│   └── types.ts
├── schema.sql                  # D1 schema
├── wrangler.toml               # Cloudflare config
├── package.json
└── tsconfig.json
```

---

## Time Calculation Logic

### Rounding to 10-Minute Chunks

```typescript
function roundToChunks(minutes: number): number {
  // Round to nearest 10 minutes
  // Minimum of 10 minutes if any time was recorded
  if (minutes <= 0) return 0;
  if (minutes < 10) return 10; // Minimum 10 minutes
  return Math.round(minutes / 10) * 10;
}

function calculateDuration(startedAt: Date, endedAt: Date): number {
  const diffMs = endedAt.getTime() - startedAt.getTime();
  const diffMinutes = diffMs / (1000 * 60);
  return roundToChunks(diffMinutes);
}
```

### Daily Aggregation

```typescript
function getDailyTotal(sessions: Session[]): number {
  // Sum all session durations for the day
  // Each session already rounded to 10-min chunks
  return sessions.reduce((sum, s) => sum + s.duration_minutes, 0);
}
```

---

## Sharing Mechanisms

### Web App Sharing

1. **Web Share API** (Progressive Enhancement)
   ```typescript
   if (navigator.share) {
     await navigator.share({
       title: 'My Outside Time',
       text: 'I spent 5 hours outside this week!',
       url: shareUrl
     });
   }
   ```

2. **Generated Image Cards**
   - Server-side rendering of stats as PNG images
   - Use `@cloudflare/pages-plugin-vercel-og` or similar
   - Optimized for social media dimensions

3. **Embeddable Widgets**
   - `<iframe>` embed code for blogs/websites
   - SVG badges (like GitHub readme badges)

### iOS App Sharing

1. **UIActivityViewController**
   - Share text, images, and URLs
   - Support for all iOS share targets

2. **WidgetKit Integration**
   - Small, Medium, Large widget sizes
   - Show daily progress, streaks, timer status

3. **App Intents / Shortcuts**
   - "Start outdoor timer" Siri shortcut
   - "How long was I outside today?" query

4. **Live Activities** (iOS 16.1+)
   - Show active timer on lock screen
   - Dynamic Island support

---

## Design Guidelines

### Visual Style

- **Color Palette**: Nature-inspired greens, sky blues, warm earth tones
- **Typography**: Clean, readable sans-serif (SF Pro for iOS, Inter for web)
- **Iconography**: Organic, rounded icons representing outdoor activities
- **Animations**: Smooth, delightful micro-interactions

### Heatmap Visualization

Inspired by GitHub's contribution graph:
- Calendar grid showing each day of the year
- Color intensity represents time spent outside
- Color scale: Light green (< 30 min) to Deep green (> 2 hours)
- Tap/hover to see daily details

### Timer Interface

- Large, prominent start/stop button
- Clear elapsed time display (updating live)
- Quick-add buttons for common durations
- Visual feedback for active state

---

## Implementation Phases

### Phase 1: Foundation (MVP)
- [ ] Cloudflare Workers setup with D1 and KV
- [ ] Basic authentication (email/password)
- [ ] Session CRUD operations
- [ ] Timer start/stop functionality
- [ ] Basic web app with timer and session list
- [ ] Basic iOS app with timer and session list

### Phase 2: Visualization
- [ ] Yearly heatmap component (web)
- [ ] Yearly heatmap component (iOS)
- [ ] Daily/weekly/monthly statistics
- [ ] Streak tracking
- [ ] Charts and graphs

### Phase 3: Goals & Gamification
- [ ] Goal setting and tracking
- [ ] Achievements/badges
- [ ] Progress notifications

### Phase 4: Sharing & Social
- [ ] Share card generation
- [ ] Public profile pages
- [ ] iOS widgets
- [ ] Web Share API integration

### Phase 5: Polish & Launch
- [ ] Onboarding flow
- [ ] Settings and preferences
- [ ] Data export
- [ ] App Store submission
- [ ] Marketing website

---

## Security Considerations

- All API endpoints authenticated (except share viewing)
- Rate limiting on all endpoints
- Input validation and sanitization
- HTTPS only
- Secure token storage (HttpOnly cookies for web, Keychain for iOS)
- CORS configured for allowed origins

---

## Performance Targets

- API response time: < 100ms (p95)
- Web app LCP: < 2.5s
- iOS app launch: < 1s
- Timer accuracy: ± 1 second

---

## Open Questions

1. Should we support multiple simultaneous timers (e.g., for different activities)?
2. Weather integration - show weather during outdoor sessions?
3. Location tracking - map of where user spent time outside?
4. Apple Health / Google Fit integration?
5. Offline support requirements for iOS app?

---

## Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Cloudflare D1 Docs](https://developers.cloudflare.com/d1/)
- [Next.js Documentation](https://nextjs.org/docs)
- [SwiftUI Documentation](https://developer.apple.com/documentation/swiftui/)
