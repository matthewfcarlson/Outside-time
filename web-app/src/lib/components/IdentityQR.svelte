<script lang="ts">
  import { type Identity, exportSecretKey } from '../crypto';
  import QRCode from 'qrcode';

  let { identity }: { identity: Identity } = $props();

  let showQR = $state(false);
  let showWarning = $state(false);
  let qrDataUrl = $state('');
  let syncUrl = $state('');
  let copyLabel = $state('Copy URL to Clipboard');

  function requestShowQR() {
    showWarning = true;
  }

  async function confirmShowQR() {
    showWarning = false;
    const secretKeyBase64 = exportSecretKey(identity);
    syncUrl = `${window.location.origin}/#key=${encodeURIComponent(secretKeyBase64)}`;
    try {
      qrDataUrl = await QRCode.toDataURL(syncUrl, {
        width: 256,
        margin: 2,
        color: { dark: '#212529', light: '#ffffff' },
      });
      showQR = true;
    } catch (e) {
      console.error('Failed to generate QR code:', e);
    }
  }

  function hideQR() {
    showQR = false;
    qrDataUrl = '';
    syncUrl = '';
    copyLabel = 'Copy URL to Clipboard';
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(syncUrl);
      copyLabel = 'Copied!';
      setTimeout(() => {
        copyLabel = 'Copy URL to Clipboard';
      }, 2000);
    } catch {
      copyLabel = 'Copy failed';
      setTimeout(() => {
        copyLabel = 'Copy URL to Clipboard';
      }, 2000);
    }
  }

  function cancelWarning() {
    showWarning = false;
  }

  let publicKeyShort = $derived(
    identity.publicKeyHex.slice(0, 8) + '...' + identity.publicKeyHex.slice(-8)
  );
</script>

<div class="identity-section">
  <h3>Your Identity</h3>
  <p class="pubkey">{publicKeyShort}</p>

  {#if showWarning}
    <div class="warning-box">
      <h4>Security Warning</h4>
      <p>
        This QR code contains your <strong>private key</strong>. Anyone who scans
        it will have <strong>full access</strong> to your data &mdash; they can
        read all your sessions and add new entries.
      </p>
      <ul>
        <li>Only show this QR code to your own devices.</li>
        <li>Never share it with anyone else.</li>
        <li>Do not screenshot it or save it where others can access it.</li>
        <li>Your key cannot be revoked &mdash; once shared, access is permanent.</li>
      </ul>
      <div class="warning-actions">
        <button class="btn danger" onclick={confirmShowQR}>
          I understand, show QR code
        </button>
        <button class="btn cancel" onclick={cancelWarning}>
          Cancel
        </button>
      </div>
    </div>
  {:else if showQR}
    <div class="qr-container">
      <img src={qrDataUrl} alt="Identity QR Code" class="qr-image" />
      <p class="qr-hint">Scan on another device to sync your identity.</p>
      <div class="qr-actions">
        <button class="btn primary" onclick={copyUrl}>{copyLabel}</button>
        <button class="btn cancel" onclick={hideQR}>Hide QR Code</button>
      </div>
    </div>
  {:else}
    <button class="btn primary" onclick={requestShowQR}>
      Generate QR Code for Device Sync
    </button>
  {/if}
</div>

<style>
  .identity-section {
    margin-bottom: 1rem;
  }

  h3 {
    margin: 0 0 0.375rem;
    font-size: 0.875rem;
    color: #212529;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .pubkey {
    margin: 0 0 0.75rem;
    font-family: 'Courier New', Courier, monospace;
    font-size: 0.8125rem;
    color: #6c757d;
    word-break: break-all;
  }

  .warning-box {
    background: #fff3cd;
    border: 1px solid #ffc107;
    border-radius: 0.5rem;
    padding: 1rem;
    margin-bottom: 0.75rem;
  }

  .warning-box h4 {
    margin: 0 0 0.5rem;
    font-size: 0.9375rem;
    color: #856404;
  }

  .warning-box p {
    margin: 0 0 0.5rem;
    font-size: 0.8125rem;
    color: #856404;
    line-height: 1.4;
  }

  .warning-box ul {
    margin: 0 0 0.75rem;
    padding-left: 1.25rem;
    font-size: 0.8125rem;
    color: #856404;
    line-height: 1.6;
  }

  .warning-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .qr-container {
    text-align: center;
  }

  .qr-image {
    display: block;
    margin: 0 auto 0.5rem;
    border-radius: 0.375rem;
    max-width: 256px;
  }

  .qr-hint {
    margin: 0 0 0.75rem;
    font-size: 0.8125rem;
    color: #6c757d;
  }

  .qr-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
    flex-wrap: wrap;
  }

  .btn {
    padding: 0.375rem 0.75rem;
    font-size: 0.8125rem;
    font-weight: 500;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
  }

  .btn.primary {
    background: #2d6a4f;
    color: white;
  }

  .btn.primary:hover {
    background: #245a42;
  }

  .btn.danger {
    background: #dc3545;
    color: white;
  }

  .btn.danger:hover {
    background: #c82333;
  }

  .btn.cancel {
    background: #e9ecef;
    color: #495057;
  }

  .btn.cancel:hover {
    background: #dee2e6;
  }
</style>
