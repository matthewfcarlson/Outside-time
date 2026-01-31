# Outside Time Tracker

A beautiful web and iOS app to track how much time you spend outdoors throughout the year. Visualize your outdoor habits, set goals, and share your progress with friends.

## Vision

In our increasingly indoor-focused world, spending time outside is essential for mental and physical health. Outside Time Tracker helps you become more mindful of your outdoor time by providing:

- **Easy Time Logging** - Quick one-tap tracking when you head outside
- **Beautiful Visualizations** - See your outdoor time as stunning yearly heatmaps and charts
- **Goal Setting** - Set daily, weekly, or monthly outdoor time goals
- **Sharing** - Share your outdoor achievements with friends and family
- **Cross-Platform Sync** - Seamlessly sync between web and iOS

## Project Structure

```
outside-time/
├── web-app/              # React/Next.js web application
├── ios-app/              # Native Swift iOS application
├── cloudflare-workers/   # Backend API and data storage
├── README.md             # This file
└── PLANNING.md           # Detailed technical planning document
```

## Tech Stack

### Frontend - Web App
- **Framework**: React with Next.js
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Charts**: D3.js or Recharts for visualizations
- **Deployment**: Cloudflare Pages

### Frontend - iOS App
- **Language**: Swift
- **Framework**: SwiftUI
- **Architecture**: MVVM
- **Local Storage**: Core Data / SwiftData
- **Distribution**: App Store

### Backend
- **Runtime**: Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite)
- **Cache/Sessions**: Cloudflare KV
- **Authentication**: JWT tokens with optional OAuth providers

## How It Works

### Time Tracking in 10-Minute Chunks
All outdoor time is tracked in **10-minute increments**. This encourages meaningful outdoor time and provides cleaner visualizations.

1. **Start Timer** - Tap "Go Outside" when you head outdoors
2. **Stop Timer** - Tap "I'm Back Inside" when you return
3. **Multiple Sessions** - Go back out anytime, each session adds to your daily total
4. **Retroactive Adjustments** - Forgot to track? Add or edit past sessions anytime

Example: If you're outside for 23 minutes, it rounds to 20 minutes. If you're out for 27 minutes, it rounds to 30 minutes. Minimum recorded time is 10 minutes.

## Features

### Core Features
- [ ] User registration and authentication
- [ ] Timer-based tracking (start/stop)
- [ ] Multiple sessions per day (go back out, add more time)
- [ ] Retroactive entry and adjustment of past sessions
- [ ] Time rounded to 10-minute chunks
- [ ] Daily, weekly, monthly, yearly statistics
- [ ] Yearly heatmap visualization (similar to GitHub contribution graph)
- [ ] Streak tracking
- [ ] Goal setting and progress tracking

### Social Features
- [ ] Share statistics as beautiful images
- [ ] Public profile pages
- [ ] Leaderboards (opt-in)
- [ ] Share via native share sheets (iOS) and Web Share API

### Data & Privacy
- [ ] Export data (JSON, CSV)
- [ ] Data deletion
- [ ] Privacy-first design (minimal data collection)

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm or npm
- Xcode 15+ (for iOS development)
- Cloudflare account

### Web App Development
```bash
cd web-app
pnpm install
pnpm dev
```

### iOS App Development
```bash
cd ios-app
open OutsideTime.xcodeproj
```

### Cloudflare Workers Development
```bash
cd cloudflare-workers
pnpm install
pnpm dev
```

## Sharing Mechanisms

### Web App Sharing
- **Web Share API**: Native sharing on supported browsers
- **Direct URL Sharing**: Shareable profile/stats URLs
- **Image Export**: Generate beautiful stat cards as downloadable images
- **Embed Widgets**: Embeddable widgets for personal websites/blogs

### iOS App Sharing
- **Share Sheet**: Native iOS share sheet integration
- **Widgets**: Home screen widgets showing daily/weekly progress
- **iMessage App**: Share achievements directly in iMessage
- **App Clips**: Quick access for friends to see your stats

## API Overview

The Cloudflare Workers backend exposes a RESTful API:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/*` | POST | Authentication endpoints |
| `/api/sessions` | GET/POST | Outdoor time sessions |
| `/api/stats` | GET | User statistics |
| `/api/goals` | GET/POST/PUT | Goal management |
| `/api/share` | POST | Generate shareable content |

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.
