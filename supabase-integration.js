/* Page bindings for live Supabase data. Keeps the existing interface and its data attributes intact. */
(function () {
  'use strict';
  const api = window.ManglikSupabase;
  if (!api?.client) return;

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');
  const escape = (value) => String(value || '').replace(/[&<>'"]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#039;', '"':'&quot;' })[c]);
  const toast = (message) => {
    const node = $('.discover-toast, .matches-toast, .messages-toast, .notifications-toast, .settings-toast, .feed-toast, #dashboard-toast');
    if (!node) return;
    node.textContent = message;
    node.classList.add('show');
    clearTimeout(node._timer); node._timer = setTimeout(() => node.classList.remove('show'), 4200);
  };
  const busy = async (button, action) => {
    if (!button) return action();
    const original = button.textContent; button.disabled = true; button.setAttribute('aria-busy', 'true');
    try { return await action(); } finally { button.disabled = false; button.removeAttribute('aria-busy'); button.textContent = original; }
  };
  const age = (dob) => { if (!dob) return ''; const now = new Date(); const birth = new Date(`${dob}T00:00:00`); let value = now.getFullYear() - birth.getFullYear(); if (now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate())) value -= 1; return value; };
  const profileCard = (person) => `<article class="member-card" data-member-card="${person.id}"><div class="member-visual ${person.avatar_url ? 'has-image' : 'tone-saffron'}"${person.avatar_url ? ` style="background-image:linear-gradient(rgba(52,35,27,.08),rgba(52,35,27,.3)),url('${escape(person.avatar_url)}')"` : ''}><span class="member-compatibility">Member</span><span class="member-initials">${escape((person.full_name || '?').split(' ').map((x) => x[0]).join('').slice(0, 2))}</span></div><div class="member-content"><div class="member-name-row"><h3>${escape(person.full_name)}, ${age(person.date_of_birth) || '—'}</h3>${person.is_verified ? '<span class="verified-mark" title="Verified member">✓</span>' : ''}</div><p class="member-meta">${escape(person.city || 'Location not shared')}${person.state ? `, ${escape(person.state)}` : ''}</p><p class="member-profession">${escape(person.profession || 'Profession not shared')}</p><p class="member-bio">${escape(person.bio || 'A thoughtful member of the Manglik Meets community.')}</p></div><div class="member-actions"><button class="member-action primary" type="button" data-member-action="view" data-member-id="${person.id}">View</button><button class="member-action" type="button" data-member-action="like" data-member-id="${person.id}" aria-label="Like ${escape(person.full_name)}">♡</button><button class="member-action" type="button" data-member-action="save" data-member-id="${person.id}" aria-label="Save ${escape(person.full_name)}">⌑</button><button class="member-action" type="button" data-member-action="message" data-member-id="${person.id}" aria-label="Message ${escape(person.full_name)}">✉</button></div></article>`;

  async function hydrateProfile() {
    if (!$('#profile-editor-form')) return;
    try {
      const remote = await api.profile.mine();
      if (!remote) return;
      if (typeof profileState !== 'undefined') {
        Object.assign(profileState, remote);
        const media = await api.profile.mediaUrls(remote.profile_media || []);

        let avatarUrl = '';
        if (remote.avatar_url) {
          avatarUrl = await api.storage.signedUrl('profile-images', remote.avatar_url);
        }

        let coverUrl = '';
        if (remote.cover_url) {
          coverUrl = await api.storage.signedUrl('profile-images', remote.cover_url);
        }

        profileState.media.avatar = avatarUrl || media.find((item) => item.media_type === 'avatar')?.url || '';
        profileState.media.cover = coverUrl || media.find((item) => item.media_type === 'cover')?.url || '';
        profileState.media.gallery = media.filter((item) => item.media_type === 'gallery').sort((a, b) => a.sort_order - b.sort_order).map((item) => ({ id: item.id, label: item.caption || 'A shared moment', url: item.url, className: '', storage_path: item.storage_path }));
        renderProfile();
      }
    } catch (error) { console.warn('Profile load unavailable:', error.message); }
  }

  function bindProfile() {
    if (!$('#profile-editor-form')) return;
    hydrateProfile();
    ['#profile-editor-form', '#profile-wizard-form'].forEach((selector) => {
      $(selector)?.addEventListener('submit', async () => {
        try { await api.profile.save(profileState); toast('Profile securely saved to your account.'); } catch (error) { toast(`Profile could not be saved: ${error.message}`); }
      });
    });

    document.addEventListener('change', async (event) => {
      const input = event.target;
      if (!input || input.type !== 'file') return;
      const kind = input.dataset.profileMediaInput || input.dataset.wizardMedia || input.dataset.settingMedia ||
        (input.id === 'profile-picture-upload' ? 'avatar' : input.id === 'cover-picture-upload' ? 'cover' : input.id === 'gallery-picture-upload' ? 'gallery' : null);
      if (!kind) return;

      const files = [...(input.files || [])];
      if (!files.length) return;
      event.preventDefault();
      event.stopImmediatePropagation();

      try {
        toast('Uploading photo to Supabase Storage…');
        const uploads = await Promise.all(files.map((file, index) => api.profile.upload(file, kind, kind === 'gallery' ? (profileState.media?.gallery?.length || 0) + index : 0)));
        const item = uploads[0];
        const displayUrl = item?.url || item?.signedUrl;
        if (displayUrl) {
          if (kind === 'avatar') {
            profileState.media.avatar = displayUrl;
            profileState.avatar_url = item.path || item.storage_path;
          }
          if (kind === 'cover') {
            profileState.media.cover = displayUrl;
            profileState.cover_url = item.path || item.storage_path;
          }
        }
        if (kind === 'gallery') {
          uploads.forEach((u) => {
            const gUrl = u?.url || u?.signedUrl;
            if (gUrl && !profileState.media.gallery.some((g) => g.id === u.id || g.storage_path === u.storage_path)) {
              profileState.media.gallery.push({ id: u.id, label: u.caption || 'A shared moment', url: gUrl, className: '', storage_path: u.storage_path });
            }
          });
        }
        renderProfile();
        window.ManglikNavigation?.loadIdentity();
        toast(`${uploads.length} photo${uploads.length === 1 ? '' : 's'} uploaded and saved.`);
      } catch (error) {
        console.error('[Upload error]:', error);
        toast(`Photo upload failed: ${error.message}`);
      }
    }, true);
    $('#gallery-manager-list')?.addEventListener('click', (event) => {
      const row = event.target.closest('[data-gallery-id]'); const item = profileState.media.gallery.find((photo) => photo.id === row?.dataset.galleryId);
      if (!item) return;
      if (event.target.matches('[data-gallery-delete]') && item.storage_path) api.profile.deleteMedia(item).then(() => toast('Photo removed from your gallery.')).catch((error) => toast(error.message));
      if (event.target.dataset.galleryMove) setTimeout(() => api.profile.reorderMedia(profileState.media.gallery.filter((photo) => photo.storage_path)).catch((error) => toast(error.message)), 0);
    }, true);
  }

  function currentFilters() {
    const data = {};
    document.querySelectorAll('[data-filter]').forEach((input) => {
      if (input.type === 'checkbox') {
        if (input.checked) data[input.dataset.filter] = true;
      } else if (input.value && !/^any /i.test(input.value)) {
        data[input.dataset.filter] = input.value;
      }
    });
    if (data.ageMin === '25') delete data.ageMin;
    if (data.ageMax === '35') delete data.ageMax;
    return data;
  }

  async function liveDiscover(event) {
    event?.preventDefault(); event?.stopImmediatePropagation();
    const input = $('#discover-search-input, #member-search-input');
    const recommendedGrid = $('[data-member-grid="recommended"]');
    const compatibleGrid = $('[data-member-grid="compatible"]');
    const nearbyList = $('[data-member-list="nearby"]');
    const newList = $('[data-member-list="new"]');

    if (!recommendedGrid) return;
    recommendedGrid.setAttribute('aria-busy', 'true');
    recommendedGrid.innerHTML = '<div class="empty-members">Searching the community…</div>';

    try {
      const result = await api.profile.search({ query: input?.value || '', filters: currentFilters(), limit: 100 });
      const cardsData = await Promise.all(result.map(async (person) => {
        let avatar_url = person.avatar_url;
        if (avatar_url && !avatar_url.startsWith('http') && !avatar_url.startsWith('data:')) {
          avatar_url = await api.storage.signedUrl('profile-images', avatar_url);
        }
        return { ...person, avatar_url };
      }));

      const html = cardsData.length ? cardsData.map(profileCard).join('') : '<div class="empty-members">No members match those details yet. Try widening your search or filters.</div>';
      recommendedGrid.innerHTML = html;

      if (compatibleGrid) {
        compatibleGrid.innerHTML = cardsData.length > 1 ? cardsData.slice().reverse().map(profileCard).join('') : html;
      }
      if (nearbyList) {
        nearbyList.innerHTML = cardsData.slice(0, 5).map(profileCard).join('');
      }
      if (newList) {
        newList.innerHTML = cardsData.slice(0, 5).map(profileCard).join('');
      }

      $('#recommended-heading').textContent = input?.value ? `Results for “${input.value}”` : 'Recommended matches';
      $('#recommended-subtitle').textContent = `${cardsData.length} live member${cardsData.length === 1 ? '' : 's'} found.`;
    } catch (error) {
      recommendedGrid.innerHTML = '<div class="empty-members">We could not load members right now. Please try again.</div>';
      toast(`Search failed: ${error.message}`);
    } finally {
      recommendedGrid.removeAttribute('aria-busy');
    }
  }
  function bindDiscover() {
    if (!$('#discover-search-form')) return;
    $('#discover-search-form').addEventListener('submit', liveDiscover, true);
    $('#advanced-filters')?.addEventListener('submit', liveDiscover, true);
    $('#filter-toggle')?.addEventListener('click', () => { const filters = $('#advanced-filters'); const open = filters.classList.toggle('is-open'); $('#filter-toggle').setAttribute('aria-expanded', String(open)); });
    $('#discover-mobile-menu')?.addEventListener('click', () => $('#discover-sidebar').classList.toggle('is-open'));
    liveDiscover();
  }

  async function openMemberDrawer(personId) {
    const drawer = $('#member-drawer');
    const backdrop = $('#member-drawer-backdrop');
    const content = $('#member-drawer-content');
    if (!drawer || !content) return;

    drawer.classList.add('is-open', 'open');
    backdrop?.classList.add('is-open', 'open');
    drawer.setAttribute('aria-hidden', 'false');
    content.innerHTML = '<div style="padding:40px;text-align:center;color:#666">Loading profile...</div>';

    try {
      const { data: person } = await api.client.from('profiles').select('*, profile_media(*)').eq('id', personId).single();
      if (!person) throw new Error('Profile not found.');

      let avatarUrl = person.avatar_url;
      if (avatarUrl && !avatarUrl.startsWith('http') && !avatarUrl.startsWith('data:')) {
        avatarUrl = await api.storage.signedUrl('profile-images', avatarUrl);
      }

      const calcAge = (dob) => {
        if (!dob) return '';
        const birth = new Date(`${dob}T00:00:00`);
        const today = new Date();
        let a = today.getFullYear() - birth.getFullYear();
        if (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate())) a -= 1;
        return a > 0 ? a : '';
      };

      const personAge = calcAge(person.date_of_birth);
      const name = escape(person.full_name || 'Member');
      const username = escape(person.username || 'member');
      const city = escape([person.city, person.state].filter(Boolean).join(', ') || 'Location not shared');
      const profession = escape(person.profession || 'Profession not shared');
      const education = escape(person.education || 'Education not shared');
      const manglik = escape(person.manglik_status || 'Manglik status not shared');
      const religion = escape(person.religion || 'Religion not shared');
      const bio = escape(person.bio || 'A thoughtful member of the Manglik Meets community.');
      const initials = escape((person.full_name || '?').split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase());
      const languages = Array.isArray(person.languages) ? person.languages.join(', ') : escape(person.languages || '—');
      const interests = Array.isArray(person.interests) ? person.interests.join(', ') : escape(person.interests || '—');

      content.innerHTML = `
        <div class="member-visual drawer-profile-visual ${avatarUrl ? 'has-image' : 'tone-saffron'}" ${avatarUrl ? `style="background-image:linear-gradient(rgba(52,35,27,.08),rgba(52,35,27,.3)),url('${escape(avatarUrl)}');background-size:cover;background-position:center"` : ''}>
          <span class="member-initials">${initials}</span>
        </div>
        <h2>${name}${personAge ? `, ${personAge}` : ''} ${person.is_verified ? '<span class="verified-mark">✓</span>' : ''}</h2>
        <p class="drawer-subtitle">@${username} · ${city}</p>
        <div class="drawer-data">
          <div><small>Profession</small><strong>${profession}</strong></div>
          <div><small>Education</small><strong>${education}</strong></div>
          <div><small>Manglik status</small><strong>${manglik}</strong></div>
          <div><small>Religion</small><strong>${religion}</strong></div>
          <div><small>Languages</small><strong>${languages}</strong></div>
          <div><small>Interests</small><strong>${interests}</strong></div>
        </div>
        <p class="drawer-bio">${bio}</p>
        <div class="drawer-actions">
          <button class="member-action" type="button" data-member-action="like" data-member-id="${person.id}">♡ Like</button>
          <button class="member-action" type="button" data-member-action="save" data-member-id="${person.id}">⌑ Save</button>
          <button class="member-action primary" type="button" data-member-action="message" data-member-id="${person.id}">✉ Message</button>
        </div>
      `;
    } catch (error) {
      content.innerHTML = `<div style="padding:30px;text-align:center;color:#c43e3e">Could not load profile: ${escape(error.message)}</div>`;
    }
  }

  function closeMemberDrawer() {
    $('#member-drawer')?.classList.remove('is-open', 'open');
    $('#member-drawer-backdrop')?.classList.remove('is-open', 'open');
    $('#member-drawer')?.setAttribute('aria-hidden', 'true');
  }

  function bindSocialActions() {
    $('#member-drawer-close')?.addEventListener('click', closeMemberDrawer);
    $('#member-drawer-backdrop')?.addEventListener('click', closeMemberDrawer);

    document.addEventListener('click', async (event) => {
      const action = event.target.closest('[data-member-action], [data-match-action]');
      if (!action || !isUuid(action.dataset.memberId || action.dataset.personId)) return;
      const id = action.dataset.memberId || action.dataset.personId;
      const type = action.dataset.memberAction || action.dataset.matchAction;
      if (!['view', 'like', 'save', 'pass', 'message'].includes(type)) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (type === 'view') {
        openMemberDrawer(id);
        return;
      }
      try {
        await busy(action, async () => {
          if (type === 'like') await api.social.like(id);
          else if (type === 'save') await api.social.save(id);
          else if (type === 'pass') await api.social.matchAction(id, 'pass');
          else { const conversationId = await api.chat.start(id); sessionStorage.setItem('manglik-meets-open-conversation', conversationId); window.location.href = 'messages.html'; return; }
          toast(type === 'pass' ? 'This suggestion has been passed.' : `${type === 'like' ? 'Like' : 'Saved profile'} updated.`);
        });
      } catch (error) { toast(`Could not update this profile: ${error.message}`); }
    }, true);
  }

  async function bindMatches() {
    const grid = $('#match-grid');
    if (!grid) return;

    const resolveAvatar = async (profile) => {
      if (!profile) return profile;
      let url = profile.avatar_url;
      if (url && !url.startsWith('http') && !url.startsWith('data:')) {
        url = await api.storage.signedUrl('profile-images', url);
      }
      return { ...profile, avatar_url: url || '' };
    };

    const matchCard = (profile, options = {}) => {
      const initials = escape((profile.full_name || '?').split(' ').map((x) => x[0]).join('').slice(0, 2));
      const hasAvatar = !!profile.avatar_url;
      const visualStyle = hasAvatar
        ? ` style="background-image:linear-gradient(rgba(52,35,27,.08),rgba(52,35,27,.3)),url('${escape(profile.avatar_url)}');background-size:cover;background-position:center"`
        : '';
      const unmatchBtn = options.showUnmatch
        ? `<button class="match-action" type="button" data-match-action="unmatch" data-person-id="${profile.id}" aria-label="Unmatch ${escape(profile.full_name)}">✕ Unmatch</button>`
        : `<button class="match-action" type="button" data-match-action="pass" data-person-id="${profile.id}" aria-label="Pass ${escape(profile.full_name)}">×</button>`;

      return `<article class="match-card" data-match-card="${profile.id}">
        <div class="match-visual ${hasAvatar ? 'has-image' : 'tone-saffron'}"${visualStyle}>
          <span class="match-online">${profile.is_online ? '<i></i>Online' : 'Recently active'}</span>
          <span class="match-initials">${initials}</span>
        </div>
        <div class="match-card-body">
          <div class="match-name"><h3>${escape(profile.full_name || 'Member')}, ${age(profile.date_of_birth) || '—'}</h3>${profile.is_verified ? '<span class="match-verified">✓</span>' : ''}</div>
          <p class="match-meta">${escape(profile.city || 'Location not shared')} · ${escape(profile.profession || 'Member')}</p>
          <div class="compatibility-row">
            ${(profile.interests || []).slice(0, 2).map((v) => `<span>${escape(v)}</span>`).join('')}
            <span>${escape(profile.religion || '')}</span>
          </div>
          <div class="match-widget">
            <div><small>Manglik status</small><strong>${escape(profile.manglik_status || '—')}</strong></div>
            <div><small>Education</small><strong>${escape(profile.education || '—')}</strong></div>
          </div>
        </div>
        <div class="match-actions">
          <button class="match-action primary" type="button" data-match-action="view" data-person-id="${profile.id}">View</button>
          <button class="match-action" type="button" data-match-action="like" data-person-id="${profile.id}">♡</button>
          ${unmatchBtn}
          <button class="match-action" type="button" data-match-action="save" data-person-id="${profile.id}">⌑</button>
          <button class="match-action" type="button" data-match-action="message" data-person-id="${profile.id}">✉</button>
        </div>
      </article>`;
    };

    const render = async () => {
      grid.setAttribute('aria-busy', 'true');
      grid.innerHTML = '<div style="padding:40px;text-align:center;color:#666">Loading matches…</div>';
      try {
        const user = await api.requireUser();
        const view = (window.location.hash || '#mutual').slice(1) || 'mutual';

        /* Fetch mutual matches */
        const mutualRows = await api.social.matches();

        /* Fetch pending likes (people who liked me but I haven't liked back) */
        let pendingRows = [];
        try { pendingRows = await api.social.pendingLikes(); } catch (e) { console.warn('Pending likes unavailable:', e.message); }

        /* Fetch suggested profiles (everyone not already matched or pending) */
        let suggestedProfiles = [];
        try {
          const allProfiles = await api.profile.search({ limit: 50 });
          const matchedIds = new Set(mutualRows.map((r) => r.user_one_id === user.id ? r.user_two_id : r.user_one_id));
          const pendingIds = new Set(pendingRows.map((r) => r.user_one_id || r.user_id));
          suggestedProfiles = (allProfiles || []).filter((p) => p.id !== user.id && !matchedIds.has(p.id) && !pendingIds.has(p.id));
        } catch (e) { console.warn('Suggested profiles unavailable:', e.message); }

        /* Resolve avatars for all profile sets */
        const resolveAll = async (rows, getProfile) => {
          return Promise.all(rows.map(async (row) => {
            const profile = getProfile(row, user);
            if (!profile) return null;
            return resolveAvatar(profile);
          }));
        };

        const mutualProfiles = (await resolveAll(mutualRows, (row, u) =>
          row._other || (row.user_one_id === u.id ? (row.user_two || row.matched_user) : (row.user_one || row.user))
        )).filter(Boolean);

        const pendingProfiles = (await resolveAll(pendingRows, (row) =>
          row.user_one || row.matched_user
        )).filter(Boolean);

        const suggested = await Promise.all(suggestedProfiles.slice(0, 20).map(resolveAvatar));

        /* Update counts */
        const suggestedCount = suggested.length;
        const pendingCount = pendingProfiles.length;
        const mutualCount = mutualProfiles.length;
        $('#suggested-count').textContent = suggestedCount;
        $('#pending-count').textContent = pendingCount;
        $('#mutual-count').textContent = mutualCount;
        $('#pending-tab-count').textContent = pendingCount;

        /* Render the active view */
        let items = [];
        let showUnmatch = false;
        if (view === 'mutual') {
          items = mutualProfiles;
          showUnmatch = true;
        } else if (view === 'pending') {
          items = pendingProfiles;
        } else if (view === 'suggested') {
          items = suggested;
        } else if (view === 'favorites') {
          try {
            const savedRows = await api.social.saved();
            items = await Promise.all((savedRows || []).map(async (row) => {
              if (!row.profiles) return null;
              return resolveAvatar(row.profiles);
            }));
            items = items.filter(Boolean);
          } catch (e) { console.warn('Favorites unavailable:', e.message); }
        } else if (view === 'viewed') {
          items = []; /* Recently viewed is client-side only; show empty */
        } else {
          items = suggested;
        }

        grid.innerHTML = items.length
          ? items.map((profile) => matchCard(profile, { showUnmatch })).join('')
          : '';
        $('#matches-empty').hidden = items.length !== 0;
      } catch (error) {
        grid.innerHTML = '';
        $('#matches-empty').hidden = false;
        toast(`Matches could not load: ${error.message}`);
      } finally {
        grid.removeAttribute('aria-busy');
      }
    };

    await render();

    /* Listen for realtime changes to matches table */
    try {
      api.client.channel('live-matches').on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, render).subscribe();
    } catch (e) { console.warn('Realtime subscription not available:', e.message); }

    /* Tab switching */
    document.querySelectorAll('.match-tab').forEach((tab) => tab.addEventListener('click', () => {
      window.location.hash = tab.dataset.matchView;
      document.querySelectorAll('.match-tab').forEach((item) => item.classList.toggle('active', item === tab));
      setTimeout(render, 0);
    }));

    /* Handle unmatch action */
    grid.addEventListener('click', async (event) => {
      const unmatchBtn = event.target.closest('[data-match-action="unmatch"]');
      if (!unmatchBtn) return;
      const profileId = unmatchBtn.dataset.personId;
      if (!profileId || !isUuid(profileId)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      try {
        await busy(unmatchBtn, async () => {
          await api.social.unmatch(profileId);
          toast('You have been unmatched.');
          await render();
        });
      } catch (error) { toast(`Could not unmatch: ${error.message}`); }
    });
  }

  async function bindNotifications() {
    if (!$('#notification-list')) return;
    const render = async () => {
      try { const rows = await api.notifications.list(); const list = $('#notification-list'); list.innerHTML = rows.map((item) => `<article class="notification-row ${item.is_read ? '' : 'unread'}" data-live-notification-id="${item.id}"><span class="notification-icon icon-${escape(item.category)}">✦</span><div class="notification-copy"><strong>${escape(item.actor?.full_name || 'Manglik Meets')} ${escape(item.title)}</strong><span>${escape(item.body || '')}</span></div><div class="notification-meta"><small>${new Date(item.created_at).toLocaleDateString()}</small><div class="notification-row-actions"><button type="button" data-live-notification="${item.is_read ? 'unread' : 'read'}">${item.is_read ? '•' : '✓'}</button><button type="button" data-live-notification="delete">×</button></div></div></article>`).join(''); $('#notifications-empty').hidden = rows.length !== 0; const unread = rows.filter((item) => !item.is_read).length; $('#notification-summary').textContent = unread ? `You have ${unread} unread update${unread === 1 ? '' : 's'} waiting.` : 'You are all caught up.'; window.ManglikNotificationBadges?.setUnreadCount(unread); } catch (error) { toast(`Notifications could not load: ${error.message}`); }
    };
    await render();
    const user = await api.requireUser().catch(() => null); if (user) api.notifications.subscribe(user.id, render);
    $('#notification-list').addEventListener('click', async (event) => { const control = event.target.closest('[data-live-notification]'); if (!control) return; const id = control.closest('[data-live-notification-id]')?.dataset.liveNotificationId; try { if (control.dataset.liveNotification === 'delete') await api.client.from('notifications').delete().eq('id', id); else await api.notifications.read(id, control.dataset.liveNotification === 'read'); await render(); } catch (error) { toast(error.message); } });
    $('#mark-all-read')?.addEventListener('click', async () => { try { await api.notifications.markAllRead(); await render(); } catch (error) { toast(error.message); } });
    $('#clear-read')?.addEventListener('click', async () => { try { await api.notifications.clearRead(); await render(); } catch (error) { toast(error.message); } });
  }

  function bindSettings() {
    if (!$('#settings-account')) return;
    $('#update-email-form')?.addEventListener('submit', async () => { const email = $('#new-email').value.trim(); if (!email) return; try { await api.settings.updateEmail(email); toast('Update email request sent. Check your new inbox if confirmation is enabled.'); } catch (error) { toast(error.message); } });
    $('#change-password-form')?.addEventListener('submit', async () => { const password = $('#new-password').value; if (!password || password !== $('#confirm-password').value) return; try { await api.settings.updatePassword(password); toast('Password updated securely.'); } catch (error) { toast(error.message); } });
    document.querySelectorAll('form[data-supabase-action="update-mobile"], form[data-supabase-action="update-recovery-email"], form[data-supabase-action="update-profile"], form[data-supabase-action="update-privacy"]').forEach((form) => form.addEventListener('submit', async () => { try { const source = {}; form.querySelectorAll('[data-setting-field]').forEach((field) => { source[field.dataset.settingField] = field.type === 'checkbox' ? field.checked : field.value.trim(); }); await api.profile.patch(source); toast('Profile settings saved.'); } catch (error) { toast(error.message); } }));
    document.querySelectorAll('form[data-supabase-action="upsert-notification-preferences"], form[data-supabase-action="upsert-appearance"], form[data-supabase-action="upsert-accessibility"]').forEach((form) => form.addEventListener('submit', async () => { const values = {}; form.querySelectorAll('[data-setting-field]').forEach((field) => values[field.dataset.settingField] = field.type === 'checkbox' ? field.checked : field.value); delete values.sms_notifications; try { await api.settings.save(values); toast('Account preferences saved.'); } catch (error) { toast(error.message); } }));
    document.querySelectorAll('[data-setting-media]').forEach((input) => input.addEventListener('change', async () => { const file = input.files?.[0]; if (!file) return; try { await api.profile.upload(file, input.dataset.settingMedia); toast('Profile image uploaded securely.'); } catch (error) { toast(error.message); } }));
    document.querySelectorAll('[data-future-action="logout"]').forEach((button) => button.addEventListener('click', async () => { try { await api.settings.signOut(); window.location.href = 'index.html'; } catch (error) { toast(error.message); } }));
    $('#logout-other-devices')?.addEventListener('click', async () => { try { await api.settings.signOut('others'); toast('Other sessions have been signed out.'); } catch (error) { toast(error.message); } });
  }

  function bindFeed() {
    if (!$('#composer-form')) return;
    const renderLiveFeed = async () => { const list = $('#feed-list'); list.setAttribute('aria-busy', 'true'); try { const [posts, user] = await Promise.all([api.feed.list(), api.requireUser()]); list.innerHTML = posts.map((post) => `<article class="feed-post" data-post-card="${post.id}"><header class="post-head"><div class="post-avatar avatar-saffron">${escape((post.profiles?.full_name || 'M').split(' ').map((p) => p[0]).join('').slice(0,2))}</div><div class="post-author"><strong>${escape(post.profiles?.full_name || 'Community member')}</strong><span>${new Date(post.created_at).toLocaleString()}</span></div><span class="post-type">${escape(post.post_type || 'Discussion')}</span></header><div class="post-body"><p>${escape(post.body)}</p></div><footer class="post-actions"><button class="post-action ${post.post_reactions?.some((item) => item.user_id === user.id) ? 'active' : ''}" type="button" data-post-action="like" data-post-id="${post.id}"><span>♡</span><em>${post.post_reactions?.length || 0}</em></button><button class="post-action" type="button" data-post-action="share" data-post-id="${post.id}"><span>↗</span></button></footer></article>`).join(''); $('#feed-empty').hidden = posts.length !== 0; } catch (error) { toast(`Community posts could not load: ${error.message}`); } finally { list.removeAttribute('aria-busy'); $('#feed-skeletons').hidden = true; } };
    setTimeout(renderLiveFeed, 500);
    $('#open-composer')?.addEventListener('click', () => { $('#composer-modal').classList.add('open'); $('#composer-modal-backdrop').classList.add('open'); });
    document.querySelectorAll('[data-composer-type]').forEach((button) => button.addEventListener('click', () => { $('#post-body').dataset.postType = button.dataset.composerType; $('#composer-modal').classList.add('open'); $('#composer-modal-backdrop').classList.add('open'); }));
    $('#composer-close')?.addEventListener('click', () => { $('#composer-modal').classList.remove('open'); $('#composer-modal-backdrop').classList.remove('open'); });
    $('#composer-modal-backdrop')?.addEventListener('click', () => { $('#composer-modal').classList.remove('open'); $('#composer-modal-backdrop').classList.remove('open'); });
    $('#composer-form').addEventListener('submit', async (event) => { event.preventDefault(); event.stopImmediatePropagation(); const body = $('#post-body').value.trim(); if (!body) return; try { await api.feed.create({ body, postType: $('#post-body').dataset.postType || 'discussion' }); $('#composer-form').reset(); $('#composer-modal').classList.remove('open'); $('#composer-modal-backdrop').classList.remove('open'); await renderLiveFeed(); toast('Your community update was published.'); } catch (error) { toast(`Post could not be published: ${error.message}`); } }, true);
    document.addEventListener('click', async (event) => { const button = event.target.closest('[data-post-action="like"]'); if (!button || !isUuid(button.dataset.postId)) return; try { await api.feed.toggleReaction(button.dataset.postId); } catch (error) { toast(error.message); } });
  }

  async function bindMessages() {
    if (!$('#chat-list')) return;
    let active = sessionStorage.getItem('manglik-meets-open-conversation') || '';
    const currentUser = await api.requireUser().catch(() => null);
    let channel = null;
    const renderThread = async () => { if (!active) return; const box = $('#message-thread'); box.setAttribute('aria-busy', 'true'); try { const items = await api.chat.messages(active); box.innerHTML = items.length ? items.map((item) => `<div class="message-row ${item.sender_id === currentUser?.id ? 'mine' : ''}"><article class="message-bubble"><p>${escape(item.body || 'Shared an image')}</p><small>${new Date(item.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</small></article></div>`).join('') : '<div class="chat-list-empty"><p>No messages yet. Start a thoughtful conversation.</p></div>'; box.scrollTop = box.scrollHeight; } catch (error) { toast(`Messages could not load: ${error.message}`); } finally { box.removeAttribute('aria-busy'); } };
    try { const rows = await api.chat.conversations(); const list = $('#chat-list'); list.innerHTML = rows.map((row) => { const other = row.conversations?.conversation_members?.find((member) => member.user_id !== currentUser?.id); const p = other?.profiles || {}; return `<button class="chat-list-item" type="button" data-live-conversation="${row.conversation_id}"><span class="chat-avatar">${escape((p.full_name || '?').slice(0,2))}</span><span><strong>${escape(p.full_name || 'Conversation')}</strong><small>${escape(p.is_online ? 'Online' : 'Private conversation')}</small></span></button>`; }).join(''); $('#chat-list-empty').hidden = rows.length !== 0; if (!active && rows[0]) active = rows[0].conversation_id; await renderThread(); } catch (error) { toast(`Conversations could not load: ${error.message}`); }
    $('#chat-list').addEventListener('click', async (event) => { const row = event.target.closest('[data-live-conversation]'); if (!row) return; active = row.dataset.liveConversation; sessionStorage.setItem('manglik-meets-open-conversation', active); channel?.unsubscribe(); channel = api.chat.subscribe(active, renderThread); await renderThread(); });
    $('#message-composer')?.addEventListener('submit', async (event) => { if (!active) return; event.preventDefault(); event.stopImmediatePropagation(); const input = $('#message-input'); const body = input.value.trim(); if (!body) return; try { await api.chat.send({ conversationId: active, body }); input.value = ''; await renderThread(); } catch (error) { toast(`Message could not be sent: ${error.message}`); } }, true);
    if (active) channel = api.chat.subscribe(active, renderThread);
  }

  bindProfile(); bindDiscover(); bindSocialActions(); bindMatches(); bindNotifications(); bindSettings(); bindFeed(); bindMessages();
}());
