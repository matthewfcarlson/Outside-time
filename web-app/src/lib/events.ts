/**
 * Re-exports all event types and constructors from the shared core package.
 * This file preserves the existing import path for web-app consumers.
 */
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
} from '@outside-time/core';
