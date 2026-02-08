<script lang="ts">
  import type { Session } from '../session';
  import { computeTodaySummary, computeWeekSummary, formatDuration } from '../session';

  let { sessions }: { sessions: Session[] } = $props();

  let today = $derived(computeTodaySummary(sessions));
  let week = $derived(computeWeekSummary(sessions));
</script>

<div class="summary">
  <div class="summary-card">
    <h3>Today</h3>
    <div class="stat">
      <span class="stat-value">{today.sessionCount}</span>
      <span class="stat-label">{today.sessionCount === 1 ? 'session' : 'sessions'}</span>
    </div>
    <div class="stat">
      <span class="stat-value">{formatDuration(today.totalMinutes)}</span>
      <span class="stat-label">outside</span>
    </div>
  </div>
  <div class="summary-card">
    <h3>This Week</h3>
    <div class="stat">
      <span class="stat-value">{week.sessionCount}</span>
      <span class="stat-label">{week.sessionCount === 1 ? 'session' : 'sessions'}</span>
    </div>
    <div class="stat">
      <span class="stat-value">{formatDuration(week.totalMinutes)}</span>
      <span class="stat-label">outside</span>
    </div>
  </div>
</div>

<style>
  .summary {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    padding: 0 1rem;
    margin-bottom: 1.5rem;
  }

  .summary-card {
    background: rgba(255, 255, 255, 0.45);
    backdrop-filter: blur(16px) saturate(1.4);
    -webkit-backdrop-filter: blur(16px) saturate(1.4);
    border: 1px solid rgba(255, 255, 255, 0.5);
    border-radius: 0.5rem;
    padding: 1rem;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  }

  .summary-card h3 {
    margin: 0 0 0.5rem;
    font-size: 0.875rem;
    color: #6c757d;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .stat {
    display: flex;
    align-items: baseline;
    gap: 0.375rem;
    margin-bottom: 0.25rem;
  }

  .stat-value {
    font-size: 1.25rem;
    font-weight: 700;
    color: #2d6a4f;
  }

  .stat-label {
    font-size: 0.875rem;
    color: #6c757d;
  }
</style>
