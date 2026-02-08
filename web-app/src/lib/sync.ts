/**
 * Re-exports the sync engine from the shared core package.
 * This file preserves the existing import path for web-app consumers.
 */
export {
  SyncEngine,
  type DecryptedServerEvent,
} from '@outside-time/core';
