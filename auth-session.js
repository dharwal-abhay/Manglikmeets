/* Shared Supabase session access for all Manglik Meets pages. */
(function () {
  'use strict';

  const config = window.APP_CONFIG;
  const rememberKey = 'manglik-meets-remember-session';
  const sessionStore = window.sessionStorage;
  const persistentStore = window.localStorage;
  const rememberSession = () => sessionStore.getItem(rememberKey) !== 'false';
  const storage = {
    getItem(key) { return (rememberSession() ? persistentStore : sessionStore).getItem(key); },
    setItem(key, value) { (rememberSession() ? persistentStore : sessionStore).setItem(key, value); },
    removeItem(key) { persistentStore.removeItem(key); sessionStore.removeItem(key); }
  };
  const client = window.supabase?.createClient && config?.SUPABASE_URL && config?.SUPABASE_PUBLISHABLE_KEY
    ? window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage }
      })
    : null;

  let currentSession = null;
  let hasStarted = false;
  const listeners = new Set();

  const notify = () => listeners.forEach((listener) => listener(currentSession));

  const setRememberMe = (remember) => {
    const next = Boolean(remember);
    const active = next ? sessionStore : persistentStore;
    const destination = next ? persistentStore : sessionStore;
    let authKey = null;
    for (let index = 0; index < active.length; index += 1) { const key = active.key(index); if (key?.startsWith('sb-') && key.endsWith('-auth-token')) { authKey = key; break; } }
    if (authKey) { destination.setItem(authKey, active.getItem(authKey)); active.removeItem(authKey); }
    if (next) sessionStore.removeItem(rememberKey); else sessionStore.setItem(rememberKey, 'false');
  };

  const start = async () => {
    if (!client || hasStarted) return currentSession;
    hasStarted = true;
    const { data } = await client.auth.getSession();
    currentSession = data.session;
    notify();
    client.auth.onAuthStateChange((_event, session) => {
      currentSession = session;
      notify();
    });
    return currentSession;
  };

  window.ManglikAuth = {
    client,
    start,
    getSession: () => currentSession,
    getUser: () => currentSession?.user || null,
    setRememberMe,
    getRememberMe: rememberSession,
    async requireUser() {
      const session = await start();
      if (!session?.user) throw new Error('Please sign in to continue.');
      return session.user;
    },
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}());
