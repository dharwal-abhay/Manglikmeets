/* Live support inbox. This page requires an authenticated user with admin role. */
(function () {
  'use strict';
  const api = window.ManglikSupabase;
  const $ = (selector) => document.querySelector(selector);
  const state = { messages: [], selected: null, query: '', status: 'all', user: null, channel: null };

  const escape = (value) => String(value || '').replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#039;', '"':'&quot;' })[char]);
  const toast = (message) => {
    const node = $('#contact-admin-toast');
    if (!node) return;
    node.textContent = message;
    node.classList.add('show');
    clearTimeout(node._timer);
    node._timer = setTimeout(() => node.classList.remove('show'), 3600);
  };
  const stamp = (value) => new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  const initials = (name) => String(name || '?').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();

  const visible = () => state.messages.filter((item) => {
    const matchesStatus = state.status === 'all' || item.status === state.status;
    const searchable = `${item.name || ''} ${item.email || ''} ${item.subject || ''} ${item.message || ''}`.toLowerCase();
    const matchesQuery = !state.query || searchable.includes(state.query);
    return matchesStatus && matchesQuery;
  });

  function renderList() {
    const items = visible();
    const loading = $('#contact-inbox-loading');
    if (loading) loading.hidden = true;

    const list = $('#contact-inbox-list');
    if (list) {
      list.innerHTML = items.map((item) => `
        <article class="contact-row ${item.status === 'new' ? 'unread' : ''} ${state.selected?.id === item.id ? 'active' : ''}" data-contact-id="${item.id}">
          <span class="contact-row-avatar">${escape(initials(item.name))}</span>
          <div class="contact-row-copy">
            <strong>${escape(item.name || 'Anonymous')}</strong>
            <span>${escape(item.subject || 'No Subject')}</span>
            <small>${escape(item.email)} · ${stamp(item.created_at)}</small>
          </div>
          <b class="contact-status ${escape(item.status)}">${escape(item.status.replace(/_/g, ' '))}</b>
        </article>
      `).join('');
    }

    const empty = $('#contact-inbox-empty');
    if (empty) empty.hidden = items.length !== 0;

    const summary = $('#contact-inbox-summary');
    if (summary) summary.textContent = `${items.length} message${items.length === 1 ? '' : 's'}`;

    const unreadCount = $('#contact-unread-count');
    if (unreadCount) unreadCount.textContent = state.messages.filter((item) => item.status === 'new').length;
  }

  function renderDetail() {
    const panel = $('#contact-detail-panel');
    if (!panel) return;
    const item = state.selected;

    if (!item) {
      panel.innerHTML = '<div class="contact-detail-empty"><span>✉</span><h2>Select a message</h2><p>Read the full note, send a reply, or update its status.</p></div>';
      return;
    }

    panel.innerHTML = `
      <div class="contact-detail-content">
        <header class="contact-detail-head">
          <div>
            <p class="contact-panel-head">Support message</p>
            <h2>${escape(item.subject || 'No Subject')}</h2>
            <p class="contact-detail-meta">
              From <strong>${escape(item.name || 'Anonymous')}</strong> · <a href="mailto:${encodeURIComponent(item.email)}">${escape(item.email)}</a><br>
              Received ${stamp(item.created_at)} ${item.user_id ? '· <em>Registered Member</em>' : '· <em>Visitor</em>'}
            </p>
          </div>
          <b class="contact-status ${escape(item.status)}">${escape(item.status.replace(/_/g, ' '))}</b>
        </header>
        <article class="contact-detail-message">${escape(item.message)}</article>
        <div class="contact-detail-actions">
          <button type="button" data-contact-action="read">Mark read</button>
          <button type="button" data-contact-action="replied">Mark replied</button>
          <button type="button" data-contact-action="in_progress">Mark in progress</button>
          <button type="button" data-contact-action="resolved">Mark resolved</button>
          <button type="button" data-contact-action="closed">Mark closed</button>
          <button type="button" data-contact-action="archived">Archive</button>
          <button class="danger" type="button" data-contact-action="delete">Delete</button>
        </div>
        <form class="contact-reply-form" id="contact-reply-form">
          <label for="contact-reply">Reply to ${escape(item.name || item.email)}</label>
          <textarea id="contact-reply" minlength="2" maxlength="4000" required placeholder="Write a clear, helpful response…"></textarea>
          <footer>
            <small>Directly saves status to Supabase database.</small>
            <button type="submit">Send reply</button>
          </footer>
        </form>
      </div>
    `;
  }

  async function load() {
    const loading = $('#contact-inbox-loading');
    if (loading) loading.hidden = false;

    try {
      const client = api?.client || window.ManglikAuth?.client;
      if (!client) throw new Error('Supabase client not available.');

      const { data, error } = await client.from('contact_messages').select('*').order('created_at', { ascending: false });
      if (error) throw error;

      state.messages = data || [];
      if (state.selected) {
        state.selected = state.messages.find((item) => item.id === state.selected.id) || null;
      }
      renderList();
      renderDetail();
    } catch (error) {
      console.error('[Admin contact inbox load error]:', error);
      if (loading) {
        loading.textContent = `Unable to load the inbox: ${error.message}`;
        loading.hidden = false;
      }
    }
  }

  async function update(id, status) {
    try {
      const client = api?.client || window.ManglikAuth?.client;
      const { error } = await client.from('contact_messages').update({ status }).eq('id', id);
      if (error) throw error;
      await load();
      toast(status === 'archived' ? 'Message archived.' : `Message marked ${status.replace(/_/g, ' ')}.`);
    } catch (error) {
      console.error('[Admin contact update error]:', error);
      toast(`Could not update message: ${error.message}`);
    }
  }

  async function remove(id) {
    if (!window.confirm('Delete this support message permanently?')) return;
    try {
      const client = api?.client || window.ManglikAuth?.client;
      const { error } = await client.from('contact_messages').delete().eq('id', id);
      if (error) throw error;
      state.selected = null;
      await load();
      toast('Message deleted.');
    } catch (error) {
      console.error('[Admin contact delete error]:', error);
      toast(`Could not delete message: ${error.message}`);
    }
  }

  async function reply(event) {
    event.preventDefault();
    const replyInput = $('#contact-reply');
    const replyText = replyInput ? replyInput.value.trim() : '';
    if (replyText.length < 2) return;

    const button = event.currentTarget.querySelector('button[type="submit"]');
    if (button) {
      button.disabled = true;
      button.textContent = 'Sending…';
    }

    try {
      // 1. Update status to 'replied' in Supabase database
      await update(state.selected.id, 'replied');

      // 2. Trigger notification function if configured
      try {
        const session = await window.ManglikAuth?.start();
        if (session?.access_token) {
          await fetch('/.netlify/functions/contact-reply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ id: state.selected.id, reply: replyText })
          });
        }
      } catch (fnError) {
        console.warn('[Optional email delivery note]:', fnError.message);
      }

      toast('Status updated to replied.');
      if (replyInput) replyInput.value = '';
    } catch (error) {
      toast(error.message || 'Could not update reply status.');
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = 'Send reply';
      }
    }
  }

  async function initialise() {
    try {
      await window.ManglikAuth?.start();
      const client = api?.client || window.ManglikAuth?.client;
      if (!client) throw new Error('Authentication is unavailable.');

      state.user = await (api?.requireUser ? api.requireUser() : client.auth.getUser().then(r => r.data?.user));
      if (!state.user) throw new Error('Please log in as an administrator.');

      const jwtRole = state.user.app_metadata?.role;
      let isAdmin = jwtRole === 'admin';
      if (!isAdmin) {
        try {
          const { data } = await client.from('user_roles').select('roles(name)').eq('user_id', state.user.id);
          if (data && data.some((entry) => (Array.isArray(entry.roles) ? entry.roles[0]?.name : entry.roles?.name) === 'admin')) {
            isAdmin = true;
          }
        } catch (e) {
          console.warn('Error checking admin role in contact inbox:', e);
        }
      }

      if (!isAdmin) throw new Error('This inbox is available to support administrators only.');

      await load();

      // Realtime subscription
      state.channel = client.channel('admin-contact-inbox')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'contact_messages' }, load)
        .subscribe();
    } catch (error) {
      const loading = $('#contact-inbox-loading');
      if (loading) {
        loading.textContent = error.message;
        loading.hidden = false;
      }
    }
  }

  $('#contact-inbox-search')?.addEventListener('input', (event) => {
    state.query = event.target.value.trim().toLowerCase();
    renderList();
  });

  $('#contact-status-filter')?.addEventListener('change', (event) => {
    state.status = event.target.value;
    renderList();
  });

  $('#refresh-contact-inbox')?.addEventListener('click', load);

  $('#contact-inbox-list')?.addEventListener('click', (event) => {
    const row = event.target.closest('[data-contact-id]');
    if (!row) return;
    state.selected = state.messages.find((item) => item.id === row.dataset.contactId) || null;
    renderList();
    renderDetail();
  });

  $('#contact-detail-panel')?.addEventListener('click', (event) => {
    const action = event.target.closest('[data-contact-action]');
    if (!action || !state.selected) return;
    const actionType = action.dataset.contactAction;
    if (actionType === 'delete') {
      remove(state.selected.id);
    } else {
      update(state.selected.id, actionType);
    }
  });

  $('#contact-detail-panel')?.addEventListener('submit', (event) => {
    if (event.target.id === 'contact-reply-form') {
      reply(event);
    }
  });

  $('#contact-admin-menu')?.addEventListener('click', () => {
    $('#contact-admin-sidebar')?.classList.toggle('open');
  });

  initialise();
}());
