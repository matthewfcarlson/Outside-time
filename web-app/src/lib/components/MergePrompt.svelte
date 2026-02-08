<script lang="ts">
  interface Props {
    sessionCount: number;
    onMerge: () => void;
    onDiscard: () => void;
  }

  let { sessionCount, onMerge, onDiscard }: Props = $props();
</script>

<div class="merge-overlay">
  <div class="merge-dialog">
    <h2>Merge Sessions?</h2>
    <p>
      You have <strong>{sessionCount}</strong> existing
      session{sessionCount !== 1 ? 's' : ''} on this device.
    </p>
    <p>
      Would you like to merge them into the new account, or start fresh?
    </p>
    <div class="merge-actions">
      <button class="merge-btn" onclick={onMerge}>Merge Sessions</button>
      <button class="discard-btn" onclick={onDiscard}>Start Fresh</button>
    </div>
  </div>
</div>

<style>
  .merge-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .merge-dialog {
    background: white;
    border-radius: 0.75rem;
    padding: 1.5rem;
    max-width: 360px;
    width: 100%;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  }

  h2 {
    margin: 0 0 0.75rem;
    font-size: 1.125rem;
    font-weight: 700;
    color: #212529;
  }

  p {
    margin: 0 0 0.75rem;
    font-size: 0.875rem;
    color: #495057;
    line-height: 1.5;
  }

  .merge-actions {
    display: flex;
    gap: 0.75rem;
    margin-top: 1rem;
  }

  .merge-btn,
  .discard-btn {
    flex: 1;
    padding: 0.625rem 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    border: none;
    border-radius: 0.5rem;
    cursor: pointer;
  }

  .merge-btn {
    background: #2d6a4f;
    color: white;
  }

  .merge-btn:hover {
    background: #245a42;
  }

  .discard-btn {
    background: #e9ecef;
    color: #495057;
  }

  .discard-btn:hover {
    background: #dee2e6;
  }
</style>
