/**
 * Re-exports the API client from the shared core package.
 * This file preserves the existing import path for web-app consumers.
 */
export {
  ApiClient,
  type ServerEvent,
  type LogResponse,
  type AppendResponse,
  type HeadResponse,
} from '@outside-time/core';
