<script lang="ts">
  let { onDismiss }: { onDismiss: () => void } = $props();
</script>

<div class="onboarding">
  <h2 class="onboarding-title">Welcome to Outside Time</h2>
  <ol class="steps">
    <li class="step">
      <span class="step-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </span>
      <div class="step-text">
        <strong>Track your outdoor time</strong>
        <span>Tap "Go Outside" to start a timer when you head out, and stop it when you come back in.</span>
      </div>
    </li>
    <li class="step">
      <span class="step-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24" aria-hidden="true">
          <path d="M12 20V10" />
          <path d="M18 20V4" />
          <path d="M6 20v-4" />
        </svg>
      </span>
      <div class="step-text">
        <strong>Set goals and review progress</strong>
        <span>See daily and weekly summaries, and set time-outside goals to keep yourself accountable.</span>
      </div>
    </li>
    <li class="step">
      <span class="step-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24" aria-hidden="true">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </span>
      <div class="step-text">
        <strong>Private by design</strong>
        <span>Your data is encrypted on your device before it ever leaves. No account needed &mdash; just open and go.</span>
      </div>
    </li>
  </ol>
  <button class="dismiss-btn" onclick={onDismiss}>Got it</button>
</div>

<style>
  .onboarding {
    margin: 0 1rem 1.5rem;
    padding: 1.25rem 1.25rem 1rem;
    background: rgba(255, 255, 255, 0.55);
    backdrop-filter: blur(16px) saturate(1.4);
    -webkit-backdrop-filter: blur(16px) saturate(1.4);
    border: 1px solid rgba(255, 255, 255, 0.5);
    border-radius: 0.75rem;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  }

  .onboarding-title {
    margin: 0 0 1rem;
    font-size: 1.125rem;
    font-weight: 700;
    color: #2d6a4f;
    text-align: center;
  }

  .steps {
    list-style: none;
    margin: 0;
    padding: 0;
    counter-reset: step;
  }

  .step {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    margin-bottom: 1rem;
    counter-increment: step;
  }

  .step:last-child {
    margin-bottom: 0.75rem;
  }

  .step-icon {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    background: rgba(45, 106, 79, 0.1);
    border-radius: 0.5rem;
    color: #2d6a4f;
  }

  .step-icon svg {
    width: 1.25rem;
    height: 1.25rem;
  }

  .step-text {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    min-width: 0;
  }

  .step-text strong {
    font-size: 0.9375rem;
    color: #212529;
  }

  .step-text span {
    font-size: 0.8125rem;
    color: #6c757d;
    line-height: 1.4;
  }

  .dismiss-btn {
    display: block;
    width: 100%;
    padding: 0.625rem;
    font-size: 0.875rem;
    font-weight: 600;
    background: rgba(45, 106, 79, 0.08);
    color: #2d6a4f;
    border: 1px solid rgba(45, 106, 79, 0.15);
    border-radius: 0.5rem;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .dismiss-btn:hover {
    background: rgba(45, 106, 79, 0.15);
  }
</style>
