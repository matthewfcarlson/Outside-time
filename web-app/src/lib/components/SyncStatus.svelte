<script lang="ts">
  let { state, lastSyncAt, onSync }: {
    state: 'idle' | 'syncing' | 'error' | 'offline';
    lastSyncAt: number;
    onSync: () => Promise<void>;
  } = $props();

  let statusText = $derived.by(() => {
    switch (state) {
      case 'syncing': return 'Syncing...';
      case 'error': return 'Sync failed';
      case 'offline': return 'Offline';
      default:
        if (lastSyncAt === 0) return 'Not synced';
        const ago = Math.floor(Date.now() / 1000) - lastSyncAt;
        if (ago < 60) return 'Synced just now';
        if (ago < 3600) return `Synced ${Math.floor(ago / 60)}m ago`;
        return `Synced ${Math.floor(ago / 3600)}h ago`;
    }
  });
</script>

<div class="sync-status">
  <div class="sync-info">
    <span class="sync-dot" class:active={state === 'idle' && lastSyncAt > 0} class:error={state === 'error'} class:offline={state === 'offline'} class:syncing={state === 'syncing'}></span>
    <span class="sync-text">{statusText}</span>
  </div>
  <button class="sync-btn" onclick={onSync} disabled={state === 'syncing'}>
    Sync Now
  </button>
</div>

<style>
  .sync-status {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 0.75rem;
    border-top: 1px solid #e9ecef;
  }

  .sync-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .sync-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #adb5bd;
  }

  .sync-dot.active {
    background: #2d6a4f;
  }

  .sync-dot.error {
    background: #dc3545;
  }

  .sync-dot.offline {
    background: #ffc107;
  }

  .sync-dot.syncing {
    background: #2d6a4f;
    animation: pulse 1s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  .sync-text {
    font-size: 0.8125rem;
    color: #6c757d;
  }

  .sync-btn {
    padding: 0.25rem 0.625rem;
    font-size: 0.75rem;
    font-weight: 500;
    background: #e9ecef;
    color: #495057;
    border: none;
    border-radius: 0.25rem;
    cursor: pointer;
  }

  .sync-btn:hover:not(:disabled) {
    background: #dee2e6;
  }

  .sync-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
