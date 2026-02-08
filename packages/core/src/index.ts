/**
 * @outside-time/core — shared business logic for Outside Time Tracker.
 *
 * This package contains all platform-agnostic logic: cryptography, event types,
 * session reconstruction, sync engine, API client, and storage.
 *
 * It runs identically in:
 *   - Browsers (imported by the Svelte web app)
 *   - JavaScriptCore (embedded in the native iOS app)
 *   - Any standard JS runtime (Node, Deno, Bun — for testing)
 */

// Crypto
export {
  generateIdentity,
  identityFromSecretKey,
  encryptEvent,
  decryptEvent,
  sealedBoxSeal,
  sealedBoxOpen,
  signForAppend,
  exportSecretKey,
  importSecretKey,
  encodeBase64,
  decodeBase64,
  bytesToHex,
  hexToBytes,
  type Identity,
} from './crypto';

// Events
export {
  createTimerStart,
  createTimerStop,
  createManualEntry,
  createCorrection,
  createGoalSet,
  createGoalDelete,
  encodeEvent,
  decodeEvent,
  type OutsideEvent,
  type TimerStartEvent,
  type TimerStopEvent,
  type ManualEntryEvent,
  type CorrectionEvent,
  type GoalSetEvent,
  type GoalDeleteEvent,
} from './events';

// Session reconstruction & display helpers
export {
  reconstructSessions,
  reconstructGoals,
  computeGoalProgress,
  findActiveTimerStart,
  roundUpToMinute,
  formatDuration,
  formatTime,
  formatDate,
  formatElapsed,
  toDatetimeLocal,
  fromDatetimeLocal,
  computeTodaySummary,
  computeWeekSummary,
  type Session,
  type Goal,
  type Summary,
} from './session';

// API client
export {
  ApiClient,
  type ServerEvent,
  type LogResponse,
  type AppendResponse,
  type HeadResponse,
} from './api';

// Storage (injectable KVStore)
export {
  EventCache,
  type KVStore,
} from './storage';

// Sync engine
export {
  SyncEngine,
  type DecryptedServerEvent,
} from './sync';
