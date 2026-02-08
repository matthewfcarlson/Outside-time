<script lang="ts">
  import Timer from './lib/components/Timer.svelte';
  import Summary from './lib/components/Summary.svelte';
  import Goals from './lib/components/Goals.svelte';
  import SessionLog from './lib/components/SessionLog.svelte';
  import IdentityQR from './lib/components/IdentityQR.svelte';
  import SyncStatus from './lib/components/SyncStatus.svelte';
  import TreeBackground from './lib/components/TreeBackground.svelte';
  import {
    loadEvents,
    appendPulledEvents,
    loadPendingEvents,
    markEventSynced,
    clearPending,
    reconstructSessions,
    reconstructGoals,
    findActiveTimerStart,
    loadActiveTimer,
    saveActiveTimer,
    type Session,
    type Goal,
  } from './lib/session';
  import { ApiClient } from './lib/api';
  import { SyncEngine } from './lib/sync';
  import { EventCache } from './lib/storage';
  import {
    generateIdentity,
    importSecretKey,
    exportSecretKey,
    type Identity,
  } from './lib/crypto';
  import type { OutsideEvent } from './lib/events';

  // ─── API Configuration ─────────────────────────────────────────────
  const API_BASE = import.meta.env.VITE_API_BASE ?? '';

  // ─── Identity ──────────────────────────────────────────────────────
  const cache = new EventCache();

  function getOrCreateIdentity(): Identity {
    // Check URL hash for imported identity: #key=BASE64_SECRET_KEY
    const hash = window.location.hash;
    if (hash.startsWith('#key=')) {
      const keyBase64 = decodeURIComponent(hash.slice(5));
      try {
        const identity = importSecretKey(keyBase64);
        cache.saveIdentity(keyBase64);
        // Clear the hash to avoid leaking the key in browser history
        history.replaceState(null, '', window.location.pathname + window.location.search);
        return identity;
      } catch (e) {
        console.warn('Failed to import identity from URL hash:', e);
      }
    }

    // Try loading from localStorage
    const saved = cache.loadIdentity();
    if (saved) {
      try {
        return importSecretKey(saved);
      } catch {
        console.warn('Corrupt saved identity, generating new one');
      }
    }

    // Generate fresh identity
    const identity = generateIdentity();
    cache.saveIdentity(exportSecretKey(identity));
    return identity;
  }

  const identity = getOrCreateIdentity();

  // ─── Sync Engine ───────────────────────────────────────────────────
  const api = new ApiClient(API_BASE);
  const syncEngine = new SyncEngine(api, cache, identity);

  // ─── State ─────────────────────────────────────────────────────────
  let events = $state(loadEvents());
  let sessions: Session[] = $derived(reconstructSessions(events));
  let goals: Goal[] = $derived(reconstructGoals(events));
  let syncState = $state<'idle' | 'syncing' | 'error' | 'offline'>('idle');
  let lastSyncAt = $state(0);
  let showSettings = $state(false);
  let showAbout = $state(false);
  let debugMode = $state(localStorage.getItem('ot:debugMode') === 'true');
  let seqMap = $state(new Map<string, number>());
  let pullCount = $state(0);

  function refresh() {
    events = loadEvents();
  }

  function toggleDebugMode() {
    debugMode = !debugMode;
    localStorage.setItem('ot:debugMode', String(debugMode));
  }

  // ─── Sync: push a single event to the server ──────────────────────
  async function pushEvent(event: OutsideEvent): Promise<void> {
    try {
      syncState = 'syncing';
      const result = await syncEngine.push(event);
      markEventSynced(event.id);
      const updated = new Map(seqMap);
      updated.set(event.id, result.seq);
      seqMap = updated;
      lastSyncAt = Math.floor(Date.now() / 1000);
      syncState = 'idle';
    } catch (e) {
      console.warn('Push failed (event saved locally):', e);
      syncState = 'error';
    }
  }

  // ─── Sync: pull events from server ─────────────────────────────────
  async function pullEvents(): Promise<void> {
    try {
      syncState = 'syncing';
      const decrypted = await syncEngine.pull();

      // Build seq map from all server-known events
      const map = new Map<string, number>();
      for (const d of decrypted) {
        map.set(d.event.id, d.seq);
      }
      seqMap = map;

      // Merge server events into local storage (deduplicate by id)
      const local = loadEvents();
      const localIds = new Set(local.map((e) => e.id));
      const newEvents = decrypted
        .map((d) => d.event)
        .filter((e) => !localIds.has(e.id));
      appendPulledEvents(newEvents);

      lastSyncAt = Math.floor(Date.now() / 1000);
      syncState = 'idle';
      refresh();

      // Sync active timer state from event log (cross-device support)
      const activeFromEvents = findActiveTimerStart(events);
      const localActive = loadActiveTimer();
      if (activeFromEvents && !localActive) {
        saveActiveTimer(activeFromEvents);
      } else if (!activeFromEvents && localActive) {
        saveActiveTimer(null);
      }
      pullCount++;
    } catch (e) {
      console.warn('Pull failed:', e);
      syncState = navigator.onLine ? 'error' : 'offline';
    }
  }

  // ─── Sync: full sync (push unsynced, then pull) ──────────────────
  async function syncAll(): Promise<void> {
    try {
      syncState = 'syncing';

      // Push only pending (unsynced) events instead of scanning the full log
      const pending = loadPendingEvents();
      if (pending.length > 0) {
        const pushed = await syncEngine.pushUnsynced(pending);
        if (pushed > 0) {
          console.log(`Pushed ${pushed} unsynced event(s) to server`);
        }
      }

      // Then pull any new events from the server
      await pullEvents();

      // After a successful full sync, all events are on the server
      clearPending();
    } catch (e) {
      console.warn('Sync failed:', e);
      syncState = navigator.onLine ? 'error' : 'offline';
    }
  }

  // Pull on initial load
  $effect(() => {
    pullEvents();
  });
</script>

<TreeBackground />
<main>
  {#if showAbout}
    <div class="about-page">
      <header>
        <button class="back-btn" onclick={() => (showAbout = false)} aria-label="Back">
          &larr; Back
        </button>
        <h1>About Outside Time</h1>
      </header>

      <section class="about-content">
        <div class="about-card">
          <h2>What is this?</h2>
          <p>
            Outside Time helps you track how much time you spend outdoors. Use the timer when you
            head outside, or add entries manually for times you forgot to track.
          </p>
        </div>

        <div class="about-card">
          <h2>Privacy first</h2>
          <p>
            Your data is encrypted on your device before it ever leaves your phone.
            The server only stores encrypted blobs &mdash; it can never read your sessions,
            goals, or any personal information.
          </p>
        </div>

        <div class="about-card">
          <h2>How it works</h2>
          <ul class="about-list">
            <li>Tap <strong>Go Outside</strong> to start tracking a session</li>
            <li>Tap <strong>I'm Back Inside</strong> when you return</li>
            <li>Time is tracked in 10-minute increments (minimum 10 min)</li>
            <li>Set daily, weekly, monthly, or yearly goals</li>
            <li>Sync across devices by scanning a QR code in Settings</li>
          </ul>
        </div>

        <div class="about-card">
          <h2>Cross-device sync</h2>
          <p>
            Open <strong>Settings</strong> and scan the QR code on another device
            to sync your data. The QR code contains your encrypted identity key &mdash;
            keep it private.
          </p>
        </div>
      </section>
    </div>
  {:else}
    <header>
      <h1>Outside Time</h1>
      <p class="tagline">Track your outdoor time, privately.</p>
      <div class="header-buttons">
        <button
          class="header-btn"
          onclick={() => (showAbout = true)}
          aria-label="About"
        >
          About
        </button>
        <button
          class="header-btn"
          onclick={() => (showSettings = !showSettings)}
          aria-label="Settings"
        >
          {showSettings ? 'Close' : 'Settings'}
        </button>
      </div>
    </header>

    {#if showSettings}
      <section class="settings-panel">
        <IdentityQR {identity} />
        <SyncStatus state={syncState} {lastSyncAt} onSync={syncAll} />
        <div class="debug-toggle">
          <label class="debug-label">
            <input type="checkbox" checked={debugMode} onchange={toggleDebugMode} />
            Debug mode
          </label>
        </div>
      </section>
    {/if}

    <Timer onchange={refresh} onpush={pushEvent} {pullCount} />
    <Summary {sessions} />
    <Goals {sessions} {goals} onchange={refresh} onpush={pushEvent} />
    <SessionLog {sessions} {events} {debugMode} {seqMap} onchange={refresh} onpush={pushEvent} />
  {/if}
</main>

<style>
  :global(body) {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
      Oxygen-Sans, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif;
    background: linear-gradient(180deg, #dcecd5 0%, #e8f0e4 40%, #f0f2f0 100%);
    background-attachment: fixed;
    margin: 0;
    padding: 0;
    color: #212529;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    min-height: 100vh;
  }

  :global(*) {
    box-sizing: border-box;
  }

  main {
    max-width: 480px;
    margin: 0 auto;
    padding: 1rem 0 3rem;
    position: relative;
    z-index: 1;
  }

  header {
    text-align: center;
    padding: 1.5rem 1rem 1rem;
    position: relative;
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border-radius: 0 0 0.75rem 0.75rem;
    margin: 0 0.5rem;
  }

  h1 {
    margin: 0 0 0.25rem;
    font-size: 1.5rem;
    font-weight: 700;
    color: #2d6a4f;
  }

  .tagline {
    margin: 0;
    font-size: 0.875rem;
    color: #6c757d;
  }

  .header-buttons {
    position: absolute;
    top: 1.5rem;
    right: 1rem;
    display: flex;
    gap: 0.375rem;
  }

  .header-btn {
    padding: 0.375rem 0.75rem;
    font-size: 0.8125rem;
    font-weight: 500;
    background: #e9ecef;
    color: #495057;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
  }

  .header-btn:hover {
    background: #dee2e6;
  }

  /* About page */
  .about-page header {
    text-align: left;
    padding: 1.5rem 1rem 0;
    position: relative;
  }

  .about-page h1 {
    text-align: center;
  }

  .back-btn {
    padding: 0.375rem 0.75rem;
    font-size: 0.8125rem;
    font-weight: 500;
    background: #e9ecef;
    color: #495057;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
  }

  .back-btn:hover {
    background: #dee2e6;
  }

  .about-content {
    padding: 1rem;
  }

  .about-card {
    background: white;
    border-radius: 0.5rem;
    padding: 1rem 1.25rem;
    margin-bottom: 0.75rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  }

  .about-card h2 {
    margin: 0 0 0.5rem;
    font-size: 1rem;
    color: #2d6a4f;
  }

  .about-card p {
    margin: 0;
    font-size: 0.875rem;
    line-height: 1.5;
    color: #495057;
  }

  .about-list {
    margin: 0;
    padding-left: 1.25rem;
    font-size: 0.875rem;
    line-height: 1.7;
    color: #495057;
  }

  .settings-panel {
    padding: 1rem;
    margin: 1rem 1rem 0;
    background: white;
    border-radius: 0.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  }

  .debug-toggle {
    padding-top: 0.75rem;
    border-top: 1px solid #e9ecef;
    margin-top: 0.75rem;
  }

  .debug-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    color: #495057;
    cursor: pointer;
  }

  .debug-label input[type='checkbox'] {
    accent-color: #2d6a4f;
  }
</style>
