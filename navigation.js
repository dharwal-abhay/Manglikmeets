/* Shared authenticated navigation and account identity for member pages. */
(function () {
  'use strict';

  const routes = {
    dashboard: 'dashboard.html',
    discover: 'discover.html',
    profile: 'dashboard.html#profile',
    messages: 'messages.html',
    matches: 'matches.html',
    notifications: 'notifications.html',
    saved: 'saved.html',
    settings: 'settings.html'
  };
  const currentPage = (location.pathname.split('/').pop() || 'dashboard.html').toLowerCase();
  const textKey = (text) => {
    const normalized = text.trim().toLowerCase();
    if (normalized.includes('home') || normalized.includes('dashboard')) return 'dashboard';
    if (normalized.includes('discover')) return 'discover';
    if (normalized.includes('profile')) return 'profile';
    if (normalized.includes('message')) return 'messages';
    if (normalized.includes('match')) return 'matches';
    if (normalized.includes('notification')) return 'notifications';
    if (normalized.includes('saved')) return 'saved';
    if (normalized.includes('setting')) return 'settings';
    return '';
  };
  const initials = (name) => String(name || 'Member').split(/\s+/).filter(Boolean).map((word) => word[0]).join('').slice(0, 2).toUpperCase() || 'MM';

  function activeKey() {
    if (currentPage === 'dashboard.html') return location.hash === '#profile' ? 'profile' : 'dashboard';
    return currentPage.replace('.html', '');
  }

  function connectNavigation() {
    document.querySelectorAll('.sidebar-nav').forEach((nav) => {
      nav.querySelectorAll('.nav-item').forEach((item) => {
        let key = item.dataset.navItem || textKey(item.textContent);
        if (key === 'home') key = 'dashboard';
        if (!routes[key]) return;
        item.dataset.navKey = key;
        if (item.tagName === 'BUTTON') {
          const link = document.createElement('a');
          [...item.attributes].forEach((attribute) => {
            if (attribute.name !== 'type' && attribute.name !== 'data-future-action') link.setAttribute(attribute.name, attribute.value);
          });
          link.className = item.className;
          link.href = routes[key];
          link.innerHTML = item.innerHTML;
          link.dataset.navKey = key;
          item.replaceWith(link);
          item = link;
        } else {
          item.href = routes[key];
        }
        item.classList.toggle('active', key === activeKey());
      });
    });

    document.querySelectorAll('.brand').forEach((brand) => { brand.href = routes.dashboard; });
    document.querySelectorAll('.top-avatar').forEach((avatar) => { avatar.href = routes.profile; });
    document.querySelectorAll('[data-future-action="logout"], .logout-button').forEach((button) => {
      button.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        try { await window.ManglikSupabase.auth.signOut('global'); } catch (error) { console.error('Unable to sign out:', error); }
        location.replace('index.html');
      }, true);
    });
  }
  async function loadIdentity() {
    const auth = window.ManglikAuth;
    const session = await auth?.start();
    if (!session?.user) return;
    let profile = null;
    try { profile = await window.ManglikSupabase?.profile.mine(); } catch (error) { console.warn('Profile identity could not load:', error); }
    const fullName = profile?.name || session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Member';
    let avatarUrl = '';
    try {
      const media = await window.ManglikSupabase?.profile.mediaUrls(profile?.profile_media || []);
      avatarUrl = media?.find((item) => item.media_type === 'avatar')?.url || '';
    } catch (error) { console.warn('Avatar could not load:', error); }
    const avatarText = initials(fullName);
    document.querySelectorAll('.top-avatar').forEach((avatar) => {
      avatar.textContent = avatarText;
      avatar.setAttribute('aria-label', `Open ${fullName}'s profile`);
      if (avatarUrl) {
        avatar.style.backgroundImage = `url("${avatarUrl}")`;
        avatar.style.backgroundSize = 'cover';
        avatar.style.backgroundPosition = 'center';
        avatar.style.color = 'transparent';
      }
    });
    document.querySelectorAll('[data-current-user-name]').forEach((element) => { element.textContent = fullName; });
    document.querySelectorAll('[data-current-user-initials]').forEach((element) => { element.textContent = avatarText; });
    document.querySelectorAll('[data-current-user-username]').forEach((element) => { element.textContent = profile?.username ? `@${profile.username}` : ''; });
    document.querySelectorAll('[data-current-user-email]').forEach((element) => { element.textContent = session.user.email || ''; });
    const mobileInput = document.querySelector('#mobile-number');
    if (mobileInput && profile?.mobile_number) mobileInput.value = profile.mobile_number;
    document.documentElement.dataset.authenticatedUser = session.user.id;

    // Check if logged-in user is an admin, and dynamically append the Admin Panel nav link
    const jwtRole = session.user.app_metadata?.role;
    let isAdmin = jwtRole === 'admin';
    if (!isAdmin) {
      try {
        const { data } = await auth.client.from('user_roles').select('roles(name)').eq('user_id', session.user.id);
        if (data && data.some((entry) => entry.roles?.name === 'admin')) {
          isAdmin = true;
        }
      } catch (e) {
        console.warn('Error checking admin role in navigation:', e);
      }
    }

    if (isAdmin) {
      document.querySelectorAll('.sidebar-nav').forEach((nav) => {
        if (nav.querySelector('[data-nav-item="admin"]') || nav.querySelector('[data-nav-key="admin"]')) return;

        const adminItem = document.createElement('a');
        adminItem.className = 'nav-item';
        adminItem.href = 'admin.html';
        adminItem.dataset.navItem = 'admin';
        adminItem.dataset.navKey = 'admin';
        adminItem.innerHTML = '<span>▦</span>Admin Panel';

        const settingsItem = nav.querySelector('[data-nav-item="settings"]') || nav.querySelector('[data-nav-key="settings"]');
        if (settingsItem) {
          nav.insertBefore(adminItem, settingsItem);
        } else {
          nav.appendChild(adminItem);
        }

        const currentPageName = (location.pathname.split('/').pop() || 'dashboard.html').toLowerCase();
        if (currentPageName === 'admin.html' || currentPageName === 'admin-contact.html') {
          adminItem.classList.add('active');
        }
      });
    }
  }
  document.addEventListener('DOMContentLoaded', () => {
    connectNavigation();
    loadIdentity();
  }, { once: true });
  window.ManglikNavigation = { routes, connectNavigation, loadIdentity };
}());
