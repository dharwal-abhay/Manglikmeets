/* Admin dashboard — live Supabase data + actions. */
(function () {
  'use strict';

  const client = window.ManglikAuth?.client;
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  /* ── Toast ──────────────────────────────────────────────── */
  let toastTimer;
  function toast(message) {
    const target = $('#admin-toast');
    target.textContent = message;
    target.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => target.classList.remove('show'), 3500);
  }

  /* ── Confirm dialog ─────────────────────────────────────── */
  const state = { view: 'overview', pendingAction: null, users: [], reportFilter: 'all' };

  function openConfirm(action, detail, onConfirm) {
    state.pendingAction = onConfirm;
    const modal = $('#admin-confirm');
    if (!modal) return;
    $('#admin-confirm-title').textContent = `${action} this record?`;
    $('#admin-confirm-copy').textContent = detail;
    modal.hidden = false;
    modal.classList.add('show');
    modal.style.setProperty('display', 'grid', 'important');
  }
  function closeConfirm() {
    state.pendingAction = null;
    const modal = $('#admin-confirm');
    if (!modal) return;
    modal.hidden = true;
    modal.classList.remove('show');
    modal.style.setProperty('display', 'none', 'important');
  }

  /* ── View switcher ──────────────────────────────────────── */
  function setView(view) {
    state.view = view;
    $$('.admin-view').forEach((s) => s.classList.toggle('active', s.dataset.adminSection === view));
    $$('.admin-nav-item').forEach((b) => b.classList.toggle('active', b.dataset.adminView === view));
    $('#admin-sidebar').classList.remove('open');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ── Static overview widgets ────────────────────────────── */
  function activityMarkup() {
    return ['New mutual match created', 'Profile review submitted', 'Community post approved', 'Report resolved']
      .map((item, i) => `<li><i class="activity-icon">${['♡','✓','✦','⚑'][i]}</i><div><strong>${item}</strong><span>${['Rohan and Aanya started a conversation.','Meera Iyer joined the profile queue.','A relationship tip reached 1,200 members.','A message report was closed with a warning.'][i]}</span></div><time>${['Now','8m','24m','41m'][i]}</time></li>`)
      .join('');
  }

  /* ── Live: load real users from Supabase ────────────────── */
  async function loadUsers() {
    if (!client) return;
    try {
      const { data, error } = await client
        .from('profiles')
        .select('id, full_name, city, state, created_at, is_verified, is_online, last_active_at, account_status')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) { console.warn('[Admin] loadUsers error:', error.message); return; }
      state.users = (data || []).map((u) => ({
        id: u.id,
        name: u.full_name || 'Unknown',
        email: '',
        city: [u.city, u.state].filter(Boolean).join(', ') || '—',
        joined: new Date(u.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        status: u.account_status === 'suspended' ? 'suspended' : u.is_verified ? 'verified' : 'pending',
        activity: u.is_online ? 'Online now' : u.last_active_at ? timeSince(u.last_active_at) : '—',
        initials: (u.full_name || '??').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
        is_verified: u.is_verified,
        account_status: u.account_status
      }));
      renderUsers();

      // Update overview metric
      const total = $('#total-member-metric');
      if (total) total.textContent = state.users.length.toLocaleString();
    } catch (err) {
      console.warn('[Admin] loadUsers exception:', err.message);
    }
  }

  function timeSince(isoString) {
    const seconds = Math.floor((Date.now() - new Date(isoString)) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
  }

  /* ── Live: load contact messages count from Supabase ────── */
  async function loadContactMessagesCount() {
    if (!client) return;
    try {
      const { count, error } = await client
        .from('contact_messages')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'new');
      if (error) {
        console.warn('[Admin] loadContactMessagesCount error:', error.message);
        return;
      }
      const metric = $('#contact-metric-count');
      if (metric) metric.textContent = String(count ?? 0);
      const side = $('#contact-sidebar-count');
      if (side) side.textContent = String(count ?? 0);
    } catch (err) {
      console.warn('[Admin] loadContactMessagesCount exception:', err.message);
    }
  }

  /* ── Render users table ─────────────────────────────────── */
  function renderUsers() {
    const term = ($('#user-search-input')?.value || '').toLowerCase();
    const statusFilter = $('#user-status-filter')?.value || 'all';
    const filtered = state.users.filter((u) =>
      (statusFilter === 'all' || u.status === statusFilter) &&
      `${u.name} ${u.city}`.toLowerCase().includes(term)
    );
    const tbody = $('#users-table-body');
    if (!tbody) return;
    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:#999">No users found</td></tr>`;
      $('#user-table-summary').textContent = 'No results';
      return;
    }
    tbody.innerHTML = filtered.map((u) => `
      <tr data-user-id="${u.id}">
        <td><div class="member-cell"><span class="member-initials">${u.initials}</span><div><strong>${u.name}</strong><span style="font-size:11px;color:#999">${u.id.slice(0, 8)}…</span></div></div></td>
        <td>${u.city}</td>
        <td>${u.joined}</td>
        <td><span class="admin-status status-${u.status}">${u.status}</span></td>
        <td>${u.activity}</td>
        <td><div class="user-actions">
          <button type="button" data-user-action="verify" ${u.is_verified ? 'disabled title="Already verified"' : ''}>Verify</button>
          <button type="button" data-user-action="${u.account_status === 'suspended' ? 'unsuspend' : 'suspend'}">${u.account_status === 'suspended' ? 'Unsuspend' : 'Suspend'}</button>
          <button class="danger" type="button" data-user-action="delete">Delete</button>
        </div></td>
      </tr>`).join('');
    $('#user-table-summary').textContent = `Showing ${filtered.length} of ${state.users.length} users`;
  }

  /* ── Admin actions against Supabase ─────────────────────── */
  async function applyUserAction(userId, action) {
    if (!client) { toast('Supabase client not available.'); return; }
    try {
      let update = {};
      if (action === 'verify') update = { is_verified: true };
      else if (action === 'suspend') update = { account_status: 'suspended' };
      else if (action === 'unsuspend') update = { account_status: 'active' };
      else if (action === 'delete') update = { account_status: 'deleted' };

      const { error } = await client.from('profiles').update(update).eq('id', userId);
      if (error) throw error;

      // Update local state so re-render reflects change immediately
      const user = state.users.find((u) => u.id === userId);
      if (user) {
        if (action === 'verify') { user.is_verified = true; user.status = 'verified'; }
        if (action === 'suspend') { user.account_status = 'suspended'; user.status = 'suspended'; }
        if (action === 'unsuspend') { user.account_status = 'active'; user.status = user.is_verified ? 'verified' : 'pending'; }
        if (action === 'delete') { user.account_status = 'deleted'; state.users = state.users.filter((u) => u.id !== userId); }
      }
      renderUsers();
      toast(`✓ ${action.charAt(0).toUpperCase() + action.slice(1)} applied successfully.`);
    } catch (err) {
      console.error('[Admin] action error:', err);
      toast(`Action failed: ${err.message}`);
    }
  }

  /* ── Static reports / moderation / profiles / content ───── */
  const reports = [
    { id:'r1', type:'message', subject:'Message report from Aanya Sharma', detail:'Reported for language that felt disrespectful in a private conversation.', time:'12 min ago', priority:'High' },
    { id:'r2', type:'profile', subject:'Profile review: incomplete information', detail:'A member flagged an inconsistency between profile details and uploaded images.', time:'38 min ago', priority:'Medium' },
    { id:'r3', type:'content', subject:'Community post requires moderation', detail:'A discussion comment was reported by two community members.', time:'1 hr ago', priority:'Medium' },
    { id:'r4', type:'message', subject:'Message report from Meera Iyer', detail:'Reported a conversation for repeated unsolicited messages.', time:'Yesterday', priority:'High' }
  ];
  const profileReviews = [
    { id:'p1', name:'Meera Iyer', initials:'MI', city:'Bengaluru', notes:['Profile photo uploaded','Bio complete','Mobile pending'] },
    { id:'p2', name:'Neel Shah', initials:'NS', city:'Ahmedabad', notes:['Profile photo uploaded','Education provided','Review preferences'] },
    { id:'p3', name:'Tanya Kapoor', initials:'TK', city:'Pune', notes:['Bio complete','Identity submitted','Mobile pending'] }
  ];

  function renderReports() {
    const filtered = reports.filter((r) => state.reportFilter === 'all' || r.type === state.reportFilter);
    $('#reports-grid').innerHTML = filtered.map((r) => `<article class="report-card" data-report-id="${r.id}"><header class="report-card-head"><strong>${r.subject}</strong><span>${r.type} · ${r.priority}</span></header><p>${r.detail}</p><footer><small>${r.time}</small><button type="button" data-report-action="review">Review report</button></footer></article>`).join('');
    $('#report-count').textContent = reports.length;
    $('#open-report-metric').textContent = reports.length;
  }

  function renderModeration() {
    const msgReports = reports.filter((r) => r.type === 'message');
    $('#message-reports').innerHTML = msgReports.map((r) => `<div class="moderation-row"><i class="review-icon">✉</i><div><strong>${r.subject}</strong><span>${r.detail}</span></div><button type="button" data-report-action="review" data-report-id="${r.id}">Open</button></div>`).join('');
    $('#community-moderation').innerHTML = ['Comment reported in "First conversations"','Event description needs review','Community post awaiting approval'].map((label, i) => `<div class="moderation-row"><i class="review-icon">✦</i><div><strong>${label}</strong><span>${['Two reports · 1 hour ago','Policy check · Today','New submission · 2 hours ago'][i]}</span></div><button type="button" data-content-action="review">Review</button></div>`).join('');
  }

  function renderProfiles() {
    $('#profile-review-grid').innerHTML = profileReviews.map((p) => `<article class="profile-review-card" data-profile-review-id="${p.id}"><span class="member-initials">${p.initials}</span><h2>${p.name}</h2><p>${p.city} · Submitted today</p><ul>${p.notes.map((n) => `<li>${n}</li>`).join('')}</ul><footer><button class="accept" type="button" data-profile-action="approve">Approve</button><button type="button" data-profile-action="review">Review</button></footer></article>`).join('');
    $('#profile-review-count').textContent = profileReviews.length;
  }

  function renderContent() {
    $('#content-queue').innerHTML = ['Relationship tip: "Questions that build trust"','Community discussion: "Balancing family and individuality"','Virtual event: "Ask a matchmaker"'].map((item, i) => `<div class="content-row"><i class="review-icon">${['▤','◌','◷'][i]}</i><div><strong>${item}</strong><span>${['Draft · Submitted today','Comment activity · 3 reports','Event listing · Scheduled 18 Aug'][i]}</span></div><button type="button" data-content-action="review">Review</button></div>`).join('');
  }

  function reviewQueueMarkup() {
    return reports.slice(0, 3).map((r) => `<div class="review-row"><i class="review-icon">${r.type==='message'?'✉':r.type==='profile'?'◉':'✦'}</i><div><strong>${r.subject}</strong><span>${r.priority} priority · ${r.time}</span></div><button type="button" data-admin-view="reports">Review</button></div>`).join('');
  }

  /* ── Wire everything up ─────────────────────────────────── */
  function initialise() {
    closeConfirm();
    $('#activity-list').innerHTML = activityMarkup();
    $('#review-queue').innerHTML = reviewQueueMarkup();
    renderReports();
    renderModeration();
    renderProfiles();
    renderContent();
    loadUsers(); // live Supabase fetch
    loadContactMessagesCount(); // live contact messages count fetch

    // Nav
    $$('.admin-nav-item').forEach((b) => b.addEventListener('click', () => setView(b.dataset.adminView)));
    $$('[data-admin-view]').forEach((b) => { if (!b.classList.contains('admin-nav-item')) b.addEventListener('click', () => setView(b.dataset.adminView)); });

    // User search & filter
    $('#user-search-input')?.addEventListener('input', renderUsers);
    $('#user-status-filter')?.addEventListener('change', renderUsers);

    // User action buttons (verify / suspend / delete)
    $('#users-table-body').addEventListener('click', (event) => {
      const button = event.target.closest('[data-user-action]');
      if (!button) return;
      const row = button.closest('[data-user-id]');
      const userId = row?.dataset.userId;
      const action = button.dataset.userAction;
      const user = state.users.find((u) => u.id === userId);
      if (!user || !userId) return;

      const labels = { verify: 'Verify', suspend: 'Suspend', unsuspend: 'Unsuspend', delete: 'Permanently delete' };
      const warnings = { delete: ' This cannot be undone.' };
      openConfirm(
        labels[action] || action,
        `${labels[action] || action} ${user.name}.${warnings[action] || ''}`,
        () => applyUserAction(userId, action)
      );
    });

    // Confirm dialog
    $('#admin-confirm-cancel').addEventListener('click', closeConfirm);
    $('#admin-confirm-continue').addEventListener('click', async () => {
      const fn = state.pendingAction;
      closeConfirm();
      if (typeof fn === 'function') await fn();
    });

    // Menu toggle
    $('#admin-menu').addEventListener('click', () => $('#admin-sidebar').classList.toggle('open'));

    // Report filters
    $$('.report-filter').forEach((b) => b.addEventListener('click', () => {
      state.reportFilter = b.dataset.reportFilter;
      $$('.report-filter').forEach((item) => item.classList.toggle('active', item === b));
      renderReports();
    }));

    // Static action toasts
    $('#reports-grid').addEventListener('click', (e) => { if (e.target.closest('[data-report-action]')) toast('Report opened for review.'); });
    $$('[data-admin-action]').forEach((b) => b.addEventListener('click', () => toast(`${b.dataset.adminAction.replaceAll('-', ' ')} is ready for an admin backend.`)));
    $$('[data-profile-action],[data-content-action]').forEach((b) => b.addEventListener('click', () => toast('Review action recorded.')));
  }

  initialise();
}());
