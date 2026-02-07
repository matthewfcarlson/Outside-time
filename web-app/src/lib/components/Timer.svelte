<script lang="ts">
  import { createTimerStart, createTimerStop, type TimerStartEvent, type OutsideEvent } from '../events';
  import {
    appendEvent,
    loadActiveTimer,
    saveActiveTimer,
    formatElapsed,
  } from '../session';

  let { onchange, onpush, pullCount = 0 }: { onchange: () => void; onpush: (event: OutsideEvent) => Promise<void>; pullCount?: number } = $props();

  let activeTimer: TimerStartEvent | null = $state(loadActiveTimer());
  let elapsed = $state(0);

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
    onchange();
    onpush(event);
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
      Come Back In
    </button>
  {:else}
    <button class="timer-btn start" onclick={startTimer}>
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
  }

  .timer-display.running {
    color: #2d6a4f;
  }

  .timer-btn {
    padding: 0.875rem 2.5rem;
    font-size: 1.125rem;
    font-weight: 600;
    border: none;
    border-radius: 0.5rem;
    cursor: pointer;
    transition: background-color 0.2s, transform 0.1s;
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
</style>
