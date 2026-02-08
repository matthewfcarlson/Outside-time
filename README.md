# Outside Time Tracker

A privacy-first app to track how much time you spend outdoors. Your data is encrypted on your device before it ever touches a server — we can't read it, even if we wanted to.

## How It Works

### Zero-Knowledge Architecture

- **Your identity is a keypair** — no emails, no passwords, no accounts
- **All data is encrypted client-side** using public-key cryptography (libsodium sealed boxes)
- **The server is a dumb blob store** — it stores encrypted bytes and verifies signatures, nothing more
- **Only you can decrypt your data** — your private key never leaves your device

### Time Tracking

All outdoor time is **rounded up to the nearest minute**.

1. **Start Timer** — Tap "Go Outside" when you head outdoors
2. **Stop Timer** — Tap "Come Back In" when you return
3. **Multiple Sessions** — Go back out anytime, each session adds to your daily total
4. **Manual Entry** — Forgot to track? Add past sessions anytime

### Under the Hood

Every action (timer start, timer stop, manual entry) becomes an encrypted **event** appended to your personal log on the server. When you open the app, it downloads your log, decrypts it locally, and reconstructs your history. The server never sees plaintext.

## Architecture

The project is an npm workspace monorepo with a shared core that powers both web and iOS.

```
outside-time/
├── packages/core/          # Shared TypeScript business logic
├── web-app/                # Svelte 5 web application
├── ios-app/                # Native SwiftUI iOS app (JavaScriptCore bridge)
├── cloudflare-workers/     # Backend — encrypted log store
├── package.json            # npm workspace root
├── README.md               # This file
└── PLANNING.md             # Technical architecture and design
```

### Shared Core (`packages/core/`)

All platform-agnostic business logic lives in a single TypeScript package:

- **crypto.ts** — Ed25519 identity, X25519 sealed box encryption/decryption, signing
- **events.ts** — event type definitions and constructors (timer_start, timer_stop, manual_entry, correction, goal_set, goal_delete)
- **session.ts** — session/goal reconstruction from the event log, display helpers, summary computation
- **api.ts** — HTTP client for the Cloudflare Workers API
- **storage.ts** — encrypted event cache with an injectable `KVStore` interface
- **sync.ts** — push/pull sync engine

The core builds two bundles via esbuild:

| Bundle | Format | Used by | Purpose |
|--------|--------|---------|---------|
| `dist/index.mjs` | ESM | Web app (Vite) | Tree-shakeable import |
| `dist/core.bundle.js` | IIFE | iOS app (JSC) | Single file loaded into JavaScriptCore |

### Web App (`web-app/`)

A Svelte 5 SPA that imports from `@outside-time/core` via the npm workspace link. The web-app `src/lib/` files are thin re-exports from the core package, plus web-specific localStorage code. Deployed on Cloudflare Pages.

### iOS App (`ios-app/`)

A native SwiftUI app that shares business logic with the web app through a **JavaScriptCore bridge** — not a WebView wrapper.

#### How the JSC Bridge Works

JavaScriptCore (JSC) is a built-in iOS framework that provides a JavaScript engine without any browser or WebView. The iOS app uses it to run the exact same TypeScript business logic as the web app:

1. **At build time**, esbuild compiles `packages/core/` into a single `core.bundle.js` IIFE that exposes all functions on `globalThis.OutsideTimeCore`
2. **At app launch**, `CoreBridge.swift` creates a `JSContext`, installs native polyfills, and evaluates `core.bundle.js`
3. **At runtime**, Swift calls into JS for crypto, event creation, and session reconstruction — then decodes the JSON results into native Swift structs

```
┌─────────────────────────────────────┐
│  SwiftUI Views (100% native UI)     │
├─────────────────────────────────────┤
│  CoreBridge.swift                   │
│  ┌───────────────────────────────┐  │
│  │  JSContext (JavaScriptCore)   │  │
│  │  ┌─────────────────────────┐  │  │
│  │  │  core.bundle.js (IIFE)  │  │  │
│  │  │  - crypto               │  │  │
│  │  │  - events               │  │  │
│  │  │  - session recon        │  │  │
│  │  │  - sync engine          │  │  │
│  │  └─────────────────────────┘  │  │
│  │  Native polyfills:            │  │
│  │  - crypto.getRandomValues     │  │
│  │  - crypto.randomUUID          │  │
│  │  - atob / btoa                │  │
│  │  - fetch (via URLSession)     │  │
│  └───────────────────────────────┘  │
├─────────────────────────────────────┤
│  KeychainService (secret key)       │
└─────────────────────────────────────┘
```

The polyfills bridge JSC's minimal environment to what the core bundle expects:

- **`crypto.getRandomValues`** — backed by `SecRandomCopyBytes` for tweetnacl's PRNG
- **`crypto.randomUUID`** — backed by Foundation's `UUID()`
- **`atob` / `btoa`** — pure JS base64 implementation (tweetnacl-util uses these in browser mode)
- **`fetch`** — backed by native `URLSession` for the sync engine's HTTP calls

This approach gives a fully native iOS experience (SwiftUI, Keychain, widgets) while maintaining a single source of truth for all business logic.

### Backend (`cloudflare-workers/`)

A Cloudflare Workers API that stores encrypted event blobs in D1 (SQLite). It verifies Ed25519 signatures on writes but never sees plaintext data.

## Tech Stack

### Backend
- **Runtime**: Cloudflare Workers (serverless)
- **Database**: Cloudflare D1 (SQLite) — stores encrypted event blobs
- **Auth**: Ed25519 signature verification (no passwords, no OAuth)

### Web App
- **Framework**: Svelte 5
- **Build**: Vite
- **Crypto**: tweetnacl-js (libsodium compatible)
- **Deployment**: Cloudflare Pages

### iOS App
- **UI**: SwiftUI (iOS 17+)
- **Bridge**: JavaScriptCore (built-in, not a WebView)
- **Crypto**: tweetnacl-js via JSC + `SecRandomCopyBytes` for PRNG
- **Key Storage**: iOS Keychain
- **Project**: XcodeGen (`project.yml`)

## Development

### Prerequisites
- Node.js 20+
- npm (workspaces used for monorepo)
- Cloudflare account (for deployment)
- Xcode 16+ and XcodeGen (for iOS development)

### Install Dependencies

```bash
npm install        # Installs all workspaces from root
```

### Shared Core

```bash
npm run build -w @outside-time/core   # Build ESM + IIFE bundles
npm test -w @outside-time/core        # Run core tests
```

### Web App

```bash
npm run dev -w outside-time-web       # Vite dev server
npm test -w outside-time-web          # Run tests (66 tests)
npm run build -w outside-time-web     # Production build
```

### Cloudflare Workers

```bash
npm run dev -w outside-time-worker    # Local dev server (wrangler)
npx vitest run                        # Run tests (from cloudflare-workers/)
npm run deploy -w outside-time-worker # Deploy to Cloudflare
```

### iOS App

```bash
# 1. Build the core JS bundle
npm run build -w @outside-time/core

# 2. Copy bundle into iOS resources
cp packages/core/dist/core.bundle.js ios-app/OutsideTime/Resources/core.bundle.js

# 3. Generate Xcode project (requires XcodeGen: brew install xcodegen)
cd ios-app && xcodegen

# 4. Open in Xcode and build
open OutsideTime.xcodeproj
```

The Xcode project includes a pre-build script that automatically rebuilds and copies the core bundle, so after initial setup you can just build from Xcode.

## Roadmap

- **v1**: Timer + encrypted sync (web + backend) ✓
- **v2**: Goals, stats ✓ / heatmaps, streaks (in progress)
- **v3**: iOS app architecture ✓ / full iOS app, sharing, social features
- **v4**: Polish, App Store, marketing

## Privacy

The server stores only:
- Your public key (your "address")
- Encrypted blobs it cannot read
- Timestamps of when blobs were stored

It does **not** store or have access to: your name, email, timer data, session history, or any plaintext whatsoever.

**Lost your key = lost your data.** There is no recovery mechanism on the server. Back up your key.

## License

MIT License — see [LICENSE](LICENSE) for details.
