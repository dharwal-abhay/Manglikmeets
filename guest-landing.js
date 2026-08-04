/* Keeps the public landing page guest-only while preserving recovery links. */
(function () {
  'use strict';
  const params = new URLSearchParams(location.search);
  const isRecoveryFlow = params.has('code') || location.hash.includes('type=recovery');
  if (isRecoveryFlow) return;
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const session = await window.ManglikAuth?.start();
      if (session?.user) location.replace('dashboard.html');
    } catch (error) { console.warn('Guest session check failed:', error); }
  }, { once: true });
}());
