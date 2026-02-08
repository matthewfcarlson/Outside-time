<script lang="ts">
  import type { Session } from '../session';
  import type { Goal } from '../session';
  import type { OutsideEvent } from '../events';
  import { appendEvent, computeGoalProgress, formatDuration } from '../session';
  import { createGoalSet, createGoalDelete } from '../events';

  let { sessions, goals, onchange, onpush }: {
    sessions: Session[];
    goals: Goal[];
    onchange: () => void;
    onpush: (event: OutsideEvent) => Promise<void>;
  } = $props();

  let showForm = $state(false);
  let targetHours = $state(1);
  let targetMinutes = $state(0);
  let period = $state<'day' | 'week' | 'month' | 'year'>('week');

  const periodLabels: Record<string, string> = {
    day: 'Today',
    week: 'This Week',
    month: 'This Month',
    year: 'This Year',
  };

  function openForm() {
    targetHours = 1;
    targetMinutes = 0;
    period = 'week';
    showForm = true;
  }

  function cancelForm() {
    showForm = false;
  }

  function saveGoal() {
    const totalMinutes = targetHours * 60 + targetMinutes;
    if (totalMinutes <= 0) return;
    const event = createGoalSet(totalMinutes, period);
    appendEvent(event);
    showForm = false;
    onchange();
    onpush(event);
  }

  function deleteGoal(goalId: string) {
    if (!confirm('Delete this goal?')) return;
    const event = createGoalDelete(goalId);
    appendEvent(event);
    onchange();
    onpush(event);
  }
</script>

<div class="goals">
  <div class="goals-header">
    <h2>Goals</h2>
    <button class="add-btn" onclick={openForm}>+ Add Goal</button>
  </div>

  {#if showForm}
    <div class="goal-form">
      <div class="form-row">
        <label class="form-label">
          Period
          <select bind:value={period}>
            <option value="day">Daily</option>
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
            <option value="year">Yearly</option>
          </select>
        </label>
      </div>
      <div class="form-row">
        <label class="form-label">
          Hours
          <input type="number" min="0" max="999" bind:value={targetHours} />
        </label>
        <label class="form-label">
          Minutes
          <input type="number" min="0" max="59" bind:value={targetMinutes} />
        </label>
      </div>
      <div class="form-actions">
        <button class="btn save" onclick={saveGoal}>Save</button>
        <button class="btn cancel" onclick={cancelForm}>Cancel</button>
      </div>
    </div>
  {/if}

  {#if goals.length === 0 && !showForm}
    <p class="empty">No goals set. Add one to track your progress!</p>
  {:else}
    <ul class="goal-list">
      {#each goals as goal (goal.id)}
        {@const progress = computeGoalProgress(goal, sessions)}
        <li class="goal-item">
          <div class="goal-row">
            <div class="goal-info">
              <span class="goal-period">{periodLabels[goal.period]}</span>
              <span class="goal-target">Target: {formatDuration(goal.targetMinutes)}</span>
            </div>
            <div class="goal-progress-text">
              <span class="goal-current">{formatDuration(progress.currentMinutes)}</span>
              <span class="goal-percentage">{progress.percentage}%</span>
            </div>
            <div class="goal-actions">
              <button class="btn-action delete" onclick={() => deleteGoal(goal.id)}>Del</button>
            </div>
          </div>
          <div class="progress-bar">
            <div
              class="progress-fill"
              class:complete={progress.percentage >= 100}
              style="width: {progress.percentage}%"
            ></div>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .goals {
    padding: 0 1rem;
    margin-bottom: 1.5rem;
  }

  .goals-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .goals-header h2 {
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

  .goal-form {
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

  .form-row:first-child {
    grid-template-columns: 1fr;
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

  .form-label input,
  .form-label select {
    padding: 0.5rem;
    border: 1px solid #dee2e6;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    color: #212529;
    background: white;
  }

  .form-label input:focus,
  .form-label select:focus {
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
    padding: 1rem 0;
    font-style: italic;
    font-size: 0.875rem;
  }

  .goal-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .goal-item {
    background: white;
    border-radius: 0.5rem;
    padding: 0.75rem 1rem;
    margin-bottom: 0.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  }

  .goal-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .goal-info {
    flex: 1;
    min-width: 0;
  }

  .goal-period {
    display: block;
    font-size: 0.875rem;
    font-weight: 600;
    color: #212529;
  }

  .goal-target {
    display: block;
    font-size: 0.75rem;
    color: #6c757d;
  }

  .goal-progress-text {
    text-align: right;
    flex-shrink: 0;
  }

  .goal-current {
    display: block;
    font-size: 1rem;
    font-weight: 700;
    color: #2d6a4f;
  }

  .goal-percentage {
    display: block;
    font-size: 0.6875rem;
    color: #6c757d;
  }

  .goal-actions {
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

  .progress-bar {
    height: 0.375rem;
    background: #e9ecef;
    border-radius: 0.1875rem;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: #2d6a4f;
    border-radius: 0.1875rem;
    transition: width 0.3s ease;
  }

  .progress-fill.complete {
    background: #198754;
  }
</style>
