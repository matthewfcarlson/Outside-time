<script lang="ts">
  import Timer from './lib/components/Timer.svelte';
  import Summary from './lib/components/Summary.svelte';
  import Goals from './lib/components/Goals.svelte';
  import SessionLog from './lib/components/SessionLog.svelte';
  import Onboarding from './lib/components/Onboarding.svelte';
  import About from './lib/components/About.svelte';
  import Settings from './lib/components/Settings.svelte';
  import TreeBackground from './lib/components/TreeBackground.svelte';
  import MergePrompt from './lib/components/MergePrompt.svelte';
  import {
    loadEvents,
    appendPulledEvents,
    loadPendingEvents,
    markEventSynced,
    clearPending,
    markAllPending,
    clearLocalData,
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

  /** Pending key import base64, set when user has events and opens a key link */
  let pendingKeyImport = $state<string | null>(null);
  let showMergePrompt = $state(false);

  function getOrCreateIdentity(): Identity {
    // Check URL hash for imported identity: #key=BASE64_SECRET_KEY
    const hash = window.location.hash;
    if (hash.startsWith('#key=')) {
      const keyBase64 = decodeURIComponent(hash.slice(5));
      // Clear the hash and navigate to root to avoid leaking the key
      history.replaceState(null, '', '/');

      try {
        const newIdentity = importSecretKey(keyBase64);

        // Check if we already have a different identity with local events
        const existingKeyBase64 = cache.loadIdentity();
        if (existingKeyBase64) {
          try {
            const existingIdentity = importSecretKey(existingKeyBase64);
            if (existingIdentity.publicKeyHex !== newIdentity.publicKeyHex) {
              const localEvents = loadEvents();
              if (localEvents.length > 0) {
                // Defer the import — show the merge prompt
                pendingKeyImport = keyBase64;
                showMergePrompt = true;
                return existingIdentity;
              }
            }
          } catch {
            // Existing identity is corrupt, proceed with import
          }
        }

        // No conflict — import directly
        cache.saveIdentity(keyBase64);
        // Clear the hash and navigate to root to avoid leaking the key
        history.replaceState(null, '', '/');
        return newIdentity;
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

  let identity = $state(getOrCreateIdentity());

  // ─── Sync Engine ───────────────────────────────────────────────────
  const api = new ApiClient(API_BASE);
  let syncEngine = $derived(new SyncEngine(api, cache, identity));

  // ─── Router ───────────────────────────────────────────────────────
  let currentPath = $state(window.location.pathname);

  function navigate(path: string) {
    history.pushState(null, '', path);
    currentPath = path;
  }

  // Handle browser back/forward buttons
  $effect(() => {
    const onPopState = () => {
      currentPath = window.location.pathname;
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  });

  // ─── State ─────────────────────────────────────────────────────────
  let events = $state(loadEvents());
  let sessions: Session[] = $derived(reconstructSessions(events));
  let goals: Goal[] = $derived(reconstructGoals(events));
  let syncState = $state<'idle' | 'syncing' | 'error' | 'offline'>('idle');
  let lastSyncAt = $state(0);
  let debugMode = $state(localStorage.getItem('ot:debugMode') === 'true');
  let onboardingDismissed = $state(localStorage.getItem('ot:onboardingDismissed') === 'true');
  let showOnboarding = $derived(sessions.length === 0 && !onboardingDismissed);

  function dismissOnboarding() {
    onboardingDismissed = true;
    localStorage.setItem('ot:onboardingDismissed', 'true');
  }
  let seqMap = $state(new Map<string, number>());
  let pullCount = $state(0);

  function refresh() {
    events = loadEvents();
  }

  function toggleDebugMode() {
    debugMode = !debugMode;
    localStorage.setItem('ot:debugMode', String(debugMode));
  }

  // ─── Merge / Discard handlers ─────────────────────────────────────

  function switchIdentity(keyBase64: string): void {
    const newIdentity = importSecretKey(keyBase64);
    cache.saveIdentity(keyBase64);
    identity = newIdentity;
    // syncEngine is automatically derived from identity
    seqMap = new Map();
  }

  function handleMerge(): void {
    if (!pendingKeyImport) return;
    // Switch to the new identity, keeping all local events
    switchIdentity(pendingKeyImport);
    // Mark every local event as pending so they get pushed under the new key
    markAllPending();
    pendingKeyImport = null;
    showMergePrompt = false;
    refresh();
    // Push merged events to the new key's server log, then pull
    syncAll();
  }

  function handleDiscard(): void {
    if (!pendingKeyImport) return;
    // Wipe local events and switch to the new identity
    clearLocalData();
    switchIdentity(pendingKeyImport);
    pendingKeyImport = null;
    showMergePrompt = false;
    refresh();
    // Pull events from the new key's server
    pullEvents();
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

  // Pull on initial load (skip if waiting for merge decision)
  $effect(() => {
    if (!showMergePrompt) {
      pullEvents();
    }
  });
</script>

{#if showMergePrompt}
  <MergePrompt
    sessionCount={sessions.length}
    onMerge={handleMerge}
    onDiscard={handleDiscard}
  />
{/if}

<TreeBackground />
<main>
  {#if currentPath === '/about'}
    <About onBack={() => navigate('/')} />
  {:else if currentPath === '/settings'}
    <Settings
      {identity}
      {syncState}
      {lastSyncAt}
      onSync={syncAll}
      {debugMode}
      onToggleDebug={toggleDebugMode}
      onBack={() => navigate('/')}
    />
  {:else}
    <header>
      <h1>Outside Time</h1>
      <p class="tagline">Track your outdoor time, privately.</p>
    </header>

    <Timer onchange={refresh} onpush={pushEvent} {pullCount} />
    {#if showOnboarding}
      <Onboarding onDismiss={dismissOnboarding} />
    {/if}
    {#if goals.length === 0}
      <Summary {sessions} />
    {/if}
    <Goals {sessions} {goals} onchange={refresh} onpush={pushEvent} />
    <SessionLog {sessions} {events} {debugMode} {seqMap} onchange={refresh} onpush={pushEvent} />

    <nav class="bottom-bar">
      <button class="bottom-btn" onclick={() => navigate('/about')} aria-label="About">
        About
      </button>
      <button class="bottom-btn" onclick={() => navigate('/settings')} aria-label="Settings">
        Settings
      </button>
    </nav>
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
    padding: 1rem 0 5rem;
    position: relative;
    z-index: 1;
  }

  header {
    text-align: center;
    padding: 1.5rem 1rem 1rem;
    position: relative;
    background: rgba(255, 255, 255, 0.45);
    backdrop-filter: blur(16px) saturate(1.4);
    -webkit-backdrop-filter: blur(16px) saturate(1.4);
    border: 1px solid rgba(255, 255, 255, 0.5);
    border-radius: 0 0 0.75rem 0.75rem;
    margin: 0 0.5rem;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
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

  .bottom-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: rgba(255, 255, 255, 0.55);
    backdrop-filter: blur(16px) saturate(1.4);
    -webkit-backdrop-filter: blur(16px) saturate(1.4);
    border-top: 1px solid rgba(255, 255, 255, 0.5);
    box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.06);
    z-index: 10;
  }

  .bottom-btn {
    padding: 0.5rem 1.25rem;
    font-size: 0.875rem;
    font-weight: 500;
    background: rgba(255, 255, 255, 0.5);
    color: #495057;
    border: 1px solid rgba(255, 255, 255, 0.4);
    border-radius: 0.5rem;
    cursor: pointer;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }

  .bottom-btn:hover {
    background: rgba(255, 255, 255, 0.7);
  }
</style>
