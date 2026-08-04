/* Local Notification Center prototype with a future Supabase Realtime contract. */
(function () {
  'use strict';
  if (window.ManglikSupabase?.client) return;

  const notifications = [
    { id: 'n1', group: 'Today', category: 'message', icon: '✉', actor: 'Rohan Mehta', title: 'sent you a new message', detail: '“That sounds like a lovely plan.”', time: '10 min ago', unread: true },
    { id: 'n2', group: 'Today', category: 'match', icon: '♡', actor: 'Vihaan Kapoor', title: 'is a new compatible match', detail: 'You share family values, Hindi and a love for thoughtful travel.', time: '34 min ago', unread: true },
    { id: 'n3', group: 'Today', category: 'like', icon: '♥', actor: 'Kabir Singh', title: 'liked your profile', detail: 'Your profile is now in Kabir’s saved introductions.', time: '1 hr ago', unread: true },
    { id: 'n4', group: 'Yesterday', category: 'view', icon: '◉', actor: 'Meera Iyer', title: 'viewed your profile', detail: 'A new member from Bengaluru took a look at your profile.', time: 'Yesterday', unread: false },
    { id: 'n5', group: 'Yesterday', category: 'verification', icon: '✓', actor: 'Manglik Meets', title: 'profile review is complete', detail: 'Your profile details are ready for the community.', time: 'Yesterday', unread: true },
    { id: 'n6', group: 'Older', category: 'community', icon: '✦', actor: 'Community Circle', title: 'started a discussion you may enjoy', detail: 'What makes a first conversation feel more natural?', time: '2 days ago', unread: false },
    { id: 'n7', group: 'Older', category: 'system', icon: '◌', actor: 'Manglik Meets', title: 'updated its community guidelines', detail: 'A few small updates to keep conversations respectful and safe.', time: '4 days ago', unread: false }
  ];

  const state = { filter: 'all', query: '' };
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
  let toastTimer;

  function showToast(message) { const toast = $('#notifications-toast'); toast.textContent = message; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 2900); }
  function matchingNotifications() { const term = state.query.trim().toLowerCase(); return notifications.filter((notification) => (state.filter === 'all' || notification.category === state.filter) && (!term || `${notification.actor} ${notification.title} ${notification.detail}`.toLowerCase().includes(term))); }
  function notificationRow(notification) { return `<article class="notification-row ${notification.unread ? 'unread' : ''}" data-notification-id="${notification.id}"><span class="notification-icon icon-${notification.category}">${notification.icon}</span><div class="notification-copy"><strong>${notification.actor} ${notification.title}</strong><span>${notification.detail}</span></div><div class="notification-meta"><small>${notification.time}</small>${notification.unread ? '<i class="unread-indicator" aria-label="Unread"></i>' : ''}<div class="notification-row-actions"><button type="button" data-notification-action="${notification.unread ? 'read' : 'unread'}" aria-label="${notification.unread ? 'Mark as read' : 'Mark as unread'}">${notification.unread ? '✓' : '•'}</button><button type="button" data-notification-action="delete" aria-label="Delete notification">×</button></div></div></article>`; }
  function render() {
    const matching = matchingNotifications();
    const groups = ['Today', 'Yesterday', 'Older'];
    $('#notification-list').innerHTML = groups.map((group) => { const items = matching.filter((item) => item.group === group); return items.length ? `<section class="notification-group"><h3>${group}</h3>${items.map(notificationRow).join('')}</section>` : ''; }).join('');
    $('#notifications-empty').hidden = matching.length !== 0;
    const unread = notifications.filter((notification) => notification.unread).length;
    $('#notification-summary').textContent = unread ? `You have ${unread} unread update${unread === 1 ? '' : 's'} waiting.` : 'You are all caught up.';
    window.ManglikNotificationBadges?.setUnreadCount(unread);
  }
  function getNotification(id) { return notifications.find((notification) => notification.id === id); }
  function deleteNotification(id) { const index = notifications.findIndex((notification) => notification.id === id); if (index >= 0) { notifications.splice(index, 1); render(); showToast('Notification deleted.'); } }
  function handleNotificationAction(action, id) { const notification = getNotification(id); if (!notification) return; if (action === 'delete') deleteNotification(id); else { notification.unread = action === 'unread'; render(); showToast(notification.unread ? 'Notification marked unread.' : 'Notification marked read.'); } }

  function initialiseEvents() {
    $('#notification-list').addEventListener('click', (event) => { const action = event.target.closest('[data-notification-action]'); if (action) handleNotificationAction(action.dataset.notificationAction, action.closest('[data-notification-id]').dataset.notificationId); });
    $('#mark-all-read').addEventListener('click', () => { notifications.forEach((notification) => { notification.unread = false; }); render(); showToast('All notifications marked as read.'); });
    $('#clear-read').addEventListener('click', () => { for (let index = notifications.length - 1; index >= 0; index -= 1) if (!notifications[index].unread) notifications.splice(index, 1); render(); showToast('Read notifications cleared.'); });
    $('#notification-search-input').addEventListener('input', (event) => { state.query = event.target.value; render(); });
    $$('.notification-filter').forEach((button) => button.addEventListener('click', () => { state.filter = button.dataset.notificationFilter; $$('.notification-filter').forEach((item) => { item.classList.toggle('active', item === button); item.setAttribute('aria-selected', String(item === button)); }); render(); }));
    $('#notifications-mobile-menu').addEventListener('click', () => { const sidebar = $('#notifications-sidebar'); const isOpen = sidebar.classList.toggle('open'); $('#notifications-mobile-menu').setAttribute('aria-expanded', String(isOpen)); });
  }

  /* Supabase query and Realtime subscription contract — no live channel is opened in the static prototype. */
  window.notificationsRealtimeAdapter = {
    getListQuery() { return { table: 'notifications', select: 'id, user_id, category, actor_id, title, body, metadata, read_at, created_at, profiles!notifications_actor_id_fkey(full_name, avatar_url)', filters: { user_id: 'current-user' }, order: { column: 'created_at', ascending: false } }; },
    getReadUpdate(notificationId, isRead) { return { table: 'notifications', id: notificationId, values: { read_at: isRead ? new Date().toISOString() : null } }; },
    getDeleteRequest(notificationId) { return { table: 'notifications', id: notificationId }; },
    subscribe(client, userId, onNotification) { return client.channel(`notifications:${userId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, onNotification).subscribe(); }
  };

  render(); initialiseEvents();
}());
