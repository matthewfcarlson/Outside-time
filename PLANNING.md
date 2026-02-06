# Outside Time Tracker - Technical Planning Document

## Overview

Outside Time Tracker is a privacy-first application to help users track and visualize their outdoor time. The core design principle is **zero-knowledge encryption**: the server is a dumb blob store that never sees plaintext user data. All data is encrypted client-side using public-key cryptography and stored as an append-only event log.

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
- All adjustments are new append events (corrections, not mutations)
- 10-minute chunk granularity is maintained

### Append-Only Event Log

All user actions produce **encrypted events** that are appended to a per-user log. The server never sees plaintext. Events are immutable — corrections are new events that supersede previous ones.

**Event Types**:
- `timer_start` — User started going outside
- `timer_stop` — User came back inside
- `manual_entry` — Retroactive session entry (contains start + end)
- `correction` — Amends a prior event (references event ID)
- `goal_set` — User set a new goal (v2)
- `settings_update` — User preferences changed (v2)

**Event Envelope** (plaintext JSON before encryption, ~50-100 bytes):
```json
{
  "id": "uuid-v4",
  "type": "timer_stop",
  "ts": 1706745600,
  "data": {
    "started_at": 1706742000,
    "duration_minutes": 30
  }
}
```

The client encrypts this envelope into a sealed box and appends it to the server.

---

## Cryptographic Architecture

### Key Primitives

All cryptography uses **libsodium** (NaCl) primitives:

| Operation | Primitive | Details |
|-----------|-----------|---------|
| Keypair generation | `crypto_box_keypair` | X25519 key pair |
| Encrypt event | `crypto_box_seal` | Sealed box (anonymous sender) |
| Decrypt event | `crypto_box_seal_open` | Requires private key |
| Sign writes | `crypto_sign` | Ed25519 signature |
| Verify writes | `crypto_sign_verify` | Server verifies before appending |

### Why Sealed Boxes?

`crypto_box_seal` (X25519 + XSalsa20-Poly1305) is ideal because:
- **48 bytes overhead** per event (ephemeral public key + MAC)
- 50 bytes of JSON → ~98 bytes ciphertext — very compact
- No sender authentication needed at the crypto layer (we use signatures separately for write auth)
- Widely supported via `tweetnacl-js` / `libsodium.js` in browsers and native libsodium on iOS

### Identity Model

- **No accounts, no emails, no passwords, no OAuth**
- Identity = a keypair generated on the client at first launch
- The **public key** is the user's address on the server
- The **private key** never leaves the client device
- Users should be offered a **recovery mechanism** (e.g., export private key as base64, or BIP39-style mnemonic) for backup

### Write Authorization

To prevent unauthorized appends, all writes must be **signed**:

1. Client creates the encrypted event blob
2. Client signs `(public_key || sequence_number || blob)` with their Ed25519 signing key
3. Server verifies the signature against the claimed public key before accepting the append
4. This ensures only the keypair owner can write to their log

**Key detail**: We derive both an encryption keypair (X25519) and a signing keypair (Ed25519) from a single seed. libsodium supports this via `crypto_sign_seed_keypair` + `crypto_sign_ed25519_pk_to_curve25519` for converting between the two.

### Data Flow

```
┌─────────────────────────────────────────────────┐
│ CLIENT (Browser / iOS)                          │
│                                                 │
│  1. Generate event JSON                         │
│  2. Encrypt with crypto_box_seal(event, pubkey) │
│  3. Sign (pubkey || seq || ciphertext)          │
│  4. POST to server                              │
│                                                 │
│  On read:                                       │
│  1. GET log entries from server                 │
│  2. Decrypt each with crypto_box_seal_open()    │
│  3. Reconstruct state client-side               │
└─────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│ SERVER (Cloudflare Worker + D1)                 │
│                                                 │
│  - Stores opaque encrypted blobs                │
│  - Indexes by public key + sequence number      │
│  - Verifies Ed25519 signature on writes         │
│  - Never sees plaintext                         │
│  - No concept of "users" beyond public keys     │
└─────────────────────────────────────────────────┘
```

---

## Data Architecture

### Cloudflare D1 Schema

```sql
-- Encrypted event log
-- Each row is an opaque encrypted blob belonging to a public key
CREATE TABLE events (
  public_key TEXT NOT NULL,          -- Hex-encoded Ed25519 public key (user identity)
  seq INTEGER NOT NULL,              -- Monotonically increasing sequence number per key
  ciphertext BLOB NOT NULL,          -- Sealed box encrypted event (~100 bytes)
  created_at INTEGER NOT NULL,       -- Unix timestamp (server-assigned, for sync)
  PRIMARY KEY (public_key, seq)
);

-- Index for efficient sync (fetch events after a given sequence)
CREATE INDEX idx_events_sync ON events(public_key, seq);
```

That's it. One table. The server knows nothing about what's inside the blobs.

### Why D1 (Not R2)?

- D1 gives us **row-level access** — clients can request "give me events after seq N" for efficient sync
- Event blobs are tiny (~100 bytes), well within D1 row size limits
- Simpler than managing R2 objects for append-only small records
- Can revisit R2 if log sizes grow past D1 limits (10GB per database)

---

## API Design

### Endpoints

The API is minimal — the server is a dumb log store.

```
# Append an encrypted event to a user's log
POST /api/log/:publicKey
Headers:
  Content-Type: application/octet-stream
  X-Signature: <base64 Ed25519 signature over (publicKey || seq || body)>
  X-Sequence: <next sequence number>
Body: <raw ciphertext bytes>

Response: 201 Created
  { "seq": 42, "created_at": 1706745600 }

Errors:
  400 — Invalid signature, sequence gap, or malformed request
  409 — Sequence number conflict (already exists)


# Download a user's event log (or a slice of it)
GET /api/log/:publicKey?after=0&limit=1000
Response: 200 OK
  {
    "events": [
      { "seq": 1, "ciphertext": "<base64>", "created_at": 1706745600 },
      { "seq": 2, "ciphertext": "<base64>", "created_at": 1706745660 },
      ...
    ],
    "has_more": false
  }


# Get log metadata (no encrypted content)
HEAD /api/log/:publicKey
Response: 200 OK
Headers:
  X-Event-Count: 142
  X-Latest-Seq: 142
```

### No Other Endpoints Needed for MVP

- No auth endpoints (identity is a keypair)
- No stats endpoints (computed client-side)
- No goals endpoints (stored as encrypted events)
- No sharing endpoints (v3 — deferred)

---

## Frontend Architecture

### Web App (Next.js) — MVP Priority

```
web-app/
├── src/
│   ├── app/                     # Next.js App Router
│   │   ├── layout.tsx
│   │   ├── page.tsx             # Landing / Timer dashboard
│   │   └── settings/
│   │       └── page.tsx         # Key backup/restore
│   ├── components/
│   │   ├── Timer.tsx            # Main timer component
│   │   ├── TodayStats.tsx       # Today's outdoor time summary
│   │   └── SessionList.tsx      # Recent sessions
│   ├── lib/
│   │   ├── crypto.ts            # Keypair gen, seal/unseal, sign/verify
│   │   ├── events.ts            # Event creation, encoding, decoding
│   │   ├── sync.ts              # Sync engine (push/pull events)
│   │   ├── store.ts             # Local state from decrypted events
│   │   └── api.ts               # HTTP client for worker API
│   ├── hooks/
│   │   ├── useTimer.ts          # Timer state management
│   │   ├── useIdentity.ts       # Keypair management
│   │   └── useSessions.ts       # Decrypted session state
│   └── styles/
├── public/
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

### iOS App (SwiftUI) — v3

```
ios-app/
├── OutsideTime/
│   ├── Crypto/
│   │   ├── KeyManager.swift     # Keychain storage, keypair ops
│   │   └── SealedBox.swift      # libsodium wrappers
│   ├── Sync/
│   │   ├── EventLog.swift       # Local event log
│   │   └── SyncEngine.swift     # Push/pull with server
│   ├── Models/
│   │   └── Event.swift          # Event types and encoding
│   ├── Views/
│   │   ├── TimerView.swift
│   │   ├── DashboardView.swift
│   │   └── SettingsView.swift
│   └── ViewModels/
│       └── TimerViewModel.swift
└── OutsideTime.xcodeproj
```

### Cloudflare Workers

```
cloudflare-workers/
├── src/
│   ├── index.ts                 # Main entry, request routing
│   ├── handlers/
│   │   ├── append.ts            # POST /api/log/:publicKey
│   │   ├── read.ts              # GET /api/log/:publicKey
│   │   └── head.ts              # HEAD /api/log/:publicKey
│   ├── middleware/
│   │   ├── cors.ts              # CORS headers
│   │   └── rateLimit.ts         # Rate limiting
│   ├── crypto.ts                # Ed25519 signature verification
│   └── types.ts                 # TypeScript type definitions
├── schema.sql                   # D1 schema
├── wrangler.toml
├── package.json
└── tsconfig.json
```

---

## Time Calculation Logic

All computation happens **client-side** after decrypting the event log.

### Rounding to 10-Minute Chunks

```typescript
function roundToChunks(minutes: number): number {
  if (minutes <= 0) return 0;
  if (minutes < 10) return 10;
  return Math.round(minutes / 10) * 10;
}
```

### Reconstructing State from Events

```typescript
function reconstructSessions(events: DecryptedEvent[]): Session[] {
  const sessions: Session[] = [];
  let activeTimer: { id: string; started_at: number } | null = null;

  for (const event of events) {
    switch (event.type) {
      case 'timer_start':
        activeTimer = { id: event.id, started_at: event.ts };
        break;
      case 'timer_stop':
        if (activeTimer) {
          const durationMin = (event.ts - activeTimer.started_at) / 60;
          sessions.push({
            id: activeTimer.id,
            started_at: activeTimer.started_at,
            ended_at: event.ts,
            duration_minutes: roundToChunks(durationMin),
          });
          activeTimer = null;
        }
        break;
      case 'manual_entry':
        sessions.push({
          id: event.id,
          started_at: event.data.started_at,
          ended_at: event.data.ended_at,
          duration_minutes: roundToChunks(
            (event.data.ended_at - event.data.started_at) / 60
          ),
        });
        break;
      case 'correction':
        // Apply correction to referenced event
        // (replace or remove the original session)
        break;
    }
  }

  return sessions;
}
```

---

## Implementation Phases

### v1: MVP — "Timer That Works"
- [ ] Cloudflare Worker with D1 (append-only encrypted log store)
- [ ] Ed25519 signature verification on writes
- [ ] GET/POST/HEAD endpoints for log access
- [ ] CORS and basic rate limiting
- [ ] Web app: keypair generation and storage (localStorage)
- [ ] Web app: crypto_box_seal encrypt/decrypt via tweetnacl
- [ ] Web app: start/stop timer, append events to server
- [ ] Web app: download & decrypt log, show today's outdoor time
- [ ] Web app: manual session entry
- [ ] Key export/import for backup

### v2: "Make It Useful"
- [ ] Yearly heatmap / year-in-review visualization
- [ ] Goal setting (stored as encrypted events)
- [ ] Streak tracking (computed client-side)
- [ ] Daily/weekly/monthly statistics views
- [ ] Charts and graphs
- [ ] Data export (JSON, CSV — decrypted client-side)

### v3: "Make It Social + iOS"
- [ ] iOS app (SwiftUI + native libsodium)
- [ ] Sharing mechanism (owner decrypts and publishes summary)
- [ ] Public profile pages
- [ ] iOS widgets (WidgetKit)
- [ ] Live Activities for active timer

### v4: "Polish & Launch"
- [ ] Onboarding flow
- [ ] App Store submission
- [ ] Marketing website
- [ ] Optional: weather integration, location, Apple Health

---

## Security Model

### What the Server Knows
- A set of public keys that have stored data
- How many events each public key has
- When events were appended (server timestamps)
- The size of each encrypted blob

### What the Server Does NOT Know
- What the events contain (timer starts, stops, durations)
- Who the user is (no email, name, or identifying info)
- Any plaintext user data whatsoever

### Threat Model
- **Server compromise**: Attacker gets encrypted blobs. Cannot decrypt without private keys.
- **Network eavesdropping**: HTTPS protects in transit. Ciphertext is opaque even without TLS.
- **Write spam**: Mitigated by signature verification (only keypair owner can append) + rate limiting.
- **Public key enumeration**: Public keys are visible via the API. This is by design — the public key is an address, not a secret. No sensitive data is exposed.

### Client-Side Security
- Private key stored in browser localStorage (MVP) — acceptable tradeoff for MVP
- iOS: Keychain storage (v3)
- Users should export/backup their key — lost key = lost data (by design)
- No server-side recovery possible (this is a feature, not a bug)

---

## Performance Targets

- API response time: < 50ms (p95) — it's just D1 reads/writes
- Web app LCP: < 2.5s
- Timer accuracy: ± 1 second (client-side, not dependent on server)
- Sync latency: < 200ms for typical log sizes (< 1000 events/year)
- Event decryption: < 1ms per event (tweetnacl is fast)

---

## Open Questions (Future)

1. **Multi-device sync**: How to handle sequence conflicts when the same keypair appends from two devices simultaneously? (Likely: server rejects conflicting seq, client retries with next seq)
2. **Log compaction**: After years of use, logs could grow large. Could support a "compaction" event that summarizes prior state.
3. **Shared viewing**: For social features, the owner could re-encrypt a subset of events with a shared key, or publish a signed plaintext summary.
4. **Key rotation**: Allow users to rotate their keypair while maintaining history.
5. **Multiple timers**: Track different outdoor activities (hiking, gardening, etc.) as optional event properties.
6. **Weather/location**: Optional enrichment data as additional event properties.

---

## Resources

- [libsodium documentation](https://doc.libsodium.org/)
- [tweetnacl-js](https://github.com/nicehash/nicehash) — JS implementation of NaCl
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Cloudflare D1 Docs](https://developers.cloudflare.com/d1/)
- [Next.js Documentation](https://nextjs.org/docs)
