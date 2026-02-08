/**
 * Re-exports the storage layer from the shared core package.
 * This file preserves the existing import path for web-app consumers.
 */
export {
  EventCache,
  type KVStore,
} from '@outside-time/core';
