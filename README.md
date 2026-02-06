# Outside Time Tracker

A privacy-first app to track how much time you spend outdoors. Your data is encrypted on your device before it ever touches a server — we can't read it, even if we wanted to.

## How It Works

### Zero-Knowledge Architecture

- **Your identity is a keypair** — no emails, no passwords, no accounts
- **All data is encrypted client-side** using public-key cryptography (libsodium sealed boxes)
- **The server is a dumb blob store** — it stores encrypted bytes and verifies signatures, nothing more
- **Only you can decrypt your data** — your private key never leaves your device

### Time Tracking

All outdoor time is tracked in **10-minute increments**.

1. **Start Timer** — Tap "Go Outside" when you head outdoors
2. **Stop Timer** — Tap "I'm Back Inside" when you return
3. **Multiple Sessions** — Go back out anytime, each session adds to your daily total
4. **Manual Entry** — Forgot to track? Add past sessions anytime

Example: 23 minutes → rounds to 20 min. 27 minutes → rounds to 30 min. Minimum recorded time is 10 minutes.

### Under the Hood

Every action (timer start, timer stop, manual entry) becomes an encrypted **event** appended to your personal log on the server. When you open the app, it downloads your log, decrypts it locally, and reconstructs your history. The server never sees plaintext.

## Project Structure

```
outside-time/
├── web-app/              # React/Next.js web application (MVP)
├── ios-app/              # Native Swift iOS application (v3)
├── cloudflare-workers/   # Backend — encrypted log store
├── README.md             # This file
└── PLANNING.md           # Technical architecture and design
```

## Tech Stack

### Backend
- **Runtime**: Cloudflare Workers (serverless)
- **Database**: Cloudflare D1 (SQLite) — stores encrypted event blobs
- **Auth**: Ed25519 signature verification (no passwords, no OAuth)

### Web App (MVP)
- **Framework**: React with Next.js
- **Styling**: Tailwind CSS
- **Crypto**: tweetnacl-js (libsodium compatible)
- **Deployment**: Cloudflare Pages

### iOS App (v3)
- **Language**: Swift / SwiftUI
- **Crypto**: libsodium (native)
- **Local Storage**: Keychain for keys

## Development

### Prerequisites
- Node.js 18+
- pnpm or npm
- Cloudflare account (for deployment)

### Cloudflare Workers
```bash
cd cloudflare-workers
pnpm install
pnpm dev        # Local development server
pnpm deploy     # Deploy to Cloudflare
```

### Web App
```bash
cd web-app
pnpm install
pnpm dev        # http://localhost:3000
```

## Roadmap

- **v1**: Timer + encrypted sync (web + backend)
- **v2**: Heatmaps, stats, goals, streaks
- **v3**: iOS app, sharing, social features
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
