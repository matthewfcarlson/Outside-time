-- Outside Time Tracker — Encrypted Event Log Schema
-- The server stores only opaque encrypted blobs indexed by public key.

CREATE TABLE IF NOT EXISTS events (
  public_key TEXT NOT NULL,          -- Hex-encoded Ed25519 public key (user identity)
  seq INTEGER NOT NULL,              -- Monotonically increasing sequence number per key
  ciphertext BLOB NOT NULL,          -- Sealed box encrypted event (~100 bytes)
  created_at INTEGER NOT NULL,       -- Unix timestamp (server-assigned)
  PRIMARY KEY (public_key, seq)
);

-- Efficient sync: fetch events after a given sequence number
CREATE INDEX IF NOT EXISTS idx_events_sync ON events(public_key, seq);
