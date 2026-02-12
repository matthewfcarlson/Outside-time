<script lang="ts">
  import { createTimerStart, createTimerStop, type TimerStartEvent, type OutsideEvent } from '../events';
  import {
    appendEvent,
    loadActiveTimer,
    saveActiveTimer,
    updateStoredEvent,
    formatElapsed,
    toDatetimeLocal,
    fromDatetimeLocal,
  } from '../session';

  let { onchange, onpush, pullCount = 0 }: { onchange: () => void; onpush: (event: OutsideEvent) => Promise<void>; pullCount?: number } = $props();

  let activeTimer: TimerStartEvent | null = $state(loadActiveTimer());
  let elapsed = $state(0);
  let editingStartTime = $state(false);
  let editStartValue = $state('');

  // Cross-tab sync: listen for storage changes from other tabs
  $effect(() => {
    function handleStorage(e: StorageEvent) {
      if (e.key === 'ot:local:activeTimer') {
        const loaded = loadActiveTimer();
        activeTimer = loaded;
        if (!loaded) elapsed = 0;
      }
    }
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  });

  // Cross-device sync: re-read active timer after pull completes
  $effect(() => {
    void pullCount;
    const loaded = loadActiveTimer();
    const loadedId = loaded?.id ?? null;
    const currentId = activeTimer?.id ?? null;
    if (loadedId !== currentId) {
      activeTimer = loaded;
      if (!loaded) elapsed = 0;
    }
  });

  function startTimer() {
    const event = createTimerStart();
    appendEvent(event);
    saveActiveTimer(event);
    activeTimer = event;
    onchange();
    onpush(event);
  }

  function stopTimer() {
    if (!activeTimer) return;
    const event = createTimerStop(activeTimer);
    appendEvent(event);
    saveActiveTimer(null);
    activeTimer = null;
    elapsed = 0;
    editingStartTime = false;
    onchange();
    onpush(event);
  }

  function openStartTimeEditor() {
    if (!activeTimer) return;
    editStartValue = toDatetimeLocal(activeTimer.ts);
    editingStartTime = true;
  }

  function cancelStartTimeEdit() {
    editingStartTime = false;
  }

  function saveStartTimeEdit() {
    if (!activeTimer) return;
    const newTs = fromDatetimeLocal(editStartValue);
    const now = Math.floor(Date.now() / 1000);
    if (newTs >= now) return; // start time must be in the past
    const updated: TimerStartEvent = { ...activeTimer, ts: newTs };
    updateStoredEvent(updated);
    saveActiveTimer(updated);
    activeTimer = updated;
    editingStartTime = false;
  }

  $effect(() => {
    if (activeTimer) {
      elapsed = Math.floor(Date.now() / 1000) - activeTimer.ts;
      const id = setInterval(() => {
        if (activeTimer) {
          elapsed = Math.floor(Date.now() / 1000) - activeTimer.ts;
        }
      }, 1000);
      return () => clearInterval(id);
    }
  });

  let isRunning = $derived(activeTimer !== null);
</script>

<div class="timer">
  <div class="timer-display" class:running={isRunning}>
    {formatElapsed(elapsed)}
  </div>
  {#if isRunning}
    <button class="timer-btn stop" onclick={stopTimer}>
      <svg class="btn-icon" viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden="true">
        <rect x="6" y="6" width="12" height="12" rx="2" />
      </svg>
      Come Back In
    </button>
    {#if editingStartTime}
      <div class="start-time-editor">
        <label class="form-label">
          Started at
          <input type="datetime-local" bind:value={editStartValue} />
        </label>
        <div class="form-actions">
          <button class="btn save" onclick={saveStartTimeEdit}>Save</button>
          <button class="btn cancel" onclick={cancelStartTimeEdit}>Cancel</button>
        </div>
      </div>
    {:else}
      <button class="adjust-btn" onclick={openStartTimeEditor}>
        <svg class="btn-icon" viewBox="0 0 24 24" fill="currentColor" width="14" height="14" aria-hidden="true">
          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
        </svg>
        Adjust start time
      </button>
    {/if}
  {:else}
    <button class="timer-btn start" onclick={startTimer}>
      <svg class="btn-icon" viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden="true">
        <polygon points="6,4 20,12 6,20" />
      </svg>
      Go Outside
    </button>
  {/if}
</div>

<style>
  .timer {
    text-align: center;
    padding: 2rem 1rem;
  }

  .timer-display {
    font-family: 'Courier New', Courier, monospace;
    font-size: 3rem;
    font-weight: bold;
    color: #495057;
    margin-bottom: 1.5rem;
    letter-spacing: 0.05em;
    text-shadow: 0 1px 4px rgba(255, 255, 255, 0.8);
  }

  .timer-display.running {
    color: #2d6a4f;
  }

  .timer-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.875rem 2.5rem;
    font-size: 1.125rem;
    font-weight: 600;
    border: none;
    border-radius: 0.5rem;
    cursor: pointer;
    transition: background-color 0.2s, transform 0.1s;
  }

  .btn-icon {
    width: 1.125rem;
    height: 1.125rem;
    flex-shrink: 0;
  }

  .timer-btn:active {
    transform: scale(0.97);
  }

  .timer-btn.start {
    background-color: #2d6a4f;
    color: white;
  }

  .timer-btn.start:hover {
    background-color: #245a42;
  }

  .timer-btn.stop {
    background-color: #dc3545;
    color: white;
  }

  .timer-btn.stop:hover {
    background-color: #c82333;
  }

  .adjust-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    margin-top: 0.75rem;
    padding: 0.375rem 0.75rem;
    font-size: 0.8125rem;
    font-weight: 500;
    color: #6c757d;
    background: transparent;
    border: 1px solid #dee2e6;
    border-radius: 0.375rem;
    cursor: pointer;
    transition: background-color 0.2s, color 0.2s;
  }

  .adjust-btn:hover {
    background: rgba(255, 255, 255, 0.5);
    color: #495057;
    border-color: #adb5bd;
  }

  .start-time-editor {
    margin-top: 1rem;
    background: rgba(255, 255, 255, 0.45);
    backdrop-filter: blur(16px) saturate(1.4);
    -webkit-backdrop-filter: blur(16px) saturate(1.4);
    border: 1px solid rgba(255, 255, 255, 0.5);
    border-radius: 0.5rem;
    padding: 1rem;
    display: inline-block;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  }

  .form-label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: #6c757d;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .form-label input {
    padding: 0.5rem;
    border: 1px solid #dee2e6;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    color: #212529;
    box-sizing: border-box;
  }

  .form-label input:focus {
    outline: none;
    border-color: #2d6a4f;
    box-shadow: 0 0 0 2px rgba(45, 106, 79, 0.15);
  }

  .form-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.75rem;
    justify-content: center;
  }

  .btn {
    padding: 0.375rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
  }

  .btn.save {
    background: #2d6a4f;
    color: white;
  }

  .btn.save:hover {
    background: #245a42;
  }

  .btn.cancel {
    background: #e9ecef;
    color: #495057;
  }

  .btn.cancel:hover {
    background: #dee2e6;
  }
</style>
