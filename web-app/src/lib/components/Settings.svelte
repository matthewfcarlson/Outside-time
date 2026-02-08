<script lang="ts">
  import IdentityQR from './IdentityQR.svelte';
  import SyncStatus from './SyncStatus.svelte';
  import type { Identity } from '../crypto';

  let {
    identity,
    syncState,
    lastSyncAt,
    onSync,
    debugMode,
    onToggleDebug,
    onBack,
  }: {
    identity: Identity;
    syncState: 'idle' | 'syncing' | 'error' | 'offline';
    lastSyncAt: number;
    onSync: () => Promise<void>;
    debugMode: boolean;
    onToggleDebug: () => void;
    onBack: () => void;
  } = $props();
</script>

<div class="settings-page">
  <header>
    <button class="back-btn" onclick={onBack} aria-label="Back">
      &larr; Back
    </button>
    <h1>Settings</h1>
  </header>

  <section class="settings-content">
    <div class="settings-card">
      <IdentityQR {identity} />
    </div>

    <div class="settings-card">
      <SyncStatus state={syncState} {lastSyncAt} {onSync} />
    </div>

    <div class="settings-card">
      <div class="debug-toggle">
        <label class="debug-label">
          <input type="checkbox" checked={debugMode} onchange={onToggleDebug} />
          Debug mode
        </label>
      </div>
    </div>
  </section>
</div>

<style>
  .settings-page header {
    text-align: left;
    padding: 1.5rem 1rem 0;
    position: relative;
    background: rgba(255, 255, 255, 0.45);
    backdrop-filter: blur(16px) saturate(1.4);
    -webkit-backdrop-filter: blur(16px) saturate(1.4);
    border: 1px solid rgba(255, 255, 255, 0.5);
    border-radius: 0 0 0.75rem 0.75rem;
    margin: 0 0.5rem;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  }

  .settings-page h1 {
    text-align: center;
    margin: 0 0 0.25rem;
    font-size: 1.5rem;
    font-weight: 700;
    color: #2d6a4f;
  }

  .back-btn {
    padding: 0.375rem 0.75rem;
    font-size: 0.8125rem;
    font-weight: 500;
    background: rgba(255, 255, 255, 0.5);
    color: #495057;
    border: 1px solid rgba(255, 255, 255, 0.4);
    border-radius: 0.375rem;
    cursor: pointer;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }

  .back-btn:hover {
    background: rgba(255, 255, 255, 0.7);
  }

  .settings-content {
    padding: 1rem;
  }

  .settings-card {
    background: rgba(255, 255, 255, 0.45);
    backdrop-filter: blur(16px) saturate(1.4);
    -webkit-backdrop-filter: blur(16px) saturate(1.4);
    border: 1px solid rgba(255, 255, 255, 0.5);
    border-radius: 0.5rem;
    padding: 1rem 1.25rem;
    margin-bottom: 0.75rem;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
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
