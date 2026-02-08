<script lang="ts">
  let { onBack }: { onBack: () => void } = $props();
</script>

<div class="about-page">
  <header>
    <button class="back-btn" onclick={onBack} aria-label="Back">
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
        <li>Time is rounded up to the nearest minute</li>
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

<style>
  .about-page header {
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

  .about-page h1 {
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

  .about-content {
    padding: 1rem;
  }

  .about-card {
    background: rgba(255, 255, 255, 0.45);
    backdrop-filter: blur(16px) saturate(1.4);
    -webkit-backdrop-filter: blur(16px) saturate(1.4);
    border: 1px solid rgba(255, 255, 255, 0.5);
    border-radius: 0.5rem;
    padding: 1rem 1.25rem;
    margin-bottom: 0.75rem;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
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
</style>
