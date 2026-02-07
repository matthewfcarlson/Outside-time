<script lang="ts">
  import Timer from './lib/components/Timer.svelte';
  import Summary from './lib/components/Summary.svelte';
  import SessionLog from './lib/components/SessionLog.svelte';
  import IdentityQR from './lib/components/IdentityQR.svelte';
  import SyncStatus from './lib/components/SyncStatus.svelte';
  import { loadEvents, appendEvent, reconstructSessions, type Session } from './lib/session';
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
  let syncState = $state<'idle' | 'syncing' | 'error' | 'offline'>('idle');
  let lastSyncAt = $state(0);
  let showSettings = $state(false);
  let debugMode = $state(localStorage.getItem('ot:debugMode') === 'true');
  let seqMap = $state(new Map<string, number>());

  function refresh() {
    events = loadEvents();
  }

  function toggleDebugMode() {
    debugMode = !debugMode;
    localStorage.setItem('ot:debugMode', String(debugMode));
  }

  // ─── Sync: push a single event to the server ──────────────────────
  async function pushEvent(event: OutsideEvent): Promise<void> {
    if (!API_BASE) return; // No API configured, local-only mode
    try {
      syncState = 'syncing';
      const result = await syncEngine.push(event);
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
    if (!API_BASE) return;
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
      for (const event of newEvents) {
        appendEvent(event);
      }

      lastSyncAt = Math.floor(Date.now() / 1000);
      syncState = 'idle';
      refresh();
    } catch (e) {
      console.warn('Pull failed:', e);
      syncState = navigator.onLine ? 'error' : 'offline';
    }
  }

  // ─── Sync: full sync (push unsynced, then pull) ──────────────────
  async function syncAll(): Promise<void> {
    if (!API_BASE) return;
    try {
      syncState = 'syncing';

      // Push any local events that aren't on the server yet
      const local = loadEvents();
      const pushed = await syncEngine.pushUnsynced(local);
      if (pushed > 0) {
        console.log(`Pushed ${pushed} unsynced event(s) to server`);
      }

      // Then pull any new events from the server
      await pullEvents();
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

<main>
  <header>
    <h1>Outside Time</h1>
    <p class="tagline">Track your outdoor time, privately.</p>
    <button
      class="settings-toggle"
      onclick={() => (showSettings = !showSettings)}
      aria-label="Settings"
    >
      {showSettings ? 'Close' : 'Settings'}
    </button>
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

  <Timer onchange={refresh} onpush={pushEvent} />
  <Summary {sessions} />
  <SessionLog {sessions} {events} {debugMode} {seqMap} onchange={refresh} onpush={pushEvent} />
</main>

<style>
  :global(body) {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
      Oxygen-Sans, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif;
    background: #f0f2f0;
    margin: 0;
    padding: 0;
    color: #212529;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  :global(*) {
    box-sizing: border-box;
  }

  main {
    max-width: 480px;
    margin: 0 auto;
    padding: 1rem 0 3rem;
  }

  header {
    text-align: center;
    padding: 1.5rem 1rem 0;
    position: relative;
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

  .settings-toggle {
    position: absolute;
    top: 1.5rem;
    right: 1rem;
    padding: 0.375rem 0.75rem;
    font-size: 0.8125rem;
    font-weight: 500;
    background: #e9ecef;
    color: #495057;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
  }

  .settings-toggle:hover {
    background: #dee2e6;
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
