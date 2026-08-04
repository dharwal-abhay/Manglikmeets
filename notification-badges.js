/* Shared unread-notification badge state for the static prototype. */
(function () {
  'use strict';
  const key = 'manglik-meets-unread-notifications';
  const readCount = () => Number(localStorage.getItem(key) || 5);
  const render = (count = readCount()) => {
    document.querySelectorAll('[data-notification-badge]').forEach((badge) => {
      badge.hidden = count <= 0;
      badge.textContent = String(count);
    });
    document.querySelectorAll('[data-notification-dot]').forEach((dot) => { dot.hidden = count <= 0; });
  };
  const setUnreadCount = (count) => {
    const safeCount = Math.max(0, Number(count) || 0);
    localStorage.setItem(key, String(safeCount));
    render(safeCount);
    window.dispatchEvent(new CustomEvent('manglik-notification-count', { detail: { count: safeCount } }));
  };
  window.ManglikNotificationBadges = { getUnreadCount: readCount, setUnreadCount, render };
  document.addEventListener('DOMContentLoaded', () => render(), { once: true });
}());
