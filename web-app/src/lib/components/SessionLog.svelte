<script lang="ts">
  import type { Session } from '../session';
  import type { OutsideEvent } from '../events';
  import {
    appendEvent,
    formatTime,
    formatDate,
    formatDuration,
    toDatetimeLocal,
    fromDatetimeLocal,
  } from '../session';
  import { createManualEntry, createCorrection } from '../events';

  let { sessions, events: allEvents, debugMode, onchange, onpush }: {
    sessions: Session[];
    events: OutsideEvent[];
    debugMode: boolean;
    onchange: () => void;
    onpush: (event: OutsideEvent) => Promise<void>;
  } = $props();

  let editingId: string | null = $state(null);
  let debugId: string | null = $state(null);
  let editStart = $state('');
  let editEnd = $state('');

  let showManualForm = $state(false);
  let manualStart = $state('');
  let manualEnd = $state('');

  function startEdit(session: Session) {
    editingId = session.id;
    editStart = toDatetimeLocal(session.startedAt);
    editEnd = toDatetimeLocal(session.endedAt);
  }

  function cancelEdit() {
    editingId = null;
  }

  function saveEdit() {
    if (!editingId) return;
    const startTs = fromDatetimeLocal(editStart);
    const endTs = fromDatetimeLocal(editEnd);
    if (endTs <= startTs) return;

    const durationMinutes = (endTs - startTs) / 60;
    const correction = createCorrection(editingId, 'replace', {
      started_at: startTs,
      ended_at: endTs,
      duration_minutes: durationMinutes,
    });
    appendEvent(correction);
    editingId = null;
    onchange();
    onpush(correction);
  }

  function deleteSession(id: string) {
    if (!confirm('Delete this session?')) return;
    const correction = createCorrection(id, 'delete');
    appendEvent(correction);
    onchange();
    onpush(correction);
  }

  function openManualForm() {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3600000);
    manualStart = toDatetimeLocal(Math.floor(oneHourAgo.getTime() / 1000));
    manualEnd = toDatetimeLocal(Math.floor(now.getTime() / 1000));
    showManualForm = true;
  }

  function cancelManual() {
    showManualForm = false;
  }

  function saveManual() {
    const startTs = fromDatetimeLocal(manualStart);
    const endTs = fromDatetimeLocal(manualEnd);
    if (endTs <= startTs) return;

    const entry = createManualEntry(startTs, endTs);
    appendEvent(entry);
    showManualForm = false;
    onchange();
    onpush(entry);
  }

  function getRelatedEvents(sessionId: string): OutsideEvent[] {
    return allEvents.filter((e) => {
      if (e.id === sessionId) return true;
      if (e.type === 'timer_stop' && e.data.start_event_id === sessionId) return true;
      if (e.type === 'correction' && e.data.corrects_event_id === sessionId) return true;
      return false;
    });
  }

  function toggleDebug(sessionId: string) {
    debugId = debugId === sessionId ? null : sessionId;
  }

  function isToday(unixSeconds: number): boolean {
    const d = new Date(unixSeconds * 1000);
    const now = new Date();
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  }
</script>

<div class="session-log">
  <div class="log-header">
    <h2>Session Log</h2>
    <button class="add-btn" onclick={openManualForm}>+ Add Entry</button>
  </div>

  {#if showManualForm}
    <div class="entry-form">
      <div class="form-row">
        <label class="form-label">
          Start
          <input type="datetime-local" bind:value={manualStart} />
        </label>
        <label class="form-label">
          End
          <input type="datetime-local" bind:value={manualEnd} />
        </label>
      </div>
      <div class="form-actions">
        <button class="btn save" onclick={saveManual}>Save</button>
        <button class="btn cancel" onclick={cancelManual}>Cancel</button>
      </div>
    </div>
  {/if}

  {#if sessions.length === 0}
    <p class="empty">No sessions yet. Go outside!</p>
  {:else}
    <ul class="sessions">
      {#each sessions as session (session.id)}
        <li class="session-item">
          {#if editingId === session.id}
            <div class="entry-form">
              <div class="form-row">
                <label class="form-label">
                  Start
                  <input type="datetime-local" bind:value={editStart} />
                </label>
                <label class="form-label">
                  End
                  <input type="datetime-local" bind:value={editEnd} />
                </label>
              </div>
              <div class="form-actions">
                <button class="btn save" onclick={saveEdit}>Save</button>
                <button class="btn cancel" onclick={cancelEdit}>Cancel</button>
              </div>
            </div>
          {:else}
            <div class="session-row">
              <div class="session-info">
                <span class="session-date">
                  {isToday(session.startedAt) ? 'Today' : formatDate(session.startedAt)}
                </span>
                <span class="session-time">
                  {formatTime(session.startedAt)} &ndash; {formatTime(session.endedAt)}
                </span>
              </div>
              <div class="session-meta">
                <span class="session-duration">{formatDuration(session.durationMinutes)}</span>
                <span class="session-source">{session.source}</span>
              </div>
              <div class="session-actions">
                <button class="btn-action" onclick={() => startEdit(session)}>Edit</button>
                <button class="btn-action delete" onclick={() => deleteSession(session.id)}>Del</button>
                {#if debugMode}
                  <button class="btn-action debug" onclick={() => toggleDebug(session.id)}>Debug</button>
                {/if}
              </div>
            </div>
            {#if debugMode && debugId === session.id}
              <div class="debug-panel">
                <div class="debug-title">Related Events</div>
                {#each getRelatedEvents(session.id) as evt}
                  <pre class="debug-json">{JSON.stringify(evt, null, 2)}</pre>
                {/each}
              </div>
            {/if}
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .session-log {
    padding: 0 1rem;
  }

  .log-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .log-header h2 {
    margin: 0;
    font-size: 1.125rem;
    color: #212529;
  }

  .add-btn {
    padding: 0.375rem 0.75rem;
    font-size: 0.875rem;
    font-weight: 500;
    background: #2d6a4f;
    color: white;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
  }

  .add-btn:hover {
    background: #245a42;
  }

  .entry-form {
    background: white;
    border-radius: 0.5rem;
    padding: 1rem;
    margin-bottom: 0.75rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
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
  }

  .form-label input:focus {
    outline: none;
    border-color: #2d6a4f;
    box-shadow: 0 0 0 2px rgba(45, 106, 79, 0.15);
  }

  .form-actions {
    display: flex;
    gap: 0.5rem;
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

  .empty {
    text-align: center;
    color: #6c757d;
    padding: 2rem 0;
    font-style: italic;
  }

  .sessions {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .session-item {
    margin-bottom: 0.5rem;
  }

  .session-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    background: white;
    border-radius: 0.5rem;
    padding: 0.75rem 1rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  }

  .session-info {
    flex: 1;
    min-width: 0;
  }

  .session-date {
    display: block;
    font-size: 0.75rem;
    color: #6c757d;
    margin-bottom: 0.125rem;
  }

  .session-time {
    display: block;
    font-size: 0.9375rem;
    color: #212529;
    font-weight: 500;
  }

  .session-meta {
    text-align: right;
    flex-shrink: 0;
  }

  .session-duration {
    display: block;
    font-size: 1rem;
    font-weight: 700;
    color: #2d6a4f;
  }

  .session-source {
    display: block;
    font-size: 0.6875rem;
    color: #adb5bd;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .session-actions {
    display: flex;
    gap: 0.25rem;
    flex-shrink: 0;
  }

  .btn-action {
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    font-weight: 500;
    background: #e9ecef;
    color: #495057;
    border: none;
    border-radius: 0.25rem;
    cursor: pointer;
  }

  .btn-action:hover {
    background: #dee2e6;
  }

  .btn-action.delete {
    color: #dc3545;
  }

  .btn-action.delete:hover {
    background: #f8d7da;
  }

  .btn-action.debug {
    color: #6f42c1;
  }

  .btn-action.debug:hover {
    background: #e8dff5;
  }

  .debug-panel {
    background: #f8f9fa;
    border: 1px solid #dee2e6;
    border-radius: 0.375rem;
    padding: 0.75rem;
    margin-top: 0.5rem;
  }

  .debug-title {
    font-size: 0.6875rem;
    font-weight: 600;
    color: #6f42c1;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.5rem;
  }

  .debug-json {
    font-family: 'Courier New', Courier, monospace;
    font-size: 0.6875rem;
    color: #212529;
    background: white;
    border: 1px solid #e9ecef;
    border-radius: 0.25rem;
    padding: 0.5rem;
    margin: 0 0 0.375rem;
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-all;
  }

  .debug-json:last-child {
    margin-bottom: 0;
  }
</style>
