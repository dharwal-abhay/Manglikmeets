/* Shared authentication and role guard for member and administrator routes. */
(function () {
  'use strict';
  const protectedPages = new Set(['dashboard.html','discover.html','feed.html','matches.html','messages.html','notifications.html','saved.html','settings.html','admin.html','admin-contact.html']);
  const currentPage = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  if (!protectedPages.has(currentPage)) return;

  const redirectToLogin = () => {
    const next = `${currentPage}${location.hash || ''}`;
    location.replace(`index.html?next=${encodeURIComponent(next)}`);
  };
  const deny = (message) => {
    document.body.innerHTML = `<main style="min-height:100vh;display:grid;place-items:center;padding:24px;font-family:system-ui;color:#362b2d"><section style="max-width:480px;text-align:center"><p style="color:#c47a3e;font-weight:700">Manglik Meets</p><h1>${message}</h1><p>This area is restricted to the appropriate account role.</p><a href="dashboard.html">Return to your dashboard</a></section></main>`;
  };
  const run = async () => {
    const auth = window.ManglikAuth;
    if (!auth?.client) return deny('Authentication is unavailable');
    const session = await auth.start();
    if (!session?.user) return redirectToLogin();
    const requiredRole = document.body?.dataset?.requiredRole || (currentPage.startsWith('admin') ? 'admin' : 'user');
    if (requiredRole === 'user') return;
    const jwtRole = session.user.app_metadata?.role;
    if (jwtRole === 'admin') return;
    try {
      const { data, error } = await auth.client.from('user_roles').select('roles(name)').eq('user_id', session.user.id);
      if (error || !data || !data.some((entry) => {
        const roleName = Array.isArray(entry.roles) ? entry.roles[0]?.name : entry.roles?.name;
        return roleName === requiredRole || (requiredRole === 'moderator' && roleName === 'admin');
      })) return deny('Access restricted');
    } catch { deny('Access restricted'); }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
  window.ManglikRouteGuard = { run, redirectToLogin };
}());
