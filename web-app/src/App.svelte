<script lang="ts">
  import Timer from './lib/components/Timer.svelte';
  import Summary from './lib/components/Summary.svelte';
  import SessionLog from './lib/components/SessionLog.svelte';
  import { loadEvents, reconstructSessions, type Session } from './lib/session';

  let events = $state(loadEvents());
  let sessions: Session[] = $derived(reconstructSessions(events));

  function refresh() {
    events = loadEvents();
  }
</script>

<main>
  <header>
    <h1>Outside Time</h1>
    <p class="tagline">Track your outdoor time, privately.</p>
  </header>

  <Timer onchange={refresh} />
  <Summary {sessions} />
  <SessionLog {sessions} onchange={refresh} />
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
</style>
